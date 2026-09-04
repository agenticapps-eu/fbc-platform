-- Anmeldungen halten sich an die Kapazität, egal auf welchem Weg (AGE-605).
--
-- ══ DER BEFUND ══════════════════════════════════════════════════════════════
-- Zwei Regeln der Event-Anmeldung standen ausschliesslich in SECURITY-DEFINER-
-- RPCs, und daneben lag ein Weg, der nicht durch sie führte:
--
--   register_for_event   sperrt die Event-Zeile, zählt, vergibt registered
--                        oder waitlist  →  keine Überbuchung
--   set_event_check_in   schreibt checked_in nur für den HOST des Events
--
-- `regs_write_own` war `for all to authenticated` auf der eigenen Zeile und
-- prüfte nur: aktiviert, eigene Zeile, Stufe >= 4, Event existiert. Weder die
-- Kapazität noch der Anwesenheitsstatus. `status` und `checked_in` sind
-- gewöhnliche Spalten — ein selbstgebauter PostgREST-Request umging damit beide
-- Regeln. VIER Wege, alle in der Planungs-Review benannt und mit Proben belegt:
--
--   A  INSERT mit status = 'registered' an der Kapazität vorbei
--   B  UPDATE waitlist -> registered
--   C  UPDATE checked_in = true (Selbst-Einchecken)
--   D  UPDATE event_id — die eigene registered-Zeile auf ein volles Event
--      umhängen; der Status bleibt registered, eine Übergangsregel sähe nichts
--
-- ══ WAS HIER PASSIERT, UND WARUM IN DIESER FORM ═════════════════════════════
--
-- 1. RECHTE statt nur Policy. `checked_in` wird über ein SPALTENRECHT entzogen,
--    nicht über eine `with check`-Bedingung. Ein Recht ist eine Aussage über die
--    Spalte und trägt auch dann, wenn jemand die Policy später weiter fasst.
--    Die Form ist dabei NICHT beliebig: ein `revoke update (checked_in)` allein
--    wäre wirkungslos, solange das tabellenweite UPDATE-Recht besteht. Deshalb
--    erst das Tabellenrecht entziehen, dann genau die erlaubten Spalten zurück.
--
-- 2. Der TRIGGER hat ZWEI SCHICHTEN, und die untere kennt keine Rollen.
--    Schicht 1 prüft die Kapazitätsinvariante für JEDEN Weg, die RPC
--    eingeschlossen — sie hängt an keiner Annahme darüber, wer schreibt.
--    Schicht 2 sperrt den direkten Statuswechsel und ist als AUSSCHLUSS
--    formuliert (alles ausser dem Eigentümer), damit eine unbekannte oder
--    künftige Rolle GESPERRT und nicht durchgelassen wird.
--
--    Die erste Fassung des Entwurfs prüfte `current_user = 'authenticated'`.
--    Das wäre fail-OPEN gewesen: jede andere Rolle wäre daran vorbeigelaufen.
--    Beide Planungs-Reviewer haben es gefunden.
--
-- 3. `register_for_event` IST EIN UPSERT, und das ist der teuerste Fallstrick
--    dieses Changes:
--
--      insert into public.event_registrations (event_id, profile_id, status)
--      values (...) on conflict (event_id, profile_id)
--        do update set status = excluded.status;
--
--    Eine Wiederanmeldung nach dem Absagen läuft also über den UPDATE-Zweig —
--    genau dort, wo dieser Trigger feuert. Ein Trigger, der diesen Weg
--    mitsperrt, bräche die Wiederanmeldung, während eine Probe, die nur den
--    INSERT-Zweig prüft, grün bliebe. Deshalb lässt Schicht 2 den Eigentümer
--    durch, und die Abnahme prüft `cancelled -> registered` UND
--    `waitlist -> registered` ÜBER DIE RPC.
--
-- ══ WAS DAS NICHT LEISTET ═══════════════════════════════════════════════════
-- Ein GASTGEBER kann `events.capacity` weiterhin unter die bestehende Belegung
-- senken; `updateEvent` schreibt das Feld regulär. Das ist ein anderer
-- Handelnder und ein anderer Vorgang. Die Zusage lautet deshalb ausdrücklich
-- „neue Anmeldungen und Statuswechsel erzeugen keine Überbuchung" und nicht
-- „ein Event ist nie überbucht".
--
-- Belegt in supabase/tests/anmeldung_rpc_exklusiv_test.sql. DIESE DATEI MUSS IN
-- .github/workflows/ci.yml STEHEN — eine pgTAP-Datei mit plan() ist kein Beleg
-- dafür, dass sie irgendwo läuft.

-- ── 1. Die Policy: UPDATE ja, INSERT und DELETE nein ────────────────────────
-- `using` und `with check` bleiben inhaltlich unverändert; nur `for all` wird zu
-- `for update`. Ein Mitglied legt keine Anmeldezeile mehr selbst an — das tut
-- `register_for_event`, und nur dort steht die Kapazitätsprüfung. Gelöscht wird
-- eine Anmeldung nie: sie wird abgesagt, die Zeile trägt die Geschichte. Wer
-- löschen kann, umgeht ausserdem `unique (event_id, profile_id)`.
drop policy if exists regs_write_own on public.event_registrations;
create policy regs_write_own on public.event_registrations
  for update to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check (
    public.is_activated()
    and profile_id = (select auth.uid())
    and public.has_level(4)
    and exists (select 1 from public.events e where e.id = event_registrations.event_id)
  );

comment on policy regs_write_own on public.event_registrations is
  'AGE-605: nur UPDATE. INSERT laeuft ueber register_for_event (dort sitzt die '
  'Kapazitaetspruefung), DELETE gibt es nicht (abgesagt wird per status). '
  'WELCHE SPALTEN geschrieben werden duerfen, sagt das Spaltenrecht unten, '
  'nicht diese Bedingung.';

-- ── 2. Spaltenrechte ────────────────────────────────────────────────────────
-- Reihenfolge ist tragend: erst das Tabellenrecht weg, dann die erlaubten
-- Spalten zurück. `revoke update (checked_in)` allein wäre ein No-op.
--
-- Nicht in der Liste und damit gesperrt: `checked_in` (gehört dem Host),
-- `event_id` (Weg D), `profile_id`, `id`, `created_at`.
revoke update on public.event_registrations from authenticated;
grant update (status, rating) on public.event_registrations to authenticated;

-- INSERT und DELETE auch auf Rechte-Ebene, nicht nur ueber die Policy. Sonst
-- stuende bei `checked_in` die Begruendung „ein Recht traegt auch dann, wenn
-- jemand die Policy lockert" — und derselbe Schutz hinge hier an einer Policy.
revoke insert, delete on public.event_registrations from authenticated;

-- ── 3. Der Trigger ──────────────────────────────────────────────────────────
create or replace function public.event_registrations_wache()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_capacity int;
  v_belegt   int;
  v_eigner   name := (
    select pg_get_userbyid(p.proowner)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'register_for_event'
     limit 1
  );
begin
  -- ── Schicht 2: Exklusivitaet, als AUSSCHLUSS formuliert ───────────────────
  -- Nur beim UPDATE, und nur wenn sich der Status in Richtung eines belegten
  -- Platzes bewegt. `cancelled` und `rating` bleiben dem Mitglied.
  --
  -- `current_user <> v_eigner` statt `= 'authenticated'`: so ist eine
  -- unbekannte oder kuenftige Rolle GESPERRT und nicht durchgelassen.
  if tg_op = 'UPDATE'
     and new.status in ('registered', 'waitlist')
     and new.status is distinct from old.status
     and current_user <> v_eigner
  then
    raise exception 'registration status is set by register_for_event, not directly'
      using errcode = '42501';
  end if;

  -- ── Schicht 1: die Invariante, rollenunabhaengig ──────────────────────────
  -- Gilt fuer JEDEN Weg, die RPC eingeschlossen. Sie ist fuer die RPC ein Netz
  -- und kein Hindernis: die zaehlt vorher unter Zeilensperre und setzt
  -- `waitlist`, sobald die Kapazitaet erreicht ist.
  if new.status = 'registered'
     and (tg_op = 'INSERT' or old.status is distinct from 'registered')
  then
    select e.capacity into v_capacity
      from public.events e where e.id = new.event_id;

    if v_capacity is not null then
      select count(*) into v_belegt
        from public.event_registrations r
       where r.event_id = new.event_id
         and r.status = 'registered'
         and r.id <> new.id;

      if v_belegt >= v_capacity then
        raise exception 'event is at capacity' using errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.event_registrations_wache() is
  'AGE-605. Zwei Schichten: (1) die Kapazitaetsinvariante rollenunabhaengig fuer '
  'jeden Weg nach status=registered, (2) der direkte Statuswechsel nur fuer den '
  'Eigentuemer von register_for_event, als AUSSCHLUSS formuliert damit eine '
  'unbekannte Rolle gesperrt und nicht durchgelassen wird. Schicht 1 haelt die '
  'Zusage auch dann, wenn die Annahme aus Schicht 2 ueber Eigentuemer oder '
  'SECURITY DEFINER eines Tages nicht mehr stimmt.';

-- Neue Funktionen bekommen EXECUTE ueber PUBLIC. Ohne diesen Entzug wird die
-- geschlossene Funktionsliste in grants_test.sql rot — und zwar zu Recht.
revoke execute on function public.event_registrations_wache()
  from public, anon, authenticated, service_role;

drop trigger if exists event_registrations_wache on public.event_registrations;
create trigger event_registrations_wache
  before insert or update on public.event_registrations
  for each row execute function public.event_registrations_wache();
