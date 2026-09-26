import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEVEL,
  LEVELS,
  LEVEL_ORDER,
  LEVEL_RANK,
  isMembershipLevel,
  levelLabel,
} from "./levels";

/**
 * Die Leiter V5 (AGE-903) im Frontend-Spiegel.
 *
 * Diese Datei prüft die SPIEGELUNG, nicht das Gating. Die Grenze ist die
 * RLS-Policy in Supabase (`has_level(rank)`), unabhängig vom Client — was hier
 * steht, entscheidet nur, ob eine Oberfläche ein Versprechen bricht.
 *
 * Gerade deshalb muss die Tabelle stimmen: `membership_tiers` ist die Wahrheit,
 * und eine Kopie, die um einen Rang verrutscht ist, zeigt Preise und Wände an
 * der falschen Stelle. Der Wächter dagegen ist die pgTAP-Zusage in
 * `supabase/tests/stufen_v5_leiter_test.sql`, die dieselbe Leiter gegen die
 * Datenbank prüft — beide Seiten getrennt, damit eine verrutschte Kopie nicht
 * beide zugleich mitnimmt.
 */
describe("Leiter V5", () => {
  it("trägt sechs Stufen in aufsteigender Rangfolge", () => {
    expect(LEVEL_ORDER).toEqual([
      "active",
      "boost",
      "connect",
      "discover",
      "focus",
      "impact",
    ]);
  });

  it("spiegelt membership_tiers.level_rank 1…6", () => {
    expect(LEVEL_RANK).toEqual({
      active: 1,
      boost: 2,
      connect: 3,
      discover: 4,
      focus: 5,
      impact: 6,
    });
  });

  it("gibt den drei Stufen ausserhalb des Clubs 0 €", () => {
    // Donald, 26.09.: „aktuell 0, wird ja später kommen". Ein Preis ohne
    // Kaufweg wäre eine Zusage ohne Gegenstand — dieselbe Begründung, die
    // schon für BOOST galt.
    expect(LEVELS.active.priceYear).toBe(0);
    expect(LEVELS.boost.priceYear).toBe(0);
    expect(LEVELS.connect.priceYear).toBe(0);
  });

  it("trägt die Clubpreise 300 / 600 / 1200 €", () => {
    expect(LEVELS.discover.priceYear).toBe(300);
    expect(LEVELS.focus.priceYear).toBe(600);
    expect(LEVELS.impact.priceYear).toBe(1200);
  });

  it("hält den Monatspreis bei einem Zehntel des Jahrespreises", () => {
    // Die Datenbank führt nur `price_year`; der Monatspreis lebt allein hier.
    // Ohne diese Zusage könnte er beim Umschreiben der Tabelle still zur alten
    // Stufe gehören.
    for (const level of LEVEL_ORDER) {
      expect(LEVELS[level].priceMonth * 10).toBe(LEVELS[level].priceYear);
    }
  });

  it("startet neue Konten auf ACTIVE — Rang 1, ausserhalb des Clubs", () => {
    expect(DEFAULT_LEVEL).toBe("active");
    expect(LEVEL_RANK[DEFAULT_LEVEL]).toBe(1);
  });

  it("kennt die entfallenen Schlüssel nicht mehr", () => {
    // `basic` und `exchange` entfielen mit AGE-903, die vier davor mit AGE-311.
    for (const weg of ["basic", "exchange", "explore", "impuls", "prime", "circle", "legacy"]) {
      expect(isMembershipLevel(weg)).toBe(false);
    }
  });

  it("nennt jede Stufe mit ihrem eigenen Label", () => {
    // Ein Label, das auf den rohen Schlüssel zurückfällt, sähe in der
    // Oberfläche wie ein Name aus. `levelLabel` tut das absichtlich für
    // unbekannte Werte — für die sechs bekannten darf es nicht passieren.
    const labels = LEVEL_ORDER.map((l) => levelLabel(l));
    expect(labels).toEqual(["Active", "Boost", "Connect", "Discover", "Focus", "Impact"]);
    expect(new Set(labels).size).toBe(6);
  });

  it("gibt `key` und Schlüssel identisch zurück", () => {
    // Der Eintrag trägt seinen Schlüssel doppelt: als Objektschlüssel und im
    // Feld `key`. Ein Umschreiben der Tabelle kann genau eines von beiden
    // vergessen, und dann zeigt eine Karte den Namen der Nachbarstufe.
    for (const level of LEVEL_ORDER) {
      expect(LEVELS[level].key).toBe(level);
    }
  });
});
