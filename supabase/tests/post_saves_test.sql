-- Gespeicherte Beiträge: `post_saves` als private Liste (AGE-582).
-- Change: openspec/changes/activity-concept-level/, Abschnitt 2.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf; die
-- manuellen probe_*.sql tun es nicht. Diese Datei ist in ci.yml eingetragen.
--
-- ══ WAS HIER GEMESSEN WIRD ═════════════════════════════════════════════════
-- Zwei Zusagen aus der Spezifikation, und beide sind die Art, die man nicht
-- glaubt, sondern misst:
--
--   1. Wer etwas gespeichert hat, ist für NIEMANDEN sonst sichtbar — auch
--      nicht für den Autor des Beitrags und auch nicht als Zahl. Ein Test, der
--      nur „ich sehe meine Zeile" prüft, bliebe grün, während jeder alles
--      sieht. Darum steht neben jeder eigenen Zeile eine FREMDE im Bestand,
--      und die Zusage lautet auf die ZAHL der sichtbaren Zeilen.
--
--   2. Ein nie bestätigtes und ein deaktiviertes Konto kommen nicht heran.
--      Auch das braucht eine fremde Vorlage: für beide Konten liegt eine
--      eigene Zeile im Bestand, die ein Superuser angelegt hat. Ohne sie
--      prüfte „liest nichts" nur eine leere Tabelle.
--
-- ══ FALLEN, DIE DIESES PROJEKT SCHON GESTELLT HAT ══════════════════════════
--   * Ein DELETE, das die RLS nicht durchlässt, ergibt NULL ZEILEN statt
--     `42501`. `try_as()` meldet dafür brav 'OK'. Jede Löschzusage hier lautet
--     deshalb auf den ÜBERLEBENDEN BESTAND, nicht auf einen Fehlercode.
--   * `try_as()` meldet jeden Fehler als 'DENIED:' — für einen zugesicherten
--     Code müsste der SQLSTATE gelesen werden. Hier wird keiner zugesichert.
--   * In pgTAP heisst es `alike()`, nicht `like()`.
--   * Der lokale Stack ist geseedet. Jede Mengenaussage hier ist deshalb auf
--     die Fixture-IDs eingeschränkt und nie auf `count(*)` der ganzen Tabelle.

begin;
select plan(31);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Der auth.users-Insert feuert handle_new_user() und legt public.profiles an.
insert into auth.users (id, aud, role, email) values
  ('5a000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'sp-eigner@test.fbc'),
  ('5a000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sp-fremd@test.fbc'),
  ('5a000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'sp-unbestaetigt@test.fbc'),
  ('5a000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'sp-deaktiviert@test.fbc');

-- Alle auf `impact`: hinter dem Aktivierungs-Gate liegt bei importierten
-- Mitgliedern kein Stufen-Gate mehr, das einen Fehler noch auffinge. Ein
-- `basic`-Konto sähe vieles schon wegen der Stufe nicht und täuschte ein Gate
-- vor, das gar nicht greift.
update public.profiles set tier = 'impact', name = 'Sp Eigner',   activated_at = now()
 where id = '5a000000-0000-0000-0000-000000000001';
update public.profiles set tier = 'impact', name = 'Sp Fremd',    activated_at = now()
 where id = '5a000000-0000-0000-0000-000000000002';
-- Nie bestätigt: `activated_at` bleibt bewusst null.
update public.profiles set tier = 'impact', name = 'Sp Unbestaetigt'
 where id = '5a000000-0000-0000-0000-000000000003';
-- Bestätigt UND wieder deaktiviert — der zweite Weg, an dem `is_activated()`
-- fällt. Er ist der wichtigere: eine Prüfung, die nur `activated_at` liest,
-- bliebe hier grün.
update public.profiles set tier = 'impact', name = 'Sp Deaktiviert',
       activated_at = now(), disabled_at = now()
 where id = '5a000000-0000-0000-0000-000000000004';

insert into public.posts (id, author_id, body, visibility) values
  ('5b000000-0000-0000-0000-0000000000aa', '5a000000-0000-0000-0000-000000000002',
   'Ein Beitrag, den zwei Mitglieder speichern.', 'public');

-- ── Helfer (Muster aus rls_test.sql) ────────────────────────────────────────
create function pg_temp.count_as(uid uuid, q text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute q into n;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return n;
end $$;

-- try_as: 'OK' wenn die Anweisung unter der Identität durchgeht, sonst
-- 'DENIED:<err>'. Siehe Kopf: bei DELETE sagt 'OK' NICHTS über die Wirkung.
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

-- ── 1. Gestalt der Tabelle ──────────────────────────────────────────────────
select has_table('public', 'post_saves', 'Die Tabelle post_saves existiert');

select col_is_pk(
  'public', 'post_saves', array['profile_id', 'post_id'],
  'Der Primärschlüssel liegt auf (profile_id, post_id) — die Eindeutigkeit '
  'trägt der Schlüssel, nicht die Anwendungslogik');

select is(
  (select relrowsecurity from pg_class
    where oid = 'public.post_saves'::regclass),
  true, 'RLS ist auf post_saves eingeschaltet');

-- `confdeltype = 'c'` ist ON DELETE CASCADE. Eine gespeicherte Zeile ohne
-- Beitrag oder ohne Profil ist kein Datum, sondern Müll.
select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.post_saves'::regclass
      and contype = 'f' and confdeltype = 'c'),
  2, 'Beide Fremdschlüssel löschen kaskadierend');

-- ── 2. Der Eigner speichert ─────────────────────────────────────────────────
select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000001',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000001',
              '5b000000-0000-0000-0000-0000000000aa')$$),
  'OK', 'Ein bestätigtes Mitglied speichert einen Beitrag für sich');

-- Der zweite Versuch darf an der Oberfläche nicht scheitern — genau so ruft
-- ihn die Datenschicht (Abschnitt 5) auf.
select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000001',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000001',
              '5b000000-0000-0000-0000-0000000000aa')
      on conflict do nothing$$),
  'OK', 'Zweimal speichern scheitert nicht');

select is(
  (select count(*)::int from public.post_saves
    where profile_id = '5a000000-0000-0000-0000-000000000001'
      and post_id    = '5b000000-0000-0000-0000-0000000000aa'),
  1, 'Zweimal speichern ergibt genau EINE Zeile');

-- ── 3. Fremde Speicherungen bleiben unsichtbar ──────────────────────────────
-- `Sp Fremd` ist der AUTOR des Beitrags. Wenn irgendjemand die fremde Zeile
-- sehen dürfte, dann er — die Spezifikation sagt ausdrücklich: auch er nicht.
select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000002',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000002',
              '5b000000-0000-0000-0000-0000000000aa')$$),
  'OK', 'Der Autor speichert seinen eigenen Beitrag ebenfalls');

select is(
  pg_temp.count_as('5a000000-0000-0000-0000-000000000001',
    $$select count(*)::int from public.post_saves
       where post_id = '5b000000-0000-0000-0000-0000000000aa'$$),
  1, 'Der Eigner sieht zu diesem Beitrag genau EINE Zeile — seine, nicht zwei');

select is(
  pg_temp.count_as('5a000000-0000-0000-0000-000000000002',
    $$select count(*)::int from public.post_saves
       where post_id = '5b000000-0000-0000-0000-0000000000aa'$$),
  1, 'Auch der Autor des Beitrags sieht nur seine eigene Zeile');

-- Ein DELETE ohne Treffer meldet KEINEN Fehler (siehe Kopf). Die Zusage lautet
-- deshalb auf den Bestand.
select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000001',
    $$delete from public.post_saves
       where profile_id = '5a000000-0000-0000-0000-000000000002'$$),
  'OK', 'Das Löschen einer fremden Zeile meldet keinen Fehler — die RLS lässt '
        'es nur ins Leere laufen');

select is(
  (select count(*)::int from public.post_saves
    where profile_id = '5a000000-0000-0000-0000-000000000002'),
  1, 'Die fremde Zeile besteht nach dem Löschversuch weiter');

select alike(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000001',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000002',
              '5b000000-0000-0000-0000-0000000000aa')$$),
  'DENIED:%', 'Niemand legt eine Zeile auf fremden Namen an');

-- ── 4. Kein Änderungsweg ────────────────────────────────────────────────────
-- Es gibt SELECT, INSERT und DELETE — sonst nichts. Die Zusage liegt bewusst
-- auf der RLS und nicht nur am Grant: dieses Projekt hat schon einmal Rechte
-- geerbt, die niemand ausgesprochen hatte (AGE-312). Fehlt die UPDATE-Policy,
-- bleibt die Tabelle auch dann unveränderlich, wenn ein Grant zurückkehrt.
select is(
  (select string_agg(cmd::text, ',' order by cmd::text) from pg_policies
    where schemaname = 'public' and tablename = 'post_saves'),
  'DELETE,INSERT,SELECT',
  'Genau drei Policies: SELECT, INSERT, DELETE — kein UPDATE, kein ALL');

-- ── 5. Ein unbestätigtes Konto kommt nicht heran ────────────────────────────
-- Die Vorlage legt ein Superuser an: „liest nichts" über einer leeren Tabelle
-- wäre keine Messung.
insert into public.post_saves (profile_id, post_id) values
  ('5a000000-0000-0000-0000-000000000003', '5b000000-0000-0000-0000-0000000000aa'),
  ('5a000000-0000-0000-0000-000000000004', '5b000000-0000-0000-0000-0000000000aa');

select is(
  pg_temp.count_as('5a000000-0000-0000-0000-000000000003',
    $$select count(*)::int from public.post_saves$$),
  0, 'Ein unbestätigtes Konto liest nicht einmal die eigene Zeile');

select alike(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000003',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000003',
              '5b000000-0000-0000-0000-0000000000aa')
      on conflict do nothing$$),
  'DENIED:%', 'Ein unbestätigtes Konto speichert nicht');

select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000003',
    $$delete from public.post_saves
       where profile_id = '5a000000-0000-0000-0000-000000000003'$$),
  'OK', 'Der Löschversuch eines unbestätigtes Kontos meldet keinen Fehler');

select is(
  (select count(*)::int from public.post_saves
    where profile_id = '5a000000-0000-0000-0000-000000000003'),
  1, 'Ein unbestätigtes Konto löscht auch die eigene Zeile nicht');

-- ── 6. Ein deaktiviertes Konto kommt nicht heran ────────────────────────────
select is(
  pg_temp.count_as('5a000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.post_saves$$),
  0, 'Ein deaktiviertes Konto liest nicht einmal die eigene Zeile');

select alike(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000004',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000004',
              '5b000000-0000-0000-0000-0000000000aa')
      on conflict do nothing$$),
  'DENIED:%', 'Ein deaktiviertes Konto speichert nicht');

select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000004',
    $$delete from public.post_saves
       where profile_id = '5a000000-0000-0000-0000-000000000004'$$),
  'OK', 'Der Löschversuch eines deaktiviertes Kontos meldet keinen Fehler');

select is(
  (select count(*)::int from public.post_saves
    where profile_id = '5a000000-0000-0000-0000-000000000004'),
  1, 'Ein deaktiviertes Konto löscht auch die eigene Zeile nicht');

-- ── 7. Lösen ────────────────────────────────────────────────────────────────
-- Zuletzt, weil es den Bestand abräumt, auf den die Zusagen oben lauten.
select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000001',
    $$delete from public.post_saves
       where profile_id = '5a000000-0000-0000-0000-000000000001'$$),
  'OK', 'Der Eigner löst seine eigene Speicherung');

select is(
  (select count(*)::int from public.post_saves
    where profile_id = '5a000000-0000-0000-0000-000000000001'),
  0, 'Danach ist die Zeile wirklich fort');

-- ── 8. Kein Existenz-Orakel (7.8, Befund codex MEDIUM) ─────────────────────
-- Der Befund lag nicht in der Policy, sondern im FREMDSCHLÜSSEL: dessen Prüfung
-- läuft ausdrücklich an der RLS vorbei. Die alte `post_saves_insert_own` fragte
-- nur, WER schreibt, nie WORAUF. Ein unsichtbarer, aber vorhandener Beitrag
-- liess sich also speichern, ein nicht vorhandener brach mit `23503` — zwei
-- verschiedene Antworten auf dieselbe Frage, und damit eine Auskunft über einen
-- Bestand, den der Aufrufer nicht sehen darf.
--
-- Die Zusage ist deshalb NICHT „unsichtbares Speichern wird abgelehnt". Das
-- allein wäre mit dem Orakel vereinbar, solange die Ablehnungen sich
-- unterscheiden. Die Zusage ist, dass beide Wege in DERSELBEN Ablehnung enden.

-- AGE-601 HAT DIE VORBEDINGUNG DIESES ABSCHNITTS ENTZOGEN, und das gehoert
-- ausgesprochen statt still umgangen: seit `members` jedes AKTIVIERTE Mitglied
-- meint, gibt es fuer einen aktivierten Aufrufer keinen „vorhanden, aber
-- unsichtbar"-Beitrag mehr. Beide zulaessigen Sichtbarkeiten (`public`,
-- `members`) sind fuer ihn lesbar. Ein `basic`-Betrachter taugt hier also nicht
-- mehr als Ausgesperrter.
--
-- Der Fall verschwindet damit NICHT — er wandert an die Aktivierung. Fuer ein
-- nicht aktiviertes Konto existieren Beitraege weiterhin und sind weiterhin
-- unsichtbar, und genau dort muss das Orakel zu bleiben. Traeger ist jetzt
-- `Sp Deaktiviert` (bestaetigt UND wieder deaktiviert) — laut dem Kommentar
-- oben der wichtigere der beiden Wege, an denen `is_activated()` faellt.
--
-- EHRLICH ZUR ABDECKUNG: die Ablehnung kommt fuer dieses Konto aus dem
-- `is_activated()`-Konjunkt, nicht aus dem `exists`-Konjunkt. Beobachtbar ist
-- dieselbe Zusage — zwei ununterscheidbare Antworten —, aber der `exists`-Zweig
-- wird dadurch nicht mehr durchlaufen. Damit ihn niemand als ueberfluessig
-- streicht, steht er unten als eigener Wortlaut-Waechter.

insert into public.posts (id, author_id, body, visibility) values
  ('5b000000-0000-0000-0000-0000000000cc', '5a000000-0000-0000-0000-000000000002',
   'Nur fuer Mitglieder — fuer ein nicht aktiviertes Konto unsichtbar.', 'members');

select is(
  pg_temp.count_as('5a000000-0000-0000-0000-000000000004',
    $$select count(*)::int from public.posts
       where id = '5b000000-0000-0000-0000-0000000000cc'$$),
  0, 'Vorbedingung: das nicht aktivierte Konto sieht diesen Beitrag nicht');

-- Gegenprobe zur Vorbedingung: ein AKTIVIERTES Konto sieht ihn sehr wohl. Ohne
-- sie belegte die Null oben nur, dass die Abfrage nichts findet — etwa weil der
-- Beitrag gar nicht angelegt wurde.
select is(
  pg_temp.count_as('5a000000-0000-0000-0000-000000000001',
    $$select count(*)::int from public.posts
       where id = '5b000000-0000-0000-0000-0000000000cc'$$),
  1, 'Gegenprobe: ein aktiviertes Konto sieht ihn (AGE-601 — ohne Stufenschwelle)');

select alike(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000004',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000004',
              '5b000000-0000-0000-0000-0000000000cc')$$),
  'DENIED:%row-level security%',
  'Ein unsichtbarer Beitrag laesst sich nicht speichern — und die Ablehnung '
  'kommt aus der Policy, nicht aus dem Fremdschluessel');

select alike(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000004',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000004',
              '5b000000-0000-0000-0000-0000000000ff')$$),
  'DENIED:%row-level security%',
  'Eine Kennung, die es gar nicht gibt, wird GENAUSO abgelehnt — kein 23503, '
  'also kein Unterschied, aus dem sich die Existenz ablesen liesse');

-- Der Kern in einer Zusage: die beiden Antworten sind ZEICHENGLEICH. Sie
-- einzeln auf ein Muster zu prüfen liesse zwei verschiedene Meldungen zu, die
-- beide „row-level security" enthalten — und schon das waere wieder ein Kanal.
select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000004',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000004',
              '5b000000-0000-0000-0000-0000000000cc')$$),
  pg_temp.try_as('5a000000-0000-0000-0000-000000000004',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000004',
              '5b000000-0000-0000-0000-0000000000ff')$$),
  'Vorhanden-aber-unsichtbar und gar-nicht-vorhanden liefern dieselbe '
  'Zeichenkette — das Orakel ist zu');

-- WAECHTER UEBER DEN `exists`-KONJUNKT (AGE-601).
-- Er wird von den Zusagen oben nicht mehr durchlaufen, seit die Ablehnung an
-- `is_activated()` faellt. Ohne diesen Waechter koennte ihn jemand als
-- „unerreichbar, also tot" streichen — und das Orakel waere in dem Moment
-- wieder offen, in dem die Sichtbarkeit sich erneut verengt. Bricht er, ist das
-- die Aufforderung, die Abdeckung oben zu pruefen, nicht ihn anzupassen.
select matches(
  (select pg_get_expr(polwithcheck, polrelid) from pg_policy
    where polrelid = 'public.post_saves'::regclass
      and polname = 'post_saves_insert_own'),
  'EXISTS \( SELECT 1.*FROM posts',
  'post_saves_insert_own fragt weiterhin WORAUF geschrieben wird, nicht nur WER');

-- Die Gegenprobe zur Verschaerfung: ein SICHTBARER Beitrag bleibt speicherbar.
-- Ohne sie waere die Zusage oben auch mit einer Policy vereinbar, die einfach
-- gar nichts mehr durchlaesst.
select is(
  pg_temp.try_as('5a000000-0000-0000-0000-000000000001',
    $$insert into public.post_saves (profile_id, post_id)
      values ('5a000000-0000-0000-0000-000000000001',
              '5b000000-0000-0000-0000-0000000000cc')$$),
  'OK', 'Ein AKTIVIERTES Konto speichert denselben members-Beitrag sehr wohl — '
        'die Policy laesst nicht einfach gar nichts mehr durch');

select * from finish();
rollback;
