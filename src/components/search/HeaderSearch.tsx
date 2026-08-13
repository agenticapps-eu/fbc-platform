import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar } from "../ui/Avatar";
import { useOverlay } from "../ui/useOverlay";
import { LEVEL_RANK, levelLabel } from "../../config/levels";
import { useAuth } from "../../providers/auth-context";
import {
  directoryUrlForQuery,
  HEADER_SEARCH_MIN_CHARS,
  headerSearchKeyPrefix,
  headerSearchQueryKey,
  searchMembersForHeader,
  type DirectoryMember,
} from "../../lib/directory";

/**
 * Suche in der Kopfzeile (AGE-540) — ein zweiter EINSTIEG in die vorhandene
 * Verzeichnissuche, keine eigene Fähigkeit. Dieselbe RPC (`search_directory`),
 * dieselbe RLS, dieselben Zeilen.
 *
 * Vier Dinge, die hier nicht offensichtlich sind und im Plan-Review gefunden
 * wurden:
 *
 * 1. **Ausgeloggt entsteht die Komponente gar nicht.** `search_directory` ist
 *    für `anon` nicht ausführbar; jede Eingabe liefe in `42501`. Der Rahmen
 *    rendert sie nur im angemeldeten Zweig, und der Rückfall hier ist die
 *    zweite Verteidigungslinie, nicht die erste.
 * 2. **Der Rang formuliert NUR den leeren Fall.** Er unterdrückt keine Abfrage
 *    und verbirgt keinen Treffer — die Policy gibt einem Konto unterhalb
 *    `discover` die EIGENE Zeile zurück, und die ist ein gültiger Treffer. Ein
 *    Rang, der Ergebnisse ausblendet, wäre eine zweite Zugriffskontrolle im
 *    Frontend und damit Kulisse vor einem Gate, das schon hält.
 * 3. **Ein Fehler ist kein Nulltreffer.** Netzausfall, abgelaufene Sitzung und
 *    `42501` würden sonst als „nichts gefunden" oder — schlimmer — als
 *    „Aufstieg nötig" erscheinen: ein Anmeldefehler, verkleidet als
 *    Verkaufsargument. Die stufenabhängige Formulierung greift deshalb erst
 *    NACH einer erfolgreichen, leeren Antwort.
 * 4. **Enter unterhalb `discover` führt NICHT ins Verzeichnis.** `/mitglieder`
 *    liegt hinter `MembershipGate min="discover"` (`nav.ts`, `App.tsx`); dort
 *    mountet `MemberDirectory` nie und der Begriff verschwände hinter einer
 *    Wand.
 */

const DISCOVER_RANK = LEVEL_RANK.discover;
const ENTPRELLUNG_MS = 300;

export default function HeaderSearch() {
  const { user, levelRank } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [roh, setRoh] = useState("");
  const [entprellt, setEntprellt] = useState("");
  const [aktiv, setAktiv] = useState(-1);
  // Offen-Zustände tragen den Schlüssel der Location, bei der sie geöffnet
  // wurden — nicht `true`/`false`. Damit schließen beide beim Navigieren von
  // selbst, ohne Effekt: der Rahmen wird beim Navigieren nicht abgebaut, und
  // eine Liste, die über der Zielseite stehen bleibt, ist der Fehler, den das
  // verhindert. Ein Effekt, der auf `location.key` hört und `setState` ruft,
  // täte dasselbe — löste aber eine zusätzliche Renderrunde aus.
  const [offenBei, setOffenBei] = useState<string | null>(null);
  const [mobilBei, setMobilBei] = useState<string | null>(null);

  const rahmen = useRef<HTMLDivElement>(null);
  const feld = useRef<HTMLInputElement>(null);
  const lupe = useRef<HTMLButtonElement>(null);
  const listenId = useId();
  // Sperre und Tab-Falle kommen aus dem gemeinsamen Hook (AGE-529). Was er
  // NICHT mitbringt — Anfangsfokus und Escape — steht weiter unten; das war ein
  // Befund des Plan-Reviews und keine Vermutung.
  const mobilOffen = mobilBei === location.key;
  const overlay = useOverlay<HTMLDivElement>(mobilOffen);

  const begriff = roh.trim();
  const langGenug = begriff.length >= HEADER_SEARCH_MIN_CHARS;
  const reichtStufe = (levelRank ?? 0) >= DISCOVER_RANK;

  useEffect(() => {
    const id = setTimeout(() => setEntprellt(begriff), ENTPRELLUNG_MS);
    return () => clearTimeout(id);
  }, [begriff]);

  const treffer = useQuery({
    queryKey: headerSearchQueryKey(user?.id ?? "", entprellt),
    queryFn: () => searchMembersForHeader(entprellt),
    enabled: !!user && entprellt.length >= HEADER_SEARCH_MIN_CHARS,
  });

  // Beim Wechsel der Identität werden die Ergebnisse ENTFERNT, nicht nur
  // entwertet — und die Eingabe geht mit.
  //
  // Der Schlüssel trägt die Kontenkennung, ein zweites Konto sähe die Zeilen des
  // ersten also ohnehin nicht. Das allein genügt aber nicht: die Treffer sind
  // RLS-gefiltert und gehören einem beendeten Konto; sie sollen nicht im
  // Speicher liegen bleiben. Auf den Abbau der Komponente zu bauen wäre zu
  // schwach — bei einem Sitzungsablauf bleibt sie gemountet und rendert nur
  // `null`.
  const vorigeKennung = useRef(user?.id ?? null);
  useEffect(() => {
    const jetzt = user?.id ?? null;
    if (vorigeKennung.current === jetzt) return;
    vorigeKennung.current = jetzt;
    queryClient.removeQueries({ queryKey: headerSearchKeyPrefix });
    setRoh("");
    setEntprellt("");
    setAktiv(-1);
  }, [user?.id, queryClient]);

  useEffect(
    () => () => {
      queryClient.removeQueries({ queryKey: headerSearchKeyPrefix });
    },
    [queryClient],
  );

  // Solange roher und entprellter Text auseinanderlaufen, gehören die Treffer zu
  // einem Begriff, der nicht mehr im Feld steht. Sie stehen zu lassen hieße:
  // Enter öffnet ein Mitglied, das zur Eingabe nicht passt.
  const aktuell = langGenug && entprellt === begriff;
  const liste: DirectoryMember[] = aktuell && treffer.data ? treffer.data : [];

  // Die Hervorhebung wird ABGELEITET, nicht per Effekt zurückgesetzt: ein Index
  // außerhalb der aktuellen Liste ist keine Hervorhebung. Das deckt beide Fälle
  // ab, die sonst je einen Effekt gebraucht hätten — neue Trefferliste und
  // veraltete Treffer während der Entprellung.
  const aktivGueltig = aktiv >= 0 && aktiv < liste.length ? aktiv : -1;

  // Anfangsfokus der Telefon-Fassung. Ein Overlay, das aufgeht und den Fokus
  // stehen lässt, zwingt zu einem zusätzlichen Tipp aufs Feld.
  useEffect(() => {
    if (mobilOffen) feld.current?.focus();
  }, [mobilOffen]);

  // Beim Verbreitern über die Umbruchbreite schließen.
  //
  // Ohne das versteckt CSS die Fassung (`sm:hidden`), während die Scroll-Sperre
  // des Overlays stehen bleibt: eine Seite, die sich nicht mehr scrollen lässt
  // und kein sichtbares Overlay hat. Gehängt an `resize` und `innerWidth` statt
  // an `matchMedia`, weil das der Weg ist, den ein Test wirklich auslösen kann —
  // 640px ist Tailwinds `sm`.
  useEffect(() => {
    if (!mobilOffen) return;
    function beiGroesse() {
      if (window.innerWidth >= 640) setMobilBei(null);
    }
    window.addEventListener("resize", beiGroesse);
    return () => window.removeEventListener("resize", beiGroesse);
  }, [mobilOffen]);

  useEffect(() => {
    if (offenBei === null) return;
    function aufKlick(e: MouseEvent) {
      // `mousedown` am Dokument, aber die Prüfung geht über den Rahmen: ein
      // Klick AUF eine Option liegt innerhalb und schließt daher nicht, bevor
      // die Auswahl ankommt.
      if (!rahmen.current?.contains(e.target as Node)) setOffenBei(null);
    }
    document.addEventListener("mousedown", aufKlick);
    return () => document.removeEventListener("mousedown", aufKlick);
  }, [offenBei]);

  if (!user) return null;

  const offen =
    offenBei === location.key &&
    aktuell &&
    (treffer.isFetching || treffer.isSuccess || treffer.isError);

  function schliessen() {
    setOffenBei(null);
    setAktiv(-1);
  }

  function oeffneProfil(id: string) {
    schliessen();
    navigate(`/p/${id}`);
  }

  function alleErgebnisse() {
    if (!begriff) return;
    schliessen();
    navigate(reichtStufe ? directoryUrlForQuery(begriff) : "/mitgliedschaft");
  }

  function schliesseMobil() {
    setMobilBei(null);
    schliessen();
    lupe.current?.focus();
  }

  function aufTaste(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      // Erst die Trefferliste, dann die Fassung. Beides auf einen Druck zu
      // schließen nähme dem Nutzer den Zwischenschritt, in dem er seine Eingabe
      // noch sieht.
      if (offen) {
        schliessen();
        feld.current?.focus();
      } else if (mobilOffen) {
        schliesseMobil();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAktiv((i) => Math.min(i + 1, liste.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktiv((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const gewaehlt = aktivGueltig >= 0 ? liste[aktivGueltig] : undefined;
      if (gewaehlt) oeffneProfil(gewaehlt.id);
      else alleErgebnisse();
    }
  }

  // EIN Kombifeld, das entweder eingebettet oder in der Telefon-Fassung steht —
  // nie beides. Zweimal gerendert lägen zwei Comboboxen mit denselben Kennungen
  // im Dokument; CSS würde eine davon verbergen, für Hilfstechnik und für jeden
  // Test wären es aber zwei.
  const kombifeld = (
    <>
      <label className="relative block">
        <span className="sr-only">Suche nach Mitgliedern</span>
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
          <SearchIcon />
        </span>
        <input
          ref={feld}
          type="search"
          role="combobox"
          aria-expanded={offen}
          aria-controls={listenId}
          aria-autocomplete="list"
          aria-activedescendant={aktivGueltig >= 0 ? optionId(listenId, aktivGueltig) : undefined}
          value={roh}
          onChange={(e) => {
            setRoh(e.target.value);
            // Tippen öffnet wieder — sonst bliebe die Liste nach einem Escape zu.
            setOffenBei(location.key);
            setAktiv(-1);
          }}
          onKeyDown={aufTaste}
          placeholder="Mitglieder suchen…"
          className="h-10 w-full rounded-full border border-line bg-soft pl-9 pr-4 text-sm text-ink transition-colors placeholder:text-muted/70 focus-visible:border-accent focus-visible:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        />
      </label>

      {offen && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas shadow-soft">
          <Ergebnisse
            listenId={listenId}
            liste={liste}
            aktiv={aktivGueltig}
            istFehler={treffer.isError}
            laedt={treffer.isFetching && !treffer.data}
            reichtStufe={reichtStufe}
            onWaehlen={oeffneProfil}
            onAlle={alleErgebnisse}
          />
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Eingebettet ab `sm`. Beim Öffnen der Telefon-Fassung entfällt es ganz,
          statt nur per CSS zu verschwinden — siehe Kommentar am Kombifeld. */}
      {!mobilOffen && (
        <div ref={rahmen} className="relative mx-auto hidden w-full max-w-md sm:block">
          {kombifeld}
        </div>
      )}

      <button
        ref={lupe}
        type="button"
        aria-label="Suche öffnen"
        onClick={() => setMobilBei(location.key)}
        className="rounded-full p-2 text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:hidden"
      >
        <SearchIcon />
      </button>

      {mobilOffen && (
        <div
          className="fixed inset-0 z-40 bg-ink/25 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) schliesseMobil();
          }}
        >
          <div
            ref={overlay}
            className="relative mx-auto w-full max-w-md rounded-[var(--radius-card)] bg-canvas p-3 shadow-soft"
          >
            <div className="flex items-center gap-2">
              {/* `relative` sitzt hier BEWUSST nicht: sonst bezieht die
                  Trefferliste ihr `left-0 right-0` auf das Eingabefeld, das
                  neben „Abbrechen" nur noch die halbe Blattbreite hat — bei
                  320 px gemessen 165 px, und die Namen brachen mitten im Wort
                  ab („Beatrice So…"), während rechts 126 px frei blieben. Am
                  Blatt bezogen nutzt sie dessen volle Breite. Die Liste bleibt
                  dabei ein DOM-Kind dieses Rahmens — der Klick-außerhalb-Test
                  in Zeile 158 prüft Verschachtelung, nicht Positionierung. */}
              <div ref={rahmen} className="min-w-0 flex-1">
                {kombifeld}
              </div>
              <button
                type="button"
                onClick={schliesseMobil}
                className="shrink-0 rounded-md px-2 py-1 text-sm text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const optionId = (listenId: string, i: number) => `${listenId}-option-${i}`;

function Ergebnisse({
  listenId,
  liste,
  aktiv,
  istFehler,
  laedt,
  reichtStufe,
  onWaehlen,
  onAlle,
}: {
  listenId: string;
  liste: DirectoryMember[];
  aktiv: number;
  istFehler: boolean;
  laedt: boolean;
  reichtStufe: boolean;
  onWaehlen: (id: string) => void;
  onAlle: () => void;
}) {
  // Die Reihenfolge dieser Zweige IST die Anforderung: der Fehler steht vor
  // jeder Aussage über Treffer, und die stufenabhängige Formulierung kommt erst
  // nach einer erfolgreichen, leeren Antwort.
  if (istFehler) {
    return (
      <p className="px-4 py-5 text-sm text-muted">
        Suche nicht möglich. Bitte später noch einmal versuchen.
      </p>
    );
  }
  if (laedt) {
    return <p className="px-4 py-5 text-sm text-muted">Wird gesucht…</p>;
  }
  if (liste.length === 0) {
    return reichtStufe ? (
      <div className="px-4 py-5 text-center">
        <p className="text-sm text-muted">Kein Mitglied gefunden.</p>
        <button
          type="button"
          onClick={onAlle}
          className="mt-2 text-sm font-medium text-accent-strong hover:underline"
        >
          Im Verzeichnis weitersuchen
        </button>
      </div>
    ) : (
      <div className="px-4 py-5 text-center">
        <p className="text-sm text-muted">
          Das Mitgliederverzeichnis ist ab {levelLabel("discover")} verfügbar.
        </p>
        <button
          type="button"
          onClick={onAlle}
          className="mt-2 text-sm font-medium text-accent-strong hover:underline"
        >
          Mitgliedschaft ansehen
        </button>
      </div>
    );
  }

  return (
    <>
      <ul
        id={listenId}
        role="listbox"
        aria-label="Gefundene Mitglieder"
        className="max-h-80 overflow-y-auto"
      >
        {liste.map((m, i) => (
          <li
            key={m.id}
            id={optionId(listenId, i)}
            role="option"
            aria-selected={i === aktiv}
            onClick={() => onWaehlen(m.id)}
            className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
              i === aktiv ? "bg-ink/[0.06]" : "hover:bg-ink/[0.03]"
            }`}
          >
            <Avatar name={m.name ?? ""} src={m.avatar_url} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{m.name}</span>
              <span className="block truncate text-xs text-muted">{einordnung(m)}</span>
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAlle}
        className="block w-full border-t border-line px-4 py-2 text-center text-sm font-medium text-accent-strong hover:bg-ink/[0.03]"
      >
        Alle Ergebnisse im Verzeichnis
      </button>
    </>
  );
}

/**
 * Die zweite Zeile einer Trefferkarte.
 *
 * Es gibt **kein Feld für eine Berufsbezeichnung** im Rückgabetyp von
 * `search_directory` — eine zu verlangen hieße, sie zu erfinden. Gebildet wird
 * sie deshalb aus dem, was wirklich da ist, in dieser Reihenfolge.
 */
function einordnung(m: DirectoryMember): string {
  const teile = [m.roles?.[0], m.company, m.branche].filter(Boolean) as string[];
  return teile.length > 0 ? teile.join(" · ") : (m.short_bio ?? "");
}

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
