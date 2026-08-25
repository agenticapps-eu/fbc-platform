# design-system Specification

## Purpose

TBD - created by archiving change redesign-blue-theme-system. Update Purpose after archive.
## Requirements
### Requirement: The platform ships exactly two themes over one token vocabulary

The system SHALL offer exactly two themes, `hell` and `navy`, selected through a
single `data-variant` attribute on the root `<html>` element. Both themes SHALL
define the same token names and differ only in their values, so that no component
knows which theme is active and no component branches on one. The default SHALL be
`hell`. Any other `data-variant` value — including values retired from earlier
variant sets — SHALL resolve to `hell` without error.

The themes SHALL differ **only in the chrome** — the sidebar and topbar surface and
what sits on it. The content layer (cards, page background, body copy, rules, the
accent, the status colours) SHALL carry identical values in both. `navy` is a brand
variant of the frame, not a reading mode: the system therefore offers **no dark
content theme**, and a member who wants dark body copy will not find it. This is a
deliberate trade for the one look the binding template's reference images show —
a dark sidebar beside a light page.

Blue SHALL be the only **interactive** accent family. The accent tokens are
`--color-accent`, `--color-accent-strong`, `--color-accent-soft` and
`--color-accent-ink`, and they SHALL remain the only colours that signal that
something can be clicked, is focused, or is active. The system SHALL NOT define a
second interactive accent, a gold token, or a per-format accent palette.

The system MAY define one further colour family whose sole job is to **identify a
subject area** — Events, members, messages, activity, contacts, compass,
highlights. That family SHALL be distinguishable from the interactive accent by
name, SHALL NOT be used for links, buttons, focus rings or active states, and
SHALL NOT be keyed on a format, a membership tier, or any other axis than the
subject area. Being content-layer colour, each of its tokens SHALL be defined
**once** and SHALL carry the same value in both themes — the `navy` block
overrides chrome tokens only, deliberately.

This carve-out is narrow on purpose. It exists because a card that names a subject
area reads faster with a coloured mark beside its words, and for no other reason.
It is not a licence to colour anything else.

Because a dark chrome can now stand beside a light page, the chrome SHALL carry its
own foreground tokens — `--color-on-chrome`, `--color-on-chrome-muted`,
`--color-chrome-active`, `--color-on-chrome-active` and `--color-accent-on-chrome`.
Components on the chrome SHALL read those and SHALL NOT reach for the content
tokens: `--color-ink` on a dark sidebar is dark on dark, and the content accent
reaches only 2.6:1 there.

Body copy SHALL use `--color-ink`, which is anthracite and never pure black.

Theme selection is not addressable by URL. A `?variant=` query parameter SHALL be
ignored entirely, including when it names a live theme — it SHALL NOT override a
stored preference.

#### Scenario: A retired variant identifier in storage resolves to the default

- **WHEN** the stored preference is `sommerfest`, `b`, `linkedin`, or any value that
  is neither `hell` nor `navy`
- **THEN** the `hell` theme is applied and the app renders normally

#### Scenario: A variant query parameter is ignored

- **WHEN** a visitor whose stored preference is `navy` loads the app with
  `?variant=hell` or `?variant=sommerfest`
- **THEN** the query parameter has no effect and the `navy` theme is applied

#### Scenario: Switching to navy leaves the content untouched

- **WHEN** a member switches from `hell` to `navy`
- **THEN** the sidebar and its foreground change, and cards, page background, body
  copy, rules, status colours and subject-area colours keep the values they had

#### Scenario: Components carry no theme branch

- **WHEN** a component renders a surface, text or accent colour
- **THEN** it reads a token whose name is identical in both themes, and contains no
  conditional keyed on the active theme

#### Scenario: A second accent family is not introduced

- **WHEN** the token vocabulary is inspected
- **THEN** no `gold` and no `--accent2` token exists, no token is keyed on a format
  or a membership tier, and every utility that expresses interactivity — link,
  button, focus ring, active state — resolves to the blue ramp

#### Scenario: A subject-area colour never signals interactivity

- **WHEN** a card, button or link is inspected that sits inside a subject area
- **THEN** its interactive colours come from the accent tokens, and the
  subject-area token appears only on the identifying mark or the surface behind it

### Requirement: The theme is applied before the first paint

The system SHALL set the root `data-variant` attribute before the application
bundle executes, so that no frame is painted in a theme the visitor did not choose.

The pre-paint resolution SHALL read only what is available synchronously on the
device — the stored local preference, otherwise the default — and SHALL apply
exactly the rule the runtime resolver applies to those same sources. Where the two
disagree, the runtime would visibly correct the pre-paint value, which is the flash
this requirement exists to prevent.

A server-side preference is by definition unavailable before first paint, so it is
deliberately outside that rule: a member whose server value is `navy` and whose
device holds `hell` SHALL see one `hell` frame first. When the server value arrives
and differs, the system SHALL apply it once and immediately rather than leaving the
member on the wrong theme; this is a single switch, not an animated transition. On
the ordinary path — same device, unchanged choice — the two agree and nothing moves.

#### Scenario: A returning visitor who chose navy sees no light frame

- **WHEN** a visitor whose stored preference is `navy` loads the app
- **THEN** the first painted frame is already in the `navy` theme

#### Scenario: Storage is unreadable

- **WHEN** the pre-paint resolution cannot read `localStorage` (private mode,
  blocked storage)
- **THEN** the default `hell` theme is applied and the app boots normally

#### Scenario: The server preference differs from the device

- **WHEN** a member whose `member_settings.theme` is `navy` opens the app on a device
  whose stored preference is `hell`
- **THEN** the first frame is `hell`, and the app switches to `navy` once, when the
  server value arrives

### Requirement: The theme is a member preference, not a review tool

The system SHALL let a signed-in member choose their theme in the settings, and
SHALL persist that choice in `member_settings.theme`. For a signed-out visitor the
choice SHALL live only in `localStorage` and default to `hell`.

On sign-in the stored server value SHALL win and overwrite the local value, so that
a member's choice follows them across devices. A change made while signed in SHALL
be written to both, and SHALL create the member's `member_settings` row if they have
none. Signing out SHALL NOT reset the theme.

Because the control lives in the member settings, a signed-out visitor SHALL have no
way to switch themes; they are served whatever was last chosen on that device. On a
shared device this means the next visitor starts in the previous one's theme until
they sign in, at which point their own server value wins — accepted deliberately,
because the theme carries no account meaning.

Writing to the server can fail while the local write cannot. When the server write
fails the system SHALL keep the chosen theme applied on the device and SHALL tell
the member it did not reach their other devices; it SHALL NOT fail silently, because
the next sign-in would then quietly restore the old value.

The system SHALL NOT expose the development variant switcher to members; the
settings control replaces it.

#### Scenario: The server value wins at sign-in

- **WHEN** a member whose `member_settings.theme` is `navy` signs in on a device
  whose `localStorage` holds `hell`
- **THEN** the `navy` theme is applied and `localStorage` is updated to `navy`

#### Scenario: A signed-out visitor is served the device's choice

- **WHEN** a signed-out visitor loads the app on a device whose stored preference is
  `navy`
- **THEN** the `navy` theme is applied, resolved from `localStorage` alone, and no
  control is offered to change it

#### Scenario: The server write fails

- **WHEN** a signed-in member switches theme and the write to `member_settings`
  fails
- **THEN** the chosen theme stays applied on the device and the member is told the
  choice was not saved

#### Scenario: The choice survives sign-out

- **WHEN** a member signs out
- **THEN** the theme they last chose remains applied

### Requirement: Design tokens are the only styling contract

The system SHALL define all colour, radius, shadow and typography tokens in
`src/index.css` as a Tailwind v4 `@theme` block with a single
`html[data-variant="navy"]` override. There is no `tailwind.config.js`.

Because Tailwind utility names are strings, the type checker cannot detect a stale
token reference. The system SHALL therefore enforce the absence of retired token
names by a text search in CI, not by review alone. The search SHALL cover `gold` and
the other retired names — `--color-night`, `--accent2`, `--color-fmt-*`,
`data-card-style` — and SHALL cover shipping code under `src/`. The frozen
`src/vision/` dummy is excluded: it is imported by nothing, reaches no bundle, and
keeps its own `--ebz-gold-*` namespace.

#### Scenario: A retired token name reaches the default branch

- **WHEN** a change introduces a `gold` token or utility, or one of `--color-night`,
  `--accent2`, `--color-fmt-*`, `data-card-style`, anywhere under `src/` outside
  `src/vision/`
- **THEN** CI fails

### Requirement: Fonts are served from the application's own origin

The system SHALL serve its webfonts from its own origin and SHALL NOT request fonts
from a third-party host at runtime. Fraunces carries display type, Inter carries
everything else.

#### Scenario: No third-party font request on load

- **WHEN** the application is loaded
- **THEN** every font URL it requests is same-origin, and the source references no
  third-party font host — neither `fonts.googleapis.com` nor `fonts.gstatic.com`
  nor any other CDN

### Requirement: The brand mark is a single theme-adaptive vector

The system SHALL render the brand mark as an inline SVG compass star that takes its
colour from `currentColor`, so that one asset serves both themes. The system SHALL
NOT keep a raster lockup, nor a second asset selected by theme.

The star's four points SHALL break out of the surrounding ring rather than sit
inside it — enclosed, the mark reads as a filled circle with a pattern instead of a
compass. The favicon SHALL carry the same silhouette, so the browser tab and the
application do not show two different marks.

The wordmark is `eff.bee.zee`, lowercase throughout, with the separating dots in
the accent colour. On the chrome the mark SHALL use the chrome's foreground and
accent tokens. Accessible names for the mark SHALL read `eff.bee.zee`.

#### Scenario: One asset serves both themes

- **WHEN** the brand mark is rendered on a light surface and on a dark surface
- **THEN** the same component is used in both, inheriting the surrounding colour

#### Scenario: The mark and the favicon show the same shape

- **WHEN** the inline mark and `compass-favicon.svg` are compared
- **THEN** both show the star breaking out of the ring

### Requirement: The application shell docks the navigation to the viewport edge

The sidebar SHALL sit flush against the left edge of the viewport across the full
height, separated from the content by a right-hand rule. It SHALL NOT be rounded,
shadowed, inset, or centred inside a container — it is the frame of the
application, not a card floating on it.

The brand mark SHALL sit at the top of the sidebar, and the topbar SHALL begin to
its right; the two SHALL share one height so their bottom rules meet on a single
line. Below `lg` the sidebar SHALL instead open as an off-canvas drawer, and the
mark SHALL move into the topbar so it is never absent.

The sidebar SHALL be collapsible to an icon rail. Collapsed, it SHALL show the
mark and the item icons only, and each item SHALL keep its name reachable by
pointer and by assistive technology. The collapsed state SHALL persist across
reloads and SHALL stay device-local: it describes a workstation, not an account.

Every navigation item SHALL carry an icon, and the active item's icon SHALL be
filled where the others are drawn as lines — collapsed, the icon is the only thing
left to carry the selection.

The signed-out sign-in path SHALL exist exactly once in the frame: in the topbar.
The sidebar SHALL NOT repeat it.

#### Scenario: The sidebar meets the viewport edge

- **WHEN** the application is rendered at `lg` or wider
- **THEN** the sidebar touches the left and top edge of the viewport, runs the full
  height, and is separated from the content only by its right-hand rule

#### Scenario: The rail keeps every destination reachable

- **WHEN** a member collapses the sidebar and reloads the page
- **THEN** the sidebar is still collapsed, shows the mark and the icons, and each
  icon exposes its destination's name

#### Scenario: The signed-out visitor finds one way in

- **WHEN** a signed-out visitor looks at the frame
- **THEN** exactly one sign-in control is offered, and it sits in the topbar

### Requirement: Content uses the available width; only reading columns are capped

Pages SHALL use the width the viewport offers, up to 1440 px beside the sidebar.
A width cap SHALL apply only to routes that are a form or a single column of prose
— sign-in, onboarding, settings and the profile editor — and SHALL sit at 760 px.

The rule SHALL be stated as a list of the capped routes, not of the wide ones: a
default cap silently starves every multi-column layout added later, which is how
`lg:grid-cols-3` and `xl:grid-cols-4` on the dashboard came to be classes that
could never take effect.

#### Scenario: A multi-column page gets its columns

- **WHEN** the member dashboard renders at 1440 px
- **THEN** its tile grid and its two-column section resolve at their intended
  breakpoints, and no card title is truncated for want of width

#### Scenario: A form keeps a readable measure

- **WHEN** the settings page renders at 1440 px
- **THEN** its column stays capped rather than stretching across the full width

### Requirement: Every content page opens with an image header

Each page reachable from the navigation SHALL open with a header carrying a title,
a one-line claim and a photograph. The photograph SHALL bleed to the right and
SHALL be overlaid by a gradient that keeps the text side an even surface: body copy
SHALL NOT sit on the image.

Each such page SHALL have its **own** motif, held in one route table rather than at
the call sites. A shared default image is not acceptable — a header that repeats
across pages replaces the orientation it exists to give.

Form and reading routes (sign-in, onboarding, settings, profile editor) SHALL NOT
carry an image header: over a form it is decoration in front of the task.

#### Scenario: A navigation page opens with its own motif

- **WHEN** a member opens Kompass, Academy, Events, Mitglieder or Aktivität
- **THEN** each shows a header with title, claim and a photograph that page does not
  share with the others

#### Scenario: The header text stands on an even surface

- **WHEN** an image header renders
- **THEN** the title and claim sit on the flat gradient side, not on the photograph

### Requirement: Imagery is served from the application's own origin

The system SHALL serve every photograph from its own origin and SHALL NOT request
imagery from a third-party host at runtime — the same rule the webfonts follow, for
the same reason: a request to a foreign CDN on page load discloses the visitor.

Licence and source of every image SHALL be recorded in the repository next to the
files, including what is not yet known about the attribution.

#### Scenario: No third-party image request on load

- **WHEN** any page with an image header is loaded
- **THEN** every image URL it requests is same-origin, and the source contains no
  reference to an image CDN

#### Scenario: Provenance is recorded

- **WHEN** the image directory is inspected
- **THEN** each file is listed with its source and licence

### Requirement: The navigation shows only what the launch actually delivers

The system SHALL present exactly seven member-facing menu entries, in two labelled
groups: _Entdecken_ — Start, Academy, Events, Mitglieder, Aktivität — and _Mein
Bereich_ — Mein Profil, Einstellungen. The group headings SHALL remain visible; two
groups of five and two are still structure worth naming.

Staff-only navigation SHALL sit outside that count. The administration entry
appears for administrators alone and is not part of the member-facing seven, so a
check on the rendered sidebar SHALL account for the viewer's role rather than
asserting a bare total.

A route SHALL NOT appear in the menu when it has no content to show at launch. A
route removed from the menu SHALL keep working when opened directly, unless a
redirect is stated for it, so links and bookmarks do not break and restoring the
entry is a single declaration.

No rendered link SHALL target a route that only redirects elsewhere. A menu entry
withdrawn in an earlier change leaves such links behind in cards and widgets, where
they read as working paths and lead nowhere.

The menu SHALL be identical for every membership level; rights gate content, not
navigation.

#### Scenario: The sidebar lists exactly the launch scope

- **WHEN** a signed-in member without a staff role renders the sidebar
- **THEN** it shows Start, Academy, Events, Mitglieder, Aktivität under
  _Entdecken_ and Mein Profil, Einstellungen under _Mein Bereich_, and nothing else

#### Scenario: An administrator additionally sees their own section

- **WHEN** a member with the `admin` role renders the sidebar
- **THEN** the same seven entries appear plus the administration section, and the
  member-facing seven are unchanged

#### Scenario: A demoted route stays reachable

- **WHEN** a member opens `/mitgliedschaft`, `/meine-kurse` or `/kontakte` directly
- **THEN** the page renders, although no menu entry leads there

#### Scenario: No link points at a redirect-only route

- **WHEN** the rendered interface is searched for links to routes that only redirect
- **THEN** none is found — in particular no card or widget still offers
  `/meine-chancen` or `/matching`

#### Scenario: An empty group is not rendered

- **WHEN** every entry of a group has left the menu
- **THEN** the group heading is not rendered either

### Requirement: Every main page opens empty with an invitation, not a status report

The system SHALL give every main page an empty state that names what will appear
there and offers one concrete action the member can take now. An empty state SHALL
NOT be phrased as an absence of data ("Keine Daten vorhanden", "Noch keine X") when
the member can do something about it.

The rule SHALL apply to **data-dependent regions** — a list, feed, collection or
summary whose content comes from rows that may not exist yet — and SHALL NOT
apply to pages made of static content or of a form that is always present. A
settings form, a page of fixed editorial content and a wizard entry point are
never "empty"; demanding a state for them would produce a placeholder that can
never render.

The regions in scope at launch are: the activity feed, the events list, the member
directory, the member's own profile when it is unfilled, the conversation list,
the member's own events, and the contacts and courses regions of the
menu-withdrawn routes. The academy and the membership page are **out of scope** —
both always render content today (a fixed set of lessons, the level summary), so
an empty state for them could never appear; the academy gains one when its library
becomes data-driven.

Where the member genuinely cannot act — a page whose content depends on other
people or on a later release — the empty state SHALL say what will fill it and
when, rather than leaving a bare negation, and SHALL NOT offer a control that does
nothing.

A filtered view that returns nothing SHALL be distinguished from a view that is
empty because nothing exists yet, and SHALL offer to clear the filters.

#### Scenario: An actionable empty state offers the action

- **WHEN** the activity feed has no posts and the member may write one
- **THEN** the empty state invites them to post and renders the control that does it

#### Scenario: A dependent empty state explains rather than negates

- **WHEN** a page cannot be filled by the member's own action
- **THEN** the empty state says what will appear there and what has to happen
  first, and offers no inert control

#### Scenario: Every enumerated region has one

- **WHEN** a member signs in to an account with no data and visits each page
  carrying a region named by this requirement
- **THEN** each region shows an empty state meeting these rules, none shows a bare
  paragraph or a blank area

#### Scenario: A static page needs no empty state

- **WHEN** a page consists of a form or fixed content that is always present
- **THEN** no empty state is required or rendered for it

#### Scenario: No result from filters is not the same as no data

- **WHEN** a member's filter combination matches nobody
- **THEN** the empty state says so and offers to reset the filters, distinct from
  the state shown when no members exist at all

### Requirement: Ein offenes Overlay hält die Seite dahinter still

Jedes modale Overlay SHALL das Scrollen des Dokuments sperren, solange es offen
ist, und die Scroll-Position beim Schließen **exakt** wiederherstellen.

Die Sperre SHALL `position: fixed` auf dem `body` setzen, zusammen mit einem
negativen `top` in Höhe der gemerkten Scroll-Position sowie `left` und `right`
auf `0`. `overflow: hidden` allein SHALL NOT genügen: auf iOS Safari scrollt
der Inhalt darunter weiter.

Das Wiederherstellen SHALL NOT entfallen. `position: fixed` setzt den
Dokument-Scroll auf null; ein Overlay, das nur die Stile zurücknimmt, lässt den
Leser am Seitenanfang zurück und ist damit schlechter als gar keine Sperre.

Die Sperre SHALL bereits vorhandene Inline-Werte dieser vier Eigenschaften
sichern und beim Freigeben genau wiederherstellen, statt sie zu leeren.

Ein Ausgleich für die Breite des verschwindenden Scrollbalkens SHALL NOT
hinzukommen: `html` trägt `scrollbar-gutter: stable`, der Platz ist ohnehin
reserviert, und ein zusätzliches `padding-right` erzeugte erst den seitlichen
Versatz, den es verhindern soll.

#### Scenario: Bei offenem Overlay steht die Seite

- **WHEN** ein Overlay geöffnet wird, während die Seite 600 px weit gescrollt ist
- **THEN** trägt der `body` `position: fixed` und `top: -600px`

#### Scenario: Nach dem Schließen steht der Leser wieder dort, wo er war

- **WHEN** dasselbe Overlay geschlossen wird
- **THEN** tragen die vier Eigenschaften wieder ihre Ausgangswerte
- **AND** die Scroll-Position ist wieder exakt 600 px

#### Scenario: Zwei Overlays entsperren sich nicht gegenseitig

- **WHEN** zwei Overlays offen sind und eines geschlossen wird
- **THEN** bleibt die Seite gesperrt
- **AND** erst das Schließen des zweiten gibt sie frei und stellt die Position
  wieder her

### Requirement: Ein Overlay mit `aria-modal` hält auch den Fokus

Ein Overlay, das sich als `aria-modal="true"` ausgibt, SHALL den Tastaturfokus
in sich behalten. Tab SHALL in drei Fällen umlenken:

1. auf dem letzten fokussierbaren Element des Overlays zum ersten,
2. mit Shift auf dem ersten zum letzten,
3. **von außerhalb des Overlays** zum ersten (mit Shift: zum letzten).

Fall 3 SHALL NOT entfallen. Drei der vier Overlays versetzen den Fokus beim
Öffnen nicht; ohne ihn stünde er hinter dem Dialog und eine Falle, die nur an
den Rändern des Containers greift, wäre dort wirkungslos.

Beim Öffnen SHALL der gemeinsame Hook den Fokus **nicht** versetzen. Wohin er
zuerst geht, entscheidet das jeweilige Overlay — die Bild-Lightbox etwa setzt
ihn genau einmal beim Öffnen, damit ein Bildwechsel ihn nicht jedes Mal auf
„Schließen" zurückreißt.

Sind mehrere Overlays offen, SHALL **nur das oberste** Tab behandeln.

Beim Schließen SHALL der Fokus an das Element zurückkehren, das ihn vor dem
Öffnen hatte — nur wenn dieses noch im Dokument hängt, ohne Scrollen
(`preventScroll`) und **nach** dem Wiederherstellen der Scroll-Position.

Fokussierbar SHALL heißen: Verweise mit `href`, Schaltflächen, Eingabe-,
Auswahl- und Textfelder sowie Elemente mit `tabindex` — jeweils ohne
`disabled`, ohne `tabindex="-1"` und ohne `input[type="hidden"]`.

#### Scenario: Tab läuft im Overlay um

- **WHEN** der Fokus auf dem letzten fokussierbaren Element eines offenen
  Overlays steht und Tab gedrückt wird
- **THEN** erhält das erste fokussierbare Element des Overlays den Fokus

#### Scenario: Shift-Tab läuft rückwärts um

- **WHEN** der Fokus auf dem ersten fokussierbaren Element steht und Shift-Tab
  gedrückt wird
- **THEN** erhält das letzte fokussierbare Element den Fokus

#### Scenario: Tab von außerhalb springt hinein

- **WHEN** ein Overlay offen ist, der Fokus außerhalb davon liegt und Tab
  gedrückt wird
- **THEN** erhält das erste fokussierbare Element des Overlays den Fokus

#### Scenario: Nur das oberste Overlay fängt Tab

- **WHEN** zwei Overlays offen sind und Tab gedrückt wird
- **THEN** lenkt ausschließlich das zuletzt geöffnete um

#### Scenario: Der Fokus kehrt zum Auslöser zurück

- **WHEN** ein Overlay über eine Schaltfläche geöffnet und danach geschlossen wird
- **THEN** trägt diese Schaltfläche den Fokus wieder
- **AND** die wiederhergestellte Scroll-Position bleibt unverändert

### Requirement: Alle modalen Overlays teilen sich diese eine Regel

Sperre und Fokus-Falle SHALL aus **einem** gemeinsamen Hook in
`src/components/ui/` kommen, an dem jedes gemountete modale Overlay hängt —
Bild-Lightbox, Avatar-Zuschnitt, Feedback-Panel und die Off-Canvas-Navigation.

Vier Einzellösungen SHALL NOT an seine Stelle treten. Der Mangel ist nicht die
fehlende Sperre an einer Stelle, sondern die fehlende Regel: das nächste
Overlay entstünde sonst wieder ohne.

Ein Overlay, das nur per Stilregel ausgeblendet wird statt abgemeldet zu
werden, SHALL seinen Zustand beim Verlassen des zugehörigen Breakpoints
schließen. Sonst hinge die Sperre an einem Overlay, das niemand mehr sieht.

#### Scenario: Jedes gemountete Overlay sperrt

- **WHEN** eines der vier gemounteten Overlays geöffnet wird
- **THEN** ist das Dokument gesperrt, und beim Schließen wird die Position
  wiederhergestellt

#### Scenario: Die Off-Canvas-Navigation schließt am Breakpoint

- **WHEN** die Navigation unterhalb von `lg` geöffnet ist und die Breite `lg`
  erreicht
- **THEN** ist sie geschlossen und die Seite wieder frei

### Requirement: Ein einziger Satz trägt die wiederverwendbaren UI-Glyphen

Das System SHALL die wiederverwendbaren Oberflächen-Symbole aus einem Satz
beziehen, der an einer Stelle liegt und einen Stil führt (24er-Viewbox,
`currentColor`, einheitliche Strichstärke und Endenform). Ein solches Symbol
SHALL NOT ein zweites Mal als eigene Komponente in einer Feature-Datei entstehen.

Der Satz trägt **wiederverwendbare Glyphen**. Ausdrücklich **nicht** dazu gehören
und unangetastet bleiben:

- die Markenmarke, die eine eigene Anforderung hat und `currentColor` bereits
  richtig führt,
- die Kompassmarke, der Avatar-Platzhalter und andere illustrative Vektoren,
- Diagramme und Datenvisualisierungen, deren Maße sich aus ihren Daten ergeben
  und die den 24er-Glyphstil nicht treffen können.

Diese Abgrenzung ist der Kern der Anforderung, nicht ihr Kleingedrucktes: eine
Zusage „kein `<svg>` außerhalb des Satzes" wäre gegen den Baum falsch und stünde
gegen die bestehende Anforderung an die Markenmarke.

Aufgelöst werden die verstreuten **Glyphen**: die vier in der Anwendungshülle,
das Feedback- und das Suchsymbol, die drei in der Aktivität, der **doppelt
vorhandene** Kronen-Glyph und der zweite Satz für die Matching-Kategorien.

Die Einhaltung SHALL durch einen Test erzwungen werden, der gegen den Quellbaum
läuft — nicht durch eine gepflegte Liste und nicht durch Absicht. Der Test SHALL
die ausgenommenen Dateien namentlich führen, damit eine neue Ausnahme eine
sichtbare Entscheidung ist.

Der Satz SHALL weiterhin ohne Icon-Bibliothek auskommen: eine Abhängigkeit für
einige Dutzend Pfade brächte hunderte ungenutzte Symbole und einen zweiten Stil.

#### Scenario: Ein Glyph steht genau einmal im Baum

- **WHEN** der Quellbaum nach Komponenten durchsucht wird, die einen
  wiederverwendbaren Glyph selbst zeichnen
- **THEN** findet sich außerhalb des Satzes keine, und kein Glyph existiert in
  zwei Fassungen

#### Scenario: Die Markenmarke bleibt, wo sie ist

- **WHEN** der erzwingende Test läuft
- **THEN** meldet er die Markenmarke, die Kompassmarke, den Avatar-Platzhalter und
  die Diagramm-Vektoren nicht als Verstoß

#### Scenario: Der Satz trägt beide Themes ohne Verzweigung

- **WHEN** dasselbe Symbol im hellen und im dunklen Chrome gezeichnet wird
- **THEN** trägt es die jeweilige Vordergrundfarbe, ohne dass die Komponente das
  Theme kennt oder auf es verzweigt

### Requirement: Ein Kanon ordnet jedem Gegenstandsbereich Icon und Farbe zu

Das System SHALL die Zuordnung `Gegenstandsbereich → Icon + Farbe` als **eine**
Modulkonstante führen. Eine Fläche SHALL sie von dort beziehen und SHALL NOT sie
je Karte neu treffen; eine Verzweigung über Bereiche in mehreren Dateien SHALL
NOT entstehen.

Der Kanon SHALL ausschließlich Gegenstandsbereiche tragen — Events, Mitglieder,
Nachrichten, Aktivität, Kontakte, Kompass, Highlights. Bedien-Symbole wie
Chevron, Menü, Glocke und Lupe SHALL NOT im Kanon stehen: sie bezeichnen keinen
Bereich, und eine Bereichsfarbe für sie wäre erfunden. Sie gehören in den Satz.

Die Farben des Kanons SHALL Tokens der Bereichsfamilie sein und SHALL NOT als
Farbwert im Bauteil stehen.

#### Scenario: Zwei Flächen zeigen denselben Bereich gleich

- **WHEN** derselbe Gegenstandsbereich auf zwei verschiedenen Seiten als Karte
  erscheint
- **THEN** trägt er beide Male dasselbe Symbol in derselben Farbe

#### Scenario: Ein Bedien-Symbol hat keine Bereichsfarbe

- **WHEN** ein Chevron oder das Menü-Symbol gezeichnet wird
- **THEN** stammt der Glyph aus dem Satz, und der Kanon kennt für ihn keinen
  Eintrag

### Requirement: Farbe trägt nie allein eine Bedeutung

Das System SHALL eine Aussage niemals nur über Farbe treffen. Eine Bereichsfarbe
SHALL immer neben einem Symbol oder einem Wort stehen, das dieselbe Aussage
trägt.

#### Scenario: Ohne Farbe bleibt die Karte lesbar

- **WHEN** eine Karte, die einen Gegenstandsbereich bezeichnet, ohne
  Farbunterscheidung betrachtet wird
- **THEN** geht aus Symbol oder Beschriftung weiterhin hervor, welchen Bereich
  sie meint

### Requirement: Karten mit einem Gegenstandsbereich zeigen ihn

Das System SHALL Karten, die einen Gegenstandsbereich bezeichnen, mit dessen
Symbol und Farbe aus dem Kanon versehen — auf dem Dashboard, in den Events und im
Mitgliederverzeichnis, dort wo eine Karte heute nur Text trägt.

Angewendet wird der Kanon auf die Flächen, die **bestehen**. Neue Karten SHALL
NOT allein deshalb entstehen, weil das Konzeptbild sie zeigt.

#### Scenario: Eine Textkarte bekommt ihr Symbol

- **WHEN** eine Dashboard-Karte einen Gegenstandsbereich bezeichnet
- **THEN** trägt sie dessen Symbol und Farbe aus dem Kanon, und beide bleiben beim
  Themewechsel unverändert

### Requirement: Ein Titelbild-Feld trägt das Verhältnis, auf das zugeschnitten wird

Das System SHALL die Felder, die ein hochgeladenes Titelbild aufnehmen, im
Seitenverhältnis **3:1** anlegen — dem Verhältnis, auf das beide Zuschneider
(`ProfilPage`, `EventCoverPicker`) das Bild bereits festlegen. Ein Feld, dessen
Verhältnis von dem der gespeicherten Bilder abweicht, erzwingt eine Wahl
zwischen Beschnitt und leerer Fläche; die Abweichung selbst ist die Ursache,
nicht die gewählte `object-fit`-Regel.

Diese Anforderung gilt für genau drei Bauteile und SHALL NOT als allgemeine
Regel für jedes Bild der Anwendung gelesen werden:

- den Profilkopf (`ProfileHero`),
- das Bildfeld der Event-Kachel,
- das Bildfeld des Event-Kopfes.

Ausdrücklich **nicht** erfasst sind die Zuschnitt-Vorschauen in `ProfilPage`
und `EventCoverPicker`, die Bilder im Feed und die Karte des
Mitgliederverzeichnisses. Sie sind entweder Werkzeug-Oberfläche oder tragen
anderes Bildmaterial; eine Regel, die sie stillschweigend mitbindet, wäre beim
Archivieren sofort verletzt.

Der Profilkopf SHALL dabei **keinen Höhendeckel** mehr führen. Das nimmt die
Deckelung aus AGE-566 zurück. Ihre Begründung — eine mitwachsende Bahn schiebt
den Namen unter die Falz — bleibt richtig und ist der bewusst gezahlte Preis:
eine Bahn mit fester Höhe **ist** auf einer breiten Seite selbst rund 6:1, und
in ihr kann ein 2,7:1-Bild nur beschnitten oder von breiten Balken umgeben
sein. Nachgemessen bei 1370 px Fensterbreite: die Bahn steht in einer
Inhaltsspalte von 1217 px, war mit Deckel 1217 x 256 px (also selbst 4,75:1)
und schnitt von einem 2,70:1-Bild 43,2 % der Höhe weg. Ohne Deckel wird sie
1217 x 406 px.

Das Bild SHALL innerhalb seines Feldes **vollständig** sichtbar sein. Wo das
gespeicherte Bild nicht genau 3:1 ist, SHALL es eingepasst und nicht
beschnitten werden.

Die Bestände hinter den drei Feldern sind **zwei verschiedene Buckets**, und sie
sind getrennt gemessen — eine Zahl aus dem einen belegt für das andere nichts:

- `covers` (Profilbanner), alle 55 Objekte: Median 2,70:1, Minimum 1,33:1,
  Maximum 3,00:1, keines breiter als 3:1. Für die 49 Bilder zwischen 2,2:1 und
  2,95:1 bleiben schmale Ränder, für die vier Ausreißer darunter breitere.
- `event-covers` (Event-Titelbilder) auf PROD: **ein** Objekt, und das ist
  3,00:1 — es kam durch `EventCoverPicker`. Alles, was über das Produkt
  hochgeladen wird, ist 3:1 und sitzt randlos.

Der **Demo-Seed** ist die benannte Ausnahme und SHALL NOT als Gegenbeispiel
gegen diese Anforderung gelten: seine acht Event-Bilder (1,50:1, eines 1,33:1)
sind Seiten-Heldenbilder, die am Zuschneider vorbei hochgeladen werden. Sie
stehen unter dieser Regel mit rund 25 % freier Fläche je Seite in der Kachel.
Das ist ein Mangel des Seeds, der Material erzeugt, das das Produkt so nie
herstellt — nachzuziehen ist der Seed, nicht das Feld.

Geschützt ist das **gespeicherte** Bild, nicht das Original vor dem Zuschnitt.
Beide Upload-Wege schneiden zu, bevor gespeichert wird; eine Zusage über das
ursprüngliche Motiv könnte diese Anforderung nicht halten.

Die frei bleibende Fläche SHALL die Gestaltung tragen, die das Feld ohne Bild
zeigt, und diese SHALL **unter** dem Bild liegen, nicht neben ihm. Ein
Platzhalter, der nur im Zweig „kein Bild" existiert, lässt beim eingepassten
Bild die Fläche des Elternteils durchscheinen — eine flache Füllfarbe neben dem
Motiv liest sich als Fehler, nicht als Rahmung.

Marken, die auf dem Bild liegen — die Datumsmarke des Events — SHALL am
Container hängen bleiben und nicht am Bild. Sie beschriften die Kachel, nicht
das Motiv.

Der Nachweis SHALL im Browser geführt werden, aus den Maßen des Containers
(`getBoundingClientRect`), den natürlichen Maßen des Bildes und dem daraus
berechneten Faktor `s = min(bw/nw, bh/nh)`. Ein Test in jsdom SHALL
ausdrücklich nur als **strukturelle** Zusage gelten: unter `cover` wie unter
`contain` behält die `<img>`-Box die Maße ihres Containers, und nur der gemalte
Inhalt darin unterscheidet sich — jsdom sieht davon nichts und kann die
Einpassung daher nicht belegen.

#### Scenario: Das Bildfeld hat das Verhältnis des Zuschnitts

- **WHEN** eines der drei Bauteile mit einem Titelbild gerendert wird
- **THEN** ist sein Bildfeld 3:1

#### Scenario: Die Kachel hält 3:1 auch ohne Titelbild

- **WHEN** eine Event-Kachel ohne Titelbild gerendert wird
- **THEN** ist ihr Feld 3:1
- **AND** der Grund ist die Ausrichtung im Raster: bebilderte und unbebilderte
  Kacheln stehen nebeneinander und dürfen nicht ungleich hoch sein

#### Scenario: Der Event-Kopf ohne Titelbild bleibt ein flaches Band

- **WHEN** der Event-Kopf ohne Titelbild gerendert wird
- **THEN** ist er ein flaches Band und NICHT 3:1
- **AND** er steht allein, es gibt kein Raster auszurichten, und ein
  3:1-Platzhalter wäre auf einer 1100 px breiten Seite rund 370 px leerer
  Verlauf über dem Titel

#### Scenario: Ein gespeichertes 3:1-Bild sitzt randlos

- **WHEN** ein genau auf 3:1 zugeschnittenes Bild dargestellt wird
- **THEN** füllt es sein Feld vollständig aus, ohne Beschnitt und ohne freie
  Fläche

#### Scenario: Ein abweichendes Bild wird eingepasst, nicht beschnitten

- **WHEN** ein Bild mit einem anderen Verhältnis als 3:1 dargestellt wird
- **THEN** ist es vollständig sichtbar
- **AND** es fehlt an keiner Kante ein Teil des gespeicherten Bildes

#### Scenario: Die freie Fläche liegt unter dem Bild

- **WHEN** ein eingepasstes Bild sein Feld nicht ausfüllt
- **THEN** zeigt die verbleibende Fläche dieselbe Gestaltung wie das Feld ohne
  Bild

#### Scenario: Die Höhe des Profilkopfes folgt der Breite

- **WHEN** der Profilkopf bei zwei verschiedenen Fensterbreiten dargestellt wird
- **THEN** verhält sich seine Höhe wie seine Breite, ohne obere Schranke

#### Scenario: Ein schmaleres Fenster beschneidet nicht

- **WHEN** dieselbe Ansicht bei einer schmaleren Fensterbreite dargestellt wird
- **THEN** bleibt das ganze Bild sichtbar
- **AND** Größe und Lage der freien Fläche dürfen sich dabei ändern

#### Scenario: Die Datumsmarke bleibt am Feld

- **WHEN** ein Event-Bild eingepasst dargestellt wird und dabei freie Fläche
  entsteht
- **THEN** sitzt die Datumsmarke weiterhin an der Ecke des Feldes

