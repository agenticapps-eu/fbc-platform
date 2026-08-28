import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, fakeAuthValue } from "../test/auth-fixtures";
import type { AuthContextValue } from "../providers/auth-context";
import { ToastProvider } from "../components/ui/Toast";
import { DesignVariantProvider } from "../providers/DesignVariantProvider";

vi.mock("../lib/member-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/member-settings")>();
  return {
    ...actual,
    fetchMemberSettings: vi.fn(),
    saveMemberSettings: vi.fn(),
    saveMemberTheme: vi.fn(),
  };
});
import {
  fetchMemberSettings,
  saveMemberSettings,
  saveMemberTheme,
  DEFAULT_MEMBER_SETTINGS,
} from "../lib/member-settings";
vi.mock("../lib/feedback", () => ({ fetchAdminFeedback: vi.fn() }));
import { fetchAdminFeedback } from "../lib/feedback";
import EinstellungenPage from "./EinstellungenPage";

const mockedFetch = vi.mocked(fetchMemberSettings);
const mockedSave = vi.mocked(saveMemberSettings);
const mockedSaveTheme = vi.mocked(saveMemberTheme);
const mockedAdminFeedback = vi.mocked(fetchAdminFeedback);

beforeEach(() => {
  mockedFetch.mockReset();
  mockedFetch.mockResolvedValue(DEFAULT_MEMBER_SETTINGS);
  mockedSave.mockReset();
  mockedSave.mockResolvedValue();
  mockedSaveTheme.mockReset();
  mockedSaveTheme.mockResolvedValue();
  mockedAdminFeedback.mockReset();
  mockedAdminFeedback.mockResolvedValue({ feedbacks: [], hatWeitere: false });
  localStorage.clear();
});

function renderPage(
  staffRole: string | null = null,
  authOverrides: Partial<AuthContextValue> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const value = fakeAuthValue({
    user: { id: "u1", email: "legacy@fbcdemo.de" } as AuthContextValue["user"],
    tier: "legacy",
    levelRank: 7,
    staffRole,
    ...authOverrides,
  });
  return render(
    <AuthFixture value={value}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DesignVariantProvider>
            <MemoryRouter>
              <EinstellungenPage />
            </MemoryRouter>
          </DesignVariantProvider>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

describe("EinstellungenPage", () => {
  it("zeigt Konto-Infos und persistiert einen Sichtbarkeits-Toggle", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Einstellungen" })).toBeInTheDocument();
    expect(screen.getByText("legacy@fbcdemo.de")).toBeInTheDocument();
    const toggle = await screen.findByRole("switch", { name: /Im Verzeichnis sichtbar/ });
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(mockedSave).toHaveBeenCalledWith("u1", {
        ...DEFAULT_MEMBER_SETTINGS,
        visible_in_directory: false,
      }),
    );
  });

  // AGE-492 — der Theme-Schalter. Er läuft bewusst NICHT über saveMemberSettings:
  // die schreibt alle Präferenzen in einem Upsert und überschriebe das Theme mit
  // einem veralteten Cache-Wert.
  it("schaltet das Theme sofort um und schreibt es zum Server", async () => {
    renderPage();
    const toggle = await screen.findByRole("switch", { name: /Dunkles Design/ });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fireEvent.click(toggle);

    // Sofort sichtbar, nicht erst nach der Speicher-Bestätigung.
    await waitFor(() => expect(document.documentElement.dataset.variant).toBe("navy"));
    expect(localStorage.getItem("fbc.designVariant")).toBe("navy");
    await waitFor(() => expect(mockedSaveTheme).toHaveBeenCalledWith("u1", "navy"));
  });

  it("schreibt das Theme nicht über die Präferenz-Mutation", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("switch", { name: /Dunkles Design/ }));
    await waitFor(() => expect(mockedSaveTheme).toHaveBeenCalled());
    expect(mockedSave).not.toHaveBeenCalled();
  });

  // AGE-492, aus dem Plan-Review (codex): der Server-Write war mit einem leeren
  // catch abgefangen. Das Theme steht dann lokal auf navy, der Server auf hell —
  // und der nächste Login holt still den alten Wert zurück. Der Fehlschlag muss
  // also sichtbar sein; die lokale Wahl bleibt trotzdem stehen.
  it("meldet einen fehlgeschlagenen Server-Write und behält das Theme lokal", async () => {
    mockedSaveTheme.mockRejectedValue(new Error("offline"));
    renderPage();

    fireEvent.click(await screen.findByRole("switch", { name: /Dunkles Design/ }));

    expect(await screen.findByText("Design nicht gespeichert")).toBeInTheDocument();
    expect(document.documentElement.dataset.variant).toBe("navy");
  });

  it("zeigt den Schalter aktiv, wenn navy läuft", async () => {
    localStorage.setItem("fbc.designVariant", "navy");
    renderPage();
    expect(await screen.findByRole("switch", { name: /Dunkles Design/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  // AGE-450: „Prime" ist altes Wording (6-Level-Modell kennt kein Prime mehr).
  it("nennt die Kontakt-Einstellung neutral „Andere Mitglieder“", async () => {
    renderPage();
    expect(
      await screen.findByRole("switch", { name: "Andere Mitglieder dürfen mich kontaktieren" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: /Prime-Mitglieder/ })).toBeNull();
  });

  // AGE-450: Passwort ändern in den Einstellungen.
  it("ändert das Passwort über updatePassword", async () => {
    const updatePassword = vi.fn().mockResolvedValue({ error: null });
    renderPage(null, { updatePassword });
    const pw = await screen.findByLabelText("Neues Passwort");
    fireEvent.change(pw, { target: { value: "neuesPasswort1" } });
    fireEvent.change(screen.getByLabelText("Neues Passwort bestätigen"), {
      target: { value: "neuesPasswort1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));
    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith("neuesPasswort1"));
  });

  it("ruft updatePassword nicht auf, wenn die Passwörter nicht übereinstimmen", async () => {
    const updatePassword = vi.fn().mockResolvedValue({ error: null });
    renderPage(null, { updatePassword });
    const pw = await screen.findByLabelText("Neues Passwort");
    fireEvent.change(pw, { target: { value: "neuesPasswort1" } });
    fireEvent.change(screen.getByLabelText("Neues Passwort bestätigen"), {
      target: { value: "tippfehler2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));
    expect(updatePassword).not.toHaveBeenCalled();
    expect(screen.getByText(/stimmen nicht überein/i)).toBeInTheDocument();
  });

  // AGE-656: Das Formular versprach 8 Zeichen, GoTrue verlangt 10
  // (`minimum_password_length`, config.toml:230). Wer 8 oder 9 wählte, kam durch
  // die Feldprüfung, wurde vom Server abgelehnt — und sein Passwort blieb
  // unverändert. openspec/specs/access-control/spec.md verlangt, dass die
  // Oberfläche dieselbe Länge fordert wie der Server.
  it("ruft updatePassword nicht auf, wenn das Passwort neun Zeichen hat (AGE-656)", async () => {
    const updatePassword = vi.fn().mockResolvedValue({ error: null });
    renderPage(null, { updatePassword });
    const pw = await screen.findByLabelText("Neues Passwort");
    fireEvent.change(pw, { target: { value: "neunZeich" } });
    fireEvent.change(screen.getByLabelText("Neues Passwort bestätigen"), {
      target: { value: "neunZeich" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));
    expect(updatePassword).not.toHaveBeenCalled();
    expect(screen.getByText(/mindestens 10 Zeichen/i)).toBeInTheDocument();
  });

  // AGE-578: Die QM-Feedback-Card ist nach /admin umgezogen. Vorher standen hier
  // drei Zusagen, die das Rollen-Gating prüften — das gibt es nicht mehr, also
  // prüften sie nichts. Die eine Zusage, die den Umzug wirklich belegt, ist die
  // für den ADMIN: bei ihm stand die Card, bei ihm muss sie verschwunden sein.
  it("zeigt die QM-Feedback-Card nicht mehr — auch einem Admin nicht (AGE-578)", async () => {
    renderPage("admin");
    await screen.findByRole("heading", { name: "Einstellungen" });
    expect(screen.queryByText("QM-Feedback")).toBeNull();
    // Nicht nur unsichtbar, sondern gar nicht erst angefragt: eine Card, die
    // lädt und dann nichts zeigt, wäre kein Umzug.
    expect(mockedAdminFeedback).not.toHaveBeenCalled();
  });

  // AGE-641 — die zwei Schalter, die mit der Umbenennung dazukamen. Chat und
  // Kontaktanfragen waren die einzigen Hinweistypen ohne eigenen Schalter:
  // Nachrichten gab es als Typ noch gar nicht, und die drei
  // contact_request*-Typen fielen in `hinweis_erwuenscht` durch das `case`
  // hindurch auf „immer an".
  //
  // Geprüft wird über den ZUGESTELLTEN Wert, nicht über die Anwesenheit im
  // Markup: dass ein Schalter dasteht, sagt nicht, dass er den richtigen
  // Schlüssel schreibt — ein auf `notify_app_like` verdrahteter Schalter mit der
  // Aufschrift „Wenn mir jemand schreibt" bestünde eine reine Sichtprüfung.
  it("schreibt den Nachrichten-Schalter unter seinem eigenen Schlüssel (AGE-641)", async () => {
    renderPage();
    const toggle = await screen.findByRole("switch", { name: /Wenn mir jemand schreibt/ });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(mockedSave).toHaveBeenCalledWith("u1", {
        ...DEFAULT_MEMBER_SETTINGS,
        notify_app_message: false,
      }),
    );
  });

  it("schreibt den Kontaktanfragen-Schalter unter seinem eigenen Schlüssel (AGE-641)", async () => {
    renderPage();
    const toggle = await screen.findByRole("switch", {
      name: /Kontaktanfragen und Antworten darauf/,
    });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(mockedSave).toHaveBeenCalledWith("u1", {
        ...DEFAULT_MEMBER_SETTINGS,
        notify_app_contact: false,
      }),
    );
  });

  // Die Karte trägt jetzt SECHS Zeilen. Die Zahl steht hier, damit ein
  // stillschweigend verschwundener Schalter auffällt — der häufigere Fehler ist
  // nicht der falsche Schalter, sondern der, den ein Merge wegräumt.
  it("führt alle sechs App-Schalter in der Glocken-Karte (AGE-641)", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Einstellungen" });
    for (const name of [
      /Wenn jemand einen Beitrag schreibt/,
      /Wenn ein Event angelegt wird/,
      /Wenn jemand meinen Beitrag kommentiert/,
      /Wenn jemandem mein Beitrag gefällt/,
      /Wenn mir jemand schreibt/,
      /Kontaktanfragen und Antworten darauf/,
    ]) {
      expect(screen.getByRole("switch", { name })).toBeInTheDocument();
    }
  });
});
