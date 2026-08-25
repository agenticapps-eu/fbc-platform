-- Die zwei Aggregate der Feed-Sidebar (AGE-582).
-- Donald, 2026-08-24. Change: openspec/changes/activity-concept-level/.
--
-- ══ WARUM `security invoker` UND NICHT `definer` ═══════════════════════════
-- Der erste Entwurf wählte `security definer` mit einer wörtlichen Abschrift
-- des Sichtbarkeitsprädikats, festgehalten per pgTAP — nach dem Vorbild von
-- `former_member_entries`. Die Plan-Review hat ihn gedreht, und der Einwand
-- trägt: diese beiden Funktionen aggregieren ausschliesslich Tabellen, die der
-- Aufrufer OHNEHIN unter RLS lesen darf. Ein privilegierter Zugriff wird nicht
-- gebraucht, also wären die Abschriften Nummer vier und fünf reiner Aufwand für
-- ein Ergebnis, das ohne sie schon stimmt.
--
-- Unter `invoker` ist die Zahl richtig, WEIL DIE REGEL WIRKT — nicht, weil eine
-- Abschrift sie nachspricht. Eine Abschrift kann driften, eine Policy nicht.
-- `former_member_entries` bleibt das gültige Vorbild für SEINEN Fall: dort wird
-- tatsächlich mehr gebraucht, als der Aufrufer sehen darf. Hier nicht.
--
-- Der Preis ist, dass die Aggregation je Aufruf durch die Policy läuft. Der
-- `EXPLAIN` dazu steht weiter unten.
--
-- ══ WARUM ÜBER `tags` UND NICHT ÜBER `unnest(posts.hashtags)` ══════════════
-- `posts.hashtags` trägt auch FREI GETIPPTE Schlagworte. Eine Zählung darüber
-- legte sie offen und stellte sie womöglich noch vor die kuratierten — und ein
-- stillgelegtes Tag (`tags.active = false`) käme zurück, obwohl es bewusst aus
-- der Auswahl genommen wurde. Der Join über `tags` dreht die Richtung um: die
-- redaktionelle Liste bestimmt, WAS gezählt wird, der Feed nur noch WIE OFT.
--
-- ══ WARUM EIN INNER JOIN UND KEIN `left join` ══════════════════════════════
-- Ein Tag ohne einen einzigen sichtbaren Beitrag erscheint GAR NICHT — nicht
-- mit der Zahl null. Schon sein Erscheinen verriete, dass es ihn gibt und dass
-- jemand darunter etwas geschrieben hat, das der Betrachter nicht sehen darf.
-- Der innere Join erledigt das von selbst; ein `left join` mit `having` wäre
-- derselbe Gedanke, nur später und mit einer Zeile mehr, die man vergessen kann.
--
-- ══ WAS DER AUSGELOGGTE BESUCHER ZÄHLT ═════════════════════════════════════
-- `feed_tag_counts()` ist auch an `anon` vergeben, und das ist keine Nachlässig-
-- keit: `posts` trägt für `anon` die eigene Policy `posts_select_public_anon`
-- mit `visibility = 'public'`. Unter `invoker` zählt der ausgeloggte Besucher
-- also NACHWEISLICH nur öffentliche Beiträge — zugesichert in
-- `feed_sidebar_test.sql`, nicht behauptet.
--
-- `feed_top_authors` ist NICHT an `anon` vergeben. `profiles_public` hält für
-- `anon` kein Recht (AGE-530), der Aufruf liefe in einen Fehler — und der Name
-- eines Mitglieds gehört ohnehin nicht ins Schaufenster. Das steht hier als
-- GRANT und nicht nur als Vorsatz im Client: ein Aufrufweg, den es nicht gibt,
-- kann nicht versehentlich entstehen.
--
-- ══ WARUM DIE REIHENFOLGE VOLLSTÄNDIG FESTGELEGT IST ═══════════════════════
-- Bei gleicher Zahl entscheidet ein zweites und ein drittes Merkmal, sonst
-- liefern zwei Aufrufe zwei Listen. Bei den Tags ist es die redaktionelle
-- `sort`-Spalte und dann der Schlüssel; bei den Autoren der Name und dann die
-- Kennung. Der Schlüssel und die Kennung sind eindeutig — damit ist die Ordnung
-- total, nicht nur meistens eindeutig.
--
-- ══ DIE OBERGRENZEN ════════════════════════════════════════════════════════
-- `feed_tag_counts()` hat keine Parameter, also steht die Grenze fest: 50. Die
-- kuratierte Liste trägt heute 15 Einträge; 50 ist damit keine Kappung echter
-- Daten, sondern eine Schranke gegen eine Liste, die jemand später aufbläht.
-- Was davon die Sidebar zeigt, entscheidet die Sidebar.
--
-- `feed_top_authors(p_limit)` klemmt auf 1..20 und nimmt bei `null` die 5. Ein
-- ungültiger Wert wird also zurechtgebogen und nicht abgewiesen: die Funktion
-- hat keinen Fehlerfall, den ein Aufrufer sinnvoll behandeln könnte, und ein
-- `raise` an dieser Stelle machte aus einer Sidebar-Kachel einen Seitenfehler.
--
-- ══ KEIN `offset` — ABGEWOGEN GEGEN DIE STEHENDE REGEL ══════════════════════
-- In diesem Projekt gilt: `limit`/`offset` gehören in die ERSTE Fassung jeder
-- listenden RPC, ausdrücklich auch bei kleinen Beständen. Der Code-Review zum
-- Diff hat zu Recht gefragt, warum das hier fehlt.
--
-- Weil beides keine LISTEN sind, sondern Spitzenwerte. „Die fünf aktivsten
-- Mitglieder, Seite 2" ist keine Frage, die jemand stellt — und die kuratierte
-- Tagliste ist mit 15 Einträgen redaktionell begrenzt, nicht durch die Abfrage.
-- Ein `p_offset` hätte hier keinen Aufrufer, und ein Parameter ohne Aufrufer ist
-- eine Fläche, die man pflegen muss, ohne dass sie etwas leistet.
--
-- Die Regel bleibt richtig für das, wofür sie geschrieben wurde: `feed_saved`,
-- `feed_mine` und das Verzeichnis blättern und tragen ihr Paging ab der ersten
-- Fassung. Sollte die Sidebar je ein „mehr anzeigen" bekommen, ist das der
-- Moment für `p_offset` — nicht jetzt auf Verdacht.
--
-- ══ GEZÄHLT WIRD NACH BEITRÄGEN, NICHT NACH BEITRÄGEN UND KOMMENTAREN ══════
-- Kommentare mitzuzählen zöge ein zweites Sichtbarkeitsprädikat
-- (`comments_select_visible`) in dieselbe Funktion, für eine Zahl, die dasselbe
-- aussagt.
--
-- ENTSCHIEDEN am 25.08. (Donald): gezählt werden ALLE sichtbaren Beiträge, also
-- auch die `kind = 'event'`-Beiträge, die der Trigger dem Gastgeber anlegt. Die
-- Spezifikation sagt „nach Beiträgen" und schwieg dazu; die Frage lag beim Bau
-- ausdrücklich vor.
--
-- *Warum mitzählen:* ein Event-Beitrag steht als Karte IM Feed. Wer ihn dort
-- sieht, sieht eine Aktivität dieses Mitglieds — die Liste wäre schwerer zu
-- erklären, wenn sie eine sichtbare Karte nicht mitzählte. Und ein Verein, der
-- Veranstaltungen ausrichtet, hält das Ausrichten für Aktivität.
--
-- *Der Preis:* ein Gastgeber vieler Veranstaltungen steht weiter oben, ohne je
-- etwas geschrieben zu haben. Wer das drehen will, hängt `and p.kind =
-- 'member'` an — eine Zeile, eine Testanpassung.
--
-- ══ EXPLAIN, GEMESSEN — UND DIE ENTSCHEIDUNG GEGEN EINEN NEUEN INDEX ═══════
-- Lokal, 20 000 Beiträge, 30 aktive Tags, 20 Autoren, als bestätigtes Mitglied
-- auf `impact`. Gemessen wurde der RUMPF, nicht der Aufruf: eine SQL-Funktion
-- mit `set search_path` wird nicht eingebettet, `explain select * from f()`
-- zeigte also nur einen Function Scan.
--
--   feed_tag_counts   507 ms, Buffers hit=71 067
--   feed_top_authors  472 ms, Buffers hit=78 001
--
-- Das ist viel, und der naheliegende Verdacht war der Tag-Join: der Planer
-- nimmt den vorhandenen `posts_hashtags_gin` NICHT, sondern schleift die 30
-- Tags im Nested Loop über alle Beiträge (580 000 verworfene Zeilen).
--
-- Der Verdacht ist FALSCH, und das ist der Grund, warum hier kein Index
-- dazukommt. Gegengerechnet mit der Fassung, die das Design verworfen hat
-- (`posts, unnest(hashtags) join tags`): **489 ms** statt 507 — im Rauschen.
-- Die Form des Joins kostet nichts.
--
-- Wo die Zeit wirklich liegt, zeigt derselbe `count(*)` über dieselben 20 000
-- Beiträge:
--
--   ohne RLS (als Eigentümer)   0,79 ms, Buffers hit=364
--   unter RLS                 464    ms, Buffers hit=71 065
--
-- Also Faktor 195 in Zeit UND Puffern, und zwar bevor irgendetwas aggregiert
-- wird. `posts_select_by_visibility` wird je Zeile ausgewertet, und darin ruft
-- `has_level(4)` für jeden `members`-Beitrag erneut die Stufe des Aufrufers ab.
--
-- Folgen, festgehalten statt behoben:
--   * KEIN neuer Index. Ein GIN auf `hashtags` besteht bereits und würde hier
--     nichts ändern — man kann nicht wegindizieren, was das Prädikat kostet.
--   * KEINE Umstellung auf `unnest`. Sie brächte 3 % und gäbe die klare
--     Aussage „gezählt wird über die kuratierte Liste" auf.
--   * Die Obergrenze ist die des PRÄDIKATS, nicht die dieser Funktionen. Sie zu
--     senken hiesse, `posts_select_by_visibility` anzufassen — die Regel, an der
--     der ganze Feed hängt. Das gehört nicht in diesen Change.
--   * Heute ist all das ohne Wirkung: PROD trägt 4 Beiträge, DEV 29. Bei 20 000
--     wäre es eine Sidebar, die eine halbe Sekunde kostet.
--
-- Forward-only.

create function public.feed_tag_counts()
  returns table (tag_key text, tag_label text, post_count bigint)
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select t.key, t.label, count(*)
    from public.tags t
    join public.posts p on p.hashtags @> array[t.key]
   where t.active
   group by t.key, t.label, t.sort
   order by count(*) desc, t.sort, t.key
   limit 50;
$$;

comment on function public.feed_tag_counts() is
  'Zaehlt die aktiven kuratierten Tags ueber die Beitraege, die der AUFRUFER '
  'sehen darf (security invoker — kein kopiertes Praedikat). Ein Tag ohne '
  'sichtbaren Beitrag erscheint gar nicht, auch nicht mit der Zahl null. Fuer '
  'anon greift posts_select_public_anon, es zaehlen also nur oeffentliche '
  'Beitraege. Obergrenze 50.';

revoke execute on function public.feed_tag_counts() from public;
grant  execute on function public.feed_tag_counts() to anon, authenticated;

create function public.feed_top_authors(p_limit int default 5)
  returns table (profile_id uuid, name text, avatar_url text, post_count bigint)
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select a.id, a.name, a.avatar_url, count(*)
    from public.posts p
    join public.profiles_public a on a.id = p.author_id
   group by a.id, a.name, a.avatar_url
   order by count(*) desc, a.name, a.id
   limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

comment on function public.feed_top_authors(int) is
  'Die aktivsten Mitglieder nach Zahl der Beitraege, die der AUFRUFER sehen '
  'darf (security invoker). Namen kommen aus profiles_public — die View '
  'schliesst zurueckgezogene, unbestaetigte, deaktivierte und geloeschte '
  'Profile selbst aus, ein eigenes Praedikat waere eine weitere Kopie. NICHT '
  'an anon vergeben: dort haelt profiles_public kein Recht. p_limit wird auf '
  '1..20 geklemmt, null wird zu 5.';

revoke execute on function public.feed_top_authors(int) from public, anon;
grant  execute on function public.feed_top_authors(int) to authenticated;
