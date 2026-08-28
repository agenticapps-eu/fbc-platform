## ADDED Requirements

### Requirement: A message carries the time it was sent

The system SHALL display, on every confirmed message in a conversation, the time
at which it was sent, derived from the message's stored `created_at`.

The time SHALL be rendered in German locale convention, in a `<time>` element
whose machine-readable value is the full stored timestamp.

A message sent on the current day SHALL show hours and minutes. A message sent
before the current day SHALL additionally show its day and month, so that an
older message is never presented as a bare time of day with nothing to date it.

The displayed time SHALL be expressed in the viewing member's own timezone; two
members in different timezones will therefore see different times for the same
message.

A message that has not yet been confirmed by the server SHALL NOT display a
time. Its optimistic row carries the sending device's clock, while the confirmed
row carries the server's; showing the first would make the displayed time jump
by the difference between the two clocks at the moment the confirmation arrives.

The time SHALL be legible against both message backgrounds — the sender's own
and the counterpart's — in both themes.

The system SHALL NOT group messages under date separators. Only the time of day
is shown, on the message itself.

#### Scenario: A confirmed message shows its send time

- **WHEN** a conversation renders a message that the server has confirmed
- **THEN** the message displays the time of day derived from its `created_at`,
  and exposes the full timestamp as the machine-readable value of a `<time>`
  element

#### Scenario: A message from an earlier day is dated

- **WHEN** a conversation renders a confirmed message sent before the current day
- **THEN** its day and month are shown alongside the time of day

#### Scenario: An unconfirmed message shows no time

- **WHEN** a message has been sent optimistically and not yet confirmed
- **THEN** no time is displayed on it
- **AND WHEN** the server's confirmation replaces it
- **THEN** the time appears, taken from the server's `created_at`

#### Scenario: The time does not depend on the sending device's clock

- **WHEN** a displayed time is compared against the stored `created_at`
- **THEN** it is derived from that stored value, never from a clock read in the
  browser at render time

### Requirement: A member can pick an emoji from the message input

The system SHALL offer, in the message input of a conversation, a control that
opens a searchable picker over the full emoji set, and SHALL insert the chosen
emoji into the message being composed.

The picker SHALL be searchable in German: a member who types a German word
SHALL find the emoji that word names. An emoji set labelled only in English does
not satisfy this requirement.

Search SHALL match without regard to letter case or to German diacritics, so
that a member who types `GRUN`, `grün` or `gruen` reaches the same results.

The picker SHALL offer the emoji in their neutral form. Skin-tone variants are
not selectable through it; a member may still type or paste them, because the
message body remains free text.

The picker SHALL be dismissible with the Escape key and by activating anything
outside it, and SHALL be operable entirely from the keyboard: reachable by tab,
opened by Enter or Space, with the caret placed in its search field on opening,
the emoji grid reachable from there by arrow keys, and a choice made by Enter.

The picker's surface SHALL carry an accessible name, and each selectable emoji
SHALL carry an accessible name naming that emoji in German, so that it is not
announced only as its own glyph.

The emoji SHALL be inserted at the caret position in the text being composed,
not appended at its end, and focus SHALL return to the input after a choice is
made, so that typing can continue without a further click.

The picker SHALL be available in both variants of the conversation — the full
page and the docked window — and SHALL NOT reduce the width available to the
text input in either.

The picker's surface SHALL be rendered outside the conversation's own subtree,
so that no ancestor's `transform`, `filter` or `backdrop-filter` can capture its
positioning.

The emoji data SHALL NOT be part of the bundle loaded before sign-in; it SHALL
be fetched only when the picker is first opened.

The system SHALL render emoji as the operating system draws them, and SHALL NOT
ship its own emoji images.

#### Scenario: A chosen emoji lands at the caret

- **WHEN** a member places the caret inside partially written text and chooses an
  emoji from the picker
- **THEN** the emoji is inserted at that position, the surrounding text is
  preserved, and focus returns to the input

#### Scenario: German search finds the emoji

- **WHEN** a member types a German noun that names an emoji into the picker's
  search
- **THEN** that emoji is among the results

#### Scenario: The picker opens in the docked window without narrowing the input

- **WHEN** a conversation is rendered as a docked window
- **THEN** the picker control is present, and the text input retains the width it
  has without the control

#### Scenario: The picker is dismissed without choosing

- **WHEN** the picker is open and the member presses Escape, or activates
  something outside it
- **THEN** the picker closes, nothing is inserted, and focus is in the message
  input

#### Scenario: The picker is operated from the keyboard alone

- **WHEN** a member reaches the picker control by tab and opens it with Enter
- **THEN** the caret is in the search field, the emoji grid is reachable from
  there by arrow keys, and Enter inserts the focused emoji

#### Scenario: Search ignores case and diacritics

- **WHEN** a member types a search term differing from an emoji's German name
  only in letter case or in the writing of an umlaut
- **THEN** that emoji is among the results

#### Scenario: The picker opens where there is room for it

- **WHEN** the picker is opened from a conversation docked at the bottom of the
  viewport, where there is not enough room below the control
- **THEN** the picker is rendered above the control and within the viewport's
  horizontal bounds

#### Scenario: The picker's surface escapes a transformed ancestor

- **WHEN** the picker is opened from a conversation nested inside an element that
  carries a `transform` or `backdrop-filter`
- **THEN** the picker is positioned against the viewport, unaffected by that
  ancestor

#### Scenario: Emoji data stays out of the pre-sign-in bundle

- **WHEN** the application's entry bundle is built
- **THEN** the emoji data is not contained in it, and is fetched separately on
  first use of the picker

### Requirement: A small set of typed emoticons becomes emoji on send

The system SHALL replace a fixed, small set of typed emoticons with their
corresponding emoji at the moment a message is sent, so that the stored message
body contains the emoji.

The replacement SHALL apply only where the emoticon stands alone: preceded by
the start of the text, whitespace, or an opening bracket or quotation mark; and
followed by the end of the text, whitespace, or punctuation. An emoticon with an
ordinary character immediately before it SHALL be left untouched, so that URLs,
house numbers and code fragments are not altered.

Following punctuation SHALL NOT prevent the replacement. A message ending in a
smiley followed by a full stop or exclamation mark is the ordinary case, and a
rule that excluded it would suppress the feature exactly where it is most used.

Emoticons whose form contains letters SHALL be recognised regardless of letter
case.

Where two recognised emoticons share a prefix, the longer SHALL be matched
first.

The replacement SHALL be applied to the text that is sent, so that the
optimistically rendered message and the stored row carry the same characters.

The replacement SHALL NOT be applied to messages already stored. It changes what
is written, not what is read back.

#### Scenario: A standalone emoticon becomes an emoji

- **WHEN** a member sends a message whose text contains a recognised emoticon
  surrounded by whitespace or text boundaries
- **THEN** the stored body contains the corresponding emoji in its place

#### Scenario: A sentence-final emoticon is replaced

- **WHEN** a member sends a message whose text ends in a recognised emoticon
  followed by a full stop, exclamation mark or closing bracket
- **THEN** the stored body contains the corresponding emoji, and the punctuation
  is preserved

#### Scenario: Letter case does not matter

- **WHEN** a member sends a recognised emoticon written with a lower-case letter
  where the canonical form has an upper-case one
- **THEN** it is replaced with the same emoji

#### Scenario: An embedded emoticon is left alone

- **WHEN** a member sends a message containing a recognised emoticon with a
  non-whitespace character immediately before or after it — as in a URL or a
  house number
- **THEN** the stored body contains those characters unchanged

#### Scenario: The optimistic message matches what is stored

- **WHEN** a message containing a recognised emoticon is sent
- **THEN** the message shown immediately carries the same characters as the row
  the server confirms

#### Scenario: Existing messages are not rewritten

- **WHEN** a conversation containing an older message with an emoticon is opened
- **THEN** that message is displayed as it was stored, with the emoticon intact
