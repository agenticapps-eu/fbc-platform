import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";
import { ToastProvider } from "../components/ui/Toast";

vi.mock("../lib/admin-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/admin-profile")>();
  return {
    ...actual,
    fetchAdminProfile: vi.fn(),
    saveAdminProfile: vi.fn(),
    changeLoginEmail: vi.fn(),
  };
});
import {
  changeLoginEmail,
  fetchAdminProfile,
  saveAdminProfile,
  type AdminProfileData,
} from "../lib/admin-profile";

import AdminMitgliedPage from "./AdminMitgliedPage";

const ZIEL = "c6c6c6c6-0000-0000-0000-0000000000b1";

const DATEN: AdminProfileData = {
  form: {
    name: "Importiert",
    region: "Berlin",
    company: "Alt GmbH",
    short_bio: "Kurz",
    avatar_url: null,
    cover_url: null,
    branche: "",
    headline: "",
    roles: [],
    competencies: [],
    website: "",
    dev_focus: "",
    socials: { linkedin: "", instagram: "", xing: "", facebook: "", youtube: "", twitter: "" },
    interests: [],
    goals: [],
    videos: [],
    // Die Kontaktzeile liegt seit AGE-537 IM Formular, nicht daneben: das
    // Mitglied pflegt sie jetzt selbst, und beide Editoren benutzen dieselbe
    // Feldgruppe.
    contact: {
      email: "kontakt@alt.de",
      phone: "",
      street: "Altstr. 3",
      postal_code: "80331",
      city: "München",
      state: "Bayern",
      country: "DE",
    },
  },
  legacy: {
    paid_until: "2027-06-30",
    legacy_tier: "Premium",
    legacy_price: "1200",
    legacy_source_id: "wp-4711",
    payment_type: "copecart",
  },
  loginEmail: "login@alt.de",
  activated: false,
  deaktiviert: false,
  geloescht: false,
};

beforeEach(() => {
  vi.mocked(fetchAdminProfile).mockReset().mockResolvedValue(DATEN);
  vi.mocked(saveAdminProfile).mockReset().mockResolvedValue(undefined);
  vi.mocked(changeLoginEmail).mockReset().mockResolvedValue({ status: "ok" });
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthFixture value={{ ...authAsTier("impact"), staffRole: "admin" }}>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/admin/mitglied/${ZIEL}`]}>
            <Routes>
              <Route path="/admin/mitglied/:id" element={<AdminMitgliedPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthFixture>
    </QueryClientProvider>,
  );
}

describe("AdminMitgliedPage (AGE-498)", () => {
  it("lädt über admin_get_profile — nicht über die Tabelle", async () => {
    renderPage();
    await screen.findByDisplayValue("Importiert");
    expect(fetchAdminProfile).toHaveBeenCalledWith(ZIEL);
  });

  // Der Anlassfall des ganzen Changes: ein importiertes, unbestätigtes Konto.
  // Es ist unter der RLS für niemanden sichtbar — die Seite muss es trotzdem
  // zeigen, und sichtbar machen, DASS es unbestätigt ist.
  it("zeigt ein unbestätigtes Profil und sagt das auch", async () => {
    renderPage();
    expect(await screen.findByText(/nicht bestätigt/i)).toBeInTheDocument();
  });

  it("bietet keine Bild-Steuerung an — die Bucket-Policies verlangen die eigene uid", async () => {
    renderPage();
    await screen.findByDisplayValue("Importiert");
    expect(screen.queryByText("Profilbild")).not.toBeInTheDocument();
    expect(screen.queryByText("Hintergrundbild")).not.toBeInTheDocument();
  });

  it("bietet keine Interessen und Ziele an — die Kind-Tabellen sind owner-only", async () => {
    renderPage();
    await screen.findByDisplayValue("Importiert");
    expect(screen.queryByText("Interessen")).not.toBeInTheDocument();
    expect(screen.queryByText("Ziele")).not.toBeInTheDocument();
  });

  it("zeigt Altdaten und beide Adressen nebeneinander", async () => {
    renderPage();
    expect(await screen.findByDisplayValue("2027-06-30")).toBeInTheDocument();
    expect(screen.getByDisplayValue("wp-4711")).toBeInTheDocument();
    expect(screen.getByDisplayValue("login@alt.de")).toBeInTheDocument();
    expect(screen.getByDisplayValue("kontakt@alt.de")).toBeInTheDocument();
  });

  it("zeigt die Anschrift und schickt sie im Patch mit (AGE-537)", async () => {
    renderPage();
    const ort = await screen.findByDisplayValue("München");
    fireEvent.change(ort, { target: { value: "Nürnberg" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(saveAdminProfile).toHaveBeenCalled());
    const [, form] = vi.mocked(saveAdminProfile).mock.calls[0];
    expect(form.contact.city).toBe("Nürnberg");
    expect(form.contact.street).toBe("Altstr. 3");
  });

  it("zeigt die Zahlungsart und schickt sie im Patch mit (AGE-581)", async () => {
    renderPage();

    // Vorbelegt aus den geladenen Altdaten — und zwar NACH dem Aufbau: die
    // Daten kommen aus einer Abfrage, ein `useState(wert)` beim ersten Zeichnen
    // nähme sie nie an. Genau diese Zeitachse prüft das `findBy`.
    const feld = await screen.findByLabelText("Zahlungsart");
    expect(feld).toHaveValue("copecart");

    fireEvent.change(feld, { target: { value: "rechnung" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(saveAdminProfile).toHaveBeenCalled());
    const [, , legacy] = vi.mocked(saveAdminProfile).mock.calls[0];
    expect(legacy.payment_type).toBe("rechnung");
    // Die Gegenprobe: die Nachbarfelder reisen unverändert mit, statt vom
    // Auswahlfeld überschrieben zu werden.
    expect(legacy.paid_until).toBe("2027-06-30");
    expect(legacy.legacy_source_id).toBe("wp-4711");
  });

  it("speichert über saveAdminProfile", async () => {
    renderPage();
    const name = await screen.findByDisplayValue("Importiert");
    fireEvent.change(name, { target: { value: "Korrigiert" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(saveAdminProfile).toHaveBeenCalled());
    const [id, form] = vi.mocked(saveAdminProfile).mock.calls[0];
    expect(id).toBe(ZIEL);
    expect(form.name).toBe("Korrigiert");
  });

  it("ändert die Login-Adresse über die Edge Function", async () => {
    renderPage();
    const login = await screen.findByDisplayValue("login@alt.de");
    fireEvent.change(login, { target: { value: "neu@fbc.de" } });
    fireEvent.click(screen.getByRole("button", { name: "Login-Adresse ändern" }));

    await waitFor(() => expect(changeLoginEmail).toHaveBeenCalledWith(ZIEL, "neu@fbc.de"));
  });

  // Die Adresse IST dann geändert. Als Fehler gemeldet, wiederholte der Admin
  // eine Änderung, die längst gilt.
  it("meldet nicht beendete Sitzungen als Hinweis, nicht als Fehler", async () => {
    vi.mocked(changeLoginEmail).mockResolvedValue({ status: "sessions_not_revoked" });
    renderPage();
    const login = await screen.findByDisplayValue("login@alt.de");
    fireEvent.change(login, { target: { value: "neu@fbc.de" } });
    fireEvent.click(screen.getByRole("button", { name: "Login-Adresse ändern" }));

    expect(await screen.findByText(/Sitzungen/i)).toBeInTheDocument();
    expect(screen.queryByText(/fehlgeschlagen/i)).not.toBeInTheDocument();
  });
});

describe("Die Kopfzeile nennt den Lebenszyklus (Sichtprobe 11.6)", () => {
  /**
   * Gefunden im Browser, nicht von einem Test: über einem GELÖSCHTEN Mitglied
   * stand „bestätigt" und darunter ein voll bearbeitbares Formular. Die Zeile
   * las allein `activated`; `admin_get_profile` liefert die Profilzeile als
   * `to_jsonb(p)` und trug `disabled_at`/`deleted_at` die ganze Zeit mit — sie
   * wurden nur nie gelesen.
   */
  it("meldet ein gelöschtes Mitglied als gelöscht, nicht als bestätigt", async () => {
    vi.mocked(fetchAdminProfile).mockResolvedValue({
      ...DATEN,
      activated: true,
      geloescht: true,
    });
    renderPage();

    expect(await screen.findByText(/gelöscht —/)).toBeInTheDocument();
    // Der Kern der Zusage: NICHT bloss „gelöscht steht da", sondern dass das
    // gegenteilige Wort weg ist. Ein gelöschtes Mitglied KANN vorher bestätigt
    // gewesen sein — genau deshalb stand hier vorher das Falsche.
    expect(screen.queryByText("bestätigt")).toBeNull();
  });

  it("meldet ein deaktiviertes Mitglied als deaktiviert", async () => {
    vi.mocked(fetchAdminProfile).mockResolvedValue({
      ...DATEN,
      activated: true,
      deaktiviert: true,
    });
    renderPage();

    expect(await screen.findByText(/deaktiviert —/)).toBeInTheDocument();
    expect(screen.queryByText("bestätigt")).toBeNull();
  });

  /** Gelöscht schlägt deaktiviert — dieselbe Rangfolge wie in der Liste. */
  it("nennt bei beiden Merkmalen die Löschung", async () => {
    vi.mocked(fetchAdminProfile).mockResolvedValue({
      ...DATEN,
      activated: true,
      deaktiviert: true,
      geloescht: true,
    });
    renderPage();

    expect(await screen.findByText(/gelöscht —/)).toBeInTheDocument();
    expect(screen.queryByText(/deaktiviert —/)).toBeNull();
  });

  it("lässt die beiden bisherigen Fälle unberührt", async () => {
    vi.mocked(fetchAdminProfile).mockResolvedValue({ ...DATEN, activated: true });
    const { unmount } = renderPage();
    expect(await screen.findByText("bestätigt")).toBeInTheDocument();
    unmount();

    vi.mocked(fetchAdminProfile).mockResolvedValue({ ...DATEN, activated: false });
    renderPage();
    expect(await screen.findByText(/nicht bestätigt —/)).toBeInTheDocument();
  });
});
