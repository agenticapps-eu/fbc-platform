import { Link } from "react-router-dom";
import { VideoFreigabeWiderruf } from "../components/VideoFreigabeWiderruf";
import { Logo } from "../components/ui/Logo";
import { rechtsseiten } from "../content/legal/meta";
import type { Block, Inline, Rechtsdokument } from "../content/legal/types";

/**
 * Eine Rechtsseite (AGE-497).
 *
 * **Liegt bewusst ausserhalb der `AppShell`**, wie `/login`. `App.tsx` wickelt
 * die gesamte Shell in `<ActivationGate>`; ein eingeloggtes, noch
 * unbestaetigtes Konto sieht dort ausschliesslich den Aktivierungsbildschirm —
 * „egal welche Route". Laegen die Rechtsseiten drin, waere das Impressum genau
 * fuer die Gruppe unerreichbar, die es am dringendsten braucht: Menschen, die
 * gerade ein Konto bestaetigen und vor dem Passwortsetzen sehen wollen, worauf
 * sie sich einlassen.
 *
 * Der Text wird als DATEN gerendert, nie als Markup — siehe `types.ts`.
 */

/**
 * Welche Verweise duerfen ueberhaupt ein Link werden?
 *
 * `types.ts` verspricht, dass Text nie als Markup interpretiert wird — fuer
 * `href` galt das NICHT: ein `javascript:` im Inhaltsliteral waere ausgefuehrt
 * worden. Der Diff-Review hat das zu Recht als Luecke benannt, und der Kanal
 * ist genau der, den `types.ts` selbst als Risiko nennt: Text, den ein Mensch
 * aus einem Word-Dokument einpflegt.
 *
 * Alles ausserhalb dieser Liste wird als reiner Text gerendert — sichtbar,
 * aber nicht anklickbar. Lieber ein toter Verweis als ein aktiver, den
 * niemand geprueft hat.
 */
function istErlaubterVerweis(href: string): boolean {
  if (href.startsWith("/")) return true;
  try {
    return ["https:", "http:", "mailto:"].includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

function InlineText({ teile }: { teile: Inline[] }) {
  return (
    <>
      {teile.map((t, i) => {
        if (typeof t === "string") return t;
        if (!istErlaubterVerweis(t.href)) return t.text;
        return (
          <a
            key={i}
            href={t.href}
            className="text-accent underline underline-offset-2 hover:text-accent-strong"
          >
            {t.text}
          </a>
        );
      })}
    </>
  );
}

function BlockText({ block }: { block: Block }) {
  if (block.art === "absatz") {
    return (
      <p className="text-[15px] leading-relaxed text-ink">
        <InlineText teile={block.inhalt} />
      </p>
    );
  }
  if (block.art === "liste") {
    return (
      <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink">
        {block.punkte.map((p, i) => (
          <li key={i}>
            <InlineText teile={p} />
          </li>
        ))}
      </ul>
    );
  }
  // Anschriften: die Zeilen gehoeren zusammen und werden nicht zu einem Absatz
  // verschmolzen.
  return (
    <p className="text-[15px] leading-relaxed text-ink">
      {block.zeilen.map((z, i) => (
        <span key={i} className="block">
          <InlineText teile={z} />
        </span>
      ))}
    </p>
  );
}

/**
 * Der Entwurfshinweis.
 *
 * `role="note"` statt `alert`: Die Seite laesst sich lesen, hier passiert nichts
 * Dringendes — aber es ist eine Anmerkung zum ganzen Dokument, und ein Test
 * haengt daran, dass sie ohne Interaktion sichtbar ist.
 *
 * Die Punkte kommen aus dem Dokument, nicht von hier: ein Kasten, der ueberall
 * dasselbe sagt, wird nach dem zweiten Mal nicht mehr gelesen.
 */
function Entwurfshinweis({ punkte }: { punkte: string[] }) {
  return (
    <aside
      role="note"
      className="mt-6 border-l-4 border-warning bg-canvas px-4 py-4 text-[15px] leading-relaxed text-ink"
    >
      <p className="font-semibold">Vorläufige Fassung — noch nicht abschließend geprüft.</p>
      <p className="mt-1 text-muted">
        Dieser Text wird derzeit überarbeitet. Folgende Punkte sind offen:
      </p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
        {punkte.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </aside>
  );
}

export default function LegalPage({ dokument }: { dokument: Rechtsdokument }) {
  // Aus den Metadaten: die drei anderen Volltexte sollen fuer eine
  // Verweiszeile nicht mitgeladen werden.
  const andere = rechtsseiten.filter((d) => d.slug !== dokument.slug);

  return (
    <main className="mx-auto w-full max-w-[760px] min-w-0 px-4 py-10 sm:px-6">
      <Link to="/" className="inline-flex" aria-label="Zur Startseite">
        <Logo lockup="full" />
      </Link>

      {/* `break-words hyphens-auto`: „Datenschutzerklärung" und
          „Geschäftsbedingungen" passen bei 320 px nicht in eine Zeile und
          brechen von sich aus nicht. Im Browser gemessen — die Überschrift lief
          um 13 bzw. 19 px über, und auf /agb schob die Seite seitlich
          (323 px Dokumentbreite bei 320 px Fenster). `jsdom` rechnet kein
          Layout und sah davon nichts. Silbentrennung greift, weil
          <html lang="de"> gesetzt ist; `break-words` ist der Notnagel. */}
      <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight break-words hyphens-auto text-ink">
        {dokument.titel}
      </h1>
      <p className="mt-1 text-sm text-muted">Stand: {dokument.stand}</p>

      {dokument.provisorisch && <Entwurfshinweis punkte={dokument.offenePunkte} />}

      <div className="mt-8 space-y-7">
        {dokument.abschnitte.map((a, i) => (
          <section key={i} className="space-y-3">
            {a.titel && (
              <h2 className="font-display text-lg font-semibold text-ink-strong">{a.titel}</h2>
            )}
            {a.bloecke.map((b, j) => (
              <BlockText key={j} block={b} />
            ))}
          </section>
        ))}
      </div>

      {/* Der Widerruf zur Video-Freigabe (AGE-621) steht NEBEN dem Dokument,
          nicht darin: `content/legal/types.ts` begründet, warum das
          Inhaltsmodell genau drei Blockarten hat, und ein Knopf ist kein
          Fließtext. Nur auf der Datenschutzseite, weil der Text dort auf ihn
          verweist — die Fläche unter jedem Video nennt genau diesen Ort. */}
      {dokument.slug === "datenschutz" && <VideoFreigabeWiderruf />}

      <hr className="mt-12 border-line" />

      {/* Herkunft. Ohne diese Angabe laesst sich spaeter nicht mehr pruefen,
          gegen welche Fassung der Text abgeglichen wurde. */}
      <p className="mt-6 text-xs text-muted">Quelle des Textes: {dokument.quelle}</p>

      <nav
        aria-label="Weitere Rechtsseiten"
        className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm"
      >
        {andere.map((d) => (
          <Link key={d.slug} to={`/${d.slug}`} className="text-muted hover:text-ink">
            {d.titel}
          </Link>
        ))}
        {/* Statischer Link, kein history.back() — das bricht beim Direktaufruf
            aus einer E-Mail. */}
        <Link to="/" className="text-muted hover:text-ink">
          Zurück zur Startseite
        </Link>
      </nav>
    </main>
  );
}
