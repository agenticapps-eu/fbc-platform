/// <reference types="@cloudflare/workers-types" />

// Serverseitiger Endpunkt für strukturierte Domänen-Events.
//
// Der Browser-Logger (src/lib/log.ts) POSTet Events hierher; diese Cloudflare
// Pages Function prüft sie gegen eine Allowlist, reichert sie serverseitig an
// und schreibt sie als strukturierte JSON-Zeile — Cloudflare Workers Logs
// erfasst stdout automatisch. Sentry bleibt für Fehler zuständig.
//
// Zuvor ging der Endpunkt an Axiom. ADR-0037 (agenticapps-observability) hat
// die Axiom-Destination entfernt: kein Ingest-Token, kein Secret, keine
// Netzwerk-Egress mehr. Der Endpunkt bleibt trotzdem sinnvoll — die Allowlist,
// die Größenbegrenzung und die serverseitige Anreicherung (cf-Felder, _time)
// gehören auf den Server und nicht in den Client.
//
// TRADEOFF: Workers Logs ist kein Analyse-Store. Funnel-Auswertungen, die
// vorher in Axiom liefen, brauchen jetzt entweder eine Log-Query oder ein
// eigenes Analytics-Ziel. Siehe docs/observability.md.

// Keine Env-Bindings mehr nötig: der Endpunkt liest weder Token noch Dataset.
type Env = Record<string, never>;

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
  // Kein `env` mehr: Seit der Axiom-Destination auch das letzte Secret entfiel,
  // liest dieser Endpunkt keine Bindings. Das Feld stehenzulassen kostet nichts
  // — außer `typecheck:functions`, das es zu Recht als ungenutzt meldet.
  const { request } = context;

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

  // Serverseitige Anreicherung. cf-Felder sind nur am Edge verfügbar
  // (lokal via `wrangler pages dev` ggf. leer).
  const cf = request.cf;
  // Reihenfolge ist hier eine Sicherheitseigenschaft, keine Formsache: `props`
  // kommt vom öffentlichen, unauthentifizierten Endpunkt und muss VOR den
  // geprüften Feldern stehen. Stand es dahinter, überschrieb es `event` nach
  // der Allowlist-Prüfung und dazu `source` und `_time` — also einen
  // frei erfundenen, als serverseitig ausgegebenen, zurückdatierten
  // Audit-Eintrag.
  const record = {
    ...(props as Record<string, unknown> | undefined),
    _time: new Date().toISOString(),
    event,
    source: "web-client",
    request: {
      country: cf?.country,
      colo: cf?.colo,
      ray: request.headers.get("cf-ray") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
      referer: request.headers.get("referer") ?? undefined,
    },
  };

  // Eine JSON-Zeile pro Event auf stdout — Workers Logs erfasst sie. Kein
  // await, kein Netzwerk, damit hier nichts mehr fehlschlagen kann.
  console.log(JSON.stringify(record));

  return noContent();
};
