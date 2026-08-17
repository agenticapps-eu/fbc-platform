-- Mitgliederliste für Admins: `admin_list_members` (AGE-566).
-- Donald, 2026-08-17. Change: openspec/changes/add-admin-member-list/.
--
-- ══ WARUM EIN NEUER LESEPFAD UND KEINE GELOCKERTE BEDINGUNG ════════════════
-- Nach dem WordPress-Import (AGE-534) stehen 70 Mitglieder mit
-- `activated_at = null` in der Datenbank. Die SELECT-Policy auf `profiles`
-- lautet
--
--   is_activated() and activated_at is not null and (id = auth.uid() or has_level(3))
--
-- und `search_directory` ist SECURITY INVOKER, läuft also unter den Rechten des
-- Aufrufers. Ein unbestätigtes Profil ist damit über den Verzeichnisweg für
-- NIEMANDEN sichtbar — auch nicht für einen Admin. Genau diese Mitglieder sind
-- der Anlass der Funktion.
--
-- VERWORFEN: `or public.is_admin()` an die Aktivierungsbedingung hängen.
-- Dieselbe Bedingung steht an vier Stellen, drei davon mitgliedersichtbar
-- (Policy, `profiles_public`, mehrere DEFINER-Funktionen). „An einer Stelle
-- lockern" gibt es nicht, und ein Fehler dort träfe nicht die zwei Admins,
-- sondern alle Mitglieder.
--
-- VERWORFEN: `search_directory` in einen gemeinsamen Kern zerlegen und beide
-- Aufrufer darauf setzen. Sauberer gegen Divergenz, aber es wäre ein Eingriff in
-- eine funktionierende, mitgliedersichtbare Funktion, um eine Admin-Ansicht zu
-- bauen. Der PREIS der Ablehnung ist, dass die Verzeichnisprojektion nun zweimal
-- besteht — dagegen steht ein Paritätstest über Spalten UND Inhalt
-- (supabase/tests/admin_member_list_test.sql).
--
-- ══ WARUM KEIN `is_public`-FILTER ══════════════════════════════════════════
-- `search_directory` listet nur `is_public`-Profile; das ist die Wahl des
-- Mitglieds, wer es im VERZEICHNIS sieht. Eine Verwaltungsliste, die ein
-- Mitglied nicht mehr anzeigt, sobald es sich aus dem Verzeichnis nimmt,
-- verlöre genau die Fälle, für die man sie aufruft. Die Grenze hier ist
-- `is_admin()`, nicht die Sichtbarkeitswahl des Mitglieds.
--
-- ══ WARUM DER SUCHBEGRIFF OPTIONAL IST, ANDERS ALS BEI admin_find_profile ══
-- Dort erzwingen drei Zeichen genau das Aufzählen, das DIESE Funktion tun soll
-- (20260811090300:306). Der Schutz war richtig, solange es keine Liste geben
-- durfte; ihn hier nachzubauen hieße, eine Liste zu bauen, die nichts listet.
-- Die Jokerzeichen-Entschärfung (`%`, `_`, Escape `!`) wird dagegen ÜBERNOMMEN:
-- sie schützt vor kaputten Mustern, nicht vor dem Aufzählen, und dieser Zweck
-- bleibt.
--
-- ══ WARUM EIN UNBEKANNTER STATUS ABBRICHT ══════════════════════════════════
-- Ein vertippter Filter, der stillschweigend wie `alle` wirkt, sieht in der
-- Oberfläche aus wie ein leerer Filter: der Admin hielte eine ungefilterte
-- Liste für eine gefilterte. 22023 ist billiger als dieser Irrtum.
--
-- ══ DIE SORTIERUNG UND IHRE FOLGE ══════════════════════════════════════════
-- Sortiert wird: UNBESTÄTIGTE ZUERST, dann `name`, dann `id`.
--
-- Der `id`-Stichentscheid ist nicht schmückend. Nach `name` allein ist die
-- Reihenfolge bei Namensdubletten und bei `null` unbestimmt, und eine
-- unbestimmte Reihenfolge lässt beim Blättern Zeilen doppelt erscheinen oder
-- ausfallen — der Test mit zwei gleichnamigen Mitgliedern und einem ohne Namen
-- ist ohne ihn nicht erfüllbar.
--
-- Die FOLGE der ersten Sortierstufe ist zu benennen statt zu verschweigen: eine
-- Aktivierung verschiebt eine Zeile aus der ersten Gruppe in die zweite, sie
-- wandert also zwischen den Seiten. Das ist der Preis dafür, dass die Liste die
-- Frage „wer wartet noch?" schon durch ihre Reihenfolge beantwortet — und der
-- Grund, warum die Fläche nach einer Aktivierung neu lädt.
--
-- ══ WARUM BLÄTTERN VON ANFANG AN ═══════════════════════════════════════════
-- Bei 70 Datensätzen bringt es noch nichts. Die Signatur später zu ändern, wenn
-- sie Aufrufer hat, kostet mehr als sie jetzt richtig zu setzen.
--
-- ALLE VIER PARAMETER TRAGEN EINEN VORGABEWERT. Ohne sie scheiterte ein
-- argumentloser Aufruf mit 42883 („function does not exist") statt der
-- zugesicherten 42501 — der Aufrufer bekäme also einen anderen Fehler als
-- versprochen. Gefunden im Plan-Review, bevor eine Zeile Code stand.
--
-- Forward-only.

create function public.admin_list_members(
  p_query  text default null,
  p_status text default null,
  p_limit  int  default 50,
  p_offset int  default 0
)
returns table (
  -- Die ersten vierzehn Spalten sind die von `search_directory`, in deren
  -- Reihenfolge — daran hängt die Verzeichnis-Ansicht, die dieselbe Karte
  -- speist. Eine ZAHL steht hier bewusst nirgends: sie war schon einmal falsch
  -- (dreizehn, bis directory_search_categories zwei Spalten hinzufügte), und
  -- der Katalogvergleich im Test bestimmt die Projektion, nicht eine Zusage
  -- über ihre Größe.
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
  -- Und was die Verwaltungssichten zusätzlich brauchen.
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

  -- `!` als ESCAPE statt des üblichen Backslash, wie in admin_find_profile: der
  -- Backslash müsste hier in drei Schichten geschrieben werden (SQL-Literal,
  -- plpgsql, Migration) und war dort beim ersten Versuch prompt zwei Zeichen
  -- lang — „invalid escape string".
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
    limit p_limit offset p_offset;
end $$;

-- Nichts wird geerbt (AGE-312). EXECUTE liegt bei `authenticated`, damit die
-- Abwehr IN der Funktion stattfindet und prüfbar ist — dasselbe Muster wie bei
-- den vier Nachbarn aus 20260811090300.
revoke execute on function public.admin_list_members(text, text, int, int) from public, anon;
grant  execute on function public.admin_list_members(text, text, int, int) to authenticated;

comment on function public.admin_list_members(text, text, int, int) is
  'Mitgliederliste fuer Admins (AGE-566). SECURITY DEFINER, WEIL ein Profil mit '
  'activated_at is null ueber jeden anderen Lesepfad fuer niemanden sichtbar '
  'ist — auch nicht fuer einen Admin. Liefert die vierzehn Verzeichnisspalten '
  'von search_directory plus login_email, bestaetigt und member_since; KEINE '
  'Spalte aus profile_contacts. p_status: alle|aktiviert|offen, unbekannt '
  'bricht mit 22023 ab. Sortiert unbestaetigte zuerst, dann name, dann id — '
  'eine Aktivierung laesst eine Zeile deshalb zwischen den Seiten wandern. '
  'Kein is_public-Filter: die Verwaltungsliste ist keine Verzeichnisansicht.';
