# Coding-Agent-Prompt — FBC Sommerfest-MVP: 6-Level, Nav-Umbau, zwei Design-Varianten

> Paste-fertig für Claude Code / Codex im Repo `fbc-platform`. Arbeite gemäß `CLAUDE.md` (Think first, Simplicity, Surgical). Bei Unklarheit oder Widerspruch: **stoppen und Donald fragen**, nicht raten.

## Kontext & Ziel
Wir bereiten das **FBC-Sommerfest** vor: ein bewusster MVP, der Mitgliedern zeigt, „wohin die Reise geht". Zu bauen: (A) das bestätigte 6-Level-Modell + Nav-Umbau (das echte, funktionierende Produkt), (B) die FBC-Design-Variante, und als **letzter Schritt** (C) ein eff.bee.zee-Vision-Teaser als voller Klick-Dummy. Stripe bleibt **Test-Mode**.

## Verbindliche Specs (zuerst lesen)
- `docs/superpowers/specs/2026-07-15-fbc-6level-upgrade.md` — Stufenmodell (basic/connect/discover/exchange/focus/impact), **bestätigte** Rechte-Matrix, Key-Migration (Namens-Kollision!), Stripe-Test-Mode-Upgrade-Flow, QM-Feedback.
- `docs/superpowers/specs/2026-07-15-fbc-navigation-ia-mvp.md` — gleiche Nav für alle (Rechte gaten), Community-Split (→ Mitglieder + Aktivität), Biete&Suche → Compass, Matching → „Meine Chancen", Startseite → Dashboard, Mein Profil vereinfachen.

## Design-Referenzbilder (im Repo)
Zwei Mockups liegen im Repo. **Öffne beide, bevor du die Varianten baust:**
- `docs/design-mocks/sommerfest.jpeg` — FBC, Krone, Navy&Gold, ruhiges Dashboard → Referenz für Variante **`sommerfest`**.
- `docs/design-mocks/linkedin.jpeg` — eff.bee.zee, Kompass-Logo, dunkle Sidebar, blauer Akzent, „Active"/ActivePoints → Referenz für Variante **`linkedin`**.

---

## A. Modell + Nav (das echte Produkt) — zuerst
Setze das 6-Level-Modell, die Rechte (RLS), den Nav-Umbau, den Stripe-Test-Mode-Upgrade-Flow und das QM-Feedback **exakt nach den beiden Specs** um. Reihenfolge steht dort. **Keine Dummies hier** — das ist das Produkt, in dem sich Mitglieder anmelden und (Test-)upgraden.

## B. Design-Variante `sommerfest` (FBC, echt) — im bestehenden Switcher
**Muster:** Varianten sind Token-Layer in `src/config/designVariants.ts` + `[data-variant]`-Blöcke in `src/index.css`; der `DesignSwitcher` iteriert `DESIGN_VARIANT_IDS` (siehe `docs/design-system.md`, `session-handoff.md`, Varianten A–I). Neue ID: **`sommerfest`**.
- **Marke:** Fair Business Club, Gold-Krone, „Fair. Wertebasiert. Nachhaltig."
- **Palette:** creme/weiß (`#F6F1E6`/weiß), Marineblau-Text (`#12233F`), Gold-Akzent (`#A97F2C`/`#C2A24E`). **Baut auf den Navy&Gold-Tokens (Variante H/I) auf** — helle Sidebar, gold aktiver Zustand.
- **Nav (schlank, FBC):** Start · Compass · Academy · Events · Mitglieder · Aktivität ┃ Mein Profil · Meine Chancen · Meine Kurse · Meine Events · Meine Kontakte ┃ Einstellungen. Unten Nutzerkarte mit „Mein Plan"-Badge.
- **Startseite = ruhiges Dashboard:** Willkommens-Hero, 4 Stat-Karten (Compass %, Neue Empfehlungen, Nächstes Event, Mein Plan), „Neu in der Aktivität", „Neue Mitglieder für dich", „Deine nächsten Schritte". Editorial, premium, viel Weißraum.
- Diese Variante nutzt die **echten** Daten/Rechte aus A. Kein Dummy.

---

## C. LETZTER SCHRITT (zeitlich begrenzt) — eff.bee.zee-Vision-Teaser als voller Klick-Dummy
**Erst starten, wenn A + B stehen.** Dies ist additiv; wenn die Woche eng wird, wird DIESER Schritt gekürzt, niemals das echte Produkt aus A/B.

Ziel: die Variante **`linkedin`** ist ein **vollständiger, klickbarer Dummy** der eff.bee.zee-Vision, mit **Dummy-Daten** befüllt — man kann durch die ganze Navigation klicken und landet überall auf einem befüllten Screen (keine toten Links, keine Fehler, keine Sackgassen).

**Guardrails (verbindlich):**
- **Nur in `linkedin`.** Die `sommerfest`/FBC-Variante bleibt 100 % echt — dort niemals Dummies.
- **Als Vorschau kennzeichnen:** dezentes, dauerhaft sichtbares Badge/Banner **„Vorschau · in Entwicklung"** auf allen eff.bee.zee-Dummy-Screens. Ehrlich > Fake-Perfektion.
- **Voller Klick-Dummy mit Dummy-Daten:** jeder Nav-Punkt führt auf einen realistisch befüllten Screen (Seed/Fixtures, kein Backend nötig). Keine echten Schreibaktionen, keine echten Zahlungen.
- **Kein Backend-Zwang:** rein clientseitige Fixtures; nichts davon schreibt in die echte DB oder verändert Produktdaten.
- **Marke/Look:** eff.bee.zee, Kompass-Logo, „YOUR NEXT OPPORTUNITY". **Dunkle Marineblau-Sidebar** (`#0E1A3A`/`#10214A`), **blauer Akzent** (`#2F6BFF`/`#3B82F6`), heller Content (`#F5F7FB` + weiße Karten), Punkte-Stern Gold (`#E8B53A`), grüne „+P"-Belohnungen. Referenz: `docs/design-mocks/linkedin.jpeg`.
- **Volle eff.bee.zee-Nav (bewusst breiter als FBC):** Übersicht · Active · Compass · Opportunities · Menschen · Communities · Organisationen · Events · Academy ┃ Mein Netzwerk · Meine Matchings · Meine Aktivitäten · Nachrichten · Gespeichert · Mein Fortschritt ┃ Playbook · Einstellungen · Hilfe.
- **Leit-Screen „Active" (Wow-Screen, am reichsten befüllen):** „Heute für dich empfohlen" (Aufgaben-Karten mit „+X P": Restaurant/Community bewerten, Profil vervollständigen, Business Dinner besuchen, QR scannen), Grid „Bewerten & Verdienen", rechte Spalte mit ActivePoints-Ring (2.450), Level-Fortschritt (Connect 72 %), **tägliche Serie/Streak (7 Tage)**, Gewinnspiel der Woche, „Top Aktive"-Ranking, „Punkte einlösen", „Wirkung deiner Aktivität".

> **Strategie-Hinweis (bewusst so gewollt):** `linkedin` zeigt die volle eff.bee.zee-Vision inkl. ActivePoints-Gamification — die als echtes, portables Reputationssystem **noch nicht gebaut** ist. Als Vorschau okay; es ist bewusst ein Ausblick, kein Versprechen für diese Woche.

---

## Akzeptanzkriterien
- A live: 6-Level + Rechte (RLS) nach Spec 1; Nav-Umbau nach Spec 2; Upgrade-Flow im Stripe-**Test-Mode** demonstrierbar (vorher gesperrt → nach Test-Upgrade sichtbar, Webhook = Wahrheit); QM-Feedback (⭐ + „gefällt/fehlt/Idee") speichert.
- `sommerfest` + `linkedin` im DesignSwitcher (`?variant=…` / Shift+D) neben A–I.
- `linkedin` ist durchgehend klickbar mit Dummy-Daten, „Vorschau"-Badge sichtbar, **keine** toten Links/Fehler, **keine** Schreibzugriffe auf echte Daten.
- Typecheck/Lint/Tests/Prettier grün; AA-Kontrast in beiden Varianten (dunkle Sidebar!) geprüft.

## Bewusst NICHT
- Keine `legacy`/`circle`-Stufen oder -Badges (gestrichen) — nur `basic, connect, discover, exchange, focus, impact`. (Der FBC-Mock zeigt fälschlich noch „Legacy" — nicht übernehmen.)
- Keine echte Zahlung / Live-Keys · kein SEPA/EasyBill · keine AGB/Widerruf-Texte.
- Keine komplexen Profil-Scores im MVP (Mein Profil vereinfachen, `potential_score` vorerst ausblenden).
- Kein Kaltanschreiben/Branchenbuch, kein „autonomes QM ohne Personal".
- Vision-Teaser (C) frisst nicht die Woche: bei Zeitdruck C kürzen, nie A/B.

## Am Ende
Kurzer Diff-Überblick, gesetzte Default-Variante (Vorschlag: `sommerfest`), und offene Layout-Entscheidungen als Rückfrage an Donald sammeln — nicht selbst final entscheiden.
