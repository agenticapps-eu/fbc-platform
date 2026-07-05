import { useState } from "react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";
import { DashboardCard, DemoBadge, ProgressBar } from "./building-blocks";

// ── Demo-Daten (profile-spec §5: DEMO-Widgets, in Phase 2 durch echte Daten ersetzt) ──
const DEMO_STATS = [
  { label: "Neue Kontakte", value: 12, trend: "+4" },
  { label: "Profilaufrufe", value: 148, trend: "+22" },
  { label: "Nachrichten", value: 36, trend: "+9" },
  { label: "Match-Anfragen", value: 7, trend: "+2" },
  { label: "Event-Teilnahmen", value: 3, trend: "+1" },
];
const DEMO_PROJECTS = [
  { title: "Quartiersentwicklung Stuttgart-West", progress: 64 },
  { title: "FBC Impact Fonds I", progress: 38 },
];
const DEMO_INVESTMENTS = [
  { title: "Beteiligung TechVentures GmbH", perf: 18.4 },
  { title: "Immobilienportfolio Süd", perf: 6.1 },
  { title: "Green Energy SPV", perf: -2.3 },
];
const DEMO_KI_CHIPS = [
  "Wer passt zu meinem aktuellen Gesuch?",
  "Welche Events lohnen sich diese Woche?",
  "Zeig mir passende Mentoren",
];

// 8 ── Meine Statistik (30 Tage) (DEMO) ────────────────────────────────────────
function StatistikWidget() {
  return (
    <DashboardCard id="statistik" title="Meine Statistik (30 Tage)" demo>
      <ul className="flex flex-col gap-2.5">
        {DEMO_STATS.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">{s.label}</span>
            <span className="flex items-baseline gap-2">
              <span className="font-medium text-ink">{s.value}</span>
              <span className="text-xs font-medium text-positive">↑ {s.trend}</span>
            </span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

// 10 ── Meine Projekte (DEMO) ──────────────────────────────────────────────────
function ProjekteWidget() {
  return (
    <DashboardCard id="projekte" title="Meine Projekte" demo>
      <ul className="flex flex-col gap-3">
        {DEMO_PROJECTS.map((p) => (
          <li key={p.title}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-ink">{p.title}</span>
              <span className="shrink-0 text-muted">{p.progress}%</span>
            </div>
            <div className="mt-1.5">
              <ProgressBar value={p.progress} />
            </div>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

// 11 ── Meine Investments (DEMO) ───────────────────────────────────────────────
function InvestmentsWidget() {
  return (
    <DashboardCard id="investments" title="Meine Investments" demo>
      <ul className="flex flex-col gap-3">
        {DEMO_INVESTMENTS.map((inv) => (
          <li key={inv.title} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-ink">{inv.title}</span>
            <span
              className={cn(
                "shrink-0 font-medium",
                inv.perf >= 0 ? "text-positive" : "text-danger",
              )}
            >
              {inv.perf >= 0 ? "+" : ""}
              {inv.perf.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

// 15 ── FBC KI Assistent (DEMO / Platzhalter) ──────────────────────────────────
function KIAssistentWidget() {
  return (
    <DashboardCard id="ki" title="FBC KI Assistent" demo className="md:col-span-2">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-full border border-line bg-soft px-4 py-2.5">
          <input
            type="text"
            disabled
            placeholder="Frag den FBC Assistenten… (in Phase 1 noch ohne KI)"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted/70 focus:outline-none"
          />
          <Button variant="primary" size="sm" disabled>
            Senden
          </Button>
        </div>
        <ul className="flex flex-wrap gap-2">
          {DEMO_KI_CHIPS.map((chip) => (
            <li key={chip}>
              <span className="inline-flex cursor-default items-center rounded-full border border-line bg-canvas px-3 py-1 text-xs text-muted">
                {chip}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </DashboardCard>
  );
}

export function AktivitaetPortfolio() {
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between rounded-[var(--radius-card)] border border-line bg-soft px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          Aktivität &amp; Portfolio <DemoBadge />
        </span>
        <span aria-hidden className="text-muted">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <StatistikWidget />
          <ProjekteWidget />
          <InvestmentsWidget />
          <KIAssistentWidget />
        </div>
      )}
    </section>
  );
}
