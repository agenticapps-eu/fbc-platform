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

- **Der Feedback-Zugang in der Schublade schliesst die Schublade**, so wie es
  jeder andere Eintrag darin längst tut. Aus zwei gleichzeitig modalen Flächen
  wird eine.
- Der Feedback-Zugang in der ausgeklappten Seitenleiste ab `lg`
  (`AppShell.tsx:866`) bleibt unverändert: dort gibt es keine Schublade, die
  sich schliessen könnte.

Preis, ehrlich benannt: nach dem Abschicken steht die Navigation nicht mehr
offen. Sie kostet einen Tipp auf das Burger-Menü. Das ist derselbe Preis, den
jeder Navigationseintrag in der Schublade heute schon kostet — und die
Alternative wäre, dass die Fläche für Vorlesesoftware unerreichbar bleibt.

## Warum nicht der andere Weg

Das Issue nennt als zweite Richtung, der Schublade ihr `aria-modal` abzunehmen,
solange ein Overlay über ihr liegt — `useOverlay` kenne die Stapeltiefe ja
bereits (`istOverlayOffen`, AGE-642 C2).

Gemessen ist das teurer, als es aussieht: `useOverlay.ts:32` ist ein
**Modulwert ohne Abonnement**. `istOverlayOffen()` liest ihn, benachrichtigt
aber niemanden — ein `push` auf den Stapel löst in `AppShell` kein Render aus.
Der Weg verlangte also zuerst eine Benachrichtigung an Abonnenten im geteilten
Hook, an dem heute vier Overlays hängen, und das für eine Korrektur, die nichts
als ein Attribut betrifft. Der gewählte Weg löst es an der Wurzel: gibt es nur
ein Modal, gibt es auch nur ein `aria-modal`.

## Was NICHT dazugehört

- **Kein `<Dialog>`-Primitiv, kein Umbau von `useOverlay`.** Der Hook bleibt
  unberührt; diese Änderung fasst ihn nicht an.
- **Keine allgemeine Zusage „höchstens ein `aria-modal` im Dokument".** Sieben
  weitere Flächen tragen das Attribut (Lightbox, Avatar-Zuschnitt,
  Kopfzeilensuche, Bildquellen-Rückfrage, Neuigkeiten, Mitgliederverwaltung,
  Nachrichten-Schublade). Ob eine von ihnen sich mit einer anderen stapeln kann,
  ist ungemessen — eine Zusage darüber wäre eine, die dieser Change nicht deckt.
  Belegt und zugesagt wird der Weg aus der Schublade heraus.
- **Die Nachrichten-Schublade rechts** (`AppShell.tsx:1185-1191`) trägt keinen
  Feedback-Zugang und ist von diesem Befund nicht betroffen.

## Verfahren

**Kein Fremdreviewer** (Schritt 2b entfällt). Reines UI: kein Schema, keine
Rechte, keine Sicherheitsgrenze — Donalds stehende Regel vom 26.08. `REVIEWS.md`
entsteht deshalb nicht.

## Die eine Falle beim Bauen

`getByLabelText` ist **nicht** der zugängliche Name. Die Abnahme prüft über
`getByRole("dialog", { name: … })`, sonst geht die Zusage an einer Fläche vorbei,
die zufällig ein passendes Label trägt. Und die Zählung `aria-modal="true"` muss
über `document.querySelectorAll` laufen, nicht über `screen` — das Formular hängt
per Portal an `body` und damit ausserhalb des Render-Containers.
