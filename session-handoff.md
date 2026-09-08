# Session Handoff — 2026-09-08 (AGE-642: Phase C ist zu, beide Geräte belegt)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie führt nur AGE-642** (M2, Capacitor-Hülle), Worktree
> `fbc-platform.donald-age-642-capacitor-huelle`. Die Datei ist für alle
> parallelen Sitzungen dieselbe und kollidiert bei jedem Rebase — **nicht
> zusammenführen**, überschreiben.
>
> **2. Sie ersetzt zwei frühere Fassungen von heute.** Die vom Vormittag
> (`git show f7116df:session-handoff.md`) und die vom Mittag
> (`git show 3fc0f7b:session-handoff.md`).
>
> **3. Die Belege im Detail stehen NICHT hier**, sondern in
> `openspec/changes/capacitor-huelle/tasks.md`, Abschnitte A1, C1, C2, C3, B5
> und Phase E.

## Accomplished

**Phase C ist zu.** Alle fünf Gerätezeilen, die heute früh offen standen, sind
belegt — auf iPhone 17 Pro (`544B9818-…`) und Pixel 11 Pro (`67011FDKX006NA`).

| | Beleg |
|---|---|
| **A1** | Neustart → Feed; abmelden + Neustart → Anmeldemaske. Dazu `Preferences get` → `access_token` aus der Gerätekonsole |
| **C1** | Kopfzeile unter der Dynamic Island, Leiste frei vom Home-Indikator |
| **C2** | drei Ebenen, Overlay, zweimal zurück — gegengemessen mit `dumpsys activity`: `topResumedActivity` steht noch auf der App |
| **C3** | iOS **und** Android: eigene Rückfrage, Kamera, Galerie, Bild auf dem Profil |
| **B5** | `[B5-SONDE] head {…"ergebnis":true,"boot":"nativ"}`, `display:"block"`, `hoehe: 874` (quer 402), `nochDa:false` |

**Ein echter Fehler gefunden und ausgeliefert.** Der Zoom-Regler im Zuschnitt war
am Finger nicht bedienbar — weisser System-Knopf auf weisser Karte, 30 px
Trefffläche. Behoben als `.fbc-regler`, **PR #369 gemergt** (`3fc0f7b`), über OTA
auf beide Geräte gelaufen (`0.0.0+3fc0f7b0229e`) — ohne Neuinstallation, ohne
Abmeldung.

Der belastbarste Beleg dafür kam ohne Auge: `adb shell run-as … cat
files/versions/kloBmA6Vth/assets/index-PGy4maTF.css` zeigt alle fünf Regeln, das
zuvor aktive Bündel `mFhneNaJLK` hat **0 Treffer** — Positivkontrolle zur
Negativprobe.

## Decisions

- **Realtime und Chat werden NICHT auf PROD belegt** (Donald, 08.09.): „ich kann
  das nicht einfach so machen, weil ja produktiv." Es gibt dort kein zweites
  Konto, und ein Beleg hiesse, in echte Mitgliederdaten zu schreiben. Der Weg
  ist DEV, als eigene Sitzung.
- **Der Regler-Fix gehört in diesen Change**, obwohl nicht geplant: er liegt auf
  genau der Fläche, die C3 belegt.
- **`OnboardingPage.tsx:212` bleibt unangetastet** — derselbe Fehler schärfer
  (`appearance-none` ohne Knopf-Regel), aber eigene Optik auf dunklem Chrome,
  nie am Gerät gesehen. Eigener Vorgang.
- **Quer bleibt, wie es ist.** Die Startfläche wäscht quer aus (Bandmittelwert
  RGB 148/139/134 gegen 129/123/117); beide Schichten tun dasselbe, es gibt
  keine Naht. Ein eigener Querformat-Ausschnitt wäre eine Entscheidung über
  Bildmaterial, keine Zeile Code.

## Files modified

- `src/index.css` — `.fbc-regler`, fünf Regeln *(in `3fc0f7b`)*
- `src/components/profile/AvatarCropper.tsx` — `accent-accent-strong` → `fbc-regler` *(in `3fc0f7b`)*
- `src/zoom-regler.test.ts` — **neu**, sieben Zusagen *(in `3fc0f7b`)*
- `openspec/changes/capacitor-huelle/tasks.md` — A1, C1, C2, C3, B5 belegt;
  Phase E mit Gründen versehen; drei neue offene Zeilen

## Next session: start here

**Der ganze Rest von Phase E hängt an einem einzigen Hindernis: die Geräte
laufen gegen PROD.** Also DEV-Sitzung: gegen DEV bauen, zwei QA-Konten, dann
Chat und Realtime in einem Durchgang — und danach zurück auf PROD. Beides kostet
je eine Anmeldung. Billig vorher mitzunehmen, ganz ohne Gerät: die
Web-Sitzungs-Zeile (`app.effbeezee.com` in einem Browser öffnen, in dem seit dem
Storage-Umbau nicht neu angemeldet wurde). Danach TestFlight unter **AGE-644**.

> ⚠ **An diesem Mac lässt sich immer nur EIN Gerät prüfen** — iPhone und Pixel
> hängen am selben Anschluss, Donald musste umstecken.

> ⚠ **Eine Installation über `devicectl` / `adb` erreicht die Weboberfläche
> NICHT**, solange ein OTA-Bündel liegt. Die erste B5-Messung kam deshalb mit
> **null** Zeilen zurück und sah aus wie ein Sachfehlschlag. Auf iOS hilft nur
> Deinstallieren (kostet die Anmeldung); auf Android die zwei Runden
> (`KEYCODE_HOME`, ~10 s, `am start`, dann ~25 s nichts anfassen) — die haben
> heute auf Anhieb funktioniert.

> ⚠ **`--terminate-existing` verhindert die OTA-Übernahme**, statt sie
> auszulösen: der Prozess wird getötet und geht nie in den Hintergrund.

> ⚠ **Nachbau eines Storyboards: `scaleAspectFill` ZENTRIERT.** Am oberen Rand
> ausgerichtet nachgebaut ergab es eine Diagnose, die vollständig aus dem
> eigenen Messfehler stammte.

> ⚠ **Die Zusagen prüfen die QUELLE, nicht das Artefakt.** Der Minifier liefert
> im Basis-Selektor nur `appearance:none` und lässt `-webkit-appearance` weg —
> `src/zoom-regler.test.ts` hätte das nie gesehen. Hier folgenlos.

> ⚠ **Der Linear-Status kippt bei JEDEM Merge auf Done** (Branchname trägt
> `age-642`). Heute zweimal zurückgesetzt. Nach jedem Merge nachsehen.

> ⚠ **Squash-Falle.** Nach jedem Merge `git log origin/main..HEAD` prüfen und
> auf `origin/main` zurücksetzen; der nächste Push braucht `--force-with-lease`.

> ⚠ **`tasks.md` nie durch `prettier --write` schicken** (~1000 fremde Zeilen).
> Sie ist bereits an `HEAD` unformatiert, das ist der Normalzustand.

## Open questions

- **Chat, Realtime und die Web-Sitzung** — die letzten drei Zeilen der Abnahme,
  die nicht an B3/M4 hängen. Grund und Weg stehen in `tasks.md`.
- **Querformat-Startfläche** — auswaschen lassen oder eigenen Ausschnitt wählen?
- **Zweiter Regler** in `OnboardingPage.tsx:212`.
- **„Build-Nummer = Lauf-Nummer" ist weiterhin NICHT bewiesen.** Lauf 1 verglich
  1 mit 1; erst Lauf 2 macht die Zusage echt.
- **`APNS_SANDBOX` steht auf `1`** — beim ersten TestFlight-Build nachsehen.
- **Der ASC-Schlüssel `ND87HL4S75` ist Team Scoped**, mehr Reichweite als nötig.
