// Was der Status aus `issue_activation_token` für den Versand bedeutet
// (Befund 8.5 aus Review 5.4).
//
// Vorher stand in index.ts eine einzige Bedingung: was nicht `issued` und nicht
// `issued_reset` ist, wurde als `no_mail` auf `info` protokolliert und mit 202
// beantwortet. In diesem Sammelzweig lag auch alles UNBEKANNTE — und damit sah
// eine halbe Auslieferung (Function neu, Migration alt: die Datenbank antwortet
// weiter `already_activated`) im Protokoll aus wie der Normalbetrieb, während
// kein Mitglied je eine Reset-Mail bekam.
//
// Deshalb eine Erlaubnisliste statt einer Ausschlussbedingung: was hier nicht
// steht, ist ein Fehler und wird auch so protokolliert. Die Antwort nach außen
// bleibt in JEDEM dieser Fälle 202 — ein eigener Ausgang wäre genau das Orakel
// für Mitgliedsadressen, das die ganze Konstruktion verhindert.

/** `unerwartet` ist kein Ausgang der Datenbank, sondern die Aussage „passt nicht zu ihr". */
export type VersandArt = "aktivierung" | "reset" | "kein_versand" | "unerwartet";

/**
 * Die erlaubten Status stehen im `comment on function` von
 * `issue_activation_token` (`20260807200000`): unknown, rate_limited, pending,
 * rate_limited_day, issued, issued_reset. Wer dort einen ergänzt, kommt hier
 * vorbei — sonst meldet diese Function ihn als Fehler.
 */
export function versandArt(status: string | undefined): VersandArt {
  switch (status) {
    case "issued":
      return "aktivierung";
    case "issued_reset":
      return "reset";
    // Kein Versand, aber erwartet: unbekannte Adresse, 60-s-Sperre, offener Link
    // im 24-h-Schutzfenster, Tagesgrenze. Alle vier sind Normalbetrieb.
    case "unknown":
    case "rate_limited":
    case "pending":
    case "rate_limited_day":
      return "kein_versand";
    default:
      return "unerwartet";
  }
}
