## ADDED Requirements

### Requirement: A third-party media player is loaded only on explicit request

Rendering a page SHALL NOT cause any network request to a media provider's
origin. An embedded video SHALL first render a placeholder drawn entirely from
the application's own origin. The provider's player SHALL be requested only
after the visitor activates that placeholder, and SHALL then start playing
without requiring a further activation inside the provider's frame.

The placeholder SHALL name the provider and SHALL state, before activation, that
activating it establishes a connection to that provider and transmits the
visitor's IP address. It SHALL link to the privacy notice.

The placeholder SHALL NOT request a preview image from the provider or from any
third-party thumbnail service. Such a request carries exactly the data the gate
exists to withhold, and would defeat the requirement while appearing to satisfy
it.

Every surface that embeds a video SHALL obtain this behaviour from the same
component, with no per-surface exception. Deferring the request through lazy
loading SHALL NOT be treated as satisfying this requirement: it postpones the
request rather than withholding it.

An activation SHALL apply to exactly one source URL in one rendered placeholder.
It SHALL NOT carry over to a different URL, to another placeholder on the same
page, or beyond the lifetime of the rendered instance. Persisting it would
itself be consent management, which this requirement does not establish.

The placeholder SHALL occupy the same area as the player that replaces it, so
that activation moves no surrounding content.

#### Scenario: A logged-out visitor opens a page carrying a video

- **WHEN** a visitor with no session opens a page on which a video is embedded
- **THEN** no network request is issued to any media provider's origin, and the
  placeholder is shown in the player's place

#### Scenario: The visitor activates the placeholder

- **WHEN** the visitor activates the placeholder
- **THEN** the provider's player replaces the placeholder and begins playing
  without a further activation inside the provider's frame

#### Scenario: The placeholder fetches no image from a third party

- **WHEN** the placeholder is rendered
- **THEN** it issues no request to the provider's thumbnail host or to any other
  third-party image service

#### Scenario: The placeholder states what activation causes

- **WHEN** the placeholder is rendered
- **THEN** it names the provider, states that activation connects to that
  provider and transmits the visitor's IP address, and links to the privacy
  notice

#### Scenario: The placeholder is operable without a pointing device

- **WHEN** the visitor reaches the placeholder by keyboard
- **THEN** it is a button carrying an accessible name that identifies it as
  loading a video from the named provider, it activates by keyboard, and after
  activation the focus moves to the player rather than being lost

#### Scenario: Activating one video does not load another

- **WHEN** two videos are embedded on the same page and the visitor activates
  one of them
- **THEN** the other remains a placeholder and issues no request to its
  provider

#### Scenario: Changing the source URL withdraws the activation

- **WHEN** a placeholder has been activated and the URL it was activated for is
  replaced by a different one while the same instance remains rendered
- **THEN** the placeholder is shown again, and the new URL's player is not
  requested until it is activated in turn

#### Scenario: Every embedding surface behaves identically

- **WHEN** a video is embedded on any surface, whether public or behind
  authentication
- **THEN** the same placeholder appears first, with no surface loading the
  provider's player directly

#### Scenario: A link that is not an embeddable video is unaffected

- **WHEN** a URL is not recognised as an embeddable video
- **THEN** the existing refusal is shown, and no placeholder and no player are
  rendered

### Requirement: An activated player is requested through each provider's privacy-preserving host and parameters

Once a visitor has activated a placeholder, the system SHALL request the player
through the least-disclosing address each provider offers: YouTube through
`youtube-nocookie.com`, and Vimeo with the provider's do-not-track parameter set.

This requirement is about **what the system asks for**, not about what a provider
then does. It states no promise on the provider's behalf, because no assertion
about a third party's cookie behaviour could be verified from this codebase.

This SHALL apply to the **built** embed URL only. The set of source hosts
accepted from a member SHALL be unchanged, so that the recognizer in the database
and the recognizer in the application continue to accept exactly the same inputs.

#### Scenario: An accepted YouTube link is embedded through the no-cookie host

- **WHEN** a recognised YouTube link is activated
- **THEN** the player is requested from `youtube-nocookie.com`

#### Scenario: An accepted Vimeo link is embedded with do-not-track set

- **WHEN** a recognised Vimeo link is activated
- **THEN** the player is requested with the provider's do-not-track parameter set

#### Scenario: The accepted source hosts are unchanged

- **WHEN** a member submits a link
- **THEN** it is accepted or refused exactly as before this change, and the
  database recognizer and the application recognizer still agree
