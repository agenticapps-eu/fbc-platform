import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../../providers/auth-context";
import { bildUrl } from "../../lib/bild-url";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Input } from "../ui/Input";
import { Stagger, StaggerItem } from "../ui/Motion";
import { Select } from "../ui/Select";
import { cn } from "../../lib/cn";
import { levelLabel } from "../../config/levels";
import {
  deriveFacets,
  DIRECTORY_QUERY_PARAM,
  directoryFacetsQueryKey,
  directoryQueryKey,
  emptyDirectoryFilters,
  fetchDirectoryBaseline,
  hasActiveFilters,
  hasAdvancedFilters,
  NEED_CATEGORY_OPTIONS,
  OFFER_CATEGORY_OPTIONS,
  OFFERING_OPTIONS,
  searchDirectory,
  THEME_OPTIONS,
  type DirectoryFilters,
  contactsKeyPrefix,
  contactsQueryKey,
  fetchContactIds,
  type DirectoryMember,
} from "../../lib/directory";

/**
 * Mitgliederverzeichnis (AGE-241). Durchsuchbare Profilkarten mit
 * Filtern (Thema · Branche · Region · Kompetenz · sucht/bietet). Suche + Filter laufen
 * serverseitig über die RPC `search_directory`. Die RLS ist die Sichtbarkeitsgrenze —
 * Discover/anon erhalten höchstens die eigene Zeile (siehe lib/directory.ts).
 */
export default function MemberDirectory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  /** Der von der Kopfzeilen-Suche übergebene Begriff (AGE-540). */
  const urlQuery = searchParams.get(DIRECTORY_QUERY_PARAM) ?? "";

  // BEIM AUFBAU synchron aus der Adresszeile — beides, Eingabe UND Filter.
  // Den Filter erst per Effekt nachzureichen wäre der teure Fehler: dazwischen
  // liefe eine Trefferabfrage über das GANZE Verzeichnis, die aufblitzt und im
  // Zwischenspeicher landet. Belegt im Test „läuft beim Aufbau mit Parameter
  // nie mit leerer Suche los".
  const [filters, setFilters] = useState<DirectoryFilters>(() =>
    urlQuery ? { ...emptyDirectoryFilters, query: urlQuery } : emptyDirectoryFilters,
  );
  const [queryInput, setQueryInput] = useState(urlQuery);

  // Suchtext entkoppelt vom Filterzustand und entprellt (300 ms), damit nicht jeder
  // Tastendruck eine Server-Abfrage auslöst. Selects greifen sofort.
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((prev) => (prev.query === queryInput ? prev : { ...prev, query: queryInput }));
    }, 300);
    return () => clearTimeout(id);
  }, [queryInput]);

  // SPÄTERE Navigationen ziehen nur die EINGABE nach; den Weg zum Filterzustand
  // geht weiterhin allein die Entprellung oben. Zwei Wege dorthin könnten
  // einander umgehen.
  //
  // Die Bedingung hängt am `key` der Location, nicht am Wert des Parameters:
  // Wird derselbe Begriff erneut abgeschickt, NACHDEM hier lokal weitergetippt
  // wurde, ändert sich der Wert nicht — das Ereignis aber schon, und die
  // Suche muss trotzdem auf den abgeschickten Begriff zurückspringen. Ein
  // Vergleich auf den Wert ließe den Fall stillschweigend liegen.
  //
  // Der Startwert des Ref ist der Schlüssel des ersten Aufbaus, damit dieser
  // Effekt beim Mounten NICHT feuert — dort hat der Zustand den Begriff schon.
  const letzteNavigation = useRef(location.key);
  useEffect(() => {
    if (letzteNavigation.current === location.key) return;
    letzteNavigation.current = location.key;
    setQueryInput(urlQuery);
  }, [location.key, urlQuery]);

  // Baseline (ungefiltert) → stabile Facetten-Optionen für die Dropdowns.
  const facetsQuery = useQuery({
    queryKey: directoryFacetsQueryKey,
    queryFn: fetchDirectoryBaseline,
    staleTime: Infinity,
  });
  const facets = useMemo(() => deriveFacets(facetsQuery.data ?? []), [facetsQuery.data]);

  const results = useQuery({
    queryKey: directoryQueryKey(filters),
    queryFn: () => searchDirectory(filters),
  });

  // ── Die zwei Reiter (AGE-595) ─────────────────────────────────────────────
  //
  // Der Reiter ist ein ORT, kein Vorgang: beide stehen immer da, auch mit einer
  // Null. Das ist ausdrücklich die andere Entscheidung als beim bedingten
  // Navigationseintrag für offene Anfragen (AGE-592) — ein Ort, der erscheint
  // und verschwindet, macht die Navigation unvorhersehbar.
  //
  // Der Reiter steht NEBEN Suche und Filter, nicht darüber: ein Wechsel ändert
  // die Grundmenge, nicht die Frage an sie. Deshalb liegt er auch nicht im
  // Filterzustand und setzt ihn nicht zurück.
  const [reiter, setReiter] = useState<"alle" | "kontakte">("alle");

  const { user } = useAuth();
  const uid = user?.id ?? null;
  const contacts = useQuery({
    queryKey: contactsQueryKey(uid ?? ""),
    queryFn: () => fetchContactIds(uid!),
    enabled: uid !== null,
  });
  const contactIds = useMemo(() => new Set(contacts.data ?? []), [contacts.data]);

  // Der Schlüssel trägt die Kennung, ein zweites Konto sähe die Zeilen des
  // ersten also ohnehin nicht. Das allein genügt aber nicht: die Menge ist
  // RLS-gefiltert und gehört einem beendeten Konto, sie soll nicht im Speicher
  // liegen bleiben. Auf den Abbau der Komponente zu bauen wäre zu schwach — bei
  // einem Sitzungsablauf bleibt sie gemountet. Dieselbe Vorkehrung wie in
  // `HeaderSearch`, und aus demselben Grund.
  const queryClient = useQueryClient();
  const vorigeKennung = useRef(uid);
  useEffect(() => {
    if (vorigeKennung.current === uid) return;
    vorigeKennung.current = uid;
    queryClient.removeQueries({ queryKey: contactsKeyPrefix });
    setReiter("alle");
  }, [uid, queryClient]);

  const active = hasActiveFilters(filters);
  /**
   * Die erweiterte Suche ist zugeklappt, bis jemand sie öffnet.
   *
   * Anfangswert `active` und nicht `false`: kommt man über einen Link mit
   * gesetzten Filtern hierher, stünde sonst eine gefilterte Liste ohne ein
   * einziges sichtbares Filterfeld da.
   */
  const [erweitert, setErweitert] = useState(() => hasAdvancedFilters(filters));
  // `useMemo` und nicht `results.data ?? []`: der Kurzschluss erzeugt bei jedem
  // Rendern ein NEUES leeres Array, und die beiden Schnitte darunter liefen
  // dann jedes Mal neu. Kein Fehler, aber eine unnötige Runde je Tastendruck.
  const members = useMemo(() => results.data ?? [], [results.data]);

  // Der Schnitt zweier Mengen, zweimal — und der Unterschied trägt zwei der
  // fünf Zustände:
  //
  //   * gegen die GEFILTERTE Liste entsteht, was der Reiter zeigt, und daraus
  //     kommt sein Zähler. Eine Zahl aus einer anderen Quelle als ihre Liste
  //     wäre eine zweite Wahrheit.
  //   * gegen die UNGEFILTERTE Baseline (die es für die Facetten ohnehin gibt)
  //     entsteht die Antwort auf „hat dieses Mitglied überhaupt einen im
  //     Verzeichnis sichtbaren Kontakt". Ohne sie fielen „keiner ist sichtbar"
  //     und „der Filter schliesst alle aus" zusammen, und der eine Hinweis
  //     stünde an der Stelle des anderen.
  const kontakte = useMemo(
    () => members.filter((m) => contactIds.has(m.id)),
    [members, contactIds],
  );
  const sichtbareKontakteUngefiltert = useMemo(
    () => (facetsQuery.data ?? []).filter((m) => contactIds.has(m.id)),
    [facetsQuery.data, contactIds],
  );

  // Ein Zähler erscheint erst, wenn seine Menge WIRKLICH feststeht. Eine Null,
  // die gleich zu einer Sieben wird, ist eine falsche Aussage und kein
  // Ladezustand — und eine Null nach einem Fehlschlag behauptet einen Bestand,
  // den niemand gemessen hat (die Lehre aus AGE-582).
  const zahlAlle = results.isLoading || results.isError ? null : members.length;
  const kontakteBereit =
    !results.isLoading && !results.isError && !contacts.isLoading && !contacts.isError;
  const zahlKontakte = kontakteBereit ? kontakte.length : null;

  function setFilter<K extends keyof DirectoryFilters>(key: K, value: DirectoryFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleCategory(key: "offers" | "needs", value: string) {
    setFilters((prev) => {
      const current = prev[key];
      return {
        ...prev,
        [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  }

  function reset() {
    setQueryInput("");
    setFilters(emptyDirectoryFilters);
    // Der Begriff steht seit AGE-540 auch in der Adresszeile. Bliebe er dort,
    // brächte ein Neuladen — oder ein geteilter Link — genau die Suche zurück,
    // die gerade zurückgesetzt wurde (Befund des Code-Reviews).
    //
    // Das widerspricht dem „einen Schreiber" nicht: die Regel gilt dem TIPPEN,
    // das bewusst nicht in die Adresszeile zurückschreibt. Zurücksetzen ist eine
    // ausdrückliche Handlung. `replace`, damit der Zurück-Weg nicht auf einer
    // leeren Suche stehen bleibt, die niemand aufgerufen hat.
    if (urlQuery) setSearchParams({}, { replace: true });
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">Verzeichnis</h2>
        <p className="text-sm text-muted">
          Mitglieder durchsuchen und filtern. Ein Klick öffnet das öffentliche Profil.
        </p>
      </header>

      <div className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-canvas p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <Input
            type="search"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Suche nach Name, Firma, Kompetenz …"
            aria-label="Volltextsuche im Verzeichnis"
          />
        </div>

        {/* Der Standard ist EINE Zeile. Fünf Auswahlfelder und zwölf Chips
            beim ersten Blick sind ein Formular, keine Suche — und die
            allermeisten Wege gehen über den Namen (AGE-566).

            Die Zeile darunter ist nicht bloss ein Schalter: sie sagt auch,
            wenn eingeklappt gefiltert wird. Ein aktiver, aber unsichtbarer
            Filter erklärt sonst eine kurze Trefferliste nicht — und das ist
            genau die Verwechslung, die „keine Treffer" hier schon einmal
            erzeugt hat. */}
        <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={() => setErweitert((v) => !v)}
            aria-expanded={erweitert}
            className="rounded-md text-sm font-medium text-accent-strong underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {erweitert ? "Erweiterte Suche schließen" : "Erweiterte Suche"}
          </button>
          {!erweitert && hasAdvancedFilters(filters) && (
            <span className="text-sm text-muted">Erweiterte Filter sind aktiv.</span>
          )}
        </div>

        {erweitert && (
          <>
            <FilterSelect
              label="Thema"
              value={filters.theme}
              onChange={(v) => setFilter("theme", v)}
              allLabel="Alle Themen"
              options={THEME_OPTIONS.map((t) => ({ value: t.value, label: t.label }))}
            />
            <FilterSelect
              label="Branche"
              value={filters.branche}
              onChange={(v) => setFilter("branche", v)}
              allLabel="Alle Branchen"
              options={facets.branchen.map((b) => ({ value: b, label: b }))}
            />
            <FilterSelect
              label="Region"
              value={filters.region}
              onChange={(v) => setFilter("region", v)}
              allLabel="Alle Regionen"
              options={facets.regionen.map((r) => ({ value: r, label: r }))}
            />
            <FilterSelect
              label="Kompetenz"
              value={filters.competency}
              onChange={(v) => setFilter("competency", v)}
              allLabel="Alle Kompetenzen"
              options={facets.kompetenzen.map((c) => ({ value: c, label: c }))}
            />
            <FilterSelect
              label="Sucht / bietet"
              value={filters.offering}
              onChange={(v) => setFilter("offering", v as DirectoryFilters["offering"])}
              allLabel="Egal"
              options={OFFERING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />

            {/* AGE-494: Der Kompass hat keine eigene Seite mehr — er wirkt hier. Zwei
            Gruppen, Mehrfachauswahl: ODER innerhalb einer Gruppe, UND zwischen
            beiden. Sechs Optionen je Seite, nicht elf: die Elf aus dem Issue ist
            die Vereinigung, `immobilien` steht in beiden. */}
            <div className="sm:col-span-2 lg:col-span-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
              <ChipFilterGroup
                label="Bietet"
                options={OFFER_CATEGORY_OPTIONS}
                selected={filters.offers}
                onToggle={(v) => toggleCategory("offers", v)}
              />
              <ChipFilterGroup
                label="Sucht"
                options={NEED_CATEGORY_OPTIONS}
                selected={filters.needs}
                onToggle={(v) => toggleCategory("needs", v)}
              />
            </div>
          </>
        )}

        {active && (
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={reset}>
              Filter zurücksetzen
            </Button>
          </div>
        )}
      </div>

      <div className="border-b border-line">
        <div role="tablist" aria-label="Verzeichnis" className="flex gap-6 overflow-x-auto">
          {(
            [
              { id: "alle", label: "Alle Mitglieder", zahl: zahlAlle },
              { id: "kontakte", label: "Meine Kontakte", zahl: zahlKontakte },
            ] as const
          ).map((r) => {
            const gewaehlt = r.id === reiter;
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={gewaehlt}
                onClick={() => setReiter(r.id)}
                className={
                  "border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap transition-colors " +
                  (gewaehlt
                    ? "border-accent text-accent-strong"
                    : "border-transparent text-muted hover:text-ink")
                }
              >
                {r.label}
                {/* `aria-hidden`, und das ist der Punkt: der zugängliche NAME des
                    Reiters bleibt seine Beschriftung. Stünde die Zahl darin,
                    läse eine Vorleseausgabe „Meine Kontakte 2" als Bezeichnung
                    eines Bedienelements vor — und der Name änderte sich bei
                    jeder angenommenen Anfrage. Dasselbe Muster wie in der
                    Admin-Mitgliederliste. */}
                {r.zahl !== null && (
                  <span
                    aria-hidden="true"
                    className={
                      "ml-1.5 text-xs tabular-nums " +
                      (gewaehlt ? "text-accent-strong" : "text-muted")
                    }
                  >
                    {r.zahl}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel">
        {reiter === "alle" ? (
          <DirectoryResults
            isLoading={results.isLoading}
            isError={results.isError}
            members={members}
            active={active}
            onReset={reset}
          />
        ) : (
          <KontakteResults
            isLoading={results.isLoading || contacts.isLoading}
            isError={results.isError}
            kontaktabfrageGescheitert={contacts.isError}
            hatKontakte={contactIds.size > 0}
            hatSichtbareKontakte={sichtbareKontakteUngefiltert.length > 0}
            members={kontakte}
            onReset={reset}
          />
        )}
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

/** Eine Filtergruppe als Chips. Mehrfachauswahl, kein „alle"-Zustand nötig:
 *  keine Auswahl heißt kein Filter. */
function ChipFilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none",
                on
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line text-muted hover:border-accent/60 hover:text-ink",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Der Reiter „Meine Kontakte" (AGE-595).
 *
 * Eine eigene Komponente und keine Fahne an `DirectoryResults`, weil sich nicht
 * ein Text unterscheidet, sondern die ZAHL der Zustände: das Verzeichnis kennt
 * drei (lädt · Fehler · leer), der Kontaktreiter fünf. Sie in eine Komponente
 * zu falten hiesse, jede ihrer Verzweigungen um eine Bedingung zu erweitern,
 * die für die andere Hälfte der Aufrufe nie zutrifft.
 *
 * Die fünf sind ausdrücklich NICHT zu „leer" zusammenzufassen. Der wichtigste
 * ist der zweite: `undefined` als leere Menge zu lesen macht aus einem
 * Fehlschlag eine beruhigende Null.
 */
function KontakteResults({
  isLoading,
  isError,
  kontaktabfrageGescheitert,
  hatKontakte,
  hatSichtbareKontakte,
  members,
  onReset,
}: {
  isLoading: boolean;
  isError: boolean;
  kontaktabfrageGescheitert: boolean;
  hatKontakte: boolean;
  hatSichtbareKontakte: boolean;
  members: DirectoryMember[];
  onReset: () => void;
}) {
  // 1. Es läuft noch. Vor jeder Aussage über den Bestand.
  if (isLoading) {
    return <p className="text-sm text-muted">Deine Kontakte werden geladen…</p>;
  }
  // 2. Die KONTAKTabfrage ist gescheitert — nicht „keine Kontakte". Zuerst
  //    geprüft, weil ein Fehlschlag jede Aussage darunter wertlos macht:
  //    `contactIds` wäre leer, und die Einladung aus 3 stünde vor jemandem, der
  //    womöglich zwanzig Kontakte hat.
  if (kontaktabfrageGescheitert) {
    return (
      <p className="text-sm text-danger">
        Deine Kontakte konnten nicht geladen werden. Bitte neu laden.
      </p>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-danger">
        Das Verzeichnis konnte nicht geladen werden. Bitte neu laden.
      </p>
    );
  }
  // 3. Wirklich keine Kontakte — der Normalzustand eines neuen Mitglieds und
  //    ausdrücklich keine Fehlermeldung.
  if (!hatKontakte) {
    return (
      <EmptyState
        title="Knüpf die erste Verbindung"
        description="Sobald eine Kontaktanfrage angenommen ist, findest du das Mitglied hier wieder — mit Kontaktdaten und Chat."
        action={
          <Link to="/mitglieder">
            <Button variant="primary" size="sm">
              Im Verzeichnis stöbern
            </Button>
          </Link>
        }
      />
    );
  }
  // 4. Kontakte ja, sichtbare Karten nein. Die Einladung aus 3 wäre hier
  //    schlicht falsch: dieses Mitglied HAT Kontakte. Sichtbarkeit im
  //    Verzeichnis (`is_public`, Rang, Aktivierung) und der Status der
  //    Kontaktanfrage sind voneinander unabhängig — die Kante ist real.
  if (!hatSichtbareKontakte) {
    return (
      <EmptyState
        title="Deine Kontakte sind im Verzeichnis nicht sichtbar"
        description="Du hast angenommene Kontakte, aber keiner von ihnen erscheint gerade im Verzeichnis — etwa, weil das Profil auf privat steht. Über deine Nachrichten erreichst du sie trotzdem."
        action={
          <Link to="/nachrichten">
            <Button variant="secondary" size="sm">
              Zu den Nachrichten
            </Button>
          </Link>
        }
      />
    );
  }
  // 5. Sichtbare Kontakte gibt es, nur passt keiner zum Filter. Ein Ausweg,
  //    keine Sackgasse.
  if (members.length === 0) {
    return (
      <EmptyState
        title="Dazu passt keiner deiner Kontakte"
        description={'Diese Kombination aus Suche und Filtern trifft auf keinen deiner Kontakte. Nimm einen Filter weg \u2014 oder wechsle zu \u201eAlle Mitglieder\u201c.'}
        action={
          <Button variant="secondary" size="sm" onClick={onReset}>
            Filter zurücksetzen
          </Button>
        }
      />
    );
  }

  return (
    <>
      <p className="text-sm text-muted">
        {members.length} {members.length === 1 ? "Kontakt" : "Kontakte"}
      </p>
      <Stagger className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <StaggerItem key={m.id} className="h-full">
            <MemberCard member={m} />
          </StaggerItem>
        ))}
      </Stagger>
    </>
  );
}

function DirectoryResults({
  isLoading,
  isError,
  members,
  active,
  onReset,
}: {
  isLoading: boolean;
  isError: boolean;
  members: DirectoryMember[];
  active: boolean;
  onReset: () => void;
}) {
  if (isLoading) {
    return <p className="text-sm text-muted">Verzeichnis wird geladen…</p>;
  }
  if (isError) {
    return (
      <p className="text-sm text-danger">
        Das Verzeichnis konnte nicht geladen werden. Bitte neu laden.
      </p>
    );
  }
  if (members.length === 0) {
    return (
      /* AGE-494: Zwei verschiedene Zustände, die nie zusammenfallen dürfen — „die
         Filter passen auf niemanden" ist etwas anderes als „hier ist noch
         niemand". Der erste ist eine Sackgasse mit Ausweg, der zweite eine
         Einladung, selbst den Anfang zu machen. */
      <EmptyState
        title={active ? "Dazu passt gerade niemand" : "Die ersten Profile entstehen"}
        description={
          active
            ? "Diese Kombination aus Suche und Filtern trifft auf kein Mitglied. Nimm einen Filter weg — oft reicht schon eine Kategorie weniger."
            : "Der Club füllt sich gerade. Bis dahin lohnt sich dein eigenes Profil: wer seine Kategorien pflegt, wird von den anderen zuerst gefunden."
        }
        action={
          active ? (
            <Button variant="secondary" size="sm" onClick={onReset}>
              Filter zurücksetzen
            </Button>
          ) : (
            <Link to="/profil/bearbeiten">
              <Button variant="primary" size="sm">
                Mein Profil ergänzen
              </Button>
            </Link>
          )
        }
      />
    );
  }

  return (
    <>
      <p className="text-sm text-muted">
        {members.length} {members.length === 1 ? "Mitglied" : "Mitglieder"}
      </p>
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <StaggerItem key={m.id} className="h-full">
            <MemberCard member={m} />
          </StaggerItem>
        ))}
      </Stagger>
    </>
  );
}

/**
 * Die Verzeichniskarte. EXPORTIERT seit AGE-566, damit die Admin-Fläche sie
 * speisen kann statt sie nachzubauen — ein Nachbau wäre eine zweite Stelle, an
 * der dieselbe Darstellung gepflegt werden müsste, und die Admin-Ansicht wäre
 * dann gerade nicht mehr „was Mitglieder sehen", sondern etwas, das ihm ähnelt.
 *
 * `to` ist der Preis dafür: die Karte verdrahtete ihr Ziel fest auf `/p/:id`.
 * Für ein unbestätigtes Mitglied — den Anlassfall der Admin-Fläche — meldet
 * diese Seite „nicht gefunden", weil `profiles_public` ein bestätigtes
 * ZIELPROFIL verlangt. Ohne den Prop führte die Admin-Ansicht also genau dort
 * in eine Sackgasse, wo man sie braucht.
 *
 * Die Vorgabe bleibt `/p/:id`, und ein Regressionstest sichert zu, dass das
 * öffentliche Verzeichnis weiter dorthin zeigt.
 */
export function MemberCard({ member, to }: { member: DirectoryMember; to?: string }) {
  const name = member.name ?? "Mitglied";
  const subtitle = (member.roles ?? []).filter(Boolean).join(" · ");
  const meta = [member.region, member.company].filter(Boolean).join(" · ");
  // `?? null` und nicht direkt: zwischen Merge und `db push` antwortet die alte
  // Signatur ohne `cover_url`, und `bildUrl` bekäme `undefined`. Derselbe
  // Deploy-Fall, an dem AGE-494 die Mitgliederseite schon einmal weiß gemacht hat.
  const cover = bildUrl("covers", member.cover_url ?? null);

  return (
    <Link
      to={to ?? `/p/${member.id}`}
      className="block h-full rounded-[var(--radius-card)] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-soft focus-visible:outline-none"
    >
      <Card className="flex h-full flex-col overflow-hidden p-0 transition-shadow hover:shadow-[0_1px_2px_rgba(20,21,26,0.06),0_20px_48px_-24px_rgba(20,21,26,0.35)]">
        {/* AGE-595: das Hintergrundbild des Profils, randlos über der Karte.
            Gebaut wie `EventCover` und aus demselben Grund:

            Das Feld steht IMMER da, auch ohne Bild. Sonst wäre eine Karte mit
            Cover höher als ihre Nachbarn und das Raster franste bei gemischtem
            Bestand aus — und gemischt ist es, 55 von 74 Mitgliedern tragen eines.

            `object-contain`, nicht `-cover`: gemessen streuen die Cover im
            Bucket um einen Median von 2,70:1, nur zwei sind wirklich 3:1. Unter
            `cover` fiele bei jedem übrigen etwas weg, das jemand hochgeladen
            hat, weil er es zeigen wollte.

            Der Verlauf liegt VOR dem Bild im Baum: beide sind `absolute` und
            unter gleichem z-index entscheidet die Reihenfolge. Umgestellt malte
            er das Bild zu. */}
        <div data-testid="karten-cover" className="relative aspect-[3/1] overflow-hidden bg-soft">
          <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-soft to-line" />
          {cover && (
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-contain" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
        {/* AGE-450: Das Tier-Label stand rechts in der Namenszeile und schnitt lange
            Namen ab (Screenshot Detlev). Jetzt unter dem Namen — der bekommt die
            volle Breite und truncatet erst am Kartenrand. */}
        <div className="flex items-start gap-3">
          <Avatar name={name} src={member.avatar_url} size="lg" className="ring-1 ring-accent/40" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg font-semibold text-ink">{name}</h3>
            {subtitle && <p className="truncate text-sm text-accent-strong">{subtitle}</p>}
            {meta && <p className="mt-0.5 truncate text-xs text-muted">{meta}</p>}
            {member.tier && (
              <span className="mt-1.5 inline-flex items-center rounded-full border border-accent/60 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-accent-strong uppercase">
                {levelLabel(member.tier)}
              </span>
            )}
          </div>
        </div>

        {member.short_bio && (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted">{member.short_bio}</p>
        )}

        {/* AGE-595: die vier Kompass-Zweige sind hier weg — beide `map`-Läufe
            über die Kategorien und beide pauschalen Marken. Übrig bleibt die
            Branche, die einordnet statt aufzuzählen.

            Das nimmt AGE-494 NUR an dieser Stelle zurück. `offer_categories`
            und `need_categories` bleiben trotzdem im Rückgabesatz der RPC:
            eine Änderung an der Darstellung darf keine Datenschicht mitreißen,
            und ihre Entfernung wäre eine dritte Signaturänderung an derselben
            Funktion für einen Nutzen, den niemand hat. */}
        {member.branche && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            <Badge variant="neutral">{member.branche}</Badge>
          </div>
        )}
        </div>
      </Card>
    </Link>
  );
}
