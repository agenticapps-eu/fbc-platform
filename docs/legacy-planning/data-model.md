# P4 — Datenmodell-Spezifikation (FBC Plattform, Phase 1)

> **Für Claude Code:** Diese Datei ist die verbindliche Spezifikation für Prompt **P4 (Datenmodell & Migrationen)**, Linear-Issue **AGE-234**.
> Lege sie als `docs/data-model.md` im Repo ab. Erzeuge daraus Supabase-SQL-Migrationen in `supabase/migrations/`.
> Felder, die für Ebene 2 (Potential Ecosystem) / Ebene 3 (DKRI) vorgesehen sind, werden **jetzt angelegt**, aber in Phase 1 noch nicht aktiv genutzt (markiert mit _„vorbereitet"_).

---

## 0. Konventionen

- PostgreSQL (Supabase). Alle Tabellen im Schema `public`.
- Primärschlüssel `id uuid default gen_random_uuid()`, außer wo anders angegeben.
- Zeitstempel `created_at timestamptz default now()`, bei editierbaren Tabellen zusätzlich `updated_at timestamptz default now()` (per Trigger gepflegt).
- Fremdschlüssel mit `on delete cascade`, außer wo anders angegeben.
- Enums werden als `text` mit `check`-Constraint umgesetzt (einfacher migrierbar als PG-Enums).
- RLS wird in **P5 (AGE-235)** definiert — hier nur das Schema. RLS bei allen Tabellen aktivieren (`alter table … enable row level security`), Policies kommen in P5.
- Nach den Migrationen: TypeScript-Typen nach `src/lib/database.types.ts` generieren (`supabase gen types typescript`).

---

## 1. Stammdaten

### `membership_tiers`
| Spalte | Typ | Hinweise |
|---|---|---|
| key | text PK | `'discover' \| 'explore' \| 'impuls' \| 'active' \| 'prime' \| 'circle' \| 'legacy'` |
| label | text not null | Anzeigename |
| price_year | int not null | Jahrespreis in EUR |
| level_rank | int not null unique | Discover=1 … Legacy=7 |

**Seed:**

| key | label | price_year | level_rank |
|---|---|---|---|
| discover | Discover | 0 | 1 |
| explore | Explore | 150 | 2 |
| impuls | Impuls | 300 | 3 |
| active | Active | 600 | 4 |
| prime | Prime | 1200 | 5 |
| circle | Circle | 2400 | 6 |
| legacy | Legacy | 4800 | 7 |

### `partner_categories`
| Spalte | Typ | Hinweise |
|---|---|---|
| key | text PK | `'host' \| 'expert' \| 'public' \| 'sponsor' \| 'strategic' \| 'impact'` |
| label | text not null | |

**Seed:** host=„Host Partner", expert=„Expert Partner", public=„Public Partner", sponsor=„Sponsor Partner", strategic=„Strategic Partner", impact=„Impact Partner".

---

## 2. Mitglieder

### `profiles`
1:1 mit `auth.users`. Wird per Trigger beim Sign-up automatisch erzeugt.

| Spalte | Typ | Hinweise |
|---|---|---|
| id | uuid PK | = `auth.uid()`, FK → `auth.users(id)` on delete cascade |
| name | text | Pflicht im UI |
| avatar_url | text | Storage-Bucket `avatars` |
| region | text | z. B. „Stuttgart" |
| company | text | |
| short_bio | text | Kurzbeschreibung |
| branche | text | |
| tier | text not null default `'discover'` | FK → `membership_tiers(key)` |
| potential_score | int not null default 0 | regelbasiert (AGE-242) |
| profile_completion | int not null default 0 | 0–100 |
| is_public | bool not null default true | |
| interests | text[] | _Prime+ sichtbar_ |
| competencies | text[] | _Prime+ sichtbar_ |
| goals | text | _Prime+ sichtbar_ |
| website | text | |
| socials | jsonb | { linkedin, instagram, … } |
| created_at | timestamptz default now() | |
| updated_at | timestamptz default now() | Trigger |

**Öffentliche Felder** (für `profiles_public`): id, name, avatar_url, region, company, short_bio.

### `profile_contacts`
Getrennt von `profiles`, weil **nur nach Freigabe** sichtbar (RLS in P5).

| Spalte | Typ | Hinweise |
|---|---|---|
| profile_id | uuid PK | FK → `profiles(id)` |
| email | text | |
| phone | text | |

### `compass_responses` _(Ebene 2 vorbereitet)_
| Spalte | Typ | Hinweise |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid | FK → `profiles(id)` |
| theme | text | `'sein' \| 'tun' \| 'haben' \| 'wirken'` |
| answers | jsonb | Mini-Compass-Antworten |
| potential_level | text | frei, z. B. `'gruendung' \| 'wachstum' \| 'nachfolge' \| 'investment'` |
| tx_volume_band | text | `'lt_10k' \| '10k_100k' \| '100k_1m' \| '1m_10m' \| 'gt_10m'` |
| routing | text | `'fbc' \| 'dkri'` — abgeleitet aus tx_volume_band (Schwelle: ab `1m_10m` → `dkri`) |
| created_at | timestamptz default now() | |

---

## 3. Matching (Herzstück)

### `offers` — „Ich biete"
| Spalte | Typ | Hinweise |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid | FK → `profiles(id)` |
| category | text | z. B. „kapital", „expertise", „kontakte", „leistung", „projekt" |
| theme | text | `'sein' \| 'tun' \| 'haben' \| 'wirken'` |
| title | text not null | |
| description | text | |
| tags | text[] | GIN-Index |
| created_at | timestamptz default now() | |

### `needs` — „Ich suche"
Wie `offers`, plus:
| Spalte | Typ | Hinweise |
|---|---|---|
| tx_volume_band | text | für FBC/DKRI-Routing (AGE-249) |

### `matches`
| Spalte | Typ | Hinweise |
|---|---|---|
| id | uuid PK | |
| a_profile_id | uuid | FK → `profiles(id)` |
| b_profile_id | uuid | FK → `profiles(id)` |
| score | int not null | 0–100 |
| basis | jsonb | Score-Begründung (Faktoren/Gewichte) |
| status | text not null default `'suggested'` | `'suggested' \| 'requested' \| 'accepted' \| 'declined'` |
| routing | text not null default `'fbc'` | `'fbc' \| 'dkri'` |
| created_at | timestamptz default now() | |

Constraints: `check (a_profile_id <> b_profile_id)`, `unique (a_profile_id, b_profile_id)`. Erzeugung serverseitig (service role) durch die Match-Engine (AGE-245).

### `contact_requests`
| Spalte | Typ | Hinweise |
|---|---|---|
| id | uuid PK | |
| from_id | uuid | FK → `profiles(id)` |
| to_id | uuid | FK → `profiles(id)` |
| match_id | uuid null | FK → `matches(id)` on delete set null |
| message | text | |
| status | text not null default `'pending'` | `'pending' \| 'accepted' \| 'declined'` |
| created_at | timestamptz default now() | |

Constraint: `unique (from_id, to_id)`. **Kontaktdaten werden erst bei `status='accepted'` sichtbar** (RLS, P5).

### `message_threads` / `messages`
`message_threads`: id, a_profile_id (FK), b_profile_id (FK), created_at. `unique(a_profile_id, b_profile_id)`.

`messages`: id, thread_id (FK → `message_threads`), sender_id (FK → `profiles`), body text not null, created_at.

> **Regel (RLS in P5):** `messages`-INSERT nur, wenn zwischen den beiden Profilen ein `contact_requests` mit `status='accepted'` existiert.

---

## 4. Community

### `posts`
| Spalte | Typ | Hinweise |
|---|---|---|
| id | uuid PK | |
| author_id | uuid | FK → `profiles(id)` |
| body | text not null | |
| hashtags | text[] | |
| visibility | text not null default `'members'` | `'public' \| 'members' \| 'prime' \| 'legacy'` |
| created_at | timestamptz default now() | |

### `comments`
id, post_id (FK → `posts`), author_id (FK → `profiles`), body text not null, created_at.

### `post_likes`
post_id (FK → `posts`), profile_id (FK → `profiles`), `primary key (post_id, profile_id)`.

---

## 5. Events

### `events`
| Spalte | Typ | Hinweise |
|---|---|---|
| id | uuid PK | |
| title | text not null | |
| type | text | `'online' \| 'presence' \| 'dinner' \| 'workshop' \| 'mastermind'` |
| starts_at | timestamptz | |
| location | text | |
| host_id | uuid null | FK → `profiles(id)` on delete set null |
| host_partner_id | uuid null | FK → `partners(id)` on delete set null |
| visibility | text not null default `'public'` | `'public' \| 'members' \| 'prime' \| 'legacy'` |
| capacity | int | |
| created_at | timestamptz default now() | |

### `event_registrations`
| Spalte | Typ | Hinweise |
|---|---|---|
| id | uuid PK | |
| event_id | uuid | FK → `events(id)` |
| profile_id | uuid | FK → `profiles(id)` |
| status | text not null default `'registered'` | `'registered' \| 'waitlist' \| 'cancelled'` |
| checked_in | bool not null default false | |
| rating | int null | 1–5 |

Constraint: `unique (event_id, profile_id)`.

---

## 6. Partner

### `partners`
id, name text not null, category text FK → `partner_categories(key)`, logo_url, contact, region, description, website, created_at.

> Partner haben **keinen** Zugriff auf Mitgliederdaten (RLS, P5).

---

## 7. Querschnitt

### `feedback` _(speist später Compass/QM, Ebene 2)_
id, profile_id (FK → `profiles`), ref_type text (`'event' \| 'match' \| 'course'`), ref_id uuid, rating int (1–5), note text, created_at.

### `notifications`
id, profile_id (FK → `profiles`), type text, payload jsonb, read_at timestamptz null, created_at.

---

## 8. Views, Funktionen, Trigger

### View `profiles_public`
```sql
create or replace view public.profiles_public as
select id, name, avatar_url, region, company, short_bio
from public.profiles
where is_public = true;
```

### Funktion `current_tier_rank()`
Liefert den `level_rank` der eingeloggten Person (für RLS in P5). `security definer`, stabiles Search-Path-Setting.
```sql
create or replace function public.current_tier_rank()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select t.level_rank
  from public.profiles p
  join public.membership_tiers t on t.key = p.tier
  where p.id = auth.uid();
$$;
```

### Trigger: `updated_at` automatisch
```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
```

### Trigger: Profil bei Sign-up anlegen
```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, tier)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), 'discover')
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

---

## 9. Indizes (Auswahl)

- `profiles (tier)`, `profiles (region)`, `profiles (branche)`
- GIN auf `offers (tags)`, `needs (tags)`, `profiles (interests)`, `profiles (competencies)`
- `matches (a_profile_id)`, `matches (b_profile_id)`
- `contact_requests (to_id, status)`
- `posts (visibility, created_at)`
- `event_registrations (event_id)`, `event_registrations (profile_id)`
- FK-Spalten generell indexieren.

---

## 10. Definition of Done (P4 / AGE-234)

- Alle Tabellen, Views, Funktionen und Trigger existieren; RLS auf allen Tabellen aktiviert (Policies folgen in P5).
- Stammdaten (`membership_tiers`, `partner_categories`) sind geseedet.
- `supabase db reset` läuft lokal fehlerfrei; `supabase db push` aktualisiert das Remote-Projekt.
- TypeScript-Typen nach `src/lib/database.types.ts` generiert.
- Commit: `feat: core data model and migrations (AGE-234)`.

---

_Diese Datei gehört zu Issue **AGE-234** im Linear-Projekt „FBC Plattform – Prototyp (Phase 1)"._
