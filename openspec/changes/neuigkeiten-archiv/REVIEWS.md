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
- **Annahme „Slugs sind unveränderlich" (gemini).** Zutreffend und beabsichtigt:
  der Verzeichnisname im Archiv ist laut AGE-631 der einzige verlässliche
  Schlüssel. Wird ein archiviertes Verzeichnis je umbenannt, verliert die
  Markierung ihren Bezug — genau wie `release_notes.entry_slugs` es heute schon
  täte. Kein neuer Bruch, keine Gegenmassnahme in diesem Change.
