import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import LegalRoute from "./LegalRoute";
import { rechtsseiten } from "../content/legal/meta";

/**
 * Der Rückweg am KOPF der Rechtsseiten (AGE-625).
 *
 * ══ WARUM ER OBEN STEHEN MUSS ══════════════════════════════════════════════
 * Der bisher einzige benannte Rückweg steht in der Fußzeile — bei den AGB
 * hinter 121 679 Zeichen. Am Kopf stand nur das Logo: ein Bild mit
 * `aria-label`, das niemand als „zurück" liest.
 *
 * ══ DIE FALLE, IN DIE DIESE DATEI ZUERST GELAUFEN IST ══════════════════════
 * Ein Test auf `getByRole("link", { name: /zur startseite/i })` war GRÜN,
 * bevor irgendetwas gebaut war — er fand das Logo, dessen `aria-label` genau
 * so lautet. Und ein Test auf den Namen allein fände auch den Fußzeilen-Link,
 * der seit AGE-497 „Zurück zur Startseite" heisst.
 *
 * Beides misst nicht, worum es geht. Die Zusage lautet: der Rückweg steht
 * VOR der Überschrift. Deshalb wird hier die DOM-Reihenfolge geprüft — die
 * rechnet `jsdom` verlässlich, anders als Layout.
 *
 * ══ UND WARUM ER ZWEI FÄLLE TRAGEN MUSS ════════════════════════════════════
 * `LegalPage.tsx` warnt seit AGE-497 zu Recht: ein blankes `history.back()`
 * bricht beim Direktaufruf aus einer E-Mail — dort gibt es keine App-Historie.
 * Ein blanker Link auf `/` wiederum wirft jeden hinaus, der aus den
 * Einstellungen kam.
 *
 * Unterschieden wird an `location.key`: React Router vergibt für den ERSTEN
 * Eintrag einer Sitzung den Schlüssel `"default"`.
 */

/** Zeigt die aktuelle Adresse an, damit ein Sprung messbar ist. */
function Wo() {
  const { pathname } = useLocation();
  return <div data-testid="wo">{pathname}</div>;
}

function rendern(start: string[], index?: number) {
  return render(
    <MemoryRouter initialEntries={start} initialIndex={index}>
      <Wo />
      <Routes>
        {rechtsseiten.map((s) => (
          <Route key={s.slug} path={`/${s.slug}`} element={<LegalRoute seite={s} />} />
        ))}
        <Route path="/" element={<div>Startseite</div>} />
        <Route path="/einstellungen" element={<div>Einstellungen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Steht `el` im Dokument VOR der Hauptüberschrift? */
function stehtVorDerUeberschrift(el: HTMLElement): boolean {
  const h1 = screen.getByRole("heading", { level: 1 });
  // DOCUMENT_POSITION_FOLLOWING = h1 kommt nach el.
  return Boolean(el.compareDocumentPosition(h1) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe("Rückweg am Kopf der Rechtsseiten", () => {
  it("steht schon da, WÄHREND der Text noch lädt", () => {
    // Der Rahmen beim Laden ist ein eigener Zweig in `LegalRoute`. Stünde der
    // Rückweg nur in `LegalPage`, fehlte er genau so lange, wie das Nachladen
    // dauert — und bei 121k Zeichen ist das die Zeit, in der jemand abbricht.
    rendern(["/agb"]);
    const wege = screen.getAllByRole("link", { name: /zurück zur startseite/i });
    expect(wege.some(stehtVorDerUeberschrift)).toBe(true);
  });

  it("steht auch am fertig geladenen Dokument oben, nicht nur in der Fußzeile", async () => {
    rendern(["/agb"]);
    await screen.findAllByText(/Geltungsbereich/i);

    const wege = screen.getAllByRole("link", { name: /zurück zur startseite/i });
    expect(wege.some(stehtVorDerUeberschrift)).toBe(true);
  });

  it("führt beim Direktaufruf zur Startseite statt ins Leere", async () => {
    // Der Fall „Link aus der Aktivierungsmail": es gibt keine App-Historie.
    rendern(["/agb"]);
    await screen.findAllByText(/Geltungsbereich/i);

    const oben = screen
      .getAllByRole("link", { name: /zurück zur startseite/i })
      .find(stehtVorDerUeberschrift)!;
    fireEvent.click(oben);

    await waitFor(() => expect(screen.getByTestId("wo")).toHaveTextContent("/"));
  });

  it("geht zurück, wohin man wirklich wollte — nicht auf die Startseite", async () => {
    // Der Fall „aus den Einstellungen auf die AGB": ein Sprung auf `/` würde
    // den Platz kosten, an dem jemand gerade war.
    //
    // Zwei Einträge, Index 1: `key: "default"` vergibt React Router nur für den
    // ERSTEN Eintrag. Der aktuelle trägt damit einen anderen Schlüssel — genau
    // die Lage, in der es ein echtes „zurück" gibt.
    rendern(["/einstellungen", "/agb"], 1);
    await screen.findAllByText(/Geltungsbereich/i);

    fireEvent.click(screen.getByRole("button", { name: /^zurück$/i }));

    await waitFor(() => expect(screen.getByTestId("wo")).toHaveTextContent("/einstellungen"));
    expect(screen.getByText("Einstellungen")).toBeInTheDocument();
  });

  it("behauptet beim Direktaufruf kein Zurück, sondern nennt das Ziel", () => {
    // Ein Knopf mit der Aufschrift „Zurück", der in Wahrheit auf die Startseite
    // springt, sagt die Unwahrheit über das, was er tut.
    rendern(["/impressum"]);
    expect(screen.queryByRole("button", { name: /^zurück$/i })).not.toBeInTheDocument();
  });
});
