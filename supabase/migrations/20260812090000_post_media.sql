-- Beitragsbilder: Tabelle `post_media`, Sichtbarkeitsfunktion, Veröffentlichungs-RPC
-- (AGE-528, C7). Donald, 2026-08-12.
-- Spec: openspec/changes/activity-media-and-tags/ (proposal, design, tasks).
-- Der Bucket und seine vier Policies stehen in 20260812090100_post_media_storage.sql;
-- sie brauchen `post_media_lesbar()` von hier, deshalb diese Datei zuerst.
--
-- ── Eine Tabelle statt `posts.media jsonb` ─────────────────────────────────
-- VERWORFEN: eine Spalte `posts.media jsonb` mit einem Array von Objekten. Sie
-- wäre billiger — keine Tabelle, keine Grants, keine Policies. Sie scheitert an
-- den zwei Dingen, die dieser Change ausdrücklich verlangt: Reihenfolge und
-- EINZELNE Löschbarkeit. Ein einzelnes Bild aus einem JSON-Array zu entfernen
-- heißt, den ganzen Wert neu zu schreiben — mit einem Wettlauf zwischen zwei
-- offenen Tabs, den kein Index abfängt. `unique (post_id, sort)` drückt genau
-- das aus, was das Array nur behauptet.
--
-- ── `unique (storage_path)` ist keine Kosmetik ─────────────────────────────
-- `post_media_lesbar()` unten schlägt die Zeile über GENAU diese Spalte nach.
-- Zwei Zeilen auf denselben Pfad machten die Antwort mehrdeutig: dasselbe
-- Objekt gehörte dann zu zwei Beiträgen mit womöglich verschiedener
-- Sichtbarkeit, und welche gewönne, entschiede die Planwahl.
--
-- ── Die Sechser-Grenze ist ein Trigger, keine Constraint ───────────────────
-- Aus dem Fremd-Review (REVIEWS.md, opencode). „Höchstens sechs Bilder pro
-- Beitrag" ist eine Zählung über ANDERE Zeilen; eine `check`-Constraint sieht
-- nur die eigene. Der verbleibende Wettlauf zwischen gleichzeitigen Inserts ist
-- hier unerheblich: der einzige Schreibweg ist `create_post_with_media()`, und
-- die schreibt alle Zeilen eines Beitrags in EINER Anweisung.
--
-- ── Grants werden ausgesprochen, nicht geerbt ──────────────────────────────
-- Seit AGE-312 erbt eine neue Tabelle nichts (`alter default privileges` ist
-- entzogen). `anon` braucht SELECT, sonst kann der ausgeloggte Besucher die
-- Bildzeile eines öffentlichen Beitrags nicht lesen — und ohne sie kennt er
-- weder Pfad noch Maße. Kein UPDATE für irgendwen: ein Bild wird ersetzt, indem
-- die Zeile fällt und eine neue entsteht.
--
-- Forward-only.

create table public.post_media (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  storage_path text not null,
  sort         int  not null,
  width        int  not null,
  height       int  not null,
  created_at   timestamptz not null default now(),
  unique (post_id, sort),
  unique (storage_path)
);
alter table public.post_media enable row level security;

comment on table public.post_media is
  'Bilder eines Beitrags, geordnet über `sort`. `width`/`height` stehen hier, '
  'damit die Karte ihr Layout ohne Nachladen der Datei bestimmen kann. '
  '`storage_path` zeigt in den privaten Bucket `post-media` (AGE-528).';

grant select, insert, delete on public.post_media to authenticated;
grant select                 on public.post_media to anon;

-- ── Policies: lesen wie der Beitrag, schreiben nur als sein Autor ──────────
-- Das `exists` auf `posts` DUPLIZIERT die Sichtbarkeitsregel nicht, es delegiert
-- sie: Ausdrücke in einer Policy laufen als die anfragende Rolle, also greift
-- dort die RLS von `posts` — für `anon` `visibility = 'public'`, für
-- `authenticated` das Gate samt Stufe und Autorschaft. Dasselbe Muster trägt
-- schon `comments_select_visible` (20260806080100).
create policy post_media_select_like_post on public.post_media
  for select to anon, authenticated
  using ( exists (select 1 from public.posts p where p.id = post_media.post_id) );

create policy post_media_insert_own on public.post_media
  for insert to authenticated
  with check (
    public.is_activated()
    and exists (
      select 1 from public.posts p
       where p.id = post_media.post_id and p.author_id = (select auth.uid())
    )
  );

create policy post_media_delete_own on public.post_media
  for delete to authenticated
  using (
    public.is_activated()
    and exists (
      select 1 from public.posts p
       where p.id = post_media.post_id and p.author_id = (select auth.uid())
    )
  );

create or replace function public.post_media_hoechstens_sechs() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if (select count(*) from public.post_media where post_id = new.post_id) > 6 then
    raise exception 'Ein Beitrag trägt höchstens sechs Bilder (post_id %)', new.post_id
      using errcode = 'check_violation';
  end if;
  return null;
end $$;

create trigger post_media_hoechstens_sechs
  after insert on public.post_media
  for each row execute function public.post_media_hoechstens_sechs();

-- ── Die Sichtbarkeitsfunktion: sie liest die ZEILE, sie zerlegt NIE den Pfad ─
-- Aus dem Fremd-Review (REVIEWS.md, gemini). Naheliegend wäre, aus dem
-- Objektnamen `{uid}/{postId}/{datei}.webp` die Beitragskennung zu schneiden und
-- deren Sichtbarkeit zu prüfen. DAS WÄRE EIN LOCH: der Pfad ist eine
-- Zeichenkette, die der Hochladende frei wählt, und die INSERT-Policy prüft
-- ausschließlich seinen ERSTEN Abschnitt. Jedes Mitglied könnte unter
-- `{eigene-uid}/{fremde-postId}/x.webp` ablegen und sich eine Signatur holen,
-- die eine Sichtbarkeit behauptet, die mit dem Objekt nichts zu tun hat.
--
-- Deshalb: Nachschlag über `storage_path`, und geprüft wird die Sichtbarkeit
-- DES BEITRAGS, auf den die gefundene Zeile zeigt. Zwei Eigenschaften fallen
-- kostenlos ab — ein Objekt ohne Zeile ist für niemanden signierbar, und die
-- Verknüpfung ist genau die, über die auch die Karte das Bild findet.
--
-- SECURITY DEFINER und nicht INVOKER, obwohl ein Invoker-Rumpf die RLS von
-- `posts` einfach mitnähme und damit gar nichts abschriebe: gemessen ist nur
-- der DEFINER-Weg. Die Sonde scripts/probe-post-media-signatur.ts hat vor
-- dieser Migration genau dieses Muster durch die echte Storage-API geführt
-- (privater Bucket + DEFINER-Prädikat + SELECT-Policy für anon, sechs Fälle,
-- EVIDENCE.md). Ein ungemessener Weg in einer Policy, die den einzigen Schutz
-- der Bilder trägt, ist die teurere Eleganz.
--
-- Der Preis, benannt: das Prädikat steht damit an einer ZWEITEN Stelle neben
-- `posts_select_by_visibility`. Wer dort die Stufe ändert, ändert sie hier mit —
-- rls_test.sql §19.2 misst beide Seiten (Rang 1 nein, Rang 4 ja, Autor ja).
create or replace function public.post_media_lesbar(objektname text) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
      from public.post_media m
      join public.posts p on p.id = m.post_id
     where m.storage_path = objektname
       and case
             -- Ohne Session: nur öffentliche Beiträge. Spiegelt
             -- posts_select_public_anon (20260612082726).
             when (select auth.uid()) is null then p.visibility = 'public'
             -- Mit Session: posts_select_by_visibility (20260806080100).
             else public.is_activated()
                  and ( p.visibility = 'public'
                        or (p.visibility = 'members' and public.has_level(4))
                        or p.author_id = (select auth.uid()) )
           end
  );
$$;

comment on function public.post_media_lesbar(text) is
  'True, wenn der Aufrufer sich für dieses Objekt in `post-media` eine Signatur '
  'ausstellen lassen darf. Schlägt die post_media-Zeile über `storage_path` nach '
  'und wertet die Sichtbarkeit ihres Beitrags aus — der Objektname wird NIE '
  'zerlegt, er ist fälschbar (AGE-528).';

-- Policy-Ausdrücke laufen als die anfragende Rolle, also braucht sie EXECUTE.
-- `anon` ausdrücklich: der ausgeloggte Feed ist der Anlass für den ganzen Weg.
revoke execute on function public.post_media_lesbar(text) from public;
grant  execute on function public.post_media_lesbar(text) to anon, authenticated;

-- ── Veröffentlichen ist EIN Schritt, nicht drei ────────────────────────────
-- Aus dem Fremd-Review (REVIEWS.md, opencode). Der naheliegende Ablauf wäre:
-- Beitrag anlegen → Bilder hochladen → Bildzeilen anlegen. Er hat einen
-- sichtbaren Fehlerzustand: bricht er nach dem ersten Schritt ab, steht der
-- Beitrag SOFORT im Feed (der Client invalidiert den Cache in `onSuccess`) —
-- und zwar ohne seine Bilder, ohne Entwurf, ohne Wiederholung. Ein
-- Erlebnisbericht ohne Fotos ist kein halber Beitrag, sondern ein falscher.
--
-- Umgedreht: die Beitrags-`id` entsteht im Client, die Bilder gehen zuerst nach
-- `{uid}/{postId}/…` (sie hängen an nichts — die INSERT-Policy des Buckets
-- prüft nur den ersten Abschnitt), und DIESE Funktion klammert Beitrag und
-- Bildzeilen in eine Transaktion. Bricht es vorher ab, gibt es keinen Beitrag,
-- nur Objekte ohne Zeile — und die sind für niemanden signierbar. Das ist
-- Speicherschuld, kein Leck.
--
-- Die Sechser-Grenze steht hier NICHT noch einmal: sie fällt beim Insert der
-- Bildzeilen über den Trigger oben, innerhalb dieser Transaktion, und nimmt den
-- schon geschriebenen Beitrag mit zurück. Eine zweite Prüfung wäre dieselbe
-- Regel an einer zweiten Stelle — und sie käme dem Trigger zuvor, sodass der
-- Rückroll-Weg nie gemessen würde.
--
-- Sie ersetzt keine Policy: `posts_write_own` bleibt, `post_media_insert_own`
-- auch. SECURITY DEFINER heißt hier nur, dass die zwei Inserts nicht an der
-- RLS scheitern — Autorschaft und Aktivierung prüft der Rumpf selbst.
create or replace function public.create_post_with_media(
  p_post_id    uuid,
  p_body       text,
  p_visibility text,
  p_hashtags   text[],
  p_tags       text[],
  p_media      jsonb
) returns uuid
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_autor uuid := (select auth.uid());
  v_tags  text[];
begin
  if v_autor is null or not public.is_activated() then
    raise exception 'Kein bestätigter Zugang' using errcode = 'insufficient_privilege';
  end if;

  -- Tags werden VEREINIGT, nicht ersetzt: getippte (aus parseHashtags) und
  -- geklickte (aus `tags`) fallen über dieselbe Kleinschreibung zusammen,
  -- Reihenfolge der getippten zuerst. Ohne das steht derselbe Tag zweimal in
  -- `hashtags`, wenn jemand ihn tippt UND anklickt — genau der doppelte Chip,
  -- gegen den dieser Change antritt.
  select array_agg(t order by rn) into v_tags
    from (
      select lower(u.wert) as t, min(u.rn) as rn
        from unnest(coalesce(p_hashtags, '{}') || coalesce(p_tags, '{}'))
             with ordinality as u(wert, rn)
       where btrim(u.wert) <> ''
       group by lower(u.wert)
    ) s;

  insert into public.posts (id, author_id, body, hashtags, visibility)
  values (p_post_id, v_autor, p_body, v_tags, p_visibility);

  insert into public.post_media (post_id, storage_path, sort, width, height)
  select p_post_id,
         m->>'storage_path',
         (m->>'sort')::int,
         (m->>'width')::int,
         (m->>'height')::int
    from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) m;

  return p_post_id;
end $$;

comment on function public.create_post_with_media(uuid,text,text,text[],text[],jsonb) is
  'Legt Beitrag und Bildzeilen in EINER Transaktion an (AGE-528). Autor ist '
  'immer auth.uid(); die Sechser-Grenze fällt über den Trigger auf post_media '
  'und nimmt den Beitrag mit zurück. Vereinigt getippte und geklickte Tags.';

revoke execute on function public.create_post_with_media(uuid,text,text,text[],text[],jsonb)
  from public, anon;
grant  execute on function public.create_post_with_media(uuid,text,text,text[],text[],jsonb)
  to authenticated;
