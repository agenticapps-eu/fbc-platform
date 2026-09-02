import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const rpc = vi.fn();
const select = vi.fn();
const order = vi.fn();
const upload = vi.fn();
const remove = vi.fn();
const createSignedUrl = vi.fn();

vi.mock("./supabase", () => ({
  supabase: {
    from: (table: string) => ({
      insert: (row: unknown) => insert(table, row),
      select: (spalten: string) => {
        select(table, spalten);
        return { order: (spalte: string, opts?: unknown) => order(spalte, opts) };
      },
    }),
    rpc: (name: string, args?: unknown) => rpc(name, args),
    storage: {
      from: (bucket: string) => ({
        upload: (pfad: string, datei: unknown, opts?: unknown) =>
          upload(bucket, pfad, datei, opts),
        remove: (pfade: string[]) => remove(bucket, pfade),
        createSignedUrl: (pfad: string, sekunden: number) =>
          createSignedUrl(bucket, pfad, sekunden),
      }),
    },
  },
}));

import {
  adminFeedbackQueryKey,
  deleteFeedbackScreenshot,
  FEEDBACK_SCREENSHOT_BUCKET,
  fetchAdminFeedback,
  fetchFeedbackThemen,
  FEEDBACK_SEITENGROESSE,
  LEERER_FEEDBACK_FILTER,
  submitPlatformFeedback,
  uploadFeedbackScreenshot,
} from "./feedback";

/**
 * Eine Datei mit ECHTER Grösse. `new File([], …)` wäre 0 Byte gross, und die
 * Grössen-Zusage liefe damit gegen eine Datei, die die Grenze nie reissen kann.
 */
function datei(name: string, typ: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type: typ });
}

beforeEach(() => {
  insert.mockReset();
  insert.mockResolvedValue({ error: null });
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [], error: null });
  select.mockReset();
  order.mockReset();
  order.mockResolvedValue({ data: [], error: null });
  upload.mockReset();
  upload.mockResolvedValue({ error: null });
  remove.mockReset();
  remove.mockResolvedValue({ error: null });
  createSignedUrl.mockReset();
  createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://x/y" }, error: null });
});

describe("submitPlatformFeedback", () => {
  it("schreibt die drei Texte und die Route in die feedback-Zeile", async () => {
    await submitPlatformFeedback({
      profileId: "u1",
      rating: 4,
      likes: "Der Compass",
      misses: "Nichts",
      idea: "Mehr Events",
      route: "/meine-chancen",
    });

    expect(insert).toHaveBeenCalledWith("feedback", {
      profile_id: "u1",
      rating: 4,
      likes: "Der Compass",
      misses: "Nichts",
      idea: "Mehr Events",
      route: "/meine-chancen",
    });
  });

  it("lässt ref_type/ref_id weg — sonst zählte das Feedback auf den Potenzial-Score", async () => {
    await submitPlatformFeedback({
      profileId: "u1",
      rating: 1,
      likes: "",
      misses: "",
      idea: "",
      route: "/",
    });

    const row = insert.mock.calls[0][1] as Record<string, unknown>;
    expect(row).not.toHaveProperty("ref_type");
    expect(row).not.toHaveProperty("ref_id");
  });

  it("reicht einen Fehler der DB durch, statt ihn zu schlucken", async () => {
    insert.mockResolvedValue({ error: { message: "new row violates row-level security policy" } });

    await expect(
      submitPlatformFeedback({
        profileId: "u1",
        rating: 5,
        likes: "",
        misses: "",
        idea: "",
        route: "/",
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining("row-level security") });
  });
});

describe("fetchAdminFeedback", () => {
  it("holt die erste Seite mit p_limit/p_offset — und EINE Zeile mehr als sie zeigt", async () => {
    rpc.mockResolvedValue({ data: [{ id: "f1", author_name: "Anna", profile_id: "u1" }], error: null });

    const seite = await fetchAdminFeedback(0);

    // Die Zusatzzeile ist der Weg, „gibt es eine Folgeseite?" zu beantworten,
    // ohne eine zweite, zaehlende Abfrage an dieselben Daten zu stellen —
    // dasselbe Muster wie `fetchAdminMembers`.
    // Die Filter gehen als `null` hinueber und NICHT als `[]`. Diese Zeile ist
    // damit der Waechter ueber die Bedeutung von „kein Filter": `spalte =
    // any('{}')` ist in PostgreSQL false, ein leeres Array liesse den
    // Normalfall also eine leere Liste liefern.
    expect(rpc).toHaveBeenCalledWith("admin_list_feedback", {
      p_limit: FEEDBACK_SEITENGROESSE + 1,
      p_offset: 0,
      p_themes: null,
      p_ratings: null,
    });
    expect(seite.feedbacks).toEqual([{ id: "f1", author_name: "Anna", profile_id: "u1" }]);
    expect(seite.hatWeitere).toBe(false);
  });

  it("verschiebt den Offset mit der Seite — sonst zeigt Seite 2 den Inhalt von Seite 1", async () => {
    await fetchAdminFeedback(2);

    expect(rpc).toHaveBeenCalledWith("admin_list_feedback", {
      p_limit: FEEDBACK_SEITENGROESSE + 1,
      p_offset: 2 * FEEDBACK_SEITENGROESSE,
      p_themes: null,
      p_ratings: null,
    });
  });

  it("zeigt die Zusatzzeile NICHT an, meldet aber die Folgeseite", async () => {
    rpc.mockResolvedValue({
      data: Array.from({ length: FEEDBACK_SEITENGROESSE + 1 }, (_, i) => ({ id: `f${i}` })),
      error: null,
    });

    const seite = await fetchAdminFeedback(0);

    expect(seite.feedbacks).toHaveLength(FEEDBACK_SEITENGROESSE);
    expect(seite.hatWeitere).toBe(true);
  });

  it("gibt die profile_id heraus — die Zeile soll verknuepfbar sein, nicht nur lesbar", async () => {
    rpc.mockResolvedValue({ data: [{ id: "f1", author_name: "Anna", profile_id: "u7" }], error: null });

    const seite = await fetchAdminFeedback(0);

    expect(seite.feedbacks[0].profile_id).toBe("u7");
  });

  it("gibt eine leere Liste zurück, wenn die RPC null liefert (Nicht-Admin sieht nichts)", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    expect(await fetchAdminFeedback(0)).toEqual({ feedbacks: [], hatWeitere: false });
  });

  it("reicht einen Fehler der RPC durch, statt ihn zu einer leeren Liste zu glaetten", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(fetchAdminFeedback(0)).rejects.toMatchObject({ message: "boom" });
  });
});

describe("adminFeedbackQueryKey", () => {
  it("traegt die Seite im Schluessel — sonst zeigt Seite 2 den zwischengespeicherten Inhalt von Seite 1", () => {
    expect(adminFeedbackQueryKey(0)).not.toEqual(adminFeedbackQueryKey(1));
  });
});

describe("fetchAdminFeedback mit Filter (AGE-628)", () => {
  it("schickt die gewaehlten Marken als Arrays", async () => {
    await fetchAdminFeedback(0, { themen: ["fehler", "idee"], bewertungen: [1] });

    expect(rpc).toHaveBeenCalledWith("admin_list_feedback", {
      p_limit: FEEDBACK_SEITENGROESSE + 1,
      p_offset: 0,
      p_themes: ["fehler", "idee"],
      p_ratings: [1],
    });
  });

  it("schickt fuer eine LEERE Facette null und nicht [] — auch wenn die andere gesetzt ist", async () => {
    // Die Zusage, an der alles haengt. `spalte = any('{}')` ist in PostgreSQL
    // `false`, nicht `true`: mit `[]` lieferte eine Facette ohne Marke eine
    // leere Liste statt „keine Einschraenkung".
    await fetchAdminFeedback(0, { themen: [], bewertungen: [5] });

    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args.p_themes).toBeNull();
    expect(args.p_ratings).toEqual([5]);
  });
});

describe("adminFeedbackQueryKey mit Filter (AGE-628)", () => {
  it("unterscheidet zwei Filterzustaende auf DERSELBEN Seite", () => {
    // Ohne den Filter im Schluessel lieferte ein Filterwechsel auf derselben
    // Seite den zwischengespeicherten, ungefilterten Inhalt.
    expect(adminFeedbackQueryKey(0, { themen: ["fehler"], bewertungen: [] })).not.toEqual(
      adminFeedbackQueryKey(0, { themen: ["idee"], bewertungen: [] }),
    );
  });

  it("unterscheidet auch die zweite Facette", () => {
    // Ohne diese Zusage waere ein Schluessel gruen, der nur die Themen fuehrt.
    expect(adminFeedbackQueryKey(0, { themen: [], bewertungen: [1] })).not.toEqual(
      adminFeedbackQueryKey(0, { themen: [], bewertungen: [5] }),
    );
  });

  it("beschreibt eine AUSWAHL und keine Reihenfolge — dieselben Marken, gleicher Schluessel", () => {
    // Sonst waeren „Fehler, Idee" und „Idee, Fehler" zwei Abfragen mit
    // garantiert gleichem Ergebnis, und die zweite laedt umsonst.
    expect(adminFeedbackQueryKey(0, { themen: ["idee", "fehler"], bewertungen: [5, 1] })).toEqual(
      adminFeedbackQueryKey(0, { themen: ["fehler", "idee"], bewertungen: [1, 5] }),
    );
  });

  it("bleibt ohne Filterargument beim alten Verhalten", () => {
    expect(adminFeedbackQueryKey(0)).toEqual(adminFeedbackQueryKey(0, LEERER_FEEDBACK_FILTER));
  });
});

describe("submitPlatformFeedback mit Thema und Bild (AGE-628)", () => {
  it("nennt `theme` GAR NICHT, wenn keines gewaehlt ist", async () => {
    // Nicht `theme: null` und nicht `theme: undefined`: die Spalte ist `not
    // null` MIT Vorgabewert, und der greift nur, wenn die Spalte im INSERT
    // ueberhaupt nicht vorkommt. Genau daran haengt, dass eine aeltere
    // Oberflaeche zwischen Migration und Deploy weiter absenden kann.
    await submitPlatformFeedback({
      profileId: "u1",
      rating: 4,
      likes: "",
      misses: "",
      idea: "",
      route: "/",
    });

    const row = insert.mock.calls[0][1] as Record<string, unknown>;
    expect(row).not.toHaveProperty("theme");
    expect(row).not.toHaveProperty("screenshot_path");
  });

  it("schickt Thema und Pfad mit, wenn beide da sind", async () => {
    await submitPlatformFeedback({
      profileId: "u1",
      rating: 4,
      likes: "",
      misses: "",
      idea: "",
      route: "/",
      theme: "fehler",
      screenshotPath: "u1/1234.png",
    });

    const row = insert.mock.calls[0][1] as Record<string, unknown>;
    expect(row.theme).toBe("fehler");
    expect(row.screenshot_path).toBe("u1/1234.png");
  });
});

describe("uploadFeedbackScreenshot (AGE-628)", () => {
  it("laedt mit `upsert: false` — mit true weist die Policy des privaten Buckets ab", async () => {
    upload.mockResolvedValue({ error: null });

    const pfad = await uploadFeedbackScreenshot("u1", datei("bild.png", "image/png", 100));

    expect(upload).toHaveBeenCalledWith(
      FEEDBACK_SCREENSHOT_BUCKET,
      expect.stringMatching(/^u1\/\d+\.png$/),
      expect.anything(),
      { contentType: "image/png", upsert: false },
    );
    expect(pfad).toMatch(/^u1\/\d+\.png$/);
  });

  it("legt den Pfad ins EIGENE Praefix — daran haengen die Bucket-Policy und der CHECK", async () => {
    upload.mockResolvedValue({ error: null });

    const pfad = await uploadFeedbackScreenshot("u7", datei("bild.webp", "image/webp", 100));

    expect(pfad.split("/")[0]).toBe("u7");
  });

  it("weist ein nicht unterstuetztes Format ab, bevor es hochlaedt", async () => {
    await expect(
      uploadFeedbackScreenshot("u1", datei("bild.gif", "image/gif", 100)),
    ).rejects.toThrow(/Bildformat/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("weist ein zu grosses Bild ab, bevor es hochlaedt", async () => {
    await expect(
      uploadFeedbackScreenshot("u1", datei("gross.png", "image/png", 6 * 1024 * 1024)),
    ).rejects.toThrow(/5 MB/);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("deleteFeedbackScreenshot (AGE-628)", () => {
  it("ruft ERST die RPC und DANN die Storage-API — mit dem Pfad, den die RPC nennt", async () => {
    rpc.mockResolvedValue({ data: "u1/1234.png", error: null });
    remove.mockResolvedValue({ error: null });

    await deleteFeedbackScreenshot("f1");

    // Die RPC bekommt die FEEDBACK-KENNUNG und keinen Pfad — ein Pfad vom
    // Aufrufer waere ein confused deputy ueber den ganzen Bucket.
    expect(rpc).toHaveBeenCalledWith("admin_feedback_bild_loeschen", { p_feedback_id: "f1" });
    expect(remove).toHaveBeenCalledWith(FEEDBACK_SCREENSHOT_BUCKET, ["u1/1234.png"]);
  });

  it("laesst die Storage-API in Ruhe, wenn die Zeile kein Bild trug", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await deleteFeedbackScreenshot("f1");

    expect(remove).not.toHaveBeenCalled();
  });

  it("fasst das Objekt NICHT an, wenn die RPC abweist", async () => {
    // Sonst entfernte ein Nicht-Admin das Bild, waehrend der Verweis stehen
    // bleibt — die schlechteste der drei moeglichen Ausgaenge.
    rpc.mockResolvedValue({ data: null, error: { message: "forbidden" } });

    await expect(deleteFeedbackScreenshot("f1")).rejects.toMatchObject({ message: "forbidden" });
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("fetchFeedbackThemen (AGE-628)", () => {
  it("liest die Themen nach `sort` — die Reihenfolge steht in der Datenbank", async () => {
    order.mockResolvedValue({
      data: [
        { key: "generell", label: "Generell", sort: 1 },
        { key: "fehler", label: "Fehler / etwas geht nicht", sort: 2 },
      ],
      error: null,
    });

    const themen = await fetchFeedbackThemen();

    expect(select).toHaveBeenCalledWith("feedback_themes", "key, label, sort");
    expect(order).toHaveBeenCalledWith("sort", { ascending: true });
    expect(themen.map((t) => t.key)).toEqual(["generell", "fehler"]);
  });

  it("reicht einen Fehler durch, statt eine leere Themenliste zu liefern", async () => {
    // Eine leere Liste saehe im Formular aus wie „es gibt keine Themen" und
    // liesse den Nutzer ohne Auswahl zurueck.
    order.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(fetchFeedbackThemen()).rejects.toMatchObject({ message: "boom" });
  });
});
