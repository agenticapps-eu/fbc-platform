/** Klein gehaltene className-Verkettung (truthy join) — vermeidet eine
 *  zusätzliche Abhängigkeit (clsx/tailwind-merge) für unsere Komponenten. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
