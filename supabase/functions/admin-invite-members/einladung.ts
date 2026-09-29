// Reine Logik von admin-invite-members (AGE-927) — ohne Netz und ohne
// Deno.env, damit sie ohne laufende Plattform prüfbar ist. Muster:
// change-email.ts, checkout.ts.
//
// ── Warum es diesen Endpunkt neben send-activation gibt ────────────────────
// `send-activation` antwortet auf JEDEM Pfad mit `202 {accepted: true}` — und
// das ist Absicht: „erst antworten, dann senden: sonst dauert eine bestehende
// Adresse messbar länger als eine unbekannte, und die Antwortzeit verrät den
// Bestand." Über sie ist ein wahrheitsgemässer Bericht nicht herstellbar.
//
// Der Aufzählungsschutz entfällt gegenüber einem Admin, der die
// Mitgliederliste ohnehin sieht. Die Schutzriegel entfallen NICHT: sie liegen
// in `issue_activation_token` und werden hier nicht nachgebaut, sondern
// gerufen.
//
// Vorbild für den Ablauf ist `resend-activation` — dieselbe Kette, nur für ein
// fremdes Profil und für mehrere auf einmal.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Die Auswahl gilt je Seite, und eine Seite fasst 50. Ein Aufruf mit mehr
 * käme nicht von der Fläche — und „an alle" ist genau das, was ADR-0007
 * ausschliesst. Die Grenze steht hier und nicht in der Oberfläche, weil eine
 * Grenze, die nur die Oberfläche zieht, keine ist.
 */
export const MAX_EINLADUNGEN = 50;

export interface InviteRequest {
  ids: string[];
}

/**
 * Liest den Rumpf des Aufrufs. Gibt `null` zurück, wenn er unbrauchbar ist —
 * der Aufrufer antwortet dann mit 400.
 */
export function parseInviteRequest(body: unknown): InviteRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { ids } = body as Record<string, unknown>;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  if (!ids.every((v) => typeof v === "string" && UUID.test(v))) return null;

  // Dubletten raus, Reihenfolge behalten. Zweimal zu schicken hiesse: der
  // zweite Aufruf sieht den gerade erzeugten Link und meldet `pending` — der
  // Bericht behauptete dann ein Übersprungen, das der Admin selbst ausgelöst
  // hat.
  const eindeutig = [...new Set(ids as string[])];
  if (eindeutig.length > MAX_EINLADUNGEN) return null;
  return { ids: eindeutig };
}

/**
 * Die fünf Ausgänge, die den Admin verschieden angehen.
 *
 * `uebersprungen` ist der wichtigste und der, den es ohne diesen Endpunkt gar
 * nicht zu melden gäbe: es ging NICHTS hinaus, weil ein gültiger Link im
 * Postfach liegt. Er tritt genau dann ein, wenn der Admin zweimal klickt.
 */
export type Ausgang =
  | "verschickt"
  | "uebersprungen"
  | "abgewiesen"
  | "nicht_einladbar"
  | "fehlgeschlagen";

/**
 * Bildet den Status aus `issue_activation_token` zusammen mit dem Ergebnis des
 * Versands auf einen Ausgang ab.
 *
 * Die erlaubten Status stehen im `comment on function` von
 * `issue_activation_token`: unknown, blocked, rate_limited, pending,
 * rate_limited_day, issued, issued_reset. **Erlaubnisliste statt
 * Ausschlussbedingung** — dieselbe Begründung wie in
 * `../send-activation/status.ts`: läge das Unbekannte im Sammelzweig, sähe eine
 * halbe Auslieferung (Function neu, Migration alt) im Bericht wie
 * Normalbetrieb aus.
 *
 * `versandOk` ist nur dort von Belang, wo überhaupt gesendet wurde. Ein
 * `issued` mit abgelehntem Versand ist **kein** Erfolg: das Token wurde
 * daraufhin entwertet, und das Mitglied steht trotzdem in „Eingeladen", weil
 * ein Link ERZEUGT wurde. Wenn der Bericht das nicht sagt, sagt es niemand.
 */
export function ausgangFuer(status: string | undefined, versandOk: boolean): Ausgang {
  switch (status) {
    case "issued":
    case "issued_reset":
      return versandOk ? "verschickt" : "fehlgeschlagen";
    case "pending":
      return "uebersprungen";
    case "rate_limited":
    case "rate_limited_day":
      return "abgewiesen";
    // Ein deaktiviertes oder gelöschtes Konto bekommt keinen Link (AGE-581),
    // eine unbekannte Adresse erst recht nicht. Beides ist kein Fehler und
    // keine Grenze, sondern ein eigener Zustand — und für einen Admin, der aus
    // der Liste gewählt hat, ein Hinweis, dass die Liste veraltet ist.
    case "blocked":
    case "unknown":
      return "nicht_einladbar";
    default:
      return "fehlgeschlagen";
  }
}

export interface Ergebnis {
  id: string;
  name: string | null;
  ausgang: Ausgang;
}

export interface Betroffener {
  id: string;
  name: string | null;
}

export interface Bericht {
  zahlen: Record<Ausgang, number>;
  verschickt: Betroffener[];
  uebersprungen: Betroffener[];
  abgewiesen: Betroffener[];
  nicht_einladbar: Betroffener[];
  fehlgeschlagen: Betroffener[];
}

const AUSGAENGE: Ausgang[] = [
  "verschickt",
  "uebersprungen",
  "abgewiesen",
  "nicht_einladbar",
  "fehlgeschlagen",
];

/**
 * Fasst die Einzelergebnisse zusammen — **alle** Ausgänge, auch die mit null.
 *
 * Ein Bericht, der nur die nicht-leeren Töpfe führt, lässt „0 übersprungen"
 * und „nicht geprüft" gleich aussehen. Und eine einzelne Zahl „verschickt"
 * über einer gemischten Menge entsteht hier gar nicht erst — das ist die
 * Zusage aus ADR-0007, in Code gegossen.
 */
export function berichtZusammenfassen(ergebnisse: Ergebnis[]): Bericht {
  const zahlen = Object.fromEntries(AUSGAENGE.map((a) => [a, 0])) as Record<Ausgang, number>;
  const bericht = {
    zahlen,
    verschickt: [] as Betroffener[],
    uebersprungen: [] as Betroffener[],
    abgewiesen: [] as Betroffener[],
    nicht_einladbar: [] as Betroffener[],
    fehlgeschlagen: [] as Betroffener[],
  };
  for (const e of ergebnisse) {
    zahlen[e.ausgang] += 1;
    bericht[e.ausgang].push({ id: e.id, name: e.name });
  }
  return bericht;
}
