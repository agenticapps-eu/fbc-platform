// deno test  (aus supabase/functions/anforderung-eingang/)
//
// Jede Datei aus `openaiFileIdRefs` wird im selben Aufruf geladen, geprüft und
// hochgeladen, oder mit Grund vermerkt. Das Issue hängt nie an einer Datei.
//
// Die Einträge folgen der Form aus OpenAIs Doku (actions/sending-files, am
// 22.09. gelesen und am selben Tag mit `bildtest` gemessen):
// `{ name, id, mime_type, download_link }`, obwohl das Schema `string` sagt.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { type DateiDeps, uebernehmeDateien } from "./dateien.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
const MOV = new Uint8Array([0, 0, 0, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const GIF = new TextEncoder().encode("GIF89a....");

const HOST = "https://files.oaiusercontent.com";

/** Ein Eintrag in der Form aus OpenAIs Doku. */
function ref(name: string, mime: string, pfad = name) {
  return { name, id: `file-${name}`, mime_type: mime, download_link: `${HOST}/${pfad}?sig=x` };
}

type Antwort = () => Response | Promise<Response>;

/** Beantwortet Downloads je Pfad, zeichnet Downloads und Uploads auf. */
function baueDeps(downloads: Record<string, Antwort>, over: Partial<DateiDeps> = {}) {
  const geladen: string[] = [];
  const hochgeladen: { name: string; mime: string; groesse: number }[] = [];
  const deps: DateiDeps = {
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      geladen.push(url.pathname.slice(1));
      assertEquals(init?.redirect, "manual", "Weiterleitungen dürfen nie verfolgt werden");
      const a = downloads[url.pathname.slice(1)];
      if (!a) throw new Error(`kein Download für ${url}`);
      return await a();
    }) as typeof fetch,
    hochladen: async (d) => {
      hochgeladen.push({ name: d.name, mime: d.mime, groesse: d.bytes.byteLength });
      return `https://uploads.linear.app/${d.name}`;
    },
    fristJeDateiMs: 12_000,
    fristGesamtMs: 25_000,
    ...over,
  };
  return { deps, geladen, hochgeladen };
}

const ok = (bytes: Uint8Array, headers: Record<string, string> = {}) => () =>
  new Response(bytes.slice(), { status: 200, headers });

/** Ein Download, der erst endet, wenn das Signal abbricht. */
function haengt(): Antwort {
  return () => new Promise<Response>(() => {});
}

Deno.test("Positivkontrolle: Bild und Video werden geladen und hochgeladen", async () => {
  const { deps, hochgeladen } = baueDeps({ "a.png": ok(PNG), "b.mp4": ok(MP4) });
  const r = await uebernehmeDateien([ref("a.png", "image/png"), ref("b.mp4", "video/mp4")], deps);
  assertEquals(r.map((x) => x.ergebnis), [
    { name: "a.png", art: "bild", assetUrl: "https://uploads.linear.app/a.png" },
    { name: "b.mp4", art: "video", assetUrl: "https://uploads.linear.app/b.mp4" },
  ]);
  assertEquals(hochgeladen, [
    { name: "a.png", mime: "image/png", groesse: PNG.byteLength },
    { name: "b.mp4", mime: "video/mp4", groesse: MP4.byteLength },
  ]);
});

Deno.test("alle sechs erlaubten Typen passen zu ihrer Signatur", async () => {
  const faelle = [
    ["a.png", "image/png", PNG],
    ["b.jpg", "image/jpeg", JPEG],
    ["c.webp", "image/webp", WEBP],
    ["d.gif", "image/gif", GIF],
    ["e.mp4", "video/mp4", MP4],
    ["f.mov", "video/quicktime", MOV],
  ] as const;
  const { deps } = baueDeps(Object.fromEntries(faelle.map(([n, , b]) => [n, ok(b)])));
  const r = await uebernehmeDateien(faelle.map(([n, m]) => ref(n, m)), deps);
  for (const x of r) assert("assetUrl" in x.ergebnis, JSON.stringify(x));
});

Deno.test("ein bloßer String wird unter seinem Wert vermerkt, ohne Download", async () => {
  const { deps, geladen } = baueDeps({});
  const r = await uebernehmeDateien(["file-abc123"], deps);
  assertEquals(r[0].ergebnis, { name: "file-abc123", grund: "keine Angaben zur Datei" });
  assertEquals(geladen, []);
});

Deno.test("ein Eintrag ohne Namen heißt „Datei n“", async () => {
  const { deps } = baueDeps({});
  const r = await uebernehmeDateien([{ mime_type: "image/png" }, 42], deps);
  assertEquals(r.map((x) => x.ergebnis.name), ["Datei 1", "Datei 2"]);
});

Deno.test("kein Link, unerlaubter Typ", async () => {
  const { deps, geladen } = baueDeps({});
  const r = await uebernehmeDateien([
    { name: "a.png", mime_type: "image/png" },
    ref("b.pdf", "application/pdf"),
  ], deps);
  assertEquals(r.map((x) => "grund" in x.ergebnis && x.ergebnis.grund), [
    "kein Download-Link",
    "Typ nicht erlaubt: application/pdf",
  ]);
  assertEquals(geladen, []);
});

Deno.test("fremder Host und http werden nicht geladen, der Host wird genannt", async () => {
  let aufgerufen = false;
  const { deps } = baueDeps({}, {
    fetch: (() => {
      aufgerufen = true;
      throw new Error("darf nicht");
    }) as typeof fetch,
  });
  const r = await uebernehmeDateien([
    { ...ref("a.png", "image/png"), download_link: "https://169.254.169.254/latest" },
    { ...ref("b.png", "image/png"), download_link: "http://files.oaiusercontent.com/b" },
    { ...ref("c.png", "image/png"), download_link: "kein url" },
  ], deps);
  assertEquals(r.map((x) => "grund" in x.ergebnis && x.ergebnis.grund), [
    "Adresse nicht erlaubt: 169.254.169.254",
    "Adresse nicht erlaubt: files.oaiusercontent.com",
    "Adresse nicht lesbar",
  ]);
  assert(!aufgerufen);
});

Deno.test("einer Weiterleitung wird nicht gefolgt, der Zielhost wird vermerkt", async () => {
  const { deps, hochgeladen } = baueDeps({
    "a.png": () =>
      new Response(null, { status: 302, headers: { location: "https://blob.example.net/x" } }),
  });
  const r = await uebernehmeDateien([ref("a.png", "image/png")], deps);
  assertEquals(r[0].ergebnis, { name: "a.png", grund: "weitergeleitet nach blob.example.net" });
  assertEquals(r[0].protokoll.host, "files.oaiusercontent.com");
  assertEquals(hochgeladen, []);
});

Deno.test("abgelaufener Link: „nicht mehr abrufbar“, andere Fehler mit Status", async () => {
  const { deps } = baueDeps({
    "a.png": () => new Response("x", { status: 403 }),
    "b.png": () => new Response("x", { status: 500 }),
  });
  const r = await uebernehmeDateien([ref("a.png", "image/png"), ref("b.png", "image/png")], deps);
  assertEquals(r.map((x) => "grund" in x.ergebnis && x.ergebnis.grund), [
    "nicht mehr abrufbar",
    "Download fehlgeschlagen (HTTP 500)",
  ]);
});

Deno.test("zu groß laut Content-Length: kein Byte wird gelesen", async () => {
  let gelesen = 0;
  const strom = new ReadableStream<Uint8Array>({
    pull(c) {
      gelesen += 1;
      c.enqueue(new Uint8Array(1024));
    },
  });
  const { deps, hochgeladen } = baueDeps({
    "a.mp4": () => new Response(strom, { headers: { "content-length": String(26 * 1024 * 1024) } }),
  });
  const r = await uebernehmeDateien([ref("a.mp4", "video/mp4")], deps);
  assertEquals(r[0].ergebnis, { name: "a.mp4", grund: "zu groß (mehr als 25 MB)" });
  // Ein Stream zieht beim Anlegen einmal vor; mehr als das darf nicht passieren.
  assert(gelesen <= 1, `gelesen: ${gelesen}`);
  assertEquals(hochgeladen, []);
});

Deno.test("zu groß ohne Content-Length: Abbruch beim Überschreiten, nicht am Ende", async () => {
  let gelesen = 0;
  const MB = 1024 * 1024;
  const strom = new ReadableStream<Uint8Array>({
    pull(c) {
      gelesen += MB;
      if (gelesen > 100 * MB) return c.close(); // Sicherung, falls nie abgebrochen wird
      c.enqueue(new Uint8Array(MB));
    },
  });
  const { deps } = baueDeps({ "a.mp4": () => new Response(strom) });
  const r = await uebernehmeDateien([ref("a.mp4", "video/mp4")], deps);
  assertEquals(r[0].ergebnis, { name: "a.mp4", grund: "zu groß (mehr als 25 MB)" });
  assert(gelesen <= 28 * MB, `gelesen: ${gelesen / MB} MB`);
});

Deno.test("genau 25 MB gehen durch", async () => {
  const bytes = new Uint8Array(25 * 1024 * 1024);
  bytes.set(PNG);
  const { deps, hochgeladen } = baueDeps({ "a.png": ok(bytes) });
  const r = await uebernehmeDateien([ref("a.png", "image/png")], deps);
  assert("assetUrl" in r[0].ergebnis);
  assertEquals(hochgeladen[0].groesse, 25 * 1024 * 1024);
});

Deno.test("erklärter Typ passt nicht zum Inhalt", async () => {
  const { deps, hochgeladen } = baueDeps({ "a.png": ok(JPEG), "b.mp4": ok(PNG) });
  const r = await uebernehmeDateien([ref("a.png", "image/png"), ref("b.mp4", "video/mp4")], deps);
  for (const x of r) assertEquals("grund" in x.ergebnis && x.ergebnis.grund, "Inhalt passt nicht zum Typ");
  assertEquals(hochgeladen, []);
});

Deno.test("Hochladen scheitert: vermerkt, die nächste Datei läuft weiter", async () => {
  let n = 0;
  const { deps } = baueDeps({ "a.png": ok(PNG), "b.png": ok(PNG) }, {
    hochladen: async (d) => {
      if (n++ === 0) throw new Error("403");
      return `https://uploads.linear.app/${d.name}`;
    },
  });
  const r = await uebernehmeDateien([ref("a.png", "image/png"), ref("b.png", "image/png")], deps);
  assertEquals(r[0].ergebnis, { name: "a.png", grund: "Hochladen fehlgeschlagen" });
  assert("assetUrl" in r[1].ergebnis);
});

Deno.test("Frist je Datei: eine hängende erste Datei kostet die zweite nichts", async () => {
  const { deps } = baueDeps({ "a.png": haengt(), "b.png": ok(PNG) }, {
    fristJeDateiMs: 30,
    fristGesamtMs: 5_000,
  });
  const r = await uebernehmeDateien([ref("a.png", "image/png"), ref("b.png", "image/png")], deps);
  assertEquals(r[0].ergebnis, { name: "a.png", grund: "Zeit überschritten" });
  assert("assetUrl" in r[1].ergebnis);
});

Deno.test("Gesamtfrist: Nachzügler werden vermerkt, ohne geladen zu werden", async () => {
  const { deps, geladen } = baueDeps({ "a.png": haengt(), "b.png": ok(PNG) }, {
    fristJeDateiMs: 5_000,
    fristGesamtMs: 30,
  });
  const r = await uebernehmeDateien([ref("a.png", "image/png"), ref("b.png", "image/png")], deps);
  assertEquals(r.map((x) => "grund" in x.ergebnis && x.ergebnis.grund), [
    "Zeit überschritten",
    "Zeit überschritten",
  ]);
  assertEquals(geladen, ["a.png"]);
});

Deno.test("ein hängender Upload fällt unter dieselbe Frist", async () => {
  const { deps } = baueDeps({ "a.png": ok(PNG) }, {
    fristJeDateiMs: 30,
    hochladen: (_d, signal) =>
      new Promise((_, nein) => signal.addEventListener("abort", () => nein(signal.reason))),
  });
  const r = await uebernehmeDateien([ref("a.png", "image/png")], deps);
  assertEquals(r[0].ergebnis, { name: "a.png", grund: "Zeit überschritten" });
});

Deno.test("ohne Hochladen (Probelauf): geprüft, aber nichts hochgeladen", async () => {
  const { deps } = baueDeps({ "a.png": ok(PNG) }, { hochladen: null });
  const r = await uebernehmeDateien([ref("a.png", "image/png")], deps);
  assertEquals(r[0].ergebnis, { name: "a.png", art: "bild", assetUrl: "" });
  assertEquals(r[0].protokoll, {
    typ: "image/png",
    groesse: PNG.byteLength,
    host: "files.oaiusercontent.com",
    ergebnis: "geprüft",
  });
});

Deno.test("das Protokoll trägt weder Namen noch Link", async () => {
  const { deps } = baueDeps({ "geheim-name.png": ok(PNG) });
  const r = await uebernehmeDateien([ref("geheim-name.png", "image/png")], deps);
  const text = JSON.stringify(r.map((x) => x.protokoll));
  assert(!text.includes("geheim"), text);
  assert(!text.includes("sig="), text);
});

Deno.test("Steuerzeichen und Überlänge im Namen werden vor dem Hochladen bereinigt", async () => {
  const name = "a\nb" + "x".repeat(200) + ".png";
  const { deps, hochgeladen } = baueDeps({ p: ok(PNG) });
  await uebernehmeDateien([ref(name, "image/png", "p")], deps);
  assert(!hochgeladen[0].name.includes("\n"));
  assertEquals([...hochgeladen[0].name].length, 100);
});

Deno.test("QuickTime braucht `ftyp`; ein beliebiges Atom an Byte 4 genügt nicht", async () => {
  const MDAT = new Uint8Array([0, 0, 0, 8, 0x6d, 0x64, 0x61, 0x74, 1, 2]);
  const { deps } = baueDeps({ "a.mov": ok(MDAT) });
  const r = await uebernehmeDateien([ref("a.mov", "video/quicktime")], deps);
  assertEquals(r[0].ergebnis, { name: "a.mov", grund: "Inhalt passt nicht zum Typ" });
});

Deno.test("läuft die Frist beim Lesen ab, wird der Download-Strom abgebrochen", async () => {
  let abgebrochen = false;
  const strom = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(PNG.slice());
    },
    cancel() {
      abgebrochen = true;
    },
  });
  const { deps } = baueDeps({ "a.png": () => new Response(strom) }, { fristJeDateiMs: 30 });
  const r = await uebernehmeDateien([ref("a.png", "image/png")], deps);
  assertEquals(r[0].ergebnis, { name: "a.png", grund: "Zeit überschritten" });
  assert(abgebrochen, "der Strom läuft sonst im Hintergrund weiter");
});
