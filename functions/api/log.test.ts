// Tests für den /api/log-Endpunkt. Kein Netzwerk — es gibt seit ADR-0037 gar
// keins mehr: der Endpunkt schreibt eine strukturierte JSON-Zeile auf stdout
// statt an Axiom zu POSTen. Ausgewertet wird deshalb die console.log-Ausgabe.
//
// Warum es diese Datei gibt: der Endpunkt ist öffentlich und unauthentifiziert,
// und sein Ergebnis ist der Audit-Trail. Die Allowlist prüft `event` — was
// danach mit `props` passiert, hat bis hierher nichts geprüft.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "./log";

/** Ruft den Handler mit einem POST auf und gibt den geloggten Datensatz zurück. */
async function poste(body: unknown) {
  const request = new Request("https://example.invalid/api/log", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const response = await onRequestPost({ request, env: {} } as unknown as Parameters<
    typeof onRequestPost
  >[0]);
  const zeile = vi.mocked(console.log).mock.calls[0]?.[0];
  const record = zeile
    ? (JSON.parse(String(zeile)) as Record<string, unknown>)
    : undefined;
  return { response, record };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  // Egress-Wächter: der Endpunkt darf keinerlei Netzwerkaufruf mehr machen.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("onRequestPost", () => {
  it("loggt ein erlaubtes Event mit serverseitiger Anreicherung", async () => {
    const { response, record } = await poste({ event: "login", props: { plan: "basic" } });

    expect(response.status).toBe(204);
    expect(record?.event).toBe("login");
    expect(record?.source).toBe("web-client");
    expect(record?.plan).toBe("basic");
  });

  it("weist ein Event ab, das nicht auf der Allowlist steht", async () => {
    const { response } = await poste({ event: "admin_password_rotated" });

    expect(response.status).toBe(400);
    expect(console.log).not.toHaveBeenCalled();
  });

  // Der eigentliche Befund: die Allowlist prüft `event`, danach wurde `...props`
  // DARÜBER gespreizt. Ein unauthentifizierter Aufruf konnte sich so einen
  // beliebigen Event-Namen, `source: "server"` und einen zurückdatierten
  // Zeitstempel in den Audit-Trail schreiben — vorbei an der Allowlist.
  it("lässt props die geprüften Felder nicht überschreiben", async () => {
    const { record } = await poste({
      event: "login",
      props: {
        event: "admin_password_rotated",
        source: "server",
        _time: "2000-01-01T00:00:00.000Z",
      },
    });

    expect(record?.event).toBe("login");
    expect(record?.source).toBe("web-client");
    expect(record?._time).not.toBe("2000-01-01T00:00:00.000Z");
  });

  it("lässt props die serverseitige Anreicherung nicht überschreiben", async () => {
    const { record } = await poste({
      event: "login",
      props: { request: { country: "XX" } },
    });

    // Ohne cf-Felder serialisiert die Anreicherung zu `{}` — entscheidend ist,
    // dass sie das Objekt aus `props` ersetzt und nicht umgekehrt.
    expect(record?.request).not.toEqual({ country: "XX" });
  });

  // ADR-0037: der Endpunkt hat kein Ingest-Ziel mehr. Schlägt hier je wieder
  // ein fetch an, ist eine Netzwerk-Senke zurückgekommen — inklusive Secret,
  // das dann wieder irgendwo hinterlegt werden müsste.
  it("macht keinerlei Netzwerkaufruf", async () => {
    await poste({ event: "signup" });

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
