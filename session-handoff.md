# Session Handoff — 2026-08-31 (AGE-642 mobil: C2 und C3 gebaut)

> ## ⚠ ZUERST: Diese Sitzung macht NUR die mobile Hülle
>
> Donald hat am 31.08. abgegrenzt: **AGE-642 (Capacitor-Hülle) gehört hierher,
> alles andere nicht.** Frühere Fassungen dieser Datei schleppten fremde Punkte
> mit — das war der Grund für drei Rebase-Konflikte auf `session-handoff.md` in
> zwei Tagen. Wer den Stand ausserhalb AGE-642 braucht, fragt die Sitzung
> **`fbc-platform-f4`** oder liest ihre Übergabe — sie stand zuletzt auf `main`
> in **#294 (`a25ed92`)**, bis diese Datei sie ersetzte. Abgestimmt am 31.08.
>
> ### ⛔ Eine Anweisung aus ÄLTEREN Übergaben ist WIDERLEGT
>
> Im Verlauf dieser Datei steht für **AGE-599** „erst die acht Objekte in
> `event-covers` auf DEV löschen, dann seeden". **Nicht tun — das macht DEV
> kaputt.** Die Objekte stammen aus dem Spiegel DEV ← PROD (AGE-576), nicht aus
> einem Seed-Lauf, und keines der Skripte stellt sie wieder her. Gemessen und
> ausgeschrieben in `openspec/specs/design-system/spec.md` (#294), samt einem
> SHALL NOT. **Donald, 31.08.:** DEV bleibt, PROD wird nicht angefasst. Der
> wartende Neuigkeiten-Eintrag ist ebenfalls kein offener Punkt mehr.

**Worktree:** `fbc-platform.donald-age-642-capacitor-huelle`, Branch
`donald/age-642-capacitor-huelle` — **gemergt** (PR #295, Squash `59390b3`).
Der Branch sitzt jetzt **exakt auf `origin/main`** (0/0, sauber); das ist
Absicht und nimmt der nächsten Sitzung das Rebase-Problem ab, an dem diese
hier hing.
Change `capacitor-huelle`: **43 offen, 69 erledigt** (Einstieg 30.08.: 66/40).

**Drei CI-Läufe grün:** zweimal auf dem PR (je 8/8, vor und nach dem Rebase auf
`a25ed92`), dann **`main` selbst mit 13/13** — inklusive `drift-gate`,
`functions` und beider `deploy`, die im PR übersprungen waren. Kein Flake
getroffen. **AGE-642 sprang beim Merge zum vierten Mal auf Done** (08:25:09,
exakt zur Merge-Zeit) und ist von Hand auf *In Progress* zurück.

**Diese Datei ist committet, aber nicht gemergt** — sie liegt als einziger
Commit auf dem Branch über `main`. Sie geht mit dem nächsten PR mit; wer den
Worktree vorher entfernt, verliert sie. (Genau so ist
`donald/uebergabe-dev-migration-blockiert` hängengeblieben.)

## Accomplished

**C2 „Android-Zurück"** — drei Zweige: offenes Overlay schliessen · sonst eine
Seite zurück · sonst in den Hintergrund. Nie beenden.

**C3 „Bild über einen Aufrufpunkt"** — sechs Flächen (Profilbild, Titelbild,
Event-Cover, Willkommen, Feed ×2) laufen über `useBildauswahl`. Keine weiss, auf
welcher Plattform sie läuft: sie ruft `oeffnen` und bekommt ihre Dateien in
DERSELBEN Senke wie das `onChange` des Dateifeldes.

| | |
| --- | --- |
| Tests | **2291 grün** (207 Dateien), `tsc`, `eslint` 0 Fehler, `build`, openspec 31/31 |
| Neu | `src/lib/zurueck.ts`, `src/lib/bildauswahl.ts`, `useBildauswahl.tsx`, je mit Test |
| Gegenproben | 3 Mutationen bei C2, 6 bei C3 — jede von der gemeinten Zusage gefangen |

Dazu **14 Aufgaben allein durch Messen geschlossen** (C1 und der Grossteil von
B5), ohne eine Zeile Code.

## Decisions

- **C3: die Rückfrage „Aufnehmen oder aus der Mediathek?" stellt die App
  selbst** (Donald, 31.08.). `@capacitor/camera` 8.2.3 führt `getPhoto` samt
  eingebauter Quellen-Rückfrage als **veraltet** und verweist dafür auf eine
  eigene Oberfläche. Ersatz sind `takePhoto` und `chooseFromGallery`; nur der
  zweite kann Mehrfachauswahl — deshalb behält der Feed sie. Die Anforderung in
  `specs/native-shell/spec.md` ist nachgezogen, sie sprach vom „nativen Ablauf
  mit der Wahl".
- **`limit` ist der REST, nicht das Maximum.** Im Web hält der Dateidialog
  nichts, nativ hielte es niemand, und `waehleBilder` verwürfe den Überschuss
  stumm.
- **`EncodingType.JPEG` bei der Kamera** — die Lehre vom 17.08.: ein HEIC vom
  iPhone zeigte im Zuschnitt eine leere Fläche und einen toten Knopf.
  `chooseFromGallery` kennt die Option nicht; dort trägt der Zweig, den
  `AvatarCropper` dafür schon hat.
- **`useOverlay` bekam eine PFLICHT-Schliessfunktion** (C2), dazu
  `istOverlayOffen()` und `schliesseOberstesOverlay()`. Pflicht aus dem Grund,
  aus dem der Hook entstand (AGE-529): der Mangel wäre nicht die eine Fläche,
  sondern die fehlende Regel — der Typ erzwingt sie an acht Anschlussstellen.
- **`hatVerlauf` liest `window.history.state.idx`**, nicht
  `location.key !== "default"`: `RequireAuth` und `HomeRedirect` **ersetzen**
  beim Kaltstart den ersten Eintrag. In `react-router@7.18.2` gemessen —
  `push` erhöht den Index, **`replace` nicht**.

## Was diese Sitzung über das Verfahren gelernt hat

Vier Memories: `catch-durch-den-aufrufer-nicht-belegbar` ·
`neue-node-abhaengigkeit-macht-deno-job-rot` (nach `deno install --frozen=false`
**zwingend** `pnpm install`) · `archivieren-zieht-neuigkeiten-nach` (jeder
`pnpm build` schreibt `release-entries.generated.ts` unformatiert um) ·
`handoff-ist-geteilt-scope-abgrenzen`. Dazu ohne Memory: dieser Branch liess
sich **nicht normal rebasen** — die 21 Vor-Squash-Commits von #277 kollidieren
mit dem eigenen, gemergten Inhalt; Weg war `rebase --onto`.

## Files modified

Commits `106504d` (C2) und `aff6954` (C3):

- **neu**: `src/lib/zurueck.ts`, `src/lib/bildauswahl.ts`,
  `src/components/ui/useBildauswahl.tsx` — je mit Testdatei
- `useOverlay.ts` + Test (Stapel-Ausgänge, Pflichtargument), `AppShell.tsx`
  (`backButton`-Zuhörer), die sieben weiteren `useOverlay`-Stellen, die sechs
  Bildstellen samt `CommunityFeed.composer.test.tsx`
- `package.json`, `pnpm-lock.yaml`, `deno.lock` — `@capacitor/app@8.1.1`,
  `@capacitor/camera@8.2.3`; dazu `cap update` in drei nativen Dateien
- `openspec/changes/capacitor-huelle/` — `tasks.md` und die
  `native-shell`-Anforderung; überholte Lesarten **sichtbar widerrufen**

## Next session: start here

C1–C3 sind gemergt; damit ist alles erledigt, was ohne Geräte geht. Der Branch
ist sauber und liegt auf `main` — einfach weiterarbeiten, kein Aufräumen nötig.

Es bleibt in diesem Change nur noch **Phase D (OTA)** — 29 offene Punkte
über D1–D5, plus **B3 Signaturmaterial** (4 offen). Der Grundsatz ist gefallen
(selbst gehostet auf Cloudflare, Donald 27.08.); offen sind Anlass,
Fassungsschema und das Signaturschlüsselpaar. D1 ist der Einstieg: der Weg, auf
dem ein Bündel entsteht.

## Zwei flackernde Tests — erst neu laufen lassen, dann suchen

Von `fbc-platform-f4` am 31.08. **auf einem Diff ohne eine einzige Quelldatei**
gemessen, also beides Bestand: `use-gespraech.test.tsx` → „bietet den Weg wieder
an, wenn eine Neuabfrage Älteres meldet" (1 von 2259, Rerun grün) · ein
`ReferenceError: window is not defined` aus `AdminMitgliederPage.test.tsx`.

**Der zweite zeigt scheinbar hierher** — `AdminMitgliederPage.tsx` ist eine der
acht `useOverlay`-Stellen —, wurde aber gesehen, **bevor dieser Code irgendwo
lag**. Bei rotem `verify` also erst `gh run rerun --failed`. Roter Beleg bei f4
gesichert: Lauf `33371323105`, Job `99422887270`, Commit `7e8184b`.

## Open questions — alle innerhalb AGE-642

- **Vier Gerätebelege stehen aus:** C3 auf beiden Plattformen (Kamera und
  Mediathek, Bild danach sichtbar) · C2 auf Android · C1 auf iOS · B5 der
  Startbildschirm. **Für B5 muss die App gelöscht werden**
  (Launch-Screen-Zwischenspeicher), **und das kostet Donald die Anmeldung** —
  vorher ansagen.
- **C3 ändert an zwei Stellen die Optik**, unvermeidbar: `WillkommenPage` und
  das Bearbeiten-Formular im Feed trugen ein *sichtbares* Dateifeld, das
  zugleich der Auslöser war. Ein `<label>` löst sein Feld unabweisbar selbst
  aus — es gäbe keine Stelle für die Rückfrage. Beide liegen jetzt hinter einem
  Knopf. **Im Browser ansehen, bevor das gemergt wird.**
- **`useBildauswahl.tsx` trägt eine Fast-Refresh-Warnung** — dieselbe, die vier
  bestehende Dateien schon tragen. Eine eigene Datei dafür wäre eine
  Abstraktion für einen einzigen Aufrufer.
- **`.env` hier war eine ATTRAPPE** (`.env.ATTRAPPE-MESSUNG.bak`) — ein blankes
  `pnpm build` erzeugt kein lauffähiges Gerätebündel. Android zusätzlich:
  `.../assets/public` ist veraltete `cap sync`-Ausgabe; `pnpm build:prod` →
  `npx cap sync android`.
- **`push-fundament` (13 offen)** hängt am selben Gerät, darunter drei Punkte,
  die von selbst nie auffallen: ein `supabase db reset` tilgt den
  Wiederholungslauf lautlos · ein dauerhafter Zustellausfall ist unsichtbar ·
  `net._http_response` wächst unaufgeräumt. Dazu tote Gerätetokens.
- **AGE-641 steht auf Done**, hat aber 13 offene Aufgaben — Donalds
  Entscheidung. **AGE-642 springt beim Merge selbst auf Done**; vorbeugen geht
  nicht, nur nachsehen.

*Alles ausserhalb AGE-642 — AGE-664/660/618, die Bucket-Zahlen, der Doku-Branch
`donald/uebergabe-dev-migration-blockiert` — steht bewusst NICHT mehr hier.
AGE-599 und der Neuigkeiten-Eintrag sind erledigt bzw. entschieden; siehe den
Kasten oben, der auch sagt, warum die alte AGE-599-Anweisung gefährlich ist.*
