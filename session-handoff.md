# Session Handoff — 2026-08-15 (AGE-534: Gruppe 5 zu, Bilder gesichert)

Branch `donald/age-534-c10-mitglieder-migration-aus-wordpress`, Commit `46dd499`.
Arbeitsbaum sauber. **Gruppe 5 vollständig**, Gruppe 6 bis auf 6.3/6.4.
36 von 51 Aufgaben zu. **1049 Tests grün** (Sitzungsbeginn 989).

Quelldatei (70 Datensätze, ausserhalb des Arbeitsbaums):
`/Users/donald/Documents/Claude/Projects/Fair Business Club/user-export-318-6a7da0ec0d721.csv`
Zwischenablage mit 110 Bildern liegt daneben: `…/wp-import-bilder/`.

## Next session: start here

**Aufgabe 6.3** — verkleinern, nach WebP, in den jeweiligen Bucket. `sharp@0.35.3`
liegt seit Gruppe 1 unbenutzt bereit, die Bilder liegen alle auf der Platte, es
braucht kein Netz mehr.

**Vorher von Donald bestätigen lassen** (steht als Vorschlag in 6.3): Obergrenze
Avatar **512 px**, Header **1600 px**. Und: das eine 1×1-px-Profilbild gehört in
den Bericht statt in den Bucket. Gemessen wurde an den 110 Dateien — Profilbilder
1 px bis 1000 px, Headerbilder 762 px bis 4032 px, also **nur verkleinern, nie
vergrössern**.

Danach 6.4 zu Ende (die Bildbefunde in den Bericht) und Gruppe 7.

## Accomplished

**Gruppe 5 komplett.** `wp_import.ts` trägt den ganzen Weg: `leseDatensaetze`
(RFC 4180, BOM), `verarbeite`, `baueBestandsdaten`/`bestandsleser` (eine Abfrage,
danach nur Nachschlagen), `baueLauf` und `main()` mit den wirkenden Adaptern.

**5.3 gegen die echte Quelle:** 70 Datensätze, **70× angelegt, null Befunde** —
keine Dublette, keine unbrauchbare Adresse, keine Kollision. Acht Zählwerte
davor/danach gleich, Konsolenausgabe ohne ein einziges `@`, Bericht mit `0600`.

**6.1, 6.2, 6.5 und 6.0**: `wp_bilder.ts` + `wp_bilder_holen.ts`. **110 von 110
Bildern geholt, keins fehlt** (57 Profil-, 53 Headerbilder, 58 Konten, 17 MB).
Zweiter Lauf: 0 geholt, 110 vorhanden, 0,4 s. **Das Risiko mit der fremden Frist
ist damit erledigt** — die Bilder überleben das Abschalten der alten Seite.

Dazu geschlossen: 5.2a (Widerspruch bei Konten ohne Kennung) und 5.2b (der
Bericht nannte die anzulegenden nur als Zahl).

## Decisions

**Konto ohne Kennung (5.2a):** `impact` + `activated_at is null` ist ein Rest
eines abgebrochenen eigenen Laufs und wird ergänzt; alles andere bleibt
Kollision. Selbstregistrierung ist `basic`, ein freigeschaltetes Konto benutzt
jemand. Spec-Delta trägt Regel und Szenario.

**Beide Bilder werden geholt (Donald, 15.08.).** Profilbild →
`avatars`/`avatar_url`, Headerbild → `covers`/`cover_url`. Der Plan kannte nur
das Profilbild, obwohl 53 von 70 ein Headerbild haben.
`synced_gravatar_hashed_id` bleibt draussen — Drittanbieter.

**Der Dateiname aus der Quelle wird geprüft, nicht zurechtgestutzt.** Er geht in
eine URL UND einen Pfad; ein gestutzter Name fragte eine falsche URL an und
verschluckte den Befund.

**Der Bestand kommt synchron und vorher gefüllt herein**, die **Kennung schlägt
die Adresse**, `--schreiben` bricht ab, solange Gruppe 7 fehlt, und beim CSV gilt
**kein** `relax_quotes`, **kein** `relax_column_count`.

## Was beim Bauen auffiel

- **Neun Lücken in fünf Gegenproben** (39 + 18 + 5 + 12 Mutationen). Die
  teuerste: `baueBestandsdaten` reichte `socials`, `videos` und die Kontaktfelder
  durch, ohne dass ein Test hinsah — **genau das, was die Merge-Regel als „leeres
  Ziel" gelesen und überschrieben hätte.** Die zweite: die Bestandsadressen
  erreichten die Vorabprüfung ungeprüft (die Leitung aus 4.2).
- **Donalds Frage „was machen wir mit den Mediendateien?" fand mehr als jede
  Prüfung** — das fehlende zweite Bild im Plan.
- **Zahlen im Design waren geraten, wo sie messbar sind:** „das Original ist
  1000 px" stimmt für keine der beiden Bildarten. Ein Profilbild ist 1×1 Pixel.
- `count(*)` kommt aus `pg` als **Zeichenkette** (`probe-c10-bestandsabfrage.ts`).
- Skripte im Scratchpad können `pg` nicht auflösen; Proben gehören nach
  `scripts/`. Top-level `await` geht nur innerhalb des Projekts.

## Files modified

- **neu** `supabase/seed/wp_import.ts` + `.test.ts` (40 Tests)
- **neu** `supabase/seed/wp_bilder.ts` + `.test.ts` (17), `wp_bilder_holen.ts`
- **neu** `scripts/probe-c10-bestandsabfrage.ts`
- `supabase/seed/wp_import.lib.ts` + `.test.ts` — QUELLFELDER 26 → 28
- `supabase/seed/wp_bericht.ts` + `.test.ts` — „Was der Lauf anlegen würde"
- `openspec/.../spec.md`, `design.md`, `tasks.md`

## Open questions

- **Obergrenzen für 6.3** (Vorschlag Avatar 512 px, Header 1600 px) und was mit
  dem 1×1-px-Profilbild geschieht.
- **`paid_until` (3.5)** — hängt an Detlevs Zahlungsständen.
- **Was sollte in „Mitgliedschaft" (`infos_16`) stehen?** Bestätigen lassen.
- **`demo_seed.lib.ts` trägt die überholte Annahme** „dev and prod are the SAME
  Supabase project" — eigener Nachlauf.
- `pnpm format:check` war schon am HEAD rot (127 Dateien). Neue Dateien einzeln
  mit `prettier --write` formatiert, **nie** `pnpm format`.
- Unverändert: AGE-497 · AGE-541 · AGE-258 · AGE-522 · AGE-512 ·
  `finish-ui-polish` trägt AGE-291 und AGE-258 · `add-academy-content`
  unarchivierbar.
