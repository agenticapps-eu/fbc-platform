# Design — ohne Session nicht abfragen

## Die eine Entscheidung: den vorhandenen `uid` durchreichen, nicht die Session lesen

Zwei Wege führen zum Ziel.

**A — die Session im Lesepfad selbst holen.** `fetchAuthors` fragt
`supabase.auth.getSession()` und entscheidet danach. Kein Aufrufer ändert sich.

**B — den `uid` durchreichen, den es schon gibt.** `fetchAuthors` und
`hostsFor` bekommen `uid: string | null` als Parameter; die Aufrufer halten ihn
bereits.

**Gewählt: B.** Drei Gründe, in dieser Reihenfolge:

1. **`uid` ist bereits die dokumentierte Antwort auf genau diese Frage.**
   `FetchFeedArgs.uid` trägt seit AGE-528 den Kommentar „Eigene Profil-ID (für
   `likedByMe`); null = ausgeloggt", und `fetchEvents(uid)` / `fetchEvent(uid,
   id)` führen ihn schon. Ein zweiter Session-Begriff daneben hieße, dieselbe
   Frage im selben Modul auf zwei Arten zu beantworten.
2. **Es ist derselbe Begriff, den die Anzeige schon benutzt.**
   `displayAuthor(post.author, currentUserId !== null)` entscheidet oben mit
   genau diesem Wert. B bringt Lesepfad und Anzeige auf **eine** Bedingung; A
   stellte eine zweite daneben, die auseinanderlaufen kann.
3. **A fügt einen `await` in einen Pfad ein, der heute synchron entscheidet.**
   `getSession()` ist asynchron; in `hostsFor` liefe er vor einem
   `Promise.all`, das gerade darum existiert, zwei Abfragen zu parallelisieren.

Der Preis von B ist eine geänderte Signatur an zwei modulinternen Funktionen.
Beide sind nicht exportiert, alle Aufrufer liegen in derselben Datei und halten
den Wert bereits.

## Was der Plan-Review am Zuschnitt geändert hat

- **`hostsFor` überspringt ausgeloggt beide Hälften, nicht nur eine.** Die
  erste Fassung wollte `partners` weiterlaufen lassen, weil sie es für
  öffentlich lesbar hielt. Es ist `authenticated`-only
  (`20260715140000_explicit_grants.sql:62`, dazu die Anforderung „Partner reads
  are gated behind authentication"). Ein Event erscheint ausgeloggt also ohne
  jede Host-Angabe — die einzige sichtbare Verhaltensänderung dieses Changes.
- **`fetchComments` ist kein anon-Pfad und bleibt unberührt.** `comments`
  trägt `select` ebenfalls nur für `authenticated` (`:67`). Ausgeloggt gibt es
  keine Kommentarzeilen, also nie Autoren-IDs, also — wegen des
  `ids.length === 0`-Vorlaufs in `fetchAuthors` — heute schon keine Abfrage.
  Ihn mitzunehmen wäre Vorsorge für einen Aufrufer, den es nicht gibt.

## Was ausdrücklich **nicht** geschieht

- **Kein Grant für `anon`.** Die Produktfrage ist entschieden.
  `profiles_public` läuft mit `security_invoker = off`, und vier
  SECURITY-DEFINER-RPCs duplizieren ihr Prädikat — wer dort etwas anfasst, muss
  drei Stellen treffen. Hier wird nichts angefasst.
- **Kein neuer Sicherheitsanspruch.** Dieser Change spart eine Anfrage ein, die
  ohnehin abgewiesen wird. Die Grenze bleibt das fehlende Recht; die
  Maskierung der Anzeige bleibt `displayAuthor`.
- **Kein Umbau am Anzeigecode.** `authorOf()` liefert bereits den Rückfall,
  wenn die Karte einen Autor nicht kennt; ausgeloggt ist die Karte künftig
  immer leer, also greift genau dieser Zweig. Darüber maskiert `displayAuthor`
  ohnehin.
- **`fetchAttendees` bleibt draußen.** Beide Aufrufer nehmen `uid: string`,
  sind also nur eingeloggt montiert.

## Wie das rot werden kann

Die Abnahme verlangt „am Netzwerkverkehr belegt, nicht am Aussehen" — und
genau deshalb genügt ein Test auf die gerenderte Zeile **nicht**: Er wäre vor
*und* nach der Änderung grün, weil `displayAuthor` das Aussehen schon vorher
entschied. Der Test muss die Abfrage selbst zählen:

- **RED-Bedingung:** der Supabase-Client wird gestubbt, `from()` führt Buch
  über die angefragten Relationen. Ausgeloggt steht `profiles_public` heute
  einmal darin und soll gar nicht darin stehen; bei den Events zusätzlich
  `partners`.
- **Gegenprobe im selben Test:** eingeloggt stehen beide weiterhin darin und
  die aufgelösten Namen sind da — sonst griffe die Bedingung zu breit.
- **Kein neuer Test auf „Ein Mitglied".** Den hält `displayAuthor.test.ts`
  bereits, und er ist grün. Ihn hier zu wiederholen hieße, eine bestehende
  Zusage als neue auszugeben.

Die Sichtprobe auf der Live-Seite (ausgeloggt, `/`, `/aktivitaet`, `/events`
und `/events/:id`, Konsole leer, null verbotene Anfragen) ist die letzte
Bedingung und kommt nach dem Ausrollen — im Test ist sie nicht erreichbar.
