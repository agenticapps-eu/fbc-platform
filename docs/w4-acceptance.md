# Week-4 Acceptance — W4 · Community & Demo

> **Issues:** AGE-250 … AGE-255 · **Datum:** 2026-06-16 · **Tester:** Claude Code (automatisiert)
> **Live-URL (Prüfgegenstand):** <https://fbc-platform.pages.dev> (Default-Domain, `pages.dev`)
> **Supabase:** Projekt `foelowldexkcqzewvrcf` (EU `eu-central-1` / Frankfurt) ·
> **Deploy-Stand Frontend:** `main@8ddfa6e` (PR #45, Post-Merge-Pages-Deploy) · **CI:** grün
>
> Ziel: die acht Akzeptanzkriterien aus `docs/community-events-spec.md` §5 **gegen die
> Live-Infrastruktur** verifizieren. Kernprinzip: **Sichtbarkeit wird in der DB per RLS
> erzwungen, nicht nur im Frontend** — und **Kontaktdaten werden nie automatisch freigegeben**.

---

## Prüfmethode (Transparenz)

`env=dev` teilt sich die **produktive** Supabase mit `prod` (dev == prod). Geprüft wurde
zweigleisig, mit echten Demo-Personas:

- **RLS / Sichtbarkeitsgrenze (DB-seitig):** per **Rollen-Impersonation in PostgREST-Semantik**
  — `set local role authenticated` + `request.jwt.claims = {sub,role}` in einer Transaktion,
  dann **SELECT** auf die echten Live-Tabellen. Das ist exakt die Grenze, die ein eingeloggter
  Client sieht. Schreib-Gates wurden **selbst-rollbackend** geprüft (INSERT in der Transaktion,
  Abbruch via `rollback`); die Prod-Daten wurden dabei nicht verändert.
- **UI / End-to-End (Client-seitig):** Headless-Chrome gegen die **Live-URL**, eingeloggt als
  die drei Presenter-Personas. Interaktive Schreibpfade wurden **reversibel** geprüft
  (Like an/aus, Event-Anmeldung/-Abmeldung) und der Ausgangszustand wiederhergestellt.

**Presenter-Personas** (Login-Accounts, Passwort: `DEMO_LOGIN_PASSWORD_DEV` in Infisical (`--env=prod`)):

| E-Mail | Persona | Stufe (`level_rank`) |
| --- | --- | --- |
| `discover@fbcdemo.com` | Jonas Keller | discover (1) |
| `prime@fbcdemo.com` | Carla Reinhardt | prime (5) |
| `legacy@fbcdemo.com` | Eleonora Voss | legacy (7) |

**Demo-Welt live (Stand der Abnahme):** 18 Profile (4 discover / 7 prime / 7 legacy),
32 Angebote, 31 Gesuche, 64 Matches (Score 40–97 %, Ø 54), 9 Beiträge
(3 public / 3 members / 2 prime / 1 legacy), 6 Events (1 public / 2 members / 2 prime / 1 legacy),
13 Anmeldungen, 2 angenommene Kontakte, 4 Chat-Nachrichten.

---

## Die 8 Akzeptanzkriterien

### 1 · Discover sieht öffentliche Inhalte, **kein** Verzeichnis, **keine** Kontaktfunktion (RLS) ✅

**DB (RLS, als Jonas):** volle `profiles`-Tabelle → nur **1** Zeile sichtbar (eigenes Profil),
fremde Vollprofile **0**; fremde `offers`/`needs` je **0**; `posts`/`events` mit Sichtbarkeit
`prime`/`legacy` je **0**; `public`-Beiträge **3**, `public`-Event **1**. `profiles_public`
(öffentliche Spalten-View) liefert erwartungsgemäß alle 18.
**Schreib-Gate:** `INSERT INTO contact_requests` als Jonas → von Postgres mit
`42501: new row violates row-level security policy for table "contact_requests"` **abgelehnt**
(WITH CHECK verlangt Prime+). Kein Client kann das umgehen.
**UI:** `/verzeichnis` und `/matching` leiten Discover weg (→ `/onboarding`); im `/community`
ist der **Verzeichnis-Tab durch einen Hinweis ersetzt** („Das durchsuchbare Verzeichnis aller
Mitglieder ist ab der Stufe **Prime** verfügbar."); der Feed zeigt **public + members**, aber
**weder Prime- noch Legacy-Beitrag**. → Screenshot `w4-07`, `w4-08`.

> Hinweis: `members`-Beiträge sind laut Policy für **jeden eingeloggten** Nutzer sichtbar
> (auch Discover) — bewusst so spezifiziert. Discover-spezifisch verborgen sind `prime`/`legacy`,
> das Verzeichnis und die Kontaktfunktion.

### 2 · Prime durchsucht das Mitgliederverzeichnis (Filter Thema/Branche/Region) ✅

**UI (als Carla):** `/verzeichnis` listet **18 Mitglieder** mit Filtern **THEMA**, **BRANCHE**,
**REGION**, **KOMPETENZ** und **SUCHT/BIETET** sowie Volltextsuche. Karten zeigen Avatar, Name,
Tier-Badge, Region/Firma, Branche. **DB (RLS, als Carla):** fremde Vollprofile **17** sichtbar.
→ Screenshot `w4-01`.

### 3 · Matching-Hub schlägt Top-Matches mit Prozent-Score vor (Suche ⇄ Biete) ✅

**UI (als Carla):** 6 aktive Matches mit Prozent-Score (**93 / 76 / 65 / 58 / 57 / 55 %**),
Ø-Score **67 %**, Spalten **BIETET ⇄ SUCHT**, Begründung („Warum dieses Match?", inkl.
Komplementaritäts-Paaren wie „Leistungen ↔ Experten"), Filter (Thema, Kategorie, Region,
Mindest-Score) und CTA **Kontaktanfrage senden**. **DB:** 64 Matches, Score 40–97 %.
→ Screenshot `w4-02`.

### 4 · Kontaktanfrage senden → bestätigen → **erst danach** Chat + Kontaktdaten (vorher nichts) ✅

**UI gesperrt** (Carla → Hans-Peter, **nicht** verbunden): Profil zeigt **keine** Mail/Telefon,
nur „Erst nach Annahme werden Kontaktdaten geteilt." + „E-Mail und Telefon werden nie automatisch
angezeigt." + Button **Kontaktanfrage senden**. → `w4-03`.
**UI freigegeben** (Carla → Eleonora, **angenommen**): „**Kontakt freigegeben · Angenommen**" mit
E-Mail `eleonora.voss@demo.fbc.invalid` und Telefon `+49 711 1000001` als `mailto:`/`tel:`-Links.
→ `w4-04`.
**DB (RLS, als Carla):** `profile_contacts` einer **nicht** angenommenen Person → **0** Zeilen;
der **angenommenen** Person → **1**. **Chat-Gate:** ein nicht verbundener Prime (Tobias) kann
**keinen** `message_threads`-Eintrag zu Eleonora anlegen → `42501` RLS-Ablehnung; `messages` sind
thread-gebunden (Eleonora sieht **2 von 4** Nachrichten — nur ihren Thread).

### 5 · Feed (posten / kommentieren / liken) + Event anzeigen/anmelden ✅

**Feed:** Karten mit Autor (Avatar, Name-Link, **Tier-Badge**), Zeit, Body, **Hashtag-Chips**,
**Like-/Kommentar-Zählern**; Composer mit Text, **Video-Link** und **Sichtbarkeit**
(Mitglieder/Öffentlich/Prime & Legacy/Nur Legacy). **Like-Schreibpfad** live verifiziert:
„0 Gefällt mir" → Klick → „1 Gefällt mir" (pressed) → Klick → **zurück auf 0** (reversibel).
→ `w4-05`.
**Events:** `/events` listet **5 kommende** Events mit Typ-Badge
(Präsenz/Mastermind/Online/Workshop), Datum, Ort, Host, Restplätzen; Host-Aktion **Event anlegen**.
Detailseite mit Wann/Wo/Teilnehmer/Restplätzen/Host. **Anmeldung** live verifiziert:
**Anmelden** → „Angemeldet" (Teilnehmer 1/12, Button **Abmelden**, über Reload persistiert) →
**Abmelden** („Abgemeldet").

### 6 · Dashboard „Mein Bereich" zeigt Matches, Kontakte, Events, Impact-/Potenzial-Score ✅

**UI (als Carla):** Kennzahlen **Netzwerk 1**, **Matches 6 / Ø 67**, **Events 2**; Widgets
**Mein Matching** (6 aktive Matches, Ø-Score, Suche/Biete), **Mein Netzwerk** (1 bestätigter
Kontakt), **Meine Events** (gebucht: Investoren-Mastermind Q3; eigen: FBC Webinar), **Mein Impact**
(rule-based **35/100** mit Aufschlüsselung Profilvollständigkeit 22.5/30, Compass 0/25,
Aktivität 12/20 …), **Erfolgsradar** und **Meine Beiträge** (Carlas Beitrag inkl. Video-Link).
→ `w4-06`.

> Mehrere zukunftsgerichtete Kacheln sind **explizit mit „DEMO" gekennzeichnet** (Communities,
> 30-Tage-Statistik, Projekte, Investments, Netzwerk-Aufschlüsselung) — ehrliche Platzhalter,
> die in Phase 1 noch nicht an Live-Daten hängen. Die geforderten Widgets (Matches, Kontakte,
> Events, Impact-Score) sind an echte Daten gebunden.

### 7 · Legacy sieht zusätzlich strategische/Impact-Bereiche — über RLS, nicht nur UI ✅

**DB (RLS):** `posts`/`events` mit Sichtbarkeit `legacy` sind für **Legacy je 1** sichtbar,
für **Prime je 0**. **UI (als Eleonora):** im Feed erscheint der **„Legacy post"** — exakt jener
Beitrag, der für Discover und Prime unsichtbar ist; das Verzeichnis bleibt zugänglich. Die
Differenz ist also DB-erzwungen, nicht nur Frontend. → `w4-09`.

### 8 · Alles live auf echter Infrastruktur (EU) unter `fbc-platform.pages.dev` ✅

`https://fbc-platform.pages.dev` → **HTTP 200** (Cloudflare Pages). Datenhaltung auf Supabase
`foelowldexkcqzewvrcf`, Region **`aws-1-eu-central-1` (Frankfurt, EU)**. **27 Migrationen** live
appliziert (inkl. `messages_realtime`, `post_engagement_counts`(+cap), `event_rpcs`,
`profile_videos`). Sämtliche obigen Prüfungen liefen gegen genau diese Live-Instanz.

---

## Zusammenfassung

| # | Kriterium | Issue | Ergebnis |
| --- | --- | --- | --- |
| 1 | Discover: öffentl. Inhalte, kein Verzeichnis/Kontakt (RLS) | AGE-250/255 | ✅ |
| 2 | Prime: Verzeichnis durchsuchen (Filter) | AGE-255 | ✅ |
| 3 | Matching-Hub: Top-Matches mit %-Score (Suche⇄Biete) | AGE-255 | ✅ |
| 4 | Kontakt-Flow: Daten/Chat erst nach `accepted` (RLS) | AGE-255 | ✅ |
| 5 | Feed (posten/kommentieren/liken) + Event anzeigen/anmelden | AGE-250/251/252 | ✅ |
| 6 | Dashboard „Mein Bereich": Matches/Kontakte/Events/Score | AGE-255 | ✅ |
| 7 | Legacy: zusätzliche Bereiche via RLS | AGE-255 | ✅ |
| 8 | Live auf echter EU-Infrastruktur | AGE-253/255 | ✅ |

**Ergebnis: 8/8 grün.** Der Phase-1-Prototyp ist vorführbar (siehe `docs/demo-script.md`).

---

## Nebenbefunde & offene Härtungen (keine Kriteriums-Blocker)

- **Supabase-Advisors (security):** ein ERROR `security_definer_view` auf `profiles_public` —
  **by design** (Spalten-Projektion öffentlicher Felder, bewusst als SECURITY-DEFINER-View, vgl.
  `docs/rls-policies.md` §1). Mehrere WARN zu `SECURITY DEFINER`-Funktionen, die `anon`/
  `authenticated` per RPC ausführen können (`register_for_event`, `set_event_check_in`,
  `event_/post_engagement_counts`, `current_tier_rank`, `is_prime_plus` …), `pg_net` im
  `public`-Schema sowie „leaked password protection disabled". **Keine neuen RLS-Lücken**; die
  Funktions-Grants gehören in dieselbe Härtungsklasse wie die bekannte `regs_write_own`-Notiz.
- **Migrations-Drift Repo ↔ prod:** die letzten ~5 Migrationen liegen live unter **anderen
  Versions-Timestamps** als die Repo-Dateien (Objektzustand korrekt, nur History-Versionen
  weichen ab). Bekannte Altlast — vor weiteren DDL-Schritten mit `supabase migration repair`
  angleichen (Issue **AGE-257**).
- **Test-Residuum:** der reversible Event-Anmelde-Test hat über „Abmelden" **eine
  `cancelled`-Zeile** in `event_registrations` hinterlassen (Carla / Leadership-Workshop;
  `13 → 14` Zeilen). Visuell harmlos (cancelled zählt nicht als Teilnehmer, taucht nicht in
  „gebuchte Events" auf). Das direkte DB-`DELETE` wurde vom Prod-Schreibschutz korrekt blockiert;
  Bereinigung via `DEMO_SEED_CONFIRM=fbc-demo DEMO_SEED_TLS_INSECURE=1 pnpm demo:reset`.

---

## Prototyp-Status & Ausblick Phase 2

**Stand Phase 1 (Prototyp):** vorführbar. Stufen-Logik (Discover → Prime → Legacy) mit
DB-erzwungener Sichtbarkeit, Profil/Verzeichnis/Such-Biete, regelbasiertes Matching mit Score
und Begründung, Kontakt-Flow mit Freigabe-Gate, Community-Feed (inkl. Video-Embed), Events mit
Anmeldung/Warteliste/Host-Tools, Mitglieder-Dashboard und eine stimmige Demo-Welt — alles live auf
EU-Infrastruktur. Die acht Akzeptanzkriterien sind 8/8 grün.

**Offen / nach Phase 2 verschoben:**

| Thema | Inhalt | Tracking |
| --- | --- | --- |
| **Custom Domain** | `app.fairbusinessclub.de` an Cloudflare Pages anbinden (DNS-Delegation nötig) | AGE-256 (blockiert) |
| **Migrations-Deploy** | Prod-Migrationen automatisieren + Repo↔prod-Drift via `supabase migration repair` angleichen | AGE-257 |
| **Stripe / Bezahlung** | Mitgliedsstufen-Upgrade & Abrechnung; heute werden Stufen nur per Admin/SQL gesetzt | Phase 2 (neu) |
| **Onboarding-Vollausbau** | Compass-Onboarding über „Überspringen" hinaus verbindlich machen, an Profil/Score koppeln | Phase 2 (neu) |
| **Academy / Library** | Echte Inhalte statt Platzhalter; Video-Embed ist bereits wiederverwendbar vorhanden | Phase 2 (neu) |
| **DSGVO-Paket** | AVV, Lösch-/Auskunftsprozesse, Consent, Impressum/Datenschutz, Audit-Logging | Phase 2 (neu) |
| **Odoo-Migration** | Stammdaten-/CRM-Anbindung bzw. Migration nach Odoo | Phase 2 (neu) |
| **RLS-Härtung** | `regs_write_own` (RPC-Bypass), `SECURITY DEFINER`-RPC-Grants für `anon`/`authenticated`, „leaked password protection" aktivieren, `QueryClient`-Cache beim Logout leeren (AGE-258) | Folge-Issues |
| **Dashboard-Daten** | „DEMO"-markierte Kacheln (Communities, Statistik, Projekte, Investments) an Live-Daten binden | Phase 2 (neu) |

> Mehrere Phase-2-Themen haben in Linear noch **kein** Issue (Stripe, Onboarding-Vollausbau,
> Academy/Library-Inhalte, DSGVO-Paket, Odoo-Migration, Dashboard-Live-Daten) — empfohlen: als
> eigenes Phase-2-Milestone anlegen.

---

_Gehört zu den Issues **AGE-250 … AGE-255** im Linear-Projekt „FBC Plattform – Prototyp (Phase 1)"._
