-- Event-Vorlagen und Serientermine (AGE-630), Datenmodell.
--
-- ══ WAS HIER PASSIERT ═══════════════════════════════════════════════════════
-- Ein Host legt die inhaltlichen Felder eines Events einmal als Vorlage ab und
-- erzeugt daraus wiederholt Termine. Die Termine sind ECHTE `events`-Zeilen.
--
-- ══ WARUM MATERIALISIEREN UND NICHT RECHNEN ═════════════════════════════════
-- `event_registrations` haengt per Fremdschluessel an `events.id`, ist unique je
-- (event_id, profile_id), und `register_for_event` sperrt genau diese Zeile, um
-- die Kapazitaet zu zaehlen (AGE-605, 20260904160000). Eine zur Laufzeit
-- berechnete Serie haette fuer einen kuenftigen Termin keine `id`, auf die eine
-- Anmeldung zeigen koennte — man muesste sie spaetestens bei der ersten
-- Anmeldung doch materialisieren, mit einem Wettlauf an genau der Stelle, die
-- AGE-605 gerade abgesichert hat.
--
-- Der angenehme Nebeneffekt: einen Termin verschieben ist ein `update`, absagen
-- ein `delete`. Es braucht kein EXDATE- oder Override-Modell.
--
-- ══ DER KOMPOSIT-FREMDSCHLUESSEL IST DER KERN DIESER DATEI ══════════════════
-- Befund der Plan-Review (REVIEWS.md, opencode, HOCH) — gefunden, BEVOR es Code
-- gab:
--
-- `events_write_host` (20260812100000:110–124) wurde geschrieben, als es
-- `vorlage_id` nicht gab, und prueft die Spalte folglich nicht. Ein EINFACHER
-- Fremdschluessel auf `event_vorlagen (id)` haette nur EXISTENZ geprueft — und
-- **die Fremdschluesselpruefung laeuft nicht unter der RLS der Zieltabelle**.
-- Die Policy „fremde Vorlage ist unerreichbar" haette sie also nicht gehindert.
--
-- Der offene Weg waere gewesen: `host_id` = eigene uid, `vorlage_id` = FREMDE
-- Vorlage, `slot_datum` = die naechsten Slots dieser fremden Reihe. Die echte
-- Erzeugung des Opfers liefe danach auf jedem Kandidaten in
-- `on conflict do nothing` — die Serie entstuende nie, lautlos.
--
-- Deshalb zeigt der Fremdschluessel auf `(id, host_id)` und nimmt `host_id` aus
-- derselben Zeile mit. Eine Fremdzuordnung kann damit GAR NICHT EXISTIEREN, auf
-- keinem Weg, auch nicht ueber einen, den eine `with check`-Klausel kuenftig
-- uebersaehe. Eine Policy-Bedingung waere die schwaechere Zusage: sie deckt nur
-- Wege, die durch diese Policy laufen.
--
-- ══ WARUM `slot_datum` UND NICHT `starts_at` ════════════════════════════════
-- Beide Reviewer trafen unabhaengig dieselbe Stelle. Haengt die Idempotenz an
-- `starts_at`, dann kollidiert nichts mehr, sobald ein Termin verschoben oder
-- die Uhrzeit der Vorlage geaendert wurde — die Regel legt den alten Slot
-- erneut an. Bei 19:00 -> 20:00 stuenden danach beide Termine derselben Woche
-- im Kalender, beide anmeldbar.
--
-- `slot_datum` haelt den von der Regel errechneten URSPRUENGLICHEN Slot fest und
-- wandert beim Verschieben ausdruecklich NICHT mit.
--
-- ══ WARUM GETIPPTE SPALTEN STATT EINER RRULE-ZEICHENKETTE ═══════════════════
-- Drei Formen, nicht RFC 5545 allgemein. Eine Zeichenkette waere erst beim
-- Auswerten falsch; getippte Spalten sind schon beim Schreiben falsch. Ein
-- allgemeiner Parser saegte ausserdem `BYSETPOS`, `COUNT`, `INTERVAL` und `WKST`
-- als implizite Zusage an.
--
-- `wochentag_position`, nicht `position`: letzteres ist in SQL ein
-- Funktionsname und als Spaltenname eine Stolperstelle.
--
-- ══ ZEITZONE ════════════════════════════════════════════════════════════════
-- Die Regel fuehrt ORTSZEIT plus Zone, keinen festen Zeitpunkt — sonst
-- verschoebe „jeden Dienstag 19 Uhr" ueber die Umstellung hinweg still auf 18
-- Uhr. Der `check` gegen `pg_timezone_names` faengt den Tippfehler beim
-- Schreiben; ohne ihn ist 'Europe/Belin' speicherbar und toetet erst die
-- Erzeugung, weit weg von der Ursache.
--
-- Forward-only.

-- ── 1. Die Vorlage ──────────────────────────────────────────────────────────
create table public.event_vorlagen (
  id                 uuid primary key default gen_random_uuid(),
  host_id            uuid not null references public.profiles (id) on delete cascade,

  -- Inhaltliche Felder, Spiegel von `public.events`.
  title              text not null,
  type               text check (type in ('online', 'presence', 'dinner', 'workshop', 'mastermind')),
  location           text,
  description        text,
  capacity           int,
  visibility         text not null default 'public'
                       check (visibility in ('public', 'members', 'prime', 'legacy')),
  topics             text[],
  cover_path         text unique,

  -- Die Wiederholungsregel. `null` heisst: keine Regel, Termine von Hand.
  wiederholung       text check (wiederholung in
                       ('woechentlich', 'monatlich_tag', 'monatlich_n_ter_wochentag')),
  wochentag          smallint check (wochentag between 1 and 7),
  tag_im_monat       smallint check (tag_im_monat between 1 and 31),
  wochentag_position smallint check (wochentag_position between 1 and 4),

  -- Ortszeit, nicht Zeitpunkt. Siehe Kopf.
  ortszeit           time not null,
  zeitzone           text not null default 'Europe/Berlin',
  dauer              interval,

  created_at         timestamptz not null default now(),

  -- Je Form genau die zugehoerigen Spalten gesetzt, die uebrigen null.
  constraint event_vorlagen_regelform check (
    case wiederholung
      when 'woechentlich' then
        wochentag is not null and tag_im_monat is null and wochentag_position is null
      when 'monatlich_tag' then
        tag_im_monat is not null and wochentag is null and wochentag_position is null
      when 'monatlich_n_ter_wochentag' then
        wochentag is not null and wochentag_position is not null and tag_im_monat is null
      else
        wochentag is null and tag_im_monat is null and wochentag_position is null
    end
  )
);

alter table public.event_vorlagen enable row level security;

-- Die Zeitzone wird per TRIGGER geprueft, nicht per `check`. Grund, damit es
-- niemand „vereinfacht": ein `check` DARF keine Unterabfrage enthalten, und
-- `pg_timezone_names` ist eine Sicht — `check (zeitzone in (select ...))`
-- scheitert schon beim Anlegen der Tabelle. Die verbreitete Abkuerzung, eine
-- Hilfsfunktion als `immutable` zu deklarieren, waere eine Falschaussage: die
-- Zonendatenbank aendert sich mit jedem Update.
--
-- `23514` ist bewusst gewaehlt — dieselbe Klasse wie eine Pruefbedingung, damit
-- Aufrufer und Tests nicht zwischen zwei Fehlerklassen unterscheiden muessen.
create function public.event_vorlagen_zeitzone_pruefen() returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = new.zeitzone
  ) then
    raise exception 'Unbekannte Zeitzone: %', new.zeitzone
      using errcode = '23514';
  end if;
  return new;
end $$;

comment on function public.event_vorlagen_zeitzone_pruefen() is
  'AGE-630: Innerei des Triggers, keine API. Faengt den Tippfehler beim '
  'Schreiben; ohne sie toetet Europe/Belin erst die Erzeugung.';

revoke execute on function public.event_vorlagen_zeitzone_pruefen()
  from public, anon, authenticated, service_role;

create trigger trg_event_vorlagen_zeitzone
  before insert or update of zeitzone on public.event_vorlagen
  for each row execute function public.event_vorlagen_zeitzone_pruefen();

-- Voraussetzung fuer den komposit-Fremdschluessel aus Abschnitt 2.
create unique index event_vorlagen_id_host_key
  on public.event_vorlagen (id, host_id);

-- Die Policy spiegelt `events_write_host` Wort fuer Wort, inklusive der
-- Cover-Pfadbindung: `cover_path` muss im eigenen `{uid}/`-Praefix liegen.
create policy vorlagen_write_host on public.event_vorlagen
  for all to authenticated
  using (
    public.is_activated()
    and host_id = (select auth.uid())
  )
  with check (
    public.is_activated()
    and host_id = (select auth.uid())
    and (
      cover_path is null
      or split_part(cover_path, '/', 1) = (select auth.uid())::text
    )
  );

-- Neue Tabellen erben in diesem Projekt KEINE Rechte. Ausdruecklich erteilen.
grant select, insert, update, delete on public.event_vorlagen to authenticated;

comment on table public.event_vorlagen is
  'AGE-630: Blaupause fuer wiederkehrende Events. Selbst KEIN Event — erscheint '
  'in keiner Eventliste, traegt keine Anmeldungen, hat keinen Termin.';
comment on column public.event_vorlagen.ortszeit is
  'ORTSZEIT, kein Zeitpunkt. Zusammen mit `zeitzone` ueberlebt „jeden Dienstag '
  '19 Uhr" die Zeitumstellung; ein timestamptz plus 168 Stunden taete das nicht.';
comment on column public.event_vorlagen.wochentag_position is
  'n-ter Wochentag im Monat (1–4). Nicht `position` — SQL-Funktionsname.';
comment on column public.event_vorlagen.cover_path is
  'Cover der VORLAGE. Nur fuer den eigenen Host lesbar: eine Vorlage hat keine '
  'Sichtbarkeit, ihr Bild darf weder oeffentlich noch fuer die Mitgliedschaft '
  'signierbar sein.';
comment on policy vorlagen_write_host on public.event_vorlagen is
  'Spiegel von events_write_host. Gemessen (AGE-630): events_write_host traegt '
  'KEIN has_level-Gate — die Stufenpruefung sitzt auf regs_write_own und '
  'betrifft das Anlegen nicht. „Rechte wie bei Events" heisst deshalb: '
  'aktiviert und eigene Zeile.';

-- ── 2. Die Anbindung an events ──────────────────────────────────────────────
alter table public.events
  add column vorlage_id uuid,
  add column slot_datum date;

-- DER KERN. Siehe Kopf: `(id, host_id)` statt `(id)`.
alter table public.events
  add constraint events_vorlage_fkey
  foreign key (vorlage_id, host_id)
  references public.event_vorlagen (id, host_id)
  on delete set null;

-- Idempotenz der Erzeugung. `vorlage_id` ist im Bestand null, und Postgres
-- behandelt null-Werte in eindeutigen Indizes als verschieden — der Index
-- beruehrt bestehende Events also nicht.
create unique index events_vorlage_slot_key
  on public.events (vorlage_id, slot_datum);

comment on column public.events.vorlage_id is
  'AGE-630: Herkunft aus einer Vorlage. null bei allen einzeln angelegten und '
  'allen vor dieser Migration bestehenden Events. Der Fremdschluessel geht auf '
  '(id, host_id) — ein einfacher FK auf (id) haette nur Existenz geprueft, und '
  'die FK-Pruefung laeuft NICHT unter der RLS der Zieltabelle.';
comment on column public.events.slot_datum is
  'AGE-630: der von der Regel errechnete URSPRUENGLICHE Slot. Wandert beim '
  'Verschieben eines Termins NICHT mit — nur so bleibt der Slot belegt und die '
  'Regel legt ihn nicht erneut an.';
