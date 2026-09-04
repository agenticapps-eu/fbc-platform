## MODIFIED Requirements

### Requirement: Der anon-Wächter reicht so weit, wie er reicht

Es SHALL geprüft werden, dass die ausgeloggten Lesepfade ausschließlich
Relationen anfragen, für die `anon` ein Leserecht hält, und ausschließlich
Datenbankfunktionen aufrufen, die `anon` ausführen darf — je als **Positivliste**,
nicht als Aufzählung bekannter Verstöße. Eine Prüfung, die einzelne Namen
namentlich ausschließt, ließe den nächsten ungenannten durch; sie verlangt, dass
jemand den Verstoß vorher errät.

Die **Prüffläche** SHALL aus dem Routentisch **abgeleitet** und SHALL NOT
abgeschrieben werden. Abgeleitet heißt: sie entsteht aus `navItems` — jeder
Eintrag ohne `requiresAuth` und ohne `minTier` — und aus den Routen, die nur in
`App.tsx` stehen. Eine handgepflegte Liste aufgerufener Lesepfade erfasst das
Nächste nicht, was jemand baut; ein abgeleiteter Tisch erfasst es, ohne dass
jemand daran denken muss.

**Jede Registry, aus der Routen entstehen, SHALL selbst Quelle der Prüffläche
sein** und SHALL NOT als Handliste ihrer heutigen Einträge abgeschrieben werden.
Wo `App.tsx` Routen aus einer Liste erzeugt, verändert ein neuer Eintrag dort den
ausgelieferten Routentisch, ohne `App.tsx` oder `navItems` anzufassen; eine
abgeschriebene Fläche bliebe an dieser Stelle grün und die Route ungeprüft.

Der **Rand** dieser Ableitung SHALL selbst zugesichert sein. Eine Route in
`App.tsx`, die weder aus `navItems` oder einer Registry stammt, noch hinter einer
Wache liegt, noch namentlich in der Prüfung geführt wird, SHALL die Prüfung rot
machen. Ohne diese Zusage wäre die abgeleitete Fläche an ihrem Rand wieder eine
Handliste, und dort träte der ursprüngliche Fehler unverändert wieder ein.

Diese Randprüfung SHALL **geschlossen ausfallen**. Sie liest Syntax, nicht
Bedeutung: eine Route, deren Pfad oder deren Wache sie nicht auflösen kann — ein
unbekannter Ausdruck, ein Spread, ein nicht als Wache bekanntes umschließendes
Bauteil — SHALL die Prüfung rot machen und die Stelle nennen, und SHALL NOT als
„unbewacht" oder als „in Ordnung" durchgehen. Ein stiller Durchlässer an dieser
Stelle nähme der ganzen Ableitung ihre Aussage.

Die Prüfung SHALL die Fläche **montieren** statt einzelne Lesefunktionen
aufzurufen. Nur so laufen `AppShell` und `AuthProvider` mit, die ausgeloggt
mitrendern — `ActivationGate` reicht `children` ohne `user` durch — und selbst
Daten abfragen.

Die **verbleibende Reichweite** SHALL benannt sein, weil sie sonst als Zusage
gelesen wird, die sie nicht einlösen kann. Sie erfasst nicht:

- was erst auf **Interaktion** abgefragt wird. Gemessen wird, was das Montieren
  einer Route auslöst; ein Aufruf hinter Klick, Eingabe oder Entprellung läuft
  nur mit, wenn die Prüfung ihn ausdrücklich auslöst.
- den **Rechte-Zustand der Datenbank**. Die Positivlisten sind eine Abschrift der
  Grants, keine Messung an ihnen. Was `anon` tatsächlich darf, sichert
  `supabase/tests/grants_test.sql` zu.
- **Aufrufe von Edge Functions** (`supabase.functions.invoke`). Sie sind eine
  eigene Grenze mit eigener Prüfung des Tokens im Funktionsrumpf und gehen nicht
  über die Grants der Datenbankrolle.

Die Prüfung SHALL als Aussage über die **Absicht des Clients** verstanden werden
und SHALL NOT als Sicherheitsgrenze. Die Grenze bleibt die RLS samt Grants; diese
Prüfung sorgt dafür, dass ausgeloggt gar nicht erst angefragt wird, was ohnehin
mit einem 401 endete.

Eine **neue** ausgeloggt erreichbare Fläche SHALL ihren **eigenen** negativen
Nachweis mitbringen, wo sie Daten hinter einer Interaktion abfragt. Wo eine
Fläche ohne Mitgliedsnamen sinnlos wäre, SHALL sie für Ausgeloggte entfallen,
statt in einer namenlosen Fassung zu erscheinen.

Der Weg über eine neue, für `anon` ausführbare `SECURITY DEFINER`-Funktion SHALL
als eigene Sicherheitsentscheidung behandelt werden und SHALL NOT als
Nebenwirkung eines Oberflächen-Changes entstehen.

**Eine weitere Grenze SHALL benannt sein: ein lokal laufender Test kann eine
Abweichung des Rechte-Zustands zwischen den Instanzen nicht sehen.** Die Default
Privileges der lokalen Instanz sind andere als die der Produktionsinstanz. Eine
Zusage, die lokal grün ist, belegt den Rechte-Zustand der Produktion **nicht**.
Wo eine Anforderung einen Rechte-Zustand zusichert, SHALL der Beleg für die
Produktion aus einer **Messung am Katalog der Produktionsinstanz** stammen, und
diese Messung SHALL im Change mit ihrem Ergebnis festgehalten sein.

#### Scenario: Ausgeloggt wird nur angefragt, was anon lesen darf

- **WHEN** eine ausgeloggt renderbare Route montiert wird
- **THEN** liegt jede angefragte Relation in der Positivliste der für `anon`
  lesbaren Relationen

#### Scenario: Ausgeloggt wird nur aufgerufen, was anon ausführen darf

- **WHEN** eine ausgeloggt renderbare Route montiert wird
- **THEN** liegt jeder aufgerufene Funktionsname in der Positivliste der für
  `anon` ausführbaren Funktionen
- **AND** der Prüfstand hält den Namen fest, statt den Aufruf nur zu beantworten

#### Scenario: Eine neue ausgeloggt erreichbare Seite fällt von selbst hinein

- **WHEN** ein Eintrag ohne `requiresAuth` und ohne `minTier` zu `navItems`
  hinzukommt
- **THEN** prüft der Wächter ihn, ohne dass die Prüfung angefasst wurde

#### Scenario: Eine Route am Rand der Ableitung macht rot

- **WHEN** `App.tsx` eine Route trägt, die weder aus `navItems` oder einer
  Registry stammt noch hinter einer Wache liegt
- **THEN** ist die Prüfung rot, bis die Route namentlich geführt oder hinter eine
  Wache gestellt wird

#### Scenario: Ein neuer Eintrag in einer Routen-Registry fällt von selbst hinein

- **WHEN** eine Registry, aus der `App.tsx` Routen erzeugt, einen Eintrag
  hinzubekommt
- **THEN** ist dessen Route Teil der montierten Fläche, ohne dass die Prüfung
  angefasst wurde

#### Scenario: Eine Route, die der Parser nicht auflösen kann, macht rot

- **WHEN** eine `<Route>` in `App.tsx` eine Form trägt, die die Randprüfung nicht
  kennt — ein unbekannter Pfadausdruck, ein Spread, ein nicht als Wache bekanntes
  umschließendes Bauteil
- **THEN** ist die Prüfung rot und nennt die Stelle
- **AND** die Route gilt nicht stillschweigend als geführt oder als bewacht

#### Scenario: Die Hülle läuft mit unter dem Wächter

- **WHEN** eine ausgeloggt renderbare Route innerhalb der `AppShell` montiert wird
- **THEN** sind die Abfragen von `AppShell` und `AuthProvider` Teil der Messung
- **AND** ein Wegfall ihrer `uid`-Bedingung fällt auf

#### Scenario: Die Grenze des Wächters ist im Prüfstand benannt

- **WHEN** jemand den Prüfstand liest, um sich auf ihn zu berufen
- **THEN** findet er dort, dass weder Aufrufe hinter einer Interaktion noch
  Aufrufe von Edge Functions erfasst sind und dass die Positivlisten eine
  Abschrift der Grants sind, keine Messung an ihnen

#### Scenario: Ein lokal grüner Rechte-Test belegt die Produktion nicht

- **WHEN** eine Zusage über ein Ausführungsrecht lokal grün ist
- **THEN** gilt der Rechte-Zustand der Produktionsinstanz als **unbelegt**, bis er
  dort am Katalog gemessen wurde
- **AND** das Ergebnis dieser Messung steht im Change

#### Scenario: Eine neue anon-Fläche bringt ihren eigenen Nachweis mit

- **WHEN** eine ausgeloggt erreichbare Fläche hinzukommt, die Daten erst auf
  Interaktion abfragt
- **THEN** trägt ihr Change einen eigenen negativen Nachweis und beruft sich
  nicht allein auf die Positivlisten

#### Scenario: Eine Fläche, die Namen bräuchte, entfällt ausgeloggt

- **WHEN** eine Oberfläche für ihren Zweck Mitgliedsnamen zeigen müsste und der
  Besucher nicht angemeldet ist
- **THEN** wird sie nicht gerendert
- **AND** es entsteht keine namenlose Ersatzfassung, deren Ergebnisse niemand
  öffnen kann
