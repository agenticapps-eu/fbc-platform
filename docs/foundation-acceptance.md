# Foundation Acceptance — W1 · Fundament (Smoke Test)

> **Nachtrag 2026-08-20 (AGE-576):** Wo dieses Dokument die Demo-Personas
> (`@fbcdemo.com`, `@demo.fbc.invalid`, Jonas/Carla/Eleonora) als Prüfweg
> benutzt, ist es **nicht mehr nachvollziehbar**: DEV trägt seit dem Spiegel die
> echten Mitglieder, und von diesen Konten existiert dort keines mehr
> (nachgezählt: 0 von 72). Die damals belegten Befunde bleiben gültig — der
> beschriebene Weg, sie zu wiederholen, nicht. Siehe `docs/demo-script.md`.

> **Nachtrag 2026-08-10 (ADR-0037):** Die Axiom-Destination wurde entfernt.
> `/api/log` schreibt jetzt eine strukturierte JSON-Zeile in die Workers Logs
> statt an Axiom zu senden; es gibt kein `AXIOM_TOKEN` und keinen `502`-Pfad
> mehr. **Die Ergebnisse unten bleiben unverändert** — sie sind das Protokoll
> des Abnahmelaufs vom 2026-06-12 und beschreiben, was damals galt, nicht den
> heutigen Stand. Nur der offene Punkt „Axiom Preview-Env" weiter unten war
> zukunftsgerichtet und ist korrigiert.


> **Issue:** AGE-232 · **Datum:** 2026-06-12 · **Tester:** Claude Code (automatisiert)
> **Live-URL (Prüfgegenstand):** <https://fbc-platform.pages.dev> (Default-Domain, `pages.dev`)
> **Supabase:** Projekt `foelowldexkcqzewvrcf` (EU `eu-central-1`/Frankfurt) ·
> **Deploy-Stand:** `main@6e3c410` · **CI:** grün
>
> Ziel: das W1-Fundament **end-to-end** gegen die Live-Infrastruktur verifizieren —
> insbesondere, dass Sichtbarkeit **in der Datenbank per RLS** erzwungen wird, nicht
> nur im Frontend. Alle Checks unten wurden gegen die produktive Supabase-Instanz
> (echte JWTs via GoTrue Login) und die Live-Deploy-URL ausgeführt.

---

## Zusammenfassung

| Bereich | Ergebnis |
| --- | --- |
| Test-Accounts (Discover/Prime/Legacy) angelegt + Stufen gesetzt | ✅ |
| RLS-Gating Discover (kein Verzeichnis, keine Kontaktfunktion) — **DB-erzwungen** | ✅ |
| RLS-Gating Prime (Verzeichnis + Suche, Kontaktanfrage senden) | ✅ |
| `messages`-INSERT scheitert ohne `accepted` contact_request, gelingt danach | ✅ |
| Kontaktdaten erst nach `accepted` lesbar (keine automatische Freigabe) | ✅ |
| Sichtbarkeit nach `visibility × rank` (posts/events) | ✅ |
| Test-Fehler in **Sentry** sichtbar | ✅ |
| Test-Event an **Axiom** (`/api/log`) angenommen | ✅ |
| Prod-Deploy `pages.dev` erreichbar, SPA-Deep-Routes, Login/Redirect | ✅ |
| CI grün auf `main` | ✅ |
| **Custom Domain `app.fairbusinessclub.de`** | ⏳ **offen** (Follow-up, Domain-Zugang blockiert) |

---

## 1. Test-Accounts

Im `auth.users` direkt angelegt (bestätigt) — Stufen über `public.profiles.tier`
gesetzt (Client kann `tier` nicht schreiben; siehe `docs/tier-testing.md`).
Passwort aller Accounts: `DEMO_LOGIN_PASSWORD_DEV` in Infisical (`--env=prod`).
(Bis 2026-08-20 stand hier `Test1234!`; ersetzt, weil dieselben Konten seit dem
Spiegel DEV ← PROD neben echten Mitgliederdaten stehen.)

| E-Mail | UUID | `tier` | `level_rank` | bestätigt |
| --- | --- | --- | --- | --- |
| `discover@fbcdemo.com` | `2752a480…c781a7` | `discover` | 1 | ✅ |
| `prime@fbcdemo.com` | `d73efa12…b10782` | `prime` | 5 | ✅ |
| `legacy@fbcdemo.com` | `5e195a30…3209c7` | `legacy` | 7 | ✅ |

**Test-Fixtures** (per `service_role` angelegt, im Besitz von *Legacy*, damit
Cross-Profil-Sichtbarkeit prüfbar ist): 1 Offer, 1 Need, 4 Posts
(`public`/`members`/`prime`/`legacy`), 2 Events (`public`/`prime`),
1 `profile_contacts`-Zeile, 1 Thread Prime↔Legacy.

---

## 2. RLS end-to-end (echte JWTs gegen die Live-PostgREST-API)

Methode: Login je Account via GoTrue (`/auth/v1/token?grant_type=password`),
dann Zugriff auf `…/rest/v1/*` mit dem **echten User-JWT** — d. h. exakt wie der
Client, RLS voll aktiv. `rows=` = Anzahl tatsächlich zurückgegebener Zeilen.

### 2.1 Lese-Sichtbarkeit (SELECT)

| Akteur | Ressource | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| anon | `profiles_public` | sichtbar | `200 rows=3` ✅ |
| anon | `profiles` (volle Tabelle) | **deny** | `401` (keine Policy) ✅ |
| anon | `events` | nur `public` | `200 rows=1` ✅ |
| anon | `offers` | keine | `200 rows=0` ✅ |
| **Discover** | `profiles_public` | sieht Verzeichnis-„light" | `200 rows=3` ✅ |
| **Discover** | `profiles` (volle Tabelle) | **nur eigenes** = kein Verzeichnis | `200 rows=1` ✅ |
| **Discover** | `offers` (fremd) | keine | `200 rows=0` ✅ |
| **Discover** | `needs` (fremd) | keine | `200 rows=0` ✅ |
| **Discover** | `events` | nur `public` | `200 rows=1` ✅ |
| **Discover** | `posts` | `public`+`members` | `200 rows=2` ✅ |
| **Discover** | `profile_contacts` (fremd) | verborgen | `200 rows=0` ✅ |
| **Prime** | `profiles` (volle Tabelle) | **ganzes Verzeichnis** | `200 rows=3` ✅ |
| **Prime** | `offers` (fremd) | sichtbar | `200 rows=1` ✅ |
| **Prime** | `needs` (fremd) | sichtbar | `200 rows=1` ✅ |
| **Prime** | `posts` | bis `prime`, **nicht** `legacy` | `200 rows=3` ✅ |
| **Prime** | `events` | inkl. `prime` | `200 rows=2` ✅ |
| **Legacy** | `posts` | inkl. `legacy` | `200 rows=4` ✅ |

→ **Discover sieht öffentliche Inhalte, aber kein Verzeichnis** (volle `profiles`
nur die eigene Zeile) und keine fremden Offers/Needs — **per RLS, nicht UI.**
**Prime** sieht das volle Verzeichnis + Suche/Biete.

### 2.2 Kontakt- & Nachrichten-Flow (INSERT/UPDATE)

| # | Aktion | Erwartung | Ergebnis |
| --- | --- | --- | --- |
| 1 | **Discover** → `POST contact_requests` | **deny** (nicht Prime+) | `403` RLS-Verstoß ✅ |
| 2 | **Prime** → `POST messages` (vor `accepted`) | **deny** (Messages-Gate) | `403` RLS-Verstoß ✅ |
| 3 | **Prime** → `POST contact_requests` (an Legacy) | OK | `201` ✅ |
| 4 | **Discover** → `PATCH` fremde CR akzeptieren | **deny** (nicht Empfänger) | `0` Zeilen geändert ✅ |
| 5 | **Legacy** (Empfänger) → `PATCH status=accepted` | OK | `200` ✅ |
| 6 | **Prime** → `POST messages` (nach `accepted`) | OK | `201` ✅ |
| 7 | **Prime** → `GET profile_contacts` (Legacy, nach `accepted`) | jetzt sichtbar | `200 rows=1` ✅ |

→ **`messages`-INSERT scheitert ohne `accepted` contact_request und gelingt
danach** (Zeilen 2 → 6). **Kontaktdaten werden nie automatisch freigegeben**
(Zeile 7: erst nach expliziter Annahme lesbar). **Discover hat keine
Kontaktfunktion** (Zeile 1).

*RLS-Infrastruktur:* 33 Policies aktiv, RLS auf 19 Tabellen erzwungen
(`force row level security`), `profiles_public`-View für `anon`/`authenticated`.

---

## 3. Observability

| Check | Methode | Ergebnis |
| --- | --- | --- |
| **Sentry** Test-Fehler | Event `FoundationSmokeTest` an den (im Prod-Bundle eingebackenen) DSN gesendet | `200`; erscheint als Issue **[FBC-PLATFORM-3](https://factiv.sentry.io/issues/FBC-PLATFORM-3)** (Org `factiv`, EU-Region) ✅ |
| **Axiom** Test-Event | `POST https://fbc-platform.pages.dev/api/log` `{event:"login",props:{test:true}}` | `204` = Ingest von Axiom angenommen ✅ |

> *Hinweis Axiom:* Das Ingest-Token ist **write-only** und kann nicht abfragen;
> die Bestätigung erfolgt am Proxy-Rand (`204` = Axiom akzeptiert; ein ungültiges
> Token/Endpoint liefert laut `docs/observability.md` `502`). Die finale Sichtung
> der Zeile geschieht in der Axiom-Konsole (`['fbc-platform'] | where event=="login"`).
> Sentry ist im Prod-Bundle aktiv (DSN beim CI-Build inlined).

---

## 4. Deploy, Login/Redirect & CI

| Check | Ergebnis |
| --- | --- |
| `GET https://fbc-platform.pages.dev/` | `200`, `text/html`, `<title>Fair Business Club</title>` ✅ |
| Deep-Route `…/verzeichnis` (SPA-Fallback `_redirects`) | `200` ✅ |
| Logout → `…/verzeichnis` | Redirect auf `…/login` ✅ |
| Login (Prime, echtes Formular) | Session gesetzt (`prime@fbcdemo.com`), Redirect auf `/` (Feed) ✅ |
| Prime → `…/verzeichnis` | Zugriff (kein Redirect) ✅ |
| Login (Discover) → `…/verzeichnis` | **Redirect auf `/`** (Tier-Gate) ✅ |
| CI auf `main` (`CI`, `Deploy`, `pages-build-deployment`) | **alle grün** ✅ |
| Deployter Stand = `main` HEAD | `6e3c410` ✅ |

→ Das clientseitige Tier-Gating deckt sich mit der RLS-Schicht: Discover wird vom
Verzeichnis ausgeschlossen — sowohl im Router (Redirect) als auch in der DB (nur
eigene Profilzeile).

---

## 5. Offene Punkte / Risiken für W2 (Profil & Verzeichnis)

- ⏳ **Custom Domain `app.fairbusinessclub.de` steht noch aus.** Der Prototyp läuft
  auf der Default-Domain `https://fbc-platform.pages.dev`. Anbindung der eigenen
  Domain (CNAME/DNS, SSL, danach Supabase Site-URL/Redirects ergänzen) ist
  **durch fehlenden Domain-Zugang blockiert** → eigenes Follow-up-Issue, referenziert
  auf AGE-253.
- **AGE-233 (Supabase-Projekt & Umgebungen):** Kern erfüllt (Projekt EU/Frankfurt,
  Auth-Config, Secrets in Infisical). **Carry-over:** Storage-Bucket für Avatare
  wird mit dem Profil-Editor angelegt (**AGE-238**); nur `dev`/`prod`-Envs
  (kein `staging`, bewusst — siehe `docs/secrets.md`).
- **Avatar-Storage:** noch kein `storage`-Bucket vorhanden — Voraussetzung für den
  Avatar-Upload in AGE-238.
- ~~**Axiom Preview-Env:** `/api/log` ist auf Preview-Deploys ein No-op.~~
  **Erledigt durch ADR-0037:** der Endpunkt liest keine Secrets mehr und
  verhält sich in Preview, Produktion und lokal identisch.
- **`/api/log` ohne Rate-Limit:** nur Payload-Cap + Event-Allowlist; Abuse-Schutz
  (Turnstile/IP-Limit) vor öffentlichem Einsatz nötig.
- **Funnel-Events teils ungenutzt:** `match_suggested`, `contact_request_*`,
  `event_registered` sind typisiert, werden aber erst mit den Features W3/W4 gefeuert.
- **Test-Fixtures verbleiben** unter den drei Demo-Accounts in der Prod-DB (hinter
  RLS, unkritisch). Echte Demo-Daten/Personas sind separat als AGE-254 (W4) geplant.

---

## 6. Definition of Done — Status

- [x] `docs/foundation-acceptance.md` mit grünen Checks (Live-URL = `pages.dev`)
- [x] W1-Issues in Linear aktualisiert (AGE-232–237 → Done; W1 100 %)
- [x] AGE-253 Done (Deploy Default-Domain); Custom-Domain als Follow-up ausgelagert
- [x] Follow-up-Issue „Custom Domain `app.fairbusinessclub.de` anbinden" angelegt
      (blockiert durch Domain-Zugang, referenziert AGE-253)
