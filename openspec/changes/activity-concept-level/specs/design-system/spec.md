## MODIFIED Requirements

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

## ADDED Requirements

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
