-- Grant-Matrix als Test (AGE-312) — laeuft mit `supabase test db`.
--
-- Warum das hier steht: Bis AGE-312 sagten unsere Migrationen fuer die meisten
-- Tabellen nie, welche Rechte anon/authenticated haben sollen. Der Ist-Zustand
-- kam aus Supabases `alter default privileges` — einer Voreinstellung, die uns
-- nicht gehoert und die sich zwischen Umgebungen unterscheidet. Was eine Instanz
-- trug, haengt so daran, wann sie angelegt wurde; geprueft war keine Seite.
--
-- Dieser Test haelt die Matrix fest. Bewusst als EIN Gesamtvergleich statt als
-- ~60 Einzel-Assertions: Eine neu angelegte Tabelle, die wieder Rechte erbt,
-- wuerde bei Einzel-Assertions durchrutschen (niemand haette eine dafuer
-- geschrieben) — genau dieser Fall ist die Ursache von AGE-312. Der
-- Gesamtvergleich faellt darueber sofort.
--
-- Ergaenzt rls_test.sql, ersetzt es nicht: dort stehen die Policies (WELCHE
-- ZEILEN), hier die Grants (WELCHE OPERATIONEN ueberhaupt). Beides muss stimmen
-- — ein Grant ohne Policy ist totes Gewicht, eine Policy ohne Grant ist tot.
--
-- Aenderst du die Matrix bewusst, ist das erwartete Ergebnis unten mitzupflegen.
-- Der Diff im Testlauf zeigt genau, was sich verschoben hat.

begin;
select plan(14);

-- ── 1. Tabellen-Grants ───────────────────────────────────────────────────────
-- Jedes Recht hier ist durch eine Policy gedeckt; wo keine Policy ist, steht
-- auch kein Grant. anon steht nur auf den fuenf Tabellen, die eine anon-Policy
-- haben. TRUNCATE/REFERENCES/TRIGGER/MAINTAIN kommen bewusst nirgends vor: an
-- ihnen greift RLS nicht.

select is(
  (select coalesce(string_agg(table_name || '/' || grantee || '=' || privs, E'\n'
                              order by table_name, grantee), '(leer)')
   from (select table_name, grantee,
                string_agg(distinct privilege_type, ',' order by privilege_type) as privs
         from information_schema.role_table_grants
         where table_schema = 'public' and grantee in ('anon', 'authenticated')
         group by 1, 2) t),
$$admin_audit/authenticated=SELECT
badges/anon=SELECT
badges/authenticated=SELECT
comments/authenticated=INSERT,SELECT
compass_responses/authenticated=DELETE,INSERT,SELECT,UPDATE
contact_requests/authenticated=INSERT,SELECT
event_registrations/authenticated=DELETE,INSERT,SELECT,UPDATE
events/anon=SELECT
events/authenticated=DELETE,INSERT,SELECT,UPDATE
feedback/authenticated=DELETE,INSERT,SELECT,UPDATE
goals/authenticated=DELETE,INSERT,SELECT,UPDATE
matches/authenticated=SELECT
member_settings/authenticated=INSERT,SELECT,UPDATE
membership_tiers/anon=SELECT
membership_tiers/authenticated=SELECT
message_threads/authenticated=INSERT,SELECT
messages/authenticated=INSERT,SELECT
needs/authenticated=DELETE,INSERT,SELECT,UPDATE
notifications/authenticated=DELETE,INSERT,SELECT,UPDATE
offers/authenticated=DELETE,INSERT,SELECT,UPDATE
partner_categories/anon=SELECT
partner_categories/authenticated=SELECT
partners/authenticated=SELECT
platform_settings/authenticated=SELECT
post_likes/authenticated=DELETE,INSERT,SELECT
post_media/anon=SELECT
post_media/authenticated=DELETE,INSERT,SELECT
post_saves/authenticated=DELETE,INSERT,SELECT
posts/anon=SELECT
posts/authenticated=DELETE,SELECT
profile_badges/authenticated=SELECT
profile_contacts/authenticated=INSERT,SELECT,UPDATE
profile_interests/authenticated=DELETE,INSERT,SELECT,UPDATE
profile_theme_scores/authenticated=DELETE,INSERT,SELECT,UPDATE
profiles/authenticated=SELECT
profiles_public/authenticated=SELECT
routing_queue/authenticated=SELECT
staff_roles/authenticated=SELECT
tags/anon=SELECT
tags/authenticated=SELECT$$,
  'Tabellen-Grants: exakt das, was die Policies decken — und sonst nichts');

-- AGE-528 hat zwei Tabellen dazugelegt, und beide Zeilen sind eine Aussage:
-- `post_media/anon=SELECT` ist nicht Großzügigkeit, sondern Voraussetzung — ohne
-- sie erfährt der ausgeloggte Besucher den Pfad des Bildes eines öffentlichen
-- Beitrags nicht und die Storage-Policy käme nie zum Zug. Kein UPDATE auf
-- post_media: ein Bild wird ersetzt, indem die Zeile fällt und eine neue
-- entsteht. Und `tags` trägt fuer BEIDE Rollen nur SELECT — die Liste ist
-- redaktionell, ein INSERT hier waere der Weg, sich einen kuratierten Tag
-- selbst zu verleihen.

-- AGE-582 hat `post_saves` dazugelegt — eine private Merkliste, und die Zeile
-- sagt vor allem, was NICHT darauf steht: kein UPDATE. An einer Speicherung
-- gibt es nichts zu aendern; wer sie loesen will, loescht die Zeile. Und kein
-- `anon`: die Liste hat einem ausgeloggten Besucher keine Frage zu beantworten.
-- Die RLS traegt dieselbe Aussage ein zweites Mal (drei Policies, keine fuer
-- UPDATE), damit die Tabelle auch dann unveraenderlich bleibt, wenn ein Grant
-- auf dem Weg zurueckkehrt, der AGE-312 ausgeloest hat.

-- ── 2. Spalten-Grants ────────────────────────────────────────────────────────
-- Nur die Tabellen, bei denen das Grant ENGER ist als seine Policy. Die
-- Policy erlaubt UPDATE auf der Zeile, schreibbar ist aber nur diese Liste;
-- abgeleitete Felder (tier, potential_score, profile_completion, ...) gehoeren
-- Triggern und RPCs. Faellt eine Spalte hier still dazu, waere das eine
-- Rechteausweitung, die rls_test.sql nicht sieht.
--
-- `posts` kam am 24.08. dazu (AGE-582). Der Grund steht in einer Zahl: seit
-- `posts.like_count` existiert, sortiert der Feed nach einem Wert, der in einer
-- Zeile steht, die ihrem Autor gehoert. Mit tabellenweitem UPDATE konnte er ihn
-- selbst setzen — gemessen, nicht befuerchtet: `update posts set like_count =
-- 999` auf dem eigenen Beitrag ging durch. Die drei Spalten hier sind die, die
-- `updatePost` wirklich schreibt.

select is(
  (select coalesce(string_agg(table_name || '.UPDATE=' || cols, E'\n' order by table_name), '(leer)')
   from (select table_name, string_agg(distinct column_name, ',' order by column_name) as cols
         from information_schema.role_column_grants
         where table_schema = 'public' and grantee = 'authenticated'
           and privilege_type = 'UPDATE'
           and table_name in ('profiles', 'contact_requests', 'routing_queue', 'platform_settings',
                              'posts')
         group by 1) t),
$$contact_requests.UPDATE=status
platform_settings.UPDATE=open_contact
posts.UPDATE=body,hashtags,visibility
profiles.UPDATE=avatar_url,branche,company,competencies,cover_url,dev_focus,goals,headline,interests,is_public,name,region,roles,short_bio,socials,videos,website
routing_queue.UPDATE=assigned_to,status$$,
  'Spalten-Grants: nur die vom Client beschreibbaren Felder');

-- ── 3. Default privileges ────────────────────────────────────────────────────
-- Der Kern von AGE-312: Ohne das hier erbt die naechste per Migration angelegte
-- Tabelle wieder Rechte — je nach Instanz Verschiedenes — und die Drift ist
-- zurueck, nur an anderer Stelle. Danach muss jede Tabelle ihre Rechte
-- aussprechen; eine vergessene faellt auf, statt sie still zu bekommen.
--
-- Nur `for role postgres`: Migrationen laufen als postgres. Die Defaults von
-- supabase_admin gehoeren Supabase und bleiben unangetastet — sie greifen nur
-- fuer Tabellen, die supabase_admin selbst anlegt, nicht fuer unsere.

select is(
  (select coalesce(string_agg(acl, ',' order by acl), '(keine)')
   from pg_default_acl d, unnest(d.defaclacl::text[]) as acl
   where d.defaclnamespace::regnamespace::text = 'public'
     and d.defaclobjtype = 'r'
     and pg_get_userbyid(d.defaclrole) = 'postgres'
     and (acl like 'anon=%' or acl like 'authenticated=%')),
  '(keine)',
  'Default privileges: neue Tabellen erben nichts an anon/authenticated');

-- ── 4. activation_tokens: die Abwesenheit als eigene Aussage (AGE-495) ───────
-- Die Tabelle taucht im Golden-Snapshot oben NICHT auf, weil sie keinen Grant
-- traegt. Genau das ist gewollt — aber eine Abwesenheit ist von einem
-- vergessenen Eintrag nicht zu unterscheiden. Deshalb hier ausdruecklich, mit
-- Namen: waere der Snapshot je mit einem Grant auf dieser Tabelle
-- nachgepflegt worden, faellt diese Assertion und nicht der Vergleich oben.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'activation_tokens'
      and grantee in ('anon', 'authenticated')),
  0,
  'activation_tokens traegt fuer anon/authenticated KEIN einziges Recht — '
  'gelesen und geschrieben wird sie allein mit der Service-Rolle');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'activation_tokens'),
  0,
  'activation_tokens hat bewusst KEINE Policy — deny-by-default ist hier das '
  'Feature, nicht eine Luecke, die jemand schliessen sollte');

create function public.age602_wegwerf() returns int language sql immutable as $$ select 1 $$;

-- ── 5. Funktions-EXECUTE: dieselbe Luecke, eine Ebene tiefer (AGE-602) ──────
-- Abschnitt 3 entschaerft den Default fuer TABELLEN, und dort wirkt er: eine neu
-- angelegte Tabelle traegt danach exakt die Default-ACL und anon hat kein SELECT
-- (am 26.08.2026 gegengeprueft).
--
-- Fuer FUNKTIONEN geht dieser Weg NICHT, und das ist der Grund, warum hier kein
-- Gegenstueck zu Abschnitt 3 steht. Gemessen, drei Varianten:
--
--   alter default privileges ... GRANT execute ... to anon   -> wirkt
--   alter default privileges ... REVOKE execute ... from public -> WIRKUNGSLOS
--   revoke execute on function <name> from public            -> wirkt
--
-- Postgres vergibt EXECUTE auf Funktionen implizit an PUBLIC, und dieser implizite
-- Grant laesst sich ueber die Default-ACL nicht wegnehmen: eine neu angelegte
-- Funktion behaelt `proacl = null`, und anon ist Mitglied von PUBLIC. Eine
-- Migrationszeile `alter default privileges ... revoke execute on functions`
-- waere hier ein No-op, der wie Schutz aussieht -- also genau die Sorte stille
-- Zusicherung, deretwegen AGE-602 ueberhaupt entstand. Sie steht deshalb nicht da.
--
-- Was stattdessen traegt, ist Abschnitt 6: die abgeschlossene Liste. Jede Funktion
-- muss ihr `revoke ... from public, anon` selbst aussprechen, und wer es vergisst,
-- faellt dort auf -- nicht erst in PROD.

select is(
  (select has_function_privilege('anon', p.oid, 'execute')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'age602_wegwerf'),
  true,
  'eine neu angelegte Funktion erbt EXECUTE ueber PUBLIC — deshalb muss jede '
  'Funktion es selbst entziehen, und deshalb gibt es die Liste unten');

-- ── 6. Welche Funktionen anon ausfuehren darf — als abgeschlossene Liste ─────
-- Bewusst EIN Gesamtvergleich, aus demselben Grund wie bei den Tabellen oben:
-- eine Aufzaehlung bekannter Verstoesse liesse den naechsten ungenannten durch
-- und verlangte, dass jemand ihn vorher erraet. Jede der sechs Zeilen hier ist
-- eine ausdrueckliche `grant ... to anon`-Entscheidung in ihrer Migration.
--
-- Faellt diese Assertion, ist das kein Testfehler: eine Funktion ist fuer
-- ausgeloggte Besucher erreichbar geworden. Das gehoert entschieden, nicht
-- nachgepflegt. Weil eine neue Funktion das Recht laut Abschnitt 5 GESCHENKT
-- bekommt, ist das der Normalfall und nicht die Ausnahme.

select is(
  (select coalesce(string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
                              E'\n' order by p.proname), '(keine)')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and p.proname not in ('age602_wegwerf', 'age602_mechanik')
     and has_function_privilege('anon', p.oid, 'execute')),
$$event_cover_lesbar(objektname text)
event_registration_counts(p_event_ids uuid[])
feed_tag_counts()
post_engagement_counts(p_post_ids uuid[])
post_media_lesbar(objektname text)
suchbegriff_zu_tsquery(p_query text)$$,
  'genau diese sechs Funktionen darf anon ausfuehren, keine weitere');

-- ── 7. Gegenprobe: misst Abschnitt 6 ueberhaupt etwas? ──────────────────────
-- Ohne sie waere die Liste dort blind, wo eine Rolle das Recht ohnehin nie hielt.
-- Die Wegwerf-Funktion wird angelegt, ihr Recht entzogen und wieder erteilt; beide
-- Richtungen werden gemessen. Laeuft in der Testtransaktion und wird zurueckgerollt.

revoke execute on function public.age602_wegwerf() from public;
select is(
  has_function_privilege('anon', 'public.age602_wegwerf()', 'execute'),
  false,
  'Gegenprobe A: ein ausgesprochener Entzug wird gemessen');

grant execute on function public.age602_wegwerf() to anon;
select is(
  has_function_privilege('anon', 'public.age602_wegwerf()', 'execute'),
  true,
  'Gegenprobe B: ein erteiltes Recht wird gemessen — die Zusage ist nicht blind');

-- ── 8. Die Rechte der von AGE-602 angefassten Funktionen, vollstaendig ──────
-- Die Liste in Abschnitt 6 deckt nur `anon`. Ein rollen-eigener
-- `authenticated`-Grant kann daneben stehenbleiben, ohne dass irgendetwas faellt
-- — und genau das war in PROD bei `array_jaccard` der Fall, waehrend `proacl`
-- lokal null war. Ein `revoke ... from public, anon` haette lokal alles genommen
-- und in PROD `authenticated=X` gelassen: dieselbe Divergenz, eine Rolle weiter.
-- Deshalb steht hier fuer JEDE angefasste Funktion beides.

select is(
  (select coalesce(string_agg(
            p.proname || ': anon=' || has_function_privilege('anon', p.oid, 'execute')::text
                      || ' auth=' || has_function_privilege('authenticated', p.oid, 'execute')::text,
            E'\n' order by p.proname), '(keine)')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and p.proname in ('search_directory','register_for_event','set_event_check_in',
                       'array_jaccard','fbc_profile_search_doc',
                       'post_engagement_counts','event_registration_counts')),
$$array_jaccard: anon=false auth=false
event_registration_counts: anon=true auth=true
fbc_profile_search_doc: anon=false auth=true
post_engagement_counts: anon=true auth=true
register_for_event: anon=false auth=true
search_directory: anon=false auth=true
set_event_check_in: anon=false auth=true$$,
  'die sieben von AGE-602 angefassten Funktionen tragen genau die Rechte, die '
  'ihre Migration ausspricht — fuer beide Client-Rollen');

-- EHRLICH ZUR REICHWEITE DIESER ZUSAGE. Sie haelt den Ziel-Zustand fest, aber
-- sie kann die falsche FORMULIERUNG lokal nicht bemerken. Gemessen (Mutation M9):
-- nimmt man `authenticated` aus dem revoke auf `array_jaccard` heraus, bleibt sie
-- gruen — denn hier haelt `authenticated` das Recht ohnehin nur ueber PUBLIC, und
-- das nimmt schon `from public` mit. In PROD steht dort ein rollen-eigenes
-- `authenticated=X`, das stehenbliebe. Dieselbe Blindheit wie bei Mutation M1.
--
-- Was diese Luecke schliesst, ist NICHT ein weiterer lokaler Test, sondern die
-- Messung am PROD-Katalog nach `migrate-prod` (tasks.md, Abschnitt 5). Bis die
-- vorliegt, gilt der PROD-Rechte-Zustand laut `directory-search` ausdruecklich
-- als UNBELEGT. Die REGEL dahinter — warum die Formulierung beide Rollen nennen
-- muss — haelt Abschnitt 9, und die ist instanzunabhaengig.

-- ── 9. WARUM `from public` ALLEIN NICHT GENUEGT — der Mechanismus (AGE-602) ──
-- Diese Zusage ist als Antwort auf eine Mutationsprobe entstanden. Baut man den
-- Originalfehler zurueck (`revoke ... from public` statt `from public, anon`),
-- bleibt die ganze Suite lokal GRUEN: hier haelt `anon` das Recht nur ueber die
-- Pseudo-Rolle PUBLIC, und ein Entzug von PUBLIC nimmt es ihm mit. In PROD hielt
-- `anon` einen ROLLEN-EIGENEN Grant aus der Default-ACL der Instanz — und den
-- laesst `from public` unberuehrt. Genau diese Differenz ist AGE-602.
--
-- Ein Zustands-Test kann das lokal nicht sehen; er misst eine Instanz, auf der
-- der Unterschied nicht existiert. Deshalb misst diese Zusage nicht den Zustand,
-- sondern die REGEL — an einer Wegwerf-Funktion, der beide Grant-Arten
-- nacheinander gegeben werden. Sie ist damit auf jeder Instanz aussagekraeftig
-- und faellt, sobald jemand die Formulierung fuer austauschbar haelt.

create function public.age602_mechanik() returns int language sql immutable as $$ select 1 $$;
grant execute on function public.age602_mechanik() to anon;   -- rollen-eigen, wie in PROD

revoke execute on function public.age602_mechanik() from public;
select is(
  has_function_privilege('anon', 'public.age602_mechanik()', 'execute'),
  true,
  'revoke ... FROM PUBLIC laesst einen rollen-eigenen anon-Grant STEHEN — '
  'das ist der Fehler, den AGE-602 in PROD vorgefunden hat');

revoke execute on function public.age602_mechanik() from anon;
select is(
  has_function_privilege('anon', 'public.age602_mechanik()', 'execute'),
  false,
  'erst der namentliche Entzug nimmt ihn — deshalb lautet die Formulierung '
  'ueberall `from public, anon` und nicht nur `from public`');

-- Dieselbe Regel gilt fuer `authenticated`, und sie hat in diesem Change schon
-- einmal zugeschlagen: `array_jaccard` traegt in PROD ein rollen-eigenes
-- `authenticated=X`, lokal war `proacl` null. Wer nur `from public, anon`
-- schreibt, laesst es in PROD stehen — und die Instanzen laufen an genau dieser
-- Funktion auseinander, was der Ausgangsbefund von AGE-602 war.
grant execute on function public.age602_mechanik() to authenticated;
revoke execute on function public.age602_mechanik() from public, anon;
select is(
  has_function_privilege('authenticated', 'public.age602_mechanik()', 'execute'),
  true,
  '`from public, anon` laesst einen rollen-eigenen authenticated-Grant STEHEN');

revoke execute on function public.age602_mechanik() from authenticated;
select is(
  has_function_privilege('authenticated', 'public.age602_mechanik()', 'execute'),
  false,
  'jede Rolle, der das Recht nicht zusteht, gehoert NAMENTLICH in den revoke');

select * from finish();
rollback;
