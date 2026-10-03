import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../providers/auth-context";
import { LEVEL_RANK, levelLabel, type MembershipLevel } from "../config/levels";
import { BERECHTIGUNG_STUFE, type Berechtigung } from "../config/berechtigungen";
import { useMeineRechte } from "../hooks/useDarf";
import { FORMAT_HERO } from "../config/formatHero";
import { FormatHero } from "./ui/FormatHero";
import { Button, buttonKlassen } from "./ui/Button";
import { REGISTRIEREN_PFAD } from "../pages/LoginPage";

/**
 * Gate für Routen mit `minTier` oder `darf` sowie für auth-pflichtige
 * `entdecken`-Routen (siehe `gatedElement` in App.tsx). Anders als
 * <RequireAuth> leitet dieses Gate anonyme oder nicht berechtigte Besucher
 * NICHT weg, sondern zeigt eine Wand — der Bereich bleibt im Schaufenster
 * sichtbar, der Inhalt aber gesperrt (Spec §1). Die echte Zugriffskontrolle
 * bleibt die Supabase-RLS.
 *
 * ══ ZWEI SORTEN SCHWELLE, UND SIE SIND NICHT DASSELBE (AGE-1000) ══════════
 * `minTier` ist die CLUBSCHWELLE — eine Tür, die `has_level(4)` in der
 * Datenbank hält, und hier ein Rangvergleich sein darf.
 * `darf` ist ein FEATURE-RECHT. Wo seine Schwelle liegt, weiß nur die
 * Datenbank; hier wird nur gefragt, ob der Aufrufer es trägt.
 *
 * Genau eines von beiden setzen. Beide zugleich wäre eine Schwelle an zwei
 * Orten, und `darf` gewinnt dann — die Kombination ist nicht gemeint.
 */
export default function MembershipGate({
  min,
  darf,
  children,
}: {
  min?: MembershipLevel;
  darf?: Berechtigung;
  children: ReactNode;
}) {
  const { user, levelRank, isLoading, tierLoading } = useAuth();
  // Unbedingt aufgerufen, weil Hooks das verlangen; ohne Sitzung fragt der Hook
  // von sich aus nicht.
  const { rechte, laedt: rechteLaden } = useMeineRechte();

  // Kein Flackern — und `rechteLaden` ist hier KEINE Ablehnung. Genau diese
  // Verwechslung hat in AGE-903 einem berechtigten Mitglied für einen Moment
  // die Wand gezeigt.
  if (isLoading || (user && tierLoading) || (darf && rechteLaden)) return null;

  const erlaubt = darf ? rechte.includes(darf) : !min || (levelRank ?? 0) >= LEVEL_RANK[min];
  if (user && erlaubt) return <>{children}</>;
  // anon ODER eingeloggt-aber-nicht-berechtigt → Wand
  return <MembershipWall stufe={darf ? BERECHTIGUNG_STUFE[darf] : min} loggedIn={!!user} />;
}

function MembershipWall({ stufe, loggedIn }: { stufe?: MembershipLevel; loggedIn: boolean }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hero = FORMAT_HERO[pathname];
  return (
    <div className="flex flex-col gap-6">
      {hero && <FormatHero meta={hero} />}
      <div className="rounded-[var(--radius-card)] border border-accent/25 bg-canvas/60 p-8 text-center shadow-soft">
        <h2 className="font-display text-2xl font-semibold text-ink">
          {stufe
            ? `Dieser Bereich ist ab ${levelLabel(stufe)} verfügbar`
            : "Dieser Bereich ist Mitgliedern vorbehalten"}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted">
          {loggedIn
            ? // AGE-907: Der zweite Satz ersetzt den Knopf „Upgrade", der hier
              // in den ruhenden Kaufweg führte. Den Mangel zu benennen und zu
              // schweigen, wohin man sich wendet, wäre eine Sackgasse — und
              // erzeugte genau die Rückfrage, die dieser Satz beantwortet.
              // Er ist die Wahrheit nach V5: höhere Stufen setzt der Admin von
              // Hand (AGE-707). Holt AGE-908 den Kauf zurück, wird hier wieder
              // ein Knopf daraus.
              "Deine Mitgliedsstufe reicht für diesen Bereich noch nicht. Höhere Stufen schaltet der Fair Business Club für dich frei — sprich uns an."
            : "Werde Mitglied im Fair Business Club, um Zugang zu erhalten."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {/* Nur die anonyme Fläche trägt hier noch einen Hauptknopf. Die
              Registrierung bleibt unverändert: sie kostet nichts und ist keine
              Zahlungsstrecke. */}
          {!loggedIn && (
            // Führt in die REGISTRIERUNG, nicht in den Login (AGE-616). Wer
            // hier steht, hat kein Konto — das sagt die Bedingung eine Zeile
            // höher. Ein Anmeldeformular verlangt von ihm etwas, was er gerade
            // nicht tun kann. Bis zum 26.08. tat es genau das.
            <Link to={REGISTRIEREN_PFAD} className={buttonKlassen("primary")}>
              Mitglied werden
            </Link>
          )}
          <Button variant="ghost" onClick={() => navigate("/")}>
            Zur Startseite
          </Button>
        </div>
      </div>
    </div>
  );
}
