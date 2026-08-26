import { zodResolver } from "@hookform/resolvers/zod";
import type { AuthError } from "@supabase/supabase-js";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/ui/Logo";
import RechtsLinks from "../components/RechtsLinks";
import { useAuth } from "../providers/auth-context";

const schema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben."),
  // Im Schema optional, seit AGE-527 aus DEMSELBEN Grund wie der Name darunter:
  // Der Registrierungsmodus rendert gar kein Passwortfeld mehr — das Passwort
  // entsteht erst beim Einlösen des Bestätigungslinks. Die Pflicht für den
  // Login-Modus steht in `onSubmit`.
  //
  // Ein Schema, das `password` weiterhin für BEIDE Modi verlangt, wäre der
  // Fehler, den der Plan-Review vorhergesagt hat: Der Knopf täte wortlos
  // nichts, weil die Prüfung an einem Feld scheitert, das niemand sieht.
  password: z.string().optional(),
  // Im Schema optional, weil der Login-Modus gar kein Namensfeld rendert; beim
  // Registrieren wird die Pflicht in onSubmit durchgesetzt (AGE-437). `.trim()`
  // sonst zählt ein Leerzeichen als Name und steht so im Verzeichnis.
  name: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

type Mode = "login" | "register";

/**
 * Sagt der Anmeldedienst „diese Adresse gibt es schon"?
 *
 * Am `code` festgemacht und nicht am Text: Der Text ist englisch, kommt vom
 * Server und kann sich mit jeder Version ändern — eine Prüfung darauf wäre
 * genau die Art Zusage, die still ausfällt. `AuthError.code` ist seit
 * auth-js 2.x typisiert (`ErrorCode`) und für diesen Fall
 * `user_already_exists`.
 */
function istBereitsRegistriert(error: AuthError): boolean {
  return error.code === "user_already_exists";
}

/**
 * Der Hinweis für den dritten Ausgang der Registrierung (AGE-591).
 *
 * Er nennt KEINEN Grund. Nicht aus Zurückhaltung, sondern weil die Seite ihn
 * nicht kennt: GoTrue antwortet auf eine Registrierung mit einer bereits
 * bekannten Adresse mit 200 ohne Fehler und ohne Sitzung, und dieser
 * Aufzählungsschutz ist richtig so — die Oberfläche fragt nicht nach dem Grund
 * und behauptet keinen.
 *
 * Der erste Weg ist der ZUGANGSLINK und nicht „Passwort zurücksetzen". Wer hier
 * landet, ist ganz überwiegend ein importiertes, noch nicht aktiviertes Mitglied,
 * das den naheliegenden Knopf „Registrieren" statt „Aktivieren" gedrückt hat —
 * 70 von 73 Konten. Ein Passwort, das sich zurücksetzen ließe, hat es gar nicht.
 * `/aktivierung` zeigt ohne Token genau das richtige Formular.
 */
function RegistrierungOhneSitzung({ onZumLogin }: { onZumLogin: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-accent/30 bg-accent-soft p-4"
    >
      <p className="text-sm font-medium text-ink">Wir konnten dich nicht direkt anmelden.</p>
      <p className="text-sm text-muted">
        Wenn du schon Mitglied bist — auch, wenn du dich hier noch nie angemeldet hast —, führt dich
        dein Zugangslink hinein. Wir schicken ihn dir per E-Mail.
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <Link to="/aktivierung">
          <Button variant="primary" size="sm">
            Zugangslink anfordern
          </Button>
        </Link>
        <button
          type="button"
          onClick={onZumLogin}
          className="text-sm font-medium text-accent-strong hover:underline"
        >
          Mit Passwort anmelden
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { user, isLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [formError, setFormError] = useState<string | null>(null);
  // AGE-591: der dritte Ausgang der Registrierung — kein Fehler, keine Sitzung.
  // Bewusst ein eigener Zustand und nicht `formError`: Das ist kein Fehler, es
  // ist ein Weg, der woanders weitergeht, und er sieht auch nicht so aus.
  const [ohneSitzung, setOhneSitzung] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Bereits eingeloggt → kein Grund für die Login-Seite. „/" zeigt seit AGE-494
  // ausnahmslos die Startseite; der Erstlogin wird nicht mehr in den
  // Kompass-Assistenten umgeleitet (HomeRedirect).
  if (!isLoading && user) return <Navigate to="/" replace />;

  async function onSubmit(values: FormValues) {
    setFormError(null);
    // Ein stehengebliebener Hinweis über einem neuen Versuch behauptet etwas
    // über einen Vorgang, der längst ein anderer ist.
    setOhneSitzung(false);

    if (mode === "login") {
      // Beim ANMELDEN nur auf „leer" prüfen, nicht auf Länge (Befund aus dem
      // Diff-Review zu AGE-527). Die Zehn aus `minimum_password_length` gilt
      // beim SETZEN eines Passworts — der Anmeldedienst prüft sie beim Anmelden
      // nicht. Ein Konto aus der Zeit vor C4 mit acht Zeichen käme serverseitig
      // durch, würde hier aber vom eigenen Formular ausgesperrt. Die
      // Längenregel steht auf der Einlöseseite, wo ein NEUES Passwort entsteht.
      if (!values.password) {
        setError("password", { message: "Bitte dein Passwort eingeben." });
        return;
      }
      const { error } = await signIn(values.email, values.password);
      if (error) {
        setFormError(error.message);
        return;
      }
      navigate("/", { replace: true });
      return;
    }

    // Ohne Namen bliebe profiles.name NULL und das Mitglied im Verzeichnis
    // dauerhaft „Mitglied" (AGE-437) — deshalb hier Pflicht, nicht Kür.
    if (!values.name) {
      setError("name", { message: "Bitte deinen Namen eingeben." });
      return;
    }

    const { error, hatSession } = await signUp(values.email, values.name);
    if (error && !istBereitsRegistriert(error)) {
      setFormError(error.message);
      return;
    }
    // ZWEI Wege enden hier, und welcher es ist, hängt an einer Einstellung des
    // Anmeldedienstes (AGE-591):
    //
    //  - `user_already_exists` (HTTP 422), solange die eingebaute
    //    E-Mail-Bestätigung AUS ist. Das ist der Stand auf PROD seit dem 25.08.,
    //    und der Grund, warum hier nicht `error.message` steht: Der rohe Satz
    //    lautet „User already registered" — englisch, führt nirgendwohin, und er
    //    verrät geradeheraus, dass die Adresse vergeben ist.
    //  - kein Fehler und keine Sitzung, solange die Bestätigung AN ist. Dann
    //    greift GoTrues Aufzählungsschutz, der genau diese Aussage vermeidet.
    //    So stand PROD zwischen dem 16. und dem 25.08. — daher die stumme Seite,
    //    die dieses Issue ausgelöst hat.
    //
    // Beide bekommen denselben neutralen Hinweis. Die Seite nennt keinen Grund;
    // im zweiten Fall kennt sie ihn nicht einmal, und im ersten geht er
    // niemanden etwas an, der nur wissen will, wie er hineinkommt.
    if (error || !hatSession) {
      setOhneSitzung(true);
      return;
    }
    // Hier stand ein Hinweis „Registrierung erfolgreich …". Er ist mit AGE-526
    // entfallen, und zwar nicht wegen seines Textes, sondern weil er nie zu
    // sehen war: Die eingebaute Bestätigung ist aus (AGE-445), `supabase.auth
    // .signUp` meldet die Sitzung an den Auth-Zuhörer, BEVOR es auflöst — der
    // Navigate-Guard oben hat diese Seite dann längst abgeräumt. Der Hinweis
    // wäre ein setState auf eine ausgehängte Komponente gewesen, und der Test
    // darauf bestand nur, weil die Attrappe keine Sitzung herstellt.
    //
    // Die Fortsetzung ist der Aktivierungsbildschirm. Er kennt den
    // Versandstatus und sagt ihn wahrheitsgemäß; diese Seite kennt ihn nicht.
    // Befund aus dem Diff-Review vom 2026-08-10.
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      {/* Variant-bewusster Hero: dark-glow-Panel (b/d) bzw. heller Hero (a/c),
          Shimmer-Sweep, Marken-Logo. */}
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
          {mode === "login" ? "Login" : "Registrieren"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {mode === "login"
            ? "Mit E-Mail und Passwort anmelden."
            : "Neues Konto erstellen — du startest mit Stufe „Basic“ und kannst jederzeit upgraden."}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {mode === "register" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-medium text-ink">
              Name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              {...register("name")}
              className="h-11 rounded-md border border-line bg-canvas px-3 text-sm text-ink transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            {errors.name && <p className="text-sm text-danger">{errors.name.message}</p>}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium text-ink">
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
            className="h-11 rounded-md border border-line bg-canvas px-3 text-sm text-ink transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          {errors.email && <p className="text-sm text-danger">{errors.email.message}</p>}
        </div>

        {/* Nur im Login-Modus. Beim Registrieren wird kein Passwort mehr
            erhoben (AGE-527) — es entsteht beim Einlösen des
            Bestätigungslinks, und zwar genau einmal. */}
        {mode === "login" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-ink">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              {...register("password")}
              className="h-11 rounded-md border border-line bg-canvas px-3 text-sm text-ink transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            {errors.password && <p className="text-sm text-danger">{errors.password.message}</p>}
            {/* AGE-505. Der Weg gehört genau hierhin: Wer sein Passwort vergessen
              hat, scheitert an DIESEM Feld und sucht ihn nirgendwo sonst. Die
              frühere Bedingung `mode === "login"` steht seit AGE-527 eine Ebene
              höher am ganzen Feld — im Registrierungsmodus gibt es weder das
              eine noch das andere. */}
            <Link
              to="/passwort-vergessen"
              className="self-start text-sm text-muted hover:underline"
            >
              Passwort vergessen?
            </Link>
          </div>
        )}

        {ohneSitzung && (
          <RegistrierungOhneSitzung
            onZumLogin={() => {
              setMode("login");
              // Den Hinweis MIT wegräumen. Ohne diese Zeile stand er über dem
              // Login-Formular weiter da und behauptete etwas über einen
              // Vorgang, den es nicht mehr gibt — derselbe Fehlermodus, gegen
              // den diese Fläche gebaut ist. Befund des Diff-Reviews.
              setOhneSitzung(false);
            }}
          />
        )}

        {formError && <p className="text-sm text-danger">{formError}</p>}

        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {mode === "login" ? "Anmelden" : "Konto erstellen"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "login" ? "register" : "login"));
          setFormError(null);
          setOhneSitzung(false);
        }}
        className="mt-4 text-sm font-medium text-accent-strong hover:underline"
      >
        {mode === "login" ? "Noch kein Konto? Registrieren" : "Schon ein Konto? Zum Login"}
      </button>

      <Link to="/" className="mt-4 block text-sm text-muted hover:underline">
        ← Zurück zur Startseite
      </Link>

      {/* AGE-497: Hier wird ein Vertrag geschlossen und eine E-Mail-Adresse
          erhoben. § 312i BGB verlangt die AGB bei Vertragsschluss, Art. 13
          DSGVO die Information bei Erhebung — beides an dieser Stelle, nicht
          im Footer einer Seite, die ein frisch registriertes Konto nie sieht. */}
      <RechtsLinks className="mt-6 border-t border-line pt-4" />
    </main>
  );
}
