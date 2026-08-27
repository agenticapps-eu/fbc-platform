# Session Handoff — 2026-08-26 (siebenunddreißigste Sitzung: AGE-583 live auf PROD)

> Diese Datei liegt im WORKTREE
> `../fbc-platform.donald-age-583-nachrichten-zaehler`, nicht im Haupt-Checkout
> — die Sitzung war worktree-isoliert.

**Alles gemerged und live.** Drei PRs durch, PROD-Migration angewandt,
Frontend-Deploy grün und am Bundle verifiziert.

| PR | Inhalt | Stand |
| -- | -- | -- |
| #233 | AGE-616/541 Gästeflächen | gemerged |
| #234 | AGE-583 Nachrichten-Zähler | gemerged, live verifiziert |
| #235 | Sprechblase statt Kuvert | gemerged, live verifiziert |

Der GitHub-Actions-Ausfall (15:09–~19:0x) ist vorbei. #233 hing nur daran; nach
Close/Reopen lief es sofort durch.

## Was AGE-583 geworden ist

Lesestand in eigener Tabelle `thread_read_positions` (eigentümerprivate RLS),
Zähler als `SECURITY INVOKER`-Funktion, Einstieg als Sprechblase in der
Kopfzeile, Kachel auf `/profil`, Markierung je Gespräch. Bei 0 wird nichts
gezeigt.

**Zwei Befunde haben den Entwurf gedreht, beide aus Reviews:**

1. Der Schemavorschlag des Vorgangs (zwei Spalten auf `message_threads`) hätte
   dem Gegenüber eine Lesebestätigung geliefert — `threads_select` gibt jedem
   Teilnehmer die ganze Zeile. Die eigene Tabelle machte den Change **kleiner**:
   die geplante `SECURITY DEFINER`-Funktion entfiel ersatzlos.
2. `markThreadRead` schickte die **Client-Uhr** mit, während der Kommentar das
   Gegenteil behauptete. Behoben per Trigger, der `clock_timestamp()` erzwingt.

**Drei Messungen fielen gegen die Erwartung aus:** der von beiden Reviewern
geforderte Index wird nie gewählt (geholfen hat `lateral`: 213 ms → 1,2 ms);
`bigint` kommt über PostgREST als Zahl; die Kopfzeile hat bei 320 px noch 12 px
Reserve — **ein drittes Symbol trägt sie nicht mehr.**

## Neue Arbeitsregel (du, 26.08.)

**Plan- und Diff-Review nur noch bei Migration, Rechten oder Sicherheit.** UI
und Text gehen direkt durch. Anlass war, dass ich zu lange brauche — ein Teil
davon war der Ablauf, ein Teil meine Umwege (falscher Port, falsches
Messwerkzeug, eine falsch gelesene Zeitachse). Als Memory festgehalten.

## Next session: start here

**Change 2: `glocke-und-hinweistypen`** — von dir am 26.08. entschieden. Glocke
verdrahten (die Anforderung dafür liegt im offenen Change
`add-lifecycle-notifications`/AGE-299 und ist dort herauszulösen) plus fünf neue
Typen: neues Mitglied, neuer Beitrag, neues Event, Kommentar und Like auf meinen
Beitrag. Mit **Fan-out** je aktiviertem Mitglied und **Opt-out** in den
Einstellungen.

`notifications` hat bereits `read_at`, volle CRUD-Grants und die
`notifications_own`-Policy — die Glocke selbst braucht **keine Migration**, nur
Frontend. Die fünf Typen brauchen Trigger auf `profiles`, `posts`, `events`,
`comments` und `post_likes`.

**Meine Sorge, unverändert:** das sind Schreib-Trigger auf fünf Tabellen, Tage
vor dem Go-Live. Bauen ja — scharfschalten würde ich erst danach.

**Und beim Verdrahten der Glocke die 320-px-Breite messen**, nicht hoffen: mit
Sprechblase und Glocke sind 12 px übrig.

## Open questions

- **`fetchThreads` lädt alle Nachrichten aller Threads** (`chat.ts:155-159`,
  kein `limit`). Bestehender Mangel, nicht angefasst; zwei Reviewer zeigten
  unabhängig darauf. Eigener Vorgang.
- **`database.types.ts` von Hand** — beide Reviewer melden Driftgefahr, zu
  Recht. Der Fix (Fixtures an den echten Rückgabevertrag) ist ein eigener
  Vorgang.
- **Der `codex`-Reviewer prüft nicht selbst**, er startet Unter-Reviewer und
  liefert deren Antwort unter seinem Namen — einmal sogar `claude`, den eigenen
  Anbieter. Als Memory festgehalten. `gemini` und `opencode` sind die
  verlässlichen zwei.
- **Schreibende PROD-Wege blockt der Klassifikator.** `gh workflow run
  migrate-prod.yml --ref main` musst du selbst starten (`! `-Präfix im Prompt).
- Unverändert offen: AGE-610 (Detlev/Anwalt) · Aktivierungsversand 69 von 72 ·
  Rotation des PROD-DB-Passworts · Verzeichnis-Sichtbarkeit C3 (AGE-598) ·
  `effbeezee.com` zeigt auf Strato (AGE-256) · Fotografennamen in `CREDITS.md`
  seit 04.08. · `AppShell.tsx` führt `/login` in `NARROW_ROUTES` (toter Eintrag).
- **Lokaler Stack trägt Testdaten**: Anna/Bernd aus
  `scripts/chat-testkonten.ts` plus `dritter@` und `unbestaetigt@` aus dem
  Realtime-Test. Nur lokal.
- **Worktrees**: `donald/age-583-nachrichten-zaehler` und
  `donald/age-583-nachrichten-icon` sind gemerged und können mit `wt remove`
  weg; `donald/age-616-gaeste-flaechen` ebenfalls.

## Lokal ansehen

`pnpm dev` geht aus einer Agenten-Sitzung nicht (Infisical braucht ein TTY):

```
VITE_SUPABASE_URL=http://127.0.0.1:54321 \
VITE_SUPABASE_ANON_KEY=<ANON_KEY aus `supabase status`> \
VITE_ENVIRONMENT=local \
npx vite --port 5199
```

Dann `http://localhost:5199` — **nicht** `127.0.0.1:5199`, dort antwortet ein
fremder Python-Server. Anmelden: `anna@chattest.invalid` / `Testchat2026!`.
