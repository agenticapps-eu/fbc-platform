import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/ui/Logo";
import { resendActivationLink, type ResendStatus } from "../lib/activation";
import { useAuth } from "../providers/auth-context";

/** Sperrfrist in Sekunden — spiegelt die Ratengrenze in `issue_activation_token`. */
const SPERRE = 60;

/**
 * Was der Bildschirm zu jedem Ausgang sagt (AGE-526).
 *
 * Jeder Ausgang außer `issued` heißt: es wurde nichts versendet. Keiner von
 * ihnen darf deshalb wie ein Versand aussehen — und sie dürfen auch nicht
 * untereinander verschwimmen. „Warte kurz" und „versuch es nochmal" sind
 * verschiedene Auskünfte; wer sie zusammenwirft, schickt ein Mitglied ins
 * Warten auf eine Mail, die niemand mehr abschickt.
 *
 * Keine dieser Meldungen nennt Sekunden, die der Server nicht mitgeliefert hat:
 * Die Antwort trägt nur einen Status, und nach einem Neuladen weiß der Browser
 * über eine laufende Sperrfrist nichts.
 */
const MELDUNGEN: Record<ResendStatus, string> = {
  issued: "",
  // Sagt bewusst NICHT „der Link ist unterwegs" und schickt niemanden ins
  // Postfach: Schlug der Versand eben fehl, liegt dort nichts, und die
  // Sperrfrist zählt trotzdem — sie hängt am Zeitpunkt der Anforderung, nicht
  // am Versandergebnis. Wer hier ein Postfach verspricht, wiederholt den
  // Fehler, gegen den dieser Change gebaut ist (Befund aus dem Diff-Review).
  rate_limited:
    "Gerade eben wurde schon ein Link angefordert. Bitte warte einen Moment, " +
    "bevor du es noch einmal versuchst.",
  rate_limited_day:
    "Für heute wurden schon mehrere Links an dein Konto geschickt. Bitte sieh im Postfach und im " +
    "Spam-Ordner nach; morgen kannst du wieder einen neuen anfordern.",
  rate_limited_global:
    "Bei uns melden sich gerade sehr viele Menschen gleichzeitig an. Dein Konto ist angelegt — " +
    "bitte versuche es in etwa zehn Minuten noch einmal.",
  already_activated: "Dein Zugang ist bereits bestätigt. Du kannst dich anmelden.",
  unknown: "Der Versand hat gerade nicht geklappt. Bitte versuche es noch einmal.",
  send_failed: "Der Versand hat gerade nicht geklappt. Bitte versuche es noch einmal.",
  error: "Der Versand hat gerade nicht geklappt. Bitte versuche es noch einmal.",
};

/**
 * Der Aktivierungsbildschirm (AGE-495 / C3).
 *
 * Was ein eingeloggtes, noch unbestätigtes Konto sieht — statt jeder Route.
 * Er erklärt in zwei Sätzen, was fehlt, und bietet genau eine Handlung an.
 */
export default function ActivationScreen() {
  const { user, activationName, signOut, activationMailStatus } = useAuth();
  // Ergebnis eines Versands, den DIESER Bildschirm ausgelöst hat. Solange es
  // keines gibt, gilt das der Registrierung (AGE-526).
  const [eigeneLage, setEigeneLage] = useState<ResendStatus | null>(null);
  const [läuft, setLäuft] = useState(false);
  const [restSek, setRestSek] = useState(0);

  // ABGELEITET, nicht als Anfangswert kopiert. Der automatische Versand läuft
  // NACH der Registrierung, die Weiterleitung hierher passiert aber schon,
  // sobald die Sitzung steht — der Status trifft also ein, wenn dieser
  // Bildschirm längst gerendert ist. Ein `useState(activationMailStatus)`
  // nimmt genau diesen späteren Wert nie an; im Browser stand dann der Knopf
  // da, als wäre nie etwas versendet worden (Sichtprobe vom 2026-08-10).
  const lage = eigeneLage ?? activationMailStatus;

  // Die Sperrfrist beginnt, wenn der automatische Versand griff — auch dann,
  // wenn das erst nach dem Rendern feststeht. Angepasst WÄHREND des Renderns
  // statt in einem Effect: React verwirft den Zwischenstand und rendert direkt
  // neu, statt erst zu zeichnen und dann eine zweite Runde anzustoßen. `useEffect`
  // dafür ist der Fall, vor dem `react-hooks/set-state-in-effect` warnt.
  const [gesehenerVersand, setGesehenerVersand] = useState<ResendStatus | null>(null);
  if (gesehenerVersand !== activationMailStatus) {
    setGesehenerVersand(activationMailStatus);
    if (activationMailStatus === "issued") setRestSek(SPERRE);
  }

  useEffect(() => {
    if (restSek <= 0) return;
    const t = setTimeout(() => setRestSek((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [restSek]);

  async function senden() {
    if (!user?.email || läuft || restSek > 0) return;
    setLäuft(true);
    try {
      // Ohne Adresse: das Subjekt ist die Sitzung. Über den adressbasierten Weg
      // konnte ein Fremder, der die Login-Adresse kannte, den ausstehenden Link
      // entwerten und das Mitglied aussperren (Audit vom 2026-08-06).
      //
      // Der Status wird ausgewertet, nicht verworfen (AGE-526): Die Function
      // antwortet auf jede Abweisung mit 200 und dem Grund im Rumpf. Wer daraus
      // Erfolg liest, meldet grün „unterwegs", während nichts versendet wurde —
      // und genau das ist seit dem automatischen Versand der wahrscheinlichste
      // Ausgang, weil der die Sperrfrist sofort verbraucht.
      const status = await resendActivationLink();
      setEigeneLage(status);
      if (status === "issued") setRestSek(SPERRE);
    } catch {
      // Nur ein echter Transportfehler landet hier; alles Fachliche kommt als
      // Status zurück.
      setEigeneLage("error");
    } finally {
      setLäuft(false);
    }
  }

  // Fallback statt `undefined`: Der Status kommt vom Server, und ein künftiger
  // neuer Wert liefe sonst in eine Lücke — Klick ohne jede Rückmeldung.
  const meldung = lage ? (MELDUNGEN[lage] ?? MELDUNGEN.error) : null;

  const anrede = activationName?.trim() ? `Hallo ${activationName.trim()},` : "Hallo,";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="fbc-hero overflow-hidden rounded-[var(--radius-card)] border border-accent/25 px-6 py-8 text-center shadow-soft">
        <div className="flex justify-center">
          <Logo lockup="full" />
        </div>
        <p className="mt-4 text-sm font-medium tracking-wide text-[var(--hero-muted)]">
          Gemeinsam erfolgreich · verbinden, wachsen, vertrauen
        </p>
      </div>

      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Noch ein Schritt
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {anrede} dein Profil ist angelegt. Damit niemand außer dir darauf zugreifen kann,
          bestätige bitte deine E-Mail-Adresse und vergib dein eigenes Passwort.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Wir schicken dir einen Link an{" "}
          <strong className="text-ink">{user?.email ?? "deine Adresse"}</strong>. Erst danach sind
          dein Profil und der Club für dich sichtbar — und deins für die anderen.
        </p>
      </div>

      {lage === "issued" && (
        <p className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
          Der Link ist unterwegs. Er gilt 72 Stunden. Schau bitte auch im Spam-Ordner nach —
          Absender ist <strong>noreply@effbeezee.com</strong> — antworten kannst du auf die Mail,
          sie landet bei uns.
        </p>
      )}
      {meldung && lage !== "issued" && <p className="text-sm text-danger">{meldung}</p>}

      <Button type="button" variant="primary" onClick={senden} disabled={läuft || restSek > 0}>
        {restSek > 0
          ? `Erneut senden in ${restSek} s`
          : lage === "issued"
            ? "Link erneut senden"
            : "Bestätigungslink senden"}
      </Button>

      <div className="text-sm text-muted">
        <p>
          Stimmt die Adresse nicht mehr? Schreib uns an{" "}
          <a className="text-accent-strong hover:underline" href="mailto:info@fairbusinessclub.de">
            info@fairbusinessclub.de
          </a>{" "}
          — wir ändern sie für dich.
        </p>
        {/* Ohne diesen Hinweis liest sich der leere Bildschirm wie ein Fehler:
            ausgeloggt sieht man das öffentliche Schaufenster, eingeloggt-aber-
            unbestätigt nicht. Das ist eine Entscheidung, kein Defekt. */}
        <p className="mt-3">
          Du willst dich erst umsehen? Öffentliche Beiträge und Veranstaltungen sind auch ohne
          Anmeldung sichtbar —{" "}
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-accent-strong hover:underline"
          >
            abmelden und weiterstöbern
          </button>
          .
        </p>
      </div>
    </main>
  );
}
