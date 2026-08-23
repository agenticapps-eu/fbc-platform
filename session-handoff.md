# Session Handoff — 2026-08-23 (elfte Sitzung)

Die **ganze Serverseite von AGE-581** gebaut: Abschnitte 3–6 vollständig, sechs
Commits auf `donald/age-581-admin-mitgliederverwaltung`, **nichts gepusht**.
28 → **38 von 73 Aufgaben**. 598 pgTAP-Tests, 1367 Vitest-Tests, 10 Deno-Tests.

## Accomplished

**Abschnitt 5 — `admin_list_members`** (`20260823140000_..._lifecycle.sql`).
Fünf `p_status`-Werte statt drei, vier neue Spalten (`deaktiviert_seit`,
`geloescht_seit`, `paid_until`, `payment_type`). `drop` + `create`, weil der
Rückgabetyp sich ändert; Grants, Kommentar und Vorgabewerte wiederhergestellt.
`payment_type` in `admin_update_profile` an **allen vier** Stellen.

**Abschnitt 6 — `event_attendees` und der Sperrhinweis**
(`20260823150000_...`). Die Zielseite von `event_attendees` prüft jetzt
`is_activated_profile()`. `blocked` läuft von der RPC bis zum Schirm; ein
gesperrtes, zuvor bestätigtes Konto kam bisher **durch** die Aktivierungswand
und landete auf leeren Seiten.

**Aufgabe 3.4 — `former_member_entries`** (`20260823160000_...`). Die Auskunft
hinter „Ehemaliges Mitglied", über Beitrags- und Kommentar-IDs.

**Abschnitt 4 — Edge Function `admin-set-member-ban`.** Der einzige Eingang zu
den vier Lebenszyklus-RPCs, mit richtungsabhängiger Reihenfolge und 207 für den
halben Zustand.

**Nebenbefund behoben:** `pnpm lint` war auf dem Branch **rot**, und CI führt den
Befehl aus. Drei Fehler aus den Sondenskripten vom 23.08.; die `.mjs`-Datei war
die erste mit Node-Globals im Repo.

**Gemessen statt hergeleitet:** zwölf Mutations-Gegenproben (je rot, je
Wiederherstellung grün), eine Browser-Sichtprobe, und eine
End-to-End-Abnahme mit **25 von 25** Zusagen.

## Decisions

- **Aufgabe 5.3 war falsch formuliert und ist korrigiert.** Sie behauptete, der
  Paritätstest gegen `search_directory` bleibe ohne Änderung grün. Er vergleicht
  Spalten*mengen* und zählt die Verwaltungsspalten namentlich auf — aus drei
  werden sieben, er musste brechen.
- **`database.types.ts` wird von Hand gepflegt, nicht generiert.** *Warum:* die
  Datei sagt es selbst; ein `supabase gen types` würfe die Anmerkungen weg und
  bringt Nullability-Drift in unbeteiligten Typen mit.
- **`former` ist `disabled_at is not null or deleted_at is not null`**, nicht
  `not is_activated_profile()`. *Warum:* letzteres ist kürzer, erfüllt jede
  naheliegende Zusage — und wäre auch für ein nie bestätigtes Konto wahr. Das
  wurde nicht entfernt, es ist nur nie angekommen.
- **`former_member_entries` bleibt SECURITY DEFINER mit abgeschriebenem
  Prädikat.** *Warum:* SECURITY INVOKER bräuchte einen für `authenticated`
  ausführbaren Helfer „ist dieses Profil entfernt?" — genau der Aufzählungsweg,
  den der Review als HIGH verworfen hat, nur eine Ebene tiefer. Ausgleich: ein
  **Wortlaut-Wächter** über die Policy (§7.18), weil kein Verhaltenstest diese
  Drift fände.
- **Der Teilfehlschlag steht in einer EIGENEN Protokollzeile (`ban_failed`)**,
  nicht im Payload der ersten — Abweichung von Aufgabe 4.5. *Warum:* die RPC
  schreibt ihre Zeile in derselben Transaktion wie die Änderung an
  `disabled_at`, also bevor irgendwer wissen kann, ob der Bann gelingt. Ein
  Protokoll, das sich nachträglich ändern lässt, ist keins.
- **Der Sperrhinweis nennt den Grund nicht.** *Warum:* dieselbe Entscheidung,
  die in der Datenbank aus zwei Zuständen einen Wahrheitswert gemacht hat.
- **`event_attendees` mit `create or replace`, nicht `drop`.** *Warum:* ihr
  Rückgabetyp bleibt; die Begründung aus Aufgabe 6.4 trifft nur auf
  `my_activation_state` zu.

## Files modified

- `supabase/migrations/20260823140000_admin_member_list_lifecycle.sql` — **neu**
- `supabase/migrations/20260823150000_event_attendees_lifecycle.sql` — **neu**
- `supabase/migrations/20260823160000_former_member_entries.sql` — **neu**
- `supabase/functions/admin-set-member-ban/{index,ban,ban.test}.ts` — **neu**
- `supabase/config.toml` — Function mit `verify_jwt = true` eingetragen
- `scripts/probe-age581-ban-abnahme.ts` — **neu**, die 25 Abnahme-Zusagen
- `supabase/tests/admin_member_list_test.sql` — §12 (Lebenszyklus), Parität auf
  sieben Verwaltungsspalten nachgezogen
- `supabase/tests/member_lifecycle_test.sql` — §7 (`former_member_entries`),
  achtzehn Zusagen samt Prädikat-Wächter
- `supabase/tests/rls_test.sql` — §18.5c (`payment_type`), §20.3b
  (`event_attendees`)
- `src/components/ActivationGate.{tsx,test.tsx}` — Sperrhinweis + sechs Zusagen
- `src/{lib/activation.ts,lib/database.types.ts,providers/auth-context.ts,providers/AuthProvider.tsx,test/auth-fixtures.tsx}`
  — `blocked` durchgereicht
- `eslint.config.js`, `scripts/probe-age581-abgleich.ts` — der Lint-Fix
- `openspec/changes/add-admin-member-lifecycle/tasks.md` — 3.4, 4.1–4.8, 5, 6

## Next session: start here

**Abschnitt 7, Aufgabe 7.1** in
`openspec/changes/add-admin-member-lifecycle/tasks.md` — das Zeilenmenü der
Admin-Mitgliederliste. Erst den RED-Test in `AdminMitgliederPage.test.tsx`
(Fixture-Bauer trägt die vier neuen Felder bereits), dann die Fläche. **Die
Warnung für den 207-Ausgang gehört hierher** — sie ist die letzte offene Hälfte
von 4.5 und muss beides sagen: unsichtbar, aber weiterhin anmeldefähig; kein
Erfolgston. Der Client ruft `supabase.functions.invoke("admin-set-member-ban",
{ body: { action, target, grund } })`; `action` ist
`disable|enable|delete|restore`, und **207 ist kein `error`** — der
supabase-js-Client behandelt 2xx als Erfolg, die Unterscheidung muss also am
Rumpf hängen (`banned === false`). `AdminMemberStatus` in
`src/lib/admin-members.ts` steht noch auf drei Werten; die Reiter sind laut
Delta **nicht** die fünf `p_status`-Werte (Abschnitt 8). Der lokale Stack läuft;
`supabase functions serve` läuft **nicht** mehr. Testliste unverändert, **immer
mit Dateiliste**.

## Open questions

- **`admin_audit.actor` verweist ohne `on delete cascade` auf `profiles`.** Ein
  Admin mit Protokollzeilen lässt sich nicht löschen, und die Löschung
  **scheitert dabei still** — die GoTrue-Admin-API meldet keinen Fehler. In der
  Abnahmeprobe umgangen, im Schema unangetastet: das ist eine Entscheidung über
  Aufbewahrung, keine für nebenbei.
- **Abweichung bei 4.5** (eigene `ban_failed`-Zeile statt Payload) — begründet
  in `tasks.md`, aber nicht abgenommen.
- **Die Anmeldeadresse des Vorsitzenden** weicht zwischen Liste und DB ab (zwei
  verschiedene Domains). Falsch gesetzt sperrt sie ihn aus der Fläche aus, auf
  der man sie korrigiert. Bis zu seiner Bestätigung ausgenommen. Wer ist wer:
  `docs/age-581-mitgliederabgleich.md`, nicht hier — **das Repo ist öffentlich**.
- **Ein Konto auf der Deaktivierungsliste ist auf DEV `matching_manager`** (auf
  PROD ohne Rolle). Mit der Verschärfung verliert es die Rolle. Braucht die
  Zuteilungsliste einen anderen Bearbeiter?
- **Was Entfernte ausserhalb von Feed und Teilnahme hinterlassen** — Nachrichten,
  Kontaktanfragen, Treffer, Angebote, Gesuche — ist ausdrücklich nicht behandelt.
- **AGE-534 steht auf Done**, obwohl seine Abnahme gesetztes `paid_until`
  verlangt und 0 von 70 gesetzt sind. Wieder aufmachen? (unverändert offen)
- Unverändert: Downgrade (AGE-516) · `admin_list_feedback()` ohne Paging ·
  AGE-497 · AGE-512 · AGE-256 · AGE-513 · AGE-258 · eigenes Issue für
  `send-activation` (2xx trotz Resend-401) · `demo_personas.sql` scheitert lokal
  an einem Fremdschlüssel · `socials` auf keiner öffentlichen Fläche ·
  WP-Quelldatei unauffindbar · `branche`-Ableitung aus `infos` existiert nicht.
