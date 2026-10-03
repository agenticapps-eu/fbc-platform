import { beforeEach, describe, expect, it, vi } from "vitest";
import { ladeMeineRechte } from "./berechtigungen";

/**
 * `ladeMeineRechte` (AGE-1000) — die Grenze zur Datenbank.
 *
 * Hier und nicht in `useDarf.test.tsx` steht der Fehlerpfad: auf Hook-Ebene
 * laeuft er durch react-query, und eine abgelehnte Zusage meldet vitest dort
 * als unbehandelten Fehler, obwohl die Abfrage sie entgegennimmt. An dieser
 * Grenze ist er ohne Rendern messbar.
 *
 * Dass die RPC die richtigen Schluessel je Rang liefert, steht in
 * `supabase/tests/rechte_v5_test.sql` — ein Mock kann das nicht belegen und
 * taeuschte es nur vor.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./supabase", () => ({ supabase: { rpc } }));

describe("ladeMeineRechte", () => {
  beforeEach(() => rpc.mockReset());

  it("fragt `meine_rechte` und gibt die Schluessel zurueck", async () => {
    rpc.mockResolvedValue({ data: ["suche_biete", "vorschlaege"], error: null });
    await expect(ladeMeineRechte()).resolves.toEqual(["suche_biete", "vorschlaege"]);
    expect(rpc).toHaveBeenCalledWith("meine_rechte");
  });

  it("wirft, wenn die RPC einen Fehler liefert — Stille waere „kein Recht“", async () => {
    // Der Unterschied, auf den es ankommt: ein gescheiterter Abruf ist nicht
    // dasselbe wie ein Konto ohne Rechte. Gaebe diese Funktion im Fehlerfall
    // `[]` zurueck, saehe ein Netzproblem fuer die Oberflaeche aus wie eine
    // Stufe ohne Rechte — und das Mitglied bekaeme eine Stufenaussage statt
    // eines Fehlers.
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });
    await expect(ladeMeineRechte()).rejects.toMatchObject({ code: "42501" });
  });

  it("macht aus `null` das leere Array", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(ladeMeineRechte()).resolves.toEqual([]);
  });

  it("verwirft Schluessel, die dieser Build nicht kennt", async () => {
    // Eine Datenbank, die weiter ist als der ausgelieferte Build — nach einer
    // Migration und vor dem Deploy ist das der Normalfall. Ein unbekannter
    // Schluessel kann in der Oberflaeche nichts freischalten; ihn als
    // `Berechtigung` durchzureichen waere eine Luege ueber den Typ.
    rpc.mockResolvedValue({
      data: ["suche_biete", "kommt.erst.mit.v5f6", "verzeichnis.suchen"],
      error: null,
    });
    await expect(ladeMeineRechte()).resolves.toEqual(["suche_biete", "verzeichnis.suchen"]);
  });
});
