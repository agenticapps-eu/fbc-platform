-- Admin-Bearbeitung fremder Profile: Spur + drei Funktionen (AGE-498, C6).
-- Donald, 2026-08-11. Spec: openspec/changes/profile-cover-and-admin-edit/.
--
-- ══ WARUM EINE FUNKTION UND KEINE POLICY ═══════════════════════════════════
-- Der wichtigste Punkt dieses Changes, und eine Falle, in die man genau einmal
-- tappt. `public.profiles` trägt SPALTENWEISE UPDATE-Grants (17 Spalten für
-- authenticated, siehe 20260715140000 + 20260721070000 + 20260811090000)
-- ZUSÄTZLICH zur Policy `profiles_update_own`. Postgres prüft das Grant VOR
-- der Policy.
--
-- Eine zusätzliche Policy `profiles_update_admin` wäre deshalb vollständig
-- wirkungslos: der Admin liefe trotz passender Policy in „permission denied
-- for table profiles", und zwar erst zur Laufzeit. Wirksam würde sie erst
-- durch ein Aufmachen des Spalten-Grants — und das gälte dann für JEDES
-- Mitglied, nicht nur für Admins.
--
-- SECURITY DEFINER läuft als Eigentümer und geht an Grant UND Policy vorbei.
-- Die Client-Grant-Fläche bleibt unangetastet, die Admin-Rechte stehen an
-- genau einer Stelle, und die Spur hängt im Rumpf statt in einer Policy.
--
-- ══ WARUM ES AUCH EINEN LESEPFAD GIBT ══════════════════════════════════════
-- Aus dem Fremd-Review zum Change (REVIEWS.md, codex, HIGH) — ohne ihn wäre
-- das hier gebaut worden und hätte am Anlassfall nicht gegriffen:
--
--   * `profiles_select_self_or_discover` (20260806080100:75-81) verlangt
--     `activated_at is not null` am ZIELPROFIL.
--   * `profiles_public` (:489-495) verlangt dasselbe.
--
-- Ein importiertes, noch nicht bestätigtes Mitglied — genau das ausgesperrte,
-- für das der ganze Fallback gebaut wird — ist damit für NIEMANDEN sichtbar,
-- auch nicht für einen Admin und unabhängig von dessen Stufe. `/p/:id` meldete
-- „Profil nicht gefunden", der Bearbeiten-Button erschiene nie, und
-- fetchProfileEditorData bekäme null Zeilen.
--
-- VERWORFEN: `or public.is_admin()` in profiles_select_self_or_discover. Kürzer,
-- und der Weg liefe über /p/:id. Verworfen, weil dann ein zweites Mal in einer
-- Policy steht, was schon in Funktionen steht — und weil `profiles_public` davon
-- gar nicht erreicht würde: die Sicht umgeht die Policies, das ist ihr Zweck.
-- Ein Admin-Zugang, der an zwei Stellen halb gilt, ist schlechter als einer,
-- der an einer Stelle ganz gilt.
--
-- ══ WARUM KEIN DYNAMISCHES SQL ═════════════════════════════════════════════
-- `execute format(...)` über Schlüssel aus einem jsonb ist die klassische
-- Injektionsfläche in SECURITY DEFINER. Stattdessen ein statisches UPDATE mit
-- `case when patch ? 'feld' then … else feld end` je Spalte. Länglich, aber es
-- unterscheidet „nicht geschickt" von „auf leer gesetzt" — was coalesce nicht
-- kann.
--
-- Und das Dekodieren ist FELDWEISE, nicht einheitlich (Review, MEDIUM):
-- interests/competencies/roles/videos sind text[], socials ist jsonb,
-- is_public ist boolean, paid_until ist date, legacy_price ist numeric. Ein
-- durchgängiges `patch ->> 'feld'` legte in den Array-Spalten Text ab oder
-- scheiterte.
--
-- Ein fehlschlagender Cast BRICHT AB, und das ist gewollt: `paid_until:
-- "morgen"` darf keine Zeile schreiben. Eine eigene Fehlermeldung je Feld wäre
-- Aufwand ohne Empfänger — der einzige Aufrufer ist ein Formular, das seine
-- Felder bereits typisiert.
--
-- ══ WARUM DIE SPUR JETZT ENTSTEHT UND NICHT SPÄTER ═════════════════════════
-- Beide Reviewer haben es unabhängig als HIGH gemeldet. Ein Admin ändert über
-- diese Wege Sichtbarkeit, Identität, bezahlte Laufzeiten und Preise. Die
-- frühere Fassung schob es auf („später anhängbar"); der Aufwand ist eine
-- Tabelle und je zwei Zeilen. Festgehalten wird der PATCH, nicht die ganze
-- Zeile: was geändert werden sollte, reicht zum Nachvollziehen, und ein
-- Zeilenabbild verdoppelte bei jedem Speichern das Profil in eine Tabelle, die
-- niemand aufräumt.
--
-- Forward-only.

-- ── 1. Die Spur ─────────────────────────────────────────────────────────────
create table public.admin_audit (
  id      bigint generated always as identity primary key,
  actor   uuid not null references public.profiles (id),
  action  text not null,
  target  uuid not null,
  payload jsonb,
  at      timestamptz not null default now()
);

alter table public.admin_audit enable row level security;

-- Lesen: nur Admins. Schreiben: NIEMAND von außen — die Zeilen entstehen
-- ausschließlich in den DEFINER-Funktionen unten und in der Edge Function
-- (service_role). Ein INSERT-Grant für authenticated machte die Spur
-- fälschbar und damit wertlos.
grant select on public.admin_audit to authenticated;

create policy admin_audit_read on public.admin_audit
  for select to authenticated
  using ( public.is_admin() );

create index admin_audit_target_idx on public.admin_audit (target, at desc);

comment on table public.admin_audit is
  'Spur privilegierter Aenderungen an fremden Konten (AGE-498). Geschrieben '
  'nur aus den admin_*-DEFINER-Funktionen und aus admin-change-email; '
  'authenticated haelt bewusst KEIN INSERT, sonst waere die Spur faelschbar. '
  'payload traegt den Patch, nicht die ganze Zeile.';

-- ── 2. Schreiben ────────────────────────────────────────────────────────────
create or replace function public.admin_update_profile(target uuid, patch jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  k text;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin_update_profile' using errcode = '42501';
  end if;

  if jsonb_typeof(patch) is distinct from 'object' then
    raise exception 'patch muss ein JSON-Objekt sein' using errcode = '22023';
  end if;
  if patch = '{}'::jsonb then
    raise exception 'patch ist leer' using errcode = '22023';
  end if;

  -- Weißliste. Ein unbekannter Schlüssel bricht ab, statt still zu
  -- verschwinden: ein ignoriertes Feld meldet dem Admin Erfolg für etwas, das
  -- nicht geschehen ist. Draußen bleiben tier, potential_score,
  -- profile_completion, search_doc, member_number und activated_at.
  foreach k in array (select array(select jsonb_object_keys(patch))) loop
    if k not in (
      -- profiles (die client-schreibbare Menge + cover_url)
      'name', 'avatar_url', 'cover_url', 'region', 'company', 'short_bio',
      'branche', 'headline', 'roles', 'socials', 'website', 'competencies',
      'dev_focus', 'goals', 'interests', 'is_public', 'videos',
      -- profile_contacts
      'email', 'phone',
      -- profile_legacy
      'paid_until', 'legacy_tier', 'legacy_price', 'legacy_source_id'
    ) then
      raise exception 'unbekanntes Feld im patch: %', k using errcode = '22023';
    end if;
  end loop;

  update public.profiles set
    name         = case when patch ? 'name'         then patch ->> 'name'         else name end,
    avatar_url   = case when patch ? 'avatar_url'   then patch ->> 'avatar_url'   else avatar_url end,
    cover_url    = case when patch ? 'cover_url'    then patch ->> 'cover_url'    else cover_url end,
    region       = case when patch ? 'region'       then patch ->> 'region'       else region end,
    company      = case when patch ? 'company'      then patch ->> 'company'      else company end,
    short_bio    = case when patch ? 'short_bio'    then patch ->> 'short_bio'    else short_bio end,
    branche      = case when patch ? 'branche'      then patch ->> 'branche'      else branche end,
    headline     = case when patch ? 'headline'     then patch ->> 'headline'     else headline end,
    website      = case when patch ? 'website'      then patch ->> 'website'      else website end,
    dev_focus    = case when patch ? 'dev_focus'    then patch ->> 'dev_focus'    else dev_focus end,
    goals        = case when patch ? 'goals'        then patch ->> 'goals'        else goals end,
    is_public    = case when patch ? 'is_public'    then (patch ->> 'is_public')::boolean else is_public end,
    socials      = case when patch ? 'socials'      then patch -> 'socials'       else socials end,
    roles        = case when patch ? 'roles'
                        then (select array(select jsonb_array_elements_text(patch -> 'roles')))
                        else roles end,
    competencies = case when patch ? 'competencies'
                        then (select array(select jsonb_array_elements_text(patch -> 'competencies')))
                        else competencies end,
    interests    = case when patch ? 'interests'
                        then (select array(select jsonb_array_elements_text(patch -> 'interests')))
                        else interests end,
    videos       = case when patch ? 'videos'
                        then (select array(select jsonb_array_elements_text(patch -> 'videos')))
                        else videos end
  where id = target;

  if not found then
    raise exception 'Profil % existiert nicht', target using errcode = 'P0002';
  end if;

  -- Die Kontaktzeile. Sie ist NICHT die Login-Adresse (die steht in
  -- auth.users), aber sie ist die, an die notify-contact-request schickt —
  -- ohne sie liefen die Benachrichtigungen nach einer Adressänderung weiter
  -- an das Postfach, an das das Mitglied gerade nicht herankommt.
  if patch ?| array['email', 'phone'] then
    insert into public.profile_contacts as pc (profile_id, email, phone)
    values (target, patch ->> 'email', patch ->> 'phone')
    on conflict (profile_id) do update set
      email = case when patch ? 'email' then excluded.email else pc.email end,
      phone = case when patch ? 'phone' then excluded.phone else pc.phone end;
  end if;

  if patch ?| array['paid_until', 'legacy_tier', 'legacy_price', 'legacy_source_id'] then
    insert into public.profile_legacy as pl
      (profile_id, paid_until, legacy_tier, legacy_price, legacy_source_id)
    values (
      target,
      (patch ->> 'paid_until')::date,
      patch ->> 'legacy_tier',
      (patch ->> 'legacy_price')::numeric,
      patch ->> 'legacy_source_id')
    on conflict (profile_id) do update set
      paid_until       = case when patch ? 'paid_until'       then excluded.paid_until       else pl.paid_until end,
      legacy_tier      = case when patch ? 'legacy_tier'      then excluded.legacy_tier      else pl.legacy_tier end,
      legacy_price     = case when patch ? 'legacy_price'     then excluded.legacy_price     else pl.legacy_price end,
      legacy_source_id = case when patch ? 'legacy_source_id' then excluded.legacy_source_id else pl.legacy_source_id end;
  end if;

  insert into public.admin_audit (actor, action, target, payload)
  values ((select auth.uid()), 'update_profile', target, patch);
end $$;

revoke execute on function public.admin_update_profile(uuid, jsonb) from public, anon;
grant  execute on function public.admin_update_profile(uuid, jsonb) to authenticated;

comment on function public.admin_update_profile(uuid, jsonb) is
  'Aendert Stamm-, Kontakt- und Altdaten eines fremden Profils (AGE-498). '
  'SECURITY DEFINER, WEIL die spaltenweisen UPDATE-Grants auf profiles VOR '
  'der Policy greifen — eine Admin-Policy allein bliebe wirkungslos. '
  'EXECUTE liegt bei authenticated, damit die Abwehr IN der Funktion '
  'stattfindet und pruefbar ist. Weisliste ohne tier/potential_score/'
  'profile_completion/search_doc/member_number/activated_at.';

-- ── 3. Lesen: eine Zeile ────────────────────────────────────────────────────
create or replace function public.admin_get_profile(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ergebnis jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin_get_profile' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'profile', to_jsonb(p) - 'search_doc',
    'contact', to_jsonb(c),
    'legacy',  to_jsonb(l))
    into ergebnis
    from public.profiles p
    left join public.profile_contacts c on c.profile_id = p.id
    left join public.profile_legacy   l on l.profile_id = p.id
   where p.id = target;

  if ergebnis is null then
    raise exception 'Profil % existiert nicht', target using errcode = 'P0002';
  end if;
  return ergebnis;
end $$;

revoke execute on function public.admin_get_profile(uuid) from public, anon;
grant  execute on function public.admin_get_profile(uuid) to authenticated;

comment on function public.admin_get_profile(uuid) is
  'Liest ein fremdes Profil samt Kontakt- und Altdaten am Aktivierungs-Gate '
  'vorbei (AGE-498). Ohne diesen Weg ist ein unbestaetigtes Profil fuer '
  'NIEMANDEN sichtbar — auch nicht fuer einen Admin — und der Fallback fuer '
  'ein ausgesperrtes Mitglied waere unerreichbar. search_doc bleibt drausen.';

-- ── 4. Lesen: der Einstieg ──────────────────────────────────────────────────
-- Es gibt keine Mitgliederliste (AGE-304), und /p/:id existiert fuer
-- unbestaetigte Profile nicht. Ohne diese Suche muesste der Admin die UUID aus
-- der Datenbank holen — also genau das tun, was dieser Change abschafft.
-- Bewusst KEINE Liste: kein Blaettern, kein Filtern, harte Obergrenze.
create or replace function public.admin_find_profile(needle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ergebnis jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin_find_profile' using errcode = '42501';
  end if;
  if length(btrim(coalesce(needle, ''))) < 3 then
    raise exception 'Suchbegriff zu kurz' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into ergebnis from (
    select p.id, p.name, p.tier, u.email as login_email,
           (p.activated_at is not null) as bestaetigt
      from public.profiles p
      join auth.users u on u.id = p.id
     where u.email ilike '%' || btrim(needle) || '%'
        or p.name  ilike '%' || btrim(needle) || '%'
     order by p.name
     limit 20) t;

  return ergebnis;
end $$;

revoke execute on function public.admin_find_profile(text) from public, anon;
grant  execute on function public.admin_find_profile(text) to authenticated;

comment on function public.admin_find_profile(text) is
  'Sucht EIN Mitglied ueber Login-Adresse oder Name (AGE-498). Hoechstens 20 '
  'Treffer, mindestens 3 Zeichen — ein Einstieg, keine Mitgliederliste; die '
  'bleibt AGE-304. Noetig, weil /p/:id fuer unbestaetigte Profile nicht '
  'existiert.';
