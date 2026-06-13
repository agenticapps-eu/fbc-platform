import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/ui/Logo";
import { cn } from "../lib/cn";
import {
  COMPASS_STEPS,
  COMPASS_SCALE_DEFAULT,
  COMPASS_SCALE_MAX,
  COMPASS_SCALE_MIN,
  COMPASS_THEME_LABEL,
  type ChipsStep,
  type ScaleStep,
} from "../config/compass";
import {
  type CompassDraft,
  type CompassResult,
  clearDraft,
  clearSkipped,
  compassStatusQueryKey,
  loadDraft,
  markSkipped,
  saveCompass,
  saveDraft,
} from "../lib/compass";
import { useAuth } from "../providers/auth-context";

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unbekannter Fehler.";
}

export default function OnboardingPage() {
  const { user } = useAuth();
  // /onboarding ist requiresAuth — user ist hier vorhanden; defensiver Fallback.
  if (!user) return null;
  return <Onboarding uid={user.id} />;
}

function Onboarding({ uid }: { uid: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const steps = COMPASS_STEPS;

  const [draft, setDraft] = useState<CompassDraft>(() => loadDraft(uid));
  const [stepIndex, setStepIndex] = useState(0);

  // Entwurf bei jeder Änderung sichern → „später fortsetzbar".
  useEffect(() => {
    saveDraft(uid, draft);
  }, [uid, draft]);

  const mutation = useMutation({
    mutationFn: () => saveCompass(uid, steps, draft),
    onSuccess: () => {
      clearDraft(uid);
      clearSkipped(uid);
      queryClient.invalidateQueries({ queryKey: compassStatusQueryKey(uid) });
      queryClient.invalidateQueries({ queryKey: ["dashboard", uid] });
    },
  });

  function setScale(stepId: string, value: number) {
    setDraft((d) => ({ ...d, scales: { ...d.scales, [stepId]: value } }));
  }

  function toggleChip(step: ChipsStep, value: string) {
    setDraft((d) => {
      const current = d.chips[step.id] ?? [];
      const isOn = current.includes(value);
      let next: string[];
      if (isOn) {
        next = current.filter((v) => v !== value);
      } else if (step.maxSelect && current.length >= step.maxSelect) {
        return d; // Limit erreicht — Auswahl unverändert lassen.
      } else {
        next = [...current, value];
      }
      return { ...d, chips: { ...d.chips, [step.id]: next } };
    });
  }

  function handleSkip() {
    markSkipped(uid);
    navigate("/mein-bereich", { replace: true });
  }

  const isLast = stepIndex === steps.length - 1;
  const step = steps[stepIndex];

  if (mutation.isSuccess) {
    return (
      <CompassResultView result={mutation.data} onGoDashboard={() => navigate("/mein-bereich")} />
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-night text-on-night">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo tone="dark" />
        <button
          type="button"
          onClick={handleSkip}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-on-night-muted transition-colors hover:text-on-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          Überspringen
        </button>
      </header>

      {/* Fortschritt */}
      <div className="px-6 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex items-center justify-between text-xs text-on-night-muted">
            <span>
              Schritt {stepIndex + 1} von {steps.length}
            </span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-night-elevated">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Frage (ein Schritt) */}
      <div className="flex flex-1 items-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">{step.title}</p>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-on-night sm:text-4xl">
            {step.prompt}
          </h1>

          <div className="mt-10">
            {step.kind === "scale" ? (
              <ScaleField
                step={step}
                value={draft.scales[step.id] ?? COMPASS_SCALE_DEFAULT}
                onChange={(v) => setScale(step.id, v)}
              />
            ) : (
              <ChipsField
                step={step}
                selected={draft.chips[step.id] ?? []}
                onToggle={(v) => toggleChip(step, v)}
              />
            )}
          </div>

          {mutation.isError && (
            <p className="mt-8 text-sm text-danger">
              Compass konnte nicht gespeichert werden: {errorMessage(mutation.error)}
            </p>
          )}

          {/* Navigation */}
          <div className="mt-12 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={stepIndex === 0}
              className="rounded-md px-3 py-2 text-sm font-medium text-on-night-muted transition-colors hover:text-on-night disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              ← Zurück
            </button>
            {isLast ? (
              <Button
                variant="primary"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Wird gespeichert…" : "Compass abschließen"}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setStepIndex((i) => i + 1)}>
                Weiter
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function ScaleField({
  step,
  value,
  onChange,
}: {
  step: ScaleStep;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <span className="font-display text-6xl font-semibold text-gold">{value}</span>
        <span className="text-2xl text-on-night-muted"> / {COMPASS_SCALE_MAX}</span>
      </div>
      <input
        type="range"
        min={COMPASS_SCALE_MIN}
        max={COMPASS_SCALE_MAX}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={step.prompt}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-night-elevated accent-gold"
      />
      <div className="flex justify-between text-sm text-on-night-muted">
        <span>{step.minLabel}</span>
        <span>{step.maxLabel}</span>
      </div>
    </div>
  );
}

function ChipsField({
  step,
  selected,
  onToggle,
}: {
  step: ChipsStep;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {step.hint && <p className="text-sm text-on-night-muted">{step.hint}</p>}
      <div className="flex flex-wrap gap-3">
        {step.options.map((opt) => {
          const isOn = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={isOn}
              onClick={() => onToggle(opt.value)}
              className={cn(
                "rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                isOn
                  ? "border-gold bg-gold text-night"
                  : "border-night-border text-on-night hover:border-gold hover:text-on-night",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompassResultView({
  result,
  onGoDashboard,
}: {
  result: CompassResult;
  onGoDashboard: () => void;
}) {
  const navigate = useNavigate();
  const scoreByTheme = useMemo(
    () => Object.fromEntries(result.themeScores.map((t) => [t.theme, t.score])),
    [result.themeScores],
  );
  const themes = ["sein", "tun", "haben", "wirken"] as const;

  return (
    <main className="flex min-h-screen flex-col bg-night text-on-night">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo tone="dark" />
      </header>

      <div className="flex flex-1 items-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">Geschafft</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight text-on-night">
            Dein Compass steht.
          </h1>
          <p className="mt-3 text-on-night-muted">
            Aus deinen Antworten haben wir deinen Erfolgsradar, dein Such- &amp; Bieteprofil und
            deine Interessen erstellt — dein Profil ist jetzt zu {result.completion} % vollständig.
          </p>

          {/* Erfolgsradar (Themen-Scores) */}
          <section className="mt-8 rounded-[var(--radius-card)] border border-night-border bg-night-elevated p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-on-night-muted">
              Dein Erfolgsradar
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {themes.map((theme) => {
                const score = Number(scoreByTheme[theme] ?? 0);
                return (
                  <li key={theme} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-sm text-on-night">
                      {COMPASS_THEME_LABEL[theme]}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-night">
                      <div
                        className="h-full rounded-full bg-gold"
                        style={{ width: `${(score / 10) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-sm tabular-nums text-on-night-muted">
                      {score.toFixed(1)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Zusammenfassung */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <SummaryCard
              title="Impact Score"
              value={`${result.score}`}
              hint="regelbasiert (AGE-242)"
            />
            <SummaryCard
              title="Aktueller Fokus"
              value={result.devFocus ? COMPASS_THEME_LABEL[result.devFocus] : "—"}
              hint="dein stärkstes Thema"
            />
          </div>

          {result.offers.length > 0 && <ResultChips title="Ich biete" items={result.offers} />}
          {result.needs.length > 0 && <ResultChips title="Ich suche" items={result.needs} />}
          {result.interests.length > 0 && (
            <ResultChips title="Deine Interessen" items={result.interests} />
          )}

          {/* Erste Empfehlungen / nächste Schritte (ehrlich, keine Fake-Matches) */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-on-night-muted">
              Empfohlene nächste Schritte
            </h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-on-night-muted">
              {result.completion < 80 && (
                <li>• Vervollständige dein Profil, um Sichtbarkeit und Matching zu verbessern.</li>
              )}
              <li>• Entdecke die Community und finde Mitglieder mit ähnlichen Zielen.</li>
              <li>• Dein Such- &amp; Bieteprofil ist aktiv — es speist künftige Matches.</li>
            </ul>
          </section>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button variant="primary" onClick={onGoDashboard}>
              Zum Dashboard
            </Button>
            <Button variant="ghost" onClick={() => navigate("/profil")}>
              Profil vervollständigen
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-night-border bg-night-elevated p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-on-night-muted">{title}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-gold">{value}</p>
      <p className="mt-1 text-xs text-on-night-muted">{hint}</p>
    </div>
  );
}

function ResultChips({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-on-night-muted">
        {title}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="rounded-full border border-night-border px-3 py-1 text-sm text-on-night"
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}
