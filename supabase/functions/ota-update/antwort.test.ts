// deno test  (aus supabase/functions/ota-update/)
//
// Die zwei RED-Zusagen aus tasks.md D3 stehen hier als erste und zweite:
// ein Bündel erreicht keine Schale mit zu niedriger Vertragsnummer, und eine
// Antwort ohne Bündel lässt die laufende Fassung in Betrieb.
//
// Die erste davon prüft die HÄLFTE, die in dieser Datei liegt: dass der
// Endpunkt die Vertragsnummer überhaupt weiterreicht und nicht selbst filtert.
// Die andere Hälfte — dass die Abfrage richtig auswählt — ist eine Aussage über
// SQL und steht in `supabase/tests/ota_buendel_test.sql` §32; ein Mock, der
// beides behauptet, prüfte nur sich selbst.

import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  behandleAnfrage,
  type Buendel,
  type Deps,
  ermittleAntwort,
  manifestZugriff,
  type RpcClient,
} from "./antwort.ts";

const BUENDEL: Buendel = {
  version: "0.0.0+abcdef123456",
  url: "https://p.supabase.co/storage/v1/object/public/ota-buendel/x.bin",
  checksum: "a".repeat(512),
  session_key: `${"A".repeat(22)}==:${"A".repeat(342)}==`,
};

/** Deps mit mitgeschriebenen Aufrufen; die Antwort der Abfrage ist überschreibbar. */
function baueDeps(antwort: { data: Buendel[] | null; error: { message: string } | null }) {
  const gefragt: Array<[string, string]> = [];
  const protokoll: string[] = [];
  const deps: Deps = {
    neuestesBuendel: (schale, laufende) => {
      gefragt.push([schale, laufende]);
      return Promise.resolve(antwort);
    },
    log: (level, event) => protokoll.push(`${level}:${event}`),
  };
  return { deps, gefragt, protokoll };
}

const OK = { data: [BUENDEL], error: null };
const LEER = { data: [], error: null };

Deno.test("RED: eine Schale mit zu niedriger Vertragsnummer bekommt kein Buendel", async () => {
  // Die Abfrage findet nichts, weil jede Zeile eine hoehere Schale verlangt.
  // Was der Endpunkt daraus macht, ist die Zusage: NICHT das juengste Buendel
  // trotzdem herausgeben, und nicht mit einem Fehler antworten.
  const { deps, gefragt } = baueDeps(LEER);
  const ergebnis = await ermittleAntwort(
    { version_build: "1.0.0", version_name: "0.0.0+alt" },
    deps,
  );

  assertEquals(ergebnis.body.kind, "up_to_date");
  assertEquals(ergebnis.body.url, undefined);
  assertEquals(ergebnis.body.session_key, undefined);
  // Und die Vertragsnummer der Schale ist auch wirklich die Frage, die gestellt
  // wurde. Ohne diese Zeile waere die Zusage auch gruen, wenn der Endpunkt eine
  // feste Zahl weiterreichte.
  assertEquals(gefragt, [["1.0.0", "0.0.0+alt"]]);
});

Deno.test("RED: ohne Buendel bleibt die installierte Fassung in Betrieb", async () => {
  // Das Gerät verzweigt auf `error` ODER `kind` (`CapgoUpdater.java:2273`).
  // Fehlten beide, hielte es die Antwort fuer ein Buendelangebot ohne `version`
  // — und meldete einen Fehler, wo nichts falsch ist.
  const { deps } = baueDeps(LEER);
  const ergebnis = await ermittleAntwort({ version_build: "1.0.0" }, deps);

  assertEquals(ergebnis.status, 200);
  assertEquals(ergebnis.body.error, "no_new_version");
  // `up_to_date` ist einer von genau drei erlaubten Werten; alles andere wird
  // zu `failed` normalisiert (`CapacitorUpdaterPlugin.java:4607`) und stuende
  // bei jedem Start als Fehler im Geraetelog.
  assertEquals(ergebnis.body.kind, "up_to_date");
});

Deno.test("Positivkontrolle: mit passendem Buendel kommt es auch heraus", async () => {
  // Ohne sie waeren die beiden Zusagen oben auch gruen, wenn der Endpunkt
  // NIEMALS ein Buendel herausgaebe.
  const { deps } = baueDeps(OK);
  const ergebnis = await ermittleAntwort(
    { version_build: "9.0.0", version_name: "0.0.0+alt" },
    deps,
  );

  assertEquals(ergebnis.status, 200);
  assertEquals(ergebnis.body.version, BUENDEL.version);
  assertEquals(ergebnis.body.kind, undefined);
});

Deno.test("das Feld heisst session_key — iOS liest NUR diese Schreibweise", async () => {
  // Am Geraet gemessen (02.09., iPhone 17 Pro, iOS 26.6): mit `sessionKey` auf
  // der Leitung meldete das Plugin `Encryption not set, no public key or
  // session, ignored` und danach `Failed to unzip file / cannotUnzip` — das
  // Buendel blieb Chiffrat.
  //
  // Die beiden Schalen sind NICHT symmetrisch:
  //
  // - **iOS akzeptiert ausschliesslich `session_key`.** Die Antwort geht durch
  //   ein nacktes `JSONDecoder().decode(AppVersionDec.self, …)`
  //   (`CapgoUpdater.swift:1141`) ohne `keyDecodingStrategy`, und das Feld
  //   heisst dort woertlich `session_key` (`InternalUtils.swift:258`). Ein
  //   `sessionKey` faellt still auf den Boden.
  // - **Android akzeptiert beide** — aus Versehen. Es laeuft ueber die rohe
  //   Antwort und benennt `session_key` nach `sessionKey` um
  //   (`CapgoUpdater.java:2350`); ein bereits camelCase geschriebenes Feld
  //   landet ueber den `else`-Zweig unter demselben Namen.
  //
  // `session_key` ist damit die einzige Schreibweise, die auf BEIDEN Schalen
  // ankommt. Bis 02.09. stand hier das Gegenteil, belegt mit
  // `CapacitorUpdaterPlugin.java:5035` — diese Zeile liest aber die bereits
  // umbenannte interne Map, nicht die Leitung.
  const { deps } = baueDeps(OK);
  const ergebnis = await ermittleAntwort({ version_build: "9.0.0" }, deps);

  assertEquals(ergebnis.body.session_key, BUENDEL.session_key);
  assertEquals(ergebnis.body.sessionKey, undefined);
  assertEquals(ergebnis.body.checksum, BUENDEL.checksum);
  assertEquals(ergebnis.body.url, BUENDEL.url);
});

Deno.test("RED: ein Angebot ist vollstaendig oder es ist keines", async () => {
  // Die Haelfte der Zusage „ein Buendel ohne passende Pruefsumme wird
  // abgewiesen", die auf UNSERER Seite liegt. Die andere Haelfte — dass das
  // Geraet ein Buendel mit falscher Pruefsumme verwirft und auf der laufenden
  // Fassung bleibt — ist Verhalten des Plugins und braucht einen Geraetebeleg;
  // ein Mock koennte sie nur behaupten.
  //
  // Was hier zaehlt: setzt `capacitor.config.ts` einen `publicKey`, MUSS die
  // Antwort eine `checksum` tragen, sonst lehnt das Geraet die Installation mit
  // `checksum_required` ab (Entwurf §8). Und fehlte `session_key`, gaelte die
  // Verschluesselung als nicht gesetzt (`CryptoCipher.java:141`) — dann bliebe
  // das Buendel Chiffrat und das Entpacken scheiterte OHNE Hinweis. Eine
  // halbe Antwort ist also schlechter als gar keine.
  const { deps } = baueDeps(OK);
  const ergebnis = await ermittleAntwort({ version_build: "9.0.0" }, deps);

  for (const feld of ["version", "url", "checksum", "session_key"]) {
    const wert = ergebnis.body[feld];
    assertEquals(typeof wert, "string", feld);
    assertEquals((wert as string).length > 0, true, feld);
  }
});

Deno.test("die laufende Fassung geht mit hinaus, nicht nur die Schale", async () => {
  // Sie ist die Untergrenze der Auswahl (Befund Fremd-Review, HIGH). Ginge sie
  // verloren, lieferte die Abfrage die neueste Zeile im MANIFEST — und das ist
  // nicht dasselbe wie „neuer als das, was laeuft". Dass die Auswahl damit
  // richtig ordnet, ist eine Aussage ueber SQL und steht in
  // `ota_buendel_test.sql` §36; hier zaehlt nur, dass der Wert ankommt.
  const { deps, gefragt } = baueDeps(OK);
  await ermittleAntwort({ version_build: "9.0.0", version_name: "0.0.0+laeuft" }, deps);
  assertEquals(gefragt, [["9.0.0", "0.0.0+laeuft"]]);

  // Auch `builtin` geht woertlich hinaus: ein Geraet auf dem Stand aus dem
  // Store meldet genau das, und die Abfrage behandelt Unbekanntes als „keine
  // Untergrenze".
  const frisch = baueDeps(OK);
  await ermittleAntwort({ version_build: "9.0.0", version_name: "builtin" }, frisch.deps);
  assertEquals(frisch.gefragt, [["9.0.0", "builtin"]]);
});

Deno.test("manifestZugriff ruft die richtige Funktion mit beiden Werten", async () => {
  // Die Naht zwischen Handler und SQL. Vorher pruefte sie nichts: die Tests
  // oben ersetzen `neuestesBuendel` ganz, pgTAP ruft die SQL-Funktion direkt.
  // Ein Tippfehler im Funktionsnamen oder ein fest verdrahtetes
  // `p_schale: "9999.0.0"` waere durch BEIDE Suiten hindurchgegangen und haette
  // alten Schalen Buendel geliefert, die ihre native Huelle nicht traegt
  // (Befund Fremd-Review, HIGH).
  const aufrufe: Array<[string, Record<string, unknown>]> = [];
  const client: RpcClient = {
    rpc: (fn, args) => {
      aufrufe.push([fn, args]);
      return Promise.resolve({ data: [BUENDEL], error: null });
    },
  };

  const ergebnis = await manifestZugriff(client)("2.0.0", "0.0.0+laeuft");

  assertEquals(aufrufe, [
    ["ota_buendel_neuestes", { p_schale: "2.0.0", p_laufende: "0.0.0+laeuft" }],
  ]);
  assertEquals(ergebnis.data, [BUENDEL]);
  assertEquals(ergebnis.error, null);
});

Deno.test("manifestZugriff reicht einen Fehler durch, statt ihn zu schlucken", async () => {
  const client: RpcClient = {
    rpc: () => Promise.resolve({ data: null, error: { message: "permission denied" } }),
  };
  const ergebnis = await manifestZugriff(client)("1.0.0", "builtin");

  assertEquals(ergebnis.data, null);
  assertEquals(ergebnis.error?.message, "permission denied");
});

Deno.test("eine missgebildete Vertragsnummer wird LAUT abgewiesen", async () => {
  // Nicht als `up_to_date`: das hiesse „alles in Ordnung" und liesse jedes
  // Geraet einer falsch gebauten Schale still stehen. Und die Abfrage wird gar
  // nicht erst gestellt.
  for (const schale of ["1.0", "", "abc", "1.0.0-rc.1", "99999.0.0"]) {
    const { deps, gefragt } = baueDeps(OK);
    const ergebnis = await ermittleAntwort({ version_build: schale }, deps);

    assertEquals(ergebnis.status, 400, schale);
    assertEquals(ergebnis.body.error, "invalid_version_build", schale);
    assertEquals(gefragt, [], schale);
  }
});

Deno.test("ein fehlender Rumpf wird wie eine fehlende Vertragsnummer behandelt", async () => {
  const { deps } = baueDeps(OK);
  assertEquals((await ermittleAntwort(null, deps)).status, 400);
  assertEquals((await ermittleAntwort({ version_build: 5 }, deps)).status, 400);
});

Deno.test("ein Fehler der Abfrage wird als failed gemeldet, nicht als aktuell", async () => {
  // Der Unterschied ist nicht kosmetisch: `up_to_date` hiesse, dass ein
  // Ausfall des Manifests von einem normalen Lauf nicht unterscheidbar waere.
  const { deps, protokoll } = baueDeps({ data: null, error: { message: "permission denied" } });
  const ergebnis = await ermittleAntwort({ version_build: "1.0.0" }, deps);

  assertEquals(ergebnis.status, 500);
  assertEquals(ergebnis.body.kind, "failed");
  assertEquals(protokoll, ["error:manifest_unlesbar"]);
  // Die Postgres-Meldung geht ins Log und NICHT in die Antwort: der Endpunkt
  // hat kein JWT vor sich, und eine durchgereichte Meldung nennt Funktions-,
  // Spalten- und bei Rechtefehlern Rollennamen (Befund Fremd-Review, LOW).
  assertEquals(ergebnis.body.message, "Das Manifest ist derzeit nicht lesbar.");
});

// ══ DER HANDLER, AUSGEFUEHRT ════════════════════════════════════════════════
//
// Nachgezogen am 02.09. Bis dahin lag der Rumpf in `index.ts`, und `index.ts`
// importiert kein Test — `deno test` typprueft nur, was ein Test anfasst. Der
// 405-Waechter, der `catch` auf `req.json()` und der `content-type` der
// Antwort waren damit ungeprueft.
//
// Der Anlass: bei `ota-stats` verbarg genau dieser blinde Fleck einen echten
// Defekt. Dort war der Status frei aenderbar, ohne dass eine Zusage rot wurde —
// und ausgerechnet er entscheidet, ob ein Geraet wiederholt oder endgueltig
// verwirft.

/** Fuehrt den Handler aus; die Abfrage antwortet mit dem uebergebenen Ergebnis. */
async function rufe(
  init: RequestInit & { body?: string },
  antwort: { data: Buendel[] | null; error: { message: string } | null } = LEER,
) {
  const { deps, protokoll } = baueDeps(antwort);
  const res = await behandleAnfrage(
    new Request("https://example.test/ota-update", { method: "POST", ...init }),
    deps,
  );
  return { res, protokoll, text: await res.text() };
}

Deno.test("Handler: alles ausser POST wird abgewiesen", async () => {
  const { res } = await rufe({ method: "GET" });
  assertEquals(res.status, 405);
});

Deno.test("Handler: ein unlesbarer Rumpf faellt auf null und wird LAUT beantwortet", async () => {
  // Nicht `up_to_date`: als „alles aktuell" beantwortet, stuende jedes Geraet
  // dieser Schale still auf seinem Stand, und niemand erfuehre es.
  const { res, text, protokoll } = await rufe({ body: "{kein json" });
  assertEquals(res.status, 400);
  assertEquals(JSON.parse(text).error, "invalid_version_build");
  assertEquals(protokoll, ["warn:version_build_missgebildet"]);
});

Deno.test("Handler: eine gueltige Anfrage traegt Status und content-type", async () => {
  const { res, text } = await rufe(
    { body: JSON.stringify({ version_build: "1.0.0", version_name: "0.0.0+alt" }) },
    OK,
  );
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("content-type"), "application/json");
  assertEquals(JSON.parse(text).session_key, BUENDEL.session_key);
});

Deno.test("Handler: ohne Buendel bleibt die laufende Fassung in Betrieb", async () => {
  const { res, text } = await rufe(
    { body: JSON.stringify({ version_build: "1.0.0", version_name: "0.0.0+alt" }) },
    LEER,
  );
  assertEquals(res.status, 200);
  assertEquals(JSON.parse(text).kind, "up_to_date");
});

Deno.test("Verdrahtung: `index.ts` entscheidet selbst nichts mehr", async () => {
  const quelle = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const kompakt = quelle.replace(/\s+/g, " ");
  assertStringIncludes(kompakt, "behandleAnfrage(req,");
  // Kein Status, kein Waechter, keine Kopfzeile ein zweites Mal — genau die
  // Doppelung, an der `ota-stats` scheiterte.
  for (const verboten of ["status: 405", "req.json()", "content-type", "ermittleAntwort("]) {
    assertEquals(kompakt.includes(verboten), false, `index.ts fuehrt \`${verboten}\` doppelt`);
  }
});
