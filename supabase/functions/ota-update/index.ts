// ota-update — der `updateUrl`-Endpunkt des Luftwegs (AGE-642, Phase D3).
//
// ── Warum verify_jwt = false ────────────────────────────────────────────────
// ABSICHT, kein Versehen: ein Gerät hat kein JWT. Fehlte der `config.toml`-Block,
// gälte die Vorgabe `verify_jwt = true`, und das Gateway antwortete mit 401 —
// BEVOR dieser Handler läuft, also ohne eine Zeile in seinem Log. Bewacht von
// `scripts/functions-config.test.ts`.
//
// Was hier offensteht, ist die Frage „welches Bündel gilt für Schale X". Die
// Antwort enthält `url`, `checksum` und `sessionKey` — kein Geheimnis: der
// öffentliche Schlüssel steckt ohnehin in jeder ausgelieferten App, und im
// Bündel steht dasselbe `dist/`, das Cloudflare Pages an jeden ausliefert. Die
// Verschlüsselung trägt Echtheit, nicht Vertraulichkeit (Entwurf §8).
//
// Die Entscheidung selbst steht in `antwort.ts` und wird dort mit `deno test`
// geprüft. Dieser Rumpf baut nur die echten Abhängigkeiten.
//
// Secrets: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (plattform-injiziert).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { type Buendel, ermittleAntwort } from "./antwort.ts";

function log(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
) {
  console[level === "warn" ? "warn" : level === "error" ? "error" : "log"](
    JSON.stringify({ fn: "ota-update", event, ...fields }),
  );
}

Deno.serve(async (req) => {
  // Kein CORS-Vorflug: der Aufrufer ist die native Schale über OkHttp bzw.
  // URLSession (`CapgoUpdater.java:2246`), kein Browser.
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let rumpf: unknown;
  try {
    rumpf = await req.json();
  } catch {
    rumpf = null;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ergebnis = await ermittleAntwort(rumpf, {
    // `.rpc(...)` und NICHT `.from("ota_buendel").select(...)`: service_role
    // hält in `public` auf keiner Tabelle ein Recht (AGE-312), und
    // `rolbypassrls` umgeht die RLS, nicht ein fehlendes SELECT. Der direkte
    // Weg liefe durch Typecheck und Tests und scheiterte erst hier.
    //
    // Und `await` statt einer Typzusicherung auf den Rueckgabewert: `.rpc()`
    // gibt einen PostgrestFilterBuilder zurueck, kein Promise. Ein `as
    // Promise<...>` liefe durch `deno test` hindurch und faellt erst in `deno
    // check` auf (ci.yml, Job edge-functions) — dieselbe Stelle, an der es beim
    // Herausloesen von redeem.ts schon einmal auffiel.
    neuestesBuendel: async (schale) => {
      const { data, error } = await supabase.rpc("ota_buendel_neuestes", { p_schale: schale });
      return { data: data as Buendel[] | null, error };
    },
    log,
  });

  return new Response(JSON.stringify(ergebnis.body), {
    status: ergebnis.status,
    headers: { "content-type": "application/json" },
  });
});
