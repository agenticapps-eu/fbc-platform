# Session Handoff — 2026-08-10 (27. Session)

## Stand in einem Satz

**AGE-526 ist gebaut, gegengelesen und liegt als PR #150** — die Registrierung
verschickt die Aktivierungsmail jetzt selbst. Offen ist nur noch die Abnahme mit
einer echten Adresse, das Anwenden der Migration und der Deploy.

## Accomplished

**Der Befund aus der Demo mit Detlev (2026-08-10, 15:50–15:53).** Es kam keine
Mail an, weil **nie eine angefordert wurde** — nicht, weil eine fehlschlug.

| Beleg | Wert |
| --- | --- |
| `activation_tokens` in 24 h | **0 Zeilen** |
| Gateway-Anfragen 15:30–16:10 | 952, davon **0 auf `/functions/`** |
| Detlevs Konto | `dk.email@gmx.de`, `basic`, `activated_at NULL`, Abmeldung nach 84 s |
| Versandweg | intakt: `FROM_EMAIL = FBC <noreply@effbeezee.com>` (Digest), `effbeezee.com` bei Resend `verified` |

Ursache: Die eingebaute Bestätigung ist aus (AGE-445), und der Aktivierungsweg
aus AGE-495 war für **importierte** Mitglieder gebaut. Die Selbstregistrierung
fällt hinter dasselbe Gate, aber niemand löst den Versand aus.

**Der Change `activation-mail-on-signup` (AGE-526), drei Commits auf
`donald/age-526-aktivierungsmail-bei-registrierung`:**

| Teil | Was |
| --- | --- |
| Auslöser | `AuthProvider.signUp` fordert den Link an — dort, weil die Registrierung dort entsteht |
| Ehrlichkeit | `resendActivationLink` reicht den Status durch; „unterwegs" nur bei `issued` |
| Bremse | Migration `20260810170000`: 100 Ausgaben/Stunde, **nur** für Profile jünger als 10 Minuten, `pg_advisory_xact_lock` vor der Zählung |

**Belege:** 222 pgTAP (7 neue, RED gesehen) · 486 Vitest · Typen und Lint sauber ·
Wettlauf-Sonde mit zwei Sitzungen: ohne Riegel 101 Token, mit ihm 100.

**Zwei Reviews, beide mit echten Treffern** (`REVIEWS.md`): über das Delta *vor*
der ersten Codezeile und über den Diff. gemini APPROVE, opencode/Kimi-K3 beide
Male REQUEST-CHANGES.

## Decisions

- **100 Ausgaben/Stunde**, nicht 60. Die Spec begründet den eigenen Mailversand
  mit „siebzig Mitglieder an einem Abend"; 60 hätte genau diesen Fall verfehlt.
- **Die Grenze greift nur für Profile jünger als 10 Minuten.** Eine Grenze für
  alle machte aus dem Missbrauch eine Aussperrung. Der Preis steht in der
  Anforderung: Bei vollem Kontingent wartet ein Neuling zehn Minuten — verzögert,
  nicht verschlossen.
- **Nicht „plattformweit".** Der Admin-Weg zählt hinein, wird aber nicht
  gebremst. Die erste Fassung des Deltas versprach mehr, als sie baute.
- **Ein Flag `automatisch` im Anfragerumpf ist verworfen** — das setzt der
  Angreifer selbst. Prüfbar ist nur das Alter des Profils.
- **AGE-517 bleibt offen**, bewusst: Wer wartet, steht wieder beim
  Zwei-Anfragen-Weg. Eine Grenze je IP ist dort weiter zu bauen.

## Files modified

- `supabase/migrations/20260810170000_activation_stundenkontingent.sql` — neu
- `supabase/tests/rls_test.sql` — 7 Assertions, `plan(195)` → `plan(202)`
- `scripts/probe-kontingent-wettlauf.ts` — neu, Laufzeitbeleg für den Riegel
- `src/providers/AuthProvider.tsx` · `auth-context.ts` — Auslöser + getaggter Status
- `src/lib/activation.ts` — `ResendStatus`, Status statt `void`
- `src/pages/ActivationScreen.tsx` — je Ausgang eine wahrheitsgemäße Meldung
- `src/pages/LoginPage.tsx` — unerreichbarer Hinweis samt `info`-Variable entfernt
- `openspec/changes/activation-mail-on-signup/` — proposal, design, Delta, tasks, REVIEWS

## Next session: start here

**Der erste Schritt gehört Donald: Task 6.1.** Auf DEV registrieren mit einer
**echten Fremdadresse** und nachsehen, ob der Link im Postfach liegt — ein `202`
und ein grüner Bildschirm belegen das nicht. Dafür muss vorher `migrate-dev`
laufen. Danach 6.2 (Link einlösen), dann 6.3 (Dry-Run für PROD **lesend** prüfen,
erst dann `migrate-prod`) und 6.4 (Live-Stand am ausgelieferten Bundle messen).
Erst nach dem Ausrollen wird der Change archiviert.

## Open questions

- **Ist die Zustellung an eine Fremdadresse belegt?** Bisher nur: Domain
  verifiziert, Absender richtig. Nicht: Link im Postfach eines Dritten.
- **Die beiden Demo-Konten** (`donald+test@factiv.eu`, `dk.email@gmx.de`) liegen
  unbestätigt in der Live-DB. Nachträglich einen Link schicken oder löschen?
  Gehört zu AGE-522.
- **Zwei Sichtprobe-Konten** liegen im **lokalen** Stack (`sichtprobe-age526@…`,
  `sichtprobe2-age526@…`). Wegwerf, ein `supabase db reset` räumt sie.
- **CRITICAL, unverändert (AGE-512):** Stripe- und Resend-Secrets byte-identisch
  zwischen DEV und PROD.

## Fallen

Unverändert: `git add -A` verboten · `ls` ist `eza`-Alias · `supabase test db`
ohne Dateiliste lügt · zustandsändernde git-Befehle nie pipen · `202` belegt
keinen Versand · nur `check-runs` auf der HEAD-SHA zählt · `migrate-prod`
dispatchen heißt anwenden.

**Neu aus dieser Sitzung:**

- **Ein Test mit vorbelegtem Kontext prüft die falsche Zeitachse.** Der Status
  des automatischen Versands trifft ein, NACHDEM der Bildschirm steht —
  `useState(wert)` nimmt ihn dann nie an. Grün im Test, kaputt im Browser.
  Gefunden hat es die Sichtprobe am laufenden System, nicht die Testsuite.
- **`react-hooks/set-state-in-effect` hatte beide Male recht.** Was aussieht wie
  „Zustand beim Wechsel räumen", ist fast immer eine Ableitung: den Wert mit der
  `userId` taggen, zu der er gehört, so wie `profile` es in derselben Datei tut.
- **Ein Reviewer, der den echten Quelltext liest, findet anderes als einer, der
  nur den Diff bekommt.** opencode/Kimi-K3 fand beide Male die teuersten
  Befunde, weil es die Nachbardateien mitgelesen hat.
- **`supabase functions serve` mit absichtlich ungültigem Resend-Schlüssel** ist
  der saubere Weg, den Versandpfad lokal zu prüfen, ohne eine Mail zu erzeugen —
  das Token entsteht trotzdem, und genau das ist die Assertion.
- **`gh api …/check-runs` braucht eine Warteschleife**, kein `sleep` davor: Der
  Harness blockt führende Sleeps.
