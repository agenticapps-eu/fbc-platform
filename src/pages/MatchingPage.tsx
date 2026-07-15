import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CategoryIcon } from "../components/matching/CategoryIcon";
import { FormatHero } from "../components/ui/FormatHero";
import { FORMAT_HERO } from "../config/formatHero";
import { CountUp, Stagger, StaggerItem } from "../components/ui/Motion";
import { useDesignVariantValue } from "../providers/design-variant-context";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Select } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import { TierBadge } from "../components/ui/TierBadge";
import { useToast } from "../components/ui/toast-context";
import {
  MATCHING_THEMES,
  NEED_CATEGORIES,
  OFFER_CATEGORIES,
  categoryLabel,
  findCategory,
  type MatchingSide,
} from "../config/matching";
import { sendContactRequest } from "../lib/contact-requests";
import { dashboardQueryKey } from "../lib/dashboard";
import {
  complementarityReasons,
  emptyHubFilters,
  fetchMatchingHub,
  filterMatches,
  hasActiveHubFilters,
  matchingHubQueryKey,
  secondaryReasons,
  type HubFilters,
  type HubMatch,
  type HubOffering,
  type HubStats,
  type MatchBasis,
} from "../lib/matching-hub";
import { recomputeMyMatches } from "../lib/matches";
import { useAuth } from "../providers/auth-context";

const MIN_SCORE_OPTIONS = [
  { value: 0, label: "Jeder Score" },
  { value: 60, label: "Ab 60 %" },
  { value: 75, label: "Ab 75 %" },
  { value: 90, label: "Ab 90 %" },
];

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unbekannter Fehler.";
}

/** Postgres-Unique-Verletzung (23505) — hier: es besteht bereits eine Anfrage für
 *  das Paar (z. B. zweiter Tab oder noch nicht refetchte Liste). */
function isUniqueViolation(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: unknown }).code === "23505"
  );
}

export default function MatchingPage() {
  const { user } = useAuth();
  // /matching ist Prime+-gegated — user ist hier vorhanden; defensiver Fallback.
  if (!user) return null;
  return <MatchingHub uid={user.id} />;
}

function MatchingHub({ uid }: { uid: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filters, setFilters] = useState<HubFilters>(emptyHubFilters);

  const { data, isLoading, isError } = useQuery({
    queryKey: matchingHubQueryKey(uid),
    queryFn: () => fetchMatchingHub(uid),
  });

  const recompute = useMutation({
    mutationFn: recomputeMyMatches,
    onSuccess: (count) => {
      toast({
        variant: "success",
        title: "Matches neu berechnet",
        description: `${count} ${count === 1 ? "Match" : "Matches"} aktualisiert.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "error",
        title: "Neuberechnung fehlgeschlagen",
        description: errorMessage(error),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: matchingHubQueryKey(uid) });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey(uid) });
    },
  });

  const visible = useMemo(
    () => (data ? filterMatches(data.matches, filters) : []),
    [data, filters],
  );

  return (
    <div className="flex flex-col gap-6">
      <FormatHero meta={FORMAT_HERO["/matching"]} />

      <HubHeader
        stats={data?.stats}
        onRecompute={() => recompute.mutate()}
        recomputing={recompute.isPending}
      />

      {isLoading ? (
        <p className="text-sm text-muted">Matches werden geladen…</p>
      ) : isError || !data ? (
        <p className="text-sm text-danger">
          Matches konnten nicht geladen werden. Bitte neu laden.
        </p>
      ) : data.matches.length === 0 ? (
        <EmptyMatches onRecompute={() => recompute.mutate()} recomputing={recompute.isPending} />
      ) : (
        <>
          <FilterBar
            filters={filters}
            regions={data.regions}
            onChange={setFilters}
            resultCount={visible.length}
            totalCount={data.matches.length}
          />
          {visible.length === 0 ? (
            <EmptyState
              title="Keine Treffer für diese Filter"
              description="Lockere die Filter, um mehr deiner Matches zu sehen."
              action={
                <Button variant="ghost" size="sm" onClick={() => setFilters(emptyHubFilters)}>
                  Filter zurücksetzen
                </Button>
              }
            />
          ) : (
            <Stagger className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {visible.map((match) => (
                <StaggerItem key={match.id} className="h-full">
                  <MatchCard uid={uid} match={match} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </>
      )}
    </div>
  );
}

// ── Kennzahlen-Kopf (§5) ──────────────────────────────────────────────────────
function HubHeader({
  stats,
  onRecompute,
  recomputing,
}: {
  stats: HubStats | undefined;
  onRecompute: () => void;
  recomputing: boolean;
}) {
  return (
    <header className="fbc-hero-shimmer overflow-hidden rounded-[var(--radius-card)] border border-gold/30 bg-[linear-gradient(120deg,var(--color-soft),var(--color-gold-soft))] shadow-soft">
      <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:p-8">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Deine Chancen-Datenbank
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-ink/70">
            Komplementäre Partner mit Score und Begründung. Such- &amp; Bieteprofile stehen im
            Vordergrund — nicht der Name.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onRecompute} disabled={recomputing}>
          {recomputing ? "Berechne…" : "Matches neu berechnen"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-px border-t border-gold/25 bg-gold/25">
        <StatTile label="Aktive Matches" value={stats?.active ?? 0} />
        <StatTile label="Erfolgreiche" value={stats?.successful ?? 0} />
        <StatTile label="Ø-Score" value={stats ? `${stats.avgScore} %` : "—"} />
      </div>
    </header>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-canvas px-4 py-4">
      <div className="text-xs font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-ink">
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </div>
    </div>
  );
}

// ── Filter (§5) ───────────────────────────────────────────────────────────────
function FilterBar({
  filters,
  regions,
  onChange,
  resultCount,
  totalCount,
}: {
  filters: HubFilters;
  regions: string[];
  onChange: (f: HubFilters) => void;
  resultCount: number;
  totalCount: number;
}) {
  const set = (patch: Partial<HubFilters>) => onChange({ ...filters, ...patch });

  return (
    <Card className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterField label="Thema">
          <Select value={filters.theme} onChange={(e) => set({ theme: e.target.value })}>
            <option value="">Alle Themen</option>
            {MATCHING_THEMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="Kategorie (Suche/Biete)">
          <Select value={filters.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">Alle Kategorien</option>
            <optgroup label="Bietet">
              {OFFER_CATEGORIES.map((c) => (
                <option key={c.key} value={`offer:${c.key}`}>
                  {c.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Sucht">
              {NEED_CATEGORIES.map((c) => (
                <option key={c.key} value={`need:${c.key}`}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          </Select>
        </FilterField>

        <FilterField label="Region">
          <Select
            value={filters.region}
            onChange={(e) => set({ region: e.target.value })}
            disabled={regions.length === 0}
          >
            <option value="">Alle Regionen</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </FilterField>

        <FilterField label="Mindest-Score">
          <Select
            value={String(filters.minScore)}
            onChange={(e) => set({ minScore: Number(e.target.value) })}
          >
            {MIN_SCORE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FilterField>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>
          {resultCount} von {totalCount} {totalCount === 1 ? "Match" : "Matches"}
        </span>
        {hasActiveHubFilters(filters) && (
          <button
            type="button"
            onClick={() => onChange(emptyHubFilters)}
            className="font-medium text-gold-strong hover:text-gold"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>
    </Card>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

// ── Match-Karte (§5) ──────────────────────────────────────────────────────────
function MatchCard({ uid, match }: { uid: string; match: HubMatch }) {
  const { partner } = match;
  const comp = complementarityReasons(match.basis);
  const secondary = secondaryReasons(match.basis, partner);

  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-start gap-4">
        <Avatar name={partner.name} src={partner.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-ink">{partner.name}</h3>
            {partner.tier && <TierBadge tier={partner.tier} />}
            {match.routing === "dkri" && (
              <Badge variant="strong" title="Großvolumen → DKRI Deal-Keeping">
                DKRI
              </Badge>
            )}
          </div>
          <p className="truncate text-sm text-muted">
            {[partner.company, partner.region].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <ScoreBadge score={match.score} />
      </div>

      {(comp.length > 0 || secondary.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {comp.map((text) => (
            <Badge key={text} variant="soft">
              {text}
            </Badge>
          ))}
          {secondary.map((text) => (
            <Badge key={text} variant="neutral">
              {text}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <OfferingList title="Bietet" side="offer" items={partner.offers} empty="Keine Angebote." />
        <OfferingList title="Sucht" side="need" items={partner.needs} empty="Keine Gesuche." />
      </div>

      {match.basis && <WhyDetails basis={match.basis} />}

      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <ContactAction uid={uid} match={match} />
        <Link to={`/p/${partner.id}`} className="ml-auto">
          <Button variant="ghost" size="sm">
            Profil ansehen
          </Button>
        </Link>
      </div>
    </Card>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <div className="shrink-0 text-right">
      <CountUp
        value={score}
        format={(n) => `${Math.round(n)}%`}
        className="font-display text-3xl font-semibold text-gold-strong"
      />
      <div className="text-[10px] font-medium tracking-wide text-muted uppercase">Match-Score</div>
    </div>
  );
}

function OfferingList({
  title,
  side,
  items,
  empty,
}: {
  title: string;
  side: MatchingSide;
  items: HubOffering[];
  empty: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold tracking-wide text-gold-strong uppercase">{title}</div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {items.map((item) => {
            const cat = findCategory(side, item.category);
            return (
              <li
                key={item.id}
                className="flex items-center gap-2.5 rounded-lg border border-line bg-soft p-2.5"
                title={`${categoryLabel(side, item.category)} · ${item.title}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gold-soft text-gold-strong">
                  {cat ? (
                    <CategoryIcon icon={cat.icon} className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-semibold">
                      {item.title.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                  {item.category && (
                    <p className="truncate text-xs text-muted">
                      {categoryLabel(side, item.category)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** „Warum dieses Match?" — transparente Aufschlüsselung der gewichteten Faktoren. */
function WhyDetails({ basis }: { basis: MatchBasis }) {
  const { preset } = useDesignVariantValue();
  return (
    <details className="group rounded-lg border border-line bg-soft px-3 py-2">
      <summary className="cursor-pointer list-none text-xs font-medium text-gold-strong marker:content-none">
        Warum dieses Match? <span className="text-muted group-open:hidden">▾</span>
        <span className="hidden text-muted group-open:inline">▴</span>
      </summary>
      <ul className="mt-3 flex flex-col gap-2" aria-label="Aufschlüsselung des Match-Scores">
        {basis.components.map((c) => {
          const pct = c.weight > 0 ? Math.min(100, Math.round((c.points / c.weight) * 100)) : 0;
          return (
            <li key={c.key} title={c.detail}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-muted">{c.label}</span>
                <span className="font-medium text-ink tabular-nums">
                  {c.points}
                  <span className="text-muted">/{c.weight}</span>
                </span>
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-line">
                <motion.div
                  className="h-full rounded-full bg-gold"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: preset.duration, ease: preset.ease }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

// ── Kontaktanfrage senden (Sender-Seite, §6.1; Rest = AGE-247) ────────────────
function ContactAction({ uid, match }: { uid: string; match: HubMatch }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      sendContactRequest({
        fromId: uid,
        toId: match.partner.id,
        matchId: match.id,
        message,
      }),
    onSuccess: () => {
      setOpen(false);
      setMessage("");
      toast({
        variant: "success",
        title: "Kontaktanfrage gesendet",
        description: `${match.partner.name} entscheidet über deine Anfrage. Kontaktdaten werden erst nach Annahme sichtbar.`,
      });
      queryClient.invalidateQueries({ queryKey: matchingHubQueryKey(uid) });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey(uid) });
    },
    onError: (error) => {
      // Anfrage besteht bereits → kein „Fehler", sondern Liste war veraltet:
      // freundlich melden, Composer schließen und neu laden (Karte zeigt Status).
      if (isUniqueViolation(error)) {
        setOpen(false);
        setMessage("");
        toast({
          variant: "success",
          title: "Anfrage besteht bereits",
          description: `Es gibt schon eine Kontaktanfrage mit ${match.partner.name}.`,
        });
        queryClient.invalidateQueries({ queryKey: matchingHubQueryKey(uid) });
        return;
      }
      toast({
        variant: "error",
        title: "Anfrage fehlgeschlagen",
        description: errorMessage(error),
      });
    },
  });

  // Doppelklick-Schutz: mutate() ist fire-and-forget, das disabled-Prop greift erst
  // nach dem Re-Render. Inline gegen isPending wachen, damit kein zweiter INSERT geht.
  const submit = () => {
    if (mutation.isPending) return;
    mutation.mutate();
  };

  // Bestehende Anfrage → Status statt Senden-Button.
  const cr = match.contactRequest;
  if (cr) {
    if (cr.status === "accepted") return <Badge variant="strong">Kontakt freigegeben</Badge>;
    if (cr.status === "declined")
      return <span className="text-sm text-muted">Anfrage abgelehnt</span>;
    // pending
    return cr.outgoing ? (
      <Badge variant="soft">Anfrage gesendet</Badge>
    ) : (
      <Badge variant="soft">Hat dich angefragt</Badge>
    );
  }

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        Kontaktanfrage senden
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Textarea
        rows={3}
        autoFocus
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={`Kurze Nachricht an ${match.partner.name} (optional)…`}
      />
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? "Senden…" : "Anfrage senden"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
          disabled={mutation.isPending}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

// ── Leerzustand ───────────────────────────────────────────────────────────────
function EmptyMatches({
  onRecompute,
  recomputing,
}: {
  onRecompute: () => void;
  recomputing: boolean;
}) {
  return (
    <EmptyState
      title="Noch keine Matches"
      description="Hinterlege, was du suchst und bietest — daraus entstehen komplementäre Vorschläge. Du kannst die Berechnung jederzeit anstoßen."
      icon={
        <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" aria-hidden="true">
          <circle cx="7" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="17" cy="16" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9.5 9.5l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      }
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/angebote-gesuche">
            <Button variant="primary" size="sm">
              Angebote &amp; Gesuche pflegen
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={onRecompute} disabled={recomputing}>
            {recomputing ? "Berechne…" : "Matches neu berechnen"}
          </Button>
        </div>
      }
    />
  );
}
