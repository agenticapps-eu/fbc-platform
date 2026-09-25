## 1. RED — die Zusagen vor dem Umbau

- [ ] 1.1 `SidebarNav.akkordeon.test.tsx`: Zusage, dass ein Abschnitt mit
      `nachtrag` diesen hinter seinen Einträgen rendert und ihn mit dem
      Akkordeon zuklappt. RED, weil `nachtrag` noch nicht existiert.
- [ ] 1.2 `AppShell.support.test.tsx`: Reihenfolge der Abschnitte als Admin —
      „Mein Bereich" → „Support" → „Administration", über die Überschriften in
      Dokumentreihenfolge geprüft. RED.
- [ ] 1.3 `AppShell.support.test.tsx`: ohne Admin-Rolle ist „Support" der letzte
      Abschnitt und „Administration" fehlt. RED.
- [ ] 1.4 `AppShell.support.test.tsx`: die Überschrift „Support" klappt den
      Abschnitt zu und wieder auf. RED.
- [ ] 1.5 `AppShell.support.test.tsx`: „Feedback" trägt dieselbe Polsterung und
      denselben Symbolabstand wie „Tutorials" — als **Gleichheit** der
      layoutrelevanten Klassen, nicht mit `toContain` (eine `toContain`-Zusage
      überlebt ein angehängtes `|| true`). RED.
- [ ] 1.6 `AppShell.support.test.tsx`: „Tutorials" trägt ein zugeordnetes Symbol
      und nicht den Platzhalter `dot`. RED.

## 2. GREEN — der Umbau

- [ ] 2.1 `SidebarNav.tsx`: `SidebarNavSection.nachtrag?: ReactNode`, gerendert
      hinter `section.items` unter derselben `offen`-Bedingung. Typkommentar
      nennt den einen Zweck (ein Eintrag mit Aktion statt Pfad) und den Anlass,
      auf einen Eintrags-Union umzustellen (ein zweiter Aufrufer).
- [ ] 2.2 `NavIcon.tsx`: `"/hilfe/tutorials": "bulb"` in `NACH_ROUTE`, mit der
      Begründung aus dem Sonderbau (nicht `academy` — das trägt „Academy").
- [ ] 2.3 `FeedbackButton.tsx`: `gap-2` → `gap-3`, eingeklappt `py-2` → `py-2.5`.
      Nur die `className` des Auslösers; Logik, Zustand und beide Effekte
      unberührt.
- [ ] 2.4 `AppShell.tsx`: `SupportAbschnitt` entfernen; den Abschnitt in
      `SidebarContent` an `sections` anhängen, **vor** dem
      `staffRole === "admin"`-Zweig. `SidebarContent` nimmt
      `onFeedbackOffenChange` entgegen und reicht es an `FeedbackButton` durch.
- [ ] 2.5 `AppShell.tsx`: die beiden Wrapper am Fuss entfernen — der
      `shrink-0 border-t`-Block über dem Einklapp-Schalter und der
      `mt-6 border-t`-Block in der Schublade. Die Schublade reicht
      `setFeedbackInSchublade` jetzt an `SidebarContent`.
- [ ] 2.6 Tests aus 1.1–1.6 grün.

## 3. Die Zusagen aus AGE-904 nachziehen

- [ ] 3.1 Die Zusagen, die den Abschnitt über
      `getByRole("navigation", { name: "Support" })` fanden, auf die Überschrift
      umstellen — die Landmarke entfällt.
- [ ] 3.2 Die Zusage „kein achter Menüeintrag" auf das umstellen, was sie meint:
      `/hilfe/tutorials` ist `section: "sub"`, und die Hauptnavigation führt
      sieben sichtbare Menüeinträge. Die bisherige Fassung (Tutorials steht
      nicht in der Hauptnavigations-Landmarke) wäre ab jetzt falsch.
- [ ] 3.3 AGE-688 und AGE-697 unverändert grün: genau ein `aria-modal`, wenn das
      Formular aus der Schublade heraus offen steht, und Escape trifft erst das
      Formular. Die bestehenden Zusagen laufen, ohne angefasst zu werden — wenn
      doch eine angefasst werden muss, ist das ein Befund, kein Handgriff.
- [ ] 3.4 `nav.test.ts` und `redirect-targets.test.ts` unverändert grün.

## 4. Positivkontrolle

- [ ] 4.1 Zwei Mutationen fahren, die der Umbau brechen muss, und festhalten,
      welche Zusage jeweils rötet: (a) Support hinter „Administration" einreihen,
      (b) `gap-3` am Feedback-Knopf zurück auf `gap-2`.
- [ ] 4.2 Beide Mutationen zurücknehmen, Suite wieder grün.

## 5. Sichtprobe

- [ ] 5.1 Lokalen Stack starten, gegen ihn anmelden (eigenes Wegwerf-Konto,
      `age907-sichtprobe@example.invalid` nicht anfassen).
- [ ] 5.2 Aufnahmen: Leiste offen, eingeklappt, mobile Schublade — je als Admin
      und als Mitglied ohne Admin-Rolle. Beide Themes.
- [ ] 5.3 Auf der niedrigsten geprüften Höhe ansehen, ob der Abschnitt aus dem
      Bild läuft (er scrollt jetzt mit — gewollt, aber anzusehen).
- [ ] 5.4 Aufnahmen in den PR.

## 6. Abschluss

- [ ] 6.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` grün; nach jedem `pnpm build`
      vor `git add`: `git checkout -- src/content/release-entries.generated.ts`.
- [ ] 6.2 `openspec validate --all` grün.
- [ ] 6.3 Code-Review auf den Diff (nicht auf den Plan).
- [ ] 6.4 `openspec archive support-als-abschnitt` — das Delta faltet sich in
      `openspec/specs/support-tutorials/`.
- [ ] 6.5 Commit (Conventional, signiert, `AGE-929` im Rumpf), PR gegen `main`
      mit `AGE-929` im Titel, Linear auf Done.
