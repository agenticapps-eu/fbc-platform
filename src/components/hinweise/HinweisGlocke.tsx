import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Hinweis } from "../../lib/hinweise";
import { Icon } from "../ui/icons";

/**
 * Die Benachrichtigungs-Glocke (AGE-620).
 *
 * **Anders als die Sprechblase daneben.** Der Nachrichten-Einstieg bleibt sichtbar,
 * auch wenn nichts ungelesen ist — er ist ein ORT, den man wiederfinden muss, und
 * genau seine Unauffindbarkeit war der Befund von AGE-583. Die Glocke ist kein Ort,
 * sondern ein Panel: bei null zeigt sie keine Zahl. Eine „0" waere eine Zahl, die
 * nichts meldet.
 *
 * **Auf/Zu wie das Profilmenue in derselben Kopfzeile** — `mousedown` ausserhalb
 * plus Escape, `absolute` in einem `relative`-Container. Bewusst KEIN Portal und
 * kein `fixed`: die Falle, die ein `fixed`-Overlay in `.fbc-card:hover`
 * (transform) und im `<header>` (backdrop-blur) einfaengt, greift bei einem
 * `absolute` Panel gar nicht. Und bewusst kein `focusout`: jsdom bewegt beim Klick
 * den Fokus nicht, ein solcher Umschalter waere im Test gruen und im Browser kaputt.
 */
export function HinweisGlocke({
  hinweise,
  unbekannt,
  onMarkiere,
  onAlle,
}: {
  hinweise: Hinweis[];
  unbekannt: boolean;
  onMarkiere: (id: string) => void;
  onAlle: () => void;
}) {
  const [offen, setOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    const aufDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOffen(false);
    };
    const aufTaste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(false);
    };
    document.addEventListener("mousedown", aufDoc);
    document.addEventListener("keydown", aufTaste);
    return () => {
      document.removeEventListener("mousedown", aufDoc);
      document.removeEventListener("keydown", aufTaste);
    };
  }, [offen]);

  const anzahl = hinweise.length;
  const name = unbekannt
    ? "Benachrichtigungen — Anzahl konnte nicht geladen werden"
    : anzahl > 0
      ? `Benachrichtigungen, ${anzahl} ungelesen`
      : "Benachrichtigungen";
  const blase = unbekannt ? "!" : anzahl > 0 ? String(anzahl) : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-label={name}
        aria-haspopup="dialog"
        aria-expanded={offen}
        className="relative rounded-full p-2 text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Icon name="bell" className="h-5 w-5" />
        {blase !== null && (
          // `aria-hidden`, weil die Zahl schon im Namen des Knopfes steht —
          // sonst liest ein Screenreader sie zweimal.
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 min-w-[1.125rem] rounded-full bg-accent px-1 text-center text-[0.6875rem] font-semibold leading-[1.125rem] text-canvas"
          >
            {blase}
          </span>
        )}
      </button>

      {offen && (
        <div
          role="dialog"
          aria-label="Benachrichtigungen"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas shadow-soft"
        >
          {anzahl === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              Keine neuen Benachrichtigungen.
            </p>
          ) : (
            <>
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {hinweise.map((h) => (
                  <li key={h.id} className="flex items-start gap-2 px-4 py-3">
                    {/* Ein Ziel gibt es bisher NUR fuer `release_note`
                        (AGE-631), und das ist Absicht: die uebrigen sieben
                        Typen haben seit AGE-620 keines, und ihnen hier eines
                        anzudichten waere eine Aenderung an sieben Flaechen in
                        einem Change, der von einer handelt. Wer die anderen
                        verlinken will, tut das dort, wo er sie auch pruefen
                        kann. */}
                    {hinweisZiel(h) ? (
                      <Link
                        to={hinweisZiel(h)!}
                        onClick={() => setOffen(false)}
                        data-testid="hinweis-text"
                        className="flex-1 rounded-md text-sm text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {hinweisText(h)}
                      </Link>
                    ) : (
                      <p data-testid="hinweis-text" className="flex-1 text-sm text-ink">
                        {hinweisText(h)}
                      </p>
                    )}
                    {/* Ein Textknopf, kein Haken-Glyph: der Name `check` steht
                        nicht im Icon-Vorrat (48 Namen, gepruft), und ein
                        erfundener Name faellt in jsdom NICHT auf — `Icon`
                        rendert dann eine leere Zeichenflaeche. Gefangen hat es
                        der Typecheck, nicht der Test. */}
                    <button
                      type="button"
                      onClick={() => onMarkiere(h.id)}
                      aria-label={`${hinweisText(h)} — als gelesen markieren`}
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Gelesen
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line p-2">
                <button
                  type="button"
                  onClick={onAlle}
                  className="w-full rounded-md px-3 py-2 text-sm font-medium text-accent-strong transition-colors hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Alle als gelesen markieren
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Ein Satz je Typ. Die Nutzlast traegt seit AGE-620 Kennungen plus einen kurzen
 * Anzeigetext (Name, Titel) — aber keinen Beitragstext, und sie kann veraltet
 * sein, wenn der Gegenstand geloescht wurde. Jeder Zugriff faellt deshalb auf
 * einen Ersatz zurueck, statt „undefined" in die Liste zu schreiben.
 */
function hinweisText(h: Hinweis): string {
  const p = h.payload ?? {};
  const wer = text(p.from_name) ?? text(p.to_name) ?? text(p.autor_name) ?? "Ein Mitglied";
  // `titel` schreibt AGE-620, `title` schreibt AGE-631 — beide lesen, statt
  // eine der beiden Nutzlasten nachtraeglich umzubenennen.
  const titel = text(p.titel) ?? text(p.title);

  switch (h.type) {
    case "contact_request":
      return `${wer} möchte Sie kennenlernen.`;
    case "contact_request_accepted":
      return `${wer} hat Ihre Kontaktanfrage angenommen.`;
    case "contact_request_declined":
      return `${wer} hat Ihre Kontaktanfrage abgelehnt.`;
    case "member_joined":
      return `${wer} ist neu im Club.`;
    case "post_created":
      return `${wer} hat einen Beitrag geschrieben.`;
    case "event_created":
      return titel ? `Neues Event: ${titel}` : "Es gibt ein neues Event.";
    case "comment_on_post":
      return `${wer} hat Ihren Beitrag kommentiert.`;
    case "like_on_post":
      return `${wer} gefällt Ihr Beitrag.`;
    case "release_note":
      // Der Titel steht in der Nutzlast, weil die Note selbst geloescht sein
      // koennte — und weil ein Hinweis, der erst eine zweite Abfrage braucht,
      // um etwas zu sagen, in der Glocke leer stuende.
      return titel ? `Neu in der App: ${titel}` : "Es gibt Neues in der App.";
    default:
      // Kein Rohtyp in der Anzeige: `post_created_v2` waere fuer ein Mitglied
      // kein Satz, sondern ein Bezeichner aus unserer Datenbank.
      return "Es gibt etwas Neues.";
  }
}

/**
 * Wohin ein Hinweis fuehrt — oder `null`, wenn er nirgendwohin fuehrt.
 *
 * Heute kennt nur `release_note` ein Ziel. Die Funktion existiert trotzdem
 * getrennt vom Text: ein Ziel ist etwas anderes als ein Satz, und die naechste
 * Verlinkung soll eine Zeile hier sein und keine Umbauaktion an der Liste.
 */
function hinweisZiel(h: Hinweis): string | null {
  if (h.type !== "release_note") return null;
  // Mit Kennung öffnet die Fläche die gemeinte Note (AGE-632). Ohne — eine
  // alte Nutzlast trägt sie womöglich nicht — bleibt die blosse Liste das
  // Ziel: `?note=undefined` wäre eine Adresse, die nichts öffnet und trotzdem
  // aussieht, als sollte sie.
  const id = text(h.payload?.["release_note_id"]);
  return id ? `/neues?note=${encodeURIComponent(id)}` : "/neues";
}

function text(wert: unknown): string | null {
  return typeof wert === "string" && wert.trim() !== "" ? wert : null;
}
