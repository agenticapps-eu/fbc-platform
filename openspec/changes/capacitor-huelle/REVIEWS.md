---
reviewers: [gemini, opencode]
models: [gemini (CLI wies kein Modell aus), hf:moonshotai/Kimi-K3]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 8eca74039d9176e9272ffaf1e3b2318e1e2ff7c29b00b431aa16017edeba3171
---

# Change review — capacitor-huelle (AGE-642)

Zwei zählende Stimmen fremder Anbieter, beide vor der ersten Codezeile. Der
eigene Anbieter (`claude`) hat nicht geprüft.

## Reviewer: gemini
VERDICT: REQUEST-CHANGES

- [HIGH] design.md §1 — Der Sitzungsausweis läge im Klartext auf dem Gerät. Der
  Entwurf benennt das und empfiehlt es trotzdem; eine Sicherheitsentscheidung
  gehört aber ausdrücklich freigegeben, nicht nur notiert. — Fix: als
  Freigabepunkt führen.
- [MEDIUM] design.md §8 / tasks D — Die „Vertragsnummer der Schale" ist ein
  Versprechen ohne Verfahren: weder Feld noch Stempelstelle noch Inkrement-Regel
  sind festgelegt.
- [LOW] tasks C3 — Die Kamera ist der einzige native Punkt ohne Geräte-Beleg,
  obwohl gerade dort native Oberfläche im Spiel ist.

## Reviewer: opencode (hf:moonshotai/Kimi-K3)
VERDICT: REQUEST-CHANGES

Hat die prüfbaren Behauptungen vor dem Urteil im Repo nachgemessen und die
Korrekturen am Issue bestätigt.

- [HIGH] tasks C3 / design §7 — Kamera-Berechtigungen fehlen vollständig:
  `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, dazu das
  Android-Manifest. **Laufzeit-Absturz**, nicht erst Store-Prüfung.
- [HIGH] tasks D — Die Veröffentlichungsseite des OTA existiert nicht: kein
  Schritt erzeugt, signiert und lädt je ein Bündel hoch, und kein Anlass ist
  benannt. Die zentrale Spec-Zusage wäre per Konfiguration unerfüllbar.
- [HIGH] tasks A2 — Der *strukturelle* Nachweis ist nicht überprüfbar getaskt.
  Beleg war „dieselbe Messung", also eine Zahl — genau das, wovor die Spec
  selbst warnt.
- [HIGH] tasks C2 — `@capacitor/app` wird gebraucht, aber in keiner Phase
  installiert. Der RED-Test könnte nie grün werden.
- [MEDIUM] spec native-shell vs. tasks A2 — Widerspruch, was im ersten Paint
  liegt.
- [MEDIUM] design §8 — Die eigene Behauptung „ohne beides überhaupt keine
  Integritätsprüfung" ist falsch. Eine Prüfsumme prüft Integrität; was fehlt,
  ist Echtheit.
- [MEDIUM] tasks A1 — `storageKey` bleibt Bibliotheks-Default; ein Minor-Upgrade
  meldete alle Web-Mitglieder ab, und kein geplanter Test fängt das.
- [MEDIUM] design §8 / tasks D — Apples Richtlinie 2.5.2 und das Dritt-Plugin
  **im Aktualisierungsweg** sind unbenannte Abwägungen.
- [LOW] design §3 / tasks B2 — Der Geheimnis-Wächter sieht die Historie nicht.
- [LOW] Voraussetzungen — `PrivacyInfo.xcprivacy` fehlt in der Liste.
- [LOW] proposal — Die Zurechnungstabelle ist nicht summenstabil (~199 kB
  unbenannt).
- [LOW] tasks C2 — Testumgebung unklar: `backButton` feuert in jsdom nie.

## Aus dem ersten, abgebrochenen opencode-Lauf zusätzlich übernommen

Der erste Lauf lief in die 300-Sekunden-Grenze und zählt darum nicht als Stimme.
Zwei seiner Befunde standen aber vollständig da und sind eingearbeitet:

- [HIGH] `notifyAppReady()` und der Rückweg fehlen ganz. Ein **signiertes und
  gültiges**, aber defektes Bündel brächte jedes Gerät dauerhaft zum Stillstand.
- [HIGH] tasks B3 — Der native Workflow hatte kein Signatur-Setup; ohne das ist
  auch die Geräte-Abnahme in Phase E unerreichbar.
- [MEDIUM] tasks A2 — „Bestehende Tests laufen unverändert durch" war Hoffnung
  als Aufgabe formuliert.
- [MEDIUM] Proposal nannte drei Fragen offen, während das Spec-Delta sie bereits
  als `SHALL` entschied.

## Nicht gezählt

- **codex** (`gpt-5.6-sol`) — Zeitüberschreitung nach 300 s, **ohne Verdikt**.
  Der Arm hat den Change in ein temporäres Verzeichnis kopiert, das
  Route-Splitting dort prototypisch gebaut und anschließend selbst
  `reviewer-cli.sh gemini` **und `reviewer-cli.sh claude`** gestartet — der
  zweite ist der eigene Anbieter dieses Hosts und nach Regel 2 ausgeschlossen.
  325 kB Ausgabe, kein `VERDICT`. Dieselbe Delegation wie am 26.08.
- **opencode, erster Lauf** — Zeitüberschreitung nach 300 s (Standardfrist), der
  letzte Befund brach mitten im Satz ab. Wiederholt mit `REVIEWER_TIMEOUT=900`;
  dieser zweite Lauf ist die gezählte Stimme.

## Resolution

| Befund | Erledigt |
| --- | --- |
| Klartext-Ausweis braucht Freigabe (HIGH) | **Ja.** Als offene Entscheidung 1 im Proposal, mit betroffener Spec-Stelle. Der Change ist erst freigegeben, wenn die Liste leer ist. |
| Kamera-Berechtigungen (HIGH) | **Ja.** `Info.plist` und `AndroidManifest.xml` als eigene Aufgaben in B1 — bewusst dort, damit die Schale sie beim Anlegen mitbekommt. |
| OTA ohne Veröffentlichungsseite (HIGH) | **Ja.** Neue Aufgabe D1: Zip, Signatur, R2, Manifest — plus der **Anlass** (Vorschlag: jeder `main`-Deploy) und ein Fassungsschema. |
| Struktureller Nachweis nicht prüfbar (HIGH) | **Ja.** A2 hat jetzt zwei Belege: die Zahl, und ein **Skript** im CI, das die Source-Map gegen eine Erlaubnisliste prüft. |
| `@capacitor/app` nie installiert (HIGH) | **Ja.** Als Aufgabe in C2. |
| `notifyAppReady()` / Rückweg (HIGH) | **Ja.** Neue Aufgaben D4 und D5, neue Anforderung samt Szenario im Delta, und ein Beleg, der den Rückweg wirklich auslöst. |
| Signatur-Setup fehlte in B3 (HIGH) | **Ja.** B3 umgeschrieben: erst das Material, dann der Workflow — samt der Auflösung des Widerspruchs „Keystore nirgends im Repo, aber dem Workflow zur Laufzeit vorliegend". |
| Vertragsnummer ohne Verfahren (MEDIUM) | **Ja.** Feld, Stempelstelle und Inkrement-Regel im Entwurf; D2 als eigener Abschnitt. |
| „überhaupt keine Integritätsprüfung" (MEDIUM) | **Ja, korrigiert.** Der Absatz unterscheidet jetzt Integrität von Echtheit. Ein Faktenfehler in einem Papier, das mit Faktenkorrekturen argumentiert — der Befund war verdient. |
| `storageKey` als Default (MEDIUM) | **Ja.** Wird festgenagelt; der Test trägt den erwarteten Wert als Literal, nicht als Selbstbezug. |
| Apple 2.5.2 + Dritt-Plugin im Update-Weg (MEDIUM) | **Ja.** Zwei benannte Abwägungen im Entwurf. Die zweite fällt anders aus als beim Speicher, und der Grund steht dabei. |
| „Tests laufen unverändert durch" (MEDIUM) | **Ja.** Ersetzt durch „auf asynchron anpassen, ohne eine Assertion zu lockern", mit Aufwandseingeständnis. |
| Offene Entscheidungen vs. `SHALL` (MEDIUM) | **Ja.** Das Delta ist ausdrücklich auf die empfohlene Antwort geschrieben; jede Entscheidung nennt die Stelle, die sich bei anderem Ausgang ändert. |
| Szenario „gleicher Commit" (MEDIUM) | **Ja.** Auf „genau einmal gepflegt" umformuliert, mit ausdrücklicher Nicht-Zusage zum Gleichstand. |
| A1 nur gegen Attrappen (MEDIUM) | **Ja.** Geräte-Beleg für A1 auf Phase B vorgezogen, nicht erst Phase E. |
| Wächter sieht die Historie nicht (LOW) | **Ja.** Einmaliger Historienlauf in B2, mit dem Hinweis, dass ein Fund eine Rotation ist und kein Löschen. |
| `PrivacyInfo.xcprivacy` (LOW) | **Ja.** In den Voraussetzungen, als „bekannt vor M4". |
| Tabelle nicht summenstabil (LOW) | **Ja.** Zeile „Sonstige, 198,7 kB" mit ihren Posten. |
| `backButton` feuert in jsdom nie (LOW) | **Ja.** C2 prüft ausdrücklich die Entscheidungsfunktion, nicht die Ereignisquelle. |
| Widerspruch „erster Paint" (MEDIUM) | **Nein — die Annahme trifft nicht zu.** `/` zeigt einem angemeldeten Mitglied nicht den Feed: `HomeRedirect.tsx:60-67` gibt in jedem Zweig `HomePage` zurück, der einzige andere Ausgang ist `/willkommen`. Der Feed liegt auf `/aktivitaet` und darf lazy sein. Als Notiz in A2 festgehalten, weil die Annahme naheliegt. |

**Eigener Fund, ohne Reviewer:** die Zahl „29 Routen" im ersten Entwurf war
falsch — sie zählte `<Route`-Vorkommen und übersah die aus `navItems` und
`rechtsseiten` gemappten. Es sind **43** (24 literale, 14 aus `navItems`, 5
Rechtsseiten), davon 8 reine Weiterleitungen. `AppShell.tsx` trägt keine Route;
der dortige Treffer war `<RouteTransition>`.
