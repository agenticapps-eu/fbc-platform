// anforderung-eingang — Detlevs Custom GPT legt direkt ein Linear-Issue an
// (AGE-830, ADR-0006, Vertrag: docs/custom-gpt-anforderungen.md).
//
// ── Warum verify_jwt = false ────────────────────────────────────────────────
// Die ChatGPT-Action trägt kein Supabase-JWT. Der einzige Nachweis ist das
// geteilte Geheimnis im Header `x-anforderung-schluessel`; `eingang.ts` prüft
// es vor allem anderen.
//
// Der Ablauf und seine Reihenfolge stehen in eingang.ts und werden dort mit
// `deno test` geprüft. Dieser Rumpf baut nur die echten Abhängigkeiten.
//
// Secrets (Supabase-Functions-Secret-Store, siehe docs/secrets.md):
//   ANFORDERUNG_SCHLUESSEL  der Schlüssel in der Action, je Umgebung verschieden
//   LINEAR_API_KEY          Personal API Key; Issues erscheinen als von Donald
//   ANFORDERUNG_PROBELAUF   `1` nur auf DEV: prüft alles, legt nichts an
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY stellt die Plattform bereit.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { type Log, verarbeite } from "./eingang.ts";

const log: Log = (level, event, felder = {}) => {
  console[level === "warn" ? "warn" : level === "error" ? "error" : "log"](
    JSON.stringify({ fn: "anforderung-eingang", event, ...felder }),
  );
};

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    return await verarbeite(req, {
      env: {
        schluessel: Deno.env.get("ANFORDERUNG_SCHLUESSEL"),
        linearApiKey: Deno.env.get("LINEAR_API_KEY"),
        probelauf: Deno.env.get("ANFORDERUNG_PROBELAUF") === "1",
      },
      fetch,
      anforderungFrei: async () => {
        const { data, error } = await supabase.rpc("anforderung_frei");
        if (error) throw new Error(error.message);
        return data === true;
      },
      anforderungVermerken: async () => {
        const { error } = await supabase.rpc("anforderung_vermerken");
        if (error) throw new Error(error.message);
      },
      jetzt: () => new Date(),
      log,
    });
  } catch (e) {
    // Nur Name und Meldung, nie den Rumpf: das Log trägt keine Inhalte.
    log("error", "unerwartet", { fehler: e instanceof Error ? `${e.name}: ${e.message}` : String(e) });
    return Response.json(
      { fehler: "Beim Eingang ist ein unerwarteter Fehler aufgetreten. Bitte sag Donald Bescheid." },
      { status: 500 },
    );
  }
});
