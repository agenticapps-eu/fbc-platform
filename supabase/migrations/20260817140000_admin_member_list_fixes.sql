-- Zwei Befunde aus dem Diff-Review zur Admin-Mitgliederliste (AGE-566).
-- Donald, 2026-08-17. Change: openspec/changes/add-admin-member-list/.
--
-- ══ WARUM EINE ZWEITE MIGRATION UND KEINE KORREKTUR IN DER ERSTEN ══════════
-- 20260817120000 liegt bereits auf DEV **und** PROD (dort von Hand im Terminal
-- angewendet, `db:push:prod` verlangt ein TTY). Eine Korrektur IN der Datei
-- änderte nur den Arbeitsbaum: die Versionsnummer steht in beiden
-- Migrationshistorien, `db push` liefe an ihr vorbei, und der Quelltext im Repo
-- behauptete etwas, das in keiner Datenbank steht. Forward-only ist hier keine
-- Stilfrage, sondern die einzige Fassung, die ankommt.
--
-- ══ BEFUND 1 (HIGH): DER WETTLAUF IN admin_activate_member ═════════════════
-- `select p.activated_at into v_zeit ... where p.id = target` las OHNE Sperre.
-- Zwei gleichzeitige Aufrufe auf dasselbe Ziel lesen daher beide `null`, beide
-- kommen an der 22023-Prüfung vorbei, `mark_activated` schreibt wegen
-- `coalesce(activated_at, now())` nur einmal — und BEIDE schreiben eine
-- Auditzeile.
--
-- GEMESSEN, nicht hergeleitet, am lokalen Stack am 17.08.: zwei nebenläufige
-- Aufrufe, beide Rückgabe OK, `activated_at` einmal gesetzt,
-- `admin_audit` **zwei Zeilen** für eine Änderung. Der erste Messversuch mit
-- sequenziellen Aufrufen hing an der Zeilensperre des UPDATE — das war schon
-- der halbe Beleg.
--
-- Der Schaden ist nicht die doppelte Aktivierung (die gibt es nicht), sondern
-- die Historie: „Privilegierte Änderungen hinterlassen eine Spur"
-- (openspec/specs/admin/spec.md:360) ist nur dann eine Aussage über die
-- Wirklichkeit, wenn die Zahl der Spuren der Zahl der Änderungen entspricht.
-- Zwei Zeilen für eine Aktivierung erfinden einen zweiten Vorgang. Bei
-- gleichzeitiger Selbstaktivierung über `redeem-activation` steht dort sogar
-- ein Admin als Akteur einer Änderung, die das Mitglied selbst vorgenommen hat.
--
-- `for update` sperrt die Zeile beim Lesen; der zweite Aufruf wartet, liest
-- danach den gesetzten Zeitstempel und bricht mit 22023 ab — dem Fehler, den
-- die Funktion für den zweiten Aufruf ohnehin zusagt.
--
-- VERWORFEN: einen Eindeutigkeitsindex auf `admin_audit (target, action)`.
-- Er verböte auch die spätere, legitime zweite Aktivierung nach einer
-- Rücknahme — eine Fähigkeit, die es heute nicht gibt, aber der Index wäre die
-- falsche Stelle, sie zu verbieten. Und er beschriebe das Symptom, nicht den
-- ungeschützten Lesevorgang.
--
-- ══ BEFUND 2 (MEDIUM): `limit null` IST KEIN VORGABEWERT ═══════════════════
-- Ein Vorgabewert greift nur bei einem FEHLENDEN Argument. Wird `p_limit`
-- ausdrücklich als `null` übergeben, steht `limit null` im Plan — und das heißt
-- in Postgres „ohne Grenze". `src/lib/database.types.ts` erlaubt `p_limit:
-- number | null` ausdrücklich; heute übergibt kein Aufrufer `null`, die Falle
-- liegt aber offen und der Weg dorthin ist ein einziges `?? null`.
--
-- GEMESSEN am lokalen Bestand von 74 Profilen: `admin_list_members()` liefert
-- 50, `admin_list_members(null, null, null, null)` liefert **74** — die
-- zugesicherte serverseitige Blätterung ist damit versehentlich abschaltbar.
--
-- `coalesce` schließt die Lücke. Die 50 steht damit an zwei Stellen; sie bleibt
-- an beiden, weil die Signatur den Vorgabewert für den fehlenden Fall braucht
-- und der Rumpf ihn für den `null`-Fall. Der Test hält beide Wege auf
-- denselben Wert fest.
--
-- Beim OFFSET liegt KEIN Befund: `offset null` verhält sich in Postgres wie
-- `offset 0` (gemessen: derselbe Aufruf liefert 50). Das `coalesce` steht dort
-- trotzdem, weil zwei benachbarte Parameter, von denen nur einer geschützt ist,
-- den nächsten Leser zur falschen Hälfte führen. Es ist Symmetrie, keine
-- Korrektur — und deshalb trägt es auch keine Assertion: eine Zusage, die auch
-- ohne die Änderung grün wäre, prüfte nichts.

create or replace function public.admin_list_members(
  p_query  text default null,
  p_status text default null,
  p_limit  int  default 50,
  p_offset int  default 0
)
returns table (
  id               uuid,
  name             text,
  avatar_url       text,
  region           text,
  company          text,
  short_bio        text,
  branche          text,
  tier             text,
  roles            text[],
  competencies     text[],
  has_offers       boolean,
  has_needs        boolean,
  offer_categories text[],
  need_categories  text[],
  login_email      text,
  bestaetigt       boolean,
  member_since     date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  muster text;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin_list_members' using errcode = '42501';
  end if;

  if p_status is not null and p_status not in ('alle', 'aktiviert', 'offen') then
    raise exception 'unbekannter Status: %', p_status using errcode = '22023';
  end if;

  muster := case
    when coalesce(btrim(p_query), '') = '' then null
    else '%' || replace(replace(replace(btrim(p_query), '!', '!!'), '%', '!%'), '_', '!_') || '%'
  end;

  return query
    select
      p.id, p.name, p.avatar_url, p.region, p.company, p.short_bio,
      p.branche, p.tier, p.roles, p.competencies,
      exists (select 1 from public.offers o where o.profile_id = p.id) as has_offers,
      exists (select 1 from public.needs  n where n.profile_id = p.id) as has_needs,
      coalesce((select array_agg(distinct o.category order by o.category)
                  from public.offers o
                 where o.profile_id = p.id and o.category is not null), '{}'::text[]),
      coalesce((select array_agg(distinct n.category order by n.category)
                  from public.needs n
                 where n.profile_id = p.id and n.category is not null), '{}'::text[]),
      u.email::text,
      (p.activated_at is not null),
      p.member_since
    from public.profiles p
    join auth.users u on u.id = p.id
    where (muster is null
           or p.name ilike muster escape '!'
           or u.email ilike muster escape '!')
      and (p_status is null or p_status = 'alle'
           or (p_status = 'aktiviert' and p.activated_at is not null)
           or (p_status = 'offen'     and p.activated_at is null))
    order by (p.activated_at is not null), p.name, p.id
    -- Ein ausdrückliches `null` wirkt sonst als „ohne Grenze", nicht als
    -- Vorgabewert. Siehe Befund 2 im Kopf dieser Datei.
    limit coalesce(p_limit, 50) offset coalesce(p_offset, 0);
end $$;

create or replace function public.admin_activate_member(target uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_zeit timestamptz;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin_activate_member' using errcode = '42501';
  end if;

  -- `for update` und nicht bloss `select`: ohne die Sperre lesen zwei
  -- gleichzeitige Aufrufe beide `null` und schreiben beide eine Auditzeile.
  -- Siehe Befund 1 im Kopf dieser Datei — gemessen, nicht vermutet.
  select p.activated_at into v_zeit
    from public.profiles p where p.id = target
     for update;
  if not found then
    raise exception 'Profil % existiert nicht', target using errcode = 'P0002';
  end if;
  if v_zeit is not null then
    raise exception 'Profil % ist bereits bestaetigt', target using errcode = '22023';
  end if;

  v_zeit := public.mark_activated(target);

  insert into public.admin_audit (actor, action, target)
  values ((select auth.uid()), 'activate_member', target);

  return v_zeit;
end $$;

-- `create or replace` erhält die bestehenden Rechte — hier trotzdem
-- ausgesprochen, weil in diesem Projekt schon einmal eine Annahme über vererbte
-- Rechte falsch war (AGE-312) und ein Grant-Block billiger ist als die Probe.
revoke execute on function public.admin_list_members(text, text, int, int) from public, anon;
grant  execute on function public.admin_list_members(text, text, int, int) to authenticated;
revoke execute on function public.admin_activate_member(uuid) from public, anon;
grant  execute on function public.admin_activate_member(uuid) to authenticated;

comment on function public.admin_activate_member(uuid) is
  'Aktiviert ein fremdes Profil und schreibt in DERSELBEN Transaktion nach '
  'admin_audit (AGE-566). Liest die Zielzeile MIT for update: ohne die Sperre '
  'kamen zwei gleichzeitige Aufrufe beide an der 22023-Pruefung vorbei und '
  'schrieben zwei Spuren fuer eine Aenderung (gemessen 17.08.). Bricht mit '
  '22023 ab, wenn das Ziel schon bestaetigt ist. Steht NEBEN mark_activated, '
  'die bewusst ohne Admin-Pruefung bleibt (Einloeseweg von redeem-activation '
  'mit service_role).';
