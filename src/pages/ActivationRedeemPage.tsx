import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/ui/Logo";
import {
  leseTokenAusFragment,
  redeemActivation,
  requestActivationLink,
  type RedeemStatus,
} from "../lib/activation";
import { useAuth } from "../providers/auth-context";

/** Muss zu `minimum_password_length` (config.toml) und `MIN_PASSWORT` der Function passen. */
const MIN_PASSWORT = 10;

/**
 * `/aktivierung` — Token einlösen und eigenes Passwort setzen (AGE-495 / C3).
 *
 * Läuft außerhalb der AppShell (wie `/login`) und **ohne** RequireAuth: Das
 * Token trägt die Identität, nicht die Sitzung. Genau deshalb funktioniert der
 * Link auch in einem anderen Browser — einer der sieben Fälle aus §6.
 *
 * Ohne Token im Fragment zeigt die Seite das Formular „Link anfordern". Das ist
 * der Weg für ein Mitglied, dessen verteiltes Passwort ein Dritter geändert hat:
 * Es käme sonst an der Anmeldung nicht vorbei und nie an einen neuen Link.
 */
export default function ActivationRedeemPage() {
  const navigate = useNavigate();
  const { user, isActivated, signOut } = useAuth();
  // Nur einmal lesen: `leseTokenAusFragment` räumt die Adresszeile auf, ein
  // zweiter Aufruf fände nichts mehr.
  const [token] = useState<string | null>(() => leseTokenAusFragment());

  const [passwort, setPasswort] = useState("");
  const [status, setStatus] = useState<RedeemStatus | null>(null);
  const [läuft, setLäuft] = useState(false);
  const [adresse, setAdresse] = useState("");
  const [angefordert, setAngefordert] = useState(false);

  // Fall 3 aus §6: Konto schon aktiviert, alter Link im Postfach. Weiterleitung
  // auf die Startseite, ausdrücklich OHNE Fehlermeldung — das Mitglied hat
  // nichts falsch gemacht.
  //
  // Das `user &&` ist nicht dekorativ: für einen AUSGELOGGTEN Besucher ist
  // `isActivated` true (es gibt nichts zu aktivieren). Ohne die Bedingung
  // landete er auf der Startseite — und damit wäre ausgerechnet der Weg tot,
  // auf dem die ganze Konstruktion ruht: das Formular „Link anfordern" ist der
  // einzige Zugang für ein Mitglied, dessen verteiltes Passwort ein Dritter
  // geändert hat. Beim Betrachten der laufenden Oberfläche aufgefallen, nicht
  // im Test — die Fixtures hatten immer einen Nutzer.
  useEffect(() => {
    if (!token && user && isActivated === true) navigate("/", { replace: true });
  }, [token, user, isActivated, navigate]);

  async function einlösen(e: React.FormEvent) {
    e.preventDefault();
    if (!token || läuft) return;
    if (passwort.length < MIN_PASSWORT) {
      setStatus("weak_password");
      return;
    }
    setLäuft(true);
    const ergebnis = await redeemActivation(token, passwort);
    setStatus(ergebnis);
    setLäuft(false);
    if (ergebnis === "activated") {
      // Das Passwort ist neu und alle Sitzungen sind widerrufen — auch die
      // eigene. Also sauber zum Login, statt eine tote Session weiterzutragen.
      await signOut();
      navigate("/login", { replace: true });
    }
  }

  async function neuenLinkAnfordern(e: React.FormEvent) {
    e.preventDefault();
    if (!adresse.includes("@") || läuft) return;
    setLäuft(true);
    try {
      await requestActivationLink(adresse);
    } finally {
      setAngefordert(true);
      setLäuft(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="fbc-hero overflow-hidden rounded-[var(--radius-card)] border border-accent/25 px-6 py-8 text-center shadow-soft">
        <div className="flex justify-center">
          <Logo lockup="full" />
        </div>
      </div>

      {token && status !== "activated" ? (
        <>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              Passwort festlegen
            </h1>
            <p className="mt-2 text-sm text-muted">
              Wähle ein eigenes Passwort mit mindestens {MIN_PASSWORT} Zeichen. Danach ist dein
              Zugang fertig.
            </p>
          </div>

          <form onSubmit={einlösen} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1">
              <label htmlFor="passwort" className="text-sm font-medium text-ink">
                Neues Passwort
              </label>
              <input
                id="passwort"
                type="password"
                autoComplete="new-password"
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
                className="h-11 rounded-md border border-line bg-canvas px-3 text-sm text-ink transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              {status === "weak_password" && (
                <p className="text-sm text-danger">
                  Das Passwort braucht mindestens {MIN_PASSWORT} Zeichen.
                </p>
              )}
            </div>

            <StatusMeldung status={status} />

            <Button type="submit" variant="primary" disabled={läuft}>
              Zugang freischalten
            </Button>
          </form>

          {/* Für „abgelaufen", „überholt" und „unbekannt" braucht es einen Weg
              nach vorn, nicht nur eine Meldung. */}
          {(status === "expired" ||
            status === "superseded" ||
            status === "not_found" ||
            status === "retry_needed" ||
            status === "throttled") && (
            <LinkAnfordern
              adresse={adresse}
              setAdresse={setAdresse}
              angefordert={angefordert}
              läuft={läuft}
              onSubmit={neuenLinkAnfordern}
            />
          )}
        </>
      ) : (
        <>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              Bestätigungslink anfordern
            </h1>
            <p className="mt-2 text-sm text-muted">
              Gib die E-Mail-Adresse ein, unter der du im Club bekannt bist. Wir schicken dir einen
              neuen Link.
            </p>
          </div>
          <LinkAnfordern
            adresse={adresse}
            setAdresse={setAdresse}
            angefordert={angefordert}
            läuft={läuft}
            onSubmit={neuenLinkAnfordern}
          />
        </>
      )}

      <Link to="/login" className="mt-2 block text-sm text-muted hover:underline">
        ← Zur Anmeldung
      </Link>
    </main>
  );
}

/**
 * Je Fall eine eigene Meldung — AGE-495 §6 verlangt das ausdrücklich.
 *
 * Wichtig ist die Trennung von `used` und `superseded`: „schon benutzt" heißt,
 * das Konto IST aktiviert. „überholt" heißt, ein neuerer Link wurde angefordert
 * und dieser gilt nicht mehr — das Konto ist dann gerade NICHT aktiviert. Mit
 * einer gemeinsamen Meldung bekäme, wer zweimal anfordert und den ersten Link
 * klickt, eine schlicht falsche Auskunft.
 */
function StatusMeldung({ status }: { status: RedeemStatus | null }) {
  if (!status || status === "weak_password" || status === "activated") return null;

  const texte: Record<Exclude<RedeemStatus, "weak_password" | "activated">, string> = {
    expired: "Dieser Link ist abgelaufen — er gilt 72 Stunden. Fordere unten einen neuen an.",
    used: "Dieses Konto ist bereits aktiviert. Du kannst dich direkt anmelden.",
    superseded:
      "Dieser Link ist nicht mehr gültig, weil danach ein neuer angefordert wurde. " +
      "Nimm den neuesten Link aus deinem Postfach — oder fordere unten einen an.",
    not_found: "Dieser Link ist nicht mehr gültig. Fordere unten einen neuen an.",
    retry_needed:
      "Da ist etwas dazwischengekommen. Dein Passwort wurde möglicherweise schon gesetzt — " +
      "fordere bitte einen neuen Link an und versuch es noch einmal.",
    throttled:
      "Von deinem Anschluss kamen zu viele ungültige Versuche. Fordere unten einen neuen " +
      "Link an — ein gültiger Link greift sofort, auch jetzt.",
    error: "Das hat gerade nicht geklappt. Bitte versuche es noch einmal.",
  };

  return (
    <div className="rounded-md border border-line bg-canvas p-3 text-sm text-ink">
      <p>{texte[status]}</p>
      {status === "used" && (
        <Link to="/login" className="mt-2 inline-block text-accent-strong hover:underline">
          Jetzt anmelden
        </Link>
      )}
    </div>
  );
}

function LinkAnfordern({
  adresse,
  setAdresse,
  angefordert,
  läuft,
  onSubmit,
}: {
  adresse: string;
  setAdresse: (v: string) => void;
  angefordert: boolean;
  läuft: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  if (angefordert) {
    return (
      <p className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
        Wenn es zu dieser Adresse ein Konto gibt, ist der Link unterwegs. Er gilt 72 Stunden; schau
        bitte auch im Spam-Ordner nach.
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <label htmlFor="adresse" className="text-sm font-medium text-ink">
        E-Mail-Adresse
      </label>
      <input
        id="adresse"
        type="email"
        autoComplete="email"
        value={adresse}
        onChange={(e) => setAdresse(e.target.value)}
        className="h-11 rounded-md border border-line bg-canvas px-3 text-sm text-ink transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      <Button type="submit" variant="secondary" disabled={läuft}>
        Neuen Link senden
      </Button>
    </form>
  );
}
