import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FilterSpalte } from "../components/ui/FilterSpalte";
import { PageSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/toast-context";
import {
  adminFeedbackQueryKey,
  deleteFeedbackScreenshot,
  feedbackScreenshotKey,
  feedbackThemenQueryKey,
  fetchAdminFeedback,
  fetchFeedbackThemen,
  FEEDBACK_SEITENGROESSE,
  LEERER_FEEDBACK_FILTER,
  oeffneAdminGespraech,
  signFeedbackScreenshot,
  type AdminFeedbackRow,
  type FeedbackFilter,
} from "../lib/feedback";
import { useAuth } from "../providers/auth-context";

/**
 * QM-Feedback als eigene Verwaltungsfläche (AGE-358, hierher verlegt mit AGE-587,
 * Filter/Bild/Rückfrage AGE-628).
 *
 * WARUM EINE SEITE UND NICHT WEITER EINE KARTE:
 * Die Karte auf `/admin` holte JEDE Feedback-Zeile auf einmal — sie war die
 * letzte listende Fläche ohne Blätterung. Eine Karte, die unbegrenzt wächst,
 * verdrängt ausserdem die Einstellungen, neben denen sie stand.
 *
 * SEIT AGE-628 NICHT MEHR NUR ZUM LESEN, aber eng: der Admin darf das Bild
 * einer Zeile entfernen und ein Gespräch mit dem Verfasser eröffnen. Die
 * Feedback-ZEILE selbst bleibt unantastbar — es gibt weiterhin keinen Weg, sie
 * zu ändern oder zu löschen.
 *
 * Kein eigenes Rollen-Gate: die Seite hängt hinter `RequireAdmin`, und die
 * echte Grenze ist ohnehin `is_admin()` im Rumpf von `admin_list_feedback`.
 */
const BEWERTUNGEN = [5, 4, 3, 2, 1] as const;

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-xs text-muted">ohne Bewertung</span>;
  return (
    <span className="text-accent-strong">
      <span aria-hidden="true">
        {"★".repeat(rating)}
        {"☆".repeat(5 - rating)}
      </span>
      <span className="sr-only">{rating} von 5 Sternen</span>
    </span>
  );
}

/**
 * Das Bild wird ERST BEIM ANZEIGEN signiert, nicht beim Laden der Liste: eine
 * Seite mit fünfundzwanzig Zeilen stellte sonst fünfundzwanzig Signaturen aus,
 * von denen die meisten niemand ansieht.
 */
function Screenshot({ pfad }: { pfad: string }) {
  const { data, isError } = useQuery({
    queryKey: feedbackScreenshotKey(pfad),
    queryFn: () => signFeedbackScreenshot(pfad),
  });

  // Ein Fehler bekommt eine eigene Meldung. „Kein Bild" und „das Bild lässt
  // sich nicht anzeigen" sind zwei verschiedene Auskünfte.
  if (isError) return <p className="mt-2 text-sm text-danger">Bild nicht abrufbar.</p>;
  if (!data) return null;
  return (
    <a href={data} target="_blank" rel="noreferrer" className="mt-2 block w-fit">
      <img
        src={data}
        alt="Screenshot zur Rückmeldung"
        className="max-h-48 rounded-md border border-line"
      />
    </a>
  );
}

function FeedbackItem({
  row,
  eigeneProfilId,
  themaLabel,
}: {
  row: AdminFeedbackRow;
  eigeneProfilId: string | null;
  themaLabel: (key: string) => string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [laeuft, setLaeuft] = useState(false);

  const date = new Date(row.created_at).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Am EIGENEN Feedback gibt es nichts zu besprechen, und ein Selbstgespräch
  // weist der Öffnungs-Weg ohnehin mit 22023 ab. Beim Verfasser ohne Zugang
  // liesse sich der Faden zwar anlegen, aber nur der Admin könnte darin
  // schreiben. Beides mit GRUND, nicht wortlos: ein Knopf, der kommentarlos
  // fehlt, sieht aus wie ein Fehler der Fläche.
  const eigenes = eigeneProfilId !== null && row.profile_id === eigeneProfilId;
  const grundOhneGespraech = eigenes
    ? "Das ist deine eigene Rückmeldung."
    : !row.author_aktiv
      ? "Der Verfasser hat keinen Zugang mehr und könnte nicht antworten."
      : null;

  async function oeffnen() {
    setLaeuft(true);
    try {
      const threadId = await oeffneAdminGespraech(row.profile_id);
      navigate(`/chat/${threadId}`);
    } catch {
      toast({ title: "Das Gespräch konnte nicht geöffnet werden." });
      setLaeuft(false);
    }
  }

  async function bildEntfernen() {
    setLaeuft(true);
    try {
      await deleteFeedbackScreenshot(row.id);
      // Die ganze Liste neu holen, nicht die Zeile im Zwischenspeicher
      // zurechtbiegen: der Verweis liegt in der Datenbank, und eine von Hand
      // geänderte Kopie wäre eine zweite Wahrheit.
      await queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      toast({ title: "Bild entfernt." });
    } catch {
      toast({ title: "Das Bild konnte nicht entfernt werden." });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <li className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <Stars rating={row.rating} />
        <span className="text-xs text-muted">{date}</span>
      </div>

      <p className="mt-1 text-xs text-muted">{themaLabel(row.theme)}</p>

      <dl className="mt-1 space-y-0.5 text-sm">
        {row.likes && (
          <div>
            <dt className="inline text-muted">Gefällt: </dt>
            <dd className="inline text-ink">{row.likes}</dd>
          </div>
        )}
        {row.misses && (
          <div>
            <dt className="inline text-muted">Fehlt: </dt>
            <dd className="inline text-ink">{row.misses}</dd>
          </div>
        )}
        {row.idea && (
          <div>
            <dt className="inline text-muted">Idee: </dt>
            <dd className="inline text-ink">{row.idea}</dd>
          </div>
        )}
      </dl>

      {row.screenshot_path && (
        <>
          <Screenshot pfad={row.screenshot_path} />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={laeuft}
            onClick={() => void bildEntfernen()}
          >
            Bild entfernen
          </Button>
        </>
      )}

      <p className="mt-1 text-xs text-muted">
        {/* Der Verfasser führt auf SEINE Verwaltungsseite. Genau dafür gibt die
            RPC seit AGE-587 `profile_id` heraus: die Zeile soll verknüpfbar
            sein und nicht nur lesbar. Auf `/admin/mitglied/:id` und nicht auf
            `/p/:id` — die öffentliche Sicht verlangt ein bestätigtes
            Zielprofil, und ein unbestätigtes Mitglied kann Feedback schreiben. */}
        <Link to={`/admin/mitglied/${row.profile_id}`} className="hover:text-ink hover:underline">
          {row.author_name}
        </Link>
        {row.route ? ` · ${row.route}` : ""}
      </p>

      {grundOhneGespraech ? (
        <p className="mt-2 text-xs text-muted">{grundOhneGespraech}</p>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="mt-2"
          disabled={laeuft}
          onClick={() => void oeffnen()}
        >
          Gespräch öffnen
        </Button>
      )}
    </li>
  );
}

function Filter({
  filter,
  setzeFilter,
  themen,
  themaLabel,
}: {
  filter: FeedbackFilter;
  setzeFilter: (f: FeedbackFilter) => void;
  themen: string[];
  themaLabel: (key: string) => string;
}) {
  function schalteThema(key: string) {
    setzeFilter({
      ...filter,
      themen: filter.themen.includes(key)
        ? filter.themen.filter((t) => t !== key)
        : [...filter.themen, key],
    });
  }

  function schalteBewertung(n: number) {
    setzeFilter({
      ...filter,
      bewertungen: filter.bewertungen.includes(n)
        ? filter.bewertungen.filter((b) => b !== n)
        : [...filter.bewertungen, n],
    });
  }

  return (
    <div className="space-y-4">
      {/* Die Themen kommen aus der Datenbank; ohne sie rendert die Karte
          nicht. Ein Kästchen-Block ohne Kästchen sähe aus wie ein Fehler. */}
      {themen.length > 0 && (
        <Card className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-ink">Thema</h2>
          <ul className="space-y-1.5">
            {themen.map((key) => (
              <li key={key}>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={filter.themen.includes(key)}
                    onChange={() => schalteThema(key)}
                    className="size-4 rounded border-line text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  />
                  <span className="min-w-0 flex-1 truncate">{themaLabel(key)}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="font-display text-sm font-semibold text-ink">Bewertung</h2>
        <ul className="space-y-1.5">
          {BEWERTUNGEN.map((n) => (
            <li key={n}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={filter.bewertungen.includes(n)}
                  onChange={() => schalteBewertung(n)}
                  className="size-4 rounded border-line text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                />
                {/* Bewusst NICHT „n von 5 Sternen": genau so heisst der
                    Vorlesetext an jeder Zeile, und zwei Stellen mit demselben
                    zugänglichen Namen sind per Sprache nicht mehr
                    unterscheidbar. */}
                <span>{n === 1 ? "1 Stern" : `${n} Sterne`}</span>
              </label>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export default function AdminFeedbackPage() {
  const { user } = useAuth();
  const [seite, setSeite] = useState(0);
  const [filter, setFilterZustand] = useState<FeedbackFilter>(LEERER_FEEDBACK_FILTER);

  /**
   * Jeder Filterwechsel setzt auf Seite 1 zurück (Aufgabe 6.4). Ohne das stünde
   * jemand auf Seite 3, engte ein und sähe „nichts gefunden" — obwohl die
   * Auswahl zwei Treffer auf Seite 1 hat.
   */
  function setzeFilter(f: FeedbackFilter) {
    setFilterZustand(f);
    setSeite(0);
  }

  const { data: themen = [] } = useQuery({
    queryKey: feedbackThemenQueryKey,
    queryFn: fetchFeedbackThemen,
  });
  // Die Beschriftung kommt aus der Datenbank. Fehlt sie (weil die Liste noch
  // lädt), steht der Schlüssel da — er sagt immer noch mehr als nichts.
  const themaLabel = (key: string) => themen.find((t) => t.key === key)?.label ?? key;

  const { data, isLoading, isError } = useQuery({
    queryKey: adminFeedbackQueryKey(seite, filter),
    queryFn: () => fetchAdminFeedback(seite, filter),
  });

  const zeilen = data?.feedbacks ?? [];
  const von = seite * FEEDBACK_SEITENGROESSE + 1;
  const gefiltert = filter.themen.length > 0 || filter.bewertungen.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-ink">QM-Feedback</h1>
        <p className="text-sm text-muted">Was Mitglieder über die Plattform zurückmelden.</p>
      </header>

      <FilterSpalte
        id="admin-feedback-filter"
        anfangsOffen={gefiltert}
        hinweisWennZu={gefiltert ? "Ein Filter ist aktiv." : undefined}
        filter={
          <Filter
            filter={filter}
            setzeFilter={setzeFilter}
            themen={themen.map((t) => t.key)}
            themaLabel={themaLabel}
          />
        }
      >
        <Card className="flex flex-col gap-3">
          {isLoading && <PageSkeleton />}
          {/* Ein Fehler bekommt eine EIGENE Meldung. Der Leerzustand behauptet
              „es gibt kein Feedback" — das weiss ein gescheiterter Aufruf gerade
              nicht, und „leer" hat hier ohnehin schon eine zweite Ursache (ein
              Nicht-Admin bekommt null Zeilen). Eine dritte, stumme braucht es
              nicht. */}
          {isError && <p className="text-sm text-danger">Feedback konnte nicht geladen werden.</p>}
          {/* Und der gefilterte Leerzustand ist noch einmal etwas anderes:
              „es gibt nichts" wäre hier schlicht falsch. */}
          {!isLoading && !isError && zeilen.length === 0 && (
            <p className="text-sm text-muted">
              {gefiltert ? "Zu dieser Auswahl liegt nichts vor." : "Noch kein Feedback."}
            </p>
          )}
          {!isLoading && !isError && zeilen.length > 0 && (
            <>
              <ul className="flex flex-col gap-3">
                {zeilen.map((row) => (
                  <FeedbackItem
                    key={row.id}
                    row={row}
                    eigeneProfilId={user?.id ?? null}
                    themaLabel={themaLabel}
                  />
                ))}
              </ul>

              <div className="flex items-center justify-between gap-4 border-t border-line pt-3">
                <p className="text-sm text-muted">{`Rückmeldungen ${von}–${von + zeilen.length - 1}`}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={seite === 0}
                    onClick={() => setSeite((s) => Math.max(0, s - 1))}
                  >
                    Zurück
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!data?.hatWeitere}
                    onClick={() => setSeite((s) => s + 1)}
                  >
                    Weiter
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </FilterSpalte>
    </div>
  );
}
