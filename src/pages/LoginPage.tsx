import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/ui/Logo";
import { useAuth } from "../providers/auth-context";

const schema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben."),
  // Zehn, nicht acht: `minimum_password_length` in config.toml steht seit C4
  // auf 10. Mit acht nahm das Formular eine Eingabe an, die der Server ablehnt —
  // das Mitglied bekam einen Serverfehler statt einer Feldmeldung (AGE-495).
  password: z.string().min(10, "Das Passwort muss mindestens 10 Zeichen haben."),
  // Im Schema optional, weil der Login-Modus gar kein Namensfeld rendert; beim
  // Registrieren wird die Pflicht in onSubmit durchgesetzt (AGE-437). `.trim()`
  // sonst zählt ein Leerzeichen als Name und steht so im Verzeichnis.
  name: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

type Mode = "login" | "register";

export default function LoginPage() {
  const { user, isLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [formError, setFormError] = useState<string | null>(null);

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

    if (mode === "login") {
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

    const { error } = await signUp(values.email, values.password, values.name);
    if (error) {
      setFormError(error.message);
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
              hat, scheitert an DIESEM Feld und sucht ihn nirgendwo sonst. Im
              Registrierungsmodus gibt es nichts zu vergessen. */}
          {mode === "login" && (
            <Link
              to="/passwort-vergessen"
              className="self-start text-sm text-muted hover:underline"
            >
              Passwort vergessen?
            </Link>
          )}
        </div>

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
              }}
        className="mt-4 text-sm font-medium text-accent-strong hover:underline"
      >
        {mode === "login" ? "Noch kein Konto? Registrieren" : "Schon ein Konto? Zum Login"}
      </button>

      <Link to="/" className="mt-4 block text-sm text-muted hover:underline">
        ← Zurück zur Startseite
      </Link>
    </main>
  );
}
