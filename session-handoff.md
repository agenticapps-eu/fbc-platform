# Session Handoff — 2026-09-12 (AGE-643 M3: §3–§7 fertig, offen ist nur noch der Gerätebeleg)

> ## ⚠ ZUERST — Scope und Arbeitsplatz
>
> **1. Diese Übergabe führt AGE-643** (M3, Deep Links), Change `deep-links`.
> Arbeitsplatz ist **dieser** Worktree:
> `~/worktrees/fbc-platform/donald-age-643-deep-links`, Branch
> `donald/age-643-deep-links`, Stand **`840dcf8`** (drei Commits über
> `origin/main`). **Noch nicht gepusht.**
>
> **2. Die Fassung auf `main` ist NICHT Dein Auftrag.** Nicht zusammenführen.
>
> **3. AGE-718 läuft parallel in einer eigenen Sitzung** (`fbc-platform-f1`).
> Nicht anfassen.
>
> **4. Vor der ersten Handlung `ListAgents`.**

## Accomplished

**§3 bis §7 sind gebaut und gemessen.** Drei Blöcke sind fertig, zwei hängen an
Handgriffen, die diese Sitzung nicht ausführen kann.

| Block | Stand |
| --- | --- |
| §3 Auslieferung RED | fertig, 4/4 rot aus dem richtigen Grund |
| §4 Die beiden Dateien | fertig; nur 4.6 wartet auf den Deploy |
| §5 Domain-Anmeldung | fertig, beide Bauten am Artefakt belegt |
| §6 Weg ins Routing | fertig, vier Mutationen gefahren |
| §7 Zielerhaltung | fertig, sieben Zusagen, Gegenprobe gefahren |

Zahlen vom 12.09.: **2801 Tests grün, keiner rot.** `typecheck`, `lint`,
`build`, `openspec validate --all` grün. Beide Verifizierungsdateien liegen nach
`pnpm build` zeichengleich in `dist/.well-known/`.

**Beide Bauten sind am Artefakt gemessen, nicht an der Eingabe.** Android:
BUILD SUCCESSFUL, und das zusammengeführte Manifest trägt genau einen
`autoVerify`-Filter mit allen vier `pathPrefix`. iOS: BUILD SUCCEEDED, und
`codesign -d --entitlements` auf der gebauten `App.app` zeigt
`applinks:app.effbeezee.com` — die Fähigkeit aus dem Portal hat es bis ins
signierte Binary geschafft.

## Decisions

- **Die vier Pfade stehen einmal**, in `src/lib/deep-links.ts`. AASA und
  Manifest können den Verweis nicht selbst tragen (strikt geparstes JSON bzw.
  eigene Syntax); er steht deshalb in `public/_headers` und als XML-Kommentar
  im Manifest. Beide Tests halten die Artefakte gegen dieselbe Liste.
- **Der Vermerk über den fehlenden Play-Fingerabdruck wurde als Aufgabe 3.3b
  nachgetragen.** Die Spec verlangt ihn in einem eigenen Szenario, §3 zählte
  ihn nicht auf — eine Zusage ohne Prüfung.
- **`LoginPage` führt das Ziel an ZWEI Stellen**, und die greifende ist nicht
  die, die der Plan nannte: der `<Navigate>`-Guard am Kopf der Komponente feuert
  vor dem `navigate` nach `signIn`, weil der Auth-Zuhörer die Sitzung früher
  meldet. Stünde das Ziel nur an einer, wäre es die falsche.
- **`/events/:id` liegt nicht hinter `RequireAuth`** (`src/App.tsx:156`, anon
  darf öffentliche Events sehen). Die Zielerhaltung ist dort nie im Spiel; die
  Fälle laufen über `/chat/:threadId` und `/p/:id`.
- **`pnpm format` blieb ungelaufen.** `LoginPage.tsx` war schon vor dieser
  Sitzung unformatiert; Prettier lief nur über die eigenen Dateien.
- **Der Keystore war 90 Sekunden im Baum und ist wieder draußen.** Der
  Fingerabdruck selbst ist kein Geheimnis — er steht in jeder ausgelieferten App
  und gehört in eine öffentlich abrufbare Datei.
- **Die `cap sync`-Drift auf `Package.swift`/`Package.resolved` wurde wieder
  verworfen** (8.5.0 → 8.5.1). Sie ist vorbestehend auf `main` und gehört nicht
  in diesen Change. Sie kommt bei jedem `cap sync` zurück.
- **`DEVELOPMENT_TEAM` steht nicht im Xcode-Projekt.** Wie in CI gehört es auf
  die Kommandozeile: `DEVELOPMENT_TEAM=WQZJ8649TN`. Ohne bricht der Bau mit
  „requires a development team" ab, was wie ein fehlendes Zertifikat aussieht.

## Files modified

Alles in `ff5c6fe`.

- `public/.well-known/apple-app-site-association` — neu, vier Muster, keine Kommentare
- `public/_headers` — `application/json` für die endungslose Datei, plus der
  Vermerk über den fehlenden Play-App-Signing-Fingerabdruck
- `ios/App/App/App.entitlements` — `applinks:app.effbeezee.com`
- `android/app/src/main/AndroidManifest.xml` — ein `intent-filter` mit
  `autoVerify` und je einem `pathPrefix` für die vier Pfade
- `src/lib/deep-links.ts` — neu: die vier Pfade, `deepLinkZiel` (mit `hash`),
  `deepLinkZuhoerer`, `zielNachAnmeldung`
- `src/components/AppShell.tsx` — Effect für den `appUrlOpen`-Zuhörer
- `src/components/RequireAuth.tsx` — reicht den Ort über `state` weiter
- `src/pages/LoginPage.tsx` — liest das Ziel, an beiden Stellen
- Tests neu: `src/deep-links.auslieferung.test.ts`, `src/deep-links.native.test.ts`,
  `src/lib/deep-links.test.ts`, `src/zielerhaltung.test.tsx`,
  `src/components/AppShell.deep-links.test.tsx`
- `openspec/changes/deep-links/tasks.md` — Stand und die beiden Blocker

## Next session: start here

**Die Reihenfolge ist jetzt die eigentliche offene Frage, nicht mehr der Code.**
4.6 und der ganze §8 verlangen die Dateien **am Netz** — und dorthin kommen sie
nur über einen Merge auf `main`. Der Gerätebeleg kann also nicht vor dem Merge
stattfinden, und `openspec archive` soll nicht vor dem Gerätebeleg stattfinden.

Vorschlag, mit Donald abzustimmen: erst PR und Merge (der Code ist vollständig
und grün), dann 4.6 live messen, dann §8 am Gerät, dann Archiv und Abschluss in
einem zweiten, kleinen PR.

```
cd ~/worktrees/fbc-platform/donald-age-643-deep-links
git log --oneline -1          # muss 840dcf8 sein
```

**4.6, sofort nach dem Deploy**, und ohne `-L`, mit Blick auf den **Rumpf**:
beide Adressen müssen ihr eigenes JSON liefern. 7986 Bytes `text/html` wären der
Fehlschlag — das war der Stand vor dieser Arbeit, mit HTTP 200.

**§8 braucht ein Gerät.** Entitlement und Manifest reisen **nicht** über OTA.
Der iOS-Weg ist die Direktinstallation aus Xcode; das Android-Paket muss mit dem
**Upload**-Schlüssel signiert sein, nicht mit dem Debug-Schlüssel, sonst
scheitert `autoVerify` mit genau dem irreführenden Bild, vor dem dieser Change
warnt.

## Open questions

- **`_headers` für eine endungslose Datei ist weiterhin ungemessen.** Dass die
  Regel im Bau landet, ist belegt (`dist/_headers` trägt sie); dass Cloudflare
  sie auf eine Datei ohne Endung anwendet, nicht. Das entscheidet sich in 4.6,
  und es ist die einzige Zusage dieses Changes, die noch an einer Vermutung
  hängt.
- **AGE-643 trägt im Rumpf noch „blockiert durch AGE-256"**, obwohl AGE-256
  erledigt ist. Beim Abschluss entfernen (Aufgabe 9.6).
- **`pnpm format:check` ist rot** — Vorzustand, läuft in keinem CI-Workflow.
  Niemals `pnpm format` laufen lassen, es schreibt ~60 fremde Dateien um.
