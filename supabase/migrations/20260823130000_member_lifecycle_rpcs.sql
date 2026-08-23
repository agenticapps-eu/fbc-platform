-- Lebenszyklus eines Mitglieds, Teil B: die vier Funktionen (AGE-581).
-- Donald, 2026-08-23. Change: openspec/changes/add-admin-member-lifecycle/.
--
-- ══ WARUM EXECUTE BEI `service_role` LIEGT UND NICHT BEI `authenticated` ═══
-- Alle übrigen `admin_*`-Funktionen liegen bei `authenticated`, damit die
-- Abwehr IN der Funktion stattfindet und dort prüfbar ist. Diese vier weichen
-- davon ab, und der Grund ist ihre Wirkung AUSSERHALB der Datenbank: die zweite
-- Hälfte der Sperre ist `auth.users.banned_until`, und die kann die Datenbank
-- nicht selbst herstellen — `auth.users` gehört GoTrue.
--
-- Läge EXECUTE bei `authenticated`, könnte ein Admin die Funktion unmittelbar
-- über die Datenbank-API rufen und einen Zustand erzeugen, in dem `disabled_at`
-- gesetzt ist und der Ban fehlt. Die zugesagte Doppelsperre wäre dann keine
-- Zusage, sondern eine Gewohnheit der Oberfläche. Gefunden im Plan-Review.
--
-- Die Edge Function `admin-set-member-ban` ist damit der einzige Eingang.
--
-- ══ WARUM DIE HANDELNDE PERSON ALS PARAMETER KOMMT ════════════════════════
-- Aus derselben Entscheidung folgt, dass `auth.uid()` beim Aufruf LEER ist —
-- `service_role` ist der Server, kein Mensch. `is_admin()` liefe also ins
-- Leere. Deshalb `actor uuid` als Parameter und `is_admin_uid(actor)` im Rumpf.
--
-- Das ist kein Loch: nur der Server darf die Funktion überhaupt rufen, und er
-- hat den JWT vorher am Gateway prüfen lassen. Dasselbe Muster benutzt
-- `admin-change-email` seit AGE-498.
--
-- ══ WARUM `is_admin_uid` MITGEHT ══════════════════════════════════════════
-- Sie hatte dieselbe Lücke wie `is_admin()` — sie las allein `staff_roles`.
-- Das ist der DRITTE Ort desselben Befunds; die ersten beiden stehen in Teil A.
--
-- ══ DIE ÜBERGANGSTABELLE ══════════════════════════════════════════════════
--
--   Ausgangszustand              | deaktivieren     | reaktivieren | löschen  | wiederherstellen
--   -----------------------------|------------------|--------------|----------|------------------
--   aktiv                        | setzt disabled_at| 22023        | setzt deleted_at | 22023
--   deaktiviert, Ban gesetzt     | 22023            | hebt auf     | setzt deleted_at | 22023
--   deaktiviert, Ban FEHLT       | arbeitet nach    | hebt auf     | setzt deleted_at | 22023
--   gelöscht                     | 22023            | 22023        | 22023    | leert deleted_at
--   Ziel existiert nicht         | P0002            | P0002        | P0002    | P0002
--   Ziel ist der actor selbst    | 22023            | —            | 22023    | —
--
-- Die Zeile „deaktiviert, Ban fehlt" ist der Grund für die Tabelle. Sie ist
-- der einzige Fall, in dem dieselbe Handlung auf denselben SICHTBAREN Zustand
-- nicht abbricht, sondern nacharbeitet — sonst wäre ein Teilfehlschlag der
-- Edge Function durch die Oberfläche nicht heilbar: der Admin müsste erst
-- reaktivieren, um erneut deaktivieren zu können, und liesse das Konto dabei
-- kurz wieder sichtbar werden.
--
-- ══ WARUM LÖSCHEN `disabled_at` NICHT ANFASST ═════════════════════════════
-- Der erste Entwurf setzte es mit — „die Sperre kommt mit". Damit wäre die
-- einzige Information verloren, die das Wiederherstellen braucht: war dieses
-- Mitglied VOR dem Löschen schon deaktiviert?
--
-- Ohne sie hat `admin_restore_member` keine richtige Antwort. Nur `deleted_at`
-- zu leeren liesse einen zuvor aktiven Menschen deaktiviert zurück; beide zu
-- leeren gäbe einem zuvor gesperrten seinen Zugang zurück. Ein Feld, das zwei
-- Sachverhalte trägt, kann keinen davon zurückgeben.
--
-- `deleted_at` gatet stattdessen selbst — die Prädikate aus Teil A prüfen es
-- eigenständig.
--
-- ══ WARUM JEDE FUNKTION IHRE ZEILE SPERRT ═════════════════════════════════
-- `for update`. Zwei gleichzeitige Aufrufe sollen eine Protokollzeile
-- erzeugen, nicht zwei über eine Änderung, die einmal stattfand.
--
-- ══ WARUM DIE SPUR KEINE ZUTAT IST ════════════════════════════════════════
-- `openspec/specs/admin/spec.md` — „Privilegierte Änderungen hinterlassen eine
-- Spur" — verlangt für JEDE Admin-Änderung an einem fremden Konto eine Zeile in
-- `admin_audit`, ausdrücklich „mit der Fähigkeit zusammen". Deshalb EINE
-- Transaktion und ausdrücklich KEIN `exception`-Block um das INSERT: sonst
-- könnte eine Sichtbarkeitsänderung ohne Spur bestehen.
--
-- Geschrieben wird genau dann, wenn sich ein Feld TATSÄCHLICH geändert hat.
-- Das Nachsetzen eines fehlenden Bans ändert `disabled_at` nicht und schreibt
-- deshalb keine zweite Zeile über eine Sichtbarkeitsänderung.
--
-- Forward-only.

-- ── 0. Der dritte Ort desselben Befunds ─────────────────────────────────────

create or replace function public.is_admin_uid(p_profile_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
      from public.staff_roles s
      join public.profiles p on p.id = s.profile_id
     where s.profile_id = p_profile_id
       and s.role = 'admin'
       and p.activated_at is not null
       and p.disabled_at is null
       and p.deleted_at  is null
  );
$$;

comment on function public.is_admin_uid(uuid) is
  'Ist p_profile_id Admin UND zugangsberechtigt? Seit AGE-581 genuegt die Zeile '
  'in staff_roles NICHT mehr — dieselbe Verschaerfung wie is_admin(), und aus '
  'demselben Grund. Diese Fassung ist die, die die Edge Functions rufen: sie '
  'laufen als service_role, wo auth.uid() leer ist.';

-- ── 1. Ein gemeinsamer Vorspann ─────────────────────────────────────────────
-- Vier Funktionen prüfen dieselben drei Dinge. Eine Hilfsfunktion statt vier
-- Kopien — nicht aus Sparsamkeit, sondern weil vier Kopien viermal
-- auseinanderlaufen können.

create function public.lifecycle_guard(target uuid, actor uuid, was text)
  returns public.profiles
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  zeile public.profiles;
begin
  if not public.is_admin_uid(actor) then
    raise exception 'forbidden: %', was using errcode = '42501';
  end if;

  -- `for update` sperrt die Zeile fuer die Dauer der Transaktion. Ohne sie
  -- koennten zwei gleichzeitige Aufrufe beide „noch nicht deaktiviert" lesen
  -- und beide eine Protokollzeile schreiben.
  select * into zeile from public.profiles p where p.id = target for update;
  if not found then
    raise exception 'Profil % existiert nicht', target using errcode = 'P0002';
  end if;

  return zeile;
end $$;

revoke execute on function public.lifecycle_guard(uuid, uuid, text) from public, anon, authenticated;
grant  execute on function public.lifecycle_guard(uuid, uuid, text) to service_role;

comment on function public.lifecycle_guard(uuid, uuid, text) is
  'Gemeinsamer Vorspann der vier Lebenszyklus-Funktionen (AGE-581): prueft die '
  'Admin-Eigenschaft des actor, sperrt die Zielzeile mit FOR UPDATE und gibt '
  'sie zurueck. Eine Kopie statt vier, weil vier Kopien viermal auseinander '
  'laufen koennen.';

-- ── 2. Ist der Ban gesetzt? ─────────────────────────────────────────────────
-- Die Uebergangstabelle unterscheidet „deaktiviert, Ban gesetzt" von
-- „deaktiviert, Ban fehlt". Die Wahrheit darueber steht in auth.users.

create function public.is_banned(p_profile_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(
    (select u.banned_until is not null and u.banned_until > now()
       from auth.users u where u.id = p_profile_id),
    false);
$$;

revoke execute on function public.is_banned(uuid) from public, anon, authenticated;
grant  execute on function public.is_banned(uuid) to service_role;

comment on function public.is_banned(uuid) is
  'Steht fuer p_profile_id ein GoTrue-Ban in der Zukunft? (AGE-581) Nur fuer '
  'service_role: die Antwort sagt einem Mitglied nichts, was es wissen muesste, '
  'und einem Fremden etwas ueber ein fremdes Konto. Als SECURITY DEFINER mit '
  'Eigentuemer postgres darf sie auth.users lesen, wie admin_list_members auch.';

-- ── 3. Deaktivieren ─────────────────────────────────────────────────────────

create function public.admin_disable_member(
  target uuid,
  actor  uuid,
  grund  text default null)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  zeile public.profiles;
  war_schon boolean;
begin
  if target = actor then
    raise exception 'Ein Admin kann sich nicht selbst deaktivieren'
      using errcode = '22023';
  end if;

  zeile := public.lifecycle_guard(target, actor, 'admin_disable_member');

  if zeile.deleted_at is not null then
    raise exception 'Profil % ist geloescht', target using errcode = '22023';
  end if;

  war_schon := zeile.disabled_at is not null;

  -- Der einzige Fall, in dem dieselbe Handlung auf denselben sichtbaren
  -- Zustand nicht abbricht: der Ban fehlt, der Zustand ist also unvollstaendig
  -- und muss nachgearbeitet werden koennen.
  if war_schon and public.is_banned(target) then
    raise exception 'Profil % ist bereits deaktiviert', target using errcode = '22023';
  end if;

  if not war_schon then
    update public.profiles set disabled_at = now() where id = target;

    insert into public.admin_audit (actor, action, target, payload)
    values (actor, 'disable_member', target,
            jsonb_build_object('grund', grund));
  end if;

  -- `nachgesetzt` sagt der Edge Function und dem Leser des Protokolls, dass
  -- dieser Aufruf nur die zweite Haelfte nachholt.
  return jsonb_build_object(
    'disabled_at', (select p.disabled_at from public.profiles p where p.id = target),
    'nachgesetzt', war_schon);
end $$;

revoke execute on function public.admin_disable_member(uuid, uuid, text) from public, anon, authenticated;
grant  execute on function public.admin_disable_member(uuid, uuid, text) to service_role;

comment on function public.admin_disable_member(uuid, uuid, text) is
  'Nimmt ein Mitglied aus dem Verkehr (AGE-581): setzt disabled_at und schreibt '
  'in DERSELBEN Transaktion nach admin_audit. NUR service_role — die zweite '
  'Haelfte der Sperre ist auth.users.banned_until, gesetzt von der Edge '
  'Function admin-set-member-ban; laege EXECUTE bei authenticated, koennte ein '
  'Admin die Doppelsperre halbieren. Bricht mit 22023 ab, wenn das Profil '
  'bereits deaktiviert UND gebannt ist; fehlt der Ban, arbeitet sie nach, ohne '
  'eine zweite Protokollzeile zu schreiben.';

-- ── 4. Reaktivieren ─────────────────────────────────────────────────────────
-- Die Edge Function hebt den Ban ZUERST auf und ruft dann diese Funktion.
-- Andersherum waere das Profil sichtbar, waehrend die Anmeldung noch gesperrt
-- ist — und die Zeile gaelte nicht mehr als deaktiviert, die Handlung
-- verschwaende also aus der Oberflaeche, mit der man es reparieren wuerde.

create function public.admin_enable_member(target uuid, actor uuid)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  zeile public.profiles;
begin
  zeile := public.lifecycle_guard(target, actor, 'admin_enable_member');

  if zeile.deleted_at is not null then
    raise exception 'Profil % ist geloescht — erst wiederherstellen', target
      using errcode = '22023';
  end if;

  if zeile.disabled_at is null and not public.is_banned(target) then
    raise exception 'Profil % ist nicht deaktiviert', target using errcode = '22023';
  end if;

  if zeile.disabled_at is not null then
    update public.profiles set disabled_at = null where id = target;

    insert into public.admin_audit (actor, action, target)
    values (actor, 'enable_member', target);
  end if;

  return jsonb_build_object('disabled_at', null);
end $$;

revoke execute on function public.admin_enable_member(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.admin_enable_member(uuid, uuid) to service_role;

comment on function public.admin_enable_member(uuid, uuid) is
  'Gibt ein deaktiviertes Mitglied wieder frei (AGE-581). Die Edge Function '
  'hebt den Ban ZUERST auf und ruft dann diese Funktion — andersherum waere das '
  'Profil sichtbar, waehrend die Anmeldung noch gesperrt ist, und die Handlung '
  'verschwaende aus der Oberflaeche. Bricht mit 22023 ab, wenn weder '
  'disabled_at noch ein Ban besteht.';

-- ── 5. Löschen ──────────────────────────────────────────────────────────────

create function public.admin_delete_member(
  target uuid,
  actor  uuid,
  grund  text default null)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  zeile public.profiles;
begin
  if target = actor then
    raise exception 'Ein Admin kann sich nicht selbst loeschen'
      using errcode = '22023';
  end if;

  zeile := public.lifecycle_guard(target, actor, 'admin_delete_member');

  if zeile.deleted_at is not null then
    raise exception 'Profil % ist bereits geloescht', target using errcode = '22023';
  end if;

  -- disabled_at bleibt UNBERUEHRT. Siehe Kopf: sonst ist der Vorzustand
  -- verloren und das Wiederherstellen hat keine richtige Antwort mehr.
  update public.profiles set deleted_at = now() where id = target;

  insert into public.admin_audit (actor, action, target, payload)
  values (actor, 'delete_member', target,
          jsonb_build_object('grund', grund,
                             'war_deaktiviert', zeile.disabled_at is not null));

  return jsonb_build_object(
    'deleted_at', (select p.deleted_at from public.profiles p where p.id = target),
    'war_deaktiviert', zeile.disabled_at is not null);
end $$;

revoke execute on function public.admin_delete_member(uuid, uuid, text) from public, anon, authenticated;
grant  execute on function public.admin_delete_member(uuid, uuid, text) to service_role;

comment on function public.admin_delete_member(uuid, uuid, text) is
  'Entfernt ein Mitglied WEICH (AGE-581): setzt deleted_at, loescht KEINE Zeile '
  'aus profiles oder auth.users. Faesst disabled_at ausdruecklich NICHT an — '
  'sonst ginge beim Wiederherstellen die Information verloren, ob das Mitglied '
  'vorher schon deaktiviert war. Der endgueltige Entzug bleibt '
  'add-dsgvo-compliance.';

-- ── 6. Wiederherstellen ─────────────────────────────────────────────────────

create function public.admin_restore_member(target uuid, actor uuid)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  zeile public.profiles;
begin
  zeile := public.lifecycle_guard(target, actor, 'admin_restore_member');

  if zeile.deleted_at is null then
    raise exception 'Profil % ist nicht geloescht', target using errcode = '22023';
  end if;

  update public.profiles set deleted_at = null where id = target;

  insert into public.admin_audit (actor, action, target, payload)
  values (actor, 'restore_member', target,
          jsonb_build_object('bleibt_deaktiviert', zeile.disabled_at is not null));

  -- Die Edge Function entbannt NUR, wenn das Mitglied nicht ohnehin
  -- deaktiviert ist. War es vor dem Loeschen gesperrt, ist es danach wieder
  -- gesperrt — der Vorzustand, nicht ein besserer.
  return jsonb_build_object(
    'deleted_at', null,
    'entbannen', zeile.disabled_at is null);
end $$;

revoke execute on function public.admin_restore_member(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.admin_restore_member(uuid, uuid) to service_role;

comment on function public.admin_restore_member(uuid, uuid) is
  'Holt ein weich geloeschtes Mitglied zurueck (AGE-581). Gibt in `entbannen` '
  'zurueck, ob die Edge Function den Ban aufheben soll — sie tut es NUR, wenn '
  'disabled_at null ist. War das Mitglied vor dem Loeschen deaktiviert, ist es '
  'danach wieder deaktiviert.';
