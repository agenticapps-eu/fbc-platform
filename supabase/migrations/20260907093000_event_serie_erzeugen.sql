-- Event-Vorlagen und Serientermine (AGE-630), die Erzeugungs-RPC.
--
-- ══ WAS HIER PASSIERT ═══════════════════════════════════════════════════════
-- `event_serie_erzeugen()` nimmt eine Vorlage und schreibt daraus Termine. Die
-- Kalenderrechnung liegt in `event_serie_slots()` (20260907090000) und wird
-- hier nur aufgerufen — diese Datei ist die SCHREIBENDE Haelfte.
--
-- ══ WARUM `SECURITY INVOKER` ════════════════════════════════════════════════
-- Der Host darf seine Events ohnehin anlegen; es gibt kein Recht zu leihen.
-- Eine `DEFINER`-Funktion muesste `is_activated()`, `host_id` und die
-- Cover-Pfadbindung aus `events_write_host` vollstaendig nachbauen — jedes
-- vergessene Stueck waere eine Policy-Umgehung (D2).
--
-- Das traegt zwei Zusagen gratis:
--   * Ein fremder Host bekommt die Vorlage von der RLS gar nicht zu sehen;
--     `select into strict` macht daraus P0002. Es braucht keine eigene
--     Eigentuemerpruefung, die man vergessen koennte.
--   * Wer nicht aktiviert ist, scheitert an `events_write_host` beim Einfuegen.
--
-- ══ DIE OBERGRENZE SITZT VOR DEM EINFUEGEN ══════════════════════════════════
-- 52 je Aufruf, geprueft an der KANDIDATENLISTE. Waere sie am Einfuegen
-- geprueft, waere bei Teilexistenz undefiniert, was ein Aufruf begrenzt (D6).
-- `anzahl` zaehlt ERZEUGTE Termine, nicht durchlaufene Monate — bei
-- `monatlich_tag = 31` zaehlen die uebersprungenen Monate nicht mit.
--
-- Beim Enddatum wird ein Vorkommnis MEHR geholt als erlaubt (53) und gezaehlt,
-- was in den Zeitraum faellt: liegt auch das 53. noch darin, verlangt der
-- Aufruf mehr als 52 und wird abgewiesen.
--
-- Die Grenze ist ein Schutz gegen Versehen und KEINE Sicherheitsgrenze — wer
-- viele Events anlegen will, kann sie seit jeher einzeln anlegen (D2/D6).
--
-- ══ `on conflict` MIT ZIEL, UND WARUM DAS WICHTIG IST ═══════════════════════
-- `on conflict (vorlage_id, slot_datum) do nothing`. OHNE Spaltenliste schluckte
-- das Konstrukt auch eine Verletzung von `events_cover_path_key` — und ein
-- Cover-Konflikt saehe exakt aus wie legitime Idempotenz: der Slot fehlte
-- dauerhaft, kein Test koennte es unterscheiden. Mit Ziel knallt er laut (D6).
--
-- ══ NOCH NICHT HIER ═════════════════════════════════════════════════════════
-- Cover-Kopien je Termin (Aufgabe 7) und die Rundruf-Unterdrueckung (Aufgabe 8)
-- kommen in eigenen Migrationen. Aufgabe 7 ersetzt diese Funktion durch eine
-- mit einem zusaetzlichen Pfad-Parameter — ein `drop` plus Neuanlage, weil ein
-- angehaengter Parameter mit Vorgabewert eine zweite Ueberladung waere.
--
-- Forward-only.

create function public.event_serie_erzeugen(
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

  if v.wiederholung is null then
    -- Eine regellose Vorlage erzeugt einen EINZELNEN Termin am uebergebenen
    -- Datum. Eine Anzahl waere undefiniert: es gibt nichts zu vervielfaeltigen
    -- (D3).
    if p_anzahl is not null or p_bis_datum is not null then
      raise exception 'event_serie_erzeugen: eine Vorlage ohne Wiederholungsregel '
                      'erzeugt genau einen Termin am uebergebenen Datum — '
                      'weder Anzahl noch Enddatum sind zulaessig'
        using errcode = '22023';
    end if;

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
  'AGE-630: erzeugt Termine aus einer Vorlage. SECURITY INVOKER — die RLS der '
  'Vorlagentabelle erledigt die Eigentuemerpruefung, events_write_host die '
  'Aktivierungspruefung. Hoechstens 52 je Aufruf, geprueft VOR dem Einfuegen. '
  'Idempotent ueber (vorlage_id, slot_datum).';

revoke execute on function public.event_serie_erzeugen(uuid, date, int, date)
  from public, anon, service_role;
grant execute on function public.event_serie_erzeugen(uuid, date, int, date)
  to authenticated;
