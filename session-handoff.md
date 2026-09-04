# Session Handoff — 2026-09-04 (AGE-542 und AGE-618: beide fertig, beide ausgeliefert)

> ## ⚠ ZUERST — drei Dinge
>
> **1. Diese Übergabe führt AGE-542 und AGE-618.** Zwei Vorgänge, aber dieselbe
> Arbeit: 618 ist ausdrücklich als „dieselbe Klasse wie AGE-542" angelegt — eine
> Zusage, die von der Disziplin künftiger Diffs abhing statt von einer Prüfung.
> Die Datei ist für alle parallelen Sitzungen dieselbe und kollidiert bei jedem
> Rebase. **Nicht zusammenführen.** Frühere Fassungen:
> `git log --oneline -- session-handoff.md`.
>
> **2. AGE-642 läuft PARALLEL** (Worktree
> `fbc-platform.donald-age-642-capacitor-huelle`). **Nicht anfassen.** Hat am
> 04.09. selbst #330, #331 und #333 nach `main` gebracht. Der Push-Absturz am
> Gerät (`AppShell.tsx` → Firebase FATAL) **bleibt dort** — von Donald am 04.09.
> so entschieden; diese Sitzung hat `AppShell.tsx` nicht angefasst.
>
> **3. Beides ist ABGESCHLOSSEN.** Gebaut, fremdreviewt, gemerged, archiviert,
> Linear auf Done, Worktrees abgeräumt. Offen ist nichts, was dieser Sitzung
> gehört.

## Accomplished

Vier PRs, alle gemerged. `main` steht bei `dae9003`.

| PR | Was |
|---|---|
| **#332** | AGE-542: der anon-Wächter leitet seine Fläche ab statt sie abzuschreiben |
| **#334** | AGE-542 archiviert, Delta gefaltet, Neuigkeiten nachgezogen |
| **#335** | AGE-618: Wächter gegen Einbettung am `VideoEmbed` vorbei |
| — | diese Übergabe |

**Endstand:** `pnpm test` **2536/2536** (223 Dateien) · `lint`, `typecheck`,
`build` je Exit 0 · `openspec validate --all` 31/31 · Linear 542 und 618 **Done**.

### Was jetzt live ist

- **Der anon-Wächter leitet seine Prüffläche ab** — aus `navItems` (ohne
  `requiresAuth`/`minTier`), aus der importierten `rechtsseiten`-Registry und
  aus einer namentlich geführten Restliste. Jede Route wird **montiert**, samt
  echtem `AuthProvider`; `src/test/anon-sonde.ts` hält jede Relation und jeden
  Funktionsnamen fest. Der Rand ist über den TypeScript-AST auf `App.tsx` selbst
  zugesichert und fällt geschlossen aus.
- **Ausgeloggt fällt ein 401 weg.** `FeedbackButton` fragte `feedback_themes` an,
  eine nur für `authenticated` lesbare Relation. Behoben an der **Abfrage**
  (`enabled: Boolean(user)`), nicht am Recht.
- **Das Einwilligungstor für Video-Einbettungen ist eine Dauerkontrolle.** Kein
  `<iframe>`/`<embed>`/`<object>` ausserhalb von `VideoEmbed.tsx`, kein
  Asset-Host ausserhalb namentlich genannter Dateien, kein `preconnect` in
  `index.html`. Läuft über `pnpm test` und damit in `verify`.

## Decisions

- **Der Neuigkeiten-Eintrag zu AGE-542 wird NICHT freigegeben.** Donald am
  04.09.: für Mitglieder ändert sich nichts Sichtbares. Der Eintrag bleibt im
  Bestand und unveröffentlicht — es gibt keinen Weg, einen archivierten Change
  ganz von den Neuigkeiten auszunehmen, das Tor ist die Admin-Freigabe.
- **AGE-618: die Grenze liegt schärfer als die Abnahme sie beschrieb**, und das
  ist gemessen. Der Vorgang wollte JEDE Anbieter-Domäne ausserhalb dreier
  Dateien verbieten; das wäre gegen den Bestand sofort rot, weil
  `AcademyPage.tsx` drei `youtube.com/watch`-URLs als **Daten** führt, die durch
  `<VideoEmbed>` laufen. Getrennt wird deshalb: **Quell-URLs sind Daten**
  (überall erlaubt), **Asset-Hosts sind Anfragen** (nur benannte Dateien).
- **`VideoEmbed.tsx` steht NICHT in der Host-Ausnahmeliste**, obwohl es die
  einbettende Komponente ist. Nachgemessen nennt es nach Kommentar-Entfernung
  keinen Asset-Host — der Eintrag wäre ein toter Freibrief gewesen.
- **AGE-618 bekam keinen OpenSpec-Change.** Eine Datei, keine Produktivlogik —
  die Routing-Tabelle sieht dafür TDD → verification → branch-close vor, und
  CLAUDE.md verbietet einen Worktree für Einzeldatei-Arbeit. Die gelockte
  Entscheidung (welche Hosts) steht im Testkopf.
- **AGE-542: die Sicherheit liegt in der Positivkontrolle, nicht im
  Ruhefenster.** Gegengeprüft: Fenster auf 10 ms → rot, zurück auf 450 ms → grün.

## Files modified

**AGE-542:** `src/components/feedback/FeedbackButton.tsx` (eine `enabled`-Zeile),
`src/lib/anon-anreicherung.test.ts` (301 → 148 Zeilen), neu
`src/lib/anon-flaeche.test.tsx` (33 Zusagen) und `src/test/anon-sonde.ts`.
Archiv: `openspec/changes/archive/2026-09-04-anon-waechter-reichweite/`,
gefaltet nach `openspec/specs/directory-search/spec.md`.

**AGE-618:** neu `src/components/ui/einbettung-nur-ueber-videoembed.test.ts`
(9 Zusagen), sonst nichts.

### Gitignorierte Werkzeuge, gerettet nach `.gstack/` im Haupt-Checkout

- `probe-eintrag.mts` — zeigt den Neuigkeiten-Eintrag, den der Parser aus einem
  Proposal machen würde, **vor** dem Archivieren
  (`pnpm tsx .gstack/probe-eintrag.mts <change-id>`). Hat bei AGE-542 verhindert,
  dass ein längst verworfener Bezeichner an die Mitglieder ging.
- `eingriff.py` + `eingriffe/` — schaltet die drei AGE-542-Abnahme-Eingriffe
  einzeln (`python3 .gstack/eingriff.py A|B|C on|off`, `status`).
- `prod-anon-katalog.mts` + `run-anon-katalog.sh` — misst rein lesend am
  PROD-Katalog, welche Funktionen und Relationen `anon` wirklich halten darf.

## Next session: start here

**Für AGE-542 und AGE-618 gibt es keinen nächsten Handgriff.** Beide Worktrees
sind entfernt (1,6 GB frei); es steht nur noch der von AGE-642, und der gehört
der Nachbarsitzung.

Wer hier weitermacht, nimmt einen neuen Vorgang. Offene Kandidaten im
Go-Live-Projekt, alle ungeplant: **AGE-605** (`event_registrations`: direkte
Schreibzugriffe umgehen die DEFINER-RPCs), **AGE-607** (Überlauf im Browser
messen statt im Quelltext), **AGE-630** (Events: Vorlagen und wiederkehrende
Termine), **AGE-522** (zwei Wegwerf-Testkonten aus der Live-DB — Schreibweg auf
PROD, gehört Donald vorgelegt). **AGE-610** (Klärungen mit Detlev und dem
Anwalt) ist High, aber kein Code.

## Open questions

- **`pnpm lint` ist im Haupt-Checkout rot — vorbestehend und fremd.** Alle
  Fehler stammen aus `.gstack/age595/` und `.gstack/age602/`, Sondierungs-
  skripte längst erledigter Sitzungen. `.gstack/` ist gitignoriert, CI sieht es
  nie; über `src scripts functions` steht es bei 0 Fehlern. Wer die alten
  Verzeichnisse wegräumt, macht `pnpm lint` lokal wieder brauchbar — eine
  Operator-Entscheidung.
- **Drei Remote-Zweige stehen nach dem Merge noch auf `origin`**
  (`donald/age-542-anon-waechter-reichweite`, `donald/age-542-archiv`,
  `donald/age-618-waechter-gegen-einbettung`). Lokal sind sie weg. Aufräumen ist
  Donalds Entscheidung, nicht meine.
- **Ein Wächter gegen Fremdursprünge allgemein** (Schriften, Bilder, Skripte)
  ist ausdrücklich nicht Teil von AGE-618. `design-system` führt dafür zwei
  Anforderungen; sie verdienen denselben Schutz, aber als eigener Vorgang.
- **Gehört die anon-Anforderung noch unter `directory-search`?** Sie regelt jetzt
  Feed, Events, Anmeldung, Hülle und Funktionsaufrufe; codex schlug
  `access-control` vor. Bewusst nicht in AGE-542 — der Umzug ist ein `REMOVED`
  plus `ADDED` über zwei Capabilities, also genau die Archiv-Mechanik, an der
  AGE-598 Zeit verloren hat.
- **`/styleguide` ist eine namentliche Ausnahme** in `NUR_IM_DEV_BUENDEL`, statt
  ihre DEV-Bedingung im AST nachzuweisen — die weichste Stelle des
  anon-Prüfstands.
- **Zwei Escape-Lauscher in `AppShell.tsx` sind weiterhin ungemessen**
  (Profilmenü, Nachrichten-Schublade) — offen aus AGE-697, kein Vorgang dafür.
- **`node_modules` veraltet nach einem `main`-Pull.** Nach den Capacitor-
  Änderungen aus AGE-642 fehlten die Pakete: 102 rote Testdateien, `typecheck`
  Exit 2 — sah aus wie ein Schaden am eigenen Change und war keiner.
  `pnpm install` behob es. Wer `main` zieht und rote Läufe sieht, prüft das
  zuerst.
