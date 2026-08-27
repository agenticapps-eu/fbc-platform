# Access Control

## Purpose

Captures the cross-cutting security invariants of the FBC community platform — the
codified form of the project's Kernprinzipien. Access is enforced in the database
via Row-Level Security and privilege grants, not merely in the client; visibility
follows membership tier rank; and contact data is never disclosed without explicit,
mutual consent. Reconstructed from code as of the OpenSpec migration
(`supabase/migrations/*`, verified by `supabase/tests/rls_test.sql` and
`grants_test.sql`).
## Requirements
### Requirement: Access is enforced in the database, deny-by-default

The system SHALL enable Row-Level Security on every table and rely on it, not the
frontend, as the security boundary. Any table/role/command without a permissive
policy SHALL be denied; the client is convenience only and its bypass MUST NOT grant
access. `service_role` (edge functions) bypasses RLS by design.

#### Scenario: A table without a matching policy denies the caller

- **WHEN** an authenticated caller attempts an operation on a table for which no
  permissive policy exists for their role
- **THEN** RLS denies the operation (deny-by-default), independent of any client-side
  check

#### Scenario: Interaction rows cannot bypass parent visibility

- **WHEN** a member queries `comments` (or writes `post_likes`/`event_registrations`)
  whose parent post/event they cannot see
- **THEN** the interaction policy delegates to the parent's RLS
  (`exists (select 1 from posts p where p.id = ...)`) and returns/permits nothing,
  so visibility cannot be bypassed through an interaction table

### Requirement: Visibility follows membership tier rank

The system SHALL gate tier-scoped visibility on the caller's numeric tier rank
via `current_tier_rank()` and the derived parametric predicate
`has_level(min_rank)`, so that a member below the required rank cannot read a
higher-tier resource while a member at or above it can. The rank comparison —
not a client flag — SHALL be the deciding factor.

**Korrigiert 2026-08-05.** Der bisherige Text nannte `is_prime_plus()` als
lebendes Prädikat. Die Funktion existiert seit AGE-311 nicht mehr: sie wurde
gedroppt, nachdem alle sieben abhängigen Policies auf `has_level()` umgehängt
worden waren. Gemessen gegen die Datenbank, nicht aus den Migrationen gelesen.

Die Rangprüfung SHALL NOT als alleinige Hürde vor Mitgliederdaten stehen, wo
Konten mit hoher Stufe provisioniert werden, ohne dass ihr Inhaber sich je
ausgewiesen hat. In diesem Fall SHALL das Aktivierungs-Gate zusätzlich greifen.

#### Scenario: Below-threshold member is excluded from the full directory

- **WHEN** a member below the directory threshold selects another member's full
  `profiles` row (extended fields) or their `offers`/`needs`
- **THEN** the tier-gated policy (via `has_level()`/`current_tier_rank()`)
  returns no row

#### Scenario: At-or-above-threshold member gains access

- **WHEN** an **activated** member at or above the threshold reads the same
  resource
- **THEN** the tier gate permits it (e.g. a `discover`-rank member reads a full
  foreign profile and its extended interests)

#### Scenario: Eine hohe Stufe ersetzt die Aktivierung nicht

- **GIVEN** ein Konto auf der höchsten Stufe, das nie aktiviert wurde
- **WHEN** es dieselbe Ressource liest
- **THEN** wird sie verweigert — die Stufe öffnet nichts, solange die
  Aktivierung fehlt

### Requirement: Contact data is never implicitly disclosed

The system SHALL keep contact details (`profile_contacts`) invisible to everyone but
the owner until an explicit, mutually accepted contact request exists between the two
members. Disclosure SHALL require a real consented `accepted` state — a member MUST
NOT forge, self-accept, or re-target a request to harvest another member's contacts.

#### Scenario: Contacts released only after an accepted request

- **WHEN** a member selects another member's `profile_contacts`
- **THEN** `contacts_select_self_or_released` returns the row only if the caller is
  the owner or an `accepted` contact request links the two members

#### Scenario: Forged or rewritten requests cannot release contacts

- **WHEN** a recipient tries to rewrite `from_id`/`to_id`/`match_id` or flip a
  non-pending request, or a sender tries to INSERT an already-`accepted` row
- **THEN** the column-level UPDATE grant (`status` only) and the transition-pinning
  policies deny it — only a pending request the recipient owns may move to
  `accepted`/`declined`, with a `match_id` that actually belongs to the pair

### Requirement: SECURITY DEFINER functions are pinned and locked down

The system SHALL define privileged helper and trigger functions as
`SECURITY DEFINER` with a pinned `search_path`, and SHALL grant EXECUTE only to
the roles that need it — revoking the default `PUBLIC`/`anon` grant so these
functions are not exposed as PostgREST `/rest/v1/rpc` endpoints. Trigger-only
functions SHALL carry no API-role EXECUTE grant at all.

Where such a function reproduces a table's visibility predicate instead of
relying on that table's policies, the reproduction SHALL be kept in step with
the policies it mirrors. A gate added to the policies SHALL be added to these
functions in the same change; otherwise the function is the way around the gate.

#### Scenario: Predicate helpers are not callable by anon

- **WHEN** the `anon` role attempts to call `is_admin()`, `has_level(int)`,
  `is_activated()`, `is_matching_manager()`, or `current_tier_rank()` via
  PostgREST
- **THEN** EXECUTE is denied (`has_function_privilege('anon', ...)` is false);
  only `authenticated` (and `service_role` where required) may call them

#### Scenario: Trigger-only functions are off the API surface

- **WHEN** any role tries to invoke a trigger helper (e.g. `handle_new_user`,
  `set_updated_at`, `platform_settings_touch`) as an RPC
- **THEN** EXECUTE has been revoked from `public`/`anon`/`authenticated`, while
  the trigger still fires (triggers do not check the caller's EXECUTE privilege)

#### Scenario: Eine spiegelnde Funktion trägt dasselbe Gate wie ihre Tabelle

- **WHEN** eine privilegierte Funktion das Sichtbarkeitsprädikat einer Tabelle
  nachbildet und diese Tabelle ein neues Gate erhält
- **THEN** trägt die Funktion dasselbe Gate, sodass ihr Aufruf nicht mehr
  freigibt als eine unmittelbare Abfrage

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
Tabellen in `public` Rechte hält, ist damit **nicht** gesagt und bleibt offen,
bis ein flächendeckender Entzug ausgesprochen ist.

**Eine Edge Function SHALL nicht darauf bauen, dass `service_role` ein
Tabellenrecht hält.** Sie liest und schreibt in `public` über
`SECURITY DEFINER`-Funktionen, die ihr namentlich zugestanden sind. Der Grund
ist nicht Vorliebe, sondern Messbarkeit: ob `service_role` eigene Grants trägt,
entscheidet die **Instanz**, nicht dieses Repository — keine Migration erteilt
sie, und welche Default Privileges eine Instanz mitbringt, hängt von ihrem
Anlagedatum ab. Ein Weg, der auf einer solchen Eigenschaft steht, scheitert erst
zur Laufzeit und nur dort, wo niemand hinsieht.

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

- **WHEN** `anon` ein **rollen-eigenes** `execute` hält — hergestellt durch ein
  ausdrückliches `grant`, nicht vorausgesetzt aus den Default Privileges — und
  danach `execute` nur `from public` entzogen wird
- **THEN** hält `anon` das Recht weiterhin
- **AND** die Zusage misst dies auf **jeder** Instanz-Sorte, weil sie den
  rollen-eigenen Grant selbst herstellt

#### Scenario: Die Gegenprobe führt die richtige Entzugsform vor

- **WHEN** die Gegenprobe zeigt, dass ein Entzug überhaupt messbar ist
- **THEN** entzieht sie `from public, anon` und nicht nur `from public` — eine
  Gegenprobe, die die unzureichende Form vorführt, schreibt den Irrtum fest,
  den sie aufdecken soll

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

#### Scenario: Eine Edge Function liest public nicht als service_role

- **WHEN** eine Edge Function eine Tabelle in `public` liest oder schreibt
- **THEN** tut sie es über eine `SECURITY DEFINER`-Funktion, die `service_role`
  namentlich zugestanden ist
- **AND** ein direkter Tabellenzugriff mit dem Dienstschlüssel gilt als Befund,
  auch wenn er auf der Produktivinstanz heute gelingt

#### Scenario: Die Mail-Auskunft bindet Empfänger und Gegenüber an die Zeile

- **WHEN** die Auskunftsfunktion für eine Kontaktanfrage mit einer Empfänger-
  oder Gegenüber-Kennung gerufen wird, die nicht zu den beiden Beteiligten
  genau dieser Anfrage gehört
- **THEN** liefert sie keine Zeile, und weder Zustelladresse noch Anzeigename
  werden preisgegeben

#### Scenario: Die Bindung gilt ungeordnet, die Adresse gehört dem Empfänger

- **WHEN** dieselbe Anfrage einmal als neue Anfrage (Empfänger ist `to_id`) und
  einmal als Antwort darauf (Empfänger ist `from_id`) gemeldet wird
- **THEN** trägt die Auskunft **beide** Richtungen, denn Empfänger und Gegenüber
  tauschen je nach Ereignis die Rollen — ein nach `from_id`/`to_id` **geordnetes**
  Prädikat verwürfe jede Zusage- und Absage-Mail
- **AND** die gelieferte Zustelladresse gehört immer der **als Empfänger
  übergebenen** Kennung, damit ein Vertauschen der beiden Parameter nicht die
  Adresse des jeweils anderen preisgibt

#### Scenario: Eine fehlende Zustelladresse ist von einer verletzten Bindung unterscheidbar

- **WHEN** die Anfrage existiert und die Bindung stimmt, der Empfänger aber
  keine Zustelladresse hinterlegt hat
- **THEN** liefert die Auskunft **eine** Zeile mit leerer Adresse — nicht
  „keine Zeile"
- **AND** der Aufrufer behandelt das weiterhin als erledigten Normalfall und
  nicht als Abweichung, denn beides zu vermengen verwandelte eine fehlende
  Adresse in einen Wiederholungslauf
- **AND** dasselbe gilt für einen fehlenden Anzeigenamen des Gegenübers: die
  Zeile kommt, das Feld ist leer, und die Vorlage fällt auf ihren allgemeinen
  Wortlaut zurück

### Requirement: Helper predicates are the single authority for gating

The system SHALL centralise every authorization decision in the
server-controlled predicates `current_tier_rank()`, `has_level(int)`,
`is_activated()`, `is_matching_manager()`, and `is_admin()`, sourced from
`membership_tiers`/`profiles.tier`, `profiles.activated_at`,
`profiles.disabled_at`, `profiles.deleted_at` and `staff_roles`.

**Geändert mit AGE-581.** `is_activated()` und `is_activated_profile(uuid)`
tragen seither die vollständige Zugangsbedingung — aktiviert, nicht deaktiviert,
nicht gelöscht. Dass sie den alten Namen behalten, ist Absicht: rund vierzig
Policies rufen sie, und diese Policies einzeln umzuhängen hiesse, die Bedingung
vierzigmal neu zu schreiben und vierzig Gelegenheiten zu schaffen, sie falsch zu
schreiben. Der Preis ist ein Name, der weniger sagt, als die Funktion tut, und
er ist im Funktionskommentar auszugleichen.
Policies SHALL call these predicates rather than duplicating thresholds, and
elevated standing SHALL never derive from the member-writable `profiles.roles`.

Each predicate SHALL be `SECURITY DEFINER` with a pinned `search_path`, SHALL
return `false` rather than `null` for a caller without a session, and SHALL have
EXECUTE revoked from `public`/`anon`.

**Korrigiert 2026-08-05:** `is_prime_plus()` ist aus dieser Aufzählung
entfernt — die Funktion existiert seit AGE-311 nicht mehr. `has_level(int)` und
`is_activated()` sind an ihre Stelle getreten.

#### Scenario: Elevated standing is not member-forgeable

- **WHEN** a member sets `profiles.roles` to include `'admin'` or
  `'matching_manager'`
- **THEN** `is_admin()`/`is_matching_manager()` still return false, because they
  read `staff_roles`, which the client cannot write

#### Scenario: Tier threshold lives in one predicate

- **WHEN** a tier-gated policy needs a rank threshold
- **THEN** it calls `has_level(n)` (which encapsulates the `current_tier_rank()`
  comparison) rather than re-encoding the rank, so the threshold cannot drift
  between policies

#### Scenario: Die Aktivierung ist nicht vom Mitglied setzbar

- **WHEN** ein Mitglied versucht, `profiles.activated_at` selbst zu schreiben
- **THEN** wird das abgelehnt: auf dieser Spalte besteht kein Schreibrecht für
  Client-Rollen; sie wird ausschließlich serverseitig gesetzt

#### Scenario: Die Sperrfelder sind nicht vom Mitglied setzbar

- **WHEN** ein Mitglied versucht, `profiles.disabled_at` oder
  `profiles.deleted_at` selbst zu schreiben
- **THEN** wird das abgelehnt: auf diesen Spalten besteht kein Schreibrecht für
  Client-Rollen, wie auf `activated_at` auch

#### Scenario: Eine neue Policy erbt die vollständige Bedingung

- **WHEN** eine Policy `is_activated()` aufruft, ohne `disabled_at` oder
  `deleted_at` selbst zu nennen
- **THEN** schliesst sie deaktivierte und gelöschte Konten dennoch aus — die
  Bedingung steht im Prädikat, nicht in seinen Aufrufern

#### Scenario: Ein gesperrtes Konto sieht keinen Aktivierungsbildschirm

- **GIVEN** ein Konto, das bestätigt hat und danach deaktiviert wurde
- **WHEN** die Oberfläche seinen Zustand abfragt
- **THEN** erhält sie `activated = true` und `blocked = true`, und sie zeigt
  einen Sperrhinweis — nicht den Aktivierungsbildschirm und nicht die
  Möglichkeit, einen Zugangslink anzufordern

#### Scenario: Der Grund der Sperre bleibt drin

- **GIVEN** zwei gesperrte Konten, eines deaktiviert, eines gelöscht
- **WHEN** beide ihren Zustand abfragen
- **THEN** erhalten beide dieselbe Auskunft — welche Handlung ein Admin
  vorgenommen hat, geht aus ihr nicht hervor

#### Scenario: Die Auskunft bleibt schmal

- **WHEN** die Signatur der Zustandsfunktion untersucht wird
- **THEN** trägt sie genau drei Felder — Aktivierungszustand, Sperrzustand und
  Anzeigename — und kein Profil-, Kontakt- oder Stufendatum

### Requirement: Die Auth-Konfiguration jedes Projekts steht in der Versionskontrolle

Das System SHALL die Auth-Einstellungen eines Supabase-Projekts aus
`supabase/config.toml` beziehen und diese Datei als deren Quelle der Wahrheit
führen. Werte, die nur im Dashboard gesetzt sind, SHALL als abweichend gelten.

Vor dem ersten Übertragen der Datei auf ein bestehendes Projekt SHALL die
Live-Konfiguration dieses Projekts als Rückrollpunkt gesichert werden, weil das
Übertragen jeden dort gesetzten Wert überschreibt — auf jedem Ziel, nicht nur auf
PROD. Dieser Rückrollpunkt SHALL außerhalb des Repositories und mit auf den
Eigentümer beschränkten Rechten abgelegt werden: er kann je nach Projekt
Zugangsdaten für Mailversand oder externe Anmeldeverfahren enthalten.

Ob das Übertragen Felder, die die Datei nicht führt, auf Vorgabewerte
zurücksetzt, SHALL an einem Projekt ohne Daten gemessen werden, bevor die Datei
je auf ein Projekt mit Daten übertragen wird.

Die Datei SHALL die Konfiguration **des PROD-Projekts** führen und SHALL NOT auf
das DEV/DEMO-Projekt übertragen werden. Sie SHALL eine erreichbare `site_url`
tragen und SHALL NOT eine Localhost-Adresse als `site_url` eines gehosteten
Projekts führen.

Die Redirect-Allow-List des PROD-Projekts SHALL ausschließlich Adressen unter
der Kontrolle des Betreibers enthalten. Sie SHALL NOT eine Localhost- oder
Loopback-Adresse enthalten: eine solche Adresse ist auf einem Projekt mit echten
Mitgliedern ein Abflussweg für Anmelde- und Zurücksetzungslinks.

#### Scenario: Ein Anmeldelink kann nicht auf einen fremden Rechner umgeleitet werden

- **WHEN** eine Anmeldung oder Passwort-Zurücksetzung auf PROD eine Umleitung
  auf eine Loopback-Adresse anfordert
- **THEN** wird sie abgelehnt, weil die Allow-List des PROD-Projekts keine
  solche Adresse führt

#### Scenario: Ein Übertragen auf DEV findet nicht statt

- **WHEN** die Datei die strikten PROD-Werte trägt
- **THEN** wird sie nicht auf das DEV/DEMO-Projekt übertragen, dessen
  Konfiguration eigenständig geführt wird

#### Scenario: Ein Übertragen der Konfiguration setzt die Produktion nicht auf localhost

- **WHEN** `supabase/config.toml` auf ein gehostetes Projekt übertragen wird
- **THEN** trägt die Datei die tatsächliche öffentliche Adresse des Projekts, und
  Anmelde- sowie Aktivierungslinks bleiben einlösbar

#### Scenario: Der vorherige Zustand ist wiederherstellbar

- **WHEN** ein Übertragen eine Einstellung verschlechtert
- **THEN** liegt die vorherige Konfiguration als gesicherter Stand vor und kann
  zurückgeschrieben werden

### Requirement: Passwörter und Mail-Ratengrenzen sind für echte Mitglieder ausgelegt

Das System SHALL Passwörter unterhalb von **zehn** Zeichen als zu schwach
zurückweisen.

**Korrigiert nach Messung am 2026-08-05.** Der ursprüngliche Entwurf verlangte
hier „mindestens 30 Auth-Mails pro Stunde". Das ist nicht erfüllbar: Supabase
weist eine Erhöhung ab, solange kein eigener SMTP-Server konfiguriert ist —

```
PATCH /v1/projects/<ref>/config/auth  {"rate_limit_email_sent": 30}
→ HTTP 401  Custom SMTP required to configure ... RATE_LIMIT_EMAIL_SENT
```

Eine Anforderung, die das System nicht erfüllen kann, gehört nicht in die
durable Wahrheit — sie wäre in jeder Prüfung grün und im Betrieb falsch.

Das System SHALL einen eigenen SMTP-Dienst als Auth-Mailer verwenden, **bevor**
echte Mitglieder auf „Passwort vergessen" angewiesen sind. Erst damit ist die
projektweite Grenze überhaupt einstellbar; danach SHALL sie **mindestens 30**
Mails pro Stunde zulassen.

Solange das nicht gilt, SHALL der Betrieb wissen, dass die Grenze bei **zwei**
Mails pro Stunde liegt — projektweit, nicht pro Mitglied — und dass das
Zurücksetzen eines Passworts über das Dashboard erfolgt statt über die Mail.

Weil eine höhere projektweite Grenze zugleich mehr unaufgeforderte Mail
ermöglicht, SHALL die Zusage nicht allein auf ihr ruhen: die vorhandenen Grenzen
pro Absender-IP für Anmeldung und Zurücksetzung SHALL erhalten bleiben.

Die Bestätigung der E-Mail-Adresse durch Supabase Auth SHALL ausgeschaltet
bleiben; der Aktivierungsweg wird eigenständig über den Transaktionsmail-Dienst
gebaut.

#### Scenario: Mehrere Mitglieder setzen gleichzeitig ihr Passwort zurück

- **GIVEN** ein eigener SMTP-Dienst ist als Auth-Mailer konfiguriert
- **WHEN** mehrere Mitglieder innerhalb einer Stunde eine Zurücksetzung anfordern
- **THEN** erhalten alle ihre Mail, weil die Ratengrenze nicht bei einer
  einstelligen Zahl liegt

#### Scenario: Solange kein eigener SMTP-Dienst konfiguriert ist

- **GIVEN** der Auth-Mailer ist der eingebaute Dienst der Plattform
- **WHEN** die dritte Zurücksetzung innerhalb einer Stunde angefordert wird
- **THEN** wird keine Mail zugestellt, ohne dass die Oberfläche einen Fehler
  zeigt
- **AND** der Betriebsweg ist das Zurücksetzen im Dashboard, nicht das Warten
  auf die Mail

### Requirement: Eine Session allein gibt keine Mitgliederdaten frei

Das System SHALL jeden Zugriff auf **fremde** Mitgliederdaten zusätzlich davon
abhängig machen, dass das aufrufende Konto **zugangsberechtigt** ist.
Zugangsberechtigt ist ein Konto genau dann, wenn `profiles.activated_at` gesetzt
und **weder `profiles.disabled_at` noch `profiles.deleted_at` gesetzt** ist.
Diese drei Felder SHALL zusammen die einzige Wahrheit für diese Entscheidung
sein.

**Geändert mit AGE-581.** Zuvor stand `activated_at` allein. Es beantwortet
aber nur, ob jemand je hereingekommen ist — nicht, ob er noch hereinkommen darf.
Ein Verein, der niemanden ausschliessen kann, hat kein Gate, sondern eine
Einbahnstrasse.

Die drei Felder SHALL an **derselben** Stelle geprüft werden und SHALL NOT auf
verschiedene Prädikate verteilt werden. Eine Bedingung, die an einer Stelle zwei
und an einer anderen drei Felder prüft, ist keine Bedingung, sondern zwei.

Die Prüfung SHALL in der Datenbank stattfinden, nicht im Client. Ein Konto mit
gültiger Session, das sich mit einem eigenen Datenbank-Client anmeldet und die
Tabellen unmittelbar abfragt, SHALL keine fremden Mitgliederdaten erhalten.

Weil ein solches Konto die volle Mitgliedsstufe tragen kann, SHALL sich das Gate
nicht darauf verlassen, dass eine Stufenprüfung dahinter noch greift. Es SHALL
deshalb an **jeder** Stelle gesetzt sein, über die fremde Mitgliederdaten das
System verlassen:

- in den Policies der betroffenen Tabellen,
- im Rumpf jeder Sicht, die mit den Rechten ihres Eigentümers läuft und die
  Policies der Basistabelle damit umgeht,
- im Rumpf jeder privilegierten Funktion, die ihr Sichtbarkeitsprädikat selbst
  führt statt sich auf die Policies zu verlassen.

Das Gate SHALL **beide Seiten** prüfen. Ein Profil SHALL im Verzeichnis erst
erscheinen, wenn **sein Inhaber** bestätigt hat — nicht erst, wenn der Abfragende
bestätigt hat. Andernfalls sähen bereits bestätigte Mitglieder genau die Profile,
deren Inhaber sich nie ausgewiesen haben, und die Zusage an das Mitglied, sein
Profil sei bis zur Bestätigung für kein anderes Mitglied sichtbar, wäre unwahr.

Für Inhalte — Beiträge, Veranstaltungen, Kommentare und die zugehörigen
Interaktionen — SHALL diese zweite Prüfung entfallen: sie können keinen
unbestätigten Urheber haben, weil die schreibenden Zugriffe bereits gegatet sind.

Das Gate SHALL **auch die Daten des angemeldeten Kontos selbst** umfassen —
Kontaktdaten, Ziele, Benachrichtigungen, Einstellungen und das eigene Profil.
Wer sich mit einem weitergegebenen Passwort anmeldet, ist gegenüber der
Datenbank nicht ein Fremder, sondern **das Mitglied**; „eigene Daten" sind in
diesem Fall die Daten des Bestohlenen. Eine Ausnahme für den eigenen Datensatz
wäre deshalb keine Ausnahme, sondern die Lücke.

Maßgeblich ist die **Datenklasse, nicht eine Anzahl**. Unter das Gate SHALL
jede privilegierte Funktion fallen, die Mitgliederdaten **liefert oder
verändert** — Profil-, Kontakt-, Inhalts-, Teilnahme- oder Stufendaten, eigene
wie fremde. Nicht darunter SHALL fallen: Funktionen, die ausschließlich den
**Stand des Aufrufers gegenüber der Plattform** zurückgeben (seine Stufe, seine
Rolle, sein Aktivierungszustand), Funktionen über plattformweite Merker, sowie
Funktionen, die keiner API-Rolle zum Aufruf offenstehen. Sie tragen kein
Mitgliederdatum und brauchen das Gate nicht; eine Anzahl ungegateter Funktionen
zu nennen wäre irreführend, weil sie mit jeder Trigger- oder Prädikatfunktion
wächst, ohne dass sich die Fläche ändert.

Damit die Oberfläche, die zur Aktivierung führt, sich anzeigen **und ihren Link
anfordern** kann, SHALL das Gate **innerhalb dieser Datenklasse** für genau
zwei Funktionen ausgenommen sein und für keine weitere:

- eine, die ausschließlich zurückgibt, ob das aufrufende Konto aktiviert ist,
  **ob ihm der Zugang entzogen wurde**, sowie einen Anzeigenamen für die Anrede;
- eine, die dem **aufrufenden** Konto einen Aktivierungslink ausstellt.

Beide SHALL ihr Subjekt aus der Sitzung nehmen und SHALL NOT darüber hinaus
Profil-, Kontakt- oder Stufendaten preisgeben.

**Geändert mit AGE-581: aus zwei Feldern werden drei.** Die
Zustandsauskunft trägt zusätzlich einen Wahrheitswert `blocked`, der wahr ist,
wenn das Konto deaktiviert **oder** gelöscht ist. Ohne ihn zeigte die Oberfläche
einem gesperrten Konto den Aktivierungsbildschirm und lüde es ein, sich einen
Zugangslink schicken zu lassen — für einen Zugang, den es nicht mehr gibt.

**Ein Wahrheitswert, kein Zustandswort.** Ein Feld mit den Werten
`deaktiviert`/`gelöscht` verriete dem Betroffenen, welche der beiden Handlungen
ein Admin vorgenommen hat; das geht ihn so wenig an wie einen Leser des Feeds.
`blocked` fasst beide zusammen, und die Oberfläche braucht die Unterscheidung
nicht: sie zeigt in beiden Fällen denselben Hinweis und denselben Weg — sich
abzumelden und den Verein anzuschreiben.

`activated` SHALL seine Bedeutung behalten („hat je bestätigt") und SHALL NOT
umgedeutet werden. Ein gesperrtes, zuvor bestätigtes Konto trägt also
`activated = true, blocked = true` — beide Felder sind einzeln wahr und
zusammen eindeutig.

Der Test, der die Signatur dieser Funktion **wörtlich** festhält, SHALL
mitgeändert werden. Dass er bricht, ist seine Aufgabe: er hält fest, dass jedes
weitere Feld eine Entscheidung ist und kein Versehen. Die zweite SHALL NOT eine im
Aufruf mitgegebene Adresse annehmen — sonst wäre sie ein Weg, den ausstehenden
Link eines fremden Kontos zu entwerten.

Eine Funktion, die ein einzelnes Boolean über einen dem Aufrufer **bereits
bekannten** Fremdschlüssel zurückgibt, SHALL als benannte Restfläche geführt
werden statt als Ausnahme: sie gibt nichts preis, was ein Aufzählen erlaubte,
verrät aber die Existenz eines Profils.

Zugriffe der Rolle `anon` SHALL von diesem Gate unberührt bleiben: öffentliche
Beiträge und Veranstaltungen SHALL für ausgeloggte Besucher sichtbar bleiben.
Ebenfalls unberührt SHALL das Lesen plattformweiter Einstellungen bleiben, die
kein Mitgliedsdatum tragen.

#### Scenario: Ein nicht aktiviertes Konto sieht keine fremden Profile

- **GIVEN** ein Konto mit gültiger Session, höchster Mitgliedsstufe und
  `activated_at = null`
- **WHEN** es `profiles`, die öffentliche Profilsicht, `posts`, `events`,
  `offers`, `needs` oder `matches` unmittelbar abfragt
- **THEN** liefert jede dieser Abfragen **null Zeilen**

#### Scenario: Das Gate greift auch an der Sicht vorbei nicht

- **GIVEN** dasselbe nicht aktivierte Konto
- **WHEN** es die öffentliche Profilsicht abfragt, die mit den Rechten ihres
  Eigentümers läuft und die Policies der Basistabelle nicht auswertet
- **THEN** liefert auch sie null Zeilen, weil das Gate im Rumpf der Sicht steht

#### Scenario: Privilegierte Funktionen sind kein Seitenweg

- **GIVEN** dasselbe nicht aktivierte Konto
- **WHEN** es eine Funktion aufruft, die an den Policies vorbei zählt oder
  schreibt — etwa die Zählfunktionen für Beitrags- und Veranstaltungsresonanz
  oder die Anmeldung zu einer Veranstaltung
- **THEN** liefert die Zählfunktion leer und die schreibende Funktion lehnt ab

#### Scenario: Ein unbestätigtes Profil erscheint für niemanden im Verzeichnis

- **GIVEN** ein bereits bestätigtes Mitglied und ein Profil, dessen Inhaber noch
  nicht bestätigt hat
- **WHEN** das bestätigte Mitglied das Verzeichnis abfragt
- **THEN** ist das unbestätigte Profil nicht darin enthalten — die Zusage, bis
  zur Bestätigung für kein anderes Mitglied sichtbar zu sein, hält

#### Scenario: Das Verzeichnis füllt sich mit den Bestätigungen

- **GIVEN** ein frisch angelegter Bestand, in dem nur die Bestandskonten
  bestätigt sind
- **WHEN** das erste Mitglied nach seiner Bestätigung das Verzeichnis öffnet
- **THEN** sieht es ausschließlich die bestätigten Konten. Das ist der
  beabsichtigte Zustand und SHALL NOT als Fehler behandelt werden

#### Scenario: Auch die Daten des Kontos selbst bleiben verschlossen

- **GIVEN** ein Angreifer, der sich mit einem weitergegebenen Passwort als das
  Mitglied angemeldet hat
- **WHEN** er die Kontaktdaten, Ziele, Benachrichtigungen oder Einstellungen
  **dieses** Kontos liest oder dessen Profil ändern will
- **THEN** wird jeder dieser Zugriffe verweigert — insbesondere bleiben E-Mail
  und Telefonnummer des Mitglieds unlesbar

#### Scenario: Der Aktivierungsweg bleibt darstellbar

- **GIVEN** dasselbe nicht aktivierte Konto
- **WHEN** die Oberfläche den Aktivierungszustand abfragt
- **THEN** erhält sie ausschließlich die Auskunft „nicht aktiviert" und einen
  Anzeigenamen, und nichts sonst

#### Scenario: Unter fremdem Namen veröffentlichen ist ausgeschlossen

- **GIVEN** dasselbe nicht aktivierte Konto
- **WHEN** es einen Beitrag, ein Angebot, ein Gesuch oder eine Veranstaltung
  anlegen will
- **THEN** wird das verweigert, sodass kein Inhalt unter dem echten Namen eines
  Mitglieds erscheinen kann

#### Scenario: Der ausgeloggte Besucher sieht das Schaufenster weiter

- **WHEN** ein ausgeloggter Besucher öffentliche Beiträge oder Veranstaltungen
  abruft
- **THEN** erhält er sie unverändert — das Gate gilt nur für angemeldete Konten

#### Scenario: Ein nicht aktiviertes Konto sieht weniger als ein ausgeloggter Besucher

- **GIVEN** die öffentlichen Freigaben gelten für die ausgeloggte Rolle, und ein
  angemeldetes Konto fragt nicht als diese Rolle
- **WHEN** ein nicht aktiviertes Konto öffentliche Beiträge abruft
- **THEN** erhält es keine — die Oberfläche SHALL diesen Zustand benennen und
  den Weg zum Abmelden anbieten, damit er nicht als Fehler erscheint

#### Scenario: Ein deaktiviertes Konto sieht nichts mehr

- **GIVEN** ein Konto, das bestätigt hat und danach deaktiviert wurde, mit einer
  Sitzung, die noch gültig ist
- **WHEN** es `profiles`, die öffentliche Profilsicht, `posts` oder `events`
  unmittelbar abfragt
- **THEN** liefert jede dieser Abfragen **null Zeilen** — die noch laufende
  Sitzung hilft ihm nicht, weil das Gate in der Datenbank steht

#### Scenario: Ein deaktiviertes Profil verschwindet aus dem Verzeichnis

- **GIVEN** ein bestätigtes Mitglied und ein zweites, das deaktiviert wurde
- **WHEN** das erste das Verzeichnis abfragt
- **THEN** ist das deaktivierte Profil nicht darin enthalten — geprüft über
  Policy, öffentliche Profilsicht und Verzeichnisfunktion, weil alle drei die
  Bedingung führen

#### Scenario: Ein gelöschtes Profil ebenso

- **GIVEN** dieselbe Ausgangslage mit einem gelöschten statt deaktivierten
  Mitglied
- **WHEN** das erste das Verzeichnis abfragt
- **THEN** ist auch dieses Profil nicht enthalten

#### Scenario: Die Sperre steht schon vor der Sitzung

- **GIVEN** ein deaktiviertes Konto ohne laufende Sitzung
- **WHEN** es sich mit seinem gültigen Passwort anzumelden versucht
- **THEN** weist der Auth-Dienst die Anmeldung ab, es entsteht keine Sitzung —
  das Datenbank-Gate ist die zweite Sperre, nicht die einzige

### Requirement: Eine belegte Adresse verhindert die Übernahme eines Kontos nicht stillschweigend

Weil die Selbstregistrierung offen steht und keine Bestätigung voraussetzt, kann
eine E-Mail-Adresse bereits belegt sein, wenn die Mitgliedschaft dazu angelegt
werden soll. Das System SHALL für diesen Zusammenstoß ein bestimmtes,
aufgeschriebenes Verhalten haben und SHALL NOT ihn stillschweigend auflösen.

Es SHALL insbesondere NOT ein bestehendes, fremd angelegtes Konto durch bloße
Namensgleichheit der Adresse zu einer Mitgliedschaft erheben — sonst würde
gerade das vorab besetzte Konto zum Mitgliedskonto. Der Fall SHALL gemeldet und
von Hand entschieden werden.

Der Anlegevorgang selbst ist nicht Gegenstand dieses Changes; benannt wird hier
die Anforderung an ihn, die aus der offenen Selbstregistrierung folgt.

#### Scenario: Eine vorab besetzte Adresse

- **GIVEN** jemand hat sich mit der Adresse eines künftigen Mitglieds selbst
  registriert
- **WHEN** die Mitgliedschaft zu dieser Adresse angelegt werden soll
- **THEN** wird der Zusammenstoß gemeldet und von Hand entschieden; das
  bestehende Konto wird nicht automatisch zum Mitgliedskonto erhoben

### Requirement: Der Aktivierungsweg setzt ein Passwort nur gegen ein gültiges Token

Das System SHALL im Aktivierungsweg ein Passwort nur gegen ein gültiges,
einmalig verwendbares Token setzen. Die Anwendung SHALL keinen anderen Weg
anbieten — insbesondere keinen über die Einstellungen und keinen, der allein auf
einer bestehenden Sitzung beruht.

**Gemessen am 2026-08-05 gegen DEV, und deshalb hier ausgeschrieben statt
zugesagt:** Der Anmeldedienst selbst nimmt eine Passwortänderung **allein auf
Grundlage einer Sitzung** entgegen, ohne Token und ohne erneute Anmeldung. Er
liegt außerhalb der Datenbank; keine Policy erreicht ihn. Eine Anforderung, die
das verbietet, wäre in jeder Prüfung grün und im Betrieb falsch.

Was daraus folgt, SHALL das System stattdessen tragen:

- Wer ein verteiltes Passwort besitzt, SHALL dadurch **keinen Zugriff auf
  Mitgliederdaten** erlangen — das leistet das Aktivierungs-Gate, und es ist die
  eigentliche Zusage dieses Changes.
- Wer ein verteiltes Passwort ändert, SHALL das Mitglied damit **nicht dauerhaft
  aussperren** können. Der Weg zum Bestätigungslink SHALL ohne Anmeldung offen
  stehen, und die Einlösung SHALL das geänderte Passwort überschreiben.
- Aktivieren SHALL nur können, wer Zugriff auf das Postfach des Mitglieds hat.

Das Token SHALL die Identität des Mitglieds tragen, nicht die Session. Es SHALL
deshalb auch dann einlösbar sein, wenn es in einem anderen Browser oder auf einem
anderen Gerät geöffnet wird als dem, auf dem es angefordert wurde.

Das System SHALL vom Token **ausschließlich einen kryptografischen Hashwert**
speichern; der Klartext SHALL das System nur in der Mail an das Mitglied
verlassen. Das Token SHALL nach spätestens **72 Stunden** verfallen und SHALL
nach der ersten Einlösung verbraucht sein.

Die Tabelle der Token SHALL für die Client-Rollen unerreichbar sein: weder
`anon` noch `authenticated` SHALL Rechte auf ihr halten, und es SHALL keine
Policy für sie geben. Lesender und schreibender Zugriff SHALL ausschließlich
serverseitig erfolgen.

Je Profil SHALL höchstens **ein** Token einlösbar sein. Diese Eigenschaft SHALL
von der Datenbank erzwungen werden — durch eine Bedingung, die einen zweiten
ausstehenden Eintrag desselben Profils unmöglich macht — und SHALL NOT allein
auf einer vorangehenden Abfrage beruhen: zwei gleichzeitige Anforderungen kämen
sonst beide durch. Ein neuer Versand SHALL das ausstehende Token entwerten,
ebenso die erfolgreiche Einlösung. Andernfalls bliebe ein alter, nie geöffneter
Link monatelang ein Weg, das Passwort zu ändern.

Weil das System vom Token nur den Hashwert kennt, SHALL ein erneuter Versand
zwangsläufig ein **neues** Token erzeugen; der alte Link wird dadurch ungültig,
bevor seine Frist abgelaufen ist. Der Mailtext SHALL das benennen, sonst trifft
ein Mitglied, das zweimal anfordert und den ersten Link öffnet, auf eine
unerklärte Ablehnung.

Daraus folgt eine Restfläche, die hier benannt und nicht verschwiegen wird: Wer
die Adresse eines Mitglieds kennt, kann durch wiederholtes Anfordern dessen
ausstehenden Link immer wieder entwerten. Die Ratengrenze je Profil SHALL
deshalb ausdrücklich auch als Begrenzung dieses Falls gelten. Ein Zugang geht
dabei nicht verloren — das Mitglied fordert einen neuen Link an.

Das Token SHALL aus einem kryptografisch sicheren Zufallsgenerator stammen und
mindestens **256 Bit** Entropie tragen. Es ist der einzige Nachweis, den ein
öffentlich erreichbarer Einlöse-Endpunkt verlangt; seine Unerratbarkeit ist die
Eigenschaft, auf der das ganze Verfahren ruht. Der Einlöse-Endpunkt SHALL
zusätzlich die Versuchsrate begrenzen — nicht weil ein solches Token erraten
werden könnte, sondern damit anhaltendes Raten aus einer Herkunft ein Ende
findet und im Betrieb sichtbar wird. Die Grenze SHALL bei **20 fehlgeschlagenen
Versuchen je Herkunft in einem gleitenden Fenster von einer Stunde** liegen; der
21. SHALL abgewiesen werden.

Gezählt SHALL dabei **ausschließlich der fehlgeschlagene Versuch** werden, und
die Zählung SHALL **nach** dem Beanspruchen des Tokens stattfinden. Ein gültiges
Token SHALL deshalb **niemals** abgewiesen werden, auch nicht von einer bereits
gesperrten Herkunft. Das ist die Eigenschaft, die das Subjekt der Drossel
überhaupt erst wählbar macht: die Netzwerkadresse taugt als Subjekt genau dann,
wenn ein legitimer Aufruf nicht in sie hineinlaufen kann — sonst sperrte eine
geteilte Adresse (NAT) das echte Mitglied mit aus. Aus demselben Grund SHALL
eine gefälschte Herkunftsangabe folgenlos bleiben: sie füllt einen Zähler, der
niemanden aussperrt.

Die gespeicherte Herkunftsangabe ist ein personenbezogenes Datum und SHALL
deshalb nur im Fenster der Drossel gehalten und danach gelöscht werden; ein
Verlauf SHALL NOT entstehen. Für Client-Rollen SHALL sie unerreichbar sein —
kein Recht, keine Policy.

Die Grenze SHALL NOT als Ersparnis an Datenbankarbeit verstanden werden. Weil
zuerst beansprucht und erst danach gezählt wird, kostet jeder Fehlversuch bis
zum Erreichen der Grenze **mehr** Arbeit als ohne die Zählung — beanspruchen,
löschen, einfügen, zählen —, und jenseits der Grenze spart sie diese Arbeit
nicht ein, sondern verweigert die Antwort. Das ist der bewusst gewählte Preis
der Zusage „ein gültiges Token wird niemals abgewiesen": ob ein Token gültig
ist, lässt sich nur durch Nachsehen feststellen. Eine Sperre **vor** dem
Beanspruchen wäre die Lastbremse, die diese Zusage bricht; sie SHALL NOT
eingeführt werden, solange die Zusage gilt.

Die Drossel ist damit ein Zähler mit Missbrauchssignal, weder Lastbremse noch
Sicherheitsgrenze. Fällt sie aus, SHALL der Einlöseweg trotzdem tragen.

Das Klartext-Token SHALL NOT in einem Teil der Adresse stehen, den Browser,
Zwischenspeicher oder Server protokollieren. Es SHALL nach dem Auslesen aus der
Adresszeile entfernt werden, und die Seite SHALL keine verweisende Adresse an
Dritte weitergeben.

**Die Einlösung SHALL das Token zuerst beanspruchen.** Prüfung und Verbrauch
SHALL in **einer** Datenbankoperation zusammenfallen, die nur dann etwas
zurückgibt, wenn das Token in diesem Moment unbenutzt und unverfallen war. Ein
Prüfen mit anschließendem Vermerken SHALL NOT genügen: zwei gleichzeitige
Einlösungen desselben Tokens kämen beide durch und setzten verschiedene
Passwörter, und das Mitglied wüsste nicht, welches gilt.

Das Setzen des Passworts und das Setzen von `activated_at` können **nicht**
gemeinsam zurückgerollt werden: der Anmeldedienst liegt außerhalb der Datenbank.
Statt einer Zusage über Atomarität SHALL deshalb die **Reihenfolge** festgelegt
sein:

1. Token beanspruchen (atomar, siehe oben),
2. Passwort setzen,
3. alle bestehenden Sitzungen des Kontos beenden,
4. **erst danach** den Aktivierungsvermerk setzen.

Der Aktivierungsvermerk SHALL als **letzter** Schritt gesetzt werden, weil er das
Gate öffnet. Scheitert einer der Schritte davor, SHALL das Gate geschlossen
bleiben. Insbesondere SHALL NOT ein Konto aktiviert werden, dessen Sitzungen
nicht beendet werden konnten — sonst liefe genau die vorab angelegte Sitzung
eines Dritten hinter dem geöffneten Gate weiter, die dieser Change verhindern
soll.

**Was „Sitzungen beenden" nicht leistet — benannte Restfläche, keine Zusage.**
Das Beenden entfernt die Sitzung und ihre Erneuerungsmöglichkeit. Ein bereits
ausgegebener Zugriffs-Token ist jedoch **zustandslos**: er wird bei jeder
Abfrage anhand seiner Signatur geprüft, nicht gegen eine Sitzungstabelle, und
bleibt deshalb bis zu seiner Ablaufzeit gültig. Ein Dritter, der sich unmittelbar
vor der Aktivierung angemeldet hat, kann folglich **bis zum Ablauf dieses
Tokens** hinter dem geöffneten Gate weiterarbeiten.

Die Obergrenze dieser Restfläche SHALL die konfigurierte Token-Lebensdauer sein
und SHALL in der versionierten Auth-Konfiguration nachlesbar sein. Sie zu
schließen verlangt eine von zwei Entscheidungen — die Lebensdauer senken oder
die Sitzungskennung bei **jeder** Abfrage gegen die Sitzungstabelle prüfen
(teuer) — und beide sind ausdrücklich **nicht** Teil dieses Changes. Bis dahin
gilt: die Zusage ist „kein neuer Zugang mit dem verteilten Passwort", nicht
„jeder bestehende Zugriff endet sofort".

Ein Abbruch nach Schritt 2 SHALL ein Konto mit **neuem** Passwort und ohne
Aktivierung hinterlassen: das Mitglied kommt herein, sieht den
Aktivierungsbildschirm und fordert einen neuen Link an. Ein aktiviertes Konto,
das noch auf dem verteilten Passwort steht, SHALL NOT entstehen können.

Die Mindestlänge des Passworts SHALL serverseitig geprüft werden und SHALL in
der Oberfläche **dieselbe** sein. Eine Oberfläche, die eine kürzere Eingabe
annimmt, verwandelt eine Feldmeldung in einen Serverfehler und lässt das
Mitglied im Unklaren darüber, was von ihm verlangt wird.

#### Scenario: Die Anwendung bietet keinen Weg am Token vorbei

- **WHEN** ein angemeldetes, nicht aktiviertes Konto in der Anwendung nach einem
  Weg sucht, ein Passwort ohne Token zu setzen
- **THEN** gibt es keinen: weder in den Einstellungen noch auf einer anderen
  Oberfläche

#### Scenario: Ein am Anmeldedienst geändertes Passwort öffnet nichts

- **GIVEN** jemand hat mit dem verteilten Passwort eine Sitzung angelegt und das
  Passwort über den Anmeldedienst geändert
- **WHEN** er anschließend Mitgliederdaten abfragt
- **THEN** erhält er keine — das Gate hängt am Aktivierungsvermerk, nicht am
  Passwort

#### Scenario: Das Mitglied holt sein Konto zurück

- **GIVEN** dasselbe geänderte Passwort
- **WHEN** das Mitglied seinen Bestätigungslink einlöst und ein eigenes Passwort
  vergibt
- **THEN** ist das Passwort des Dritten überschrieben und dessen Sitzungen sind
  beendet

#### Scenario: Oberfläche und Server verlangen dieselbe Passwortlänge

- **WHEN** ein Mitglied im Aktivierungsformular ein zu kurzes Passwort eingibt
- **THEN** meldet die Oberfläche das am Feld, statt die Eingabe anzunehmen und
  einen Serverfehler zu zeigen

#### Scenario: Ein Token wirkt genau einmal

- **GIVEN** ein bereits eingelöstes Token
- **WHEN** derselbe Link erneut geöffnet wird
- **THEN** wird die Einlösung abgelehnt und dem Mitglied gesagt, dass sein Konto
  bereits aktiviert ist

#### Scenario: Ein abgelaufenes Token wird abgelehnt

- **GIVEN** ein Token, dessen Ablaufzeitpunkt überschritten ist
- **WHEN** der Link geöffnet wird
- **THEN** wird die Einlösung abgelehnt und ein Weg zu einem neuen Link
  angeboten

#### Scenario: Der Link wirkt in einem anderen Browser

- **GIVEN** ein Mitglied öffnet den Link auf einem Gerät ohne Session
- **WHEN** es das Token einlöst
- **THEN** gelingt das, weil das Token die Identität trägt

#### Scenario: Die Token-Tabelle ist für Clients nicht erreichbar

- **WHEN** eine Client-Rolle die Token-Tabelle zu lesen oder zu schreiben
  versucht
- **THEN** scheitert das mangels Rechten — unabhängig von jeder Policy

#### Scenario: Ein neuer Link entwertet den alten

- **GIVEN** ein Mitglied hat einen Bestätigungslink erhalten und fordert einen
  weiteren an
- **WHEN** es danach den **ersten** Link öffnet
- **THEN** wird dieser abgelehnt; einlösbar ist nur der zuletzt versendete

#### Scenario: Das Token landet nicht im Protokoll

- **WHEN** ein Mitglied den Bestätigungslink öffnet
- **THEN** steht das Klartext-Token in keinem Teil der Adresse, den der Server
  erhält, und es wird nach dem Auslesen aus der Adresszeile entfernt

#### Scenario: Ein Abbruch mitten in der Einlösung sperrt nicht aus

- **GIVEN** das Passwort wurde gesetzt, der Aktivierungsvermerk schlägt fehl
- **WHEN** das Mitglied sich anschließend anmeldet
- **THEN** gelangt es mit seinem **neuen** Passwort herein, sieht den
  Aktivierungsbildschirm und kann einen neuen Link anfordern

#### Scenario: Eine vorab angelegte Sitzung überdauert die Aktivierung nicht

- **GIVEN** jemand hat sich vor der Aktivierung mit dem verteilten Passwort
  angemeldet und hält eine Sitzung
- **WHEN** das Mitglied seinen Bestätigungslink einlöst
- **THEN** ist jene Sitzung beendet und lässt sich nicht erneuern

#### Scenario: Der bereits ausgegebene Zugriffs-Token läuft aus, statt zu enden

- **GIVEN** dieselbe vorab angelegte Sitzung, deren Zugriffs-Token noch nicht
  abgelaufen ist
- **WHEN** die Aktivierung abgeschlossen ist und das Gate sich öffnet
- **THEN** trägt dieser Token bis zu seiner Ablaufzeit weiter — das ist die
  benannte Obergrenze der Restfläche, keine Zusage, und sie endet ohne weiteres
  Zutun, weil eine Erneuerung nicht mehr möglich ist

#### Scenario: Ein misslungener Sitzungswiderruf öffnet das Gate nicht

- **GIVEN** das Beenden der bestehenden Sitzungen schlägt fehl
- **WHEN** die Einlösung an dieser Stelle abbricht
- **THEN** bleibt der Aktivierungsvermerk ungesetzt und das Gate geschlossen;
  das Mitglied kann die Einlösung mit einem neuen Link wiederholen

#### Scenario: Zwei gleichzeitige Einlösungen desselben Links

- **WHEN** derselbe Bestätigungslink zweimal gleichzeitig eingelöst wird
- **THEN** setzt genau einer der beiden Vorgänge ein Passwort; der andere wird
  abgelehnt, weil das Token bereits beansprucht war

#### Scenario: Wiederholte ungültige Einlösungen werden gedrosselt

- **GIVEN** von derselben Herkunft kamen bereits mehr fehlgeschlagene Versuche
  als die Grenze zulässt
- **WHEN** von dort ein weiterer **ungültiger** Link eingelöst wird
- **THEN** wird der Versuch abgewiesen, und die Oberfläche nennt den Weg nach
  vorn — einen neuen Link anfordern

#### Scenario: Die Drossel sperrt kein Mitglied mit gültigem Link aus

- **GIVEN** dieselbe, bereits gesperrte Herkunft — etwa der geteilte Anschluss
  eines Unternehmens
- **WHEN** von dort ein **gültiger** Bestätigungslink eingelöst wird
- **THEN** gelingt die Aktivierung, weil die Zählung erst hinter dem
  Beanspruchen des Tokens steht und einen gelungenen Versuch nie erfasst

#### Scenario: Zwei gleichzeitige Anforderungen erzeugen nicht zwei gültige Links

- **WHEN** zweimal gleichzeitig ein Bestätigungslink angefordert wird
- **THEN** bleibt höchstens ein Token ausstehend — die Datenbank lässt einen
  zweiten nicht zu

### Requirement: Der Weg zur Aktivierung setzt keine Anmeldung voraus

Das System SHALL einen Bestätigungslink auch dann anfordern lassen, wenn keine
Sitzung besteht — allein anhand der E-Mail-Adresse. Andernfalls hätte ein
Mitglied, dessen verteiltes Passwort von einem Dritten geändert wurde, keinen
Weg mehr zu seinem Konto: es käme nicht an der Anmeldung vorbei und erreichte
den Aktivierungsbildschirm nie.

Die Anforderung SHALL das Empfängerprofil **ausschließlich** aus der genannten
E-Mail-Adresse bestimmen. Sie SHALL NOT eine Angabe aus einem mitgesendeten
Anmeldenachweis verwenden: Auf einem Endpunkt, der ohne Sitzung erreichbar ist,
prüft niemand einen solchen Nachweis, und eine daraus gelesene Kennung wäre vom
Aufrufer frei wählbar.

Dieser sitzungsfreie Weg SHALL dem Wiederherstellungsfall vorbehalten sein. Für
ein angemeldetes Konto SHALL ein **getrennter, authentifizierter** Weg bestehen,
dessen Subjekt die Sitzung ist. Ein gemeinsamer Weg für beide wäre für den
Hauptfall unnötig offen: wer die Login-Adresse eines Mitglieds kennt, könnte in
dessen Namen anfordern.

Weil eine Ausgabe den zuvor ausgegebenen Link entwertet, SHALL der sitzungsfreie
Weg einen noch gültigen, unbenutzten Link **nicht** entwerten. Er SHALL die
Anforderung stattdessen folgenlos lassen und den bestehenden Link stehen lassen.
Andernfalls ist er kein Weg zurück ins Konto, sondern ein Weg, ein Mitglied
auszusperren.

Weil die Antwort dem Aufrufer zugestellt wird, **bevor** der Versand feststeht,
SHALL ein danach **abgelehnter** Versand das dabei ausgegebene Token entwerten.
Andernfalls liegt ein gültiges Token im System, zu dem es keinen zugestellten
Link gibt — und der schützende Nichtversand von oben hält genau diesen Zustand
bis zu einen Tag lang fest. Ein stiller Fehlschlag würde so zu der Aussperrung,
die dieselbe Regel verhindern soll.

Bleibt dagegen **ungewiss**, ob die Mail hinausging — etwa weil die Antwort des
Versanddienstes verlorenging, nachdem er sie angenommen hatte —, SHALL das Token
**gültig bleiben**. Ein zugestellter Link, den das System nachträglich entwertet,
wäre für das Mitglied schlimmer als ein offenes Schutzfenster: Es hielte eine
echte Mail in der Hand, deren Link „überholt" meldet, also die Auskunft für einen
Fall, der nicht eingetreten ist. Dieser Zustand SHALL stattdessen protokolliert
werden, weil er sonst nirgends sichtbar wird.

Dieselbe Pflicht — abgelehnter Versand entwertet sein Token, ungewisser nicht —
SHALL für den **angemeldeten** Weg gelten. Ihre Begründung ist dort eine andere:
Er antwortet nicht vorab, und ein Schutzfenster hat er nicht; der Schaden eines
abgelehnten Versands fällt also nicht auf ihn selbst, sondern auf den anderen.
Bleibt sein Token gültig liegen, sieht das Schutzfenster von oben ein
ausstehendes Token, und der sitzungsfreie Rückfallweg bleibt bis zu einen Tag
lang folgenlos — für einen Link, den es nie gab. Ein Fehlversand auf dem Weg
**mit** Sitzung SHALL NOT den Weg **ohne** Sitzung zusperren.

Der zuvor ausgegebene, vom neuen Versand überholte Link SHALL dabei entwertet
bleiben. Ihn zurückzuholen wäre eine Zustandsumkehr, die das System sonst
nirgends kennt, und sein Nutzen ist gering: Wer einen neuen Link anfordert, tut
es, weil der alte ihm nicht vorliegt. Der Preis SHALL benannt sein, statt
stillschweigend hingenommen zu werden.

Weil die Antwort in allen diesen Fällen ununterscheidbar bleiben muss, SHALL die
Meldung an das Mitglied **alle** Ausgänge abdecken, statt einen Versand
zuzusagen, den es nicht gegeben haben muss. Sie SHALL benennen, dass ein in den
letzten 24 Stunden bereits angeforderter Link weiter gilt, und einen Rückkanal
nennen. Andernfalls wartet, wer die Mail nie bekommen hat, auf etwas, das nicht
mehr kommt — und liest dabei eine Erfolgsmeldung.

Der Empfänger SHALL in jedem Fall die hinterlegte Adresse des Profils sein,
niemals eine im Aufruf mitgegebene. Andernfalls wäre der Endpunkt ein Weg, sich
den Bestätigungslink eines fremden Kontos zusenden zu lassen.

Damit der Weg des Mitglieds das verteilte Passwort nicht berühren muss, SHALL
der Versand bereits angestoßen sein, bevor sich jemand anmelden kann. Das
Anlegen der Konten ist nicht Gegenstand dieses Changes; dieser SHALL die
Anforderung lediglich als Schnittstelle bereitstellen, die ohne Sitzung und für
ein einzelnes Profil aufrufbar ist, und die Erwartung an den Anlegevorgang
benennen.

Die Antwort auf eine solche Anforderung SHALL unabhängig davon gleich ausfallen,
ob zu der Adresse ein Konto besteht. Andernfalls wäre die Schnittstelle ein
Verzeichnis der Mitgliedsadressen.

Gleich SHALL dabei nicht nur der **Inhalt** der Antwort sein, sondern auch ihr
**Zeitpunkt**. Das System SHALL deshalb zuerst antworten und den Versand erst
**danach** anstoßen. Andernfalls verriete die Antwortdauer, was die
gleichlautende Antwort verbergen soll: eine bekannte Adresse zöge die Runde zum
Versanddienst nach sich, eine unbekannte nicht. Diese Reihenfolge ist die Abwehr
des Adress-Orakels und SHALL als Anforderung gelten — sie SHALL NOT allein als
Hinweis im Quelltext stehen, weil eine Umstellung des Ablaufs sie dort
folgenlos aufheben könnte.

#### Scenario: Ein übernommenes Passwort sperrt nicht dauerhaft aus

- **GIVEN** ein Dritter hat das verteilte Passwort eines Kontos geändert
- **WHEN** das Mitglied ohne Anmeldung einen Bestätigungslink über seine Adresse
  anfordert
- **THEN** erhält es ihn und kann sein Konto zurückholen; das Passwort des
  Dritten wird dabei überschrieben

#### Scenario: Die Anforderung verrät keine Adressen

- **WHEN** ein Bestätigungslink für eine Adresse angefordert wird, zu der kein
  Konto besteht
- **THEN** ist die Antwort nicht von der für eine bestehende Adresse zu
  unterscheiden — weder in Statuscode und Inhalt noch darin, dass sie später
  käme: versendet wird erst, nachdem geantwortet wurde

#### Scenario: Ein Fremder kann ein Mitglied nicht aussperren

- **GIVEN** ein Mitglied hat einen gültigen, unbenutzten Bestätigungslink im
  Postfach
- **WHEN** ein Dritter über die bekannte Login-Adresse **ohne Sitzung** einen
  neuen Link anfordert
- **THEN** bleibt der Link im Postfach gültig, es wird kein neuer ausgegeben,
  und das Tageskontingent des Mitglieds bleibt unberührt

#### Scenario: Ein fehlgeschlagener Versand sperrt nicht bis zum nächsten Tag

- **GIVEN** eine Anforderung wurde angenommen und der Versand der Mail schlägt
  danach fehl
- **WHEN** für dieselbe Adresse erneut ein Bestätigungslink angefordert wird
- **THEN** gilt das Token des Fehlversands nicht mehr als ausstehend, und die
  erneute Anforderung gibt einen Link aus, statt folgenlos zu bleiben

#### Scenario: Ein ungewisser Versand entwertet den Link nicht

- **GIVEN** eine Anforderung wurde angenommen und der Versanddienst hat die Mail
  angenommen, seine Antwort ging aber verloren
- **WHEN** das Mitglied den Link aus der zugestellten Mail öffnet
- **THEN** wirkt er — das System hat ihn nicht nachträglich entwertet

#### Scenario: Die Meldung sagt nichts zu, was nicht geschehen sein muss

- **WHEN** eine Anforderung ohne Anmeldung angenommen wurde
- **THEN** nennt die Meldung sowohl den soeben verschickten Link als auch den
  bereits vorhandenen und einen Rückkanal — und sie unterscheidet die Fälle nicht

#### Scenario: Der Hauptweg nimmt keine Adresse entgegen

- **WHEN** ein angemeldetes, nicht aktiviertes Konto den Bestätigungslink vom
  Aktivierungsbildschirm anfordert
- **THEN** bestimmt sich der Empfänger aus der Sitzung; eine im Aufruf
  mitgegebene Adresse gibt es nicht und kann folglich nicht gefälscht werden

#### Scenario: Ein Fehlversand auf dem angemeldeten Weg sperrt den sitzungsfreien nicht

- **GIVEN** ein angemeldetes Konto hat einen Bestätigungslink angefordert und der
  Versand wurde abgelehnt
- **WHEN** dasselbe Mitglied den Link danach **ohne** Sitzung über seine Adresse
  anfordert
- **THEN** gilt das Token des Fehlversands nicht mehr als ausstehend, und die
  Anforderung gibt einen Link aus, statt folgenlos zu bleiben

### Requirement: Der Aktivierungsversand ist gegen Selbstüberflutung begrenzt

Das System SHALL die Anzahl der Aktivierungsmails **pro Mitgliedsprofil**
begrenzen, nicht nur pro Absender-IP. Die Begrenzung SHALL serverseitig aus
gespeichertem Zustand abgeleitet werden, damit sie auch bei mehreren gleichzeitig
laufenden Instanzen gilt.

Die Grenzen SHALL benannte Werte tragen, sonst ist keines der folgenden
Szenarien prüfbar:

- Zwischen zwei Ausgaben für dasselbe Profil SHALL eine **Sperrfrist von 60
  Sekunden** liegen.
- Je Profil SHALL innerhalb von **24 Stunden** höchstens **fünf** Token
  ausgegeben werden. Das ist das „Tageskontingent", auf das sich die Szenarien
  berufen.
- Auf dem **sitzungsgebundenen** Ausgabeweg SHALL für ein Profil, das **jünger
  als 10 Minuten** ist, kein Token ausgegeben werden, wenn in der **letzten
  Stunde** bereits **einhundert** Token ausgegeben wurden. Gezählt werden dabei
  die Ausgaben **aller** Profile und **beider** Ausgabewege.

Diese Grenze ist bewusst **nicht** als plattformweite Zusage formuliert. Der
adressbasierte Ausgabeweg, den ein Admin für importierte Mitglieder anstößt,
zählt in das Kontingent hinein, wird aber nicht von ihm gebremst. Eine Zusage
über „alle Token der Plattform" verspräche eine Schranke an einer Stelle, an der
dieser Change keine baut.

Die Grenze schützt das Versandkontingent gegen den einen Fall, den der
automatische Versand neu erzeugt: den Registrierungsschwall. Sie SHALL NOT davon
abhängen, was der Aufrufer über sich selbst behauptet — ein Feld im Anfragerumpf
setzte der Missbrauchende selbst. Das Alter des Profils ist serverseitig
prüfbar, die Absicht des Aufrufers nicht.

Die Beschränkung auf junge Profile ist kein Nachlass, sondern der Zweck: Ein
Mitglied, dessen Konto älter ist, SHALL über den Bestätigungsknopf immer
durchkommen. Andernfalls sperrte ein verbrauchtes Stundenkontingent echte
Mitglieder aus, und der Missbrauch würde zur Aussperrung.

**Was diese Grenze kostet, SHALL benannt bleiben:** Ist das Kontingent
erschöpft, bekommt ein frisch registriertes Konto keine automatische Mail. Die
Sperre SHALL sich von selbst lösen — sobald das Profil 10 Minuten alt ist,
greift die Grenze für es nicht mehr, und der Bestätigungsknopf trägt. Der
Zugangsweg ist damit verzögert, nicht verschlossen. Ein Missbrauchender, der das
Kontingent verbrennt, SHALL kein Konto dauerhaft aussperren können.

Die Prüfung dieser Grenze SHALL **atomar** zur Ausgabe erfolgen. Eine Zählung,
die nur vor dem Schreiben liest, hält die Grenze genau in dem Fall nicht ein,
für den sie existiert: Mehrere gleichzeitige Registrierungen lesen denselben
Stand unterhalb der Schwelle und schreiben alle. Das ist dieselbe Pflicht, die
für Sperrfrist und Tageskontingent bereits gilt — nur greift die Sperre auf der
eigenen Profilzeile hier nicht, weil die Grenze profilübergreifend ist.

Der Wert **einhundert** trägt den Fall „siebzig Mitglieder an einem Abend", auf
den sich diese Anforderung schon vorher berief, auch dann, wenn der Abend sich
in einer Stunde verdichtet.

Auch eine an dieser Grenze abgewiesene Anforderung SHALL keinen Zugang kosten:
Es wird kein Token ausgegeben, und der zuletzt ausgegebene Link bleibt gültig.

Eine über diese Grenzen hinausgehende Anforderung SHALL abgewiesen werden, ohne
dass ein Zugang verlorengeht: der zuletzt ausgegebene Link SHALL gültig bleiben.

Eine erneute **Aktivierungs**anforderung für ein bereits aktiviertes Konto SHALL
keine **Aktivierungsmail** auslösen — an einem aktivierten Konto gibt es nichts
zu aktivieren — und SHALL NOT als Fehler des Aufrufers behandelt werden. Ein
Versand zu **anderem Zweck** über denselben Endpunkt bleibt davon unberührt: den
Weg zurück für ein Konto mit vergessenem Passwort regelt AGE-505
(`password-reset-flow`). Ohne diese Verengung sagte der Satz mehr, als er
schützen soll, und die beiden Changes widersprächen einander.

Der Aktivierungsversand SHALL NOT über den eingebauten Mailversand der
Auth-Plattform laufen. Dessen projektweite Grenze ist ohne eigenen SMTP-Dienst
nicht erhöhbar und für den Fall „siebzig Mitglieder an einem Abend" zu klein;
außerdem SHALL Absender und Text unter der Kontrolle des Betreibers stehen.

#### Scenario: Zweimal hintereinander anfordern

- **WHEN** ein Mitglied den Bestätigungslink zweimal innerhalb der Sperrfrist
  anfordert
- **THEN** wird nur die erste Mail versendet

#### Scenario: Das Tageskontingent ist erschöpft

- **WHEN** für dasselbe Profil innerhalb von 24 Stunden ein sechster
  Bestätigungslink angefordert wird
- **THEN** wird weder ein weiteres Token ausgegeben noch eine weitere Mail
  versendet, und der zuletzt ausgegebene Link bleibt gültig

#### Scenario: Aktivierung anfordern für ein bereits aktiviertes Konto

- **WHEN** ein bereits aktiviertes Konto über den Aktivierungsbildschirm einen
  Bestätigungslink anfordert
- **THEN** wird keine Aktivierungsmail versendet und der Aufruf gilt als
  erfolgreich

#### Scenario: Das Stundenkontingent ist erschöpft und ein frisches Konto fordert an

- **WHEN** in der letzten Stunde bereits einhundert Token ausgegeben wurden und
  ein Profil, das jünger als 10 Minuten ist, einen Bestätigungslink anfordert
- **THEN** wird kein weiteres Token ausgegeben und keine Mail versendet, und der
  zuletzt ausgegebene Link bleibt gültig

#### Scenario: Das Stundenkontingent ist erschöpft und ein bestehendes Mitglied fordert an

- **WHEN** in der letzten Stunde bereits einhundert Token ausgegeben wurden und
  ein Profil, das älter als 10 Minuten ist, einen Bestätigungslink anfordert
- **THEN** wird ein Token ausgegeben und die Mail versendet

#### Scenario: Das gesperrte frische Konto kommt nach zehn Minuten durch

- **WHEN** ein frisch registriertes Konto am erschöpften Stundenkontingent
  abgewiesen wurde und zehn Minuten später erneut anfordert
- **THEN** wird ein Token ausgegeben, auch wenn das Kontingent noch erschöpft ist

#### Scenario: Gleichzeitige Anforderungen an der Schwelle

- **WHEN** mehrere Anforderungen frischer Profile gleichzeitig laufen, während
  das Kontingent fast erschöpft ist
- **THEN** werden insgesamt nicht mehr als einhundert Token in der Stunde
  ausgegeben

### Requirement: Die Grenzen der Token-Ausgabe gelten auch gegen gleichzeitige Anforderungen

Die Grenzen, die eine Token-Ausgabe begrenzen — Sperrfrist, Tageskontingent und
das Schutzfenster für einen noch gültigen Link —, SHALL auch dann gelten, wenn
zwei Anforderungen für dasselbe Profil gleichzeitig laufen.

Sie SHALL NOT allein auf einer vorangehenden Abfrage beruhen. Zwischen dem Lesen
des Zustands und dem Schreiben liegt sonst ein Fenster, in dem eine zweite
Anforderung ihr Token committet; die gelesene Antwort ist dann veraltet, und der
nachfolgende Schreibvorgang entwertet genau den frischen Link, den das
Schutzfenster schützen soll.

Das ist dieselbe Pflicht, die für die Einmaligkeit je Profil bereits gilt, nur
auf die Grenzen gezogen. Für die Einmaligkeit trägt sie eine Bedingung der
Datenbank; für die Grenzen kann sie das nicht, weil „nichts tun" sich nicht als
Bedingung schreiben lässt. Sie SHALL deshalb durch eine **Sperre** erfüllt
werden, die alle ausgebenden Wege **vor** ihren Prüfungen auf dieselbe Zeile
nehmen.

Welche Grenze den unterliegenden Aufruf fängt, SHALL NOT Teil dieser Zusage
sein. Zwei Anforderungen, die dicht genug beieinander liegen, um sich zu
überholen, liegen auch innerhalb der Sperrfrist — diese greift dann zuerst, und
Schutzfenster wie Tageskontingent werden gar nicht erreicht. Zugesagt ist die
**Wirkung**: der Verlierer entwertet nichts und gibt nichts aus.

Die Sperre SHALL von **jedem** ausgebenden Weg genommen werden — dem
sitzungsfreien wie dem authentifizierten. Nimmt nur einer sie, serialisiert sie
die Wege nicht gegeneinander, und der Wettlauf zwischen ihnen bleibt offen.

Die beiden ausgebenden Wege SHALL die beteiligten Zeilen in derselben
Reihenfolge sperren — erst die Profilzeile, dann die Token-Zeilen. Jeder
künftige Schreiber, der beide Tabellen anfasst, SHALL dieselbe Reihenfolge
einhalten; die Freiheit von wechselseitiger Blockade folgt aus dieser
Reihenfolge und nicht aus der Sperre allein.

Die bestehende Bedingung der Datenbank gegen ein zweites ausstehendes Token
SHALL **bestehen bleiben**. Sie deckt einen anderen Fall ab als die Sperre —
Schreibvorgänge, die an den ausgebenden Wegen vorbeigehen und die Sperre deshalb
nie sehen — und ihr Wegfall tauschte einen belegten Schutz gegen einen neuen.

Der authentifizierte Weg SHALL **kein** Schutzfenster bekommen. Sein Subjekt ist
die Sitzung; wer angemeldet ist, darf sich einen neuen Link ausstellen lassen.
Für ihn wirkt die Sperre anders: sie verhindert, dass zwei gleichzeitige eigene
Anforderungen einen Datenbankfehler an den Aufrufer durchreichen.

#### Scenario: Die verlierende Anforderung entwertet den frischen Link nicht

- **GIVEN** ein Profil, dessen ausstehender Link älter ist als das Schutzfenster
- **WHEN** zwei Anforderungen für dieses Profil gleichzeitig laufen und die
  erste ihr Token committet, bevor die zweite ihren Schreibvorgang beginnt
- **THEN** antwortet **genau eine** der beiden mit einem ausgebenden Status
- **AND** das committete Token der Gewinnerin ist danach **weder entwertet noch
  ersetzt**
- **AND** die Verliererin antwortet mit einer der Grenzen — bei zwei
  Anforderungen innerhalb der Sperrfrist mit deren Status

#### Scenario: Der authentifizierte Weg reicht keinen Datenbankfehler durch

- **WHEN** ein angemeldetes Mitglied zweimal gleichzeitig einen eigenen Link
  anfordert
- **THEN** kehren beide Aufrufe **ohne Datenbankfehler** zurück
- **AND** nur einer von beiden hat ein Token ausgegeben

#### Scenario: Der Schutz gilt auch zwischen den beiden Wegen

- **WHEN** eine sitzungsfreie und eine authentifizierte Anforderung für dasselbe
  Profil gleichzeitig laufen — in beliebiger Reihenfolge, wer zuerst kommt
- **THEN** wartet die zweite nachweislich auf die erste, statt auf einem
  veralteten Stand zu entscheiden
- **AND** auch hier gibt genau eine der beiden ein Token aus

#### Scenario: Einfügen an den ausgebenden Wegen vorbei bleibt abgewiesen

- **WHEN** ein zweites ausstehendes Token für dasselbe Profil geschrieben wird,
  ohne einen der ausgebenden Wege zu benutzen
- **THEN** weist die Datenbank es weiterhin ab
- **AND** ein ausgebender Weg, der dabei unterliegt, meldet den Fehler **nicht**
  an seinen Aufrufer weiter

### Requirement: Eine Selbstregistrierung löst den Bestätigungslink selbst aus

Das System SHALL nach einer erfolgreichen Selbstregistrierung den
Bestätigungslink **ohne weiteres Zutun des Registrierenden** ausgeben und
versenden. Der Versand SHALL über denselben sitzungsgebundenen Weg laufen wie
der Knopf auf dem Aktivierungsbildschirm; ein zweiter Versandweg SHALL NOT
entstehen.

**„Erfolgreich" heißt: es besteht eine Sitzung.** Nicht „der Anmeldedienst
antwortete ohne Fehler". Die beiden fallen auseinander, und genau dort saß der
Fehler: Auf eine Registrierung mit einer **bereits bekannten** Adresse antwortet
der Anmeldedienst mit Erfolg, ohne Fehler und **ohne Sitzung** — sein Schutz
gegen das Aufzählen vorhandener Adressen. Ein Auslöser, der nur „kein Fehler"
prüft, feuert dann in ein Konto hinein, das dem Aufrufer nicht gehört: Der
sitzungsgebundene Versand hat keine Sitzung und scheitert mit `42501`, und die
Zählung meldet eine Registrierung, die nie stattfand.

Alle Nebenwirkungen des Erfolgsfalls — Versand **und** Ereigniszählung — SHALL
deshalb an der bestehenden Sitzung hängen, nicht am ausbleibenden Fehler.

Der Grund für den Auslöser selbst ist die Bauart des Zugangs: Ein selbst
registriertes Konto trägt keinen Aktivierungszeitpunkt und steht damit hinter dem
Gate, und der Link ist für dieses Konto die einzige Tür. Ohne einen Auslöser ist
die Registrierung eine Sackgasse, die wie ein Erfolg aussieht.

Der Knopf auf dem Aktivierungsbildschirm SHALL als zweiter Weg bestehen bleiben.
Er ist der Ausweg, wenn der automatische Versand fehlschlägt.

Ein fehlgeschlagener Versand SHALL die Registrierung NICHT ungültig machen: Das
Konto ist angelegt und die Sitzung besteht, bevor der Versand beginnt.

#### Scenario: Registrierung gibt ein Token aus, ohne dass jemand klickt

- **WHEN** sich jemand erfolgreich selbst registriert
- **THEN** ist für sein Profil genau ein Aktivierungstoken ausgegeben, ohne dass
  er den Bestätigungsknopf gedrückt hat

#### Scenario: Der Versand nach der Registrierung schlägt fehl

- **WHEN** die Registrierung erfolgreich war, der anschließende Versand aber
  fehlschlägt
- **THEN** bleiben Konto und Sitzung bestehen, und der Aktivierungsbildschirm
  bietet den Bestätigungsknopf an

#### Scenario: Ohne Sitzung läuft keine Nebenwirkung des Erfolgsfalls

- **WHEN** eine Registrierung ohne Fehler, aber **ohne Sitzung** zurückkommt
- **THEN** wird **kein** Bestätigungslink angefordert und **kein**
  Registrierungsereignis gezählt

### Requirement: Der Aktivierungsbildschirm meldet nur einen Versand, den es gab

Der Aktivierungsbildschirm SHALL einen Versand nur dann als erfolgt melden, wenn
tatsächlich ein Token ausgegeben wurde. Der Status der Anforderung SHALL bis zur
Oberfläche durchgereicht werden.

Eine Anforderung, die an einer Grenze abgewiesen wurde, SHALL NOT wie ein
Versand aussehen. Andernfalls entsteht genau der Fehler, den der automatische
Versand behebt: Der Nutzer wartet auf eine Mail, die niemand abgeschickt hat.

Das ist die unmittelbare Folge des automatischen Versands: Er verbraucht die
Sperrfrist sofort, und die nächste Anforderung innerhalb dieser Frist wird
abgewiesen. Ohne diese Zusage wäre der wahrscheinlichste Fall der, der falsch
gemeldet wird.

Ein **fehlgeschlagener Versand** SHALL ebenfalls als solcher erkennbar sein und
SHALL NOT im selben Zweig landen wie eine abgewiesene Anforderung. Der
Ausgabeweg antwortet auch dann mit einem Fehler, wenn ein Token ausgegeben, die
Mail aber nicht angenommen wurde; wer beides zusammenwirft, meldet dem Nutzer
eine Wartezeit, wo ein erneuter Versuch nötig ist.

#### Scenario: Anforderung innerhalb der Sperrfrist nach dem automatischen Versand

- **WHEN** ein Mitglied nach dem automatischen Versand innerhalb der Sperrfrist
  den Bestätigungsknopf drückt
- **THEN** meldet der Bildschirm keinen Versand, sondern dass gerade erst ein
  Link **angefordert** wurde und ein erneuter Versuch kurz warten muss. Er SHALL
  dabei NICHT behaupten, dass eine Mail unterwegs oder im Postfach ist: Die
  Sperrfrist hängt am Zeitpunkt der Anforderung, nicht am Versandergebnis, und
  greift deshalb auch dann, wenn der vorige Versand fehlschlug

#### Scenario: Der Versand wird abgelehnt

- **WHEN** eine Anforderung ein Token ausgibt, der Mailversand aber fehlschlägt
- **THEN** meldet der Bildschirm keinen Versand, sondern einen Fehlschlag mit
  der Möglichkeit, es erneut zu versuchen

#### Scenario: Ein ausgegebenes Token wird als Versand gemeldet

- **WHEN** eine Anforderung ein Token ausgibt
- **THEN** meldet der Bildschirm, dass der Link unterwegs ist

### Requirement: Die Selbstregistrierung erhebt kein Passwort

Die Selbstregistrierung SHALL **kein Passwort erheben**. Sie SHALL Name und
E-Mail-Adresse verlangen und sonst nichts.

Der Grund ist die Dopplung, die sonst entsteht: Das Einlösen des
Bestätigungslinks setzt ohnehin ein Passwort, und dieses ersetzt ein bei der
Registrierung gewähltes. Ein Passwort, das gesetzt, nie gebraucht und
stillschweigend überschrieben wird, ist kein Schutz, sondern ein Schritt, der
Vertrauen kostet.

Das Konto SHALL trotzdem ein Passwort tragen — der Anmeldedienst kennt keines
ohne. Für dieses gilt:

- Es SHALL dem Registrierenden **nicht bekannt werden können**: weder angezeigt
  noch protokolliert noch aus der Eingabe ableitbar.
- Es SHALL NOT über Konten hinweg dasselbe sein. Ein fester Wert wäre ein
  Generalschlüssel für jedes Konto in genau dem Fenster, in dem das Gate noch
  geschlossen ist, der Anmeldedienst aber schon Sitzungen ausgibt.

**Was das NICHT löst, und deshalb hier steht:** Wer eine fremde Adresse
registriert, kann das weiterhin. Diese Anforderung nimmt ihm nur das Passwort
aus der Hand; was ihn aufhält, ist unverändert das Aktivierungs-Gate.

#### Scenario: Die Registrierung verlangt kein Passwort

- **WHEN** jemand das Registrierungsformular öffnet
- **THEN** wird nach Name und E-Mail-Adresse gefragt und nach keinem Passwort

#### Scenario: Die Registrierung geht ohne Passworteingabe durch

- **WHEN** jemand Name und Adresse einträgt und absendet
- **THEN** wird das Konto angelegt, ohne dass eine Passwortprüfung die Eingabe
  abweist

#### Scenario: Zwei Registrierungen erhalten nicht dasselbe Passwort

- **WHEN** zwei Konten nacheinander selbst registriert werden
- **THEN** tragen sie verschiedene Passwörter

### Requirement: Ein gesetztes Passwort wird bestätigt, bevor der Weg weitergeht

Hat jemand über einen gültigen Token ein Passwort gesetzt, SHALL das System das
**bestätigen**, bevor es ihn weiterschickt. Die Bestätigung SHALL sichtbar sein,
nicht nur ein Zustandswechsel im Hintergrund.

Der Grund ist die Lage, in der dieser Mensch steht: Unmittelbar nach dem Setzen
werden **alle Sitzungen widerrufen**, auch die eigene — das ist richtig und
bleibt so. Ohne Rückmeldung sieht das aus wie ein Rauswurf. Wer nicht erfährt,
dass es geklappt hat, versucht es erneut, hält den Link für kaputt oder
schreibt den Support an.

Der Weg zum Login SHALL **beides** anbieten: eine Handlung, die sofort führt,
und eine Weiterleitung von selbst für den, der nichts tut. Die Weiterleitung
SHALL angekündigt sein, damit sie nicht als Sprung erscheint.

Die Bestätigung SHALL zum **Zweck** passen, unter dem das Token eingelöst wurde.
Wer sein Passwort zurückgesetzt hat, wurde nicht aktiviert; ein Text, der beides
gleich nennt, sagt der Hälfte der Menschen etwas Falsches.

#### Scenario: Nach dem Setzen erscheint eine Bestätigung

- **WHEN** ein Passwort erfolgreich gegen ein gültiges Token gesetzt wurde
- **THEN** erscheint eine sichtbare Bestätigung, dass das Passwort gesetzt ist,
  bevor der Login gezeigt wird

#### Scenario: Der Weg zum Login steht offen, ohne zu warten

- **WHEN** die Bestätigung erscheint
- **THEN** gibt es eine Handlung, die sofort zum Login führt

#### Scenario: Wer nichts tut, wird von selbst weitergeleitet

- **WHEN** die Bestätigung erscheint und niemand handelt
- **THEN** führt das System nach einer angekündigten Frist zum Login

#### Scenario: Der Wortlaut folgt dem Zweck

- **WHEN** ein Passwort über den Weg des **Zurücksetzens** gesetzt wurde
- **THEN** spricht die Bestätigung vom zurückgesetzten Passwort und nicht von
  einer Aktivierung

### Requirement: Eine Registrierung auf eine bekannte Adresse führt weiter

Wie der Anmeldedienst auf eine Registrierung mit einer **bereits bekannten**
Adresse antwortet, hängt an einer seiner Einstellungen. **Gemessen am
2026-08-25:**

- Ist die eingebaute E-Mail-Bestätigung **aus**, antwortet er mit **HTTP 422 und
  dem Code `user_already_exists`** — also mit einem Fehler, dessen Text
  („User already registered") englisch ist und die Existenz des Kontos
  ausspricht.
- Ist sie **an**, antwortet er mit Erfolg, **ohne Fehler und ohne Sitzung**. Das
  ist sein Schutz gegen das Aufzählen vorhandener Adressen und SHALL NOT
  umgangen werden.

Die Oberfläche SHALL **beide** Ausgänge auf **denselben** Hinweis führen, der
weiterführt. Sie SHALL NOT den rohen Fehlertext des Anmeldedienstes anzeigen.

Der Grund, beide gleich zu behandeln: Welcher der beiden eintritt, ist eine
Betriebseinstellung und kein Unterschied, der die betroffene Person etwas angeht.
Sie will wissen, wie sie hineinkommt. Und der Fehlertext des ersten Falls sagt
ausgerechnet das, was der Aufzählungsschutz des zweiten sorgfältig vermeidet.

Der Hinweis SHALL **zum Anfordern eines Zugangslinks** führen und daneben zur
Anmeldung. Er SHALL NOT „Passwort zurücksetzen" als ersten Weg anbieten: Die
betroffene Gruppe sind ganz überwiegend **importierte, noch nicht aktivierte**
Mitglieder, die den naheliegenden Knopf „Registrieren" statt „Aktivieren"
wählen. Sie haben kein Passwort, das sich zurücksetzen ließe — eine Oberfläche,
die ihnen das anbietet, verspricht etwas anderes, als sie braucht.

Der Hinweis SHALL **keinen Grund nennen**: Er SHALL nicht aussagen, ob die
Adresse vergeben ist. Die Oberfläche kann diese Aussage auch gar nicht treffen —
der Anmeldedienst nennt ihr den Grund nicht, und sie SHALL NOT nach ihm fragen.

**Was diese Anforderung ausdrücklich NICHT zusagt.** Sie macht die beiden
Ausgänge nicht von außen ununterscheidbar. Eine unbekannte Adresse erzeugt eine
Sitzung und löst die Seite ab; eine bekannte bleibt auf ihr stehen. Sie
**verbessert** die Lage allerdings gegenüber heute: Der rohe Satz „User already
registered" verschwindet, und damit die einzige Stelle, an der die Oberfläche die
Existenz eines Kontos ausdrücklich behauptet hat. Dieser
Unterschied ist heute schon beobachtbar und folgt daraus, dass die eingebaute
E-Mail-Bestätigung ausgeschaltet ist — ihn zu schließen hieße, den ganzen
Registrierungsverlauf umzubauen. Der Hinweis fügt **keinen neuen** Beobachtungsweg
hinzu; er ersetzt einen Knopf, der wortlos nichts tut, durch einen, der etwas
sagt.

Der Grund für die Anforderung ist die Bauart der Seite: Erfolg wird durch die
entstehende Sitzung angezeigt, die die Seite ablöst; ein Fehler durch die
Fehlermeldung. Fehlen beide, bleibt **kein** Zweig, der etwas sagt.

#### Scenario: Registrierung ohne Fehler und ohne Sitzung

- **WHEN** eine Registrierung ohne Fehler zurückkommt, aber keine Sitzung entsteht
- **THEN** erscheint ein sichtbarer Hinweis, der zum Anfordern eines Zugangslinks
  und zur Anmeldung führt

#### Scenario: Registrierung mit `user_already_exists`

- **WHEN** eine Registrierung mit dem Code `user_already_exists` fehlschlägt
- **THEN** erscheint **derselbe** Hinweis, und der rohe Fehlertext des
  Anmeldedienstes erscheint nirgends

#### Scenario: Jeder andere Fehler bleibt sichtbar

- **WHEN** eine Registrierung mit einem anderen Fehler fehlschlägt
- **THEN** wird dessen Meldung angezeigt und NICHT durch den Hinweis ersetzt

#### Scenario: Der Hinweis nennt keinen Grund

- **WHEN** dieser Hinweis erscheint
- **THEN** sagt sein Text nicht aus, ob die Adresse bereits vergeben ist

#### Scenario: Mit Sitzung bleibt es beim bisherigen Verlauf

- **WHEN** eine Registrierung eine Sitzung herstellt
- **THEN** erscheint dieser Hinweis NICHT, und der Verlauf führt wie bisher auf
  den Aktivierungsbildschirm

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

