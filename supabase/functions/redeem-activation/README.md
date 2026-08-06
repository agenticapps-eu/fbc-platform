# redeem-activation

Löst den Aktivierungslink ein — AGE-495 / C3. Spec:
[`openspec/changes/member-activation-flow/`](../../../openspec/changes/member-activation-flow/).

Aufruf: `POST` mit `{ "token": "…", "password": "…" }`.

## Warum `verify_jwt = false`

**Absicht, kein Versehen.** Das Token trägt die Identität, nicht die Sitzung —
nur so funktioniert der Link in einem anderen Browser oder auf einem anderen
Gerät (AGE-495 §6). Es wird kein JWT gelesen; der einzige Nachweis ist das
256-Bit-Token aus dem Fragment der Adresse.

## Die Reihenfolge ist die Sicherung

`auth.admin.updateUserById` läuft über GoTrue per HTTP und kann mit einem
Postgres-Commit nicht klammern — echte Atomarität ist nicht zu haben. Statt sie
zuzusagen, steht die Reihenfolge fest:

| #   | Schritt                       | Warum an dieser Stelle                                                                                                                  |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Token **atomar** beanspruchen | Prüfen und Verbrauchen in _einer_ Anweisung. Zwei gleichzeitige Einlösungen kämen sonst beide durch und setzten verschiedene Passwörter |
| 2   | Passwort setzen               |                                                                                                                                         |
| 3   | Sitzungen beenden             |                                                                                                                                         |
| 4   | **Erst dann** aktivieren      | Schritt 4 öffnet das Gate. Alles, was schiefgehen kann, geht schief, solange es noch geschlossen ist                                    |

Bricht es nach Schritt 2 ab, steht ein Konto mit **neuem** Passwort und ohne
Aktivierung: Das Mitglied kommt herein, sieht den Aktivierungsbildschirm und
fordert einen neuen Link an. Die umgekehrte Reihenfolge erzeugte den
gefährlichen Zustand — aktiviert, aber noch auf dem verteilten Passwort.

## Der Sitzungswiderruf läuft nicht über die Admin-API

`auth.admin.signOut` erwartet ein **Access-JWT**, keine Nutzer-ID (Signatur am
2026-08-06 nachgemessen: `signOut(jwt: string, scope?)`). Beim Einlösen liegt
uns keine Sitzung des Mitglieds vor, nur seine ID — der Aufruf wäre zur Laufzeit
`401` gelaufen und hätte **jede** Aktivierung scheitern lassen, ohne dass ein
Typecheck etwas gemerkt hätte. Stattdessen `revoke_sessions(uuid)`, eine
`SECURITY DEFINER`-Funktion nur für `service_role`.

**Benannte Restfläche:** Ein bereits ausgegebener Access-Token ist zustandslos
und bleibt bis `jwt_expiry` (derzeit 3600 s) gültig. Der Widerruf nimmt die
Erneuerung, nicht das laufende Token. Sie zu schließen hieße, `jwt_expiry` zu
senken oder in jeder Policy gegen `auth.sessions` zu joinen — auf jeder Abfrage.

## Statuscodes

Die Oberfläche muss die Fälle aus AGE-495 §6 unterscheiden können, deshalb je
ein eigener Status statt eines generischen „ungültig":

| Status          | Bedeutung                              | Was die Oberfläche zeigt                                                                        |
| --------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `activated`     | Alles durch                            | Weiter in die App                                                                               |
| `expired`       | Älter als 72 h                         | „Abgelaufen" + neuen Link senden                                                                |
| `used`          | Schon eingelöst                        | „Konto ist bereits aktiviert" + Login                                                           |
| `superseded`    | Ein **neuerer** Link wurde angefordert | „Nicht mehr gültig" + neuen Link. **Nicht** „bereits aktiviert" — das Konto ist es gerade nicht |
| `not_found`     | Unbekanntes Token                      | „Nicht mehr gültig" + neuen Link                                                                |
| `weak_password` | Unter zehn Zeichen                     | Feldmeldung                                                                                     |
| `retry_needed`  | Abbruch nach Schritt 2 oder 3          | „Bitte neuen Link anfordern"                                                                    |

`superseded` von `used` zu trennen ist der Grund für die eigene Spalte
`invalidated_at`: Mit nur `used_at` bekäme jemand, der zweimal anfordert und den
ersten Link klickt, die Meldung „dein Konto ist bereits aktiviert" — und das
wäre schlicht falsch.

## Secrets

`SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` spritzt die Plattform ein. Sonst
keine.

## Tests

Die Logik dieser Function liegt in der Datenbank (`claim_activation_token`,
`mark_activated`, `revoke_sessions`) und ist dort in `supabase/tests/rls_test.sql`
belegt — Nebenläufigkeit, Ablauf, Entwertung, Idempotenz und die
Rechteverteilung. `deno check index.ts` prüft den Rahmen.
