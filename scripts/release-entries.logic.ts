/**
 * Archiv → Release-Einträge (AGE-631, Band 1). Reine Funktionen, kein
 * Dateisystem — der Muster nach `changed-functions.logic.ts` und
 * `db-drift-scan.logic.ts`.
 *
 * **Warum jede Zeile hier einen Rückfall hat.** Gemessen am 27.08. gegen das
 * echte Archiv: von 50 Verzeichnissen tragen **21** keine `# Titel`-Zeile (sie
 * beginnen mit `## Why`) und **19** keine `Linear:`-Zeile. Verlässlich ist
 * allein der Verzeichnisname `JJJJ-MM-TT-<slug>` — der stimmt bei 50 von 50.
 *
 * Ein Parser, der auf das Wohlgeformte besteht, liesse zwei Fünftel der
 * Einträge verschwinden, und niemand merkte es: eine kürzere Liste sieht aus
 * wie eine vollständige.
 */

export interface ReleaseEintrag {
  /** Verzeichnisname im Archiv — der einzige verlässliche Schlüssel. */
  slug: string;
  /** `JJJJ-MM-TT` aus dem Verzeichnisnamen. */
  datum: string;
  /** Aus `# …`, sonst der Verzeichnisname ohne Datum. */
  titel: string;
  /** `AGE-123`, wenn das Proposal eine `Linear:`-Zeile trägt. */
  linear: string | null;
  /** Die Stichpunkte der obersten Ebene aus „What Changes". */
  aenderungen: string[];
}

export interface ReleaseEntwurf {
  titel: string;
  text: string;
  slugs: string[];
}

const DATUM = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

/**
 * Sammelt die Stichpunkte der OBERSTEN Ebene eines Abschnitts.
 *
 * Nur die oberste: eingerückte Unterpunkte sind Begründungen für Entwickler und
 * gehören nicht in eine Ankündigung. Ein mehrzeiliger Stichpunkt wird zu einer
 * Zeile zusammengezogen — im Proposal bricht er nur um, weil die Datei 80
 * Zeichen breit ist.
 */
function stichpunkte(abschnitt: string): string[] {
  const punkte: string[] = [];
  let offen: string | null = null;
  for (const zeile of abschnitt.split("\n")) {
    if (/^[-*] /.test(zeile)) {
      if (offen !== null) punkte.push(offen);
      offen = zeile.slice(2).trim();
    } else if (offen !== null && /^\s+\S/.test(zeile) && !/^\s+[-*] /.test(zeile)) {
      // Fortsetzungszeile desselben Punktes — kein Unterpunkt.
      offen += " " + zeile.trim();
    } else if (/^\s+[-*] /.test(zeile)) {
      // Unterpunkt: übersprungen, aber er beendet den offenen Punkt NICHT,
      // sonst risse er eine Fortsetzung darunter ab.
    } else if (zeile.trim() === "") {
      if (offen !== null) {
        punkte.push(offen);
        offen = null;
      }
    }
  }
  if (offen !== null) punkte.push(offen);
  return punkte;
}

/**
 * Schneidet den Abschnitt „What Changes" heraus — zeilenweise, nicht per
 * Regulärausdruck über den ganzen Text.
 *
 * Der Grund ist eine Falle, in die die erste Fassung gelaufen ist: JavaScript
 * kennt **kein** `\Z`. Ein `(?=^#{1,2} |\Z)` sucht also wörtlich nach einem
 * „Z" und findet das Dateiende nie — der letzte Abschnitt einer Datei fiel
 * dadurch weg. Gefunden hat es der Test mit einem Proposal, dessen
 * „What Changes" der letzte Abschnitt ist; genau der häufige Fall.
 */
function abschnittWhatChanges(proposal: string): string {
  const zeilen = proposal.split("\n");
  const start = zeilen.findIndex((z) => /^## What Changes\s*$/.test(z));
  if (start === -1) return "";
  const rest = zeilen.slice(start + 1);
  const ende = rest.findIndex((z) => /^#{1,2} /.test(z));
  return (ende === -1 ? rest : rest.slice(0, ende)).join("\n");
}

export function parseArchivEintrag(slug: string, proposal: string): ReleaseEintrag {
  const treffer = DATUM.exec(slug);
  const datum = treffer ? treffer[1] : "";
  const rest = treffer ? treffer[2] : slug;

  const titelZeile = /^# (.+)$/m.exec(proposal);
  const linearZeile = /^Linear:\s*\*{0,2}(AGE-\d+)\*{0,2}/m.exec(proposal);

  return {
    slug,
    datum,
    titel: titelZeile ? titelZeile[1].trim() : rest,
    linear: linearZeile ? linearZeile[1] : null,
    aenderungen: stichpunkte(abschnittWhatChanges(proposal)),
  };
}

/**
 * Aus mehreren Einträgen wird EIN Entwurf — das ist die Anforderung, nicht eine
 * Nachricht je Eintrag. Der Text ist ein Vorschlag: der Admin überschreibt ihn,
 * und er soll ihn überschreiben. Proposal-Sprache ist für Entwickler.
 */
export function entwurfAus(eintraege: ReleaseEintrag[]): ReleaseEntwurf {
  const text = eintraege
    .map((e) => {
      const kopf = `## ${e.titel}`;
      const punkte = e.aenderungen.map((a) => `- ${a}`).join("\n");
      return punkte ? `${kopf}\n\n${punkte}` : kopf;
    })
    .join("\n\n");
  return { titel: "Neu in der App", text, slugs: eintraege.map((e) => e.slug) };
}
