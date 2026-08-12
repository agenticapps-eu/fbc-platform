# Diff review — anon-skips-author-enrichment

Stufe 2 des Reviews: ein unabhängiger Leser auf dem **Diff**, nicht auf dem
Plan. Anderer Vendor als der eigene.

## Reviewer: codex (gpt-5.2-codex)

VERDICT: REQUEST-CHANGES

[MEDIUM] `src/lib/feed.ts:439` — `fetchComments(null, postId)` fragt weiterhin
`comments` ab, obwohl die Relation `authenticated`-only ist. Ein bereits
geöffneter Kommentar-Thread könne nach dem Verlust der Session nachladen und
damit die verbotene anonyme Abfrage auslösen. Die neuen Tests deckten nur den
eingeloggten Kommentarpfad ab.

## Resolution

**Bestätigt und behoben.** Der Weg dorthin wurde am Code nachgeprüft, nicht
geglaubt:

Der Aufklapp-Knopf ist ausgeloggt `disabled`
(`CommunityFeed.tsx:722`), ein anonymer Besucher kann den Thread also nicht
öffnen — insofern war meine Annahme „kein anon-Pfad" nicht ganz falsch. Der
Fall, den codex beschreibt, ist aber ein anderer und trägt: **eingeloggt
aufklappen, dann abmelden.** `showComments` ist Zustand der Beitragskarte und
überlebt das; `commentsQueryKey(currentUserId, postId)` wechselt auf `null`,
React Query holt unter dem neuen Schlüssel nach — und läuft in den dritten
401.

Damit fällt es genau in die Regel dieses Changes („ohne Session wird nicht
gefragt, was ohne Session nicht lesbar ist") und in die Abnahmezeile „Konsole
ausgeloggt fehlerfrei". Also übernommen:

- Rot zuerst: neuer Test „fragt ohne Session gar nicht erst nach Kommentaren"
  — schlug mit `expected [ 'comments' ] to not include 'comments'` fehl.
- Dann grün: `if (!uid) return [];` als erste Zeile in `fetchComments`, mit
  einem Kommentarkopf, der den Abmelde-Fall benennt statt nur die Regel.
- Nebeneffekt, der besser ist als vorher: die Tafel zeigt jetzt „Noch keine
  Kommentare" statt einer roten Fehlerzeile.

**Dritter Fund derselben Art in diesem Change** — nach `partners` (Plan-Review)
und der `fetchComments`-Signatur (beim Umsetzen). Das Muster ist jedes Mal
dasselbe: eine Relation, die für `anon` gesperrt ist, wird trotzdem angefragt,
weil der Lesepfad die Session nicht kennt.

## Und die naheliegende nächste Frage: gibt es eine vierte?

Nicht raten, sondern nachsehen. Die Positivliste steht in
`20260715140000_explicit_grants.sql`: `anon` darf `badges`,
`membership_tiers`, `partner_categories`, `posts`, `events`, `tags` und
`post_media` lesen, dazu die beiden Zähler-RPCs. Dem gegenübergestellt, was die
vier öffentlichen Flächen wirklich anfragen:

| Relation | ausgeloggt angefragt? | Recht |
| -- | -- | -- |
| `posts`, `post_media`, `events`, `tags` | ja | erteilt ✅ |
| `post_engagement_counts`, `event_registration_counts` | ja (RPC) | erteilt ✅ |
| `post_likes` | **nein** — `if (uid)` seit jeher (`feed.ts:406`) | nur authenticated |
| `event_registrations` | **nein** — `if (!uid …)` in `myStatuses` | nur authenticated |
| `profiles_public`, `partners`, `comments` | **nein, seit diesem Change** | nur authenticated |

Es gibt also keine vierte — und die beiden vorletzten Zeilen sind der eigentlich
interessante Fund: `post_likes` und `event_registrations` waren **schon immer**
auf `uid` gegated. Der Hausbrauch war da, drei Lesepfade folgten ihm nur nicht.
Das ist auch die Antwort auf die Frage, warum der `uid`-Parameter der richtige
Weg war und nicht `getSession()`: es ist derselbe Griff, den die Datei an zwei
Stellen bereits tut.

Statt diese Zählung als Prosa zu hinterlassen, steht sie jetzt als Test da
(„Die Regel, nicht der Einzelfall"): ausgeloggt darf **keine** Relation
angefragt werden, die nicht auf der Positivliste steht. Ein vierter Verstoß
fiele dort auf, ohne dass jemand ihn vorher erraten muss. Dass die Sonde rot
werden kann, wurde nachgewiesen — mit entferntem `hostsFor`-Riegel fällt sie
zusammen mit zwei anderen.
