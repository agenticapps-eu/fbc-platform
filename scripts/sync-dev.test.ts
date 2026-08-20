/**
 * Aufgabengruppe 2 aus `openspec/changes/sync-dev-from-prod/tasks.md`.
 *
 * Der Wächter kommt vor dem Werkzeug. Ein Spiegel, dessen Zielprüfung
 * nachgereicht wird, hat ein Zeitfenster, in dem ein Tippfehler PROD leert.
 */
import { describe, expect, test } from "vitest";

import {
  pruefeLauf,
  pruefeZugang,
  refAusApiUrl,
  refAusServiceKey,
  rolleAusServiceKey,
  wertMitNamen,
  type Zugang,
} from "./sync-dev.logic";

const PROD = "viwntbodrtqxgmqyxluh";
const DEV = "foelowldexkcqzewvrcf";
const FREMD = "aaaabbbbccccddddeeee";

/** Legacy-Service-Keys sind JWTs mit `ref` in der Nutzlast — hier nachgebaut. */
function jwt(ref: string, role = "service_role"): string {
  const teil = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${teil({ alg: "HS256", typ: "JWT" })}.${teil({ iss: "supabase", ref, role })}.signatur`;
}

const zugang = (ref: string, port = 5432, cluster = "aws-0"): Zugang => ({
  dbUrl: `postgresql://postgres.${ref}:pw@${cluster}-eu-central-1.pooler.supabase.com:${port}/postgres`,
  apiUrl: `https://${ref}.supabase.co`,
  serviceKey: jwt(ref),
});

describe("Kennung je Wert — nicht am Host (2.4)", () => {
  test("liest den Ref aus der API-URL", () => {
    expect(refAusApiUrl(`https://${PROD}.supabase.co`)).toBe(PROD);
    expect(refAusApiUrl(`https://${DEV}.supabase.co/storage/v1`)).toBe(DEV);
  });

  test("liest den Ref aus der Nutzlast des Service-Keys", () => {
    expect(refAusServiceKey(jwt(PROD))).toBe(PROD);
  });

  test("liefert null, wo kein Ref steht — statt zu raten", () => {
    expect(refAusApiUrl("https://supabase.co")).toBeNull();
    expect(refAusApiUrl("kein-url")).toBeNull();
    expect(refAusServiceKey("sb_secret_ohne_ref")).toBeNull();
    expect(refAusServiceKey(jwt("zu-kurz"))).toBeNull();
  });

  test("derselbe Pooler-Host mit anderer Kennung wird unterschieden", () => {
    // Beide auf aws-0: der Host trennt die Projekte NICHT, der Benutzername schon.
    const a = pruefeZugang(zugang(PROD, 5432, "aws-0"));
    const b = pruefeZugang(zugang(DEV, 5432, "aws-0"));
    expect(a).toEqual({ kind: "ok", ref: PROD });
    expect(b).toEqual({ kind: "ok", ref: DEV });
  });
});

describe("Der Schlüssel muss auch die richtige ROLLE tragen (2.3)", () => {
  // Gefunden bei der Sichtprobe an den echten Werten: der Wächter nahm den
  // anon-Schlüssel von DEV an, weil er dieselbe Kennung trägt. Er scheiterte
  // dann erst zur Laufzeit — und `service_role` haelt hier auf keiner Tabelle
  // in `public` ein Recht, der Fehler saehe also aus wie ein RLS-Problem.
  test("liest die Rolle aus der Nutzlast", () => {
    expect(rolleAusServiceKey(jwt(DEV, "service_role"))).toBe("service_role");
    expect(rolleAusServiceKey(jwt(DEV, "anon"))).toBe("anon");
    expect(rolleAusServiceKey("sb_secret_ohne_rolle")).toBeNull();
  });

  test("ein anon-Schlüssel mit richtiger Kennung bricht trotzdem ab", () => {
    const e = pruefeZugang({ ...zugang(DEV), serviceKey: jwt(DEV, "anon") });

    expect(e.kind).toBe("abbruch");
    expect(e.kind === "abbruch" && e.grund).toContain("anon");
    expect(e.kind === "abbruch" && e.grund).toContain("service_role");
  });
});

describe("Gemischte Zugangsdaten brechen ab (2.3)", () => {
  test("DEV-Datenbank neben PROD-Service-Key", () => {
    const gemischt: Zugang = { ...zugang(DEV), serviceKey: jwt(PROD) };
    const e = pruefeZugang(gemischt);

    expect(e.kind).toBe("abbruch");
    // Der abweichende Wert MUSS benannt sein — sonst sucht ihn jemand von Hand.
    expect(e.kind === "abbruch" && e.grund).toContain("serviceKey");
    expect(e.kind === "abbruch" && e.grund).toContain(PROD);
  });

  test("DEV-Datenbank neben PROD-API-URL — der heutige Zustand des Secret-Stores", () => {
    const gemischt: Zugang = { ...zugang(DEV), apiUrl: `https://${PROD}.supabase.co` };
    const e = pruefeZugang(gemischt);

    expect(e.kind).toBe("abbruch");
    expect(e.kind === "abbruch" && e.grund).toContain("apiUrl");
  });

  test("ein Lauf mit gemischtem ZIEL kommt nicht durch — auch wenn die DB-URL für sich stimmt", () => {
    const e = pruefeLauf({
      quelle: zugang(PROD),
      ziel: { ...zugang(DEV), serviceKey: jwt(PROD) },
      prodRef: PROD,
      devRef: DEV,
    });

    expect(e.kind).toBe("abbruch");
    expect(e.kind === "abbruch" && e.grund).toContain("Ziel");
  });
});

describe("Das Ziel darf nur DEV sein (2.1)", () => {
  test("ein Ziel mit der PROD-Kennung bricht ab und nennt sie", () => {
    const e = pruefeLauf({ quelle: zugang(PROD), ziel: zugang(PROD), prodRef: PROD, devRef: DEV });

    expect(e.kind).toBe("abbruch");
    expect(e.kind === "abbruch" && e.grund).toContain(PROD);
  });

  test("ein fremdes Projekt als Ziel bricht ab", () => {
    const e = pruefeLauf({ quelle: zugang(PROD), ziel: zugang(FREMD), prodRef: PROD, devRef: DEV });

    expect(e.kind).toBe("abbruch");
  });
});

describe("Die Quelle darf nur PROD sein (2.2)", () => {
  test("DEV als Quelle bricht ab — sonst spiegelt DEV auf sich selbst", () => {
    const e = pruefeLauf({ quelle: zugang(DEV), ziel: zugang(DEV), prodRef: PROD, devRef: DEV });

    expect(e.kind).toBe("abbruch");
    expect(e.kind === "abbruch" && e.grund).toContain("Quelle");
  });

  test("ein fremdes Projekt als Quelle bricht ab", () => {
    const e = pruefeLauf({ quelle: zugang(FREMD), ziel: zugang(DEV), prodRef: PROD, devRef: DEV });

    expect(e.kind).toBe("abbruch");
    expect(e.kind === "abbruch" && e.grund).toContain("Quelle");
  });
});

describe("Unbekannt, gleich, nicht auflösbar (2.5)", () => {
  test("fehlender Wert bricht ab", () => {
    for (const feld of ["dbUrl", "apiUrl", "serviceKey"] as const) {
      const z = { ...zugang(DEV) };
      delete z[feld];
      const e = pruefeZugang(z);
      expect(e.kind, `${feld} fehlt`).toBe("abbruch");
      expect(e.kind === "abbruch" && e.grund).toContain(feld);
    }
  });

  test("nicht auflösbare Kennung bricht ab, statt als 'kein Treffer' durchzugehen", () => {
    const e = pruefeZugang({
      dbUrl: "postgresql://postgres:pw@localhost:54322/postgres",
      apiUrl: "http://127.0.0.1:54321",
      serviceKey: "sb_secret_lokal",
    });

    expect(e.kind).toBe("abbruch");
  });

  test("gleiche Kennung auf beiden Seiten bricht ab", () => {
    const e = pruefeLauf({ quelle: zugang(DEV), ziel: zugang(DEV), prodRef: DEV, devRef: DEV });

    expect(e.kind).toBe("abbruch");
    expect(e.kind === "abbruch" && e.grund).toContain("dasselbe Projekt");
  });

  test("ein leerer Sollwert bricht ab, statt gegen nichts zu prüfen", () => {
    const e = pruefeLauf({ quelle: zugang(PROD), ziel: zugang(DEV), prodRef: "", devRef: DEV });

    expect(e.kind).toBe("abbruch");
  });
});

describe("Die Richtung ist fest verdrahtet (2.6)", () => {
  test("die umgekehrte Richtung lässt sich nicht ausdrücken", () => {
    // Quelle DEV, Ziel PROD — bei richtigen Sollwerten der einzige Weg, den
    // Lauf umzudrehen. Er muss abbrechen, und zwar an BEIDEN Seiten.
    const e = pruefeLauf({ quelle: zugang(DEV), ziel: zugang(PROD), prodRef: PROD, devRef: DEV });

    expect(e.kind).toBe("abbruch");
    expect(e.kind === "abbruch" && e.grund).toContain("Quelle");
    expect(e.kind === "abbruch" && e.grund).toContain("Ziel");
  });

  test("der richtige Lauf kommt durch — sonst prüfte der Wächter nichts", () => {
    const e = pruefeLauf({ quelle: zugang(PROD), ziel: zugang(DEV), prodRef: PROD, devRef: DEV });

    expect(e).toEqual({ kind: "frei", quelleRef: PROD, zielRef: DEV });
  });
});

describe("Welcher Name gelesen wurde, muss gesagt werden (2.7)", () => {
  // `SUPABASE_SERVICE_ROLE_KEY` ist der etablierte Name — der WP-Import liest
  // ihn, die Edge Functions bekommen ihn von der Plattform. Ihn fuer den
  // Spiegel unter `…_PROD` zu verdoppeln hiesse: zwei Vollzugriffs-Schluessel,
  // von denen die Rotation nur einen erwischt. Also wird der vorhandene
  // gelesen — aber sichtbar, nicht stillschweigend.
  test("nimmt den ersten Kandidaten, der einen Wert traegt", () => {
    const env = { A: "", B: "zwei", C: "drei" };
    expect(wertMitNamen(env, ["A", "B", "C"])).toEqual({ name: "B", wert: "zwei" });
  });

  test("liefert null, wenn keiner traegt — statt einen leeren Wert durchzureichen", () => {
    expect(wertMitNamen({ A: "", B: undefined }, ["A", "B"])).toBeNull();
    expect(wertMitNamen({}, ["A"])).toBeNull();
  });

  test("der bevorzugte Name gewinnt gegen den Rueckfall", () => {
    const env = { SUPABASE_SERVICE_ROLE_KEY_PROD: "neu", SUPABASE_SERVICE_ROLE_KEY: "alt" };
    expect(wertMitNamen(env, ["SUPABASE_SERVICE_ROLE_KEY_PROD", "SUPABASE_SERVICE_ROLE_KEY"])).toEqual(
      { name: "SUPABASE_SERVICE_ROLE_KEY_PROD", wert: "neu" },
    );
  });
});
