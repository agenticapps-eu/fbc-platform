# Spec — Stripe Test-Mode Upgrade-Flow (§3.1–3.4)

**Repo:** `fbc-platform` · **Linear:** AGE-259 · **Datum:** 2026-07-16 · **Auftraggeber:** Donald
**Quelle:** `docs/superpowers/specs/2026-07-15-fbc-6level-upgrade.md` §3.1–3.4
**Kontext:** Prototyp-Präsentation (Sommerfest). Upgrade-Wege **zeigbar** machen — Stripe
**Test-Mode**, keine echte Zahlung. §3.5 (QM-Feedback) ist bereits gebaut und live (AGE-300/AGE-358);
§1a (Key-Migration) + §2 (Rechte-Matrix als RLS) sind bereits gebaut
(`20260715150000_six_level_model.sql`). Dieser Spec baut den fehlenden Rest: §3.1–3.4.

---

## 1. Ausgangslage (was schon existiert)

- **`membership_tiers`** (key, label, price_year, level_rank) + **`profiles.tier`** (Default `basic`).
- **`has_level(min_rank)`** + die volle §2-Rechte-Matrix als RLS-Policies. Nach einem Tier-Wechsel
  greifen die Rechte automatisch — das ist der „Wow"-Moment (§3.3).
- **`src/config/levels.ts`** — Labels + Preise (Display), **ohne** Stripe-Preis-IDs.
- **`profiles`** hat spaltenweise Grants: `grant update (headline, roles, dev_focus)` nach einem
  `revoke update … from authenticated`. `tier` ist **nicht** dabei → der Client kann `tier` nicht
  schreiben (§3.3-Akzeptanz „level clientseitig nicht schreibbar" gilt bereits by construction).
- **Edge-Function-Muster** zum Kopieren: `supabase/functions/notify-contact-request/`
  (Deno, `verify_jwt=false`, Shared-Secret, Service-Role-Client, `emails.test.ts`).

---

## 2. Entscheidungen (Donald, 2026-07-16)

- **D1 — Preis-IDs server-seitig, nicht im Client-Config.** Der Client erstellt die Checkout-Session
  **nie** selbst; das macht die Edge-Function. Die Preis-IDs gehören daher neben den Secret-Key in
  die Edge-Function-Env (`STRIPE_PRICE_DISCOVER/EXCHANGE/FOCUS/IMPACT` via Infisical). `levels.ts`
  bleibt Display-only. Weicht bewusst von §3.1s Wortlaut ab (Preis-IDs „in levels.ts") — Grund:
  ein Stripe-Config-Ort server-seitig, nichts Stripe-bezogenes im Client-Bundle.
- **D2 — `mode: 'subscription'` mit Jahres- UND Monatsoption.** Jede zahlende Stufe hat zwei
  wiederkehrende Preise: **jährlich** und **monatlich**. Der Checkout läuft im Subscription-Mode;
  der Pricing-Screen trägt einen **Jahr/Monat-Toggle**. **Konsequenz für die Produkt-Anlage:**
  4 Test-Produkte, jedes mit einem **jährlichen** UND einem **monatlichen** wiederkehrenden Preis
  → **8 Preis-IDs**. Jahrespreise: 150/300/600/1.200 €. Monatspreise legt Donald bei der
  Produkt-Anlage fest und spiegelt sie zur Anzeige in `levels.ts` (`priceMonth`).
  §4 schließt weiterhin **Renewal-/Cancellation-Handling, Proration und Downgrade** aus: der Tier
  wird nur beim `checkout.session.completed` gesetzt; Verlängerungs-/Kündigungs-Events verarbeitet
  diese Woche kein Webhook.
- **Onboarding minimal (§3.4).** Kein neuer Signup-Schritt. Neue Profile starten schon auf `basic`;
  es genügt, dass Signup aufs Dashboard führt und der Pricing-Screen erreichbar ist.
- **Nur Upgrade diese Woche.** Kein Downgrade in der UI; die `apply_upgrade`-RPC setzt `tier` nur,
  wenn der Ziel-Rang **höher** ist — das macht den Webhook idempotent und immun gegen ein
  wiederholtes/verspätetes tieferes Event.

---

## 3. Komponenten

### 3.1 Config (§3.1)
- `src/config/levels.ts` bleibt Display-only für **Beträge** — **keine** Stripe-Preis-IDs. Ergänzt
  wird ein `priceMonth`-Feld (Anzeige der Monatsoption neben `priceYear`).
- Die (Level, Interval)→Preis-ID-Map lebt in der Edge-Function `create-checkout-session`, gelesen
  aus Env (8 Einträge).
- **Akzeptanz:** kein Stripe-Key/keine Preis-ID im Client-Bundle; Test-Keys via Infisical.

### 3.2 Edge Function `create-checkout-session`
- `verify_jwt = true` (trägt das User-JWT). Liest den Aufrufer aus dem JWT.
- Input: `{ level: MembershipLevel, interval: 'month' | 'year' }`.
- Validiert: `level` ist eine **zahlende** Stufe (`discover|exchange|focus|impact`) **und** ein
  **Upgrade** über die aktuelle Stufe des Aufrufers; `interval` ist `month|year`. Ablehnung bei
  `basic`/`connect`, unbekanntem Level, ungültigem Interval oder Downgrade/Gleichstand.
- Mappt (`level`, `interval`) → Preis-ID (Env). Erstellt Checkout-Session:
  `mode: 'subscription'`, `line_items: [{ price, quantity: 1 }]`,
  `metadata: { user_id, level }`, `client_reference_id: user_id`,
  `success_url`/`cancel_url` → zurück zum Pricing-Screen mit Status-Param.
- Rückgabe: `{ url }`.

### 3.3 Edge Function `stripe-webhook`
- `verify_jwt = false` (Stripe trägt kein User-JWT) — in `config.toml` registriert wie
  `notify-contact-request`.
- Verifiziert die Stripe-Signatur (`stripe-signature`-Header + **Raw Body**,
  `STRIPE_WEBHOOK_SECRET`, `constructEventAsync`).
- Bei `checkout.session.completed`: liest `metadata.user_id` + `metadata.level`, ruft
  `apply_upgrade(user_id, level)` per Service-Role. Andere Event-Typen → 200 (ignoriert).
- **Idempotent** über `apply_upgrade` (nur-höher). Signatur-Fehler → 400 (nie verarbeiten).
  `apply_upgrade`-Fehler → 500 (Stripe retryt; sicher, weil idempotent).

### 3.4 DB — `apply_upgrade` RPC (neue Migration)
```
create function public.apply_upgrade(p_user_id uuid, p_level text) returns text
  language plpgsql security definer set search_path = ''
```
- Prüft, dass `p_level` in `membership_tiers` existiert (sonst `raise exception`).
- Setzt `profiles.tier = p_level` **nur wenn** der Ziel-`level_rank` **größer** ist als der aktuelle
  (nur-Upgrade → idempotent + downgrade-sicher). Gibt den effektiven Tier zurück.
- **Service-Role-only:** `revoke execute … from public, anon, authenticated;`
  `grant execute … to service_role;`
- Testbar in pgTAP. Der Webhook bleibt ein dünner Adapter; die Upgrade-Regel lebt in der DB.

### 3.5 Pricing-Screen (§3.2)
- Neue Route (Konvention aus `nav.ts`/`App.tsx` übernehmen).
- 6 Karten aus `LEVEL_ORDER`. Aktuelles Level (aus `AuthProvider`) hervorgehoben.
- **Jahr/Monat-Toggle** oben; die Karten zeigen den Betrag des gewählten Intervals
  (`priceYear`/`priceMonth`).
- „Upgrade"-Button **nur** auf höheren **zahlenden** Stufen; aktuelles + niedrigere ohne
  Upgrade-Button (keine Downgrade-Optik). `basic`/`connect` tragen keinen Upgrade-Button.
- Sichtbarer **„Testzahlung · Demo"**-Hinweis auf jeder Bezahlaktion.
- Klick → `supabase.functions.invoke('create-checkout-session', { level, interval })` → Redirect
  auf `url`.
- Rückkehr auf `success_url`: Toast + Tier-Refetch.

### 3.6 Onboarding (§3.4)
- Kein neuer Komponenten-Schritt. Sicherstellen: Signup führt aufs Dashboard, Pricing-Screen ist
  erreichbar (Nav-/Dashboard-Link). Bestehenden Signup-Redirect beim Planen verifizieren.

---

## 4. Datenfluss (Happy Path)
1. User auf Pricing-Screen (Toggle z. B. auf „Jahr") klickt „Upgrade auf Exchange".
2. Client → `create-checkout-session` (JWT) `{ level: 'exchange', interval: 'year' }`.
3. Edge-Fn validiert (zahlend + Upgrade + Interval), erstellt Subscription-Session
   (`metadata` uid+level — Interval fließt NICHT in den Tier ein), gibt `url` zurück.
4. Client-Redirect → Stripe Checkout; Testkarte `4242…`; Stripe-Redirect → `success_url`.
5. Stripe → `stripe-webhook` mit `checkout.session.completed`.
6. Webhook verifiziert Signatur, ruft `apply_upgrade(uid, 'exchange')` per Service-Role →
   `profiles.tier = 'exchange'`.
7. Nächster Datenabruf / `AuthProvider`-Refresh → `has_level(4)` ist jetzt true → zuvor gesperrter
   Inhalt (Kontaktanfragen, Events, Aktivität) sichtbar. **Wow-Moment.**

---

## 5. Error Handling
- `create-checkout-session`: 401 (kein JWT); 400 (ungültiges/freies/unbekanntes Level oder
  Downgrade); 500 (Stripe-Fehler, geloggt ohne Secret-Leak).
- `stripe-webhook`: 400 (Signatur ungültig — nie unverifiziert verarbeiten); 200 (verarbeitet +
  ignoriert); 500 bei `apply_upgrade`-Fehler (Stripe retryt, idempotent).
- Client: Upgrade-Button zeigt Error-Toast bei Session-Erstellungs-Fehler.

---

## 6. Secrets (Infisical → `supabase secrets`, in `docs/secrets.md` dokumentieren)
- `STRIPE_SECRET_KEY` (Test), `STRIPE_WEBHOOK_SECRET`, und **8 Preis-IDs** —
  `STRIPE_PRICE_{DISCOVER,EXCHANGE,FOCUS,IMPACT}_{YEAR,MONTH}`.
- Plattform-injiziert: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **Kein neues Client-Env** — der Client ruft die Function via `supabase.functions.invoke` mit der
  bestehenden Session.

---

## 7. Test-Strategie
- **pgTAP** (`rls_test.sql`): `apply_upgrade` upgradet / no-op bei Gleichstand-oder-tiefer / lehnt
  unbekanntes Level ab / ist service-role-only; `authenticated` kann `profiles.tier` **nicht** per
  UPDATE setzen (Spalten-Grant-Beweis).
- **Edge-Fn (Deno, Stil `emails.test.ts`):** Level-, Interval- + Downgrade-Validierung in
  `create-checkout-session` (inkl. (level,interval)→Preis-ID-Mapping); Signatur-Verifikation
  (gültig/ungültig) + `metadata`→`apply_upgrade`-Dispatch im Webhook (Stripe + supabase gemockt).
- **Frontend (vitest):** 6 Karten, korrekte Hervorhebung, Jahr/Monat-Toggle schaltet die Beträge,
  Upgrade nur auf höheren zahlenden Stufen, „Testzahlung · Demo" vorhanden, Klick ruft die Function
  mit `{ level, interval }`.
- **Browser (blockiert auf Keys):** `4242…` → Tier-Flip → gesperrter Inhalt wird sichtbar. Das ist
  die Execution-Boundary-Verifikation.

---

## 8. Scope-Grenze (diese Session)
Design-Spec + Implementierungs-Plan. **Execution stoppt**, bis die 4 Stripe-Test-Produkte
(je ein **jährlicher** + ein **monatlicher** wiederkehrender Preis, Jahr = 150/300/600/1.200 €,
Monat von Donald festgelegt → 8 Preis-IDs) + Test-Keys in Infisical existieren. Die meisten Unit-Tests
sind **ohne** Live-Keys schreib-/lauffähig (Signatur-Fixtures, pgTAP, Frontend); nur der echte
End-to-End-Checkout und die realen Preis-IDs brauchen Donalds Setup.

## 9. Diese Woche bewusst NICHT (aus §4)
Echte Zahlung / Live-Keys · SEPA · Rechnungen · AGB/Widerruf/Datenschutz-Texte · `premium`/
`enterprise` · Downgrade-/Proration-Logik · Renewal-/Cancellation-Webhooks (Tier nur bei
`checkout.session.completed`) · autonomes QM.
