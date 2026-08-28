# Tasks — Emoji-Auswahl und Zeitstempel (AGE-645)

Reihenfolge nach Abhängigkeit, nicht nach Aufwand. Jede Aufgabe nennt, was
**rot** aussieht, bevor sie grün wird — ein Haken ohne vorher gesehenes Rot ist
kein Haken.

## 1. Die Ersetzung (reine Funktion, kein React)

- [x] `src/lib/emoticons.ts` mit `ersetzeEmoticons(text: string): string`
- [x] **RED zuerst:** Treffer (`:-)` → 🙂, `<3` → ❤️, mehrere in einem Text)
      **und** Nicht-Treffer (`http://x.de/a:-)b`, `http://x.de/a:-).`,
      `foo:)bar`). Gegenprobe: die Nicht-Treffer müssen fehlschlagen, wenn die
      linke Grenze entfernt wird — sonst prüft der Test die Grenze nicht.
- [x] **Satzzeichen rechts sind ein Treffer, kein Ausschluss** (aus der Review,
      HIGH): `Toll :-).`, `Schön :)!`, `(danke :-))` werden ersetzt, das
      Satzzeichen bleibt stehen
- [x] **Ohne Rücksicht auf Schreibweise** bei den alphabetischen Formen: `:p`
      wie `:P`, `:d` wie `:D`
- [x] Längere Form vor kürzerer (`:-)` vor `:)`); Test, der die falsche
      Reihenfolge auffliegen lässt

## 2. Der Zeitstempel in der Blase

- [x] **RED zuerst:** `Conversation` zeigt an einer bestätigten Nachricht
      `HH:MM`; an einer mit `pending: true` **keine** Zeit
- [x] ~~Ältere Nachrichten tragen ein Datum an der Blase~~ **ÜBERHOLT.** Donald
      hat am 28.08. Tagesmarker wie in WhatsApp bestellt (Bild geliefert). Damit
      steht der Tag EINMAL im Trenner, und die Blase trägt nur `HH:MM` — das
      Datum an jeder Blase wäre Doppelung. Siehe Abschnitt 2a.
- [x] `<time dateTime={message.createdAt}>` mit vollem Datum als `title`
- [x] Zwei Farben für die zwei Blasengründe — **eigene Blase mit VOLLER
      Deckkraft**, nicht `/70`: im Browser gemessen ergab `/70` nur 3,34:1,
      `/90` 4,43:1, voll 5,07:1. Unter 4,5 besteht kein AA.

## 2a. Tagesmarker (nachgereicht am 28.08.)

- [x] `src/lib/tagestrenner.ts` — „Heute", „Gestern", Wochentag innerhalb der
      Woche, sonst Datum; plus `gruppiereNachTag`
- [x] **RED zuerst**, mit fester Bezugszeit statt `Date.now()`
- [x] Kalendertage, keine Zeitspannen: 23:30 und 00:30 liegen eine Stunde
      auseinander und sind verschiedene Tage
- [x] Mittige Pille über jeder Gruppe, `role="separator"` mit Text
- [x] Unter dem Text, nicht daneben — bei `max-w-[75%]` im Fenster zwänge
      daneben kurze Nachrichten in einen Umbruch

## 3. Der Datensatz

- [x] `scripts/generate-emoji.ts` — holt `de/compact.json` und `de/messages.json`
      von `emojibase-data@17`, wirft Gruppe 2 (`component`) weg, schreibt
      `src/content/emoji.generated.ts` als `[emoji, label, tags, group][]`
- [x] Kopfkommentar: **läuft NICHT in `prebuild`** (braucht Netz), von Hand
      anzustossen — anders als `release:entries`
- [x] Kopf der **erzeugten** Datei: Quelle, Fassung (`emojibase-data@17.0.0`),
      **MIT-Lizenzhinweis**, und „erzeugt — nicht von Hand ändern"
- [x] `skins` wird **nicht** mitgenommen (Hauttöne sind ausgeschlossen, siehe
      Design 3a) — eine Zeile, falls der Folgevorgang sie will
- [x] Erzeugte Datei einchecken

## 4. Das Auswahlfeld

- [x] `src/components/chat/EmojiAuswahl.tsx` — Raster nach Gruppen, Suchfeld über
      `label` + `tags`, per `createPortal` an `document.body`
- [x] Dynamisches `import()` des Datensatzes beim ersten Öffnen
- [x] Position aus `getBoundingClientRect()` des Schalters, **nicht** aus
      CSS-Variablen der Hülle (die Falle aus AGE-639)
- [x] **Öffnet nach OBEN**, wenn darunter kein Platz ist (im angedockten Fenster
      immer), waagerecht ans Sichtfenster geklemmt, Neuberechnung bei `scroll`
      und `resize` — aus der Review, MEDIUM
- [x] Suche normalisiert: Kleinschreibung **und** Umlautfaltung (`ä→a`, `ß→ss`)
      auf beiden Seiten
- [x] Tastaturweg: Fokus beim Öffnen ins **Suchfeld**, Pfeiltasten ins Raster,
      Enter wählt, Escape schliesst
- [x] ARIA: `dialog` mit Namen, `role="grid"`, je Feld der deutsche Name als
      zugänglicher Name, `aria-expanded` am Schalter
- [x] Schliessen per Escape und Klick daneben; Fokus zurück in die **Eingabe**
      (nicht auf den Schalter)
- [x] **RED zuerst:** Einfügen an der Cursorposition (nicht am Ende), Fokus
      kehrt zurück, deutsche Suche findet (Probe: „Herz" → ❤️, „gruen" → 💚)

## 5. Einbau in die Sendezeile

- [x] `textarea` in einen `relative` Wrapper, Schalter absolut rechts innen,
      `pr-9` am Feld
- [x] Beide Varianten (`seite`, `fenster`) tragen ihn
- [x] `ersetzeEmoticons` in **`useGespraech.sende()`**, nicht in
      `Conversation.submit()` — dort trägt die optimistische Blase denselben
      String wie der Insert, strukturell statt per Konvention (`sendMessage` hat
      genau einen Aufrufer, `use-gespraech.ts:134`)
- [x] **RED zuerst:** die optimistische Blase trägt denselben Text wie der
      Aufruf an `sendMessage` — beide 🙂, nicht `:-)`

## 6. Bündel-Zusage prüfen

- [x] Belegen, dass der Datensatz **nicht** im Startbündel liegt — am erzeugten
      Bündel gemessen, nicht am Import-Ausdruck
- [x] Achtung: ein Build ohne `.env` erzeugt 236 kB ohne App-Code und endet mit
      Exit 0. Die Messung braucht echte Werte, sonst misst sie nichts.

**Ergebnis (28.08., echter Build mit 1696 Modulen):** eigenes Bündel
`dist/assets/emoji.generated-*.js`, 155,14 kB roh / **46,65 kB gzip** — die
Vorhersage im Proposal war 46 kB. Gegenprobe am Eintragsbündel: „Bierkrug"
kommt dort **0-mal** vor, im Emoji-Bündel einmal.

## 7. Sichtprobe im Browser (was jsdom nicht sieht)

- [x] Overlay wird nicht eingefangen — `getBoundingClientRect` direkt nach dem
      Öffnen, in einem Fenster (dessen Vorfahre `transform` trägt)
- [x] Overlay öffnet **im Fenster** nach oben und bleibt vollständig im
      Sichtfenster; beim Scrollen läuft es dem Schalter nach. Der günstige Fall
      auf der Seite beweist das nicht
- [x] Sendezeile bricht nicht um; Eingabe behält ihre Breite
- [x] Kontrast der Uhrzeit auf **beiden** Blasen in **beiden** Themes
      (`data-variant`, hell und navy — nicht `prefers-color-scheme`)
- [x] Tastaturweg mit **echten** Tastendrücken über CDP, nicht `fireEvent` —
      ein synthetisches `KeyboardEvent` aktiviert keinen `<button>`

**Ergebnisse der Sichtprobe (28.08., lokaler Stack, Chrome über CDP):**

| Prüfung | Messwert |
| --- | --- |
| Overlay am `body`, kein `transform`-Vorfahre | bestätigt |
| Öffnet **im Fenster** nach oben | Dialog endet bei 1188 px, Schalter beginnt bei 1196 — 8 px Abstand, vollständig im Sichtfenster |
| Läuft beim Scrollen mit | Schalter −300 px, Dialog folgt und kippt die Richtung; danach 8 px unter dem Schalter, exakt rechtsbündig |
| Sendezeile bei **12 rem** (`min-w-[12rem]`, enger als die 14 rem im Ticket) | Eingabe 83 px, Senden passt, kein Umbruch, kein Überlauf |
| Tastaturweg | Suchfeld fokussiert → „Herz" getippt → **43 Treffer** → Pfeil runter/rechts → Enter fügt 😍 ein, Fokus zurück, Cursor dahinter |
| Kontrast hell | fremde Blase 5,08 · eigene 5,07 · Tagesmarker 5,08 |
| Kontrast navy | fremde Blase 5,08 · eigene **3,61** · Tagesmarker 5,08 |
| Ende zu Ende, in der Datenbank nachgelesen | `Bis Donnerstag also 🙂. Und Budget <3000 Euro bleibt so.` — Satzzeichen-Fall UND Grenzfall in einer Nachricht |

**Zwei Befunde, die die Sichtprobe erst erzeugt hat:**

1. Mit `pr-7` ragte der Emoji-Schalter bei 12 rem **2 px** in den Textbereich.
   Behoben mit `pr-8`.
2. Die Uhrzeit auf der eigenen Blase lag mit `/70` bei **3,34:1**. Behoben durch
   volle Deckkraft.

**Ein Befund, der NICHT von hier stammt und offen bleibt:** im navy-Theme liegt
die eigene Blase bei 3,61:1 — und zwar für ihren **Nachrichtentext selbst**, den
dieser Change nicht anfasst (`bg-accent` + `text-chrome`, unverändert). Die
Uhrzeit ist damit genau so lesbar wie die Nachricht, zu der sie gehört. Eigener
Vorgang im Design-System.

## 8. Abschluss

- [x] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`
      (**nie** `pnpm format` — schreibt ~60 fremde Dateien um)
- [x] `openspec validate --all` grün
- [x] Code-Review auf dem Diff (Stufe 2), nicht auf dem Plan — **die zwei
      Hälften ausdrücklich getrennt beurteilen lassen** (Emoji-Weg und
      Zeitstempel sind unabhängig; sonst kauft das offengelegte Bündeln nichts)
- [ ] `openspec archive`, dann PR

**Die Diff-Review hat fünf Befunde gebracht, alle behoben** — Einzelheiten in
`REVIEWS.md` unter „Diff-Review (Stufe 4)". Getrennt beurteilt wie verlangt:
gemini APPROVE/REQUEST-CHANGES, opencode REQUEST-CHANGES/REQUEST-CHANGES. Der
schärfste war ein HIGH, das die Fehlalarm-Prüfung dieses Changes in ihrer
eigenen Disziplin schlug: `<3.000 Euro` wurde zu `❤️.000 Euro`, weil im
Deutschen der Punkt die Tausender trennt — geprüft war nur `<3000`. Gefunden
hat es ein Reviewer, der die Funktion **ausgeführt** statt gelesen hat.

**Die vier Prüfungen (28.08., nach dem Nachziehen von `main`, nach den Fixes):** `typecheck`
sauber · `lint` 0 Fehler (6 Warnungen `react-refresh/only-export-components`,
alle in Dateien, die dieser Change nicht anfasst) · `test` **185 Dateien,
2116 Tests** grün (14 davon neu aus der Diff-Review).

`format:check` meldet **275 Dateien** repo-weit und ist damit kein Urteil über
diesen Change: der CI-Job `verify` fährt `lint`, `typecheck`, `test` — **nicht**
`format:check` (`ci.yml:24-26`). Einzeln nachgeprüft: alle **Quelldateien**
dieses Changes sind sauber; durch fallen nur die vier Markdown-Dokumente hier —
genauso wie `openspec/changes/push-fundament/` und `openspec/specs/messaging/`.
Die OpenSpec-Dokumente sind von Hand auf ~80 Zeichen umbrochen; Prettier würde
sie umwerfen. Mitformatiert wird deshalb nichts.

**Die Suchleistung, die die Plan-Review offengelassen hatte** (gemini: „ein
linearer Durchlauf je Tastendruck ist unmessbar teuer — wenn es sich im Browser
anders zeigt, ist das ein Befund"), ist jetzt gemessen statt vermutet. 1914
Einträge, Node auf dem Entwicklungsrechner:

| Tippschritt | Treffer | je Tastendruck |
| --- | --- | --- |
| `h` | 1339 | 1,06 ms |
| `herz` | 43 | 1,52 ms |
| davon: Neu-Normalisieren **aller Einträge** | | 1,44 ms (95 %) |
| dasselbe mit einmaliger Vorfaltung | | 0,07 ms (20×) |

Die Zusage hält: 1,5 ms ist billig. Die Messung zeigt aber auch, **woher** die
Kosten kommen — nicht aus dem Durchlauf, sondern daraus, dass `filtereEmoji`
Name und Suchbegriffe jedes Eintrags bei jedem Tastendruck neu faltet. Eine
einmalige Vorfaltung wäre 20× billiger. Bewusst **nicht** gebaut: sie änderte
die Signatur von `filtereEmoji` samt Tests, und 1,5 ms rechtfertigt das nicht.
Notiert, damit die Zahl beim nächsten Anlass dasteht.
