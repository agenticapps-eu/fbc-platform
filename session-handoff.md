# Session Handoff — 2026-08-15 (AGE-534: Gruppe 5 bis auf die echte Quelle)

Branch `donald/age-534-c10-mitglieder-migration-aus-wordpress`, Commit `44aaffe`.
Arbeitsbaum sauber. **31 von 50 Aufgaben zu** (zwei kamen dazu: 5.2a, 5.2b).
Gruppe 5 steht bis auf 5.3, und 5.3 fehlt nur noch die echte Exportdatei.

## Next session: start here

**Zuerst Donald nach dem Pfad der echten Quelldatei fragen** — sie liegt
ausserhalb des Arbeitsbaums, steht in keiner Notiz, und weder `~/Downloads`,
`~/Desktop` noch `~/Sourcecode/factiv` führen eine CSV. Damit ist 5.3 in fünf
Minuten zu: `pnpm tsx supabase/seed/wp_import.ts <pfad> --ziel=lokal`, davor und
danach die fünf Zählwerte messen (Skript unten im Scratchpad-Absatz).

Danach **Gruppe 6** (Bildstrecke) — sie ist die einzige Gruppe mit einer Frist,
die nicht in unserer Hand liegt: die Bilder liegen nur auf der alten Seite, und
6.5 („einmal echt laufen lassen, bevor die Seite abgeschaltet wird") ist der
Punkt, an dem Warten teuer wird. Gruppe 7 kann danach.

## Accomplished

**5.1 — CSV lesen und die Pipeline zusammensetzen.** `leseDatensaetze` und
`verarbeite` in `wp_import.ts`. Streng gelesen: **kein** `relax_quotes`, **kein**
`relax_column_count`. Das BOM wird abgeschnitten statt geduldet.

**5.2 — ein Weg für beide Betriebsarten.** `baueLauf` trägt alles von der
gelesenen Datei bis zum fertigen Bericht, `main()` hängt nur Datenbank, Datei
und Konsole daran. `--schreiben` bricht ab, solange Gruppe 7 fehlt.

**5.2a — ein Widerspruch im Plan, von Donald entschieden.** Siehe unten.

**5.2b — der Bericht nennt jetzt WER, nicht nur wie viele.**

**5.3 zur Hälfte**: der ganze Weg lief gegen den lokalen Stack mit einer
künstlichen Quelle. `profiles` 2→2, `profile_contacts` 0→0, `profile_legacy`
0→0, `auth.users` 2→2, `storage.objects` 0→0. Konsole ohne Personendaten,
Bericht mit `0600` neben der Quelle.

**1032 Tests grün** (Sitzungsbeginn 989). `typecheck`, `typecheck:seed`, `lint`,
`openspec validate --all` 29/29.

## Decisions

**Der Bestand kommt SYNCHRON und VORHER gefüllt herein.** Ein asynchroner Leser
je Datensatz hiesse 70 Rundreisen und einen Bestand, der sich mitten im Lauf
ändern kann. Damit bleibt der ganze Weg rein — das ist der Grund, warum 5.2
überhaupt prüfbar ist.

**Die Kennung schlägt die Adresse.** Umgekehrt entschiede die Adresse über ein
Profil, das seine Kennung schon trägt, und die Merge-Regel läse den falschen
`bereitsImportiert`-Stand.

**Der Widerspruch aus 5.2a (Donald, 15.08.).** Ein Konto ohne Kennung, dessen
Adresse ein Quelldatensatz trägt, sollte laut 4.2 den Schreiblauf *blockieren*
und laut der Wiedererkennungs-Anforderung *ergänzt* werden — in der Datenbank
sehen beide Fälle gleich aus. Unterschieden wird jetzt an der **Handschrift des
Imports**: `impact` + `activated_at is null` ist ein eigener Rest und wird
ergänzt, alles andere bleibt Kollision. Spec-Delta trägt Regel und Szenario.
Restrisiko benannt: ein von Hand angelegtes, noch nicht freigeschaltetes
`impact`-Konto würde ergänzt — es trägt aber ohnehin die höchste Stufe.

## Was beim Bauen auffiel

- **Die Gegenproben fanden acht Lücken in drei Läufen** (39 + 18 + 5 Mutationen).
  Die teuerste: `baueBestandsdaten` reichte `socials`, `videos` und die
  Kontaktfelder durch, ohne dass ein Test hinsah — **genau das, was die
  Merge-Regel als „leeres Ziel" gelesen und überschrieben hätte.**
- **Die zweitteuerste war Verdrahtung**: die Bestandsadressen erreichten die
  Vorabprüfung ungeprüft. Jede Einzelfunktion war getestet, die Leitung dazwischen
  nicht — und es ist die aus 4.2, ohne die eine Kollision unbemerkt bliebe.
- **`count(*)` kommt aus `pg` als Zeichenkette.** Ungewandelt wäre `"0"` wahr und
  die Merge-Regel hielte jedes Profil für belegt. Gemessen, nicht vermutet:
  `scripts/probe-c10-bestandsabfrage.ts` läuft gegen den lokalen Stack, weil die
  SQL-Zeichenkette die einzige Stelle in Gruppe 5 ist, die kein Test erreicht.
- **Ein Skript im Scratchpad kann `pg` nicht auflösen** (kein `node_modules` in
  der Nähe). Proben gehören nach `scripts/`, so wie die anderen `probe-c10-*`.
- Top-level `await` geht nur innerhalb des Projekts — ausserhalb übersetzt `tsx`
  nach CJS und bricht ab.

## Files modified

- **neu** `supabase/seed/wp_import.ts` + `.test.ts` — Lesen, Lauf, Bestand, `main`
- **neu** `scripts/probe-c10-bestandsabfrage.ts` — die SQL gegen echte Schemata
- `supabase/seed/wp_bericht.ts` + `.test.ts` — Abschnitt „Was der Lauf anlegen würde"
- `openspec/.../specs/member-import/spec.md` — Regel + Szenario zu 5.2a
- `openspec/.../tasks.md` — 5.1, 5.2, 5.2a, 5.2b zu; 5.3 zur Hälfte

Scratchpad (`…/44f12453-…/scratchpad/`): `mutanten-g5.sh`, `mutanten-g52.sh`,
`kunst-quelle.csv` (künstlich, keine echten Daten), `sonde-abfrage.ts`.

## Open questions

- **Wo liegt die echte Exportdatei?** Einziger Blocker für 5.3.
- **`paid_until` (3.5)** bleibt offen — hängt an Detlevs Zahlungsständen.
- **Was sollte in „Mitgliedschaft" (`infos_16`) stehen?** Bestätigen lassen.
- **`demo_seed.lib.ts` trägt die überholte Annahme** „dev and prod are the SAME
  Supabase project" — eigener Nachlauf.
- `pnpm format:check` war schon am HEAD rot (127 Dateien) — eigener Vorgang.
  Neue Dateien wurden einzeln mit `prettier --write` formatiert, nie `pnpm format`.
- Unverändert: AGE-497 · AGE-541 · AGE-258 · AGE-522 · AGE-512 ·
  `finish-ui-polish` trägt AGE-291 und AGE-258 · `add-academy-content`
  unarchivierbar.
