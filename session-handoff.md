# Session Handoff — 2026-09-02 abends (AGE-642: der Rückweg ist jetzt messbar)

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
> (AGE-576); kein Skript stellt sie wieder her. Steht als SHALL NOT in
> `openspec/specs/design-system/spec.md`.

Branch `donald/age-642-capacitor-huelle`, **0 hinter `main`**. **PR #314 ist
gemerged** (`86c4afe`, squash) und auf PROD ausgerollt (`functions: success`).
`openspec validate --all` 31/31, **151/151** Deno-Tests (waren 140).

**Der einzige echte Rückstand im Luftweg ist weg — Probe 2 ist jetzt messbar.**

## Accomplished

### `ota-stats` war blind — zwei Fehler an derselben Stelle, beide still

**1 · Der Rumpf ist ein Array, nicht ein Objekt.** capgo puffert die Statistik
und sendet **Stapel**:

| Schale | Belegstelle |
|---|---|
| iOS | `CapgoUpdater.swift:3300` `parameters: eventsToSend` |
| Android | `CapgoUpdater.java:3084` `new JSONArray()` |

Der Endpunkt las `rumpf.action` an genau diesem Array, bekam `undefined` und
schrieb `ohne` — im Gerätelauf `Sent 9 events` gegen dreimal `action: "ohne"`.
`200 ok` sah dabei von aussen aus wie Erfolg.

Die **Einzelform** bleibt daneben echt (`sendRateLimitStatistic` in *beiden*
Schalen, dazu Androids `DownloadService.sendStatsAsync`), also nimmt der
Endpunkt beide Formen. Gemessen, nicht vorsorglich.

**2 · Die Rumpfgrenze war stiller Verlust, kein Schutz.** Sie stand auf 8 KiB.
Ein voller Stapel sind 200 Ereignisse (`maxPendingStats` ==
`MAX_PENDING_STATS`, beide Schalen), gemessen **~94 KiB** — es passten **17 von
200** hindurch. Und `413` gilt **keiner** Schale als vorübergehend
(`isTransientStatsFailure`: nur 429, 408, >= 500), das Gerät verwirft den
Stapel also **endgültig**.

Jetzt 256 KiB, plus ein Deckel `MAX_EREIGNISSE = 200`: ohne ihn machte die
weitere Grenze den offenen Endpunkt (`verify_jwt = false`) zum Log-Verstärker.
Neben `actions` steht `gesamt`, sonst wäre der Deckel selbst eine stille
Kürzung.

### Wie es belegt ist

- Vorgehen wie beim `session_key`-Fix: **erst die Zusagen umgedreht** (RED
  gesehen: 5 rot / 3 grün), dann der Code.
- 11 Zusagen in `meldung.ts`; eine liest `index.ts` als Text und belegt die
  **Verdrahtung** (Muster aus `send-push/anbieter.test.ts`).
- **Mutations-Gegenprobe:** alle fünf tragenden Zusagen röten beim Rückbau
  einzeln — Array-Behandlung, `ACTION_GRENZE`, `MAX_EREIGNISSE`,
  `RUMPF_GRENZE`, Verdrahtung.
- **Am live ausgelieferten Artefakt**, mit Positivkontrolle: 45 KiB → `200`
  (alte Fassung: `413`), Logzeile `gesamt: 100` mit 100 echten Aktionen;
  317 KiB → `413`. Die Tabelle steht in `tasks.md`.

## Decisions

- **Keine neue Spec-Zusage für `ota-stats`.** Die Senke speichert nichts und
  ist Infrastruktur; der Fix läuft unter den bestehenden Rückweg-Szenarien.
  Wer das anders sieht, müsste eine Anforderung „die Senke verliert keine
  Ereignisse" schreiben — bewusst nicht getan, das wäre Scope-Ausweitung.
- **256 KiB statt Grenze weg.** Eine Grenze bleibt nötig (offener Endpunkt);
  sie muss nur über dem echten Maximum liegen statt darunter.
- **Lint/fmt nicht angefasst.** `deno lint` beanstandet den `jsr:`-Import — in
  **allen 12** bestehenden Testdateien gleichermassen, und CI fährt weder
  `deno lint` noch `deno fmt` für Functions. Haus-Muster geschlagen hätte
  bedeutet, eine fremde Aufräumrunde in den Diff zu ziehen.

## Files modified

**Gemerged in `86c4afe` (PR #314):**
`supabase/functions/ota-stats/meldung.ts` (neu, die Entscheidung) ·
`meldung.test.ts` (neu, 11 Zusagen) · `index.ts` (verdrahtet; Kopfkommentar
korrigiert — er behauptete, der Rumpf werde „nur bis `RUMPF_GRENZE` gelesen",
aber `req.text()` puffert ihn vollständig) ·
`openspec/changes/capacitor-huelle/tasks.md`.

Enthielt ausserdem `7ddb0f7`, die Belegdoku der Gerätesitzung (war ungepusht).

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

- **Kein unabhängiger Review auf diesem Diff.** Der Workflow sieht Stufe 4 vor,
  aber diese Sitzung läuft unter „keine Subagenten ohne Auftrag". Der Diff
  berührt einen offenen Endpunkt und eine Grenze — falls ein Fremdreview
  gewünscht ist, ist das die eine offene Zusage.
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
