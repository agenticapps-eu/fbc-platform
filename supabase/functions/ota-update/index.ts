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
import { ermittleAntwort, manifestZugriff, type RpcClient } from "./antwort.ts";

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

  // Der Funktionsname und die zwei Parameter, die hinausgehen, stehen in
  // `manifestZugriff` und werden dort geprueft — dieser Rumpf baut nur noch die
  // Abhaengigkeiten. Die Zusicherung auf `RpcClient` verengt den Client auf den
  // einen Aufruf, den dieser Weg braucht.
  const ergebnis = await ermittleAntwort(rumpf, {
    neuestesBuendel: manifestZugriff(supabase as unknown as RpcClient),
    log,
  });

  return new Response(JSON.stringify(ergebnis.body), {
    status: ergebnis.status,
    headers: { "content-type": "application/json" },
  });
});
