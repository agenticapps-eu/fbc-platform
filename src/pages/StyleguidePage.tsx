import { captureMessage } from "@sentry/react";
import { useState, type ReactNode } from "react";
import { logEvent } from "../lib/log";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Logo } from "../components/ui/Logo";
import { CountUp } from "../components/ui/Motion";
import { Tabs } from "../components/ui/Tabs";
import { TierBadge } from "../components/ui/TierBadge";
import { ToastProvider } from "../components/ui/Toast";
import { useToast } from "../components/ui/toast-context";
import { DESIGN_VARIANT_IDS, DESIGN_VARIANTS } from "../config/designVariants";
import { cn } from "../lib/cn";
import { useDesignVariant } from "../providers/design-variant-context";

const COLORS: { name: string; token: string; className: string; dark?: boolean }[] = [
  { name: "Night / Chrome", token: "#0E0F12", className: "bg-night", dark: true },
  { name: "Night Elevated", token: "#16181D", className: "bg-night-elevated", dark: true },
  { name: "Gold / Accent", token: "#C2A24E", className: "bg-gold", dark: true },
  { name: "Gold Strong", token: "#B8893B", className: "bg-gold-strong", dark: true },
  { name: "Gold Soft", token: "#EFE3C8", className: "bg-gold-soft" },
  { name: "Canvas", token: "#FFFFFF", className: "bg-canvas" },
  { name: "Soft / Seite", token: "#F6F5F1", className: "bg-soft" },
  { name: "Ink / Text", token: "#14151A", className: "bg-ink", dark: true },
  { name: "Muted", token: "#6B7280", className: "bg-muted", dark: true },
  { name: "Line", token: "#E7E5DF", className: "bg-line" },
  { name: "Positive", token: "#1F9D6B", className: "bg-positive", dark: true },
  { name: "Danger", token: "#B23A2E", className: "bg-danger", dark: true },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted/70">{title}</h2>
      {children}
    </section>
  );
}

/** Inline-Demo: Stat-Tile (große Zahl + gemutetes Label + Trend in Positive). */
function StatTile({ label, value, trend }: { label: string; value: string; trend?: string }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">{value}</p>
      {trend && <p className="mt-1 text-sm font-medium text-positive">{trend}</p>}
    </Card>
  );
}

/** Inline-Demo: dünner Fortschrittsbalken, Gold-Füllung auf Line. */
function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-gold" style={{ width: `${value}%` }} />
    </div>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          toast({
            title: "Gespeichert",
            description: "Profil wurde aktualisiert.",
            variant: "success",
          })
        }
      >
        Success-Toast
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          toast({
            title: "Fehlgeschlagen",
            description: "Bitte erneut versuchen.",
            variant: "error",
          })
        }
      >
        Error-Toast
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toast({ title: "Hinweis", description: "Eine ruhige Benachrichtigung." })}
      >
        Default-Toast
      </Button>
    </div>
  );
}

function SentryTestSection() {
  const [boom, setBoom] = useState(false);
  // Render-Fehler → von der App-ErrorBoundary gefangen + an Sentry gemeldet.
  if (boom) throw new Error("FBC Sentry-Test — absichtlicher Render-Fehler");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" size="sm" onClick={() => setBoom(true)}>
          Render-Fehler werfen (ErrorBoundary + Sentry)
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => captureMessage("FBC Sentry-Test-Message", "info")}
        >
          Test-Message senden
        </Button>
      </div>
      <p className="text-xs text-muted">
        Events erscheinen nur in Sentry, wenn <code>VITE_SENTRY_DSN</code> gesetzt ist.
      </p>
    </div>
  );
}

function AxiomTestSection() {
  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={() => logEvent("login", { test: true })}>
        Test-Event an <code>/api/log</code> senden
      </Button>
      <p className="text-xs text-muted">
        Geht über den Server-Proxy <code>/api/log</code> an Axiom. Erscheint nur, wenn die Function
        läuft (<code>wrangler pages dev</code> oder Deploy) und <code>AXIOM_TOKEN</code>/
        <code>AXIOM_DATASET</code> gesetzt sind. Bei reinem <code>vite dev</code> laufen Pages
        Functions nicht.
      </p>
    </div>
  );
}

/** Live-Umschaltbare Design-Varianten + Animations-Demo (AGE-237). */
function VariantsSection() {
  const { variant, setVariant, meta } = useDesignVariant();
  return (
    <Section title="Design-Varianten (Live-Switcher)">
      <p className="-mt-2 text-sm text-muted">
        Sieben umschaltbare Looks als Theming-/Animations-Schicht (<code>data-variant</code>) — A–D
        plus die experimentellen E/F/G (Noir Editorial · Aurora Glass · Warm Boutique). Die Auswahl
        wird in localStorage + URL (<code>?variant=</code>) gespiegelt. Aktiv:{" "}
        <strong className="text-ink">{meta.label}</strong>.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DESIGN_VARIANT_IDS.map((id) => {
          const v = DESIGN_VARIANTS[id];
          const active = id === variant;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setVariant(id)}
              aria-pressed={active}
              className={cn(
                "fbc-card rounded-[var(--radius-card)] border p-4 text-left",
                active
                  ? "border-gold bg-gold-soft/40"
                  : "border-line bg-canvas hover:border-gold/50",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold uppercase",
                    active ? "bg-gold text-night" : "bg-ink/[0.07] text-ink",
                  )}
                >
                  {id}
                </span>
                <span className="font-display text-base font-semibold text-ink">{v.label}</span>
                {v.recommended && (
                  <span className="text-gold-strong" title="Empfehlung">
                    ★
                  </span>
                )}
                {v.experimental && (
                  <span className="rounded-full border border-gold/40 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-gold-strong">
                    Experimentell
                  </span>
                )}
                {v.accent2 && (
                  <span
                    className="ml-auto h-3.5 w-3.5 rounded-full border border-line"
                    style={{ backgroundColor: v.accent2 }}
                    title={`Zweitakzent ${v.accent2}`}
                  />
                )}
              </div>
              <p className="mt-2 text-xs text-muted">{v.description}</p>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-muted/80">
                {v.motion} · {v.heroStyle} · {v.headlineFont}
                {v.cardStyle && v.cardStyle !== "solid" && ` · ${v.cardStyle}`}
                {v.backdrop && v.backdrop !== "none" && ` · ${v.backdrop}`}
              </p>
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Card className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted">Count-up</p>
          <CountUp
            value={842}
            className="mt-1 block font-display text-3xl font-semibold text-gold-strong"
          />
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-xs uppercase tracking-wide text-muted">Tier-Puls (b/d)</p>
          <TierBadge tier="legacy" />
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-xs uppercase tracking-wide text-muted">Button-Sheen</p>
          <Button size="sm">Hover mich</Button>
        </Card>
      </div>
    </Section>
  );
}

export default function StyleguidePage() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-soft px-6 py-12 text-ink lg:px-12">
        <div className="mx-auto max-w-5xl space-y-14">
          {/* Kopf */}
          <header className="space-y-3 border-b border-line pb-8">
            <Logo />
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              FBC Design-System
            </h1>
            <p className="max-w-2xl text-muted">
              Schwarz &amp; Gold — elegant, modern, exklusiv. Schwarz/Anthrazit als Chrome, Gold als
              einziger Akzent, helle ruhige Content-Flächen. Diese Seite ist nur im Dev-Modus
              erreichbar und zeigt Tokens und Basis-Komponenten.
            </p>
          </header>

          {/* Design-Varianten (Live-Switcher + Animations-Demo) */}
          <VariantsSection />

          {/* Chrome-Vorschau (dunkel) */}
          <Section title="Chrome — Schwarz &amp; Gold">
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-night-border bg-night p-6 shadow-soft">
              <Logo tone="dark" />
              <div className="mt-5 flex flex-col gap-1">
                <span className="relative rounded-md bg-night-elevated px-3 py-2 text-sm font-medium text-gold">
                  <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-gold" />
                  Aktive Route (Gold-Label + Gold-Linksbalken)
                </span>
                <span className="rounded-md px-3 py-2 text-sm text-on-night-muted">
                  Inaktive Route
                </span>
              </div>
            </div>
          </Section>

          {/* Farben */}
          <Section title="Farb-Tokens">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {COLORS.map((c) => (
                <div
                  key={c.token}
                  className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas shadow-soft"
                >
                  <div className={`flex h-20 items-end p-3 ${c.className}`}>
                    <span
                      className={`text-xs font-medium ${c.dark ? "text-on-night" : "text-ink"}`}
                    >
                      {c.token}
                    </span>
                  </div>
                  <div className="px-3 py-2 text-xs font-medium text-muted">{c.name}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Typografie */}
          <Section title="Typografie — Cormorant Garamond (Display) &amp; Inter (UI)">
            <Card className="space-y-3">
              <h1 className="font-display text-5xl font-semibold tracking-tight">
                Eine Gemeinschaft, die trägt
              </h1>
              <h2 className="font-display text-3xl font-semibold tracking-tight">
                Display-Headline H2 — Serif
              </h2>
              <h3 className="text-lg font-semibold">UI-Headline H3 — Inter</h3>
              <p className="max-w-2xl text-muted">
                Fließtext in Inter mit großzügiger Zeilenhöhe. Das FBC-System setzt auf viel
                Weißraum, feine Linien und einen einzigen Gold-Akzent statt FinTech-Dichte.
              </p>
              <p className="text-sm text-muted">Kleiner Text / Caption.</p>
            </Card>
          </Section>

          {/* Buttons */}
          <Section title="Buttons">
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary">Primary (Gold)</Button>
              <Button variant="secondary">Secondary (Dunkel)</Button>
              <Button variant="ghost">Ghost (Gold-Outline)</Button>
              <Button variant="primary" size="sm">
                Primary klein
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
            </div>
          </Section>

          {/* Badges / Mitgliedsstufen */}
          <Section title="Badges — Mitgliedsstufen">
            <div className="flex flex-wrap items-center gap-3">
              <TierBadge tier="discover" />
              <TierBadge tier="prime" />
              <TierBadge tier="legacy" />
              <Badge variant="neutral">Neutral</Badge>
            </div>
          </Section>

          {/* Stat-Tiles */}
          <Section title="Stat-Tiles">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatTile label="Mitglieder" value="248" trend="+12 % MoM" />
              <StatTile label="Matches" value="37" trend="+5 diese Woche" />
              <StatTile label="Events" value="6" />
            </div>
          </Section>

          {/* Fortschritt */}
          <Section title="Fortschrittsbalken">
            <Card className="max-w-md space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-ink">Profil-Vollständigkeit</span>
                  <span className="text-muted">72 %</span>
                </div>
                <Progress value={72} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-ink">Onboarding</span>
                  <span className="text-muted">30 %</span>
                </div>
                <Progress value={30} />
              </div>
            </Card>
          </Section>

          {/* Avatare */}
          <Section title="Avatare">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name="Donald Vlahovic" size="lg" />
              <Avatar name="Fair Business" size="md" />
              <Avatar name="A" size="sm" />
            </div>
          </Section>

          {/* Formular */}
          <Section title="Eingabe-Felder">
            <Card className="max-w-md space-y-5">
              <Field label="E-Mail" hint="Wir geben deine Adresse niemals weiter." required>
                {({ id, invalid }) => (
                  <Input id={id} invalid={invalid} type="email" placeholder="name@firma.de" />
                )}
              </Field>
              <Field label="Firma (Fehler-Beispiel)" error="Dieses Feld ist erforderlich.">
                {({ id, invalid }) => <Input id={id} invalid={invalid} placeholder="Firmenname" />}
              </Field>
            </Card>
          </Section>

          {/* Tabs */}
          <Section title="Tabs">
            <Card>
              <Tabs
                tabs={[
                  {
                    value: "uebersicht",
                    label: "Übersicht",
                    content: "Ruhige Übersichts-Inhalte.",
                  },
                  { value: "matching", label: "Matching", content: "Suche ⇄ Biete." },
                  { value: "events", label: "Events", content: "Kommende Termine." },
                ]}
              />
            </Card>
          </Section>

          {/* Cards */}
          <Section title="Cards">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardTitle>Mitglieds-Profil</CardTitle>
                <CardDescription>
                  Eine ruhige Karte mit weichem Schatten und feiner Kontur.
                </CardDescription>
              </Card>
              <Card className="border-t-2 border-t-gold">
                <CardTitle>Mit Goldakzent</CardTitle>
                <CardDescription>Feine Goldlinie als Premium-Akzent.</CardDescription>
              </Card>
            </div>
          </Section>

          {/* Empty State */}
          <Section title="Empty State">
            <EmptyState
              title="Noch keine Matches"
              description="Sobald passende Mitglieder gefunden werden, erscheinen sie hier."
              action={<Button variant="primary">Profil vervollständigen</Button>}
            />
          </Section>

          {/* Toast */}
          <Section title="Toast">
            <ToastDemo />
          </Section>

          {/* Sentry (Dev) */}
          <Section title="Sentry (Dev)">
            <SentryTestSection />
          </Section>

          {/* Axiom (Dev) */}
          <Section title="Axiom (Dev)">
            <AxiomTestSection />
          </Section>
        </div>
      </div>
    </ToastProvider>
  );
}
