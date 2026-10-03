-- Die Matrix aus SPEC 01 V5 FINAL wird wirksam: vier Schwellen wandern.
-- AGE-1000 (V5F-1), Change openspec/changes/rechte-v5-final/.
--
-- ══ WAS SICH AENDERT ═══════════════════════════════════════════════════════
--   events        INSERT  nur `is_activated()` + Host  ->  + events.erstellen (6)
--   offers/needs  SELECT  has_level(4)                 ->  suche_biete (5)
--   offers/needs  INSERT  nur Eigentum                 ->  + suche_biete (5)
--   matches       SELECT  nur Beteiligung              ->  + vorschlaege (5)
--   verzeichnis   RPC     has_level(4) im Eintrittstor ->  verzeichnis.suchen (6)
--
-- ══ ANLEGEN FAELLT, PFLEGEN BLEIBT ═════════════════════════════════════════
-- Die drei `ALL`-Policies werden in INSERT (mit Recht) und UPDATE/DELETE (ohne
-- Recht, nur Eigentum) geteilt. SPEC 01 bindet das EINSTELLEN an die Stufe.
-- Ein Mitglied, dessen Stufe sinkt, muss seine Zeilen zurueckziehen koennen;
-- ein Host muss seinen Termin absagen koennen. Das Gegenteil waere eine
-- Datensperre, die wie ein Rechtemodell aussieht.
--
-- Offen und Donald vorgelegt: ob „einstellen" auch das AENDERN einer
-- bestehenden Zeile umfasst. Gelesen als Neuanlegen; faellt die Lesart anders
-- aus, ist es eine Zeile je Policy.
--
-- ══ WAS HIER BEWUSST NICHT STEHT ═══════════════════════════════════════════
-- **Der Entzug des Leserechts auf `profiles_public`.** Der erste Entwurf wollte
-- ihn. Die Plan-Review (codex, REQUEST-CHANGES) hat zwei Fehler darin gefunden,
-- beide am Katalog nachgeprueft:
--   1. `search_directory` ist SECURITY INVOKER (`prosecdef = false`) und liest
--      die Sicht. Ohne Leserecht des Aufrufers scheitert die RPC — auch fuer
--      ein IMPACT-Konto. Der Entzug haette das Verzeichnis abgeschaltet statt
--      es einzuschraenken.
--   2. Nicht nur die Sicht ist als Menge lesbar, die Basistabelle ist es auch:
--      `profiles_select_self_or_discover` erlaubt jede fremde Zeile ab Rang 4,
--      einschliesslich der mit `is_public = false`, die die Sicht herausfiltert.
--      Die Sicht dicht zu machen haette den Befund verschoben, nicht behoben.
-- Beides zusammen ist der Change `verzeichnis-dicht`: zwanzig Abfragestellen
-- (13 auf `profiles`, 7 auf `profiles_public`, alle schon heute
-- kennungsgebunden), dazu die Einbettung `membership_tiers(level_rank)` und die
-- `update().select()`-Ketten. Nach DIESER Migration gilt „DISCOVER darf nicht
-- gezielt suchen" also an der Oberfläche und an `search_directory` — nicht am
-- direkten Tabellenzugriff. Zwei Zusagen in
-- supabase/tests/rechte_v5_test.sql halten den Zustand fest, damit er dort
-- umgedreht werden MUSS.
--
-- **Die Clubschwelle.** `register_for_event`, `regs_write_own`,
-- `darf_kontaktanfrage_senden`, `profiles_select_self_or_discover` und die drei
-- Profil-Untertabellen bleiben auf `has_level(4)`. Entscheidung E4 des
-- Go-live-Plans: Kontakt ueber Kontext bleibt offen, nur die Suche faellt.

-- ── 1. events: Anlegen verlangt das Recht ───────────────────────────────────
-- Postgres kennt kein „ALL ausser INSERT", also wird die eine Policy zu drei.
-- Die `cover_path`-Bindung aus AGE-630 (Befund codex, HIGH) steht unveraendert
-- in beiden schreibenden Zweigen — sie beweist Eigentum am Pfadpraefix und ist
-- der Grund, warum `with check` hier mehr ist als eine Kopie von `using`.
drop policy events_write_host on public.events;

create policy events_insert_host on public.events
  for insert to authenticated
  with check (
    public.is_activated()
    and host_id = (select auth.uid())
    and (select public.darf('events.erstellen'))
    and (cover_path is null
         or split_part(cover_path, '/', 1) = ((select auth.uid()))::text)
  );

create policy events_update_host on public.events
  for update to authenticated
  using (
    public.is_activated()
    and host_id = (select auth.uid())
  )
  with check (
    public.is_activated()
    and host_id = (select auth.uid())
    and (cover_path is null
         or split_part(cover_path, '/', 1) = ((select auth.uid()))::text)
  );

create policy events_delete_host on public.events
  for delete to authenticated
  using (
    public.is_activated()
    and host_id = (select auth.uid())
  );

-- ── 2. offers/needs: lesen und einstellen ab FOCUS ──────────────────────────
-- `is_activated_profile(profile_id)` bleibt: eine Zeile erscheint fuer Dritte
-- erst, wenn IHR Inhaber bestaetigt hat.
drop policy offers_select on public.offers;
create policy offers_select on public.offers
  for select to authenticated
  using (
    public.is_activated()
    and public.is_activated_profile(profile_id)
    and (profile_id = (select auth.uid()) or (select public.darf('suche_biete')))
  );

drop policy needs_select on public.needs;
create policy needs_select on public.needs
  for select to authenticated
  using (
    public.is_activated()
    and public.is_activated_profile(profile_id)
    and (profile_id = (select auth.uid()) or (select public.darf('suche_biete')))
  );

drop policy offers_write_own on public.offers;

create policy offers_insert_own on public.offers
  for insert to authenticated
  with check (
    public.is_activated()
    and profile_id = (select auth.uid())
    and (select public.darf('suche_biete'))
  );

create policy offers_update_own on public.offers
  for update to authenticated
  using (public.is_activated() and profile_id = (select auth.uid()))
  with check (public.is_activated() and profile_id = (select auth.uid()));

create policy offers_delete_own on public.offers
  for delete to authenticated
  using (public.is_activated() and profile_id = (select auth.uid()));

drop policy needs_write_own on public.needs;

create policy needs_insert_own on public.needs
  for insert to authenticated
  with check (
    public.is_activated()
    and profile_id = (select auth.uid())
    and (select public.darf('suche_biete'))
  );

create policy needs_update_own on public.needs
  for update to authenticated
  using (public.is_activated() and profile_id = (select auth.uid()))
  with check (public.is_activated() and profile_id = (select auth.uid()));

create policy needs_delete_own on public.needs
  for delete to authenticated
  using (public.is_activated() and profile_id = (select auth.uid()));

-- ── 3. matches: Beteiligung UND Recht ───────────────────────────────────────
-- Die Reihenfolge ist die Aussage: das Recht oeffnet keine fremden Paare, und
-- die Beteiligung ersetzt das Recht nicht. Zeilen eines Kontos unterhalb Rang 5
-- bleiben in der Tabelle — ein Aufstieg zeigt sie wieder, ohne dass das
-- Matching erneut laufen muss.
drop policy matches_select_participant on public.matches;
create policy matches_select_participant on public.matches
  for select to authenticated
  using (
    public.is_activated()
    and (select public.darf('vorschlaege'))
    and (a_profile_id = (select auth.uid()) or b_profile_id = (select auth.uid()))
  );

-- ── 4. Das Verzeichnis: ein Name statt einer Zahl ───────────────────────────
-- `create or replace` haelt Signatur, Spalten und Rechte. Die Rechte werden
-- darunter trotzdem erneut ausgesprochen — namentlich fuer alle vier Rollen,
-- weil eine frisch erzeugte Instanz rollenspezifisch vergibt (siehe
-- 20260827070000_entzuege_nennen_alle_rollen.sql).
create or replace function public.search_directory(
  p_query text default null, p_theme text default null, p_branche text default null,
  p_region text default null, p_competency text default null, p_offering text default null,
  p_offers text[] default null, p_needs text[] default null)
returns table(id uuid, name text, avatar_url text, cover_url text, region text,
  company text, short_bio text, branche text, tier text, roles text[],
  competencies text[], has_offers boolean, has_needs boolean,
  offer_categories text[], need_categories text[])
language sql
stable
set search_path to ''
as $$
  select
    -- ── Basisfelder: aus der RLS-umgehenden Sicht ────────────────────────────
    -- `pp.name` ist bereits durch `resolve_display_name` gelaufen; die
    -- Namensmaskierung aus AGE-291 gilt also unverändert weiter.
    pp.id,
    pp.name,
    pp.avatar_url, pp.cover_url, pp.region, pp.company, pp.short_bio,
    pp.branche, pp.tier, pp.roles,

    -- ── Erweiterte Felder: aus der RLS-gefilterten Tabelle ───────────────────
    -- Ab AGE-1000 liegen Eintrittstor und erweiterte Spalten NICHT mehr auf
    -- derselben Schwelle: das Tor verlangt Rang 6 (`verzeichnis.suchen`),
    -- `p.competencies` kommt weiter unter der Clubschwelle. Das ist folgenlos
    -- und zwar beweisbar: wer durch das Tor kommt, hat Rang 6 und damit auch
    -- Rang 4 — und der Selbst-Zweig liefert nur die eigene Zeile, deren
    -- erweiterte Spalten dem Aufrufer ohnehin offenstehen. Der Zustand „Liste
    -- ja, Spalten nein" entsteht also nicht. `coalesce` macht aus dem NULL der
    -- rechten Join-Seite das LEERE ARRAY — die Oberfläche unterscheidet „keine
    -- Kompetenzen hinterlegt" von „darfst du nicht sehen".
    coalesce(p.competencies, '{}'::text[]),

    -- `offers`/`needs` tragen ab AGE-1000 `darf('suche_biete')` (Rang 5) in
    -- ihrer eigenen SELECT-Policy. Die vier Aggregate maskieren sich deshalb
    -- ebenfalls von selbst — hier steht keine zweite Grenze. Rang 6 schliesst
    -- Rang 5 ein, also sind sie fuer jeden gefuellt, der durch das Tor kommt.
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
  -- Ab AGE-1000 steht hier KEINE Rangzahl mehr, sondern ein Rechtename. Der
  -- Mindestrang (6) liegt in `public.berechtigungen`; eine Verschiebung ist
  -- dort eine Zeile und hier nichts. Der Aufruf ist in `(select …)` gewickelt,
  -- damit er einmal je Abfrage statt einmal je Zeile laeuft — der nackte
  -- Rangaufruf davor war das nicht.
  --
  -- Der Selbst-Zweig hält die Zusage aus AGE-540: ein Konto ohne das Recht
  -- findet sich selbst. Er wird mit AGE-1000 WICHTIGER, nicht unwichtiger — die
  -- Schwelle steigt von Rang 4 auf Rang 6, also fällt ein größerer Teil des
  -- Bestands darunter.
  where ((select public.darf('verzeichnis.suchen')) or pp.id = (select auth.uid()))

    -- `is_public`, `activated_at`, `disabled_at` und `deleted_at` prüft
    -- `profiles_public` bereits in seiner eigenen `where`-Klausel — sie stehen
    -- hier nicht noch einmal. Ebenso das Aktivierungs-Gate des AUFRUFERS: die
    -- Sicht trägt `is_activated()`, ein unbestätigtes Konto bekommt also gar
    -- keine Zeile und braucht daneben keine zweite Prüfung.

    -- ── Volltext: zwei Fassungen, keine Rangzahl ────────────────────────────
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

    -- ── Filter auf Basisfeldern: aus `pp` ───────────────────────────────────
    and (p_branche is null or p_branche = '' or pp.branche = p_branche)
    and (p_region  is null or p_region  = '' or pp.region  = p_region)

    -- ── Filter auf erweiterten Feldern: aus `p`, unterhalb Rang 4 leer ──────
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
$$;
comment on function public.search_directory is
  'Mitgliederverzeichnis. Ab AGE-1000 verlangt das Eintrittstor das Recht '
  '`verzeichnis.suchen` (Mindestrang 6 in public.berechtigungen) statt der '
  'Zahl 4 — Detlevs SPEC 01 V5 FINAL fuehrt „Mitglieder gezielt suchen" als '
  'Recht allein fuer IMPACT. Liste UND erweiterte Spalten tragen weiter '
  'dieselbe Schwelle; der EINZELABRUF eines Profils bleibt bei has_level(4) '
  'in profiles_select_self_or_discover, weil Kontakt ueber Kontext offen '
  'bleibt (Entscheidung E4). Basisfelder aus `profiles_public`, erweiterte '
  'Spalten aus `public.profiles` unter deren SELECT-Policy. Der Selbst-Zweig '
  'haelt die Zusage aus AGE-540.';

revoke execute on function public.search_directory(
  text, text, text, text, text, text, text[], text[])
  from public, anon, authenticated, service_role;
grant  execute on function public.search_directory(
  text, text, text, text, text, text, text[], text[])
  to authenticated;
