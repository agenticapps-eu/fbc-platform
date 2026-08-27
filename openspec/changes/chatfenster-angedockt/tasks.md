# Tasks — angedockte Chatfenster (AGE-639)

Reihenfolge ist nicht beliebig: die geteilte Logik (2) muss stehen, bevor
Fenster (4) und Vollansicht (3) sie beide benutzen; der Zustand (5) muss
stehen, bevor die Hülle ihn verteilt (6).

## 1. Vorher messen, nicht behaupten

- [ ] Grundlinie im Browser aufnehmen: Klick in der stehenden Leiste navigiert
      heute weg (Adresse wechselt), `ChatPanel` bekommt zweimal `activeId={null}`.
      **Ohne diese Aufnahme ist „vorher war es anders" später unbelegt.**
- [ ] Zahl der offenen Realtime-Kanäle vor dem Umbau festhalten (Grundlinie für
      die Zusage „Fenster fügen keinen Kanal hinzu"). Eine Messung aus lauter
      Nullen belegt nichts — es muss ein Kanal da sein, bevor gezählt wird.

## 2. `useGespraech` — eine Definition für beide Flächen

- [ ] **RED:** Test, der belegt, dass Verlauf, Lesestand und optimistisches
      Senden aus **einer** Quelle kommen — er muss gegen den heutigen Code
      fallen, weil es die Datei nicht gibt.
- [ ] `src/components/chat/use-gespraech.ts`: `{ threadId, myId, aktiv }` →
      `{ messages, isLoading, isError, sende }`.
- [ ] Lesestand-Effect hängt an der **letzten fremden** Nachricht, nicht an
      `messages.length` und nicht an jeder Zeile. Beim eigenen Senden feuert er
      nicht.
- [ ] `aktiv: false` lädt den Verlauf trotzdem, rückt den Lesestand aber nicht
      vor.
- [ ] Fehlschlag des Markierens bleibt folgenlos (`.catch`), wie heute.
- [ ] **GREEN** + `ChatPage.seite.test.tsx` und `chat.test.ts` bleiben grün.

## 3. `ChatPage` benutzt den geteilten Hook

- [ ] Die drei Blöcke in `ChatPage.tsx` (Nachrichten-Query, Lesestand-Effect,
      `handleSend`) durch `useGespraech` ersetzen.
- [ ] `subscribeToThread` in `ChatPage` **bleibt unangetastet** — die
      Entflackerung dort ist eigens begründet und nicht Gegenstand dieses
      Vorgangs.
- [ ] Gegenprobe: `ChatPage.seite.test.tsx` grün, ohne eine Zusicherung zu
      ändern. Ändert sich eine, ist es ein Verhaltensbruch und kein Refactoring.
- [ ] **Die Behauptung „gleich viele Schreibvorgänge" messbar machen**
      (Plan-Review, opencode, LOW): `markThreadRead`-Aufrufe zählen, vorher und
      nachher, für „Gespräch öffnen" und „drei fremde Nachrichten eintreffen".
      Ohne diese Zahl ist es eine Behauptung.
- [ ] `ChatPage` übergibt `aktiv: Boolean(activeId)` — der Parameter ist dort
      wirksam und nicht tot.
- [ ] **Sichtprobe der Vollansicht nach dem Refactoring** (Plan-Review, gemini,
      LOW): `/chat/:id` von Hand — Laden, Live-Eingang, Lesestand. Grüne Tests
      haben in AGE-492 ein visuell falsches Ergebnis durchgewunken.

## 4. `ChatFenster` — ein Fenster

- [ ] **RED:** Test auf das, was sich **ändert** — nicht auf einen zugänglichen
      Namen, den es schon gibt. Konkret: die Zahl der Treffer für
      „Nachricht schreiben" bei zwei offenen Fenstern; das Verschwinden des
      Verlaufs beim Minimieren; das Erscheinen des Zählers in der Titelzeile.
      (AGE-638-Lehre: fünf von sechs Tests waren gegen den alten Code grün.)
- [ ] `src/components/chat/ChatFenster.tsx`: Titelzeile (Avatar, Name, Zähler,
      Minimieren, Schliessen) + `Conversation` darunter.
- [ ] Minimiert: nur die Titelzeile, gleiche Breite, Zähler sichtbar.
- [ ] Beide Schalter tragen Handlung **und** Gesprächspartner im Namen
      („Gespräch mit Anna Berger minimieren"). Drei Fenster dürfen nicht drei
      gleichnamige Schalter zeigen.
- [ ] `Conversation` wird **wiederverwendet**, nicht nachgebaut.
- [ ] Lade-, Fehler- und Leerzustand: derselbe Dreiklang, den `ChatPanel` schon
      führt. Ein Fehler darf nicht als „noch keine Nachrichten" erscheinen.

## 5. `useChatfenster` — der Zustand

- [ ] **RED:** Test auf die Verdrängungsregel — drei Fenster offen, viertes
      öffnen, das am längsten unberührte ist weg und die anderen drei stehen.
- [ ] `src/components/chat/use-chatfenster.ts`: `oeffne`, `minimiere`,
      `ziehAuf`, `schliesse`, `beruehre`; `beruehrtAm` als monotone Zählnummer,
      **keine Uhr**.
- [ ] **Berühren heisst arbeiten, nicht nur schalten** (Plan-Review, beide
      Reviewer HIGH/LOW): Öffnen, Aufziehen, **Senden** und Zeiger-/Fokuskontakt
      im Fenster. Test: in Fenster A schreiben, dann drei weitere Gespräche
      öffnen — A steht noch, ein anderes ist gewichen.
- [ ] `beruehre` erhöht **nur**, wenn das Fenster nicht schon das zuletzt
      berührte ist. Sonst zeichnet jeder Klick in die Sendezeile die Reihe neu.
- [ ] Ein bereits offenes Gespräch erneut anklicken: zieht es auf und berührt
      es, öffnet kein zweites Fenster.
- [ ] `localStorage` unter **`fbc.chatFenster.<uid>`** — je Konto, nicht global
      (Plan-Review, gemini, HIGH). Test: unter Kennung A speichern, mit Kennung
      B montieren → **keine** Fenster.
- [ ] `try/catch` in **beiden** Richtungen; Fehlschlag kostet nur das Erinnern.
- [ ] Beim Lesen auf drei kappen. Test mit vier gespeicherten Einträgen.
- [ ] Test: `localStorage.getItem` wirft → Fenster funktionieren trotzdem.

## 6. Die Hülle verteilt

- [ ] `AppShell` montiert `useChatfenster` und reicht `oeffne` an **beide**
      `ChatPanel`-Montagepunkte.
- [ ] `chatOeffnen` verzweigt: angedockt (`istBreit`, nicht auf Chatroute) →
      Fenster; sonst → `navigate` wie heute, Schublade zu.
- [ ] `ChatFensterReihe` rendern, nur wenn `chatLeisteSteht && istBreit`.
- [ ] **RED zuerst:** Test, der belegt, dass ein Klick in der angedockten Leiste
      **nicht mehr navigiert** — die Adresse bleibt stehen.
- [ ] Test: unterhalb von `xl` navigiert derselbe Klick weiterhin.

## 7. Die Reihe: Portal, Ort, Stapel

- [ ] `src/components/chat/ChatFensterReihe.tsx`, `createPortal` an
      `document.body`. **Test, der das Portal nachweist** — dass die Reihe
      nicht im Teilbaum der Hülle liegt.
- [ ] **Beide** Ränder: rechts `--fbc-chat-w`, links `--fbc-sidebar-w`, je
      + 1 rem. Die erste Fassung kannte nur die rechte — der Fehler, den beide
      Reviewer unabhängig gefunden haben.
- [ ] Fenster als `flex: 1 1 18rem` mit `max-width: 18rem`,
      `min-width: 12rem`: die Zahl bleibt drei, die Breite gibt nach. **Kein
      angeschnittenes Fenster.**
- [ ] `z-30`, unter allen modalen Flächen.
- [ ] `overflow-hidden` als Riegel, nicht als geplantes Verhalten.
- [ ] **Fokus beim Schliessen:** auf den Minimieren-Schalter des jetzt
      rechtesten Fensters; ist keines mehr da, auf
      `[data-leisten-pill="rechts"]`. Test mit echter Fokusreihenfolge — jsdom
      verschiebt den Fokus beim Klick nicht von selbst.

## 8. Die Toasts weichen aus

- [ ] `--fbc-fenster-h` aus einem Effect in der Hülle an
      **`document.documentElement`** setzen (nicht ans Wurzel-`div`: der
      `ToastProvider` steht in `main.tsx:30` oberhalb von `App`).
- [ ] Drei Werte: `0rem` / `2.75rem` (nur minimierte) / `26rem`.
- [ ] **Aufräumen** im `return` des Effects — sonst schweben die Toasts nach dem
      Abmelden auf `/login` grundlos in der Luft (Plan-Review, opencode, LOW).
- [ ] `Toast.tsx`: `bottom: calc(1.5rem + var(--fbc-fenster-h, 0rem))`.
- [ ] Test auf den Vorgabewert `0rem` ohne Fenster **und auf den Übergang**:
      Fenster offen → auf `/chat` wechseln → Variable wieder `0rem`.

## 9. Realtime und der Zähler

- [ ] `useUngelesenLive` bekommt `sichtbareThreads: ReadonlySet<string>` als
      **erforderlichen** dritten Parameter (kein Vorgabewert).
- [ ] Merge in `messagesQueryKey(threadId)` **vor** der Pfad-Bedingung, und nur
      wenn der Eintrag schon existiert (`prev ? … : prev`).
- [ ] **RED:** Test, dass eine eingehende Nachricht in einem offenen Fenster
      erscheint, ohne dass ein zweiter Kanal geöffnet wurde
      (`subscribeToAllMessages` genau einmal aufgerufen).
- [ ] Test: aufgezogenes Fenster → keine Neuzählung (kein Zucken); minimiertes
      Fenster → Neuzählung läuft.
- [ ] `use-ungelesen.live.test.tsx` an die neue Signatur führen, ohne eine
      bestehende Zusicherung aufzuweichen.

## 10. Sichtprobe im Browser — jsdom sieht nichts davon

Der lokale Stack und ein angemeldetes Konto stehen (siehe `session-handoff.md`).

- [ ] Drei Fenster öffnen, viertes öffnen: das älteste ist weg, drei stehen.
- [ ] Bei **1280 px mit BEIDEN Leisten aufgeklappt** messen — der engste Fall,
      44 rem: alle drei Fenster sind **ganz** da (je ~14,3 rem), keines
      angeschnitten, und die Seite lässt sich nicht seitlich schieben.
      **Am Inhaltsbedarf messen, nicht an `scrollWidth`** — der hat in diesem
      Repo schon einmal „passt" gemeldet bei 339 px echtem Bedarf.
- [ ] Unter `xl` verkleinern und wieder verbreitern: die Fenster sind weg und
      kommen zurück (angenommenes Verhalten, ungeprüft bis hier).
- [ ] Seitenwechsel: Fenster bleiben. Neuladen: Fenster kommen wieder.
- [ ] Zweite Sitzung/zweites Konto: Nachricht schicken, im offenen Fenster
      erscheint sie live; der Zähler zuckt nicht.
- [ ] Minimiertes Fenster: Zähler steigt, Verlauf bleibt zu.
- [ ] Beide Themes ansehen (`data-variant` hell **und** navy), nicht
      `prefers-color-scheme`.
- [ ] Fehlschlag beim Senden erzwingen: der Toast steht **über** der Reihe, nicht
      auf der Sendezeile.
- [ ] Tastatur: Tab erreicht Titelzeile, Schalter und Eingabe jedes Fensters;
      Enter/Leertaste lösen Minimieren und Schliessen aus.

## 11. Gates

- [ ] `openspec validate --all` grün.
- [ ] Plan-Review (Schritt 2b): ≥ 2 Reviewer **fremder Anbieter** vor der ersten
      Codezeile → `REVIEWS.md`.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`
      (**niemals `pnpm format`**), `pnpm build`.
- [ ] Diff-Review durch einen unabhängigen Leser.
- [ ] `cso` — auch wenn dieser Change keine Policy und kein Schema anfasst:
      belegen, dass er es tatsächlich nicht tut.

## Folgevorgänge — ausdrücklich NICHT in diesem Change

- Die Threadliste markiert offene Gespräche. `ThreadList` trägt genau ein
  `activeId`; drei offene Fenster brauchten eine Menge.
- **Das Wettrennen beim Öffnen bleibt offen.** Trifft eine Nachricht ein, bevor
  der erste `fetchMessages` zurück ist, fällt sie bis zum nächsten Refetch weg.
  Wortgleich die Lücke, die `ChatPage.tsx:81` seit AGE-248 benennt; dieser
  Change macht sie nicht grösser. Sie zu schliessen gilt für beide Flächen und
  ist ein eigener Vorgang.
- **Zwei Tabs überschreiben einander** bei `fbc.chatFenster.<uid>`, wie schon
  bei `fbc.sidebarCollapsed`. Angenommen, nicht behoben — eine
  Tab-Synchronisierung gibt es in diesem Projekt nirgends.

## Was aus der Plan-Review DOCH hier hineingehört

- **`design-system/spec.md:269` wird mitkorrigiert**, entgegen der ersten
  Fassung dieser Liste. opencode hat recht: der Change stellt dieses Requirement
  über einen `MODIFIED`-Block **ohnehin vollständig neu aus**, und eine
  nachweislich falsche Zeile („Below `lg`" für eine Leiste, die an `xl` andockt)
  unverändert mitzuveröffentlichen wäre kein Respekt vor fremdem Umfang, sondern
  das Weiterreichen eines bekannten Fehlers. Die Fenster hängen zudem genau an
  diesem Breakpoint. Korrigiert sind: die Drawer-Schwelle der rechten Leiste,
  die Schliessbedingung beim Überschreiten, und drei Szenarien, die `lg`
  nannten, wo die Schwelle der jeweiligen Leiste gemeint ist.
- [ ] Gegenprobe zu dieser Korrektur: `AppShell.chatleiste.test.tsx` prüft das
      Band bei 1152 px bereits („bleibt im Band zwischen lg und xl eine
      Schublade"). Der Test bleibt unverändert grün — er belegt, dass der Code
      schon vorher `xl` war und nur der Text hinterherhinkte.
