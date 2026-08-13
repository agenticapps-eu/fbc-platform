# Directory & Search

## Purpose

Defines the member directory: the public field projection all members can browse,
the server-side full-text and faceted search, the single visibility flag that
governs whether a member is listed, and the membership-rank gate that controls
access to richer profile data. Visibility is enforced by Postgres RLS, not by the
client. Reconstructed from the code as of the OpenSpec migration.
## Requirements
### Requirement: Server-side directory search with facet filters

The system SHALL provide a `search_directory(...)` RPC that returns a fixed
column set per member (`id`, `name`, `avatar_url`, `region`, `company`,
`short_bio`, `branche`, `tier`, `roles`, `competencies`, `has_offers`,
`has_needs`, `offer_categories`, `need_categories`) with optional full-text
(`p_query`, German `search_doc` tsvector) and facet filters (`p_theme`,
`p_branche`, `p_region`, `p_competency`, `p_offering`, `p_offers`, `p_needs`).
The function SHALL be `SECURITY INVOKER`, so the caller's own RLS decides which
profile rows are returned, and SHALL list only `is_public` members.

`p_offers` and `p_needs` SHALL be `text[]` category filters matching
`offers.category` and `needs.category`. Within one array the categories SHALL be
combined with OR (a member matching any listed category qualifies); the two
arrays SHALL be combined with AND (a member must satisfy both groups when both
are supplied). A null or empty array SHALL mean "no filter" for that group.

`offer_categories` and `need_categories` SHALL carry the caller-visible, distinct,
non-null categories of that member's offers and needs, so the client can render
them without a second round trip. They SHALL NOT replace `has_offers`/`has_needs`:
a row whose `category` is null contributes to the boolean but not to the array, so
the two answer different questions.

Because two `text[]` parameters change the function's argument type list, the
migration SHALL **replace** the function — dropping the previous six-argument
signature explicitly and creating the new one — rather than relying on `create or
replace`, which would register an overload. It SHALL re-issue `revoke`/`grant`
against the new signature, keeping execute limited to `authenticated`.

The category arrays SHALL be built so that a member with no categorised rows
yields an **empty array, never null**: a filtered aggregate over rows whose
`category` is null evaluates to null in Postgres, which is a different value than
the empty array this contract promises and would force every client to handle two
shapes of "nothing".

Returning the categories widens what the directory discloses: it previously
revealed only _that_ a member offers or seeks something, and now reveals _what_ —
commercial intent such as "sucht Investoren". This is deliberate; it is the
feature. It SHALL NOT widen _who_ can see it. The disclosure stays behind exactly
the boundary that already governs the directory — `is_public` plus the base-table
rank gate — and no contact data is disclosed by it, so the platform's rule that
contact details are never released automatically is untouched.

#### Scenario: Full-text query matches the search document

- **WHEN** a caller invokes `search_directory` with `p_query` set
- **THEN** only members whose generated `search_doc` matches
  `websearch_to_tsquery('german', p_query)` are returned, subject to RLS

#### Scenario: Facet filters narrow the result

- **WHEN** a caller passes `p_branche`, `p_region`, `p_competency`, `p_theme`,
  or `p_offering`
- **THEN** results are restricted to members matching each supplied filter
  (a member "active in a theme" via any offer, need, or interest in that theme)

#### Scenario: Categories within one group are combined with OR

- **WHEN** a caller passes `p_offers => array['kapital','mentoring']`
- **THEN** members offering `kapital` **or** `mentoring` are returned

#### Scenario: The two groups are combined with AND

- **WHEN** a caller passes both `p_offers => array['kapital']` and
  `p_needs => array['experten']`
- **THEN** only members who offer `kapital` **and** seek `experten` are returned

#### Scenario: An empty or null category array does not filter

- **WHEN** a caller passes `p_offers => null` or `p_offers => array[]::text[]`
- **THEN** the offer-category filter is not applied and the other filters decide

#### Scenario: The result carries the member's categories

- **WHEN** a member has offers in `kapital` and `kontakte` and a need in `experten`
- **THEN** their row returns `offer_categories = {kapital,kontakte}` and
  `need_categories = {experten}`, each distinct and free of nulls

#### Scenario: A categoryless row still sets the boolean

- **WHEN** a member's only offer row has `category = null`
- **THEN** `has_offers` is true while `offer_categories` is the empty array — not
  null, which is what an unguarded filtered aggregate would return

#### Scenario: A member with no rows at all returns empty arrays

- **WHEN** a member holds neither offers nor needs
- **THEN** `offer_categories` and `need_categories` are both `{}` and neither is null

#### Scenario: Anonymous callers cannot execute the new signature

- **WHEN** an `anon` caller invokes the eight-argument `search_directory`
- **THEN** execution is denied, because the grant was re-issued to `authenticated`
  only and no privilege was inherited by the new signature

#### Scenario: A below-rank caller learns no other member's categories

- **WHEN** a caller below the directory's rank gate filters on `p_offers`
- **THEN** the base-table RLS still yields at most their own row, so neither the
  returned arrays nor the filtered result set reveals another member's categories

#### Scenario: The previous signature is gone, not shadowed

- **WHEN** the migration has run and a caller invokes `search_directory()` with no
  arguments
- **THEN** exactly one function resolves and the call succeeds (no
  "function is not unique" ambiguity from a leftover six-argument overload)

#### Scenario: Opted-out members are never listed

- **WHEN** a member has `is_public = false`
- **THEN** `search_directory` does not return them for any caller

### Requirement: Public field projection is members-only and read-only

The system SHALL expose the directory's public field subset through the
`profiles_public` view (`id`, `name`, `avatar_url`, `region`, `company`,
`short_bio`, `tier`, `roles`) of `is_public` profiles. The view SHALL grant
SELECT to `authenticated` only, deny SELECT to `anon`, and hold no client write
privileges, so no client can mutate the directory.

A session alone SHALL NOT suffice. The view SHALL return rows only to a caller
whose own account is **activated**, and SHALL return only those profiles whose
**owner** is activated. "Every logged-in member can browse the base directory
fields" therefore reads: every logged-in **and activated** member. Because the
view runs with its owner's rights and bypasses the base table's policies, this
condition SHALL sit in the view body itself, not only in the policies behind it.

#### Scenario: Logged-in member browses base directory fields

- **WHEN** an authenticated, activated member selects from `profiles_public`
- **THEN** the public field subset of all `is_public` profiles **whose owner is
  activated** is returned regardless of the member's tier

#### Scenario: Logged-in but unconfirmed member sees no directory

- **WHEN** an authenticated member whose account is not yet activated selects
  from `profiles_public`
- **THEN** no rows are returned

#### Scenario: Anonymous visitor is denied the directory

- **WHEN** an `anon` caller selects from `profiles_public`
- **THEN** no rows are returned

### Requirement: Richer profile fields are gated by membership rank

The system SHALL reserve full profile rows and extended data (beyond the
`profiles_public` subset) for the profile's owner OR a caller with
`level_rank >= 3` (`discover`), enforced by the base-table policy
`profiles_select_self_or_discover` (`has_level(3)`). Because `search_directory`
runs as `SECURITY INVOKER`, a below-Discover or anonymous caller SHALL see at
most their own full row through it.

#### Scenario: Below-Discover caller sees at most their own full row

- **WHEN** a member with `level_rank < 3` invokes `search_directory`
- **THEN** the base-table RLS yields only their own row (no other members' full rows)

#### Scenario: Discover-and-above caller sees the full directory

- **WHEN** a member with `level_rank >= 3` invokes `search_directory`
- **THEN** all `is_public` members' rows are returned

### Requirement: Directory visibility has a single source of truth

The system SHALL govern whether a member appears in the directory solely by
`profiles.is_public`. The former duplicate flag `member_settings.visible_in_directory`
SHALL NOT exist; it was reconciled into `is_public` and dropped, so no second
copy can drift out of sync.

#### Scenario: Toggling visibility uses one flag

- **WHEN** a member changes their directory visibility
- **THEN** the change is written to `profiles.is_public`, which every directory
  path (`profiles_public`, `search_directory`) reads

#### Scenario: The removed duplicate flag is absent

- **WHEN** any code references `member_settings.visible_in_directory`
- **THEN** the column does not exist (it was dropped by the single-source migration)

### Requirement: Author name masking is only partially resolved

Der Kopf dieser Anforderung bleibt wahr und **soll** wahr bleiben: die Maskierung
ist teilweise gelöst. Falsch war, **welcher** Teil gelöst ist, **wie**, und was
in der Zwischenzeit gilt. Diese Fassung sagt alle drei.

**Gelöst — die Verdeckung gegenüber Ausgeloggten, auf zwei Ebenen.** Ein
ausgeloggter Besucher SHALL weder Name noch Avatarbild eines Mitglieds sehen. Die
untere Ebene SHALL die tragende sein:

1. **Daten.** Ohne Session SHALL eine für `anon` gesperrte Relation **gar nicht
   erst angefragt** werden. `profiles_public` und `partners` tragen für `anon`
   kein Leserecht; eine Abfrage käme als `42501` zurück. Die Bedingung SHALL an
   der ohnehin durchgereichten Profil-Kennung hängen, nicht an einer zweiten
   Abfrage des Sitzungszustands.
2. **Anzeige.** `displayAuthor` SHALL ausgeloggt jeden Autor als „Ein Mitglied"
   ohne Avatarbild führen, unabhängig davon, was der Aufrufer übergibt.

Die Anzeige-Ebene SHALL NOT als Sicherheitsgrenze gelten. Die Grenze ist das
fehlende Recht in der Datenbank; die Maskierung sorgt dafür, dass der Ausfall der
Anreicherung wie eine Gestaltungsentscheidung aussieht statt wie ein Fehler.

Diese Verdeckung SHALL sich auf **strukturierte Identitätsfelder** aus Profil-
und Host-Daten beziehen. Selbstverfasste öffentliche Inhalte — Beitragstexte,
Eventbeschreibungen — SHALL ausdrücklich **nicht** erfasst sein: sie können Namen
als gewöhnlichen Text tragen, und nichts prüft das. Wer die Anforderung breiter
liest, hält sie schon heute für gebrochen.

**Nicht gelöst — und dies ist die Lage, die bisher nirgends stand:** Ein
**eingeloggtes, aktiviertes** Konto SHALL heute jeden öffentlichen Mitgliedsnamen
lesen können, **unabhängig von seiner Stufe** — ein frei registriertes `basic`
eingeschlossen. `profiles_public` läuft mit `security_invoker = off`
(`20260612082726_rls_policies.sql:64`) und trägt `grant select … to
authenticated` (`20260715140000_explicit_grants.sql:118`); die Stufen-Policy
`profiles_select_self_or_discover` der Basistabelle wird dort **nicht**
ausgewertet.

Diese Preisgabe SHALL als **derzeit hingenommen und offen** geführt werden, nicht
als abgeschlossen und nicht als Versehen. Es SHALL NOT behauptet werden, die RLS
gattere Namen bereits nach Stufe — das trifft auf **Zeilen** über
`search_directory` zu (`has_level(3)`), nicht auf **Namen** über
`profiles_public`. Wer eine stufenweise Auflösung für redundant hält, hat diese
beiden Wege verwechselt.

Die stufenweise Auflösung SHALL im Change `finish-ui-polish` (AGE-291) geführt
bleiben, der sie in der Datenbank vorsieht. Der Verweis ist Teil der
Anforderung: „ausstehend" ohne Adresse ist der Zustand, aus dem diese Fassung
herausführt.

#### Scenario: Anonymous reader sees a masked author name

- **WHEN** an anonymous caller reads a post whose author's profile row is not
  readable to them
- **THEN** the author renders as a masked label without an avatar
- **AND** this is produced by the display masking, not by a failed query — the
  query is not issued at all

#### Scenario: Tiered name resolution is not yet in effect

- **WHEN** the current behaviour is inspected for graduated, tier-based name
  reveal
- **THEN** none exists — every activated authenticated caller reads every public
  member's full name through `profiles_public`, regardless of tier
- **AND** the pending work is the database-side resolver planned in the
  `finish-ui-polish` change (AGE-291), not an unassigned follow-up

#### Scenario: Ausgeloggt wird die gesperrte Relation nicht angefragt

- **WHEN** ein ausgeloggter Besucher die Startseite, die Aktivitätenseite, die
  Eventliste oder ein einzelnes Event öffnet
- **THEN** wird weder `profiles_public` noch `partners` angefragt
- **AND** die Beiträge und Events erscheinen trotzdem

#### Scenario: Ausgeloggt trägt jeder Autor denselben verdeckten Namen

- **WHEN** ein ausgeloggter Besucher einen Beitrag sieht
- **THEN** heißt der Autor „Ein Mitglied" und trägt kein Avatarbild
- **AND** dieses Ergebnis stammt aus der Maskierung der Anzeige, nicht aus dem
  Fehlschlag einer Abfrage

#### Scenario: Eingeloggt werden Autoren im Feed weiterhin aufgelöst

- **WHEN** ein authentifiziertes, aktiviertes Mitglied den Feed oder die
  Kommentare eines Beitrags öffnet
- **THEN** wird `profiles_public` angefragt
- **AND** Name, Avatarbild und Stufen-Badge des Autors erscheinen

#### Scenario: Eingeloggt werden Event-Hosts beider Arten aufgelöst

- **WHEN** ein authentifiziertes, aktiviertes Mitglied Events öffnet, deren Hosts
  teils Profile und teils Partner sind
- **THEN** werden `profiles_public` **und** `partners` angefragt
- **AND** der Profil-Host trägt Name, Avatarbild und Stufen-Badge, der
  Partner-Host Name und Logo **ohne** Stufen-Badge

#### Scenario: Ein basic-Konto liest heute jeden öffentlichen Namen

- **WHEN** ein aktiviertes Konto der Stufe `basic` `profiles_public` liest
- **THEN** bekommt es die vollen Namen aller öffentlichen, aktivierten Profile
- **AND** dies ist der hingenommene Ist-Zustand, keine Zusicherung für die
  Zukunft und keine Aussage über `search_directory`, das ihm nur die eigene
  Zeile gibt

### Requirement: Der anon-Wächter reicht so weit, wie er reicht

Es SHALL geprüft werden, dass die ausgeloggten Lesepfade ausschließlich
Relationen anfragen, für die `anon` ein Leserecht hält — als **Positivliste**,
nicht als Aufzählung bekannter Verstöße. Eine Prüfung, die einzelne Relationen
namentlich ausschließt, ließe die nächste ungenannte durch; sie verlangt, dass
jemand den Verstoß vorher errät.

Die **Reichweite** dieser Prüfung SHALL benannt sein, weil sie sonst als Zusage
gelesen wird, die sie nicht einlösen kann. Sie erfasst heute:

- nur die Lesepfade, die der Test **selbst aufruft** — eine neue Datei mit
  eigenem Supabase-Aufruf bliebe unbemerkt;
- nur Zugriffe über Relationen. **Aufrufe von Datenbankfunktionen werden nicht
  erfasst**: der Prüfstand hält den Funktionsnamen nicht fest. Eine für `anon`
  ausführbare `SECURITY DEFINER`-Funktion liefe vollständig daran vorbei.

Eine **neue** ausgeloggt erreichbare Fläche SHALL deshalb ihren **eigenen**
negativen Nachweis mitbringen und SHALL NOT sich auf diese Prüfung berufen. Wo
eine Fläche ohne Mitgliedsnamen sinnlos wäre, SHALL sie für Ausgeloggte
entfallen, statt in einer namenlosen Fassung zu erscheinen.

Der Weg über eine neue, für `anon` ausführbare `SECURITY DEFINER`-Funktion SHALL
als eigene Sicherheitsentscheidung behandelt werden und SHALL NOT als
Nebenwirkung eines Oberflächen-Changes entstehen — zumal ihn, wie oben benannt,
keine bestehende Prüfung bemerken würde.

#### Scenario: Ausgeloggt wird nur angefragt, was anon lesen darf

- **WHEN** die vom Prüfstand aufgerufenen ausgeloggten Lesepfade laufen
- **THEN** liegt jede angefragte Relation in der Positivliste der für `anon`
  lesbaren Relationen

#### Scenario: Die Grenze des Wächters ist im Prüfstand benannt

- **WHEN** jemand den Prüfstand liest, um sich auf ihn zu berufen
- **THEN** findet er dort, dass weder nicht aufgerufene Lesepfade noch
  Funktionsaufrufe erfasst sind

#### Scenario: Eine neue anon-Fläche bringt ihren eigenen Nachweis mit

- **WHEN** eine ausgeloggt erreichbare Fläche hinzukommt
- **THEN** trägt ihr Change einen eigenen negativen Nachweis und beruft sich
  nicht allein auf die Positivliste

#### Scenario: Eine Fläche, die Namen bräuchte, entfällt ausgeloggt

- **WHEN** eine Oberfläche für ihren Zweck Mitgliedsnamen zeigen müsste und der
  Besucher nicht angemeldet ist
- **THEN** wird sie nicht gerendert
- **AND** es entsteht keine namenlose Ersatzfassung, deren Ergebnisse niemand
  öffnen kann

