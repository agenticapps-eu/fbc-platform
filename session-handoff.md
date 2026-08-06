# Session Handoff — 2026-08-06 (14. Session)

## Stand in einem Satz

**Der Aktivierungsweg funktioniert — zum ersten Mal Ende zu Ende, an einer
echten Mail belegt.** Zwei Startblocker steckten darin, beide unsichtbar im
Code, beide heute gefunden und geschlossen.

## Die zwei Blocker

|                   | war                                                                                        | ist                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **10.5** Absender | `FROM_EMAIL` = Resends Sandkasten `onboarding@resend.dev` → **403 an jede fremde Adresse** | `effbeezee.com` in Resend verifiziert, `FBC <noreply@effbeezee.com>` |
| **10.8** Link     | `APP_URL` = `http://localhost:5173` → jede Mail verlinkte auf den Rechner des Empfängers   | `https://fbc-platform.pages.dev`                                     |

Beide hätten den Import (C10) in ein Feld lauter gesperrter Konten laufen
lassen: bei importierten Konten ist das Gate die einzige Hürde, und die Mail
der einzige Weg hindurch. **Beide sahen im Code richtig aus** — die Werte waren
gesetzt, die Prüfungen bestanden. `send-activation` antwortet bauartbedingt
immer `202` (Anti-Aufzählung), der Fehlschlag war also von außen unsichtbar.
Der ehrliche Status kommt von `resend-activation`.

C10 trägt deshalb jetzt **fünf** Vorbedingungen statt drei (11.2).

## Accomplished

- **PR #127 gemergt** (`state=MERGED` gegengeprüft).
- **Die drei Aktivierungs-Functions deployt**, `verify_jwt` gegen `config.toml`
  geprüft (false/true/false).
- **Das Gate hält in Produktion**: frisch registriertes, nicht aktiviertes
  Konto → **14 Tabellen, null Zeilen**, einschließlich der eigenen Daten
  (`profile_contacts`, `goals`, `notifications`, `compass_responses`,
  `member_settings`). Gegenprobe: ausgeloggt weiter 5 Beiträge + 1 Event.
  Nach dem Einlösen: `profiles_public` **37**, `posts` 5, `events` 9.
- **8.3 vollständig** — alle sieben Fehlerfälle gemessen. Fünf gegen die live
  deployten Functions, zwei (`expired`, `superseded`) gegen eine lokal
  servierte, weil sie einen DB-Eingriff brauchen.
- **Ein falsches Häkchen gefunden** (Nachlauf zu 6.4): Task 3.9 verlangt acht
  Assertions, im Test standen drei — UPDATE/DELETE waren auf beiden Rollen
  ungeprüft. Ergänzt, `plan(148) → plan(153)`, vorher rot gemessen. Der übrige
  Nachlauf ist sauber (5.4/6.6, 7.1, 7.3, 7.5, 4.7, 13.1, 2.5, 1.4, 3.10).
- **DNS für `effbeezee.com`** eingerichtet und am Rohtext der Mail abgenommen:
  Googles Hop meldet `dkim=pass header.i=@effbeezee.com`, `spf=pass` über
  `send.effbeezee.com`, `dmarc=pass (p=REJECT)`.
- **Der `APP_URL`-Fix repariert nebenbei `notify-contact-request`** — die „Zum
  Chat"-Links zeigten seit jeher auf localhost. War nie Teil von AGE-495.
- **CRITICAL ausgezählt statt geschätzt:** 12 von 22 Secrets byte-identisch.
  Die 10 „getrennten" täuschen — fast alle sind projektgebundene `SUPABASE_*`.
  Bewusst getrennt sind **drei**. Alles von Hand Gepflegte (Stripe komplett,
  `RESEND_API_KEY`) ist geteilt.

## Decisions

- **Absenderdomain `effbeezee.com`** (Donald/Detlev). Auf Strato-NS, also selbst
  pflegbar; `fairbusinessclub.de` liegt auf Cloudflare-NS beim Betreuer der
  WordPress-Seite.
- **`FROM_EMAIL = FBC <noreply@effbeezee.com>`**, `Reply-To` fest verdrahtet auf
  `info@fairbusinessclub.de` — der Bildschirm sagt eine ankommende Antwort zu.
- **Testkonten bleiben stehen** (Donald). `donald@vlahovic.de` (aktiviert, im
  Verzeichnis) und `donald.vlahovic@gmail.com`. **Kein Mitglied** — beide zählen
  in die 50er-Schwelle der Tripwire aus 1.7 und müssen bei 12.1 abgezogen werden.

## Ich lag falsch — zweimal am selben Punkt

Ich habe zweimal gewarnt, `effbeezee.com` sei eine fremde Domain neben dem
Auftritt des Clubs, und daraus eine Phishing-Sorge abgeleitet. **Falsch.** Der
Betreff heißt „Dein Zugang zu eff.bee.zee", und `emails.ts:63,82` führen den
Namen seit langem selbst ein: die Plattform _heißt_ so. Der Bildschirmtext, den
ich daraufhin schrieb („die Adresse sieht ungewohnt aus"), entschuldigte sich
für die eigene Marke und ist wieder raus. Die Assertion bleibt — falsch war die
Begründung, nicht die Prüfung.

## Files modified

- `supabase/tests/rls_test.sql` — fünf Assertions ergänzt, `plan(153)`
- `src/pages/ActivationScreen.tsx` / `.test.tsx` — Absender genannt, Test dazu
- `supabase/functions/{send,resend}-activation/index.ts` — `Reply-To`
- `docs/secrets.md` — Sandkasten-Hinweis als **widerlegt** gekennzeichnet
- `openspec/changes/member-activation-flow/tasks.md` — 10.5–10.8 neu, 8.3, 11.2

## Next session: start here

**PR #128 prüfen und mergen** (`gh pr checks 128`, dann merge, danach
`gh pr view 128 --json state` gegenprüfen — `gh pr merge` kann still
fehlschlagen). Danach ist AGE-495 inhaltlich fertig bis auf 8.7 (unabhängiges
Code-Review) und die Entscheidungen unten.

**Achtung: CI ist auf dem letzten Stand ungelaufen, und das ist nicht das
Repo.** Der jüngste Lauf steht auf `fc560e8`; die vier Commits danach
(`4cef2cd`, `87482a4`, `7762624`, `4d638ab`) haben **null** Check-Runs —
`gh api repos/…/commits/4d638ab/check-runs` meldet `total_count: 0`.
Ursache gemessen: **GitHub Actions hatte am 06.08. abends einen
`major_outage`** (`githubstatus.com/api/v2/components.json`). Kein Pfad-Filter,
kein `concurrency`-Block in `ci.yml`, Actions ist aktiviert. Also: erst
nachsehen, ob Läufe inzwischen nachgekommen sind — notfalls mit einem leeren
Commit oder `gh workflow run` anstoßen —, **nicht** blind mergen und **nicht**
nach einem Fehler im Repo suchen.

_Und eine zweite Fehlspur, die ich schon ausgeschlossen habe: der Lauf auf
`1d577ca` steht als `failure` in der Liste. Das waren **vier abgebrochene
Jobs**, keine roten Tests — GitHub bricht laufende Läufe ab, wenn ein neuerer
Push nachkommt, und ich hatte mehrere schnell hintereinander gemacht. Die
nachfolgenden Commits liefen grün. Lokal sind Lint, Typecheck, 426 Vitest, 12
Deno und pgTAP (173) grün gemessen._

## Open questions

- **CRITICAL, unverändert:** Stripe- und Resend-Secrets zwischen den Projekten
  byte-identisch. Braucht Donald im Stripe-Dashboard. Billigster vollständiger
  Fix bleibt, `stripe-webhook` und `create-checkout-session` von PROD abzuziehen,
  bis Stripe wirklich läuft.
- **10.4** Zustell-Abnahme: Gmails _Annahme_ ist gemessen (Return-Path zeigt
  Annahme + Weiterleitung), seine _Platzierung_ nicht. GMX, Web.de, Outlook
  unberührt. Das Risiko ist nicht die Authentifizierung — die steht —, sondern
  die **Reputation einer ungewärmten Domain**, die beim Import auf einen Schlag
  an alle sendet.
- **`APP_URLS`** führt weiterhin localhost an erster Stelle (Stripe-Rücksprung).
  Bewusst nicht ungefragt an der Bezahlstrecke gedreht.
- **Weiterleitung `effbeezee.com` → `fairbusinessclub.de`** empfohlen: wer den
  Absender prüft, landet heute auf einer Strato-Platzhalterseite.
- **14.6** Drossel ist ein Zähler, keine Bremse · **14.7** Mail-Missbrauch über
  offene Selbstregistrierung · **14.8/12.10** `directory-search` und `events`
  widersprechen dem Gate (hängt an AGE-448 mit Detlev) · **9.1** Mailtext an
  Detlev · **10.3** PROD-Deploy braucht Freigabe.

## Fallen

Unverändert: `git add -A` verboten · `ls` ist `eza`-Alias · `supabase test db`
ohne Dateiliste lügt · Merge mit `state=MERGED` gegenprüfen · zustandsändernde
git-Befehle nie pipen · Infisical-Login braucht ein echtes Terminal.

**Neu aus dieser Sitzung:**

- **`202` von `send-activation` belegt keinen Versand.** Die Function antwortet
  bauartbedingt immer so. Wer den Versand prüfen will, nimmt `resend-activation`
  (mit Sitzung) — die gibt einen ehrlichen Status.
- **Infisical zu setzen schiebt nichts ins Supabase-Projekt.** Zwei getrennte
  Flächen. Genau deshalb sah am Morgen alles gesetzt aus, während die
  Live-Functions den Sandkasten benutzten.
- **`supabase secrets list` zeigt SHA-256 statt Klartext** — man kann einen
  vermuteten Wert also verifizieren, ohne ihn lesen zu dürfen. So war der
  localhost-Wert in zwei Minuten belegt statt vermutet.
- **Fehlende Konfiguration fällt auf, falsche nicht.** Die Functions prüfen auf
  Vorhandensein und melden `500 Server misconfigured`. Beide Blocker heute waren
  _gesetzt_ und _falsch_ — und damit still.
- Der Classifier blockt `supabase functions deploy` und `secrets set`
  unzuverlässig (mal ja, mal nein). Wenn er blockt: dem User den Befehl mit
  `!`-Präfix geben, nicht umgehen.
