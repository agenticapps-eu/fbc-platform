import { useState } from "react";
import { useLocation } from "react-router-dom";

import { submitPlatformFeedback } from "../../lib/feedback";
import { useAuth } from "../../providers/auth-context";
import { Button, Textarea, useToast } from "../ui";

/**
 * QM-Feedback (AGE-300) — Spec §3.5. Schwebender Button, überall im AppShell.
 *
 * Kein Nav-Eintrag: `src/config/nav.test.ts` nagelt die Navigation exakt an Spec §2
 * fest (6+5+1). Ein Eintrag hier bräche beides. Der Route-Kontext tritt an die Stelle
 * der Aktion — deshalb muss das Modul überall erreichbar sein, nicht an einer Stelle.
 *
 * Kein Dialog-Primitive im Repo → Overlay-Muster aus AppShell.tsx (Off-Canvas-Sidebar).
 */
const STARS = [1, 2, 3, 4, 5] as const;

export function FeedbackButton() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [likes, setLikes] = useState("");
  const [misses, setMisses] = useState("");
  const [idea, setIdea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Ohne Konto ist Feedback nicht speicherbar: feedback.profile_id ist `not null`
  // und feedback_own verlangt profile_id = auth.uid(). Einen Button zu zeigen, der
  // nur scheitern kann, wäre ein Versprechen ins Leere.
  if (!user) return null;
  // tsc verengt `user` nicht in die weiter unten definierte `submit`-Closure hinein
  // (Kontrollfluss-Analyse endet an der Funktionsgrenze). Deshalb hier binden statt
  // dort `user!` zu casten.
  const profileId = user.id;

  function close() {
    setOpen(false);
    setError(null);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await submitPlatformFeedback({
        profileId,
        rating,
        likes,
        misses,
        idea,
        route: pathname,
      });
      toast({ title: "Danke für dein Feedback!" });
      setRating(0);
      setLikes("");
      setMisses("");
      setIdea("");
      setOpen(false);
    } catch {
      setError("Dein Feedback konnte nicht gespeichert werden. Bitte versuche es noch einmal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* bottom-20 (nicht bottom-5): weicht dem Design-Variant-Switcher aus, der bei
          bottom-4 rechts unten sitzt (DesignSwitcher.tsx, AGE-237). Sobald der Switcher
          nach der Design-Entscheidung entfernt ist, kann das wieder bottom-5 werden. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-5 z-40 rounded-full border border-gold/30 bg-canvas px-4 py-2.5 text-sm font-semibold text-ink shadow-soft transition-colors hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong"
      >
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Feedback geben"
        >
          <div className="absolute inset-0 bg-night/60 backdrop-blur-sm" onClick={close} />
          <div className="absolute bottom-0 right-0 max-h-[90vh] w-full overflow-y-auto rounded-t-[var(--radius-card)] bg-canvas p-6 shadow-soft sm:bottom-5 sm:right-5 sm:w-[26rem] sm:rounded-[var(--radius-card)]">
            <h2 className="text-lg font-semibold text-ink">Wie gefällt dir die Plattform?</h2>

            <div className="mt-4" role="radiogroup" aria-label="Sternebewertung">
              {STARS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} von 5 Sternen`}
                  onClick={() => setRating(n)}
                  className="px-1 text-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-strong"
                >
                  <span aria-hidden="true">{n <= rating ? "★" : "☆"}</span>
                </button>
              ))}
            </div>

            <label className="mt-4 block text-sm font-medium text-ink" htmlFor="fb-likes">
              Was gefällt dir?
            </label>
            <Textarea
              id="fb-likes"
              rows={2}
              value={likes}
              onChange={(e) => setLikes(e.target.value)}
            />

            <label className="mt-3 block text-sm font-medium text-ink" htmlFor="fb-misses">
              Was fehlt dir?
            </label>
            <Textarea
              id="fb-misses"
              rows={2}
              value={misses}
              onChange={(e) => setMisses(e.target.value)}
            />

            <label className="mt-3 block text-sm font-medium text-ink" htmlFor="fb-idea">
              Welche Idee hast du?
            </label>
            <Textarea
              id="fb-idea"
              rows={2}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                Abbrechen
              </Button>
              <Button onClick={submit} disabled={rating === 0 || saving}>
                Absenden
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
