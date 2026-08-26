## MODIFIED Requirements

### Requirement: Privileges are granted explicitly, inherited by nothing

The system SHALL grant table and column privileges explicitly — each grant backed by
a matching policy — and SHALL disarm default privileges so a newly created table
inherits no `anon`/`authenticated` rights. The exact grant matrix SHALL be pinned by
the `grants_test.sql` golden snapshot, which fails whenever the matrix drifts.

**Ein Entzug SHALL jede betroffene Rolle namentlich nennen.** `revoke … from public`
entfernt einen rollen-eigenen Grant **nicht**. Die Default Privileges einer
Supabase-Instanz können `anon` ausdrücklich `EXECUTE` auf neue Funktionen in
`public` erteilen; wo das zutrifft, bleibt eine Funktion nach `revoke … from public`
für `anon` ausführbar, obwohl die Migration das Gegenteil auszusprechen scheint.
Die Formulierung SHALL deshalb `from public, anon` lauten — und `authenticated`
mitnennen, wo auch dieses Recht nicht gewollt ist.

**Die Menge der für `anon` ausführbaren Funktionen SHALL ebenfalls gepinnt sein.**
Der Golden-Snapshot deckt heute Tabellen- und Spaltenrechte ab; ein
Funktions-`EXECUTE` fällt durch ihn hindurch. Genau darüber blieb eine
unbeabsichtigte `anon`-Ausführbarkeit über Monate unbemerkt. Die Zusage SHALL als
**abgeschlossene Liste** formuliert sein — „diese und keine anderen" —, nicht als
Aufzählung bekannter Verstöße, denn eine Aufzählung verlangt, dass jemand den
nächsten Verstoß vorher errät.

#### Scenario: A new table inherits no client privileges

- **WHEN** a migration creates a new table without an explicit grant
- **THEN** `anon`/`authenticated` receive nothing (default privileges are revoked for
  role `postgres`), and access fails closed until a grant is stated

#### Scenario: Grant matrix drift is caught by the snapshot

- **WHEN** the effective table/column grants for `anon`/`authenticated` differ from
  the recorded golden snapshot
- **THEN** `grants_test.sql` fails, forcing the matrix change to be reviewed and the
  snapshot updated

#### Scenario: Eine neue anon-ausführbare Funktion bricht die Liste

- **WHEN** eine Migration eine Funktion anlegt, die `anon` ausführen darf, ohne
  dass sie in der abgeschlossenen Liste steht
- **THEN** schlägt die Zusage fehl und zwingt die Entscheidung in den Review

#### Scenario: Ein Entzug allein über `public` genügt nicht

- **WHEN** eine Migration `execute` nur `from public` entzieht, während die
  Default Privileges der Instanz `anon` dieses Recht erteilt haben
- **THEN** hält `anon` das Recht weiterhin, und die Zusage über die abgeschlossene
  Liste schlägt fehl

#### Scenario: Die Zusage misst das Recht, nicht die Fehlermeldung

- **WHEN** geprüft wird, ob eine Rolle eine Funktion ausführen darf
- **THEN** wird das Privilegien-Bit des Katalogs gelesen
- **AND** die Prüfung trägt eine Gegenprobe, die das Recht erteilt, `true` misst,
  es entzieht und `false` misst — ohne sie wäre die Zusage dort grün, wo die Rolle
  das Recht ohnehin nie hielt
