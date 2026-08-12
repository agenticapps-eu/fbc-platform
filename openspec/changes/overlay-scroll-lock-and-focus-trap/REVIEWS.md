---
reviewers: [gemini, codex]
models: [gemini-3-pro, gpt-5.2-codex]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 9f704a3df35a2928d84ba1b4e581b8f4ca8f4f03732ee898f24ef67558ddad6b
---

# Change review — overlay-scroll-lock-and-focus-trap

Zwei Vendoren, keiner davon der eigene. Der SHA oben deckt die **erste**
Fassung; was jetzt im Verzeichnis liegt, ist das Ergebnis dieses Reviews.

> **Ohne Gate-Trailer**, aus demselben Grund wie beim Schwesterchange: der
> Trailer bindet den Review per Digest an genau die Artefakte, die der Reviewer
> gesehen hat, und die wurden danach überarbeitet — weil er Befunde hatte. Ein
> von Hand gesetzter Trailer behauptete eine Bindung, die es nie gab. Der Gate
> zählt diese Datei daher mit null Reviewern; das ist nicht blockierend und
> gilt für alle Changes im Repo.

## Reviewer: gemini (gemini-3-pro)

VERDICT: REQUEST-CHANGES

[HIGH] Design/Delta — `position: fixed` nehme dem Dokument den Scrollbalken;
die Seite springe beim Öffnen seitlich. Fix: Balkenbreite messen und als
`padding-right` an den `body`.

[MEDIUM] Design/Tasks — Die Fokus-Rückgabe sei nicht dagegen gewappnet, dass
der Auslöser inzwischen aus dem DOM verschwunden ist.

## Reviewer: codex (gpt-5.2-codex)

VERDICT: REQUEST-CHANGES

[HIGH] Die Falle greife bei drei von vier Overlays gar nicht: sie versetzen den
Fokus beim Öffnen nicht, er steht also außerhalb, und eine Falle, die nur an
den Rändern des Containers umlenkt, sieht ihn nie.

[HIGH] Gleichzeitige Overlays hätten nur für die Sperre eine Besitzregel. Zwei
aktive Fallen behandelten denselben Tastendruck.

[HIGH] `RefObject<HTMLElement | null>` sei unter React 19 nicht an das `ref`
eines `<div>` zuweisbar — der Vorschlag scheitere am Typecheck.

[HIGH] Die Off-Canvas-Navigation werde ab `lg` nur per CSS versteckt; nach
einem Breakpoint-Wechsel bliebe `mobileNavOpen` true und der Body dauerhaft
gesperrt.

[HIGH] „Jedes Bedienelement ohne vorheriges Scrollen erreichbar" sei auf einer
langen Feed-Seite unerfüllbar und werde von der Abnahme auch nicht geprüft.

[MEDIUM] Die vier Anschluss-Tests prüften nur den globalen Body-Effekt — ein
Anschluss, der den Ref vergisst, wäre grün.

[MEDIUM] `trigger.focus()` könne scrollen und damit die eben „exakt"
wiederhergestellte Position wieder verschieben.

[MEDIUM] Der Fokus-Selektor erfasse auch `input[type="hidden"]` und Knoten in
versteckten Vorfahren.

[MEDIUM] Das Aufräumen der Sperre überschreibe womöglich fremde Inline-Stile.

[MEDIUM] Das frühe `if (!user) return null` im Feedback-Panel mache eine naive
Hook-Integration entweder regelwidrig oder hinterlasse bei Auth-Verlust eine
aktive Sperre ohne sichtbares Overlay.

[LOW] Das responsive Verhalten des Feedback-Widgets gehöre nach
`specs/feedback-qm/`, nicht ins Design-System.

## Not counted

- **codex, erster Lauf** — exit 4, Zeitüberschreitung bei 540 s. Nicht gezählt;
  mit `REVIEWER_TIMEOUT=900` wiederholt, der zweite Lauf endete mit exit 0 und
  ist die oben protokollierte Stimme.

## Resolution

Elf der zwölf Befunde übernommen, einer am Repo widerlegt.

**Widerlegt — [HIGH, gemini] Scrollbalken-Ausgleich.** Im Allgemeinen richtig,
in diesem Projekt gegenstandslos: `src/index.css:187` setzt
`scrollbar-gutter: stable` auf `html`, und der Kommentar dort nennt genau
diesen Anlass (AGE-237, „springt herum"). Der Platz ist reserviert, ob ein
Balken da ist oder nicht — ein zusätzliches `padding-right` erzeugte erst den
Versatz, den es verhindern soll. Das Delta sagt das jetzt ausdrücklich, damit
der nächste Leser dieselbe Frage nicht noch einmal stellt.

**Übernommen, mit Nachprüfung am Code:**

- **Falle greift nicht (HIGH).** Nachgesehen: nur die Lightbox setzt den Fokus
  beim Öffnen (`CommunityFeed.tsx:877`), Navigation, Cropper und Feedback-Panel
  tun es nicht. Der Befund trägt. Die Falle bekommt einen dritten Fall — Fokus
  außerhalb, Tab springt hinein —, ohne beim Öffnen einzugreifen. Damit bleibt
  die bewusste Entscheidung der Lightbox unangetastet und die anderen drei sind
  ab dem ersten Tastendruck gefangen.
- **Kein Besitz bei der Falle (HIGH).** Aus dem Zähler wird ein **Stapel**: die
  Sperre hängt an der Tiefe, die Falle an der Spitze. Nur das oberste Overlay
  behandelt Tab.
- **Ref-Typ (HIGH).** `react` 19.2.8 / `@types/react` 19.2.18 bestätigt. Der
  Hook wird generisch (`<T extends HTMLElement = HTMLDivElement>`).
- **`lg`-Wächter (HIGH).** Nachgesehen: `AppShell.tsx:287` behandelt
  ausschließlich Escape, einen Resize-Wächter gibt es nicht, und die Schublade
  verschwindet ab `lg` nur per `lg:hidden`. Ohne diese Zeile hätte der Change
  eine **dauerhafte** Sperre ohne sichtbares Overlay eingebaut — der teuerste
  Befund der Runde. Der Wächter ist jetzt Aufgabe 2.5 und ausdrücklich die
  Bedingung dafür, dass der Anschluss 2.4 überhaupt erlaubt ist; das Delta
  trägt die zugehörige Anforderung.
- **Unerfüllbare Abnahmezeile (HIGH).** „Jedes Bedienelement der Seite" ist
  ersetzt durch „jede **sichtbare kuratierte Kachel**", und die Abnahme nennt
  jetzt das Messverfahren (`elementFromPoint` in der Kachelmitte) statt eines
  Gefühls.
- **Anschluss-Tests beweisen den Ref nicht (MEDIUM).** Je Overlay wird ein
  **Fokusumlauf** geprüft, nicht nur der Body-Effekt.
- **`focus()` scrollt (MEDIUM).** `focus({ preventScroll: true })`, und
  ausdrücklich **nach** dem Wiederherstellen der Position. Zusammen mit
  geminis MEDIUM: nur fokussieren, wenn der Auslöser noch `isConnected` ist.
- **Selektor zu weit (MEDIUM).** `input[type="hidden"]` fliegt raus. Der
  Sichtbarkeitsfilter **nicht** — und zwar begründet: die drei Wege dorthin
  (`offsetParent`, `getClientRects`, `checkVisibility`) liefern in jsdom für
  jeden Knoten „unsichtbar", ein solcher Filter machte die Falle in den Tests
  zur grünen Attrappe. Der Preis steht im Design.
- **Fremde Inline-Stile (MEDIUM).** Werden beim ersten Sperren gesichert und
  beim letzten Freigeben zurückgeschrieben; eigener Test mit vorbelegtem
  `body.style`.
- **Hook-Regeln im Feedback-Panel (MEDIUM).** Nachgesehen: das
  `if (!user) return null` steht in `FeedbackButton.tsx:35` **nach** sieben
  `useState`. Der Hook wird davor gerufen und mit `Boolean(user) && open`
  aktiviert.
- **Ablage (LOW).** Die Knopf-Anforderung liegt jetzt in
  `specs/feedback-qm/spec.md`; im Design-System bleiben die allgemeinen
  Overlay-Regeln.

**Zu den unausgesprochenen Annahmen:** die letzte („die iPhone-Abnahme wird
tatsächlich nachgeholt") ist keine Annahme, sondern eine offene Aufgabe mit
Namen — 4.5, und sie steht so auch im Issue. Die Sitzung kann sie nicht
schließen; der PR sagt das, statt es zu verschweigen.
