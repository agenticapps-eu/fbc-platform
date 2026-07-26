## ADDED Requirements

### Requirement: Client session cache is cleared on logout and principal change

On logout or any change of authenticated principal, the client SHALL clear (not
merely invalidate) all cached query data, so data cached for one user can never be
rendered to a subsequent user of the same browser session. This is a data-isolation
invariant; the frontend cache is a convenience layer that complements — never
replaces — the database's deny-by-default enforcement.

#### Scenario: A prior user's cached data does not survive logout

- **WHEN** a user logs out or the authenticated principal changes
- **THEN** the cached query data from the previous principal is cleared, and none of
  it is returned to the next principal in the same session
