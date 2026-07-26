# Partners

## Purpose

Models the partner directory for the "Potential Ecosystem" (Level 2). This is a
prepared capability: the schema (`partners`, `partner_categories`) exists with
RLS enabled and a seeded category list, but there is no partner management UI and
the table holds no rows yet. Reconstructed from code as of the OpenSpec
migration. The load-bearing invariant is that partners have no access to member
data.

## Requirements

### Requirement: Partner records and their categories

The system SHALL define a `partners` table with `name` (required), a `category`
foreign key referencing `partner_categories(key)`, and optional `logo_url`,
`region`, `description`, `website`, and `contact` fields. It SHALL seed
`partner_categories` with the fixed set `host`, `expert`, `public`, `sponsor`,
`strategic`, `impact`, each carrying a display `label`.

#### Scenario: Categories are seeded

- **WHEN** the database is provisioned
- **THEN** `partner_categories` contains exactly the six keys above with labels,
  and a `partners.category` value outside that set is rejected by the foreign key

#### Scenario: A partner requires a name

- **WHEN** a `partners` row is written without a `name`
- **THEN** the write is rejected by the not-null constraint

### Requirement: Partner reads are gated behind authentication

The system SHALL protect `partners` with row-level security that permits reads
only to authenticated members (no anonymous read), while `partner_categories`
labels MAY remain publicly readable.

#### Scenario: Anonymous partner read is denied

- **WHEN** an unauthenticated client selects from `partners`
- **THEN** RLS returns no rows

#### Scenario: Authenticated member reads partners

- **WHEN** an authenticated member selects from `partners`
- **THEN** RLS permits the read

### Requirement: Partners have no access to member data

The system SHALL NOT grant partners any RLS policy over member-scoped tables
(`profiles`, `offers`, `needs`, `matches`, `contact_requests`); a partner's reach
is limited to public content. Member contact and profile data SHALL remain
invisible to partners.

#### Scenario: Partner cannot read member records

- **WHEN** access is evaluated for a partner against `profiles`, `offers`,
  `needs`, `matches`, or `contact_requests`
- **THEN** no policy grants the partner access and the rows are not returned
