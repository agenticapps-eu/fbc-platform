// Schlanker Client-Logger für strukturierte Domänen-Events.
//
// Events laufen über den serverseitigen Proxy /api/log (functions/api/log.ts) —
// der Axiom-Token bleibt dort und erreicht nie den Browser. Fehler/Performance
// gehen weiter an Sentry; Axiom bekommt Events/Funnels. Siehe
// docs/observability.md für die Trennung.
//
// Fire-and-forget: Logging darf den Nutzerfluss nie blockieren oder einen
// Fehler werfen — schlägt der POST fehl, wird er still verworfen.

/** Domänen-Events, die wir als Funnel auswerten. Synchron zur ALLOWED_EVENTS-
 *  Allowlist im Proxy (functions/api/log.ts). */
export type DomainEvent =
  | "signup"
  | "login"
  | "match_suggested"
  | "contact_request_sent"
  | "contact_request_accepted"
  | "event_registered";

type EventProps = Record<string, string | number | boolean | null | undefined>;

/**
 * Sendet ein Domänen-Event an den Server-Proxy. Bewusst ohne `await`-Zwang:
 * Aufrufer rufen `logEvent("login")` und machen weiter. `keepalive` sorgt
 * dafür, dass der Request auch bei einem unmittelbar folgenden Seitenwechsel
 * (z. B. Redirect nach Login) noch rausgeht.
 */
export function logEvent(event: DomainEvent, props?: EventProps): void {
  try {
    void fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, props }),
      keepalive: true,
    }).catch(() => {
      // still verwerfen — Sentry deckt echte Fehler ab.
    });
  } catch {
    // z. B. fetch nicht verfügbar — Logging darf nie die App brechen.
  }
}
