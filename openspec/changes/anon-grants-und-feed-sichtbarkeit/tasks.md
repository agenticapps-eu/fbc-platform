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

- [ ] **RED:** `directory_search_test.sql` §7 auf das **Privilegien-Bit**
      umstellen (`has_function_privilege('anon', …::regprocedure, 'execute')`),
      plus die vier weiteren Funktionen. Muss vor der Migration **rot** sein —
      und wenn es lokal grün ist, ist das der Beweis, dass die Zusage allein
      nichts belegt (siehe nächste Aufgabe).
- [ ] **Gegenprobe auf einer Wegwerf-Funktion** (nicht auf einer echten):
      anlegen → messen, dass `anon` sie **nicht** darf (belegt den neuen Default)
      → Recht erteilen → `true` messen → entziehen → `false` messen. Auf einer
      echten Funktion belegte die Gegenprobe nur, dass `has_function_privilege`
      den Katalog liest.
- [ ] **Abgeschlossene Liste:** Zusage „genau diese Funktionen sind für `anon`
      ausführbar, keine andere" — als Menge, nicht als Aufzählung von Verstößen.
      Trifft die sechs beabsichtigten.
- [ ] **GREEN:** Migration `…_anon_execute_namentlich_entziehen.sql` —
      `revoke execute … from public, anon` für `search_directory`,
      `register_for_event`, `set_event_check_in`, `array_jaccard`,
      `fbc_profile_search_doc`.
- [ ] **`PUBLIC` bei den beiden beabsichtigten entfernen:**
      `post_engagement_counts` und `event_registration_counts` tragen `=X/postgres`
      neben den benannten Rollen (lokal gemessen). `revoke … from public` plus
      ausdrücklicher `grant to anon, authenticated` — sonst behauptet die
      Anforderung „ausdrücklich erteilt", wo geerbt wurde.
- [ ] Prüfen, ob `grants_test.sql` durch die neue Liste bricht
      (Golden-Snapshot-Falle).

## 2. AGE-601 — die Ausweitung (RED zuerst)

- [ ] **RED:** pgTAP — ein aktiviertes Mitglied unter Rang 4 liest einen fremden
      `members`-Beitrag, bekommt seine Zählzeile und darf sein Bild signieren.
      Drei Zusagen, alle rot vor der Migration.
- [ ] **RED:** ein bestätigtes, **nicht** aktiviertes Konto bekommt weiterhin
      nichts — die Gegenrichtung, sonst belegt die Ausweitung nur, dass etwas
      offener wurde.
- [ ] **GREEN:** Migration `…_members_sind_alle_aktivierten.sql` — alle **vier**
      Objekte in einer Datei. Drei zu ändern und eine zu vergessen ergäbe einen
      Feed, dessen Zähler nicht zu seinen Zeilen passen.
- [ ] `feed_tag_counts` / `feed_top_authors` **nicht** anfassen und belegen, dass
      sie trotzdem folgen (`security invoker`) — das ist der Nutzen der
      Nicht-Abschreiben-Regel.
- [ ] **Alle vier Kopien einzeln zusichern**, nicht nur die Policy:
      `former_member_entries`, `post_media`-Zeilen, Kommentare und der
      gespiegelte Event-Beitrag. Plus `feed_tag_counts`/`feed_top_authors` als
      Beleg, dass die nicht abgeschriebenen Wege von selbst folgen.
- [ ] Die übrigen `has_level(4)`-Vorkommen unangetastet lassen
      (Kontaktanfrage-Schwelle, Event-Teilnahme) und im Diff nachweisen.

## 3. Der Menüeintrag — entfällt

- [x] **Gestrichen nach dem Plan-Review.** `community-feed` legt ausdrücklich fest,
      dass `/aktivitaet` weder `requiresAuth` noch `minTier` trägt; `App.tsx:37`
      machte aus `requiresAuth` eine Wand vor dem ausgeloggten Schaufenster.
      `src/config/nav.ts` wird **nicht** angefasst.
- [ ] Stattdessen: die zwei veralteten **Kommentare** in `src/lib/feed.ts`
      (Zeilen 13, 338) auf die neue Regel bringen.

## 4. Abnahme

- [ ] Volle Suite grün · `tsc` sauber · `eslint` 0 Fehler · pgTAP alle Dateien
      (mit **Dateiliste**, sonst lügt `supabase test db`).
- [ ] **Mutationsprobe:** jede neue Zusage einzeln verbiegen und rot sehen.
      Vor jeder Verbiegung ein Commit, damit die Rücknahme nichts verwirft.
      „Muster fehlt" ist kein Grün — die Zeile „N skipped" mitlesen.
- [ ] **Sichtprobe** gegen den lokalen Stack: ein aktiviertes `basic`-Konto sieht
      den Feed gefüllt, mit Bildern und Zählern. Grüne Tests haben hier schon ein
      visuell falsches Ergebnis durchgewunken.
- [ ] **Bestehende Gegen-Zusagen suchen und umdrehen:** `rls_test.sql` erwartet
      heute ausdrücklich, dass Rang 1 Medienzeilen, Bilder und gespiegelte
      Event-Beiträge **nicht** bekommt. Diese Zusagen namentlich auflisten, bevor
      eine geändert wird — eine übersehene macht die Suite rot und eine
      stillschweigend gelöschte macht sie wertlos.
- [ ] **Nutzlast messen** für ein `basic`-Konto (gemini MEDIUM): der Feed pagiert,
      die Zahl gehört trotzdem gemessen statt behauptet.
- [ ] Code-Review auf dem **Diff** (Stufe 2), Befunde abarbeiten.

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
