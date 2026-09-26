# Session Handoff — 2026-09-26 (AGE-903 Zugangsleiter V5)

> **Scope dieser Übergabe: AGE-903.** Fremde offene Punkte stehen hier bewusst
> NICHT. Die vorige Fassung (25.09., AGE-905) steht in
> `git log -- session-handoff.md` und gehört der Sitzung, die daran arbeitet.

> ## ⚠ ZUERST
>
> **PR #436 und #437 sind gemergt**, AGE-903 steht auf Done. **Der Deploy
> steht still, und das ist gewollt:** `drift-gate` bricht ab mit „DRIFT — lokal
> vorhanden, auf dem Ziel fehlend: 20260926120000". Genau eine Migration, meine.
>
> **Die nächsten zwei Handgriffe brauchen Donalds AUSDRÜCKLICHE Freigabe** und
> sind von der stehenden Merge-Freigabe NICHT gedeckt:
>
> 1. `gh workflow run migrate-prod` (PROD-Schreibzugriff)
> 2. den blockierten Deploy wiederholen — gibt Deploy und Functions frei
>
> **Die Lauf-ID hier NICHT abschreiben.** Jeder weitere Merge auf `main` erzeugt
> einen neuen blockierten Lauf, und `gh run rerun` baut den Commit *jenes*
> Laufs, nicht den aktuellen `main` — ein Re-Run auf einem alten Lauf rollt das
> Frontend zurück (achte Deploy-Falle, 27.08.). Den jüngsten holen:
>
> ```
> gh run list --branch main --workflow Deploy --limit 1 --json databaseId,headSha
> gh run rerun --failed <diese ID>
> ```
>
> Beim Verlassen war das `36256499264` auf `93730e4`.
>
> `migrate-dev` ist in jedem dieser Läufe **durchgelaufen** — DEV trägt die
> Leiter V5 bereits.

## Accomplished

Der Change `stufen-v5` ist gebaut, gemergt und archiviert.

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
| `openspec validate --all` | **35/0** (nach dem Falten) |
| CI auf `main` (`36255511837`) | success |

Zwei Reviewer-Runden (Plan und Diff, je gemini und opencode, alle vier
REQUEST-CHANGES), zehn Befunde, jeder nachgemessen und in
`openspec/changes/archive/2026-09-26-stufen-v5/REVIEWS.md` aufgelöst.

## Decisions

**CONNECT trägt 0 €, nicht 150 €** (Donald, 26.09.: „aktuell 0, wird ja später
kommen"). *Warum:* ein Preis ohne Kaufweg ist eine Zusage ohne Gegenstand.

**Der Bestand zieht NICHT rangtreu um.** `connect`·`discover`·`exchange` →
DISCOVER, `basic` → ACTIVE. *Warum:* rangtreu verlöre ein Konto auf altem
`discover` seinen Clubzugang. „Niemand verliert, was er heute hat."

**`regs_write_own` SPIEGELT `register_for_event`**, statt eine eigene Zahl zu
tragen. *Warum:* der `public`-Zweig hat in einer pauschalen Rangprüfung keine
Entsprechung.

**Die Admin-Beschränkung liegt in der Oberfläche, nicht in `admin_set_tier()`.**
*Warum:* eine Korrektur nach unten muss möglich bleiben.

**Nur ZWEI Zwischenränge (101, 102).** *Warum:* neu sind allein `active` und
`boost`.

## Das Store-Prüferkonto — erledigt, steht auf PROD

Angelegt am 26.09. auf **ausdrückliche Freigabe Donalds**, weil die externe
TestFlight-Gruppe Benutzername und Kennwort als Pflichtfeld verlangt.

* Stufe **`exchange` (Rang 4)** — die unterste Clubstufe der HEUTIGEN Leiter.
  Es wandert mit `migrate-prod` **ohne Sonderregel** nach `discover`.
* Zugangsdaten: Infisical `prod`, `STORE_REVIEW_LOGIN` / `STORE_REVIEW_PASSWORD`.
* `is_public = false`, `activated_at` gesetzt, abgenommen mit einer **echten
  Anmeldung**: 28 Vollprofile, 27 Verzeichniszeilen, 7 Events, 40 Beiträge.

**PROD-Verteilung vor `migrate-prod`:** `basic` 3 · `discover` 1 · `exchange` 1 ·
`impact` 73 = 78 Profile.

## Files modified

* `supabase/migrations/20260926120000_stufen_v5.sql` — neu. Leiter, sechs
  Policies, drei RPCs, `handle_new_user`, sechs Katalog-Kommentare,
  Schluss-Wächter über Rang UND Preis.
* `supabase/tests/stufen_v5_leiter_test.sql`, `…_absage_test.sql` — neu.
* `supabase/tests/kontaktanfrage_staffelung_test.sql` → `…_stufe_test.sql`.
* `src/config/levels.ts` — neu `CLUB_LEVEL` / `CLUB_RANK`; die Zahl 4 steht im
  Frontend an EINER Stelle.
* `src/lib/contact-requests.ts` — der Staffelungs-Parameter ist WEG.
* Neun `openspec/specs/*` — das Delta ist gefaltet, plus
  `src/content/release-entries.generated.ts` (89 Einträge).

## Next session: start here

`cd /Users/donald/worktrees/fbc-platform/stufen-v5`. Der Arbeitsbaum steht auf
Branch `donald/age-903-archiv`; der Branch `stufen-v5` ist gemergt und kann weg.

**Fragen, nicht tun:** Donald um die Freigabe für `migrate-prod` bitten. Danach
`gh run rerun --failed 36255511834`, dann die Verteilung auf PROD zählen und
gegen die 78 oben halten, und die Gegenprobe, ob das Prüferkonto auf Rang 4
gelandet ist — die Abfrage steht in `docs/pruefer-zugang.md` und prüft am RANG,
nicht am Namen. Erst danach `wt remove`.

Aus dem Fünf-Punkte-Auftrag stehen dann noch AGE-927, AGE-928 und AGE-930 aus
(AGE-930 legt auch `open_contact` um).

## Zustand der Umgebung

* **Lokaler Stack: migriert** (Freigabe von `fbc-platform-61` eingeholt). 28
  Profile: `active` 3 · `discover` 11 · `focus` 6 · `impact` 8. Null Waisen.
  `open_contact` steht auf `true`, wie vorgefunden.
* Der Stack hat **136 von 137** Migrationen plus meiner.
  `20260925120000_release_backfill.sql` (AGE-905) fehlt und bricht lokal an
  „Profile vorhanden, aber kein Admin in `staff_roles`". **Nicht anfassen**,
  aber einrechnen: `db push --local` scheitert daran, nicht an AGE-903.
* **EIN Rest bleibt, harmlos und benannt:** im geteilten chrome-devtools-Chrome
  steht eine Seite auf `http://localhost:5217` — ein eigener Rest aus AGE-929,
  nicht der einer Nachbarsitzung (von `fbc-platform-61` bestätigt). Der Server
  dort ist tot (`curl` → 000). Die MCP-Schnittstelle antwortete dreimal leer;
  den Chrome habe ich **nicht** blind abgeschossen. Wegräumen, wenn sie wieder
  antwortet: Seite auf `about:blank`, `localStorage` leeren (dort steht ein
  `sb-127-auth-token` eines gelöschten Kontos).

## Open questions

* **FOCUS und IMPACT schalten im Gating nichts frei, was DISCOVER nicht hat** —
  jede Clubschwelle lautet `has_level(4)`. Standard aus dem Issue, Rückfrage an
  Detlev offen. Steht so im Lastenheft.
* **Detlevs V5-Funktionsmatrix ist weiterhin nicht lesbar** (`~/Documents`,
  macOS TCC, `EPERM`).
* **Preise für BOOST (75 €) und CONNECT** — später, eigene Änderung.
* Sichtbarer Fokusring auf den Seitenleisten-`NavLink`s (Befund aus AGE-929,
  eigenes Issue, bewusst in keinem Diff).

## Drei Notizen ins Gedächtnis geschrieben

* **`delete from auth.users` räumt die Profilzeile NICHT mit weg** — dritte
  unabhängige Entdeckung. Sonde: die Verteilung vorher/nachher, nicht die
  Kontenzahl. In `kontoloeschung-was-wo-haengt`.
* **Prozess- und Port-Zuordnung zwischen Sitzungen: messen, nicht erinnern.**
  Dazu die Unterscheidung von `fbc-platform-61`: die *fragende* Seite muss die
  Frageform reparieren („wem gehört der?"), die *antwortende* Seite muss vor der
  Antwort messen — gerade wenn es um einen selbst geht. In
  `chrome-devtools-profil-ist-einplaetzig`.
* **Die Vorab-Sonde vor `openspec archive` hat wieder etwas gefunden** — drei
  Fallen auf einmal (kein H1, keine `Linear:`-Zeile, `###` beendet
  `## What Changes` nicht, also fünf Ausschlüsse als das Ausgelieferte). In
  `archivieren-zieht-neuigkeiten-nach`.
