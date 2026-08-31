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

---

# Runde 2 — Delta „Startfläche" (B5), 28.08.2026

Geprüft wurde **nur** das neu hinzugekommene Delta: die Anforderung
„Die Startfläche trägt die Marke" und die Aufgabe B5. Nicht der ganze Change —
der ist in Runde 1 geprüft.

`reviewed_artifacts_sha` (SHA-256 des vorgelegten Textes):
`b5d669af6fc1e335814f581688c62d5bf842281040ada264af7126eddc87154c`

Zwei zählende Stimmen fremder Anbieter, beide **vor der ersten Codezeile**.
Der eigene Anbieter (`claude`) hat nicht geprüft. `codex` wurde nicht gefragt:
er delegiert die Review weiter und liefert eine fremde `MODEL:`-Zeile unter
eigenem Namen.

## Reviewer: gemini (Modell selbst ausgewiesen als „Gemini 1.5 Pro")
VERDICT: REQUEST-CHANGES

- [HIGH] Dunkelmodus fehlt vollständig; die Fläche ist auf `#ffffff` festgelegt.
  → **ZURÜCKGEWIESEN, mit Beleg.** Diese Anwendung hat kein dunkles
  Inhaltsthema: `data-variant` kennt `hell` und `navy`, und `navy` färbt laut
  `docs/design-system.html` nur Sidebar und Topbar — `--color-canvas` ist in
  beiden `#ffffff`. Ein dunkler Entwurf hätte kein Ziel.
  → **Der abgeleitete Punkt gilt aber und ist übernommen:** das Storyboard stand
  auf `systemBackgroundColor`, das im Dunkelmodus schwarz wird. Unter dem alten
  deckenden PNG unsichtbar, in dieser Komposition die Fläche unter dem
  Schriftzug. Grundton wird jetzt ausdrücklich gesetzt.
- [HIGH] Komposition nur für Hochformat ausgelegt; bricht quer.
  → **ÜBERNOMMEN**, und nachgemessen statt geglaubt: `UISupportedInterfaceOrientations`
  erlaubt Landscape auf iPhone, `TARGETED_DEVICE_FAMILY = "1,2"` schliesst iPad
  ein. Der Entwurf ist auf **drei** Ebenen umgebaut; der Verlauf wird nicht mehr
  ins Foto gebacken.
- [MEDIUM] Text auf dem Startbildschirm widerspricht Apples HIG.
  → **ÜBERNOMMEN als bewusste Abweichung**, in der Anforderung benannt. Der
  Grund der HIG-Empfehlung ist Lokalisierbarkeit; die App ist einsprachig
  deutsch. Die Stelle, die beim Mehrsprachigwerden nachzieht, ist notiert.
- [MEDIUM] Der RED-Test über die mittlere Farbe ist nur ein Rauchtest.
  → **ÜBERNOMMEN**, zusammen mit dem schärferen Befund von opencode: gemessen
  wird regionsweise.
- [LOW] iOS hält den Startbildschirm im Zwischenspeicher; der Geräte-Beleg ist
  ohne frische Installation unzuverlässig.
  → **ÜBERNOMMEN**, in Anforderung und Aufgabe.
- [LOW] Bündelgrösse; `oxipng` einbauen.
  → **Halb übernommen:** der Zuwachs wird gemessen und genannt, der Optimierer
  kommt nicht dazu (eine Werkzeug-Abhängigkeit mehr für einen Lauf, der ein
  paarmal im Jahr stattfindet).
- [LOW] Boot-Fläche vorsorglich statt nach Messung.
  → **Nicht übernommen.** Die Lücke ist heute weiß auf weiß; erst messen, dann
  zudecken. Was übernommen ist, ist der Zeitpunkt der Entscheidung — siehe
  opencode.

## Reviewer: opencode (hf:moonshotai/Kimi-K3)
VERDICT: REQUEST-CHANGES

Hat die prüfbaren Behauptungen vor dem Urteil im Repo nachgemessen.

- [HIGH] Es gibt kein `Splash.imageset` **innerhalb** von `App.app`; `actool`
  backt Image Sets in `Assets.car`. Und der Mittelwert kann Vorher und Nachher
  nicht unterscheiden, weil beide in Weiss enden.
  → **ÜBERNOMMEN, beides.** Beleg läuft über `assetutil --info` und die SHA1 der
  Renditions; gemessen wird regionsweise.
- [HIGH] Die „Positivkontrolle" prüfte das Falsche — dass `Georgia` still
  ersetzt wird, ist genau der Fail-open-Fall, den die Anforderung verbietet.
  → **ÜBERNOMMEN, und das ist der beste Befund der Runde.** Die Kontrolle ist
  umgedreht: `fc-match` muss für Inter und Fraunces auf die Repo-TTF zeigen,
  sonst Abbruch. Die Gegenprobe steht daneben, nicht an ihrer Stelle.
- [HIGH] Das Szenario „kein Sprung" hat keine Implementierung: ohne
  `@capacitor/splash-screen` entscheidet das System, wann der Startbildschirm
  weicht.
  → **ÜBERNOMMEN.** Die Anforderung sagt jetzt nicht mehr, der Übergang werde
  gesteuert, sondern er sei unsichtbar, weil beide Flächen denselben Grundton
  tragen. Kein Plugin.
- [HIGH] `rsvg-convert` lädt eingebettete Bilder über gdk-pixbuf und fällt bei
  fehlendem WebP-Loader **still** aus.
  → **ÜBERNOMMEN.** `sips` dekodiert vorher nach PNG, mit Abbruch.
- [MEDIUM] HIG/Lokalisierung, Launch-Screen-Cache. → wie bei gemini, übernommen.
- [MEDIUM] iPad und Querformat fehlen. → wie bei gemini, übernommen.
- [MEDIUM] Die Boot-Fläche kann nicht an `isNativePlatform()` entscheiden — der
  Inhalt des Wurzelelements wird gezeichnet, bevor JS läuft.
  → **ÜBERNOMMEN.** Die Entscheidung fällt im `<head>`-Inline-Skript, das heute
  schon vor dem First Paint die Design-Variante setzt.
- [MEDIUM] Ohne CI-Drift-Prüfung ist „eine Änderung erreicht die Startfläche"
  nicht erzwungen.
  → **ANERKANNT, nicht in diesem Change gebaut.** Als eigener Vorgang notiert —
  und er gilt für `pnpm app:icons` (B4) genauso, also einer für beide statt
  einer hier.
- [LOW] Feste Pixelkoordinaten des Ausschnitts roten unbemerkt beim Bildtausch.
  → **ÜBERNOMMEN**, der Ausschnitt steht als Anteil des Quellbildes.
- [LOW] `PANGOCAIRO_BACKEND=fc` kann in anderen pango-Bauten wirkungslos sein.
  → **ÜBERNOMMEN.** Entschieden wird am Verhalten (`fc-match`), nicht am
  Variablennamen.
- [LOW] Fail-closed war nur für Schriften gefordert, nicht für Marke und Bild.
  → **ÜBERNOMMEN**, gilt jetzt für alle drei Quellen.

---

# Runde 3 — Diff-Review D1 (Speicher des Luftwegs), 31.08.2026

Kein Plan-Review nach Schritt 2b, sondern ein **Diff-Review** über den ersten
Code der Phase D: `20260831100000_ota_buendel.sql`, `ota_buendel_test.sql` und
die Zeile in `ci.yml`. Anlass ist Donalds Regel vom 26.08. — Migration und RLS
gehen nie ohne Fremdreviewer. Kein Gate-Trailer, weil dieser Lauf nicht über
`run-plan-review.sh` lief; er bindet sich an den Diff, nicht an die Artefakte.

## Reviewer: codex

Auftrag mit dem Kopf aus [[reviewer-cli-timeouts]] („Ignoriere sämtliche
Skills … Antworte nur mit der Befundliste"), `REVIEWER_TIMEOUT=900`, exit 0,
zehn Befunde. Kein Abschweifen.

**Übernommen (7):**

| Schwere | Befund | Was daraus wurde |
| --- | --- | --- |
| MEDIUM | Der Bucket ist öffentlich lesbar; die Verschlüsselung schafft **keine** Vertraulichkeit, weil öffentlicher Schlüssel und `sessionKey` beide öffentlich erreichbar sind | **Der teuerste Befund.** Die Begründung für `public = true` war falsch — in der Migration, in `design.md` §8 (zweimal) und in ADR-0005. Alle vier Stellen korrigiert: die Verschlüsselung trägt Echtheit, öffentlich ist unbedenklich, weil im Bündel steht, was Pages ohnehin ausliefert |
| MEDIUM | `session_key` prüfte keine Längen; `A:A` kam durch | Feste Längen erzwungen: IV 24, Sitzungsschlüssel 344 Base64-Zeichen (16 bzw. 256 Byte) |
| MEDIUM | Die Positivkontrolle im Test benutzte genau solche laufzeituntauglichen Werte | Test auf die echten Längen umgestellt; zusätzliche Verneinung für „Form richtig, Länge falsch" |
| MEDIUM | `url ~ '^https://'` liess jeden fremden Host durch | An den Pfad **unseres** Buckets gebunden; Verneinung ergänzt |
| MEDIUM | `benoetigte_schale` liess `999999999999.0.0` zu — Überlauf beim Vergleich nach `int[]` | Auf vier Stellen je Zahl begrenzt, führende Nullen ausgeschlossen |
| MEDIUM | Der Test prüfte nur `rolbypassrls`; ein RLS-Bypass verleiht **keine** Tabellenrechte | Zweite Zusage über die vier Rechte auf `storage.objects` ergänzt |
| MEDIUM | Schreibzugriffe von Clients auf den Bucket wurden gar nicht geprüft — Policies gelten der geteilten Tabelle `storage.objects`, nicht einem Bucket | Verhaltensprobe ergänzt, mit Kontrolle: dieselbe Anweisung ohne RLS geht durch, als `authenticated` wird sie abgewiesen |

**Teilweise übernommen (2):**

- **`version` akzeptiert führende Nullen, weist Vorabfassungen ab.** Die erste
  Hälfte stimmt und ist behoben. Die zweite ist eine **bewusste Grenze**:
  `package.json` steht auf `0.0.0`, das Projekt kennt keine Vorabfassungen, und
  entstünde je eine, fiele der Veröffentlichungs-Schritt **laut** aus (rote CI)
  statt still. Steht als Kommentar an der Bedingung.
- **`count(*) = 0` ist vakuum-grün bei einem Tippfehler im Tabellennamen.**
  Behoben mit `has_table` davor. Die Gegenprobe über `profiles` bleibt, sie
  beantwortet die andere Frage (misst die Abfrage überhaupt etwas).

**Nicht übernommen (1):**

- **`HTTPS://` in Großbuchstaben wird abgewiesen.** Zutreffend, aber ohne Folge:
  die URL wird vom Veröffentlichungs-Schritt selbst gebildet, nicht eingegeben.
  Eine Bedingung auf `lower(url)` wäre Nachsicht gegenüber einem Aufrufer, den
  es nicht gibt.

## Was der Review NICHT geprüft hat

Der Auftrag nannte ihm vier gemessene Tatsachen als gegeben (Rechte von
`service_role`, der Golden-Master über die Tabellenrechte, die Anforderungen des
Clients). Wären die falsch, fiele es hier nicht auf. Sie sind am laufenden Stack
bzw. am Quelltext des Plugins gemessen, nicht angenommen.
