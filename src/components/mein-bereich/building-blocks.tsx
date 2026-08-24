import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { Card, CardTitle } from "../ui/Card";
import { Icon } from "../ui/icons";

export const dateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
export const monthFmt = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });

export function formatDate(value: string | null, fmt: Intl.DateTimeFormat): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : fmt.format(d);
}

export function DemoBadge() {
  return (
    <span
      className="inline-flex items-center rounded-full bg-accent-soft/60 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-accent-strong uppercase"
      title="Demo-Daten — wird in Phase 2 mit echten Daten gefüllt."
    >
      Demo
    </span>
  );
}

export function DashboardCard({
  id,
  title,
  demo,
  action,
  className,
  children,
}: {
  id?: string;
  title: string;
  demo?: boolean;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} className={cn("flex scroll-mt-24 flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {demo && <DemoBadge />}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-xs font-medium text-accent-strong hover:text-accent">
      {children}
    </Link>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

export function CrownIcon({ className }: { className?: string }) {
  return <Icon name="crown" className={className} />;
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  trend,
  demo,
}: {
  label: string;
  value: number;
  trend?: string;
  demo?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-soft px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        {label}
        {demo && <DemoBadge />}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold text-ink">{value}</span>
        {trend && <span className="text-xs font-medium text-positive">↑ {trend}</span>}
      </div>
    </div>
  );
}
