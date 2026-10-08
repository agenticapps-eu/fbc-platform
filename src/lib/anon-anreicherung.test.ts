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
import { AUTOR, PARTNER, ZEILEN, rekorder, zuruecksetzen } from "../test/anon-sonde";

beforeEach(() => {
  zuruecksetzen();
});

describe("Feed — Autoren", () => {
  it("ruft ausgeloggt profil_karten gar nicht erst", async () => {
    const seite = await fetchFeed({ uid: null });

    // Bis AGE-1001 stand hier `relationen`/`profiles_public`. Die Zusage ist
    // dieselbe und sie ist seitdem SCHÄRFER: `profil_karten` trägt sein
    // `execute` nur für `authenticated`, ein ausgeloggter Aufruf wäre ein 404
    // statt eines 401 — und ebenso vermeidbar.
    expect(rekorder.funktionen).not.toContain("profil_karten");
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

  it("ruft eingeloggt weiterhin und löst den Autor auf", async () => {
    const seite = await fetchFeed({ uid: "me" });

    expect(rekorder.funktionen).toContain("profil_karten");
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
    expect(rekorder.funktionen).not.toContain("profil_karten");
    expect(kommentare).toEqual([]);
  });

  it("löst eingeloggt die Kommentar-Autoren weiterhin auf", async () => {
    // Diese Zeile ist der Grund, warum `fetchComments` das `uid` mitbekommen MUSS:
    // ohne es liefe die Anreicherung hier ins Leere und eingeloggte Leser sähen an
    // jedem Kommentar den Rückfall. Ausgeloggt gibt es diesen Pfad nicht —
    // `comments` trägt sein select nur für `authenticated`.
    const kommentare = await fetchComments("me", "p1");

    expect(rekorder.funktionen).toContain("profil_karten");
    expect(kommentare[0].author.name).toBe("Jonas Keller");
    expect(kommentare[0].author.avatarUrl).toBe("https://x/a.webp");
  });
});

describe("Events — Hosts", () => {
  it("ruft ausgeloggt weder profil_karten noch partners", async () => {
    // Beides ist für anon gesperrt. Eine Regel, die nur die Profil-Hälfte
    // überspränge, ließe den zweiten Fehlschlag stehen.
    const events = await fetchEvents(null);

    expect(rekorder.funktionen).not.toContain("profil_karten");
    expect(rekorder.relationen).not.toContain("partners");
    expect(events).toHaveLength(2);
    expect(events[0].host).toBeNull();
    expect(events[1].host).toBeNull();
  });

  it("rührt ausgeloggt auch am einzelnen Event keines von beiden an", async () => {
    await fetchEvent(null, "e1");

    expect(rekorder.funktionen).not.toContain("profil_karten");
    expect(rekorder.relationen).not.toContain("partners");
  });

  it("fragt die Partner-Spalten an, die die Veranstalter-Karte braucht", async () => {
    // Ohne diese Zeile wäre die Fixture-Erweiterung eine Behauptung: der Mock
    // liefert seine Felder unabhängig davon, was `select()` verlangt hat. Fällt
    // eine Spalte aus der Projektion, verliert die Karte still ihre Zeile.
    //
    // Die Profil-Hälfte dieser Zusage ist mit AGE-1001 ENTFALLEN und durch die
    // Zusage darunter ERSETZT: es gibt keine Projektion mehr, die Spaltenliste
    // steht in `returns table (…)` von `profil_karten`.
    await fetchEvents("me");
    expect(rekorder.spalten.partners).toContain("description");
  });

  it("hält die Vorrichtung von profil_karten auf genau den zehn Feldern der Funktion", () => {
    // Der Ersatz für die weggefallene Spalten-Zusage, und er misst dasselbe
    // von der anderen Seite: verspricht die Vorrichtung MEHR als die Funktion,
    // ist jede Zusage darüber grün, die in der Datenbank `undefined` bekäme.
    // Die Liste ist zeichengleich mit dem `returns table (…)` in
    // 20261008090000_verzeichnis_dicht.sql und mit `database.types.ts`.
    expect(Object.keys(ZEILEN.profil_karten[0]).sort()).toEqual(
      [
        "avatar_url",
        "branche",
        "company",
        "cover_url",
        "id",
        "name",
        "region",
        "roles",
        "short_bio",
        "tier",
      ].sort(),
    );
  });

  it("löst eingeloggt beide Host-Arten unverändert auf", async () => {
    const events = await fetchEvents("me");

    expect(rekorder.funktionen).toContain("profil_karten");
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
