import { useEffect, useRef, type RefObject } from "react";

/**
 * Sperre und Fokus-Falle für modale Overlays (AGE-529).
 *
 * Ein Hook für ALLE vier gemounteten Overlays — Bild-Lightbox, AvatarCropper,
 * Feedback-Panel, Off-Canvas-Navigation. Der Mangel war nicht die fehlende
 * Sperre an einer Stelle, sondern die fehlende Regel: eine Sperre nur in der
 * Lightbox wäre die Ausnahme gewesen, und das nächste Overlay entstünde wieder
 * ohne.
 *
 * Kein `<Dialog>`-Primitiv: die vier Markups sind zu verschieden (Portal,
 * Schublade, Bogen von unten, zentrierter Kasten). Ein Hook nimmt das
 * Verhalten, das allen fehlt, und lässt das Markup in Ruhe.
 *
 * NICHT hier geprüft, weil jsdom es nicht kann: ob iOS Safari sich an
 * `position: fixed` hält. Das ist die Sichtprobe am Gerät.
 */

/**
 * Ein Stapel, kein Schalter und kein bloßer Zähler — im Modul, weil er über
 * Komponentengrenzen hinweg derselbe sein muss.
 *
 * Die SPERRE hängt an der Tiefe (nur 0→1 sperrt, nur 1→0 gibt frei); das
 * Feedback-Panel liegt im AppShell und ist auch bei offener Lightbox
 * erreichbar, ein Schalter entsperrte für beide.
 *
 * Die FALLE hängt an der Spitze: nur das oberste Overlay behandelt Tab. Ohne
 * diese Regel behandelten zwei aktive Fallen denselben Tastendruck und rissen
 * den Fokus gegeneinander.
 */
const stapel: object[] = [];

/** Gehört dem ERSTEN Sperrer: seine Scroll-Position und die Inline-Stile, die
 *  er am `body` vorgefunden hat. */
let gemerkt: { y: number; position: string; top: string; left: string; right: string } | null = null;

function sperren() {
  const s = document.body.style;
  gemerkt = { y: window.scrollY, position: s.position, top: s.top, left: s.left, right: s.right };
  // `overflow: hidden` allein hält auf iOS Safari NICHT — dort läuft das
  // visuelle Viewport unabhängig weiter. `left`/`right` müssen mit, sonst
  // kollabiert der Body auf seine Inhaltsbreite, sobald er aus dem Fluss
  // genommen wird, und die Seite ruckt seitlich.
  s.position = "fixed";
  s.top = `-${gemerkt.y}px`;
  s.left = "0px";
  s.right = "0px";
}

function freigeben() {
  if (!gemerkt) return;
  const s = document.body.style;
  // Zurückschreiben statt leeren: ein global wiederverwendbarer Hook darf
  // fremden Zustand nicht zerstören.
  s.position = gemerkt.position;
  s.top = gemerkt.top;
  s.left = gemerkt.left;
  s.right = gemerkt.right;
  // Die wichtigste Zeile: `position: fixed` hat den Dokument-Scroll auf 0
  // gesetzt. Ohne sie stünde der Leser nach dem Schließen am Seitenanfang —
  // schlechter als gar keine Sperre.
  window.scrollTo(0, gemerkt.y);
  gemerkt = null;
}

const FOKUSSIERBAR = "a[href], button, input, select, textarea, [tabindex]";

/**
 * Bewusst OHNE Sichtbarkeitsfilter. Die drei Wege dorthin (`offsetParent`,
 * `getClientRects`, `checkVisibility`) melden in jsdom jeden Knoten als
 * unsichtbar — ein solcher Filter machte die Falle in den Tests zur grünen
 * Attrappe. Der Preis: ein ausgeblendeter Knopf im Overlay käme in den Umlauf.
 * Keines der vier Overlays hat heute einen.
 */
function fokussierbare(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOKUSSIERBAR)).filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      el.getAttribute("tabindex") !== "-1" &&
      !(el instanceof HTMLInputElement && el.type === "hidden"),
  );
}

/**
 * Sperrt die Seite hinter dem Overlay und hält den Fokus darin.
 *
 * Generisch typisiert, weil `RefObject<HTMLElement | null>` unter React 19
 * nicht an das `ref` eines `<div>` zuweisbar ist (`current` ist invariant).
 *
 * @param aktiv ob das Overlay gerade offen ist
 * @returns Ref für den Overlay-Container; daran hängt die Falle
 */
export function useOverlay<T extends HTMLElement = HTMLDivElement>(
  aktiv: boolean,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!aktiv) return;

    const eintrag = {};
    stapel.push(eintrag);
    if (stapel.length === 1) sperren();

    // Wer den Fokus hatte, BEVOR das Overlay aufging. Der Hook versetzt ihn
    // beim Öffnen nicht — das entscheidet jedes Overlay selbst, und die
    // Lightbox tut es aus gutem Grund genau einmal (sonst risse jeder
    // Bildwechsel den Fokus zurück auf „Schließen").
    const vorher = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (stapel[stapel.length - 1] !== eintrag) return;
      const container = ref.current;
      if (!container) return;
      const knoten = fokussierbare(container);
      if (knoten.length === 0) return;

      const erster = knoten[0];
      const letzter = knoten[knoten.length - 1];
      const jetzt = document.activeElement;

      // Steht der Fokus AUSSERHALB, holt ihn der erste Tab herein. Drei der
      // vier Overlays versetzen ihn beim Öffnen nicht; ohne diesen Zweig sähe
      // die Falle ihn nie, und `aria-modal` bliebe eine Zusage ohne Deckung.
      if (!container.contains(jetzt)) {
        e.preventDefault();
        (e.shiftKey ? letzter : erster).focus();
        return;
      }
      if (!e.shiftKey && jetzt === letzter) {
        e.preventDefault();
        erster.focus();
      } else if (e.shiftKey && jetzt === erster) {
        e.preventDefault();
        letzter.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      const i = stapel.indexOf(eintrag);
      // Nur wer OBEN lag, gibt den Fokus zurück. Schließt ein unteres Overlay,
      // während ein oberes noch steht, risse eine Rückgabe den Fokus mitten aus
      // dem sichtbaren Dialog heraus (Diff-Review).
      const warOben = i === stapel.length - 1;
      if (i >= 0) stapel.splice(i, 1);
      if (stapel.length === 0) freigeben();
      // NACH dem Freigeben, und ohne zu scrollen: ein gewöhnliches `focus()`
      // zieht das Element in den Blick und verschöbe genau die Position, die
      // eine Zeile vorher exakt wiederhergestellt wurde. `isConnected`, weil
      // der Auslöser verschwunden sein kann, während das Overlay offen war.
      //
      // GRENZE, bewusst in Kauf genommen: `vorher` ist `document.activeElement`
      // beim Öffnen — Safari fokussiert eine Schaltfläche beim Zeigerklick
      // nicht, dort bleibt es also `body` und die Rückgabe entfällt still. Für
      // Tastaturbedienung, wo die Rückgabe zählt, ist der Auslöser fokussiert;
      // den Auslöser stattdessen durch alle vier Anschlüsse zu reichen, wäre
      // API-Umbau für einen Fall, in dem der Rückfall dem heutigen Zustand
      // entspricht.
      if (warOben && vorher?.isConnected) vorher.focus({ preventScroll: true });
    };
  }, [aktiv]);

  return ref;
}
