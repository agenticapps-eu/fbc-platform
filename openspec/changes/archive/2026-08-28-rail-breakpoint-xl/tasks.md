# Aufgaben — AGE-652

## 1. Den Widerspruch belegen, bevor er aufgelöst wird

- [x] Beide Anforderungen nebeneinandergelegt: „The application shell docks the
      navigation to the viewport edge" (`:280`, sagt `xl` für die rechte Leiste,
      mit der Messung, die dazu führte) gegen „The right docked bar starts
      collapsed and remembers its own state" (`:1406`, sagt `lg`).
- [x] Die Quelle im Code benannt: `AppShell.tsx:713`,
      `hidden flex-col border-l xl:flex`. **Als Bestätigung, nicht als
      Begründung** — die Autorität ist die andere Anforderung.

## 2. Messprotokoll

Alles am 28.08.2026 gemessen, Chrome über CDP (`chrome-devtools`-MCP), Vite auf
`localhost:5311` aus diesem Worktree, Branch `donald/age-652-rail-breakpoint-xl`
auf `c540f4b`. Konto `anna@chattest.invalid` (lokaler Stack, aktiviert,
`impact`). Viewports über `emulate`, **nicht** über `resize_page` — letzteres
liess `innerWidth` unverändert bei 1688 und hätte drei falsche Messungen ergeben.

- [x] **Die Schwelle ist wirklich 1280 px, nicht angenommen.** Wurzelschriftgrösse
      im Browser gemessen: 16 px; Tailwind v4 liefert `--breakpoint-xl: 80rem`
      (`node_modules/tailwindcss/theme.css:330`), im `@theme`-Block des Projekts
      nicht überschrieben. 80 × 16 = 1280.
- [x] **Die Kante abgetastet, nicht zwei entfernte Punkte verglichen:**

      | Viewport | rechter Rail | linke Leiste (Positivkontrolle) |
      | --- | --- | --- |
      | 1279 px | `display: none`, Breite **0** | **256 px** |
      | 1280 px | `display: flex`, Breite **72 px** | 256 px |

      Der Sprung liegt exakt zwischen 1279 und 1280. Die linke Leiste ist die
      Positivkontrolle: ohne sie wäre „nichts zu sehen" nicht von „die Messung
      lief ins Leere" zu trennen.
- [x] **Der Erstbesuch-Zustand wurde hergestellt, nicht unterstellt.** Erste
      Messung war wertlos — `fbc.chatCollapsed` stand auf `"1"`, gemessen wurde
      also ein gespeicherter Zustand. Schlüssel entfernt (`vorher: "1"`,
      `jetzt: null`), neu geladen: die Leiste startet **eingeklappt auf 72 px**
      und schreibt den Vorgabewert sofort zurück. Erst das belegt das Szenario.
- [x] **`/chat` bei 1688 px**: der Rail ist **gar nicht im DOM**
      (`railImDom: false`), linke Leiste steht mit 256 px. Belegt, dass
      „opens any page" falsch war.

## 3. Prüfen, dass nur diese Stelle betroffen ist

- [x] **Alle** `lg`-Nennungen in `design-system/spec.md` durchgegangen: `:258`,
      `:308`, `:331`, `:347`–`:358`, **`:392`**, `:746`. `:392` nennt
      `lg:grid-cols-3` als Tailwind-Klasse in einem Absatz über Spaltenraster —
      ohne Bezug zum Andocken der Leisten. Alle übrigen betreffen die
      **Navigation**, die tatsächlich an `lg` andockt, oder nennen das Band
      `lg`–`xl` ausdrücklich als Band.
- [x] **Über alle Spec-Dateien hinweg**, nicht nur diese eine: `design-system`
      ist die **einzige** Datei, die `lg`/`xl` überhaupt trägt, und keine andere
      erwähnt die rechte Leiste. Dass die Suche `feedback-qm` mit seinem `sm`
      fand, ist die Positivkontrolle — sie erreicht andere Dateien wirklich.

## 4. Der Delta-Spec

- [x] `MODIFIED`-Block, der die Anforderung **vollständig** neu ausstellt.
- [x] **Maschinell gegen die heutige Fassung diffed**, statt es zu behaupten:
      42 → 56 Zeilen, Abweichung nur an den im Proposal genannten Stellen.
      **Vier Szenario-Titel, zeichengleich, Anzahl unverändert.**

      Der Grund für diese Prüfung: ein `MODIFIED`-Block überschreibt die alte
      Fassung ganz. Ein umbenanntes oder verlorenes Szenario fiele weder bei
      `validate` noch beim Lesen auf — nur `openspec archive` bräche ab, und
      eine still gelöschte Klausel nicht einmal das.
- [x] `openspec validate --all` grün.

## 5. Plan-Review (Schritt 2b)

- [x] Drei Reviewer, drei Anbieter, drei Modelle, keiner davon `claude`:
      gemini (APPROVE), codex/`gpt-5.6-sol` (REQUEST-CHANGES),
      opencode/`hf:moonshotai/Kimi-K3` (REQUEST-CHANGES). `REVIEWS.md`.
- [x] Zwei HIGH und zwei MEDIUM eingearbeitet, jede Auflösung dort begründet.

## 6. Abschluss

- [x] `openspec archive rail-breakpoint-xl`. Angewandt: `~ 1 modified`, keine
      Anforderung hinzugefügt oder entfernt. Der Diff in `openspec/specs/` ist
      16 Zeilen dazu, 2 ersetzt — kein Szenario verloren.
- [x] `pnpm release:entries` + `prettier --write` auf **genau dieser** Datei.
      **Das ändert `src/content/release-entries.generated.ts` um einen Eintrag**
      — im Proposal begründet, kein Versehen. Die Aufgabe wegzulassen macht
      `scripts/release-entries.archiv.test.ts` rot. Gemessen: +10 Zeilen, rein
      additiv, genau ein neuer Slug.
- [x] `vitest run`: 177 Dateien, **2019 Tests** grün. `tsc --noEmit` ohne
      Ausgabe, Exit 0.
- [ ] Commit, PR, CI grün, Deploy auf der HEAD-SHA von `main` nachgesehen.

**Kein Linear-Statuswechsel von Hand** (ein Reviewer forderte ihn). Die
GitHub-Automation schaltet AGE-652 bei PR-Öffnung auf *In Progress* und beim
Merge auf *Done*; ein zusätzlicher Schreibvorgang wäre eine zweite Quelle für
denselben Zustand.

## Kein Test, und warum

Eine Spec-Zeile hat kein Laufzeitverhalten. Ein Test darüber prüfte nur, dass
die Datei den Text enthält, den man gerade hineingeschrieben hat — er wäre durch
sein eigenes Ziel erfüllt und könnte nie rot werden. Der Beleg ist das
Messprotokoll in Abschnitt 2, und es war rot, bevor es grün war: die Spec sagte
`lg`, der Browser sagte bei 1279 px `display: none`.
