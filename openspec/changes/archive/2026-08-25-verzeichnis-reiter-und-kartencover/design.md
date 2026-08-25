# Design — AGE-595

> Diese Fassung ist das Ergebnis des Plan-Reviews. Die erste enthielt einen
> erfundenen Spaltennamen, eine falsche Behauptung über den Filter und eine
> Zielgruppe, die die Fläche gar nicht erreicht. Siehe `REVIEWS.md`.

## Die Kontaktliste ist eine Mengenoperation, keine neue Abfrage

`search_directory` liefert alle für den Betrachter sichtbaren Mitglieder — heute
**74** Zeilen, ohne Paging. Die Frage „welche davon sind meine Kontakte" ist
damit ein Schnitt zweier Mengen, und die zweite Menge kostet eine Abfrage:
dieselbe, die `dashboard.ts` heute für den Zähler stellt, nur ohne
`head: true`.

Die Spalten heißen **`from_id` und `to_id`** (`contact_requests`), nicht
`requester_id`/`recipient_id`. Der erste Entwurf hat sie erfunden; die Abfrage
wäre zur Laufzeit gescheitert. Die Sidenbedingung lautet wie in `dashboard.ts`
`from_id.eq.<uid>,to_id.eq.<uid>` mit `status = 'accepted'`.

**Verworfen: ein Parameter `p_only_contacts` an `search_directory`.** Er wäre
die richtige Lösung, sobald Paging existiert, kostet aber heute eine zweite
Signaturänderung an derselben Funktion in derselben Migration und eine
RLS-Argumentation für einen Weg, den es ohne Paging nicht braucht. Die Schwelle,
ab der das kippt, ist das Paging selbst — nicht eine Mitgliederzahl.

## Der Query-Key trägt die Identität

`directoryQueryKey` trägt heute nur die Filter. Der `QueryClient` überlebt einen
Kontowechsel im selben Browser; ein Schlüssel ohne UID gäbe Konto B die
Kontaktmenge von Konto A. Der neue Schlüssel ist `contactsQueryKey(uid)`, und
beim Identitätswechsel werden die Einträge entfernt.

Das ist keine neue Erfindung: `directory-search` trägt bereits die Anforderung
„Suchergebnisse überleben keinen Wechsel der Identität". Der Kontaktschnitt
fällt unter dieselbe Regel und muss sie mit erfüllen.

## Der Zähler ist die Falle, nicht die Liste

Es gibt zwei plausible Zahlen: die Zahl der angenommenen Anfragen, und die Zahl
der daraus im Verzeichnis **sichtbaren** Mitglieder. Sie fallen auseinander,
sobald ein Kontakt nicht gelistet ist (`is_public = false`, nicht aktiviert,
unterhalb des Rangs). Der Zähler MUSS die zweite zeigen, sonst steht am Reiter
eine Drei und darunter liegen zwei Karten.

Folge: der Zähler wird aus **derselben gefilterten Liste** abgeleitet, die
gerendert wird — nicht aus der Länge des ID-Sets und nicht aus
`dashboard.contactsCount`. Eine Zahl aus einer anderen Quelle als ihre Liste ist
eine zweite Wahrheit.

## Vier Zustände, nicht zwei

Der Reiter „Meine Kontakte" kann leer sein, und die Gründe sind verschieden.
Sie zusammenzuwerfen erzeugt eine Einladung dort, wo eigentlich ein Fehler oder
ein Filter steht:

| Zustand | Was gilt | Was erscheint |
|---|---|---|
| lädt | eine der beiden Abfragen läuft | Ladezustand, **kein** Zähler |
| Kontaktabfrage scheitert | `contact_requests` antwortet nicht | Fehlerhinweis, nicht „0 Kontakte" |
| keine Kontakte | Menge der akzeptierten Anfragen ist leer | Einladung zur ersten Kontaktaufnahme |
| Kontakte, aber keine sichtbar | Schnitt mit dem Verzeichnis ist leer | eigener Hinweis, keine Einladung |
| Kontakte, aber keiner passt zum Filter | Suche/Facette schließt sie aus | Hinweis auf den Filter |

Der zweite Fall ist der wichtige: `undefined` als leere Menge zu lesen macht aus
einem Fehlschlag eine beruhigende Null — genau der stille Fehlschlag, gegen den
AGE-591/593 gebaut wurden.

## Suche und Filter beim Reiterwechsel

Sie **bleiben** stehen. Ein Wechsel des Reiters ändert die Grundmenge, nicht die
Frage an sie; ein Filter, der beim Umschalten verschwindet, zwingt zur
Wiedereingabe und sieht wie ein Fehler aus. Die Zähler an beiden Reitern zeigen
dabei die Zahl **unter dem aktuellen Filter**, nicht die ungefilterte Menge —
sonst widerspricht der Zähler wieder seiner Liste.

## Das Cover in der Karte

`cover_url` wandert in den Rückgabesatz. Zwei Dinge, die der Review aufgedeckt
hat:

**Es ist ein Pfad, kein URL.** Seit AGE-580 stehen in `cover_url` relative
Pfade; gerendert wird über `bildUrl("covers", …)`. Ein Test mit einem
`https://…`-Fixture wäre grün, während in Produktion tote Bilder erscheinen —
das Fixture trägt deshalb einen Pfad.

**Die Karte regelt ihre Bildfläche selbst.** AGE-596 schließt die
Verzeichnis-Karte ausdrücklich aus seinem Geltungsbereich aus, weil eine
Anforderung, die Flächen bindet, die ihr Change nicht anfasst, beim Archivieren
sofort verletzt wäre. Also steht die Zusage hier: 3:1-Feld, eingepasst, gleiche
Kartenhöhe mit und ohne Bild. Keine Landereihenfolge zwischen den beiden
Changes nötig.

## Die Marken

Der Block fällt ersatzlos weg, bis auf die Branche. Zu löschen sind vier
Zweige: die beiden `map`-Läufe über die Kategorien und die beiden pauschalen
Marken.

`offer_categories`/`need_categories` bleiben trotzdem im Rückgabesatz. **Nicht**,
weil der Filter sie liest — das war falsch: die Filteroptionen kommen aus
`config/compass.ts`, und gefiltert wird serverseitig gegen `offers`/`needs`. Sie
bleiben, weil ihre Entfernung eine dritte Signaturänderung an derselben Funktion
wäre, für einen Nutzen, den niemand hat. Das ist eine bewusste Entscheidung für
API-Stabilität, keine Notwendigkeit.

## Die Migration fasst zwei Funktionen an

`MemberCard` wird auch von `AdminMitgliederPage` gespeist, und die Admin-Spec
verlangt ausdrücklich, dass die übrigen Spalten von `admin_list_members` denen
von `search_directory` entsprechen — geprüft in `admin_member_list_test.sql`,
sowohl auf Spaltenliste als auch auf Zeileninhalt. `cover_url` nur in einer der
beiden brächte TypeScript und den Paritätstest zu Fall.

Die Anforderung selbst bleibt wahr und braucht kein Delta: sie nennt keine
Spaltenliste, sondern fordert Übereinstimmung. Erweitert werden müssen **beide
Funktionen**, der Paritätstest und der Typ.
