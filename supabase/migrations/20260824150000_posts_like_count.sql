-- Beliebtheit als materialisierte Zahl: `posts.like_count` (AGE-582).
-- Donald, 2026-08-24. Change: openspec/changes/activity-concept-level/.
--
-- ══ WARUM EINE SPALTE UND NICHT DIE VORHANDENE ZÄHL-RPC ════════════════════
-- `post_engagement_counts` beantwortet die Frage für die IDs einer BEREITS
-- geladenen Seite. Nach etwas zu sortieren, das erst nach dem Blättern
-- entsteht, geht nicht — die Ordnung muss in der Abfrage stehen, die die Seite
-- überhaupt erst auswählt.
--
-- *Verworfen — eine eigene Tabelle `post_engagement` mit nur SELECT-Recht:*
-- gegen Fälschung von Haus aus sicher, aber die Ordnung liefe dann über eine
-- eingebettete Ressource. Der Keyset-Cursor braucht `or(...)`-Bedingungen über
-- die Sortierfelder, und die sind über eine Einbettung nicht ausdrückbar. Das
-- Blättern fiele auf `offset` zurück — genau die stille Kappung, die AGE-528
-- abgeschafft hat.
--
-- *Verworfen — eine eigene RPC `feed_by_popularity(...)`:* wäre die VIERTE
-- Kopie des Sichtbarkeitsprädikats und müsste Autoren-Anreicherung, Zähler und
-- Cursor nachbauen.
--
-- ══ WARUM DIESE MIGRATION HINTER DEM RECHTE-ENTZUG STEHT ═══════════════════
-- 20260824140000 hat `post_likes` das UPDATE-Recht genommen. Erst damit ist ein
-- Trigger auf INSERT und DELETE vollständig: eine verschiebbare Reaktionszeile
-- liesse sich an ihm vorbei auf einen fremden Beitrag umschreiben und dessen
-- Zahl ins Minus ziehen. Die Reihenfolge ist der Kern, nicht die Kosmetik.
--
-- ══ WARUM `check (like_count >= 0)` UND KEIN `greatest(…, 0)` ══════════════
-- Beides fängt eine negative Zahl ab. `greatest` täte es STILL und machte damit
-- jedes künftige Loch unsichtbar — die Zahl stimmte nicht mehr, sähe aber
-- plausibel aus. Die Prüfbedingung fällt stattdessen laut aus, an der Stelle,
-- an der das Loch entsteht. Unter den heutigen Invarianten kann sie nicht
-- greifen: der Primärschlüssel verhindert die doppelte Reaktion, UPDATE ist
-- entzogen, und ein DELETE entfernt nur eine Zeile, die vorher gezählt wurde.
--
-- ══ WARUM `security definer` ═══════════════════════════════════════════════
-- Die Triggerfunktion schreibt `posts`. Als INVOKER liefe dieses UPDATE unter
-- `posts_write_own` — ein Mitglied könnte dann nur die Zahl an SEINEN eigenen
-- Beiträgen fortschreiben, und ab 20260824160000 fehlte ihm ohnehin das Recht
-- auf der Spalte. Der Zähler wäre damit genau dort falsch, wo er zählt.
--
-- Gehärtet wie jede DEFINER-Funktion in diesem Projekt: `set search_path = ''`
-- und alle Namen schemaqualifiziert. EXECUTE ist entzogen — eine
-- Triggerfunktion braucht es nicht: Postgres prüft das Recht beim ANLEGEN des
-- Triggers, nicht bei jedem Feuern. Ohne den Entzug stünde eine Funktion offen,
-- die `posts` unter fremdem Recht schreibt.
--
-- ══ DER NACHTRAG ═══════════════════════════════════════════════════════════
-- Gemessen am 24.08., damit die Größe keine Schätzung ist: PROD trägt 4
-- Beiträge und 0 Reaktionen, DEV 29 Beiträge und 88 Reaktionen (18 Beiträge mit
-- mindestens einer, höchstens 8 an einem). Ein einzelnes UPDATE reicht auf
-- beiden Seiten; eine Stapelung wäre Aufwand für eine Zahl, die es nicht gibt.
-- Spalte, Funktion, Trigger und Nachtrag stehen in EINER Transaktion — eine
-- Migration ist eine.
--
-- Forward-only.

alter table public.posts
  add column like_count integer not null default 0;

alter table public.posts
  add constraint posts_like_count_nicht_negativ check (like_count >= 0);

comment on column public.posts.like_count is
  'Materialisierte Zahl der Reaktionen, gefuehrt von post_likes_zaehler(). '
  'Nur die Ordnung "Beliebteste" liest sie; die Anzeige an der Karte kommt '
  'weiterhin aus post_engagement_counts. NICHT von Hand schreiben — '
  'authenticated haelt seit 20260824160000 kein UPDATE auf dieser Spalte.';

create function public.post_likes_zaehler()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  end if;

  -- DELETE. Trifft KEINE Zeile, wenn der Beitrag selbst gerade faellt: das
  -- kaskadierende Loeschen raeumt die Reaktionen erst auf, wenn die Zeile in
  -- `posts` schon fort ist. Das ist richtig so und kein Fehlerfall.
  update public.posts set like_count = like_count - 1 where id = old.post_id;
  return old;
end $$;

revoke execute on function public.post_likes_zaehler() from public, anon, authenticated;

create trigger post_likes_zaehler_trg
  after insert or delete on public.post_likes
  for each row execute function public.post_likes_zaehler();

-- Nachtrag fuer den Bestand.
update public.posts p
   set like_count = coalesce(
     (select count(*) from public.post_likes l where l.post_id = p.id), 0);
