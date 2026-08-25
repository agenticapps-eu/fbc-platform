import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CommunityFeed from "./CommunityFeed";
import { ToastProvider } from "../ui/Toast";
import { AuthFixture, authAsTier } from "../../test/auth-fixtures";

/**
 * Der Composer (AGE-528, Block 6).
 *
 * GEMOCKT IST DER RAND, NICHT DER EIGENE CODE. Supabase (Tabellen, Storage,
 * RPC) ist gefälscht — und der BROWSER, weil jsdom weder `createImageBitmap`
 * noch einen 2D-Kontext hat. `shrinkToWebp`, `zielMasse`, `parseHashtags` und
 * `uploadPostMedia` laufen echt. Deshalb ist die Zusicherung auf 1600×1200
 * unten aussagekräftig: die Zahl entsteht in der echten Rechnung, sie ist nicht
 * eingesetzt.
 */

const uploads: { path: string; contentType?: string }[] = [];
let rpcAufrufe: { name: string; args: Record<string, unknown> }[] = [];
let uploadFehler: { message: string } | null = null;

const TAGS = [
  { key: "netzwerken", label: "Netzwerken", sort: 10 },
  { key: "erlebnistag", label: "Erlebnistag", sort: 200 },
];

vi.mock("../../lib/supabase", () => {
  const zeilen = (table: string) => (table === "tags" ? TAGS : []);
  return {
    supabase: {
      from: (table: string) => {
        const kette = {
          select: () => kette,
          order: () => kette,
          limit: () => kette,
          or: () => kette,
          contains: () => kette,
          eq: () => kette,
          in: () => kette,
          then: (auf: (r: { data: unknown; error: null }) => unknown) =>
            Promise.resolve({ data: zeilen(table), error: null }).then(auf),
        };
        return kette;
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcAufrufe.push({ name, args });
        return { data: [], error: null };
      },
      storage: {
        from: () => ({
          upload: async (path: string, _blob: Blob, opts?: { contentType?: string }) => {
            uploads.push({ path, contentType: opts?.contentType });
            return { error: uploadFehler };
          },
          createSignedUrls: async () => ({ data: [], error: null }),
        }),
      },
    },
  };
});

/** Ein gewähltes Foto — die Maße kommen aus dem gefälschten Bitmap, nicht aus der Datei. */
function foto(name: string) {
  return new File(["jpeg-bytes"], name, { type: "image/jpeg" });
}

function renderFeed() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <AuthFixture value={authAsTier("impact")}>
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

/** Aus der ruhigen Zeile den vollen Composer aufklappen (6.1). */
function oeffneComposer() {
  fireEvent.click(
    screen.getByRole("button", { name: /was möchtest du mit der community teilen/i }),
  );
}

function waehleBilder(...dateien: File[]) {
  fireEvent.change(screen.getByLabelText(/bilder/i), { target: { files: dateien } });
}

beforeEach(() => {
  uploads.length = 0;
  rpcAufrufe = [];
  uploadFehler = null;
  // Der Browser, nicht unser Code: jsdom hat beides nicht.
  vi.stubGlobal("createImageBitmap", async () => ({
    width: 4032,
    height: 3024,
    close: () => {},
  }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: () => {},
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((rueckruf) => {
    rueckruf(new Blob(["webp"], { type: "image/webp" }));
  });
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: () => "blob:vorschau",
    revokeObjectURL: () => {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Composer — ein Beitrag mit Bildern und Tags", () => {
  it("lädt beide Bilder in Reihenfolge hoch und legt Beitrag und Zeilen in EINEM Schritt an", async () => {
    renderFeed();
    oeffneComposer();

    fireEvent.change(screen.getByLabelText("Neuer Beitrag"), {
      target: { value: "Großartiger Erlebnistag in den Allgäuer Alpen! #Allgäu" },
    });
    waehleBilder(foto("a.jpg"), foto("b.jpg"));
    await screen.findByRole("button", { name: /bild 1 entfernen/i });

    // Ausdrücklich im Composer: dieselben Tags stehen seit Block 8 auch in der
    // Filterleiste, und ein unqualifiziertes `getByRole` fände beide.
    const tagAuswahl = await screen.findByRole("group", { name: /tags für diesen beitrag/i });
    fireEvent.click(within(tagAuswahl).getByRole("button", { name: "Netzwerken" }));
    fireEvent.click(screen.getByRole("button", { name: /posten/i }));

    /* Nur DIESE RPC zählen. Seit 6.6 holt die Spalte ihre zwei Aggregate
       ebenfalls über `rpc`, und ein Zähler über alle Aufrufe misst ab da
       Nachbarn statt der Zusage: der Beitrag und seine Bildzeilen entstehen in
       EINEM Schritt. */
    const anlegen = () => rpcAufrufe.filter((r) => r.name === "create_post_with_media");
    await waitFor(() => expect(anlegen()).toHaveLength(1));

    // Der Pfad trägt dieselbe Beitrags-id wie die RPC — sie entsteht im Client,
    // VOR dem Upload, sonst gäbe es keinen Pfad zum Hochladen.
    const postId = anlegen()[0].args.p_post_id as string;
    expect(uploads.map((u) => u.path)).toEqual([
      expect.stringMatching(new RegExp(`^test-user/${postId}/0-\\d+\\.webp$`)),
      expect.stringMatching(new RegExp(`^test-user/${postId}/1-\\d+\\.webp$`)),
    ]);

    expect(anlegen()[0].name).toBe("create_post_with_media");
    // 4032×3024 → 1600×1200: die echte `zielMasse` hat gerechnet.
    expect(anlegen()[0].args.p_media).toEqual([
      { storage_path: uploads[0].path, sort: 0, width: 1600, height: 1200 },
      { storage_path: uploads[1].path, sort: 1, width: 1600, height: 1200 },
    ]);
    // Getippt und geklickt gehen GETRENNT hinein; vereinigt wird in der RPC.
    expect(anlegen()[0].args.p_hashtags).toEqual(["allgäu"]);
    expect(anlegen()[0].args.p_tags).toEqual(["netzwerken"]);
    expect(anlegen()[0].args.p_visibility).toBe("members");
  });

  it("begrenzt hart auf sechs Bilder — mit sichtbarer Rückmeldung, nicht stillem Verschlucken", async () => {
    renderFeed();
    oeffneComposer();

    waehleBilder(...["1", "2", "3", "4", "5", "6", "7"].map((n) => foto(`${n}.jpg`)));

    expect(await screen.findByText(/höchstens sechs bilder/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /bild \d entfernen/i })).toHaveLength(6),
    );
  });

  it("entfernt ein einzelnes Bild und nummeriert die übrigen neu", async () => {
    renderFeed();
    oeffneComposer();

    waehleBilder(foto("a.jpg"), foto("b.jpg"));
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /bild \d entfernen/i })).toHaveLength(2),
    );

    fireEvent.click(screen.getByRole("button", { name: /bild 1 entfernen/i }));

    expect(screen.getAllByRole("button", { name: /bild \d entfernen/i })).toHaveLength(1);
  });

  /**
   * Die Ausrichtung selbst ist in jsdom nicht messbar — es rechnet kein Layout.
   * Messbar ist die STRUKTUR, die sie erzeugt: die Dateiauswahl und „Posten"
   * teilen sich denselben Aktionsbereich. Vorher lagen sie in getrennten
   * Zeilen, und genau daran ist diese Zusicherung rot gewesen.
   */
  it('legt die Dateiauswahl in dieselbe Aktionszeile wie „Posten"', () => {
    renderFeed();
    oeffneComposer();

    const auswahl = screen.getByLabelText("Bilder auswählen");
    const posten = screen.getByRole("button", { name: /posten/i });

    // Dateiauswahl und „Posten" liegen in DERSELBEN Gruppe — das ist das
    // Rechtsbündeln.
    const gruppe = auswahl.closest("div");
    expect(gruppe).not.toBeNull();
    expect(gruppe!.contains(posten)).toBe(true);

    // Und diese Gruppe teilt die Aktionszeile mit der Sichtbarkeit, die links
    // bleibt. Ohne diese zweite Zusicherung wäre der Test auch grün, wenn die
    // Gruppe irgendwo sonst im Composer stünde.
    const zeile = gruppe!.parentElement;
    expect(zeile).not.toBeNull();
    expect(zeile!.contains(screen.getByLabelText("Sichtbarkeit"))).toBe(true);
  });

  it("macht einen fremden Videolink nicht absendbar", async () => {
    renderFeed();
    oeffneComposer();

    fireEvent.change(screen.getByLabelText("Neuer Beitrag"), { target: { value: "Text" } });
    // Seit 6.3 liegt das Feld hinter der Medientyp-Zeile — es ist nicht mehr
    // von vornherein da.
    fireEvent.click(screen.getByRole("button", { name: /^video$/i }));
    fireEvent.change(screen.getByLabelText(/video-link/i), {
      target: { value: "https://evil.example.com/embed/x" },
    });

    expect(screen.getByRole("button", { name: /posten/i })).toBeDisabled();
    expect(screen.getByText(/nur youtube- oder vimeo-links/i)).toBeInTheDocument();
  });
});

/**
 * Die Medientyp-Zeile (AGE-582, 6.3).
 *
 * Sie benennt, was dieser Composer annimmt — und was er ausdrücklich NICHT
 * annimmt. Ein Knopf „Event" oder „Umfrage" gehört nicht dazu: Events entstehen
 * in `/events` und erscheinen im Feed als eigene Karte, eine Umfrage gibt es
 * nicht. Ein Knopf, dessen einziger Ausgang eine Enttäuschung ist, ist schlechter
 * als kein Knopf.
 */
describe("Composer — die Medientyp-Zeile", () => {
  it("bietet Bild und Video an, jedes mit einem Symbol", () => {
    renderFeed();
    oeffneComposer();

    const zeile = screen.getByRole("group", { name: /medien/i });
    const bild = within(zeile).getByText("Bild");
    const video = within(zeile).getByRole("button", { name: /^video$/i });

    // Das Symbol ist Teil der Zusage, nicht Zierde: 6.3 verlangt Icons aus dem
    // Satz. Geprüft wird am gezeichneten `<svg>`, nicht an einem Klassennamen.
    expect(bild.closest("label")!.querySelector("svg")).not.toBeNull();
    expect(video.querySelector("svg")).not.toBeNull();
  });

  it("trägt weder einen Event- noch einen Umfrage-Knopf", () => {
    renderFeed();
    oeffneComposer();

    const zeile = screen.getByRole("group", { name: /medien/i });
    expect(within(zeile).queryByText(/event/i)).toBeNull();
    expect(within(zeile).queryByText(/umfrage/i)).toBeNull();
  });

  it("zeigt das Videofeld erst auf Wunsch — und behält es, sobald etwas darin steht", () => {
    renderFeed();
    oeffneComposer();

    expect(screen.queryByLabelText(/video-link/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^video$/i }));
    const feld = screen.getByLabelText(/video-link/i);

    /* Der zweite Klick klappt wieder zu — aber nur, solange nichts drinsteht.
       Ein eingegebener Link, den ein Fehlklick unsichtbar macht, ginge beim
       Veröffentlichen trotzdem mit: der Composer hängt ihn an den Body. Das
       wäre ein Beitrag mit einem Video, von dem sein Verfasser nichts weiss. */
    fireEvent.change(feld, { target: { value: "https://www.youtube.com/watch?v=abc12345678" } });
    fireEvent.click(screen.getByRole("button", { name: /^video$/i }));
    expect(screen.getByLabelText(/video-link/i)).toBeInTheDocument();
  });
});
