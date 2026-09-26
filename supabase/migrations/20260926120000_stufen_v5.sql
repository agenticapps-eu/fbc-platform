-- Die Zugangsleiter V5 (AGE-903). Forward-only.
-- Change: openspec/changes/stufen-v5/ — Entwurf, Delta-Specs und Aufgaben dort.
-- Vorbild und Muster: 20260715150000_six_level_model.sql, bis in die Reihenfolge
-- der Schritte.
--
-- Die Leiter danach, von unten nach oben:
--   active(1, 0 €) boost(2, 0 €) connect(3, 0 €) discover(4, 300 €)
--   focus(5, 600 €) impact(6, 1200 €)
-- `basic` und `exchange` entfallen. **Der Club beginnt bei discover (Rang 4).**
--
-- ── Warum das KEIN Umbenennen ist ────────────────────────────────────────────
-- Das Gating vergleicht Rangzahlen, keine Schlüssel. Ein reines Umbenennen
-- verschenkte Rechte nach unten: CONNECT (Rang 3) bekäme die heutigen
-- discover-Rechte, BOOST (Rang 2) die Mitgliederliste — zwei Stufen, die nach
-- der neuen Leiter gar nicht im Club sind. Deshalb steigt JEDE Schwelle, die
-- heute unterhalb Rang 4 liegt, auf Rang 4.
--
-- Und: `connect` und `discover` heissen vorher UND nachher so und bedeuten
-- Verschiedenes (2→3 bzw. 3→4). Wer `profiles.tier` liest und Schlüssel mit
-- Rechten gleichsetzt, liegt nach dieser Migration falsch. Die Autorität ist
-- `membership_tiers.level_rank`, nie der Name.
--
-- ── Warum nur ZWEI Zwischenränge ─────────────────────────────────────────────
-- `level_rank` ist unique. Neu sind aber nur `active` und `boost`; `connect`,
-- `discover`, `focus` und `impact` bestehen weiter und brauchen höchstens ein
-- Rang-Update. Nur die zwei neuen Zeilen kollidieren beim Anlegen (Rang 1 hält
-- noch `basic`, Rang 2 noch `connect`) — sie entstehen deshalb auf 101 und 102.
-- Sechs Zwischenränge wie 20260715150000 wären hier Zeremonie.
--
-- Die Reihenfolge ist erzwungen, nicht gewählt:
--   * `profiles.tier` ist Fremdschlüssel auf `membership_tiers(key)` — die
--     Zielstufen müssen existieren, bevor ein Profil auf sie zeigt.
--   * `discover` 3→4 muss VOR `connect` 2→3 laufen, sonst läuft `connect` in
--     den noch belegten Rang 3.
--
-- ── Entscheidungen (Donald, 25. und 26.09.2026) ──────────────────────────────
--  * **Der Bestand zieht NICHT rangtreu um.** impact→impact, focus→focus,
--    connect·discover·exchange→discover, basic→active. Rangtreu verlöre ein
--    Konto auf altem `discover` (Rang 3) seinen Clubzugang, weil der neue
--    Rang 3 CONNECT heisst und ausserhalb liegt. Für altes `connect` ist es
--    eine Anhebung: es sah die Verzeichnisliste seit AGE-598 ab Rang 2, und
--    diese Liste geht in DISCOVER auf. Die Regel lautet „niemand verliert, was
--    er heute hat", nicht „die Zahl bleibt".
--  * **ACTIVE, BOOST und CONNECT tragen 0 €.** Keine von ihnen ist kaufbar; ein
--    Preis ohne Kaufweg wäre eine Zusage ohne Gegenstand. Die 75 € für BOOST
--    aus der V5-Matrix und ein Preis für CONNECT kommen später, als eigene
--    Änderung („aktuell 0, wird ja später kommen").
--  * **`platform_settings.open_contact` bleibt unangetastet** und steht auf PROD
--    auf `true`. Die Schwelle in `darf_kontaktanfrage_senden` ist damit der
--    RÜCKFALLWERT, nicht der Ist-Zustand. Das Umlegen gehört zu AGE-930.
--  * **`admin_set_tier()` wird NICHT beschränkt.** Die Verwaltung bietet nur
--    DISCOVER, FOCUS und IMPACT an, aber in der Oberfläche: eine Korrektur nach
--    unten muss möglich bleiben, und eine Anzeigeentscheidung in einer
--    SECURITY-DEFINER-Funktion wäre eine Rechtegrenze, die nur eine Migration
--    noch ändern kann.
--
-- ── Was hier MIT muss, obwohl es kein Gate ist ───────────────────────────────
-- `handle_new_user()` schreibt `'basic'` hart und trägt keine Rangschwelle — es
-- stand deshalb in keiner Schwellen-Inventur. `profiles.tier` ist
-- Fremdschlüssel: bliebe der Trigger stehen, bräche die nächste Registrierung
-- auf PROD als FK-Verletzung, still. Er gehört in DIESE Migration, nicht in
-- eine spätere.
--
-- Die Importpfade sind geprüft und unbedenklich: `wp_schreiben.ts`,
-- `import_world_seed.ts` und `chat-testkonten.ts` schreiben `'impact'`, und
-- dieser Schlüssel überlebt unverändert.

-- ── 1. Key-Migration ────────────────────────────────────────────────────────
-- a) Die zwei neuen Stufen auf temporären Rängen. Sie müssen existieren, bevor
--    ein Profil auf sie zeigen darf (profiles_tier_fkey).
insert into public.membership_tiers (key, label, price_year, level_rank) values
  ('active', 'Active', 0, 101),
  ('boost',  'Boost',  0, 102);

-- b) Profile umhängen — nach Clubzugehörigkeit, nicht nach Rangzahl.
--    `focus` und `impact` werden nicht angefasst: sie behalten Schlüssel UND
--    Rang.
update public.profiles set tier = 'active'   where tier = 'basic';
update public.profiles set tier = 'discover' where tier in ('connect', 'exchange');

-- c) Die entfallenen Stufen entfernen. Schlägt fehl (FK), falls (b) ein Profil
--    übersehen hat — genau das ist gewollt: lieber laute Migration als stille
--    Fehlstufe. Danach sind die Ränge 1 und 4 frei.
delete from public.membership_tiers where key in ('basic', 'exchange');

-- d) Echte Ränge setzen. `discover` VOR `connect`, sonst kollidiert `connect`
--    mit dem noch belegten Rang 3.
update public.membership_tiers set level_rank = 4, price_year = 300 where key = 'discover';
update public.membership_tiers set level_rank = 3, price_year = 0   where key = 'connect';
update public.membership_tiers set level_rank = 1 where key = 'active';
update public.membership_tiers set level_rank = 2 where key = 'boost';

-- e) Neue Konten starten auf ACTIVE — derselbe Platz auf der Leiter wie „Basic",
--    neuer Name.
alter table public.profiles alter column tier set default 'active';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- `'active'` statt `'basic'`: der Schlüssel ist nach dieser Migration weg,
  -- und `profiles.tier` ist Fremdschlüssel. Ohne diese Zeile bräche die
  -- nächste Registrierung als FK-Verletzung — ohne Gate, ohne Meldung an der
  -- Oberfläche, und in keiner Schwellen-Inventur sichtbar.
  insert into public.profiles (id, name, tier)
  values (new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    'active');
  return new;
end;
$$;

-- ── 2. Die Schwellen: alles unterhalb Rang 4 steigt auf Rang 4 ──────────────
-- Die Zahlen sind aus der Zusage „ab der untersten Clubstufe" NEU abgeleitet,
-- nicht aus der alten Zahl plus eins. Dieselbe Falle, die 20260715150000 unter
-- „SCHWELLEN-DRIFT" notiert hat.

-- 2.1 Vollprofil und erweiterte Profildaten — sechs SELECT-Policies, heute
--     alle auf has_level(3). Die USING-Klauseln bleiben Zeichen für Zeichen
--     gleich, nur die Zahl steigt.
drop policy if exists profiles_select_self_or_discover on public.profiles;
create policy profiles_select_self_or_discover on public.profiles
  for select to authenticated
  using (
    public.is_activated()
    and activated_at is not null
    and disabled_at is null
    and deleted_at is null
    and (id = (select auth.uid()) or public.has_level(4))
  );

comment on policy profiles_select_self_or_discover on public.profiles is
  'Vollständige Profilzeilen nur am eigenen Profil ODER ab Rang 4 (AGE-903: die '
  'unterste Clubstufe, seit dieser Umstellung `discover`). Der Policy-NAME wurde '
  'geprägt, als `discover` Rang 3 hiess — die Autorität ist die Zahl im Rumpf, '
  'nie der Name. Der Kommentar fehlte bis AGE-903: 20260715150000 hatte einen '
  'gesetzt, ein späterer Ersatz der Policy hat ihn verloren.';

drop policy if exists needs_select on public.needs;
create policy needs_select on public.needs
  for select to authenticated
  using (
    public.is_activated()
    and public.is_activated_profile(profile_id)
    and (profile_id = (select auth.uid()) or public.has_level(4))
  );

drop policy if exists offers_select on public.offers;
create policy offers_select on public.offers
  for select to authenticated
  using (
    public.is_activated()
    and public.is_activated_profile(profile_id)
    and (profile_id = (select auth.uid()) or public.has_level(4))
  );

drop policy if exists profile_badges_select on public.profile_badges;
create policy profile_badges_select on public.profile_badges
  for select to authenticated
  using (
    public.is_activated()
    and public.is_activated_profile(profile_id)
    and (profile_id = (select auth.uid()) or public.has_level(4))
  );

drop policy if exists interests_select on public.profile_interests;
create policy interests_select on public.profile_interests
  for select to authenticated
  using (
    public.is_activated()
    and public.is_activated_profile(profile_id)
    and (profile_id = (select auth.uid()) or public.has_level(4))
  );

drop policy if exists theme_scores_select on public.profile_theme_scores;
create policy theme_scores_select on public.profile_theme_scores
  for select to authenticated
  using (
    public.is_activated()
    and public.is_activated_profile(profile_id)
    and (profile_id = (select auth.uid()) or public.has_level(4))
  );

-- 2.2 Die Anmeldung zu Mitglieder-Events: Rang 3 → Rang 4.
--     Der `public`-Zweig bleibt rangfrei — öffentliche Events sind der eine
--     Berührungspunkt für Konten ausserhalb des Clubs, und das Issue hält sie
--     unterhalb DISCOVER ausdrücklich „wie bisher" offen.
create or replace function public.register_for_event(p_event_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
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

  -- Teilnahme sichtbarkeitsabhaengig (AGE-448), Schwelle ab AGE-903 auf Rang 4.
  -- Diese Bedingung wird von `regs_write_own` GESPIEGELT — wer sich anmelden
  -- darf, darf auch absagen. Eine Änderung hier gehört dorthin mit.
  if not (
    v_event.visibility = 'public'
    or public.has_level(4)
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

comment on function public.register_for_event(uuid) is
  'Meldet den Aufrufer zum Event an und gibt den Status zurück (registered, oder '
  'waitlist bei erreichter capacity). Sperrt die Event-Zeile (for update) gegen '
  'Überbuchung; prüft Sichtbarkeit UND die Teilnahme-Schwelle: public für jeden '
  'Eingeloggten, members ab Rang 4 oder Host (AGE-448, Schwelle ab AGE-903). '
  '`regs_write_own` spiegelt diese Bedingung — wer sich anmelden darf, darf auch '
  'absagen.';

-- 2.3 Absagen trägt dieselbe Bedingung wie Anmelden (AGE-903).
--
--     Das behebt einen Widerspruch, der schon vorher bestand: `regs_write_own`
--     verlangte für JEDES Event Rang 4, `register_for_event` für ein
--     `public`-Event gar keinen. Ein aktiviertes Konto auf Rang 1 konnte sich
--     also zu einem öffentlichen Event anmelden und NIE wieder absagen.
--
--     Beide Zahlen auf 4 zu setzen schlösse nur die halbe Lücke — der
--     `public`-Zweig hätte weiter keine Entsprechung. Deshalb wird die
--     Bedingung gespiegelt, nicht die Zahl angeglichen.
drop policy if exists regs_write_own on public.event_registrations;
create policy regs_write_own on public.event_registrations
  for update to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check (
    public.is_activated()
    and profile_id = (select auth.uid())
    and exists (
      select 1 from public.events e
       where e.id = event_registrations.event_id
         and (
           e.visibility = 'public'
           or public.has_level(4)
           or e.host_id = (select auth.uid())
         )
    )
  );

comment on policy regs_write_own on public.event_registrations is
  'Ein Mitglied ändert die eigene Anmeldung (Absage über `status`, nicht DELETE). '
  'Die WITH-CHECK-Bedingung SPIEGELT `register_for_event` (AGE-903): public ohne '
  'Rangprüfung, members ab Rang 4 oder Host. Vorher verlangte sie pauschal '
  'has_level(4) und sperrte damit ein Konto auf Rang 1 in einer Anmeldung zu '
  'einem öffentlichen Event ein, die es nie absagen konnte.';

-- 2.4 Das Eintrittstor des Verzeichnisses: Rang 2 → Rang 4.
--     Liste und erweiterte Spalten tragen damit DIESELBE Schwelle. Die
--     zweistufige Trennung aus AGE-598 (Liste ab 2, erweiterte Spalten ab 3)
--     entfällt: unterhalb des Clubs gibt es kein Verzeichnis mehr, auch keins
--     mit maskierten Spalten.
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
    -- Seit AGE-903 tragen Eintrittstor und erweiterte Spalten dieselbe
    -- Schwelle (Rang 4). Die Maskierung unterhalb davon bleibt trotzdem
    -- stehen: sie ist die Grenze, das Tor ist nur die Tür davor. `coalesce`
    -- macht aus dem NULL der rechten Join-Seite das LEERE ARRAY — die
    -- Oberfläche unterscheidet „keine Kompetenzen hinterlegt" von „darfst du
    -- nicht sehen".
    coalesce(p.competencies, '{}'::text[]),

    -- `offers`/`needs` tragen dieselbe Rang-4-Schwelle in ihrer eigenen
    -- SELECT-Policy (`… or has_level(4)`). Die vier Aggregate maskieren sich
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
  -- Die einzige Rangzahl in diesem Rumpf, ab AGE-903 auf Rang 4. Der
  -- Selbst-Zweig hält die Zusage aus AGE-540: ein Konto darunter findet sich
  -- selbst.
  where (public.has_level(4) or pp.id = (select auth.uid()))

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
  'Mitgliederverzeichnis. Ab AGE-903 erst ab Rang 4 erreichbar — Liste UND '
  'erweiterte Spalten tragen dieselbe Schwelle, die zweistufige Trennung aus '
  'AGE-598 (Liste ab Rang 2) entfällt. Basisfelder aus `profiles_public`, '
  'erweiterte Spalten (competencies, has_offers/has_needs, offer_/need_categories) '
  'aus `public.profiles` unter der gleich hohen SELECT-Policy. Der Selbst-Zweig '
  'im Eintrittstor hält die Zusage aus AGE-540, dass ein Konto darunter sich '
  'selbst findet.';

-- 2.5 Kontaktanfragen: die Staffelung entfällt ersatzlos.
--     Vorher: ab Rang 3 an jeden, Rang 2 nur an genau `connect`, Rang 1 nein.
--     Danach: ab Rang 4 an jeden, darunter nein. Die Empfängerstufe spielt
--     keine Rolle mehr — damit fällt auch der Grund für SECURITY DEFINER weg,
--     die Eigenschaft bleibt aber, weil die Funktion in einer Policy steht und
--     ein Wechsel auf INVOKER eine zweite Änderung wäre.
--
--     ACHTUNG: `platform_settings.open_contact` steht auf PROD auf `true` und
--     hebt diese Schwelle auf — `is_contact_open()` steht in der Policy davor.
--     Die Zahl hier ist der RÜCKFALLWERT, nicht der Ist-Zustand. Jede Aussage
--     über Kontaktanfrage-Rechte muss zuerst `platform_settings` lesen.
create or replace function public.darf_kontaktanfrage_senden(p_to_id uuid)
returns boolean
language sql
stable security definer
set search_path to ''
as $$
  -- Ab Rang 4 — der untersten Clubstufe — an jeden. Die Zahl steht hier und
  -- sonst nirgends. Unterhalb gibt es keine Anfragen, auch nicht an eine
  -- bestimmte Stufe: die Staffelung aus AGE-598 entfiel mit AGE-903, weil
  -- „connect darf an connect" eine Aussage über eine Stufe war, die es in
  -- dieser Bedeutung nicht mehr gibt.
  select public.has_level(4);
$$;

comment on function public.darf_kontaktanfrage_senden(uuid) is
  'Darf der Aufrufer p_to_id eine Kontaktanfrage schicken? Ab AGE-903 allein eine '
  'Frage der ABSENDERstufe: ab Rang 4 (unterste Clubstufe) an jeden, darunter '
  'nicht. Die Staffelung nach Empfängerstufe aus AGE-598 ist ersatzlos entfallen. '
  'Wirkt nur im geschlossenen Modus — is_contact_open() steht in der Policy davor, '
  'und der Schalter steht auf PROD auf true.';

-- ── 3. Katalog-Kommentare, die sonst die alte Leiter als Wahrheit ausgäben ──
-- 20260715150000 hat das als eigenen Schritt ernst genommen, und dieser Change
-- folgt ihrem Muster. Der Kommentar auf `has_level` ist der teuerste von allen:
-- er ist die einzige Stelle im Katalog, an der die Rangtabelle ausgeschrieben
-- steht — und genau die ändert sich hier.
comment on function public.has_level(int) is
  'True, wenn der Aufrufer eingeloggt ist und mindestens level_rank p_min_rank '
  'hat. Ersetzt is_prime_plus() (AGE-311). Ränge ab AGE-903: active=1 boost=2 '
  'connect=3 discover=4 focus=5 impact=6. Der Club beginnt bei Rang 4 — jede '
  'Clubschwelle lautet has_level(4). ACHTUNG: `connect` und `discover` trugen '
  'davor die Ränge 2 und 3; ein Schlüsselname allein sagt nichts über Rechte.';

comment on table public.membership_tiers is
  'Mitgliedsstufen (Leiter V5, AGE-903). level_rank steigt active=1 boost=2 '
  'connect=3 discover=4 focus=5 impact=6; der Club beginnt bei discover (Rang 4), '
  'die drei darunter werden nur technisch vorgehalten und tragen 0 €. '
  'Preise/Labels sind hier die Wahrheit; src/config/levels.ts spiegelt sie fürs '
  'Frontend.';

-- ── 4. Schlussprüfung in derselben Migration ────────────────────────────────
-- Eine Prüfung, nicht zwei.
--
-- „Kein Profil steht auf einem entfallenen Schlüssel" braucht hier KEINEN
-- eigenen Wächter: `profiles_tier_fkey` macht Schritt 1c unmöglich, solange ein
-- Profil noch auf `basic` oder `exchange` zeigt. Gegenprobe gefahren (26.09.):
-- `delete from membership_tiers where key = 'basic'` scheitert mit 23503 und
-- nennt den Schlüssel. Ein zweiter Wächter daneben könnte nie feuern, sähe aber
-- wie eine echte Prüfung aus — und verdünnte damit die eine, die feuern kann.
--
-- Was der Fremdschlüssel NICHT fängt, ist ein falscher Rang oder ein falscher
-- Preis: beides sind gültige Werte in gültigen Zeilen. Genau dafür ist diese
-- Prüfung da. Gegenprobe ebenfalls gefahren: mit `boost` auf Rang 9 bricht sie
-- ab und schreibt die vorgefundene Leiter in die Meldung.
-- Die Zahlen werden vor der Verkettung ausdruecklich auf `int` gecastet. Sie
-- SIND `integer` (gemessen), der Vergleich stimmt also auch ohne — aber dann
-- haengt eine Zusage an einer Textdarstellung, und ein spaeterer Leser muesste
-- den Spaltentyp nachschlagen, um ihr zu trauen.
do $$
declare
  v_leiter text;
begin
  select string_agg(key || '=' || level_rank::int || '/' || price_year::int || '€', ' '
                    order by level_rank)
    into v_leiter from public.membership_tiers;
  if v_leiter is distinct from
     'active=1/0€ boost=2/0€ connect=3/0€ discover=4/300€ focus=5/600€ impact=6/1200€'
  then
    raise exception 'AGE-903: die Leiter steht auf "%" statt auf der Zielleiter', v_leiter;
  end if;
end $$;
