// deno test  (aus supabase/functions/send-activation/)
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { activationUrl, escapeHtml, renderActivation } from "./emails.ts";

Deno.test("activationUrl legt das Token ins FRAGMENT, nicht in den Query-String", () => {
  const url = activationUrl("https://app.test", "abc123");
  assertEquals(url, "https://app.test/aktivierung#token=abc123");
  // Der Kern der Anforderung: ein Query-String landet in Browser-Historie,
  // Server- und CDN-Logs und potenziell im Referer. Ein Fragment nie.
  assert(!url.includes("?token="), "Token darf nicht im Query-String stehen");
});

Deno.test("activationUrl verträgt einen Basis-URL mit Schrägstrich", () => {
  assertEquals(activationUrl("https://app.test/", "abc"), "https://app.test/aktivierung#token=abc");
});

Deno.test("activationUrl kodiert das Token", () => {
  assertStringIncludes(activationUrl("https://app.test", "a+b/c="), "%2B");
});

Deno.test("renderActivation: Betreff und Anrede", () => {
  const e = renderActivation({ name: "Erika", url: "https://app.test/aktivierung#token=t" });
  assertStringIncludes(e.subject, "eff.bee.zee");
  assertStringIncludes(e.html, "Erika");
  assertStringIncludes(e.text, "Erika");
});

Deno.test("renderActivation: die zwei Pflicht-Sätze zur Einordnung stehen drin", () => {
  // Ohne sie kommen 70 Rückfragen — Detlevs ausdrückliche Vorgabe.
  const e = renderActivation({ name: "X", url: "https://app.test/#token=t" });
  assertStringIncludes(e.html, "eff.bee.zee");
  assertStringIncludes(e.html, "Fair Business Club");
  assertStringIncludes(e.text, "eff.bee.zee");
});

Deno.test("renderActivation: der Link steht im HTML UND im Text", () => {
  const url = "https://app.test/aktivierung#token=geheim";
  const e = renderActivation({ name: "X", url });
  assertStringIncludes(e.html, url);
  assertStringIncludes(e.text, url);
});

Deno.test("renderActivation: der Klartext-Token steht NUR im Link, nie ein Hash", () => {
  const e = renderActivation({ name: "X", url: "https://app.test/aktivierung#token=KLARTEXT" });
  assertStringIncludes(e.html, "KLARTEXT");
  // Ein Hash hat in der Mail nichts zu suchen; er ist das, was in der DB bleibt.
  assert(!/[0-9a-f]{64}/.test(e.html), "kein SHA-256-Hex in der Mail");
});

Deno.test("renderActivation: die 72-Stunden-Zusage und die Entwertung stehen im Text", () => {
  // Beides sind technische Zusagen (expires_at bzw. invalidated_at). Wer
  // zweimal anfordert und den ersten Link klickt, muss vorgewarnt sein.
  const e = renderActivation({ name: "X", url: "https://app.test/#token=t" });
  assertStringIncludes(e.text, "72");
  assertStringIncludes(e.text.toLowerCase(), "ungültig");
});

Deno.test("renderActivation: KEINE Zusage, die nicht hält", () => {
  // „auch nicht für uns" wäre unwahr — service_role und der Betrieb sehen das
  // Profil unabhängig vom Gate. Eine Datenschutzzusage, die nicht trägt, ist
  // schlimmer als keine.
  const e = renderActivation({ name: "X", url: "https://app.test/#token=t" });
  assert(!e.html.includes("auch nicht für uns"));
  assert(!e.text.includes("auch nicht für uns"));
});

Deno.test("renderActivation: leerer Name fällt auf eine neutrale Anrede zurück", () => {
  const e = renderActivation({ name: "  ", url: "https://app.test/#token=t" });
  assertStringIncludes(e.html, "Hallo");
  assert(!e.html.includes("Liebe/r  ,"));
});

Deno.test("escapeHtml neutralisiert Injektion", () => {
  assertEquals(escapeHtml('<script>"x"</script>'), "&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
});

Deno.test("renderActivation: ein Name mit Markup wird escaped", () => {
  const e = renderActivation({ name: "Max <b>", url: "https://app.test/#token=t" });
  assertStringIncludes(e.html, "Max &lt;b&gt;");
  assert(!e.html.includes("Max <b>"));
});
