import { Link } from "react-router-dom";

/**
 * „Mein Bereich"-Subnavigation (profile-spec §4) — eigene Sidebar im Dashboard,
 * NICHT die globale Formate-Sidebar. Gruppen & Einträge exakt nach Mockup.
 *
 * Im Prototyp:
 *  - `anchor` → scrollt zum Widget der „Übersicht" (funktionale Einträge),
 *  - `to`     → verlinkt auf ein vorhandenes Format/Seite,
 *  - sonst    → „Tiefen-Seite folgt": dezent gemutet, (noch) nicht klickbar.
 */
interface SubNavItem {
  label: string;
  to?: string;
  anchor?: string;
}
interface SubNavGroup {
  title: string;
  items: SubNavItem[];
}

const GROUPS: SubNavGroup[] = [
  {
    title: "Mein Profil",
    items: [
      { label: "Übersicht", anchor: "uebersicht" },
      { label: "Profil bearbeiten", to: "/profil" },
      { label: "Mein Erfolgsradar", anchor: "erfolgsradar" },
      { label: "Interessen & Fokus", anchor: "interessen" },
    ],
  },
  {
    title: "Mein Netzwerk",
    items: [
      { label: "Meine Kontakte", anchor: "netzwerk" },
      { label: "Freunde" },
      { label: "Preferred Partner" },
      { label: "Mentoren" },
      { label: "Mentees" },
    ],
  },
  {
    title: "Meine Aktivitäten",
    items: [
      { label: "Meine Events", to: "/events" },
      { label: "Meine gebuchten Events", anchor: "events" },
      { label: "Meine eigenen Events" },
      { label: "Meine Gruppen", anchor: "communities" },
      { label: "Meine Beiträge", anchor: "beitraege" },
    ],
  },
  {
    title: "Mein Business",
    items: [
      { label: "Meine Projekte", anchor: "projekte" },
      { label: "Meine Investments", anchor: "investments" },
      { label: "Meine Angebote", anchor: "matching" },
      { label: "Meine Gesuche", anchor: "matching" },
    ],
  },
  {
    title: "Mein Matching",
    items: [
      { label: "Mein Matching Dashboard", to: "/matching" },
      { label: "Meine Suchaufträge" },
      { label: "Meine Matches", anchor: "matching" },
      { label: "Matching Historie" },
    ],
  },
  {
    title: "Meine Entwicklung",
    items: [
      { label: "Academy & Kurse", to: "/academy" },
      { label: "Zertifikate & Badges", anchor: "auszeichnungen" },
      { label: "Meine Ziele", anchor: "ziele" },
      { label: "Meine Dokumente" },
    ],
  },
  {
    title: "Meine Tools",
    items: [
      { label: "FBC KI Assistent", anchor: "ki" },
      { label: "Favoriten" },
      { label: "Einstellungen" },
    ],
  },
];

const itemBase = "block rounded-md px-3 py-1.5 text-sm transition-colors";
const itemActive = "text-muted hover:bg-ink/[0.04] hover:text-gold-strong";

function NavItem({ item }: { item: SubNavItem }) {
  if (item.to) {
    return (
      <Link to={item.to} className={`${itemBase} ${itemActive}`}>
        {item.label}
      </Link>
    );
  }
  if (item.anchor) {
    return (
      <a href={`#${item.anchor}`} className={`${itemBase} ${itemActive}`}>
        {item.label}
      </a>
    );
  }
  return (
    <span
      className={`${itemBase} cursor-default text-muted/45`}
      title="Tiefen-Seite folgt in einer späteren Phase."
    >
      {item.label}
    </span>
  );
}

export function MeinBereichSidebar() {
  return (
    <aside className="lg:sticky lg:top-24 lg:h-fit lg:w-60 lg:shrink-0">
      <nav className="flex flex-col gap-6">
        {GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 text-xs font-semibold tracking-wider text-muted/70 uppercase">
              {group.title}
            </p>
            {group.items.map((item, i) => (
              <NavItem key={`${item.label}-${i}`} item={item} />
            ))}
          </div>
        ))}
      </nav>

      {/* Compass-Fußkarte (§4) — dunkle Gold-Card. */}
      <div className="mt-6 rounded-[var(--radius-card)] bg-night p-5 text-on-night shadow-soft">
        <p className="font-display text-lg font-semibold text-gold">Dein Compass</p>
        <p className="mt-1 text-sm text-on-night-muted">Dein Weg. Deine Richtung.</p>
        <Link
          to="/compass"
          className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-gold px-3 text-sm font-medium text-night transition-colors hover:bg-gold-strong hover:text-on-night focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-night"
        >
          Jetzt öffnen
        </Link>
      </div>
    </aside>
  );
}
