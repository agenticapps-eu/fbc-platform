# design-system

## MODIFIED Requirements

### Requirement: The right docked bar starts collapsed and remembers its own state

The right bar SHALL start **collapsed** for a member who has never set it. It is
an accompaniment, not the destination of the page, and a member who has not
asked for it SHALL NOT lose content width to it on first sight.

Collapsed, the bar SHALL remain a working entry point rather than an empty
stripe: it SHALL carry the same messages glyph the topbar uses and, when the
member has unread messages, the same count.

The bar's collapsed state SHALL persist across reloads and SHALL stay
device-local, exactly as the left sidebar's does, and SHALL be stored
**separately** from it. Collapsing the navigation SHALL NOT collapse the
messages bar, nor the reverse — they answer different questions about the same
workstation.

A failure to read or write that stored state SHALL leave the bar working and
merely forgetful. Storage is unavailable in some browsing modes, and a frame
that throws there would take the whole application with it.

**The initial default and the rail it produces are claims about `xl` and wider,
and only there.** The right bar docks at `xl`, not at `lg` — a threshold the
requirement "The application shell docks the navigation to the viewport edge"
establishes, together with the measurement that produced it. Between `lg` and
`xl` the bar is a drawer and there is no rail to start collapsed, so a promise
made from `lg` upward would be unkeepable across that whole band.

**The stored preference is untouched by this.** It is a single device-local
value that SHALL survive every width, including widths below `xl` where it has
nothing to render, and SHALL apply again unchanged when the viewport widens past
the threshold. Only the docked presentation is width-bound; persistence,
separation from the navigation's own state, and the tolerance for unavailable
storage all hold at every width.

#### Scenario: The first visit does not spend content width

- **WHEN** a member with no stored right-bar preference opens a page that
  carries the right bar, at `xl` or wider
- **THEN** the bar is collapsed to its rail, and the content keeps the width the
  rail does not occupy

#### Scenario: The rail still reports unread messages

- **WHEN** a member with unread messages sees the collapsed right bar
- **THEN** the rail shows the messages glyph carrying that count, and the count
  is reachable by assistive technology

#### Scenario: The two bars remember independently

- **WHEN** a member collapses the navigation, expands the right bar, and reloads
- **THEN** the navigation is still collapsed and the right bar is still expanded

#### Scenario: Unavailable storage costs only the memory

- **WHEN** the device denies access to local storage
- **THEN** the bar still opens and closes on demand, and the application renders
