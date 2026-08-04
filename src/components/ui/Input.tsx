import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-md border bg-canvas px-3 text-sm text-ink transition-colors placeholder:text-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-soft disabled:cursor-not-allowed disabled:opacity-50",
        invalid
          ? "border-danger focus-visible:ring-danger"
          : "border-line focus-visible:border-accent focus-visible:ring-accent",
        className,
      )}
      {...props}
    />
  );
});
