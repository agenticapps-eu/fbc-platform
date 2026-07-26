# Community Feed

## Purpose

Defines the community activity feed (Aktivität) of the FBC platform: member
posts with hashtags, threaded comments, and likes, plus the discreet aggregate
engagement counters the feed renders. Visibility is enforced in the database via
RLS keyed on membership tier rank, never in the client alone. Reconstructed from
the code as of the OpenSpec migration; supersedes the legacy `prime`/`legacy`
post-visibility values, which the six-level migration folded into `members`.

## Requirements

### Requirement: Posts carry author, body, hashtags, and visibility

The system SHALL store each feed post with a non-null `author_id` referencing a
profile, a non-null `body`, an optional `hashtags` text array, a `visibility`
constrained to `public` or `members` (default `members`), and a `created_at`
timestamp. Deleting the author profile SHALL cascade-delete the post.

#### Scenario: A post is created with defaults

- **WHEN** a member creates a post supplying only `author_id` and `body`
- **THEN** the row is stored with `visibility = 'members'`, a generated `id`, and
  `created_at = now()`

#### Scenario: An unsupported visibility value is rejected

- **WHEN** a write sets a post's `visibility` to a value other than `public` or
  `members` (for example the retired `prime` or `legacy`)
- **THEN** the write is rejected by the `posts_visibility_check` constraint

### Requirement: Post readability is gated by tier rank

The system SHALL, via RLS, permit an authenticated member to read a post only
when the post is `public`, or the post is `members` and the member's tier rank is
at least `exchange` (rank 4), or the member is the post's author.

#### Scenario: Members-only post hidden below exchange

- **WHEN** an authenticated member with rank below 4 reads the feed
- **THEN** posts with `visibility = 'members'` that they did not author are not
  returned, while `public` posts remain visible

#### Scenario: Author always sees their own post

- **WHEN** a member reads a post they authored
- **THEN** the post is returned regardless of its visibility or the member's rank

### Requirement: Comments inherit the parent post's visibility

The system SHALL make a comment readable or insertable only when the parent post
is visible to the caller, delegating the tier decision to the post's own RLS, and
SHALL require an inserted comment's `author_id` to equal the caller.

#### Scenario: Comment on an invisible post is not readable

- **WHEN** a member who cannot see a post queries comments
- **THEN** comments on that post are not returned

#### Scenario: Comment insert requires visible parent and own authorship

- **WHEN** a member inserts a comment whose `author_id` is themselves and whose
  `post_id` references a post they can see
- **THEN** the insert succeeds; if the parent post is not visible to them, or
  `author_id` is another member, the insert is rejected

### Requirement: Likes are unique per member, owner-readable, and gated on visible posts

The system SHALL key `post_likes` on the composite primary key
`(post_id, profile_id)` so a member likes a post at most once, SHALL allow a
member to read only their own like rows, and SHALL permit a like only on a post
the member can see with `profile_id` equal to the caller.

#### Scenario: A member cannot like the same post twice

- **WHEN** a member inserts a second like for a post they already liked
- **THEN** the insert is rejected by the primary-key uniqueness constraint

#### Scenario: A member cannot see who else liked a post

- **WHEN** a member selects from `post_likes`
- **THEN** only rows where `profile_id` equals the caller are returned

#### Scenario: A like on an invisible post is rejected

- **WHEN** a member tries to like a post they cannot see under the post RLS
- **THEN** the insert is rejected

### Requirement: Engagement counts are aggregate-only and visibility-scoped

The system SHALL expose like and comment counts through a `SECURITY DEFINER`
function `post_engagement_counts(uuid[])` that returns only numeric counts (never
the identity of who liked or commented), computes counts only for posts the caller
is already permitted to see under the same visibility predicate as the post RLS,
and caps the input array at 200 ids.

#### Scenario: Counts are returned only for visible posts

- **WHEN** the caller passes a mix of post ids, some of which they cannot see
- **THEN** the function returns count rows only for the posts visible to them and
  omits the rest

#### Scenario: No identities are disclosed

- **WHEN** the function returns counts for a post
- **THEN** the result contains only `post_id`, `like_count`, and `comment_count`,
  and never reveals which members liked or commented
