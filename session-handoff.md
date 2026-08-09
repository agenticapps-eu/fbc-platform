# Session Handoff — 2026-08-09 (26. Session)

## Stand in einem Satz

**C3 (`member-activation-flow`, AGE-495) ist inhaltlich fertig** — `tasks.md` hat
keinen offenen Punkt mehr, PR **#147** steht auf `donald/age-495-c3-restbefunde`.
Offen sind nur noch **Merge** und **Archivieren**.

## Accomplished

| Was | Beleg |
| --- | --- |
| F1 behoben | `/onboarding` hinter `ActivationGate`; RED 1 failed → GREEN 10 passed |
| F2 behoben | `activationLookupFailed` trennt „warte noch" von „aufgegeben"; RED 2 failed → GREEN, plus Abwesenheits-Test als Löschprobe |
| Testlücke `redeem-activation` | `redeem.ts` herausgelöst, 6 Tests auf einer **Aufrufliste**; falsch sortierte Fassung → 3 von 6 fielen |
| Testlücke `storage.objects` | 11 Assertions, beide Richtungen, `plan(184)` → `plan(195)`; live entferntes Gate → genau 4 Sperr-Assertions fielen |
| CI-Lücke geschlossen | `deno check`-Schritt: `deno test` importiert die `index.ts` nie, ein Verdrahtungsfehler käme grün durch |
| Spec-Deltas | 14.9 Zeitkanal als Anforderung · 14.10 Zahlen (60 s, 5/24 h, 20/h) aus den Migrationen gelesen · 14.6 Begründung ersetzt · 14.8 zwei neue Capability-Deltas |
| 12 Backlog-Issues | AGE-511 … AGE-522, jedes mit Herkunftsverweis |
| Unabhängige Diff-Prüfung | ohne Befund |
| Belege | vitest 471 · deno 70 · pgTAP `Files=3, Tests=215 PASS` · validate 29/29 · eslint 0 Fehler |

## Decisions

- **14.6 — die Drossel behält ihre Eigenschaft, die Begründung geht.** „Lastfläche"
  trug nicht: weil erst beansprucht und dann gezählt wird, kostet jeder
  Fehlversuch vor der Grenze *mehr* Arbeit. Kein Code — der Befund war eine
  Falschaussage über den Ablauf, kein Fehler in ihm. Eine Sperre **vor** dem
  Beanspruchen ist in der Spec jetzt ausdrücklich untersagt.
- **12.10/14.8 — das Gate gewinnt.** Ein unbestätigtes Konto meldet sich zu
  nichts an, auch nicht zu einem öffentlichen Event. Grund: die Alternative wäre
  **ein** ungegateter Schreibweg in Mitgliederdaten. Die Verhaltensänderung steht
  als Szenario in den Deltas, nicht als Behauptung. Produktfrage → AGE-514.
- **10.4 — mit dem Belegten geschlossen.** Platzierung bei GMX/Web.de/Outlook und
  die Reputation der ungewärmten Domain gehören zu AGE-256; drei weitere
  Abnahmen hätten drei weitere Wegwerf-Konten in der Live-DB bedeutet.
- **9.1/9.2 und 10.3 aus C3 herausgenommen.** Der Mailtext ist an zwei echten
  Mails belegt und geht so live; das PROD-Projekt ist leer und die Live-Seite
  läuft gewollt gegen `foelowldexkcqzewvrcf`.
- **Der Kopf von `20260806110000` wird NICHT nachträglich umgeschrieben**, obwohl
  er die überholte 14.6-Begründung trägt. Eine angewandte Migration ist ein
  datiertes Protokoll, kein Dokument. Maßgeblich ist ab hier die Spec.

## Files modified

- `src/App.tsx`, `src/App.test.tsx` — `/onboarding` hinter das Gate, zwei Tests
- `src/components/ActivationGate.tsx`, `.test.tsx` — Aufgeben-Lage mit Meldung
- `src/providers/AuthProvider.tsx`, `auth-context.ts`, `src/test/auth-fixtures.tsx` — `activationLookupFailed`
- `supabase/functions/redeem-activation/{index,redeem,redeem.test}.ts` — Logik herausgelöst, sechs Tests
- `supabase/tests/rls_test.sql` — 13.3a + Gegenprobe in 13.10, `plan(195)`
- `.github/workflows/ci.yml` — `deno check`-Schritt
- `openspec/changes/member-activation-flow/` — access-control-Delta, zwei neue
  Deltas (`directory-search`, `events`), `tasks.md` mit Abschnitt 15

## Next session: start here

**Erste Handlung: `gh pr view 147 --json state,statusCheckRollup` lesen.** War CI
grün und ist #147 gemergt, folgt sofort **`openspec archive member-activation-flow`**
auf einem eigenen Branch (Muster: `donald/age-496-archive`) — die vier Deltas
falten dann in `openspec/specs/`. Ist #147 noch offen, zuerst mergen und den
`state` prüfen, **nicht** die leere Ausgabe von `gh pr merge`.

Achtung beim Archivieren: es schreibt in `access-control`, `member-profiles`,
`directory-search` und `events`. Die letzten beiden sind neu in diesem Change —
danach einmal `openspec validate --all` und einen Blick darauf, dass die
`events`-Requirements nicht doppelt stehen.

Danach ist **AGE-505** (`password-reset-flow`) der nächste Change; seine Gruppe 7
hängt weiter an Donalds Sichtprobe am echten Konto (siehe Open questions).

## Open questions

- **6.3/6.4 von AGE-505 brauchen Donald** am echten aktivierten Konto:
  `/passwort-vergessen` → Mail → `/passwort-neu` → Anmeldung. Mitschnitt leeren →
  handeln → Netzwerk lesen → Screenshot.
- **CRITICAL, unverändert (AGE-512):** Stripe- und Resend-Secrets byte-identisch
  zwischen DEV und PROD. Braucht dich im Stripe-Dashboard.
- **Die neue Fehlermeldung aus F2 ist nicht im Browser gesehen worden**, nur im
  Test. Sie übernimmt Aufbau und Klassen von `ErrorFallback.tsx` eins zu eins,
  das Risiko ist klein — aber gemessen ist es nicht.
- **Der lokale Supabase-Stack läuft noch** (vom pgTAP-Lauf). Solange er läuft,
  ist `pnpm lint` lokal rot wegen `supabase/.temp/start-secrets/`; CI sieht das
  nicht.

## Fallen

Unverändert: `git add -A` verboten · `ls` ist `eza`-Alias · `supabase test db`
ohne Dateiliste lügt · zustandsändernde git-Befehle nie pipen · `202` belegt
keinen Versand · nur `check-runs` auf der HEAD-SHA zählt · `gh pr merge` gibt
keine Ausgabe, nur `state` zählt · `drift-gate` blockt nach `migrate-dev` jeden
Deploy bis `migrate-prod` · zwei Checks heißen „deploy".

**Neu aus dieser Sitzung:**
- `storage.objects` hat **keine SELECT-Policy**; ein `where` in UPDATE/DELETE
  trifft deshalb 0 Zeilen, auch bei `using (true)`. Plus `storage.protect_delete()`,
  ein BEFORE-STATEMENT-Trigger, der jedes direkte DELETE blockt. Beides tarnt
  sich als bestandener RLS-Test.
- **`deno test` typprüft nur, was ein Test importiert** — nie die `index.ts`.
  Jetzt durch `deno check` in CI gedeckt.
- eslints `no-unused-vars` greift bei Deno-Test-Attrappen erst ab dem **letzten
  benutzten** Parameter; ein `_`-Präfix rettet nicht, das Weglassen schon.
