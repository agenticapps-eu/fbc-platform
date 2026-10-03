## MODIFIED Requirements

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

**Berichtigt mit V5F-1 — die Zusage bleibt, ihre Begründung war falsch.** Der
abgelöste Text schloss: „ohne Zugang zum Verzeichnis findet ein Konto unterhalb
der Schwelle keine fremden Profil-IDs." Das gilt für den Weg über das
Verzeichnis und sonst nirgends. Die View läuft mit `security_invoker = off`
**und** trägt das Tabellenrecht `select` für `authenticated`; ein
`select * from profiles_public` ohne Filter liefert damit die vollständige
Mitgliederliste an jedes aktivierte Konto. Dasselbe gilt für die Basistabelle:
`profiles_select_self_or_discover` erlaubt jede fremde Zeile ab Rang 4, auch mit
`is_public = false`. Gemessen am Katalog von PROD am 03.10.2026.

Daraus SHALL folgen, was die Verzeichnisschwelle **nicht** leistet: sie bindet
die Suche, nicht den Rohzugriff. Solange beide Leserechte bestehen, SHALL die
Aussage „ein Konto ohne `verzeichnis.suchen` kann keine Mitgliederliste
beschaffen" NICHT geführt werden. Der Verschluss — Entzug beider Leserechte und
kennungsgebundene Funktionen an ihrer Stelle — SHALL in einem eigenen Change
erfolgen, weil er zwanzig Abfragestellen, die Einbettung
`membership_tiers(level_rank)` und die `update().select()`-Ketten berührt.

**Was dabei NICHT geht, und warum es hier steht:** die View einfach `authenticated`
zu entziehen, ohne Ersatz, schaltet das Verzeichnis für **alle** ab —
`search_directory` ist `SECURITY INVOKER` und liest sie. Der Entzug und sein
Ersatz sind deshalb ein Schritt und nicht zwei.

#### Scenario: Ein Konto unterhalb der Verzeichnisschwelle liest Namen im Feed

- **WHEN** ein aktiviertes Mitglied unterhalb der Verzeichnisschwelle einen
  Beitrag im Feed sieht
- **THEN** trägt der Beitrag den aufgelösten Namen seines Verfassers

#### Scenario: Dasselbe Konto erreicht die Suche dennoch nicht

- **WHEN** dasselbe Mitglied `/mitglieder` aufruft
- **THEN** greift das Rechte-Gate, und `search_directory` gäbe ihm ohnehin nur
  die eigene Zeile

#### Scenario: Der Rohzugriff auf die Sicht hängt an KEINEM Rang

<!-- Berichtigt nach dem Diff-Review: die erste Fassung nannte „ab Rang 4" für
     beide Relationen. Das ist für `profiles` richtig und für `profiles_public`
     zu eng — die Sicht prüft nur die Aktivierung des Aufrufers. Die
     Anforderung oben sagte es schon („ohne Rücksicht auf seine Stufe"), ihr
     Szenario nicht. -->

- **WHEN** ein aktiviertes Mitglied **auf beliebiger Stufe**, auch ausserhalb
  des Clubs, `select` auf `profiles_public` ohne Filter versucht
- **THEN** kommen Zeilen zurück — der Zustand ist benannt, nicht behauptet
  behoben, und sein Verschluss ist ein eigener Change

#### Scenario: Der Rohzugriff auf die Basistabelle hängt an Rang 4

- **WHEN** ein aktiviertes Mitglied ab Rang 4 `select` auf `profiles` ohne
  Filter versucht
- **THEN** kommen fremde Zeilen zurück, einschliesslich der Profile mit
  `is_public = false`

#### Scenario: Unterhalb des Clubs gibt die Basistabelle nur die eigene Zeile

- **WHEN** ein aktiviertes Mitglied auf Rang 3 dasselbe versucht
- **THEN** kommt genau die eigene Zeile zurück — die beiden Relationen sind
  nicht derselbe Fall, und der Verschluss muss beide getrennt behandeln

### Requirement: Liste und erweiterte Spalten tragen dieselbe Schwelle

Das System SHALL die Liste, die Suche **und** die erweiterten Spalten des
Mitgliederverzeichnisses an **eine** Schwelle binden. Es SHALL keine zweite,
niedrigere Schwelle für die Liste geben.

**Geändert mit V5F-1 (SPEC 01 V5 FINAL): die Schwelle ist das Recht
`verzeichnis.suchen`, Mindestrang 6.** Detlev führt „Mitglieder gezielt suchen"
ausdrücklich als Recht allein für IMPACT. Die Zahl SHALL NOT im Rumpf von
`search_directory` stehen, sondern als `min_rank` in `public.berechtigungen`;
das Eintrittstor ruft `darf('verzeichnis.suchen')`.

**Der Einzelabruf eines Profils ist davon getrennt und bleibt bei Rang 4.** Die
Policy `profiles_select_self_or_discover` SHALL weiter `has_level(4)` rufen.
Das ist der eine Punkt, an dem die vorige Fassung ausdrücklich das Gegenteil
verlangte („die Rangzahl 4 an genau einer Stelle je Wirkort — im Eintrittstor
von `search_directory` und in der Policy") — und er fällt bewusst: Entscheidung
E4 des Go-live-Plans hält Kontakt über Kontext offen, also muss ein
Clubmitglied ein Profil lesen können, das es über Feed, Event, Chat oder
Vorschlag erreicht hat, ohne es suchen zu dürfen. Suchen und Lesen sind zwei
Zusagen und tragen ab hier zwei Schwellen.

Als erweiterte Spalten der Verzeichnisantwort SHALL **genau** gelten:
`competencies`, `has_offers`, `has_needs`, `offer_categories` und
`need_categories`. Alle übrigen Spalten SHALL Basisfelder sein. **`branche`
SHALL zu den Basisfeldern gehören** und dafür in `profiles_public` geführt
werden; ohne diese Aufnahme fiele die Spalte still auf NULL und der Filter
`p_branche` liefe wortlos leer.

Die Aufzählung SHALL **vollständig** bleiben. Eine Spalte, die weder als
Basisfeld noch als erweitert benannt ist, ändert ihr Verhalten unbemerkt.

Unterhalb der Schwelle SHALL ein Aufrufer **höchstens die eigene Zeile**
erhalten — nicht eine Liste mit leeren Spalten. Die Maskierung fremder Zeilen
entfällt, weil es fremde Zeilen nicht gibt.

Ein Filter, der auf einer erweiterten Spalte arbeitet (`p_competency`,
`p_offers`, `p_needs`, `p_theme`, `p_offering`), SHALL für einen Aufrufer ohne
das Recht ein leeres Ergebnis liefern; die Oberfläche SHALL solche Filter dort
**gar nicht anbieten**. `p_branche` SHALL NICHT dazugehören.

#### Scenario: Ein Konto ohne das Recht erhält nur die eigene Zeile

- **WHEN** ein aktiviertes Mitglied auf Rang 4 oder 5 `search_directory` ohne
  Filter aufruft
- **THEN** kommt höchstens die eigene Zeile zurück — vor V5F-1 hätte dasselbe
  Konto auf Rang 4 die vollständige Liste mit gefüllten erweiterten Spalten
  erhalten

#### Scenario: Ein Konto mit dem Recht erhält Liste und erweiterte Spalten zugleich

- **WHEN** ein aktiviertes Mitglied auf Rang 6 denselben Aufruf macht
- **THEN** kommen die Basisfelder aller öffentlichen Profile aktivierter
  Eigentümer zurück **und** `competencies`, `offer_categories`,
  `need_categories`, `has_offers`, `has_needs` sind gefüllt

#### Scenario: Es gibt keinen Zustand „Liste ja, Spalten nein"

- **WHEN** ein beliebiger Rang `search_directory` aufruft
- **THEN** erhält er entweder fremde Zeilen **mit** gefüllten erweiterten
  Spalten oder gar keine fremde Zeile — nie fremde Zeilen mit leeren
  erweiterten Spalten

#### Scenario: `branche` bleibt ein Basisfeld

- **WHEN** ein Aufrufer mit dem Recht nach einer Branche filtert
- **THEN** wirkt der Filter, und `branche` ist in der Antwort gefüllt

#### Scenario: Ohne Suchrecht bleibt das Einzelprofil lesbar

- **GIVEN** ein aktiviertes Mitglied auf Rang 4 und die Kennung eines fremden,
  aktivierten Profils, die es aus dem Feed kennt
- **WHEN** es dieses Profil über `/p/:id` abruft
- **THEN** kommt die Zeile zurück — die Verzeichnisschwelle gilt für Liste und
  Suche, nicht für den Einzelabruf

#### Scenario: Die Schwelle steht nicht in der Funktion

- **WHEN** der Rumpf von `search_directory` nach Rangzahlen durchsucht wird
- **THEN** enthält er keine, sondern den Aufruf `darf('verzeichnis.suchen')`

### Requirement: Richer profile fields are gated by membership rank

The system SHALL reserve full profile rows and extended data (beyond the
`profiles_public` subset) for the profile's owner OR a caller with
`level_rank >= 4` (`discover` in the ladder introduced by AGE-903), enforced by
the base-table policy `profiles_select_self_or_discover` (`has_level(4)`).

**Geändert mit V5F-1: diese Schwelle trägt den Einzelabruf, nicht mehr die
Liste.** Rang 4 bleibt die Schwelle vor dem Vollprofil, und `search_directory`
läuft weiter als `SECURITY INVOKER`, erbt sie also. Darüber liegt jetzt eine
zweite, höhere Schwelle: das Eintrittstor der Funktion verlangt
`darf('verzeichnis.suchen')` (Mindestrang 6). Ein Aufrufer auf Rang 4 oder 5
SHALL deshalb durch `search_directory` **höchstens die eigene Zeile** sehen —
nicht weil die Basistabelle ihm nichts gibt, sondern weil das Tor ihn nicht
durchlässt.

**The policy name outlives its number on purpose.** It was minted when
`discover` meant rank 3; it now guards rank 4, which `discover` means after
AGE-903. Renaming it would rewrite six call sites for a cosmetic gain and cost
the trail from the migration that created it. The number in the body is the
authority, never the name.

#### Scenario: Below-Discover caller sees at most their own full row

- **WHEN** a member with `level_rank < 4` invokes `search_directory`
- **THEN** the base-table RLS yields only their own row (no other members' full rows)

#### Scenario: Discover-and-above caller sees the full directory

<!-- Titel zeichengleich zur abgelösten Fassung; der Rumpf nennt jetzt das
     Recht. „Discover-and-above" meint ab V5F-1 nicht mehr „genug für die
     Liste" — Rang 4 trägt das Vollprofil, die Liste trägt Rang 6. -->

- **WHEN** a member holding `verzeichnis.suchen` invokes `search_directory`
- **THEN** all `is_public` members' rows are returned

#### Scenario: Rang 5 sieht das Vollprofil, aber keine Liste

- **GIVEN** ein aktiviertes Mitglied auf Rang 5
- **WHEN** es ein fremdes Vollprofil über `/p/:id` liest und danach
  `search_directory` ohne Filter aufruft
- **THEN** kommt das Vollprofil zurück, und aus dem Verzeichnis höchstens die
  eigene Zeile

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
   gefunden" oder als „Recht fehlt" erscheinen: das verkleidete einen
   Betriebs- oder Anmeldefehler als Such- oder Stufenaussage.
2. **Recht fehlt.** Kommt eine erfolgreiche, **leere** Antwort und fehlt dem
   Aufrufer `verzeichnis.suchen`, SHALL ein Hinweis erscheinen, der die nötige
   Stufe nennt. „Keine Mitglieder gefunden" wäre dort unwahr: es gibt Treffer,
   das Konto darf sie nicht sehen.
3. **Echter Nulltreffer.** Kommt eine erfolgreiche, leere Antwort **mit** dem
   Recht, SHALL eine benannte Meldung samt Weg ins Verzeichnis erscheinen, keine
   leere Liste.

**Geändert mit V5F-1 an zwei Stellen.** Erstens entscheidet nicht mehr ein
Rangvergleich im Client, sondern das Recht `verzeichnis.suchen` aus
`meine_rechte()` — die Oberfläche SHALL keine eigene Rangzahl für diesen
Einstieg führen. Zweitens SHALL der Hinweis **nicht** auf einen Kaufweg führen:
seit AGE-903 ruht Stripe und seit AGE-969 lässt sich eine Stufe hier nicht
selbst buchen. Er SHALL die nötige Stufe nennen und auf den Weg über Support
verweisen.

Das Recht SHALL **ausschließlich** die Formulierung des leeren Falls bestimmen.
Es SHALL NOT die Abfrage unterdrücken und SHALL NOT Treffer verbergen: die
Funktion gibt einem Konto ohne das Recht die **eigene** Zeile zurück, und die
ist ein gültiger Treffer. Ein Gate, das Ergebnisse ausblendet, wäre eine zweite
Zugriffskontrolle im Frontend — Kulisse vor einem Gate, das schon hält.

Ein nicht aktiviertes Konto SHALL über diesen Einstieg nichts finden. Die Sperre
SHALL das bestehende Aktivierungs-Gate bleiben und SHALL NOT in der Oberfläche
nachgebaut werden; der **Nachweis** SHALL an der Datenbank geführt werden.

#### Scenario: Ausgeloggt gibt es kein Suchfeld

- **WHEN** ein ausgeloggter Besucher den Rahmen sieht, in beliebiger Fensterbreite
- **THEN** trägt die Kopfzeile weder ein Suchfeld noch ein Lupensymbol

#### Scenario: Ein Fehler erscheint als Fehler

- **WHEN** die Suchabfrage mit einem Fehler zurückkommt
- **THEN** erscheint ein Fehlerzustand
- **AND** weder eine „nichts gefunden"-Meldung noch ein Stufen-Hinweis

#### Scenario: Ohne das Recht und leer erscheint der Stufen-Hinweis

<!-- Titel geändert: die abgelöste Fassung hiess „Unterhalb discover und leer
     erscheint der Aufstiegs-Hinweis" und band den Fall an einen Rang. Er hängt
     jetzt am Recht, und der Hinweis führt nicht mehr zum Aufstieg, sondern zum
     Support. -->

- **WHEN** ein aktiviertes Mitglied ohne `verzeichnis.suchen` sucht **und** die
  Abfrage erfolgreich keine Zeile liefert
- **THEN** erscheint ein Hinweis, der die nötige Stufe nennt und auf den Weg
  über Support verweist
- **AND** es erscheint keine Meldung, es sei nichts gefunden worden
- **AND** es erscheint kein Kaufknopf

#### Scenario: Ohne das Recht wird die eigene Zeile trotzdem gezeigt

- **WHEN** ein aktiviertes Mitglied ohne `verzeichnis.suchen` nach seinem eigenen
  Namen sucht und die Abfrage seine eigene Zeile liefert
- **THEN** erscheint dieser Treffer normal
- **AND** er wird nicht wegen der Stufe unterdrückt

#### Scenario: Echter Nulltreffer ist formuliert

- **WHEN** ein Mitglied **mit** `verzeichnis.suchen` einen Begriff eingibt, auf
  den kein Profil passt
- **THEN** erscheint eine benannte Meldung samt Weg ins Verzeichnis, keine leere
  Liste

#### Scenario: Ein nicht aktiviertes Konto findet nichts

- **WHEN** ein Konto ohne bestätigte Aktivierung `search_directory` mit einem
  Begriff aufruft, der auf mehrere Profile passt
- **THEN** kommt keine fremde Zeile zurück
