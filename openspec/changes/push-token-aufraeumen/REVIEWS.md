---
reviewers: [gemini, codex]
models: [gemini-cli-vorgabe-nicht-ausgewiesen, gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 53719db57f04e7af43c67141ef454630dad0e1616e6fb08764e6b16b6f1c914a
---

# Change review — push-token-aufraeumen (AGE-682)

Zwei Fremdvendoren, beide nicht der Vendor dieses Hosts. Beide
REQUEST-CHANGES. **Die Review hat die tragende Annahme des Vorschlags
widerlegt** — das ist ihr ganzer Wert, und sie hat es getan, bevor eine Zeile
Code existierte.

Der Prompt trug Vorschlag, Entwurf, Aufgaben und Spec-Delta sowie die
Signaturen der bestehenden Objekte. Beide Reviewer haben zusätzlich im Repo
gemessen; codex hat dabei die Aufrufkette verfolgt.

## Reviewer: gemini

Modell: nicht ausgewiesen — der Wrapper pinnt für diesen Arm keines.

VERDICT: REQUEST-CHANGES

- **[HOCH] `push_tokens_aufraeumen` — Token mit `letzter_kontakt = NULL` werden
  nie gelöscht** — `letzter_kontakt < now() - p_frist` ist für `NULL` falsch. —
  *Fix: `coalesce`, besser `not null` am Schema.*
- **[NIEDRIG] Kein Index auf `letzter_kontakt`** — der Minutenlauf führt einen
  Full Table Scan. — *Fix: B-Tree-Index.*
- **[NIEDRIG] Der Testplan prüft die Verdrahtung nicht von vornherein** —
  Aufgabe 1 prüft die Funktion isoliert, die Integration wird erst über
  Mutation B nachgerüstet. — *Fix: den Integrationsfall schon in RED fordern.*

## Reviewer: codex

Modell: gpt-5.6-sol.

VERDICT: REQUEST-CHANGES

- **[HOCH] Die tragende Behauptung ist falsch: `claim_push_token()` läuft nicht
  bei jedem App-Start, sondern nur beim Öffnen der Nachrichten.** Ein Mitglied
  kann die App täglich nutzen und nach 180 Tagen sein funktionierendes Token
  verlieren.
- **[MITTEL] „Nicht vom Client geschrieben" ist nicht durchgesetzt** —
  `authenticated` hat tabellenweites `insert`/`update` und kann
  `letzter_kontakt` selbst setzen, auch in die Zukunft.
- **[MITTEL] Spec verlangt 180 Tage, die API erlaubt jeden Wert** — ein
  negativer löscht alles. Und die Begründung für den Parameter ist falsch:
  pgTAP kann Fixtures mit `now() - interval '181 days'` anlegen.
- **[MITTEL] `service_role` wird im Entzug nicht genannt**, obwohl das Repo
  rollen-eigene Default-Grants dokumentiert.
- **[MITTEL] „Zielt faktisch auf APNs" ist falsch** — die Bedingung hat keinen
  Plattformfilter und löscht Android 90 Tage vor dessen Selbstverfall.
- **[MITTEL] Die zugesagten Tests decken die zentralen Fälle nicht** — kein
  179/181-Grenzfall, kein unterdrückter fälliger Auftrag, kein `anon`-Entzug,
  kein Nachweis über `claim_push_token` statt direktem `update`.
- **[MITTEL] Die „dieselbe Minute"-Zusage gilt nur für einen Aufruf von
  `push_auftraege_faellig()`** — `push_auftraege_holen()` bleibt unverändert;
  die Kaskade kann eine laufende Zustellzeile entfernen, und die spätere
  Quittung trifft dann null Zeilen, ohne das zu bemerken.
- **[MITTEL] Kein Index mit `token_id` als erster Spalte auf
  `push_zustellungen`** — der Primärschlüssel beginnt mit `notification_id`;
  die Kaskade scannt.
- **[MITTEL] Der Verweis auf AGE-679 als Beobachtung ist sachlich falsch** —
  jener Wächter fragt `push_tokens` gar nicht ab, `perform` verwirft die
  Löschzahl, und die Kaskade vernichtet genau die Zeilen, auf die er sieht.
- **[NIEDRIG] Firebases Beispiel sind 30 Tage, nicht 60**, und die Seite
  verlangt ein **monatliches** Erneuern des Zeitstempels.
- **[NIEDRIG] „Keine breaking changes" ist falsch** — das Löschen eines
  gültigen Tokens ist eine zustellungsbrechende Verhaltensänderung.

## Not counted

Keiner. Beide Arme liefen mit Exit 0 innerhalb `REVIEWER_TIMEOUT=900`.

## Resolution

### Nachgemessen und **verworfen**

- **gemini [HOCH] NULL-Werte.** Falsch. `letzter_kontakt timestamptz **not
  null** default now()` (`20260827210000_push_tokens.sql:41`). Der Zustand kann
  nicht entstehen; das vom Reviewer selbst vorgeschlagene Härten ist bereits da.
  Kein `coalesce`. (Der Reviewer hat den Fix vorgeschlagen, den das Schema schon
  enthält — die Datei lag ihm nicht vor.)
- **codex [HOCH], Teilaussage „widerspricht der bestehenden Spec".** Überzogen.
  Die Anforderung lautet, die **Erlaubnis** SHALL NOT beim Start *angefordert*
  werden (`push-fundament/specs/notifications/spec.md:330-332`, Szenario „Der
  Start fragt nicht"). Ein stilles Erneuern eines **bereits erteilten** Tokens
  fordert nichts an. Der Hauptbefund bleibt davon unberührt und ist bestätigt.

### Nachgemessen und **übernommen**

- **codex [HOCH] — der Befund, der den Zuschnitt ändert.** Selbst verfolgt:
  `claim_push_token` wird nur aus `src/lib/push.ts:69` gerufen, das aus
  `pushEinrichten()` kommt, das in `AppShell.tsx:619-632` an `nachrichtenOffen`
  hängt und dort hinter einem Riegel steht, der **einmal je Konto** fällt.
  `letzter_kontakt` misst damit „wann zuletzt die Nachrichten geöffnet wurden",
  nicht Leben.

  **Die Behauptung stammt aus dem Spaltenkommentar der Migration selbst**
  (`20260827210000:55-57`: „Gepflegt von `claim_push_token()` bei jedem Start").
  Der Kommentar ist falsch; ich habe ihn übernommen, statt den Aufrufer zu
  messen.

  **Folge (Donald, 01.09.): AGE-682 bekommt beide Hälften.** Ein stilles
  Erneuern bei jedem nativen App-Start mit bereits erteilter Erlaubnis, und
  darauf der Aufräumer. Firebase verlangt für dieses Verfahren ohnehin ein
  monatliches Erneuern — der Befund und die Primärquelle zeigen in dieselbe
  Richtung. Der Spaltenkommentar wird mitkorrigiert.
- **codex [MITTEL] Parameter.** Übernommen: `p_frist` entfällt, 180 Tage stehen
  in der Funktion. Die Begründung für den Parameter war falsch — der Test altert
  die **Fixtures**, nicht die Frist. Damit entfällt auch der negative Wert.
- **codex [MITTEL] `service_role`.** Übernommen, samt Zusage im Test.
- **codex [MITTEL] „zielt faktisch auf APNs".** Übernommen als Korrektur des
  Wortlauts: eine einheitliche Frist für beide Plattformen, ausdrücklich
  benannt, mit Android in der Abnahme.
- **codex [MITTEL] Tests.** Übernommen: Grenzfall 179/181, unterdrückter
  fälliger Auftrag, `anon` **und** `service_role`, und das Lebenszeichen
  entsteht im Test über `claim_push_token`, nicht über ein direktes `update`.
- **codex [MITTEL] „dieselbe Minute".** Übernommen als Einschränkung des
  Wortlauts auf „im selben Fälligkeitslauf", mit dem `push_auftraege_holen`-Weg
  ausdrücklich benannt.
- **codex [MITTEL] AGE-679-Verweis.** Übernommen: der Verweis war falsch und
  fällt weg. Die fehlende Beobachtbarkeit steht als benanntes Restrisiko.
- **codex [NIEDRIG] Firebase 30 statt 60.** Übernommen, an der Primärquelle
  nachgeprüft: `EXPIRATION_TIME = … * 30`, und „once per month strikes a good
  balance". Die 60 stammten aus einer Suchzusammenfassung, nicht aus der Seite.
- **codex [NIEDRIG] „keine breaking changes".** Übernommen.
- **gemini [NIEDRIG] Testplan.** Übernommen, deckungsgleich mit codex' Punkt.

### Übernommen, aber nicht in diesem Vorgang

- **codex [MITTEL] Index auf `push_zustellungen(token_id)`** und **gemini
  [NIEDRIG] Index auf `letzter_kontakt`.** Beide Befunde stimmen sachlich —
  es gibt nur `push_tokens_profile_id_idx`, und der Primärschlüssel beginnt mit
  `notification_id`. Bei **1 Zeile auf PROD und 2 auf DEV** ist ein Index
  Ballast, den ein Leser für eine gemessene Notwendigkeit hielte. Als benannte
  Anschlussfrage in den Entwurf, mit der Schwelle, ab der sie zu messen ist.

### Was der Trailer NICHT behauptet

Der `digest` unten deckt die Artefakte in ihrem **heutigen** Stand. Gelesen
haben die Reviewer die **erste** Fassung — deren Prompt-Hash steht oben als
`reviewed_artifacts_sha` und ist der ehrlichere der beiden Werte. Die
Überarbeitung ist die Folge ihrer Befunde und wurde ihnen nicht erneut
vorgelegt.

Das ist bewusst so und keine Nachlässigkeit: eine zweite Runde auf demselben
Plan hätte den Befund bestätigt, den die erste schon gefunden hat. Was den
überarbeiteten Zuschnitt prüft, ist die Review auf den **Diff** (Schritt 4) —
und die liest, was tatsächlich gebaut wurde, nicht was geplant war.

<!-- openspec-review-trailer v1
implementing-host: claude
digest: sha256:e2ee0c53753b0a40fba45c839dd0c9ededce6ec50e6a0cd486ab84238fdc0e7d
producer-version: 1.2.0
tasks-digest: sha256:717b7903ca95dfbe6783ca861f307ebf641a0998c4eead1f3ddf932c453bd4dd
-->
