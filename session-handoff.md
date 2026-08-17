# Session Handoff — 2026-08-17 (dritte Sitzung)

**AGE-566 ist gemerged (PR #187) und live.** Die Demo-Welt auf
`fbc-platform.pages.dev` ist bespielt und im Browser abgenommen. **Aber die
falsche Fläche** — siehe unten.

## Next session: start here

**Donalds Korrektur vom 17.08., und sie kehrt meine Benennung um:**

- `foelowldexkcqzewvrcf` ist die **PROD-UI** (`fbc-platform.pages.dev`). Was ich
  dort angereichert habe, **kann so stehenbleiben**.
- Daneben gibt es eine **DEV-UI**, die gegen `viwntbodrtqxgmqyxluh` läuft — die
  Datenbank mit den **71 importierten Mitgliedern**. **Die** sollte angereichert
  werden.

**Die Aufgabe:** einen Seed bauen wie `supabase/seed/demo_seed.ts`, aber
**mit den echten importierten Mitgliedern** als Autoren/Gastgebern, samt allen
Änderungen dieser Sitzung (aufgefrischte Zeitpunkte, Titelbilder,
Academy-Videos, Kommentarfäden). **Wird vor dem Go-Live geleert** — das ist
Donalds ausdrückliche Ansage, der Bestand dort ist also Wegwerfware.

**Erster Schritt der nächsten Sitzung:** die DEV-UI finden und belegen, gegen
welche Datenbank sie liest (so wie es für die PROD-UI gemacht wurde: Bundle
laden, `https://<ref>.supabase.co` herausgreifen). `.github/workflows/deploy.yml`
kennt nur ein Ziel; die zweite Fläche muss woanders herkommen — Cloudflare-Pages-
Preview, eigenes Pages-Projekt oder lokal. **Nicht raten, messen.**

Danach zu klären, bevor Inhalte entstehen:

1. **Nur 2 von 71 Profilen sind aktiviert.** Ohne `activated_at` erscheint ein
   Mitglied in keinem Verzeichnis (`has_level(3)` UND `activated_at is not
   null`). Für eine gefüllte Fläche müssen die meisten aktiviert werden — ein
   paar sollten unbestätigt bleiben, sonst zeigt die Admin-Mitgliederliste
   ausgerechnet ihren Anlassfall nicht mehr.
2. **Inhalte werden echten, namentlich genannten Menschen zugeschrieben.** Der
   bestehende Demo-Seed legt seinen Personas Sätze wie „wir suchen Co-Investoren
   für die Series A" in den Mund. Bei echten Mitgliedern gehört das neutral
   gehalten — keine Finanz-, Rechts- oder Gesundheitsaussagen im Namen einer
   realen Person.

## Accomplished

**Diff-Review (Aufgabe 6.4), sechs Befunde, alle behoben.** gemini APPROVE ohne
Befund, codex REQUEST-CHANGES mit vier — alle nachgeprüft und zutreffend, zwei
gemessen (Wettlauf: **zwei Auditzeilen für eine Aktivierung**; `p_limit = null`:
**74 statt 50 Zeilen**). Dazu zwei eigene: fehlende Entprellung im Suchfeld, und
`admin_member_list_test.sql` stand **nicht in der CI-Liste** — die 45 Assertions
waren dort nie gelaufen. Belege in
`openspec/changes/add-admin-member-list/REVIEWS.md`.

**Demo-Welt auf der PROD-UI aufgefrischt.** Vorher: jüngster Beitrag 26 Tage
alt, **kein Event in der Zukunft**. Ursache war `on conflict do nothing` bei
relativen Zeitpunkten — der Seed konnte sich nicht auffrischen. Jetzt `do
update`. Plus 9 Beiträge, 4 Termine, 8 Academy-Videos (oEmbed-geprüft), 8
Titelbilder, 11 Kommentare.

**Feed: die letzten zwei Kommentare stehen offen**, „N weitere" holt den Rest.
Gebaut, getestet, gemerged, deployt, live gegengeprüft.

## Decisions

- **Zweite Migration statt Korrektur in der ersten** — `20260817120000` lag
  schon auf beiden Datenbanken.
- **Sidebar-Regel abgeleitet statt als Flagge** — eine Flagge vergisst der
  Aufrufer beim nächsten Unterpfad.
- **Event-Zeiten am Tagesbeginn in Europe/Berlin** — `now() + interval '9 hours'`
  ergab ein Frühstück um 21:46.
- **Titelbilder aus `public/images/`** — Lizenz geklärt, schon webp.

## Files modified

- `supabase/migrations/20260817140000_admin_member_list_fixes.sql` — neu
- `supabase/tests/admin_member_list_test.sql` — Abschnitt 11, plan(45)
- `.github/workflows/ci.yml` — die pgTAP-Datei eingetragen
- `src/pages/AdminMitgliederPage.tsx`, `src/components/ui/SidebarNav.tsx`
- `src/components/community/CommunityFeed.tsx` (+ `.comments.test.tsx`)
- `supabase/seed/demo_seed.ts`, `supabase/seed/demo_event_covers.ts` (neu)
- `docs/prod-neuaufbau-plan.md` (neu, **PR #188 — offen**)

## Wie es belegt ist

Rot vor grün für jede Korrektur. 866 Vitest, 485 pgTAP, typecheck und lint
sauber. Im Browser gemessen: vier Tastendrücke → eine Anfrage; genau ein aktiver
Leisteneintrag; 8 Titelbilder geladen; „2 weitere Kommentare anzeigen" klappt
11 → 13 auf. Live-Bundle `index-GbUtLmtS.js` trägt beide neuen Zeichenketten.

**Nie `pnpm format`** — schreibt ~128 fremde Dateien um.

## Open questions

- **`docs/prod-neuaufbau-plan.md` benennt die Projekte nach Repo-Konvention
  („DEV" = `foelowldexkcqzewvrcf`), Donald nennt dieselbe Fläche PROD-UI.** Die
  gemessenen Fakten im Plan stimmen, die Etiketten verwirren. Vor dem Merge von
  PR #188 angleichen.
- **Auf `viwntbodrtqxgmqyxluh` fehlt `20260817140000`** (letzte dort:
  `20260817120000`). Auf `foelowldexkcqzewvrcf` liegt sie seit dem
  `migrate-dev`-Lauf von heute.
- **Ausgeloggt zeigt `/events` „Kommende (0)"** — alle Termine sind
  `members`-sichtbar. Vorführen nur angemeldet (`prime@fbcdemo.com` /
  `Test1234!`, `docs/demo-zugang.md`).
- „**1 Plätze frei**" auf der Event-Karte — Pluralfehler, eine Zeile, nicht
  angefasst (ausserhalb AGE-566).
- Die leere Folgeseite der Admin-Liste ist nur in jsdom geprüft, nicht im
  Browser.
- Unverändert: Bericht an Detlev · Rücknahmeliste vor Go-Live · Secrets vom
  16.08. rotieren · AGE-497 · AGE-541 · AGE-258 · AGE-522 · AGE-512 · AGE-561 ·
  eigenes Issue für `send-activation` (2xx trotz Resend-401).
