export interface FormatHeroMeta {
  title: string;
  claim: string;
  /** Selbst gehostetes Hero-Bild unter /images (AGE-499). Quelle und Lizenz in
   *  public/images/CREDITS.md. Fehlt es, trägt der Kopf nur Titel und Claim. */
  image?: string;
}

/** Seitenköpfe je Route. Jede Seite mit Menüeintrag hat ein eigenes Motiv —
 *  bewusst kein geteiltes Standardbild: der Kopf soll die Seite erkennbar
 *  machen, und ein wiederkehrendes Bild träte an die Stelle genau der
 *  Orientierung, die es geben soll.
 *
 *  Ausgenommen sind die Formularseiten (Login, Onboarding, Einstellungen,
 *  Profil-Editor): sie laufen in der schmalen Lesespalte, und ein Bildkopf über
 *  einem Formular ist Dekoration vor der Aufgabe. */
export const FORMAT_HERO: Record<string, FormatHeroMeta> = {
  "/compass": {
    title: "Kompass",
    claim: "Finde deine Richtung im Club.",
    image: "/images/hero-compass.webp",
  },
  "/academy": {
    title: "Academy",
    claim: "Lernen von den Besten.",
    image: "/images/hero-academy.webp",
  },
  "/events": {
    title: "Events",
    claim: "Triff den Club in echt.",
    image: "/images/hero-events.webp",
  },
  "/mitglieder": {
    title: "Mitglieder",
    claim: "Finde die Passenden.",
    image: "/images/hero-mitglieder.webp",
  },
  "/aktivitaet": {
    title: "Aktivität",
    claim: "Hier lebt der Club.",
    image: "/images/hero-aktivitaet.webp",
  },
  "/kontakte": {
    title: "Meine Kontakte",
    claim: "Deine Verbindungen im Club.",
    image: "/images/hero-kontakte.webp",
  },
  "/meine-kurse": {
    title: "Meine Kurse",
    claim: "Dein Lernpfad in der Academy.",
    // Bewusst dasselbe Motiv wie /academy: die Seite ist die persönliche Sicht
    // auf denselben Inhalt, ein fremdes Motiv würde eine zweite Welt suggerieren.
    image: "/images/hero-academy.webp",
  },
  "/mitgliedschaft": {
    title: "Mitgliedschaft",
    claim: "Deine Stufe und was sie öffnet.",
    image: "/images/hero-mitgliedschaft.webp",
  },
  "/meine-chancen": { title: "Meine Chancen", claim: "Suche trifft Biete." },
};
