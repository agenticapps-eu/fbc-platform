import { captureMessage } from "@sentry/react";
import { LEVEL_ORDER } from "../config/levels";
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
import { PageHero } from "../components/ui/PageHero";
import { CountUp } from "../components/ui/Motion";
import { Tabs } from "../components/ui/Tabs";
import { TierBadge } from "../components/ui/TierBadge";
import { ToastProvider } from "../components/ui/Toast";
import { useToast } from "../components/ui/toast-context";
import { DESIGN_VARIANT_IDS, DESIGN_VARIANTS } from "../config/designVariants";
import { cn } from "../lib/cn";
import { useDesignVariant } from "../providers/design-variant-context";

/* Die Hex-Werte sind die des HELLEN Themes — im Navy-Theme tragen dieselben
   Token-Namen andere Werte. Die Fläche daneben liest immer das Token, nie den
   Hex-Wert: so zeigt der Umschalter oben auch hier den echten Unterschied. */
const COLORS: { name: string; token: string; className: string }[] = [
  { name: "Akzent", token: "#2F6BD1", className: "bg-accent" },
  { name: "Akzent kräftig", token: "#1F53B0", className: "bg-accent-strong" },
  { name: "Akzent weich", token: "#EFF5FD", className: "bg-accent-soft" },
  { name: "Chrome (Sidebar)", token: "#FFFFFF", className: "bg-chrome" },
  { name: "Chrome erhöht", token: "#F6F8FB", className: "bg-chrome-elevated" },
  { name: "Canvas (Karten)", token: "#FFFFFF", className: "bg-canvas" },
  { name: "Soft (Seite)", token: "#F6F8FB", className: "bg-soft" },
  { name: "Ink (Fließtext)", token: "#1E2A3A", className: "bg-ink" },
  { name: "Ink kräftig", token: "#0C2043", className: "bg-ink-strong" },
  { name: "Muted", token: "#64748B", className: "bg-muted" },
  { name: "Line", token: "#E2E8F0", className: "bg-line" },
  { name: "Success / Positive", token: "#167A5B", className: "bg-success" },
  { name: "Warning", token: "#B4761A", className: "bg-warning" },
  { name: "Danger", token: "#B23B3B", className: "bg-danger" },
];

/** Die Blau-Rampe — die einzige Akzentfamilie des Systems.
 *
 *  Klassennamen stehen hier VOLLSTÄNDIG und nicht als `bg-blue-${step}`:
 *  Tailwind scannt den Quelltext nach ganzen Klassennamen und generiert für ein
 *  zusammengesetztes Literal keine einzige Regel. Der Balken bliebe unsichtbar,
 *  und weder Typecheck noch Lint sagten ein Wort. */
const BLUE_RAMP: { step: string; className: string }[] = [
  { step: "50", className: "bg-blue-50" },
  { step: "100", className: "bg-blue-100" },
  { step: "200", className: "bg-blue-200" },
  { step: "300", className: "bg-blue-300" },
  { step: "400", className: "bg-blue-400" },
  { step: "500", className: "bg-blue-500" },
  { step: "600", className: "bg-blue-600" },
  { step: "700", className: "bg-blue-700" },
  { step: "800", className: "bg-blue-800" },
  { step: "900", className: "bg-blue-900" },
  { step: "950", className: "bg-blue-950" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      {/* text-muted, nicht text-muted/70: mit der Abschwächung liegt die
          Überschrift bei 2.24:1 und verfehlt AA deutlich. */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{title}</h2>
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

/** Inline-Demo: dünner Fortschrittsbalken, Akzent-Füllung auf Line. */
function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full rounded-full bg-accent" style={{ width: `${value}%` }} />
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

/** Theme-Umschalter + Animations-Demo. */
function VariantsSection() {
  const { variant, setVariant, meta } = useDesignVariant();
  return (
    <Section title="Themes">
      <p className="-mt-2 text-sm text-muted">
        Zwei Themes als reine Token-Schicht (<code>data-variant</code>) — dieselben Token-Namen,
        andere Werte. Die Wahl liegt in localStorage, eingeloggt zusätzlich in{" "}
        <code>member_settings.theme</code>. Aktiv:{" "}
        <strong className="text-ink">{meta.label}</strong>.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
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
                  ? "border-accent bg-accent-soft/40"
                  : "border-line bg-canvas hover:border-accent/50",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold uppercase",
                    active ? "bg-accent text-chrome" : "bg-ink/[0.07] text-ink",
                  )}
                >
                  {id}
                </span>
                <span className="font-display text-base font-semibold text-ink">{v.label}</span>
              </div>
              <p className="mt-2 text-xs text-muted">{v.description}</p>
            </button>
          );
        })}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Card className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted">Count-up</p>
          <CountUp
            value={842}
            className="mt-1 block font-display text-3xl font-semibold text-accent-strong"
          />
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-xs uppercase tracking-wide text-muted">Tier-Puls (b/d)</p>
          <TierBadge tier="impact" />
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
              eff.bee.zee Design-System
            </h1>
            <p className="max-w-2xl text-muted">
              Ein System, zwei Themes, eine Akzentfamilie. Blau ist der einzige Akzent; beide Themes
              teilen sich dieselben Token-Namen, sodass keine Komponente ihr Theme kennen muss.
              Diese Seite ist nur im Dev-Modus erreichbar und ist die lebende Fassung von{" "}
              <code className="text-accent">docs/design-system.html</code> — schalte oben um, alles
              hier wechselt mit.
            </p>
          </header>

          {/* Design-Varianten (Live-Switcher + Animations-Demo) */}
          <VariantsSection />

          {/* Seitenkopf mit Bild (AGE-499) */}
          <Section title="Seitenkopf — Bild, Verlauf, Titel">
            <PageHero
              image="/images/hero-see.webp"
              eyebrow="Guten Morgen, Detlev"
              title={
                <>
                  Deine nächste Chance
                  <br className="hidden sm:block" /> beginnt hier.
                </>
              }
              subtitle="Entdecke neue Chancen, spannende Menschen und wertvolle Impulse."
            />
            <p className="mt-3 text-sm text-muted">
              Das Foto blutet rechts aus, der Verlauf hält die linke Hälfte als ruhige Fläche —
              Fließtext steht nie auf dem Bild. Bilder liegen selbst gehostet unter /images (Quelle
              und Lizenz: public/images/CREDITS.md).
            </p>
          </Section>

          {/* Chrome-Vorschau (Sidebar-Fläche) */}
          <Section title="Chrome — Sidebar-Fläche">
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-chrome-border bg-chrome p-6 shadow-soft">
              <Logo />
              <div className="mt-5 flex flex-col gap-1">
                <span className="relative rounded-md bg-chrome-elevated px-3 py-2 text-sm font-medium text-accent">
                  <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-accent" />
                  Aktive Route (Akzent-Label + Akzent-Linksbalken)
                </span>
                <span className="rounded-md px-3 py-2 text-sm text-on-chrome-muted">
                  Inaktive Route
                </span>
              </div>
            </div>
            <p className="text-sm text-muted">
              Die Sidebar sitzt am Rand, nicht schwebend — Entscheidung aus dem Meeting, sie gilt
              besonders im Navy-Theme. Im hellen Theme ist die Chrome-Fläche weiß, im Navy-Theme
              tiefes Navy; die Token-Namen bleiben in beiden dieselben.
            </p>
          </Section>

          {/* Blau-Rampe */}
          <Section title="Blau — die einzige Akzentfamilie">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-11">
              {BLUE_RAMP.map(({ step, className }) => (
                <div
                  key={step}
                  className="overflow-hidden rounded-md border border-line bg-canvas text-center"
                >
                  <div className={cn("h-14", className)} />
                  <div className="px-1 py-1.5 text-[11px] font-medium text-muted">{step}</div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted">
              Die frühere Akzentfamilie, Grün und ein Zweitakzent sind ersatzlos entfallen. Braucht
              eine Fläche Aufmerksamkeit, bekommt sie Blau — aber nur eine pro Bildschirm.
            </p>
          </Section>

          {/* Farben */}
          <Section title="Farb-Tokens">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {COLORS.map((c) => (
                <div
                  key={c.token}
                  className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas shadow-soft"
                >
                  {/* Der Hex-Wert steht UNTER der Fläche, nicht darauf. Auf der
                      Fläche bräuchte er je Token und je Theme eine eigene
                      Textfarbe — der alte `dark ? text-on-chrome : text-ink`
                      lag im hellen Theme durchweg falsch, weil on-chrome dort
                      dunkel ist. Darunter ist der Kontrast in beiden Themes
                      derselbe wie überall sonst. */}
                  <div className={cn("h-20", c.className)} />
                  <div className="space-y-0.5 px-3 py-2">
                    <div className="text-xs font-medium text-ink">{c.name}</div>
                    <div className="font-mono text-[11px] text-muted">{c.token}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Typografie */}
          <Section title="Typografie — Fraunces (Display) &amp; Inter (UI)">
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
                Weißraum, feine Linien und einen einzigen Akzent statt FinTech-Dichte.
              </p>
              <p className="text-sm text-muted">Kleiner Text / Caption.</p>
            </Card>
          </Section>

          {/* Buttons */}
          <Section title="Buttons">
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary">Primary (Akzent)</Button>
              <Button variant="secondary">Secondary (Dunkel)</Button>
              <Button variant="ghost">Ghost (Akzent-Outline)</Button>
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
              {LEVEL_ORDER.map((level) => (
                <TierBadge key={level} tier={level} />
              ))}
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
              <Card className="border-t-2 border-t-accent">
                <CardTitle>Mit Akzentlinie</CardTitle>
                <CardDescription>Feine Akzentlinie als Premium-Detail.</CardDescription>
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
