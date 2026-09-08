-- Event-Vorlagen und Serientermine (AGE-630), Rundruf je Erzeugung.
--
-- ══ DER BEFUND ══════════════════════════════════════════════════════════════
-- An `events` haengen zwei `after insert … for each row`-Trigger:
-- `trg_event_feed_post` und `trg_hinweis_neues_event`. Letzterer ruft
-- `hinweis_rundruf('event_created', …)` — eine Hinweiszeile JE AKTIVIERTEM
-- MITGLIED ohne Opt-out, synchron in der auslösenden Transaktion, plus Push.
--
-- Eine Erzeugung von 52 Terminen schriebe 52 plattformweite Rundrufe in EINER
-- Transaktion. Die Spec-Zusage „ein erzeugter Termin verhaelt sich wie ein
-- einzeln angelegtes Event" ist hier die Falle selbst; die Obergrenze 52
-- begrenzt die Event-Zeilen, nicht die Faecherwirkung (D8, opencode HOCH).
--
-- ══ WAS SICH AENDERT ════════════════════════════════════════════════════════
--   * Der ZEILEN-Trigger schweigt fuer Termine mit `vorlage_id`.
--   * Ein neuer ANWEISUNGS-Trigger ruft genau einmal je Erzeugung.
--   * Der FEED-Spiegel bleibt je Termin — Termine sind listenrelevant. Das war
--     vorher ererbt und ist jetzt eine Entscheidung.
--
-- ══ WARUM EIN ANWEISUNGS-TRIGGER UND NICHT DIE RPC ══════════════════════════
-- Naheliegend waere gewesen, `hinweis_rundruf()` am Ende von
-- `event_serie_erzeugen()` aufzurufen. Das haette `authenticated` das
-- Ausfuehrungsrecht auf `hinweis_rundruf` gekostet — die Funktion ist
-- `SECURITY DEFINER` und schreibt an JEDES aktivierte Mitglied. Wer sie
-- aufrufen darf, kann die gesamte Mitgliedschaft anschreiben, mit beliebigem
-- Inhalt und beliebig oft. Die RPC ist `SECURITY INVOKER`; das Recht muesste
-- also wirklich beim Aufrufer liegen.
--
-- Ein Anweisungs-Trigger mit Uebergangstabelle laesst den Rundruf da, wo er
-- heute steht: in Triggerland, nicht aufrufbar. Und er zaehlt richtig, weil
-- „eine Erzeugung" genau „eine Anweisung" ist.
--
-- ══ WARUM DER TYP `event_created` BLEIBT — DAS IST DER OPT-OUT ══════════════
-- Ein eigener Typ `event_serie_created` waere ausdrucksstaerker und ist trotzdem
-- verworfen. `hinweis_erwuenscht()` bildet den Typ ueber ein `case` OHNE
-- `else`-Zweig auf die Einstellung des Mitglieds ab, und das Ergebnis geht durch
-- `coalesce(…, true)`. Ein UNBEKANNTER Typ liefert dort `null` und damit `true`:
-- der Hinweis ginge an jedes Mitglied, auch an die, die Event-Hinweise
-- abgeschaltet haben. Ein neuer Typ waere also nicht bloss ein neuer Typ,
-- sondern eine stille Umgehung jedes Opt-outs, bis jemand `hinweis_erwuenscht`
-- nachzieht.
--
-- Mit `event_created` greift `notify_app_event` unveraendert. Dass die Reihe
-- gemeint ist, steht im Nutzinhalt: `serie_anzahl`. Der Waechter dagegen ist die
-- Zusage „das abgemeldete Konto bekommt auch den Serien-Hinweis nicht" in
-- `event_serie_rundruf_test.sql`.
--
-- Forward-only.

-- ── 1. Der Zeilen-Trigger schweigt fuer Serientermine ───────────────────────
create or replace function public.hinweis_neues_event() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- AGE-630: Termine aus einer Vorlage kuendigt der Anweisungs-Trigger
  -- gesammelt an. Ohne diese Zeile schriebe eine Erzeugung von 52 Terminen 52
  -- plattformweite Rundrufe in einer Transaktion.
  if new.vorlage_id is not null then
    return null;
  end if;

  perform public.hinweis_rundruf(
    'event_created',
    new.host_id,
    jsonb_build_object('event_id', new.id, 'titel', new.title)
  );
  return null;
end $$;

-- ── 2. Ein Rundruf je Erzeugung ─────────────────────────────────────────────
create function public.hinweis_neue_serie() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  r record;
begin
  -- Gruppiert, nicht aggregiert ueber alles: eine Anweisung KANN Zeilen zu
  -- mehreren Vorlagen tragen (die RPC tut es nicht, ein Trigger auf der Tabelle
  -- sieht aber jede Anweisung). Dann ist ein Rundruf je Reihe richtig.
  for r in
    select e.host_id,
           count(*)::int                                as anzahl,
           (array_agg(e.id    order by e.starts_at))[1] as erste_id,
           (array_agg(e.title order by e.starts_at))[1] as titel
      from neu e
     where e.vorlage_id is not null
     group by e.vorlage_id, e.host_id
  loop
    perform public.hinweis_rundruf(
      'event_created',
      r.host_id,
      jsonb_build_object('event_id', r.erste_id,
                         'titel', r.titel,
                         'serie_anzahl', r.anzahl));
  end loop;
  return null;
end $$;

comment on function public.hinweis_neue_serie() is
  'AGE-630: Innerei des Anweisungs-Triggers, keine API. Ein Rundruf je Reihe '
  'statt einer je Termin. Typ bleibt `event_created`, damit `notify_app_event` '
  'greift — ein unbekannter Typ liefe in hinweis_erwuenscht auf `true` hinaus '
  'und umginge jedes Opt-out.';

revoke execute on function public.hinweis_neue_serie()
  from public, anon, authenticated, service_role;

create trigger trg_hinweis_neue_serie
  after insert on public.events
  referencing new table as neu
  for each statement execute function public.hinweis_neue_serie();
