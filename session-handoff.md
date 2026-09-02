# Session Handoff — 2026-09-02 abends (AGE-642: der Rückweg ist messbar, der Fix ist reviewt)

> ## ⚠ ZUERST: Diese Sitzung macht NUR die mobile Hülle
>
> **AGE-642 (Capacitor-Hülle) gehört hierher, alles andere nicht** (Donald,
> 31.08.). Frühere Fassungen schleppten fremde Punkte mit — das war der Grund
> für drei Rebase-Konflikte auf dieser Datei in zwei Tagen. Wer den Stand
> ausserhalb AGE-642 braucht, **fragt die Sitzung `fbc-platform-f4`**.
>
> ### ⛔ Für AGE-599 gilt weiterhin: NICHT löschen
>
> Die acht Objekte in `event-covers` auf DEV stammen aus dem Spiegel DEV ← PROD
> (AGE-576); kein Skript stellt sie wieder her. SHALL NOT in
> `openspec/specs/design-system/spec.md`.

Branch `donald/age-642-capacitor-huelle`, **0 hinter `main`**. **PR #314 und
#315 sind gemerged** (`86c4afe`, `6dae148`) und beide auf PROD ausgerollt
(`functions: success`). `openspec validate --all` 31/31, **157/157** Deno-Tests
(waren 140).

**Der einzige echte Rückstand im Luftweg ist weg — Probe 2 ist jetzt messbar.**

## Accomplished

### `ota-stats` war blind — zwei Fehler an derselben Stelle, beide still

**1 · Der Rumpf ist ein Array, nicht ein Objekt.** capgo puffert die Statistik
und sendet **Stapel** (iOS `flushStatsQueue` → `parameters: eventsToSend`,
Android → `new JSONArray()`). Der Endpunkt las `rumpf.action` an genau diesem
Array, bekam `undefined` und schrieb `ohne` — im Gerätelauf `Sent 9 events`
gegen dreimal `action: "ohne"`. `200 ok` sah dabei aus wie Erfolg. Die
**Einzelform** bleibt daneben echt (`sendRateLimitStatistic` in beiden Schalen,
Androids `sendStatsAsync`), also nimmt der Endpunkt beide.

**2 · Die Rumpfgrenze war stiller Verlust, kein Schutz.** Sie stand auf 8 KiB;
ein voller Stapel sind 200 Ereignisse (`maxPendingStats` == `MAX_PENDING_STATS`)
und gemessen **~94 KiB** — es passten **17 von 200** hindurch. Und `413` gilt
**keiner** Schale als vorübergehend (`isTransientStatsFailure`: nur 429, 408,
>= 500), das Gerät verwirft den Stapel also **endgültig**. Jetzt 256 KiB, plus
Deckel `MAX_EREIGNISSE = 200`, damit die weitere Grenze den offenen Endpunkt
nicht zum Log-Verstärker macht. Neben `actions` steht `gesamt`, sonst wäre der
Deckel selbst eine stille Kürzung.

### Wie es belegt ist

RED zuerst gesehen (5 rot / 3 grün), dann der Code. Am **live ausgelieferten**
Artefakt gegengeprüft, mit Positivkontrolle: 45 KiB → `200` (alte Fassung:
`413`), Logzeile `gesamt: 100` mit 100 echten Aktionen; 317 KiB → `413`. Die
Tabelle steht in `tasks.md`.

### Der Fremd-Review fand den Fix selbst — und er hatte denselben Fehler

Zwei unabhängige Reviewer (gemini + ein Haus-Reviewer nach der Skill-Vorlage;
`opencode` lief mit, `codex` bewusst nicht eingeplant) trafen **denselben
Kern**: `meldung.status` war im Betrieb **tot**, `index.ts` hartkodierte die
Statuscodes. Belegt per Mutation, alle blieben **11/11 grün**:

| Mutation an `index.ts` | |
|---|---|
| `status: 413` → `400` | grün |
| 413-Zweig antwortet `200 ok` | grün |
| `405`-Wächter gelöscht | grün |
| `actions` / `gesamt` aus der Logzeile | grün |
| **`req.clone()`, Rohrumpf samt `device_id` ins Log** | grün |

Ausgerechnet `413` entscheidet, ob das Gerät wiederholt oder **endgültig
verwirft** — also derselbe Fehler wie der behobene, nur eine Ebene höher: der
tragende Wert steht zweimal da, getestet war die Hälfte, die niemand liest.

**Ursache war die Zusage.** Sie las `index.ts` als *Text* und grepte auf den
Aufruf — das Haus-Muster aus `send-push/anbieter.test.ts`. Es prüft sich
selbst, nicht das Verhalten.

**Behoben in `6dae148`:** der Handler ist `behandleAnfrage` in `meldung.ts` und
wird **ausgeführt** geprüft — echte `Request`, echte `Response`, mitgeschriebene
Logzeilen, die Logzeile auf ihre exakte Feldmenge festgenagelt. `index.ts` ist
ein dreizeiliges `Deno.serve`. **Alle sieben Mutationen röten jetzt**, das Leck
eingeschlossen. 17 Zusagen statt 11. Live nach dem Deploy: `GET` → 405 · Stapel
→ 200 `ok` · 45 KiB → 200 `ok` · unlesbar → 200 `discarded` · 317 KiB → 413.

Zwei kleinere Befunde mit übernommen: `RUMPF_GRENZE` zählt UTF-16-Einheiten,
nicht Bytes (bis 768 KiB — kein Schutzloch, `req.text()` puffert vorher voll;
Kommentar richtiggestellt statt mit `TextEncoder` umgerechnet, der eine zweite
Kopie angelegt hätte), und sechs Herstellerverweise standen 1–118 Zeilen
daneben — jetzt Symbolnamen. **Nicht übernommen:** die Grenze auf 128 KiB
senken (gemini) — sie ist nicht die DoS-Kontrolle, und `413` ist endgültiger
Verlust.

**Zur Reviewer-Wahl:** gemini stufte den UTF-16-Punkt als HOCH ein, mit falscher
Kausalkette und einem Fix, der es verschlimmert hätte — und **alle vier** seiner
Zeilenverweise waren falsch. Verdikt zählt, Belege nicht.

## Decisions

- **Keine neue Spec-Zusage für `ota-stats`.** Die Senke speichert nichts und
  ist Infrastruktur; der Fix läuft unter den bestehenden Rückweg-Szenarien.
  Wer das anders sieht, müsste eine Anforderung „die Senke verliert keine
  Ereignisse" schreiben — bewusst nicht getan, das wäre Scope-Ausweitung.
- **256 KiB statt Grenze weg.** Eine Grenze bleibt nötig (offener Endpunkt);
  sie muss nur über dem echten Maximum liegen statt darunter.
- **Handler ins reine Modul, nicht nur `meldung.status` verdrahten.** Die
  Ein-Zeilen-Variante hätte den Befund geschlossen und die Naht gelassen; sechs
  weitere Mutationen wären grün geblieben.
- **Lint/fmt nicht angefasst.** `deno lint` beanstandet den `jsr:`-Import — in
  **allen 12** bestehenden Testdateien gleichermassen, und CI fährt weder
  `deno lint` noch `deno fmt` für Functions. Haus-Muster geschlagen hätte
  bedeutet, eine fremde Aufräumrunde in den Diff zu ziehen.

## Files modified

Alles unter `supabase/functions/ota-stats/`: **`meldung.ts`** (neu — Grenzen,
`werteRumpf`, `protokoll`, `behandleAnfrage`), **`meldung.test.ts`** (neu, 17
Zusagen), **`index.ts`** (auf drei Zeilen `Deno.serve` geschrumpft). Dazu
`openspec/changes/capacitor-huelle/tasks.md` und diese Datei.

Gemerged in `86c4afe` (#314, der Fix) und `6dae148` (#315, Review-Befunde +
Live-Beleg). `7ddb0f7`, die Belegdoku der Gerätesitzung, ging in #314 mit.

## Next session: start here

**Probe 2, der Rückweg** — die Vorbedingung ist weg, sie misst jetzt wirklich
etwas. Runbook §3: ein absichtlich defektes Bündel ausliefern, das Gerät muss
auf der vorigen Fassung landen. Der Beleg ist doppelt zu führen: am Gerätelog
(`Reloading`/Fallback) **und** an der `ota-stats`-Logzeile, die dann
`update_fail` bzw. `revert` namentlich tragen muss statt `ohne`.

Zwei Fallen aus den Vorsitzungen, beide vorher lesen:
`devicectl --terminate-existing` löst die Übernahme NICHT aus (der Wechsel in
den **Hintergrund** tut es), und den Schreibbefehl auf PROD
(`infisical run --env=prod -- pnpm tsx scripts/ota-buendel.ts`) fährt Donald —
dem Assistenten sperrt ihn der Klassifikator.

## Open questions — alle innerhalb AGE-642

- **Der Review ist gelaufen und abgearbeitet** (Donald, 02.09.: „mache
  review"). Was er fand, steht oben. Offen bleibt daraus nur eins: das
  Quelltext-Grep-Muster steckt noch in `send-push/anbieter.test.ts`, und
  `ota-update/index.ts` hat dieselbe ungetestete Naht. **Beim nächsten
  Anfassen mitziehen, nicht auf Vorrat.**
- **Der PROD-Schreibweg bleibt dem Assistenten gesperrt.** Bestätigt; Donald
  fährt die Zeile.
- **`[error] Semaphore wait timed out after 0ms`** — die einzige Fehlerzeile
  der Geräteläufe. Sie sitzt im `semaphore.wait()` von
  `sendRateLimitStatistic`/`flushStatsQueue` (`CapgoUpdater.swift`), also im
  Statistikweg. Nichts verhindert; kehrt sie wieder, lohnt jetzt ein Blick
  genau dort.
- **B3 Signaturmaterial** bleibt offen (Zertifikat, Profile, Keystore,
  Workflow) — für Gerätetests nicht nötig, ein Xcode-Lauf genügt.
- **Android ist unberührt.** Die halbe Abnahmeliste des Issues (beide
  Plattformen, Zurück-Taste, Sitzung überlebt Neustart) steht noch aus.
- **AGE-642 stand nach dem Merge zum achten Mal auf *Done*** (Branchname).
  Zurückgesetzt auf *In Progress*. Nach dem nächsten Merge wieder nachsehen.
- **Nicht angefasst, ausserhalb AGE-642:** `docs/prod-neuaufbau-plan.md:31-32`
  nennt noch `foelowldexkcqzewvrcf` · `scripts/sync-dev-auszug.test.ts` ist per
  Bauart flakig · `ADR-0037` wird dreimal zitiert, existiert aber nicht.
