## MODIFIED Requirements

### Requirement: Visibility follows membership tier rank

The system SHALL gate tier-scoped visibility on the caller's numeric tier rank
via `current_tier_rank()` and the derived parametric predicate
`has_level(min_rank)`, so that a member below the required rank cannot read a
higher-tier resource while a member at or above it can. The rank comparison —
not a client flag — SHALL be the deciding factor.

**Korrigiert 2026-08-05.** Der bisherige Text nannte `is_prime_plus()` als
lebendes Prädikat. Die Funktion existiert seit AGE-311 nicht mehr: sie wurde
gedroppt, nachdem alle sieben abhängigen Policies auf `has_level()` umgehängt
worden waren. Gemessen gegen die Datenbank, nicht aus den Migrationen gelesen.

Die Rangprüfung SHALL NOT als alleinige Hürde vor Mitgliederdaten stehen, wo
Konten mit hoher Stufe provisioniert werden, ohne dass ihr Inhaber sich je
ausgewiesen hat. In diesem Fall SHALL das Aktivierungs-Gate zusätzlich greifen.

**Nachgezogen mit AGE-903.** Die tier-abhängige Schwelle vor Mitgliederdaten
liegt seither einheitlich bei **Rang 4**, dem Eintritt in den Club. Vorher
standen zwei Schwellen nebeneinander (Rang 2 für die Verzeichnisliste, Rang 3
für die erweiterten Felder). Ein Beispiel, das eine Stufe beim Namen nennt,
trägt deshalb ab jetzt immer den Rang mit — ein Schlüssel allein sagt nichts
mehr: `discover` bezeichnete vor AGE-903 den Rang 3 und danach den Rang 4.

**Geändert mit V5F-1 (SPEC 01 V5 FINAL, 01.10.2026): Rang 4 ist die Tür, nicht
mehr die ganze Staffelung.** Die Einheitlichkeit von AGE-903 gilt weiter für
das, was sie meinte — den **Eintritt** in den Club: Vollprofil, Profilbeiwerk,
Kontaktanfrage und Event-Teilnahme liegen unverändert bei `has_level(4)`, an
genau einer Zahl. Daneben SHALL es Rechte **oberhalb** der Tür geben, und die
SHALL NOT als Zahl in einer Policy stehen, sondern als Zeile in
`public.berechtigungen`, abgefragt über `darf(schluessel)`.

Damit tragen zwei Mechanismen nebeneinander, und die Zuordnung SHALL eindeutig
sein: `has_level(n)` entscheidet über die Clubschwelle, `darf(schluessel)` über
jedes Recht dahinter. Eine Policy SHALL NOT beide für dieselbe Entscheidung
nennen, und ein Recht SHALL NOT mit `min_rank <= 4` angelegt werden — das wäre
eine Kopie der Türzahl.

#### Scenario: Below-threshold member is excluded from the full directory

- **WHEN** a member below the directory threshold selects another member's full
  `profiles` row (extended fields) or their `offers`/`needs`
- **THEN** the tier-gated policy (via `has_level()`/`current_tier_rank()`)
  returns no row

#### Scenario: At-or-above-threshold member gains access

- **WHEN** an **activated** member at or above the threshold reads the same
  resource
- **THEN** the tier gate permits it (e.g. a member at rank 4 — `discover` in
  the ladder introduced by AGE-903 — reads a full foreign profile and its
  extended interests)

#### Scenario: Eine hohe Stufe ersetzt die Aktivierung nicht

- **GIVEN** ein Konto auf der höchsten Stufe, das nie aktiviert wurde
- **WHEN** es dieselbe Ressource liest
- **THEN** wird sie verweigert — die Stufe öffnet nichts, solange die
  Aktivierung fehlt

#### Scenario: Ein Rang unterhalb des Clubs liest keine fremden Mitgliederdaten

- **GIVEN** ein aktiviertes Konto auf Rang 3 (CONNECT nach AGE-903)
- **WHEN** es ein fremdes Vollprofil, `offers`, `needs`, `profile_interests`,
  `profile_badges` oder `profile_theme_scores` liest
- **THEN** kommt keine Zeile zurück — Rang 3 liegt ausserhalb des Clubs, und
  genau dieser Fall war vor AGE-903 erlaubt

#### Scenario: Ein Recht oberhalb der Tür steht nicht in der Policy

- **WHEN** eine Policy eine Schwelle oberhalb Rang 4 durchsetzt
- **THEN** ruft sie `darf('<schluessel>')` auf, und die Zahl 5 oder 6 steht
  nirgends in ihrem Rumpf

#### Scenario: Die Tür bleibt eine Zahl an einer Stelle

- **WHEN** die Policies gezählt werden, die die Clubschwelle durchsetzen
- **THEN** rufen sie alle `has_level(4)` und keine davon `darf('…')`

### Requirement: Helper predicates are the single authority for gating

The system SHALL centralise every authorization decision in the
server-controlled predicates `current_tier_rank()`, `has_level(int)`,
`darf(text)`, `is_activated()`, `is_matching_manager()`, and `is_admin()`,
sourced from `membership_tiers`/`profiles.tier`, `public.berechtigungen`,
`profiles.activated_at`, `profiles.disabled_at`, `profiles.deleted_at` and
`staff_roles`.

**Geändert mit AGE-581.** `is_activated()` und `is_activated_profile(uuid)`
tragen seither die vollständige Zugangsbedingung — aktiviert, nicht deaktiviert,
nicht gelöscht. Dass sie den alten Namen behalten, ist Absicht: rund vierzig
Policies rufen sie, und diese Policies einzeln umzuhängen hiesse, die Bedingung
vierzigmal neu zu schreiben und vierzig Gelegenheiten zu schaffen, sie falsch zu
schreiben. Der Preis ist ein Name, der weniger sagt, als die Funktion tut, und
er ist im Funktionskommentar auszugleichen.

**Ergänzt mit V5F-1.** `darf(text)` ist hinzugekommen und ist die Hülle, die
einen **Namen** vor eine Rangzahl stellt. Sie ersetzt `has_level()` nicht,
sondern ruft dieselbe Rangquelle: ihr Rumpf ist
`is_activated() and current_tier_rank() >= (select min_rank from
public.berechtigungen where schluessel = p_schluessel)`. Ein unbekannter
Schlüssel SHALL `false` ergeben.

Policies SHALL call these predicates rather than duplicating thresholds, and
elevated standing SHALL never derive from the member-writable `profiles.roles`.

Each predicate SHALL be `SECURITY DEFINER` with a pinned `search_path`, SHALL
return `false` rather than `null` for a caller without a session, and SHALL have
EXECUTE revoked from `public`/`anon`.

**Korrigiert 2026-08-05:** `is_prime_plus()` ist aus dieser Aufzählung
entfernt — die Funktion existiert seit AGE-311 nicht mehr. `has_level(int)` und
`is_activated()` sind an ihre Stelle getreten.

#### Scenario: Elevated standing is not member-forgeable

- **WHEN** a member sets `profiles.roles` to include `'admin'` or
  `'matching_manager'`
- **THEN** `is_admin()`/`is_matching_manager()` still return false, because they
  read `staff_roles`, which the client cannot write

#### Scenario: Tier threshold lives in one predicate

- **WHEN** a tier-gated policy needs a rank threshold
- **THEN** it calls `has_level(n)` (which encapsulates the `current_tier_rank()`
  comparison) rather than re-encoding the rank, so the threshold cannot drift
  between policies

#### Scenario: Ein Feature-Recht hängt an seinem Namen, nicht an seiner Zahl

- **WHEN** der Mindestrang eines Rechts in `public.berechtigungen` geändert wird
- **THEN** wirkt die neue Schwelle an jedem Wirkort dieses Rechts, ohne dass
  eine Policy angefasst wird

#### Scenario: Die Aktivierung ist nicht vom Mitglied setzbar

- **WHEN** ein Mitglied versucht, `profiles.activated_at` selbst zu schreiben
- **THEN** wird das abgelehnt: auf dieser Spalte besteht kein Schreibrecht für
  Client-Rollen; sie wird ausschließlich serverseitig gesetzt

#### Scenario: Die Sperrfelder sind nicht vom Mitglied setzbar

- **WHEN** ein Mitglied versucht, `profiles.disabled_at` oder
  `profiles.deleted_at` selbst zu schreiben
- **THEN** wird das abgelehnt: auf diesen Spalten besteht kein Schreibrecht für
  Client-Rollen, wie auf `activated_at` auch

#### Scenario: Eine neue Policy erbt die vollständige Bedingung

- **WHEN** eine Policy `is_activated()` aufruft, ohne `disabled_at` oder
  `deleted_at` selbst zu nennen
- **THEN** schliesst sie deaktivierte und gelöschte Konten dennoch aus — die
  Bedingung steht im Prädikat, nicht in seinen Aufrufern

#### Scenario: Ein gesperrtes Konto sieht keinen Aktivierungsbildschirm

- **GIVEN** ein Konto, das bestätigt hat und danach deaktiviert wurde
- **WHEN** die Oberfläche seinen Zustand abfragt
- **THEN** erhält sie `activated = true` und `blocked = true`, und sie zeigt
  einen Sperrhinweis — nicht den Aktivierungsbildschirm und nicht die
  Möglichkeit, einen Zugangslink anzufordern

#### Scenario: Der Grund der Sperre bleibt drin

- **GIVEN** zwei gesperrte Konten, eines deaktiviert, eines gelöscht
- **WHEN** beide ihren Zustand abfragen
- **THEN** erhalten beide dieselbe Auskunft — welche Handlung ein Admin
  vorgenommen hat, geht aus ihr nicht hervor

#### Scenario: Die Auskunft bleibt schmal

- **WHEN** die Signatur der Zustandsfunktion untersucht wird
- **THEN** trägt sie genau drei Felder — Aktivierungszustand, Sperrzustand und
  Anzeigename — und kein Profil-, Kontakt- oder Stufendatum
