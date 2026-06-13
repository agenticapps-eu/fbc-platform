# Week-2 Acceptance — W2 · Profil & Verzeichnis

> **Issue:** AGE-240 · **Datum:** 2026-06-14 · **Tester:** Claude Code (automatisiert)
> **Live-URL (Prüfgegenstand):** <https://fbc-platform.pages.dev> (Default-Domain, `pages.dev`)
> **Supabase:** Projekt `foelowldexkcqzewvrcf` (EU `eu-central-1`/Frankfurt) ·
> **Deploy-Stand Frontend:** `main@7ef7825` · **CI:** grün
>
> Ziel: die W2-Lieferungen (Design-System, Profil-Editor, öffentliche Profilseite,
> „Mein Bereich"-Dashboard, Mitgliederverzeichnis, Potenzial-Score, Mini-Compass)
> **end-to-end** gegen die Live-Infrastruktur verifizieren — Sichtbarkeit wird **in
> der Datenbank per RLS** erzwungen, nicht nur im Frontend. RLS-/RPC-Checks unten
> liefen mit **echten User-JWTs** (GoTrue-Login) gegen die produktive PostgREST-API.

---

## ⚠️ Befund während der Abnahme: Migrations-Deploy-Lücke (behoben)

Beim ersten Live-Durchlauf waren **drei W2-Features in Produktion defekt**, obwohl
Code gemergt, Linear-Issues auf Done und CI grün waren: Die Prod-DB hing **drei
Migrationen zurück** (appliziert nur bis `20260613155545_profile_public_tier_roles`).
Das deployte Frontend (`main@7ef7825`) rief DB-Objekte auf, die in prod fehlten.

| Fehlend in prod | Issue | Symptom live (vor Fix) |
| --- | --- | --- |
| `20260613170000_directory_search` | AGE-241 | `search_directory` RPC → `404 PGRST202`; Verzeichnis lud nicht |
| `20260613230000_potential_score` | AGE-242 | `recompute_potential_score` → 404; Dashboard fiel auf gespeicherten Score zurück (legacy zeigte **842** auf /100-Skala) |
| `20260613233000_compass_responses_rls` | AGE-243 | `compass_responses` RLS-aktiv, **0 Policies** → Onboarding-Schreiben verweigert |

**Ursache:** Die CI validiert Migrations-SQL gegen eine ephemere Shadow-DB, appliziert
sie aber **nicht** automatisch auf prod. Der Push-Schritt war nach den AGE-241/242/243-PRs
nicht gelaufen. → Risiko **R1** (siehe §6).

**Remediation (2026-06-14):** Die drei ausstehenden Migrationen wurden per
`supabase db push --linked` mit ihren korrekten Versionsnummern auf prod appliziert.
Vorgelagert war eine Migrations-History-Reparatur einer **vorbestehenden** Drift nötig
(`20260613081749_avatars_drop_public_listing_policy` war remote-only, ohne Repo-Datei;
`migration repair --status reverted`). Der avatars-Policy-Zustand bleibt unverändert —
das Repo (`20260613081627_profile_editor_storage.sql`) erzeugt den Bucket bewusst ohne
Listing-Policy, Repo und Prod konvergieren also zum selben Zustand. → Risiko **R2**.

Alle Checks unten wurden **nach** der Remediation erhoben und sind grün.

---

## Zusammenfassung

| Bereich | Issue | Ergebnis |
| --- | --- | --- |
| Schwarz-&-Gold durchgängig (Tokens `#0E0F12`/`#C2A24E`), Sidebar `Compass → … → Projekte` | AGE-237 | ✅ |
| Profil-Editor speichert; `profile_completion` server-seitig gepflegt | AGE-238 | ✅ |
| Öffentliche Profilseite: nur öffentliche Felder (Discover) bzw. erweitert (Prime+) — **RLS-erzwungen** | AGE-239 | ✅ |
| „Mein Bereich"-Dashboard nach Mockup; CORE = echte Daten, DEMO gekennzeichnet | AGE-240 | ✅ |
| Verzeichnis nur ab Prime durchsuchbar (`search_directory`); Facetten plausibel | AGE-241 | ✅ |
| Potenzial-/Impact-Score (0–100, regelbasiert) + Erfolgsradar (0–10) plausibel | AGE-242 | ✅ |
| Mini-Compass schreibt ins Profil (`compass_responses`, own-only RLS) | AGE-243 | ✅ |
| Live-Deploy `pages.dev` erreichbar, SPA-Deep-Routes | — | ✅ |
| **Custom Domain `app.fairbusinessclub.de`** | AGE-256 | ⏳ offen (W4, Domain-Zugang blockiert) |

---

## 1. Design-System & Shell (AGE-237)

| Check | Methode | Ergebnis |
| --- | --- | --- |
| Schwarz-&-Gold-Tokens definiert | `src/index.css`: `--color-night: #0e0f12`, `--color-gold: #c2a24e` (= AGE-237/`docs/design-system.md`) | ✅ |
| Sidebar near-black + Gold-Akzente | `AppShell.tsx` Sidebar `bg-night border-night-border`; Profil-Header/Impact-Card `bg-night text-gold` | ✅ |
| **Verbindliche Sidebar-Reihenfolge** | `src/config/nav.ts` `formate`-Sektion: **Compass → Library → Academy → Community → Events → Matching → Projekte** | ✅ |
| Look durchgängig (Member-Dashboard) | QA-Screens `.planning/qa-screens/age240-dashboard-{full,mobile}.png` (13.06.) | ✅ |
| Live-Shell erreichbar | `GET /` → `200 text/html`, `<title>Fair Business Club</title>` | ✅ |

---

## 2. Öffentliche Profilseite — Sichtbarkeit per RLS (AGE-239)

Methode: Login je Account via GoTrue, dann `…/rest/v1/*` mit dem **echten User-JWT**
(RLS voll aktiv). Geprüft am Profil **Legacy** (Inhaber der W1-Fixtures: 4 Theme-Scores,
4 Interessen, 3 Offers, 2 Needs). `rows` = tatsächlich zurückgegebene Zeilen.

| Akteur | Ressource | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| **Discover** | `profiles_public` (Legacy) | öffentliche Felder sichtbar | `rows=1` ✅ |
| **Discover** | `profiles` (Legacy, erweitert) | **deny** | `rows=0` ✅ |
| **Discover** | `profile_theme_scores` (Legacy) | verborgen | `rows=0` ✅ |
| **Discover** | `offers` (Legacy) | verborgen | `rows=0` ✅ |
| **Prime** | `profiles` (Legacy, erweitert) | sichtbar | `rows=1` ✅ |
| **Prime** | `profile_theme_scores` (Legacy) | Erfolgsradar sichtbar | `rows=4` ✅ |
| **Prime** | `offers` (Legacy) | sichtbar | `rows=3` ✅ |

→ **Discover sieht nur öffentliche Felder; Erfolgsradar, Interessen, Kompetenzen und
das Such-/Bieteprofil erst ab Prime — per RLS, nicht UI.** Die Datenschicht
(`src/lib/public-profile.ts`) liest `extended` aus `profiles` + Detailtabellen; bleiben
die RLS-Zeilen leer, ist `extended = null` — es wird nichts „gefaket". Kontaktdaten
(E-Mail/Telefon) werden nie automatisch angezeigt; Kontakt-Flow folgt in W3.

---

## 3. Verzeichnis ab Prime (AGE-241)

`search_directory(...)` ist `SECURITY INVOKER` — die Policy `profiles_select_self_or_prime`
ist die Sichtbarkeitsgrenze (`anon` hat keinen execute-Grant; nur `authenticated`).
Der „Verzeichnis"-Tab ist UI-seitig zusätzlich unter Prime versteckt (Komfort).

| Akteur | Aufruf | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| **Discover** | `rpc/search_directory {}` | höchstens eigene Zeile | `rows=1` (`Discover Demo`) ✅ |
| **Prime** | `rpc/search_directory {}` | volles Verzeichnis | `rows=4` (`Discover Demo`, `Legacy Demo`, `Maximilian Bauer`, `Prime Demo`) ✅ |
| **Prime** | `rpc/search_directory {p_theme:"wirken"}` | Facetten-Filter greift | `rows=2` (`Legacy Demo`, `Maximilian Bauer`) ✅ |

→ Zusätzlich auf Tabellenebene bestätigt: Discover sieht in `profiles` nur die **eigene
Zeile** (`content-range 0-0/1`), Prime das **ganze Verzeichnis** (`0-3/4`). Die
Sichtbarkeitsgrenze hält DB-seitig, unabhängig von der RPC.

---

## 4. „Mein Bereich"-Dashboard — CORE/DEMO (AGE-240)

Layout & Widget-Reihenfolge nach `docs/profile-spec.md §4/§5` (Member-Dashboard-Mockup).
Datenschicht `src/lib/dashboard.ts` lädt ausschließlich das **eigene** Profil
(`requiresAuth`, `uid === auth.uid()`), Counts über `head`-Queries, ein `Promise.all`.

| Widget | Klasse | Quelle | Status |
| --- | --- | --- | --- |
| Erfolgsradar | CORE | `profile_theme_scores` | ✅ echt |
| Meine Entwicklung | CORE | `dev_focus`/`dev_progress`/`next_steps` | ✅ echt |
| Meine Interessen | CORE | `profile_interests` | ✅ echt |
| Mein Matching, Mein Impact, Auszeichnungen, Ziele, Beiträge | CORE | `offers`/`needs`/`matches`/`profile_badges`/`goals`/`posts` | ✅ echt |
| Gebuchte Events | CORE→DEMO-Fallback | `event_registrations`; DEMO wenn leer (`demo`-Badge) | ✅ |
| Communities, Statistik (30 T.), Projekte, Investments, Netzwerk-Listen, KI-Assistent | DEMO | Platzhalter, je mit `<DemoBadge>` „Demo" | ✅ gekennzeichnet |

→ **CORE-Widgets nutzen echte Daten; leere CORE-Quellen zeigen einen Leerzustand,
niemals Fake-Daten. DEMO-Widgets tragen sichtbar ein „Demo"-Badge** (`MeinBereichPage.tsx`,
Marker §1–§15). QA-Screens: `age240-dashboard-full.png`, `age240-dashboard-mobile.png`.

---

## 5. Potenzial-/Impact-Score & Erfolgsradar (AGE-242)

`recompute_potential_score(profile_id)` (SECURITY DEFINER, own-only) berechnet den Score
aus fünf gewichteten Komponenten (Vollständigkeit 30 · Compass 25 · Aktivität 20 ·
Empfehlungen 15 · Feedback 10) → **0–100**, und leitet die vier Radar-Themen (0–10) ab.
Das Dashboard ruft die RPC **beim Laden vor dem Lesen** (`dashboard.ts:188`) — der
gespeicherte Wert wird also stets frisch normalisiert.

| Akteur (echter JWT) | Aufruf | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| **Legacy** | `recompute` (eigenes) | Score 0–100 + Aufschlüsselung | `score=44` (22.5+0+18+3+0) ✅ |
| **Legacy** | `profiles.potential_score` danach | normalisiert (war **842**) | `44` ✅ |
| **Discover** | `recompute` (eigenes) | Score 0–100 | `score=15` ✅ |
| **Discover** | `recompute` für **fremdes** Profil | **deny** (own-only) | `403` / `42501` „not allowed for another profile" ✅ |

Erfolgsradar (Legacy, gespeichert): Haben 9.2 · Sein 8.5 · Tun 7.0 · Wirken 6.4 — alle
in **0–10** ✅. Read-only-Replikation der Formel über alle Demo-Accounts bestätigte den
0–100-Bereich (Discover 15, Prime 15, Legacy 44).

> **Hinweis:** Der zuvor gespeicherte `potential_score=842` bei Legacy war ein veralteter
> Seed-Wert aus dem AGE-234-Datenmodell (vor AGE-242). Da das Dashboard recompute-vor-Lesen
> ausführt, war er nie nutzersichtbar; bei dieser Abnahme wurde er über den regulären
> RPC-Pfad auf 44 normalisiert.

---

## 6. Mini-Compass befüllt das Profil (AGE-243)

Die Onboarding-Strecke schreibt Antworten nach `compass_responses` (Ableitung →
`profile_theme_scores`/`profile_interests`/`offers`/`needs`/`dev_focus`). RLS: **strikt
eigenes Profil** (`compass_responses_select_own`, `compass_responses_write_own`).

| Akteur (echter JWT) | Aktion | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| **Discover** | `SELECT` eigene | erlaubt | `HTTP 200` ✅ |
| **Discover** | `INSERT` eigene Antwort | erlaubt | `HTTP 201` ✅ |
| **Discover** | `INSERT` für **fremdes** Profil (Prime) | **deny** (with-check) | `HTTP 403` ✅ |
| (cleanup) | Probe-Zeile `DELETE` | entfernt | `HTTP 204`, danach `count=0` ✅ |

→ **Der Onboarding-Schreibpfad funktioniert; die Eigen-Profil-Grenze ist DB-erzwungen.**
Der Probe-Datensatz wurde nach dem Test wieder entfernt (Prod-DB sauber).

---

## 7. Deploy & CI

| Check | Ergebnis |
| --- | --- |
| `GET https://fbc-platform.pages.dev/` | `200`, `<title>Fair Business Club</title>` ✅ |
| Deep-Routes `…/verzeichnis`, `…/mein-bereich`, `…/compass` (SPA-Fallback) | `200` ✅ |
| Deployter Frontend-Stand | `main@7ef7825` ✅ |
| Prod-DB-Migrationen nach Remediation | bis `20260613233000_compass_responses_rls` ✅ |

---

## 8. Offene Punkte / Risiken für W3 (Matching & Kontakt)

- **R1 — Migrations-Deploy nicht automatisiert (HOCH).** CI validiert Migrationen gegen
  eine Shadow-DB, appliziert sie aber nicht auf prod. Diese Abnahme musste die Lücke
  manuell schließen (`supabase db push`). **Vor W3** einen automatischen Push-Schritt
  (oder ein verbindliches Deploy-Runbook) etablieren — sonst gehen W3-Migrationen
  (Match-Engine, contact_requests/messages, Realtime) erneut nicht live. Follow-up:
  **AGE-257** (W3, High).
- **R2 — Migrations-History-Drift.** `20260613081749_avatars_drop_public_listing_policy`
  existierte remote ohne Repo-Datei (vermutlich früher direkt per MCP `apply_migration`
  appliziert). Für diese Abnahme als `reverted` repariert (kein Schema-Effekt; Repo
  erzeugt den Zielzustand ohnehin policy-frei). Team-Konvention festhalten: **keine
  direkten Prod-Applies** außerhalb von `db push`.
- **Score-Komponenten Compass/Feedback heute 0.** `recompute` ist korrekt, aber Compass
  (25 %) zählt erst nach Mini-Compass-Nutzung, Feedback (10 %) ist ein Phase-1-Proxy ohne
  Datenquelle. Für die Demo (AGE-254) sollten Personas den Compass durchlaufen, damit der
  Score nicht überwiegend aus Vollständigkeit+Aktivität besteht.
- **Kontakt-Flow ist W3.** Die öffentliche Profilseite zeigt ab Prime „Kontaktanfrage
  senden", löst aber nur einen Toast aus (`PublicProfilePage.tsx`). `contact_requests`/
  `messages`-RLS steht (W1), die UI-/E-Mail-Flows kommen in AGE-247/248.
- **Fragenkatalog Mini-Compass** (`src/config/compass.ts`) ist Platzhalter-Wortlaut —
  mit Detlev finalisieren (offen aus AGE-243).
- **Test-Fixtures** verbleiben unter den Demo-Accounts in der Prod-DB (hinter RLS,
  unkritisch). Echte Demo-Personas sind als AGE-254 (W4) geplant.

---

## 9. Definition of Done — Status

- [x] `docs/w2-acceptance.md` mit grünen Checks (Live-URL = `pages.dev`)
- [x] W2-Migrationen auf prod appliziert (AGE-241/242/243); Features live verifiziert
- [x] W2-Issues in Linear: AGE-238/239/240/241/242/243 = Done; AGE-237 (Design-System, W1) = Done
- [x] Meilenstein „W2 · Profil & Verzeichnis" = 100 %
- [x] Follow-up-Issue „Migrations-Deploy auf prod automatisieren" (R1) angelegt — **AGE-257** (W3, High)
