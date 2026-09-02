# Session Handoff — 2026-09-02 (AGE-598: geplant und fremdreviewt, kein Code)

> ## ⚠ ZUERST — drei Dinge
>
> **1. Diese Datei ist geteilt und trägt jeweils EINEN Vorgang.** Sie steht
> jetzt auf AGE-598. Die AGE-642-Fassung ist nicht verloren
> (`git show origin/main:session-handoff.md`), und die AGE-628-Fassung liegt im
> Scratchpad. **Nicht zusammenführen.**
>
> **2. AGE-642 läuft PARALLEL in einer anderen Sitzung**
> (`fbc-platform-donald-age-642-capacitor-hu-57`, Worktree
> `fbc-platform.donald-age-642-capacitor-huelle`). Dort lief heute die
> D5-Gerätesitzung. **Nicht anfassen.**
>
> **3. Für AGE-598 ist noch KEINE Codezeile geschrieben** — und das ist der
> Stand, nicht ein Versäumnis. Der Plan ist durch zwei Fremdreviews gegangen
> und überarbeitet; die Umsetzung fängt bei Aufgabe 2.1 an.

## Accomplished

Vier Dinge, alle abgeschlossen ausser dem letzten.

| Was | Beleg |
|---|---|
| Zwei tote Worktrees geräumt | `donald/age-679-meldeweg-belegt` und `donald/age-682-archiv`; beide trugen gegen die Merge-Base **nichts**, was nicht auf `main` stand. ~1,5 GB frei |
| Zwei Docs gelandet | PR **#313** → `e3d371a`, AGE-689 automatisch auf *Done* |
| AGE-688 angelegt | das `sm`-Doppelmodal, mit gemessenem statt vermutetem Befund |
| AGE-598 geplant | Change `rechte-matrix-stufen`, Commit **`bf4ce70`**, `validate` 32/32 |

### Drei Behauptungen am Code widerlegt

- **Der Handoff vorher sagte, `donald/age-682-archiv` trage noch einen
  ungemergten Commit.** `git cherry` markiert ihn wegen der Squash-Merges als
  „nicht upstream" — der Inhalt lag längst auf `main`. Geprüft mit
  `git diff origin/main...<branch>` gegen die Merge-Base, plus Dateivergleich.
- **AGE-598 sagte, es entstünden keine Matches.** Falsch: AGE-450 entfernte die
  **Anzeige**. `recompute_my_matches` läuft weiter (compass.ts:289,
  profile.ts:431, matching-profile.ts:186), und `fetchContactRelation` reicht
  die `match_id` von selbst mit. Als Erinnerung
  `matching-engine-lebt-oberflaeche-ist-weg` festgehalten.
- **AGE-688 sagte, z-index und Fokus-Falle seien kaputt.** Beide sind in
  Ordnung — `useOverlay` führt einen Stapel, die Falle hängt an der Spitze.
  Kaputt ist allein die `aria-modal`-Semantik.

### Der Plan-Review hat vier Löcher gefunden

gemini und opencode, beide **REQUEST-CHANGES**. Alles eingearbeitet, Belege in
`REVIEWS.md`. Der teuerste:

**`search_doc` wäre ein Orakel geworden.** Es trägt `competencies` und
`interests`; die Volltextklausel bindet nur an `is_activated()`, nicht an die
Stufe. Mit der abgesenkten Listenschwelle hätte ein `connect`-Konto über das
Suchfeld erfragen können, was die Ausgabe ihm maskiert — dieselbe Klasse, die
AGE-291 für den Namen erkannt und geschlossen hat. Als Erinnerung
`volltextindex-ist-ein-orakel` festgehalten.

Dazu: `branche` fiel durch beide Raster; das Proposal widersprach dem Entwurf;
und das **Alter des Bestands ist nirgends gemessen** — `is_new_member` liest
`created_at`, und der Import legte alle 72 Profile in einem Lauf an.

## Decisions

- **Der Welpenschutz geht ersatzlos raus** (Donald, 02.09., Endstand).
  *Warum:* zuerst war ein zweiter Schalter `welpenschutz_aktiv` mit Vorgabe
  `false` entworfen. Dann kam die Messung — **alle 74 Profile sind jünger als
  30 Tage**, der Fluchtweg deckt rund 2 % der Paare. Eine Regel, die man wegen
  ihrer eigenen Wirkung nie einschalten kann, ist keine Regel. Donalds
  Begründung trägt weiter: „haben andere Plattformen auch nicht."
- **Was seine Aufgabe übernimmt, ist die Staffelung.** Ein `basic`-Konto darf
  gar nicht senden. Sie fragt, **wer sendet**, statt wer empfängt — und
  schliesst die Angriffsfläche an der Wurzel.
- **`is_new_member(uuid)` wird mitgedroppt.** *Warum:* gemessen genau **ein**
  lebender Aufrufer, und das war die entfallende Klausel. Ein Prädikat ohne
  Aufrufer wird später falsch wieder angeschlossen.
- **`profiles_public` bekommt KEINE Stufenschwelle.** *Warum:* 15 Leser, es ist
  das Namensauflösungs-Rückgrat. Eine Schwelle nähme einem `basic`-Konto nicht
  das Verzeichnis, sondern die Namen im Feed. Als Nicht-Zusage geschrieben.
- **`branche` wird Basisfeld und kommt in `profiles_public`.** *Warum:* sonst
  fiele die Spalte still auf NULL und der Filter liefe wortlos leer. Ist eine
  Erweiterung dessen, was die View preisgibt — bewusst, nicht nebenbei.
- **Filter für maskierte Spalten werden ausgeblendet, nicht leer gelassen.**
  *Warum:* ein sichtbarer Filter ist ein Versprechen; einer, der nie etwas
  findet, bricht es bei jeder Benutzung.
- **`connect` → genau `connect` bleibt.** *Warum:* Donald hat das am 25.08.
  ausdrücklich entschieden, samt der Folge. gemini schlug eine Lockerung vor —
  das wäre eine neue Produktentscheidung, keine Korrektur.
- **codex nicht als Reviewer eingeplant.** *Warum:* er liefert bei Prompts
  dieser Grösse kein Verdikt und delegiert an den eigenen Anbieter zurück.

## Files modified

- **`bf4ce70`** (dieser Worktree) — `openspec/changes/rechte-matrix-stufen/`,
  7 Dateien, 1.382 Zeilen: proposal · design · tasks · zwei Delta-Specs ·
  REVIEWS.md · .openspec.yaml
- **`bb0f7d8`** — der Welpenschutz raus, gemessen begründet
- **`e3d371a`** (`main`, via #313) — `docs/lastenheft.md`,
  `docs/technisches-handbuch.md`, unverändert eingecheckt
- Zwei neue Erinnerungen: `matching-engine-lebt-oberflaeche-ist-weg`,
  `volltextindex-ist-ein-orakel`. Eine korrigiert:
  `open-contact-flag-hebelt-zwei-gates` behauptete, Abschalten sperre alle aus —
  gemessen ist es folgenlos.
- **Memory-Index kompaktiert:** 182 → 134 Dateien, Index 184 → 139 Zeilen. Zehn
  Themendateien, jeder Satz wortgleich übernommen, alte Slugs im Kopf jeder
  Datei. Sicherung: `MEMORY.md.bak-2026-09-02`.

## Next session: start here

**Erster Handgriff: Aufgabe 2.1** aus
`openspec/changes/rechte-matrix-stufen/tasks.md` — die bestehenden
`rls_test.sql`-Zusagen zur Rang-3-Grenze auf dem lokalen Stack fahren und die
Zahl der bestandenen Zusagen **notieren**. Das ist die Grundlinie, gegen die
sich später beweisen lässt, dass die neue Rang-2-Schwelle die alte Rang-3-Grenze
nicht mitgenommen hat. Ohne sie sieht genau dieser Schaden wie ein Erfolg aus.

Danach 2.2/2.3 (Positivkontrollen), dann 3.x. **Gruppe 3b (das Volltext-Orakel)
gehört zwingend in denselben Change** — ohne sie ist die Maskierung Kulisse.

Der Worktree ist `donald/age-598-rechte-matrix-verzeichnis-ab-connect-sichtbar`,
Basis `3ddb1a0`, sauber ausser dieser Datei.

## Open questions

- **Ein Schalter wartet auf Donald,** nach dem Ausrollen: `open_contact` auf
  `false`, sonst bleibt die Staffelung wirkungslos. **Gemessen folgenlos** —
  alle 74 Konten liegen auf Rang 3 oder darüber, für die die Staffelung jeden
  Empfänger erlaubt. Richtiger Zeitpunkt ist **vor** dem Öffnen der
  Selbstregistrierung.
- **AGE-688** (`sm`-Doppelmodal) liegt unangefasst im Backlog.
- **Der Neuigkeiten-Eintrag `2026-09-02-feedback-ausbauen`** ist weiterhin nicht
  freigegeben — er liegt in `AdminNeuigkeitenPage` unter `offen`.
- Unverändert offen — **High:** 610. **Medium:** 618 · 542 · 512 · 605 · 607 ·
  630 · 669 · 680 · 684 · 688. **Low:** 664 · 660 · 606.
