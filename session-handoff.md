# Session Handoff — 2026-08-31 (AGE-642: der Luftweg ist auf PROD live, D5 ist dran)

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

**PR #299 ist gemerged** (Squash, `e8a2abc` auf `main`, 31.08. 13:33). Worktree
`fbc-platform.donald-age-642-capacitor-huelle`, Branch
`donald/age-642-capacitor-huelle` — auf den Squash nachgezogen, Arbeitsbaum
sauber, alles gepusht. Change `capacitor-huelle`: **31 offen, 87 erledigt.**
Linear steht auf *In Progress* (die Automation hatte beim Merge auf *Done*
gekippt, zurückgesetzt um 13:33 — sie tut das bei JEDEM Merge, der das Kürzel
im Branchnamen trägt).

## Accomplished

### 1 · Review-Runde 6 — und der schwerste Befund der ganzen Phase D

Zwei fremde Arme direkt per Bash, beide haben geliefert und beide haben selbst
gemessen: **opencode** 7 Befunde, **codex** 12. Jeder Beleg an der Plugin-Quelle
nachgeschlagen. **Elf übernommen, einer abgelehnt.** Steht als Runde 6 in
`REVIEWS.md`, mit gültigem Trailer (das Gate verifiziert ihn jetzt).

**codex, HOCH: der Rückweg deckte sein eigenes Motivszenario nicht ab.**
`notifyAppReady()` stand blank im Modulrumpf und ging bei der Modulauswertung
ab — vor dem ersten Rendern, vor `AuthProvider`, vor `src/lib/supabase.ts:10`,
das bei fehlender Konfiguration wirft. Ein Bündel, das lädt und dann **weiss
bleibt**, war damit bereits als erfolgreich gestempelt und fiel nie zurück.

Jetzt wartet die Bestätigung auf den ersten Element-Knoten unter `#root` —
Reacts erster Commit. Bleibt er aus, bleibt sie aus. Die Frist trägt das: 10 s
auf iOS, **mindestens 30 s auf Android**
(`PENDING_BUNDLE_APP_READY_MIN_TIMEOUT_MS`, `.java:134`), und `AuthProvider`
hält das erste Bild nicht auf (`AuthProvider.tsx:358`).

Zwei weitere HOCH-Befunde waren **fehlende Zusagen**: `if (!nativ)` wäre grün
gewesen und hätte auf JEDEM Gerät nie bestätigt (jsdom ist immer Web), und keine
Zusage belegte, dass `main.tsx` das Modul überhaupt einbindet — die Zeile zu
entfernen liess alles grün.

Aus 3 Zusagen sind 7 geworden, **jede einzeln durch eine Mutation
gegengeprüft**: alte Bauart · `if (!nativ)` · top-level `await` · Beobachter
entfernt · Import aus `main.tsx` entfernt · `autoDeleteFailed: true` · Zeile
gelöscht. Jede Mutation rötet genau die zugehörige Zusage, keine andere.

`17fd491`, danach alles grün: **2327 vitest (210 Dateien) · typecheck exit 0 ·
`pnpm lint` exit 0 · `openspec validate --all` 30/30 · CI 5/5.**

### 2 · Der Luftweg steht auf PROD — am lebenden Endpunkt belegt

`migrate-prod` gelaufen (Lauf `33421851095`, `plan` und `apply` grün, auf
`e8a2abc`), danach den Deploy neu gefahren (`33397608024`): **drift-gate,
migrate-dev, functions, deploy — alle vier grün.**

Sichtprobe gegen `viwntbodrtqxgmqyxluh` (PROD), 31.08.:

| Endpunkt | Antwort |
|---|---|
| `ota-update` | **HTTP 200**, bietet `0.0.0+e8a2abcdcb21` an — der Merge-Commit — mit `url` und `checksum` |
| `ota-channel` | HTTP 400 `channel_not_supported`, wie vorgesehen |
| `ota-stats` | HTTP 200 `{"status":"ok"}` |
| das Bündel selbst | HTTP 200, **2 997 808 B**, öffentlich abrufbar |

**Damit ist „der Weg über das Netz bleibt ungeprüft" erledigt** — Upload,
RPC-Aufruf, Manifest, Endpunkt-Entscheidung und Auslieferung greifen
ineinander. Ungeprüft ist nur noch das Gerät.

## Decisions

- **Runde 6 war fällig, weil das Spec-Delta nach Runde 5 gewachsen war.** Sie
  hat den schwersten Befund der Phase gebracht. Die Regel „Delta gewachsen ⇒
  neue Runde" hat sich an genau diesem Tag bezahlt gemacht.
- **Donald am 31.08.: sofort reparieren, nicht als Folgeaufgabe.** Die
  Alternative wäre gewesen, die SHALL-Zusage ehrlich zu verengen und den weissen
  Bildschirm ungeschützt zu lassen.
- **Nicht übernommen (1 von 12):** codex' NIEDRIG-Befund, `instrument.ts` könne
  vor `ota` schon senden. Sachlich richtig, aber Sentry MUSS der erste Import
  bleiben — sonst fehlen genau die Fehler des Starts.
- **`autoDeleteFailed: false` trägt keine ABSOLUTE Zusage:** `resetWhenUpdate`
  räumt bei einer neuen Schale aus dem Store alles ab, ERROR eingeschlossen.
  Das Delta sagt das jetzt selbst — und begründet, warum das richtig ist: die
  neue Schale ist der Weg, auf dem ein Fehler behoben wird.
- **Der `migrate-prod`-Dispatch ging über Donalds Hand.** Der
  Auto-Mode-Klassifikator blockt `gh workflow run` als Schreibweg auf PROD (und
  auch `gh run view --log` auf diesen Lauf). Wer das der Sitzung überlassen
  will, braucht eine Bash-Regel in den Einstellungen.

## Files modified

`src/lib/ota.ts` (wartet auf `#root`, `instanceof`-Fehlerzweig, vier
Quellenangaben korrigiert) · `src/lib/ota.test.ts` (7 Zusagen statt 3) ·
`capacitor.config.ts` (Kommentar: Reihenfolge entzerrt, Wachstumspreis,
`download()`-Zaun) · `scripts/capacitor-config.test.ts` (Testname ehrlich
gemacht) · `openspec/changes/capacitor-huelle/specs/native-shell/spec.md` (neue
Zusage „erst wenn ein Bild steht" + Szenario; `resetWhenUpdate`-Einschränkung) ·
`openspec/changes/capacitor-huelle/REVIEWS.md` (Runde 6, neuer Trailer).

## Next session: start here

**Erster Handgriff: D5, der Gerätebeleg** (`tasks.md:983`). Die Voraussetzung —
ein live geschalteter Luftweg — ist seit dem 31.08. erfüllt und oben belegt.
Zwei Kästchen, und das zweite ist das wichtigere:

1. Eine sichtbare Änderung erreicht ein Gerät ohne Store-Einreichung. Das Gerät
   soll `0.0.0+e8a2abcdcb21` ziehen, öffnen und in Betrieb nehmen.
2. **Und einmal der Rückweg**: ein absichtlich defektes Bündel ausliefern, Gerät
   landet wieder auf der vorigen Fassung. Ein Rückweg, den nie jemand ausgelöst
   hat, ist eine Behauptung — und genau diese Hälfte hat Runde 6 umgebaut.

## Open questions — alle innerhalb AGE-642

- **Kein einziger Beleg stammt von einem Gerät.** Belegt ist unsere Hälfte:
  sieben Zusagen, jede gegengeprüft. Was ein echtes Gerät mit dem Bündel macht,
  hängt an nativen Zeitgebern und ist in jsdom nicht herstellbar.
- **Vier Gerätebelege stehen aus:** C3 auf beiden Plattformen · C2 auf Android ·
  C1 auf iOS · B5 der Startbildschirm. **Für B5 muss die App gelöscht werden**,
  **und das kostet Donald die Anmeldung** — vorher ansagen.
- **B3 Signaturmaterial (4 offen):** Zertifikat, Provisioning Profile, Keystore.
  Donalds Hand. Das OTA-Schlüsselpaar ist erledigt und im Deploy gegengeprüft.
- **Der lokale Stack trägt die drei OTA-Migrationen nur von Hand** (per `psql`
  eingespielt, weil der Stack geteilt ist). Ein `supabase db reset` stellt sie
  korrekt her.
- **Nicht angefasst, ausserhalb AGE-642:** `docs/prod-neuaufbau-plan.md:31-32`
  beschreibt noch den Stand vor der Umschaltung vom 24.08. und nennt
  `foelowldexkcqzewvrcf` als Projekt der Live-Fläche — stimmt seitdem nicht
  mehr. `scripts/sync-dev-auszug.test.ts` ist per Bauart flakig. `ADR-0037`
  wird dreimal zitiert, existiert aber nicht.
