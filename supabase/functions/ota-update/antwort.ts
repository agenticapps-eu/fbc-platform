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
// Gelesen am 31.08. in @capgo/capacitor-updater@8.51.15 — damals NUR in der
// Android-Quelle, und genau daran scheiterte Befund 1. Am 02.09. gegen die
// iOS-Quelle nachgeprüft: Befund 1 war falsch (unten korrigiert), Befund 2 und 3
// halten (`CapacitorUpdaterPlugin.swift:4107` führt dieselben drei `kind`-Werte
// und normalisiert alles andere auf `failed`).
//
// Die Lehre steht über den Befunden, weil sie für jeden neuen gilt: **eine
// Aussage übers Drahtformat braucht BEIDE Schalen.** Die Schalen sind nicht
// symmetrisch, und Android ist die nachsichtigere — was dort läuft, belegt für
// iOS nichts.
//
// 1. **`session_key` — wie die Spalte.** KORRIGIERT am 02.09. nach dem ersten
//    Gerätelauf; bis dahin stand hier `sessionKey`, und genau daran scheiterte
//    die Installation. Die Eins-zu-eins-Abbildung der Spaltennamen bricht hier
//    NICHT.
//
//    Die beiden Schalen sind nicht symmetrisch, und nur eine Schreibweise
//    kommt auf beiden an:
//
//    - **iOS akzeptiert ausschließlich `session_key`.** Die Antwort geht durch
//      ein nacktes `JSONDecoder().decode(AppVersionDec.self, …)`
//      (`CapgoUpdater.swift:1141`) ohne `keyDecodingStrategy`; das Feld heißt
//      dort wörtlich `session_key` (`InternalUtils.swift:258`).
//    - **Android akzeptiert beide** — aus Versehen. Es geht über die rohe
//      Antwort und benennt `session_key` nach `sessionKey` um
//      (`CapgoUpdater.java:2350`); ein bereits camelCase geschriebenes Feld
//      landet über den `else`-Zweig unter demselben Namen.
//
//    Die alte Begründung berief sich auf `CapacitorUpdaterPlugin.java:5035`.
//    Diese Zeile liest aber die bereits umbenannte interne Map, eine Ebene
//    HINTER der Leitung — sie sagt über das Drahtformat nichts aus.
//
//    Der Fehler bricht still: ein falsch geschriebenes Feld wird als „keine
//    Verschlüsselung gesetzt" gelesen (`CryptoCipher.swift:237`,
//    `CryptoCipher.java:141`), das Gerät versucht Chiffrat zu entpacken und
//    scheitert ohne Hinweis auf die Ursache. Am Gerät gemessen (iPhone 17 Pro,
//    iOS 26.6): `Encryption not set, no public key or session, ignored`,
//    danach `Failed to unzip file  Error: cannotUnzip`.
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
  /**
   * `ota_buendel_neuestes` — der einzige Leseweg auf das Manifest.
   *
   * BEIDE Angaben gehen hinein. `laufende` ist keine Bequemlichkeit, sondern
   * die Untergrenze: ohne sie liefert die Abfrage die neueste Zeile im
   * MANIFEST, und das ist nicht dasselbe wie „neuer als das, was laeuft"
   * (Befund Fremd-Review, HIGH). Die Auswahl selbst steht in SQL, weil sie dort
   * gegen echte Zeilen geprueft werden kann.
   */
  neuestesBuendel: (
    schale: string,
    laufende: string,
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

  const { data, error } = await deps.neuestesBuendel(schale, laeuft);
  if (error) {
    // Die Meldung geht ins LOG, nicht in die Antwort (Befund Fremd-Review,
    // LOW). Der Endpunkt hat kein JWT vor sich: eine durchgereichte
    // Postgres-Meldung nennt Funktions- und Spaltennamen und bei einem
    // Rechtefehler auch Rollennamen — an jeden, der fragt. Nach aussen genau
    // ein Satz, und der sagt nichts, was nicht ohnehin bekannt ist.
    deps.log("error", "manifest_unlesbar", { schale, meldung: error.message });
    return {
      body: {
        kind: "failed",
        error: "manifest_unavailable",
        message: "Das Manifest ist derzeit nicht lesbar.",
      },
      status: 500,
    };
  }

  const buendel = data?.[0];
  if (!buendel) {
    deps.log("info", "kein_buendel_fuer_schale", { schale });
    return aktuell("Kein Buendel fuer diese Schale");
  }

  // Hier stand bis zum Fremd-Review ein `if (buendel.version === laeuft)`. Er
  // ist ERSATZLOS weg, und zwar weil er unerreichbar geworden ist: die Abfrage
  // nimmt nur noch Zeilen, die STRENG spaeter eingetragen wurden als die
  // laufende Fassung, also kann sie die laufende nicht mehr zurueckgeben. Ein
  // Zweig, der nicht mehr laufen kann, ist keine zweite Sicherung — er ist eine
  // Behauptung, die niemand mehr pruefen kann. Die Zusage dazu steht jetzt
  // dort, wo die Entscheidung faellt: `ota_buendel_test.sql` §36.

  deps.log("info", "buendel_angeboten", { schale, version: buendel.version });
  return {
    body: {
      version: buendel.version,
      url: buendel.url,
      checksum: buendel.checksum,
      session_key: buendel.session_key,
    },
    status: 200,
  };
}

/** Der schmale Ausschnitt des Supabase-Clients, den dieser Weg wirklich braucht. */
export interface RpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Die Verdrahtung zur Datenbank — als eigene Funktion, damit sie geprüft werden
 * KANN.
 *
 * Vorher stand sie als Objektliteral im Rumpf von `index.ts`, und der
 * Fremd-Review hat die Lücke benannt (HIGH, 31.08.): die Tests ersetzen
 * `neuestesBuendel` vollständig durch eine Attrappe, pgTAP ruft die SQL-Funktion
 * direkt — dazwischen prüfte nichts. Ein falsch geschriebener Funktionsname oder
 * ein fest verdrahtetes `p_schale: "9999.0.0"` wäre durch beide Suiten
 * hindurchgegangen und hätte alten Schalen Bündel geliefert, die ihre native
 * Hülle nicht trägt.
 *
 * `.rpc(...)` und NICHT `.from("ota_buendel").select(...)`: `service_role` hält
 * in `public` auf keiner Tabelle ein Recht (AGE-312), und `rolbypassrls` umgeht
 * die RLS, nicht ein fehlendes SELECT. Der direkte Weg liefe durch Typecheck und
 * Tests und scheiterte erst zur Laufzeit.
 */
export function manifestZugriff(client: RpcClient): Deps["neuestesBuendel"] {
  return async (schale, laufende) => {
    const { data, error } = await client.rpc("ota_buendel_neuestes", {
      p_schale: schale,
      p_laufende: laufende,
    });
    return { data: data as Buendel[] | null, error };
  };
}
