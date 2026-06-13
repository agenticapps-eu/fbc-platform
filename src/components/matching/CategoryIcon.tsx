import type { ReactNode } from "react";
import type { CategoryIconKey } from "../../config/matching";

/**
 * Schlanke Inline-SVG-Icons für die Such-/Biete-Kategorien (AGE-244). Bewusst
 * im Stil der übrigen lokalen Icons (24er-Viewbox, currentColor-Stroke), damit
 * sie den Schwarz-&-Gold-Look ohne zusätzliche Icon-Abhängigkeit treffen.
 */
const PATHS: Record<CategoryIconKey, ReactNode> = {
  coins: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  ),
  network: (
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="8" r="2.2" />
      <circle cx="10" cy="18" r="2.2" />
      <path d="M8 7l8 1M8.5 8l1.2 8M16 10l-5 6.2" />
    </>
  ),
  bulb: (
    <>
      <path d="M9.5 18h5M10.5 21h3" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.8.7 1 1.3 1 2.5h6c0-1.2.2-1.8 1-2.5A6 6 0 0 0 12 3z" />
    </>
  ),
  building: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1.2" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M10 21v-3.5h4V21" />
    </>
  ),
  shares: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12V4M12 12l6.5 3.8" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5.5A2 2 0 0 1 10 3.5h4a2 2 0 0 1 2 2V7M3 12.5h18" />
    </>
  ),
  mentor: (
    <>
      <path d="M12 4 2 9l10 5 10-5-10-5z" />
      <path d="M6 11v4c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 3c2.5 2 4 5 4 8 0 1.7-.6 3.2-1.4 4.4L12 18l-2.6-2.6C8.6 14.2 8 12.7 8 11c0-3 1.5-6 4-8z" />
      <circle cx="12" cy="10" r="1.2" />
      <path d="M9.4 16 7 18.4M14.6 16 17 18.4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" />
      <path d="M16 5.6a3 3 0 0 1 0 5.6M20.5 19.5c0-2.4-1.4-4.5-3.5-5.4" />
    </>
  ),
};

export function CategoryIcon({ icon, className }: { icon: CategoryIconKey; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[icon]}
    </svg>
  );
}
