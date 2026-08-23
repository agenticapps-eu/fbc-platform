import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  setMemberBan,
  type AdminMember,
  type AdminMemberStatus,
  type LebenszyklusHandlung,
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

/** Was im Zeilenmenü stehen kann. Nicht jede Handlung an jeder Zeile — was wo
 *  gilt, entscheidet `handlungenFuer`. */
type Zeilenhandlung =
  "zugangslink" | "aktivieren" | "deaktivieren" | "reaktivieren" | "loeschen" | "wiederherstellen";

/**
 * Die drei Handlungen mit Rückfrage — und die Liste ist die Regel selbst, nicht
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

/** Was der Erfolgston nach einer Lebenszyklus-Handlung meldet. */
const VOLLZUG: Record<LebenszyklusHandlung, string> = {
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
  /** Das Mitglied UND die Handlung, für die die Rückfrage offen ist — nicht ein
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
   * Die vier Lebenszyklus-Handlungen — EINE Mutation für alle vier, weil sich
   * nur der Wert von `action` unterscheidet und die Nachbehandlung dieselbe
   * ist.
   */
  const lebenszyklus = useMutation({
    mutationFn: ({ m, was }: { m: AdminMember; was: LebenszyklusHandlung }) =>
      setMemberBan(was, m.id),
    onSuccess: async (ergebnis, { m, was }) => {
      setRueckfrage(null);
      if (ergebnis.halb) {
        // KEIN Erfolgston. Der Vorgang ist zur Hälfte gelungen: die Datenbank
        // führt das Mitglied als entfernt, `banned_until` in `auth.users` ist
        // aber nicht gesetzt — es kann sich weiterhin anmelden. Das ist der
        // 207-Ausgang von `admin-set-member-ban`, und supabase-js meldet ihn
        // nicht als Fehler, weil er ein 2xx ist.
        toast({
          title: "Nur zur Hälfte ausgeführt",
          description:
            `${m.name ?? "Das Mitglied"} ist nicht mehr sichtbar, kann sich aber ` +
            "weiterhin anmelden. Die Handlung noch einmal auslösen holt den Rest nach.",
          variant: "error",
        });
      } else {
        toast({ title: `${m.name ?? "Mitglied"}: ${VOLLZUG[was]}`, variant: "success" });
      }
      // In JEDEM Fall nachladen, auch beim halben. Die Zeile hat ihren Zustand
      // gewechselt, und das Menü der nächsten Handlung hängt daran.
      await queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (e) => {
      setRueckfrage(null);
      toast({ title: "Handlung fehlgeschlagen", description: fehlerText(e), variant: "error" });
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
  function handlung(m: AdminMember, was: Zeilenhandlung) {
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
                        <Zeilenmenue member={m} laeuft={laeuft} onHandlung={handlung} />
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
                  <Zeilenmenue member={m} laeuft={laeuft} onHandlung={handlung} />
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
                    <Zeilenmenue member={m} laeuft={laeuft} onHandlung={handlung} />
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
function handlungenFuer(m: AdminMember): { id: Zeilenhandlung; label: string; gefahr?: boolean }[] {
  const deaktiviert = m.deaktiviert_seit !== null;
  const geloescht = m.geloescht_seit !== null;
  const gesperrt = deaktiviert || geloescht;

  const eintraege: { id: Zeilenhandlung; label: string; gefahr?: boolean }[] = [];
  if (!gesperrt) eintraege.push({ id: "zugangslink", label: "Zugangslink schicken" });
  // Nur an unbestätigten Zeilen. An einer bestätigten bräche
  // `admin_activate_member` mit 22023 ab.
  if (!gesperrt && !m.bestaetigt) eintraege.push({ id: "aktivieren", label: "Direkt aktivieren" });
  if (!gesperrt) eintraege.push({ id: "deaktivieren", label: "Deaktivieren", gefahr: true });
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
 * WARUM EIN MENÜ: mit den vier Lebenszyklus-Handlungen stünden an einer Zeile
 * bis zu vier Knöpfe nebeneinander, und „Löschen" läge zwischen ihnen wie jeder
 * andere. Ein Menü macht aus dem Fehlklick zwei Handlungen statt einer.
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
  onHandlung,
}: {
  member: AdminMember;
  laeuft: boolean;
  onHandlung: (m: AdminMember, was: Zeilenhandlung) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const knopfRef = useRef<HTMLButtonElement>(null);
  const menueRef = useRef<HTMLDivElement>(null);
  const eintraege = handlungenFuer(member);

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
    // Tab schliesst, hält den Fokus aber NICHT fest: ein Zeilenmenü ist kein
    // Dialog, und wer weitertabbt, will weiter.
    if (e.key === "Tab") {
      setOffen(false);
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
        disabled={laeuft}
        aria-haspopup="menu"
        aria-expanded={offen}
        // NAMENTLICH: auf einer Seite mit fünfundzwanzig Zeilen sind
        // fünfundzwanzig Schaltflächen namens „Handlungen" für eine
        // Vorleseausgabe nicht auseinanderzuhalten.
        aria-label={`Handlungen für ${member.name ?? "dieses Mitglied"}`}
        onClick={() => {
          if (offen) {
            setOffen(false);
            return;
          }
          const r = knopfRef.current?.getBoundingClientRect();
          if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
          setOffen(true);
        }}
      >
        Handlungen
      </Button>
      {offen &&
        createPortal(
          <div
            ref={menueRef}
            role="menu"
            aria-label={`Handlungen für ${member.name ?? "dieses Mitglied"}`}
            onKeyDown={onKey}
            onBlur={(e) => {
              // „Schliessen beim Verlassen" (7.4) — auch für die Tastatur, nicht
              // nur für den Zeiger. `relatedTarget` ist der Knoten, der den Fokus
              // BEKOMMT; liegt er ausserhalb, ist das Menü verlassen.
              const ziel = e.relatedTarget as Node | null;
              if (ziel && !menueRef.current?.contains(ziel)) setOffen(false);
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
                  onHandlung(member, h.id);
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
 * liest genau diese Zeile — und benennt die FOLGE, nicht bloss die Handlung.
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
      "Die Angaben werden damit für andere Mitglieder im Verzeichnis sichtbar. " +
      "Das lässt sich hier nicht rückgängig machen.",
    ausweg: "Der reguläre Weg ist „Zugangslink schicken“ — dann bestätigt das Mitglied selbst.",
    knopf: "Aktivieren",
  },
  deaktivieren: {
    titel: (name) => `${name} deaktivieren?`,
    folge:
      "Das Mitglied kann sich danach nicht mehr anmelden und verschwindet aus dem " +
      "Verzeichnis. Beiträge und Kommentare bleiben stehen, als „Ehemaliges Mitglied“.",
    ausweg: "„Reaktivieren“ nimmt beides wieder zurück.",
    knopf: "Deaktivieren",
  },
  loeschen: {
    titel: (name) => `${name} löschen?`,
    folge:
      "Das Mitglied kann sich danach nicht mehr anmelden und verschwindet aus dem " +
      "Verzeichnis. Beiträge und Kommentare bleiben stehen, als „Ehemaliges Mitglied“.",
    ausweg: "„Wiederherstellen“ nimmt es zurück, solange die Zeile besteht.",
    knopf: "Löschen",
  },
};

/**
 * Die Rückfrage vor den drei nehmenden Handlungen.
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
        <p className="mt-2 text-sm text-muted">
          <strong>{name}</strong>: {text.folge}
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
