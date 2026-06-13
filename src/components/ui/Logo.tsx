import { cn } from "../../lib/cn";

/** Platzhalter-Logo bis echte Assets vorliegen: near-black Monogramm „F" mit
 *  Gold-Strich und Gold-Querbalken, daneben die Wortmarke.
 *  `tone="dark"` macht die Wortmarke hell — für die near-black Sidebar. */
export function Logo({
  withWordmark = true,
  tone = "light",
  className,
}: {
  withWordmark?: boolean;
  tone?: "light" | "dark";
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
        <rect width="32" height="32" rx="8" fill="#0e0f12" />
        <path d="M11 23V9h9" stroke="#c2a24e" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <path d="M11 16h6.5" stroke="#efe3c8" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      {withWordmark && (
        <span
          className={cn(
            "text-base font-semibold tracking-tight",
            tone === "dark" ? "text-on-night" : "text-ink",
          )}
        >
          Fair Business Club
        </span>
      )}
    </span>
  );
}
