import { motion } from "framer-motion";
import { useId } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";
import { useDesignVariantValue } from "../../providers/design-variant-context";
import { NavIcon } from "./NavIcon";

export interface SidebarNavItem {
  path: string;
  label: string;
}

export interface SidebarNavSection {
  title?: string;
  items: SidebarNavItem[];
}

/**
 * Trägt ein anderer Eintrag desselben Abschnitts diesen Pfad als Anfang?
 * `/admin` gegenüber `/admin/mitglieder`: ja. Der Schrägstrich im Vergleich ist
 * nicht schmückend — ohne ihn wäre `/admin` auch der Anfang von `/administration`.
 */
function istPraefixEinesAnderen(pfad: string, items: SidebarNavItem[]): boolean {
  return items.some((anderer) => anderer.path.startsWith(`${pfad}/`));
}

export interface SidebarNavProps {
  sections: SidebarNavSection[];
  /** Wird bei Klick auf einen Eintrag aufgerufen (z. B. Off-Canvas-Drawer schließen). */
  onNavigate?: () => void;
  /** Schmale Leiste: nur Icons, keine Beschriftungen (AGE-499). */
  collapsed?: boolean;
}

export function SidebarNav({ sections, onNavigate, collapsed = false }: SidebarNavProps) {
  const { preset } = useDesignVariantValue();
  // Pro Instanz eindeutig: Desktop-Aside + Off-Canvas-Drawer rendern beide eine
  // SidebarNav; ein geteilter layoutId würde den Indicator zwischen der sichtbaren
  // und der (display:none) versteckten Instanz springen lassen.
  const indicatorId = useId();
  return (
    <nav className={cn("flex flex-col", collapsed ? "gap-4" : "gap-7")}>
      {sections.map((section, i) => (
        <div
          key={section.title ?? i}
          className={cn(
            "flex flex-col gap-1",
            // AGE-450 #9: Bereichstitel sollen sich klar von den klickbaren Menüitems
            // abheben. Eine Haarlinie + mehr Luft über jedem Abschnitt (außer dem
            // ersten) trennt die Gruppen sichtbar als Struktur.
            // Eingeklappt trägt die Linie die Gruppierung allein — der Titel hat
            // in einer 4,5-rem-Leiste keinen Platz.
            i > 0 && "mt-1 border-t border-chrome-border pt-4",
          )}
        >
          {section.title && !collapsed && (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-on-chrome-muted">
              {section.title}
            </p>
          )}
          {section.items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              // `/` (Start) nur bei exaktem Match aktiv, sonst leuchtet es auf jeder Route.
              // Und ebenso jeder Eintrag, dessen Pfad der ANFANG eines anderen
              // Eintrags ist: `NavLink` matcht ohne `end` als Präfix, also
              // leuchteten auf `/admin/mitglieder` „Administration" UND
              // „Mitglieder" (AGE-566, Diff-Review).
              //
              // ABGELEITET statt als Prop am Eintrag: eine Flagge, die der
              // Aufrufer setzen muss, ist eine Flagge, die er beim nächsten
              // Unterpfad vergisst — und dann leuchtet wieder alles, ohne dass
              // ein Test darauf zeigt. Der Abschnitt kennt seine Einträge; er
              // kann die Frage selbst beantworten.
              end={item.path === "/" || istPraefixEinesAnderen(item.path, section.items)}
              onClick={onNavigate}
              // Eingeklappt ist das Icon die einzige Beschriftung — der Name muss
              // dann über title (Maus) und aria-label (Screenreader) kommen.
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center rounded-md text-sm transition-colors",
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
                  isActive
                    ? "bg-chrome-active font-semibold text-on-chrome-active"
                    : "text-on-chrome hover:bg-chrome-elevated hover:text-on-chrome-active",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Akzent-Linksbalken — gleitet per layoutId zwischen Einträgen.
                      Eingeklappt entfällt er: neben einem zentrierten Icon in einer
                      schmalen Leiste liest er sich als Rand, nicht als Marke. */}
                  {isActive && !collapsed && (
                    <motion.span
                      layoutId={`sidebar-active-indicator-${indicatorId}`}
                      className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-on-chrome-active"
                      transition={{ duration: preset.duration, ease: preset.ease }}
                    />
                  )}
                  <NavIcon path={item.path} active={isActive} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
