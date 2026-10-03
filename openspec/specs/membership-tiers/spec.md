# Membership Tiers

## Purpose

Defines the ordered membership levels that gate what a member may see and do
across the FBC community platform. Tier rank is the single numeric authority
that every visibility and capability rule (RLS, UI gating) reads. Reconstructed
from the code as of the OpenSpec migration; supersedes the legacy 3-tier
(Discover/Prime/Legacy) and 7-tier (P4) models described in
`docs/legacy-planning/`.
## Requirements
### Requirement: Six-level tier ladder

The system SHALL define exactly six membership tiers, each with a unique
ascending `level_rank`: `active` (1), `boost` (2), `connect` (3), `discover`
(4), `focus` (5), `impact` (6). Each tier SHALL carry a `label` and an annual
price in EUR (`price_year`): ACTIVE 0, BOOST 0, CONNECT 0, DISCOVER 300,
FOCUS 600, IMPACT 1200.

**Der Club beginnt bei `discover` (Rang 4).** ACTIVE, BOOST und CONNECT werden
technisch vorgehalten und tragen keine Clubfunktion.

**Zwei Schlüssel wechseln ihre Bedeutung, ohne ihren Namen zu wechseln:**
`connect` steht heute auf Rang 2 und danach auf Rang 3, `discover` heute auf
Rang 3 und danach auf Rang 4. Ein Schlüssel allein sagt deshalb nichts mehr
darüber, welche Rechte er trug — nur der Rang tut das, und nur zu einem
genannten Zeitpunkt.

**Die drei Stufen ausserhalb des Clubs tragen 0 €** — ACTIVE, BOOST und
CONNECT (Donald, 25. und 26.09.). Keine von ihnen ist kaufbar; ein Preis, den
niemand zahlen kann, wäre eine Zusage ohne Gegenstand. Die 75 € für BOOST aus
der V5-Matrix und ein Preis für CONNECT kommen später, als eigene Änderung.

Daraus folgt für die Oberfläche: **nur DISCOVER, FOCUS und IMPACT tragen einen
Preis und damit einen Kaufweg.** Eine Preiskarte mit Kaufknopf für eine Stufe
ohne Clubfunktion wäre ein Angebot ohne Gegenstand — derselbe Grund, aus dem
die drei Stufen 0 € tragen.

#### Scenario: Tiers are seeded in rank order

- **WHEN** the database is provisioned
- **THEN** `public.membership_tiers` contains the six keys above with unique
  `level_rank` values 1–6 and the prices listed — die drei Stufen unterhalb des
  Clubs auf 0 €

#### Scenario: A superseded tier key is absent

- **WHEN** any code queries `membership_tiers` for `explore`, `impuls`,
  `active`, `prime`, `circle`, `legacy`, `basic` or `exchange`
- **THEN** no row is returned — `explore`, `impuls`, `prime`, `circle` und
  `legacy` entfielen mit dem Sechs-Stufen-Modell, `basic` und `exchange` mit
  dieser Umstellung. `active` ist **kein** Rückfall auf den alten
  Prototyp-Schlüssel, sondern derselbe Name für den neuen Rang 1

#### Scenario: Ein Schlüssel wird nicht mit einem Rang verwechselt

- **WHEN** `discover` nach der Umstellung gelesen wird
- **THEN** trägt die Zeile `level_rank = 4` und den Preis 300 € — nicht Rang 3
  und nicht 150 €, die derselbe Schlüssel davor trug

### Requirement: Tier rank is the authority for gating

The system SHALL expose the caller's current tier rank through a
`SECURITY DEFINER` function `current_tier_rank()` that returns the `level_rank`
of the authenticated member, and all tier-based access rules SHALL compare
against this rank rather than against tier keys.

#### Scenario: Rank resolves for the authenticated member

- **WHEN** an authenticated member calls `current_tier_rank()`
- **THEN** it returns the `level_rank` of that member's `tier`

#### Scenario: Higher rank satisfies a lower-rank gate

- **WHEN** a resource requires rank ≥ N and the member's rank is M ≥ N
- **THEN** the tier gate permits access

### Requirement: A member holds exactly one tier

The system SHALL constrain `profiles.tier` to a single valid `membership_tiers`
key via foreign key, so a member occupies exactly one tier at a time.

#### Scenario: Invalid tier is rejected

- **WHEN** a write sets `profiles.tier` to a value not present in
  `membership_tiers`
- **THEN** the write is rejected by the foreign-key constraint

### Requirement: Neue Konten starten auf ACTIVE

Das System SHALL jedem neu angelegten Profil die Stufe `active` zuweisen, wenn
keine Stufe ausdrücklich mitgegeben wird. `profiles.tier` SHALL `'active'` als
DEFAULT führen.

ACTIVE liegt **ausserhalb** des Clubs. Ein selbst registriertes Konto erhält
damit keinen Clubzugang, sondern Profil, Einstellungen und die öffentlichen
Flächen — der Zugang entsteht erst, wenn ein Admin die Stufe setzt.

#### Scenario: Eine Neuanlage landet auf ACTIVE

- **WHEN** ein neuer auth-Benutzer entsteht und der Profil-Trigger feuert
- **THEN** trägt die neue `profiles`-Zeile `tier = 'active'`

#### Scenario: ACTIVE sieht das Verzeichnis nicht

- **GIVEN** ein aktiviertes Konto auf `active`
- **WHEN** es `search_directory` aufruft
- **THEN** erhält es ausschliesslich die eigene Zeile

### Requirement: Der Bestand zieht nicht rangtreu um

Das System SHALL beim Wechsel auf die neue Leiter jedes bestehende Konto nach
**Clubzugehörigkeit** zuordnen, nicht nach Rangzahl: `impact` → IMPACT,
`focus` → FOCUS, `connect` · `discover` · `exchange` → DISCOVER, `basic` →
ACTIVE.

Rangtreu umgezogen verlöre ein Konto auf altem `discover` (Rang 3) seinen
Clubzugang, weil der neue Rang 3 CONNECT heisst und ausserhalb liegt. Die
Zuordnung ist deshalb bewusst nicht rangerhaltend: sie hält die
**Mitgliedschaft** konstant, nicht die Zahl.

**Für altes `connect` ist das eine Anhebung, und die ist ausdrücklich
gewollt.** Rangtreu wäre `connect` → CONNECT, denn ein Konto auf altem Rang 2
zahlte nichts und trug keine Clubfunktion im heutigen Sinn. Es trug aber die
Verzeichnisliste — `search_directory` lässt es seit AGE-598 ab Rang 2 ein —,
und diese Liste geht in der neuen Leiter in die Clubstufe DISCOVER auf
(„Liste und erweiterte Spalten tragen dieselbe Schwelle"). Ein Konto, das die
Liste heute sieht, verlöre sie beim rangtreuen Umzug. Die Zuordnung folgt damit
derselben Regel wie überall sonst: **niemand verliert, was er heute hat.** Auf
PROD ist die Kohorte leer (0 Konten, gelesen am 25.09.), die Entscheidung
wirkt also nur auf Umgebungen mit Testdaten — festgeschrieben wird sie
trotzdem, weil eine Regel, die nur zufällig niemanden trifft, keine Regel ist.

Die Zuordnung SHALL vollständig sein — nach der Migration SHALL kein Profil auf
einem Schlüssel stehen, den `membership_tiers` nicht mehr führt.

#### Scenario: Ein Bestandskonto behält seinen Clubzugang

- **GIVEN** ein Konto auf altem `discover` (Rang 3, Clubmitglied)
- **WHEN** die Migration gelaufen ist
- **THEN** steht es auf `discover` **neu** (Rang 4) und liest das
  Mitgliederverzeichnis unverändert weiter

#### Scenario: Kein Profil bleibt auf einem entfallenen Schlüssel zurück

- **WHEN** nach der Migration `profiles` gegen `membership_tiers` geprüft wird
- **THEN** löst jede `profiles.tier` auf genau eine bestehende Zeile auf, und
  der Fremdschlüssel `profiles_tier_fkey` steht unverletzt

#### Scenario: Die Verteilung wird vor und nach der Migration belegt

- **WHEN** die Migration auf eine Umgebung angewendet wird
- **THEN** liegt die Anzahl Konten je Stufe **vor** und **nach** dem Lauf als
  Zahl vor, ohne Namen oder Adressen

### Requirement: Die Oberfläche benennt nur die Clubstufen

Das System SHALL an keiner Fläche, die ein Mitglied erreichen kann, die Namen
`ACTIVE`, `BOOST` oder `CONNECT` zeigen — weder in der Anwendung, noch in der
nativen Hülle, noch im Blog. Genannt SHALL ausschliesslich **DISCOVER, FOCUS
und IMPACT** werden (Donald, 29.09.).

**Die Stufen SHALL NOT gelöscht werden.** `membership_tiers` führt weiterhin
sechs Zeilen, `levels.ts` weiterhin sechs Einträge, und das Gating bleibt
unverändert `has_level(4)`. Die drei kommen später wieder; was hier entfällt,
ist ihre Nennung, nicht ihre Existenz.

**Die Menge der genannten Stufen SHALL eine eigene Festlegung sein und SHALL
NOT aus `CLUB_RANK` abgeleitet werden**, obwohl beide heute dieselbe Menge
ergeben. *Der Grund gehört zur Zusage:* `CLUB_RANK` ist die Zahl, die als
`has_level(4)` auch in den SQL-Policies steht. Würde die Nennung daraus
abgeleitet, müsste ein späteres „BOOST wieder zeigen" sie senken — und dann
liefen **Oberfläche und RLS auseinander**: das Verzeichnis sähe erreichbar aus,
und die Datenbank verweigerte die Antwort. Das Mitglied bekäme einen Fehler
statt einer Absage. Eine Anzeigeentscheidung SHALL diese Kongruenz nicht
antasten.

**Eine Stufe unterhalb des Clubs SHALL NOT durch einen Ersatznamen vertreten
werden.** Wo heute der Stufenname eines Mitglieds steht, SHALL künftig eine
Aussage über den **Zugang** stehen — nicht „Mitglied", nicht „Basis", nicht der
rohe Schlüssel. Ein Ersatzname wäre ein neuer Stufenname und behauptete eine
Zugehörigkeit, die gerade nicht besteht.

**Diese Aussage SHALL die Sackgasse benennen und einen Weg nennen.** Sie ist
der einzige sichtbare Inhalt dieser Änderung, und sie trifft die einzige
Gruppe, die wächst: Selbstregistrierungen landen unterhalb des Clubs, der
Kaufweg ruht, von dort führt kein Weg nach oben. Ein Satz, der das verschweigt,
wäre genau das Verschweigen, das diese Anforderung sonst vermeidet. Sie SHALL
sinngemäss lauten:

> **Dein Konto ist bestätigt.**
> Der Clubzugang beginnt bei Discover. Eine Stufe lässt sich hier zurzeit nicht
> selbst buchen — schreib uns über **Support › Feedback**, dann melden wir uns.

Der Kontaktweg SHALL der bestehende Support-Bereich sein und SHALL NOT eine
Mailadresse im Text sein: der Bereich ist ohne Stufe erreichbar, und eine
Rückmeldung von dort eröffnet ein Gespräch mit der Administration.

**Die Plakette SHALL dort entfallen und SHALL NOT leer erscheinen.** Ein
sichtbarer Kasten ohne Inhalt liest sich als Fehler.

**Aufzählende Flächen SHALL die drei genannten Stufen zeigen.** Das betrifft
die öffentliche Startseite und die Stufenauswahl in der Admin-Einzelbearbeitung.
In der Admin-Auswahl SHALL eine am Konto bereits gesetzte niedrigere Stufe
weiterhin erscheinen — sonst setzte ein Speichern sie stillschweigend hoch;
dieselbe Zusage, die für die Mitgliederliste seit AGE-903 gilt.

**Texte, die eine SCHWELLE benennen, SHALL unverändert bleiben.** Sie nennen
sämtlich `DISCOVER` und sind von dieser Anforderung nicht berührt.

**Die Rechtstexte SHALL keine Stufe nennen, die die Oberfläche verschweigt.**
Die Aufzählung in den AGB SHALL Discover, Focus und Impact führen. Der Text
trägt das: er leitet mit „derzeit insbesondere folgende" ein und behält
ausdrücklich das Recht vor, zusätzliche Stufen einzuführen.

**Eine Zusage SHALL die GERENDERTEN Mitgliederansichten messen und SHALL NOT
das gebaute Bündel durchsuchen.** *Der Grund gehört zur Zusage:* die drei Namen
**müssen** im Bündel bleiben — `levels.ts` behält alle sechs Einträge samt
Labels, die Admin-Einzelbearbeitung braucht den Namen einer gesetzten
niedrigeren Stufe, und die erzeugte Neuigkeitenliste behält ihre Vorkommen
absichtlich. Ein Wächter über dem Artefakt könnte diese drei nicht von einer
echten Fundstelle trennen und wäre ab dem ersten Bau rot oder führte eine
Ausnahmeliste — also wieder die Inventur, die er ersetzen sollte.

Die Zusage SHALL die betroffenen Flächen zweimal rendern — mit einem Konto
unterhalb des Clubs und mit einem darin — und beide Hälften prüfen. Was sie
nicht sieht, SHALL im Testkopf benannt sein: Inhalte, die ein Admin zur
Laufzeit pflegt.

#### Scenario: Kein Mitglied sieht die drei Namen

- **WHEN** ein Mitglied die Anwendung, die native Hülle oder den Blog benutzt
- **THEN** kommen die Wörter Active, Boost und Connect als Stufennamen nirgends
  vor

#### Scenario: Ein Konto unterhalb des Clubs trägt keine Plakette

- **WHEN** ein Mitglied auf einer Stufe unterhalb DISCOVER angezeigt wird — im
  Profil, im Verzeichnis, im Dashboard oder in den Einstellungen
- **THEN** erscheint dort keine Stufenplakette, und an keiner dieser Stellen
  steht ein Ersatzname; wo ein Name stünde, steht eine Aussage über den Zugang

#### Scenario: Ein Konto im Club trägt seine Plakette weiter

- **WHEN** ein Mitglied auf DISCOVER, FOCUS oder IMPACT angezeigt wird
- **THEN** erscheint die Plakette mit dem Namen der Stufe — die Gegenprobe zum
  Fall darüber

#### Scenario: Die öffentliche Startseite zeigt drei Stufen

- **WHEN** jemand ohne Konto die Startseite öffnet
- **THEN** stehen dort DISCOVER, FOCUS und IMPACT, und der Text daneben spricht
  nicht mehr von sechs Stufen

#### Scenario: Die Admin-Auswahl verschweigt keine gesetzte Stufe

- **WHEN** ein Admin ein Konto bearbeitet, das auf einer Stufe unterhalb des
  Clubs steht
- **THEN** bietet die Auswahl DISCOVER, FOCUS und IMPACT **und** die am Konto
  gesetzte Stufe — ein Speichern ohne Absicht hebt sie nicht an

#### Scenario: Die Stufen bestehen weiter

- **WHEN** `membership_tiers` und `levels.ts` gelesen werden
- **THEN** führen beide weiterhin sechs Stufen, und `has_level(4)` entscheidet
  unverändert — verborgen ist die Nennung, nicht die Stufe

#### Scenario: Eine Anzeigeentscheidung bewegt keine Rechtegrenze

- **WHEN** die Menge der genannten Stufen geändert wird
- **THEN** ändert sich `CLUB_RANK` dadurch nicht, und kein Gate schaltet um

#### Scenario: Die Schwellen-Texte bleiben

- **WHEN** eine Fläche sagt, ab welcher Stufe etwas verfügbar ist
- **THEN** nennt sie weiterhin DISCOVER, unverändert

#### Scenario: Die AGB nennen dieselben drei

- **WHEN** ein Mitglied die AGB liest
- **THEN** führt die Aufzählung der Mitgliedschaftsstufen Discover, Focus und
  Impact

#### Scenario: Der Zugangssatz nennt die Sackgasse und einen Weg

- **WHEN** ein Mitglied unterhalb des Clubs seine Mitgliedschaft ansieht
- **THEN** steht dort, dass sich eine Stufe zurzeit nicht selbst buchen lässt,
  und wohin es sich wenden kann — nicht nur, wo der Club beginnt

#### Scenario: Die gerenderten Ansichten werden gemessen, nicht das Bündel

- **WHEN** die betroffenen Flächen mit einem Konto unterhalb des Clubs und mit
  einem darin gerendert werden
- **THEN** trägt die erste keinen der drei Namen und den Zugangssatz, und die
  zweite ihre Plakette — und der Testkopf benennt, was diese Messung nicht
  sieht

### Requirement: Die drei genannten Stufen unterscheiden sich in Rechten

Das System SHALL DISCOVER (Rang 4), FOCUS (Rang 5) und IMPACT (Rang 6) nicht nur
im Namen unterscheiden, sondern in dem, was sie dürfen. Welche Rechte das sind,
SHALL in `public.berechtigungen` stehen und nirgends sonst; die Stufen selbst
SHALL weiterhin nur ihren Rang tragen.

Zum Go-live SHALL die Zuordnung Detlevs SPEC 01 (V5 FINAL, 01.10.2026) folgen:

- **DISCOVER** trägt **kein** Recht aus `berechtigungen`. Was es kann, kann es
  über die Clubschwelle: Feed und Inhalte, Academy ansehen, an Events
  teilnehmen, ein einzelnes Profil lesen, eine Kontaktanfrage senden, mit
  angenommenen Kontakten schreiben.
- **FOCUS** trägt zusätzlich `profil.business`, `organisation.verwalten`,
  `suche_biete`, `vorschlaege`.
- **IMPACT** trägt zusätzlich `verzeichnis.suchen`, `events.erstellen`,
  `community.erstellen`, `projekt.erstellen`, `academy.anbieten`,
  `fbc_format.initiieren`.

Dass DISCOVER kein Recht trägt, SHALL als Aussage gelten und nicht als Lücke:
die Clubschwelle ist die Leistung dieser Stufe, und sie steht nicht in der
Rechtetabelle.

Ein Rechtegewinn SHALL **ohne Neuanmeldung** wirken, weil er wie die Stufe
selbst bei jedem Aufruf aus der Datenbank kommt.

#### Scenario: DISCOVER trägt kein Recht

- **GIVEN** ein aktiviertes Konto auf Rang 4
- **WHEN** es `meine_rechte()` aufruft
- **THEN** kommt ein leeres Array zurück

#### Scenario: FOCUS trägt vier Rechte

- **GIVEN** ein aktiviertes Konto auf Rang 5
- **WHEN** es `meine_rechte()` aufruft
- **THEN** kommen genau vier Schlüssel zurück, und `verzeichnis.suchen` ist
  nicht darunter

#### Scenario: IMPACT trägt alle zehn

- **GIVEN** ein aktiviertes Konto auf Rang 6
- **WHEN** es `meine_rechte()` aufruft
- **THEN** kommen alle zehn Schlüssel zurück

#### Scenario: Eine gesetzte Stufe wirkt ohne Neuanmeldung

- **GIVEN** ein angemeldetes Konto auf Rang 4
- **WHEN** ein Admin seine Stufe auf Rang 6 setzt und das Konto erneut
  `meine_rechte()` aufruft, ohne sich abzumelden
- **THEN** kommen die zehn Schlüssel zurück

