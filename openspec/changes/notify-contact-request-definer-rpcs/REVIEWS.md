# Plan-Review — notify-contact-request auf DEFINER-RPC (AGE-623)

Schritt 2b des Workflows: adversariale Review des Plans **vor** der ersten
Codezeile. Zwei Reviewer anderer Anbieter, beide mit Zugriff auf das Repository.

| Reviewer | Anbieter | Stand |
| --- | --- | --- |
| gemini | Google | abgeschlossen |
| opencode (`hf:moonshotai/Kimi-K3`) | Moonshot über opencode | siehe unten |

## gemini

### HIGH — Proposal und Tasks widersprachen sich über den lokalen Stack

> `proposal.md` (Korrektur-Block) hält fest, dass der `service_role`-Lesezugriff
> lokal **funktioniert**. `tasks.md` (1.3, 5.1) verlangt den Nachweis, dass er
> **fehlschlägt**. Einer der beiden ist falsch; der Testplan steht damit auf
> einer unklaren Grundlage.

**Berechtigt, übernommen.** Der Widerspruch war echt und meiner: `tasks.md`
entstand vor der Messung, korrigiert wurde danach nur das Proposal. Aufgabe 1.3
verlangt jetzt die Erhebung der **Rechteherkunft** statt eines erwarteten
Fehlschlags, und Aufgabe 5.1 sagt ausdrücklich, dass der Umbau
**verhaltensgleich** ist und es kein Rot gibt, das grün werden könnte. Die
Positivkontrolle hängt damit nicht mehr an einem Fehlschlag, den es nicht gibt,
sondern am `execute`-Recht (5.2).

### MEDIUM — fehlende Zusage für fehlende Adresse und entfernte Beteiligte

> Die neue RPC muss zusichern, dass sie [bei fehlender Mailadresse] ebenfalls
> `null` oder 0 Zeilen zurückgibt und keine sensiblen Daten preisgibt.

**Zur Hälfte übernommen, zur Hälfte begründet abgelehnt.**

*Übernommen:* Der Fall „Anfrage gültig, aber keine Zustelladresse hinterlegt"
braucht eine eigene Zusage — aber mit dem **umgekehrten** Ergebnis, als der
Befund vorschlägt. Gäbe die RPC hier null Zeilen zurück, wäre eine fehlende
Adresse von einer verletzten Bindung nicht mehr unterscheidbar, und der heutige
`200 skipped: no_email` würde still zu `409` oder `502`. Das Delta trägt jetzt
das Szenario „Eine fehlende Zustelladresse ist von einer verletzten Bindung
unterscheidbar": **eine** Zeile mit leerer Adresse.

*Abgelehnt:* Den Lebenszyklus der Beteiligten (`disabled_at`/`deleted_at`) nimmt
dieser Change nicht mit. Er prüft ihn heute nicht, und ihn hier einzuführen wäre
eine Verhaltensänderung in einem Umbau, der ausdrücklich verhaltensgleich sein
soll. Im Proposal als eigener Vorgang benannt statt still ausgelassen. Der harte
Löschfall kann ohnehin nicht eintreten: beide Fremdschlüssel von
`contact_requests` stehen auf `ON DELETE CASCADE` (am 27.08. am Katalog
gemessen).

### LOW — pgTAP hänge nicht in der CI

> `tasks.md` sieht keine Aufgabe vor, die `pgTAP`-Tests in den automatischen
> CI-Lauf einzubinden.

**Widerlegt am Repository.** `.github/workflows/ci.yml:149` ruft
`supabase test db` im `migrations`-Job, gegen eine frisch aufgesetzte Abbildung
(`ci.yml:115`). Neue `*_test.sql` laufen dort ohne Zutun mit. Keine Änderung.

## opencode (`hf:moonshotai/Kimi-K3`)

Der schärfere der beiden Läufe. Vier HIGH, drei MEDIUM, vier LOW.

### HIGH — derselbe Widerspruch wie bei gemini

Unabhängig gefunden, dieselbe Stelle. Bereits behoben, siehe oben.

### HIGH — Faktenwiderspruch quer durch zwei Changes

> `20260827070000_entzuege_nennen_alle_rollen.sql:26-30` (AGE-622) sagt: lokal
> ist die *strenge* Sorte (0/36 Tabellen). `proposal.md` sagt das Gegenteil.
> Beides kann nicht stimmen.

**Der wertvollste Befund des Laufs. Aufgelöst durch Messung.** Heute misst
derselbe Stack **35 von 36** Tabellen. Beide Messungen waren zu ihrer Zeit
richtig — ausgetauscht wurde der **Datenträger**, was der Kopf jener Migration
selbst vorhersagt („sein Datenträger stammt aus einer älteren Abbildung"). Mit
der in AGE-622 gepinnten, PROD-ähnlicheren Abbildung ist der lokale Stack nun
die großzügige Sorte.

Die Gegenprobe macht es rund: die **eine** Tabelle ohne `service_role`-Recht ist
`staff_roles` — genau die, für die eine Migration den Entzug ausspricht.
Instanzseitig erteilt heisst also *überall, ausser wo jemand widerspricht*, und
das ist ein stärkerer Beleg für den Change als die ursprüngliche Behauptung.

### HIGH — die PROD-Behauptung misst das Falsche

> AGE-622 stützt sich auf eine `proacl`-Messung (**Funktions**rechte), nicht auf
> `relacl` (**Tabellen**rechte). Ob der Mailweg auf PROD heute funktioniert, ist
> nach wie vor ungemessen.

**Berechtigt und wichtig.** Die bereitliegende Sonde misst `has_table_privilege`
und damit die richtige Sache. Sie ist deshalb keine Kür: sie entscheidet, ob
dieser Change Vorsorge ist oder ein Fix für einen seit je toten Mailweg. Bis ihr
Ergebnis vorliegt, wird keine der beiden Lesarten behauptet.

### HIGH — fehlender NULL-Kontrakt der RPC

> Die naheliegende Implementierung (JOIN statt LEFT JOIN) macht aus „keine
> Adresse hinterlegt" eine leere Menge → 409 `record_mismatch`.

**Übernommen, deckungsgleich mit gemini** — und um den fehlenden Anzeigenamen
erweitert. Delta und Aufgabenliste schreiben `left join` jetzt ausdrücklich vor,
mit je einer eigenen Zusage.

### MEDIUM — die Bindung ist reihenfolge-ambig

> Empfänger und Gegenüber tauschen je nach Ereignis die Rollen (`emails.ts:53`
> gegen `:61,64`). Ein geordnetes Prädikat bricht jede accepted/declined-Mail;
> ein zu loses lässt den Geheimnisinhaber die Adresse *beider* Beteiligten
> ziehen.

**Der beste Entwurfsbefund der Review, übernommen.** Die Bindung gilt
**mengenweise** — `{p_recipient_id, p_other_id} = {from_id, to_id}` —, und die
gelieferte Adresse gehört der als *Empfänger* übergebenen Kennung. Beides steht
jetzt als eigenes Szenario im Delta und als eigene Aufgabe. Ohne diesen Befund
wäre die erste Implementierung mit hoher Wahrscheinlichkeit geordnet ausgefallen
und hätte still jede Zusage- und Absage-Mail verworfen.

### MEDIUM — „genau eine Function" war unbelegt

**Übernommen.** Der Reviewer hat den Beleg selbst erhoben; das Proposal zitiert
ihn nun für alle acht Functions: `stripe-webhook:45`, `send-activation:119`,
`redeem-activation:78-82`, `resend-activation:99,159` rufen ausschliesslich
`.rpc()`.

### MEDIUM — der neue Grundsatz hat keinen Vollzug

> Das Delta erklärt jeden direkten `service_role`-Tabellenzugriff zum Befund,
> ohne dass eine Zusage ihn misst.

**Anerkannt, nicht in diesem Change gelöst.** Eine mechanische Prüfung über
`supabase/functions` gehört zum flächendeckenden Entzug, der hier ausdrücklich
nicht mitgenommen wird — ein Wächter ohne den Entzug, den er bewachen soll, wäre
die Reihenfolge verkehrt herum. Er wird mit dem Folgevorgang geführt.

### LOW

- **Zuschnitt bestätigt:** „kein Einwand — der Zwischenzustand ist strikt nicht
  schlechter als heute". Die Begründung steht jetzt als Messgröße im Proposal.
- **Spec-Delta vollständig geprüft:** „alle zehn Bestandsszenarien der
  Anforderung sind übernommen, zwei neu, … nichts fällt still." Das ist die
  unabhängige Bestätigung gegen die Falle, an der das Archivieren sonst bricht.
- **502-Semantik** und **Zeilenangabe `101-112` → `91-94`**: beide übernommen.
