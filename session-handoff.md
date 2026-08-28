# Session Handoff — 2026-08-29 (nachts, main entblockt · Glocke live · Marke vermessen)

**Worktree:** `fbc-platform.donald-age-642-capacitor-huelle`, Branch
`donald/age-642-capacitor-huelle`. Baum **sauber**, alles **gepusht**, Branch
**5 Commits hinter `origin/main`** (die eigenen sind dort schon drin).
`openspec validate --all` 30/30, 2247 Tests in 202 Dateien grün, `tsc` sauber.

**`main` ist entblockt und deployt wieder.** Das war der Anlass der Nacht und
ist erledigt — nichts davon ist nachzuholen.

## Accomplished

### 1. Der Deploy auf `main` stand seit dem Nachmittag still

Gemeldet von der Nachbarsitzung `fbc-platform-f4`, hier nachgemessen: die
Migration `20260828200000` lag auf **DEV** und auf keinem Branch, der nach
`main` zeigt. `migrate-dev` fiel deshalb aus, und mit
`deploy: needs: [migrate-dev, drift-gate]` wurde **jeder** Deploy übersprungen.

`repair --status reverted` fiel aus — die Migration ist echt, angewandt und am
Gerät belegt. Der Weg war der kleine PR, ausdrücklich so entschieden:

| Schritt | Beleg |
| --- | --- |
| **#285** (Migration + pgTAP), gemergt | `c61a48d` |
| `migrate-prod` dispatcht, **von Donald je Fall freigegeben** | Lauf 33211112563, `plan` + `apply` grün |
| `rerun --failed` auf demselben Commit | `migrate-dev` · `drift-gate` · `deploy` · `functions` alle `success` |

Die Nachbarsitzung hatte die zweite Stufe **vorhergesagt**: `drift-gate` misst
gegen das Projekt der Infisical-Umgebung `prod` (seit dem 24.08. PROD), nicht
gegen DEV. Nach dem Merge war die Migration auf `main` und fehlte PROD — genau
der Fall, den das Gate rot macht. Ohne diesen Hinweis hätte ich den Merge für
die ganze Lösung gehalten.

### 2. Der Wächter sagte das Gegenteil der Migration

`hinweistypen_test.sql` (in `ci.yml:209`) verlangte weiter „die zweite
Nachricht erzeugt keine zweite ungelesene Zeile". Auf `main` fiel es nicht auf,
auf diesem Branch war die CI seit `7a2d923` **rot, ohne dass es jemand gemessen
hatte** — der letzte grüne Lauf dort war von 16:12, die Migration kam um 19:32.

Gemessen: RED `have 2, want 1` · GREEN 41/41 · **Gegenprobe mit wieder
eingespielter ALTER Triggerfassung** `have 1, want 2`. Die Gegenprobe ist der
Teil, der zählt.

### 3. Die Glocke fasst je Gespräch zusammen — **live**

PR **#286**, gemergt (`359f349`). Die Anzeige-Hälfte der Entscheidung vom
28.08.; ohne sie trüge die Glocke ab dem `migrate-prod` einen Eintrag je
Nachricht.

- **Zwei Abfragen, nicht eine.** Die Grenze greift VOR dem Eindampfen — sonst
  drängt ein Faden mit fünfzig ungelesenen Nachrichten eine Kontaktanfrage von
  gestern aus der Liste. Übrige Typen bis 50, Nachrichten bis 200, dann je
  `thread_id` auf die neueste.
- `markiereHinweisGelesen` nimmt den **Hinweis** statt der Kennung und markiert
  alle ungelesenen Zeilen des Fadens. Ohne das erscheint der Eintrag sofort
  wieder.
- `or("type.neq.message,type.is.null")` — die Spalte ist nullable, und
  `null <> 'message'` ist in SQL nicht wahr.

### 4. Die Marke ist VERMESSEN, nicht geschätzt

`docs/marke-neu/marke-allein.jpeg`, 1254², PNG von Hand dekodiert (kein Pillow
auf dieser Maschine; das Skript liegt im Scratchpad und ist wegwerfbar):

| | gemessen |
| --- | --- |
| Mitte / Radius | (626,626) · Hauptstrahlen N 181 · S 174 · W 175 · O 176 → **R ≈ 177** |
| Hauptstrahl | halbe Breite fällt **linear** 22,5 → 2,5 zwischen 0,2R und 0,9R → **gerade Flanken**, Nabe **0,159 R** |
| Nebenstrahl | auf der 45°-Achse weiß von **0,273 R bis 0,568 R**, halbe Breite max ≈ **0,048 R** kurz hinter dem Anfang |

**Der Befund, der Arbeit spart: die Hauptstrahlen ändern sich praktisch nicht.**
Das heutige Favicon hat eine Nabe von 3,4 bei R 22 = 0,155 R gegen gemessene
0,159 R. „Schlank, leicht konkav" aus der letzten Übergabe hält der Messung
**nicht** stand — die Flanken sind gerade. Neu sind nur **Ring weg** und **vier
Nebenstrahlen**.

## Decisions

- **Kleiner PR statt #277** für die Migration, und danach noch einmal für die
  Glocke. #277 (78 Dateien, zwei Changes) bleibt Entwurf und behält seine
  offene Frage.
- **`migrate-prod` sofort nach dem Merge**, gegen die Alternative „erst die
  Glocke bauen". Preis war ausdrücklich: bis #286 live ist, ein Glockeneintrag
  je Nachricht. Der Preis lief rund eine Stunde.
- **Akzentpunkte der Wortmarke BLEIBEN** und **„YOUR NEXT OPPORTUNITY" kommt
  NICHT mit** (Donald, 28.08.). Beide Antworten weichen von den WhatsApp-
  Vorlagen ab — ein späterer Vergleich „Vorlage vs. Repo" sieht deshalb nach
  einem Fehler aus und ist keiner. Steht als Memory.
- **Die Nebenstrahlen kommen in DENSELBEN `<path>`** wie die Hauptstrahlen,
  als weitere Teilzüge. Dann bleibt `pfade.length === 1`, und an `leseMarke()`
  muss nur die **Ring**-Erwartung fallen, nicht die Pfad-Zählung.

## Files modified

- `src/lib/hinweise.ts` + `.test.ts` — zwei Abfragen, Eindampfen je Faden,
  `markiereHinweisGelesen(h)` markiert den ganzen Faden
- `src/components/hinweise/use-hinweise.ts`, `HinweisGlocke.tsx` + `.test.tsx`
  — der Hinweis statt der Kennung
- `supabase/tests/hinweistypen_test.sql` — Abschnitt 9b umgedreht
- `openspec/changes/push-fundament/specs/notifications/spec.md` — neue
  Anforderung „Jede Nachricht erhebt ihren eigenen Hinweis, die Glocke fasst
  zusammen", vier Szenarien
- `openspec/changes/push-fundament/tasks.md` — B-Anzeige neu; zwei belegte
  Phase-B-Haken gesetzt, die unbelegten getrennt stehen gelassen

## Next session: start here

**Die neue Marke, und zwar beim SVG.** Alles dafür steht oben; nicht neu
messen. Reihenfolge:

1. `public/brand/compass-favicon.svg` neu: **kein `<circle>`**, ein `<path>`
   mit fünf Teilzügen (Hauptstern wie heute + vier Nebenstrahlen). Bei
   viewBox 48 und R 22: Nebenstrahl-Basis bei r ≈ 6,4, Spitze bei r ≈ 12,5,
   halbe Breite ≈ 1,05.
2. **Gerendert neben die Vorlage legen und Donald zeigen**, bevor irgendetwas
   erzeugt wird — grüne Tests belegen keine Form.
3. `CompassMark.tsx` und `docs/design-system.html` nachziehen (drei Stellen,
   sonst tragen Tab und App verschiedene Logos).
4. `leseMarke()` in `scripts/app-icons.logic.ts:72` samt Tests: die
   `<circle>`-Erwartung fällt, das Zeichnen des Rings auch.
5. `pnpm app:icons` **und** `pnpm splash`. Beleg ans **gebaute** Artefakt
   (mittlere Farbe, `Assets.car`), nicht an die Vorlage im Arbeitsbaum.
6. **Erst danach** der Startbildschirm-Fehler — die Fläche wird ohnehin neu
   erzeugt, sonst wird zweimal dasselbe gesucht.

## Open questions

- **Der lokale Stack ist verstellt.** `hinweis_neue_nachricht()` trägt dort die
  neue Fassung, `schema_migrations` steht aber auf `20260828180000` — per psql
  eingespielt, nicht per `db push`. Ein `db reset` bringt es gerade.
- **CI ist flaky, zweimal in fünfzehn Minuten.** `PublicProfilePage.test.tsx`
  (auf `main`, `c61a48d`) und `use-gespraech.test.tsx` (auf #286), beide im
  Nachlauf grün. Signatur von `lokal-gruen-ci-rot-zwei-ursachen`, Ursache 1.
  Niemand hat sie bisher als eigenen Vorgang notiert.
- **Zwei Changes auf einem Branch** (#277) — unverändert offen, jetzt kleiner:
  Migration, pgTAP und Glocke sind heraus und auf `main`.
- **Startbildschirm erscheint nicht** — Verdacht Nummer eins bleiben die von
  Hand geschriebenen Constraints; Zwischenspeicher des Launch Screens ist die
  zweite Spur. Erst die Marke.
- **Tote Gerätetokens** (`zugestellt: 2` aus der deinstallierten App) —
  verschwinden nie von selbst, steht jetzt als Aufgabe.
- Unverändert: B3 (Signaturmaterial), C2, C3, Phase D, E · Bearer im
  Funktionsrumpf per `pg_get_functiondef()` lesbar · Abschnitt 4 mit Detlev ·
  AGE-655 · AGE-653 · AGE-610 · AGE-512 · AGE-598 · AGE-256 · AGE-606 ·
  AGE-628/629/630.
