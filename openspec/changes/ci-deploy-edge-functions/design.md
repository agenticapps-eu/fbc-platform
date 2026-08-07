## Context

AGE-506. CI rollt Frontend und Migrationen aus, Edge Functions nicht. Der
Bestand, den der Entwurf benutzt, ist schon da:

- `scripts/dev-project-ref.txt` / `scripts/prod-project-ref.txt` tragen die
  Projekt-Refs versioniert; `assert-target.ts` liest sie bereits so.
- `deploy.yml` hat mit `migrate-dev` und `drift-gate` genau die zwei
  Vorbedingungen, die auch für Functions gelten müssen.
- `supabase/setup-cli` ist in beiden Workflows schon eingebunden.

Was fehlt, ist ein GitHub-Secret `SUPABASE_ACCESS_TOKEN` (ein Supabase-PAT).
Vorhanden sind nur `INFISICAL_TOKEN`, `SENTRY_AUTH_TOKEN`, `SUPABASE_DB_URL_DEV`
und `SUPABASE_DB_URL_PROD`.

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

## Risks / Trade-offs

**Ein kaputter Merge geht unbeaufsichtigt auf PROD.** Das gilt heute schon fürs
Frontend; die Function zieht gleich. Zurücknehmbar durch Deploy des vorigen
Commits.

**Der PAT ist ein weitreichendes Geheimnis.** Er kann mehr als Functions
deployen. Er liegt als Repo-Secret und ist damit für jeden Workflow des Repos
erreichbar — das ist die Bedingung, unter der der Job überhaupt läuft, und
gehört benannt statt beschwiegen.

**`git diff HEAD^ HEAD` setzt einen Vorgänger voraus.** Beim allerersten Commit
oder nach einem Force-Push gibt es ihn nicht; der Job fängt das ab und liefert
dann nichts aus, statt zu raten.
