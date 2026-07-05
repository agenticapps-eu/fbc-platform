# Design: „Mein Bereich" — Informationsarchitektur-Umbau

**Datum:** 2026-06-30
**Linear:** AGE-237 (Multi-Iteration Design)
**Status:** Spec — bereit für Implementierungsplanung

## Problem

Die heutige „Mein Bereich"-Navigation verspricht Struktur, die die Seite nicht
hält:

- Alle Accordion-Links (Meine Kontakte, Meine Investitionen, Einstellungen, beide
  Meine-Events-Kinder) zeigen auf **denselben Pfad** `/mein-bereich` und
  unterscheiden sich nur per `?tab=…`-Query. React Router markiert `NavLink`
  anhand des Pfads und **ignoriert die Query** → mehrere Menüpunkte leuchten
  gleichzeitig „aktiv" (sichtbar im Screenshot: drei auf einmal).
- `MeinBereichPage` liest die Query gar nicht aus → alle „Unterseiten" landen auf
  **einem einzigen, scrollenden Dashboard mit ~17 Karten**. Die Tabs sind
  dekorativ.
- „Einstellungen" hat ein Label, aber **keine Implementierung** irgendwo in `src/`.
- Mehrere Konzepte sind dupliziert zwischen `/mein-bereich`-Widget und eigener
  Format-Seite (Matching, Communities, Projekte, Events).

Die Aufteilung ist unklar: Was gehört aufs Profil, was zu Kontakten, was in
Einstellungen?

## Ziel

Jeder Menüpunkt = **eine echte Route mit eigenem Pfad und einem klaren Zweck**.
Das behebt den „mehrfach aktiv"-Bug strukturell und verteilt die 17 Karten auf
verständliche Heimaten. Das Profil zeigt viel Info **kompakt und hochwertig** in
einem Bento-Raster.

Verifizierbar: pro Route ist genau ein Menüpunkt aktiv; jede neue Seite rendert
ihre zugewiesenen Sektionen; der Profil-Editor speichert weiterhin;
Einstellungen persistieren mit owner-only-RLS.

## Neue Informationsarchitektur

„Mein Bereich" ist eine Menü-Gruppe (Überschrift) mit vier echten Seiten. Es gibt
**kein zweites Dashboard-Cockpit** — die bestehende `Start`-Seite ist das Zuhause.

| Menüpunkt | Route | Zweck / Inhalt |
|---|---|---|
| Mein Profil | `/profil` (Ansicht), `/profil/bearbeiten` (Editor) | Identität & Selbstdarstellung — Bento |
| Meine Events | `/meine-events` | Gebuchte + Eingestellte/Eigene Events |
| Meine Kontakte | `/kontakte` | Anfragen · Netzwerk · Matching-Übersicht · Communities |
| Einstellungen | `/einstellungen` | Konto · Mitgliedschaft · Benachrichtigungen · Sichtbarkeit |

`/mein-bereich` → **Redirect auf `/profil`**. Die `?tab=`-Deep-Links und die
Accordion-Sub-Items (Gebuchte/Eingestellte) entfallen.

### Kartenverteilung (heute → neu)

| Karte (heute auf `/mein-bereich`) | Neue Heimat |
|---|---|
| ProfileHero + KPI-Kacheln | Profil (Hero + KPI-Leiste) |
| Mein Erfolgsradar | Profil |
| Meine Entwicklung / Fokus | Profil |
| Meine Interessen | Profil (breite Kachel) |
| Meine Ziele | Profil |
| Meine Auszeichnungen | Profil |
| Meine Beiträge | Profil (breite Kachel) |
| Mein Impact / Impact Score | Profil (Hero-Badge + Kachel) |
| Web & Social · Videos | Profil |
| Meine Anfragen | Kontakte |
| Mein Netzwerk | Kontakte |
| Mein Matching (Suche ⇄ Biete) | Kontakte (Übersicht, verlinkt `/matching`, `/angebote-gesuche`) |
| Meine Communities | Kontakte |
| Meine Events | Meine Events |
| Statistik, Investments, Projekte, KI-Assistent (DEMO) | Profil → einklappbarer Block „Aktivität & Portfolio" |

**Wichtige Klarstellung:** Interessen sind **Profil-Inhalt**, nicht
Einstellungen. Einstellungen = Konto/Privatsphäre/Benachrichtigungen.

## Seiten im Detail

### Mein Profil — Bento (`/profil`)

Aufbau von oben nach unten:

1. **Hero** — Banner · Avatar (nicht überlappend) · Mitglieds-Badge · Name ·
   Rollen/Headline · Region·Unternehmen · Button „Profil bearbeiten" →
   `/profil/bearbeiten`.
2. **KPI-Leiste** — Impact · Netzwerk · Matches · Events (schlanke Kacheln).
3. **Bento-Raster** mit Kacheln unterschiedlicher Größe:
   - Über mich (breit) · Erfolgsradar · Auszeichnungen
   - Interessen (breit, volle Reihe)
   - Ziele · Entwicklung/Fokus
   - Beiträge (breit, volle Reihe)
   - Web & Social · Videos
4. **„Aktivität & Portfolio"** — einklappbar, standardmäßig zu, mit `DEMO`-Badge:
   Statistik, Investments, Projekte, KI-Assistent. Sichtbar fürs Pitch, stört
   den Hauptfluss nicht.

**Komponenten-Aufteilung:** Eine gemeinsame `ProfileView`-Komponente mit
`isOwner`-Flag, geteilt von `/p/:id` (öffentliches Fremdprofil) und `/profil`
(eigenes Profil). Nur `isOwner` rendert „Bearbeiten", private Abschnitte und den
Aktivität-Block. Das ersetzt das heutige Profil-Rendering in `MeinBereichPage`
und verschlankt diese große Datei.

`/profil/bearbeiten` ist das bestehende `ProfileEditor`-Formular (heute auf
`/profil`) — unverändert in der Funktion, nur an neuer Route.

### Meine Events (`/meine-events`)

Das heutige `EventsWidget` als eigene Seite: Gebuchte · Vergangene · Eigene
(Eingestellte). Keine Sub-Accordion, keine `?tab=`-Links. „Alle anzeigen" →
Format-Seite `/events`.

### Meine Kontakte (`/kontakte`)

Relationale Seite, Sektionen:

- **Anfragen** — eingehende Kontaktanfragen mit Annehmen/Ablehnen (heutiges
  `MeineAnfragenWidget`). Annehmen → `/chat`. Kernprinzip bleibt: Kontaktdaten
  erst nach Annahme.
- **Netzwerk** — Verbindungen + Aufschlüsselung; „Zum Chat" → `/chat`.
- **Matching-Übersicht** — Suche/Biete-Zusammenfassung + Match-Stats;
  **dupliziert nichts**, sondern verlinkt zu Format `/matching` (prime) und
  Editor `/angebote-gesuche`.
- **Communities** — Liste meiner Communities.

### Einstellungen (`/einstellungen`) — neu, voll funktional

- **Konto** — E-Mail (read-only Anzeige), Logout.
- **Mitgliedschaft** — aktuelle Stufe (Discover/Prime/Legacy), read-only.
- **Benachrichtigungen** — echte Toggles, persistiert.
- **Sichtbarkeit** — im Verzeichnis listbar (ja/nein); wer darf
  Kontaktanfragen senden. Persistiert mit **RLS** entsprechend Projektprinzip
  „Sichtbarkeit wird in der DB per RLS erzwungen".

**Persistenz:** Migration unter `supabase/migrations/` — Settings-Felder
(Spalten auf `profiles` oder eigene `member_settings`-Tabelle, im Plan zu
entscheiden) mit owner-only Read/Write-RLS. Default-Werte so, dass bestehendes
Verhalten unverändert bleibt (z. B. „im Verzeichnis listbar" = true).

## Routing & aktiver Zustand

- Neue Routen in `App.tsx`: `/profil` (Ansicht), `/profil/bearbeiten` (Editor),
  `/meine-events`, `/kontakte`, `/einstellungen`. `/mein-bereich` → Redirect auf
  `/profil`. Alle weiterhin `requiresAuth`/konto (harte Gates wie bisher).
- `config/meinBereich.ts`: Nodes auf echte, distinkte Pfade umstellen (keine
  `?tab=`). Dadurch markiert `NavLink` pro Route **genau einen** Eintrag —
  Bug behoben.
- `MeinBereichAccordion`: bleibt als Gruppen-Renderer, aber ohne Sub-Accordion
  für Events (Events ist jetzt ein direkter Leaf). a11y-Polish optional:
  `<nav aria-label>`, SVG-Icons statt Unicode-Pfeile.
- `WIDE_ROUTES` in `AppShell.tsx` anpassen (`/mein-bereich` → relevante neue
  Routen, die Breite brauchen, z. B. `/profil`, `/kontakte`).

## Testing

- **Routing:** Pro Route (`/profil`, `/meine-events`, `/kontakte`,
  `/einstellungen`) ist genau ein Menüpunkt `aria-current`/aktiv. `/mein-bereich`
  leitet auf `/profil`.
- **Profil:** `ProfileView` rendert alle zugewiesenen Sektionen; `isOwner=false`
  versteckt Edit/privat/Aktivität.
- **Editor:** `/profil/bearbeiten` speichert weiterhin (bestehende Tests
  umhängen).
- **Einstellungen:** Toggles persistieren; nach Reload erhalten.
- **RLS:** Fremder Nutzer kann fremde Settings nicht lesen/schreiben (DB-Test).

## Umfang & Phasen

Vier Bereiche, aber ein kohärenter IA-Umbau → ein Spec, im Plan in Phasen:

1. **Routing/Menü-Fix** — neue Routen, Redirect, `meinBereich.ts` distinkte
   Pfade, Accordion entschlacken. (Behebt den sichtbaren Bug zuerst.)
2. **Profil-Bento** — `ProfileView` extrahieren (mit `/p/:id` geteilt), Bento,
   Aktivität-Block, Editor an `/profil/bearbeiten`.
3. **Kontakte + Meine Events** — Widgets in eigene Seiten umziehen.
4. **Einstellungen + RLS** — neue Seite, Migration, owner-only-RLS (aufwändigste
   Phase).

## Nicht im Umfang

- Inhaltliche Neugestaltung der Format-Seiten (`/events`, `/matching`, …).
- Echte Daten für die DEMO-Widgets (bleiben Platzhalter).
- @mention-Masking im Post-Body (bestehender Follow-up).
