-- „Ehemaliges Mitglied": die Feed-Auskunft über entfernte Urheber (AGE-581).
-- Donald, 2026-08-23. Change: openspec/changes/add-admin-member-lifecycle/.
--
-- ══ WAS SIE BEANTWORTET UND WARUM ES EINE FUNKTION BRAUCHT ═════════════════
-- Beiträge und Kommentare eines entfernten Mitglieds BLEIBEN stehen. Sie zu
-- löschen veränderte fremde Beiträge: ein Gesprächsfaden, aus dem der Anfang
-- verschwindet, ist für alle anderen kaputt. Nur der Name geht.
--
-- Der Feed kann das nicht selbst sehen. Sein Autorenpfad ist `profiles_public`,
-- und daraus ist ein entferntes Profil seit 20260823120000 verschwunden — ein
-- fehlender Treffer heisst dort aber schon etwas anderes, nämlich „Mitglied hat
-- sein Profil zurückgezogen" (AGE-530, angezeigt als „Ein Mitglied"). Beide
-- Sachverhalte auf denselben Text fallen zu lassen, gäbe dem Feed für
-- „Autor fehlt" zwei Ursachen, die gleich aussehen.
--
-- ══ WARUM BEITRAGS-IDs UND KEINE PROFIL-IDs ════════════════════════════════
-- Der Plan-Review hat den ersten Entwurf mit HIGH verworfen, und der Befund
-- trägt: einer Funktion, der man PROFIL-IDs übergibt, kann man nicht ansehen,
-- woher der Aufrufer sie hat. Die Zusage „nur über Autoren, die aus einem
-- sichtbaren Beitrag stammen" wäre dann eine Bitte an den Aufrufer und keine
-- Eigenschaft der Funktion — jeder Angemeldete könnte beliebige bekannte IDs
-- durchreichen und erführe, wer aus dem Verein entfernt wurde.
--
-- Mit Beitrags- und Kommentar-IDs löst sie den Urheber SELBST auf und wendet
-- dabei dasselbe Sichtbarkeitsprädikat an, das für den Beitrag gilt. Damit gibt
-- sie genau eine Information preis: dass der Urheber eines Beitrags, den der
-- Aufrufer ohnehin vor sich hat, kein Mitglied mehr ist.
--
-- ══ WARUM SECURITY DEFINER UND EIN ABGESCHRIEBENES PRÄDIKAT ════════════════
-- Sie MUSS `profiles.disabled_at`/`deleted_at` des Urhebers lesen, und genau
-- diese Zeile ist dem Aufrufer verschlossen — das Gate blendet sie ganz aus.
-- Also DEFINER, und damit ist die RLS auf `posts` ausgeschaltet und das
-- Prädikat steht hier ein zweites Mal.
--
-- Das ist eine bekannte Falle in diesem Projekt: `profiles_public` läuft mit
-- `security_invoker = off`, und vier DEFINER-RPCs duplizieren dort ihr
-- Prädikat. Jede neue Sichtbarkeitsregel muss daher an mehr als einer Stelle
-- ankommen. Der Ausweg wäre SECURITY INVOKER — dann trüge die RLS die
-- Sichtbarkeit von selbst. Er ist VERWORFEN, weil er einen DEFINER-Helfer
-- „ist dieses Profil entfernt?" bräuchte, der `authenticated` ausführen dürfte:
-- das wäre wieder genau der Aufzählungsweg, den der Review verworfen hat, nur
-- eine Ebene tiefer. Lieber eine Kopie, die ein Test festhält, als eine offene
-- Tür.
--
-- Abgeschrieben ist `posts_select_by_visibility`, wörtlich:
--   is_activated() and (visibility='public'
--                       or (visibility='members' and has_level(4))
--                       or author_id = auth.uid())
--
-- Die Kommentarseite braucht KEINE zweite Kopie: `comments_select_visible`
-- hängt selbst an der Sichtbarkeit des Beitrags, und dieselbe Verbindung steht
-- hier über den `join` auf `sichtbar`.
--
-- ══ WARUM EINE OBERGRENZE ══════════════════════════════════════════════════
-- 200 Einträge je Aufruf. Eine Feedseite trägt 20 Beiträge; die Grenze lässt
-- also reichlich Luft für einen langen Kommentarfaden und ist trotzdem keine
-- Einladung, den Bestand in einem Aufruf durchzuprüfen. Sie ist die zweite
-- Schranke, nicht die erste — die erste ist, dass über einen unsichtbaren
-- Beitrag ohnehin keine Auskunft kommt.
--
-- ══ WARUM `former` UND KEIN ZUSTANDSWORT ═══════════════════════════════════
-- Ein Feld mit den Werten `deaktiviert`/`geloescht` verriete jedem Leser des
-- Feeds, welche der beiden Handlungen ein Admin vorgenommen hat. Dieselbe
-- Entscheidung wie bei `my_activation_state.blocked`.
--
-- Forward-only.

create function public.former_member_entries(
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
  v_anzahl int := coalesce(array_length(p_post_ids, 1), 0)
                + coalesce(array_length(p_comment_ids, 1), 0);
begin
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

revoke execute on function public.former_member_entries(uuid[], uuid[]) from public, anon;
grant  execute on function public.former_member_entries(uuid[], uuid[]) to authenticated;

comment on function public.former_member_entries(uuid[], uuid[]) is
  'Sagt fuer BEITRAGS- und KOMMENTAR-IDs, ob ihr Urheber ein entferntes '
  'Mitglied ist (AGE-581) — die Grundlage fuer „Ehemaliges Mitglied" im Feed. '
  'Nimmt bewusst KEINE Profil-IDs: sonst waere die Zusage „nur ueber Autoren '
  'aus sichtbaren Beitraegen" eine Bitte an den Aufrufer statt einer '
  'Eigenschaft der Funktion, und jeder Angemeldete koennte erfahren, wer '
  'entfernt wurde. SECURITY DEFINER, WEIL die Sperrfelder des Urhebers dem '
  'Aufrufer verschlossen sind; deshalb steht das Praedikat aus '
  'posts_select_by_visibility hier ein zweites Mal — eine pgTAP-Zusage haelt '
  'die Kopie fest. Liefert weder Name noch Bild noch Stufe und '
  'unterscheidet deaktiviert NICHT von geloescht. Hoechstens 200 IDs je '
  'Aufruf. Ohne Session wird sie nicht gerufen (kein EXECUTE fuer anon).';
