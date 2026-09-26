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

## 3 · pgTAP (je Stufe 1–6, was lesbar und erlaubt ist)

- [ ] Rang 1–3: kein fremdes Vollprofil, keine `offers`/`needs`, keine
      Verzeichnisliste — **nur die eigene Zeile**
- [ ] Rang 4–6: Liste **und** erweiterte Spalten zugleich
- [ ] Rang 3 sieht keine Academy-Route (Frontend-Test, hier nur der Rang)
- [ ] Kontaktanfragen mit `open_contact = false`: unter 4 abgelehnt, ab 4 an
      jeden Empfänger — inklusive des Falls, dass die Empfängerstufe nichts
      ändert. Der Test SETZT den Schalter ausdrücklich und setzt ihn am Ende
      zurück; sich auf den Default zu verlassen hängt den Folgetest an einen
      Wert, den dieser Test geändert hat
- [ ] Event: Anmelden und Absagen tragen dieselbe Bedingung, auch bei `public`
- [ ] Neuanlage über den Trigger landet auf einem Schlüssel, der in
      `membership_tiers` steht — geprüft über den Join, nicht gegen ein Literal
- [ ] Alle neuen Dateien in die Liste in `.github/workflows/ci.yml` eintragen
- [ ] Bestehende pgTAP-Tests und `demo_personas.sql` auf die neuen Schlüssel
      ziehen — gemessen 62 Literale in 14 Dateien, davon drei in Kommentaren;
      Schwerpunkte `rls_test.sql` (15), `demo_personas.sql` (14),
      `admin_set_tier_test.sql` (6). Brechen sonst laut in CI

## 4 · Frontend

- [ ] `src/config/levels.ts`: Schlüssel, Labels, Preise, Ränge, `DEFAULT_LEVEL`
- [ ] `src/config/nav.ts`: `minTier` auf `/mitglieder` → neuer `discover`;
      **neu** `minTier` auf `/academy`
- [ ] `src/pages/MitgliedschaftPage.tsx`: `PAID` → `["discover","focus","impact"]`
      (die drei Clubstufen — sonst trüge eine Stufe ohne Funktion einen
      Kaufknopf), `RECOMMENDED`, `zeigtPreise`
- [ ] `src/components/ui/TierBadge.tsx`: `LEVEL_WEIGHT` auf die neuen Schlüssel
- [ ] `src/lib/contact-requests.ts`: Staffelungs-Spiegel entfernen
- [ ] Stufentexte in `HeaderSearch`, `MemberDirectory`, `HomePage`
- [ ] `AdminMitgliederPage`: Auswahl nur DISCOVER · FOCUS · IMPACT, bestehende
      tiefere Stufe trotzdem anzeigen
- [ ] `src/lib/directory.ts`: Kopfkommentar richtigstellen — er behauptet
      `minTier: "discover"` für `/mitglieder` und `has_level(3)`; tatsächlich
      steht in `nav.ts:110` heute `"connect"`. Schon jetzt falsch, und dieser
      Change verschiebt genau diese Schwelle
- [ ] `membershipVisuals.ts` **nicht** anfassen — rechnet nur mit `rank`
- [ ] Vitest für jede geänderte Schwelle, RED vor GREEN

## 5 · Kaufweg und Doku

- [ ] `create-checkout-session`: `PAID_LEVELS` und README auf die neuen
      Schlüssel; Stripe bleibt ruhend, keine Kaufknöpfe
- [ ] `docs/lastenheft.md` Teil C: Namensfrage BOOST/Basic als entschieden
- [ ] `docs/pruefer-zugang.md`: Checklistenpunkt 2 auf DISCOVER, die Tabelle
      „Was das Konto sieht" auf **eine** Schwelle bei Rang 4, der Abschnitt
      „⚠ Nach AGE-903 …" von Ankündigung auf Vollzug
- [ ] `AGENTS.md:130` — nennt wörtlich die alte Leiter
      (`basic → connect → discover → exchange → focus → impact`). Die Datei
      liest jede Folgesitzung zuerst; bliebe sie stehen, gäbe sie die alte
      Bedeutung von `discover` als Wahrheit aus
- [ ] Release-Geschichten **nicht** anfassen

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
- [ ] Prüferkonto auf dem neuen DISCOVER anlegen: `email_confirm: true`,
      **kein Passwort im Admin-Rumpf**, Kennwort über den Aktivierungslink;
      Zugangsdaten nach Infisical, nichts davon ins Repo
- [ ] Vollzug an die Parallelsitzung melden, die den Handschritt in AGE-907 abhakt

## Offen, nicht in diesem Change

- [ ] `open_contact` umlegen — gehört zu AGE-930
- [ ] Preise für BOOST (75 €) und CONNECT — später (Donald, 25. und 26.09.:
      „aktuell 0, wird ja später kommen"); gehört auch in den PR-Text, nicht nur
      in diesen Change, der archiviert wird
- [ ] Sichtbarer Fokusring auf den `NavLink`s der Seitenleiste (Befund aus
      AGE-929, eigenes Issue)
