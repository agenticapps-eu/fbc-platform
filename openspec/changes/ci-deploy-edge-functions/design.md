## Context

AGE-506. CI rollt Frontend und Migrationen aus, Edge Functions nicht. Der
Bestand, den der Entwurf benutzt, ist schon da:

- `scripts/dev-project-ref.txt` / `scripts/prod-project-ref.txt` tragen die
  Projekt-Refs versioniert; `assert-target.ts` liest sie bereits so.
- `deploy.yml` hat mit `migrate-dev` und `drift-gate` genau die zwei
  Vorbedingungen, die auch für Functions gelten müssen.
- `supabase/setup-cli` ist in beiden Workflows schon eingebunden.

Der PAT ist ebenfalls schon da: `SUPABASE_ACCESS_TOKEN` liegt seit AGE-496 in
**Infisical, env `dev`**. Als GitHub-Secret existiert er nicht — und muss es auch
nicht, weil `INFISICAL_TOKEN` dort bereits liegt und der `deploy`-Job das Muster
`infisical run` schon vormacht. **Es kommt kein neues GitHub-Secret dazu.**

## Goals / Non-Goals

**Goals:**

- „Gemergt" heißt für Functions dasselbe wie für das Frontend: ausgeliefert.
- Die Merkregel aus 11.2 (f) wird **ersetzt**, nicht ergänzt.
- Was nicht ausgeliefert wurde, steht namentlich im Protokoll.

**Non-Goals:**

- Kein Setzen von Function-Secrets. `supabase secrets set` bleibt Handarbeit;
  der Deploy fasst sie nicht an.
- Keine Änderung an `migrate-dev`, `migrate-prod`, `drift-gate` oder `deploy`.
- Kein Rollback-Automatismus. Ein Function-Deploy ist durch einen erneuten
  Deploy des vorigen Commits zurücknehmbar; mehr braucht es nicht.

## Decisions

### 1. Nur geänderte Functions — sonst überschreibt CI eine Absicht

`supabase functions deploy` ohne Namen deployt alle sechs. Auf PROD liegt für
`notify-contact-request` laut Aufgabe 11.4 **bewusst** ein älterer Stand. Ein
pauschaler Lauf zöge ihn stillschweigend mit.

Die Ableitung läuft über die geänderten Dateien des Merges
(`supabase/functions/<name>/…`) und steckt in `scripts/changed-functions.logic.ts`
— eine reine Funktion, damit sie prüfbar ist, statt als Shell-Zeile im YAML zu
verschwinden, wo sie niemand testet.

**Benannte Restfläche:** Ändert sich in `supabase/config.toml` nur ein
`[functions.X]`-Block (etwa `verify_jwt`) ohne Codeänderung, sieht die Ableitung
das nicht. Der Job gibt dann eine Warnung aus, statt es zu verschweigen; das
Nachziehen bleibt Handarbeit.

### 2. Dieselben Vorbedingungen wie `deploy` — die Reihenfolge ist der heikle Teil

Eine Function kann einen RPC aufrufen, den es auf dem Ziel noch nicht gibt.
Genau das liegt gerade vor: `send-activation` ruft `invalidate_activation_token`,
und auf PROD gehen Migrationen nur über `migrate-prod`, also von Hand.

Deshalb `needs: [migrate-dev, drift-gate]` und dieselbe Bedingung wie `deploy`.
`drift-gate` blockiert bereits jeden Deploy, sobald PRODs Migrationshistorie vom
Repo abweicht — die Function erbt diesen Schutz, statt einen zweiten zu bauen.

Verworfen: nur DEV automatisch, PROD von Hand (formgleich mit `migrate-prod`).
Das Argument, das `migrate-prod` von Hand hält, ist „ein DDL-Rollback ist kein
`git revert`" — es trägt für Functions nicht. Und es ließe genau den Zustand
bestehen, der den Auftrag ausgelöst hat: Frontend auf PROD neu, Function alt.

### 3. Das Ziel kommt aus der Datei, nicht aus dem Secret

`--project-ref` wird aus `scripts/{dev,prod}-project-ref.txt` gelesen. Ein Ziel,
das nur im Secret steht, ist im Review unsichtbar — dieselbe Begründung, aus der
`assert-target.ts` am 2026-08-05 entstand.

### 4. Nach dem Deploy wird nachgelesen

`supabase functions list --project-ref <ref>` je Projekt, Ausgabe ins Protokoll.
Dass ein Befehl fehlerfrei zurückkam, ist kein Beleg dafür, dass das Ziel den
neuen Stand trägt — dieselbe Lehre wie „`202` belegt keinen Versand".

### 5. Die Vergleichsbasis ist der zuletzt ausgelieferte Stand, nicht `HEAD^`

Nachgetragen am 2026-08-08, nachdem der erste echte Lauf (4.5) die Lücke zeigte
— und nachdem sich herausstellte, dass sie **schon zugeschlagen hatte**: Lauf
`31211729060` sprang `functions` über (`drift-gate` rot), der Merge `36b662a`
änderte `send-activation/index.ts`, und der Folgelauf sah davon nichts mehr.
Gerettet hat es der Zufall, dass der nächste Merge dieselbe Function anfasste.

`HEAD^..HEAD` beantwortet „was änderte dieser Merge". Gebraucht wird „was ist
noch nicht ausgeliefert". Die zwei sind nur solange dasselbe, wie **jeder** Lauf
ausliefert; genau das ist nicht zugesichert, weil `drift-gate` regelmäßig rot
steht.

Die Basis ist deshalb der `head_sha` des jüngsten Laufs, in dem der
`functions`-**Job** mit `success` endete. Gemessen auf **Job**-Ebene, nicht auf
Lauf-Ebene: ein übersprungener Job macht einen Lauf nicht rot. Lauf-Ebene wäre
heute zwar zufällig richtig — weil `functions` dieselben `needs` trägt wie
`deploy`, kippt jeder Fehlschlag den ganzen Lauf — aber das ist eine
Schlusskette über GitHub-Semantik und über eine `if:`-Bedingung, die morgen
jemand ändert. Ein Job-Ergebnis ist die Eigenschaft selbst.

Verworfen: **ein Git-Tag, das CI nach jedem Erfolg umsetzt.** Es käme ohne
API-Abfrage aus und kennt keine Retention-Grenze, verlangt aber `contents:
write` — für einen Job, der einen kontoweiten Supabase-PAT im Prozess hat. Der
API-Weg braucht `actions: read`, das strikt weniger kann. Und ein umgesetztes
Tag wäre eine **zweite** Aussage darüber, was ausgeliefert ist, die von der
ersten abdriften kann; die Laufhistorie ist die erste.

**Der Rückfall warnt, er bricht nicht ab** (Donald, 08.08.). Ist die Basis nicht
zu ermitteln oder kein Vorfahr von HEAD, wird gegen `HEAD^` verglichen — das
heutige Verhalten, also nie schlechter — und der Job sagt es als `::warning::`.
Verworfen wurde, hart fehlzuschlagen: ein GitHub-API-Schluckauf färbte dann
`main` rot und machte das Ausliefern wieder zur Handarbeit. Der Schutz gegen
„sieht vollständig aus, ist es nicht" liegt stattdessen darin, dass Basis **und
Grund** in **jedem** Lauf im Protokoll stehen, auch im Normalfall.

## Risks / Trade-offs

**Ein kaputter Merge geht unbeaufsichtigt auf PROD.** Das gilt heute schon fürs
Frontend; die Function zieht gleich. Zurücknehmbar durch Deploy des vorigen
Commits.

**Der PAT ist ein weitreichendes Geheimnis.** Er kann mehr als Functions
deployen. Deshalb umschließt `infisical run` im Job **nur** den
`supabase`-Aufruf und nicht den ganzen Schritt: der Wert lebt im Prozess, der ihn
braucht, und in keinem anderen. Und die Vorbedingung wird über den **Exit-Code**
geprüft, nie über eine Ausgabe.

**Er liegt in `dev`, obwohl der Job auch auf PROD ausliefert.** Ein PAT
authentifiziert den Betreiber kontoweit und ist kein umgebungsspezifischer Wert.
Verworfen wurde, ihn zusätzlich nach `prod` zu legen: dieselbe Zugangsdatei an
zwei Stellen heißt, dass die nächste Rotation eine davon vergisst. Der Preis ist,
dass der prod-ausliefernde Job `INFISICAL_ENV: dev` trägt — das sieht auf den
ersten Blick falsch aus und steht deshalb im Workflow ausführlich begründet.

**`git diff HEAD^ HEAD` setzt einen Vorgänger voraus.** Beim allerersten Commit
oder nach einem Force-Push gibt es ihn nicht; der Job fängt das ab und liefert
dann nichts aus, statt zu raten.
