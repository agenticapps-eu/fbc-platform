import { describe, expect, it } from "vitest";
import { abgeleiteteFunctions } from "./changed-functions.logic";

/**
 * Diese Ableitung entscheidet, was CI auf DEV und PROD schreibt (AGE-506).
 *
 * Sie steht als reine Funktion hier und nicht als Shell-Zeile im YAML, weil eine
 * Shell-Zeile im YAML niemand testet — und ein Fehler darin heisst entweder
 * „eine Function wurde still nicht ausgeliefert" oder „eine Function wurde still
 * ueberschrieben, auf der bewusst ein aelterer Stand lag".
 */
describe("abgeleiteteFunctions", () => {
  it("nennt die Function, deren Datei sich geaendert hat", () => {
    const e = abgeleiteteFunctions(["supabase/functions/send-activation/index.ts"]);
    expect(e.functions).toEqual(["send-activation"]);
  });

  it("nennt jede Function genau einmal, egal wie viele ihrer Dateien sich aendern", () => {
    const e = abgeleiteteFunctions([
      "supabase/functions/send-activation/index.ts",
      "supabase/functions/send-activation/emails.ts",
      "supabase/functions/send-activation/emails.test.ts",
    ]);
    expect(e.functions).toEqual(["send-activation"]);
  });

  it("sortiert, damit das Protokoll zwischen zwei Laeufen vergleichbar bleibt", () => {
    const e = abgeleiteteFunctions([
      "supabase/functions/stripe-webhook/index.ts",
      "supabase/functions/redeem-activation/index.ts",
      "supabase/functions/notify-contact-request/index.ts",
    ]);
    expect(e.functions).toEqual(["notify-contact-request", "redeem-activation", "stripe-webhook"]);
  });

  it("laesst alles liegen, was keine Function ist", () => {
    // Der Kern der Entscheidung: NUR Geaendertes wird ausgeliefert. Ein
    // pauschaler Lauf zoege den bewusst aelteren Stand von
    // notify-contact-request auf PROD mit (Aufgabe 11.4).
    const e = abgeleiteteFunctions([
      "src/pages/LoginPage.tsx",
      "supabase/migrations/20260807190000_activation_fehlversand_entwertet.sql",
      "supabase/tests/rls_test.sql",
      "README.md",
    ]);
    expect(e.functions).toEqual([]);
  });

  it("leere Eingabe bleibt leer — dann liefert der Job nichts aus", () => {
    expect(abgeleiteteFunctions([]).functions).toEqual([]);
  });

  it("ein blosser Verzeichnisname ohne Datei darin zaehlt nicht", () => {
    // Sonst deployte ein geloeschtes Verzeichnis eine Function, die es nicht
    // mehr gibt.
    expect(abgeleiteteFunctions(["supabase/functions/send-activation"]).functions).toEqual([]);
  });

  // ── Haertung ─────────────────────────────────────────────────────────────
  // Der Name landet in einer Shell-Schleife und danach in `supabase functions
  // deploy`. Ein Name mit Glob- oder Trennzeichen waere dort ein Eingang.
  // Supabase-Function-Namen sind ohnehin Slugs — was keiner ist, ist keine
  // Function, und wird laut verworfen statt still mitgenommen.
  it("verwirft Namen, die keine Slugs sind, und nennt sie", () => {
    const e = abgeleiteteFunctions([
      "supabase/functions/send-activation/index.ts",
      "supabase/functions/boese name/index.ts",
      "supabase/functions/*/index.ts",
      "supabase/functions/rm;-rf/index.ts",
    ]);
    expect(e.functions).toEqual(["send-activation"]);
    expect(e.verworfen).toEqual(["*", "boese name", "rm;-rf"]);
  });

  it("ohne Auffaelligkeit bleibt die Verworfen-Liste leer", () => {
    expect(abgeleiteteFunctions(["supabase/functions/send-activation/index.ts"]).verworfen).toEqual(
      [],
    );
  });

  // ── Die benannte Restflaeche ─────────────────────────────────────────────
  // `verify_jwt` steht in config.toml, nicht im Function-Code. Aendert sich nur
  // dieser Block, sieht die Ableitung ueber geaenderte Dateien NICHTS — und der
  // Job saehe vollstaendig aus, ohne es zu sein. Deshalb ein eigenes Flag,
  // statt die Luecke zu verschweigen.
  it("config.toml liefert keine Function, setzt aber das Warnflag", () => {
    const e = abgeleiteteFunctions(["supabase/config.toml"]);
    expect(e.functions).toEqual([]);
    expect(e.configBeruehrt).toBe(true);
  });

  it("ohne config.toml bleibt das Warnflag aus", () => {
    const e = abgeleiteteFunctions(["supabase/functions/send-activation/index.ts"]);
    expect(e.configBeruehrt).toBe(false);
  });
});
