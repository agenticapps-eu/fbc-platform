import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Card, CardTitle } from "../ui/Card";
import { useToast } from "../ui/toast-context";
import { CategoryIcon } from "../matching/CategoryIcon";
import {
  fetchIncomingRequests,
  incomingRequestsQueryKey,
  respondToContactRequest,
  type IncomingRequest,
} from "../../lib/contact-requests";
import { matchingHubQueryKey } from "../../lib/matching-hub";
import { dashboardQueryKey, type DashboardData } from "../../lib/dashboard";
import { categoryLabel, findCategory, type MatchingSide } from "../../config/matching";
import { CardLink, DashboardCard, DemoBadge } from "./building-blocks";

// ── Demo-Daten (profile-spec §5: DEMO-Widgets, in Phase 2 durch echte Daten ersetzt) ──
const DEMO_COMMUNITIES = [
  { name: "Unternehmer-Kreis Süd", members: 142 },
  { name: "Immobilien & Beteiligungen", members: 87 },
  { name: "Legacy Mastermind", members: 24 },
];
const DEMO_NETWORK = [
  { label: "Freunde", count: 24 },
  { label: "Preferred Partner", count: 8 },
  { label: "Mentoren", count: 3 },
  { label: "Mentees", count: 5 },
];

// ── Meine Anfragen (CORE, §6.2) — eingehende Kontaktanfragen mit Annehmen/Ablehnen ──
// Erscheint nur, wenn offene Anfragen vorliegen (ein Posteingang zeigt sich, wenn Post
// da ist). Annehmen/Ablehnen setzt nur `status` (RLS `cr_update_recipient`); alle
// Folgewirkungen (Match-Status, Thread, Benachrichtigung, Kontaktdaten-Freigabe)
// laufen serverseitig. Kontaktdaten werden hier NIEMALS angezeigt — erst nach Annahme
// auf der Profilseite des Gegenübers (RLS-gegated).
export function MeineAnfragenWidget({ uid }: { uid: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: incomingRequestsQueryKey(uid),
    queryFn: () => fetchIncomingRequests(uid),
  });

  // Leise sein, solange nichts anliegt — kein Leerzustand, der das Dashboard zumüllt.
  if (isLoading || isError || !data || data.length === 0) return null;

  return (
    <Card id="meine-anfragen" className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex items-center gap-2">
        <CardTitle className="text-base">Meine Anfragen</CardTitle>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-chrome">
          {data.length}
        </span>
      </div>
      <p className="text-sm text-muted">
        Erst nach deiner Annahme werden Kontaktdaten geteilt und der Chat freigeschaltet.
      </p>
      <ul className="flex flex-col gap-3">
        {data.map((request) => (
          <li key={request.id}>
            <AnfrageRow uid={uid} request={request} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AnfrageRow({ uid, request }: { uid: string; request: IncomingRequest }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();
  // Welche Aktion gerade läuft — sperrt beide Buttons, ohne sie zu vermischen.
  const [pending, setPending] = useState<null | "accept" | "decline">(null);

  const respond = useMutation({
    mutationFn: (accept: boolean) => respondToContactRequest({ requestId: request.id, accept }),
    onMutate: (accept) => setPending(accept ? "accept" : "decline"),
    onSuccess: (_data, accept) => {
      toast(
        accept
          ? {
              variant: "success",
              title: "Anfrage angenommen",
              description: `Kontaktdaten von ${request.from.name} sind sichtbar — der Chat ist offen.`,
            }
          : {
              variant: "success",
              title: "Anfrage abgelehnt",
              description: `${request.from.name} erhält keine Kontaktdaten.`,
            },
      );
      queryClient.invalidateQueries({ queryKey: incomingRequestsQueryKey(uid) });
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey(uid) });
      queryClient.invalidateQueries({ queryKey: matchingHubQueryKey(uid) });
      // §9: Einstieg aus der angenommenen Anfrage — Annehmen öffnet direkt den Chat.
      if (accept) navigate("/chat");
    },
    onError: (error) => {
      const message =
        error && typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : "Unbekannter Fehler.";
      toast({ variant: "error", title: "Aktion fehlgeschlagen", description: message });
    },
    onSettled: () => setPending(null),
  });

  const busy = respond.isPending;

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-soft p-3 sm:flex-row sm:items-center">
      <Link to={`/p/${request.from.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={request.from.name} src={request.from.avatar_url} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{request.from.name}</p>
          <p className="truncate text-xs text-muted">
            {[request.from.company, request.from.region].filter(Boolean).join(" · ") || "—"}
          </p>
          {request.message && (
            <p className="mt-1 line-clamp-2 text-sm text-muted italic">„{request.message}"</p>
          )}
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch">
        <Button variant="primary" size="sm" onClick={() => respond.mutate(true)} disabled={busy}>
          {pending === "accept" ? "Annehmen…" : "Annehmen"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => respond.mutate(false)} disabled={busy}>
          {pending === "decline" ? "Ablehnen…" : "Ablehnen"}
        </Button>
      </div>
    </div>
  );
}

// 5 ── Meine Communities (DEMO) ────────────────────────────────────────────────
export function CommunitiesWidget() {
  return (
    <DashboardCard id="communities" title="Meine Communities" demo>
      <ul className="flex flex-col gap-3">
        {DEMO_COMMUNITIES.map((c) => (
          <li key={c.name} className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-medium text-ink">{c.name}</span>
            <span className="shrink-0 text-xs text-muted">{c.members} Mitglieder</span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}

// 6 ── Mein Netzwerk (CORE-Count, DEMO-Listen) ─────────────────────────────────
export function NetzwerkWidget({ contactsCount }: { contactsCount: number }) {
  return (
    <DashboardCard
      id="netzwerk"
      title="Mein Netzwerk"
      action={<CardLink to="/chat">Zum Chat</CardLink>}
    >
      <div>
        <div className="font-display text-3xl font-semibold text-ink">{contactsCount}</div>
        <div className="text-xs tracking-wide text-muted uppercase">Bestätigte Kontakte</div>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">
            Aufschlüsselung
          </p>
          <DemoBadge />
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {DEMO_NETWORK.map((n) => (
            <li
              key={n.label}
              className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-sm"
            >
              <span className="text-muted">{n.label}</span>
              <span className="font-medium text-ink">{n.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </DashboardCard>
  );
}

// 7 ── Mein Matching (CORE) ────────────────────────────────────────────────────
export function MatchingWidget({ data }: { data: DashboardData }) {
  return (
    <DashboardCard
      id="matching"
      title="Mein Matching"
      className="md:col-span-2"
      action={
        <div className="flex items-center gap-3">
          <CardLink to="/compass">Bearbeiten</CardLink>
          <CardLink to="/meine-chancen">Zu meinen Chancen</CardLink>
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <MatchingColumn
          title="Ich suche"
          side="need"
          items={data.needs}
          empty="Keine Gesuche hinterlegt."
        />
        <MatchingColumn
          title="Ich biete"
          side="offer"
          items={data.offers}
          empty="Keine Angebote hinterlegt."
        />
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-line pt-4">
        <MatchStat label="Aktive Matches" value={data.matchStats.active} />
        <MatchStat label="Erfolgreiche" value={data.matchStats.successful} />
        <MatchStat label="Ø-Score" value={data.matchStats.avgScore} />
      </div>
    </DashboardCard>
  );
}

function MatchingColumn({
  title,
  side,
  items,
  empty,
}: {
  title: string;
  side: MatchingSide;
  items: { id: string; title: string; category: string | null }[];
  empty: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold tracking-wide text-accent-strong uppercase">
        {title}
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 grid grid-cols-1 gap-2">
          {items.map((item) => {
            const cat = findCategory(side, item.category);
            return (
              <li
                key={item.id}
                className="flex items-center gap-2.5 rounded-lg border border-line bg-soft p-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-strong">
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

function MatchStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="font-display text-xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
