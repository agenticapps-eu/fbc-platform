# Aufgaben — stufen-v5 (AGE-903)

Reihenfolge ist nicht frei: die Migration muss vor den pgTAP-Tests stehen, die
sie prüfen, und der Fremdschlüssel `profiles_tier_fkey` erzwingt die Reihenfolge
*innerhalb* der Migration.

## 0 · Vor der ersten Codezeile (erledigt)

- [x] Schwellen-Tabelle alt→neu aus der jüngsten Definition jeder Funktion und
      Policy, gelesen aus dem Katalog statt aus 21 Migrationsdateien
- [x] Verteilung je Stufe auf PROD, nur lesend, ohne Namen
- [x] `platform_settings.open_contact` auf PROD gelesen (`true`), **nicht geändert**
- [x] Frontend-Stellen mit hart kodierten Stufennamen und Preisen erhoben
- [x] Katalog-Scan über Funktionsrümpfe, Spalten-Defaults und Check-Constraints
      nach hart geschriebenen Schlüsseln ohne Rangschwelle
- [x] Auftragstext ins Repo geholt (`auftrag.md`)
- [x] Zuständigkeit für das Prüferkonto mit der Parallelsitzung abgestimmt

## 1 · Plan-Review (Gate, vor jeder Codezeile) — erledigt

- [x] `openspec-change-review` mit **zwei** Modellen anderer Anbieter auf die
      neun Delta-Specs; `REVIEWS.md` mit signiertem Trailer — gemini und
      opencode, beide REQUEST-CHANGES, beide Befunde nachgemessen und in
      `REVIEWS.md` aufgelöst. `codex` wurde bewusst nicht angefragt: er
      delegiert bei Artefaktsätzen dieser Grösse zurück und liefert kein
      Verdikt.
- [x] Fremdreviewer für Migration und RLS (Regel 26.08.: Schema, Rechte,
      Sicherheit) — opencode hat die Inventur gegen den Migrations-Katalog
      verifiziert und die RLS-/Kommentar-Folgeschuld gefunden; das ist derselbe
      Lauf und dieselbe fremde Sicht.

## 2 · Migration (eine Datei, forward-only) — erledigt

`supabase/migrations/20260926120000_stufen_v5.sql`. RED war 8 von 12 Zusagen rot,
GREEN ist 12 von 12 — belegt in einer Transaktion mit `rollback`, damit der
GETEILTE lokale Stack nicht umgestellt wird, solange die Bestandstests noch auf
die alten Schlüssel zeigen.

- [x] RED: pgTAP-Test, der die sechs Zielschlüssel mit ihren Rängen und Preisen
      erwartet — war rot (`supabase/tests/stufen_v5_leiter_test.sql`, 8/12)
- [x] `active` (Rang 101) und `boost` (Rang 102) anlegen — nur diese zwei
      Schlüssel sind neu; `connect`·`discover`·`focus`·`impact` bestehen weiter
- [x] Profile umhängen: `basic`→`active`, `exchange`·`connect`→`discover`;
      `focus` und `impact` bleiben unberührt
- [x] `basic` und `exchange` löschen — erst danach sind Rang 1 und 4 frei
- [x] `discover` 3→4, **danach** `connect` 2→3 (umgekehrt kollidiert es),
      zuletzt `active` 101→1 und `boost` 102→2
- [x] `profiles.tier` DEFAULT `'basic'` → `'active'`
- [x] `handle_new_user()` neu deklarieren — schreibt `'active'` statt `'basic'`
- [x] Sechs SELECT-Policies auf `has_level(4)`
- [x] `search_directory()` Eintrittstor auf `has_level(4)`
- [x] `register_for_event()` auf `has_level(4)` im `members`-Zweig
- [x] `darf_kontaktanfrage_senden()` auf `has_level(4)`, Rang-2-Zweig ersatzlos
- [x] `regs_write_own` WITH CHECK spiegelt die Bedingung aus
      `register_for_event` (öffentlich ohne Rang, `members` ab 4, Host frei)
- [x] Schlussprüfung in derselben Migration — **eine**, nicht zwei. „Kein Profil
      auf einem entfallenen Schlüssel" braucht keinen eigenen Wächter:
      `profiles_tier_fkey` macht den Löschschritt unmöglich, solange ein Profil
      noch darauf zeigt (Gegenprobe gefahren: 23503, mit Nennung des
      Schlüssels). Ein zweiter Wächter daneben könnte nie feuern, sähe aber wie
      eine echte Prüfung aus. Geprüft wird stattdessen, was der Fremdschlüssel
      **nicht** fängt — Rang und Preis, beides gültige Werte in gültigen Zeilen
      (Gegenprobe gefahren: mit `boost` auf Rang 9 bricht sie ab und schreibt
      die vorgefundene Leiter in die Meldung)
- [x] Sechs Katalog-Kommentare richtigstellen, in **derselben** Migration:
      `has_level(int)`, `membership_tiers`, `darf_kontaktanfrage_senden`,
      `register_for_event`, `search_directory` und ein neuer Kommentar auf
      `profiles_select_self_or_discover` (er fehlte). `apply_upgrade` und
      `profiles_public` bleiben richtig und wurden nicht angefasst
- [x] Migrationskopf trägt die Entscheidungen und die Zwischenrang-Begründung
- [x] Neue Testdatei in `.github/workflows/ci.yml` eingetragen — der Wächter
      `scripts/pgtap-dateiliste.test.ts` prüft die Liste in beide Richtungen
      und ist grün

## 3 · pgTAP (je Stufe 1–6, was lesbar und erlaubt ist) — erledigt

Zwei neue Dateien, zehn gezogene. Die ganze Suite läuft grün gegen das migrierte
Schema: **40 Dateien, 39 ohne Befund**, und `grants_test.sql` ist gemessen
entlastet (siehe unten).

- [x] Rang 1–3: kein fremdes Vollprofil, keine `offers`/`needs`, keine
      Verzeichnisliste — **nur die eigene Zeile**. In `rls_test.sql` über die
      Ränge 2 UND 3 zugesagt, in `directory_search_test.sql` über 1 und 3.
      Rang 3 ist der teuerste Fall: der höchste Rang ausserhalb des Clubs
- [x] Rang 4–6: Liste **und** erweiterte Spalten zugleich — als
      Positivkontrolle unmittelbar über der Grenze, sonst wäre jede Verneinung
      auch von einem Gate erfüllt, das alles zumacht
- [x] Kontaktanfragen mit `open_contact = false`: unter 4 abgelehnt, ab 4 an
      jeden Empfänger — inklusive des Falls, dass die Empfängerstufe nichts
      ändert. Der Test SETZT den Schalter ausdrücklich; zurückgestellt wird er
      durch das `rollback` der Datei, und das steht dort als Satz
- [x] Event: Anmelden und Absagen tragen dieselbe Bedingung, auch bei `public` —
      neue Datei `stufen_v5_absage_test.sql`, 11 Zusagen. **RED gefahren: ohne
      die Migration fallen 5 von 11 durch**, und die fünf benennen drei
      Vorbestands-Fehler: Rang 1 konnte ein öffentliches Event nicht absagen,
      Rang 3 durfte sich zum Mitglieder-Event anmelden, und ein **Host unter
      Rang 4 konnte sein eigenes Event nicht absagen** — die Host-Ausnahme war
      im pauschalen `has_level(4)` verloren
- [x] Neuanlage über den Trigger landet auf einem Schlüssel, der in
      `membership_tiers` steht — geprüft über den Join, nicht gegen ein Literal
- [x] Alle neuen Dateien in die Liste in `.github/workflows/ci.yml` eingetragen;
      `scripts/pgtap-dateiliste.test.ts` ist grün
- [x] Bestehende pgTAP-Tests und `demo_personas.sql` auf die neuen Schlüssel
      gezogen — **nicht mechanisch**: jedes Fixture behält seinen RANG und
      bekommt den Schlüssel, der jetzt dort sitzt, und jede Zusage, deren
      Antwort dadurch kippt, kippt benannt. Elf Zusagen haben die Seite
      gewechselt
- [x] `kontaktanfrage_staffelung_test.sql` → `kontaktanfrage_stufe_test.sql`
      umbenannt. Eine Datei, die belegt, dass es KEINE Staffelung gibt, kann
      nicht so heissen
- [x] `grants_test.sql` gemessen entlastet: es scheitert in meiner Vorrichtung,
      aber **auch ohne** die Migration — Ursache ist `create extension pgtap`,
      das ~700 Funktionen mit EXECUTE-an-PUBLIC in `public` legt. Gegenprobe
      ohne pgTAP: die Hashes über alle Tabellen- und Funktionsrechte für `anon`,
      `authenticated` und `service_role` sind vor und nach der Migration
      **identisch**. Die Migration ändert kein einziges Recht

## 4 · Frontend — erledigt

RED war die neue Zusage in `src/config/levels.test.ts` (7 von 9 rot), danach
fielen **31 Zusagen in 13 Bestandsdateien**. Jetzt **2927 Zusagen in 253 Dateien
grün**, `tsc --noEmit` sauber, `pnpm lint` ohne Fehler.

- [x] `src/config/levels.ts`: Schlüssel, Labels, Preise, Ränge, `DEFAULT_LEVEL`
      — plus **neu `CLUB_LEVEL` und `CLUB_RANK`**. Die Zahl 4 steht damit im
      Frontend an EINER Stelle; jede Fläche liest sie von dort
- [x] `src/config/nav.ts`: `minTier` auf `/mitglieder` → `discover` (Rang 4);
      **neu** `minTier` auf `/academy`
- [x] `src/pages/MitgliedschaftPage.tsx`: `PAID` → die drei Clubstufen
- [x] `src/components/ui/TierBadge.tsx`: `LEVEL_WEIGHT` — die drei Stufen
      ausserhalb des Clubs tragen `muted`, die Grenze liegt auch optisch
      zwischen Rang 3 und 4
- [x] `src/lib/contact-requests.ts`: Staffelungs-Spiegel entfernt. Der
      **Parameter** ist weg, nicht bloss seine Wirkung — ein ungenutzter
      Parameter liest sich wie eine Bedingung, die noch gilt
- [x] `src/pages/PublicProfilePage.tsx`: die Kontaktkarte trug zwei Sätze für
      zwei Hürden und trägt jetzt einen. Zwei wären nicht genauer, sondern
      irreführend
- [x] Stufentexte in `HeaderSearch`, `MemberDirectory`, `HomePage`
- [x] `src/lib/directory.ts`: Kopfkommentar richtiggestellt — er behauptete
      `minTier: "discover"`, während `nav.ts` seit AGE-598 `"connect"` trug.
      Schon vor diesem Change falsch
- [x] `AdminMitgliederPage`: Auswahl nur DISCOVER · FOCUS · IMPACT, bestehende
      tiefere Stufe trotzdem angezeigt und vorbelegt
- [x] `membershipVisuals.ts` **nicht** angefasst — rechnet nur mit `rank`
- [x] Vitest für jede geänderte Schwelle, RED vor GREEN. Umgedreht sind unter
      anderem „Connect sieht das Verzeichnis" (AGE-598) und „ein connect-Konto
      darf ein connect-Profil anschreiben" — beide waren an ihrem Tag richtig
- [x] `PublicProfilePage.staffelung.test.tsx` → `…kontaktstufe.test.tsx`

## 5 · Kaufweg und Doku — erledigt

- [x] `create-checkout-session`: `PAID_LEVELS` auf die drei Clubstufen,
      `LEVEL_RANK` auf die neuen Ränge, 15 Deno-Zusagen grün. Stripe bleibt
      ruhend, keine Kaufknöpfe. **Zwei Fallen stehen jetzt in der README**, weil
      `priceEnvKey()` den Variablennamen aus dem Schlüssel ableitet:
      `STRIPE_PRICE_EXCHANGE_*` gibt es nicht mehr, und
      `STRIPE_PRICE_DISCOVER_*` meint jetzt 300 €/30 € statt 150 €/15 € —
      derselbe Name, ein anderer Preis, ohne Fehlermeldung
- [x] `AGENTS.md`: die Leiter und die Warnung vor der Schlüssel-Verwechslung.
      Diese Datei liest jede Folgesitzung zuerst
- [x] `docs/lastenheft.md` Teil C: Leiter, Preise, Rechte-Matrix und die
      **Namensfrage BOOST/Basic als entschieden** — es gibt jetzt beide Namen,
      und sie meinen Verschiedenes (ACTIVE = Rang 1, BOOST = Rang 2)
- [x] `docs/pruefer-zugang.md`: Prüferkonto auf `discover` (Rang 4), die Tabelle
      „Was der Prüfer sieht" auf **eine** Schwelle, `/academy` ergänzt, und der
      Abschnitt „⚠ Nach AGE-903 …" von Ankündigung auf Vollzug — samt einer
      SQL-Zeile, die am Rang prüft statt am Namen
- [x] `docs/technisches-handbuch.md`, `docs/demo-zugang.md`,
      `docs/demo-script.md`: je eine Zeile mit der alten Leiter
- [x] `docs/superpowers/**` **nicht** angefasst — das sind abgeschlossene Pläne
      und Specs vergangener Changes, also Chronik wie die Release-Geschichten
- [x] Release-Geschichten **nicht** angefasst; nach `pnpm build` wurde
      `src/content/release-entries.generated.ts` zurückgesetzt

## 6 · Abnahme

- [ ] `pnpm test`, `npx tsc --noEmit`, `pnpm lint`, `openspec validate --all`
- [ ] Nach jedem `pnpm build`, vor jedem `git add`:
      `git checkout -- src/content/release-entries.generated.ts`
- [ ] Sichtprobe am lokalen Stack: je ein Konto auf Rang 1, 3 und 4 —
      Verzeichnis, Academy, Event, Kontaktanfrage
- [ ] Verteilung vor/nach der Migration dokumentiert, als Zahl ohne Namen
- [ ] Oberfläche nennt nur DISCOVER · FOCUS · IMPACT — kein „Basic", kein
      „Exchange"
- [ ] Code-Review auf den **Diff**
- [ ] PR-Text nennt `migrate-prod` und `gh run rerun --failed`

## 7 · Nach dem Merge (ausdrückliche Freigabe nötig)

- [ ] `migrate-prod` dispatchen — **nicht** von der Merge-Freigabe gedeckt
- [ ] `gh run rerun --failed` für den von `drift-gate` blockierten Deploy
- [ ] Verteilung auf PROD nach dem Lauf zählen und vorlegen
- [x] ~~Prüferkonto auf dem neuen DISCOVER anlegen~~ — **vorgezogen und erledigt
      am 26.09.**, auf ausdrückliche Freigabe Donalds. Grund: die externe
      TestFlight-Gruppe verlangt Benutzername und Kennwort als Pflichtfeld, und
      die Mitglieder-Beta stand.

      Angelegt auf `exchange` (Rang 4 der HEUTIGEN Leiter) statt auf dem neuen
      `discover` — dieselbe Stufe, anderer Name zu einem anderen Zeitpunkt. Die
      Key-Migration hängt die Kohorte `connect`·`discover`·`exchange`
      geschlossen nach `discover` um; das Konto wandert also **ohne
      Sonderregel** mit und braucht keine Zeile in der Migration.

      Weg: `email_confirm: true`, **kein Kennwort im Admin-Rumpf**, danach
      `PUT /auth/v1/admin/users/{id}` mit dem Kennwort. Das weicht vom
      Aktivierungslink ab, und zwar begründet: der setzt einen Menschen voraus,
      der ihn einlöst: hier muss das Kennwort bekannt sein, weil es in eine
      Prüfmaske gehört. Es ist der zweite der beiden dokumentierten Wege.

      Abgenommen mit einer **echten Anmeldung** über den ANON-Schlüssel, nicht
      mit dem 200 des Setzens: unter eigener Identität 28 Vollprofile, 27
      Verzeichniszeilen, 7 Events, 40 Beiträge, `search_directory` 27 Zeilen.
      Zugangsdaten in Infisical `prod` (`STORE_REVIEW_LOGIN`,
      `STORE_REVIEW_PASSWORD`), nichts davon im Repo.
- [ ] **Nach `migrate-prod`:** eine Zeile nachsehen, ob das Prüferkonto auf
      `discover` / Rang 4 gelandet ist — am RANG geprüft, nicht am Namen. Die
      Abfrage steht in `docs/pruefer-zugang.md`
- [x] Vollzug an die Parallelsitzung gemeldet (AGE-907)

## Offen, nicht in diesem Change

- [ ] `open_contact` umlegen — gehört zu AGE-930
- [ ] Preise für BOOST (75 €) und CONNECT — später (Donald, 25. und 26.09.:
      „aktuell 0, wird ja später kommen"); gehört auch in den PR-Text, nicht nur
      in diesen Change, der archiviert wird
- [ ] Sichtbarer Fokusring auf den `NavLink`s der Seitenleiste (Befund aus
      AGE-929, eigenes Issue)
