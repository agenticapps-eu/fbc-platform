# P5 — RLS-Policies & Sichtbarkeitslogik (FBC Plattform, Phase 1)

> **Für Claude Code:** Verbindliche Spezifikation für Prompt **P5**, Linear-Issue **AGE-235**.
> Baut auf `docs/data-model.md` (AGE-234) auf. Erzeuge eine Migration `supabase/migrations/*_rls.sql`.
> **Grundsatz:** Sichtbarkeit wird in der Datenbank erzwungen — nicht nur im Frontend. RLS ist auf allen Tabellen aktiv; ohne passende Policy gilt „deny by default".

---

## 0. Stufen-Logik

Nutze die Funktion `public.current_tier_rank()` aus AGE-234. Ränge:

| Stufe | rank |
|---|---|
| discover | 1 |
| explore | 2 |
| impuls | 3 |
| active | 4 |
| **prime** | **5** |
| circle | 6 |
| legacy | 7 |

Kernschwellen im Prototyp: **Verzeichnis/Suchprofile/Kontakt ab rank ≥ 5 (Prime)**. Helfer:

```sql
-- true, wenn eingeloggt und mindestens Prime
create or replace function public.is_prime_plus()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_tier_rank() >= 5, false);
$$;
```

Aktivierung (für jede Tabelle):
```sql
alter table public.<table> enable row level security;
-- ggf. force, damit auch der Tabelleneigentümer den Policies unterliegt:
alter table public.<table> force row level security;
```

---

## 1. profiles

Öffentliche Felder für alle lesbar, erweiterte Felder erst ab Prime oder am eigenen Profil. Da RLS zeilen- (nicht spalten-)basiert ist, wird die **Spaltentrennung über Views** gelöst:

- `profiles_public` (aus AGE-234): nur öffentliche Spalten → für `anon` und `authenticated` lesbar.
- Vollzugriff auf die Tabelle `profiles` (inkl. interests/competencies/goals) nur für Prime+ oder eigenes Profil.

```sql
-- SELECT: eigenes Profil ODER Prime+ darf volle Profile sehen
create policy profiles_select_self_or_prime on public.profiles
for select to authenticated
using ( id = auth.uid() or public.is_prime_plus() );

-- Discover/anon nutzen die View profiles_public (separat grant'en):
grant select on public.profiles_public to anon, authenticated;

-- UPDATE/INSERT nur eigenes Profil
create policy profiles_update_self on public.profiles
for update to authenticated using ( id = auth.uid() ) with check ( id = auth.uid() );

create policy profiles_insert_self on public.profiles
for insert to authenticated with check ( id = auth.uid() );
```

> Frontend-Regel: Discover-/öffentliche Ansichten lesen **immer** aus `profiles_public`, das Verzeichnis (Prime+) aus `profiles`.

---

## 2. profile_contacts  (Kontaktdaten — nur nach Freigabe)

```sql
create policy contacts_select_self_or_released on public.profile_contacts
for select to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.contact_requests cr
    where cr.status = 'accepted'
      and (
        (cr.from_id = auth.uid() and cr.to_id = profile_contacts.profile_id) or
        (cr.to_id   = auth.uid() and cr.from_id = profile_contacts.profile_id)
      )
  )
);

create policy contacts_upsert_self on public.profile_contacts
for all to authenticated using ( profile_id = auth.uid() ) with check ( profile_id = auth.uid() );
```

---

## 3. offers / needs

```sql
-- SELECT: eigene immer; fremde nur Prime+
create policy offers_select on public.offers
for select to authenticated
using ( profile_id = auth.uid() or public.is_prime_plus() );

create policy offers_write_own on public.offers
for all to authenticated using ( profile_id = auth.uid() ) with check ( profile_id = auth.uid() );
```
Analog für `needs` (gleiche zwei Policies).

---

## 4. matches

```sql
-- nur Beteiligte sehen ihre Matches
create policy matches_select_participant on public.matches
for select to authenticated
using ( a_profile_id = auth.uid() or b_profile_id = auth.uid() );
```
INSERT/UPDATE erfolgt **serverseitig mit service role** (Match-Engine, AGE-245) und umgeht RLS — keine Client-Insert-Policy.

---

## 5. contact_requests  (Kontakt-Flow)

```sql
-- senden: nur als from_id=self UND nur Prime+
create policy cr_insert_self_prime on public.contact_requests
for insert to authenticated
with check ( from_id = auth.uid() and public.is_prime_plus() );

-- sehen: Beteiligte
create policy cr_select_participants on public.contact_requests
for select to authenticated
using ( from_id = auth.uid() or to_id = auth.uid() );

-- annehmen/ablehnen: nur Empfänger darf status ändern
create policy cr_update_recipient on public.contact_requests
for update to authenticated
using ( to_id = auth.uid() )
with check ( to_id = auth.uid() );
```

---

## 6. message_threads / messages  (Chat erst nach Freigabe)

```sql
-- Threads: nur Teilnehmer
create policy threads_select on public.message_threads
for select to authenticated
using ( a_profile_id = auth.uid() or b_profile_id = auth.uid() );

create policy threads_insert on public.message_threads
for insert to authenticated
with check (
  (a_profile_id = auth.uid() or b_profile_id = auth.uid())
  and exists (
    select 1 from public.contact_requests cr
    where cr.status = 'accepted'
      and (
        (cr.from_id = a_profile_id and cr.to_id = b_profile_id) or
        (cr.from_id = b_profile_id and cr.to_id = a_profile_id)
      )
  )
);

-- Messages: nur Thread-Teilnehmer, und nur wenn Kontakt freigegeben
create policy messages_select on public.messages
for select to authenticated
using ( exists (
  select 1 from public.message_threads t
  where t.id = messages.thread_id
    and ( t.a_profile_id = auth.uid() or t.b_profile_id = auth.uid() )
));

create policy messages_insert on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.message_threads t
    join public.contact_requests cr
      on cr.status = 'accepted'
     and ( (cr.from_id = t.a_profile_id and cr.to_id = t.b_profile_id)
        or (cr.from_id = t.b_profile_id and cr.to_id = t.a_profile_id) )
    where t.id = messages.thread_id
      and ( t.a_profile_id = auth.uid() or t.b_profile_id = auth.uid() )
  )
);
```

---

## 7. posts / comments / post_likes  (Sichtbarkeit per visibility × rank)

```sql
create policy posts_select_by_visibility on public.posts
for select to anon, authenticated
using (
  visibility = 'public'
  or ( visibility = 'members' and auth.uid() is not null )
  or ( visibility = 'prime'   and coalesce(public.current_tier_rank(),0) >= 5 )
  or ( visibility = 'legacy'  and coalesce(public.current_tier_rank(),0) >= 7 )
  or author_id = auth.uid()
);

create policy posts_write_own on public.posts
for all to authenticated using ( author_id = auth.uid() ) with check ( author_id = auth.uid() );

-- comments/post_likes: lesbar wenn der zugehörige post lesbar ist; schreiben nur eingeloggt + eigenes Profil
create policy comments_insert_own on public.comments
for insert to authenticated with check ( author_id = auth.uid() );
create policy comments_select_all on public.comments
for select to authenticated using ( true );

create policy likes_write_own on public.post_likes
for all to authenticated using ( profile_id = auth.uid() ) with check ( profile_id = auth.uid() );
```

---

## 8. events / event_registrations

```sql
create policy events_select_by_visibility on public.events
for select to anon, authenticated
using (
  visibility = 'public'
  or ( visibility = 'members' and auth.uid() is not null )
  or ( visibility = 'prime'   and coalesce(public.current_tier_rank(),0) >= 5 )
  or ( visibility = 'legacy'  and coalesce(public.current_tier_rank(),0) >= 7 )
  or host_id = auth.uid()
);

create policy events_write_host on public.events
for all to authenticated using ( host_id = auth.uid() ) with check ( host_id = auth.uid() );

-- Anmeldungen: eigene; Host sieht Teilnehmer seiner Events
create policy regs_select_self_or_host on public.event_registrations
for select to authenticated
using (
  profile_id = auth.uid()
  or exists ( select 1 from public.events e where e.id = event_registrations.event_id and e.host_id = auth.uid() )
);

create policy regs_write_own on public.event_registrations
for all to authenticated using ( profile_id = auth.uid() ) with check ( profile_id = auth.uid() );
```

---

## 9. Stammdaten & Partner

```sql
-- Stammdaten für alle lesbar
create policy tiers_read_all on public.membership_tiers for select to anon, authenticated using ( true );
create policy partner_cat_read_all on public.partner_categories for select to anon, authenticated using ( true );
create policy partners_read_all on public.partners for select to anon, authenticated using ( true );
```
> **Wichtig:** Partner haben **keine** Policy, die Zugriff auf `profiles`, `offers`, `needs`, `matches` oder `contact_requests` gewährt. Partner sehen ausschließlich öffentliche Inhalte und ihre eigenen Events/Inhalte.

---

## 10. feedback / notifications  (nur eigene)

```sql
create policy feedback_own on public.feedback
for all to authenticated using ( profile_id = auth.uid() ) with check ( profile_id = auth.uid() );

create policy notifications_own on public.notifications
for all to authenticated using ( profile_id = auth.uid() ) with check ( profile_id = auth.uid() );
```

---

## 11. Tests (Definition of Done)

Schreibe `supabase/tests/rls_test.sql` (pgTAP) mit drei Rollen-Szenarien (Discover, Prime, Legacy):

1. **Discover** sieht `profiles_public`, aber `select` auf `offers`/`needs` fremder Profile liefert 0 Zeilen; `insert` in `contact_requests` schlägt fehl.
2. **Prime** sieht fremde `offers`/`needs`, kann `contact_requests` anlegen.
3. `messages`-INSERT scheitert ohne `accepted` contact_request und gelingt danach.
4. `profile_contacts` einer fremden Person ist erst nach `accepted` lesbar.
5. `posts` mit `visibility='legacy'` ist für Prime unsichtbar, für Legacy sichtbar.

Ausführen mit `supabase test db`. Alle Tests müssen grün sein.

Commit: `feat: RLS policies and tier-based visibility (AGE-235)`.

---

_Gehört zu Issue **AGE-235** im Linear-Projekt „FBC Plattform – Prototyp (Phase 1)"._
