export interface FormatHeroMeta {
  title: string;
  claim: string;
  icon: "compass" | "library" | "academy" | "events" | "community" | "matching" | "projekte";
}

export const FORMAT_HERO: Record<string, FormatHeroMeta> = {
  "/compass": { title: "Kompass", claim: "Finde deine Richtung im Club.", icon: "compass" },
  "/library": { title: "Library", claim: "Wissen, das Mitglieder teilen.", icon: "library" },
  "/academy": { title: "Academy", claim: "Lernen von den Besten.", icon: "academy" },
  "/events": { title: "Events", claim: "Triff den Club in echt.", icon: "events" },
  "/community": { title: "Community", claim: "Das Netzwerk, das fair handelt.", icon: "community" },
  "/matching": { title: "Matching", claim: "Suche trifft Biete.", icon: "matching" },
  "/projekte": { title: "Projekte", claim: "Gemeinsam etwas bauen.", icon: "projekte" },
};
