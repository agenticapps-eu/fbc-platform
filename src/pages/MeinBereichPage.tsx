import { Link } from "react-router-dom";

// „Mein Bereich“-Subnavigation (profile-spec §4) entsteht vollständig in AGE-240.
// Im Prototyp ist hier bereits der funktionale Einstieg „Profil bearbeiten“ (AGE-238).
const MEIN_PROFIL_LINKS = [
  {
    to: "/profil",
    label: "Profil bearbeiten",
    description: "Angaben, Avatar, Rollen & Ziele pflegen.",
  },
];

export default function MeinBereichPage() {
  return (
    <section>
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">Mein Bereich</h1>
      <p className="mt-2 text-sm text-muted">Persönliche Einstellungen und Daten.</p>

      <h2 className="mt-8 text-xs font-semibold tracking-wide text-muted uppercase">Mein Profil</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {MEIN_PROFIL_LINKS.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="block rounded-[var(--radius-card)] border border-line bg-canvas p-5 shadow-soft transition-colors hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <span className="font-medium text-ink">{link.label}</span>
              <span className="mt-0.5 block text-sm text-muted">{link.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
