-- AGE-628 — `admin_list_feedback` sagt, ob der Verfasser noch Zugang hat.
--
-- Aufgabe 8.6 aus openspec/changes/feedback-ausbauen/tasks.md. Die scheiternde
-- Zusage steht in `supabase/tests/admin_feedback_test.sql`, Abschnitt 10.
--
-- ══ WARUM DIE AUSKUNFT HIER STEHT UND NICHT IN DER FLAECHE ═════════════════
-- Die Admin-Flaeche bietet „Gespraech eroeffnen" an — aber nicht bei einem
-- deaktivierten oder geloeschten Verfasser. `admin_gespraech_oeffnen` legte den
-- Faden zwar an, doch schreiben koennte darin nur noch der Admin: die
-- Gegenseite scheitert an `is_activated()` in `messages_insert`. Ein Knopf, der
-- nur scheitern kann, ist ein Versprechen ins Leere.
--
-- Ueber `profiles` kaeme die Flaeche an die Auskunft nicht heran — ein
-- deaktiviertes Profil ist ueber jeden gewoehnlichen Lesepfad fuer niemanden
-- sichtbar, und genau das ist der Sinn des Gates. Eine zweite Abfrage je Zeile
-- waeren ausserdem 25 Abfragen je Seite.
--
-- ══ DIE BEDINGUNG WIRD AUSGESCHRIEBEN, NICHT GERUFEN ═══════════════════════
-- `is_activated_profile(f.profile_id)` waere je Zeile ein Aufruf einer
-- SECURITY-DEFINER-Funktion, die dieselbe Zeile noch einmal liest, die der
-- Join hier ohnehin schon hat. Dieselbe Entscheidung wie in `is_admin()`
-- (20260823120000): dort steht die Bedingung aus demselben Grund
-- ausgeschrieben.
--
-- Die drei Spalten sind die GANZE Zugangsbedingung, nicht nur `activated_at` —
-- siehe den Kommentar an `is_activated()`: der Name jener Funktion ist
-- unvollstaendig, die Bedingung ist es nicht.
--
-- ══ WIEDER `drop` UND NICHT `create or replace` ════════════════════════════
-- Der Rueckgabetyp bekommt eine Spalte. Die SIGNATUR bleibt dagegen
-- unveraendert `(int, int, text[], int[])` — die fuenf Signatur-Zusagen aus
-- Aufgabe 3.7 gelten weiter und muessen NICHT noch einmal gehoben werden.

drop function public.admin_list_feedback(int, int, text[], int[]);

create function public.admin_list_feedback(
  p_limit   int      default 25,
  p_offset  int      default 0,
  p_themes  text[]   default null,
  p_ratings int[]    default null
)
returns table (id uuid, rating integer, likes text, misses text, idea text,
               route text, ref_type text, created_at timestamptz,
               author_name text, profile_id uuid,
               theme text, screenshot_path text,
               author_aktiv boolean)
language sql stable security definer set search_path = ''
as $$
  select f.id, f.rating, f.likes, f.misses, f.idea, f.route, f.ref_type,
         f.created_at, coalesce(p.name, '—') as author_name, f.profile_id,
         f.theme, f.screenshot_path,
         coalesce(
           p.activated_at is not null
             and p.disabled_at is null
             and p.deleted_at  is null,
           false
         ) as author_aktiv
  from public.feedback f
  left join public.profiles p on p.id = f.profile_id
  where public.is_activated() and public.is_admin()   -- AGE-495, unveraendert
    -- `null` heisst „keine Einschraenkung". Ein leeres Array heisst es NICHT.
    and (p_themes  is null or f.theme  = any(p_themes))
    and (p_ratings is null or f.rating = any(p_ratings))
  -- `id desc` ist der zweite Ordnungsschluessel und keine Kosmetik: ohne ihn
  -- ist die Ordnung bei gleichen Zeitstempeln nicht total, und dieselbe Zeile
  -- kann auf zwei Seiten stehen.
  order by f.created_at desc, f.id desc
  -- Geklemmt, nicht abgewiesen: 1..100, `null` faellt auf die Vorgabe zurueck.
  limit  least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.admin_list_feedback(int, int, text[], int[])
  from public, anon;
grant  execute on function public.admin_list_feedback(int, int, text[], int[])
  to authenticated;

comment on function public.admin_list_feedback(int, int, text[], int[]) is
  'QM-Feedback fuer Admins, geblaettert und gefiltert (AGE-358, Blaetterung '
  'AGE-587, Filter/Screenshot/Verfasser-Zustand AGE-628). SECURITY DEFINER, '
  'WEIL der Join auf profiles den Autor-Namen auch bei nicht-oeffentlichen '
  'Profilen aufloesen muss — und seit AGE-628 auch, ob der Verfasser noch '
  'Zugang hat (author_aktiv). Gibt Zeilen NUR zurueck, wenn is_activated() '
  'and is_admin() — ein Nicht-Admin (auch matching_manager) bekommt eine '
  'leere Liste und KEINEN Fehler. p_limit auf 1..100 geklemmt statt '
  'abgewiesen, null faellt auf 25 zurueck; p_offset auf >= 0. Ordnung '
  'created_at desc, id desc — der zweite Schluessel macht sie TOTAL und ist '
  'die Voraussetzung dafuer, dass Offset-Blaetterung keine Zeile doppelt oder '
  'gar nicht zeigt. p_themes und p_ratings: null heisst KEINE Einschraenkung, '
  'ein leeres Array heisst es nicht — = any(''{}'') ist false und lieferte '
  'eine leere Liste. Innerhalb einer Facette ODER, zwischen den Facetten UND. '
  'Der Filter greift VOR limit/offset. Alle vier Argumente haben '
  'Vorgabewerte, damit die argumentlosen und die positionellen '
  'Zweiargument-Aufrufe im Bestand weiterlaufen und zu Waechtern ueber genau '
  'diese Vorgabewerte werden. author_aktiv ist die GANZE Zugangsbedingung '
  '(bestaetigt UND nicht deaktiviert UND nicht geloescht) — die Flaeche '
  'bietet an einem Verfasser ohne Zugang kein Gespraech an, weil der darin '
  'nicht antworten koennte.';
