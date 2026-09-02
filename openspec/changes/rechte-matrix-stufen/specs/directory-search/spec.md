## ADDED Requirements

### Requirement: Die Verzeichnisliste hat eine eigene, niedrigere Schwelle als ihre erweiterten Spalten

Das System SHALL die Liste und die Suche des Mitgliederverzeichnisses ab Rang 2
(`connect`) ausliefern und dabei die Rang-3-Grenze für erweiterte Felder
**unangetastet** lassen. Die beiden Schwellen SHALL getrennte Wirkung haben:
eine Absenkung der Listenschwelle SHALL NOT erweiterte Felder freigeben.

Als erweiterte Spalten der Verzeichnisantwort SHALL **genau** gelten:
`competencies`, `has_offers`, `has_needs`, `offer_categories` und
`need_categories`. Sie SHALL einem Aufrufer unterhalb Rang 3 leer statt gefüllt
zurückgegeben werden — nicht als Fehler, nicht als fehlende Zeile.

Alle übrigen Spalten der Antwort SHALL Basisfelder sein und auf jeder Stufe
gefüllt sein, die die Liste sieht. **`branche` SHALL dazugehören** und dafür in
`profiles_public` aufgenommen werden. Ohne diese Aufnahme fiele die Spalte
still auf NULL und der Filter `p_branche` liefe wortlos leer — eine
Verhaltensänderung, die keine Zusage benennt.

Die Aufzählung SHALL **vollständig** sein. Eine Spalte, die weder als Basisfeld
noch als erweitert benannt ist, ändert ihr Verhalten unbemerkt.

Die Maskierung SHALL sich daraus ergeben, dass die erweiterten Spalten
weiterhin aus `public.profiles` unter der bestehenden Policy
`profiles_select_self_or_discover` gelesen werden, während die Basisfelder aus
`profiles_public` kommen. Die Rangzahl `3` SHALL an keiner zweiten Stelle
wiederholt werden: eine Kopie driftet, sobald die Grenze sich ändert.

Ein Filter, der auf einer maskierten Spalte arbeitet (`p_competency`,
`p_offers`, `p_needs`, `p_theme`, `p_offering`), SHALL für einen Aufrufer
unterhalb Rang 3 ein leeres Ergebnis liefern; die Oberfläche SHALL solche
Filter unterhalb Rang 3 **gar nicht anbieten** und stattdessen benennen, ab
welcher Stufe es sie gibt. `p_branche` SHALL NICHT dazugehören — es filtert
nach der Aufnahme in `profiles_public` auf einem Basisfeld.

#### Scenario: Ein connect-Konto erhält die Liste

- **WHEN** ein aktiviertes Mitglied mit Rang 2 (`connect`) `search_directory`
  ohne Filter aufruft
- **THEN** werden die Basisfelder aller öffentlichen Profile aktivierter
  Eigentümer zurückgegeben, nicht nur die eigene Zeile

#### Scenario: Dasselbe connect-Konto erhält die erweiterten Spalten leer

- **WHEN** dasselbe Mitglied dieselbe Antwort liest
- **THEN** sind `competencies`, `offer_categories` und `need_categories` leere
  Arrays und `has_offers`/`has_needs` false — für **fremde** Zeilen, nicht für
  die eigene

#### Scenario: Ein discover-Konto sieht unverändert alles

- **WHEN** ein aktiviertes Mitglied mit Rang 3 (`discover`) denselben Aufruf
  macht
- **THEN** sind dieselben Spalten gefüllt wie vor dieser Änderung — die
  abgesenkte Listenschwelle hat die Rang-3-Grenze nicht mitgenommen

#### Scenario: Ein basic-Konto erhält weiterhin nur die eigene Zeile

- **WHEN** ein aktiviertes Mitglied mit Rang 1 (`basic`) `search_directory`
  aufruft
- **THEN** wird höchstens die eigene Zeile zurückgegeben

#### Scenario: Ein Filter auf einer maskierten Spalte liefert leer

- **WHEN** ein `connect`-Konto nach einer Kompetenz oder einer Biete-/
  Suche-Kategorie filtert
- **THEN** ist das Ergebnis leer, und die Oberfläche nennt die Stufe als Grund
  statt „keine Mitglieder gefunden" zu melden

### Requirement: Der Volltext gibt nicht preis, was die Ausgabe maskiert

Das System SHALL die Volltextsuche des Verzeichnisses an die **Stufe** des
Aufrufers binden, nicht nur an seine Aktivierung. Ein Aufrufer unterhalb Rang 3
SHALL ausschließlich gegen ein Suchdokument aus **Basisfeldern** geprüft werden
(`name`, `company`, `region`, `short_bio`, `branche`); ab Rang 3 SHALL
weiterhin das volle `search_doc` gelten.

Der Grund ist ein **Orakel, kein Lesezugriff**. `search_doc` enthält
`competencies` und `interests`. Die heutige Klausel bindet den Volltext nur an
`is_activated()`. Solange nur Rang 3 die Liste sieht, ist das folgenlos — wer
suchen darf, darf die Felder ohnehin lesen. Mit der abgesenkten Listenschwelle
könnte ein Aufrufer unterhalb Rang 3 die Frage „Hat Mitglied X die Kompetenz
Y?" stellen und die Antwort daran ablesen, **ob die Zeile stehen bleibt**. Er
läse die Spalte nicht; er erführe ihren Inhalt trotzdem.

Diese Zusage SHALL als Fortschreibung derselben Regel gelten, die den **Namen**
bereits schützt: der Volltext SHALL nichts beantworten, was die Ausgabe
verschweigt. Eine Maskierung, die sich über die Suche umgehen lässt, SHALL NOT
als Maskierung gelten.

#### Scenario: Ein connect-Konto findet niemanden über eine Kompetenz

- **WHEN** ein aktiviertes Mitglied mit Rang 2 einen Suchbegriff eingibt, der
  ausschließlich in `competencies` oder `interests` eines fremden Profils
  vorkommt
- **THEN** erscheint dieses Profil **nicht** im Ergebnis

#### Scenario: Dasselbe Konto findet über ein Basisfeld sehr wohl

- **WHEN** dasselbe Mitglied nach einem Firmennamen, einer Region oder einer
  Branche sucht
- **THEN** erscheinen die passenden Profile

#### Scenario: Ab discover findet dieselbe Suche wieder alles

- **WHEN** ein Mitglied ab Rang 3 denselben Kompetenz-Begriff sucht
- **THEN** erscheint das Profil — die Bindung hat die bestehende Suche für
  Berechtigte nicht verengt

### Requirement: `profiles_public` trägt bewusst keine Stufenschwelle

Das System SHALL die Basisfelder aus `profiles_public` weiterhin **jedem
aktivierten Mitglied ohne Rücksicht auf seine Stufe** liefern. Diese View SHALL
NOT hinter die Verzeichnisschwelle gestellt werden.

Das ist eine **Nicht-Zusage, keine Auslassung**: die View trägt an rund fünfzehn
Stellen die Namensauflösung — Feed, Chat, Events, Academy, Verwaltung,
Kontaktanfragen und das Verzeichnis selbst. Eine Stufe darauf verwehrte einem
Konto unterhalb der Schwelle nicht das Verzeichnis, sondern nähme ihm die Namen
in Flächen, die es erreichen darf; es sähe namenlose Beiträge und namenlose
Gesprächspartner.

Der praktische Verlust SHALL als gering gelten und ist benannt: ohne Zugang zum
Verzeichnis findet ein Konto unterhalb der Schwelle keine fremden Profil-IDs.
Es sieht Namen dort, wo sie ihm ohnehin begegnen.

#### Scenario: Ein basic-Konto liest Namen im Feed

- **WHEN** ein aktiviertes Mitglied unterhalb der Verzeichnisschwelle einen
  Beitrag im Feed sieht
- **THEN** trägt der Beitrag den aufgelösten Namen seines Verfassers

#### Scenario: Dasselbe Konto erreicht das Verzeichnis dennoch nicht

- **WHEN** dasselbe Mitglied `/mitglieder` aufruft
- **THEN** greift das Stufen-Gate, und `search_directory` gäbe ihm ohnehin nur
  die eigene Zeile

## MODIFIED Requirements

<!-- Die drei folgenden Anforderungen nennen `discover` als Schwelle für den
     ZUGANG zum Verzeichnis. Nach dieser Änderung ist diese Schwelle `connect`.
     Die Blöcke sind wortgleich übernommen; geändert ist ausschließlich die
     Stufenbezeichnung, an sechzehn Stellen, jede einzeln geprüft. Keine dieser
     Stellen bezeichnete die Grenze für erweiterte Felder — die bleibt Rang 3
     und steht in „Richer profile fields are gated by membership rank", die
     dieser Change NICHT anfasst. -->

### Requirement: Der Suchbegriff geht an das Verzeichnis über

Enter im Suchfeld sowie ein Weg „alle Ergebnisse" SHALL für einen Aufrufer ab
Stufe `connect` auf das Mitgliederverzeichnis führen und den Suchbegriff
**dorthin übernehmen**.

**Unterhalb von `connect` SHALL dieser Weg NICHT ins Verzeichnis führen.**
`/mitglieder` liegt hinter einem Stufen-Gate; die Verzeichnisoberfläche entsteht
dort gar nicht, und der Begriff verschwände in einer Wand. Stattdessen SHALL der
Aufrufer auf die Aufstiegsseite geführt werden.

Die Übernahme SHALL über die **Adresszeile** laufen, damit ein geteilter oder neu
geladener Link dieselbe Suche zeigt. Der Zustand SHALL **einen** Eigentümer
haben, und zwar so:

- Der Sucheinstieg der Kopfzeile SHALL der **einzige Schreiber** des
  Suchparameters sein. Die Verzeichnisoberfläche SHALL beim Tippen **nicht**
  in die Adresszeile zurückschreiben — sonst hallte der Wert ins Feld zurück und
  es wäre zu klären, wem die Entprellung gehört.
- Beim **Aufbau mit gesetztem Parameter** SHALL die Verzeichnisoberfläche ihren
  Suchtext **und** ihren Filterzustand unmittelbar aus dem Parameter beziehen.
  Ein bloßer Nachtrag per Effekt SHALL NOT genügen: dazwischen liefe eine
  **ungefilterte** Abfrage über das ganze Verzeichnis, die aufblitzt und im
  Zwischenspeicher landet.
- Bei einem **späteren** Navigationsereignis SHALL der Parameter den Suchtext
  nachziehen; der weitere Weg zum Filterzustand SHALL der bereits vorhandene
  entprellte bleiben, damit es nur einen gibt.
- Die Übernahme SHALL am **Navigationsereignis** hängen, nicht allein am Wert.
  Wird derselbe Begriff erneut abgeschickt, nachdem im Verzeichnis lokal
  weitergetippt wurde, SHALL die Suche trotzdem auf den abgeschickten Begriff
  zurückspringen.
- Ein Navigationsereignis SHALL einen Verlaufseintrag erzeugen, sodass der
  Zurück-Weg zur vorigen Suche führt.

Die übrigen Filter des Verzeichnisses (Thema, Branche, Region, Kompetenz,
Kompass-Kategorien) SHALL ein Wechsel des Suchbegriffs **nicht** zurücksetzen.

#### Scenario: Enter führt mit Begriff ins Verzeichnis

- **WHEN** ein Mitglied ab `connect` einen Suchbegriff eingibt und Enter drückt
- **THEN** öffnet sich das Mitgliederverzeichnis
- **AND** sein Suchfeld trägt denselben Begriff und seine Liste zeigt dessen
  Treffer

#### Scenario: Beim Aufbau mit Parameter läuft keine ungefilterte Abfrage

- **WHEN** das Verzeichnis mit bereits gesetztem Suchparameter aufgebaut wird
- **THEN** läuft keine Abfrage ohne Suchbegriff
- **AND** die erste Abfrage trägt den Begriff aus der Adresszeile

#### Scenario: Erneute Suche auf dem bereits geöffneten Verzeichnis

- **WHEN** das Verzeichnis geöffnet ist und aus der Kopfzeile ein anderer Begriff
  abgeschickt wird
- **THEN** übernimmt das Verzeichnis den neuen Begriff und zeigt dessen Treffer

#### Scenario: Derselbe Begriff nach lokaler Änderung springt zurück

- **WHEN** im Verzeichnis lokal ein anderer Text eingegeben wurde und aus der
  Kopfzeile derselbe Begriff wie zuvor abgeschickt wird
- **THEN** zeigt das Verzeichnis wieder die Suche zum abgeschickten Begriff

#### Scenario: Ein Wechsel des Begriffs erhält die übrigen Filter

- **WHEN** im Verzeichnis Filter gesetzt sind und aus der Kopfzeile ein neuer
  Begriff abgeschickt wird
- **THEN** bleiben die gesetzten Filter erhalten

#### Scenario: Unterhalb von connect führt Enter auf die Aufstiegsseite

- **WHEN** ein aktiviertes Mitglied unterhalb von `connect` einen Begriff
  eingibt und Enter drückt
- **THEN** öffnet sich die Aufstiegsseite statt des Verzeichnisses

### Requirement: Der Sucheinstieg zeigt sich nur, wem er nützt

Ein Einstieg, der für den Betrachter nichts finden kann, SHALL NOT als
funktionsfähiges Feld erscheinen. Welche Zeilen zurückkommen, entscheidet
unverändert allein die RLS; diese Anforderung regelt, was die Oberfläche daraus
macht.

**Ausgeloggt SHALL das Suchfeld entfallen** — samt Lupensymbol, in jeder
Fensterbreite. `search_directory` ist für `anon` nicht ausführbar; jede Eingabe
liefe in einen Rechtefehler. Eine namenlose Ersatzfassung SHALL NOT an seine
Stelle treten.

Der leere Fall SHALL in **drei** unterscheidbare Zustände zerfallen, und die
Unterscheidung SHALL erst **nach** einer erfolgreichen Antwort getroffen werden:

1. **Fehler.** Schlägt die Abfrage fehl — Netz, abgelaufene Sitzung, `42501` —
   SHALL ein eigener Fehlerzustand erscheinen. Er SHALL NOT als „nichts
   gefunden" oder als „Aufstieg nötig" erscheinen: das verkleidete einen
   Betriebs- oder Anmeldefehler als Such- oder Stufenaussage.
2. **Stufe zu niedrig.** Kommt eine erfolgreiche, **leere** Antwort und liegt der
   eigene Rang unter `connect`, SHALL ein Hinweis erscheinen, der die nötige
   Stufe nennt und zum Aufstieg führt. „Keine Mitglieder gefunden" wäre dort
   unwahr: es gibt Treffer, das Konto darf sie nicht sehen.
3. **Echter Nulltreffer.** Kommt eine erfolgreiche, leere Antwort ab `connect`,
   SHALL eine benannte Meldung samt Weg ins Verzeichnis erscheinen, keine leere
   Liste.

Der eigene Rang SHALL **ausschließlich** die Formulierung des leeren Falls
bestimmen. Er SHALL NOT die Abfrage unterdrücken und SHALL NOT Treffer
verbergen: die Policy gibt einem Konto unterhalb `connect` die **eigene** Zeile
zurück, und die ist ein gültiger Treffer. Ein Rang, der Ergebnisse ausblendet,
wäre eine zweite Zugriffskontrolle im Frontend — Kulisse vor einem Gate, das
schon hält.

Ein nicht aktiviertes Konto SHALL über diesen Einstieg nichts finden. Die Sperre
SHALL das bestehende Aktivierungs-Gate bleiben und SHALL NOT in der Oberfläche
nachgebaut werden; der **Nachweis** SHALL an der Datenbank geführt werden.

#### Scenario: Ausgeloggt gibt es kein Suchfeld

- **WHEN** ein ausgeloggter Besucher den Rahmen sieht, in beliebiger Fensterbreite
- **THEN** trägt die Kopfzeile weder ein Suchfeld noch ein Lupensymbol

#### Scenario: Ein Fehler erscheint als Fehler

- **WHEN** die Suchabfrage mit einem Fehler zurückkommt
- **THEN** erscheint ein Fehlerzustand
- **AND** weder eine „nichts gefunden"-Meldung noch ein Aufstiegs-Hinweis

#### Scenario: Unterhalb connect und leer erscheint der Aufstiegs-Hinweis

- **WHEN** ein aktiviertes Mitglied unterhalb von `connect` sucht **und** die
  Abfrage erfolgreich keine Zeile liefert
- **THEN** erscheint ein Hinweis, der die nötige Stufe nennt und zum Aufstieg
  führt
- **AND** es erscheint keine Meldung, es sei nichts gefunden worden

#### Scenario: Unterhalb connect wird die eigene Zeile trotzdem gezeigt

- **WHEN** ein aktiviertes Mitglied unterhalb von `connect` nach seinem eigenen
  Namen sucht und die Abfrage seine eigene Zeile liefert
- **THEN** erscheint dieser Treffer normal
- **AND** er wird nicht wegen der Stufe unterdrückt

#### Scenario: Echter Nulltreffer ist formuliert

- **WHEN** ein Mitglied ab `connect` einen Begriff eingibt, auf den kein Profil
  passt
- **THEN** erscheint eine benannte Meldung samt Weg ins Verzeichnis, keine leere
  Liste

#### Scenario: Ein nicht aktiviertes Konto findet nichts

- **WHEN** ein Konto ohne bestätigte Aktivierung `search_directory` mit einem
  Begriff aufruft, der auf mehrere Profile passt
- **THEN** kommt keine fremde Zeile zurück

### Requirement: Das Verzeichnis trennt alle Mitglieder von den eigenen Kontakten

Das System SHALL `/mitglieder` in zwei Reiter teilen: „Alle Mitglieder" und
„Meine Kontakte". Beide SHALL **immer** sichtbar sein und je einen Zähler
tragen. Der Reiter „Meine Kontakte" SHALL auch dann stehen, wenn das Mitglied
keinen einzigen Kontakt hat — der Weg soll auffindbar sein, bevor der erste
Kontakt entsteht.

„Immer" heißt: für jeden, der die Fläche überhaupt erreicht. `/mitglieder` ist
über `navItems.minTier` ab `connect` freigegeben, und `search_directory` gäbe
einem Aufrufer darunter ohnehin höchstens die eigene Zeile. Ein Mitglied auf
`basic` SHALL NOT hier bedient werden, obwohl es Kontaktanfragen annehmen und
damit Kontakte haben kann. Das ist eine ausdrückliche **Nicht-Zusage**: diese
Anforderung schafft für `basic` keinen Weg zu seinen Kontakten, und der Reiter
ist kein Ersatz für einen solchen. Wer ihn schaffen will, braucht eine Fläche
unterhalb des Rang-Gates — `/kontakte` trägt kein `minTier` und wäre der Ort.

Das ist ausdrücklich die andere Entscheidung als beim bedingten
Navigationseintrag für offene Anfragen (AGE-592). Der Unterschied ist der
Gegenstand: eine offene Anfrage ist ein **Vorgang**, der kommt und geht, ein
Reiter ist ein **Ort**. Ein Ort, der erscheint und verschwindet, macht die
Navigation unvorhersehbar.

„Meine Kontakte" SHALL die Mitglieder zeigen, mit denen eine **angenommene**
Kontaktanfrage besteht — in beide Richtungen, also unabhängig davon, wer
angefragt hat.

Der Zähler an einem Reiter SHALL dieselbe Menge zählen, die der Reiter zeigt.
Insbesondere SHALL er NICHT die Zahl der angenommenen Anfragen zeigen, wenn die
Liste nur die davon im Verzeichnis sichtbaren Mitglieder enthält: ein Kontakt,
dessen Profil nicht gelistet ist, hat keine Karte, und eine Zahl ohne
zugehörige Karte liest sich als Fehler. Diese Kante ist real, weil die
Sichtbarkeit im Verzeichnis (`is_public`, Rang, Aktivierung) und der Status der
Kontaktanfrage voneinander unabhängig sind.

Suche und Filter SHALL innerhalb des gewählten Reiters wirken, nicht über ihn
hinweg. Wer in „Meine Kontakte" sucht, sucht unter seinen Kontakten.

Der Reiter SHALL fünf Zustände unterscheiden und SHALL NOT sie zu „leer"
zusammenfassen:

1. **lädt** — eine der beiden Abfragen läuft. Es erscheint ein Ladezustand und
   **kein** Zähler. Eine Null, die gleich zu einer Sieben wird, ist eine falsche
   Aussage, kein Ladezustand.
2. **Kontaktabfrage gescheitert** — es erscheint ein Fehlerhinweis. `undefined`
   SHALL NOT als leere Menge gelesen werden: das machte aus einem Fehlschlag
   eine beruhigende Null und wäre genau der stille Fehlschlag, gegen den
   AGE-591/593 gebaut wurden.
3. **keine Kontakte** — eine Einladung zur ersten Kontaktaufnahme. Normalzustand
   für ein neues Mitglied, keine Fehlermeldung.
4. **Kontakte vorhanden, keiner im Verzeichnis sichtbar** — ein eigener Hinweis.
   SHALL NOT die Einladung aus 3 zeigen: das Mitglied hat Kontakte, und es zur
   ersten Kontaktaufnahme aufzufordern wäre schlicht falsch.
5. **Kontakte vorhanden, keiner passt zum Filter** — ein Hinweis auf den Filter.

Suche und Filter SHALL beim Wechsel des Reiters **stehen bleiben**. Ein Wechsel
ändert die Grundmenge, nicht die Frage an sie; ein Filter, der beim Umschalten
verschwindet, zwingt zur Wiedereingabe und liest sich als Fehler. Die Zähler
beider Reiter SHALL dabei die Zahl **unter dem aktuellen Filter** zeigen — sonst
widerspricht der Zähler erneut seiner Liste.

Der Schlüssel, unter dem die Kontaktmenge zwischengespeichert wird, SHALL die
Kennung des Betrachters tragen, und beim Wechsel der Identität SHALL sie
verworfen werden. Ohne das gäbe der geteilte Zwischenspeicher dem zweiten Konto
im selben Browser die Kontaktmenge des ersten. Dieselbe Regel gilt bereits für
die Suchergebnisse („Suchergebnisse überleben keinen Wechsel der Identität").

#### Scenario: Beide Reiter stehen auch ohne Kontakte

- **WHEN** ein Mitglied ab `connect` ohne angenommene Kontaktanfrage
  `/mitglieder` öffnet
- **THEN** stehen beide Reiter da, „Meine Kontakte" mit dem Zähler 0

#### Scenario: Unterhalb von connect gibt es die Fläche gar nicht

- **WHEN** ein Mitglied auf `basic` mit einem angenommenen Kontakt
  `/mitglieder` aufruft
- **THEN** greift das bestehende Rang-Gate der Route, und weder Reiter noch
  Kontaktliste erscheinen — diese Anforderung ändert daran nichts

#### Scenario: Ein angenommener Kontakt erscheint im Reiter

- **WHEN** eine Kontaktanfrage angenommen wurde und das Gegenüber im
  Verzeichnis sichtbar ist
- **THEN** erscheint es unter „Meine Kontakte"

#### Scenario: Die Richtung der Anfrage spielt keine Rolle

- **WHEN** die angenommene Anfrage vom Gegenüber ausging statt vom Betrachter
- **THEN** erscheint es dort ebenso

#### Scenario: Eine abgelehnte oder offene Anfrage erscheint nicht

- **WHEN** eine Kontaktanfrage den Status `pending` oder `declined` trägt
- **THEN** erscheint das Gegenüber nicht unter „Meine Kontakte"

#### Scenario: Der Zähler zählt, was die Liste zeigt

- **WHEN** ein angenommener Kontakt im Verzeichnis nicht sichtbar ist
- **THEN** zeigt der Zähler dieselbe Zahl wie die Menge der dargestellten
  Karten

#### Scenario: Die Suche bleibt im Reiter

- **WHEN** im Reiter „Meine Kontakte" ein Suchbegriff eingegeben wird
- **THEN** werden nur Kontakte des Betrachters durchsucht, keine übrigen
  Mitglieder

#### Scenario: Ein Ladezustand zeigt keinen Zähler

- **WHEN** die Verzeichnis- oder die Kontaktabfrage noch läuft
- **THEN** trägt der Reiter „Meine Kontakte" keine Zahl

#### Scenario: Eine gescheiterte Kontaktabfrage ist keine Null

- **WHEN** die Abfrage der angenommenen Kontaktanfragen fehlschlägt
- **THEN** erscheint ein Fehlerhinweis und nicht „keine Kontakte"

#### Scenario: Kontakte ohne sichtbare Karte bekommen einen eigenen Hinweis

- **WHEN** alle angenommenen Kontakte im Verzeichnis unsichtbar sind
- **THEN** erscheint ein Hinweis darauf und nicht die Einladung zur ersten
  Kontaktaufnahme

#### Scenario: Der Filter bleibt beim Reiterwechsel stehen

- **WHEN** bei gesetztem Suchbegriff der Reiter gewechselt wird
- **THEN** gilt der Suchbegriff weiter, und beide Zähler zeigen die Zahl unter
  diesem Filter

#### Scenario: Der Zwischenspeicher folgt der Identität

- **WHEN** im selben Browser das Konto gewechselt wird
- **THEN** zeigt „Meine Kontakte" nicht die Kontaktmenge des vorigen Kontos

#### Scenario: Das Kartenbild wird eingepasst

- **WHEN** eine Karte ein Cover trägt, dessen Verhältnis von 3:1 abweicht
- **THEN** ist das ganze Bild sichtbar und die Karte behält ihre Höhe

#### Scenario: Der leere Reiter lädt ein

- **WHEN** „Meine Kontakte" ohne einen einzigen Kontakt geöffnet wird
- **THEN** erscheint ein einladender Hinweis und keine Fehlermeldung

