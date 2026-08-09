## Why

Linear: **AGE-507** (Befunde 8.8 und 8.9 aus Review 5.4 zum AGE-505-Diff, dort
ausdrücklich als eigener Change erfasst).

Das 24-Stunden-Schutzfenster verspricht: liegt ein noch gültiger, unbenutzter
Link im Postfach, wird er **nicht** entwertet. Unter Nebenläufigkeit hält das
Versprechen nicht. Beide Aufrufe passieren die Schutzfenster-Abfrage, solange
keiner von beiden geschrieben hat; läuft der zweite `update … set
invalidated_at` **nach** dem Commit des ersten, sieht er unter `read committed`
einen frischen Snapshot, entwertet das soeben angelegte Token und legt sein
eigenes an. Zwei Mails, nur der zweite Link gilt.

Das Delta von `member-activation-flow` benennt dieses Prinzip bereits — für die
Einmaligkeit: sie SHALL NOT „allein auf einer vorangehenden Abfrage beruhen:
zwei gleichzeitige Anforderungen kämen sonst beide durch". Genau darauf beruht
das Schutzfenster heute.

**Vorbestehend seit AGE-495.** Der `update`-dann-`insert`-Pfad steht seitdem
unverändert; der 8.1-Fix aus AGE-505 berührt ihn nicht. AGE-505 kann den Befund
auch nicht tragen — seine eigene Beschreibung sagt
„`request_own_activation_token` bleibt unangetastet", und genau die fasst dieser
Change an.

## What Changes

- **Beide ausgebenden RPCs sperren die Profilzeile, bevor sie prüfen** —
  `select … for update of p` an der ersten Abfrage von
  `issue_activation_token` (gültige Fassung: `20260808150000`) und
  `request_own_activation_token` (gültige Fassung: die Erstdeklaration
  `20260806090000`, seither nie neu deklariert). Damit steht die Prüfung nicht
  mehr auf einem Snapshot, der zwischen Prüfung und Schreiben veraltet.
- **Nur `profiles` wird gesperrt, nicht die mitgejointe `auth.users`-Zeile.**
  Schreibweise und Präzedenzfall stehen im Repo: `20260716120000_stripe_upgrade.sql:29`
  serialisiert nebenläufige Upgrades desselben Nutzers auf demselben Join-Muster.
- **Beide Wege sperren in derselben Reihenfolge** — erst `profiles`, dann
  `activation_tokens`. Deadlockfrei per Konstruktion, und das gehört in den
  Migrationskopf, nicht in jemandes Gedächtnis.
- **Der `23505`-Zweig aus 8.1 bleibt.** Die Sperre macht ihn zum Gürtel neben
  den Hosenträgern, ersetzt ihn nicht: er deckt weiterhin ab, was an den RPCs
  vorbei einfügt.
- **`request_own_activation_token` bekommt kein Schutzfenster** — nur die
  Sperre. Das Fenster fehlt dort mit Absicht: Subjekt ist die Sitzung, „schick
  mir einen neuen Link" soll wirken. Die Sperre behebt dort etwas anderes: zwei
  gleichzeitige eigene Anfragen können heute eine **rohe** `unique_violation`
  auslösen — die Function hat, anders als ihre Schwester, keinen Handler —, die
  `resend-activation` als 5xx durchreicht.
- **Eine Sonde belegt den Wettlauf deterministisch** (8.9), im Muster von
  `scripts/probe-activation-gate.ts`, mit einem Unterschied: sie verweigert
  jedes Ziel außer `127.0.0.1`.

**Keine** neue Tabelle, **keine** neue Spalte, **keine** neue Function. Zwei
Neudeklarationen.

### Verworfene Alternativen

- **`serializable` für diese Transaktionen.** Verschiebt den Fehler nur: der
  Verlierer bekommt `40001` und damit wieder einen Fehler, wo `pending` die
  richtige Antwort ist — und die Wiederholung müsste in `send-activation`
  gebaut werden, das absichtlich immer `202` antwortet.
- **Das Schutzfenster in `request_own_activation_token` nachziehen.** Wäre eine
  Verhaltensänderung des Hauptwegs, die niemand verlangt hat: das angemeldete
  Mitglied darf sich einen neuen Link schicken lassen.
- **Den `23505`-Zweig durch die Sperre ersetzen.** Er deckt einen anderen Fall
  ab — Einfügen an den RPCs vorbei. Ihn zu entfernen tauschte einen bewiesenen
  Schutz gegen einen neuen.
- **`dblink` installieren, um den Wettlauf in pgTAP nachzustellen.** Eine
  Extension, die beliebige ausgehende Verbindungen öffnen kann, landete damit
  für einen Test dauerhaft in PROD.

## Capabilities

### New Capabilities

Keine.

### Modified Capabilities

- `access-control`: **ADDED** — ein Requirement, das die Grenzen der
  Token-Ausgabe auch unter Nebenläufigkeit verlangt und dafür eine Sperre statt
  einer bloßen vorangehenden Abfrage fordert.

**Zugesagt ist die Wirkung, nicht der Statuswert.** Der erste Entwurf behauptete,
der Verlierer antworte mit dem Status des Schutzfensters. Das ist falsch, und
Codex hat es in Stufe 2b gefunden: nach dem Commit der Gewinnerin ist deren
Token Sekunden alt, also greift die **Sperrfrist** — die erste Prüfung nach dem
Profil-Lesen —, und Schutzfenster wie Tageskontingent werden gar nicht erreicht.
Der tragende Satz lautet deshalb: die Sperre macht alle drei Grenzen ehrlich,
und die erste, die den Verlierer fängt, ist die Sperrfrist. Nichts entwertet,
nichts ausgegeben — das ist die Zusage. Siehe `REVIEWS.md`.

**Warum ADDED und nicht MODIFIED:** das Schutzfenster selbst steht heute
**nicht** in `openspec/specs/access-control/spec.md`, sondern vollständig im
offenen Delta von `member-activation-flow` („Der Weg zur Aktivierung setzt keine
Anmeldung voraus"). Ein `MODIFIED`-Delta hätte nichts, worauf es zeigen könnte —
dieselbe Lage, die `password-reset-flow` schon einmal beschrieben hat. Das neue
Requirement steht deshalb für sich und benennt den nebenläufigen Fall, den das
bestehende Szenario („Zwei gleichzeitige Anforderungen erzeugen nicht zwei
gültige Links") **nicht** abdeckt: dort bleibt höchstens ein Token ausstehend —
was auch im Fehlerfall zutrifft, weil das frische Token ja entwertet wurde.

## Impact

**Datenbank** — eine neue Migration, die `public.issue_activation_token(text,
text, interval)` und `public.request_own_activation_token(text, interval)` neu
deklariert. Grants, Signaturen, Statuswerte, Grenzwerte und Zweigreihenfolge
bleiben unverändert.

**Tests** — `supabase/tests/rls_test.sql` (eine strukturelle Zeile je Function,
plan 182 → 184) und eine neue Sonde unter `scripts/`.

**Nicht betroffen** — `claim_activation_token`, `redeem-activation`,
`send-activation`, `resend-activation`, Grants, RLS-Policies, die 202-Bauart
gegen Adressaufzählung, das Frontend, die CI-Konfiguration.

**Benannte Folge der Sperre** — eine Token-Anforderung serialisiert sich künftig
gegen andere Schreiber derselben Profilzeile, insbesondere gegen
`apply_tier_upgrade` (Stripe). Beide sind kurz und selten; die Wartezeit ist die
Dauer eines Funktionsaufrufs. Eine wechselseitige Blockade **zwischen diesen
beiden RPCs** ist ausgeschlossen, weil beide `profiles` vor `activation_tokens`
sperren — was dieser Change herstellt und die Migration begründet. Weiter reicht
die Aussage nicht: ein künftiger Schreiber, der erst eine Token-Zeile und dann
dasselbe Profil sperrt, hätte die umgekehrte Reihenfolge. Heute gibt es keinen;
die Pflicht steht deshalb im Spec-Delta und nicht nur hier.

**Benannte Folge der Entscheidung gegen einen CI-Schritt** (Donald,
2026-08-08): ohne Lauf in der Pipeline hält niemand die Sperre fest. Wer die
RPCs später neu deklariert und `for update of p` vergisst, bekommt nichts Rotes.
Gegengewicht ist die strukturelle pgTAP-Zeile oben — sie belegt **nicht** das
Verhalten (das tut die Sonde, einmal, gemessen), sondern nur, dass die Zeile
nicht wieder verschwindet. Dass das schwächer ist als ein Lauf, steht hier,
damit die Prüfer der Stufe 2b darüber urteilen können statt es zu entdecken.
