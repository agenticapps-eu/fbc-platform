import { useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";
import { MEIN_BEREICH_NODES } from "../../config/meinBereich";

const linkBase = "relative rounded-md px-3 py-2 text-sm transition-colors";
const linkRest = "text-ink/70 hover:bg-night/[0.05] hover:text-ink";
const linkActive = "bg-night/[0.06] font-semibold text-gold-strong";

export function MeinBereichAccordion({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 pb-1 text-sm font-semibold text-ink">Mein Bereich</p>
      {MEIN_BEREICH_NODES.map((node) =>
        node.children ? (
          <div key={node.label} className="flex flex-col">
            <button
              type="button"
              onClick={() => setOpen((o) => (o === node.label ? null : node.label))}
              aria-expanded={open === node.label}
              className={cn(linkBase, linkRest, "flex items-center justify-between text-left")}
            >
              {node.label}
              <span aria-hidden className="text-muted">
                {open === node.label ? "▾" : "▸"}
              </span>
            </button>
            {open === node.label && (
              <div className="ml-3 flex flex-col border-l border-gold/20 pl-2">
                {node.children.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    onClick={onNavigate}
                    className={({ isActive }) => cn(linkBase, isActive ? linkActive : linkRest)}
                  >
                    {child.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ) : (
          <NavLink
            key={node.to}
            to={node.to!}
            onClick={onNavigate}
            className={({ isActive }) => cn(linkBase, isActive ? linkActive : linkRest)}
          >
            {node.label}
          </NavLink>
        ),
      )}
    </div>
  );
}
