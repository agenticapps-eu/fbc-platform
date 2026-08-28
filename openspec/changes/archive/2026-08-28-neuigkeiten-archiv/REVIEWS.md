---
reviewers: [gemini, codex]
models: [gemini-cli-default, gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 373c59c33f3395cba471daa550b9a794a1cf9f73463fb8a6b62660a0e2637278
---

# Change review — neuigkeiten-archiv (AGE-636)

Geprüft wurde der Stand *vor* dieser Runde: proposal, design, tasks und die
Spec-Delta, zusammengefügt zu einer Datei mit dem oben genannten SHA. Beide
Reviewer liefen über `~/.agenticapps/bin/reviewer-cli.sh`, keiner ist mein
eigener Vendor.

## Reviewer: gemini (Modell nicht ausgewiesen — die CLI meldet keins, und die
Konfiguration setzt keins; als eigene Vendor-Stimme gezählt, aber die
Modellangabe fehlt)

VERDICT: REQUEST-CHANGES

- **[HIGH]** design.md / „Bekannte Grenze" — die Seitengrenze von 20 ist kein
  vorbestehender, unabhängiger Fehler mehr. Das Archiv sagt Vollständigkeit zu;
  eine geseitete Grundlage bricht sie. → *Fix in diesen Change ziehen,
  ungeseitete Abfrage.*
- **[MEDIUM]** Datenbank — wird ein markierter Eintrag später doch zugestellt,
  bleibt eine verwaiste Zeile in `release_entry_skips` stehen. →
  *`send_release_note` sollte sie in derselben Transaktion löschen.*
- **[LOW]** Datenbank — `skipped_by` wird nirgends angezeigt; ohne Nutzen ist es
  unnötige Komplexität samt Fremdschlüssel. → *Spalte streichen.*
- **[LOW]** Fläche — der Plan sagt nichts darüber, was bei einem Fehlschlag der
  Schreiboperation passiert. → *Fehlerbehandlung ausdrücklich verlangen.*

Ungenannte Annahmen, die gemini benennt: dass die Zahl der Einträge klein genug
für eine Rechnung im Client bleibt; dass beim Zurückholen die Historie „wer und
wann" verloren gehen darf; dass Slugs eindeutig und unveränderlich sind.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES

- **[HIGH]** design.md, Spec-Delta — dieselbe Seitengrenze, schärfer gefasst:
  ab Note 21 werden zugestellte Einträge wieder offen und **ein zweites Mal
  angekündigt**. Das ist ein Bruch der neuen Anforderung, keine fremde Baustelle.
- **[HIGH]** tasks.md §4 / `entwurfId` — **speichern → markieren → zustellen**
  verschickt die gespeicherte Zeile samt des gerade aussortierten Slugs.
  `stelleZu(entwurfId)` liest die Note, nicht den Bildschirm. Der geplante Test
  deckt nur „markieren *vor* dem Entwurf" ab.
- **[MEDIUM]** tasks.md §4 — `release_entry_skips` ist eine dritte Quelle;
  ein Ausfall, der als `[]` durchgeht, stellt gerade die abgeräumten Einträge
  wieder zur Wahl. Die Fläche muss fail-closed bleiben, wie schon heute für
  Entwürfe und Zugestelltes.
- **[MEDIUM]** tasks.md §1 — ohne `default` und ohne `skipped_by = auth.uid()`
  in der Policy kann ein Admin `null` oder eine fremde `uuid` schreiben. Die
  Zusage „ein Admin, ein Zeitpunkt" hält das Schema nicht.
- **[MEDIUM]** design.md §5 — ein Slug darf in mehreren zugestellten Notes
  stehen; welche das Archiv nennt, ist offen. `find()` machte es von der
  Reihenfolge abhängig.
- **[MEDIUM]** tasks.md §4 — das Szenario verlangt Datum und Mitteilung, die
  Aufgabenliste prüft beides nicht; eine Umsetzung könnte alle Aufgaben
  erfüllen und das Szenario verletzen.
- **[LOW]** design.md §6 — „`insert … on conflict do nothing`, kein `upsert`"
  ist **kein ausführbarer supabase-js-Aufruf**. Der Weg dorthin ist
  `.upsert(…, { ignoreDuplicates: true })`.
- **[LOW]** tasks.md §1 — die pgTAP-Aufgabe deckt Lesen und Anlegen ab, das
  Szenario verlangt auch **Löschen**.

## Nicht gezählt

- **opencode** — Exit 4, Zeitüberschreitung nach 300 s. Der Arm war erreichbar
  und hat begonnen (Modell `hf:moonshotai/Kimi-K3`, sichtbar im Mitschnitt), ist
  aber in seinem eigenen Explore-Agent hängengeblieben, ohne je ein Urteil
  auszugeben. Nicht „unavailable" — langsam. Zwei Vendoren stehen ohne ihn.

## Resolution

**Übernommen:**

| Befund | Was sich geändert hat |
| --- | --- |
| Seitengrenze (beide, HIGH) | design.md §12 kehrt die Entscheidung um: neue, **ungeseitete** `fetchAngekuendigt()` ohne `body`, die Rechnung *und* die Karte „Bereits zugestellt" speist. Spec-Delta trägt die Klausel „SHALL alle zugestellten Notes umfassen". |
| speichern → markieren → zustellen (codex, HIGH) | design.md §10: **Abgleich gegen den gespeicherten Stand** statt vier verstreuter `setEntwurfId(null)`. Neue Spec-Klausel und eigenes Szenario; Regressionstest in tasks.md §4. |
| fail-closed (codex, MEDIUM) | design.md §9, Spec-Klausel, Szenario „Fällt die Markierungsliste aus, bleibt die Fläche zu", Test in §4. |
| `skipped_by` fälschbar (codex, MEDIUM) | design.md §7: `default auth.uid()` **und** `skipped_by = auth.uid()` in der Insert-Policy; pgTAP-Zusage in §1. |
| Mehrfachzustellung unbestimmt (codex, MEDIUM) | design.md §8: die **früheste** Zustellung, nach `sent_at`. Spec-Klausel, Szenario, Test mit umgedrehter Eingabereihenfolge. |
| Datum/Titel im Archiv ungeprüft (codex, MEDIUM) | tasks.md §4 verlangt jetzt Zusagen auf Note-Titel, `sent_at` und die **Abwesenheit** des Rückhol-Knopfs. |
| `on conflict do nothing` (codex, LOW) | design.md §6 nennt den echten Aufruf und trennt Methodenname von erzeugter SQL. |
| Löschversuch ungeprüft (codex, LOW) | tasks.md §1: Nicht-Admin-`delete`, **am Bestand** gemessen. |
| Fehlerbehandlung (gemini, LOW) | design.md §11: kein optimistisches Umschalten, `onError`-Toast; Test in §4. |

**Nicht übernommen, mit Grund:**

- **`send_release_note` soll markierte Slugs mitlöschen (gemini, MEDIUM).**
  Abgelehnt. Die Zeile ist keine Karteileiche, sondern eine wahre Aussage:
  *jemand hat das damals aussortiert*. Sichtbar wird sie nie, weil „zugestellt"
  laut Spec und Test vorgeht. Der Preis wäre ein Schreibzugriff **in der
  Zustellfunktion** — dem einen Pfad dieser Anwendung, der mit der
  Mitgliederzahl multipliziert und dessen bedingter Zustandswechsel der ganze
  Riegel gegen die Doppelzustellung ist. Eine kosmetische Aufräumung rechtfertigt
  keine Änderung dort.
- **`skipped_by` streichen (gemini, LOW).** Abgelehnt. `release_notes.created_by`
  setzt im selben Modul den Präzedenzfall, und die Frage „wer hat das
  entschieden?" ist bei einer **geteilten** Markierung genau die, die zwischen
  zwei Admins aufkommt. Nachträglich kostete die Spalte eine Migration; jetzt
  kostet sie eine Zeile. Sie wird bewusst nicht angezeigt — Anzeige verlangte
  einen Join auf `profiles` für eine Frage, die selten gestellt wird.
- **Annahme „Slugs sind unveränderlich" (gemini, und codex auf dem Diff erneut).**
  Zutreffend und beabsichtigt:
  der Verzeichnisname im Archiv ist laut AGE-631 der einzige verlässliche
  Schlüssel. Wird ein archiviertes Verzeichnis je umbenannt, verliert die
  Markierung ihren Bezug — genau wie `release_notes.entry_slugs` es heute schon
  täte. Kein neuer Bruch, keine Gegenmassnahme in diesem Change.

---

# Code-Review auf dem DIFF (Schritt 4)

Andere Runde, anderer Gegenstand: hier lasen die Reviewer den fertigen Diff
(`git diff --cached`, 1311 Zeilen), nicht den Plan. Beide Urteile:
**REQUEST-CHANGES**, und diese Runde hat mehr gefunden als die erste.

## Reviewer: gemini

VERDICT: REQUEST-CHANGES

- **[MEDIUM]** `AdminNeuigkeitenPage.tsx` — `markieren.onSuccess` liest `auswahl`
  aus einem veralteten Abschluss. Zwei schnelle Klicks: der zweite setzt den
  Stand von vor beiden, der erste Eintrag ist wieder ausgewählt.

## Reviewer: opencode (`hf:moonshotai/Kimi-K3`)

VERDICT: REQUEST-CHANGES

- **[HIGH]** derselbe veraltete Abschluss, mit einem zweiten Weg dorthin: ein
  Häkchen, das während der laufenden Mutation entfernt wird, kommt zurück.
- **[MEDIUM]** Die Archiv-Karte umgeht das Fail-closed-Tor. „Archiv (1)" oder
  „Noch nichts archiviert." stünde als Tatsachenbehauptung da, während die
  Grundlage fehlt — dieselbe Lüge wie in der Liste, nur eine Karte tiefer.
- **[MEDIUM]** `fetchAngekuendigt` schreibt eine Zeile **ohne `body`** unter den
  Schlüssel `["release-notes","sent"]` — denselben, den `/neues` liest und aus
  dem es `n.body` rendert.
- **[MEDIUM]** „Entwurf machen → markieren → erneut speichern → zustellen":
  `unveraendert` bewacht die Slug-Liste, nicht den Fliesstext. Der Text nennt
  die aussortierte Änderung weiter.
- **[LOW]** doppeltes Leerzeichen, wenn `sent_at` null ist.
- **[LOW]** `frueher(null, null)` lässt die Eingabereihenfolge entscheiden.
- **[LOW]** kein Format-CHECK auf `slug`.
- **Was die Tests nicht fangen:** ob PostgREST für
  `resolution=ignore-duplicates` ein UPDATE-Recht verlangt, das diese Tabelle
  bewusst nicht hat.

## Reviewer: codex (gpt-5.6-sol) — zweiter Anlauf

Der erste Anlauf lieferte **kein Urteil**: der Arm durchsuchte stattdessen das
Repository und gab am Ende `REVIEWS.md` aus. Erst ein Prompt mit „lies keine
Dateien, urteile nur über den Diff" brachte eine Antwort.

VERDICT: REQUEST-CHANGES

- **[HIGH]** derselbe Schlüsselkonflikt wie bei opencode, unabhängig gefunden.
- **[HIGH]** `speichern.onSuccess` merkt sich den Bildschirm zum
  ANTWORTZEITPUNKT, nicht den abgeschickten Stand. Wer während des Speicherns
  weitertippt, bekommt seinen neuen Stand als „gespeichert" quittiert.
- **[HIGH]** `send_release_note` prüft `entry_slugs` nicht gegen die
  Markierungen.
- **[MEDIUM]** `auswahl` nicht mit `offen` geschnitten (derselbe Wettlauf).

## Resolution

Der Wettlauf (gemini HIGH/MEDIUM, opencode HIGH, codex MEDIUM) **war beim
Eintreffen der Reviews bereits behoben** — gefunden im eigenen Durchgang, und
zwar nicht mit einem funktionalen `setState`, wie alle drei vorschlugen, sondern
durch Wegfall des Mechanismus: `auswahl` ist auf `offen` geschnitten, und
`markieren.onSuccess` räumt gar nichts mehr auf. Gemessen im Browser: zwei
Klicks unmittelbar hintereinander, 30 → 28 offene, Archiv 1 → 3.

| Befund | Was sich geändert hat |
| --- | --- |
| Schlüsselkonflikt (opencode + codex, HIGH) | Eigener Schlüssel `alle-zugestellten`; `sent` bleibt `/neues`. Beide werden nach dem Zustellen einzeln entwertet. Der Grund steht bei `releaseNotesQueryKey`. |
| Speichern-Schnappschuss (codex, HIGH) | Der Stand geht als **Variable der Mutation** hinein und kommt in `onSuccess` von dort zurück. Test mit aufgehaltener Zusage. |
| Archiv umgeht das Tor (opencode, MEDIUM) | `unvollstaendig` an EINER Stelle gerechnet, von beiden Karten gelesen; ohne Grundlage nennt das Archiv keine Zahl. Eigener Test. |
| Veralteter Entwurfstext (opencode, MEDIUM) | `textVeraltet` sperrt das Zustellen und benennt den Grund. **Kein** automatisches Neuerzeugen — das überschriebe die Redaktion, und die ist der Kern von AGE-631. Eigener Test. |
| Doppeltes Leerzeichen (opencode, LOW) | Datum nur noch, wenn vorhanden. |

**Gemessen statt behauptet:** der Konflikt-Pfad des `upsert` durch PostgREST,
mit echtem Admin-JWT gegen den lokalen Stack — dreimal derselbe Slug, dreimal
`201`, danach **genau eine** Zeile. `resolution=ignore-duplicates` verlangt auf
dieser Tabelle **kein** UPDATE-Recht. Die Sorge ist damit ausgeräumt, und zwar
an der Stelle, an der weder vitest noch pgTAP hinsehen.

**Nicht übernommen, mit Grund:**

- **`send_release_note` soll Entwürfe mit markierten Slugs abweisen (codex,
  HIGH).** Abgelehnt. Die Spec sagt ausdrücklich „zugestellt schlägt nicht
  relevant" — eine Zustellung ist die stärkere Handlung, und ein Admin, der
  bewusst zustellt, überstimmt eine Notiz eines anderen. Ein harter Riegel in
  der Zustellfunktion machte aus einer redaktionellen Vormerkung ein
  Veto, das niemand aufheben kann, ohne die Markierung zu suchen. Der Diff
  gehört ausserdem in genau den Pfad, dessen bedingter Zustandswechsel der
  Riegel gegen die Doppelzustellung ist.
- **Format-CHECK auf `slug` (opencode, LOW).** Abgelehnt. Ein Junk-Slug ist
  inert: er trifft keinen Eintrag und ist unsichtbar. Ein Regex koppelte das
  Schema an die heutige Namenskonvention von
  `scripts/generate-release-entries.ts` und bräche an dem Tag, an dem sie sich
  ändert.
- **`frueher(null, null)` (opencode, LOW).** Abgelehnt. Eine Note mit
  `status='sent'` und leerem `sent_at` kann nicht entstehen —
  `send_release_note` setzt beides im selben `update`. Der Null-Zweig steht
  nur da, damit die Ordnung nicht davon abhängt, dass das so bleibt; zwischen
  zwei unmöglichen Zeilen ist Reihenfolge-Abhängigkeit kein Mangel, der eine
  zusätzliche Vergleichsspalte rechtfertigt.

## Was NICHT belegt ist

Der Schlüsselkonflikt ist **auf die Begründung der beiden Reviewer hin behoben,
nicht reproduziert.** Der Versuch, ihn im Browser zu stellen, hat nichts
gezeigt — und der Grund ist der Versuchsaufbau: der eingefügte `<a href="/neues">`
löst einen echten Seitenwechsel aus und damit einen frischen Cache, also genau
nicht die Bedingung, die der Befund braucht. Was ihn festnageln würde, ist ein
Test, der BEIDE Seiten unter EINEM `QueryClient` montiert. Den gibt es nicht;
er ist der Folgevorgang.
