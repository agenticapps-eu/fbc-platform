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
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-grey/70">
              {section.title}
            </p>
          )}
          {section.items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                cn(
                  "relative rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-emerald/8 font-medium text-emerald"
                    : "text-grey hover:bg-ink/[0.03] hover:text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Goldakzent als feine Linie am aktiven Eintrag. */}
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
