-- AGE-667 — Ein geplanter Beitrag existiert für Fremde NICHT.
--
-- Vier getrennte Zusagen, nicht eine: der Beitrag darf für einen Fremden weder
-- als ZEILE noch als BILD noch als ZAHL noch über seine KOMMENTARE auftauchen.
-- Sie sind getrennt, weil sie an vier verschiedenen Objekten hängen — zwei
-- Policies und vier SECURITY-DEFINER-Funktionen — und weil eine davon
-- (`post_media_lesbar`) der gefährlichste Posten ist: sie entscheidet, ob ein
-- Bild signiert werden darf. Käme der Zeitpunkt nur in die RLS, wäre der
-- Beitrag unsichtbar und sein Bild trotzdem abrufbar.
--
-- ══ JEDE VERNEINUNG HAT HIER IHRE POSITIVKONTROLLE ═════════════════════════
-- Eine Zusage „der Fremde sieht ihn nicht" ist grün, sobald die Abfrage GAR
-- NICHTS trifft — auch bei einem Tippfehler im Pfad, einer leeren Fixture oder
-- einer Policy, die alles abweist. Deshalb steht neben jeder Verneinung
-- dieselbe Messung an einem SOFORT veröffentlichten Beitrag, die grün sein
-- MUSS. Fällt die Positivkontrolle, misst die Verneinung nichts.
--
-- ══ WARUM DIESE DATEI NEU IST UND NICHT IN `rls_test.sql` STEHT ════════════
-- `rls_test.sql` kodiert die 6-Level-Matrix. Hier geht es um eine Achse, die
-- mit der Stufe nichts zu tun hat — ein `impact`-Mitglied sieht den geplanten
-- Beitrag genauso wenig wie ein `basic`. Beides in eine Datei zu legen hiesse,
-- 437 Zusagen um eine Dimension zu erweitern, die keine von ihnen meint.
--
-- Die Datei MUSS in der Dateiliste in `.github/workflows/ci.yml` stehen, sonst
-- läuft sie nie (AGE-659).

begin;
select plan(31);

-- ── Fixtures (als Superuser-Testrolle → an der RLS vorbei) ───────────────────
insert into auth.users (id, aud, role, email) values
  ('e0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'age667-autor@test.fbc'),
  ('e0000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'age667-fremd@test.fbc');

update public.profiles
   set tier = 'impact', activated_at = now(), created_at = now() - interval '90 days'
 where id in ('e0000000-0000-0000-0000-00000000000a',
              'e0000000-0000-0000-0000-00000000000b');

-- Vier Beiträge desselben Autors. Der Unterschied ist ausschliesslich
-- `veroeffentlicht_ab` — nicht die Sichtbarkeitsstufe, nicht der Autor, nicht
-- der Inhalt. Alles andere gleich zu halten ist der Grund, warum die
-- Positivkontrolle etwas aussagt.
insert into public.posts (id, author_id, body, visibility, veroeffentlicht_ab) values
  ('90000000-0000-0000-0000-00000000000f', 'e0000000-0000-0000-0000-00000000000a',
   'sofort, members', 'members', now() - interval '1 hour'),
  ('90000000-0000-0000-0000-00000000000e', 'e0000000-0000-0000-0000-00000000000a',
   'geplant, members', 'members', now() + interval '7 days'),
  ('90000000-0000-0000-0000-00000000000d', 'e0000000-0000-0000-0000-00000000000a',
   'sofort, public', 'public', now() - interval '1 hour'),
  ('90000000-0000-0000-0000-00000000000c', 'e0000000-0000-0000-0000-00000000000a',
   'geplant, public', 'public', now() + interval '7 days');

insert into public.post_media (post_id, storage_path, sort, width, height) values
  ('90000000-0000-0000-0000-00000000000f', 'e0000000-0000-0000-0000-00000000000a/sofort.jpg', 0, 800, 600),
  ('90000000-0000-0000-0000-00000000000e', 'e0000000-0000-0000-0000-00000000000a/geplant.jpg', 0, 800, 600),
  ('90000000-0000-0000-0000-00000000000d', 'e0000000-0000-0000-0000-00000000000a/sofort-public.jpg', 0, 800, 600),
  ('90000000-0000-0000-0000-00000000000c', 'e0000000-0000-0000-0000-00000000000a/geplant-public.jpg', 0, 800, 600);

-- Ein Kommentar an jedem der beiden `members`-Beiträge. Der am geplanten ist
-- der eigentliche Prüfstein: `comments_select_visible` prüft über eine
-- Unterabfrage auf `posts` — wenn die unter deren RLS läuft, erbt sie die
-- Korrektur von selbst. Das ist zu BELEGEN, nicht anzunehmen.
insert into public.comments (id, post_id, author_id, body) values
  ('c0000000-0000-0000-0000-00000000000f', '90000000-0000-0000-0000-00000000000f',
   'e0000000-0000-0000-0000-00000000000a', 'Kommentar am sofortigen'),
  ('c0000000-0000-0000-0000-00000000000e', '90000000-0000-0000-0000-00000000000e',
   'e0000000-0000-0000-0000-00000000000a', 'Kommentar am geplanten');

-- ── Rollen-Impersonation (Muster aus `rls_test.sql`) ─────────────────────────
create function pg_temp.count_as(uid uuid, q text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into n;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return n;
end $$;

-- Ohne Sitzung: `anon`, und ZWINGEND mit leeren Claims. Bliebe ein `sub`
-- stehen, läse `auth.uid()` ihn weiter und die Messung wäre die eines
-- angemeldeten Mitglieds unter falschem Namen.
create function pg_temp.count_as_anon(q text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  execute q into n;
  reset role;
  return n;
end $$;

-- ── 1. Die ZEILE ────────────────────────────────────────────────────────────
select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000b',
    $$select count(*)::int from public.posts where id = '90000000-0000-0000-0000-00000000000e'$$),
  0, 'Zeile: der Fremde sieht den geplanten Beitrag nicht');

select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000b',
    $$select count(*)::int from public.posts where id = '90000000-0000-0000-0000-00000000000f'$$),
  1, 'Zeile · Positivkontrolle: denselben Beitrag SOFORT veröffentlicht sieht er');

select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000a',
    $$select count(*)::int from public.posts where id = '90000000-0000-0000-0000-00000000000e'$$),
  1, 'Zeile: der VERFASSER sieht seinen geplanten Beitrag');

-- ── 2. Das BILD ─────────────────────────────────────────────────────────────
-- Der gefährlichste Posten: `post_media_lesbar` entscheidet, ob das Objekt
-- signiert werden darf. Ohne den Zeitpunkt hier wäre der Beitrag unsichtbar und
-- sein Bild abrufbar.
select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000b',
    $$select public.post_media_lesbar('e0000000-0000-0000-0000-00000000000a/geplant.jpg')::int$$),
  0, 'Bild: das Bild des geplanten Beitrags ist für den Fremden nicht signierbar');

select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000b',
    $$select public.post_media_lesbar('e0000000-0000-0000-0000-00000000000a/sofort.jpg')::int$$),
  1, 'Bild · Positivkontrolle: das Bild des sofortigen Beitrags ist signierbar');

select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000a',
    $$select public.post_media_lesbar('e0000000-0000-0000-0000-00000000000a/geplant.jpg')::int$$),
  1, 'Bild: der VERFASSER erreicht sein eigenes geplantes Bild');

-- ── 3. Die ZAHL ─────────────────────────────────────────────────────────────
-- Eine Zahl für eine unsichtbare Zeile verrät, dass es die Zeile gibt.
select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000b',
    $$select count(*)::int from public.post_engagement_counts(array['90000000-0000-0000-0000-00000000000e']::uuid[])$$),
  0, 'Zahl: der geplante Beitrag hat für den Fremden keinen Zähler');

select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000b',
    $$select count(*)::int from public.post_engagement_counts(array['90000000-0000-0000-0000-00000000000f']::uuid[])$$),
  1, 'Zahl · Positivkontrolle: der sofortige Beitrag hat einen');

-- ── 4. Die KOMMENTARE ───────────────────────────────────────────────────────
-- Erbt `comments_select_visible` die Korrektur über ihre Unterabfrage auf
-- `posts`? Diese Zusage belegt es, statt es anzunehmen.
select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000b',
    $$select count(*)::int from public.comments where post_id = '90000000-0000-0000-0000-00000000000e'$$),
  0, 'Kommentare: der Fremde erreicht die Kommentare des geplanten Beitrags nicht');

select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000b',
    $$select count(*)::int from public.comments where post_id = '90000000-0000-0000-0000-00000000000f'$$),
  1, 'Kommentare · Positivkontrolle: die des sofortigen erreicht er');

-- `former_member_entries` liest Beiträge ebenfalls und trägt das Prädikat
-- abgeschrieben.
select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000b',
    $$select count(*)::int from public.former_member_entries(array['90000000-0000-0000-0000-00000000000e']::uuid[], '{}'::uuid[])$$),
  0, 'former_member_entries: der geplante Beitrag ist für den Fremden nicht dabei');

select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000b',
    $$select count(*)::int from public.former_member_entries(array['90000000-0000-0000-0000-00000000000f']::uuid[], '{}'::uuid[])$$),
  1, 'former_member_entries · Positivkontrolle: der sofortige ist dabei');

-- ── 5. OHNE SITZUNG ─────────────────────────────────────────────────────────
-- Für `anon` lautet das Prädikat nur `veroeffentlicht_ab <= now()`: ohne
-- Sitzung gibt es keinen Autor, `auth.uid()` ist null. Die Autoren-Ausnahme
-- hier mitzuschreiben wäre wirkungslos, aber irreführend.
select is(
  pg_temp.count_as_anon(
    $$select count(*)::int from public.posts where id = '90000000-0000-0000-0000-00000000000c'$$),
  0, 'anon: der geplante öffentliche Beitrag existiert für den Besucher nicht');

select is(
  pg_temp.count_as_anon(
    $$select count(*)::int from public.posts where id = '90000000-0000-0000-0000-00000000000d'$$),
  1, 'anon · Positivkontrolle: der sofortige öffentliche schon');

select is(
  pg_temp.count_as_anon(
    $$select public.post_media_lesbar('e0000000-0000-0000-0000-00000000000a/geplant-public.jpg')::int$$),
  0, 'anon: das Bild des geplanten öffentlichen Beitrags ist nicht signierbar');

-- ── 6. DIE SPALTE SELBST ────────────────────────────────────────────────────
-- ══ WAS HIER NICHT GEMESSEN WERDEN KANN, UND WARUM ES TROTZDEM DASTEHT ═════
-- Hier stand zuerst eine Zusage „jeder vorhandene Beitrag trägt seinen eigenen
-- `created_at`" als `count(*)` über die GANZE Tabelle. Sie war doppelt falsch:
--
--   * In CI läuft sie gegen eine frische Abbildung mit NULL Beiträgen — sie war
--     dort leer wahr und hätte jede kaputte Migration durchgewunken.
--   * Auf einem benutzten Stack ist sie flackernd: jede fremde Zeile mit einer
--     Planung macht sie rot. Genau so ist sie aufgefallen — an zwei Zeilen aus
--     der eigenen Browser-Sichtprobe.
--
-- Der Rückfüllschritt selbst ist an dieser Stelle GAR NICHT messbar:
-- Migrationen laufen vor dem Seed, es gibt also keine Zeile, die älter wäre als
-- die Spalte. Er ist auf DEV und PROD nach dem Anwenden nachzulesen (F3) —
-- geprüft wird dort `count(*) where veroeffentlicht_ab <> created_at` = 0 und
-- `count(*) where angekuendigt_am is null` = 0.
--
-- Was hier bleibt, ist das, was wirklich messbar ist: die Vorgabe der Spalte.
-- Sie ist die Hälfte, an der die Rückfüllung hängt — ohne `default now()`
-- schlüge schon der erste neue Beitrag fehl.
select is(
  (select is_nullable || '/' || coalesce(column_default, '(keine)')
     from information_schema.columns
    where table_schema = 'public' and table_name = 'posts'
      and column_name = 'veroeffentlicht_ab'),
  'NO/now()',
  'Die Spalte ist not null mit Vorgabe now() — ein `null` als „sofort" gäbe es nicht');

-- Und die Vorgabe WIRKT: eine Zeile ohne die Spalte ist sofort sichtbar. Das
-- ist die Verhaltenshälfte zur Schema-Zusage darüber — ein `default`, das im
-- Katalog steht, aber nie greift, sähe genauso aus.
insert into public.posts (id, author_id, body, visibility)
values ('90000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-00000000000a',
        'ohne Angabe', 'members');

select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000b',
    $$select count(*)::int from public.posts where id = '90000000-0000-0000-0000-00000000000b'$$),
  1, 'Ein Beitrag ohne Angabe ist sofort sichtbar — die Vorgabe greift wirklich');

-- ── 7. DAS SIEBENTE, SCHREIBENDE TOR ────────────────────────────────────────
-- `trg_hinweis_neuer_beitrag` feuert `after insert on posts` und schreibt je
-- aktiviertem Mitglied eine Zeile in `notifications` — Glocke UND Push. Ohne
-- das zweite frühe `return null` hätte ein geplanter Beitrag im Moment des
-- PLANENS alle Telefone erreicht, mit Autorenname, für etwas, das niemand
-- sehen darf. Die Fixtures oben haben ihn bereits eingefügt; hier wird
-- nachgelesen, was dabei entstanden ist.
select is(
  (select count(*)::int from public.notifications
    where type = 'post_created'
      and payload->>'post_id' = '90000000-0000-0000-0000-00000000000e'),
  0, 'Ankündigung: das PLANEN erzeugt keine einzige Hinweiszeile');

select ok(
  (select count(*) from public.notifications
    where type = 'post_created'
      and payload->>'post_id' = '90000000-0000-0000-0000-00000000000f') > 0,
  'Ankündigung · Positivkontrolle: der sofortige Beitrag hat welche erzeugt');

select ok(
  (select angekuendigt_am is null from public.posts
    where id = '90000000-0000-0000-0000-00000000000e'),
  'Ankündigung: der geplante Beitrag steht auf „noch nicht angekündigt"');

select ok(
  (select angekuendigt_am is not null from public.posts
    where id = '90000000-0000-0000-0000-00000000000f'),
  'Ankündigung: der sofortige ist beim Einfügen gestempelt worden');

-- Der Zeitpunkt ist erreicht. `beitrag_ankuendigen()` ist der Lauf, den
-- `cron.schedule` jede Minute anstösst — hier direkt gerufen, weil `pg_cron`
-- im lokalen Stack und in der CI-Abbildung nicht installiert ist. Genau das
-- ist der Grund, warum die FUNKTION in der Migration liegt und nur die
-- ZEITPLANUNG von Hand gesetzt wird: so ist sie messbar.
update public.posts set veroeffentlicht_ab = now() - interval '1 minute'
 where id = '90000000-0000-0000-0000-00000000000e';

select is(
  public.beitrag_ankuendigen(),
  1, 'Lauf: genau ein fälliger Beitrag wird angekündigt');

select ok(
  (select count(*) from public.notifications
    where type = 'post_created'
      and payload->>'post_id' = '90000000-0000-0000-0000-00000000000e') > 0,
  'Lauf: der nun sichtbare Beitrag hat seine Hinweiszeilen bekommen');

-- Die eigentliche Zusage hinter `angekuendigt_am`: der Lauf läuft jede Minute,
-- der Beitrag bleibt danach für immer `veroeffentlicht_ab <= now()`. Ohne den
-- Stempel kündigte er ihn 1440 Mal am Tag erneut an.
select is(
  public.beitrag_ankuendigen(),
  0, 'Lauf: der zweite Durchgang kündigt NICHTS erneut an');

-- ── 8. KEINE ÜBERLADUNG ─────────────────────────────────────────────────────
-- Ein siebter Parameter MIT Vorgabewert hätte in Postgres eine zweite Funktion
-- erzeugt statt die erste zu ersetzen: zwei Signaturen, zwei Grants — und der
-- alte, sechsstellige Weg bliebe offen, ein zweiter Schreibweg, der von
-- `veroeffentlicht_ab` nichts weiss. Deshalb hat der Parameter KEINEN
-- Vorgabewert und die alte Signatur ist gelöscht. Diese Zahl ist der Beleg.
select is(
  (select count(*)::int from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_post_with_media'),
  1, 'Schreibweg: es gibt GENAU EINE create_post_with_media, keine Überladung');

-- ── 8b. DER SCORE VERRÄT IHN NICHT ──────────────────────────────────────────
-- Das achte Tor, gefunden von der Diff-Review. `recompute_potential_score`
-- zählt die eigenen Beiträge in die „Aktivität" (Gewicht 20 %, Sättigung 10) —
-- ohne Zeitfilter höbe ein geplanter Beitrag den Score sofort um rund zwei
-- Punkte, und der Score steht Fremden als Impact-Marke auf der Profilseite.
--
-- Gemessen wird die DIFFERENZ an derselben Zeile, nicht ein absoluter Wert:
-- der Score hängt an fünf Komponenten, und eine feste Zahl hier bräche bei
-- jeder Änderung an einer der anderen vier.
create function pg_temp.score_von(uid uuid) returns int language sql as $$
  select ((public.recompute_potential_score(uid))->>'score')::int
$$;

-- Der Wert VORHER wird FESTGEHALTEN, nicht im selben SELECT mitgelesen.
-- Hier stand zuerst ein Vergleich gegen `profiles.potential_score` — und der
-- ist eine Tautologie: `recompute_potential_score` SCHREIBT diese Spalte, der
-- Vergleich hätte also den frisch geschriebenen Wert mit sich selbst gemessen.
-- Schlimmer noch, die Auswertungsreihenfolge innerhalb eines SELECT ist nicht
-- zugesichert: derselbe Test wäre mal grün, mal rot gewesen.
create temporary table age667_score (phase text primary key, wert int);
insert into age667_score
values ('vorher', pg_temp.score_von('e0000000-0000-0000-0000-00000000000a'));

-- Ein WEITERER geplanter Beitrag darf die Zahl nicht bewegen …
insert into public.posts (id, author_id, body, visibility, veroeffentlicht_ab)
values ('90000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000a',
        'noch einer, geplant', 'members', now() + interval '30 days');

select is(
  pg_temp.score_von('e0000000-0000-0000-0000-00000000000a'),
  (select wert from age667_score where phase = 'vorher'),
  'Score: ein geplanter Beitrag hebt die öffentlich sichtbare Zahl NICHT');

-- … und die Positivkontrolle: derselbe Beitrag veröffentlicht bewegt sie sehr
-- wohl. Ohne sie wäre die Zusage darüber auch grün, wenn die Aktivität gar
-- nicht mehr in den Score einginge.
update public.posts set veroeffentlicht_ab = now() - interval '1 minute'
 where id = '90000000-0000-0000-0000-00000000000a';

select isnt(
  pg_temp.score_von('e0000000-0000-0000-0000-00000000000a'),
  (select wert from age667_score where phase = 'vorher'),
  'Score · Positivkontrolle: derselbe Beitrag veröffentlicht bewegt die Zahl doch');

-- ── 9. DE-PUBLIZIEREN IST ZUGELASSEN ────────────────────────────────────────
-- Sobald `veroeffentlicht_ab` im spaltenweisen UPDATE-Recht steht, kann der
-- Verfasser einen BEREITS SICHTBAREN Beitrag wieder aus der Sicht nehmen. Das
-- ist entschieden und zugelassen — dasselbe wie Löschen, nur reversibel.
--
-- Diese Zusagen stehen hier, damit niemand später annimmt, es sei unmöglich,
-- und beim Nachrüsten einer Sperre die Planung mit abschaltet. Sie messen
-- zugleich, dass das Spalten-Grant wirklich trägt: ohne
-- `veroeffentlicht_ab` in der Liste käme hier `42501`.
create function pg_temp.try_as(uid uuid, q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return 'DENIED:' || SQLERRM;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'OK';
end $$;

select is(
  pg_temp.try_as('e0000000-0000-0000-0000-00000000000a',
    $$update public.posts set veroeffentlicht_ab = now() + interval '7 days'
       where id = '90000000-0000-0000-0000-00000000000f'$$),
  'OK', 'De-Publizieren: der Verfasser darf den Zeitpunkt seines sichtbaren Beitrags verschieben');

-- `try_as` meldet JEDEN Fehler als 'DENIED:' und ein von der RLS gefiltertes
-- UPDATE als 'OK' mit null Zeilen. Ein 'OK' allein belegt hier also nichts —
-- deshalb wird der Wert NACHGELESEN.
select ok(
  (select veroeffentlicht_ab > now() from public.posts
    where id = '90000000-0000-0000-0000-00000000000f'),
  '… und der Wert steht wirklich in der Zeile, nicht nur im Rückgabewert');

select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000b',
    $$select count(*)::int from public.posts where id = '90000000-0000-0000-0000-00000000000f'$$),
  0, 'De-Publizieren: der Fremde sieht den vorher sichtbaren Beitrag nicht mehr');

select is(
  pg_temp.count_as('e0000000-0000-0000-0000-00000000000a',
    $$select count(*)::int from public.posts where id = '90000000-0000-0000-0000-00000000000f'$$),
  1, 'De-Publizieren: der Verfasser sieht ihn weiterhin — er ist zurückgezogen, nicht weg');

select * from finish();
rollback;
