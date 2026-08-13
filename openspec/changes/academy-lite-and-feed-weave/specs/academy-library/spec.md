## MODIFIED Requirements

### Requirement: Academy lists curated video lessons

The system SHALL render an Academy page that displays a fixed, code-defined list
of curated lessons, each with a title, a description, and an embedded video from
an external host (YouTube/Vimeo) via a reusable embed component. The platform
SHALL NOT host video content itself.

Die kuratierte Liste SHALL als **redaktioneller Block oben** auf der Seite
stehen, oberhalb der geteilten Videos, damit die Academy am Starttag nicht leer
ist.

Sie SHALL eine Konstante im Code bleiben und SHALL NOT in die Datenbank
überführt werden. Der Grund SHALL festgehalten sein: drei von der Redaktion
gewählte Videos sind kein Inhaltsmodell. Sie in `posts` zu schreiben gäbe ihnen
einen Autor, eine Sichtbarkeit, Likes und Kommentare, die niemand bestellt hat —
und ein Kurs-Schema wäre AGE-262, nicht dieser Change.

#### Scenario: Academy shows the curated lessons

- **WHEN** a member opens the Academy page
- **THEN** each hard-coded lesson is shown as a card with its title, description,
  and an embedded external video player

#### Scenario: Der kuratierte Block steht über den geteilten Videos

- **WHEN** ein Mitglied die Academy öffnet und Beiträge mit Video bestehen
- **THEN** stehen die drei kuratierten Lektionen oben, die geteilten Videos
  darunter

## REMOVED Requirements

### Requirement: My Courses is a placeholder with no enrollment

**Reason**: „Meine Kurse" war ein Stub ohne Datenbasis, in C2 aus der Navigation
genommen mit dem Vermerk, dass in C9 „Meine Academy" an diese Stelle tritt. Das
geschieht hier: die Seite entfällt, `/meine-kurse` leitet auf `/academy` um, und
das persönliche Gegenstück ist der Reiter „Meine Academy".

**Migration**: `MeineKursePage.tsx` und ihr Test werden gelöscht; der navItem
entfällt; `App.tsx` leitet `/meine-kurse` auf `/academy` um, damit alte Links
und Lesezeichen nicht ins Leere laufen. Die Anforderung wird durch „Die Academy
zeigt geteilte Videos in zwei Reitern" ersetzt.

## ADDED Requirements

### Requirement: Die Academy zeigt geteilte Videos in zwei Reitern

Das System SHALL unterhalb des kuratierten Blocks zwei Reiter anbieten:

- **Alle** — alle für den Betrachter sichtbaren Beiträge mit `video_url`,
  neueste zuerst.
- **Meine Academy** — zwei Regale: die eigenen geteilten Videos, und die
  gelikten (die eigenen mit „gefällt mir" markierten Videos).

Die Academy SHALL **kein eigenes Datenmodell** bekommen. Sie SHALL eine
gefilterte Sicht auf `public.posts` sein: Beiträge mit einer nicht-leeren
`video_url`. Es SHALL keine Tabelle für Kurse, Lektionen, Einschreibungen oder
Fortschritt entstehen — das ist AGE-262.

Sichtbarkeit SHALL ausschließlich die RLS von `posts` entscheiden. Die Academy
SHALL NOT ein zweites Sichtbarkeitsprädikat führen; sie stellt dieselbe Abfrage
wie der Feed, nur mit einem zusätzlichen Filter auf `video_url`.

Ein in der Aktivität geteiltes Video SHALL **ohne weiteres Zutun** in der
Academy erscheinen — kein Abgleich, kein Übertragen, kein zweiter Eintrag.

Beide Reiter SHALL **seitenweise** laden, mit derselben Keyset-Paginierung wie
der Feed (Cursor über `(created_at, id)`), und SHALL NOT auf eine feste
Obergrenze ohne Nachladen setzen. Der Grund SHALL festgehalten sein: PostgREST
begrenzt Resultsets ohnehin. Ein Reiter, der „alle sichtbaren Videos"
verspricht und dabei still abschneidet, sagt die Unwahrheit, ohne dass etwas
darauf hinweist — dieselbe Begründung, aus der der Feed seine Paginierung
bekommen hat.

Der leere Zustand SHALL unterscheiden, ob es überhaupt keine geteilten Videos
gibt oder nur keine eigenen, und im zweiten Fall den Weg zum Teilen zeigen statt
den Mangel zu benennen.

#### Scenario: Ältere Videos sind erreichbar

- **WHEN** mehr sichtbare Videos bestehen, als eine Seite trägt
- **THEN** zeigt der Reiter die erste Seite und lädt die älteren auf
  Anforderung nach, statt den Rest wegzulassen

#### Scenario: Ein geteiltes Video erscheint ohne Zutun in der Academy

- **WHEN** ein Mitglied in der Aktivität einen Beitrag mit einem YouTube-Link
  veröffentlicht und danach die Academy öffnet
- **THEN** steht das Video unter „Alle" und unter „Meine Academy", ohne dass
  irgendwo etwas übertragen wurde

#### Scenario: Das Regal „selbst geteilt" zeigt nur die eigenen

- **WHEN** ein Mitglied den Reiter „Meine Academy" öffnet und andere Mitglieder
  ebenfalls Videos geteilt haben
- **THEN** enthält das Regal der selbst geteilten Videos nur die eigenen — für
  fremde Videos ist das zweite Regal zuständig

#### Scenario: Ein unsichtbarer Beitrag erscheint auch in der Academy nicht

- **WHEN** ein Mitglied unter Rang 4 die Academy öffnet und ein fremdes
  `members`-Video besteht
- **THEN** erscheint es nicht — dieselbe Entscheidung wie im Feed, getroffen an
  derselben Stelle

#### Scenario: Der leere Zustand zeigt den Weg

- **WHEN** ein Mitglied „Meine Academy" öffnet und selbst noch kein Video
  geteilt hat
- **THEN** erscheint ein leerer Zustand, der zum Teilen führt, statt nur das
  Fehlen zu benennen

### Requirement: „Meine Academy" führt ein zweites Regal aus den eigenen Likes

Das System SHALL in „Meine Academy" neben den selbst geteilten Videos ein
zweites Regal mit den Videos führen, die der Betrachter mit „gefällt mir"
markiert hat.

Es SHALL dafür **keine** neue Tabelle geben. Das Regal SHALL die eigenen
`post_likes`-Zeilen lesen und deren Beiträge auflösen. Möglich ist das, weil
`post_likes` owner-only lesbar ist: die eigenen Zeilen kommen zurück, fremde
nie — ein Mitglied SHALL dadurch NOT erfahren, wer sonst etwas geliked hat.

Ein gelikter Beitrag, den der Betrachter nicht mehr lesen darf, SHALL
**entfallen** statt als Lücke oder Fehler zu erscheinen. Der Fall SHALL benannt
sein: sinkt die Stufe unter Rang 4 oder wechselt der Autor seinen Beitrag auf
`members`, liefert die RLS die Beitragszeile nicht mehr, während die Like-Zeile
liegen bleibt. Ein Like ist eine Markierung, kein Zugriffsrecht.

Das Regal SHALL nach dem **Zeitpunkt des Likes** sortiert sein, neueste zuerst,
und NOT nach dem Alter des Beitrags. Es beantwortet „was habe ich zuletzt
markiert" — „was ist neu" beantwortet der Reiter „Alle". `post_likes.created_at`
trägt den Wert bereits.

Ein eigenes Video, das der Betrachter selbst geliked hat, SHALL in **beiden**
Regalen erscheinen. Sie beantworten verschiedene Fragen, und ein Ausschluss wäre
eine Regel, die man sich merken müsste.

Auch dieses Regal SHALL seitenweise laden.

Die Beschriftung SHALL das Regal als die eigene **„gefällt mir"-Liste**
benennen und SHALL NOT Wörter wie „gemerkt", „gespeichert" oder „Merkzettel"
verwenden.

Der Grund SHALL festgehalten sein, und er ist nicht Geschmack: ein „gefällt
mir" ist hier **nicht privat**. `post_engagement_counts` gibt den Like-Zähler
eines Beitrags an jeden aus, der ihn sehen darf — wer etwas merkt, erhöht damit
eine für andere sichtbare Zahl. Nur *wer* geliked hat, bleibt verborgen
(owner-only SELECT). Eine Beschriftung, die „gemerkt" verspricht, sagt Privates
zu, wo eine öffentliche Zahl steigt. Ein echtes, stilles Speichern wäre eine
eigene Tabelle mit eigener RLS — und damit der Anfang des Kurs-Schemas aus
AGE-262.

#### Scenario: Das Regal verspricht keine Privatheit, die es nicht gibt

- **WHEN** die Beschriftung des zweiten Regals dargestellt wird
- **THEN** benennt sie die eigene „gefällt mir"-Liste und behauptet weder
  „gemerkt" noch „gespeichert"

#### Scenario: Ein geliktes Video eines anderen erscheint im zweiten Regal

- **WHEN** ein Mitglied den Video-Beitrag eines anderen mit „gefällt mir"
  markiert und danach „Meine Academy" öffnet
- **THEN** steht das Video im Regal der gelikten, nicht bei den selbst
  geteilten

#### Scenario: Ein nicht mehr sichtbares geliktes Video entfällt lautlos

- **WHEN** ein gelikter Beitrag für den Betrachter nicht mehr lesbar ist
- **THEN** erscheint er nicht im Regal, und es wird weder eine Lücke noch ein
  Fehler dargestellt

#### Scenario: Fremde Markierungen bleiben unsichtbar

- **WHEN** ein Mitglied das Regal der gelikten Videos öffnet
- **THEN** enthält es ausschließlich die eigenen Markierungen, und es ist an
  keiner Stelle erkennbar, wer sonst einen Beitrag geliked hat

#### Scenario: Ein eigenes, geliktes Video steht in beiden Regalen

- **WHEN** ein Mitglied ein eigenes Video geteilt und selbst geliked hat
- **THEN** erscheint es sowohl bei den selbst geteilten als auch bei den
  gelikten
