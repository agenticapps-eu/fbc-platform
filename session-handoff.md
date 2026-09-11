# Session Handoff — 2026-09-11 (AGE-643 M3: geplant, Gate durch, kein Code)

> ## ⚠ ZUERST — Scope und Arbeitsplatz
>
> **1. Diese Übergabe führt AGE-643** (M3, Deep Links), Change `deep-links`.
> Arbeitsplatz ist **dieser** Worktree:
> `~/worktrees/fbc-platform/donald-age-643-deep-links`, Branch
> `donald/age-643-deep-links`, Stand **`30d7e98`** (ein eigener Commit über
> `origin/main` `d9721f4`).
>
> **2. Die Fassung dieser Datei auf `main` ist NICHT Dein Auftrag.** Dort steht
> noch die AGE-705-Übergabe vom 10.09. — der Blog ist ausgeliefert und
> archiviert. Sie zeigt auf einen fremden Worktree. **Nicht zusammenführen.**
>
> **3. AGE-718 läuft parallel in einer EIGENEN Sitzung** (`fbc-platform-f1`,
> Worktree `donald-age-718-…`). Nicht anfassen. Am 11.09. haben zwei Sitzungen
> dort gleichzeitig dieselbe Testdatei geschrieben; das ist abgestimmt und
> erledigt.
>
> **4. Vor der ersten Handlung `ListAgents`.** Peer-Namen tragen KEIN
> Vorgangskürzel mehr — wem ein Worktree gehört, steht in `wt list` (🤖/💬) und
> im Alter der untracked Dateien, nicht im Sitzungsnamen.

## Accomplished

**Der Change ist vollständig geplant und das Gate ist passiert. Keine Zeile
Produktionscode.** `openspec validate --all` grün, `deep-links` darunter; das
Gate zählt beide Reviewer namentlich und verifiziert den Trailer.

Gemessen, bevor geplant wurde — diese Zahlen sind belastbar und **nicht zu
wiederholen**:

| Gegenstand | Stand |
| --- | --- |
| `/.well-known/apple-app-site-association` live | **fehlt** |
| `/.well-known/assetlinks.json` live | **fehlt** |
| `associated-domains` in `App.entitlements` | fehlt (nur `aps-environment`) |
| App-Link-`intent-filter` im Manifest | fehlt (nur `MAIN`/`LAUNCHER`) |
| Vite kopiert `public/.well-known/` nach `dist/` | **ja**, per Sonde belegt |
| Sprung aus der Push-Mitteilung ins Gespräch | **gebaut** (M1, `pushZielZuhoerer`) |

**Die wichtigste Messung ist die erste Zeile.** Beide Adressen antworten mit
**HTTP 200** und liefern die Startseite: `text/html`, **7986 Bytes**,
zeichengleich mit `/`. Das ist der SPA-Fallback. Ein Test auf den Statuscode
wäre grün gewesen, bevor es die Dateien gibt — **jede Prüfung liest den Rumpf.**

Plan-Review mit **gemini** und **opencode** (`hf:moonshotai/Kimi-K3`), beide
REQUEST-CHANGES, zehn Befunde, **alle** eingearbeitet.

## Decisions

- **Universal Links, kein eigenes Schema.** Ein Schema tut nichts, wenn die App
  fehlt — und der Aktivierungslink erreicht gerade die, die sie noch nicht haben.
- **Dateien in `public/`, keine Pages Function.** Die Werte sind fest, `_headers`
  setzt den Inhaltstyp. Eine Function wäre Laufzeit für etwas, das ein Bau
  erledigt.
- **Der SPA-Fallback bleibt unangetastet.** Er ist der Grund, warum der Weg OHNE
  App funktioniert. Statische Dateien haben bei Pages ohnehin Vorrang.
- **Android beansprucht dieselben vier Pfade wie iOS** (Entscheidung 9, beide
  Reviewer). Ohne `pathPrefix` beanspruchte Android die **ganze Domain**: ein
  Passwort-Link öffnete dort die App und auf iOS den Browser.
- **Die Zielerhaltung läuft über den Navigationszustand, nicht über einen
  Query-Parameter.** `LoginPage` führt schon `?modus=`, und ein Ziel im Query
  stünde in jedem Zugriffsprotokoll.
- **`/passwort-neu` bleibt bewusst draußen** (Entscheidung 10). Wer zurücksetzt,
  kommt gerade nicht hinein; der Browser ist dafür der verlässlichere Ort.
- **Der Upload-Fingerabdruck jetzt, Googles in M4** (Entscheidung 6). „M3 fertig"
  heißt danach *am Gerät belegt*, **nicht** *über den Store funktionierend*.

### Zwei Befunde, am Repo nachgeprüft und bestätigt

- **`RequireAuth.tsx` verwirft den Ort.** `<Navigate to="/login" replace />` —
  die Zielerhaltung hat heute keinen Anker im Bestand.
- **Der Aktivierungs-Token steht im FRAGMENT**, nicht im Query
  (`src/instrument.test.ts:37`, `App.test.tsx:232`). Die Übersetzung muss
  `pathname` + `search` + **`hash`** mitführen, sonst öffnet die App den
  Aktivierungsweg ohne Token.

### Einer teilweise widerlegt

`ActivationGate` **navigiert nicht**, es tauscht den gerenderten Baum
(`return <ActivationScreen />`). Die Adresse bleibt stehen, das Ziel geht dort
nicht verloren. Die Zusage ist trotzdem gepinnt (Aufgabe 7.3b), weil sie heute
nur aus der Bauart folgt.

## Files modified

Alles in `30d7e98`, ausschliesslich unter `openspec/changes/deep-links/`:
`proposal.md`, `design.md` (11 Entscheidungen), `specs/native-shell/spec.md`
(alles ADDED), `tasks.md` (9 Blöcke), `REVIEWS.md` (mit verifiziertem Trailer).

**Unberührt:** `src/`, `ios/`, `android/`, `public/`, `supabase/`.

Verworfen wurden die `cap sync`-Rückstände der Vorsitzung (`Package.swift`,
`Package.resolved`, Capacitor 8.5.0 → 8.5.1). Sie sind eine **vorbestehende
Drift auf `main`** — dort steht 8.5.0, während `package.json` `^8.5.1` sagt —
und gehören nicht in diesen Change. Gesichert als Patch im Scratchpad.

## Next session: start here

**Erster Handgriff: §3, die drei roten Tests für die Auslieferung.** Ohne die
Dateien am Netz ist alles Weitere nicht belegbar.

```
cd ~/worktrees/fbc-platform/donald-age-643-deep-links
git log --oneline -1          # muss 30d7e98 sein
cat openspec/changes/deep-links/tasks.md
```

Danach §4 (die beiden Dateien), §6 (Zuhörer auf `appUrlOpen`, **mit Fragment**),
§7 (Zielerhaltung in `RequireAuth.tsx` und `LoginPage.tsx`).

**Was Donald tun muss, und erst bei §5 bzw. §8:**

1. **Apple-Portal:** Fähigkeit *Associated Domains* an der App-ID setzen —
   **vor** dem ersten Bau. Sonst greift die Signierung zum Wildcard-Profil und
   der Bau scheitert, wie bei `aps-environment` in M2.
2. **Ein Gerät.** Entitlement und Manifest reisen **nicht** über OTA. Geplanter
   Weg: Direktinstallation aus Xcode auf ein registriertes Gerät.

**Und die grössere Reihenfolge:** Donald hat am 11.09. entschieden, **erst M3,
dann M4**. In AGE-644 wartet der längste Weg des ganzen Vorhabens — Googles
Testzwang für neue Einzelentwickler-Konten ist eine **Wartezeit**, keine
Qualitätshürde, und kann unabhängig von M3 starten. Wenn er das Google-Konto
anlegt, sollte er die Mindestzahl Tester und die Mindestlaufzeit **in der Play
Console ablesen**, nicht schätzen.

## Open questions

- **Liest diese Sitzung den Keystore aus Infisical?** Ungemessen. `pnpm
  android:keystore` ist der Weg; sonst ist Aufgabe 4.2 ein Handgriff für Donald.
  Der Keystore darf den Baum nicht verlassen — der Wächter bricht sonst den Lauf.
- **`_headers` für eine endungslose Datei ist ungemessen.** Dass die Datei
  ausgeliefert wird, ist belegt; dass die Typ-Regel greift, nicht.
- **AGE-643 trägt im Rumpf noch „blockiert durch AGE-256"**, obwohl AGE-256
  erledigt ist und die Domain seit dem 01.09. läuft. Beim Abschluss entfernen
  (Aufgabe 9.6).
- **`pnpm format:check` ist rot** — Vorzustand, läuft in keinem CI-Workflow.
  Niemals `pnpm format` laufen lassen, es schreibt ~60 fremde Dateien um.
