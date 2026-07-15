-- FBC 6-Level-Modell (AGE-311). Forward-only.
-- Spec: docs/superpowers/specs/2026-07-15-fbc-6level-upgrade.md §1a + §2
-- (Rechte-Matrix von Detlev bestätigt, 15.07.2026).
--
-- Das v4.0-Modell ersetzt die 7 Prototyp-Stufen durch 6:
--   basic(1) connect(2) discover(3) exchange(4) focus(5) impact(6).
-- `circle` und `legacy` entfallen.
--
-- ── Warum das KEIN Umbenennen ist ────────────────────────────────────────────
-- Zwei Fallen, die ein mechanischer Rename stellen würde:
--
--  1. NAMENS-KOLLISION (§1a): alt `discover` = 0 €, neu `discover` = 150 €. Die
--     neuen Labels über die alten Keys zu legen, würde Semantik UND Preis
--     kollidieren lassen. Deshalb: neue Keys anlegen → Profile umhängen → alte
--     Keys löschen. `level_rank` ist unique, also laufen die neuen Keys erst auf
--     temporären Rängen (101…106) und bekommen ihren echten Rang zum Schluss.
--
--  2. SCHWELLEN-DRIFT: heute hängt JEDES Gate an is_prime_plus() (rank >= 5, also
--     `prime`) — volle Profile, Verzeichnis, Angebote/Gesuche, Kontaktanfragen.
--     Ein Rang-Remap würde all das auf `impact` heben (1.200 €, oberste Stufe).
--     §2 will aber volles Verzeichnis + erweiterte Matchings ab `discover`
--     (150 €, rank 3) und Kontaktanfragen ab `exchange` (300 €, rank 4). Die
--     Schwellen werden daher aus §2 NEU abgeleitet, nicht übertragen.
--     is_prime_plus() weicht dem parametrischen has_level(min_rank).
--
-- ── Entscheidungen (Donald, 15.07.2026) ──────────────────────────────────────
--  * Bestands-`discover` (0 €) → `connect` (ebenfalls 0 €). §1a nennt „basic +
--    connect" ohne Split-Regel. `connect` nimmt niemandem etwas weg und lässt die
--    Demo-Personas am Sommerfest etwas zeigen. Neue Signups starten auf `basic`.
--  * `circle`/`legacy`-Bestand → `impact`. Beide entfallen ersatzlos; `impact` ist
--    die höchste verbleibende Stufe. Sie haben MEHR bezahlt als impact kostet —
--    ein Mapping nach unten entzöge bezahlte Rechte.
--  * posts/events `visibility`: 'prime'/'legacy' → 'members'. Die Werte WAREN
--    Tier-Keys; `visibility = 'legacy' and rank >= 7` ist nach der Migration
--    unerfüllbar (höchster Rang = 6) — jeder solche Beitrag wäre für niemanden
--    außer dem Autor sichtbar. Gestufte Beitrags-Sichtbarkeit entfällt im MVP;
--    die Stufung sitzt dort, wo §2 sie hinlegt: Aktivität ab `exchange`.

-- ── 1. Key-Migration (§1a) ───────────────────────────────────────────────────
-- a) Neue Keys auf temporären Rängen (level_rank ist unique).
insert into public.membership_tiers (key, label, price_year, level_rank) values
  ('basic',    'Basic',    0,    101),
  ('connect',  'Connect',  0,    102),
  ('exchange', 'Exchange', 300,  104),
  ('focus',    'Focus',    600,  105),
  ('impact',   'Impact',   1200, 106);

-- b) Profile umhängen. `discover` zuerst — das gibt den Key für seine neue
--    Bedeutung (150 €) frei.
update public.profiles set tier = 'connect'  where tier = 'discover';
update public.profiles set tier = 'exchange' where tier = 'impuls';
update public.profiles set tier = 'focus'    where tier = 'active';
update public.profiles set tier = 'impact'   where tier in ('prime', 'circle', 'legacy');

-- c) `discover` neu besetzen: 0 € → 150 € (ex-`explore`).
delete from public.membership_tiers where key = 'discover';
insert into public.membership_tiers (key, label, price_year, level_rank)
  values ('discover', 'Discover', 150, 103);
update public.profiles set tier = 'discover' where tier = 'explore';

-- d) Alte Keys entfernen. Schlägt fehl (FK), falls oben ein Profil übersehen
--    wurde — genau das ist gewollt: lieber laute Migration als stille Fehlstufe.
delete from public.membership_tiers
  where key in ('explore', 'impuls', 'active', 'prime', 'circle', 'legacy');

-- e) Echte Ränge setzen. Jedes Ziel ist durch (c)/(d) frei geräumt.
update public.membership_tiers set level_rank = 1 where key = 'basic';
update public.membership_tiers set level_rank = 2 where key = 'connect';
update public.membership_tiers set level_rank = 3 where key = 'discover';
update public.membership_tiers set level_rank = 4 where key = 'exchange';
update public.membership_tiers set level_rank = 5 where key = 'focus';
update public.membership_tiers set level_rank = 6 where key = 'impact';

comment on table public.membership_tiers is
  'Mitgliedsstufen (6-Level-Modell v4.0, AGE-311). level_rank steigt basic=1 … impact=6. '
  'Preise/Labels sind hier die Wahrheit; src/config/levels.ts spiegelt sie fürs Frontend.';

-- Neue Mitglieder starten auf `basic` (§3.4), nicht mehr auf dem alten `discover`.
alter table public.profiles alter column tier set default 'basic';

create or replace function public.handle_new_user() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.profiles (id, name, tier)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    'basic'
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ── 2. Rang-Helper (ersetzt is_prime_plus) ───────────────────────────────────
-- Parametrisch statt einer Funktion je Schwelle: §2 kennt sechs Stufen, und die
-- Schwellen sollen beim nächsten Modell-Schwenk in den Policies stehen, nicht in
-- einer Funktions-Zoo-Sammlung.
create or replace function public.has_level(p_min_rank int) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(public.current_tier_rank() >= p_min_rank, false);
$$;

comment on function public.has_level(int) is
  'True, wenn der Aufrufer eingeloggt ist und mindestens level_rank p_min_rank hat. '
  'Ersetzt is_prime_plus() (AGE-311). Ränge: basic=1 connect=2 discover=3 '
  'exchange=4 focus=5 impact=6.';

-- Policy-Ausdrücke laufen als die anfragende Rolle → sie braucht EXECUTE (SECURITY
-- DEFINER regelt, mit wessen Rechten der RUMPF läuft, nicht wer aufrufen darf).
-- Die Funktion gibt nur den eigenen Stufen-Stand zurück; Re-Exposition via
-- /rest/v1/rpc ist harmlos.
revoke execute on function public.has_level(int) from public, anon;
grant execute on function public.has_level(int) to authenticated;

-- Der Ziel-Kontakt darf Kaltanfragen abgeschaltet haben. member_settings ist strikt
-- own-profile (member_settings_own) — ein Policy-Ausdruck als anfragende Rolle sähe
-- die fremde Zeile NIE und der Wunsch liefe still ins Leere. Daher DEFINER; die
-- Funktion gibt genau ein Boolean über EINEN Fremdschlüssel zurück, keine Zeile.
create or replace function public.is_contactable(p_profile_id uuid) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(
    (select ms.contactable_by_prime
       from public.member_settings ms
      where ms.profile_id = p_profile_id),
    true  -- keine Settings-Zeile = Spalten-Default (true)
  );
$$;

comment on function public.is_contactable(uuid) is
  'Hat p_profile_id Kontaktanfragen zugelassen? (member_settings.contactable_by_prime, '
  'Default true). SECURITY DEFINER, weil member_settings own-profile-only ist und der '
  'Policy-Ausdruck die fremde Zeile sonst nicht sähe. Gibt nur ein Boolean zurück.';
revoke execute on function public.is_contactable(uuid) from public, anon;
grant execute on function public.is_contactable(uuid) to authenticated;

-- Welpenschutz (§2): neue Mitglieder sind die ersten 30 Tage nicht KALT
-- kontaktierbar — Kontakt nur über ein Match/eine Empfehlung. DEFINER aus demselben
-- Grund wie oben: profiles ist ab rank 3 lesbar, aber die Policy soll nicht still
-- durchfallen, wenn sich diese Schwelle mal ändert.
create or replace function public.is_new_member(p_profile_id uuid) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = p_profile_id
       and p.created_at > now() - interval '30 days'
  );
$$;

comment on function public.is_new_member(uuid) is
  'True in den ersten 30 Tagen nach Registrierung (Welpenschutz, §2). Solche '
  'Mitglieder sind nur über ein Match kontaktierbar, nicht kalt.';
revoke execute on function public.is_new_member(uuid) from public, anon;
grant execute on function public.is_new_member(uuid) to authenticated;

-- ── 3. Rechte-Matrix (§2) als Policies ───────────────────────────────────────

-- 3.1 profiles — „vollständiges Mitgliederverzeichnis" ab `discover` (rank 3).
-- Die volle Zeile (interests/competencies/goals/…) war Prime+; §2 legt sie auf die
-- erste zahlende Stufe. profiles_public (DEFINER-Projektion) bleibt unberührt: die
-- Basisfelder sehen weiterhin alle eingeloggten Mitglieder.
drop policy if exists profiles_select_self_or_prime on public.profiles;
create policy profiles_select_self_or_discover on public.profiles
  for select to authenticated
  using ( id = (select auth.uid()) or public.has_level(3) );

comment on policy profiles_select_self_or_discover on public.profiles is
  '§2: volles Mitgliederverzeichnis ab `discover` (rank 3). Darunter sieht ein '
  'Mitglied nur die eigene Zeile — plus die Basisfelder aller über profiles_public.';

-- 3.2 offers / needs — Grundlage der „erweiterten Matchings" (§2, ab `discover`).
-- Die eigenen Zeilen bleiben immer sichtbar: „Ich suche / Ich biete" ist Teil des
-- Compass und damit ab `basic` pflegbar (Nav-Spec §3). Erst das Stöbern in FREMDEN
-- Angeboten/Gesuchen ist die zahlende Stufe. `connect` bekommt seine „ersten
-- Matchings" über die matches-Tabelle (serverseitig berechnet), nicht über Rohdaten.
drop policy if exists offers_select on public.offers;
create policy offers_select on public.offers
  for select to authenticated
  using ( profile_id = (select auth.uid()) or public.has_level(3) );

drop policy if exists needs_select on public.needs;
create policy needs_select on public.needs
  for select to authenticated
  using ( profile_id = (select auth.uid()) or public.has_level(3) );

-- 3.3 contact_requests — „Kontaktanfragen" ab `exchange` (rank 4).
-- Erhält die AGE-247-Härtung vollständig (status-Pinning + match_id gehört zum Paar)
-- und ergänzt zwei Dinge, die §2 verlangt und die bisher fehlten:
--   * das Opt-out des Empfängers (member_settings) — bisher nicht erzwungen,
--   * den Welpenschutz (30 Tage, Kontakt nur über Match).
drop policy if exists cr_insert_self_prime on public.contact_requests;
create policy cr_insert_self_exchange on public.contact_requests
  for insert to authenticated
  with check (
    from_id = (select auth.uid())
    and public.has_level(4)
    and status = 'pending'
    and public.is_contactable(to_id)
    -- AGE-247, unverändert: ein mitgegebenes match_id MUSS zum Paar gehören.
    -- (Ohne match_id ist die Anfrage kalt — das regelt der Welpenschutz unten.)
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
    -- Welpenschutz: an ein neues Mitglied nur MIT Match. Das match_id-Pinning oben
    -- stellt sicher, dass dieses Match auch wirklich zu diesem Paar gehört.
    and ( match_id is not null or not public.is_new_member(to_id) )
  );

comment on policy cr_insert_self_exchange on public.contact_requests is
  'AGE-311/§2: Kontaktanfragen ab `exchange` (rank 4) — kein freies Anschreiben ab '
  'Basic. Erhält die AGE-247-Härtung (nur `pending`, match_id muss zum Paar gehören) '
  'und erzwingt zusätzlich das Opt-out des Empfängers sowie den 30-Tage-Welpenschutz '
  '(an neue Mitglieder nur über ein Match).';

-- 3.4 posts — „Aktivität" ab `exchange` (rank 4).
-- 'prime'/'legacy' sind weg (s. Kopf); 'members' trägt jetzt die Stufung. comments /
-- post_likes hängen per 20260612090845 an der Sichtbarkeit des Eltern-Posts und
-- folgen dieser Änderung automatisch — die Tier-Logik bleibt an EINER Stelle.
update public.posts set visibility = 'members' where visibility in ('prime', 'legacy');
alter table public.posts drop constraint posts_visibility_check;
alter table public.posts add constraint posts_visibility_check
  check (visibility in ('public', 'members'));

drop policy if exists posts_select_by_visibility on public.posts;
create policy posts_select_by_visibility on public.posts
  for select to authenticated
  using (
    visibility = 'public'
    or ( visibility = 'members' and public.has_level(4) )
    or author_id = (select auth.uid())
  );

comment on policy posts_select_by_visibility on public.posts is
  '§2: die Aktivität ist ab `exchange` (rank 4) lesbar. Öffentliche Beiträge bleiben '
  'für alle sichtbar, eigene immer. comments/post_likes erben das über ihre '
  'Parent-Existenzprüfung (20260612090845).';

-- 3.5 events — für ALLE sichtbar, Teilnahme ab `exchange` (Nav-Spec §4).
-- Bewusst asymmetrisch zu posts: Events sind das Schaufenster („Basic ansehen"),
-- die Anmeldung ist die Leistung.
update public.events set visibility = 'members' where visibility in ('prime', 'legacy');
alter table public.events drop constraint events_visibility_check;
alter table public.events add constraint events_visibility_check
  check (visibility in ('public', 'members'));

drop policy if exists events_select_by_visibility on public.events;
create policy events_select_by_visibility on public.events
  for select to authenticated
  using (
    visibility in ('public', 'members')
    or host_id = (select auth.uid())
  );

comment on policy events_select_by_visibility on public.events is
  'Nav-Spec §4: Events sind für alle Mitglieder SICHTBAR (Basic ansehen). Die '
  'gestufte Nutzung sitzt auf der Anmeldung (regs_write_own), nicht auf der Sicht.';

-- 3.6 event_registrations — „Events teilnehmen" ab `exchange` (rank 4).
-- Erhält die Parent-Sichtbarkeitsprüfung aus 20260612090845.
drop policy if exists regs_write_own on public.event_registrations;
create policy regs_write_own on public.event_registrations
  for all to authenticated
  using ( profile_id = (select auth.uid()) )
  with check (
    profile_id = (select auth.uid())
    and public.has_level(4)
    and exists (select 1 from public.events e where e.id = event_registrations.event_id)
  );

comment on policy regs_write_own on public.event_registrations is
  '§2: Teilnahme ab `exchange` (rank 4). Behält die Parent-Prüfung (20260612090845): '
  'anmelden nur zu einem Event, das der Aufrufer auch sehen darf.';

-- ── 4. is_prime_plus() abräumen ──────────────────────────────────────────────
-- Erst jetzt: Policies hängen als Abhängigkeit an der Funktion, DROP vorher schlägt fehl.
drop function if exists public.is_prime_plus();

-- ── 5. SECURITY-DEFINER-RPCs nachziehen ──────────────────────────────────────
-- Diese drei duplizieren das Sichtbarkeits-Prädikat ihrer Tabelle (sie müssen an der
-- RLS vorbei zählen bzw. schreiben). Bleiben sie auf 'prime'/'legacy' stehen, ist die
-- Migration ein Loch statt eines Gates: der RPC-Weg würde weiterhin auf tote Ränge
-- prüfen und die neue Schwelle umgehen.

create or replace function public.post_engagement_counts(p_post_ids uuid[])
returns table (post_id uuid, like_count bigint, comment_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    (select count(*) from public.post_likes pl where pl.post_id = p.id),
    (select count(*) from public.comments  c  where c.post_id  = p.id)
  from public.posts p
  where cardinality(p_post_ids) <= 200
    and p.id = any (p_post_ids)
    -- Spiegelt posts_select_by_visibility (AGE-311).
    and (
      p.visibility = 'public'
      or ( p.visibility = 'members' and public.has_level(4) )
      or p.author_id = (select auth.uid())
    );
$$;
grant execute on function public.post_engagement_counts(uuid[]) to anon, authenticated;

create or replace function public.event_registration_counts(p_event_ids uuid[])
returns table (event_id uuid, registered_count bigint, waitlist_count bigint)
language sql
stable
security definer
set search_path = public
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
    -- Spiegelt events_select_by_visibility (AGE-311).
    and (
      e.visibility = 'public'
      or ( e.visibility = 'members' and (select auth.uid()) is not null )
      or e.host_id = (select auth.uid())
    );
$$;
grant execute on function public.event_registration_counts(uuid[]) to anon, authenticated;

create or replace function public.register_for_event(p_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
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

  select * into v_event from public.events e where e.id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  -- Sichtbarkeit (spiegelt events_select_by_visibility).
  if not (
    v_event.visibility in ('public', 'members')
    or v_event.host_id = v_uid
  ) then
    raise exception 'event not visible' using errcode = '42501';
  end if;

  -- Teilnahme ab `exchange` (§2). Der Host darf sein eigenes Event immer bespielen.
  -- Ohne diese Prüfung wäre der RPC der offene Seitenweg an regs_write_own vorbei.
  if not (public.has_level(4) or v_event.host_id = v_uid) then
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

comment on function public.register_for_event(uuid) is
  'Meldet den Aufrufer zum Event an und gibt den Status zurück (registered, oder '
  'waitlist bei erreichter capacity). Sperrt die Event-Zeile (for update) gegen '
  'Überbuchung; prüft Sichtbarkeit UND die Teilnahme-Stufe `exchange` (AGE-311/§2), '
  'damit der RPC kein Seitenweg an regs_write_own vorbei ist.';

-- ── 6. Veraltete „Prime+"-Kommentare richtigstellen ──────────────────────────
comment on view public.profiles_public is
  'Öffentliche Verzeichnis-Projektion (name, avatar_url, region, company, short_bio) '
  'der is_public-Profile. SECURITY DEFINER by design: bedient das Verzeichnis für JEDES '
  'eingeloggte Mitglied, unabhängig von der Basis-Tabellen-RLS, die die vollen Felder '
  'ab `discover` (rank 3) freigibt. Nur unkritische Spalten.';

comment on function public.search_directory is
  'Mitgliederverzeichnis-Suche: deutsche Volltextsuche (search_doc) + Facetten '
  '(theme/branche/region/competency, bietet/sucht). SECURITY INVOKER — die RLS '
  '(profiles_select_self_or_discover) ist die Sichtbarkeitsgrenze: unterhalb von '
  '`discover` (rank 3) sieht ein Aufrufer höchstens die eigene Zeile. Listet nur '
  'is_public-Profile.';
