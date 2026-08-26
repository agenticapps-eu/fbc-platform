# Tasks

Linear: **AGE-602** (anon-Grants) · **AGE-601** (`members` = alle Aktivierten)

Zwei Issues, ein PR (Donalds Vorgabe, 26.08.). Zwei getrennte Migrationen, damit
jede für sich zurücknehmbar bleibt.

## 0. Messungen vor dem ersten Diff

- [x] PROD-Katalog: welche Funktionen darf `anon` ausführen — **elf**, davon sechs
      mit ausdrücklichem `grant … to anon, authenticated` (Absicht) und **fünf**
      ungewollt.
- [x] PROD-Katalog: wo liegt das `members`-Sichtbarkeitsprädikat — **vier**
      Objekte (Policy `posts_select_by_visibility`, Funktionen
      `post_engagement_counts`, `post_media_lesbar`, `former_member_entries`).
      Die sechs weiteren `has_level`-Policies tragen keinen `members`-Zweig.
- [x] PROD-Katalog: `register_for_event` und `set_event_check_in` führen beide
      `is_activated()`; `is_activated()` ist `coalesce(…, false)`. Die Preisgabe
      ist Tiefenstaffelung — belegt am Katalog, nicht am Quelltext gelesen.
- [x] Warum der lokale Test grün ist: `directory_search_test.sql` §7 behauptet ein
      **Statement**-Ergebnis (`DENIED:permission denied for function …`) und ist
      lokal grün, weil `anon` das Recht dort nie hielt.

## 1. AGE-602 — der Entzug (RED zuerst)

- [x] **RED:** `directory_search_test.sql` §7 auf das **Privilegien-Bit**
      umstellen (`has_function_privilege('anon', …::regprocedure, 'execute')`),
      plus die vier weiteren Funktionen. Muss vor der Migration **rot** sein —
      und wenn es lokal grün ist, ist das der Beweis, dass die Zusage allein
      nichts belegt (siehe nächste Aufgabe).
- [x] **Gegenprobe auf einer Wegwerf-Funktion** (nicht auf einer echten):
      anlegen → messen, dass `anon` sie **nicht** darf (belegt den neuen Default)
      → Recht erteilen → `true` messen → entziehen → `false` messen. Auf einer
      echten Funktion belegte die Gegenprobe nur, dass `has_function_privilege`
      den Katalog liest.
- [x] **Abgeschlossene Liste:** Zusage „genau diese Funktionen sind für `anon`
      ausführbar, keine andere" — als Menge, nicht als Aufzählung von Verstößen.
      Trifft die sechs beabsichtigten.
- [x] **GREEN:** Migration `…_anon_execute_namentlich_entziehen.sql` —
      `revoke execute … from public, anon` für `search_directory`,
      `register_for_event`, `set_event_check_in`, `array_jaccard`,
      `fbc_profile_search_doc`.
- [x] **`PUBLIC` bei den beiden beabsichtigten entfernen:**
      `post_engagement_counts` und `event_registration_counts` tragen `=X/postgres`
      neben den benannten Rollen (lokal gemessen). `revoke … from public` plus
      ausdrücklicher `grant to anon, authenticated` — sonst behauptet die
      Anforderung „ausdrücklich erteilt", wo geerbt wurde.
- [x] `grants_test.sql` bricht **nicht** durch die neue Liste — die
      Golden-Snapshot-Falle betrifft Tabellen-Grants, und dieser Change legt
      keine Tabelle an. Gegengeprüft, nicht angenommen: die Datei läuft grün.

## 2. AGE-601 — die Ausweitung (RED zuerst)

- [x] **RED:** pgTAP — ein aktiviertes Mitglied unter Rang 4 liest einen fremden
      `members`-Beitrag, bekommt seine Zählzeile und darf sein Bild signieren.
      Drei Zusagen, alle rot vor der Migration.
- [x] **RED:** ein bestätigtes, **nicht** aktiviertes Konto bekommt weiterhin
      nichts — die Gegenrichtung, sonst belegt die Ausweitung nur, dass etwas
      offener wurde.
- [x] **GREEN:** Migration `…_members_sind_alle_aktivierten.sql` — alle **vier**
      Objekte in einer Datei. Drei zu ändern und eine zu vergessen ergäbe einen
      Feed, dessen Zähler nicht zu seinen Zeilen passen.
- [x] `feed_tag_counts` / `feed_top_authors` **nicht** anfassen und belegen, dass
      sie trotzdem folgen (`security invoker`) — das ist der Nutzen der
      Nicht-Abschreiben-Regel.
- [x] **Alle vier Kopien einzeln zusichern**, nicht nur die Policy:
      `former_member_entries`, `post_media`-Zeilen, Kommentare und der
      gespiegelte Event-Beitrag. Plus `feed_tag_counts`/`feed_top_authors` als
      Beleg, dass die nicht abgeschriebenen Wege von selbst folgen.
- [x] Die übrigen `has_level(4)`-Vorkommen unangetastet lassen
      (Kontaktanfrage-Schwelle, Event-Teilnahme) und im Diff nachweisen.

## 3. Der Menüeintrag — entfällt

- [x] **Gestrichen nach dem Plan-Review.** `community-feed` legt ausdrücklich fest,
      dass `/aktivitaet` weder `requiresAuth` noch `minTier` trägt; `App.tsx:37`
      machte aus `requiresAuth` eine Wand vor dem ausgeloggten Schaufenster.
      `src/config/nav.ts` wird **nicht** angefasst.
- [x] Stattdessen: die zwei veralteten **Kommentare** in `src/lib/feed.ts`
      (Zeilen 13, 338) auf die neue Regel bringen.

## 4. Abnahme

- [x] Volle Suite grün · `tsc` sauber · `eslint` 0 Fehler · pgTAP alle Dateien
      (mit **Dateiliste**, sonst lügt `supabase test db`).
- [x] **Mutationsprobe — acht Verbiegungen, Sicherungen ausserhalb von git:**

      | # | Verbiegung | Ergebnis |
      |---|---|---|
      | M1 | `revoke … from public` statt `from public, anon` | **GRÜN** — siehe unten |
      | M2 | Policy behält `has_level(4)` | rot (11) |
      | M3 | Mechanik-Zusage auf `from public` aufgeweicht | rot (1) |
      | M4 | neue Funktion für `anon` geöffnet | rot (1) |
      | M5 | `post_media_lesbar` nicht mitgezogen | rot (2) |
      | M6 | `former_member_entries` nicht mitgezogen | rot (1) |
      | M7 | `post_engagement_counts` nicht mitgezogen | **GRÜN → behoben, jetzt rot (1)** |
      | M8 | `is_activated()` aus der Policy entfernt | rot (5) |

      **M7 war eine echte Lücke.** Das Vergessen der Zähler-Abschrift bemerkte
      keine einzige Zusage — genau der Fehlerzustand, den dieser Change
      ausschliessen soll (ein Feed, dessen Zähler nicht zu seinen Zeilen passen).
      Zwei Zusagen ergänzt, danach rot.

      **M1 bleibt grün, und das ist strukturell, nicht behebbar.** Lokal hält
      `anon` das Recht nur über `PUBLIC`, also nimmt `from public` es ihm mit;
      der Unterschied existiert auf dieser Instanz nicht. Statt den Zustand zu
      messen, misst `grants_test.sql` Abschnitt 8 jetzt die **Regel** an einer
      Wegwerf-Funktion, der ein rollen-eigener Grant gegeben wird — diese Zusage
      ist auf jeder Instanz aussagekräftig und fällt unter M3.
- [x] **Sichtprobe über den ECHTEN Weg** (Anmeldung → JWT → PostgREST), nicht über
      einen SQL-Rollenwechsel. Zwei Konten per GoTrue-Admin (`email_confirm: true`,
      sonst scheitert die Anmeldung nach der Aktivierung), Beitrag `members` von
      fremdem Autor:

      | | Ergebnis |
      |---|---|
      | `basic` (Rang 1), aktiviert, eingeloggt | **HTTP 200, 1 Zeile** |
      | ausgeloggt (`anon`) | 0 Zeilen — Schaufenster bleibt zu |
      | `post_engagement_counts` für `basic` | `like_count: 1` |
      | `search_directory` als `anon` | **HTTP 401, `42501 permission denied for function`** |

      Die letzte Zeile ist AGE-602 an der API-Grenze: die Ablehnung kommt jetzt an
      der **Funktion** statt erst an `profiles`. Vorher wäre sie durchgelaufen und
      erst an der Tabelle gescheitert.
- [x] **Bestehende Gegen-Zusagen suchen und umdrehen:** `rls_test.sql` erwartet
      heute ausdrücklich, dass Rang 1 Medienzeilen, Bilder und gespiegelte
      Event-Beiträge **nicht** bekommt. Diese Zusagen namentlich auflisten, bevor
      eine geändert wird — eine übersehene macht die Suite rot und eine
      stillschweigend gelöschte macht sie wertlos.
- [x] **Nutzlast gemessen** (gemini MEDIUM). 61 `members`-Beiträge in der DB, eine
      Feed-Seite als `basic` über PostgREST: **21 Zeilen, 2 845 Bytes, 19 ms**.
      `FEED_SEITE = 20` (`src/lib/feed.ts:469`), geholt wird `limit(FEED_SEITE + 1)`.
      Die Ausweitung kann eine einzelne Antwort also **nicht** vergrössern — sie
      ändert, wie viele Seiten es gibt, nicht wie gross eine ist.
- [x] Code-Review auf dem **Diff** (Stufe 2): gemini APPROVE (2 LOW, kein
      Defekt), codex REQUEST-CHANGES (2 MEDIUM + 1 LOW). Alle drei bestätigt und
      behoben — darunter `array_jaccard`, das die Instanzen auseinanderlaufen
      liess. Protokoll in `REVIEWS.md`.
- [x] **Mutation M9** auf die Korrektur: bleibt lokal grün (dieselbe strukturelle
      Blindheit wie M1). An der Zusage benannt statt kaschiert; die Regel hält
      `grants_test.sql` Abschnitt 9 instanzunabhängig.

## 5. Nach `migrate-prod` — der Schritt, dessen Fehlen der Fehler war

> **Reihenfolge, aus dem Plan-Review:** `migrate-prod` hängt am `migrate-dev`-Lauf
> desselben Commits, und der läuft erst nach dem Merge auf `main`. Diese Zahlen
> sind also vor dem Merge **nicht** eintragbar. Bis sie stehen, gilt der
> PROD-Rechte-Zustand laut Anforderung als unbelegt — das ist kein Mangel des
> Changes, sondern die Reihenfolge der Pipeline, und sie ist hier benannt.

- [ ] **PROD-Katalog erneut messen** und die Zahlen hier eintragen:
      welche Funktionen `anon` ausführen darf (erwartet: **sechs**, die
      beabsichtigten) und ob die vier Objekte das Prädikat ohne `has_level(4)`
      tragen.
- [ ] Ohne diese Zeile gilt der PROD-Rechte-Zustand als **unbelegt** — so steht es
      ab jetzt in der Anforderung.

## Bekannte Falle beim Archivieren

Dieser Change **benennt Szenarien um** und ersetzt eine Anforderung per
`REMOVED` + `ADDED` (OpenSpec 1.6 kennt kein `RENAMED`). `openspec validate` ist
dabei grün; `openspec archive` kann daran abbrechen. Beim Archivieren einplanen.
