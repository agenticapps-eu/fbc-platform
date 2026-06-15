-- Aggregierte Engagement-Zähler für den Community-Feed (AGE-250).
--
-- Problem: `post_likes` ist per `likes_write_own` (20260612090845) bewusst owner-only
-- lesbar — ein Mitglied sieht NUR die eigenen Like-Zeilen. Ein echter Like-Zähler ist
-- damit clientseitig nicht berechenbar. `comments` ist zwar je nach Post-Sichtbarkeit
-- lesbar, aber das Frontend müsste alle Kommentarzeilen laden, nur um sie zu zählen.
--
-- Lösung: eine read-only Aggregatfunktion (analog zu `search_directory`). SECURITY
-- DEFINER, damit sie über die owner-only Likes-Policy hinweg zählen darf — gibt aber
-- AUSSCHLIESSLICH Zahlen zurück, NIE wer geliked/kommentiert hat (wahrt die Diskretion
-- des Clubs). Sie liefert Zähler nur für Posts, die der Aufrufer ohnehin sehen darf:
-- das `where` spiegelt exakt `posts_select_by_visibility`, damit die Definer-Rechte
-- keine Zähler für unsichtbare Posts (z. B. 'legacy' an einen Prime) durchsickern lassen.

create or replace function public.post_engagement_counts(p_post_ids uuid[])
returns table (post_id uuid, like_count bigint, comment_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    (select count(*) from public.post_likes pl where pl.post_id = p.id),
    (select count(*) from public.comments  c  where c.post_id  = p.id)
  from public.posts p
  -- Obergrenze: die Funktion ist an anon vergeben und nimmt einen beliebigen
  -- ID-Array entgegen. Ohne Cap könnte ein anonymer Aufruf zwei korrelierte
  -- count(*)-Subqueries über zehntausende IDs auslösen (CPU-Amplifikation). Der
  -- Feed fragt nie mehr als 50 Posts ab; 200 ist großzügig gepuffert.
  where cardinality(p_post_ids) <= 200
    and p.id = any (p_post_ids)
    and (
      p.visibility = 'public'
      or ( p.visibility = 'members' and (select auth.uid()) is not null )
      or ( p.visibility = 'prime'   and coalesce(public.current_tier_rank(), 0) >= 5 )
      or ( p.visibility = 'legacy'  and coalesce(public.current_tier_rank(), 0) >= 7 )
      or p.author_id = (select auth.uid())
    );
$$;

comment on function public.post_engagement_counts(uuid[]) is
  'Read-only Aggregat-Zähler (likes/comments) je Post für den Feed (AGE-250). '
  'SECURITY DEFINER, um über die owner-only post_likes-Policy zu zählen; gibt nur '
  'Zahlen zurück und nur für Posts, die der Aufrufer per posts_select_by_visibility '
  'ohnehin sehen darf. Keine Identitäten.';

-- anon zählt nur 'public'-Posts (auth.uid() null), authenticated zusätzlich members/rank.
grant execute on function public.post_engagement_counts(uuid[]) to anon, authenticated;
