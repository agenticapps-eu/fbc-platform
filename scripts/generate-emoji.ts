#!/usr/bin/env tsx
/**
 * Erzeugt `src/content/emoji.generated.ts` aus `emojibase-data` (AGE-645).
 *
 * **Läuft NICHT in `prebuild`** — anders als `release:entries`. Der Grund ist
 * das Netz: dieses Skript holt seine Quelle von einem CDN, und ein Build, der
 * ohne Netzverbindung scheitert, wäre ein Rückschritt. Die erzeugte Datei ist
 * eingecheckt; dieses Skript läuft von Hand, wenn eine neue Unicode-Fassung
 * übernommen werden soll.
 *
 * Aufruf: `pnpm tsx scripts/generate-emoji.ts`
 *
 * **Warum diese Quelle und nicht die naheliegende.** Gemessen am 28.08.:
 * `@emoji-mart/data` ist 27 MB in 98 Dateien (alle Sprachen) und kommt so nicht
 * ins Bündel. `unicode-emoji-json` ist mit 1914 Emoji kleiner — und trotzdem
 * falsch, weil seine Namen nur englisch sind: das einzige „Herz" im ganzen Satz
 * ist „Bosnia & Herzegovina". In einer deutschsprachigen Anwendung fände eine
 * Suche nach „Herz" damit eine Flagge statt ❤️.
 *
 * `emojibase-data` liefert deutsche `label` UND deutsche `tags`. Abgespeckt auf
 * das, was das Auswahlfeld braucht, sind das rund 46 kB gzip — nachgeladen,
 * nicht im Startbündel.
 */
import { writeFileSync } from "node:fs";

import { format, resolveConfig } from "prettier";

const FASSUNG = "17.0.0";
const BASIS = `https://cdn.jsdelivr.net/npm/emojibase-data@${FASSUNG}/de`;
const ZIEL = "src/content/emoji.generated.ts";

/** Hautton-Modifikatoren (🏻🏼🏽🏾🏿). Keine wählbaren Emoji, sondern Bausteine —
 *  sie gehören nicht ins Raster. Hauttöne selbst sind in AGE-645 ausdrücklich
 *  ausgeschlossen und liegen als AGE-650 daneben. */
const GRUPPE_KOMPONENTEN = 2;

interface RohEmoji {
  unicode: string;
  label: string;
  group?: number;
  order?: number;
  tags?: string[];
}

interface RohGruppe {
  order: number;
  key: string;
  message: string;
}

async function hole<T>(datei: string): Promise<T> {
  const antwort = await fetch(`${BASIS}/${datei}`);
  if (!antwort.ok) {
    throw new Error(`${datei}: HTTP ${antwort.status} ${antwort.statusText}`);
  }
  return (await antwort.json()) as T;
}

async function main() {
  const [emoji, nachrichten] = await Promise.all([
    hole<RohEmoji[]>("compact.json"),
    hole<{ groups: RohGruppe[] }>("messages.json"),
  ]);

  const gruppen = nachrichten.groups
    .filter((g) => g.order !== GRUPPE_KOMPONENTEN)
    .map((g) => [g.order, g.message] as const);

  const erlaubt = new Set(gruppen.map(([order]) => order));

  // `skins` wird bewusst NICHT mitgenommen: Hauttöne sind aus AGE-645
  // ausgeschlossen (AGE-650). Sie hier zu ergänzen ist eine Zeile — und kostet
  // gemessene +8 kB gzip.
  const eintraege = emoji
    .filter((e) => e.group !== undefined && erlaubt.has(e.group))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((e) => [e.unicode, e.label, (e.tags ?? []).join(" "), e.group] as const);

  const inhalt = `// ERZEUGT — nicht von Hand ändern.
// Quelle: emojibase-data@${FASSUNG} (de/compact.json, de/messages.json), MIT-Lizenz.
// Neu erzeugen: pnpm tsx scripts/generate-emoji.ts
//
// Diese Datei wird ABSICHTLICH nur dynamisch importiert. Ein einziges
// statisches \`import\` von hier zöge sie ins Startbündel, und die Zusage
// „die Anmeldeseite trägt nichts davon" wäre still gebrochen.

/** [Emoji, deutscher Name, Suchbegriffe (Leerzeichen-getrennt), Gruppe] */
export type EmojiEintrag = readonly [string, string, string, number];

/** [Gruppennummer, deutscher Gruppenname] — in Anzeigereihenfolge. */
export const EMOJI_GRUPPEN: ReadonlyArray<readonly [number, string]> = ${JSON.stringify(gruppen)};

export const EMOJI: ReadonlyArray<EmojiEintrag> = ${JSON.stringify(eintraege)};
`;

  // Formatiert schreiben, nicht roh. `JSON.stringify` erzeugt Anführungszeichen
  // an Schlüsseln, die Prettier wieder entfernt — eine ungeformte erzeugte Datei
  // ist damit dauerhaft `format:check`-rot und springt bei jedem Neuerzeugen hin
  // und her. (`release-entries.generated.ts` hat genau dieses Problem; das zu
  // beheben ist ein eigener Vorgang, nicht dieser.)
  // `resolveConfig` ist nicht optional: ohne die Repo-Einstellungen formatiert
  // Prettier nach seinen eigenen Vorgaben, und `format:check` bleibt rot.
  const prettierKonfig = await resolveConfig(ZIEL);
  writeFileSync(ZIEL, await format(inhalt, { ...prettierKonfig, parser: "typescript" }));
  console.log(`${ZIEL}: ${eintraege.length} Emoji in ${gruppen.length} Gruppen`);
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});
