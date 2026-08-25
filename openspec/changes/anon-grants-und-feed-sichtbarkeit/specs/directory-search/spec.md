## MODIFIED Requirements

### Requirement: Server-side directory search with facet filters

The system SHALL expose a server-side search over the member directory that
accepts a free-text query and facet filters, and SHALL return only rows the
caller is permitted to see.

`search_directory` SHALL run as `SECURITY INVOKER`, so the base-table RLS decides
what a caller sees. The execute privilege SHALL be held by `authenticated` alone.

Das Ausführungsrecht SHALL **namentlich** entzogen werden — `from public, anon` —
und SHALL NOT allein über `public` entzogen werden. Ein Entzug von `public`
entfernt einen rollen-eigenen Grant nicht, und die Default Privileges einer
Supabase-Instanz können `anon` ein solches Recht ausdrücklich erteilen. Wo das
zutrifft, ist eine Funktion für `anon` ausführbar, obwohl die Migration das
Gegenteil auszusprechen scheint.

#### Scenario: A member with no rows at all returns empty arrays

- **WHEN** a member holds neither offers nor needs
- **THEN** `offer_categories` and `need_categories` are both `{}` and neither is null

#### Scenario: `anon` hält kein Ausführungsrecht auf der Suche

- **WHEN** der Rechte-Zustand der acht-argumentigen `search_directory` gelesen wird
- **THEN** hält `anon` **kein** `EXECUTE` — geprüft am Privilegien-Bit des Katalogs,
  nicht an der Fehlermeldung eines Aufrufs
- **AND** `authenticated` hält es weiterhin

#### Scenario: A below-rank caller learns no other member's categories

- **WHEN** a caller below the directory's rank gate filters on `p_offers`
- **THEN** the base-table RLS still yields at most their own row, so neither the
  returned arrays nor the filtered result set reveals another member's categories

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
