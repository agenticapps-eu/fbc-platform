import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/ui/Logo";
import { requestActivationLink } from "../lib/activation";
import { useAuth } from "../providers/auth-context";

/** Sperrfrist in Sekunden — spiegelt die Ratengrenze in `issue_activation_token`. */
const SPERRE = 60;

/**
 * Der Aktivierungsbildschirm (AGE-495 / C3).
 *
 * Was ein eingeloggtes, noch unbestätigtes Konto sieht — statt jeder Route.
 * Er erklärt in zwei Sätzen, was fehlt, und bietet genau eine Handlung an.
 */
export default function ActivationScreen() {
  const { user, activationName, signOut } = useAuth();
  const [gesendet, setGesendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [läuft, setLäuft] = useState(false);
  const [restSek, setRestSek] = useState(0);

  useEffect(() => {
    if (restSek <= 0) return;
    const t = setTimeout(() => setRestSek((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [restSek]);

  async function senden() {
    if (!user?.email || läuft || restSek > 0) return;
    setLäuft(true);
    setFehler(null);
    try {
      await requestActivationLink(user.email);
      setGesendet(true);
      setRestSek(SPERRE);
    } catch {
      // Bewusst unspezifisch: die Function antwortet in jedem fachlichen Fall
      // gleich, damit sie nicht verrät, welche Adressen es gibt. Nur ein echter
      // Transportfehler landet hier.
      setFehler("Der Versand hat gerade nicht geklappt. Bitte versuche es noch einmal.");
    } finally {
      setLäuft(false);
    }
  }

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

      {gesendet && (
        <p className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
          Der Link ist unterwegs. Er gilt 72 Stunden. Schau bitte auch im Spam-Ordner nach —
          Absender ist <strong>info@fairbusinessclub.de</strong>.
        </p>
      )}
      {fehler && <p className="text-sm text-danger">{fehler}</p>}

      <Button type="button" variant="primary" onClick={senden} disabled={läuft || restSek > 0}>
        {restSek > 0
          ? `Erneut senden in ${restSek} s`
          : gesendet
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
