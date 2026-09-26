-- Wer sich anmelden darf, darf auch absagen (AGE-903).
-- Change: openspec/changes/stufen-v5/, Delta `events`.
--
-- Echtes pgTAP mit plan()/finish() — nur solche Dateien stehen im CI-Lauf.
-- Diese Datei ist in ci.yml eingetragen.
--
-- ══ DER WIDERSPRUCH, DEN DIESE DATEI SCHLIESST ══════════════════════════════
-- Gemessen am 25.09., VOR dieser Aenderung, am laufenden Katalog:
--
--   `register_for_event`  public: KEINE Rangpruefung · members: Rang 3 oder Host
--   `regs_write_own`      WITH CHECK: pauschal has_level(4)
--
-- Daraus folgten zwei Luecken, und nur eine davon faellt ins Auge:
--
--   * bei einem `members`-Event konnte sich ein Konto auf Rang 3 anmelden und
--     danach nicht mehr aendern — die schmale Luecke;
--   * bei einem `public`-Event brauchte die Anmeldung GAR KEINEN Rang, das
--     Absagen aber Rang 4. Ein aktiviertes Konto auf Rang 1 konnte sich also
--     anmelden und **nie** wieder abmelden.
--
-- Beide Zahlen auf 4 zu heben schliesst nur die erste: der `public`-Zweig hat in
-- einer pauschalen Rangpruefung ueberhaupt keine Entsprechung. Deshalb SPIEGELT
-- die WITH-CHECK-Klausel jetzt die Bedingung der RPC, statt eine eigene Zahl zu
-- tragen.
--
-- ══ WAS HIER GEMESSEN WIRD ══════════════════════════════════════════════════
--   1. Rang 1 am oeffentlichen Event: anmelden UND absagen. Das ist die Zusage,
--      die vorher gebrochen war, und sie ist die wichtigste der Datei.
--   2. Rang 4 am Mitglieder-Event: anmelden UND absagen — beide Schritte am
--      SELBEN Event, hintereinander. Die Zusage in einem Satz.
--   3. Rang 3 am Mitglieder-Event: schon die Anmeldung scheitert. Es kann also
--      keine Anmeldung geben, die anschliessend haengen bliebe.
--   4. Der Host unter Rang 4 an seinem eigenen Mitglieder-Event: beides. Die
--      Host-Ausnahme muss durch die Spiegelung mitgewandert sein — sie steht in
--      der RPC, und eine pauschale Rangpruefung haette sie verloren.
--
-- ══ FALLEN, DIE DIESE DATEI STELLT ══════════════════════════════════════════
--   * **Ein Absage-Test braucht eine Anmeldung, die es gibt.** Wird die
--     Anmeldung per INSERT vorbereitet statt ueber die RPC, prueft die Datei
--     die Policy gegen eine Zeile, die auf diesem Weg nie entstanden waere.
--     Punkt 2 laeuft deshalb wirklich beide Schritte.
--   * **Ein Fehlschlag der Anmeldung sieht wie ein Fehlschlag der Absage aus.**
--     Jede Absage-Zusage steht deshalb neben der Anmeldung, die sie ermoeglicht,
--     und Punkt 3 sagt ausdruecklich zu, dass dort schon der erste Schritt
--     scheitert.
--   * Der lokale Stack ist geseedet und mit anderen Sitzungen GETEILT — alle
--     Aussagen sind auf die Fixture-Kennungen eingeschraenkt.
--   * `status` und `rating` sind die einzigen Spalten, die `authenticated`
--     schreiben darf (gemessen: `information_schema.column_privileges`). Diese
--     Datei prueft die POLICY, nicht das Spaltenrecht — sie schreibt nur
--     `status`.

begin;
select plan(11);

-- ── Fixtures ────────────────────────────────────────────────────────────────
-- Der `auth.users`-Insert feuert `handle_new_user()`; Stufe und Aktivierung
-- kommen danach. Jede Stufe bekommt ein EIGENES Konto: eine Probe, die aus zwei
-- Gruenden anschlaegt, belegt keinen davon.
insert into auth.users (id, aud, role, email) values
  ('c9000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'v5ab-rang1@test.fbc'),
  ('c9000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'v5ab-rang3@test.fbc'),
  ('c9000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'v5ab-rang4@test.fbc'),
  ('c9000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'v5ab-host@test.fbc');

update public.profiles set tier = 'active',   activated_at = now(), name = 'V5ab Rang1'
 where id = 'c9000000-0000-0000-0000-000000000001';
update public.profiles set tier = 'connect',  activated_at = now(), name = 'V5ab Rang3'
 where id = 'c9000000-0000-0000-0000-000000000003';
update public.profiles set tier = 'discover', activated_at = now(), name = 'V5ab Rang4'
 where id = 'c9000000-0000-0000-0000-000000000004';
-- Der Host steht BEWUSST unter Rang 4 (Rang 1). Stuende er darueber, waere seine
-- Ausnahme von seiner Stufe nicht zu unterscheiden.
update public.profiles set tier = 'active',   activated_at = now(), name = 'V5ab Host'
 where id = 'c9000000-0000-0000-0000-000000000009';

insert into public.events (id, title, starts_at, visibility, capacity, host_id) values
  ('c9e00000-0000-0000-0000-0000000000a1', 'V5ab oeffentlich',
   now() + interval '9 days', 'public',  null, 'c9000000-0000-0000-0000-000000000009'),
  ('c9e00000-0000-0000-0000-0000000000a2', 'V5ab Mitglieder',
   now() + interval '9 days', 'members', null, 'c9000000-0000-0000-0000-000000000009'),
  ('c9e00000-0000-0000-0000-0000000000a3', 'V5ab Host-Event',
   now() + interval '9 days', 'members', null, 'c9000000-0000-0000-0000-000000000009');

-- ── Helfer ──────────────────────────────────────────────────────────────────
-- 'OK', wenn die Anweisung unter der Identitaet durchgeht, sonst
-- 'FEHLER:<sqlstate> <meldung>'. Der SQLSTATE gehoert MIT in die Rueckgabe:
-- ohne ihn ist eine Policy-Ablehnung von einem Tippfehler nicht zu
-- unterscheiden.
create function pg_temp.als(uid uuid, q text) returns text
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return 'FEHLER:' || SQLSTATE || ' ' || SQLERRM;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'OK';
end $$;

/** Die Absage als Anweisung. `format` laeuft als Eigentuemer, VOR der
 *  Impersonierung — `authenticated` hat an `pg_temp` keine Rechte, und der
 *  daraus folgende 42501 saehe aus wie eine Policy-Ablehnung. */
create function pg_temp.absage(wer uuid, event uuid) returns text
language sql as $$
  select format(
    'update public.event_registrations set status = ''cancelled'' '
    'where profile_id = %L::uuid and event_id = %L::uuid', wer, event)
$$;

/** Der Status einer Anmeldung, gelesen OHNE Rolle — die Messung soll nicht
 *  selbst an einer Policy scheitern und das als Befund ausgeben. */
create function pg_temp.stand(wer uuid, event uuid) returns text
language sql as $$
  select coalesce(
    (select status from public.event_registrations
      where profile_id = wer and event_id = event), '(keine Zeile)')
$$;

-- ── 1. Rang 1 am oeffentlichen Event: anmelden UND absagen ──────────────────
-- Die Zusage, die vorher gebrochen war. Vor AGE-903 gelang Schritt 1 und
-- Schritt 2 scheiterte — das Konto sass in seiner Anmeldung fest.
select is(
  pg_temp.als('c9000000-0000-0000-0000-000000000001',
    'select public.register_for_event(''c9e00000-0000-0000-0000-0000000000a1'')'),
  'OK', 'Rang 1 meldet sich zum oeffentlichen Event an');

select is(
  pg_temp.stand('c9000000-0000-0000-0000-000000000001',
                'c9e00000-0000-0000-0000-0000000000a1'),
  'registered', 'Vorbedingung: die Anmeldung steht wirklich');

select is(
  pg_temp.als('c9000000-0000-0000-0000-000000000001',
    pg_temp.absage('c9000000-0000-0000-0000-000000000001',
                   'c9e00000-0000-0000-0000-0000000000a1')),
  'OK', 'Rang 1 sagt dasselbe Event wieder ab — vor AGE-903 war genau das '
        'unmoeglich, und die Anmeldung blieb fuer immer stehen');

select is(
  pg_temp.stand('c9000000-0000-0000-0000-000000000001',
                'c9e00000-0000-0000-0000-0000000000a1'),
  'cancelled', '… und die Absage steht in der Zeile, nicht nur im Rueckgabewert');

-- ── 2. Rang 4 am Mitglieder-Event: beide Schritte, hintereinander ───────────
-- Die Zusage in einem Satz, und sie laeuft beide Schritte wirklich. Eine Absage
-- gegen eine per INSERT vorbereitete Zeile pruefte die Policy gegen eine Zeile,
-- die auf diesem Weg nie entstanden waere.
select is(
  pg_temp.als('c9000000-0000-0000-0000-000000000004',
    'select public.register_for_event(''c9e00000-0000-0000-0000-0000000000a2'')'),
  'OK', 'Rang 4 meldet sich zum Mitglieder-Event an');

select is(
  pg_temp.als('c9000000-0000-0000-0000-000000000004',
    pg_temp.absage('c9000000-0000-0000-0000-000000000004',
                   'c9e00000-0000-0000-0000-0000000000a2')),
  'OK', '… und sagt es wieder ab — beides am selben Event, ohne weitere Bedingung');

select is(
  pg_temp.stand('c9000000-0000-0000-0000-000000000004',
                'c9e00000-0000-0000-0000-0000000000a2'),
  'cancelled', '… und die Absage steht in der Zeile');

-- ── 3. Rang 3 am Mitglieder-Event: schon die Anmeldung scheitert ────────────
-- Damit kann es keine Anmeldung geben, die anschliessend haengen bliebe. Das
-- ist die andere Haelfte von „beides zugleich oder keines von beiden".
select alike(
  pg_temp.als('c9000000-0000-0000-0000-000000000003',
    'select public.register_for_event(''c9e00000-0000-0000-0000-0000000000a2'')'),
  'FEHLER:42501 %membership level too low to register%',
  'Rang 3 kommt am Mitglieder-Event schon bei der Anmeldung nicht durch');

select is(
  pg_temp.stand('c9000000-0000-0000-0000-000000000003',
                'c9e00000-0000-0000-0000-0000000000a2'),
  '(keine Zeile)',
  '… und es entsteht keine Zeile, die es anschliessend nicht mehr aendern duerfte');

-- ── 4. Der Host unter Rang 4 an seinem eigenen Mitglieder-Event ─────────────
-- Die Host-Ausnahme steht in `register_for_event`. Waere die WITH-CHECK-Klausel
-- auf eine pauschale Rangpruefung gehoben worden statt die Bedingung zu
-- spiegeln, haette sie sie verloren — und der Host haette sich zu seinem
-- eigenen Event anmelden koennen, ohne wieder absagen zu duerfen.
select is(
  pg_temp.als('c9000000-0000-0000-0000-000000000009',
    'select public.register_for_event(''c9e00000-0000-0000-0000-0000000000a3'')'),
  'OK', 'Der Host (Rang 1) meldet sich zu seinem eigenen Mitglieder-Event an');

select is(
  pg_temp.als('c9000000-0000-0000-0000-000000000009',
    pg_temp.absage('c9000000-0000-0000-0000-000000000009',
                   'c9e00000-0000-0000-0000-0000000000a3')),
  'OK', '… und sagt es wieder ab — die Host-Ausnahme ist mitgewandert');

select * from finish();
rollback;
