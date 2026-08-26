## MODIFIED Requirements

### Requirement: Server-side directory search with facet filters

The system SHALL provide a `search_directory(...)` RPC that returns a fixed
column set per member (`id`, `name`, `avatar_url`, `cover_url`, `region`, `company`,
`short_bio`, `branche`, `tier`, `roles`, `competencies`, `has_offers`,
`has_needs`, `offer_categories`, `need_categories`) with optional full-text
(`p_query`, German `search_doc` tsvector) and facet filters (`p_theme`,
`p_branche`, `p_region`, `p_competency`, `p_offering`, `p_offers`, `p_needs`).
The function SHALL be `SECURITY INVOKER`, so the caller's own RLS decides which
profile rows are returned, and SHALL list only `is_public` members.

Das Ausführungsrecht SHALL `authenticated` allein halten und SHALL **namentlich**
entzogen werden — `from public, anon` —, nicht allein über `public`. Ein Entzug
von `public` entfernt einen rollen-eigenen Grant nicht, und die Default
Privileges einer Supabase-Instanz können `anon` ein solches Recht ausdrücklich
erteilen. Wo das zutrifft, ist die Funktion für `anon` ausführbar, obwohl die
Migration das Gegenteil auszusprechen scheint.

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

`cover_url` SHALL stand in that column set so a result card can carry the
member's cover without a second round trip. Adding it changes the function's
**return type**, and `create or replace function` cannot change a return type —
Postgres rejects it with `42P13`. The migration SHALL therefore drop and create
again, for a second and different reason than the argument list above: the two
constraints are independent, and a later change that only widens the returned
columns would hit this one alone.

Widening the projection by `cover_url` SHALL NOT widen who may see it. The
column already stands in the public profile projection and is visible on every
public profile page; the directory discloses nothing here that the profile does
not disclose already, and the same `is_public` plus rank gate governs both.

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
- **THEN** only members whose generated `search_doc` matches the query built by
  `suchbegriff_zu_tsquery(p_query)` are returned, subject to RLS — the
  prefix-capable helper introduced on 2026-08-17, not `websearch_to_tsquery`,
  which cannot match a prefix

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

- **WHEN** der Rechte-Zustand der acht-argumentigen `search_directory` gelesen wird
- **THEN** hält `anon` **kein** `EXECUTE` — geprüft am Privilegien-Bit des Katalogs,
  nicht an der Fehlermeldung eines Aufrufs
- **AND** `authenticated` hält es weiterhin

> Die frühere Begründung dieses Szenarios — „kein Recht wurde auf die neue
> Signatur vererbt" — war **nachweislich falsch**: genau das war geschehen, und
> weil die Zusage eine Fehlermeldung statt des Zustands verglich, blieb sie lokal
> grün, während `anon` die Funktion in der Produktion ausführen durfte.

#### Scenario: A below-rank caller learns no other member's categories

- **WHEN** a caller below the directory's rank gate filters on `p_offers`
- **THEN** the base-table RLS still yields at most their own row, so neither the
  returned arrays nor the filtered result set reveals another member's categories

#### Scenario: The previous signature is gone, not shadowed

- **WHEN** the migration has run and a caller invokes `search_directory()` with no
  arguments
- **THEN** exactly one function resolves and the call succeeds (no
  "function is not unique" ambiguity from a leftover six-argument overload)

#### Scenario: The result carries the member's cover

- **WHEN** a member has `cover_url` set and is returned by `search_directory`
- **THEN** their row carries that value, so the card renders the cover without a
  second query

#### Scenario: A member without a cover returns null, not an error

- **WHEN** a member has never set a cover
- **THEN** `cover_url` is null in their row and the call succeeds

#### Scenario: Opted-out members are never listed

- **WHEN** a member has `is_public = false`
- **THEN** `search_directory` does not return them for any caller

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

**Eine dritte Grenze SHALL benannt sein: ein lokal laufender Test kann eine
Abweichung des Rechte-Zustands zwischen den Instanzen nicht sehen.** Die Default
Privileges der lokalen Instanz sind andere als die der Produktionsinstanz. Eine
Zusage, die lokal grün ist, belegt den Rechte-Zustand der Produktion **nicht**.
Wo eine Anforderung einen Rechte-Zustand zusichert, SHALL der Beleg für die
Produktion aus einer **Messung am Katalog der Produktionsinstanz** stammen, und
diese Messung SHALL im Change mit ihrem Ergebnis festgehalten sein.

#### Scenario: Ausgeloggt wird nur angefragt, was anon lesen darf

- **WHEN** die vom Prüfstand aufgerufenen ausgeloggten Lesepfade laufen
- **THEN** liegt jede angefragte Relation in der Positivliste der für `anon`
  lesbaren Relationen

#### Scenario: Die Grenze des Wächters ist im Prüfstand benannt

- **WHEN** jemand den Prüfstand liest, um sich auf ihn zu berufen
- **THEN** findet er dort, dass weder nicht aufgerufene Lesepfade noch
  Funktionsaufrufe erfasst sind

#### Scenario: Ein lokal grüner Rechte-Test belegt die Produktion nicht

- **WHEN** eine Zusage über ein Ausführungsrecht lokal grün ist
- **THEN** gilt der Rechte-Zustand der Produktionsinstanz als **unbelegt**, bis er
  dort am Katalog gemessen wurde
- **AND** das Ergebnis dieser Messung steht im Change

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
