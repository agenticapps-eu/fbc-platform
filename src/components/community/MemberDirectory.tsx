import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { tierLabel } from "../../lib/tiers";
import {
  deriveFacets,
  directoryFacetsQueryKey,
  directoryQueryKey,
  emptyDirectoryFilters,
  fetchDirectoryBaseline,
  hasActiveFilters,
  OFFERING_OPTIONS,
  searchDirectory,
  THEME_OPTIONS,
  type DirectoryFilters,
  type DirectoryMember,
} from "../../lib/directory";

/**
 * Mitgliederverzeichnis (AGE-241). Durchsuchbare Profilkarten (Schwarz & Gold) mit
 * Filtern (Thema · Branche · Region · Kompetenz · sucht/bietet). Suche + Filter laufen
 * serverseitig über die RPC `search_directory`. Die RLS ist die Sichtbarkeitsgrenze —
 * Discover/anon erhalten höchstens die eigene Zeile (siehe lib/directory.ts).
 */
export default function MemberDirectory() {
  const [filters, setFilters] = useState<DirectoryFilters>(emptyDirectoryFilters);
  const [queryInput, setQueryInput] = useState("");

  // Suchtext entkoppelt vom Filterzustand und entprellt (300 ms), damit nicht jeder
  // Tastendruck eine Server-Abfrage auslöst. Selects greifen sofort.
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((prev) => (prev.query === queryInput ? prev : { ...prev, query: queryInput }));
    }, 300);
    return () => clearTimeout(id);
  }, [queryInput]);

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
  const members = results.data ?? [];

  function setFilter<K extends keyof DirectoryFilters>(key: K, value: DirectoryFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setQueryInput("");
    setFilters(emptyDirectoryFilters);
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
      <EmptyState
        title={active ? "Keine Treffer" : "Noch keine Mitglieder"}
        description={
          active
            ? "Für diese Kombination aus Suche und Filtern gibt es keine Mitglieder."
            : "Sobald Mitglieder sich vorstellen, erscheinen sie hier."
        }
        action={
          active ? (
            <Button variant="secondary" size="sm" onClick={onReset}>
              Filter zurücksetzen
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <p className="text-sm text-muted">
        {members.length} {members.length === 1 ? "Mitglied" : "Mitglieder"}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <li key={m.id}>
            <MemberCard member={m} />
          </li>
        ))}
      </ul>
    </>
  );
}

function MemberCard({ member }: { member: DirectoryMember }) {
  const name = member.name ?? "Mitglied";
  const subtitle = (member.roles ?? []).filter(Boolean).join(" · ");
  const meta = [member.region, member.company].filter(Boolean).join(" · ");

  return (
    <Link
      to={`/p/${member.id}`}
      className="block h-full rounded-[var(--radius-card)] focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-soft focus-visible:outline-none"
    >
      <Card className="flex h-full flex-col gap-4 p-5 transition-shadow hover:shadow-[0_1px_2px_rgba(20,21,26,0.06),0_20px_48px_-24px_rgba(20,21,26,0.35)]">
        <div className="flex items-start gap-3">
          <Avatar name={name} src={member.avatar_url} size="lg" className="ring-1 ring-gold/40" />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg font-semibold text-ink">{name}</h3>
            {subtitle && <p className="truncate text-sm text-gold-strong">{subtitle}</p>}
            {meta && <p className="mt-0.5 truncate text-xs text-muted">{meta}</p>}
          </div>
          {member.tier && (
            <span className="inline-flex shrink-0 items-center rounded-full border border-gold/60 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-gold-strong uppercase">
              {tierLabel(member.tier)}
            </span>
          )}
        </div>

        {member.short_bio && (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted">{member.short_bio}</p>
        )}

        {(member.branche || member.has_offers || member.has_needs) && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {member.branche && <Badge variant="neutral">{member.branche}</Badge>}
            {member.has_offers && <Badge variant="prime">Bietet</Badge>}
            {member.has_needs && <Badge variant="prime">Sucht</Badge>}
          </div>
        )}
      </Card>
    </Link>
  );
}
