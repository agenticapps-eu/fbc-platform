# Session Handoff — 2026-08-31 (AGE-642: D3+D4 sind draussen, PR #299 offen)

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
`donald/age-642-capacitor-huelle`, rebasiert auf `origin/main` (`63f3237`).
**PR #299 ist offen** — https://github.com/agenticapps-eu/fbc-platform/pull/299

Change `capacitor-huelle`: **31 offen, 87 erledigt.**

## Accomplished — D4 steht, D3+D4 sind gemeinsam hinausgegangen

Zwei Commits auf dem rebasierten Stand, alles grün: **2323 vitest (210 Dateien)
· 133 Deno · `deno check` · typecheck · `pnpm lint` 0 Fehler · `openspec
validate --all` 30/30.**

- `0978348` — `fix:` fehlender `cause` in `scripts/ota-buendel.logic.ts`.
- `aca10bf` — `feat:` der Rückweg (D4).

### Der Befund, der D4 grösser gemacht hat als „Aufruf einbauen"

**`autoDeleteFailed` steht per Vorgabe auf `true`, und das macht aus dem
Rückfall eine ENDLOSSCHLEIFE.** Am 31.08. an 8.51.15 auf beiden Plattformen an
der Quelle gemessen:

1. `checkRevert()` setzt das kaputte Bündel auf `ERROR` und rollt zurück
   (`CapacitorUpdaterPlugin.swift:3353-3399`, `.java:5140` ff.).
2. Danach löscht `autoDeleteFailed` es mit `removeInfo: false` — und dieser
   Zweig **überschreibt das eben gesetzte `ERROR` mit `DELETED`**
   (`CapgoUpdater.swift:2325`, `CapgoUpdater.java:1632`).
3. Beim nächsten Start würde `isErrorStatus()` abbrechen (`.swift:4391`,
   `.java:4915`) — aber der Status ist `DELETED`, und der Zweig darüber wirft
   die Registrierung weg und **lädt dasselbe Bündel erneut**
   (`.swift:4364-4379`, `.java:4999`).

Der Abbruch-Zweig ist mit der Vorgabe toter Code. **Der D3-Endpunkt kann das
nicht auffangen:** `ota_buendel_neuestes` liefert, was streng später eingetragen
wurde als das Laufende — nach dem Rückfall läuft wieder die ältere Fassung, das
kaputte Bündel ist also weiterhin „später". Nur das Gerät bricht die Schleife:
`autoDeleteFailed: false`.

## Decisions

- **`src/lib/ota.ts` ist ein Nebenwirkungs-Modul ohne Export**, in `main.tsx`
  als zweiter Import direkt hinter `./instrument`. Der Import IST der Aufruf —
  damit gibt es keine Funktion, die jemand zu rufen vergessen kann, und
  „vergessen" bräche hier JEDES Gerät bis zur nächsten Store-Einreichung.
- **Ohne Plattform-Bedingung.** Die Web-Umsetzung ist ein
  `return { bundle: BUNDLE_BUILTIN }` (`dist/esm/web.js:172`) — sie kostet
  nichts und kann nicht scheitern. Ein `if (nativ)` spart nichts und fügt eine
  Stelle hinzu, an der die Bestätigung ausbleiben kann.
- **Ohne `await`.** Ein top-level `await` machte aus einer hakenden Brücke einen
  Startfehler — genau den Zustand, gegen den das Modul steht.
- **Der Lint-Fix ist ein eigener Commit**, weil er eine Reparatur an D3 ist und
  nicht zum Rückweg gehört. `pnpm lint` lief auf diesem Branch **rot**, und CI
  fährt es (`ci.yml:41`); typecheck und die Testläufe sehen die Regel nicht.
- **Push per `--force-with-lease` war korrekt und verlustfrei:** der Remote-Tip
  (`a36b64d`) war der Vor-Squash-Stand von PR #295, dessen Inhalt längst als
  `59390b3` in `main` liegt.

## Files modified

`src/lib/ota.ts` (neu) · `src/lib/ota.test.ts` (neu, 3 Zusagen) ·
`src/main.tsx` (ein Import, Zeile 2) · `capacitor.config.ts`
(`autoDeleteFailed: false`, ausführlich begründet) ·
`scripts/capacitor-config.test.ts` (+1 Zusage) ·
`scripts/ota-buendel.logic.ts` (`cause`) ·
`openspec/changes/capacitor-huelle/specs/native-shell/spec.md` (neue Zusage +
Szenario „Ein zurückgerolltes Bündel wird nicht ein zweites Mal installiert") ·
`openspec/changes/capacitor-huelle/tasks.md` (D4 abgehakt).

## Next session: start here

**Erster Handgriff: `gh pr checks 299` — und dann den Merge begleiten.**
Danach, in dieser Reihenfolge:

1. **`migrate-prod` dispatchen**, sonst blockt der Drift-Gate den
   Frontend-Deploy. Es sind **drei** Migrationen (…100000, …140000, …160000).
   **Vor** dem ersten Deploy auf `main`, sonst scheitert der OTA-Schritt am
   fehlenden Bucket.
2. **Linear-Status von AGE-642 nachsehen.** Die Automation kippt ihn beim Merge
   auf *Done*, und der Vorgang ist NICHT fertig (31 offene Aufgaben, Phase E
   unangetastet). Vorbeugen geht nicht — der Branchname trägt das Kürzel.
   Nachsehen und zurücksetzen ist die einzige gemessene Abhilfe.
3. **Dann D5**: der Gerätebeleg. Er geht erst NACH dem Deploy, weil er den
   live geschalteten Luftweg braucht.

**Zwei Dinge, die vorher gelesen gehören:**

- **Das Spec-Delta ist NACH Review-Runde 5 gewachsen** (die neue
  Rückweg-Zusage). Der §18-Gate meldet das bei jedem Commit: „was reviewed, but
  the artifacts changed since". Nicht blockend, aber vor dem Archivieren ist zu
  entscheiden, ob eine Runde 6 über das geänderte Delta läuft. Im PR-Rumpf steht
  ein Hinweis für die Review.
- **Nach JEDEM `pnpm build`, vor jedem `git add`:**
  `git checkout -- src/content/release-entries.generated.ts`.

## Open questions — alle innerhalb AGE-642

- **Der Weg über das Netz bleibt ungeprüft:** Upload, RPC-Aufruf und die drei
  Endpunkte. Sichtbar wird er erst beim ersten Deploy auf `main`.
- **Der Rückfall selbst ist unbelegt und absichtlich so markiert.** Er hängt an
  einem Zeitgeber im nativen Teil und ist in jsdom nicht herstellbar. Belegt ist
  unsere Hälfte: vier Zusagen, alle vier gegengeprüft (Plattform-Bedingung
  lässt zwei umfallen, top-level `await` die dritte, `autoDeleteFailed: true`
  die vierte).
- **Vier Gerätebelege stehen aus:** C3 auf beiden Plattformen · C2 auf Android ·
  C1 auf iOS · B5 der Startbildschirm. **Für B5 muss die App gelöscht werden**,
  **und das kostet Donald die Anmeldung** — vorher ansagen.
- **B3 Signaturmaterial (4 offen):** Zertifikat, Provisioning Profile, Keystore.
  Donalds Hand. Das OTA-Schlüsselpaar ist erledigt und im Deploy gegengeprüft.
- **Der lokale Stack trägt die drei OTA-Migrationen nur von Hand** (per `psql`
  eingespielt, weil der Stack geteilt ist). Ein `supabase db reset` stellt sie
  korrekt her.
- **Nicht angefasst, ausserhalb AGE-642:** `scripts/sync-dev-auszug.test.ts` ist
  per Bauart flakig. `ADR-0037` wird dreimal zitiert, existiert aber nicht.
