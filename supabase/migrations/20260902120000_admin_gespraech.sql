-- AGE-628 — Der Admin eroeffnet ein Gespraech ohne Kontaktanfrage.
--
-- Aufgaben 4.2–4.6 aus openspec/changes/feedback-ausbauen/tasks.md. Die drei
-- scheiternden Zusagen stehen seit 4.1 in
-- supabase/tests/admin_gespraech_test.sql (3 von 3 rot).
--
-- ══ DIE AUSNAHME HAENGT AM GESPRAECH, NICHT AN DER ROLLE ═══════════════════
-- `message_threads.admin_eroeffnet`, nicht „wer eine Nachricht von einem Admin
-- bekommen hat, darf antworten". Zwei Gruende, beide tragend:
--   * Die Freischaltung bleibt auf GENAU DIESEN EINEN Faden begrenzt. Das
--     Mitglied gewinnt kein Senderecht gegenueber sonst jemandem.
--   * Sie ueberlebt es, wenn der Admin spaeter seine Rolle verliert. Eine
--     Regel an der Rolle naehme dem Mitglied mitten im Gespraech die Antwort.
--
-- ══ DIE KLAMMERFALLE, UND WARUM DIE POLICY NEU GESCHRIEBEN WIRD ════════════
-- Die erste Entwurfsfassung sagte, die Teilnehmerpruefung bleibe „unangetastet"
-- und die contact_requests-Bedingung werde zu `( exists (…) or is_admin() )`.
-- Beides zusammen geht NICHT: die Teilnahmepruefung steht INNERHALB desselben
-- `exists`. Wer ihn als Ganzes klammert, hebt sie mit auf — und baut einen
-- Admin, der in JEDES fremde Gespraech schreiben darf. Das genaue Gegenteil
-- der zugesagten engen Ausnahme.
--
-- Deshalb fuehren beide Policies unten die zwei Bedingungen GETRENNT:
-- Teilnahme eigenstaendig, Ausnahme nur an der Freigabe-Bedingung.
--
-- ══ BEIDE POLICIES, NICHT EINE ═════════════════════════════════════════════
-- Ein Admin, der ein Gespraech anlegen, aber nicht hineinschreiben kann, sieht
-- aus wie ein funktionierender Weg und bricht erst beim Absenden.
--
-- ══ AUFGABE 4.6 — DIE VORGAENGERFASSUNG, WOERTLICH ═════════════════════════
-- Aus `pg_policies` gezogen, damit ein spaeterer Leser den Unterschied sieht,
-- ohne die Historie zu durchsuchen. Beide stammen aus
-- 20260806080100_activation_gate.sql.
--
--   threads_insert  WITH CHECK:
--     (is_activated()
--      AND ((a_profile_id = (SELECT auth.uid())) OR (b_profile_id = (SELECT auth.uid())))
--      AND (EXISTS (SELECT 1
--             FROM contact_requests cr
--            WHERE ((cr.status = 'accepted')
--              AND (((cr.from_id = message_threads.a_profile_id) AND (cr.to_id = message_threads.b_profile_id))
--                OR ((cr.from_id = message_threads.b_profile_id) AND (cr.to_id = message_threads.a_profile_id)))))))
--
--   messages_insert WITH CHECK:
--     (is_activated()
--      AND (sender_id = (SELECT auth.uid()))
--      AND (EXISTS (SELECT 1
--             FROM (message_threads t
--               JOIN contact_requests cr ON (((cr.status = 'accepted')
--                 AND (((cr.from_id = t.a_profile_id) AND (cr.to_id = t.b_profile_id))
--                   OR ((cr.from_id = t.b_profile_id) AND (cr.to_id = t.a_profile_id))))))
--            WHERE ((t.id = messages.thread_id)
--              AND ((t.a_profile_id = (SELECT auth.uid())) OR (t.b_profile_id = (SELECT auth.uid())))))))
--
-- Hier steht die Falle schwarz auf weiss: in der zweiten Fassung sind
-- Teilnahme (`t.a_profile_id = auth.uid() or …`) und Freigabe (der JOIN auf
-- `contact_requests`) EIN Ausdruck.

-- ── 1. Die Markierung am Gespraech (Aufgabe 4.2) ────────────────────────────
-- `not null default false`: der Bestand ist damit vollstaendig beantwortet,
-- und keine Abfrage muss `is not true` schreiben.
alter table public.message_threads
  add column if not exists admin_eroeffnet boolean not null default false;

comment on column public.message_threads.admin_eroeffnet is
  'Wurde dieses Gespraech von einem Admin ohne angenommene Kontaktanfrage '
  'eroeffnet (AGE-628)? Schaltet BEIDE Seiten zum Senden frei, und zwar nur '
  'fuer diesen einen Faden. Gesetzt ausschliesslich von '
  'admin_gespraech_oeffnen() und nur beim NEUANLEGEN; die threads_insert-'
  'Policy verbietet einem Mitglied ausdruecklich, die Marke selbst zu setzen.';

-- ── 2. Der serverseitige Oeffnungs-Weg (Aufgabe 4.3) ────────────────────────
-- SECURITY DEFINER, weil er drei Dinge tun muss, die der Aufrufer nicht darf:
-- die Marke setzen, ein bestehendes Gespraech auch dann finden, wenn es ihn
-- nichts angeht, und das Ganze in EINER Anweisung.
--
-- ══ WARUM NORMALISIERT WIRD ════════════════════════════════════════════════
-- `message_threads_unique_pair` steht auf (a, b) und erzwingt die Ordnung des
-- Paares NICHT: (x, y) und (y, x) verletzen ihn beide nicht und laegen als
-- zwei Gespraeche nebeneinander. `least`/`greatest` ist dieselbe
-- Normalisierung, die handle_contact_request_change() seit jeher benutzt —
-- deshalb trifft der Konflikt auch bestehende Faeden.
--
-- ══ WARUM `on conflict do nothing` UND EIN NACHSCHLAG REICHT ═══════════════
-- Zwischen Nachsehen und Anlegen laege sonst ein Wettrennen, das genau dann
-- zuschlaegt, wenn zwei Admins dieselbe Zeile oeffnen. `on conflict do
-- nothing` WARTET auf eine gleichzeitig laufende Einfuegung desselben Paares
-- und tut danach nichts; der nachfolgende `select` nimmt unter READ COMMITTED
-- einen frischen Schnappschuss und sieht die inzwischen festgeschriebene
-- Zeile. Unter REPEATABLE READ traefe das nicht zu — die Verbindungen dieser
-- Anwendung laufen alle unter der Vorgabe READ COMMITTED.
--
-- ══ DIE MARKE NUR BEIM NEUANLEGEN ══════════════════════════════════════════
-- Sie steht in der `values`-Liste und in keinem `do update`. Ein bestehendes,
-- gewoehnliches Gespraech wird durch einen Admin-Aufruf also NICHT
-- nachtraeglich freigeschaltet — sonst oeffnete ein einziger Klick einen
-- Faden, den zwei Mitglieder unter ihren eigenen Bedingungen fuehren.
create or replace function public.admin_gespraech_oeffnen(p_ziel uuid)
  returns uuid
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  v_ich uuid := (select auth.uid());
  v_id  uuid;
begin
  -- `raise` und nicht „leer": wer kein Recht hat, ein Gespraech zu eroeffnen,
  -- darf keine Kennung bekommen — auch keine `null`, die wie ein Fehlschlag
  -- der Anlage aussieht.
  if not public.is_admin() then
    raise exception 'forbidden: admin_gespraech_oeffnen' using errcode = '42501';
  end if;

  if p_ziel is null or p_ziel = v_ich then
    raise exception 'admin_gespraech_oeffnen: kein Selbstgespraech'
      using errcode = '22023';
  end if;

  insert into public.message_threads (a_profile_id, b_profile_id, admin_eroeffnet)
  values (least(v_ich, p_ziel), greatest(v_ich, p_ziel), true)
  on conflict (a_profile_id, b_profile_id) do nothing
  returning id into v_id;

  if v_id is null then
    select t.id into v_id
      from public.message_threads t
     where t.a_profile_id = least(v_ich, p_ziel)
       and t.b_profile_id = greatest(v_ich, p_ziel);
  end if;

  return v_id;
end $$;

revoke execute on function public.admin_gespraech_oeffnen(uuid) from public, anon;
grant  execute on function public.admin_gespraech_oeffnen(uuid) to authenticated;

comment on function public.admin_gespraech_oeffnen(uuid) is
  'Oeffnet das Gespraech zwischen dem aufrufenden Admin und p_ziel und gibt '
  'dessen Kennung zurueck (AGE-628) — das bestehende ODER ein neues. '
  'Normalisiert das Paar ueber least/greatest, weil der Unique-Index auf '
  '(a, b) die Ordnung nicht erzwingt und ein vertauschtes Paar sonst als '
  'zweites Gespraech danebenlaege. Setzt admin_eroeffnet NUR beim '
  'Neuanlegen: ein bestehendes, gewoehnliches Gespraech wird dadurch nicht '
  'nachtraeglich freigeschaltet. Bricht fuer Nicht-Admins mit 42501 ab und '
  'fuer ein Selbstgespraech mit 22023.';

-- ── 3. threads_insert: Teilnahme eigenstaendig (Aufgabe 4.4) ────────────────
-- Drei Aenderungen gegenueber der Fassung im Kopf:
--   * Die Freigabe-Bedingung bekommt `or public.is_admin()`.
--   * `not admin_eroeffnet` kommt dazu — ein Mitglied darf die Marke nicht
--     selbst setzen. Ohne diese Zeile eroeffnete sich jeder seinen eigenen
--     Freifahrtschein.
--   * Die Teilnahmepruefung steht unveraendert als EIGENER Konjunktionsteil.
--     Sie war hier schon getrennt; in `messages_insert` war sie es nicht.
drop policy if exists threads_insert on public.message_threads;
create policy threads_insert on public.message_threads
  for insert to authenticated
  with check (
    public.is_activated()
    and not admin_eroeffnet
    and (
      a_profile_id = (select auth.uid())
      or b_profile_id = (select auth.uid())
    )
    and (
      exists (
        select 1 from public.contact_requests cr
         where cr.status = 'accepted'
           and (
             (cr.from_id = message_threads.a_profile_id and cr.to_id = message_threads.b_profile_id)
             or (cr.from_id = message_threads.b_profile_id and cr.to_id = message_threads.a_profile_id)
           )
      )
      or public.is_admin()
    )
  );

-- ── 4. messages_insert: Teilnahme HERAUSGELOEST (Aufgabe 4.5) ───────────────
-- Das ist die Stelle, an der die Klammerfalle sitzt. Die Teilnahme steht jetzt
-- in einem EIGENEN `exists`, die Freigabe in einem zweiten. Nur der zweite
-- traegt die Ausnahme.
--
-- Wer beide je wieder zusammenzieht, oeffnet dem Admin jedes fremde Gespraech.
-- Die Zusage, die das faengt, steht in `admin_gespraech_test.sql` und fuehrt
-- einen Admin als Handelnden in einem fremden, NICHT markierten Faden — Test
-- 27 in `rls_test.sql` faengt es ausdruecklich nicht.
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    public.is_activated()
    and sender_id = (select auth.uid())
    -- Teilnahme — eigenstaendig, und ohne jede Ausnahme.
    and exists (
      select 1 from public.message_threads t
       where t.id = messages.thread_id
         and (
           t.a_profile_id = (select auth.uid())
           or t.b_profile_id = (select auth.uid())
         )
    )
    -- Freigabe — hier, und nur hier, greift die Ausnahme.
    and (
      exists (
        select 1
          from public.message_threads t
          join public.contact_requests cr
            on cr.status = 'accepted'
           and (
             (cr.from_id = t.a_profile_id and cr.to_id = t.b_profile_id)
             or (cr.from_id = t.b_profile_id and cr.to_id = t.a_profile_id)
           )
         where t.id = messages.thread_id
      )
      or public.is_admin()
      or exists (
        select 1 from public.message_threads t
         where t.id = messages.thread_id and t.admin_eroeffnet
      )
    )
  );
