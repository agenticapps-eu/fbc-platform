## ADDED Requirements

### Requirement: Die Aktivitäten eines Profils sind begehbar

Each entry of a profile's activity list SHALL lead to that entry's post in the
feed. A list of posts that cannot be opened states that the member is active and
then refuses to show it — the entries look like links already, and behave like
none.

Each entry SHALL lead to **its own** post, not to the feed in general. A member
who clicks the third entry and lands at the top of the feed has been answered a
question they did not ask.

The promise SHALL hold on any profile, not only on one's own: a visitor reading a
member's profile is exactly the reader for whom the entries are interesting. What
the visitor may see is decided by the feed, not by this list.

#### Scenario: An entry opens its own post

- **WHEN** a member clicks an entry of a profile's activity list
- **THEN** the feed opens on that entry's post, not on the feed's first page

#### Scenario: The promise holds on a foreign profile

- **WHEN** a member opens another member's profile and clicks an activity entry
- **THEN** the same post is addressed as for the profile's owner

#### Scenario: Every entry is a link, not a clickable box

- **WHEN** an entry of the activity list is inspected
- **THEN** it is a link carrying its target address — so that it is focusable,
  triggerable by keyboard and openable in a new tab without any of that having
  to be rebuilt by hand

#### Scenario: Both profile surfaces carry the link

- **WHEN** the same member's posts are listed on the public profile and on the
  member's own profile
- **THEN** an entry on either surface leads to that entry's post

### Requirement: Ein Beitrag ohne Text wird benannt, nicht leer gezeigt

A post whose body is empty SHALL be shown with a description of what it is,
rather than as a blank line above a date. A post may legitimately carry no text —
the composer permits publishing an image with nothing written — and the list must
not render that as if something had been lost.

The description SHALL state only what the surface has actually established. It
SHALL NOT name what the post carries instead of text: nothing on this surface
reads the post's media, an empty body does not imply an image (the creating RPC
accepts neither text nor media, and a member may empty their own body
afterwards), and a description that named an image would assert something
unverified.

The promise SHALL hold on **every** surface that lists a member's posts. Two
surfaces show this list, and both render the body unguarded; fixing one leaves
the reader with a defect that appears only sometimes, which is worse to diagnose
than one that appears always.

#### Scenario: A textless post is described, not characterised

- **WHEN** a member's activity list contains a post with an empty body
- **THEN** the entry shows a description of the post instead of an empty line,
  and that description holds whether or not the post carries an image

#### Scenario: Both surfaces keep the promise

- **WHEN** the same textless post is shown on the public profile and on the
  member's own profile
- **THEN** both describe it, and neither renders a blank line

#### Scenario: A post with text is unaffected

- **WHEN** a post carries a body
- **THEN** the body is shown, and no description replaces it
