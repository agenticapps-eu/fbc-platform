// Zusagen über die reine Logik der Kontolöschung (AGE-708).
//
// Sie laufen im CI-Job `edge-functions` (Deno), den `pnpm test` NIE sieht.
import { assertEquals } from "jsr:@std/assert@1";
import {
  antwortFuer,
  BUCKETS,
  objektPfade,
  pruefeAuftrag,
  unterordner,
} from "./loeschen.ts";

const ICH = "11111111-1111-1111-1111-111111111111";
const ANDERER = "22222222-2222-2222-2222-222222222222";

Deno.test("event-covers wird NICHT geraeumt", () => {
  // Bewusste Entscheidung, kein Versehen: das Titelbild gehoert zur
  // Veranstaltung, und die bleibt bestehen.
  assertEquals(BUCKETS.includes("event-covers" as never), false);
  assertEquals([...BUCKETS], ["avatars", "covers", "post-media", "feedback-screenshots"]);
});

Deno.test("objektPfade nimmt Dateien und laesst Ordner liegen", () => {
  const pfade = objektPfade(ICH, [
    { name: "alt.jpg", id: "a" },
    { name: "neu.jpg", id: "b" },
    { name: "beitrag-7", id: null },
  ]);
  assertEquals(pfade, [`${ICH}/alt.jpg`, `${ICH}/neu.jpg`]);
});

Deno.test("objektPfade findet auch ersetzte Bilder", () => {
  // Der Grund, warum ueberhaupt gelistet und nicht `profiles.avatar_url`
  // gelesen wird: die Spalte kennt nur das letzte Bild. Wer dreimal gewechselt
  // hat, hat drei Dateien — zwei davon stehen nirgends mehr.
  const pfade = objektPfade(ICH, [
    { name: "v1.jpg", id: "a" },
    { name: "v2.jpg", id: "b" },
    { name: "v3.jpg", id: "c" },
  ]);
  assertEquals(pfade.length, 3);
});

Deno.test("kein Pfad zeigt jemals aus dem eigenen Ordner heraus", () => {
  // Der Beleg fuer „fremde Dateien bleiben unberuehrt": geraeumt wird
  // ausschliesslich unterhalb von `<uid>/`, und alle vier Buckets legen genau
  // dort ab (so steht es in ihren INSERT-Policies). Selbst ein boesartiger
  // Eintragsname kann den Praefix nicht verlassen, weil er angehaengt und
  // nicht aufgeloest wird.
  const pfade = objektPfade(ICH, [
    { name: "harmlos.jpg", id: "a" },
    { name: "../../fremd.jpg", id: "b" },
  ]);
  for (const p of pfade) assertEquals(p.startsWith(`${ICH}/`), true);
});

Deno.test("unterordner liefert genau die Ordner", () => {
  // `post-media` legt je Beitrag einen Unterordner an. Ohne den Abstieg bliebe
  // dort jede Datei liegen, und zwar unbemerkt.
  assertEquals(
    unterordner(ICH, [
      { name: "beitrag-7", id: null },
      { name: "lose.webp", id: "x" },
      { name: "beitrag-9", id: null },
    ]),
    [`${ICH}/beitrag-7`, `${ICH}/beitrag-9`],
  );
});

Deno.test("ohne Sitzung: 401, nichts geschieht", () => {
  assertEquals(pruefeAuftrag(undefined, {}), {
    ok: false,
    status: 401,
    grund: "keine gueltige Sitzung",
  });
});

Deno.test("fremde Ziel-ID wird ABGELEHNT, nicht ignoriert", () => {
  // Aus dem Plan-Review (codex, MEDIUM). Wer eine fremde ID schickt und `200`
  // bekommt, glaubt, sie sei geloescht worden — Ignorieren ist hier die
  // gefaehrlichere Antwort.
  assertEquals(pruefeAuftrag(ICH, { profile_id: ANDERER }), {
    ok: false,
    status: 403,
    grund: "fremdes Konto",
  });
});

Deno.test("die eigene ID mitzuschicken ist erlaubt", () => {
  assertEquals(pruefeAuftrag(ICH, { profile_id: ICH }), { ok: true });
});

Deno.test("gar keine ID mitzuschicken ist der Normalfall", () => {
  assertEquals(pruefeAuftrag(ICH, {}), { ok: true });
  assertEquals(pruefeAuftrag(ICH, null), { ok: true });
});

Deno.test("alle drei Schritte erledigt: 200", () => {
  const { status, rumpf } = antwortFuer({ dateien: true, anonymisieren: true, auth: true });
  assertEquals(status, 200);
  assertEquals(rumpf.geloescht, true);
});

Deno.test("ein Teilerfolg meldet NIEMALS Erfolg", () => {
  // Die Zusage aus dem Spec. Der zurueckbleibende Zustand hat zu WENIG
  // geloescht — heilbar durch erneuten Aufruf, aber kein Erfolg.
  const { status, rumpf } = antwortFuer({ dateien: true, anonymisieren: true, auth: false });
  assertEquals(status, 207);
  assertEquals(rumpf.geloescht, false);
  assertEquals(rumpf.offen, ["auth"]);
});

Deno.test("scheitert der erste Schritt, stehen alle drei offen", () => {
  const { status, rumpf } = antwortFuer({ dateien: false, anonymisieren: false, auth: false });
  assertEquals(status, 207);
  assertEquals(rumpf.offen, ["dateien", "anonymisieren", "auth"]);
});
