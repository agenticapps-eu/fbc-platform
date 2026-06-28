import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";

/**
 * „Mein Bereich"-Subnavigation (profile-spec §4) — wird IN PLACE in der globalen
 * (dunklen) Sidebar gezeigt, sobald man auf `/mein-bereich` ist. Es gibt nur EINE
 * Sidebar (AGE-237): sie schaltet zwischen den 7 Formaten und dieser Subnav um.
 *
 *  - `anchor` → scrollt zum Widget der Dashboard-Seite,
 *  - `to`     → verlinkt auf ein vorhandenes Format/Seite (Sidebar klappt zurück auf Formate),
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
      { label: "Meine Angebote", to: "/angebote-gesuche" },
      { label: "Meine Gesuche", to: "/angebote-gesuche" },
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
const itemLink = "text-on-night-muted hover:bg-night-elevated/60 hover:text-gold";

function SubNavLink({ item, onNavigate }: { item: SubNavItem; onNavigate?: () => void }) {
  if (item.to) {
    return (
      <Link to={item.to} onClick={onNavigate} className={cn(itemBase, itemLink)}>
        {item.label}
      </Link>
    );
  }
  if (item.anchor) {
    return (
      <a href={`#${item.anchor}`} onClick={onNavigate} className={cn(itemBase, itemLink)}>
        {item.label}
      </a>
    );
  }
  return (
    <span
      className={cn(itemBase, "cursor-default text-on-night-muted/40")}
      title="Tiefen-Seite folgt in einer späteren Phase."
    >
      {item.label}
    </span>
  );
}

export function MeinBereichSubnav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-5">
      {/* Zurück zum Hauptmenü (zeigt wieder die 7 Formate). */}
      <Link
        to="/community"
        onClick={onNavigate}
        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-on-night transition-colors hover:text-gold"
      >
        <span aria-hidden="true">←</span> Hauptmenü
      </Link>

      {GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-xs font-semibold tracking-wider text-on-night-muted/60 uppercase">
            {group.title}
          </p>
          {group.items.map((item, i) => (
            <SubNavLink key={`${item.label}-${i}`} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}
