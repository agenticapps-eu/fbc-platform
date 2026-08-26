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
--   * und — nachgetragen für Abschnitt 7.7 — von der dritten Seite: das Prädikat
--     hat einen Zweig `author_id = auth.uid()`, der Rang und Person trennt. Zwei
--     Betrachter DESSELBEN Rangs bekommen für denselben Tag verschiedene Zahlen,
--     wenn einer von ihnen der Verfasser ist. Beide Gegenproben stehen in
--     Abschnitt 6 der Datei; keine der beiden Verbiegungen (`definer`, und eine
--     Abschrift, die nur das Öffentliche kennt) bleibt grün.
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
select plan(27);

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
-- AGE-601 hat die MESSACHSE dieser Datei verschoben, und das ist hier die
-- wichtigste Aenderung. Bis dahin war der Unterschied `basic` (2) gegen
-- `exchange` (5) der Messwert. Seit `members` jedes AKTIVIERTE Mitglied meint,
-- sehen beide fuenf — zwischen aktivierten Betrachtern gibt es NICHTS mehr zu
-- verbergen, und eine Zusage darueber waere ab jetzt gegenstandslos.
--
-- Die Zusage selbst bleibt aber notwendig: die Zahl darf kein Umweg zu
-- Beitraegen sein, die der Aufrufer nicht sehen darf. Die verbliebene Achse ist
-- die SITZUNG — ohne sie zaehlen nur `public`-Beitraege. Sie laeuft durch
-- denselben Code-Pfad (`security invoker`, kein kopiertes Praedikat) und ist
-- damit dieselbe Aussage, an der einzigen Stelle gemessen, an der sie sich noch
-- messen laesst.
select is(
  pg_temp.text_as_anon(
    $$select post_count::text from public.feed_tag_counts()
       where tag_key = 'sbsichtbar'$$),
  '2', 'Ein Tag an fünf Beiträgen, von denen der ausgeloggte Besucher zwei sehen '
       'darf, zählt ZWEI');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select post_count::text from public.feed_tag_counts()
       where tag_key = 'sbsichtbar'$$),
  '5', 'Derselbe Tag zählt für den eingeloggten Betrachter FÜNF — dieselbe '
       'Funktion, dieselben Beiträge, ein anderer Aufrufer');

-- Und der Beleg, dass die Stufe dabei KEINE Rolle mehr spielt (AGE-601): ein
-- `basic`-Konto bekommt dieselbe Fuenf wie ein `exchange`-Konto. Ohne diese
-- Zeile bliebe offen, ob die Fuenf oben an der Stufe oder an der Sitzung haengt.
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000b',
    $$select post_count::text from public.feed_tag_counts()
       where tag_key = 'sbsichtbar'$$),
  '5', 'Auch der basic-Betrachter zählt FÜNF — die Stufe ist keine Schranke mehr');

select is(
  pg_temp.text_as_anon(
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

-- Zwei Tags mit gleicher Zahl. Verglichen wird gegen die ERWARTETE Folge, nicht
-- gegen einen zweiten Aufruf (Befund codex, LOW, 7.8): zwei Aufrufe im selben
-- Plan liefern auch ohne jeden Tie-Break meist dieselbe zufaellige Reihenfolge,
-- und die Zusage bliebe gruen, waehrend die Ordnung dem Planer gehoerte.
-- `sbgleicha` traegt sort 904, `sbgleichb` 905 — die redaktionelle Spalte
-- entscheidet, und sie entscheidet in EINE Richtung.
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select string_agg(tag_key, '>' order by rn)
        from (select tag_key, row_number() over () as rn
                from public.feed_tag_counts()
               where tag_key in ('sbgleicha', 'sbgleichb')) x$$),
  'sbgleicha>sbgleichb',
  'Bei gleicher Zahl entscheidet die redaktionelle sort-Spalte — und zwar '
  'nachpruefbar, nicht nur reproduzierbar');

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
  '5', 'Für den basic-Betrachter steht derselbe Autor ebenfalls mit FÜNF '
       '(AGE-601) — zwischen aktivierten Betrachtern gibt es hier nichts mehr '
       'zu verbergen. Ausgeloggt ist diese Liste laut Spec gar nicht zu zeigen '
       '(profiles_public haelt fuer anon kein Recht), und ein unbestaetigter '
       'Betrachter taugt nicht als Gegenprobe: bei ihm haette eine leere Liste '
       'ZWEI Ursachen. Die Sichtbarkeits-Zusage fuer diesen Code-Pfad traegt '
       'deshalb Abschnitt 1 ueber feed_tag_counts — dieselbe Regel, derselbe '
       'security-invoker-Weg, nur an der Stelle gemessen, wo sie messbar ist.');

-- Die ORDNUNG, und warum sie eine eigene Zusage braucht (Befund codex, LOW,
-- 7.8): oben stehen nur Zeilenzahlen und einzelne Autoren. Nimmt man das
-- `order by count(*) desc` ganz heraus, bleibt jede dieser Zusagen gruen —
-- waehrend die Sidebar beliebige statt der aktivsten Mitglieder zeigt.
--
-- Absolut laesst sich die Liste nicht pruefen: der lokale Stack ist geseedet und
-- traegt eigene Autoren. Gemessen wird deshalb die RELATIVE Folge der eigenen
-- Fixturen — Autor Zwei (sechs sichtbare Beitraege) vor Autor Eins (fuenf) vor
-- dem ersten Fuell-Autor (einer).
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select string_agg(name, '>' order by rn) from (
        select name, rn from (
          select name, row_number() over () as rn from public.feed_top_authors(20)
        ) y
        where y.name like 'Sb Autor%' or y.name like 'Zz Fuell%'
        order by rn limit 3) z$$),
  'Sb Autor Zwei>Sb Autor Eins>Zz Fuell 01',
  'Die Liste ist nach der Zahl sichtbarer Beitraege absteigend geordnet');

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

-- ── 6. Was die Zähler NICHT verraten (Abschnitt 7.7) ────────────────────────
-- Die Zusagen oben messen die zwei Ränge `basic` und `exchange`. Das Prädikat
-- `posts_select_by_visibility` hat aber DREI Zweige, und der dritte ist der
-- gefährliche: `author_id = auth.uid()`. Ein Verfasser sieht seinen eigenen
-- `members`-Beitrag auch auf `basic` — die Zahl hängt also nicht nur an der
-- Stufe, sondern an der Person. Wäre der Zähler eine Abschrift ohne diesen
-- Zweig, zeigte er dem Verfasser weniger, als er öffnen kann; wäre er eine
-- Abschrift ohne den Rang, zeigte er jedem alles. Beides wird hier gemessen.
--
-- Die Fixturen stehen ABSICHTLICH hier unten und nicht oben bei den anderen:
-- ein weiterer Autor und ein weiterer Tag verschöben die Mengenaussagen der
-- Abschnitte 1 bis 4. Nachgelegt berühren sie keine einzige Zusage darüber.

insert into auth.users (id, aud, role, email) values
  ('a0000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'sb-basic2@test.fbc'),
  ('a1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'sb-autor3@test.fbc');

update public.profiles set tier = 'basic', name = 'Sb Basic Zwei', activated_at = now(), is_public = true
 where id = 'a0000000-0000-0000-0000-00000000000c';
update public.profiles set tier = 'impact', name = 'Sb Autor Drei', activated_at = now(), is_public = true
 where id = 'a1000000-0000-0000-0000-000000000003';

-- Autor Drei schreibt AUSSCHLIESSLICH für Mitglieder — ohne Tag, damit die
-- Tagzählung unberührt bleibt. Er ist das Gegenstück zu `sbverdeckt` auf der
-- Autorenseite: für `basic` darf er nicht mit der Zahl null erscheinen.
insert into public.posts (author_id, body, visibility) values
  ('a1000000-0000-0000-0000-000000000003', 'D1', 'members'),
  ('a1000000-0000-0000-0000-000000000003', 'D2', 'members');

-- `sbeigen` trägt zwei `members`-Beiträge: einen vom `basic`-Betrachter SELBST,
-- einen von Autor Eins.
--
-- DIESER ABSCHNITT HAT SEINEN MESSWERT AN AGE-601 VERLOREN, und das steht hier
-- statt einer stillen Anpassung. Er war gebaut, um den DRITTEN Zweig des
-- Praedikats zu zeigen (`author_id = auth.uid()`): zwei Betrachter desselben
-- Rangs bekamen verschiedene Zahlen, wenn einer der Verfasser war. Seit
-- `members` jedes aktivierte Mitglied meint, sehen beide beide Beitraege — der
-- dritte Zweig ist fuer aktivierte Aufrufer nicht mehr BEOBACHTBAR, weil der
-- zweite Zweig ihn vollstaendig ueberdeckt.
--
-- Der Zweig bleibt trotzdem im Praedikat, und das ist kein Versehen: er ist die
-- Zusage „ein Verfasser sieht seinen eigenen Beitrag IMMER", unabhaengig davon,
-- was die Sichtbarkeitsregel gerade sagt. Verengt sie sich je wieder, traegt er
-- sofort. Belegt wird er weiterhin in `rls_test.sql` (Abschnitt 8, „Basic sieht
-- den EIGENEN members-Beitrag") — dort ueber einen Aufrufer, bei dem der zweite
-- Zweig nicht greift.
insert into public.tags (key, label, sort, active) values ('sbeigen', 'SbEigen', 906, true);
insert into public.posts (author_id, body, visibility, hashtags) values
  ('a0000000-0000-0000-0000-00000000000b', 'E1', 'members', array['sbeigen']),
  ('a1000000-0000-0000-0000-000000000001', 'E2', 'members', array['sbeigen']);

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select post_count::text from public.feed_top_authors(50)
       where profile_id = 'a1000000-0000-0000-0000-000000000003'$$),
  '2', 'Vorbedingung: der exchange-Betrachter sieht beide verdeckten Beiträge '
       'von Autor Drei');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000b',
    $$select coalesce(string_agg(profile_id::text || '=' || post_count, ','), '(fehlt)')
        from public.feed_top_authors(50)
       where profile_id = 'a1000000-0000-0000-0000-000000000003'$$),
  'a1000000-0000-0000-0000-000000000003=2',
  'Autor Drei steht seit AGE-601 auch fuer den basic-Betrachter mit ZWEI — seine '
  'members-Beitraege sind nicht mehr verdeckt. Die Zusage „ein Autor ohne '
  'sichtbaren Beitrag fehlt GANZ statt mit der Zahl null" ist damit nicht '
  'aufgehoben, sondern gegenstandslos geworden: es gibt fuer ein aktiviertes '
  'Konto keinen solchen Autor mehr. Gemessen wird sie weiterhin ausgeloggt, in '
  'Abschnitt 1 ueber feed_tag_counts.');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000b',
    $$select post_count::text from public.feed_tag_counts()
       where tag_key = 'sbeigen'$$),
  '2', 'Der Verfasser zählt seit AGE-601 BEIDE Beiträge — seinen eigenen und '
       'den fremden. Vor AGE-601 stand hier 1, und die Differenz WAR der dritte '
       'Zweig; jetzt überdeckt ihn der zweite.');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000c',
    $$select coalesce(string_agg(tag_key, ','), '(fehlt)')
        from public.feed_tag_counts() where tag_key = 'sbeigen'$$),
  'sbeigen',
  'Für einen ANDEREN basic-Betrachter erscheint derselbe Tag jetzt ebenfalls — '
  'die Zahl hängt seit AGE-601 weder an der Stufe noch an der Person, solange '
  'der Aufrufer aktiviert ist');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000b',
    $$select post_count::text from public.feed_top_authors(50)
       where profile_id = 'a0000000-0000-0000-0000-00000000000b'$$),
  '1', 'Derselbe dritte Zweig wirkt auch in der Autorenliste: der Verfasser '
       'steht dort mit seinem eigenen verdeckten Beitrag');

-- Die scharfe Fassung der Zusage, und der Grund, warum die Einzelzahlen oben
-- nicht genügen: sie prüfen ausgewählte Tags. Hier wird für JEDEN aktiven
-- kuratierten Fixture-Tag die Zahl der Funktion gegen das gehalten, was
-- DERSELBE Aufrufer aus `posts` wirklich aufzählen kann. Kein Zähler darf mehr
-- ausweisen, als sich öffnen lässt, und keiner weniger.
select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000b',
    $$select coalesce(string_agg(tag_key || '=' || post_count, ',' order by tag_key), '(leer)')
        from public.feed_tag_counts() where tag_key like 'sb%'$$),
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000b',
    $$select coalesce(string_agg(t.key || '=' || x.c, ',' order by t.key), '(leer)')
        from public.tags t
        cross join lateral (select count(*) from public.posts p
                             where p.hashtags @> array[t.key]) x(c)
       where t.active and t.key like 'sb%' and x.c > 0$$),
  'basic: jede Zahl der Funktion ist genau die Zahl der Beiträge, die dieser '
  'Aufrufer selbst aufzählen kann');

select is(
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select coalesce(string_agg(tag_key || '=' || post_count, ',' order by tag_key), '(leer)')
        from public.feed_tag_counts() where tag_key like 'sb%'$$),
  pg_temp.text_as('a0000000-0000-0000-0000-00000000000e',
    $$select coalesce(string_agg(t.key || '=' || x.c, ',' order by t.key), '(leer)')
        from public.tags t
        cross join lateral (select count(*) from public.posts p
                             where p.hashtags @> array[t.key]) x(c)
       where t.active and t.key like 'sb%' and x.c > 0$$),
  'exchange: dieselbe Gleichheit auf der anderen Stufe — eine Abschrift ohne '
  'den Rang bestünde die eine oder die andere, nicht beide');

select * from finish();
rollback;
