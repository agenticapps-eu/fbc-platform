-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  DEMO SEED — NOT REAL DATA.  Full demo persona set for AGE-254.            ║
-- ║                                                                            ║
-- ║  Builds a believable Fair-Business-Club directory + matching network for   ║
-- ║  the AGE-255 demo run. All personas are FICTIONAL; emails end in           ║
-- ║  *.demo.fbc.invalid (non-routable). Idempotent: safe to run repeatedly.    ║
-- ║                                                                            ║
-- ║  Presenter login accounts (unchanged emails, enriched into real personas): ║
-- ║    discover@fbcdemo.com → "Jonas Keller"    (Discover)                     ║
-- ║    prime@fbcdemo.com    → "Carla Reinhardt" (Prime · Matching-Manager)     ║
-- ║    legacy@fbcdemo.com   → "Eleonora Voss"   (Legacy · Kapitalgeberin)      ║
-- ║    maximilian.bauer@demo.fbc.invalid → "Maximilian Bauer" (Legacy)         ║
-- ║      (Maximilian is seeded by demo_legacy_profile.sql and left untouched.) ║
-- ║                                                                            ║
-- ║  Apply:  psql "$DB_URL" -f supabase/seed/demo_personas.sql                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

begin;

-- ── 1. New demo auth users (23). The handle_new_user trigger creates each base
--    profiles row (tier 'basic'); section 3 enriches it. Idempotent.
--    …25415–…25423 (AGE-357) füllen exchange/discover/basic — vorher hatte das
--    Verzeichnis nur connect und impact besetzt. Alle tragen dasselbe Dummy-
--    Passwort wie die übrigen: Verzeichnis-Inhalt, KEINE Logins. ────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', v.id, 'authenticated', 'authenticated',
  v.email, extensions.crypt('demo-not-a-real-password', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('name', v.name),
  '', '', '', ''
from (values
  ('00000000-0000-0000-0000-000000025401'::uuid, 'friederike.lang@demo.fbc.invalid',     'Dr. Friederike Lang'),
  ('00000000-0000-0000-0000-000000025402'::uuid, 'hans-peter.stadler@demo.fbc.invalid',  'Hans-Peter Stadler'),
  ('00000000-0000-0000-0000-000000025403'::uuid, 'beatrice.sommer@demo.fbc.invalid',     'Beatrice Sommer'),
  ('00000000-0000-0000-0000-000000025404'::uuid, 'yvonne.albrecht@demo.fbc.invalid',     'Yvonne Albrecht'),
  ('00000000-0000-0000-0000-000000025405'::uuid, 'philip.brandt@demo.fbc.invalid',       'Philip Brandt'),
  ('00000000-0000-0000-0000-000000025406'::uuid, 'tobias.wenger@demo.fbc.invalid',       'Tobias Wenger'),
  ('00000000-0000-0000-0000-000000025407'::uuid, 'gregor.pilz@demo.fbc.invalid',         'Gregor Pilz'),
  ('00000000-0000-0000-0000-000000025408'::uuid, 'lena.hofmann@demo.fbc.invalid',        'Lena Hofmann'),
  ('00000000-0000-0000-0000-000000025409'::uuid, 'sandra.bauer-klein@demo.fbc.invalid',  'Sandra Bauer-Klein'),
  ('00000000-0000-0000-0000-000000025410'::uuid, 'markus.frey@demo.fbc.invalid',         'Markus Frey'),
  ('00000000-0000-0000-0000-000000025411'::uuid, 'marek.novak@demo.fbc.invalid',         'Marek Novak'),
  ('00000000-0000-0000-0000-000000025412'::uuid, 'aylin.demir@demo.fbc.invalid',         'Aylin Demir'),
  ('00000000-0000-0000-0000-000000025413'::uuid, 'robert.vogt@demo.fbc.invalid',         'Robert Vogt'),
  ('00000000-0000-0000-0000-000000025414'::uuid, 'mira.saenger@demo.fbc.invalid',        'Mira Sänger'),
  -- AGE-357: exchange (rank 4)
  ('00000000-0000-0000-0000-000000025415'::uuid, 'anna.mueller@demo.fbc.invalid',        'Anna Müller'),
  ('00000000-0000-0000-0000-000000025416'::uuid, 'christoph.seidel@demo.fbc.invalid',    'Christoph Seidel'),
  ('00000000-0000-0000-0000-000000025417'::uuid, 'ruth-maria.wagner@demo.fbc.invalid',   'Ruth-Maria Wagner'),
  -- AGE-357: discover (rank 3)
  ('00000000-0000-0000-0000-000000025418'::uuid, 'katharina.bruns@demo.fbc.invalid',     'Katharina Bruns'),
  ('00000000-0000-0000-0000-000000025419'::uuid, 'julian.maier@demo.fbc.invalid',        'Julian Maier'),
  ('00000000-0000-0000-0000-000000025420'::uuid, 'fatima.cheddadi@demo.fbc.invalid',     'Fatima Cheddadi'),
  -- AGE-357: basic (rank 1)
  ('00000000-0000-0000-0000-000000025421'::uuid, 'timo.reuter@demo.fbc.invalid',         'Timo Reuter'),
  ('00000000-0000-0000-0000-000000025422'::uuid, 'sofia.kranz@demo.fbc.invalid',         'Sofia Kranz'),
  ('00000000-0000-0000-0000-000000025423'::uuid, 'david.oeztuerk@demo.fbc.invalid',      'David Öztürk')
) as v(id, email, name)
on conflict (id) do nothing;

-- ── 2. Enrich profiles (3 existing generic accounts → named personas + 14 new).
--    Maximilian (…238) is intentionally NOT touched here. ───────────────────────
update public.profiles p set
  name = v.name, tier = v.tier, headline = v.headline, roles = v.roles,
  region = v.region, company = v.company, branche = v.branche, short_bio = v.short_bio,
  competencies = v.competencies, interests = v.interests, member_number = v.member_number,
  member_since = v.member_since, dev_focus = v.dev_focus, dev_progress = v.dev_progress,
  profile_completion = v.profile_completion, is_public = true,
  avatar_url = 'https://i.pravatar.cc/300?u=' || v.id::text
from (values
  -- existing accounts, renamed/enriched (ids + emails preserved)
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7'::uuid,'Eleonora Voss','impact','Beteiligungskapital · Family Office · Deal Keeperin','{Investorin,"Deal Keeperin",Mentorin}'::text[],'Stuttgart','Voss Capital Partners','Beteiligungen & Immobilien','DEMO-Profil — fiktive Daten. Beteiligungsgesellschaft mit Fokus auf Wachstums- und Nachfolgesituationen im DACH-Raum.','{"M&A","Beteiligungskapital","Immobilienentwicklung","Private Equity"}'::text[],'{"Impact Investing","Family Office","Unternehmensnachfolge"}'::text[],'FBC-10001','2017-05-01'::date,'wirken',80,100),
  ('d73efa12-5f11-4220-94b4-dd5880b10782'::uuid,'Carla Reinhardt','focus','Strategieberaterin · Connectorin','{Beraterin,Connectorin}'::text[],'Stuttgart','Reinhardt & Partner','Beratung','DEMO-Profil — fiktive Daten. Strategie- und Organisationsberatung; vernetzt Mandant:innen im Club.','{"Strategie","Organisationsentwicklung","Netzwerk"}'::text[],'{"Leadership","New Work","Netzwerk"}'::text[],'FBC-10210','2021-02-01'::date,'tun',65,90),
  ('2752a480-a737-4f90-af0c-a76722c781a7'::uuid,'Jonas Keller','connect','Gründer · B2B-SaaS','{"Gründer"}'::text[],'Stuttgart','Keller Ventures','Technologie','DEMO-Profil — fiktive Daten. Frühphasen-Gründer auf der Suche nach Kapital und Mentoring.','{"Product Management","SaaS","Vertrieb"}'::text[],'{"Startups","Fintech","KI"}'::text[],'FBC-10455','2024-09-01'::date,'tun',40,60),
  -- new legacy
  ('00000000-0000-0000-0000-000000025401'::uuid,'Dr. Friederike Lang','impact','Private Equity · Wachstumskapital','{Investorin,Aufsichtsrätin}'::text[],'München','Lang Equity GmbH','Beteiligungen','DEMO-Profil — fiktive Daten. Wachstums- und Nachfolgefinanzierung für den Mittelstand.','{"Private Equity","M&A","Finanzierung","Restrukturierung"}'::text[],'{"Growth Capital","Unternehmensnachfolge","Impact Investing"}'::text[],'FBC-10008','2018-01-15'::date,'wirken',75,100),
  ('00000000-0000-0000-0000-000000025402'::uuid,'Hans-Peter Stadler','impact','Immobilienentwickler · Bestandshalter','{Unternehmer,Investor}'::text[],'Stuttgart','Stadler Immobilien AG','Immobilien','DEMO-Profil — fiktive Daten. Projektentwicklung und Bestandshaltung von Wohn- und Gewerbeimmobilien.','{"Projektentwicklung","Asset-Management","Finanzierung"}'::text[],'{"Immobilien","Stadtentwicklung","Nachhaltigkeit"}'::text[],'FBC-10015','2016-09-01'::date,'haben',80,100),
  ('00000000-0000-0000-0000-000000025403'::uuid,'Beatrice Sommer','impact','Executive Coach · Mentorin','{Coach,Mentorin,Speakerin}'::text[],'Hamburg','Sommer Coaching','Beratung','DEMO-Profil — fiktive Daten. Begleitet Unternehmer:innen in Wachstums- und Übergangsphasen.','{"Executive Coaching","Leadership","Change Management"}'::text[],'{"Persönlichkeitsentwicklung","Leadership","Achtsamkeit"}'::text[],'FBC-10022','2019-06-01'::date,'sein',88,100),
  ('00000000-0000-0000-0000-000000025404'::uuid,'Yvonne Albrecht','impact','Family Office · Impact-Investorin','{Investorin,Stifterin}'::text[],'München','Albrecht Family Office','Family Office','DEMO-Profil — fiktive Daten. Langfristiges Familienkapital mit Impact-Fokus.','{"Wealth Management","Impact Investing","Beteiligungen"}'::text[],'{"Impact Investing","Stiftungen","Nachhaltigkeit"}'::text[],'FBC-10030','2017-11-01'::date,'wirken',90,100),
  ('00000000-0000-0000-0000-000000025405'::uuid,'Philip Brandt','impact','Corporate Finance · Beteiligungen','{Investor,Banker}'::text[],'Frankfurt','Brandt Capital','Finanzen','DEMO-Profil — fiktive Daten. Strukturierung von Finanzierungen und Beteiligungen für den gehobenen Mittelstand.','{"Corporate Finance","Beteiligungen","M&A"}'::text[],'{"Finanzierung","Mittelstand","Wachstum"}'::text[],'FBC-10037','2018-03-01'::date,'haben',78,100),
  -- new prime
  ('00000000-0000-0000-0000-000000025406'::uuid,'Tobias Wenger','focus','Gründer · Robotik','{"Gründer","CTO"}'::text[],'Stuttgart','Wenger Robotics GmbH','Technologie','DEMO-Profil — fiktive Daten. Skaliert eine Robotik-Plattform für die Industrie und sucht Wachstumskapital.','{"Robotik","KI","Product"}'::text[],'{"Robotik","Industrie 4.0","KI"}'::text[],'FBC-10211','2022-04-01'::date,'tun',70,95),
  ('00000000-0000-0000-0000-000000025407'::uuid,'Gregor Pilz','focus','Projektentwickler Immobilien','{"Unternehmer"}'::text[],'Stuttgart','Pilz Development','Immobilien','DEMO-Profil — fiktive Daten. Quartiers- und Projektentwicklung mit Co-Investoren.','{"Projektentwicklung","Quartiersentwicklung","Finanzierung"}'::text[],'{"Immobilien","Nachhaltiges Bauen"}'::text[],'FBC-10218','2021-07-01'::date,'haben',68,92),
  ('00000000-0000-0000-0000-000000025408'::uuid,'Lena Hofmann','focus','Talent & Netzwerk','{Beraterin,Recruiterin}'::text[],'Stuttgart','Hofmann Talent','Beratung','DEMO-Profil — fiktive Daten. Executive Search und Netzwerkaufbau für wachsende Unternehmen.','{"Executive Search","Employer Branding","Netzwerk"}'::text[],'{"New Work","Talent","Netzwerk"}'::text[],'FBC-10225','2022-01-15'::date,'tun',64,88),
  ('00000000-0000-0000-0000-000000025409'::uuid,'Sandra Bauer-Klein','focus','Immobilien-Investorin','{Investorin,Unternehmerin}'::text[],'München','BK Real Estate','Immobilien','DEMO-Profil — fiktive Daten. Value-Add-Immobilien im süddeutschen Raum.','{"Real Estate","Asset Management","Finanzierung"}'::text[],'{"Immobilien","Wohnen","Value Add"}'::text[],'FBC-10232','2021-09-01'::date,'haben',72,94),
  ('00000000-0000-0000-0000-000000025410'::uuid,'Markus Frey','focus','HealthTech-Gründer','{"Gründer","CEO"}'::text[],'München','Frey Health GmbH','Gesundheit','DEMO-Profil — fiktive Daten. Digital-Health-Plattform in der Wachstumsphase, sucht Series-A-Kapital.','{"HealthTech","Regulatory","Product"}'::text[],'{"Digital Health","KI","Prävention"}'::text[],'FBC-10239','2023-02-01'::date,'tun',66,90),
  ('00000000-0000-0000-0000-000000025411'::uuid,'Marek Novak','focus','Unternehmensberater','{"Berater"}'::text[],'Berlin','Novak Consulting','Beratung','DEMO-Profil — fiktive Daten. Begleitet B2B-Unternehmen bei Skalierung und digitaler Transformation.','{"Strategie","Digitale Transformation","Vertrieb"}'::text[],'{"Beratung","Skalierung","B2B"}'::text[],'FBC-10246','2022-06-01'::date,'tun',62,86),
  -- new discover
  ('00000000-0000-0000-0000-000000025412'::uuid,'Aylin Demir','connect','Gründerin · DeepTech','{"Gründerin"}'::text[],'Stuttgart','Demir Labs','Technologie','DEMO-Profil — fiktive Daten. DeepTech-Ausgründung, sucht erste Finanzierung und Mentoring.','{"Machine Learning","Forschung"}'::text[],'{"DeepTech","KI","Forschung"}'::text[],'FBC-10461','2024-11-01'::date,'tun',38,55),
  ('00000000-0000-0000-0000-000000025413'::uuid,'Robert Vogt','connect','Dienstleister · Mittelstand','{"Unternehmer"}'::text[],'Köln','Vogt Services','Dienstleistung','DEMO-Profil — fiktive Daten. Wachsendes Dienstleistungsunternehmen, sucht Partner und Kunden.','{"Service","Logistik","Operations"}'::text[],'{"Mittelstand","Digitalisierung"}'::text[],'FBC-10468','2025-01-01'::date,'tun',42,50),
  ('00000000-0000-0000-0000-000000025414'::uuid,'Mira Sänger','connect','Kreativunternehmerin','{"Gründerin","Designerin"}'::text[],'Berlin','Saenger Studio','Kreativwirtschaft','DEMO-Profil — fiktive Daten. Design- und Markenstudio, sucht Mentoring und Fachexpertise.','{"Design","Branding","Content"}'::text[],'{"Design","Creator Economy","Marke"}'::text[],'FBC-10475','2024-12-01'::date,'sein',44,58),
  -- new exchange (rank 4) — AGE-357. Mitgliedsnummern 103xx: invers zum Rang,
  -- zwischen focus (102xx) und discover (1038x).
  ('00000000-0000-0000-0000-000000025415'::uuid,'Anna Müller','exchange','Geschäftsführerin · Familienunternehmen','{Unternehmerin,"Geschäftsführerin"}'::text[],'Stuttgart','Müller Präzisionsteile GmbH','Industrie','DEMO-Profil — fiktive Daten. Führt ein Familienunternehmen in dritter Generation und bereitet die Nachfolge vor.','{"Produktion","Nachfolge","Vertrieb"}'::text[],'{"Unternehmensnachfolge","Mittelstand","Automatisierung"}'::text[],'FBC-10310','2023-03-01'::date,'tun',58,78),
  ('00000000-0000-0000-0000-000000025416'::uuid,'Christoph Seidel','exchange','Steuerberater · Mittelstand','{Berater,"Steuerberater"}'::text[],'München','Seidel & Kollegen','Beratung','DEMO-Profil — fiktive Daten. Steuerliche Gestaltung für inhabergeführte Unternehmen und Nachfolgen.','{"Steuerrecht","Nachfolgeplanung","Bilanzierung"}'::text[],'{"Unternehmensnachfolge","Mittelstand","Vermögensstruktur"}'::text[],'FBC-10317','2023-06-15'::date,'tun',60,80),
  ('00000000-0000-0000-0000-000000025417'::uuid,'Ruth-Maria Wagner','exchange','Handelsunternehmerin','{Unternehmerin}'::text[],'Köln','Wagner Handel KG','Handel','DEMO-Profil — fiktive Daten. Großhandel im Umbau auf E-Commerce, sucht Partner und Expertise.','{"Einkauf","Logistik","E-Commerce"}'::text[],'{"Digitalisierung","Handel","Nachhaltigkeit"}'::text[],'FBC-10324','2023-09-01'::date,'haben',56,76),
  -- new discover (rank 3) — AGE-357. Die ALTE Stufe `discover` wurde von AGE-311
  -- auf `connect` gemappt; die neue gleichnamige Stufe hatte bis hier niemanden.
  ('00000000-0000-0000-0000-000000025418'::uuid,'Katharina Bruns','discover','Gründerin · Nachhaltige Verpackung','{"Gründerin"}'::text[],'Hamburg','Bruns Packaging','Industrie','DEMO-Profil — fiktive Daten. Entwickelt kompostierbare Verpackungen und sucht erste Kunden im Mittelstand.','{"Materialentwicklung","Produktion"}'::text[],'{"Nachhaltigkeit","Kreislaufwirtschaft","Industrie"}'::text[],'FBC-10380','2024-03-01'::date,'tun',50,66),
  ('00000000-0000-0000-0000-000000025419'::uuid,'Julian Maier','discover','Selbstständiger IT-Berater','{Berater}'::text[],'Stuttgart','Maier IT','Technologie','DEMO-Profil — fiktive Daten. IT-Beratung für Mittelständler, will vom Einzelkämpfer zum Team wachsen.','{"IT-Infrastruktur","Cloud","Security"}'::text[],'{"Digitalisierung","Mittelstand","Cloud"}'::text[],'FBC-10387','2024-05-15'::date,'tun',48,64),
  ('00000000-0000-0000-0000-000000025420'::uuid,'Fatima Cheddadi','discover','Architektin · Bestandssanierung','{Architektin,"Unternehmerin"}'::text[],'Frankfurt','Cheddadi Architektur','Immobilien','DEMO-Profil — fiktive Daten. Sanierung von Bestandsgebäuden, sucht Projektpartner und Bauherren.','{"Architektur","Sanierung","Bauleitung"}'::text[],'{"Nachhaltiges Bauen","Immobilien","Denkmalschutz"}'::text[],'FBC-10394','2024-08-01'::date,'tun',52,68),
  -- new basic (rank 1) — AGE-357. Neu dabei, Profil noch dünn: niedrigster
  -- dev_progress/profile_completion im ganzen Seed, jüngstes member_since.
  ('00000000-0000-0000-0000-000000025421'::uuid,'Timo Reuter','basic','Gründer · Handwerk-Plattform','{"Gründer"}'::text[],'Stuttgart','Reuter Digital','Technologie','DEMO-Profil — fiktive Daten. Frisch im Club, baut eine Vermittlungsplattform für Handwerksbetriebe.','{"Product","Marktplatz"}'::text[],'{"Startups","Handwerk","Plattformen"}'::text[],'FBC-10520','2026-04-01'::date,'tun',26,34),
  ('00000000-0000-0000-0000-000000025422'::uuid,'Sofia Kranz','basic','Freiberufliche Texterin','{Freiberuflerin}'::text[],'Berlin','—','Kreativwirtschaft','DEMO-Profil — fiktive Daten. Neu im Club, orientiert sich noch und sucht erste Kontakte.','{"Text","Content"}'::text[],'{"Kommunikation","Marke"}'::text[],'FBC-10527','2026-05-15'::date,'sein',22,30),
  ('00000000-0000-0000-0000-000000025423'::uuid,'David Öztürk','basic','Handwerksunternehmer · Elektrotechnik','{Unternehmer}'::text[],'Köln','Öztürk Elektro GmbH','Handwerk','DEMO-Profil — fiktive Daten. Elektrobetrieb mit 12 Mitarbeitenden, gerade beigetreten.','{"Elektrotechnik","Projektabwicklung"}'::text[],'{"Handwerk","Fachkräfte","Energie"}'::text[],'FBC-10534','2026-06-01'::date,'haben',30,40)
) as v(id,name,tier,headline,roles,region,company,branche,short_bio,competencies,interests,member_number,member_since,dev_focus,dev_progress,profile_completion)
where p.id = v.id;

-- ── 3. Contact details (gated by RLS; only released after an accepted request). ─
insert into public.profile_contacts (profile_id, email, phone)
select id, email, phone from (values
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7'::uuid,'eleonora.voss@demo.fbc.invalid','+49 711 1000001'),
  ('d73efa12-5f11-4220-94b4-dd5880b10782'::uuid,'carla.reinhardt@demo.fbc.invalid','+49 711 1000210'),
  ('2752a480-a737-4f90-af0c-a76722c781a7'::uuid,'jonas.keller@demo.fbc.invalid','+49 711 1000455'),
  ('00000000-0000-0000-0000-000000025401'::uuid,'friederike.lang@demo.fbc.invalid','+49 89 1000008'),
  ('00000000-0000-0000-0000-000000025402'::uuid,'hans-peter.stadler@demo.fbc.invalid','+49 711 1000015'),
  ('00000000-0000-0000-0000-000000025403'::uuid,'beatrice.sommer@demo.fbc.invalid','+49 40 1000022'),
  ('00000000-0000-0000-0000-000000025404'::uuid,'yvonne.albrecht@demo.fbc.invalid','+49 89 1000030'),
  ('00000000-0000-0000-0000-000000025405'::uuid,'philip.brandt@demo.fbc.invalid','+49 69 1000037'),
  ('00000000-0000-0000-0000-000000025406'::uuid,'tobias.wenger@demo.fbc.invalid','+49 711 1000211'),
  ('00000000-0000-0000-0000-000000025407'::uuid,'gregor.pilz@demo.fbc.invalid','+49 711 1000218'),
  ('00000000-0000-0000-0000-000000025408'::uuid,'lena.hofmann@demo.fbc.invalid','+49 711 1000225'),
  ('00000000-0000-0000-0000-000000025409'::uuid,'sandra.bauer-klein@demo.fbc.invalid','+49 89 1000232'),
  ('00000000-0000-0000-0000-000000025410'::uuid,'markus.frey@demo.fbc.invalid','+49 89 1000239'),
  ('00000000-0000-0000-0000-000000025411'::uuid,'marek.novak@demo.fbc.invalid','+49 30 1000246'),
  ('00000000-0000-0000-0000-000000025412'::uuid,'aylin.demir@demo.fbc.invalid','+49 711 1000461'),
  ('00000000-0000-0000-0000-000000025413'::uuid,'robert.vogt@demo.fbc.invalid','+49 221 1000468'),
  ('00000000-0000-0000-0000-000000025414'::uuid,'mira.saenger@demo.fbc.invalid','+49 30 1000475'),
  ('00000000-0000-0000-0000-000000025415'::uuid,'anna.mueller@demo.fbc.invalid','+49 711 1000310'),
  ('00000000-0000-0000-0000-000000025416'::uuid,'christoph.seidel@demo.fbc.invalid','+49 89 1000317'),
  ('00000000-0000-0000-0000-000000025417'::uuid,'ruth-maria.wagner@demo.fbc.invalid','+49 221 1000324'),
  ('00000000-0000-0000-0000-000000025418'::uuid,'katharina.bruns@demo.fbc.invalid','+49 40 1000380'),
  ('00000000-0000-0000-0000-000000025419'::uuid,'julian.maier@demo.fbc.invalid','+49 711 1000387'),
  ('00000000-0000-0000-0000-000000025420'::uuid,'fatima.cheddadi@demo.fbc.invalid','+49 69 1000394'),
  ('00000000-0000-0000-0000-000000025421'::uuid,'timo.reuter@demo.fbc.invalid','+49 711 1000520'),
  ('00000000-0000-0000-0000-000000025422'::uuid,'sofia.kranz@demo.fbc.invalid','+49 30 1000527'),
  ('00000000-0000-0000-0000-000000025423'::uuid,'david.oeztuerk@demo.fbc.invalid','+49 221 1000534')
) as v(id, email, phone)
on conflict (profile_id) do update set email = excluded.email, phone = excluded.phone;

-- ── 4. Such-/Bieteprofile (offers + needs). Categories use the canonical keys
--    from src/config/matching.ts so the engine's complementarity map applies.
--    Re-seeded cleanly (uuid PK can't dedupe on content). Excludes Maximilian. ──
delete from public.offers where profile_id in (
  '5e195a30-99af-4fbb-ae5f-1f4eff3209c7','d73efa12-5f11-4220-94b4-dd5880b10782','2752a480-a737-4f90-af0c-a76722c781a7',
  '00000000-0000-0000-0000-000000025401','00000000-0000-0000-0000-000000025402','00000000-0000-0000-0000-000000025403',
  '00000000-0000-0000-0000-000000025404','00000000-0000-0000-0000-000000025405','00000000-0000-0000-0000-000000025406',
  '00000000-0000-0000-0000-000000025407','00000000-0000-0000-0000-000000025408','00000000-0000-0000-0000-000000025409',
  '00000000-0000-0000-0000-000000025410','00000000-0000-0000-0000-000000025411','00000000-0000-0000-0000-000000025412',
  '00000000-0000-0000-0000-000000025413','00000000-0000-0000-0000-000000025414',
  '00000000-0000-0000-0000-000000025415','00000000-0000-0000-0000-000000025416','00000000-0000-0000-0000-000000025417',
  '00000000-0000-0000-0000-000000025418','00000000-0000-0000-0000-000000025419','00000000-0000-0000-0000-000000025420',
  '00000000-0000-0000-0000-000000025421','00000000-0000-0000-0000-000000025422','00000000-0000-0000-0000-000000025423');
insert into public.offers (profile_id, category, theme, title, description) values
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','kapital','haben','Wachstums- & Beteiligungskapital','Eigenkapital ab 10 Mio. € für etablierte Mittelständler.'),
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','beteiligungen','haben','Minderheits- & Mehrheitsbeteiligungen','Flexible Beteiligungsstrukturen für Wachstum und Nachfolge.'),
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','kontakte','tun','Netzwerk Family Offices','Zugang zu Co-Investoren und Family Offices.'),
  ('d73efa12-5f11-4220-94b4-dd5880b10782','kontakte','tun','Entscheider-Netzwerk','Warme Einführungen in mein Beratungsnetzwerk.'),
  ('d73efa12-5f11-4220-94b4-dd5880b10782','leistungen','tun','Strategie- & Orga-Beratung','Begleitung bei Strategie, Struktur und Wachstum.'),
  ('2752a480-a737-4f90-af0c-a76722c781a7','know_how','tun','SaaS-Vertrieb & GTM','Go-to-Market- und Vertriebs-Know-how für B2B-SaaS.'),
  ('00000000-0000-0000-0000-000000025401','kapital','haben','Wachstumskapital','Private Equity für Mittelstand und Nachfolge.'),
  ('00000000-0000-0000-0000-000000025401','beteiligungen','haben','PE-Beteiligungen','Strukturierte Beteiligungen mit Wertsteigerungsplan.'),
  ('00000000-0000-0000-0000-000000025402','immobilien','haben','Bestands- & Projektimmobilien','Wohn- und Gewerbeobjekte im Großraum Stuttgart.'),
  ('00000000-0000-0000-0000-000000025402','kapital','haben','Co-Investment Immobilien','Eigenkapital für gemeinsame Immobilienprojekte.'),
  ('00000000-0000-0000-0000-000000025403','mentoring','sein','Executive Mentoring','Persönliche Begleitung für Unternehmer:innen.'),
  ('00000000-0000-0000-0000-000000025403','know_how','tun','Leadership-Programme','Führungskräfte- und Teamentwicklung.'),
  ('00000000-0000-0000-0000-000000025403','leistungen','tun','Workshops & Retreats','Formate für Klarheit und Wachstum.'),
  ('00000000-0000-0000-0000-000000025404','kapital','haben','Family-Office-Kapital','Geduldiges Eigenkapital mit Impact-Fokus.'),
  ('00000000-0000-0000-0000-000000025404','beteiligungen','haben','Langfrist-Beteiligungen','Beteiligungen mit Generationen-Horizont.'),
  ('00000000-0000-0000-0000-000000025404','mentoring','sein','Impact-Mentoring','Begleitung wirkungsorientierter Gründer:innen.'),
  ('00000000-0000-0000-0000-000000025405','kapital','haben','Finanzierungslösungen','Eigen- und Mezzanine-Kapital für den Mittelstand.'),
  ('00000000-0000-0000-0000-000000025405','beteiligungen','haben','Beteiligungsstrukturen','Maßgeschneiderte Beteiligungen.'),
  ('00000000-0000-0000-0000-000000025406','know_how','tun','Robotik & KI','Technologie-Know-how für Automatisierung.'),
  ('00000000-0000-0000-0000-000000025407','immobilien','haben','Projektentwicklung','Quartiers- und Gewerbeentwicklung.'),
  ('00000000-0000-0000-0000-000000025407','beteiligungen','haben','Projekt-Beteiligungen','Co-Investment in Entwicklungsprojekte.'),
  ('00000000-0000-0000-0000-000000025408','kontakte','tun','Talent-Netzwerk','Zugang zu Fach- und Führungskräften.'),
  ('00000000-0000-0000-0000-000000025408','leistungen','tun','Executive Search','Besetzung von Schlüsselpositionen.'),
  ('00000000-0000-0000-0000-000000025409','immobilien','haben','Value-Add-Objekte','Immobilien mit Wertsteigerungspotenzial.'),
  ('00000000-0000-0000-0000-000000025410','know_how','tun','HealthTech-Expertise','Produkt- und Regulatorik-Know-how Digital Health.'),
  ('00000000-0000-0000-0000-000000025411','leistungen','tun','Transformationsberatung','Begleitung bei Skalierung & Digitalisierung.'),
  ('00000000-0000-0000-0000-000000025411','know_how','tun','Vertriebsaufbau B2B','Aufbau skalierbarer Vertriebsorganisationen.'),
  ('00000000-0000-0000-0000-000000025412','know_how','tun','Machine-Learning-Expertise','Angewandte ML-Forschung und Prototyping.'),
  ('00000000-0000-0000-0000-000000025413','leistungen','tun','Service & Operations','Operative Dienstleistungen für den Mittelstand.'),
  ('00000000-0000-0000-0000-000000025414','know_how','tun','Design & Branding','Marken- und Designkompetenz.'),
  -- exchange (AGE-357)
  ('00000000-0000-0000-0000-000000025415','know_how','tun','Fertigungs-Know-how','Präzisionsfertigung und Produktionsplanung im Mittelstand.'),
  ('00000000-0000-0000-0000-000000025415','leistungen','tun','Lohnfertigung','Fertigungskapazität für Serien- und Sonderteile.'),
  ('00000000-0000-0000-0000-000000025416','know_how','tun','Steuerliche Nachfolgegestaltung','Strukturierung von Übergaben und Beteiligungen.'),
  ('00000000-0000-0000-0000-000000025416','leistungen','tun','Steuerberatung Mittelstand','Laufende Beratung für inhabergeführte Unternehmen.'),
  ('00000000-0000-0000-0000-000000025417','leistungen','tun','Handel & Distribution','Zugang zu Handels- und Logistikstrukturen.'),
  ('00000000-0000-0000-0000-000000025417','kontakte','tun','Lieferanten-Netzwerk','Kontakte zu Herstellern und Großhändlern.'),
  -- discover (AGE-357)
  ('00000000-0000-0000-0000-000000025418','know_how','tun','Nachhaltige Verpackung','Materialwissen zu kompostierbaren Verpackungen.'),
  ('00000000-0000-0000-0000-000000025419','know_how','tun','IT-Infrastruktur & Cloud','Migration und Absicherung mittelständischer IT.'),
  ('00000000-0000-0000-0000-000000025419','leistungen','tun','IT-Beratung','Projektbezogene Beratung und Umsetzung.'),
  ('00000000-0000-0000-0000-000000025420','know_how','tun','Bestandssanierung','Planung und Bauleitung bei Sanierungen.'),
  -- basic (AGE-357) — dünn, wie es zur Stufe passt
  ('00000000-0000-0000-0000-000000025421','know_how','tun','Plattform-Produkt','Produktaufbau für zweiseitige Marktplätze.'),
  ('00000000-0000-0000-0000-000000025423','leistungen','tun','Elektrotechnik','Installation und Projektabwicklung im Gewerbebau.');

delete from public.needs where profile_id in (
  '5e195a30-99af-4fbb-ae5f-1f4eff3209c7','d73efa12-5f11-4220-94b4-dd5880b10782','2752a480-a737-4f90-af0c-a76722c781a7',
  '00000000-0000-0000-0000-000000025401','00000000-0000-0000-0000-000000025402','00000000-0000-0000-0000-000000025403',
  '00000000-0000-0000-0000-000000025404','00000000-0000-0000-0000-000000025405','00000000-0000-0000-0000-000000025406',
  '00000000-0000-0000-0000-000000025407','00000000-0000-0000-0000-000000025408','00000000-0000-0000-0000-000000025409',
  '00000000-0000-0000-0000-000000025410','00000000-0000-0000-0000-000000025411','00000000-0000-0000-0000-000000025412',
  '00000000-0000-0000-0000-000000025413','00000000-0000-0000-0000-000000025414',
  '00000000-0000-0000-0000-000000025415','00000000-0000-0000-0000-000000025416','00000000-0000-0000-0000-000000025417',
  '00000000-0000-0000-0000-000000025418','00000000-0000-0000-0000-000000025419','00000000-0000-0000-0000-000000025420',
  '00000000-0000-0000-0000-000000025421','00000000-0000-0000-0000-000000025422','00000000-0000-0000-0000-000000025423');
insert into public.needs (profile_id, category, theme, title, description, tx_volume_band) values
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','immobilien','haben','Immobilien-Beteiligungen','Suche Objekte und Projekte zur Beteiligung.',null),
  ('d73efa12-5f11-4220-94b4-dd5880b10782','experten','tun','Fachexpert:innen','Suche Expert:innen für Beratungsmandate.',null),
  ('2752a480-a737-4f90-af0c-a76722c781a7','investoren','haben','Seed-Finanzierung','Suche Seed-Kapital für SaaS-Wachstum.','100k_1m'),
  ('2752a480-a737-4f90-af0c-a76722c781a7','mentoren','sein','Mentoring','Suche erfahrene Mentor:innen.',null),
  ('00000000-0000-0000-0000-000000025401','projekte','wirken','Investmentcase-Projekte','Suche skalierbare Projekte für Beteiligungen.',null),
  ('00000000-0000-0000-0000-000000025401','immobilien','haben','Immobilien-Investments','Suche Immobilienprojekte zur Beimischung.',null),
  ('00000000-0000-0000-0000-000000025402','partner','tun','Bau- & Vertriebspartner','Suche Partner für Projektentwicklung.',null),
  ('00000000-0000-0000-0000-000000025402','projekte','wirken','Entwicklungsprojekte','Suche Grundstücke und Projekte.',null),
  ('00000000-0000-0000-0000-000000025403','projekte','wirken','Wirkungsprojekte','Suche Mandate mit Wirkung und Sinn.',null),
  ('00000000-0000-0000-0000-000000025404','projekte','wirken','Impact-Projekte','Suche wirkungsorientierte Investments.',null),
  ('00000000-0000-0000-0000-000000025404','immobilien','haben','Nachhaltige Immobilien','Suche nachhaltige Immobilienprojekte.',null),
  ('00000000-0000-0000-0000-000000025405','projekte','wirken','Finanzierungsmandate','Suche Unternehmen mit Finanzierungsbedarf.',null),
  ('00000000-0000-0000-0000-000000025405','immobilien','haben','Immobilien-Co-Investments','Suche Immobilien zur Co-Finanzierung.',null),
  ('00000000-0000-0000-0000-000000025406','investoren','haben','Series-A-Kapital','Suche Wachstumskapital für Robotik-Skalierung.','1m_10m'),
  ('00000000-0000-0000-0000-000000025406','partner','tun','Industriepartner','Suche Partner für Pilotprojekte.',null),
  ('00000000-0000-0000-0000-000000025407','investoren','haben','Projektkapital','Suche Eigenkapital für Quartiersentwicklung.','gt_10m'),
  ('00000000-0000-0000-0000-000000025408','experten','tun','Branchenexpert:innen','Suche Expert:innen für Mandate.',null),
  ('00000000-0000-0000-0000-000000025408','kunden','tun','Neukunden','Suche wachsende Unternehmen als Kunden.',null),
  ('00000000-0000-0000-0000-000000025409','investoren','haben','Co-Investoren Immobilien','Suche Kapitalpartner für Value-Add.','1m_10m'),
  ('00000000-0000-0000-0000-000000025409','partner','tun','Projektpartner','Suche Partner für Immobilienprojekte.',null),
  ('00000000-0000-0000-0000-000000025410','investoren','haben','Series-A HealthTech','Suche Series-A-Kapital für Digital Health.','1m_10m'),
  ('00000000-0000-0000-0000-000000025411','kunden','tun','B2B-Kunden','Suche Mittelständler für Beratungsmandate.',null),
  ('00000000-0000-0000-0000-000000025411','partner','tun','Umsetzungspartner','Suche Partner für Transformationsprojekte.',null),
  ('00000000-0000-0000-0000-000000025412','investoren','haben','Pre-Seed','Suche erstes Kapital für DeepTech.','100k_1m'),
  ('00000000-0000-0000-0000-000000025412','mentoren','sein','Tech-Mentoring','Suche Mentor:innen mit DeepTech-Erfahrung.',null),
  ('00000000-0000-0000-0000-000000025413','partner','tun','Vertriebspartner','Suche Partner für Markterschließung.',null),
  ('00000000-0000-0000-0000-000000025413','kunden','tun','Auftraggeber','Suche Kunden für Dienstleistungen.',null),
  ('00000000-0000-0000-0000-000000025414','mentoren','sein','Gründungs-Mentoring','Suche Mentor:innen für den Aufbau.',null),
  ('00000000-0000-0000-0000-000000025414','experten','tun','Fachexpertise','Suche Expert:innen für Skalierung.',null),
  -- exchange (AGE-357)
  ('00000000-0000-0000-0000-000000025415','experten','tun','Nachfolgeberatung','Suche Expertise für die Übergabe an die nächste Generation.',null),
  ('00000000-0000-0000-0000-000000025415','investoren','haben','Nachfolgekapital','Suche Kapitalpartner für die Nachfolgelösung.','1m_10m'),
  ('00000000-0000-0000-0000-000000025416','kunden','tun','Mandanten','Suche inhabergeführte Unternehmen als Mandanten.',null),
  ('00000000-0000-0000-0000-000000025417','experten','tun','E-Commerce-Expertise','Suche Expert:innen für den Umbau auf Online-Handel.',null),
  ('00000000-0000-0000-0000-000000025417','partner','tun','Logistikpartner','Suche Partner für Lager und Versand.',null),
  -- discover (AGE-357)
  ('00000000-0000-0000-0000-000000025418','investoren','haben','Erstfinanzierung','Suche Kapital für die erste Serienproduktion.','100k_1m'),
  ('00000000-0000-0000-0000-000000025418','kunden','tun','Pilotkunden','Suche Mittelständler für erste Verpackungsprojekte.',null),
  ('00000000-0000-0000-0000-000000025419','mitarbeiter','tun','Erste Mitarbeitende','Suche IT-Fachkräfte für den Aufbau eines Teams.',null),
  ('00000000-0000-0000-0000-000000025419','kunden','tun','Mittelstandskunden','Suche Unternehmen mit IT-Modernisierungsbedarf.',null),
  ('00000000-0000-0000-0000-000000025420','projekte','wirken','Sanierungsprojekte','Suche Bestandsobjekte mit Sanierungsbedarf.',null),
  ('00000000-0000-0000-0000-000000025420','partner','tun','Bauherren & Projektpartner','Suche Partner für gemeinsame Sanierungen.',null),
  -- basic (AGE-357)
  ('00000000-0000-0000-0000-000000025421','mentoren','sein','Gründungs-Mentoring','Suche Mentor:innen für die ersten Schritte.',null),
  ('00000000-0000-0000-0000-000000025421','investoren','haben','Pre-Seed','Suche erstes Kapital für die Plattform.','100k_1m'),
  ('00000000-0000-0000-0000-000000025422','mentoren','sein','Orientierung im Club','Suche Mentor:innen für den Einstieg ins Netzwerk.',null),
  ('00000000-0000-0000-0000-000000025423','mitarbeiter','tun','Elektro-Fachkräfte','Suche Gesell:innen und Meister:innen für den Betrieb.',null),
  ('00000000-0000-0000-0000-000000025423','kunden','tun','Gewerbekunden','Suche Auftraggeber im Gewerbebau.',null);

-- ── 5. Erfolgsradar (Sein/Tun/Haben/Wirken, 0–10) for every persona. ──────────
insert into public.profile_theme_scores (profile_id, theme, score)
select id, t.theme, t.score from (values
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7'::uuid, 8.0, 8.5, 9.0, 8.5),
  ('d73efa12-5f11-4220-94b4-dd5880b10782'::uuid, 7.5, 8.5, 6.5, 7.0),
  ('2752a480-a737-4f90-af0c-a76722c781a7'::uuid, 6.0, 7.0, 4.5, 5.0),
  ('00000000-0000-0000-0000-000000025401'::uuid, 7.5, 8.5, 9.0, 8.0),
  ('00000000-0000-0000-0000-000000025402'::uuid, 7.0, 8.0, 9.0, 7.0),
  ('00000000-0000-0000-0000-000000025403'::uuid, 9.0, 8.0, 6.5, 8.5),
  ('00000000-0000-0000-0000-000000025404'::uuid, 8.5, 8.0, 9.0, 9.5),
  ('00000000-0000-0000-0000-000000025405'::uuid, 7.0, 8.0, 8.5, 7.0),
  ('00000000-0000-0000-0000-000000025406'::uuid, 6.5, 8.5, 6.0, 6.5),
  ('00000000-0000-0000-0000-000000025407'::uuid, 6.5, 7.5, 7.5, 6.5),
  ('00000000-0000-0000-0000-000000025408'::uuid, 7.0, 7.5, 6.0, 6.5),
  ('00000000-0000-0000-0000-000000025409'::uuid, 6.5, 7.5, 8.0, 6.0),
  ('00000000-0000-0000-0000-000000025410'::uuid, 6.5, 8.0, 6.0, 7.0),
  ('00000000-0000-0000-0000-000000025411'::uuid, 6.5, 7.5, 6.0, 6.0),
  ('00000000-0000-0000-0000-000000025412'::uuid, 6.0, 7.0, 4.0, 6.5),
  ('00000000-0000-0000-0000-000000025413'::uuid, 6.0, 6.5, 5.0, 5.0),
  ('00000000-0000-0000-0000-000000025414'::uuid, 7.0, 6.5, 4.5, 6.0),
  -- exchange (AGE-357)
  ('00000000-0000-0000-0000-000000025415'::uuid, 6.0, 7.0, 6.5, 5.5),
  ('00000000-0000-0000-0000-000000025416'::uuid, 6.0, 7.0, 6.0, 5.5),
  ('00000000-0000-0000-0000-000000025417'::uuid, 5.5, 6.5, 6.5, 5.0),
  -- discover (AGE-357)
  ('00000000-0000-0000-0000-000000025418'::uuid, 5.5, 6.0, 4.0, 6.0),
  ('00000000-0000-0000-0000-000000025419'::uuid, 5.0, 6.0, 4.5, 4.5),
  ('00000000-0000-0000-0000-000000025420'::uuid, 5.5, 6.0, 5.0, 5.5),
  -- basic (AGE-357) — neu dabei, entsprechend niedrig
  ('00000000-0000-0000-0000-000000025421'::uuid, 4.0, 4.5, 2.5, 3.5),
  ('00000000-0000-0000-0000-000000025422'::uuid, 4.0, 3.5, 2.0, 3.0),
  ('00000000-0000-0000-0000-000000025423'::uuid, 4.5, 5.0, 3.5, 3.0)
) as v(id, sein, tun, haben, wirken)
cross join lateral (values ('sein', v.sein), ('tun', v.tun), ('haben', v.haben), ('wirken', v.wirken)) as t(theme, score)
on conflict (profile_id, theme) do update set score = excluded.score;

-- ── 6. Themed interests for the presenter login personas (dashboard widget). ───
delete from public.profile_interests where profile_id in (
  '5e195a30-99af-4fbb-ae5f-1f4eff3209c7','d73efa12-5f11-4220-94b4-dd5880b10782','2752a480-a737-4f90-af0c-a76722c781a7');
insert into public.profile_interests (profile_id, theme, label) values
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','haben','Beteiligungen'),
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','haben','Family Office'),
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','wirken','Impact Investing'),
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','tun','Deal Origination'),
  ('d73efa12-5f11-4220-94b4-dd5880b10782','tun','Strategie'),
  ('d73efa12-5f11-4220-94b4-dd5880b10782','tun','Netzwerk'),
  ('d73efa12-5f11-4220-94b4-dd5880b10782','sein','Leadership'),
  ('2752a480-a737-4f90-af0c-a76722c781a7','tun','Vertrieb'),
  ('2752a480-a737-4f90-af0c-a76722c781a7','haben','Fintech'),
  ('2752a480-a737-4f90-af0c-a76722c781a7','sein','Gründerreise');

-- ── 7. Goals + badges for the Legacy presenter persona (dashboard demo). ───────
delete from public.goals where profile_id = '5e195a30-99af-4fbb-ae5f-1f4eff3209c7';
insert into public.goals (profile_id, category, title, progress) values
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','finanziell','Impact-Fonds II auflegen',55),
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','unternehmerisch','Drei neue Beteiligungen 2026',70),
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','wirkung','50 Gründer:innen begleiten',40),
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','persoenlich','Mehr Zeit für Mentoring',60);
insert into public.profile_badges (profile_id, badge_key, awarded_at) values
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','transaction_manager', date '2020-04-01'),
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','mentor',              date '2021-10-01'),
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7','host',                date '2022-05-01')
on conflict (profile_id, badge_key) do nothing;

-- ── 8. Recompute potential score (regelbasiert) for every enriched persona. ────
select public.recompute_potential_score(id) from (values
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7'::uuid),('d73efa12-5f11-4220-94b4-dd5880b10782'::uuid),
  ('2752a480-a737-4f90-af0c-a76722c781a7'::uuid),
  ('00000000-0000-0000-0000-000000025401'::uuid),('00000000-0000-0000-0000-000000025402'::uuid),
  ('00000000-0000-0000-0000-000000025403'::uuid),('00000000-0000-0000-0000-000000025404'::uuid),
  ('00000000-0000-0000-0000-000000025405'::uuid),('00000000-0000-0000-0000-000000025406'::uuid),
  ('00000000-0000-0000-0000-000000025407'::uuid),('00000000-0000-0000-0000-000000025408'::uuid),
  ('00000000-0000-0000-0000-000000025409'::uuid),('00000000-0000-0000-0000-000000025410'::uuid),
  ('00000000-0000-0000-0000-000000025411'::uuid),('00000000-0000-0000-0000-000000025412'::uuid),
  ('00000000-0000-0000-0000-000000025413'::uuid),('00000000-0000-0000-0000-000000025414'::uuid),
  ('00000000-0000-0000-0000-000000025415'::uuid),('00000000-0000-0000-0000-000000025416'::uuid),
  ('00000000-0000-0000-0000-000000025417'::uuid),('00000000-0000-0000-0000-000000025418'::uuid),
  ('00000000-0000-0000-0000-000000025419'::uuid),('00000000-0000-0000-0000-000000025420'::uuid),
  ('00000000-0000-0000-0000-000000025421'::uuid),('00000000-0000-0000-0000-000000025422'::uuid),
  ('00000000-0000-0000-0000-000000025423'::uuid)
) as v(id);

-- ── 9. Build the match graph: recompute matches for every persona (incl. the
--    existing Maximilian/Eleonora hero pair). ON CONFLICT preserves status, so
--    the requested/accepted lifecycle of existing pairs is untouched. ──────────
select public.generate_matches_for(id) from (values
  ('00000000-0000-0000-0000-000000000238'::uuid),
  ('5e195a30-99af-4fbb-ae5f-1f4eff3209c7'::uuid),('d73efa12-5f11-4220-94b4-dd5880b10782'::uuid),
  ('2752a480-a737-4f90-af0c-a76722c781a7'::uuid),
  ('00000000-0000-0000-0000-000000025401'::uuid),('00000000-0000-0000-0000-000000025402'::uuid),
  ('00000000-0000-0000-0000-000000025403'::uuid),('00000000-0000-0000-0000-000000025404'::uuid),
  ('00000000-0000-0000-0000-000000025405'::uuid),('00000000-0000-0000-0000-000000025406'::uuid),
  ('00000000-0000-0000-0000-000000025407'::uuid),('00000000-0000-0000-0000-000000025408'::uuid),
  ('00000000-0000-0000-0000-000000025409'::uuid),('00000000-0000-0000-0000-000000025410'::uuid),
  ('00000000-0000-0000-0000-000000025411'::uuid),('00000000-0000-0000-0000-000000025412'::uuid),
  ('00000000-0000-0000-0000-000000025413'::uuid),('00000000-0000-0000-0000-000000025414'::uuid),
  ('00000000-0000-0000-0000-000000025415'::uuid),('00000000-0000-0000-0000-000000025416'::uuid),
  ('00000000-0000-0000-0000-000000025417'::uuid),('00000000-0000-0000-0000-000000025418'::uuid),
  ('00000000-0000-0000-0000-000000025419'::uuid),('00000000-0000-0000-0000-000000025420'::uuid),
  ('00000000-0000-0000-0000-000000025421'::uuid),('00000000-0000-0000-0000-000000025422'::uuid),
  ('00000000-0000-0000-0000-000000025423'::uuid)
) as v(id);

-- ── 10. Two extra contact-request examples (only Prime+ may initiate). ─────────
-- 10a. Pending request on a DKRI match: Tobias (prime founder) → Eleonora (capital).
insert into public.contact_requests (from_id, to_id, match_id, message)
select '00000000-0000-0000-0000-000000025406', '5e195a30-99af-4fbb-ae5f-1f4eff3209c7',
       (select id from public.matches
          where least(a_profile_id,b_profile_id)=least('00000000-0000-0000-0000-000000025406'::uuid,'5e195a30-99af-4fbb-ae5f-1f4eff3209c7'::uuid)
            and greatest(a_profile_id,b_profile_id)=greatest('00000000-0000-0000-0000-000000025406'::uuid,'5e195a30-99af-4fbb-ae5f-1f4eff3209c7'::uuid)),
       'Hallo Frau Voss, unsere Series-A passt thematisch perfekt — lassen Sie uns sprechen.'
where not exists (
  select 1 from public.contact_requests
  where from_id='00000000-0000-0000-0000-000000025406' and to_id='5e195a30-99af-4fbb-ae5f-1f4eff3209c7');

-- 10b. Accepted request + chat: Gregor (developer) ↔ Hans-Peter (capital/immo).
insert into public.contact_requests (from_id, to_id, match_id, message)
select '00000000-0000-0000-0000-000000025407', '00000000-0000-0000-0000-000000025402',
       (select id from public.matches
          where least(a_profile_id,b_profile_id)=least('00000000-0000-0000-0000-000000025407'::uuid,'00000000-0000-0000-0000-000000025402'::uuid)
            and greatest(a_profile_id,b_profile_id)=greatest('00000000-0000-0000-0000-000000025407'::uuid,'00000000-0000-0000-0000-000000025402'::uuid)),
       'Servus Hans-Peter, mein Quartiersprojekt sucht Co-Kapital — magst du draufschauen?'
where not exists (
  select 1 from public.contact_requests
  where from_id='00000000-0000-0000-0000-000000025407' and to_id='00000000-0000-0000-0000-000000025402');

update public.contact_requests set status='accepted'
where from_id='00000000-0000-0000-0000-000000025407' and to_id='00000000-0000-0000-0000-000000025402' and status='pending';

-- Two messages in the (trigger-created) thread.
insert into public.messages (thread_id, sender_id, body)
select t.id, m.sender, m.body
from public.message_threads t
join (values
  ('00000000-0000-0000-0000-000000025407'::uuid, 'Danke fürs Annehmen! Ich schicke dir das Exposé.'),
  ('00000000-0000-0000-0000-000000025402'::uuid, 'Sehr gern — Zahlen sehen spannend aus, lass uns telefonieren.')
) as m(sender, body) on true
where t.a_profile_id = least('00000000-0000-0000-0000-000000025407'::uuid,'00000000-0000-0000-0000-000000025402'::uuid)
  and t.b_profile_id = greatest('00000000-0000-0000-0000-000000025407'::uuid,'00000000-0000-0000-0000-000000025402'::uuid)
  and not exists (select 1 from public.messages x where x.thread_id = t.id);

commit;
