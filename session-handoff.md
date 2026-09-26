# Session Handoff — 2026-09-26 (AGE-903 Zugangsleiter V5)

> **Scope dieser Übergabe: AGE-903.** Fremde offene Punkte stehen hier bewusst
> NICHT. Die vorige Fassung (25.09., AGE-905) steht in
> `git log -- session-handoff.md` und gehört der Sitzung, die daran arbeitet.

> ## ⚠ ZUERST
>
> **PR #436 ist offen, CI lief beim Verlassen noch.** Nichts ist gemergt, nichts
> auf PROD migriert. Erste Handlung der nächsten Sitzung:
> `gh pr checks 436`.
>
> **Aber EIN PROD-Schreibzugriff ist bereits passiert und war freigegeben:** das
> Store-Prüferkonto (siehe unten). Es ist kein offener Punkt, es ist erledigt —
> aber es steht auf PROD, und das muss man wissen, bevor man Zahlen vergleicht.

## Accomplished

Der Change `stufen-v5` ist vollständig gebaut. Neun Commits auf dem Branch
`stufen-v5` (bewusst **ohne** Kürzel — Linear schliesst jedes Issue, dessen
Kürzel im Branchnamen ODER im PR-Titel steht; AGE-903 steht nur im PR-Titel).

Die Leiter danach: `active`(1, 0 €) · `boost`(2, 0 €) · `connect`(3, 0 €) ·
**`discover`(4, 300 € — der Club beginnt hier)** · `focus`(5, 600 €) ·
`impact`(6, 1200 €). `basic` und `exchange` entfallen.

| Lauf | Ergebnis |
|---|---|
| pgTAP über `supabase test db` | 40 Dateien, 1391 Zusagen, PASS |
| Vitest | 253 Dateien, 2928 Zusagen |
| `tsc --noEmit` | sauber |
| `pnpm lint` | 0 Fehler |
| Deno (Kaufweg) | 15 Zusagen |
| `openspec validate --all` | 36/0 |

Zwei Reviewer-Runden (Plan und Diff, je gemini und opencode, alle vier
REQUEST-CHANGES), zehn Befunde, jeder nachgemessen und in
`openspec/changes/stufen-v5/REVIEWS.md` aufgelöst.

## Decisions

**CONNECT trägt 0 €, nicht 150 €** (Donald, 26.09.: „aktuell 0, wird ja später
kommen"). Damit tragen alle drei Stufen ausserhalb des Clubs 0 €, und `PAID`
sind genau die drei Clubstufen. *Warum:* ein Preis ohne Kaufweg ist eine Zusage
ohne Gegenstand — dieselbe Begründung, die schon für BOOST galt.

**Der Bestand zieht NICHT rangtreu um.** `connect`·`discover`·`exchange` →
DISCOVER, `basic` → ACTIVE. *Warum:* rangtreu verlöre ein Konto auf altem
`discover` seinen Clubzugang. Die Regel lautet „niemand verliert, was er heute
hat", nicht „die Zahl bleibt".

**`regs_write_own` SPIEGELT `register_for_event`, statt eine eigene Zahl zu
tragen.** *Warum:* beide Zahlen auf 4 zu heben hätte nur die halbe Lücke
geschlossen — der `public`-Zweig hat in einer pauschalen Rangprüfung keine
Entsprechung.

**Die Admin-Beschränkung liegt in der Oberfläche, nicht in `admin_set_tier()`.**
*Warum:* eine Korrektur nach unten muss möglich bleiben, und eine
Anzeigeentscheidung in einer SECURITY-DEFINER-Funktion wäre eine Rechtegrenze,
die nur eine Migration noch ändern kann.

**Nur ZWEI Zwischenränge (101, 102), nicht sechs.** *Warum:* neu sind allein
`active` und `boost`; die anderen vier bestehen weiter.

**Das Prüferkonto wurde vorgezogen** (siehe unten). *Warum:* ein Mensch wartete.

## Das Store-Prüferkonto — erledigt, steht auf PROD

Angelegt am 26.09. auf **ausdrückliche Freigabe Donalds**, weil die externe
TestFlight-Gruppe Benutzername und Kennwort als Pflichtfeld verlangt.

* Stufe **`exchange` (Rang 4)** — die unterste Clubstufe der HEUTIGEN Leiter.
  Es wandert mit der Key-Migration **ohne Sonderregel** nach `discover`.
* Zugangsdaten: Infisical `prod`, `STORE_REVIEW_LOGIN` / `STORE_REVIEW_PASSWORD`.
  Nichts davon im Repo.
* `is_public = false`, `activated_at` gesetzt.
* Weg: `email_confirm: true` und **kein Kennwort im Rumpf**, danach
  `PUT /auth/v1/admin/users/{id}`. Das weicht begründet vom Aktivierungslink ab:
  der setzt einen Menschen voraus, der ihn einlöst — hier muss das Kennwort
  bekannt sein, weil es in eine Prüfmaske gehört.
* Abgenommen mit einer **echten Anmeldung**, nicht mit dem 200 des Setzens: 28
  Vollprofile, 27 Verzeichniszeilen, 7 Events, 40 Beiträge.

**PROD-Verteilung danach:** `basic` 3 · `discover` 1 · `exchange` 1 ·
`impact` 73 = 78 Profile.

## Files modified

* `supabase/migrations/20260926120000_stufen_v5.sql` — neu. Leiter, sechs
  Policies, drei RPCs, `handle_new_user`, sechs Katalog-Kommentare,
  Schluss-Wächter über Rang UND Preis.
* `supabase/tests/stufen_v5_leiter_test.sql`, `…_absage_test.sql` — neu.
* `supabase/tests/kontaktanfrage_staffelung_test.sql` → `…_stufe_test.sql`.
* Zehn Bestands-pgTAP-Dateien und `demo_personas.sql` — rangtreu gezogen.
* `src/config/levels.ts` — neu `CLUB_LEVEL` / `CLUB_RANK`; die Zahl 4 steht im
  Frontend an EINER Stelle.
* `src/config/nav.ts` — `/mitglieder` auf `discover`, `/academy` **neu** mit
  `minTier`.
* `src/lib/contact-requests.ts` — der Staffelungs-Parameter ist WEG, nicht bloss
  ungenutzt.
* `AGENTS.md` + `CLAUDE.md` (der Gate hält sie byte-identisch), `docs/lastenheft.md`,
  `docs/pruefer-zugang.md`, `docs/technisches-handbuch.md`, `docs/demo-*.md`,
  `supabase/functions/create-checkout-session/*`.

## Next session: start here

`cd /Users/donald/worktrees/fbc-platform/stufen-v5 && gh pr checks 436`. Ist CI
grün, mergen (Donalds stehende Freigabe bei grünem CI deckt das). **Danach
blockt `drift-gate` jeden Deploy**, bis `migrate-prod` dispatcht und der
blockierte Lauf mit `gh run rerun --failed` wiederholt ist — **beides sind
PROD-Schreibzugriffe und brauchen Donalds ausdrückliche Freigabe, die stehende
Merge-Freigabe deckt sie NICHT.** Danach die Verteilung auf PROD zählen, und
eine Gegenprobe, ob das Prüferkonto auf `discover`/Rang 4 gelandet ist (die
Abfrage steht in `docs/pruefer-zugang.md` und prüft am RANG, nicht am Namen).
Dann `openspec archive stufen-v5` und `wt remove`.

## Zustand der Umgebung

* **Lokaler Stack: migriert** (Freigabe von `fbc-platform-61` eingeholt). 28
  Profile: `active` 3 · `discover` 11 · `focus` 6 · `impact` 8. Null Waisen.
  `open_contact` steht auf `true`, wie vorgefunden.
* Der Stack hat **136 von 137** Migrationen plus meiner.
  `20260925120000_release_backfill.sql` (AGE-905) fehlt und bricht lokal an
  „Profile vorhanden, aber kein Admin in `staff_roles`" — das ist die geliehene
  und korrekt zurückgenommene Adminzeile. In CI läuft sie gegen eine leere DB in
  ihren `notice`-Zweig. **Nicht anfassen**, aber einrechnen: `db push --local`
  scheitert daran, nicht an AGE-903.
* Aufgeräumt: `.env.local` gelöscht, vite beendet, Sichtprobe-Konten entfernt.
  Nachgeprüft und sauber: keine verwaisten `profiles`, `member_settings`,
  `auth.identities` oder `storage.objects`.
* **EIN Rest bleibt, harmlos und benannt:** im geteilten chrome-devtools-Chrome
  steht eine Seite auf `http://localhost:5217` — ein eigener Rest aus AGE-929
  von heute Vormittag, nicht der einer Nachbarsitzung (von `fbc-platform-61`
  ausdrücklich bestätigt). Der Server dort ist tot (`curl` → 000), die Seite
  zeigt also ins Leere. Ich konnte sie nicht mehr schliessen: die
  MCP-Schnittstelle antwortete dreimal leer. Den Chrome habe ich **nicht** blind
  abgeschossen — das ist die Hausregel, und sie gilt auch für den eigenen Rest,
  solange ein MCP ihn hält. Wegräumen, wenn die Schnittstelle wieder antwortet:
  Seite auf `about:blank` stellen und ihr `localStorage` leeren (dort steht ein
  `sb-127-auth-token` eines gelöschten Kontos).

## Open questions

* **FOCUS und IMPACT schalten im Gating nichts frei, was DISCOVER nicht hat** —
  jede Clubschwelle lautet `has_level(4)`. Standard aus dem Issue, Rückfrage an
  Detlev offen. Steht so im Lastenheft.
* **Detlevs V5-Funktionsmatrix ist weiterhin nicht lesbar** (`~/Documents`, macOS
  TCC, `EPERM`). Donalds Vorgabe zu Kontaktanfragen gilt ungeprüft gegen das
  Original.
* **Preise für BOOST (75 €) und CONNECT** — später, eigene Änderung.
* Sichtbarer Fokusring auf den Seitenleisten-`NavLink`s (Befund aus AGE-929,
  eigenes Issue, bewusst in keinem Diff).

## Zwei Notizen ins Gedächtnis geschrieben

* **`delete from auth.users` räumt die Profilzeile NICHT mit weg** — die Kaskade
  ist seit AGE-708 bewusst entfernt. Die Kontenzahl meldet trotzdem „0". Das ist
  jetzt die **dritte** unabhängige Entdeckung (AGE-907, AGE-903); nachgetragen in
  `kontoloeschung-was-wo-haengt`, mit der Sonde, die es findet: nicht die
  Kontenzahl prüfen, sondern die Verteilung vorher und nachher.
* **Prozess- und Port-Zuordnung zwischen Sitzungen: messen, nicht erinnern.**
  Heute dreimal falsch zugeordnet, jedes Mal von einem Befehl geklärt. Und eine
  Frage mit eingebauter Vermutung („ist 5217 deiner?") bekommt eine Antwort auf
  die Vermutung — richtig ist „welche Ports hast du offen?". Nachgetragen in
  `chrome-devtools-profil-ist-einplaetzig`.
