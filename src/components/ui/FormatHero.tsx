import { cn } from "../../lib/cn";
import type { FormatHeroMeta } from "../../config/formatHero";

export function FormatHero({
  meta,
  imageUrl,
  className,
}: {
  meta: FormatHeroMeta;
  imageUrl?: string;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "relative mb-8 overflow-hidden rounded-[var(--radius-card)] border border-gold/25 px-6 py-10 shadow-soft",
        "bg-gradient-to-br from-night via-night/90 to-gold-strong/30",
        className,
      )}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
      )}
      <div className="relative">
        <h1 className="font-display text-3xl font-semibold text-on-night">{meta.title}</h1>
        <p className="mt-2 max-w-xl text-on-night/80">{meta.claim}</p>
      </div>
    </header>
  );
}
