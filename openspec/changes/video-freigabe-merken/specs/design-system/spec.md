## MODIFIED Requirements

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

An activation SHALL be recorded **per provider** and SHALL persist on the
visitor's device until it is withdrawn. While a provider is released, that
provider's players SHALL load without a further placeholder, on this page and on
later visits. A release SHALL NOT extend to any other provider.

This reverses the earlier decision that an activation applies to exactly one
source URL and is never persisted. That decision made the gate ask again for
every video and after every reload, which no comparable surface does. Persisting
the answer is consent management, and this requirement therefore establishes the
smallest form of it that can carry a release: one recorded decision per provider,
no identifier, withdrawable from the privacy notice.

A player loaded **because a release was already recorded** SHALL NOT autoplay and
SHALL NOT take keyboard focus. Only the placeholder the visitor has just
activated SHALL do either. Carrying the activation behaviour over to a recorded
release would make every video on a page start at once and would move the focus
during page load.

Where the device storage is unavailable, the gate SHALL still hold: no release is
recorded, no release is read, and each placeholder behaves as it did before this
change. Failing to store a release SHALL NOT prevent the page from rendering.

The placeholder SHALL occupy the same area as the player that replaces it, so
that activation moves no surrounding content.

#### Scenario: A logged-out visitor opens a page carrying a video

- **WHEN** a visitor with no session and no recorded release opens a page on
  which a video is embedded
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
  provider and transmits the visitor's IP address, states that the decision is
  remembered until it is withdrawn, and links to the privacy notice

#### Scenario: The placeholder is operable without a pointing device

- **WHEN** the visitor reaches the placeholder by keyboard
- **THEN** it is a button carrying an accessible name that identifies it as
  loading a video from the named provider, it activates by keyboard, and after
  activation the focus moves to the player rather than being lost

#### Scenario: Activating one video releases the same provider on that page

- **WHEN** two videos from the same provider are embedded on one page and the
  visitor activates one of them
- **THEN** the other loads its player as well, without a reload and without a
  second activation

#### Scenario: A release does not extend to another provider

- **WHEN** a page carries one YouTube video and one Vimeo video and the visitor
  activates the YouTube one
- **THEN** the Vimeo placeholder remains, and no request is issued to Vimeo's
  origin

#### Scenario: A recorded release survives a reload

- **WHEN** a visitor who has released a provider opens a page carrying that
  provider's video again
- **THEN** the player is loaded without a placeholder and without a further
  activation

#### Scenario: A player loaded from a recorded release neither plays nor takes focus

- **WHEN** a page carrying two videos of a released provider is opened
- **THEN** neither player starts playing on its own, and the keyboard focus stays
  where the page put it

#### Scenario: A freshly activated player plays and takes focus

- **WHEN** the visitor activates a placeholder in the current view
- **THEN** that one player starts playing and receives the keyboard focus, while
  players loaded from the recorded release do neither

#### Scenario: Changing the source URL to a released provider needs no new activation

- **WHEN** the URL rendered by a placeholder is replaced by another URL of a
  provider that is already released
- **THEN** the new player is requested without a further activation

#### Scenario: Changing the source URL to an unreleased provider shows the gate

- **WHEN** the URL rendered by a placeholder is replaced by a URL of a provider
  that has not been released
- **THEN** the placeholder is shown again, and the new URL's player is not
  requested until it is activated in turn

#### Scenario: The visitor withdraws a release

- **WHEN** the visitor withdraws a provider's release from the privacy notice
- **THEN** that provider's videos show the placeholder again on the next page
  carrying one, and no request is issued to that provider's origin

#### Scenario: The withdrawal is reachable without an account

- **WHEN** a visitor with no session opens the privacy notice
- **THEN** the withdrawal for each released provider is present and operable
  there

#### Scenario: Device storage is unavailable

- **WHEN** reading or writing the recorded release fails
- **THEN** the page renders, the placeholder is shown, activating it loads that
  one player, and no release is carried to another placeholder or to a later
  visit

#### Scenario: Every embedding surface behaves identically

- **WHEN** a video is embedded on any surface, whether public or behind
  authentication
- **THEN** the same placeholder appears first, with no surface loading the
  provider's player directly

#### Scenario: A link that is not an embeddable video is unaffected

- **WHEN** a URL is not recognised as an embeddable video
- **THEN** the existing refusal is shown, and no placeholder and no player are
  rendered
