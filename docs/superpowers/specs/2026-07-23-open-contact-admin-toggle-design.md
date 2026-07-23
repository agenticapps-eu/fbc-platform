# open_contact — Kontaktanfragen fürs Sommerfest freischalten + Admin-Einstellungsseite

**Issue:** AGE-455
**Datum:** 2026-07-23
**Status:** Design abgenommen (Donald), bereit für Implementierungsplan

## Problem

Frische Anmeldungen (Tier `basic`) können während des Sommerfest-Workshops **keine
Kontaktanfragen** senden. Zwei gestapelte Hürden blocken sie:

1. **Level-Gate** — die einzige Insert-Policy auf `contact_requests`
   (`cr_insert_self_exchange`, Migration `20260715150000_six_level_model.sql`)
   verlangt `has_level(4)` = `exchange` (rank 4). Neue Mitglieder sind `basic`
   (rank 1, `profiles.tier default 'basic'` + `handle_new_user`).
2. **Welpenschutz** (§2) — Kaltanfrage an ein <30-Tage-Mitglied ohne gemeinsames
   Match ist verboten (`match_id is not null or not is_new_member(to_id)`). Im
   Workshop sind alle Mitglieder frisch angelegt, also greift auch das.

Beide Hürden sind **spec-korrekt** und arbeiten wie entworfen — sie sind nur für
einen offenen Networking-Workshop das falsche Verhalten. Ein reines
Backdaten der Demo-Seed-Daten hilft NICHT, weil live während des Workshops
angelegte Profile ein frisches `created_at` bekommen.

Zusätzlich leakt das Frontend den rohen Postgres-RLS-Fehler
(`new row violates row-level security policy for table "contact_requests"`) als
Toast (Screenshot des Nutzers) — der ursprüngliche gemeldete Bug.

## Entscheidung

**Voll offen fürs Event:** jedes eingeloggte Mitglied darf jedem eine
Kontaktanfrage senden — umgesetzt als **admin-schaltbarer Toggle**, nicht als
Hard-Deploy. Der Toggle ist die **erste Einstellung** einer neuen Admin-Seite.
Nach dem Event schaltet ein Admin ihn per UI wieder ab — ohne Deploy, ohne
Migration.

Der Flag öffnet **nur** die zwei Hürden (Level-Gate + Welpenschutz). Die übrigen
Sicherungen bleiben in **jedem** Modus erzwungen:
- `from_id = auth.uid()` (kein Anschreiben in fremdem Namen),
- `status = 'pending'` (AGE-247 status-Pinning),
- `is_contactable(to_id)` (Opt-out des Empfängers),
- match_id gehört zum Paar (AGE-247).

## Architektur

### 1. Data layer — neue Migration

**Tabelle `platform_settings`** (Singleton, typisierte Spalten — spiegelt den Stil
von `member_settings`, KEIN free-form KV):

```sql
create table public.platform_settings (
  id           boolean primary key default true check (id),  -- erzwingt genau EINE Zeile
  open_contact boolean not null default true,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id)
);
```

- Eine Zeile wird in der Migration geseedet (`open_contact = true` fürs Sommerfest).
- **RLS:**
  - `SELECT to authenticated` (jeder liest den Flag — treibt UI **und** Policy).
  - `UPDATE` nur wenn `public.is_admin()`; `grant update(open_contact) to
    authenticated`, RLS schränkt auf Admin ein. Kein Client-INSERT/DELETE
    (Singleton in Migration angelegt). `updated_at`/`updated_by` setzt ein
    BEFORE-UPDATE-Trigger, nicht der Client.

**Helper `public.is_contact_open()`** — STABLE SECURITY DEFINER, gibt den Flag
zurück; spiegelt `has_level()` / `is_contactable()`. Hält die Policy schlank und
die Tabelle abschließbar. `revoke from public, anon` + `grant execute to
authenticated`.

### 2. RLS-Policy-Änderung (gleiche Migration)

Die Insert-Policy wird umgeschrieben (drop + create), der Flag öffnet beide Gates:

```sql
drop policy if exists cr_insert_self_exchange on public.contact_requests;
create policy cr_insert_self on public.contact_requests
  for insert to authenticated
  with check (
    from_id = (select auth.uid())
    and status = 'pending'                                  -- AGE-247, unverändert
    and public.is_contactable(to_id)                        -- Opt-out, unverändert
    and ( public.is_contact_open() or public.has_level(4) ) -- Level-Gate, jetzt schaltbar
    and (
      match_id is null                                      -- AGE-247, unverändert:
      or exists (                                           -- match_id MUSS zum Paar gehören
        select 1 from public.matches m
        where m.id = match_id
          and (
            (m.a_profile_id = from_id and m.b_profile_id = to_id) or
            (m.a_profile_id = to_id and m.b_profile_id = from_id)
          )
      )
    )
    and ( public.is_contact_open()                          -- Welpenschutz, jetzt schaltbar
          or match_id is not null
          or not public.is_new_member(to_id) )
  );
```

Migrations-Kopf dokumentiert die Abweichung + Begründung (AGE-455), signiert/datiert,
nach Projektkonvention.

### 3. Frontend — Flag lesen

- **`src/lib/platform-settings.ts`** (neu): `fetchPlatformSettings()` →
  `{ openContact: boolean }` + Query-Key. Klein, single-purpose, im Stil der
  bestehenden Libs.
- **`src/pages/PublicProfilePage.tsx`**:
  - `useQuery` für platform settings; `canRequestContact = openContact ||
    (levelRank ?? 0) >= LEVEL_RANK.exchange`. Bei open → auch `basic` sieht den
    Composer; bei off erscheint automatisch der bestehende "ab Exchange"-Hinweis.
  - **Defense-in-depth Fehler-Mapping** im `onError` des Composers: RLS-Denial
    (Postgres `code === "42501"`) auf eine freundliche, umsetzbare Toast-Meldung
    mappen statt des rohen Strings. Greift auch bei Empfänger-Opt-out oder nachdem
    open mode wieder abgeschaltet wurde. (Der ursprüngliche Screenshot-Bug.)

### 4. Admin-Seite

- **Route `/admin`** (lazy, wie die anderen Seiten), nur gerendert wenn
  `staffRole === 'admin'` (bereits im AuthContext vorhanden); sonst
  "kein Zugriff"-Fallback (defense-in-depth — das echte Gate ist die RLS
  `is_admin()` auf dem UPDATE).
- **`src/pages/AdminSettingsPage.tsx`**: eine Card mit dem Toggle
  "Kontaktanfragen für alle freischalten", gebunden an
  `platform_settings.open_contact`, mit kurzer Erklärung (öffnet Level-Gate +
  Welpenschutz fürs Event). Mutation `update platform_settings set open_contact =
  …`; invalidiert die Settings-Query. Auf Erweiterung ausgelegt, liefert aber nur
  diese eine Einstellung (YAGNI).
- **Nav:** Sidebar-Eintrag "Administration" (neue `ADMIN`-Section oder unter
  `SERVICE`), nur wenn `staffRole === 'admin'`.

## Testing

- **RLS (pgTAP, `supabase/tests/rls_test.sql`):**
  - open mode → `basic`-Sender an brandneues Mitglied (ohne Match) **erlaubt**;
  - closed mode → derselbe Insert **verweigert**;
  - Empfänger-Opt-out (`is_contactable = false`) verweigert in **beiden** Modi.
  - Vorsicht mit den pgTAP-Fallen: `alike()` statt `like()`, `try_as()` meldet
    jeden Fehler als DENIED.
- **Frontend:**
  - `PublicProfilePage.test.tsx` — bei `openContact: true` sieht ein `basic`-Viewer
    "Kontaktanfrage senden"; ein `42501`-Fehler zeigt die freundliche Meldung, NIE
    den rohen String.
  - `AdminSettingsPage.test.tsx` (neu) — Nicht-Admin geblockt; Admin sieht + schaltet
    den Toggle.
- **Lib:** `platform-settings` Fetch-Test.

## Scope / Nicht-Ziele

- Ein Migration, eine neue Lib, eine neue Seite + Test, Edits an
  `PublicProfilePage`, der Sidebar und dem Router.
- **Kein** Eingriff in den Accept/Decline-Flow, den Matching-Hub-Kontaktpfad oder
  das Sechs-Level-Modell selbst — der Flag gated nur die zwei Hürden.
- **Keine** weiteren Admin-Einstellungen in diesem Durchgang (die Seite ist auf
  mehr ausgelegt, liefert aber nur `open_contact`).
