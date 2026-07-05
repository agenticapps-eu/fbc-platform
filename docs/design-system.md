# Design-System & Navigation — FBC Platform (Schwarz & Gold)

> **Für Claude Code:** Verbindliche Spezifikation. Löst die bisherige „Smaragd & Gold"-Richtung (P7/AGE-237) ab.
> Neue Richtung von Detlev: **Schwarz & Gold — elegant, modern, exklusiv.** Referenz: FBC-Website (dunkler Hero + Gold) und das Member-Dashboard-Mockup (near-black Sidebar, Gold-Akzente, helle Cards).
> Umsetzung in `src/index.css` (`@theme`, Tailwind v4) und `src/config/nav.ts` / `src/components/ui/SidebarNav.tsx` / `src/components/AppShell.tsx`.

---

## 1. Markenanmutung

- **Schwarz/Anthrazit als Chrome** (Sidebar, Header, Hero), **Gold als einziger Akzent**, **helle, ruhige Content-Flächen** (Cards weiß auf warmem Off-White).
- Elegant statt verspielt: viel Weißraum, feine 1px-Linien, weiche Schatten, keine bunten Flächen im Chrome.
- Wirkung: exklusiver Mitgliederclub, nicht FinTech/Social-Media.

---

## 2. Farbtokens (`@theme` in `src/index.css`)

Ersetze die bisherigen `--color-emerald*`-Tokens. Smaragd ist **nicht** mehr Primärfarbe.

```css
@theme {
  /* Chrome — weiches Near-Black/Anthrazit (Sidebar, Hero-Verlauf). KEIN reines
     Schwarz: freundlicher Premium-Look (Detlev, AGE-237). Header ist hell. */
  --color-night: #1b1c20;          /* Sidebar/Hero-Anthrazit */
  --color-night-elevated: #26282e; /* Karten/aktive Items auf dunkel */
  --color-night-border: rgba(255, 255, 255, 0.08);

  /* Akzent — Gold (einziger Marken-Akzent) */
  --color-gold: #c2a24e;           /* primärer Goldton (Buttons, aktive Nav, Icons) */
  --color-gold-strong: #b8893b;    /* dunkler für Text auf Hell / Hover */
  --color-gold-soft: #efe3c8;      /* sehr helle Goldfläche / Badges */

  /* Content — hell, warm */
  --color-canvas: #ffffff;         /* Cards */
  --color-soft: #f4f3ee;           /* Seitenhintergrund warmes Hellgrau */
  --color-ink: #14151a;            /* Haupttext auf Hell */
  --color-muted: #6b7280;          /* Sekundärtext */
  --color-line: #e7e5df;           /* Rahmen/Trenner auf Hell */

  /* Text auf dunklem Chrome */
  --color-on-night: #f4f2ec;
  --color-on-night-muted: #a1a1aa;

  /* Status */
  --color-success: #2e7d5b;
  --color-positive: #1f9d6b;       /* +x % Werte */
  --color-danger: #b23a2e;

  /* Format-Akzentfarben (NUR für die kleinen Format-Icons, sparsam) */
  --color-fmt-compass: #1c6b57;
  --color-fmt-library: #2c7a7b;
  --color-fmt-academy: #2b5c9a;
  --color-fmt-community: #c8791e;
  --color-fmt-events: #b23a2e;
  --color-fmt-matching: #1e3a5f;
  --color-fmt-projekte: #6b3fa0;

  /* Typografie */
  --font-display: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  --shadow-soft: 0 1px 2px rgba(20, 21, 26, 0.05), 0 16px 40px -24px rgba(20, 21, 26, 0.25);
  --radius-card: 14px;
}
```

- Body: `background: var(--color-soft); color: var(--color-ink)`.
- Font-Import in `src/index.css` ergänzen: Cormorant Garamond (600/700) **und** Inter (400–700).

---

## 3. Typografie

- **Display/Headlines & der Name im Profil:** `--font-display` (elegante Serif), z. B. Hero „Eine Gemeinschaft …", Profil-Name, große Score-Zahlen optional.
- **UI/Body/Labels:** `--font-sans` (Inter).
- Headlines ruhig, mit leichtem negativen Letter-Spacing; reichlich Zeilenhöhe im Body.

---

## 4. Kern-Komponenten (Anpassungen)

- **Sidebar (`AppShell`/`SidebarNav`):** seit dem Refresh ein **heller Champagner→Gold-Verlauf** (`SIDEBAR_SURFACE` in `AppShell` — eine Tuning-Stelle), dunkler Text (`--color-ink`) für Lesbarkeit, aktive Route = **`--color-gold-strong` + Gold-Linksbalken** auf dezenter dunkler Pille. Aufbau von oben nach unten (`SidebarContent`): **Identitäts-/Mitglieder-Block** (Avatar + Name + Tier-Badge, eingeloggt; ausgeloggt ein ruhiger „Anmelden"-Hinweis) → **flaches Hauptmenü** (`SidebarNav`, keine Sektions-Labels mehr) → **„Mein Bereich"-Akkordeon** unten (nur eingeloggt). Die Wortmarke sitzt nicht mehr in der Sidebar, sondern im Header. (Der frühere near-black `--color-night`-Hintergrund war Detlev zu dunkel, AGE-237.)
- **Header/Topbar:** dunkel oder weiß mit feiner `--color-line`-Unterkante; **links die Kronen-Wortmarke (`Logo lockup="full"`, immer sichtbar, Link auf `/`)**, globale Suche mittig (wie Mockup), rechts Nachrichten/Benachrichtigungen + Avatar mit Tier-Label in Gold.
- **Cards:** `--color-canvas`, 1px `--color-line`, `--radius-card`, `--shadow-soft`. Überschrift klein/gemutet in Versalien, „Alle anzeigen" rechts in Gold.
- **Buttons:** primär = **Gold-Fläche + near-black Text** (`bg-gold text-night`); sekundär = **near-black Fläche + heller Text**; ghost = Gold-Outline. (Wie Website: „Jetzt Mitglied werden" gold, „Mehr über uns" dunkel.)
- **Tier-Badge:** Gold-Outline-Pill mit Krone + Label (z. B. „LEGACY MEMBER"). Stufenfarbe nur über Gold/Anthrazit, kein Bunt.
- **Stat-Tile:** große Zahl (`--font-display` optional), Label gemutet, Trend in `--color-positive`.
- **Fortschrittsbalken:** dünn, Gold-Füllung auf `--color-line`.

Aktualisiere `/styleguide` entsprechend (alle Tokens + Komponenten in Schwarz & Gold).

---

## 5. Navigation — verbindliche Reihenfolge ⚠️

Detlevs Vorgabe: Die **7 Formate bauen aufeinander auf** (linke Spalte der Mitglieder-Matrix) und **diese Reihenfolge ist die Sidebar-Reihenfolge**. Über den Formaten steht als **erster Eintrag „Start"** (`/`, öffentliche HomePage, auch anonym sichtbar):

| # | Eintrag | Route | Hinweis |
|---|---|---|---|
| 0 | **Start** | `/` | Öffentliche Landingpage, ÜBER den Formaten, für alle sichtbar |
| 1 | **Compass** | `/compass` | Orientierung, Analyse, Empfehlungen |
| 2 | **Library** | `/library` | Wissen, Ressourcen, Vorlagen |
| 3 | **Academy** | `/academy` | Kurse, Videos, Workshops |
| 4 | **Events** | `/events` | Online-/Präsenz-Veranstaltungen |
| 5 | **Community** | `/community` | Feed + **Mitgliederverzeichnis** (Verzeichnis nur ab Prime) |
| 6 | **Matching** | `/matching` | Such-/Bieteprofile, Matches (ab Prime) |
| 7 | **Projekte** | `/projekte` | Kooperationen, Initiativen |

`src/config/nav.ts` entsprechend:
- **Start** (`/`) als erster Eintrag über den Formaten; danach die Reihenfolge exakt wie oben (Compass zuerst, Projekte zuletzt).
- `Feed` → wird Teil von **Community** (`/community`); das **Verzeichnis** wird ein Tab/Unterbereich von Community mit `minTier: "prime"` (kein eigener Top-Level-Eintrag mehr).
- **Library** als neue Route/Seite (Platzhalter, Inhalt folgt Phase 2) ergänzen.
- `konto`-Routen (**Mein Bereich** `/mein-bereich`, **Profil** `/profil`) erscheinen nicht mehr als eigene Sektion in der Sidebar, sondern werden über das Mein-Bereich-Akkordeon bzw. den Identitäts-Block (Profil) erreicht.

**Sidebar als flache Liste:** Die Sektions-Labels „Formate" und „Konto" sind entfernt — die Sidebar zeigt nur die `formate`-Items als einzelne, flache Liste (`MENU` in `AppShell`). Die persönliche **„Mein Bereich"-Subnavigation** (siehe `docs/profile-spec.md`) ist ein **stabiles Inline-Akkordeon** (`MeinBereichAccordion`) am unteren Ende derselben Sidebar (nur eingeloggt) — kein Menü-Tausch, keine zweite Sidebar. Sie klappt die persönlichen Unterpunkte auf (Mein Profil, Meine Events → Gebuchte/Eingestellte, Meine Kontakte, Meine Investitionen, Einstellungen).

---

## 6. Membership-Matrix als Gating-Quelle

Die rechte Seite der Matrix (Pläne × Formate, plus „Sichtbarkeit & Rechte") ist die fachliche Quelle fürs Gating. Schon umgesetzt über `current_tier_rank()` (siehe `docs/rls-policies.md`). Für die UI gilt:

| Format | Discover | Explore | Impuls | Active | Prime | Circle | Legacy |
|---|---|---|---|---|---|---|---|
| Compass | Basis | Vertiefung | Roadmap | Feedback | Experten | Circle Review | Legacy Strat. |
| Library | Teaser | Grundlagen | Vollzugriff | Ressourcen | Expertenw. | Insights | Research |
| Academy | Schnuppern | Grundlagen | Vollzugriff | Workshops | Programme | Mastermind | Advisory |
| Community | Öffentlich | Gruppen | Fachgruppen | Event-Comm. | **Verzeichnis** | Unt.-Kreis | Legacy Forum |
| Events | Gast | Regional | Online | Standard | Premium | Exec. Dinner | Legacy Summit |
| Matching | Empfehlung | Mentor | Lernpartner | Event-Match | **Business** | Vertrauens | Strategisch |
| Projekte | Beobachten | Mitwirken | Arbeitsgr. | Kooperation | Teilprojekte | Joint Vent. | Impact |

Prototyp testet weiterhin **Discover / Prime / Legacy**. UI-Regel: gesperrte Bereiche werden als dezenter „ab Prime"-Hinweis (Gold-Outline) dargestellt, nicht hart versteckt (außer wo RLS ohnehin keine Daten liefert).

---

## 7. Definition of Done (Design-Refresh / AGE-237-Update)

- `src/index.css`-Tokens auf Schwarz & Gold umgestellt; keine `emerald`-Primärnutzung mehr.
- Sidebar dunkel mit Gold-Aktiv-State; **Reihenfolge Compass→Projekte** umgesetzt.
- Buttons/Cards/Badges/Tiles im neuen Look; `/styleguide` aktualisiert.
- App wirkt durchgängig „schwarz & gold, elegant, modern".
- Commit: `feat: redesign to black & gold + canonical nav order (AGE-237)`.

### 7.1 UI/UX-Refresh nach Detlev-Review (AGE-237, Folge-Iteration)

- **Schmaler, zentrierter Shell** (LinkedIn/Facebook-Anmutung): Container max. ~1000 px
  (Einspalter) bzw. ~1180 px (mehrspaltig: Dashboard/Verzeichnis/Matching), Sidebar als
  angedockte dunkle Karte an der linken Container-Kante — kein Vollbild-Balken. `<1024 px`
  klappt die Sidebar als Off-Canvas-Drawer (Hamburger im Header).
- **Heller & freundlicher:** App-Hintergrund warmes Hellgrau (`--color-soft #f4f3ee`),
  **Sidebar als heller Champagner→Gold-Verlauf** (`SIDEBAR_SURFACE`) mit dunklem Text —
  Detlev war das near-black Anthrazit noch zu dunkel. Kein Vollschwarz im Content
  (Hero/Impact als Verlauf bzw. helle Karte). Gold-Akzent unverändert, kein Pink.
- **Nav-Reihenfolge (aktualisiert):** **Start**, dann Compass, Library, Academy,
  **Events, Community**, Matching, Projekte (Start zuerst über den Formaten; Events vor
  Community — Detlev-Vorgabe, §5).
- **Eine Sidebar (Folge-Iteration AGE-237):** Identitäts-/Mitglieder-Block oben, flaches
  Hauptmenü ohne Sektions-Labels, „Mein Bereich" als **stabiles Inline-Akkordeon** unten
  (nur eingeloggt). Der frühere Menü-Tausch („Mein Bereich" ersetzte den Sidebar-Inhalt
  IN PLACE inkl. `← Hauptmenü`) wurde zurückgerollt — er war verwirrend. Keine zweite
  Sidebar/Spalte.
- **Profil-Hero:** Cover-Banner (Default Gold/Anthrazit-Verlauf) + überlappendes großes
  rundes Bild, Name/Rollen/Region/Tier — auf öffentlichem Profil und im Dashboard-Kopf.
- **Wahrnehmbare Performance:** Skeleton-Loader (mit `role="status"`/sr-only) statt
  Lade-Text; `fetchDashboard` lädt bereits parallel (`Promise.all`); Bilder `loading="lazy"`.
  _Offen (bewusst nachgelagert):_ vollständiges Route-Code-Splitting — erfordert Umstellung
  der synchronen Gating-Tests auf `findBy`; die schwerste Lib (Recharts) ist bereits gesplittet.

---

## 8. Design-Varianten (Live-Switcher A–I, AGE-237)

Temporäres Review-Tool: ein `data-variant`-Attribut auf `<html>` schaltet
CSS-Variablen-Overrides (`src/index.css`) + wenige Verhaltens-Flags
(`src/config/designVariants.ts`) um — **keine** neun Oberflächen, sondern eine
Theming-Schicht über denselben Komponenten. Deep-Link `?variant=<id>`, Shift+D
schaltet durch, `/styleguide` zeigt alle Varianten live. Quelle: `designVariants.ts`.

| ID | Label | Charakter |
|---|---|---|
| A | Quiet Luxury | Hell, editorial, große Serif, dezentes Gold. |
| B | Members' Club | Dunkle App, cinematischer Gold-Glow, „VIP". |
| C | Warm Social | Warmes Creme, freundlich, Sans-Headlines. |
| **D** | Blend *(Default/Empfehlung)* | Helle Basis + Serif + Gold-Glow-Hero. |
| E | Noir Editorial *(exp.)* | Hochkontrast-Magazin, schwarze Masthead. |
| F | Aurora Glass *(exp.)* | Glas, leuchtende Aurora-Gradients. |
| G | Warm Boutique *(exp.)* | Leinen/Terracotta/Salbei, organisch. |
| **H** | Navy & Gold (dunkel) | Marineblaue Sidebar (Chrome) + Navy-Hero, helle Cards. |
| **I** | Navy & Gold (hell) | Helle navy-getönte Sidebar, Navy nur als Text/Akzent. |

H/I sind aus dem FBC-Wimpel abgeleitet (Marineblau + Gold auf Creme). Die
Marken-Hex liegen als gemeinsame Tokens in den `[data-variant="h"|"i"]`-Blöcken;
falls die exakten Marken-Werte vorliegen, nur diese Tokens tauschen (kein Fork).

---

_Gehört zu Issue **AGE-237** (Design) im Linear-Projekt „FBC Plattform – Prototyp (Phase 1)"._
