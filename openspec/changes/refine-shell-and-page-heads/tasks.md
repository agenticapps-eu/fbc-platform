# Tasks — Shell am Rand, Themes nur aufs Chrome, Seitenköpfe mit Bild (AGE-499)

Reihenfolge wie umgesetzt. Die Abnahme dieses Changes ist **ein Bild, kein Test**:
jeder Punkt wurde lokal in beiden Themes aufgenommen und vor dem Commit gezeigt.

## 1. Tokens

- [x] 1.1 `--color-chrome-active`, `--color-on-chrome-active` und
      `--color-accent-on-chrome` in beiden Theme-Blöcken ergänzen — der
      Aktiv-Zustand und die Logo-Punkte brauchen auf dunklem Chrome eigene Werte.
- [x] 1.2 Den `navy`-Override auf Chrome-Tokens zusammenstreichen: `canvas`,
      `soft`, `ink`, `ink-strong`, `muted`, `line`, alle `accent`, die
      Signalfarben, `shadow-soft` und die `hero-*`-Werte entfallen. Im Kopf des
      Blocks steht, dass ein Wiedereintragen den Dark-Mode zurückbaut.
- [x] 1.3 `--color-scrim` einführen und die drei Overlays (mobiles Menü,
      Feedback, Avatar-Zuschnitt) darauf umstellen. Sie lagen auf `bg-chrome/60`,
      und im hellen Theme ist Chrome Weiß — ein weißer Schleier verdunkelt
      nichts. Regression aus dem `night→chrome`-Rename in AGE-492.

## 2. Shell-Geometrie

- [x] 2.1 Sidebar bündig an die Viewport-Kante, volle Höhe, `border-right`, ohne
      Rundung und Schatten.
- [x] 2.2 Logo in den Sidebar-Kopf, Topbar rechts daneben; beide 4 rem hoch,
      damit die Trennlinien fluchten. Unter `lg` bleibt das Logo in der Topbar.
- [x] 2.3 Breite als CSS-Variable (`--fbc-sidebar-w`) statt zweier
      Tailwind-Klassen — aside-Breite und Inhalts-Versatz müssen denselben Wert
      tragen, und zwei Klassen laufen auseinander.
- [x] 2.4 Einklappen auf 4,5 rem, Zustand in `localStorage`, gerätelokal.
- [x] 2.5 Den Anmelde-Block aus der Sidebar entfernen; der Weg steht in der
      Topbar. **Zwei Tests haben den Zwischenstand mit einem zusätzlichen
      „Mitglied werden" oben sofort gemeldet** — die Mitglied-werden-Wand trägt
      denselben Ruf.

## 3. Breite

- [x] 3.1 `WIDE_ROUTES` durch `NARROW_ROUTES` ersetzen: Deckel nur noch für
      Login, Onboarding, Einstellungen, Profil-Editor (760 px), sonst 1440 px.

## 4. Navigation

- [x] 4.1 `NavIcon` mit zwölf Linien-Symbolen, gekeyt auf den Pfad.
- [x] 4.2 Gefüllte Zweitfassung für den aktiven Eintrag; Aussparungen als Loch im
      Pfad (`fill-rule="evenodd"`).
- [x] 4.3 `SidebarNav` und der Mitglieder-Block auf die Chrome-Tokens umstellen —
      sie hingen an `text-ink`/`border-line` und wären auf dunklem Chrome bei
      hellem Inhalt unlesbar.

## 5. Seitenköpfe

- [x] 5.1 `PageHero`: Bild rechts auslaufend, zweistufiger Verlauf zur
      Kartenfläche, Titel links. Zwei Stopps statt einem, damit das Bild nicht
      unter dem Fließtext durchscheint.
- [x] 5.2 `FormatHero` auf `PageHero` umstellen; Motiv je Route in
      `config/formatHero.ts`.
- [x] 5.3 Neun Motive von Unsplash beziehen, als webp (je 70–230 kB)
      herunterladen und unter `public/images/` selbst hosten. Nachweis in
      `public/images/CREDITS.md`, inklusive der offenen Fotografennamen.
- [x] 5.4 Köpfe auf Start, Kontakte, Meine Kurse und Mitgliedschaft nachrüsten;
      Formularseiten bewusst ohne.

## 6. Marke

- [x] 6.1 Zacken brechen aus dem Ring aus (Ring 21 → 16.5, Zacken bis an den
      Rand der Viewbox).
- [x] 6.2 Favicon mitziehen — sonst trägt der Tab eine andere Marke als die App.
- [x] 6.3 `Logo` bekommt `onChrome`: auf dunklem Chrome trägt weder `text-ink`
      noch der Inhalts-Akzent. Das Logo kennt sein Theme nicht, aber sein
      Aufrufer kennt seine Fläche.

## 7. Nachweis

- [x] 7.1 284 Vitest-Tests, lint, typecheck, build grün.
- [x] 7.2 Kontrast in beiden Themes neu gemessen: schwächster Wert 4.76
      (Abschnittstitel hell), Navy-Navigation 8.66 — alle neuen Kombinationen
      halten AA für Fließtext.
- [x] 7.3 Lokale Abnahme durch Donald vor dem Commit (Start hell/navy,
      eingeklappt, Events, Kompass, Academy, Mitgliedschaft, Marke groß).
- [x] 7.4 Dashboard-Hero im eingeloggten Zustand ansehen — bisher nur über den
      Styleguide geprüft, weil die lokale Abnahme ohne Login lief. Von Donald
      abgenommen (2026-08-04).
- [x] 7.5 `docs/design-system.html` nachziehen: Navy-Umfang und Bildköpfe sind
      dort überholt. Die Sidebar-Aussage war von Anfang an richtig.
      Mitgezogen, weil dieselben zwei Changes es überholt haben und ein
      Dokument, das sich selbst widerspricht, als Vorlage nichts wert ist: die
      Markengeometrie (§01 zeigte den alten, innenliegenden Stern), die
      Übergabe-Tokens (§07 nannte `--color-sidebar-*`, die es im Code nie gab),
      die erledigte Umbau-Checkliste, die drei entschiedenen Fragen im Fuß —
      und der eigene Google-Fonts-Aufruf des Dokuments, also genau der
      Fremdabruf, den §03 der App verbietet. Dazu die Stufe `boost`, die im
      6-Level-Modell `basic` heißt. `docs/design-system.md` trug dieselbe
      überholte Navy-Tabelle und ist mit nachgezogen.
