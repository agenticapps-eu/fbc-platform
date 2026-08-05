# DB-AUDIT — database-sentinel gegen beide Supabase-Projekte

**Datum:** 2026-08-05 · **Change:** AGE-496 (Task 15.2) · **Backend:** Supabase
**Geprüft:** `viwntbodrtqxgmqyxluh` (PROD, neu) und `foelowldexkcqzewvrcf` (DEV/DEMO)

**Ergebnis: keine Critical, keine High.** Zwei Punkte zur Entscheidung vor dem
17.08., beide keine Fehlkonfiguration, sondern eine Annahme, die nicht mehr
trägt.

Beide Projekte tragen dieselben 40 Migrationen und damit dieselbe Rechtelage;
alle Struktur-Befunde gelten für beide. Die Sichtbarkeitsproben liefen gegen
**DEV**, weil PROD leer ist und „0 Zeilen" dort nichts beweist.

---

## Was hält — nicht als Floskel, sondern gemessen

| Prüfung                                                    | Ergebnis            |
| ---------------------------------------------------------- | ------------------- |
| Tabellen ohne RLS                                          | **0 von 28**        |
| RLS an, aber keine Policy (stilles Deny-all)               | **0**               |
| Schreib-Policies mit `USING(true)` / `WITH CHECK(true)`    | **0**               |
| `UPDATE`-Policies ohne `WITH CHECK` (Mass Assignment)      | **0**               |
| Policies ohne `TO`-Klausel (gelten damit für `anon`)       | **0**               |
| Policies, die `user_metadata` lesen (vom Nutzer fälschbar) | **0**               |
| `SECURITY DEFINER` ohne fixen `search_path`                | **0 von 22**        |
| Sensible Spaltennamen (`password`, `token`, `api_key`, …)  | **0**               |
| Materialized Views (umgehen RLS immer)                     | **0**               |
| Service-Role-Key im Client-Bundle                          | **nicht vorhanden** |

Eine anonyme Sitzung sieht auf DEV **genau** das, was sie sehen soll: das eine
Event mit `visibility = 'public'`, die fünf öffentlichen Beiträge, sowie
`badges`, `membership_tiers` und `partner_categories` — Referenzdaten ohne
Personenbezug. Alle übrigen 23 Tabellen sind ihr **nicht einmal gegrantet**.

Zwei Funktionen, die `anon` ausführen darf und die schreiben, wurden **wirklich
aufgerufen**, nicht nur gelesen:

```
anon ruft register_for_event  -> ABGELEHNT: not authenticated
anon ruft set_event_check_in  -> ABGELEHNT: not the host of this event
```

Der EXECUTE-Grant an `anon` ist damit folgenlos — die Funktionen prüfen selbst.

---

## Befund 1 — „Mitglieder-Sichtbarkeit" heißt faktisch „jeder, der sich anmeldet"

**Schweregrad: MITTEL** · betrifft beide Projekte · **keine Fehlkonfiguration**

Gemessen: eine Sitzung als frisch registriertes Konto **ohne Profil und ohne
Mitgliedsstufe** sieht auf DEV

- **36 von 37 Profilen** über `public.profiles_public`
  (`id, name, avatar_url, region, company, short_bio, tier, roles`),
- **alle 9 Events**, also auch die 8 mit `visibility = 'members'`,
- die Kommentare zu allen für sie sichtbaren Beiträgen.

Beides ist genau so gebaut und dokumentiert:

- `profiles_public` wurde am 2026-06-30 (schon einmal database-sentinel)
  bewusst auf _read-only, members-only_ gehärtet: `anon` hat weder SELECT noch
  Schreibrechte, `authenticated` behält SELECT fürs Verzeichnis.
- Der Kopf von `20260722070000_event_register_visibility_threshold.sql` sagt es
  wörtlich: „Der Sichtbarkeits-Check darüber blockt nicht (members lässt jeden
  Eingeloggten durch)". Gestuft ist die **Teilnahme**, nicht das **Sehen**.

**Was sich geändert hat, ist nicht die Technik, sondern die Annahme.** Beide
Entscheidungen setzen voraus, dass „eingeloggt" eine Hürde ist. Auf PROD gilt
seit heute `enable_signup = true` und `enable_confirmations = false` — jede
Person im Internet hat in zwanzig Sekunden ein Konto, ohne eine Mail zu
bestätigen. Ab dem 17.08. liegen dort ~70 echte Mitglieder mit Firma, Region und
Kurzbiografie.

**Angriffsbild:** Wettbewerber oder Datenhändler registriert sich, ruft
`GET /rest/v1/profiles_public?select=*` einmal auf, hat das Mitgliederverzeichnis.
Kein Exploit, kein Bug — der vorgesehene Weg.

**Was bereits dagegen hält:**

- Die View filtert auf `is_public` — Mitglieder können sich austragen (daher 36
  statt 37). Das ist der eigentliche Schutz, und er liegt beim Mitglied.
- `anon` kommt nicht heran: `permission denied for view profiles_public`.
- `grants_test.sql` führt `profiles_public/authenticated=SELECT` als
  Golden Snapshot. Ein versehentliches `grant select … to anon` bricht CI. Die
  Absicherung hängt hier an Grants statt an RLS — und ist gegen Rückfall
  geprüft. Das ist gut gelöst und soll so bleiben.

**Zu entscheiden (Donald), nicht von hier aus zu „fixen":**

1. **Annehmen.** Das Verzeichnis ist der Zweck der Plattform; wer Mitglied wird,
   sieht Mitglieder. Dann gehört der Satz in die Datenschutzhinweise und
   `is_public` prominent in die Profil-Einstellungen.
2. **Registrierung schließen** (`enable_signup = false`, Zugang per Einladung).
   Macht „eingeloggt" wieder zur Hürde. Kostet den Selbstregistrierungs-Weg,
   den das Sommerfest gerade braucht.
3. **Verzeichnis stufen** — `profiles_public` erst ab `connect` oder `discover`.
   Ein Zeilen-Eingriff in der Policy-Ebene, aber eine Produktentscheidung.

Empfehlung war **(1) bewusst annehmen und dokumentieren** — für das Sommerfest
ist Selbstregistrierung notwendig, und ohne sie fällt der Gäste-Fall aus, den
AGE-448 gerade erst repariert hat.

> **Entscheidung Donald, 2026-08-05: wird in C3 erledigt**, dort kommt die
> E-Mail-Bestätigung. Bis dahin bewusst angenommen.
>
> **Beim C3-Check nicht abnicken.** E-Mail-Bestätigung hebt die Hürde von
> „nichts" auf „eine Wegwerf-Adresse". Sie ändert **nichts** daran, dass
> `profiles_public` für _jedes_ `authenticated`-Konto lesbar ist, unabhängig
> von der Stufe. Drei Fragen für C3:
>
> 1. Steht `enable_confirmations` auf PROD wirklich auf `true`? Gemessen über
>    `GET /v1/projects/<ref>/config/auth` — Feld `mailer_autoconfirm` muss
>    `false` sein (**invertiert**) —, nicht aus `config.toml` gelesen.
> 2. Sieht ein frisch **bestätigtes** Konto ohne Stufe weiterhin das ganze
>    Verzeichnis? Wenn ja, ist dieser Befund **offen**, nicht gelöst.
> 3. Falls offen: entweder in die Datenschutzhinweise und `is_public` sichtbar
>    in die Profil-Einstellungen (der einzige Schutz, und er liegt beim
>    Mitglied) — oder `profiles_public` nach Stufe gaten.
>
> Reproduzierbar ohne Konto: SQL-Sitzung mit `set local role authenticated` und
> gesetzten `request.jwt.claims`, dann
> `select count(*) from public.profiles_public`.

---

## Befund 2 — Der `avatars`-Bucket ist öffentlich lesbar

**Schweregrad: NIEDRIG** · betrifft beide Projekte

`storage.buckets.avatars` trägt `public = true`. Wer eine Avatar-URL hat, kann
sie ohne Anmeldung abrufen. Die Dateinamen sind `<uuid>/avatar.png` — nicht
erratbar, aber die URLs stehen in `profiles_public.avatar_url` und damit für
jedes eingeloggte Konto bereit (siehe Befund 1).

Praktisch heißt das: **Profilbilder sind öffentlich**, auch die von Mitgliedern,
die `is_public = false` gesetzt haben — sobald ihre URL einmal irgendwo stand.

Schreibend ist der Bucket sauber: die drei Policies binden auf
`(storage.foldername(name))[1] = auth.uid()`, gemessen am 2026-08-05 gegen PROD
(eigener Ordner erlaubt, fremder abgelehnt).

**Fix, falls gewünscht** — Bucket auf privat und signierte URLs:

```sql
update storage.buckets set public = false where id = 'avatars';
-- danach im Frontend createSignedUrl() statt getPublicUrl()
```

Das ist ein Frontend-Eingriff und gehört nicht in C4. Als Nachlauf notieren.

---

## Was dieser Audit _nicht_ geprüft hat

- **Den HTTP-Weg.** Alle Proben liefen über SQL-Sitzungen mit gesetzter Rolle
  und `request.jwt.claims`, nicht über PostgREST mit echtem JWT. Das prüft die
  Policies und Grants — also die Sicherheitsgrenze —, nicht die Gateway-Schicht
  davor. Ein echtes JWT bräuchte ein Passwort; das benutzt Claude nicht.
- **Die Signup-Probe des Skills** (`POST /auth/v1/signup`) wurde **bewusst nicht**
  gefahren: sie hätte ein echtes Konto auf PROD angelegt. Die Frage, die sie
  beantwortet, ist stattdessen auf SQL-Ebene beantwortet — siehe Befund 1.
- **Edge Functions** über ihre Ablehnungspfade hinaus (Task 10.3).
- Alles außerhalb der Datenschicht: XSS, CSRF, Geschäftslogik, Infrastruktur.

## Eine Korrektur in eigener Sache

Die erste Sichtbarkeitsmessung war **falsch** und hätte fast einen Fehlbefund
erzeugt. Sie zählte alle Tabellen in _einer_ Transaktion; nach der ersten
Verweigerung war die Transaktion abgebrochen, und jede weitere Zeile meldete
„verweigert". Das Ergebnis las sich wie „anon sieht nichts" — tatsächlich sieht
`anon` ein Event und fünf Beiträge, wie vorgesehen.

Aufgefallen ist es nur, weil das Ergebnis der Policy widersprach, die daneben
stand. Wiederholt mit eigener Transaktion je Tabelle; alle Zahlen oben stammen
aus dem zweiten Lauf.

Das ist dieselbe Lehre wie beim Migrations-Gate am selben Tag: **ein
Messergebnis, das „nichts gefunden" sagt, muss belegen können, dass es messen
konnte.**
