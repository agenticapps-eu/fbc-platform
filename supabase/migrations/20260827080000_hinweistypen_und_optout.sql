-- AGE-620 — vier In-App-Hinweistypen und ihr Opt-out.
-- Donald, 2026-08-27. Change: openspec/changes/glocke-und-hinweistypen/.
--
-- ══ BEFUND ══════════════════════════════════════════════════════════════════
-- Die Glocke in der Kopfzeile ist ein toter Knopf (AppShell.tsx:566), und das
-- Frontend liest `notifications` an NULL Stellen — waehrend drei Typen seit Juni
-- hineinschreiben. Diese Hinweise hat nie jemand gesehen.
--
-- Die Glocke selbst braucht keine Migration. Was eine braucht, ist das Opt-out:
-- `member_settings` traegt heute KEINEN EINZIGEN In-App-Schalter.
--
-- ══ WAS DIE PLAN-REVIEW UMGEWORFEN HAT ══════════════════════════════════════
-- Der erste Entwurf hatte fuenf Typen und eine falsche Begruendung.
--
-- 1. ER BEHAUPTETE EINE STUFENSCHWELLE, DIE ES NICHT MEHR GIBT.
--    Gemessen wurde `activation_gate.sql:157` — `visibility='members'` verlange
--    `has_level(4)`. Diese Policy ist seit `20260826100000` (AGE-601) ERSETZT:
--      is_activated() and (public or members or eigener Beitrag)
--    Keine Schwelle. Der Plan entstand am 27.08., die Ersetzung am 26.08. — die
--    Messung war einen Tag alt und trotzdem falsch. Wer eine Policy misst, muss
--    die JUENGSTE Migration suchen, nicht die erstbeste.
--
-- 2. `prime`/`legacy` gibt es nicht mehr. Check-Constraint seit
--    `20260715150000:262-265` bzw. `:284-287`: nur `('public','members')`.
--    Die geplanten Szenarien darueber waren nicht konstruierbar.
--
-- 3. DER TYP „NEUES MITGLIED" IST ENTFALLEN (Donald, 27.08.). Aktivieren sich in
--    der Startwoche ~70 Mitglieder nacheinander, bekaeme das letzte 69 Hinweise
--    auf einmal — die Glocke waere in Woche eins nur dafuer da. Damit entfaellt
--    der Trigger auf `profiles` GANZ, und mit ihm die Fragen nach Ereignis,
--    Reaktivierung, Import und Schutzschalter.
--
-- 4. EIN EVENT WAERE DOPPELT ANGEKUENDIGT WORDEN. `trg_event_feed_post`
--    (`20260813100000:220`) spiegelt jedes Event MIT HOST synchron als
--    `posts`-Zeile mit `kind='event'`. Der Posts-Trigger feuert deshalb nur fuer
--    `kind='member'`; der Events-Trigger bleibt eigenstaendig, damit ein Event
--    OHNE Host — fuer das kein Spiegel entsteht — ueberhaupt angekuendigt wird.
--
-- ══ WARUM HIER KEIN PRAEDIKAT ABGESCHRIEBEN STEHT ═══════════════════════════
-- Genau daran ist der erste Entwurf gescheitert. Die Empfaengerbedingung ruft
-- `is_activated_profile()` — DIESELBE Funktion, die die Policies rufen —, statt
-- ihren Inhalt zu wiederholen. Und die Zusage im Test prueft PARITAET: sie
-- impersoniert jeden Empfaenger und behauptet, dass er den Gegenstand SIEHT.
-- Eine Abschrift hat ein Verfallsdatum; eine Paritaetszusage faengt das naechste
-- AGE-601.

-- ── 1. Die vier Schalter ────────────────────────────────────────────────────
-- Default AN: wer die Einstellung nie geoeffnet hat, wird benachrichtigt.
-- `not null`, damit es keinen dritten Zustand „unbekannt" gibt, den irgendwo
-- jemand anders aufloest als hier.
alter table public.member_settings
  add column notify_inapp_post    boolean not null default true,
  add column notify_inapp_event   boolean not null default true,
  add column notify_inapp_comment boolean not null default true,
  add column notify_inapp_like    boolean not null default true;

comment on column public.member_settings.notify_inapp_post is
  'AGE-620: Hinweis in der Glocke, wenn ein Mitglied einen Beitrag schreibt.';
comment on column public.member_settings.notify_inapp_event is
  'AGE-620: Hinweis in der Glocke, wenn ein Event angelegt wird.';
comment on column public.member_settings.notify_inapp_comment is
  'AGE-620: Hinweis in der Glocke bei einem Kommentar auf den eigenen Beitrag.';
comment on column public.member_settings.notify_inapp_like is
  'AGE-620: Hinweis in der Glocke bei einem Like auf den eigenen Beitrag.';

-- Kein neuer Grant noetig, und das ist gemessen statt angenommen:
-- `grants_test.sql:51` fuehrt `member_settings/authenticated=INSERT,SELECT,UPDATE`
-- TABELLENWEIT, und die Spalten-Assertion (`:113-127`) deckt eine feste
-- Tabellenliste ab, in der `member_settings` nicht vorkommt. Beide Zusagen
-- bleiben unberuehrt.

-- ── 2. Das Opt-out lesen ────────────────────────────────────────────────────
-- `SECURITY DEFINER`, weil die Zeile des EMPFAENGERS gelesen wird und
-- `member_settings_own` streng eigene-Zeile ist — als anfragende Rolle saehe die
-- Funktion die fremde Zeile nie, und das Opt-out liefe still ins Leere.
--
-- ABER: KEIN Recht zurueck. `is_contactable` braucht ein
-- `grant … to authenticated`, weil es aus POLICY-AUSDRUECKEN als die anfragende
-- Rolle laeuft. Diese hier wird ausschliesslich aus den Trigger-Funktionen
-- gerufen. Ein Rueckgabe-Grant machte sie zu einem Orakel auf vier Boolesche je
-- fremdem Mitglied — klein, aber grundlos. Befund der Plan-Review (opencode).
create function public.hinweis_erwuenscht(p_profile_id uuid, p_typ text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(
    (select case p_typ
              when 'post_created'    then ms.notify_inapp_post
              when 'event_created'   then ms.notify_inapp_event
              when 'comment_on_post' then ms.notify_inapp_comment
              when 'like_on_post'    then ms.notify_inapp_like
            end
       from public.member_settings ms
      where ms.profile_id = p_profile_id),
    -- Keine Zeile, oder ein Typ ohne Schalter: benachrichtigen. Ein Opt-OUT
    -- wirkt nur, wo es ausgesprochen wurde.
    true
  );
$$;

comment on function public.hinweis_erwuenscht(uuid, text) is
  'AGE-620: Will p_profile_id Hinweise vom Typ p_typ? Innerei der Trigger, '
  'keine API — bewusst fuer KEINE Client-Rolle ausfuehrbar, sonst waere sie ein '
  'Orakel auf fremde Einstellungen.';

-- Alle vier Rollen namentlich (AGE-622), und nichts zurueck.
revoke execute on function public.hinweis_erwuenscht(uuid, text)
  from public, anon, authenticated, service_role;

-- ── 3. Der Rundruf ──────────────────────────────────────────────────────────
-- EIN `insert … select`, keine Schleife in plpgsql. Bei ~70 Konten sind das bis
-- zu 69 Zeilen synchron in der ausloesenden Transaktion — als Mengenoperation
-- einstellige Millisekunden, als Schleife das Vielfache.
--
-- `is distinct from` statt `<>`: bei einem Event ohne Host ist der Ausloeser
-- `null`, und `p.id <> null` waere fuer JEDE Zeile `null` — der Rundruf ginge
-- an niemanden, lautlos.
create function public.hinweis_rundruf(p_typ text, p_ausloeser uuid, p_payload jsonb)
  returns void
  language sql
  security definer
  set search_path = ''
as $$
  insert into public.notifications (profile_id, type, payload)
  select p.id, p_typ, p_payload
    from public.profiles p
   where p.id is distinct from p_ausloeser
     and public.is_activated_profile(p.id)
     and public.hinweis_erwuenscht(p.id, p_typ);
$$;

comment on function public.hinweis_rundruf(text, uuid, jsonb) is
  'AGE-620: schreibt EINEN Hinweis je empfangsberechtigtem Mitglied. '
  'Die Bedingung RUFT is_activated_profile, statt sie abzuschreiben — genau '
  'daran ist der erste Entwurf dieses Changes gescheitert. Innerei der Trigger.';

revoke execute on function public.hinweis_rundruf(text, uuid, jsonb)
  from public, anon, authenticated, service_role;

-- ── 4. Neuer Beitrag ────────────────────────────────────────────────────────
create function public.hinweis_neuer_beitrag() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_name text;
begin
  -- NUR Mitgliedsbeitraege. Ein Event mit Host wird von `trg_event_feed_post`
  -- als `kind='event'`-Zeile gespiegelt; ohne diese Zeile kuendigte jedes Event
  -- zweimal an, an denselben Empfaengerkreis.
  if new.kind is distinct from 'member' then
    return null;
  end if;

  select p.name into v_name from public.profiles p where p.id = new.author_id;

  -- Kennungen plus Anzeigename, KEIN Beitragstext: eine Hinweiszeile
  -- unterliegt nach dem Schreiben nicht mehr der Sichtbarkeit ihres
  -- Gegenstands, Text darin ueberlebte eine spaetere Verschaerfung.
  perform public.hinweis_rundruf(
    'post_created',
    new.author_id,
    jsonb_build_object('post_id', new.id, 'autor_id', new.author_id, 'autor_name', v_name)
  );
  return null;
end;
$$;

comment on function public.hinweis_neuer_beitrag() is
  'AGE-620: kuendigt einen Mitgliedsbeitrag an. Innerei des Triggers, keine API.';
revoke execute on function public.hinweis_neuer_beitrag()
  from public, anon, authenticated, service_role;

create trigger trg_hinweis_neuer_beitrag
  after insert on public.posts
  for each row execute function public.hinweis_neuer_beitrag();

-- ── 5. Neues Event ──────────────────────────────────────────────────────────
-- Eigenstaendig und nicht ueber den Spiegelbeitrag: ein Event OHNE Host
-- erzeugt keinen Spiegel und bliebe sonst unangekuendigt.
create function public.hinweis_neues_event() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  perform public.hinweis_rundruf(
    'event_created',
    new.host_id,
    jsonb_build_object('event_id', new.id, 'titel', new.title)
  );
  return null;
end;
$$;

comment on function public.hinweis_neues_event() is
  'AGE-620: kuendigt ein Event an. Innerei des Triggers, keine API.';
revoke execute on function public.hinweis_neues_event()
  from public, anon, authenticated, service_role;

create trigger trg_hinweis_neues_event
  after insert on public.events
  for each row execute function public.hinweis_neues_event();

-- ── 6. Kommentar und Like auf den eigenen Beitrag ───────────────────────────
-- Kein Rundruf: genau ein Empfaenger, der Eigentuemer. Er darf seinen eigenen
-- Beitrag immer lesen — die Paritaetsfrage stellt sich hier nicht.
create function public.hinweis_auf_meinem_beitrag() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_post   uuid;
  v_actor  uuid;
  v_typ    text;
  v_owner  uuid;
  v_name   text;
begin
  if tg_table_name = 'comments' then
    v_post  := new.post_id;
    v_actor := new.author_id;
    v_typ   := 'comment_on_post';
  else
    v_post  := new.post_id;
    v_actor := new.profile_id;
    v_typ   := 'like_on_post';
  end if;

  select p.author_id into v_owner from public.posts p where p.id = v_post;

  -- Auf dem eigenen Beitrag zu handeln kuendigt niemandem etwas an.
  if v_owner is null or v_owner = v_actor then
    return null;
  end if;
  if not public.hinweis_erwuenscht(v_owner, v_typ) then
    return null;
  end if;

  select p.name into v_name from public.profiles p where p.id = v_actor;

  insert into public.notifications (profile_id, type, payload)
  values (
    v_owner,
    v_typ,
    jsonb_build_object('post_id', v_post, 'from_id', v_actor, 'from_name', v_name)
  );
  return null;
end;
$$;

comment on function public.hinweis_auf_meinem_beitrag() is
  'AGE-620: Kommentar oder Like auf den eigenen Beitrag. EINE Funktion fuer '
  'beide Tabellen, weil es dieselbe Aussage ist; unterschieden wird an '
  'tg_table_name. Innerei der Trigger, keine API.';
revoke execute on function public.hinweis_auf_meinem_beitrag()
  from public, anon, authenticated, service_role;

create trigger trg_hinweis_kommentar
  after insert on public.comments
  for each row execute function public.hinweis_auf_meinem_beitrag();

create trigger trg_hinweis_like
  after insert on public.post_likes
  for each row execute function public.hinweis_auf_meinem_beitrag();

-- ── 7. Realtime ─────────────────────────────────────────────────────────────
-- GEFUNDEN IN DER SICHTPROBE, nicht im Test: der Zaehler an der Glocke blieb bei
-- 1 stehen, waehrend in der Tabelle 2 standen. Grund war nicht das Abo, sondern
-- dass `notifications` gar nicht in der Publikation `supabase_realtime` steht —
-- Postgres sendet dafuer schlicht keine Ereignisse, und der Kanal wartet ewig
-- auf etwas, das nie kommt.
--
-- Kein jsdom-Test haette das gefunden: dort gibt es keinen Server, der etwas
-- senden koennte. Und kein pgTAP-Test: die Zeile in der Tabelle war ja richtig.
-- Nur der Browser gegen den laufenden Stack sieht diese Luecke.
--
-- Dasselbe Muster wie `20260614140000_messages_realtime.sql` — inklusive der
-- Existenzpruefung, weil `alter publication … add table` bei einer bereits
-- aufgenommenen Tabelle wirft und die Migration sonst beim zweiten Lauf bricht.
--
-- Supabase wendet die RLS der Tabelle auf Realtime an: ein Client bekommt nur
-- Zeilen, die er unter `notifications_own` auch SELECTen duerfte — also nur
-- eigene. Keine zusaetzliche Policy noetig. REPLICA IDENTITY bleibt Standard:
-- die Glocke verbraucht nur INSERTs, und die Standard-Identitaet traegt die
-- neue Zeile.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
