import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Was die ANREICHERUNG liefert — nicht, was die Fläche anfragt (AGE-542).
 *
 * Bis AGE-542 trug diese Datei zwei verschiedene Dinge: den Flächen-Wächter
 * („Die Regel, nicht der Einzelfall") und die Verhaltenszusagen darunter. Der
 * Wächter ist ausgezogen nach `anon-flaeche.test.tsx` und dort in stärkerer
 * Form ersetzt: er montiert die ausgeloggt erreichbaren Routen, statt vier
 * Lesefunktionen zu rufen, und hält auch Funktionsnamen fest. Mit ihm ist die
 * Positivliste `ANON_DARF_LESEN` umgezogen — es gibt sie jetzt genau einmal.
 *
 * WAS HIER BLEIBT, und warum es nicht mitgezogen ist: diese Zusagen messen, was
 * die Anreicherung LIEFERT (Maskierung, Spaltenwahl, die eingeloggte
 * Gegenprobe), nicht was sie anfragt. Montieren ersetzt das nicht.
 * `fetchComments` ist der klarste Fall — ausgeloggt wird es nur erreicht, wenn
 * ein offener Thread beim Abmelden montiert bleibt. Das ist eine Interaktion,
 * kein Seitenaufruf, und kein Prüfstand, der Routen montiert, kommt dort hin.
 *
 * Der aufzeichnende Stub ist derselbe wie drüben (`src/test/anon-sonde.ts`),
 * damit beide Prüfstände dieselbe Datenlage sehen.
 */

vi.mock("./supabase", async () => {
  const { sonde } = await import("../test/anon-sonde");
  return { supabase: sonde };
});

import { fetchComments, fetchFeed } from "./feed";
import { fetchEvent, fetchEvents } from "./events";
import { AUTOR, PARTNER, rekorder, zuruecksetzen } from "../test/anon-sonde";

beforeEach(() => {
  zuruecksetzen();
});

describe("Feed — Autoren", () => {
  it("fragt ausgeloggt profiles_public gar nicht erst an", async () => {
    const seite = await fetchFeed({ uid: null });

    expect(rekorder.relationen).not.toContain("profiles_public");
    // Und der Feed liefert trotzdem seine Beiträge — die Sperre nimmt nichts mit.
    expect(seite.posts).toHaveLength(1);
    // „Ein Mitglied", nicht „Mitglied": der Rückfall in `authorOf` heisst seit
    // AGE-581 wie die Maskierung von `displayAuthor`, weil es derselbe
    // Sachverhalt ist — da, zeigt sich nur nicht. Ausgeloggt ist der Wert
    // ohnehin nicht sichtbar (`displayAuthor` maskiert), aber dieser Test
    // misst die Datenschicht, und dort steht er.
    expect(seite.posts[0].author.name).toBe("Ein Mitglied");
    expect(seite.posts[0].author.avatarUrl).toBeNull();
    expect(seite.posts[0].author.tier).toBeNull();
  });

  it("fragt eingeloggt weiterhin an und löst den Autor auf", async () => {
    const seite = await fetchFeed({ uid: "me" });

    expect(rekorder.relationen).toContain("profiles_public");
    expect(seite.posts[0].author.name).toBe("Jonas Keller");
    expect(seite.posts[0].author.avatarUrl).toBe("https://x/a.webp");
    expect(seite.posts[0].author.tier).toBe("impact");
  });
});

describe("Kommentare — Autoren", () => {
  it("fragt ohne Session gar nicht erst nach Kommentaren", async () => {
    // Aufklappen kann ein ausgeloggter Besucher den Thread nicht (der Knopf ist
    // `disabled`), aber ER KANN SICH ABMELDEN, WÄHREND ER OFFEN IST: der Thread
    // bleibt montiert, der Query-Key wechselt auf uid = null und React Query holt
    // nach. `comments` trägt sein select nur für `authenticated` — das wäre der
    // dritte 401. Aus dem Diff-Review (codex).
    const kommentare = await fetchComments(null, "p1");

    expect(rekorder.relationen).not.toContain("comments");
    expect(rekorder.relationen).not.toContain("profiles_public");
    expect(kommentare).toEqual([]);
  });

  it("löst eingeloggt die Kommentar-Autoren weiterhin auf", async () => {
    // Diese Zeile ist der Grund, warum `fetchComments` das `uid` mitbekommen MUSS:
    // ohne es liefe die Anreicherung hier ins Leere und eingeloggte Leser sähen an
    // jedem Kommentar den Rückfall. Ausgeloggt gibt es diesen Pfad nicht —
    // `comments` trägt sein select nur für `authenticated`.
    const kommentare = await fetchComments("me", "p1");

    expect(rekorder.relationen).toContain("profiles_public");
    expect(kommentare[0].author.name).toBe("Jonas Keller");
    expect(kommentare[0].author.avatarUrl).toBe("https://x/a.webp");
  });
});

describe("Events — Hosts", () => {
  it("fragt ausgeloggt weder profiles_public noch partners an", async () => {
    // Beide Relationen sind für anon gesperrt. Eine Regel, die nur die
    // Profil-Hälfte überspränge, ließe den zweiten 401 stehen.
    const events = await fetchEvents(null);

    expect(rekorder.relationen).not.toContain("profiles_public");
    expect(rekorder.relationen).not.toContain("partners");
    expect(events).toHaveLength(2);
    expect(events[0].host).toBeNull();
    expect(events[1].host).toBeNull();
  });

  it("fragt ausgeloggt auch am einzelnen Event keine der beiden an", async () => {
    await fetchEvent(null, "e1");

    expect(rekorder.relationen).not.toContain("profiles_public");
    expect(rekorder.relationen).not.toContain("partners");
  });

  it("fragt die Spalten an, die die Veranstalter-Karte braucht", async () => {
    // Ohne diese Zeile wäre die Fixture-Erweiterung eine Behauptung: der Mock
    // liefert seine Felder unabhängig davon, was `select()` verlangt hat. Fällt
    // eine Spalte aus der Projektion, verliert die Karte still ihre Zeile.
    await fetchEvents("me");
    expect(rekorder.spalten.profiles_public).toContain("company");
    expect(rekorder.spalten.profiles_public).toContain("roles");
    expect(rekorder.spalten.profiles_public).toContain("short_bio");
    expect(rekorder.spalten.partners).toContain("description");
  });

  it("löst eingeloggt beide Host-Arten unverändert auf", async () => {
    const events = await fetchEvents("me");

    expect(rekorder.relationen).toContain("profiles_public");
    expect(rekorder.relationen).toContain("partners");
    expect(events[0].host).toEqual({
      kind: "profile",
      id: AUTOR,
      name: "Jonas Keller",
      avatarUrl: "https://x/a.webp",
      tier: "impact",
      company: "Keller GmbH",
      roles: ["Gründer"],
      shortBio: "Baut Dinge.",
    });
    expect(events[1].host).toEqual({
      kind: "partner",
      id: PARTNER,
      name: "Musterpartner",
      avatarUrl: "https://x/p.png",
      tier: null,
      company: null,
      roles: null,
      shortBio: "Ein Partner.",
    });
  });
});
