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
- [ ] **Gegenprobe im Test:** Recht erteilen → `true` messen → entziehen →
      `false` messen. Ohne sie ist auch die neue Zusage vakuum-grün.
- [ ] **Abgeschlossene Liste:** Zusage „genau diese Funktionen sind für `anon`
      ausführbar, keine andere" — als Menge, nicht als Aufzählung von Verstößen.
      Trifft die sechs beabsichtigten.
- [ ] **GREEN:** Migration `…_anon_execute_namentlich_entziehen.sql` —
      `revoke execute … from public, anon` für `search_directory`,
      `register_for_event`, `set_event_check_in`, `array_jaccard`,
      `fbc_profile_search_doc`.
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
- [ ] Die übrigen `has_level(4)`-Vorkommen unangetastet lassen
      (Kontaktanfrage-Schwelle, Event-Teilnahme) und im Diff nachweisen.

## 3. Der Menüeintrag

- [ ] **RED:** Test — `/aktivitaet` verlangt eine Sitzung.
- [ ] **GREEN:** `requiresAuth: true` in `src/config/nav.ts`. **Kein** `minTier` —
      das wäre nach AGE-601 falsch.

## 4. Abnahme

- [ ] Volle Suite grün · `tsc` sauber · `eslint` 0 Fehler · pgTAP alle Dateien
      (mit **Dateiliste**, sonst lügt `supabase test db`).
- [ ] **Mutationsprobe:** jede neue Zusage einzeln verbiegen und rot sehen.
      Vor jeder Verbiegung ein Commit, damit die Rücknahme nichts verwirft.
      „Muster fehlt" ist kein Grün — die Zeile „N skipped" mitlesen.
- [ ] **Sichtprobe** gegen den lokalen Stack: ein aktiviertes `basic`-Konto sieht
      den Feed gefüllt, mit Bildern und Zählern. Grüne Tests haben hier schon ein
      visuell falsches Ergebnis durchgewunken.
- [ ] Code-Review auf dem **Diff** (Stufe 2), Befunde abarbeiten.

## 5. Nach `migrate-prod` — der Schritt, dessen Fehlen der Fehler war

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
