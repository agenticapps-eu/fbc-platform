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
- [ ] 1.5 **RED:** pgTAP, das eine `feedback`-Zeile **ohne** Thema anlegt und
      erwartet, dass sie „Generell" trägt — schlägt fehl, solange es die Spalte
      nicht gibt.
- [ ] 1.6 Migration in dieser Reihenfolge: `theme` nullable **mit**
      `default 'generell'` → Bestand setzen → Fremdschlüssel → `set not null`.
      Der Vorgabewert bleibt dauerhaft; ohne ihn bricht jeder Schreibzugriff,
      der die Spalte nicht nennt — und das sind vor dem Frontend-Deploy alle.
- [ ] 1.7 pgTAP: ein Thema ausserhalb der Menge wird abgewiesen; der Bestand
      trägt „Generell"; keine Zeile trägt `null`.

## 2. Screenshot: Bucket, Bindung, Policies

- [ ] 2.1 **RED:** pgTAP gegen `storage.objects`, das den Bucket und seine
      Policies erwartet.
- [ ] 2.2 Migration: Bucket `feedback-screenshots`, privat, **5 MiB**,
      `image/png` `image/jpeg` `image/webp`, angelegt mit
      `on conflict (id) do update` — mit `do nothing` bliebe ein falsch
      konfigurierter Bucket konserviert und der Test liefe grün dagegen.
- [ ] 2.3 Schreib-Policies nach dem Muster von `post-media`: Präfix je
      Verfasser, `is_activated()`, je eine für insert/update/delete.
- [ ] 2.4 Lese- und Lösch-Policy: aktiviert **und** (Eigentümer oder Admin) —
      alle drei Bedingungen, nicht zwei. Das `is_activated()` ist der
      Unterschied zur ersten Fassung: ohne es käme ein deaktiviertes Konto mit
      noch gesetzter Admin-Rolle weiter an fremde Bilder.
- [ ] 2.5 `feedback.screenshot_path` anlegen (nullable) **und binden**: ein
      nicht-leerer Pfad muss im Präfix des Verfassers liegen, und ein Objekt
      gehört höchstens einer Zeile. Ohne die Bindung zeigt eine Zeile auf ein
      fremdes Objekt, und die Admin-Fläche signiert oder löscht das falsche Bild.
- [ ] 2.6 pgTAP, der **wirklich Zeilen anfasst**: ein drittes Mitglied kommt
      nicht heran, Eigentümer und Admin schon. Ein Fall, der nichts anfasst,
      tarnt sich hier als bestandener RLS-Test.
- [ ] 2.7 pgTAP fürs Löschen, **getrennt vom Lesen** — ein Lauf, der beides
      zusammen prüft, kann grün bleiben, während eines zu weit greift.
- [ ] 2.8 pgTAP: ein **deaktivierter** Admin darf weder lesen noch löschen.
- [ ] 2.9 pgTAP: ein Mitglied kann seine Zeile nicht auf einen fremden Pfad
      zeigen lassen.

## 3. Die RPC: abreissen und neu anlegen

- [ ] 3.1 **RED:** pgTAP, das nach Thema filtert und erwartet, dass eine Zeile
      jenseits der ersten Seite auf Seite 1 des gefilterten Ergebnisses steht.
- [ ] 3.2 `drop function public.admin_list_feedback(int, int)` und neu anlegen
      mit vier Argumenten, **alle mit Vorgabewert**, damit die argumentlosen
      Aufrufe weiter auflösen.
- [ ] 3.3 Rückgabe um `theme` und `screenshot_path` erweitern.
- [ ] 3.4 Filter: innerhalb einer Facette ODER, zwischen den Facetten UND.
      `null` heisst „keine Einschränkung", ein leeres Array **nicht** —
      `= any('{}')` ist falsch und lieferte im Normalfall eine leere Liste. Das
      Bewertungs-Prädikat nicht vergessen; die erste Fassung hatte nur das
      Themen-Prädikat.
- [ ] 3.5 Klemmung und Ordnung wörtlich übernehmen: 1..100 mit Rückfall auf die
      Vorgabe, absteigend nach `created_at`, dann nach `id`.
- [ ] 3.6 `revoke` und `grant` mit der **neuen** Signatur, dazu den Kommentar.
- [ ] 3.7 **Die fünf Signatur-Zusagen heben** — `rls_test.sql` 545 und 549,
      `admin_feedback_test.sql` 260, 262 und 267. Sie nennen die Argumenttypen
      ausgeschrieben und brechen nach dem `drop` mit einem Fehler statt mit
      `false`. Die letzte benutzt `::regprocedure`.
- [ ] 3.8 pgTAP: ohne Filterargument dieselbe Menge wie zuvor; zwei Themen als
      ODER; Thema **und** Bewertung als UND; der Filter greift vor der
      Seitengrenze.

## 4. Die Ausnahme im Zugangsmodell

- [ ] 4.1 **RED:** pgTAP, in dem ein Admin ohne angenommene Kontaktanfrage ein
      Gespräch anlegt und hineinschreibt, und das andere Mitglied antwortet.
      Alle drei müssen heute scheitern.
- [ ] 4.2 Migration: `message_threads.admin_eroeffnet`, nicht vom Mitglied
      schreibbar.
- [ ] 4.3 Der serverseitige Öffnungs-Weg: normalisiert das Paar über `least` und
      `greatest`, fügt mit `on conflict do nothing` ein, gibt die Kennung des
      bestehenden **oder** neuen Gesprächs zurück, weist ein Selbstgespräch ab,
      setzt die Markierung **nur beim Neuanlegen**.
- [ ] 4.4 `threads_insert` neu deklarieren: Teilnahmeprüfung **eigenständig**,
      Ausnahme nur an der Freigabe-Bedingung, `is_activated()` bleibt.
- [ ] 4.5 `messages_insert` neu deklarieren, ebenso getrennt, plus den Zweig für
      ein markiertes Gespräch. **Die Teilnahmeprüfung steht heute INNERHALB des
      Ausdrucks, den man klammern möchte** — wer ihn als Ganzes klammert,
      erlaubt dem Admin das Schreiben in jedes fremde Gespräch.
- [ ] 4.6 Die Vorgängerfassung beider Policies wörtlich in den Migrationskopf.
- [ ] 4.7 pgTAP in **beide** Richtungen und für jede der drei Zusagen einzeln:
      Admin darf anlegen und schreiben, das Gegenüber darf im markierten Faden
      antworten, ein Nicht-Admin darf weiterhin nichts davon.
- [ ] 4.8 pgTAP für die Grenzen: kein Gespräch zwischen zwei Fremden, kein
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
- [ ] 4.9 pgTAP: zwei nebenläufige Öffnungs-Aufrufe erzeugen **ein** Gespräch;
      das vertauschte Paar liefert dasselbe.
- [ ] 4.10 `cso` über den fertigen Diff. Der Change weitet **drei** Zusagen an
      verschiedenen Stellen.

## 5. Der Lösch-Weg fürs Bild

- [ ] 5.1 **RED:** pgTAP, in dem ein Admin ein fremdes Bild löscht und erwartet,
      dass der Verweis an der Zeile danach leer ist.
- [ ] 5.2 `SECURITY DEFINER`-Weg, der die **Feedback-Kennung** entgegennimmt —
      keinen Pfad vom Aufrufer, sonst ist es derselbe _confused deputy_ —, die
      Admin-Eigenschaft prüft, das Objekt löscht und den Verweis leert.
- [ ] 5.3 pgTAP: ein Nicht-Admin kommt damit nicht durch; ein Verweis auf ein
      fremdes Objekt lässt sich darüber nicht löschen.

## 6. Typen und Datenschicht

- [ ] 6.1 **`src/lib/database.types.ts`** von Hand nachziehen — nicht
      `src/types/`, das gibt es nicht. `gen types` NICHT darüberlaufen lassen.
- [ ] 6.2 `src/lib/feedback.ts`: Thema und Bild beim Absenden, Upload mit
      `upsert: false`, Filterargumente beim Abruf (`null` statt `[]`), signierte
      URL mit kurzer Lebensdauer erst beim Anzeigen.
- [ ] 6.3 **Den React-Query-Schlüssel um die Filter erweitern.** Er trägt heute
      nur die Seite (`AdminFeedbackPage.tsx:94`): ein Filterwechsel auf
      derselben Seite liefert veraltete Treffer, und wer auf Seite 3 steht und
      verengt, sieht fälschlich „keine Treffer".
- [ ] 6.4 Beim Filterwechsel auf Seite 1 zurückspringen.
- [ ] 6.5 Tests: `upsert: false` im Aufruf; leerer Filterzustand schickt `null`;
      der Schlüssel unterscheidet zwei Filterzustände; die Seitenrückstellung
      greift.

## 7. Oberfläche: Abgeben

- [ ] 7.1 Themenauswahl aus `feedback_themes`, vorbelegt mit „Generell".
- [ ] 7.2 Bildauswahl, optional; das Formular prüft dieselben Grenzen wie der
      Bucket, aber die Grenze ist der Bucket.
- [ ] 7.3 Die bestehenden Zusagen bleiben: ohne Sterne kein Absenden; unterhalb
      `sm` steht der Knopf im Dokumentfluss. Nach dem Umbau **nachmessen** — das
      Formular wird höher.

## 8. Oberfläche: Admin

- [ ] 8.1 `AdminFeedbackPage.tsx` in die bestehende `FilterSpalte` setzen
      (wiederverwenden, nicht nachbauen).
- [ ] 8.2 Kästchen für Thema und Bewertung; kein Filter heisst alles.
- [ ] 8.3 Ein Filter ohne Treffer sagt „zu dieser Auswahl liegt nichts vor" und
      ist unterscheidbar von einem gescheiterten Aufruf.
- [ ] 8.4 Bildanzeige über die signierte URL, plus **Bedienung zum Löschen** —
      die fehlte in der ersten Fassung ganz.
- [ ] 8.5 Knopf „Gespräch öffnen", adressiert über `profile_id`, ruft den Weg
      aus 4.3.
- [ ] 8.6 Der Knopf fehlt am **eigenen** Feedback und bei einem deaktivierten
      oder gelöschten Verfasser — mit einem Grund, nicht wortlos.
- [ ] 8.7 Tests: zwei gleichnamige Mitglieder, und der Sprung landet beim
      richtigen.

## 9. Abnahme

- [ ] 9.1 `pnpm lint`, `pnpm typecheck`, `pnpm test` — **Exit-Codes** lesen.
- [ ] 9.2 `supabase test db` **mit Dateiliste** — ohne sie lügt der Lauf.
- [ ] 9.3 `openspec validate --all` grün.
- [ ] 9.4 Im Browser zeigen: Abgeben mit Bild und Thema, Filtern über eine
      Seitengrenze hinweg, Sprung in den Chat **und eine Antwort des Gegenübers**.
- [ ] 9.5 Code-Review über den **Diff**, nicht über den Plan.
