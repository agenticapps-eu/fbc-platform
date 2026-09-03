# Aus der Navigationsschublade heraus steht genau ein Modal

Linear: **AGE-688**

## Why

Unterhalb von `lg` steckt die Navigation in einer Off-Canvas-Schublade, und der
Feedback-Zugang steht dort mit drin — auf dem Telefon ist das der **einzige**
Ort, an dem er überhaupt steht. Beide Flächen geben sich als modal aus, und
beide bleiben gleichzeitig offen.

Am Code gegen `2359eae` nachgemessen, dem Stand, auf dem dieser Branch abzweigt:

| Zeile | Was dort steht |
| -- | -- |
| `AppShell.tsx:1148-1153` | die Schublade: `fixed inset-0 z-50 lg:hidden`, `role="dialog"`, `aria-modal="true"`, `aria-label="Navigation"` |
| `AppShell.tsx:1172` | `<SidebarContent onNavigate={() => setMobileNavOpen(false)} />` — **die einzige** Stelle, die die Schublade von innen schliesst |
| `AppShell.tsx:1176` | `<FeedbackButton />`, daneben, ausserhalb dieses Pfads |
| `FeedbackButton.tsx:207` | `onClick={() => setOpen(true)}` — kennt die Schublade nicht |
| `FeedbackButton.tsx:226` | `createPortal(…, document.body)` |
| `FeedbackButton.tsx:231` | das zweite `aria-modal="true"` |

Feedback ist keine Navigation, `onNavigate` greift also nicht. Damit tragen zwei
Elemente gleichzeitig `aria-modal="true"`, und das Formular liegt als Geschwister
von `#root` unter `body` — **ausserhalb** der Schublade. Vorlesesoftware, die
`aria-modal` befolgt, hält alles ausserhalb des als modal ausgezeichneten Knotens
für inert: sie zeigt die Schublade und nicht das Formular. Auf dem Telefon ist
das der einzige Weg zum Feedback, es gibt also keinen zweiten.

**Bestand auf `main`, keine Regression aus AGE-628** — gefunden bei dessen
Abschluss und dort bewusst nicht mitgenommen.

### Zwei naheliegende Verdächtigungen halten der Messung nicht stand

Beide stehen hier, damit die Behebung nicht am falschen Ende ansetzt:

- **Die Fokus-Falle ist in Ordnung.** `useOverlay.ts:32` führt einen Stapel im
  Modul; die Sperre hängt an der Tiefe, die Falle ausdrücklich nur an der Spitze
  (`useOverlay.ts:165`). Das Formular liegt oben und hat die Falle.
  Tastaturbedienung funktioniert.
- **Sichtbar ist es auch.** Beide stehen auf `z-50`, aber das Portal hängt hinter
  `#root` an `body` und malt deshalb darüber.

Der Defekt ist **allein die `aria-modal`-Semantik**.

## What Changes

- **Die Schublade gibt ihr `aria-modal` ab, solange das Feedback-Formular
  darüber steht**, und bekommt es beim Schliessen zurück. Aus zwei gleichzeitig
  modalen Flächen wird eine, ohne dass eine davon verschwindet.
- **Sie erfährt es von ihrem eigenen Kind.** `FeedbackButton` meldet der
  aufrufenden Fläche, ob sein Formular offen ist — über jeden Weg, auf dem es
  zugeht, und beim Abhängen.
- Der Feedback-Zugang in der angedockten Seitenleiste ab `lg`
  (`AppShell.tsx:866`) bleibt unverändert: dort gibt es keine Schublade, die
  etwas abgeben könnte.

Die Schublade bleibt dabei **offen**. Der Nutzer kehrt nach dem Abschicken in
denselben Zustand zurück, aus dem er kam.

## Warum nicht der naheliegende Weg

Der erste Entwurf dieses Changes schloss die Schublade beim Öffnen des
Formulars — der Weg, den auch das Issue zuerst nennt. Er ist **gemessen
unbrauchbar**, und die Messung gehört hierher, damit ihn niemand ein zweites
Mal vorschlägt:

`<FeedbackButton />` wird **innerhalb** der Schublade gerendert
(`AppShell.tsx:1176`). Sie zu schliessen hängt die Komponente ab und nimmt den
`open`-Zustand mit, an dem das Portal hängt. Am 03.09. mit genau dieser
Implementierung gemessen: die Schublade ging zu, das Formular **gar nicht erst
auf** — `0` Knoten mit `aria-modal="true"` statt `1`. Der Zugang, um den es
geht, wäre damit auf dem Telefon nicht mehr bloss für Vorlesesoftware
unerreichbar, sondern für alle.

Ihn zu retten hiesse, Auslöser und Formular zu trennen und den Zustand in die
Schale zu heben — ein Umbau an der Komponente, die AGE-628 gerade erst
ausgeliefert hat, für eine Korrektur an einem Attribut.

Die zweite Richtung aus dem Issue nennt `istOverlayOffen()` als Quelle. Auch das
nicht: `useOverlay.ts:32` ist ein **Modulwert ohne Abonnement**, ein `push`
darauf löst in `AppShell` kein Render aus. Die Schale braucht ihn aber gar
nicht — das obere Overlay ist ihr **eigenes Kind** und kann es ihr direkt sagen.

## Was NICHT dazugehört

- **Kein Umbau von `useOverlay`.** Der Hook bleibt unberührt; Sperre und
  Fokus-Falle stimmen bereits (die Falle hängt an der Spitze des Stapels,
  `useOverlay.ts:165`).
- **Keine Trennung von Auslöser und Formular.** Siehe oben: das wäre der Umbau,
  den dieser Change vermeidet.
- **Keine allgemeine Zusage „höchstens ein `aria-modal` im Dokument".** Sieben
  weitere Flächen tragen das Attribut (Lightbox, Avatar-Zuschnitt,
  Kopfzeilensuche, Bildquellen-Rückfrage, Neuigkeiten, Mitgliederverwaltung,
  Nachrichten-Schublade). Ob eine von ihnen sich mit einer anderen stapeln kann,
  ist ungemessen — eine Zusage darüber wäre eine, die dieser Change nicht deckt.
- **Die Nachrichten-Schublade rechts** (`AppShell.tsx:1185-1191`) trägt keinen
  Feedback-Zugang und ist von diesem Befund nicht betroffen.

## Verfahren

**Kein Fremdreviewer** (Schritt 2b entfällt). Reines UI: kein Schema, keine
Rechte, keine Sicherheitsgrenze — Donalds stehende Regel vom 26.08. `REVIEWS.md`
entsteht deshalb nicht.

## Die zwei Fallen beim Bauen

1. **Die Meldung muss JEDEN Weg erfassen, auf dem das Formular zugeht** —
   Abbrechen, Absenden, Escape, Klick auf den Schleier, und das Abhängen der
   Komponente beim Sprung über `lg`. `setOpen(false)` steht in
   `FeedbackButton.tsx` an mehreren Stellen; eine davon zu übersehen liesse die
   Schublade dauerhaft ohne `aria-modal` zurück. Ein Effekt auf `open` samt
   Aufräumen deckt alle auf einmal.
2. **`getByLabelText` ist nicht der zugängliche Name.** Die Abnahme prüft über
   `getByRole("dialog", { name: … })`. Und die Zählung `aria-modal="true"` läuft
   über `document.querySelectorAll`, nicht über `screen` — das Formular hängt
   per Portal an `body` und damit ausserhalb des Render-Containers.
