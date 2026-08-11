# Session Handoff — 2026-08-11 (28. Session)

## Stand in einem Satz

**C3 ist abgeräumt, inklusive seiner beiden Nachläufer und AGE-511.** `main`
steht auf `6ab8206d`, **kein PR offen**, aktiver OpenSpec-Change ist nur noch
`password-reset-flow` neben den acht schlafenden. **Als Nächstes kommt C6 —
Donald gibt den Auftrag in einer frischen Session.**

## Accomplished

**AGE-526 — die Registrierung verschickt die Aktivierungsmail selbst.** Der
Befund kam aus der Demo mit Detlev: Es war keine Mail fehlgeschlagen, es hatte
nie jemand eine angefordert (0 Token in 24 h, 0 von 952 Gateway-Anfragen auf
`/functions/`). Dazu eine Grenze von 100 Token-Ausgaben je Stunde für Profile
jünger als 10 Minuten, serialisiert per `pg_advisory_xact_lock`. Auf DEV **und**
PROD angewandt, am Live-Bundle gemessen, archiviert (#155).

**AGE-527 — das Passwort entsteht nach der Bestätigung.** Zwei UX-Befunde aus
Donalds erstem vollständigen Durchlauf: Das Passwort wurde zweimal abgefragt, und
das Setzen endete wortlos auf dem Login. Jetzt kein Passwortfeld bei der
Registrierung (Zufallswert aus dem CSPRNG) und ein Erfolgsschirm mit Knopf und
angekündigtem Zähler, im Wortlaut des jeweiligen Zwecks. Ausgerollt, archiviert
(#156).

**AGE-511 — PROD nachgezogen, dabei eine Live-Lücke gefunden.** Migrationen
synchron, alle 22 Secrets vorhanden, 5 von 6 Functions byte-identisch. Die
sechste, `notify-contact-request`, lief auf **beiden** Projekten in einer
Fassung, die älter war als die AGE-495-Härtung — auch auf DEV, das die Live-Seite
bedient. Auf beide ausgerollt, Digests stimmen jetzt überein.

**Elf PRs gemergt:** #150, #152, #121, #144, #153, #124, #125, #126, #154, #155,
#156. Dabei die Arbeit auf `chore/remove-axiom` committet und als PR eröffnet —
sie lag uncommittet im Baum und war nicht grün (`TS6133` auf ungenutztem `env`).

## Decisions

- **100 Ausgaben/Stunde, nicht 60.** Die Spec begründet den eigenen Mailversand
  mit „siebzig Mitglieder an einem Abend"; 60 hätte genau das verfehlt.
- **Die Grenze greift nur für Profile jünger als 10 Minuten.** Eine Grenze für
  alle machte aus dem Missbrauch eine Aussperrung. Der Preis — Neulinge warten im
  Missbrauchsfall zehn Minuten — steht in der Anforderung, nicht nur im Code.
- **Nicht „plattformweit".** Der Admin-Weg zählt ins Kontingent, wird aber nicht
  gebremst; eine größere Zusage hätte an einer Stelle versprochen, wo nichts
  gebaut ist.
- **Kein Passwort bei der Registrierung**, statt es beim Einlösen zu
  überspringen: ein Weg statt zwei, wie bei importierten Mitgliedern.
- **AGE-512 und AGE-517 bleiben liegen** (Donald), **AGE-522** wird mit der
  Migration in der letzten Phase geschlossen.

## Files modified

Alles gemergt. Arbeitsbaum sauber, `main` aktuell.

## Next session: start here

**C6.** Donald bringt den Auftrag mit — vorher nichts anfangen. Die offenen
C3-Nachläufer (AGE-512 bis AGE-522, ohne 511) sind bewusst im Backlog geparkt.

**Der lokale Dev-Server läuft weiter**, abgekoppelt von der Aufgabenverwaltung:
Vite auf `http://localhost:5173` (PID 17936), Edge Functions (PID 17937) mit
**absichtlich ungültigem Resend-Schlüssel** — beim Herumklicken geht keine echte
Post raus. Beenden mit `kill 17936 17937`.

## Open questions

- **AGE-512 (CRITICAL, unverändert):** Stripe- und Resend-Secrets byte-identisch
  zwischen DEV und PROD. Braucht Donald im Stripe-Dashboard.
- **Die Anmeldung mit Donalds Passwort auf `donald@factiv.eu`** ist nie gemessen
  worden; `last_sign_in_at` trägt die automatische Anmeldung der Registrierung.
  Der Schritt selbst ist mit `age527@test.fbc` vollständig durchgespielt.
- **`app.fairbusinessclub.de` löst nicht auf** — kein DNS-Eintrag. Live ist
  `fbc-platform.pages.dev`. Gehört zu AGE-256.
- **Testkonten** liegen in der Live-DB (AGE-522) und im lokalen Stack.

## Fallen

Unverändert: `git add -A` verboten · `ls` ist `eza`-Alias · `supabase test db`
ohne Dateiliste lügt · zustandsändernde git-Befehle nie pipen · `202` belegt
keinen Versand · nur `check-runs` auf der HEAD-SHA zählt · `migrate-prod`
dispatchen heißt anwenden.

**Neu aus dieser Sitzung:**

- **`deno.lock` spiegelt die `package.json`** (480 npm-Pakete unter
  `workspace.packageJson.dependencies`). Jeder npm-Bump macht sie unter
  `--frozen` ungültig, und `edge-functions` ist ein **Pflicht-Check**. Dependabot
  weiß davon nichts — die Lockdatei gehört in jeden Paket-PR nachgezogen.
- **`main` verlangt `strict: true`.** Jeder PR muss vor dem Merge auf den Stand
  gebracht werden; Merges sind damit zwangsläufig seriell.
- **Ein roter Check kann veraltet sein.** Die Dependabot-PRs zeigten Ergebnisse
  gegen ein `main`, das es nicht mehr gab. Erst nach dem Aktualisieren misst man
  die Gegenwart — vorher behebt man womöglich das Falsche.
- **Der `functions`-CI-Job rollt nur GEÄNDERTE Functions aus.** Fällt der Lauf
  aus, wird die Änderung nie nachgeholt. Und Versionszähler zählen Deploys, nicht
  Inhalte — vergleichbar ist nur `ezbr_sha256`. `functions download` scheitert
  hier in beiden Varianten.
- **Ein Test mit vorbelegtem Context prüft die falsche Zeitachse.** Trifft der
  Wert erst nach dem Mount ein, nimmt `useState(wert)` ihn nie an: grün im Test,
  kaputt im Browser. Gefunden hat es die Sichtprobe, nicht die Testsuite.
- **`gh pr merge` bei `mergeStateStatus = UNKNOWN`** tut still nichts. Erst auf
  einen anderen Zustand warten, dann mergen, dann `state` prüfen.
- **Ein Grep kann bestätigen, was nicht da ist.** Beim Live-Check traf ein alter
  Satz auf einer anderen Seite dieselbe Wortfolge; erst ein eindeutiger Marker
  zeigte, dass noch das alte Bundle auslieferte.
