import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { ToastProvider } from "../components/ui/Toast";
import { AuthFixture, authAsTier } from "../test/auth-fixtures";

/**
 * Die Willkommensstrecke (AGE-538, C11).
 *
 * Gemockt wird ausschließlich der Rand zur Datenbank — kein `vi.mock` auf eine
 * eigene Komponente. Gerendert wird über `<App />` und nicht die Seite isoliert:
 * die Hälfte der Zusagen hier ist eine Aussage über den ÜBERGANG („führt zur
 * Startseite", „kommt nicht zurück"), und die entsteht erst aus Route, Weiche
 * und Ziel zusammen.
 */

vi.mock("../lib/member-onboarding", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/member-onboarding")>()),
  fetchOnboardingProfile: vi.fn(),
  fetchOnboardingFreetext: vi.fn(),
  saveOnboardingHeadline: vi.fn(),
  saveOnboardingRegion: vi.fn(),
  saveOnboardingAvatarUrl: vi.fn(),
}));
import {
  fetchOnboardingFreetext,
  fetchOnboardingProfile,
  saveOnboardingHeadline,
  saveOnboardingRegion,
} from "../lib/member-onboarding";

vi.mock("../lib/member-settings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/member-settings")>()),
  fetchOnboardedAt: vi.fn(),
  markOnboarded: vi.fn(),
}));
import {
  fetchOnboardedAt,
  markOnboarded,
  vertagungZuruecksetzen,
} from "../lib/member-settings";

vi.mock("../lib/profile-categories", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/profile-categories")>()),
  fetchCategorySelection: vi.fn(),
  saveCategorySelection: vi.fn(),
}));
import { fetchCategorySelection, saveCategorySelection } from "../lib/profile-categories";

vi.mock("../lib/profile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/profile")>()),
  saveProfile: vi.fn(),
}));
import { saveProfile } from "../lib/profile";

vi.mock("../lib/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/dashboard")>()),
  fetchDashboard: vi.fn(),
}));
import { fetchDashboard } from "../lib/dashboard";

const profilMock = vi.mocked(fetchOnboardingProfile);
const freitextMock = vi.mocked(fetchOnboardingFreetext);
const headlineMock = vi.mocked(saveOnboardingHeadline);
const regionMock = vi.mocked(saveOnboardingRegion);
const merkerMock = vi.mocked(fetchOnboardedAt);
const setzeMerkerMock = vi.mocked(markOnboarded);
const kategorienMock = vi.mocked(fetchCategorySelection);
const speichereKategorienMock = vi.mocked(saveCategorySelection);
const saveProfileMock = vi.mocked(saveProfile);
const dashboardMock = vi.mocked(fetchDashboard);

/** Nur der Fehlerpfad des Dashboards erzeugt ein Signal, das ALLEIN die
 *  Startseite hat. Die Shell-Navigation taugt nicht: sie steht auch, während die
 *  Weiche noch entscheidet. */
const STARTSEITE = "Dashboard konnte nicht geladen werden. Bitte neu laden.";
const STRECKE = "Schön, dass du da bist";

beforeEach(() => {
  vi.clearAllMocks();
  vertagungZuruecksetzen();
  profilMock.mockResolvedValue({ headline: "", avatar_url: null, region: "" });
  freitextMock.mockResolvedValue({ offers: [], needs: [] });
  kategorienMock.mockResolvedValue({ offers: [], needs: [] });
  headlineMock.mockResolvedValue();
  regionMock.mockResolvedValue();
  speichereKategorienMock.mockResolvedValue();
  setzeMerkerMock.mockResolvedValue("2026-08-14T10:00:00Z");
  merkerMock.mockResolvedValue(null);
  dashboardMock.mockRejectedValue(new Error("kein Netz im Test"));
});

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <AuthFixture value={authAsTier("basic")}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </AuthFixture>,
  );
}

/** Wartet, bis die Strecke steht (nicht mehr lädt). */
async function strecke() {
  renderAt("/willkommen");
  await screen.findByText(/^Schritt 1 von/);
}

const klick = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));

describe("Willkommensstrecke — Gerüst und Auswege", () => {
  it("erklärt den Nutzen vor der ersten Frage, aus Sicht des Mitglieds", async () => {
    await strecke();

    expect(screen.getByRole("heading", { name: STRECKE })).toBeInTheDocument();
    const erklaerung = screen.getByText(/Zwei Minuten, und die anderen Mitglieder finden dich/);
    expect(erklaerung).toBeInTheDocument();
    // Sie spricht davon, was das MITGLIED davon hat. Das ist der Unterschied
    // zwischen einem Empfang und einer Formularwand — und er ist prüfbar.
    expect(erklaerung.textContent).toMatch(/finden dich/);
    expect(erklaerung.textContent).not.toMatch(/Plattform|Club braucht|wir brauchen/i);

    // Und sie steht VOR der Frage, nicht daneben.
    const frage = screen.getByRole("heading", { name: "Was machst du beruflich?" });
    expect(
      erklaerung.compareDocumentPosition(frage) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it.each([0, 1, 2])(
    "bietet „Später\" auch auf Schritt %i an — und setzt den Merker dort nicht",
    async (schrittIndex) => {
      await strecke();
      for (let i = 0; i < schrittIndex; i++) {
        klick("Weiter");
        await screen.findByText(new RegExp(`^Schritt ${i + 2} von`));
      }

      klick("Später");

      expect(await screen.findByText(STARTSEITE)).toBeInTheDocument();
      expect(setzeMerkerMock).not.toHaveBeenCalled();
    },
  );

  it("lässt die Strecke nach „Später\" wiederkommen", async () => {
    await strecke();
    klick("Später");
    await screen.findByText(STARTSEITE);

    // „Vertagt" gilt für diese Anwendungssitzung — nach dem Abmelden oder einem
    // Neuladen ist es weg. Genau das wird hier nachgestellt.
    vertagungZuruecksetzen();
    renderAt("/");

    expect(await screen.findByRole("heading", { name: STRECKE })).toBeInTheDocument();
  });

  it.each([0, 1, 2])(
    "zeigt vor dem Überspringen auf Schritt %i erst den Hinweis, dann die Startseite",
    async (schrittIndex) => {
      await strecke();
      for (let i = 0; i < schrittIndex; i++) {
        klick("Weiter");
        await screen.findByText(new RegExp(`^Schritt ${i + 2} von`));
      }

      klick("Überspringen");

      // Der Hinweis steht davor — die Startseite ist noch nicht da.
      expect(await screen.findByRole("heading", { name: "Einen Moment noch" })).toBeInTheDocument();
      expect(screen.queryByText(STARTSEITE)).not.toBeInTheDocument();
      expect(setzeMerkerMock).not.toHaveBeenCalled();

      klick("Trotzdem überspringen");

      expect(await screen.findByText(STARTSEITE)).toBeInTheDocument();
      expect(setzeMerkerMock).toHaveBeenCalledWith("test-user");
    },
  );

  it("benennt im Hinweis den Kompass-Filter, ohne zu drohen", async () => {
    await strecke();
    klick("Überspringen");
    const hinweis = await screen.findByText(/Ohne Kategorien findet dich der Kompass-Filter/);

    expect(hinweis.textContent).toMatch(/Kompass-Filter/);
    expect(hinweis.textContent).toMatch(/jederzeit in deinem Profil nachholen/);
    // Kein Drohton: die Zusicherung prüft den Text, nicht nur seine Existenz.
    expect(hinweis.textContent).not.toMatch(/verlierst|letzte Chance|musst|sonst/i);
    // Und der Rückweg steht daneben, sonst wäre der Hinweis ein Druckmittel.
    expect(screen.getByRole("button", { name: "Doch ausfüllen" })).toBeInTheDocument();
  });

  it("setzt den Merker beim Abschluss des letzten Schritts", async () => {
    await strecke();
    klick("Weiter");
    await screen.findByText(/^Schritt 2 von/);
    klick("Weiter");
    await screen.findByText(/^Schritt 3 von/);
    klick("Fertig");

    await waitFor(() => expect(setzeMerkerMock).toHaveBeenCalledWith("test-user"));
    expect(await screen.findByText(STARTSEITE)).toBeInTheDocument();
  });

  it("kehrt nach dem Abschluss NICHT in die Strecke zurück", async () => {
    // Der gelesene Zustand muss nachziehen, BEVOR navigiert wird. Zieht er erst
    // danach nach, schickt die Startseite das Mitglied in die eben beendete
    // Strecke zurück. `fetchOnboardedAt` liefert weiter `null` — genau deshalb
    // ist das hier eine echte Prüfung und keine Tautologie.
    await strecke();
    klick("Weiter");
    await screen.findByText(/^Schritt 2 von/);
    klick("Weiter");
    await screen.findByText(/^Schritt 3 von/);
    klick("Fertig");

    expect(await screen.findByText(STARTSEITE)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: STRECKE })).not.toBeInTheDocument();
  });

  it("zählt einen entfallenen Schritt nicht mit", async () => {
    // Profilbild UND Standort stehen schon → zwei Schritte, nicht drei. Ein Test
    // gegen eine feste Drei wäre vorher wie nachher grün.
    profilMock.mockResolvedValue({
      headline: "",
      avatar_url: "https://example.test/bild.webp",
      region: "München",
    });
    await strecke();

    expect(screen.getByText("Schritt 1 von 2")).toBeInTheDocument();

    klick("Weiter");
    expect(await screen.findByText("Schritt 2 von 2")).toBeInTheDocument();
    // Die Strecke endet nach dem zweiten Schritt.
    expect(screen.getByRole("button", { name: "Fertig" })).toBeInTheDocument();
  });

  it("beginnt die Wiederkehr beim ersten leeren Feld", async () => {
    // Berufsbezeichnung steht, Kategorien fehlen → Einstieg bei Schritt 2.
    profilMock.mockResolvedValue({ headline: "Steuerberaterin", avatar_url: null, region: "" });
    renderAt("/willkommen");

    expect(await screen.findByText("Schritt 2 von 3")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Was bietest du — und was suchst du?" }),
    ).toBeInTheDocument();
  });
});

describe("Schritt 1 — Berufsbezeichnung", () => {
  it("belegt eine vorhandene Berufsbezeichnung vor und fragt bestätigend", async () => {
    profilMock.mockResolvedValue({ headline: "Steuerberaterin", avatar_url: null, region: "" });
    renderAt("/willkommen");
    await screen.findByText(/^Schritt/);

    // Der Einstieg liegt bei Schritt 2 — zurück auf Schritt 1 führt hier kein
    // Weg, deshalb prüft dieser Test die Vorbelegung dort, wo sie entsteht:
    // an einem Konto, dem sonst nichts fehlt.
    profilMock.mockResolvedValue({
      headline: "Steuerberaterin",
      avatar_url: "https://example.test/bild.webp",
      region: "München",
    });
    kategorienMock.mockResolvedValue({ offers: ["kapital"], needs: [] });
    renderAt("/willkommen");

    const feld = await screen.findByLabelText("Berufsbezeichnung");
    expect(feld).toHaveValue("Steuerberaterin");
    expect(screen.getByRole("heading", { name: "Stimmt das noch?" })).toBeInTheDocument();
  });

  it("fragt bei leerer Berufsbezeichnung fragend, mit leerem Feld", async () => {
    await strecke();

    expect(screen.getByLabelText("Berufsbezeichnung")).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Was machst du beruflich?" })).toBeInTheDocument();
  });

  it("schreibt NUR die Berufsbezeichnung — nicht über saveProfile", async () => {
    // Der eigentliche Punkt. `saveProfile` schreibt alle Profilspalten, upsertet
    // die Kontaktzeile bedingungslos und ERSETZT Interessen und Ziele. Aus einem
    // Ein-Feld-Schritt heraus räumte es bei einem importierten Mitglied genau
    // den Bestand weg, für den der Import gebaut wurde.
    await strecke();
    fireEvent.change(screen.getByLabelText("Berufsbezeichnung"), {
      target: { value: "Steuerberaterin" },
    });
    klick("Weiter");

    await waitFor(() =>
      expect(headlineMock).toHaveBeenCalledWith("test-user", "Steuerberaterin"),
    );
    expect(saveProfileMock).not.toHaveBeenCalled();
  });

  it("hat den Wert schon geschrieben, wenn die Strecke danach abbricht", async () => {
    // Geschrieben wird beim Weitergehen, nicht am Ende der Strecke.
    await strecke();
    fireEvent.change(screen.getByLabelText("Berufsbezeichnung"), {
      target: { value: "Steuerberaterin" },
    });
    klick("Weiter");
    await screen.findByText(/^Schritt 2 von/);

    klick("Später");
    await screen.findByText(STARTSEITE);

    expect(headlineMock).toHaveBeenCalledWith("test-user", "Steuerberaterin");
    expect(setzeMerkerMock).not.toHaveBeenCalled();
  });
});

describe("Schritt 2 — Kompass-Kategorien", () => {
  async function schrittZwei() {
    await strecke();
    klick("Weiter");
    await screen.findByText(/^Schritt 2 von/);
  }

  it("zeigt die Kategorien beider Seiten aus der gemeinsamen Vokabularquelle", async () => {
    const { categoryOptionsForSide } = await import("../lib/profile-categories");
    await schrittZwei();

    expect(screen.getByRole("heading", { name: "Ich biete" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ich suche" })).toBeInTheDocument();
    // Keine feste Gesamtzahl zusichern: die Werte überschneiden sich zwischen
    // den Seiten (`immobilien` steht auf beiden). Geprüft wird die QUELLE.
    for (const seite of ["offer", "need"] as const) {
      for (const opt of categoryOptionsForSide(seite)) {
        expect(screen.getAllByRole("button", { name: opt.label }).length).toBeGreaterThan(0);
      }
    }
  });

  it("macht eine bereits gesetzte Kategorie nicht bedienbar", async () => {
    const { categoryOptionsForSide } = await import("../lib/profile-categories");
    const erste = categoryOptionsForSide("offer")[0];
    kategorienMock.mockResolvedValue({ offers: [erste.value], needs: [] });
    await schrittZwei();

    const chip = screen.getAllByRole("button", { name: erste.label })[0];
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip).toHaveAttribute("aria-disabled", "true");

    // Der Klick darf nichts abwählen — sonst löschte `planReconciliation` ALLE
    // eigenen Zeilen dieser Kategorie samt Beschreibung, Tags und Volumenband.
    fireEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");

    klick("Weiter");
    await screen.findByText(/^Schritt 3 von/);
    // Nichts zu schreiben — und vor allem nichts zu löschen.
    expect(speichereKategorienMock).not.toHaveBeenCalled();
  });

  it("schreibt rein additiv: das Vorhandene steht in der Auswahl mit drin", async () => {
    const { categoryOptionsForSide } = await import("../lib/profile-categories");
    const optionen = categoryOptionsForSide("offer");
    kategorienMock.mockResolvedValue({ offers: [optionen[0].value], needs: [] });
    await schrittZwei();

    fireEvent.click(screen.getAllByRole("button", { name: optionen[1].label })[0]);
    klick("Weiter");

    await waitFor(() =>
      expect(speichereKategorienMock).toHaveBeenCalledWith("test-user", {
        offers: [optionen[0].value, optionen[1].value],
        needs: [],
      }),
    );
  });

  it("zeigt vorhandenen Freitext neben den Kategorien DERSELBEN Seite", async () => {
    freitextMock.mockResolvedValue({
      offers: ["Wir finanzieren Bestandsimmobilien.", "Zweite Zeile aus WordPress."],
      needs: ["Suche einen Steuerberater."],
    });
    await schrittZwei();

    expect(screen.getByText("Wir finanzieren Bestandsimmobilien.")).toBeInTheDocument();
    expect(screen.getByText("Zweite Zeile aus WordPress.")).toBeInTheDocument();
    expect(screen.getByText("Suche einen Steuerberater.")).toBeInTheDocument();
  });

  it("zeigt ohne Freitext keinen Platzhalter an seiner Stelle", async () => {
    await schrittZwei();

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("Schritt 3 — Profilbild und Standort", () => {
  async function schrittDrei() {
    await strecke();
    klick("Weiter");
    await screen.findByText(/^Schritt 2 von/);
    klick("Weiter");
    await screen.findByText(/^Schritt 3 von/);
  }

  it("zeigt nur das leere Feld", async () => {
    profilMock.mockResolvedValue({ headline: "", avatar_url: null, region: "München" });
    await strecke();
    klick("Weiter");
    await screen.findByText(/^Schritt 2 von/);
    klick("Weiter");
    await screen.findByText(/^Schritt 3 von/);

    expect(screen.getByLabelText("Profilbild auswählen")).toBeInTheDocument();
    expect(screen.queryByText("FBC Standort")).not.toBeInTheDocument();
  });

  it("erhebt den FBC Standort als Freitext und schreibt ihn feldbezogen", async () => {
    // `region` ist ein Freitextfeld (ProfileFieldsets.tsx:46). Eine verbindliche
    // Liste der FBC-Standorte gibt es nicht — hier wird ergänzt, nicht validiert.
    await schrittDrei();

    const feld = screen.getByLabelText(/FBC Standort/);
    expect(feld.tagName).toBe("INPUT");
    fireEvent.change(feld, { target: { value: "München" } });
    klick("Fertig");

    await waitFor(() => expect(regionMock).toHaveBeenCalledWith("test-user", "München"));
    expect(saveProfileMock).not.toHaveBeenCalled();
  });
});
