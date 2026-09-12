-- Eine zugestellte Release-Note kuendigt sich selbst in der Aktivitaet an
-- (AGE-718).
-- Donald, 2026-09-12. Change: openspec/changes/release-notes-in-der-aktivitaet/.
--
-- ══ BEFUND ══════════════════════════════════════════════════════════════════
-- Eine Release-Note erreicht heute die Glocke und die Flaeche `/neues` — und
-- sonst nichts. Wer die Glocke wegklickt, erfaehrt von der Aenderung nie
-- wieder. Die Aktivitaet ist die Flaeche, die Mitglieder ohnehin lesen; dort
-- fehlt die Mitteilung.
--
-- ══ WARUM EINE DRITTE `kind` UND NICHT ZWEI QUELLEN IM CLIENT ══════════════
-- *Verworfen — die zwei Listen erst im Client mischen:* der Keyset-Cursor
-- muesste dann ueber `posts.veroeffentlicht_ab` UND `release_notes.sent_at`
-- zugleich laufen. Zwei Schluesselraeume in einem Cursor ueberspringen
-- Eintraege, und zwar STILL: die Seite ist voll, die Liste sieht vollstaendig
-- aus, und der fehlende Beitrag faellt niemandem auf. `feed.ts` traegt genau
-- dazu schon eine Warnung.
--
-- *Verworfen — ein Systemkonto schreibt gewoehnliche Beitraege:* `profiles.id`
-- ist ein Fremdschluessel auf `auth.users.id`. Ein Systemkonto waere damit ein
-- ECHTES Konto und erschiene im Verzeichnis, in der Mitgliederliste, im
-- Matching und als Empfaenger von Kontaktanfragen. Jede dieser Flaechen
-- braeuchte eine Ausnahme, und jede vergessene waere ein sichtbarer Fehler.
--
-- ══ WARUM EINE EIGENE SPALTE UND NICHT `ref_id` ════════════════════════════
-- `ref_id` traegt `posts_ref_id_fkey` auf `public.events`. Sie mitzubenutzen
-- hiesse, den Fremdschluessel zu entfernen und die Integritaet in einen CHECK
-- oder Trigger zu verlagern — eine geprueffte Zusage gegen eine nachgebaute
-- getauscht. Der Preis ist eine Spalte, die bei zwei von drei Arten leer ist;
-- das ist bereits der Zustand von `ref_id` und dort ausdruecklich akzeptiert.
--
-- Der Fremdschluessel heisst AUSGESCHRIEBEN `posts_release_note_id_fkey`: der
-- Client nennt ihn in der PostgREST-Einbettung
-- (`release_notes!posts_release_note_id_fkey(…)`). Ein generierter Name waere
-- eine stille Kopplung, die bei jeder Umbenennung bricht — dieselbe
-- Begruendung wie bei `posts_ref_id_fkey` (AGE-533).
--
-- ══ WARUM DER TRIGGER AM ZUSTANDSWECHSEL HAENGT, NICHT AM INSERT ═══════════
-- Die UPDATE-Policy auf `release_notes` traegt `with check (… and status =
-- 'draft')`. Ein Client kann `status` also niemals auf `sent` setzen; das kann
-- allein `send_release_note()`, und die Funktion fuehrt den Wechsel BEDINGT
-- aus (`where id = p_id and status = 'draft'`). Der Riegel gegen die
-- Doppelzustellung aus AGE-631 schuetzt damit ohne weiteres Zutun auch den
-- Feed-Beitrag: trifft das `update` nichts, feuert der Trigger nicht.
--
-- Deshalb steht der Insert NICHT im Rumpf von `send_release_note()`: als
-- Trigger gilt die Regel fuer jeden Weg zu `status = 'sent'`, auch fuer einen
-- kuenftigen zweiten. Im Funktionsrumpf gaelte sie nur fuer diesen einen
-- Aufrufer.
--
-- ══ WARUM SECURITY DEFINER ═════════════════════════════════════════════════
-- Als `invoker` scheiterte der Insert an `posts_write_own`
-- (`with check … kind = 'member'`) — und weil ein Trigger-Fehler das umgebende
-- `update` zurueckrollt, erreichte die Mitteilung dann NIE `sent`: aus einer
-- fehlenden Feed-Karte wuerde eine fehlgeschlagene Zustellung. Dieselbe
-- Begruendung wie bei `event_feed_post_sync()`.
--
-- ══ DIE ZWEI ZEITSPALTEN — DER TEUERSTE BEFUND DER PLAN-REVIEW ═════════════
-- (opencode, HOCH.) Der Feed ordnet und blaettert ueber `veroeffentlicht_ab`,
-- NICHT ueber `created_at`, und die Spalte traegt `default now()`. Der erste
-- Entwurf dieser Migration setzte nur `created_at`, weil er sich am
-- Event-Backfill (20260813100000) orientierte. Der ist von VOR dieser Spalte:
-- sie kam mit 20260829090000 und wurde fuer die damaligen Zeilen einmalig per
-- `update` nachgezogen. Fuer neue Zeilen gibt es diesen Nachzug nicht — alle
-- nachgetragenen Karten stuenden oben im Feed.
--
-- Die Lehre ist allgemeiner als der Fall: eine Vorlage aus dem Bestand ist an
-- IHREM Datum richtig, nicht am heutigen.
--
-- ══ DER SOLLWERT DES BACKFILLS IST NULL ════════════════════════════════════
-- Gemessen am 11.09. lesend gegen PROD und DEV: 0 Release-Notes gesamt, 0
-- zugestellt, 0 Entwuerfe — auf beiden. `posts.kind` traegt dort nur `member`
-- und `event`. Der Backfill erzeugt also NULL Zeilen, und das ist kein
-- Versehen: der Mechanismus aus AGE-631 ist gebaut und nie benutzt worden.
-- Der Backfill steht trotzdem, weil die Zusage dem Zustand gilt, nicht dem
-- heutigen Datenstand.
--
-- ══ ZWEI AUSLOESER, DIE HIER NICHT STOEREN — GEMESSEN, NICHT ANGENOMMEN ════
-- `hinweis_neuer_beitrag()` prueft `kind is distinct from 'member'` und laesst
-- die dritte Art bereits aus; `beitrag_ankuendigen()` waehlt `p.kind =
-- 'member'`. Eine Zustellung kuendigt sich also nicht zweimal an. Beides ist
-- eine bestehende Zusage, die hier zur Positivkontrolle wird — sie bleibt
-- unangetastet, aber sie wird geprueft.
--
-- Der dritte Ausloeser stoert sehr wohl und wird unten geaendert:
-- `hinweis_auf_meinem_beitrag()` liest allein `posts.author_id` und kennt
-- keine Beitragsart.
--
-- Forward-only.

-- ── 1. Die Spalte und ihr Fremdschluessel ─────────────────────────────────
alter table public.posts
  add column release_note_id uuid;

alter table public.posts
  add constraint posts_release_note_id_fkey
  foreign key (release_note_id) references public.release_notes (id)
  on delete cascade;

comment on column public.posts.release_note_id is
  'Bei kind=release die `release_notes.id`, `on delete cascade`. Der Beitrag '
  'speichert KEINEN Mitteilungsinhalt — die Karte joint zur Laufzeit '
  'hierueber (AGE-718).';

-- ── 2. Die Art wird dreiwertig ────────────────────────────────────────────
-- Der CHECK heisst `posts_kind_check` — er entstand in 20260813100000 als
-- Spalten-CHECK, Postgres hat ihn so benannt, und `feed.ts` nennt den Namen im
-- Kommentar der geschlossenen Menge. Er wird ersetzt, nicht ergaenzt: zwei
-- CHECKs auf derselben Spalte waeren zwei Orte fuer dieselbe Aussage.
alter table public.posts
  drop constraint posts_kind_check;

alter table public.posts
  add constraint posts_kind_check
  check (kind in ('member', 'event', 'release'));

comment on column public.posts.kind is
  '`member` (Default), `event` oder `release`. Event- und Release-Beitraege '
  'sind systemverwaltet: nur die DEFINER-Trigger schreiben sie (AGE-533, '
  'AGE-718).';

-- ── 3. Die Kombination wird dreifach ──────────────────────────────────────
-- Die Stelle, an der die Invariante VOLLSTAENDIG ausgesprochen steht, statt
-- sich auf die Schreibwege zu verlassen. Jede Art nennt beide Bezugsspalten:
-- ein `release` mit `ref_id` risse sonst bei geloeschtem Event einen fremden
-- Beitrag mit, ein `member` mit `release_note_id` ebenso.
alter table public.posts
  drop constraint posts_kind_ref_id_check;

alter table public.posts
  add constraint posts_kind_ref_id_check
  check (
    (kind = 'event'   and ref_id is not null and release_note_id is null) or
    (kind = 'release' and ref_id is null     and release_note_id is not null) or
    (kind = 'member'  and ref_id is null     and release_note_id is null)
  );

-- ── 4. Eine Mitteilung haengt an GENAU EINER posts-Zeile ──────────────────
-- Ohne diesen Index stuende dieselbe Mitteilung doppelt im Feed, sobald ein
-- Trigger zweimal liefe. Partiell aus demselben Grund wie
-- `posts_event_ref_id_key`: ausserhalb von `kind = 'release'` ist die Spalte
-- leer, und ein zweiter nicht-eindeutiger Index traegt nichts bei.
create unique index posts_release_note_id_key on public.posts (release_note_id)
  where kind = 'release';

-- ── 5. Der Ausloeser ──────────────────────────────────────────────────────
create function public.release_feed_post_sync()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_author uuid;
begin
  -- `created_by` zuerst, weil es die genauere Aussage ist, solange es
  -- existiert; `auth.uid()` ist beim Versand ueber `send_release_note()` immer
  -- belegt und immer ein Admin — die Funktion hat `is_admin()` bereits
  -- erzwungen.
  v_author := coalesce(new.created_by, auth.uid());

  -- Kein Autor, kein Beitrag. `posts.author_id` ist `not null`; ein Insert
  -- ohne Autor liesse die ZUSTELLUNG mit einem rohen Datenbankfehler
  -- scheitern, weil der Trigger-Fehler das umgebende `update` zurueckrollt.
  -- Eine Mitteilung ohne Feed-Karte ist ein Verlust; eine Mitteilung, die gar
  -- nicht zugestellt wird, ist ein groesserer. `event_feed_post_sync()`
  -- behandelt seinen fehlenden Host genauso.
  if v_author is null then
    return null;
  end if;

  -- `visibility` AUSDRUECKLICH, nicht aus dem Spaltenvorgabewert: Sichtbarkeit
  -- ist eine Zugriffsentscheidung und gehoert ausgesprochen, auch wenn die
  -- Vorgabe heute zufaellig dasselbe ergibt. `members` deckt sich mit
  -- `release_notes_read_sent`, das ebenfalls Aktivierung verlangt — eine
  -- Release-Karte erscheint damit nicht im ausgeloggten Schaufenster.
  --
  -- BEIDE Zeitspalten aus `sent_at`: der Feed ordnet ueber
  -- `veroeffentlicht_ab`. `coalesce` auf `now()`, weil `sent_at` nullable ist
  -- und ein kuenftiger zweiter Weg zu `sent` sie nicht setzen muesste — ein
  -- `not null`-Fehler risse dann die Zustellung mit, und genau das schliesst
  -- der Zweig oben aus.
  -- `on conflict … do nothing` und NICHT blank (Befund opencode im Diff-Review,
  -- HOCH). Der Fremdschluessel und der CHECK binden eine `release`-Zeile nicht
  -- an `status = 'sent'` der Note: eine Zeile auf einen ENTWURF ist schema-
  -- gueltig. Liegt eine solche herum, traefe der Insert hier den partiellen
  -- Unique-Index, der Trigger-Fehler rollte das umgebende `update` zurueck —
  -- und die Note waere OHNE SQL-Eingriff nie mehr zustellbar. Genau die
  -- Fehlerklasse, die der Zweig oben fuer den fehlenden Autor schon ausschliesst.
  --
  -- Der partielle Index taugt als Arbiter, sein Praedikat gehoert deshalb in die
  -- Klausel. Die Bedeutung ist dieselbe wie beim `not exists`-Waechter des
  -- Backfills: es gibt bereits einen Beitrag zu dieser Mitteilung, fertig.
  insert into public.posts
    (author_id, body, visibility, kind, release_note_id, created_at, veroeffentlicht_ab)
  values
    (v_author, '', 'members', 'release', new.id,
     coalesce(new.sent_at, now()), coalesce(new.sent_at, now()))
  on conflict (release_note_id) where kind = 'release' do nothing;

  return null;
end;
$$;

comment on function public.release_feed_post_sync() is
  'AGE-718: legt den Feed-Beitrag einer Release-Note beim Wechsel draft→sent '
  'an. Haengt am Zustandswechsel, damit der Riegel aus send_release_note() '
  'auch fuer den Beitrag gilt. Innerei des Triggers, keine API.';

revoke execute on function public.release_feed_post_sync()
  from public, anon, authenticated, service_role;

-- `when` im Trigger und nicht im Rumpf: so steht die Bedingung im Katalog und
-- der Rumpf hat nur einen Fall.
create trigger trg_release_feed_post
  after update of status on public.release_notes
  for each row
  when (old.status = 'draft' and new.status = 'sent')
  execute function public.release_feed_post_sync();

-- ── 6. Die Benachrichtigungsfalle ─────────────────────────────────────────
-- Befund der Plan-Review (gemini, HOCH), am Repo bestaetigt.
--
-- `hinweis_auf_meinem_beitrag()` liest allein `posts.author_id` und kennt
-- keine Beitragsart. In `author_id` steht bei einer Release-Karte der Admin,
-- der zugestellt hat — er hat die Mitteilung nicht verfasst und ist fuer
-- Rueckfragen dazu nicht zustaendig. Eine Mitteilung erreicht JEDES aktivierte
-- Mitglied; entstuende je Reaktion ein Hinweis, traefe die Summe aller
-- Reaktionen eine einzelne Person, die nichts geschrieben hat.
--
-- Zwei fuer sich harmlose Entscheidungen ergeben hier zusammen den Fehler: der
-- Interaktionsbereich bleibt an der Karte (damit Reaktionen ueberhaupt
-- moeglich sind), und `author_id` traegt den Admin (damit die Spalte
-- `not null` bleiben kann).
--
-- `event` bleibt unberuehrt: dort IST der Host der Gastgeber und fuer
-- Rueckfragen zustaendig. Die Ausnahme gilt genau der dritten Art.
create or replace function public.hinweis_auf_meinem_beitrag() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_post   uuid;
  v_actor  uuid;
  v_typ    text;
  v_owner  uuid;
  v_kind   text;
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

  select p.author_id, p.kind into v_owner, v_kind
    from public.posts p where p.id = v_post;

  -- AGE-718: in `author_id` steht bei einer Release-Karte der zustellende
  -- Admin, nicht der Verfasser.
  if v_kind = 'release' then
    return null;
  end if;

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
  'tg_table_name. Seit AGE-718 ohne `kind = release`: dort traegt author_id '
  'den zustellenden Admin, nicht den Verfasser. Innerei der Trigger, keine API.';

-- ── 7. Backfill ──────────────────────────────────────────────────────────
-- Sollwert 0 auf PROD und DEV (gemessen 11.09., siehe Kopf). Gegen Sollwert 0
-- zu zaehlen uebt den Backfill nicht — geprueft wird er deshalb lokal mit
-- einem kuenstlich zugestellten Altbestand und in pgTAP an der Vorgabe.
--
-- BEIDE Zeitspalten aus `sent_at`, aus dem Grund im Kopf. Entwuerfe bleiben
-- aussen vor: ein Entwurf ist eine Absicht, keine Mitteilung — dieselbe
-- Grenze, die `release_notes_read_sent` schon zieht. Notes ohne `created_by`
-- ebenso, wie im Ausloeser; hier gibt es kein `auth.uid()`, aus dem sich ein
-- Autor ergaebe.
--
-- Der `not exists`-Waechter macht die Datei wiederholbar. Er ist nicht
-- theoretisch: der Trigger oben existiert beim Backfill bereits, und eine
-- Zustellung zwischen beiden Anweisungen traefe sonst den Unique-Index.
insert into public.posts
  (author_id, body, visibility, kind, release_note_id, created_at, veroeffentlicht_ab)
select rn.created_by, '', 'members', 'release', rn.id, rn.sent_at, rn.sent_at
  from public.release_notes rn
 where rn.status = 'sent'
   and rn.created_by is not null
   and rn.sent_at is not null
   and not exists (
     select 1 from public.posts p
      where p.kind = 'release' and p.release_note_id = rn.id
   );
