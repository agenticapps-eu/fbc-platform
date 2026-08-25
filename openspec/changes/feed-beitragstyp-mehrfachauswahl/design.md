# Design — Beitragstyp mehrfach wählbar (AGE-590)

## Context

Der Beitragstyp ist heute ein einzelner Wert (`FeedAuswahl.typ: FeedTyp | null`)
und wird in `fetchFeed` als **vier voneinander unabhängige `if`-Zweige** auf die
Abfrage gelegt (`src/lib/feed.ts:652-657`):

```ts
if (typ === "video") query = query.not("video_url", "is", null);
if (typ === "event") query = query.eq("kind", "event");
if (typ === "bild")  query = query.not("post_media", "is", null);
if (typ === "text")  query = query.is("video_url", null)
                                  .neq("kind", "event")
                                  .is("post_media", null);
```

Das funktioniert nur, weil höchstens ein Zweig zutrifft. Angehängte Filter
verknüpft PostgREST mit UND — zwei aktive Zweige lieferten also die
**Schnittmenge** und damit für „Video + Bild" fast immer null Zeilen. Die
Mehrfachauswahl ist deshalb kein Schleifen-um-die-vier-`if`, sondern verlangt
eine andere Ausdrucksform.

Nebenan steht das Vorbild: der Tag-Filter ist längst mehrfach wählbar und
verknüpft mit ODER (`query.overlaps("hashtags", gewaehlteTags)`), die leere
Menge heißt dort „alle". Diese Regel wird hier übernommen statt neu erfunden.

## Goals / Non-Goals

**Goals:**

- Mehrere Beitragstypen gleichzeitig wählbar, ODER-verknüpft.
- Der Filter bleibt **Teil der Abfrage** — die bestehende Spec-Zusage.
- Der Cache-Schlüssel bleibt eine treue Abbildung der Auswahl (AGE-582).
- Die Oberfläche hält, was Auswahlkästchen versprechen.

**Non-Goals:**

- Kein UND-Modus („Beiträge, die Bild *und* Video tragen"). Niemand hat ihn
  verlangt, und er wäre eine zweite Bedienlogik neben den Tags, die es auch nicht
  gibt.
- Keine Änderung an der Herleitung der Typen. Video bleibt `video_url`, Event
  bleibt `posts.kind`, Bild bleibt die `post_media`-Zeile.
- Kein Anfassen von `nurVideos` (Academy). Eigener Aufrufer, eigener Weg.
- Keine Zustandsablage in der Adresszeile. Der Typ steht heute nicht in der URL;
  das zu ändern ist ein eigener Wunsch.

## Decisions

### 1. Ein `or=(…)` statt vier `if` — und keine Migration

Die vier Zweige werden zu **einem** `query.or(...)` mit einem Ausdruck je
gewähltem Typ zusammengezogen:

| Typ | Teilausdruck |
|---|---|
| `video` | `video_url.not.is.null` |
| `event` | `kind.eq.event` |
| `bild` | `post_media.not.is.null` |
| `text` | `and(video_url.is.null,kind.neq.event,post_media.is.null)` |

**Belegt, nicht vermutet.** Der Zweifel galt `post_media`: das ist eine
*eingebettete Beziehung*, kein Skalar, und ob PostgREST sie innerhalb eines
Logikbaums auflöst, ist keine Frage, die man aus der Dokumentation sicher
beantwortet. Am lokalen Stack (postgrest/14.5) mit drei Sonden-Beiträgen
(25.08.) gemessen — und auf **DEV** gegengeprüft, weil der lokale Stack nicht
für die ausgelieferte Fläche bürgt: dort flippt `or=(post_media.is.null)` /
`…not.is.null` das Ergebnis zwischen allen drei anon-sichtbaren Beiträgen und
keinem, und `or=(and(video_url.is.null,kind.neq.event,post_media.is.null))`
schließt genau den Beitrag mit Video aus.

| Anfrage | Ergebnis | erwartet |
|---|---|---|
| Kontrolle: alle Sonden | `[bild, text, video]` | ✅ |
| heute: `post_media=not.is.null` | `[bild]` | ✅ |
| `or=(video_url.not.is.null,post_media.not.is.null)` | `[bild, video]` | ✅ |
| `or=(and(video_url.is.null,kind.neq.event,post_media.is.null))` | `[text]` | ✅ |
| `or=(video…,and(text…))` | `[text, video]` | ✅ |
| alle vier | `[bild, text, video]` | ✅ |

**Verworfene Alternative: eine denormalisierte Spalte an `posts`** (etwa
`has_media boolean`, per Trigger gepflegt wie `like_count`). Sie hätte den
Logikbaum trivial gemacht — und dafür die Spec-Zusage „der Typ wird aus dem
Bestand abgeleitet, nicht aus einem zusätzlichen Feld am Beitrag" gebrochen,
eine Migration samt Trigger, Grants und Golden-Snapshot-Pflege nach sich gezogen
und eine zweite Wahrheit über „hat Bilder" geschaffen. Sie löst nichts, was
PostgREST nicht schon löst.

**Verworfene Alternative: die Komplementbildung** („statt drei gewählter Typen
den einen nicht gewählten ausschließen"). Sie setzt voraus, dass die vier Typen
den Bestand *partitionieren*. Das tun sie nicht: ein Beitrag kann `video_url`
**und** eine `post_media`-Zeile tragen und damit auf zwei Typen zutreffen.

### 1b. Der Cursor benutzt `or()` schon — zwei `or=` sind gewollt und UND-verknüpft

`fetchFeed` setzt für die Keyset-Grenze bereits `query.or(cursorAusdruck(...))`
(`src/lib/feed.ts:659`). Ab Seite 2 trägt eine Anfrage mit Typfilter deshalb
**zwei** `or=`-Parameter. Das ist kein Konflikt, sondern genau die gewünschte
Bedeutung — *Typvereinigung* UND *Cursorgrenze* —, aber nur, wenn PostgREST
wiederholte `or=`-Parameter mit UND verknüpft.

Auf **DEV** gemessen: `or=(id.eq.A,id.eq.B)` liefert `[A,B]`,
`or=(id.eq.B,id.eq.C)` liefert `[B,C]`, beide zusammen liefern `[B]`. Also UND,
nicht ODER, nicht „der letzte gewinnt".

Folge für die Zusagen: **„genau ein `or()`-Aufruf" ist als Zusage falsch** und
wäre ab Seite 2 rot geworden. Zugesagt wird stattdessen: auf Seite 1 genau eine
Typgruppe, auf Seite 2 Typgruppe **und** Cursorgruppe. Der aufzeichnende Mock in
`feed.auswahl.test.ts` speichert `or` heute als **eine Zeichenkette** und würde
den ersten Aufruf überschreiben — er muss auf ein Array umgestellt werden, sonst
prüft die Zusage still den falschen Aufruf.

### 2. `typen: FeedTyp[]`, und `null` entfällt ersatzlos

`FeedAuswahl.typ: FeedTyp | null` wird zu `FeedAuswahl.typen: FeedTyp[]`. Die
leere Menge heißt „alle Typen" — dieselbe Regel wie `if (gewaehlteTags.length > 0)`.

Zwei Zustände für dieselbe Sache („`null`" und „`[]`") wären eine Einladung für
den Fehler, den `feedSeitenKey` gerade verhindern soll: zwei Schlüssel für eine
Auswahl. Deshalb kein `FeedTyp[] | null`.

Folge für die Oberfläche: der Eintrag **„Alle Typen" verschwindet**. Er war der
sichtbare Ausdruck des `null`-Zustands im `<Select>`; als fünftes Kästchen neben
vier Typen wäre er ein Widerspruch — angehakt *und* alle vier angehakt müssten
dasselbe bedeuten, und abgehakt bei vier Haken hieße nichts.

### 3. Der Schlüssel trägt die kanonisierte Menge

`feedSeitenKey` bekommt `normalisierteTypen(auswahl.typen)` — dieselbe Form wie
`normalisierteTags`: dedupliziert und sortiert. Aus demselben Grund, den die
Datei bei den Tags schon nennt: der Schlüssel darf nicht davon abhängen, in
welcher Reihenfolge die Haken gesetzt wurden.

Die Sortierung ist die **feste Reihenfolge der Typen**, nicht die alphabetische
des Anzeigenamens — die Kanonisierung arbeitet auf den Bezeichnern
(`bild|event|text|video`), nie auf den Beschriftungen.

**Die volle Menge wird auf die leere abgebildet.** Alle vier angehakt und gar
nichts angehakt liefern dieselbe Liste — die vier Typen decken den Bestand
lückenlos ab, weil „Text" als Abwesenheit der drei anderen definiert ist. Ohne
diese Abbildung stünden zwei Cache-Schlüssel für ein Ergebnis, also genau der
Fehler, den Entscheidung 2 bei `null` vs. `[]` gerade vermeidet. Die Abbildung
sitzt in `normalisierteTypen`, **nicht** im Zustand der Oberfläche: wer vier
Haken gesetzt hat, sieht weiter vier Haken.

### 4. Die Chip-Leiste zeigt einen Chip je Typ

Heute ein Chip für den einen Typ, dazu `gefiltert = gewaehlteTags.length > 0 ||
typ !== null`. Künftig ein Chip je gewähltem Typ, jeder einzeln abwählbar, und
`gefiltert = gewaehlteTags.length > 0 || typen.length > 0`.

## Risks / Trade-offs

- **Ein Beitrag könnte doppelt erscheinen.** → Er kann nicht: `or` ist ein
  Prädikat auf *einer* Zeile, kein Join. Die Spec sichert es trotzdem zu, und
  ein Test deckt es ab (Beitrag mit Video *und* Bild bei Auswahl „Video + Bild").
- **Der Logikbaum ist eine Zeichenkette und scheitert zur Laufzeit, nicht beim
  Übersetzen.** → Ein Tippfehler in `and(…)` ergibt `PGRST100` statt eines
  Typfehlers. Mitigation: die Teilausdrücke stehen als **eine** Tabelle im Code,
  je Typ genau einmal, und jeder Typ bekommt eine Zusage.
- **`text` ist die einzige Konjunktion und damit die zerbrechlichste Stelle.**
  → Sie muss die *Verneinung der drei anderen* bleiben. Kommt je ein fünfter Typ
  dazu, ist `text` mitzuändern; der Kommentar sagt das an Ort und Stelle.
- **Die Leistung des ODER ist ungemessen** (gemini). Der Bestand trägt bereits
  eine bekannt teure RLS-Bedingung auf `posts`; ein Logikbaum mit vier Zweigen
  plus Cursorgruppe kann einen Index-Scan in einen Seq-Scan kippen. → Vor dem
  Abschluss den Plan für den schlimmsten Fall (drei Typen, Seite 2) aufnehmen
  und lesen. Als Aufgabe geführt, nicht als Vermutung abgehakt.
- **Zwei `or=`-Parameter sind eine stille Abhängigkeit von PostgREST-Verhalten.**
  → Gemessen (Entscheidung 1b) und als Zusage festgeschrieben, damit ein
  Versionswechsel sie bricht statt sie zu verbiegen.

## Migration Plan

Keine Datenbank-Migration. Kein Deploy-Sonderweg, keine Rückwärtskompatibilität
nötig: `FeedAuswahl` ist reiner Client-Zustand im Speicher, wird nirgends
persistiert und steht in keiner URL. Ein alter Cache-Eintrag verfällt mit dem
neuen Schlüssel von selbst.

Rücknahme: der Commit zurück.

## Open Questions

Keine. Die einzige offene Frage — was die leere Auswahl bedeutet — ist unter
Entscheidung 2 nach dem Vorbild der Tags beantwortet.
