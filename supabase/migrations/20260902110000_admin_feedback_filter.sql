-- AGE-628 — `admin_list_feedback` bekommt zwei Filterargumente und gibt
-- `theme` und `screenshot_path` mit heraus.
--
-- Aufgaben 3.2–3.6 aus openspec/changes/feedback-ausbauen/tasks.md. Die
-- scheiternde Zusage steht seit 3.1 in `supabase/tests/admin_feedback_test.sql`
-- (Zusage 19, rot mit `42883`).
--
-- ══ WARUM `drop` UND NICHT `create or replace` ═════════════════════════════
-- Der Rueckgabetyp aendert sich (zwei Spalten mehr), und daran scheitert
-- `create or replace` mit „cannot change return type of existing function".
-- Das ist der ZWEITE Abriss dieser Funktion; der erste steht in
-- 20260825120000. Dort ist auch nachzulesen, was ein `drop` alles mitnimmt:
-- Grants, Kommentar und die Vorgabewerte.
--
-- ══ ALLE VIER ARGUMENTE BEKOMMEN VORGABEWERTE ══════════════════════════════
-- Nicht Bequemlichkeit, sondern die Bedingung dafuer, dass der Bestand
-- weiterlaeuft: fuenf Zusagen rufen `admin_list_feedback()` ARGUMENTLOS auf
-- (rls_test.sql und admin_feedback_test.sql), und die Oberflaeche ruft heute
-- positionell mit zwei Argumenten. Beide Formen bleiben gueltig — und werden
-- damit zu Waechtern ueber die Vorgabewerte der zwei NEUEN Argumente.
--
-- Die Reihenfolge ist deshalb festgelegt: `p_limit`, `p_offset` zuerst, die
-- Filter dahinter. Ein Vertauschen braeche jeden positionellen Aufruf im
-- Bestand, und zwar lautlos — `admin_list_feedback(25, 0)` bliebe gueltig und
-- meinte etwas anderes.
--
-- ══ `null` HEISST „KEINE EINSCHRAENKUNG", EIN LEERES ARRAY NICHT ═══════════
-- `(p_x is null or spalte = any(p_x))`. Ein leeres Array als „alles" waere
-- falsch herum gedacht: `spalte = any('{}')` ergibt **false**, nicht true —
-- der Normalfall lieferte also eine LEERE Liste. Die Oberflaeche schickt
-- deshalb `null`, wenn keine Marke gesetzt ist, und niemals `[]`.
--
-- Genau deshalb sind die fuenf argumentlosen Zusagen hier mehr als Altlast:
-- sie wuerden rot, wenn `null` je etwas anderes als „alles" hiesse.
--
-- ══ INNERHALB EINER FACETTE ODER, ZWISCHEN DEN FACETTEN UND ════════════════
-- Mehrere Marken derselben Facette sind ein `= any(…)`, also ODER. Die beiden
-- Facetten stehen mit `and` nebeneinander: wer „Fehler" und „1 Stern" waehlt,
-- will die Schnittmenge, nicht die Vereinigung.
--
-- Das Bewertungs-Praedikat steht ausdruecklich hier — die erste Entwurfs-
-- fassung hatte nur das Themen-Praedikat, und `p_ratings` waere ein Argument
-- gewesen, das die Funktion annimmt und stillschweigend ignoriert.
--
-- ══ DER FILTER GREIFT VOR DER SEITENGRENZE ═════════════════════════════════
-- Er steht im `where`, also vor `order by`/`limit`/`offset`. Ein Filter, der
-- erst auf die fertige Seite wirkte, liesse die Trefferzahl je Seite schwanken
-- und faende eine Zeile auf Seite 5 ueberhaupt nicht. Zusage 19 der Testdatei
-- misst genau diesen Unterschied: die beiden `fehler`-Zeilen sind ohne Filter
-- die Plaetze 105 und 106.
--
-- Klemmung (1..100, `null` faellt auf die Vorgabe) und Ordnung
-- (`created_at desc, id desc`) sind woertlich uebernommen. Der zweite
-- Ordnungsschluessel ist keine Kosmetik: ohne ihn ist die Ordnung bei gleichen
-- Zeitstempeln nicht total, und dieselbe Zeile kann auf zwei Seiten stehen.

drop function public.admin_list_feedback(int, int);

create function public.admin_list_feedback(
  p_limit   int      default 25,
  p_offset  int      default 0,
  p_themes  text[]   default null,
  p_ratings int[]    default null
)
returns table (id uuid, rating integer, likes text, misses text, idea text,
               route text, ref_type text, created_at timestamptz,
               author_name text, profile_id uuid,
               theme text, screenshot_path text)
language sql stable security definer set search_path = ''
as $$
  select f.id, f.rating, f.likes, f.misses, f.idea, f.route, f.ref_type,
         f.created_at, coalesce(p.name, '—') as author_name, f.profile_id,
         f.theme, f.screenshot_path
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

-- Die drei Dinge, die der `drop` mitgenommen hat. Die Vorgabewerte stehen
-- bereits in der Signatur oben.
revoke execute on function public.admin_list_feedback(int, int, text[], int[])
  from public, anon;
grant  execute on function public.admin_list_feedback(int, int, text[], int[])
  to authenticated;

comment on function public.admin_list_feedback(int, int, text[], int[]) is
  'QM-Feedback fuer Admins, geblaettert und gefiltert (AGE-358, Blaetterung '
  'AGE-587, Filter und Screenshot AGE-628). SECURITY DEFINER, WEIL der Join '
  'auf profiles den Autor-Namen auch bei nicht-oeffentlichen Profilen '
  'aufloesen muss. Gibt Zeilen NUR zurueck, wenn is_activated() and '
  'is_admin() — ein Nicht-Admin (auch matching_manager) bekommt eine leere '
  'Liste und KEINEN Fehler. p_limit auf 1..100 geklemmt statt abgewiesen, '
  'null faellt auf 25 zurueck; p_offset auf >= 0. Ordnung created_at desc, '
  'id desc — der zweite Schluessel macht sie TOTAL und ist die Voraussetzung '
  'dafuer, dass Offset-Blaetterung keine Zeile doppelt oder gar nicht zeigt. '
  'p_themes und p_ratings: null heisst KEINE Einschraenkung, ein leeres Array '
  'heisst es nicht — = any(''{}'') ist false und lieferte eine leere Liste. '
  'Innerhalb einer Facette ODER, zwischen den Facetten UND. Der Filter greift '
  'VOR limit/offset. Alle vier Argumente haben Vorgabewerte, damit die '
  'argumentlosen und die positionellen Zweiargument-Aufrufe im Bestand '
  'weiterlaufen und zu Waechtern ueber genau diese Vorgabewerte werden.';
