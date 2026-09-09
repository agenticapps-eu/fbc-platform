# Privacy

## Purpose

Holds the data-subject rights the platform grants its members — today the right to
erasure (GDPR Art. 17) and nothing else. It defines what a member may delete, what
survives the deletion and why: personal data goes, other people's conversations
stay, and records the law obliges the association to keep are excepted. Access,
retention and export duties beyond erasure are not settled here — Art. 15/20
export, the consent lifecycle and the audit log remain open in
`add-dsgvo-compliance`.

## Requirements
### Requirement: A member can delete their own account from within the app

The system SHALL let an authenticated member irreversibly delete their own account
from within the application, on every platform the app ships on (iOS, Android,
Web). The entry point SHALL be reachable without contacting support, and SHALL be
guarded by an explicit confirmation that names the consequence, so that deletion
cannot be triggered by a single accidental activation.

A member SHALL never be able to delete another member's account. Deletion SHALL be
distinct from the administrative soft-delete, which sets `deleted_at` and is
restorable; account deletion SHALL NOT be restorable.

#### Scenario: Member deletes their own account

- **WHEN** an authenticated member confirms account deletion
- **THEN** their account is deleted, their session ends, and a subsequent sign-in
  attempt with the former credentials fails

#### Scenario: Deletion requires an explicit confirmation

- **WHEN** a member activates the deletion entry point but does not confirm
- **THEN** no data is changed and the account remains usable

#### Scenario: A member cannot delete another member's account

- **WHEN** a deletion request names a subject other than the caller
- **THEN** the request is rejected and no data is changed

### Requirement: Deletion removes the member's personal data from every structured field

Deletion SHALL irreversibly remove the member's personal data from the structured
fields that hold it — display name, headline, biography, company, images, contact
data and address data — and from every derived store fed by them, including the
full-text search index, such that the member is no longer identifiable or
discoverable through them.

The guarantee is bounded to structured fields. Free text that other members wrote
— message bodies, post bodies, and name-based mentions inside them — is another
member's statement and SHALL NOT be rewritten by deletion. Where a mention can no
longer be resolved, the interface SHALL render it as plain text rather than as a
link to a profile that no longer exists.

#### Scenario: Structured personal data is gone after deletion

- **WHEN** a member's account has been deleted
- **THEN** no field of their profile, contact data, or address data still holds a
  personal reference to them, and their stored images are gone

#### Scenario: The deleted member is not findable by their former name

- **WHEN** a search is run for the deleted member's former name
- **THEN** no result identifies them, including through the full-text index

#### Scenario: The anonymised member is not discoverable

- **WHEN** a member's account has been deleted
- **THEN** they are absent from the directory, from search results, and from matching

#### Scenario: An unresolvable mention degrades to plain text

- **WHEN** a post mentions a member who has since deleted their account
- **THEN** the mention renders as plain text and links to no profile

### Requirement: Deletion preserves other members' threads without personal reference

Content the member left in other members' contexts — posts, comments, messages and
accepted contact requests — SHALL be preserved without its personal reference, so
that a counterparty does not lose their conversation history or a thread its
beginning. Such content SHALL be attributed as a former member, and the system
SHALL NOT disclose whether that member was deleted, removed by an administrator,
or deactivated.

#### Scenario: A counterparty keeps their conversation

- **WHEN** a member who exchanged messages with another member deletes their account
- **THEN** the counterparty still sees the conversation, with the deleted member
  shown as a former member rather than by name

#### Scenario: A thread keeps its beginning

- **WHEN** the author of a post that carries comments deletes their account
- **THEN** the post and its comments remain readable to those who could read them
  before, attributed to a former member

#### Scenario: The reason for the member's absence is not disclosed

- **WHEN** a member views content whose author is a former member
- **THEN** nothing distinguishes a deleted account from one an administrator
  removed or deactivated

### Requirement: Deletion releases the member's claims on future activity

Deletion SHALL release commitments that would otherwise bind other members to an
account that no longer has an owner. Registrations for future events SHALL be
cancelled so the seat is released to any waiting list; scheduled posts that have
not yet been published SHALL be deleted; and contact requests the member sent that
have not been accepted SHALL be withdrawn.

Records of past activity — attendance at events that already happened, and
accepted contact requests — SHALL be preserved anonymously, since they are part of
another member's history.

#### Scenario: A seat at a future event is released

- **WHEN** a member registered for a future event deletes their account
- **THEN** the registration is cancelled and the seat is available to the waiting list

#### Scenario: A scheduled post is not published after deletion

- **WHEN** a member with a scheduled, unpublished post deletes their account
- **THEN** the post is deleted and is never published

#### Scenario: Past attendance is retained anonymously

- **WHEN** a member who attended a past event deletes their account
- **THEN** the attendance record remains, carrying no personal reference

### Requirement: Deletion removes the auth identity without cascading over member content

Deletion SHALL remove the member's `auth.users` identity and end their access, so
that the credentials no longer grant entry.

Removing the auth identity SHALL NOT cascade into the tables holding member
content. The database SHALL NOT be configured such that removing an auth identity
deletes a profile row and, through it, that member's posts, comments, messages, or
contact requests. Equally, the database SHALL NOT be configured such that a
retained profile row prevents the auth identity from being removed.

#### Scenario: The auth identity is gone

- **WHEN** deletion completes
- **THEN** the member's `auth.users` record no longer exists

#### Scenario: Removing the auth identity leaves member content standing

- **WHEN** a member's `auth.users` record is removed
- **THEN** the posts, comments, messages and contact requests that member left in
  other members' contexts still exist

#### Scenario: The retained profile row does not block the auth deletion

- **WHEN** deletion runs for a member whose profile row is retained as an anchor
- **THEN** the `auth.users` record is removed successfully

### Requirement: Access ends immediately, not when the access token expires

A deleted account SHALL be refused by the server from the moment deletion
completes, independently of whether a previously issued access token is still
within its validity period. The refusal SHALL be enforced server-side on the paths
that write member data and store files, not by the client signing out.

An administrative restore SHALL NOT return a deleted account to service; the
restorable soft-delete SHALL remain available for accounts that were not deleted.

#### Scenario: A token issued before deletion no longer grants writes

- **WHEN** a request carries an access token issued before the account was deleted
  and attempts to write member data or upload a file
- **THEN** the request is refused

#### Scenario: An administrator cannot restore a deleted account

- **WHEN** an administrator attempts to restore an account that was deleted by its
  own member
- **THEN** the restore is refused and the account remains invisible and inaccessible

#### Scenario: Soft-deleted accounts remain restorable

- **WHEN** an administrator restores an account that was soft-deleted rather than
  deleted by its member
- **THEN** the restore succeeds

### Requirement: Deletion respects retention duties

Deletion SHALL preserve records the platform is legally required to retain —
issued invoices under HGB/AO retention duties — while removing the rest. Records
subject to a retention duty SHALL carry the details that duty requires
independently of the member's profile, so that anonymising the profile neither
defeats the duty nor keeps the personal reference alive through it.

#### Scenario: Issued invoices survive deletion

- **WHEN** a member with issued invoices deletes their account
- **THEN** the invoices are retained for their statutory period while the member's
  profile, contact and address data are removed

### Requirement: Only a privileged caller performs the deletion

Because removing an `auth.users` identity is outside the database's reach, deletion
SHALL be performed by a privileged server-side path that is the sole entry point,
and the deletion routine SHALL NOT be executable by the `authenticated` or `anon`
client roles. The privileged path SHALL establish the caller's identity from a
**verified** token — verifying the signature itself, or running behind a gateway
that the deployment configuration requires to verify it — and act only on that
identity.

Deletion SHALL be refused when the database schema does not yet support it, rather
than proceeding and cascading over member content.

#### Scenario: A client role cannot invoke the deletion routine directly

- **WHEN** a client role calls the deletion routine over the database API
- **THEN** the call is refused

#### Scenario: An unverified or invalid token is refused

- **WHEN** a deletion request arrives with no token, an invalid signature, a wrong
  issuer, or an expired token
- **THEN** the request is denied and no data is changed

#### Scenario: Deletion is refused against an unprepared schema

- **WHEN** deletion runs against a database where the auth foreign key still
  cascades into the profile row
- **THEN** the deletion is refused and no data is changed

### Requirement: A partially completed deletion never reports success

Each step of deletion SHALL be repeatable without changing the outcome, so an
interrupted deletion can be completed by running it again. A deletion that did not
complete every step SHALL NOT report success, and the state it leaves behind SHALL
be one that removed too little rather than too much.

#### Scenario: An interrupted deletion is reported as incomplete

- **WHEN** deletion fails partway through
- **THEN** the caller is told it did not complete, and member content that should
  have been preserved is intact

#### Scenario: Repeating a deletion is harmless

- **WHEN** deletion runs a second time for the same account
- **THEN** it completes without error and the outcome is unchanged

