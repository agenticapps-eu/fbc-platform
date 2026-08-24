import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { MemberCard } from "../components/community/MemberDirectory";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardTitle } from "../components/ui/Card";
import { Field } from "../components/ui/Field";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { PageSkeleton } from "../components/ui/Skeleton";
import { TierBadge } from "../components/ui/TierBadge";
import { useOverlay } from "../components/ui/useOverlay";
import { useToast } from "../components/ui/toast-context";
import { requestActivationLink } from "../lib/activation";
import {
  activateMember,
  adminMembersQueryKey,
  fetchAdminMembers,
  SEITENGROESSE,
  setMemberBan,
  updateMitgliedschaft,
  ZAHLUNGSARTEN,
  type AdminMember,
  type AdminMemberStatus,
  type LebenszyklusAktion,
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

/**
 * Die fünf Reiter (AGE-581, Abschnitt 8) — und ihre Abbildung auf `p_status`
 * ist NICHT die Identität. Genau deshalb steht sie hier ausgeschrieben statt
 * aus dem Namen erraten zu werden:
 *
 * - „Mitgliedschaft" ist ein **Darstellungsmodus über derselben Menge wie
 *   „Alle"**, kein eigener Filter — beide fragen `alle` ab. Was sie
 *   unterscheidet, ist die Darstellung, und die hängt an der Kennung des
 *   Reiters, nicht an einem zweiten Feld ohne Leser.
 * - `aktiviert` hat **keinen Reiter**. Der Wert bleibt in der Funktion und ist
 *   über sie erreichbar; diese Fläche benutzt ihn nicht. Benannt statt
 *   verschwiegen — ein Parameterwert ohne Aufrufer sieht sonst wie ein
 *   vergessener aus.
 * - „Alle" schliesst Deaktivierte und Gelöschte AUS. Das ist ein bewusster
 *   Bruch mit dem Wort: die Fläche beantwortet „wer ist Mitglied?", nicht „was
 *   steht in der Tabelle?". Die Auswahl trifft die Datenbank (`case p_status`
 *   in `admin_list_members`), nicht diese Liste.
 */
type Reiter = "alle" | "offen" | "deaktiviert" | "geloescht" | "mitgliedschaft";

const REITER: { id: Reiter; label: string; status: AdminMemberStatus }[] = [
  { id: "alle", label: "Alle", status: "alle" },
  { id: "offen", label: "Nicht aktiviert", status: "offen" },
  { id: "deaktiviert", label: "Deaktiviert", status: "deaktiviert" },
  { id: "geloescht", label: "Gelöscht", status: "geloescht" },
  { id: "mitgliedschaft", label: "Mitgliedschaft", status: "alle" },
];

/** Der Reiter steht in der Adresse (`?tab=geloescht`), damit ein Neuladen ihn
 *  nicht verliert — auf einer Fläche, die beim Aufräumen oft neu geladen wird. */
const REITER_PARAM = "tab";

/** Ein unbekannter oder fehlender Wert fällt auf „Alle" zurück, statt eine leere
 *  Liste oder einen Fehler zu zeigen: die Adresszeile ist Eingabe von aussen. */
function leseReiter(wert: string | null): Reiter {
  return REITER.some((r) => r.id === wert) ? (wert as Reiter) : "alle";
}

/** Was im Zeilenmenü stehen kann. Nicht jede Aktion an jeder Zeile — was wo
 *  gilt, entscheidet `aktionenFuer`. */
type Zeilenaktion =
  "zugangslink" | "aktivieren" | "deaktivieren" | "reaktivieren" | "loeschen" | "wiederherstellen";

/**
 * Die drei Aktionen mit Rückfrage — und die Liste ist die Regel selbst, nicht
 * ihre Beschreibung: der Verteiler liest sie, statt die Fälle ein zweites Mal
 * aufzuzählen.
 *
 * Es sind genau die, die einem Menschen etwas NEHMEN. „Reaktivieren" und
 * „wiederherstellen" geben zurück und laufen sofort; „direkt aktivieren" ist
 * nicht umkehrbar, „deaktivieren" und „löschen" sind es zwar, nehmen aber
 * jemandem den Zugang. Eine optische Trennung allein gilt hier nicht als
 * Schutz (Spec).
 */
const BRAUCHT_RUECKFRAGE = ["aktivieren", "deaktivieren", "loeschen"] as const;
type Rueckfragenart = (typeof BRAUCHT_RUECKFRAGE)[number];

interface OffeneRueckfrage {
  member: AdminMember;
  art: Rueckfragenart;
}

/** Dieselbe Zweiteilung wie in der Edge Function: die beiden Aktionen, die
 *  jemandem den Zugang nehmen, gegen die beiden, die ihn zurückgeben. */
function istSchliessen(was: LebenszyklusAktion): boolean {
  return was === "disable" || was === "delete";
}

/** Was der Erfolgston nach einer Lebenszyklus-Aktion meldet. */
const VOLLZUG: Record<LebenszyklusAktion, string> = {
  disable: "deaktiviert",
  enable: "reaktiviert",
  delete: "gelöscht",
  restore: "wiederhergestellt",
};

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
  const [seite, setSeite] = useState(0);

  /**
   * Der Reiter wird ABGELEITET, nicht gespiegelt. Ein `useState` daneben wäre
   * ein zweiter Ort für denselben Wert — und der, den die Adresszeile trägt,
   * bliebe beim Zurückgehen unbemerkt stehen.
   */
  const [suchparameter, setSuchparameter] = useSearchParams();
  const reiter = leseReiter(suchparameter.get(REITER_PARAM));
  const status = REITER.find((r) => r.id === reiter)!.status;
  /** Ein Reiter und eine Tafel: alle fünf zeigen dieselbe Liste unter einem
   *  anderen Filter. Beschriftet wird sie deshalb vom GEWÄHLTEN Reiter. */
  const tafelId = "reiter-tafel";

  /**
   * Ein Reiterwechsel fängt wieder auf Seite 1 an — Seite 3 der Deaktivierten
   * ist keine Fortsetzung von Seite 3 der Offenen.
   *
   * WÄHREND DES AUFBAUS und nicht in einem Effekt: der Effekt liefe erst NACH
   * dem Zeichnen, also ginge dazwischen eine Abfrage mit dem alten `p_offset`
   * über die Leitung, deren Ergebnis aufblitzt und im Zwischenspeicher landet.
   * Und nicht im Klick-Behandler: der Reiter kommt auch von AUSSEN (Adresszeile,
   * Zurück-Taste), und dort gibt es keinen Klick, der zurücksetzen könnte.
   */
  const [letzterReiter, setLetzterReiter] = useState(reiter);
  if (letzterReiter !== reiter) {
    setLetzterReiter(reiter);
    setSeite(0);
  }

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
  /** Das Mitglied UND die Aktion, für die die Rückfrage offen ist — nicht ein
   *  blosses `true`: der Dialog muss beides nennen, und zwar das Mitglied
   *  NAMENTLICH. */
  const [rueckfrage, setRueckfrage] = useState<OffeneRueckfrage | null>(null);

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

  /**
   * Die vier Lebenszyklus-Aktionen — EINE Mutation für alle vier, weil sich
   * nur der Wert von `action` unterscheidet und die Nachbehandlung dieselbe
   * ist.
   */
  const lebenszyklus = useMutation({
    mutationFn: ({ m, was }: { m: AdminMember; was: LebenszyklusAktion }) =>
      setMemberBan(was, m.id),
    onSuccess: async (ergebnis, { m, was }) => {
      setRueckfrage(null);
      const wer = m.name ?? "Das Mitglied";
      if (ergebnis.halb) {
        // KEIN Erfolgston. Der Vorgang ist zur Hälfte gelungen, und WELCHE
        // Hälfte fehlt, hängt an der Richtung: beim Schliessen ist das Mitglied
        // unsichtbar und kommt noch herein, beim Öffnen ist es wieder da und
        // kommt nicht herein. Beides ist der 207-Ausgang von
        // `admin-set-member-ban`, und supabase-js meldet ihn nicht als Fehler,
        // weil er ein 2xx ist.
        toast({
          title: "Nur zur Hälfte ausgeführt",
          description: ergebnis.verborgen
            ? `${wer} ist nicht mehr sichtbar, kann sich aber weiterhin anmelden. ` +
              (was === "disable"
                ? "„Deaktivieren“ noch einmal auslösen holt den Rest nach."
                : "Der Zustand ist unvollständig und muss nachgezogen werden.")
            : `${wer} ist wieder sichtbar, kann sich aber nicht anmelden. ` +
              "Der Zustand ist unvollständig — deaktivieren und wieder reaktivieren zieht ihn nach.",
          variant: "error",
        });
      } else if (!istSchliessen(was) && ergebnis.verborgen) {
        // Kein halber Zustand, aber auch kein schlichtes „wiederhergestellt":
        // `admin_restore_member` hat `deleted_at` geleert und `disabled_at`
        // stehen lassen, weil das Mitglied schon vor dem Löschen deaktiviert
        // war. Es ist zurück in der Mitgliedschaft und kommt trotzdem nicht
        // herein — das muss dastehen, sonst sucht jemand den Fehler.
        toast({
          title: `${wer}: wiederhergestellt — bleibt deaktiviert`,
          description:
            "Es war schon vor dem Löschen deaktiviert. „Reaktivieren“ hebt auch das auf.",
          variant: "success",
        });
      } else {
        toast({ title: `${m.name ?? "Mitglied"}: ${VOLLZUG[was]}`, variant: "success" });
      }
      // In JEDEM Fall nachladen, auch beim halben. Die Zeile hat ihren Zustand
      // gewechselt, und das Menü der nächsten Aktion hängt daran.
      await queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (e) => {
      setRueckfrage(null);
      toast({ title: "Aktion fehlgeschlagen", description: fehlerText(e), variant: "error" });
    },
  });

  const laeuft = zugangslink.isPending || aktivieren.isPending || lebenszyklus.isPending;

  /**
   * Der einzige Weg vom Menü in die Mutationen.
   *
   * Die drei umkehrbaren Öffnungen laufen sofort; die drei, die einem Menschen
   * etwas nehmen, gehen erst durch die Rückfrage. Welche das sind, steht in
   * `BRAUCHT_RUECKFRAGE` und nicht hier — sonst stünde die Regel zweimal.
   */
  function aktion(m: AdminMember, was: Zeilenaktion) {
    if (BRAUCHT_RUECKFRAGE.includes(was as Rueckfragenart)) {
      setRueckfrage({ member: m, art: was as Rueckfragenart });
      return;
    }
    if (was === "zugangslink") {
      zugangslink.mutate(m);
      return;
    }
    lebenszyklus.mutate({ m, was: was === "reaktivieren" ? "enable" : "restore" });
  }

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

      {/* Eigene Leiste statt `components/ui/Tabs`: die dortige Komponente hält
          den gewählten Reiter in einem eigenen `useState` und verlangt je Reiter
          einen eigenen Inhalt. Hier trägt die Adresse den Zustand, und alle fünf
          Reiter zeigen dieselbe Liste unter einem anderen Filter — die Optik ist
          übernommen, die Zustandsführung nicht. */}
      {/* Die graue Linie sitzt am UMSCHLAG, nicht an der scrollbaren Leiste.
          Beides in einem Element hiess `overflow-x-auto` — und das setzt
          `overflow-y` implizit auf `auto`. Der 1px-Überstand des negativen
          Aussenabstands genügte dann für einen VERTIKALEN Scrollbalken, der
          15 px Breite frass (gemessen: clientWidth 1105 bei 1120 px Breite,
          scrollHeight 34 bei clientHeight 33). Nur die Sichtprobe zeigte ihn. */}
      <div className="border-b border-line">
        <div role="tablist" aria-label="Zustand" className="flex gap-6 overflow-x-auto">
          {REITER.map((r) => {
            const gewaehlt = r.id === reiter;
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                id={`reiter-${r.id}`}
                aria-selected={gewaehlt}
                aria-controls={tafelId}
                onClick={() => {
                  // `setSuchparameter` und nicht `setStatus`: der Reiter GEHÖRT in
                  // die Adresse. `replace` wäre hier falsch — ein Reiterwechsel ist
                  // eine Navigation, und die Zurück-Taste soll ihn zurücknehmen.
                  const naechste = new URLSearchParams(suchparameter);
                  naechste.set(REITER_PARAM, r.id);
                  setSuchparameter(naechste);
                }}
                className={
                  "border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap transition-colors " +
                  (gewaehlt
                    ? "border-accent text-accent-strong"
                    : "border-transparent text-muted hover:text-ink")
                }
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

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

      <div
        role="tabpanel"
        id={tafelId}
        aria-labelledby={`reiter-${reiter}`}
        className="flex flex-col gap-6"
      >
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
                      {/* Additiv, nicht ersetzend: „Zustand" gilt laut 5.5 in
                          JEDER Sicht, und ein Reiter, der ihn wegnimmt, machte
                          aus drei Sichten auf dieselben Zeilen wieder drei
                          verschiedene Wahrheiten. */}
                      {reiter === "mitgliedschaft" && (
                        <>
                          <th className="py-2 pr-4">Stufe</th>
                          <th className="py-2 pr-4">bezahlt bis</th>
                          <th className="py-2 pr-4">Zahlungsart</th>
                          {/* Über der Knopfspalte steht nichts Sichtbares — der
                              Knopf sagt selbst, was er tut. Für eine
                              Vorleseausgabe bleibt sie trotzdem benannt, sonst
                              ist die Spalte namenlos. */}
                          <th className="py-2 pr-4">
                            <span className="sr-only">Speichern</span>
                          </th>
                        </>
                      )}
                      <th className="py-2">Aktionen</th>
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
                        {reiter === "mitgliedschaft" && <Mitgliedschaft member={m} alsZellen />}
                        <td className="py-2">
                          <Zeilenmenue member={m} laeuft={laeuft} onAktion={aktion} />
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
                    {reiter === "mitgliedschaft" && <Mitgliedschaft member={m} />}
                    <Zeilenmenue member={m} laeuft={laeuft} onAktion={aktion} />
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
                      Zustand und Aktionen stehen DANEBEN und nicht darin: die
                      Karte ist ein Link, und ein Knopf in einem Link ist weder
                      gültiges HTML noch bedienbar.

                      `flex-1` an der Karte, damit die Aktionszeilen über die
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
                      <Zeilenmenue member={m} laeuft={laeuft} onAktion={aktion} />
                    </div>
                    {/* Die Felder stehen NEBEN der Verzeichniskarte, nicht darin:
                        die Karte ist ein Link, und ein Eingabefeld in einem Link
                        ist weder gültiges HTML noch bedienbar — derselbe Grund,
                        aus dem schon Zustand und Menü daneben stehen. */}
                    {reiter === "mitgliedschaft" && <Mitgliedschaft member={m} />}
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
      </div>

      {rueckfrage && (
        <Rueckfrage
          member={rueckfrage.member}
          art={rueckfrage.art}
          laeuft={aktivieren.isPending || lebenszyklus.isPending}
          onAbbrechen={() => setRueckfrage(null)}
          onBestaetigen={() => {
            const m = rueckfrage.member;
            if (rueckfrage.art === "aktivieren") aktivieren.mutate(m);
            else
              lebenszyklus.mutate({
                m,
                was: rueckfrage.art === "deaktivieren" ? "disable" : "delete",
              });
          }}
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

/**
 * Die Mitgliedschaftsfelder EINER Zeile — nur im Reiter „Mitgliedschaft"
 * (AGE-581, Abschnitt 9).
 *
 * DIE STUFE IST NUR LESBAR. Sie steht als Plakette da, nicht als Auswahlfeld:
 * ein Stufenwechsel berührt Rechte und Preise und hat einen eigenen Weg
 * (AGE-516). Ihn nebenbei in einer Tabellenzeile zu erlauben, wäre die
 * folgenreichste Änderung auf dieser Fläche und zugleich die unauffälligste.
 *
 * „UNBEKANNT" STEHT NEBEN DEM LEEREN FELD, statt es zu füllen. Ein leeres
 * Datumsfeld allein sagt nicht, ob niemand es je erfasst hat oder ob die Zeile
 * gerade lädt — und ein vorbelegtes „heute" wäre ein geratenes Datum, genau das
 * also, was das Delta ausschliesst.
 *
 * DER ZUSTAND LIEGT IN `useState` OHNE `reset()`. Die Zeile ist nach `m.id`
 * verschlüsselt, die Anfangswerte stehen beim Aufbau schon da (Zeilen werden
 * erst gezeichnet, wenn die Liste da ist), und „geändert" ist ein VERGLEICH
 * gegen das Mitglied statt eines zweiten Zustands: nach dem Speichern liefert
 * die neu geladene Liste genau die getippten Werte, und die Zeile ist von
 * selbst wieder sauber. Damit gibt es hier kein `reset()` — und ohne `reset()`
 * auch nicht die Falle, an der ein Auswahlfeld still auf die erste Option
 * zurückfällt. (Der Plan sah dafür `Controller` vor; die Begründung dieser
 * Abweichung steht in `tasks.md` unter 9.3.)
 */
function Mitgliedschaft({ member, alsZellen }: { member: AdminMember; alsZellen?: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const name = member.name ?? "Ohne Namen";
  const [datum, setDatum] = useState(member.paid_until ?? "");
  const [art, setArt] = useState(member.payment_type ?? "");

  /** Ein VERGLEICH gegen das Mitglied, kein zweiter Zustand. Nach dem
   *  Speichern bringt die neu geladene Liste genau diese Werte mit, und die
   *  Zeile ist von selbst wieder sauber — ein Merker müsste dafür von Hand
   *  zurückgestellt werden und bliebe irgendwann stehen. */
  const geaendert = datum !== (member.paid_until ?? "") || art !== (member.payment_type ?? "");

  const speichern = useMutation({
    mutationFn: () => updateMitgliedschaft(member.id, { paid_until: datum, payment_type: art }),
    onSuccess: async () => {
      toast({ title: `Mitgliedschaft von ${name} gespeichert`, variant: "success" });
      // Nachladen. Nicht nur der Kosmetik wegen: `geaendert` misst gegen das
      // Mitglied aus der Liste, und ohne das Nachladen bliebe die Zeile für
      // immer „geändert" — der Knopf lüde zum zweiten, wirkungslosen Klick ein.
      await queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (e) =>
      toast({
        title: "Speichern fehlgeschlagen",
        description: fehlerText(e),
        variant: "error",
      }),
  });

  /**
   * DIE STUFE IST NUR LESBAR. Sie steht als Plakette da, nicht als Auswahlfeld:
   * ein Stufenwechsel berührt Rechte und Preise und hat einen eigenen Weg
   * (AGE-516). Ihn nebenbei in einer Tabellenzeile zu erlauben, wäre die
   * folgenreichste Änderung auf dieser Fläche und zugleich die unauffälligste.
   */
  const stufe = <TierBadge tier={member.tier} />;

  /**
   * EIN LEERES FELD IST DIE AUSKUNFT „nicht erfasst", und daneben stand bis
   * zum 24.08. noch das Wort „unbekannt". Es ist weg: neben dem „nicht
   * erfasst" des Auswahlfeldes war es dieselbe Aussage ein zweites Mal, und
   * weil es nur an den leeren Zeilen erschien, verschob es in JEDER Zeile die
   * folgenden Felder um seine eigene Breite. Die Zusage „kein geratenes Datum"
   * hängt nicht an dem Wort, sondern daran, dass hier nichts vorbelegt wird —
   * und genau das prüft der Test.
   */
  const bezahltBis = (
    <Input
      type="date"
      // Der zugängliche Name trägt das MITGLIED. Die Spaltenüberschrift steht
      // einmal, das Feld 25-mal; ohne den Namen hiesse jedes davon für eine
      // Vorleseausgabe dasselbe.
      aria-label={`bezahlt bis für ${name}`}
      className="h-9 w-40"
      value={datum}
      onChange={(e) => setDatum(e.target.value)}
    />
  );

  const zahlungsart = (
    <Select
      aria-label={`Zahlungsart für ${name}`}
      className="h-9 w-44"
      value={art}
      onChange={(e) => setArt(e.target.value)}
    >
      {/* Der leere Wert ist keine neunte Zahlungsart, sondern die Auskunft,
          dass keine erfasst ist — `null` in der Spalte. */}
      <option value="">nicht erfasst</option>
      {ZAHLUNGSARTEN.map((z) => (
        <option key={z.id} value={z.id}>
          {z.label}
        </option>
      ))}
    </Select>
  );

  {
    /* Je Zeile ein eigener Knopf und kein Speichern beim Verlassen des Feldes:
       auf einer Fläche mit 25 Zeilen ist ein Tastendruck neben dem Feld sonst
       ein Schreibzugriff, den niemand ausgelöst hat. */
  }
  const knopf = (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      aria-label={`Mitgliedschaft speichern für ${name}`}
      disabled={!geaendert || speichern.isPending}
      onClick={() => speichern.mutate()}
    >
      {speichern.isPending ? "Speichert …" : "Speichern"}
    </Button>
  );

  /**
   * In der Tabelle EIGENE SPALTEN, sonst ein beschrifteter Block.
   *
   * Nicht aus Geschmack: in einer Tabelle fluchten Felder, weil sie in
   * derselben Spalte stehen — nicht, weil sie zufällig gleich breit sind. Die
   * erste Fassung setzte alle vier in EINE Zelle, und damit hing die
   * Ausrichtung an der Breite der Nachbarn; eine Zeile ohne „unbekannt" schob
   * ihre Felder gegenüber den anderen. Ausserdem stand jede Aufschrift
   * 25-mal untereinander, obwohl eine Spaltenüberschrift sie einmal trägt.
   *
   * Karten und Verzeichnis haben keine Spalten, dort tragen die Aufschriften
   * die Zuordnung — als zweispaltiges Raster, damit die Felder auch in einer
   * schmalen Karte untereinander fluchten statt umzubrechen.
   */
  if (alsZellen) {
    return (
      <>
        <td className="py-2 pr-4">{stufe}</td>
        <td className="py-2 pr-4">{bezahltBis}</td>
        <td className="py-2 pr-4">{zahlungsart}</td>
        <td className="py-2 pr-4">{knopf}</td>
      </>
    );
  }

  return (
    <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
      <span className="text-xs text-muted">Stufe</span>
      <span>{stufe}</span>
      <span className="text-xs text-muted">bezahlt bis</span>
      {bezahltBis}
      <span className="text-xs text-muted">Zahlungsart</span>
      {zahlungsart}
      <span />
      <span>{knopf}</span>
    </div>
  );
}

/**
 * Was an DIESER Zeile anwendbar ist.
 *
 * Die Matrix wird in der Datenbank erzwungen (die vier RPCs brechen mit `22023`
 * ab, wenn der Ausgangszustand nicht passt); hier wird sie nur GESPIEGELT.
 * Einen Eintrag anzubieten, dessen einziger Ausgang ein Fehler ist, ist eine
 * Einladung zum Fehlklick — mehr soll dieses Spiegelbild nicht leisten, und
 * weniger als die Datenbank darf es nicht durchlassen.
 *
 * `gesperrt` fasst deaktiviert und gelöscht zu einem Wahrheitswert zusammen,
 * genau wie `blocked` in `my_activation_state`. Beide Aktivierungswege hängen
 * daran, und zwar aus demselben Grund wie dort: das Konto ist in `auth.users`
 * gebannt, ein Zugangslink führte also zu einer Anmeldung, die nicht gelingen
 * kann. Für den GELÖSCHTEN Fall verlangt das der Plan ausdrücklich (7.5); der
 * deaktivierte ist derselbe Sachverhalt und wird nicht anders behandelt.
 *
 * NICHT gespiegelt: dass ein Admin sich nicht selbst deaktivieren oder löschen
 * kann. Die Datenbank weist es mit `22023` ab, die Fläche kennt den Aufrufer
 * hier nicht, und der Ausgang ist eine Fehlermeldung statt einer stillen
 * Änderung. Benannt statt verschwiegen.
 */
function aktionenFuer(m: AdminMember): { id: Zeilenaktion; label: string; gefahr?: boolean }[] {
  const deaktiviert = m.deaktiviert_seit !== null;
  const geloescht = m.geloescht_seit !== null;
  const gesperrt = deaktiviert || geloescht;

  const eintraege: { id: Zeilenaktion; label: string; gefahr?: boolean }[] = [];
  if (!gesperrt) eintraege.push({ id: "zugangslink", label: "Zugangslink schicken" });
  // Nur an unbestätigten Zeilen. An einer bestätigten bräche
  // `admin_activate_member` mit 22023 ab.
  if (!gesperrt && !m.bestaetigt) eintraege.push({ id: "aktivieren", label: "Direkt aktivieren" });
  // NICHT bloss `!gesperrt`. Eine deaktivierte Zeile, deren Ban FEHLT, ist ein
  // halber Zustand — `admin_disable_member` bricht dort nicht mit 22023 ab,
  // sondern setzt den Ban nach. Ohne diesen Zweig wäre der Nachsetz-Weg über
  // die Oberfläche unerreichbar, und das Delta nennt eine Handlung, die ihren
  // eigenen halben Ausgang nicht heilen kann, „keine Handlung, sondern eine
  // Falle". Für GELÖSCHT gibt es keinen solchen Weg: die Matrix bricht dort in
  // jedem Fall ab, und diese Fläche erfindet keinen.
  if (!geloescht && (!deaktiviert || !m.gebannt)) {
    eintraege.push({ id: "deaktivieren", label: "Deaktivieren", gefahr: true });
  }
  if (deaktiviert && !geloescht) eintraege.push({ id: "reaktivieren", label: "Reaktivieren" });
  // Auch an einer bereits deaktivierten Zeile: Löschen setzt dort `deleted_at`
  // zusätzlich und lässt `disabled_at` stehen — ein gültiger Übergang.
  if (!geloescht) eintraege.push({ id: "loeschen", label: "Löschen", gefahr: true });
  if (geloescht) eintraege.push({ id: "wiederherstellen", label: "Wiederherstellen" });
  return eintraege;
}

/**
 * Das Zeilenmenü (AGE-581).
 *
 * WARUM EIN MENÜ: mit den vier Lebenszyklus-Aktionen stünden an einer Zeile
 * bis zu vier Knöpfe nebeneinander, und „Löschen" läge zwischen ihnen wie jeder
 * andere. Ein Menü macht aus dem Fehlklick zwei Aktionen statt einer.
 *
 * WARUM AN `document.body` PORTALIERT: ein `fixed`-Overlay wird auf dieser
 * Fläche an zwei Stellen eingefangen — `.fbc-card:hover` setzt ein `transform`
 * und der `<header>` ein `backdrop-blur`; beides macht den Vorfahren zum
 * enthaltenden Block, und das Menü schrumpfte auf dessen Kasten. Dazu kommt der
 * `overflow-x-auto` der Tabelle, der ein `absolute` positioniertes Menü
 * abschnitte. Das Portal umgeht alle drei, weil es gar keinen dieser Vorfahren
 * mehr hat.
 *
 * Die Folge für die Tests: `within(zeile)` findet das Menü NICHT. Das ist keine
 * Testeigenart, sondern genau die Eigenschaft, derentwegen portaliert wird.
 */
function Zeilenmenue({
  member,
  laeuft,
  onAktion,
}: {
  member: AdminMember;
  laeuft: boolean;
  onAktion: (m: AdminMember, was: Zeilenaktion) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const knopfRef = useRef<HTMLButtonElement>(null);
  const menueRef = useRef<HTMLDivElement>(null);
  /** Der Kasten des Auslösers zum Zeitpunkt des Öffnens — die Klapprichtung
   *  unten braucht ihn, und bis dahin ist das Menü schon aufgeklappt. */
  const ankerRef = useRef<DOMRect | null>(null);
  const eintraege = aktionenFuer(member);

  // KLAPPRICHTUNG. Nach unten, ausser es passt nicht mehr — dann nach oben.
  // Ohne das ragt das Menü an einer Zeile am unteren Rand hinaus, und weil es
  // `fixed` liegt, lässt es sich nicht heranscrollen: JEDER Scroll schliesst
  // es (siehe `onWeg`). Gemessen am 23.08. bei 62vh Vorlauf — 139 px
  // Überstand, „Löschen" per `elementFromPoint` nicht mehr getroffen.
  //
  // `useLayoutEffect`, damit die Korrektur VOR dem Zeichnen greift; sonst
  // springt das Menü sichtbar. In jsdom sind alle Höhen 0, dort klappt es
  // deshalb nie — geprüft wird das im Browser (7.6).
  useLayoutEffect(() => {
    const anker = ankerRef.current;
    const hoehe = menueRef.current?.getBoundingClientRect().height ?? 0;
    if (!offen || !anker || hoehe === 0) return;
    if (anker.bottom + 4 + hoehe <= window.innerHeight - 8) return;
    setPos((p) => ({ ...p, top: Math.max(8, anker.top - 4 - hoehe) }));
  }, [offen]);

  // Der Fokus wandert beim Öffnen auf den ERSTEN Eintrag. Ohne das wäre das
  // Menü mit der Tastatur nicht erreichbar: der Auslöser behielte den Fokus,
  // und Tab spränge an ihm vorbei in die nächste Zeile.
  useEffect(() => {
    if (!offen) return;
    menueRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [offen]);

  useEffect(() => {
    if (!offen) return;
    const draussen = (ziel: Node) =>
      !menueRef.current?.contains(ziel) && !knopfRef.current?.contains(ziel);
    const onZeiger = (e: PointerEvent) => {
      if (draussen(e.target as Node)) setOffen(false);
    };
    // Das Menü liegt FEST am Ansichtsfenster (siehe `position: fixed` unten).
    // Scrollt die Seite, wandert die Zeile darunter weg — das Menü bliebe
    // stehen und zeigte auf ein anderes Mitglied. `capture`, weil auch der
    // `overflow-x-auto` der Tabelle scrollt und dieses Ereignis nicht steigt.
    const onWeg = () => setOffen(false);
    document.addEventListener("pointerdown", onZeiger);
    window.addEventListener("scroll", onWeg, true);
    window.addEventListener("resize", onWeg);
    return () => {
      document.removeEventListener("pointerdown", onZeiger);
      window.removeEventListener("scroll", onWeg, true);
      window.removeEventListener("resize", onWeg);
    };
  }, [offen]);

  function schliessen(zurueck: boolean) {
    setOffen(false);
    // Nach Escape gehört der Fokus dorthin zurück, wo er herkam — sonst fällt
    // er auf `body`, und der nächste Tab fängt am Seitenanfang an.
    if (zurueck) knopfRef.current?.focus();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      schliessen(true);
      return;
    }
    // Tab schliesst UND gibt den Fokus an den Auslöser zurück. Nicht aus
    // Dialog-Denken: das Menü hängt am ENDE von `document.body`, ein
    // weiterlaufender Tab landete also hinter der ganzen Anwendung statt in
    // der nächsten Zeile. Vom Auslöser aus geht es normal weiter.
    if (e.key === "Tab") {
      e.preventDefault();
      schliessen(true);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const knoten = Array.from(
      menueRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (knoten.length === 0) return;
    const i = knoten.indexOf(document.activeElement as HTMLElement);
    const schritt = e.key === "ArrowDown" ? 1 : -1;
    knoten[(i + schritt + knoten.length) % knoten.length].focus();
  }

  return (
    <>
      <Button
        ref={knopfRef}
        type="button"
        size="sm"
        variant="secondary"
        // FESTE Breite statt `w-fit`. Sie leistet zweierlei: sie hält den
        // Auslöser quadratisch, und sie ist zugleich der Riegel gegen das
        // `align-self: stretch` der Kartensicht — dort ist die Karte ein
        // `flex-col`, und ohne eine gesetzte Breite zöge sich der Auslöser über
        // ihre ganze Breite und läse sich als Hauptaktion statt als Menü
        // (Sichtprobe 7.6; jsdom kennt keine Breiten).
        //
        // `w-10` und NICHT `w-9`: `size="sm"` bringt `px-3` mit, also 12 px auf
        // jeder Seite. 40 − 24 lässt genau die 16 px, die das Symbol braucht.
        // Das Padding hier mit `px-0` zu überschreiben wäre der Fehler: `cn()`
        // ist ein blosser Join ohne `tailwind-merge`, über den Vorrang
        // entschiede also die Reihenfolge im Stylesheet und nicht die im
        // Attribut.
        className="w-10 shrink-0"
        disabled={laeuft}
        aria-haspopup="menu"
        aria-expanded={offen}
        // NAMENTLICH: auf einer Seite mit fünfundzwanzig Zeilen sind
        // fünfundzwanzig Schaltflächen namens „Aktionen" für eine
        // Vorleseausgabe nicht auseinanderzuhalten.
        // NAMENTLICH und HIER UNVERZICHTBAR: seit der Auslöser nur noch drei
        // Punkte zeigt, ist dieses Label die EINZIGE Auskunft darüber, was er
        // tut und zu wem er gehört. Ohne es hiesse er für eine Vorleseausgabe
        // „Schaltfläche".
        aria-label={`Aktionen für ${member.name ?? "dieses Mitglied"}`}
        onClick={() => {
          if (offen) {
            setOffen(false);
            return;
          }
          const r = knopfRef.current?.getBoundingClientRect();
          if (r) {
            ankerRef.current = r;
            setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
          }
          setOffen(true);
        }}
      >
        {/* Drei Punkte statt eines Wortes (Donald, 24.08.): der
            Auslöser eines Zeilenmenüs soll die Zeile nicht dominieren.
            Inline und ohne Icon-Bibliothek, wie `ui/NavIcon.tsx` — hier sogar
            gefüllt statt gestrichelt, weil drei Kreise mit 1.6 px Kontur bei
            dieser Grösse zu Ringen würden.

            `aria-hidden`: das Symbol trägt keine Auskunft, die es nicht schon
            im `aria-label` des Knopfes gäbe. Ohne diese Zeile läse eine
            Vorleseausgabe im schlechteren Fall beides. */}
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </Button>
      {offen &&
        createPortal(
          <div
            ref={menueRef}
            role="menu"
            aria-label={`Aktionen für ${member.name ?? "dieses Mitglied"}`}
            onKeyDown={onKey}
            onBlur={(e) => {
              // „Schliessen beim Verlassen" (7.4) — auch für die Tastatur, nicht
              // nur für den Zeiger. `relatedTarget` ist der Knoten, der den Fokus
              // BEKOMMT; liegt er ausserhalb, ist das Menü verlassen.
              //
              // AUSSER er ist der Auslöser. Im Browser bekommt ein `<button>`
              // beim `mousedown` den Fokus, also feuert ein Klick auf
              // den Auslöser ERST dieses `focusout` und DANN seinen `onClick`.
              // Schlösse es hier, sähe der Klick ein bereits geschlossenes
              // Menü und öffnete es sofort wieder — der Auslöser könnte sein
              // eigenes Menü nie schliessen. In jsdom verschiebt
              // `fireEvent.click` den Fokus nicht; siebenunddreissig grüne
              // Zusagen haben das übersehen, die Diff-Prüfung nicht.
              const ziel = e.relatedTarget as Node | null;
              if (!ziel) return;
              if (menueRef.current?.contains(ziel)) return;
              if (knopfRef.current?.contains(ziel)) return;
              setOffen(false);
            }}
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="z-50 w-56 overflow-hidden rounded-[var(--radius-card)] border border-line bg-canvas py-1 shadow-soft"
          >
            {eintraege.map((h) => (
              <button
                key={h.id}
                type="button"
                role="menuitem"
                className={
                  h.gefahr
                    ? "block w-full px-4 py-2 text-left text-sm font-medium text-danger transition-colors hover:bg-danger/[0.06] focus-visible:bg-danger/[0.06] focus-visible:outline-none"
                    : "block w-full px-4 py-2 text-left text-sm text-ink/80 transition-colors hover:bg-ink/[0.04] hover:text-ink focus-visible:bg-ink/[0.04] focus-visible:outline-none"
                }
                onClick={() => {
                  schliessen(true);
                  onAktion(member, h.id);
                }}
              >
                {h.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * Der Wortlaut je Rückfrage.
 *
 * Jede nennt das Mitglied NAMENTLICH in der Überschrift — wer schnell klickt,
 * liest genau diese Zeile — und benennt die FOLGE, nicht bloss die Aktion.
 * Bei den beiden Sperren steht ausdrücklich da, dass die Anmeldung endet: das
 * ist die Wirkung, die man aus dem Wort „deaktivieren" allein nicht abliest.
 */
const RUECKFRAGEN: Record<
  Rueckfragenart,
  { titel: (name: string) => string; folge: string; ausweg: string; knopf: string }
> = {
  aktivieren: {
    titel: (name) => `${name} jetzt aktivieren?`,
    folge:
      "wird damit für andere Mitglieder im Verzeichnis sichtbar. Das lässt sich " +
      "hier nicht rückgängig machen.",
    ausweg: "Der reguläre Weg ist „Zugangslink schicken“ — dann bestätigt das Mitglied selbst.",
    knopf: "Aktivieren",
  },
  deaktivieren: {
    titel: (name) => `${name} deaktivieren?`,
    folge:
      "kann sich danach nicht mehr anmelden und verschwindet aus dem Verzeichnis. " +
      "Beiträge und Kommentare bleiben stehen, als „Ehemaliges Mitglied“.",
    ausweg: "„Reaktivieren“ nimmt beides wieder zurück.",
    knopf: "Deaktivieren",
  },
  loeschen: {
    titel: (name) => `${name} löschen?`,
    folge:
      "kann sich danach nicht mehr anmelden und verschwindet aus dem Verzeichnis. " +
      "Beiträge und Kommentare bleiben stehen, als „Ehemaliges Mitglied“.",
    ausweg: "„Wiederherstellen“ nimmt es zurück, solange die Zeile besteht.",
    knopf: "Löschen",
  },
};

/**
 * Die Rückfrage vor den drei nehmenden Aktionen.
 *
 * Sie nennt das Mitglied NAMENTLICH und benennt die Folge. Das ist keine
 * Höflichkeit: bei „direkt aktivieren" schreibt `mark_activated`
 * `coalesce(activated_at, now())` und es besteht kein Rücksetzweg; bei den
 * beiden Sperren ist der Weg zurück zwar da, aber dazwischen liegt ein Mensch,
 * der sich nicht mehr anmelden kann. Die erste Fassung des Entwurfs verliess
 * sich auf „optisch getrennt" — das ist eine Gestaltungsabsicht, keine
 * Sicherung.
 */
function Rueckfrage({
  member,
  art,
  laeuft,
  onAbbrechen,
  onBestaetigen,
}: {
  member: AdminMember;
  art: Rueckfragenart;
  laeuft: boolean;
  onAbbrechen: () => void;
  onBestaetigen: () => void;
}) {
  const overlay = useOverlay(true);
  const text = RUECKFRAGEN[art];
  const name = member.name ?? "Dieses Mitglied";

  return (
    <div
      ref={overlay}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={text.titel(name)}
    >
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={onAbbrechen} />
      <div className="relative w-full max-w-md rounded-[var(--radius-card)] bg-canvas p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-ink">{text.titel(name)}</h2>
        {/* Der Name ist das SATZSUBJEKT, nicht ein vorangestelltes Etikett.
            „Carla Aktiv: Das Mitglied kann sich…" nannte sie zweimal und las
            sich wie ein Protokolleintrag. Gefunden in der Sichtprobe (7.6). */}
        <p className="mt-2 text-sm text-muted">
          <strong>{name}</strong> {text.folge}
        </p>
        <p className="mt-2 text-sm text-muted">{text.ausweg}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onAbbrechen}>
            Abbrechen
          </Button>
          <Button type="button" disabled={laeuft} onClick={onBestaetigen}>
            {text.knopf}
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
