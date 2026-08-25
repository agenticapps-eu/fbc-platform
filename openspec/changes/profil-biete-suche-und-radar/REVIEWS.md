---
reviewers: [gemini, codex]
models: [nicht ausgewiesen, gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 12a16a822374b51f0b1f21d17a1b02625a6c6f5e
---

# Change review — profil-biete-suche-und-radar (AGE-597)

Gelaufen am 2026-08-25, `REVIEWER_TIMEOUT=900`, beide Exit 0. Mein eigener
Vendor (Anthropic) war ausgeschlossen.

## Reviewer: gemini (Modell nicht ausgewiesen)

VERDICT: REQUEST-CHANGES

- [HIGH] Spec — „stehen als Marken nebeneinander" sagt nichts über den Umlauf
  bei schmalem Fenster.
- [MEDIUM] Impact — nimmt an, `PublicProfilePage` sei die einzige Ansicht, die
  `offers`/`needs` rendert.
- [LOW] Tasks 3.3 — die Präfix-Regel ist nicht robust; sie stützt sich auf einen
  Momentzustand des Bestands.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES

- [HIGH] Spec/Tasks 3.1 — `category` beschreibt nicht die Bauart. Der
  Rich-Editor verlangt eine Kategorie und erlaubt zugleich Titel und
  Beschreibung; nur `source` unterscheidet `chip` von `editor`.
- [HIGH] MODIFIED „Profilansicht folgt dem Mockup" / Task 3.4 — „endet mit den
  Eckdaten" ist mit dem geplanten Diff unvereinbar: Videos und `ContactArea`
  stehen danach, entfernt wird nur der Radar.
- [HIGH] Spec — „Titel ist Präfix" ist nicht deterministisch: der Import kürzt
  bei 80 Zeichen, ein gekürzter Titel ist kein wörtliches Präfix.
- [HIGH] Tasks 1.1 / 4.1–4.2 — „ohne Klarnamen" verhindert keine PII. Wörtliche
  Mitgliedertexte tragen Firmen, Orte, URLs; Screenshots einer Bestandsprüfung
  ebenso.
- [MEDIUM] Spec — Momentaufnahmen („0 von 19", leere `compass_responses") stehen
  im normativen Text wie Invarianten.
- [MEDIUM] `PublicProfilePage` — die Seite verspricht „Erfolgsradar … ab
  Discover sichtbar". Nach der Änderung ein falsches Produktversprechen.
- [MEDIUM] `PublicProfilePage.test.tsx` — zwei Tests benutzen den Radar als
  Nachweis der Discover-Sichtbarkeit; Löschen beseitigt einen Zugriffstest.
- [MEDIUM] `categoryLabel` — fällt bei unbekannten Kategorien auf den Schlüssel
  zurück (`future_key` → `Future_key`) und hält die SHALL-NOT-Zusage nicht.
- [MEDIUM] Task 3.4 — auf der öffentlichen Seite gibt es keine
  Radar-Komponente, sondern Inline-JSX; die Abfrage zu erhalten erzeugt einen
  ungenutzten Rundlauf. „Rückkehr eine Zeile" ist sachlich falsch.

## Resolution

Vier Nachprüfungen am Code, alle bestätigend:

| Behauptung | Geprüft an | Ergebnis |
|---|---|---|
| Es gibt eine Spalte `source` | `20260804200000_directory_search_categories.sql:41`; `information_schema` | bestätigt: `chip` \| `editor` |
| Videos stehen nach dem Radar | `PublicProfilePage.tsx` 269 → 299 → 325 | bestätigt |
| Seite verspricht den Radar ab Discover | `PublicProfilePage.tsx:105` | bestätigt |
| `categoryLabel` zeigt unbekannte Schlüssel | `config/matching.ts:137` | bestätigt |

- **`source` statt `category`** — angenommen, und es ist der wichtigste Befund.
  Auf PROD decken sich beide heute exakt (`chip` 19, alle mit Kategorie, keine
  mit Beschreibung; `editor` 93, umgekehrt) — aber das ist ein Zustand des
  Bestands, keine Zusage. Ein Editor-Eintrag mit Kategorie hätte unter der alten
  Regel seinen **Text verloren**. Spec und Tasks unterscheiden jetzt an
  `source`, plus eigenes Szenario für „Marke **mit** Beschreibung".
- **„endet mit den Eckdaten"** — angenommen, Satz zurückgenommen. Videos
  bleiben, eigenes Szenario dafür.
- **Präfix-Regel** — angenommen. Der Vergleich läuft nach Artefakt-Abschnitt und
  Trimmen gegen die erste nichtleere Zeile und wertet einen am Ende gekürzten
  Titel als Treffer. Deckt zugleich gemini [LOW].
- **PII in Fixtures** — angenommen, und der Punkt sitzt: dieses Repo ist
  öffentlich, und ein früherer Beinahe-Unfall mit 60 Klarnamen ist dokumentiert.
  Fixtures werden **selbst geschrieben**, die Formen nachgebildet, nicht die
  Inhalte; die Bestandsprüfung erzeugt keine Screenshots und keine
  Klartext-Notizen im Repo.
- **Momentaufnahmen im normativen Text** — teilweise angenommen. Die Zahlen
  bleiben stehen, weil sie die Entscheidung tragen, sind aber jetzt ausdrücklich
  als „Momentzustand des Bestands, keine Invariante" markiert, und die Regel
  hängt nicht mehr an ihnen.
- **Falsches Produktversprechen** — angenommen, Task 3.5 und eigenes Szenario.
- **Radar als Zugriffstest** — angenommen. Die beiden Tests werden auf ein
  anderes erweitertes Feld **umgestellt**, nicht gelöscht (Task 2.11).
- **`categoryLabel`-Fallback** — angenommen: bei unbekannter Kategorie entfällt
  die Marke, statt den Schlüssel zu zeigen.
- **Ungenutzter Rundlauf** — angenommen. Die Abfrage entfällt mit; die Zusage
  „Rückkehr ist eine Zeile" ist als falsch zurückgenommen.
- **gemini [HIGH] Umlauf** — angenommen, Task 2.4.
- **gemini [MEDIUM] weitere Ansichten** — geprüft, und die erste Antwort war zu
  knapp. `grep` findet **acht** Dateien; lebendig ist genau eine. Die
  Aufschlüsselung, damit der nächste Leser nicht erneut sucht:

  | Fundstelle | Zustand |
  |---|---|
  | `PublicProfilePage` | **lebendig** — die Fläche dieses Changes |
  | `MeineChancenPage` | nicht geroutet; `nav.ts:92` sagt, die Seite bleibe im Code, das Zurückholen sei „ein navItem plus …" |
  | `AngeboteGesuchePage` | ~~weder in `nav.ts` noch in `App.tsx`~~ — **falsch, korrigiert 25.08. nach der Code-Review** |
  | `MatchingWidget` (`kontakte-widgets.tsx:207`) | exportiert, **kein Importeur** — AGE-450 hat „Mein Matching" entfernt |
  | `ProfilPage:563` | Marken-**Auswahl**, keine Zeilendarstellung |
  | `OnboardingPage`, `WillkommenPage` | Auswahl während der Einrichtung |

  Kein Nachzug nötig. Der Umweg ist trotzdem lehrreich: eine `grep`-Zählung über
  dieses Repo enthält regelmäßig tote Flächen, und „acht Treffer" hätte hier zu
  sieben unnötigen Änderungen geführt.

  **NACHTRAG 25.08., nach der Code-Review auf den Diff: die Zeile zu
  `AngeboteGesuchePage` war falsch, und sie hat zwei Fehler durchgelassen.** Die
  Datei ist nicht geroutet — aber sie exportiert `AngeboteGesucheEditor`
  (`AngeboteGesuchePage.tsx:56`), und `CompassPage.tsx:80` hängt genau den als
  Reiter „Suche & Biete" unter `/kompass`, das in `nav.ts:107` steht. Der Editor
  ist also **lebendig**. Ich hatte den Namen der *Seite* gesucht und nicht den
  ihres Exports — dieselbe Falle wie „acht Treffer, eine lebendig", nur in die
  andere Richtung: eine Fläche kann unter einem anderen Namen leben.

  Die Folgen stehen unten unter „Zweite Runde".

Nicht angenommen: nichts.

## Not counted

Keine. Beide Reviewer liefen mit Exit 0.

## Zweite Runde — Code-Review auf den Diff (25.08.)

Vier Befunde, alle angenommen. Die ersten beiden hängen an demselben Irrtum
oben: der reiche Editor ist erreichbar, und er verlangt für **jede** Zeile
sowohl einen Titel (`min(1)`) als auch eine Kategorie aus der bekannten Liste
(`matching-profile.ts:20–47`), während `source` den Speicherlauf überlebt
(`matching-profile.ts:155`).

- **[MEDIUM] Eine `chip`-Zeile verliert ihren Titel bedingungslos.** Ein
  Mitglied wählt den Chip „Kapital", öffnet `/kompass` → „Suche & Biete" und
  schreibt in das Pflichtfeld „Eigenkapital bis 500k". Die Zeile bleibt `chip`,
  und die Profilseite zeigte nur noch die Marke. Angenommen: der Titel entfällt
  jetzt, wenn er den **Klartext der Kategorie wiederholt** — die tatsächliche
  Begründung der Anforderung —, nicht schon deshalb, weil die Zeile `chip` ist.
- **[LOW/MEDIUM] Eine `editor`-Zeile verlor ihre Kategorie.** Weil der Editor
  eine verlangt, bekommt jede Zeile beim ersten Speichern eine. Angenommen: die
  Markenreihe entsteht aus **jeder** Zeile mit bekannter Kategorie, unabhängig
  von `source`. Der Text hängt weiterhin nicht an `category` — der Kern von
  codex' erstem Befund bleibt unangetastet.
- **[LOW] Überschrift über nichts.** Eine `chip`-Zeile mit unbekannter Kategorie
  und ohne Beschreibung ergab eine leere Karte — gegen die bestehende
  Anforderung „Ein Abschnitt ohne Inhalt SHALL entfallen". Schlimmer: mein
  eigener Test hielt den Zustand fest. Angenommen: die Karte hängt jetzt daran,
  ob etwas erscheint, nicht an `offers.length > 0`.
- **[LOW] `.test()` auf einem `/g`-Regex im Prüfskript.** Zustandsbehaftet, also
  falsch-negative Zählungen. Angenommen — und lehrreich, weil ich genau diese
  Falle in der Umsetzung bewusst vermieden und im Skript wieder aufgemacht habe.

Was die neue Regel für den heutigen Bestand ändert: **nichts.** Alle 19
chip-Titel sind exakt der Kategoriename, keine der 93 Editor-Zeilen trägt eine
Kategorie. Die Regel ist damit nicht an einem Zustand gebaut, sondern an der
Begründung.
