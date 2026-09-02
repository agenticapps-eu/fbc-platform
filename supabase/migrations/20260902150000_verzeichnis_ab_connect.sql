-- AGE-598, Teil A — die Verzeichnisliste beginnt bei `connect` (Rang 2).
--
-- Aufgaben 3.4, 3b.4 und 3c.2 aus openspec/changes/rechte-matrix-stufen/tasks.md.
-- Die scheiternden Zusagen stehen seit 3.1-3.3, 3b.1-3b.3 und 3c.1 in
-- supabase/tests/directory_search_test.sql (27, 28, 32, 34, 35 rot).
--
-- EINE Migration für drei Aufgabengruppen, und das ist kein Zusammenfassen aus
-- Bequemlichkeit: 3b und 3c sind Bedingungen dafür, dass 3.4 überhaupt richtig
-- ist. Ohne 3b wäre die Maskierung Kulisse (der Volltext gäbe her, was die
-- Ausgabe verschweigt), ohne 3c fiele `branche` für `connect` still auf NULL.
-- Drei Migrationen ergäben zwei Zwischenzustände, die niemand haben will und
-- die trotzdem in der Historie stünden.
--
-- ══ 1. WARUM DIE MASKIERUNG SPALTENWEISE IST UND NICHT ZEILENWEISE ══════════
-- RLS ist zeilenweise. Eine Policy, die einem `connect`-Konto die öffentlichen
-- Zeilen von `public.profiles` freigäbe, gäbe ihm die GANZE Zeile — samt
-- `competencies` und samt allem, was später an die Tabelle gehängt wird. Die
-- Trennung „Liste ab connect, erweiterte Felder ab discover" ist deshalb keine
-- zweite Policy, sondern ein Join über zwei Quellen mit verschiedenen Rechten:
--
--   * `public.profiles_public` — `security_invoker = off`, umgeht die RLS
--     bewusst und liefert JEDEM aktivierten Konto die Basisfelder.
--   * `public.profiles` — unter `profiles_select_self_or_discover`
--     (`id = auth.uid() or has_level(3)`), also unterhalb Rang 3 leer.
--
-- Ein `left join` über beide maskiert die erweiterten Spalten VON SELBST: für
-- einen Aufrufer unterhalb Rang 3 kommt die rechte Seite als NULL an, und
-- `coalesce(..., '{}')` macht daraus das leere Array, das die Oberfläche vom
-- NULL unterscheidet. Die Rang-3-Policy wird dabei NICHT angefasst — sie ist
-- weiterhin die Grenze, sie wird hier nur benutzt.
--
-- Deshalb steht in diesem Rumpf auch keine `3`. Sie stünde sonst zweimal in der
-- Datenbank, und zwei Kopien einer Grenze driften.
--
-- ══ 2. DAS EINTRITTSTOR HAT EINEN SELBST-ZWEIG, UND DER IST KEINE ══════════
--      BEQUEMLICHKEIT
-- `has_level(2) or pp.id = (select auth.uid())`, nicht `has_level(2)` allein.
--
-- `src/components/search/HeaderSearch.tsx` verlässt sich seit AGE-540
-- ausdrücklich darauf, dass ein Konto UNTERHALB der Verzeichnisschwelle die
-- EIGENE Zeile als gültigen Treffer zurückbekommt (Punkt 2 im Kopf der Datei:
-- „Der Rang formuliert NUR den leeren Fall"). Ein hartes Rang-2-Tor gäbe null
-- Zeilen, und ein `basic`-Konto fände in der Kopfzeilen-Suche nicht einmal mehr
-- das eigene Profil. Nichts wäre dabei rot geworden.
--
-- Der Selbst-Zweig trägt keine Rangzahl. Er bildet ab, was die heutige Policy
-- in ihrer ersten Hälfte (`id = auth.uid()`) ohnehin schon tut.
--
-- ══ 3. DER VOLLTEXT — ZWEI FASSUNGEN, OHNE DASS EINE RANGZAHL AUFTAUCHT ═════
-- Befund opencode HIGH-1. `search_doc` ist eine generierte Spalte über acht
-- Felder, darunter `competencies` und `interests`. Solange nur Rang 3 die Liste
-- sah, war das folgenlos — wer den Volltext befragen durfte, durfte die Felder
-- ohnehin lesen. Mit der Rang-2-Schwelle wäre daraus ein Orakel geworden: „Hat
-- Mitglied X die Kompetenz Y?", beantwortet daran, ob die Zeile stehen bleibt.
--
-- Die Bindung nutzt DIESELBE Asymmetrie wie die Spaltenmaskierung:
--
--   coalesce(p.search_doc, <Basis-Vektor aus pp>) @@ suchbegriff_zu_tsquery(…)
--
-- Ab Rang 3 ist `p.search_doc` da und gilt. Darunter ist es NULL, und der
-- Basis-Vektor übernimmt. Kein `case`, kein `has_level(3)`, keine zweite Kopie
-- der Grenze. Für die EIGENE Zeile gilt auch unterhalb Rang 3 der reiche
-- Vektor — richtig so, die eigenen Kompetenzen darf man durchsuchen.
--
-- ══ 4. WELCHE FELDER IM BASIS-VEKTOR STEHEN — UND WELCHES NICHT ════════════
-- `name`, `company`, `branche`, `short_bio`, `roles`. Der Entwurf (D6) nannte
-- `name`, `company`, `region`, `short_bio`, `branche`. Zwei Abweichungen, beide
-- aus derselben Regel:
--
--   **Der Basis-Vektor muss eine TEILMENGE von `search_doc` sein.**
--
--   * `roles` KOMMT DAZU. Es steht in `profiles_public` (also auf der Karte,
--     die ein `connect`-Konto sieht) und in `search_doc`. Es wegzulassen hiesse,
--     ein sichtbares Feld unauffindbar zu machen — dieselbe Klasse Lücke, die
--     der Fremd-Review für `branche` gefunden hat (HIGH-2).
--   * `region` FÄLLT WEG. Es steht in `profiles_public`, aber NICHT in
--     `search_doc`. Nähme man es auf, könnte ein `connect`-Konto nach der Region
--     suchen und ein `discover`-Konto nicht — die niedrigere Stufe bekäme eine
--     Fähigkeit, die der höheren fehlt. Das widerspräche der Zusage aus 3b.3,
--     dass die Bindung die Suche für Berechtigte nicht verengt.
--
-- `search_doc` selbst bleibt unverändert (Aufgabe 3b.5): es bedient weiterhin
-- Rang 3 und die Kopfzeilen-Suche. Wer `region` künftig durchsuchbar machen
-- will, gehört in BEIDE Vektoren — Zusage 36 der Testdatei hält das fest.
--
-- ══ 5. KEIN GESPEICHERTER ZWEITER INDEX, UND WANN DAS AUFHÖRT ZU STIMMEN ════
-- Der Basis-Vektor wird im Rumpf gebildet, nicht als generierte Spalte mit
-- GIN-Index. Das ist die kleinere Änderung und bei 74 Profilen folgenlos; den
-- indizierten Weg über `search_doc` nimmt weiterhin jeder ab Rang 3, und das
-- ist der Bestand. Die Schwelle, ab der das falsch wird, ist dieselbe, die
-- `src/lib/directory.ts` für die Kontaktliste benennt: das Paging. Sobald das
-- Verzeichnis seitenweise lädt, gehört hier eine generierte Spalte hin.
--
-- ══ 6. `branche` WIRD EIN BASISFELD ═════════════════════════════════════════
-- Befund opencode HIGH-2. `search_directory` gibt `branche` heraus und filtert
-- mit `p_branche` darauf; `profiles_public` enthielt die Spalte nicht. Nach der
-- Umstellung auf den Join wäre sie für `connect` still NULL geworden und der
-- Branchenfilter wortlos leer gelaufen — ein sichtbarer Filter, der nie etwas
-- findet.
--
-- Die Spalte kommt ANS ENDE. `create or replace view` erlaubt nur ANGEHÄNGTE
-- Spalten; an einer „logischen" Stelle (etwa hinter `region`) scheiterte die
-- Anweisung mit „cannot change name of view column".
--
-- Das ist eine Erweiterung dessen, was `profiles_public` preisgibt, und damit
-- sichtbar für JEDES aktivierte Mitglied, auch unterhalb der
-- Verzeichnisschwelle. Bewusst: `name`, `company`, `region` und `short_bio`
-- stehen dort bereits, und die Branche ist von derselben Art.

-- ── 1. `branche` in die öffentliche Sicht ───────────────────────────────────
create or replace view public.profiles_public
with (security_invoker = off) as
  select
    id,
    public.resolve_display_name(id, name) as name,
    avatar_url,
    region,
    company,
    short_bio,
    tier,
    roles,
    cover_url,
    -- Angehängt, nicht eingeordnet — siehe Kopf, Abschnitt 6.
    branche
  from public.profiles
  where is_public
    and public.is_activated()
    and activated_at is not null
    and disabled_at is null
    and deleted_at is null;

-- `create or replace view` erhält die Grants, anders als ein `drop`/`create`.
-- Sie werden trotzdem ausgesprochen: eine Sicht ohne ausdrücklichen Grant ist
-- in diesem Repo schon zweimal aufgefallen, und „wurde geerbt" ist keine
-- Zusicherung, die man im Katalog nachlesen kann.
grant select on public.profiles_public to authenticated;

comment on view public.profiles_public is
  'Basisfelder jedes gelisteten, aktivierten Mitglieds — RLS-umgehend '
  '(security_invoker = off) und ohne Stufenschwelle, das Rückgrat der '
  'Namensauflösung an 15 Stellen. Seit AGE-598 mit `branche`: sie ist ein '
  'Verzeichnis-Facet und steht auf den Karten.';

-- ── 2. `search_directory` — Eintrittstor bei Rang 2 ─────────────────────────
-- `create or replace`: der Rückgabetyp ist unverändert (dieselben 15 Spalten in
-- derselben Reihenfolge), und damit bleibt auch der Kommentar erhalten, den
-- Zusage 24 der Testdatei einfordert.
create or replace function public.search_directory(
  p_query      text     default null,
  p_theme      text     default null,
  p_branche    text     default null,
  p_region     text     default null,
  p_competency text     default null,
  p_offering   text     default null,
  p_offers     text[]   default null,
  p_needs      text[]   default null
)
returns table (
  id               uuid,
  name             text,
  avatar_url       text,
  cover_url        text,
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
  need_categories  text[]
)
language sql
stable
set search_path = ''
as $function$
  select
    -- ── Basisfelder: aus der RLS-umgehenden Sicht ────────────────────────────
    -- `pp.name` ist bereits durch `resolve_display_name` gelaufen; die
    -- Namensmaskierung aus AGE-291 gilt also unverändert weiter.
    pp.id,
    pp.name,
    pp.avatar_url, pp.cover_url, pp.region, pp.company, pp.short_bio,
    pp.branche, pp.tier, pp.roles,

    -- ── Erweiterte Felder: aus der RLS-gefilterten Tabelle ───────────────────
    -- Unterhalb Rang 3 kommt die rechte Seite des Joins als NULL an. `coalesce`
    -- macht daraus das LEERE ARRAY und nicht NULL: die Oberfläche unterscheidet
    -- beides, und „keine Kompetenzen hinterlegt" ist eine andere Auskunft als
    -- „darfst du nicht sehen".
    coalesce(p.competencies, '{}'::text[]),

    -- `offers`/`needs` tragen dieselbe Rang-3-Schwelle in ihrer eigenen
    -- SELECT-Policy (`… or has_level(3)`). Die vier Aggregate maskieren sich
    -- deshalb ebenfalls von selbst — hier steht keine zweite Grenze.
    exists (select 1 from public.offers o where o.profile_id = pp.id) as has_offers,
    exists (select 1 from public.needs  n where n.profile_id = pp.id) as has_needs,
    coalesce((select array_agg(distinct o.category order by o.category)
              from public.offers o
              where o.profile_id = pp.id and o.category is not null), '{}'::text[]),
    coalesce((select array_agg(distinct n.category order by n.category)
              from public.needs n
              where n.profile_id = pp.id and n.category is not null), '{}'::text[])

  from public.profiles_public pp
  left join public.profiles p on p.id = pp.id

  -- ── Eintrittstor ─────────────────────────────────────────────────────────
  -- Die einzige Rangzahl in diesem Rumpf. Der Selbst-Zweig hält die Zusage aus
  -- AGE-540 (siehe Kopf, Abschnitt 2).
  where (public.has_level(2) or pp.id = (select auth.uid()))

    -- `is_public`, `activated_at`, `disabled_at` und `deleted_at` prüft
    -- `profiles_public` bereits in seiner eigenen `where`-Klausel — sie stehen
    -- hier nicht noch einmal. Ebenso das Aktivierungs-Gate des AUFRUFERS: die
    -- Sicht trägt `is_activated()`, ein unbestätigtes Konto bekommt also gar
    -- keine Zeile und braucht daneben keine zweite Prüfung.

    -- ── Volltext: zwei Fassungen, keine Rangzahl (siehe Kopf, Abschnitt 3) ──
    and (p_query is null or p_query = ''
         or coalesce(
              p.search_doc,
              to_tsvector('german',
                coalesce(pp.name, '')      || ' ' ||
                coalesce(pp.company, '')   || ' ' ||
                coalesce(pp.branche, '')   || ' ' ||
                coalesce(pp.short_bio, '') || ' ' ||
                coalesce(array_to_string(pp.roles, ' '), ''))
            ) @@ public.suchbegriff_zu_tsquery(p_query))

    -- ── Filter auf Basisfeldern: aus `pp`, also auf jeder Stufe wirksam ─────
    and (p_branche is null or p_branche = '' or pp.branche = p_branche)
    and (p_region  is null or p_region  = '' or pp.region  = p_region)

    -- ── Filter auf erweiterten Feldern: aus `p`, also unterhalb Rang 3 leer ─
    -- Das ist kein Versehen, sondern die Zusage: ein Filter auf einer
    -- maskierten Spalte findet nichts. Die Oberfläche blendet ihn deshalb aus
    -- (D5) statt ihn leer laufen zu lassen.
    and (p_competency is null or p_competency = '' or p.competencies @> array[p_competency])
    and (p_theme is null or p_theme = '' or exists (
           select 1 from public.offers o where o.profile_id = pp.id and o.theme = p_theme
           union all
           select 1 from public.needs n where n.profile_id = pp.id and n.theme = p_theme
           union all
           select 1 from public.profile_interests pi
             where pi.profile_id = pp.id and pi.theme = p_theme
         ))
    and (p_offering is null or p_offering = ''
         or (p_offering = 'offers' and exists (select 1 from public.offers o where o.profile_id = pp.id))
         or (p_offering = 'needs'  and exists (select 1 from public.needs  n where n.profile_id = pp.id)))
    -- ODER innerhalb einer Gruppe, UND zwischen den Gruppen.
    -- `cardinality(...) = 0` fängt das leere Array ab: es soll NICHT filtern,
    -- sonst leert ein „alle Chips abgewählt" die Liste statt sie freizugeben.
    and (p_offers is null or cardinality(p_offers) = 0 or exists (
           select 1 from public.offers o
           where o.profile_id = pp.id and o.category = any(p_offers)))
    and (p_needs is null or cardinality(p_needs) = 0 or exists (
           select 1 from public.needs n
           where n.profile_id = pp.id and n.category = any(p_needs)))

  -- `pp.name` ist der AUFGELÖSTE Name. Nach der rohen Spalte zu ordnen stellte
  -- eine maskierte Zeile an ihre alphabetische Position und verriete sie damit.
  order by pp.name nulls last;
$function$;

comment on function public.search_directory(text, text, text, text, text, text, text[], text[]) is
  'Mitgliederverzeichnis. Seit AGE-598 ab `connect` (Rang 2) erreichbar: '
  'Basisfelder aus `profiles_public`, erweiterte Spalten (competencies, '
  'has_offers/has_needs, offer_/need_categories) weiterhin aus `public.profiles` '
  'unter der UNVERÄNDERTEN Rang-3-Policy. Der Volltext fällt unterhalb Rang 3 '
  'auf einen Vektor aus Basisfeldern zurück, damit die Suche nicht preisgibt, '
  'was die Ausgabe maskiert. Der Selbst-Zweig im Eintrittstor hält die Zusage '
  'aus AGE-540, dass ein Konto darunter sich selbst findet.';
