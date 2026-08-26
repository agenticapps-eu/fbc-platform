## ADDED Requirements

### Requirement: Keine Seite laesst sich seitlich schieben

Die Anwendung SHALL ab einer Fensterbreite von **320 px** ohne waagerechtes
Schieben bedienbar sein.

Die Zusage SHALL **nicht allein** an `documentElement.scrollWidth > clientWidth`
gemessen werden. Dieser Wert uebersieht Inhaltsueberlauf, der von einem
Vorfahren beschnitten wird, und in der Geraete-Emulation waechst die
Vergleichsgroesse mit dem Fehler mit. Gemessen SHALL **je Element** werden:
sein rechter Rand gegen `documentElement.clientWidth`, und sein eigener
`scrollWidth − clientWidth`. Elemente mit `position: fixed` und `.sr-only`
SHALL dabei ausgenommen sein — beide sind absichtlich vom Fluss geloest und
melden sich sonst auf jeder Route.

320 px SHALL als **Mindestbreite** festgeschrieben sein — darunter wird nicht
unterstuetzt. Ohne eine benannte Zahl ist „laeuft ueber" keine pruefbare
Aussage, sondern eine Meinung ueber ein Geraet.

**`overflow-x: hidden` oder `clip` auf einem Seitencontainer SHALL NOT als
Erfuellung gelten.** Beides versteckt den Ueberlauf und schneidet dabei Inhalt
ab, den niemand mehr erreichen kann. Die Zusage lautet, dass nichts ueberlaeuft,
nicht dass man es nicht sieht.

Ein Bereich, dessen Inhalt bei dieser Breite **nicht** sinnvoll umbrechen kann —
eine Tabelle mit mehreren Datenspalten —, SHALL einen **eigenen** waagerecht
scrollbaren Rahmen bekommen. Der Rahmen SHALL die Seite selbst unverschoben
lassen.

#### Scenario: Die eingeloggte Startseite bei 320 px

- **WHEN** die Startseite bei einer Fensterbreite von 320 px dargestellt wird
- **THEN** ist `documentElement.scrollWidth` gleich `clientWidth`
- **AND** keine Karte ragt ueber den rechten Rand des Fensters hinaus

#### Scenario: Das Verzeichnis bei 320 px

- **WHEN** das Mitgliederverzeichnis bei 320 px dargestellt wird
- **THEN** laesst sich die Seite nicht seitlich schieben, obwohl die Karten
  Namen tragen, die laenger sind als die verfuegbare Breite

#### Scenario: Ein Bereich, der nicht umbrechen kann, scrollt fuer sich

- **WHEN** die Mitgliederliste der Administration bei 320 px dargestellt wird
- **THEN** ist ihre Tabelle in einem eigenen waagerecht scrollbaren Rahmen
  erreichbar
- **AND** die Seite selbst laesst sich nicht schieben
- **AND** der Rahmen scrollt tatsaechlich — die Tabelle ist breiter als er, und
  jede Spalte ist durch Schieben erreichbar

### Requirement: Geteilte Layout-Bausteine schrumpfen unter ihren Inhalt

Ein wiederverwendbarer Baustein, der als Kind eines Rasters oder einer Flexbox
eingesetzt wird — die Karte und der Wrapper des gestaffelten Listen-Reveals —,
SHALL `min-width: 0` tragen.

Der Grund SHALL mitgefuehrt werden, weil die Regel ohne ihn wie Kosmetik
aussieht: Flex- und Grid-Kinder stehen per Voreinstellung auf `min-width: auto`
und schrumpfen **nicht** unter ihren Inhalt. Traegt ein Nachfahre
`white-space: nowrap` — was `truncate` setzt —, fordert er seine volle
Textbreite, und der Baustein waechst mit. **Kuerzender Text ohne diese
Einengung bewirkt das Gegenteil dessen, wonach er benannt ist:** er kuerzt
nicht, er drueckt auf.

Die Zusage SHALL am **Baustein** haengen und nicht an seinen Aufrufstellen. Eine
Regel, die jede Aufrufstelle einzeln verpflichtet, ist an genau der Stelle
verletzbar, an der niemand hinsieht — und sie ist von aussen nicht pruefbar,
weil zwischen kuerzendem Text und Rasterkind regelmaessig eine Komponentengrenze
liegt.

`line-clamp-*` SHALL ausdruecklich **nicht** erfasst sein. Es bricht um und
setzt kein `nowrap`; es kann waagerecht nicht druecken. Es mitzuzaehlen
erweiterte die Regel ueber ihre Begruendung hinaus.

#### Scenario: Eine Karte mit kuerzendem Text bleibt in ihrer Spalte

- **GIVEN** eine Karte in einem Raster, die eine Zeile mit kuerzendem Text traegt
- **WHEN** der Text laenger ist als die Spalte breit
- **THEN** bleibt die Karte so breit wie ihre Spalte
- **AND** der Text wird gekuerzt dargestellt

#### Scenario: Breite Fenster bleiben unveraendert

- **WHEN** dieselben Flaechen bei 1440 px dargestellt werden
- **THEN** loesen Rasterspuren und Kartenbreiten auf wie zuvor
- **AND** die bestehende Zusage, dass das Dashboard seine Spalten bekommt,
  gilt unveraendert weiter — `min-width: 0` senkt nur den Boden und ist
  oberhalb der Spurbreite wirkungslos

#### Scenario: Der Baustein traegt es, nicht die Aufrufstelle

- **WHEN** eine neue Flaeche die Karte in ein Raster stellt, ohne selbst etwas
  zu setzen
- **THEN** bleibt die Karte in ihrer Spalte

### Requirement: Feste Spaltenbreiten gelten erst ab einem Breakpoint

Ein Raster mit einer festen Spaltenbreite SHALL diese Breite **nur** oberhalb
eines Breakpoints setzen. Unterhalb SHALL der Inhalt einspaltig stapeln.

Der Pruefstein SHALL nicht der Ueberlauf sein, sondern die **Benutzbarkeit der
schmalsten Spalte**: bei 320 px loesten die beiden vorhandenen Raster zu
`160px 26px 91px` und `160px 26px 80px 91px` auf. Die 26 px sind ein
Eingabefeld. Es ist unbedienbar, noch bevor die Zeile ueberlaeuft — ein Raster,
das erst beim Ueberlauf auffaellt, war lange vorher schon kaputt.

#### Scenario: Eine Formularzeile bei 320 px

- **WHEN** eine Zeile mit fester erster Spalte bei 320 px dargestellt wird
- **THEN** stapeln ihre Felder untereinander
- **AND** jedes Eingabefeld ist mindestens **200 px** breit — bei 320 px
  Fensterbreite bleiben nach Seiten- und Kartenrand rund 240 px, ein gestapeltes
  Feld nutzt sie also nahezu ganz. Die heutige Auflösung zu **26 px** verfehlt
  das um eine Groessenordnung, und „lesbar" ohne Zahl ist nicht abnehmbar.

#### Scenario: Der Waechter faengt eine neue feste Spalte

- **WHEN** eine Rasterdefinition mit fester Breite ohne Breakpoint-Praefix
  hinzugefuegt wird
- **THEN** schlaegt der Testlauf fehl und benennt Datei und Zeile
