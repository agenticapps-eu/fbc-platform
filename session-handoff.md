# Session Handoff — 2026-08-17 (dritte Sitzung)

**AGE-566 ist gemerged (PR #187) und live. Die Demo-Welt ist bespielt und im
Browser abgenommen.** Offen sind eine Entscheidung und zwei Nachträge.

## Next session: start here

**PR #188** (Plan für den PROD-Neuaufbau) wartet auf Merge. Vorher aber die
Entscheidung aus Schritt 0 des Plans treffen — sie hängt an allem anderen:

**Welches Supabase-Projekt ist am Ende PROD?** Gemessen am 17.08.:
`fbc-platform.pages.dev` liest `foelowldexkcqzewvrcf` („DEV", trägt die
Demo-Welt), die 71 importierten Mitglieder liegen auf `viwntbodrtqxgmqyxluh`
(„PROD", sonst leer). Solange `VITE_SUPABASE_URL` auch in Infisical `prod` auf
DEV zeigt, ändert ein Neuaufbau von PROD nichts an dem, was jemand im Browser
sieht.

Und: **auf PROD fehlt `20260817140000`** (letzte dort: `20260817120000`). Auf
DEV liegt sie seit dem `migrate-dev`-Lauf von heute.

## Accomplished

**Diff-Review (Aufgabe 6.4) und sechs Befunde.** gemini APPROVE ohne Befund,
codex REQUEST-CHANGES mit vier — alle vier nachgeprüft und zutreffend, zwei
gemessen (Wettlauf: zwei Auditzeilen für eine Aktivierung; `p_limit = null`: 74
statt 50 Zeilen). Dazu zwei eigene: fehlende Entprellung, und
`admin_member_list_test.sql` stand **nicht in der CI-Liste** — die 45
Assertions waren dort nie gelaufen. Alle sechs behoben, Belege in
`openspec/changes/add-admin-member-list/REVIEWS.md`.

**Demo-Welt aufgefrischt und erweitert.** Vorher gemessen: jüngster Beitrag 26
Tage alt, **kein Event in der Zukunft**. Ursache war `on conflict do nothing`
bei relativen Zeitpunkten — der Seed konnte sich nicht auffrischen. Jetzt `do
update`; ein erneuter `pnpm demo:seed` rückt die Welt ans heutige Datum. Plus
neun Beiträge, vier Termine, 8 Academy-Videos (oEmbed-geprüft), 8 Titelbilder,
11 Kommentare.

**Feed: die letzten zwei Kommentare stehen offen**, „N weitere" holt den Rest.

## Decisions

- **Zweite Migration statt Korrektur in der ersten** — `20260817120000` lag
  schon auf beiden Datenbanken.
- **Sidebar-Regel abgeleitet statt als Flagge** — eine Flagge vergisst der
  Aufrufer beim nächsten Unterpfad, und der Test prüfte dann nur seine Fixture.
- **Event-Zeiten am Tagesbeginn in Europe/Berlin**, nicht `now() + interval` —
  Letzteres ergab ein Frühstück um 21:46.
- **Titelbilder aus `public/images/`**, kein neuer Fremdabruf: Lizenz und
  Herkunft sind dort geklärt, und sie sind schon webp (der einzige erlaubte Typ).

## Files modified

- `supabase/migrations/20260817140000_admin_member_list_fixes.sql` — neu
- `supabase/tests/admin_member_list_test.sql` — Abschnitt 11, plan(45)
- `.github/workflows/ci.yml` — die pgTAP-Datei eingetragen
- `src/pages/AdminMitgliederPage.tsx`, `src/components/ui/SidebarNav.tsx`
- `src/components/community/CommunityFeed.tsx` (+ `.comments.test.tsx`)
- `supabase/seed/demo_seed.ts`, `supabase/seed/demo_event_covers.ts` (neu)
- `docs/prod-neuaufbau-plan.md` (neu, PR #188)

## Wie es belegt ist

Rot vor grün für jede Korrektur. 866 Vitest, 485 pgTAP, typecheck und lint
sauber. Im Browser gemessen: vier Tastendrücke → eine Anfrage; genau ein aktiver
Leisteneintrag; 8 Event-Titelbilder geladen (naturalWidth 1600); „2 weitere
Kommentare anzeigen" klappt 11 → 13 auf. Live-Bundle `index-GbUtLmtS.js` trägt
beide neuen Zeichenketten.

**Nie `pnpm format`** — es schreibt ~128 fremde Dateien um.

## Open questions

- **Ausgeloggt zeigt `/events` „Kommende (0)".** Alle acht Termine sind
  `members`-sichtbar. Für die Vorführung heisst das: **anmelden**
  (`prime@fbcdemo.com` / `Test1234!`, siehe `docs/demo-zugang.md`).
- „**1 Plätze frei**" auf der Event-Karte — Pluralfehler, sichtbar in der Demo,
  eine Zeile Arbeit. Nicht angefasst (ausserhalb von AGE-566).
- Die leere Folgeseite der Admin-Liste ist nur in jsdom geprüft, nicht im
  Browser.
- Unverändert: Bericht an Detlev · Rücknahmeliste vor Go-Live · Secrets vom
  16.08. rotieren · AGE-497 · AGE-541 · AGE-258 · AGE-522 · AGE-512 · AGE-561 ·
  eigenes Issue für `send-activation` (2xx trotz Resend-401).
