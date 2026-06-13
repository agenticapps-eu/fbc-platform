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
      <div role="tablist" className="flex gap-6 border-b border-line">
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
                "-mb-px border-b-2 px-1 pb-3 text-sm font-medium transition-colors",
                isActive
                  ? "border-gold text-gold-strong"
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
