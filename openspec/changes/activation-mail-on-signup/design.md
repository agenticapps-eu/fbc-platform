# Design — Aktivierungsmail bei der Selbstregistrierung (AGE-526)

## Context

Der Aktivierungsweg aus AGE-495 (C3) ist vollständig gebaut und ausgerollt:
`request_own_activation_token` gibt über die Sitzung ein Token aus,
`resend-activation` (`verify_jwt = true`) versendet es über Resend, der
Aktivierungsbildschirm bietet den Knopf, `redeem-activation` löst es ein. Die
ausgerollten Function-Secrets stimmen (`FROM_EMAIL = FBC
<noreply@effbeezee.com>`, Digest am 2026-08-10 geprüft), und `effbeezee.com` ist
bei Resend `verified`.

Was fehlt, ist der **Auslöser**. Der Weg wurde für importierte Mitglieder
entworfen, bei denen ein Admin den adressbasierten `send-activation` anstößt.
Die Selbstregistrierung landet hinter demselben Gate, ohne dass jemand ihn
anstößt.

Zwei Eigenschaften des Bestandes prägen den Entwurf:

1. **Die Sitzung besteht sofort.** `enable_confirmations = false` (AGE-445)
   heißt, dass `supabase.auth.signUp` unmittelbar eine Session liefert. Der
   sitzungsgebundene Weg `resend-activation` ist damit direkt nach der
   Registrierung aufrufbar — ohne den adressbasierten Weg anzufassen.
2. **`resendActivationLink()` verschluckt den Status.** Die Function antwortet
   bei `rate_limited`, `rate_limited_day` und `already_activated` mit **200**
   und dem Status im Rumpf; der Client gibt `void` zurück und wirft nur bei
   einem Transportfehler. Der Bildschirm meldet daraufhin grün „Der Link ist
   unterwegs", obwohl nichts ausgegeben wurde.

## Goals / Non-Goals

**Goals:**

- Nach einer erfolgreichen Selbstregistrierung existiert ohne weiteres Zutun
  genau eine Zeile in `activation_tokens` für das neue Profil.
- Der Aktivierungsbildschirm behauptet nie einen Versand, den es nicht gab.
- Der Missbrauchsweg aus AGE-517 wird durch den Wegfall des Klicks nicht
  billiger, als er heute ist.

**Non-Goals:**

- AGE-517 schließen. Eine Grenze je Absender-IP bleibt offen.
- `send-activation` (ohne Sitzung) ändern.
- Die eingebaute E-Mail-Bestätigung wieder einschalten (AGE-445 steht).
- Den Mailtext ändern (AGE-513).

## Decisions

### D1 — Der Auslöser sitzt in `AuthProvider.signUp`, nicht in `LoginPage`

Die Registrierung **entsteht** in `signUp`; `LoginPage` ist nur ein Aufrufer.
Läge der Aufruf im Formular, hätte ein zweiter Registrierungsweg die Lücke
sofort wieder.

*Verworfen: ein Datenbank-Trigger auf `profiles`.* Er würde jeden Weg erfassen,
auch einen künftigen Import, verlangt aber `pg_net` und das Resend-Geheimnis in
der Datenbank. Das ist eine neue Abhängigkeit und eine neue Geheimnisfläche für
einen Nutzen, den heute niemand einlöst.

### D2 — Der Status wird durchgereicht, statt verschluckt

`resendActivationLink()` gibt den Status der Function zurück
(`issued | rate_limited | rate_limited_day | rate_limited_global |
already_activated | unknown`). Der Bildschirm zeigt „unterwegs" **nur** bei
`issued`.

Ohne diesen Schritt reißt die neue Grenze genau den Fehler wieder auf, den
dieser Change behebt: Ein Nutzer, der nach dem automatischen Versand die Seite
neu lädt und innerhalb der Sperrfrist auf den Knopf drückt, bekäme grünes Licht
und keine Mail.

### D3 — Die plattformweite Grenze steht in der RPC, nicht in der Function

`request_own_activation_token` ist die einzige Stelle, an der auf diesem Weg
Token entstehen, und sie hält bereits die Sperre auf der Profilzeile
(`20260808200000`). Eine Prüfung in der Edge Function wäre an einer zweiten
Instanz vorbeizurechnen und läge außerhalb der Transaktion.

Die Zählung ist `count(*) from activation_tokens where created_at > now() -
interval '1 hour'` — **alle** Ausgaben der letzten Stunde, nicht nur die
automatischen. Für den Schutz des Resend-Kontingents zählt jede Mail gleich.

**Die Zählung allein reicht nicht** (Befund beider Reviewer). Ein `count(*)` vor
dem `insert` ist genau unter Gleichzeitigkeit falsch — mehrere frische Profile
lesen denselben Stand unter der Schwelle und schreiben alle. Die Sperre auf der
eigenen Profilzeile aus `20260808200000` hilft hier nicht: Sie serialisiert
Anforderungen **desselben** Profils, die Grenze ist aber profilübergreifend.
Vor der Zählung steht deshalb ein `pg_advisory_xact_lock` auf einer festen
Kennzahl. Er serialisiert ausschließlich die Ausgabe von Aktivierungstoken, hält
nur bis zum Ende der Transaktion und ist damit der kleinste Riegel, der die
Zusage trägt.

*Verworfen: eine Budgetzeile, die `for update` genommen wird.* Sie führte eine
Tabelle ein, die es sonst nicht gäbe, und müsste stündlich zurückgesetzt werden.
Das gleitende Fenster über `activation_tokens` braucht keinen eigenen Zustand.

### D3a — Die Zusage gilt für den sitzungsgebundenen Weg, nicht „plattformweit"

Der erste Entwurf des Deltas sagte „plattformweit … höchstens einhundert Token"
zu, baute die Schranke aber nur in `request_own_activation_token`.
`issue_activation_token` — der adressbasierte Weg, den ein Admin für importierte
Mitglieder anstößt — gibt weiter aus. Die Zusage war damit größer als der Bau.

Aufgelöst durch Verengung, nicht durch mehr Bau: Der Admin-Weg **zählt in das
Kontingent hinein**, wird aber nicht von ihm gebremst. Er ist nicht der
Missbrauchsweg — er sendet nur an bereits bestehende Profile, und er hat einen
Menschen davor.

### D4 — Die Grenze greift nach Profilalter, nicht nach einem Flag

**Der erste Entwurf trug nicht und wird hier festgehalten, damit ihn niemand
wiederholt:** „automatisch" als Feld im Anfragerumpf wäre vom Aufrufer selbst
gesetzt. Ein Angreifer schickt `false` und die Grenze ist umgangen.

Serverseitig prüfbar ist stattdessen das Alter des Profils. Die plattformweite
Grenze greift nur, wenn `profiles.created_at > now() - interval '10 minutes'` —
also im Registrierungsschwall, dem einzigen Fall, den der automatische Versand
neu erzeugt. Ein Mitglied, dessen Konto von gestern ist, kommt über den Knopf
immer durch: Ein verbranntes Stundenbudget wird damit **nicht** zur Aussperrung.

*Preis, ausdrücklich:* Wer wartet, ist zurück beim heutigen Zwei-Anfragen-Weg.
Das ist die Ausgangslage, die AGE-517 beschreibt — dieser Change macht sie
nicht schlechter.

### D5 — 100 Ausgaben pro Stunde

Die Spec begründet den eigenen Mailversand mit dem Fall „siebzig Mitglieder an
einem Abend". Eine Grenze bei 60 verfehlte genau diesen Fall, wenn der Abend
sich in einer Stunde verdichtet. 100 deckt ihn mit Reserve; die stärkste je
gemessene Stunde lag bei 14 (und das war der Demo-Seed, kein Mensch).

*Verworfen: Stunde und Tag gemeinsam.* Zwei Werte, die bei jeder künftigen
Veranstaltung gegeneinander gelesen werden müssten, für einen Schutz, den die
Stundengrenze schon trägt.

### D6 — Der Bildschirm erfährt das Ergebnis über den Auth-Kontext

**Diese Naht fehlte im ersten Entwurf** (Befund des zweiten Reviewers).
`ActivationScreen` wird nicht von `LoginPage` gerendert, sondern von
`ActivationGate` nach dem Routenwechsel; `signUp` gibt heute nur `{ error }`
zurück. „Der Bildschirm startet im Zustand unterwegs" war damit aus dem
beschriebenen Umbau gar nicht erreichbar.

`AuthProvider` hält das Ergebnis des automatischen Versands als Zustand und
stellt es über den Auth-Kontext bereit; `ActivationScreen` liest es dort. Das
ist derselbe Weg, den `isActivated` und `activationName` schon gehen — keine
neue Mechanik, nur ein weiteres Feld.

Nach einem Neuladen ist der Zustand fort und der Bildschirm zeigt wieder den
Knopf. Das ist richtig so: Ein Neuladen weiß nichts über einen Versand, und die
Alternative wäre eine Behauptung aus `sessionStorage`, die niemand geprüft hat.

### D7 — Der Rückgabetyp trägt auch den Fehlschlag

Die Function antwortet **502** mit `{"status":"send_failed"}`, wenn Resend
ablehnt, und **502** ohne Rumpf, wenn die Ausgabe scheitert. Der Rückgabetyp in
`activation.ts` führt deshalb `send_failed` und `error` mit, nicht nur die
DB-Status. Sonst fiele der Fehlschlag in denselben Zweig wie eine abgewiesene
Anforderung, und der Bildschirm meldete eine Wartezeit, wo ein zweiter Versuch
nötig ist. Das Lesen des Fehlerrumpfs macht `redeemActivation` im selben Modul
bereits vor — dasselbe Muster, nicht ein neues.

### D8 — Ein fehlgeschlagener Versand macht die Registrierung nicht ungültig

Das Konto ist angelegt und die Sitzung besteht, bevor der Versand beginnt. Wirft
der Aufruf, bleibt beides bestehen und der Bildschirm zeigt den Knopf wie
heute — der Nutzer hat dann denselben Weg wie vor diesem Change, nicht
schlechter.

## Risks / Trade-offs

- **Ein Angreifer erzeugt mit einer Anfrage statt zweien eine Mail an eine
  fremde Adresse.** → Die plattformweite Grenze deckelt den automatischen Weg
  bei 100/Stunde; ohne sie wäre er unbegrenzt. AGE-517 bleibt offen und ist im
  Proposal als solches benannt.
- **Der automatische Versand verbraucht die 60-Sekunden-Sperrfrist sofort.** Wer
  gleich auf „erneut senden" drückt, bekommt `rate_limited`. → D2 sorgt dafür,
  dass der Bildschirm das sagt, statt Erfolg zu melden; der Zähler startet
  sichtbar.
- **Die Grenze ist profilübergreifend und damit von Fremden beeinflussbar.** Ein
  Angreifer mit zwanzig Konten kann das Stundenkontingent selbst füllen — die
  RPC ist für `authenticated` aufrufbar, es braucht dafür nicht einmal eine
  gesendete Mail. Frisch registrierte Konten bekommen dann keine automatische
  Mail. → D4 begrenzt die Wirkung auf die ersten 10 Minuten eines Profils: Die
  Sperre löst sich von selbst, danach trägt der Knopf. **Der Weg ist verzögert,
  nicht verschlossen** — und das steht so in der Anforderung, statt als
  unbenannte Folge im Code zu liegen. Ein Konto dauerhaft auszusperren ist damit
  nicht möglich.
- **Eine Registrierungswelle jenseits von hundert in der Stunde trifft genau die
  Neuen.** → Bewusst hingenommen: Der Wert deckt den benannten Ernstfall
  („siebzig an einem Abend") mit Reserve, und die Verzögerung beträgt zehn
  Minuten. Wird das im Betrieb je erreicht, ist der Wert die Stellschraube, nicht
  der Entwurf.
- **Ein neuer Status in der RPC.** `rate_limited_global` muss in Function,
  Client und Bildschirm ankommen, sonst fällt er in einen `default`-Zweig und
  wird als Erfolg gelesen. → Der Rückgabetyp in `activation.ts` ist eine
  Vereinigung; ein fehlender Zweig ist ein Typfehler.

## Migration Plan

1. Migration schreiben, lokal gegen `supabase start` mit pgTAP prüfen.
2. Frontend-Änderungen mit Vitest, RED vor GREEN.
3. `migrate-dev`, dann Sichtprobe an einer echten Registrierung auf DEV.
4. `migrate-prod` — der Dry-Run wird **vorher lesend** geprüft
   (`migration-drift-gate.ts`), weil `apply` im Workflow direkt hinter `plan`
   startet.
5. Frontend-Deploy. Der `drift-gate` überspringt sonst den Deploy-Job.

**Rückweg:** Die Migration ersetzt eine Funktion per `create or replace`. Ein
Zurückrollen ist das Wiedereinspielen der Vorgängerfassung; Daten ändert sie
nicht. Der Frontend-Teil ist ohne die Migration lauffähig — der neue Status
träte dann nie auf.

## Open Questions

- **Ist die Zustellung an eine echte Fremdadresse belegt?** Bisher ist belegt,
  dass die Domain verifiziert und der Absender richtig gesetzt ist — nicht, dass
  ein Link im Postfach eines Dritten ankommt. Die Abnahme verlangt einen echten
  Durchlauf; ein `202` oder ein grüner Bildschirm belegt ihn nicht.
- **Die beiden Demo-Konten vom 2026-08-10** (`donald+test@factiv.eu`,
  `dk.email@gmx.de`) liegen unbestätigt in der Live-DB. Ob sie nachträglich
  einen Link bekommen oder gelöscht werden, gehört zu AGE-522, nicht hierher.
