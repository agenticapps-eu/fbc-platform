import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoEmbed } from "./VideoEmbed";

/** `VideoEmbed` verlinkt die Datenschutzerklärung und braucht deshalb einen
 *  Router. Vor AGE-611 kam es ohne aus. */
function zeige(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const YT2 = "https://www.youtube.com/watch?v=Ks-_Mh1QhMc";
const VIMEO = "https://vimeo.com/123456789";

// Die Freigabe liegt seit AGE-621 auf dem Endgeraet und ueberlebt damit auch
// einen Test. Ohne dieses Aufraeumen liesse der erste Klick jeden folgenden
// Test in einer Welt laufen, in der YouTube bereits freigegeben ist.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("VideoEmbed — Einwilligungstor (AGE-611)", () => {
  it("lädt beim ersten Rendern keinen Player", () => {
    zeige(<VideoEmbed url={YT} title="Test" />);

    // Die eigentliche Zusage des Changes: kein Rahmen, also kein Aufruf.
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("zeigt statt des Players eine Fläche, die den Anbieter nennt", () => {
    zeige(<VideoEmbed url={YT} title="Test" />);

    const knopf = screen.getByRole("button", { name: /Video von YouTube laden/i });
    // Ein natives <button> ist per Definition tastaturbedienbar. Ein simuliertes
    // Enter würde in jsdom keinen Klick auslösen und damit nur jsdom prüfen —
    // die tragfähige Zusage ist das Element selbst.
    expect(knopf.tagName).toBe("BUTTON");
    expect(knopf.getAttribute("type")).toBe("button");
  });

  it("nennt Vimeo, wenn es ein Vimeo-Link ist", () => {
    zeige(<VideoEmbed url={VIMEO} />);
    expect(screen.getByRole("button", { name: /Video von Vimeo laden/i })).toBeInTheDocument();
  });

  it("benennt die Folge der Aktivierung und verlinkt die Datenschutzerklärung", () => {
    zeige(<VideoEmbed url={YT} />);

    expect(screen.getByText(/IP-Adresse/i)).toBeInTheDocument();
    const verweis = screen.getByRole("link", { name: /Datenschutz/i });
    expect(verweis.getAttribute("href")).toBe("/datenschutz");
    // Ein Link IM Knopf wäre ungültiges Markup und eine Tastaturfalle.
    expect(screen.getByRole("button").contains(verweis)).toBe(false);
  });

  it("holt kein Vorschaubild von einem fremden Ursprung", () => {
    const { container } = zeige(<VideoEmbed url={YT} />);

    // Ein Standbild von img.youtube.com wäre derselbe Fehler mit anderem Host.
    for (const bild of container.querySelectorAll("img")) {
      const quelle = bild.getAttribute("src") ?? "";
      expect(quelle.startsWith("http")).toBe(false);
    }
  });

  it("setzt erst nach der Aktivierung den Rahmen — über den No-Cookie-Host und mit Autoplay", () => {
    zeige(<VideoEmbed url={YT} title="Test" />);
    fireEvent.click(screen.getByRole("button", { name: /laden/i }));

    const rahmen = screen.getByTitle("Test") as HTMLIFrameElement;
    const src = new URL(rahmen.src);
    expect(src.host).toBe("www.youtube-nocookie.com");
    expect(src.pathname).toBe("/embed/dQw4w9WgXcQ");
    // Ohne Autoplay lädt der Player pausiert und verlangt einen ZWEITEN Klick,
    // diesmal im fremden Rahmen.
    expect(src.searchParams.get("autoplay")).toBe("1");
  });

  it("aktiviert Vimeo mit dnt=1", () => {
    zeige(<VideoEmbed url={VIMEO} title="V" />);
    fireEvent.click(screen.getByRole("button", { name: /laden/i }));

    const src = new URL((screen.getByTitle("V") as HTMLIFrameElement).src);
    expect(src.host).toBe("player.vimeo.com");
    expect(src.searchParams.get("dnt")).toBe("1");
    expect(src.searchParams.get("autoplay")).toBe("1");
  });

  it("lädt nicht das Video des ANDEREN Anbieters mit", () => {
    // Eine Freigabe ist spezifisch. Wer YouTube erlaubt, hat über Vimeo nichts
    // gesagt — das bleibt auch dann wahr, wenn die Freigabe jetzt gemerkt wird.
    zeige(
      <>
        <VideoEmbed url={YT} title="Erstes" />
        <VideoEmbed url={VIMEO} title="Zweites" />
      </>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /laden/i })[0]);

    expect(screen.getByTitle("Erstes")).toBeInTheDocument();
    expect(screen.queryByTitle("Zweites")).toBeNull();
    expect(screen.getByRole("button", { name: /Video von Vimeo laden/i })).toBeInTheDocument();
  });

  it("lädt das zweite Video DESSELBEN Anbieters ohne zweiten Klick mit", () => {
    // Das ist die Zusage „einmalig" auf genau der Seite, auf der sie zählt.
    // Vorher blieb hier ein zweites Tor stehen.
    zeige(
      <>
        <VideoEmbed url={YT} title="Erstes" />
        <VideoEmbed url={YT2} title="Zweites" />
      </>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /laden/i })[0]);

    expect(screen.getByTitle("Erstes")).toBeInTheDocument();
    expect(screen.getByTitle("Zweites")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /laden/i })).toBeNull();
  });

  it("spielt das mitgeladene Video NICHT ab und lässt ihm den Fokus", () => {
    // Ohne diese Trennung spielten auf einer Seite mit drei Videos nach einem
    // Klick alle drei gleichzeitig los.
    zeige(
      <>
        <VideoEmbed url={YT} title="Geklicktes" />
        <VideoEmbed url={YT2} title="Mitgeladenes" />
      </>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /laden/i })[0]);

    const geklickt = screen.getByTitle("Geklicktes") as HTMLIFrameElement;
    const mit = screen.getByTitle("Mitgeladenes") as HTMLIFrameElement;
    expect(new URL(geklickt.src).searchParams.get("autoplay")).toBe("1");
    expect(new URL(mit.src).searchParams.has("autoplay")).toBe(false);
    expect(document.activeElement).toBe(geklickt);
  });

  it("verlangt für einen anderen Anbieter in derselben Instanz eine neue Aktivierung", () => {
    // Der Profil-Editor schlüsselt seine Zeilen nach Index. Hinge die Freigabe
    // an der Instanz, lüde eine geänderte Zeile den neuen Anbieter ohne neue
    // Aktivierung. Seit AGE-621 hängt sie am ANBIETER — der Schutz bleibt
    // derselbe, solange der Anbieter wechselt.
    const { rerender } = zeige(<VideoEmbed url={YT} title="Wechsel" />);
    fireEvent.click(screen.getByRole("button", { name: /laden/i }));
    expect(screen.getByTitle("Wechsel")).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <VideoEmbed url={VIMEO} title="Wechsel" />
      </MemoryRouter>,
    );

    expect(screen.queryByTitle("Wechsel")).toBeNull();
    expect(screen.getByRole("button", { name: /Video von Vimeo laden/i })).toBeInTheDocument();
  });

  it("merkt sich die Freigabe über ein Neumontieren hinaus", () => {
    // Genau die Zusage des Changes, und die Umkehr des Tests, der vorher hier
    // stand: „merkt sich die Freigabe NICHT über ein Neumontieren hinaus".
    const { unmount } = zeige(<VideoEmbed url={YT} title="Neu" />);
    fireEvent.click(screen.getByRole("button", { name: /laden/i }));
    expect(screen.getByTitle("Neu")).toBeInTheDocument();
    unmount();

    zeige(<VideoEmbed url={YT} title="Neu" />);
    const rahmen = screen.getByTitle("Neu") as HTMLIFrameElement;
    // Beim neuen Aufruf spielt nichts von selbst und der Fokus bleibt, wo die
    // Seite ihn hingelegt hat.
    expect(new URL(rahmen.src).searchParams.has("autoplay")).toBe(false);
    expect(document.activeElement).not.toBe(rahmen);
  });

  it("hält das Tor, wenn der Speicher nicht zur Verfügung steht", () => {
    // Das Merken fällt aus, das Tor nicht — und die Seite rendert.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Zugriff verweigert");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Kein Platz");
    });

    const { unmount } = zeige(<VideoEmbed url={YT} title="Ohne Speicher" />);
    expect(screen.queryByTitle("Ohne Speicher")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /laden/i }));
    expect(screen.getByTitle("Ohne Speicher")).toBeInTheDocument();
    unmount();

    zeige(<VideoEmbed url={YT} title="Ohne Speicher" />);
    expect(screen.queryByTitle("Ohne Speicher")).toBeNull();
  });

  it("zeigt für eine nicht unterstützte URL weiterhin eine klare Absage", () => {
    zeige(<VideoEmbed url="https://evil.example.com/embed/x" />);

    expect(screen.queryByTitle("Video")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/Nur YouTube- und Vimeo-Links/i)).toBeInTheDocument();
  });
});
