-- Ein Event kündigt sich selbst im Feed an (AGE-533, C9, Migration B).
-- Donald, 2026-08-13. Spec: openspec/changes/academy-lite-and-feed-weave/.
--
-- Detlev: „Neue Events oder Videos bei Academy werden auch in Aktivitäten
-- angezeigt." Videos lösen sich über Migration A von selbst — ein geteiltes
-- Video IST ein Beitrag. Events brauchen einen Weg in den Feed, und das ist
-- diese Migration.
--
-- ── Der Beitrag speichert KEINEN Event-Inhalt ──────────────────────────────
-- Kein kopierter Titel, kein kopiertes Datum, kein kopiertes Bild. Der Beitrag
-- trägt `kind`, `ref_id` und einen leeren Body; die Darstellung joint zur
-- Laufzeit über den Fremdschlüssel auf `events`.
--
-- Eine Kopie veraltet still. Stünde der Titel im Beitrag, zeigte der Feed nach
-- einer Umbenennung einen Titel, den es nicht mehr gibt — und jede Änderung am
-- Event bräuchte einen weiteren Trigger, der die Kopie nachzieht. So gibt es
-- genau eine Wahrheit, und sie steht in `events`.
--
-- Der Fremdschlüssel heißt AUSGESCHRIEBEN `posts_ref_id_fkey`: der Client nennt
-- ihn in der PostgREST-Einbettung (`events!posts_ref_id_fkey(…)`). Ein von
-- Postgres generierter Name wäre eine stille Kopplung, die bei jeder
-- Umbenennung bricht (offene Annahme aus dem Plan-Review).
--
-- ── Sichtbarkeit: gespiegelt, nicht gejoint ────────────────────────────────
-- Ein Beitrag zu einem `members`-Event darf nicht als `public` im Feed landen.
-- Der naheliegende Weg wäre ein Join im RLS-Prädikat von `posts`. Er ist
-- verworfen, weil Sichtbarkeit von `posts` an VIER Stellen entschieden wird:
--
--   posts_select_public_anon · posts_select_by_visibility ·
--   post_engagement_counts (DEFINER) · post_media_lesbar (DEFINER)
--
-- Ein Join müsste in alle vier. Das ist die Falle, die AGE-495 mit
-- `profiles_public` beschrieben und AGE-530 noch einmal bezahlt hat. Der
-- Entwurf zählte übrigens DREI und übersah `post_media_lesbar` — das hat der
-- Plan-Review gefunden und ist selbst das beste Argument gegen diesen Weg.
--
-- Das Trigger-Paar unten steht an EINER Stelle. Alle bestehenden Policies, die
-- beiden DEFINER-Funktionen, die Indizes und der Client bleiben unverändert:
-- ein Event-Beitrag ist für sie eine gewöhnliche `posts`-Zeile.
--
-- Die Folge ist benannt, nicht versteckt: `events` sind für JEDES bestätigte
-- Konto sichtbar (AGE-448 — die Stufung sitzt bei Events in der Anmeldung),
-- `members`-Posts erst ab Rang 4. Der gespiegelte Beitrag ist damit STRENGER
-- als sein Event. Zum Go-Live sind alle Konten `impact`, also folgenlos;
-- rls_test.sql §22.19 hält es als Paar fest.
--
-- ── Event-Beiträge sind systemverwaltet ────────────────────────────────────
-- Der schwerste Befund des Plan-Reviews (codex, SEVERITY HIGH).
--
-- `posts_write_own` galt `for all` auf `author_id = auth.uid()` — und der Host
-- IST der Autor seines Event-Beitrags. Er konnte ihn also löschen, auf
-- `kind='member'` umschreiben oder die vom Trigger gesetzte Sichtbarkeit danach
-- wieder ändern. Eindeutigkeit und Spiegelung galten damit nur zufällig: der
-- Trigger setzte sie, und nichts hielt sie.
--
-- Die Policy verlangt deshalb `kind = 'member'`. Danach schreibt nur noch der
-- DEFINER-Trigger Event-Zeilen. `is_activated()` bleibt das äußere `and` — wie
-- in C3 und C8.
--
-- Daraus folgt eine zweite Zusage: ein Event-Beitrag trägt NIEMALS
-- `post_media`. Der Trigger legt keine an — und niemand kann welche
-- nachtragen, ABER erst seit dem `kind`-Prädikat in `post_media_insert_own`
-- weiter unten. Das Engerfassen von `posts_write_own` allein reichte dafür
-- nicht: die Bild-Policy ist eine eigene und hängt allein an der Autorschaft,
-- und der Host IST der Autor seines Event-Beitrags. Befund aus dem
-- Diff-Review (opencode) — die Zusage stand hier, bevor sie wahr war.
-- `post_media_lesbar` bleibt unberührt.
--
-- ── Warum EINE Funktion für beide Trigger ──────────────────────────────────
-- Der Entwurf sah zwei vor (anlegen / nachziehen). Ein `update … if not found
-- then insert` deckt beide Fälle und alle vier `host_id`-Übergänge in einem
-- Rumpf ab — und die Regel steht damit wirklich an einer Stelle, wie die
-- Begründung oben behauptet.
--
-- Forward-only.

-- ── 1. Die zwei Spalten ───────────────────────────────────────────────────
alter table public.posts
  add column kind   text not null default 'member'
                 check (kind in ('member', 'event')),
  add column ref_id uuid;

alter table public.posts
  add constraint posts_ref_id_fkey
  foreign key (ref_id) references public.events (id) on delete cascade;

-- Die zwei Spalten müssen zusammenpassen. Ohne das entstünde ein
-- `kind='event'` ohne Bezug (die Karte hätte nichts zu joinen) oder ein
-- `kind='member'` mit Bezug (die Kaskade risse einen fremden Beitrag mit).
alter table public.posts
  add constraint posts_kind_ref_id_check
  check (
    (kind = 'event'  and ref_id is not null) or
    (kind = 'member' and ref_id is null)
  );

-- Ein Event hängt an GENAU EINER posts-Zeile. Ohne diesen Index stünde
-- derselbe Eintrag doppelt im Feed, sobald ein Trigger zweimal liefe.
--
-- Bewusst KEIN zweiter, nicht-eindeutiger Index auf `ref_id` (Befund opencode,
-- MEDIUM): dieser hier trägt den Join bereits vollständig, und außerhalb von
-- `kind = 'event'` ist die Spalte leer.
create unique index posts_event_ref_id_key on public.posts (ref_id)
  where kind = 'event';

comment on column public.posts.kind is
  '`member` (Default) oder `event`. Event-Beitraege sind systemverwaltet: nur '
  'die Trigger auf `events` schreiben sie (AGE-533).';
comment on column public.posts.ref_id is
  'Bei kind=event die `events.id`, `on delete cascade`. Der Beitrag speichert '
  'KEINEN Event-Inhalt — die Darstellung joint zur Laufzeit hierueber.';

-- ── 2. Die Policy wird enger ──────────────────────────────────────────────
drop policy if exists posts_write_own on public.posts;
create policy posts_write_own on public.posts
  for all to authenticated
  using (
    public.is_activated()
    and author_id = (select auth.uid())
    and kind = 'member'
  )
  with check (
    public.is_activated()
    and author_id = (select auth.uid())
    and kind = 'member'
    and ref_id is null
  );

-- Und die Bildzeilen dazu. OHNE DIESE POLICY IST DIE ZUSAGE OBEN FALSCH.
--
-- Befund aus dem Diff-Review (opencode, SEVERITY MEDIUM), und er sass. Der
-- Kopf dieser Migration behauptete, ein Event-Beitrag trage niemals
-- `post_media`, weil „niemand welche nachtragen kann". Das Engerfassen von
-- `posts_write_own` stellt das NICHT her: `post_media_insert_own` ist eine
-- EIGENE Policy, und sie haengt allein an der Autorschaft des Beitrags
-- (20260812090000:69–77) — der Host aber IST der Autor seines Event-Beitrags.
-- Er haette also Bilder anhaengen koennen, und `post_media_lesbar` haette sie
-- brav signiert.
--
-- Die Behauptung wird hier wahr gemacht statt gestrichen: ein Event-Beitrag
-- traegt keinen Body, in den ein Bild gehoerte, und die Event-Karte zeichnet
-- ausschliesslich das Titelbild aus `events`.
--
-- Nur INSERT. Ein DELETE auf Zeilen, die es nicht geben kann, braucht keine
-- Schranke — und eine Regel ohne moeglichen Fall waere nur Rauschen.
drop policy if exists post_media_insert_own on public.post_media;
create policy post_media_insert_own on public.post_media
  for insert to authenticated
  with check (
    public.is_activated()
    and exists (
      select 1 from public.posts p
       where p.id = post_media.post_id
         and p.author_id = (select auth.uid())
         and p.kind = 'member'
    )
  );

comment on policy post_media_insert_own on public.post_media is
  'Bilder nur am eigenen MITGLIEDS-Beitrag. Das `kind`-Praedikat seit AGE-533: '
  'ohne es haette der Host seinem systemverwalteten Event-Beitrag Bilder '
  'anhaengen koennen, weil er dessen Autor ist.';

comment on policy posts_write_own on public.posts is
  'Ein Mitglied schreibt seine eigenen Beitraege, sofern sein Zugang bestaetigt '
  'ist. Seit AGE-533 zusaetzlich NUR `kind = member`: der Host ist der Autor '
  'seines Event-Beitrags und koennte ihn sonst loeschen, auf `member` '
  'umschreiben oder die vom Trigger gesetzte Sichtbarkeit zurueckdrehen — '
  'Eindeutigkeit und Spiegelung gaelten dann nur zufaellig.';

-- ── 3. Der Trigger ────────────────────────────────────────────────────────
-- SECURITY DEFINER, nicht INVOKER: bei einem admin-angelegten Event ist der
-- Schreibende NICHT der Host, und als Invoker scheiterte das Insert an
-- `posts_write_own` — das Anlegen des Events risse es mit. Genau der
-- Fehlerzustand, der in der Vorsession neun Stunden live stand.
create or replace function public.event_feed_post_sync()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- Kein Host, kein Beitrag. `events.host_id` ist nullable, `posts.author_id`
  -- ist `not null` — ein Insert ohne Autor liesse das Anlegen des Events mit
  -- einem rohen Datenbankfehler scheitern. Beim UPDATE ist derselbe Zweig die
  -- Antwort auf `Host → null`: es gaebe niemanden, dem der Beitrag gehoert.
  if new.host_id is null then
    delete from public.posts where kind = 'event' and ref_id = new.id;
    return null;
  end if;

  -- Sichtbarkeit UND Autor nachziehen. Beides sind Zugriffsentscheidungen,
  -- kein Inhalt: Inhalt wird gelesen und veraltet still, eine
  -- Zugriffsentscheidung wird erzwungen und ihr Nachziehen ist testbar.
  update public.posts
     set visibility = new.visibility,
         author_id  = new.host_id
   where kind = 'event' and ref_id = new.id;

  -- Kein Treffer heisst: es gibt noch keinen. Beim INSERT ist das der
  -- Normalfall, beim UPDATE der Uebergang `null → Host` — ein Event, das ohne
  -- Host angelegt und spaeter zugeordnet wird, kaeme sonst NIE in den Feed
  -- (Befunde codex MEDIUM und opencode HIGH, unabhaengig voneinander).
  if not found then
    insert into public.posts (author_id, body, visibility, kind, ref_id)
    values (new.host_id, '', new.visibility, 'event', new.id);
  end if;

  return null;
end;
$$;

comment on function public.event_feed_post_sync() is
  'Haelt den Feed-Beitrag eines Events in Deckung mit dem Event (AGE-533): '
  'legt ihn an, zieht `visibility` und `author_id` nach und entfernt ihn, wenn '
  'das Event seinen Host verliert. Innerei der Trigger, keine API.';

revoke execute on function public.event_feed_post_sync() from public, anon, authenticated;

create trigger trg_event_feed_post
  after insert on public.events
  for each row execute function public.event_feed_post_sync();

create trigger trg_event_feed_sync
  after update of visibility, host_id on public.events
  for each row execute function public.event_feed_post_sync();

-- ── 4. Backfill ───────────────────────────────────────────────────────────
-- Ohne ihn haette der Feed am 17.08. keinen einzigen Event-Eintrag: die
-- bestehenden Events sind vor dem Trigger entstanden.
--
-- `created_at` kommt VOM EVENT, nicht von `now()`. Sonst stuenden alle alten
-- Events als frischeste Beitraege ganz oben und verdraengten den echten Feed.
--
-- Events ohne Host werden uebersprungen — dieselbe Regel wie im Trigger.
--
-- Gemessen vor der Migration (scripts/probe-c9-bestand.ts, rein lesend, DEV
-- 2026-08-13): 9 Events, davon 0 ohne Host, 8 `members` und 1 `public`. Der
-- Sollwert ist also 9 Beitraege, davon 8 `members` — steht in EVIDENCE.md.
insert into public.posts (author_id, body, visibility, kind, ref_id, created_at)
select e.host_id, '', e.visibility, 'event', e.id, e.created_at
  from public.events e
 where e.host_id is not null
   and not exists (
     select 1 from public.posts p where p.kind = 'event' and p.ref_id = e.id
   );
