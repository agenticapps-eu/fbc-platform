import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";
import { useDesignVariantValue } from "../../providers/design-variant-context";

export interface SidebarNavItem {
  path: string;
  label: string;
}

export interface SidebarNavSection {
  title?: string;
  items: SidebarNavItem[];
}

export interface SidebarNavProps {
  sections: SidebarNavSection[];
  /** Wird bei Klick auf einen Eintrag aufgerufen (z. B. Off-Canvas-Drawer schließen). */
  onNavigate?: () => void;
}

export function SidebarNav({ sections, onNavigate }: SidebarNavProps) {
  const { preset } = useDesignVariantValue();
  return (
    <nav className="flex flex-col gap-7">
      {sections.map((section, i) => (
        <div key={section.title ?? i} className="flex flex-col gap-1">
          {section.title && (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-ink/45">
              {section.title}
            </p>
          )}
          {section.items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "relative rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-night/[0.06] font-semibold text-gold-strong"
                    : "text-ink/70 hover:bg-night/[0.05] hover:text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Gold-Linksbalken — gleitet per layoutId zwischen Einträgen. */}
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active-indicator"
                      className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-gold-strong"
                      transition={{ duration: preset.duration, ease: preset.ease }}
                    />
                  )}
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
