-- Die Academy braucht eine Spalte, keine Tabelle (AGE-533, C9, Migration A).
-- Donald, 2026-08-13. Spec: openspec/changes/academy-lite-and-feed-weave/.
--
-- Academy-lite ist eine gefilterte Sicht auf `posts`: Beiträge, die ein Video
-- tragen. Der Filter braucht eine indexierbare Spalte — ein Regex über `body`
-- ist weder indexierbar noch verlässlich.
--
-- ── Abgeleitet, nicht mitgeschickt — die Kehrtwende des Plan-Reviews ───────
-- Der erste Entwurf ließ den CLIENT `extractFirstVideo(body)` rechnen und den
-- Wert an `create_post_with_media` übergeben. Begründung: dann gibt es nur
-- EINEN Erkenner, also könne die Spalte nicht vom gerenderten Embed abweichen.
--
-- Die Zusage war nicht durchsetzbar (Plan-Review codex, SEVERITY HIGH).
-- `posts_write_own` erlaubt `authenticated` INSERT und UPDATE direkt auf
-- `posts` — die RPC ist nicht der einzige Schreibweg, nur der bequeme. Ein
-- Client kann ein `video_url` setzen, das im Body nicht vorkommt, oder einen
-- Videolink im Body lassen und die Spalte leer. Dann steht ein Beitrag in der
-- Academy, dessen Karte etwas anderes zeigt.
--
-- Deshalb leitet die DATENBANK ab: eine Funktion, ein Trigger auf JEDEM
-- Schreibzugriff, und derselbe Funktionsaufruf im Backfill unten. Backfill und
-- Laufzeit sind damit per Konstruktion identisch statt per Zusicherung.
--
-- Der Preis, benannt: es gibt jetzt ZWEI Erkenner — `erste_video_url` hier und
-- `parseVideoUrl` in src/lib/feed.ts. Das ist genau, was der Entwurf vermeiden
-- wollte. Der Unterschied ist, dass die Parität hier benennbar und testbar ist,
-- während die alte Zusage nur behauptet werden konnte. Die Arbeitsteilung:
--
--   SQL entscheidet, OB ein Body ein Video enthält und WELCHE URL das ist.
--   TypeScript entscheidet, WIE diese URL eingebettet wird (Embed-URL bauen).
--
-- Ein Check-Constraint auf der Spalte entfällt bewusst: der Trigger ist die
-- Garantie, und ein Constraint, den nur die eigene Funktion verletzen könnte,
-- prüft nichts.
--
-- ── Zwei Fehler, die der Review gefunden hat ──────────────────────────────
-- 1. `~` ist case-sensitive. `parseVideoUrl` schreibt den Host klein
--    (feed.ts:165), akzeptiert also `https://WWW.YouTube.com/watch?v=…`. Der
--    Entwurf hätte ihn abgelehnt — der Beitrag wäre still aus der Academy
--    gefallen. Daher `~*`.
-- 2. Die Host-Grenze muss VERANKERT sein. Ein Präfix-Vergleich ließe
--    `https://youtube.com.boese.example/watch?v=x` durch, und in `video_url`
--    stünde ein Wert, den `VideoEmbed` nicht einbettet — genau die Drift, gegen
--    die diese Migration antritt.
--
-- `youtube-nocookie` steht bewusst NICHT in der Liste, obwohl ein Reviewer es
-- vorgeschlagen hat: `parseVideoUrl` kennt den Host nicht. Ihn nur in SQL zu
-- ergänzen wäre die Drift an der Stelle, die sie verhindern soll. Die Liste
-- wird aus dem Code abgeleitet, nicht aus dem Gedächtnis.
--
-- Forward-only.

alter table public.posts add column video_url text;

comment on column public.posts.video_url is
  'Erste einbettbare Video-URL aus `body`, von `trg_posts_video_url` bei JEDEM '
  'Schreibzugriff neu abgeleitet (AGE-533). Traegt den Academy-Filter. Ein vom '
  'Client mitgeschickter Wert wird ueberschrieben — die Spalte ist abgeleitet, '
  'nicht eingegeben.';

-- ── Der Erkenner ──────────────────────────────────────────────────────────
-- Bildet `parseVideoUrl` (src/lib/feed.ts) Fall fuer Fall nach:
--   youtube.com|m.youtube.com  /watch?…v=<id>   |  /embed/<id>
--   youtu.be/<id>
--   vimeo.com/<zahl>           player.vimeo.com/video/<zahl>
-- jeweils http oder https, optionales `www.`, Query und Fragment erlaubt —
-- `new URL()` haelt beide aus dem Pfad heraus, der TS-Parser laesst sie also
-- ebenfalls durch (z. B. `youtu.be/ID?t=30`).
--
-- Die Zerlegung des Bodys spiegelt `tokenizePostBody`: URLs sind
-- whitespace-begrenzt, und nachgestellte Satzzeichen gehoeren zum Satz, nicht
-- zum Link (TRAILING_PUNCT). Klammern werden bewusst NICHT abgetrennt — sie
-- kommen in echten URLs vor.
create or replace function public.erste_video_url(p_body text)
  returns text
  language sql
  immutable
  set search_path = ''
as $$
  select kandidat.url
    from (
      select rtrim(treffer[1], '.,;:!?»"''') as url, ord
        from regexp_matches(coalesce(p_body, ''), 'https?://[^\s]+', 'g')
             with ordinality as t(treffer, ord)
    ) as kandidat
   where kandidat.url ~* (
     '^https?://(www\.)?(' ||
       '(m\.)?youtube\.com/watch\?([^\s]*&)?v=[A-Za-z0-9_-]+([&#][^\s]*)?' || '|' ||
       '(m\.)?youtube\.com/embed/[A-Za-z0-9_-]+([?#][^\s]*)?'             || '|' ||
       'youtu\.be/[A-Za-z0-9_-]+([?#][^\s]*)?'                            || '|' ||
       'vimeo\.com/[0-9]+([?#][^\s]*)?'                                   || '|' ||
       'player\.vimeo\.com/video/[0-9]+([?#][^\s]*)?'                     ||
     ')$'
   )
   order by kandidat.ord
   limit 1;
$$;

comment on function public.erste_video_url(text) is
  'Erste einbettbare YouTube-/Vimeo-URL in einem Beitragstext (AGE-533). '
  'Spiegelt `parseVideoUrl` aus src/lib/feed.ts — was der eine akzeptiert, muss '
  'die andere akzeptieren; rls_test.sql §21 misst die Paritaet. Innerei des '
  'Triggers, keine API: bewusst ohne EXECUTE fuer anon/authenticated.';

-- ── Der Trigger ───────────────────────────────────────────────────────────
-- `security definer`, damit der Aufruf von `erste_video_url` nicht am
-- fehlenden EXECUTE des schreibenden Kontos scheitert. Die Funktion selbst
-- liest und schreibt nichts — sie setzt ein Feld von NEW.
create or replace function public.posts_video_url_setzen()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  new.video_url := public.erste_video_url(new.body);
  return new;
end;
$$;

comment on function public.posts_video_url_setzen() is
  'Setzt `posts.video_url` aus `body`. Bewusst auf JEDEM Update, nicht nur bei '
  '`update of body`: sonst kaeme ein `update posts set video_url = …` daran '
  'vorbei, und die Spalte waere wieder frei waehlbar (AGE-533).';

-- Beide Funktionen sind Innereien. Eine neue Funktion ist per Voreinstellung
-- fuer PUBLIC ausfuehrbar; ohne diese Zeilen waere das eine stille
-- Rechteausweitung (Befund codex, MEDIUM). Trigger-Funktionen brauchen zur
-- Laufzeit KEIN EXECUTE des schreibenden Kontos — geprueft wird beim Anlegen
-- des Triggers, und das geschieht hier als Eigentuemer.
revoke execute on function public.erste_video_url(text)  from public, anon, authenticated;
revoke execute on function public.posts_video_url_setzen() from public, anon, authenticated;

create trigger trg_posts_video_url
  before insert or update on public.posts
  for each row execute function public.posts_video_url_setzen();

-- ── Der Index ─────────────────────────────────────────────────────────────
-- PARTIELL und ueber (created_at desc, id desc): er traegt den Academy-Filter
-- UND deren Sortierung in einem. Ein Index auf `video_url` allein truege die
-- Sortierung nicht, und die Academy sortiert wie der Feed.
create index posts_video_url_idx on public.posts (created_at desc, id desc)
  where video_url is not null;

comment on index public.posts_video_url_idx is
  'Traegt die Academy: Filter (`video_url is not null`) und Sortierung '
  '(created_at desc, id desc) in einem Index (AGE-533).';

-- ── Backfill ──────────────────────────────────────────────────────────────
-- Ueber DIESELBE Funktion wie der Trigger. Es gibt bereits Beitraege mit
-- Videolinks im Body; ohne diese Zeile waere die Academy am Starttag ohne die
-- Videos, die laengst geteilt wurden.
--
-- Gemessen vor der Migration (scripts/probe-c9-bestand.ts, rein lesend, DEV
-- 2026-08-13): 12 Beitraege, davon 2 mit einbettbarem Video, keiner mit zwei.
-- Der Sollwert nach diesem Update ist also 2 — steht in EVIDENCE.md.
--
-- Das `where` ist nicht Kosmetik: ohne es schriebe das Update jede Zeile neu
-- und feuerte den Trigger fuer alle.
update public.posts
   set video_url = public.erste_video_url(body)
 where video_url is distinct from public.erste_video_url(body);
