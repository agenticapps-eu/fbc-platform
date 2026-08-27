# Session Handoff — 2026-08-27 (einundvierzigste Sitzung)

> **Alles gemergt** (#244, #245, #246), beide Changes archiviert, `main` steht
> auf `45bbb40`. Die Worktrees dieser Sitzung können weg:
> `../fbc-platform.donald-age-627-chat-rechte-sidebar` und
> `../fbc-platform.age-631-release-notes`. Der 583er-Branch
> `donald/handoff-27-08` ist weiter überholt.

**Der Deploy auf `main` ist ROT, und das ist erwartet.** Die nächste Sitzung
beginnt mit der PROD-Migration — siehe den Kasten direkt unten. Alles andere in
dieser Datei ist Nachschlagewerk.

## ⚠️ ZUERST: die PROD-Migration, und die Reihenfolge ist nicht beliebig

Zwei Migrationen liegen auf `main` und fehlen PROD:
`20260827120000_thread_aktivitaetsspalten` (AGE-627) und
`20260827140000_release_notes` (AGE-631).

Deshalb ist `deploy.yml` für `45bbb40` **fehlgeschlagen**, wörtlich:

```
##[error] Migrationshistorie weicht ab. Erst `migrate-prod` freigeben, dann deployen.
```

`migrate-dev` war für denselben Commit **grün**, `drift-gate` rot, `deploy`
übersprungen. Das ist kein Defekt, sondern das gebaute Verhalten — und es
bedeutet: **bis PROD migriert ist, geht kein Frontend-Deploy raus, still.**

### Der Ablauf

1. **Prüfen, dass für die AKTUELLE `main`-SHA ein grüner `migrate-dev`-Lauf
   existiert.** `migrate-prod` bricht sonst im `plan`-Job an der ersten Hürde
   ab („PROD kommt nach DEV, nicht davor"). Jeder neue Commit auf `main` —
   auch ein reiner Doku-Commit wie dieser hier — verschiebt die SHA und
   braucht seinen eigenen grünen `migrate-dev`.

   ```
   MAIN=$(git rev-parse origin/main)
   gh api "repos/agenticapps-eu/fbc-platform/actions/runs?head_sha=$MAIN" \
     --jq '.workflow_runs[] | select(.path==".github/workflows/deploy.yml") | .id'
   gh api "repos/agenticapps-eu/fbc-platform/actions/runs/<id>/jobs" \
     --jq '.jobs[] | "\(.name): \(.conclusion)"'
   ```

2. **`gh workflow run migrate-prod.yml`** — und dabei wissen: **`apply` startet
   DIREKT hinter `plan`.** Die Reviewer-Regel auf `environment: production` ist
   seit 05.08. zurückgestellt, weil Donald der einzige Entwickler ist. Der
   Dry-Run steht im `plan`-Log, aber niemand muss ihn gesehen haben — wer ihn
   lesen will, liest ihn **vorher**, außerhalb des Workflows.

3. **Danach den fehlgeschlagenen Deploy neu starten:** `gh run rerun --failed
<run-id>`. Ein `workflow_dispatch` gibt es für `deploy.yml` nicht.

4. **Die einzige echte Prüfung der Rückfüllung aus AGE-627** gehört hierher:
   zählen, wieviele Threads MIT Nachricht ein leeres `last_message_at` haben.
   **Erwartet: null.** Lokal ist das nicht messbar — die Rückfüllung läuft vor
   jedem Fixture, und es gibt keine `seed.sql`.

## Accomplished

| Vorgang                            | Stand                                   |
| ---------------------------------- | --------------------------------------- |
| **AGE-627** Chat als rechte Leiste | ✅ gemergt (#244), 8 Bänder, archiviert |
| **AGE-631** Release-Notes an alle  | ✅ gemergt (#245), 6 Bänder, archiviert |

### AGE-627 — die Leiste und die begrenzte Seite

`message_threads` trägt drei Aktivitätsspalten, geführt von einem
`security definer`-Trigger; `fetchThreads` lädt eine serverseitig sortierte,
begrenzte Seite statt aller Threads samt aller Nachrichten. Leiste rechts ab
`xl`, darunter Schublade.

### AGE-631 — Release-Notes

`/admin/neuigkeiten` zeigt die noch nicht angekündigten archivierten Changes;
mehrere werden zu **einer** Nachricht, der Text ist frei überschreibbar, und
`send_release_note()` stellt sie genau einmal allen aktivierten Mitgliedern zu.
`/neues` hält sie danach, die Glocke verlinkt dorthin.

## Decisions

- **AGE-627 dockt ab `xl` mit 18rem**, nicht ab `lg` mit 20rem — ausgerechnet:
  die Leiste darf der Inhaltsspalte nie weniger lassen, als die Anwendung an
  ihrer schmalsten angedockten Breite ohnehin ausliefert (1024 px → 753 px).
  Bei `lg`/20rem waren es 433 px und Namen standen auf EIN Zeichen gekürzt.
- **Die Leiste hat zwei Flächen:** eingeklappt Chrome, aufgeklappt Inhalt. Im
  hellen Theme unsichtbar, im navy-Theme stand sonst ein navyer Kopf über einer
  weissen Liste.
- **AGE-631: die Eintragsliste entsteht zur BAUZEIT** (`pnpm release:entries`,
  auch über `prebuild`). Verworfen: ein CI-Schritt mit `service_role`-Schlüssel
  — ein zweiter schreibender Weg in die PROD-Datenbank für eine Liste, die
  ohnehin nur ein Mensch liest.
- **Der Riegel gegen die Doppelzustellung ist der bedingte Zustandswechsel**
  vor dem Fan-out, nicht der Knopf. Ein Knopf, den man zweimal klickt, ist der
  Normalfall.
- **Kein Opt-out für `release_note`.** Die vier Schalter aus AGE-620 schützen
  vor dem Lärm _anderer Mitglieder_. Der Ausgleich ist `/neues`.
- **AGE-631 widerspricht `specs/admin` nicht.** Die Klausel „die
  Mitgliederliste ist keine Empfängerauswahl" bleibt unberührt — die neue
  Fläche hat gar keine.

## Open questions

- **Alle drei Fremd-Reviewer sind kaputt** (27.08.): `opencode` antwortet gar
  nichts (**Exit 0**, keine Befunde), `codex` lädt die gstack-Skill-Sammlung in
  seine Antwort statt zu prüfen, `cursor-agent` will ein Login. Damit fehlen
  **die Plan-Review zu AGE-631 und die Diff-Review zu beiden Changes**. Steht
  in beiden `REVIEWS.md` (jetzt unter `archive/`) als offene Flanke.
  **Nachholen, sobald wieder einer antwortet.**
- **Donald hat die laufende Fassung nie gesehen** — der Ablauf verlangt das vor
  dem Commit. Übersprungen, weil „alles in einem Rutsch" gewünscht war.
- **`routing_queue` steht in `database.types.ts` unter `Views` statt `Tables`.**
  Vorbestehend, nicht angefasst; es erklärt, warum dort kein Insert geht.
- **AGE-629** (Suche als Inhaltsspalte): drei offene Produktfragen.
- **AGE-630** (Event-Vorlagen): materialisieren oder zur Laufzeit berechnen?
- **AGE-628**: anonymes Feedback UND Anchatten des Verfassers geht nicht beides.
- Unverändert offen: AGE-610 (Detlev/Anwalt) · AGE-512 (Stripe-/Resend-Secrets
  ungetrennt) · Aktivierungsversand 69 von 72 · Rotation des PROD-DB-Passworts ·
  AGE-598 · AGE-256 · AGE-606 (Prettier-Gate).

## Lokaler Stack und Server

Trägt Testdaten dieser Sitzung: Konten `mess-a` bis `mess-d@test.local`,
Passwort `Probe-2026-lokal`, drei Threads mit Nachrichten, eine zugestellte
Release-Note; `mess-a` hat eine Adminzeile in `staff_roles`. **Nur lokal.**

Zwei Vite-Server laufen noch (`localhost:5201` für AGE-627, `localhost:5202`
für AGE-631). **Nicht `pkill -f vite`** — auf 5173 laufen dauerhaft fremde
Server. Den eigenen Prozess gezielt beenden.

`pnpm dev` geht aus einer Agenten-Sitzung nicht (Infisical braucht ein TTY):

```
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_ANON_KEY=<ANON_KEY aus `supabase status`> \
VITE_ENVIRONMENT=local \
npx vite --port 5202 --strictPort
```

`--strictPort` ist wichtig, und **`localhost`, nicht `127.0.0.1`** — vite
lauscht auf IPv6.
