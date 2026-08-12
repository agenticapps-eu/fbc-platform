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
- **Zwei neue Issues**: **AGE-529** (niedrig, Overlay-Hygiene) und **AGE-530**
  (hoch, siehe unten).

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

**PR #160 mergen**, sobald die Checks grün sind (`gh pr checks 160`; der Merge
selbst wird vom Klassifikator geblockt, also `! gh pr merge 160 --squash` selbst
tippen — danach mit `gh pr view 160 --json state` prüfen, `gh pr merge` kann
still fehlschlagen). Der PR trägt **keinen Produktcode**, nur die zwei Sonden,
das Archiv und die +11 Requirements; nach dem Merge ist an C7 nichts mehr offen.

Danach inhaltlich: **AGE-530** ist der wertvollste nächste Griff — auf der
öffentlichen Seite heißt heute *jeder* Autor „Ein Mitglied", weil `anon` kein
SELECT auf `profiles_public` hat (401, `42501`, auf **beiden** Instanzen). Vor
dem `grant select` steht eine Produktfrage, keine technische.

## Open questions

- **Die 15 kuratierten Tags sind seit heute in PROD, ohne Detlevs Abstimmung.**
  Stand ausdrücklich so im Issue („Die Startbefüllung stimmt Donald mit Detlev
  ab") und ist nicht passiert. Korrektur ist ein Insert bzw. `active = false`,
  keine Migration — aber sie steht jetzt live.
- **AGE-530** (hoch): Sollen Namen öffentlicher Beiträge für Nicht-Mitglieder
  sichtbar sein? Achtung: `profiles_public` läuft mit `security_invoker=off`,
  ein Grant öffnet die View für alle Zeilen, die ihr Prädikat durchlässt.
- **AGE-529** (niedrig): Scroll-Sperre für alle vier Dialoge; Feedback-Knopf
  über der Kachel „Frage" auf 375 px.
- Aus früheren Sitzungen offen: dunkles Theme färbt die Schale, nicht die Karten
  (heute bestätigt) · `file_size_limit` für den `avatars`-Bucket fehlt weiterhin
  · zwei Gestaltungsfragen aus 9.6 (3+1-Raster bei vier Kacheln,
  Chip-Schreibweise) liegen bei Donald.
- Lokal liegen ein QA-Konto (`qa-c7@example.test`) und ein Testbeitrag im
  **lokalen** Stack; `supabase db reset --local` räumt beides ab.
