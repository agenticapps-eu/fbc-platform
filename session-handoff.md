# Session Handoff — 2026-09-02 abends (AGE-642: Rückweg messbar, Review abgearbeitet, Nähte zu)

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

Branch `donald/age-642-capacitor-huelle`, **0 hinter `main`**. **PR #314–#317 sind gemerged**
(`86c4afe`, `6dae148`, `e7d9054`, `2a049c0`) und auf PROD ausgerollt.
`openspec validate --all` 31/31, **174/174** Deno-Tests (waren 140).

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

### Der Fremd-Review fand den Fix selbst — und er hatte denselben Fehler

Zwei unabhängige Reviewer (gemini + ein Haus-Reviewer; `opencode` lief mit,
`codex` bewusst nicht) trafen **denselben Kern**: `meldung.status` war im
Betrieb **tot**, `index.ts` hartkodierte die Statuscodes. Per Mutation belegt —
`413` → `400`, der 413-Zweig auf `200 ok`, der 405-Wächter gelöscht, `actions`
aus der Logzeile, und **`req.clone()` mit dem Rohrumpf samt `device_id` ins
Log**: alle blieben **11/11 grün**. Ausgerechnet `413` entscheidet, ob das
Gerät wiederholt oder endgültig verwirft — derselbe Fehler wie der behobene,
eine Ebene höher.

**Ursache war die Zusage:** sie las `index.ts` als *Text* und grepte auf den
Aufruf. Behoben in `6dae148` — Handler als `behandleAnfrage` in `meldung.ts`,
**ausgeführt** geprüft, Logzeile auf ihre exakte Feldmenge festgenagelt.
`index.ts` ist drei Zeilen `Deno.serve`. Alle sieben Mutationen röten, das Leck
eingeschlossen.

Zwei kleinere Befunde mit: `RUMPF_GRENZE` zählt UTF-16-Einheiten statt Bytes
(kein Schutzloch, `req.text()` puffert vorher voll — Kommentar richtiggestellt
statt mit `TextEncoder` umgerechnet, der eine zweite Kopie angelegt hätte), und
sechs Herstellerverweise standen 1–118 Zeilen daneben → jetzt Symbolnamen.
**Nicht übernommen:** Grenze auf 128 KiB senken.

**Zur Reviewer-Wahl:** gemini stufte den UTF-16-Punkt als HOCH ein, mit falscher
Kausalkette und einem Fix, der es verschlimmert hätte — und alle vier
Zeilenverweise waren falsch. Verdikt zählt, Belege nicht.

### Nachgezogen: dieselbe Naht in den zwei Nachbarn (`2a049c0`)

Donald, 02.09.: „zieh das nach". Das Quelltext-Grep-Muster steckte auch in
`ota-update` und `send-push`.

- **`send-push` war der wertvollere Fund.** Die **Webhook-Authentifizierung**
  (`timingSafeEqual`, 401) hatte **null** Abdeckung, ebenso fehlendes Secret
  (500), unlesbarer Rumpf (400) und die Weiche Webhook/Wiederholungslauf. Alle
  bestehenden Zusagen galten `anbieter.ts` und `nachrichten.ts` — den reinen
  Modulen *dahinter*. Die Tore liegen jetzt als `pruefeAufruf` in `aufruf.ts`,
  12 ausgeführte Zusagen. Es **baut die Ablehnungsantwort selbst**, statt einen
  Statuscode zu melden — sonst wäre die `ota-stats`-Doppelung zurück.
- **`ota-update`** — Handler als `behandleAnfrage` in `antwort.ts`. Ungedeckt
  waren `405`, der `catch` auf `req.json()` und der `content-type`. Der
  Statusfehler existierte hier **nicht**, `ergebnis.status` wurde konsumiert.

**Zehn Mutationen, zehnmal rot** (u. a. „401 → 200", „Vergleich übersprungen",
„Status hartkodiert"). Live nachgeprüft: `send-push` GET → 405, ohne Auth →
401, falscher Bearer → 401; `ota-update` GET → 405, unlesbar → **lautes** 400,
gültig → echtes Bündel.

**Eine beabsichtigte Verhaltensänderung:** ein Rumpf `null` warf vorher in
`aufruf.record?.id` eine `TypeError` → 500; jetzt sauberes 400, zugesagt.

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

`supabase/functions/ota-stats/` — **`meldung.ts`** (neu: Grenzen, `werteRumpf`,
`protokoll`, `behandleAnfrage`), **`meldung.test.ts`** (neu, 17 Zusagen),
`index.ts` (drei Zeilen). `ota-update/` — Handler nach `antwort.ts`, 5 Zusagen
dazu. `send-push/` — **`aufruf.ts`** + **`aufruf.test.ts`** (neu, 12 Zusagen),
`index.ts` verschlankt. Dazu `openspec/changes/capacitor-huelle/tasks.md` und
diese Datei.

Gemerged als `86c4afe` (#314) · `6dae148` (#315) · `e7d9054` (#316) ·
`2a049c0` (#317).

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

- **Review gelaufen UND nachgezogen** (Donald: „mache review", dann „zieh das
  nach"). Beides steht oben. **Eine Naht bleibt bewusst offen:** `Zustellung`
  liegt weiter in `send-push/index.ts`, und die Zusage auf
  `apnsMitHostErkennung` grept dort noch Quelltext. Das herauszulösen wäre ein
  Umbau der **Zustellschleife** — verhaltenstragender Code, keine Testgerüste.
  Lohnt sich, wenn diese Schleife ohnehin angefasst wird.
- **Der PROD-Schreibweg bleibt dem Assistenten gesperrt.** Bestätigt; Donald
  fährt die Zeile.
- **`[error] Semaphore wait timed out after 0ms`** — einzige Fehlerzeile der
  Geräteläufe, sitzt im `semaphore.wait()` des Statistikwegs
  (`CapgoUpdater.swift`). Nichts verhindert; kehrt sie wieder, dort nachsehen.
- **B3 Signaturmaterial** offen (Zertifikat, Profile, Keystore, Workflow) —
  für Gerätetests nicht nötig, ein Xcode-Lauf genügt.
- **Android ist unberührt.** Die halbe Abnahmeliste des Issues (beide
  Plattformen, Zurück-Taste, Sitzung überlebt Neustart) steht noch aus.
- **AGE-642 setzt sich bei JEDEM Merge auf *Done*** (Branchname) — heute
  viermal, jedes Mal zurückgesetzt. Nach dem nächsten Merge wieder nachsehen.
- **Nicht angefasst, ausserhalb AGE-642:** `docs/prod-neuaufbau-plan.md:31-32`
  nennt noch `foelowldexkcqzewvrcf` · `scripts/sync-dev-auszug.test.ts` ist per
  Bauart flakig · `ADR-0037` wird dreimal zitiert, existiert aber nicht.
