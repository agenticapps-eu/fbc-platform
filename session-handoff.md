# Session Handoff — 2026-09-02 (AGE-598: fertig, ausgerollt, archiviert)

> ## ⚠ ZUERST — drei Dinge
>
> **1. Diese Datei ist geteilt und trägt jeweils EINEN Vorgang.** Sie steht auf
> AGE-598. Die AGE-642-Fassung ist nicht verloren — sie liegt in der Historie
> (`git log --oneline -- session-handoff.md`). **Nicht zusammenführen.**
>
> **2. AGE-642 läuft PARALLEL** (Worktree `fbc-platform.donald-age-642-capacitor-huelle`).
> **Nicht anfassen.** Der lokale Supabase-Stack ist geteilt.
>
> **3. AGE-598 ist ABGESCHLOSSEN.** Gebaut, gemerged, auf PROD ausgerollt,
> archiviert, Linear auf Done. Es ist nichts mehr zu tun — ausser den
> Entscheidungen unten, und die gehören Donald.

## Accomplished

Zwei PRs, beide gemerged. Gruppen 4 bis 10 der Aufgabenliste.

| PR | Was |
|---|---|
| **#320** | Gruppen 4–8: Filter ausblenden, Staffelung, Welpenschutz raus, Kontaktfläche, Abnahme |
| **#323** | Gruppe 10: archiviert, Delta-Specs gefaltet, Neuigkeiten-Eintrag |

**Auf PROD:** `migrate-prod` (Lauf 33681817122) `plan` + `apply` grün; der vom
`drift-gate` angehaltene Deploy per `gh run rerun --failed` nachgeholt, danach
`drift-gate`/`deploy`/`functions` grün.

**Endstand:** `pnpm test` **2473/2473** · `supabase test db` über 27 CI-Dateien
**1160/1160** · `lint`, `typecheck`, `build` Exit 0 · `openspec validate --all`
31/0 · Linear AGE-598 **Done**.

### Was jetzt live ist

- **Verzeichnis ab `connect`**, erweiterte Felder ab `discover`.
- **Filter** für Kompetenz, Thema, Angebotsart und die Chip-Gruppen erscheinen
  unterhalb Rang 3 nicht; an ihrer Stelle steht die Stufe. Branche und Region
  bleiben.
- **Kontaktanfragen gestaffelt** (`darf_kontaktanfrage_senden`): `basic` nie ·
  `connect` nur an genau `connect` · ab `discover` an alle. **Wirkungslos,
  solange `open_contact` auf `true` steht.**
- **Welpenschutz ersatzlos weg**, `is_new_member(uuid)` gedroppt.

## Decisions

- **Der Neuigkeiten-Eintrag nennt NUR die Verzeichnisschwelle.** Staffelung und
  Welpenschutz sind draussen: `open_contact` hebt die Staffelung auf, am Tag des
  Ausrollens merkt niemand etwas. Der Hinweis gehört an den Tag, an dem der
  Schalter fällt — dann als eigener Eintrag.
- **Titel und `## What Changes` vor dem Archivieren in Mitglieder-Sprache
  umgeschrieben.** Gemessen hätte der Eintrag sonst 12 Punkte getragen, davon
  **vier Ausschlüsse als das Ausgelieferte** (die AGE-628-Falle: der Parser
  schneidet bei `/^#{1,2} /`, „Was NICHT Teil…" stand unter `###`).
- **Szenario-Titel beim Archivieren zurückgenommen, Rümpfe geschärft.** Drei
  `MODIFIED`-Blöcke hatten Titel von `discover` auf `connect` umbenannt;
  `openspec archive` kann das nicht von einer Löschung unterscheiden. Rümpfe
  stehen jetzt auf `basic` — wahr unter alter wie neuer Schwelle.
- **10.5 NICHT abgehakt.** Der Abnahmepunkt in AGE-610 deckt zwei Vorgänge, und
  für AGE-598 lautet er dort „`open_contact` abschalten?".
- **Auf PROD nichts eingefügt.** An `contact_requests` hängt ein
  `net.http_post`-Trigger; eine Mail an ein echtes Mitglied wäre nicht
  zurückzurollen. Der Verhaltensbeleg steht lokal, der Strukturbeleg auf PROD.

## Files modified

Alles auf `main`. Neu: zwei Migrationen (`20260902180000_kontaktanfrage_staffelung.sql`,
`20260902190000_welpenschutz_entfernen.sql`), `supabase/tests/kontaktanfrage_staffelung_test.sql`
(32 Zusagen, in `ci.yml` eingetragen), `MemberDirectory.stufen.test.tsx`,
`PublicProfilePage.staffelung.test.tsx`. Geändert: `MemberDirectory.tsx`,
`PublicProfilePage.tsx`, `lib/contact-requests.ts`, `rls_test.sql` (437 → 435),
`.github/workflows/ci.yml`. Archiv:
`openspec/changes/archive/2026-09-02-rechte-matrix-stufen/`.

## Next session: start here

**Für AGE-598 gibt es keinen nächsten Handgriff.** Der Worktree kann weg
(`wt remove`) — er ist nur noch die Hülle eines archivierten Change.

Wer hier weitermacht, nimmt einen neuen Vorgang: **High: 610.** **Medium:** 618 ·
542 · 512 · 605 · 607 · 630 · 669 · 680 · 684 · 688. **Low:** 664 · 660 · 606.

### Was im Worktree liegt und nicht eingecheckt ist

`.gstack/` (gitignoriert) trägt die Messwerkzeuge dieser Sitzung:
`prod-sonde.mts` / `prod-sonde2.mts` (Katalog auf PROD lesen, rein lesend),
`prod-flag.mts`, `probe-eintrag.mts` (Vorschau des Neuigkeiten-Eintrags **vor**
dem Archivieren — das Werkzeug, das die 12-Punkte-Falle gefunden hat), die
Reviewer-Logs und die Sichtprobe als PNG. Aufrufbar über die `run-*.sh` daneben.

**Der lokale Stack ist zurückgebaut:** 0 Profile, 0 Kontaktanfragen,
`open_contact` auf `true`. Steht dort etwas, ist es fremd.

## Open questions

Die ersten drei gehören Donald, und alle drei sind mit dem Ausrollen **Tatsache
geworden**, nicht erst geplant:

- **`open_contact` auf `false`.** Erst dann wirkt die Staffelung überhaupt.
  Gemessen folgenlos: alle 74 Konten liegen auf Rang 3 oder darüber. Dies ist
  auch der Punkt, an dem AGE-610 hängt.
- **Die Rechte-Erweiterung für Rang 3.** Ein `discover`-Konto darf im
  geschlossenen Modus jetzt an jeden senden; vorher durfte es das nicht. Folgt
  aus der Entscheidung vom 25.08., die *Richtung* stand dort nicht dabei.
  Live nachgemessen: `discover` → `impact` ergibt `true`.
- **`branche` ist für jedes aktivierte Konto lesbar**, auch für `basic`.
  `profiles_public` umgeht die RLS und trägt keine Stufenschwelle. Ohne das
  liefe der Branchenfilter für `connect` leer. Von opencode im Diff-Review
  benannt.
- **`EmojiAuswahl.test.tsx` flakt im Gesamtlauf** — einmal rot, allein und im
  Wiederholungslauf grün. Gehört zu AGE-645.
- **Der Neuigkeiten-Eintrag `2026-09-02-feedback-ausbauen`** ist weiterhin nicht
  freigegeben; der neue `2026-09-02-rechte-matrix-stufen` steht daneben.
