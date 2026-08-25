-- Gespeicherte Beiträge: `post_saves` als private Liste (AGE-582).
-- Donald, 2026-08-24. Change: openspec/changes/activity-concept-level/.
--
-- ══ WAS SIE HÄLT ═══════════════════════════════════════════════════════════
-- Ein Mitglied merkt sich einen Beitrag für später. Der Reiter „Gespeichert"
-- im Feed liest daraus. Das ist alles — die Zeile hält FEST, dass gespeichert
-- wurde, und begründet KEIN Recht: der Reiter joint über `posts`, und dort
-- entscheidet weiterhin die RLS, ob der Beitrag noch sichtbar ist. Ein
-- gespeicherter Beitrag, der später nicht-öffentlich wird, verschwindet
-- deshalb still aus der Liste, ohne dass die Zeile fällt.
--
-- ══ WARUM (profile_id, post_id) UND NICHT UMGEKEHRT ════════════════════════
-- `post_likes` trägt den Schlüssel andersherum, weil dort die Frage „wie viele
-- Likes hat dieser Beitrag" die häufige ist. Hier ist die häufige Frage die
-- umgekehrte: „was habe ICH gespeichert" — und die zweite, gebündelte, lautet
-- „von diesen zwanzig IDs, welche habe ich gespeichert". Beide beginnen mit
-- dem Profil, also führt der Schlüssel damit an.
--
-- Der Schlüssel trägt zugleich die Eindeutigkeit. Zweimal speichern erzeugt
-- keine zweite Zeile, und das ist eine Eigenschaft der Tabelle, keine Bitte an
-- den Aufrufer. Die Datenschicht ruft `on conflict do nothing` und bekommt
-- dafür an der Oberfläche keinen Fehler zu sehen.
--
-- ══ WARUM DREI POLICIES UND KEIN `for all` ═════════════════════════════════
-- `likes_write_own` ist EINE `for all`-Policy, und die naheliegende Lösung
-- wäre gewesen, sie abzuschreiben. VERWORFEN: `for all` schliesst UPDATE ein.
-- An dieser Tabelle gibt es nichts zu ändern — wer eine Speicherung lösen
-- will, löscht die Zeile —, und ein UPDATE-Weg wäre nur eine Fläche ohne
-- Aufgabe.
--
-- Der Einwand „das Grant unten sagt ohnehin kein UPDATE" trägt hier NICHT.
-- Genau dieses Projekt hat schon einmal Rechte getragen, die niemand
-- ausgesprochen hatte: bis AGE-312 kam der Ist-Zustand aus Supabases
-- `alter default privileges`, einer Voreinstellung, die uns nicht gehört. Wenn
-- die UPDATE-Policy fehlt, bleibt die Tabelle auch dann unveränderlich, wenn
-- ein Grant auf diesem Weg zurückkehrt. Zwei Schranken, nicht eine.
--
-- ══ WARUM `is_activated()` IN ALLEN DREI ═══════════════════════════════════
-- Jede andere Feed-Interaktion ist serverseitig so gegatet — `posts_write_own`,
-- `likes_write_own` und `post_media_insert_own` tragen es alle. Ohne das
-- Prädikat dürfte ein nie bestätigtes oder ein deaktiviertes Konto weiter
-- speichern, lesen und löschen, während ihm alles andere verwehrt ist.
--
-- Der Name der Funktion ist unvollständig, und das ist hier wichtig: seit
-- AGE-581 prüft `is_activated()` die GESAMTE Zugangsbedingung — bestätigt UND
-- nicht deaktiviert UND nicht gelöscht. Beide Wege sind in
-- `post_saves_test.sql` gemessen, denn eine Prüfung, die nur `activated_at`
-- läse, bliebe für ein deaktiviertes Konto grün.
--
-- ══ WARUM KEINE SICHTBARKEITSPRÜFUNG AUF DEM BEITRAG ═══════════════════════
-- `likes_write_own` trägt zusätzlich ein `exists (select 1 from posts …)`, und
-- weil dieser Ausdruck unter der RLS des Aufrufers läuft, heisst er in Wahrheit
-- „nur was du sehen darfst". VERWORFEN für diese Tabelle: der Fremdschlüssel
-- sichert schon, dass der Beitrag existiert, und die Speicherung begründet
-- ohnehin kein Recht — der Reiter joint über `posts` und lässt dort dieselbe
-- RLS greifen. Wer eine fremde Beitrags-ID erriete, legte sich damit eine
-- Zeile an, die ihm nie etwas zeigt. Der Preis wäre eine zusätzliche
-- RLS-Auswertung bei jedem Speichern, der Gewinn null.
--
-- ══ WARUM DIE GRANTS HIER STEHEN ═══════════════════════════════════════════
-- Neue Tabellen erben in diesem Projekt nichts (AGE-312 hat die geerbten
-- Rechte entzogen). Was nicht ausgesprochen ist, gibt es nicht — eine Policy
-- ohne Grant ist tot. `anon` bekommt nichts: eine private Merkliste hat für
-- einen ausgeloggten Besucher keine Frage zu beantworten.
--
-- ══ WARUM EIN INDEX AUF post_id ════════════════════════════════════════════
-- Nicht fürs Lesen — dafür führt der Primärschlüssel. Sondern fürs Löschen:
-- fällt ein Beitrag, muss das kaskadierende DELETE seine Speicherungen finden,
-- und der Schlüssel beginnt mit der falschen Spalte.
--
-- Forward-only.

create table public.post_saves (
  profile_id uuid        not null references public.profiles (id) on delete cascade,
  post_id    uuid        not null references public.posts (id)    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);

alter table public.post_saves enable row level security;

create index post_saves_post_id_idx on public.post_saves (post_id);

comment on table public.post_saves is
  'Private Merkliste je Mitglied. Wer etwas gespeichert hat, ist fuer niemanden '
  'sonst sichtbar — auch nicht fuer den Autor des Beitrags und auch nicht als '
  'Zahl. Eine Zeile begruendet KEIN Leserecht am Beitrag; der Reiter joint ueber '
  'posts und laesst dort die RLS entscheiden.';

-- Drei Policies statt einer `for all` — die Begruendung steht im Kopf.
create policy post_saves_select_own on public.post_saves
  for select to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) );

create policy post_saves_insert_own on public.post_saves
  for insert to authenticated
  with check ( public.is_activated() and profile_id = (select auth.uid()) );

create policy post_saves_delete_own on public.post_saves
  for delete to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) );

grant select, insert, delete on public.post_saves to authenticated;
