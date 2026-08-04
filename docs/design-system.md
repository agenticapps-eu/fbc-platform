# Design-System — eff.bee.zee

> **Verbindliche Vorlage ist `docs/design-system.html`** — Farbrampen, Typo-Skala,
> Logo-Pfade, Komponentenbeispiele, beide Themes live umschaltbar. Diese Datei
> fasst nur zusammen, was daraus im Code gilt, und nennt die Stellen.
>
> **Lebende Fassung im Code:** `/styleguide` (nur im Dev-Modus). Dort sind Tokens,
> Rampe und Primitives echt gerendert statt beschrieben — bei Zweifeln gilt der
> Code, nicht dieser Text.

Löst die Richtung „Schwarz & Gold" (AGE-237) ab, die ihrerseits „Smaragd & Gold"
(P7) abgelöst hatte. Umgesetzt in AGE-492, im Umfang korrigiert in AGE-499.

---

## 1. Markenanmutung

- **Blau ist die einzige Akzentfamilie.** Die früheren Akzentfarben und jeder
  Zweitakzent sind ersatzlos entfallen.
- **Zwei Themes, gleichrangig:** `hell` und `navy`. Navy färbt **nur den Rahmen**
  (Sidebar, Topbar); der Inhalt bleibt in beiden Fassungen hell. Damit gibt es
  bewusst **keinen dunklen Lesemodus** — bis AGE-499 kippte `navy` die ganze
  Oberfläche, das war ein Richtungswechsel und kein Versehen.
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

**Inhalt — in beiden Themes identisch.** Diese Tokens stehen im `@theme` und in
keinem Override. Wer eines davon in den `navy`-Block schreibt, baut den
Dark-Reading-Mode zurück, den AGE-499 abgeschafft hat.

| Token | Wert | Verwendung |
| --- | --- | --- |
| `--color-accent` | `#2F6BD1` | Primäraktion, Links |
| `--color-accent-strong` | `#1F53B0` | Hover, kräftigere Akzente |
| `--color-accent-soft` | `#EFF5FD` | Fokusring, Tag-Hintergrund |
| `--color-accent-ink` | `#FFFFFF` | Text **auf** einer Akzentfläche |
| `--color-canvas` | `#FFFFFF` | **Karten** |
| `--color-soft` | `#F6F8FB` | **App-Hintergrund** |
| `--color-line` | `#E2E8F0` | Trennlinien, Rahmen |
| `--color-ink` | `#1E2A3A` | Fließtext |
| `--color-ink-strong` | `#0C2043` | Überschriften |
| `--color-muted` | `#626F85` | Meta, Labels, Platzhalter |
| `--color-scrim` | `rgb(8 21 39 / .6)` | Overlays — dunkel in **beiden** Themes |

`--color-muted` weicht gemessen von der Vorlage ab: deren `#64748B` trifft auf
`--color-soft` nur 4.47:1 und verfehlt AA für Fließtext um 0.03 — und dort steht
der meiste gemutete Text. `--color-scrim` existiert, weil die Overlays auf
`bg-chrome/60` lagen und Chrome im hellen Theme Weiß ist: ein weißer Schleier
über weißem Inhalt verdunkelt nichts (Regression aus dem `night→chrome`-Rename).

**Rahmen — das Einzige, was `navy` umfärbt.**

| Token | hell | navy | Verwendung |
| --- | --- | --- | --- |
| `--color-chrome` | `#FFFFFF` | `#081527` | Sidebar-/Topbar-Fläche |
| `--color-chrome-elevated` | `#F6F8FB` | `#0E1F38` | abgesetzte Fläche im Rahmen |
| `--color-chrome-border` | `#E2E8F0` | `rgb(255 255 255 / .08)` | Trennlinien im Rahmen |
| `--color-on-chrome` | `#475569` | `#9FB4D2` | Navigationstext |
| `--color-on-chrome-muted` | `#64748B` | `#8FA5C4` | Gruppentitel im Menü |
| `--color-chrome-active` | `#EFF5FD` | `#1F53B0` | Fläche des aktiven Eintrags |
| `--color-on-chrome-active` | `#1F53B0` | `#FFFFFF` | Schrift des aktiven Eintrags, Logo |
| `--color-accent-on-chrome` | `#2F6BD1` | `#5B90E0` | die Punkte der Wortmarke |
| `--sidebar-surface` | `#FFFFFF` | `#081527` | Sidebar (kann ein Verlauf sein) |

Die drei `*-active`/`accent-on-chrome`-Tokens sind eigene Werte statt
`accent`/`accent-soft`, weil das Chrome seit AGE-499 dunkel sein kann, während
der Inhalt hell bleibt: `#EFF5FD` wäre dort ein grelles Rechteck, und der
Inhalts-Akzent `#2F6BD1` steht auf `#081527` bei 2.6:1.

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
Deutschland ein Abmahnthema. Ein CI-Schritt hält das offen (siehe §7).

---

## 4. Marke

`CompassMark.tsx` — vierstrahliger Kompassstern, dessen Zacken an allen vier
Spitzen **aus dem Ring ausbrechen** (AGE-499; vorher lag der Stern innen und die
Marke las wie ein gefüllter Kreis mit Muster). `fill="currentColor"`: **ein**
Asset trägt beide Themes, weil es die Farbe seiner Umgebung erbt; die Krone
brauchte dafür ein zweites, das dauerhaft fehlte.

- `Logo lockup="full"` → Marke und Wortmarke **nebeneinander**
- `Logo lockup="mark"` → nur der Kompass
- `Logo onChrome` → steht auf der Sidebar-/Topbar-Fläche und nimmt die
  Chrome-Tokens. Das Logo kennt sein Theme nicht, aber sein Aufrufer kennt seine
  Fläche.
- Wortmarke `eff.bee.zee`, durchgehend klein, die Punkte in `--color-accent` —
  laut Vorlage das einzige Farbdetail
- Favicon: `public/brand/compass-favicon.svg`, Ring auf 3.5 verstärkt (`r=15.5`
  statt `16.5`). **Beide Dateien zusammen ändern** — sonst trägt der Tab eine
  andere Marke als die App.
- Regeln (Vorlage §01): transparenter Hintergrund, Mindestabstand = halbe
  Markenhöhe, nie unter 24 px, nie in Versalien

---

## 5. Rahmen und Seitenköpfe

Aus AGE-499, `src/components/AppShell.tsx` und `src/components/ui/PageHero.tsx`.

- **Sidebar bündig an der Viewport-Kante**, volle Höhe, `border-right`, ohne
  Rundung und Schatten. Logo im Sidebar-Kopf, Topbar rechts daneben; beide
  Kopfzeilen 4 rem, damit die Trennlinien fluchten.
- **Breite als eine CSS-Variable** (`--fbc-sidebar-w`): 16 rem offen, 4.5 rem
  eingeklappt, Zustand gerätelokal in `localStorage`. Zwei Tailwind-Klassen für
  aside-Breite und Inhalts-Versatz laufen auseinander.
- **Inhaltsbreite 1440 px**, Ausnahme `NARROW_ROUTES` (Login, Onboarding,
  Einstellungen, Profil-Editor) mit 760 px. Der frühere 720-px-Default hatte die
  mehrspaltigen Raster des Dashboards stillgelegt.
- **Genau ein Anmelde-Weg im Rahmen**, und der steht in der Topbar.
- **`PageHero`** trägt den Seitenkopf: Bild rechts auslaufend, darüber ein
  Verlauf von der Kartenfläche nach transparent mit **zwei** Stopps in der
  Kartenfarbe — mit einem scheint das Bild unter dem Fließtext durch. Motiv je
  Route in `src/config/formatHero.ts`; die vier Formularseiten bekommen bewusst
  keinen. Bilder liegen selbst gehostet unter `public/images/` (Lizenz in
  `CREDITS.md`), aus demselben Grund wie die Fonts.

---

## 6. Theme-Wahl

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

## 7. Was CI festhält

TypeScript prüft Tailwind-Klassennamen nicht: eine Utility-Klasse ist ein String.
Zwei Zusagen hängen deshalb an einem grep-Schritt in `.github/workflows/ci.yml`,
nicht an einer Checkliste:

- keine zurückgezogenen Akzent-Tokens unter `src/` (ausgenommen `src/vision/`,
  der eingefrorene Vision-Dummy — eigener Namensraum, von nirgends importiert,
  in keinem Bundle)
- keine Schrift von einem fremden CDN in `src/` oder `index.html`
