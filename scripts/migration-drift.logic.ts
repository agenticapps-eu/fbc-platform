/**
 * Auswertung der Migrationshistorie für das Drift-Gate (AGE-496 / AGE-257).
 *
 * Der Leitsatz, aus Schaden gelernt: **was nicht sicher gelesen werden kann,
 * ist ein Fehler, kein leeres Ergebnis.** Am 2026-08-05 stellte die
 * Supabase-CLI zwischen 2.107.0 und 2.111.0 von einer ASCII-Tabelle auf JSON
 * um. Ein Parser, der bei unbekanntem Format einfach nichts findet, hätte
 * „keine Abweichung" gemeldet, während auf PROD null von 40 Migrationen
 * angewendet waren — die Juni-Havarie, eine Ebene höher.
 */

export type Eintrag = { local: string; remote: string };
export type Drift = { art: "lokal-nur" | "remote-nur" | "reihenfolge"; version: string };

/**
 * Liest `supabase migration list --output-format json`. Die CLI schreibt
 * Fortschrittszeilen vor das JSON, deshalb wird ab der ersten `{`-Klammer
 * gelesen.
 */
export function leseMigrationsliste(roh: string): Eintrag[] {
  const start = roh.indexOf("{");
  if (start === -1) {
    throw new Error(
      "Die Ausgabe von `supabase migration list` enthält kein JSON. " +
        "Hat die CLI ihr Format geändert? Das Gate kann nicht messen.",
    );
  }

  let geparst: unknown;
  try {
    geparst = JSON.parse(roh.slice(start));
  } catch (e) {
    throw new Error(`Die Ausgabe ist kein gültiges JSON: ${(e as Error).message}`, { cause: e });
  }

  const migrations = (geparst as { migrations?: unknown }).migrations;
  if (!Array.isArray(migrations)) {
    throw new Error(
      "Im JSON fehlt das Feld `migrations`. Hat die CLI ihr Format geändert? " +
        "Das Gate kann nicht messen.",
    );
  }

  return migrations.map((m) => ({
    local: String((m as Eintrag).local ?? ""),
    remote: String((m as Eintrag).remote ?? ""),
  }));
}

/**
 * Vergleicht die Historie in **beide** Richtungen. `dateienImRepo` ist die
 * Kreuzprobe: liest der Parser eine andere Zahl lokaler Einträge, als Dateien
 * unter `supabase/migrations/` liegen, misst er nicht, was er zu messen
 * vorgibt — und das ist ein Fehler, keine Feststellung.
 */
export function findeDrift(eintraege: Eintrag[], dateienImRepo: number): Drift[] {
  const gelesen = eintraege.filter((e) => e.local !== "").length;
  if (gelesen !== dateienImRepo) {
    throw new Error(
      `Parser liest ${gelesen} lokale Migrationen, im Repo liegen ${dateienImRepo} Dateien. ` +
        "Das Gate misst nicht verlässlich.",
    );
  }

  const drift: Drift[] = [];
  for (const { local, remote } of eintraege) {
    if (local === remote) continue;
    if (remote === "") drift.push({ art: "lokal-nur", version: local });
    else if (local === "") drift.push({ art: "remote-nur", version: remote });
    else drift.push({ art: "reihenfolge", version: `${local}/${remote}` });
  }
  return drift;
}
