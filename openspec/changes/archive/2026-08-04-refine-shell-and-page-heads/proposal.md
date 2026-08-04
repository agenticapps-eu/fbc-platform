# Shell am Rand, Themes nur aufs Chrome, Seitenköpfe mit Bild

## Why

C1 (AGE-492) ist gemerged und live, und die visuelle Abnahme hat vier Befunde
ergeben — drei davon sagen, dass das Ergebnis die verbindliche Vorlage und die
Referenzbilder nicht trifft, obwohl 284 Tests, lint, typecheck, build und zwei
fremde Plan-Reviewer grün waren. Das ist die eigentliche Lehre dieses Changes:
**grün heißt bei Oberflächenarbeit nicht richtig.**

1. **Die Sidebar schwebte.** Sie hing als gerundete Karte mit Rahmen und Schatten
   in einem zentrierten Container. `docs/design-system.html` sagt wörtlich
   „Sidebar — sitzt am Rand, nicht schwebend", und `.shell aside` dort trägt nur
   `border-right`. Eine Abweichung von der Vorlage, kein Richtungswechsel.
2. **Alles wirkte gedrängt.** Zwei Deckel lagen übereinander: der Shell auf
   1180 px, davon 256 px Sidebar, und der Inhalt zusätzlich auf 720 px. Auf dem
   Dashboard brachen dadurch Kartentitel ab („Unternehmertre…"), und
   `MemberDashboard`s `lg:grid-cols-3`/`xl:grid-cols-4` waren tote Klassen —
   die Spalte wurde nie breit genug, dass die Breakpoints greifen konnten.
3. **Das dunkle Theme kippte alles.** Vorlage und Spec definierten `navy` als
   vollständiges Dark-Theme. Die Referenz zeigt dunkle Sidebar bei hellem
   Inhalt. Das ist ein **echter Richtungswechsel** (Donald, 2026-08-04), keine
   Abweichung — Vorlage und Spec müssen mitgezogen werden.
4. **Die Seitenköpfe hatten kein Bild.** Die Referenz zeigt jeden Kopf mit Motiv,
   Verlauf und Titel; im Baum war es eine flache Akzentfläche.

Linear: **AGE-499**, Nachlauf zu AGE-492.

## What Changes

**Shell.** Die Sidebar dockt bündig an die linke Viewport-Kante, über die volle
Höhe, mit `border-right` statt Rundung und Schatten. Das Logo wandert in ihren
Kopf, die Topbar beginnt rechts daneben; beide Trennlinien liegen auf einer Höhe
(je 4 rem). Sie lässt sich auf eine Icon-Leiste einklappen (16 rem → 4,5 rem),
der Zustand überlebt den Reload und bleibt gerätelokal.

**Breite.** Der 720-px-Deckel galt für alles außer vier Routen; die Regel dreht
sich um. Inhalt nutzt die Fläche bis 1440 px, und nur die Formular- und
Lesespalten (Login, Onboarding, Einstellungen, Profil-Editor) behalten einen
Deckel bei 760 px.

**Navy nur aufs Chrome.** Der Override enthält ausschließlich Chrome-Tokens.
Alle Inhalts-Tokens — `canvas`, `soft`, `ink`, `line`, `accent`, die
Signalfarben — stehen nicht mehr darin. Es gibt danach **keinen
Dark-Reading-Mode mehr**; `navy` ist eine Marken-Variante des Rahmens.

**Navigation.** Jeder Eintrag trägt ein Icon; der aktive ist gefüllt statt
Linie. Neue Chrome-Tokens für den Aktiv-Zustand (`--color-chrome-active`,
`--color-on-chrome-active`) und den Marken-Akzent auf dem Chrome
(`--color-accent-on-chrome`) — die Inhalts-Tokens tragen auf dunklem Chrome
nicht (der Inhalts-Akzent träfe dort 2.6:1).

**Seitenköpfe.** Neue Komponente `PageHero`: Bild rechts auslaufend, Verlauf zur
Kartenfläche, Titel links auf ruhiger Fläche. `FormatHero` rendert darüber, und
`config/formatHero.ts` trägt je Route ein eigenes Motiv. Die Bilder liegen
**selbst gehostet** unter `public/images/` — ein CDN-Abruf wäre derselbe
Fremdabruf, den AGE-492 für die Schriften entfernt hat.

**Marke.** Die Zacken des Kompasses brechen aus dem Ring aus. Favicon
mitgezogen, sonst trägt der Tab eine andere Marke als die App.

## Impact

- **`design-system` geändert** — zwei Anforderungen umgeschrieben (Theme-Umfang,
  Markenform), drei neu (Shell-Geometrie, Seitenköpfe, Bilder vom eigenen
  Origin).
- **Kein Datenmodell, keine Migration, keine Policy.** Reine Oberfläche.
- `docs/design-system.html` ist an zwei Stellen überholt (Navy-Umfang, Bildköpfe)
  und wird nachgezogen; die Sidebar-Aussage dort war von Anfang an richtig.

## Decisions taken during scoping

1. **Kein Dark-Reading-Mode mehr** (Donald, 2026-08-04). Der Preis ist benannt:
   wer abends dunkel lesen will, bekommt es nicht mehr. Die Referenz zeigt den
   hellen Inhalt, und zwei halbdunkle Zustände nebeneinander wären schlechter
   als eine klare Entscheidung.
2. **Der Anmelde-Block in der Sidebar entfällt.** Er stand über der Navigation
   und wiederholte den Login-Button der Topbar. Ein zusätzliches „Mitglied
   werden" oben wäre die dritte Kopie gewesen — zwei Tests haben genau das
   sofort gemeldet (`Found multiple elements … "Mitglied werden"`), weil die
   Mitglied-werden-Wand denselben Ruf trägt.
3. **Formularseiten bekommen keinen Bildkopf.** Login, Onboarding, Einstellungen
   und der Profil-Editor laufen in der schmalen Spalte; ein Motiv über einem
   Formular ist Dekoration vor der Aufgabe.
4. **Icons selbst gezeichnet, keine Bibliothek.** Zwölf Pfade in einem Stil, je
   eine Linien- und eine gefüllte Fassung. Eine Abhängigkeit brächte ein paar
   hundert ungenutzte Symbole und einen zweiten Stil.
5. **Aussparungen der gefüllten Icons als Loch im Pfad** (`fill-rule="evenodd"`),
   nicht als zweite Form in Hintergrundfarbe — sonst stimmen sie auf hellem
   Chrome und stehen auf dunklem falsch.

## Non-goals

Der eingeloggte Dashboard-Hero ist eingebaut, aber **visuell nur im Styleguide
geprüft** — die lokale Abnahme lief ohne Login. · Fotografennamen in
`public/images/CREDITS.md` (über die CDN-Kennung nicht auflösbar). · Der
`DesignSwitcher` und der alte `CrownIcon` bleiben unverändert liegen (→ C2/C6).
