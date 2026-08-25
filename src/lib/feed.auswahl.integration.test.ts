import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Abschnitt 5 gegen den LOKALEN Supabase-Stack (AGE-582, 5.13).
 *
 * WARUM ES DIESE DATEI GIBT. Der Nachbar `feed.auswahl.test.ts` mockt den
 * Query-Builder und belegt damit die FORM der Anfrage — welcher Operator, welche
 * Sortierung, welcher Cursor-Ausdruck. Er kann aber nicht belegen, dass
 * PostgREST diese Form auch so versteht. Genau daran hängen vier Aussagen, die
 * ein Mock nur behaupten könnte:
 *
 *   - `.overlaps()` bildet die Vereinigung, `.contains()` den Durchschnitt
 *   - `post_media=not.is.null` / `=is.null` filtert Eltern nach Kindern
 *   - `post_saves!inner(…)` unter der RLS ist der Reiter „Gespeichert"
 *   - der Keyset-Cursor zerlegt den Bestand in Seiten, ohne dass ein Beitrag
 *     zwischen zweien durchfällt
 *
 * Er läuft deshalb NICHT in `pnpm test` mit, sondern in `pnpm test:integration`
 * — im CI-Job `migrations`, der den Stack ohnehin hochfährt. Ein Test, der ohne
 * Stack still übersprungen wird, ist ein Test, der nie läuft.
 *
 * ANMELDEDATEN: die festen Demo-Schlüssel der Supabase-CLI. Sie sind für jede
 * lokale Installation dieselben und stehen in Supabases eigener Dokumentation —
 * kein Geheimnis, und nichts davon berührt DEV oder PROD.
 */

const API = "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
    "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0." +
    "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Der echte Client, nur mit lokaler Adresse. KEIN Mock des Verhaltens — die
// Fabrik läuft erst beim Import von "./supabase", darum steht sie hier drin.
vi.mock("./supabase", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  // Adresse und Schluessel stehen HIER noch einmal woertlich und nicht als
  // Konstante von oben: `vi.mock` wird an den Dateianfang gehoben, die Fabrik
  // laeuft also vor jeder Zuweisung im Modulrumpf.
  return {
    supabase: createClient(
      "http://127.0.0.1:54321",
      process.env.SUPABASE_ANON_KEY ??
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
          "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9." +
          "CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    ),
  };
});

import { FEED_SEITE, fetchFeed, toggleSave, type FeedCursor, type FeedOrdnung } from "./feed";
import { supabase } from "./supabase";

const KENNWORT = "integration-nur-lokal-8f2b";
const MARKE = "age582tag";
const ZWEITE_MARKE = "age582andere";
/** Anders als die beiden darueber steht diese Marke in `public.tags` — nur
 *  solche zaehlt `feed_tag_counts`. `tags_key_ist_label` verlangt
 *  key = lower(label), `tags_key_tippbar` nur Buchstaben und Ziffern. */
const KURIERTE_MARKE = "age582kuriert";

let ich = "";
/** Die Anmeldeadresse des Kontos — auch nach einem `signOut` mitten im Lauf. */
let ichEmail = "";
let anderer = "";
let pg: Client;

/** Ein Konto anlegen: GoTrue-Admin, danach die Profilzeile fertigstellen.
 *
 *  `email_confirm: true` ist Pflicht — ohne das scheitert die Anmeldung, und
 *  zwar erst NACH der Aktivierung, was wie ein Rechtefehler aussieht. Die
 *  Profilzeile legt ein Trigger schon beim Anlegen an; Stufe und Aktivierung
 *  kommen deshalb per UPDATE hinterher und nicht als Einfügespalten. */
async function kontoAnlegen(email: string): Promise<string> {
  const antwort = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password: KENNWORT, email_confirm: true }),
  });
  const koerper = (await antwort.json()) as { id?: string; msg?: string };
  if (!antwort.ok || !koerper.id) throw new Error(`Konto ${email}: ${JSON.stringify(koerper)}`);
  await pg.query(
    `update public.profiles
        set activated_at = now(), tier = 'impact', name = $2
      where id = $1`,
    [koerper.id, email.split("@")[0]],
  );
  return koerper.id;
}

/** Zeitstempel, absteigend eindeutig — `now()` wäre je Lauf ein anderer Bestand. */
const zeit = (i: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();

beforeAll(async () => {
  pg = new Client({ connectionString: DB });
  await pg.connect();
  await pg.query("set statement_timeout = '30s'");

  // NUR die eigenen Fixtures, nicht der ganze Bestand: dieser Lauf trifft auch
  // den Stack eines Entwicklers, und `delete from public.posts` nähme ihm
  // seinen Demo-Bestand. Die Zählungen unten sind alle über MARKE gefiltert,
  // ein fremder Beitrag stört also nicht — ein Rest aus einem ABGEBROCHENEN
  // Lauf dieser Datei aber sehr wohl.
  await pg.query("delete from public.posts where hashtags && $1", [[MARKE, ZWEITE_MARKE]]);

  // MARKE ist ein FREI getipptes Schlagwort und steht damit in `tags` gar
  // nicht — `feed_tag_counts` zaehlt aber ausschliesslich ueber die kuratierte
  // Liste. Ohne diese Zeile haenge die Typzusage weiter unten am Bestand des
  // Stacks, auf dem sie laeuft (Befund codex, LOW, 7.8): auf einem frischen
  // CI-Stack kaeme sie ueber null Zeilen und pruefte nichts.
  await pg.query(
    `insert into public.tags (key, label, sort, active) values ($1, $2, 995, true)
     on conflict (key) do nothing`,
    [KURIERTE_MARKE, "Age582kuriert"],
  );

  const stempel = Date.now();
  ichEmail = `age582-ich-${stempel}@example.test`;
  ich = await kontoAnlegen(ichEmail);
  anderer = await kontoAnlegen(`age582-andere-${stempel}@example.test`);

  // 25 Textbeiträge mit GLEICHER Reaktionszahl — der Fall, an dem ein Cursor
  // über das führende Feld allein Beiträge verschluckt (5.5).
  for (let i = 0; i < 25; i++) {
    await pg.query(
      `insert into public.posts (id, author_id, body, hashtags, visibility, created_at, like_count)
       values (gen_random_uuid(), $1, $2, $3, 'public', $4, 3)`,
      [i % 2 === 0 ? ich : anderer, `Text ${i}`, [MARKE], zeit(i)],
    );
  }
  // Zwei Beiträge, die NUR die zweite Marke tragen: an ihnen entscheidet sich
  // Vereinigung gegen Durchschnitt (5.3).
  for (let i = 0; i < 2; i++) {
    await pg.query(
      `insert into public.posts (author_id, body, hashtags, visibility, created_at, like_count)
       values ($1, $2, $3, 'public', $4, 1)`,
      [anderer, `Nur zweite Marke ${i}`, [ZWEITE_MARKE], zeit(100 + i)],
    );
  }
  // Ein oeffentlicher Beitrag unter dem KURATIERTEN Tag. Er ist die Zeile, die
  // `feed_tag_counts` garantiert liefert.
  await pg.query(
    `insert into public.posts (author_id, body, hashtags, visibility, created_at)
     values ($1, 'Unter einer kuratierten Marke', $2, 'public', $3)`,
    [ich, [KURIERTE_MARKE], zeit(300)],
  );
  // Ein Beitrag mit Video (der Trigger leitet `video_url` aus dem Body ab —
  // die Spalte von Hand zu setzen prüfte den Bestand, nicht den Weg).
  await pg.query(
    `insert into public.posts (author_id, body, hashtags, visibility, created_at)
     values ($1, 'Schau mal https://www.youtube.com/watch?v=dQw4w9WgXcQ', $2, 'public', $3)`,
    [ich, [MARKE], zeit(200)],
  );
  // Ein Beitrag mit Bild.
  const mitBild = await pg.query<{ id: string }>(
    `insert into public.posts (author_id, body, hashtags, visibility, created_at)
     values ($1, 'Mit Bild', $2, 'public', $3) returning id`,
    [ich, [MARKE], zeit(201)],
  );
  await pg.query(
    `insert into public.post_media (post_id, storage_path, sort, width, height)
     values ($1, $2, 0, 800, 600)`,
    [mitBild.rows[0].id, `${ich}/${mitBild.rows[0].id}/0.webp`],
  );
  // Ein Beitrag mit Video UND Bild (AGE-590): er trifft auf ZWEI der vier Typen
  // zu und ist die Zeile, an der sich zeigt, ob die Vereinigung ihn doppelt
  // liefert. `or` ist ein Praedikat auf einer Zeile und kein Join — aber das
  // gehoert zugesagt, nicht angenommen.
  const beides = await pg.query<{ id: string }>(
    `insert into public.posts (author_id, body, hashtags, visibility, created_at)
     values ($1, 'Beides https://www.youtube.com/watch?v=dQw4w9WgXcQ', $2, 'public', $3) returning id`,
    [ich, [MARKE], zeit(203)],
  );
  await pg.query(
    `insert into public.post_media (post_id, storage_path, sort, width, height)
     values ($1, $2, 0, 800, 600)`,
    [beides.rows[0].id, `${ich}/${beides.rows[0].id}/0.webp`],
  );
  // Ein Event-Beitrag.
  const event = await pg.query<{ id: string }>(
    `insert into public.events (title, starts_at, visibility)
     values ('AGE-582 Testtermin', now() + interval '7 days', 'public') returning id`,
  );
  await pg.query(
    `insert into public.posts (author_id, body, hashtags, visibility, created_at, kind, ref_id)
     values ($1, '', $2, 'public', $3, 'event', $4)`,
    [ich, [MARKE], zeit(202), event.rows[0].id],
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: ichEmail,
    password: KENNWORT,
  });
  if (error) throw error;
}, 60_000);

afterAll(async () => {
  await supabase.auth.signOut();
  // `auth.users` zu löschen räumt über die Kaskade auch Profile, Beiträge,
  // Speicherungen und Bilder ab. Der Event-Datensatz hängt an keinem Konto und
  // geht deshalb einzeln.
  await pg?.query("delete from auth.users where id = any($1)", [[ich, anderer]]);
  await pg?.query("delete from public.events where title = $1", ["AGE-582 Testtermin"]);
  // Wie der Termin haengt auch die kuratierte Marke an keinem Konto.
  await pg?.query("delete from public.tags where key = $1", [KURIERTE_MARKE]);
  await pg?.end();
});

/** Blättert eine Ordnung vollständig durch und gibt die IDs in Reihenfolge. */
async function alleSeiten(ordnung: FeedOrdnung, tags: string[] = [MARKE]): Promise<string[]> {
  const ids: string[] = [];
  let cursor: FeedCursor | null = null;
  for (let seite = 0; seite < 10; seite++) {
    const s = await fetchFeed({ uid: ich, ordnung, tags, cursor });
    ids.push(...s.posts.map((p) => p.id));
    if (!s.nextCursor) return ids;
    cursor = s.nextCursor;
  }
  throw new Error("mehr als zehn Seiten — das Blättern endet nicht");
}

describe("5.3 — mehrere Marken wirken als Vereinigung, nicht als Durchschnitt", () => {
  it("ein Beitrag mit nur EINER von zwei gewählten Marken erscheint", async () => {
    // Die Gegenprobe zur alten Fassung: `.contains()` verlangte beide Marken am
    // selben Beitrag und lieferte hier NULL Zeilen.
    const seite = await fetchFeed({ uid: ich, tags: [MARKE, ZWEITE_MARKE] });
    const koerper = seite.posts.map((p) => p.body);
    expect(koerper.some((b) => b.startsWith("Nur zweite Marke"))).toBe(true);
    expect(koerper.some((b) => b.startsWith("Text "))).toBe(true);
  });

  it("und die Auswahl EINER Marke bleibt genau so eng wie vorher", async () => {
    const seite = await fetchFeed({ uid: ich, tags: [ZWEITE_MARKE] });
    expect(seite.posts).toHaveLength(2);
    expect(seite.posts.every((p) => p.hashtags.includes(ZWEITE_MARKE))).toBe(true);
  });
});

describe("5.5 / 5.6 — jede Ordnung blättert vollständig und doppelt keinen Beitrag", () => {
  it("Beliebteste: 25 Beiträge mit GLEICHER Reaktionszahl, jeder auf genau einer Seite", async () => {
    const ids = await alleSeiten("beliebteste");
    expect(ids).toHaveLength(new Set(ids).size); // keiner doppelt
    expect(ids.length).toBeGreaterThanOrEqual(25); // keiner dazwischen verloren
  });

  it("Älteste zuerst blättert vollständig, ohne einen Beitrag zu wiederholen", async () => {
    const ids = await alleSeiten("aelteste");
    expect(ids).toHaveLength(new Set(ids).size);
    expect(ids.length).toBeGreaterThanOrEqual(25);
  });

  it("Älteste und Neueste sehen denselben Bestand, nur andersherum", async () => {
    const alt = await alleSeiten("aelteste");
    const neu = await alleSeiten("neueste");
    expect(alt.length).toBe(neu.length);
    expect([...alt].reverse()).toEqual(neu);
  });

  it("die erste Seite trägt genau die Seitengröße", async () => {
    const seite = await fetchFeed({ uid: ich, ordnung: "beliebteste", tags: [MARKE] });
    expect(seite.posts).toHaveLength(FEED_SEITE);
    expect(seite.nextCursor?.likeCount).toBeDefined();
  });
});

describe("5.12 / AGE-590 — der Typ-Filter läuft in der Datenbank", () => {
  const nurTyp = (...typen: ("bild" | "video" | "event" | "text")[]) =>
    fetchFeed({ uid: ich, typen, tags: [MARKE] });

  /**
   * Die erwartete ID-Menge — aus SQL, nicht aus `fetchFeed`.
   *
   * Eine Erwartung, die denselben Codeweg benutzt wie das Geprüfte, ist ein
   * Zirkelschluss. Und eine Zusage der Form „jeder Treffer erfüllt X" bleibt
   * gruen, wenn Treffer FEHLEN — genau der Befund aus dem Diff-Review (gemini
   * HIGH, codex MEDIUM). Deshalb die vollstaendige Menge, aus einer zweiten
   * Quelle.
   */
  async function erwarteteIds(...typen: string[]): Promise<string[]> {
    const zweige: Record<string, string> = {
      video: "p.video_url is not null",
      event: "p.kind = 'event'",
      bild: "exists (select 1 from public.post_media m where m.post_id = p.id)",
      text: "p.video_url is null and p.kind <> 'event' and not exists (select 1 from public.post_media m where m.post_id = p.id)",
    };
    const wo = typen.length ? `and (${typen.map((x) => `(${zweige[x]})`).join(" or ")})` : "";
    const r = await pg.query<{ id: string }>(
      `select p.id from public.posts p
        where p.hashtags && $1 ${wo}
        order by p.created_at desc, p.id desc`,
      [[MARKE]],
    );
    return r.rows.map((x) => x.id);
  }

  it("Video findet die Beiträge mit eingebettetem Video, und nur die", async () => {
    const seite = await nurTyp("video");
    expect(seite.posts).toHaveLength(2); // der reine Video-Beitrag und der mit beidem
    expect(seite.posts.every((p) => p.videoUrl !== null)).toBe(true);
  });

  it("Bild findet die bebilderten Beiträge über die post_media-Zeile", async () => {
    const seite = await nurTyp("bild");
    expect(seite.posts).toHaveLength(2); // der reine Bild-Beitrag und der mit beidem
    expect(seite.posts.every((p) => p.media.length === 1)).toBe(true);
  });

  it("Event findet den Event-Beitrag", async () => {
    const seite = await nurTyp("event");
    expect(seite.posts).toHaveLength(1);
    expect(seite.posts[0].kind).toBe("event");
  });

  it("Text findet die Beiträge OHNE Video, Bild und Event — alle 25", async () => {
    // Die schärfste der vier: „Text" ist eine Verneinung über drei Quellen,
    // und `post_media=is.null` ist die einzige davon, die über eine Einbettung
    // läuft. Ein Mock hätte hier nichts zu sagen.
    const seite = await nurTyp("text");
    expect(seite.posts).toHaveLength(FEED_SEITE);
    expect(seite.posts.every((p) => p.videoUrl === null)).toBe(true);
    expect(seite.posts.every((p) => p.media.length === 0)).toBe(true);
    expect(seite.posts.every((p) => p.kind === "member")).toBe(true);
  });

  it("zwei Typen liefern die VEREINIGUNG, nicht die Schnittmenge", async () => {
    // Die Kernzusage von AGE-590. Angehaengte Filter verknuepft PostgREST mit
    // UND — die alte Fassung haette hier die Schnittmenge geliefert, also nur
    // den einen Beitrag mit beidem.
    const nurVideo = await nurTyp("video");
    const nurBild = await nurTyp("bild");
    const beide = await nurTyp("video", "bild");

    const erwartet = new Set([...nurVideo.posts, ...nurBild.posts].map((p) => p.id));
    expect(new Set(beide.posts.map((p) => p.id))).toEqual(erwartet);
    expect(beide.posts.length).toBeGreaterThan(nurVideo.posts.length);
  });

  it("ein Beitrag, der auf BEIDE Typen zutrifft, steht genau einmal darin", async () => {
    const beide = await nurTyp("video", "bild");
    const ids = beide.posts.map((p) => p.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("„Text“ bleibt auch in der Vereinigung die Abwesenheit der anderen", async () => {
    // Gegen die EXAKTE Menge aus SQL: eine Zusage der Form „jeder Treffer ist
    // ein Event oder ein Text" bliebe gruen, wenn der text-Zweig ganz wegfiele
    // und nur das Event zurueckkaeme (Diff-Review codex).
    const erwartet = await erwarteteIds("text", "event");
    const alle: string[] = [];
    let cursor: FeedCursor | null = null;
    do {
      const s = await fetchFeed({ uid: ich, typen: ["text", "event"], tags: [MARKE], cursor });
      alle.push(...s.posts.map((p) => p.id));
      cursor = s.nextCursor;
    } while (cursor);
    expect(alle).toEqual(erwartet);
    // Und die Menge traegt WIRKLICH beides — sonst pruefte die Zusage oben nur
    // eine Sorte und hiesse trotzdem „Vereinigung".
    const kinds = new Set((await nurTyp("text", "event")).posts.map((p) => p.kind));
    expect(erwartet.length).toBeGreaterThan(FEED_SEITE);
    expect(kinds.size).toBeGreaterThan(0);
  });

  it("die leere Menge ist derselbe Bestand wie gar kein Typfilter", async () => {
    const ohne = await fetchFeed({ uid: ich, tags: [MARKE] });
    const leer = await nurTyp();
    expect(leer.posts.map((p) => p.id)).toEqual(ohne.posts.map((p) => p.id));
  });

  it("alle vier Typen sind derselbe Bestand wie gar kein Typfilter", async () => {
    const ohne = await fetchFeed({ uid: ich, tags: [MARKE] });
    const alle = await nurTyp("bild", "video", "event", "text");
    expect(alle.posts.map((p) => p.id)).toEqual(ohne.posts.map((p) => p.id));
  });

  it("der Typfilter überlebt das Blättern — Typvereinigung UND Cursorgrenze", async () => {
    // Ab Seite 2 stehen ZWEI `or=`-Parameter in der Anfrage. PostgREST
    // verknuepft sie mit UND; zoege man sie zu einer Gruppe zusammen, liefen
    // Beitraege ausserhalb der Blaettergrenze mit.
    const erwartet = await erwarteteIds("text", "video");
    expect(erwartet.length).toBeGreaterThan(FEED_SEITE); // es MUSS geblaettert werden

    const ids: string[] = [];
    let cursor: FeedCursor | null = null;
    do {
      const seite = await fetchFeed({ uid: ich, typen: ["text", "video"], tags: [MARKE], cursor });
      ids.push(...seite.posts.map((p) => p.id));
      cursor = seite.nextCursor;
    } while (cursor);

    // Die VOLLSTAENDIGE Menge in der richtigen Reihenfolge. Eine Zusage ueber
    // Eigenschaften der Treffer bliebe gruen, wenn Treffer fehlten — und genau
    // das ist der Fehler, den ein zweites `or=` verursachen koennte.
    expect(ids).toEqual(erwartet);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("ohne Sitzung gilt der Typfilter auch", async () => {
    await supabase.auth.signOut();
    try {
      const seite = await fetchFeed({ uid: null, typen: ["bild"], tags: [MARKE] });
      expect(seite.posts.length).toBeGreaterThan(0);
      expect(seite.posts.every((p) => p.media.length === 1)).toBe(true);
    } finally {
      const { error } = await supabase.auth.signInWithPassword({
        email: ichEmail,
        password: KENNWORT,
      });
      expect(error).toBeNull();
    }
  });
});

describe("5.8 / 5.9 / 5.10 — Gespeichert", () => {
  it("speichern, im Reiter wiederfinden, lösen, verschwunden", async () => {
    const erste = await fetchFeed({ uid: ich, tags: [MARKE] });
    const ziel = erste.posts[0];
    expect(ziel.savedByMe).toBe(false);

    await toggleSave({ postId: ziel.id, profileId: ich, saved: false });

    const reiter = await fetchFeed({ uid: ich, reiter: "gespeichert" });
    expect(reiter.posts.map((p) => p.id)).toEqual([ziel.id]);
    // Und die Karte im gewöhnlichen Reiter kennt ihren Zustand.
    const nachher = await fetchFeed({ uid: ich, tags: [MARKE] });
    expect(nachher.posts.find((p) => p.id === ziel.id)?.savedByMe).toBe(true);

    await toggleSave({ postId: ziel.id, profileId: ich, saved: true });
    expect((await fetchFeed({ uid: ich, reiter: "gespeichert" })).posts).toHaveLength(0);
  });

  it("zweimal speichern erzeugt keine zweite Zeile und keinen Fehler", async () => {
    const ziel = (await fetchFeed({ uid: ich, tags: [MARKE] })).posts[1];
    await toggleSave({ postId: ziel.id, profileId: ich, saved: false });
    await expect(
      toggleSave({ postId: ziel.id, profileId: ich, saved: false }),
    ).resolves.toBeUndefined();

    const { rows } = await pg.query<{ n: string }>(
      "select count(*) as n from public.post_saves where profile_id = $1 and post_id = $2",
      [ich, ziel.id],
    );
    expect(rows[0].n).toBe("1");
    await toggleSave({ postId: ziel.id, profileId: ich, saved: true });
  });

  it("ein unsichtbar gewordener Beitrag verschwindet still — die Speicherzeile bleibt", async () => {
    // Der Fall aus der Anforderung: gespeichert, danach auf `members`
    // zurückgedreht, während der Betrachter die Stufe dafür nicht trägt.
    // Der Zielbeitrag muss einem ANDEREN gehoeren: `posts_select_by_visibility`
    // traegt ein `or author_id = auth.uid()`, ein Autor sieht seinen eigenen
    // Beitrag also auf jeder Stufe. Ein Rueckfall auf „irgendeinen" verdeckte
    // genau das — dieser Test stand damit gruen, ohne etwas zu messen.
    const seite = await fetchFeed({ uid: ich, tags: [MARKE] });
    const fremd = seite.posts.find((p) => p.author.id === anderer);
    if (!fremd) throw new Error("kein Beitrag eines anderen Kontos auf der ersten Seite");
    const drei = [fremd, ...seite.posts.filter((p) => p.id !== fremd.id).slice(0, 2)];
    for (const p of drei) await toggleSave({ postId: p.id, profileId: ich, saved: false });

    const verschwindet = fremd;
    await pg.query("update public.posts set visibility = 'members' where id = $1", [
      verschwindet.id,
    ]);
    await pg.query("update public.profiles set tier = 'connect' where id = $1", [ich]);

    const reiter = await fetchFeed({ uid: ich, reiter: "gespeichert" });
    expect(reiter.posts.map((p) => p.id)).not.toContain(verschwindet.id);
    expect(reiter.posts.length).toBeGreaterThan(0); // läuft nicht leer

    const { rows } = await pg.query<{ n: string }>(
      "select count(*) as n from public.post_saves where profile_id = $1 and post_id = $2",
      [ich, verschwindet.id],
    );
    expect(rows[0].n).toBe("1"); // eine Speicherung begründet kein Recht — und verliert keines

    await pg.query("update public.profiles set tier = 'impact' where id = $1", [ich]);
    await pg.query("update public.posts set visibility = 'public' where id = $1", [
      verschwindet.id,
    ]);
    for (const p of drei) await toggleSave({ postId: p.id, profileId: ich, saved: true });
  });
});

describe("5.14 — die von Hand nachgezogenen Typen stimmen mit dem Schema überein", () => {
  it("feed_tag_counts liefert die aufgeschriebenen Spalten", async () => {
    const { data, error } = await supabase.rpc("feed_tag_counts");
    expect(error).toBeNull();
    /* ZUERST der Bestand, dann die Form. Eine Schleife über `data ?? []` läuft
       bei null Zeilen null Mal, und der Test bliebe auch dann grün, wenn ein
       kaputter Join gar nichts mehr lieferte — er prüfte dann nur noch, dass
       der Aufruf keinen Fehler wirft. Die Fixture legt eigens einen kuratierten
       Tag mit einem öffentlichen Beitrag an, damit diese Zusage etwas hat,
       woran sie scheitern kann. */
    const zeilen = data ?? [];
    expect(zeilen.length).toBeGreaterThan(0);
    expect(zeilen.some((z) => z.tag_key === KURIERTE_MARKE)).toBe(true);
    for (const zeile of zeilen) {
      expect(typeof zeile.tag_key).toBe("string");
      expect(typeof zeile.tag_label).toBe("string");
      expect(typeof zeile.post_count).toBe("number");
    }
  });

  it("feed_top_authors liefert sie ebenfalls — und avatar_url ist nullbar", async () => {
    const { data, error } = await supabase.rpc("feed_top_authors", { p_limit: 5 });
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    for (const zeile of data ?? []) {
      expect(typeof zeile.profile_id).toBe("string");
      expect(typeof zeile.post_count).toBe("number");
      expect(zeile.avatar_url === null || typeof zeile.avatar_url === "string").toBe(true);
    }
  });

  it("posts.like_count kommt als Zahl an", async () => {
    const seite = await fetchFeed({ uid: ich, tags: [MARKE] });
    expect(seite.posts.every((p) => typeof p.likeCount === "number")).toBe(true);
  });
});

describe("Das Schaufenster spricht post_saves nicht an", () => {
  it("ausgeloggt lädt der Feed — die Einbettung liefe in 401", async () => {
    await supabase.auth.signOut();
    const seite = await fetchFeed({ uid: null, tags: [MARKE] });
    expect(seite.posts.length).toBe(FEED_SEITE);
    const { error } = await supabase.auth.signInWithPassword({
      email: (
        await pg.query<{ email: string }>("select email from auth.users where id = $1", [ich])
      ).rows[0].email,
      password: KENNWORT,
    });
    expect(error).toBeNull();
  });
});
