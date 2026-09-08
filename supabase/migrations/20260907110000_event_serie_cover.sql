-- Event-Vorlagen und Serientermine (AGE-630), Cover je Termin.
--
-- ══ WAS SICH AENDERT ════════════════════════════════════════════════════════
-- `event_serie_erzeugen()` bekommt `p_cover_pfade text[]` und verteilt die
-- Pfade der Reihe nach auf die Termine. Ein `drop` plus Neuanlage, kein
-- `create or replace`: ein angehaengter Parameter mit Vorgabewert waere eine
-- zweite UEBERLADUNG, und PostgREST stuende dann vor zwei Kandidaten.
--
-- ══ WARUM DIE RPC NICHT SELBST KOPIERT ══════════════════════════════════════
-- Sie kann es nicht. Die Bytes liegen im Storage-Dienst; ein `insert` in
-- `storage.objects` legt eine Zeile an und kopiert keine Datei. Der Befund kam
-- aus der Plan-Review (opencode, HOCH) und machte die erste Fassung von D5
-- unbaubar. Deshalb: der CLIENT kopiert (`storage.copy()` je Termin) und
-- uebergibt fertige Pfade; die RPC prueft, was sie pruefen kann.
--
-- Teilerfolg ist benannt, nicht wegdefiniert: die Dateien entstehen VOR den
-- Zeilen. Bricht die RPC ab, liegen Kopien ohne Termine im Bucket — dieselbe
-- Klasse wie die schon bestehende Waisen-Datei beim Loeschen eines Events, und
-- gleich behandelt. Die umgekehrte Reihenfolge waere schlimmer: Zeilen ohne
-- Dateien sind sichtbar kaputte Events.
--
-- ══ WAS DIE DATENBANK HIER TATSAECHLICH ZUSAGT ══════════════════════════════
--   * Anzahl: so viele Pfade wie Termine, sonst 22023. Ohne diese Pruefung
--     landeten bei einer verrutschten Liste Cover an den falschen Terminen —
--     lautlos.
--   * Praefix: `events_write_host` bindet `cover_path` an das eigene `{uid}/`.
--     Steht schon dort; die RPC ist SECURITY INVOKER und erbt es.
--   * Eindeutigkeit: `events_cover_path_key`. Zwei Termine auf demselben Pfad
--     krachen mit 23505 — und genau das belegt, dass `on conflict` ein ZIEL
--     traegt. Ohne Ziel schluckte `do nothing` den Cover-Konflikt, der Slot
--     fehlte dauerhaft, und kein Test koennte es von Idempotenz unterscheiden.
--
-- Nicht zusagbar ist die Unvorhersagbarkeit der Namen — die RPC bekommt fertige
-- Zeichenketten. Die UUID vergibt der Client (D5c); ein ableitbarer Name machte
-- eine verwaiste Datei wiederauffindbar und damit an ein fremdes Event
-- anhaengbar.
--
-- Das Cover der VORLAGE selbst wird NIE an einen Termin geschrieben. Es ist ihre
-- private Datei und nur fuer den Host lesbar (20260907103000).
--
-- Forward-only.

drop function public.event_serie_erzeugen(uuid, date, int, date);

create function public.event_serie_erzeugen(
  p_vorlage_id   uuid,
  p_ab           date,
  p_anzahl       int    default null,
  p_bis_datum    date   default null,
  p_cover_pfade  text[] default null
) returns setof public.events
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  v           public.event_vorlagen;
  v_anzahl    int;
  v_kandidaten int;
begin
  -- Kein Treffer heisst hier BEIDES: es gibt sie nicht, oder sie gehoert
  -- jemand anderem und die RLS zeigt sie nicht. Genau richtig so — die
  -- Unterscheidung waere selbst eine Auskunft.
  select * into strict v from public.event_vorlagen where id = p_vorlage_id;

  -- ── Erst pruefen, dann anfassen ───────────────────────────────────────────
  if v.wiederholung is null then
    if p_anzahl is not null or p_bis_datum is not null then
      raise exception 'event_serie_erzeugen: eine Vorlage ohne Wiederholungsregel '
                      'erzeugt genau einen Termin am uebergebenen Datum — '
                      'weder Anzahl noch Enddatum sind zulaessig'
        using errcode = '22023';
    end if;
    v_kandidaten := 1;
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

    -- Gezaehlt statt angenommen: die Fenstergroessen in `event_serie_slots`
    -- sind zwar gerechnet, aber eine Pfadliste an einer ANGENOMMENEN Laenge
    -- auszurichten hiesse, Cover bei einer Abweichung lautlos zu verschieben.
    if p_cover_pfade is not null then
      select count(*) into v_kandidaten
        from public.event_serie_slots(
               v.wiederholung, v.ortszeit, v.zeitzone, p_ab, v_anzahl,
               v.wochentag, v.tag_im_monat, v.wochentag_position);
    end if;
  end if;

  if p_cover_pfade is not null
     and coalesce(array_length(p_cover_pfade, 1), 0) <> v_kandidaten then
    raise exception 'event_serie_erzeugen: % Cover-Pfade fuer % Termine — die Liste '
                    'muss zur Terminzahl passen, sonst haengen Cover an den falschen '
                    'Terminen', coalesce(array_length(p_cover_pfade, 1), 0), v_kandidaten
      using errcode = '22023';
  end if;

  -- ── D7: unbelegte Zukunft zieht nach ──────────────────────────────────────
  -- `cover_path` bleibt hier ABSICHTLICH aussen vor: die Datei eines
  -- bestehenden Termins gehoert ihm, und ein Nachziehen wuerde entweder auf
  -- eine fremde Kopie zeigen oder die Eindeutigkeit verletzen.
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
  if v.wiederholung is null then
    return query
      with neu as (
        insert into public.events
          (title, type, location, description, capacity, visibility, topics,
           host_id, starts_at, ends_at, vorlage_id, slot_datum, cover_path)
        select v.title, v.type, v.location, v.description, v.capacity,
               v.visibility, v.topics, v.host_id,
               (p_ab + v.ortszeit) at time zone v.zeitzone,
               case when v.dauer is null then null
                    else ((p_ab + v.ortszeit) at time zone v.zeitzone) + v.dauer
               end,
               v.id, p_ab, p_cover_pfade[1]
        on conflict (vorlage_id, slot_datum) do nothing
        returning *
      )
      select * from neu;
    return;
  end if;

  return query
    with kandidaten as (
      select s.slot_datum, s.starts_at,
             row_number() over (order by s.slot_datum) as nr
        from public.event_serie_slots(
               v.wiederholung, v.ortszeit, v.zeitzone, p_ab, v_anzahl,
               v.wochentag, v.tag_im_monat, v.wochentag_position) s
    ),
    neu as (
      insert into public.events
        (title, type, location, description, capacity, visibility, topics,
         host_id, starts_at, ends_at, vorlage_id, slot_datum, cover_path)
      select v.title, v.type, v.location, v.description, v.capacity,
             v.visibility, v.topics, v.host_id,
             k.starts_at,
             case when v.dauer is null then null else k.starts_at + v.dauer end,
             v.id, k.slot_datum, p_cover_pfade[k.nr::int]
        from kandidaten k
      on conflict (vorlage_id, slot_datum) do nothing
      returning *
    )
    select * from neu;
end $$;

comment on function public.event_serie_erzeugen(uuid, date, int, date, text[]) is
  'AGE-630: erzeugt Termine aus einer Vorlage, verteilt die vom Client '
  'kopierten Cover-Pfade der Reihe nach und zieht die unbelegte Zukunft '
  'derselben Vorlage nach (D7). SECURITY INVOKER. Hoechstens 52 je Aufruf, '
  'geprueft VOR dem Einfuegen. Idempotent ueber (vorlage_id, slot_datum) — mit '
  'ZIEL, damit ein Cover-Konflikt laut kracht statt als Idempotenz zu gelten.';

revoke execute on function public.event_serie_erzeugen(uuid, date, int, date, text[])
  from public, anon, service_role;
grant execute on function public.event_serie_erzeugen(uuid, date, int, date, text[])
  to authenticated;
