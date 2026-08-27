-- ════════════════════════════════════════════════════════════════════════════
-- AGE-641 — der fuenfte Hinweistyp: eine Nachricht, ohne ihren Text
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/push-fundament/. Phase A, Schritt 3.
--
-- ══ DER BEFUND ═════════════════════════════════════════════════════════════
-- Chat-Nachrichten sind laut Donald der Hauptgrund fuer die App — und waren
-- der einzige Vorgang der Plattform, der GAR KEINEN Hinweis erzeugt. Vier
-- Typen deckten Beitraege, Events, Kommentare und Likes ab; drei weitere die
-- Kontaktanfragen; einer die Release-Notes. Nachrichten: nichts.
--
-- ══ DER TEXT STEHT NICHT IN DER ZEILE ══════════════════════════════════════
-- Nicht gekuerzt, nicht als Vorschau, gar nicht. Und zwar HIER und nicht erst
-- im Transport.
--
-- Der Unterschied ist nicht theoretisch. Stuende der Text in der Zeile, waere
-- „nicht auf den Sperrbildschirm" eine Eigenschaft der Edge Function — also
-- von Code, den jemand aendert, der die Begruendung nicht kennt. Er steht
-- nicht drin, also kann ihn kein Transport ausliefern: nicht der Push, nicht
-- ein spaeterer zweiter, nicht ein Export, nicht eine Admin-Flaeche.
--
-- Ein Sperrbildschirm liegt in einer Besprechung offen auf dem Tisch. Bei
-- einem Geschaeftsnetzwerk ist das keine Kleinigkeit.
--
-- ══ EINE ZEILE JE GESPRAECH, NICHT JE NACHRICHT ════════════════════════════
-- Solange der Hinweis zu einem Gespraech UNGELESEN ist, kommt kein zweiter
-- dazu. Zwanzig Nachrichten am Stueck sind ein Gespraech und nicht zwanzig
-- Anlaesse — sonst laeuft die Glocke bei jedem Chat voll und das Telefon
-- weckt zwanzigmal. Das Issue sagt es selbst: „Die erste Push-Nachricht
-- entscheidet, ob jemand Push anlaesst. Lieber zu wenig als zu viel."
--
-- Nach dem Lesen meldet sich das Gespraech wieder — sonst waere es nach der
-- ersten Nachricht fuer immer still, und genau dafuer steht eine eigene
-- Gegenprobe im Test.
--
-- VERWORFEN: die bestehende Zeile auffrischen (created_at hochsetzen), damit
-- das Gespraech in der Glocke nach oben rutscht. Dann bedeutete `created_at`
-- nicht mehr „seit wann liegt etwas an", und die Glocke sortiert danach.
-- Verworfen auch: gar nicht zusammenfassen. Das ist der Laerm oben.
--
-- ══ EINS ZU EINS ═══════════════════════════════════════════════════════════
-- Gespraeche sind strikt zweiseitig (`specs/messaging/spec.md:3`,
-- `message_threads_unique_pair`). Ein Gegenueber je Nachricht ist deshalb
-- heute richtig. Kaeme je ein Gruppenfaden dazu, ist DIESE Funktion die
-- Stelle, die es merken muss.
--
-- ══ `is_activated_profile`, NICHT `activated_at is not null` ═══════════════
-- Dieselbe Funktion, die die Policies rufen. Ein Gespraechsfaden kann aelter
-- sein als eine Deaktivierung; eine abgeschriebene Bedingung haette die
-- Sperre nicht mitbekommen.
--
-- Donald, 27.08.2026.
-- ════════════════════════════════════════════════════════════════════════════

create function public.hinweis_neue_nachricht() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_empfaenger uuid;
  v_name       text;
begin
  select case when t.a_profile_id = new.sender_id then t.b_profile_id
              else t.a_profile_id end
    into v_empfaenger
    from public.message_threads t
   where t.id = new.thread_id;

  -- Kein Gegenueber (verwaister Faden) oder an sich selbst: nichts zu tun.
  if v_empfaenger is null or v_empfaenger = new.sender_id then
    return new;
  end if;

  if not public.is_activated_profile(v_empfaenger) then
    return new;
  end if;

  if not public.hinweis_erwuenscht(v_empfaenger, 'message') then
    return new;
  end if;

  -- Zusammenfassung: liegt fuer dieses Gespraech schon ein UNGELESENER Hinweis,
  -- ist der Anlass bereits gemeldet.
  if exists (
    select 1
      from public.notifications n
     where n.profile_id = v_empfaenger
       and n.type = 'message'
       and n.read_at is null
       and n.payload->>'thread_id' = new.thread_id::text
  ) then
    return new;
  end if;

  select p.name into v_name from public.profiles p where p.id = new.sender_id;

  insert into public.notifications (profile_id, type, payload)
  values (
    v_empfaenger,
    'message',
    -- Kennungen und ein Name. Kein `body`, unter keinem Schluessel.
    jsonb_build_object(
      'thread_id',   new.thread_id,
      'sender_id',   new.sender_id,
      'sender_name', v_name
    )
  );

  return new;
end $$;

comment on function public.hinweis_neue_nachricht() is
  'AGE-641: schreibt dem Gegenueber einen Hinweis auf eine neue Nachricht — '
  'Absender und Gespraech, NIEMALS den Text. Eine Zeile je Gespraech, solange '
  'sie ungelesen ist. Innerei des Triggers, fuer keine Client-Rolle '
  'ausfuehrbar.';

-- Alle vier Rollen namentlich (AGE-622), und nichts zurueck.
revoke execute on function public.hinweis_neue_nachricht()
  from public, anon, authenticated, service_role;

create trigger trg_hinweis_neue_nachricht
  after insert on public.messages
  for each row execute function public.hinweis_neue_nachricht();
