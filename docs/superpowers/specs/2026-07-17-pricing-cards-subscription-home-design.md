# Pricing-Karten-Redesign + Mitgliedschafts-Home — Design

Datum: 2026-07-17 · Branch: `donald/pricing-cards-subscription-home`

## Ziel

Zwei zusammenhängende Verbesserungen an der Mitgliedschafts-/Preis-Fläche (`/mitgliedschaft`):

1. **Karten-Redesign** — die sechs Stufen-Karten (`MitgliedschaftPage`) sind flach,
   und die Preise fluchten nicht (unterschiedlich lange `summary`-Texte + fehlende
   CTA bei Gratis-Stufen lassen die Preiszeile vertikal wandern). Ziel: konsistente
   Ausrichtung + optisch ansprechendere Karten mit „Hero"-Kopf.
2. **Mitgliedschafts-Home** — ein *dauerhaft erreichbarer* Ort, an dem ein Mitglied
   seine **aktuelle Mitgliedschaft sieht und proaktiv upgraden** kann — nicht nur als
   Nudge auf einer gesperrten Funktion (heute: `MembershipGate`-Wand + Einstellungen-Link).

Nicht-Ziel: Änderungen an der Upgrade-*Mechanik* (Stripe/Checkout/Webhook/RLS). Rein Frontend.

## Entscheidungen (mit Donald abgestimmt)

- **Hero = Akzent-Band + Rang-Monogramm.** Kopf-Band pro Karte, Gold-Ton nach `rank`
  gestaffelt (Basic blass → Impact satt). Im Band ein kleines Monogramm-Emblem mit der
  **Rang-Ziffer (1–6)** im Gold der Stufe.
- **Gold-Progression, token-getrieben.** Die sechs Akzent-Töne werden aus dem
  bestehenden Gold-Token abgeleitet (Tint/Opacity-Stufen nach `rank`), **keine neue
  Palette**. So erbt die Karte die Farben jeder Design-Variante (A–G) automatisch —
  eine gemeinsame Karte, keine Pro-Varianten-Arbeit.
- **Ausrichtung** über ein festes Karten-Skelett (feste Regionen, s.u.).
- **„Empfohlen"-Tag** auf der Discover-Karte (Einstiegs-Zahlstufe) — dezenter
  Akzent-Rahmen + kleines Tag. Bleibt.
- **Mitgliedschafts-Home:** Kopf-Panel auf `/mitgliedschaft` + zwei Einstiege
  (Profil-Karte + User-Menü). **Kein Sidebar-Eintrag** (die Nav bleibt 6+5+1, s.
  Nav-Tests).
- **Keine neuen Felder in `levels.ts`** — Akzent-Ton und Monogramm leiten sich aus
  `rank` ab. Die „Label/Preis-Änderung ist Einzeiler"-Philosophie bleibt.

## Komponenten & Änderungen

### 1. `PricingCard` (neu) — `src/components/membership/PricingCard.tsx`
Extrahiert die heutige Inline-Karte aus `MitgliedschaftPage` in eine eigene, testbare
Komponente. Festes Skelett (oben→unten), das die Ausrichtung erzwingt:

1. **Akzent-Band** (feste Höhe): volle Breite, Gold-Tint nach `rank`. Rechts/zentriert
   das **Rang-Monogramm** (gerundetes Emblem mit Ziffer `rank`, Gold der Stufe).
2. **Titel + Status-Badge**: `label` + „Aktuell", wenn aktuelle Stufe.
3. **Summary**: `summary`, mit **fester Mindesthöhe für 3 Zeilen** (`min-h` +
   `line-clamp-3`) — die längsten Summaries brechen bei Kartenbreite auf ~3 Zeilen um;
   die feste Höhe ist die entscheidende Ausrichtungs-Maßnahme, damit alles darunter
   fluchtet.
4. **Preis**: an fester Position (weil die Summary-Region fixe Höhe hat). „Gratis" bzw.
   `{price} € / {Jahr|Monat}`.
5. **CTA-Region** (`mt-auto`, unten verankert): Upgrade-Button + „Testzahlung · Demo"
   für zahlbare Upgrades; aktuelle Stufe → „Aktuell", kein Button; darunterliegende/
   Gratis-Stufen → gedämpft, kein Button. **Gating-Logik unverändert** (`canUpgrade`,
   `busy`, `startUpgrade` bleiben in `MitgliedschaftPage` und werden als Props/Callback
   übergeben).

Props: `level: LevelConfig`, `interval`, `isCurrent`, `canUpgrade`, `recommended`,
`busy`, `onUpgrade`. Reiner Präsentations-Baustein, keine eigene Datenlogik.

### 2. Akzent-/Monogramm-Helfer — `src/config/membershipVisuals.ts` (neu, klein)
Reine Funktionen, aus `rank` abgeleitet, token-basiert:
- `accentBandStyle(rank)` → liefert einen Inline-`style` mit dem Band-Hintergrund,
  abgeleitet **aus einem** vorhandenen Gold-Token via `color-mix` (ein Token, sechs
  Mischstufen: `rank` 1 blass → 6 satt). So erbt jede Design-Variante ihr eigenes Gold
  automatisch, ohne Pro-Varianten-Klassen.
- `monogram(rank)` → die anzuzeigende Ziffer (`String(rank)`).
Konkreter Gold-Token-Name wird beim Planen aus `src/index.css` verifiziert.
Unit-getestet (Mapping deterministisch, 1–6 abgedeckt, Grenzen).

### 3. `MitgliedschaftPage` — Kopf-Panel „Deine Mitgliedschaft"
Über dem Karten-Grid ein Summary-Panel:
- aktuelle Stufe (`useAuth().tier` → `LEVELS[tier]`): Label, `summary`, Preis/„Gratis".
- nächste Stufe (nächsthöherer `rank`, falls vorhanden) als „Nächster Schritt: …".
- Der Jahr/Monat-Toggle bleibt; er ändert nur den angezeigten Preis.
Das macht die Seite zur Mitgliedschafts-Verwaltung, nicht nur zum Preisraster.

### 4. Einstieg A — Profil-Abo-Karte (`ProfileHero` / Mein-Profil)
Der bestehende Tier-Badge-Bereich („BASIC MEMBER") wird zu einer kleinen
„Deine Mitgliedschaft"-Karte: aktuelle Stufe + Kurz-Nutzen + Button
„Mitgliedschaft verwalten / Upgrade" → `/mitgliedschaft`. Nur eigene Ansicht
(nicht auf fremden Profilen). Keine Nav-Test-Auswirkung.

### 5. Einstieg B — User-Menü (`AppShell` Topbar-Dropdown)
Ein Eintrag „Mitgliedschaft" im Avatar-Dropdown oben rechts → `/mitgliedschaft`.
Immer erreichbar, minimaler Footprint, keine Nav-Test-Auswirkung.

## Datenfluss

`useAuth()` liefert `tier`/`levelRank` bereits aus der DB (`profiles` +
`membership_tiers`). Kopf-Panel und Karten lesen daraus; keine neuen Queries.
Akzent/Monogramm sind reine `rank`-Ableitungen. Keine DB-/RLS-/Migrations-Änderung.

## Tests

- **PricingCard**: rendert je Zustand korrekt — aktuelle Stufe (Badge, kein Button),
  zahlbares Upgrade (Button + „Testzahlung · Demo"), Gratis/darunter (kein Button),
  `recommended` (Empfohlen-Tag nur auf Discover), `busy` (Button disabled).
- **membershipVisuals**: Monogramm 1–6, Akzent-Mapping deterministisch.
- **Kopf-Panel**: zeigt aktuelle Stufe + nächste Stufe; Impact hat keinen „nächsten
  Schritt".
- **Regression**: Nav-Tests bleiben 6+5+1 (kein Sidebar-Eintrag). Bestehende
  `MitgliedschaftPage`-Tests an die extrahierte Karte anpassen, nicht duplizieren.

## Out of scope / Folge

- Kein Stripe-Customer-Portal, kein Downgrade/Kündigung (eigenes Folge-Issue).
- Keine echten Bilder/Illustrationen (bewusst: Monogramm + Band statt Assets).
- Discover-Monatspreise etc. unverändert.
