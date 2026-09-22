// deno test  (aus supabase/functions/anforderung-eingang/)
//
// Das Modell hinter der Action ist kein vertrauenswürdiger Aufrufer (AGE-830,
// „Kein Vertrauen auf das Modell"). Diese Tests belegen, dass jede Pflicht und
// jede Grenze serverseitig greift und dass jede Ablehnung ein ganzer Satz ist,
// den der GPT vorlesen kann.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { pruefeAnforderung } from "./pruefung.ts";

const GUELTIG = {
  titel: "Die Suche auf der Mitgliederseite ist zu klein",
  beschreibung: "**Was gewünscht ist**\nEin größeres Suchfeld.",
  art: "aenderung" as const,
  einreicher: "Detlev Krause",
};

function fehlerVon(rumpf: unknown): string {
  const e = pruefeAnforderung(rumpf);
  assert(!e.ok, `erwartet abgelehnt: ${JSON.stringify(rumpf)}`);
  return e.fehler;
}

/** Ganze deutsche Sätze: Großbuchstabe vorn, Satzzeichen hinten. */
function assertSatz(text: string) {
  assert(/^[A-ZÄÖÜ„]/.test(text), `beginnt nicht wie ein Satz: ${text}`);
  assert(/[.!?]$/.test(text), `endet nicht wie ein Satz: ${text}`);
}

Deno.test("gültige Anforderung ohne Route und ohne Dateien", () => {
  const e = pruefeAnforderung(GUELTIG);
  assert(e.ok);
  assertEquals(e.anforderung, { ...GUELTIG, route: null, dateien: [] });
});

Deno.test("Textfelder werden getrimmt, Route und Dateien übernommen", () => {
  const e = pruefeAnforderung({
    ...GUELTIG,
    titel: "  Titel  ",
    route: " /mitglieder ",
    openaiFileIdRefs: [{ name: "a.png" }],
  });
  assert(e.ok);
  assertEquals(e.anforderung.titel, "Titel");
  assertEquals(e.anforderung.route, "/mitglieder");
  assertEquals(e.anforderung.dateien, [{ name: "a.png" }]);
});

Deno.test("leere Route gilt als nicht angegeben", () => {
  const e = pruefeAnforderung({ ...GUELTIG, route: "   " });
  assert(e.ok);
  assertEquals(e.anforderung.route, null);
});

Deno.test("Rumpf, der kein Objekt ist, wird abgelehnt", () => {
  for (const rumpf of [null, "text", 42, [GUELTIG]]) assertSatz(fehlerVon(rumpf));
});

for (const feld of ["titel", "beschreibung", "art", "einreicher"] as const) {
  Deno.test(`fehlendes Pflichtfeld ${feld} wird mit einem Satz abgelehnt`, () => {
    const ohne: Record<string, unknown> = { ...GUELTIG };
    delete ohne[feld];
    assertSatz(fehlerVon(ohne));
    // Leer und Nicht-Text zählen wie fehlend.
    assertSatz(fehlerVon({ ...GUELTIG, [feld]: "   " }));
    assertSatz(fehlerVon({ ...GUELTIG, [feld]: 7 }));
  });
}

Deno.test("mehrere Mängel werden zusammen gemeldet", () => {
  const f = fehlerVon({ beschreibung: "x" });
  assert(f.includes("Titel"), f);
  assert(f.includes("Name"), f);
  assert(f.includes("Art") || f.includes("Fehler"), f);
});

Deno.test("unzulässige Art nennt die vier Möglichkeiten in normalen Worten", () => {
  const f = fehlerVon({ ...GUELTIG, art: "wunsch" });
  assertSatz(f);
  for (const wort of ["Fehler", "Änderung", "Funktion", "Idee"]) assert(f.includes(wort), f);
});

Deno.test("alle vier Arten sind zulässig", () => {
  for (const art of ["fehler", "aenderung", "funktion", "idee"]) {
    assert(pruefeAnforderung({ ...GUELTIG, art }).ok, art);
  }
});

const GRENZEN = [
  ["titel", 200],
  ["beschreibung", 8000],
  ["einreicher", 120],
  ["route", 200],
] as const;

for (const [feld, grenze] of GRENZEN) {
  Deno.test(`${feld}: genau ${grenze} Zeichen gehen, eines mehr nicht`, () => {
    assert(pruefeAnforderung({ ...GUELTIG, [feld]: "a".repeat(grenze) }).ok);
    const f = fehlerVon({ ...GUELTIG, [feld]: "a".repeat(grenze + 1) });
    assertSatz(f);
    assert(f.includes(String(grenze)), f);
  });
}

Deno.test("Grenzen zählen Zeichen, nicht UTF-16-Einheiten", () => {
  // 200 Emoji sind 200 Zeichen, aber 400 UTF-16-Einheiten. Das OpenAPI-Schema
  // (maxLength) zählt Zeichen; die Function darf nicht strenger sein.
  assert(pruefeAnforderung({ ...GUELTIG, titel: "😀".repeat(200) }).ok);
});

Deno.test("Dateien: zehn gehen, elf werden abgelehnt", () => {
  assert(pruefeAnforderung({ ...GUELTIG, openaiFileIdRefs: Array(10).fill("f") }).ok);
  const f = fehlerVon({ ...GUELTIG, openaiFileIdRefs: Array(11).fill("f") });
  assertSatz(f);
  assert(f.includes("zehn"), f);
});

Deno.test("Dateien, die keine Liste sind, werden abgelehnt", () => {
  assertSatz(fehlerVon({ ...GUELTIG, openaiFileIdRefs: "file-1" }));
});

Deno.test("fremde Felder werden ignoriert, nicht übernommen", () => {
  const e = pruefeAnforderung({ ...GUELTIG, teamId: "x", labelIds: ["y"], stateId: "z" });
  assert(e.ok);
  assertEquals(Object.keys(e.anforderung).sort(), [
    "art", "beschreibung", "dateien", "einreicher", "route", "titel",
  ]);
});

Deno.test("route mit falschem Typ wird abgelehnt, null gilt als nicht angegeben", () => {
  assertSatz(fehlerVon({ ...GUELTIG, route: { teamId: "x" } }));
  assertSatz(fehlerVon({ ...GUELTIG, route: 7 }));
  const e = pruefeAnforderung({ ...GUELTIG, route: null });
  assert(e.ok);
  assertEquals(e.anforderung.route, null);
});
