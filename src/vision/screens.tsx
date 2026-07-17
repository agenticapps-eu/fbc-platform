/* eslint-disable react-refresh/only-export-components --
   Screen-Registry: die Screen-Komponenten liegen bewusst neben der SCREENS-Map;
   Fast-Refresh ist für diesen statischen Dummy irrelevant. */
import type { ReactNode } from "react";
import {
  EbzAvatar,
  EbzCard,
  EbzLink,
  EbzProgress,
  EbzRing,
  EbzSectionHeader,
  EbzStat,
  EbzTag,
  PointsPill,
} from "./ui";
import * as fx from "./fixtures";
import type { VisionKey } from "./nav";

/* ── geteilte Screen-Bausteine ───────────────────────────────────────────── */

function ScreenHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-extrabold text-[var(--ebz-ink)]">{title}</h1>
      <p className="mt-1 text-[var(--ebz-muted)]">{subtitle}</p>
    </header>
  );
}

function FaceStack({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {Array.from({ length: Math.min(3, n) }).map((_, i) => (
          <span
            key={i}
            className="inline-block h-6 w-6 rounded-full border-2 border-[var(--ebz-card)] bg-[var(--ebz-blue-soft)]"
          />
        ))}
      </div>
      <span className="ml-1 text-xs text-[var(--ebz-muted)]">+{n * 10}</span>
    </div>
  );
}

function CtaButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-lg border border-[var(--ebz-blue)] px-3 py-1.5 text-sm font-semibold text-[var(--ebz-blue)] transition-colors hover:bg-[var(--ebz-blue-soft)]"
    >
      {children}
    </button>
  );
}

function Banner({ tone, children }: { tone: "green" | "blue"; children: ReactNode }) {
  const cls =
    tone === "green"
      ? "bg-[var(--ebz-green-soft)] text-[var(--ebz-green)]"
      : "bg-[var(--ebz-blue-soft)] text-[var(--ebz-blue)]";
  return <div className={`rounded-xl px-4 py-3 text-sm font-medium ${cls}`}>{children}</div>;
}

/* ── ACTIVE — der Wow-Screen ─────────────────────────────────────────────── */

const ACTIVE_TABS = [
  "Heute",
  "Bewerten",
  "Umfragen",
  "Missionen",
  "Gewinnspiele",
  "Meine Punkte",
  "Ranking",
  "Historie",
];

function ActiveScreen() {
  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-[var(--ebz-ink)]">
          <span aria-hidden="true" className="text-[var(--ebz-gold)]">
            ★
          </span>
          Active
        </h1>
        <p className="mt-1 text-[var(--ebz-muted)]">
          Jede Aktion zählt. Sammle ActivePoints, steige auf und gewinne.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-x-5 gap-y-2 border-b border-[var(--ebz-line)] pb-1 text-sm">
        {ACTIVE_TABS.map((t, i) => (
          <span
            key={t}
            className={
              i === 0
                ? "border-b-2 border-[var(--ebz-blue)] pb-2 font-semibold text-[var(--ebz-blue)]"
                : "pb-2 text-[var(--ebz-muted)]"
            }
          >
            {t}
          </span>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section>
            <EbzSectionHeader
              title="Heute für dich empfohlen"
              action={<EbzLink>Alle Aufgaben anzeigen</EbzLink>}
            />
            <div className="space-y-3">
              {fx.activeTasks.map((task) => (
                <EbzCard key={task.title} className="flex items-center gap-4 py-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--ebz-blue-soft)] text-xl">
                    {task.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[var(--ebz-ink)]">{task.title}</p>
                    <p className="truncate text-sm text-[var(--ebz-muted)]">{task.desc}</p>
                  </div>
                  <FaceStack n={task.faces} />
                  <PointsPill points={task.points} />
                  <CtaButton>{task.cta}</CtaButton>
                </EbzCard>
              ))}
            </div>
            <div className="mt-3">
              <Banner tone="green">
                💡 Tipp: Je aktiver du bist, desto mehr Chancen empfehlen wir dir.
              </Banner>
            </div>
          </section>

          <section>
            <EbzSectionHeader
              title="Bewerten & Verdienen"
              action={<EbzLink>Alle bewerten</EbzLink>}
            />
            <p className="mb-3 text-sm text-[var(--ebz-muted)]">
              Dein Feedback macht die Plattform besser und bringt dir Punkte.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {fx.earnGrid.map((item) => (
                <EbzCard
                  key={item.label}
                  className="flex flex-col items-center gap-1 py-4 text-center"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-sm font-semibold text-[var(--ebz-ink)]">{item.label}</span>
                  <span className="text-xs font-bold text-[var(--ebz-green)]">
                    +{item.points} P
                  </span>
                </EbzCard>
              ))}
            </div>
            <div className="mt-3">
              <Banner tone="blue">
                ❤️ Jede Bewertung = bessere Empfehlungen für dich und andere.
              </Banner>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <EbzCard>
              <EbzSectionHeader title="Top Aktive" />
              <ol className="space-y-2">
                {fx.ranking.map((r) => (
                  <li key={r.rank} className="flex items-center gap-2 text-sm">
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full text-xs font-bold ${
                        r.rank <= 3
                          ? "bg-[var(--ebz-gold)] text-white"
                          : "bg-[#eef1f7] text-[var(--ebz-muted)]"
                      }`}
                    >
                      {r.rank}
                    </span>
                    <span className="flex-1 truncate text-[var(--ebz-ink)]">{r.name}</span>
                    <span className="font-semibold text-[var(--ebz-muted)]">{r.points}</span>
                  </li>
                ))}
              </ol>
            </EbzCard>
            <EbzCard>
              <EbzSectionHeader title="Punkte einlösen" />
              <ul className="space-y-2">
                {fx.rewards.map((r) => (
                  <li key={r.label} className="flex items-center gap-2 text-sm">
                    <span className="text-lg">{r.icon}</span>
                    <span className="flex-1 truncate text-[var(--ebz-ink)]">{r.label}</span>
                    <span className="text-xs text-[var(--ebz-muted)]">{r.cost}</span>
                  </li>
                ))}
              </ul>
            </EbzCard>
            <EbzCard>
              <EbzSectionHeader title="Wirkung" />
              <ul className="grid grid-cols-2 gap-3">
                {fx.impact.map((i) => (
                  <li key={i.label}>
                    <p className="text-lg font-extrabold text-[var(--ebz-ink)]">{i.value}</p>
                    <p className="text-xs text-[var(--ebz-muted)]">{i.label}</p>
                  </li>
                ))}
              </ul>
            </EbzCard>
          </div>
        </div>

        {/* rechte Spalte */}
        <div className="space-y-4">
          <EbzCard>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--ebz-muted)]">
              Deine ActivePoints
            </p>
            <EbzRing
              value={fx.me.pointsTotal}
              max={4000}
              centerTop={fx.me.pointsTotal.toLocaleString("de-DE")}
              centerBottom="Gesamtpunkte"
            />
            <p className="mt-2 text-center text-sm font-semibold text-[var(--ebz-green)]">
              +{fx.me.pointsWeek} diese Woche
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {fx.pointsHistory.map((p) => (
                <li key={p.label} className="flex justify-between">
                  <span className="text-[var(--ebz-muted)]">{p.label}</span>
                  <span className="font-semibold text-[var(--ebz-ink)]">{p.value}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <EbzLink>Punkte-Historie ansehen</EbzLink>
            </div>
          </EbzCard>

          <EbzCard>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--ebz-muted)]">
              Dein Fortschritt
            </p>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-bold text-[var(--ebz-ink)]">{fx.me.level}</span>
              <span className="text-[var(--ebz-muted)]">{fx.me.levelPct}%</span>
            </div>
            <EbzProgress pct={fx.me.levelPct} />
            <p className="mt-2 text-xs text-[var(--ebz-muted)]">
              Nächste Stufe: {fx.me.nextLevel} · Noch {fx.me.pointsToNext} ActivePoints
            </p>
            <div className="mt-3">
              <EbzLink>Alle Level & Vorteile</EbzLink>
            </div>
          </EbzCard>

          <EbzCard>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--ebz-muted)]">
              Tägliche Serie
            </p>
            <p className="flex items-center gap-2 font-bold text-[var(--ebz-ink)]">
              <span aria-hidden="true">🔥</span> 7 Tage in Folge aktiv!
            </p>
            <div className="mt-3 flex justify-between">
              {["M", "D", "M", "D", "F", "S", "S"].map((d, i) => (
                <span key={i} className="flex flex-col items-center gap-1">
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full text-xs ${
                      fx.me.streak[i]
                        ? "bg-[var(--ebz-green)] text-white"
                        : "border border-[var(--ebz-line)] text-[var(--ebz-muted)]"
                    }`}
                  >
                    {fx.me.streak[i] ? "✓" : ""}
                  </span>
                  <span className="text-xs text-[var(--ebz-muted)]">{d}</span>
                </span>
              ))}
            </div>
            <p className="mt-3 text-center text-sm font-bold text-[var(--ebz-green)]">+50 BONUS</p>
          </EbzCard>

          <EbzCard>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--ebz-muted)]">
              Gewinnspiel der Woche
            </p>
            <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--ebz-blue)] to-[#16307a] text-3xl">
              🌴
            </div>
            <p className="font-bold text-[var(--ebz-ink)]">{fx.prize.title}</p>
            <p className="text-sm text-[var(--ebz-muted)]">{fx.prize.sub}</p>
            <p className="mt-1 text-xs text-[var(--ebz-muted)]">
              Teilnahmeschluss: {fx.prize.deadline} · Deine Lose: {fx.prize.lots}
            </p>
            <div className="mt-3">
              <EbzLink>Jetzt teilnehmen</EbzLink>
            </div>
          </EbzCard>
        </div>
      </div>
    </div>
  );
}

/* ── Entdecken ───────────────────────────────────────────────────────────── */

function UebersichtScreen() {
  return (
    <div>
      <ScreenHeader
        title={`Willkommen zurück, ${fx.me.name.split(" ")[0]}!`}
        subtitle="Dein Überblick über Punkte, Chancen und dein Netzwerk."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <EbzStat
          label="ActivePoints"
          value={fx.me.pointsTotal.toLocaleString("de-DE")}
          sub={`+${fx.me.pointsWeek} diese Woche`}
        />
        <EbzStat
          label="Level"
          value={fx.me.level}
          sub={`${fx.me.levelPct}% zu ${fx.me.nextLevel}`}
        />
        <EbzStat label="Neue Matchings" value={fx.matchings.length} sub="passende Verbindungen" />
        <EbzStat label="Verbindungen" value={fx.network[0].value} sub="in deinem Netzwerk" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <EbzSectionHeader title="Empfohlene Chancen" action={<EbzLink>Alle</EbzLink>} />
          <div className="space-y-3">
            {fx.opportunities.slice(0, 3).map((o) => (
              <OpportunityRow key={o.title} o={o} />
            ))}
          </div>
        </section>
        <section>
          <EbzSectionHeader title="Menschen für dich" action={<EbzLink>Alle</EbzLink>} />
          <div className="space-y-3">
            {fx.people.slice(0, 3).map((p) => (
              <PersonRow key={p.name} p={p} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function CompassScreen() {
  return (
    <div>
      <ScreenHeader title="Compass" subtitle="Dein Potenzial in Sein · Tun · Haben · Wirken." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { t: "Sein", d: "Werte & Identität", p: 90 },
          { t: "Tun", d: "Kompetenzen & Angebote", p: 70 },
          { t: "Haben", d: "Ressourcen & Netzwerk", p: 55 },
          { t: "Wirken", d: "Impact & Ziele", p: 40 },
        ].map((c) => (
          <EbzCard key={c.t}>
            <p className="font-bold text-[var(--ebz-ink)]">{c.t}</p>
            <p className="mb-3 text-sm text-[var(--ebz-muted)]">{c.d}</p>
            <EbzProgress pct={c.p} />
            <p className="mt-1 text-xs text-[var(--ebz-muted)]">{c.p}% ausgefüllt</p>
          </EbzCard>
        ))}
      </div>
      <div className="mt-4">
        <Banner tone="blue">Vervollständige deinen Compass für bessere Matchings (+20 P).</Banner>
      </div>
    </div>
  );
}

function OpportunityRow({ o }: { o: fx.Opportunity }) {
  return (
    <EbzCard className="flex items-start gap-3 py-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ebz-blue-soft)] text-lg">
        🎯
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[var(--ebz-ink)]">{o.title}</p>
        <p className="text-sm text-[var(--ebz-muted)]">
          {o.org} · {o.location}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {o.tags.map((t) => (
            <EbzTag key={t} tone="blue">
              {t}
            </EbzTag>
          ))}
        </div>
      </div>
      <EbzTag tone="neutral">{o.type}</EbzTag>
    </EbzCard>
  );
}

function OpportunitiesScreen() {
  return (
    <div>
      <ScreenHeader title="Opportunities" subtitle="Chancen entdecken, die zu dir passen." />
      <div className="space-y-3">
        {fx.opportunities.map((o) => (
          <OpportunityRow key={o.title} o={o} />
        ))}
      </div>
    </div>
  );
}

function PersonRow({ p }: { p: fx.Person }) {
  return (
    <EbzCard className="flex items-center gap-3 py-4">
      <EbzAvatar name={p.name} />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[var(--ebz-ink)]">{p.name}</p>
        <p className="truncate text-sm text-[var(--ebz-muted)]">
          {p.role} · {p.company}
        </p>
        <p className="text-xs text-[var(--ebz-muted)]">
          {p.region} · {p.mutual} gemeinsame Kontakte
        </p>
      </div>
      <CtaButton>Vernetzen</CtaButton>
    </EbzCard>
  );
}

function MenschenScreen() {
  return (
    <div>
      <ScreenHeader title="Menschen" subtitle="Finde Kontakte, die zu deinen Zielen passen." />
      <div className="grid gap-3 lg:grid-cols-2">
        {fx.people.map((p) => (
          <PersonRow key={p.name} p={p} />
        ))}
      </div>
    </div>
  );
}

function CommunitiesScreen() {
  return (
    <div>
      <ScreenHeader title="Communities" subtitle="Gemeinsam mehr erreichen." />
      <div className="grid gap-3 sm:grid-cols-2">
        {fx.communities.map((c) => (
          <EbzCard key={c.name} className="flex items-center gap-3 py-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--ebz-blue-soft)] text-xl">
              🌐
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[var(--ebz-ink)]">{c.name}</p>
              <p className="truncate text-sm text-[var(--ebz-muted)]">{c.topic}</p>
              <p className="text-xs text-[var(--ebz-muted)]">
                {c.members.toLocaleString("de-DE")} Mitglieder
              </p>
            </div>
            <CtaButton>Beitreten</CtaButton>
          </EbzCard>
        ))}
      </div>
    </div>
  );
}

function OrganisationenScreen() {
  return (
    <div>
      <ScreenHeader title="Organisationen" subtitle="Unternehmen entdecken und bewerten." />
      <div className="grid gap-3 sm:grid-cols-2">
        {fx.organisations.map((o) => (
          <EbzCard key={o.name} className="flex items-center gap-3 py-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--ebz-blue-soft)] text-xl">
              🏢
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[var(--ebz-ink)]">{o.name}</p>
              <p className="truncate text-sm text-[var(--ebz-muted)]">
                {o.industry} · {o.size}
              </p>
              <p className="text-xs text-[var(--ebz-muted)]">{o.region}</p>
            </div>
            <CtaButton>Ansehen</CtaButton>
          </EbzCard>
        ))}
      </div>
    </div>
  );
}

function EventsScreen() {
  return (
    <div>
      <ScreenHeader title="Events" subtitle="Treffen. Erleben. Vernetzen." />
      <div className="space-y-3">
        {fx.events.map((e) => (
          <EbzCard key={e.title} className="flex items-center gap-4 py-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--ebz-blue-soft)] text-xl">
              📅
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[var(--ebz-ink)]">{e.title}</p>
              <p className="text-sm text-[var(--ebz-muted)]">
                {e.date} · {e.location}
              </p>
            </div>
            <EbzTag tone="blue">{e.type}</EbzTag>
            <CtaButton>Teilnehmen</CtaButton>
          </EbzCard>
        ))}
      </div>
    </div>
  );
}

function AcademyScreen() {
  return (
    <div>
      <ScreenHeader title="Academy" subtitle="Wissen. Lernen. Wachsen." />
      <div className="grid gap-3 sm:grid-cols-2">
        {fx.academy.map((a) => (
          <EbzCard key={a.title}>
            <div className="mb-3 flex h-20 items-center justify-center rounded-xl bg-[var(--ebz-blue-soft)] text-3xl">
              🎓
            </div>
            <p className="font-bold text-[var(--ebz-ink)]">{a.title}</p>
            <p className="mt-1 text-sm text-[var(--ebz-muted)]">
              {a.lessons} Lektionen · {a.duration}
            </p>
            <div className="mt-2">
              <EbzTag tone="neutral">{a.level}</EbzTag>
            </div>
          </EbzCard>
        ))}
      </div>
    </div>
  );
}

/* ── Mein Bereich ────────────────────────────────────────────────────────── */

function NetzwerkScreen() {
  return (
    <div>
      <ScreenHeader title="Mein Netzwerk" subtitle="Deine Kontakte auf einen Blick." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {fx.network.map((n) => (
          <EbzStat key={n.label} label={n.label} value={n.value.toLocaleString("de-DE")} />
        ))}
      </div>
      <EbzSectionHeader title="Zuletzt vernetzt" />
      <div className="grid gap-3 lg:grid-cols-2">
        {fx.people.slice(0, 4).map((p) => (
          <PersonRow key={p.name} p={p} />
        ))}
      </div>
    </div>
  );
}

function MatchingsScreen() {
  return (
    <div>
      <ScreenHeader
        title="Meine Matchings"
        subtitle="Passende Verbindungen, nach Qualität sortiert."
      />
      <div className="space-y-3">
        {fx.matchings.map((m) => (
          <EbzCard key={m.name} className="flex items-center gap-4 py-4">
            <EbzAvatar name={m.name} size={44} />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[var(--ebz-ink)]">{m.name}</p>
              <p className="text-sm text-[var(--ebz-muted)]">{m.role}</p>
              <p className="mt-1 text-xs text-[var(--ebz-muted)]">{m.reason}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-extrabold text-[var(--ebz-blue)]">{m.score}%</p>
              <p className="text-xs text-[var(--ebz-muted)]">Match</p>
            </div>
          </EbzCard>
        ))}
      </div>
    </div>
  );
}

function AktivitaetenScreen() {
  return (
    <div>
      <ScreenHeader title="Meine Aktivitäten" subtitle="Deine letzten Aktionen und Punkte." />
      <div className="space-y-3">
        {fx.myActivities.map((a, i) => (
          <EbzCard key={i} className="flex items-center gap-3 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--ebz-blue-soft)]">
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[var(--ebz-ink)]">{a.text}</p>
              <p className="text-xs text-[var(--ebz-muted)]">{a.when}</p>
            </div>
            {a.points > 0 && <PointsPill points={a.points} />}
          </EbzCard>
        ))}
      </div>
    </div>
  );
}

function NachrichtenScreen() {
  return (
    <div>
      <ScreenHeader title="Nachrichten" subtitle="Chats & Updates aus deinem Netzwerk." />
      <div className="space-y-2">
        {fx.messages.map((m) => (
          <EbzCard key={m.name} className="flex items-center gap-3 py-3">
            <EbzAvatar name={m.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-bold text-[var(--ebz-ink)]">{m.name}</p>
                <span className="shrink-0 text-xs text-[var(--ebz-muted)]">{m.when}</span>
              </div>
              <p className="truncate text-sm text-[var(--ebz-muted)]">{m.preview}</p>
            </div>
            {m.unread && (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--ebz-blue)]" />
            )}
          </EbzCard>
        ))}
      </div>
    </div>
  );
}

function GespeichertScreen() {
  return (
    <div>
      <ScreenHeader title="Gespeichert" subtitle="Deine Favoriten & Merkliste." />
      <div className="grid gap-3 sm:grid-cols-2">
        {fx.saved.map((s) => (
          <EbzCard key={s.title} className="flex items-center gap-3 py-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--ebz-blue-soft)]">
              🔖
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[var(--ebz-ink)]">{s.title}</p>
              <p className="truncate text-sm text-[var(--ebz-muted)]">{s.sub}</p>
            </div>
            <EbzTag tone="neutral">{s.type}</EbzTag>
          </EbzCard>
        ))}
      </div>
    </div>
  );
}

function FortschrittScreen() {
  return (
    <div>
      <ScreenHeader title="Mein Fortschritt" subtitle="Level, Punkte & Vorteile." />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <EbzCard className="flex flex-col items-center">
          <EbzRing
            value={fx.me.levelPct}
            max={100}
            centerTop={`${fx.me.levelPct}%`}
            centerBottom={fx.me.level}
          />
          <p className="mt-3 text-center text-sm text-[var(--ebz-muted)]">
            Nächste Stufe: {fx.me.nextLevel} · Noch {fx.me.pointsToNext} ActivePoints
          </p>
        </EbzCard>
        <EbzCard>
          <EbzSectionHeader title="Level & Vorteile" />
          <ul className="space-y-3">
            {fx.levelPerks.map((l) => (
              <li key={l.level} className="flex items-center gap-3">
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs ${
                    l.done
                      ? "bg-[var(--ebz-green)] text-white"
                      : "border border-[var(--ebz-line)] text-[var(--ebz-muted)]"
                  }`}
                >
                  {l.done ? "✓" : ""}
                </span>
                <span className="flex-1">
                  <span className="font-bold text-[var(--ebz-ink)]">{l.level}</span>
                  <span className="text-[var(--ebz-muted)]"> · {l.perk}</span>
                </span>
              </li>
            ))}
          </ul>
        </EbzCard>
      </div>
    </div>
  );
}

/* ── Service ─────────────────────────────────────────────────────────────── */

function PlaybookScreen() {
  return (
    <div>
      <ScreenHeader title="Playbook" subtitle="Anleitungen & Best Practices." />
      <div className="grid gap-3 sm:grid-cols-2">
        {fx.playbook.map((p) => (
          <EbzCard key={p.title}>
            <p className="font-bold text-[var(--ebz-ink)]">{p.title}</p>
            <p className="mt-1 text-sm text-[var(--ebz-muted)]">{p.sub}</p>
            <p className="mt-3 text-xs font-semibold text-[var(--ebz-blue)]">{p.read} Lesezeit</p>
          </EbzCard>
        ))}
      </div>
    </div>
  );
}

function EinstellungenScreen() {
  return (
    <div>
      <ScreenHeader title="Einstellungen" subtitle="Profil, Sicherheit & Konto." />
      <div className="space-y-2">
        {fx.settingsSections.map((s) => (
          <EbzCard key={s.title} className="flex items-center gap-3 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[var(--ebz-ink)]">{s.title}</p>
              <p className="text-sm text-[var(--ebz-muted)]">{s.desc}</p>
            </div>
            <span aria-hidden="true" className="text-[var(--ebz-muted)]">
              →
            </span>
          </EbzCard>
        ))}
      </div>
    </div>
  );
}

function HilfeScreen() {
  return (
    <div>
      <ScreenHeader title="Hilfe & Support" subtitle="Wir sind für dich da." />
      <EbzCard className="mb-4">
        <p className="font-bold text-[var(--ebz-ink)]">Wonach suchst du?</p>
        <div className="mt-3 rounded-lg border border-[var(--ebz-line)] px-3 py-2 text-sm text-[var(--ebz-muted)]">
          Frage eingeben…
        </div>
      </EbzCard>
      <EbzSectionHeader title="Häufige Fragen" />
      <ul className="space-y-2">
        {fx.helpTopics.map((q) => (
          <EbzCard key={q} className="flex items-center justify-between gap-3 py-3">
            <span className="text-[var(--ebz-ink)]">{q}</span>
            <span aria-hidden="true" className="text-[var(--ebz-muted)]">
              →
            </span>
          </EbzCard>
        ))}
      </ul>
    </div>
  );
}

/* ── Screen-Map ──────────────────────────────────────────────────────────── */

export const SCREENS: Record<VisionKey, () => ReactNode> = {
  uebersicht: UebersichtScreen,
  active: ActiveScreen,
  compass: CompassScreen,
  opportunities: OpportunitiesScreen,
  menschen: MenschenScreen,
  communities: CommunitiesScreen,
  organisationen: OrganisationenScreen,
  events: EventsScreen,
  academy: AcademyScreen,
  netzwerk: NetzwerkScreen,
  matchings: MatchingsScreen,
  aktivitaeten: AktivitaetenScreen,
  nachrichten: NachrichtenScreen,
  gespeichert: GespeichertScreen,
  fortschritt: FortschrittScreen,
  playbook: PlaybookScreen,
  einstellungen: EinstellungenScreen,
  hilfe: HilfeScreen,
};
