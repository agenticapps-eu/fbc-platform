# Aufgaben — `composer-abbruch` (AGE-670)

Alle Zeilennummern gegen `eab8368` gemessen, dem Stand, auf dem dieser Branch
abzweigt.

## A · RED

- [x] A1 · In `src/components/community/CommunityFeed.composer.test.tsx` drei
      Zusagen ergänzen, jede aus einem Szenario des Deltas — (a) Verwerfen
      klappt den Composer zu und legt **keinen** Beitrag an, (b) erneutes
      Aufklappen zeigt einen leeren Entwurf (Text, Zeitpunkt, Themen,
      Sichtbarkeit), (c) Verwerfen gibt die Objekt-URL jeder Bildvorschau frei.
- [x] A2 · Für (c) `URL.revokeObjectURL` im `beforeEach` als `vi.fn()`
      stubben statt als leerer Rumpf — vorher war es `() => {}` und damit nicht
      beobachtbar. Als No-op verhält sich die Attrappe genau wie zuvor.
- [x] A3 · **RED belegt:** `3 failed | 9 passed`, alle drei mit derselben
      Meldung — `Unable to find an accessible element with the role "button"
      and name /abbrechen/i`. Also am fehlenden Knopf gescheitert, nicht an
      einem kaputten Harness.

      Zwei Fehler im ersten Wurf, beide vom Lauf aufgedeckt und nicht von mir:

      - Die Tag-Chips kommen **asynchron** und stehen seit Block 8 auch in der
        Filterleiste. Ein unqualifiziertes `getByRole` fand deshalb nichts
        bzw. hätte den falschen Knopf gefunden — jetzt über
        `findByRole("group", …)` und `within`.
      - `expect(rpcAufrufe).toEqual([])` war zu grob: die zwei Sidebar-Zähler
        (`feed_tag_counts`, `feed_top_authors`) laufen ebenfalls über `rpc`.
        Gemessen wird jetzt nur `create_post_with_media`.

## B · GREEN

- [x] B1 · Den Zurücksetz-Block aus dem `onSuccess` herausgezogen in eine
      Funktion `zuruecksetzen()` im Rumpf von `PostComposer`.
      **`URL.revokeObjectURL` am „×" der Bildkachel ist geblieben, wo es war** —
      nachgeprüft: die Datei trägt weiterhin zwei Vorkommen (769 im Rücksetzer,
      881 an der Kachel).
- [x] B2 · `onSuccess` ruft `zuruecksetzen()`; Toast und die drei
      `invalidateQueries` stehen unverändert dort.
- [x] B3 · „Abbrechen" in der Aktionszeile neben „Posten", `variant="ghost"`,
      `size="sm"`, gesperrt solange `create.isPending`.
- [x] B4 · Alle Zusagen aus A grün.

## C · Abnahme

- [x] C1 · Echte Exit-Codes, nicht hinter einer Pipe gelesen:
      `test` 0 (**207 Dateien / 2295 Tests**) · `tsc --noEmit` 0 ·
      `lint` 0 (7 Warnungen, Bestand) · `build` 0.
- [x] C2 · **Im Browser gemessen** (Chrome, 375 × 812, gegen den laufenden
      Dev-Server an der echten Feed-Karte) — und dabei einen **Fehler in B3
      gefunden**, den jsdom nicht sehen kann:

      | | Karte | Aktionsgruppe | `doc.scrollWidth` |
      | --- | --- | --- | --- |
      | Grundlinie | 341 px | — | 375 px ✓ |
      | Zeile ohne „Abbrechen" | 341 px | 245 px | 375 px ✓ |
      | Zeile mit „Abbrechen" | **401 px** | **353 px** | **419 px → 44 px Überlauf** ✗ |
      | mit `flex-wrap` | 341 px | 293 px | 375 px ✓ |

      Ursache: der `ml-auto`-Block trug `flex`, aber **kein** `flex-wrap` — er
      konnte nicht umbrechen und weitete stattdessen die Karte. Behoben mit
      `flex-wrap justify-end`; `justify-end` hält die schon dort stehende
      Begründung aufrecht, dass ein umgebrochenes Element rechts bleibt.
      Positivkontrolle mitgelaufen: eine erfundene Klasse liefert die
      Vorgabewerte, die Sonde misst also wirklich etwas.

      **Offen und ausdrücklich NICHT erledigt:** der angemeldete Blick auf den
      echten Composer. `/aktivitaet` rendert ihn nur für Mitglieder, und für
      DEV liegt kein Testzugang vor. Die Messung oben ist eine Sonde mit
      wörtlich übernommenen Klassen im echten Container mit echtem Stylesheet —
      sie belegt die Geometrie, nicht das Gesamtbild.
- [x] C3 · `openspec validate --all` grün, 31/31.

## D · Abschluss

- [x] D1 · Code-Review auf den **Diff** (Schritt 4). **Kein Fremdreviewer** —
      reines UI, Donalds stehende Regel vom 26.08.; Plan-Review 2b entfällt aus
      demselben Grund. Der Diff wurde gegen das Delta zurückgelesen; die zwei
      Stellen, an denen er hätte danebengehen können, sind einzeln nachgemessen:
      `revokeObjectURL` steht weiterhin an zwei Stellen (769 / 881), und der
      `onSuccess`-Rest (Toast, drei `invalidateQueries`) ist unverändert.
- [ ] D2 · `openspec archive composer-abbruch`, danach `pnpm release:entries`
      und **einzeln** `prettier --write src/content/release-entries.generated.ts`.
- [ ] D3 · Commit, PR, Merge bei grünem CI; AGE-670 in Linear auf Done
      nachsehen.
