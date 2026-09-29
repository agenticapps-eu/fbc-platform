import { assertEquals } from "jsr:@std/assert@1";
import {
  ausgangFuer,
  berichtZusammenfassen,
  MAX_EINLADUNGEN,
  parseInviteRequest,
} from "./einladung.ts";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";

Deno.test("parseInviteRequest nimmt eine Liste von Kennungen", () => {
  assertEquals(parseInviteRequest({ ids: [A, B] }), { ids: [A, B] });
});

Deno.test("parseInviteRequest weist Unbrauchbares ab", () => {
  assertEquals(parseInviteRequest(null), null);
  assertEquals(parseInviteRequest({}), null);
  assertEquals(parseInviteRequest({ ids: [] }), null);
  assertEquals(parseInviteRequest({ ids: ["nicht-uuid"] }), null);
  assertEquals(parseInviteRequest({ ids: A }), null);
});

Deno.test("parseInviteRequest entfernt Dubletten, statt zweimal zu schicken", () => {
  // Eine Zeile zweimal auszuwählen ist an der Fläche nicht möglich — über den
  // Endpunkt schon. Zweimal zu schicken hiesse: der zweite Aufruf sieht den
  // gerade erzeugten Link und meldet `pending`. Der Bericht behauptete dann
  // ein Übersprungen, das der Admin selbst ausgelöst hat.
  assertEquals(parseInviteRequest({ ids: [A, B, A] }), { ids: [A, B] });
});

Deno.test("parseInviteRequest deckelt die Menge", () => {
  // Die Auswahl gilt je Seite, und eine Seite fasst 50. Ein Aufruf mit 5000
  // Kennungen käme nicht von der Fläche — und „an alle" ist genau das, was
  // ADR-0007 ausschliesst.
  const viele = Array.from(
    { length: MAX_EINLADUNGEN + 1 },
    (_, i) => `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, "0")}`,
  );
  assertEquals(parseInviteRequest({ ids: viele }), null);
});

Deno.test("ausgangFuer trennt die fünf Ausgänge", () => {
  assertEquals(ausgangFuer("issued", true), "verschickt");
  assertEquals(ausgangFuer("issued_reset", true), "verschickt");
  // Der wichtigste Fall: ein gültiger Link liegt im Postfach, es ging NICHTS
  // hinaus. Ein Bericht, der das als verschickt zählt, wäre gelogen.
  assertEquals(ausgangFuer("pending", false), "uebersprungen");
  assertEquals(ausgangFuer("rate_limited", false), "abgewiesen");
  assertEquals(ausgangFuer("rate_limited_day", false), "abgewiesen");
  // Ein deaktiviertes oder gelöschtes Konto bekommt keinen Link — das ist kein
  // Fehler und keine Grenze, sondern ein eigener Zustand.
  assertEquals(ausgangFuer("blocked", false), "nicht_einladbar");
  assertEquals(ausgangFuer("unknown", false), "nicht_einladbar");
});

Deno.test("ausgangFuer meldet einen abgelehnten Versand NICHT als verschickt", () => {
  // `issue_activation_token` hat das Token angelegt, Resend hat abgelehnt, das
  // Token wurde entwertet. Das Mitglied steht danach in „Eingeladen", weil ein
  // Link erzeugt wurde — und genau deshalb muss der Bericht die Ablehnung
  // nennen, sonst erfährt es niemand.
  assertEquals(ausgangFuer("issued", false), "fehlgeschlagen");
});

Deno.test("ausgangFuer behandelt einen unbekannten Status als Fehler, nicht als Erfolg", () => {
  // Eine halbe Auslieferung — Function neu, Migration alt — darf nicht wie
  // Normalbetrieb aussehen. Dieselbe Begründung wie in status.ts.
  assertEquals(ausgangFuer("gibtesnicht", true), "fehlgeschlagen");
  assertEquals(ausgangFuer(undefined, true), "fehlgeschlagen");
});

Deno.test("berichtZusammenfassen zählt je Ausgang und nennt die Betroffenen", () => {
  const bericht = berichtZusammenfassen([
    { id: A, name: "Anna", ausgang: "verschickt" },
    { id: B, name: "Bea", ausgang: "uebersprungen" },
    { id: "cccccccc-0000-4000-8000-000000000003", name: null, ausgang: "abgewiesen" },
  ]);
  assertEquals(bericht.zahlen, {
    verschickt: 1,
    uebersprungen: 1,
    abgewiesen: 1,
    nicht_einladbar: 0,
    fehlgeschlagen: 0,
  });
  // Namentlich, nicht nur gezählt: „2 übersprungen" zwingt den Admin sonst,
  // sie sich aus der Liste zusammenzusuchen.
  assertEquals(bericht.uebersprungen, [{ id: B, name: "Bea" }]);
  assertEquals(bericht.abgewiesen, [
    { id: "cccccccc-0000-4000-8000-000000000003", name: null },
  ]);
});

Deno.test("berichtZusammenfassen behauptet keine Sammelzahl über gemischter Menge", () => {
  // Die Zusage aus ADR-0007: es gibt keine einzelne Zahl „verschickt" über
  // einer Menge, in der etwas übersprungen wurde. Geprüft wird, dass der
  // Bericht ALLE Ausgänge führt — auch die mit null.
  const bericht = berichtZusammenfassen([{ id: A, name: "Anna", ausgang: "verschickt" }]);
  assertEquals(Object.keys(bericht.zahlen).sort(), [
    "abgewiesen",
    "fehlgeschlagen",
    "nicht_einladbar",
    "uebersprungen",
    "verschickt",
  ]);
});

Deno.test("berichtZusammenfassen über eine leere Menge ist leer, nicht erfolgreich", () => {
  const bericht = berichtZusammenfassen([]);
  assertEquals(bericht.zahlen.verschickt, 0);
  assertEquals(bericht.verschickt, []);
});
