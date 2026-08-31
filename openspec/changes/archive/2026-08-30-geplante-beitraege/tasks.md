# Aufgaben — geplante Beiträge (AGE-667)

Reihenfolge ist nicht beliebig: **A vor B** (ohne Spalte kein Tor), **B vor C**
(ohne Tore keine Oberfläche, die man gefahrlos zeigen kann).

## A · Die Spalte

- [x] **A1** Migration anlegen: `veroeffentlicht_ab timestamptz not null
      default now()` auf `public.posts`.
- [x] **A2** Bestandszeilen auf **ihren eigenen** `created_at` setzen, nicht auf
      `now()` — sonst trägt der ganze Bestand denselben Moment und sortiert
      sich um. In derselben Migration, vor dem `not null`.
- [x] **A3** Index prüfen, **nicht annehmen**: der Feed sortiert künftig nach
      `veroeffentlicht_ab`. Gegen einen gesäten Bestand messen, ob der Planer
      einen Index wählt — und ihn **nur dann** anlegen. Vorbild ist die Messung
      in `20260826170000_…:69-83`, wo ein geforderter Index nie gewählt wurde.
- [x] **A4** Spalte ins Spalten-UPDATE-Recht von `authenticated` aufnehmen.
- [x] **A5** `supabase/tests/grants_test.sql`: Golden-String **und** die
      Spalten-Grant-Zusage mitziehen. Ohne das bricht der CI-Job `migrations`
      an einer Zeile, die die Spalte nicht kennt.

## B · Die sechs Tore

Jedes einzeln, jedes mit eigener Zusage. Das Prädikat lautet überall
`(veroeffentlicht_ab <= now() or author_id = (select auth.uid()))` — **ausser**
für `anon`, wo die zweite Hälfte entfällt.

- [x] **B1** `posts_select_by_visibility` (authenticated).
- [x] **B2** `posts_select_public_anon` (anon) — nur die erste Hälfte.
- [x] **B3** `post_media_lesbar(objektname)`. **Der gefährlichste Posten:** ohne
      ihn ist der Beitrag unsichtbar und sein Bild signierbar.
- [x] **B4** `post_engagement_counts(uuid[])`.
- [x] **B5** `former_member_entries(…)`.
- [x] **B6** `comments` und `post_likes`: **belegen**, dass sie erben, statt es
      anzunehmen. `comments_select_visible` prüft über eine Unterabfrage auf
      `posts`; läuft die unter deren RLS, wirkt die Korrektur von selbst. Wenn
      nicht — eigene Zusage und eigene Korrektur.
- [x] **B7** `event_feed_post_sync()` **nicht** anfassen und im Migrationskopf
      festhalten, warum: sie schreibt, sie entscheidet nicht.
- [x] **B8** `post_saves` in die Erbschaftszusage von B6 aufnehmen (INSERT
      prüft die Existenz, SELECT/DELETE nur die eigene Zeile).

## B′ · Das SIEBENTE Tor — das schreibende (HOCH aus der Plan-Review)

Der Entwurf zählte nur die **lesenden** Tore. `trg_hinweis_neuer_beitrag`
feuert `after insert on public.posts` und kündigt **jedem aktivierten Mitglied**
an — Glocke **und** Push, mit `autor_name` im Payload. Ohne diesen Abschnitt
erreichte ein geplanter Beitrag im Moment des *Planens* alle Telefone.

- [x] **B′1** `hinweis_neuer_beitrag()`: zweites frühes `return null` für
      `new.veroeffentlicht_ab > now()`. Die Stelle ist vorgezeichnet — die
      Funktion trägt schon eines für `kind <> 'member'`.
- [x] **B′2** Spalte `angekuendigt_am timestamptz` (nullbar). Sie verhindert die
      doppelte Ankündigung; eine Suche in `notifications` wäre ein Scan über den
      Fan-out.
- [x] **B′3** Der Trigger setzt `angekuendigt_am` für sofort veröffentlichte
      Beiträge mit.
- [x] **B′4** **Lauf, der nachträglich ankündigt** — Donalds Entscheidung vom
      29.08.: ein geplanter Beitrag kündigt beim Live-Gehen an. Nimmt Zeilen mit
      `veroeffentlicht_ab <= now() and angekuendigt_am is null`, ruft
      `hinweis_rundruf`, setzt `angekuendigt_am`.
- [x] **B′5** **Erst messen, dann entscheiden**, ob der Lauf als Migration
      entstehen kann: `pg_cron` fehlt im lokalen Stack und in der frischen
      CI-Abbildung, eine Migration mit `cron.schedule` bräche den Job
      `migrations`. Zwei Wege — von Hand auf beiden Seiten (wie der
      Wiederholungslauf, Vorlage in `docs/secrets.md`) oder in der Migration
      hinter `if exists (select 1 from pg_extension where extname='pg_cron')`.
      Der zweite ist für dieses Repo neu.
- [x] **B′6** Zusage: ein geplanter Beitrag erzeugt beim Anlegen **keine**
      Hinweiszeile und **keinen** Push — und nach dem Zeitpunkt **genau eine**
      Ankündigung, nicht bei jedem Lauf eine neue.

## C · Der Schreibweg

- [x] **C1** `create_post_with_media`: alte Sechs-Parameter-Signatur
      **löschen**, neue mit `p_veroeffentlicht_ab timestamptz` anlegen. Kein
      Vorgabewert — der brächte die Überladung zurück. `revoke`/`grant`
      ausgesprochen, nicht geerbt.
- [x] **C2** Ein Zeitpunkt in der Vergangenheit wird in der Funktion auf
      `now()` gehoben.
- [x] **C3** Feed-Abfrage: `order by` **und** Seitengrenzen-Cursor auf
      `veroeffentlicht_ab` umstellen. Beide, oder keines — ein Cursor auf einer
      anderen Spalte als der Ordnung überspringt Zeilen oder liefert sie
      doppelt (dieselbe Klasse wie AGE-655).
- [x] **C4** `src/lib/database.types.ts` **von Hand** nachziehen. `supabase gen
      types` NICHT darüberlaufen lassen.
- [x] **C5** **Alle bestehenden Aufrufer der alten Signatur umstellen** (HOCH
      aus der Plan-Review — die Flächen-Tabelle nannte sie nicht):
      `supabase/tests/rls_test.sql` (vier Aufrufe **und** die
      `has_function_privilege`-Zusage, die die alte Signatur wörtlich nennt),
      `supabase/tests/feed_popularity_test.sql`, `src/lib/feed.write.test.ts`,
      `src/components/community/CommunityFeed.composer.test.tsx`,
      `scripts/probe-rpc-create-post.ts`, `scripts/probe-9-3-sichtbarkeit.ts`.
      Ohne das wird der CI-Job `migrations` rot, und keine andere Aufgabe deckt
      es ab.
- [x] **C6** **Die drei bestehenden Indizes entscheiden**, nicht übersehen:
      `posts_created_at_id_idx` („trägt den Keyset-Cursor des Feeds"),
      `posts_like_count_created_at_id_idx`, `posts_video_url_idx`. Wandert die
      Ordnung auf `veroeffentlicht_ab`, sind sie Schreiblast ohne Lesenutzen —
      oder die Ordnungen widersprechen einander. Gegen einen gesäten Bestand
      messen und ersetzen oder entfernen. Derselbe Grundsatz wie A3.
- [x] **C7** Der Feed hat **drei** Ordnungen; „Beliebteste" bricht den
      Gleichstand über `created_at`. Entscheiden und festschreiben, ob dieser
      Stichentscheid mitwandert.

## D · Die Oberfläche

- [x] **D1** Composer: Datum **und** Uhrzeit, vorbelegt „sofort".
- [x] **D2** Markierung „geplant für …" an der eigenen Karte.
- [x] **D3** Planung ändern und aufheben.
- [x] **D4** Browser-Sichtprobe an einer laufenden lokalen Fassung, **vor** dem
      Commit — grüne Tests haben hier schon zweimal ein visuell falsches
      Ergebnis durchgewunken.
- [x] **D5** **Zwei weitere Flächen zeigen dem Verfasser seine eigenen
      Beiträge** und sortieren nach `created_at`: das Regal „selbst geteilt" auf
      dem öffentlichen Profil (`src/lib/public-profile.ts`) und die eigenen
      Beiträge im Dashboard (`src/lib/dashboard.ts`). Dort erscheint ein
      geplanter Beitrag **unmarkiert**. Entweder Markierung und Sortierung
      mitziehen — oder im Entwurf begründen, warum beide bewusst am
      Schreibdatum bleiben. Nicht stillschweigend liegenlassen.

## E · Belege

- [x] **E1** Neue pgTAP-Datei mit **vier getrennten** Zusagen: ein geplanter
      Beitrag existiert für Fremde nicht — nicht als Zeile, **nicht als Bild,
      nicht als Zahl, nicht über seine Kommentare**.
- [x] **E2** **Positivkontrolle:** dieselben vier Zusagen ohne die Änderung
      messen und **rot** sehen. Eine Verneinung ohne Positivkontrolle belegt
      nichts — sie wäre auch grün, wenn die Abfrage gar nichts träfe.
- [x] **E3** Zusage: der Bestand bleibt sichtbar und behält seine Ordnung.
- [x] **E4** Die neue pgTAP-Datei in die Dateiliste in `.github/workflows/ci.yml`
      eintragen. **Sonst läuft sie nie** — genau der Fall aus AGE-659; seitdem
      macht `scripts/pgtap-dateiliste.test.ts` ihn rot.
- [x] **E5** `supabase test db` mit **genannter** Dateiliste laufen lassen, nicht
      ohne — ohne Liste meldet der Befehl FAIL, obwohl grün.

## F · Abschluss

- [x] **F1** Diff-Review durch zwei fremde Anbieter. Fällig, weil der Change
      Schema **und** RLS anfasst — genau der Fall, für den die Fremdreviewer am
      26.08. behalten wurden.
- [x] **F2** `openspec validate --all` grün.
- [x] **F3** Nach dem Merge: `migrate-prod` ist ein **eigener** Schritt und
      braucht Donalds Freigabe. Ohne ihn blockt `drift-gate` den Deploy.

## Was beim Bauen dazukam — gemessen, nicht geplant

Die Aufgabenliste stand vor der ersten Codezeile. Sechs Dinge hat erst das
Bauen gefunden; sie stehen hier, weil eine Liste, die nur ihre eigenen Punkte
abhakt, den Eindruck erweckt, es sei nichts anderes passiert.

1. **Ein ZWEITER Golden-Snapshot desselben Spalten-Grants.** `posts.UPDATE=…`
   steht nicht nur in `grants_test.sql` (A5), sondern noch einmal in
   `feed_popularity_test.sql:15`. Weder die Flächen-Tabelle noch die
   Plan-Review nannte ihn; die Suite hat ihn gemeldet.
2. **Eine VIERTE Lesefläche mit eigenem Cursor:** `src/lib/academy.ts`. D5
   nannte `public-profile.ts` und `dashboard.ts`. Academy ordnet nach dem
   ZEITPUNKT DES LIKES, nicht nach dem Beitrag — sie teilte sich mit dem Feed
   bis dahin einen Cursor-Typ, weil beide führenden Felder `created_at`
   hiessen. Sie haben ab jetzt zwei Typen (`AcademyCursor`).
3. **Drei bestehende Wächter haben angeschlagen, alle drei zu Recht** — und
   einer davon ist genau der Sentinel für diese Art Änderung:
   `member_lifecycle_test.sql:51` vergleicht den Wortlaut von
   `posts_select_by_visibility` und fordert damit auf, die abgeschriebene Kopie
   in `former_member_entries` nachzuziehen. Genau das war B5.
4. **Ein VIERTER Index auf `created_at`**, den C6 nicht nannte:
   `posts_visibility_created_at_idx`. Er dient keiner der drei Feed-Ordnungen
   und wurde hier nicht gemessen — als Rest benannt, nicht angefasst.
5. **B′5 ist gemessen und entschieden:** `pg_cron` ist im lokalen Stack NICHT
   installiert. Gewählt ist ein dritter Weg, den die Aufgabe nicht anbot: die
   FUNKTION liegt in der Migration (kein Geheimnis, reines SQL, in pgTAP direkt
   messbar), nur die ZEITPLANUNG von Hand — Vorlage in `docs/secrets.md`.
6. **Der Bestand muss als angekündigt markiert werden.** Stand in keiner
   Aufgabe. Ohne die Zeile wäre die Migration ein Massenversand: jeder
   vorhandene Beitrag trägt einen erreichten Zeitpunkt und `angekuendigt_am is
   null`, der erste Lauf kündigte also den GESAMTEN Bestand an jedes Mitglied
   an, per Glocke und Push.

**C7 ist entschieden:** der Stichentscheid in „Beliebteste" wandert mit. Sonst
hätte der Feed zwei Begriffe von „neuer" — die Zeit-Ordnungen einen, der
Gleichstand der dritten einen anderen.

**A3/C6 sind gemessen** (20 000 Beiträge, `created_at` und
`veroeffentlicht_ab` absichtlich auseinanderlaufend, als `authenticated` mit
Claims unter voller RLS). Beide Kandidaten werden gewählt, der Sortierschritt
verschwindet aus dem Plan; die drei alten Indizes über `created_at` hatten
danach keinen Leser mehr und sind gefallen. Zahlen im Kopf der Migration.

## Was die Diff-Review und die Sichtprobe noch gefunden haben (F1, D4)

**Zwei MITTEL-Befunde von opencode, beide von mir eingebaut, beide behoben:**

7. **Das ACHTE Tor.** `recompute_potential_score` zählte geplante Beiträge in
   einen Score, der Fremden als Impact-Marke auf der Profilseite steht. Der
   Entwurf führte das als „bekannten Rest" und verschob es — das trägt nicht,
   es ist dieselbe Fehlerklasse wie Tor 4. Geschlossen, mit Positivkontrolle.
8. **Jede Textkorrektur datierte einen alten Beitrag auf jetzt um.** Mit nur
   zwei Zuständen war „am Zeitpunkt nichts geändert" von „jetzt sichtbar
   machen" nicht zu unterscheiden. Jetzt drei Zustände; die Gegenprobe ist
   gemessen (rot bei zwei Zuständen, grün bei dreien).

**C5 stand abgehakt, ohne erledigt zu sein.** Drei Sonden riefen die RPC weiter
mit sechs Argumenten, eine vierte mass den Cursor über die gefallene Spalte.

**Und der Grund ist nicht der naheliegende.** `tsconfig.json` schliesst
`scripts` ausdrücklich ein (`"include": ["src", "scripts", "vite.config.ts"]`) —
der Typlauf sieht diese Dateien sehr wohl. Er kann die Aufrufe nur nicht prüfen:
die Sonden bauen ihren Client mit `createClient(API_URL, KEY)` **ohne das
`Database`-Generic**, und damit ist `rpc()` dort auf `string` und `any`
abgebildet. Ein siebter Pflichtparameter fällt so nirgends auf. Alle vier
umgestellt.

**Die Sichtprobe (D4) hat einen Fehler gefunden, den kein Test sah:** sobald
ein Zeitpunkt gewählt war, schob der „sofort"-Knopf die Gruppe im Composer über
den Rand — **35 px waagerechter Überlauf des ganzen Dokuments bei 375 px**.
Behoben mit `flex-wrap` an beiden Planungs-Labels; nachgemessen: 0 px Überlauf
auf 375, und auf 1440 bleibt alles in einer Zeile (Mitten gemessen, nicht
`top` — unterschiedlich hohe Kinder haben bei `items-center` verschiedene
`top`-Werte auf derselben Zeile).

**Und einer, der NICHT von hier stammt:** das Bearbeiten-Formular überläuft auf
375 px um 18 px. Gegenprobe gemessen — das Entfernen des Planungsfeldes ändert
daran nichts; Treiber ist der native `<input type="file">` („Bilder
hinzufügen"), der mit 301 px nicht schrumpft. Bestand aus AGE-566, hier bewusst
NICHT mitrepariert.

**Eine eigene Zusage war tautologisch und ist ersetzt.** Der erste Score-Test
verglich `recompute_potential_score(...)` mit `profiles.potential_score` — eine
Spalte, die genau diese Funktion selbst schreibt. Er hätte den frisch
geschriebenen Wert mit sich verglichen, und die Auswertungsreihenfolge
innerhalb eines SELECT ist nicht zugesichert. Der Wert wird jetzt VORHER in
einer temporären Tabelle festgehalten.

**Und eine zweite war leer wahr.** Die Bestands-Zusage mass `count(*)` über die
GANZE Tabelle: in CI gegen eine frische Abbildung mit null Beiträgen also
vakuum-grün, auf einem benutzten Stack flackernd. Aufgefallen an zwei Zeilen
aus der eigenen Sichtprobe. Ersetzt durch das, was wirklich messbar ist — die
Vorgabe der Spalte plus der Beleg, dass sie greift. Der Rückfüllschritt selbst
ist lokal nicht messbar (Migrationen laufen vor dem Seed) und gehört nach F3.

## F3 — ausgerollt am 30.08., gemessen statt geglaubt

| Schritt | Beleg |
| --- | --- |
| PR #289 gemergt | Squash `746f5f7`, `state=MERGED` nachgeprüft |
| `drift-gate` auf main | **rot**, wie erwartet — `deploy`/`functions` übersprungen |
| Trockenlauf VOR dem Anwenden | genau **eine** fehlende Version: `20260829090000`, keine fremde fährt mit |
| `migrate-prod` | Lauf `33323498302`, `plan` + `apply` grün |
| `gh run rerun --failed` | `drift-gate` grün, `deploy` und `functions` grün |

**Die Rückfüllung ist auf beiden Seiten nachgelesen** — der Schritt, der lokal
grundsätzlich nicht messbar ist (Migrationen laufen vor dem Seed):

| | Bestand | `veroeffentlicht_ab <> created_at` | fällig & unangekündigt |
| --- | --- | --- | --- |
| PROD | 7 | **0** | **0** |
| DEV | 29 | **0** | **0** |

Dazu auf beiden: beide Policies und alle fünf Funktionen tragen den Zeitpunkt,
`create_post_with_media` hat **genau eine** Signatur, `beitrag_ankuendigen()`
existiert. Sonde: `scripts/mess-age667-prod.ts` (nur lesend,
`default_transaction_read_only`, Ziel gegen die Ref geprüft) — sie war nur für
diese Abnahme da und ist mit dem Archivieren wieder entfernt worden.

**Die Zeitplanung steht auf DEV und PROD** (`beitrag-ankuendigen`, `* * * * *`,
`active=t`) — gesetzt **nach** der Messung, nie davor. Der erste Lauf auf PROD
ist gefeuert und hat **geschwiegen**: `status=succeeded`, `post_created` blieb
bei 16, `faellig_offen=0`. Genau das war die Zusage.

**Live nachgeprüft am Inhalt, nicht an der Grösse:** Deploy-URL und Apex liefern
denselben Bundle-Hash (`index-DKgt4Zdc.js`), und der Chunk
`AktivitaetPage-DcCP3mSz.js` trägt alle vier Zeichenketten aus dem Diff
(`Sichtbar ab (leer = sofort)`, `Geplant für`, `Beitrag geplant`,
`datetime-local`).
