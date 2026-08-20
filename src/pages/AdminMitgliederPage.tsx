import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MemberCard } from "../components/community/MemberDirectory";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardTitle } from "../components/ui/Card";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { PageSkeleton } from "../components/ui/Skeleton";
import { useOverlay } from "../components/ui/useOverlay";
import { useToast } from "../components/ui/toast-context";
import { requestActivationLink } from "../lib/activation";
import {
  activateMember,
  adminMembersQueryKey,
  fetchAdminMembers,
  SEITENGROESSE,
  type AdminMember,
  type AdminMemberStatus,
} from "../lib/admin-members";

/**
 * Die Admin-Mitgliederliste (AGE-566).
 *
 * WARUM ES SIE GIBT: Nach dem WordPress-Import stehen 70 Mitglieder mit
 * `activated_at = null` in der Datenbank. Über jeden bestehenden Lesepfad —
 * Verzeichnis, `/p/:id`, Suche — sind sie für NIEMANDEN sichtbar, auch nicht
 * für einen Admin. Diese Fläche ist der einzige Ort, an dem sie vorkommen.
 *
 * WARUM DREI SICHTEN: Tabelle und Karten sind Verwaltung; die
 * Verzeichnis-Ansicht zeigt, was Mitglieder sehen, und benutzt dafür dieselbe
 * Karte wie `/mitglieder` statt sie nachzubauen. Sie verweist aber in den
 * Admin-Bereich — `/p/:id` verlangt ein bestätigtes Zielprofil und meldete für
 * genau die Mitglieder „nicht gefunden", derentwegen man hier ist.
 *
 * WAS SIE NICHT IST: eine Empfängerauswahl. Keine Mehrfachauswahl, kein „an
 * alle", keine Übernahme der Treffermenge — das bleibt AGE-304.
 *
 * DIE GRENZE STEHT IN DER DATENBANK. `is_admin()` sitzt im Rumpf der beiden
 * RPCs; `RequireAdmin` an der Route ist Komfort.
 */

type Sicht = "Tabelle" | "Karten" | "Verzeichnis";

const SICHTEN: Sicht[] = ["Tabelle", "Karten", "Verzeichnis"];

function fehlerText(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unbekannter Fehler.";
}

export default function AdminMitgliederPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /** Was im Feld steht. Der Abfrage liegt `query` zugrunde — entprellt, siehe unten. */
  const [eingabe, setEingabe] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AdminMemberStatus>("alle");
  const [seite, setSeite] = useState(0);

  // 300 ms Entprellung, dieselbe Zahl und derselbe Grund wie im Verzeichnis
  // (MemberDirectory.tsx): sonst löst JEDER Tastendruck eine RPC aus, und die
  // hier verbindet `profiles` mit `auth.users` und zählt zu jedem Treffer
  // Angebote und Bedarfe. Die Selects greifen weiterhin sofort — dort gibt es
  // kein Tippen, das man abwarten könnte.
  useEffect(() => {
    const id = setTimeout(() => {
      if (eingabe === query) return;
      setQuery(eingabe);
      // Ein neuer Suchbegriff fängt wieder auf Seite 1 an — Seite 4 einer
      // anderen Treffermenge ist keine sinnvolle Fortsetzung.
      setSeite(0);
    }, 300);
    return () => clearTimeout(id);
  }, [eingabe, query]);
  const [sicht, setSicht] = useState<Sicht>("Tabelle");
  /** Das Mitglied, für das die Rückfrage offen ist — nicht ein blosses `true`:
   *  der Dialog muss es NAMENTLICH nennen. */
  const [rueckfrage, setRueckfrage] = useState<AdminMember | null>(null);

  const filter = { query, status, seite };
  const { data, isLoading, isError, error } = useQuery({
    queryKey: adminMembersQueryKey(filter),
    queryFn: () => fetchAdminMembers(filter),
  });

  const zugangslink = useMutation({
    mutationFn: (m: AdminMember) => requestActivationLink(m.login_email),
    onSuccess: () =>
      toast({
        title: "Zugangslink angefordert",
        // Bewusst KEINE Aussage über einen Versand. `send-activation` antwortet
        // auf dem angenommenen Pfad immer mit 202, gleichgültig ob es die
        // Adresse gibt (Abwehr von Adressaufzählung) — der Statuscode belegt
        // also nichts. Er ist auch nicht die einzige Antwort: 405, 400, 500 und
        // 502 kommen ebenfalls vor, und die landen im onError darunter.
        description: "Ob eine Mail ankommt, sagt diese Antwort nicht.",
        variant: "success",
      }),
    onError: (e) =>
      toast({
        title: "Zugangslink fehlgeschlagen",
        description: fehlerText(e),
        variant: "error",
      }),
  });

  const aktivieren = useMutation({
    mutationFn: (m: AdminMember) => activateMember(m.id),
    onSuccess: async (_daten, m) => {
      setRueckfrage(null);
      toast({ title: `${m.name ?? "Mitglied"} ist aktiviert`, variant: "success" });
      // Nachladen, sonst bliebe die Zeile „nicht aktiviert" stehen, obwohl sie
      // es nicht mehr ist — und der nächste Klick liefe in die 22023. Und die
      // Zeile WANDERT: sortiert wird unbestätigte zuerst, sie rutscht also aus
      // der ersten Gruppe in die zweite.
      await queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (e) => {
      setRueckfrage(null);
      toast({ title: "Aktivierung fehlgeschlagen", description: fehlerText(e), variant: "error" });
    },
  });

  const members = data?.members ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-ink">Mitglieder</h1>
        <p className="text-sm text-muted">
          Alle Konten, auch die noch nicht bestätigten. Über das Verzeichnis sind diese für
          niemanden sichtbar — hier schon.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <Field label="Suche" className="min-w-56 flex-1">
          {({ id }) => (
            <Input
              id={id}
              value={eingabe}
              placeholder="Name oder Anmeldeadresse"
              onChange={(e) => setEingabe(e.target.value)}
            />
          )}
        </Field>
        <Field label="Status" className="w-48">
          {({ id }) => (
            <Select
              id={id}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as AdminMemberStatus);
                setSeite(0);
              }}
            >
              <option value="alle">Alle</option>
              <option value="offen">Nicht aktiviert</option>
              <option value="aktiviert">Aktiviert</option>
            </Select>
          )}
        </Field>
        <div className="flex gap-1" role="group" aria-label="Ansicht">
          {SICHTEN.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={sicht === s ? "primary" : "secondary"}
              aria-pressed={sicht === s}
              onClick={() => setSicht(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && <PageSkeleton />}
      {isError && (
        <Card className="p-5">
          <CardTitle>Die Liste konnte nicht geladen werden</CardTitle>
          <p className="mt-1 text-sm text-muted">{fehlerText(error)}</p>
        </Card>
      )}

      {!isLoading && !isError && members.length === 0 && (
        <Card className="p-5">
          <CardTitle>Keine Mitglieder gefunden</CardTitle>
          <p className="mt-1 text-sm text-muted">
            {seite === 0
              ? "Zu diesem Filter gibt es keine Treffer. Ohne Filter zeigt die Liste alle Konten."
              : "Diese Seite ist leer — die Treffermenge ist kleiner geworden, seit sie geöffnet wurde."}
          </p>
          {/* Die Blätterung unten rendert nur NEBEN Treffern. Ohne diesen Ausweg
              säße der Admin auf einer leeren Seite fest: aktiviert er im Filter
              „Nicht aktiviert" die letzte Zeile der letzten Seite, lädt die
              Liste neu, hat null Treffer — und mit ihnen verschwindet der
              „Zurück"-Knopf. Gefunden im Diff-Review (AGE-566). */}
          {seite > 0 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-4"
              onClick={() => setSeite(0)}
            >
              Zur ersten Seite
            </Button>
          )}
        </Card>
      )}

      {!isLoading && !isError && members.length > 0 && (
        <>
          {sicht === "Tabelle" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Anmeldeadresse</th>
                    <th className="py-2 pr-4">Zustand</th>
                    <th className="py-2">Handlungen</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr
                      key={m.id}
                      data-testid={`mitglied-${m.id}`}
                      className="border-b border-line"
                    >
                      <td className="py-2 pr-4">
                        <Link to={`/admin/mitglied/${m.id}`} className="font-medium text-ink">
                          {m.name ?? "Ohne Namen"}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-muted">{m.login_email}</td>
                      <td className="py-2 pr-4">
                        <Zustand member={m} />
                      </td>
                      <td className="py-2">
                        <Handlungen
                          member={m}
                          onZugangslink={() => zugangslink.mutate(m)}
                          onAktivieren={() => setRueckfrage(m)}
                          laeuft={zugangslink.isPending || aktivieren.isPending}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sicht === "Karten" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((m) => (
                <Card
                  key={m.id}
                  data-testid={`mitglied-${m.id}`}
                  className="flex flex-col gap-3 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/admin/mitglied/${m.id}`} className="font-medium text-ink">
                      {m.name ?? "Ohne Namen"}
                    </Link>
                    <Zustand member={m} />
                  </div>
                  <p className="text-sm text-muted">{m.login_email}</p>
                  <Handlungen
                    member={m}
                    onZugangslink={() => zugangslink.mutate(m)}
                    onAktivieren={() => setRueckfrage(m)}
                    laeuft={zugangslink.isPending || aktivieren.isPending}
                  />
                </Card>
              ))}
            </div>
          )}

          {sicht === "Verzeichnis" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((m) => (
                <div
                  key={m.id}
                  data-testid={`mitglied-${m.id}`}
                  className="flex h-full flex-col gap-2"
                >
                  {/* Dieselbe Karte wie /mitglieder, mit einem anderen Ziel.
                      Zustand und Handlungen stehen DANEBEN und nicht darin: die
                      Karte ist ein Link, und ein Knopf in einem Link ist weder
                      gültiges HTML noch bedienbar.

                      `flex-1` an der Karte, damit die Handlungszeilen über die
                      Spalten hinweg FLUCHTEN. Ohne das hing jede an ihrer
                      unterschiedlich hohen Karte, und die Sichtprobe zeigte
                      eine Treppe statt eines Rasters. */}
                  <div className="flex-1">
                    <MemberCard member={m} to={`/admin/mitglied/${m.id}`} />
                  </div>
                  {/* Umbrechend statt `justify-between`: in einer schmalen Spalte
                      riss letzteres „Nicht aktiviert" auf zwei Zeilen und
                      stapelte die Knöpfe. */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Zustand member={m} />
                    <Handlungen
                      member={m}
                      onZugangslink={() => zugangslink.mutate(m)}
                      onAktivieren={() => setRueckfrage(m)}
                      laeuft={zugangslink.isPending || aktivieren.isPending}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Blaetterung
            seite={seite}
            anzahl={members.length}
            hatWeitere={data?.hatWeitere ?? false}
            onZurueck={() => setSeite((s) => Math.max(0, s - 1))}
            onWeiter={() => setSeite((s) => s + 1)}
          />
        </>
      )}

      {rueckfrage && (
        <Rueckfrage
          member={rueckfrage}
          laeuft={aktivieren.isPending}
          onAbbrechen={() => setRueckfrage(null)}
          onBestaetigen={() => aktivieren.mutate(rueckfrage)}
        />
      )}
    </div>
  );
}

/** Der Aktivierungszustand — in JEDER Sicht, sonst hiesse „drei Sichten auf
 *  dieselben Zeilen" drei verschiedene Wahrheiten. */
function Zustand({ member }: { member: AdminMember }) {
  return member.bestaetigt ? (
    <Badge variant="soft">Aktiviert</Badge>
  ) : (
    <Badge variant="neutral">Nicht aktiviert</Badge>
  );
}

function Handlungen({
  member,
  onZugangslink,
  onAktivieren,
  laeuft,
}: {
  member: AdminMember;
  onZugangslink: () => void;
  onAktivieren: () => void;
  laeuft: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* GEWICHTUNG, gefunden in der Sichtprobe und nicht in den Tests: der
          reguläre Weg trägt die Akzentfarbe, der unumkehrbare steht still
          daneben. Zuerst war es umgekehrt — „Direkt aktivieren" war fünfundzwanzig
          Mal untereinander der auffälligste Punkt der Seite, und das ist genau
          die Handlung, die niemand versehentlich treffen soll. */}
      <Button type="button" size="sm" variant="ghost" disabled={laeuft} onClick={onZugangslink}>
        Zugangslink schicken
      </Button>
      {/* NUR an unbestätigten Zeilen. An einer bestätigten bräche die RPC mit
          22023 ab — einen Knopf anzubieten, dessen einziger Ausgang ein Fehler
          ist, wäre eine Einladung zum Fehlklick. */}
      {!member.bestaetigt && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={laeuft}
          onClick={onAktivieren}
        >
          Direkt aktivieren
        </Button>
      )}
    </div>
  );
}

/**
 * Die Rückfrage vor dem direkten Aktivieren.
 *
 * Sie nennt das Mitglied NAMENTLICH und benennt die Folge. Das ist keine
 * Höflichkeit: `mark_activated` schreibt `coalesce(activated_at, now())`, ein
 * Rücksetzweg besteht nicht, und ein Fehlklick ist durch die Oberfläche nicht
 * heilbar. Die erste Fassung des Entwurfs verliess sich auf „optisch getrennt"
 * — das ist eine Gestaltungsabsicht, keine Sicherung.
 */
function Rueckfrage({
  member,
  laeuft,
  onAbbrechen,
  onBestaetigen,
}: {
  member: AdminMember;
  laeuft: boolean;
  onAbbrechen: () => void;
  onBestaetigen: () => void;
}) {
  const overlay = useOverlay(true);

  return (
    <div
      ref={overlay}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Mitglied direkt aktivieren"
    >
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={onAbbrechen} />
      <div className="relative w-full max-w-md rounded-[var(--radius-card)] bg-canvas p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-ink">
          {member.name ?? "Dieses Mitglied"} jetzt aktivieren?
        </h2>
        <p className="mt-2 text-sm text-muted">
          Die Angaben von <strong>{member.name ?? "diesem Mitglied"}</strong> werden damit für
          andere Mitglieder im Verzeichnis sichtbar. Das lässt sich hier nicht rückgängig machen.
        </p>
        <p className="mt-2 text-sm text-muted">
          Der reguläre Weg ist „Zugangslink schicken" — dann bestätigt das Mitglied selbst.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onAbbrechen}>
            Abbrechen
          </Button>
          <Button type="button" disabled={laeuft} onClick={onBestaetigen}>
            Aktivieren
          </Button>
        </div>
      </div>
    </div>
  );
}

function Blaetterung({
  seite,
  anzahl,
  hatWeitere,
  onZurueck,
  onWeiter,
}: {
  seite: number;
  anzahl: number;
  hatWeitere: boolean;
  onZurueck: () => void;
  onWeiter: () => void;
}) {
  // `anzahl` ist hier immer > 0: die Blätterung rendert nur neben Treffern, den
  // leeren Fall trägt der Bereich darüber. Ein „keine Treffer"-Zweig wäre toter
  // Code — und verstiesse zusätzlich gegen die Wortregel für leere Zustände
  // (src/components/ui/EmptyState.wording.test.tsx).
  const von = seite * SEITENGROESSE + 1;
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted">{`Mitglieder ${von}–${von + anzahl - 1}`}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={seite === 0}
          onClick={onZurueck}
        >
          Zurück
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!hatWeitere}
          onClick={onWeiter}
        >
          Weiter
        </Button>
      </div>
    </div>
  );
}
