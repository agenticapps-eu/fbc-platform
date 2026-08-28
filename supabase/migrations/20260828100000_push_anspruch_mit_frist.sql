-- ════════════════════════════════════════════════════════════════════════════
-- AGE-641 — der Anspruch bekommt eine Frist
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/push-fundament/. Nachtrag zu Phase A, Schritt 5b.
--
-- ══ WAS HIER REPARIERT WIRD ════════════════════════════════════════════════
--
-- `20260827240000` hat den Zustellzustand eingefuehrt, damit ein 429 oder 5xx
-- den Push nicht endgueltig verliert. Eine Luecke ist dabei offen geblieben,
-- und sie trifft genau den Fall, fuer den die Tabelle gebaut wurde:
--
--   `push_auftraege_holen` setzt die Zeile beim Holen auf `laeuft`, und NUR
--   `push_zustellung_quittieren` holt sie da wieder heraus.
--   `push_auftraege_faellig` sucht ausschliesslich nach `offen`.
--
-- Bricht die Edge Function zwischen Anspruch und Quittung weg — Zeitlimit,
-- Deploy mitten im Lauf, ein Absturz der Laufzeit —, steht die Zeile fuer
-- IMMER auf `laeuft`. Kein Wiederholungslauf findet sie je wieder. Der Push
-- ist verloren, und zwar dauerhafter als ohne die Tabelle: dort haette ein
-- erneuter Webhook-Aufruf ihn wenigstens noch einmal versucht.
--
-- Der Zustand ueberlebt also, aber niemand holt ihn ab. Das ist die Haelfte,
-- die eine Zustandsmaschine ohne Frist immer vergisst.
--
-- ══ DIE LOESUNG: DER ANSPRUCH GILT FUENF MINUTEN ═══════════════════════════
--
-- Beim Beanspruchen wird `naechster_versuch` vorgestellt. Damit ist das Feld
-- zweierlei, je nach Zustand — bei `offen` die Wartezeit des Rueckstellens,
-- bei `laeuft` das Ende der Frist — und beide Male beantwortet es dieselbe
-- Frage: ab wann darf sich jemand darum kuemmern.
--
-- Verworfen: eine eigene Spalte `beansprucht_am`. Sie truege dieselbe Aussage
-- ein zweites Mal, und der Wiederholungslauf muesste zwei Felder vergleichen
-- statt einem.
--
-- Fuenf Minuten, weil eine Edge Function ihr eigenes Zeitlimit deutlich davor
-- erreicht. Die Frist darf nicht kuerzer sein als der laengste ehrliche Lauf,
-- sonst holt der Wiederholungslauf einen Auftrag ein, der gerade zugestellt
-- wird — und das waere die Doppelzustellung, die der Primaerschluessel
-- eigentlich ausschliesst.
--
-- ══ UND WARUM EIN ZURUECKGEHOLTER ANSPRUCH ZAEHLT ══════════════════════════
--
-- Ohne das entstuende beim Reparieren die naechste Luecke: ein Auftrag, der
-- die Function jedes Mal umbringt, wuerde alle fuenf Minuten neu geholt, fuer
-- immer. `versuche` waechst deshalb auch beim Zurueckholen, und dieselbe
-- Grenze wie in `push_zustellung_quittieren` gilt — nach fuenf ist Schluss.
--
-- Donald, 28.08.2026.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Der Anspruch beim Webhook-Lauf bekommt seine Frist ───────────────────
create or replace function public.push_auftraege_holen(p_notification_id uuid)
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

  insert into public.push_zustellungen (notification_id, token_id)
  select p_notification_id, t.id
    from public.push_tokens t
   where t.profile_id = v_profile
  on conflict (notification_id, token_id) do nothing;

  return query
  with beansprucht as (
    update public.push_zustellungen z
       set zustand = 'laeuft',
           -- NEU: die Frist. Ohne sie bliebe die Zeile nach einem Absturz
           -- fuer immer liegen.
           naechster_versuch = now() + interval '5 minutes'
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
         -- FESTE Feldliste. Einschluss, nicht Ausschluss.
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

-- ── 2. Der Wiederholungslauf sammelt auch abgelaufene Ansprueche ein ────────
create or replace function public.push_auftraege_faellig(p_max int default 100)
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
#variable_conflict use_column
begin
  -- Zuerst aufgeben, was seine Versuche verbraucht hat. Sonst bliebe ein
  -- Auftrag, der die Function zuverlaessig umbringt, unbegrenzt in der
  -- Auswahl — nur eben ohne je zugestellt zu werden.
  update public.push_zustellungen
     set zustand        = 'aufgegeben',
         letzter_fehler = coalesce(letzter_fehler, 'Frist mehrfach verstrichen')
   where zustand = 'laeuft'
     and naechster_versuch <= now()
     and versuche >= 5;

  return query
  with faellig as (
    select z.notification_id, z.token_id, z.zustand
      from public.push_zustellungen z
     -- `laeuft` gehoert dazu: ein Anspruch, dessen Frist verstrichen ist,
     -- wurde nie quittiert. Das ist der reparierte Fall.
     where z.zustand in ('offen', 'laeuft')
       and z.naechster_versuch <= now()
     order by z.naechster_versuch
     limit p_max
     for update skip locked
  ),
  beansprucht as (
    update public.push_zustellungen z
       set zustand = 'laeuft',
           -- Ein ZURUECKGEHOLTER Anspruch zaehlt als Versuch; ein bisher
           -- unversuchter (`offen`) nicht — dessen Zaehler fuehrt die
           -- Quittung.
           versuche = case when f.zustand = 'laeuft' then z.versuche + 1 else z.versuche end,
           naechster_versuch = now() + interval '5 minutes'
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
  'AGE-641: holt liegengebliebene Auftraege fuer den Wiederholungslauf — auch '
  'solche, deren Anspruch abgelaufen ist, weil die Edge Function zwischen '
  'Holen und Quittieren wegbrach. `for update skip locked`, damit zwei Laeufe '
  'sich nicht gegenseitig blockieren und nicht dieselbe Zeile greifen.';

-- ── 3. Der Index muss den zweiten Zustand mitsehen ──────────────────────────
-- Der bisherige Teilindex deckte nur `offen` ab. Die Auswahl oben liest jetzt
-- beide Zustaende; ohne das hier faende sie die reparierten Zeilen nur ueber
-- einen vollen Durchlauf.
drop index if exists public.push_zustellungen_faellig_idx;
create index push_zustellungen_faellig_idx
  on public.push_zustellungen (naechster_versuch)
  where zustand in ('offen', 'laeuft');
