import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "./ui/icons";

/**
 * Der Rückweg am Kopf einer Rechtsseite (AGE-625).
 *
 * ══ WARUM ER OBEN STEHT ════════════════════════════════════════════════════
 * Der bisherige benannte Rückweg sitzt in der Fußzeile — bei den AGB hinter
 * 121 679 Zeichen. Am Kopf stand nur das Logo: ein Bild mit `aria-label`, das
 * niemand als „zurück" liest. Er bleibt unten stehen; dies ist der zweite,
 * nicht sein Ersatz.
 *
 * ══ WARUM ES ZWEI AUSGÄNGE SIND ════════════════════════════════════════════
 * `LegalPage.tsx` warnt seit AGE-497: ein blankes `history.back()` bricht beim
 * Direktaufruf aus einer E-Mail. Das stimmt — die Rechtsseiten liegen
 * ausserhalb der Shell und werden aus Mails heraus direkt geöffnet; dort führt
 * ein Sprung zurück aus der Anwendung hinaus, im Zweifel auf die vorige
 * fremde Seite.
 *
 * Ein fester Link auf `/` wiederum kostet jeden seinen Platz, der aus den
 * Einstellungen, vom Login oder vom Aktivierungsbildschirm kam — und das sind
 * die vier Einstiegspunkte, die es überhaupt gibt.
 *
 * Unterschieden wird an `location.key`: React Router vergibt dem ERSTEN
 * Eintrag einer Sitzung den Schlüssel `"default"`. Steht dort etwas anderes,
 * ist innerhalb der Anwendung navigiert worden, und erst dann gibt es ein
 * „zurück", das nicht ins Leere führt.
 *
 * ══ UND WARUM DIE AUFSCHRIFT WECHSELT ══════════════════════════════════════
 * Ein Knopf mit „Zurück", der in Wahrheit auf die Startseite springt, sagt die
 * Unwahrheit über das, was er tut. Beim Direktaufruf heisst er deshalb, wohin
 * er führt.
 */

const STIL =
  "-ml-1 mt-6 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm text-muted " +
  "transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent";

export default function LegalZurueck() {
  const navigate = useNavigate();
  const { key } = useLocation();

  // `"default"` heisst: dies ist der erste Eintrag dieser Sitzung, es gibt
  // innerhalb der Anwendung kein Zurück.
  if (key === "default") {
    return (
      <Link to="/" className={STIL}>
        <Icon name="chevronLeft" className="h-4 w-4 shrink-0" />
        Zurück zur Startseite
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => navigate(-1)} className={STIL}>
      <Icon name="chevronLeft" className="h-4 w-4 shrink-0" />
      Zurück
    </button>
  );
}
