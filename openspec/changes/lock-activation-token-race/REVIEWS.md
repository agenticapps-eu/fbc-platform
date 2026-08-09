---
reviewers: [gemini, codex]
models: [gemini-cli-0.28.2-modell-nicht-ausgegeben, gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: 6fa4b250d2c7ffedb1ccead3fc6b33a991ad736d8b61c4429354746f501791ff
---

# Change review — lock-activation-token-race

Geprüft wurde der Stand **vor** den Korrekturen unten; die SHA im Kopf ist die
des vorgelegten Prompts, nicht die der jetzigen Dateien. Beide Prüfer sind
Anbieter, die diesen Change nicht geschrieben haben — der `claude`-Arm wurde
nicht aufgerufen.

**Zur Modellangabe:** Codex nennt sein Modell selbst (`gpt-5.6-sol`, provider
`openai`). Der Gemini-Arm gibt keine Modellzeile aus; festgehalten ist deshalb
die CLI-Version. Das ist schwächer als Regel 4 verlangt, und es steht hier,
statt als Modellname erfunden zu werden.

## Reviewer: codex (gpt-5.6-sol)

VERDICT: REQUEST-CHANGES

- **[HIGH]** `design.md §5`, `tasks.md 1.4/2.1` — Der Wettlauf ist real, aber S1
  stellt ihn nicht nach. A's `update` nimmt seinen Snapshot beim Statement-Start,
  also während X noch T0 hält und bevor B TB einfügt. Auf der Zeilensperre zu
  warten lässt es TB nicht entdecken. A verfehlt TB, kollidiert am `insert` und
  landet im vorhandenen `23505 → pending`-Zweig. **Der behauptete RED wäre schon
  grün.**
- **[HIGH]** `design.md §5`, `tasks.md 1.4/1.6/4.1`, Spec-Delta 1. Szenario — Die
  GREEN-Erwartungen widersprechen der unveränderten Zweigreihenfolge. Nachdem A
  die Profilsperre bekommt und B committet hat, ist TB Sekunden alt: beide
  Functions antworten `rate_limited`, **bevor** sie Schutzfenster oder
  Token-Ersetzung erreichen. S1 kann nicht `pending` liefern und S3 nicht
  `issued`.
- **[MEDIUM]** Spec-Delta „Der Schutz gilt auch zwischen den beiden Wegen",
  `tasks.md §§1–4` — Kein Szenario lässt einen anonymen gegen einen
  authentifizierten RPC laufen. S1 und S3 prüfen jede Function nur gegen sich
  selbst; dass die beiden auf **derselben** Sperre koordinieren, belegt nichts.
- **[MEDIUM]** Spec-Delta, „nur eine Mail wird versendet, und deren Link gilt" —
  stärker als eine SQL-Sonde belegen kann. Der Versand liegt hinter dem Commit
  bei einem externen Anbieter.
- **[MEDIUM]** `design.md §6`, `tasks.md §5` — Der einzige automatisierte
  Wächter ist absichtlich grün, wenn `for update of p` an der falschen Stelle
  steht.
- **[LOW]** `tasks.md 3.5` — Die Grants-Begründung stimmt nicht.
  `create or replace function` behält das Funktionsobjekt samt Privilegien; es
  entsteht keine rechtelose neue Fassung.
- **[LOW]** Deadlock-Behauptung — „per Konstruktion" gilt nur zwischen diesen
  beiden RPCs. Eine Transaktion, die erst eine Token-Zeile sperrt und danach
  dasselbe Profil ändert, hat die umgekehrte Reihenfolge.

## Reviewer: gemini (gemini-cli 0.28.2)

VERDICT: REQUEST-CHANGES

- **[HIGH]** `design.md §6` — Die verhaltensprüfende Sonde läuft nicht in CI.
  Der strukturelle Wächter prüft Text, kein Verhalten, und bemerkt eine
  verschobene Sperre nicht. Die genannte Hürde (`setup-node` + `pnpm install`)
  sei Standardaufwand, kein Grund.
- **[LOW]** `tasks.md 3.4` — Der neue `comment on function`-Satz soll zum Stil
  der vorhandenen Kommentare passen und das **Warum** samt Sperr-Reihenfolge
  nennen.

## Nicht gezählt

Keine. Beide Arme liefen mit Exit 0 innerhalb der Zeitgrenze.

## Resolution

### Übernommen

**Codex HIGH 1 — und nachgemessen, nicht geglaubt.** Gegen den lokalen Stack an
einer eigenen Wegwerf-Tabelle gemessen: X sperrt Zeile 0, B und A blockieren mit
`update … where offen`, X gibt frei, B ändert Zeile 0 und fügt Zeile 1 ein und
committet:

```
A's update hat Zeilen beruehrt: []
Endzustand: [{"id":0,"offen":false},{"id":1,"offen":true}]
```

A hat die nachträglich eingefügte Zeile **nicht** angefasst. Der Befund trifft
zu; das Rendezvous über T0 hätte einen grünen RED erzeugt.

**Folge für den Aufbau:** Die Naht zwischen Schutzfenster-Abfrage und `update`
ist von außen nicht erreichbar — dazwischen liegt keine Anweisung, die
blockieren kann. Der Riegel muss deshalb _in_ die Function. Die Sonde erzeugt
zur Laufzeit eine Kopie aus `pg_get_functiondef` und setzt genau an dieser Naht
ein `pg_advisory_xact_lock` ein; die Einfügung wird auf „genau einmal getroffen"
geprüft, sonst misst die Kopie etwas anderes als das Original. `design.md §5` und
`tasks.md §1/§2` sind entsprechend neu geschrieben.

**Codex HIGH 2.** Trifft ebenso. Nach B's Commit ist TB Sekunden alt, also greift
die 60-Sekunden-Sperre, lange bevor das Schutzfenster geprüft wird. Der ehrliche
Satz ist damit: **die Sperre macht alle drei Grenzen ehrlich, und die erste, die
den Verlierer fängt, ist die 60-Sekunden-Sperre.** Spec-Delta, Design und Tasks
erwarten jetzt `rate_limited` statt `pending` bzw. `issued`. Die Zweigreihenfolge
bleibt unverändert — sie ist nicht das Problem.

**Codex MEDIUM (gemischte Wege).** Neues Szenario S4 in beiden Gewinner-
Reihenfolgen, mit `pg_blocking_pids` als Beleg, dass A tatsächlich **von B**
blockiert wird.

**Codex MEDIUM (eine Mail).** Das Szenario behauptet nur noch, was die Datenbank
entscheidet: genau ein Aufruf antwortet mit einem ausgebenden Status. Was der
Mailanbieter danach tut, sagt es nicht mehr.

**Codex LOW (Grants).** Stimmt — `create or replace function` behält die
Privilegien. Die `revoke`/`grant`-Zeilen bleiben trotzdem, weil alle
Nachbarmigrationen sie führen und `grants_test.sql` das Ergebnis prüft; die
**Begründung** in `tasks.md 3.5` ist korrigiert.

**Codex LOW (Deadlock).** Die Behauptung ist auf die beiden RPCs eingegrenzt,
und die Pflicht für künftige Schreiber steht ausdrücklich dabei.

**Gemini LOW.** In `tasks.md 3.4` aufgenommen: Warum und Sperr-Reihenfolge im
`comment on function`, im Stil der Nachbarn.

### Nicht übernommen

**Codex MEDIUM (struktureller Wächter) und Gemini HIGH (Sonde in CI).** Beide
zeigen auf dieselbe Lücke, und beide haben inhaltlich recht.

Donald wurde nach diesen Befunden **erneut** gefragt — mit den Befunden im
Wortlaut und mit dem Hinweis, dass mein eigener Belegaufbau beim ersten Anlauf
falsch war — und hat „bleibt manuell" bestätigt. Das ist eine Entscheidung, keine
Auslassung.

Was stattdessen geschieht: die strukturelle Zeile prüft nicht mehr nur, **ob**
`for update of p` vorkommt, sondern dass es **vor** jedem Zugriff auf
`activation_tokens` steht — auf einer kommentarbefreiten Fassung von
`pg_get_functiondef`, damit ein Kommentar sie nicht täuscht. Damit fängt sie
Codex' konkreten Fall (Sperre unter die Prüfungen verschoben).

Was offen bleibt und hier steht, statt später entdeckt zu werden: **eine
Verhaltensregression fällt in CI weiterhin nicht auf.** Die Sonde belegt den Fix
einmal, zum Zeitpunkt des Baus. Wer den CI-Schritt später doch will, findet in
`design.md §6`, was er kostet.

---

## Stufe 4 — Review auf den Diff (`c913d88`), 2026-08-08

Zwei unabhängige Prüfer mit getrennten Linsen. Der Vollständigkeit halber: sie
liefen gleichzeitig gegen denselben lokalen Stack, was sich verfälscht hätte —
deshalb bekam einer den Stack zugewiesen und der andere las nur. Das ist im
Nachhinein eine Lehre über die Beauftragung, nicht über den Change.

### Prüfer 1 — SQL und Nebenläufigkeit: kein CRITICAL, kein HIGH

Kein Ablauf gefunden, in dem zwei Anforderungen beide durchkommen oder ein
frisches Token entwertet wird. Sperr-Reihenfolge gegen **alle** Schreiber beider
Tabellen geprüft, inklusive der vier getrennten PostgREST-Aufrufe in
`redeem-activation`, der BEFORE-ROW-Trigger auf `profiles` und der
`on delete cascade`-Richtung. Kein Deadlock heute.

Drei Befunde übernommen, jeder vor der Übernahme nachgeprüft: `apply_tier_upgrade`
existiert nicht (heißt `apply_upgrade`); `mark_activated` fehlte in der Liste der
Kollisionspartner, obwohl es bei jeder Einlösung dieselbe Zeile schreibt; und ein
Satz zu S2 war mechanisch falsch (`rate_limited` **ist** eine Prüfung, der Aufruf
wartet davor und entscheidet danach).

**Offen, im Migrationskopf als offener Punkt und nicht als Entwarnung:** aus dem
gemeinsamen Warten am Index wird eine Schlange. `send-activation` wartet auf den
RPC, bevor es 202 antwortet, und antwortet bei einem Fehler 502 — an einem
Endpunkt gegen Adressaufzählung ist das kein reines Latenzthema. Nicht gemessen;
der Aufbau, der es entschiede, steht im Kopf.

### Prüfer 2 — taugen die Belege: zwei HIGH auf die eigene Sonde

Der Befund, der zählt: mit `for update of p skip locked` findet **kein Wettlauf
statt** — B bekommt keine Zeile, antwortet `unknown`, wartet nie — und S1 meldete
trotzdem alle vier Behauptungen grün. S1 ist das Szenario, das Befund 8.8 trägt.
Dazu: „ehrliche Grenze" akzeptierte `unknown`; der pgTAP-Wächter ließ vier
Fassungen mit fehlender Sperre durch, darunter einen Blockkommentar — obwohl sein
eigener Kommentar die Kommentarbefreiung mit genau diesem Angriff begründete.

Eingearbeitet und mit denselben Gegenproben nachgemessen: unverändert 18/18 und
PASS; V1 12/18 / FAIL 148 149; V5 12/18 / FAIL 148; V6 und V7 je 14/18 / FAIL 148;
V8 14/18 / **PASS**.

**Was bewusst offen bleibt:** V8 — `if false then … for update of p; … end if;`.
Eine Sperre, die syntaktisch dasteht, aber nie ausgeführt wird, kann kein
Textvergleich sehen. Die Sonde fängt sie. Der Test sagt das jetzt selbst, statt
mehr zu beanspruchen, als er einlöst.
