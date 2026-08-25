import { useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  defaultValue?: string;
  className?: string;
}

export function Tabs({ tabs, defaultValue, className }: TabsProps) {
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value);
  const activeTab = tabs.find((t) => t.value === active) ?? tabs[0];

  return (
    <div className={className}>
      {/* `overflow-x-auto` + `shrink-0`: Ohne beides staucht der Flex-Container
          die Reiter, bis ihre Beschriftung UMBRICHT — gemessen bei 320 px
          brauchten „Kommende (12) · Vergangene (34) · Meine Events (46)"
          zusammen 412 px und bekamen 288 px; alle drei standen zweizeilig, der
          letzte auf 67 statt 130 px. Bei 375 px blieb 1 px Reserve, also trägt
          jede zweistellige Zahl mehr die Leiste über die Kante.

          Dasselbe Muster wie in der Admin-Mitgliederliste, die es schon so
          macht. `scrollWidth` taugt hier NICHT als Messwert: Ein gestauchtes
          Flex-Kind meldet die gestauchte Breite, und die Leiste sieht damit
          rechnerisch immer aus, als passe sie genau. */}
      <div role="tablist" className="flex gap-6 overflow-x-auto border-b border-line">
        {tabs.map((tab) => {
          const isActive = tab.value === active;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.value)}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "border-accent text-accent-strong"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-5 text-sm text-ink">
        {activeTab?.content}
      </div>
    </div>
  );
}
