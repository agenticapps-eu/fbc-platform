-- ════════════════════════════════════════════════════════════════════════════
-- AGE-642 — `ota-buendel` und `ota_buendel`: der Speicher des Luftwegs
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/capacitor-huelle/, Phase D1.
-- Migration: supabase/migrations/20260831100000_ota_buendel.sql
--
-- Echtes pgTAP mit plan()/finish(). Diese Datei muss in `ci.yml` eingetragen
-- sein — `supabase test db` ohne Dateiliste laeuft sie nie.
--
-- ══ WAS DIESE DATEI WIRKLICH ABSICHERT ══════════════════════════════════════
-- Nicht „die Tabelle existiert". Die Bedingungen an den Spalten sind Messungen
-- am Quelltext von @capgo/capacitor-updater@8.51.15, und jede von ihnen faengt
-- einen Fehler ab, der SONST ERST AUF DEM GERAET auftraete — und dort still:
-- das Buendel laedt, die Pruefung scheitert, das Geraet bleibt auf der alten
-- Fassung, und kein Log auf unserer Seite sagt warum.
--
-- Die schaerfste ist §10: ein mit einem 4096-Bit-Schluessel gebildetes Chiffrat
-- ist 1024 Hex-Zeichen lang, und das Plugin verlangt 256 Byte = 512 Zeichen
-- (`CryptoCipher.java:254`, `CryptoCipher.swift:74`). Genau dieser Schluessel
-- lag am 31.08. in Infisical. Ohne diese Zusage waere er bis zum ersten
-- Geraetetest unentdeckt geblieben.
--
-- Jede Verneinung hier hat ihre Positivkontrolle: eine Bedingung, die ALLES
-- abweist, waere gruen und wertlos. §6/§7 sind ein solches Paar, §20 ist die
-- Kontrolle zu §19, und §33 ist die zu §32.
--
-- §28–§41 gelten dem LESEWEG (Phase D3, Migration …160000). Die schaerfsten
-- dort sind §32, §35 und §39: die erste haelt fest, dass ein Buendel eine Schale mit
-- zu niedriger Vertragsnummer NICHT erreicht, die zweite, dass der Vergleich
-- zahlenweise ist — als Zeichenkette stuende `10.0.0` vor `9.0.0`, und ein
-- Geraet mit Schale 10.0.0 bekaeme nie ein Buendel, das 9.0.0 verlangt. §39
-- haelt fest, dass die LAUFENDE Fassung die Untergrenze ist — ohne sie waere
-- „das neueste im Manifest" mit „neuer als das, was laeuft" verwechselt.
-- ════════════════════════════════════════════════════════════════════════════

begin;
select plan(41);

-- Impersonierung. Eigene Kopie: jede Testdatei laeuft in ihrer eigenen Sitzung.
-- ACHTUNG: `try_as` meldet JEDEN Fehler als `DENIED:`, auch einen Tippfehler.
-- Deshalb steht neben jeder Anwendung eine Kontrolle, die dieselbe Anweisung
-- ohne RLS ausfuehrt.
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

-- Ein wohlgeformter Satz Werte. Jede Probe unten verbiegt genau einen davon.
-- Die Laengen sind nicht gegriffen: 512 Hex-Zeichen = 256 Byte RSA-2048-Chiffrat,
-- 24 Base64-Zeichen = 16 Byte AES/CBC-IV, 344 = dieselben 256 Byte.
create function pg_temp.iv() returns text language sql immutable as
  $$ select repeat('A', 22) || '==' $$;
create function pg_temp.skey() returns text language sql immutable as
  $$ select repeat('A', 342) || '==' $$;
create function pg_temp.url(v text) returns text language sql immutable as
  $$ select 'https://abcdefghijklmnop.supabase.co/storage/v1/object/public/ota-buendel/' || v || '.bin' $$;

-- ── 1–3. Der Bucket ─────────────────────────────────────────────────────────

select is(
  (select public from storage.buckets where id = 'ota-buendel'),
  true,
  'Bucket ota-buendel ist oeffentlich — im Buendel steht dasselbe dist/, das '
  'Pages ohnehin an jeden ausliefert');

select is(
  (select file_size_limit from storage.buckets where id = 'ota-buendel'),
  8388608::bigint,
  'Bucket ota-buendel begrenzt auf 8 MiB — Fangnetz gegen einen entgleisten '
  'Upload, nicht gegen mitgelieferte Sourcemaps');

select is(
  (select allowed_mime_types from storage.buckets where id = 'ota-buendel'),
  array['application/octet-stream'],
  'Bucket ota-buendel nimmt nur application/octet-stream — es liegt ein '
  'AES-Chiffrat darin, kein Zip');

-- ── 4–5. Warum der Bucket ohne Policy auskommt ──────────────────────────────
-- Die Migration legt bewusst KEINE Policy an. Das ist nur dann richtig, wenn
-- der Veroeffentlichungs-Schritt sowohl die RLS umgeht ALS AUCH die Rechte auf
-- der Tabelle haelt. Beides einzeln — ein RLS-Bypass allein verleiht keine
-- Rechte, und die Zusage waere gruen, waehrend der Upload zur Laufzeit an
-- „permission denied" scheitert (Befund Fremd-Review, MEDIUM).

select is(
  (select rolbypassrls from pg_roles where rolname = 'service_role'),
  true,
  'service_role umgeht RLS — die eine Haelfte der Begruendung, warum '
  'ota-buendel keine Schreib-Policy braucht');

select is(
  (select string_agg(distinct privilege_type, ',' order by privilege_type)
     from information_schema.role_table_grants
    where table_schema = 'storage' and table_name = 'objects'
      and grantee = 'service_role'
      and privilege_type in ('INSERT', 'SELECT', 'UPDATE', 'DELETE')),
  'DELETE,INSERT,SELECT,UPDATE',
  'service_role haelt alle vier Schreib-/Leserechte auf storage.objects — die '
  'andere Haelfte; ohne sie scheitert der Upload erst zur Laufzeit');

-- ── 6–7. Kein Client kann in den Bucket schreiben ───────────────────────────
-- Policies gelten der GEMEINSAMEN Tabelle storage.objects, nicht einem Bucket.
-- Dass diese Migration keine Policy anlegt, heisst also NICHT, dass keine
-- greift — eine bestehende, nicht bucket-gebundene Policy taete es (Befund
-- Fremd-Review, MEDIUM). Deshalb wird es gemessen und nicht gefolgert.
--
-- §6 ist die Kontrolle zu §7: dieselbe Anweisung ohne RLS. Ohne sie waere ein
-- Tippfehler von einer Abweisung nicht zu unterscheiden.

select lives_ok($$
  insert into storage.objects (bucket_id, name) values ('ota-buendel', 'kontrolle.bin')
$$, 'Kontrolle: die Anweisung selbst ist wohlgeformt — ohne RLS geht sie durch');

select alike(
  pg_temp.try_as('dddddddd-0000-0000-0000-00000000000d'::uuid,
    $$insert into storage.objects (bucket_id, name)
      values ('ota-buendel', 'fremd.bin')$$),
  'DENIED:%',
  'ein angemeldeter Client kann NICHT in ota-buendel schreiben — keine Policy '
  'des Bestands greift auf diesen Bucket');

-- ── 8–16. Die Tabelle und die Bedingungen an ihren Spalten ──────────────────

select has_table('public', 'ota_buendel',
  'ota_buendel existiert — ohne diese Zusage waeren die Nullen in §18/§19 auch '
  'bei einem Tippfehler im Tabellennamen gruen');

select lives_ok($$
  insert into public.ota_buendel (version, url, checksum, session_key, benoetigte_schale)
  values ('0.0.0+8fbc49b', pg_temp.url('0.0.0+8fbc49b'),
          repeat('a', 512), pg_temp.iv() || ':' || pg_temp.skey(), '1.0.0')
$$, 'Positivkontrolle: ein wohlgeformtes Buendel wird angenommen — mit den '
    'Laengen, die das Plugin wirklich verlangt');

select throws_ok($$
  insert into public.ota_buendel (version, url, checksum, session_key, benoetigte_schale)
  values ('0.0.0+aaaaaaa', pg_temp.url('a'), repeat('a', 1024),
          pg_temp.iv() || ':' || pg_temp.skey(), '1.0.0')
$$, '23514', null,
  'ein Chiffrat aus einem 4096-Bit-Schluessel (1024 Hex-Zeichen) wird '
  'abgewiesen — das Plugin verlangt 256 Byte, also RSA-2048');

select throws_ok($$
  insert into public.ota_buendel (version, url, checksum, session_key, benoetigte_schale)
  values ('0.0.0+bbbbbbb', pg_temp.url('b'), repeat('a', 512),
          pg_temp.skey(), '1.0.0')
$$, '23514', null,
  'ein sessionKey ohne Doppelpunkt wird abgewiesen — ohne IV haelt das Plugin '
  'die Verschluesselung fuer abgeschaltet und entpackt Chiffrat');

select throws_ok($$
  insert into public.ota_buendel (version, url, checksum, session_key, benoetigte_schale)
  values ('0.0.0+ccccccc', pg_temp.url('c'), repeat('a', 512),
          'aXY=:c2Vzc2lvbktleQ==', '1.0.0')
$$, '23514', null,
  'ein sessionKey der FORM nach richtig, aber mit falschen Laengen wird '
  'abgewiesen — 2-Byte-IV und 10-Byte-Schluessel sind auf dem Geraet unbrauchbar');

select throws_ok($$
  insert into public.ota_buendel (version, url, checksum, session_key, benoetigte_schale)
  values ('0.0.0', pg_temp.url('d'), repeat('a', 512),
          pg_temp.iv() || ':' || pg_temp.skey(), '1.0.0')
$$, '23514', null,
  'eine Fassung ohne +<SHA> wird abgewiesen — zwei Deploys derselben Semver '
  'kollidierten sonst am Primaerschluessel');

select throws_ok($$
  insert into public.ota_buendel (version, url, checksum, session_key, benoetigte_schale)
  values ('01.4.0+eeeeeee', pg_temp.url('e'), repeat('a', 512),
          pg_temp.iv() || ':' || pg_temp.skey(), '1.0.0')
$$, '23514', null,
  'eine fuehrende Null in der Fassung wird abgewiesen — `01.4.0` ist kein '
  'gueltiges Semver');

select throws_ok($$
  insert into public.ota_buendel (version, url, checksum, session_key, benoetigte_schale)
  values ('0.0.0+fffffff', 'https://beliebiger-fremder-host.test/buendel.bin',
          repeat('a', 512), pg_temp.iv() || ':' || pg_temp.skey(), '1.0.0')
$$, '23514', null,
  'eine URL auf einen fremden Host wird abgewiesen — eine Manifest-Zeile darf '
  'Geraete nicht anderswohin schicken');

select throws_ok($$
  insert into public.ota_buendel (version, url, checksum, session_key, benoetigte_schale)
  values ('0.0.0+9999999', pg_temp.url('g'), repeat('a', 512),
          pg_temp.iv() || ':' || pg_temp.skey(), '2')
$$, '23514', null,
  'eine ganzzahlige Vertragsnummer wird abgewiesen — derselbe Wert wird auf '
  'dem Geraet als Semver geparst, und `2` liesse currentVersionNative auf 0.0.0');

-- ── 17–20. Die Tabelle ist fuer Clients unerreichbar ────────────────────────
-- Dieselbe Aussage wie grants_test.sql §4 fuer activation_tokens, und aus
-- demselben Grund ausgeschrieben: eine Abwesenheit ist von einem vergessenen
-- Eintrag nicht zu unterscheiden.

select is(
  (select relrowsecurity from pg_class where oid = 'public.ota_buendel'::regclass),
  true,
  'ota_buendel hat RLS an');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'ota_buendel'),
  0,
  'ota_buendel hat bewusst KEINE Policy — deny-by-default ist hier das Feature');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'ota_buendel'
      and grantee in ('anon', 'authenticated')),
  0,
  'ota_buendel traegt fuer anon/authenticated KEIN einziges Recht — der '
  'Auslieferungsweg ist fuer Clients nicht beschreibbar');

-- Gegenprobe zur Zeile darueber: misst die Abfrage ueberhaupt etwas? Ohne sie
-- waere die Null auch dann gruen, wenn `role_table_grants` hier gar nichts
-- zurueckgibt. `profiles` traegt gemessen SELECT fuer authenticated.
select cmp_ok(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'profiles'
      and grantee in ('anon', 'authenticated')),
  '>', 0,
  'Gegenprobe: dieselbe Abfrage zaehlt auf profiles sehr wohl Rechte');

-- ── 21–26. Der Schreibweg (20260831140000) ──────────────────────────────────
-- Die Tabelle traegt keinen Grant; geschrieben wird ueber genau eine
-- SECURITY-DEFINER-Funktion, die nur service_role ausfuehren darf. Diese sechs
-- Zusagen sind zusammen die Aussage „genau eine Tuer, und sie ist eng".
--
-- §26 ist die wichtigste: eine DEFINER-Funktion umgeht die RLS — sie umgeht
-- aber KEINE CHECK-Bedingung. Ohne diese Zusage waere nicht belegt, dass der
-- Weg, den deploy.yml wirklich nimmt, denselben Pruefungen unterliegt wie ein
-- direkter INSERT.

select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ota_buendel_veroeffentlichen'),
  true,
  'ota_buendel_veroeffentlichen ist security definer — nur so kommt sie an eine '
  'Tabelle, auf der service_role kein Recht haelt');

select is(
  (select has_function_privilege('anon', p.oid, 'execute')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ota_buendel_veroeffentlichen'),
  false,
  'anon darf den Schreibweg NICHT ausfuehren — eine neue Funktion erbt EXECUTE '
  'ueber PUBLIC, der Entzug muss also jede Rolle nennen (AGE-622)');

select is(
  (select has_function_privilege('authenticated', p.oid, 'execute')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ota_buendel_veroeffentlichen'),
  false,
  'authenticated darf den Schreibweg NICHT ausfuehren');

select is(
  (select has_function_privilege('service_role', p.oid, 'execute')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ota_buendel_veroeffentlichen'),
  true,
  'service_role darf ihn ausfuehren — sonst scheitert deploy.yml erst zur '
  'Laufzeit, und zwar nach dem Upload');

-- Wirkung, nicht nur Recht: die Zeile muss danach dastehen, und ein zweiter
-- Aufruf mit derselben Fassung muss sie ERSETZEN statt fehlzuschlagen. Sonst
-- macht ein Re-Run desselben Commits den Deploy rot.
-- Zwei EIGENSTAENDIGE Anweisungen, nicht zwei CTE im selben Statement. Das ist
-- kein Stil: in einem Statement laufen beide gegen denselben Snapshot, und die
-- abschliessende Abfrage sieht KEINE der beiden Zeilen — gemessen, `have: NULL`.
select public.ota_buendel_veroeffentlichen(
  '0.0.0+1111111', pg_temp.url('1'), repeat('a', 512),
  pg_temp.iv() || ':' || pg_temp.skey(), '1.0.0');
select public.ota_buendel_veroeffentlichen(
  '0.0.0+1111111', pg_temp.url('2'), repeat('b', 512),
  pg_temp.iv() || ':' || pg_temp.skey(), '2.0.0');

-- Geprueft werden ALLE vier veraenderlichen Felder, nicht nur url und Schale.
-- checksum und session_key sind die, auf die es ankommt: sie gehoeren zum neu
-- hochgeladenen Chiffrat, und blieben sie stehen, koennte kein Geraet das
-- angebotene Buendel oeffnen (Befund Fremd-Review, MEDIUM).
select is(
  (select count(*)::int || '/' || max(url) || '/' || max(benoetigte_schale)
          || '/' || left(max(checksum), 3) || '/' || left(max(session_key), 24)
     from public.ota_buendel
    where version = '0.0.0+1111111'),
  '1/' || pg_temp.url('2') || '/2.0.0/bbb/' || pg_temp.iv(),
  'zweimal dieselbe Fassung ergibt EINE Zeile, und ALLE vier Felder wandern '
  'mit — auch checksum und session_key, die zum neuen Chiffrat gehoeren');

select throws_ok($$
  select public.ota_buendel_veroeffentlichen(
    '0.0.0+2222222', 'https://abc.supabase.co/storage/v1/object/public/ota-buendel/x.bin',
    repeat('a', 1024), 'AAAAAAAAAAAAAAAAAAAAAA==:' || repeat('A', 342) || '==', '1.0.0')
$$, '23514', null,
  'die CHECK-Bedingungen greifen AUCH auf dem DEFINER-Weg — eine Funktion '
  'umgeht die RLS, nicht die Bedingungen an den Spalten');

-- Eine zweite, andere Verletzung auf demselben Weg. Mit nur einer waere die
-- Zusage darueber auch dann gruen, wenn ALLE anderen Bedingungen fehlten
-- (Befund Fremd-Review, LOW).
select throws_ok($$
  select public.ota_buendel_veroeffentlichen(
    '0.0.0+3333333', 'https://beliebiger-fremder-host.test/buendel.bin',
    repeat('a', 512), 'AAAAAAAAAAAAAAAAAAAAAA==:' || repeat('A', 342) || '==', '1.0.0')
$$, '23514', null,
  'auch die URL-Bindung an den eigenen Bucket greift auf dem DEFINER-Weg');

-- ── 28–38. Der Leseweg (20260831160000) ─────────────────────────────────────
-- Vier Zusagen ueber das RECHT (§28–§31, dieselbe Form wie §21–§24 fuer den
-- Schreibweg) und sieben ueber die WIRKUNG. Die Wirkung ist hier das Eigentliche:
-- diese Funktion ist die einzige Stelle im ganzen Weg, die entscheidet, WELCHES
-- Buendel ein Geraet bekommt. Auf dem Geraet gibt es keine Ordnung, gegen die
-- eine falsche Antwort auffiele — der Vergleich dort ist ein
-- Ungleichheits-Vergleich (`CapacitorUpdaterPlugin.java:4909`, `.swift:4360`),
-- und ein aelteres Buendel wird kommentarlos installiert.

select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ota_buendel_neuestes'),
  true,
  'ota_buendel_neuestes ist security definer — service_role haelt auf '
  'ota_buendel kein SELECT, und rolbypassrls umgeht die RLS, nicht ein '
  'fehlendes Recht');

select is(
  (select has_function_privilege('anon', p.oid, 'execute')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ota_buendel_neuestes'),
  false,
  'anon darf den Leseweg NICHT ausfuehren — er gibt session_key heraus, und '
  'eine neue Funktion erbt EXECUTE ueber PUBLIC (AGE-622)');

select is(
  (select has_function_privilege('authenticated', p.oid, 'execute')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ota_buendel_neuestes'),
  false,
  'authenticated darf den Leseweg NICHT ausfuehren');

select is(
  (select has_function_privilege('service_role', p.oid, 'execute')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ota_buendel_neuestes'),
  true,
  'service_role darf ihn ausfuehren — sonst antwortet ota-update jedem Geraet '
  'mit einem Fehler, und zwar erst zur Laufzeit');

-- Der Bestand aus §25 wird geraeumt: die Wirkungs-Zusagen unten sind Aussagen
-- ueber eine BESTIMMTE Menge, und eine mitgeschleppte Zeile aus dem
-- Schreibweg-Abschnitt machte sie von der Reihenfolge der Abschnitte abhaengig.
delete from public.ota_buendel;

-- `created_at` steht hier AUSDRUECKLICH und kommt nicht aus dem Default.
-- `now()` ist die Zeit der TRANSAKTION, nicht der Anweisung: alle vier Zeilen
-- traegen sonst denselben Zeitstempel, die Ordnung fiele still auf den
-- Tiebreaker zurueck, und §32/§34 waeren gruen, ohne je etwas ueber
-- `order by created_at desc` gesagt zu haben.
--
-- Die Fassungen sind so gewaehlt, dass die alphabetische Ordnung der ZEITLICHEN
-- ENTGEGENLAEUFT: `+ddddddd` ist die aelteste Zeile und die alphabetisch
-- groesste. Eine Umsetzung, die nach `version` statt nach `created_at` ordnet,
-- faellt damit auf — mit gleichlaufenden Fassungen waere sie gruen.
insert into public.ota_buendel (version, url, checksum, session_key, benoetigte_schale, created_at)
values
  ('0.0.0+ddddddd', pg_temp.url('d'), repeat('d', 512),
   pg_temp.iv() || ':' || pg_temp.skey(), '1.0.0', '2026-08-01T00:00:00Z'),
  ('0.0.0+ccccccc', pg_temp.url('c'), repeat('c', 512),
   pg_temp.iv() || ':' || pg_temp.skey(), '2.0.0', '2026-08-02T00:00:00Z'),
  ('0.0.0+bbbbbbb', pg_temp.url('b'), repeat('b', 512),
   pg_temp.iv() || ':' || pg_temp.skey(), '1.0.0', '2026-08-03T00:00:00Z'),
  ('0.0.0+aaaaaaa', pg_temp.url('a'), repeat('a', 512),
   pg_temp.iv() || ':' || pg_temp.skey(), '9.0.0', '2026-08-04T00:00:00Z');

-- `'builtin'` als zweites Argument in §32–§38: so meldet sich ein Geraet, das
-- auf dem Stand aus dem Store laeuft. Der Wert steht im Manifest nicht, es gibt
-- also keine Untergrenze, und die Zusagen unten messen allein die Vertragsnummer
-- und die Ordnung. Die Untergrenze selbst ist §39–§41.

-- §32 — DIE Zusage der Phase. Eine Schale 1.0.0 sieht `+aaaaaaa` (9.0.0, die
-- neueste Zeile ueberhaupt) und `+ccccccc` (2.0.0) NICHT. Was sie bekommt, ist
-- die neueste Zeile, die sie erfuellt.
select is(
  (select version from public.ota_buendel_neuestes('1.0.0', 'builtin')),
  '0.0.0+bbbbbbb',
  'eine Schale 1.0.0 bekommt KEIN Buendel, das eine hoehere Vertragsnummer '
  'verlangt — sonst ruft ausgeliefertes JavaScript eine native Faehigkeit auf, '
  'die auf dem Geraet nicht existiert, und zwar erst beim Aufruf');

-- §33 — die Positivkontrolle zu §32. Dieselben vier Zeilen, hoehere Schale,
-- andere Antwort: die Ausschluesse oben kommen von der Vertragsnummer und nicht
-- daher, dass die Funktion die Zeilen gar nicht saehe.
select is(
  (select version from public.ota_buendel_neuestes('9.0.0', 'builtin')),
  '0.0.0+aaaaaaa',
  'Gegenprobe: eine Schale 9.0.0 bekommt genau die Zeile, die §32 ausschliesst');

-- §34 — geordnet wird nach ZEIT, nicht nach der hoechsten erfuellbaren
-- Vertragsnummer. Eine Schale 2.0.0 koennte `+ccccccc` (2.0.0) nehmen; richtig
-- ist `+bbbbbbb`, weil es neuer ist.
select is(
  (select version from public.ota_buendel_neuestes('2.0.0', 'builtin')),
  '0.0.0+bbbbbbb',
  'geordnet wird nach created_at, nicht nach der hoechsten erfuellbaren '
  'Vertragsnummer — und nicht nach der Fassung, die hier `+ddddddd` waere');

-- §35 — der Vergleich ist zahlenweise. Als Zeichenkette ist '9.0.0' > '10.0.0',
-- die Zeile `+aaaaaaa` fiele also aus der Menge und die Antwort waere
-- `+bbbbbbb`. Genau dieser Fehler bliebe bis zur zehnten Schale unsichtbar.
select is(
  (select version from public.ota_buendel_neuestes('10.0.0', 'builtin')),
  '0.0.0+aaaaaaa',
  'eine Schale 10.0.0 erfuellt 9.0.0 — der Vergleich laeuft ueber int[], ein '
  'Zeichenkettenvergleich stellte 10.0.0 vor 9.0.0');

-- §36/§37 — der Waechter am Eingang. LAUT und nicht leer: eine leere Antwort
-- hiesse fuer das Geraet „alles aktuell" und liesse jede Schale mit
-- missgebildeter Vertragsnummer still auf ihrem Stand stehen.
select throws_ok($$
  select * from public.ota_buendel_neuestes('1.0', 'builtin')
$$, '22023', null,
  'eine missgebildete Vertragsnummer wird abgewiesen, nicht als "nichts '
  'gefunden" beantwortet');

-- Die eigene Zusage fuer NULL, und sie misst etwas anderes als §36: `null !~ '…'`
-- ist NULL und nicht TRUE. Ohne die ausdrueckliche `is null`-Klausel im
-- Waechter liefe dieser Aufruf STILL durch und lieferte null Zeilen.
select throws_ok($$
  select * from public.ota_buendel_neuestes(null, 'builtin')
$$, '22023', null,
  'auch NULL wird abgewiesen — ein `!~` allein faengt es nicht');

-- §38 — die Abbildung der Spalten. `returns table` benennt vier Spalten, und
-- die Edge Function bildet sie eins zu eins auf die Antwortfelder ab. Eine
-- Vertauschung im `select` liefe durch jede Zusage oben hindurch: sie alle
-- lesen nur `version`.
select is(
  (select url || '|' || left(checksum, 3) || '|' || left(session_key, 24)
     from public.ota_buendel_neuestes('1.0.0', 'builtin')),
  pg_temp.url('b') || '|bbb|' || pg_temp.iv(),
  'url, checksum und session_key kommen der richtigen Spalte zugeordnet '
  'zurueck — vertauscht liesse kein Geraet das Buendel oeffnen');

-- ── 39–41. Die laufende Fassung ist die Untergrenze ─────────────────────────
-- Aus dem Fremd-Review zu diesem Diff (HIGH, 31.08.). §32–§35 belegen, dass die
-- Funktion die neueste erfuellbare Zeile im MANIFEST liefert — und das ist
-- nicht dasselbe wie „neuer als das, was auf dem Geraet laeuft". Steht das
-- Geraet weiter vorn als das Manifest, bekaeme es ein aelteres Buendel und
-- installierte es kommentarlos: es vergleicht auf Ungleichheit, nicht auf
-- Groesse.
--
-- Der Bestand ist unveraendert der aus §32: `+ddddddd` (08-01), `+ccccccc`
-- (08-02), `+bbbbbbb` (08-03), `+aaaaaaa` (08-04).

-- §39 — kein Rueckschritt. Die Schale erfuellt 9.0.0, koennte also jede Zeile
-- tragen; sie laeuft aber schon auf `+aaaaaaa`, der juengsten. Es bleibt nichts.
select is(
  (select count(*)::int from public.ota_buendel_neuestes('9.0.0', '0.0.0+aaaaaaa')),
  0,
  'die laufende Fassung ist die Untergrenze — auf der juengsten Zeile bleibt '
  'nichts uebrig, und „nichts Neues" ist eine leere Antwort, kein Sonderfall');

-- §40 — die Positivkontrolle zu §39. Dieselbe Schale, eine AELTERE laufende
-- Fassung: jetzt kommt sehr wohl etwas. Ohne sie waere §39 auch dann gruen,
-- wenn die Funktion mit einer bekannten laufenden Fassung NIE etwas lieferte.
select is(
  (select version from public.ota_buendel_neuestes('9.0.0', '0.0.0+ccccccc')),
  '0.0.0+aaaaaaa',
  'Gegenprobe: von einer aelteren laufenden Fassung aus kommt die juengste '
  'erfuellbare Zeile');

-- §41 — die benannte Luecke, als Zusage statt als Hoffnung. Eine dem Manifest
-- UNBEKANNTE laufende Fassung — `builtin` bei frischer Installation — hat keine
-- Untergrenze und bekommt die juengste erfuellbare Zeile. Genau so gewollt: eine
-- frische Installation SOLL den aktuellen Web-Stand holen.
select is(
  (select version from public.ota_buendel_neuestes('9.0.0', 'gibt-es-nicht')),
  '0.0.0+aaaaaaa',
  'eine unbekannte laufende Fassung setzt keine Untergrenze — fuer `builtin` '
  'ist das gewollt; wer je ein Aufraeumen auf ota_buendel baut, muss diese '
  'Zusage lesen');

select * from finish();
rollback;
