---
reviewers: [gemini, opencode]
models: [gemini-3-pro, hf:moonshotai/Kimi-K3]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 546e9e283538b5c7
---

# Change review — activity-media-and-tags (AGE-528)

Schritt 2b, vor der ersten Zeile Code. Zwei zählende Anbieter, beide **nicht**
der Verfasser des Deltas.

## Reviewer: gemini (gemini-3-pro)

VERDICT: REQUEST-CHANGES

- [MEDIUM] `post_media` — keine Eindeutigkeit auf der Reihenfolge; zwei Bilder
  desselben Beitrags können dasselbe `sort` tragen — `unique (post_id, sort)`.
- [MEDIUM] `post_media_lesbar` — die Funktion müsste die Beitragskennung aus
  dem Pfad schneiden; ein gefälschter Pfad umginge damit die Zugriffskontrolle
  — Parsen festlegen und testen, oder den Pfad gar nicht erst zerlegen.
- [MEDIUM] `shrinkToWebp` — kein Fehlerpfad; scheitert die Umwandlung, läuft
  der Nutzer in einen späten, nichtssagenden Serverfehler am Bucket-Limit —
  sofort und konkret melden, gar nicht erst hochladen.
- [LOW] Upload vor Beitragsanlage erzeugt Objekte, die **nie** eine Zeile
  hatten — anderer Fall als das benannte „abgelöste" Objekt, gehört benannt.
- [LOW] Die 1-h-Nachlaufzeit bei einem Sichtbarkeitswechsel ist eine
  Produktentscheidung und gehört Detlev gesagt, nicht nur dem Migrationskopf.

## Reviewer: opencode (hf:moonshotai/Kimi-K3)

VERDICT: REQUEST-CHANGES

- [MEDIUM] Kein Schreibweg für **geklickte** Tags. `createPost` setzt heute nur
  `parseHashtags(body)`; getippt + geklickt braucht Vereinigung mit
  Deduplizierung, sonst steht derselbe Tag zweimal drin.
- [MEDIUM] Der Video-Link hat keine benannte Speicherung. „posts-Schema nicht
  betroffen" heißt: er muss in den Body — aber wie, und wie verträgt sich das
  mit `skipRaw`?
- [MEDIUM] Veröffentlichen ist nicht atomar: Beitrag → Uploads → Bildzeilen.
  Bricht es dazwischen ab, steht ein bildloser Beitrag im Feed.
- [MEDIUM] „Höchstens sechs" ist eine Zählung über andere Zeilen — als `check`
  nicht ausdrückbar, das braucht einen Trigger.
- [MEDIUM] Cursor über `created_at` allein überspringt Beiträge bei gleichen
  Zeitstempeln — beim Import von ~70 Konten wahrscheinlich.
- [LOW] Die Sonde misst Erlaubnis, nicht Laufzeit — 120 Pfade × Funktion mit
  Join sollte einmal gemessen sein.
- [LOW] Die RLS von `post_media` selbst steht nur in den Tasks, nicht im Delta.
- [LOW] Die Zusicherung in 4.1 ist unpräzise — nach dem Fix liefert
  `getAllByText` **zwei** Treffer.
- [LOW] Zwischen `staleTime` 50 min und Ablauf 60 min liegt ein Fenster, in dem
  ein offener Tab eine abgelaufene URL hält.
- [LOW] `createSignedUrls` kann einzelne Pfade ablehnen — je Bild behandeln.

**Unausgesprochene Annahmen** (Auswahl): der Feed sei ohne Session überhaupt
erreichbar · `parseHashtags` sei der einzige Schreibweg in `hashtags` · das
Prädikat von `posts_select_by_visibility` sei wie zitiert · der lokale Stack
entspreche DEV.

## Nicht gezählt

- **codex** — exit 4, Zeitüberschreitung bei 600 s. Ersetzt durch `opencode`,
  das auf `hf:moonshotai/Kimi-K3` auflöst und damit ein anderes Modell ist als
  `gemini` (Regel 4).

## Auflösung

**Übernommen, mit Änderung an den Artefakten:**

| Befund | Was geändert wurde |
|---|---|
| Pfad-Parsing (gemini, MEDIUM) | `post_media_lesbar` sucht die Zeile über `storage_path` und **zerlegt den Pfad nie**. Neuer Abschnitt in `design.md`, verschärftes SHALL + zwei Szenarien im Delta, Task 2.7/2.7a. Der Befund war schärfer als er klang: die INSERT-Policy prüft nur den **ersten** Pfadabschnitt, alles dahinter ist frei wählbar. |
| Atomarität (opencode, MEDIUM) | Ablauf umgedreht: Beitrags-`id` im Client, Upload zuerst, dann **eine** RPC `create_post_with_media` in einer Transaktion. `design.md` neuer Abschnitt, Requirement + Szenario im Delta, Tasks 2.12/2.12a. |
| Tag-Vereinigung (opencode, MEDIUM) | `design.md` neuer Abschnitt, SHALL + Szenario im Delta, Task 6.4a. Hängt an den Schlüssel-Constraints — ohne gleiche Normalisierung greift die Deduplizierung nicht. |
| Video-Speicherung (opencode, MEDIUM) | Der bestehende Weg wird ausgesprochen statt vorausgesetzt: Anhängen an den Body wie in `CommunityFeed.tsx:104–108`, Unterdrücken über `skipRaw`. Kein neues Feld. SHALL im Delta, Task 6.3. |
| Sechser-Grenze als Trigger (opencode, MEDIUM) | Task 2.5 umformuliert. Der Wettlauf ist hier unerheblich, weil die RPC alle Zeilen in einer Anweisung schreibt. |
| Cursor `(created_at, id)` (opencode, MEDIUM) | Tasks 5.5/5.7. |
| `unique (post_id, sort)` (gemini, MEDIUM) | Task 2.2 — dazu **`unique (storage_path)`**, das die Funktion aus 2.7 überhaupt erst eindeutig macht. |
| `shrinkToWebp`-Fehlerpfad (gemini, MEDIUM) | Task 5.1a. |
| RLS von `post_media` im Delta (opencode, LOW) | SHALL + Szenario ergänzt. |
| Zusicherung in 4.1 (opencode, LOW) | Exakt ausgeschrieben: zwei Vorkommen, genau eines anklickbar. |
| Ablauf-Fenster + Teilablehnung (opencode, LOW) | `design.md` und Tasks 5.2a/5.3. |
| Laufzeit von 120 Signaturen (opencode, LOW) | Task 1.0b. |
| Sonde auch gegen DEV (opencode, Annahme) | Task 1.0c. |
| Nie angehängte Objekte (gemini, LOW) | Non-goal im Proposal umformuliert — beide Spielarten benannt. |
| Nachlaufzeit für Detlev (gemini, LOW) | In `design.md` in Produktsprache übersetzt. |

**Geprüft statt angenommen:**

- **„Der Feed ist ohne Session erreichbar."** Die schwerwiegendste der
  genannten Annahmen — hielte sie nicht, wäre der ganze anon-Lesepfad toter
  Code. **Sie hält:** `src/config/nav.ts:75` trägt weder `requiresAuth` noch
  `minTier`, `App.tsx:41` reicht das Element ungeschützt durch. Als erledigte
  Task 1.0a festgehalten.
- **Das Prädikat von `posts_select_by_visibility`** stimmt mit dem zitierten
  überein — nachgelesen in `20260806080100_activation_gate.sql:157–168`:
  `is_activated()` und (`public` oder `members` mit `has_level(4)` oder
  Autorschaft).
- **`fetchFeed` sortiert `created_at` absteigend** — `src/lib/feed.ts:292`.

**Nicht übernommen:**

- **Uploads in einen Zwischenbereich mit Aufräum-Cron** (gemini, LOW). Der
  umgedrehte Ablauf löst das eigentliche Problem — es entsteht kein halber
  Beitrag mehr —, und die verbleibenden Objekte sind für niemanden abrufbar.
  Ein zweiter Bereich plus Cron wäre Infrastruktur für Speicherplatz, den
  70 Mitglieder nicht füllen. Bleibt Non-goal, wie bei `avatars` und `covers`.
- **`database.types.ts` generieren statt von Hand pflegen** (gemini, Annahme).
  Bewusst so, seit AGE-249/AGE-358/AGE-498: die CLI schreibt die Datei stillos
  um und bricht rund zwanzig Testfixtures. Eigener Change, nicht dieser.
- **Bestandswerte in `hashtags` gegen die neuen Schlüsselregeln prüfen**
  (opencode, Annahme). Die Regeln gelten für `tags.key`, nicht für
  `posts.hashtags` — ein Altwert wird höchstens als freier Tag dargestellt,
  was korrekt ist. Für den Import in C10 als Notiz weitergereicht: jeder
  Schreibweg in `hashtags` muss dieselbe Normalisierung verwenden.
