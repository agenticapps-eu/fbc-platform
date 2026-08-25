## MODIFIED Requirements

### Requirement: Die Profilansicht folgt dem Mockup

Das System SHALL die Ansicht eines Mitgliedsprofils in dieser Ordnung zeigen:
Hintergrundbild, davor überlappend das Profilbild, Name mit Stufen-Badge,
Kurzbeschreibung, Kontakt-Schaltflächen, danach die Abschnitte „Über mich",
„Beruf", „Hobbys", „Ich biete" und „Ich suche", darunter die eigenen
Aktivitäten und zuletzt die Eckdaten (Mitglied seit, Stufe, Standort).

Jeder Abschnitt SHALL eine benannte Quelle haben, damit keiner erfunden wird:

| Abschnitt | Quelle |
|---|---|
| Über mich | `profiles.short_bio` |
| Beruf | `profiles.company`, `branche`, `headline`, `competencies` |
| Hobbys | `profile_interests` |
| Ich biete / Ich suche | `offers` / `needs` (Kompass, C2) |
| Aktivitäten | die Beiträge des Mitglieds aus dem Feed |
| Eckdaten | `profiles.member_since`, `tier`, `region` |

Eine **zweite Kategorienliste** SHALL NOT eingeführt werden.

Die Ansicht SHALL **keinen Erfolgsradar** zeigen. Die Ordnung oben ist damit
nicht abschließend beschrieben: nach den Eckdaten stehen heute Erfolgsradar und
Videos, und nur der erste entfällt. Videos bleiben, wo sie sind. Die Anforderung „Vertagte
Fähigkeiten erscheinen nicht auf dem eigenen Profil" hat die Kompass-Oberflächen
bereits entfernt, aber nur auf der eigenen Seite; dieselbe Begründung gilt
unverändert für die fremde. Ein Betrachter, der eine Oberfläche sieht, die dem
Eigentümer selbst nicht mehr gezeigt wird, sieht eine Fläche, über die niemand
mehr Auskunft geben kann.

Der Wert dieser Anzeige trägt die Begründung zusätzlich: die Themen-Scores
kommen aus `recompute_potential_score`, dessen Primärquelle die
Kompass-Antworten sind. `compass_responses` ist leer, also greift immer der
Ersatzzweig `least(getaggte_zeilen * 2, 10)`. „Erfolgsradar 8.0" heißt damit
„vier Zeilen tragen diesen Themen-Tag" — eine erfundene Zahl über das Mitglied,
genau die Sorte, die AGE-539 und AGE-494 bereits zweimal entfernt haben.

Das Ausblenden SHALL **nicht** an der Leere der Daten hängen, aus demselben
Grund wie dort: eine Umsetzung, die nur bei fehlenden Scores ausblendet, zeigt
die Fläche genau den drei Profilen, die welche haben.

Die Tabelle `profile_theme_scores` und die Berechnung SHALL erhalten bleiben.
Die Abfrage, die die Scores für diese Ansicht holt, SHALL dagegen **mit**
entfallen — sie hat nach der Entfernung keinen Leser mehr, und ein Rundlauf ohne
Leser ist kein „Erhalten", sondern Ballast. Das Zurückholen verlangt damit
Oberfläche **und** Abfrage; „eine Zeile" wäre eine falsche Zusage.

Der Hinweistext für Betrachter unterhalb der Schwelle nennt heute den
Erfolgsradar unter dem, was „ab der Discover-Stufe" sichtbar sei. Er SHALL
mitgeändert werden: eine Fähigkeit zu bewerben, die es nicht mehr gibt, ist ein
falsches Produktversprechen, und es steht ausgerechnet vor denen, die kaufen
sollen.

Zwei bestehende Tests benutzen den Erfolgsradar als **Nachweis** dafür, dass
erweiterte Angaben ab `discover` sichtbar sind. Sie SHALL NOT ersatzlos
gestrichen werden — sonst entfällt mit der Anzeige auch die Zusage über den
Zugriff. Der Nachweis SHALL auf ein anderes erweitertes Feld umgestellt
werden.

Ein Abschnitt ohne Inhalt SHALL entfallen, statt mit erfundenen Daten gefüllt zu
werden — dieselbe Regel, die die eigene Profilansicht bereits trägt.

Die Ansicht SHALL in hellem und dunklem Theme tragen. Fehlt das
Hintergrundbild, SHALL der bestehende Akzent-Verlauf einspringen; die Ansicht
SHALL NOT von einem gesetzten Bild abhängen.

#### Scenario: Ein Profil ohne Hintergrundbild bleibt vollständig

- **WHEN** ein Profil ohne `cover_url` angezeigt wird
- **THEN** erscheint der Akzent-Verlauf, und alle übrigen Abschnitte stehen unverändert

#### Scenario: Angebote und Gesuche stammen aus dem Kompass

- **WHEN** die Abschnitte „Ich biete" und „Ich suche" gefüllt werden
- **THEN** stammen die Einträge aus `offers` und `needs` und aus keiner zweiten Quelle

#### Scenario: Videos bleiben stehen

- **WHEN** ein Profil mit Videos geöffnet wird
- **THEN** erscheint der Video-Abschnitt weiterhin, obwohl der Erfolgsradar
  davor entfallen ist

#### Scenario: Der Hinweis für die eingeschränkte Ansicht nennt den Radar nicht mehr

- **WHEN** ein Betrachter unterhalb der Schwelle den Hinweis auf die
  erweiterten Angaben sieht
- **THEN** ist der Erfolgsradar dort nicht als Leistung genannt

#### Scenario: Die fremde Profilansicht zeigt keinen Erfolgsradar

- **WHEN** ein Profil **mit** gesetzten Themen-Scores von einem anderen Mitglied
  geöffnet wird
- **THEN** erscheint kein Erfolgsradar

#### Scenario: Ein leerer Abschnitt verschwindet

- **WHEN** ein Mitglied keine Interessen gepflegt hat
- **THEN** fehlt der Abschnitt „Hobbys", statt einen Platzhalter zu zeigen

## ADDED Requirements

### Requirement: „Ich biete" und „Ich suche" trennen Kategorie von Fließtext

Das System SHALL die Einträge aus `offers` und `needs` nach ihrer Bauart
darstellen, statt beide Sorten in dieselbe Zeilenform zu zwingen.

Unterschieden SHALL nach der Spalte **`source`** werden (`chip` oder `editor`),
nicht nach `category`. `source` benennt, welche Oberfläche die Zeile angelegt
hat, und ist damit die Aussage über die Bauart; `category` ist ein Feld, das der
Editor ebenfalls setzen darf. Heute fallen beide zusammen — gemessen über alle
112 Zeilen auf PROD: `chip` 19-mal, alle mit Kategorie, **keine** mit
Beschreibung; `editor` 93-mal, **keine** mit Kategorie, alle mit Beschreibung.
Diese Deckung ist ein **Momentzustand des Bestands, keine Invariante**: sobald
jemand im Editor eine Kategorie wählt, entsteht eine Zeile mit Kategorie *und*
Beschreibung, und eine Umsetzung, die auf `category` prüft, zeigte deren Text
nicht mehr an.

Wie beweglich dieser Zustand ist, hat sich beim Messen selbst gezeigt: zwischen
zwei Lesungen im Abstand von 23 Minuten wuchs der Bestand von 112 auf 117
Zeilen und die Marken von 19 auf 24. Keine Zahl in diesem Abschnitt ist eine
Zusage; sie tragen die Begründung, nicht die Regel.

**Jede Zeile mit bekannter Kategorie** SHALL eine Marke in einer gemeinsamen,
umlaufenden Reihe bekommen, mit dem lesbaren Namen der Kategorie. Der rohe
Schlüssel (`know_how`) SHALL NOT erscheinen — heute steht er als Marke neben
seinem eigenen Klartext, was jede Zeile doppelt.

Die Marke SHALL **nicht** an `source` hängen. Der reiche Editor unter
`/kompass` → „Suche & Biete" verlangt für jede Zeile eine Kategorie aus der
bekannten Liste, und `source` überlebt den Speicherlauf: sobald ein Mitglied
sein Such-/Bieteprofil dort einmal speichert, trägt **jede** seiner Zeilen eine
Kategorie, auch die mit `source = 'editor'`. Eine Markenreihe, die nur
`chip`-Zeilen betrachtet, verschwiege sie.

Ein `title` SHALL entfallen, wo er nur wiederholt, was ohnehin schon dasteht —
und zwar nach **zwei** Regeln, die dieselbe Begründung haben:

1. Er ist der **Klartext seiner eigenen Kategorie**. Über alle Profile trägt
   heute jede Kategorie genau einen einzigen Titel-Wert, und dieser ist exakt
   der Kategoriename; die Marke *ist* dann der Inhalt.
2. Er ist der **Anfang seiner Beschreibung** (Regel unten).

Er SHALL NOT allein deshalb entfallen, weil die Zeile `source = 'chip'` trägt.
Der Editor stellt für **jede** Zeile ein Pflichtfeld „Titel" — ein Mitglied kann
also den Chip „Kapital" wählen und ihn anschließend auf „Eigenkapital bis 500k"
ändern, ohne dass die Zeile aufhört, `chip` zu sein. Eine Umsetzung, die den
Titel an `source` festmacht, löschte diesen Satz von der Seite, während das
Formular ihn weiter anzeigt.

Trägt eine solche Zeile eine Beschreibung, SHALL diese unter der Markenreihe
erscheinen statt verloren zu gehen.

Für eine Kategorie ohne hinterlegten Klartext SHALL die Marke **entfallen**
statt den Schlüssel zu zeigen. Der vorhandene Helfer fällt auf eine
großgeschriebene Fassung des Schlüssels zurück (`future_key` → `Future_key`) und
hielte die Zusage „kein roher Schlüssel" damit nicht ein.

**Einträge aus dem Editor** (`source = 'editor'`) SHALL als Text erscheinen, mit
erhaltenen Zeilenumbrüchen. Ihr `title` SHALL entfallen, wenn er nur der Anfang
der Beschreibung ist. Der Vergleich SHALL **nach** dem Entfernen der
Aufzählungszeichen und nach dem Trimmen erfolgen, gegen die erste nichtleere
Zeile der Beschreibung, und SHALL einen vom Import gekürzten Titel als Treffer
werten. Er SHALL erscheinen, wo er eigenständig ist.

Wie der Import kürzt, ist **gemessen und nicht geraten** — die erste Fassung
dieser Anforderung hatte es falsch. Sie nahm an, bei 80 Zeichen werde mitten im
Wort gekappt, und verlangte deshalb einen unscharfen Vergleich bis zur letzten
Wortgrenze. Gemessen über alle 93 Editor-Zeilen auf PROD (25.08.,
`scripts/probe-age597-kompass-bestand.ts`) trifft das nicht zu: die drei Titel
mit exakt 80 Zeichen enden auf **U+2026** („…"), und die Beschreibung trägt an
genau dieser Stelle ein Leerzeichen — gekappt wird an der Wortgrenze, und das
Auslassungszeichen ist das Merkmal. Der Vergleich SHALL deshalb ein
abschließendes Auslassungszeichen abschneiden und danach wörtlich vergleichen.

Die unscharfe Wortgrenzen-Regel SHALL NOT verwendet werden. Sie fasst gemessen
**81** statt 61 Zeilen und verwürfe damit 20 Titel, die mit ihrer Beschreibung
nur die ersten Worte teilen — genau die Sorte, die diese Anforderung erhalten
will.

Was die scharfe Regel über den Bestand aussagt: **58** Titel sind wörtliche
Präfixe, **35** sind mit Auslassungszeichen gekürzte Präfixe, zusammen **alle
93**. Im heutigen Bestand überlebt kein einziger Editor-Titel — die Annahme des
Proposals, vier Zeilen trügen einen Titel ohne Bezug zur Beschreibung, ist
damit widerlegt. Das ist wieder ein **Momentzustand**: der Editor kann jederzeit
einen eigenständigen Titel anlegen, und die Regel erhält ihn dann.

Führende Aufzählungszeichen aus dem Altbestand — insbesondere die Folge
Apostroph-Bindestrich am Zeilenanfang, 13-mal vorhanden — SHALL beim Darstellen
entfernt werden. Die gespeicherten Werte SHALL NOT verändert werden: es sind
Inhalte der Mitglieder, und ein Schreibzugriff ohne deren Zutun wäre ein
Eingriff, den die Anzeige nicht rechtfertigt.

Die Darstellung SHALL über den **gesamten** Bestand tragen, nicht an einem
Beispiel geprüft werden. Die Ausreißer sind gemessen und benannt: eine
Beschreibung von 1048 Zeichen (vier über 500), 35 Titel mit Auslassungszeichen,
davon drei bei exakt 80 Zeichen, und **elf** Marken auf einem einzigen Profil —
die sich allerdings auf beide Abschnitte verteilen, sodass **eine Reihe**
höchstens **sechs** trägt. Über alle 97 gefüllten Abschnitte bleibt nach beiden
Regeln **kein** Abschnitt leer, und keiner trägt mehr als einen Textblock.

#### Scenario: Ein kategorisierter Eintrag wird zur Marke

- **WHEN** ein Eintrag eine `category` trägt
- **THEN** erscheint eine Marke mit dem lesbaren Kategorienamen
- **AND** weder der rohe Schlüssel noch der `title` erscheinen daneben

#### Scenario: Eine Marken-Zeile mit Beschreibung verliert sie nicht

- **WHEN** ein Eintrag mit `source = 'chip'` **und** einer Beschreibung
  dargestellt wird
- **THEN** erscheint die Marke, und die Beschreibung erscheint unter der
  Markenreihe

#### Scenario: Ein selbst geschriebener Titel auf einer Marken-Zeile bleibt

- **WHEN** eine Zeile mit `source = 'chip'` einen `title` trägt, der nicht der
  Klartext ihrer Kategorie ist
- **THEN** erscheint die Marke **und** der Titel

#### Scenario: Eine Editor-Zeile mit Kategorie bekommt ihre Marke

- **WHEN** eine Zeile mit `source = 'editor'` eine bekannte `category` trägt
- **THEN** erscheint deren Marke in der Reihe
- **AND** ihre Beschreibung erscheint unverändert darunter

#### Scenario: Eine unbekannte Kategorie zeigt keinen rohen Schlüssel

- **WHEN** ein Eintrag eine `category` trägt, für die kein Klartext hinterlegt
  ist
- **THEN** erscheint keine Marke — insbesondere nicht der großgeschriebene
  Schlüssel

#### Scenario: Mehrere Kategorien stehen in einer Reihe

- **WHEN** ein Abschnitt sechs kategorisierte Einträge trägt — der gemessene
  Höchstwert je Reihe; auf einem Profil sind es über beide Abschnitte elf
- **THEN** stehen sie als Marken in einer umlaufenden Reihe und nicht als sechs
  Kästen untereinander

#### Scenario: Ein Freitext-Eintrag zeigt seinen Text

- **WHEN** ein Eintrag keine `category` und eine mehrzeilige Beschreibung trägt
- **THEN** erscheint die Beschreibung mit ihren Zeilenumbrüchen

#### Scenario: Ein Titel, der die Beschreibung wiederholt, entfällt

- **WHEN** der `title` eines Freitext-Eintrags der Anfang seiner Beschreibung ist
- **THEN** erscheint er nicht zusätzlich über ihr

#### Scenario: Ein vom Import gekürzter Titel entfällt ebenfalls

- **WHEN** der `title` mit einem Auslassungszeichen endet und ohne dieses der
  Anfang der Beschreibung ist
- **THEN** erscheint er nicht zusätzlich über ihr

#### Scenario: Ein eigenständiger Titel bleibt

- **WHEN** der `title` kein Anfang der Beschreibung ist
- **THEN** erscheint er als Überschrift des Eintrags

#### Scenario: Import-Aufzählungszeichen verschwinden aus der Anzeige

- **WHEN** ein Titel oder eine Beschreibung mit Apostroph und Bindestrich beginnt
- **THEN** erscheint die Zeile ohne diese Zeichen
- **AND** der gespeicherte Wert bleibt unverändert

#### Scenario: Ein Abschnitt, von dem nichts übrig bleibt, verschwindet ganz

- **WHEN** die einzige Zeile eines Abschnitts eine unbekannte Kategorie und
  keine Beschreibung trägt, sodass weder Marke noch Text entstehen
- **THEN** fehlt die ganze Karte samt Überschrift, statt als Überschrift über
  nichts zu erscheinen

#### Scenario: Ein sehr langer Eintrag sprengt die Karte nicht

- **WHEN** eine Beschreibung 1048 Zeichen lang ist
- **THEN** bleibt sie innerhalb ihres Abschnitts lesbar umbrochen
