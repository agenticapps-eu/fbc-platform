/// <reference types="@cloudflare/workers-types" />

// Serverseitiger Axiom-Proxy für strukturierte Domänen-Events.
//
// Warum ein Proxy: Der Axiom-Ingest-Token ist ein Schreib-Secret und darf NIE
// in den Client-Bundle. Der Browser-Logger (src/lib/log.ts) POSTet Events an
// diese Cloudflare Pages Function; erst hier — mit dem Token aus der
// Function-Env — werden sie an Axiom gesendet. Sentry bleibt für Fehler
// zuständig, Axiom für Events/Funnels (siehe docs/observability.md).
//
// Raw fetch statt @axiomhq/js: der SDK läuft NICHT in der Cloudflare-Workers-
// Runtime — seine fetch-retry-Abhängigkeit setzt ein `cache`-Feld auf den
// Request, das workerd nicht implementiert ("The 'cache' field on
// 'RequestInitializerDict' is not implemented"); der Ingest schlägt dann still
// fehl (ingested:0). Das Schwesterprojekt cparx nutzt aus demselben Grund einen
// rohen fetch an den Edge-Endpoint.

interface Env {
  /** Axiom-Ingest-Token (server-only Secret). Ohne ihn ist Logging ein No-op. */
  AXIOM_TOKEN?: string;
  /** Ziel-Dataset, z. B. "fbc-platform". */
  AXIOM_DATASET?: string;
  /** Optionaler Override der Ingest-Edge-Basis (siehe DEFAULT_EDGE_URL). */
  AXIOM_URL?: string;
}

// Das Dataset "fbc-platform" liegt in Axiom EU (eu-central-1). EU-Datasets MÜSSEN
// über den Edge-Ingest-Host + Pfad /v1/ingest/:dataset laufen:
//   api.eu.axiom.co/v1/datasets/:d/ingest       -> 403 forbidden
//   eu-central-1.aws.edge.axiom.co/v1/ingest/:d -> 200 ✓
const DEFAULT_EDGE_URL = "https://eu-central-1.aws.edge.axiom.co";

const ingestUrl = (base: string, dataset: string): string =>
  `${base.replace(/\/+$/, "")}/v1/ingest/${encodeURIComponent(dataset)}`;

/** Erlaubte Event-Namen — synchron zu DomainEvent in src/lib/log.ts.
 *  Eine Allowlist verhindert, dass der öffentliche Endpunkt mit beliebigen
 *  Event-Namen zugemüllt wird. */
const ALLOWED_EVENTS = new Set([
  "signup",
  "login",
  "match_suggested",
  "contact_request_sent",
  "contact_request_accepted",
  "event_registered",
]);

/** Obergrenze für die Client-Props (roh, vor Anreicherung) — simpler
 *  Missbrauchsschutz, kein vollständiges Rate-Limiting (Follow-up für P11). */
const MAX_PROPS_BYTES = 8 * 1024;

function noContent(): Response {
  return new Response(null, { status: 204 });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return new Response("Body must be a JSON object", { status: 400 });
  }
  const { event, props } = body as { event?: unknown; props?: unknown };

  if (typeof event !== "string" || !ALLOWED_EVENTS.has(event)) {
    return new Response("Unknown or missing event", { status: 400 });
  }
  if (props !== undefined && (typeof props !== "object" || props === null)) {
    return new Response("props must be an object", { status: 400 });
  }
  if (props !== undefined && JSON.stringify(props).length > MAX_PROPS_BYTES) {
    return new Response("props too large", { status: 413 });
  }

  // Ohne Konfiguration kein Fehler nach außen: Client-Logging darf die App nie
  // brechen. In dev (lokal ohne Secret) bleibt es ein No-op; der Warn-Log
  // erscheint in den Cloudflare-Function-Logs.
  if (!env.AXIOM_TOKEN || !env.AXIOM_DATASET) {
    console.warn("axiom: AXIOM_TOKEN/AXIOM_DATASET nicht gesetzt — Event verworfen");
    return noContent();
  }

  // Serverseitige Anreicherung. cf-Felder sind nur am Edge verfügbar
  // (lokal via `wrangler pages dev` ggf. leer).
  const cf = request.cf;
  const record = {
    _time: new Date().toISOString(),
    event,
    source: "web-client",
    ...(props as Record<string, unknown> | undefined),
    request: {
      country: cf?.country,
      colo: cf?.colo,
      ray: request.headers.get("cf-ray") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
      referer: request.headers.get("referer") ?? undefined,
    },
  };

  const url = ingestUrl(env.AXIOM_URL || DEFAULT_EDGE_URL, env.AXIOM_DATASET);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AXIOM_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([record]),
    });
    // Kein stiller Fehler: ein nicht angenommenes Event als 502 melden, statt
    // 204 vorzutäuschen.
    if (!res.ok) {
      console.error(`axiom ingest HTTP ${res.status}:`, await res.text());
      return new Response(null, { status: 502 });
    }
  } catch (err) {
    console.error("axiom ingest failed:", err);
    return new Response(null, { status: 502 });
  }

  return noContent();
};
