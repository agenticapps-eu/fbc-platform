import { cn } from "../../lib/cn";

/** Basis-Skeleton — dezent pulsierende Platzhalterfläche. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-line/70", className)} />;
}

/** Skeleton in der Zielstruktur des „Mein Bereich"-Dashboards (Hero + Widget-Grid). */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite">
      <span className="sr-only">Dashboard wird geladen…</span>
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas shadow-soft">
        <Skeleton className="h-28 rounded-none sm:h-40" />
        <div className="px-6 pb-6 sm:px-8">
          <Skeleton className="-mt-12 h-24 w-24 rounded-full ring-4 ring-canvas sm:-mt-14 sm:h-28 sm:w-28" />
          <Skeleton className="mt-3 h-7 w-56" />
          <Skeleton className="mt-2 h-4 w-40" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-[var(--radius-card)]" />
        ))}
      </div>
    </div>
  );
}

/** Generisches Seiten-Skeleton (Profil, öffentliches Profil …). Der sr-only-Text
 *  meldet Screenreadern den Ladezustand und dient Tests als Mount-Beleg. */
export function PageSkeleton({ label = "Inhalt wird geladen…" }: { label?: string }) {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-40 rounded-[var(--radius-card)]" />
      <Skeleton className="h-40 rounded-[var(--radius-card)]" />
    </div>
  );
}
