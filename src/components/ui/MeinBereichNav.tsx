import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";
import { MEIN_BEREICH_NODES } from "../../config/meinBereich";

const linkBase = "relative rounded-md px-3 py-2 text-sm transition-colors";
const linkRest = "text-ink/70 hover:bg-night/[0.05] hover:text-ink";
const linkActive = "bg-night/[0.06] font-semibold text-gold-strong";

export function MeinBereichNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Mein Bereich" className="flex flex-col gap-1">
      <p className="px-3 pb-1 text-sm font-semibold text-ink">Mein Bereich</p>
      {MEIN_BEREICH_NODES.map((node) => (
        <NavLink
          key={node.to}
          to={node.to}
          end
          onClick={onNavigate}
          className={({ isActive }) => cn(linkBase, isActive ? linkActive : linkRest)}
        >
          {node.label}
        </NavLink>
      ))}
    </nav>
  );
}
