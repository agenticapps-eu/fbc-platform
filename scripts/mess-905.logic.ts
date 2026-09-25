/**
 * Die Rechnung hinter der Abnahme von AGE-905 — ohne Datenbank (AGE-905).
 *
 * **Warum das hier steht und nicht im Skript daneben.** Die Abnahme dieses
 * Changes ist eine Differenz: „0 neue Zeilen in `notifications` und
 * `push_zustellungen`". Rechnet die Differenz falsch, sieht das Ergebnis
 * genauso aus wie ein echtes Null — die Abnahme bestätigte sich selbst. Eine
 * Rechnung, deren Fehlerbild von ihrem Erfolgsbild nicht zu unterscheiden ist,
 * gehört geprüft, und prüfbar ist sie nur ohne Verbindung.
 *
 * **Absolute Zahlen sind KEINE Abnahme** (Befund codex im Plan-Review,
 * MITTEL). Ein Zielwert „`notifications` steht bei 308" setzte voraus, dass
 * zwischen Messung und Deploy niemand einen Beitrag schreibt. Ein legitimer
 * neuer Beitrag liesse die Abnahme scheitern; zwei gegenläufige Schreibvorgänge
 * verdeckten eine Regression. Gemessen wird deshalb die Differenz zwischen
 * zwei Messungen derselben Fläche.
 */

/** Eine Zählung je Schlüssel — `status`, `kind` oder `type`. */
export interface Zeilen {
  schluessel: string;
  n: number;
}

/** Was eine der 23 Geschichten auf einer Fläche vorfindet. */
export interface GeschichtenStand {
  slug: string;
  /** Es gibt eine `release_notes`-Zeile, die diesen Slug in `entry_slugs` trägt. */
  note: boolean;
  /** `sent` statt `draft` — nur dann gehört eine Karte dazu. */
  zugestellt: boolean;
  /** Es gibt eine `posts`-Zeile mit `kind='release'` auf diese Note. */
  beitrag: boolean;
  /** `veroeffentlicht_ab` der Karte, ISO — oder `null`, wenn es keine gibt. */
  veroeffentlichtAb: string | null;
}

/** Eine vollständige Aufnahme einer Fläche, zu einem Zeitpunkt. */
export interface Messung {
  ziel: string;
  gemessenAm: string;
  releaseNotes: Zeilen[];
  posts: Zeilen[];
  notifications: Zeilen[];
  pushZustellungen: number;
  geschichten: GeschichtenStand[];
}

export interface Veraenderung {
  schluessel: string;
  vorher: number;
  nachher: number;
  delta: number;
}

export interface Differenz {
  notificationsGesamt: Veraenderung;
  notificationsJeTyp: Veraenderung[];
  pushZustellungen: Veraenderung;
  postsJeArt: Veraenderung[];
  releaseBeitraege: Veraenderung;
  /** Slugs, die zwischen den beiden Messungen eine Karte bekommen haben. */
  neueKarten: string[];
  /** Slugs, die eine Karte VERLOREN haben — darf nie vorkommen. */
  verloreneKarten: string[];
}

const summe = (z: Zeilen[]): number => z.reduce((a, b) => a + b.n, 0);

const holen = (z: Zeilen[], schluessel: string): number =>
  z.find((x) => x.schluessel === schluessel)?.n ?? 0;

/**
 * Die Schlüssel BEIDER Seiten, nicht nur der einen.
 *
 * Ein Typ, der erst in der zweiten Messung auftaucht, fehlte sonst in der
 * Differenz — und das ist genau der Fall, den dieser Change ausschliessen
 * soll: eine neue `release_note`-Zeile, die es vorher nicht gab. Wer über die
 * Schlüssel der ersten Messung iteriert, sieht sie nie.
 */
function alleSchluessel(a: Zeilen[], b: Zeilen[]): string[] {
  return [...new Set([...a.map((x) => x.schluessel), ...b.map((x) => x.schluessel)])].sort();
}

function vergleiche(a: Zeilen[], b: Zeilen[]): Veraenderung[] {
  return alleSchluessel(a, b).map((schluessel) => {
    const vorher = holen(a, schluessel);
    const nachher = holen(b, schluessel);
    return { schluessel, vorher, nachher, delta: nachher - vorher };
  });
}

export function differenz(vorher: Messung, nachher: Messung): Differenz {
  const kartenVon = (m: Messung) =>
    new Set(m.geschichten.filter((g) => g.beitrag).map((g) => g.slug));
  const vorherKarten = kartenVon(vorher);
  const nachherKarten = kartenVon(nachher);

  const nGesamt = (m: Messung) => summe(m.notifications);
  const nRelease = (m: Messung) => holen(m.posts, "release");

  return {
    notificationsGesamt: {
      schluessel: "notifications",
      vorher: nGesamt(vorher),
      nachher: nGesamt(nachher),
      delta: nGesamt(nachher) - nGesamt(vorher),
    },
    notificationsJeTyp: vergleiche(vorher.notifications, nachher.notifications),
    pushZustellungen: {
      schluessel: "push_zustellungen",
      vorher: vorher.pushZustellungen,
      nachher: nachher.pushZustellungen,
      delta: nachher.pushZustellungen - vorher.pushZustellungen,
    },
    postsJeArt: vergleiche(vorher.posts, nachher.posts),
    releaseBeitraege: {
      schluessel: "posts.kind=release",
      vorher: nRelease(vorher),
      nachher: nRelease(nachher),
      delta: nRelease(nachher) - nRelease(vorher),
    },
    neueKarten: [...nachherKarten].filter((s) => !vorherKarten.has(s)).sort(),
    verloreneKarten: [...vorherKarten].filter((s) => !nachherKarten.has(s)).sort(),
  };
}

export interface Befund {
  schwere: "FEHLER" | "OK";
  text: string;
}

/**
 * Die Zusage dieses Changes, gegen eine Differenz gehalten.
 *
 * `erwarteteNeueKarten` ist beim ersten Lauf 23 und bei jedem weiteren 0 —
 * dieselbe Funktion prüft damit die Wirkung UND die Wiederholbarkeit, statt
 * zwei Rechnungen zu pflegen, die auseinanderlaufen können.
 */
export function bewerte(d: Differenz, erwarteteNeueKarten: number): Befund[] {
  const befunde: Befund[] = [];
  const pruefe = (ok: boolean, text: string) =>
    befunde.push({ schwere: ok ? "OK" : "FEHLER", text });

  pruefe(
    d.notificationsGesamt.delta === 0,
    `notifications: ${d.notificationsGesamt.vorher} → ${d.notificationsGesamt.nachher} (Δ ${d.notificationsGesamt.delta}, erwartet 0)`,
  );

  // Je Typ EINZELN, nicht nur die Summe. Zwei gegenläufige Änderungen —
  // ein Hinweis kommt, ein anderer wird geloescht — ergaeben in der Summe
  // eine Null, die nach Ruhe aussieht.
  for (const t of d.notificationsJeTyp.filter((x) => x.delta !== 0)) {
    befunde.push({
      schwere: "FEHLER",
      text: `notifications[${t.schluessel}]: ${t.vorher} → ${t.nachher} (Δ ${t.delta}, erwartet 0)`,
    });
  }

  pruefe(
    d.pushZustellungen.delta === 0,
    `push_zustellungen: ${d.pushZustellungen.vorher} → ${d.pushZustellungen.nachher} (Δ ${d.pushZustellungen.delta}, erwartet 0)`,
  );

  pruefe(
    d.releaseBeitraege.delta === erwarteteNeueKarten,
    `posts kind=release: ${d.releaseBeitraege.vorher} → ${d.releaseBeitraege.nachher} (Δ ${d.releaseBeitraege.delta}, erwartet ${erwarteteNeueKarten})`,
  );

  pruefe(
    d.neueKarten.length === erwarteteNeueKarten,
    `Geschichten mit neuer Karte: ${d.neueKarten.length} (erwartet ${erwarteteNeueKarten})`,
  );

  // Die Zahl kann stimmen, waehrend die Slugs falsch sind: eine Karte
  // verschwindet, eine andere entsteht. Deshalb beide Richtungen.
  pruefe(
    d.verloreneKarten.length === 0,
    `Geschichten mit verlorener Karte: ${d.verloreneKarten.length} (erwartet 0)` +
      (d.verloreneKarten.length ? ` — ${d.verloreneKarten.join(", ")}` : ""),
  );

  // Andere Beitragsarten gehen diesen Change nichts an. Faellt dort etwas an,
  // ist entweder ein Mitglied gleichzeitig taetig gewesen (harmlos, aber es
  // gehoert gesehen) oder der Nachtrag hat mehr angefasst als seine Art.
  for (const p of d.postsJeArt.filter((x) => x.schluessel !== "release" && x.delta !== 0)) {
    befunde.push({
      schwere: "FEHLER",
      text: `posts[${p.schluessel}]: ${p.vorher} → ${p.nachher} (Δ ${p.delta}, erwartet 0 — fremder Schreibvorgang oder zu breiter Nachtrag)`,
    });
  }

  return befunde;
}

export const hatFehler = (befunde: Befund[]): boolean =>
  befunde.some((b) => b.schwere === "FEHLER");
