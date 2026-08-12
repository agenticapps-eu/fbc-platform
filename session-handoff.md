# Session Handoff — 2026-08-12 (C7 / AGE-528, Sitzung 4 — ausgerollt)

## Accomplished

**C7 ist live.** PR #159 gemerged (`df37349`), Migrationen auf DEV **und** PROD,
Frontend ausgeliefert, Change archiviert, Linear auf Done. Alle 76 Tasks
abgehakt. Offen ist nur noch der **Merge von PR #160** (Belege + Archiv, kein
Produktcode).

- **9.7 QA-Gate** im Browser gegen den lokalen Stack: **98/100**, kein
  kritischer/hoher/mittlerer Befund, deshalb kein Diff. Dabei zum ersten Mal
  gemessen, was jsdom nicht kann: Task 8.4 (auf 375 px steht die Filterleiste
  vor dem Feed, 936 vs. 1246 px) und der **ganze Schreibweg aus einem echten
  Browser** — zwei PNG → client-seitig WebP → hochgeladen → RPC 200 → im Feed,
  `hashtags` je genau einmal trotz getippt **und** geklickt.
- **9.3 vollständig**: gegen DEV sechs von sechs ausgeloggt (rohe URL 400,
  `members` nicht im Feed, Signatur für `members` **abgelehnt**, `public`
  signiert und geholt), die gerenderte Zeile danach am echten System
  (Bild 615×615 aus einer **signierten** URL).
- **10.4/10.5**: `migrate-prod` Lauf 31605508737, Dry-Run **gelesen**, danach
  „OK — 60 Migrationen, Historie abweichungsfrei". PROD nachgemessen,
  **zwölf von zwölf** (`scripts/mess-10-5-prod.ts`, nur lesend).
- **Zwei neue Issues**, beide entschieden und umsetzungsreif: **AGE-529**
  (Overlay-Hygiene) und **AGE-530** (ausgeloggter 401 im Feed) — siehe unten.

## Decisions

- **QA-Befunde nicht in den PR.** Die fehlende Scroll-Sperre ist keine Lücke der
  Lightbox, sondern des Repos — *kein* Dialog sperrt (AvatarCropper,
  FeedbackButton, DesignSwitcher). Eine nur hier wäre die Ausnahme statt der
  Regel. → AGE-529.
- **9.3 aufgeteilt**, weil es nicht anders ging: bis `migrate-prod` lief, blockte
  `drift-gate` den Deploy, auf `pages.dev` stand das alte Frontend. Also die
  scharfe API-Hälfte **vor** PROD, die gerenderte Zeile **danach**.
- **Testdaten auf DEV: anlegen, messen, restlos abbauen** — DEV bedient die
  Live-Seite. Der Abbau wird **nachgezählt**, und nach dem letzten Lauf
  zusätzlich von außen gegengeprüft.
- **Sonden müssen rot werden können.** Vor dem DEV-Lauf lokal mutiert
  (`p_visibility` fest auf `public`) — genau die zwei `members`-Zeilen fielen.

## Files modified

- `scripts/probe-9-3-sichtbarkeit.ts` — neu; der Sichtbarkeits-Beweis gegen das
  echte Schema. `--dev=<ref>` gegen `dev-project-ref.txt`; `--behalten` /
  `--abbauen=<uid>` für die eine Zeile, die ein Auge braucht.
- `scripts/mess-10-5-prod.ts` — neu; PROD nachmessen, ausschließlich SELECTs
  (`default_transaction_read_only`), `--prod=<ref>` gegen `prod-project-ref.txt`.
- `openspec/specs/community-feed/spec.md` — **+11 Requirements** (5 → 16).
- `openspec/changes/archive/2026-08-12-activity-media-and-tags/` — archiviert,
  mit EVIDENCE (9.7, 9.3, 10.4/10.5 und der Korrektur zu AGE-530).
- `.gstack/qa-reports/qa-report-aktivitaet-2026-08-12.md` — QA-Bericht
  (gitignored, liegt nur lokal).

## Next session: start here

**PR #160 mergen** — Stand 2026-08-12 `mergeState=CLEAN`, alle vier Pflichtchecks
(`verify`, `migrations`, `pr-title`, `edge-functions`) grün auf `fc214ae`. **Nicht
vorher auf den Branch pushen**: jeder Push startet CI neu und blockt den Merge
erneut (genau so ist der erste Versuch gescheitert). Der Merge selbst wird vom
Klassifikator geblockt, also `! gh pr merge 160 --squash` selbst tippen und
danach mit `gh pr view 160 --json state` prüfen — `gh pr merge` kann still
fehlschlagen. Der PR trägt **keinen Produktcode**, nur die zwei Sonden, das
Archiv und die +11 Requirements; nach dem Merge ist an C7 nichts mehr offen.

**Diese Übergabe ist absichtlich nicht committet** — ein Push auf den Branch von
#160 hätte den Merge wieder blockiert. Nach dem Merge mit einem eigenen Commit
nachziehen.

Danach inhaltlich: **AGE-529** ist der größere Griff (gemeinsamer Hook, vier
Overlays, Fokus-Falle, Feedback-Knopf), **AGE-530** der kleinere und schnellere
(ausgeloggt gar nicht anreichern). Beide sind entschieden und brauchen keine
Rückfrage — der Zuschnitt steht unten und ausführlich in den Issues.

## Nach dem Ausrollen entschieden (2026-08-12, Donald)

Beide Folge-Issues sind **umsetzungsreif** — der Zuschnitt steht in der
Beschreibung, es ist nichts mehr zu klären:

- **AGE-530** (mittel, war zuerst falsch gerahmt): Namen bleiben für
  Nicht-Mitglieder **unsichtbar** — das fehlende `anon`-Recht ist Absicht und
  steht so in `App.tsx:110` und `feed.ts:287`. **Kein Grant.** Es bleibt nur:
  der Feed fragt ausgeloggt trotzdem ab und kassiert je Seitenaufruf einen 401.
  Ohne Session gar nicht anreichern, damit „Ein Mitglied" eine ausgesprochene
  Regel ist und nicht das Nebenprodukt eines Fehlschlags.
- **AGE-529** (mittel, Zuschnitt gewachsen): **ein** `useScrollLock()` in
  `src/components/ui/` für **alle vier** Overlays, in der **robusten**
  iOS-Variante (`position: fixed` + `top: -scrollY`, Scroll-Position exakt
  wiederherstellen — eine halbe Umsetzung springt beim Schließen nach oben und
  ist schlechter als heute), mit **Zählung statt Schalter** für gleichzeitig
  offene Overlays, plus **Fokus-Falle** (alle vier behaupten `aria-modal`, keines
  hält den Fokus). Der Feedback-Knopf **schwebt unter `sm` nicht mehr**.
  Eine Abnahmezeile kann ich nicht selbst erfüllen: die Sichtprobe auf einem
  echten iPhone.

## Open questions

**Keine offenen Punkte mehr zu C7.** Die 15 kuratierten Tags in PROD sind von
Donald am 2026-08-12 ausdrücklich abgenommen — die Abstimmung mit Detlev, die
das Issue vorsah, ist damit erledigt und **nicht erneut vorzuschlagen**. Wer die
Liste später ändern will: ein Insert bzw. `active = false`, keine Migration.

- Aus früheren Sitzungen offen: dunkles Theme färbt die Schale, nicht die Karten
  (heute bestätigt) · `file_size_limit` für den `avatars`-Bucket fehlt weiterhin
  · zwei Gestaltungsfragen aus 9.6 (3+1-Raster bei vier Kacheln,
  Chip-Schreibweise) liegen bei Donald.
- Lokal liegen ein QA-Konto (`qa-c7@example.test`) und ein Testbeitrag im
  **lokalen** Stack; `supabase db reset --local` räumt beides ab.
