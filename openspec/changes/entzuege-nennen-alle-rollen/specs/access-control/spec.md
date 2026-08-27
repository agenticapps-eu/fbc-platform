## MODIFIED Requirements

### Requirement: Privileges are granted explicitly, inherited by nothing

The system SHALL grant table and column privileges explicitly — each grant backed by
a matching policy — and SHALL disarm default privileges so a newly created table
inherits no `anon`/`authenticated` rights. The exact grant matrix SHALL be pinned by
the `grants_test.sql` golden snapshot, which fails whenever the matrix drifts.

**Ein Entzug SHALL jede betroffene Rolle namentlich nennen.** `revoke … from public`
entfernt einen rollen-eigenen Grant **nicht**. Die Default Privileges einer
Supabase-Instanz können `anon`, `authenticated` oder `service_role` ausdrücklich
Rechte auf neue Objekte in `public` erteilen; wo das zutrifft, bleibt ein Objekt
nach `revoke … from public` für diese Rolle erreichbar, obwohl die Migration das
Gegenteil auszusprechen scheint. Die Formulierung SHALL deshalb **jede Rolle
nennen, die das Recht nicht behalten soll** — `public`, `anon`, `authenticated`
und `service_role` — und das Gebrauchte danach ausdrücklich zurückgeben.

**Welche Default Privileges eine Instanz mitbringt, hängt von ihrem Anlagedatum
ab.** Eine Migration SHALL deshalb nicht davon abhängen, wie eine Instanz gebaut
wurde: derselbe Migrationsstand SHALL auf einer frisch angelegten und auf einer
lange bestehenden Instanz denselben Rechtezustand ergeben. Ein Entzug, der nur
auf einer der beiden wirkt, erfüllt diese Anforderung nicht, auch wenn die
Zusagen auf der anderen grün sind.

**Die Instanz-Sorte, gegen die geprüft wird, SHALL festgelegt sein.** Mehrere
der Zusagen dieser Anforderung können nur auf einer Instanz fehlschlagen, die
Rechte rollen-eigen vergibt; auf einer Instanz, die sie nur über `PUBLIC`
vergibt, sind sie grün, ohne etwas zu messen. Die Prüfumgebung SHALL deshalb auf
eine **benannte Version** festgelegt sein und auf die Sorte, die rollen-eigen
vergibt — sonst verlieren diese Zusagen ihren Biss, ohne dass jemand es bemerkt.
Eine gleitende Prüfumgebung erfüllt diese Anforderung nicht: sie kann den Biss
über Nacht in beide Richtungen ändern.

**Die Menge der für `anon` ausführbaren Funktionen SHALL ebenfalls gepinnt sein.**
Der Golden-Snapshot deckt heute Tabellen- und Spaltenrechte ab; ein
Funktions-`EXECUTE` fällt durch ihn hindurch. Genau darüber blieb eine
unbeabsichtigte `anon`-Ausführbarkeit über Monate unbemerkt. Die Zusage SHALL als
**abgeschlossene Liste** formuliert sein — „diese und keine anderen" —, nicht als
Aufzählung bekannter Verstöße, denn eine Aufzählung verlangt, dass jemand den
nächsten Verstoß vorher errät.

**Eine Zusage über eine Rolle SHALL nicht als Grundsatz gelesen werden, wenn sie
an einem Beispiel misst.** Wo eine Zusage über *eine* Tabelle formuliert ist,
deckt sie *diese* Tabelle — nicht das Schema. Der Kommentar an einer solchen
Zusage SHALL das sagen und keinen weitergehenden Grundsatz behaupten, denn ein
behaupteter Grundsatz erzeugt Vertrauen, das die Messung nicht trägt.

Konkret: `service_role` hält auf `staff_roles` kein Recht. Ob es auf **anderen**
Tabellen in `public` Rechte hält, ist damit **nicht** gesagt und heute
nachweislich offen — `notify-contact-request` liest drei Tabellen als
`service_role`. Ein Vorgang, der diese Frage schließt, ist eigens zu führen.

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

#### Scenario: Ein Entzug, der `authenticated` nicht nennt, lässt es stehen

- **WHEN** eine Migration ein Recht `from public, anon` entzieht, während die
  Default Privileges der Instanz es `authenticated` erteilt haben
- **THEN** hält `authenticated` das Recht weiterhin, und die Zusage darüber
  schlägt fehl

#### Scenario: Derselbe Stand ergibt auf beiden Instanz-Sorten dieselben Rechte

- **WHEN** derselbe Migrationsstand auf einer frisch angelegten und auf einer
  lange bestehenden Instanz angewandt wird
- **THEN** halten `anon`, `authenticated` und `service_role` auf beiden dieselben
  Rechte

#### Scenario: Die Prüfumgebung ist auf eine benannte Version festgelegt

- **WHEN** die Prüfumgebung aufgesetzt wird
- **THEN** ist die Version der Datenbank-Werkzeuge namentlich festgelegt und
  nicht als „die jeweils neueste" bezogen
- **AND** sie ist die Sorte, die Rechte rollen-eigen vergibt — sonst sind die
  Zusagen über nicht genannte Rollen grün, ohne etwas zu messen

#### Scenario: service_role hält auf staff_roles kein Recht

- **WHEN** geprüft wird, ob `service_role` `staff_roles` lesen darf
- **THEN** darf es das nicht, und der Kommentar an der Zusage behauptet nichts
  über die übrigen Tabellen des Schemas

#### Scenario: Die Zusage misst das Recht, nicht die Fehlermeldung

- **WHEN** geprüft wird, ob eine Rolle eine Funktion ausführen darf
- **THEN** wird das Privilegien-Bit des Katalogs gelesen
- **AND** die Prüfung trägt eine Gegenprobe, die das Recht erteilt, `true` misst,
  es entzieht und `false` misst — ohne sie wäre die Zusage dort grün, wo die Rolle
  das Recht ohnehin nie hielt
