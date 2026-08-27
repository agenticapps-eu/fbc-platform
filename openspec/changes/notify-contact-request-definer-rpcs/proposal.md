# notify-contact-request liest über eine DEFINER-RPC statt als service_role

## Why

Linear: **AGE-623**, unabhängig bestätigt von zwei Plan-Reviewern (gemini,
opencode) beim Planen von AGE-622.

`supabase/functions/notify-contact-request/index.ts:101-112` baut seinen Client
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

- **Keine einzige Migration erteilt `service_role` ein Tabellenrecht.**
  `20260715140000_explicit_grants.sql:35` sagt dazu nur „service_role bleibt
  unangetastet"; eine `grant`-Zeile auf `profile_contacts`, `profiles` oder
  `contact_requests` existiert nirgends im Migrationsbaum.
- Im lokalen Stack hält `service_role` die Rechte trotzdem, und zwar
  **rollen-eigen**: `relacl` liest `service_role=arwdDxtm/postgres`. Sie stammen
  also aus den Default Privileges der Instanz, nicht aus diesem Repository.

Damit hängt der Mailweg an etwas, das niemand hier entschieden hat und das
niemand hier prüft. Eine neu angelegte Instanz kann es anders handhaben — genau
daran ist AGE-622 aufgefallen, wo dieselbe Sorte Annahme die CI ohne eine Zeile
Codeänderung rot werden ließ.

> **Korrektur gegenüber der Issue-Beschreibung.** AGE-623 nennt als Beleg „der
> lokale Stack hat es heute schon nicht: dort liefe die Function in permission
> denied", gestützt auf eine Messung von 0 von 36 Tabellen. Das ist für den
> heutigen Stand **widerlegt** — lokal misst `has_table_privilege` auf allen drei
> Tabellen `true`. Der Befund wird dadurch nicht schwächer, sondern präziser: es
> geht nicht um ein kaputtes Recht, sondern um ein Recht aus unbekannter Quelle.

`openspec/specs/access-control/spec.md:175-178` führt diese Frage ausdrücklich
als offen und verlangt „einen Vorgang, der sie schliesst". Das ist dieser.

## Gemessen, nicht angenommen

- **Genau eine Edge Function ist betroffen.** `create-checkout-session` liest
  zwar ebenfalls `.from("profiles")`, aber mit dem **Anon-Schlüssel** und dem
  `authorization`-Header des Mitglieds (`index.ts:38-40`) — dieser Weg ist
  RLS-gebunden und kein `service_role`-Fall. `admin-change-email` und
  `admin-set-member-ban` gehen bereits über RPCs und nennen den Grund im
  Quelltext.
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

Beides gehört in einen Folgevorgang, der die Inventur trägt.
