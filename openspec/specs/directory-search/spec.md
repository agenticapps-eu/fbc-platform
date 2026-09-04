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

### Requirement: Die Mitgliedersuche ist aus der Kopfzeile erreichbar

Der Rahmen SHALL ein Suchfeld tragen, das Mitglieder über dieselbe RPC
`search_directory` findet, die das Verzeichnis benutzt. Es SHALL NOT eine zweite
Suchimplementierung, eine zweite RPC oder einen zweiten Index einführen — die
Kopfzeile ist ein **Einstieg**, keine eigene Fähigkeit.

Ab **zwei** Zeichen des **getrimmten** Textes SHALL eine Abfrage laufen,
**entprellt mit 300 ms**. Unter zwei Zeichen SHALL gar nicht abgefragt werden.

Es SHALL höchstens **fünf** Treffer zeigen. Die Kappung SHALL als solche benannt
sein, denn sie ist heute weder eine Rangfolge noch ein serverseitiges Limit:
`search_directory` kennt kein `LIMIT` und sortiert `order by p.name nulls last`.
„Die ersten fünf" heißt deshalb **alphabetisch die ersten fünf aller Treffer**,
geladen und clientseitig gekürzt. Bei der erwarteten Größenordnung des
Verzeichnisses ist das hingenommen; es SHALL hingeschrieben und nicht
angenommen sein.

Eine Trefferzeile SHALL Avatarbild, Name und **eine** Einordnungszeile tragen.
Die Einordnung SHALL aus den Feldern gebildet werden, die die RPC **tatsächlich
liefert** — `company`, `roles`, `branche`, `short_bio`. Eine
**Berufsbezeichnung SHALL NOT** verlangt werden: ein solches Feld gibt es im
Rückgabetyp nicht, und es zu fordern hieße, es zu erfinden.

Solange sich roher und entprellter Text unterscheiden, SHALL die Liste **keine
Treffer des vorigen Begriffs** zeigen. Fällt der getrimmte Text unter zwei
Zeichen, SHALL die Liste sofort leeren. Eine bestehende Hervorhebung SHALL bei
jedem Wechsel des Begriffs oder der Trefferliste zurückgesetzt werden — sonst
öffnet Enter ein Mitglied, das zur aktuellen Eingabe nicht mehr passt.

Ein Treffer SHALL beim Auswählen das Profil dieses Mitglieds öffnen.

Die Suche SHALL **nur Mitglieder** durchsuchen. Events, Beiträge und
Academy-Inhalte SHALL NOT durchsucht werden.

#### Scenario: Ab zwei Zeichen erscheinen Treffer

- **WHEN** ein aktiviertes Mitglied ab Stufe `discover` zwei oder mehr Zeichen
  eingibt, die auf mindestens ein Profil passen
- **THEN** erscheint nach der Entprellung eine Liste von höchstens fünf Treffern
  mit Avatarbild, Name und einer Einordnungszeile aus vorhandenen Feldern

#### Scenario: Ein einzelnes Zeichen fragt nicht ab

- **WHEN** genau ein Zeichen im Feld steht, oder zwei Zeichen, die getrimmt eines
  ergeben
- **THEN** läuft keine Abfrage und es erscheint keine Trefferliste

#### Scenario: Schnelles Tippen löst eine Abfrage aus, nicht viele

- **WHEN** mehrere Zeichen innerhalb der Entprellzeit nacheinander eingegeben
  werden
- **THEN** läuft genau eine Abfrage, und zwar mit dem zuletzt eingegebenen Text

#### Scenario: Veraltete Treffer verschwinden beim Weitertippen

- **WHEN** bei angezeigter Trefferliste ein weiteres Zeichen getippt wird und die
  Entprellzeit noch läuft
- **THEN** zeigt die Liste nicht mehr die Treffer des vorigen Begriffs
- **AND** eine zuvor gesetzte Hervorhebung ist aufgehoben

#### Scenario: Ein Treffer öffnet das Profil

- **WHEN** ein Treffer ausgewählt wird
- **THEN** öffnet sich das Profil dieses Mitglieds

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

#### Scenario: Unterhalb von discover führt Enter auf die Aufstiegsseite

<!-- Der Titel bleibt zeichengleich, obwohl die Schwelle jetzt `connect` heisst.
     `openspec archive` ordnet Szenarien über ihre Überschrift zu und bricht ab,
     wenn eine verschwindet — ein umbenannter Titel wirkt wie ein gelöschtes
     Szenario. Die Hausregel dazu: den RUMPF schärfen, nie den Titel.

     Der Rumpf steht deshalb auf `basic`. Damit ist er unter BEIDEN Lesarten
     wahr — `basic` liegt unterhalb von `discover` wie von `connect` —, und der
     interessante neue Fall (`connect` kommt jetzt durch) steht bereits im
     ersten Szenario dieser Anforderung. -->

- **WHEN** ein aktiviertes Mitglied auf `basic` einen Begriff eingibt und Enter
  drückt
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

#### Scenario: Unterhalb discover und leer erscheint der Aufstiegs-Hinweis

<!-- Titel zeichengleich zur heutigen Fassung, Rumpf auf `basic` geschaerft —
     siehe die Begruendung am Szenario „Unterhalb von discover fuehrt Enter auf
     die Aufstiegsseite". `basic` liegt unterhalb beider Schwellen, die Zusage
     bleibt also unter alter wie neuer Lesart wahr. -->

- **WHEN** ein aktiviertes Mitglied auf `basic` sucht **und** die
  Abfrage erfolgreich keine Zeile liefert
- **THEN** erscheint ein Hinweis, der die nötige Stufe nennt und zum Aufstieg
  führt
- **AND** es erscheint keine Meldung, es sei nichts gefunden worden

#### Scenario: Unterhalb discover wird die eigene Zeile trotzdem gezeigt

<!-- Titel zeichengleich, Rumpf auf `basic`. Genau dieser Fall ist der Grund
     fuer den Selbst-Zweig im Eintrittstor von `search_directory`: ein Konto
     unterhalb der Verzeichnisschwelle findet in der Kopfzeilen-Suche weiterhin
     sich selbst. -->

- **WHEN** ein aktiviertes Mitglied auf `basic` nach seinem eigenen
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

### Requirement: Suchergebnisse überleben keinen Wechsel der Identität

Zwischengespeicherte Suchergebnisse SHALL an die Identität gebunden sein, die sie
geholt hat. Die Ergebnisse sind RLS-gefiltert und damit **stufen- und
kontoabhängig**; ein Zwischenspeicher ohne Identität im Schlüssel reichte
Treffer, die ein `discover`-Konto geholt hat, an ein später angemeldetes
`basic`-Konto weiter.

Der Zwischenspeicher-Schlüssel der Kopfzeilen-Suche SHALL die Kennung des
angemeldeten Kontos enthalten und SHALL NOT der Schlüssel des vollen
Verzeichnisses sein — ein auf fünf gekürztes Ergebnis unter dem
Verzeichnis-Schlüssel vergiftete dessen Zwischenspeicher.

Wechselt die Identität — Abmeldung, Ablauf der Sitzung, Anmeldung eines anderen
Kontos — SHALL eine laufende Suche verworfen und ihr Ergebnis entfernt werden,
und der Einstieg SHALL keine Treffer der vorigen Identität mehr zeigen. Das Feld
auszublenden SHALL NOT als hinreichend gelten.

> Die allgemeine Fassung dieser Regel — den Zwischenspeicher beim Abmelden zu
> **leeren** statt nur zu entwerten — ist AGE-258 und liegt in
> `finish-ui-polish`. Diese Anforderung schließt die Lücke für den hier gebauten
> Einstieg; für das übrige Verzeichnis bleibt sie offen, und das SHALL benannt
> bleiben statt stillschweigend mitgenommen zu werden.

#### Scenario: Abmelden während einer laufenden Suche

- **WHEN** eine Suchabfrage unterwegs oder die Entprellung noch nicht abgelaufen
  ist und der Nutzer sich abmeldet
- **THEN** verschwindet der Einstieg samt Trefferliste
- **AND** es wird kein Ergebnis dieser Abfrage mehr angezeigt

#### Scenario: Ein zweites Konto sieht die Treffer des ersten nicht

- **WHEN** nach einer Suche als Konto mit Stufe `discover` abgemeldet und ein
  Konto mit Stufe `basic` angemeldet wird und dasselbe Wort gesucht wird
- **THEN** erscheinen keine zwischengespeicherten Treffer der vorigen Identität

### Requirement: Der Sucheinstieg ist mit Tastatur und auf dem Telefon bedienbar

Das Feld und seine Trefferliste SHALL vollständig mit der Tastatur bedienbar
sein: ↑ und ↓ wandern durch die Treffer, Enter wählt den hervorgehobenen Treffer
(und ohne Hervorhebung gilt der Weg ins Verzeichnis bzw. auf die Aufstiegsseite),
Escape schließt die Liste und lässt den Fokus im Feld.

Die Trefferliste SHALL für Hilfstechnik als zusammengehörige Auswahl ausgezeichnet
sein, und der hervorgehobene Treffer SHALL als der aktive benannt sein.

Die Liste SHALL schließen bei Auswahl eines Treffers, beim Weg ins Verzeichnis,
bei einem Klick außerhalb und bei jedem Routenwechsel. Der Rahmen wird beim
Navigieren **nicht** neu aufgebaut; ohne diese Regel bliebe die Liste über der
Zielseite stehen.

Unterhalb der Umbruchbreite, ab der das Feld heute entfällt, SHALL ein
Lupensymbol die Suche öffnen. Die geöffnete Fassung SHALL Sperre und
Fokus-Falle des vorhandenen Overlay-Verhaltens benutzen statt einer eigenen —
und SHALL zusätzlich selbst regeln, was jenes **nicht** mitbringt: den
Anfangsfokus ins Suchfeld, das Schließen per Escape und über den Hintergrund, die
Rückgabe des Fokus an das Lupensymbol, und das **automatische Schließen beim
Überschreiten der Umbruchbreite** — sonst verbirgt CSS die Fassung, während die
Sperre stehen bleibt.

#### Scenario: Pfeiltasten und Enter wählen einen Treffer

- **WHEN** bei offener Trefferliste ↓ und dann Enter gedrückt wird
- **THEN** öffnet sich das Profil des hervorgehobenen Treffers

#### Scenario: Escape schließt, ohne den Fokus zu verlieren

- **WHEN** bei offener Trefferliste Escape gedrückt wird
- **THEN** schließt die Liste und der Fokus bleibt im Suchfeld

#### Scenario: Die Liste bleibt nicht über der Zielseite stehen

- **WHEN** aus der offenen Trefferliste heraus navigiert wird — durch Auswahl,
  durch den Weg ins Verzeichnis oder durch einen Klick außerhalb
- **THEN** ist die Liste danach geschlossen

#### Scenario: Auf dem Telefon öffnet ein Lupensymbol die Suche

- **WHEN** ein eingeloggtes Mitglied den Rahmen in schmaler Fensterbreite sieht
  und das Lupensymbol betätigt
- **THEN** öffnet sich das Suchfeld mit dem Fokus darin, ist beschreibbar und
  liefert dieselben Treffer wie in breiter Ansicht

#### Scenario: Verbreitern schließt die Telefon-Fassung

- **WHEN** die geöffnete Telefon-Fassung die Umbruchbreite nach oben überschreitet
- **THEN** schließt sie, und die Seite ist wieder scrollbar

### Requirement: Die Galerie-Karte ordnet ein, statt den ganzen Kompass zu zeigen

Das System SHALL auf der Karte im Mitgliederverzeichnis Avatar, Name, Rollen,
Ort und Firma, die Mitgliedsstufe, die Kurzbio und die **Branche** zeigen. Sie
SHALL NOT die Kompass-Kategorien des Mitglieds zeigen — weder als
„Bietet: …"/„Sucht: …" je Kategorie noch als pauschale „Bietet"/„Sucht"-Marke
für ein Mitglied, dessen Kompasszeile keine Kategorie trägt.

Das nimmt die Kartendarstellung aus AGE-494 zurück, und zwar nur dort. Der
Grund ist Menge, nicht Richtigkeit: ein Mitglied mit gepflegtem Kompass trägt
zehn und mehr Marken, seine Karte wird doppelt so hoch wie die seiner Nachbarn,
und im Raster liest sich das als Unordnung statt als Information. Die
Kategorien SHALL an den beiden Stellen unverändert bleiben, an denen sie eine
Frage beantworten: als **Filter in der rechten Inhaltsspalte** und auf dem
**Profil**.

Die Karte SHALL das Hintergrundbild des Mitglieds zeigen, wenn eines hinterlegt
ist. Eine Karte ohne Bild SHALL dieselbe Höhe behalten wie eine mit Bild, damit
das Raster bei gemischtem Bestand nicht ausfranst — derselbe Grund, aus dem die
Event-Kachel ihren Platzhalter trägt.

Das Bildfeld der Karte SHALL 3:1 sein und das Bild **einpassen**, nicht
beschneiden. Die Zusage steht hier und nicht in der allgemeinen Bildregel: jene
zählt ihre Bauteile auf und schließt die Verzeichnis-Karte ausdrücklich aus, weil
eine Anforderung, die eine Fläche bindet, die ihr eigener Change nicht anfasst,
mit dem Archivieren sofort verletzt wäre. Damit hängt diese Anforderung an keiner
Landereihenfolge.

`cover_url` SHALL über den Bild-Auflöser des Buckets `covers` in eine
darstellbare Adresse übersetzt werden. Die Spalte trägt seit AGE-580 einen
**relativen Pfad**, keine fertige URL; eine Karte, die den Wert direkt in `src`
schreibt, rendert tote Bilder, und ein Test mit einem `https://…`-Fixture wäre
dabei grün. Prüffixtures SHALL deshalb Pfade tragen.

Dass die Karte die Kategorien nicht mehr zeigt, SHALL NOT heissen, dass die RPC
sie nicht mehr liefert. `offer_categories` und `need_categories` bleiben im
Rückgabesatz: der Filter in der Spalte liest sie, und eine Anforderung, die eine
Darstellung ändert, darf keine Datenschicht mitreissen.

#### Scenario: Eine Karte zeigt keine Kompass-Marken

- **WHEN** ein Mitglied mit Kategorien in `offers` und `needs` als Karte
  gerendert wird
- **THEN** erscheint keine Marke der Form „Bietet: …" oder „Sucht: …"

#### Scenario: Auch die pauschale Marke fällt weg

- **WHEN** ein Mitglied genau eine Kompasszeile ohne `category` hat, also
  `has_offers` gesetzt und `offer_categories` leer
- **THEN** erscheint auch keine nackte „Bietet"-Marke

#### Scenario: Die Branche bleibt

- **WHEN** ein Mitglied eine Branche trägt
- **THEN** zeigt die Karte sie weiterhin

#### Scenario: Der Filter behält seine Kategorien

- **WHEN** das Verzeichnis ab `lg` geöffnet wird
- **THEN** stehen die Kompass-Kategorien in der rechten Spalte unverändert zur
  Auswahl

#### Scenario: Eine Karte ohne Hintergrundbild franst nicht aus

- **WHEN** ein Mitglied ohne `cover_url` neben einem mit `cover_url` im Raster
  steht
- **THEN** haben beide Karten dieselbe Höhe

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

#### Scenario: Unterhalb von discover gibt es die Fläche gar nicht

<!-- Titel zeichengleich zur heutigen Fassung. Der Rumpf stand schon vorher auf
     `basic` und bleibt damit unter alter wie neuer Schwelle wahr — hier war
     nichts zu schärfen, nur der Titel zurückzunehmen. -->

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

### Requirement: Directory names are resolved by the viewer's activation

The directory SHALL display each member's name via the shared display-name resolver
(see `member-profiles`): a caller who is the member themselves, or who is an
**activated** member, SHALL see the full name; every other caller SHALL see the
masked "Mitglied" label. Resolution SHALL occur in the database read path
(`profiles_public` / `search_directory`), so the full name is never sent to a
below-threshold caller.

**The threshold is activation, not a tier.** An earlier plan set it at
`level_rank >= 4` (`exchange`). Because "members" now means every activated member,
that threshold would have masked every author of a feed the same members may read —
a full feed in which nobody has a name. The two do not conflict technically; they
conflict in purpose, and the feed's purpose wins.

**The resolver SHALL apply even where a gate already excludes the caller.** Every
surface that carries a name today is additionally gated on activation, so a caller
the resolver would mask receives no rows at all and the masked branch is unreachable.
That is the point: the resolver is the second of two independent defences, and a
future surface that omits the gate must still not disclose a name. The duplication is
therefore deliberate and SHALL NOT be factored away — two checks that would fail
together are one check.

**Masking the returned column is not sufficient by itself.** Ordering and full-text
search are disclosure channels of their own: a masked row at its alphabetical
position discloses the name the column withholds, and a search term that keeps a
masked row on screen answers the same question. Both SHALL be bound to the same
right as the column.

**What "the name" means here SHALL stay narrow.** The requirement binds
**structured identity fields** carried by profile and host data — the `name`
column and what is derived from it. Self-authored public content — post bodies,
event descriptions — SHALL explicitly **not** be in scope: it may carry names as
ordinary prose, the resolver does not read it, and nothing checks it. This scoping
is carried over from the superseded requirement because it did not become obsolete
with the resolver: a reader who takes the requirement more broadly concludes it is
already broken.

#### Scenario: An activated viewer sees the full name

- **WHEN** an activated caller reads another member in the directory
- **THEN** that member's full name is returned

#### Scenario: A viewer below the threshold sees the masked label

- **WHEN** a caller who is not activated resolves another member's name
- **THEN** the "Mitglied" masked label is returned and the full name is absent from
  the payload

#### Scenario: A member always sees their own full name

- **WHEN** a caller reads their own directory row
- **THEN** their full name is returned, whether or not they are activated

#### Scenario: Anonymous caller keeps the masked fallback

- **WHEN** an anonymous caller cannot read an author's profile row
- **THEN** the name renders as the "Mitglied" fallback

#### Scenario: The masked name does not leak through ordering

- **WHEN** the directory is ordered by name
- **THEN** it is ordered by the resolved name, so a masked row does not occupy the
  alphabetical position of the name it withholds

#### Scenario: The masked name does not leak through search

- **WHEN** a caller who may not see names searches the directory by free text
- **THEN** the search does not answer whether a masked row matches the term, so the
  search cannot be used as an oracle on the withheld name

#### Scenario: A surface without the gate still masks

- **WHEN** a read path reaches profile rows without the activation gate in front of it
- **THEN** the resolver still returns the masked label to a caller below the
  threshold, because it re-checks the caller itself

### Requirement: Suche und Filter stehen in einer mitlaufenden rechten Spalte

Das Mitgliederverzeichnis SHALL sein Suchfeld und seine Facetten in einer
rechten Inhaltsspalte führen, die beim Blättern mitläuft. Die Spalte SHALL
**innerhalb** des Inhaltsbereichs unter der Kopfzeile sitzen, nicht an der
Viewport-Kante — das unterscheidet sie von den beiden angedockten Leisten.

Die Spalte SHALL erst ab `lg` neben der Liste stehen. Darunter SHALL sie in den
Fluss fallen und hinter einem Aufklapp-Schalter liegen, der zugeklappt startet.

Die erweiterten Filter SHALL in der Spalte **dauerhaft offen** stehen. Ihr
bisheriges Zuklappen war eine Antwort auf fehlende Höhe über der Liste; in einer
eigenen Spalte gibt es diesen Mangel nicht mehr.

Die Spalte SHALL 16rem breit sein und 24 px Abstand zur Liste halten — dieselben
Masse wie die Filterspalte der Aktivität, damit beide Flächen dieselbe Kante
zeigen.

#### Scenario: Ab lg steht die Spalte rechts und läuft mit

- **WHEN** das Verzeichnis ab `lg` dargestellt und die Liste gescrollt wird
- **THEN** bleibt die Spalte sichtbar, statt wegzuscrollen

#### Scenario: Unterhalb von lg klappt sie zu

- **WHEN** das Verzeichnis unterhalb von `lg` geöffnet wird
- **THEN** steht die Spalte im Fluss und ist zugeklappt
- **AND** ein Schalter klappt sie auf

#### Scenario: Die erweiterten Filter stehen offen

- **WHEN** das Verzeichnis ab `lg` geöffnet wird
- **THEN** sind die erweiterten Filter ohne weiteres Zutun sichtbar

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

