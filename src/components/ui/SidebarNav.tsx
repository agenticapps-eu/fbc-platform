import { motion } from "framer-motion";
import { useId, useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";
import { useDesignVariantValue } from "../../providers/design-variant-context";
import { Icon } from "./icons";
import { NavIcon } from "./NavIcon";

export interface SidebarNavItem {
  path: string;
  label: string;
  /**
   * Abzeichen am Eintrag (AGE-592) — ein offener Vorgang, der auf eine
   * Entscheidung wartet.
   *
   * `text` ist das Sichtbare (eine Zahl, oder „!" wenn der Stand unbekannt ist),
   * `label` seine Benennung. Beides gehört zusammen: Eine nackte Ziffer neben
   * einem Wort ist keine Aussage darüber, WAS gezählt wurde — „2" neben „Meine
   * Anfragen" könnte genauso „zwei Kontakte" heißen —, und für einen
   * Screenreader ist sie eine Zahl ohne Gegenstand.
   *
   * Fehlt das Feld, erscheint nichts. Insbesondere gibt es KEINE Null: Eine Null
   * ist keine Aufforderung, und ein Zähler, der dauernd Null zeigt, wird nicht
   * mehr gelesen (so schon bei den Reiter-Zählern in AGE-587 entschieden).
   */
  abzeichen?: { text: string; label: string };
}

export interface SidebarNavSection {
  title?: string;
  items: SidebarNavItem[];
  /**
   * Inline-Akkordeon (AGE-292): der Titel wird zur Schaltfläche, die ihre
   * Einträge auf- und zuklappt.
   *
   * Der Zuschnitt löst AGE-293 gleich mit: eine Überschrift, die nur dasteht,
   * ist genau das tote Label, das dort weg soll — eine, die etwas tut, ist ein
   * Bedienelement. Die Hauptnavigation bekommt deshalb GAR KEINEN Titel mehr
   * statt eines klappbaren; über ihr sagt ein Wort nichts, was die Einträge
   * nicht selbst sagen.
   *
   * Höchstens EINE Ebene tief — der persönliche Bereich soll schlank bleiben,
   * nicht zu einem zweiten Menü werden.
   */
  klappbar?: boolean;
}

/**
 * Trägt ein anderer Eintrag desselben Abschnitts diesen Pfad als Anfang?
 * `/admin` gegenüber `/admin/mitglieder`: ja. Der Schrägstrich im Vergleich ist
 * nicht schmückend — ohne ihn wäre `/admin` auch der Anfang von `/administration`.
 */
function istPraefixEinesAnderen(pfad: string, items: SidebarNavItem[]): boolean {
  return items.some((anderer) => anderer.path.startsWith(`${pfad}/`));
}

/**
 * Der zugängliche Name eines Eintrags — Beschriftung plus, falls vorhanden, die
 * Benennung seines Abzeichens. Zusammengesetzt statt zweier Quellen, weil ein
 * `aria-label` den Inhalt ersetzt und nicht ergänzt.
 */
function zugaenglicherName(item: SidebarNavItem): string {
  return item.abzeichen ? `${item.label}, ${item.abzeichen.label}` : item.label;
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
  /**
   * Die ZUGEKLAPPTEN Abschnitte, nicht die offenen (AGE-292).
   *
   * Andersherum — eine Menge der offenen — müsste der Anfangszustand jeden
   * klappbaren Abschnitt aufzählen, und ein später hinzugefügter stünde
   * stillschweigend zu. Ein Abschnitt, den niemand angefasst hat, ist offen.
   */
  const [zugeklappt, setZugeklappt] = useState<ReadonlySet<string>>(new Set());
  const umschalten = (titel: string) =>
    setZugeklappt((vorher) => {
      const naechste = new Set(vorher);
      if (!naechste.delete(titel)) naechste.add(titel);
      return naechste;
    });
  return (
    <nav className={cn("flex flex-col", collapsed ? "gap-4" : "gap-7")}>
      {sections.map((section, i) => {
        // Klappbar nur ausgeklappt und nur mit Titel: in der schmalen Leiste
        // gibt es keine Überschrift, also auch keinen Griff — ein Akkordeon
        // ohne sichtbaren Griff versteckte seine Einträge unerreichbar.
        const istKlappbar = Boolean(section.klappbar && section.title && !collapsed);
        const offen = !istKlappbar || !zugeklappt.has(section.title as string);
        return (
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
          {section.title && !collapsed && !istKlappbar && (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-on-chrome-muted">
              {section.title}
            </p>
          )}
          {istKlappbar && (
            <button
              type="button"
              onClick={() => umschalten(section.title as string)}
              aria-expanded={offen}
              className="flex items-center gap-1 rounded-md px-3 pb-1 pt-0.5 text-xs font-semibold uppercase tracking-wider text-on-chrome-muted transition-colors hover:text-on-chrome-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {/* Aus dem Icon-Satz, nicht inline gezeichnet: `icons.test.ts`
                  hält fest, dass jeder wiederverwendbare Glyph dort steht — ein
                  eigener Chevron hier wäre der vierte im Baum.
                  `Icon` setzt `aria-hidden` selbst; die Richtung steht ohnehin
                  in `aria-expanded`, und „Dreieck" ergänzt dort nichts. */}
              <Icon
                name="chevronDown"
                className={cn("h-3.5 w-3.5 transition-transform", offen ? "rotate-0" : "-rotate-90")}
              />
              {section.title}
            </button>
          )}
          {offen && section.items.map((item) => (
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
              //
              // Das Abzeichen MUSS in diesen Namen hinein: Ein `aria-label`
              // ERSETZT den Inhalt des Elements, es ergänzt ihn nicht. Stünde
              // hier nur `item.label`, wäre die Zahl im Abzeichen für einen
              // Screenreader unsichtbar — sichtbar fürs Auge, stumm für alle
              // anderen, und ausgerechnet an dem einen Signal, für das dieser
              // Eintrag existiert.
              title={collapsed ? zugaenglicherName(item) : undefined}
              aria-label={collapsed || item.abzeichen ? zugaenglicherName(item) : undefined}
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
                  {item.abzeichen && (
                    // Ausgeklappt am rechten Rand der Zeile, eingeklappt als
                    // kleine Marke über der oberen rechten Ecke des Icons. Der
                    // Link trägt `relative`, die Marke hängt also an ihm und
                    // nicht am Icon — sie darf es anstoßen, nicht verdecken.
                    //
                    // `aria-hidden`, weil der zugängliche Name des Links den
                    // Inhalt schon trägt (siehe aria-label oben); ohne dies
                    // stünde die Zahl dort zweimal.
                    <span
                      aria-hidden="true"
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-chrome",
                        collapsed ? "absolute -top-0.5 right-0.5" : "ml-auto",
                      )}
                    >
                      {item.abzeichen.text}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
        );
      })}
    </nav>
  );
}
