import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { ProfileBasicsFieldset } from "./ProfileFieldsets";
import { BRANCHEN } from "../../config/branchen";
import { EMPTY_PROFILE_FORM, type ProfileFormValues } from "../../lib/profile";

/**
 * Das Branchenfeld (AGE-537, C6a) — aus einem Freitextfeld wird eine Auswahl.
 *
 * Der Filter im Verzeichnis zieht seine Optionen als Facette aus den
 * vorhandenen Werten. Ohne Zielvokabular würde er nach dem Import zum Spiegel
 * des Freitext-Rauschens; mit einer Auswahl konvergiert er.
 */

/**
 * WICHTIG: der Wert kommt per `reset()` NACH dem Mount, genau wie in beiden
 * Editoren — dort füllt ein `useEffect` das Formular aus der Serverantwort.
 *
 * Eine erste Fassung dieses Tests stellte den Wert in `defaultValues` und war
 * grün, während die laufende Anwendung „Keine Angabe" anzeigte: beim `reset`
 * gab es die Zusatzoption noch nicht, der Browser fiel auf die erste Option
 * zurück, und das nächste Speichern hätte die Branche gelöscht. Gefunden hat
 * das nur die Sichtprobe.
 */
function Harness({ branche }: { branche?: string }) {
  const { register, control, formState, reset } = useForm<ProfileFormValues>({
    defaultValues: EMPTY_PROFILE_FORM,
  });
  useEffect(() => {
    if (branche !== undefined) reset({ ...EMPTY_PROFILE_FORM, branche });
  }, [branche, reset]);
  return (
    <form>
      <ProfileBasicsFieldset register={register} control={control} errors={formState.errors} />
    </form>
  );
}

describe("Branche im Profil-Editor", () => {
  it("ist eine Auswahl aus der kuratierten Liste, kein Freitext", () => {
    render(<Harness />);

    const feld = screen.getByLabelText("Branche");
    expect(feld.tagName).toBe("SELECT");
    for (const b of BRANCHEN) {
      expect(screen.getByRole("option", { name: b.value })).toBeInTheDocument();
    }
  });

  it("behält einen Bestandswert außerhalb der Liste, statt ihn beim Speichern zu verlieren", async () => {
    render(<Harness branche="Zirkusartistik" />);

    const feld = screen.getByLabelText("Branche") as HTMLSelectElement;
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Zirkusartistik" })).toBeInTheDocument(),
    );
    // Der eigentliche Punkt: die Option EXISTIERT nicht nur, sie ist auch
    // ausgewählt. Genau hier lag der Fehler, den die Sichtprobe zeigte.
    await waitFor(() => expect(feld.value).toBe("Zirkusartistik"));
  });

  it("führt einen Listenwert nicht doppelt auf", async () => {
    render(<Harness branche="Immobilien" />);

    await waitFor(() =>
      expect((screen.getByLabelText("Branche") as HTMLSelectElement).value).toBe("Immobilien"),
    );
    expect(screen.getAllByRole("option", { name: "Immobilien" })).toHaveLength(1);
  });
});
