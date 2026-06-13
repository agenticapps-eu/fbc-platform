import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";

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
}

export function SidebarNav({ sections }: SidebarNavProps) {
  return (
    <nav className="flex flex-col gap-7">
      {sections.map((section, i) => (
        <div key={section.title ?? i} className="flex flex-col gap-1">
          {section.title && (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-on-night-muted/70">
              {section.title}
            </p>
          )}
          {section.items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "relative rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-night-elevated font-medium text-gold"
                    : "text-on-night-muted hover:bg-night-elevated/60 hover:text-on-night",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Gold-Linksbalken am aktiven Eintrag. */}
                  {isActive && (
                    <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-gold" />
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
