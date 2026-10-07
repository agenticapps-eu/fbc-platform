# Tasks — die Schrift der linken Leiste

## 1. Das RED zuerst

- [x] 1.1 `AUF_DER_LEISTE` in `src/index.chatleiste-tokens.test.ts` auf die
      beiden neuen Token umstellen. Die alten Einträge (`--color-on-chrome`,
      `--color-on-chrome-muted`) fallen dort weg — nicht weil sie durchfallen,
      sondern weil die Leiste sie nach dieser Änderung nicht mehr liest. Ein
      Test, der Token gegen eine Fläche rechnet, die sie nicht berühren, misst
      das Falsche und ist grün dabei.
- [x] 1.2 Zusage, dass die beiden neuen Token auf `@theme` **zeichengleich** die
      heutigen Werte tragen (`#475569`, `#64748B`). Das ist die ganze Zusage
      „im hellen Modus ändert sich nichts", und sie muss am Wert hängen, nicht
      an einem Satz.
- [x] 1.3 **Vollständigkeitswächter** über die fünf Stellen, analog zu
      `FOKUS_STELLEN`: keine der fünf Dateien darf auf der Leistenfläche noch
      `text-on-chrome` / `text-on-chrome-muted` lesen. Bei AGE-1002 war die
      Umlegung unvollständig, der Test prüfte genau die umgelegten Token, und
      der Defekt wanderte in einen Zustand, den niemand ansah.
- [x] 1.4 Laufen lassen und RED belegen — Ausgabe lesen, nicht annehmen.

## 2. Die Token

- [x] 2.1 `--leiste-ink: #475569` und `--leiste-ink-muted: #64748b` in `@theme`,
      mit dem Grund im Kommentar: welche Stellen die alten Token sonst noch
      lesen, und dass genau das der Grund für eigene Token ist.
- [x] 2.2 Dieselben zwei im Block `html[data-variant="navy"]` auf `#ffffff` und
      `#b9cce6` — die Werte von `--thread-ink` und `--thread-muted`, mit dem
      Verweis, dass es eine Absicht ist und keine Ableitung.
- [x] 2.3 Den Kommentar im `@theme`-Block nachziehen, der `--color-on-chrome`
      der Leiste zuschreibt. Nach dieser Änderung färbt es die beiden
      Vollseiten und den sekundären Knopf. Ein Kommentar, der eine Zuordnung
      behauptet, die nicht gilt, hat bei AGE-1003 eine Messung fehlgeleitet.

## 3. Die fünf Stellen

- [x] 3.1 `SidebarNav.tsx:144` — Abschnittsmarke → `--leiste-ink-muted`.
- [x] 3.2 `SidebarNav.tsx:156` — aufklappbare Abschnittsmarke, dasselbe. Das
      `hover:text-on-chrome-active` **bleibt** (Entscheidung 3).
- [x] 3.3 `SidebarNav.tsx:204` — inaktiver Menüeintrag → `--leiste-ink`.
      `text-on-chrome-active` im aktiven Zweig bleibt unberührt.
- [x] 3.4 `FeedbackButton.tsx:305` — Knopf auf der Leistenfläche →
      `--leiste-ink`.
- [x] 3.5 `LeistenPill.tsx:99` — der `leiste`-Zweig → `--leiste-ink`. Der
      `chat`-Zweig bleibt auf `--thread-chrome-ink`; die beiden Zweige sind
      seit AGE-1003 getrennt, und das bleibt so.
- [x] 3.6 Gegenzählen: `text-on-chrome` und `text-on-chrome-muted` kommen in
      den fünf Dateien nicht mehr vor, in `OnboardingPage` und
      `WillkommenPage` unverändert oft.

## 4. Nachweisen

- [x] 4.1 Volle Vitest-Suite, `lint`, `typecheck`, `build`. Nach dem Build und
      vor jedem `git add`:
      `git checkout -- src/content/release-entries.generated.ts`.
- [x] 4.2 **Sichtprobe gegen den lokalen Stack**, hell und navy, je aufgeklappt
      und eingeklappt. Zählstände vorher/nachher protokollieren, `.env.local`
      danach löschen, vite beenden.
- [x] 4.3 Im navy-Bild nachsehen, was Entscheidung 4 angekündigt hat: trägt der
      eingeklappte aktive Eintrag seinen Zustand noch sichtbar? Die Antwort
      gehört in den PR, nicht in eine Vermutung.

## 3b. Der Fund aus Entscheidung 4 — die Symbolform vervollständigen

- [x] 3b.1 Gefüllte Fassung für `bulb` und für `dot`. `dot` ist der Rückfall
      von `NavIcon`, deckt also auch jede künftige Route ohne eigenes Symbol.
- [x] 3b.2 Wächter über **beide** Quellen der Leiste: `navItems` UND die
      Nachschübe aus `AppShell`. Die erste Zählung lief nur über die erste und
      meldete keine Lücke — alle drei lagen in der zweiten.
- [x] 3b.3 Die Form am **DOM** lesen (`fill`/`stroke`), nicht an einer Klasse
      oder einem Namen: der Unterschied, den ein Auge sieht, hängt an genau
      diesen Attributen.
- [x] 3b.4 Gegenprobe: mit den alten Glyphen muss der Wächter mit genau drei
      Fehlschlägen ausfallen, benannt nach den drei Pfaden.
- [x] 4.4 `StyleguidePage.tsx` und `docs/technisches-handbuch.md` auf
      Behauptungen über die Leisten-Schrift durchsehen — bei AGE-1003 standen
      dort drei falsche.

## 5. Abschliessen

- [x] 5.1 Delta auf `design-system`: die bestehende Anforderung wird MODIFIED.
      **Alle** Szenarien stehen im Block, auch die unveränderten — ein
      MODIFIED-Block bekräftigt den ganzen Satz.
- [x] 5.2 Kein Fremdreviewer: reines UI, keine Rechte, kein Schema (Donalds
      Regel vom 26.08.).
- [x] 5.3 Code-Review auf dem Diff.
- [x] 5.4 `openspec validate --all` grün.
- [ ] 5.5 Vorab-Sonde auf den Neuigkeiten-Eintrag, dann archivieren,
      `pnpm release:entries`, Diffgrösse messen.
- [ ] 5.6 PR. Keine Migration, also kein `drift-gate`-Hinweis.
