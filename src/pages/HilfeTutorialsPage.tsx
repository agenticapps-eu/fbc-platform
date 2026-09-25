import { RELEASE_GESCHICHTEN } from "../content/release-geschichten";
import { RELEASE_TUTORIAL } from "../content/release-tutorial";
import type { ReleaseGeschichte, TutorialEtappe } from "../types/release";

/**
 * Die Tutorials in der Anwendung (AGE-904).
 *
 * **Dieselbe Quelle wie der öffentliche Blog, keine Kopie.** Der Weg steht in
 * `release-tutorial.ts`, die Texte in `release-geschichten.ts`; bis heute las
 * beides nur `scripts/build-blog.ts`. Eine zweite Fassung für die Anwendung
 * wäre die Stelle, an der die zwei Flächen auseinanderlaufen, ohne dass es
 * jemandem auffällt — und `www.effbeezee.com` wird abgeschaltet (AGE-906),
 * womit diese Fläche die einzige bleibt.
 *
 * **Eine Seite, keine Kapitel-Unterseiten** (Donald, 25.09.). Der Blog führt
 * je Kapitel eine Seite, weil er ein Dokumentbaum ist. Hilfe in der Anwendung
 * ist ein Ort, an dem man sucht: eine Seite, die man einmal durchsieht oder
 * mit der Seitensuche durchsucht, ist dafür das kleinere und das bessere Ding.
 * Sie kostet ausserdem kein Slug-Routing — und damit auch nicht die Falle, dass
 * ein Routenwechsel ohne Remount das vorige Dokument stehen lässt.
 *
 * **Kein Stufen-Gate**, wie bei „Neu in der App": was die Anwendung kann, ist
 * keine Frage der Mitgliedsstufe. Gerade das Konto auf der untersten Stufe hat
 * den grössten Bedarf, es zu erfahren.
 */

/** Klartext mit Leerzeile als Absatztrenner — dieselbe Form wie im Blog. */
function absaetze(text: string): string[] {
  return text.split(/\n{2,}/).map((a) => a.trim());
}

/**
 * Die Etappen, die etwas zu zeigen haben — mit ihren freigegebenen Kapiteln.
 *
 * Eine Etappe, deren Kapitel alle noch Entwürfe sind, erscheint gar nicht erst
 * — sonst stünde eine Überschrift über einer leeren Strecke und verriete, dass
 * es dort etwas gibt. Dieselbe Regel wie im Blog.
 *
 * Die Kennung entsteht aus der Stelle in der GEPFLEGTEN Liste, nicht aus der
 * Stelle nach dem Filtern: sonst verschöbe eine Freigabe die Sprungziele aller
 * folgenden Etappen.
 *
 * Als Funktion über ihren Eingaben und nicht über den Modulwerten: so ist die
 * Auswahlregel mit erfundenen Entwürfen prüfbar, ohne zwei Inhaltsmodule zu
 * ersetzen. Die Fläche selbst reicht die echten Listen hinein.
 */
export function etappenMitKapiteln(etappen: TutorialEtappe[], geschichten: ReleaseGeschichte[]) {
  const freigegeben = new Map(geschichten.filter((g) => g.freigegeben).map((g) => [g.slug, g]));
  return etappen
    .map((etappe, i) => ({
      id: `etappe-${i + 1}`,
      titel: etappe.titel,
      einleitung: etappe.einleitung,
      kapitel: etappe.kapitel
        .map((slug) => freigegeben.get(slug))
        .filter((g): g is ReleaseGeschichte => g !== undefined),
    }))
    .filter((etappe) => etappe.kapitel.length > 0);
}

export default function HilfeTutorialsPage() {
  const ETAPPEN = etappenMitKapiteln(RELEASE_TUTORIAL, RELEASE_GESCHICHTEN);
  /**
   * Das erste Bild der Seite lädt sofort, alle anderen später.
   *
   * `loading="lazy"` an jedem Bild verzögerte auch das, was beim Aufschlagen
   * ohnehin im Bild steht. Und Achtung bei der Gegenrichtung: ein `<img>` in
   * `display:none` wird trotzdem geladen — diese Fläche versteckt deshalb
   * nichts, die Sprungmarken springen, sie filtern nicht.
   */
  const ERSTES_KAPITEL = ETAPPEN[0]?.kapitel[0]?.slug;

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-10">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">So funktioniert der Club</h1>
        <p className="mt-1 text-sm text-muted">
          Ein Weg durch die Anwendung, vom Ankommen bis zum Einrichten.
        </p>
      </header>

      <nav aria-label="Etappen" className="flex flex-wrap gap-2">
        {ETAPPEN.map((etappe) => (
          <a
            key={etappe.id}
            href={`#${etappe.id}`}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {etappe.titel}
          </a>
        ))}
      </nav>

      {ETAPPEN.map((etappe) => (
        // `scroll-mt-20`: die Kopfzeile steht fest über der Seite (`h-16`).
        // Ohne den Abstand landet die Überschrift beim Springen unter ihr.
        <section key={etappe.id} id={etappe.id} className="flex scroll-mt-20 flex-col gap-6">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">{etappe.titel}</h2>
            <p className="mt-1 text-sm text-muted">{etappe.einleitung}</p>
          </div>

          {etappe.kapitel.map((g) => (
            <article key={g.slug} className="flex flex-col gap-3">
              <h3 className="text-lg font-semibold text-ink">{g.titel}</h3>
              {/* Breite und Höhe stehen am Bild, nicht nur im Stil: ohne sie
                  kennt der Browser das Seitenverhältnis erst, wenn das Bild da
                  ist, und schiebt den Text darunter genau in dem Moment nach
                  unten, in dem jemand ihn liest. `max-w-full` fängt die breiten
                  Aufnahmen auf die Textspalte; ein 180 px breiter Ausschnitt
                  bleibt 180 px breit, statt aufgeblasen zu werden. */}
              <img
                src={g.bild.src}
                alt={g.bild.alt}
                width={g.bild.width}
                height={g.bild.height}
                loading={g.slug === ERSTES_KAPITEL ? undefined : "lazy"}
                className="h-auto max-w-full rounded-[var(--radius-card)] border border-line"
              />
              {absaetze(g.text).map((absatz, i) => (
                <p key={i} className="text-sm text-ink">
                  {absatz}
                </p>
              ))}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
