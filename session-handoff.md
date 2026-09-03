# Session Handoff — 2026-09-03 (AGE-688 + AGE-697: beide fertig, beide ausgeliefert)

> ## ⚠ ZUERST — drei Dinge
>
> **1. Diese Datei ist geteilt und trägt EINE Sitzung.** Sie stand vorher auf
> AGE-598 (erledigt, in der Historie: `git log --oneline -- session-handoff.md`).
> Sie trägt jetzt AGE-688 und AGE-697 — zwei Vorgänge, aber **eine** Arbeit:
> 697 ist der Nachlauf, den 688 gefunden hat. **Nicht zusammenführen.**
>
> **2. AGE-642 läuft PARALLEL** (Worktree `fbc-platform.donald-age-642-capacitor-huelle`).
> **Nicht anfassen.** Mit dieser Sitzung abgestimmt: die Datei gehört hier her,
> ihre eigene Fassung ist absichtlich uncommitted und geht nie nach `main`.
>
> **3. Beides ist ABGESCHLOSSEN.** Gebaut, gemerged, archiviert, Linear auf Done.
> Offen ist nur, was unter „Open questions" steht — und das gehört Donald.

## Accomplished

Vier PRs, alle gemerged. `main` steht bei `e9a3b0e` plus dem Archiv-PR dieser
Übergabe.

| PR | Was |
|---|---|
| **#326** | AGE-688: über der Schublade trägt nur noch das Formular `aria-modal` |
| **#327** | AGE-688 archiviert, Neuigkeiten nachgezogen |
| **#328** | AGE-697: Escape schliesst das Formular, nicht die Schublade darunter |
| **#329** | AGE-697 archiviert, Neuigkeiten nachgezogen, diese Übergabe |

**Endstand:** `pnpm test` **2478/2478** (219 Dateien) · `lint`, `typecheck`,
`build` je Exit 0 · `openspec validate --all` 32/32 · Linear 688 und 697 **Done**.

### Was jetzt live ist

- **Die Navigationsschublade gibt ihr `aria-modal` ab**, solange das
  Feedback-Formular darüber steht, und bekommt es beim Schliessen zurück. Sie
  bleibt dabei offen.
- **Das Feedback-Formular hat einen Escape** — vorher hatte es gar keinen. Der
  Lauscher hängt am `document` in der **Capture**-Phase und stoppt die
  Weitergabe: erstes Escape schliesst das Formular, zweites die Schublade.

## Decisions

- **Die Schublade zu schliessen war der falsche Weg, und das ist gemessen.**
  `<FeedbackButton />` steht INNERHALB der Schublade; sie zu schliessen hängt ihn
  ab und nimmt den `open`-Zustand mit, an dem das Portal hängt. Ergebnis: `0`
  statt `1` Knoten mit `aria-modal="true"` — das Formular ging gar nicht erst
  auf. Zurückgenommen, nicht repariert.
- **`istOverlayOffen()` ist als Quelle untauglich.** Der Stapel in `useOverlay`
  ist ein Modulwert **ohne Abonnement**; ein `push` löst in der Schale kein
  Render aus. Die Schale erfährt es stattdessen vom **eigenen Kind**
  (`onOffenChange`). Für eine Abfrage im Event-Callback taugt der Stapel weiter.
- **Der Escape-Fix sitzt NICHT in `AppShell.tsx`.** Die Regel steht im Repo
  bereits (`EmojiAuswahl.tsx:131-152`): das obere Overlay nimmt Escape in der
  Capture-Phase für sich. Ein Umbau auf `schliesseOberstesOverlay()` müsste alle
  Escape-Lauscher der Schale durch dieselbe Stelle führen — eigener Vorgang.
- **Ein Delta zurückgenommen, statt es stehenzulassen.** Die Gegenprobe „Aufräumen
  im Effekt entfernt" blieb **grün**: die neu gemountete Instanz meldet beim
  Aufsetzen ohnehin `false`. Die Zusage steht deshalb auf dem beobachtbaren
  Verhalten, nicht auf der Zeile.
- **Beide Neuigkeiten-Einträge in Mitglieder-Sprache**, bei AGE-697 **vor** dem
  Archivieren geprüft (`.gstack/probe-eintrag.mts`), bei AGE-688 erst danach —
  das war der teurere Weg, siehe Notiz im Gedächtnis.

## Files modified

Alles auf `main`. Geändert: `src/components/AppShell.tsx` (Zustand
`feedbackInSchublade`, `aria-modal` daran), `src/components/feedback/FeedbackButton.tsx`
(`onOffenChange` + Escape in Capture), `src/components/AppShell.overlay.test.tsx`
(vier neue Zusagen), `src/components/feedback/FeedbackButton.test.tsx` (eine),
`openspec/specs/design-system/spec.md` (zwei neue Anforderungen, nur Zusatz),
`src/content/release-entries.generated.ts`. Archiv:
`openspec/changes/archive/2026-09-03-ein-modal-zur-zeit/` und
`.../2026-09-03-escape-trifft-das-oberste/`.

## Next session: start here

**Für 688 und 697 gibt es keinen nächsten Handgriff.** Der Worktree
`donald-age-697-escape-trifft-das-oberste` kann weg (`wt remove`); der von
AGE-688 ist bereits abgeräumt.

Wer hier weitermacht, nimmt einen neuen Vorgang. **Zuerst aber die
Push-Absturz-Frage unten lesen** — sie blockiert eine fremde Abnahmeliste und
gehört Donald.

### Was im Worktree liegt und nicht eingecheckt ist

`.gstack/probe-eintrag.mts` (gitignoriert): zeigt den Neuigkeiten-Eintrag, den
der Parser aus einem Proposal machen würde — **vor** dem Archivieren.
`pnpm tsx .gstack/probe-eintrag.mts`.

## Open questions

- **Harter Absturz am Gerät, gemeldet von der AGE-642-Sitzung, gehört Donald.**
  `AppShell.tsx:662` ruft beim Start `pushLebenszeichen()`. Steht die
  Benachrichtigungs-Erlaubnis auf `granted`, läuft `PushNotifications.register()`,
  und ohne `google-services.json` wirft Firebase als **FATAL EXCEPTION auf
  Capacitors nativem Plugin-Thread** (`Default FirebaseApp is not initialized`).
  Die App startet danach **gar nicht mehr**, bis man die Berechtigung entzieht.
  Reproduziert mit Positivkontrolle. Das `try/catch` in `src/lib/push.ts:82`
  kann das **prinzipiell nicht** fangen — die Exception fliegt nativ, nicht im
  JS-Kontext. Formal M1-Scope, blockiert aber deren Abnahmeliste. **Wer es
  fixt, ist offen**; die AGE-642-Sitzung wartet auf Donalds Entscheidung und
  fasst `AppShell.tsx` sonst nicht an.
- **Zwei Escape-Lauscher derselben Bauart sind ungemessen:** `AppShell.tsx:186`
  (Profilmenü) und `AppShell.tsx:521` (Nachrichten-Schublade). Ob über ihnen ein
  Overlay stehen kann, hat niemand geprüft. Kein Vorgang dafür angelegt.
- **Keine Sichtprobe im Browser** für beide Changes. Begründung in beiden
  `tasks.md`: der Diff verschiebt kein Pixel, und der lokale Stack trägt die
  Gerätesitzung aus AGE-642. Nachzuholen, falls jemand die Fläche ohnehin
  aufmacht.
- **Die Neuigkeiten-Einträge sind nicht freigegeben.** Drei stehen jetzt offen:
  `feedback-ausbauen`, `rechte-matrix-stufen` und die zwei von heute. Sie gehen
  erst hinaus, wenn ein Admin sie in der Redaktion freigibt.
