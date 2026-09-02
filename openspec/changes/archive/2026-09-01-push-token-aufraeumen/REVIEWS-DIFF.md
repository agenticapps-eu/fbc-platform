# Diff-Review — push-token-aufraeumen (AGE-682)

Schritt 4 des Workflows: zwei Fremdvendoren lesen den **Diff**, nicht den Plan.
Grundlage waren die Commits `4576f13` (Planung) und `8fd1c80` (Umsetzung),
eingereicht als `git diff main...HEAD -- src supabase .github docs`.

| Reviewer | Modell | Verdikt |
| --- | --- | --- |
| gemini | nicht ausgewiesen | **APPROVE**, keine Mängel |
| codex | gpt-5.6-sol | **REQUEST-CHANGES**, 6 Befunde (2 MITTEL, 4 NIEDRIG) |

gemini nannte zwei unausgesprochene Annahmen, keine davon ein Mangel. codex'
Befunde stehen unten mit dem, was daraus geworden ist.

## Übernommen

### [MITTEL] Der Test belegte den RPC nicht — `push.lebenszeichen.test.ts`

Der Lauf prüfte, dass `register()` läuft, löste aber das
`registration`-Ereignis nie aus. Damit war `claim_push_token` unbeobachtet: ein
Diff, der genau diesen Aufruf entfernt, wäre grün geblieben — während
`letzter_kontakt` nie wieder steigt und der Aufräumer lebende Token löscht.
**Das ist der Befund, der den Vorgang hätte hohl machen können.**

Behoben: die Attrappe hält die Zuhörer jetzt fest, der Test löst das Ereignis
aus und prüft `claim_push_token` mit Token **und** Plattform. Belegt durch
Mutation E — den RPC durch `{ error: null }` ersetzt, die neue Zusage rötet,
danach `push.ts` byte-gleich zurückgesetzt.

### [NIEDRIG] `[user]` hängt an der Objektidentität — `AppShell.tsx`

Zutreffend und nachgemessen: `user` ist `session?.user`
(`AuthProvider.tsx:258`), die Identität wechselt also auch bei jeder
Token-Erneuerung. Die Abhängigkeit sagte damit etwas anderes, als die Zusage
„einmal je Montierung und Konto" behauptet. Umgestellt auf `user?.id`.

### [NIEDRIG] Rechte-Zusagen nahmen jede Ausnahme als DENIED

`try_as` meldet auch einen Tippfehler als DENIED — die drei Zusagen hätten also
bestanden, wäre EXECUTE erteilt. Ergänzt um drei `has_function_privilege`-
Messungen an der ACL selbst und, wichtiger, um eine **Positivkontrolle**: der
echte Einstieg `service_role → push_auftraege_faellig` muss weiter gehen. Ohne
sie wäre ein Entzug, der den Minutenlauf mit abschneidet, von einem richtigen
nicht zu unterscheiden.

**Und eine Ehrlichkeit dazu, die die Review nicht verlangt hat:** die
`service_role`-Zusage ist lokal **schwach**. Gemessen — verkürzt man den Entzug
auf `from public`, bleiben alle 18 Zusagen grün, weil `proacl` lokal `null` ist
und jedes Recht an `PUBLIC` hängt. In PROD hält die Rolle einen rollen-eigenen
Grant, den derselbe Entzug nicht berührt. Steht als Warnung in der Testdatei.

### [NIEDRIG] Der Kommentar zu `register()` und dem iOS-Dialog war falsch

`register()` ruft nur `registerForRemoteNotifications()`; der Dialog entsteht
ausschliesslich über `requestPermissions()`. Kommentar berichtigt.

### [NIEDRIG] „Default Privileges wirken auf Funktionen nicht" war zu pauschal

Sachlich falsch in dieser Form, und die eigene Messung aus AGE-602 sagt es
genauer: `alter default privileges … **grant** execute on functions` wirkt sehr
wohl; wirkungslos ist nur der **revoke**-Weg, weil Postgres `EXECUTE` implizit
an `PUBLIC` vergibt. Der Migrationskopf trägt jetzt die genaue Fassung — samt
dem eigentlichen Grund für die vierte Rolle: rollen-eigene Grants in PROD.

## Gemessen und **nicht** übernommen

### [MITTEL] Doppeltes `register()` auf `/chat` und unter StrictMode

Der Befund stimmt. StrictMode ist an (`main.tsx:27`), der Start-Effekt läuft in
der Entwicklung also doppelt; und wer die App direkt auf `/chat` startet, löst
beide Wege aus — `pushLebenszeichen` beim Montieren und `pushEinrichten`, weil
die Nachrichten offen sind.

**Die Wirkung ist ein zusätzliches, gleichlautendes Upsert.**
`claim_push_token` schreibt das Token auf `auth.uid()`; zweimal dasselbe zu
schreiben ändert nichts. Der Zuhörer-Riegel `zuhoererStehen` verhindert bereits
das Einzige, was wirklich schaden würde — doppelt angemeldete Zuhörer, die aus
einem Ereignis zwei RPCs machten. Ein Fehler dabei blockiert nichts: der Pfad
protokolliert und läuft weiter (`push.ts:74`).

Der vorgeschlagene Umbau — ein gemeinsames In-Flight-Promise über
Listener-Aufbau und Registrierung — ist Maschinerie für einen
Netzwerkaufruf. Das wäre eine Abstraktion für ein Problem, das niemand hat.
**Schwelle für ein Umdenken:** sobald in `push_tokens` doppelte oder
konkurrierende Schreibfehler auftauchen, oder sobald ein Anbieter je
`register()` einen kostenpflichtigen Vorgang auslöst.

## Was der Diff annimmt, ohne es abzusichern

codex' Liste, hier unverändert stehen gelassen, weil sie die ehrlichen Grenzen
dieses Vorgangs benennt:

- `create or replace` erhält Eigentümer, Kommentar und den `service_role`-Grant
  von `push_auftraege_faellig(int)`. Lokal geprüft; bei Owner- oder ACL-Drift in
  PROD stellt die Migration das nicht wieder her.
- Der Eigentümer von `push_auftraege_faellig` darf die Aufräumfunktion
  ausführen. Lokal gehören beide `postgres`; die Migration prüft die Gleichheit
  nicht.
- Ein erneuter `register()`-Aufruf liefert wieder ein `registration`-Ereignis.
  Android tut das direkt; auf iOS hängt es am Delegate-Callback des
  Betriebssystems.
- „App-Start" heisst hier **Montage der `AppShell`**. Ein blosses Vordergrund­
  holen eines noch laufenden Prozesses löst den Effekt nicht erneut aus. Bei
  einer Frist von 180 Tagen trägt das.

## Gegenprobe, die zu dieser Runde gehört

Der übernommene Rumpf von `push_auftraege_faellig` unterscheidet sich vom
Original (`20260828100000:134-200`) in **genau** der eingefügten Anweisung plus
dem Wort „Zuerst" → „Danach". Mit `diff` belegt, nicht behauptet.
