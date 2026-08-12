## Why

Linear: **AGE-530**, gefunden am 2026-08-12 auf der Live-Seite beim Abschluss
von AGE-528.

Ausgeloggt setzt der Client Abfragen ab, für die er nachweislich kein Recht
hat, und kassiert je Seitenaufruf eine Abweisung:

```
GET /rest/v1/profiles_public?select=id,name,avatar_url,tier&id=in.(…)  →  401
{"code":"42501","message":"permission denied for view profiles_public"}
```

Das ist kein Versehen in der Datenbank. `profiles_public` trägt für `anon`
bewusst kein Leserecht (AGE-239), Donald hat am 2026-08-12 bestätigt: Namen
bleiben für Nicht-Mitglieder unsichtbar. **Es wird kein Grant ergänzt, an der
Datenbank ändert sich nichts.**

### Was der Plan-Review an der Begründung korrigiert hat

Die erste Fassung dieses Vorschlags — und Punkt 3 des Issues — behauptete, die
Anonymisierung hänge **ausschließlich** am fehlenden Recht, ein späteres Grant
ließe also sofort Namen austreten. **Das stimmt nicht.**
`src/lib/displayAuthor.ts:21` maskiert bedingungslos, sobald keine Session da
ist, und liefert „Ein Mitglied" mit leerem Avatar; benutzt wird es im Feed
(`CommunityFeed.tsx:614`), an den Kommentaren (`:1055`) und auf der Startseite
(`HomePage.tsx:180`), und ein grüner Test hält es fest
(`src/lib/displayAuthor.test.ts`). Die Regel ist also bereits ausgesprochen —
an der Anzeige, nicht am Lesepfad.

Ebenso korrigiert: die Behauptung, das Rauschen erreiche **Sentry**.
`fetchAuthors` und `hostsFor` schlucken ihren Fehler (`if (error) return
byId`); `captureException` steht nur an Medien und Zählern. Es bleibt bei der
Browser-Konsole und einem Breadcrumb.

### Was danach übrig bleibt — und weiterhin trägt

**Der Client stellt Anfragen, von denen er weiß, dass sie abgewiesen werden.**

1. **Eine überflüssige Rundreise je Seitenaufruf** auf genau den drei Seiten,
   die Nicht-Mitglieder sehen — und auf `/events` sind es **zwei**, siehe
   unten.
2. **Ein 401 in der Konsole der öffentlichen Seiten.** Wer dort etwas debuggt,
   sucht zuerst an der falschen Stelle.
3. **Der Lesepfad widerspricht der Anzeige.** `displayAuthor` sagt „ohne
   Session zeigen wir keine Namen", der Lesepfad daneben holt sie trotzdem —
   beziehungsweise versucht es. Zwei Schichten, zwei Meinungen; eine davon ist
   überflüssig.

## What Changes

**Ohne Session wird nicht abgefragt, was ohne Session nicht lesbar ist.**

- **`src/lib/feed.ts`** — `fetchAuthors` nimmt die bereits vorhandene
  Profil-Kennung entgegen und gibt ohne sie eine leere Karte zurück, ohne zu
  fragen. `fetchFeed` reicht sein `uid` durch.
- **`src/lib/events.ts`** — `hostsFor` überspringt ohne Session **beide**
  Hälften, `profiles_public` **und** `partners`. `fetchEvents` und
  `fetchEvent` tragen `uid` bereits.

### Zwei Korrekturen am Umfang, beide aus dem Plan-Review

- **`partners` ist ebenfalls nur für `authenticated` lesbar** —
  `20260715140000_explicit_grants.sql:62` erteilt `select` ausschließlich dort,
  und `openspec/specs/partners/spec.md` führt es als Anforderung („Anonymous
  partner read is denied"). Die erste Fassung wollte die Partner-Hälfte
  ausdrücklich weiterlaufen lassen und hätte damit den zweiten 401 stehen
  gelassen, während der Vorschlag „Konsole fehlerfrei" verspricht. Ausgeloggt
  erscheint ein Event künftig **ohne jede Host-Angabe**.
- **`fetchComments` fliegt raus.** `comments` trägt sein `select` ebenfalls nur
  für `authenticated` (`explicit_grants.sql:67`); ausgeloggt gibt es keine
  Kommentare zu lesen, also auch keine Autoren anzureichern. Ein Test, der
  einen erfolgreichen anonymen Kommentarabruf vortäuscht, prüfte einen
  Zustand, den es nicht gibt.

**Der Umfang bleibt gegenüber dem Issue erweitert** (Donald, 2026-08-12):
AGE-530 nennt nur den Feed, aber `/`, `/events` und `/events/:id` sind ebenso
ohne `requiresAuth` erreichbar (`src/config/nav.ts:57,65`, `src/App.tsx:121`)
und feuern dieselben Abfragen — `HomePage.tsx:49,53` ruft `fetchEvents` **und**
`fetchFeed`.

## Impact

- **Keine Datenbank-Änderung.** Keine Migration, kein Grant, keine Policy.
- **Ausgeloggt ändert sich das Aussehen an einer Stelle**: ein Event mit
  Profil- oder Partner-Host erscheint künftig ohne Host-Angabe statt mit einer,
  die ohnehin nie ankam. Autoren hießen vorher „Ein Mitglied" und heißen
  weiter so — dort ändert sich nichts, weil `displayAuthor` das schon vorher
  entschied.
- **Eingeloggt ändert sich nichts.** Die Gegenprobe ist Abnahmebedingung.
- **Kein neuer Sicherheitsanspruch.** Die Grenze bleibt das fehlende Grant;
  dieser Change spart eine bekannte, verbotene Anfrage ein, mehr nicht. Ein
  späteres Grant für `anon` bliebe eine Datenbank-Entscheidung — die Anzeige
  hielte über `displayAuthor` weiterhin dicht.
- `fetchAttendees` (`src/lib/events.ts:347`) liest ebenfalls
  `profiles_public`, bleibt aber **draußen**: beide Aufrufer (`RatePanel`,
  `HostTools`) sind hinter `uid: string` montiert und nie ausgeloggt
  erreichbar.
