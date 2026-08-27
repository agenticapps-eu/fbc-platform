import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import AppFooter from "./AppFooter";
import { cn } from "../lib/cn";
import { navItems, type NavSection } from "../config/nav";
import {
  ANFRAGEN_STALE_TIME_MS,
  fetchIncomingRequests,
  incomingRequestsQueryKey,
} from "../lib/contact-requests";
import { useAuth } from "../providers/auth-context";
import { ChatPanel } from "./chat/ChatPanel";
import { useUngelesen, useUngelesenLive } from "./chat/use-ungelesen";
import { HinweisGlocke } from "./hinweise/HinweisGlocke";
import { useHinweise, useHinweiseLive, useHinweisMarkieren } from "./hinweise/use-hinweise";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { FeedbackButton } from "./feedback/FeedbackButton";
import HeaderSearch from "./search/HeaderSearch";
import { RouteTransition } from "./ui/Motion";
import { Logo } from "./ui/Logo";
import { SidebarNav, type SidebarNavSection } from "./ui/SidebarNav";
import { TierBadge } from "./ui/TierBadge";
import { useOverlay } from "./ui/useOverlay";
import { Icon } from "./ui/icons";
import { LeistenPill } from "./LeistenPill";

// Bis AGE-499 war es umgekehrt: alles wurde auf 720 px gekappt, außer einer
// Liste breiter Routen. Das hat die Fläche verschenkt — `MemberDashboard` trägt
// `lg:grid-cols-3` und `xl:grid-cols-4`, und beide Breakpoints konnten in einer
// 720-px-Spalte nie greifen. Jetzt nutzt jede Seite die Breite, und nur die
// echten Lesespalten (Formulare, Fließtext) behalten einen Deckel.
const NARROW_ROUTES = ["/login", "/onboarding", "/einstellungen", "/profil/bearbeiten"];

// Sidebar-Oberfläche: jetzt token-getrieben über var(--sidebar-surface) (Klasse
// .fbc-sidebar-surface). Wert wird je Design-Variante in index.css gesetzt —
// Fläche kommt aus --sidebar-surface, je Theme. Von aside + Drawer geteilt.
const SIDEBAR_SURFACE = "fbc-sidebar-surface";

/** Breite der angedockten Sidebar, offen und eingeklappt. Wird als CSS-Variable
 *  gesetzt, weil aside-Breite und Inhalts-Versatz denselben Wert brauchen —
 *  zwei Tailwind-Klassen, die man synchron halten muss, laufen auseinander. */
const SIDEBAR_W_OPEN = "16rem";
const SIDEBAR_W_RAIL = "4.5rem";

/** Merkt sich die eingeklappte Sidebar über Reloads hinweg — sie ist eine
 *  Arbeitsplatz-Einstellung, keine Kontoeinstellung, und bleibt daher (anders als
 *  das Theme, AGE-492) bewusst gerätelokal. */
const SIDEBAR_COLLAPSED_KEY = "fbc.sidebarCollapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Breite der angedockten Nachrichten-Leiste, offen und eingeklappt (AGE-627).
 *
 *  18rem und nicht 20rem, und angedockt erst ab `xl` — beides ist gemessen, nicht
 *  gewählt. Die Inhaltsspalte trägt bei 1024 px ohne diese Leiste 753 px, und die
 *  Raster des Hauses (`sm:grid-cols-2 lg:grid-cols-3`) hängen am VIEWPORT, nicht
 *  an der Spalte: sie bleiben dreispaltig, während die Spalte schrumpft. Mit
 *  20rem angedockt ab `lg` blieben bei 1024 px noch 433 px, und im Verzeichnis
 *  standen Namen auf EIN Zeichen gekürzt — im Bild nachgesehen, nicht vermutet.
 *  Ab `xl` mit 18rem sind es 721 px, also praktisch die Dichte, die die Anwendung
 *  bei 1024 px ohnehin ausliefert. */
const CHAT_W_OPEN = "18rem";
const CHAT_W_RAIL = "4.5rem";

/** EIGENER Schlüssel, getrennt von `fbc.sidebarCollapsed`. Die beiden Leisten
 *  merken sich unabhängig voneinander, was sie sind — eine gemeinsame
 *  Einstellung hiesse, dass das Einklappen der Navigation die Nachrichten
 *  mitnimmt, und das hat nie jemand verlangt. */
const CHAT_COLLAPSED_KEY = "fbc.chatCollapsed";

/** Der Umbruchpunkt der Nachrichten-Leiste — `xl`, nicht `lg`. Er steht als
 *  Zeichenkette hier, weil ihn zwei Stellen brauchen: die Zustandsgrösse
 *  `istBreit` und der Effect, der die Schublade beim Sprung schliesst. */
const CHAT_MQ = "(min-width: 1280px)";

/** Startwert EINGEKLAPPT, anders als links. Die Leiste holt im offenen Zustand
 *  eine Seite Threads; niemand soll dafür bezahlen, bevor er sie aufgemacht
 *  hat. Wer sie aufklappt, findet sie beim nächsten Mal offen vor. */
function readChatCollapsed(): boolean {
  try {
    return localStorage.getItem(CHAT_COLLAPSED_KEY) !== "0";
  } catch {
    return true;
  }
}

function ChevronLeftIcon({ flipped }: { flipped: boolean }) {
  return (
    <Icon
      name="chevronLeft"
      className={cn("h-4 w-4 transition-transform", flipped && "rotate-180")}
    />
  );
}

/**
 * Einstieg zu den Nachrichten (AGE-583). Ein Link, kein Knopf — er führt an
 * einen Ort, und ein Ort gehört in die Adresszeile und ins Kontextmenü.
 *
 * DREI AUSGÄNGE, nicht zwei — dasselbe Muster wie `useOffeneAnfragen`:
 *  - ungelesen        → Sprechblase mit Zahl,
 *  - Abruf gescheitert → Sprechblase mit „!", als unbekannt gekennzeichnet,
 *  - nichts ungelesen  → Sprechblase OHNE alles.
 *
 * Die Blase bleibt in allen drei Fällen. Verschwände sie bei null, wäre der Weg
 * zu den Nachrichten wieder unauffindbar — und genau das ist der Befund, gegen
 * den dieser Change gebaut ist. Anders als der Sidebar-Eintrag für Anfragen, der
 * ein VORGANG ist und mit ihm verschwinden darf, ist dies eine FLÄCHE.
 *
 * Die Zahl steht im zugänglichen Namen, nicht nur in der Blase: Farbe trägt in
 * diesem Projekt nie allein eine Bedeutung, und eine Ziffer ohne Gegenstand ist
 * für einen Screenreader nichts.
 */
function NachrichtenEinstieg({ anzahl, unbekannt }: { anzahl: number; unbekannt: boolean }) {
  const name = unbekannt
    ? "Nachrichten — Anzahl konnte nicht geladen werden"
    : anzahl > 0
      ? `Nachrichten, ${anzahl} ungelesen`
      : "Nachrichten";
  const blase = unbekannt ? "!" : anzahl > 0 ? String(anzahl) : null;

  return (
    <Link
      to="/chat"
      aria-label={name}
      className="relative rounded-full p-2 text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Icon name="messages" className="h-5 w-5" />
      {blase !== null && (
        // `aria-hidden`, weil die Zahl schon im Namen des Links steht — sonst
        // liest ein Screenreader sie zweimal.
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 min-w-[1.125rem] rounded-full bg-accent px-1 text-center text-[0.6875rem] font-semibold leading-[1.125rem] text-canvas"
        >
          {blase}
        </span>
      )}
    </Link>
  );
}

function MenuIcon() {
  return <Icon name="menu" className="h-5 w-5" />;
}

function ChevronDownIcon() {
  return <Icon name="chevronDown" className="hidden h-4 w-4 text-muted sm:block" />;
}

/** Profil-Menü hinter dem Avatar (E-Mail, Stufe, Links, Logout) — klappt per Klick
 *  auf das Profilbild auf; schließt über Außenklick und Escape. */
function UserMenu({
  email,
  tier,
  onSignOut,
}: {
  email: string;
  tier: string | null;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profilmenü"
        className="flex items-center gap-1.5 rounded-full p-1 transition-colors hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
      >
        <Avatar name={email} size="sm" />
        <ChevronDownIcon />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas py-1 shadow-soft"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-medium text-ink">{email}</p>
            {tier && (
              <span className="mt-1.5 inline-block">
                <TierBadge tier={tier} />
              </span>
            )}
          </div>
          <Link
            to="/profil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            Mein Bereich
          </Link>
          <Link
            to="/profil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            Profil
          </Link>
          {/* Nur, wem Preise etwas sagen (AGE-633). Jedes aus WordPress
              übernommene Mitglied liegt auf `impact` und hat damit die höchste
              Stufe bereits — für diesen Kreis führte der Eintrag zu vier
              zahlenden Stufen, von denen keine gilt. Die Seite selbst bleibt
              erreichbar; sie zeigt dort nur die eigene Mitgliedschaft. */}
          {tier !== "impact" && (
            <Link
              to="/mitgliedschaft"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink"
            >
              Mitgliedschaft
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="block w-full px-4 py-2 text-left text-sm font-medium text-danger transition-colors hover:bg-danger/[0.06]"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

/** Reihenfolge und Titel der Sidebar-Abschnitte (Spec §2). `sub` erscheint nie. */
const SIDEBAR_SECTIONS: Array<{ section: NavSection; title?: string; klappbar?: boolean }> = [
  // AGE-293: „Entdecken" ist ersatzlos entfallen. Über der Hauptnavigation sagt
  // die Überschrift nichts, was die fünf Einträge darunter nicht selbst sagen —
  // sie kostete eine Zeile Höhe und trug keine Information.
  { section: "entdecken" },
  // AGE-292 + AGE-293 in einer Zeile: der persönliche Bereich wird ein
  // Inline-Akkordeon. Damit ist seine Überschrift kein totes Label mehr,
  // sondern der Griff — das eine Anliegen erledigt das andere.
  { section: "mein-bereich", title: "Mein Bereich", klappbar: true },
  // AGE-494: „Service" ist entfallen. Mitgliedschaft fällt aus dem Menü,
  // Einstellungen steht jetzt unter „Mein Bereich" — bliebe die Zeile hier,
  // rendert die Sidebar eine Überschrift ohne einen einzigen Eintrag darunter.
];

/**
 * Der Navigationseintrag für offene eingehende Kontaktanfragen, oder `null`
 * (AGE-592).
 *
 * Liest die Anfragen unter DEMSELBEN `queryKey` wie `MeineAnfragenWidget`.
 * React Query teilt den Eintrag, es entsteht eine Ladung statt zweier, und die
 * Zahl im Menü kann nicht von der Liste auf `/kontakte` abweichen. Eine schlanke
 * `count`-RPC wäre die zweite Wahrheit über denselben Bestand gewesen — genau
 * das Muster, das hier schon einmal dazu führte, dass eine Zahl und eine Liste
 * verschiedene Dinge behaupteten.
 *
 * DREI Ausgänge, nicht zwei:
 *  - offene Anfragen  → Eintrag mit ihrer Anzahl,
 *  - Abruf gescheitert → Eintrag OHNE Zahl, als unbekannt gekennzeichnet,
 *  - nichts offen / ausgeloggt / lädt → kein Eintrag.
 *
 * Der mittlere ist der Grund, warum es diesen Kommentar gibt. Verschwände der
 * Eintrag bei einem gescheiterten Abruf, wäre „Abruf kaputt" von „nichts da"
 * nicht zu unterscheiden — der Weg zu einer wartenden Anfrage wäre selbst der
 * stille Fehlschlag, gegen den dieser ganze Change gebaut ist. Also fail LOUD,
 * und in die sichere Richtung: Ein Eintrag zu viel kostet eine Zeile im Menü,
 * ein Eintrag zu wenig kostet die Anfrage.
 */
function useOffeneAnfragen(uid: string | null): SidebarNavSection["items"][number] | null {
  const { data, isError } = useQuery({
    // Der leere Schlüssel wird nie abgefragt (`enabled` unten) — er existiert
    // nur, weil useQuery einen braucht, bevor die Kennung feststeht.
    queryKey: incomingRequestsQueryKey(uid ?? ""),
    queryFn: () => fetchIncomingRequests(uid as string),
    enabled: !!uid,
    staleTime: ANFRAGEN_STALE_TIME_MS,
  });

  if (!uid) return null;
  if (isError) {
    return {
      path: "/kontakte",
      label: "Meine Anfragen",
      abzeichen: { text: "!", label: "konnte nicht geladen werden" },
    };
  }
  const offene = data?.length ?? 0;
  if (offene === 0) return null;
  return {
    path: "/kontakte",
    label: "Meine Anfragen",
    abzeichen: { text: String(offene), label: `${offene} offen` },
  };
}

/** Sidebar-Inhalt — geteilt von angedockter Desktop-Sidebar und Off-Canvas-Drawer.
 *  Reine Navigation: die Abschnitte aus `navItems`, für Admins ein eigener dazu. */
function SidebarContent({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { user, staffRole } = useAuth();
  const anfragen = useOffeneAnfragen(user?.id ?? null);
  // Alle Mitglieder sehen dieselbe Navigation (Spec §1) — Rechte gaten die Inhalte
  // (MembershipGate), nicht das Menü. Anon sieht nur „Entdecken": „Meine Kontakte"
  // ohne Konto wäre ein Versprechen ins Leere.
  // Der Abschnitts-SCHLÜSSEL wird mitgeführt, nicht nur der Titel: gefunden wird
  // der persönliche Bereich weiter unten über ihn. Vorher stand dort
  // `s.title === "Mein Bereich"` — eine Suche über die BESCHRIFTUNG, deren
  // Fehlschlag ein `?.` verschluckt. Seit AGE-293 die Titel anfasst, wäre der
  // Eintrag „Meine Anfragen" bei der nächsten Umbenennung lautlos verschwunden,
  // ohne dass eine Zusage darauf zeigte.
  const abschnitte = SIDEBAR_SECTIONS.filter(({ section }) => user || section === "entdecken").map(
    ({ section, title, klappbar }) => ({
      section,
      title,
      klappbar,
      items: navItems
        .filter((i) => i.section === section)
        .map((i) => ({ path: i.path, label: i.label })),
    }),
  );
  const sections: SidebarNavSection[] = abschnitte;
  // AGE-592: Der Weg zu einer offenen eingehenden Anfrage. Er hängt an einem
  // VORGANG, nicht an einem Ort — deshalb steht er nicht in `navItems`, sondern
  // wird hier angehängt, solange es etwas zu entscheiden gibt. `/kontakte`
  // bleibt `section: "sub"`; die Route ändert sich nicht.
  //
  // Warum bedingt und nicht dauerhaft: Ein ständiger Eintrag wäre genau der
  // Kontakte-Menüpunkt, den AGE-494 entfernt hat („Kontakte erreicht man über
  // das Profil und den Chat"). Für einen bestehenden KONTAKT stimmt das; für
  // eine noch OFFENE Anfrage nicht — der Chat wird erst nach der Annahme
  // freigeschaltet, und die Profilseite des Absenders hilft nur, wenn man sie
  // gezielt aufruft, also schon von der Anfrage weiß. Genau diesen Fall traf
  // AGE-494 nicht, und nur für ihn kommt der Eintrag.
  if (anfragen) {
    const meinBereich = abschnitte.find((s) => s.section === "mein-bereich");
    // Vor „Einstellungen", damit die Kontoverwaltung den Abschnitt beschließt.
    const vor = meinBereich?.items.findIndex((i) => i.path === "/einstellungen") ?? -1;
    meinBereich?.items.splice(vor < 0 ? meinBereich.items.length : vor, 0, anfragen);
  }
  // Admin-Bereich: eigener, nur für `admin` sichtbarer Abschnitt (AGE-455). Bewusst
  // KEIN navItem — /admin wird in App.tsx über RequireAdmin geroutet, nicht über die
  // navItems-Schleife.
  if (staffRole === "admin") {
    sections.push({
      title: "Administration",
      // Aus demselben Grund klappbar wie „Mein Bereich" (AGE-292/293): drei
      // Einträge, die ein Admin selten braucht, unter einer Überschrift, die
      // sonst nur dasteht.
      klappbar: true,
      items: [
        { path: "/admin", label: "Administration" },
        // AGE-566: Die Mitgliederliste braucht einen Eintrag, weil sie sonst nur
        // per URL erreichbar wäre — und sie ist der EINZIGE Ort, an dem die
        // importierten, noch unbestätigten Mitglieder überhaupt vorkommen.
        { path: "/admin/mitglieder", label: "Mitglieder" },
        // AGE-587: Dasselbe Argument wie eine Zeile höher. Als Karte auf
        // /admin brauchte das QM-Feedback keinen eigenen Eintrag; als eigene
        // Fläche wäre es ohne ihn nur per Adresszeile erreichbar — und ein Menü,
        // das eine seiner Flächen auslässt, täuscht über den Umfang der
        // Verwaltung.
        //
        // NICHT im Menü steht /admin/mitglied/:id: eine Route mit Parameter
        // lässt sich ohne ihren Parameter gar nicht öffnen. Sie wird aus der
        // Mitgliederliste erreicht.
        { path: "/admin/feedback", label: "QM-Feedback" },
        // AGE-631: dasselbe Argument wie zwei Zeilen hoeher. Und die Spec sagt
        // es ausdruecklich — „Das Administrationsmenue traegt seine Flaechen
        // vollstaendig": eine Flaeche, die nur ueber die getippte Adresse
        // erreichbar ist, ist nicht auffindbar.
        { path: "/admin/neuigkeiten", label: "Neuigkeiten" },
      ],
    });
  }
  return (
    <div className={cn("flex flex-col", collapsed ? "gap-4" : "gap-7")}>
      {/* Über der Navigation steht nichts — weder ein- noch ausgeloggt.
          AGE-499 hat den „Anmelden"-Block für Gäste entfernt, weil er dieselbe
          Aufforderung ein zweites Mal war (der Weg steht in der Topbar).
          AGE-494 zieht dieselbe Regel für den eingeloggten Fall nach: das
          Mitglied stand hier ein drittes Mal auf demselben Bildschirm — neben
          dem Avatar in der Topbar und der E-Mail samt Stufe im aufgeklappten
          Profilmenü —, und zwar mit der ROHEN E-MAIL statt seines Namens,
          obwohl der im Profil steht. Identität lebt in der Topbar, die Sidebar
          navigiert. „Mein Profil" ist als Menüeintrag ohnehin da. */}
      <SidebarNav sections={sections} onNavigate={onNavigate} collapsed={collapsed} />
    </div>
  );
}

export default function AppShell() {
  const { user, tier, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Ungelesen-Zähler (AGE-583). Das Live-Abo hängt an GENAU DIESER Stelle: die
  // Hülle steht auf jeder angemeldeten Seite, und jede weitere Aufrufstelle
  // würde einen zweiten Kanal öffnen.
  const { stand: ungelesen, isError: ungelesenFehlt } = useUngelesen(user?.id ?? null);
  useUngelesenLive(user?.id ?? null, pathname);

  // Die Glocke (AGE-620). Sie war seit Juni ein toter Knopf, waehrend drei
  // Typen laengst in `notifications` schrieben.
  const { hinweise, isError: hinweiseFehlen } = useHinweise(user?.id ?? null);
  const { markiere, markiereAlle } = useHinweisMarkieren(user?.id ?? null);
  useHinweiseLive(user?.id ?? null);
  // Exakter Pfad-Vergleich: /profil (Bento) nutzt die Breite, /profil/bearbeiten
  // (Editor) bleibt eine Lesespalte.
  const isNarrow = NARROW_ROUTES.includes(pathname);

  // Off-Canvas-Sidebar (< lg). Schließt über Backdrop, `onNavigate` an jedem Link
  // und Escape. (setState im Event-Callback, nicht im Effect-Body.)
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      // Privater Modus o. Ä. — die Leiste funktioniert, sie merkt sich nur nichts.
    }
  }, [collapsed]);

  // ── Die Nachrichten-Leiste rechts (AGE-627) ───────────────────────────────
  //
  // Sie steht NICHT auf den Chatrouten: dort ist die Liste schon die Seite, und
  // eine zweite Kopie nähme der Konversation die Breite, für die sie da ist.
  // Und sie steht nicht für einen Gast: der Rahmen wird ihm auch gerendert, und
  // ein Einstieg in eine Fähigkeit, die er nicht hat, ist ein Versprechen ins
  // Leere.
  const aufChatRoute = pathname === "/chat" || pathname.startsWith("/chat/");
  const chatLeisteSteht = Boolean(user) && !aufChatRoute;

  const [chatCollapsed, setChatCollapsed] = useState(readChatCollapsed);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_COLLAPSED_KEY, chatCollapsed ? "1" : "0");
    } catch {
      // Wie links: die Leiste funktioniert, sie merkt sich nur nichts.
    }
  }, [chatCollapsed]);

  // Die angedockte Leiste liegt unter `lg` per CSS verborgen, ist aber montiert.
  // Ohne diese Zustandsgrösse holte sie dort eine Seite Threads, die niemand zu
  // sehen bekommt — CSS verbirgt, es hält keine Abfrage an.
  // `xl`, nicht `lg` — siehe die Begründung an CHAT_W_OPEN. Der Startwert liest
  // DIESELBE Abfrage wie der Effect unten: stünde hier eine andere, montierte
  // der erste Anstrich das Panel und holte eine Seite Threads, bevor der Effect
  // es zurücknimmt. Genau das ist beim Umbau passiert und nur aufgefallen, weil
  // ein Test die Breite 1152 stellt.
  const [istBreit, setIstBreit] = useState(() => window.matchMedia(CHAT_MQ).matches);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  // Ab `lg` verschwindet die Schublade NUR per CSS (`lg:hidden`) — der Zustand
  // bliebe offen. Solange das bloß eine unsichtbare Schublade war, fiel es
  // niemandem auf; mit der Scroll-Sperre daran (AGE-529) wäre die Seite danach
  // DAUERHAFT gesperrt, ohne sichtbaren Grund. Also hier schließen.
  useEffect(() => {
    if (!chatDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChatDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [chatDrawerOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const auf = () => {
      if (mq.matches) setMobileNavOpen(false);
    };
    auf();
    mq.addEventListener("change", auf);
    return () => mq.removeEventListener("change", auf);
  }, []);

  // Eigener Umbruchpunkt für die Nachrichten-Leiste. Dieselbe Behandlung wie
  // links, und aus demselben Grund: ab `xl` verschwindet die Schublade NUR per
  // CSS, der Zustand bliebe offen — samt Scroll-Sperre, und die Seite wäre
  // danach dauerhaft gesperrt, ohne sichtbaren Grund.
  useEffect(() => {
    const mq = window.matchMedia(CHAT_MQ);
    const auf = () => {
      setIstBreit(mq.matches);
      if (mq.matches) setChatDrawerOpen(false);
    };
    auf();
    mq.addEventListener("change", auf);
    return () => mq.removeEventListener("change", auf);
  }, []);

  // Off-Canvas-Navigation: das vierte Overlay — im Issue-Tisch fehlte es, und es
  // ist das einzige, das auf JEDER Seite montiert ist und nur auf dem Telefon
  // erscheint. Genau dort zählt die iOS-feste Sperre am meisten.
  const mobileNav = useOverlay(mobileNavOpen);
  const chatDrawer = useOverlay(chatDrawerOpen);

  /** Ein Thread wird gewählt: Adresse auf, Schublade zu. Ohne das Schliessen
   *  stünde sie samt Scroll-Sperre über der neuen Seite — links tut das
   *  `onNavigate`. */
  function chatOeffnen(threadId: string) {
    setChatDrawerOpen(false);
    navigate(`/chat/${threadId}`);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div
      className="relative isolate min-h-screen bg-soft text-ink"
      style={
        {
          "--fbc-sidebar-w": collapsed ? SIDEBAR_W_RAIL : SIDEBAR_W_OPEN,
          // Steht die Leiste nicht — oder ist der Schirm schmaler als `xl` —,
          // ist der Versatz 0, und die Regel in index.css wirkt wie vor
          // AGE-627. Das erspart eine ZWEITE Media Query im Stylesheet: der
          // Umbruchpunkt der Leiste ist ein anderer als der der Navigation,
          // und zwei Regeln mit zwei Grenzen liefen auseinander.
          "--fbc-chat-w":
            chatLeisteSteht && istBreit ? (chatCollapsed ? CHAT_W_RAIL : CHAT_W_OPEN) : "0rem",
        } as React.CSSProperties
      }
    >
      {/* Angedockte Sidebar (≥ lg): sitzt bündig an der linken Viewport-Kante über
          die volle Höhe, mit border-right statt Rundung und Schatten — so schreibt
          es die verbindliche Vorlage vor (docs/design-system.html: „Sidebar — sitzt
          am Rand, nicht schwebend"). Bis AGE-499 hing sie als gerundete Karte in
          einem zentrierten Container und schwebte sichtbar. */}
      <aside
        id="fbc-navigation"
        className={cn(
          "fbc-sidebar fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-chrome-border lg:flex",
          SIDEBAR_SURFACE,
        )}
      >
        {/* Logo-Zeile — gleiche Höhe wie die Topbar rechts daneben, damit die
            Trennlinien der beiden auf einer Linie liegen. Eingeklappt bleibt nur
            der Kompass stehen; die Wortmarke passt in 4,5 rem nicht. */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-chrome-border",
            collapsed ? "justify-center px-2" : "px-5",
          )}
        >
          <Link
            to="/"
            className="rounded-md text-on-chrome-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Logo className="h-8" lockup={collapsed ? "mark" : "full"} onChrome />
          </Link>
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto py-6", collapsed ? "px-2" : "px-4")}>
          <SidebarContent collapsed={collapsed} />
        </div>

        {/* Feedback direkt über dem Einklapp-Schalter (AGE-566). Vorher schwebte
            der Knopf über dem Inhalt und deckte auf der Startseite den Aufruf
            „Mitglieder entdecken" halb zu. */}
        <div className="shrink-0 border-t border-chrome-border p-2">
          <FeedbackButton collapsed={collapsed} />
        </div>

        {/* Der Einklapp-Schalter sass bis AGE-638 hier unten als eigene Zeile,
            mit Pfeil und dem Wort „Einklappen". Er steht jetzt als Pill am
            rechten Rand dieser Leiste — dasselbe Bauteil wie an der
            Nachrichten-Leiste, an derselben Höhe. */}
        <LeistenPill
          seite="links"
          offen={!collapsed}
          steuert="fbc-navigation"
          onClick={() => setCollapsed((c) => !c)}
        />
      </aside>

      {/* Nachrichten-Leiste (≥ lg, AGE-627): gespiegelt zur linken — bündig an
          der rechten Viewport-Kante, `border-l` statt `border-r`, dieselbe
          Fläche. Sie ist KEINE Kopie: sie steht nur angemeldet und nur
          ausserhalb der Chatrouten, und ihr Startzustand ist eingeklappt. */}
      {/* Zwei Flächen, nicht eine — und das ist im navy-Theme gemessen, nicht
          gewählt. EINGEKLAPPT ist die Leiste ein Rail wie links: Chrome, navy
          im navy-Theme. AUFGEKLAPPT trägt sie eine LISTE, und die ist Inhalt:
          `ThreadList` schreibt in `text-ink` auf `hover:bg-soft`. Auf
          Chrome-Fläche wäre sie unlesbar, und ein zweiter, chrome-fähiger
          Aufguss der Liste widerspräche der Vorgabe, sie wiederzuverwenden.
          Ohne diese Fallunterscheidung stand im navy-Theme ein navyer Kopf über
          einer weissen Liste — im Bild gesehen, im hellen Theme unsichtbar,
          weil dort beide Flächen weiss sind. */}
      {chatLeisteSteht && (
        <aside
          id="fbc-nachrichten"
          className={cn(
            "fbc-chat-rail fixed inset-y-0 right-0 z-40 hidden flex-col border-l xl:flex",
            chatCollapsed ? cn("border-chrome-border", SIDEBAR_SURFACE) : "border-line bg-canvas",
          )}
        >
          {chatCollapsed ? (
            // Eingeklappt: NUR die Sprechblase mit dem Zähler — seit AGE-638
            // eine ANZEIGE, kein Knopf. Geschaltet wird über den Pill. Stünden
            // beide, stünden sie in derselben 4rem-Zeile eines 4,5rem schmalen
            // Rails: zwei Schalter, keine 40 px auseinander, mit derselben
            // Wirkung. Kein Thread wird hier geladen — die Zahl führt
            // `useUngelesen` ohnehin getrennt.
            <div className="flex h-16 shrink-0 items-center justify-center border-b border-chrome-border px-2">
              <span className="relative p-2 text-on-chrome">
                <Icon name="messages" className="h-5 w-5" />
                {(ungelesenFehlt || ungelesen.gesamt > 0) && (
                  // `aria-hidden`: die Zahl steht schon im Satz darunter.
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -top-0.5 min-w-[1.125rem] rounded-full bg-accent px-1 text-center text-[0.6875rem] font-semibold leading-[1.125rem] text-canvas"
                  >
                    {ungelesenFehlt ? "!" : ungelesen.gesamt}
                  </span>
                )}
                {/* Als TEXT, nicht als `aria-label`: ein `aria-label` auf einem
                    `span` ohne Rolle wird von Vorlesesoftware nicht verlässlich
                    ausgegeben. Beim Knopf, der hier bis AGE-638 stand, ging das
                    noch — bei einer Anzeige nicht mehr. */}
                <span className="sr-only">
                  {ungelesenFehlt
                    ? "Ungelesene Nachrichten — Anzahl konnte nicht geladen werden"
                    : ungelesen.gesamt > 0
                      ? `${ungelesen.gesamt} ungelesene Nachrichten`
                      : "Keine ungelesenen Nachrichten"}
                </span>
              </span>
            </div>
          ) : (
            <div className="flex h-16 shrink-0 items-center border-b border-line px-4">
              <span className="font-display text-sm font-semibold text-ink">Nachrichten</span>
            </div>
          )}

          <LeistenPill
            seite="rechts"
            offen={!chatCollapsed}
            steuert="fbc-nachrichten"
            onClick={() => setChatCollapsed((c) => !c)}
          />

          {/* `istBreit` gehört in die MONTAGE, nicht in einen Schalter am Panel:
              unter `lg` liegt diese Leiste per CSS verborgen, aber montiert —
              CSS verbirgt, es hält keine Abfrage an. Ohne diese Bedingung
              holte sie dort eine Seite Threads, die niemand zu sehen bekommt. */}
          {!chatCollapsed && istBreit && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ChatPanel
                uid={user?.id ?? null}
                activeId={null}
                onSelect={chatOeffnen}
                ungelesenJeThread={ungelesen.jeThread}
              />
            </div>
          )}
        </aside>
      )}

      {/* Header — beginnt rechts neben der Sidebar, nicht darüber. Links
          Hamburger/Logo (nur mobil), Suche mittig, rechts Avatar/Benachrichtigungen. */}
      <header className="fbc-shell-offset sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Menü öffnen"
            onClick={() => {
              setChatDrawerOpen(false);
              setMobileNavOpen(true);
            }}
            className="rounded-md p-2 text-ink transition-colors hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
          >
            <MenuIcon />
          </button>
          {/* Nur unterhalb von lg — ab lg trägt die Sidebar das Logo (AGE-499).
              Zwei sichtbare Lockups nebeneinander wären doppelt. */}
          <Link
            to="/"
            // Der Name steht am Link, nicht an seinem Inhalt (Befund des
            // Code-Reviews): darunter liegen ZWEI Lockups, von denen im Browser
            // je eines per Media Query verborgen ist. jsdom kennt keine Media
            // Queries — dort tragen beide bei, und der Link hieß gemessen
            // „eff.bee.zeeeff.bee.zee". `App.test.tsx` blieb nur deshalb grün,
            // weil es `getAllByRole(...).length > 0` prüft und die Seitenleiste
            // mitzählt; der Kopfzeilen-Link war aus seiner eigenen Zusicherung
            // still herausgefallen. Ein `aria-label` hier ist in beiden Welten
            // derselbe eine Name.
            aria-label="eff.bee.zee"
            className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas lg:hidden"
          >
            {/* Das SVG-Lockup ist randlos, skaliert sauber und erbt über
                currentColor die Farbe.

                Unter `sm` NUR die Marke (AGE-540, Entscheidung Donald): die
                Reihe brauchte hier bei 320 px 319 px und war damit randvoll;
                die Lupe der Kopfzeilen-Suche kostet 48 px und ließ die Kopfzeile
                seitlich überlaufen. Gemessen, nicht geschätzt — engere Abstände
                (gap-2 + px-3) kamen auf 339 px und hätten es nicht getragen.
                Ohne Wortmarke bleiben bei 320 px 56 px Reserve. Dieselbe Grenze,
                an der HeaderSearch ohnehin auf das Lupensymbol umschaltet; das
                volle Lockup steht weiter in Seitenleiste und Menü. */}
            <Logo lockup="mark" className="h-8 sm:hidden" />
            {/* Die Hülle trägt die Umschaltung, nicht das Lockup selbst: dessen
                Wurzel bringt `inline-flex` schon mit, und ein `hidden` daneben
                verliert — gemessen, `display` blieb `inline-flex`. Das übliche
                „hidden sm:block direkt drauf" trägt hier also nicht. */}
            <span className="hidden sm:block">
              <Logo className="h-8" />
            </span>
          </Link>

          {/* NUR angemeldet (AGE-540). Das tote Feld, das hier stand, lag
              AUSSERHALB des Zweigs unten und war damit auch für Gäste sichtbar.
              Es einfach zu „ersetzen" hätte die neue Suche an dieselbe Stelle
              gesetzt — und `search_directory` ist für `anon` nicht ausführbar,
              jede Eingabe liefe in `42501`. Ein anon-Weg dorthin wäre eine
              eigene Sicherheitsentscheidung, kein Nebeneffekt dieser Zeile. */}
          {user && <HeaderSearch />}

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {user ? (
              <>
                <NachrichtenEinstieg anzahl={ungelesen.gesamt} unbekannt={ungelesenFehlt} />
                {/* Eigener Öffner für die Schublade, gespiegelt zum Hamburger
                    links — und ausdrücklich NICHT die Sprechblase daneben zum
                    Umschalter gemacht: die führt an einen Ort, und ein Ort
                    gehört in die Adresszeile und ins Kontextmenü (der Grundsatz
                    an `NachrichtenEinstieg`). Deshalb auch ein anderes Glyph:
                    zwei gleiche Sprechblasen nebeneinander wären zwei Namen für
                    dasselbe. Der Pfeil sagt, was passiert — eine Leiste kommt
                    von rechts herein. */}
                {chatLeisteSteht && (
                  <button
                    type="button"
                    aria-label="Nachrichten-Leiste öffnen"
                    onClick={() => {
                      // Gegenseitiger Ausschluss: zwei offene Schubladen
                      // hielten zwei Sperren auf demselben Body.
                      setMobileNavOpen(false);
                      setChatDrawerOpen(true);
                    }}
                    className="rounded-md p-2 text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent xl:hidden"
                  >
                    <ChevronLeftIcon flipped={false} />
                  </button>
                )}
                <HinweisGlocke
                  hinweise={hinweise}
                  unbekannt={hinweiseFehlen}
                  onMarkiere={markiere}
                  onAlle={markiereAlle}
                />
                <UserMenu email={user.email ?? "?"} tier={tier} onSignOut={handleSignOut} />
              </>
            ) : (
              // Genau EIN Anmelde-Weg im Rahmen (AGE-499). Der Block über der
              // Sidebar-Navigation ist entfallen — er war dieselbe Aufforderung
              // ein zweites Mal. Ein zusätzliches „Mitglied werden" hier oben
              // wäre die dritte: die Mitglied-werden-Wand (MembershipGate) und
              // der Hero tragen diesen Ruf schon, dort mit Kontext.
              <Button variant="primary" size="sm" onClick={() => navigate("/login")}>
                Anmelden
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Inhalt — links um die Sidebar versetzt, sonst volle Breite bis 1440 px.
          RouteTransition: weicher Fade/Slide-Up beim Seitenwechsel (reduced-motion-
          sicher). */}
      <main className="fbc-shell-offset">
        <div
          className={cn(
            "mx-auto w-full px-4 py-8 sm:px-6 lg:px-8",
            isNarrow ? "max-w-[760px]" : "max-w-[1440px]",
          )}
        >
          <RouteTransition routeKey={pathname}>
            <Outlet />
          </RouteTransition>
        </div>
      </main>

      {/* Pflichtlinks (AGE-497). Traegt `fbc-shell-offset` wie <main>, sonst
          laege er ab lg unter der fixierten Sidebar. */}
      <AppFooter />

      {/* Off-Canvas-Sidebar (< lg). */}
      {mobileNavOpen && (
        <div
          ref={mobileNav}
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div
            className="absolute inset-0 bg-scrim backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <div
            className={cn(
              "absolute inset-y-0 left-0 w-72 max-w-[80vw] overflow-y-auto px-4 py-6 shadow-soft",
              SIDEBAR_SURFACE,
            )}
          >
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
            {/* Auch in der Schublade: die Leiste ist auf dem Telefon der einzige
                Ort, an dem der Zugang jetzt noch steht. */}
            <div className="mt-6 border-t border-chrome-border pt-2">
              <FeedbackButton />
            </div>
          </div>
        </div>
      )}

      {/* Nachrichten-Schublade (< lg, AGE-627) — von rechts, gespiegelt zur
          Navigation links. `useOverlay` bringt Sperre und Tab-Falle mit; Escape
          liegt als eigener Effect daneben, genau wie links. */}
      {chatDrawerOpen && chatLeisteSteht && (
        <div
          ref={chatDrawer}
          className="fixed inset-0 z-50 xl:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Nachrichten"
        >
          <div
            className="absolute inset-0 bg-scrim backdrop-blur-sm"
            onClick={() => setChatDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-canvas shadow-soft">
            <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
              <span className="font-display text-sm font-semibold text-ink">Nachrichten</span>
              <button
                type="button"
                onClick={() => setChatDrawerOpen(false)}
                aria-label="Nachrichten-Leiste schließen"
                className="rounded-md p-2 text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ChevronLeftIcon flipped />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ChatPanel
                uid={user?.id ?? null}
                activeId={null}
                onSelect={chatOeffnen}
                ungelesenJeThread={ungelesen.jeThread}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
