-- ════════════════════════════════════════════════════════════════════════════
-- AGE-641 — ein Schalter je Ereignis, fuer BEIDE Wege
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/push-fundament/. Phase A, Schritt 1.
--
-- ══ DER BEFUND ═════════════════════════════════════════════════════════════
-- Push kommt als ZWEITER Transport auf `notifications`. Damit steuert
-- `notify_inapp_*` ab sofort auch die Zustellung aufs Geraet — und der Name
-- sagt dann etwas anderes als er tut.
--
-- Das ist nicht bloss unschoen. Dieselbe Tabelle traegt bereits
-- `notify_email_requests`, `notify_email_events` und `notify_email_digest`.
-- Die Konvention ist `notify_<transport>_<ereignis>`, und sie traegt schon
-- einen zweiten Transport. `notify_inapp_*` fuer Push mitzubenutzen
-- widerspricht damit einer Regel, die in dieser Tabelle bereits Arbeit
-- leistet — nicht nur dem Wortsinn.
--
-- `notify_app_*` heisst: in der App. Glocke UND Geraet. `notify_email_*`
-- bleibt daneben stehen und bleibt unterscheidbar.
--
-- ══ ZWEI SPALTEN KOMMEN DAZU ═══════════════════════════════════════════════
-- `notify_app_message` — der fuenfte Hinweistyp. Chat-Nachrichten sind laut
-- Donald der Hauptgrund fuer die App und der einzige Vorgang der Plattform
-- ohne Hinweis.
--
-- `notify_app_contact` — und der ist eine LUECKE, kein Zuwachs. Die drei
-- Typen `contact_request`, `contact_request_accepted` und
-- `contact_request_declined` schreiben seit dem 14.06. Zeilen
-- (20260614100000:45,73,90) und die Glocke rendert sie
-- (HinweisGlocke.tsx:166-180) — abschaltbar waren sie nie. Sie fielen in
-- `hinweis_erwuenscht` durch das `case` hindurch auf `true`.
--
-- Solange sie nur in der Glocke standen, war das vertretbar. Sobald sie
-- gepusht werden — und Abschnitt 4 des Issues will genau das — waeren sie die
-- einzigen Push-Hinweise ohne Abschalter. Genau der eine, der jemanden dazu
-- bringt, Push GANZ abzuschalten.
--
-- ══ VERWORFEN ══════════════════════════════════════════════════════════════
-- Getrennte `notify_push_*`-Spalten neben `notify_app_*`. Zwei Schalter fuer
-- dasselbe Ereignis: wer die Glocke stummschaltet und trotzdem nachts vom
-- Telefon geweckt wird, hat den Schalter nicht verstanden — er hat ihn
-- benutzt. Das Issue nennt es selbst eine Falle.
--
-- Ebenfalls verworfen: den Namen behalten und nur dokumentieren. Ein
-- Kommentar, der einer Spalte widerspricht, wird beim naechsten Lesen
-- ueberlesen; der Spaltenname wird es nicht.
--
-- ══ KEIN GRANT NOETIG ══════════════════════════════════════════════════════
-- Gemessen, nicht angenommen — dieselbe Rechnung wie in 20260827080000:66-70.
-- `grants_test.sql` fuehrt `member_settings/authenticated=INSERT,SELECT,UPDATE`
-- TABELLENWEIT, und die Spalten-Assertion deckt eine feste Tabellenliste ab,
-- in der `member_settings` nicht vorkommt. Umbenennen und Anfuegen beruehren
-- beide Zusagen nicht. Fuer `push_tokens` gilt das NICHT — die Tabelle bringt
-- ihre eigenen Grants mit und steht im naechsten Schritt.
--
-- Donald, 27.08.2026.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Die vier bestehenden Schalter umbenennen ─────────────────────────────
-- `rename column` erhaelt Daten, Default, `not null` und jede Policy, die die
-- Spalte nennt. Ein `add`/`update`/`drop` taete das nicht und verloere
-- unterwegs die Einstellungen der Mitglieder.
alter table public.member_settings rename column notify_inapp_post    to notify_app_post;
alter table public.member_settings rename column notify_inapp_event   to notify_app_event;
alter table public.member_settings rename column notify_inapp_comment to notify_app_comment;
alter table public.member_settings rename column notify_inapp_like    to notify_app_like;

-- ── 2. Die zwei neuen ───────────────────────────────────────────────────────
-- Default AN wie die vier anderen: wer die Einstellung nie geoeffnet hat, wird
-- benachrichtigt. `not null`, damit es keinen dritten Zustand gibt.
alter table public.member_settings
  add column notify_app_message boolean not null default true,
  add column notify_app_contact boolean not null default true;

comment on column public.member_settings.notify_app_post is
  'AGE-641: Ein Mitglied schreibt einen Beitrag. Gilt fuer Glocke UND Push.';
comment on column public.member_settings.notify_app_event is
  'AGE-641: Ein Event wird angelegt. Gilt fuer Glocke UND Push.';
comment on column public.member_settings.notify_app_comment is
  'AGE-641: Kommentar auf den eigenen Beitrag. Gilt fuer Glocke UND Push.';
comment on column public.member_settings.notify_app_like is
  'AGE-641: Like auf den eigenen Beitrag. Gilt fuer Glocke UND Push.';
comment on column public.member_settings.notify_app_message is
  'AGE-641: Neue Chat-Nachricht. Gilt fuer Glocke UND Push. Der Hinweis nennt '
  'Absender und Gespraech und traegt den Nachrichtentext NICHT.';
comment on column public.member_settings.notify_app_contact is
  'AGE-641: Kontaktanfrage gestellt, angenommen oder abgelehnt. Gilt fuer '
  'Glocke UND Push. Deckt alle drei contact_request*-Typen mit EINEM Schalter: '
  'wer Anfragen nicht sehen will, will auch die Antwort darauf nicht.';

-- ── 3. Das Opt-out lesen — jetzt sieben Typen ───────────────────────────────
-- Rueckgabetyp unveraendert (`boolean`), darum traegt `create or replace`.
--
-- Die drei contact_request*-Typen lesen EINEN Schalter. Drei einzelne waeren
-- eine Einstellungsflaeche, auf der niemand die Anfrage abbestellt und die
-- Ablehnung behaelt.
--
-- Der `coalesce`-Boden bleibt `true` und bleibt der Normalfall: die meisten
-- Konten haben gar keine Zeile in `member_settings`. Er faengt aber ab jetzt
-- KEINEN unbekannten Typ mehr still ab — alle sieben stehen im `case`. Ein
-- achter Typ ohne Schalter wuerde weiterhin benachrichtigen, und das ist die
-- richtige Richtung: ein Opt-out wirkt nur, wo es ausgesprochen wurde.
create or replace function public.hinweis_erwuenscht(p_profile_id uuid, p_typ text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(
    (select case p_typ
              when 'post_created'              then ms.notify_app_post
              when 'event_created'             then ms.notify_app_event
              when 'comment_on_post'           then ms.notify_app_comment
              when 'like_on_post'              then ms.notify_app_like
              when 'message'                   then ms.notify_app_message
              when 'contact_request'           then ms.notify_app_contact
              when 'contact_request_accepted'  then ms.notify_app_contact
              when 'contact_request_declined'  then ms.notify_app_contact
            end
       from public.member_settings ms
      where ms.profile_id = p_profile_id),
    true
  );
$$;

comment on function public.hinweis_erwuenscht(uuid, text) is
  'AGE-641 (war AGE-620): Will p_profile_id Hinweise vom Typ p_typ? Gilt fuer '
  'Glocke UND Push — ein Schalter je Ereignis, nicht je Transport. Innerei der '
  'Trigger und der Zustellung, keine API: bewusst fuer KEINE Client-Rolle '
  'ausfuehrbar, sonst waere sie ein Orakel auf fremde Einstellungen.';

-- `create or replace` erhaelt die bestehende ACL. Die Entziehungen trotzdem
-- namentlich wiederholt (AGE-622): sie kosten nichts und machen aus einer
-- geerbten Eigenschaft eine ausgesprochene.
revoke execute on function public.hinweis_erwuenscht(uuid, text)
  from public, anon, authenticated, service_role;

-- ── 4. Den Kontakt-Trigger an den Schalter verdrahten ───────────────────────
-- GEFUNDEN VON DER PLAN-REVIEW, nicht beim Schreiben. Die Fassung oben legte
-- `notify_app_contact` an und trug die drei contact_request*-Typen in
-- `hinweis_erwuenscht` ein — und das war wirkungslos:
-- `handle_contact_request_change()` schreibt seine Zeilen UNBEDINGT und ruft
-- `hinweis_erwuenscht` mit keinem einzigen Aufruf. Der Schalter haette in den
-- Einstellungen gestanden und nichts getan. Ein Schalter, der luegt, ist
-- schlimmer als keiner.
--
-- ══ ZWEI AENDERUNGEN, EIN `create or replace` ══════════════════════════════
--
-- (a) DIE DREI HINWEISE FRAGEN DEN SCHALTER. Nur sie. Der Match-Status, die
--     Routing-Queue und das Anlegen des Gespraechsfadens bleiben UNBEDINGT:
--     wer keine Hinweise will, hat damit nicht auf eine angenommene
--     Kontaktanfrage verzichtet. Ein Opt-out auf Hinweise darf keine Daten
--     verschlucken.
--
-- (b) DER FREITEXT VERLAESST DIE NUTZLAST. `message` trug bisher eine von
--     einem Mitglied geschriebene Nachricht in die `notifications`-Zeile
--     (Fassung 20260614120000:178). Sobald dieser Typ gepusht wird — und
--     Abschnitt 4 des Issues will genau das —, stuende dieser Text auf einem
--     fremden Sperrbildschirm.
--
--     Die Glocke verliert dabei NICHTS: `HinweisGlocke.tsx:166-168` baut
--     „X moechte Sie kennenlernen." aus `from_name` und hat `message` nie
--     gelesen. Der Text wurde seit dem 14.06. geschrieben und nirgends
--     angezeigt.
--
-- ══ WAS HIER NICHT PASSIERT ════════════════════════════════════════════════
-- Die BESTEHENDEN Zeilen behalten ihren Freitext (Donald, 27.08.). Eine
-- schreibende Aenderung an echten Mitgliederdaten auf PROD ist der Schutz
-- nicht wert, den `send-push` ohnehin liefert: die Benachrichtigung wird dort
-- aus einer festen Feldliste gebaut und reicht keine Nutzlast durch.
--
-- ══ GRUNDLAGE ══════════════════════════════════════════════════════════════
-- Neu gefasst wird die Version aus 20260614120000:133 — NICHT die aus
-- 20260614100000:25, die sie ersetzt hat. Die Plan-Review zitierte die
-- ueberholte; nachgesehen wurde die geltende. Routing-Queue-Block und
-- `dkri`-Zweig stehen darum unveraendert mit drin.
--
-- Donald, 27.08.2026.
create or replace function public.handle_contact_request_change()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_from_name text;
  v_to_name   text;
  v_need_id   uuid;
  v_band      text;
begin
  if tg_op = 'INSERT' then
    -- New request → the originating match becomes 'requested'. Never downgrade an
    -- already-accepted pair; match_id is optional (profile-page requests may omit it).
    if new.match_id is not null then
      update public.matches
        set status = 'requested'
        where id = new.match_id and status = 'suggested';
    end if;

    -- §8: large-volume (dkri) requests land in the manager queue for visibility,
    -- in ADDITION to the normal flow. Resolve the driving large-volume need among
    -- the pair (prefer the largest band, then the newest). Idempotent per match.
    if new.routing = 'dkri' and new.match_id is not null then
      select n.id, n.tx_volume_band into v_need_id, v_band
      from public.needs n
      where n.profile_id in (new.from_id, new.to_id)
        and n.tx_volume_band in ('1m_10m', 'gt_10m')
      order by case n.tx_volume_band when 'gt_10m' then 2 else 1 end desc, n.created_at desc
      limit 1;

      insert into public.routing_queue (match_id, need_id, volume_band, routing)
      values (new.match_id, v_need_id, v_band, 'dkri')
      on conflict (match_id) do nothing;
    end if;

    -- AGE-641: der Hinweis fragt den Schalter. Kein `message` mehr.
    if public.hinweis_erwuenscht(new.to_id, 'contact_request') then
      select name into v_from_name from public.profiles where id = new.from_id;
      insert into public.notifications (profile_id, type, payload)
      values (
        new.to_id,
        'contact_request',
        jsonb_build_object(
          'request_id', new.id,
          'match_id',   new.match_id,
          'from_id',    new.from_id,
          'from_name',  v_from_name
        )
      );
    end if;
    return new;
  end if;

  -- UPDATE: only react to an actual status change (e.g. accept / decline).
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    select name into v_to_name from public.profiles where id = new.to_id;

    if new.status = 'accepted' then
      if new.match_id is not null then
        update public.matches set status = 'accepted' where id = new.match_id;
      end if;
      -- Open the chat: create the (normalized, unique) thread if absent.
      insert into public.message_threads (a_profile_id, b_profile_id)
      values (least(new.from_id, new.to_id), greatest(new.from_id, new.to_id))
      on conflict (a_profile_id, b_profile_id) do nothing;

      if public.hinweis_erwuenscht(new.from_id, 'contact_request_accepted') then
        insert into public.notifications (profile_id, type, payload)
        values (
          new.from_id,
          'contact_request_accepted',
          jsonb_build_object(
            'request_id', new.id, 'match_id', new.match_id,
            'to_id', new.to_id, 'to_name', v_to_name
          )
        );
      end if;

    elsif new.status = 'declined' then
      -- Mirror onto the match, but never undo an acceptance.
      if new.match_id is not null then
        update public.matches set status = 'declined'
          where id = new.match_id and status <> 'accepted';
      end if;

      if public.hinweis_erwuenscht(new.from_id, 'contact_request_declined') then
        insert into public.notifications (profile_id, type, payload)
        values (
          new.from_id,
          'contact_request_declined',
          jsonb_build_object(
            'request_id', new.id, 'match_id', new.match_id,
            'to_id', new.to_id, 'to_name', v_to_name
          )
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.handle_contact_request_change() is
  'AGE-641 (war AGE-234/§8): Spiegelt den Status einer Kontaktanfrage auf den '
  'Match, legt bei Annahme den Gespraechsfaden an, fuellt bei dkri die '
  'Routing-Queue — und schreibt die drei Hinweise NUR, wenn der Empfaenger sie '
  'will (notify_app_contact). Der Freitext der Anfrage steht seit AGE-641 NICHT '
  'mehr in der Nutzlast: die Glocke las ihn nie, und ein Push haette ihn auf '
  'einen fremden Sperrbildschirm gestellt.';
