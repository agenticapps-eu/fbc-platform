# notify-contact-request liest über eine DEFINER-RPC statt als service_role

## Why

Linear: **AGE-623**, unabhängig bestätigt von zwei Plan-Reviewern (gemini,
opencode) beim Planen von AGE-622.

`supabase/functions/notify-contact-request/index.ts:91-94` baut seinen Client
mit `SUPABASE_SERVICE_ROLE_KEY` und liest damit **direkt** drei Tabellen in
`public`: `profile_contacts` (Adresse des Empfängers), `profiles` (Name des
Gegenübers) und `contact_requests` (die Zeile selbst).

Das ist kein Nebenweg, sondern die **Sicherheitsprüfung**. Das gemeinsame
Geheimnis belegt, dass der *Aufruf* vom Webhook kam — nicht, dass die *Zeile*
existiert. Ohne den Abgleich könnte, wer das Geheimnis hält, eine erfundene
Zeile posten und Empfänger, Absendernamen und Nachrichtentext frei wählen; die
Mail ginge unter der Absenderadresse des Clubs hinaus.

Der Weg steht auf einer **Instanz-Eigenschaft, die dieses Repository nirgends
ausspricht**. Gemessen am 27.08.:

- **Keine wirksame `grant`-Anweisung erteilt `service_role` ein Tabellenrecht.**
  `20260715140000_explicit_grants.sql:35` sagt dazu nur „service_role bleibt
  unangetastet". Der einzige Grep-Treffer auf `grant … to service_role` im
  ganzen Migrationsbaum ist ein **Kommentar**, der genau das verwirft
  (`20260811090300:347`, „VERWORFEN: `grant select on public.staff_roles to
  service_role`").
- Im lokalen Stack hält `service_role` die Rechte trotzdem, und zwar
  **rollen-eigen**: `relacl` liest `service_role=arwdDxtm/postgres`. Sie stammen
  also aus den Default Privileges der Instanz, nicht aus diesem Repository.
- **Die Gegenprobe sitzt im selben Katalog:** `service_role` liest **35 von 36**
  Tabellen in `public`. Die eine Ausnahme ist `staff_roles` — genau die Tabelle,
  für die eine Migration den Entzug ausdrücklich ausspricht. Instanzseitig
  erteilt heisst also: überall, ausser wo jemand widerspricht.

Damit hängt der Mailweg an etwas, das niemand hier entschieden hat und das
niemand hier prüft. Eine neu angelegte Instanz kann es anders handhaben — genau
daran ist AGE-622 aufgefallen, wo dieselbe Sorte Annahme die CI ohne eine Zeile
Codeänderung rot werden ließ.

> **Korrektur gegenüber der Issue-Beschreibung — und Auflösung eines
> Widerspruchs.** AGE-623 nennt als Beleg „der lokale Stack hat es heute schon
> nicht: dort liefe die Function in permission denied", und der Kopf von
> `20260827070000_entzuege_nennen_alle_rollen.sql:26-28` (AGE-622) sagt dasselbe:
> lokal halte `service_role` auf **0 von 36** Tabellen ein Recht.
>
> Heute misst derselbe Stack **35 von 36**. Beide Messungen waren zu ihrer Zeit
> richtig; ausgetauscht wurde der **Datenträger**. Genau das sagt jener Kopf
> selbst voraus — „sein Datenträger stammt aus einer älteren Abbildung" —, und
> mit der in AGE-622 gepinnten, PROD-ähnlicheren Abbildung ist der lokale Stack
> nun die großzügige Sorte. Der lokale Stack ist damit **kein** Beleg mehr für
> die strenge Sorte, und ein grüner lokaler Lauf sagt über die strenge Sorte
> weiterhin nichts.
>
> Der Befund wird dadurch nicht schwächer, sondern präziser: es geht nicht um ein
> kaputtes Recht, sondern um ein Recht aus einer Quelle, die dieses Repository
> nicht kontrolliert und deren Wechsel — wie hier vorgeführt — unbemerkt bleibt.

`openspec/specs/access-control/spec.md:175-178` führt diese Frage ausdrücklich
als offen und verlangt „einen Vorgang, der sie schliesst". Das ist dieser.

## Gemessen, nicht angenommen

- **Genau eine Edge Function ist betroffen — für alle acht belegt, nicht für
  eine.** `create-checkout-session` liest zwar ebenfalls `.from("profiles")`,
  aber mit dem **Anon-Schlüssel** und dem `authorization`-Header des Mitglieds
  (`index.ts:38-40`) — RLS-gebunden, kein `service_role`-Fall.
  `admin-change-email` und `admin-set-member-ban` gehen bereits über RPCs und
  nennen den Grund im Quelltext. Die übrigen vier greifen **ausschliesslich**
  über `.rpc()` zu: `stripe-webhook:45`, `send-activation:119`,
  `redeem-activation:78-82`, `resend-activation:99,159`. Damit bleibt
  `notify-contact-request` der einzige direkte Tabellenzugriff unter dem
  Dienstschlüssel.
- **PROD-Messung:** Der Rechtekatalog wird mit einer reinen Lese-Sonde samt
  Positivkontrolle erhoben. Sie entscheidet die *Dringlichkeit*, nicht das Ziel:
  ist PROD die großzügige Sorte, ist dieser Umbau Vorsorge; ist es die strenge,
  geht die Mail seit je nicht hinaus.

## What Changes

- **Neue `SECURITY DEFINER`-RPC** `notify_contact_request_daten(uuid, uuid, uuid)`,
  ausführbar allein für `service_role`. Sie liefert in einem Aufruf die Zeile aus
  `contact_requests`, die Zustelladresse des Empfängers und den Anzeigenamen des
  Gegenübers.
- **Die Bindung wandert in die Datenbank.** Die RPC gibt **nichts** zurück, wenn
  die übergebene Empfänger- und Gegenüber-Kennung nicht die beiden Beteiligten
  genau dieser Anfrage sind. Heute liegt diese Bindung allein in der Function;
  danach hält sie auch dann, wenn die Prüfung dort fiele.
- `notify-contact-request` ruft die RPC statt der drei `.from(...)`-Lesezugriffe.
  Der Abgleich Payload ⇄ Datenbank (`passtZurDatenbank`) **bleibt unverändert**,
  ebenso alle Antwortcodes: 502 bei Lesefehler, 409 bei Abweichung.
- Die Zusage in `rls_test.sql` bleibt in diesem Change **auf ihre eine Tabelle
  beschränkt**; sie wird nicht zum Grundsatz erhoben.

## Ausdrücklich NICHT Teil dieses Changes

- **Der flächendeckende `service_role`-Entzug** (`revoke all on all tables in
  schema public from service_role` samt der Default-Privileges-Zeile). Er ist
  Schritt 3 des Issues und setzt eine Inventur **aller acht** Edge Functions
  voraus — `stripe-webhook`, `send-activation`, `redeem-activation` und
  `resend-activation` sind hier nicht vermessen. Ein Entzug, der eine davon
  bricht, wäre genau der Fehler, den AGE-622 vermieden hat, als es ihn
  herausnahm.
- **Das Heben der `rls_test`-Zusage von einer Tabelle auf alle** (Schritt 4). Sie
  ist erst wahr, wenn der Entzug gelaufen ist; vorher wäre sie eine Behauptung.

- **Der Lebenszyklus der Beteiligten.** Weder heute noch nach diesem Change
  prüft der Mailweg `disabled_at`/`deleted_at`: eine Benachrichtigung geht auch
  an ein soft-deaktiviertes Konto. Ein *hart* gelöschtes Profil kann nicht
  betroffen sein — beide Fremdschlüssel von `contact_requests` stehen auf
  `ON DELETE CASCADE`, gemessen am 27.08. Der Soft-Fall ist ein **bestehender**
  Befund, den dieser Change weder einführt noch behebt; ihn hier mitzunehmen
  hieße, eine Verhaltensänderung in einen Umbau zu schmuggeln, der ausdrücklich
  verhaltensgleich sein soll. Er wird als eigener Vorgang geführt.

Beides gehört in einen Folgevorgang, der die Inventur trägt.

## Verhaltensgleichheit ist die Abnahmebedingung

Der Umbau tauscht den **Lesekanal**, nicht das Verhalten. Insbesondere bleibt die
Unterscheidung erhalten, die der heutige Code trifft: eine fehlende
Zustelladresse ist ein erledigter Normalfall (200, `skipped: no_email`), eine
Zeile, die nicht zum Payload passt, ist eine Abweichung (409), und ein
Lesefehler ist wiederholbar (502). Eine RPC, die „keine Adresse" und „keine
Zeile" in dieselbe Antwort fallen ließe, verwandelte den ersten Fall still in
einen der beiden anderen.
