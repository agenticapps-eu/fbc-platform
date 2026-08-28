# Tasks — Emoji-Auswahl und Zeitstempel (AGE-645)

Reihenfolge nach Abhängigkeit, nicht nach Aufwand. Jede Aufgabe nennt, was
**rot** aussieht, bevor sie grün wird — ein Haken ohne vorher gesehenes Rot ist
kein Haken.

## 1. Die Ersetzung (reine Funktion, kein React)

- [ ] `src/lib/emoticons.ts` mit `ersetzeEmoticons(text: string): string`
- [ ] **RED zuerst:** Treffer (`:-)` → 🙂, `<3` → ❤️, mehrere in einem Text)
      **und** Nicht-Treffer (`http://x.de/a:-)b`, `http://x.de/a:-).`,
      `foo:)bar`). Gegenprobe: die Nicht-Treffer müssen fehlschlagen, wenn die
      linke Grenze entfernt wird — sonst prüft der Test die Grenze nicht.
- [ ] **Satzzeichen rechts sind ein Treffer, kein Ausschluss** (aus der Review,
      HIGH): `Toll :-).`, `Schön :)!`, `(danke :-))` werden ersetzt, das
      Satzzeichen bleibt stehen
- [ ] **Ohne Rücksicht auf Schreibweise** bei den alphabetischen Formen: `:p`
      wie `:P`, `:d` wie `:D`
- [ ] Längere Form vor kürzerer (`:-)` vor `:)`); Test, der die falsche
      Reihenfolge auffliegen lässt

## 2. Der Zeitstempel in der Blase

- [ ] **RED zuerst:** `Conversation` zeigt an einer bestätigten Nachricht
      `HH:MM`; an einer mit `pending: true` **keine** Zeit
- [ ] **Ältere Nachrichten tragen ein Datum** (aus der Review): heute `HH:MM`,
      davor `TT.MM., HH:MM`. Test mit einer festen Zeit, nicht mit `Date.now()`
- [ ] `<time dateTime={message.createdAt}>` mit vollem Datum als `title`
- [ ] Zwei Farben für die zwei Blasengründe (`text-chrome/70` eigen,
      `text-muted` fremd)
- [ ] Unter dem Text, nicht daneben — bei `max-w-[75%]` im Fenster zwänge
      daneben kurze Nachrichten in einen Umbruch

## 3. Der Datensatz

- [ ] `scripts/generate-emoji.ts` — holt `de/compact.json` und `de/messages.json`
      von `emojibase-data@17`, wirft Gruppe 2 (`component`) weg, schreibt
      `src/content/emoji.generated.ts` als `[emoji, label, tags, group][]`
- [ ] Kopfkommentar: **läuft NICHT in `prebuild`** (braucht Netz), von Hand
      anzustossen — anders als `release:entries`
- [ ] Kopf der **erzeugten** Datei: Quelle, Fassung (`emojibase-data@17.0.0`),
      **MIT-Lizenzhinweis**, und „erzeugt — nicht von Hand ändern"
- [ ] `skins` wird **nicht** mitgenommen (Hauttöne sind ausgeschlossen, siehe
      Design 3a) — eine Zeile, falls der Folgevorgang sie will
- [ ] Erzeugte Datei einchecken

## 4. Das Auswahlfeld

- [ ] `src/components/chat/EmojiAuswahl.tsx` — Raster nach Gruppen, Suchfeld über
      `label` + `tags`, per `createPortal` an `document.body`
- [ ] Dynamisches `import()` des Datensatzes beim ersten Öffnen
- [ ] Position aus `getBoundingClientRect()` des Schalters, **nicht** aus
      CSS-Variablen der Hülle (die Falle aus AGE-639)
- [ ] **Öffnet nach OBEN**, wenn darunter kein Platz ist (im angedockten Fenster
      immer), waagerecht ans Sichtfenster geklemmt, Neuberechnung bei `scroll`
      und `resize` — aus der Review, MEDIUM
- [ ] Suche normalisiert: Kleinschreibung **und** Umlautfaltung (`ä→a`, `ß→ss`)
      auf beiden Seiten
- [ ] Tastaturweg: Fokus beim Öffnen ins **Suchfeld**, Pfeiltasten ins Raster,
      Enter wählt, Escape schliesst
- [ ] ARIA: `dialog` mit Namen, `role="grid"`, je Feld der deutsche Name als
      zugänglicher Name, `aria-expanded` am Schalter
- [ ] Schliessen per Escape und Klick daneben; Fokus zurück in die **Eingabe**
      (nicht auf den Schalter)
- [ ] **RED zuerst:** Einfügen an der Cursorposition (nicht am Ende), Fokus
      kehrt zurück, deutsche Suche findet (Probe: „Herz" → ❤️, „gruen" → 💚)

## 5. Einbau in die Sendezeile

- [ ] `textarea` in einen `relative` Wrapper, Schalter absolut rechts innen,
      `pr-9` am Feld
- [ ] Beide Varianten (`seite`, `fenster`) tragen ihn
- [ ] `ersetzeEmoticons` in **`useGespraech.sende()`**, nicht in
      `Conversation.submit()` — dort trägt die optimistische Blase denselben
      String wie der Insert, strukturell statt per Konvention (`sendMessage` hat
      genau einen Aufrufer, `use-gespraech.ts:134`)
- [ ] **RED zuerst:** die optimistische Blase trägt denselben Text wie der
      Aufruf an `sendMessage` — beide 🙂, nicht `:-)`

## 6. Bündel-Zusage prüfen

- [ ] Belegen, dass der Datensatz **nicht** im Startbündel liegt — am erzeugten
      Bündel gemessen, nicht am Import-Ausdruck
- [ ] Achtung: ein Build ohne `.env` erzeugt 236 kB ohne App-Code und endet mit
      Exit 0. Die Messung braucht echte Werte, sonst misst sie nichts.

## 7. Sichtprobe im Browser (was jsdom nicht sieht)

- [ ] Overlay wird nicht eingefangen — `getBoundingClientRect` direkt nach dem
      Öffnen, in einem Fenster (dessen Vorfahre `transform` trägt)
- [ ] Overlay öffnet **im Fenster** nach oben und bleibt vollständig im
      Sichtfenster; beim Scrollen läuft es dem Schalter nach. Der günstige Fall
      auf der Seite beweist das nicht
- [ ] Sendezeile bricht bei 14 rem nicht um; Eingabe behält ihre Breite
- [ ] Kontrast der Uhrzeit auf **beiden** Blasen in **beiden** Themes
      (`data-variant`, hell und navy — nicht `prefers-color-scheme`)
- [ ] Tastaturweg mit **echten** Tastendrücken über CDP, nicht `fireEvent` —
      ein synthetisches `KeyboardEvent` aktiviert keinen `<button>`

## 8. Abschluss

- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`
      (**nie** `pnpm format` — schreibt ~60 fremde Dateien um)
- [ ] `openspec validate --all` grün
- [ ] Code-Review auf dem Diff (Stufe 2), nicht auf dem Plan — **die zwei
      Hälften ausdrücklich getrennt beurteilen lassen** (Emoji-Weg und
      Zeitstempel sind unabhängig; sonst kauft das offengelegte Bündeln nichts)
- [ ] `openspec archive`, dann PR
