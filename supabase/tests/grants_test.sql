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
select plan(3);

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
$$badges/anon=SELECT
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
post_likes/authenticated=DELETE,INSERT,SELECT,UPDATE
posts/anon=SELECT
posts/authenticated=DELETE,INSERT,SELECT,UPDATE
profile_badges/authenticated=SELECT
profile_contacts/authenticated=INSERT,SELECT,UPDATE
profile_interests/authenticated=DELETE,INSERT,SELECT,UPDATE
profile_theme_scores/authenticated=DELETE,INSERT,SELECT,UPDATE
profiles/authenticated=SELECT
profiles_public/authenticated=SELECT
routing_queue/authenticated=SELECT
staff_roles/authenticated=SELECT$$,
  'Tabellen-Grants: exakt das, was die Policies decken — und sonst nichts');

-- ── 2. Spalten-Grants ────────────────────────────────────────────────────────
-- Nur die drei Tabellen, bei denen das Grant ENGER ist als seine Policy. Die
-- Policy erlaubt UPDATE auf der Zeile, schreibbar ist aber nur diese Liste;
-- abgeleitete Felder (tier, potential_score, profile_completion, ...) gehoeren
-- Triggern und RPCs. Faellt eine Spalte hier still dazu, waere das eine
-- Rechteausweitung, die rls_test.sql nicht sieht.

select is(
  (select coalesce(string_agg(table_name || '.UPDATE=' || cols, E'\n' order by table_name), '(leer)')
   from (select table_name, string_agg(distinct column_name, ',' order by column_name) as cols
         from information_schema.role_column_grants
         where table_schema = 'public' and grantee = 'authenticated'
           and privilege_type = 'UPDATE'
           and table_name in ('profiles', 'contact_requests', 'routing_queue')
         group by 1) t),
$$contact_requests.UPDATE=status
profiles.UPDATE=avatar_url,branche,company,competencies,dev_focus,goals,headline,interests,is_public,name,region,roles,short_bio,socials,videos,website
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

select * from finish();
rollback;
