# legal-pages Specification

## Purpose
TBD - created by archiving change add-legal-pages. Update Purpose after archive.
## Requirements
### Requirement: Legal notices are reachable without an account and without activation

The platform SHALL serve the imprint at `/impressum`, the privacy notice at
`/datenschutz`, the terms of service at `/agb` and the cookie policy at
`/cookies`. These routes SHALL require neither a session nor an activated
account, and SHALL NOT be placed behind the authentication gate or the
activation gate.

#### Scenario: A logged-out visitor opens a legal notice

- **WHEN** a visitor with no session opens one of the legal routes
- **THEN** that document's content is rendered, and the visitor is not redirected
  to the login page

#### Scenario: A logged-in but unactivated member opens a legal notice

- **WHEN** a member who is signed in but whose account is not yet activated opens
  one of the legal routes
- **THEN** that document's content is rendered, and the activation screen is not
  shown in its place

#### Scenario: Each route serves its own document

- **WHEN** each of the four legal routes is opened in turn
- **THEN** each renders a document whose title differs from the other three

### Requirement: The legal notices are linked from the frame and from the entry screens

The application frame SHALL render a footer linking to all four legal notices.
The login screen and the activation screen SHALL each link to them as well,
because account creation and activation are the points at which terms are agreed
and personal data is first collected.

#### Scenario: A logged-out visitor sees the footer links

- **WHEN** a visitor with no session views a page rendered inside the application
  frame
- **THEN** the footer is present and links to each of the four legal notices

#### Scenario: An activated member sees the footer links

- **WHEN** an activated, signed-in member views a page rendered inside the
  application frame
- **THEN** the footer links to each of the four legal notices

#### Scenario: The login screen links to the legal notices

- **WHEN** the login screen is rendered
- **THEN** it links to each of the four legal notices

#### Scenario: The activation screen links to the legal notices

- **WHEN** a signed-in but unactivated member is shown the activation screen
- **THEN** that screen links to each of the four legal notices, so that the terms
  and the privacy notice can be read before a password is set

### Requirement: A provisional legal text declares what is not yet final

Each legal document SHALL carry an explicit provisional flag. A document marked
provisional SHALL display, before its body and without requiring interaction, a
notice identifying the text as not yet final and naming the open points belonging
to that document. A document not marked provisional SHALL display no such notice.

#### Scenario: A provisional document names its own open points

- **WHEN** a document marked provisional is rendered
- **THEN** a provisional notice appears before the document body, naming that
  document's open points

#### Scenario: Two provisional documents state different open points

- **WHEN** two different documents marked provisional are rendered
- **THEN** each states its own open points rather than a single shared wording

#### Scenario: A document not marked provisional carries no notice

- **WHEN** a document that is not marked provisional is rendered
- **THEN** no provisional notice appears

### Requirement: The privacy notice names every third-party recipient in use

The privacy notice SHALL name each third-party service that receives personal
data from the platform, together with the purpose for which it receives it. It
SHALL NOT name a service the platform does not use, and SHALL NOT present an
absent category of service as an active processing activity.

#### Scenario: A recipient in use is named with its purpose

- **WHEN** the platform relies on a third party to host data, to send account
  e-mail, to capture errors, or to take payments
- **THEN** the privacy notice names that service and states what it receives data
  for

#### Scenario: Embedded third-party media is disclosed

- **WHEN** the platform embeds media served by a third party
- **THEN** the privacy notice discloses that embedding and names the provider

#### Scenario: An absent category is not claimed as processing

- **WHEN** the codebase contains no integration for a category of third-party
  service
- **THEN** the privacy notice does not present that category as an active
  processing activity

### Requirement: A processing region is stated only where it is established

The privacy notice SHALL state a processing region for a named recipient only
where that region is established from the platform's own configuration. Where it
is not established, the notice SHALL say so explicitly rather than omit the
question or assert a region.

#### Scenario: An established region is stated

- **WHEN** a recipient's processing region follows from the platform's own
  configuration
- **THEN** the privacy notice states that region for that recipient

#### Scenario: An unestablished region is declared open rather than guessed

- **WHEN** a recipient's processing region does not follow from the platform's own
  configuration
- **THEN** the privacy notice marks that recipient's region as not yet
  established, and states no region for it

### Requirement: Legal text is rendered as data, never as markup

Legal documents SHALL be stored as structured content and rendered through the
component tree. The renderer SHALL NOT interpret stored text as HTML.

#### Scenario: Stored text is not interpreted as markup

- **WHEN** a legal document's stored text contains characters that would form
  markup
- **THEN** those characters are rendered as literal text rather than as elements

### Requirement: A published legal text matches its approved source

Each legal document SHALL record the source document and revision date it was
taken from. Where the published text departs from that source, the departure
SHALL be stated in that document's open points rather than made silently.

#### Scenario: A document carries its provenance

- **WHEN** a legal document is stored
- **THEN** it records the source document name and the source's revision date

#### Scenario: A departure from the source is declared

- **WHEN** the published text differs from its approved source on a point of
  substance
- **THEN** that difference appears in the document's open points

