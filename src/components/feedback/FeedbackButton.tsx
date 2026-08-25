import { useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

import { submitPlatformFeedback } from "../../lib/feedback";
import { useAuth } from "../../providers/auth-context";
import { Button, Textarea, useToast } from "../ui";
import { useOverlay } from "../ui/useOverlay";
import { Icon } from "../ui/icons";

/**
 * QM-Feedback (AGE-300) — Spec §3.5. Eintrag am FUSS DER SEITENLEISTE, über
 * dem Einklapp-Schalter.
 *
 * SEIT AGE-566 nicht mehr schwebend: der Knopf hing über dem Inhalt und deckte
 * auf der Startseite den Aufruf „Mitglieder entdecken" halb zu. Das war kein
 * Zufall, sondern die zweite Kollision derselben Art — die erste (AGE-529, über
 * der Kachel „Frage" auf 375 px) wurde durch Verschieben gelöst, und genau das
 * hat sich jetzt gerächt. In der Leiste konkurriert er mit nichts.
 *
 * Kein Nav-Eintrag: `src/config/nav.test.ts` nagelt die Navigation exakt an Spec §2
 * fest (6+5+1). Ein Eintrag hier bräche beides. Der Route-Kontext tritt an die Stelle
 * der Aktion — deshalb muss das Modul überall erreichbar sein, nicht an einer Stelle.
 *
 * Kein Dialog-Primitive im Repo → Overlay-Muster aus AppShell.tsx (Off-Canvas-Sidebar).
 */
const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Fanfare, keine Sprechblase — dieselbe Strichstärke wie die Icons der
 * Navigation.
 *
 * Die erste Fassung war eine Sprechblase und damit ZEICHENGLEICH mit dem
 * Eintrag „Aktivität" zwei Zeilen darüber (`NavIcon.tsx`). Zwei Einträge
 * derselben Leiste mit demselben Symbol heben sich gegenseitig auf: das Symbol
 * unterscheidet dann nicht mehr, es dekoriert nur noch. Und inhaltlich stimmt
 * die Fanfare besser — Feedback ist ein Zuruf an uns, kein Gespräch unter
 * Mitgliedern.
 */
function FeedbackIcon() {
  return <Icon name="feedback" className="h-5 w-5 shrink-0" />;
}

export function FeedbackButton({ collapsed = false }: { collapsed?: boolean }) {
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
  // VOR dem frühen `return null` unten (AGE-529): stünde der Hook dahinter,
  // verletzte jeder Wechsel des Anmeldezustands die Hook-Regeln. `Boolean(user)`
  // in der Bedingung sorgt außerdem dafür, dass ein Sitzungsverlust bei offenem
  // Panel keine Sperre ohne sichtbares Overlay zurücklässt.
  const overlay = useOverlay(Boolean(user) && open);

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
      {/* Unter `sm` schwebt er NICHT (AGE-529): gemessen auf 375×812 lag er über der
          kuratierten Kachel „Frage", `elementFromPoint` in deren Mitte lieferte
          „Feedback". Er wird ohnehin nach <main> gerendert — ohne `fixed` fällt er
          von selbst ans Seitenende. Nicht bloß verschoben: die nächste Kollision
          wäre dieselbe, und dann misst niemand mehr nach.

          bottom-20 (nicht bottom-5): weicht dem Design-Variant-Switcher aus, der bei
          bottom-4 rechts unten sitzt (DesignSwitcher.tsx, AGE-237). Sobald der Switcher
          nach der Design-Entscheidung entfernt ist, kann das wieder bottom-5 werden. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={collapsed ? "Feedback" : undefined}
        aria-label={collapsed ? "Feedback" : undefined}
        className={
          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-on-chrome transition-colors hover:bg-chrome-elevated hover:text-on-chrome-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" +
          (collapsed ? " justify-center px-2" : "")
        }
      >
        <FeedbackIcon />
        {!collapsed && <span>Feedback</span>}
      </button>

      {/* PORTAL an document.body, seit der Auslöser in der Seitenleiste sitzt:
          ein Vorfahre mit `transform`, `filter` oder `backdrop-filter` wird zum
          Containing Block für `position: fixed`, und das Overlay schrumpfte
          dann auf die Leiste. In diesem Projekt schon zweimal passiert
          (AGE-529). Die Leiste trägt heute keines davon — aber sie muss es
          auch nie wieder dürfen. */}
      {open &&
        createPortal(
          <div
            ref={overlay}
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-label="Feedback geben"
          >
            <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={close} />
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
                    className="px-1 text-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
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
          </div>,
          document.body,
        )}
    </>
  );
}
