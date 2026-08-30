import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CommunityFeed from "./CommunityFeed";
import { ToastProvider } from "../ui/Toast";
import {
  createPostWithMedia,
  fetchFeed,
  updatePost,
  istGeplant,
  type FeedPost,
} from "../../lib/feed";
import { AuthFixture, fakeAuthValue } from "../../test/auth-fixtures";

/**
 * Einen Beitrag jetzt schreiben und später live schalten (AGE-667).
 *
 * WAS DIESE DATEI NICHT PRÜFT, UND ZWAR ABSICHTLICH: dass ein Fremder den
 * geplanten Beitrag nicht sieht. Das ist keine Zusage der Oberfläche — sie
 * bekommt die Zeile gar nicht erst geliefert. Gemessen wird es dort, wo die
 * Grenze liegt, in `supabase/tests/geplante_beitraege_test.sql`, und zwar mit
 * Positivkontrolle. Ein Test, der hier eine Karte NICHT findet, wäre auch dann
 * grün, wenn die RLS offen stünde.
 *
 * Hier stehen deshalb nur die drei Dinge, die wirklich an der Oberfläche
 * hängen: der gewählte Zeitpunkt geht nach unten, die eigene Karte markiert
 * ihn, und der Verfasser kommt wieder davon los.
 */
vi.mock("../../lib/feed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/feed")>()),
  fetchFeed: vi.fn(),
  fetchComments: vi.fn(),
  createPostWithMedia: vi.fn(),
  updatePost: vi.fn(),
}));

vi.mock("../../lib/post-media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/post-media")>()),
  uploadPostMedia: vi.fn(async () => []),
}));

const ICH = "u-ich";

/** Weit genug in der Zukunft, dass kein Lauf der Suite ihn einholt. */
const FREITAG = "2030-09-06T18:00:00Z";

function post(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: "p1",
    author: { id: ICH, name: "Ich Selbst", avatarUrl: null, tier: "impact" },
    body: "Mein Beitrag",
    hashtags: [],
    visibility: "members",
    createdAt: new Date("2026-08-01T10:00:00Z").toISOString(),
    // ABSICHTLICH weit in der VERGANGENHEIT. Ein Fixture, das auf „heute"
    // datiert ist, wechselt im Lauf eines Tages die Seite der Grenze — und
    // dieser Test misst genau die Grenze.
    veroeffentlichtAb: new Date("2026-08-01T10:00:00Z").toISOString(),
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

function renderFeed(posts: FeedPost[]) {
  vi.mocked(fetchFeed).mockResolvedValue({ posts, nextCursor: null });
  vi.mocked(createPostWithMedia).mockResolvedValue(undefined);
  vi.mocked(updatePost).mockResolvedValue(undefined);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <AuthFixture
      value={fakeAuthValue({ user: { id: ICH } as never, tier: "impact", levelRank: 6 })}
    >
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
  vi.mocked(fetchFeed).mockReset();
  vi.mocked(createPostWithMedia).mockReset();
  vi.mocked(updatePost).mockReset();
});

describe("istGeplant — die Grenze an beiden Seiten", () => {
  // `jetzt` ist deshalb ein Parameter und kein `new Date()` im Rumpf: sonst
  // müsste dieser Test auf die Wanduhr warten, um die zweite Seite der Grenze
  // zu messen — und ein Test, der nur EINE Seite misst, ist grün, sobald die
  // Funktion konstant antwortet.
  const jetzt = new Date("2026-08-29T12:00:00Z");

  it("eine Sekunde davor ist geplant", () => {
    expect(istGeplant("2026-08-29T12:00:01Z", jetzt)).toBe(true);
  });

  it("der Moment selbst ist NICHT mehr geplant", () => {
    // Die Datenbank entscheidet mit `veroeffentlicht_ab <= now()`, also ist der
    // Zeitpunkt selbst schon sichtbar. Stünde hier `<`, markierte die Karte
    // eine Sekunde lang „geplant" an etwas, das alle sehen.
    expect(istGeplant("2026-08-29T12:00:00Z", jetzt)).toBe(false);
  });

  it("eine Sekunde danach ebenso wenig", () => {
    expect(istGeplant("2026-08-29T11:59:59Z", jetzt)).toBe(false);
  });
});

describe("Composer — den Zeitpunkt wählen", () => {
  it("ohne Eingabe geht `null` nach unten, nicht etwa `now()` aus dem Client", async () => {
    // Die Anhebung eines vergangenen Werts auf `now()` sitzt in der RPC. Würde
    // der Client hier selbst einen Zeitstempel setzen, gäbe es zwei Quellen
    // für denselben Wert — und die Uhr des Browsers entschiede mit.
    renderFeed([]);
    fireEvent.click(
      await screen.findByRole("button", { name: /was möchtest du mit der community teilen/i }),
    );
    fireEvent.change(screen.getByLabelText("Neuer Beitrag"), { target: { value: "Sofort" } });
    fireEvent.click(screen.getByRole("button", { name: /^posten$/i }));

    await waitFor(() => expect(createPostWithMedia).toHaveBeenCalled());
    expect(vi.mocked(createPostWithMedia).mock.calls[0][0].veroeffentlichtAb).toBeNull();
  });

  it("mit Datum UND Uhrzeit geht der absolute Moment nach unten", async () => {
    renderFeed([]);
    fireEvent.click(
      await screen.findByRole("button", { name: /was möchtest du mit der community teilen/i }),
    );
    fireEvent.change(screen.getByLabelText("Neuer Beitrag"), { target: { value: "Für Freitag" } });
    // `datetime-local` trägt WANDUHRZEIT. Was unten ankommt, muss ein
    // absoluter Moment sein — sonst verschöbe eine Zeitzone den Beitrag.
    fireEvent.change(screen.getByLabelText(/sichtbar ab/i), {
      target: { value: "2030-09-06T18:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^posten$/i }));

    await waitFor(() => expect(createPostWithMedia).toHaveBeenCalled());
    const gesendet = vi.mocked(createPostWithMedia).mock.calls[0][0].veroeffentlichtAb;
    expect(gesendet).toBe(new Date("2030-09-06T18:00").toISOString());
  });
});

describe("Die eigene Karte markiert den geplanten Beitrag", () => {
  it("nennt Datum und Uhrzeit, nicht „vor x Tagen“", async () => {
    // „in 4 Jahren" beantwortet die Frage nicht, die jemand an seinen eigenen
    // geplanten Beitrag hat: er hat einen Zeitpunkt gewählt und will ihn
    // wiedererkennen.
    renderFeed([post({ veroeffentlichtAb: FREITAG })]);
    const markierung = await screen.findByText(/geplant für/i);
    expect(markierung.textContent).toMatch(/\d{2}:\d{2} Uhr/);
  });

  it("ein veröffentlichter Beitrag trägt die Markierung NICHT", async () => {
    // Die Positivkontrolle zur Zusage darüber: ohne sie wäre der Test auch
    // grün, wenn die Markierung nirgends erschiene.
    renderFeed([post()]);
    await screen.findByText("Mein Beitrag");
    expect(screen.queryByText(/geplant für/i)).toBeNull();
  });
});

describe("Ein veröffentlichter Beitrag wird beim Bearbeiten NICHT umdatiert", () => {
  it("eine Textkorrektur lässt `veroeffentlichtAb` unberührt", async () => {
    // Der Befund aus dem Diff-Review: mit nur zwei Zuständen (`null` = sofort)
    // ist „ich habe am Zeitpunkt nichts geändert" von „mach ihn jetzt sichtbar"
    // nicht zu unterscheiden. Jede Korrektur an einem alten Beitrag hätte ihn
    // auf jetzt umdatiert und im Feed nach oben geschoben.
    renderFeed([post()]);
    fireEvent.click(await screen.findByRole("button", { name: /bearbeiten/i }));

    // Bei einem veröffentlichten Beitrag ist das Feld absichtlich LEER — sonst
    // stünde dort ein Datum, das niemand gewählt hat.
    expect((screen.getByLabelText(/sichtbar ab/i) as HTMLInputElement).value).toBe("");

    fireEvent.change(screen.getByLabelText(/beitragstext bearbeiten/i), {
      target: { value: "Korrigierter Text" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^speichern$/i }));

    await waitFor(() => expect(updatePost).toHaveBeenCalled());
    const gesendet = vi.mocked(updatePost).mock.calls[0][0];
    expect(gesendet.body).toBe("Korrigierter Text");
    // `undefined`, nicht `null`: die Spalte darf gar nicht erst im Update stehen.
    expect(gesendet.veroeffentlichtAb).toBeUndefined();
  });
});

describe("Die Planung wieder loswerden", () => {
  it("„sofort“ im Bearbeiten-Formular schickt null — der Beitrag geht live", async () => {
    renderFeed([post({ veroeffentlichtAb: FREITAG })]);
    fireEvent.click(await screen.findByRole("button", { name: /bearbeiten/i }));

    // Das Feld ist mit dem geplanten Zeitpunkt VORBELEGT — sonst nähme ein
    // Klick auf „Speichern" die Planung versehentlich zurück.
    const feld = screen.getByLabelText(/sichtbar ab/i) as HTMLInputElement;
    expect(feld.value).not.toBe("");

    fireEvent.click(screen.getByRole("button", { name: /^sofort$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^speichern$/i }));

    await waitFor(() => expect(updatePost).toHaveBeenCalled());
    expect(vi.mocked(updatePost).mock.calls[0][0].veroeffentlichtAb).toBeNull();
  });
});
