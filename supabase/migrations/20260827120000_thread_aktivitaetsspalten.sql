-- Aktivitaetsspalten auf `message_threads`: der Sortierschluessel der
-- Unterhaltungsliste (AGE-627).
-- Donald, 2026-08-27. Change: openspec/changes/chat-rechte-sidebar/.
--
-- ══ WARUM UEBERHAUPT EINE MIGRATION ════════════════════════════════════════
-- Die Liste braucht die N zuletzt bewegten Threads, je mit einer Vorschauzeile.
-- Heute laedt `chat.ts:240–265` ALLE Threads und ALLE Nachrichten aller dieser
-- Threads und nimmt im Client per `reduce` die juengste je Thread.
--
-- Das laesst sich ohne Server-Artefakt nicht begrenzen: **PostgREST kann nicht
-- nach einer Aggregatfunktion ueber eine to-many-Relation sortieren.**
-- `max(messages.created_at)` je Thread als Sortierschluessel der Thread-Abfrage
-- ist nicht ausdrueckbar — nach Kindspalten sortieren geht nur fuer
-- to-one-Beziehungen. Und „genau eine Nachricht je Thread" ist in einer
-- einzigen PostgREST-Abfrage ebenfalls nicht ausdrueckbar; `limit` gilt fuer
-- das Ergebnis, nicht je Gruppe. Bleibt: alles laden und im Client sortieren —
-- also genau das, was abgeschafft werden soll.
--
-- Die erste Fassung des Vorschlags versprach eine serverseitig sortierte,
-- begrenzte Seite UND „keine Migration". Beide Plan-Reviewer haben unabhaengig
-- voneinander darauf REQUEST-CHANGES gegeben. Sie hatten recht.
--
-- *Verworfen — eine DEFINER-RPC, die die Seite fertig liefert* (`distinct on` +
-- Fensterfunktion): kaeme ohne Schema-Umbau aus, legte aber das
-- Sichtbarkeitspraedikat an eine zweite Stelle neben die RLS — genau die Falle,
-- die `profiles_public` mit seinen vier Funktionen aufgemacht hat. Eine Spalte,
-- die unter der bestehenden Policy liegt, dupliziert nichts.
--
-- ══ WARUM DAS KEINE LESEBESTAETIGUNG IST ═══════════════════════════════════
-- `grants_test.sql:130–146` haelt fest, dass `message_threads` KEIN
-- UPDATE-Recht traegt, auch kein spaltenweises — weil AGE-583 hier einmal zwei
-- Lesestand-Spalten vorschlug, die fuer den Gespraechspartner lesbar gewesen
-- waeren. Diese drei Spalten sind etwas anderes, und das ist gemessen:
--   * `threads_select`  gibt die Thread-Zeile den ZWEI Teilnehmern frei
--     (20260806080100:214–219).
--   * `messages_select` gibt die Nachricht DENSELBEN zwei Teilnehmern frei
--     (20260806080100:221–231).
-- Beide Praedikate reichen exakt gleich weit. Wer `last_message_body` liest,
-- konnte dieselbe Nachricht schon vorher lesen — anders als ein Lesestand, der
-- eine Information ueber das VERHALTEN des anderen waere, die es sonst nirgends
-- gibt. Der Golden-Snapshot in `grants_test.sql` bleibt deshalb unveraendert:
-- hier wird kein Recht ausgesprochen.
--
-- ══ WARUM ZWEI TRIGGER UND NICHT EINER ═════════════════════════════════════
-- „Der Client schreibt diese Spalten nie" hat ZWEI Tueren:
--   * UPDATE auf `message_threads` — das Recht fehlt ohnehin.
--   * INSERT auf `message_threads` — das Recht BESTEHT (`threads_insert`, und
--     der Grant ist tabellenweit: `20260715140000:68`). Ohne Vorkehrung koennte
--     ein Mitglied beim Anlegen des Threads eine erfundene Vorschauzeile
--     setzen, die sein Gegenueber zu sehen bekaeme.
-- Der zweite Trigger verwirft deshalb Aktivitaetswerte aus einem INSERT.
--
-- *Verworfen — den Tabellen-Grant durch einen Spalten-Grant ersetzen*
-- (`grant insert (a_profile_id, b_profile_id)`): schlosse dieselbe Tuer, wuerde
-- aber die Zeile `message_threads/authenticated=INSERT,SELECT` aus
-- `role_table_grants` entfernen und damit den Golden-Snapshot brechen. Ein
-- Snapshot, der sich bei jeder Vorkehrung bewegt, hoert auf, etwas zu sagen.
--
-- ══ WARUM DER SORTIERSCHLUESSEL NUR VORWAERTS GEHT ═════════════════════════
-- `messages.created_at` ist vom Client setzbar — das INSERT-Recht ist
-- tabellenweit. Eine rueckdatierte Nachricht duerfte den Thread nicht nach
-- unten ziehen und die juengere Vorschauzeile nicht verdraengen. Die
-- `where`-Bedingung im Trigger ist eine Zeile und schliesst das.
--
-- ══ WARUM `nulls last` IM INDEX ════════════════════════════════════════════
-- `order by ... desc` ist in Postgres `nulls first`. Ein Thread ohne einzige
-- Nachricht stuende damit GANZ OBEN in der Liste, vor jeder laufenden
-- Unterhaltung. Der Index traegt die Ordnung deshalb ausdruecklich mit
-- `nulls last`; die Abfrage im Client muss `nullsFirst: false` mitgeben, sonst
-- benutzt sie ihn nicht.
--
-- ══ WARUM KEIN FREMDSCHLUESSEL AUF `last_message_sender_id` ════════════════
-- Er koennte nicht ins Leere zeigen: `message_threads.a_profile_id` und
-- `b_profile_id` haengen mit `on delete cascade` an `profiles`, und
-- `messages_insert` laesst nur einen der beiden Teilnehmer als Absender zu.
-- Faellt das Profil, faellt die Thread-Zeile mit. Ein FK waere hier zusaetzlich
-- ein Existenz-Orakel auf `profiles` gewesen, waere die Spalte je vom Client
-- beschreibbar geworden.
--
-- ══ DER NACHTRAG ═══════════════════════════════════════════════════════════
-- `distinct on (thread_id)` mit `order by thread_id, created_at desc, id desc`
-- nimmt je Thread die juengste Nachricht; `id desc` macht die Wahl bei
-- gleichem Zeitstempel eindeutig. Threads ohne Nachricht bleiben leer — das ist
-- der Zustand, den `nulls last` sortiert.
--
-- Der Nachtrag ist in `db reset` NICHT messbar: er laeuft vor jedem Fixture,
-- und es gibt keine `seed.sql`. Sein Beleg gehoert an den Rollout — nach
-- `db push` auf DEV und PROD zaehlen, wieviele Threads MIT Nachricht ein leeres
-- `last_message_at` haben. Erwartet: null.
--
-- Spalten, Funktionen, Trigger, Index und Nachtrag stehen in EINER Transaktion
-- — eine Migration ist eine.
--
-- Forward-only.

alter table public.message_threads
  add column last_message_at        timestamptz,
  add column last_message_body      text,
  add column last_message_sender_id uuid;

comment on column public.message_threads.last_message_at is
  'Sortierschluessel der Unterhaltungsliste, gefuehrt von '
  'messages_thread_aktivitaet(). Geht nur vorwaerts. NICHT von Hand schreiben — '
  'authenticated haelt kein UPDATE auf dieser Tabelle, und ein INSERT-Wert '
  'wird verworfen.';
comment on column public.message_threads.last_message_body is
  'Vorschauzeile der Unterhaltungsliste. Reicht genau so weit wie die '
  'Nachricht selbst: threads_select und messages_select geben beide den zwei '
  'Teilnehmern frei.';
comment on column public.message_threads.last_message_sender_id is
  'Absender der Vorschauzeile — entscheidet "Du: …" gegen den Namen des '
  'Partners. Ohne Fremdschluessel; siehe Migrationskopf.';

-- ── Der Schreiber ───────────────────────────────────────────────────────────
-- `security definer`, weil die Funktion `message_threads` schreibt und
-- `authenticated` dort kein UPDATE-Recht haelt (und keins bekommen soll).
-- Gehaertet wie jede DEFINER-Funktion in diesem Projekt: `set search_path = ''`
-- und alle Namen schemaqualifiziert.
create function public.messages_thread_aktivitaet()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.message_threads
     set last_message_at        = new.created_at,
         last_message_body      = new.body,
         last_message_sender_id = new.sender_id
   where id = new.thread_id
     and (last_message_at is null or last_message_at <= new.created_at);
  return new;
end $$;

revoke execute on function public.messages_thread_aktivitaet() from public, anon, authenticated;

create trigger messages_thread_aktivitaet_trg
  after insert on public.messages
  for each row execute function public.messages_thread_aktivitaet();

-- ── Die zweite Tuer ─────────────────────────────────────────────────────────
-- Kein `security definer`: die Funktion liest und schreibt nur NEW.
create function public.message_threads_aktivitaet_verwerfen()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.last_message_at        := null;
  new.last_message_body      := null;
  new.last_message_sender_id := null;
  return new;
end $$;

revoke execute on function public.message_threads_aktivitaet_verwerfen() from public, anon, authenticated;

create trigger message_threads_aktivitaet_verwerfen_trg
  before insert on public.message_threads
  for each row execute function public.message_threads_aktivitaet_verwerfen();

create index message_threads_last_message_at_idx
  on public.message_threads (last_message_at desc nulls last);

-- ── Nachtrag fuer den Bestand ───────────────────────────────────────────────
update public.message_threads t
   set last_message_at        = m.created_at,
       last_message_body      = m.body,
       last_message_sender_id = m.sender_id
  from (select distinct on (thread_id) thread_id, created_at, body, sender_id
          from public.messages
         order by thread_id, created_at desc, id desc) m
 where m.thread_id = t.id;
