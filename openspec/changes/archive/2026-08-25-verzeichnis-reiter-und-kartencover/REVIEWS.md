---
reviewers: [gemini, codex]
models: [nicht ausgewiesen, gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 07b2fd7454336e30010c0fa272856bae059fac32
---

# Change review — verzeichnis-reiter-und-kartencover (AGE-595)

Gelaufen am 2026-08-25 gegen die erste Fassung. `REVIEWER_TIMEOUT=900`, beide
Reviewer Exit 0. Mein eigener Vendor (Anthropic) war ausgeschlossen.

Beide Verdikte lauten REQUEST-CHANGES. Vier HIGH-Befunde habe ich am Code
nachgeprüft — **alle vier stimmen**, und einer davon hätte die Funktion zur
Laufzeit zerlegt.

## Reviewer: gemini (Modell nicht ausgewiesen)

VERDICT: REQUEST-CHANGES

- [HIGH] Client-seitige Filterung — der Client lädt das ganze Verzeichnis. Die
  aktuelle Größe und die Schwelle, ab der das kippt, werden nicht genannt.
- [MEDIUM] Such-/Filterzustand beim Reiterwechsel ist nicht festgelegt.
- [LOW] Der Leerzustand unterscheidet nicht zwischen „keine Kontakte" und
  „keiner passt zum Filter".

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES

- [HIGH] design.md — Die Abfrage benutzt `requester_id`/`recipient_id`; das
  Schema heißt `from_id`/`to_id`.
- [HIGH] proposal/spec — `/mitglieder` ist ab `discover` gesperrt, `basic` darf
  aber Kontaktanfragen annehmen. Diese Gruppe hat Kontakte und sieht keinen
  Reiter — im Widerspruch zu „ein neues Mitglied sieht einen Reiter mit einer
  Null".
- [HIGH] Impact/tasks — `MemberCard` wird auch von `AdminMitgliederPage`
  gespeist, und `admin_list_members` muss laut Spec dieselben Spalten liefern.
  `cover_url` nur in `search_directory` bricht Typen und Paritätstest.
- [HIGH] design/tasks — Kein identitätsgebundener Query-Key. Der globale
  `QueryClient` überlebt den Kontowechsel; Konto B sähe die Kontakte von A.
- [MEDIUM] tasks — Die RPC-Änderung bekommt nur eine Sichtprobe; `pnpm test`
  führt kein pgTAP aus, und `admin_member_list_test.sql` muss rot werden.
- [MEDIUM] design — Lade- und Fehlerfall der Kontaktabfrage fehlen; `undefined`
  würde als „0 Kontakte" gelesen.
- [MEDIUM] design — `cover_url` ist seit AGE-580 ein Pfad, kein URL. Ein Test
  mit `https://…` ist grün bei toten Bildern.
- [MEDIUM] design — Die Abhängigkeit zu AGE-596 ist nicht ausführbar
  beschrieben; die Karte ist dort keine „dritte Aufrufstelle", sondern eine
  zusätzliche Fläche ohne Landereihenfolge.
- [MEDIUM] spec — „keine sichtbare Karte" ist nicht „kein Kontakt".
- [MEDIUM] spec delta — Das Szenario schreibt `websearch_to_tsquery` fest,
  während die RPC seit dem 17.08. `suchbegriff_zu_tsquery` benutzt. Archiviert
  würde eine falsche aktuelle Wahrheit.
- [LOW] design — Die Begründung „der Filter liest die Kategorie-Arrays" ist
  falsch; die Optionen kommen aus `config/compass.ts`.

## Resolution

Alles angenommen. Vier Nachprüfungen am Code, alle bestätigend:

| Behauptung | Geprüft an | Ergebnis |
|---|---|---|
| Spalten heißen `from_id`/`to_id` | `dashboard.ts:194`, `20260614100000_contact_request_flow.sql` | bestätigt |
| `/mitglieder` ab `discover` | `config/nav.ts:78`, `nav.test.ts:66` | bestätigt |
| Admin speist dieselbe Karte | `AdminMitgliederPage.tsx:5,583`; Parität in `openspec/specs/admin/spec.md:488` | bestätigt |
| Query-Key ohne UID | `lib/directory.ts:180` | bestätigt |

- **`from_id`/`to_id`** — korrigiert. Der erste Entwurf hat ein Schema
  erfunden; die Abfrage wäre gescheitert. Steht jetzt als Warnung im Kopf von
  `design.md`, damit die Korrektur nicht wieder verloren geht.
- **`basic`** — angenommen, aber anders gelöst als vorgeschlagen: statt die
  Kontaktliste auf eine rangfreie Fläche zu heben, steht in der Anforderung
  eine ausdrückliche **Nicht-Zusage** samt Hinweis, dass `/kontakte` kein
  `minTier` trägt und der Ort dafür wäre. Der Grund: eine zweite Fläche zu
  bauen ist ein eigener Vorgang, und stillschweigend `basic` zu vergessen war
  der eigentliche Fehler — nicht, ihn nicht zu bedienen.
- **`admin_list_members`** — angenommen. Die Migration fasst jetzt beide
  Funktionen an, Tasks 1.2 und 1.4 samt der Zusage, dass der Paritätstest
  **vorher rot** sein muss. Ein Admin-Spec-Delta braucht es nicht: die
  Anforderung fordert Übereinstimmung, ohne Spalten aufzuzählen, und bleibt
  damit wahr.
- **Query-Key** — angenommen. `contactsQueryKey(uid)` plus Verwerfen beim
  Identitätswechsel, mit eigenem Szenario und Task 3.7. `directory-search`
  trägt dieselbe Regel bereits für Suchergebnisse.
- **pgTAP** — angenommen, Tasks 1.3–1.5, einschließlich `supabase test db`
  **mit Dateiliste** (ohne meldet der Befehl fälschlich FAIL).
- **Lade-/Fehlerfall** — angenommen und über den Befund hinaus ausgebaut: die
  Anforderung unterscheidet jetzt **fünf** Zustände statt zwei. Das deckt
  zugleich gemini [LOW] und codex' „keine sichtbare Karte" ab.
- **`bildUrl("covers", …)`** — angenommen, samt der Zusage, dass Fixtures
  Pfade tragen.
- **AGE-596-Abhängigkeit** — angenommen. Die Karte regelt ihr Bildfeld in
  **diesem** Change (3:1, eingepasst); AGE-596 schließt sie ausdrücklich aus.
  Damit gibt es keine Landereihenfolge.
- **`suchbegriff_zu_tsquery`** — angenommen, Szenario korrigiert. Bestätigt an
  `20260817180000_directory_praefixsuche.sql:37`.
- **Kategorie-Arrays** — angenommen, falsche Begründung entfernt. Sie bleiben
  aus API-Stabilität im Rückgabesatz, was jetzt als Entscheidung dasteht statt
  als Notwendigkeit.
- **gemini [HIGH] Skalierung** — angenommen, mit Zahl: heute **74** Zeilen. Die
  Schwelle ist ausdrücklich **nicht** eine Mitgliederzahl, sondern das Paging
  selbst: sobald `search_directory` pagiert, ist der Client-Schnitt falsch, weil
  er nur die geladene Seite sieht.

Nicht angenommen: nichts.

## Not counted

Keine. Beide Reviewer liefen mit Exit 0.
