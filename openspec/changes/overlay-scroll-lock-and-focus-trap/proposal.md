## Why

Linear: **AGE-529**. Zwei Befunde aus dem QA-Gate zu AGE-528 (Task 9.7,
2026-08-12), beide gemessen, beide bewusst nicht in jenem PR behoben. Belege im
Archiv unter `openspec/changes/archive/2026-08-12-activity-media-and-tags/EVIDENCE.md`.

### Der Bestand

Es gibt **kein Dialog-Primitiv** in `src/components/ui/`. Jedes Overlay ist von
Hand gebaut, und `FeedbackButton.tsx:16` sagt das auch offen: „Kein
Dialog-Primitive im Repo → Overlay-Muster aus AppShell.tsx". Vier davon sind
gemountet:

| Overlay | Ort | z-index |
| -- | -- | -- |
| Bild-Lightbox | `CommunityFeed.tsx:895` | 50 |
| AvatarCropper | `AvatarCropper.tsx:191` | 50 |
| Feedback-Panel | `FeedbackButton.tsx:85` | 50 |
| **Off-Canvas-Navigation** | `AppShell.tsx:444` | 50 |

**Keines sperrt das Scrollen. Keines hält den Fokus.** Gemessen an der
Lightbox: bei offenem Overlay bewegt das Rad den Feed dahinter, `scrollY`
0 → 600. Wer schließt, steht an anderer Stelle.

### Zwei Korrekturen am Issue-Tisch

Der Tisch in AGE-529 führt vier Overlays, aber nicht dieselben vier:

- **Der DesignSwitcher ist nicht gemountet.** `src/App.tsx:44` sagt es
  ausdrücklich: „wird seit AGE-492 nicht mehr gemountet … bleibt im Baum, nur
  ohne Montagepunkt." Er steht auf keiner Seite und bleibt daher außen vor
  (Donald, 2026-08-12).
- **Die Off-Canvas-Navigation fehlte im Tisch.** Sie ist `role="dialog"`,
  `aria-modal="true"`, auf **jeder** Seite gemountet und erscheint nur unter
  `lg` — also genau der Telefonfall, für den Teil 1b die robuste iOS-Variante
  verlangt. Sie ist damit das Overlay, an dem die Sperre am meisten zählt, und
  war das einzige ohne Zeile im Issue.

## What Changes

### 1 · Ein gemeinsamer Hook, nicht vier Einzellösungen

Ein `useOverlay(aktiv)` in `src/components/ui/`, an dem **alle vier** hängen.
Der Fehler ist nicht die fehlende Sperre an *einer* Stelle, sondern dass es die
Regel nicht gibt — eine Sperre nur in der Lightbox wäre die Ausnahme, und der
fünfte Dialog entstünde wieder ohne.

Kein neues Primitiv, kein Umbau am Markup: ein Hook, vier Anschlüsse.

### 2 · Die robuste Sperre, mit Zählung statt Schalter

`body { overflow: hidden }` allein hält auf iOS Safari nicht. Nötig ist
`position: fixed` plus `top: -scrollY` und **exaktes Wiederherstellen** beim
Schließen. Das ist der eigentliche Zweck: nach dem Schließen soll man dort
stehen, wo man war. **Eine halbe Umsetzung springt an den Seitenanfang und ist
schlechter als der heutige Zustand** — der Test prüft deshalb die
Wiederherstellung mit, nicht nur das Sperren.

Gleichzeitig offene Overlays dürfen sich nicht gegenseitig entsperren: der Hook
zählt, er schaltet nicht.

### 3 · Die Fokus-Falle, im selben Hook

Alle vier setzen `aria-modal="true"` und sagen Screenreadern damit, der Rest
der Seite sei inert. Da keines den Fokus hält, ist das **eine Zusage, die der
Code nicht einhält**: wer mit der Tastatur bedient, tabbt hinter das Overlay
und bedient, was er nicht sieht.

Der Hook fängt Tab und Shift-Tab im Overlay und gibt den Fokus beim Schließen
an das auslösende Element zurück. Er **bewegt den Fokus beim Öffnen nicht** —
die Lightbox entscheidet das bereits selbst und aus gutem Grund
(`CommunityFeed.tsx:877`: sonst risse jeder Bildwechsel den Fokus zurück auf
„Schließen"). Die Falle ergänzt diese Entscheidung, sie ersetzt sie nicht.

### 4 · Der Feedback-Knopf schwebt unter `sm` nicht mehr

Gemessen: 375×812, Composer offen, Seitenanfang. Der feste Knopf
(240–340 × 690–732) liegt auf der letzten kuratierten Kachel „Frage"
(240–299 × 697–723); `document.elementFromPoint` in der Kachelmitte liefert
**„Feedback"**. Nach etwa 150 px Scrollen ist sie frei, am Schreibtisch tritt
es nicht auf.

Unter `sm` schwebt er nicht mehr, sondern steht am Seitenende — er wird dort
ohnehin schon nach `<main>` gerendert. **Nicht verschieben:** ein schwebender
Knopf über einer Kachelreihe kollidiert beim nächsten Formular wieder, und dann
merkt es niemand, weil niemand danach messen wird.

## Impact

- **Neu:** `src/components/ui/useOverlay.ts` (plus Test). Keine neue
  Abhängigkeit.
- **Berührt:** vier Overlay-Stellen um je eine Zeile, plus die Klassen des
  Feedback-Knopfes.
- **Am Schreibtisch unverändert:** der Knopf schwebt weiter, alle Overlays
  verhalten sich wie zuvor. Die Gegenprobe ist Abnahmebedingung, damit die
  Breakpoint-Bedingung nicht zu breit greift.
- **Betrifft ein globales Widget.** Der Feedback-Knopf liegt im AppShell und
  wirkt damit auf allen Seiten — das ist der Preis und war Teil der
  Entscheidung.
- **Eine Abnahmezeile kann diese Sitzung nicht erfüllen:** die Sichtprobe auf
  einem echten iPhone. jsdom hat kein Layout und kein Safari; dass die Seite
  hinter dem Overlay stillsteht und beim Schließen nicht springt, muss Donald
  am Gerät sehen.
