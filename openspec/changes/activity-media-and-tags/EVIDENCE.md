# Evidence — C7 (AGE-528)

## Task 1.0 / 1.0b — darf `anon` aus einem privaten Bucket signieren?

Die Frage, an der der ganze Change hängt (`design.md`, „Das eine Risiko").
Gemessen **vor** der ersten Migration, gegen den lokalen Stack.

```
tsx scripts/probe-post-media-signatur.ts
```

Gemessen am 2026-08-11, lokaler Stack (`127.0.0.1:54322` / `:54321`),
Supabase CLI 2.113. Die Sonde baut einen Wegwerf-Aufbau nach demselben Muster
wie das Ziel — privater Bucket, `SECURITY DEFINER`-Prädikat, SELECT-Policy für
`anon` — und räumt ihn wieder ab.

### Ergebnis: ALLE PRUEFUNGEN ERFUELLT

| Fall | Erwartet | Gemessen |
|---|---|---|
| **A** Objekt eines `public`-Beitrags, anon signiert | signierte URL | signierte URL erhalten |
| **A** Abruf der signierten URL | HTTP 200 | **HTTP 200** |
| **A** rohe öffentliche Bucket-URL | HTTP 4xx | **HTTP 400** |
| **B** dasselbe Objekt als `members`-Beitrag | Ablehnung | **abgelehnt: „Object not found"** |
| **C** Objekt ohne `post_media`-Zeile (verwaist) | Ablehnung | **abgelehnt: „Object not found"** |
| **D** nachgebauter Pfad, eigenes Präfix | Ablehnung | **abgelehnt: „Object not found"** |
| **E** 120 Pfade in einem Aufruf | 120 URLs | **120 URLs in 17 ms** |
| **F** Stapel mit einem verbotenen Pfad | 4 von 5 | **4 von 5** |

### Was das entscheidet

**Der gewählte Weg ist gangbar.** Der Rückfallweg aus Task 1.1 (Edge Function
mit `service_role`) wird **nicht** gebraucht; `design.md` bleibt unverändert.

**Drei Befunde, die über die Frage hinausgehen:**

1. **Die Ablehnung lautet „Object not found", nicht „permission denied".**
   Der Storage unterscheidet die beiden Fälle nach außen nicht — für einen
   ausgeloggten Besucher ist ein Bild, das er nicht sehen darf, von einem
   nicht existierenden ununterscheidbar. Das ist gut (keine Aufzählbarkeit),
   hat aber eine Folge für den Code: **ein „not found" beim Signieren ist kein
   Fehlerzustand, den man melden darf** — es ist der Normalfall eines Bildes,
   das den Betrachter nichts angeht. Wer es an Sentry meldet, meldet Rauschen.
   Gehört in Task 5.2a.

2. **17 ms für 120 Signaturen.** Die Sorge aus dem Plan-Review (opencode, LOW),
   die Policy werte je Objekt eine `SECURITY DEFINER`-Funktion mit Join aus und
   das könne teuer werden, ist gegenstandslos — lokal, ohne Netz. Der Wert ist
   die Untergrenze, nicht die Erwartung für DEV; er schließt aber aus, dass die
   Konstruktion selbst das Problem ist.

3. **Teilablehnung bestätigt.** `createSignedUrls` verwirft den Stapel nicht,
   wenn ein Pfad nicht erlaubt ist — es liefert die erlaubten und lässt den
   einen aus. Die Entscheidung in 5.2a (je Bild behandeln, nie den ganzen
   Beitrag verwerfen) ist damit gemessen, nicht vermutet.

### Nebenbefund beim Bauen der Sonde

`storage.protect_delete()` verbietet **direktes SQL-Löschen** in
`storage.objects` / `storage.buckets` („Direct deletion from storage tables is
not allowed"). Aufräumen läuft deshalb über die Storage-API
(`emptyBucket` + `deleteBucket`), Anlegen über `createBucket`. Für die
pgTAP-Fälle in Task 2.1 heißt das: ein Testaufbau, der Objekte per SQL wieder
entfernen will, scheitert am Trigger — nicht an der Policy.

## Block 2 / 3 — RED vor GREEN, und die Gegenprobe darauf

Gemessen am 2026-08-12, lokaler Stack, PostgreSQL 17.6, UTF8, `en_US.UTF-8`.

```
supabase test db --local supabase/tests/rls_test.sql supabase/tests/grants_test.sql
```

### RED — die Tests vor den Migrationen

`rls_test.sql` um §19 (`post_media`, Bucket, RPC) und §20 (`tags`) erweitert,
`plan(255)` → `plan(305)`:

```
ERROR:  relation "public.post_media" does not exist
Failed 50/305 subtests
Parse errors: Bad plan. You planned 305 tests but ran 255.
```

Die 255 bestehenden Zusicherungen bleiben dabei grün — es fällt genau das Neue.

### GREEN — nach den drei Migrationen

`20260812090000_post_media.sql` · `20260812090100_post_media_storage.sql` ·
`20260812090200_tags.sql`, danach `grants_test.sql` nachgezogen (zwei neue
Tabellen im Golden-Snapshot, sonst bricht der `migrations`-Job in CI, ohne dass
`post_media` irgendwo vorkäme):

```
rls_test.sql ..... ok
grants_test.sql .. ok
Files=2, Tests=312    Result: PASS
```

### Die Gegenprobe: hält der Test, wenn die Funktion kaputt ist?

Ein grüner Test, der auch an einer kaputten Policy grün bliebe, ist keine
Zusicherung. `post_media_lesbar()` wurde deshalb zweimal mutiert und die Suite
jedes Mal erneut gefahren.

| Mutation | Gefallen |
|---|---|
| `select true` — das Prädikat sagt immer ja | **9 von 305** |
| das Prädikat **zerlegt den Pfad** statt die Zeile zu lesen | **4 von 307** |

**Und die zweite Mutation hat einen Fehler in den Tests aufgedeckt, nicht im
Code.** Im ersten Anlauf fielen nur die beiden *verwaisten* Fälle — die zwei
Assertions, die den gefälschten Pfad prüfen sollten, blieben **grün**. Der
Grund: mein Fixture trug die Kennung eines `members`-Beitrags, und die ist auch
einer pfad-zerlegenden Fassung verboten. `tasks.md` 2.7a nennt genau diese
untaugliche Variante (`{eigene-uid}/{fremde-members-postId}/…`); `design.md`
beschreibt die scharfe (`{eigene-uid}/{fremde-public-postId}/…`), bei der ein
Pfad-Parser „public" läse und ein Objekt signierte, das zu gar keinem Beitrag
gehört. Zwei Assertions dafür ergänzt (`plan(307)`); danach fallen unter der
Mutation vier statt zwei — die richtigen vier.

### Nebenbefund: `\p{L}` ist in Postgres ein harter Fehler

`design.md` schreibt den Tag-Constraint als `key ~ '^[\p{L}\p{N}_]+$'`,
abgeschrieben von `TOKEN_RE` aus dem Frontend. Postgres kennt keine
Unicode-Property-Escapes:

```
select 'ki' ~ '^[\p{L}\p{N}_]+$'
  → FEHLER: invalid regular expression: invalid escape \ sequence
```

Die Migration wäre gar nicht durchgelaufen. Ersetzt durch die POSIX-Klasse
`^[[:alnum:]_]+$`, gemessen gegen dieselbe Datenbank:

| Eingabe | `^[[:alnum:]_]+$` |
|---|---|
| `persönlichkeitsentwicklung` | **true** — der Umlaut muss durch, `toLowerCase()` ersetzt ihn nicht |
| `know-how` | false |
| `zwei wort` | false |
| `Gross` | true (den fängt der zweite Constraint `key = lower(key)`) |

`[[:alnum:]]` hängt an der Locale der Datenbank, nicht am SQL-Text. Deshalb
misst `rls_test.sql` §20 den Umlaut-Fall ausdrücklich mit — auf jeder
Datenbank, auf der die Suite läuft, also auch auf DEV und PROD.

## Block 5 — der Cursor, gemessen statt behauptet

Gemessen am 2026-08-12, lokaler Stack.

```
tsx scripts/probe-feed-cursor.ts
```

Der Unit-Test (`feed.pagination.test.ts`) sichert die **Zeichenkette** zu, die
`fetchFeed` an PostgREST schickt. Ob PostgREST sie annimmt und ob dabei kein
Beitrag verlorengeht, kann er nicht sagen — ein falsch geklammertes `or(…)`
fällt erst zur Laufzeit auf, als 400 auf einer Seite, die niemand testet.

Drei Beiträge, zwei davon mit **identischem** `created_at`, Seitengröße 1 —
nur so fällt die Seitengrenze zwischen die beiden:

| Prüfung | Gemessen |
|---|---|
| PostgREST nimmt `or(created_at.lt.X,and(created_at.eq.X,id.lt.Y))` an | **3 Zeilen, kein 400** |
| jeder Beitrag genau einmal | **3 von 3, 3 verschieden** |
| **Gegenprobe:** Cursor nur über `created_at` | **2 von 3 — einer fehlt** |

Die dritte Zeile ist der Punkt. Ohne sie wäre der grüne Lauf der ersten beiden
nichtssagend: bei Seitengröße 2 stehen die zeitgleichen Beiträge auf derselben
Seite, und dann verliert auch die naive Fassung nichts. Der Befund aus dem
Plan-Review ist damit gemessen, nicht geglaubt.

## Die RPC, zum ersten Mal von einem echten Client gerufen

Gemessen am 2026-08-12, lokaler Stack.

```
tsx scripts/probe-rpc-create-post.ts
```

`create_post_with_media()` war bis hierher nur in pgTAP grün — also unter
`set local role authenticated` in einer psql-Sitzung, **nie über PostgREST**.
Genau dazwischen liegt die Fehlerklasse, die dieses Repo teuer bezahlt hat
(`service_role` hält keine Tabellenrechte): Argumentnamen, über die PostgREST
die Funktion überhaupt erst auswählt, die Wandlung des JSON-Arrays nach `jsonb`,
das EXECUTE-Recht. Alles drei fällt erst zur Laufzeit auf.

Echtes Konto, echter Login, echter Aufruf:

| | Prüfung | Gemessen |
|---|---|---|
| **A** | PostgREST findet die Funktion und nimmt sie an | kein Fehler |
| **A** | Beitrag **und** beide Bildzeilen stehen da | 1 Beitrag, 2 Bildzeilen |
| **A** | getippt **und** geklickt ergibt den Tag genau einmal | `["netzwerken","erlebnistag"]` |
| **B** | das siebte Bild nimmt den Beitrag mit zurück | abgelehnt, **kein Beitrag übrig** |
| **C** | unbestätigtes Konto | abgelehnt: „Kein bestätigter Zugang" |
| **D** | ohne Session | „permission denied for function" |

Zeile B ist die, die den Ablauf trägt: die Sechser-Grenze fällt **nach** dem
Insert in `posts` und nimmt ihn mit zurück. Es gibt keinen halb veröffentlichten
Zustand — die Zusicherung aus `design.md` ist damit gemessen, nicht geglaubt.

## `cso`-Gate (Task 10.2) — führt irgendein Pfad ohne Session zu einem `members`-Bild?

Gelesen am 2026-08-12, gegen den Stand nach Block 8. Sieben Wege geprüft:

| Weg | Ergebnis |
|---|---|
| `createSignedUrls` als anon | `post_media_lesbar` fordert ohne Session `visibility = 'public'` — gemessen (Sonde, Fall B) |
| öffentliche Bucket-URL | Bucket ist `public = false` — gemessen: HTTP 400 |
| `post_media`-Zeile als anon lesen | Policy delegiert an die RLS von `posts`; anon sieht die Zeile eines `members`-Beitrags nicht. Und der Pfad allein trägt nichts: signieren muss man ihn trotzdem |
| eingeloggt unter Rang 4 | `has_level(4)` — `rls_test.sql` §19.2 misst beide Seiten |
| fremdes Objekt unterschieben | INSERT/UPDATE prüfen den ersten Pfadabschnitt gegen die eigene `uid`; ein fremder Beitragspfad beginnt mit der `uid` seines Autors |
| Zeile auf fremden Beitrag zeigen lassen | `post_media_insert_own` verlangt Autorschaft am Beitrag; die RPC setzt `post_id` selbst |
| **Alt-Text der Bilder** | trägt `displayAuthor(...).name` — ausgeloggt „Ein Mitglied". Der neue Alt-Text gibt also keinen Namen preis, den die Karte nicht ohnehin zeigte |

**Kein Weg ohne Session führt zu einem `members`-Bild.** Der einzige Rest ist
benannt und gewollt: eine bereits ausgestellte Signatur gilt bis zu einer Stunde
weiter, auch wenn der Beitrag inzwischen auf `members` steht. Das steht im
Migrationskopf und in `design.md`, samt seiner Folge für Detlev.

## Task 1.0c — noch offen

Die Sonde gegen **DEV** laufen zu lassen (Plan-Review: ein grüner lokaler Lauf
sagt nichts über DEV, wenn die Supabase-Versionen auseinanderliegen) steht noch
aus. Sie ist **blockiert**: `infisical` hat keine Session, und der Login
braucht ein echtes Terminal (`! infisical login`).

Blockiert nicht den Fortschritt — 1.0c gehört ohnehin vor den Zeitpunkt, an
dem Block 2 auf DEV landet, und bis dahin müssen die Migrationen erst
existieren.
