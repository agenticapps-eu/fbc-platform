# Session Handoff — 2026-09-08 (AGE-642 Phase C zu; nächster Auftrag: Kontolöschung)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie schliesst die AGE-642-Gerätesitzung ab** (Worktree
> `fbc-platform.donald-age-642-capacitor-huelle`) **und zeigt auf einen anderen
> Vorgang weiter.** Die Datei ist für alle parallelen Sitzungen dieselbe und
> kollidiert bei jedem Rebase — **nicht zusammenführen**, überschreiben.
>
> **2. Sie ersetzt drei frühere Fassungen von heute:** `f7116df`, `3fc0f7b`,
> `55aae39` — jeweils `git show <sha>:session-handoff.md`.
>
> **3. Die AGE-642-Belege im Detail stehen NICHT hier**, sondern in
> `openspec/changes/capacitor-huelle/tasks.md` (A1, C1, C2, C3, B5, Phase E).

## Accomplished

**Phase C ist zu.** Fünf Gerätezeilen standen morgens offen, alle fünf sind
belegt — iPhone 17 Pro (`544B9818-…`) und Pixel 11 Pro (`67011FDKX006NA`).

| | Beleg |
|---|---|
| **A1** | Neustart → Feed; abmelden + Neustart → Anmeldemaske. Dazu `Preferences get` → `access_token` aus der Gerätekonsole |
| **C1** | Kopfzeile unter der Dynamic Island, Leiste frei vom Home-Indikator |
| **C2** | drei Ebenen, Overlay, zweimal zurück — gegengemessen: `topResumedActivity` steht noch auf der App |
| **C3** | iOS **und** Android: eigene Rückfrage, Kamera, Galerie, Bild auf dem Profil |
| **B5** | `[B5-SONDE] head {…"ergebnis":true,"boot":"nativ"}`, `display:"block"`, `hoehe: 874` (quer 402), `nochDa:false` |

**Ein Fehler gefunden, behoben, ausgeliefert:** der Zoom-Regler im Zuschnitt war
am Finger nicht bedienbar (weisser System-Knopf auf weisser Karte, 30 px
Trefffläche). `.fbc-regler`, PR **#369** (`3fc0f7b`), per OTA auf beide Geräte —
ohne Neuinstallation, ohne Abmeldung. Belegt am Artefakt: das aktive Bündel
`kloBmA6Vth` trägt alle fünf Regeln, das vorherige `mFhneNaJLK` hat 0 Treffer.
PR **#370** (`55aae39`) trägt die Belege nach.

## Decisions

- **Chat, Realtime und die Web-Sitzung werden NICHT belegt** (Donald, 08.09.):
  „das werde ich schon melden, wenn es nicht geht." Die Geräte laufen gegen
  PROD, dort gibt es kein zweites Konto — ein Realtime-Beleg hiesse, in echte
  Mitgliederdaten zu schreiben. **Die drei Kästchen bleiben offen und sollen
  offen bleiben. Nicht jagen.**
- **Nächster Auftrag ist die Kontolöschung**, nicht TestFlight und nicht die
  Store-Einreichung (Donald, 08.09., nach der Korrektur unten).
- **Quer bleibt, wie es ist** — die Startfläche wäscht quer aus, beide Schichten
  tun aber dasselbe, es gibt keine Naht. Eigener Ausschnitt wäre eine
  Entscheidung über Bildmaterial.
- **`OnboardingPage.tsx:212` bleibt unangetastet** — derselbe Reglerfehler
  schärfer, aber eigene Optik auf dunklem Chrome, nie am Gerät gesehen.

## Files modified

Alles gemergt, Arbeitsbaum sauber, Branch auf `origin/main` (`55aae39`).

- `src/index.css` · `src/components/profile/AvatarCropper.tsx` ·
  `src/zoom-regler.test.ts` *(neu)* — in `3fc0f7b`
- `openspec/changes/capacitor-huelle/tasks.md` — in beiden PRs

## Next session: start here

**Die Kontolöschung ist bereits geplant und reviewt — es fehlt allein die
Umsetzung.** Nicht bei null anfangen, nicht neu proposen:

```
openspec/changes/add-dsgvo-compliance/     16 Aufgaben, 0 erledigt
  proposal.md · specs/privacy/spec.md · tasks.md · REVIEWS.md
```

Die einschlägigen Stellen: `tasks.md` **2.3** („Erasure that deletes/anonymises
app data AND removes `auth.users`") und **5.4** (der Test dazu), im Spec die
Requirements *„Members can exercise access, portability, and erasure"* und
*„Erasure respects retention duties and the auth identity"*.

**Erste Handlung — die Zuschnittsfrage stellen, bevor irgendetwas gebaut wird.**
Apple verlangt genau eine Sache: wer ein Konto in der App anlegen kann, muss es
**in der App** löschen können. Der Change daneben ist viel grösser (Rechtsgrund
je Zweck, versionierte Einwilligung, DSAR-Export, Audit-Log). Entweder die
Löschung als eigener, kleiner Change herausschneiden, oder den grossen ganz
umsetzen — **das ist Donalds Entscheidung, nicht die des nächsten Modells.**

Danach Worktree anlegen, nicht hier weiterarbeiten:
`/wt-switch-create donald/age-260-…` (Linear-Format wie in diesem Repo üblich).

> ⚠ **`REVIEWS.md` dieses Changes steht auf `REQUEST-CHANGES`** (gemini,
> 26.07.), und niemand hat es abgearbeitet: bemängelt werden unscharfe
> Definitionen („personal data", „sensitive member data") und ein fehlender
> Einwilligungs-Lebenszyklus. Das §18-Gate meldet die Datei ausserdem als
> **trailer-absent**. Vor dem ersten Code klären, sonst baut man gegen einen
> Plan, den ein Reviewer schon zurückgewiesen hat.

> ⚠ **KORREKTUR, die seit Tagen in jeder Übergabe falsch stand:** „danach
> TestFlight unter AGE-644" stimmt nicht. **AGE-644 schliesst TestFlight
> ausdrücklich aus** („Nicht in diesem Change: TestFlight-Beta für Mitglieder").
> AGE-644 ist die Store-Einreichung und hängt an Konto-Entscheidungen (Person
> oder Firma → Detlev), Prüfer-Zugang, Datenschutzformularen — **und genau an
> der Kontolöschung.** Wer TestFlight will, braucht dafür einen eigenen Vorgang;
> `ios-release.yml` hört heute bei `--validate-app` auf.

> ⚠ **`src/vision/` ist toter Code** und der einzige Treffer bei einer Suche
> nach „Konto löschen". Es gibt heute nichts davon im Produkt.

> ⚠ **Der Linear-Status kippt bei JEDEM Merge auf Done** (Branchname trägt die
> Issue-Nummer). Heute dreimal zurückgesetzt. Nach jedem Merge nachsehen.

> ⚠ **Squash-Falle.** Nach jedem Merge `git log origin/main..HEAD` prüfen und
> auf `origin/main` zurücksetzen; der nächste Push braucht `--force-with-lease`.

> ⚠ **`tasks.md` nie durch `prettier --write` schicken** (~1000 fremde Zeilen).
> Sie ist bereits an `HEAD` unformatiert, das ist der Normalzustand.

> ⚠ **Aus der Gerätesitzung, falls wieder eine ansteht:** eine Installation über
> `devicectl`/`adb` erreicht die **Weboberfläche nicht**, solange ein OTA-Bündel
> liegt — auf iOS hilft nur Deinstallieren (kostet die Anmeldung), auf Android
> die zwei Runden. Und an diesem Mac lässt sich immer nur **ein** Gerät prüfen.

## Open questions

- **Zuschnitt der Kontolöschung** — kleiner eigener Change oder der ganze
  DSGVO-Block? Siehe oben, gehört Donald.
- **TestFlight** hat heute keinen Vorgang. Fremde Vorgänge lege ich nicht selbst
  an.
- **Querformat-Startfläche**, **Regler in `OnboardingPage.tsx:212`**,
  **`pnpm splash --check` in der CI** — drei kleine offene Punkte aus AGE-642.
- **„Build-Nummer = Lauf-Nummer" ist NICHT bewiesen** — Lauf 1 verglich 1 mit 1.
- **`APNS_SANDBOX` steht auf `1`** — beim ersten TestFlight-Build nachsehen.
