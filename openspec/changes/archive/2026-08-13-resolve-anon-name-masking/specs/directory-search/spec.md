## MODIFIED Requirements

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

## ADDED Requirements

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
