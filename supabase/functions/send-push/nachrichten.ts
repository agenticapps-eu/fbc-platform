// ════════════════════════════════════════════════════════════════════════════
// AGE-641 — was auf dem Sperrbildschirm steht
// ════════════════════════════════════════════════════════════════════════════
//
// Change: openspec/changes/push-fundament/. Phase A, Schritt 5.
//
// ══ WARUM DIESES MODUL NUR DREI FELDER KENNT ═══════════════════════════════
//
// `push_auftraege_holen` gibt eine FESTE Feldliste zurueck — Typ, ein Name und
// eine Ziel-Kennung — und niemals die Nutzlast. Der Grund steht in
// `20260827240000_push_zustellung.sql`: die contact_request-Zeilen seit dem
// 14.06. tragen Mitglieder-Freitext in `payload->>'message'`, und die bleiben
// auf Donalds Entscheidung vom 27.08. unangetastet.
//
// `Auftrag` bildet genau diese Feldliste ab. Der Freitext ist damit nicht
// „gefiltert", sondern in diesem Modul nicht vorhanden: es gibt kein Feld, aus
// dem ihn jemand versehentlich in einen Satz zoege. Das ist der Unterschied
// zwischen einer Zusage der Daten und einer Zusage des Quelltextes.
//
// ══ WARUM DIE SAETZE DENEN DER GLOCKE FOLGEN ═══════════════════════════════
//
// `HinweisGlocke.tsx:160` sagt dieselben Ereignisse in derselben Anrede. Zwei
// Formulierungen fuer dasselbe Ereignis waeren fuer ein Mitglied zwei
// Ereignisse — es liest beide, den Push und die Glocke.
//
// Ein Push ist dabei die schaerfere Flaeche: die Glocke steht offen auf einem
// Bildschirm, der Sperrbildschirm liegt auf einem Besprechungstisch. Wo die
// Glocke schon „wer, nicht was" sagt, bleibt es hier erst recht dabei.
//
// Donald, 28.08.2026.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Eine Zeile aus `push_auftraege_holen` bzw. `push_auftraege_faellig`. Die
 * Spaltennamen sind die der RPC — absichtlich nicht umbenannt, damit ein
 * Vergleich mit der Migration ohne Uebersetzungstabelle auskommt.
 */
export interface Auftrag {
  notification_id: string;
  token_id: string;
  token: string;
  plattform: string;
  typ: string;
  wer: string;
  ziel_id: string | null;
}

export interface Benachrichtigung {
  titel: string;
  text: string;
  /** Wohin ein Tippen fuehrt — oder `null`, wenn die App nur oeffnet. */
  ziel: string | null;
}

/**
 * Der Satz zum Typ. `Pick` statt `Auftrag`, damit an dieser Stelle gar kein
 * Token und keine Kennung in Reichweite liegt: was nicht uebergeben wird, kann
 * kein Aufrufer versehentlich in einen Text schreiben.
 */
export function baueBenachrichtigung(
  auftrag: Pick<Auftrag, "typ" | "wer" | "ziel_id">,
): Benachrichtigung {
  const wer = auftrag.wer.trim() || "Ein Mitglied";

  switch (auftrag.typ) {
    case "message":
      return {
        titel: "Neue Nachricht",
        text: `${wer} hat Ihnen geschrieben.`,
        ziel: gespraechsziel(auftrag.ziel_id),
      };
    case "contact_request":
      return {
        titel: "Neue Kontaktanfrage",
        text: `${wer} möchte Sie kennenlernen.`,
        ziel: null,
      };
    case "contact_request_accepted":
      return {
        titel: "Kontaktanfrage angenommen",
        text: `${wer} hat Ihre Kontaktanfrage angenommen.`,
        ziel: null,
      };
    case "contact_request_declined":
      return {
        titel: "Kontaktanfrage beantwortet",
        text: `${wer} hat Ihre Kontaktanfrage abgelehnt.`,
        ziel: null,
      };
    default:
      // Kein Rohtyp auf dem Sperrbildschirm. Dieselbe Regel wie in der Glocke:
      // `post_created_v2` waere fuer ein Mitglied kein Satz, sondern ein
      // Bezeichner aus unserer Datenbank.
      //
      // Erreichbar ist dieser Zweig nur ueber eine `push_routing`-Zeile, die
      // jemand auf `true` gesetzt hat, ohne hier einen Satz zu hinterlegen —
      // also genau dann, wenn die Liste aus Abschnitt 4 des Issues sich
      // bewegt. Ein allgemeiner Satz ist dort besser als ein leerer Push.
      return {
        titel: "Fair Business Club",
        text: "Es gibt etwas Neues.",
        ziel: null,
      };
  }
}

/**
 * Der Nachrichten-Hinweis fuehrt in sein Gespraech — ohne Ziel waere er der
 * schlechteste von allen: er sagt „jemand hat Ihnen geschrieben" und liesse
 * einen dann selbst suchen.
 *
 * Ohne Kennung bleibt die Uebersicht das Ziel. `/chat/undefined` waere eine
 * Adresse, die nichts oeffnet und trotzdem aussieht, als sollte sie —
 * dieselbe Regel wie in `HinweisGlocke.tsx:224`.
 */
function gespraechsziel(zielId: string | null): string {
  const kennung = zielId?.trim();
  return kennung ? `/chat/${encodeURIComponent(kennung)}` : "/chat";
}
