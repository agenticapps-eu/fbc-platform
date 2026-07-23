import { motion } from "framer-motion";
import { useId } from "react";
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
  // Pro Instanz eindeutig: Desktop-Aside + Off-Canvas-Drawer rendern beide eine
  // SidebarNav; ein geteilter layoutId würde den Indicator zwischen der sichtbaren
  // und der (display:none) versteckten Instanz springen lassen.
  const indicatorId = useId();
  return (
    <nav className="flex flex-col gap-7">
      {sections.map((section, i) => (
        <div
          key={section.title ?? i}
          className={cn(
            "flex flex-col gap-1",
            // AGE-450 #9: Bereichstitel sollen sich klar von den klickbaren Menüitems
            // abheben. Eine Haarlinie + mehr Luft über jedem Abschnitt (außer dem
            // ersten) trennt die Gruppen sichtbar als Struktur; kräftigerer,
            // dunklerer Titel (text-ink/60 statt /45) liest sich als Label, nicht Link.
            i > 0 && "mt-1 border-t border-line pt-5",
          )}
        >
          {section.title && (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-ink/60">
              {section.title}
            </p>
          )}
          {section.items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              // `/` (Start) nur bei exaktem Match aktiv, sonst leuchtet es auf jeder Route.
              end={item.path === "/"}
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
                      layoutId={`sidebar-active-indicator-${indicatorId}`}
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
