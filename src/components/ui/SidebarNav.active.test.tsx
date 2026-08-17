import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SidebarNav } from "./SidebarNav";

/**
 * Welcher Eintrag leuchtet (AGE-566, Diff-Review).
 *
 * `NavLink` matcht ohne `end` als PRÄFIX. Der Admin-Abschnitt trägt seit der
 * Mitgliederliste zwei Einträge, deren einer der Pfadanfang des anderen ist —
 * auf `/admin/mitglieder` waren dadurch BEIDE aktiv, und eine Leiste, die zwei
 * Orte gleichzeitig behauptet, sagt keinen.
 *
 * Geprüft wird `aria-current`, nicht eine CSS-Klasse: das ist die Zusage, auf
 * die sich auch ein Screenreader verlässt, und sie überlebt jeden Umbau der
 * Klassennamen.
 *
 * Die Einträge unten tragen KEINE Flagge — sie sind exakt die aus `AppShell`.
 * Das ist Absicht: müsste der Aufrufer etwas setzen, prüfte dieser Test nur
 * seine eigene Fixture und bliebe grün, während die Leiste in der Anwendung
 * falsch leuchtet.
 */
function renderAt(pfad: string) {
  return render(
    <MemoryRouter initialEntries={[pfad]}>
      <SidebarNav
        sections={[
          {
            title: "Administration",
            items: [
              { path: "/admin", label: "Administration" },
              { path: "/admin/mitglieder", label: "Mitglieder" },
            ],
          },
        ]}
      />
    </MemoryRouter>,
  );
}

describe("SidebarNav: genau ein Eintrag ist aktiv", () => {
  it("markiert auf /admin/mitglieder nur die Mitgliederliste", () => {
    renderAt("/admin/mitglieder");

    expect(screen.getByRole("link", { name: "Mitglieder" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Administration" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("markiert auf /admin nur die Administration", () => {
    renderAt("/admin");

    expect(screen.getByRole("link", { name: "Administration" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Mitglieder" })).not.toHaveAttribute("aria-current");
  });
});
