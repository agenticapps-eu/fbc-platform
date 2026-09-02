// ota-update — der `updateUrl`-Endpunkt des Luftwegs (AGE-642, Phase D3).
//
// ── Warum verify_jwt = false ────────────────────────────────────────────────
// ABSICHT, kein Versehen: ein Gerät hat kein JWT. Fehlte der `config.toml`-Block,
// gälte die Vorgabe `verify_jwt = true`, und das Gateway antwortete mit 401 —
// BEVOR dieser Handler läuft, also ohne eine Zeile in seinem Log. Bewacht von
// `scripts/functions-config.test.ts`.
//
// Was hier offensteht, ist die Frage „welches Bündel gilt für Schale X". Die
// Antwort enthält `url`, `checksum` und `session_key` — kein Geheimnis: der
// öffentliche Schlüssel steckt ohnehin in jeder ausgelieferten App, und im
// Bündel steht dasselbe `dist/`, das Cloudflare Pages an jeden ausliefert. Die
// Verschlüsselung trägt Echtheit, nicht Vertraulichkeit (Entwurf §8).
//
// Die Entscheidung selbst steht in `antwort.ts` und wird dort mit `deno test`
// geprüft. Dieser Rumpf baut nur die echten Abhängigkeiten.
//
// Secrets: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (plattform-injiziert).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.1";
import { behandleAnfrage, manifestZugriff, type RpcClient } from "./antwort.ts";

function log(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
) {
  console[level === "warn" ? "warn" : level === "error" ? "error" : "log"](
    JSON.stringify({ fn: "ota-update", event, ...fields }),
  );
}

// Diese Datei entscheidet nichts. Der Handler steht in `antwort.ts` und wird
// dort AUSGEFUEHRT geprueft; hier stehen nur die zwei echten Abhaengigkeiten.
Deno.serve((req) =>
  behandleAnfrage(req, {
    // Der Funktionsname und die zwei Parameter, die hinausgehen, stehen in
    // `manifestZugriff` und werden dort geprueft. Die Zusicherung auf
    // `RpcClient` verengt den Klienten auf den einen Aufruf, den dieser Weg
    // braucht.
    neuestesBuendel: manifestZugriff(
      createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ) as unknown as RpcClient,
    ),
    log,
  })
);
