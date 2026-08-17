import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Input } from "../ui/Input";
import { Stagger, StaggerItem } from "../ui/Motion";
import { Select } from "../ui/Select";
import { cn } from "../../lib/cn";
import { categoryLabel } from "../../config/matching";
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

  const active = hasActiveFilters(filters);
  /**
   * Die erweiterte Suche ist zugeklappt, bis jemand sie öffnet.
   *
   * Anfangswert `active` und nicht `false`: kommt man über einen Link mit
   * gesetzten Filtern hierher, stünde sonst eine gefilterte Liste ohne ein
   * einziges sichtbares Filterfeld da.
   */
  const [erweitert, setErweitert] = useState(() => hasAdvancedFilters(filters));
  const members = results.data ?? [];

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

      <DirectoryResults
        isLoading={results.isLoading}
        isError={results.isError}
        members={members}
        active={active}
        onReset={reset}
      />
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

  return (
    <Link
      to={to ?? `/p/${member.id}`}
      className="block h-full rounded-[var(--radius-card)] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-soft focus-visible:outline-none"
    >
      <Card className="flex h-full flex-col gap-4 p-5 transition-shadow hover:shadow-[0_1px_2px_rgba(20,21,26,0.06),0_20px_48px_-24px_rgba(20,21,26,0.35)]">
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

        {/* AGE-494: Statt der pauschalen „Bietet"/„Sucht"-Marken die Kategorien
            selbst — das war der Punkt der RPC-Erweiterung.
            Zwei Rückfälle, aus zwei verschiedenen Gründen:
            1. Der Typ verspricht hier ein Array, die alte RPC liefert das Feld gar
               nicht. Beim Merge geht das Frontend automatisch live, die Migration
               erreicht Prod nur per manuellem `supabase db push` — dazwischen
               antwortet die alte Signatur, und ein `.length` auf `undefined`
               macht die Mitgliederseite weiß. Deshalb `?? []`.
            2. Eine Zeile ohne `category` setzt `has_offers`, taucht aber in keinem
               Array auf — dafür bleiben die pauschalen Marken. */}
        {(() => {
          const offerCats = member.offer_categories ?? [];
          const needCats = member.need_categories ?? [];
          if (
            !member.branche &&
            offerCats.length === 0 &&
            needCats.length === 0 &&
            !member.has_offers &&
            !member.has_needs
          ) {
            return null;
          }
          return (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
              {member.branche && <Badge variant="neutral">{member.branche}</Badge>}
              {offerCats.map((c) => (
                <Badge key={`o-${c}`} variant="soft">
                  Bietet: {categoryLabel("offer", c)}
                </Badge>
              ))}
              {needCats.map((c) => (
                <Badge key={`n-${c}`} variant="soft">
                  Sucht: {categoryLabel("need", c)}
                </Badge>
              ))}
              {member.has_offers && offerCats.length === 0 && <Badge variant="soft">Bietet</Badge>}
              {member.has_needs && needCats.length === 0 && <Badge variant="soft">Sucht</Badge>}
            </div>
          );
        })()}
      </Card>
    </Link>
  );
}
