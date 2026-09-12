## 1. Messen, bevor gebaut wird

- [x] 1.1 Zahl der Release-Notes auf PROD lesend gemessen (11.09., über
      `pg` gegen `aws-0-eu-central-1.pooler.supabase.com`): **0 gesamt, 0
      zugestellt, 0 Entwürfe.** `posts.kind` trägt dort `member` 8, `event` 3 —
      keine dritte Art vorhanden. **Sollwert für den Backfill: 0.**
- [x] 1.2 Dasselbe auf DEV (`aws-1-…`, erkennbar anderer Datenstand):
      ebenfalls **0 / 0 / 0**; `posts.kind` `member` 21, `event` 8.
      **Sollwert für den Backfill: 0.**
- [x] 1.3 Folge festgehalten (design.md, Entscheidung 7): der Mechanismus aus
      AGE-631/632 ist gebaut und nie benutzt worden. Die Fläche bleibt nach dem
      Ausrollen leer, bis jemand zustellt — entschieden, kein Versehen. Die
      Abnahme kann deshalb **nicht** auf PROD stattfinden.

## 2. Plan-Review (Gate, vor der ersten Codezeile)

- [x] 2.1 `openspec validate --all` grün (35/35).
- [x] 2.2 Plan-Review gelaufen: **gemini** (`gemini-pro-reviewer`, 4 Befunde)
      und **opencode** (`hf:moonshotai/Kimi-K3.0`, 10 Befunde), beide
      REQUEST-CHANGES, beide auf `MODEL:` und Delegation geprüft. `codex` nicht
      angesetzt — delegiert bei dieser Artefaktgröße nachweislich zurück.
      `REVIEWS.md` geschrieben.
- [x] 2.3a Die beiden offenen Fragen aus `design.md` mit Donald geklärt
      (11.09.): der Interaktionsbereich **bleibt** an der Release-Karte (gegen
      den Vorschlag des Entwurfs), und der Absender heißt **`eff.bee.zee`**.
      Beides steht jetzt als Entscheidung 8 bzw. 6 im Design und als Zusage im
      Spec-Delta.
- [x] 2.3b Befunde eingearbeitet oder begründet zurückgewiesen — die Auflösung
      steht im Abschnitt „Resolution" von `REVIEWS.md`. Übernommen: alle drei
      HOCH und alle vier MITTEL, dazu zwei der drei NIEDRIG. Begründet
      abgelehnt: der `RENAMED`-Titelvorschlag und die Rangzahl-Bereinigung.

## 3. Die Verengung an der Grenze zuerst — RED

- [x] 3.1 **RED:** Test, dass eine Zeile mit `kind = 'release'` aus `fetchFeed`
      als Art `release` herauskommt und **nicht** als `member`. Steht in
      `src/lib/feed.release.test.ts`, mit einer Mitgliedszeile als
      Positivkontrolle daneben — ohne sie wäre der Test auch dann grün, wenn
      jede Zeile „release" hiesse.
- [x] 3.2 **RED:** Test, dass der Beitragstyp-Filter „Text" keinen
      Release-Beitrag einschließt. Behauptet über den **Typausdruck der
      Anfrage**: er nennt `kind.eq.member` und arbeitet nicht über
      `kind.neq.event`.
- [x] 3.3 **RED:** Test, dass die Release-Karte weder Name noch Avatar des
      Mitglieds in `author_id` trägt. Der Admin steht im Mock **mit** Namen und
      Bild in `profiles_public` — die Karte könnte beides auflösen und darf es
      nicht. Positivkontrolle: der gewöhnliche Beitrag behält seinen Autor.
- [x] 3.4 Alle drei rot gelaufen (11.09., `pnpm vitest run
      src/lib/feed.release.test.ts` — 3 failed, 0 passed), **jeder aus dem
      richtigen Grund**:
      - 3.1 `expected [ 'member', 'member' ] to deeply equal [ 'release',
        'member' ]` — die Verengung in `feed.ts:871`.
      - 3.2 `expected 'and(video_url.is.null,kind.neq.event,post_media.is.null)'
        to contain 'kind.eq.member'` — der Filter verneint eine Art, statt die
        gemeinte zu nennen.
      - 3.3 `expected 'Anna Berger' not to be 'Anna Berger'` — die Karte trägt
        heute den Namen des zustellenden Admins.
      `typecheck` und `lint` sind daneben grün; die Datei ist mit Prettier
      formatiert (nur sie, nicht der Arbeitsbaum).

## 4. Migration

- [x] 4.1 Migration geschrieben: `supabase/migrations/20260912100000_release_beitrag_im_feed.sql`.
      Spalte `release_note_id` mit benanntem FK `posts_release_note_id_fkey`
      (`on delete cascade`), `posts_kind_check` dreiwertig,
      `posts_kind_ref_id_check` dreifach (jede Art nennt BEIDE Bezugsspalten),
      partieller Unique-Index `posts_release_note_id_key`, Trigger-Funktion
      `release_feed_post_sync()` + `after update of status on release_notes`
      mit `when (old.status = 'draft' and new.status = 'sent')`. Der Dateikopf
      trägt Befund, die drei verworfenen Alternativen und die Begründungen.
- [x] 4.1b Die Funktion ist `security definer` mit `set search_path = ''`;
      `revoke execute … from public, anon, authenticated, service_role`.
      Die Bedingung steht im `when` des Triggers, nicht im Rumpf — so steht sie
      im Katalog und der Rumpf hat nur einen Fall.
- [x] 4.2 Backfill im Dateikopf begründet: **`created_at` UND
      `veroeffentlicht_ab`** aus `sent_at`, `visibility = 'members'`
      ausdrücklich, `not exists`-Wächter, Entwürfe und Notes ohne `created_by`
      ausgenommen. Der Sollwert 0 aus 1.1/1.2 steht als Zahl dabei.
- [x] 4.2b Der Befund ist in der Migration und im Test verankert — und der
      **Test dazu war zuerst blind.** Gemessen 12.09.: eine Fassung des
      Auslösers OHNE `veroeffentlicht_ab` lief gegen die erste Form der Zusage
      **grün** durch. Grund: `send_release_note()` setzt `sent_at = now()`, und
      `veroeffentlicht_ab` trägt `default now()` — in derselben Transaktion
      sind beide zwangsläufig gleich. Die Zusage misst erst über ein **altes**
      `sent_at` (`2026-05-01`) und den direkten Zustandswechsel; in dieser Form
      fällt genau sie und sonst nichts.
- [x] 4.3 Migration gegen den lokalen Stack gefahren (`supabase start`, frische
      Datenbank): läuft durch, alle Katalogobjekte nachgelesen (CHECK-Definition,
      Indexdefinition, Triggerdefinition). **Nachgetragene Zeilen: 0** — der
      Sollwert. Zusätzlich mit **künstlich zugestelltem Altbestand** geübt (drei
      Notes: zugestellt mit `sent_at = 2026-05-01`, Entwurf, zugestellt ohne
      `created_by`): **genau 1 Zeile**, beide Zeitspalten `2026-05-01 09:00+00`,
      `visibility = members`, `body` leer; der zweite Lauf derselben Anweisung
      erzeugt **0** weitere. In einer Transaktion, zurückgerollt.
- [x] 4.4 pgTAP 1.1–1.5 in `supabase/tests/release_beitrag_test.sql`: `release`
      ohne `release_note_id` → `23514`, `release` mit `ref_id` → `23514`,
      `member` mit `release_note_id` → `23514`, zweite Zeile auf dieselbe Note
      → `23505`. Als **Eigentümer** geprüft, sonst wiese die Policy vorher ab.
      Mit Positivkontrolle 1.4 (die passende Kombination geht durch).
- [x] 4.5 pgTAP 2.1: ein aktiviertes Mitglied kann keine `release`-Zeile
      schreiben. Das INSERT-Recht wird **innerhalb der Transaktion kurz
      zurückgegeben** (AGE-582: sonst antwortet das ACL vor der Policy), und
      die Ablehnung ist an `row-level security policy` verankert, nicht an
      `42501` — „permission denied" trägt denselben SQLSTATE. Positivkontrolle
      2.2: mit demselben Grant schreibt dasselbe Mitglied einen Mitgliedsbeitrag.
- [x] 4.6 pgTAP 3.1–3.8: Entwurf → keine Zeile; Zustellung → genau eine, mit
      `visibility = members` und leerem `body`; zweiter Versand → `23505` und
      **keine** zweite Zeile.
- [x] 4.7 `hinweis_auf_meinem_beitrag()` überspringt `kind = 'release'`. Die
      Funktion liest jetzt `kind` mit und kehrt vor jeder weiteren Prüfung um.
      `event` bleibt unberührt — dort IST der Host zuständig.
- [x] 4.8 pgTAP 4.3–4.6: Kommentar und Reaktion an der Release-Karte erzeugen
      **keine** `notifications`-Zeile für den Admin; dieselbe Handlung am
      Mitgliedsbeitrag erzeugt **genau eine**. Die Zählungen sind auf die
      `post_id` im Payload eingeschränkt — ohne das röteten die
      Positivkontrollen bei der Gegenprobe mit, und die Messung sagte nichts
      über die gemeinte Stelle.
- [x] 4.9 pgTAP 4.1/4.2: die Zustellung erzeugt **einen** `release_note`-Hinweis
      und **keinen** `post_created`-Hinweis. Gemessen vor dem Anlegen des
      Vergleichsbeitrags — der löst selbst einen Rundruf aus. Zweite
      Positivkontrolle im Migrationskopf festgehalten: auch
      `beitrag_ankuendigen()` wählt `p.kind = 'member'`.
- [x] 4.10 pgTAP 5.1–5.3: ohne bestimmbaren Autor (`created_by is null` **und**
      keine Sitzung) gelingt die Zustellung und es entsteht **kein** Beitrag.
      Positivkontrolle: derselbe Weg mit Urheber erzeugt einen.
- [x] 4.11 `grants_test`-Golden-Snapshot **unverändert grün** — und das ist der
      Befund: der Snapshot erfasst Tabellen-, Spalten- und Funktionsrechte. Eine
      neue Spalte **ohne** Grant und eine neue Funktion **mit** Entzug ändern
      ihn nicht. Nachgezogen werden musste nichts.

**Abnahme §4** (12.09., lokaler Stack, frische Datenbank): die **36 pgTAP-Dateien
aus `ci.yml`** in sechs Blöcken, **1324 Zusagen, alle grün**. Die neue Datei ist
in `ci.yml` eingetragen und `scripts/pgtap-dateiliste.test.ts` ist grün — ohne
den Eintrag liefe sie nie.

**Gegenproben (vier Mutationen, jede zurückgenommen und die Rücknahme belegt):**

| Mutation | rot geworden | gemeint |
| --- | --- | --- |
| `hinweis_auf_meinem_beitrag()` ohne die `release`-Ausnahme | 4.3, 4.5 | beide |
| Auslöser ohne `veroeffentlicht_ab` | 3.5 | ja |
| `posts_kind_ref_id_check` aufgeweicht | 1.1–1.3 (+ 3.1/3.2 als Folge) | drei |
| `posts_write_own` ohne `kind = 'member'` im `with check` | 2.1 | ja |

Die Folgefehler der dritten Mutation sind erklärt: unter der aufgeweichten
Prüfbedingung **gelingen** die Inserts aus 1.1 und 1.2, und die Zeile aus 1.2
belegt dann den Unique-Index für Note 1 — die Zustellung in 3.2 trifft ihn.
Policy und Prüfbedingung wurden **aufgeweicht, nicht gelöscht** (bei
eingeschalteter RLS ohne Policy gilt Default-Deny, eine `DENIED`-Zusage bliebe
grün); die Rücknahme ist per `diff` der Katalogdefinitionen vorher/nachher
belegt, Exit 0.

## 5. Der Lesepfad — GREEN

- [x] 5.1 `feed.ts`: die Art an der Grenze dreiwertig verengt (`PostKind` und
      die Abbildung in `fetchFeed`). Der bestehende Kommentar ist
      **mitkorrigiert**: „die harmlose Richtung" stimmte nur, solange es genau
      eine andere Art gab — seit dieser Änderung erschiene eine hier vergessene
      Art als Beitrag mit leerem Text und dem Namen des Zustellers.
- [x] 5.2 `feed.ts`: „Text" heißt jetzt `and(video_url.is.null,kind.eq.member,
      post_media.is.null)` — die gemeinte Art genannt, statt eine andere
      verneint.
- [x] 5.2b `feed.auswahl.test.ts` brach erwartbar (er pinnt die Zeichenkette)
      und ist mitgezogen, mit einem Zeiger auf die Absicht in
      `feed.release.test.ts` 3.2.
- [x] 5.2c Drei Zusagen in `feed.release.test.ts`: vier Haken setzen
      **buchstäblich dieselbe Anfrage** ab wie kein Haken (kein `or`, dieselbe
      Spaltenliste) und liefern in beiden Fällen die Release-Karte mit; der
      Cache-Schlüssel ist derselbe; und **sobald EIN Haken gesetzt ist**, nennt
      kein Typausdruck `release` — die Regel neben ihrer Ausnahme.
      `normalisierteTypen` ist unangetastet, aber **sein Kommentar nicht**: die
      Begründung „die vier Typen decken den Bestand lückenlos ab" ist seit
      dieser Änderung falsch und steht jetzt als Zusammenlegung da, nicht als
      Identität.
- [x] 5.2d Der Widerspruch war vor der ersten Codezeile aufgelöst (11.09.);
      Spec-Delta und `design.md` tragen die Entscheidung als Nummer 10.
- [x] 5.3 Zweiter benannter Einbettungs-Join
      (`release_notes!posts_release_note_id_fkey(id, title, body)`) plus die
      Spalte `release_note_id` in **beiden** SELECT-Listen — `FEED_SPALTEN` und
      `FEED_SPALTEN_GESPEICHERT`. `fetchPostById` ruft `fetchFeed` und erbt sie
      damit; der Deeplink-Pfad ist über `postId` derselbe Code.
      `FeedPost.releaseNote` ist neu, `releaseNoteVon()` nach dem Muster von
      `eventVon()`. Zwei Tests dazu: die Abbildung samt Positivkontrolle, und
      der Fall „Einbettung liefert nichts" (nicht lesbare Mitteilung → `null`,
      kein Fehler).
- [x] 5.4 Synthetischer Absender `absenderDerAnwendung()` nach dem Muster von
      `ehemaligesMitglied()`: `eff.bee.zee`, kein Bild, keine Stufe. `former`
      bleibt `false` — das Feld sagt „der Mensch dahinter ist gegangen" und wäre
      hier eine falsche Aussage. Dass der Absender nirgendwohin führt,
      entscheidet die Karte (§6.1).
- [x] 5.5 Die drei Tests aus §3 sind grün, zusammen mit den fünf neuen in
      derselben Datei (8 Zusagen).

**Abnahme §5** (12.09.): `pnpm test` **2774 grün** (241 Dateien) · `typecheck`
0 · `lint` 0 Fehler / 7 Warnungen (Vorzustand) · `pnpm build` grün.
`database.types.ts` ist **von Hand** um `release_note_id` und die
FK-Beziehung ergänzt — `gen types` darf nicht darüberlaufen. Neun Testdateien
trugen `FeedPost`-Vorlagen und brauchten `releaseNote: null`; das Feld ist
bewusst nicht optional, sonst fiele eine vergessene Stelle nicht auf.

## 6. Die Karte

- [x] 6.1 `ReleaseCard` in `CommunityFeed.tsx`, nach dem Muster von
      `EventCard`: Absender `eff.bee.zee` **ohne** `Link` (weder um den Avatar
      noch um den Namen), Titel, Text, Weg auf `/neues?note=<id>` — dieselbe
      Adresse, die die Glocke baut. Der Text wird **als Text** gerendert, wie im
      Modal auf `/neues`. Der Interaktionsbereich ist der **geteilte**
      `InteraktionsLeiste`.
- [x] 6.1b Zwei Zusagen in `CommunityFeed.release.test.tsx`: Like setzen und
      Like entfernen, sowie Kommentarfaden öffnen mit **nicht gesperrter**
      Eingabe. Das Entfernen wird über den **Ausgangszustand** gemessen
      (`likedByMe: true`), nicht über einen zweiten Klick: `fetchFeed` ist
      gemockt und liefert nach dem Neuladen wieder `false` — ein zweiter Klick
      sagte über die Richtung nichts aus. Dazu die Verneinung, die kein Szenario
      ist: der Absender trägt **kein** `a`, und es gibt auf der Seite keinen
      `/p/`-Verweis — mit einem gewöhnlichen Beitrag als Positivkontrolle, der
      seinen Autor sehr wohl verlinkt.
- [x] 6.2 Test: drei Karten, die Release-Karte in der Mitte — die Reihenfolge im
      DOM ist die der Liste.
- [x] 6.3 Test: `releaseNote === null` → keine Karte, kein leerer Zustand, kein
      Interaktionsbereich.
- [x] 6.4 Test: ein aktiviertes Mitglied der Stufe `basic` sieht die Karte.
- [x] 6.5 Der Body des Beitrags wird **gar nicht** gerendert. Der Test füllt ihn
      absichtlich — bei leerem Body wäre „kein Text sichtbar" auch dann wahr,
      wenn die Karte ihn brav rendern würde.

**Gegenprobe §6** (zwei Mutationen zugleich, danach zurückgenommen und die
Rücknahme per `diff` belegt): den geteilten Interaktionsbereich aus der Karte
entfernt UND die Release-Karten als getrennte Liste vorangestellt. Rot wurden
**genau vier** Zusagen — die drei zum Interaktionsbereich und die eine zur
Reihenfolge. Die sechs übrigen blieben grün, wie sie sollen.

## 7. Abnahme

- [x] 7.1 `pnpm test` **2784 grün** (242 Dateien) · `typecheck` 0 · `lint` 0
      Fehler / 7 Warnungen (Vorzustand) · `pnpm build` grün ·
      `openspec validate --all` 34/34 · pgTAP 36 Dateien / **1324 Zusagen** ·
      `pnpm test:integration` **25 grün** gegen den laufenden Stack.
- [x] 7.2 **Sichtprobe gegen den lokalen Stack**, über den ECHTEN Weg: eine
      Note als Entwurf angelegt, per `send_release_note()` als Admin zugestellt
      (2 Empfänger), dann als **`basic`**-Mitglied angemeldet. Die Karte steht
      oben im Feed, zwischen den beiden Mitgliedsbeiträgen, mit Absender
      `eff.bee.zee`, Titel, Text und dem Weg auf
      `/neues?note=<id>` — der Verweis öffnet dort die Mitteilung im Dialog.
      Belegt, dass die App wirklich lokal hängt:
      `performance.getEntriesByType('resource')` nennt als einzigen
      Supabase-Ursprung `http://127.0.0.1:54321`, und die Abfrage trägt
      `release_notes!posts_release_note_id_fkey`. Konsole ohne Fehler und ohne
      Warnungen.
- [x] 7.2b **Reaktion und Kommentar am echten Stack**, nicht nur in jsdom: Like
      gesetzt (`like_count` 1), Kommentar geschrieben (1 Zeile in `comments`),
      beides über den geteilten Interaktionsbereich. **Und die Zusage aus 4.7
      dazu gemessen:** der zustellende Admin hat danach **null**
      `comment_on_post`- und **null** `like_on_post`-Hinweise. Positivkontrolle
      im selben Bestand: ein Kommentar an einem Mitgliedsbeitrag erzeugt für
      dessen Verfasser genau einen.
- [x] 7.3 Sichtprobe in **beiden Themes** (`hell` und `navy` über
      `fbc.designVariant`, nicht über `prefers-color-scheme` — die Anwendung hat
      kein dunkles Inhaltsthema) und in **beiden Breiten** (1440 und 390).
      `document.documentElement.scrollWidth` = 390 bei 390 px Viewport, also
      kein seitliches Überlaufen. Vier Bilder unter `.gstack/age718/`
      (gitignored). **Das `qa`-Skill selbst ist NICHT gelaufen** — geprüft wurde
      gezielt die Release-Karte, nicht die ganze Fläche.
- [x] 7.4 `dashboard.ts:266` und `public-profile.ts:124` filtern weiterhin
      `.eq("kind", "member")`. Gegengeprüft, dass es keine weiteren Lesewege auf
      `posts` gibt: `grep '\.from("posts")'` findet ausser `feed.ts` nur diese
      zwei, und in `feed.ts` sind die übrigen Treffer Schreibwege (`update`,
      `delete`), die `posts_write_own` auf `kind = 'member'` festhält.
- [x] 7.5 **`cso`-Gate — und es hat einen echten Fehler gefunden, siehe 7.5b.**
      Der Lesepfad gibt nichts frei, was `release_notes_read_sent` nicht ohnehin
      freigibt. Gemessen mit gesetzten JWT-Claims (eine Sonde ohne Claims träfe
      null Zeilen und sähe wie ein Beleg aus):

      | Rolle | `posts where kind='release'` | `release_notes` |
      | --- | --- | --- |
      | aktiviertes Mitglied | 1 | 1 |
      | **nicht** aktiviert | 0 | 0 |
      | `anon` | 0 | 0 |

- [x] 7.5b **DER BEFUND DIESES ABSCHNITTS, und er wäre ohne den Stack nicht
      aufgefallen:** die Einbettung auf `release_notes` nahm dem
      **ausgeloggten** Schaufenster die ganze Antwort. `anon` hält auf der
      Tabelle kein SELECT-Recht, PostgREST antwortet dann mit **HTTP 401,
      `42501 permission denied for table release_notes`** auf die GESAMTE
      Abfrage — die Aktivität lädt ohne Sitzung überhaupt nicht mehr, sie
      bleibt nicht etwa ohne Release-Karten.

      **Es ist derselbe Fehler wie bei `post_saves` in AGE-582**, und die
      Antwort ist dieselbe: eine dritte Spaltenliste
      (`FEED_SPALTEN_OHNE_SITZUNG`) ohne die Einbettung, gewählt an
      `uid === null`. Der Verzicht kostet nichts — ein Release-Beitrag trägt
      `visibility = 'members'` und erscheint ohne Sitzung ohnehin nicht. Die
      Abbildung liest die Spalte über `"release_notes" in r`; das ist keine
      Vorsichtsmassnahme, sondern die Stelle, an der der Übersetzer die dritte
      Liste erzwingt.

      **Weder `pnpm test` noch pgTAP hätten das gesehen:** der Vitest-Mock
      zeichnet die Spaltenliste auf und fragt keinen Server, pgTAP kennt
      PostgREST nicht. Die bestehende Zusage „ausgeloggt lädt der Feed — die
      Einbettung liefe in 401" (AGE-582) wurde tatsächlich rot, gegengeprüft
      durch Zurückdrehen der Auswahl: **2 von 24** Integrationszusagen fielen,
      beide die gemeinten (gemessen, bevor die neue Zusage dazukam; mit ihr sind
      es **3 von 25** — von einer Nachbarsitzung unabhängig nachgemessen). CI
      wäre also rot geworden, nicht PROD — aber gefunden hat es das Gate, nicht
      der Lauf.

**Nachtrag 13:53 — zwei pgTAP-Dateien wurden rot, und es liegt NICHT an diesem
Change.** Beim Wiederholungslauf nach dem Diff-Review fielen
`admin_member_list_test.sql` Zusage 63 und `hinweistypen_test.sql` Zusagen 8/9.
Beide sind **Mengenaussagen über die ganze Tabelle** — genau die Klasse, vor der
der Kopf von `feed_popularity_test.sql` warnt. Der geteilte lokale Stack hat
seit dem grünen Lauf um 13:05 zwei weitere Integrationsläufe und meine
Sichtprobe-Fixtures aufgenommen.

Gemessen statt vermutet:

| Frage | Antwort |
| --- | --- |
| `post_created`-Hinweise auf einen nicht mehr vorhandenen Beitrag | 1063 |
| Hinweise, die auf einen **Release**-Beitrag zeigen | **0** |
| `profiles` ohne `auth.users`-Zeile | 12 |
| `admin_member_counts()` vs. `admin_list_members()` | 14 vs. 2 |

Dieselben 36 Dateien waren um 13:05 grün, **mit dieser Migration bereits
angewandt**. Dazwischen liegt nur fremdes Wachstum im Bestand.

**Der zweite Befund gehört nicht hierher, ist aber echt:** Zähler und Liste der
Admin-Mitgliederliste laufen um genau die 12 verwaisten Profile auseinander. Die
Liste joint `auth.users` (sie braucht die Adresse), der Zähler nicht. Verwaiste
Profile kann es geben, seit `20260908180000_kontoloeschung_auth_fk_entfernen.sql`
(AGE-708) den Fremdschlüssel gelöst hat. In CI faellt es nicht auf, weil
`supabase db reset` vorangeht und der pgTAP-Block **vor** dem Integrationslauf
steht. Auf PROD hiesse es: ein Konto ohne `auth.users`-Zeile wird gezählt, aber
nicht aufgeführt. **Fremder Vorgang — gemeldet, nicht angefasst.**

**Gesät auf dem geteilten lokalen Stack** (12.09., damit die nächste Sitzung
nicht über fremde Daten rätselt): 2 Konten (`age718-admin@test.local`,
`age718-mitglied@test.local`, Kennwort im Handoff), 2 Mitgliedsbeiträge, 1
Release-Note samt erzeugtem Beitrag, 2 Kommentare. Daneben liegen die Fixtures
der Integrationsläufe (`age582-*`) — deren `auth.users` sind entfernt, ihre
`profiles` nicht, weil `20260908180000` den Fremdschlüssel gelöst hat.
`.env.local` und der vite-Prozess sind **entfernt**.

## 8. Code-Review und Abschluss

- [x] 8.1 Diff-Review über zwei Vendoren, auf dem **Diff** (25 Dateien, 3241
      Zeilen), nicht auf dem Plan. Beide auf `^MODEL:` geprüft, keiner hat
      delegiert.

      | Arm | Modell | Befunde | Verdikt |
      | --- | --- | --- | --- |
      | opencode | `hf:moonshotai/Kimi-K3` | 5 (1 HOCH, 2 MITTEL, 2 NIEDRIG) | REQUEST-CHANGES |
      | gemini | `gemini-1.5-pro-001` | 1 (NIEDRIG) | REQUEST-CHANGES |

      **Übernommen — HOCH (opencode): eine vorbestehende Release-Zeile hätte die
      Mitteilung dauerhaft unzustellbar gemacht.** Weder der Fremdschlüssel noch
      der CHECK binden eine `release`-Zeile an `status = 'sent'` der Note; eine
      Zeile auf einen **Entwurf** ist schema-gültig. Der Insert des Auslösers
      träfe dann den partiellen Unique-Index, der Trigger-Fehler rollte das
      umgebende `update` zurück, und die Note erreichte `sent` nie — ohne
      SQL-Eingriff nicht mehr zu heilen. Genau die Fehlerklasse, die der
      Autor-Zweig schon ausschließt. Der Auslöser trägt jetzt
      `on conflict (release_note_id) where kind = 'release' do nothing`, mit
      dem partiellen Index als Arbiter; dieselbe Bedeutung wie der
      `not exists`-Wächter des Backfills. Drei pgTAP-Zusagen dazu (3.9–3.11).
      **Der Reviewer hat den Weg an meinem eigenen Test belegt:** 1.4 legt genau
      so eine Zeile an und muss sie danach von Hand löschen.

      **Übernommen — MITTEL (opencode): nur INSERT war gemessen.** Die Zusage
      lautet „anlegen, ändern oder löschen". Vier Zusagen dazu (2.3–2.6), und
      geprüft wird der **zustellende Admin**, denn er ist der Autor der Zeile.
      Über die **Zeilenzahl**, nicht über einen Fehlercode: ein UPDATE oder
      DELETE, dessen Zeile die USING-Klausel wegfiltert, wirft nicht. Mit
      Nachlese des Bestands und einer Positivkontrolle am eigenen
      Mitgliedsbeitrag.

      **Übernommen — MITTEL (opencode): eine neue Zusage maß nichts.** Die
      Integrationszusage prüfte `releaseNote === null` auf dem Weg ohne Sitzung
      — dort wird die Einbettung per Konstruktion nie geholt, die Zusage konnte
      gar nicht falsch werden. Sie prüft jetzt die **Art** und misst damit die
      Sichtbarkeitsgrenze.

      **Übernommen — NIEDRIG (opencode): der Reihenfolgetest hing am Markup.**
      Er las den Text des ersten `div` der Seite; ein nicht gefundener Text
      ergäbe `-1` und ließe die Vergleiche in beide Richtungen kippen. Er
      vergleicht jetzt die drei Knoten selbst per `compareDocumentPosition`,
      mit der Gegenrichtung daneben.

      **Übernommen — NIEDRIG (gemini): die Testvorlage trug Markdown.**
      `body: "## Glocke verdrahtet"` behauptete eine Auszeichnung, die nirgends
      greift: der Text wird auf **allen drei** Flächen als Text gerendert
      (`/neues`-Liste, `/neues`-Dialog, Feed-Karte), und im Repo liegt kein
      Markdown-Renderer. Vorlage auf Fließtext umgestellt. Die Darstellung
      selbst ist damit unverändert und deckt sich mit `/neues` — insofern ist
      der Befund über die **Daten** richtig und über das **Verhalten** kein
      Fehler dieses Changes.

      **Begründet abgelehnt — NIEDRIG (opencode): „Bild" und „Video" nennen die
      Art nicht.** Formal richtig, aber die Richtung ist die andere:
      `kind.neq.event` schloss eine Release-Karte aktiv EIN, diese beiden
      schließen sie aus — und zwar erzwungen, nicht zufällig.
      `post_media_insert_own` verlangt `kind = 'member'`, und
      `posts_video_url_setzen()` rechnet `video_url` bei jedem Schreiben aus
      `body`, der leer ist. Steht als Entscheidung 11 im Design.

      **Gegenproben zu den zwei übernommenen Schema-Befunden**, jede
      zurückgenommen und die Rücknahme am Katalog belegt: ohne das
      `on conflict` fallen **3.9 und 3.11** und sonst nichts; mit
      aufgeweichter `posts_write_own` fällt **2.1** (und der Lauf bricht danach
      am Unique-Index ab, weil die aufgeweichte Policy die Zeile aus 2.1 stehen
      lässt — erklärt, nicht übersehen).
- [x] 8.2 **Migration VOR dem Merge auf PROD anwenden.** Der Grund gilt
      unverändert: `deploy.yml` läuft automatisch beim Push auf `main`,
      `migrate-prod.yml` nur von Hand. Ein gewöhnlicher Merge rollte sonst das
      Frontend gegen ein Schema ohne `release_note_id` aus, und PostgREST ließe
      damit **die ganze Feed-Abfrage** scheitern — die Aktivität lädt dann gar
      nicht.

      **⚠ DER WEG IN DIESER AUFGABE IST NICHT GANGBAR — gemessen am 12.09.,
      bevor etwas ausgelöst wurde.** „`workflow_dispatch` auf den
      Feature-Branch" scheitert am **ersten** Schritt von `migrate-prod.yml`:

      | Stelle | Was dort steht |
      | --- | --- |
      | `migrate-prod.yml` Schritt 1 | „Belegen, dass migrate-dev fuer DIESEN Commit gruen war" — sucht einen `deploy.yml`-Lauf zu `github.sha` |
      | `deploy.yml:36` | `migrate-dev` trägt `if: github.ref == 'refs/heads/main'` |

      Für einen Feature-Branch-Commit gibt es also **nie** einen grünen
      `migrate-dev`-Lauf, und der Workflow bricht mit
      `Kein deploy.yml-Lauf fuer <sha> gefunden. Ist der Commit auf main?` ab.
      Die Annahme im Design („der Workflow ist an keinen Ref gebunden, das ist
      also möglich") stimmt für `migrate-prod` selbst und übersieht seine
      **Vorbedingung**.

      **Das Gate ist richtig und wird nicht aufgeweicht.** Es sagt „PROD kommt
      nach DEV, nicht davor", und DEV bekommt Migrationen nur über `main`.

- [x] 8.2a **So ausgeliefert (Donald, 12.09.): in zwei Schritten** (expand, dann
      migrate).

      **Gefahren am 12.09.:** PR **#400** (nur die Migration, drei Dateien, nur
      Hinzufügungen) → Merge `5bb2130` → `migrate-dev` grün, DEV hat die Spalte
      → `migrate-prod.yml` per `workflow_dispatch` auf `main`, Lauf
      **34693613679**, `plan` und `apply` grün, „Applying migration
      20260912100000_release_beitrag_im_feed.sql… OK — 135 Migrationen,
      Historie abweichungsfrei" → PR **#401** (Lesepfad, Karte, Artefakte) →
      Merge `1d3af94`.

      **Gegen PROD nachgelesen, nachdem `apply` durch war:** Spalte, Auslöser
      und Unique-Index stehen; `posts where kind = 'release'` = **0** — der
      Sollwert aus 1.1. `posts.kind` trägt dort weiterhin nur `event` und
      `member`, 11 Zeilen gesamt.

      **Und der Riegel, den der Plan nicht kannte, hat gehalten:** der
      `drift-gate`-Job in `deploy.yml` misst die Migrationshistorie gegen
      **PROD** und liess den `deploy`-Job aus —
      `DRIFT — lokal vorhanden, auf dem Ziel fehlend: 20260912100000 …
      Erst migrate-prod freigeben, dann deployen.` Das Frontend wäre also auch
      bei einem gewöhnlichen Merge nicht vor der Spalte hinausgegangen. Der
      zweistufige Weg war trotzdem der richtige: er vermeidet den roten Lauf
      auf `main`, statt ihn nachträglich wiederholen zu müssen.

      1. **PR A — nur die Migration**: die Migrationsdatei, `release_beitrag_test.sql`
         und die `ci.yml`-Zeile. Merge auf `main` → `deploy.yml` fährt
         `migrate-dev` (DEV bekommt die Spalte) und deployt ein Frontend, das
         sich nicht geändert hat. **Das alte Frontend fragt `release_note_id`
         nicht ab** — die Migration ist additiv und für es unsichtbar.
      2. **`migrate-prod.yml` per `workflow_dispatch` auf `main`** — jetzt ist
         das Gate erfüllt. Erzeugte Release-Zeilen gegen den Sollwert **0**
         zählen (gemessen 11.09. auf PROD und DEV).
      3. **PR B — der Rest**: `feed.ts`, die Karte, die Tests, die Doku. Merge
         → das Frontend geht gegen ein PROD, das die Spalte schon hat.

      **Der Zustand zwischen 2 und 3 ist der gefahrlose** (Design, Abschnitt
      „Reihenfolge gegenüber dem Deploy"): Migration da, Frontend alt. Die
      Betriebszusage „zwischen PROD-Migration und Merge stellt niemand zu" ist
      hier gegenstandslos — `release_notes` ist auf PROD leer.

      *Verworfen — alles auf einmal mergen und danach migrieren:* zwischen
      Deploy und Dispatch stünde die Aktivität für **alle** Mitglieder still,
      nicht etwa ohne Release-Karten. Das ist kein Fenster, das man in Kauf
      nimmt, sondern genau der Ausfall, den diese Aufgabe verhindern soll.

      *Verworfen — das `migrate-dev`-Gate umgehen:* ein Wächter, der „PROD
      kommt nach DEV" sagt, wird nicht für die Bequemlichkeit eines Zuschnitts
      aufgeweicht.

- [x] 8.2b Belegt, nicht angenommen: die **wörtliche** Spaltenliste aus dem live
      ausgelieferten Stand (`origin/main:src/lib/feed.ts` vor #401) unangemeldet
      gegen die migrierte PROD-Instanz — **HTTP 200**. Damit ist gemessen, dass
      PostgREST jede Spalte und jede Einbettung gegen das neue Schema auflöst.

      **Die Null daneben ist erklärt, nicht übersehen:** die Antwort trägt 0
      Zeilen, weil alle 11 Beiträge auf PROD `visibility = 'members'` haben und
      es dort keinen öffentlichen gibt. Der Beleg ist der Statuscode, nicht die
      Zeilenzahl — eine gebrochene Einbettung antwortete mit 400/401, nicht mit
      200 und einer leeren Liste.
- [x] 8.3 Archiviert. **Vorher geprüft**, weil ein `MODIFIED`-Block beim Falten
      ALLES bekräftigt, was in ihm steht — auch unverändert übernommene Sätze:

      * `RENAMED`-Kopf zeichengleich im Bestand gefunden
        (`### Requirement: Der Feed zeigt zwei Kartentypen`).
      * Beide `MODIFIED`-Anforderungen klauselweise gegen die Wirklichkeit
        gelesen. Die heikelste Stelle ist „Text SHALL die Beitragsart namentlich
        prüfen" — sie ist seit #401 wahr und war es beim Schreiben des Deltas
        nicht.

      `openspec archive` meldet: **+9 hinzugefügt, ~2 geändert, →1 umbenannt.**
- [x] 8.4 Zwei PRs (#400, #401) plus dieser Archiv-PR. Linear auf den richtigen
      Endstand — **und zwar zweimal nachgesehen**: der Merge von #400 hat
      AGE-718 über den Branchnamen bereits auf Done gesetzt, obwohl die Hälfte
      noch fehlte. Zurückgesetzt auf In Progress, erst nach #401 wieder Done.
