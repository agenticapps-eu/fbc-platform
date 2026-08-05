# Design — prod/dev Supabase trennen (AGE-496)

Dieser Vermerk hält die zwei Entscheidungen fest, bei denen es mehr als eine
vertretbare Antwort gab: wie Migrationen auf zwei Projekte kommen (AGE-257) und
welche Form `db:push:prod` bekommt. Die übrigen Entscheidungen stehen im
`proposal.md`, weil sie aus Befunden folgen und keine Wahl offenließen.

## A. Wie kommen Migrationen auf zwei Projekte? (AGE-257)

### Das Problem, genau benannt

Die Havarie vom 14.06. (`docs/w2-acceptance.md` §8 / R1) war **nicht** ein
vergessener Handgriff. Sie war: Code gemergt, Issues auf Done, CI grün,
Frontend deployed — und drei Migrationen fehlten in prod, wodurch drei Features
live kaputt waren (`404 PGRST202`, Score auf Stale-Wert 842, `compass_responses`
RLS-aktiv ohne Policies). **Jede Anzeige stand auf grün.** Was fehlte, war
nicht Sorgfalt, sondern ein Widerspruch.

Mit zwei Projekten verdoppelt sich die Fläche: jede Migration muss auf beide,
und ein Auseinanderlaufen ist danach nicht mehr sichtbar, sondern muss gemessen
werden.

### Alternative A — nur Drift-Gate, kein Auto-Apply

Ein Job prüft vor dem Frontend-Deploy `supabase migration list` gegen das Ziel
und bricht bei Diff ab. Applizieren bleibt überall Handarbeit.

_Dafür:_ fängt den Juni-Fall vollständig — „deployt, aber nicht migriert" wird
strukturell unmöglich, weil `deploy` am Gate hängt. Kein Automat fasst je DDL
an. Kleinster Eingriff.
_Dagegen:_ jede Migration bleibt zweimal Handarbeit, und der blockierte Deploy
kommt als Überraschung genau dann, wenn man deployen wollte. Die Reihenfolge
DEV-vor-PROD ist Konvention, nichts prüft sie.

### Alternative B — Auto-Apply auf `main`

`supabase db push` läuft im Deploy gegen PROD, bevor das Frontend hochgeht.

_Dafür:_ Drift wird strukturell unmöglich, kein Mensch nötig.
_Dagegen:_ DDL appliziert sich selbsttätig auf einer Datenbank mit echten
Menschen. Der entscheidende Einwand ist nicht „Automatik ist unheimlich",
sondern ein konkreter Prüflücken-Nachweis: `ci.yml` belegt mit `supabase db
reset` nur, dass eine Migration auf eine **leere** Datenbank passt. Ein
`not null` auf einer gefüllten Tabelle, ein Unique-Index auf Daten mit
Dubletten, ein `alter type` mit unpassenden Bestandswerten — all das ist in CI
grün und schlägt erst auf Daten fehl. Und ein DDL-Rollback ist kein
`git revert`.

### Alternative C — DEV automatisch, PROD mit Gate und Handauslöser ⭐

Merge auf `main` → `migrate-dev` appliziert auf DEV. `drift-gate` misst PROD und
blockiert `deploy` bei Diff. `migrate-prod` läuft nur per `workflow_dispatch`.

_Dafür:_ macht das DEV-Projekt zu einer Generalprobe auf echtem gehostetem
Postgres mit Daten drauf — eine Migration, die daran scheitert, scheitert dort,
wo es folgenlos ist. Der unumkehrbare Schritt bleibt eine Entscheidung.
AGE-257 selbst nennt „auto push" **oder** „Runbook + Pre-Deploy-Gate" — C nimmt
beide Hälften und legt jede dorthin, wo ihr Risiko getragen werden kann.
_Dagegen:_ die meisten beweglichen Teile, und beide DB-URLs müssen als
CI-Secrets existieren.

**Gewählt: C** (Donald, 2026-08-05).

### Was C **nicht** leistet — Richtigstellung nach dem Plan-Review

Der erste Entwurf dieses Vermerks behauptete, C schließe die Prüflücke aus B.
Zwei Reviewer haben das unabhängig voneinander angegriffen, und sie haben recht:

> DEV hat nur Demo-Personas; der PROD-Abgleich mit Anonymisierung ist
> ausdrücklich Non-goal. Ein Unique-Index auf real existierende Dubletten oder
> unpassende Enum-Bestandswerte fällt auf Demo-Daten typischerweise _nicht_ auf.

Das stimmt, und es ist genau das Argument, mit dem hier B verworfen wurde — es
gilt gegen C in abgeschwächter Form weiter. Präzise:

- **Was DEV fängt:** Migrationen, die an _irgendwelchen_ vorhandenen Zeilen
  scheitern — ein `not null` ohne Default auf einer nicht leeren Tabelle, ein
  Typwechsel, der an Bestandswerten scheitert, eine Fremdschlüssel-Ergänzung
  ohne passende Gegenstücke. Das ist mehr, als `db reset` gegen eine leere DB
  je zeigen kann, und es ist der Zugewinn gegenüber heute.
- **Was DEV nicht fängt:** alles, was an der _Beschaffenheit_ der echten Daten
  hängt — Dubletten unter einem neuen Unique-Index, Kardinalitäten, gewachsene
  Altwerte, die ein neuer Check ablehnt. Ab dem 17.08. sieht DEV diese Daten
  nie.

Die Konsequenz steht in den Tasks, nicht in dieser Wahl: **`migrate-prod` läuft
mit `--dry-run` voraus und wird gelesen**, und der Lauf gegen PROD gehört nicht
in die letzte Stunde vor einem Termin. Ein regelmäßiger anonymisierter Abgleich
DEV←PROD wäre die eigentliche Antwort; er bleibt ein eigener Change (Abschnitt
C unten).

### Reihenfolge und Sichtbarkeit — zwei Lücken aus dem Review

- **DEV-vor-PROD war nicht erzwungen.** `deploy` hing an `drift-gate`, aber
  `migrate-prod` war unabhängig auslösbar. Die Reihenfolge war damit weiter
  Konvention, obwohl dieser Vermerk das Gegenteil behauptete. `migrate-prod`
  prüft deshalb, dass für **denselben Commit** ein erfolgreicher
  `migrate-dev`-Lauf vorliegt, und bricht sonst ab.
- **Ein Fehlschlag von `migrate-dev` war unsichtbar.** Da `deploy` nur an
  `drift-gate` hing, lief die Pipeline weiter, solange PROD sauber war — die
  Frühwarnung konnte also lautlos ausfallen. `deploy` hängt jetzt an beiden.

### Form

```
deploy.yml
  migrate-dev   (push main)           db push --db-url $SUPABASE_DB_URL_DEV
  drift-gate    (push main)           migration list gegen PROD → Diff = exit 1
  migrate-prod  (workflow_dispatch)   db push --db-url $SUPABASE_DB_URL_PROD
                                      environment: production (Freigabe nötig)
  deploy        needs: [migrate-dev, drift-gate]
```

Fünf Punkte, die beim Bauen leicht falsch laufen und deshalb hier stehen:

- **`migrate-dev` läuft nur auf `main`, nie auf Pull Requests.** Sonst
  mutierte jeder offene PR das DEV-Projekt, und zwar mit Migrationen, die noch
  niemand gereviewt hat. Preview-Deploys bleiben lesende Nutzer von DEV.
- **`drift-gate` darf nicht schweigen, wenn es nicht messen kann.** Fehlt das
  Secret oder ist die DB nicht erreichbar, muss der Job **fehlschlagen**, nicht
  überspringen. Ein Gate, das bei Nichtwissen grün wird, reproduziert exakt die
  Juni-Havarie auf einer Ebene höher.
- **Drift heißt Abweichung in beide Richtungen.** Der erste Entwurf prüfte nur
  „lokal vorhanden, remote fehlend". Der Review hat zu Recht angemerkt, dass
  remote-only, umsortierte oder inhaltlich abweichende Historie genauso Drift
  ist — und das ist keine Theorie: AGE-257 musste im Juni genau so eine
  History-Reparatur von Hand fahren
  (`20260613081749_avatars_drop_public_listing_policy`). Das Gate vergleicht
  deshalb die vollständige Liste beidseitig.
- **`migrate-prod` läuft in einer geschützten GitHub-Umgebung mit
  Freigabepflicht.** Das ist das CI-Gegenstück zur getippten Bestätigung aus
  Abschnitt B: ein `workflow_dispatch` allein zeigt keinen Host, keinen Dry-Run
  und verlangt nichts. Zusätzlich gibt der Job den aufgelösten Host und den
  Dry-Run ins Log aus, bevor er anwendet — die Freigabe wird auf etwas
  Lesbares erteilt, nicht ins Blaue.
- **Concurrency und Commit-Bindung.** Alle vier Jobs teilen sich die
  bestehende `concurrency`-Gruppe, und `drift-gate` misst gegen denselben
  `github.sha`, den `deploy` ausliefert. Sonst kann ein überholender Lauf einen
  Stand freigeben, der nie deployt wird — oder umgekehrt.

### Die Folge, die niemand mag

Sobald ein Merge eine Migration enthält, blockiert `drift-gate` **jeden**
Frontend-Deploy, bis ein Mensch `migrate-prod` freigibt — auch einen eiligen
Fix, der mit der Migration nichts zu tun hat. Der Review hat verlangt, das als
Betriebsentscheidung zu benennen statt es zu erben.

**Es gibt bewusst keinen Override** (Donald, 2026-08-05). Der Ausweg ist immer
derselbe: `migrate-prod` freigeben, dann deployen. Ein Skip-Flag mit
Pflichtbegründung wäre bequemer und öffnete genau den Weg, auf dem im Juni
Frontend und Migrationen auseinanderliefen — eine Zusage, die man im Eilfall
umgehen darf, ist im Eilfall keine.

## B. Welche Form bekommt `db:push:prod`?

### Der Befund, der die Wahl bestimmt

`pnpm db:push` ist `infisical run --env=dev -- supabase db push`. Das sieht so
aus, als bestimmte die Infisical-Umgebung das Ziel. Sie tut es nicht: Infisical
liefert nur `SUPABASE_DB_PASSWORD`, das Ziel steht in
`supabase/.temp/project-ref`. Ein `db:push:prod`, das sich nur durch
`--env=prod` unterscheidet, schriebe also weiter auf das alte Projekt — und weil
beide Passwörter heute byte-gleich sind (`sha256 b8e8809f5c6f73c9`), täte es das
**ohne Fehlermeldung**. Es sähe erfolgreich aus.

### Alternative 1 — `supabase link` umschalten

Verworfen. Das ist die stille Ziel-Umschaltung, gegen die die Leitplanken dieses
Changes ausdrücklich geschrieben sind: nach einem `link` arbeitet **jeder**
folgende Befehl gegen das neue Ziel, auch die, die man danach gedankenlos
eintippt.

### Alternative 2 — npm-Skript mit `--db-url` aus Infisical

```json
"db:push:prod": "infisical run --env=prod -- sh -c 'supabase db push --db-url \"$SUPABASE_DB_URL_PROD\"'"
```

_Dafür:_ eine Zeile, Ziel explizit, kein Link im Spiel.
_Dagegen:_ keine Sicherheitsabfrage. Genau das verlangt AGE-496 aber — „kein
Flag, das man versehentlich setzt".

### Alternative 3 — Skript mit aufgelöstem Ziel und getippter Bestätigung ⭐

```
$ pnpm db:push:prod
Ziel:  db.<prod-ref>.supabase.co   (PROD — echte Mitglieder)
Migrationen, die angewendet würden:
  20260806120000_beispiel.sql
Zum Bestätigen den Projekt-Ref eintippen: _
```

_Dafür:_ Der **aufgelöste** Host wird angezeigt, nicht der beabsichtigte. Der
`--dry-run` läuft **vorher**, also weiß man, _was_ käme, bevor man Ja sagt. Und
die Bestätigung ist ein getippter Wert statt eines `y`. Das Repo kennt das
Muster bereits — `assertOptIn()` in `demo_seed.lib.ts` verlangt
`DEMO_SEED_CONFIRM=fbc-demo` und begründet es mit demselben Argument.
_Dagegen:_ eine Datei mehr.

**Gewählt: 3**, aber nicht in der zuerst entworfenen Form. Der Plan-Review hat
darin einen Zirkelschluss gefunden, und er war echt:

> Wenn der erwartete Ref aus derselben `SUPABASE_DB_URL_PROD` abgeleitet wird,
> die geprüft werden soll, besteht der Check immer: falsche URL → falscher Host
> angezeigt → falscher Ref abgetippt → grün.

Genau so war es entworfen. Die Bestätigung hätte gegen ein gedankenloses `y`
geschützt, aber nicht gegen eine falsch hinterlegte URL — und das war ihr
Zweck. Ein Mensch, der den angezeigten Ref abtippt, bestätigt nur, dass er
lesen kann.

**Der erwartete Ref braucht eine vom Ziel unabhängige Quelle.** Er wird als
Konstante im Repo festgeschrieben:

```
scripts/prod-project-ref.txt      # der PROD-Ref, committed
```

Der Ref ist kein Geheimnis — er steht in jedem ausgelieferten Client-Bundle in
`VITE_SUPABASE_URL`. Der Ablauf wird dadurch zweistufig:

1. **Maschinell, ohne Menschen:** Ref aus `SUPABASE_DB_URL_PROD` extrahieren und
   gegen die Konstante halten. Ungleich → Abbruch. Diese Stufe fängt die falsch
   hinterlegte URL, und sie fängt sie, bevor jemand etwas liest.
2. **Durch den Menschen:** aufgelösten Host und Dry-Run zeigen, Ref tippen
   lassen. Diese Stufe fängt den unabsichtlichen Lauf.

Stufe 1 ist die eigentliche Schutzbehauptung; Stufe 2 ist Absicht statt
Richtigkeit. Der ursprüngliche Entwurf hatte nur Stufe 2 und hielt sie für
beides.

`SUPABASE_DB_URL_PROD` lebt in Infisical `prod` und wird in diesem Change dort
angelegt — es ist der einzige Schreibzugriff auf `prod`, den dieser Change
vornimmt, und er ist additiv: kein bestehender Wert ändert sich.

Zwei Ergänzungen aus demselben Review:

- Das Skript **weist `--include-seed` ab**, statt sich darauf zu verlassen, dass
  eine nicht existierende `seed.sql` folgenlos bleibt. Die Abwesenheit der Datei
  bleibt die Zusage; die Zurückweisung macht sie unabhängig davon, wie eine
  künftige CLI-Version einen konfigurierten, aber fehlenden Pfad behandelt.
- Für `config push` gilt dieselbe Mechanik (`config:push:prod`): auch dort
  bestimmt sonst der Link das Ziel.

## C. `config.toml` gilt für PROD, nicht für beide

Der erste Entwurf behandelte eine Datei als Wahrheit für beide Projekte. Der
Review hat den Widerspruch benannt:

> Applying PROD URLs to DEV misroutes auth links; allowing localhost/preview
> URLs in PROD weakens the isolation.

Das ist richtig und nicht bloß unsauber. Die heutige Live-Allow-List trägt
`http://localhost:5173` — auf einem Projekt mit echten Mitgliedern ist eine
localhost-Adresse in der Redirect-Allow-List ein Abflussweg für Magic-Links und
Passwort-Zurücksetzungen. DEV braucht sie dagegen, sonst funktioniert
`pnpm dev` nicht.

**Gewählt (Donald, 2026-08-05): `config.toml` trägt strikte PROD-Werte und wird
ausschließlich gegen PROD gepusht.** DEV behält seine Dashboard-Konfiguration.

_Verworfen — `env()`-Substitution:_ eine Datei, beide Projekte, alles
versioniert. Scheitert an einer unverifizierten Annahme: `env()` gilt in
`config.toml` nicht für jedes Feld, und ob `site_url` und
`additional_redirect_urls` dazugehören, müsste erst geprüft werden. Eine
Sicherheitsgrenze auf eine ungeprüfte CLI-Eigenschaft zu stellen, ist der
falsche Ort dafür.

_Verworfen — zwei Dateien:_ `config.toml` (DEV) und `config.prod.toml`. Beides
versioniert, keine ungeprüfte Annahme — aber die CLI kennt keinen sauberen
Schalter dafür, und zwei Dateien laufen auseinander, ohne dass etwas widerspricht.

**Der Preis ist benannt:** DEVs Auth-Konfiguration bleibt unversioniert und lebt
im Dashboard. Das Runbook sagt das ausdrücklich, damit es später nicht als
Versäumnis gelesen wird. Wer DEV ändert, ändert es im Dashboard und schreibt es
dort hin — nicht in `config.toml`, denn von dort käme es nie an.

### Die Frage, die vor dem ersten Push gemessen werden muss

Ungeklärt, vom Review aufgeworfen und hier nicht wegdiskutiert:

> Ob `supabase config push` nicht aufgeführte Felder auf Defaults zurücksetzt,
> wird nirgends adressiert — dabei ist genau das das Risiko, das die Baseline
> absichern soll.

Live liegen **242 Felder**; `config.toml` deckt eine Teilmenge. Setzt der Push
den Rest zurück, träfe das beim ersten Lauf und beträfe Dinge, an die niemand
gedacht hat (Mail-Vorlagen, Rate-Limits, Session-Verhalten).

**Das wird gemessen, nicht angenommen** — und der sichere Ort dafür ist das neue,
leere PROD-Projekt: Baseline ziehen, pushen, Baseline erneut ziehen, beide
Stände über alle 242 Felder diffen. Erst wenn dieser Diff verstanden ist, geht
ein Push je gegen ein Projekt mit Daten. Steht in den Tasks vor Task 9.2.

## D. Was dieser Vermerk bewusst nicht entscheidet

- **Die Reihenfolge innerhalb der Go-Live-Woche.** Wann genau die drei
  prod-Werte umziehen, ist eine Kalenderfrage, keine Designfrage. Das Runbook
  beschreibt den Handgriff und den Rückweg.
- **Ob DEV nach dem Go-Live regelmäßig aus PROD aufgefrischt wird.** Naheliegend,
  aber es bräuchte eine Anonymisierung, und die ist ein eigener Change. Bis
  dahin bleibt DEV bei seinen Demo-Personas — mit der in Abschnitt A benannten
  Folge, dass DEV datenabhängige Migrationsfehler nur teilweise fängt. Das ist
  die stärkste offene Schwäche dieses Entwurfs, und sie wird hier benannt statt
  überdeckt.
- **Wie die Zugangsdaten nach dem Import rotiert werden.** Heute teilen sich
  `dev` und `prod` ein DB-Passwort (`sha256 b8e8809f5c6f73c9`). Das neue Projekt
  bekommt naturgemäß ein eigenes; damit ist die Trennung ab Task 6 gegeben. Was
  dieser Change **nicht** entscheidet, ist, ob das alte, geteilte Passwort vor
  dem PII-Import zusätzlich rotiert wird — es ist zu diesem Zeitpunkt in
  Infisical `dev` und `prod`, in CI und in jedem lokalen `infisical run`
  gewesen. Gehört als Vorbedingung in C10, nicht hierher.
