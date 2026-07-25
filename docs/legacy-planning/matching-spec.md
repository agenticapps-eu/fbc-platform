# Matching & Kontakt — FBC Platform (Phase 1, Woche 3)

> **Für Claude Code:** Verbindliche Spezifikation für Woche 3 — Issues **AGE-244** (Such-/Bieteprofil), **AGE-245** (Match-Engine + Score), **AGE-246** (Matching-Hub UI), **AGE-247** (Kontaktanfrage + E-Mail), **AGE-248** (Chat), **AGE-249** (FBC/DKRI-Routing).
> Baut auf vorhandenem Schema (`supabase/migrations/20260612065636_matching.sql`) und RLS (`docs/rls-policies.md`) auf. Look: **Schwarz & Gold** (`docs/design-system.md`).

**Kernprinzip (aus dem Konzept):** Matching ist das Herzstück, aber **regelbasiert** (KI später). **Kontaktdaten werden nie automatisch freigegeben** — immer erst Anfrage → Bestätigung → Chat. Größere Volumina werden zu **DKRI Deal Keeping** geroutet, kleinere bleiben bei **FBC Matching-Managern**.

---

## 1. Vorhandenes Schema (nicht neu anlegen)

Bereits vorhanden: `offers`, `needs` (mit `tx_volume_band`), `matches` (`score`, `basis jsonb`, `status` suggested/requested/accepted/declined, `routing` fbc/dkri, unique pair), `contact_requests` (from/to, `match_id`, `status` pending/accepted/declined, unique pair), `message_threads`, `messages`. RLS ist aktiv; insb. `messages`-INSERT nur bei akzeptiertem `contact_request`, `profile_contacts` nur nach Freigabe. W3 **nutzt** dieses Schema; neue Migrationen nur für Routing-Config & ggf. eine Manager-Queue.

---

## 2. Such-/Biete-Kategorien (AGE-244)

Lege eine konfigurierbare Kategorie-Liste an: `src/config/matching.ts` (Quelle für Editor, Icons, Komplementarität).

**Ich suche:** Investoren, Projekte, Immobilien, Partner, Experten, Kunden, Mitarbeiter, Mentoren
**Ich biete:** Kapital, Kontakte, Know-how, Immobilien, Beteiligungen, Leistungen, Mentoring

Jede Kategorie trägt: `key`, `label`, `theme` (sein/tun/haben/wirken), `icon`, `side` (need/offer).

**Komplementaritäts-Map** (need ↔ offer), als Konfiguration:
| Suche | passt zu Biete |
|---|---|
| Investoren | Kapital, Beteiligungen |
| Projekte | Kapital, Beteiligungen, Kontakte |
| Immobilien | Immobilien, Beteiligungen |
| Partner | Kontakte, Beteiligungen, Leistungen |
| Experten | Know-how, Leistungen |
| Kunden | Kontakte, Leistungen |
| Mitarbeiter | Kontakte |
| Mentoren | Mentoring, Know-how |

---

## 3. Score-Algorithmus (AGE-245)

Gewichteter Score 0–100 (Faktoren aus dem Konzept). Pro Faktor 0..1 normalisieren, dann gewichten:

| Faktor | Gewicht | Logik |
|---|---|---|
| Such-/Biete-Komplementarität | 35 % | A.needs ↔ B.offers laut Komplementaritäts-Map (Kategorie-Treffer); mehrere Treffer = höher |
| Themenbereich | 20 % | gleicher/komplementärer Lebensbereich (sein/tun/haben/wirken) |
| Branche | 15 % | exakter Treffer = 1, Nachbarbranche = 0,5 |
| Standort/Region | 15 % | gleiche Region = 1 (Start Stuttgart), sonst 0 |
| Interessen/Kompetenzen | 10 % | Tag-Überschneidung (Jaccard auf interests/competencies/tags) |
| Mitgliedsstufe | 5 % | passende Begegnungsebene (gleiche/benachbarte Stufe) |

`basis` (jsonb) speichert die Teilscores je Faktor → erklärbar im UI („warum dieses Match?").

---

## 4. Match-Engine (AGE-245)

Serverseitig, läuft mit erhöhten Rechten (umgeht RLS bewusst, da paarübergreifend).

**Empfohlene Umsetzung:** Postgres-Funktion `public.generate_matches_for(p_profile uuid)` (`security definer`, `set search_path = public`):
1. Kandidaten: Profile mit komplementären `offers` zu `p_profile`s `needs` (und umgekehrt), gleiche Region bevorzugt.
2. Score je Kandidat berechnen, `basis` füllen.
3. `insert ... on conflict (a_profile_id,b_profile_id) do update` (Paar normalisiert: kleinere uuid = a), nur wenn Score ≥ Schwelle (z. B. 40). `status` bleibt `suggested`, bis eine Kontaktanfrage daraus wird.
4. `routing` aus Volumen ableiten (siehe §8).

**Auslösung im Prototyp:** per RPC nach relevanten Änderungen (Onboarding-Abschluss, Speichern von offers/needs/Profil) sowie ein manueller „Matches neu berechnen"-Button. (Kein Cron nötig; optional später pg_cron.)

> Alternativ als Supabase Edge Function (Deno) — gleiche Logik, falls komplexere Berechnung gewünscht. Für Phase 1 reicht die SQL-Funktion.

---

## 5. Matching-Hub UI (AGE-246)

Route `/matching`, nur Prime+ (Gating vorhanden). Im Schwarz-&-Gold-Look.

- **Top-Matches** als Karten mit **Prozent-Score**, Kurz-Begründung aus `basis` („komplementär: Kapital ↔ Investoren · Region Stuttgart"), Tier-Badge, „Ich suche/biete"-Chips.
- Filter: Thema, Kategorie (suche/biete), Region, Mindest-Score.
- Aktion je Match: **„Kontaktanfrage senden"** (→ §6). Sekundär: Profil ansehen.
- Kennzahlen-Kopf (wie Dashboard): Aktive Matches, Erfolgreiche Matches, Ø-Score.
- Es ist eine **Chancen-Datenbank**, kein Kontaktverzeichnis — Suche/Biete steht im Vordergrund.

---

## 6. Kontaktanfrage-Flow (AGE-247)

Zustände `contact_requests.status`: `pending → accepted | declined`.

1. A sendet Anfrage (UI aus Matching-Hub oder Profilseite): `insert contact_requests(from_id=A, to_id=B, match_id, message)`. RLS: nur `from_id=self` **und** Prime+. `matches.status` → `requested`.
2. B sieht Anfrage unter „Meine Anfragen" (Dashboard) + Benachrichtigung; kann **annehmen/ablehnen** (RLS: nur `to_id` darf `status` ändern).
3. Bei `accepted`: `message_threads`-Eintrag anlegen (falls nicht vorhanden), `matches.status` → `accepted`. Erst jetzt sind `profile_contacts` (E-Mail/Telefon) für beide sichtbar (RLS bereits umgesetzt) und der Chat ist frei.
4. Bei `declined`: kein Thread, keine Kontaktdaten.

**Kontaktdaten niemals vor `accepted` anzeigen.** Das ist DB-seitig garantiert (RLS), das UI darf es nicht umgehen.

---

## 7. E-Mail-Benachrichtigungen (AGE-247)

Server-seitig, Token bleibt geheim.

- **Supabase Edge Function** `notify-contact-request` (Deno), ausgelöst per **Database Webhook** auf `contact_requests` (INSERT und UPDATE von status).
- Versand über **Resend** (`RESEND_API_KEY`). Funktions-Secrets aus Infisical setzen: `infisical run -- supabase secrets set RESEND_API_KEY=... FROM_EMAIL=...` (bzw. `supabase secrets set --env-file <(infisical export ...)`).
- E-Mail-Typen: „Neue Kontaktanfrage von {Name}", „Deine Anfrage wurde angenommen" (mit Link in den Chat), optional „abgelehnt".
- Absender-Domain/DKIM/SPF: noch zu klären (im Konzept als offener Punkt vermerkt) — vorerst eine verifizierte Resend-Testdomain nutzen, klar als Übergang markiert.
- Zusätzlich `notifications`-Zeile schreiben (In-App-Benachrichtigung).

---

## 8. FBC- vs. DKRI-Routing (AGE-249)

Volumen entscheidet, wer ein Match/eine Anfrage bearbeitet.

- **Schwelle (konfigurierbar):** `need.tx_volume_band` in (`1m_10m`, `gt_10m`) → `routing = 'dkri'`, sonst `'fbc'`. Lege die Schwelle als Konfiguration ab (DB-Setting oder `src/config/matching.ts`), damit sie ohne Codeänderung justierbar ist (mit Detlev final abzustimmen).
- `matches.routing` und – bei Bedarf – ein Flag auf `contact_requests` entsprechend setzen (Engine + bei Anfrage-Erstellung).
- **Kleine Matches (fbc):** laufen über den normalen Anfrage→Bestätigung-Flow (FBC Matching-Manager kann unterstützen).
- **Große Matches (dkri):** statt direkter Freigabe in eine **Manager-/Deal-Queue** legen (neue, schlanke Tabelle `routing_queue`: match_id, need_id, volume_band, routing, status `open/in_review/forwarded`, assigned_to). Im Prototyp: eine einfache, geschützte **Manager-Ansicht** (nur für Rolle „matching_manager"/„admin"), die diese Queue zeigt — der eigentliche DKRI-Deal-Workflow kommt später.
- Im Compass/Need-Formular das Volumen-Band abfragen (Bänder: `<10k`, `10k–100k`, `100k–1 Mio`, `1–10 Mio`, `>10 Mio`).

---

## 9. Chat (AGE-248)

- Realtime über Supabase Realtime auf `messages` (RLS gating: nur Thread-Teilnehmer; INSERT nur bei akzeptiertem `contact_request` — bereits umgesetzt).
- UI: Thread-Liste + Konversation, im Schwarz-&-Gold-Look; nur Prime+; nur für freigegebene Kontakte erreichbar.
- Optimistisches Senden, Lesezustände einfach halten (Phase 1: kein „gelesen"-Tracking nötig).

---

## 10. Definition of Done (Woche 3)

- Mitglieder pflegen Such-/Bieteprofile (Kategorien konfigurierbar).
- Match-Engine erzeugt nachvollziehbare `matches` mit `score` + `basis`; Neuberechnung per RPC/Button.
- Matching-Hub zeigt Top-Matches mit Prozent-Score & Begründung (Prime+).
- Kontaktanfrage-Flow funktioniert: pending→accepted schaltet Chat + Kontaktdaten frei; declined nicht. **Keine Kontaktdaten vor accepted** (RLS-verifiziert).
- E-Mail-Benachrichtigung (Resend via Edge Function) wird bei Anfrage/Annahme versendet; Secrets aus Infisical.
- Volumen-Routing fbc/dkri gesetzt; große Volumina landen in der Manager-Queue.
- Realtime-Chat zwischen freigegebenen Kontakten.
- pgTAP-/SQL-Tests für Score-Funktion und Kontakt-/Chat-Gating grün.
- Commits referenzieren AGE-244 … AGE-249.

---

_Gehört zu den Issues **AGE-244…AGE-249** im Linear-Projekt „FBC Plattform – Prototyp (Phase 1)"._
