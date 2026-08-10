# resend-activation

Der Aktivierungslink für ein **eingeloggtes** Konto — AGE-495 / C3, Teil D.
Spec:
[`openspec/changes/member-activation-flow/`](../../../openspec/changes/member-activation-flow/).

Aufruf: `POST` ohne Rumpf, mit `Authorization: Bearer <access_token>`. Antwortet
`200 { status }` mit `issued | rate_limited | rate_limited_day |
already_activated | unknown`, oder `502 { status: "send_failed" }`.

## Warum es sie neben `send-activation` gibt

Der Sicherheits-Audit vom 2026-08-06 fand an `send-activation` eine
**Aussperrung**: die Function ist unauthentifiziert, und jede Ausgabe entwertete
den ausstehenden Link. Wer die Login-Adresse eines Mitglieds kannte, forderte in
dessen Namen an — der Link im Postfach des Opfers galt nicht mehr, und nach fünf
Aufrufen war das Tageskontingent leer. Täglich wiederholbar, gegen alle Konten
gleichzeitig.

Der Hauptweg braucht diese Offenheit gar nicht. Wer den Aktivierungsbildschirm
sieht, **ist angemeldet** — er kam ja gerade durch die Anmeldung. Also:

- `verify_jwt = true`. Das Gateway verifiziert das (ES256-)Token vollständig,
  bevor dieser Handler läuft.
- Die RPC `request_own_activation_token` nimmt **keinen** Adressparameter. Ihr
  Subjekt ist `auth.uid()`; fremd anfordern ist per Signatur ausgeschlossen.
- Sie ist die einzige Funktion aus Teil C/D, die `authenticated` aufrufen darf —
  genau deshalb.

`send-activation` bleibt für den seltenen Wiederherstellungsfall auf
`/aktivierung` ohne Sitzung und ist dort seit Teil D durch ein 24-Stunden-
Schutzfenster gedrosselt.

## Warum sie die User-ID nicht selbst liest

Sie braucht sie nicht. Der Client trägt das vom Gateway verifizierte Token, der
Handler reicht den `Authorization`-Header an den Supabase-Client weiter,
PostgREST verifiziert erneut, und `auth.uid()` löst in der RPC auf. Muster wie
`create-checkout-session`; `getUser()`/`getClaims()` sind unter ES256
unbrauchbar (s. `docs/decisions/`).

## Warum die Antwort hier ehrlich sein darf

`send-activation` antwortet immer `202` und versendet **nach** der Antwort, weil
die Antwortzeit sonst verrät, welche Adressen existieren. Hier gibt es dieses
Problem nicht: der Aufrufer fragt nach seinem eigenen Konto und weiß längst,
dass es besteht. Der Status ist die Information, die der Bildschirm braucht.

Die Adresse selbst wird auch hier nie protokolliert.

## Token

Identisch zu `send-activation`: 32 Byte aus `crypto.getRandomValues` → 256 Bit,
base64url; gespeichert wird nur der SHA-256-Hash. Ausgeben, Entwerten des alten
Links und die Ratengrenzen (ein Versand pro 60 s, fünf pro 24 h) fallen in
**eine** Datenbankoperation.

Anders als im anonymen Weg gibt es hier **kein** Schutzfenster: das Entwerten
kann niemand Fremdes auslösen, und „meine Mail kam nicht an, schick nochmal" ist
genau der Fall, den dieser Weg bedienen soll.

## Mailtext

Aus [`../send-activation/emails.ts`](../send-activation/emails.ts) — dieselbe
Mail, derselbe Link. Der Text ist nur einmal da, damit er nicht auseinanderläuft.

## Secrets

`RESEND_API_KEY`, `FROM_EMAIL`, `APP_URL` aus Infisical (s.
[`docs/secrets.md`](../../../docs/secrets.md)). `SUPABASE_URL` und
`SUPABASE_ANON_KEY` spritzt die Plattform ein — **kein** Service-Role-Key: diese
Function arbeitet bewusst mit den Rechten des Aufrufers.

## Tests

```bash
deno check supabase/functions/resend-activation/index.ts
```

Die reine Logik (Linkbau, Escaping, Pflichtsätze) ist in
`send-activation/emails.test.ts` geprüft und wird hier geteilt. Das Verhalten der
RPC — Subjekt aus der Sitzung, Grants, Ratengrenzen — steht in
`supabase/tests/rls_test.sql`, Abschnitt 14b.
