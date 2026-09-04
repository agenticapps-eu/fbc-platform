## Context

`src/lib/anon-anreicherung.test.ts` prüft seit AGE-291, dass ausgeloggt nur
Relationen angefragt werden, für die `anon` ein Leserecht hält. Der Mechanismus:
ein Stub um `./supabase` zeichnet jeden `from(tabelle)`-Aufruf auf, der Test ruft
vier Lesefunktionen und vergleicht die Aufzeichnung gegen `ANON_DARF_LESEN`.
Stand heute grün mit 9 Zusagen.

Seine zwei Grenzen sind nicht vermutet, sondern am 13.08. mit Eingriffen belegt,
die ihn grün ließen — und sie stehen als eigene Anforderung in
`openspec/specs/directory-search/spec.md`.

**Was sich seither verschoben hat und den Zuschnitt ändert:** die
Datenbank-Hälfte ist zu. `supabase/tests/grants_test.sql` §6 führt seit AGE-602
einen Gesamtvergleich über genau sechs für `anon` ausführbare Funktionen; eine
siebte macht CI rot. Der im Issue als „unangenehmer" bezeichnete Weg — eine neue
`SECURITY DEFINER`-Funktion für `anon` — schlägt also bereits an. Offen ist nur
noch der Client: er darf keine Funktion rufen, die er nicht rufen soll, und die
Prüfung muss mehr Fläche sehen als vier Handgriffe.

### Gemessener Bestand (2026-09-03, auf `2359eae`)

| Was | Befund |
|---|---|
| Bestehender Wächter | 9/9 grün, ruft `fetchFeed`, `fetchEvents`, `fetchEvent`, `fetchComments` |
| `anon`-ausführbare Funktionen laut Katalog | 6, geschlossene Liste in `grants_test.sql` §6 |
| davon vom Client überhaupt gerufen | 3 — die anderen drei sind Policy-/Storage-intern |
| `MembershipGate` bei fehlender Sitzung | gibt die Wand zurück, **nicht** `children` |
| `ActivationGate` bei fehlender Sitzung | `if (!user) return <>{children}</>` — die Hülle rendert |
| `navItems` ohne `requiresAuth`/`minTier` | `/` · `/events` · `/aktivitaet` |
| Nur in `App.tsx`, ohne Wache | `/events/:id` · `/login` · `/aktivierung` · `/passwort-vergessen` · `/passwort-neu` |
| Rechtsseiten | **nicht literal** — `rechtsseiten.map(…)` aus `src/content/legal/meta.ts`, heute vier Slugs |
| `<Routes>` im Produktivcode | genau eines, `App.tsx:93` — es gibt keinen zweiten Router |
| Abfragen in der Hülle | 7 gefunden; **6 bedingt**, 1 nicht (siehe unten) |

**Die drei ausgeloggt tatsächlich gerufenen Funktionen**, je an der Stelle
gemessen, nicht geraten:

| Funktion | Stelle | Bedingung |
|---|---|---|
| `post_engagement_counts` | `src/lib/feed.ts:801` | keine — läuft im anon-Feed mit |
| `event_registration_counts` | `src/lib/events.ts:398` | keine — läuft in der anon-Eventliste mit |
| `feed_tag_counts` | `src/lib/feed-sidebar.ts:45` | `CommunityFeed.tsx:272` trägt **kein** `enabled` |

Alle drei stehen in der Sechserliste von `grants_test.sql` §6 — bei den
Funktionen hält sich der Client also an die Grants. Die Gegenprobe im selben
Modul stützt das: `feed_top_authors` steht **nicht** in der Sechserliste und
trägt an `CommunityFeed.tsx:276` ein `enabled: uid !== null`. Der Unterschied
zwischen den beiden Zeilen ist genau die Zusage, die dieser Change festschreibt —
heute hält sie niemand fest.

### Der Bestandsfehler, den die Planungs-Review fand

Bei den **Relationen** hält sich der Client nicht an die Grants. Aus der
Planungs-Review (codex, HIGH); nachgemessen, Kette geschlossen:

| Glied | Beleg |
|---|---|
| Die Hülle rendert ausgeloggt | `ActivationGate.tsx`: `if (!user) return <>{children}</>` |
| Die Seitenleiste ist unbedingt im Baum | `AppShell.tsx` — `<aside … "hidden … lg:flex">`, per CSS versteckt, nicht ausgehängt |
| `FeedbackButton` sitzt darin | `AppShell.tsx:871` (Leiste) und `:1181` (Schublade) |
| Seine Abfrage trägt **kein** `enabled` | `FeedbackButton.tsx:100` |
| …und steht **vor** dem frühen Ausstieg | `FeedbackButton.tsx:101` — `if (!user) return null`; der Kommentar darüber (AGE-529) begründet die Reihenfolge mit den Hook-Regeln |
| Sie liest `feedback_themes` | `feedback.ts:193` |
| `anon` darf das nicht | `grants_test.sql:49` — `feedback_themes/authenticated=SELECT` |

Ein ausgeloggter Besucher auf `/aktivitaet` löst damit heute einen Request aus,
den nur ein 401 beantwortet.

**Warum meine erste Messung ihn nicht fand:** ich hatte die Hooks aus der
Importliste von `AppShell.tsx` geprüft (`useUngelesen`, `useHinweise`,
`HeaderSearch`, `push`) und daraus „alle Abfragen der Hülle sind bedingt"
geschlossen. `FeedbackButton` ist ein Bauteil, kein Hook, und seine Abfrage steht
in seinem eigenen Rumpf. Eine Aufzählung der bekannten Stellen fand die
unbekannte nicht — dieselbe Klasse von Fehler, gegen die dieser Change die
Positivliste stellt.

**Behebung:** `enabled: Boolean(user)` an `FeedbackButton.tsx:100`. Nicht: das
Recht erteilen. Der Knopf ist für Ausgeloggte ohnehin unsichtbar, es gibt also
nichts zu zeigen, wofür die Themen gebraucht würden.

### Messung am Katalog der Produktionsinstanz (2026-09-03, 05:39 UTC)

Das Spec-Delta verlangt für jede Rechte-Zusage einen Beleg aus der Produktion,
weil die Default Privileges der Instanzen auseinanderliegen. Gemessen rein
lesend über `pg_proc` und `information_schema.role_table_grants`
(`.gstack/prod-anon-katalog.mts`, kein Schreibweg):

- **6 für `anon` ausführbare Funktionen** — Zeichen für Zeichen die Liste aus
  `grants_test.sql` §6: `event_cover_lesbar`, `event_registration_counts`,
  `feed_tag_counts`, `post_engagement_counts`, `post_media_lesbar`,
  `suchbegriff_zu_tsquery`.
- **7 für `anon` lesbare Relationen** — genau `ANON_DARF_LESEN`: `badges`,
  `events`, `membership_tiers`, `partner_categories`, `post_media`, `posts`,
  `tags`. `feedback_themes` ist **nicht** darunter, was den Befund oben auf PROD
  bestätigt.
- Die drei vom Client gerufenen Funktionen halten ihr Recht **rollen-eigen**
  (`anon=X/postgres` in `proacl`), nicht bloß über `PUBLIC`. Das ist die
  Unterscheidung, an der AGE-602 hing: ein `revoke … from public` allein nähme
  ihnen das Recht nicht.

Damit ist die lokale Sechserliste für PROD belegt und nicht nur behauptet.

### Positivkontrolle: der Bestand ist blind (gemessen 2026-09-04, auf `7694839`)

Die Abnahme aus AGE-542 verlangt Eingriffe, die **heute grün bleiben**. Drei
gebaut, jeder für genau eine Zusage, alle auf einer Route, die die Fläche schon
abdeckt (`/aktivitaet`) — ausser C, der ja gerade den Rand prüft:

| Eingriff | Was er tut | Bestandswächter |
|---|---|---|
| **A** — Relation | neue Datei mit eigenem `supabase.from("profiles_public")` | **9/9 grün** |
| **B** — Funktion | `supabase.rpc("search_directory")`, nicht in der Sechserliste | **9/9 grün** |
| **C** — Rand | unbewachte `<Route path="/probe">` in `App.tsx` | **9/9 grün** |
| alle drei zusammen | | **9/9 grün** |

**Und die Grenze ist weiter, als der Vorschlag annahm: es ist nicht der Wächter,
der blind ist, sondern das Repo.** Mit allen drei Verstößen im Baum läuft die
**vollständige** Suite durch — `pnpm test` **2478/2478 in 219 Dateien**, exakt
die Zahl des sauberen Bestands. Kein einziger anderer Test im Repositorium
bemerkt eine ausgeloggt gerufene gesperrte Relation, eine nicht erlaubte
Funktion oder eine unbewachte Route. Der Vorschlag begründete den Change mit der
Reichweite *einer Datei*; gemessen ist die Lücke repositoriumsweit.

Der Bestand des Vorschlags nannte **2473** Tests — das war der Stand auf
`2359eae`. Der Zweig steht seit dem 04.09. auf `main` (`7694839`, AGE-688 und
AGE-697 eingerechnet); die Zahl, gegen die Gruppe 8 hält, ist **2478**.

Die drei Eingriffe liegen als Umschalter unter `.gstack/eingriff.py`
(gitignoriert), damit Gruppe 8 sie einzeln wieder einsetzen kann, ohne dass
`git status` dazwischen je unsauber wird. Hin und zurück belegt: nach `off` ist
der Baum wieder sauber und der Bestandslauf 9/9.

## Goals / Non-Goals

**Goals:**

- Die Prüffläche wird aus `navItems` und `App.tsx` **abgeleitet**, nicht
  abgeschrieben.
- Funktionsnamen werden aufgezeichnet und gegen eine zweite Positivliste geprüft.
- `AppShell` und `AuthProvider` laufen unter dem Wächter mit.
- Der Rand der Ableitung ist selbst zugesichert: eine ungeführte, unbewachte
  Route in `App.tsx` macht rot.
- Beide geschlossenen Lücken sind mit je einem Eingriff belegt, der heute grün
  bleibt (die Abnahmebedingung aus AGE-542).

**Non-Goals:**

- **Kein Tor im `supabase`-Client**, keine sonstige Änderung an Datenschicht,
  Seiten oder Hülle. Der einzige Produktiv-Eingriff ist die eine `enabled`-Zeile
  an `FeedbackButton.tsx:100`, ohne die der neue Prüfstand rot ankäme.
- **Keine Migration, keine Rechteänderung.** Die Grants bleiben, wie sie sind;
  `grants_test.sql` wird nicht angefasst. `feedback_themes` bleibt für `anon`
  gesperrt — behoben wird die Abfrage, nicht das Recht.
- **Kein statisches Inventar über `src/`.**
- **Keine Erfassung von `supabase.functions.invoke`.** Edge Functions sind eine
  eigene Grenze mit eigener Tokenprüfung im Rumpf; sie gehen nicht über die
  Grants der Datenbankrolle. Die Grenze wird in der Spec benannt statt
  stillschweigend gelassen.

## Decisions

### D1 — Die Fläche wird abgeleitet, nicht abgeschrieben

**Gewählt:** `navItems.filter(i => !i.requiresAuth && !i.minTier)`, **plus jede
Registry, aus der Routen entstehen**, plus eine namentlich geführte Restliste der
Routen, die nur als Literal in `App.tsx` stehen.

Der mittlere Teil ist ein Befund aus der Planungs-Review (codex, HIGH) und
korrigiert einen Fehler in der ersten Fassung: die vier Rechtsseiten standen dort
als Handliste. Sie sind aber keine — `App.tsx` erzeugt sie mit
`rechtsseiten.map(…)` aus `src/content/legal/meta.ts`. Ein fünfter Eintrag dort
hätte den ausgelieferten Routentisch verändert, ohne `App.tsx`, `navItems` oder
die Handliste anzufassen; die Route wäre nie montiert worden und die Randzusage
wäre grün geblieben. **Eine Registry, die Routen erzeugt, ist selbst eine Quelle
der Fläche und wird importiert, nicht abgeschrieben.**

Gemessen: `<Routes>` kommt im Produktivcode genau einmal vor (`App.tsx:93`), es
gibt also keinen zweiten Router und keine weitere Registry dieser Art. Das war
eine offene Annahme in der Review (gemini) und ist damit geschlossen.

**Warum nicht die zwei Wege aus dem Issue:**

- *Zentrales anon-Lesetor im `supabase`-Client.* Es greift zur **Laufzeit**,
  also nur auf Pfaden, die auch ausgeführt werden — die im Issue genannte „neue
  Datei" fiele weiter durch, solange sie kein Test montiert. Es löst damit
  ausgerechnet Lücke 1 nicht. Dazu ein Eingriff in die Datenschicht, dessen
  Fehlalarm eine echte Seite bricht.
- *Lint-/AST-Regel gegen direkten `supabase`-Zugriff.* Sie verbietet ein Muster,
  statt eine Aussage zu prüfen, und braucht ihrerseits einen Begriff von
  „ausgeloggt erreichbar" — den sie nicht hat.

**Warum die Ableitung reicht:** `MembershipGate` gibt bei fehlender Sitzung die
Wand zurück, nicht `children`. Ein Modul hinter `requiresAuth` oder `minTier`
rendert ausgeloggt also **nie**. Die ausgeloggte Fläche ist damit klein und
vollständig aufzählbar — was sie für einen Import-Graphen nicht wäre, denn der
sähe alles, was `App.tsx` importiert, und ertränke die Prüfung in Fehlalarmen.

### D2 — Montieren statt Lesefunktionen rufen

Nur durch das Montieren einer Route laufen `AppShell` und `AuthProvider` mit.
Beide rufen selbst Daten ab und standen in keinem der vier bisherigen Aufrufe.
Ein Aufruf von `fetchFeed` erreicht sie prinzipiell nicht.

Der Preis: jsdom, Provider-Aufbau, `await findBy…` für die `lazy()`-Routen. Das
ist teurer als vier direkte Aufrufe und der Grund, warum es bisher nicht so
gebaut war.

### D3 — `App.tsx` wird über den TypeScript-AST gelesen, nicht über einen Regex

Die Randzusage („eine ungeführte, unbewachte Route macht rot") muss jede
`<Route path=…>` in `App.tsx` finden und ihr Element klassifizieren. Ein Regex
über den Quelltext bricht am ersten mehrzeiligen `element={…}` — und die Datei
besteht überwiegend aus mehrzeiligen Elementen.

`typescript` ist bereits Abhängigkeit (6.0.3). `ts.createSourceFile` plus ein
Besuch über die JSX-Knoten liefert Pfad und umschließende Elementnamen exakt.
Keine neue Abhängigkeit.

**Der Parser fällt geschlossen aus, nicht offen.** Zwei Befunde aus der
Planungs-Review treffen denselben Punkt: `ts.createSourceFile` liefert Syntax,
keine Auflösung. `path={item.path}` und ``path={`/${seite.slug}`}`` stehen heute
schon in der Datei; morgen können Konstanten, Aliase, Spreads oder eingebundene
Routenfragmente dazukommen (codex, MEDIUM), und die Wachen sind heute an drei
Namen erkannt, was einen vierten `ModeratorGate` als „unbewacht" ausgäbe
(gemini, MEDIUM).

Beide Male ist die falsche Antwort, das Muster zu erweitern, bis es passt. Die
richtige ist: **die akzeptierten Formen sind aufgezählt, und jede andere Form
macht rot, mit Datei und Zeile.** Ein unbekanntes `<Route>` ist dann kein stiller
Durchlässer, sondern eine Entscheidung, die jemand trifft — Form aufnehmen oder
Route führen. Dasselbe gilt für einen unbekannten Wächternamen: rot, mit dem
Namen in der Meldung.

**Verworfen:** die Routen aus `App.tsx` zur Laufzeit auslesen, indem der
gerenderte Baum inspiziert wird. React Router gibt die Routendefinition nicht in
einer Form heraus, aus der sich „liegt hinter `RequireAuth`" ablesen ließe, ohne
denselben Baum wieder zu parsen.

**Verworfen:** die Wachen an einer Namenskonvention (`Require…`) erkennen
(gemini, MEDIUM). Eine Konvention, die nur ein Test kennt, ist ein ungeschriebener
Vertrag; `MembershipGate` heißt heute schon nicht `RequireTier` und wäre der erste
Verstoß. Das geschlossene Ausfallen deckt denselben Fall, ohne etwas zu
verlangen, woran sich niemand erinnern muss.

### D4 — Zwei Positivlisten, und die zweite heißt, was sie ist

`ANON_DARF_LESEN` bleibt unverändert — sie deckt sich mit den sieben auf PROD
gemessenen Relationen.

Die Funktionsliste heißt **`ANON_RUFT_AUF`**, nicht `ANON_DARF_AUSFUEHREN`. Der
erste Name war falsch und die Review hat es benannt (codex, MEDIUM): die Liste
enthält drei Namen, die Grants erlauben sechs. Sie ist also **keine Abschrift der
Grants**, sondern die engere Aussage „mehr als diese ruft der Client ausgeloggt
nicht". Ein Name, der Gleichheit behauptet, wo eine Teilmenge steht, führt den
nächsten Leser in die Irre — und die drei anderen aufzunehmen hieße, eine
Erlaubnis auszusprechen, die niemand braucht: `event_cover_lesbar`,
`post_media_lesbar` und `suchbegriff_zu_tsquery` sind Policy- und Storage-intern.

Der Kommentar über der Liste hält beide Richtungen fest:

- Jeder Name hier MUSS in der Sechserliste von `grants_test.sql` §6 stehen —
  sonst ruft der Client etwas, das er nicht darf.
- Nicht jeder Name dort muss hier stehen — was der Client nicht ruft, braucht
  keine Zeile.

Die Teilmengen-Richtung wird nicht im Prüfstand nachgebaut (gemini, LOW): die
Grants stehen in SQL, sie hier ein drittes Mal abzuschreiben verschöbe das
Auseinanderlaufen nur um eine Datei. Was die Aussage trägt, ist
`grants_test.sql` §6 plus die PROD-Messung oben — beide sind genannt.

### D5 — Der neue Wächter ist eine eigene Datei; der alte behält seinen Rest

`src/lib/anon-anreicherung.test.ts` trägt heute zwei verschiedene Dinge: den
Flächen-Wächter (`describe("Die Regel, nicht der Einzelfall")`) und eine Reihe
Verhaltenszusagen zur Anreicherung (Maskierung, Spaltenwahl, die
eingeloggte Gegenprobe). Nur das erste wird ersetzt.

- **Neu:** `src/lib/anon-flaeche.test.tsx` — montiert die abgeleitete Fläche,
  hält Relationen und Funktionsnamen fest, trägt beide Positivlisten und die
  Randzusage über `App.tsx`.
- **Bleibt:** die Verhaltenszusagen in `anon-anreicherung.test.ts`. Sie messen
  etwas anderes (was die Anreicherung *liefert*, nicht *anfragt*) und wären
  durch das Montieren nicht ersetzt. `fetchComments` ist der klarste Fall: es
  wird ausgeloggt nur erreicht, wenn ein offener Thread beim Abmelden montiert
  bleibt — eine Interaktion, kein Seitenaufruf.
- **Entfällt dort:** `describe("Die Regel, nicht der Einzelfall")`, samt der
  Liste `ANON_DARF_LESEN`, die in die neue Datei umzieht. Der Kommentarkopf über
  der Liste zieht mit und wird auf die neue Reichweite nachgezogen.

Damit gibt es die Positivlisten **einmal**, an einer Stelle, und keine
Doppelpflege.

### D6 — Der aufzeichnende Stub liegt in einem Hilfsmodul

`vi.mock` wird gehoben, der Fabrik-Rumpf darf also nichts aus dem Modulkopf
sehen. Der Stub kommt deshalb aus einem eigenen Modul, das **innerhalb** der
Fabrik importiert wird; der Rekorder wird als Objekt exportiert, damit der Test
nach dem Lauf hineinsehen kann.

Der Stub bleibt derselbe Bauart wie heute — eine Kette, die sich selbst
zurückgibt, mit `then` als Abschluss. Er wird um zwei Dinge erweitert: `rpc`
hält den Namen fest, und die Aufzeichnung liegt in einem geteilten Objekt statt
in Modulvariablen.

**Er muss außerdem `auth` beantworten.** Der heutige Stub kennt nur `from` und
`rpc`, weil der heutige Test nur Lesefunktionen ruft. Sobald `AuthProvider`
montiert wird, braucht er mindestens `auth.getSession()` und
`auth.onAuthStateChange()` — beide in ihrer ausgeloggten Form, und
`onAuthStateChange` muss ein abbestellbares Abonnement zurückgeben, sonst
scheitert das Aufräumen. Aus der Planungs-Review (codex, MEDIUM).

### D7 — Die Montage-Rüstung bildet die echte Provider-Reihenfolge ab

Aus der Planungs-Review (codex, MEDIUM), an zwei Stellen:

- **Vollständigkeit.** `AppShell` verlangt mehr als Router und Query-Client;
  `App.test.tsx` schreibt die nötige Reihenfolge bereits auf. Die Rüstung wird
  von dort übernommen, nicht neu erfunden — eine zweite, abweichende Rüstung
  wäre eine zweite Wahrheit über den Aufbau der Anwendung.
- **Isolation.** Je Fall ein **frischer** `QueryClient` mit abgeschalteten
  Wiederholungen, ein zurückgesetzter Rekorder und ein `unmount` danach. Ohne
  das erste beantwortet der Cache des vorigen Falls die Abfrage des nächsten und
  die Aufzeichnung bleibt leer; ohne das zweite werden Aufrufe der falschen Route
  zugeschrieben.
- **Abwarten.** Dass ein `lazy()`-Element im Baum steht, heißt nicht, dass seine
  Abfragen gelaufen sind. Gewartet wird auf die Abfragen, nicht auf das Element.

**Dauerhafte Positivkontrollen** gehören dazu, je eine für eine Relation und eine
Funktion: ohne sie ist eine leere Aufzeichnung von einer sauberen nicht zu
unterscheiden, und der ganze Prüfstand wäre ein Test im Vakuum.

### Abnahme (gemessen 2026-09-04)

Jeder der drei Eingriffe trifft am neuen Prüfstand **genau eine** Zusage und
benennt die Ursache:

| Eingriff | Meldung | Fälle rot |
|---|---|---|
| A — Relation | `expected [ 'profiles_public' ] to deeply equal []` | 1 von 33 |
| B — Funktion | `expected [ 'search_directory' ] to deeply equal []` | 1 von 33 |
| C — Rand | `expected [ 'App.tsx:247 — /probe' ] to deeply equal []` | 1 von 33 |
| zurückgenommen | — | **33/33 grün** |

Zusätzlich, weil die Abnahme im Vorgang wörtlich eine *für `anon` ausführbare*
Funktion verlangt (Eingriff B nutzt mit `search_directory` eine, die es nicht
ist): dieselbe Probe mit `suchbegriff_zu_tsquery` — steht in der Sechserliste,
`anon` DARF sie ausführen, der Client ruft sie nicht — meldet
`expected [ 'suchbegriff_zu_tsquery' ] to deeply equal []`, ebenfalls 1 von 33.
Die Positivliste ist eine Whitelist von drei Namen; sie fängt damit auch das,
was die Grants erlauben, der Client aber nicht rufen soll.

**Die erste Fassung der Kontrollen war fehlerhaft und ist korrigiert.** Kontrolle
A verglich gegen `[]` statt gegen den Bestand; sie schlug bei Eingriff C mit an,
weil `/probe` ebenfalls ungeführt ist. Ein Eingriff, der zwei Zusagen trifft,
belegt keine davon — die Kontrollen messen jetzt die DIFFERENZ zum unveränderten
`App.tsx`.

**Der Bestandsfehler, RED und GREEN:** vor der `enabled`-Zeile meldete der neue
Wächter `4 failed | 22 passed`, und die vier roten Routen waren exakt die vier,
die innerhalb der `AppShell` laufen (`/`, `/events`, `/aktivitaet`,
`/events/:id`) — Rechtsseiten und Login liegen ausserhalb der Hülle und waren
sauber. Nach der Zeile: `26 passed`. Bei den FUNKTIONEN gab es zu keinem
Zeitpunkt einen Verstoss; dort hält sich der Client an die Grants, wie die
Vorabmessung sagte.

**Gesamtstand:** `pnpm test` **2510/2510** in 220 Dateien (Bestand war 2478/219;
33 neue Zusagen, eine ausgezogene). `lint`, `typecheck`, `build` je Exit 0,
`openspec validate --all` 32/32.

### Was die Umsetzung gegen den Plan entschieden hat

Drei Abweichungen, je mit Grund:

1. **Die Sonde liegt in `src/test/anon-sonde.ts`, nicht in `src/lib/__proben__/`.**
   Das Repo hat für Testhilfen bereits `src/test/` (`auth-fixtures.tsx`). Eine
   zweite Konvention zu eröffnen wäre gegen die Regel „match the existing style".
2. **Die Rüstung übernimmt den Provider-STAPEL aus `App.test.tsx`, nicht dessen
   Auth-Weg.** D7 sagt „Rüstung von dort übernehmen", D2 sagt „`AuthProvider`
   muss mitlaufen" — beides wörtlich geht nicht, denn `App.test.tsx` schiebt über
   `AuthFixture` den Kontext direkt hinein und umgeht den Provider gerade. Hier
   läuft der echte Provider, der Rest des Stapels stammt von dort.
3. **Die Kette der Sonde ist ein Proxy, keine Aufzählung.** Der Produktivcode
   hängt an `from()` über zwanzig Glieder (`eq`, `filter`, `overlaps`, `range`,
   …). Eine Handliste bräche beim ersten neuen Glied — mit einem Absturz, der wie
   ein Fund aussieht und ein Aufbaufehler ist.

### Der Fehler, den dieser Prüfstand an sich selbst gefunden hat

Zwei Fassungen des Wartens waren **still grün**: eine zeichnete nur
`feedback_themes` auf, eine gar nichts (`[]` — `every` auf der leeren Menge ist
wahr). Ursache ist eine gemessene Lücke von rund 295 ms zwischen der Hülle und
der Seite, weil die Seiten seit AGE-642 `lazy()` sind:

    /            statisch   alles da nach   34 ms, keine Lücke
    /aktivitaet  lazy       Hülle bei 15 ms, Seite erst bei 311 ms
    /events      lazy       Hülle bei  8 ms, Seite erst bei 310 ms

In dieser Lücke ist der Cache unverändert und nichts wird geladen — der Baum
sieht FERTIG aus und ist leer. Das Ruhefenster überbrückt sie mit Reserve, aber
die Sicherheit liegt **nicht** dort: sie liegt in den dauerhaften
Positivkontrollen. Gegenprobe gefahren — Fenster auf 10 ms gesetzt, Wächter rot;
zurück auf 450 ms, grün. Ein zu kurzes Fenster wird laut, nicht still.

## Risks / Trade-offs

**[Das Montieren erreicht weniger als ein direkter Aufruf.]** Eine Route zu
montieren löst nur aus, was beim Rendern läuft — nicht, was an einem Klick oder
hinter einer Entprellung hängt. → Die Grenze wird in der Spec und im Prüfstand
benannt, und die interaktionsgebundenen Fälle bleiben als eigene Zusagen in
`anon-anreicherung.test.ts` stehen, statt ersatzlos zu verschwinden.

**[Ein montierender Test ist langsamer und flakiger als vier Funktionsaufrufe.]**
jsdom, `lazy()`, `Suspense`, React Query. → `findBy…` statt `getBy…`, keine
Zeitschranken, und die Fläche ist mit rund zehn Routen klein. Der bestehende
Lauf liegt bei ~1 s; ein Vielfaches davon bleibt vertretbar.

**[Die Randzusage über `App.tsx` kann bei jeder neuen Route rot werden.]** Das
ist der Zweck, aber es ist auch eine Steuer — dieselbe Familie wie der
Golden-Snapshot in `grants_test.sql`. → Die Meldung sagt, was zu tun ist:
Route hinter eine Wache stellen **oder** namentlich in die Liste aufnehmen. Rot
heißt hier „entscheide", nicht „pflege nach".

**[Die Positivlisten sind eine Abschrift und können auseinanderlaufen.]** Ändert
jemand die Grants, ohne die Liste zu bewegen, ist die Prüfung still falsch. →
`grants_test.sql` hält den echten Zustand fest und wird rot, wenn sich die
Grants bewegen. Der Kommentar über den Listen sagt ausdrücklich, welche der
beiden Prüfungen die Aussage trägt.

**[`AppShell` unter den Wächter zu nehmen, löst einen Bestandsfund aus.]** Er ist
eingetreten — `FeedbackButton`, siehe oben — und war in der ersten Fassung dieses
Designs als „nicht zu erwarten" abgetan. → Behoben in diesem Change, eine Zeile,
von Donald so entschieden. Ein zweiter Fund derselben Art wird **nicht** im
Vorbeigehen mitrepariert, sondern als eigener Punkt aufgenommen; die Entscheidung
oben gilt diesem einen Fall.

**[Die Rüstung könnte an einem fehlenden Provider scheitern statt an einem
Befund.]** Ein rotes `render()` sieht aus wie ein Fund, ist aber ein Aufbaufehler.
→ Die Rüstung wird aus `App.test.tsx` übernommen, und die dauerhaften
Positivkontrollen aus D7 unterscheiden „nichts gefragt" von „nichts gelaufen".

## Migration Plan

Keine Datenbankarbeit. Ausgeliefert wird eine `enabled`-Zeile, die einen Request
unterdrückt, der ausgeloggt ohnehin mit 401 endet; sie kann keinen Zustand
hinterlassen. Die Rücknahme ist das Zurücknehmen des Commits.

## Open Questions

- **Wie viel der Fläche montiert der Prüfstand einzeln?** Eine Route je `it` ist
  lesbar und teuer; alle in einem `it` ist schnell und nennt bei Rot nicht die
  Route. Vorschlag: `it.each` über die abgeleitete Liste — ein Fall je Route,
  aber ohne Handarbeit. Wird in der Umsetzung entschieden, nicht hier.
- **Zählt `/styleguide` zur Fläche?** Die Route existiert nur unter
  `import.meta.env.DEV`. Vorschlag: nein, mit einer Zeile Begründung im
  Prüfstand — sie ist im Produktionsbündel nicht vorhanden. Die Review hat das
  als unausgesprochene Annahme benannt (codex); sie wird damit ausgesprochen.
- **Gehört die Anforderung noch unter `directory-search`?** Sie regelt nach
  diesem Change Feed, Events, Anmeldung, Hülle und Funktionsaufrufe — codex
  schlägt `access-control` vor (LOW). Der Umzug ist ein `REMOVED` plus `ADDED`
  über zwei Capabilities hinweg und damit genau die Archiv-Mechanik, an der
  AGE-598 Zeit verloren hat. Vorschlag: **nicht in diesem Change**, sondern als
  eigener, rein ordnender Vorgang, falls Donald ihn will. Die Anforderung bleibt
  hier, wo ihre Geschichte und alle Verweise auf sie liegen.
