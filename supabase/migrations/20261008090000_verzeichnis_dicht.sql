-- Der Rohzugriff auf `profiles` und `profiles_public` wird geschlossen
-- (AGE-1001, Change `verzeichnis-dicht`).
--
-- ⚠ ZUM ZEITSTEMPEL DIESER DATEI
--
-- Sie hiess bis zum 08.10. `20261003160000_verzeichnis_dicht.sql` und ist auf
-- den heutigen Tag gezogen worden — NACH
-- `20261007120000_aktivste_mitglieder_ohne_neuigkeiten.sql`. Der Grund ist
-- gemessen und nicht kosmetisch:
--
--   * CI baut die Datenbank FRISCH auf und spielt nach Zeitstempel ein. Mit dem
--     alten Stempel lief diese Datei dort ZUERST und AGE-1004 danach — der
--     Filter stand am Ende da, alles gruen.
--   * PROD spielt in der Reihenfolge der MERGES ein. Dort lief AGE-1004 zuerst,
--     und diese Datei kaeme mit einem aelteren Stempel hinterher und
--     ueberschriebe die Funktion.
--
-- Ein Test im Neuaufbau kann diesen Unterschied gar nicht sehen. Das Umhaengen
-- ist deshalb die eigentliche Massnahme, der Test nur ihr Waechter. Erlaubt ist
-- es, weil diese Migration zum Zeitpunkt des Umhaengens NIRGENDS eingespielt
-- war ausser auf dem geteilten lokalen Stack — nicht auf DEV, nicht auf PROD.
-- Befund der Plan-Review zu AGE-1004 (codex, HIGH).
--
-- ══ WARUM ══════════════════════════════════════════════════════════════════
-- Beide Relationen waren fuer jedes angemeldete Konto als MENGE lesbar:
--   * `profiles` ab Rang 4 (`profiles_select_self_or_discover`), einschliesslich
--     der Zeilen mit `is_public = false`, die die Sicht gerade herausfiltert;
--   * `profiles_public` mit `security_invoker = off` (umgeht die RLS), OHNE
--     jede Rangpruefung, mit `grant select to authenticated`.
-- Mit AGE-1000 ist „Mitglieder gezielt suchen" ein Recht ab Rang 6. Das galt an
-- der Oberflaeche und an `search_directory` — und am Rohzugriff nicht.
--
-- ══ WARUM ENTZUG UND ERSATZ IN DERSELBEN DATEI STEHEN ══════════════════════
-- Ein Zwischenzustand, in dem das Leserecht weg und der Ersatz noch nicht da
-- ist, waere ein Ausfall des Verzeichnisses fuer alle. Supabase faehrt eine
-- Migrationsdatei in EINER Transaktion; die Reihenfolge hier ist deshalb
-- Lesbarkeit, nicht Sicherheit.
--
-- ══ WAS DIE PLAN-REVIEW GEAENDERT HAT (gemini APPROVE, codex REQUEST-CHANGES)
--   1. **Die Schreibwege mussten mit.** `update … where id = $1` braucht
--      `select` auf die Spalten der WHERE-Klausel — der Entzug bricht also den
--      SCHREIBVORGANG SELBST. Gemessen am 03.10. gegen den lokalen Stack:
--        nur UPDATE(spalte), kein SELECT: `update … where id = $1` -> VERWEIGERT
--        dasselbe update OHNE where                                -> gelingt
--        zusaetzlich SELECT(id): das update                        -> gelingt
--        … und dann `select count(*)`                              -> ALLE ZEILEN
--      Die letzte Zeile schliesst den naheliegenden Flicken aus: ein
--      spaltenweises `select(id)` repariert das Schreiben und stellt die
--      Aufzaehlbarkeit wieder her. Deshalb faellt auch UPDATE, und die vier
--      Schreibstellen wandern in Funktionen.
--   2. **`feed_top_authors` bleibt INVOKER.** Sie zaehlt `posts` unter den
--      Rechten des Aufrufers; beide SELECT-Policies auf `posts` tragen
--      `veroeffentlicht_ab <= now()`. Als DEFINER zaehlte sie terminierte
--      Beitraege mit. Nur ihre NAMENSAUFLOESUNG geht ueber die neue Funktion.
--   3. **Eine DEFINER-Funktion erbt kein Praedikat.** Jede hier fuehrt die
--      Lebenszyklus-Pruefungen selbst, die ihr die RLS abgenommen hat —
--      `is_activated()`, `activated_at`, `disabled_at`, `deleted_at`, fuer
--      Aufrufer UND Ziel. Ohne sie waere dieser Change an dieser Stelle eine
--      AUSWEITUNG.
--
-- ══ WAS HIER NICHT ZUGESAGT WIRD ═══════════════════════════════════════════
-- Die Obergrenzen auf den Stapelfunktionen sind ein BETRIEBSMITTEL gegen teure
-- Abfragen und KEIN Zugriffsschutz: wer 200 Kennungen auf einmal einloesen
-- darf, darf auch fuenfzig Mal 200. Was traegt, ist die Unerratbarkeit einer
-- UUID und dass Kennungen nur aus erreichbaren Flaechen stammen. Dieser Change
-- macht aus einem MENGENzugriff einen KENNUNGSzugriff — nicht mehr.

-- ════════════════════════════════════════════════════════════════════════════
-- 1 · Die eigene Zeile
-- ════════════════════════════════════════════════════════════════════════════

-- Gibt ALLE Spalten zurueck, nicht eine Auswahl. Der Eigentuemer liest sie heute
-- ohnehin alle; eine Spaltenliste muesste bei jeder Schemaaenderung nachgezogen
-- werden, und eine vergessene Spalte waere ein stiller Datenverlust im
-- Profil-Editor (`profile.ts` liest `select("*")`).
create function public.mein_profil()
  returns setof public.profiles
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p.*
    from public.profiles p
   where p.id = (select auth.uid())
     and public.is_activated()
     and p.activated_at is not null
     and p.disabled_at is null
     and p.deleted_at is null;
$$;

comment on function public.mein_profil() is
  'Die eigene Profilzeile, alle Spalten. Ersetzt den direkten Lesezugriff auf '
  'public.profiles, der mit AGE-1001 entzogen wurde. Fuehrt die '
  'Lebenszyklus-Pruefungen der abgeloesten Policy selbst — eine '
  'DEFINER-Funktion erbt kein Praedikat.';

revoke execute on function public.mein_profil()
  from public, anon, authenticated, service_role;
grant  execute on function public.mein_profil() to authenticated;

-- Schmal, weil sie bei JEDEM Sitzungsstart laeuft. Ersetzt die Einbettung
-- `membership_tiers(level_rank)` in `AuthProvider` und in der Edge Function
-- `create-checkout-session` — eine Einbettung ohne Leserecht auf der
-- eingebetteten Relation killt die GANZE Abfrage mit 401, nicht nur den
-- eingebetteten Teil.
create function public.meine_stufe()
  returns table (tier text, level_rank integer)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p.tier, mt.level_rank
    from public.profiles p
    join public.membership_tiers mt on mt.key = p.tier
   where p.id = (select auth.uid())
     and public.is_activated()
     and p.activated_at is not null
     and p.disabled_at is null
     and p.deleted_at is null;
$$;

comment on function public.meine_stufe() is
  'Stufe und Rang des Aufrufers. Ersetzt die Einbettung '
  'membership_tiers(level_rank) auf public.profiles (AGE-1001). Schmal '
  'gehalten: sie laeuft bei jedem Sitzungsstart, mein_profil() zoege dort alle '
  'Spalten.';

revoke execute on function public.meine_stufe()
  from public, anon, authenticated, service_role;
grant  execute on function public.meine_stufe() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 2 · Karten zu BEKANNTEN Kennungen
-- ════════════════════════════════════════════════════════════════════════════

-- Dieselben zehn Felder, die `profiles_public` projiziert, und dasselbe
-- Praedikat. `resolve_display_name` wird AUFGERUFEN, nicht nachgebaut — eine
-- zweite Fassung der Namensmaskierung (AGE-291) liefe beim naechsten Griff
-- daran auseinander.
create function public.profil_karten(p_ids uuid[])
  returns table (id uuid, name text, avatar_url text, region text, company text,
                 short_bio text, tier text, roles text[], cover_url text,
                 branche text)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p.id,
         public.resolve_display_name(p.id, p.name),
         p.avatar_url, p.region, p.company, p.short_bio, p.tier, p.roles,
         p.cover_url, p.branche
    from public.profiles p
   where p.id = any(p_ids[1:200])
     and p.is_public
     and public.is_activated()
     and p.activated_at is not null
     and p.disabled_at is null
     and p.deleted_at is null;
$$;

comment on function public.profil_karten(uuid[]) is
  'Basisfelder zu BEKANNTEN Kennungen. Ersetzt den direkten Lesezugriff auf '
  'public.profiles_public (AGE-1001). Praedikat der Sicht unveraendert, '
  'einschliesslich is_public. Die Grenze 200 ist ein BETRIEBSMITTEL gegen '
  'teure Abfragen und KEIN Zugriffsschutz — wer 200 einloesen darf, darf auch '
  'fuenfzig Mal 200.';

revoke execute on function public.profil_karten(uuid[])
  from public, anon, authenticated, service_role;
grant  execute on function public.profil_karten(uuid[]) to authenticated;

-- Dieselben Felder OHNE `is_public`, dafuer nur fuer Profile, mit denen der
-- Aufrufer einen Gespraechsfaden teilt. Das Praedikat IST die Berechtigung.
--
-- WARUM ES DIESE FUNKTION ZUSAETZLICH GIBT: `chat.ts` liest heute ausdruecklich
-- die Basistabelle statt der Sicht, damit ein Gespraechspartner auch dann
-- seinen Namen traegt, wenn er sein Profil nicht oeffentlich gestellt hat. Ein
-- Ersatz mit dem Praedikat der Sicht liesse im Chat Namen verschwinden — und
-- zwar AUSSCHLIESSLICH bei den Mitgliedern, die sich aus dem Verzeichnis
-- zurueckgezogen haben, also bei denen, die am wenigsten damit rechnen. Kein
-- Test mit oeffentlichen Konten haette es bemerkt.
create function public.gespraechspartner_karten(p_ids uuid[])
  returns table (id uuid, name text, avatar_url text, region text, company text,
                 short_bio text, tier text, roles text[], cover_url text,
                 branche text)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p.id,
         public.resolve_display_name(p.id, p.name),
         p.avatar_url, p.region, p.company, p.short_bio, p.tier, p.roles,
         p.cover_url, p.branche
    from public.profiles p
   where p.id = any(p_ids[1:200])
     and public.is_activated()
     and p.activated_at is not null
     and p.disabled_at is null
     and p.deleted_at is null
     and exists (
       select 1 from public.message_threads t
        where (t.a_profile_id = (select auth.uid()) and t.b_profile_id = p.id)
           or (t.b_profile_id = (select auth.uid()) and t.a_profile_id = p.id));
$$;

comment on function public.gespraechspartner_karten(uuid[]) is
  'Basisfelder von Gespraechspartnern — OHNE is_public, dafuer nur bei '
  'gemeinsamem Faden. Ersetzt den bewussten Zugriff von chat.ts auf die '
  'Basistabelle (AGE-1001): ein zurueckgezogenes Profil traegt im Chat '
  'weiterhin seinen Namen. Grenze 200 = Betriebsmittel, kein Schutz.';

revoke execute on function public.gespraechspartner_karten(uuid[])
  from public, anon, authenticated, service_role;
grant  execute on function public.gespraechspartner_karten(uuid[]) to authenticated;

-- Die erweiterten Felder EINES fremden Profils, mit genau der Schwelle, die
-- `profiles_select_self_or_discover` bisher getragen hat: Clubschwelle oder die
-- eigene Zeile. Das ist die Form, die `public-profile.ts` braucht, und sie
-- bleibt Rang 4 — die Verzeichnisschwelle (Rang 6) gilt der SUCHE, nicht dem
-- Aufruf eines einzelnen bekannten Profils (Entscheidung E4 des Go-live-Plans).
create function public.profil_detail(p_id uuid)
  returns table (headline text, branche text, member_since date,
                 potential_score integer, competencies text[], videos text[])
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p.headline, p.branche, p.member_since, p.potential_score,
         p.competencies, p.videos
    from public.profiles p
   where p.id = p_id
     and public.is_activated()
     and p.activated_at is not null
     and p.disabled_at is null
     and p.deleted_at is null
     and (p.id = (select auth.uid()) or public.has_level(4));
$$;

comment on function public.profil_detail(uuid) is
  'Erweiterte Felder EINES bekannten Profils. Ersetzt den direkten Lesezugriff '
  'von public-profile.ts auf public.profiles (AGE-1001) und traegt dieselbe '
  'Schwelle wie die abgeloeste Policy: Clubschwelle oder eigene Zeile. Die '
  'Verzeichnisschwelle gilt der SUCHE, nicht dem Aufruf eines bekannten '
  'Profils.';

revoke execute on function public.profil_detail(uuid)
  from public, anon, authenticated, service_role;
grant  execute on function public.profil_detail(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3 · Die Schreibwege
-- ════════════════════════════════════════════════════════════════════════════

-- Alle Parameter OHNE Vorgabewert: der Editor schreibt immer den vollstaendigen
-- Satz, und ein „null heisst unveraendert" waere genau die Zweideutigkeit, an
-- der `saveProfile` schon einmal Interessen und Ziele lautlos geloescht hat.
-- Die Funktion setzt, was sie bekommt — so, wie es das abgeloeste `update` tat.
create function public.profil_speichern(
    p_name text, p_region text, p_company text, p_short_bio text,
    p_branche text, p_headline text, p_roles text[], p_competencies text[],
    p_website text, p_dev_focus text, p_socials jsonb, p_videos text[],
    p_avatar_url text, p_cover_url text)
  returns table (profile_completion integer, avatar_url text, cover_url text)
  language sql
  volatile
  security definer
  set search_path = ''
as $$
  update public.profiles p
     set name = p_name, region = p_region, company = p_company,
         short_bio = p_short_bio, branche = p_branche, headline = p_headline,
         roles = p_roles, competencies = p_competencies, website = p_website,
         dev_focus = p_dev_focus, socials = p_socials, videos = p_videos,
         avatar_url = p_avatar_url, cover_url = p_cover_url
   where p.id = (select auth.uid())
     and public.is_activated()
     and p.activated_at is not null
     and p.disabled_at is null
     and p.deleted_at is null
  returning p.profile_completion, p.avatar_url, p.cover_url;
$$;

comment on function public.profil_speichern(text, text, text, text, text, text, text[], text[], text, text, jsonb, text[], text, text) is
  'Speichert das eigene Profil. Ersetzt das direkte UPDATE samt .select()-Kette '
  '(AGE-1001). Gibt zurueck, was der Aufrufer bisher ueber .select() bekam. '
  'KEINE Vorgabewerte: der Editor schreibt immer den vollstaendigen Satz.';

revoke execute on function public.profil_speichern(text, text, text, text, text, text, text[], text[], text, text, jsonb, text[], text, text)
  from public, anon, authenticated, service_role;
grant  execute on function public.profil_speichern(text, text, text, text, text, text, text[], text[], text, text, jsonb, text[], text, text) to authenticated;

create function public.verzeichnis_sichtbarkeit_setzen(p_sichtbar boolean)
  returns void
  language sql
  volatile
  security definer
  set search_path = ''
as $$
  update public.profiles p
     set is_public = p_sichtbar
   where p.id = (select auth.uid())
     and public.is_activated()
     and p.activated_at is not null
     and p.disabled_at is null
     and p.deleted_at is null;
$$;

comment on function public.verzeichnis_sichtbarkeit_setzen(boolean) is
  'Setzt profiles.is_public der eigenen Zeile (AGE-1001).';

revoke execute on function public.verzeichnis_sichtbarkeit_setzen(boolean)
  from public, anon, authenticated, service_role;
grant  execute on function public.verzeichnis_sichtbarkeit_setzen(boolean) to authenticated;

create function public.entwicklungsschwerpunkt_setzen(p_fokus text)
  returns void
  language sql
  volatile
  security definer
  set search_path = ''
as $$
  update public.profiles p
     set dev_focus = p_fokus
   where p.id = (select auth.uid())
     and public.is_activated()
     and p.activated_at is not null
     and p.disabled_at is null
     and p.deleted_at is null;
$$;

comment on function public.entwicklungsschwerpunkt_setzen(text) is
  'Setzt profiles.dev_focus der eigenen Zeile (AGE-1001).';

revoke execute on function public.entwicklungsschwerpunkt_setzen(text)
  from public, anon, authenticated, service_role;
grant  execute on function public.entwicklungsschwerpunkt_setzen(text) to authenticated;

-- Drei Einzelfunktionen statt einer mit drei Vorgabewerten. Der Grund ist die
-- Zweideutigkeit: bei „null heisst unveraendert" laesst sich ein Feld nie
-- leeren, bei „null heisst leeren" leert ein vergessener Parameter still. Der
-- Funktionsname IST hier die Positivliste.
create function public.onboarding_kopfzeile_setzen(p_headline text)
  returns void language sql volatile security definer set search_path = ''
as $$
  update public.profiles p set headline = p_headline
   where p.id = (select auth.uid()) and public.is_activated()
     and p.activated_at is not null and p.disabled_at is null and p.deleted_at is null;
$$;

create function public.onboarding_region_setzen(p_region text)
  returns void language sql volatile security definer set search_path = ''
as $$
  update public.profiles p set region = p_region
   where p.id = (select auth.uid()) and public.is_activated()
     and p.activated_at is not null and p.disabled_at is null and p.deleted_at is null;
$$;

create function public.onboarding_bild_setzen(p_avatar_url text)
  returns void language sql volatile security definer set search_path = ''
as $$
  update public.profiles p set avatar_url = p_avatar_url
   where p.id = (select auth.uid()) and public.is_activated()
     and p.activated_at is not null and p.disabled_at is null and p.deleted_at is null;
$$;

comment on function public.onboarding_kopfzeile_setzen(text) is
  'Setzt profiles.headline der eigenen Zeile (AGE-1001). Eigene Funktion je '
  'Feld: der Name ist die Positivliste, und es gibt keine null-Zweideutigkeit.';
comment on function public.onboarding_region_setzen(text) is
  'Setzt profiles.region der eigenen Zeile (AGE-1001).';
comment on function public.onboarding_bild_setzen(text) is
  'Setzt profiles.avatar_url der eigenen Zeile (AGE-1001).';

revoke execute on function public.onboarding_kopfzeile_setzen(text)
  from public, anon, authenticated, service_role;
revoke execute on function public.onboarding_region_setzen(text)
  from public, anon, authenticated, service_role;
revoke execute on function public.onboarding_bild_setzen(text)
  from public, anon, authenticated, service_role;
grant execute on function public.onboarding_kopfzeile_setzen(text) to authenticated;
grant execute on function public.onboarding_region_setzen(text) to authenticated;
grant execute on function public.onboarding_bild_setzen(text) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4 · Die beiden Funktionen, die der Entzug sonst gebrochen haette
-- ════════════════════════════════════════════════════════════════════════════

-- `search_directory` liest `profiles_public` und waere nach dem Entzug fuer
-- jeden gescheitert. Sie wird DEFINER — unveraendert in allem uebrigen.
--
-- WAS SICH DABEI VERSCHIEBT: sie liest daneben `left join public.profiles p`
-- fuer die erweiterten Spalten. Als INVOKER maskierte die RLS `p.competencies`
-- fuer jeden unterhalb von Rang 4. Als DEFINER tut sie das nicht mehr — die
-- Maskierung haengt dann ALLEIN am Eintrittstor unten. Dass das Ergebnis
-- dasselbe bleibt, folgt daraus, dass Rang 6 den Rang 4 einschliesst und der
-- Selbst-Zweig nur die eigene Zeile liefert. Das ist nach dieser Umstellung
-- keine Eigenschaft der Datenbank mehr, sondern eine Eigenschaft DIESER
-- where-Klausel — und steht deshalb als Zusage in `verzeichnis_dicht_test.sql`,
-- nicht nur als dieser Kommentar.
alter function public.search_directory(text, text, text, text, text, text, text[], text[])
  security definer;

-- `feed_top_authors` BLEIBT INVOKER — Befund der Plan-Review. Sie zaehlt
-- `public.posts` unter den Rechten des Aufrufers, und beide SELECT-Policies auf
-- `posts` tragen `veroeffentlicht_ab <= now()`. Als DEFINER zaehlte sie
-- terminierte Beitraege mit. Das Sichtbarkeits-Praedikat hier nachzubauen waere
-- eine KOPIE einer Policy, und Kopien laufen auseinander.
--
-- Nur die NAMENSAUFLOESUNG wechselt: von `join profiles_public` auf
-- `profil_karten`. Das Zaehlen bleibt beim Aufrufer, der Entzug trifft genau
-- die Stelle, die er treffen soll.
--
-- ⚠ DER FILTER AUS AGE-1004 WANDERT MIT, UND DAS IST KEIN BEIWERK.
--
-- `20261007120000_aktivste_mitglieder_ohne_neuigkeiten.sql` hat dieser Funktion
-- `where p.kind in ('member', 'event')` gegeben: Produktmitteilungen zaehlen
-- nicht mehr mit, Veranstaltungen weiterhin schon (Entscheidung Donald,
-- 25.08.). Diese Migration schreibt denselben Rumpf neu — ohne den Filter naehme
-- sie ihn LAUTLOS wieder weg.
--
-- Nichts schluege dabei fehl. Deshalb haengt die Zusage nicht an diesem
-- Kommentar, sondern an `feed_sidebar_test.sql`: wer den Filter hier entfernt,
-- wird dort rot. Befund der Plan-Review zu AGE-1004 (codex, HIGH).
create or replace function public.feed_top_authors(p_limit int default 5)
  returns table (profile_id uuid, name text, avatar_url text, post_count bigint)
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select k.id, k.name, k.avatar_url, z.anzahl
    from (select p.author_id, count(*) as anzahl
            from public.posts p
           where p.kind in ('member', 'event')
           group by p.author_id) z
    cross join lateral public.profil_karten(array[z.author_id]) k
   order by z.anzahl desc, k.name, k.id
   limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

comment on function public.feed_top_authors(int) is
  'Die aktivsten Mitglieder nach Zahl der Beitraege, die der AUFRUFER sehen '
  'darf. BLEIBT security invoker (AGE-1001): als DEFINER zaehlte sie '
  'terminierte und verborgene Beitraege mit — beide SELECT-Policies auf posts '
  'tragen veroeffentlicht_ab <= now(). Nur die Namensaufloesung geht seitdem '
  'ueber profil_karten statt ueber ein Leserecht auf profiles_public; die '
  'Funktion schliesst damit weiterhin zurueckgezogene, unbestaetigte, '
  'deaktivierte und geloeschte Profile aus. Gezaehlt werden weiterhin NUR '
  'kind = ''member'' und kind = ''event'' (AGE-1004) — Produktmitteilungen '
  'nicht, Veranstaltungen schon.';

-- ════════════════════════════════════════════════════════════════════════════
-- 5 · Der Entzug
-- ════════════════════════════════════════════════════════════════════════════
--
-- Alle vier Rollen NAMENTLICH: frische Supabase-Instanzen vergeben
-- rollenspezifisch, und ein `revoke … from public` entfernt dort nichts.
--
-- UPDATE faellt MIT. Ohne SELECT auf die Spalten der WHERE-Klausel waeren die
-- 17 Spalten-Grants ohnehin unbenutzbar, und ein `grant select (id)` als
-- Flicken stellte die Aufzaehlbarkeit wieder her — gemessen.

revoke select, update on public.profiles
  from public, anon, authenticated, service_role;
revoke select on public.profiles_public
  from public, anon, authenticated, service_role;

-- `service_role` haelt `bypassrls` und braucht die Tabellenrechte hier nicht;
-- die Edge Functions, die als service_role schreiben, gehen ueber eigene
-- DEFINER-Funktionen. Gemessen vor dem Entzug, nicht angenommen.

comment on view public.profiles_public is
  'Projektion der oeffentlichen Profilfelder mit aufgeloestem Namen. Seit '
  'AGE-1001 fuer `authenticated` NICHT mehr lesbar — sie dient nur noch den '
  'SECURITY DEFINER-Funktionen profil_karten() und search_directory(). Die '
  'Sicht bleibt bestehen, weil ihr Praedikat an einer Stelle steht statt an '
  'dreien.';
