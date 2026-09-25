## 1. RED — die Zusagen vor dem Umbau

- [x] 1.1 `SidebarNav.akkordeon.test.tsx`: Zusage, dass ein Abschnitt mit
      `nachtrag` diesen hinter seinen Einträgen rendert und ihn mit dem
      Akkordeon zuklappt. RED, weil `nachtrag` noch nicht existiert.
- [x] 1.2 `AppShell.support.test.tsx`: Reihenfolge der Abschnitte als Admin —
      „Mein Bereich" → „Support" → „Administration", über die Überschriften in
      Dokumentreihenfolge geprüft. RED.
- [x] 1.3 `AppShell.support.test.tsx`: ohne Admin-Rolle ist „Support" der letzte
      Abschnitt und „Administration" fehlt. RED.
- [x] 1.4 `AppShell.support.test.tsx`: die Überschrift „Support" klappt den
      Abschnitt zu und wieder auf. RED.
- [x] 1.5 `AppShell.support.test.tsx`: „Feedback" trägt dieselbe Polsterung und
      denselben Symbolabstand wie „Tutorials" — als **Gleichheit** der
      layoutrelevanten Klassen, nicht mit `toContain` (eine `toContain`-Zusage
      überlebt ein angehängtes `|| true`). RED.
- [x] 1.6 `AppShell.support.test.tsx`: „Tutorials" trägt ein zugeordnetes Symbol
      und nicht den Platzhalter `dot`. RED.

## 2. GREEN — der Umbau

- [x] 2.1 `SidebarNav.tsx`: `SidebarNavSection.nachtrag?: ReactNode`, gerendert
      hinter `section.items` unter derselben `offen`-Bedingung. Typkommentar
      nennt den einen Zweck (ein Eintrag mit Aktion statt Pfad) und den Anlass,
      auf einen Eintrags-Union umzustellen (ein zweiter Aufrufer).
- [x] 2.2 `NavIcon.tsx`: `"/hilfe/tutorials": "bulb"` in `NACH_ROUTE`, mit der
      Begründung aus dem Sonderbau (nicht `academy` — das trägt „Academy").
- [x] 2.3 `FeedbackButton.tsx`: `gap-2` → `gap-3`, eingeklappt `py-2` → `py-2.5`.
      Nur die `className` des Auslösers; Logik, Zustand und beide Effekte
      unberührt.
- [x] 2.4 `AppShell.tsx`: `SupportAbschnitt` entfernen; den Abschnitt in
      `SidebarContent` an `sections` anhängen, **vor** dem
      `staffRole === "admin"`-Zweig. `SidebarContent` nimmt
      `onFeedbackOffenChange` entgegen und reicht es an `FeedbackButton` durch.
- [x] 2.5 `AppShell.tsx`: die beiden Wrapper am Fuss entfernen — der
      `shrink-0 border-t`-Block über dem Einklapp-Schalter und der
      `mt-6 border-t`-Block in der Schublade. Die Schublade reicht
      `setFeedbackInSchublade` jetzt an `SidebarContent`.
- [x] 2.6 Tests aus 1.1–1.6 grün.

## 3. Die Zusagen aus AGE-904 nachziehen

- [x] 3.1 Die Zusagen, die den Abschnitt über
      `getByRole("navigation", { name: "Support" })` fanden, auf die Überschrift
      umstellen — die Landmarke entfällt.
- [x] 3.2 Die Zusage „kein achter Menüeintrag" auf das umstellen, was sie meint:
      `/hilfe/tutorials` ist `section: "sub"`, und die Hauptnavigation führt
      sieben sichtbare Menüeinträge. Die bisherige Fassung (Tutorials steht
      nicht in der Hauptnavigations-Landmarke) wäre ab jetzt falsch.
- [x] 3.3 AGE-688 und AGE-697 unverändert grün: genau ein `aria-modal`, wenn das
      Formular aus der Schublade heraus offen steht, und Escape trifft erst das
      Formular. Die bestehenden Zusagen laufen, ohne angefasst zu werden — wenn
      doch eine angefasst werden muss, ist das ein Befund, kein Handgriff.
- [x] 3.4 `nav.test.ts` und `redirect-targets.test.ts` unverändert grün.
- [x] 3.5 Die Spezifikationen nach der alten Verortung durchsuchen („am Fuss der
      Seitenleiste", „über dem Einklapp-Schalter"). `feedback-qm` trägt eine
      eigene Anforderung dazu — sie braucht ein Delta, sonst behauptet die
      durchgeschriebene Wahrheit das Gegenteil des Codes.
- [x] 3.6 Dieselbe Suche über die Kommentare im Code (`nav.ts`,
      `FeedbackButton.tsx`). Ein Kommentar, den der eigene Diff falsch macht,
      gehört in diesen Diff.

## 4. Positivkontrolle

- [x] 4.1 Zwei Mutationen fahren, die der Umbau brechen muss, und festhalten,
      welche Zusage jeweils rötet: (a) Support hinter „Administration" einreihen,
      (b) `gap-3` am Feedback-Knopf zurück auf `gap-2`.
- [x] 4.2 Beide Mutationen zurücknehmen, Suite wieder grün.

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
- [x] 6.2 `openspec validate --all` grün.
- [ ] 6.3 Code-Review auf den Diff (nicht auf den Plan).
- [ ] 6.4 `openspec archive support-als-abschnitt` — die Deltas falten sich in
      `openspec/specs/support-tutorials/` und `openspec/specs/feedback-qm/`.
- [ ] 6.4a Nach dem Archivieren die **Prosa** nachziehen, die kein Delta fasst:
      `openspec/specs/support-tutorials/spec.md` sagt im Abschnitt „Purpose"
      weiter „ein Abschnitt am Fuss der Seitenleiste". Deltas tragen nur
      Anforderungen; der Zweck-Text bleibt sonst stehen und widerspricht den
      Anforderungen unter ihm.
- [ ] 6.5 Commit (Conventional, signiert, `AGE-929` im Rumpf), PR gegen `main`
      mit `AGE-929` im Titel, Linear auf Done.
