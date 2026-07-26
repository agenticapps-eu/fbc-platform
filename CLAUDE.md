
<!-- spec-source: agenticapps-workflow-core@0.4.0 §11 -->
## Coding Discipline (NON-NEGOTIABLE)

These four rules are reread every session because the failure modes
they prevent recur every session.

### 1. Think Before Coding

State assumptions explicitly before writing any line. When the request
is ambiguous, present the alternative interpretations and ask which
applies. When the request contradicts itself, surface the contradiction
rather than silently picking one side. When you are confused, stop and
ask — confusion is signal, not friction.

Anti-patterns this rule prevents:

- Diving into implementation without restating what was actually requested.
- Picking one reading of an ambiguous instruction silently and shipping it.
- Treating two contradictory requirements as if both can be satisfied without comment.
- Treating "I'll figure it out as I go" as a substitute for understanding the goal.
- Generating code first and asking clarifying questions only after a failure.

### 2. Simplicity First

Write the smallest thing that satisfies the request. No features
beyond what was asked. No abstractions for code with one caller. No
flexibility for callers that do not exist. No error handling for
scenarios that cannot occur given the code's invariants. The
senior-engineer test: would a senior engineer reviewing this say it is
overcomplicated for what was asked?

Anti-patterns this rule prevents:

- Adding a helper function "in case we need to call this from elsewhere later."
- Introducing a configuration option for behavior that has one consumer.
- Wrapping internal calls in try/catch when no internal caller throws.
- Designing for a hypothetical second consumer that does not exist.
- Replacing three similar lines with a parameterised abstraction.
- Shipping a "framework" when a function would do.

### 3. Surgical Changes

Touch only what you must to satisfy the task. Adjacent code is out of
scope. Match the existing style of the file you are editing rather than
the style you would have chosen. Clean up only the orphans your own
change created. If you notice an unrelated improvement, leave it as a
follow-up note, not a diff.

Anti-patterns this rule prevents:

- Reformatting untouched lines to "fix style" while editing nearby.
- Refactoring a function that the task did not name.
- Renaming a variable across the file because the new name is "better."
- Deleting code you decided is unused without verifying it has no callers.
- Pulling adjacent code into the diff because "while I'm here."
- Bundling a cleanup pass into a feature commit.

### 4. Goal-Driven Execution

Every task is a goal, not a list of imperative steps. Restate the goal
in a form that is verifiable from on-disk artifacts before writing any
code. For bug fixes: write the failing test that reproduces the bug
first, then make it pass. For performance work: capture the measurement
first, then change the code, then capture it again. For behavioral
changes: define the assertion the diff must satisfy before the diff
exists. "Done" is "the goal is verifiably satisfied," not "the code now
exists."

Anti-patterns this rule prevents:

- "Fix the bug" without a failing test that reproduces it.
- "Improve performance" without a measurement before and a measurement after.
- "Make it work" without a definition of "work" the diff can be checked against.
- Marking a task complete on the basis of "the code now exists" rather than "the goal is satisfied."
- Writing implementation before there is anything that can fail to confirm the goal is met.

These four rules apply to every code-touching turn. They do not
replace the commitment ritual, the rationalisation table, the red
flags, or the evidence rules — they sit alongside them as the
session-level discipline the model brings to every diff.

## Workflow

This project uses the AgenticApps **OpenSpec + Superpowers + gstack** workflow.
Planning is an OpenSpec *change* (`openspec/changes/`); durable current truth is
`openspec/specs/`. The lifecycle, hooks, and red-flag rituals are enforced by the
`agentic-apps-workflow` skill and the §18 change-gate — re-sync via
`/update-agenticapps-workflow`.

## Projektkonventionen

- Arbeite in kleinen, überprüfbaren Schritten.
- Verwende TypeScript strict, pnpm, Conventional Commits.
- Schreibe keine Secrets ins Repo (nur `.env.example` mit Platzhaltern).
- Referenziere in jeder Commit-Message das zugehörige Linear-Issue (z. B. `AGE-234`).
- Aktualisiere den Status des Issues in Linear (In Progress → Done) über das Linear-MCP.
- Stoppe nach jedem Prompt und fasse zusammen, was getan wurde und wie ich es verifiziere.

### Branches & Commits

- **Conventional Commits** für jede Commit-Message, mit Linear-Issue-Referenz
  (z. B. `feat: matching ui (AGE-241)`).
- **Branch-Namen im Linear-Format**: `<owner>/<issue>-<kurzbeschreibung>`,
  z. B. `donald/age-234-matching-ui`. Keine direkten Commits auf `main` —
  immer Feature-Branch + PR.

## Projektüberblick

Die **Fair-Business-Club-Plattform (FBC)** ist auf drei Ebenen angelegt: Ebene 1
**FBC Community** (gebaut), Ebene 2 **Potential Ecosystem** und Ebene 3 **DKRI**
(beide architektonisch vorbereitet, noch nicht implementiert). Produkt-Capabilities
und ihre aktuelle Wahrheit stehen als Requirements in `openspec/specs/` (u. a.
`membership-tiers`, `member-profiles`, `directory-search`, `matching`,
`contact-requests`, `messaging`, `community-feed`, `events`, `partners`,
`potential-compass`, `access-control`, `admin`). Historische Anforderungs-/
Designphasen (P1–P5) liegen unter `docs/legacy-planning/`.

## Kernprinzipien

Die Sicherheits- und Sichtbarkeits-Invarianten — Rechte nach Mitgliedsstufe,
RLS-erzwungene Sichtbarkeit (Frontend ist Komfort, nicht Sicherheitsgrenze) und
keine automatische Freigabe von Kontaktdaten — sind als Requirements spezifiziert.
See `openspec/specs/access-control/spec.md` und `openspec/specs/membership-tiers/spec.md`.

## Datenmodell & Mitgliedsstufen

Das **Datenmodell** ist die Menge der Supabase-Migrationen unter
`supabase/migrations/` (Quelle der Wahrheit fürs Schema). Mitgliedsstufen folgen
dem **6-Level-Modell** (`basic` → `connect` → `discover` → `exchange` → `focus` →
`impact`, aufsteigende Rechte; AGE-311) — nicht mehr dem alten 3-/7-Stufen-Modell
der Legacy-Docs. See `openspec/specs/membership-tiers/spec.md`.
