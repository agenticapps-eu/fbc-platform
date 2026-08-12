# Tasks — Overlay-Hygiene (AGE-529)

## 1 · Der Hook, rot vor grün

- [x] 1.1 Test: bei `scrollY = 600` und aktivem Hook trägt der `body`
      `position: fixed`, `top: -600px`, `left: 0`, `right: 0`.
- [x] 1.2 Test: beim Lösen wurde `window.scrollTo` mit `(0, 600)` gerufen.
      **Die wichtigste Zeile des Changes** — ohne sie springt die Seite an den
      Anfang und die Sperre ist schlechter als keine.
- [x] 1.3 Test: mit **vorbelegten** Inline-Stilen am `body` sperren und lösen →
      die Ausgangswerte stehen wieder da, nicht leere Zeichenketten.
- [x] 1.4 Test: zwei gleichzeitig aktive Sperren, eine gelöst → weiterhin
      gesperrt; erst die zweite gibt frei.
- [x] 1.5 Test: Tab auf dem letzten fokussierbaren Knoten landet auf dem
      ersten; Shift-Tab auf dem ersten landet auf dem letzten.
- [x] 1.6 Test: **Fokus außerhalb** des Containers, Tab → erster Knoten im
      Overlay. Der Fall, ohne den die Falle bei drei von vier Overlays nie
      greift.
- [x] 1.7 Test: zwei offene Overlays — **nur das obere** behandelt Tab.
- [x] 1.8 Test: beim Öffnen versetzt der Hook den Fokus **nicht**.
- [x] 1.9 Test: der Fokus kehrt beim Schließen auf das auslösende Element
      zurück; ein inzwischen **entfernter** Auslöser bricht nichts.
- [x] 1.10 Test: ein Overlay ohne fokussierbaren Inhalt bricht nicht.
- [x] 1.11 `src/components/ui/useOverlay.ts` schreiben, bis 1.1–1.10 grün sind.
      Generisch typisiert (`<T extends HTMLElement = HTMLDivElement>`), sonst
      scheitert der Ref am `<div>` unter React 19.

## 2 · Die vier Anschlüsse

- [x] 2.1 Bild-Lightbox (`CommunityFeed.tsx`).
- [x] 2.2 AvatarCropper (`AvatarCropper.tsx`).
- [x] 2.3 Feedback-Panel (`FeedbackButton.tsx`) — Hook **vor** dem frühen
      `if (!user) return null`, aktiviert mit `Boolean(user) && open`. Sonst
      verletzt ein Wechsel des Anmeldezustands die Hook-Regeln.
- [x] 2.4 Off-Canvas-Navigation (`AppShell.tsx`) — das Overlay, das im
      Issue-Tisch fehlte und auf dem Telefon am meisten zählt.
- [x] 2.5 **`lg`-Wächter** in `AppShell.tsx`: beim Überschreiten des
      Breakpoints schließt die Navigation. Ohne ihn bleibt `mobileNavOpen`
      true, die Schublade ist per `lg:hidden` unsichtbar — und der Body wäre
      dauerhaft gesperrt. Bedingung dafür, dass 2.4 überhaupt erlaubt ist.
- [x] 2.6 Je Overlay ein Test mit **Fokusumlauf**, nicht nur „Body gesperrt".
      Nur der belegt, dass der Ref auch am Container hängt — ein Anschluss, der
      den Hook ruft und den Ref vergisst, wäre sonst grün.
- [x] 2.7 Test für den `lg`-Wächter: geöffnet, Breite erreicht `lg` →
      geschlossen und Body frei.

## 3 · Der Feedback-Knopf

- [x] 3.1 Test: die Klassenliste des Knopfes trägt `sm:fixed` und **kein**
      nacktes `fixed`. Schwächer als ein Layouttest, aber jsdom hat weder
      Layout noch Breakpoints — die echte Messung steht in 4.3.
- [x] 3.2 `fixed bottom-20 right-5 z-40` → nur ab `sm`; darunter steht der
      Knopf im Fluss am Seitenende (er wird ohnehin nach `<main>` gerendert).

## 4 · Abnahme

- [x] 4.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün.
- [x] 4.2 Code-Review auf dem Diff.
- [ ] 4.3 **Auf 375 px im echten Browser**: `document.elementFromPoint` in der
      Mitte jeder sichtbaren kuratierten Kachel liefert die Kachel, nicht
      „Feedback" — nicht mit einem Screenshot belegt.
- [~] 4.4 Gegenprobe am Schreibtisch: TEILWEISE erledigt. Die Off-Canvas-
      Navigation ist im echten Browser gemessen (EVIDENCE.md) — Sperre, exakte
      Rueckgabe der Position und der `lg`-Wechsel. Lightbox, Cropper und
      Feedback-Panel brauchen ein eingeloggtes Konto; ihre Anschluesse sind je
      durch einen Fokusumlauf-Test belegt, die Sichtprobe steht aus.
- [ ] 4.5 **Auf einem echten iPhone** nachgesehen, dass die Seite hinter dem
      Overlay stillsteht und beim Schließen nicht springt. **Das kann diese
      Sitzung nicht leisten — hier braucht es Donald.**

## Nicht in diesem Change

- Ein `<Dialog>`-Primitiv in `src/components/ui/` (Begründung in `design.md`).
- Der DesignSwitcher — seit AGE-492 nicht gemountet (`App.tsx:44`).
- `bottom-20` → `bottom-5` am Feedback-Knopf. Der Kommentar dort begründet den
  Abstand mit dem nicht mehr gemounteten DesignSwitcher; das ist ein eigenes
  Issue, hier wäre es Beifang.
- Ein Sichtbarkeitsfilter für fokussierbare Knoten — in jsdom nicht messbar,
  Begründung und Preis stehen in `design.md`.
