# Profil & „Mein Bereich"-Dashboard — FBC Platform (Phase 1)

> **Für Claude Code:** Verbindliche Spezifikation für Woche 2 — Issues **AGE-238** (Profil-Editor), **AGE-239** (öffentliche Profilseite), **AGE-240** (Mein-Bereich-Dashboard).
> Visuelle Referenz: Detlevs Member-Dashboard-Mockup („Maximilian Bauer", Legacy Member). Look: **Schwarz & Gold** (siehe `docs/design-system.md`).
> Datenmodell-Basis: `docs/data-model.md`; Sichtbarkeit: `docs/rls-policies.md`.

**Prototyp-Prinzip:** Struktur & Layout 1:1 nach Mockup. Wo echte Daten existieren → echt anbinden (**CORE**). Wo nicht → klar gekennzeichnete Demo-/Platzhalterdaten (**DEMO**), die später Phase 2 füllt. Niemals so tun, als wäre DEMO echt.

---

## 1. Datenmodell-Erweiterung (Migration, Teil von AGE-238)

Neue Migration `supabase/migrations/*_profile_extension.sql`.

**`profiles` erweitern:**
| Spalte | Typ | Hinweis |
|---|---|---|
| headline | text | z. B. „Unternehmer · Investor · Deal Keeper · Ökosystem Architekt" |
| roles | text[] | strukturierte Rollen (Quelle für headline-Chips) |
| member_number | text unique | z. B. `FBC-10023` |
| member_since | date | „Mitglied seit" |
| dev_focus | text | aktueller Fokus-Theme (`sein`/`tun`/`haben`/`wirken`) |
| dev_progress | int | 0–100 (Entwicklungs-Fortschritt) |
| next_steps | text[] | „Nächste Schritte für dich" |

> Der große Kopf-Wert „Impact Score" = bestehendes `potential_score` (UI-Label „Impact Score"). Kein neues Feld.

**Neue Tabellen:**
- `profile_theme_scores`: `profile_id` FK, `theme` text check(sein/tun/haben/wirken), `score numeric(3,1)` (0–10), unique(profile_id,theme). → Erfolgsradar.
- `profile_interests`: `id`, `profile_id` FK, `theme` text (sein/tun/haben/wirken), `label` text. → gruppierte Interessen.
- `goals`: `id`, `profile_id` FK, `category` text check(persoenlich/unternehmerisch/finanziell/wirkung), `title` text, `progress` int (0–100).
- `badges` (Stammdaten): `key` PK, `label`, `icon`. Seed: `transaction_manager`„Certified Transaction Manager", `mentor`„Certified Mentor", `host`„Certified Host", `ambassador`„Certified Ambassador".
- `profile_badges`: `profile_id` FK, `badge_key` FK→badges, `awarded_at` date, PK(profile_id,badge_key).

**RLS (analog `docs/rls-policies.md`):**
- `profile_theme_scores`, `profile_interests`, `profile_badges`: SELECT wie erweiterte Profilfelder (eigenes Profil **oder** Prime+); Schreiben nur eigenes Profil.
- `goals`: **nur eigenes Profil** (privat) — weder öffentlich noch Prime+.
- `badges`: SELECT für alle (Stammdaten).

Counts (Netzwerk/Matches/Projekte/Events) im Prototyp per Count-Query ableiten (keine denormalisierten Zähler).

---

## 2. Sichtbarkeit: öffentlich vs. voll

| Block | Öffentlich (Discover) | Voll (eigenes Profil / Prime+) |
|---|---|---|
| Name, Avatar, Tier-Badge, Region, Unternehmen, Kurzbeschreibung, Rollen | ✅ | ✅ |
| Impact Score, Erfolgsradar, Interessen, Kompetenzen | ❌ | ✅ |
| Such-/Bieteprofil (Matching) | ❌ | ✅ (Prime+) |
| Statistik, Ziele, Investments, Dokumente | ❌ | nur eigenes Profil |
| E-Mail/Telefon | ❌ | nur nach Kontakt-Freigabe |

Öffentliche Profilseite (**AGE-239**) liest aus `profiles_public`; das volle Dashboard (**AGE-240**) aus `profiles` + Detailtabellen (RLS greift).

---

## 3. Profil-Header (CORE)

- Avatar (rund), **Name** (`--font-display`), **Tier-Badge** mit Krone (z. B. „LEGACY MEMBER", Gold-Outline).
- Rollen-Zeile aus `roles`/`headline`. Darunter: Region, Unternehmen.
- Meta: „Mitglied seit: {member_since}" · „Mitgliedsnummer: {member_number}".
- Rechts optional „Beyond Success"-Badge-Bild (DEMO-Asset bis finale Assets vorliegen).
- **Stat-Tiles** (eine Reihe): **Impact Score** (`potential_score`, mit ↑-Trend) · **Netzwerk** (Kontakte-Count) · **Matches** (accepted) · **Projekte** (Count) · **Events** (Registrierungen). Fehlt eine Quelle → DEMO-Zahl mit dezentem „Demo"-Hinweis.

---

## 4. „Mein Bereich"-Subnavigation (eigene Sidebar im Dashboard)

Gruppen & Einträge exakt nach Mockup (Routen als Tabs/Anchor im Prototyp; Tiefen-Seiten folgen):

- **MEIN PROFIL:** Übersicht · Profil bearbeiten · Mein Erfolgsradar · Interessen & Fokus
- **MEIN NETZWERK:** Meine Kontakte · Freunde · Preferred Partner · Mentoren · Mentees
- **MEINE AKTIVITÄTEN:** Meine Events · Meine gebuchten Events · Meine eigenen Events · Meine Gruppen · Meine Beiträge
- **MEIN BUSINESS:** Meine Projekte · Meine Investments · Meine Angebote · Meine Gesuche
- **MEIN MATCHING:** Mein Matching Dashboard · Meine Suchaufträge · Meine Matches · Matching Historie
- **MEINE ENTWICKLUNG:** Academy & Kurse · Zertifikate & Badges · Meine Ziele · Meine Dokumente
- **MEINE TOOLS:** FBC KI Assistent · Favoriten · Einstellungen
- **Fußkarte:** „Dein Compass — Dein Weg. Deine Richtung." + Button „Jetzt öffnen" (führt zu `/compass`).

Im Prototyp sind „Übersicht", „Profil bearbeiten", „Mein Erfolgsradar", „Interessen & Fokus", „Meine Angebote/Gesuche", „Meine Ziele", „Zertifikate & Badges" funktional; der Rest verlinkt auf vorhandene Formate oder zeigt einen sauberen Leerzustand.

---

## 5. Dashboard „Übersicht" — Widget-Layout (AGE-240)

Reihenfolge & Inhalt nach Mockup. Kennzeichnung CORE/DEMO:

1. **Mein Erfolgsradar** (CORE) — Radar Sein/Tun/Haben/Wirken aus `profile_theme_scores` (Recharts).
2. **Meine Entwicklung** (CORE) — `dev_focus`, `dev_progress` (Balken), `next_steps` (Checkliste), Button „Zur persönlichen Roadmap" (→ `/compass`).
3. **Meine Interessen** (CORE) — gruppiert nach Thema aus `profile_interests` (Persönlichkeit/Unternehmen/Investments/Wirkung), Chips, „Bearbeiten".
4. **Meine gebuchten / vergangenen / eigenen Events** (CORE, soweit Daten) — aus `events`/`event_registrations`; sonst DEMO.
5. **Meine Communities** (DEMO im Prototyp — Gruppen kommen später).
6. **Mein Netzwerk** (CORE-Counts, DEMO-Listen) — Freunde/Preferred Partner/Mentoren/Mentees.
7. **Mein Matching** (CORE) — „Ich suche"/„Ich biete" als Icon-Grid aus `needs`/`offers` (Kategorien: Investoren, Projekte, Immobilien, Partner, Experten / Kapital, Kontakte, Know-how, Immobilien, Beteiligungen); Kennzahlen Aktive/Erfolgreiche Matches + Ø-Score aus `matches`.
8. **Meine Statistik (30 Tage)** (DEMO im Prototyp — Tracking liefert Axiom später) — Neue Kontakte/Profilaufrufe/Nachrichten/Match-Anfragen/Event-Teilnahmen mit Trend.
9. **Mein Impact** (CORE-Zahl) — dunkle Gold-Card: `potential_score` groß, „+x Punkte diesen Monat" (DEMO-Delta), Sparkline (DEMO).
10. **Meine Projekte** (DEMO) — Titel + Fortschritt.
11. **Meine Investments** (DEMO) — Titel + Wertentwicklung %.
12. **Meine Beiträge** (CORE soweit `posts`) — Artikel/Video/Podcast mit Views/Likes; sonst DEMO.
13. **Meine Auszeichnungen** (CORE) — aus `profile_badges`/`badges`.
14. **Meine Ziele** (CORE) — aus `goals`, vier Kategorien mit Fortschritt.
15. **FBC KI Assistent** (DEMO/Platzhalter) — Eingabe + Vorschlags-Chips, ohne echte KI in Phase 1.

Layout: mehrspaltiges Card-Grid (3 Spalten Desktop), helle Cards auf `--color-soft`, Gold-Akzente, viel Weißraum — Anmutung wie Mockup. Responsiv auf 1 Spalte.

---

## 6. Profil-Editor (AGE-238, CORE)

Bearbeitet: Pflicht (Name, Avatar, Region, Unternehmen, Kurzbeschreibung) + Rollen, headline, Branche, Kompetenzen, Interessen (mit Thema), Ziele, Website, Social, dev_focus. Avatar-Upload → Storage-Bucket `avatars`. `profile_completion` live berechnen (≥ 80 % = „vollständig"). react-hook-form + zod, optimistische Updates via TanStack Query.

---

## 7. Definition of Done (Woche 2)

- Migration `*_profile_extension.sql` + RLS angewandt (`supabase db reset` grün); Typen neu generiert.
- Profil-Editor speichert alle Felder; `profile_completion` aktualisiert sich.
- Öffentliche Profilseite zeigt nur öffentliche Felder (Discover-Sicht), volle Sicht ab Prime/eigenes Profil — über RLS, nicht nur UI.
- „Mein Bereich"-Dashboard bildet das Mockup-Layout in Schwarz & Gold ab; CORE-Widgets nutzen echte Daten, DEMO-Widgets sind als solche erkennbar.
- Commits referenzieren AGE-238 / AGE-239 / AGE-240.

---

_Gehört zu den Issues **AGE-238/239/240** im Linear-Projekt „FBC Plattform – Prototyp (Phase 1)"._
