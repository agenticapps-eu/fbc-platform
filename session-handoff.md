# Session Handoff — 2026-08-15 (AGE-534: Gruppe 5 zu, Bilder durch, Gruppe 7 angefangen)

Branch `donald/age-534-c10-mitglieder-migration-aus-wordpress`, Commit `475a315`.
Arbeitsbaum sauber. **1062 Tests grün** (Sitzungsbeginn 989), alle Prüfungen grün,
`openspec validate --all` 29/29.

Quelldatei (70 Datensätze, ausserhalb des Arbeitsbaums):
`/Users/donald/Documents/Claude/Projects/Fair Business Club/user-export-318-6a7da0ec0d721.csv`
Daneben: `wp-import-bilder/` mit 110 Originalen **und** 109 WebP-Fassungen.

## Next session: start here

**Gruppe 7 weiterbauen, bei 7.1** — das Anmeldekonto und die Transaktion. Die
Schreibanweisungen stehen bereits (`wp_schreiben.ts`, gegen den lokalen Stack
mit Rollback geprüft); es fehlt der Weg davor und darum herum:

1. Konto über die **GoTrue-Admin-Schnittstelle** anlegen (`POST /auth/v1/admin/users`),
   **ohne Passwort** — direkt in `auth.users` zu schreiben, hiesse Passwort-Hash
   und `identities` selbst zu bauen.
2. Danach **eine Transaktion je Datensatz** über `profiles`, `profile_contacts`,
   `profile_legacy` — plus `offers`/`needs`/`profile_interests` aus der
   Zusammenführung.
3. Erst dann **6.3 zu Ende**: die WebP-Dateien in die Buckets. Der Objektpfad ist
   `<uid>/…` (so legt `uploadBild` in `src/lib/profile.ts` es an, und die
   RLS-Policies prüfen genau diesen ersten Pfadteil) — die `uid` gibt es erst
   nach Schritt 1. Deshalb gehört das hierher und nicht in Gruppe 6.

Der lokale Stack läuft. Für die Sichtprobe liegt eine `.env.local` (ignoriert)
mit den lokalen Keys; `npx vite --port 5173` genügt, Anmeldung
`voll@example.test` / `LokalTesten123!`.

## Accomplished

**Gruppe 5 komplett**, inklusive 5.3 gegen die echte Quelle: 70 Datensätze,
**70× angelegt, null Befunde**, acht Zählwerte davor/danach gleich,
Konsolenausgabe ohne ein einziges `@`, Bericht mit `0600`.

**Bildstrecke (6.0–6.2, 6.5, 6.3 zur Hälfte).** 110 von 110 Bildern geholt,
109 gewandelt, 1 untauglich (1×1 px). 17 MB → 4,4 MB. Zweiter Lauf: 0 geholt,
110 vorhanden, 0,4 s. **Das Risiko mit der fremden Frist ist erledigt.**

**Gruppe 7 angefangen:** `wp_schreiben.ts` mit dem Riegel an der Mitgliedsstufe.

Dazu geschlossen: 5.2a, 5.2b, 6.0.

## Decisions

**Beide Bilder werden geholt (Donald, 15.08.)** — der Plan kannte nur den Avatar,
53 von 70 haben ein Headerbild. **Grössen: Avatar 512, Header 1600**, nur
verkleinern, nie vergrössern. **Sichtprobe abgenommen** — mit dem Vorbehalt, die
Header **nach der ersten Migration noch einmal anzusehen**; änderbar bleibt es,
weil die Originale in der Zwischenablage liegen.

**Konto ohne Kennung (5.2a):** `impact` + `activated_at is null` ist ein Rest
eines abgebrochenen eigenen Laufs und wird ergänzt; alles andere bleibt
Kollision.

**`tier` steht in den Einfüge-, nicht in den `do update set`-Spalten.** Sonst
genügte eine Selbstregistrierung unter einer bekannten Mitgliedsadresse für
`impact`.

**Spaltennamen aus dem Code, Werte immer als Parameter.** Eine unbekannte Spalte
wirft, statt still ausgelassen zu werden.

## Was beim Bauen auffiel

- **Zehn Lücken in sechs Gegenproben** (39 + 18 + 5 + 12 + 8 Mutationen). Die
  teuerste: `baueBestandsdaten` reichte `socials`, `videos` und die Kontaktfelder
  durch, ohne dass ein Test hinsah — **genau das, was die Merge-Regel als „leeres
  Ziel" gelesen und überschrieben hätte.**
- **Donalds Frage „was machen wir mit den Mediendateien?" fand mehr als jede
  Prüfung** — das fehlende zweite Bild im Plan.
- **Zahlen im Design waren geraten, wo sie messbar sind**: „das Original ist
  1000 px" stimmt für keine Bildart (1 px bis 4032 px). Ein Profilbild ist 1×1.
- **SQL, die kein Test ausführt, gehört gegen den lokalen Stack gehalten** —
  zweimal so gefunden: `count(*)` kommt als Zeichenkette, und die Upserts laufen
  (Transaktion mit Rollback).
- chrome-devtools-MCP kommt nicht an ein Chrome-Profil, an dem schon ein Browser
  hängt. Die Sichtprobe war deshalb Donalds.
- Skripte im Scratchpad können `pg` nicht auflösen; Proben gehören nach
  `scripts/`. Top-level `await` geht nur innerhalb des Projekts.

## Files modified

- **neu** `supabase/seed/wp_import.ts` + `.test.ts` (40 Tests)
- **neu** `supabase/seed/wp_bilder.ts` + `.test.ts` (22), `wp_bilder_holen.ts`
- **neu** `supabase/seed/wp_schreiben.ts` + `.test.ts` (8)
- **neu** `scripts/probe-c10-bestandsabfrage.ts`
- `supabase/seed/wp_import.lib.ts` + `.test.ts` — QUELLFELDER 26 → 28
- `supabase/seed/wp_bericht.ts` + `.test.ts` — „Was der Lauf anlegen würde"
- `openspec/.../spec.md`, `design.md`, `tasks.md`

## Open questions

- **Header-Grössen nach der ersten Migration prüfen** (Donald, 15.08.).
- **`paid_until` (3.5)** — hängt an Detlevs Zahlungsständen.
- **Was sollte in „Mitgliedschaft" (`infos_16`) stehen?** Bestätigen lassen.
- **Zwei lokale Konten tragen jetzt importierte Bilder und das Passwort
  `LokalTesten123!`** — nur lokal, aber vor einem Reset wissenswert.
- **`demo_seed.lib.ts` trägt die überholte Annahme** „dev and prod are the SAME
  Supabase project" — eigener Nachlauf.
- `pnpm format:check` war schon am HEAD rot (127 Dateien). Neue Dateien einzeln
  mit `prettier --write` formatiert, **nie** `pnpm format`.
- Unverändert: AGE-497 · AGE-541 · AGE-258 · AGE-522 · AGE-512 ·
  `finish-ui-polish` trägt AGE-291 und AGE-258 · `add-academy-content`
  unarchivierbar.
