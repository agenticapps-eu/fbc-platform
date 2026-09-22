// deno test  (aus supabase/functions/anforderung-eingang/)
//
// Der ganze Ablauf, an einem aufzeichnenden `fetch`, der OpenAIs Dateihost,
// Linears GraphQL und den signierten Speicher spielt. Kein Netz, kein Issue.
//
// Jede Zusage „wird nicht aufgerufen" hat eine Positivkontrolle: der erste Test
// zeigt, dass derselbe Ersatz jeden dieser Aufrufe aufzeichnet, wenn er
// stattfindet. Ohne ihn bewiese ein kaputter Ersatz jede Negativaussage.

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { type EingangDeps, LINEAR_ZIEL, verarbeite } from "./eingang.ts";

const SCHLUESSEL = "a".repeat(32);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7]);

const RUMPF = {
  titel: "Suche zu klein",
  beschreibung: "**Was gewünscht ist**\nGrößer. GEHEIMER-TEXT",
  art: "aenderung",
  einreicher: "Detlev Krause",
  route: "/mitglieder",
  openaiFileIdRefs: [{
    name: "screen-GEHEIMNAME.png",
    id: "file-1",
    mime_type: "image/png",
    download_link: "https://files.oaiusercontent.com/file-1?sig=GEHEIMLINK",
  }],
};

interface Welt {
  aufrufe: string[];
  issueInput?: Record<string, unknown>;
  logs: string[];
  vermerkt: number;
}

function baue(over: {
  env?: Partial<EingangDeps["env"]>;
  frei?: () => Promise<boolean>;
  vermerken?: () => Promise<void>;
  datei?: () => Response | Promise<Response>;
  issue?: () => Response | Promise<Response>;
  fristen?: EingangDeps["fristen"];
} = {}) {
  const welt: Welt = { aufrufe: [], logs: [], vermerkt: 0 };
  const deps: EingangDeps = {
    env: { schluessel: SCHLUESSEL, linearApiKey: "lin_api_x", probelauf: false, ...over.env },
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.hostname === "files.oaiusercontent.com") {
        welt.aufrufe.push("download");
        return over.datei ? await over.datei() : new Response(PNG.slice());
      }
      if (url.hostname === "storage.example") {
        welt.aufrufe.push("put");
        return new Response(null);
      }
      if (url.hostname === "api.linear.app") {
        const body = JSON.parse(String(init?.body));
        if (String(body.query).includes("fileUpload")) {
          welt.aufrufe.push("fileUpload");
          return Response.json({
            data: {
              fileUpload: {
                success: true,
                uploadFile: {
                  uploadUrl: "https://storage.example/put",
                  assetUrl: "https://uploads.linear.app/asset-1",
                  headers: [],
                },
              },
            },
          });
        }
        welt.aufrufe.push("issueCreate");
        welt.issueInput = body.variables.input;
        return over.issue
          ? await over.issue()
          : Response.json({ data: { issueCreate: { success: true, issue: { identifier: "AGE-901" } } } });
      }
      throw new Error(`unerwarteter Aufruf: ${url}`);
    }) as typeof fetch,
    anforderungFrei: over.frei ?? (async () => {
      welt.aufrufe.push("frei");
      return true;
    }),
    anforderungVermerken: over.vermerken ?? (async () => {
      welt.aufrufe.push("vermerken");
      welt.vermerkt++;
    }),
    jetzt: () => new Date("2026-09-22T12:30:00Z"),
    log: (level, event, felder) => welt.logs.push(JSON.stringify({ level, event, ...felder })),
    fristen: over.fristen,
  };
  return { deps, welt };
}

function anfrage(rumpf: unknown = RUMPF, schluessel: string | null = SCHLUESSEL, methode = "POST") {
  const headers = new Headers({ "content-type": "application/json" });
  if (schluessel !== null) headers.set("x-anforderung-schluessel", schluessel);
  return new Request("https://x.supabase.co/functions/v1/anforderung-eingang", {
    method: methode,
    headers,
    body: methode === "POST" ? (typeof rumpf === "string" ? rumpf : JSON.stringify(rumpf)) : undefined,
  });
}

async function fehlerAntwort(res: Response, status: number) {
  assertEquals(res.status, status);
  assertEquals(res.headers.get("content-type"), "application/json");
  const body = await res.json();
  assertEquals(Object.keys(body), ["fehler"]);
  assert(/^[A-ZÄÖÜ].*[.!?]$/.test(body.fehler), body.fehler);
  return body.fehler as string;
}

Deno.test("Positivkontrolle: der ganze Weg, in dieser Reihenfolge", async () => {
  const { deps, welt } = baue();
  const res = await verarbeite(anfrage(), deps);
  assertEquals(res.status, 201);
  const body = await res.json();
  assertEquals(body.nummer, "AGE-901");
  assert(typeof body.hinweis === "string" && body.hinweis.length > 0);
  assert(!JSON.stringify(body).includes("linear.app"), JSON.stringify(body));
  assertEquals(welt.aufrufe, ["frei", "download", "fileUpload", "put", "issueCreate", "vermerken"]);
});

Deno.test("das Ziel ist fest verdrahtet, auch wenn der Rumpf etwas anderes will", async () => {
  const { deps, welt } = baue();
  await verarbeite(
    anfrage({ ...RUMPF, teamId: "fremd", stateId: "fremd", labelIds: ["fremd"], projectId: "fremd" }),
    deps,
  );
  const input = welt.issueInput!;
  assertEquals(input.teamId, "edf1f698-4f91-4caf-b87e-d129419a90c5");
  assertEquals(input.projectId, "b815c05b-f6ed-413c-95a2-755cde30e916");
  assertEquals(input.stateId, "ee8d6b49-8806-4e92-9878-7238f5421632");
  assertEquals(input.labelIds, [
    "ec4878f0-7a29-42e1-b294-8ab40ef9d1d6", // von-detlev
    "dd58d928-d4ec-4b45-b092-39d2f7a51edd", // Improvement
  ]);
  assertEquals(input.title, "Suche zu klein");
  assertEquals(Object.keys(input).sort(), [
    "description", "labelIds", "projectId", "stateId", "teamId", "title",
  ]);
  assertStringIncludes(String(input.description), "![screen-GEHEIMNAME.png](https://uploads.linear.app/asset-1)");
});

Deno.test("jede Art bekommt ihr Label", async () => {
  const erwartet = {
    fehler: LINEAR_ZIEL.labels.fehler,
    aenderung: LINEAR_ZIEL.labels.aenderung,
    funktion: LINEAR_ZIEL.labels.funktion,
    idee: LINEAR_ZIEL.labels.idee,
  };
  assertEquals(new Set(Object.values(erwartet)).size, 4);
  for (const [art, label] of Object.entries(erwartet)) {
    const { deps, welt } = baue();
    await verarbeite(anfrage({ ...RUMPF, art, openaiFileIdRefs: [] }), deps);
    assertEquals(welt.issueInput!.labelIds, [LINEAR_ZIEL.labels.vonDetlev, label], art);
  }
});

for (
  const [fall, schluessel] of [
    ["fehlt", null],
    ["leer", ""],
    ["falsch", "b".repeat(32)],
    ["anders lang", SCHLUESSEL + "x"],
    ["über 512 Zeichen", SCHLUESSEL + "x".repeat(600)],
  ] as const
) {
  Deno.test(`401, Schlüssel ${fall}: kein einziger Aufruf`, async () => {
    const { deps, welt } = baue();
    await fehlerAntwort(await verarbeite(anfrage(RUMPF, schluessel), deps), 401);
    assertEquals(welt.aufrufe, []);
  });
}

Deno.test("500 ohne Secret, und ein leerer Header passt nie auf ein leeres Secret", async () => {
  for (const env of [{ schluessel: "" }, { schluessel: undefined }, { linearApiKey: undefined }]) {
    const { deps, welt } = baue({ env });
    await fehlerAntwort(await verarbeite(anfrage(RUMPF, ""), deps), 500);
    assertEquals(welt.aufrufe, []);
  }
});

Deno.test("405 für alles außer POST", async () => {
  const { deps, welt } = baue();
  await fehlerAntwort(await verarbeite(anfrage(RUMPF, SCHLUESSEL, "GET"), deps), 405);
  assertEquals(welt.aufrufe, []);
});

Deno.test("kaputtes JSON: 400 mit Satz, nichts aufgerufen", async () => {
  const { deps, welt } = baue();
  await fehlerAntwort(await verarbeite(anfrage("{kaputt"), deps), 400);
  assertEquals(welt.aufrufe, []);
});

Deno.test("Pflichtfeld fehlt: 400, weder Drossel noch Download noch Linear", async () => {
  const { deps, welt } = baue();
  const f = await fehlerAntwort(await verarbeite(anfrage({ ...RUMPF, titel: "" }), deps), 400);
  assertStringIncludes(f, "Titel");
  assertEquals(welt.aufrufe, []);
});

Deno.test("gedrosselt: 429, kein Download, kein Linear, nichts vermerkt", async () => {
  const { deps, welt } = baue({ frei: async () => false });
  await fehlerAntwort(await verarbeite(anfrage(), deps), 429);
  assertEquals(welt.aufrufe, []);
});

Deno.test("Drossel nicht erreichbar: 500, nichts angelegt", async () => {
  const { deps, welt } = baue({ frei: () => Promise.reject(new Error("db")) });
  await fehlerAntwort(await verarbeite(anfrage(), deps), 500);
  assertEquals(welt.aufrufe, []);
});

Deno.test("abgelaufener Link: das Issue entsteht trotzdem, mit Vermerk", async () => {
  const { deps, welt } = baue({ datei: () => new Response("x", { status: 403 }) });
  const res = await verarbeite(anfrage(), deps);
  assertEquals(res.status, 201);
  assertStringIncludes(String(welt.issueInput!.description), "Nicht übertragen: screen-GEHEIMNAME.png (nicht mehr abrufbar)");
  assertStringIncludes((await res.json()).hinweis, "1 Datei");
  assertEquals(welt.vermerkt, 1);
});

Deno.test("Linear lehnt ab: 502 mit „nicht bestätigt“, nichts vermerkt", async () => {
  const { deps, welt } = baue({ issue: () => Response.json({ errors: [{ message: "x" }] }) });
  const f = await fehlerAntwort(await verarbeite(anfrage(), deps), 502);
  assertStringIncludes(f, "nicht bestätigt");
  assertEquals(welt.vermerkt, 0);
});

Deno.test("issueCreate hängt: 502 nach der Frist, nichts vermerkt", async () => {
  const { deps, welt } = baue({
    issue: () => new Promise<Response>(() => {}),
    fristen: { jeDateiMs: 1_000, gesamtMs: 1_000, issueMs: 30 },
  });
  await fehlerAntwort(await verarbeite(anfrage(), deps), 502);
  assertEquals(welt.vermerkt, 0);
});

Deno.test("Vermerken scheitert nach dem Anlegen: trotzdem 201, weil das Issue existiert", async () => {
  const { deps, welt } = baue({ vermerken: () => Promise.reject(new Error("db")) });
  const res = await verarbeite(anfrage(), deps);
  assertEquals(res.status, 201);
  assert(welt.logs.some((l) => l.includes('"level":"error"')), welt.logs.join("\n"));
});

Deno.test("Probelauf: lädt, ruft Linear nie, vermerkt nichts, 200 ohne Nummer", async () => {
  const { deps, welt } = baue({ env: { probelauf: true } });
  const res = await verarbeite(anfrage(), deps);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.probelauf, true);
  assert(!("nummer" in body), JSON.stringify(body));
  assertStringIncludes(body.hinweis, "Probelauf");
  assertEquals(welt.aufrufe, ["frei", "download"]);
});

Deno.test("das Log trägt weder Text noch Namen noch Link noch Schlüssel", async () => {
  for (const env of [{}, { probelauf: true }]) {
    const { deps, welt } = baue({ env });
    await verarbeite(anfrage(), deps);
    const log = welt.logs.join("\n");
    assert(welt.logs.length > 0);
    for (const verboten of ["GEHEIMER-TEXT", "GEHEIMNAME", "GEHEIMLINK", "Detlev", "Suche zu klein", SCHLUESSEL]) {
      assert(!log.includes(verboten), `${verboten} im Log:\n${log}`);
    }
  }
});

Deno.test("das Log nennt Nummer, Art und Typ und Größe der Datei", async () => {
  const { deps, welt } = baue();
  await verarbeite(anfrage(), deps);
  const eintrag = JSON.parse(welt.logs.find((l) => l.includes("AGE-901"))!);
  assertEquals(eintrag.art, "aenderung");
  assertEquals(eintrag.dateien, [{
    typ: "image/png",
    groesse: PNG.byteLength,
    host: "files.oaiusercontent.com",
    ergebnis: "übernommen",
  }]);
});
