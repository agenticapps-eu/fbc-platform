# Aufgaben — geplante Beiträge (AGE-667)

Reihenfolge ist nicht beliebig: **A vor B** (ohne Spalte kein Tor), **B vor C**
(ohne Tore keine Oberfläche, die man gefahrlos zeigen kann).

## A · Die Spalte

- [ ] **A1** Migration anlegen: `veroeffentlicht_ab timestamptz not null
      default now()` auf `public.posts`.
- [ ] **A2** Bestandszeilen auf **ihren eigenen** `created_at` setzen, nicht auf
      `now()` — sonst trägt der ganze Bestand denselben Moment und sortiert
      sich um. In derselben Migration, vor dem `not null`.
- [ ] **A3** Index prüfen, **nicht annehmen**: der Feed sortiert künftig nach
      `veroeffentlicht_ab`. Gegen einen gesäten Bestand messen, ob der Planer
      einen Index wählt — und ihn **nur dann** anlegen. Vorbild ist die Messung
      in `20260826170000_…:69-83`, wo ein geforderter Index nie gewählt wurde.
- [ ] **A4** Spalte ins Spalten-UPDATE-Recht von `authenticated` aufnehmen.
- [ ] **A5** `supabase/tests/grants_test.sql`: Golden-String **und** die
      Spalten-Grant-Zusage mitziehen. Ohne das bricht der CI-Job `migrations`
      an einer Zeile, die die Spalte nicht kennt.

## B · Die sechs Tore

Jedes einzeln, jedes mit eigener Zusage. Das Prädikat lautet überall
`(veroeffentlicht_ab <= now() or author_id = (select auth.uid()))` — **ausser**
für `anon`, wo die zweite Hälfte entfällt.

- [ ] **B1** `posts_select_by_visibility` (authenticated).
- [ ] **B2** `posts_select_public_anon` (anon) — nur die erste Hälfte.
- [ ] **B3** `post_media_lesbar(objektname)`. **Der gefährlichste Posten:** ohne
      ihn ist der Beitrag unsichtbar und sein Bild signierbar.
- [ ] **B4** `post_engagement_counts(uuid[])`.
- [ ] **B5** `former_member_entries(…)`.
- [ ] **B6** `comments` und `post_likes`: **belegen**, dass sie erben, statt es
      anzunehmen. `comments_select_visible` prüft über eine Unterabfrage auf
      `posts`; läuft die unter deren RLS, wirkt die Korrektur von selbst. Wenn
      nicht — eigene Zusage und eigene Korrektur.
- [ ] **B7** `event_feed_post_sync()` **nicht** anfassen und im Migrationskopf
      festhalten, warum: sie schreibt, sie entscheidet nicht.
- [ ] **B8** `post_saves` in die Erbschaftszusage von B6 aufnehmen (INSERT
      prüft die Existenz, SELECT/DELETE nur die eigene Zeile).

## B′ · Das SIEBENTE Tor — das schreibende (HOCH aus der Plan-Review)

Der Entwurf zählte nur die **lesenden** Tore. `trg_hinweis_neuer_beitrag`
feuert `after insert on public.posts` und kündigt **jedem aktivierten Mitglied**
an — Glocke **und** Push, mit `autor_name` im Payload. Ohne diesen Abschnitt
erreichte ein geplanter Beitrag im Moment des *Planens* alle Telefone.

- [ ] **B′1** `hinweis_neuer_beitrag()`: zweites frühes `return null` für
      `new.veroeffentlicht_ab > now()`. Die Stelle ist vorgezeichnet — die
      Funktion trägt schon eines für `kind <> 'member'`.
- [ ] **B′2** Spalte `angekuendigt_am timestamptz` (nullbar). Sie verhindert die
      doppelte Ankündigung; eine Suche in `notifications` wäre ein Scan über den
      Fan-out.
- [ ] **B′3** Der Trigger setzt `angekuendigt_am` für sofort veröffentlichte
      Beiträge mit.
- [ ] **B′4** **Lauf, der nachträglich ankündigt** — Donalds Entscheidung vom
      29.08.: ein geplanter Beitrag kündigt beim Live-Gehen an. Nimmt Zeilen mit
      `veroeffentlicht_ab <= now() and angekuendigt_am is null`, ruft
      `hinweis_rundruf`, setzt `angekuendigt_am`.
- [ ] **B′5** **Erst messen, dann entscheiden**, ob der Lauf als Migration
      entstehen kann: `pg_cron` fehlt im lokalen Stack und in der frischen
      CI-Abbildung, eine Migration mit `cron.schedule` bräche den Job
      `migrations`. Zwei Wege — von Hand auf beiden Seiten (wie der
      Wiederholungslauf, Vorlage in `docs/secrets.md`) oder in der Migration
      hinter `if exists (select 1 from pg_extension where extname='pg_cron')`.
      Der zweite ist für dieses Repo neu.
- [ ] **B′6** Zusage: ein geplanter Beitrag erzeugt beim Anlegen **keine**
      Hinweiszeile und **keinen** Push — und nach dem Zeitpunkt **genau eine**
      Ankündigung, nicht bei jedem Lauf eine neue.

## C · Der Schreibweg

- [ ] **C1** `create_post_with_media`: alte Sechs-Parameter-Signatur
      **löschen**, neue mit `p_veroeffentlicht_ab timestamptz` anlegen. Kein
      Vorgabewert — der brächte die Überladung zurück. `revoke`/`grant`
      ausgesprochen, nicht geerbt.
- [ ] **C2** Ein Zeitpunkt in der Vergangenheit wird in der Funktion auf
      `now()` gehoben.
- [ ] **C3** Feed-Abfrage: `order by` **und** Seitengrenzen-Cursor auf
      `veroeffentlicht_ab` umstellen. Beide, oder keines — ein Cursor auf einer
      anderen Spalte als der Ordnung überspringt Zeilen oder liefert sie
      doppelt (dieselbe Klasse wie AGE-655).
- [ ] **C4** `src/lib/database.types.ts` **von Hand** nachziehen. `supabase gen
      types` NICHT darüberlaufen lassen.
- [ ] **C5** **Alle bestehenden Aufrufer der alten Signatur umstellen** (HOCH
      aus der Plan-Review — die Flächen-Tabelle nannte sie nicht):
      `supabase/tests/rls_test.sql` (vier Aufrufe **und** die
      `has_function_privilege`-Zusage, die die alte Signatur wörtlich nennt),
      `supabase/tests/feed_popularity_test.sql`, `src/lib/feed.write.test.ts`,
      `src/components/community/CommunityFeed.composer.test.tsx`,
      `scripts/probe-rpc-create-post.ts`, `scripts/probe-9-3-sichtbarkeit.ts`.
      Ohne das wird der CI-Job `migrations` rot, und keine andere Aufgabe deckt
      es ab.
- [ ] **C6** **Die drei bestehenden Indizes entscheiden**, nicht übersehen:
      `posts_created_at_id_idx` („trägt den Keyset-Cursor des Feeds"),
      `posts_like_count_created_at_id_idx`, `posts_video_url_idx`. Wandert die
      Ordnung auf `veroeffentlicht_ab`, sind sie Schreiblast ohne Lesenutzen —
      oder die Ordnungen widersprechen einander. Gegen einen gesäten Bestand
      messen und ersetzen oder entfernen. Derselbe Grundsatz wie A3.
- [ ] **C7** Der Feed hat **drei** Ordnungen; „Beliebteste" bricht den
      Gleichstand über `created_at`. Entscheiden und festschreiben, ob dieser
      Stichentscheid mitwandert.

## D · Die Oberfläche

- [ ] **D1** Composer: Datum **und** Uhrzeit, vorbelegt „sofort".
- [ ] **D2** Markierung „geplant für …" an der eigenen Karte.
- [ ] **D3** Planung ändern und aufheben.
- [ ] **D4** Browser-Sichtprobe an einer laufenden lokalen Fassung, **vor** dem
      Commit — grüne Tests haben hier schon zweimal ein visuell falsches
      Ergebnis durchgewunken.
- [ ] **D5** **Zwei weitere Flächen zeigen dem Verfasser seine eigenen
      Beiträge** und sortieren nach `created_at`: das Regal „selbst geteilt" auf
      dem öffentlichen Profil (`src/lib/public-profile.ts`) und die eigenen
      Beiträge im Dashboard (`src/lib/dashboard.ts`). Dort erscheint ein
      geplanter Beitrag **unmarkiert**. Entweder Markierung und Sortierung
      mitziehen — oder im Entwurf begründen, warum beide bewusst am
      Schreibdatum bleiben. Nicht stillschweigend liegenlassen.

## E · Belege

- [ ] **E1** Neue pgTAP-Datei mit **vier getrennten** Zusagen: ein geplanter
      Beitrag existiert für Fremde nicht — nicht als Zeile, **nicht als Bild,
      nicht als Zahl, nicht über seine Kommentare**.
- [ ] **E2** **Positivkontrolle:** dieselben vier Zusagen ohne die Änderung
      messen und **rot** sehen. Eine Verneinung ohne Positivkontrolle belegt
      nichts — sie wäre auch grün, wenn die Abfrage gar nichts träfe.
- [ ] **E3** Zusage: der Bestand bleibt sichtbar und behält seine Ordnung.
- [ ] **E4** Die neue pgTAP-Datei in die Dateiliste in `.github/workflows/ci.yml`
      eintragen. **Sonst läuft sie nie** — genau der Fall aus AGE-659; seitdem
      macht `scripts/pgtap-dateiliste.test.ts` ihn rot.
- [ ] **E5** `supabase test db` mit **genannter** Dateiliste laufen lassen, nicht
      ohne — ohne Liste meldet der Befehl FAIL, obwohl grün.

## F · Abschluss

- [ ] **F1** Diff-Review durch zwei fremde Anbieter. Fällig, weil der Change
      Schema **und** RLS anfasst — genau der Fall, für den die Fremdreviewer am
      26.08. behalten wurden.
- [ ] **F2** `openspec validate --all` grün.
- [ ] **F3** Nach dem Merge: `migrate-prod` ist ein **eigener** Schritt und
      braucht Donalds Freigabe. Ohne ihn blockt `drift-gate` den Deploy.
