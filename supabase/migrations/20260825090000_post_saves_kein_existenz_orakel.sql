-- `post_saves` verrät nicht mehr, DASS es einen Beitrag gibt (AGE-582).
-- Donald, 2026-08-25. Change: openspec/changes/activity-concept-level/.
--
-- ══ DER BEFUND, UND WARUM ER NICHT AN DER POLICY LAG ═══════════════════════
-- Gefunden von codex in der zweiten Meinung auf den Diff (Abschnitt 7.8),
-- Schweregrad MEDIUM, und gegen den lokalen Stack nachgestellt, bevor hier eine
-- Zeile stand:
--
--   * Ein `basic`-Mitglied liest einen `members`-Beitrag NICHT — `select`
--     darauf liefert null Zeilen, gemessen.
--   * Dasselbe Mitglied kann ihn trotzdem SPEICHERN. `insert into post_saves`
--     mit genau dieser Kennung ging durch.
--   * Mit einer erfundenen Kennung geht derselbe Aufruf NICHT durch: er bricht
--     mit `23503` an `post_saves_post_id_fkey`.
--
-- Zwei verschiedene Antworten auf dieselbe Frage sind ein Orakel. Wer eine
-- Beitrags-Kennung hat, erfährt daraus, ob es sie gibt — obwohl er den Beitrag
-- nicht sehen darf. Und weil die Zeile per `on delete cascade` mitfällt, erfährt
-- er später auch noch, dass der Beitrag gelöscht wurde.
--
-- Die alte Policy war nicht falsch, sie war unvollständig: sie prüfte, WER
-- schreibt (`profile_id = auth.uid()`), nicht WORAUF. Die Auskunft kam auch gar
-- nicht aus ihr, sondern aus dem Fremdschlüssel — und dessen Prüfung läuft
-- ausdrücklich an der RLS vorbei. Eine Schranke, die man mit einer anderen
-- Schranke aushebelt, ist der Normalfall dieser Klasse von Fehlern.
--
-- ══ DIE ENGERE FASSUNG, UND WARUM SIE BEIDE FÄLLE GLEICH BEANTWORTET ═══════
-- Neu steht im `with check` zusätzlich, dass der Beitrag für den Aufrufer
-- SICHTBAR sein muss. Der Ausdruck einer Policy wird mit den Rechten des
-- Aufrufers ausgewertet, das `exists` läuft also selbst unter
-- `posts_select_by_visibility` — es ist keine Abschrift des Prädikats, sondern
-- dessen Anwendung. Damit gibt es hier keine vierte Kopie zu pflegen.
--
-- Der springende Punkt ist nicht, dass unsichtbare Beiträge jetzt abgelehnt
-- werden, sondern dass sie GENAUSO abgelehnt werden wie nicht vorhandene: beide
-- Wege enden in `42501`, weil das `exists` in beiden Fällen falsch ist. Der
-- Fremdschlüssel kommt gar nicht mehr an die Reihe. Wo vorher zwei Antworten
-- standen, steht jetzt eine.
--
-- ══ WAS SICH FÜR EIN MITGLIED ÄNDERT: NICHTS ═══════════════════════════════
-- Die Fläche bietet den Speichern-Knopf nur an Karten an, die im Feed stehen —
-- und dort steht nur, was der Betrachter sehen darf. Ein Aufruf, den diese
-- Policy neu ablehnt, kommt aus dieser App nicht.
--
-- ══ WAS SIE WEITERHIN NICHT TUT ════════════════════════════════════════════
-- Sie prüft die Sichtbarkeit BEIM SPEICHERN, nicht danach. Eine bestehende
-- Zeile bleibt liegen, auch wenn der Beitrag später aus der Sicht des
-- Mitglieds verschwindet — genau wie bisher, und weiterhin ohne ein Leserecht
-- zu begründen: der Reiter joint über `posts` und lässt dort die RLS
-- entscheiden. Der Rest-Kanal „mein gespeicherter Beitrag ist aus der Liste
-- verschwunden" bleibt damit bestehen. Er setzt aber voraus, dass das Mitglied
-- den Beitrag EINMAL sehen durfte, und ist deshalb ein anderer, viel engerer
-- Fall als der behobene.
--
-- ══ AUFWEICHEN, NICHT ENTFERNEN ════════════════════════════════════════════
-- Die Gegenprobe in `post_saves_test.sql` weicht diese Policy auf, statt sie zu
-- löschen. Eine gelöschte Policy ist keine gültige Gegenprobe: Default-Deny
-- hielte die Zusagen grün, und der Test bewiese nur, dass er läuft.
--
-- Forward-only.

drop policy post_saves_insert_own on public.post_saves;

create policy post_saves_insert_own on public.post_saves
  for insert to authenticated
  with check (
    public.is_activated()
    and profile_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_id)
  );

comment on table public.post_saves is
  'Private Merkliste je Mitglied. Wer etwas gespeichert hat, ist fuer niemanden '
  'sonst sichtbar — auch nicht fuer den Autor des Beitrags und auch nicht als '
  'Zahl. Eine Zeile begruendet KEIN Leserecht am Beitrag; der Reiter joint ueber '
  'posts und laesst dort die RLS entscheiden. Gespeichert werden kann nur, was '
  'der Aufrufer im Moment des Speicherns auch SEHEN darf (AGE-582, 7.8): sonst '
  'unterschiede der Fremdschluessel-Fehler einen unsichtbaren Beitrag von einem '
  'nicht vorhandenen und waere ein Existenz-Orakel.';
