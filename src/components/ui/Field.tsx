import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** Render-Prop: bekommt die generierte id + invalid-Flag fürs Steuerelement. */
  children: (props: { id: string; invalid: boolean }) => ReactNode;
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const invalid = Boolean(error);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-gold-dark">*</span>}
      </label>
      {children({ id, invalid })}
      {error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : hint ? (
        <p className="text-xs text-grey">{hint}</p>
      ) : null}
    </div>
  );
}
