import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "../../lib/cn";
import { filtereEmoji, type EmojiEintrag } from "../../lib/emoji-suche";

/** Emoji-Auswahl für die Sendezeile (AGE-645).
 *
 *  **Der Schalter liegt IM Eingabefeld, nicht daneben.** Gerechnet für die
 *  Fenster-Variante: 14 rem Spalte = 224 px, davon gehen Innenabstand, Abstand
 *  und der Senden-Knopf ab; der Eingabe bleiben rund 112 px. Ein dritter
 *  Flex-Partner nähme davon 40 px, also mehr als ein Drittel — und die Zeile
 *  hat in AGE-639 bereits zweimal nachgeben müssen. Als Überlagerung kostet er
 *  Innenabstand statt Zeilenbreite.
 *
 *  **Das Overlay hängt am `document.body`.** Ein Vorfahre mit `transform` oder
 *  `backdrop-filter` fängt `position: fixed` ein; in diesem Repository ist das
 *  dreimal passiert, zuletzt in AGE-639 bei der Fensterreihe. Und die Position
 *  wird aus `getBoundingClientRect()` gerechnet, NICHT aus CSS-Variablen der
 *  Hülle — die stehen am Wurzel-`div`, und was am `body` hängt, sieht sie nicht.
 */

const BREITE = 320;
const HOEHE = 320;
const ABSTAND = 8;
/** Spalten im Raster — auch der Schritt, den Pfeil-hoch/-runter macht. */
const SPALTEN = 8;

interface Daten {
  emoji: readonly EmojiEintrag[];
  gruppen: ReadonlyArray<readonly [number, string]>;
}

export function EmojiAuswahl({
  imFenster = false,
  onWaehle,
  onSchliessen,
}: {
  imFenster?: boolean;
  /** Das gewählte Emoji. Das Einfügen an der Cursorposition besorgt der
   *  Aufrufer — nur er kennt das Eingabefeld. */
  onWaehle: (emoji: string) => void;
  /** Gerufen, wenn ohne Wahl geschlossen wurde. Der Aufrufer holt den Fokus
   *  zurück in die Eingabe. */
  onSchliessen: () => void;
}) {
  const [offen, setOffen] = useState(false);
  const [daten, setDaten] = useState<Daten | null>(null);
  const [suche, setSuche] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const schalterRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sucheRef = useRef<HTMLInputElement>(null);
  const felderRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Der Datensatz wird ERST beim Öffnen geholt — 156 kB, die die Anmeldeseite
  // nichts angehen. Deshalb ein dynamisches `import()`; ein statisches zöge die
  // Datei ins Startbündel und bräche die Zusage still.
  useEffect(() => {
    if (!offen || daten) return;
    let abgebrochen = false;
    void import("../../content/emoji.generated")
      .then((m) => {
        if (!abgebrochen) setDaten({ emoji: m.EMOJI, gruppen: m.EMOJI_GRUPPEN });
      })
      .catch(() => {
        // Ein fehlgeschlagener Nachladeversuch darf die Sendezeile nicht
        // kosten. Das Feld bleibt leer und sagt das auch.
        if (!abgebrochen) setDaten({ emoji: [], gruppen: [] });
      });
    return () => {
      abgebrochen = true;
    };
  }, [offen, daten]);

  /** Position gegen das Sichtfenster, VOR dem Anstrich.
   *
   *  Nach oben, wenn unten kein Platz ist — und im angedockten Fenster ist
   *  unten per Konstruktion keiner: das Fenster steht am unteren Rand und die
   *  Sendezeile ist seine unterste Zeile. Waagerecht geklemmt, damit nichts
   *  über den rechten Rand läuft. */
  useLayoutEffect(() => {
    if (!offen) return;

    function rechne() {
      const schalter = schalterRef.current;
      if (!schalter) return;
      const r = schalter.getBoundingClientRect();
      const platzUnten = window.innerHeight - r.bottom;
      const top = platzUnten < HOEHE + ABSTAND ? r.top - HOEHE - ABSTAND : r.bottom + ABSTAND;
      const left = Math.min(
        Math.max(ABSTAND, r.right - BREITE),
        window.innerWidth - BREITE - ABSTAND,
      );
      setPos({ top: Math.max(ABSTAND, top), left: Math.max(ABSTAND, left) });
    }

    rechne();
    // Mitlaufen statt einfrieren: ein Overlay, das beim Scrollen neben seinem
    // Schalter stehen bleibt, ist schlimmer als eines, das schliesst.
    window.addEventListener("scroll", rechne, true);
    window.addEventListener("resize", rechne);
    return () => {
      window.removeEventListener("scroll", rechne, true);
      window.removeEventListener("resize", rechne);
    };
  }, [offen]);

  // Beim Öffnen liegt der Fokus im Suchfeld — von dort führen die Pfeiltasten
  // ins Raster.
  //
  // Zwei Fallen, beide vom Test gefunden. ERSTENS reicht `[offen]` als
  // Abhängigkeit nicht: wenn `offen` umspringt, ist `pos` noch `null` und das
  // Overlay steht gar nicht im Baum — `sucheRef` ist leer, der Fokus bleibt am
  // `body`. ZWEITENS wäre `[offen, pos]` allein zu viel: `pos` ändert sich bei
  // jedem Scrollen, und der Fokus spränge dem Mitglied aus dem Raster zurück
  // ins Suchfeld. Deshalb der Merker — einmal je Öffnung.
  const fokusGesetztRef = useRef(false);
  useEffect(() => {
    if (!offen) {
      fokusGesetztRef.current = false;
      return;
    }
    if (pos && !fokusGesetztRef.current) {
      sucheRef.current?.focus();
      fokusGesetztRef.current = true;
    }
  }, [offen, pos]);

  // Klick daneben schliesst. `mousedown` und nicht `click`, damit ein Klick ins
  // Eingabefeld dort auch den Cursor setzt.
  useEffect(() => {
    if (!offen) return;
    function aufKlick(e: MouseEvent) {
      const ziel = e.target as Node;
      if (overlayRef.current?.contains(ziel) || schalterRef.current?.contains(ziel)) return;
      schliesse();
    }
    document.addEventListener("mousedown", aufKlick);
    return () => document.removeEventListener("mousedown", aufKlick);
  });

  function schliesse() {
    setOffen(false);
    setSuche("");
    onSchliessen();
  }

  function waehle(emoji: string) {
    setOffen(false);
    setSuche("");
    onWaehle(emoji);
  }

  const treffer = daten ? filtereEmoji(daten.emoji, suche) : [];
  const sucht = suche.trim().length > 0;

  /** Bewegt den Fokus im Raster. `-1` heisst: zurück ins Suchfeld. */
  function fokussiere(index: number) {
    if (index < 0) {
      sucheRef.current?.focus();
      return;
    }
    felderRef.current[Math.min(index, treffer.length - 1)]?.focus();
  }

  function aufTasteImRaster(e: React.KeyboardEvent, index: number) {
    const schritt =
      e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowLeft"
          ? -1
          : e.key === "ArrowDown"
            ? SPALTEN
            : e.key === "ArrowUp"
              ? -SPALTEN
              : 0;
    if (schritt === 0) return;
    e.preventDefault();
    fokussiere(index + schritt);
  }

  let laufenderIndex = -1;
  felderRef.current = [];

  return (
    <>
      <button
        ref={schalterRef}
        type="button"
        // `absolute` im `relative` Wrapper der Eingabe: kostet Innenabstand
        // statt Zeilenbreite.
        className={cn(
          "absolute bottom-2 right-2 rounded p-0.5 text-base leading-none text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent",
          imFenster && "bottom-1.5 right-1.5 text-sm",
        )}
        aria-label="Emoji auswählen"
        aria-expanded={offen}
        aria-haspopup="dialog"
        onClick={() => (offen ? schliesse() : setOffen(true))}
      >
        <span aria-hidden="true">🙂</span>
      </button>

      {offen &&
        pos &&
        createPortal(
          <div
            ref={overlayRef}
            role="dialog"
            aria-label="Emoji auswählen"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: BREITE,
              height: HOEHE,
            }}
            className="z-50 flex flex-col overflow-hidden rounded-lg border border-line bg-canvas shadow-lg"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                schliesse();
              }
            }}
          >
            <input
              ref={sucheRef}
              type="search"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  fokussiere(0);
                }
              }}
              placeholder="Suchen…"
              aria-label="Emoji suchen"
              className="m-2 rounded border border-line bg-soft px-2 py-1 text-sm text-ink focus-visible:border-accent focus-visible:outline-none"
            />

            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {!daten && <p className="p-4 text-center text-sm text-muted">Wird geladen…</p>}
              {daten && treffer.length === 0 && (
                <p className="p-4 text-center text-sm text-muted">
                  {daten.emoji.length === 0
                    ? "Die Emoji-Liste konnte nicht geladen werden."
                    : "Nichts gefunden."}
                </p>
              )}

              {/* Beim Suchen ein flaches Raster, sonst nach Gruppen mit
                  deutschen Überschriften. Der Tastatur-Index läuft in BEIDEN
                  Fällen über dieselbe flache Trefferliste. */}
              {daten && treffer.length > 0 && sucht && (
                <div role="grid" aria-label="Suchergebnisse" className="grid grid-cols-8 gap-0.5">
                  {treffer.map(([emoji, name]) => {
                    const index = ++laufenderIndex;
                    return (
                      <Feld
                        key={emoji}
                        emoji={emoji}
                        name={name}
                        refCb={(el) => (felderRef.current[index] = el)}
                        onWaehle={() => waehle(emoji)}
                        onTaste={(e) => aufTasteImRaster(e, index)}
                      />
                    );
                  })}
                </div>
              )}

              {daten &&
                !sucht &&
                daten.gruppen.map(([nummer, titel]) => {
                  const inGruppe = treffer.filter(([, , , g]) => g === nummer);
                  if (inGruppe.length === 0) return null;
                  return (
                    <section key={nummer}>
                      <h3 className="px-1 pb-1 pt-2 text-xs font-semibold text-muted">{titel}</h3>
                      <div role="grid" aria-label={titel} className="grid grid-cols-8 gap-0.5">
                        {inGruppe.map(([emoji, name]) => {
                          const index = ++laufenderIndex;
                          return (
                            <Feld
                              key={emoji}
                              emoji={emoji}
                              name={name}
                              refCb={(el) => (felderRef.current[index] = el)}
                              onWaehle={() => waehle(emoji)}
                              onTaste={(e) => aufTasteImRaster(e, index)}
                            />
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Ein Feld im Raster. Der zugängliche Name ist der DEUTSCHE Name — ohne ihn
 *  meldete eine Schaltfläche nur ihr eigenes Zeichen. */
function Feld({
  emoji,
  name,
  refCb,
  onWaehle,
  onTaste,
}: {
  emoji: string;
  name: string;
  refCb: (el: HTMLButtonElement | null) => void;
  onWaehle: () => void;
  onTaste: (e: React.KeyboardEvent) => void;
}) {
  return (
    <button
      ref={refCb}
      type="button"
      aria-label={name}
      onClick={onWaehle}
      onKeyDown={onTaste}
      className="rounded p-1 text-lg leading-none hover:bg-soft focus-visible:bg-soft focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span aria-hidden="true">{emoji}</span>
    </button>
  );
}
