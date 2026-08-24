## Context

`/aktivitaet` steht seit AGE-528. Der Feed lädt seitenweise über einen Keyset-
Cursor `(created_at, id)`, die Sichtbarkeit erzwingt `posts_select_by_visibility`,
die Zahlen an den Karten kommen aus `post_engagement_counts(uuid[])` — einer
`security definer`-Funktion, die das Sichtbarkeitsprädikat ein zweites Mal führt.
Ein drittes Mal steht es in `former_member_entries` (20260823160000), dort mit
einer pgTAP-Zusage, die die Kopie festhält. Dieser Change fügt zwei weitere
Kopien hinzu und übernimmt jenes Muster.

Gemessener Ist-Zustand, gegen den hier entworfen wird:

| Was | Wo | Zustand |
|---|---|---|
| Composer | `CommunityFeed.tsx:156` | **vor** dem Raster, liegt über Feed **und** Sidebar |
| Tag-Filter | `CommunityFeed.tsx:213` | Chips, **eine** Auswahl, `.contains()` = UND |
| Rechte Spalte | `TagFilter` | gibt bei null Tags `null` zurück — die Spalte verschwindet ganz |
| Reiter | — | existieren nicht; `fetchFeed({ autorId })` gibt es |
| Speichern | — | kein Feld, keine Tabelle, kein Codewort |
| Beliebtheit | `post_engagement_counts` | entsteht **nach** dem Blättern, nicht sortierbar |
| Icons | 9 Streu-SVGs + `NavIcon` + `CategoryIcon` | `CrownIcon` zweimal byte-gleich |
| Bereichsfarben | `index.css` | existieren nicht — Blau-Rampe + `success/warning/danger` |
| `posts`-Grant | 20260715140000:56 | `select, insert, update, delete` — tabellenweit |
| Beitragserzeugung | `create_post_with_media` | `security definer` — der Client fügt nie direkt ein |

## Goals / Non-Goals

**Goals:**

- Eine Stelle für Glyphen, eine Stelle für die Bereichszuordnung, Farben als
  Tokens in beiden Themes.
- Der Composer in der Feed-Spalte, die Sidebar oben bündig.
- Drei Reiter, drei Ordnungen, jede mit eigenem Cursor-Pfad.
- Gespeicherte Beiträge, sichtbar nur für den, der sie gespeichert hat.
- Eine Sidebar, deren Zahlen nichts verraten.
- Mehrfachauswahl bei den Tags, die hält, was die Kästchen versprechen.

**Non-Goals:**

- **Umfragen.** Eigener Change (B). Der Composer bekommt hier keinen
  Umfrage-Knopf — ein Knopf ohne Feature dahinter ist eine Zusage, die die Fläche
  nicht einlösen kann.
- **Ein Event-Knopf im Composer.** Event-Beiträge sind systemverwaltet: nur die
  Trigger auf `events` schreiben sie (AGE-533). Ein Knopf, der einen
  Event-Beitrag von Hand anlegte, risse die Spiegelung auf.
- **Neue Dashboard-Karten.** Der Kanon wird auf bestehende Flächen angewendet.
  „Neue Nachrichten" ist eine Konzept-Beschriftung, keine Karte von uns.
- **`src/vision/`.** Toter Code, wird nicht angefasst und nicht mitgezählt.

## Decisions

### 1. Icon-Satz und Bereichs-Kanon sind zwei Module, nicht eines

Der Satz bildet `Name → Pfade`. Der Kanon bildet `Bereich → { icon, farbToken }`
und referenziert den Satz über den Namen.

*Warum nicht eines:* die Hälfte der aufzulösenden Glyphen sind Bedien-Symbole
(Chevron, Menü, Glocke, Lupe). In einer gemeinsamen Struktur bräuchten sie ein
Farbfeld, das für sie keine Bedeutung hat — und irgendwer füllte es später.

*Verworfen:* eine Icon-Bibliothek (`lucide`, `heroicons`). `NavIcon.tsx` hat die
Ablehnung schon begründet, und sie gilt weiter: hunderte ungenutzte Symbole und
ein zweiter Stil für einige Dutzend Pfade. Der Satz wächst hier um ~12 Glyphen,
nicht um 300.

### 2. Bereichsfarben als eigene Token-Familie, abgeleitet aus dem Bestand

Neue Tokens der Form `--color-bereich-<name>` plus eine gedämpfte Fassung für
Flächen hinter dem Icon, definiert im hellen `:root`-Block **und** im
`data-variant`-Block für navy.

*Warum nicht `--color-blue-400` und Freunde direkt:* die Rampe ist eine
**Helligkeitsleiter einer Farbe**, kein Bereichsvokabular. Ein Bauteil, das
`--color-blue-400` schreibt, sagt „hellblau", nicht „Events" — und beim nächsten
Themewechsel stimmt das eine, aber nicht das andere.

*Warum nicht `success/warning/danger` mitbenutzen:* die tragen eine **Wertung**.
Ein grünes Mitglieder-Icon behauptete, Mitglieder seien gut gelaufen.

### 3. „Beliebteste" braucht einen materialisierten Zähler auf `posts`

`like_count integer not null default 0` auf `posts`, geführt von einem Trigger auf
`post_likes` (INSERT/DELETE), einmalig für den Bestand nachgetragen.

*Warum überhaupt:* `post_engagement_counts` läuft über die IDs einer **bereits
geladenen** Seite. Nach etwas zu sortieren, das erst nach dem Blättern entsteht,
geht nicht.

*Verworfen — eine eigene Tabelle `post_engagement` mit nur SELECT-Recht:* wäre
gegen Fälschung von Haus aus sicher, aber die Ordnung liefe dann über eine
eingebettete Ressource. Der Keyset-Cursor braucht `or(...)`-Bedingungen über die
Sortierfelder, und die sind über eine Einbettung nicht ausdrückbar. Das Blättern
fiele auf `offset` zurück — genau die stille Kappung, die AGE-528 abgeschafft hat.

*Verworfen — eine eigene RPC `feed_by_popularity(...)`:* wäre die **vierte** Kopie
des Sichtbarkeitsprädikats, und sie müsste Autoren-Anreicherung, Zähler und
Cursor nachbauen. Dieselbe Begründung, mit der `nurVideos` seinerzeit **kein**
zweiter Ladeweg wurde.

*Hingenommen:* die Ordnung läuft über einen veränderlichen Wert. Reagiert jemand
während des Blätterns, kann ein Beitrag doppelt oder gar nicht erscheinen. Das
ist der Ordnung eigen und wird nicht ausgeglichen — der Ausgleich wäre ein
Schnappschuss je Sitzung, also Zustand, den niemand aufräumt.

### 4. `authenticated` verliert INSERT auf `posts` und bekommt UPDATE nur auf drei Spalten

`grant select, delete on public.posts` und
`grant update (body, hashtags, visibility) on public.posts`.

*Warum INSERT ganz weg:* Beiträge entstehen über `create_post_with_media`
(`security definer`), Event-Beiträge über Trigger. Der Client fügt an keiner
Stelle direkt ein — belegt, nicht vermutet: `from("posts")` steht im Quelltext
fünfmal, dreimal lesend, einmal `update`, einmal `delete`.

*Warum UPDATE eng:* `posts_write_own` ist `for all` auf `author_id = auth.uid()`.
Mit tabellenweitem UPDATE könnte ein Autor `like_count` seines eigenen Beitrags
setzen — die Sortierung nach Beliebtheit wäre eine Einladung. Die drei Spalten
sind die, die `updatePost` tatsächlich schreibt (`feed.ts:694`).

*Warum nicht stattdessen ein Trigger, der `like_count` festnagelt:* ginge auch,
wäre aber eine Regel, die nur zur Laufzeit spricht. Ein Grant steht im
Golden-Snapshot und fällt beim nächsten Versehen als Testfehler auf.

**Folge für `grants_test.sql`:** §1 bekommt `post_saves`-Zeilen und die
`posts`-Zeile ohne `INSERT`; §2 bekommt eine `posts.UPDATE=body,hashtags,visibility`-
Zeile, wozu `posts` in die `table_name in (...)`-Liste jener Abfrage aufgenommen
werden muss.

### 5. `post_saves` hängt am Profil, nicht am Auth-Konto

`post_saves (profile_id uuid references profiles(id) on delete cascade, post_id
uuid references posts(id) on delete cascade, created_at timestamptz not null
default now(), primary key (profile_id, post_id))`.

*Warum `on delete cascade` beidseitig:* eine gespeicherte Zeile ohne Beitrag oder
ohne Profil ist kein Datum, sondern Müll. Und sie begründet ohnehin kein Recht.

*Warum der Reiter trotzdem über `posts` joint statt über gespeicherte IDs
nachzuladen:* die RLS auf `posts` ist das Gate. Ein Join lässt sie greifen; ein
`in (ids)` aus vorher gelesenen `post_saves`-Zeilen führte zu einer Liste, deren
Länge nicht zur Seitengröße passt, und die Sichtbarkeit müsste danach im Client
korrigiert werden — genau die Kulisse, die dieses Repo nicht will.

### 6. Die zwei neuen Aggregat-RPCs kopieren das Prädikat und werden dabei festgehalten

`feed_tag_counts()` und `feed_top_authors(limit)`, beide `security definer`,
`stable`, `set search_path`, mit Obergrenze, **ohne** `execute` für `anon`.

*Warum `security definer` trotz vorhandener RLS:* ein `group by` über `posts`
unter RLS ist zwar korrekt, aber der Zähler soll ausdrücklich dieselbe Regel
tragen wie die Kopie in `post_engagement_counts` — und diese Absicht muss
prüfbar sein. Sie wird per pgTAP festgehalten, wie bei `former_member_entries`.

*Namen aus `profiles_public`, nicht aus `profiles`:* `profiles_public` schließt
zurückgezogene, unbestätigte, deaktivierte und gelöschte Profile selbst aus. Ein
eigenes Prädikat hier wäre eine fünfte Kopie.

*Ein Tag mit null sichtbaren Beiträgen erscheint gar nicht* — nicht mit der Zahl
null. Seine bloße Anwesenheit verriete, dass es ihn gibt.

### 7. Reiter, Ordnung und Filter sind Argumente von `fetchFeed`, keine zweite Ladefunktion

`FetchFeedArgs` wächst um `reiter`, `ordnung`, `tags: string[]` und `typ`. Der
Cursor wird zu einer Form, die das führende Feld der jeweiligen Ordnung
mitträgt.

*Warum kein zweiter Ladeweg:* die Begründung steht schon in `feed.ts:385` für
`nurVideos` — Autoren-Anreicherung, Zähler und Keyset müssten dreimal gepflegt
werden.

*`.overlaps()` statt `.contains()`* für die Tags: `contains` prüft, ob das
Beitrags-Array **alle** gewählten Tags enthält (UND), `overlaps` prüft auf
Schnittmenge (ODER). Bei einem einzigen gewählten Tag sind beide gleich — der
heutige Ein-Tag-Filter bricht also nicht.

## Risks / Trade-offs

- **Der Nachtrag von `like_count` läuft auf PROD über den Bestand** → einmalige
  `update`-Anweisung in der Migration, in einer Transaktion mit dem `add column`.
  Bei ~70 Konten und dreistelliger Beitragszahl ist das ein Sekundenbruchteil;
  die Größenordnung wird vor der Anwendung gelesen, nicht geschätzt.
- **Der Grant-Entzug ist die riskanteste Zeile des Changes** → nimmt man INSERT
  weg und es gäbe doch einen Weg, der es braucht, bricht das Anlegen von
  Beiträgen auf PROD. Deshalb: der pgTAP-Beleg „ein Beitrag entsteht weiter" läuft
  **vor** dem Deploy, und die Migration ist als eigener Schritt anwendbar.
- **`grants_test.sql` kippt an zwei Stellen gleichzeitig** → beide Golden-Strings
  im selben Commit nachziehen, sonst blockiert der CI-Job `migrations` jeden
  weiteren Schritt.
- **jsdom sieht kein Layout** → Composer-Spalte, Sidebar-Höhe, Auswahlkästchen
  und Überlauf bei 375 px brauchen die Sichtprobe im Browser gegen den lokalen
  Stack. Ein grüner Testlauf belegt hier nichts.
- **Die Ordnung nach Beliebtheit ist nicht stabil** → bewusst hingenommen, siehe
  Entscheidung 3. Steht als Eigenschaft in der Anforderung, nicht als Fehler.
- **Neun Streu-SVGs aufzulösen berührt acht Dateien, die dieser Change sonst
  nicht bräuchte** → die Umstellung läuft als eigener, erster Abschnitt mit
  eigener Sichtprobe, damit ein Fehler dort nicht als Feed-Fehler erscheint.

## Migration Plan

1. **Kanon zuerst** — Satz, Kanon, Tokens, Auflösung der Streu-SVGs. Keine
   Datenbank, kein Verhalten. Sichtprobe in beiden Themes.
2. **`post_saves`** — Tabelle, RLS, Grants, `grants_test.sql` §1, `rls_test.sql`.
3. **`like_count`** — Spalte, Trigger, Nachtrag; danach der Grant-Entzug und
   `grants_test.sql` §1 + §2 im selben Commit.
4. **Aggregat-RPCs** — `feed_tag_counts`, `feed_top_authors`, pgTAP-Zusagen auf
   die Prädikat-Kopien.
5. **Frontend** — Composer-Spalte, Reiter, Ordnungen, Sidebar, Typ-Filter.
6. **Sichtprobe** — beide Themes, 375 px und breit, gegen den lokalen Stack.

*Rücknahme:* Schritte 2–4 sind additiv und einzeln zurücknehmbar. Schritt 3
enthält als einziger einen **Rechte-Entzug**; seine Rücknahme ist ein
`grant insert, update on public.posts to authenticated` und das Zurückdrehen der
zwei Golden-Strings.

## Open Questions

- **Wie viele aktivste Mitglieder zeigt die Liste?** Das Konzeptbild zeigt eine
  kurze Liste; fünf ist die naheliegende Zahl, entschieden ist sie nicht.
- **Zählt „aktivste" Beiträge oder Beiträge plus Kommentare?** Beiträge ist das
  billigere und das erklärbarere; Kommentare mitzuzählen hieße, ein zweites
  Prädikat (`comments_select_visible`) mitzuführen.
- **Bleibt der gewählte Reiter über einen Seitenwechsel erhalten?** Ein Parameter
  in der URL wäre teilbar, kostet aber Routing-Arbeit, die das Issue nicht nennt.
