# Session Handoff — 2026-09-08 (AGE-642: die Gerätesitzung, A1/C1/C3/B5)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie führt nur AGE-642** (M2, Capacitor-Hülle), Worktree
> `fbc-platform.donald-age-642-capacitor-huelle`. Die Datei ist für alle
> parallelen Sitzungen dieselbe und kollidiert bei jedem Rebase — **nicht
> zusammenführen**, überschreiben.
>
> **2. Sie ersetzt die Fassung vom Vormittag** (B5 Boot-Fläche, iOS-Hälfte von
> B3). Wer die sucht: `git show f7116df:session-handoff.md`.
>
> **3. Die Belege im Detail stehen NICHT hier**, sondern in
> `openspec/changes/capacitor-huelle/tasks.md`, Abschnitte A1, C1, C3 und B5.

## Accomplished

Die Gerätesitzung aus der letzten Übergabe ist gelaufen, iPhone 17 Pro
(`544B9818-…`), iOS 26.6. **Vier Gerätebelege zu, einer bleibt offen, und
unterwegs fiel ein echter Fehler an.**

### Belegt

- **A1** — die Sitzung überlebt einen Neustart (Feed), und nach dem Abmelden
  kommt die Anmeldemaske. Die zweite Richtung ist die wertvollere: ein
  `removeItem`, das am Gerät ins Leere liefe, wäre in jsdom grün. Dazu aus der
  Konsole `Preferences get` → `access_token` — die Weiche greift nativ.
- **C1** — Kopfzeile unter der Dynamic Island, Leiste frei vom Home-Indikator,
  Chatfenster darüber. Sichtprobe, kein Bildschirmfoto (öffentliches Repo).
- **C3 (iOS)** — eigene Rückfrage geht auf, Kamera **und** Galerie liefern, Bild
  steht danach auf dem Profil. **Android bleibt offen**, hier hängt kein Gerät.
- **B5** — `[B5-SONDE] head {"capacitor":"object","isNativePlatform":"function",`
  `"ergebnis":true,"plattform":"ios","boot":"nativ"}`, dazu `display: "block"`
  und `hoehe: 874` (quer 402) und `nochDa: false` nach 5 s. Damit ist die eine
  Frage beantwortet, an der die Fläche still ausgefallen wäre. Hochkant
  ausserdem Donalds Blick: „Startbildschirm für sehr kurz und dann Feed".

### Gefunden und behoben — der Zoom-Regler im Zuschnitt

Donald am Gerät: „der Button ist kaum zu sehen weil weiss, und ausserdem muss
ich schon sehr drücken um ihn zu bewegen." Zwei Ursachen, beide am Desktop
unsichtbar: der System-Knopf von iOS ist **weiss** auf `--color-canvas`
(#ffffff), und `accent-color` färbt auf iOS die Schiene, nicht den Knopf; dazu
rund 30 px Trefffläche gegen Apples 44.

Behoben als `.fbc-regler` — 28-px-Knopf in `--color-accent-strong`, 2-px-Ring in
`--color-canvas`, 44 px Trefffläche über 6 px Schiene. Sieben Zusagen,
**sechs Mutationen alle rot**.

## Decisions

- **Der Regler-Fix gehört in diesen Change**, obwohl er nicht im Plan stand: er
  liegt auf genau der Fläche, die C3 gerade belegt hat, und ein Zuschnitt, den
  man nicht bedienen kann, macht den nativen Bildweg wertlos.
- **`OnboardingPage.tsx:212` wird NICHT mitgeändert.** Der Regler dort trägt
  denselben Fehler schärfer (`appearance-none` ohne jede Knopf-Regel, also
  vermutlich in jedem WebKit unsichtbar), aber er hat eigene Schienen-Optik auf
  dunklem Chrome, die nie am Gerät gesehen wurde. Eigener Vorgang.
- **Quer bleibt, wie es ist.** Die Komposition wäscht quer aus (Bandmittelwert
  RGB 148/139/134 gegen 129/123/117 hochkant), weil der zentrierte Ausschnitt
  eines Hochformat-Fotos in einem 3,5:1-Band die Wand *zwischen* den Personen
  trifft. Beide Schichten tun dasselbe, es gibt keine Naht. Das zu ändern wäre
  eine Entscheidung über **Bildmaterial**, keine Zeile Code.
- **Beide Pseudoelement-Sätze, nicht nur WebKit.** `appearance: none` nimmt in
  WebKit *und* Firefox Schiene und Knopf weg; nur den WebKit-Satz zu schreiben
  machte den Regler in Firefox unsichtbar statt blass — schlimmer als vorher.
- **Sonde nur ins gebaute `dist/`**, nie in `src/` — dieselbe Regel wie im
  D5-Runbook: kein Quelltext, den jemand zurückzunehmen vergisst.

## Files modified

- `src/index.css` — `.fbc-regler`, vier Regeln (Rumpf, zwei Schienen, zwei Knöpfe)
- `src/components/profile/AvatarCropper.tsx` — `accent-accent-strong` → `fbc-regler`
- `src/zoom-regler.test.ts` — **neu**, sieben Zusagen
- `openspec/changes/capacitor-huelle/tasks.md` — A1, C1, C3, B5 nachgezogen;
  zwei neue offene Zeilen (Onboarding-Regler, Querformat-Komposition)

## Next session: start here

**Der Regler-Fix ist noch nicht am Finger geprüft**, und das ist der erste
Punkt. Er braucht nichts: sobald das hier auf `main` ist, baut die CI ein
OTA-Bündel, und das Gerät holt es sich beim nächsten Hintergrundwechsel von
allein — **kein Neuinstallieren, keine erneute Abmeldung**. Also mergen, Donald
den Zuschnitt einmal aufmachen lassen, dann ist C3 ganz zu. Danach TestFlight
unter **AGE-644**, eigener Vorgang.

> ⚠ **Eine Installation über `devicectl` erreicht die Weboberfläche NICHT.**
> Gemessen 08.09.: die erste Sondenmessung kam mit **null** Zeilen zurück, weil
> die WebView capgos Bündel `0.0.0+ab7732c5a532` lud statt `App.app/public/`
> (`CapgoUpdater : Version successfully loaded: {"id":"bvlIRVRtZU"…}`). Das sah
> aus wie „die Boot-Fläche fällt aus" und war das Messverfahren. Erst
> **Deinstallieren** wischt capgos Zustand, danach läuft `builtin`
> (`"version":"1.0.0"`). Dieselbe Falle wie mit `adb install` auf Android.

> ⚠ **`--terminate-existing` verhindert die OTA-Übernahme.** Der Prozess wird
> getötet, geht also nie in den Hintergrund — deshalb lief nach dem
> Deinstallieren auch bei jedem weiteren Konsolenstart noch `builtin`. Zum
> Mitlesen taugt der Schalter, zum Auslösen nicht.

> ⚠ **Nachbau eines Storyboards: `scaleAspectFill` ZENTRIERT.** Am oberen Rand
> ausgerichtet nachgebaut ergab es „quer zeigt nur die weisse Wand" — eine
> Diagnose, die vollständig aus meinem eigenen Messfehler stammte. Zentriert
> stimmen native und Web-Fläche überein.

> ⚠ **Der Linear-Status kippt bei JEDEM Merge auf Done.** Der Branchname trägt
> `age-642`. Nach dem Merge nachsehen und zurücksetzen.

> ⚠ **Squash-Falle.** Nach jedem Merge `git log origin/main..HEAD` prüfen — ist
> es leer, `git reset --hard origin/main`. Heute früh schon einmal nötig
> gewesen.

> ⚠ **`tasks.md` nie durch `prettier --write` schicken** (~1000 fremde Zeilen).
> Sie ist bereits an `HEAD` unformatiert, das ist der Normalzustand.

## Open questions

- **C2 und die Android-Hälfte von C3** brauchen ein Android-Gerät. An diesem Mac
  hängt keines, `adb` ist nicht im Pfad.
- **Querformat-Startfläche** — auswaschen lassen oder eigenen Ausschnitt
  wählen? Entscheidung über Bildmaterial, siehe oben.
- **„Build-Nummer = Lauf-Nummer" ist weiterhin NICHT bewiesen.** Lauf 1 verglich
  1 mit 1. Erst Lauf 2 macht die Zusage echt.
- **`APNS_SANDBOX` steht auf `1`**, ein Store-Build spricht Produktions-APNs an
  — beim ersten TestFlight-Build nachsehen.
- **Der ASC-Schlüssel `ND87HL4S75` ist Team Scoped**, mehr Reichweite als nötig.
