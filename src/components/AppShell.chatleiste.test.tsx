import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Die zweite angedockte Leiste (AGE-627, Bänder 4 und 5).
 *
 * Geprüft wird die HÜLLE, nicht der Inhalt der Liste — der steht in
 * `ChatPanel.test.tsx`. Hier geht es um vier Dinge, die sich nur am Rahmen
 * zeigen: ob die Leiste überhaupt erscheint, wann sie es NICHT tut, dass die
 * beiden Leisten sich unabhängig merken, und dass die zwei Schubladen einander
 * ausschliessen.
 *
 * **`matchMedia` ist hier kein Beiwerk.** jsdom meldet für
 * `(min-width: 1024px)` immer `false`. Die angedockte Leiste liegt unter `lg`
 * per CSS verborgen, ist aber montiert — ohne diese Zustandsgrösse holte sie
 * dort eine Seite Threads, die niemand sieht. Ein Test, der die Breite nicht
 * stellt, misst deshalb den Telefonfall, auch wenn er „Desktop" heisst.
 */

// jsdom kennt `scrollIntoView` nicht. `Conversation` ruft es beim Montieren —
// derselbe Mangel wie bei `window.scrollTo` (siehe test/setup.ts), und er
// trifft hier genau den einen Test, der wirklich in ein Gespräch navigiert.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

type Seite = import("../lib/chat").ChatThreadSeite;
const fetchThreads = vi.fn<(uid: string, opts?: { offset?: number }) => Promise<Seite>>();

/** Der Ungelesen-Zähler der Attrappe. Veränderlich, weil eine der Zusagen aus
 *  AGE-638 nur mit einer Zahl > 0 überhaupt messbar ist: erst dann trägt die
 *  Sprechblase einen eigenen Namen, an dem sich zeigt, ob sie noch ein Knopf
 *  ist. `vi.hoisted`, weil `vi.mock` nach oben gezogen wird und eine normale
 *  Konstante dort nicht sähe. */
const { ungelesen } = vi.hoisted(() => ({ ungelesen: { gesamt: 0 } }));

vi.mock("../lib/chat", async (original) => ({
  ...(await original<typeof import("../lib/chat")>()),
  fetchThreads: (uid: string, opts?: { offset?: number }) => fetchThreads(uid, opts),
  fetchMessages: async () => [],
  fetchUnreadCounts: async () => ({
    gesamt: ungelesen.gesamt,
    jeThread: new Map<string, number>(),
    hatUngelesen: () => false,
  }),
  markThreadRead: async () => {},
  subscribeToAllMessages: () => () => {},
  subscribeToThread: () => () => {},
}));

const { default: App } = await import("../App");
const { ToastProvider } = await import("./ui/Toast");
const { AuthFixture, fakeAuthValue } = await import("../test/auth-fixtures");
const { LEVEL_RANK } = await import("../config/levels");
type AuthContextValue = import("../providers/auth-context").AuthContextValue;

const MITGLIED = fakeAuthValue({
  user: { id: "test-user", email: "bea@demo.local" } as AuthContextValue["user"],
  tier: "impact",
  levelRank: LEVEL_RANK.impact,
});
const GAST = fakeAuthValue();

/** Stellt die Viewport-Breite. Beide Abfragen müssen bedient werden: neben
 *  `min-width` fragt die Motion-Schicht `prefers-reduced-motion` ab.
 *
 *  Die Zuhörer werden GEMERKT, nicht verworfen: der Sprung über `lg` ist eine
 *  eigene Zusage, und ein Stub mit leerem `addEventListener` könnte ihn nie
 *  auslösen — der Test wäre grün, ohne je etwas gemessen zu haben. */
let breite = 1440;
const zuhoerer: (() => void)[] = [];

/** Antwortet je Abfrage, nicht pauschal. Das ist hier keine Sorgfalt um ihrer
 *  selbst willen: Navigation und Nachrichten haben SEIT der Sichtprobe
 *  verschiedene Umbruchpunkte (`lg` und `xl`), und ein Stub, der beide gleich
 *  beantwortet, könnte das Band dazwischen gar nicht messen. */
function setzeBreit(px: number) {
  breite = px;
  zuhoerer.length = 0;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      if (query.includes("prefers-reduced-motion")) return true;
      const m = /min-width:\s*(\d+)px/.exec(query);
      return m ? breite >= Number(m[1]) : false;
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, cb: () => void) => zuhoerer.push(cb),
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

/** Ändert die Breite und benachrichtigt die Zuhörer, wie es der Browser täte. */
function wechsleAuf(px: number) {
  breite = px;
  zuhoerer.forEach((cb) => cb());
}

function renderApp(pfad = "/aktivitaet", value: AuthContextValue = MITGLIED) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[pfad]}>
            <App />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

const ausklappen = () => screen.queryByRole("button", { name: /^Nachrichten ausklappen/ });
const einklappen = () => screen.queryByRole("button", { name: "Nachrichten einklappen" });
const oeffner = () => screen.queryByRole("button", { name: "Nachrichten-Leiste öffnen" });

beforeEach(() => {
  setzeBreit(1440);
  ungelesen.gesamt = 0;
  fetchThreads.mockReset();
  fetchThreads.mockResolvedValue({ threads: [], nextOffset: null });
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("Die Nachrichten-Leiste steht in der Hülle (AGE-627)", () => {
  it("erscheint angemeldet, und zwar eingeklappt", () => {
    renderApp();
    expect(ausklappen()).toBeInTheDocument();
    // Positivkontrolle zum Startwert: aufgeklappt gäbe es den Gegenknopf.
    expect(einklappen()).not.toBeInTheDocument();
  });

  it("erscheint für einen Gast gar nicht", () => {
    renderApp("/aktivitaet", GAST);
    expect(ausklappen()).not.toBeInTheDocument();
    expect(oeffner()).not.toBeInTheDocument();
  });

  it("blendet auf /chat aus — dort ist die Liste schon die Seite", () => {
    renderApp("/chat");
    expect(ausklappen()).not.toBeInTheDocument();
  });

  it("blendet auch auf einem Gespräch aus", () => {
    renderApp("/chat/t1");
    expect(ausklappen()).not.toBeInTheDocument();
  });

  it("fragt eingeklappt KEINE Threads ab", async () => {
    renderApp();
    // Der Zähler läuft trotzdem — er kommt aus einer anderen Abfrage.
    expect(await screen.findByRole("link", { name: /Nachrichten/ })).toBeInTheDocument();
    expect(fetchThreads).not.toHaveBeenCalled();
  });

  it("fragt erst nach dem Aufklappen ab", async () => {
    renderApp();
    fireEvent.click(ausklappen()!);
    await waitFor(() => expect(fetchThreads).toHaveBeenCalled());
  });

  it("bleibt im Band zwischen lg und xl eine Schublade", () => {
    // 1152 px: die Navigation ist angedockt, die Nachrichten sind es NICHT.
    // Genau dieses Band hat die Sichtprobe entschieden — mit 20rem angedockt ab
    // `lg` blieben bei 1024 px noch 433 px Inhalt, und im Verzeichnis standen
    // Namen auf ein Zeichen gekürzt. Die Raster des Hauses hängen am Viewport,
    // nicht an der Spalte, und schrumpfen deshalb nicht mit.
    setzeBreit(1152);
    localStorage.setItem("fbc.chatCollapsed", "0");
    renderApp();

    expect(oeffner()).toBeInTheDocument();
    expect(fetchThreads).not.toHaveBeenCalled();
    // Die Navigation links ist hier sehr wohl angedockt — die Positivkontrolle
    // dafür, dass die Breite überhaupt ankommt.
    expect(screen.getByRole("button", { name: "Navigation einklappen" })).toBeInTheDocument();
  });

  it("merkt sich beide Leisten unabhängig", () => {
    renderApp();
    fireEvent.click(ausklappen()!);
    expect(localStorage.getItem("fbc.chatCollapsed")).toBe("0");
    // Die linke ist davon unberührt — ein gemeinsamer Schlüssel hiesse, dass
    // das Einklappen der Navigation die Nachrichten mitnimmt.
    expect(localStorage.getItem("fbc.sidebarCollapsed")).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Navigation einklappen" }));
    expect(localStorage.getItem("fbc.sidebarCollapsed")).toBe("1");
    expect(localStorage.getItem("fbc.chatCollapsed")).toBe("0");
  });
});

describe("Ein Pill für beide Leisten (AGE-638)", () => {
  /** Der Pill einer Leiste, egal in welchem Zustand. Über den Namen gesucht,
   *  weil der die HANDLUNG benennt — genau das, was ein Schalter ansagen muss. */
  const pill = (leiste: "Navigation" | "Nachrichten") =>
    screen.queryByRole("button", { name: new RegExp(`^${leiste} (ein|aus)klappen$`) });

  it("trägt an beiden Leisten einen Schalter, der die Handlung benennt", () => {
    renderApp();
    // Links offen, rechts eingeklappt — die beiden Startzustände.
    expect(pill("Navigation")).toHaveAccessibleName("Navigation einklappen");
    expect(pill("Nachrichten")).toHaveAccessibleName("Nachrichten ausklappen");
  });

  it("sagt den Zustand über aria-expanded an, nicht nur über den Text", () => {
    renderApp();
    expect(pill("Navigation")).toHaveAttribute("aria-expanded", "true");
    expect(pill("Nachrichten")).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(pill("Navigation")!);
    expect(pill("Navigation")).toHaveAttribute("aria-expanded", "false");
    expect(pill("Navigation")).toHaveAccessibleName("Navigation ausklappen");
  });

  it("zeigt in allen VIER Fällen in die Richtung, in die es geht", () => {
    // Seite × Zustand. Ein Test nur auf den Namen sähe einen umgedrehten Pfeil
    // nie — und „gespiegelt" ist genau die Eigenschaft, die hier leicht kippt.
    renderApp();
    expect(pill("Navigation")).toHaveAttribute("data-richtung", "links");
    expect(pill("Nachrichten")).toHaveAttribute("data-richtung", "links");

    fireEvent.click(pill("Navigation")!);
    fireEvent.click(pill("Nachrichten")!);

    expect(pill("Navigation")).toHaveAttribute("data-richtung", "rechts");
    expect(pill("Nachrichten")).toHaveAttribute("data-richtung", "rechts");
  });

  it("steht an beiden Leisten, links und rechts", () => {
    // Was dieser Test misst und was NICHT: dass an beiden Leisten ein Pill
    // steht — nicht, dass es dasselbe Bauteil ist. Ein Markierungsattribut
    // liesse sich auch von zwei getrennt gebauten Knöpfen setzen (Fremd-Review
    // auf dem Diff, codex, LOW). Die Wiederverwendung hält der Quelltext, nicht
    // diese Zusage.
    //
    // Er ist trotzdem nicht wertlos: gegen die alten Schalter war er ROT, und
    // ein Test auf die NAMEN wäre grün gewesen — die hiessen ja schon so.
    renderApp();
    const pills = document.querySelectorAll("[data-leisten-pill]");
    expect(pills).toHaveLength(2);
    expect([...pills].map((p) => p.getAttribute("data-leisten-pill")).sort()).toEqual([
      "links",
      "rechts",
    ]);
  });

  it("hat links KEINE untere Einklapp-Zeile mehr — und den Feedback-Zugang schon", () => {
    renderApp();
    // Der Pill trägt nur ein Zeichen. Das WORT „Einklappen" stand allein in der
    // unteren Zeile; verschwindet es, ist sie weg. Ein Test auf den
    // zugänglichen Namen träfe hier nicht, weil der Pill denselben führt.
    expect(screen.queryByText("Einklappen")).not.toBeInTheDocument();
    // Positivkontrolle zur Verneinung: ohne sie wäre der Test auch grün, wenn
    // die ganze Leiste fehlte.
    expect(screen.getByRole("button", { name: /Feedback/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Navigation einklappen" })).toHaveLength(1);
  });

  it("hat rechts aufgeklappt KEINEN eigenen Knopf im Kopf mehr", () => {
    renderApp();
    fireEvent.click(pill("Nachrichten")!);
    // Genau einer, und er steckt im Pill — nicht im Kopf der Leiste.
    const knoepfe = screen.getAllByRole("button", { name: "Nachrichten einklappen" });
    expect(knoepfe).toHaveLength(1);
    expect(knoepfe[0]).toHaveAttribute("data-leisten-pill", "rechts");
  });

  it("macht aus der Sprechblase im Rail eine Anzeige, keinen zweiten Schalter", async () => {
    // Erst mit einer Zahl > 0 trägt die Sprechblase einen eigenen Namen. Mit 0
    // hiesse sie schlicht „Nachrichten ausklappen" wie der Pill, und der Test
    // könnte die beiden gar nicht auseinanderhalten.
    ungelesen.gesamt = 3;
    renderApp();

    // Auf den SATZ geprüft, nicht auf die Ziffer: die „3" steht auch am
    // Glocken-Zähler in der Topbar, und `findByText("3")` träfe beide.
    expect(await screen.findByText("3 ungelesene Nachrichten")).toBeInTheDocument();
    // Die Zahl steht da — aber nicht mehr auf einem Knopf.
    expect(screen.queryByRole("button", { name: /ungelesen/ })).not.toBeInTheDocument();
    // Und der EINZIGE Weg zum Ausklappen ist der Pill.
    const wege = screen.getAllByRole("button", { name: /^Nachrichten ausklappen/ });
    expect(wege).toHaveLength(1);
    expect(wege[0]).toHaveAttribute("data-leisten-pill", "rechts");
  });
});

describe("Unter xl: die Schublade von rechts (AGE-627)", () => {
  beforeEach(() => setzeBreit(390));

  it("hat einen eigenen Öffner, und der ist nicht die Sprechblase", () => {
    renderApp();
    expect(oeffner()).toBeInTheDocument();
    // Die Sprechblase bleibt ein LINK auf /chat — der Grundsatz „ein Link, kein
    // Knopf" wird nicht gebrochen.
    expect(screen.getByRole("link", { name: /Nachrichten/ })).toHaveAttribute("href", "/chat");
  });

  it("schliesst beim Öffnen die andere Schublade", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Menü öffnen" }));
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeInTheDocument();

    fireEvent.click(oeffner()!);
    expect(screen.getByRole("dialog", { name: "Nachrichten" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
  });

  it("holt unter lg KEINE Threads, auch wenn sie zuletzt offen war", async () => {
    // Der stille Fall: jemand klappt die Leiste am Rechner auf und ruft die
    // Seite später auf dem Telefon auf. Dort liegt sie per CSS verborgen — aber
    // montiert. CSS verbirgt, es hält keine Abfrage an.
    localStorage.setItem("fbc.chatCollapsed", "0");
    renderApp();

    expect(await screen.findByRole("link", { name: /Nachrichten/ })).toBeInTheDocument();
    expect(fetchThreads).not.toHaveBeenCalled();
  });

  it("schliesst umgekehrt beim Öffnen der Navigation", () => {
    // Der Ausschluss muss in BEIDE Richtungen gelten — eine Richtung zu prüfen
    // hiesse, die andere für gegeben zu halten.
    renderApp();
    fireEvent.click(oeffner()!);
    expect(screen.getByRole("dialog", { name: "Nachrichten" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Menü öffnen" }));
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Nachrichten" })).not.toBeInTheDocument();
  });

  it("schliesst über Escape", () => {
    renderApp();
    fireEvent.click(oeffner()!);
    expect(screen.getByRole("dialog", { name: "Nachrichten" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Nachrichten" })).not.toBeInTheDocument();
  });

  it("schliesst beim Sprung über lg — sonst bliebe die Sperre auf der Seite", () => {
    // Der teure Teil ist nicht die unsichtbare Schublade, sondern die
    // Scroll-Sperre daran: ab `lg` verschwindet sie NUR per CSS, und die Seite
    // wäre danach dauerhaft gesperrt, ohne sichtbaren Grund.
    renderApp();
    fireEvent.click(oeffner()!);
    expect(screen.getByRole("dialog", { name: "Nachrichten" })).toBeInTheDocument();
    expect(document.body.style.position).toBe("fixed");

    act(() => wechsleAuf(1440));

    expect(screen.queryByRole("dialog", { name: "Nachrichten" })).not.toBeInTheDocument();
    expect(document.body.style.position).not.toBe("fixed");
  });

  it("gibt die Sperre frei, wenn ein Gespräch gewählt wird", async () => {
    fetchThreads.mockResolvedValue({
      threads: [
        {
          id: "t1",
          partner: { id: "p1", name: "Anna Becker", avatarUrl: null, company: null, tier: null },
          lastMessage: null,
          lastActivityAt: "2026-08-01T09:00:00Z",
        },
      ],
      nextOffset: null,
    });
    renderApp();
    fireEvent.click(oeffner()!);

    fireEvent.click(await screen.findByRole("button", { name: "Anna Becker" }));

    // Auf `/chat/t1` steht die Leiste ohnehin nicht mehr — die Zusage, die
    // dabei etwas wert ist, lautet auf die SPERRE: bliebe sie, wäre die neue
    // Seite unscrollbar.
    await waitFor(() => expect(document.body.style.position).not.toBe("fixed"));
    expect(screen.queryByRole("dialog", { name: "Nachrichten" })).not.toBeInTheDocument();
  });

  it("schliesst über den Backdrop", () => {
    renderApp();
    fireEvent.click(oeffner()!);
    const dialog = screen.getByRole("dialog", { name: "Nachrichten" });
    fireEvent.click(dialog.firstElementChild!);
    expect(screen.queryByRole("dialog", { name: "Nachrichten" })).not.toBeInTheDocument();
  });
});
