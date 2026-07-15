export interface FormatHeroMeta {
  title: string;
  claim: string;
}

export const FORMAT_HERO: Record<string, FormatHeroMeta> = {
  "/compass": { title: "Kompass", claim: "Finde deine Richtung im Club." },
  "/library": { title: "Library", claim: "Wissen, das Mitglieder teilen." },
  "/academy": { title: "Academy", claim: "Lernen von den Besten." },
  "/events": { title: "Events", claim: "Triff den Club in echt." },
  "/mitglieder": { title: "Mitglieder", claim: "Finde die Passenden." },
  "/aktivitaet": { title: "Aktivität", claim: "Hier lebt der Club." },
  "/community": { title: "Community", claim: "Das Netzwerk, das fair handelt." },
  "/meine-chancen": { title: "Meine Chancen", claim: "Suche trifft Biete." },
  "/projekte": { title: "Projekte", claim: "Gemeinsam etwas bauen." },
};
