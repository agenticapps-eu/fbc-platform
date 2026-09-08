-- Event-Vorlagen und Serientermine (AGE-630), Obergrenze fuer `p_anzahl`.
--
-- ══ DER BEFUND (Diff-Review, opencode, MITTEL) ══════════════════════════════
-- `event_serie_slots()` hatte KEINE Obergrenze. Die 52er-Grenze sitzt in
-- `event_serie_erzeugen()` — aber `authenticated` darf `event_serie_slots()
-- direkt aufrufen (das ist gewollt: die Vorschau im Client braucht sie).
--
-- Gemessen am lokalen Stack, vor dieser Migration:
--
--   select count(*) from public.event_serie_slots(
--     'woechentlich','19:00','Europe/Berlin','2026-09-01', 100000, 2);
--   -> 100000
--
-- Kein Datenleck: die Funktion ist `SECURITY INVOKER`, rechnet nur mit dem
-- Kalender und liest keine Zeile. Es ist eine VERFUEGBARKEITS-Frage. `return
-- query` materialisiert in einen Tuplestore, ein Aufruf mit 10^8 fordert also
-- unbegrenzt Speicher und CPU je HTTP-Anfrage — auf einer Datenbank, die sich
-- alle Mitglieder teilen. Jedes aktivierte Konto konnte das mit einem Aufruf.
--
-- ══ WARUM 53 UND NICHT 52 ═══════════════════════════════════════════════════
-- Die Grenze ist bewusst um eins groesser als die Produktgrenze. Der
-- Enddatum-Pfad von `event_serie_erzeugen()` (20260907110000) holt
-- ABSICHTLICH ein Vorkommnis mehr als erlaubt:
--
--   select count(*) into v_anzahl
--     from public.event_serie_slots(..., 53, ...) s
--    where s.slot_datum <= p_bis_datum;
--
-- Faellt auch das 53. noch in den Zeitraum, verlangt der Aufruf mehr als 52.
-- Eine Grenze von 52 wuerde genau diese Pruefung erschlagen — die Serie mit
-- 53 Terminen im Zeitraum kaeme dann nicht als „mehr als 52" durch, sondern
-- als Ausnahme aus der falschen Funktion.
--
-- ══ WAS SICH NICHT AENDERT ══════════════════════════════════════════════════
-- `p_anzahl = 0` und negative Werte liefern weiterhin die leere Menge statt
-- eines Fehlers. Das ist kein Versehen: sie sind hier bereits harmlos (kein
-- Loop, keine Arbeit), und `event_serie_erzeugen()` weist sie an der Stelle
-- ab, an der sie eine BEDEUTUNG haben — beim Schreiben, mit 22023. Diese
-- Migration schliesst die Verfuegbarkeitsluecke und sonst nichts.
--
-- `create or replace` behaelt die bestehenden Rechte: der `revoke ... from
-- public, anon, service_role` plus `grant ... to authenticated` aus
-- 20260907090000 gilt unveraendert weiter (grants_test.sql, Abschnitt 8b).
--
-- Forward-only.

create or replace function public.event_serie_slots(
  p_wiederholung       text,
  p_ortszeit           time,
  p_zeitzone           text,
  p_ab                 date,
  p_anzahl             int,
  p_wochentag          int default null,
  p_tag_im_monat       int default null,
  p_wochentag_position int default null
) returns table (slot_datum date, starts_at timestamptz)
  language plpgsql
  stable
  security invoker
  set search_path = ''
as $$
begin
  -- AGE-630: siehe Kopf. 53 statt 52, weil der Enddatum-Pfad der RPC
  -- absichtlich ein Vorkommnis mehr holt, als er erlaubt.
  if p_anzahl > 53 then
    raise exception 'event_serie_slots: hoechstens 53 Vorkommnisse je Aufruf, % verlangt',
      p_anzahl using errcode = '22023';
  end if;

  if p_wiederholung = 'woechentlich' then
    -- Erstes Vorkommnis ab `p_ab`, danach im Wochenraster. Der Versatz ist
    -- 0, wenn `p_ab` selbst schon der gesuchte Wochentag ist.
    return query
      select k.d, (k.d + p_ortszeit) at time zone p_zeitzone
        from (
          select (p_ab
                  + ((p_wochentag - extract(isodow from p_ab)::int + 7) % 7)
                  + 7 * n)::date as d
            from pg_catalog.generate_series(0, p_anzahl - 1) as n
        ) k
       order by k.d;

  elsif p_wiederholung = 'monatlich_tag' then
    -- `extract(day ...) = p_tag_im_monat` ist der Monatsfilter: laeuft der
    -- Kandidat in den Folgemonat, hatte dieser Monat den Tag nicht. Ein
    -- `make_date(..., 31)` waere hier stattdessen mit 22008 gestorben.
    return query
      select k.d, (k.d + p_ortszeit) at time zone p_zeitzone
        from (
          select (m.anfang + (p_tag_im_monat - 1))::date as d
            from (
              select (pg_catalog.date_trunc('month', p_ab::timestamp)
                      + (n || ' months')::interval)::date as anfang
                from pg_catalog.generate_series(0, p_anzahl * 2 + 1) as n
            ) m
        ) k
       where extract(day from k.d) = p_tag_im_monat
         and k.d >= p_ab
       order by k.d
       limit p_anzahl;

  elsif p_wiederholung = 'monatlich_n_ter_wochentag' then
    return query
      select k.d, (k.d + p_ortszeit) at time zone p_zeitzone
        from (
          select (m.anfang
                  + ((p_wochentag - extract(isodow from m.anfang)::int + 7) % 7)
                  + 7 * (p_wochentag_position - 1))::date as d
            from (
              select (pg_catalog.date_trunc('month', p_ab::timestamp)
                      + (n || ' months')::interval)::date as anfang
                from pg_catalog.generate_series(0, p_anzahl + 1) as n
            ) m
        ) k
       where k.d >= p_ab
       order by k.d
       limit p_anzahl;

  else
    -- Eine regellose Vorlage erzeugt Termine ueber ein EINZELNES DATUM (D3);
    -- das ist Sache der RPC. Hier still eine leere Menge zu liefern waere der
    -- schlechte Ausgang: sie saehe aus wie „die Regel ergibt eben nichts".
    raise exception 'event_serie_slots: unbekannte oder fehlende Wiederholungsform (%)',
      coalesce(p_wiederholung, '<null>')
      using errcode = '22023';
  end if;
end $$;

comment on function public.event_serie_slots(text, time, text, date, int, int, int, int) is
  'AGE-630: wertet eine Wiederholungsregel zu Slot-Datum plus Zeitpunkt aus. '
  'Rechnet nur, schreibt nichts. Fuehrt ORTSZEIT — die Herbstumstellung ergibt '
  'deshalb 169 h zwischen zwei Wochenterminen, nicht 168. Hoechstens 53 '
  'Vorkommnisse je Aufruf; die 53. ist die Sonde des Enddatum-Pfads.';
