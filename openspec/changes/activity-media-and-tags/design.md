# Design — C7 (AGE-528)

Eine Entscheidung trägt diesen Change, und sie ist der Grund, warum er nicht
einfach „Bilder anhängen" ist.

## Die Entscheidung: ein privater Bucket mit signierten URLs

**Gewählt:** ein Bucket `post-media`, `public = false`, ausgeliefert
ausschließlich über signierte URLs. Die Sichtbarkeitsregel steht in **einer**
SELECT-Policy auf `storage.objects` und nirgends sonst.

**Verworfen:** zwei Buckets, beim Upload nach `posts.visibility` gewählt —
öffentlich für `public`, privat für `members`.

### Das Missverständnis, das beide Wege betrifft

Ein privater Bucket lässt sich **nicht** per `<img src>` mit einem
Authorization-Header lesen; ein `img`-Tag kann keine Header setzen. Der einzige
Weg aus einem privaten Bucket in ein `<img>` ist die signierte URL. „Privater
Bucket" und „signierte URLs" sind damit keine zwei Aspekte einer Wahl, sondern
dasselbe.

Daraus folgt der Satz, der die Entscheidung trägt:

> **Zwei Buckets sparen die Signatur-Maschinerie nicht ein.** Der private
> Bucket für `members`-Beiträge braucht sie trotzdem — für jedes eingeloggte
> Mitglied, also für den Normalfall dieser Plattform. Eingespart wird sie nur
> für `public`-Beiträge, die Minderheit.

Damit ist der einzige echte Vorteil des zweiten Buckets ein `getPublicUrl` für
öffentliche Beiträge. Dem steht der Preis gegenüber.

### Der Preis der zwei Buckets: die Sichtbarkeit wird beim Upload zementiert

`posts.visibility` später von `members` auf `public` zu ändern hieße:

1. jedes Objekt aus dem privaten in den öffentlichen Bucket **kopieren**
   (`move` arbeitet nur innerhalb eines Buckets),
2. `post_media.storage_path` umschreiben,
3. das alte Objekt löschen,
4. `posts.visibility` setzen.

Vier Schritte über zwei Systeme, vom Client aus, **nicht atomar**. Bricht es
nach Schritt 1 ab, liegen die Bilder eines `members`-Beitrags im öffentlichen
Bucket — genau das Leck, gegen das dieser Change existiert. Ein Fehlerfall, der
den Schutz in sein Gegenteil verkehrt, ist teurer als ein Rundlauf pro
Feed-Seite.

Dazu käme, dass die Sichtbarkeitsregel an einer **zweiten** Stelle stünde
(einmal in der RLS von `posts`, einmal in der Bucket-Wahl beim Upload). Dieses
Repo trägt diese Krankheit bei `profiles_public` bereits und benennt sie: jedes
neue Gate braucht dort drei Stellen, sonst ist es Kulisse.

### Der Lesepfad, für beide Betrachter

| Betrachter | Weg |
|---|---|
| **ausgeloggt** (anon-Key, `role = anon`) | `createSignedUrls(pfade, 3600)`; die SELECT-Policy für `anon` lässt nur Objekte zu `public`-Beiträgen zu. Bild rendert. |
| **eingeloggt** | dasselbe, mit dem Prädikat von `posts_select_by_visibility`: `is_activated()` **und** (`public` **oder** `members` ab Rang 4 **oder** Autor). |

Die Regel wird **nicht** dupliziert: die Policy ruft eine
`SECURITY DEFINER`-Funktion `public.post_media_lesbar(text)` auf, die genau das
Prädikat der `posts`-Policies auswertet. Ändert sich dort die Stufe, ändert sie
sich hier mit.

### Die Funktion liest die Zeile, sie zerlegt NIE den Pfad

Aus dem Fremd-Review (gemini, MEDIUM). Naheliegend wäre, aus dem Objektnamen
`{uid}/{postId}/{datei}.webp` die `postId` herauszuschneiden und deren
Sichtbarkeit zu prüfen. **Das wäre ein Loch.** Der Pfad ist eine Zeichenkette,
die der Hochladende frei wählt — begrenzt nur durch die INSERT-Policy, und die
prüft ausschließlich den **ersten** Abschnitt. Jedes Mitglied könnte damit unter
`{eigene-uid}/{fremde-public-postId}/x.webp` hochladen und sich für dieses
Objekt eine Signatur holen, die eine Sichtbarkeit behauptet, die nichts mit dem
Objekt zu tun hat.

Die Funktion sucht deshalb die `post_media`-Zeile über
`storage_path = <objektname>` und prüft die Sichtbarkeit **des Beitrags, auf den
diese Zeile zeigt**. Die Zeile ist die Wahrheit, nicht der Pfad. Der Pfad wird
nirgends geparst.

Zwei Eigenschaften fallen dabei kostenlos ab: ein Objekt ohne `post_media`-Zeile
ist für niemanden signierbar (kein Treffer, keine Erlaubnis), und die
Verknüpfung ist genau die, über die auch die Karte das Bild findet — es gibt
keinen zweiten Weg, der auseinanderlaufen könnte. `post_media.storage_path`
bekommt dafür einen Unique-Index.

### Signatur: Anzahl, Caching, Ablauf

- **Anzahl.** `createSignedUrls(paths: string[], expiresIn, options)` ist eine
  Batch-API — nachgesehen in der installierten `@supabase/storage-js@2.112.1`,
  nicht aus der Erinnerung. Also **ein** HTTP-Aufruf pro Feed-Seite, nicht
  einer pro Bild. Bei 20 Beiträgen × 6 Bildern sind das 120 Pfade in einem
  POST.
- **Caching.** Der Token steckt in der URL. Wird pro Render neu signiert,
  ändert sich der Cache-Key und der Browser lädt jedes Bild neu. Gegenmaßnahme:
  die signierten URLs **pro Pfad** in react-query halten, `staleTime` knapp
  unter der Gültigkeit. Bei **1 h Gültigkeit / 50 min `staleTime`** sieht der
  Browser innerhalb einer Sitzung dieselbe Zeichenkette und cacht normal.
- **Ablauf.** Eine ausgegebene Signatur gilt bis zum Ablauf weiter — auch wenn
  der Beitrag inzwischen auf `members` umgestellt wurde. Kurze Gültigkeit senkt
  diese Nachlaufzeit und kostet Cache. **1 h** ist der gewählte Kompromiss und
  gehört als benannte Entscheidung in den Migrationskopf, nicht als
  Nebenwirkung. Wer sie ändert, ändert damit die Nachlaufzeit eines
  Sichtbarkeitswechsels. **Für Detlev heißt das:** wer einen Beitrag von
  öffentlich auf „nur Mitglieder" umstellt, verbirgt den Beitrag sofort, das
  Bild aber bei jemandem, der die Seite offen hat, bis zu eine Stunde später.
- **Zwei Randfälle, aus dem Fremd-Review.** Zwischen `staleTime` (50 min) und
  Ablauf (60 min) liegt ein Fenster, in dem ein offen gelassener Tab eine
  abgelaufene URL hält und das Bild 403 liefert; der Bildfehler löst deshalb ein
  Nachsignieren aus, statt eine kaputte Kachel stehen zu lassen. Und
  `createSignedUrls` kann für **einzelne** Pfade ablehnen: die Karte behandelt
  das je Bild, sie darf nicht den ganzen Beitrag verwerfen.

## Veröffentlichen ist ein Schritt, nicht drei

Aus dem Fremd-Review (opencode, MEDIUM). Der naheliegende Ablauf wäre: Beitrag
anlegen → Bilder hochladen → `post_media`-Zeilen anlegen. Er hat einen sichtbaren
Fehlerzustand: bricht er nach dem ersten Schritt ab, steht der Beitrag im Feed —
sofort, denn `onSuccess` invalidiert den Cache — und zwar **ohne seine Bilder**,
ohne Entwurf, ohne Wiederholung. Ein Erlebnisbericht ohne Fotos ist kein halber
Beitrag, sondern ein falscher.

Der Ablauf wird deshalb umgedreht:

1. Die Beitrags-`id` wird **im Client** erzeugt (`crypto.randomUUID()`).
2. Die Bilder werden nach `{uid}/{postId}/{i}-{ts}.webp` hochgeladen. Sie hängen
   an nichts — die INSERT-Policy prüft nur den ersten Pfadabschnitt.
3. **Eine** `SECURITY DEFINER`-RPC `create_post_with_media(...)` legt den Beitrag
   und alle `post_media`-Zeilen in **einer Transaktion** an.

Bricht es vor Schritt 3 ab, gibt es keinen Beitrag — nur Objekte im Bucket, die
zu keiner Zeile gehören und deshalb für niemanden signierbar sind. Das ist
Speicherschuld, kein Leck und kein sichtbarer Defekt.

Die RPC ist der einzige neue Schreibweg dieses Changes, und sie trägt drei
Regeln an einer Stelle: die Sechser-Grenze, die Vereinigung der Tags (siehe
unten) und die Autorschaft. `posts_write_own` bleibt daneben bestehen — die RPC
ersetzt keine Policy, sie klammert zwei Inserts.

## Tags werden vereinigt, nicht ersetzt

Aus dem Fremd-Review (opencode, MEDIUM). Heute ist `parseHashtags(body)` der
einzige Weg in `posts.hashtags` (`src/lib/feed.ts:370`). Mit einer Tag-Auswahl
im Composer gibt es zwei Quellen, und der Fall, der sonst durchrutscht, ist der
naheliegendste: jemand tippt `#Netzwerken` **und** klickt denselben Tag an.

Also: `hashtags` = getippte ∪ geklickte, **dedupliziert**, Reihenfolge der
getippten zuerst. Weil beide Seiten durch dieselbe Normalisierung laufen (siehe
„Die Form des Schlüssels"), fallen sie auf denselben Wert zusammen und die
Deduplizierung greift. Ohne die Schlüssel-Constraints täte sie es nicht — die
beiden Entscheidungen hängen aneinander.

## Folge für den Abnahme-Beweis

Die Abnahme in AGE-528 lautet: die rohe Storage-URL im Inkognito-Fenster
liefert für einen `members`-Beitrag kein Bild und für einen `public`-Beitrag
eines. **Die zweite Hälfte gilt so nicht mehr.** Bei einem privaten Bucket
liefert `…/object/public/post-media/…` für **beide** Beitragsarten nichts — der
Pfad existiert dort grundsätzlich nicht.

Der Beweis wird deshalb so geführt:

| | Prüfung | Erwartung |
|---|---|---|
| `members` | rohe Storage-URL im Inkognito | **kein Bild** |
| `members` | ausgeloggter Feed | Beitrag gar nicht sichtbar |
| `members` | `createSignedUrls` als anon auf diesen Pfad | **abgelehnt** |
| `public` | rohe Storage-URL im Inkognito | kein Bild (erwartet, kein Fehler) |
| `public` | ausgeloggter Feed im Inkognito | **Bild sichtbar** |

Der `members`-Teil wird damit schärfer erfüllt als verlangt: es scheitert nicht
nur die Datei, sondern auch der Versuch, sich eine Signatur dafür ausstellen zu
lassen. Der `public`-Teil wird über den gerenderten Feed geführt statt über die
rohe URL. Mit Donald am 2026-08-11 so entschieden.

## Das eine Risiko, und wie es zuerst gemessen wird

Nicht gemessen ist, ob `anon` mit einer SELECT-Policy auf `storage.objects`
tatsächlich eine Signatur ausgestellt bekommt. Dieses Repo hat teuer gelernt,
dass so etwas erst zur Laufzeit auffällt — `service_role` hält auf keiner
Tabelle in `public` ein Recht, und das haben drei Testsuiten und zwei Reviews
übersehen; gefunden hat es die Sichtprobe.

Deshalb ist **Task 1.0 eine Sonde gegen den lokalen Stack**, bevor irgendetwas
darauf gebaut wird: Objekt hochladen, Beitrag auf `public`, als anon signieren
und abrufen — dann Beitrag auf `members`, erneut signieren, Ablehnung
erwarten.

**Fällt die Sonde negativ aus**, ist der Rückfallweg eine Edge Function, die
die Signaturen mit `service_role` ausstellt (ein Aufruf pro Feed-Seite). Sie
wäre der schlechtere Weg, weil die Sichtbarkeitsregel dann an einer zweiten
Stelle stünde — aber kein unmöglicher. Diese Verzweigung wird **vor** Task 2
entschieden, nicht danach.

## Bildgrenzen

| | Wert | Wo durchgesetzt |
|---|---|---|
| Bilder pro Beitrag | **6** | Client + `post_media`-Constraint |
| Maximalkante | **1600 px** | Client (`shrinkToWebp`) |
| Qualität | **0,82** | Client |
| Dateigröße | **1 MiB** | **Bucket** (`file_size_limit`) |
| Dateityp | **nur `image/webp`** | **Bucket** (`allowed_mime_types`) |

Die letzten beiden Zeilen sind der Punkt. AGE-528 sagt „am `avatars`-Muster
orientieren: hartes Größenlimit" — **`avatars` hat serverseitig keines** und
auch keine MIME-Beschränkung; die Grenze liegt dort ausschließlich im Client,
und ein handgebauter Upload umgeht sie. Das Muster mit echtem serverseitigem
Limit ist **`covers`** aus C6. Ihm wird gefolgt.

Ein 1600-px-WebP bei 0,82 liegt bei 100–250 kB. 1 MiB lässt jedes reale Bild
durch und schneidet den Fall ab, in dem jemand ein 40-MB-TIFF durchreicht.
Sechs Bilder × 1 MiB ist die Obergrenze pro Beitrag, realistisch sind ~1 MB.

## Warum keine Verknüpfungstabelle für Tags

`tags` ist eine **redaktionelle Liste**, kein Beziehungsmodell.
`posts.hashtags text[]` bleibt unverändert und hält beide Sorten; ein Chip gilt
als kuratiert, wenn sein Wert in `tags` vorkommt.

Der Grund ist nicht Bequemlichkeit, sondern dass die bestehende Filterlogik
dadurch **unangetastet** bleibt: `.contains("hashtags", [hashtag])`
(`src/lib/feed.ts`) funktioniert weiter. (Hier stand bis zum 2026-08-12 „der
GIN-Index dahinter auch" — den gab es nie; der Filter lief als Seq-Scan.
Angelegt wird er jetzt in `20260812090300_posts_indizes.sql`, zusammen mit dem
Index für den Keyset-Cursor. Beide vorher und nachher gemessen.) Eine
Verknüpfungstabelle hieße, denselben Filter neu zu bauen, alle Bestandsbeiträge
umzuschreiben und dabei die freien Tags entweder zu verlieren oder doppelt zu
führen. Die Migration ist so ein Insert statt einer Umstrukturierung.

Der Preis, benannt: ein umbenannter oder gelöschter kuratierter Tag wirkt
**nicht** rückwirkend auf Beiträge — sie tragen weiter die alte Zeichenkette
und erscheinen danach als freier Tag. Für eine Liste, die sich selten ändert,
ist das der richtige Tausch.

## Die Form des Schlüssels — die Falle, die diesen Weg sonst zerlegt

Weil es keine Verknüpfungstabelle gibt, ist der **Wert selbst** die Verbindung:
`posts.hashtags` hält Zeichenketten, und „kuratiert" heißt „diese Zeichenkette
steht in `tags.key`". Damit hängt alles daran, dass derselbe Tag **eine**
Zeichenkette ergibt — egal ob er im Composer angeklickt oder als `#Wort` in den
Text getippt wurde.

Getippt wird er von `parseHashtags` normalisiert, und die Normalisierung ist
`toLowerCase()` (`src/lib/feed.ts:70`) — mehr nicht. Umlaute bleiben also
stehen: `#Persönlichkeitsentwicklung` wird zu `persönlichkeitsentwicklung`, mit
`ö`. Ein Schlüssel `persoenlichkeitsentwicklung` in `tags` würde nie treffen,
der Chip erschiene als freier Tag, und der Filter zerfiele still in zwei
Töpfe — ohne Fehlermeldung, in beiden Richtungen halb funktionierend.

Daraus folgen zwei Constraints auf `tags`, und sie sind keine Kosmetik:

```sql
check (key = lower(key))
check (key ~ '^[[:alnum:]_]+$')
```

Die zweite spiegelt die Zeichenklasse aus `TOKEN_RE` (`src/lib/feed.ts:64`):
`[#@][\p{L}\p{N}_]+`. **Sie spiegelt sie, sie schreibt sie nicht ab** — hier
stand bis zum 2026-08-12 `^[\p{L}\p{N}_]+$`, und Postgres kennt keine
Unicode-Property-Escapes: der Ausdruck bricht mit „invalid regular expression:
invalid escape \ sequence" ab, die Migration wäre nicht durchgelaufen.
`[[:alnum:]]` leistet in einer UTF8-Datenbank dasselbe
(`persönlichkeitsentwicklung` geht durch, `know-how` und `zwei wort` nicht),
hängt dafür an der
Locale statt am SQL-Text — weshalb der Umlaut-Fall in `rls_test.sql` §20 als
eigene Zusicherung mitläuft. Messung in `EVIDENCE.md`. Ein kuratierter Tag mit Leerzeichen oder Bindestrich —
etwa „Know-how" — **ließe sich nie tippen**, nur klicken. Das ist der Grund,
warum unten kein einziges Label mehrteilig ist.

Regel, in einem Satz: **`key` = `lower(label)`, und `label` ist ein einzelnes
Wort ohne Bindestrich.**

## Startbefüllung: 15 Tags, aus dem Mockup gelesen

AGE-528 vermutet „die elf Kompass-Kategorien aus C2 plus ein paar
Format-Tags". Beides stimmt nicht ganz:

- Es sind **14**, nicht elf: `src/config/matching.ts` führt 7 „Ich biete" und
  8 „Ich suche", wobei `immobilien` auf beiden Seiten steht.
- Vor allem sind es **Matching**-Kategorien — „biete Kapital", „suche
  Mitarbeiter". Als Themen eines Erlebnisberichts tragen sie nicht: `#kapital`
  unter Wanderfotos ist keine Einordnung.

Das Mockup beantwortet die Frage selbst. Im Filterfeld „Tags" stehen neun
Einträge plus „Mehr anzeigen", unter „Beliebte Tags" zwei weitere. Diese elf
sind die Themen; dazu vier Formate, die im Mockup an den Beiträgen auftauchen
oder zum Go-Live gebraucht werden.

**Themen (aus dem Mockup, `sort` 10–110):**

| `key` | `label` |
|---|---|
| `unternehmertum` | Unternehmertum |
| `investitionen` | Investitionen |
| `immobilien` | Immobilien |
| `marketing` | Marketing |
| `persönlichkeitsentwicklung` | Persönlichkeitsentwicklung |
| `nachhaltigkeit` | Nachhaltigkeit |
| `technologie` | Technologie |
| `gesundheit` | Gesundheit |
| `leadership` | Leadership |
| `netzwerken` | Netzwerken |
| `ki` | KI |

**Formate (`sort` 200–230):**

| `key` | `label` | warum |
|---|---|---|
| `erlebnistag` | Erlebnistag | steht so am ersten Beitrag des Mockups |
| `rückblick` | Rückblick | der häufigste Beitragsanlass nach einer Veranstaltung |
| `vorstellung` | Vorstellung | zum Go-Live kommen ~70 importierte Konten an; das ist ihr erster Beitrag |
| `frage` | Frage | macht den Feed zum Gespräch statt zur Wand |

`sort` in Zehnerschritten, damit ein späterer Tag dazwischen passt, ohne dass
die ganze Liste neu vergeben wird.

**Bewusst NICHT dabei:** `event` und `academy`. Beide klängen naheliegend, wären
aber die halbe Vorstufe der Feed-Verzahnung aus C9 — ein Tag, den man später
gegen `posts.kind` austauschen müsste, und bis dahin eine zweite, von Hand
gepflegte Wahrheit darüber, was ein Event-Beitrag ist.

Ebenfalls nicht dabei: `allgäu`, `tools`, `produktivität`, `projekt`,
`kooperation`, `digitalisierung` — sie stehen im Mockup an Beiträgen, aber
**nicht** in der Filterliste. Das ist im Mockup genau die Unterscheidung, die
dieser Change baut: kuratierte Chips sind gefüllt, freie sind Outline
(`Allgäu` ist dort als einziger Chip des ersten Beitrags outline gezeichnet).
Sie sollen freie Tags bleiben.

Von Donald am 2026-08-11 freigegeben. Eine spätere Korrektur mit Detlev ist ein
`insert`/`update` auf `tags`, keine Migration am Schema.
