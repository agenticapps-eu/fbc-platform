-- Die zwei Indizes, die dieser Change voraussetzt (AGE-528, C7).
-- Donald, 2026-08-12. Befund aus dem Fremd-Review auf dem Diff.
--
-- ── Der GIN-Index, den es nie gab ──────────────────────────────────────────
-- `20260812090200_tags.sql` und `design.md` begründen den Verzicht auf eine
-- Verknüpfungstabelle unter anderem damit, dass „`.contains("hashtags", […])`
-- und ihr GIN-Index unverändert weiterarbeiten". Der zweite Teil war schlicht
-- falsch: `grep "using gin"` findet fünf Indizes in diesem Repo — auf
-- `profiles.interests`, `profiles.competencies`, `offers.tags`, `needs.tags`
-- und `profiles.search_doc` — und keinen auf `posts.hashtags`. Die Filterung
-- lief seit AGE-250 als Seq-Scan.
--
-- Das wog wenig, solange der Hashtag-Filter ein Nebenweg war (ein Klick auf
-- einen Chip). Mit C7 wird er die Hauptnavigation der rechten Spalte. Gemessen
-- vor dieser Migration, mit `set enable_seqscan = off` — also unter einem
-- Kostenaufschlag von 1e10 auf den Seq-Scan, damit der Planer JEDEN Index
-- vorzieht, der überhaupt passt:
--
--   Seq Scan on posts  (cost=10000000000.00..10000000016.12)
--     Filter: (hashtags @> '{netzwerken}'::text[])
--
-- Der Planer bleibt beim Seq-Scan. Das ist kein Zeilenzahl-Argument, sondern
-- der Beweis, dass kein Index existiert, der die Anfrage bedienen KÖNNTE.
--
-- ── Der Index für den Keyset-Cursor ────────────────────────────────────────
-- `fetchFeed` sortiert seit C7 über `(created_at desc, id desc)` — der
-- Stichentscheid, ohne den zeitgleiche Beiträge an der Seitengrenze
-- verschwinden. Vorhanden ist nur `posts_visibility_created_at_idx
-- (visibility, created_at)` aus 20260612075901; seine führende Spalte ist
-- `visibility`, also kann er diese Sortierung nicht bedienen. Dieselbe Messung:
--
--   Sort  Sort Key: created_at DESC, id DESC
--     ->  Seq Scan on posts  (cost=10000000000.00..10000000014.90)
--
-- Jede Seite sortiert damit die ganze sichtbare Menge — auch die erste, auch
-- auf der öffentlichen Startseite. Die Paginierung ist genau deshalb entstanden,
-- weil die Tabelle wachsen soll; der Index, der sie billig macht, fehlte.
--
-- Der bestehende `posts_visibility_created_at_idx` bleibt: er bedient weiterhin
-- die Sichtbarkeits-Prädikate der RLS.
--
-- Forward-only.

create index posts_created_at_id_idx on public.posts (created_at desc, id desc);
create index posts_hashtags_gin      on public.posts using gin (hashtags);

comment on index public.posts_created_at_id_idx is
  'Trägt den Keyset-Cursor des Feeds: order by created_at desc, id desc (AGE-528).';
comment on index public.posts_hashtags_gin is
  'Trägt `hashtags @> array[…]` — den Tag-Filter, der mit C7 zur Hauptnavigation wird (AGE-528).';
