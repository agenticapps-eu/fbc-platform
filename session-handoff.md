# Session Handoff — 2026-09-12 (AGE-643 M3: gemerged und live; offen ist nur der Gerätebeleg)

> ## ⚠ ZUERST — Scope und Arbeitsplatz
>
> **1. Diese Übergabe führt AGE-643** (M3, Deep Links), Change `deep-links`.
> Arbeitsplatz ist **dieser** Worktree:
> `~/worktrees/fbc-platform/donald-age-643-deep-links`.
>
> **2. Der Branch hat gewechselt.** `donald/age-643-deep-links` ist als PR #399
> gemerged und erledigt. Weitergearbeitet wird auf
> **`donald/deep-links-abnahme`**, Stand `d8354f3`, ein Commit über
> `origin/main` (`e2abc83`). **Noch nicht gepusht, kein PR.**
>
> **3. AGE-718 und AGE-719 laufen in eigenen Sitzungen.** Nicht anfassen.
>
> **4. Vor der ersten Handlung `ListAgents`.**

## Accomplished

**Der Change ist gebaut, gemerged und am Netz.** §3 bis §7 sind vollständig,
§4.6 ist gegen die Produktionsfläche belegt. Offen ist allein §8, der
Gerätebeleg, und danach §9.

Gemessen am 12.09. gegen `app.effbeezee.com`, nach dem Deploy auf `e2abc83`:

| Adresse | Status | Inhaltstyp | Bytes |
| --- | --- | --- | --- |
| `/.well-known/apple-app-site-association` | 200 | `application/json` | 272 |
| `/.well-known/assetlinks.json` | 200 | `application/json` | 325 |
| `/chat/abc-123` (Gegenprobe) | 200 | `text/html` | **7986** |

**Die 7986 sind der Beleg, nicht der Fehlschlag.** Vor dieser Arbeit lieferten
die beiden `.well-known`-Adressen genau diese 7986 Bytes — den SPA-Fallback, mit
HTTP 200. Jetzt liefern sie ihr eigenes JSON, und die 7986 stehen dort, wo sie
hingehören: auf einer Anwendungsroute, zeichengleich mit `/`. Der Browserweg ist
unberührt.

Beide Bauten sind am **Artefakt** gemessen: das zusammengeführte Android-Manifest
trägt genau einen `autoVerify`-Filter mit allen vier `pathPrefix`, und
`codesign -d --entitlements` auf der gebauten `App.app` zeigt
`applinks:app.effbeezee.com`.

## Decisions

- **Die vier Pfade stehen einmal**, in `src/lib/deep-links.ts`. AASA und
  Manifest verweisen darauf; beide Tests halten die Artefakte dagegen.
- **`LoginPage` führt das Ziel an ZWEI Stellen**, und die greifende ist der
  `<Navigate>`-Guard am Kopf, nicht das `navigate` nach `signIn`.
- **`/events/:id` liegt nicht hinter `RequireAuth`** (`src/App.tsx:156`).
- **`DEVELOPMENT_TEAM` steht nicht im Xcode-Projekt.** Wie in CI gehört es auf
  die Kommandozeile: `DEVELOPMENT_TEAM=WQZJ8649TN`.
- **Die `cap sync`-Drift auf `Package.swift`/`Package.resolved` (8.5.0 → 8.5.1)
  wurde verworfen.** Sie ist vorbestehend auf `main` und kommt bei jedem
  `cap sync` zurück.
- **Archiviert wird erst nach dem Gerätebeleg.** Deshalb der Merge ohne Archiv
  und ein zweiter, kleiner PR am Ende.

## Files modified

In PR #399 (gemerged, `e2abc83`): beide `.well-known`-Dateien, `public/_headers`,
`App.entitlements`, `AndroidManifest.xml`, `src/lib/deep-links.ts`,
`AppShell.tsx`, `RequireAuth.tsx`, `LoginPage.tsx`, fünf neue Testdateien,
`tasks.md`.

Auf `donald/deep-links-abnahme` (`d8354f3`, ungepusht): nur `tasks.md`, mit der
4.6-Messung gegen Produktion.

## Next session: start here

**Erster Handgriff: §8, und der braucht ein Gerät.** Alles andere ist belegt.

```
cd ~/worktrees/fbc-platform/donald-age-643-deep-links
git log --oneline -1          # muss d8354f3 sein, Branch donald/deep-links-abnahme
```

1. **8.0 Kaltstart zuerst**, nicht Warmstart. App vollständig beenden, dann den
   Link öffnen. Das ist der Fall aus der Einladungsmail.
2. **8.0b iOS:** Direktinstallation aus Xcode auf ein registriertes Gerät.
   Entitlement und Manifest reisen **nicht** über OTA.
3. **8.3 Android:** das Paket MUSS mit dem **Upload**-Schlüssel signiert sein.
   Ein Debug-Bau scheitert an `autoVerify` mit genau dem irreführenden Bild,
   vor dem dieser Change warnt. Vorher mit `apksigner verify --print-certs`
   gegen `7A:E1:…:DA` in `assetlinks.json` halten. `apksigner` liegt nicht im
   PATH, er steht unter `~/Library/Android/sdk/build-tools/`.
4. Danach §9: `pnpm test`/`typecheck`/`lint`/`build`, die zwei Gates,
   `openspec archive deep-links`, PR, und **AGE-643 im Rumpf den überholten
   Vermerk „blockiert durch AGE-256" nehmen** (Aufgabe 9.6).

**Und nach jedem Merge den Linear-Status nachsehen.** Der Merge von #399 hat
AGE-643 um 09:18:29 auf Done gesetzt, zwei Sekunden nach dem Merge, bei
ausstehendem Gerätebeleg. Von Hand auf In Progress zurückgesetzt. Das wiederholt
sich beim nächsten Merge.

## Open questions

- **Ob Apple und Google die Dateien akzeptieren, ist nicht dasselbe wie
  „abrufbar".** Das entscheidet sich am Gerät, und auf iOS gehört dabei der
  Entwicklermodus der Association in den Beleg — Apple zwischenspeichert die
  Datei.
- **`pnpm format:check` ist rot** — Vorzustand, läuft in keinem CI-Workflow.
  Niemals `pnpm format` laufen lassen, es schreibt ~60 fremde Dateien um.
