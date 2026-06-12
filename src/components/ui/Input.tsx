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
        "h-11 w-full rounded-md border bg-white px-3 text-sm text-ink transition-colors placeholder:text-grey/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-warm disabled:cursor-not-allowed disabled:opacity-50",
        invalid
          ? "border-red-400 focus-visible:ring-red-400"
          : "border-ink/15 focus-visible:border-emerald focus-visible:ring-emerald",
        className,
      )}
      {...props}
    />
  );
});
