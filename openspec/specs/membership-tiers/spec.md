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

