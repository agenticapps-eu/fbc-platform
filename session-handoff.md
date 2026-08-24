# Session Handoff — 2026-08-24 (zwölfte Sitzung)

**Abschnitt 7 von AGE-581 gebaut**, danach die Diff-Prüfung — und die führte auf
zwei Widersprüche im Delta selbst, die Donald entschieden hat. Vier Commits auf
`donald/age-581-admin-mitgliederverwaltung`, **nichts gepusht**.
38 → **45 von 73 Aufgaben**. 1399 Vitest, 601 pgTAP (sechs Dateien), 12 Deno.

## Accomplished

**Abschnitt 7 — das Zeilenmenü.** Sechs Handlungen hinter einer Schaltfläche,
an `document.body` portaliert. **Drei** Fallen, nicht die zwei aus dem Plan:
neben `.fbc-card:hover` (`transform`) und `<header>` (`backdrop-blur`) schnitte
auch der `overflow-x-auto` der Tabelle ein `absolute` Menü ab.

**Sichtprobe im Browser (7.6), mit Gegenprobe zuerst.** Ein *nicht* portaliertes
`fixed; inset:0` in derselben Karte misst 361×154 statt 1688×1234 — die Falle
schnappt zu. Das portalierte Menü: 224×154, `parentElement === BODY`, alle
Einträge per `elementFromPoint` getroffen, in allen drei Sichten. Zwei Befunde,
die nur die Sichtprobe fand: der Auslöser streckte sich über die ganze Karte
(`align-self: stretch` → `w-fit`), und die Rückfrage nannte den Namen zweimal.

**Diff-Prüfung (Stufe 4): fünf Befunde, vier bestätigt.** Drei behoben in
`ce28925`, der vierte führte tiefer (siehe Entscheidungen). Dazu eine CI-Lücke,
die auf demselben Weg auffiel.

**Belegt statt behauptet.** 23 Mutations-Gegenproben über vier Schichten
(Fläche, Modul, Edge Function, Migration) — je rot, je Wiederherstellung grün.
Zwei davon deckten echte Lücken auf. Plus zwei End-to-End-Durchstiche gegen den
lokalen Stack mit Prüfung in der Datenbank.

## Decisions

- **Die Datenbank kommt in BEIDEN Richtungen zuerst** (Donald, 24.08.). *Warum:*
  „Öffnen: Ban zuerst" erzeugte zwei Zustände, die dasselbe Delta verbietet —
  ein wiederhergestelltes Mitglied blieb deaktiviert **und wurde anmeldefähig**
  (`entbannen` hatte null Leser), und „reaktivieren" auf ein gelöschtes Profil
  hob die Sperre auf, *bevor* die RPC mit `22023` ablehnte. Delta **und**
  `design.md` sind mitgeändert: Änderung am Plan, nicht Rechtfertigung des Codes.
- **`207` heisst jetzt „verborgen und gesperrt stimmen nicht überein".** Beim
  Schliessen `{hidden, !banned}`, beim Öffnen `{!hidden, banned}` — **nicht**
  derselbe Zustand aus zwei Richtungen. Kriterium der Fläche: `hidden !== banned`.
  `hidden && !banned` hätte die zweite Hälfte als Erfolg durchgehen lassen.
- **`gebannt` kommt in `admin_list_members`** (Donald, 24.08.). *Warum:* das
  Delta verlangte „fehlt der Ban, SHALL derselbe Aufruf ihn nachsetzen" UND
  „‚deaktivieren' SHALL NOT an bereits deaktivierten erscheinen" — zusammen war
  der Nachsetz-Weg unerreichbar, nach der eigenen Formulierung des Delta „keine
  Handlung, sondern eine Falle". Ein **abgelaufener** Ban zählt nicht.
- **Beide Aktivierungswege hängen an `gesperrt`** (deaktiviert *oder* gelöscht),
  wie `blocked` in `my_activation_state`. Für „gelöscht" verlangt es 7.5; der
  deaktivierte Fall ist derselbe Sachverhalt — das Konto ist gebannt.
- **Nicht gespiegelt:** dass ein Admin sich nicht selbst sperren kann. Die
  Fläche kennt den Aufrufer dort nicht, die Datenbank weist es mit `22023` ab.

## Files modified

- `src/pages/AdminMitgliederPage.tsx` — `Zeilenmenue` + `handlungenFuer` statt
  `Handlungen`; `Rueckfrage` verallgemeinert (drei Arten); Klapprichtung,
  Fokusregeln, Meldungen je Ausgang
- `src/pages/AdminMitgliederPage.test.tsx` — 20 → **51** Zusagen
- `src/lib/admin-members.ts` — `setMemberBan`, Statusübersetzung (403/404/409/502)
- `src/lib/database.types.ts` — `gebannt`
- `supabase/migrations/20260824100000_admin_member_list_ban.sql` — **neu**
- `supabase/functions/admin-set-member-ban/{index,ban,ban.test}.ts` — Ordnung
  umgestellt, `fasseAusgangZusammen` auf die Invariante
- `supabase/tests/admin_member_list_test.sql` — §12.13–12.15, plan(57)→plan(60)
- `.github/workflows/ci.yml` — die zwei nie gelaufenen Lebenszyklus-Suiten
- `openspec/changes/add-admin-member-lifecycle/{tasks,design,specs/admin/spec}.md`
- `scripts/probe-age581-sichtprobe-daten.ts` — **neu**, wiederholbar, nur `127.0.0.1`

## Next session: start here

**Abschnitt 8, Aufgabe 8.1** — die fünf Reiter. Erst der RED-Test in
`AdminMitgliederPage.test.tsx` („ein deaktiviertes Mitglied fehlt unter ‚Alle'
und steht unter ‚Deaktiviert'"), dann die Fläche. Die Abbildung Reiter →
`p_status` steht **im Delta** und ist nicht zu raten: „Mitgliedschaft" ist ein
Darstellungsmodus über `p_status = 'alle'`, `aktiviert` hat keinen Reiter.
`AdminMemberStatus` in `src/lib/admin-members.ts` steht noch auf **drei** Werten
— die RPC kennt fünf. Der gewählte Reiter gehört als Suchparameter in die
Adresse; 8.4 verlangt ausdrücklich einen Test, der von **aussen** dorthin
navigiert und zurückgeht (`location.key`, siehe Gedächtnis).

**Wichtig:** Abschnitt 7 ist erst mit Abschnitt 8 bedienbar. „Alle" schliesst
Deaktivierte und Gelöschte korrekt aus, also sind „Reaktivieren" und
„Wiederherstellen" heute über die Fläche **nicht erreichbar**.

Der lokale Stack läuft, die Migration ist lokal angewendet.
`supabase functions serve` und Vite laufen **nicht** mehr.
`pnpm exec tsx scripts/probe-age581-sichtprobe-daten.ts` legt fünf Konten in den
Lebenszyklus-Zuständen an (Passwort wird gewürfelt und ausgegeben).
pgTAP **immer mit Dateiliste**, jetzt sechs Dateien.

## Open questions

- **7.5 stimmt nur zur Hälfte.** „Serverseitig erzwungen" gilt für die vier
  Lebenszyklus-RPCs. `admin_activate_member` und `issue_activation_token` kennen
  `disabled_at`/`deleted_at` **nicht** — dort ist das Ausblenden im Menü die
  einzige Hürde. Das Gate hält weiter; der Schaden wäre ein falsches
  `activated_at` und eine irreführende Mail an ein ehemaliges Mitglied.
  `admin_activate_member` wäre billig zu schliessen, `issue_activation_token`
  teilt sich den Weg mit der Selbstanforderung und ihrer Aufzählungsabwehr.
- **Für eine GELÖSCHTE Zeile mit fehlendem Ban gibt es keinen Nachsetz-Weg** —
  die Übergangstabelle bricht „löschen" dort in jedem Fall ab. Die Fläche
  erfindet keinen und verspricht in der Warnung auch keinen.
- **`grund` hat weiterhin keinen Aufrufer.** Die RPCs führen ihn als
  `default null`, die Fläche hat kein Feld. Bewusst nicht erfunden.
- **`admin_audit.actor` ohne `on delete cascade`** — am 23.08. live eingetreten:
  nach einer echten Handlung liess sich das Admin-Konto nicht mehr löschen, und
  **GoTrue meldete keinen Fehler**. Das Probe-Skript räumt jetzt zuerst das
  Protokoll ab; im Schema unangetastet.
- **Abweichung bei 4.5** (eigene `ban_failed`-Zeile statt Payload) — begründet,
  nicht abgenommen.
- Unverändert: Anmeldeadresse des Vorsitzenden · ein Konto auf der
  Deaktivierungsliste ist auf DEV `matching_manager` · was Entfernte ausserhalb
  von Feed und Teilnahme hinterlassen · AGE-534 steht auf Done ohne gesetztes
  `paid_until` · Downgrade (AGE-516) · `admin_list_feedback()` ohne Paging ·
  AGE-497 · AGE-512 · AGE-256 · AGE-513 · AGE-258 · eigenes Issue für
  `send-activation` · `demo_personas.sql` scheitert lokal an einem Fremdschlüssel
  · `socials` auf keiner öffentlichen Fläche · WP-Quelldatei unauffindbar ·
  `branche`-Ableitung aus `infos` existiert nicht.
