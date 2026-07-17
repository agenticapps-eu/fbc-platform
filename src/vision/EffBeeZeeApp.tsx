import { useState } from "react";
import { EBZ_VARS } from "./theme";
import { VISION_NAV, type VisionKey } from "./nav";
import { SCREENS } from "./screens";
import { me } from "./fixtures";

/**
 * eff.bee.zee-Vision-Dummy (AGE-361, Phase C) — vollständiger Klick-Dummy einer
 * anderen Marke, gerendert wenn die Design-Variante `linkedin` aktiv ist (App.tsx).
 * State-basierte Navigation (kein echtes Routing, keine toten Links, keine
 * Schreibzugriffe). Dauerhaftes „Vorschau"-Banner macht den Status transparent.
 */
export function EffBeeZeeApp() {
  const [active, setActive] = useState<VisionKey>("active");
  const Screen = SCREENS[active];

  return (
    <div style={EBZ_VARS} className="flex min-h-screen bg-[var(--ebz-bg)] text-[var(--ebz-ink)]">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-[var(--ebz-navy)] text-white lg:flex">
        <div className="px-5 py-5">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--ebz-gold)] text-sm"
            >
              🧭
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              eff<span className="text-[var(--ebz-blue-2)]">.</span>bee
              <span className="text-[var(--ebz-blue-2)]">.</span>zee
            </span>
          </div>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ebz-blue-2)]">
            Your next opportunity
          </p>
        </div>

        <nav className="flex-1 px-3 pb-4">
          {VISION_NAV.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const on = item.key === active;
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => setActive(item.key)}
                        aria-current={on ? "page" : undefined}
                        className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                          on ? "bg-[var(--ebz-blue)] text-white" : "text-white/70 hover:bg-white/5"
                        }`}
                      >
                        <span aria-hidden="true" className="text-base">
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            {item.label}
                            {item.badge && (
                              <span className="rounded-full bg-[var(--ebz-blue-2)] px-1.5 text-[10px] font-bold text-white">
                                {item.badge}
                              </span>
                            )}
                          </span>
                          <span
                            className={`block truncate text-[11px] ${on ? "text-white/80" : "text-white/40"}`}
                          >
                            {item.sub}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-bold">
              DK
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{me.name}</p>
              <span className="rounded bg-[var(--ebz-blue)] px-1.5 py-0.5 text-[10px] font-bold uppercase">
                {me.level}
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-white/60">
              <span>Aktuelles Level</span>
              <span>{me.levelPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--ebz-blue-2)]"
                style={{ width: `${me.levelPct}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-[var(--ebz-line)] bg-[var(--ebz-card)]/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="hidden min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--ebz-line)] bg-[var(--ebz-bg)] px-4 py-2 text-sm text-[var(--ebz-muted)] sm:flex">
            <span aria-hidden="true">🔍</span>
            <span className="truncate">Suche nach Menschen, Organisationen, Chancen, …</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--ebz-ink)]">
              <span aria-hidden="true" className="text-[var(--ebz-gold)]">
                ★
              </span>
              {me.pointsTotal.toLocaleString("de-DE")}
              <span className="hidden font-medium text-[var(--ebz-muted)] sm:inline">
                Active Points
              </span>
            </span>
            <span aria-hidden="true" className="text-lg">
              🎁
            </span>
            <span aria-hidden="true" className="relative text-lg">
              🔔
              <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--ebz-blue)] text-[9px] font-bold text-white">
                3
              </span>
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--ebz-blue-soft)] text-sm font-bold text-[var(--ebz-blue)]">
              DK
            </span>
          </div>
        </header>

        {/* Vorschau-Banner (dauerhaft) */}
        <div className="flex items-center justify-center gap-2 bg-[#fbf1d8] px-4 py-1.5 text-center text-xs font-semibold text-[#8a6a12]">
          <span aria-hidden="true">🚧</span>
          Vorschau · in Entwicklung — die eff.bee.zee-Vision ist ein Ausblick, noch nicht live.
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          <Screen />
        </main>
      </div>
    </div>
  );
}
