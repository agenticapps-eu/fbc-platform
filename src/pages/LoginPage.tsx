import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/ui/Logo";
import { useAuth } from "../providers/auth-context";
import { useDesignVariant } from "../providers/design-variant-context";

const schema = z.object({
  email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben."),
  password: z.string().min(8, "Das Passwort muss mindestens 8 Zeichen haben."),
});
type FormValues = z.infer<typeof schema>;

type Mode = "login" | "register";

export default function LoginPage() {
  const { user, isLoading, signIn, signUp } = useAuth();
  const { meta } = useDesignVariant();
  // Hero-Logo folgt dem Hero-Stil (dark-glow → dunkle Krone), nicht der Basis-Variante:
  // so bekommt auch D (heller Body, dunkler Hero) die dunkle Logo-Darstellung.
  const heroTone = meta.heroStyle === "dark-glow" ? "dark" : "light";
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Bereits eingeloggt → kein Grund für die Login-Seite. „/" entscheidet via
  // HomeRedirect, ob neue Nutzer ins Mini-Compass-Onboarding geleitet werden (AGE-243).
  if (!isLoading && user) return <Navigate to="/" replace />;

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setInfo(null);

    if (mode === "login") {
      const { error } = await signIn(values.email, values.password);
      if (error) {
        setFormError(error.message);
        return;
      }
      navigate("/", { replace: true });
      return;
    }

    const { error } = await signUp(values.email, values.password);
    if (error) {
      setFormError(error.message);
      return;
    }
    // Ist E-Mail-Bestätigung deaktiviert, liefert signUp direkt eine Session und
    // der Navigate-Guard oben leitet nach "/". Sonst diesen Hinweis zeigen.
    setInfo(
      "Registrierung erfolgreich. Falls E-Mail-Bestätigung aktiv ist, bitte Postfach prüfen.",
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      {/* Variant-bewusster Hero: dark-glow-Panel (b/d) bzw. heller Hero (a/c),
          Gold-Shimmer-Sweep, Krone-Logo. */}
      <div className="fbc-hero fbc-hero-shimmer overflow-hidden rounded-[var(--radius-card)] border border-gold/25 px-6 py-8 text-center shadow-soft">
        <div className="flex justify-center">
          <Logo lockup="full" tone={heroTone} />
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
            : "Neues Konto erstellen — Stufe „Discover“ wird automatisch vergeben."}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium text-ink">
            E-Mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register("email")}
            className="h-11 rounded-md border border-line bg-canvas px-3 text-sm text-ink transition-colors focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
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
            className="h-11 rounded-md border border-line bg-canvas px-3 text-sm text-ink transition-colors focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          />
          {errors.password && <p className="text-sm text-danger">{errors.password.message}</p>}
        </div>

        {formError && <p className="text-sm text-danger">{formError}</p>}
        {info && <p className="text-sm text-success">{info}</p>}

        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {mode === "login" ? "Anmelden" : "Konto erstellen"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "login" ? "register" : "login"));
          setFormError(null);
          setInfo(null);
        }}
        className="mt-4 text-sm font-medium text-gold-strong hover:underline"
      >
        {mode === "login" ? "Noch kein Konto? Registrieren" : "Schon ein Konto? Zum Login"}
      </button>

      <Link to="/" className="mt-4 block text-sm text-muted hover:underline">
        ← Zurück zur Community
      </Link>
    </main>
  );
}
