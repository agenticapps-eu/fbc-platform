-- Lesestand je Mitglied und Thread, plus der Ungelesen-Zähler (AGE-583).
-- Donald, 2026-08-26. Change: openspec/changes/nachrichten-ungelesen-zaehler/.
--
-- ══ WARUM ═══════════════════════════════════════════════════════════════════
-- Nachrichten sind seit Juni gebaut, aber es gibt keinen Weg zu ihnen: `/chat`
-- steht ohne Menüeintrag, und ein Zähler „3 neue Nachrichten" ist nicht
-- berechenbar — `messages` trägt kein `read_at`, `message_threads` keinen
-- Lesestand. Diese Migration legt beides an, was dafür fehlt.
--
-- ══ WARUM EINE EIGENE TABELLE UND NICHT ZWEI SPALTEN AUF message_threads ════
-- Der Linear-Vorgang schlägt `a_last_read_at` / `b_last_read_at` DIREKT auf
-- `message_threads` vor. Dieser Vorschlag ist verworfen, und der Grund ist
-- derselbe Vorgang: er verbietet Lesebestätigungen ausdrücklich, mit sozialer
-- Begründung — „wer sieht, dass gelesen und nicht geantwortet wurde, fühlt
-- sich übergangen. In einem Club, in dem man sich auf Events wiedertrifft,
-- ist das keine Kleinigkeit."
--
-- `threads_select` gibt jedem Teilnehmer die GANZE Zeile. Zwei Spalten dort
-- heissen deshalb: A liest per gewöhnlicher PostgREST-Abfrage, wann B das
-- Gespräch zuletzt geöffnet hat. Das IST eine Lesebestätigung, mit Uhrzeit —
-- der Vorschlag liefert genau das, was der Vorgang zwei Absätze weiter oben
-- verbietet. Gefunden hat das die Plan-Review (opencode, HIGH), nicht ich.
--
-- Und ein SPALTEN-Grant repariert es nicht. Er kann sagen „nur diese zwei
-- Spalten sind schreibbar", aber nicht „A sieht a_last_read_at und nicht
-- b_last_read_at": welche der beiden meine ist, hängt davon ab, auf welcher
-- Seite des Paares ich stehe. Die Einschränkung ist ZEILENabhängig, ein
-- Spalten-Grant ist es nicht.
--
-- Als eigene Tabelle ist „mein Lesestand" eine ZEILE — und Zeilen sind genau
-- das, was RLS ausdrücken kann. Die Zusage wird damit strukturell erfüllt
-- statt erklärt: der Wert des Gegenübers ist nicht „wird nicht angezeigt",
-- sondern nicht lesbar.
--
-- ══ WARUM DAMIT KEINE SECURITY-DEFINER-FUNKTION MEHR NÖTIG IST ═════════════
-- Der erste Entwurf brauchte `mark_thread_read()` als DEFINER-Funktion, weil
-- `message_threads` kein UPDATE-Recht trägt und eine Policy „nur mein Ende"
-- nicht formulieren kann. Auf einer eigenen Tabelle schreibt das Mitglied
-- schlicht seine eigene Zeile, und die Policy sagt das in einer Zeile.
--
-- Das ist kein Schönheitsgewinn. Jede DEFINER-Funktion umgeht die RLS und muss
-- ihr Gate selbst mitbringen; in diesem Projekt ist genau so schon einmal ein
-- fehlendes Gate durch eine Inventur gerutscht. Eine weniger davon ist eine
-- Stelle weniger, an der das passieren kann.
--
-- `message_threads` und `messages` werden hier NICHT angefasst — keine Spalte,
-- kein Grant, keine Policy.
--
-- ══ WARUM DER ZÄHLER security invoker IST ═══════════════════════════════════
-- Der symmetrische Reflex wäre, auch das Lesen als DEFINER zu bauen. Das wäre
-- falsch: `threads_select` und `messages_select` verlangen beide bereits
-- `is_activated()` und Teilnahme, die neue Policy verlangt Eigentümerschaft.
-- Eine INVOKER-Funktion erbt alle drei. Ein nicht aktiviertes Konto bekommt
-- null Zeilen, OHNE dass diese Funktion das Wort „aktiviert" enthält — eine
-- Regel weniger, die an zwei Stellen auseinanderlaufen kann.
--
-- ══ WARUM clock_timestamp() UND NICHT now() ════════════════════════════════
-- Aus der Plan-Review (opencode, LOW). `now()` ist der Transaktionsbeginn.
-- Eine Nachricht, die währenddessen festgeschrieben wird, wäre bei
-- `created_at > last_read_at` für immer gelesen, ohne je gesehen worden zu
-- sein. `clock_timestamp()` rückt innerhalb der Transaktion vor.
--
-- ══ WARUM KEIN delete ══════════════════════════════════════════════════════
-- „Wieder auf ungelesen setzen" ist keine Anforderung dieses Changes. Ein
-- Recht ohne Anforderung ist totes Gewicht, und in diesem Projekt sind Rechte
-- schon einmal still geerbt statt ausgesprochen worden (AGE-312).
--
-- ══ WARUM HIER KEIN INDEX STEHT, OBWOHL ZWEI REVIEWER IHN FORDERTEN ════════
-- Beide Plan-Reviewer verlangten unabhängig einen zusammengesetzten Index
-- `messages (thread_id, created_at)`. Die Begründung klang zwingend: die
-- Zählabfrage filtert auf `created_at`, `messages_thread_id_idx` liegt nur auf
-- `(thread_id)`, also müsse je Thread alles durchgegangen werden.
--
-- Gemessen am 26.08. gegen 20 000 Nachrichten: der Index wird NIE benutzt —
-- weder mit noch ohne ihn ändert sich der Plan (Seq Scan, 1,1 ms gegen 1,4 ms,
-- also Rauschen). Der Grund steht in der Abfrage selbst: verglichen wird gegen
-- `p.last_read_at`, einen Wert aus der VERBUNDENEN Tabelle, und zusätzlich
-- steht ein `or p.last_read_at is null` daneben. Eine Disjunktion über eine
-- Join-Spalte ist keine Index-Bedingung. Die Reviewer haben über eine Form
-- geurteilt (`created_at > konstante`), die diese Abfrage nicht hat.
--
-- Ein Index, den der Planer nie wählt, ist nicht neutral: er kostet bei JEDEM
-- Nachrichten-Insert. Er steht deshalb nicht hier.
--
-- ══ WAS STATTDESSEN GEHOLFEN HAT: lateral ══════════════════════════════════
-- Der echte Kostenträger war ein anderer, und den hat erst der EXPLAIN gezeigt.
-- In der naheliegenden Fassung (`from messages … left join read_positions …
-- group by thread_id`) läuft die RLS-Prüfung von `messages_select` — ein
-- korreliertes EXISTS auf `message_threads` — EINMAL JE NACHRICHT. Bei 20 000
-- Nachrichten sind das 20 000 Durchläufe und 60 000 Puffer.
--
-- Treibt man stattdessen von `message_threads` aus und zählt je Thread in einer
-- lateralen Unterabfrage, greifen erst die billigen Bedingungen (`thread_id`,
-- `sender_id`, `created_at`) und die teure RLS-Prüfung läuft nur noch für die
-- Zeilen, die übrig bleiben.
--
--   vorher   213 ms   120 252 Puffer
--   nachher    1,2 ms      350 Puffer
--
-- Gleiches Ergebnis, gegengeprüft. Das ist der Grund für die ungewöhnliche
-- Form der Abfrage unten — sie ist nicht so geschrieben, weil es hübscher ist.

-- ── 1. Der Lesestand ────────────────────────────────────────────────────────
create table public.thread_read_positions (
  thread_id    uuid        not null references public.message_threads (id) on delete cascade,
  profile_id   uuid        not null references public.profiles (id)        on delete cascade,
  last_read_at timestamptz not null default clock_timestamp(),
  primary key (thread_id, profile_id)
);

comment on table public.thread_read_positions is
  'Wann hat profile_id den Thread zuletzt geöffnet? (AGE-583) Eigentümerprivat: '
  'die Zeile des Gegenübers ist NICHT lesbar, deshalb liegt der Wert hier und '
  'nicht als Spalte auf message_threads — dort gibt threads_select jedem '
  'Teilnehmer die ganze Zeile, und der Lesestand wäre eine Lesebestätigung.';

alter table public.thread_read_positions enable row level security;

-- `for all`, weil select/insert/update dieselbe Bedingung tragen: es ist meine
-- Zeile. Das `with check` verlangt zusätzlich die Teilnahme am Thread — ohne
-- das könnte ein aktiviertes Mitglied Zeilen auf beliebigen Thread-IDs anlegen
-- und daraus ableiten, welche existieren (ein Fremdschlüssel ist ein
-- Existenz-Orakel: erfunden bricht mit 23503, vorhanden geht durch).
create policy trp_own on public.thread_read_positions
  for all to authenticated
  using (
    public.is_activated()
    and profile_id = (select auth.uid())
  )
  with check (
    public.is_activated()
    and profile_id = (select auth.uid())
    and exists (
      select 1 from public.message_threads t
      where t.id = thread_read_positions.thread_id
        and ( t.a_profile_id = (select auth.uid()) or t.b_profile_id = (select auth.uid()) )
    )
  );

-- Ausgesprochen, nicht geerbt (AGE-312). Kein DELETE — siehe Kopf.
grant select, insert, update on public.thread_read_positions to authenticated;

-- ── 1b. Der Zeitpunkt gehoert dem Server, nicht dem Client ──────────────────
-- Aus der Diff-Review (gemini, HIGH), und der Befund war ein WIDERSPRUCH
-- zwischen Kommentar und Code: `markThreadRead` schickte `new Date()` mit,
-- waehrend direkt darueber stand, dass genau das nicht passiert.
--
-- Warum das mehr ist als Kosmetik: verglichen wird `messages.created_at`
-- (Serveruhr) gegen `last_read_at`. Kaeme Letzteres vom Client, verglichen wir
-- ZWEI UHREN. Geht die des Mitglieds vor, sind Nachrichten schon gelesen, bevor
-- sie geschrieben wurden — sie tauchen im Zaehler nie auf, und niemand merkt es.
-- Und ein Mitglied koennte seinen Lesestand willkuerlich vor- oder
-- zurueckdatieren, weil die Zeile ihm gehoert.
--
-- Warum ein Trigger und nicht „die Spalte einfach weglassen": PostgREST baut
-- aus einem Upsert ein `on conflict do update set <nur die gesendeten
-- Spalten>`. Ohne `last_read_at` im Rumpf wuerde der Konfliktzweig sie NICHT
-- anruecken — das Markieren waere beim ZWEITEN Mal wirkungslos, und zwar
-- lautlos. Der Trigger loest beides: der Client darf senden, was er will, der
-- Server schreibt seine eigene Uhr.
create or replace function public.thread_read_positions_serveruhr()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.last_read_at := clock_timestamp();
  return new;
end;
$$;

comment on function public.thread_read_positions_serveruhr() is
  'Erzwingt die Serveruhr auf thread_read_positions.last_read_at (AGE-583). '
  'Der Vergleich im Zaehler laeuft gegen messages.created_at — ein vom Client '
  'gesetzter Wert waere eine zweite Uhr, und eine vorgehende liesse Nachrichten '
  'als gelesen gelten, bevor es sie gibt.';

-- Eine Trigger-Funktion braucht von NIEMANDEM ein Ausfuehrungsrecht — sie wird
-- vom Trigger gerufen, nicht von einer Rolle. Ohne diese Zeile behaelt sie
-- trotzdem das geerbte EXECUTE fuer `public`, denn `alter default privileges …
-- revoke` wirkt bei FUNKTIONEN nicht (bei Tabellen schon). Gefangen hat das
-- der Golden-Snapshot in grants_test.sql — Test 7 zaehlt, welche Funktionen
-- `anon` ausfuehren darf, und meldete sieben statt sechs.
revoke execute on function public.thread_read_positions_serveruhr() from public, anon, authenticated;

create trigger thread_read_positions_serveruhr
  before insert or update on public.thread_read_positions
  for each row execute function public.thread_read_positions_serveruhr();

-- ── 2. Der Zähler ───────────────────────────────────────────────────────────
-- Threads OHNE Ungelesenes kommen gar nicht zurück (`c.unread_count > 0`). Aus
-- der Plan-Review, MEDIUM: sonst wären „keine Zeile" und „Zahl 0" zwei Wege,
-- dasselbe zu sagen, und die Oberfläche müsste beide kennen.
--
-- `bigint`, weil count(*) das liefert. Ein integer wäre ein Cast, der nur so
-- lange gutgeht, wie ihn niemand prüft (Plan-Review, LOW).
--
-- Die Teilnahme wird hier NICHT noch einmal geprüft. `message_threads` liefert
-- unter `threads_select` ohnehin nur eigene Threads, und `messages_select`
-- prüft es für die Nachrichten — diese Funktion ist INVOKER und erbt beides.
-- Ein verdoppeltes Prädikat ist in diesem Projekt schon einmal
-- auseinandergelaufen.
create or replace function public.unread_message_counts()
  returns table (thread_id uuid, unread_count bigint)
  language sql
  stable
  security invoker
  set search_path = ''
as $$
  select t.id as thread_id, c.unread_count
    from public.message_threads t
    left join public.thread_read_positions p
      on p.thread_id = t.id
     and p.profile_id = (select auth.uid())
   cross join lateral (
      select count(*) as unread_count
        from public.messages m
       where m.thread_id = t.id
         and m.sender_id <> (select auth.uid())
         and (p.last_read_at is null or m.created_at > p.last_read_at)
   ) c
   where c.unread_count > 0;
$$;

comment on function public.unread_message_counts() is
  'Ungelesene Nachrichten je Thread für den Aufrufer (AGE-583). SECURITY '
  'INVOKER mit Absicht: threads_select/messages_select verlangen bereits '
  'is_activated() und Teilnahme, trp_own verlangt Eigentümerschaft — die '
  'Funktion erbt alle drei, statt sie ein zweites Mal auszusprechen. Ein nicht '
  'aktiviertes Konto bekommt deshalb null Zeilen. Threads ohne Ungelesenes '
  'werden NICHT zurückgegeben.';

-- `revoke` in Default Privileges ist bei FUNKTIONEN ein No-op (anders als bei
-- Tabellen) — der Entzug muss hier namentlich stehen.
revoke execute on function public.unread_message_counts() from public, anon;
grant  execute on function public.unread_message_counts() to authenticated;
