## Context

Zwei Functions geben Aktivierungs-/Reset-Token aus. Beide haben denselben Bau:
Profil lesen → Grenzen prüfen → altes Token entwerten → neues einfügen.

| Function                       | gültige Fassung  | Weg                                                  | Schutzfenster         | `23505`-Handler |
| ------------------------------ | ---------------- | ---------------------------------------------------- | --------------------- | --------------- |
| `issue_activation_token`       | `20260808150000` | sitzungsfrei (`/aktivierung`, `/passwort-vergessen`) | ja, 24 h              | ja (aus 8.1)    |
| `request_own_activation_token` | `20260806090000` | angemeldet (Aktivierungsbildschirm)                  | **nein**, absichtlich | **nein**        |

Unter `read committed` bekommt **jede** Anweisung einen frischen Snapshot — auch
jede Anweisung _innerhalb_ einer plpgsql-Function. Zwischen den Prüfungen und
dem `update` liegt deshalb ein Fenster, in dem ein anderer Aufruf sein Token
committen kann. Das `update` sieht es dann und entwertet es.

Die Einmaligkeit je Profil ist gegen diesen Fall bereits abgesichert — durch den
partiellen Unique-Index `activation_tokens_offen_je_profil`, also durch eine
Bedingung der Datenbank statt durch eine vorangehende Abfrage. Die Grenzen
können diesen Weg nicht gehen: Sie verlangen **nichts zu tun**, und „nichts tun"
lässt sich nicht als Constraint schreiben.

### Zwei Dinge, die am 2026-08-08 gemessen wurden, nachdem der erste Entwurf sie falsch angenommen hatte

**Erstens: eine wartende Anweisung sieht nicht, was während des Wartens
committet wurde.** Gegen den lokalen Stack an einer eigenen Wegwerf-Tabelle: X
sperrt Zeile 0; B und A blockieren beide mit `update … where offen`; X gibt
frei; B ändert Zeile 0, fügt Zeile 1 ein und committet.

```
A's update hat Zeilen beruehrt: []
Endzustand: [{"id":0,"offen":false},{"id":1,"offen":true}]
```

A hat Zeile 1 **nicht** angefasst. Der Snapshot einer Anweisung steht bei ihrem
Start fest; EPQ prüft danach nur Zeilen nach, die der Scan bereits gefunden hat,
und nimmt keine neuen auf. Daraus folgt: **die 8.8-Reihenfolge ist von außen
nicht herstellbar.** Zwischen der letzten Prüfung und dem `update` liegt keine
Anweisung, die blockieren könnte — der Riegel muss _in_ die Function.

**Zweitens: welche Grenze den Verlierer fängt.** Nach dem Commit der Gewinnerin
ist deren Token Sekunden alt. Die Grenzabfrage der Verliererin — die **erste**
Prüfung nach dem Profil-Lesen — sieht es und antwortet mit der **Sperrfrist**.
Schutzfenster und Tageskontingent werden gar nicht erreicht.

Der Satz, der diesen Change beschreibt, lautet deshalb nicht „das Schutzfenster
hält", sondern: **die Sperre macht alle drei Grenzen ehrlich, und die erste, die
den Verlierer fängt, ist die Sperrfrist.** Die Wirkung ist dieselbe — nichts
entwertet, nichts ausgegeben —, aber der Status ist ein anderer, als der erste
Entwurf behauptet hat.

## Goals / Non-Goals

**Goals:**

- Die Grenzen der Token-Ausgabe halten auch, wenn zwei Anforderungen für
  dasselbe Profil gleichzeitig laufen — über beide Wege hinweg.
- Der Wettlauf ist **deterministisch** belegt, RED vor GREEN, ohne Timing.
- `request_own_activation_token` reicht keine rohe `unique_violation` mehr an
  `resend-activation` durch.

**Non-Goals:**

- Kein Schutzfenster für den authentifizierten Weg.
- Keine Änderung an Signaturen, Statuswerten, Grenzwerten, Zweigreihenfolge,
  Grants oder am Verhalten von `send-activation` / `resend-activation`.
- Kein Ersatz für den `23505`-Zweig aus 8.1.
- Kein neuer CI-Schritt (Entscheidung Donald, 2026-08-08, nach den Review-
  Befunden bestätigt).

## Decisions

### 1. Zeilensperre auf `profiles`, nicht auf `activation_tokens`

`select … for update of p` an der **ersten** Abfrage beider Functions. Die
Profilzeile ist das einzige, was beide Wege garantiert und als Erstes anfassen —
und sie existiert immer, während die Token-Zeilen genau im interessanten Fall
fehlen.

Verworfen: **Sperre auf den Token-Zeilen.** Der Fall, den wir schützen wollen,
ist „es gibt noch kein Token" — dort ist keine Zeile zu sperren.

Verworfen: **Advisory Lock auf `hashtext(profile_id)`.** Funktioniert, aber
kollidiert projektweit über einen Schlüsselraum, den niemand verwaltet, und ist
an keiner Transaktion sichtbar. Die Zeilensperre ist im Repo etabliert.
(Innerhalb der **Sonde** wird ein Advisory Lock trotzdem benutzt — siehe 5;
dort ist er Messwerkzeug, nicht Schutzmechanismus.)

Verworfen: **`serializable`.** Der Verlierer bekäme `40001` — wieder ein Fehler,
wo eine Grenze die richtige Antwort ist —, und die Wiederholung müsste in
`send-activation` gebaut werden, das absichtlich immer `202` antwortet.

### 2. `of p`, nicht bloß `for update`

Beide Abfragen joinen `public.profiles p` auf `auth.users u`. Ein nacktes
`for update` sperrte **beide** Zeilen, also auch die Zeile in `auth.users` — die
gehört der Auth-Plattform, und ihre Schreiber sind uns unbekannt. `of p`
beschränkt die Sperre auf das, was wir verantworten.

Präzedenzfall im Repo: `20260716120000_stripe_upgrade.sql:29` sperrt mit
`for update of p` auf demselben Join-Muster, um nebenläufige Upgrades desselben
Nutzers zu serialisieren.

### 3. Beide Wege sperren `profiles` vor `activation_tokens`

Die Reihenfolge ist die Freiheit von wechselseitiger Blockade. Sie ergibt sich
hier von selbst — die Profil-Abfrage steht am Anfang, das `update` am Ende —,
aber nur so lange, wie niemand sie umstellt. Deshalb steht sie im Migrationskopf.

**Die Aussage gilt zwischen diesen beiden RPCs, nicht global.** Eine
Transaktion, die zuerst eine Token-Zeile sperrt und danach dieselbe Profilzeile
ändert, hätte die umgekehrte Reihenfolge. Heute gibt es sie nicht; die Pflicht
für künftige Schreiber steht im Spec-Delta, damit sie nicht nur hier steht.

### 4. Der `23505`-Zweig bleibt

Er deckt einen anderen Fall ab: ein Einfügen, das an den ausgebenden Functions
vorbeigeht und die Sperre deshalb nie sieht. Ihn jetzt zu entfernen tauschte
einen belegten Schutz gegen einen neuen, am selben Tag, an dem der neue zum
ersten Mal läuft.

### 5. Der Beleg: ein Riegel an der Naht, in einer zur Laufzeit erzeugten Kopie

Aus der ersten Messung im Kontext folgt, dass die Naht zwischen der letzten
Prüfung und dem `update` von außen nicht erreichbar ist. Ein Rendezvous über
eine Token-Zeile parkt den Aufruf zwar, aber **zu spät**: die wartende Anweisung
hat ihren Snapshot schon.

Die Sonde erzeugt deshalb zur Laufzeit eine Kopie der zu prüfenden Function:

1. `pg_get_functiondef(…)` der **echten** Function lesen.
2. Den Namen auf `zz_probe_…` umschreiben.
3. Unmittelbar **vor** dem `update public.activation_tokens` ein
   `perform pg_advisory_xact_lock(<schlüssel>);` einsetzen.
4. **Prüfen, dass Schritt 3 genau einmal gegriffen hat.** Sonst hat sich die
   Naht verschoben, und die Kopie misst etwas anderes als das Original — dann
   bricht die Sonde ab, statt eine Zahl zu liefern.

Ablauf, deterministisch und ohne `sleep`:

```
X: begin; select pg_advisory_xact_lock(K);        -- der Riegel steht

A: begin; select zz_probe_issue(P, hashA);        -- läuft durch ALLE Prüfungen,
                                                  -- parkt dann am Riegel
   (Blockade an pg_stat_activity belegen)

B: begin; select issue_activation_token(P, hashB);-- läuft ganz durch
B: commit                                         -- TB ist jetzt committet

X: rollback                                       -- Riegel fällt

A: läuft weiter — sein `update` beginnt JETZT und
   nimmt einen Snapshot, der TB enthält
```

|                              | ohne Sperre (RED)                     | mit `for update of p` (GREEN)               |
| ---------------------------- | ------------------------------------- | ------------------------------------------- |
| Wo A steht, wenn B committet | am Riegel, **hinter** allen Prüfungen | an der **Profilzeile**, vor allen Prüfungen |
| A's `update`                 | sieht TB, entwertet es                | — kommt nie dorthin                         |
| A's Rückgabe                 | `issued`                              | `rate_limited`                              |
| TB danach                    | **entwertet**                         | offen, unverändert                          |
| Für das Mitglied             | zwei Mails, der frische Link tot      | eine Mail, Link gilt                        |

Warum A im GREEN-Fall den Riegel nie erreicht: B nimmt die Profilsperre in
seiner ersten Anweisung und hält sie bis zum Commit. A blockiert deshalb an
seiner **ersten** Anweisung — vor jeder Prüfung, vor dem Riegel — und antwortet
danach an der Sperrfrist.

**Was die Kopie nicht ist:** sie ist nicht die ausgelieferte Function. Sie ist
deren Rumpf plus eine Zeile, zur Laufzeit aus der Datenbank gelesen statt aus
einer Datei kopiert, mit geprüfter Einfügestelle. Mehr Nähe zum Original ist
ohne eine Pause _in_ der ausgelieferten Function nicht zu haben — und die wäre
Testcode in PROD.

Die übrigen drei Szenarien brauchen **keine** Kopie; sie sind über eine
uncommittete Einfügung deterministisch, weil die Kollision am Index blockiert:

- **S2 (Wächter-Fall, 8.9):** eine zweite Verbindung fügt an den RPCs vorbei ein
  offenes Token ein und committet nicht; der echte RPC läuft durch, kollidiert
  am `insert`, blockiert, die zweite Verbindung committet → `23505` → der
  Handler antwortet `pending`. Das ist der Nachweis, den 8.9 vermisst hat, und
  er gilt vor wie nach dem Fix.
- **S3 (angemeldeter Weg):** B ruft auf und committet nicht; A kollidiert am
  `insert` und blockiert; B committet → heute eine rohe `unique_violation`, nach
  dem Fix `rate_limited` ohne Fehler.
- **S4 (gemischte Wege):** wie S3, aber je einmal anonym-gegen-angemeldet und
  umgekehrt, mit `pg_blocking_pids` als Beleg, dass A tatsächlich **von B**
  blockiert wird und nicht zufällig langsam war.

Verworfen: **`dblink` oder `pg_background` installieren.** Beide fehlen hier,
und `dblink` kann beliebige ausgehende Verbindungen öffnen — das für einen Test
dauerhaft in PROD zu haben, ist teurer als der Befund.

### 6. Die Sonde bleibt manuell, mit einem Wächter, der die POSITION prüft

Entscheidung Donald, nach den Review-Befunden bestätigt: kein neuer CI-Schritt.
Der `migrations`-Job kennt heute nur die Supabase-CLI; für `tsx` bräuchte er
zusätzlich `setup-node` und `pnpm install`.

Beide Prüfer haben das als HIGH markiert, und ihr konkreter Einwand — eine
Sperre an der falschen Stelle bliebe unbemerkt — ist berechtigt. Der Wächter in
`rls_test.sql` prüft deshalb nicht mehr nur das **Vorkommen** von
`for update of p`, sondern dass es **vor** dem ersten Zugriff auf
`activation_tokens` steht, gemessen an einer von `--`-Kommentaren befreiten
Fassung von `pg_get_functiondef` (sonst täuscht ein Kommentar die Reihenfolge
vor).

Was der Wächter weiterhin **nicht** kann: eine Verhaltensregression bemerken.
Er liest Text. Das Verhalten belegt die Sonde, einmal, zum Zeitpunkt des Baus.
Das steht hier, damit es nicht später als Überraschung auftaucht.

Die Sonde selbst verweigert jedes Ziel außer `127.0.0.1`. Die Vorlage
(`scripts/probe-activation-gate.ts`) lässt DEV zu; das ist hier falsch, weil die
Sonde schreibt — und weil sie eine `zz_probe_…`-Function anlegt, die in keiner
gemeinsam genutzten Datenbank etwas zu suchen hat.

## Risks / Trade-offs

- **Die Sperre serialisiert gegen andere Schreiber derselben Profilzeile**,
  insbesondere `apply_tier_upgrade` (Stripe-Webhook) und das Speichern des
  eigenen Profils → beide sind kurz und selten; die Wartezeit ist die Dauer
  eines Funktionsaufrufs. Kein Nutzer wartet auf einen anderen Nutzer.
- **Wechselseitige Blockade mit einem künftigen Schreiber**, der erst eine
  Token-Zeile und dann das Profil sperrt → heute existiert keiner; die Pflicht
  zur Reihenfolge steht im Spec-Delta und im Migrationskopf, nicht nur hier.
- **`for update` prüft die `where`-Bedingung nach der Sperre erneut** (EPQ):
  Fällt die Profilzeile dabei aus dem Ergebnis, antwortet der Aufruf `unknown` →
  das Prädikat liest die Adresse aus `auth.users`, nicht aus `profiles`; ein
  Profil-Update ändert die Trefferlage also nicht. Für
  `request_own_activation_token` ist das Prädikat `p.id = auth.uid()` und damit
  unveränderlich.
- **Die Sonde misst eine Kopie, nicht das Original** → die Kopie wird zur
  Laufzeit aus `pg_get_functiondef` erzeugt und die Einfügestelle auf „genau
  einmal" geprüft; schlägt das fehl, bricht die Sonde ab. Die anderen drei
  Szenarien laufen ohnehin gegen das Original.
- **Kein CI-Lauf** → benannte, bestätigte Entscheidung. Der Wächter fängt die
  verschobene Sperre, nicht die verhaltensmäßige Regression. Siehe `REVIEWS.md`.
- **Der Wettlauf bleibt für Schreibvorgänge offen, die an beiden Functions
  vorbeigehen** → dagegen steht weiterhin der partielle Unique-Index; genau
  deshalb bleibt der `23505`-Zweig.

## Migration Plan

Eine neue Migration, forward-only, die beide Functions vollständig neu
deklariert — Postgres kennt keine partielle Änderung. Gegen die jeweilige
Vorfassung ist **ausschließlich** die `for update of p`-Zeile geändert; das
gehört am kommentarfreien Rumpf-Diff nachgemessen und im Kopf behauptet, nicht
umgekehrt.

Ausrollen in der Reihenfolge, die im Repo funktioniert: Merge → `migrate-dev`
läuft auf `main` → **`migrate-prod` von Hand**, sonst steht `drift-gate` auf
`failure` und überspringt `deploy` und `functions` stillschweigend mit.

**Rollback**: die Vorfassungen stehen unverändert in `20260808150000` und
`20260806090000`; eine Gegenmigration wäre deren Rumpf ohne die Sperrzeile. Kein
Datenverlust möglich — die Migration ändert keine Zeile, nur zwei
Funktionsdefinitionen.

## Open Questions

Keine offen. Drei Entscheidungen haben den Zuschnitt bestimmt, alle am
2026-08-08 von Donald: Beleg über einen Riegel statt über Timing; Sonde ohne
CI-Schritt (nach den Review-Befunden bestätigt); kein Schutzfenster für den
angemeldeten Weg.
