-- ════════════════════════════════════════════════════════════════════════════
-- AGE-641 — die Zustellung: Zuordnung als Daten, Auftraege mit Zustand
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/push-fundament/. Phase A, Schritte 4 und 5b.
--
-- ══ DREI ENTSCHEIDUNGEN ════════════════════════════════════════════════════
--
-- 1. WELCHER TYP GEPUSHT WIRD, IST EINE ZEILE UND KEIN `case`.
--    Abschnitt 4 des Issues ist ausdruecklich noch nicht mit Detlev
--    abgestimmt. Stuende die Liste im Quelltext, kostete jede Aenderung einen
--    Function-Deploy — und „die erste Push-Nachricht entscheidet, ob jemand
--    Push anlaesst" heisst, dass genau diese Liste sich noch bewegen wird.
--
--    Eine FEHLENDE Zeile ist dabei keine Erlaubnis. Ein neunter Typ soll nicht
--    dadurch auf den Geraeten landen, dass niemand an ihn gedacht hat.
--
-- 2. DER TRANSPORT SIEHT DIE NUTZLAST NIE.
--    `push_auftraege_holen` gibt eine FESTE Feldliste zurueck — Token,
--    Plattform, Typ, einen Namen und eine Ziel-Kennung. Nicht die Nutzlast.
--
--    Das ist der Schutz fuer den ALTBESTAND: die contact_request-Zeilen seit
--    dem 14.06. tragen Mitglieder-Freitext in `payload->>'message'`, und die
--    bleiben auf Donalds Entscheidung vom 27.08. unangetastet. Ein Transport,
--    der die Nutzlast durchreichte, lieferte ihn auf Sperrbildschirme aus.
--    Hier kann er ihn nicht einmal lesen.
--
--    Die Namensquellen sind darum einzeln aufgezaehlt und nicht „alles ausser
--    message": eine Ausschlussliste vergisst den naechsten Schluessel, eine
--    Einschlussliste nicht.
--
-- 3. ZUSTAND JE (notification_id, token_id), UND DER SCHLUESSEL IST DIE
--    IDEMPOTENZ.
--    Aus der Plan-Review (GPT-5): ohne Zustand verliert ein 429 oder 5xx den
--    Push endgueltig, und ein Betriebs-Replay des Webhooks schickt ihn
--    doppelt. Beides faellt mit derselben Tabelle. Der Anspruch ist ein
--    einziges `update … where zustand = 'offen' … returning` — kein
--    `select`-dann-`update`, sonst greifen zwei gleichzeitige Laeufe dieselbe
--    Zeile.
--
-- ══ WARUM UEBERHAUPT RPCs UND NICHT DIREKTE TABELLENZUGRIFFE ═══════════════
-- `service_role` haelt in `public` keine Tabellenrechte, die dieses
-- Repository ausspricht (AGE-623). Dass sie lokal trotzdem fast alles liest,
-- ist eine Eigenschaft der INSTANZ — sie hat sich zwischen AGE-622 und
-- AGE-623 an einem Tag gedreht. Ein Zustellweg, der darauf steht, faellt zur
-- Laufzeit und ohne Vorwarnung aus.
--
-- Und das gilt fuer BEIDE Richtungen: auch das Entfernen toter Token laeuft
-- ueber eine RPC. Die erste Fassung dieses Entwurfs hat die eigene Lehre nur
-- auf das Lesen angewandt — gefunden von der Plan-Review.
--
-- Donald, 27.08.2026.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Die Zuordnung ────────────────────────────────────────────────────────
create table public.push_routing (
  type text primary key,
  push boolean not null
);

comment on table public.push_routing is
  'AGE-641: welcher Hinweistyp aufs Geraet geht. Daten und kein Quelltext, '
  'damit Detlevs noch offene Liste ein `update` bleibt und kein Deploy. Ein '
  'Typ OHNE Zeile wird nicht gepusht — eine fehlende Zeile ist keine '
  'Erlaubnis.';

insert into public.push_routing (type, push) values
  -- Der Kernfall, und der Grund fuer die App.
  ('message',                  true),
  -- Eine Kontaktanfrage ist ein persoenliches Ereignis mit Gegenueber.
  ('contact_request',          true),
  ('contact_request_accepted', true),
  ('contact_request_declined', true),
  -- Bei siebzig aktiven Mitgliedern wird daraus schnell Laerm, und Laerm
  -- fuehrt dazu, dass Push GENERELL abgeschaltet wird (Issue, Abschnitt 4).
  ('post_created',             false),
  ('comment_on_post',          false),
  ('like_on_post',             false),
  -- `false`, WEIL Abschnitt 4 „gebuendelt statt sofort" will und Buendelung
  -- eine Zustellzeit-Mechanik ist und kein Transport. Eigener Vorgang.
  ('event_created',            false),
  -- Der eine Typ ohne Abschalter (specs/notifications/spec.md:340) ist der
  -- eine, der niemandem aufs Geraet gehoert.
  ('release_note',             false);

alter table public.push_routing enable row level security;
-- Keine Policy und kein Grant: nur die DEFINER-Funktionen unten lesen sie.

-- ── 2. Der Zustellzustand ───────────────────────────────────────────────────
create table public.push_zustellungen (
  notification_id   uuid not null references public.notifications (id) on delete cascade,
  token_id          uuid not null references public.push_tokens (id) on delete cascade,
  zustand           text not null default 'offen'
                      check (zustand in ('offen', 'laeuft', 'zugestellt', 'aufgegeben')),
  versuche          int  not null default 0,
  naechster_versuch timestamptz not null default now(),
  letzter_fehler    text,
  created_at        timestamptz not null default now(),
  primary key (notification_id, token_id)
);

comment on table public.push_zustellungen is
  'AGE-641: Zustellzustand je Hinweis und Geraet. Der Primaerschluessel IST '
  'die Idempotenz: ein wiederholter Webhook-Aufruf findet die Zeile vor und '
  'stellt nicht zweimal zu. `on delete cascade` in beide Richtungen — ein '
  'entferntes Token oder ein geloeschter Hinweis nimmt seine Auftraege mit.';

alter table public.push_zustellungen enable row level security;
-- Ebenfalls ohne Policy und ohne Grant. Ein Mitglied hat mit dem Zustellbuch
-- nichts zu tun; es sieht seine Hinweise in der Glocke.

create index push_zustellungen_faellig_idx
  on public.push_zustellungen (naechster_versuch)
  where zustand = 'offen';

-- ── 3. Auftraege holen und beanspruchen ─────────────────────────────────────
create function public.push_auftraege_holen(p_notification_id uuid)
  returns table (
    notification_id uuid,
    token_id        uuid,
    token           text,
    plattform       text,
    typ             text,
    wer             text,
    ziel_id         text
  )
  language plpgsql
  security definer
  set search_path = ''
as $$
-- Die Rueckgabespalten heissen wie die Tabellenspalten, und an unqualifizierten
-- Stellen — `on conflict (notification_id, token_id)` — waere das mehrdeutig.
-- `use_column` entscheidet solche Faelle zugunsten der SPALTE; die Parameter
-- tragen alle ein `p_` und kollidieren darum nie.
#variable_conflict use_column
declare
  v_profile uuid;
  v_typ     text;
  v_payload jsonb;
begin
  select n.profile_id, n.type, n.payload
    into v_profile, v_typ, v_payload
    from public.notifications n
   where n.id = p_notification_id;

  if v_profile is null then
    return;
  end if;

  -- Fehlende Zeile = kein Push. `coalesce(..., false)`, nicht `is not false`.
  if not coalesce((select r.push from public.push_routing r where r.type = v_typ), false) then
    return;
  end if;

  -- Die Zeile kann aelter sein als eine Sperre.
  if not public.is_activated_profile(v_profile) then
    return;
  end if;

  -- DERSELBE Schalter wie die Glocke. Nicht ein zweiter.
  if not public.hinweis_erwuenscht(v_profile, v_typ) then
    return;
  end if;

  -- Auftragszeilen anlegen. `on conflict do nothing` macht den zweiten
  -- Webhook-Aufruf wirkungslos, statt ihn zu verdoppeln.
  insert into public.push_zustellungen (notification_id, token_id)
  select p_notification_id, t.id
    from public.push_tokens t
   where t.profile_id = v_profile
  on conflict (notification_id, token_id) do nothing;

  -- Ein einziges `update … returning`: zwei gleichzeitige Laeufe koennen
  -- dieselbe Zeile nicht beide beanspruchen.
  return query
  with beansprucht as (
    update public.push_zustellungen z
       set zustand = 'laeuft'
     where z.notification_id = p_notification_id
       and z.zustand = 'offen'
       and z.naechster_versuch <= now()
    returning z.notification_id, z.token_id
  )
  select b.notification_id,
         b.token_id,
         t.token,
         t.plattform,
         v_typ,
         -- FESTE Feldliste. Einschluss, nicht Ausschluss: eine Liste dessen,
         -- was NICHT mitdarf, vergisst den naechsten Schluessel.
         coalesce(v_payload->>'sender_name',
                  v_payload->>'from_name',
                  v_payload->>'to_name',
                  v_payload->>'autor_name',
                  'Ein Mitglied'),
         coalesce(v_payload->>'thread_id',
                  v_payload->>'request_id')
    from beansprucht b
    join public.push_tokens t on t.id = b.token_id;
end $$;

comment on function public.push_auftraege_holen(uuid) is
  'AGE-641: prueft Zuordnung, Aktivierung und Schalter, legt die Auftraege an '
  'und beansprucht sie atomar. Gibt eine FESTE Feldliste zurueck und niemals '
  'die Nutzlast — so kann der Transport den Freitext alter '
  'contact_request-Zeilen gar nicht erst in die Hand nehmen.';

-- ── 4. Faellige Auftraege — der Wiederholungslauf ───────────────────────────
create function public.push_auftraege_faellig(p_max int default 100)
  returns table (
    notification_id uuid,
    token_id        uuid,
    token           text,
    plattform       text,
    typ             text,
    wer             text,
    ziel_id         text
  )
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  return query
  with faellig as (
    select z.notification_id, z.token_id
      from public.push_zustellungen z
     where z.zustand = 'offen'
       and z.naechster_versuch <= now()
     order by z.naechster_versuch
     limit p_max
     for update skip locked
  ),
  beansprucht as (
    update public.push_zustellungen z
       set zustand = 'laeuft'
      from faellig f
     where z.notification_id = f.notification_id
       and z.token_id = f.token_id
    returning z.notification_id, z.token_id
  )
  select b.notification_id,
         b.token_id,
         t.token,
         t.plattform,
         n.type,
         coalesce(n.payload->>'sender_name',
                  n.payload->>'from_name',
                  n.payload->>'to_name',
                  n.payload->>'autor_name',
                  'Ein Mitglied'),
         coalesce(n.payload->>'thread_id',
                  n.payload->>'request_id')
    from beansprucht b
    join public.push_tokens t   on t.id = b.token_id
    join public.notifications n on n.id = b.notification_id;
end $$;

comment on function public.push_auftraege_faellig(int) is
  'AGE-641: holt liegengebliebene Auftraege fuer den Wiederholungslauf. '
  '`for update skip locked`, damit zwei gleichzeitige Laeufe sich nicht '
  'gegenseitig blockieren und nicht dieselbe Zeile greifen.';

-- ── 5. Quittieren ───────────────────────────────────────────────────────────
-- Drei Ausgaenge, und der Unterschied zwischen den letzten beiden ist der
-- ganze Punkt: ein 503 ist ein schlechter Moment, ein `Unregistered` ist ein
-- Geraet, das es nicht mehr gibt. Wer beides gleich behandelt, verliert
-- entweder Zustellungen oder sammelt tote Token.
create function public.push_zustellung_quittieren(
    p_notification_id uuid,
    p_token_id        uuid,
    p_ergebnis        text,
    p_fehler          text default null)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
-- Die Rueckgabespalten heissen wie die Tabellenspalten, und an unqualifizierten
-- Stellen — `on conflict (notification_id, token_id)` — waere das mehrdeutig.
-- `use_column` entscheidet solche Faelle zugunsten der SPALTE; die Parameter
-- tragen alle ein `p_` und kollidieren darum nie.
#variable_conflict use_column
declare
  v_versuche int;
begin
  if p_ergebnis not in ('zugestellt', 'vorlaeufig', 'dauerhaft') then
    raise exception 'push_zustellung_quittieren: unbekanntes Ergebnis %', p_ergebnis
      using errcode = '22023';
  end if;

  if p_ergebnis = 'dauerhaft' then
    -- Das Geraet gibt es nicht mehr. Die Zustellzeile geht per Kaskade mit.
    delete from public.push_tokens where id = p_token_id;
    return;
  end if;

  if p_ergebnis = 'zugestellt' then
    update public.push_zustellungen
       set zustand = 'zugestellt', letzter_fehler = null
     where notification_id = p_notification_id and token_id = p_token_id;
    return;
  end if;

  -- vorlaeufig: hochzaehlen und zurueckstellen. Nach fuenf Versuchen aufgeben —
  -- ein Hinweis, der eine Stunde spaeter ankaeme, ist keiner mehr, und die
  -- Zeile steht ohnehin in der Glocke.
  update public.push_zustellungen
     set versuche          = versuche + 1,
         letzter_fehler    = p_fehler,
         zustand           = case when versuche + 1 >= 5 then 'aufgegeben' else 'offen' end,
         naechster_versuch = now() + (interval '1 minute' * power(2, versuche)::int)
   where notification_id = p_notification_id and token_id = p_token_id
  returning versuche into v_versuche;
end $$;

comment on function public.push_zustellung_quittieren(uuid, uuid, text, text) is
  'AGE-641: haelt fest, wie eine Zustellung ausging. `dauerhaft` entfernt das '
  'Token (das Geraet gibt es nicht mehr), `vorlaeufig` stellt mit wachsendem '
  'Abstand zurueck und gibt nach fuenf Versuchen auf. Beides ueber diese RPC '
  'und nicht direkt, weil `service_role` keine Tabellenrechte haelt.';

-- ── 6. Rechte: nichts fuer Clients, Ausfuehrung fuer den Dienst ─────────────
-- Der `grant … to service_role` ist die Haelfte, die in der ersten Fassung
-- der Aufgabenliste fehlte — ohne ihn scheitert die Edge Function erst zur
-- Laufzeit (gefunden von der Plan-Review).
revoke execute on function public.push_auftraege_holen(uuid)
  from public, anon, authenticated;
revoke execute on function public.push_auftraege_faellig(int)
  from public, anon, authenticated;
revoke execute on function public.push_zustellung_quittieren(uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.push_auftraege_holen(uuid) to service_role;
grant execute on function public.push_auftraege_faellig(int) to service_role;
grant execute on function public.push_zustellung_quittieren(uuid, uuid, text, text) to service_role;
