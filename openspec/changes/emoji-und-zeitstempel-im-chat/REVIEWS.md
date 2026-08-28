---
reviewers: [gemini, opencode]
models: [gemini-cli-default-nicht-ausgewiesen, hf:moonshotai/Kimi-K3]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: f2c16509e1c9de6948bbbd7d95c543a531f5148280010ccad18d8204bef7c6ff
---

# Change review — emoji-und-zeitstempel-im-chat

Beide Reviewer sind **andere Anbieter als der Verfasser** (Claude). `codex`
wurde bewusst nicht gerufen: er delegiert die Review an Unter-Reviewer,
darunter `claude`, und lieferte damit eine fremde Meinung unter eigenem Namen —
die Zwei-Anbieter-Regel wäre nur dem Namen nach erfüllt.

**Zum Modell von `gemini`:** die Hülle ruft `gemini -p` ohne Modellangabe, und
die Ausgabe weist keines aus. Es ist die Voreinstellung der CLI; mehr lässt sich
aus dem Lauf ehrlich nicht sagen. `opencode` hat sich selbst als
`hf:moonshotai/Kimi-K3` ausgewiesen — verschiedene Modelle, also zwei Meinungen.

## Reviewer: gemini (CLI-Voreinstellung, nicht ausgewiesen)

VERDICT: REQUEST-CHANGES

- **[HIGH]** Design, Auswahlfeld — Hauttöne fehlen vollständig. Gruppe 2
  wegzuwerfen entfernt die Modifikatoren, sagt aber nicht, wie jemand 👍 in
  seinem Ton wählt. — Mechanismus ergänzen.
- **[MEDIUM]** Aufgabe 3, Datensatz — der von Hand anzustossende Erzeuger ist ein
  Prozessrisiko: ein späterer Entwickler weiss nicht, wann er ihn laufen lässt,
  und nicht, dass die erzeugte Datei nicht von Hand geändert wird. — Warnung in
  den Kopf der erzeugten Datei, Abschnitt in die `README.md`.
- **[LOW]** Aufgabe 4 — Barrierefreiheit ist nirgends festgeschrieben: ARIA-Rollen,
  Namen, Tastaturnavigation im Raster fehlen. — als Anforderung aufnehmen.
- **[LOW]** Design 4 — die handverlesene Liste wirkt willkürlich, weil nirgends
  steht, dass sie bewusst minimal ist. — Begründung als Kommentar in
  `emoticons.ts`.

Genannte Annahmen: Suchleistung über 1949 Einträge ungeprüft; Verfügbarkeit der
Quelle für spätere Läufe; Vollständigkeit der sieben Emoticon-Formen.

## Reviewer: opencode (hf:moonshotai/Kimi-K3)

VERDICT: REQUEST-CHANGES

- **[HIGH]** Design 4 / Delta — die Grenze „nur Leerraum" schliesst den
  häufigsten echten Fall aus: `Toll :-).`, `Schön :)!`, `(danke :-))` würden
  **nicht** ersetzt, weil Satzzeichen kein Leerraum sind. Die Funktion setzte
  genau dort aus, wo sie am natürlichsten benutzt wird. — Grenze auf Satzzeichen
  erweitern, oder die Einschränkung ausdrücklich entscheiden und testen.
- **[MEDIUM]** Design 4 — Gross-/Kleinschreibung unbestimmt: `:P` steht in der
  Liste, `:p` nicht, obwohl letzteres häufiger getippt wird. Still
  gross-empfindlich heisst, die Hälfte wandelt um und die andere nicht, ohne
  sichtbare Regel.
- **[MEDIUM]** Delta — **keine einzige Zusage zum Schliessen** des Auswahlfelds
  und keine zur Tastaturbedienung darin. Das Delta wäre von einem nur mit der
  Maus bedienbaren, nicht schliessbaren Overlay erfüllt. Aufgabe 7 nennt einen
  „Tastaturweg", ohne je zu sagen, welchen.
- **[MEDIUM]** Design 3 — Hauttöne fehlen unausgesprochen; das ist eine
  Produktentscheidung, kein Datendetail, und gehört in „Was NICHT dazugehört".
- **[MEDIUM]** Design 2 — keine Positionierungsstrategie über
  `getBoundingClientRect` hinaus. Das angedockte Fenster steht **am unteren
  Rand**, wo ein nach unten geöffnetes Popover keinen Platz hat. Nichts zu
  Umklappen, Klemmen, Scrollen, Grössenänderung.
- **[LOW]** Delta, Zeitstempel — die Zusage über Hilfstechnik ist zu stark:
  Screenreader lesen `dateTime` nicht verlässlich, `title` ist per Berührung
  unerreichbar. Und die Folge des Ausschlusses von Datumstrennern ist, dass eine
  Nachricht von letztem Dienstag als „14:03" dasteht.
- **[LOW]** Aufgabe 3 — kein Frische-Nachweis und keine Lizenznennung für
  mitgelieferte erzeugte Daten (`emojibase-data` ist MIT).
- **[LOW]** Meta — die Kosten des Zwei-Entscheidungen-Bündels sind offengelegt,
  aber nicht abgefedert; die Code-Review sollte beide Hälften getrennt beurteilen.

Genannte Annahmen: `Conversation` sei der einzige Sendeweg; die optimistische
Blase werde aus genau dem übergebenen String gebaut; `draft.trim()` sei
bestehendes Verhalten; Zeitzone des Betrachters; Suchvergleich falte Schreibung
und Umlaute; niemand importiere den Datensatz statisch; die Lizenz sei geprüft.

## Nicht gezählt

- **codex** — nicht gerufen. Nicht wegen eines Fehlers, sondern weil er die
  Review weiterreicht (unter anderem an `claude`) und damit die Unabhängigkeit
  der zwei Anbieter aushöhlen würde. Bekannt aus einer früheren Sitzung.

## Auflösung

Beide Verdikte waren REQUEST-CHANGES. **Alle HIGH und alle MEDIUM sind
eingearbeitet**, zwei davon haben das Design sachlich verbessert:

| Befund | Was geschehen ist |
| --- | --- |
| **HIGH** (opencode) Satzzeichen | **Geändert.** Grenze links: Anfang, Leerraum, öffnende Klammer/Anführung. Rechts: Ende, Leerraum, **Satzzeichen**. URLs bleiben über die *linke* Grenze ausgeschlossen (`…/a:-).` hat links ein `a`). Neue Tests für Treffer *und* Nicht-Treffer. — Der beste Befund der Runde. |
| **HIGH** (gemini) / **MEDIUM** (opencode) Hauttöne | **Ausdrücklich entschieden statt ergänzt.** Nachgemessen: 330 von 1949 Einträgen tragen Töne, Mitliefern kostete +8 kB gzip. Ausgeschlossen wird trotzdem — die Kosten liegen in der Oberfläche (Popover im Popover, gemerkter Vorzugston), nicht in den Daten. Steht jetzt in Design 3a, im Proposal unter „Was NICHT dazugehört", und im Delta als Zusage über die neutrale Grundform. |
| **MEDIUM** (opencode) Schreibweise | **Geändert.** Alphabetische Formen ohne Rücksicht auf Gross-/Kleinschreibung; Delta und Test. |
| **MEDIUM** (opencode) Schliessen + Tastatur | **Geändert.** Neuer Abschnitt Design 3b, drei neue Delta-Szenarien (Schliessen, reiner Tastaturweg, Suche ohne Rücksicht auf Schreibung/Umlaute), ARIA im Delta festgeschrieben. |
| **MEDIUM** (opencode) Positionierung | **Geändert.** Öffnet nach oben, wenn darunter kein Platz ist (im Fenster immer), waagerecht geklemmt, Neuberechnung bei Scroll und Grössenänderung. Eigenes Delta-Szenario und eigener Punkt in der Sichtprobe — ausdrücklich **im Fenster** zu prüfen. |
| **MEDIUM** (gemini) Erzeuger-Prozessrisiko | **Teilweise.** Kopf der erzeugten Datei trägt Quelle, Fassung, Lizenz und „nicht von Hand ändern". **Nicht** übernommen: ein `README.md`-Abschnitt — der Kommentar im Skriptkopf und in der erzeugten Datei steht dort, wo jemand hinsieht, der die Datei anfasst; eine dritte Stelle wäre eine weitere, die veraltet. |
| **LOW** (opencode) Hilfstechnik-Zusage | **Geändert, und dabei eine echte Lücke geschlossen.** Die Zusage ist auf das zurückgenommen, was wahr ist. Und aus der Folge („letzter Dienstag steht als 14:03 da") wurde eine Änderung: heute `HH:MM`, älter `TT.MM., HH:MM`. Das ist keine Datumsgruppierung. |
| **LOW** (opencode) Lizenz | **Geändert.** MIT-Nennung im Kopf der erzeugten Datei. |
| **LOW** (opencode) getrennte Beurteilung | **Geändert.** Aufgabe 8 weist die Code-Review an, beide Hälften getrennt zu beurteilen. |
| **LOW** (gemini) ARIA | **Geändert**, zusammen mit dem MEDIUM zur Tastatur. |
| **LOW** (gemini) Begründung der Liste | **Geändert.** Die Begründung steht in Design 4 und gehört als Kommentar in `emoticons.ts`. |

### Zwei Annahmen wurden geprüft, nicht nur eingeräumt

* **„`Conversation` ist der einzige Sendeweg."** Nachgesehen: `sendMessage` hat
  genau **einen** Aufrufer im Produktivcode (`use-gespraech.ts:134`). Die
  Annahme stimmt — und hat die bessere Stelle gezeigt: die Ersetzung wandert von
  `Conversation.submit()` in **`useGespraech.sende()`**. Dort ist die Gleichheit
  von optimistischer Blase und Datenbankzeile strukturell statt per Konvention,
  und jeder künftige Aufrufer erbt sie.
* **„Der Suchvergleich faltet Schreibung und Umlaute."** War nicht zugesagt, ist
  es jetzt — im Delta und in den Aufgaben.

### Was bewusst offen bleibt

* **Suchleistung** (gemini): ein linearer Durchlauf über 1949 Einträge je
  Tastendruck ist unmessbar teuer. Kein Index, keine Messung — wenn es sich im
  Browser anders zeigt, ist das ein Befund, kein Plan.
* **Vollständigkeit der Emoticon-Liste** (gemini): `XD`, `^_^` und Verwandte
  fehlen absichtlich. Die Liste ist erweiterbar; jede Erweiterung zahlt aber
  wieder das Fehlalarm-Risiko, das die kanonische Liste disqualifiziert hat.
* **Nachgelagerte Verbraucher von `messages.body`** (opencode): Suche,
  Benachrichtigungen, Auszüge sehen künftig Mehr-Codepunkt-Folgen statt reinem
  ASCII. Nicht geprüft — steht als Frage in der Sichtprobe, nicht als Zusage.
