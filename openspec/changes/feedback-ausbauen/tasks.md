> **Zweite Fassung, nach dem Plan-Review** (`REVIEWS.md`, beide Prüfer
> REQUEST-CHANGES). Die erste stellte Migration und Umsetzung vor die Tests —
> gegen die verbindliche RED-vor-GREEN-Regel dieses Repos. Jede Einheit unten
> beginnt jetzt mit der Zusage, die scheitern muss.
>
> **Reihenfolge ist nicht Geschmack.** Datenbank vor Oberfläche, und der
> `grants_test`-Snapshot im selben Change wie die neue Tabelle — sonst steht CI
> rot und der Bruch sieht aus wie ein Rechtefehler.

## 0. Vorbedingungen

- [x] 0.1 Produktfragen beantwortet (Donald, 01.09.): fünf Themen; der Admin
      darf das Bild löschen; ein vom Admin eröffnetes Gespräch ist für **beide**
      Seiten offen.
- [x] 0.2 `pnpm install --frozen-lockfile` in diesem Worktree.
- [x] 0.3 Plan-Review gefahren, `REVIEWS.md` liegt, Trailer vom Gate mit
      `trailer_status: ok` bestätigt.
- [x] 0.4 **Geprüft: die Zusage gibt es, sie ist tragend — und sie deckt nur
      eine Richtung.** Gegenprobe am 01.09. gegen den lokalen Stack: die
      Freigabe-Bedingung aus `messages_insert` entfernt (der Verbund mit
      `contact_requests`), die Teilnahmeprüfung stehen gelassen. Gemessen über
      die **ganze** CI-Liste: 23 Dateien, 1028 Zusagen. Es fiel **genau eine**
      — `rls_test.sql` Test 27, „Ein bestehender Thread allein reicht nicht —
      ohne angenommene Anfrage keine Nachricht": `OK`, wo `DENIED:%` erwartet
      war. Vorher 1028 PASS, verbogen 1 FAIL, danach wieder 1028 PASS; die
      Policy ist zeichengleich zurück, belegt mit `diff` gegen den Abzug aus
      `pg_policies`. Ein `db reset` war **nicht**
      nötig, die Dateien säen ihre eigenen Fixtures — die vier
      unversionierten Push-Objekte im geteilten Stack blieben unangetastet.
      **Und die Lücke, die daraus folgt:** Test 27 handelt als _Mitglied_ in
      einem gewöhnlichen Faden. Er bleibt nach 4.5 grün, gleichgültig ob der
      Admin-Zweig richtig oder falsch geklammert ist — die Fehlklammerung, vor
      der 4.5 warnt, lässt den Admin in **fremde** Fäden schreiben, und davon
      sieht Test 27 nichts. Geschärft in 4.8.

## 1. Themen: Tabelle, Spalte, Bestand

- [x] 1.1 **RED steht.** `supabase/tests/feedback_themes_test.sql`, 16 Zusagen,
      alle rot mit `relation "public.feedback_themes" does not exist`. Die
      Datei **bricht dabei nicht ab**: die drei Lesezusagen laufen über
      `pg_temp.lies_als()`, das den Fehler fängt und als Text zurückgibt — so
      scheitert RED als Zusage und nicht als Abbruch, und die Fassung nach 1.2
      misst mit denselben 16. In `ci.yml` eingetragen (jetzt 24 Dateien).
      Gesamtlauf: 1044 Zusagen, genau 16 rot, alle in dieser Datei.
- [x] 1.2 **Migration `20260902090000_feedback_themes.sql` liegt.** Tabelle mit
      `key` (Primärschlüssel), `label` und `sort`, alle `not null`; RLS an,
      Policy `feedback_themes_read` für `authenticated`, `select` ausdrücklich
      gegrantet — im selben Schritt wie das `enable`, weil RLS ohne Policy der
      Oberfläche eine leere Liste liefert und das nicht wie ein Rechtefehler
      aussieht.
      **Die `anon`-Frage ist entschieden, und nicht nebenbei:** `anon` bekommt
      nichts — weder Policy noch `grant`. Nicht nach `design.md` allein,
      sondern nach dem Vorbild im Repo: `grants_test.sql` führt für die
      Schwestertabelle `feedback/authenticated=…` und **keine** anon-Zeile.
      `membership_tiers` grantet an beide, wird aber vor der Anmeldung
      gebraucht; die Themen nicht. Begründet im Migrationskopf.
- [x] 1.3 **Die fünf Zeilen stehen** — `generell` „Generell", `fehler` „Fehler
      / etwas geht nicht", `bedienung` „Bedienung / Verständlichkeit",
      `inhalte` „Inhalte / Texte", `idee` „Idee / Wunsch". Eingefügt mit
      `on conflict (key) do update`, nicht `do nothing`: eine vorhandene, aber
      falsch beschriftete Zeile bliebe sonst konserviert und der Test liefe
      grün dagegen.
- [x] 1.4 **Golden-Snapshot nachgezogen** — eine Zeile,
      `feedback_themes/authenticated=SELECT`. Dass **keine** anon-Zeile
      danebensteht, ist die Zusage aus 1.2: wer `anon` später öffnet, ändert
      damit sichtbar den Snapshot und muss es begründen.
      **GREEN belegt:** dieselben 16 Zusagen aus 1.1 sind grün, und der
      Gesamtlauf steht bei 24 Dateien, **1044 Zusagen, PASS**.
- [x] 1.5 **RED stand:** Zusagen 17–19 in `feedback_themes_test.sql`, alle drei
      rot mit `column "theme" does not exist` — die tragende ist 19, das
      Absenden **ohne** Thema, das „Generell" tragen muss. Die 16 aus 1.1
      blieben dabei grün.
- [x] 1.6 **Migration `20260902093000_feedback_theme_spalte.sql` liegt**, in
      der vorgeschriebenen Reihenfolge: nullable **mit** `default 'generell'` →
      Bestand setzen → Fremdschlüssel → `set not null`. Der Vorgabewert bleibt
      **dauerhaft** — bis die neue Oberfläche ausgeliefert ist, nennt kein
      Schreibzugriff die Spalte, und ohne ihn bräche in diesem Fenster jedes
      Absenden. Begründet im Migrationskopf, samt der Angabe, warum jede andere
      Reihenfolge bricht.
      **Gemessen statt vermutet:** das `update` traf **0 Zeilen** — Postgres
      füllt den Bestand bei `add column … default` selbst. Es bleibt trotzdem
      stehen, für den Fall einer Instanz, in der die Spalte schon ohne
      Vorgabewert existiert; ein `set not null` über einer einzigen
      `null`-Zeile bräche die Migration, und das wäre auf PROD teuer.
- [x] 1.7 **Zusagen 20–22.** „Keine Zeile trägt `null`" ist **strukturell**
      zugesagt (`col_not_null`) und nicht gezählt: eine Zählung über die ganze
      Tabelle wäre in CI vakuum-grün, weil `feedback` nach `db reset` leer ist.
      Der abgewiesene Fall ist auf `feedback_theme_fkey` festgenagelt — ein
      Muster auf „irgendein Fehler" wäre auch dann grün, wenn das Schreiben aus
      einem anderen Grund scheitert — und trägt eine Positivkontrolle daneben,
      die eine Zeile **erzeugt**.
      **Gegenprobe gefahren**, weil diese drei Zusagen nach dem Code entstanden
      sind und ihr Grün für sich nichts belegt: Fremdschlüssel testweise
      entfernt → **genau Zusage 21 wird rot**, 21 von 22 bleiben grün; wieder
      angelegt → 22 von 22 grün.

## 2. Screenshot: Bucket, Bindung, Policies

- [x] 2.1 **RED stand:** `supabase/tests/feedback_screenshots_test.sql`, 8 von
      8 rot. In `ci.yml` eingetragen (jetzt 25 Dateien).
      **Was diese Datei bewusst NICHT kann:** sie prüft den Katalog — dass es
      den Bucket mit den richtigen Grenzen gibt und je eine Policy pro
      Kommando. Ob die Policies das Richtige _erlauben_, sagt sie nicht zu.
      Insbesondere bliebe sie grün, wenn die Klammer in 2.4 falsch stünde. Das
      ist Aufgabe von 2.6–2.9, und bis die stehen, ist Einheit 2 **nicht**
      belegt. — **Erledigt am 02.09.**: dieselbe Datei trägt jetzt 30 Zusagen,
      davon 22 mit echten Zeilen, und die Klammer ist gemessen.
- [x] 2.2 **Bucket liegt** — `feedback-screenshots`, privat, 5 MiB,
      `image/png` `image/jpeg` `image/webp`, per `on conflict (id) do update`.
      Mit `do nothing` bliebe ein falsch konfigurierter Bucket konserviert und
      die Zusagen 2–4 liefen grün dagegen; derselbe Befund kam schon aus dem
      C6-Review.
- [x] 2.3 **Schreib-Policies nach dem Muster von `post-media`** — Präfix je
      Verfasser, `is_activated()`, je eine für insert und update.
      Die dritte, `delete`, ist bewusst **keine** eigene Eigentümer-Policy
      geworden: mehrere Policies für dasselbe Kommando werden ODER-verknüpft,
      eine zusätzliche Eigentümer-Policy neben 2.4 wäre also wirkungslose
      Verdopplung. Löschen trägt allein die Policy aus 2.4.
- [x] 2.4 **Lesen und Löschen: aktiviert UND Bucket UND (Eigentümer ODER
      Admin)** — drei Bedingungen, nicht zwei.
      **Korrigiert am 02.09., nachdem 2.8 es gemessen hat:** die Begründung für
      das `is_activated()` stand hier falsch. Sie nannte den deaktivierten
      *Admin* — aber `is_admin()` trägt seit AGE-581 die ganze
      Zugangsbedingung selbst, der Admin-Zweig ist also längst geschlossen,
      bevor `is_activated()` gefragt wird. Was die Bedingung wirklich trägt,
      ist der deaktivierte **Eigentümer**. Gegenprobe: Bedingung aus beiden
      Policies entfernt, über 25 Dateien / 1080 Zusagen gemessen — es fielen
      **genau drei**, alle drei der Eigentümer-Fall, keine einzige aus dem
      Admin-Fall.
      Die **Klammer** um „(Eigentümer oder Admin)" ist tragend: wer den ganzen
      Ausdruck klammert, gibt dem Admin jeden Bucket dieser Instanz frei, nicht
      nur diesen. Dieselbe Falle steht in 4.5. **Jetzt gemessen:** Klammer
      verschoben → **genau eine** von 1080 Zusagen fiel, die neue
      Köder-Zusage auf `avatars`. Vorher gab es dafür keine Abdeckung.
- [x] 2.5 **`feedback.screenshot_path` liegt und ist gebunden**, in zwei
      getrennten Zusagen, weil es zwei verschiedene Fehler sind: ein `CHECK`
      hält den Pfad im Präfix des Verfassers (ein leerer Text fällt mit heraus,
      `split_part('', '/', 1)` ist nie eine Kennung), und ein **partieller**
      Unique-Index bindet ein Objekt an höchstens eine Zeile. Partiell, damit
      beliebig viele Zeilen `null` tragen dürfen — ein Screenshot ist optional.
- [x] 2.6 **Steht, sechs Zusagen.** Das dritte Mitglied zählt 0 auf dem fremden
      Screenshot, Eigentümer und Admin je 1. Dazu zwei Kontrollen, ohne die
      die Nullen nichts belegten: dasselbe dritte Mitglied sieht seinen
      **eigenen** Screenshot (die Abfrage trägt also), und der **Köder** im
      `avatars`-Bucket — der Bucket ohne SELECT-Policy, den eine falsch
      gesetzte Klammer dem Admin aufmachte. Die Köder-Zusage ist die einzige
      Abdeckung der Klammer im ganzen Bestand (gemessen, siehe 2.4).
- [x] 2.7 **Steht, vier Zusagen, getrennt vom Lesen.** Je ein eigenes Objekt
      pro Fall — ein gemeinsames hätte der erste erfolgreiche Löschfall
      mitgenommen, und die folgenden hätten „0 Zeilen" gemeldet, ohne dass die
      Policy je gefragt worden wäre. Der Beleg ist überall die **gezählte**
      Zeilenzahl aus `with … returning`, nie der Rückgabewert; die Freigabe
      `storage.allow_delete_query` steht einmal oben, sonst läge der Trigger
      unter jedem Ergebnis statt der Policy.
- [x] 2.8 **Steht, fünf Zusagen — und sie hat 2.4 widerlegt.** Der deaktivierte
      Admin liest und löscht nicht, aber **nicht** wegen `is_activated()` in
      der Policy: `is_admin()` selbst gibt für ihn schon `false` zurück
      (AGE-581). Die Zusagen sagen jetzt genau das, samt Positivkontrolle
      (die `staff_roles`-Zeile liegt wirklich).
      **Neu dazu: 5b, der deaktivierte Eigentümer** — drei Zusagen, und die
      einzige Abdeckung von `is_activated()` in diesen beiden Policies.
- [x] 2.9 **Steht, vier Zusagen — und sie schliessen zugleich die Lücke aus
      2.5.** Dessen zwei zugesagte Bindungs-Prüfungen gab es in keiner
      Testdatei; sie stehen jetzt hier. Ein fremdes Präfix prallt am `CHECK`
      ab (an `feedback_screenshot_path_praefix` verankert, nicht an „es hat
      gekracht"), das eigene geht durch, derselbe Pfad ein zweites Mal prallt
      am `…_uniq` ab, und zwei Zeilen **ohne** Screenshot gehen durch — die
      Zusage, dass der Index partiell ist.

## 3. Die RPC: abreissen und neu anlegen

- [x] 3.1 **RED stand:** `admin_feedback_test.sql` von 18 auf 19 Zusagen, die
      neunzehnte rot mit `FEHLER:42883`. Die Datei bricht dabei **nicht** ab —
      dafür der neue Helfer `pg_temp.versuch_as`: `text_as` fängt nichts, und
      ein `42883` darin risse die Testtransaktion mit, sodass die 18
      bestehenden Zusagen nicht mehr messbar wären.
      Die Fixture markiert drei Zeilen **ganz hinten** (`a…001`/`a…002` sind
      bei `id desc` die Plätze 106 und 105, also Seite 5). Eine Marke auf der
      ersten Seite wäre wertlos gewesen: sie stünde dort auch ohne Filter.
      Der Aufruf nennt das Argument **beim Namen** — positionell wäre er nach
      3.2 auch dann gültig, wenn die Argumente anders herum stünden.
- [x] 3.2 **Migration `20260902110000_admin_feedback_filter.sql`.** `drop` und
      neu anlegen mit vier Argumenten, alle mit Vorgabewert. Die Reihenfolge
      ist festgelegt (`p_limit`, `p_offset`, dann die Filter): ein Vertauschen
      bräche jeden positionellen Aufruf im Bestand **lautlos** —
      `admin_list_feedback(25, 0)` bliebe gültig und meinte etwas anderes.
- [x] 3.3 **`theme` und `screenshot_path` gehen mit**, und zwei Zusagen prüfen
      nicht, dass die Spalten *da* sind, sondern dass sie den Wert **ihrer**
      Zeile tragen — mit der Nachbarzeile ohne Bild als Gegenstück, sonst
      bliebe offen, ob die Spalte überall denselben Wert trägt.
      Dazu gehoben: `src/lib/database.types.ts` ist handgepflegt und nennt die
      Signatur ausdrücklich; sie stand sonst falsch im Repo.
- [x] 3.4 **Filter gebaut und gemessen.** `(p_x is null or spalte = any(p_x))`,
      innerhalb einer Facette ODER, zwischen den Facetten UND. Das
      Bewertungs-Prädikat hat eine **eigene** Zusage ohne Themenfilter — ohne
      sie fiele sein Fehlen nicht auf, weil die UND-Zusage schon durch ihr
      Themen-Prädikat auf eine Zeile einengt. Gegenprobe: Prädikat entfernt →
      **zwei** Zusagen fallen, genau diese beiden.
- [x] 3.5 Klemmung und Ordnung wörtlich übernommen; die zehn bestehenden
      Klemm- und Blätterungs-Zusagen laufen unverändert grün weiter.
- [x] 3.6 `revoke`/`grant`/`comment` mit der neuen Signatur
      `(int, int, text[], int[])`.
- [x] 3.7 **Fünf Zusagen gehoben**, alle auf `(int,int,text[],int[])`:
      `rls_test.sql` (zwei) und `admin_feedback_test.sql` (drei, die letzte
      über `::regprocedure`). Ohne das brächen sie mit einem Fehler statt mit
      `false` — und ein Fehler in `has_function_privilege` reisst die Datei ab.
- [x] 3.8 **Acht Zusagen, und drei Gegenproben belegen sie.** Jede über die
      ganze CI-Liste (25 Dateien, 1090 Zusagen), jede danach zeichengleich
      zurück (`diff` gegen `pg_get_functiondef`):
      | Gegenprobe | Es fielen |
      |---|---|
      | Bewertungs-Prädikat entfernt | **2** — die UND-Zusage und die Zusage über den Bewertungsfilter allein |
      | leeres Array als „alles" behandelt | **1** — „ein leeres Array trifft nichts" |
      | Filter erst **nach** `limit`/`offset` | **7** — beide Seitengrenzen-Zusagen, 3.1, und die vier, die Treffer von Seite 5 erwarten |

## 4. Die Ausnahme im Zugangsmodell

- [x] 4.1 **RED stand:** neue Datei `admin_gespraech_test.sql`, drei Zusagen,
      alle drei rot; in `ci.yml` eingetragen (jetzt **26** Dateien).
      **Korrektur vom 02.09.:** die Commit-Nachricht des RED erklärte die
      beiden `42501` mit einem `thread_id` von `null`. Das war falsch. Sie
      kamen aus **„permission denied for table faden"** — `authenticated` hält
      an einer pgTAP-Hilfstabelle keine Rechte, und dieser Fehler trägt
      denselben SQLSTATE wie eine RLS-Ablehnung. Zwei Zusagen waren damit rot,
      ohne die Policy je gefragt zu haben, und wären es nach dem Bau geblieben.
      Genau die Falle, vor der `rls-test-pgtap-alike` warnt.
      Behoben an zwei Stellen: die Kennung wird per `format` als **Literal**
      eingesetzt statt im impersonierten Ausdruck gelesen, und der Helfer gibt
      **SQLERRM mit** zurück, damit jede Ablehnung an
      `%row-level security policy%` verankert werden kann.
- [x] 4.2 **Migration `20260902120000_admin_gespraech.sql`.**
      `message_threads.admin_eroeffnet`, `not null default false`. Nicht vom
      Mitglied schreibbar: `threads_insert` trägt `not admin_eroeffnet`, und
      eine UPDATE-Policy gibt es auf der Tabelle gar nicht (Default-Deny).
- [x] 4.3 **`admin_gespraech_oeffnen(uuid)`** — normalisiert über
      `least`/`greatest` (der Unique-Index auf (a, b) erzwingt die Ordnung
      **nicht**), `on conflict do nothing` plus Nachschlag, Selbstgespräch mit
      `22023`, Nicht-Admin mit `42501`, Marke **nur in der `values`-Liste**.
      Zum Wettlauf ausdrücklich: `on conflict do nothing` **wartet** auf eine
      gleichzeitige Einfügung desselben Paares, und der Nachschlag sieht unter
      **READ COMMITTED** die inzwischen festgeschriebene Zeile. Unter
      REPEATABLE READ träfe das nicht zu — im Migrationskopf notiert.
- [x] 4.4 `threads_insert` neu: Teilnahme eigenständig, Ausnahme nur an der
      Freigabe, `is_activated()` bleibt, dazu `not admin_eroeffnet`.
- [x] 4.5 `messages_insert` neu: Teilnahme in einem **eigenen** `exists`, die
      Freigabe in einem zweiten, und nur der zweite trägt die Ausnahme.
- [x] 4.6 Beide Vorgängerfassungen stehen wörtlich im Migrationskopf, aus
      `pg_policies` gezogen — dort ist die Falle schwarz auf weiss zu sehen.
- [x] 4.7 **Fünf Zusagen, beide Richtungen.** Admin legt an und schreibt, das
      Gegenüber antwortet im markierten Faden; ein Nicht-Admin bekommt weder
      den Öffnungs-Weg (`42501 forbidden`) noch legt er von Hand ein Gespräch
      an. Dazu die Zusage, dass der Admin auch über `threads_insert` anlegen
      darf — die Ausnahme steht in **beiden** Policies, sonst sähe der Weg
      funktionierend aus und bräche erst beim Absenden.
- [x] 4.8 **Neun Zusagen für die Grenzen.** Zugesagt: kein Gespräch zwischen zwei Fremden, kein
      fremder `sender_id`, kein Schreiben ohne eigene Teilnahme, kein
      deaktivierter Admin, keine Freischaltung ausserhalb des markierten Fadens.
      **„Kein Schreiben ohne eigene Teilnahme" führt einen `Admin` als
      Handelnden**, in einem fremden und _nicht_ markierten Faden — so steht es
      nach der Gegenprobe aus 0.4 fest. Der vorhandene Test 27 in
      `rls_test.sql` deckt nur das Mitglied im gewöhnlichen Faden ab und bliebe
      auch dann grün, wenn 4.5 falsch geklammert wird. **Und es fängt sie
      niemand sonst auf:** Test 27 ist über alle 23 CI-Dateien die einzige
      Zusage, die auf die Freigabe anspricht. Die einzige weitere Datei, die
      `contact_requests` überhaupt anfasst, ist `thread_aktivitaet_test.sql` —
      dort steht die angenommene Anfrage als _Voraussetzung_ im Fixture, damit
      die Positivkontrolle nicht aus einem sachfremden Grund scheitert; geprüft
      wird sie nicht. Der Push-Pfad liegt hinter dem Tor, nicht darauf
      (`push_auftraege_holen` nennt `contact_requests` mit keinem Wort). Diese
      Zusage ist also keine Doppelung, sondern die einzige Abdeckung.
      **Am 02.09. gemessen und bestätigt:** die Klammer verschoben, über
      1111 Zusagen gefahren — es fiel **genau diese eine**.
- [x] 4.9 **Vier Zusagen.** Echte Nebenläufigkeit lässt sich in einer
      pgTAP-Sitzung nicht herstellen; zugesagt wird deshalb das, was den
      Wettlauf überhaupt erst harmlos macht: der Weg ist **idempotent** (zweiter
      Aufruf → dieselbe Kennung, genau ein Faden für das Paar), er **findet**
      den Faden, den der gewöhnliche Weg angelegt hat, **ohne ihn nachträglich
      zu markieren**, und ein Selbstgespräch bricht mit `22023` ab.
- [ ] 4.10 `cso` über den fertigen Diff. Der Change weitet **drei** Zusagen an
      verschiedenen Stellen. **Offen** — steht noch aus.

### Was die Gegenproben zu Einheit 4 ergeben haben (02.09.)

Vier Stück, jede über die ganze CI-Liste (26 Dateien, zuletzt 1111 Zusagen),
jede danach zeichengleich zurück (`diff` gegen den `pg_policies`-Abzug):

| Gegenprobe | Es fielen |
|---|---|
| **die Klammerfalle** — Teilnahme und Freigabe wieder in EINEN `exists` | **genau 1** von 1111: die dafür geschriebene Zusage. Sonst nichts im ganzen Bestand — die Messung aus 0.4 bestätigt sich |
| `admin_eroeffnet`-Zweig entfernt | **1** — das Mitglied antwortet nicht mehr |
| `not admin_eroeffnet` aus `threads_insert` entfernt | **2** — die Marken-Zusage und ihre Positivkontrolle |
| `or is_admin()` aus `messages_insert` entfernt | **beim ersten Mal 0** |

Die letzte Zeile ist der Ertrag. **`or is_admin()` war unbelegt** — kein
einziger Fall im Bestand brauchte ihn, weil der Admin immer im markierten Faden
schrieb. Belegt wird er erst von einem Faden, den der Admin über
`threads_insert` selbst angelegt hat: der trägt **keine** Marke.

Und damit steht eine Grenze fest, die vorher niemand ausgesprochen hatte: **ein
von Hand angelegtes Gespräch ist eine Einbahnstrasse.** Der Admin schreibt
darin, das Gegenüber nicht. Der ganze Weg ist `admin_gespraech_oeffnen`; zwei
neue Zusagen halten beide Hälften fest, damit das niemand für einen Fehler
hält. Nach ihnen fällt die Gegenprobe wie erwartet auf **1**.

## 5. Der Lösch-Weg fürs Bild

- [x] 5.1 **RED stand:** Abschnitt 7 in `feedback_screenshots_test.sql`, die
      Datei von 30 auf 37 Zusagen — **5 rot** (31, 32, 34, 35, 37). Die zwei
      Nachlese-Zusagen (33, 36) waren dabei grün, und das ist richtig so: sie
      sagen zu, dass nichts geschieht, und heute geschieht nichts.
- [x] 5.2 **Migration `20260902130000_admin_feedback_bild_loeschen.sql`.** Sie
      nimmt die Feedback-Kennung, prüft `is_admin()`, liest den Pfad aus der
      Zeile, leert den Verweis und **gibt den Pfad zurück**.
      **Abweichung von der Aufgabe, ausdrücklich:** sie löscht das Objekt
      **nicht** selbst. `storage.objects` ist die Metazeile; die Bytes liegen
      im Speicher-Backend, und die Zeile wegzulöschen liesse die Datei für
      immer liegen — genau davor steht `storage.protect_delete()` mit dem
      Hinweis „prevents accidental data loss from orphaned objects". Das
      Objekt entfernt deshalb der Aufrufer über die Storage-API; dafür trägt
      er die DELETE-Policy aus 2.4, die sonst gar keinen Zweck hätte.
      Die Reihenfolge — erst die Zeile, dann das Objekt — ist die, die
      `removePostMedia` in `src/lib/feed.ts` seit AGE-582 ausgeschrieben
      trägt. Aufgabe 8.4 muss beide Hälften rufen.
      Fehler statt stillem Nichts bei Nicht-Admin (`42501`) und unbekannter
      Kennung (`22023`); ein zweiter Aufruf auf einer geleerten Zeile ist
      **kein** Fehler — derselbe Knopf darf zweimal getroffen werden.
- [x] 5.3 **Sieben Zusagen**, und zwei Gegenproben belegen sie (jede über 26
      Dateien / 1118 Zusagen, danach zeichengleich zurück):
      | Gegenprobe | Es fielen |
      |---|---|
      | `where id = …` am UPDATE weggelassen | **2** — beide Nachlese-Zusagen; die Funktion leerte die Spalte tabellenweit, ihr Rückgabewert blieb dabei richtig |
      | `is_admin()`-Prüfung weggelassen | **2** — die Ablehnung und ihre Nachlese |
      Die erste Zeile ist der Grund, warum die Nachlese-Zusagen überhaupt
      dastehen: ohne sie wäre eine tabellenweit leerende Funktion grün
      durchgelaufen.

## 6. Typen und Datenschicht

- [x] 6.1 **`src/lib/database.types.ts` von Hand nachgezogen.** `feedback` um
      `theme` und `screenshot_path`, `feedback_themes` neu (nur `Row` —
      `authenticated` hält dort ausschliesslich SELECT, also gibt es keinen
      Schreibweg zu beschreiben), `message_threads.admin_eroeffnet` ebenfalls
      nur in `Row`, dazu die zwei neuen RPCs. `admin_list_feedback` war schon
      in Einheit 3 gehoben.
      `theme` steht in `Row` **ohne** `| null` und in `Insert` **optional** —
      genau das ist die Zusage des dauerhaften Vorgabewerts.
- [x] 6.2 **`src/lib/feedback.ts`.** Thema und Bild beim Absenden (beide nur
      mitgeschickt, wenn gesetzt — ein `theme: undefined` überträgt PostgREST
      als `null` und liefe gegen das `not null`), `uploadFeedbackScreenshot`
      mit `upsert: false`, `signFeedbackScreenshot` einzeln und erst beim
      Anzeigen, `deleteFeedbackScreenshot` mit **beiden** Hälften (RPC, dann
      Storage-API), `fetchFeedbackThemen`.
      Die Signaturgültigkeit ist aus `post-media` **übernommen** und nicht neu
      gewählt: sie ist zugleich die Nachlaufzeit eines Sichtbarkeitswechsels,
      und zwei Werte im selben Produkt wären zwei Antworten auf dieselbe Frage.
- [x] 6.3 **Der Schlüssel trägt jetzt Seite und Filter**, die Marken sortiert:
      er beschreibt eine Auswahl, keine Reihenfolge — sonst wären „Fehler,
      Idee" und „Idee, Fehler" zwei Abfragen mit garantiert gleichem Ergebnis.
- [x] 6.4 Beim Filterwechsel auf Seite 1 zurückspringen. **In 8.2 gebaut** —
      der Rücksprung sitzt im Setter des Filters, und den gibt es erst mit den
      Kästchen. Ihn in Einheit 6 zu bauen hiesse, einen Zustand ohne Bedienung
      anzulegen. Zusage und Mutationsprobe stehen dort.
- [x] 6.5 **Datenschicht-Tests: 17 neue Zusagen, dazu drei bestehende
      gehoben** (zwei in `feedback.test.ts`, eine in
      `AdminFeedbackPage.test.tsx` — sie schrieben die RPC-Argumente
      wörtlich aus und werden dadurch zu Wächtern über „kein Filter heisst
      `null`").
      **Mutationsprobe gefahren**, weil diese Zusagen nach dem Code entstanden
      sind — sechs Mutationen, jede einzeln, danach zeichengleich zurück:
      | Mutation | Es fielen |
      |---|---|
      | `[]` statt `null` an die RPC | **3** — darunter die zwei gehobenen Altzusagen |
      | Filter aus dem Query-Key | **2** — je eine pro Facette |
      | `upsert: true` | **1** |
      | `theme` immer mitschicken | **1** |
      | Fehler der Lösch-RPC ignoriert | **1** — das Objekt würde sonst ohne Recht entfernt |
      | Pfad nicht ins eigene Präfix | **2** |
      Keine Mutation lief grün durch; es gibt also keine unbelegte Zeile.
      Die Seitenrückstellung gehört zu 6.4 und wird mit 8.2 geprüft.

## 7. Oberfläche: Abgeben

- [x] 7.1 **Themenauswahl aus `feedback_themes`.** Weder Schlüssel noch
      Beschriftung stehen im Bauteil: die Vorbelegung ist `themen[0].key` —
      die Reihenfolge steht in `sort`, und die erste Zeile **ist** „Generell".
      Eine Zusage dreht die Fixture-Reihenfolge um; ein hier hingeschriebenes
      `"generell"` fällt daran auf (gemessen, siehe unten).
      Lädt die Liste nicht, erscheint **kein** Auswahlfeld und das Absenden
      bleibt möglich — die Spalte trägt dann ihren dauerhaften Vorgabewert.
      Ein leeres Auswahlfeld sähe aus wie ein Fehler, ein gesperrtes Absenden
      wäre einer.
- [x] 7.2 **Bildauswahl, optional.** Verstecktes Dateifeld plus Knopf, nativ
      über `useBildauswahl` (Muster von `EventCoverPicker`). Das Formular prüft
      Typ und Grösse aus **denselben Konstanten**, die die Datenschicht
      benutzt — aber die Grenze ist der Bucket; hier ist es Komfort.
      Reihenfolge beim Absenden: **erst das Bild, dann die Zeile.** Scheitert
      der Upload, entsteht gar keine Zeile — sonst stünde eine Rückmeldung
      ohne ihr Bild da und niemand wüsste, dass eines gemeint war.
- [x] 7.3 **Die bestehenden Zusagen stehen unverändert** (ohne Sterne kein
      Absenden — jetzt zusätzlich mit gesetztem Thema und Bild geprüft; der
      Auslöser trägt weiterhin kein `fixed`).
      Zur Höhe: das Panel ist `max-h-[90vh] overflow-y-auto` und wächst
      deshalb nicht über den Bildschirm, es scrollt. jsdom rechnet kein
      Layout, gemessen wird dort also die Zusage selbst; das **Nachmessen im
      Browser** gehört zu 9.4 und steht dort.
      **Mutationsprobe über die 12 neuen Zusagen** (sie sind nach dem Code
      entstanden), sieben Mutationen, danach zeichengleich zurück:
      | Mutation | Es fielen |
      |---|---|
      | Thema als Literal `"generell"` vorbelegt | **2** |
      | Typprüfung des Bildes weg | **1** |
      | Grössenprüfung weg | **1** |
      | Zeile trotz gescheitertem Upload schreiben | **1** |
      | Thema nicht mitschicken | **3** |
      | Pfad nicht mitschicken | **2** |
      | Deckelung des Panels entfernt | **1** |
      Keine Mutation lief grün durch.

## 8. Oberfläche: Admin

- [x] 8.1 **`FilterSpalte` wiederverwendet**, nicht nachgebaut — sie trägt vier
      Zusagen zur Anordnung, die einzeln lautlos brechen, wenn eine Kopie sie
      verliert.
- [x] 8.2 **Kästchen für Thema und Bewertung.** Die Themen kommen aus der
      Datenbank; ohne sie rendert der Block nicht. Kein Filter heisst alles —
      und **abwählen** fällt auf `null` zurück, nicht auf `[]` (eigene Zusage:
      `[]` wäre fatal, `= any('{}')` ist false).
      Die Bewertungs-Kästchen heissen **„3 Sterne"**, nicht „3 von 5 Sternen":
      genau so heisst der Vorlesetext an jeder Zeile, und zwei Stellen mit
      demselben zugänglichen Namen sind per Sprache nicht unterscheidbar. Beim
      ersten Lauf sind sie deshalb kollidiert.
      **Dazu 6.4 nachgeholt:** der Setter springt auf Seite 1 zurück.
- [x] 8.3 **Drei unterscheidbare Zustände**: Fehler, „Noch kein Feedback" und
      „Zu dieser Auswahl liegt nichts vor."
- [x] 8.4 **Bild über die signierte URL, plus Löschknopf.** Signiert wird erst
      **beim Anzeigen** — eine Seite mit 25 Zeilen stellte sonst 25 Signaturen
      aus, von denen die meisten niemand ansieht. Der Löschknopf ruft beide
      Hälften (RPC, dann Storage-API) und lädt die Liste neu, statt die Zeile
      im Zwischenspeicher zurechtzubiegen.
- [x] 8.5 **„Gespräch öffnen"**, adressiert über `profile_id`, springt nach
      `/chat/:threadId`.
- [x] 8.6 **Der Knopf fehlt mit Grund** — am eigenen Feedback („Das ist deine
      eigene Rückmeldung.") und bei einem Verfasser ohne Zugang („… könnte
      nicht antworten."). Dafür gibt die RPC seit dieser Einheit
      **`author_aktiv`** heraus (Migration `20260902140000`): über `profiles`
      käme die Fläche an ein deaktiviertes Profil nicht heran, und eine zweite
      Abfrage je Zeile wären 25 Abfragen je Seite.
- [x] 8.7 **17 neue Zusagen**, darunter die zwei gleichnamigen Mitglieder — der
      Sprung folgt der Kennung, nicht dem Text, und die beiden Profillinks
      zeigen ebenfalls auf verschiedene Ziele.
      **Mutationsprobe**, sieben Mutationen, danach zeichengleich zurück:
      | Mutation | Es fielen |
      |---|---|
      | Seitenrücksprung weg | **1** |
      | gefilterter Leerzustand wie der ungefilterte | **1** |
      | Gespräch über den **Namen** adressiert | **2** |
      | Knopf auch am eigenen Feedback | **1** |
      | Knopf auch ohne Zugang des Verfassers | **1** |
      | immer signieren statt erst beim Anzeigen | **2** |
      | Löschknopf auch ohne Bild | **1** |
      Die sechste Mutation war beim ersten Versuch **wirkungslos** (nur ein
      Kommentar) und lief grün durch — nachgeholt in der Fassung, die wirklich
      etwas ändert. Eine Mutation, die nichts ändert, belegt nichts.

## 9. Abnahme

- [x] 9.1 **Exit-Codes gelesen, nicht die Ausgabe:** `pnpm lint` 0,
      `pnpm typecheck` 0, `pnpm test` 0 (217 Dateien, 2459 Zusagen),
      `pnpm build` 0.
      **Achtung, bekannte Falle:** `pnpm build` schreibt
      `src/content/release-entries.generated.ts` **unformatiert um** — inhaltlich
      identisch (geprüft: gleich nach Entfernen aller Leerzeichen und
      Zeilenumbrüche), aber mit quotierten Schlüsseln und ohne
      Komma am Zeilenende. Die committete Fassung wurde zurückgeholt.
- [x] 9.2 **`supabase test db` mit Dateiliste**, aus `ci.yml` gezogen:
      **26 Dateien, 1119 Zusagen, PASS.**
- [x] 9.3 **`openspec validate --all` grün** — 32 von 32.
- [ ] 9.4 Im Browser zeigen: Abgeben mit Bild und Thema, Filtern über eine
      Seitengrenze hinweg, Sprung in den Chat **und eine Antwort des Gegenübers**.
- [ ] 9.5 Code-Review über den **Diff**, nicht über den Plan.
