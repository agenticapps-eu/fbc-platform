import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CommunityFeed from "./CommunityFeed";
import { ToastProvider } from "../ui/Toast";
import { fetchFeed, toggleSave, type FeedPost, type FetchFeedArgs } from "../../lib/feed";
import { fetchTagZaehler, fetchTopAutoren } from "../../lib/feed-sidebar";
import { fetchAktiveTags } from "../../lib/tags";
import { AuthFixture, authAsTier, fakeAuthValue } from "../../test/auth-fixtures";

/**
 * Die Fläche des Feeds (AGE-582, Abschnitt 6): Reiter, Ordnung, gefüllte
 * Sidebar, Beitragstyp, Speichern-Knopf und der anonyme Fall.
 *
 * GEMOCKT IST NUR DER RAND ZUR DATENBANK — `fetchFeed`, `toggleSave`, die zwei
 * Sidebar-Aggregate und die Tag-Liste. Die Komponente selbst läuft echt; ein
 * `vi.mock` auf sie wäre grün und prüfte nichts.
 *
 * Die Zusagen sind bewusst über die ANFRAGE, nicht über die Liste: dass ein
 * Reiter nur eigene Beiträge zeigt, ist eine Eigenschaft der Abfrage (Abschnitt
 * 5, dort gegen den laufenden Stack belegt) — hier gehört die Frage hin, ob die
 * Fläche sie überhaupt stellt, und mit welchen Argumenten.
 */
vi.mock("../../lib/feed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/feed")>()),
  fetchFeed: vi.fn(),
  toggleSave: vi.fn(),
}));

vi.mock("../../lib/feed-sidebar", () => ({
  fetchTagZaehler: vi.fn(),
  fetchTopAutoren: vi.fn(),
  tagZaehlerKey: (uid: string | null) => ["feed", "tag-zaehler", uid],
  topAutorenKey: (uid: string | null) => ["feed", "top-autoren", uid],
}));

vi.mock("../../lib/tags", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/tags")>()),
  fetchAktiveTags: vi.fn(),
}));

function post(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: "p1",
    author: { id: "a1", name: "Detlev Meier", avatarUrl: null, tier: "impact" },
    body: "Gestern beim Netzwerken viel gelernt.",
    hashtags: [],
    visibility: "public",
    createdAt: new Date("2026-08-01T10:00:00Z").toISOString(),
    likeCount: 0,
    commentCount: 0,
    likedByMe: false,
    savedByMe: false,
    videoUrl: null,
    kind: "member",
    event: null,
    media: [],
    ...overrides,
  };
}

const ZAEHLER = [
  { key: "netzwerken", label: "Netzwerken", anzahl: 7 },
  { key: "immobilien", label: "Immobilien", anzahl: 2 },
];

const AUTOREN = [
  { id: "a1", name: "Detlev Meier", avatarUrl: null, anzahl: 4 },
  { id: "a2", name: "Marta Roth", avatarUrl: null, anzahl: 1 },
];

/** Die Argumente des n-ten `fetchFeed`-Aufrufs. */
function aufruf(n: number): FetchFeedArgs {
  return vi.mocked(fetchFeed).mock.calls[n][0];
}

/** Der zuletzt gestellte `fetchFeed`-Aufruf. */
function letzterAufruf(): FetchFeedArgs {
  const calls = vi.mocked(fetchFeed).mock.calls;
  return calls[calls.length - 1][0];
}

function renderFeed(value = authAsTier("impact")) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <CommunityFeed />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

beforeEach(() => {
  vi.mocked(fetchFeed)
    .mockReset()
    .mockResolvedValue({ posts: [post()], nextCursor: null });
  vi.mocked(toggleSave).mockReset().mockResolvedValue(undefined);
  vi.mocked(fetchTagZaehler).mockReset().mockResolvedValue(ZAEHLER);
  vi.mocked(fetchTopAutoren).mockReset().mockResolvedValue(AUTOREN);
  vi.mocked(fetchAktiveTags).mockReset().mockResolvedValue([]);
});

// ── 6.4 Reiter ──────────────────────────────────────────────────────────────

describe("Die drei Reiter (6.4)", () => {
  it("bietet einem Mitglied alle drei an und fragt den gewählten wirklich ab", async () => {
    renderFeed();
    await screen.findByText(/viel gelernt/);

    const leiste = screen.getByRole("group", { name: /reiter/i });
    expect(within(leiste).getByRole("button", { name: /alle beiträge/i })).toBeInTheDocument();
    expect(within(leiste).getByRole("button", { name: /beiträge von mir/i })).toBeInTheDocument();

    fireEvent.click(within(leiste).getByRole("button", { name: /^gespeichert$/i }));

    await waitFor(() => expect(letzterAufruf().reiter).toBe("gespeichert"));
  });

  it("verwirft beim Reiterwechsel den Cursor", async () => {
    vi.mocked(fetchFeed).mockResolvedValue({
      posts: [post()],
      nextCursor: { createdAt: "2026-08-01T09:00:00Z", id: "p0" },
    });
    renderFeed();
    await screen.findByText(/viel gelernt/);

    fireEvent.click(screen.getByRole("button", { name: /ältere beiträge/i }));
    await waitFor(() => expect(letzterAufruf().cursor).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /beiträge von mir/i }));

    /* Die scharfe Zusage ist nicht „die Liste beginnt oben", sondern dass die
       ERSTE Anfrage der neuen Auswahl ohne Cursor gestellt wird. Ein Cursor der
       alten Ordnung wäre in der neuen bedeutungslos — und stünde er noch drin,
       fehlte der Anfang der Liste, ohne dass etwas darauf hinwiese. */
    await waitFor(() => {
      const letzter = letzterAufruf();
      expect(letzter.reiter).toBe("meine");
      expect(letzter.cursor ?? null).toBeNull();
    });
  });
});

// ── 6.5 Ordnung ─────────────────────────────────────────────────────────────

describe("Der Ordnungs-Umschalter (6.5)", () => {
  it("stellt die Ordnung um und beginnt dabei von vorn", async () => {
    vi.mocked(fetchFeed).mockResolvedValue({
      posts: [post()],
      nextCursor: { createdAt: "2026-08-01T09:00:00Z", id: "p0" },
    });
    renderFeed();
    await screen.findByText(/viel gelernt/);
    expect(aufruf(0).ordnung).toBe("neueste");

    fireEvent.click(screen.getByRole("button", { name: /ältere beiträge/i }));
    await waitFor(() => expect(letzterAufruf().cursor).not.toBeNull());

    fireEvent.change(screen.getByLabelText(/sortierung/i), { target: { value: "beliebteste" } });

    await waitFor(() => {
      const letzter = letzterAufruf();
      expect(letzter.ordnung).toBe("beliebteste");
      expect(letzter.cursor ?? null).toBeNull();
    });
  });
});

// ── 6.6 / 6.7 Sidebar ───────────────────────────────────────────────────────

describe("Die gefüllte Sidebar (6.6)", () => {
  it("zeigt die kuratierten Tags als Auswahlkästchen mit Zählern", async () => {
    renderFeed();
    await screen.findByText(/viel gelernt/);

    const kasten = await screen.findByRole("checkbox", { name: /netzwerken/i });
    expect(kasten).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /netzwerken/i }).closest("label"),
    ).toHaveTextContent("7");
  });

  it("wirkt bei zwei Haken als ODER — beide Marken gehen in eine Anfrage", async () => {
    renderFeed();
    await screen.findByText(/viel gelernt/);

    fireEvent.click(await screen.findByRole("checkbox", { name: /netzwerken/i }));
    await waitFor(() => expect(letzterAufruf().tags).toEqual(["netzwerken"]));

    fireEvent.click(screen.getByRole("checkbox", { name: /immobilien/i }));
    await waitFor(() => expect(letzterAufruf().tags).toEqual(["netzwerken", "immobilien"]));
  });

  it("zeigt die aktivsten Mitglieder mit ihrer Zahl", async () => {
    renderFeed();

    const liste = await screen.findByRole("list", { name: /aktivste mitglieder/i });
    expect(within(liste).getByText("Detlev Meier")).toBeInTheDocument();
    expect(within(liste).getByText("Marta Roth")).toBeInTheDocument();
  });

  it("filtert nach Beitragstyp", async () => {
    renderFeed();
    await screen.findByText(/viel gelernt/);

    fireEvent.change(screen.getByLabelText(/beitragstyp/i), { target: { value: "bild" } });

    await waitFor(() => expect(letzterAufruf().typ).toBe("bild"));
  });

  /* Ein gescheiterter Aufruf sieht sonst GENAU SO AUS wie „es gibt nichts":
     beide Male keine Kästchen. Das ist derselbe Fehler wie eine Null aus einem
     Fehler, nur eine Ebene tiefer — die Spalte behauptete etwas über den
     Bestand, was sie nicht weiss. */
  it('sagt es, wenn die Zähler nicht zu holen waren — statt „keine Tags" zu zeigen', async () => {
    vi.mocked(fetchTagZaehler).mockRejectedValue(new Error("permission denied"));
    renderFeed();

    expect(await screen.findByText(/tags konnten nicht geladen werden/i)).toBeInTheDocument();
  });

  it("sagt es ebenso, wenn die aktivsten Mitglieder nicht zu holen waren", async () => {
    vi.mocked(fetchTopAutoren).mockRejectedValue(new Error("permission denied"));
    renderFeed();

    expect(
      await screen.findByText(/aktivste mitglieder konnten nicht geladen werden/i),
    ).toBeInTheDocument();
  });

  /* 6.7 — heute gab `TagFilter` in diesem Fall `null` zurück und die ganze
     Spalte verschwand. Sie trägt jetzt zwei weitere Dinge, die davon nicht
     abhängen. */
  it("bleibt stehen, wenn kein kuratierter Tag einen sichtbaren Beitrag hat (6.7)", async () => {
    vi.mocked(fetchTagZaehler).mockResolvedValue([]);
    renderFeed();

    expect(await screen.findByRole("list", { name: /aktivste mitglieder/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/beitragstyp/i)).toBeInTheDocument();
  });
});

// ── 6.8 Der anonyme Fall ────────────────────────────────────────────────────

describe("Ohne Sitzung bleibt die Aktivität ein Schaufenster (6.8)", () => {
  it("zeigt keinen zweiten Reiter, keinen Speichern-Knopf und keine Mitgliedernamen", async () => {
    renderFeed(fakeAuthValue());
    await screen.findByText(/viel gelernt/);

    expect(screen.queryByRole("button", { name: /beiträge von mir/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^gespeichert$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^beitrag speichern$/i })).toBeNull();
    expect(screen.queryByRole("list", { name: /aktivste mitglieder/i })).toBeNull();
  });

  /* Die schärfere Zusage: nicht „wird nicht angezeigt", sondern „wird gar nicht
     erst angefordert". `feed_top_authors` ist an `anon` NICHT vergeben — ein
     Aufruf liefe in einen Fehler, und ein Fehler, den eine Fläche als Null
     zeigt, ist die schlechteste aller Zahlen. */
  it("fordert die aktivsten Mitglieder gar nicht erst an", async () => {
    renderFeed(fakeAuthValue());
    await screen.findByText(/viel gelernt/);

    expect(fetchTopAutoren).not.toHaveBeenCalled();
  });

  /* Die Zähler dagegen SIND für `anon` vergeben und zählen dort nachweislich nur
     öffentliche Beiträge (`security invoker`, siehe die Migration). Sie dürfen
     deshalb bleiben. */
  it("holt die Tag-Zähler weiterhin", async () => {
    renderFeed(fakeAuthValue());

    await waitFor(() => expect(fetchTagZaehler).toHaveBeenCalled());
  });

  it("fragt ausschliesslich nur den Reiter Alle Beitraege ab", async () => {
    renderFeed(fakeAuthValue());
    await screen.findByText(/viel gelernt/);

    expect(aufruf(0).reiter).toBe("alle");
  });
});

// ── 6.10 Speichern ──────────────────────────────────────────────────────────

describe("Der Speichern-Knopf an der Karte (6.10)", () => {
  it("speichert und nimmt zurück", async () => {
    renderFeed();
    await screen.findByText(/viel gelernt/);

    const knopf = screen.getByRole("button", { name: /^beitrag speichern$/i });
    expect(knopf).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(knopf);
    await waitFor(() =>
      expect(toggleSave).toHaveBeenCalledWith({
        postId: "p1",
        profileId: "test-user",
        saved: false,
      }),
    );
  });

  it("zeigt einen gespeicherten Beitrag als gespeichert und löst ihn beim Klick", async () => {
    vi.mocked(fetchFeed).mockResolvedValue({
      posts: [post({ savedByMe: true })],
      nextCursor: null,
    });
    renderFeed();
    await screen.findByText(/viel gelernt/);

    /* Der Knopf heisst in BEIDEN Zuständen „Speichern" — der Zustand steht in
       `aria-pressed` und im gefüllten Symbol, nicht im Namen. Ein Knopf, der
       seinen Namen wechselt, hiesse hier zeitweise genauso wie der Reiter
       daneben; für eine Vorleseausgabe wären das zwei gleich benannte
       Bedienelemente mit verschiedener Wirkung. */
    const knopf = screen.getByRole("button", { name: /^beitrag speichern$/i });
    expect(knopf).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(knopf);
    await waitFor(() =>
      expect(toggleSave).toHaveBeenCalledWith({
        postId: "p1",
        profileId: "test-user",
        saved: true,
      }),
    );
  });

  /* 6.11 — der Zustand kommt ERST NACH dem Mount aus der Abfrage. Läge er in
     einem `useState(post.savedByMe)`, nähme die Karte ihn nie an: beim ersten
     Rendern gibt es den Beitrag noch gar nicht. Der Test misst genau diese
     Zeitachse, indem er die Antwort verzögert. */
  it("nimmt den Zustand an, der erst nach dem Mount eintrifft (6.11)", async () => {
    let aufloesen: (seite: { posts: FeedPost[]; nextCursor: null }) => void = () => {};
    vi.mocked(fetchFeed).mockReturnValue(
      new Promise((res) => {
        aufloesen = res;
      }),
    );
    renderFeed();

    expect(screen.queryByRole("button", { name: /^beitrag speichern$/i })).toBeNull();

    aufloesen({ posts: [post({ savedByMe: true })], nextCursor: null });

    const knopf = await screen.findByRole("button", { name: /^beitrag speichern$/i });
    expect(knopf).toHaveAttribute("aria-pressed", "true");
  });
});

// ── 6.1 / 6.9 Anordnung ─────────────────────────────────────────────────────

describe("Die Anordnung (6.1, 6.9)", () => {
  /* Ausrichtung ist in jsdom nicht messbar — es rechnet kein Layout. Messbar ist
     die STRUKTUR, die sie erzeugt: der Composer liegt in der Feed-Spalte, nicht
     über beiden Spalten. Vorher stand er als Geschwister VOR dem Raster. */
  it("stellt den Composer in die Feed-Spalte, nicht über das Raster (6.1)", async () => {
    renderFeed();
    await screen.findByText(/viel gelernt/);

    const composer = screen.getByRole("button", {
      name: /was möchtest du mit der community teilen/i,
    });
    const raster = document.querySelector(".grid");
    expect(raster).not.toBeNull();
    expect(raster!.contains(composer)).toBe(true);
  });

  it("hält die Filterspalte auf dem Telefon zusammengeklappt (6.9)", async () => {
    renderFeed();
    await screen.findByText(/viel gelernt/);

    const schalter = screen.getByRole("button", { name: /^filter$/i });
    const flaeche = document.getElementById(schalter.getAttribute("aria-controls")!);

    expect(schalter).toHaveAttribute("aria-expanded", "false");
    /* `hidden` klappt sie auf dem Telefon zu, `lg:block` holt sie auf breiten
       Schirmen zurück. jsdom rechnet kein CSS — die Zusage ist über die Klasse,
       der Beleg über die Sichtprobe bei 375 px. */
    expect(flaeche).toHaveClass("hidden", "lg:block");

    fireEvent.click(schalter);
    expect(schalter).toHaveAttribute("aria-expanded", "true");
    expect(flaeche).not.toHaveClass("hidden");
  });
});
