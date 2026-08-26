---
reviewers: [gemini, opencode, codex]
models: [gemini-cli (Modell nicht in der Ausgabe genannt), "hf:moonshotai/Kimi-K3", codex-cli (Modell nicht in der Ausgabe genannt)]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 782bf1a5c8136fefced47997543ea9150dbf379a1e672f46543c37d409363046
---

# Change review — add-video-consent-gate

Drei Fremdanbieter, **kein einziger davon Claude** — der eigene Anbieter
reviewt den eigenen Change nicht. Alle drei: REQUEST-CHANGES.

Geprüft wurde der Stand vor jeder Codezeile (Prompt-SHA oben, 362 Zeilen:
Komponente, bestehender Test, Proposal, Tasks, Spec-Delta).

## Reviewer: gemini

VERDICT: REQUEST-CHANGES

- **[HIGH]** proposal §3 — YouTube bekommt `youtube-nocookie.com`, Vimeo nichts.
  Vimeo kennt `?dnt=1` für denselben Zweck. Die Datenschutz-Verbesserung ist so
  inkonsistent. — Vimeo-Embed-URL um `dnt=1` ergänzen.
- **[MEDIUM]** tasks 2.5 — „ist ein Bedienelement" ist zu vage. Ein `div` mit
  `onClick` ist nicht tastaturbedienbar. — Als `<button>` umsetzen; der
  zugängliche Name muss den Anbieter nennen.
- **[LOW]** tasks 5.1/5.2 — Rechtstexte werden geändert, ohne dass eine
  datenschutzverantwortliche Stelle sie freigibt.
- **[LOW]** Layout-Sprung beim Austausch Fläche → `iframe`. — Die Fläche muss
  exakt dieselbe Größe belegen.

## Reviewer: opencode (hf:moonshotai/Kimi-K3)

VERDICT: REQUEST-CHANGES

Hat gegen das Repository geprüft und alle Zeilenangaben des Proposals bestätigt.

- **[HIGH]** `src/lib/feed.test.ts` — sieben Assertions pinnen
  `embedUrl: "https://www.youtube.com/embed/…"`. Aufgabe 4.3 macht die Suite
  rot, und kein Task nennt sie.
- **[HIGH]** `src/pages/HomePage.test.tsx:43-53` — erwartet ein `<iframe>` beim
  **ersten** Rendern und `src` mit `youtube.com/embed/…`. Das Tor bricht die
  erste Zusage, `nocookie` die zweite. Genau die Fläche, um die es geht.
- **[HIGH]** Spec-Szenario vs. Task 6.3 — „plays the video" ist so nicht
  lieferbar. Ein nachträglich eingesetztes `iframe` lädt den Player
  **pausiert**; der Besucher müsste ein zweites Mal klicken, diesmal im fremden
  Rahmen.
- **[MEDIUM]** Vimeo-Asymmetrie (deckungsgleich mit gemini).
- **[MEDIUM]** Die Klausel „activation SHALL NOT be remembered" hat weder Test
  noch Task.
- **[LOW]** Nach dem Austausch fällt der Tastaturfokus auf `document.body`.
- **[LOW]** Ein Datenschutz-Invariant in `design-system` findet niemand, der in
  `access-control` sucht.

Unausgesprochene Annahmen (Auswahl): dass YouTube die Zusage zu
`youtube-nocookie` heute und dauerhaft einhält — die Spec erhebt eine
**Anbieterzusage** zum System-SHALL, ohne Prüfweg; dass die fünf Aufrufstellen
vollständig bleiben (heute belegt, aber 3.1 ist ein einmaliges grep).

## Reviewer: codex

VERDICT: REQUEST-CHANGES

- **[HIGH]** Autoplay (deckungsgleich mit opencode).
- **[HIGH]** Spec-Delta / `VideoLinksInput.tsx` — Die Einwilligung hängt an der
  **Komponenteninstanz**, nicht an der URL. Der Editor schlüsselt Zeilen nach
  Index: wer eine Vorschau aktiviert und dann die URL derselben Zeile ändert,
  lädt die neue Adresse **ohne neue Aktivierung**. — Die aktivierte URL
  speichern, nicht ein `boolean`.
- **[HIGH]** tasks 6.1/6.2 — Die Ausschlussliste nennt `youtube-nocookie.com`
  **nicht**. Die Abnahme könnte grün sein, während die Seite genau das neue
  `iframe` vor der Einwilligung lädt.
- **[HIGH]** `src/content/legal/cookies.ts:601` — dort steht „Ihre Einwilligung
  erfolgt über unser Cookie-Consent-Banner." Nur den offenen Punkt zu streichen
  lässt den Text widersprüchlich zurück.
- **[MEDIUM]** Die Cookie-Zusage zu `youtube-nocookie` ist als Tatsache
  formuliert; Google dokumentiert reduzierte Personalisierung, nicht
  Cookie-Freiheit. Ein Hostname-Vergleich kann Cookie-Verhalten nicht belegen.
- **[MEDIUM]** `academy-library/spec.md:31-33` und
  `community-feed/spec.md:354-359` beschreiben einen sofort eingebetteten
  Player. Ohne MODIFIED-Delta fordert die archivierte Wahrheit gleichzeitig
  sofortigen Player **und** Einwilligungstor.
- **[MEDIUM]** `HomePage.test.tsx` und `feed.test.ts` (deckungsgleich mit
  opencode).
- **[MEDIUM]** „zwei Videos, zwei Aktivierungen" hat kein Szenario. Eine
  Umsetzung mit modulweitem Zustand würde die übrigen Tests bestehen.
- **[LOW]** `grep` auf `<iframe` beweist nichts über dynamisch erzeugte Rahmen,
  `<embed>`, `<object>` oder Anbieter-SDKs.

## Nachgeprüft, nicht übernommen

Reviewer irren. Vor der Übernahme selbst am Quelltext belegt:

| Befund | Belegt |
| -- | -- |
| `feed.test.ts` pinnt Embed-URLs | ja — Zeilen 91, 126, 130, 132, 134, 148 |
| `HomePage.test.tsx` erwartet iframe zuerst | ja — `expect(iframe).not.toBeNull()` in Zeile 46 |
| `cookies.ts:601` nennt ein Banner | ja, wörtlich |
| `academy-library` fordert sofortigen Player | ja — „and an embedded external video player" |

**`community-feed:354-359` NICHT übernommen.** Dort steht „die Karte zeigt genau
ein Embed und keinen zusätzlichen Link". Die Aussage bleibt wahr: die Karte zeigt
weiterhin genau eine Einbettungsfläche und keinen zweiten Link. Was sich ändert,
ist der Zustand *innerhalb* der Fläche, nicht ihre Anzahl. Ein MODIFIED-Delta
dort würde ein Szenario anfassen, an dem nichts falsch wird — und jedes
angefasste Szenario ist ein Risiko beim Archivieren.

## Resolution

| Befund | Entscheidung |
| -- | -- |
| **HIGH** Autoplay (opencode, codex) | **Übernommen.** `autoplay=1` wird **in `VideoEmbed` an die aktivierte URL gehängt**, nicht in `parseVideoUrl` — die kanonische Grenze bleibt sauber und die SQL-Parität unberührt. Spec-Szenario und Task sagen jetzt „lädt **und spielt**", und das wird im Browser geprüft. |
| **HIGH** Einwilligung an Instanz statt URL (codex) | **Übernommen.** Gespeichert wird die aktivierte URL, nicht ein `boolean`. Eigenes Szenario, eigener Test: URL-Wechsel bei stehender Komponente fällt auf die Fläche zurück. |
| **HIGH** Ausschlussliste ohne `nocookie` (codex) | **Übernommen — und verschärft.** Statt einer Ausschlussliste, die immer eine Zeile zu kurz sein kann, wird die **Menge aller fremden Ursprünge** gemessen und muss **leer** sein. Genau so ist auch das RED entstanden. |
| **HIGH** `cookies.ts:601` (codex) | **Übernommen.** Der Abschnitt wird mitgeschrieben. |
| **HIGH** `feed.test.ts` (opencode, codex) | **Übernommen**, eigener Task. |
| **HIGH** `HomePage.test.tsx` (opencode, codex) | **Übernommen**, eigener Task. Die Zusage „die nackte URL steht nicht im Text" bleibt erhalten. |
| **HIGH/MED** Vimeo `dnt=1` (gemini, opencode) | **Übernommen.** Zwei Anbieter unabhängig; die Asymmetrie war nicht begründbar. |
| **MED** Cookie-Zusage unbelegbar (opencode, codex) | **Übernommen.** Die Spec sagt jetzt, was **das System tut** (die URL gegen diesen Host bauen), nicht, was der Anbieter verspricht. Eine Anforderung, die nur der Anbieter erfüllen kann, ist nicht prüfbar. |
| **MED** `academy-library` (codex) | **Übernommen**, MODIFIED-Delta mit vollständig wiederholter Anforderung. |
| **MED** zwei Videos, zwei Aktivierungen (codex) | **Übernommen**, Szenario und Test. |
| **MED** „nicht gemerkt" ohne Test (opencode) | **Übernommen**, Test. |
| **MED** Tastatur-Semantik (gemini) | **Übernommen**, `<button>` ausdrücklich. |
| **LOW** Fokus nach dem Austausch (opencode) | **Übernommen.** Der Fokus wandert auf den Rahmen. |
| **LOW** Layout-Sprung (gemini) | **Übernommen.** Fläche und Rahmen teilen sich `aspect-video`. |
| **LOW** grep zu eng (codex) | **Übernommen.** Gesucht wird zusätzlich nach den Anbieter-Domänen. |
| **LOW** Spec liegt in `design-system` (opencode) | **Nicht geändert.** Dort stehen bereits „Fonts are served from the application's own origin" und „Imagery is served from the application's own origin" — dieselbe Klasse, derselbe Ort. Ein dritter Ort für dieselbe Regel wäre die Zersplitterung, die der Befund beklagt. |
| **LOW** Rechtstexte ohne juristische Freigabe (gemini, codex) | **Nicht in diesem Change.** Alle vier Texte tragen `provisorisch: true` und liegen über **AGE-610** beim Anwalt. Dieser Change **verringert** die Zahl der offenen Punkte; er erhebt keinen Text zur geprüften Endfassung. |
| **Annahme** fünf Aufrufstellen bleiben vollständig (opencode) | **Anerkannt, nicht gelöst.** Ein einmaliges grep ist keine Dauerkontrolle. Ein Wächter dagegen ist ein eigener Vorgang (vgl. AGE-542 für die Anon-Lesepfade), kein Beifang hier. |
