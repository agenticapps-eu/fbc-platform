# Video-Freigabe merken statt bei jedem Video erneut fragen

Linear: **AGE-621** (Nachbesserung zu AGE-611)

## Why

Das Einwilligungstor aus AGE-611 merkt sich nichts. Gemessen in
`VideoEmbed.tsx:39`: die Freigabe liegt in `useState`, sonst nirgends — kein
`localStorage`, kein `sessionStorage`, kein Cookie. Also ein Klick pro Video,
und nach jedem Seitenwechsel und jedem Neuladen wieder von vorn. Auf der
Startseite stehen zwei Videos, das sind zwei Klicks, jedes Mal.

Donald am 27.08.: „Muss jetzt jeder bestätigen, dass er Videos laden will, und
wenn ja, einmalig oder bei jedem Video? Das ist so nirgendwo, nicht auf
LinkedIn, nicht auf Facebook."

Der Vergleich trägt nur halb — LinkedIn und Facebook liefern ihre Videos vom
eigenen Server aus, dort gibt es keine Drittübertragung, in die man einwilligen
könnte. Unüblich ist aber das **Nicht-Merken**: das verbreitete deutsche Muster
merkt sich die Entscheidung und stellt einen Widerruf daneben. Wir haben die
strengste denkbare Variante gebaut, ohne dass das je zur Wahl stand.

## What Changes

- Eine Aktivierung gilt fortan **je Anbieter und dauerhaft**, gespeichert auf
  dem Endgerät. YouTube freizugeben lässt Vimeo unberührt.
- Die Freigabe greift **ohne Neuladen** auch für die übrigen Flächen derselben
  Seite. Sonst wäre „einmalig" auf einer Seite mit zwei Videos unwahr.
- Ein **frisch angeklicktes** Video spielt weiter sofort ab und bekommt den
  Fokus. Ein Video, das nur wegen einer **gemerkten** Freigabe geladen wird,
  tut beides nicht.
- Auf der Datenschutzseite steht ein **Widerruf**, der die Freigabe je Anbieter
  zurücknimmt und ohne Konto erreichbar ist.
- Die Rechtstexte ziehen nach. Sie behaupten heute wörtlich das Gegenteil.

## Impact

- Betroffene Fähigkeit: `design-system` (die beiden Video-Anforderungen).
- **Eine Anforderung kehrt sich in zwei Klauseln um.** Die heutige Fassung sagt:
  „An activation SHALL apply to exactly one source URL in one rendered
  placeholder […] Persisting it would itself be consent management, which this
  requirement does not establish." Genau diese Entscheidung wird revidiert; die
  Einwilligungsverwaltung, die der Satz ablehnt, wird jetzt aufgebaut — im
  kleinsten Umfang, der die Freigabe trägt und widerruflich hält.
- **Unberührt bleibt der harte Teil des Tores**: ohne Freigabe geht kein Aufruf
  hinaus, kein Vorschaubild vom Anbieter, kein `loading="lazy"` als Ersatz, und
  der Abruf läuft weiter über `youtube-nocookie.com` bzw. mit `dnt=1`.
- **Neue Speicherung auf dem Endgerät.** Ein Wert unter `localStorage` ist eine
  Technologie im Sinne des §25 TTDSG. Er wird in der Cookie-Richtlinie benannt,
  statt still zu entstehen. Er speichert genau eine Entscheidung und keine
  Kennung, und er ist auf derselben Seite widerruflich.
- Keine Migration, keine Rechte, kein Server. Reines Frontend plus vier
  Textstellen.

## Vier Fallen, die dieser Entwurf umgeht

Alle vier folgen daraus, dass eine gemerkte Freigabe den Rahmen **beim
Seitenaufruf** rendert statt nach einem Klick.

1. **`autoplay=1`.** Der Parameter wird heute beim Öffnen angehängt, weil der
   Player sonst pausiert lädt und einen zweiten Klick im fremden Rahmen
   verlangt. Bliebe er bei gemerkter Freigabe stehen, spielten beim
   Seitenaufruf **alle** Videos gleichzeitig los.
2. **`rahmen.current?.focus()`.** Läuft heute beim Öffnen, damit der Fokus nach
   dem Austausch nicht auf `document.body` fällt. Bei gemerkter Freigabe wäre
   dasselbe ein Fokusraub beim Seitenaufruf.
3. **Das zweite Video derselben Seite.** Griffe die Freigabe erst nach einem
   Neuladen, zeigte Video 2 nach dem Klick auf Video 1 weiter ein Tor — und die
   Zusage „einmalig" wäre auf genau der Seite unwahr, auf der sie am meisten
   zählt.
4. **Ein fehlender `localStorage`.** Der Zugriff wirft in abgeschotteten
   Kontexten. Da er beim Rendern geschieht, risse ein ungefangener Fehler die
   ganze Seite auf, statt nur das Merken zu verlieren.
