import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TierBadge } from "../ui/TierBadge";
import { DashboardSkeleton } from "../ui/Skeleton";
import { PageHero } from "../ui/PageHero";
import { levelLabel } from "../../config/levels";
import { dashboardQueryKey, fetchDashboard } from "../../lib/dashboard";
import { displayAuthor } from "../../lib/displayAuthor";
import { eventsListKey, fetchEvents, formatEventDate, partitionEvents } from "../../lib/events";
import { feedQueryKey, fetchFeed, type FeedPost } from "../../lib/feed";
import { signaturQueryKey, signPostMedia, SIGNATUR_STALE_MS } from "../../lib/post-media";
import {
  directoryQueryKey,
  emptyDirectoryFilters,
  fetchDirectoryBaseline,
} from "../../lib/directory";

/**
 * Die eine Zeile, die ein Beitrag in der Übersicht bekommt.
 *
 * DREI Fälle, und der dritte fehlte: ein Event-Beitrag trägt einen leeren Body
 * (AGE-533) — das war bedacht. Ein Beitrag mit NUR BILDERN trägt ebenfalls
 * einen leeren Body, und dafür stand hier nichts: die Karte blieb leer, es war
 * nur der Name des Autors zu sehen. Genau so aufgefallen (17.08., zwei
 * Beiträge von Detlev mit vier bzw. einem Bild und ohne Text).
 */
function vorschauZeile(post: FeedPost): string {
  if (post.kind === "event" && post.event) {
    const datum = post.event.startsAt ? ` · ${formatEventDate(post.event.startsAt)}` : "";
    return `Neues Event: ${post.event.title}${datum}`;
  }
  if (post.body.trim() !== "") return post.body;
  if (post.media.length > 0) {
    return post.media.length === 1 ? "Ein Bild" : `${post.media.length} Bilder`;
  }
  if (post.videoUrl) return "Ein Video";
  return "Beitrag";
}

/** Tageszeit-Gruß. Die Referenz schreibt „Guten Morgen" in die Eyebrow-Zeile —
 *  fest verdrahtet wäre das ab mittags falsch. */
function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Schön, dass du da bist";
  return "Guten Abend";
}

/**
 * Persönliches Mitglieder-Dashboard (`/`, eingeloggt) — Nav-IA-Spec §3
 * („Startseite → persönliches Dashboard"). Ruhige Übersicht statt vollem Feed:
 * Willkommen, vier Kennzahlen (Compass %, Empfehlungen, nächstes Event, Plan),
 * frische Aktivität, passende Mitglieder und konkrete nächste Schritte.
 *
 * Echte, RLS-gegatete Daten (kein Dummy): Was die RLS nicht freigibt — etwa das
 * Verzeichnis unterhalb der freigeschalteten Stufe — zeigt einen Leerzustand.
 * Rein token-getrieben gestylt, trägt also jede Design-Variante (inkl. sommerfest).
 */
export function MemberDashboard({ uid }: { uid: string }) {
  const dashQuery = useQuery({
    queryKey: dashboardQueryKey(uid),
    queryFn: () => fetchDashboard(uid),
  });
  const eventsQuery = useQuery({
    queryKey: eventsListKey(uid),
    queryFn: () => fetchEvents(uid),
  });
  const feedQuery = useQuery({
    queryKey: feedQueryKey(uid, null),
    queryFn: () => fetchFeed({ uid }),
  });
  const membersQuery = useQuery({
    queryKey: directoryQueryKey(emptyDirectoryFilters),
    queryFn: fetchDirectoryBaseline,
  });

  // Vorschaubilder der gezeigten Beiträge. NUR das erste Bild je Beitrag: die
  // Zeile trägt eine Kachel, und jede weitere Signatur wäre eine Anfrage für
  // etwas, das niemand sieht.
  const vorschauPfade = (feedQuery.data?.posts ?? [])
    .slice(0, 3)
    .map((p) => p.media[0]?.storagePath)
    .filter((p): p is string => !!p);
  const bildSignaturen = useQuery({
    queryKey: signaturQueryKey(vorschauPfade),
    queryFn: () => signPostMedia(vorschauPfade),
    enabled: vorschauPfade.length > 0,
    staleTime: SIGNATUR_STALE_MS,
  });

  if (dashQuery.isLoading) return <DashboardSkeleton />;
  if (dashQuery.isError || !dashQuery.data) {
    return (
      <p className="text-sm text-danger">Dashboard konnte nicht geladen werden. Bitte neu laden.</p>
    );
  }

  const { profile } = dashQuery.data;
  const firstName = profile.name.split(" ")[0];
  const nextEvent = eventsQuery.data
    ? (partitionEvents(eventsQuery.data, new Date()).upcoming[0] ?? null)
    : null;
  const posts = (feedQuery.data?.posts ?? []).slice(0, 2);
  const members = (membersQuery.data ?? []).filter((m) => m.id !== uid).slice(0, 3);
  const steps = buildNextSteps(profile.profile_completion, nextEvent);

  return (
    <div className="space-y-10">
      <PageHero
        image="/images/hero-see.webp"
        eyebrow={`${greeting()}, ${firstName}`}
        title={
          <>
            Deine nächste Chance
            <br className="hidden sm:block" /> beginnt hier.
          </>
        }
        subtitle="Entdecke neue Chancen, spannende Menschen und wertvolle Impulse."
      />

      {/* Zwei Aufgaben links, der Zustand rechts (AGE-566).
          Vorher standen alle drei als gleichwertige Kacheln in einem
          Vierer-Raster — bei DREI Kacheln, weshalb die Reihe nie aufging. Und
          „Mein Plan" ist keine Aufgabe: Kompass und Event fordern zum Handeln
          auf, die Mitgliedschaft sagt, wo man steht. Gleiche Gestalt behauptet
          gleiche Art. */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_minmax(0,0.85fr)]">
        <DashTile
          label="Mein Kompass"
          value={`${profile.profile_completion}%`}
          sub="Profilvollständigkeit"
          to="/profil/bearbeiten"
          cta="Weiter bearbeiten"
        />
        {/* AGE-450: „Neue Empfehlungen" (→ /meine-chancen) entfernt — Chancen sind
            fürs Sommerfest raus. */}
        <DashTile
          label="Nächstes Event"
          value={nextEvent ? nextEvent.title : "—"}
          valueClassName="text-xl"
          sub={
            nextEvent
              ? [formatEventDate(nextEvent.startsAt), nextEvent.location]
                  .filter(Boolean)
                  .join(" · ")
              : "Aktuell kein Event geplant"
          }
          to={nextEvent ? `/events/${nextEvent.id}` : undefined}
          cta="Zum Event"
        />
        <DashTile
          label="Mitgliedschaft"
          value={levelLabel(profile.tier)}
          valueClassName="text-2xl"
          sub="Deine aktuelle Stufe"
          to="/mitgliedschaft"
          cta="Plan verwalten"
          ton="zustand"
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <SectionHeader title="Neu in der Aktivität" to="/aktivitaet" cta="Zur Aktivität" />
          {feedQuery.isLoading ? (
            <p className="text-sm text-muted">Beiträge werden geladen…</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted">Noch keine Beiträge.</p>
          ) : (
            <ul className="space-y-4">
              {posts.map((post) => {
                const author = displayAuthor(post.author, true);
                const bildPfad = post.media[0]?.storagePath;
                const bildUrl = bildPfad ? bildSignaturen.data?.[bildPfad] : undefined;
                return (
                  <li key={post.id}>
                    {/* KOMPAKT: eine Zeile je Beitrag statt Kopf und Absatz
                        untereinander. Die Startseite ist die Übersicht, nicht
                        der Feed — wer mehr will, geht auf „Zur Aktivität". */}
                    <Card className="flex items-center gap-3">
                      <Avatar
                        name={author.name}
                        src={author.avatarUrl}
                        masked={author.masked}
                        size="sm"
                        className="shrink-0 ring-1 ring-accent/40"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="font-display text-sm font-semibold text-ink">
                            {author.name}
                          </span>
                          {post.author.tier && <TierBadge tier={post.author.tier} />}
                        </div>
                        <p className="line-clamp-1 text-sm text-muted">{vorschauZeile(post)}</p>
                      </div>
                      {bildUrl && (
                        <img
                          src={bildUrl}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-[var(--radius-card)] object-cover"
                        />
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <SectionHeader title="Neue Mitglieder für dich" to="/mitglieder" cta="Alle Mitglieder" />
          {membersQuery.isLoading ? (
            <p className="text-sm text-muted">Mitglieder werden geladen…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted">
              Sobald mehr Mitglieder für dich sichtbar sind, erscheinen hier Empfehlungen.
            </p>
          ) : (
            <ul className="space-y-3">
              {members.map((m) => (
                <li key={m.id}>
                  <Link
                    to={`/p/${m.id}`}
                    className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-canvas px-3 py-2.5 transition-colors hover:border-accent/50"
                  >
                    <Avatar
                      name={m.name ?? "Mitglied"}
                      src={m.avatar_url}
                      size="sm"
                      className="ring-1 ring-accent/40"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-semibold text-ink">
                        {m.name ?? "Mitglied"}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {[m.region, m.company].filter(Boolean).join(" · ") || levelLabel(m.tier)}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-accent-strong">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Deine nächsten Schritte
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {steps.map((step) => (
            <li key={step.label}>
              <Link
                to={step.to}
                className="flex h-full flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-canvas p-4 transition-colors hover:border-accent/50"
              >
                <span className="font-display text-base font-semibold text-ink">{step.label}</span>
                <span className="text-sm text-muted">{step.detail}</span>
                <span className="mt-auto pt-2 text-sm font-medium text-accent-strong">
                  Los geht's →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[var(--radius-card)] border border-accent/30 bg-accent-soft/25 px-6 py-6 sm:px-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xl font-semibold text-ink">Gemeinsam mehr bewegen.</p>
            <p className="text-sm text-muted">Fair. Wertebasiert. Nachhaltig.</p>
          </div>
          <Link to="/mitglieder">
            <Button variant="primary">Mitglieder entdecken</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

interface NextStep {
  label: string;
  detail: string;
  to: string;
}

/** Konkrete nächste Schritte aus echtem Zustand (Compass-Lücke, nächstes Event). */
function buildNextSteps(
  completion: number,
  nextEvent: { id: string; title: string } | null,
): NextStep[] {
  const steps: NextStep[] = [];
  if (completion < 80) {
    steps.push({
      label: "Kompass vervollständigen",
      detail: `Noch ${80 - completion}% bis zu besseren Empfehlungen`,
      to: "/profil/bearbeiten",
    });
  }
  if (nextEvent) {
    steps.push({
      label: "Beim nächsten Event dabei sein",
      detail: nextEvent.title,
      to: `/events/${nextEvent.id}`,
    });
  }
  steps.push({
    label: "Neue Kontakte knüpfen",
    detail: "Lerne passende Mitglieder kennen",
    to: "/mitglieder",
  });
  return steps.slice(0, 3);
}

function DashTile({
  label,
  value,
  sub,
  to,
  cta,
  valueClassName = "text-3xl",
  ton = "aufgabe",
}: {
  label: string;
  value: ReactNode;
  sub: string;
  to?: string;
  cta: string;
  valueClassName?: string;
  /** `zustand` hebt die Kachel ab — sie fordert nichts, sie sagt etwas. */
  ton?: "aufgabe" | "zustand";
}) {
  return (
    <Card
      className={
        "flex flex-col gap-1" + (ton === "zustand" ? " border-accent/30 bg-accent-soft/35" : "")
      }
    >
      <span className="text-sm text-muted">{label}</span>
      <p className={`font-display font-semibold text-ink ${valueClassName}`}>{value}</p>
      <p className="truncate text-sm text-muted">{sub}</p>
      {to && (
        <Link
          to={to}
          className="mt-auto pt-3 text-sm font-medium text-accent-strong hover:underline"
        >
          {cta} →
        </Link>
      )}
    </Card>
  );
}

function SectionHeader({ title, to, cta }: { title: string; to: string; cta: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      <Link to={to} className="shrink-0 text-sm font-medium text-accent-strong hover:underline">
        {cta} →
      </Link>
    </div>
  );
}
