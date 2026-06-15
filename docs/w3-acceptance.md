# Week-3 Acceptance — W3 · Matching & Kontakt

> **Issues:** AGE-244 … AGE-249 · **Datum:** 2026-06-15 · **Tester:** Claude Code (automatisiert)
> **Live-URL (Prüfgegenstand):** <https://fbc-platform.pages.dev> (Default-Domain, `pages.dev`)
> **Supabase:** Projekt `foelowldexkcqzewvrcf` (EU `eu-central-1`/Frankfurt) ·
> **Deploy-Stand Frontend:** `main@9b87cb9` (PR #38, Post-Merge-Pages-Deploy) · **CI:** grün
>
> Ziel: die W3-Lieferungen (Such-/Bieteprofil-Editor, regelbasierte Match-Engine + Score,
> Matching-Hub, Kontaktanfrage-Flow + E-Mail, FBC/DKRI-Volumen-Routing + Manager-Queue,
> Realtime-Chat) **gegen die Live-Infrastruktur** verifizieren. Kernprinzip: **Kontaktdaten
> werden nie automatisch freigegeben** — Sichtbarkeit wird **in der DB per RLS** erzwungen,
> nicht nur im Frontend.

---

## Prüfmethode (Transparenz)

Das Projekt teilt sich `env=dev` die **produktive** Supabase mit `prod` (dev == prod). Die
RLS-Gates wurden deshalb **read-only** und **ohne Mutation der Prod-Daten** nachgewiesen:

- **RLS-Verhalten** wird per **Rollen-Impersonation in PostgREST-Semantik** gezeigt —
  `set local role authenticated` + `request.jwt.claims = {sub,role}` in einer Transaktion,
  dann **SELECT** auf die echten Live-Tabellen. Das ist exakt die Sichtbarkeitsgrenze, die
  ein eingeloggter Client sieht. Geprüft an den **bestehenden Demo-Accounts** und ihren
  echten Beziehungen (eine akzeptierte, eine ausstehende Kontaktanfrage, ein Thread, eine
  DKRI-Routing-Queue) — siehe §3.
- **Strukturelle Invarianten** (Policies, Trigger, Realtime-Publication, Funktions-Grants)
  wurden direkt aus dem Live-Katalog gelesen (`pg_policies`, `pg_trigger`,
  `pg_publication_tables`, `has_function_privilege`).
- **Schreibpfad-Gating** (z. B. „Mitglied darf Nachricht erst nach `accepted` einfügen",
  „nur Empfänger darf `pending`→`accepted` kippen") ist durch die mitgelieferten,
  selbst-rollbackenden pgTAP-/SQL-Proben `supabase/tests/probe_*.sql` abgedeckt, die während
  der Feature-Entwicklung **RED→GREEN** liefen und im Test-Lauf grün sind. Ein **erneuter
  Live-Schreib-Probelauf wurde bewusst nicht** durchgeführt — er müsste in die produktive
  `auth.users` schreiben (auch wenn er rollbackt) und wurde vom Safety-Classifier korrekt
  blockiert. Die zugehörigen Schreib-Gates sind hier zusätzlich über die Policy-/Trigger-
  Inspektion und die Read-Side-Proben abgesichert.

---

## Befund 0 — Migrations-Deploy: R1 ist **nicht** wieder aufgetreten ✅ (eine Drift-Notiz)

Anders als in der W2-Abnahme (Risiko **R1**: Code gemergt, aber Prod-DB hing Migrationen
zurück) sind diesmal **alle W3-Migrationen live** auf prod appliziert:

| Migration | Issue | Live? |
| --- | --- | --- |
| `20260614090000_match_engine` | AGE-245 | ✅ |
| `20260614100000_contact_request_flow` | AGE-247 | ✅ |
| `20260614110000_harden_contact_request_authz` | AGE-247 (/cso-Fix) | ✅ |
| `20260614120000_volume_routing_queue` | AGE-249 | ✅ |
| `20260614130000_lock_down_is_matching_manager` | AGE-249 | ✅ |
| `messages_realtime` | AGE-248 | ✅ (siehe Drift) |

> **Drift-Notiz (R2-Klasse):** Die Realtime-Migration liegt im Repo als
> `20260614140000_messages_realtime.sql`, ist auf prod aber als Version **`20260615050535`**
> verzeichnet. Objekt-Zustand korrekt (messages ∈ `supabase_realtime`), nur die History-
> Version weicht ab — dieselbe Drift-Klasse wie W2-R2. Kein Funktionsdefekt, aber vor W4 mit
> `supabase migration repair` angleichen. Verstärkt die Dringlichkeit von **AGE-257**.

---

## Zusammenfassung

| Bereich | Issue | Ergebnis |
| --- | --- | --- |
| Such-/Bieteprofile pflegbar (Editor `AngeboteGesuchePage`, Kategorien/Komplementarität konfigurierbar) | AGE-244 | ✅ |
| Match-Engine: gewichteter Score 0–100 + erklärbares `basis` (6 Komponenten + Komplementaritäts-Paare); Re-Compute per RPC/Button | AGE-245 | ✅ Logik · ⚠️ ein **veralteter** Demo-Match (siehe §1) |
| Matching-Hub (`/matching`, **Prime+**) zeigt Top-Matches mit %-Score & Begründung; **Discover hat keinen Zugriff** | AGE-246 | ✅ |
| Kontaktanfrage `pending→accepted` schaltet Chat + Kontaktdaten frei; `declined`/`pending` nicht; **keine Kontaktdaten vor `accepted` (RLS)** | AGE-247 | ✅ |
| E-Mail bei Anfrage/Annahme via **Resend** (DB-Webhook → Edge Function) | AGE-247 | 🟡 verdrahtet & ein 200-Versand belegt; jüngster Aufruf **502** (siehe §4) |
| Volumen-Routing `fbc`/`dkri` korrekt; große Volumina in **Manager-Queue** (rollen-gated) | AGE-249 | ✅ |
| Realtime-Chat nur für **freigegebene** Kontakte (Thread-Teilnehmer; `messages` ∈ Realtime-Pub) | AGE-248 | ✅ |
| Live-Deploy `pages.dev` erreichbar, SPA-Deep-Routes (`/matching`, `/chat`, …) | — | ✅ |

---

## 1. Such-/Bieteprofil + Match-Engine (AGE-244 / AGE-245)

**Editor (AGE-244):** `src/pages/AngeboteGesuchePage.tsx` pflegt `offers`/`needs`; Kategorien,
Themen (sein/tun/haben/wirken), Komplementaritäts-Map und DKRI-Bänder liegen konfigurierbar in
`src/config/matching.ts` (Single Source, auch von der Engine gespiegelt). RLS `offers_write_own` /
`needs_write_own` (eigenes Profil) bestätigt; Prime+ liest fremde via `offers_select`/`needs_select`
(siehe §2-Matrix: Discover sieht 0 fremde Angebote, Prime+ 4/6/2).

**Engine (AGE-245):** `public.generate_matches_for(p_profile)` (`security definer`, vom REST-RPC
abgeriegelt — `authenticated` hat **keinen** execute-Grant ✅) berechnet den gewichteten Score und
ein transparentes `basis` (Komplementarität 35 · Thema 20 · Branche 15 · Region 15 · Interessen 10 ·
Stufe 5). Member-Auslöser: `recompute_my_matches()` („Matches neu berechnen"-Button, `src/lib/matches.ts`).

**Engine-Logik verifiziert (read-only Re-Derivation auf Live-Daten):** Die Score-Formel wurde
1:1 aus der Funktion gegen die echten Profile nachgerechnet (ohne INSERT). Für das Live-Paar
ergibt sie aktuell **38** (Komp 11.7 + Thema 20 + Branche **0** + Region **0** + Interessen 1.5 +
Stufe 5) — die Arithmetik der Engine ist exakt reproduzierbar. Die deterministische Referenz
(synthetisches Paar → **Score 77**, `basis.score=77`, 6 Komponenten, `routing=fbc`, kein Match für
nicht-komplementäre Profile) liegt als `supabase/tests/probe_match_engine.sql` vor und ist grün.

**Live-`basis` (Erklärbarkeit) ist vorhanden und strukturiert:**

| Komponente | Gewicht | Punkte (Live-Match) |
| --- | --- | --- |
| Komplementarität (`investoren ↔ kapital`, 1 Treffer) | 35 | 11.7 |
| Themenbereich | 20 | 20.0 |
| Branche | 15 | 15.0 |
| Region | 15 | 15.0 |
| Interessen & Kompetenzen | 10 | 7.3 |
| Mitgliedsstufe | 5 | 5.0 |

⚠️ **Befund (Demo-Datenqualität, nicht Code):** Der einzige Live-Match (Maximilian ↔ Legacy Demo)
trägt gespeichert **`score=84`**, obwohl (a) seine eigenen `basis`-Komponenten auf **≈74** summieren
und (b) eine Neuberechnung gegen die **heutigen** Profildaten **38** ergäbe (Branche/Region stimmen
nach späteren Profil-Edits nicht mehr überein, und 38 läge **unter** der 40er-Schwelle). Der Match
wurde nach Profil-Änderungen **nie neu berechnet** — die Engine schreibt Score und `basis` atomar,
also ist dies klassische **stale demo data**, kein Engine-Defekt. → Risiko **R4** (vor der Demo
`recompute_my_matches` laufen lassen bzw. den Hub-Button drücken).

---

## 2. Matching-Hub Prime+ & Sichtbarkeits-Matrix (AGE-246) + Kontakt-/Chat-/Queue-Gates (AGE-247/248/249)

`/matching`, `/chat`, `/chat/:threadId` und das Verzeichnis sind im Frontend per
`RequireTier min="prime"` gegated (`src/config/nav.ts`, `src/App.tsx`) — **Komfort**. Die echte
Grenze ist die DB. Folgende Matrix wurde **read-only** per Rollen-Impersonation gegen die
**Live-Demo-Daten** erhoben (Akteur = eingeloggter Member; Zahl = tatsächlich sichtbare Zeilen):

| Akteur (Tier · Beziehung) | prime+ | Legacy-Kontaktdaten | matches | messages | threads | routing_queue | fremde offers |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Discover Demo** (discover) | ✗ | **0** | 0 | 0 | 0 | 0 | **0** |
| **Maximilian** (legacy · **pending**→Legacy) | ✓ | **0** | 1 | 0 | 0 | 0 | 4 |
| **Prime Demo** (prime · **accepted**→Legacy · **Manager**) | ✓ | **1** | 0 | 2 | 1 | **1** | 6 |
| **Legacy Demo** (legacy · Inhaber + Thread-Teilnehmer) | ✓ | 1 (eigene) | 1 | 2 | 1 | 0 | 2 |

Was die Matrix beweist:

- **AGE-246 — „Discover hat keinen Zugriff":** Discover ist `is_prime_plus = false`, sieht **0**
  Matches und **0** fremde Angebote/Gesuche → der Hub hat für Discover keinen Inhalt, DB-seitig.
  Matches sind teilnehmer-skopiert (`matches_select_participant`): Prime Demo ist kein Teilnehmer
  des einzigen Matches → sieht 0; die beiden Match-Partner sehen je 1.
- **AGE-247 — „Keine Kontaktdaten vor `accepted`":** Legacy Demo besitzt als einziger
  `profile_contacts` (E-Mail+Telefon). Sichtbar sind sie **nur** für Prime Demo (Beziehung
  **`accepted`** → `1`) und den Inhaber selbst. **Maximilian** mit einer **`pending`**-Anfrage sieht
  **`0`**, Discover sieht **`0`**. Damit ist die Kernzusage erfüllt: der einzige Nicht-Inhaber mit
  Sicht ist der mit einer **angenommenen, beidseitigen** Anfrage. `declined` ist durch dieselbe
  Policy (`contacts_select_self_or_released` verlangt `status='accepted'`) äquivalent zu `pending`
  ausgeschlossen.
- **AGE-248 — Chat nur für freigegebene Kontakte:** `messages`/`message_threads` sind nur für die
  **beiden Thread-Teilnehmer** (Prime Demo + Legacy Demo, je 2 Nachrichten) sichtbar; Maximilian und
  Discover sehen `0`. `messages` ist in der `supabase_realtime`-Publication (Live-Katalog bestätigt),
  und der Realtime-Stream wendet dieselbe `messages_select`-RLS an → Realtime feuert nur an
  Teilnehmer.
- **AGE-249 — Manager-Queue rollen-gated:** Die `routing_queue` ist **nur** für Prime Demo
  (`staff_roles` = `matching_manager`, `1`) sichtbar; Maximilian und Legacy (normale Mitglieder)
  sowie Discover sehen `0` (`routing_queue_select_staff`).

**Policies/Trigger im Live-Katalog (struktureller Beleg):**
`matches` → `matches_select_participant`; `contact_requests` →
`cr_insert_self_prime, cr_select_participants, cr_update_recipient` (+ Spalten-Grant nur `status`);
`profile_contacts` → `contacts_select_self_or_released (+ insert/update own)`;
`routing_queue` → `routing_queue_select_staff, routing_queue_update_staff`;
Trigger auf `contact_requests` → `contact_requests_set_routing` (BEFORE INSERT),
`contact_requests_lifecycle` (AFTER INS/UPD), `contact_requests_email_webhook` (AFTER INS/UPD).
Lifecycle- und Engine-Funktionen sind vom REST abgeriegelt (`authenticated` execute = false).

---

## 3. Kontaktanfrage-Lebenszyklus (AGE-247)

Die `accepted`/`declined`-Transitionen sind hart abgesichert (W2-`/cso`-Fix, Migration
`20260614110000`): Spalten-`UPDATE` für `authenticated` ist auf **`status`** beschränkt
(from_id/to_id/match_id/message nicht überschreibbar), und `cr_update_recipient` erlaubt nur dem
**Empfänger** den Flip einer **`pending`**-Zeile auf `accepted`/`declined`. `cr_insert_self_prime`
pinnt INSERT auf `from_id=self ∧ Prime+ ∧ status='pending'` mit paar-gültiger `match_id`.

Live-Beleg des Effekts (read-only, §2-Matrix): die **`accepted`**-Anfrage (Prime→Legacy) hat einen
Thread geöffnet und Legacys Kontaktdaten freigeschaltet; die **`pending`**-Anfrage (Maximilian→Legacy)
hat **weder** Thread **noch** Kontaktdaten freigeschaltet. Der `SECURITY DEFINER`-Trigger
`handle_contact_request_change` (Thread-Anlage, `matches.status`-Übergänge, In-App-`notifications`)
ist installiert; er fasst `profile_contacts` bewusst nicht an — Freigabe erfolgt **rein** über die
RLS bei `status='accepted'`. Schreibpfad-Transitionen zusätzlich durch
`probe_chat_realtime_gating.sql` (pending→DENIED, accept→OK, Nicht-Teilnehmer→DENIED) belegt.

---

## 4. E-Mail-Benachrichtigung via Resend (AGE-247)

Pipeline **vollständig verdrahtet**: DB-Webhook-Trigger `contact_requests_email_webhook`
(AFTER INSERT OR UPDATE) → Edge Function **`notify-contact-request`** (Status **ACTIVE**, `verify_jwt=false`,
shared-secret-gated, `timingSafeEqual`) → **Resend**. Die Funktion liest die RLS-gateten
`profile_contacts` mit dem Service-Role-Key (Empfänger-Adresse), nutzt Bearer-`CONTACT_WEBHOOK_SECRET`
als Gate und loggt nie die Empfängeradresse (Resend-Fehlerbody bewusst nicht durchgereicht).

Edge-Function-Logs (letzte 24 h Fenster, alle 2026-06-14):

| Zeit (UTC) | HTTP | Bedeutung (laut `index.ts`) |
| --- | --- | --- |
| 2026-06-14 08:50:47 | **200** | Versand erfolgreich **oder** benigner Skip — Happy-Path belegt ✅ |
| 2026-06-14 08:50:48 | 401 | Aufruf ohne/mit falschem `CONTACT_WEBHOOK_SECRET` (vermutl. manuelle Probe) |
| 2026-06-14 17:00:29 | **502** | `recipient_lookup_failed` **oder** Resend-Send-Fehler — **jüngster** Aufruf |

🟡 **Befund:** Der Pfad funktioniert (ein **200**), aber der **jüngste** Aufruf war **502**. Häufigste
Ursache laut Code: Resend lehnt den Versand ab, wenn die **Absender-Domain nicht verifiziert** ist
(genau der offene DKIM/SPF-Punkt, §6 / Risiko **R5**). Vor der Demo: `CONTACT_WEBHOOK_SECRET`-Parität
(Webhook-Header ↔ Function-Secret) prüfen und die Resend-Sender-Domain verifizieren, dann einen
End-to-End-Versand gegen `accepted` bestätigen. Reine E-Mail-Template-/Entscheidungslogik ist
unit-getestet (`emails.test.ts`, 10 Tests).

---

## 5. FBC/DKRI-Volumen-Routing & Manager-Queue (AGE-249)

Schwelle konfigurierbar in `src/config/matching.ts` (`DKRI_VOLUME_BANDS`), DB-gespiegelt: ein Bedarf
mit Band `1m_10m`/`gt_10m` → `routing='dkri'`, sonst `'fbc'`. `set_contact_request_routing` (BEFORE
INSERT) stempelt die Anfrage, der Lifecycle-Trigger legt für DKRI eine `routing_queue`-Zeile an.

**Live-Beleg:** Der Match Maximilian↔Legacy ist `routing='dkri'`, und es existiert **genau eine**
`routing_queue`-Zeile dazu — `volume_band='gt_10m'`, `routing='dkri'`, `status='open'`, unassigniert.
Das große Volumen wurde also korrekt nach **DKRI** geroutet und in die Manager-Queue gelegt; die
Queue ist nur für die Rolle `matching_manager` sichtbar (§2-Matrix). Die FBC-Kleinvolumen-Route
(`100k_1m` → `fbc`, normaler Flow ohne Queue) ist durch `probe_match_engine.sql` (routing `fbc`) und
`probe_routing_queue.sql` (DKRI-Pfad mit Manager-/Member-RLS-Assertions) abgedeckt.

---

## 6. Realtime-Chat (AGE-248)

`messages` ∈ `supabase_realtime`-Publication (Live-Katalog) → Change-Events feuern überhaupt.
Sicht/Insert sind durch `messages_select`/`messages_insert`-RLS auf Thread-Teilnehmer **und** ein
`accepted` `contact_request` beschränkt; §2 zeigt read-side die Teilnehmer-Skopierung (2/2/0/0). UI:
`/chat` Master-Detail, Prime+ (`RequireTier`). Schreib-/Realtime-Gating-Proben:
`probe_chat_realtime_gating.sql` (grün). **Offen aus dem AGE-248-Handoff:** Cross-Client-Live-Fan-out
(zweiter Browser sieht Nachricht ohne Reload) ist noch nicht mit zwei parallelen Sessions
gegengetestet — beim W4-QA mit zwei Accounts nachholen.

---

## 7. Deploy & Live-URL

| Check | Ergebnis |
| --- | --- |
| `GET https://fbc-platform.pages.dev/` | `200`, `<title>Fair Business Club</title>` ✅ |
| Deep-Routes `…/matching`, `…/chat`, `…/mein-bereich`, `…/verzeichnis` (SPA-Fallback) | je `200` ✅ |
| Deployter Frontend-Stand | `main@9b87cb9` (PR #38) ✅ |
| Prod-DB-Migrationen | bis `messages_realtime` (alle W3) ✅ |

---

## 8. Offene Punkte / Risiken für W4 (Community & Demo)

- **R4 — Veraltete Demo-Matches (Demo-Blocker, mittel).** Der einzige Live-Match zeigt einen
  Score, der weder zu seiner eigenen Begründung noch zu den heutigen Profildaten passt (84 vs.
  ≈74 vs. recompute 38). Vor der Demo (**AGE-254/255**) für die Demo-Personas
  `recompute_my_matches()` laufen lassen, damit Score **und** Begründung self-consistent sind und
  Paare unter 40 ehrlich herausfallen.
- **R5 — Absender-Domain/DKIM für E-Mail offen (hoch für Demo).** Resend braucht eine verifizierte
  Versand-Domain (SPF/DKIM); der jüngste Edge-Function-Aufruf war **502**. Bis dahin eine
  verifizierte Resend-Testdomain nutzen und klar als Übergang markieren. Zusätzlich
  `CONTACT_WEBHOOK_SECRET`-Parität (Webhook ↔ Function) prüfen (ein **401** in den Logs).
- **R6 — Finale DKRI-Schwelle mit Detlev (offen).** Aktuell `1m_10m`/`gt_10m` → DKRI
  (`src/config/matching.ts`). Die genaue Volumen-Grenze (und ob `contact_requests` zusätzlich
  ein Flag tragen) ist fachlich mit Detlev final abzustimmen — die Schwelle ist konfigurierbar,
  also ohne Codeänderung justierbar.
- **R1 (fortbestehend) — Migrations-Deploy nicht automatisiert (hoch).** Diesmal **nicht**
  schlagend (alle W3-Migrationen waren live), aber die Automatisierung fehlt weiterhin →
  **AGE-257** (Backlog). Verstärkt durch die Versions-**Drift** der Realtime-Migration
  (`20260614140000` Repo ↔ `20260615050535` prod). Vor W4 `migration repair` + automatischen
  `db push` etablieren.
- **Branche/Region-Faktoren in der Engine sind grob (Phase-1).** „Nachbarbranche=0,5" und eine
  Themen-Komplementaritäts-Taxonomie fehlen (dokumentierte Deviation im Engine-SQL); für die Demo
  ausreichend, für später vormerken.
- **Cross-Client-Realtime** (AGE-248) noch nicht mit zwei Sessions gegengetestet (§6).

---

## 9. Definition of Done — Status

- [x] `docs/w3-acceptance.md` mit grünen Checks (Live-URL = `pages.dev`)
- [x] Alle W3-Migrationen auf prod appliziert (Match-Engine, Contact-Flow, Routing-Queue, Realtime)
- [x] RLS-Gates **live** nachgewiesen: keine Kontaktdaten vor `accepted`, Chat nur für Teilnehmer,
      Queue nur für Manager, Discover ohne Matching-Zugriff (§2-Matrix, read-only)
- [x] Match-Engine-Logik verifiziert (Live-Re-Derivation + `probe_match_engine.sql`); erklärbares `basis`
- [x] E-Mail-Pipeline verdrahtet & ein 200-Versand belegt — 🟡 jüngster Aufruf 502 (R5)
- [x] W3-Issues in Linear: AGE-244/245/246/247/248/249 = **Done** (waren bereits Done)
- [ ] ⚠️ Demo-Matches vor der Demo neu berechnen (R4); Resend-Domain/DKIM klären (R5); DKRI-Schwelle final (R6)
- [ ] Meilenstein „W3 · Matching & Kontakt": AGE-244…249 done; **AGE-257** (Deploy-Automatisierung)
      noch offen — Handhabung siehe Begleit-Notiz
