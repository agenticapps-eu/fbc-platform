-- Die zwei Aggregate der Feed-Sidebar (AGE-582).
-- Change: openspec/changes/activity-concept-level/, Abschnitt 4.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf; die
-- manuellen probe_*.sql tun es nicht. Diese Datei ist in ci.yml eingetragen.
--
-- ══ WAS HIER GEMESSEN WIRD UND WARUM ES NICHT TRIVIAL IST ══════════════════
-- Beide Funktionen laufen `security invoker` und kopieren das Sichtbarkeits-
-- prädikat NICHT. Das ist der bessere Zustand — aber es heisst auch, dass keine
-- Zeile in der Migration steht, die man lesen und für richtig halten könnte.
-- Die Zusage, dass eine Zahl der Sichtbarkeit folgt, kann DESHALB nur gemessen
-- werden, und zwar von ZWEI Seiten:
--
--   * derselbe Tag, dieselben fünf Beiträge — der `basic`-Betrachter bekommt 2,
--     der `exchange`-Betrachter 5. Eine Zusage aus nur einer Perspektive wäre
--     mit einer kaputten Funktion vereinbar, die immer alles oder immer nur das
--     Öffentliche zählt.
--   * ein Tag, dessen Beiträge ALLE unsichtbar sind, fehlt in der Liste ganz.
--     Nicht mit der Zahl null: schon sein Erscheinen verriete, dass es ihn gibt.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * `profiles_public` trägt `is_activated()` im WHERE, und das prüft den
--     AUFRUFER, nicht die Zeile. Ein unbestätigter Betrachter sähe dort GAR
--     NICHTS — eine leere Autorenliste hat also zwei Ursachen, die gleich
--     aussehen. Alle Betrachter hier sind bestätigt, damit nur die eine bleibt.
--   * Der lokale Stack ist geseedet und trägt eigene Tags und Beiträge. Jede
--     Mengenaussage ist auf die Fixture-Schlüssel eingeschränkt.
--   * In pgTAP heisst es `alike()`, nicht `like()`.

begin;
select plan(18);

-- ── Fixtures: Betrachter ────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('a0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'sb-basic@test.fbc'),
  ('a0000000-0000-0000-0000-00000000000e', 'authenticated', 'authenticated', 'sb-exchange@test.fbc');

-- `basic` sieht nur `public`, `exchange` (Rang 4) zusätzlich `members`. Genau
-- dieser Unterschied ist der Messwert.
update public.profiles set tier = 'basic', name = 'Sb Basic', activated_at = now(), is_public = true
 where id = 'a0000000-0000-0000-0000-00000000000b';
update public.profiles set tier = 'exchange', name = 'Sb Exchange', activated_at = now(), is_public = true
 where id = 'a0000000-0000-0000-0000-00000000000e';

-- ── Fixtures: Autoren ───────────────────────────────────────────────────────
insert into auth.users (id, aud, role, email) values
  ('a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'sb-autor1@test.fbc'),
  ('a1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sb-autor2@test.fbc');

update public.profiles set tier = 'impact', name = 'Sb Autor Eins', activated_at = now(), is_public = true
 where id = 'a1000000-0000-0000-0000-000000000001';
update public.profiles set tier = 'impact', name = 'Sb Autor Zwei', activated_at = now(), is_public = true
 where id = 'a1000000-0000-0000-0000-000000000002';

-- 25 Füll-Autoren mit je einem öffentlichen Beitrag. Sie sind nur dafür da,
-- dass die Obergrenze von 20 überhaupt greifen KANN — mit sieben Autoren
-- bewiese `p_limit => 999` nichts.
insert into auth.users (id, aud, role, email)
select ('a2000000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid,
       'authenticated', 'authenticated', 'sb-fuell' || g || '@test.fbc'
  from generate_series(1, 25) g;

update public.profiles set tier = 'impact', is_public = true, activated_at = now(),
       name = 'Zz Fuell ' || lpad(right(id::text, 2), 2, '0')
 where id::text like 'a2000000-0000-0000-0000-0000000000%';

insert into public.posts (author_id, body, visibility)
select id, 'Fuellbeitrag', 'public' from public.profiles
 where id::text like 'a2000000-0000-0000-0000-0000000000%';

-- ── Fixtures: Tags ──────────────────────────────────────────────────────────
-- `tags_key_ist_label` verlangt key = lower(label), `tags_key_tippbar` nur
-- Buchstaben, Ziffern und Unterstrich.
insert into public.tags (key, label, sort, active) values
  ('sbsichtbar',  'SbSichtbar',  901, true),
  ('sbverdeckt',  'SbVerdeckt',  902, true),
  ('sbstillgelegt','SbStillgelegt', 903, false),
  ('sbgleicha',   'SbGleichA',   904, true),
  ('sbgleichb',   'SbGleichB',   905, true);

-- `sbsichtbar` an fünf Beiträgen: ZWEI öffentlich, DREI nur für Mitglieder.
insert into public.posts (author_id, body, visibility, hashtags) values
  ('a1000000-0000-0000-0000-000000000001', 'S1', 'public',  array['sbsichtbar']),
  ('a1000000-0000-0000-0000-000000000001', 'S2', 'public',  array['sbsichtbar']),
  ('a1000000-0000-0000-0000-000000000001', 'S3', 'members', array['sbsichtbar']),
  ('a1000000-0000-0000-0000-000000000001', 'S4', 'members', array['sbsichtbar']),
  ('a1000000-0000-0000-0000-000000000001', 'S5', 'members', array['sbsichtbar']);

-- `sbverdeckt` NUR an einem Beitrag für Mitglieder — für `basic` unsichtbar.
insert into public.posts (author_id, body, visibility, hashtags) values
  ('a1000000-0000-0000-0000-000000000002', 'V1', 'members', array['sbverdeckt']);

-- Das stillgelegte Tag haengt an einem OEFFENTLICHEN Beitrag. Wenn es trotzdem
-- fehlt, liegt das an `active`, nicht an der Sichtbarkeit — das ist die Zusage.
insert into public.posts (author_id, body, visibility, hashtags) values
  ('a1000000-0000-0000-0000-000000000002', 'T1', 'public', array['sbstillgelegt']);

-- Ein FREIES Schlagwort, das in `tags` gar nicht steht, an zwei oeffentlichen
-- Beitraegen — es traegt also mehr Treffer als `sbverdeckt` und stuende bei
-- einer Zaehlung ueber `unnest(hashtags)` weit oben.
insert into public.posts (author_id, body, visibility, hashtags) values
  ('a1000000-0000-0000-0000-000000000002', 'F1', 'public', array['sbfreitext']),
  ('a1000000-0000-0000-0000-000000000002', 'F2', 'public', array['sbfreitext']);

-- Zwei Tags mit exakt derselben Zahl — der Prüfstein für den Tie-Break.
insert into public.posts (author_id, body, visibility, hashtags) values
  ('a1000000-0000-0000-0000-000000000002', 'G1', 'public', array['sbgleicha']),
  ('a1000000-0000-0000-0000-000000000002', 'G2', 'public', array['sbgleichb']);

-- ── Helfer ──────────────────────────────────────────────────────────────────
-- Liefert das Ergebnis einer Abfrage unter fremder Identität als EINE
-- Zeichenkette. `count_as` genuegt hier nicht: gemessen wird oft die LISTE.
create function pg_temp.text_as(uid uuid, q text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into r;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return r;
end $$;

create function pg_temp.text_as_anon(q text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  execute q into r;
  reset role;
  return r;
end $$;

-- ── 1. Der Tag-Zähler folgt der Sichtbarkeit ────────────────────────────────
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000b',
    $$select post_count::text from public.feed_tag_counts()
       where tag_key = 'sbsichtbar'$$),
  '2', 'Ein Tag an fünf Beiträgen, von denen der basic-Betrachter zwei sehen '
       'darf, zählt ZWEI');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select post_count::text from public.feed_tag_counts()
       where tag_key = 'sbsichtbar'$$),
  '5', 'Derselbe Tag zählt für den exchange-Betrachter FÜNF — dieselbe '
       'Funktion, dieselben Beiträge, ein anderer Aufrufer');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000b',
    $$select coalesce(string_agg(tag_key, ','), '(fehlt)')
        from public.feed_tag_counts() where tag_key = 'sbverdeckt'$$),
  '(fehlt)',
  'Ein Tag ohne einen einzigen sichtbaren Beitrag erscheint GAR NICHT — auch '
  'nicht mit der Zahl null');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select post_count::text from public.feed_tag_counts()
       where tag_key = 'sbverdeckt'$$),
  '1', 'Für den exchange-Betrachter ist derselbe Tag sehr wohl da — die '
       'Gegenprobe zur Zusage darüber');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select coalesce(string_agg(tag_key, ','), '(fehlt)')
        from public.feed_tag_counts() where tag_key = 'sbstillgelegt'$$),
  '(fehlt)',
  'Ein stillgelegtes Tag erscheint nicht, obwohl sein Beitrag öffentlich ist');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select coalesce(string_agg(tag_key, ','), '(fehlt)')
        from public.feed_tag_counts() where tag_key = 'sbfreitext'$$),
  '(fehlt)',
  'Ein frei getipptes Schlagwort erscheint nicht, obwohl es öfter vorkommt als '
  'ein kuratiertes');

-- Zwei Aufrufe, eine Liste. Ohne den Tie-Break über `sort` und `key` duerfte
-- der Planer die beiden Gleichstaendigen in beliebiger Folge liefern.
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select string_agg(tag_key, '>' order by rn)
        from (select tag_key, row_number() over () as rn
                from public.feed_tag_counts()
               where tag_key in ('sbgleicha', 'sbgleichb')) x$$),
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select string_agg(tag_key, '>' order by rn)
        from (select tag_key, row_number() over () as rn
                from public.feed_tag_counts()
               where tag_key in ('sbgleicha', 'sbgleichb')) x$$),
  'Zwei Tags mit gleicher Zahl stehen bei zwei Aufrufen in derselben Reihenfolge');

-- Der ausgeloggte Besucher. `posts` traegt fuer `anon` die eigene Policy
-- `posts_select_public_anon` — die Zahl ist also nachweislich die oeffentliche
-- und nicht aus einem Fehler gemachte Null.
select is(
  pg_temp.text_as_anon(
    $$select post_count::text from public.feed_tag_counts()
       where tag_key = 'sbsichtbar'$$),
  '2', 'Ohne Sitzung zählt derselbe Tag nur die zwei öffentlichen Beiträge');

-- ── 2. Aktivste Mitglieder ──────────────────────────────────────────────────
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select post_count::text from public.feed_top_authors(50)
       where profile_id = 'a1000000-0000-0000-0000-000000000001'$$),
  '5', 'Der Autor steht mit fünf Beiträgen — so viele sieht der exchange-Betrachter');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000b',
    $$select post_count::text from public.feed_top_authors(50)
       where profile_id = 'a1000000-0000-0000-0000-000000000001'$$),
  '2', 'Für den basic-Betrachter steht derselbe Autor mit ZWEI — die Zahl ist '
       'kein Umweg zur Sichtbarkeit');

-- ── 3. Ein deaktiviertes Mitglied verschwindet ──────────────────────────────
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select coalesce(string_agg(profile_id::text, ','), '(fehlt)')
        from public.feed_top_authors(50)
       where profile_id = 'a1000000-0000-0000-0000-000000000002'$$),
  'a1000000-0000-0000-0000-000000000002',
  'Vorbedingung: der zweite Autor steht in der Liste');

update public.profiles set disabled_at = now()
 where id = 'a1000000-0000-0000-0000-000000000002';

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select coalesce(string_agg(profile_id::text, ','), '(fehlt)')
        from public.feed_top_authors(50)
       where profile_id = 'a1000000-0000-0000-0000-000000000002'$$),
  '(fehlt)',
  'Nach der Deaktivierung erscheint er nicht mehr — profiles_public schliesst '
  'ihn selbst aus, ohne ein eigenes Prädikat hier');

-- ── 4. Die Obergrenze und der ungültige Wert ────────────────────────────────
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select count(*)::text from public.feed_top_authors()$$),
  '5', 'Ohne Argument sind es fünf Einträge');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select count(*)::text from public.feed_top_authors(null)$$),
  '5', 'null wird zu fünf, nicht zu einer leeren Liste');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select count(*)::text from public.feed_top_authors(0)$$),
  '1', 'Ein zu kleiner Wert wird auf 1 geklemmt, nicht abgewiesen');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select count(*)::text from public.feed_top_authors(999)$$),
  '20', 'Ein zu grosser Wert wird auf 20 geklemmt — dafür stehen 25 Autoren '
        'im Bestand, sonst bewiese die Zusage nichts');

-- ── 5. Der Vertrag beider Funktionen ────────────────────────────────────────
-- `prosecdef = false` ist der Kern des Abschnitts: waere hier `true`, liefe die
-- Aggregation an der RLS vorbei und JEDE Zahl oben waere zufaellig richtig.
select is(
  (select string_agg(p.proname || '=' || p.prosecdef::text || '/' || p.provolatile::text
                     || '/' || coalesce(array_to_string(p.proconfig, ','), '(keiner)'),
                     ' ' order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('feed_tag_counts', 'feed_top_authors')),
  'feed_tag_counts=false/s/search_path="" feed_top_authors=false/s/search_path=""',
  'Beide sind security INVOKER, stable und mit geleertem search_path');

select is(
  (select string_agg(routine_name || '→' || grantee, ' ' order by routine_name, grantee)
     from information_schema.role_routine_grants
    where routine_schema = 'public'
      and routine_name in ('feed_tag_counts', 'feed_top_authors')
      and grantee in ('PUBLIC', 'anon', 'authenticated')),
  'feed_tag_counts→anon feed_tag_counts→authenticated feed_top_authors→authenticated',
  'feed_top_authors ist NICHT an anon vergeben — profiles_public hält dort kein '
  'Recht, und ein Aufrufweg, den es nicht gibt, entsteht nicht versehentlich');

select * from finish();
rollback;
