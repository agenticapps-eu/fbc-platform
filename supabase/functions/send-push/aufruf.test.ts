// deno test  (aus supabase/functions/send-push/)
//
// Diese Datei schliesst eine Luecke, die seit AGE-641 offenstand: die
// Torwaechter von `send-push` — 405, fehlendes Secret, **401**, unlesbarer
// Rumpf, fehlende Weiche — hatten NULL Abdeckung. Alle bestehenden Zusagen der
// Function galten `anbieter.ts` und `nachrichten.ts`, also den reinen Modulen
// dahinter. Eine Auth-Pruefung ohne Zusage ist die teuerste Sorte Luecke.
//
// Aufgefallen im Fremd-Review zu `ota-stats` (02.09.): die Zusage, die dort
// `index.ts` als TEXT las, liess SECHS von sieben Mutationen gruen durch. Das
// Muster steckte auch hier.

import { assertEquals } from "jsr:@std/assert@1";
import { pruefeAufruf } from "./aufruf.ts";

const SECRET = "s3hr-geheim";

function anfrage(init: RequestInit & { body?: string } = {}) {
  return new Request("https://example.test/send-push", { method: "POST", ...init });
}
/** Ein echter, vollstaendig gueltiger Webhook-Aufruf. */
function echt(body: unknown, secret = SECRET) {
  return anfrage({
    headers: { authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
  });
}

Deno.test("alles ausser POST wird abgewiesen, ohne Logzeile", async () => {
  const p = await pruefeAufruf(anfrage({ method: "GET" }), SECRET);
  assertEquals(p.weiter, false);
  if (p.weiter) return;
  assertEquals(p.antwort.status, 405);
  assertEquals(p.log, null);
});

Deno.test("ein fehlendes Secret ist 500, nicht 401", async () => {
  // Die Unterscheidung traegt: als 401 beantwortet, suchte man den Fehler beim
  // Webhook statt in unseren Secrets.
  const p = await pruefeAufruf(echt({ modus: "faellig" }), undefined);
  assertEquals(p.weiter, false);
  if (p.weiter) return;
  assertEquals(p.antwort.status, 500);
  assertEquals(p.log?.level, "error");
  assertEquals(p.log?.event, "missing_webhook_secret");
});

Deno.test("ohne authorization-Kopfzeile: 401", async () => {
  const p = await pruefeAufruf(anfrage({ body: "{}" }), SECRET);
  assertEquals(p.weiter, false);
  if (p.weiter) return;
  assertEquals(p.antwort.status, 401);
  assertEquals(p.log?.event, "unauthorized");
});

Deno.test("ein falsches Geheimnis gleicher Laenge: 401", async () => {
  // Gleiche Laenge, damit wirklich der Vergleich entscheidet und nicht schon
  // die Laengenpruefung davor. Sonst waere die Zusage auch gruen, wenn der
  // Inhalt gar nicht mehr geprueft wuerde.
  const falsch = "s3hr-gehe1m";
  assertEquals(falsch.length, SECRET.length);
  const p = await pruefeAufruf(echt({ modus: "faellig" }, falsch), SECRET);
  assertEquals(p.weiter, false);
  if (p.weiter) return;
  assertEquals(p.antwort.status, 401);
});

Deno.test("das richtige Geheimnis ohne `Bearer `-Praefix: 401", async () => {
  const p = await pruefeAufruf(
    anfrage({ headers: { authorization: SECRET }, body: '{"modus":"faellig"}' }),
    SECRET,
  );
  assertEquals(p.weiter, false);
  if (p.weiter) return;
  assertEquals(p.antwort.status, 401);
});

Deno.test("ein unlesbarer Rumpf: 400, und keine Logzeile", async () => {
  const p = await pruefeAufruf(
    anfrage({ headers: { authorization: `Bearer ${SECRET}` }, body: "{kein json" }),
    SECRET,
  );
  assertEquals(p.weiter, false);
  if (p.weiter) return;
  assertEquals(p.antwort.status, 400);
  assertEquals(p.log, null);
});

Deno.test("weder Kennung noch Modus: 400 mit Logzeile", async () => {
  const p = await pruefeAufruf(echt({ record: {} }), SECRET);
  assertEquals(p.weiter, false);
  if (p.weiter) return;
  assertEquals(p.antwort.status, 400);
  assertEquals(p.log?.event, "kein_hinweis_und_kein_modus");
});

Deno.test("der Webhook-Weg: die Kennung kommt durch", async () => {
  const p = await pruefeAufruf(echt({ record: { id: "abc-123" } }), SECRET);
  assertEquals(p.weiter, true);
  if (!p.weiter) return;
  assertEquals(p.hinweisId, "abc-123");
  assertEquals(p.faellig, false);
});

Deno.test("der Wiederholungslauf: kein Hinweis, aber faellig", async () => {
  const p = await pruefeAufruf(echt({ modus: "faellig" }), SECRET);
  assertEquals(p.weiter, true);
  if (!p.weiter) return;
  assertEquals(p.hinweisId, undefined);
  assertEquals(p.faellig, true);
});

Deno.test("ein anderer Modus zaehlt nicht als faellig", async () => {
  // `modus` ist ein Wort aus einem fremden Rumpf; nur EIN Wert oeffnet den Weg.
  const p = await pruefeAufruf(echt({ modus: "alle" }), SECRET);
  assertEquals(p.weiter, false);
  if (p.weiter) return;
  assertEquals(p.antwort.status, 400);
});

Deno.test("ein JSON-Skalar als Rumpf bringt den Waechter nicht zu Fall", async () => {
  for (const rumpf of ["null", "42", '"x"', "[]"]) {
    const p = await pruefeAufruf(
      anfrage({ headers: { authorization: `Bearer ${SECRET}` }, body: rumpf }),
      SECRET,
    );
    assertEquals(p.weiter, false, `Rumpf ${rumpf} kam durch`);
    if (!p.weiter) assertEquals(p.antwort.status, 400);
  }
});

Deno.test("Verdrahtung: `index.ts` fuehrt keinen der Waechter doppelt", async () => {
  const quelle = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const kompakt = quelle.replace(/\s+/g, " ");
  // Die Antwort kommt fertig aus dem Modul — `index.ts` reicht sie nur durch.
  assertEquals(kompakt.includes("return pruefung.antwort;"), true);
  // `PUSH_WEBHOOK_SECRET` steht dort zu Recht — es wird hereingereicht, nicht
  // ausgewertet. Der Vergleich und die Statuscodes duerfen es nicht.
  for (const verboten of ["timingSafeEqual", "status: 401", "status: 405", "status: 500"]) {
    assertEquals(kompakt.includes(verboten), false, `index.ts fuehrt \`${verboten}\` doppelt`);
  }
});
