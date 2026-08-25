## Why

Zwei Befunde aus der Abnahme von AGE-595 (25.08.2026), zusammen in einem PR, weil
sie dieselbe Stelle des Systems betreffen — **wer darf was sehen** — und ein
gemeinsamer Review beide tragen muss. Sie ziehen dabei ausdrücklich in
entgegengesetzte Richtungen: der eine entzieht ein Recht, der andere weitet eines
aus.

**AGE-602 — `revoke … from public` entfernt den `anon`-Grant nicht.**
`search_directory` ist in PROD für `anon` ausführbar, obwohl `directory-search`
das Gegenteil zusichert und `directory_search_test.sql` es lokal **grün** prüft.
Ursache sind die Default Privileges dieser Instanz, die `anon` ausdrücklich
`EXECUTE` gewähren; `revoke … from public` entfernt einen rollen-eigenen Grant
nicht. Am PROD-Katalog gemessen (26.08.), nicht aus den Migrationen geschlossen:
**elf** Funktionen sind für `anon` ausführbar, **sechs davon mit Absicht**
(`grant … to anon, authenticated`: `event_cover_lesbar`,
`event_registration_counts`, `post_engagement_counts`, `post_media_lesbar`,
`feed_tag_counts`, `suchbegriff_zu_tsquery`). Die übrigen **fünf** sind der
Fehler:

| Funktion | Absicht laut Migration | Sicherheit |
|---|---|---|
| `search_directory` | `revoke all from public` + `grant to authenticated` | invoker |
| `register_for_event` | nur `grant to authenticated`, **kein revoke** | **definer, schreibend** |
| `set_event_check_in` | nur `grant to authenticated`, **kein revoke** | **definer, schreibend** |
| `array_jaccard` | gar keine Grant-Zeile | invoker |
| `fbc_profile_search_doc` | gar keine Grant-Zeile | invoker |

**Kein Datenabfluss.** `search_directory` läuft als `security invoker` und bricht
für `anon` mit `42501 permission denied for table profiles`. Die beiden
schreibenden `SECURITY DEFINER`-Funktionen führen beide `is_activated()`, und das
liefert ohne Sitzung per `coalesce` `false` — **am Katalog belegt** (26.08.), nicht
am Quelltext gelesen, wie es die erste Notiz tat. `array_jaccard` und
`fbc_profile_search_doc` rechnen nur über ihre Argumente und lesen keine Tabelle.
Die Preisgabe ist also Tiefenstaffelung, keine offene Tür — aber sie ist unbeabsichtigt,
und der grüne Test hat sie zwei Monate verdeckt.

**AGE-601 — `members` heißt ab jetzt „alle Aktivierten".**
Donald hat am 25.08. entschieden. Heute verlangt `posts_select_by_visibility` für
`visibility = 'members'` zusätzlich `has_level(4)` (`exchange`). In PROD trägt
**jeder** Beitrag `members`, kein einziger ist `public` — unter Rang 4 ist der Feed
also nicht dünner, sondern **leer**. Der Preis ist ausdrücklich in Kauf genommen:
die Anmeldung bleibt offen, `basic` ist der Selbstregistrierungs-Rang, und die
Aktivierung wird damit die einzige Hürde vor dem Feed. Die Variante „Anmeldung
zusätzlich schließen" wurde erwogen und **nicht** gewählt. Das kippt AGE-311 an
dieser einen Stelle.

**Der Nebenbefund ist der eigentliche Auslöser.** `/aktivitaet` trägt in
`src/config/nav.ts` weder `minTier` noch `requiresAuth` — anders als `/mitglieder`.
Die Fläche lädt heute jedes Mitglied ein und kann ihm nichts zeigen. Nach AGE-601
stimmt das Versprechen des Menüeintrags zum ersten Mal.

## What Changes

**AGE-602 — der Entzug wird namentlich ausgesprochen.**

- Eine Migration entzieht `execute` für die fünf Funktionen `from public, anon` —
  `anon` **namentlich**, so wie `admin_list_members` es schon richtig macht. Das
  macht das Ergebnis unabhängig davon, was die Default Privileges der jeweiligen
  Instanz gewähren.
- Die falsche Zusage in `directory-search` wird korrigiert. Ihre Begründung
  („kein Recht wurde auf die neue Signatur vererbt") ist **nachweislich falsch** —
  genau das ist passiert. Die neue Fassung sichert den **Rechte-Zustand** zu, nicht
  das Ergebnis eines Aufrufs.
- Die pgTAP-Zusage prüft ab jetzt das **Privilegien-Bit**
  (`has_function_privilege('anon', …, 'execute')`) statt einer Fehlermeldung, und
  bringt eine **Gegenprobe** mit: sie erteilt das Recht im Test, misst `true`,
  entzieht es, misst `false`. Ohne die Gegenprobe wäre auch die neue Zusage
  vakuum-grün — lokal hält `anon` das Recht ohnehin nicht.
- **Der lokale Test kann PROD-Abweichung prinzipiell nicht sehen.** Das wird in der
  Anforderung ausgesprochen statt kaschiert; der Beleg für PROD ist eine
  Katalog-Messung nach `migrate-prod`, die in `tasks.md` mit Zahlen landet.

**AGE-601 — `members` gilt für jedes aktivierte Mitglied.**

- Der Zweig `visibility = 'members' and has_level(4)` wird zu `visibility = 'members'`.
  `is_activated()` steht in jedem dieser Prädikate bereits davor und bleibt die Hürde.
- Das Prädikat liegt an **vier** Stellen, am PROD-Katalog abgezählt (nicht aus den
  Migrationen geschätzt): Policy `posts_select_by_visibility` sowie die Funktionen
  `post_engagement_counts`, `post_media_lesbar` und `former_member_entries`. Alle
  vier ändern sich **in einer Migration**; drei davon zu ändern und eine zu
  vergessen ergäbe einen Feed, dessen Zähler oder Bilder nicht zu seinen Zeilen
  passen.
- `feed_tag_counts` und `feed_top_authors` sind `security invoker` und tragen
  **keine** Abschrift — sie ändern sich mit, ohne angefasst zu werden. Das ist die
  Probe aufs Exempel für die Regel in `community-feed`, dass Abschriften zu
  vermeiden sind.
- Die übrigen `has_level(4)`-Vorkommen bleiben **unangetastet**: die
  Kontaktanfrage-Schwelle und die Event-Teilnahme sind eigene Entscheidungen und
  nicht Gegenstand von AGE-601.

**Der Menüeintrag sagt die Wahrheit.**

- `/aktivitaet` bekommt `requiresAuth: true` in `src/config/nav.ts`. Ein `minTier`
  wäre nach dieser Änderung **falsch** — der Feed ist ab jetzt für jedes aktivierte
  Mitglied gefüllt, und eine Stufenwand davor widerspräche der Entscheidung.

## Impact

- **Betroffene Specs:** `directory-search` (anon-Rechte), `community-feed`
  (Sichtbarkeit, Zähler, Bilder), `access-control` (die Grant-Regel als solche).
- **Migrationen:** zwei, absichtlich getrennt — ein Rechte-Entzug und eine
  Sichtbarkeits-Ausweitung sind je für sich zurücknehmbar.
- **`membership-tiers`/AGE-311:** an genau einer Stelle gekippt. `exchange` bleibt
  die Schwelle für Kontaktanfragen und Event-Teilnahme.
- **Kein Frontend-Verhalten ändert sich** außer dem einen Nav-Feld; die RLS liefert
  ab jetzt mehr Zeilen an dieselben Abfragen.
