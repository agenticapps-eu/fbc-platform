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

import { assertEquals } from "jsr:@std/assert@1";
import { type Buendel, type Deps, ermittleAntwort } from "./antwort.ts";

const BUENDEL: Buendel = {
  version: "0.0.0+abcdef123456",
  url: "https://p.supabase.co/storage/v1/object/public/ota-buendel/x.bin",
  checksum: "a".repeat(512),
  session_key: `${"A".repeat(22)}==:${"A".repeat(342)}==`,
};

/** Deps mit mitgeschriebenen Aufrufen; die Antwort der Abfrage ist überschreibbar. */
function baueDeps(antwort: { data: Buendel[] | null; error: { message: string } | null }) {
  const gefragt: string[] = [];
  const protokoll: string[] = [];
  const deps: Deps = {
    neuestesBuendel: (schale) => {
      gefragt.push(schale);
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
  assertEquals(ergebnis.body.sessionKey, undefined);
  // Und die Vertragsnummer der Schale ist auch wirklich die Frage, die gestellt
  // wurde. Ohne diese Zeile waere die Zusage auch gruen, wenn der Endpunkt eine
  // feste Zahl weiterreichte.
  assertEquals(gefragt, ["1.0.0"]);
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

Deno.test("das Feld heisst sessionKey, die Spalte session_key", async () => {
  // Die einzige Stelle, an der die Eins-zu-eins-Abbildung bricht. Falsch
  // geschrieben gilt die Verschluesselung als nicht gesetzt
  // (`CryptoCipher.java:141`): das Geraet entpackt Chiffrat und scheitert ohne
  // Hinweis auf die Ursache.
  const { deps } = baueDeps(OK);
  const ergebnis = await ermittleAntwort({ version_build: "9.0.0" }, deps);

  assertEquals(ergebnis.body.sessionKey, BUENDEL.session_key);
  assertEquals(ergebnis.body.session_key, undefined);
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
  // `checksum_required` ab (Entwurf §8). Und fehlte `sessionKey`, gaelte die
  // Verschluesselung als nicht gesetzt (`CryptoCipher.java:141`) — dann bliebe
  // das Buendel Chiffrat und das Entpacken scheiterte OHNE Hinweis. Eine
  // halbe Antwort ist also schlechter als gar keine.
  const { deps } = baueDeps(OK);
  const ergebnis = await ermittleAntwort({ version_build: "9.0.0" }, deps);

  for (const feld of ["version", "url", "checksum", "sessionKey"]) {
    const wert = ergebnis.body[feld];
    assertEquals(typeof wert, "string", feld);
    assertEquals((wert as string).length > 0, true, feld);
  }
});

Deno.test("dieselbe Fassung wird nicht erneut angeboten", async () => {
  const { deps } = baueDeps(OK);
  const ergebnis = await ermittleAntwort(
    { version_build: "9.0.0", version_name: BUENDEL.version },
    deps,
  );

  assertEquals(ergebnis.body.kind, "up_to_date");
  assertEquals(ergebnis.body.url, undefined);
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
});
