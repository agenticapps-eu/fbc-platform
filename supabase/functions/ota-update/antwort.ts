// Die Entscheidung des `updateUrl`-Endpunkts (AGE-642, Phase D3).
//
// ══ WARUM DAS EIN EIGENES MODUL IST ═════════════════════════════════════════
// Hier steht die einzige Stelle im ganzen Luftweg, an der entschieden wird, WAS
// ein Gerät bekommt. Auf dem Gerät gibt es gegen eine falsche Antwort keine
// Abwehr: der Vergleich dort ist ein Ungleichheits-Vergleich
// (`CapacitorUpdaterPlugin.java:4909`, `.swift:4360`), ein älteres oder
// unpassendes Bündel wird kommentarlos installiert. Was hier falsch ist, ist
// auf dem Gerät nicht mehr falsch, sondern nur noch kaputt.
//
// Der Rumpf daneben (`index.ts`) baut nur die echten Abhängigkeiten.
//
// ══ DIE ANTWORTFELDER SIND GEMESSEN, NICHT GERATEN ══════════════════════════
// Gelesen am 31.08. in @capgo/capacitor-updater@8.51.15:
//
// 1. **`sessionKey`, nicht `session_key`.** Die Spalte heißt `session_key`, das
//    Antwortfeld `sessionKey` (`CapacitorUpdaterPlugin.java:5035`). Das ist die
//    einzige Stelle, an der die Eins-zu-eins-Abbildung der Spaltennamen bricht,
//    und sie bricht still: ein falsch geschriebenes Feld wird als „keine
//    Verschlüsselung gesetzt" gelesen (`CryptoCipher.java:141`), das Gerät
//    versucht Chiffrat zu entpacken und scheitert ohne Hinweis auf die Ursache.
//
// 2. **Eine Antwort ohne Aktualisierung MUSS `error` oder `kind` tragen.** Das
//    Plugin verzweigt auf `jsRes.has("error") || jsRes.has("kind")`
//    (`CapgoUpdater.java:2273`). Ohne eines von beiden gilt die Antwort als
//    Bündelangebot — und dann fehlt `version`, und die Schale meldet einen
//    Fehler, wo nichts falsch ist.
//
// 3. **`kind` kennt genau drei Werte:** `up_to_date`, `blocked`, `failed`.
//    Alles andere — auch ein fehlendes `kind` — wird zu `failed` normalisiert
//    (`CapacitorUpdaterPlugin.java:4607`). „Kein Update nötig" ohne
//    `kind: "up_to_date"` steht also als Fehler im Gerätelog, dauerhaft und bei
//    jedem Start. Deshalb steht es ausdrücklich drin.
//
// 4. **Der HTTP-Status ist für die Entscheidung unerheblich** (außer 429): das
//    Plugin liest den Rumpf, sobald er `error` oder `kind` trägt. Die Statuszahl
//    steht hier trotzdem ehrlich, weil sie in Supabase-Logs die einzige Spalte
//    ist, an der ein Ausfall ohne Volltextsuche auffällt.

/** Eine Zeile aus `ota_buendel_neuestes` — die Spaltennamen der Tabelle. */
export interface Buendel {
  version: string;
  url: string;
  checksum: string;
  session_key: string;
}

export interface Ergebnis {
  body: Record<string, unknown>;
  status: number;
}

export interface Deps {
  /** `ota_buendel_neuestes` — der einzige Leseweg auf das Manifest. */
  neuestesBuendel: (
    schale: string,
  ) => Promise<{ data: Buendel[] | null; error: { message: string } | null }>;
  log: (level: "info" | "warn" | "error", event: string, fields?: Record<string, unknown>) => void;
}

/**
 * Dieselbe Form wie `ota_buendel.benoetigte_schale` und wie der Wächter in
 * `ota_buendel_neuestes`. Absichtlich doppelt: die Function ist die Grenze und
 * antwortet dem Gerät verständlich, statt eine Ausnahme aus der Datenbank
 * durchzureichen. Die Datenbank prüft trotzdem noch einmal — sie ist auch von
 * anderswo aufrufbar.
 */
const SCHALE_FORM = /^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/;

/** Antwort „nichts zu tun". Trägt `kind` UND `error` — siehe Befund 2 und 3 oben. */
function aktuell(grund: string): Ergebnis {
  return {
    body: { kind: "up_to_date", error: "no_new_version", message: grund },
    status: 200,
  };
}

export async function ermittleAntwort(rumpf: unknown, deps: Deps): Promise<Ergebnis> {
  const daten = (rumpf ?? {}) as Record<string, unknown>;

  // `version_build` ist die Vertragsnummer der nativen Schale (Entwurf §8). Es
  // ist das einzige Feld des Geräte-POSTs, das etwas entscheidet — alle anderen
  // (`device_id`, `app_id`, `custom_id`, …) werden bewusst nicht gelesen.
  const schale = typeof daten.version_build === "string" ? daten.version_build : "";
  const laeuft = typeof daten.version_name === "string" ? daten.version_name : "";

  if (!SCHALE_FORM.test(schale)) {
    // LAUT und nicht als `up_to_date`: eine missgebildete Vertragsnummer heißt,
    // dass die Schale falsch gebaut wurde. Als „alles aktuell" beantwortet,
    // stünde jedes Gerät dieser Schale still auf seinem Stand — und niemand
    // erführe es, weil genau das auch der Normalfall ist.
    deps.log("warn", "version_build_missgebildet", { schale });
    return {
      body: {
        kind: "failed",
        error: "invalid_version_build",
        message: "version_build ist keine Vertragsnummer der Form 1.0.0",
      },
      status: 400,
    };
  }

  const { data, error } = await deps.neuestesBuendel(schale);
  if (error) {
    deps.log("error", "manifest_unlesbar", { schale, meldung: error.message });
    return {
      body: { kind: "failed", error: "manifest_unavailable", message: error.message },
      status: 500,
    };
  }

  const buendel = data?.[0];
  if (!buendel) {
    deps.log("info", "kein_buendel_fuer_schale", { schale });
    return aktuell("Kein Buendel fuer diese Schale");
  }

  // Das Gerät verglüche selbst — aber es liefe dafür den Download an. Der
  // Vergleich hier spart ihn und macht aus dem Normalfall eine Zeile im Log,
  // die „alles aktuell" sagt statt „Download begonnen und verworfen".
  if (buendel.version === laeuft) {
    deps.log("info", "schon_aktuell", { schale, version: buendel.version });
    return aktuell("Bereits die neueste Fassung");
  }

  deps.log("info", "buendel_angeboten", { schale, version: buendel.version });
  return {
    body: {
      version: buendel.version,
      url: buendel.url,
      checksum: buendel.checksum,
      sessionKey: buendel.session_key,
    },
    status: 200,
  };
}
