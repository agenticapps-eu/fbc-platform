# Entwurf — woher die Unterhaltungsliste ihre Seite bekommt

Dieses Dokument existiert, weil die Plan-Review (REVIEWS.md) an genau dieser
Stelle beide Anbieter unabhängig voneinander zu **REQUEST-CHANGES** gebracht
hat. Die erste Fassung des Vorschlags versprach eine serverseitig sortierte,
begrenzte Seite **und** „keine Migration, kein Server". Das ist nicht beides zu
haben.

## Das Problem, genau benannt

Die Liste braucht: **die N zuletzt bewegten Threads, je mit einer Vorschauzeile.**

Heute (`src/lib/chat.ts:240–265`) entsteht das so:

1. alle Threads laden (kein Limit),
2. alle Nachrichten aller dieser Threads laden (kein Limit), absteigend,
3. im Client per `reduce` die jüngste je Thread nehmen.

Schritt 2 ist der Kostentreiber. Aber er lässt sich nicht einfach begrenzen:

**PostgREST kann nicht nach einer Aggregatfunktion über eine to-many-Relation
sortieren.** `max(messages.created_at)` je Thread als Sortierschlüssel der
Thread-Abfrage ist nicht ausdrückbar — nach Kindspalten sortieren geht nur für
to-one-Beziehungen. Und „genau eine Nachricht je Thread" ist in einer einzigen
PostgREST-Abfrage ebenfalls nicht ausdrückbar; `limit` gilt für das Ergebnis,
nicht je Gruppe.

Ohne Server-Artefakt bleibt also nur: alles laden und im Client sortieren —
also genau das, was abgeschafft werden soll.

## Die Entscheidung: denormalisierte Aktivitätsspalten mit DEFINER-Trigger

`message_threads` bekommt drei Spalten, geschrieben von einem Trigger auf
`messages`:

| Spalte | Wofür |
| --- | --- |
| `last_message_at` | Sortierschlüssel — macht `order` + `limit` serverseitig möglich |
| `last_message_body` | die Vorschauzeile, ohne eine zweite Abfrage |
| `last_message_sender_id` | „Du: …" vs. Name des Partners |

Danach ist die Liste **eine** Abfrage: `message_threads` nach
`last_message_at desc`, mit `range`, plus die Partnerzeilen. Die
`messages`-Tabelle wird für die Liste **gar nicht mehr angefasst**.

Verworfen: **eine DEFINER-RPC**, die die Seite fertig liefert (`distinct on` +
Fensterfunktion). Sie käme ohne Schema-Umbau aus, aber sie legt das
Sichtbarkeitsprädikat an eine zweite Stelle neben die RLS — genau die Falle, die
`profiles_public` mit seinen vier Funktionen aufgemacht hat. Eine Spalte, die
unter der bestehenden Policy liegt, dupliziert nichts.

## Warum diese Spalten keine Lesebestätigung sind

`supabase/tests/grants_test.sql:130–146` hält ausdrücklich fest, dass
`message_threads` **kein UPDATE-Recht** trägt, auch kein spaltenweises — und
warum: AGE-583 hatte zwei Lesestand-Spalten genau hier vorgeschlagen; sie wären
für den Gesprächspartner lesbar gewesen und damit eine Lesebestätigung. Der
Lesestand liegt seitdem in `thread_read_positions`.

Dieser Entwurf steht **nicht** im Widerspruch dazu, und das ist gemessen, nicht
angenommen:

- `threads_select` gibt eine Thread-Zeile den **zwei Teilnehmern** frei
  (`20260806080100:214–219`).
- `messages_select` gibt eine Nachricht **denselben zwei Teilnehmern** frei
  (`20260806080100:221–231`).

Beide Prädikate reichen exakt gleich weit. Wer `last_message_body` lesen kann,
konnte dieselbe Nachricht schon vorher lesen. **Es entsteht keine neue
Preisgabe** — anders als bei einem Lesestand, der eine Information über das
*Verhalten* des anderen wäre, die es sonst nirgends gibt.

Und das UPDATE-Recht bleibt weg: der Trigger ist `security definer`. Der Client
schreibt diese Spalten nie, kann es nicht, und der Golden-Snapshot in
`grants_test.sql` bleibt unverändert — er listet UPDATE-Spalten-Grants, und wir
sprechen keinen aus.

### Nachtrag aus der Umsetzung: „kann es nicht" hatte zwei Türen

Beim Bauen von Band 1 fiel auf, dass dieser Absatz nur die UPDATE-Tür kannte.
Die zweite steht offen: das **INSERT**-Recht auf `message_threads` besteht
(`20260715140000:68` spricht es tabellenweit aus, `threads_insert` lässt es zu).
Ohne Vorkehrung könnte ein Mitglied beim Anlegen des Threads eine **erfundene
Vorschauzeile** setzen — sichtbar für sein Gegenüber, dem Trigger nie begegnet.

Deshalb ein zweiter, gewöhnlicher Trigger `before insert on message_threads`,
der die drei Werte auf `null` setzt. *Verworfen — den Tabellen-Grant durch
`grant insert (a_profile_id, b_profile_id)` ersetzen:* schlösse dieselbe Tür,
entfernte aber die Zeile `message_threads/authenticated=INSERT,SELECT` aus
`role_table_grants` und bräche den Golden-Snapshot. Ein Snapshot, der sich bei
jeder Vorkehrung bewegt, hört auf, etwas zu sagen.

Ebenfalls aus der Umsetzung: `messages.created_at` ist vom Client setzbar, also
geht der Sortierschlüssel **nur vorwärts** — sonst zöge eine rückdatierte
Nachricht den Thread nach unten und verdrängte die jüngere Vorschauzeile.

### Was das für die Abfrage in Band 2 heißt

`order by … desc` ist in Postgres `nulls first`. Ein Thread **ohne** einzige
Nachricht stünde damit ganz oben, vor jeder laufenden Unterhaltung. Der Index
trägt die Ordnung deshalb als `(last_message_at desc nulls last)` — und die
Abfrage muss `nullsFirst: false` mitgeben, sonst passt sie nicht zum Index und
sortiert die leeren Threads nach vorn.

## Paging: Offset oder Cursor

Codex hat zu Recht angemerkt, dass Offset-Paging auf einer live nach Aktivität
sortierten Liste instabil ist: eine neue Nachricht schiebt Threads zwischen den
Seiten, beim nächsten Offset erscheinen Einträge doppelt oder werden
übersprungen.

**Entscheidung: Offset — bewusst, mit Begründung.**

Der Fehler tritt auf, wenn zwischen zwei Seitenabrufen eine Nachricht eintrifft.
Die Liste zeigt zwanzig Threads je Seite; ein Mitglied, das über die erste Seite
hinaus blättert, hat mehr als zwanzig laufende Unterhaltungen. Bei der heutigen
Größe des Clubs ist das niemand. Cursor-Paging nach `(last_message_at, id)` ist
die richtige Lösung, wenn es so weit ist — und der Trigger legt schon jetzt
genau den Schlüssel an, den ein Cursor bräuchte.

Was daraus folgt und in der Spec steht: die **Sortierung** ist serverseitig und
verbindlich, das **Blättern** ist es noch nicht. Ein `limit` ohne stabile
Sortierung wäre wertlos; ein Cursor ohne Bedarf wäre Vorrat.

## Realtime: ein Abo, nicht zwei

`useUngelesenLive` (`use-ungelesen.ts:63–92`) besitzt heute das **einzige**
globale `messages`-Abo und invalidiert daraus **nur** `unreadQueryKey(uid)`.
`subscribeToAllMessages` (`chat.ts:206`) baut den Kanalnamen mit
`crypto.randomUUID()` — ein zweiter Aufruf macht also ausdrücklich einen
**zweiten Kanal** auf.

Deshalb: **kein zweites Abo.** Der bestehende Hook invalidiert künftig beides,
den Zähler und die Threads-Seite. Das ist eine Zeile mehr in einem Hook, der
schon die richtige Lebensdauer, die richtige Entprellung und das richtige
Aufräumen hat.

Ohne diesen Punkt wäre der sichtbare Fehler: der Ungelesen-Marker erscheint,
aber Vorschautext und Reihenfolge der Liste bleiben stehen. Ein Panel, dessen
Zähler sich bewegt und dessen Liste nicht, sieht kaputt aus — und ist es auch.

## Query-Keys

`threadsQueryKey(uid)` (`chat.ts:232`) kennt keinen Paging-Parameter, und
`ChatPage.tsx` invalidiert unter diesem Schlüssel. Panel und `/chat` würden sich
sonst denselben Cache-Eintrag teilen und einander mit unterschiedlich
vollständigen Ergebnissen überschreiben.

Der Schlüssel bekommt die Seitenparameter. Beide Flächen lesen dieselbe
Funktion mit denselben Parametern — `/chat` ist damit **nicht** unverändert,
sondern lädt ebenfalls eine Seite. Das ist die Auflösung des Widerspruchs, den
beide Reviewer gefunden haben: es gibt nur **eine** Datenquelle mit **einem**
Umfang, und beide Flächen zeigen denselben.

## Was das Panel auf `/chat` selbst tut

Auf `/chat` und `/chat/:threadId` stünde die Liste sonst zweimal auf einem
Schirm — einmal als Seitenkarte im `18rem + 1fr`-Raster der Seite, einmal im
Panel. Auf 1280 px bliebe für die Konversation eine Spalte von etwa 330 px.

**Das Panel blendet auf Chatrouten aus.** Es ist die Abkürzung zu einer Fläche;
auf der Fläche selbst ist es Doppelung.


## Nachtrag aus der Sichtprobe: `xl`, nicht `lg`

Der Plan sagte „angedockt ab `lg`". Am laufenden Bild hält das nicht, und der
Grund liegt nicht in dieser Leiste, sondern in den Rastern, neben denen sie
steht: `MemberDirectory` schaltet mit `sm:grid-cols-2 lg:grid-cols-3` am
**Viewport**, nicht an der Spalte, die es tatsächlich bekommt. Die Leiste
verengt die Spalte, das Raster merkt davon nichts und bleibt dreispaltig.

Gemessen bei 1024 px mit 20 rem angedockt: **433 px** Inhaltsspalte, Namen im
Verzeichnis auf ein Zeichen gekürzt. Mit `xl` und 18 rem sind es bei 1280 px
**721 px** — praktisch die Dichte, die die Anwendung bei 1024 px ohnehin
ausliefert. Das ist die Schwelle, und sie ist ausgerechnet, nicht gewählt: *die
angedockte Leiste darf der Inhaltsspalte nie weniger lassen, als die Anwendung
an ihrer schmalsten angedockten Breite schon ausliefert.*

Zwischen `lg` und `xl` bleibt die Liste als Schublade erreichbar. Es geht also
nichts verloren; es steht nur nicht dauerhaft im Weg.

**Was das offen lässt:** die viewport-gebundenen Raster sind ein allgemeiner
Mangel, den diese Änderung sichtbar gemacht, aber nicht verursacht hat. Container
Queries wären die Antwort — als eigener Vorgang, nicht hier.

## Nachtrag: die Leiste hat zwei Flächen, nicht eine

Im navy-Theme stand ein navyer Kopf über einer weissen Liste. Auflösung:

* **Eingeklappt** ist sie ein Rail wie links — **Chrome**, navy im navy-Theme.
* **Aufgeklappt** trägt sie eine Liste, und die ist **Inhalt**: `ThreadList`
  schreibt `text-ink` auf `hover:bg-soft` und wäre auf Chrome-Fläche unlesbar.
  Ein zweiter, chrome-fähiger Aufguss der Liste widerspräche der Vorgabe, sie
  wiederzuverwenden.

Im hellen Theme ist der Unterschied unsichtbar, weil dort beide Flächen weiss
sind. Er war nur im navy-Theme zu sehen — und nur im Browser.
