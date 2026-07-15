# Spec — FBC 6-Level-Modell + modell-agnostischer Upgrade-Flow (Stripe Test-Mode)

**Repo:** `fbc-platform` · **Für:** Coding-Agent (im Stil `docs/superpowers/specs/`) · **Auftraggeber:** Donald
**Kontext:** Prototyp-Präsentation an FBC-Mitglieder. Ziel dieser Woche: Upgrade-Wege **zeigbar** machen (Stripe **Test-Mode**, keine echte Zahlung), Registrierung für Teilnehmer, einfaches QM-Feedback.

---

## 1. Entscheidung: das gültige Stufenmodell (FBC)

Es gilt ab sofort das **6-Level-Modell aus v4.0**, angewendet auf FBC. Die alten Stufen Circle (2.400 €) und Legacy (4.800 €) **entfallen**.

| Rang | Level (neuer Key) | Preis/Jahr | Stripe? |
|---|---|---|---|
| 1 | `basic` | 0 € | nein |
| 2 | `connect` | 0 € | nein |
| 3 | `discover` | 150 € | ja |
| 4 | `exchange` | 300 € | ja |
| 5 | `focus` | 600 € | ja |
| 6 | `impact` | 1.200 € | ja |

`premium` / `enterprise` = **später**, nicht bauen.

### 1a. ACHTUNG Namens-Kollision (nicht einfach umbenennen!)
Der aktuelle Seed nutzt alte Keys mit **anderer Bedeutung/Preis**: alt `discover`=0 €, alt `explore`=150 €. Der neue `discover`=150 €. **Nicht die Labels über die alten Keys legen** — sonst kollidiert Semantik + Preis. Stattdessen **neue Keys** einführen und alte migrieren:

| Alt (Seed) | Preis alt | → | Neu | Preis neu |
|---|---|---|---|---|
| `discover` (0) | 0 € | → | `basic` **+** `connect` (0 €) | 0 € |
| `explore` | 150 € | → | `discover` | 150 € |
| `impuls` | 300 € | → | `exchange` | 300 € |
| `active` | 600 € | → | `focus` | 600 € |
| `prime` | 1.200 € | → | `impact` | 1.200 € |
| `circle` | 2.400 € | → | **entfällt** | — |
| `legacy` | 4.800 € | → | **entfällt** | — |

Bestehende Test-User/Seed-Zeilen per Migration auf die neuen Keys mappen. `level_rank` bleibt aufsteigend (basic=1 … impact=6).

---

## 2. GATE-SCHWELLEN — BESTÄTIGT (Detlev, 15.07.2026)

Detlev hat das Modell + die Rechte bestätigt (`260715 FBC Plattform Architektur_6 Stufen.docx`, §16). Diese Schwellen sind **verbindlich** und direkt als RLS umzusetzen. „Kontaktanfragen ab Exchange" ist bestätigt (Welpenschutz bleibt — kein freies Anschreiben ab Basic).

| Recht / Funktion | **Ab Level (verbindlich)** | Detlevs Wortlaut §16 |
|---|---|---|---|
| Profil anlegen · Compass starten · Entdecken | `basic` (0 €) | „Compass starten. Profil anlegen. Entdecken." |
| Compass vervollständigen · erste Matchings · Favoriten | `connect` (0 €) | „Compass vervollständigen. Erste Matchings. Favoriten." |
| Academy · vollständiges Verzeichnis · erweiterte Matchings | `discover` (150 €) | „Academy. Vollständiges Mitgliederverzeichnis. Erweiterte Matchings." |
| Events (teilnehmen) · Kontaktanfragen · Aktivität | `exchange` (300 €) | „Events. Kontaktanfragen. Aktivität. Community." |
| Anbieter werden · Leistungen veröffentlichen · Sichtbarkeit · Leads | `focus` (600 €) | „Anbieter werden. Leistungen veröffentlichen. Sichtbarkeit. Leads." |
| Volle Plattform · Priorität · Teams · Partnerprogramme | `impact` (1.200 €) | „Volle Plattform. Priorität. Teams. Partnerprogramme." |

Priorität im Matching ab `impact`. Events sind für alle sichtbar, aber gestuft: Basic ansehen · Exchange teilnehmen · Focus weitere Formate · Impact volle Nutzung.

**Immer gratis (ab `basic`), unabhängig vom Level:** Nachrichten an *bereits akzeptierte* Kontakte + Systemnachrichten. **Welpenschutz:** neue Mitglieder die ersten 30 Tage nicht kalt kontaktierbar (Kontakt nur über Match/Empfehlung).

### ⚠️ Der eine Widerspruch, den Donald bewusst entscheiden muss
v4.0 listet **„Nachrichten" bereits auf `basic` (0 €)**. Das steht im Konflikt mit eurem verteidigbaren Kern **„Sichtbarkeit ≠ Kontaktrecht + Welpenschutz"** (Kontaktdaten nie automatisch frei; Anfrage → Bestätigung → Chat; Schutz für Neue). Wenn jeder Gratis-Nutzer sofort jeden anschreiben darf, ist der Spam-Schutz — euer stärkstes Alleinstellungsmerkmal — weg. **Empfehlung:** „Nachrichten" auf `basic` = nur *bestehende, bereits akzeptierte* Kontakte + Systemnachrichten; **neue Kontaktanfragen** erst ab einer höheren, zahlenden Stufe, plus 30-Tage-Welpenschutz für Neue. Aber das ist Donalds Call — der Agent fragt und baut erst danach die RLS.

---

## 3. Build diese Woche (modell-agnostisch)

Die Upgrade-Mechanik ist unabhängig von Labels/Preisen — Labels + Preise leben in Config.

### 3.1 Stripe Test-Mode + Preise als Config
- 4 Produkte/Preise im Stripe **Test-Mode**: 150 / 300 / 600 / 1.200 € (jährlich). `basic`/`connect` ohne Stripe.
- Preis-IDs + Anzeigenamen in einer Config-Datei (z. B. `src/config/levels.ts`), damit Label-Änderungen ein Einzeiler bleiben.
- **Akzeptanz:** kein Live-Key im Repo/Client; Test-Keys via Infisical.

### 3.2 Pricing-/Level-Screen
- 6 Level als Karten, aktuelles Level markiert, „Upgrade"-Button je höherem Level.
- Sichtbarer Hinweis **„Testzahlung · Demo"** auf jeder Bezahlaktion, damit kein Mitglied echt zu zahlen glaubt.
- **Akzeptanz:** aktuelles Level korrekt hervorgehoben; Downgrade-Optik nicht anbietbar (nur Upgrade dieser Woche).

### 3.3 Upgrade-Flow (Stripe Checkout, Test-Mode)
- Klick „Upgrade" → Stripe Checkout (Testkarte `4242…`) → Erfolg.
- **`tier`/`level` wird per Stripe-Webhook gesetzt, NICHT per Success-Redirect** (Webhook = Wahrheit).
- Nach Freischaltung: die zum neuen Level gehörenden Rechte greifen (RLS) → vorher gesperrter Inhalt wird sichtbar (das ist der „Wow"-Moment der Präsentation).
- **Akzeptanz:** ein zuvor gesperrtes Element ist nach dem Test-Upgrade real sichtbar; Webhook idempotent; `level` clientseitig nicht schreibbar.

### 3.4 Registrierung / Onboarding
- Signup existiert (Phase-1-Bestand) → ergänzen: Startlevel wählen (`basic` default, gratis) → Landing aufs Dashboard.
- **Akzeptanz:** Teilnehmer registriert sich live, landet auf `basic`/`connect`, sieht den Upgrade-Pfad.

### 3.5 QM-Feedback (einfach) — Detlev §18
- Modul mit: **⭐ Sternebewertung** + drei Freitextfelder „Was gefällt dir?" / „Was fehlt dir?" / „Welche Idee hast du?".
- Schreibt `feedback`-Zeile (Sterne + 3 Texte + Route/Kontext, optional Screenshot). Optional Linear-Issue (wie `FBC_Ideen_Inbox`-Konzept), aber MVP = nur speichern.
- **Kein autonomes QM** — nur Einsammeln. RLS: Nutzer sieht/schreibt nur eigenes Feedback; Admin liest alles.
- **Akzeptanz:** Feedback landet in DB und ist für Admin sichtbar.

---

## 4. Diese Woche bewusst NICHT
Echte Zahlung / Live-Keys · SEPA · EasyBill/Rechnungen · AGB/Widerruf/Datenschutz-Texte (erst bei Live-Billing nötig) · `premium`/`enterprise` · Downgrade-/Proration-Logik · autonomes QM.

---

## 5. Reihenfolge
1. Migration alte→neue Keys (§1a) + `level`-Config.
2. **Design-Gate: Donald zu §2 befragen**, RLS-Rechtematrix festschreiben.
3. Pricing-Screen → Upgrade-Flow (Webhook) → Onboarding → Feedback.
