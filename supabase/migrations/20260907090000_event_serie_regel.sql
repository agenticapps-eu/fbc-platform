-- Event-Vorlagen und Serientermine (AGE-630), die Wiederholungsregel.
--
-- ══ WAS HIER PASSIERT ═══════════════════════════════════════════════════════
-- `event_serie_slots()` wertet eine der drei Regelformen zu einer Liste aus
-- Slot-Datum und Zeitpunkt aus. Sie RECHNET NUR: kein Schreibvorgang, kein
-- Tabellenzugriff. Das Einfuegen, die Obergrenze 52 und `on conflict` sind
-- Aufgabe 5 und stehen bewusst nicht hier — eine reine Funktion laesst sich
-- ohne Fixtures gegen den Kalender messen.
--
-- ══ WARUM DREI ZWEIGE UND KEINE GEMEINSAME FORMEL ═══════════════════════════
-- Form 3 („erster Dienstag im Monat") ist NICHT als feste Tagesdifferenz
-- annaeherbar: zwischen dem 01.09. und dem 06.10.2026 liegen 35 Tage, zwischen
-- dem 06.10. und dem 03.11. nur 28. Der Test misst genau das.
--
-- ══ DIE FENSTERGROESSEN SIND GERECHNET, NICHT GERATEN ═══════════════════════
-- `monatlich_tag` ueberspringt Monate, in denen es den Tag nicht gibt, und
-- diese Monate zaehlen NICHT in `anzahl` (D6). Das Kandidatenfenster muss also
-- groesser sein als `anzahl` Monate:
--
--   Schlimmster Fall ist Tag 31 — 7 von 12 Monaten haben ihn, Verhaeltnis
--   12/7 = 1,72 Monate je Termin. Dazu hoechstens ein uebersprungener
--   Startmonat. `anzahl * 2 + 1` deckt das fuer jedes `anzahl` ab; bei 52
--   Terminen sind 91 Monate noetig und 105 vorhanden.
--
-- Bei `monatlich_n_ter_wochentag` faellt kein Monat aus: der 4. Wochentag liegt
-- spaetestens am 28., und jeder Monat hat einen 28. Fenster deshalb
-- `anzahl + 1` — das +1 nur fuer den Startmonat, dessen Vorkommnis schon
-- vorbei sein kann.
--
-- ══ ZEITUMSTELLUNG: HIER WEICHT DIE UMSETZUNG VOM PLAN AB ═══════════════════
-- design.md D4 und das Spec-Delta sagten fuer die Herbstueberlappung „erste
-- Lesart (Sommerzeit), das Postgres-Verhalten". Beides zusammen ist falsch, und
-- die Messung, auf die sie sich beriefen, konnte es nicht zeigen: sie wandelte
-- 02:30 hin und zurueck und bekam 02:30 — was fuer BEIDE Lesarten gilt.
--
-- Unterscheidend gemessen (07.09., lokaler Stack), Umstelltag 25.10.2026:
--
--   02:30+02 (CEST, erste Lesart)  = 00:30Z
--   02:30+01 (CET,  zweite Lesart) = 01:30Z
--   timestamp '2026-10-25 02:30' at time zone 'Europe/Berlin'  =  01:30Z
--
-- Postgres liefert die ZWEITE Lesart. Uebernommen wird das gemessene Verhalten:
-- die tragende Zusage — GENAU EIN Termin, weder zwei noch keiner — gilt unter
-- beiden Lesarten, und die erste zu erzwingen hiesse, die Mehrdeutigkeit von
-- Hand zu erkennen und den Zeitpunkt mit festem Offset zu bauen. Die Absicht
-- von D4 war ausdruecklich „das Postgres-Verhalten, aber festgelegt und
-- getestet"; das Etikett war falsch, nicht die Absicht. design.md und das
-- Spec-Delta sind entsprechend korrigiert.
--
-- Die Fruehjahrsluecke bleibt wie geplant: 02:30 am 28.03.2027 ergibt 03:30
-- Ortszeit, der Termin entfaellt NICHT. Ein still fehlender Termin einer
-- laufenden Reihe ist der schlechtere Ausgang.
--
-- ══ RECHTE ══════════════════════════════════════════════════════════════════
-- Postgres verschenkt EXECUTE ueber PUBLIC an jede neue Funktion, und
-- `alter default privileges` greift bei Funktionen NICHT — der Entzug muss hier
-- stehen (AGE-602, grants_test.sql Abschnitt 5/6).
--
-- `authenticated` bekommt das Recht ausdruecklich: die Erzeugungs-RPC aus
-- Aufgabe 5 ist `SECURITY INVOKER` und ruft diese Funktion unter der Rolle des
-- Aufrufers. Die Funktion liest keine Zeile und gibt nichts preis — sie rechnet
-- mit Kalender und Zonendatenbank.
--
-- Forward-only.

create function public.event_serie_slots(
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
  'deshalb 169 h zwischen zwei Wochenterminen, nicht 168.';

revoke execute on function public.event_serie_slots(text, time, text, date, int, int, int, int)
  from public, anon, service_role;
grant execute on function public.event_serie_slots(text, time, text, date, int, int, int, int)
  to authenticated;
