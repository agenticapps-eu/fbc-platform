-- Event-Vorlagen und Serientermine (AGE-630), die Serienänderung.
--
-- ══ WAS SICH AENDERT ════════════════════════════════════════════════════════
-- `event_serie_erzeugen()` bekommt einen Aktualisierungsschritt VOR dem
-- Einfuegen. D7:
--
--   Eine erneute Erzeugung aktualisiert Termine derselben Vorlage, die IN DER
--   ZUKUNFT liegen und KEINE ANMELDUNGEN tragen, auf die aktuellen Werte der
--   Vorlage. Termine mit Anmeldungen und alle vergangenen bleiben unangetastet.
--
-- Das ist die Erwartung des Hosts („ab jetzt eine Stunde spaeter") ohne den
-- Preis, Mitgliedern unter der Anmeldung den Termin zu verschieben. Die erste
-- Fassung des Plans behandelte das Aendern einer Vorlage gar nicht — der
-- zweithaeufigste reale Serienvorgang; der Befund kam aus der Plan-Review.
--
-- ══ WARUM DAS KEINEN ZWEITEN TERMIN ERZEUGT ═════════════════════════════════
-- `starts_at` wird aus `slot_datum` NEU BERECHNET, nicht verschoben:
-- `(slot_datum + ortszeit) at time zone zeitzone`. Der Slot bleibt derselbe,
-- die Zeile bleibt dieselbe, und das anschliessende Einfuegen laeuft fuer
-- diesen Slot in `on conflict do nothing`. Bei 19:00 -> 20:00 steht deshalb
-- KEIN 19:00-Termin derselben Woche daneben.
--
-- ══ EINE FOLGE, DIE GEMESSEN IST STATT ABGELEITET ═══════════════════════════
-- Ein vom Host VERSCHOBENER, anmeldungsfreier Zukunftstermin wird dadurch auf
-- seinen Slot zurueckgeholt. Das folgt zwingend aus D7 und widerspricht der
-- Zusage „ein verschobener Termin kehrt nicht zurueck" nicht: die verbietet
-- einen ZWEITEN Termin auf demselben Slot, nicht das Aktualisieren des
-- vorhandenen. `event_serie_aenderung_test.sql` misst es, damit es niemand
-- fuer ein Versehen haelt.
--
-- ══ WORAUF DIE ANMELDUNGSPRUEFUNG RUHT — BITTE LESEN ════════════════════════
-- `not exists (select 1 from event_registrations ...)` laeuft unter der Rolle
-- des Aufrufers, also UNTER RLS. Sie traegt nur, weil `regs_select_self_or_host`
-- dem Host die Anmeldungen SEINER Events zeigt. Wuerde diese Policy je auf
-- „nur die eigene Anmeldung" verengt, saehe die Funktion an einem ausgebuchten
-- Termin null Zeilen und schoebe ihn — lautlos, Mitgliedern unter der
-- Anmeldung weg.
--
-- Der Waechter dagegen ist die Zusage „der zukuenftige Termin MIT Anmeldung
-- bleibt auf 19:00" in `event_serie_aenderung_test.sql`. Wer jene Policy
-- anfasst, sieht sie rot.
--
-- Forward-only. Ersetzt den Rumpf aus 20260907093000; die Signatur ist
-- unveraendert.

create or replace function public.event_serie_erzeugen(
  p_vorlage_id uuid,
  p_ab         date,
  p_anzahl     int  default null,
  p_bis_datum  date default null
) returns setof public.events
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v        public.event_vorlagen;
  v_anzahl int;
begin
  -- Kein Treffer heisst hier BEIDES: es gibt sie nicht, oder sie gehoert
  -- jemand anderem und die RLS zeigt sie nicht. Genau richtig so — die
  -- Unterscheidung waere selbst eine Auskunft.
  select * into strict v from public.event_vorlagen where id = p_vorlage_id;

  -- ── Erst pruefen, dann anfassen ───────────────────────────────────────────
  -- Die Aktualisierung steht NACH der vollstaendigen Pruefung: ein Aufruf mit
  -- 53 oder mit Anzahl UND Enddatum darf auch nichts aktualisieren.
  if v.wiederholung is null then
    if p_anzahl is not null or p_bis_datum is not null then
      raise exception 'event_serie_erzeugen: eine Vorlage ohne Wiederholungsregel '
                      'erzeugt genau einen Termin am uebergebenen Datum — '
                      'weder Anzahl noch Enddatum sind zulaessig'
        using errcode = '22023';
    end if;
  else
    if p_anzahl is null and p_bis_datum is null then
      raise exception 'event_serie_erzeugen: entweder Anzahl oder Enddatum angeben — '
                      'eine woechentliche Regel ohne Grenze waere unendlich'
        using errcode = '22023';
    end if;

    if p_anzahl is not null and p_bis_datum is not null then
      raise exception 'event_serie_erzeugen: Anzahl UND Enddatum zugleich ist nicht '
                      'zulaessig — welches von beidem gaelte, waere Auslegung'
        using errcode = '22023';
    end if;

    if p_anzahl is not null then
      if p_anzahl < 1 or p_anzahl > 52 then
        raise exception 'event_serie_erzeugen: hoechstens 52 Termine je Aufruf, % verlangt',
          p_anzahl using errcode = '22023';
      end if;
      v_anzahl := p_anzahl;
    else
      -- Ein Vorkommnis mehr holen als erlaubt: faellt auch das 53. noch in den
      -- Zeitraum, verlangt der Aufruf mehr als 52.
      select count(*) into v_anzahl
        from public.event_serie_slots(
               v.wiederholung, v.ortszeit, v.zeitzone, p_ab, 53,
               v.wochentag, v.tag_im_monat, v.wochentag_position) s
       where s.slot_datum <= p_bis_datum;

      if v_anzahl > 52 then
        raise exception 'event_serie_erzeugen: das Enddatum % schliesst mehr als 52 '
                        'Termine ein', p_bis_datum using errcode = '22023';
      end if;
    end if;
  end if;

  -- ── D7: unbelegte Zukunft zieht nach ──────────────────────────────────────
  update public.events e
     set title       = v.title,
         type        = v.type,
         location    = v.location,
         description = v.description,
         capacity    = v.capacity,
         visibility  = v.visibility,
         topics      = v.topics,
         starts_at   = (e.slot_datum + v.ortszeit) at time zone v.zeitzone,
         ends_at     = case when v.dauer is null then null
                            else ((e.slot_datum + v.ortszeit) at time zone v.zeitzone)
                                 + v.dauer
                       end
   where e.vorlage_id = v.id
     and e.starts_at > now()
     and not exists (select 1 from public.event_registrations r
                      where r.event_id = e.id);

  -- ── Und dann das Fehlende anlegen ─────────────────────────────────────────
  -- Der Rueckgabewert sind die NEU angelegten Termine. Die Aktualisierung oben
  -- taucht darin nicht auf — „erzeugen" liefert, was entstanden ist.
  if v.wiederholung is null then
    return query
      with neu as (
        insert into public.events
          (title, type, location, description, capacity, visibility, topics,
           host_id, starts_at, ends_at, vorlage_id, slot_datum)
        select v.title, v.type, v.location, v.description, v.capacity,
               v.visibility, v.topics, v.host_id,
               (p_ab + v.ortszeit) at time zone v.zeitzone,
               case when v.dauer is null then null
                    else ((p_ab + v.ortszeit) at time zone v.zeitzone) + v.dauer
               end,
               v.id, p_ab
        on conflict (vorlage_id, slot_datum) do nothing
        returning *
      )
      select * from neu;
    return;
  end if;

  return query
    with kandidaten as (
      select s.slot_datum, s.starts_at
        from public.event_serie_slots(
               v.wiederholung, v.ortszeit, v.zeitzone, p_ab, v_anzahl,
               v.wochentag, v.tag_im_monat, v.wochentag_position) s
    ),
    neu as (
      insert into public.events
        (title, type, location, description, capacity, visibility, topics,
         host_id, starts_at, ends_at, vorlage_id, slot_datum)
      select v.title, v.type, v.location, v.description, v.capacity,
             v.visibility, v.topics, v.host_id,
             k.starts_at,
             case when v.dauer is null then null else k.starts_at + v.dauer end,
             v.id, k.slot_datum
        from kandidaten k
      on conflict (vorlage_id, slot_datum) do nothing
      returning *
    )
    select * from neu;
end $$;

comment on function public.event_serie_erzeugen(uuid, date, int, date) is
  'AGE-630: erzeugt Termine aus einer Vorlage und zieht dabei die unbelegte '
  'Zukunft derselben Vorlage auf die aktuellen Werte nach (D7). SECURITY '
  'INVOKER. Hoechstens 52 je Aufruf, geprueft VOR dem Einfuegen. Idempotent '
  'ueber (vorlage_id, slot_datum). Der Rueckgabewert sind die NEU angelegten '
  'Termine, nicht die aktualisierten.';
