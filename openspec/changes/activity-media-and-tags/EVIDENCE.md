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

## Task 1.0c — dieselbe Sonde gegen DEV

Gemessen am 2026-08-12 gegen **DEV `foelowldexkcqzewvrcf`**, ausdrücklich
benannt:

```
infisical run --env=dev -- tsx scripts/probe-post-media-signatur.ts --dev=foelowldexkcqzewvrcf
```

Lokal bleibt fest verdrahtet; DEV verlangt die Projektkennung als Argument, und
die wird gegen `scripts/dev-project-ref.txt` geprüft. Ein Umschalten über eine
Umgebungsvariable gibt es nicht — ein Wächter, der nur einen Namen prüft, hält
nichts, wenn jemand die Variable anders setzt.

**Alle sechs Fälle erfüllt, wie lokal.** Die Sorge aus dem Plan-Review
(auseinanderlaufende Supabase-Versionen) ist damit ausgeräumt. Ein Unterschied
ist messbar und erwartbar: **120 Signaturen in 70–135 ms statt 15 ms** — das
Netz, nicht die Konstruktion.

### Der Befund, den erst DEV hatte: der Abbau war nicht symmetrisch

Nach dem ersten DEV-Lauf meldete die Sonde „ALLE PRUEFUNGEN ERFUELLT" — und
hatte den Wegwerf-**Bucket im Live-Projekt stehen gelassen**. Tabelle, Funktion,
Policy und Objekte waren weg, `deleteBucket` war fehlgeschlagen und sein Fehler
wurde verworfen.

Ursache: `emptyBucket` ist gehostet nicht sofort wirksam, `deleteBucket`
unmittelbar danach sieht noch Objekte. Lokal fällt das nicht auf.

Zwei Änderungen daraus, beide gemessen:

- Der Abbau **prüft seine eigenen Rückgaben** und zählt Reste getrennt. Eine
  erfüllte Sonde mit liegengebliebenen Resten ist kein Erfolg mehr — der
  Exit-Code ist dann 1.
- Bis zu drei Anläufe mit kurzer Pause.

Danach: Lauf grün, Exit 0, und DEV trägt wieder nur `avatars` und `covers`
(nachgesehen, nicht geglaubt).

## Abnahme 9.4 / 9.5 / 9.6 — die Sichtprobe, von Hand durchgespielt

Am 2026-08-12 gegen den **lokalen Stack** gefahren (Vite mit
`VITE_SUPABASE_URL=http://127.0.0.1:54321`, drei angelegte Konten, sechs
erzeugte PNGs mit großen Ziffern 1–6, damit Reihenfolge im Bild ablesbar ist).
**9.3 bleibt offen** — dazu unten.

### 9.4 — Bild hochladen, mehrere, Reihenfolge, einzeln löschen

| Prüfung | Ergebnis |
|---|---|
| Ein Bild wählen | Vorschau erscheint, Composer bleibt bedienbar |
| Mehrere nachwählen | Auswahl **wächst** (kein Ersetzen), Reihenfolge = Auswahlreihenfolge |
| Einzeln löschen | „Bild 2 entfernen" nimmt genau 2; 1 und 3 bleiben in Ordnung |
| Siebtes Bild | abgelehnt mit „Höchstens sechs Bilder pro Beitrag — 1 wurden nicht übernommen.", sechs bleiben stehen |
| Nach dem Posten | `post_media` trägt `sort` 0–5, Pfade unter `<uid>/<postId>/`, `storage.objects` sechs Objekte, alle `image/webp`, 2,3–2,8 kB |
| Maße | 900×700 / 900×600 abwechselnd — genau die Auswahlreihenfolge, Ende zu Ende |

Der Composer wandelt clientseitig nach WebP (`shrinkToWebp`), hochgeladen wurden
PNGs — der Bucket nimmt trotzdem nur `image/webp`, und genau das kam an.

### 9.5 — jeder Tag genau einmal, kuratiert von frei unterscheidbar

Der schärfste Fall, absichtlich gebaut: **derselbe Tag zweimal eingegeben** —
`#Netzwerken` im Fließtext *und* der kuratierte Chip „Netzwerken" gewählt.

Gemessen an den gerenderten Chips (`data-kuratiert` am Knopf):

| Chip | kuratiert | Anzahl im Beitrag |
|---|---|---|
| `#netzwerken` | `true` | **1** — die Deduplizierung greift |
| `#persönlichkeitsentwicklung` | `true` | 1 — mit **ö** getippt und trotzdem als kuratiert erkannt |
| `#sommerfest` | `false` | 1 |

Die zweite Zeile ist die Falle aus `design.md` („Die Form des Schlüssels"): ein
Schlüssel `persoenlichkeitsentwicklung` hätte nie getroffen, der Chip wäre still
als freier Tag erschienen. Die Startbefüllung trägt `persönlichkeitsentwicklung`
mit Umlaut, und der Weg Text → `toLowerCase()` → `tags` passt zusammen.

Kuratiert ist **gefüllt**, frei ist **Outline** — wie in `design.md` festgelegt,
und im Bild in beiden Themes unterscheidbar. Alle drei sind Knöpfe, der Text im
Beitrag ist normaler Text (Block 4 hält).

Filter: kuratierter Chip aus der Leiste → „Gefiltert nach #erlebnistag ·
Filter entfernen", Feed auf die zwei passenden Beiträge verengt, Chip in der
Leiste hervorgehoben. Freier Chip aus einem Beitrag (`#allgäu`) → ein Beitrag,
kein Leisten-Chip gedrückt. Tag ohne Beiträge (`Immobilien`) → „Keine Beiträge
mit diesem Hashtag", also der leere Zustand aus 8.3, nicht der aus C2.

### 9.6 — gegen das Mockup, in beiden Themes und auf dem Telefon

Beide Themes: `hell` und `navy`. Erwartungsgemäß **kein** Unterschied im Inhalt —
`navy` färbt nur die Schale (AGE-499), Karten und Chips bleiben hell. Auf dem
Telefon (390 px) liegt die Tag-Leiste **über** dem Feed (8.4 bestätigt), das
Bildraster wird 2×2, das „+n" sitzt auf der vierten Kachel.

**Der Befund, den nur die Sichtprobe finden konnte: die Lightbox war in der
Karte gefangen.**

`.fbc-card:hover` setzt `transform: translateY(-2px)` (AGE-492). Ein
transformierter Vorfahr ist der Bezugsrahmen für `position: fixed` — und beim
Klick auf eine Kachel liegt der Zeiger immer auf der Karte. Gemessen:

| | Dialog | Viewport |
|---|---|---|
| vorher (Zeiger auf der Karte) | 847×615 an x=105/y=91 | 1280×900 |
| vorher (Klick per Skript, ohne Hover) | 485×828 | 500×844 |
| nachher, Portal an `document.body` | 1265×900 an 0/0 | 1280×900 |
| nachher, Transform am Vorfahren **erzwungen** | 1265×900 an 0/0 | 1280×900 |

Die letzte Zeile ist die Gegenprobe: der Fehler kann nicht zurückkommen, solange
der Dialog nicht mehr unter der Karte hängt. Drei Testsuiten hatten das nicht
gesehen, weil jsdom kein Layout rechnet; die Zusicherung ist deshalb strukturell
(`dialog.closest(".fbc-card")` ist `null`, Elternteil ist `document.body`) und
lief vor dem Fix rot.

Konsole bei allem: leer, keine Fehler, keine Warnungen.

**Zwei Beobachtungen ohne Diff, bewusst nicht selbst entschieden:**

- **Vier Kacheln ergeben ab `sm` ein 3+1-Raster** (`grid-cols-2 sm:grid-cols-3`),
  die vierte steht allein in der zweiten Zeile. Das Mockup zeigt nie vier, nur
  drei in einer Reihe. Ein `grid-cols-2` genau bei vier sichtbaren Kacheln wäre
  ein 2×2 und eine Zeile Diff — es ist aber eine Gestaltungsfrage.
- **Die Chips tragen den Schlüssel (`#persönlichkeitsentwicklung`), das Mockup
  das Label ohne Raute („Persönlichkeitsentwicklung") und je Tag eine eigene
  Farbe.** Gefüllt-gegen-Outline ist die in `design.md` festgehaltene
  Unterscheidung und trägt; die Schreibweise ist offen.

### 9.3 — offen, und warum

DEV kennt die drei Migrationen dieses Change **nicht**: nachgesehen am
2026-08-12, `storage.buckets` trägt nur `avatars` und `covers`, `post_media` und
`tags` fehlen, die höchste Migration ist `20260811090300`. Die Sonde aus 1.0c
hatte mit einem Wegwerf-Bucket gearbeitet und ihn abgebaut.

Der Beweis „gegen DEV" verlangt also erst einen Schema-Schreibzugriff auf die
Instanz, die die Live-Seite bedient. Mit Donald am 2026-08-12 so entschieden:
**9.4–9.6 zuerst lokal, 9.3 danach** — nicht nebenbei mit `db push` auf DEV.

## 9.7 — QA-Gate auf der Oberfläche

Gelaufen am 2026-08-12 im Browser gegen den lokalen Stack (`localhost:5173`,
Supabase auf `127.0.0.1:54321`), mit einem eigens angelegten Konto
`qa-c7@example.test` (Stufe `impact`, aktiviert). Standard-Stufe, **98/100,
kein kritischer, hoher oder mittlerer Befund**. Der ausführliche Bericht liegt
unter `.gstack/qa-reports/qa-report-aktivitaet-2026-08-12.md` — das Verzeichnis
ist `.gitignore`d, deshalb steht die Substanz hier.

### Was jsdom nicht messen konnte und hier gemessen wurde

| Prüfung | Gemessen |
|---|---|
| Lightbox liegt an `document.body` und füllt das Fenster | 1265×720 = volles Fenster, in jedem Schritt |
| **Bild 5 und 6 erreichbar**, Umlauf 6 → 1 | `Bild 4 von 6` → 5 → 6 → 1 |
| Tastatur ←, →, Escape | trägt |
| Tag-Filter | 4 → 3 Beiträge, zweiter Klick zurück auf 4, `aria-pressed` folgt |
| Leerer Filterzustand (Task 8.3) | „Keine Beiträge mit diesem Hashtag" statt des allgemeinen Leerzustands |
| **Telefon 375 px: Leiste vor dem Feed** (Task 8.4) | 936 px vs. 1246 px — die eine Aussage, die bewusst ohne Test blieb |
| Netzwerk | 515 Antworten mit 200, keine N+1 (alles über `in.(…)`), keine Konsolenfehler |

### Der ganze Schreibweg, im Browser statt in pgTAP

Zwei PNG in den Composer, Text mit getipptem `#Netzwerken`, dazu die Kacheln
`Netzwerken` und `Erlebnistag`, dann „Posten":

- beide Bilder **client-seitig nach WebP gewandelt** (der Bucket nimmt nur WebP)
  und hochgeladen, je 200;
- `rpc/create_post_with_media` → 200;
- in der Datenbank `hashtags = ["netzwerken","erlebnistag"]` — **je genau
  einmal**, obwohl `Netzwerken` getippt *und* geklickt war;
- im Feed sofort sichtbar, beide Bilder geladen; im Kartentext steht
  „Netzwerken" zweimal, **genau eine Stelle ist klickbar** (Regel 4.1).

Damit ist der Composer-Weg nicht mehr nur von der Sonde gelaufen (9.0), sondern
von einem echten Browser mit echter Datei-Auswahl.

### Zwei niedrige Befunde, beide bewusst ohne Diff

- **Die Seite scrollt hinter der offenen Lightbox** (`scrollY` 0 → 600). Real,
  aber dieses Repo kennt **nirgends** eine Scroll-Sperre — `AvatarCropper`,
  `FeedbackButton` und `DesignSwitcher` sperren ebenso wenig. Eine Sperre nur
  hier wäre die Ausnahme statt der Regel; alle vier zu ändern ist eine eigene
  Aufgabe. Folgeaufgabe, nicht dieser PR.
- **Auf 375 px verdeckt der feste Feedback-Knopf die Kachel „Frage"**
  (240–340 × 690–732 gegen 240–299 × 697–723; `elementFromPoint` in der
  Kachelmitte liefert „Feedback"). Nach 150 px Scrollen frei, am Schreibtisch
  gar nicht. Die Kachelreihe ist neu, die Ursache liegt im fremden Widget —
  Donalds Entscheidung.

### Vier Fehlalarme, damit sie nicht erneut gejagt werden

1. **„Bild 2 fehlt im Raster."** Das Raster zeigt 1, 3, 4, 5. Die Dateien wurden
   heruntergeladen und angesehen: `sort=1` **enthält** die Ziffer 3 — Rückstand
   aus dem Handlauf 9.4, wo Bild 2 absichtlich entfernt wurde. Die Anzeige ist
   der Datenlage treu. Ohne den Blick in die Bytes wäre das ein Fehlbefund
   gegen eine korrekte Komponente gewesen.
2. **„Die Tastatur ist tot."** Das QA-Werkzeug liefert überhaupt keine
   Tastenereignisse an die Seite — ein Lauscher auf `document` in der
   Capture-Phase sah null. Werkzeug, nicht App.
3. **„Escape schließt nicht."** Im selben synchronen JS-Block gelesen, in dem
   das Ereignis abgeschickt wurde; React hatte noch nicht neu gezeichnet. Mit
   einem Tick Abstand schließt es.
4. **„Der Autor heißt ‚Mitglied'."** Das Aufsetz-Skript schrieb `name` nur im
   INSERT-Zweig, die Profilzeile existierte aber schon (Trigger bei der
   Anmeldung) — also blieb `name` null. Testdaten, nicht die App.

### Was lokal liegen bleibt

Konto `qa-c7@example.test` (Profil „QA C7") und ein Beitrag „QA-Gate 9.7" mit
zwei Bildern. Nur im lokalen Stack; `supabase db reset --local` räumt beides ab.

## 9.3 — die scharfe Hälfte, gemessen gegen DEV

Gelaufen am 2026-08-12, nachdem `migrate-dev` für die Merge-SHA `df37349` grün
war und DEV die vier Migrationen kannte. Sonde:
`scripts/probe-9-3-sichtbarkeit.ts --dev=foelowldexkcqzewvrcf`.

Die Sonde aus 1.0c hatte den **Mechanismus** an einem Wegwerf-Aufbau gemessen.
Diese hier misst das **echte Schema**: Bucket `post-media`, `post_media`,
`post_media_lesbar()` und die vier Storage-Policies, so wie sie nach den
Migrationen dastehen. Zwei Beiträge mit je einem Bild, einer `members`, einer
`public`, alle Prüfungen ausgeloggt — nur der anon-Key, keine Sitzung.

| | Prüfung | Erwartet | Gemessen auf DEV |
|---|---|---|---|
| `members` | rohe Storage-URL | kein Bild | **HTTP 400**, `application/json` |
| `public` | rohe Storage-URL | kein Bild (der Bucket ist privat) | **HTTP 400**, `application/json` |
| `members` | ausgeloggter Feed | Beitrag nicht dabei | 6 Beiträge sichtbar, **members-Beitrag nicht darunter** |
| `public` | ausgeloggter Feed | Beitrag dabei | **sichtbar** |
| `members` | `createSignedUrls` als anon | **abgelehnt** | „Either the object does not exist or you do not have access to it" |
| `public` | ausgeloggt signieren **und holen** | Bild kommt an | **HTTP 200, 34 Bytes, RIFF/WEBP** |

**Sechs von sechs erfüllt.** Der `members`-Teil ist damit schärfer erfüllt als
die Abnahme verlangt: es scheitert nicht nur die Datei, sondern schon der
Versuch, sich eine Signatur ausstellen zu lassen.

### Die Sonde kann rot — nachgewiesen, nicht behauptet

Ein grüner Lauf beweist wenig, wenn die Zusicherungen gar nicht fallen können;
dieses Repo hat mit Vakuum-Tests schon bezahlt. Vor dem DEV-Lauf lief deshalb am
lokalen Stack eine **Mutation**: `p_visibility` fest auf `public`, sodass der
„members"-Beitrag keiner mehr ist. Ergebnis — genau die zwei `members`-Zeilen
fielen (`ausgeloggter Feed`: Beitrag sichtbar; `createSignedUrls`: Signatur
**wird** ausgestellt), die vier übrigen blieben grün. Die Sonde misst also, was
sie behauptet.

### Der Abbau ist nachgezählt

DEV bedient die Live-Seite; für die Dauer des Laufs stand ein Testbeitrag im
Feed der eingeloggten Mitglieder. Die Sonde räumt am Ende ab und **zählt dann
nach** — Beiträge, Bildzeilen, Storage-Objekte, Profil, Konto:

```
OK    nachgezaehlt: Beitraege 0, Bildzeilen 0, Storage-Objekte 0, Profil 0, Konto 0
```

Ein liegengebliebener Rest wäre als eigener Fehler gezählt worden, getrennt von
den Prüfungen — eine erfüllte Sonde mit Resten ist kein Erfolg.

### Was noch offen ist, und warum es offen sein muss

Die Zeile **„public-Bild im ausgeloggten Feed sichtbar"** führt `design.md`
bewusst über den *gerenderten* Feed. Das geht in diesem Fenster nicht: auf
`pages.dev` steht noch das alte Frontend, weil `drift-gate` jeden Deploy
blockt, bis `migrate-prod` lief (nachgelesen im Lauf zur Merge-SHA: „DRIFT —
lokal vorhanden, auf dem Ziel fehlend" für alle vier Migrationen). Ein
ausgeloggter Feed dort zeigt heute gar keine Beitragsbilder.

Gemessen ist stattdessen der Weg, den der Feed danach nimmt: ausgeloggt
signieren, holen, Bytes vergleichen. Die gerenderte Zeile wird direkt nach dem
`deploy`-Re-Run aus 10.4 im echten Inkognito-Fenster nachgeholt.
