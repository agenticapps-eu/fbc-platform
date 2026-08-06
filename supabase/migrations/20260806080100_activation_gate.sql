-- Mitglieder-Aktivierung, Teil B: das Gate einweben (AGE-495 / C3).
-- Spec: openspec/changes/member-activation-flow/. Forward-only.
-- Vollstaendige Listen mit Begruendung je Objekt: dort in INVENTORY.md.
--
-- Reiner Policy-Diff. Teil A (20260806080000) hat Spalte, Tabelle und Helfer
-- angelegt; hier bekommt jede Flaeche, ueber die Mitgliederdaten das System
-- verlassen, die Bedingung `is_activated()`.
--
-- ── Drei Stellen, nicht eine ────────────────────────────────────────────────
-- Das Gate NUR in die Policies zu schreiben waere in jedem Policy-Test gruen
-- und im Betrieb offen. Gemessen am 2026-08-06:
--   1. Policies                — 46 Stueck (Abschnitt 1-4)
--   2. Rumpf von profiles_public — die View hat `security_invoker = off`
--      (20260612082726:64) und wertet die Policies der Basistabelle NICHT aus.
--      Ohne Abschnitt 5 sieht ein nicht aktiviertes Konto das ganze Verzeichnis.
--   3. Sieben SECURITY-DEFINER-RPCs — sie zaehlen, lesen bzw. schreiben an der
--      RLS vorbei (Abschnitt 6). 20260715150000 §5 nennt die Falle beim Namen:
--      „Bleiben sie stehen, ist die Migration ein Loch statt eines Gates."
--
-- ── Warum auch die „eigenen" Daten ──────────────────────────────────────────
-- Der Angreifer meldet sich MIT DEM VERTEILTEN PASSWORT als das Mitglied an.
-- Fuer die Datenbank IST er das Mitglied: `auth.uid()` liefert die ID des
-- Bestohlenen. „Eigene Daten" sind hier dessen Kontaktdaten (E-Mail, Telefon),
-- Ziele, Benachrichtigungen und Einstellungen. Ein `or id = auth.uid()`-Zweig
-- waere deshalb keine Ausnahme, sondern die Luecke.
--
-- ── Was BEWUSST kein Gate bekommt ───────────────────────────────────────────
-- Fuenf anon-Policies — das Schaufenster bleibt fuer ausgeloggte Besucher offen
-- (erklaerter Wunsch Detlevs):
--   posts_select_public_anon · events_select_public_anon · badges_read_all
--   tiers_read_all · partner_cat_read_all
-- Dazu platform_settings_select: ein plattformweiter Flag, kein Mitgliedsdatum.
-- 46 + 5 + 1 = 52. Wer hier eine Policy vermisst, lese INVENTORY.md, bevor er
-- sie „nachreicht".
--
-- Profilbilder liegen in einem `public`-Bucket ohne SELECT-Policy und werden
-- ueber ihre URL ausgeliefert; das Gate erreicht sie nicht. Was sie schuetzt,
-- ist `profiles.avatar_url` — und diese Spalte ist gegatet. Auflisten geht
-- nicht (gemessen: `anon list('avatars')` → 0 Eintraege). Vorbestehend.

-- ── 0. Zielprofil-Helfer ────────────────────────────────────────────────────
-- Das Gate prueft BEIDE Seiten (Entscheidung Donald, 2026-08-06): ein Profil
-- erscheint im Verzeichnis erst, wenn SEIN INHABER bestaetigt hat. Ohne das
-- saehen bereits bestaetigte Mitglieder genau die Profile, deren Inhaber sich
-- nie ausgewiesen haben — und die Zusage in der Aktivierungsmail („bis du
-- geklickt hast, ist dein Profil fuer kein anderes Mitglied sichtbar") waere
-- unwahr.
--
-- DEFINER wie is_contactable()/is_new_member() (20260715150000): der
-- Policy-Ausdruck laeuft als der anfragende Nutzer und saehe die fremde Zeile
-- sonst nicht — der Wunsch liefe still ins Leere. Gibt nur ein Boolean ueber
-- EINEN Fremdschluessel zurueck.
create or replace function public.is_activated_profile(p_profile_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(
    (select p.activated_at is not null
       from public.profiles p where p.id = p_profile_id),
    false
  );
$$;
comment on function public.is_activated_profile(uuid) is
  'Hat p_profile_id seinen Zugang bestaetigt? Zielprofil-Seite des '
  'Aktivierungs-Gates (AGE-495): ein unbestaetigtes Profil erscheint fuer '
  'niemanden im Verzeichnis. Gibt nur ein Boolean zurueck.';
revoke execute on function public.is_activated_profile(uuid) from public, anon;
grant  execute on function public.is_activated_profile(uuid) to authenticated;

-- ── 1. Verzeichnisflaechen — Aufrufer UND Zielprofil ────────────────────────
drop policy if exists profiles_select_self_or_discover on public.profiles;
create policy profiles_select_self_or_discover on public.profiles
  for select to authenticated
  using (
    public.is_activated()
    and activated_at is not null
    and ( id = (select auth.uid()) or public.has_level(3) )
  );
comment on policy profiles_select_self_or_discover on public.profiles is
  'AGE-311 §2 (Vollzeile ab `discover`) + AGE-495: beide Seiten muessen '
  'bestaetigt sein. Die eigene Zeile ist KEINE Ausnahme — wer sich mit dem '
  'verteilten Passwort anmeldet, ist gegenueber der Policy das Mitglied.';

drop policy if exists interests_select on public.profile_interests;
create policy interests_select on public.profile_interests
  for select to authenticated
  using (
    public.is_activated()
    and public.is_activated_profile(profile_id)
    and ( profile_id = (select auth.uid()) or public.has_level(3) )
  );

drop policy if exists theme_scores_select on public.profile_theme_scores;
create policy theme_scores_select on public.profile_theme_scores
  for select to authenticated
  using (
    public.is_activated()
    and public.is_activated_profile(profile_id)
    and ( profile_id = (select auth.uid()) or public.has_level(3) )
  );

drop policy if exists profile_badges_select on public.profile_badges;
create policy profile_badges_select on public.profile_badges
  for select to authenticated
  using (
    public.is_activated()
    and public.is_activated_profile(profile_id)
    and ( profile_id = (select auth.uid()) or public.has_level(3) )
  );

drop policy if exists offers_select on public.offers;
create policy offers_select on public.offers
  for select to authenticated
  using (
    public.is_activated()
    and public.is_activated_profile(profile_id)
    and ( profile_id = (select auth.uid()) or public.has_level(3) )
  );

drop policy if exists needs_select on public.needs;
create policy needs_select on public.needs
  for select to authenticated
  using (
    public.is_activated()
    and public.is_activated_profile(profile_id)
    and ( profile_id = (select auth.uid()) or public.has_level(3) )
  );

-- Kontaktdaten: hier stehen E-Mail und Telefonnummer. Die AGE-235-Bedingung
-- (Eigner ODER angenommene Kontaktanfrage) bleibt Wort fuer Wort erhalten.
drop policy if exists contacts_select_self_or_released on public.profile_contacts;
create policy contacts_select_self_or_released on public.profile_contacts
  for select to authenticated
  using (
    public.is_activated()
    and public.is_activated_profile(profile_id)
    and (
      profile_id = (select auth.uid())
      or exists (
        select 1 from public.contact_requests cr
        where cr.status = 'accepted'
          and (
            (cr.from_id = (select auth.uid()) and cr.to_id = profile_contacts.profile_id) or
            (cr.to_id   = (select auth.uid()) and cr.from_id = profile_contacts.profile_id)
          )
      )
    )
  );

-- ── 2. Inhalte und Beziehungen — nur der Aufrufer ───────────────────────────
-- Kein Zielprofil-Zweig: diese Zeilen koennen keinen unbestaetigten Urheber
-- haben, weil die schreibenden Policies unten gegatet sind und importierte
-- Konten leer starten. Eine Pruefung ohne moeglichen Fall waere nur Rauschen.
drop policy if exists posts_select_by_visibility on public.posts;
create policy posts_select_by_visibility on public.posts
  for select to authenticated
  using (
    public.is_activated()
    and (
      visibility = 'public'
      or ( visibility = 'members' and public.has_level(4) )
      or author_id = (select auth.uid())
    )
  );

drop policy if exists comments_select_visible on public.comments;
create policy comments_select_visible on public.comments
  for select to authenticated
  using (
    public.is_activated()
    and exists (select 1 from public.posts p where p.id = comments.post_id)
  );

drop policy if exists events_select_by_visibility on public.events;
create policy events_select_by_visibility on public.events
  for select to authenticated
  using (
    public.is_activated()
    and ( visibility in ('public', 'members') or host_id = (select auth.uid()) )
  );

drop policy if exists regs_select_self_or_host on public.event_registrations;
create policy regs_select_self_or_host on public.event_registrations
  for select to authenticated
  using (
    public.is_activated()
    and (
      profile_id = (select auth.uid())
      or exists ( select 1 from public.events e
                  where e.id = event_registrations.event_id and e.host_id = (select auth.uid()) )
    )
  );

drop policy if exists matches_select_participant on public.matches;
create policy matches_select_participant on public.matches
  for select to authenticated
  using (
    public.is_activated()
    and ( a_profile_id = (select auth.uid()) or b_profile_id = (select auth.uid()) )
  );

drop policy if exists cr_select_participants on public.contact_requests;
create policy cr_select_participants on public.contact_requests
  for select to authenticated
  using (
    public.is_activated()
    and ( from_id = (select auth.uid()) or to_id = (select auth.uid()) )
  );

drop policy if exists threads_select on public.message_threads;
create policy threads_select on public.message_threads
  for select to authenticated
  using (
    public.is_activated()
    and ( a_profile_id = (select auth.uid()) or b_profile_id = (select auth.uid()) )
  );

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    public.is_activated()
    and exists (
      select 1 from public.message_threads t
      where t.id = messages.thread_id
        and ( t.a_profile_id = (select auth.uid()) or t.b_profile_id = (select auth.uid()) )
    )
  );

drop policy if exists partners_read_authenticated on public.partners;
create policy partners_read_authenticated on public.partners
  for select to authenticated using ( public.is_activated() );

drop policy if exists feedback_admin_read on public.feedback;
create policy feedback_admin_read on public.feedback
  for select to authenticated
  using ( public.is_activated() and public.is_admin() );

drop policy if exists routing_queue_select_staff on public.routing_queue;
create policy routing_queue_select_staff on public.routing_queue
  for select to authenticated
  using ( public.is_activated() and public.is_matching_manager() );

drop policy if exists routing_queue_update_staff on public.routing_queue;
create policy routing_queue_update_staff on public.routing_queue
  for update to authenticated
  using ( public.is_activated() and public.is_matching_manager() )
  with check ( public.is_activated() and public.is_matching_manager() );

-- ── 3. Schreibende Policies ─────────────────────────────────────────────────
-- Damit unter dem echten Namen eines Mitglieds nichts veroeffentlicht werden
-- kann. Rufschaden unter echtem Namen ist fuer einen Club mindestens so
-- schwerwiegend wie Lesezugriff.
drop policy if exists posts_write_own on public.posts;
create policy posts_write_own on public.posts
  for all to authenticated
  using ( public.is_activated() and author_id = (select auth.uid()) )
  with check ( public.is_activated() and author_id = (select auth.uid()) );

drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments
  for insert to authenticated
  with check (
    public.is_activated()
    and author_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = comments.post_id)
  );

drop policy if exists likes_write_own on public.post_likes;
create policy likes_write_own on public.post_likes
  for all to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check (
    public.is_activated()
    and profile_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_likes.post_id)
  );

drop policy if exists events_write_host on public.events;
create policy events_write_host on public.events
  for all to authenticated
  using ( public.is_activated() and host_id = (select auth.uid()) )
  with check ( public.is_activated() and host_id = (select auth.uid()) );

drop policy if exists regs_write_own on public.event_registrations;
create policy regs_write_own on public.event_registrations
  for all to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check (
    public.is_activated()
    and profile_id = (select auth.uid())
    and public.has_level(4)
    and exists (select 1 from public.events e where e.id = event_registrations.event_id)
  );

drop policy if exists offers_write_own on public.offers;
create policy offers_write_own on public.offers
  for all to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check ( public.is_activated() and profile_id = (select auth.uid()) );

drop policy if exists needs_write_own on public.needs;
create policy needs_write_own on public.needs
  for all to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check ( public.is_activated() and profile_id = (select auth.uid()) );

-- Kontaktanfragen: die AGE-455-Bedingungen bleiben Wort fuer Wort erhalten.
drop policy if exists cr_insert_self on public.contact_requests;
create policy cr_insert_self on public.contact_requests
  for insert to authenticated
  with check (
    public.is_activated()
    and from_id = (select auth.uid())
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

drop policy if exists cr_update_recipient on public.contact_requests;
create policy cr_update_recipient on public.contact_requests
  for update to authenticated
  using ( public.is_activated() and to_id = (select auth.uid()) )
  with check ( public.is_activated() and to_id = (select auth.uid()) );

drop policy if exists threads_insert on public.message_threads;
create policy threads_insert on public.message_threads
  for insert to authenticated
  with check (
    public.is_activated()
    and (a_profile_id = (select auth.uid()) or b_profile_id = (select auth.uid()))
    and exists (
      select 1 from public.contact_requests cr
      where cr.status = 'accepted'
        and (
          (cr.from_id = a_profile_id and cr.to_id = b_profile_id) or
          (cr.from_id = b_profile_id and cr.to_id = a_profile_id)
        )
    )
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    public.is_activated()
    and sender_id = (select auth.uid())
    and exists (
      select 1 from public.message_threads t
      join public.contact_requests cr
        on cr.status = 'accepted'
       and ( (cr.from_id = t.a_profile_id and cr.to_id = t.b_profile_id)
          or (cr.from_id = t.b_profile_id and cr.to_id = t.a_profile_id) )
      where t.id = messages.thread_id
        and ( t.a_profile_id = (select auth.uid()) or t.b_profile_id = (select auth.uid()) )
    )
  );

-- ── 4. „Eigene" Daten des angemeldeten Kontos ───────────────────────────────
-- Das sind im Ernstfall die Daten des Bestohlenen (s. Kopf).
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ( public.is_activated() and id = (select auth.uid()) )
  with check ( public.is_activated() and id = (select auth.uid()) );

drop policy if exists profile_contacts_insert_own on public.profile_contacts;
create policy profile_contacts_insert_own on public.profile_contacts
  for insert to authenticated
  with check ( public.is_activated() and profile_id = (select auth.uid()) );

drop policy if exists profile_contacts_update_own on public.profile_contacts;
create policy profile_contacts_update_own on public.profile_contacts
  for update to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check ( public.is_activated() and profile_id = (select auth.uid()) );

drop policy if exists goals_own on public.goals;
create policy goals_own on public.goals
  for all to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check ( public.is_activated() and profile_id = (select auth.uid()) );

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for all to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check ( public.is_activated() and profile_id = (select auth.uid()) );

drop policy if exists feedback_own on public.feedback;
create policy feedback_own on public.feedback
  for all to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check ( public.is_activated() and profile_id = (select auth.uid()) );

drop policy if exists member_settings_own on public.member_settings;
create policy member_settings_own on public.member_settings
  for all to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check ( public.is_activated() and profile_id = (select auth.uid()) );

drop policy if exists compass_responses_select_own on public.compass_responses;
create policy compass_responses_select_own on public.compass_responses
  for select to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) );

drop policy if exists compass_responses_write_own on public.compass_responses;
create policy compass_responses_write_own on public.compass_responses
  for all to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check ( public.is_activated() and profile_id = (select auth.uid()) );

drop policy if exists interests_write_own on public.profile_interests;
create policy interests_write_own on public.profile_interests
  for all to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check ( public.is_activated() and profile_id = (select auth.uid()) );

drop policy if exists theme_scores_write_own on public.profile_theme_scores;
create policy theme_scores_write_own on public.profile_theme_scores
  for all to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check ( public.is_activated() and profile_id = (select auth.uid()) );

drop policy if exists staff_roles_select_self on public.staff_roles;
create policy staff_roles_select_self on public.staff_roles
  for select to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) );

drop policy if exists platform_settings_update_admin on public.platform_settings;
create policy platform_settings_update_admin on public.platform_settings
  for update to authenticated
  using ( public.is_activated() and public.is_admin() )
  with check ( public.is_activated() and public.is_admin() );

-- Storage: nur Schreibzugriffe. Lesen laeuft am Bucket vorbei (s. Kopf).
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    public.is_activated()
    and bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    public.is_activated()
    and bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    public.is_activated()
    and bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    public.is_activated()
    and bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ── 5. profiles_public — die View, die an den Policies vorbeilaeuft ─────────
-- OHNE DIESEN ABSCHNITT IST ABSCHNITT 1 WIRKUNGSLOS. `security_invoker` bleibt
-- `off`: das traegt bewusst die Sichtbarkeit der Basisfelder fuer `basic`
-- (AGE-311 §2). Genau deshalb muss die Bedingung hier IN den Rumpf.
-- Kein `or id = auth.uid()`-Zweig — konsistent mit Abschnitt 4.
create or replace view public.profiles_public
  with (security_invoker = off) as
  select id, name, avatar_url, region, company, short_bio, tier, roles
  from public.profiles
  where is_public
    and public.is_activated()          -- der Aufrufer
    and activated_at is not null;      -- das Zielprofil

comment on view public.profiles_public is
  'Oeffentliche Verzeichnis-Projektion der is_public-Profile. SECURITY DEFINER '
  'by design (AGE-311): bedient das Verzeichnis fuer jedes eingeloggte Mitglied '
  'unabhaengig von der Basis-Tabellen-RLS. WEIL sie die Policies umgeht, traegt '
  'sie das Aktivierungs-Gate im eigenen Rumpf (AGE-495) — auf BEIDEN Seiten: '
  'der Aufrufer muss bestaetigt sein, und ein unbestaetigtes Profil erscheint '
  'fuer niemanden.';

-- `create or replace view` erhaelt die Grants; zur Sicherheit erneut aussprechen
-- (Grants werden hier nie geerbt, AGE-312).
grant select on public.profiles_public to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.profiles_public from anon, authenticated;
revoke select on public.profiles_public from anon;

-- ── 6. Die sieben SECURITY-DEFINER-RPCs ─────────────────────────────────────
-- Sie spiegeln Sichtbarkeitspraedikate bzw. schreiben an der RLS vorbei. Die
-- Fehlermeldung lautet ueberall `not activated` — der pgTAP-Test prueft genau
-- darauf, weil manche dieser Funktionen auch ohne Gate ablehnen (nur aus einem
-- anderen Grund) und die Assertion sonst falsch gruen waere.

create or replace function public.post_engagement_counts(p_post_ids uuid[])
returns table (post_id uuid, like_count bigint, comment_count bigint)
language sql stable security definer set search_path = public
as $$
  select
    p.id,
    (select count(*) from public.post_likes pl where pl.post_id = p.id),
    (select count(*) from public.comments  c  where c.post_id  = p.id)
  from public.posts p
  where cardinality(p_post_ids) <= 200
    and p.id = any (p_post_ids)
    and public.is_activated()                       -- AGE-495
    and (
      p.visibility = 'public'
      or ( p.visibility = 'members' and public.has_level(4) )
      or p.author_id = (select auth.uid())
    );
$$;
grant execute on function public.post_engagement_counts(uuid[]) to anon, authenticated;

create or replace function public.event_registration_counts(p_event_ids uuid[])
returns table (event_id uuid, registered_count bigint, waitlist_count bigint)
language sql stable security definer set search_path = public
as $$
  select
    e.id,
    (select count(*) from public.event_registrations r
       where r.event_id = e.id and r.status = 'registered'),
    (select count(*) from public.event_registrations r
       where r.event_id = e.id and r.status = 'waitlist')
  from public.events e
  where cardinality(p_event_ids) <= 200
    and e.id = any (p_event_ids)
    and public.is_activated()                       -- AGE-495
    and (
      e.visibility = 'public'
      or ( e.visibility = 'members' and (select auth.uid()) is not null )
      or e.host_id = (select auth.uid())
    );
$$;
grant execute on function public.event_registration_counts(uuid[]) to anon, authenticated;

-- register_for_event: unveraendert bis auf die Aktivierungspruefung. Sie steht
-- VOR der Sichtbarkeits- und Stufenpruefung, damit die Meldung eindeutig ist.
-- Der AGE-448-Zweig (oeffentliche Events fuer jeden Eingeloggten) bleibt — er
-- gilt jetzt fuer jedes BESTAETIGTE eingeloggte Konto.
create or replace function public.register_for_event(p_event_id uuid)
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_event  public.events;
  v_count  integer;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not public.is_activated() then
    raise exception 'not activated' using errcode = '42501';
  end if;

  select * into v_event from public.events e where e.id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if not (
    v_event.visibility in ('public', 'members')
    or v_event.host_id = v_uid
  ) then
    raise exception 'event not visible' using errcode = '42501';
  end if;

  -- Teilnahme sichtbarkeitsabhaengig (AGE-448), unveraendert.
  if not (
    v_event.visibility = 'public'
    or public.has_level(3)
    or v_event.host_id = v_uid
  ) then
    raise exception 'membership level too low to register' using errcode = '42501';
  end if;

  select count(*) into v_count
    from public.event_registrations r
   where r.event_id = p_event_id and r.status = 'registered';

  if v_event.capacity is null or v_count < v_event.capacity then
    v_status := 'registered';
  else
    v_status := 'waitlist';
  end if;

  insert into public.event_registrations (event_id, profile_id, status)
  values (p_event_id, v_uid, v_status)
  on conflict (event_id, profile_id)
    do update set status = excluded.status;

  return v_status;
end;
$$;
grant execute on function public.register_for_event(uuid) to authenticated;

create or replace function public.set_event_check_in(
  p_registration_id uuid, p_checked_in boolean
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- VOR der Host-Pruefung: sonst lautet die Meldung „not the host", und die
  -- Assertion im pgTAP waere aus dem falschen Grund gruen.
  if not public.is_activated() then
    raise exception 'not activated' using errcode = '42501';
  end if;

  update public.event_registrations r
     set checked_in = p_checked_in
    from public.events e
   where r.id = p_registration_id
     and e.id = r.event_id
     and e.host_id = v_uid;
  if not found then
    raise exception 'not the host of this event' using errcode = '42501';
  end if;
end;
$$;

-- recompute_my_matches war `language sql` und konnte deshalb nicht ablehnen.
-- Auf plpgsql umgestellt; Signatur und Rueckgabe bleiben gleich.
create or replace function public.recompute_my_matches()
returns integer
language plpgsql volatile security definer set search_path = public
as $$
begin
  if not public.is_activated() then
    raise exception 'not activated' using errcode = '42501';
  end if;
  return public.generate_matches_for((select auth.uid()));
end;
$$;
revoke execute on function public.recompute_my_matches() from public, anon;
grant  execute on function public.recompute_my_matches() to authenticated;

create or replace function public.admin_list_feedback()
returns table (id uuid, rating integer, likes text, misses text, idea text,
               route text, ref_type text, created_at timestamptz, author_name text)
language sql stable security definer set search_path = ''
as $$
  select f.id, f.rating, f.likes, f.misses, f.idea, f.route, f.ref_type,
         f.created_at, coalesce(p.name, '—') as author_name
  from public.feedback f
  left join public.profiles p on p.id = f.profile_id
  where public.is_activated() and public.is_admin()   -- AGE-495
  order by f.created_at desc;
$$;
revoke execute on function public.admin_list_feedback() from public, anon;
grant  execute on function public.admin_list_feedback() to authenticated;

create or replace function public.list_routing_queue()
returns table (id uuid, match_id uuid, status text, routing text, volume_band text,
               score integer, member_a_name text, member_b_name text,
               need_category text, need_title text, assigned_to uuid,
               created_at timestamptz)
language sql stable security definer set search_path = 'public'
as $$
  select
    q.id, q.match_id, q.status, q.routing, q.volume_band,
    m.score, pa.name, pb.name, n.category, n.title, q.assigned_to, q.created_at
  from public.routing_queue q
  join public.matches  m  on m.id = q.match_id
  join public.profiles pa on pa.id = m.a_profile_id
  join public.profiles pb on pb.id = m.b_profile_id
  left join public.needs n on n.id = q.need_id
  where public.is_activated() and public.is_matching_manager()   -- AGE-495
  order by q.created_at desc;
$$;
revoke execute on function public.list_routing_queue() from public, anon;
grant  execute on function public.list_routing_queue() to authenticated;
