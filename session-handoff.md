# Session Handoff — 2026-08-06 (13. Session)

## Stand in einem Satz

**C3 (AGE-495) ist gemergt, migriert und deployt — aber noch nicht benutzbar:
die drei Aktivierungs-Functions sind nirgends deployt.** Der
Aktivierungsbildschirm ist live und erklärt sich, sein Knopf läuft ins Leere.

## Der eine Satz, der zählt

Ich habe in dieser Sitzung zwischendurch „die Lücke ist zu" gesagt. **Das war zu
früh.** Gemessen mit `supabase functions list --project-ref foelowldexkcqzewvrcf`:
dort liegen nur `notify-contact-request`, `create-checkout-session` und
`stripe-webhook`. `send-activation`, `resend-activation` und `redeem-activation`
sind **nicht deployt**.

| Zustand für ein nicht aktiviertes Konto | vorher | jetzt  | nach Schritt 4 |
| --------------------------------------- | ------ | ------ | -------------- |
| Sieht eine Erklärung                    | nein   | **ja** | ja             |
| Kann sich abmelden und stöbern          | nein   | **ja** | ja             |
| Kann einen Link anfordern               | nein   | nein   | **ja**         |
| Kann aktivieren                         | nein   | nein   | **ja**         |

Besser als heute Morgen, fertig ist es nicht.

## Next session: start here

**1. PR #127 mergen, wenn grün.** Nur Kommentar + Handoff, kein Verhalten.
`gh pr checks 127`, dann `gh pr merge 127 --squash --delete-branch`, danach
**`gh pr view 127 --json state`** gegenprüfen — `gh pr merge` kann still
fehlschlagen.

**2. Schritt 4 — Functions deployen und den Weg zum ersten Mal wirklich gehen**
(Tasks 10.2 und 8.3, die letzten offenen Abnahmeschritte).

```bash
# Ziel ist foelowldexkcqzewvrcf — bis zum Import DAS Projekt der Live-Seite.
supabase functions deploy send-activation   --project-ref foelowldexkcqzewvrcf
supabase functions deploy resend-activation --project-ref foelowldexkcqzewvrcf
supabase functions deploy redeem-activation --project-ref foelowldexkcqzewvrcf
supabase functions list --project-ref foelowldexkcqzewvrcf   # gegenprüfen
```

`verify_jwt` steht je Function in `supabase/config.toml` und ist Absicht:
`resend-activation` **true** (Subjekt ist die Sitzung), die beiden anderen
**false** (das Token trägt die Identität). Nach dem Deploy prüfen, dass die
Liste das auch so zeigt.

Secrets sind da (am 06.08. gemessen): `APP_URL`, `FROM_EMAIL`, `RESEND_API_KEY`.

Danach **8.3**: die sieben Fehlerfälle von Hand, protokolliert. Vier brauchen
einen echten Versand — abgelaufen, schon benutzt, überholt (`superseded`),
gedrosselt (`throttled`, ab dem 21. Fehlversuch je IP und Stunde). Drei sind
beim Betrachten der Oberfläche schon abgehakt.

**Für PROD (`viwntbodrtqxgmqyxluh`) sind die Functions ebenfalls nicht deployt.**
Das ist Task 10.3 und braucht Donalds Freigabe — zusammen mit der Secret-Frage
unten.

## Accomplished

- **5.6/12.6** Drossel auf `redeem-activation`: Migration `20260806110000`
  (`activation_attempts`, RLS an, keine Policy, kein Grant; RPC
  `note_failed_activation` nur für `service_role`). Gezählt werden nur
  **Fehlversuche**, und erst **hinter** dem Beanspruchen — ein gültiges Token
  wird nie abgewiesen. pgTAP-Plan 140 → 148.
- **12.7/12.8** vier `member-profiles`-Requirements als MODIFIED; „genau eine
  privilegierte Funktion" auf die **Datenklasse** eingegrenzt statt auf eine Zahl.
- **8.8** Review-Runde 4 (codex, opencode, gemini): 2× REQUEST-CHANGES, 1×
  APPROVE. Vier Befunde behoben, einer widerlegt, fünf offen — `tasks.md` Block 14.
- **13.4** `stripe-webhook` prüfte `payment_status` nicht (bei SEPA/Überweisung
  kam die Stufe beim **Anstoßen** des Kaufs) · `notify-contact-request` prüfte
  `record` nicht gegen die Tabelle · `public/_headers` neu · `.gitignore` um
  Schlüsselmuster. Sieben Deno-Tests, sechs vorher rot.
- **CI/CD** 15 `uses:` auf SHA · `dependabot.yml` um npm · `wrangler` ins
  Lockfile · `-E` aus `curl | sudo bash` · **`edge-functions` als Pflicht-Check**.
- **PR #120 gemergt**, `migrate-prod` brachte die fünf Migrationen auf PROD,
  Deploy nachgefahren und **am echten Bundle** verifiziert (`index-DGHj5bBj.js`
  auf Deploy-URL _und_ Apex, mit `my_activation_state` / `aktivierung` /
  `throttled`; fünf Sicherheits-Header live; `/aktivierung` mit `no-referrer`).

## Decisions

- **Drossel-Subjekt:** IP, aber nur Fehlversuche, Zählung hinter dem Claim.
  Preis: ein Zähler, keine Lastbremse — siehe 14.6.
- **Volle CSP nicht ausgeliefert.** `_headers` trägt nur `frame-ancestors` — die
  Direktive, die nichts brechen kann. Als 13.5 festgehalten.
- **`curl | sudo bash` bleibt.** Infisical verteilt die CLI über den eigenen
  Artefaktserver, ihre GitHub-Releases tragen keine Assets (nachgemessen).
- **Zurückgezogen (Donald, 06.08.):** das fehlende `production`-Environment ist
  **entschieden**, nicht vergessen (`migrate-prod.yml`, Kommentar über `apply:`),
  und die Secrets liegen in Infisical. Ich hatte Audit-Befunde ungeprüft
  weitergetragen.

## Open questions

- **CRITICAL, unverändert:** `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` und
  `STRIPE_SECRET_KEY` sind zwischen DEV und PROD byte-identisch. Wer den
  DEV-Wert hat, fälscht ein `checkout.session.completed` an die PROD-Function
  und setzt jede `user_id` auf `impact`. Braucht Donald im Stripe-Dashboard;
  Details im Commit `2e4ecce` dieser Datei.
- **14.6** Die Drossel ist ein Zähler, keine Bremse (opencode, und er hat recht).
  Wer Last sparen will, muss vor dem Claim sperren — und nimmt in Kauf, dass ein
  Mitglied hinter einer verbrannten IP mit gültigem Link abgewiesen wird. Die
  Begründung in der Spec sagt heute „Lastfläche" und trägt so nicht.
- **14.7** Mail-Missbrauch: die Grenze sitzt je Profil, Signup ist offen ⇒
  beliebig viele Profile, beliebig viele Mails. Trifft AGE-256.
- **14.8 / 12.10** `directory-search` und `events` sagen in der durable Spec noch
  Zugriff ohne Aktivierung zu; hängt an der AGE-448-Entscheidung mit Detlev.
- **9.1** Mailtext an Detlev — blockiert die Rundmail und damit den Import.
- **6.4 war falsch abgehakt.** `Referrer-Policy: no-referrer` stand nirgends.
  Lohnt einen Blick, ob weitere Häkchen so entstanden sind.

## Fallen

Unverändert: `git add -A` verboten · `ls` ist `eza`-Alias · `supabase test db`
ohne Dateiliste lügt · Policies zählen, nicht greppen · Merge mit `state=MERGED`
gegenprüfen · Infisical-Login braucht ein echtes Terminal (kein TTY hier).

**Neu aus dieser Sitzung:**

- In `cmd | tail` ist der Exit-Code der von `tail`. Ein
  `git checkout … | tail && git cherry-pick …` lief deshalb auf dem alten Branch
  weiter, obwohl das Checkout abgebrochen war. Git-Ketten nie pipen.
- **Deploy-Erfolg ≠ Code live.** Der Workflow war grün, die Apex lieferte noch
  das alte Bundle. Immer am Bundle prüfen: Hash aus `index.html` holen, Datei
  laden, nach einem Bezeichner greppen, den nur der neue Stand hat.
- **GitHub liefert Job-Logs erst nach Ende des ganzen Runs.** „Ich lese den
  `plan`, bevor `apply` läuft" ist über die CLI nicht einlösbar.
- Cloudflare **ersetzt** eine globale Header-Regel auf einer Route nicht, es
  **hängt an** — `/aktivierung` liefert zwei `referrer-policy`-Header. Korrekt
  (letzter gültiger gewinnt), sieht aber nach Fehler aus.
