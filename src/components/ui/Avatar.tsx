import { cn } from "../../lib/cn";

type AvatarSize = "sm" | "md" | "lg";

const sizes: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
  /** Verbirgt Identität (Bild und Initialen) hinter einem generischen Personen-Icon. */
  masked?: boolean;
}

export function Avatar({ name, src, size = "md", className, masked }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold-soft font-semibold text-gold-strong select-none",
        sizes[size],
        className,
      )}
    >
      {masked ? (
        <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 text-gold-strong/60" aria-hidden="true">
          <circle cx="12" cy="8" r="3.2" fill="currentColor" />
          <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" fill="currentColor" />
        </svg>
      ) : src ? (
        <img src={src} alt={name} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
