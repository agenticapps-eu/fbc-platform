# Beitragstyp mehrfach wählbar (AGE-590)

Linear-Issue: AGE-590

## Why

Der Beitragstyp-Filter im Community-Feed lässt heute **genau einen** Typ zu
(`FeedAuswahl.typ: FeedTyp | null`, dargestellt als `<Select>`). Wer Bilder
*und* Videos sehen will, muss zweimal filtern und die Ergebnisse im Kopf
zusammenlegen — obwohl der Nachbarfilter „Beliebte Tags" im selben Seitenstreifen
längst mehrfach wählbar ist und als ODER verknüpft.

Die Auswahl soll deshalb zu Auswahlkästchen werden. Das ist **nicht bloß Optik**:
Kästchen versprechen Mehrfachauswahl, und dieses Repo hält in `feed.ts` selbst
fest, dass ein Versprechen an der Oberfläche ohne die passende Abfrage „eine
Lüge an der Oberfläche" wäre. Abfrage, Cache-Schlüssel und Spec müssen mitwandern.

## What Changes

- **BREAKING (intern):** `FeedAuswahl.typ: FeedTyp | null` wird zu
  `FeedAuswahl.typen: FeedTyp[]`. Der `null`-Zustand entfällt **ersatzlos** — die
  leere Menge heißt „alle Typen", genau wie die leere Tagmenge heute „alle
  Beiträge" heißt (`fetchFeed`: `if (gewaehlteTags.length > 0)`).
- Die vier voneinander unabhängigen `if`-Bedingungen in `fetchFeed` werden zu
  **einer** ODER-Verknüpfung über die gewählten Typen.
- `feedSeitenKey` trägt die **kanonisierte** Typmenge (ohne Dubletten, sortiert)
  statt eines einzelnen Wertes — nach demselben Muster wie `normalisierteTags`
  und aus demselben Grund: ein Klick, der nur die Reihenfolge dreht, darf
  dieselbe Auswahl nicht ein zweites Mal laden.
- Die Seitenleiste zeigt statt des `<Select>` vier Auswahlkästchen. Der Eintrag
  „Alle Typen" entfällt als eigene Option — „alle" ist der Zustand ohne Haken.
- Die Filterleiste über dem Feed (heute ein Chip mit dem einen Typ) zeigt einen
  Chip **je gewähltem Typ**, jeder einzeln abwählbar, wie bei den Tags.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `community-feed`: Die Anforderung **„Der Feed filtert nach Beitragstyp"**
  sichert heute einen Filter auf *einen* Typ zu („WHEN „Bild" gewählt wird").
  Sie wird auf eine Menge gewählter Typen mit ODER-Verknüpfung umgestellt,
  einschließlich der Bedeutung der leeren Menge.

## Impact

**Kein Migrationsbedarf, und das ist gemessen, nicht vermutet.** Zwei Fragen
standen offen, beide sind beantwortet.

**Erstens: versteht PostgREST die eingebettete `post_media`-Beziehung innerhalb
eines `or=(…)`?** Am lokalen Stack (postgrest/14.5) mit vier Sonden-Beiträgen
gemessen, und auf **DEV** an den drei öffentlich sichtbaren Beiträgen
gegengeprüft:

| Anfrage | lokal | DEV |
|---|---|---|
| `or=(video_url.not.is.null,post_media.not.is.null)` | `[bild, video]` ✅ | — |
| `or=(and(video_url.is.null,kind.neq.event,post_media.is.null))` | `[text]` ✅ | greift ✅ |
| `or=(video…,and(text…))` | `[text, video]` ✅ | — |
| alle vier Typen | `[bild, text, video]` ✅ | — |
| `or=(post_media.not.is.null)` / `…is.null` | — | `[]` / alle drei ✅ |

**Zweitens: `fetchFeed` verwendet `or()` bereits für den Cursor** — ab Seite 2
stehen also **zwei** `or=`-Parameter in einer Anfrage. Auf DEV gemessen: PostgREST
verknüpft wiederholte `or=`-Parameter mit **UND**. Zwei Gruppen, die je zwei von
drei Beiträgen auswählen, liefern zusammen genau den einen Durchschnitt. Das ist
die gewünschte Bedeutung — Typvereinigung UND Cursorgrenze — und kein Zufall,
auf den man sich stillschweigend verlassen darf: sie gehört zugesagt.

Damit bleibt der Filter **Teil der Abfrage** statt Nachfilterung der geladenen
Seite, und die bestehende Zusage „der Typ wird aus dem Bestand abgeleitet, nicht
aus einem zusätzlichen Feld am Beitrag" bleibt unangetastet. Eine denormalisierte
Spalte an `posts` wurde erwogen und **verworfen** — sie hätte genau diese Zusage
gebrochen und eine Migration samt Trigger nach sich gezogen, ohne etwas zu lösen,
was PostgREST nicht schon löst.

Betroffener Code:

- `src/lib/feed.ts` — `FeedTyp`, `FeedAuswahl`, `feedSeitenKey`, `FetchFeedArgs`,
  die Typbedingungen in `fetchFeed`
- `src/components/community/CommunityFeed.tsx` — `TYPEN`, der Zustand `typ`,
  die Seitenleiste, die Chip-Leiste, `gefiltert`
- `openspec/specs/community-feed/spec.md` (über das Delta)

Nicht betroffen: Datenbank, RLS, Edge Functions, Academy (`nurVideos` bleibt ein
eigener Weg mit eigenem Aufrufer).
