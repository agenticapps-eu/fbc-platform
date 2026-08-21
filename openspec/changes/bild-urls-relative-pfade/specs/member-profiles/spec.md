## ADDED Requirements

### Requirement: Bildspalten tragen Pfade, keine projektgebundenen URLs

Der Geltungsbereich SHALL auf **Supabase-verwaltete** Profilmedien begrenzt sein:
Objekte in den Buckets `avatars` und `covers`. Ein fremd gehostetes Bild — etwa
aus dem Demo-Seed — SHALL weiterhin als absolute URL zulässig sein; diese
Anforderung SHALL NOT als Verbot fremder Hosts gelesen werden.

Für Supabase-verwaltete Bilder SHALL `profiles.avatar_url` und
`profiles.cover_url` den **Pfad des Objekts innerhalb seines Buckets** tragen.
Die Projektkennung der Supabase-Instanz SHALL NOT in einem solchen Spaltenwert
vorkommen. **Sollzustand:** nach abgeschlossener Migration SHALL kein
Spaltenwert mehr auf ein Objekt der eigenen Instanz über eine absolute URL
zeigen.

Die anzeigende Fläche SHALL die URL beim Lesen aus Bucket und Pfad herstellen.
Beide Buckets sind öffentlich; die Herstellung SHALL deshalb ohne Signatur und
ohne Netzwerkrunde auskommen.

Der Auflöser SHALL als **absolut** behandeln, was ein URI-Schema trägt, und
SHALL NOT eine Liste einzelner erlaubter Schemata führen. Diese Unterscheidung
ist tragend: der lokale Entwicklungs-Stack liefert `http:`-URLs, die eine Liste
aus `https`, `blob` und `data` beschädigt hätte.

Das Durchreichen absoluter Werte SHALL als Aussage über die **Eingabe der
Anzeigefunktion** gelten, nicht als Erlaubnis für Spaltenwerte — beides SHALL
NOT vermengt werden. Es deckt drei Eingaben, von denen nur die erste je in einer
Spalte steht: einen Bestandswert vor der Migration oder aus einer älteren
ausgelieferten Fassung (Übergang), eine fremd gehostete URL (dauerhaft erlaubt)
und die `blob:`-URL der Bildvorschau im Editor, die überhaupt nie gespeichert
wird.

Eine Migration SHALL die Bestandszeilen auf Pfade zurückschneiden. Sie SHALL
einen Wert nur dann umschneiden, wenn das bezeichnete Objekt **in der eigenen
Instanz nachweislich existiert**; sie SHALL jeden anderen Wert unangetastet
lassen. Damit SHALL sie ohne hart geschriebene Projektkennung auskommen und
zugleich eine gleich aufgebaute URL einer **fremden** Supabase-Instanz nicht
erfassen.

Die Auslieferung SHALL den Leser **vor** dem Schreiber in Betrieb nehmen. Eine
Reihenfolge, in der Spaltenwerte zu Pfaden werden, bevor die ausgelieferte
Fläche sie auflösen kann, SHALL NOT gewählt werden.

#### Scenario: Ein neu hochgeladenes Bild hinterlässt keine Projektkennung

- **WHEN** ein Mitglied ein Profil- oder Hintergrundbild hochlädt
- **THEN** trägt die Spalte den Pfad innerhalb des Buckets, und die
  Projektkennung kommt darin nicht vor

#### Scenario: Ein Bestandswert mit absoluter URL wird weiterhin angezeigt

- **WHEN** eine Spalte noch eine absolute URL trägt
- **THEN** reicht der Auflöser sie unverändert durch, und das Bild erscheint

#### Scenario: Die Vorschau im Editor überlebt den Auflöser

- **WHEN** im Profil-Editor ein Bild ausgewählt, aber noch nicht gespeichert ist
  und die Vorschau als `blob:`-URL vorliegt
- **THEN** reicht der Auflöser sie unverändert durch, statt ihr einen Bucket-Host
  voranzustellen

#### Scenario: Die Migration lässt fremde Werte in Ruhe

- **WHEN** ein Spaltenwert eine Storage-URL trägt, deren Objekt in der eigenen
  Instanz nicht existiert — etwa aus einer fremden Supabase-Instanz mit
  gleichnamigem Bucket
- **THEN** bleibt er unverändert, statt zugeschnitten zu werden

#### Scenario: Ein fremd gehostetes Bild bleibt zulässig

- **WHEN** ein Spaltenwert auf einen fremden Host zeigt, der kein Supabase-Bucket
  dieser Instanz ist
- **THEN** verstößt er nicht gegen diese Anforderung, und der Auflöser reicht ihn
  unverändert durch

#### Scenario: Eine lokale Entwicklungs-URL überlebt den Auflöser

- **WHEN** ein Wert eine `http:`-URL des lokalen Stacks trägt
- **THEN** reicht der Auflöser sie unverändert durch, weil „absolut" am
  vorhandenen URI-Schema erkannt wird und nicht an einer Liste

#### Scenario: Der Leser geht vor dem Schreiber in Betrieb

- **WHEN** die Umstellung ausgeliefert wird
- **THEN** ist die auflösende Fläche nachweislich live, bevor ein Spaltenwert zu
  einem Pfad wird — sonst renderte eine ältere Fassung den Pfad relativ zum
  Anwendungs-Origin

#### Scenario: Die Migration ist wiederholbar

- **WHEN** die Migration ein zweites Mal über denselben Bestand läuft
- **THEN** ändert sie nichts mehr, weil ein Pfad ihrem Muster nicht entspricht

#### Scenario: Ein Wechsel der Projektkennung lässt die Bilder stehen

- **WHEN** derselbe Bestand unter einer anderen Projektkennung betrieben wird
- **THEN** zeigen die Bilder weiterhin auf vorhandene Objekte, weil kein
  Spaltenwert die alte Kennung trägt

## MODIFIED Requirements

### Requirement: Profile media is stored and gated per member

The system SHALL store avatars in a public `avatars` storage bucket where writes
are restricted to the caller's own `{uid}/…` folder (policies
`avatars_insert_own` / `avatars_update_own` / `avatars_delete_own`), SHALL store
Hintergrundbilder in einem **getrennten** Bucket `covers` unter denselben
Schreibregeln (`covers_insert_own` / `covers_update_own` / `covers_delete_own`),
and SHALL store an ordered `profiles.videos text[]` of provider URLs whose
visibility follows the existing `profiles` RLS (no separate access path).

Der getrennte Bucket SHALL gewählt sein, damit Dateigröße und Dateityp
**serverseitig** an das Objekt gebunden sind (`file_size_limit`,
`allowed_mime_types`) und nicht nur an das Formular. Beide Werte SHALL beziffert
sein, und das Anlegen SHALL eine abweichende Bestandskonfiguration
**überschreiben** statt sie zu konservieren — sonst liefe der Test grün gegen
einen falsch eingestellten Bucket.

Die Schreib-Policies **beider** Buckets SHALL zusätzlich die Aktivierung
voraussetzen: ein übernommenes Konto SHALL weder das Profilbild noch das
Hintergrundbild des Mitglieds austauschen können. Weil dieselbe Regel damit an
sechs Stellen steht, SHALL ein Test dieselbe Falltabelle gegen **beide** Buckets
führen; eine Änderung an nur einem Bucket SHALL dadurch rot werden.

Weil beide Policies den ersten Pfadabschnitt gegen die `auth.uid()` **des
Aufrufers** prüfen, SHALL ein Bild **nur vom Mitglied selbst** hochgeladen
werden können. Ein Admin, der ein fremdes Profil bearbeitet, SHALL diese
Steuerung nicht angeboten bekommen, statt an der Policy zu scheitern.

Für **Lesezugriffe** SHALL ausgeschrieben sein, was das Gate konstruktionsbedingt
nicht erreicht: beide Buckets sind `public` und tragen bewusst keine
SELECT-Policy, Objekte rendern über ihre URL. Wovor das Gate schützt, ist das
**Erfahren** der URL — `profiles.avatar_url` und `profiles.cover_url` liegen
dahinter. Ein nicht aktiviertes Konto SHALL weder Bild-URL noch Bild-Pfad
erhalten; ein Abruf mit bereits bekannter URL SHALL als benannte, vorbestehende
Restfläche gelten und nicht als Zusage dieses Requirements. Dasselbe SHALL für
abgelöste Bilder gelten: ein ersetztes oder entkoppeltes Objekt bleibt abrufbar.

#### Scenario: A member uploads only into their own avatar folder

- **WHEN** an **activated** authenticated member uploads an object to the
  `avatars` bucket under a first path segment equal to their `auth.uid()`
- **THEN** the write is permitted; a write under any other member's folder is denied

#### Scenario: Ein nicht bestätigtes Konto tauscht kein Profilbild aus

- **GIVEN** ein angemeldetes, nicht bestätigtes Konto
- **WHEN** es ein Objekt in seinen eigenen `{uid}/…`-Ordner schreibt
- **THEN** wird der Schreibzugriff abgelehnt

#### Scenario: Profile videos inherit profile visibility

- **WHEN** a caller can read a given `profiles` row under RLS
- **THEN** that row's `videos` array is visible to them, and to no one who cannot read the row

#### Scenario: Ein Mitglied schreibt Hintergrundbilder nur in seinen eigenen Ordner

- **WHEN** ein bestätigtes Mitglied ein Objekt in `covers` unter einem ersten
  Pfadabschnitt gleich seiner `auth.uid()` ablegt
- **THEN** wird der Schreibzugriff angenommen; ein Schreibzugriff unter der
  `auth.uid()` eines anderen Mitglieds wird abgelehnt

#### Scenario: Ein nicht bestätigtes Konto lädt kein Hintergrundbild hoch

- **GIVEN** ein angemeldetes, nicht bestätigtes Konto
- **WHEN** es ein Objekt in seinen eigenen `{uid}/…`-Ordner in `covers` schreibt
- **THEN** wird der Schreibzugriff abgelehnt

#### Scenario: Ein zu großes oder falsch typisiertes Bild wird abgewiesen

- **WHEN** ein bestätigtes Mitglied ein Objekt über der Größengrenze oder mit
  einem anderen Typ als WebP in `covers` ablegt
- **THEN** weist die Storage-Schnittstelle es ab, unabhängig davon, was der
  Client geprüft hat

#### Scenario: Der Admin bekommt im Fremd-Modus keine Bild-Steuerung

- **WHEN** ein Admin ein fremdes Profil bearbeitet
- **THEN** sind Profilbild- und Hintergrundbild-Steuerung nicht vorhanden

