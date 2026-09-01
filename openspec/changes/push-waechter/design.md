# Entwurf

> Fassung 2, nach der Plan-Review vom 01.09. Was sich geändert hat und warum,
> steht in `REVIEWS.md`. Die drei teuersten Änderungen: das Stille-Signal war
> **nicht zurechenbar**, der Wächter kannte seinen **eigenen Ausfall** nicht,
> und das Fenster hielt seine eigene Zusage nicht ein.

## Die eine Entscheidung, aus der die anderen folgen

**Der Wächter läuft außerhalb der Anlage, die er überwacht.**

Alles andere ist Folge. Ein Wächter in der Datenbank meldet über denselben
`net.http_post`-Weg, dessen Blindheit das Problem ist, und ein `supabase db
reset` auf DEV nimmt ihn mit — er kann weder seinen eigenen Ausfall melden noch
sein eigenes Verschwinden. Ein GitHub-Actions-`schedule:` kann beides, weil er
von Supabase nichts braucht außer der Verbindungszeichenkette, die als
Actions-Secret ohnehin vorliegt.

## Warum er nichts in die Datenbank schreibt

Der erste Zuschnitt sah eine Migration vor: `push_zustellungen` trägt nur
`created_at` und keine Zeit für den Zustandswechsel, also fehlte scheinbar die
Grundlage für „seit X Stunden ging gar nichts durch".

Die Messung hat die Frage anders beantwortet. Die Lebendigkeit steht in
`cron.job_run_details`, die Gesundheit des Transports in `net._http_response` —
beide je Zeile mit Zeitstempel. Damit entfällt die Migration, und mit ihr das
Risiko, eine laufende Zustelltabelle für einen Wächter umzubauen.

## Die vier Signale, und aus welcher Quelle jedes kommt

Die Quelle ist hier nicht Beiwerk. Der erste Entwurf hat alle drei Fragen an
`net._http_response` gestellt, und für eine davon ist diese Tabelle **blind**.

| Signal | Quelle | rot, wenn | fängt |
| --- | --- | --- | --- |
| **Antwort** | `net._http_response` | eine Zeile mit `status_code <> 200`, `timed_out`, oder `error_msg is not null` | den rotierten Bearer (`401`), den Function-Ausfall (`502`), die Zeitüberschreitung |
| **Stillstand** | `cron.job_run_details` ⋈ `cron.job` | der jüngste `succeeded`-Lauf von `push-wiederholung` ist älter als **15 Minuten**, oder es sind weniger als die **Hälfte** der im Fenster erwarteten Läufe | abbestellte Zeitplanung, `db reset` auf DEV, `active = false`, pausiertes Projekt, stotternder Takt |
| **Aufgabe** | `push_zustellungen` | eine Zeile mit `zustand = 'aufgegeben'` und `created_at` im Fenster | genau den Ausfall vom 28.–31.08. |
| **Messausfall** | der Wächter selbst | eine Abfrage scheitert, oder eine Bestandsabfrage liefert null Zeilen, wo Zeilen sein müssen | rotiertes Secret, abgelaufenes Zertifikat, Netz, Rechteentzug |

### Warum „Stillstand" nicht aus `net._http_response` kommt

Weil diese Tabelle **keine Ziel-URL trägt** und denselben Weg mit dem
Mail-Webhook der Kontaktanfragen teilt. Das schlägt in beide Richtungen fehl:
eine einzige Kontaktanfrage im Fenster erzeugt dort eine Zeile — „null Zeilen"
wäre falsch, der Wächter grün, und der Minutentakt trotzdem tot. Genau der
Fall, für den es ihn gibt.

`cron.job_run_details` trägt `jobid`, und `cron.job` bindet den an `jobname`.
Damit ist die Aussage zurechenbar: *dieser* Lauf lief, mit *diesem* Ergebnis.
Gemessen auf DEV: jüngster erfolgreicher Lauf **46 s** alt, **120** Läufe in
120 Minuten — also genau der erwartete Minutentakt.

**Warum zwei Bedingungen und nicht eine.** Das Alter des jüngsten Laufs fängt
den harten Ausfall; die Mindestmenge fängt den Takt, der nur noch stottert. Die
erste Fassung stand auf „null Läufe im Fenster" mit der Begründung, eine
Mindestmenge reagiere auf verspätete Actions-Läufe. **Das war falsch**, und die
Plan-Review hat es benannt: die Abfrage ist an die Datenbankzeit und das Fenster
gebunden, nicht an den vorherigen Actions-Lauf. Eine Verspätung verschiebt das
Fenster, sie leert es nicht.

Die Hälfte ist bewusst grob. Ein halb laufender Takt verliert nichts, er
verzögert nur — die Anspruchsfrist holt die Aufträge nach. Der Wert soll den
Unterschied zwischen „läuft" und „läuft kaum" treffen, nicht eine Güte messen.

Was `cron.job_run_details` **nicht** sagt, ist, ob `send-push` geantwortet hat —
ein `succeeded` heißt nur, dass das SQL lief. Genau dafür ist das
Antwort-Signal da. Die beiden ergänzen sich; keines ersetzt das andere.

### Das Antwort-Signal wacht über den ganzen `pg_net`-Weg, nicht über Push

Umgekehrt gilt dieselbe Fehlende-URL: eine gescheiterte Kontaktanfrage-Mail
rötet diesen Wächter. Das ist kein Fehlalarm — ein Fire-and-Forget-Aufruf ist
tatsächlich gescheitert, und dieser Weg war bis heute genauso blind. Es heißt
aber, dass der Befund **nicht** „Push ist kaputt" sagen darf, sondern „ein
`net.http_post` hat nicht 200 geantwortet". Der Wortlaut des Befundes ist hier
Teil des Entwurfs, keine Formulierungsfrage.

### Warum „Messausfall" ein eigenes Signal ist

Ohne ihn hat der Wächter einen stillen Grünfall: schlägt die Verbindung fehl
oder liefert eine Abfrage nichts, misst er nichts und sagt nichts. Ein leeres
Messergebnis ist ein Fehler, keine Feststellung — dieselbe Regel führt
`db-drift-scan.logic.ts:104` schon heute (`Der Bestand ist leer … die Abfrage
hat nichts gemessen`).

Er wird nie als Stillstand gemeldet: die beiden haben verschiedene Ursachen und
verschiedene erste Handgriffe.

## Die Fristen, und woran sie hängen

Drei Größen, drei harte Bindungen — und die Plan-Review hat gezeigt, dass die
erste Fassung ihre eigene Zusage nicht einhielt.

| Größe | Wert | Bindung |
| --- | --- | --- |
| Takt | **stündlich** | muss deutlich unter `pg_net.ttl` (6 h) liegen, sonst misst der Wächter ein Fenster, das pg_net schon geleert hat |
| Fenster | **120 Minuten** | trägt **60 Minuten** Verspätung eines geplanten Laufs, ohne dass zwischen zwei Fenstern eine Lücke entsteht |
| — | **> 20 Minuten** | ein Zustellauftrag braucht von der Entstehung bis `aufgegeben` höchstens 1+2+4+8 = 15 Minuten Wartezeit plus Minutenraster. Nur deshalb ist `created_at` ein zulässiger Ersatz für die fehlende Zustandszeit |

**„Keine Lücke" ist eine Toleranz, keine Garantie — und die erste Fassung hat
das Gegenteil behauptet.** GitHub sagt für `schedule:` keinen Takt zu: Läufe
kommen verspätet oder fallen aus. Ein festes Fenster kann daraus keine
Vollständigkeit machen; es kann nur eine benannte Verspätung tragen. Beide
Reviewer haben denselben Satz angestrichen, und er ist ersetzt: 120 Minuten
tragen 60 Minuten Verzug, darüber hinaus entsteht eine ungeprüfte Lücke.

Der saubere Ausweg wäre ein fortgeschriebener Merkpunkt — „geprüft seit dem
letzten erfolgreichen Lauf". Er kostet einen Zustand, den dieser Wächter
bewusst nicht hat, und der Zustand müsste irgendwo liegen, wo ihn ein `db
reset` nicht mitnimmt. Für den Anfang ist die benannte Toleranz das ehrlichere
und billigere von beidem; der Merkpunkt steht unter „Was offen bleibt".

Die 15 Minuten sind gerechnet, nicht geschätzt:
`push_zustellung_quittieren` setzt `naechster_versuch = now() + interval '1
minute' * power(2, versuche)` mit dem **alten** `versuche`, und gibt bei
`versuche + 1 >= 5` auf (`20260827240000:309-313`). Die Abstände sind also
1, 2, 4, 8 — der fünfte Versuch findet nicht mehr statt.

**Die erste Fassung stand auf 60/90 und behauptete „keine ungeprüfte Lücke".**
Das war falsch: 90 Minuten Fenster bei 60 Minuten Takt tragen nur 30 Minuten
Verspätung, und geplante Actions-Läufe kommen unter Last später. 120 verdoppelt
die Toleranz und bleibt weit unter der TTL.

**Und der Gegenvorschlag, den Takt auf 15 Minuten zu senken, ist abgelehnt.**
Er verkürzt die Erkennung, vervierfacht aber die Zahl roter Läufe eines
andauernden Ausfalls. Der Ausfall vom 28.–31.08. hätte stündlich rund 72 rote
Läufe erzeugt, im 15-Minuten-Takt rund 288. Die Vergleichsgröße ist nicht
„90 Minuten gegen 30", sondern **„zwei Stunden gegen drei Tage"** — und gegen
den zweiten Wert ist der Unterschied der beiden ersten Beiwerk.

**Ein andauernder Ausfall meldet sich trotzdem wiederholt, und das ist Absicht.**
Wiederholte Meldungen zu einem *echten*, offenen Ausfall sind keine
Alarm-Müdigkeit; die entsteht aus Meldungen ohne Befund.

**Aber das Aufgabe-Signal ist flankengesteuert, und das ist eine echte Grenze.**
Es sieht Zeilen, die im Fenster **entstanden** sind. Bleibt APNs kaputt und
entsteht zwei Stunden lang kein neuer Hinweis, wird der Wächter grün, obwohl
nichts repariert ist. Der nächste Zustellversuch rötet ihn wieder — aber
zwischendurch behauptet Grün mehr, als es weiß. Beide Reviewer haben darauf
gezeigt; die Auflösung wäre ein Zustand („offener Vorfall bis zur Quittierung"),
und den hat dieser Wächter bewusst nicht. Die Grenze steht deshalb benannt unter
„Was offen bleibt", statt weggeschrieben zu werden.

## Der Drift-Scan wandert in den Wächter, nicht in `migrate-dev`

Naheliegend wäre ein Schritt in `deploy.yml`s `migrate-dev` — dort wird bei
jedem Merge auf `main` ohnehin gegen DEV geschrieben. Dagegen spricht die
Verdrahtung: `deploy` hängt an `needs: [migrate-dev, drift-gate]`. Ein roter
Scan in `migrate-dev` blockiert den **Frontend-Deploy**, und zwar für einen
Befund, der mit dem auszuliefernden Build nichts zu tun hat.

Im stündlichen Wächter ist derselbe Scan billiger und schneller: er blockiert
nichts, und er meldet innerhalb einer Stunde statt beim nächsten Merge.
`migrate-dev` bleibt unangetastet.

**Für `migrate-prod` ist die Sorge nachgemessen und trifft nicht zu.** Der
`drift-gate`-Job in `deploy.yml:228` fährt `migration-drift-gate.ts` — die
Migrationshistorie, nicht den Objekt-Scan. Der Objekt-Scan steht allein in
`migrate-prod.yml:152`, einem eigenen Workflow, an dem `deploy` nicht hängt. Ein
cron-Befund dort rötet den angestoßenen Migrationslauf und nichts sonst. Das
ist gewollt: eine PROD-Migration, nach der der Wiederholungslauf ungeplant
dasteht, soll auffallen. Sie läuft dabei nicht ins Leere — der Scan steht
**nach** dem `db push`.

Der Scan selbst bekommt die Abfrage, die ihm fehlt: **`cron.job`**. Heute prüft
er `public` und übersieht die Zeitplanung — `db-drift-scan.logic.ts:74-77` sagt
das selbst und verweist auf eine Probe von Hand. Die erwarteten Einträge sind
gemessen und auf beiden Seiten gleich:

| jobname | schedule | active | command |
| --- | --- | --- | --- |
| `push-wiederholung` | `* * * * *` | true | 33 Zeichen, ruft `push_wiederholung` |
| `beitrag-ankuendigen` | `* * * * *` | true | 35 Zeichen, ruft `beitrag…` |

**Der Befehl wird mitgeprüft, nicht nur der Name.** Ein Eintrag mit richtigem
Namen und leerem Rumpf wäre sonst grün — der Scan prüfte dann die Beschriftung
statt der Sache. Dass das geht, ist gemessen: beide Befehle tragen **weder
Bearer noch URL** (33 und 35 Zeichen), dürfen also verglichen und im Befund
genannt werden. Bei den Webhook-Funktionen ginge das nicht, deren Rumpf trägt
den Bearer inline — dort bleibt es beim Namen.

**Und Trigger werden auf `tgenabled` geprüft.** Ein per `alter table … disable
trigger` abgeschalteter Trigger steht weiter in `pg_trigger`; für den heutigen
Scan ist er damit vorhanden, und der Versand wäre trotzdem tot. Gemessen stehen
alle zwölf Trigger auf `O` — die Erweiterung startet grün. Sie schließt genau
die Lücke, die die geänderte Anforderung mit „ein **verändertes** Objekt SHALL
auffallen" verspricht.

Beide Listen stehen als Konstanten neben `ERWARTET_OHNE_MIGRATION` im selben
Modul — nicht in einer eigenen Konfigurationsdatei. Eine Datei für einen
Verbraucher wäre die Abstraktion, die `CLAUDE.md` ausdrücklich verbietet, und
die Zeitpläne ändern sich nicht öfter als der Code, der sie erwartet.

### Der Scan bekommt einen Pflicht-Parameter

`db-drift-scan.ts:26` liest `process.argv[2] || process.env.SUPABASE_DB_URL_PROD`
— **ohne Argument misst er immer PROD**. Ein Wächter mit einem Job je Seite, der
das Argument vergisst, prüfte damit PROD zweimal und DEV nie, und beide Läufe
wären grün. Der Scan verlangt künftig `dev|prod`, holt die URL selbst aus dem
passenden Secret und nennt den gemessenen Projekt-Ref im Log — dieselbe
Zielkontrolle, die `assert-target.ts` und `probe-age641-pg-cron.ts` fahren.

Das ändert den Aufruf in `migrate-prod.yml:152` mit. Er ist Teil dieses Change.

## `pg_net.ttl` wird bei jedem Lauf mitgemessen

Das ganze Fenster hängt an einem Wert, den eine ferne Änderung (`ALTER SYSTEM`,
`ALTER DATABASE`) still verschieben kann — und weder Drift-Scan noch Wächter
sähen es. Der Wächter liest deshalb `pg_net.ttl` bei jedem Lauf und schlägt
fehl, wenn sie **kürzer als das Fenster** ist. Drei Zeilen, und die Annahme
hört auf, eine zu sein.

## Die Ausgabe ist öffentlich — das ist eine Entwurfsvorgabe, kein Hinweis

Das Repository ist öffentlich, also sind die Actions-Logs es auch. Der Wächter
liest Tabellen, die sonst niemand liest: auf `net._http_response` liegt **kein
einziger Grant** (gemessen), `push_zustellungen` hat weder Policy noch Grant.

Er gibt deshalb **nur Aggregate** aus: Anzahl, Statuscode, Zeitstempel des
jüngsten Eintrags. Nie `content`, nie `headers`, nie eine `notification_id` oder
`token_id`. Der Rumpf einer Antwort kann tragen, was `send-push` hineinschreibt;
die Kopfzeilen können Anbieter-Kennungen tragen.

**`letzter_fehler` gehört ebenfalls nicht ins Log, und das war im ersten Entwurf
falsch.** Er stand dort als Teil des Befundes — was der Regel eine Zeile später
widersprach. Der Wert ist **kein Enum**: `send-push` schreibt
`e instanceof Error ? e.message : "unbekannt"` (`index.ts:205`), und die
APNs-Adresse trägt den Gerätetoken im Pfad (`/3/device/<token>`). Ein
Netzfehler beim Zustellen kann den Token damit in die Meldung tragen und von
dort in ein öffentliches Actions-Log. Gemeldet wird deshalb die **Anzahl**
aufgegebener Zustellungen, nicht ihr Grund; der Grund steht in der Tabelle und
ist mit einem DB-Zugang in zehn Sekunden lesbar.

Gemessen: auf DEV steht heute kein einziger `letzter_fehler`, auf PROD genau
einer (`apns_nicht_konfiguriert`, 29.08.). Dass die bisher aufgetretenen Werte
harmlos aussehen, ist kein Beleg über die möglichen.

### Warum kein eigener Lese-Benutzer, obwohl die Review ihn verlangt hat

Der Befund war HIGH und der Vorschlag naheliegend: statt `postgres` einen
`monitoring`-Benutzer mit `select` auf die drei Tabellen. **Auf dieser Plattform
geht das nicht**, gemessen auf DEV:

| | |
| --- | --- |
| `current_user` | `postgres`, `rolsuper = false`, `rolcreaterole = true` |
| Eigentümer von `net._http_response`, Schema `net` und `cron` | `supabase_admin` |
| `postgres` darf lesen | **ja** |
| `postgres` darf das Leserecht weitergeben | **nein** (`SELECT WITH GRANT OPTION` = false) |
| `postgres` ist Mitglied von `supabase_admin` | **nein** |

Ein Benutzer ließe sich anlegen, bekäme aber auf die entscheidende Tabelle kein
Recht. Er deckte eins von vier Signalen ab — für einen vierten Zugangsschlüssel,
der in Infisical **und** in den GitHub-Secrets gepflegt werden müsste. Der
Restpunkt bleibt trotzdem wahr und steht unter „Was offen bleibt".

## Aufteilung der Dateien — der Hausstil, nicht ein neuer

`db-drift-scan.ts` + `db-drift-scan.logic.ts` und `db-push-prod.logic.ts` machen
es vor: die Entscheidung liegt in einer reinen Funktion, das SQL im Läufer.
Genauso hier.

- `scripts/push-waechter.logic.ts` — nimmt die gemessenen Zahlen, gibt Befunde
  zurück. Rein, ohne Datenbank, unter Vitest mutierbar.
- `scripts/push-waechter.ts` — verbindet, fragt ab, ruft die Logik, setzt den
  Exit-Code. TLS über `scripts/supabase-root-2021-ca.crt` wie `db-drift-scan.ts`.
- `.github/workflows/push-waechter.yml` — `schedule:` stündlich, plus
  `workflow_dispatch` mit einem Fenster-Eingabewert. Ein Job je Seite, jeder mit
  Wächter **und** Drift-Scan. Laufzeit wie in `deploy.yml`: `pnpm/action-setup`,
  `setup-node` mit Node 22, `pnpm install --frozen-lockfile`, dann `pnpm tsx`.

Der `workflow_dispatch` ist kein Komfort, sondern der halbe Abnahmebeleg: mit
einem winzigen Fenster wird die Stillstand-Bedingung mit Sicherheit wahr, und
der Lauf wird **echt** rot.

**Die andere Hälfte fehlt dabei, und das ist wichtig.** Ein
`workflow_dispatch`-Fehlschlag mailt an den Auslöser; ein
`schedule`-Fehlschlag geht nach den Benachrichtigungseinstellungen des
Repositories. Der Dispatch-Lauf belegt also, dass der Wächter rot wird — nicht,
dass die stündliche Mail ankommt. Beides ist getrennt zu belegen.

## Verworfene Alternativen

| Alternative | Warum nicht |
| --- | --- |
| Sentry `captureMessage` in `send-push` | Der Fehler wird gefangen, die Function gibt 200 zurück — es gibt nichts zu fangen. Sentry ist hier browser-only. Ein ausdrücklicher `captureMessage` wäre ein Wächter im Kostüm eines Fehler-Melders, mit einer zweiten Infrastruktur als Preis |
| Zweiter `pg_cron`-Lauf + Resend-Mail | Meldet über den Weg, dessen Ausfall er melden soll; ein `db reset` nimmt ihn mit |
| Meldung per Push an Donalds Gerät | Zirkulär: fällt Push aus, fällt die Meldung mit aus |
| Schritt in `migrate-dev` | Blockiert den Frontend-Deploy für einen Befund, der den Build nicht betrifft |
| Zeitspalte in `push_zustellungen` | Migration an einer laufenden Tabelle für eine Frage, die `cron.job_run_details` schon beantwortet |
| Aufräum-Regel für `net._http_response` | Widerlegt: pg_net räumt selbst, TTL 6 h, 360 Zeilen im Gleichgewicht auf beiden Seiten |
| Stillstand aus `net._http_response` | Nicht zurechenbar: eine fremde Zeile im Fenster macht das Signal grün, während der Takt tot ist |
| Merkpunkt statt festem Fenster | Braucht einen Zustand, den ein `db reset` nicht mitnimmt — für den Anfang teurer als die benannte Toleranz |
| Offener Vorfall bis zur Quittierung | Dasselbe: braucht Zustand und einen Quittierweg. Steht als Grenze benannt |
| `letzter_fehler` im Befund | Kein Enum; kann über `e.message` eine APNs-URL mit Gerätetoken tragen |
| Drift-Scan prüft nur cron-Namen | Ein Eintrag mit richtigem Namen und leerem Befehl bliebe grün |
| Eigener `monitoring`-Benutzer | Auf `net._http_response` nicht gewährbar, siehe oben |
| Takt 15 min | Vervierfacht die roten Läufe eines andauernden Ausfalls; der Gewinn ist gegen „drei Tage" Beiwerk |
| Zeitpläne in einer Konfigurationsdatei | Abstraktion für einen Verbraucher |

## Was offen bleibt

- **Der Wächter läuft mit einem Zugang, der mehr darf als lesen.** Nicht
  auflösbar, siehe oben — aber es bleibt wahr, dass ein stündlicher Lauf die
  PROD-Zugangsdaten öfter in Bewegung setzt als ein Dispatch. Wenn Supabase
  eines Tages `pg_net`-Lesen an eine eigene Rolle erlaubt, gehört das
  nachgezogen.
- **Geplante Actions-Läufe werden nach 60 Tagen ohne Repo-Aktivität
  abgeschaltet.** Trifft dieses Repository nicht, solange daran gearbeitet wird
  — ist aber die Bruchstelle, an der der Wächter still verschwindet. Wer den
  Wächter überwacht, ist damit nicht beantwortet.
- **Ob die Fehlermail eines geplanten Laufs tatsächlich ankommt**, ist eine
  Einstellung, kein Systemverhalten. Sie gehört einmal geprüft und dann
  festgehalten.
- **Das Antwort-Signal nennt den Aufrufer nicht.** Es meldet „ein
  Fire-and-Forget-Aufruf ist gescheitert" — was den Mail-Webhook der
  Kontaktanfragen mit abdeckt, aber im Befund nicht unterscheidet.
- **Ein offener Vorfall wird ohne neue Zustellungen wieder grün.** Das
  Aufgabe-Signal ist flankengesteuert. Die Auflösung ist ein Zustand („offen bis
  quittiert"), und der gehört in einen zweiten Schritt, nicht in den ersten.
- **Ein fortgeschriebener Merkpunkt statt eines festen Fensters** würde die
  Lücke bei einem ausgefallenen Lauf schließen. Er braucht einen Ablageort, den
  ein `db reset` nicht mitnimmt — also nicht die überwachte Datenbank.
