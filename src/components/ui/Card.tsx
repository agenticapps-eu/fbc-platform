import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Card({
  className,
  padded = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div
      className={cn(
        "fbc-card rounded-[var(--radius-card)] border border-line bg-canvas shadow-soft",
        padded && "p-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-muted", className)} {...props} />;
}
