import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `toggleLike` schreibt `post_likes` — und darf es nur auf zwei Wegen
 * (AGE-582, Abschnitt 3).
 *
 * WARUM DIESER TEST SEIT DEM 24.08. EXISTIERT: Die Migration
 * `20260824140000_post_likes_ohne_update.sql` entzieht `authenticated` das
 * UPDATE-Recht auf `post_likes`, damit eine Reaktion nicht auf einen anderen
 * Beitrag verschoben werden kann. Damit wird `ignoreDuplicates: true` TRAGEND:
 *
 *   - mit dem Flag sendet PostgREST `Prefer: resolution=ignore-duplicates`
 *     und setzt `on conflict do nothing` ab — gemessen: HTTP 201.
 *   - OHNE das Flag sendet es `resolution=merge-duplicates`, also
 *     `on conflict do update` — gemessen: HTTP 403, `42501`,
 *     "permission denied for table post_likes".
 *
 * Beides am 24.08. gegen den lokalen Stack durch echtes PostgREST gemessen,
 * nicht aus der Dokumentation abgeleitet. Wer das Flag entfernt, bricht den
 * Like-Knopf — und zwar erst zur Laufzeit und nur für den zweiten Klick.
 * Deshalb steht die Zusage hier und nicht nur im Kopf der Migration.
 *
 * Gemockt ist ausschliesslich der Rand zur Datenbank.
 */

type Aufruf = { table: string; op: string; args: unknown[] };
let aufrufe: Aufruf[] = [];
let fehler: { message: string } | null = null;

vi.mock("./supabase", () => {
  const bauer = (table: string) => {
    const antwort = () => ({ error: fehler });
    const kette = {
      // `.eq()` ist verkettbar und schliesst am Ende mit { error } ab —
      // `await` auf dem Kettenglied liefert dieselbe Antwort.
      eq: (...args: unknown[]) => {
        aufrufe.push({ table, op: "eq", args });
        return Object.assign(Promise.resolve(antwort()), kette);
      },
    };
    return {
      delete: (...args: unknown[]) => {
        aufrufe.push({ table, op: "delete", args });
        return kette;
      },
      upsert: (...args: unknown[]) => {
        aufrufe.push({ table, op: "upsert", args });
        return Promise.resolve(antwort());
      },
      update: (...args: unknown[]) => {
        aufrufe.push({ table, op: "update", args });
        return kette;
      },
    };
  };
  return { supabase: { from: (table: string) => bauer(table) } };
});

import { toggleLike } from "./feed";

const POST = "22222222-2222-2222-2222-222222222222";
const PROFIL = "33333333-3333-3333-3333-333333333333";

beforeEach(() => {
  aufrufe = [];
  fehler = null;
});

describe("toggleLike", () => {
  it("setzt einen Like per upsert mit ignoreDuplicates — ohne das Flag antwortet PostgREST mit 403", async () => {
    await toggleLike({ postId: POST, profileId: PROFIL, liked: false });

    const upsert = aufrufe.find((a) => a.op === "upsert");
    expect(upsert?.table).toBe("post_likes");
    expect(upsert?.args[0]).toEqual({ post_id: POST, profile_id: PROFIL });
    expect(upsert?.args[1]).toEqual({
      onConflict: "post_id,profile_id",
      // Die eine Zusage, um die es hier geht. Siehe Kopf: `false` oder ein
      // fehlendes Flag ergibt `on conflict do update` und damit 42501.
      ignoreDuplicates: true,
    });
  });

  it("nimmt einen Like per delete zurück, eingegrenzt auf Beitrag UND eigenes Profil", async () => {
    await toggleLike({ postId: POST, profileId: PROFIL, liked: true });

    expect(aufrufe.filter((a) => a.op === "delete")).toHaveLength(1);
    expect(aufrufe.filter((a) => a.op === "eq").map((a) => a.args)).toEqual([
      ["post_id", POST],
      ["profile_id", PROFIL],
    ]);
  });

  it("ruft auf keinem der beiden Wege ein update — das Recht dafür ist entzogen", async () => {
    await toggleLike({ postId: POST, profileId: PROFIL, liked: false });
    await toggleLike({ postId: POST, profileId: PROFIL, liked: true });

    expect(aufrufe.filter((a) => a.op === "update")).toEqual([]);
  });

  it("wirft, wenn die Datenbank ablehnt — ein stiller Fehlschlag zeigte ein falsches Herz", async () => {
    fehler = { message: "permission denied for table post_likes" };

    await expect(
      toggleLike({ postId: POST, profileId: PROFIL, liked: false }),
    ).rejects.toMatchObject({ message: "permission denied for table post_likes" });
  });
});
