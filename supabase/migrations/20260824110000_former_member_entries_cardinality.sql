-- ════════════════════════════════════════════════════════════════════════════
-- AGE-581 — die Arbeitsgrenze von `former_member_entries` zählt jetzt ELEMENTE
-- ════════════════════════════════════════════════════════════════════════════
--
-- Befund aus dem Diff-Review zu 11.5 (codex, 24.08.), an der Datenbank
-- nachgeprüft.
--
-- `array_length(x, 1)` zählt die erste DIMENSION, nicht die Elemente. Ein
-- zweidimensionales `uuid[]` — `{{a,b,c}}` — hat in der ersten Dimension genau
-- eine Zeile:
--
--     with a as (select array[array[gen_random_uuid(),
--                                gen_random_uuid(),
--                                gen_random_uuid()]] x)
--     select array_length(x,1), cardinality(x), array_ndims(x) from a;
--     →  1  |  3  |  2
--
-- `= any(...)` durchsucht dagegen ALLE Elemente, gleich welcher Dimension. Die
-- 200er-Grenze war damit von jedem Angemeldeten zu umgehen: ein Aufruf mit
-- einer äusseren Zeile und zehntausend UUIDs darin kam als „1" durch und
-- führte zehntausend Vergleiche aus. Kein Datenleck — das Sichtbarkeitsprädikat
-- steht davor unberührt —, aber die Grenze war Kulisse, und eine Grenze, die
-- nur den ehrlichen Aufrufer bindet, ist keine.
--
-- ZWEI ÄNDERUNGEN, NICHT EINE. `cardinality()` allein zählte richtig, liesse
-- aber weiter mehrdimensionale Arrays zu — und für die ist das Ergebnis der
-- Funktion sinnlos, weil `kind`/`entry_id` die Form der Eingabe nicht
-- abbilden. Ein Array mit mehr als einer Dimension wird deshalb abgewiesen,
-- und zwar mit demselben `22023` wie die Überschreitung: der Aufrufer hat in
-- beiden Fällen etwas geschickt, das die Funktion nicht beantwortet.
--
-- `array_ndims('{}')` ist NULL, nicht 0 — der Standardfall (leeres Array)
-- läuft deshalb durch die Prüfung hindurch, ohne sie auszulösen. Das ist
-- beabsichtigt und der Grund, warum hier nicht `coalesce(..., 1)` steht: ein
-- NULL-Vergleich ist hier genau das richtige „keine Aussage, also kein Abbruch".
--
-- Sonst NICHTS geändert: derselbe Rumpf, dieselbe Signatur, damit Grants und
-- Kommentar aus 20260823160000 erhalten bleiben.
--
-- Forward-only.

create or replace function public.former_member_entries(
  p_post_ids    uuid[] default '{}',
  p_comment_ids uuid[] default '{}'
)
returns table (kind text, entry_id uuid, former boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_grenze constant int := 200;
  v_anzahl int := coalesce(cardinality(p_post_ids), 0)
                + coalesce(cardinality(p_comment_ids), 0);
begin
  if array_ndims(p_post_ids) > 1 or array_ndims(p_comment_ids) > 1 then
    raise exception 'mehrdimensionale Arrays werden nicht angenommen'
      using errcode = '22023';
  end if;

  if v_anzahl > v_grenze then
    raise exception 'zu viele Eintraege: % (hoechstens %)', v_anzahl, v_grenze
      using errcode = '22023';
  end if;

  return query
    -- Die sichtbaren Beiträge — die der Aufrufer gefragt hat UND die, unter
    -- denen die gefragten Kommentare hängen. Beides in EINER Menge, damit das
    -- abgeschriebene Prädikat auch nur einmal dasteht.
    with sichtbar as (
      select p.id, p.author_id
        from public.posts p
       where public.is_activated()
         and ( p.visibility = 'public'
               or (p.visibility = 'members' and public.has_level(4))
               or p.author_id = (select auth.uid()) )
         and ( p.id = any(p_post_ids)
               or exists (select 1
                            from public.comments c
                           where c.id = any(p_comment_ids)
                             and c.post_id = p.id) )
    )
    select 'post'::text, s.id,
           -- NICHT `not is_activated_profile(...)`: das wäre auch für ein nie
           -- bestätigtes Konto wahr, und das wurde nicht entfernt, es ist nur
           -- nie angekommen.
           (pr.disabled_at is not null or pr.deleted_at is not null)
      from sichtbar s
      join public.profiles pr on pr.id = s.author_id
     where s.id = any(p_post_ids)
    union all
    select 'comment'::text, c.id,
           (pr.disabled_at is not null or pr.deleted_at is not null)
      from public.comments c
      join sichtbar s on s.id = c.post_id
      join public.profiles pr on pr.id = c.author_id
     where c.id = any(p_comment_ids);
end $$;
