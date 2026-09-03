# Die Escape-Taste schliesst das Feedback-Fenster, nicht das Menü darunter

Linear: **AGE-697**

## Why

`AppShell.tsx:508` schliesst auf Escape die Off-Canvas-Navigation, **ohne zu
prüfen, ob etwas über ihr liegt**:

```ts
useEffect(() => {
  if (!mobileNavOpen) return;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setMobileNavOpen(false);
  };
  document.addEventListener("keydown", onKey);
  return () => document.removeEventListener("keydown", onKey);
}, [mobileNavOpen]);
```

Wer bei offenem Feedback-Formular Escape drückt, verliert **beides** — nicht
weil das Formular Escape behandelte, sondern weil sein Auslöser in der Schublade
steht und mit ihr abgehängt wird (AGE-688).

Gemessen beim Bauen von AGE-688: eine Zusage, die nach Escape das `aria-modal`
der Schublade prüfen wollte, mass danach einen **losgelösten Knoten**. Sie musste
auf „Abbrechen" im Formular ausweichen, damit sie überhaupt etwas belegt.

**Und die grössere Hälfte fiel dabei erst auf:** `FeedbackButton.tsx` hat
**überhaupt keinen** Escape-Lauscher. Unterhalb von `lg` schloss der Tastendruck
die Schublade darunter, ab `lg` bewirkte er **gar nichts** — das Formular ist
dort nur über „Abbrechen", den Schleier oder die Fokus-Falle zu verlassen.

## Die Regel steht schon im Repo

`EmojiAuswahl.tsx:131-152` löst genau dieses Problem und benennt den Fehlermodus
wörtlich: „CAPTURE und `stopPropagation`, weil `AppShell` die Chat-Schublade
ihrerseits bei Escape über einen `document`-Lauscher schliesst. In der
Blasenphase schlösse ein Tastendruck beides auf einmal."

Das obere Overlay nimmt Escape für sich, in der Capture-Phase am Dokument. Das
Feedback-Formular folgt dieser Regel bis heute nicht.

## What Changes

- **Escape schliesst das Feedback-Formular.** Bisher tat der Tastendruck dort
  entweder nichts (am grossen Bildschirm) oder das Falsche (am Telefon: er
  schloss das Menü darunter und riss das Formular mit weg).
- **Ein Escape schliesst genau eine Fläche.** Steht das Formular über dem
  geöffneten Menü, schliesst das erste Escape das Formular; das Menü bleibt
  stehen, und ein zweites Escape schliesst es.

## Was NICHT dazugehört

- **`AppShell.tsx` wird nicht angefasst.** Der Lauscher in Zeile 508 bleibt, wie
  er ist — er ist richtig für den Fall, dass nichts über der Schublade liegt,
  und die Capture-Phase des oberen Overlays kommt ihm zuvor. Ein Umbau auf
  `schliesseOberstesOverlay()` müsste **alle** Escape-Lauscher der Schale durch
  dieselbe Stelle führen, sonst behandeln zwei denselben Tastendruck; das ist ein
  eigener Vorgang und für diesen Befund nicht nötig.
- **Kein Escape in `useOverlay`.** Der Hook trägt Sperre und Fokus-Falle; Escape
  liegt in dieser Schale ausdrücklich als eigener Effect daneben
  (`AppShell.tsx:1188`). Ihn in den Hook zu ziehen beträfe alle vier Overlays und
  ist ein Umbau, kein Fix.
- **Die übrigen Escape-Lauscher bleiben ungemessen.** `AppShell.tsx:186`
  (Profilmenü) und `AppShell.tsx:521` (Nachrichten-Schublade) haben dieselbe
  Bauart. Ob über ihnen ein Overlay stehen kann, ist nicht gemessen — und eine
  Zusage darüber wäre eine, die dieser Change nicht deckt.

## Verfahren

**Kein Fremdreviewer** (Schritt 2b entfällt). Reines UI: kein Schema, keine
Rechte, keine Sicherheitsgrenze — Donalds stehende Regel vom 26.08.

## Die Falle beim Bauen

`stopPropagation()` in der **Capture**-Phase am `document` verhindert die
späteren Phasen desselben Ereignisses — also auch den Blasen-Lauscher der
Schublade am selben Knoten. Der dritte Parameter `true` gehört an
`addEventListener` **und** an `removeEventListener`; ohne ihn wird der Lauscher
nicht abgemeldet.
