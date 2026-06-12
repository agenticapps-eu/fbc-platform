import { cn } from "../../lib/cn";

/** Platzhalter-Logo bis echte Assets vorliegen: Smaragd-Monogramm „F" mit
 *  Gold-Querbalken, daneben der Wortmarke. */
export function Logo({
  withWordmark = true,
  className,
}: {
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        className="h-8 w-8"
        // Wortmarke benennt den Link; ohne sie trägt das SVG das Label.
        role={withWordmark ? undefined : "img"}
        aria-label={withWordmark ? undefined : "Fair Business Club"}
        aria-hidden={withWordmark || undefined}
      >
        <rect width="32" height="32" rx="8" fill="#0e5c4a" />
        <path d="M11 23V9h9" stroke="#efe3c8" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M11 16h6.5" stroke="#b8893b" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      {withWordmark && (
        <span className="text-base font-semibold tracking-tight text-ink">Fair Business Club</span>
      )}
    </span>
  );
}
