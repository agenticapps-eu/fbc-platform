// Tests für den Axiom-Proxy. Kein Netzwerk: `fetch` wird ersetzt und der
// abgeschickte Rumpf ausgewertet.
//
// Warum es diese Datei gibt: der Endpunkt ist öffentlich und unauthentifiziert,
// und sein Ergebnis ist der Audit-Trail. Die Allowlist prüft `event` — was
// danach mit `props` passiert, hat bis hierher nichts geprüft.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "./log";

interface Env {
  AXIOM_TOKEN?: string;
  AXIOM_DATASET?: string;
  AXIOM_URL?: string;
}

const ENV: Env = { AXIOM_TOKEN: "tok", AXIOM_DATASET: "fbc-platform" };

/** Ruft den Handler mit einem POST auf und gibt den an Axiom gesendeten Datensatz zurück. */
async function poste(body: unknown, env: Env = ENV) {
  const request = new Request("https://example.invalid/api/log", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const response = await onRequestPost({ request, env } as unknown as Parameters<
    typeof onRequestPost
  >[0]);
  const aufruf = vi.mocked(globalThis.fetch).mock.calls[0];
  const gesendet = aufruf
    ? (JSON.parse(String((aufruf[1] as RequestInit).body)) as Record<string, unknown>[])
    : [];
  return { response, record: gesendet[0] };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("onRequestPost", () => {
  it("sendet ein erlaubtes Event mit serverseitiger Anreicherung", async () => {
    const { response, record } = await poste({ event: "login", props: { plan: "basic" } });

    expect(response.status).toBe(204);
    expect(record.event).toBe("login");
    expect(record.source).toBe("web-client");
    expect(record.plan).toBe("basic");
  });

  it("weist ein Event ab, das nicht auf der Allowlist steht", async () => {
    const { response } = await poste({ event: "admin_password_rotated" });

    expect(response.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  // Der eigentliche Befund: die Allowlist prüft `event`, danach wurde `...props`
  // DARÜBER gespreizt. Ein unauthentifizierter Aufruf konnte sich so einen
  // beliebigen Event-Namen, `source: "server"` und einen zurückdatierten
  // Zeitstempel in das Audit-Dataset schreiben — vorbei an der Allowlist.
  it("lässt props die geprüften Felder nicht überschreiben", async () => {
    const { record } = await poste({
      event: "login",
      props: {
        event: "admin_password_rotated",
        source: "server",
        _time: "2000-01-01T00:00:00.000Z",
      },
    });

    expect(record.event).toBe("login");
    expect(record.source).toBe("web-client");
    expect(record._time).not.toBe("2000-01-01T00:00:00.000Z");
  });

  it("lässt props die serverseitige Anreicherung nicht überschreiben", async () => {
    const { record } = await poste({
      event: "login",
      props: { request: { country: "XX" } },
    });

    // Ohne cf-Felder serialisiert die Anreicherung zu `{}` — entscheidend ist,
    // dass sie das Objekt aus `props` ersetzt und nicht umgekehrt.
    expect(record.request).not.toEqual({ country: "XX" });
  });
});
