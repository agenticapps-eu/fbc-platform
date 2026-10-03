## MODIFIED Requirements

### Requirement: Server-side directory search with facet filters

The system SHALL provide a `search_directory(...)` RPC that returns a fixed
column set per member (`id`, `name`, `avatar_url`, `cover_url`, `region`, `company`,
`short_bio`, `branche`, `tier`, `roles`, `competencies`, `has_offers`,
`has_needs`, `offer_categories`, `need_categories`) with optional full-text
(`p_query`, German `search_doc` tsvector) and facet filters (`p_theme`,
`p_branche`, `p_region`, `p_competency`, `p_offering`, `p_offers`, `p_needs`).
Die Funktion SHALL `SECURITY DEFINER` sein, mit festgesetztem `search_path`, und
SHALL nur `is_public`-Mitglieder listen.

**Das war bis zu diesem Change `SECURITY INVOKER`, und der Wechsel ist keine
Verbesserung, sondern eine Folge.** Die Funktion liest `profiles_public`, und
dieser Change entzieht `authenticated` das Leserecht darauf; als INVOKER
scheiterte sie danach für jeden. Entzug und Umstellung sind deshalb **ein**
Schritt.

**Was sich dabei verschiebt, SHALL festgehalten sein, weil das Ergebnis gleich
bleibt und der Grund dafür nicht.** Die Funktion liest die RLS-freie Sicht und
daneben `left join public.profiles p` für die erweiterten Spalten. Als INVOKER
maskierte die RLS `p.competencies` für jeden unterhalb von Rang 4. Als DEFINER
tut sie das nicht mehr — die Maskierung hängt dann **allein am Eintrittstor** der
Funktion. Dass das Ergebnis dasselbe ist, folgt daraus, dass Rang 6 den Rang 4
einschliesst und der Selbst-Zweig nur die eigene Zeile liefert. Das ist nach der
Umstellung keine Eigenschaft der Datenbank mehr, sondern eine Eigenschaft dieser
einen `where`-Klausel, und SHALL als Zusage geprüft werden statt als Kommentar
dastehen.

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
  `suchbegriff_zu_tsquery(p_query)` are returned — the prefix-capable helper
  introduced on 2026-08-17, not `websearch_to_tsquery`, which cannot match a
  prefix. Die Auswahl begrenzt ab diesem Change das **Eintrittstor der
  Funktion**, nicht mehr die RLS des Aufrufers: die Funktion ist
  `SECURITY DEFINER`, und `subject to RLS` wäre dort schlicht falsch

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

<!-- Titel zeichengleich. Die Zusage bleibt; ihr Mechanismus wechselt mit
     diesem Change von der RLS auf das Eintrittstor der Funktion. Genau
     deshalb steht sie hier noch einmal. -->

- **WHEN** a caller below the directory's rank gate filters on `p_offers`
- **THEN** das Eintrittstor der Funktion liefert ihm höchstens die eigene Zeile,
  so dass weder die zurückgegebenen Arrays noch die gefilterte Treffermenge die
  Kategorien eines anderen Mitglieds preisgeben — **die Zusage bleibt, ihr
  Träger wechselt von der RLS auf die `where`-Klausel**, und genau deshalb wird
  sie hier eigens geprüft statt mitgedacht

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

**Der Mechanismus wechselt mit diesem Change: von einem Leserecht auf der
Relation zu kennungsgebundenen Funktionen.** Die Zusage oben bleibt Wort für
Wort — jedes aktivierte Mitglied bekommt die Basisfelder, ohne Rücksicht auf
seine Stufe. Was entfällt, ist der **Mengen**zugriff.

`select` auf `public.profiles` und auf `public.profiles_public` SHALL
`authenticated` entzogen sein. An ihrer Stelle SHALL es `SECURITY DEFINER`-
Funktionen geben, die **Kennungen entgegennehmen** statt eine Menge zu liefern,
und die die Namensauflösung über `resolve_display_name` beibehalten:

| Funktion                           | für                                          | Prädikat                                         |
| ---------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `mein_profil()`                    | die eigene Zeile, alle Spalten               | `id = auth.uid()`                                |
| `meine_stufe()`                    | Stufe und Rang beim Sitzungsstart            | dasselbe, zwei Felder                            |
| `profil_karten(uuid[])`            | Karten zu bekannten Kennungen                | das Prädikat der Sicht                           |
| `gespraechspartner_karten(uuid[])` | Karten im Chat                               | gemeinsamer Gesprächsfaden, **ohne** `is_public` |
| `profil_detail(uuid)`              | die erweiterten Felder eines fremden Profils | `has_level(4)`, wie heute                        |

**`gespraechspartner_karten` SHALL es geben und SHALL NOT in `profil_karten`
aufgehen.** Der Chat liest heute ausdrücklich die Basistabelle statt der Sicht,
damit ein Gesprächspartner auch dann seinen Namen trägt, wenn er sein Profil
nicht öffentlich gestellt hat. Eine Ersatzfunktion mit dem Prädikat der Sicht
liesse im Chat Namen verschwinden — **ausschliesslich bei den Mitgliedern, die
sich aus dem Verzeichnis zurückgezogen haben**, und ohne dass ein Test mit
öffentlichen Konten es bemerkte.

**Der Entzug SHALL beide Funktionen mitnehmen, die die Sicht als
`SECURITY INVOKER` lesen, nicht nur `search_directory`.** Gemessen über den
Funktionskatalog von PROD sind es genau zwei: `search_directory` und
**`feed_top_authors`**, die „Die aktivsten Mitglieder" in der Feed-Seitenleiste
zeichnet. Die übrigen Funktionen auf `profiles` sind bereits DEFINER und
unberührt. Ohne diesen Nachzug bricht die Seitenleiste in dem Moment, in dem die
Migration läuft.

**Die Spalten-Grants für `update` SHALL unberührt bleiben** — dieser Change
schliesst den Lese-, nicht den Schreibweg. Aber `update(...).select()` gibt die
Zeile zurück und braucht `select` auf die zurückgegebenen Spalten; solche Ketten
SHALL aufgelöst werden, sonst scheitert ein gelungener Schreibvorgang mit einem
Fehler, der nach fehlendem Schreibrecht aussieht.

**Was NICHT zugesagt wird, und das SHALL hier stehen:** eine Obergrenze auf der
Stapelgrösse ist ein Betriebsmittel und **kein** Sicherheitsargument — wer 200
Kennungen auf einmal abfragen darf, darf auch fünfzig Mal 200. Dieser Change
macht aus einem *Mengen*zugriff einen *Kennungs*zugriff. Ein Mitglied, das sich
Kennungen aus Feed, Chat und Events zusammensucht, bekommt dazu weiterhin
Karten. Die Aussage „es gibt keinen Weg zu fremden Profildaten" SHALL NICHT
geführt werden; die Aussage „die Mitgliederliste ist nicht als Menge abholbar"
SHALL ab diesem Change geführt werden dürfen.

#### Scenario: Ein basic-Konto liest Namen im Feed

<!-- Titel zeichengleich zum Bestand — der Name ist eine Kennung. `basic`
     gibt es seit AGE-903 nicht mehr; gemeint ist jedes Konto unterhalb der
     Verzeichnisschwelle, und die liegt seit AGE-1000 bei Rang 6. -->

- **WHEN** ein aktiviertes Mitglied unterhalb der Verzeichnisschwelle einen
  Beitrag im Feed sieht
- **THEN** trägt der Beitrag den aufgelösten Namen seines Verfassers

#### Scenario: Dasselbe Konto erreicht das Verzeichnis dennoch nicht

<!-- Titel zeichengleich. „Das Verzeichnis" heisst ab AGE-1000 genauer: die
     Liste und die Suche. Ein einzelnes Profil bleibt erreichbar. -->

- **WHEN** dasselbe Mitglied `/mitglieder` aufruft
- **THEN** greift das Rechte-Gate, und `search_directory` gäbe ihm ohnehin nur
  die eigene Zeile

#### Scenario: Der Rohzugriff auf die Sicht hängt an KEINEM Rang

<!-- Titel zeichengleich, Aussage UMGEDREHT. Bis zu diesem Change hielt dieses
     Szenario den offenen Zustand fest („es kommen Zeilen zurück"), damit er
     benannt und nicht behauptet behoben war. Jetzt ist er behoben. -->

- **WHEN** ein aktiviertes Mitglied **auf beliebiger Stufe** `select` auf
  `profiles_public` ohne Filter versucht
- **THEN** kommt keine Zeile zurück — das Leserecht ist entzogen, und der Weg
  zu Namen und Bildern führt über `profil_karten` mit bekannten Kennungen

#### Scenario: Der Rohzugriff auf die Basistabelle hängt an Rang 4

<!-- Titel zeichengleich, Aussage UMGEDREHT. Der Rang spielt keine Rolle mehr,
     weil das Leserecht gar nicht mehr besteht. -->

- **WHEN** ein aktiviertes Mitglied ab Rang 4 `select` auf `profiles` ohne
  Filter versucht
- **THEN** kommt keine Zeile zurück — auch nicht die eigene; die eigene Zeile
  liefert `mein_profil()`

#### Scenario: Unterhalb des Clubs gibt die Basistabelle nur die eigene Zeile

<!-- Titel zeichengleich, Aussage UMGEDREHT. Vor diesem Change hielt es den
     Unterschied zwischen den beiden Relationen fest, damit der Verschluss sie
     getrennt behandelt. Er hat es getan, und danach sind beide gleich zu. -->

- **WHEN** ein aktiviertes Mitglied auf Rang 3 dasselbe versucht
- **THEN** kommt ebenfalls keine Zeile zurück — nach dem Entzug unterscheiden
  sich die beiden Relationen nicht mehr, und die eigene Zeile kommt für jede
  Stufe aus `mein_profil()`

#### Scenario: Die eigene Zeile bleibt vollständig erreichbar

- **WHEN** ein aktiviertes Mitglied sein eigenes Profil lädt oder bearbeitet
- **THEN** bekommt es alle Spalten seiner Zeile über `mein_profil()`, und ein
  Speichervorgang gelingt weiterhin

#### Scenario: Im Chat bleibt auch ein zurückgezogenes Profil benannt

- **WHEN** ein Mitglied einen Gesprächsfaden mit jemandem öffnet, der sein
  Profil **nicht** öffentlich gestellt hat
- **THEN** trägt der Faden dessen Namen und Bild — über
  `gespraechspartner_karten`, nicht über das Prädikat der Sicht

#### Scenario: Die aktivsten Mitglieder erscheinen weiterhin

- **WHEN** ein Mitglied den Feed öffnet
- **THEN** zeichnet die Seitenleiste „Die aktivsten Mitglieder" wie zuvor —
  `feed_top_authors` ist mit dem Entzug auf `SECURITY DEFINER` umgestellt
