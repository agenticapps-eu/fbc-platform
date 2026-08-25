import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import {
  THEME_LABEL,
  THEME_ORDER,
  type DashboardBadge,
  type DashboardData,
  type DashboardProfile,
  type ScoreBreakdown,
} from "../../lib/dashboard";
import { GOAL_CATEGORIES } from "../../lib/profile";
import {
  CardLink,
  CheckIcon,
  CrownIcon,
  DashboardCard,
  dateFmt,
  DemoBadge,
  EmptyHint,
  formatDate,
  monthFmt,
  ProgressBar,
} from "./building-blocks";

const ErfolgsradarChart = lazy(() =>
  import("../dashboard/ErfolgsradarChart").then((m) => ({ default: m.ErfolgsradarChart })),
);

// AGE-539: `DEMO_POSTS` ist hier ersatzlos gelöscht — zwei erfundene Artikel mit
// erfundenen Reichweiten, gerendert sobald `posts` leer war, also nach dem Import
// bei praktisch jedem Mitglied. Die Demo-Marke daneben machte sie nicht wahr; sie
// erklärte die Zahlen dem, der sie gebaut hat, nicht dem, der sein eigenes Profil
// liest. Nicht „ausgebaut" wie die Widgets unten, sondern gelöscht: eine
// bereitliegende Demo-Konstante ist eine Einladung zum nächsten Einbau.

// 1 ── Erfolgsradar (CORE) ─────────────────────────────────────────────────────
export function ErfolgsradarWidget({ data }: { data: DashboardData }) {
  return (
    <DashboardCard id="erfolgsradar" title="Mein Erfolgsradar">
      {data.themeScores.length > 0 ? (
        <Suspense fallback={<div className="h-56 w-full" />}>
          <ErfolgsradarChart scores={data.themeScores} />
        </Suspense>
      ) : (
        <EmptyHint>Noch keine Themen-Scores. Sie entstehen aus deinem Kompass.</EmptyHint>
      )}
    </DashboardCard>
  );
}

// 2 ── Meine Entwicklung (CORE) ────────────────────────────────────────────────
export function EntwicklungWidget({ profile }: { profile: DashboardProfile }) {
  const hasContent = profile.dev_focus || profile.next_steps.length > 0 || profile.dev_progress > 0;
  return (
    <DashboardCard id="entwicklung" title="Meine Entwicklung">
      {hasContent ? (
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Aktueller Fokus</span>
              <span className="font-medium text-ink">
                {profile.dev_focus ? THEME_LABEL[profile.dev_focus] : "—"}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <ProgressBar value={profile.dev_progress} />
              <span className="w-10 shrink-0 text-right text-sm font-medium text-ink">
                {profile.dev_progress}%
              </span>
            </div>
          </div>
          {profile.next_steps.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                Nächste Schritte
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {profile.next_steps.map((step) => (
                  <li key={step} className="flex items-start gap-2 text-sm text-ink">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-accent text-accent">
                      <CheckIcon className="h-2.5 w-2.5" />
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <EmptyHint>Lege deinen Entwicklungs-Fokus im Profil-Editor fest.</EmptyHint>
      )}
      <Link to="/kompass" className="mt-auto">
        <Button variant="ghost" size="sm" className="w-full">
          Zur persönlichen Roadmap
        </Button>
      </Link>
    </DashboardCard>
  );
}

// 3 ── Meine Interessen (CORE) ─────────────────────────────────────────────────
export function InteressenWidget({ data }: { data: DashboardData }) {
  const groups = THEME_ORDER.map((theme) => ({
    theme,
    items: data.interests.filter((i) => i.theme === theme),
  })).filter((g) => g.items.length > 0);
  const untheured = data.interests.filter((i) => !i.theme);

  // AGE-539: Ohne Interessen verschwindet die Karte ganz. Ein einladender
  // Leerzustand käme hier nicht in Frage — „Bearbeiten" führt in denselben
  // Profil-Editor wie die Einladung oben auf der Seite, und zwei Einladungen mit
  // einem Ziel sind Wiederholung. Die öffentliche Ansicht lässt leere Interessen
  // ohnehin längst verschwinden.
  if (data.interests.length === 0) return null;

  return (
    <DashboardCard
      id="interessen"
      title="Meine Interessen"
      action={<CardLink to="/profil/bearbeiten">Bearbeiten</CardLink>}
    >
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.theme}>
            <div className="text-xs font-semibold tracking-wide text-muted uppercase">
              {THEME_LABEL[group.theme]}
            </div>
            <ChipList items={group.items.map((i) => i.label)} />
          </div>
        ))}
        {untheured.length > 0 && <ChipList items={untheured.map((i) => i.label)} />}
      </div>
    </DashboardCard>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <Badge variant="neutral">{item}</Badge>
        </li>
      ))}
    </ul>
  );
}

// 9 ── Mein Impact (CORE-Zahl, Akzent-Card) ───────────────────────────────────
// Regelbasierter Impact Score (AGE-242) mit transparenter Aufschlüsselung der
// fünf gewichteten Komponenten — der Wert ist nachvollziehbar, kein Demo-Delta.
export function ImpactWidget({
  score,
  breakdown,
}: {
  score: number;
  breakdown: ScoreBreakdown | null;
}) {
  return (
    <Card
      id="impact"
      className="flex scroll-mt-24 flex-col gap-4 border-accent/30 bg-[linear-gradient(120deg,#faf4e6_0%,#f2e6c9_100%)]"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-ink">Mein Impact</h3>
        <span className="text-xs text-muted">regelbasiert</span>
      </div>
      <div>
        <div className="font-display text-5xl font-semibold text-accent-strong">{score}</div>
        <div className="mt-1 text-sm text-muted">von 100 · Impact Score</div>
      </div>

      {breakdown ? (
        <ScoreBreakdownList breakdown={breakdown} />
      ) : (
        <p className="text-xs text-muted">
          Die Aufschlüsselung wird beim nächsten Laden berechnet.
        </p>
      )}

      {/* Verlauf — DEMO (Tracking liefert Phase 2). */}
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted">
          Verlauf <DemoBadge />
        </div>
        <svg
          viewBox="0 0 200 48"
          className="h-12 w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            points="0,40 25,36 50,38 75,28 100,30 125,20 150,22 175,12 200,8"
            fill="none"
            stroke="var(--color-accent-strong)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </Card>
  );
}

// Transparente Score-Aufschlüsselung: pro Komponente erreichte Punkte / Gewicht,
// als Mini-Balken; der Detailtext (z. B. „3/4 Themen") hängt als Tooltip am Eintrag.
function ScoreBreakdownList({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <ul className="flex flex-col gap-2.5" aria-label="Aufschlüsselung des Impact Scores">
      {breakdown.components.map((c) => {
        const pct = c.weight > 0 ? Math.min(100, Math.round((c.points / c.weight) * 100)) : 0;
        return (
          <li key={c.key} title={c.detail}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted">{c.label}</span>
              <span className="font-medium text-ink tabular-nums">
                {c.points}
                <span className="text-muted">/{c.weight}</span>
              </span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-accent-strong" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// 12 ── Meine Beiträge (CORE) ──────────────────────────────────────────────────
// AGE-539: Ohne Beiträge steht hier eine Einladung statt einer Feststellung der
// Leere. Das ist die eine Ausnahme von „ein leerer Bereich rendert nicht":
// Beiträge gibt es wirklich (C8), und das Ziel `/aktivitaet` steht sonst nirgends
// auf dieser Seite — anders als bei „Meine Interessen", das in denselben Editor
// führt wie die Einladung weiter oben.
export function BeitraegeWidget({ data }: { data: DashboardData }) {
  return (
    <DashboardCard
      id="beitraege"
      title="Meine Beiträge"
      action={<CardLink to="/aktivitaet">Alle anzeigen</CardLink>}
    >
      {data.posts.length === 0 ? (
        <div>
          <p className="text-sm text-ink">Von dir war hier noch nichts zu lesen.</p>
          <p className="mt-1 text-sm text-muted">
            Was dich gerade beschäftigt, ist für die anderen der schnellste Weg, dich
            einzuordnen — ein paar Sätze genügen.
          </p>
          <Link to="/aktivitaet" className="mt-3 inline-block">
            <Button variant="primary" size="sm">
              Beitrag schreiben
            </Button>
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {/* Dieselbe Bauart wie die Aktivitäten-Karte auf der öffentlichen
              Profilseite (AGE-587): jede Zeile ein `<a>` auf IHREN Beitrag,
              samt Ersatztext für den leeren Rumpf. Das Spec-Delta sagt „jede
              Zeile, auf JEDEM Profil" — die eigene Seite hier eingeschlossen. */}
          {data.posts.map((post) => (
            <li key={post.id}>
              <Link
                to={`/aktivitaet?post=${post.id}`}
                className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <p className="line-clamp-2 text-sm font-medium text-ink hover:text-accent-strong">
                  {post.body.trim() === "" ? "Beitrag ohne Text" : post.body}
                </p>
                <p className="text-xs text-muted">{formatDate(post.created_at, dateFmt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

// 13 ── Meine Auszeichnungen (CORE) ────────────────────────────────────────────
export function AuszeichnungenWidget({ badges }: { badges: DashboardBadge[] }) {
  return (
    <DashboardCard id="auszeichnungen" title="Meine Auszeichnungen">
      {badges.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {badges.map((badge) => (
            <li key={badge.key} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                <CrownIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{badge.label}</p>
                <p className="text-xs text-muted">seit {formatDate(badge.awarded_at, monthFmt)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyHint>Noch keine Zertifikate oder Badges erhalten.</EmptyHint>
      )}
    </DashboardCard>
  );
}

// 14 ── Meine Ziele (CORE) ─────────────────────────────────────────────────────
export function ZieleWidget({ data }: { data: DashboardData }) {
  return (
    <DashboardCard
      id="ziele"
      title="Meine Ziele"
      action={<CardLink to="/profil/bearbeiten">Bearbeiten</CardLink>}
    >
      {data.goals.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {GOAL_CATEGORIES.map((cat) => {
            const goals = data.goals.filter((g) => g.category === cat.value);
            if (goals.length === 0) return null;
            return (
              <li key={cat.value}>
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {cat.label}
                </p>
                <ul className="mt-1.5 flex flex-col gap-2">
                  {goals.map((g) => (
                    <li key={g.title}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-ink">{g.title}</span>
                        <span className="shrink-0 text-muted">{g.progress ?? 0}%</span>
                      </div>
                      <div className="mt-1">
                        <ProgressBar value={g.progress ?? 0} />
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyHint>Noch keine Ziele definiert.</EmptyHint>
      )}
    </DashboardCard>
  );
}
