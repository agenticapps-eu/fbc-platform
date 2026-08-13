import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { ProfileContactFieldset } from "./ProfileFieldsets";
import { EMPTY_PROFILE_FORM, type ProfileFormValues } from "../../lib/profile";

/**
 * Der Kontaktblock (AGE-537, C6a) — der erste Weg, auf dem ein MITGLIED seine
 * eigene Kontaktzeile pflegt. Bis hierher konnte das nur ein Admin.
 *
 * Nichts ist gemockt: die Feldgruppe bekommt ein echtes react-hook-form und
 * rendert. Geprüft wird, was ein Mitglied sieht — die sieben Felder und die
 * Zusage darüber, wer sie zu sehen bekommt.
 */

function Harness({ werte }: { werte?: Partial<ProfileFormValues> }) {
  const { register, control, formState } = useForm<ProfileFormValues>({
    defaultValues: { ...EMPTY_PROFILE_FORM, ...werte },
  });
  return (
    <form>
      <ProfileContactFieldset register={register} control={control} errors={formState.errors} />
    </form>
  );
}

describe("ProfileContactFieldset", () => {
  it("zeigt die fünf Adressfelder plus E-Mail und Telefon", () => {
    render(<Harness />);

    for (const label of [
      "Kontakt-E-Mail",
      "Telefon",
      "Straße und Hausnummer",
      "PLZ",
      "Ort",
      "Bundesland",
      "Land",
    ]) {
      expect(screen.getByLabelText(new RegExp(label))).toBeInTheDocument();
    }
  });

  it("sagt, dass diese Angaben erst nach einer angenommenen Kontaktanfrage sichtbar sind", () => {
    render(<Harness />);

    // Beide Reviewer des Plans haben unabhängig gemeldet, dass „Kontaktdaten
    // werden geteilt" die Anschrift nicht mehr abdeckt. Wer sie einträgt, muss
    // es hier sehen — nicht erst der, der eine Anfrage annimmt.
    expect(screen.getByText(/angenommene[nr]? Kontaktanfrage/i)).toBeInTheDocument();
  });

  it("belegt das Land nicht vor — „DE“ steht nur als Platzhalter", () => {
    render(<Harness />);

    const land = screen.getByLabelText(/Land/) as HTMLInputElement;
    expect(land.value).toBe("");
    expect(land.placeholder).toBe("DE");
  });

  it("übernimmt vorhandene Werte aus dem Formular", () => {
    render(
      <Harness
        werte={{
          contact: {
            ...EMPTY_PROFILE_FORM.contact,
            street: "Hauptstr. 1",
            city: "Stuttgart",
          },
        }}
      />,
    );

    expect((screen.getByLabelText(/Straße und Hausnummer/) as HTMLInputElement).value).toBe(
      "Hauptstr. 1",
    );
    expect((screen.getByLabelText(/^Ort/) as HTMLInputElement).value).toBe("Stuttgart");
  });
});
