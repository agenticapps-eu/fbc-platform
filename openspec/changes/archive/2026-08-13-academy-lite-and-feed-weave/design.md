# Design — die Entscheidungen, die dieser Change festlegt

Der Plan-Review (`REVIEWS.md`, drei Anbieter, dreimal REQUEST-CHANGES) hat §2
gekippt und §1 korrigiert. Beide Abschnitte tragen jetzt die gewählte
Alternative **und** die verworfene, mit dem Grund für den Wechsel.

## 1. Sichtbarkeit: zwei Trigger statt eines Joins in der Policy

AGE-533 lässt die Wahl offen und verlangt eine Begründung. Hier ist sie.

### Die Aufgabe

Ein Beitrag zu einem `members`-Event darf nicht als `public` im Feed landen.
Und wenn ein Host die Sichtbarkeit seines Events später ändert, muss der
Beitrag nachziehen — sonst hat ein `public` gewordenes Event einen unsichtbaren
Feed-Eintrag, oder schlimmer: ein `members` gewordenes Event einen öffentlichen.

### Weg A — Join in der Policy (verworfen)

Der Beitrag trägt keine eigene Sichtbarkeit; die Policy leitet sie für
`kind = 'event'` aus `events` ab. Formal die sauberste Lösung: es gibt genau
eine Wahrheit, und sie kann nicht driften.

Verworfen aus drei Gründen:

**Das Prädikat müsste an vier Stellen stehen.** Sichtbarkeit von `posts` wird
heute an vier Orten entschieden — der Entwurf zählte drei, `post_media_lesbar`
fehlte (Befund codex, MEDIUM):

1. `posts_select_public_anon` — anon
2. `posts_select_by_visibility` — authenticated
3. `post_engagement_counts` — `SECURITY DEFINER`, umgeht die RLS bewusst
4. `post_media_lesbar` — `SECURITY DEFINER`, spiegelt dasselbe Prädikat für die
   Signaturvergabe im Bucket (20260812090000)

Ein Join müsste in alle vier. Das ist wörtlich die Falle, die AGE-495 mit
`profiles_public` beschrieben und AGE-530 noch einmal bezahlt hat: „Jedes neue
Gate braucht drei Stellen, sonst ist es Kulisse." Es sind hier sogar vier, und
dass der Entwurf sich um eine verzählt hat, ist selbst das beste Argument gegen
diesen Weg.

**`posts.visibility` würde für Event-Zeilen zur Falschaussage.** Die Spalte ist
`not null` mit Default `members`. Bei Weg A stünde dort ein Wert, den niemand
auswertet — der nächste Leser des Schemas glaubt ihm.

**Kosten pro Zeile.** Der Feed ist eine Keyset-Abfrage über
`posts_created_at_id_idx`. Ein `exists`-Join in das RLS-Prädikat läuft für
**jede** gelesene Zeile, nicht nur für Event-Zeilen.

### Weg B — Sichtbarkeit spiegeln, zwei Trigger (gewählt)

`trg_event_feed_post` (`after insert on events`) legt den Beitrag mit
`visibility = new.visibility` an. `trg_event_feed_sync`
(`after update of visibility, host_id on events`) zieht ihn nach.

Alle bestehenden Policies, die beiden DEFINER-Funktionen, der Index und der
Client bleiben unverändert — ein Event-Beitrag ist für sie eine gewöhnliche
`posts`-Zeile. Die Regel steht an **einer** Stelle: dem Trigger-Paar.

**Was gespiegelt wird, ist kein Inhalt.** Die Zusage aus AGE-533 lautet: kein
kopierter Titel, kein kopiertes Datum, kein kopiertes Bild. `visibility` ist
keines davon — es ist eine Zugriffsentscheidung, und AGE-533 schreibt sie
selbst vor („Der Trigger übernimmt `events.visibility`"). Der Unterschied ist
nicht Wortklauberei: Inhalt wird gelesen und veraltet still, eine
Zugriffsentscheidung wird **erzwungen** und ihr Nachziehen ist testbar.

**Der Preis, benannt:** ein Nachlauf existiert. Zwischen dem `update` auf
`events` und dem Trigger liegt nichts — beide sind in derselben Transaktion —,
aber ein bereits geladener Feed im Browser zeigt bis zum nächsten Abruf den
alten Stand. Dasselbe gilt heute schon für jede Sichtbarkeitsänderung und für
die eine Stunde Gültigkeit signierter Bild-URLs.

### Der Lebenszyklus von `host_id` — vollständig, nicht nur `visibility`

Zwei Reviewer unabhängig voneinander (codex MEDIUM, opencode HIGH): der Entwurf
hörte nur auf `visibility`. Ein Event, das ohne Host entsteht und später einen
bekommt, käme nie in den Feed; ein Hostwechsel ließe den alten Autor stehen.
Beides ist bei admin-gepflegten Events kein Exot.

Der Update-Trigger hört deshalb auf **beide** Spalten und deckt alle Übergänge:

| Übergang | Wirkung auf den Feed-Beitrag |
|---|---|
| `null → Host` | der fehlende Beitrag entsteht jetzt |
| `Host → anderer Host` | `author_id` zieht nach |
| `Host → null` | der Beitrag wird entfernt |
| `visibility` ändert sich | `visibility` zieht nach |

`Host → null` entfernt statt zu behalten, weil `posts.author_id` `not null` ist
— es gäbe niemanden, dem der Beitrag gehört. Das ist dieselbe Regel wie beim
Anlegen („kein Host, kein Beitrag"), nur später angewandt.

### Event-Beiträge sind systemverwaltet, nicht bloß automatisch erzeugt

Der schwerste Befund des Reviews (codex, HIGH). `posts_write_own` ist `for all`
auf `author_id = auth.uid()` — und der Host **ist** der Autor seines
Event-Beitrags. Er konnte ihn also löschen, auf `kind = 'member'` umschreiben
oder die vom Trigger gesetzte Sichtbarkeit danach wieder ändern. Die
Eindeutigkeit und die Sichtbarkeitsspiegelung galten damit nur zufällig: der
Trigger setzte sie, und nichts hielt sie.

`posts_write_own` verlangt künftig `kind = 'member'` im `using` und
zusätzlich `ref_id is null` im `with check`. Danach kann kein Nutzer eine
Event-Zeile anlegen, ändern oder löschen — nur die beiden DEFINER-Trigger
schreiben sie, und Events verschwinden über die Kaskade.

Daraus folgt eine zweite Zusage, die vorher nur zufällig galt: **ein
Event-Beitrag trägt niemals `post_media`.** Der Trigger legt keine an, und
niemand kann welche nachtragen. Deshalb ist `post_media_lesbar` — die vierte
Spiegelstelle oben — von diesem Change nicht betroffen.

### Die Asymmetrie, die dabei sichtbar wird

`events_select_by_visibility` lässt **jedes bestätigte Konto** `public` *und*
`members` lesen — die Stufung sitzt bei Events in der Anmeldung, nicht in der
Sichtbarkeit (AGE-448, so gewollt). `posts_select_by_visibility` verlangt für
`members` dagegen Rang 4 (`exchange`).

Ein gespiegelter Beitrag ist damit **strenger** als sein Event: ein Mitglied auf
Rang 1–3 sieht das `members`-Event unter /events, aber nicht seinen Eintrag im
Feed. Die Richtung ist die ungefährliche (strenger, nicht undichter), und zum
Go-Live sind alle Konten `impact` (Rang 6).

gemini verlangt dafür eine ausdrückliche Produktentscheidung statt einer Notiz.
**Sie ist hiermit getroffen: die Asymmetrie bleibt, ohne erklärenden UI-Text.**
Ein Hinweis würde einen Zustand erklären, den zum Go-Live niemand erlebt. Ein
pgTAP-Fall hält sie fest, damit eine spätere Änderung eine Entscheidung ist und
kein Unfall.

### Was `events` nicht kennt

Ein Entwurfszustand. Gemessen, nicht angenommen (Frage von opencode): `events`
trägt keine Status-Spalte — die `status`-Spalte im selben Migrationsskript
gehört zu `event_registrations`. **`insert` heißt veröffentlicht**, und der
Trigger darf deshalb bedingungslos anlegen. Bekäme `events` je einen
Entwurfszustand, wäre dieser Trigger die erste Stelle, die ein Prädikat braucht.

## 2. `video_url` wird auf dem Server abgeleitet — die Kehrtwende dieses Reviews

### Was hier vorher stand, und warum es falsch war

Der Entwurf ließ den Client `extractFirstVideo(body)` rechnen und den Wert an
die RPC übergeben. Begründung: nur **ein** Parser, also könne `video_url` und
das gerenderte Embed nicht auseinanderlaufen.

**Diese Zusage ist nicht durchsetzbar** (codex, HIGH). `posts_write_own` gibt
`authenticated` INSERT und UPDATE direkt auf `posts`; die RPC ist nicht der
einzige Schreibweg, sie ist nur der bequeme. Ein Client kann ein `video_url`
setzen, das im Body nicht vorkommt, oder einen Videolink im Body lassen und
`video_url` leer. Dann steht ein Beitrag in der Academy, dessen Karte etwas
anderes zeigt — genau die Drift, gegen die der Entwurf antrat.

### Was jetzt gilt

Die Ableitung wandert in die Datenbank:

- **`public.erste_video_url(text)`** — eine `immutable` SQL-Funktion, die
  `parseVideoUrl` Fall für Fall nachbildet.
- **`trg_posts_video_url`** (`before insert or update on posts`) setzt
  `video_url` **immer** neu aus `body`. Ein von Hand gesetzter Wert wird
  überschrieben; es gibt keinen Schreibweg daran vorbei. Bewusst auf *jedem*
  Update, nicht nur bei `update of body`: sonst käme ein
  `update posts set video_url = …` am Trigger vorbei.
- **Der Backfill ruft dieselbe Funktion.** Backfill und Laufzeit sind damit per
  Konstruktion identisch, nicht per Zusicherung.
- **Die Karte bettet `post.video_url` ein**, statt den Body erneut zu parsen.

Damit gibt es genau einen Wert, und er ist nicht fälschbar. Der Check-Constraint
aus dem Entwurf entfällt: der Trigger ist die Garantie, und ein Constraint, den
nur die eigene Funktion verletzen könnte, prüft nichts.

### Der Preis, und wie er bezahlt wird

Es gibt jetzt **zwei Erkenner**: `erste_video_url` in SQL und `parseVideoUrl` in
TypeScript. Das ist genau, was der Entwurf vermeiden wollte — der Unterschied
ist, dass die Parität hier **benennbar und testbar** ist, während die alte
Zusage nur behauptet werden konnte.

Die Arbeitsteilung, damit die beiden nicht dieselbe Frage doppelt beantworten:

- **SQL entscheidet, *ob* ein Body ein Video enthält und *welche* URL das ist.**
- **TypeScript entscheidet, *wie* diese URL eingebettet wird** (`parseVideoUrl`
  baut die Embed-URL, `VideoEmbed` rendert sie).

Die Paritätsprüfung ist die Bedingung dafür, und sie ist scharf: **alle**
Fixtures aus `feed.test.ts` laufen durch `erste_video_url`, und was der eine
akzeptiert, muss der andere akzeptieren. Zwei Fehler des Entwurfs hat der Review
genau hier gefunden:

1. **`~` ist case-sensitive, `parseVideoUrl` lowercased den Host**
   (`feed.ts:165`). `https://WWW.YouTube.com/watch?v=X` hätte SQL abgelehnt und
   TypeScript akzeptiert. → `~*`.
2. **`youtube-nocookie` gehört nicht dazu**, obwohl ein Reviewer es vorschlägt:
   `parseVideoUrl` kennt diesen Host nicht. Die Liste wird aus dem Code
   abgeleitet, nicht aus dem Gedächtnis ergänzt — sonst entsteht die Drift an
   der Stelle, die sie verhindern soll.

Die Host-Grenze ist verankert (`^https?://(www\.)?…$` mit Pfadgrenze), damit
`youtube.com.evil.example` durchfällt. Der Entwurf hatte das zufällig richtig
und nirgends zugesagt; jetzt ist es Anforderung mit Negativfall.

### Was die Kehrtwende sonst noch aufräumt

Die RPC `create_post_with_media` wird **gar nicht angefasst**. Damit entfallen
`drop function`, die Signaturfrage, der Default-Parameter, das
Wiederherstellen von Grants und `security definer`, der PostgREST-Schema-Cache
und das Deploy-Fenster — fünf Befunde aus drei Reviews auf einmal, und der
Change wird kleiner statt größer.

## 3. „Meine Academy" trägt zwei Regale: geteilt und geliked

Entscheidung Donald, 2026-08-13. AGE-533 ließ sie ausdrücklich offen („beim Bau
entscheiden"); sie ist damit getroffen und keine offene Frage mehr.

Möglich ist es, weil `post_likes` **owner-only lesbar** ist (`likes_write_own`,
`for all`, `profile_id = auth.uid()`): die eigenen Like-Zeilen kommen zurück,
fremde nie. Das Regal liest also die eigenen Likes, löst deren `post_id` gegen
`posts` mit `video_url` auf, und die RLS von `posts` entscheidet den Rest.

**Drei Eigenschaften, die daraus folgen und die niemand später als Fehler
melden soll:**

Ein geliktes Video kann **verschwinden**, ohne dass der Like weg ist. Sinkt
die Stufe des Betrachters unter Rang 4, oder wechselt der Autor seinen Beitrag
auf `members`, liefert die RLS die Beitragszeile nicht mehr — die Like-Zeile
bleibt liegen und zeigt ins Leere. Das Regal lässt solche Einträge schlicht
weg, ohne Lücke und ohne Fehler. Ein Like ist eine Markierung, kein
Zugriffsrecht.

Das Regal ist **nicht** „gemerkt" im Sinne eines eigenen Merkzettels, und der
Grund ist härter als die Begriffsverwirrung, die gemini benennt: **ein Like ist
hier nicht privat.** `post_engagement_counts` gibt den Zähler an jeden aus, der
den Beitrag sehen darf. Wer etwas „merkt", erhöht also eine sichtbare Zahl;
verborgen bleibt nur, *wer* es war. Eine Beschriftung „Gemerkt" sagt damit
Privatheit zu, die es nicht gibt — deshalb steht im Delta ausdrücklich, dass
das Regal als „gefällt mir"-Liste zu benennen ist. Ein echtes, stilles
Speichern wäre eine eigene Tabelle mit eigener RLS und damit der Anfang des
Kurs-Schemas aus AGE-262.

**Sortiert wird nach dem Zeitpunkt des Likes**, nicht nach dem des Beitrags
(offene Annahme, die codex zu Recht benennt). Ein Regal der eigenen
Markierungen beantwortet „was habe ich zuletzt vorgemerkt", nicht „was ist neu"
— die zweite Frage beantwortet der Reiter „Alle". `post_likes.created_at` trägt
den Wert bereits.

**Ein eigenes, zugleich geliktes Video steht in beiden Regalen.** Sie
beantworten verschiedene Fragen, und ein Ausschluss wäre eine Regel, die man
sich merken müsste.

Der Preis ist bezahlt und benannt: eine zweite Abfrage, ein zweiter leerer
Zustand, ein zweiter Ladezustand, ein zweiter Testsatz.

## 4. Bestehende Events bekommen ihren Feed-Beitrag nachträglich

Entscheidung Donald, 2026-08-13: ja, mit dem Datum des Events.

Ohne Backfill hätte der Feed am 17.08. keinen einzigen Event-Eintrag — die
bestehenden Events (DEV 9 Zeilen; PROD nicht leer) sind vor dem Trigger
entstanden. Der Backfill setzt `posts.created_at = events.created_at`, nicht
`now()`: sonst stünden alte Events als frischeste Beiträge ganz oben und
verdrängten den echten Feed.

Übersprungen werden Events ohne `host_id` — dieselbe Regel wie im Trigger, aus
demselben Grund. In DEV ist dieser Zweig unbesetzt (0 von 9); er bleibt
trotzdem, weil die Spalte nullable *ist*.

## 5. Beide Migrationen ändern die Basis bestehender Tests

Kein Entwurfsproblem, sondern eine Nebenwirkung, die nur ein Reviewer gesehen
hat (opencode, MEDIUM) und die still schiefgeht: **ab Migration B erzeugt jedes
`insert into events` — in jedem pgTAP-Fall, jeder Fixtur, jedem Seed — eine
zusätzliche `posts`-Zeile.**

Jede bestehende Behauptung, die Beiträge zählt oder „genau n Zeilen" verlangt,
steht damit auf einer anderen Basis. Der gefährliche Ausgang ist nicht der
gebrochene Test — es ist der, der zufällig grün bleibt.

Deshalb ist die Prüfung eine eigene Aufgabe (5.8) und sie lautet nicht „die
Suite ist grün", sondern „jede Zählung auf `posts` ist einzeln angesehen".
