/**
 * Client-Fixtures für den eff.bee.zee-Vision-Dummy. Rein statisch, KEIN Backend,
 * keine echten Daten — jeder Screen ist realistisch befüllt (keine Sackgassen).
 * Zahlen sind bewusst illustrativ (Vorschau-Badge macht das transparent).
 */

export const me = {
  name: "Detlev Krause",
  role: "Gründer & Netzwerker",
  level: "Connect",
  levelPct: 72,
  nextLevel: "Discover",
  pointsToNext: 450,
  pointsTotal: 2450,
  pointsWeek: 320,
  pointsMonth: 6780,
  pointsAllTime: 24560,
  streak: [true, true, true, true, true, true, false],
};

export interface ActiveTask {
  icon: string;
  title: string;
  desc: string;
  points: number;
  cta: string;
  faces: number;
}
export const activeTasks: ActiveTask[] = [
  {
    icon: "🍽️",
    title: "Restaurant bewerten",
    desc: "Teile deine Erfahrung und hilf anderen.",
    points: 30,
    cta: "Bewerten",
    faces: 3,
  },
  {
    icon: "👥",
    title: "Community bewerten",
    desc: "Bewerte eine Community, die du nutzt.",
    points: 15,
    cta: "Bewerten",
    faces: 3,
  },
  {
    icon: "🧭",
    title: "Profil vervollständigen",
    desc: "Ergänze dein Compass-Profil zu 100 %.",
    points: 20,
    cta: "Weiter",
    faces: 0,
  },
  {
    icon: "🥂",
    title: "Business Dinner besuchen",
    desc: "Nimm teil und vernetze dich vor Ort.",
    points: 80,
    cta: "Ansehen",
    faces: 3,
  },
  {
    icon: "🔳",
    title: "QR-Code scannen",
    desc: "Scanne einen Code bei einem Event.",
    points: 15,
    cta: "Scannen",
    faces: 0,
  },
  {
    icon: "🎯",
    title: "Neue Opportunity bewerten",
    desc: "Bewerte eine Opportunity, die zu dir passt.",
    points: 10,
    cta: "Bewerten",
    faces: 0,
  },
];

export const earnGrid = [
  { icon: "👥", label: "Menschen", points: 10 },
  { icon: "🏢", label: "Organisationen", points: 10 },
  { icon: "🌐", label: "Communities", points: 10 },
  { icon: "📅", label: "Events", points: 10 },
  { icon: "🎓", label: "Academy", points: 10 },
  { icon: "💻", label: "Website", points: 5 },
  { icon: "🎨", label: "Design", points: 5 },
  { icon: "♿", label: "Barrierefreiheit", points: 5 },
  { icon: "🎯", label: "Matchingqualität", points: 10 },
  { icon: "🧭", label: "Compass", points: 10 },
  { icon: "🎧", label: "Support", points: 10 },
  { icon: "🧠", label: "KI-Empfehlung", points: 5 },
];

export const ranking = [
  { rank: 1, name: "Anna-Lena Weber", points: 3240 },
  { rank: 2, name: "Michael Schmidt", points: 2980 },
  { rank: 3, name: "Sabine Müller", points: 2450 },
  { rank: 4, name: "Thomas Richter", points: 1980 },
  { rank: 5, name: "Julia Schneider", points: 1750 },
];

export const rewards = [
  { icon: "💶", label: "10 € Gutschein", cost: "ab 1.000 P" },
  { icon: "🎓", label: "Academy Kurs", cost: "ab 1.500 P" },
  { icon: "🎟️", label: "Event Ticket", cost: "ab 2.000 P" },
  { icon: "🌴", label: "Wellness-Wochenende", cost: "ab 5.000 P" },
];

export const prize = {
  title: "Wellness-Wochenende",
  sub: "Luxus & Entspannung pur.",
  deadline: "31.05.2026",
  lots: 3,
};

export const impact = [
  { icon: "✅", value: 128, label: "Bewertungen abgegeben" },
  { icon: "👥", value: 23, label: "Menschen unterstützt" },
  { icon: "🌐", value: 7, label: "Communities gestärkt" },
  { icon: "📅", value: 16, label: "Events bereichert" },
];

export const pointsHistory = [
  { label: "Diese Woche", value: "2.450 P" },
  { label: "Diesen Monat", value: "6.780 P" },
  { label: "Gesamt (aller Zeiten)", value: "24.560 P" },
];

export interface Person {
  name: string;
  role: string;
  company: string;
  region: string;
  mutual: number;
}
export const people: Person[] = [
  {
    name: "Anna Müller",
    role: "Marketing Strategin",
    company: "Nordlicht Media",
    region: "Hamburg",
    mutual: 12,
  },
  {
    name: "Aylin Demir",
    role: "Produktdesignerin",
    company: "Studio Kern",
    region: "Berlin",
    mutual: 8,
  },
  {
    name: "Beatrice Sommer",
    role: "Coach & Speakerin",
    company: "Sommer Consulting",
    region: "München",
    mutual: 5,
  },
  {
    name: "Jonas Fischer",
    role: "Immobilienentwickler",
    company: "Fischer Group",
    region: "Stuttgart",
    mutual: 9,
  },
  {
    name: "Clara Bauer",
    role: "Finanzberaterin",
    company: "Bauer Finanz",
    region: "Köln",
    mutual: 3,
  },
  { name: "David Richter", role: "CTO", company: "Helix Systems", region: "Leipzig", mutual: 6 },
];

export interface Opportunity {
  title: string;
  org: string;
  type: string;
  location: string;
  tags: string[];
}
export const opportunities: Opportunity[] = [
  {
    title: "Co-Investor für Impact-Fonds gesucht",
    org: "GreenBridge Capital",
    type: "Investment",
    location: "Remote",
    tags: ["Impact", "Finanzen"],
  },
  {
    title: "Design-Partner für B2B-SaaS",
    org: "Studio Kern",
    type: "Kooperation",
    location: "Berlin",
    tags: ["Design", "SaaS"],
  },
  {
    title: "Speaker für Nachhaltigkeits-Panel",
    org: "Zukunftsforum",
    type: "Bühne",
    location: "München",
    tags: ["Speaking", "Nachhaltigkeit"],
  },
  {
    title: "Mentor:in für Gründerkohorte",
    org: "Starthub Süd",
    type: "Mentoring",
    location: "Stuttgart",
    tags: ["Mentoring"],
  },
];

export const communities = [
  { name: "Impact Founders", members: 1240, topic: "Nachhaltiges Unternehmertum" },
  { name: "Women in Tech DE", members: 3180, topic: "Tech & Leadership" },
  { name: "Real Estate Circle", members: 860, topic: "Immobilien & Investment" },
  { name: "Creative Studios", members: 540, topic: "Design & Marke" },
];

export const organisations = [
  { name: "Nordlicht Media", industry: "Marketing", size: "45 Mitarbeitende", region: "Hamburg" },
  { name: "Fischer Group", industry: "Immobilien", size: "120 Mitarbeitende", region: "Stuttgart" },
  { name: "Helix Systems", industry: "Software", size: "80 Mitarbeitende", region: "Leipzig" },
  {
    name: "GreenBridge Capital",
    industry: "Finanzen",
    size: "30 Mitarbeitende",
    region: "Frankfurt",
  },
];

export const events = [
  {
    title: "Business Dinner München",
    date: "Heute · 18:00",
    location: "Hotel Polisina",
    type: "Dinner",
  },
  {
    title: "Impact Investing Meetup",
    date: "24. Juli · 17:30",
    location: "Berlin",
    type: "Meetup",
  },
  { title: "Sommerfest 2026", date: "12. Aug · 16:00", location: "Ochsenfurt", type: "Fest" },
  { title: "Founder Breakfast", date: "3. Sep · 08:30", location: "Hamburg", type: "Frühstück" },
];

export const academy = [
  { title: "Netzwerken mit Wirkung", lessons: 8, level: "Einsteiger", duration: "2 Std" },
  { title: "Compass richtig nutzen", lessons: 5, level: "Einsteiger", duration: "1 Std" },
  { title: "Verhandeln auf Augenhöhe", lessons: 12, level: "Fortgeschritten", duration: "3 Std" },
  { title: "Impact messbar machen", lessons: 6, level: "Fortgeschritten", duration: "2 Std" },
];

export const matchings = [
  {
    name: "Anna Müller",
    role: "Marketing Strategin",
    score: 94,
    reason: "Sucht Design-Partner · du bietest Studio-Kapazität",
  },
  {
    name: "Jonas Fischer",
    role: "Immobilienentwickler",
    score: 88,
    reason: "Gemeinsames Thema: Impact-Investment",
  },
  {
    name: "David Richter",
    role: "CTO",
    score: 81,
    reason: "Ergänzende Kompetenzen (Produkt × Technik)",
  },
];

export const myActivities = [
  { when: "vor 2 Std", text: "Du hast „Nordlicht Media“ bewertet.", points: 10 },
  { when: "gestern", text: "Du hast am Business Dinner teilgenommen.", points: 80 },
  { when: "vor 3 Tagen", text: "Du hast dein Compass-Profil ergänzt.", points: 20 },
  { when: "vor 5 Tagen", text: "Du hast Aylin Demir als Kontakt hinzugefügt.", points: 0 },
];

export const messages = [
  {
    name: "Anna Müller",
    preview: "Danke für die Empfehlung! Lass uns nächste…",
    when: "10:24",
    unread: true,
  },
  {
    name: "Starthub Süd",
    preview: "Deine Bewerbung als Mentor:in ist eingegangen.",
    when: "09:02",
    unread: true,
  },
  {
    name: "Jonas Fischer",
    preview: "Passt Donnerstag für einen Call?",
    when: "Gestern",
    unread: false,
  },
  {
    name: "Community: Impact Founders",
    preview: "Neuer Beitrag im Kanal #intro.",
    when: "Gestern",
    unread: false,
  },
];

export const saved = [
  { type: "Opportunity", title: "Co-Investor für Impact-Fonds", sub: "GreenBridge Capital" },
  { type: "Person", title: "Beatrice Sommer", sub: "Coach & Speakerin" },
  { type: "Event", title: "Sommerfest 2026", sub: "12. Aug · Ochsenfurt" },
  { type: "Academy", title: "Verhandeln auf Augenhöhe", sub: "12 Lektionen" },
];

export const network = [
  { label: "Verbindungen", value: 342 },
  { label: "Follower", value: 1280 },
  { label: "Offene Einladungen", value: 6 },
];

export const playbook = [
  {
    title: "Dein erstes gutes Matching",
    sub: "In 5 Schritten zur passenden Verbindung.",
    read: "4 Min",
  },
  {
    title: "ActivePoints clever sammeln",
    sub: "Welche Aktionen sich wirklich lohnen.",
    read: "3 Min",
  },
  { title: "Communities, die tragen", sub: "So findest du deinen Kreis.", read: "6 Min" },
  { title: "Impact sichtbar machen", sub: "Wirkung dokumentieren und teilen.", read: "5 Min" },
];

export const helpTopics = [
  "Wie funktionieren ActivePoints?",
  "Wie ändere ich meine Sichtbarkeit?",
  "Wie werte ich eine Organisation?",
  "Wie löse ich Punkte gegen Prämien ein?",
  "Wie melde ich einen Fehler?",
];

export const settingsSections = [
  { title: "Profil", desc: "Name, Foto, Kurzbeschreibung." },
  { title: "Sicherheit", desc: "Passwort, Zwei-Faktor, Sitzungen." },
  { title: "Benachrichtigungen", desc: "E-Mail, Push, Zusammenfassungen." },
  { title: "Sichtbarkeit", desc: "Wer sieht dein Profil und deine Aktivität." },
  { title: "Konto", desc: "Plan, Daten-Export, Konto löschen." },
];

export const levelPerks = [
  { level: "Basic", perk: "Profil & Entdecken", done: true },
  { level: "Connect", perk: "Matchings & Favoriten", done: true },
  { level: "Discover", perk: "Volles Verzeichnis & Academy", done: false },
  { level: "Exchange", perk: "Events & Kontaktanfragen", done: false },
];
