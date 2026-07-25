# Add Capital-Parks acquisition profiles and platform joint ventures to matching

## Why

Phase 4 (Ökosystem) extends matching beyond member-to-member complementarity into
the wider ecosystem. Two ecosystem inputs need to participate in matching: a
Capital-Parks acquisition profile (what Capital-Parks is looking to acquire) should
be ingested as a matching source so members' offers can be matched against it, and
the platform needs a defined way to spin a joint venture out of an accepted match /
platform project. Today `matching` only pairs members and routes large-volume needs
to the DKRI queue; there is no ecosystem participant and no venture-formation step.
Linear: **AGE-307** (Capital-Parks acquisition profile feeds matching),
**AGE-308** (joint ventures from platform projects).

## What Changes

- Ingest a Capital-Parks acquisition profile as a first-class matching
  participant/source, so the rule-based engine can score member offers against its
  acquisition criteria alongside member-to-member matches.
- Define a joint-venture formation process that turns an accepted match / platform
  project into a tracked joint venture with its participating members.

## Impact

- Affected capability: `matching`.
- New tables for the acquisition-profile source and for joint ventures + their
  participants, each with RLS; the matching engine gains the acquisition profile as
  a candidate source.
- Consistent with the existing invariants: matches remain server-computed (members
  never write `matches`), volume-based FBC/DKRI routing is unchanged, and the
  acquisition source carries no access to member contact data beyond what matching
  already exposes.
