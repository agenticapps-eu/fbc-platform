import { captureMessage } from "@sentry/react";
import { useState, type ReactNode } from "react";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardDescription, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Logo } from "../components/ui/Logo";
import { Tabs } from "../components/ui/Tabs";
import { TierBadge } from "../components/ui/TierBadge";
import { ToastProvider } from "../components/ui/Toast";
import { useToast } from "../components/ui/toast-context";

const COLORS: { name: string; token: string; className: string; dark?: boolean }[] = [
  { name: "Emerald / Primary", token: "#0E5C4A", className: "bg-emerald", dark: true },
  { name: "Emerald Dark", token: "#0A3D33", className: "bg-emerald-dark", dark: true },
  { name: "Gold / Accent", token: "#B8893B", className: "bg-gold", dark: true },
  { name: "Gold Dark", token: "#7A5A26", className: "bg-gold-dark", dark: true },
  { name: "Gold Light", token: "#EFE3C8", className: "bg-gold-light" },
  { name: "Warmweiß", token: "#F2F1EC", className: "bg-warm" },
  { name: "Ink", token: "#262626", className: "bg-ink", dark: true },
  { name: "Grey", token: "#5B6770", className: "bg-grey", dark: true },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-grey/70">{title}</h2>
      {children}
    </section>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="secondary"
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
        variant="secondary"
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
        variant="secondary"
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
        <Button variant="secondary" size="sm" onClick={() => setBoom(true)}>
          Render-Fehler werfen (ErrorBoundary + Sentry)
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => captureMessage("FBC Sentry-Test-Message", "info")}
        >
          Test-Message senden
        </Button>
      </div>
      <p className="text-xs text-grey">
        Events erscheinen nur in Sentry, wenn <code>VITE_SENTRY_DSN</code> gesetzt ist.
      </p>
    </div>
  );
}

export default function StyleguidePage() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-warm px-6 py-12 text-ink lg:px-12">
        <div className="mx-auto max-w-5xl space-y-14">
          {/* Kopf */}
          <header className="space-y-3 border-b border-ink/8 pb-8">
            <Logo />
            <h1 className="text-3xl font-semibold tracking-tight">FBC Design-System</h1>
            <p className="max-w-2xl text-grey">
              Smaragd &amp; Gold — exklusiver Premium-Club, ruhig, viel Weißraum. Diese Seite ist
              nur im Dev-Modus erreichbar und zeigt Tokens und Basis-Komponenten.
            </p>
          </header>

          {/* Farben */}
          <Section title="Farb-Tokens">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {COLORS.map((c) => (
                <div
                  key={c.token}
                  className="overflow-hidden rounded-xl border border-ink/5 bg-white shadow-soft"
                >
                  <div className={`flex h-20 items-end p-3 ${c.className}`}>
                    <span className={`text-xs font-medium ${c.dark ? "text-warm" : "text-ink"}`}>
                      {c.token}
                    </span>
                  </div>
                  <div className="px-3 py-2 text-xs font-medium text-grey">{c.name}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Typografie */}
          <Section title="Typografie — Inter">
            <Card className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight">
                Headline H1 — ruhig &amp; klar
              </h1>
              <h2 className="text-2xl font-semibold tracking-tight">Headline H2</h2>
              <h3 className="text-lg font-semibold">Headline H3</h3>
              <p className="max-w-2xl text-grey">
                Fließtext in Grey mit großzügiger Zeilenhöhe. Das FBC-System setzt auf viel Weißraum
                und zurückhaltende Akzente statt FinTech-Dichte.
              </p>
              <p className="text-sm text-grey">Kleiner Text / Caption.</p>
            </Card>
          </Section>

          {/* Buttons */}
          <Section title="Buttons">
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
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
        </div>
      </div>
    </ToastProvider>
  );
}
