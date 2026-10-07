-- „Die aktivsten Mitglieder" zaehlt keine Produktmitteilungen mehr (AGE-1004).
-- Change: openspec/changes/neuigkeiten-als-plattform/
--
-- ════════════════════════════════════════════════════════════════════════════
-- WARUM
-- ════════════════════════════════════════════════════════════════════════════
-- Donald am 03.10.: „ich stehe da als aktivstes Mitglied wegen den Release
-- Notes, das soll nicht unter meinem Namen released werden, sondern von der
-- Plattform selber."
--
-- Auf PROD gemessen: 23 von 44 Beitraegen tragen `kind = 'release'`, alle unter
-- EINEM Konto. Dieses Konto hat die Mitteilungen zugestellt, nicht verfasst —
-- und stand damit zwangslaeufig an der Spitze einer Liste, die nach eigenen
-- Wortmeldungen fragt.
--
-- Wirkung, vorher/nachher gegen PROD gerechnet:
--
--   Konto A   23 -> 0    faellt aus der Liste (stellt nur Neuigkeiten zu)
--   Konto B   18 -> 18   unveraendert
--   Konto C    2 -> 2
--   Konto D    1 -> 1
--
-- ════════════════════════════════════════════════════════════════════════════
-- VERANSTALTUNGEN ZAEHLEN WEITER MIT — DAS IST DIE ENTSCHEIDUNG, NICHT DIE LUECKE
-- ════════════════════════════════════════════════════════════════════════════
-- Die naheliegende Bedingung waere `kind = 'member'` gewesen. Sie ist falsch,
-- und der Kopf der abgeloesten Migration (20260824170000) sagt warum:
--
--   ENTSCHIEDEN am 25.08. (Donald): gezaehlt werden ALLE sichtbaren Beitraege,
--   also auch die `kind = 'event'`-Beitraege, die der Trigger dem Gastgeber
--   anlegt. […] Ein Event-Beitrag steht als Karte IM Feed. Wer ihn dort sieht,
--   sieht eine Aktivitaet dieses Mitglieds […] Und ein Verein, der
--   Veranstaltungen ausrichtet, haelt das Ausrichten fuer Aktivitaet.
--   Der Preis: ein Gastgeber vieler Veranstaltungen steht weiter oben, ohne je
--   etwas geschrieben zu haben.
--
-- Der Kopf nennt sogar die Zeile vorweg, die man anhaengen muesste, „wer das
-- drehen will". Die Beschwerde, die diesen Change ausgeloest hat, betrifft
-- NEUIGKEITEN. Eine Produktentscheidung nebenbei umzudrehen, weil die
-- naheliegende Bedingung sie mit erfasst, waere stilles Mitnehmen. Befund der
-- Plan-Review (codex, MEDIUM), bestaetigt von Donald am 07.10.: die
-- Entscheidung vom 25.08. bleibt.
--
-- ════════════════════════════════════════════════════════════════════════════
-- POSITIVLISTE, KEINE AUSSCHLUSSLISTE
-- ════════════════════════════════════════════════════════════════════════════
-- `kind in ('member', 'event')` statt `kind <> 'release'`. Heute dasselbe
-- Ergebnis, nicht dieselbe Haltbarkeit: eine vierte Beitragsart, die jemand
-- spaeter einfuehrt, wuerde von einer Ausschlussliste STILL MITGEZAEHLT — genau
-- der Fehler, den diese Migration behebt.
--
-- ════════════════════════════════════════════════════════════════════════════
-- WAS SICH NICHT AENDERT
-- ════════════════════════════════════════════════════════════════════════════
-- `security invoker` BLEIBT. Die Funktion zaehlt `posts` unter den Rechten des
-- Aufrufers, und beide SELECT-Policies tragen `veroeffentlicht_ab <= now()`.
-- Als DEFINER zaehlte sie terminierte Beitraege mit. Das Praedikat wird NICHT
-- in die Funktion kopiert; Kopien laufen auseinander.
--
-- `posts.author_id` bleibt, wie es ist. Ein „Plattform-Konto" in `profiles`
-- waere der naheliegende und der falsche Weg: eine Profilzeile ist eine
-- Mitgliedszeile, und jede Liste und jede Zaehlung ueber Mitglieder muesste sie
-- fortan ausnehmen. Die Urheberschaft bleibt in den Daten, sie wird nur nicht
-- mehr gezaehlt.
--
-- KEIN INDEX, und das ist gemessen statt vermutet. Die Plan-Review hat einen
-- auf `posts.kind` gefordert. `EXPLAIN (ANALYZE, BUFFERS)` auf PROD, derselbe
-- Rumpf mit und ohne Filter:
--
--   Kosten      32,10  ->  18,07
--   Puffer         74  ->     71
--   Laufzeit  1,261ms  ->  0,842ms
--   Plan      Hash Join + 2x Seq Scan  ->  Nested Loop + Index Scan profiles_pkey
--
-- Der Filter macht die Abfrage BILLIGER: weniger Zeilen gehen in den Verbund,
-- und der Planer wechselt deshalb auf einen Indexzugriff. Bei 44 Zeilen waehlt
-- er einen Index auf `kind` ohnehin nie. Waechst `posts` je so weit, dass es
-- zaehlt, waere der hilfreiche Index ein PARTIELLER auf
-- `(author_id) where kind in ('member','event')` — und auch der erst nach einer
-- Messung.
--
-- Die Grants werden nicht angefasst: `create or replace` behaelt sie, und ein
-- ueberfluessiges `grant` verschleierte, was sich wirklich aendert.

create or replace function public.feed_top_authors(p_limit int default 5)
  returns table (profile_id uuid, name text, avatar_url text, post_count bigint)
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select a.id, a.name, a.avatar_url, count(*)
    from public.posts p
    join public.profiles_public a on a.id = p.author_id
   where p.kind in ('member', 'event')
   group by a.id, a.name, a.avatar_url
   order by count(*) desc, a.name, a.id
   limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

comment on function public.feed_top_authors(int) is
  'Die aktivsten Mitglieder nach Zahl der Beitraege, die sie SELBST verantworten '
  'und die der AUFRUFER sehen darf (security invoker). Gezaehlt werden '
  'kind = ''member'' und kind = ''event''; Produktmitteilungen (kind = ''release'') '
  'NICHT — sie sind Mitteilungen der Plattform, das Konto in author_id hat sie '
  'nur zugestellt (AGE-1004). Dass Veranstaltungen MITzaehlen, ist die '
  'Entscheidung vom 25.08.: wer eine ausrichtet, ist aktiv. Positivliste, damit '
  'eine kuenftige vierte Beitragsart still ausgelassen statt still mitgezaehlt '
  'wird. Namen kommen aus profiles_public — die View schliesst zurueckgezogene, '
  'unbestaetigte, deaktivierte und geloeschte Profile selbst aus. NICHT an anon '
  'vergeben. p_limit wird auf 1..20 geklemmt, null wird zu 5.';
