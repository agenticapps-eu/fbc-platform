# Aufgaben — `composer-aktionen-zusammen` (AGE-674)

## A · RED

- [x] A1 · Zusage ergänzen: „Abbrechen" und „Posten" teilen sich eine Hülle,
      die **nicht** umbricht, und diese liegt in der Gruppe, die es tut.
- [x] A2 · **RED belegt:** `1 failed | 13 passed`, mit
      `expected 'ml-auto flex flex-wrap items-center j…' not to contain
      'flex-wrap'`. Also am fehlenden Zwischenelement gescheitert, nicht an
      einem kaputten Harness.
- [x] A3 · Die AGE-670-Zusage („lässt die Aktionsgruppe umbrechen") holt die
      Gruppe künftig über die **Medien-Zeile** statt über `parentElement` von
      „Abbrechen" — sonst misst sie nach der Änderung die neue Hülle. Sie war
      im RED-Lauf noch grün und ist es danach auch.

## B · GREEN

- [x] B1 · Die zwei `Button` in ein `<span className="inline-flex items-center
      gap-2">` fassen. Dieselbe Bauform, die die Medien-Zeile daneben schon
      trägt — nichts neu erfunden.
- [x] B2 · Beide Zusagen grün, 14/14 in der Composer-Datei.

## C · Abnahme

- [x] C1 · Exit-Codes einzeln gelesen: `test` 0 (**207 Dateien / 2296 Tests**) ·
      `tsc --noEmit` 0 · `lint` 0 (7 Warnungen, Bestand) · `build` 0 ·
      `prettier --check` auf beiden berührten Dateien sauber.
- [x] C2 · **Am echten Composer nachgemessen**, angemeldet auf DEV, 375 × 812:

      | | vorher | nachher |
      | --- | --- | --- |
      | `top` „Abbrechen" / „Posten" | 388 / 432 | **871 / 871** (gleiche Zeile) |
      | Hülle | — | `inline-flex items-center gap-2`, **178 px** |
      | Gruppe | `flex-wrap`, 80 px | `flex-wrap` **bleibt**, 78 px |
      | Karte / Innenmaß | 343 / 293 px | 343 / 293 px |
      | Überlauf | 0 | **0** |

      Rückfallprobe mitgelaufen: Verwerfen schliesst weiterhin, der Composer
      beginnt leer, und nichts landet im Feed.
- [x] C3 · `openspec validate --all` grün, 31/31.

## D · Abschluss

- [x] D1 · Diff gegen das Delta zurückgelesen. Kein Fremdreviewer (reines UI).
      Die eine Stelle, an der er hätte danebengehen können, ist einzeln
      geprüft: die Gruppe trägt `flex-wrap` weiterhin — der Umbruch aus
      AGE-670 ist nicht verlorengegangen.
- [ ] D2 · Archivieren, `pnpm release:entries`, **einzeln** prettier auf
      `release-entries.generated.ts`.
- [ ] D3 · Commit, PR, Merge bei grünem CI; AGE-674 auf Done nachsehen.
