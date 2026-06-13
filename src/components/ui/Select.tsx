import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-md border bg-canvas px-3 text-sm text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-soft disabled:cursor-not-allowed disabled:opacity-50",
        invalid
          ? "border-danger focus-visible:ring-danger"
          : "border-line focus-visible:border-gold focus-visible:ring-gold",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
