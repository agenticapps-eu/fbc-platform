# Design-System — eff.bee.zee

> **Verbindliche Vorlage ist `docs/design-system.html`** — Farbrampen, Typo-Skala,
> Logo-Pfade, Komponentenbeispiele, beide Themes live umschaltbar. Diese Datei
> fasst nur zusammen, was daraus im Code gilt, und nennt die Stellen.
>
> **Lebende Fassung im Code:** `/styleguide` (nur im Dev-Modus). Dort sind Tokens,
> Rampe und Primitives echt gerendert statt beschrieben — bei Zweifeln gilt der
> Code, nicht dieser Text.

Löst die Richtung „Schwarz & Gold" (AGE-237) ab, die ihrerseits „Smaragd & Gold"
(P7) abgelöst hatte. Umgesetzt in AGE-492.

---

## 1. Markenanmutung

- **Blau ist die einzige Akzentfamilie.** Die früheren Akzentfarben und jeder
  Zweitakzent sind ersatzlos entfallen.
- **Zwei Themes, gleichrangig:** `hell` und `navy`. Navy ist kein Dark Mode,
  sondern eine eigene Marken-Ausprägung mit dunkler Sidebar.
- Fließtext ist **Anthrazit `#1E2A3A`, nie reines Schwarz**.
- Ruhig und seriös: viel Weißraum, feine 1px-Linien, keine Glow- oder
  Schimmer-Effekte. Genau ein Primär-Button pro Ansicht.
- Wirkt wie LinkedIn (Vertrauen, Ruhe), Airbnb (warme Bilder), Instagram
  (Erlebnisse vorn) — **nicht** wie Vereinsportal, Facebook oder CRM.

---

## 2. Tokens (`@theme` in `src/index.css`)

Es gibt keine `tailwind.config.js`. Alle Tokens leben als Tailwind-v4-`@theme`
in `src/index.css`, plus **einem** Override-Block `html[data-variant="navy"]`,
der ausschließlich Werte überschreibt — nie Namen. Darum muss keine Komponente
ihr Theme kennen, und keine darf darauf verzweigen.

| Token | hell | navy | Verwendung |
| --- | --- | --- | --- |
| `--color-accent` | `#2F6BD1` | `#5B90E0` | Primäraktion, Links, aktiver Zustand |
| `--color-accent-strong` | `#1F53B0` | `#8EB5EC` | Hover, kräftigere Akzente |
| `--color-accent-soft` | `#EFF5FD` | `rgb(91 144 224 / .14)` | Fokusring, Tag-Hintergrund |
| `--color-accent-ink` | `#FFFFFF` | `#081527` | Text **auf** einer Akzentfläche |
| `--color-canvas` | `#FFFFFF` | `#0E1F38` | **Karten** |
| `--color-soft` | `#F6F8FB` | `#0A1830` | **App-Hintergrund** |
| `--color-line` | `#E2E8F0` | `#1D3455` | Trennlinien, Rahmen |
| `--color-ink` | `#1E2A3A` | `#E4ECF7` | Fließtext |
| `--color-ink-strong` | `#0C2043` | `#FFFFFF` | Überschriften |
| `--color-muted` | `#64748B` | `#8FA5C4` | Meta, Labels, Platzhalter |
| `--color-chrome` | `#FFFFFF` | `#081527` | Sidebar-/Topbar-Fläche |
| `--sidebar-surface` | `#FFFFFF` | `#081527` | Sidebar (kann ein Verlauf sein) |

> **Achtung, verwirrend:** `--color-canvas` sind die **Karten**,
> `--color-soft` ist der **App-Hintergrund**. Die Vorlage nennt sie
> surface/canvas. Beim Übertragen mappen: Vorlage `--surface` → `--color-canvas`,
> Vorlage `--canvas`/`--surface-2` → `--color-soft`. Das bleibt bewusst so —
> AGE-492 wollte nicht zwei Massen-Renames in einem Change.

`--color-chrome*` hieß bis AGE-492 `--color-night*`. Umbenannt, weil „night" im
hellen Theme Weiß bedeutet und ein Name, der das Gegenteil seines Werts behauptet,
die nächste Änderung in die Irre führt.

---

## 3. Typografie

- `--font-display: "Fraunces", Georgia, serif` — **nur** h1–h3 und Display.
- `--font-sans: "Inter", …` — alles andere.
- Cormorant Garamond ist entfallen.

**Selbst gehostet** (`public/fonts/`, 4 Dateien, 260 kB). Beide sind Variable
Fonts: eine Datei je Subset (latin, latin-ext) deckt alle Gewichte ab, deshalb
nennt `font-weight` einen Bereich. Kein Request an ein fremdes CDN — in
Deutschland ein Abmahnthema. Ein CI-Schritt hält das offen (siehe §6).

---

## 4. Marke

`CompassMark.tsx` — vierstrahliger Kompassstern im dünnen Ring,
`fill="currentColor"`. **Ein** Asset trägt beide Themes, weil es die Farbe seiner
Umgebung erbt; die Krone brauchte dafür ein zweites, das dauerhaft fehlte.

- `Logo lockup="full"` → Marke und Wortmarke **nebeneinander**
- `Logo lockup="mark"` → nur der Kompass
- Wortmarke `eff.bee.zee`, durchgehend klein, die Punkte in `--color-accent` —
  laut Vorlage das einzige Farbdetail
- Favicon: `public/brand/compass-favicon.svg`, Ring bei 16 px verstärkt
- Regeln (Vorlage §01): transparenter Hintergrund, Mindestabstand = halbe
  Markenhöhe, nie unter 24 px, nie in Versalien

---

## 5. Theme-Wahl

Mitglieder wählen ihr Theme in den Einstellungen.

- Ausgeloggt gilt **nur** `localStorage`, Default `hell`.
- Eingeloggt gewinnt `member_settings.theme` und überschreibt `localStorage`.
- Ein Inline-Skript in `index.html` setzt `data-variant` **vor dem ersten Paint**.
  Ohne das lädt die App für jeden navy-Nutzer sichtbar hell und springt um. Seine
  Regel muss zu `resolveInitialVariant` passen, sonst korrigiert der Provider
  danach sichtbar — genau der Flash, den das Skript verhindern soll.
- Der Serverwert kann prinzipbedingt nicht vor dem ersten Paint da sein; er
  braucht einen Roundtrip. Deshalb beides.
- Geschrieben wird dort, wo umgestellt wird (`EinstellungenPage`).
  `ThemeServerSync` liest nur: leitet man den Write aus einem Effect über
  `variant` ab, laufen Übernahme und Write im selben Commit und die lokale Wahl
  überschreibt den Serverwert — also genau verkehrt herum.

Der `DesignSwitcher` wird **nicht mehr gemountet** — die Einstellung ersetzt ihn.

---

## 6. Was CI festhält

TypeScript prüft Tailwind-Klassennamen nicht: eine Utility-Klasse ist ein String.
Zwei Zusagen hängen deshalb an einem grep-Schritt in `.github/workflows/ci.yml`,
nicht an einer Checkliste:

- keine zurückgezogenen Akzent-Tokens unter `src/` (ausgenommen `src/vision/`,
  der eingefrorene Vision-Dummy — eigener Namensraum, von nirgends importiert,
  in keinem Bundle)
- keine Schrift von einem fremden CDN in `src/` oder `index.html`
