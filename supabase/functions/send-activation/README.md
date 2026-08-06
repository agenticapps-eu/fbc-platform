# send-activation

Verschickt den Aktivierungslink — AGE-495 / C3. Spec:
[`openspec/changes/member-activation-flow/`](../../../openspec/changes/member-activation-flow/).

Aufruf: `POST` mit `{ "email": "…" }`. Antwortet **immer** `202 {accepted:true}`.

## Warum `verify_jwt = false` — und warum trotzdem kein JWT gelesen wird

Die Function muss **ohne Sitzung** erreichbar sein. Gemessen am 2026-08-05: Wer
das verteilte Passwort hat, kann es über den Anmeldedienst ändern — ohne Token,
ohne Reauthentifizierung. Das öffnet nichts (das Gate hält), aber es sperrt das
echte Mitglied aus: Es käme an der Anmeldung nicht vorbei und erreichte den
Aktivierungsbildschirm nie, von dem aus es seinen Link anfordert.

Genau deshalb liest sie **auch kein JWT**. Bei `verify_jwt = false` prüft das
Gateway nichts; eine daraus gelesene Kennung wäre vom Aufrufer frei wählbar und
damit ein Weg, sich den Bestätigungslink eines fremden Kontos schicken zu
lassen. Ein Zweig statt zwei — und der sicherere.

Der Empfänger ist immer die **hinterlegte** Login-Adresse, die die Datenbank
zurückgibt, nie die im Aufruf mitgegebene.

## Warum die Antwort immer gleich aussieht

`202` in jedem Fall — unbekannte Adresse, bereits aktiviertes Konto,
Ratengrenze, Erfolg. Und der Versand läuft **nach** der Antwort
(`EdgeRuntime.waitUntil`). Sonst antwortet eine bestehende Adresse messbar
langsamer als eine unbekannte, und die Antwortzeit wird zum Verzeichnis der
Mitgliedsadressen.

Die Adresse selbst wird nie protokolliert. Sie ist genau das Datum, das der
Change schützt.

## Token

32 Byte aus `crypto.getRandomValues` → 256 Bit, base64url. Gespeichert wird
**nur** der SHA-256-Hash; der Klartext verlässt das System ausschließlich im
Link der Mail — und dort im **Fragment**, nicht im Query-String (ein
Query-String landet in Historie, Server- und CDN-Logs und im `Referer`).

Ausgeben, Entwerten des alten Links und die Ratengrenze fallen in **eine**
Datenbankoperation (`issue_activation_token`). Zwei Round-Trips ließen zwei
gleichzeitige Anforderungen beide passieren; zusätzlich erzwingt ein
`unique`-Index höchstens ein ausstehendes Token je Profil.

Ratengrenze pro Profil: ein Versand pro 60 s, fünf pro 24 h. Sie begrenzt
zugleich die einzige benannte Belästigungsfläche — wer eine Adresse kennt, kann
den ausstehenden Link eines Mitglieds wiederholt entwerten. Ein Zugang geht
dabei nicht verloren; das Mitglied fordert einen neuen an.

## Secrets

`RESEND_API_KEY`, `FROM_EMAIL`, `APP_URL` aus Infisical (s.
[`docs/secrets.md`](../../../docs/secrets.md)). `SUPABASE_URL` und
`SUPABASE_SERVICE_ROLE_KEY` spritzt die Plattform ein.

## Tests

```bash
deno test supabase/functions/send-activation/emails.test.ts   # 12 Tests
deno check supabase/functions/send-activation/index.ts
```

Geprüft wird die reine Logik: Linkbau (Fragment statt Query-String),
Escaping, die beiden Pflicht-Sätze zur Einordnung von eff.bee.zee und FBC, die
72-Stunden-Zusage samt Entwertungshinweis — und dass **keine** Zusage im Text
steht, die nicht hält.
