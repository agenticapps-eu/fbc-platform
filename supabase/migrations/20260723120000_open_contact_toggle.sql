-- Kontaktanfragen fürs Sommerfest freischaltbar machen (AGE-455).
--
-- Problem: frische Anmeldungen sind `basic` (rank 1); die einzige Insert-Policy auf
-- contact_requests (cr_insert_self_exchange, 20260715150000) verlangt has_level(4)=
-- exchange, und der Welpenschutz (§2) sperrt zusätzlich Kaltanfragen an <30-Tage-
-- Mitglieder. Im Sommerfest-Workshop sind ALLE Mitglieder frisch und basic → niemand
-- kann jemanden anschreiben. Ein Backdaten der Seed-Daten hilft nicht (Live-Signups
-- bekommen ein frisches created_at).
--
-- Entscheidung (AGE-455, Donald 23.07.): ein admin-schaltbarer Flag `open_contact`
-- öffnet für Events BEIDE Hürden. Verworfene Alternative: die Gates hart im Code
-- entfernen — dann wäre das Zurückschalten nach dem Event ein Deploy statt eines
-- Admin-Klicks. Der Flag lässt from_id=self, status=pending, match_id-Zugehörigkeit
-- (AGE-247) und das Empfänger-Opt-out (is_contactable) in JEDEM Modus unangetastet —
-- geöffnet werden NUR Level-Gate und Welpenschutz.

-- ── 1. Singleton-Settings-Tabelle ───────────────────────────────────────────
create table public.platform_settings (
  id           boolean primary key default true check (id),  -- erzwingt genau EINE Zeile
  open_contact boolean not null default true,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id)
);
comment on table public.platform_settings is
  'Plattformweite Einstellungen (Singleton, id=true). Erste Einstellung: open_contact '
  '(AGE-455). Admin-schaltbar über /admin; RLS: alle lesen, nur is_admin() schreibt.';

-- Seed: fürs Sommerfest offen.
insert into public.platform_settings (id, open_contact) values (true, true);

alter table public.platform_settings enable row level security;

-- Grants müssen ausgesprochen werden — neue Tabellen erben nichts (AGE-312).
grant select on public.platform_settings to authenticated;
grant update (open_contact) on public.platform_settings to authenticated;

-- Jeder Eingeloggte liest den Flag (treibt UI + Policy). Kein anon: der Kontakt-Flow
-- ist authenticated-only.
create policy platform_settings_select on public.platform_settings
  for select to authenticated
  using ( true );

-- Schreiben nur Admins. is_admin() ist server-kontrolliert (staff_roles), nicht die
-- frei editierbare profiles.roles.
create policy platform_settings_update_admin on public.platform_settings
  for update to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

-- updated_at/updated_by setzt der Server, nie der Client (der hat nur update(open_contact)).
create or replace function public.platform_settings_touch() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;
revoke execute on function public.platform_settings_touch() from public, anon, authenticated;

create trigger platform_settings_touch
  before update on public.platform_settings
  for each row execute function public.platform_settings_touch();

-- ── 2. Helper: is_contact_open() ────────────────────────────────────────────
-- STABLE SECURITY DEFINER wie has_level()/is_contactable(): hält die Policy schlank
-- und die Tabelle abschließbar. Gibt nur ein Boolean zurück.
create or replace function public.is_contact_open() returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce((select open_contact from public.platform_settings where id), false);
$$;
comment on function public.is_contact_open() is
  'True, wenn plattformweit Kontaktanfragen für alle freigeschaltet sind (AGE-455). '
  'Öffnet in der contact_requests-Insert-Policy Level-Gate UND Welpenschutz.';
revoke execute on function public.is_contact_open() from public, anon;
grant execute on function public.is_contact_open() to authenticated;

-- ── 3. Insert-Policy: Flag öffnet Level-Gate + Welpenschutz ─────────────────
drop policy if exists cr_insert_self_exchange on public.contact_requests;
create policy cr_insert_self on public.contact_requests
  for insert to authenticated
  with check (
    from_id = (select auth.uid())
    and status = 'pending'
    and public.is_contactable(to_id)
    and ( public.is_contact_open() or public.has_level(4) )
    and (
      match_id is null
      or exists (
        select 1 from public.matches m
        where m.id = match_id
          and (
            (m.a_profile_id = from_id and m.b_profile_id = to_id) or
            (m.a_profile_id = to_id and m.b_profile_id = from_id)
          )
      )
    )
    and ( public.is_contact_open() or match_id is not null or not public.is_new_member(to_id) )
  );
comment on policy cr_insert_self on public.contact_requests is
  'AGE-455/§2: Kontaktanfrage — from_id=self, nur pending, match_id gehört zum Paar, '
  'Empfänger-Opt-out erzwungen. Level-Gate (exchange) UND Welpenschutz gelten NUR, '
  'solange is_contact_open() false ist; der Admin-Flag öffnet beide fürs Event.';
