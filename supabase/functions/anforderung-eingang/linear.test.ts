// deno test  (aus supabase/functions/anforderung-eingang/)
//
// Die drei Schritte gegen Linear, geprüft an einem aufzeichnenden `fetch`.
// Die Form des Uploads folgt der Linear-Doku „How to upload a file to Linear":
// `fileUpload` → PUT mit `Content-Type`, `Cache-Control` und ALLEN gelieferten
// Headern. Fehlt einer, antwortet der Speicher mit 403.

import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { LINEAR_GRAPHQL, LinearFehler, legeIssueAn, ladeHoch } from "./linear.ts";

type Aufruf = { url: string; init: RequestInit };

function aufzeichnendesFetch(antworten: Array<(a: Aufruf) => Response | Promise<Response>>) {
  const aufrufe: Aufruf[] = [];
  const fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const a = { url: String(input), init };
    aufrufe.push(a);
    const antwort = antworten.shift();
    if (!antwort) throw new Error(`unerwarteter Aufruf: ${a.url}`);
    return await antwort(a);
  }) as typeof globalThis.fetch;
  return { fetch, aufrufe };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const uploadOk = () => json({
  data: {
    fileUpload: {
      success: true,
      uploadFile: {
        uploadUrl: "https://storage.example/put?sig=1",
        assetUrl: "https://uploads.linear.app/asset-1",
        headers: [
          { key: "x-goog-meta-a", value: "1" },
          { key: "cache-control", value: "private, max-age=1" },
        ],
      },
    },
  },
});

const BYTES = new Uint8Array([137, 80, 78, 71]);

Deno.test("ladeHoch: fileUpload, dann PUT mit allen Headern; Linears Werte gewinnen", async () => {
  const { fetch, aufrufe } = aufzeichnendesFetch([uploadOk, () => new Response(null, { status: 200 })]);
  const asset = await ladeHoch({ fetch, apiKey: "lin_api_x" }, {
    mime: "image/png",
    name: "bild.png",
    bytes: BYTES,
  });
  assertEquals(asset, "https://uploads.linear.app/asset-1");
  assertEquals(aufrufe.length, 2);

  // 1. GraphQL mit dem Schlüssel OHNE „Bearer“ (Personal API Key)
  const [gql, put] = aufrufe;
  assertEquals(gql.url, LINEAR_GRAPHQL);
  assertEquals(new Headers(gql.init.headers).get("authorization"), "lin_api_x");
  const vars = JSON.parse(String(gql.init.body)).variables;
  assertEquals(vars, { contentType: "image/png", filename: "bild.png", size: 4 });

  // 2. PUT an die signierte Adresse, mit genau diesen Headern
  assertEquals(put.url, "https://storage.example/put?sig=1");
  assertEquals(put.init.method, "PUT");
  const h = new Headers(put.init.headers);
  assertEquals(h.get("content-type"), "image/png");
  assertEquals(h.get("x-goog-meta-a"), "1");
  // Kollision: Linears signierter Wert gewinnt über unseren Standard.
  assertEquals(h.get("cache-control"), "private, max-age=1");
  assertEquals(put.init.body, BYTES);
});

Deno.test("ladeHoch: ohne eigene Kollision gilt Cache-Control aus der Doku", async () => {
  const ohne = json({
    data: {
      fileUpload: {
        success: true,
        uploadFile: { uploadUrl: "https://s/put", assetUrl: "https://a", headers: [] },
      },
    },
  });
  const { fetch, aufrufe } = aufzeichnendesFetch([() => ohne, () => new Response(null)]);
  await ladeHoch({ fetch, apiKey: "k" }, { mime: "image/png", name: "b.png", bytes: BYTES });
  assertEquals(new Headers(aufrufe[1].init.headers).get("cache-control"), "public, max-age=31536000");
});

Deno.test("ladeHoch: PUT mit 403 ist ein Fehler, kein Asset", async () => {
  const { fetch } = aufzeichnendesFetch([uploadOk, () => new Response(null, { status: 403 })]);
  await assertRejects(
    () => ladeHoch({ fetch, apiKey: "k" }, { mime: "image/png", name: "b.png", bytes: BYTES }),
    LinearFehler,
  );
});

Deno.test("ladeHoch: success false oder GraphQL-Fehler wird kein PUT", async () => {
  for (const antwort of [
    json({ data: { fileUpload: { success: false, uploadFile: null } } }),
    json({ errors: [{ message: "nope" }] }),
    json({}, 500),
  ]) {
    const { fetch, aufrufe } = aufzeichnendesFetch([() => antwort]);
    await assertRejects(
      () => ladeHoch({ fetch, apiKey: "k" }, { mime: "image/png", name: "b.png", bytes: BYTES }),
      LinearFehler,
    );
    assertEquals(aufrufe.length, 1);
  }
});

Deno.test("legeIssueAn: schickt das Input unverändert und liefert den Bezeichner", async () => {
  const { fetch, aufrufe } = aufzeichnendesFetch([
    () => json({ data: { issueCreate: { success: true, issue: { identifier: "AGE-901" } } } }),
  ]);
  const input = {
    teamId: "t", projectId: "p", stateId: "s", labelIds: ["a", "b"],
    title: "Titel", description: "Text",
  };
  assertEquals(await legeIssueAn({ fetch, apiKey: "k" }, input), "AGE-901");
  assertEquals(JSON.parse(String(aufrufe[0].init.body)).variables, { input });
});

Deno.test("legeIssueAn: jede unerwartete Antwort ist ein LinearFehler", async () => {
  for (const antwort of [
    () => json({ data: { issueCreate: { success: false, issue: null } } }),
    () => json({ errors: [{ message: "Entity not found" }] }),
    () => json({ data: null }, 400),
    () => new Response("kein json", { status: 502 }),
    () => Promise.reject(new TypeError("Netz weg")),
  ]) {
    const { fetch } = aufzeichnendesFetch([antwort]);
    await assertRejects(
      () => legeIssueAn({ fetch, apiKey: "k" }, {
        teamId: "t", projectId: "p", stateId: "s", labelIds: [], title: "x", description: "y",
      }),
      LinearFehler,
    );
  }
});

Deno.test("das Signal wird an jeden Aufruf durchgereicht", async () => {
  const { fetch, aufrufe } = aufzeichnendesFetch([uploadOk, () => new Response(null)]);
  const signal = new AbortController().signal;
  await ladeHoch({ fetch, apiKey: "k" }, { mime: "image/png", name: "b.png", bytes: BYTES }, signal);
  assert(aufrufe.every((a) => a.init.signal === signal));
});
