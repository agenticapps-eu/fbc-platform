# Session Handoff — 2026-08-31 (AGE-642: D3 ist fertig, D4 ist dran)

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

**Worktree:** `fbc-platform.donald-age-642-capacitor-huelle`, Branch
`donald/age-642-capacitor-huelle`. **Kein PR offen, nichts gepusht** — Donald
hat weder Push noch PR verlangt.

**Rückstand selbst messen:**
`git fetch origin main && git rev-list --left-right --count origin/main...HEAD`.
Beim Schreiben: 2 hinter, 17 voraus.

Change `capacitor-huelle`: **33 offen, 84 erledigt.**

## Accomplished — Phase D3 steht

Zwei Commits, beide grün: 41 pgTAP · 133 Deno · 2318 vitest · typecheck ·
`deno check` · `openspec validate --all`.

- `dd5fb64` — der Leseweg als DEFINER-Funktion
  (`20260831160000_ota_buendel_neuestes.sql`), drei Edge Functions
  (`ota-update`, `ota-channel`, `ota-stats`) mit je einem `config.toml`-Block,
  die drei Endpunkt-URLs und der `publicKey` in `capacitor.config.ts`,
  `@capgo/capacitor-updater` **exakt** auf `8.51.15`.
- `ee84109` — die sechs übernommenen Befunde aus Review-Runde 5.

**Zwei Entscheidungen, die man der Datei nicht ansieht:**

- **Der Projekt-Host steht NICHT in `capacitor.config.ts`**, sondern kommt aus
  `process.env.VITE_SUPABASE_URL`. Fehlt sie, **wirft** `cap sync`. Eine leere
  URL schaltet den Weg nämlich nicht ab, sondern legt ihn auf
  `plugin.capgo.app` — samt `device_id` jedes Geräts.
- **`ota-channel` und `ota-stats` speichern nichts.** Sie existieren nur, damit
  diese zwei Wege nicht bei capgo landen.

## Review-Runde 5 — der Befund, der etwas verschob

codex fand sieben Befunde, vier HIGH; sechs übernommen, einer abgelehnt (alles
mit Begründung in `REVIEWS.md`). Der schwerste traf eine Zeile, die zwei Runden
lang als der Kern der Phase galt:

**`order by created_at desc` liefert die neueste Zeile im MANIFEST — das ist
nicht dasselbe wie „neuer als das, was auf dem Gerät läuft."** Steht ein Gerät
weiter vorn, bekäme es ein älteres Bündel und installierte es kommentarlos.
`ota_buendel_neuestes` nimmt jetzt **beide** Angaben des Geräts und nur, was
STRENG später eingetragen wurde. Kein neues Feld nötig — `created_at` war schon
die Ordnung, es fehlte die Untergrenze.

Dabei fiel `if (buendel.version === laeuft)` ersatzlos weg: der Zweig kann nicht
mehr laufen.

`opencode` ist zweimal am Anbieter gescheitert (`UnknownError`), `gemini` ist
eingesprungen und fand nichts — auch nicht den Rückschritt. Zweitmeinung, kein
Beleg.

## Files modified

`supabase/migrations/20260831160000_ota_buendel_neuestes.sql` (neu) ·
`supabase/functions/ota-{update,channel,stats}/` (neu) ·
`supabase/config.toml` (drei Blöcke) · `supabase/tests/ota_buendel_test.sql`
(27 → 41 Zusagen) · `capacitor.config.ts` (URLs, publicKey) ·
`scripts/capacitor-config.test.ts` (neu) · `scripts/functions-config.test.ts` ·
`scripts/ota-buendel{,.logic,.logic.test}.ts` (`pruefeSchluesselpaar`) ·
`package.json` + `pnpm-lock.yaml` + `deno.lock` (capgo) · `tasks.md` ·
`REVIEWS.md` (Runde 5, **mit** verifiziertem Trailer).

## Next session: start here

**D4 — der Rückweg.** Erster Handgriff: `### D4.` in
`openspec/changes/capacitor-huelle/tasks.md` lesen. Ohne `notifyAppReady()` ist
OTA eine Einbahnstrasse: ein gültig signiertes Bündel, das startet und dann weiss
bleibt, bricht jedes Gerät dauerhaft bis eine neue Schale durch den Store geht.

**Vier Dinge, die vorher gelesen gehören:**

1. **Die Vertragsnummer muss steigen, wenn D4 ein Plugin anfasst.**
   `plugins.CapacitorUpdater.version` in `capacitor.config.ts`, heute `1.0.0`.
   Ein PR, der ein Capacitor-Plugin hinzufügt, hebt sie auf `2.0.0` und geht
   über den Store. Das ist Buchführung, kein Mechanismus — der Entwurf sagt das
   ausdrücklich, und codex hat genau daran Anstoss genommen (abgelehnt, §8).
2. **Nach dem Merge `migrate-prod` dispatchen**, sonst blockt der Drift-Gate den
   Frontend-Deploy. Es sind jetzt **drei** Migrationen (…100000, …140000,
   …160000). **Vor** dem ersten Deploy auf `main`, sonst scheitert der
   OTA-Schritt am fehlenden Bucket.
3. **Nach JEDEM `pnpm build`, vor jedem `git add`:**
   `git checkout -- src/content/release-entries.generated.ts`.
4. **Der lokale Stack trägt die drei OTA-Migrationen nur von Hand.** Ich habe
   sie per `psql` eingespielt, weil der Stack geteilt ist und ein
   `supabase db reset` f4s Stand geräumt hätte. Ein Reset stellt sie korrekt her.

## Open questions — alle innerhalb AGE-642

- **Der Weg über das Netz bleibt ungeprüft:** Upload, RPC-Aufruf, und jetzt auch
  die drei Endpunkte selbst. Alles davor ist belegt; sichtbar wird es erst beim
  ersten Deploy auf `main`.
- **Die zweite RED-Zusage aus D3 ist halb offen und absichtlich so markiert.**
  „Ein Bündel ohne passende Prüfsumme wird abgewiesen **und die installierte
  Fassung bleibt in Betrieb**" — die erste Hälfte liegt bei uns und ist belegt,
  die zweite ist Verhalten des Plugins und hängt an D4.
- **Vier Gerätebelege stehen aus:** C3 auf beiden Plattformen · C2 auf Android ·
  C1 auf iOS · B5 der Startbildschirm. **Für B5 muss die App gelöscht werden**,
  **und das kostet Donald die Anmeldung** — vorher ansagen.
- **B3 Signaturmaterial (4 offen):** Zertifikat, Provisioning Profile, Keystore.
  Donalds Hand. Das OTA-Schlüsselpaar ist **erledigt** und seit Runde 5 auch im
  Deploy gegengeprüft.
- **Nicht angefasst, ausserhalb AGE-642:** `scripts/sync-dev-auszug.test.ts` ist
  per Bauart flakig (vergleicht `git status --ignored` über den ganzen
  Arbeitsbaum). f4 hat es diagnostiziert und stehen lassen — es ist niemandes
  Vorgang. Merkzettel liegt in der Projekt-Memory.
- **Nebenbefund, weiterhin nicht angefasst:** `ADR-0037` wird dreimal zitiert,
  existiert aber nicht (`docs/decisions/` führt 0001–0005).
