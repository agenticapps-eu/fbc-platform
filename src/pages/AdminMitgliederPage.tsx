import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { CLUB_LEVEL, CLUB_RANK, LEVELS, LEVEL_ORDER, levelLabel } from "../config/levels";
import { requestActivationLink } from "../lib/activation";
import {
  activateMember,
  adminMemberCountsQueryKey,
  adminMembersQueryKey,
  AUSGAENGE,
  createMember,
  fetchAdminMemberCounts,
  fetchAdminMembers,
  ladeEin,
  SEITENGROESSE,
  setMemberBan,
  setzeStufe,
  updateMitgliedschaft,
  ZAHLUNGSARTEN,
  type AdminMember,
  type AdminMemberStatus,
  type AnlageAusgang,
  type Ausgang,
  type LebenszyklusAktion,
  type NeuesMitglied,
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
 * Die SIEBEN Filter (AGE-581 Abschnitt 8, erweitert in AGE-927) — und ihre
 * Abbildung auf `p_status` ist NICHT die Identität. Genau deshalb steht sie
 * hier ausgeschrieben statt aus dem Namen erraten zu werden:
 *
 * - „Bestätigt" heisst in der Funktion `aktiviert`. Der Name an der Fläche
 *   gehört zur Aufnahmestrecke, der in der Funktion zum Zustand.
 * - „Mitgliedschaft" ist ein **Darstellungsmodus über derselben Menge wie
 *   „Alle"**, kein eigener Filter — beide fragen `alle` ab. Was sie
 *   unterscheidet, ist die Darstellung, und die hängt an der Kennung des
 *   Filters, nicht an einem zweiten Feld ohne Leser.
 * - `offen` hat **keinen Filter mehr**. Der Wert bleibt in der Funktion, und
 *   `angelegt` und `eingeladen` TEILEN ihn: angelegt + eingeladen = offen.
 *   Benannt statt verschwiegen — ein Parameterwert ohne Aufrufer sieht sonst
 *   wie ein vergessener aus.
 * - „Alle" schliesst Deaktivierte und Gelöschte AUS. Das ist ein bewusster
 *   Bruch mit dem Wort: die Fläche beantwortet „wer ist Mitglied?", nicht „was
 *   steht in der Tabelle?". Die Auswahl trifft die Datenbank (`case p_status`
 *   in `admin_list_members`), nicht diese Liste.
 */
type Reiter =
  | "angelegt"
  | "eingeladen"
  | "bestaetigt"
  | "alle"
  | "deaktiviert"
  | "geloescht"
  | "mitgliedschaft";

interface Filterdefinition {
  id: Reiter;
  label: string;
  status: AdminMemberStatus;
}

/**
 * Die Aufnahmestrecke — eine FOLGE, keine Aufzählung.
 *
 * Sie beantwortet „wo steht dieses Mitglied auf dem Weg herein?", und die
 * Reihenfolge ist die Aussage: ① angelegt, ② eingeladen, ③ bestätigt. Stünde
 * „③ Bestätigt" flach neben „Gelöscht", wäre aus der Aussage blosse Anordnung
 * geworden (Entwurf, „Die Oberfläche").
 *
 * `naechste` ist die nächste HANDLUNG des Schritts. ③ trägt keine — dort ist
 * nichts mehr zu tun, und eine Handlung dort wäre eine Einladung zum Fehlklick.
 */
const STRECKE: (Filterdefinition & { ziffer: string; naechste?: string })[] = [
  {
    id: "angelegt",
    ziffer: "①",
    label: "Angelegt",
    naechste: "Einladung schicken",
    status: "angelegt",
  },
  {
    id: "eingeladen",
    ziffer: "②",
    label: "Eingeladen",
    naechste: "Erinnern",
    status: "eingeladen",
  },
  { id: "bestaetigt", ziffer: "③", label: "Bestätigt", status: "aktiviert" },
];

/** Die übrigen Zustände. Sie beantworten „welcher Ausschnitt des Bestands?" —
 *  eine andere Frage, deshalb eine eigene Gruppe. */
const REITER: Filterdefinition[] = [
  { id: "alle", label: "Alle", status: "alle" },
  { id: "deaktiviert", label: "Deaktiviert", status: "deaktiviert" },
  { id: "geloescht", label: "Gelöscht", status: "geloescht" },
  { id: "mitgliedschaft", label: "Mitgliedschaft", status: "alle" },
];

/** Beide Gruppen sind EINE Auswahl: genau einer der sieben ist gewählt. Die
 *  Trennung ist Darstellung, nicht Abfrage. */
const FILTER: Filterdefinition[] = [...STRECKE, ...REITER];

/** Der Filter steht in der Adresse (`?tab=geloescht`), damit ein Neuladen ihn
 *  nicht verliert — auf einer Fläche, die beim Aufräumen oft neu geladen wird. */
const REITER_PARAM = "tab";

/** Der Wert, den die Fläche bis AGE-927 unter „Nicht aktiviert" führte. Er
 *  steht in Lesezeichen und meinte die Vereinigung aus ① und ②. */
const ALTER_WERT = "offen";

/**
 * Ein unbekannter oder fehlender Wert fällt auf „Alle" zurück, statt eine leere
 * Liste oder einen Fehler zu zeigen: die Adresszeile ist Eingabe von aussen.
 *
 * `offen` fällt dagegen auf ① Angelegt — dort beginnt die Arbeit, die der alte
 * Reiter meinte. „Alle" wäre die stillste mögliche Antwort auf ein Lesezeichen,
 * das etwas Bestimmtes suchte.
 */
function leseReiter(wert: string | null): Reiter {
  if (wert === ALTER_WERT) return "angelegt";
  return FILTER.some((r) => r.id === wert) ? (wert as Reiter) : "alle";
}

/** In welchen Schritten die Mehrfachauswahl etwas bewirken kann (ADR-0007).
 *  In ③, „Alle", „Deaktiviert", „Gelöscht" und „Mitgliedschaft" gibt es weder
 *  Kästchen noch Handlung — dort bewirkte sie nichts. */
function auswahlErlaubt(reiter: Reiter): boolean {
  return reiter === "angelegt" || reiter === "eingeladen";
}

/** Ein Ergebnis des Laufs, so wie die Fläche es festhält: die Kennung und der
 *  Name kommen aus der LISTE, der Ausgang aus der Antwort. */
interface Einladungsergebnis {
  id: string;
  name: string | null;
  ausgang: Ausgang;
}

/** Wie der Bericht die fünf Ausgänge nennt — und warum. Der Grund steht dabei,
 *  weil „übersprungen" ohne ihn wie ein Fehler aussieht. */
const AUSGANG_TEXT: Record<Ausgang, string> = {
  verschickt: "verschickt",
  uebersprungen: "übersprungen — es liegt noch ein gültiger Link im Postfach",
  abgewiesen: "abgewiesen — die Grenze von fünf Anforderungen am Tag griff",
  nicht_einladbar: "nicht einladbar — das Konto ist deaktiviert, gelöscht oder fort",
  // NICHT „abgelehnt". Der Ausgang entsteht an ZWEI Stellen im Endpunkt: bei
  // einer Ablehnung durch Resend — dann ist das Token entwertet — und in dessen
  // `catch`, wo der Versand UNBEKANNT ist: die Mail kann zugestellt sein, und
  // das Token bleibt dort absichtlich gültig. „Abgelehnt" behauptete eine
  // Ursache, die der Bericht nicht kennt. Befund des Diff-Reviews.
  fehlgeschlagen: "fehlgeschlagen — kein Versand bestätigt",
};

/** Was im Zeilenmenü stehen kann. Nicht jede Aktion an jeder Zeile — was wo
 *  gilt, entscheidet `aktionenFuer`. */
type Zeilenaktion =
  | "zugangslink"
  | "aktivieren"
  | "stufe"
  | "deaktivieren"
  | "reaktivieren"
  | "loeschen"
  | "wiederherstellen";

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
  const status = FILTER.find((r) => r.id === reiter)!.status;
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
  /** Das Mitglied, für das der Stufen-Dialog offen ist (AGE-707). */
  const [stufenDialog, setStufenDialog] = useState<AdminMember | null>(null);

  // ── Die Aufnahmestrecke, die Maske und der Lauf (AGE-927) ───────────────

  /** Die gewählten Zeilen, als Kennungen. Sie gilt JE SEITE — siehe den
   *  Rücksetzer darunter. */
  const [auswahl, setAuswahl] = useState<Set<string>>(() => new Set());
  const [maskeOffen, setMaskeOffen] = useState(false);
  /** Ob der Hinweis auf den geteilten Reiter noch steht. Einmalig heisst: bis
   *  er weggeklickt wird oder ein anderer Filter gewählt ist. */
  const [hinweisOffen, setHinweisOffen] = useState(true);
  /** Die Rückfrage vor dem Lauf trägt die gewählten Mitglieder, nicht bloss ein
   *  `true`: sie muss ihre ZAHL nennen, und die Schleife läuft danach über
   *  genau diese Menge — auch wenn die Liste sich inzwischen änderte. */
  const [einladefrage, setEinladefrage] = useState<AdminMember[] | null>(null);
  const [fortschritt, setFortschritt] = useState<{ fertig: number; gesamt: number } | null>(null);
  /** Der Bericht bleibt stehen, bis der Admin ihn schliesst. Ein Ton wäre hier
   *  falsch: er verschwindet, und dieser Bericht ist das Einzige, was sagt, was
   *  wirklich geschah. */
  const [bericht, setBericht] = useState<Einladungsergebnis[] | null>(null);
  /** Die Auskunft über eine Anlage, die nur zur Hälfte gelang. Aus demselben
   *  Grund kein Ton: das Konto BESTEHT, und das muss stehen bleiben. */
  const [anlageMeldung, setAnlageMeldung] = useState<{ name: string; schritt: string } | null>(
    null,
  );

  /**
   * DIE AUSWAHL GILT JE SEITE. Sie fällt, sobald Filter, Suchbegriff oder Seite
   * wechseln — sonst löste „Ausgewählte einladen" Zeilen aus, die der Admin
   * nicht mehr sieht, und genau das ist das „an alle", das ADR-0007 verwirft.
   *
   * WÄHREND DES AUFBAUS, aus demselben Grund wie beim Reiterwechsel darüber:
   * ein Effekt liefe erst nach dem Zeichnen, und dazwischen stünde eine
   * Handlung über einer Auswahl, die nicht mehr zur Liste passt.
   */
  const seitenschluessel = `${reiter}|${seite}|${query}`;
  const [letzteSeite, setLetzteSeite] = useState(seitenschluessel);
  if (letzteSeite !== seitenschluessel) {
    setLetzteSeite(seitenschluessel);
    setAuswahl(new Set());
    // DER BERICHT FÄLLT MIT. „Er bleibt stehen, bis der Admin ihn schliesst"
    // meint: er verschwindet nicht von selbst wie ein Ton. Über einer ANDEREN
    // Liste stehen zu bleiben ist etwas anderes — in der Sichtprobe stand der
    // Bericht über zwei Mitgliedern aus ② über der Liste von ①, und nichts
    // sagte, dass er sie nicht meint. Den Filter zu wechseln ist die Handlung
    // des Admins, mit der er ihn schliesst.
    setBericht(null);
  }

  /**
   * Ob die Seite noch da ist. Der Lauf ist eine Schleife über mehrere Aufrufe;
   * verlässt der Admin die Fläche, sollen die restlichen NICHT mehr hinausgehen
   * — und `setState` nach dem Abbau wäre ausserdem ein Fehler.
   *
   * Es gibt bewusst KEINE Browser-Rückfrage dazu: zwischen zwei Mitgliedern
   * besteht kein Zwischenzustand, jede Einladung ist für sich abgeschlossen.
   * Eine Warnung wäre eine Warnung vor einer Gefahr, die es nicht gibt.
   */
  const lebt = useRef(true);
  useEffect(() => {
    lebt.current = true;
    return () => {
      lebt.current = false;
    };
  }, []);

  const filter = { query, status, seite };
  const { data, isLoading, isError, error } = useQuery({
    queryKey: adminMembersQueryKey(filter),
    queryFn: () => fetchAdminMembers(filter),
  });

  /**
   * Die Zahlen an den Reitern (AGE-587).
   *
   * Bewusst OHNE `query` und ohne `seite` — weder im Schlüssel noch im Aufruf.
   * Der Reiter beantwortet „wie viele gibt es", nicht „wie viele meiner
   * Treffer", und die Antwort darauf ändert sich nicht dadurch, dass jemand
   * einen Namen eintippt. Der Preis ist ein scheinbarer Widerspruch — Reiter
   * sagt 12, Liste zeigt zwei —, und der ist gewollt.
   *
   * Ein Fehler wird NICHT zu Nullen geglättet: `zahlen` bleibt dann undefined,
   * und die Reiter zeigen wie beim Laden gar keine Zahl.
   */
  const { data: zahlen } = useQuery({
    queryKey: adminMemberCountsQueryKey,
    queryFn: fetchAdminMemberCounts,
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

  /**
   * Die Stufe eines Mitglieds aus der Liste heraus setzen (AGE-707).
   *
   * Dieselbe RPC wie in der Einzelbearbeitung — kein zweiter Schreibweg. Die
   * Pflichtbegründung wird hier NICHT noch einmal geprüft: der Dialog setzt
   * ohne sie gar nicht ab, und `admin_set_tier` wiese sie ohnehin mit `22023`
   * zurück. Eine dritte Prüfung dazwischen wäre eine dritte Stelle, an der die
   * Regel altern kann.
   */
  const stufeSetzen = useMutation({
    mutationFn: (v: { m: AdminMember; tier: string; grund: string }) =>
      setzeStufe(v.m.id, v.tier, v.grund),
    onSuccess: async (_daten, v) => {
      setStufenDialog(null);
      toast({
        title: `${v.m.name ?? "Mitglied"} steht auf ${levelLabel(v.tier)}`,
        variant: "success",
      });
      // Ohne das Nachladen bliebe das Abzeichen derselben Zeile auf dem alten
      // Wert stehen — der Admin hielte den Aufruf für gescheitert und setzte
      // ein zweites Mal.
      await queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (e) =>
      toast({ title: "Stufe nicht gesetzt", description: fehlerText(e), variant: "error" }),
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

  // `fortschritt !== null` gehört dazu: während des Laufs darf sich an den
  // Zeilen nichts ändern, sonst verschiebt sich die Auswahl unter der Hand.
  const laeuft =
    zugangslink.isPending ||
    aktivieren.isPending ||
    lebenszyklus.isPending ||
    fortschritt !== null;

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
    // Eigener Dialog, NICHT `BRAUCHT_RUECKFRAGE` (AGE-707): dessen drei Fälle
    // sind Ja/Nein über etwas, das jemandem etwas nimmt. Dieser hat zwei
    // Eingaben, und eine davon ist Pflicht.
    if (was === "stufe") {
      setStufenDialog(m);
      return;
    }
    lebenszyklus.mutate({ m, was: was === "reaktivieren" ? "enable" : "restore" });
  }

  const members = data?.members ?? [];
  const auswahlMoeglich = auswahlErlaubt(reiter);
  /** In der REIHENFOLGE DER LISTE, nicht in der des Anklickens — der Bericht
   *  liest sich sonst anders als die Fläche, aus der er entstand. */
  const gewaehlte = auswahlMoeglich ? members.filter((m) => auswahl.has(m.id)) : [];
  /** In ② heisst dieselbe Handlung erinnern. Es ist derselbe Vorgang: ein
   *  zweiter Link ersetzt den ersten, sobald dessen Schutzfenster abgelaufen
   *  ist — und tut er es nicht, meldet der Bericht „übersprungen". */
  const einladeLabel = reiter === "eingeladen" ? "Ausgewählte erinnern" : "Ausgewählte einladen";

  /** Der Filter GEHÖRT in die Adresse. `replace` wäre falsch — ein Wechsel ist
   *  eine Navigation, und die Zurück-Taste soll ihn zurücknehmen. */
  function waehleFilter(id: Reiter) {
    const naechste = new URLSearchParams(suchparameter);
    naechste.set(REITER_PARAM, id);
    setSuchparameter(naechste);
  }

  function auswahlUmschalten(id: string) {
    setAuswahl((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });
  }

  /**
   * Der Lauf: ein Aufruf je Mitglied, nacheinander.
   *
   * Ein Fehlschlag bricht die Reihe NICHT ab — `ladeEin` wirft nicht, es meldet
   * `fehlgeschlagen` als Ergebnis. Der Bericht entsteht dabei aus den ANTWORTEN
   * und nicht aus einem Vorher-Nachher-Vergleich: was für ein Mitglied galt,
   * als sein Aufruf lief, ist sein Ausgang, auch wenn sich der Bestand
   * währenddessen ändert.
   *
   * Die Liste wird erst DANACH einmal neu geladen, mit demselben Schlüssel —
   * also mit Filter, Suchbegriff und Seite. Ein Lauf, der den Admin zurück auf
   * Seite 1 ohne Filter wirft, macht aus einer Auskunft eine Suchaufgabe.
   */
  async function einladungenSchicken(menge: AdminMember[]) {
    setEinladefrage(null);
    setBericht(null);
    setFortschritt({ fertig: 0, gesamt: menge.length });

    const ergebnisse: Einladungsergebnis[] = [];
    for (const m of menge) {
      if (!lebt.current) return;
      const ausgang = await ladeEin(m.id);
      ergebnisse.push({ id: m.id, name: m.name, ausgang });
      if (!lebt.current) return;
      setFortschritt({ fertig: ergebnisse.length, gesamt: menge.length });
    }

    setFortschritt(null);
    setBericht(ergebnisse);
    setAuswahl(new Set());
    await queryClient.invalidateQueries({ queryKey: ["admin-members"] });
  }

  /** Der Name aus der letzten Eingabe — die Antwort der Function trägt ihn
   *  nicht zurück, und die Meldung soll das Mitglied benennen. */
  const letzterName = useRef("");

  /**
   * Das Anlegen. Drei der vier Ausgänge bleiben in der Maske stehen, weil der
   * Admin dort weiterarbeitet: eine vergebene Adresse berichtigt er, einen
   * Fehler versucht er erneut. Nur der Erfolg schliesst sie.
   */
  const anlegen = useMutation({
    mutationFn: (w: NeuesMitglied) => createMember(w),
    onSuccess: async (ergebnis) => {
      if (ergebnis.art === "vergeben" || ergebnis.art === "fehler") return;
      setMaskeOffen(false);
      if (ergebnis.art === "teilweise") {
        // KEIN Erfolgston. Das Konto besteht, aber nicht vollständig — und
        // welcher Schritt fehlt, entscheidet, was zu tun ist.
        setAnlageMeldung({ name: letzterName.current, schritt: ergebnis.schritt });
      } else {
        toast({
          title: `${letzterName.current} ist angelegt`,
          description:
            ergebnis.schritt === "bestaetigungsmail_verschickt"
              ? "Die Bestätigungsmail ist hinausgegangen — das Mitglied steht in ② Eingeladen."
              : "Ohne Mail angelegt — das Mitglied steht in ① Angelegt.",
          variant: "success",
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (e) =>
      toast({ title: "Anlegen fehlgeschlagen", description: fehlerText(e), variant: "error" }),
  });

  return (
    // `pb-28` und nicht `py-8` unten: der schwebende Knopf liegt fest am
    // Ansichtsfenster und deckte in der Sichtprobe auf einem Telefon den
    // „Weiter"-Knopf der Blätterung zu. Platz darunter löst es, ein Wegrücken
    // des Knopfes verschöbe nur das Problem.
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 pb-28">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-ink">Mitglieder</h1>
        <p className="text-sm text-muted">
          Alle Konten, auch die noch nicht bestätigten. Über das Verzeichnis sind diese für
          niemanden sichtbar — hier schon.
        </p>
      </header>

      {/* ZWEI GRUPPEN, EINE AUSWAHL (AGE-927).

          Die Aufnahmestrecke steht über der Reiterleiste; technisch ist beides
          derselbe Wert in der Adresse. Ein EINZIGES `tablist` hält die sieben
          zusammen — zwei nebeneinander läsen sich für eine Vorleseausgabe wie
          zwei unabhängige Auswahlen, und genau das sind sie nicht. Die beiden
          Gruppenkästen tragen deshalb `role="presentation"`: sie gruppieren
          optisch und reichen die Reiter an die Leiste durch.

          Eigene Leiste statt `components/ui/Tabs`: die dortige Komponente hält
          den gewählten Reiter in einem eigenen `useState` und verlangt je
          Reiter einen eigenen Inhalt. Hier trägt die Adresse den Zustand, und
          alle sieben zeigen dieselbe Liste unter einem anderen Filter — die
          Optik ist übernommen, die Zustandsführung nicht. */}
      <div role="tablist" aria-label="Zustand" className="flex flex-col gap-4">
        <div role="presentation" className="flex flex-wrap items-stretch gap-2">
          {STRECKE.map((s, i) => {
            const gewaehlt = s.id === reiter;
            return (
              <Fragment key={s.id}>
                {/* Der Pfeil IST die Folge. Er trägt keine Auskunft, die nicht
                    schon in „Schritt 1/2/3" stünde — deshalb verborgen. */}
                {i > 0 && (
                  <span aria-hidden="true" className="self-center text-muted">
                    &rarr;
                  </span>
                )}
                <button
                  type="button"
                  role="tab"
                  id={`reiter-${s.id}`}
                  aria-selected={gewaehlt}
                  aria-controls={tafelId}
                  // Auch die Filter sind während des Laufs gesperrt. Ohne das
                  // wechselte der Admin auf „Alle", der Fortschrittsstreifen
                  // verschwände mit der Auswahlleiste, und die Schleife liefe
                  // unsichtbar weiter — „die Liste steht still" wäre ein
                  // grösseres Versprechen als die Umsetzung. Diff-Review.
                  disabled={fortschritt !== null}
                  onClick={() => waehleFilter(s.id)}
                  className={
                    "flex flex-col gap-0.5 rounded-[var(--radius-card)] border px-4 py-2 text-left text-sm transition-colors " +
                    (gewaehlt
                      ? "border-accent bg-accent/[0.06] text-accent-strong"
                      : "border-line text-muted hover:text-ink")
                  }
                >
                  <span className="flex items-center gap-2">
                    {/* „Schritt 1" statt der Kreisziffer für die Vorleseausgabe:
                        `\u2460` liest sich je nach Ausgabe als „Kreisziffer eins"
                        oder gar nicht. Die Ziffer bleibt sichtbar und verborgen
                        zugleich — sie ist Bild, nicht Text. */}
                    <span className="sr-only">Schritt {i + 1}</span>
                    <span aria-hidden="true" className="text-base leading-none">
                      {s.ziffer}
                    </span>
                    <span className="font-medium">{s.label}</span>
                    {/* `aria-hidden` wie an den Reitern darunter, aus demselben
                        Grund: die Zahl gehört nicht in den NAMEN eines
                        Bedienelements, sonst änderte er sich bei jeder
                        Einladung. */}
                    {zahlen?.[s.status] !== undefined && (
                      <span aria-hidden="true" className="text-xs tabular-nums">
                        {zahlen[s.status]}
                      </span>
                    )}
                  </span>
                  {/* Die nächste Handlung des Schritts. ③ trägt keine — dort ist
                      nichts mehr zu tun. */}
                  {s.naechste && <span className="text-xs text-muted">{s.naechste}</span>}
                </button>
              </Fragment>
            );
          })}
        </div>

        {/* Die graue Linie sitzt am UMSCHLAG, nicht an der scrollbaren Leiste.
            Beides in einem Element hiess `overflow-x-auto` — und das setzt
            `overflow-y` implizit auf `auto`. Der 1px-Überstand des negativen
            Aussenabstands genügte dann für einen VERTIKALEN Scrollbalken, der
            15 px Breite frass (gemessen: clientWidth 1105 bei 1120 px Breite,
            scrollHeight 34 bei clientHeight 33). Nur die Sichtprobe zeigte ihn. */}
        <div role="presentation" className="border-b border-line">
          <div role="presentation" className="flex gap-6 overflow-x-auto">
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
                disabled={fortschritt !== null}
                onClick={() => waehleFilter(r.id)}
                className={
                  "border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap transition-colors " +
                  (gewaehlt
                    ? "border-accent text-accent-strong"
                    : "border-transparent text-muted hover:text-ink")
                }
              >
                {r.label}
                {/* `aria-hidden`, und das ist der Punkt: der zugängliche NAME
                    des Reiters bleibt seine Beschriftung. Stünde die Zahl darin,
                    läse eine Vorleseausgabe „Nicht aktiviert 2" als Bezeichnung
                    eines Bedienelements vor — und dieser Name änderte sich bei
                    jeder Aktivierung.

                    Solange die Zahl fehlt, steht KEINE da. Nicht die Null: die
                    behauptete einen leeren Verein, solange nur die Antwort noch
                    unterwegs ist (die Lehre aus AGE-582, 6.6). Aus demselben
                    Grund erscheint auch nach einem Fehler keine.

                    `r.status` und nicht `r.id`: „Mitgliedschaft" ist ein
                    Darstellungsmodus über derselben Menge wie „Alle" und trägt
                    deshalb dieselbe Zahl. `admin_list_members(…,
                    'mitgliedschaft')` würfe 22023. */}
                {zahlen?.[r.status] !== undefined && (
                  <span
                    aria-hidden="true"
                    className={
                      "ml-1.5 text-xs tabular-nums " +
                      (gewaehlt ? "text-accent-strong" : "text-muted")
                    }
                  >
                    {zahlen[r.status]}
                  </span>
                )}
              </button>
            );
          })}
          </div>
        </div>
      </div>

      {/* DAS ALTE LESEZEICHEN. `?tab=offen` meinte die VEREINIGUNG aus ① und ②;
          ① allein zeigt weniger. Ohne diesen Satz stünde dort eine kleinere
          Zahl, und niemand erführe, warum. Er hängt am Wert in der ADRESSE und
          verschwindet damit von selbst, sobald ein anderer Filter gewählt wird
          — ein zweiter Zustand dafür wäre einer zu viel. */}
      {suchparameter.get(REITER_PARAM) === ALTER_WERT && hinweisOffen && (
        <div
          role="status"
          className="flex items-start justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-canvas p-4"
        >
          <p className="text-sm text-muted">
            „Nicht aktiviert“ ist jetzt in zwei Schritte geteilt: ① Angelegt und ② Eingeladen.
            Dieses Lesezeichen führt auf ①. Die Summe beider Schritte ist die alte Zahl.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-label="Hinweis schliessen"
            onClick={() => setHinweisOffen(false)}
          >
            Verstanden
          </Button>
        </div>
      )}

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

      {/* DIE EINZIGE HANDLUNG, die aus einer Mehrfachauswahl folgt (ADR-0007).
          Kein Feld für Betreff, Text oder Textbaustein, kein Weg, die Menge zu
          übernehmen oder auszuleiten — und sie erscheint nur in ① und ②, wo sie
          etwas bewirken kann. */}
      {auswahlMoeglich && (gewaehlte.length > 0 || fortschritt !== null) && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={fortschritt !== null || gewaehlte.length === 0}
            onClick={() => setEinladefrage(gewaehlte)}
          >
            {einladeLabel}
          </Button>
          <span className="text-sm text-muted tabular-nums">{gewaehlte.length} ausgewählt</span>
          {/* Fortschritt als ZAHL und kein Modal: der Admin soll die Liste
              weiterlesen können, und „es passiert etwas" ist bei zwölf Aufrufen
              keine Auskunft. Bewusst OHNE `role="status"` — der Bericht darunter
              trägt ihn, und zwei Statusbereiche nebeneinander lesen sich wie
              zwei Meldungen. */}
          {fortschritt !== null && (
            <p aria-live="polite" className="text-sm text-muted tabular-nums">
              {fortschritt.fertig} von {fortschritt.gesamt} bearbeitet
            </p>
          )}
        </div>
      )}

      {/* DER BERICHT BLEIBT STEHEN, bis der Admin ihn schliesst. Kein Ton: ein
          Ton verschwindet, und dieser Bericht ist das Einzige, was sagt, was
          wirklich geschah. */}
      {bericht && (
        <Card role="status" className="p-5">
          <div className="flex items-start justify-between gap-4">
            <CardTitle>Was hinausging</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setBericht(null)}
            >
              Bericht schliessen
            </Button>
          </div>
          {/* ALLE fünf Ausgänge, auch die mit null — sonst sähen „0
              übersprungen" und „nicht geprüft" gleich aus. Und es entsteht gar
              keine Sammelzahl über der gemischten Menge: jede Zeile zählt ihren
              eigenen Ausgang. */}
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {AUSGAENGE.map((a) => {
              const treffer = bericht.filter((e) => e.ausgang === a);
              return (
                <li key={a}>
                  <span className="text-ink tabular-nums">
                    {treffer.length} {AUSGANG_TEXT[a]}
                  </span>
                  {/* NAMENTLICH, nicht nur gezählt — und zwar in JEDEM Topf.
                      Die erste Fassung liess die Verschickten aus, um Platz zu
                      sparen; der Diff-Review hat benannt, was das kostet: der
                      Admin muss die genannten Fehlschläge von seiner Auswahl
                      abziehen, um zu wissen, wer die Mail hat. */}
                  {treffer.length > 0 && (
                    <span className="text-muted">
                      : {treffer.map((e) => e.name ?? "Ohne Namen").join(", ")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* EIN HALB EINGERICHTETES KONTO. Auch hier kein Ton: das Konto BESTEHT,
          und was fehlt, entscheidet, was zu tun ist. */}
      {anlageMeldung && (
        <Card role="status" className="p-5">
          <div className="flex items-start justify-between gap-4">
            <CardTitle>Nur zur Hälfte angelegt</CardTitle>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setAnlageMeldung(null)}
            >
              Meldung schliessen
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted">
            {/* Drei Zweige und kein Sammelzweig — dieselbe Erlaubnisliste-Disziplin
                wie in `ausgangFuer`: ein unbekannter Schritt entsteht, wenn
                Function und Fläche auseinanderlaufen, und darf dann nicht die
                Auskunft eines bekannten bekommen. */}
            {anlageMeldung.schritt === "stufe_nicht_gesetzt" ? (
              <>
                <strong>{anlageMeldung.name}</strong> hat ein Konto, aber die Stufe wurde nicht
                gesetzt. Das Mitglied steht in ① Angelegt auf der Vorgabestufe und ist über
                „Stufe setzen“ im Zeilenmenü zu berichtigen. Ein zweites Anlegen hilft nicht —
                die Adresse ist jetzt vergeben.
              </>
            ) : anlageMeldung.schritt === "mail_nicht_verschickt" ? (
              <>
                <strong>{anlageMeldung.name}</strong> ist angelegt, die Bestätigungsmail ging
                aber nicht hinaus. Das Mitglied steht trotzdem in ② Eingeladen, weil ein Link
                erzeugt wurde — dieser Link ist entwertet und hält das Schutzfenster NICHT.
                „Ausgewählte erinnern“ schickt nach einer Minute einen neuen.
              </>
            ) : (
              <>
                <strong>{anlageMeldung.name}</strong> hat ein Konto, aber die Anlage ist nicht
                vollständig durchgelaufen. Welcher Schritt fehlt, sagt die Antwort nicht — das
                Mitglied steht in ① Angelegt und ist von dort aus zu prüfen.
              </>
            )}
          </p>
        </Card>
      )}

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
                      {/* KEIN Kopfkästchen. Ein „alle auf dieser Seite" wäre mit
                          EINEM Klick deckungsgleich mit „alle 35 einladen" —
                          genau der Handlung, die ADR-0007 verwirft. Die Spalte
                          bleibt trotzdem benannt, sonst ist sie namenlos. */}
                      {auswahlMoeglich && (
                        <th className="w-8 py-2 pr-2">
                          <span className="sr-only">Auswahl</span>
                        </th>
                      )}
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
                        {auswahlMoeglich && (
                          <td className="py-2 pr-2">
                            <Auswahlkasten
                              member={m}
                              gewaehlt={auswahl.has(m.id)}
                              gesperrt={fortschritt !== null}
                              onUmschalten={auswahlUmschalten}
                            />
                          </td>
                        )}
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
                      <div className="flex items-start gap-2">
                        {auswahlMoeglich && (
                          <Auswahlkasten
                            member={m}
                            gewaehlt={auswahl.has(m.id)}
                            gesperrt={fortschritt !== null}
                            onUmschalten={auswahlUmschalten}
                          />
                        )}
                        <Link to={`/admin/mitglied/${m.id}`} className="font-medium text-ink">
                          {m.name ?? "Ohne Namen"}
                        </Link>
                      </div>
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
                      {auswahlMoeglich && (
                        <Auswahlkasten
                          member={m}
                          gewaehlt={auswahl.has(m.id)}
                          gesperrt={fortschritt !== null}
                          onUmschalten={auswahlUmschalten}
                        />
                      )}
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

      {/* DER EINSTIEG IN DIE MASKE — schwebend, damit er beim Blättern durch
          fünfundzwanzig Zeilen nicht davonscrollt.

          `z-40` liegt ÜBER der Chatfenster-Reihe (`z-30`), und das ist die
          Entscheidung: ein Anlegen-Knopf, der hinter einem Chatfenster
          verschwindet, ist unerreichbar. Die Abstände rechnen
          `env(safe-area-inset-*)` mit ein, damit er auf einem Gerät ohne
          Home-Knopf nicht im Wischstreifen liegt. */}
      {/* EIN EIGENER KNOPF UND NICHT `Button`. Jener bringt `rounded-md` mit,
          und `cn()` ist ein blosser Join ohne `tailwind-merge` — über den
          Vorrang entscheidet dann die Reihenfolge im Stylesheet, nicht die im
          Attribut. In der Sichtprobe war der Knopf deshalb ECKIG, obwohl
          `rounded-full` danebenstand. Dieselbe Falle steht schon am Auslöser
          des Zeilenmenüs im Kommentar. */}
      <button
        type="button"
        aria-label="Mitglied anlegen"
        onClick={() => setMaskeOffen(true)}
        className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-soft transition-colors hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-soft focus-visible:outline-none"
        style={{
          right: "calc(1.5rem + env(safe-area-inset-right))",
          bottom: "calc(1.5rem + env(safe-area-inset-bottom))",
        }}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
          <path d="M11 5h2v14h-2z" />
          <path d="M5 11h14v2H5z" />
        </svg>
      </button>

      {maskeOffen && (
        <AnlageMaske
          laeuft={anlegen.isPending}
          ergebnis={anlegen.data}
          onAbbrechen={() => {
            setMaskeOffen(false);
            anlegen.reset();
          }}
          onAnlegen={(w) => {
            letzterName.current = `${w.vorname} ${w.nachname}`;
            anlegen.mutate(w);
          }}
        />
      )}

      {einladefrage && (
        <Einladefrage
          menge={einladefrage}
          erinnerung={reiter === "eingeladen"}
          onAbbrechen={() => setEinladefrage(null)}
          onBestaetigen={() => void einladungenSchicken(einladefrage)}
        />
      )}

      {stufenDialog && (
        <StufenDialog
          member={stufenDialog}
          laeuft={stufeSetzen.isPending}
          onAbbrechen={() => setStufenDialog(null)}
          onBestaetigen={(tier, grund) => stufeSetzen.mutate({ m: stufenDialog, tier, grund })}
        />
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

/**
 * Der Zustand einer Zeile — in JEDER Sicht, sonst hiesse „drei Sichten auf
 * dieselben Zeilen" drei verschiedene Wahrheiten. Gemeint sind die drei
 * ANSICHTEN (Tabelle, Karten, Verzeichnis), nicht die Reiter.
 *
 * DER LEBENSZYKLUS GEHT VOR, und bis zur Sichtprobe am 24.08. kam er hier gar
 * nicht vor: die Spalte las allein `bestaetigt`, also stand auf den Reitern
 * „Deaktiviert" und „Gelöscht" in der Spalte „Zustand" das Wort **Aktiviert**.
 * Auf „Alle" tauchen diese Zeilen nicht auf — der Reiter war damit das einzige
 * Signal, und die Zeile sagte das Gegenteil.
 *
 * Er ERSETZT die Aktivierungsplakette und steht nicht daneben: ob ein
 * entferntes Konto einmal bestätigt war, ist keine geltende Aussage mehr,
 * sondern Vorgeschichte — und sie kommt zurück, sobald die Zeile
 * wiederhergestellt ist. Zwei Plaketten nebeneinander hätten ausserdem in
 * jeder Zeile die Breite verschoben, wie es „unbekannt" schon einmal tat.
 *
 * `muted` für beide: die Varianten tragen Gewicht, keine Farbe (AGE-237). Eine
 * entfernte Zeile ist die leise, nicht die laute — das Wort sagt, was gilt.
 */
function Zustand({ member }: { member: AdminMember }) {
  if (member.geloescht_seit !== null) return <Badge variant="muted">Gelöscht</Badge>;
  if (member.deaktiviert_seit !== null) return <Badge variant="muted">Deaktiviert</Badge>;
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
  // AGE-707: OHNE Vorbehalt, anders als die beiden darüber. Die beiden hängen
  // daran, ob das Konto sich anmelden kann; eine Stufe hängt daran nicht, und
  // `admin_set_tier` kennt keinen solchen Zweig. Ein engeres Menü machte genau
  // den Fall unkorrigierbar, für den die Funktion gebaut wurde: ein irrtümlich
  // zu hoch importiertes Mitglied, das inzwischen deaktiviert ist.
  eintraege.push({ id: "stufe", label: "Stufe setzen" });
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
  const overlay = useOverlay(true, onAbbrechen);
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

/**
 * Der Stufen-Dialog (AGE-707).
 *
 * WARUM EIGENES BAUTEIL UND NICHT `Rueckfrage`: jene drei Fälle sind Ja/Nein
 * über etwas, das jemandem etwas nimmt. Dieser hat zwei Eingaben. Sie in
 * denselben Verteiler zu pressen hiesse, den Rückfragedialog um Felder zu
 * erweitern, die drei Vierteln seiner Benutzer nichts sagen.
 *
 * WARUM DER KNOPF OHNE BEGRÜNDUNG GESPERRT IST: `admin_set_tier` bricht bei
 * leerer Begründung mit `22023` ab. Ein roher Datenbankfehler NACH dem
 * Bestätigen ist kein Ersatz für ein gesperrtes Bestätigen davor — dieselbe
 * Regel, nach der `aktionenFuer` schon heute keinen Eintrag anbietet, dessen
 * einziger Ausgang ein Fehler ist.
 */
function StufenDialog({
  member,
  laeuft,
  onAbbrechen,
  onBestaetigen,
}: {
  member: AdminMember;
  laeuft: boolean;
  onAbbrechen: () => void;
  onBestaetigen: (tier: string, grund: string) => void;
}) {
  const overlay = useOverlay(true, onAbbrechen);
  const name = member.name ?? "Dieses Mitglied";
  // Vorbelegt mit der Stufe, auf der das Mitglied steht: der Dialog beantwortet
  // „worauf setzen", und dazu gehört sichtbar, wovon aus.
  const [tier, setTier] = useState<string>(member.tier);

  // ── Angeboten werden nur die drei CLUBSTUFEN (AGE-903, Detlev 25.09.) ──────
  //
  // ACTIVE, BOOST und CONNECT liegen ausserhalb des Clubs und sind nicht
  // wählbar. Die Beschränkung liegt HIER und nicht in `admin_set_tier()`: die
  // Funktion nimmt weiterhin alle sechs Schlüssel und setzt in beide Richtungen.
  // Zwei Gründe, beide aus dem Entwurf: eine Korrektur nach unten muss möglich
  // bleiben, wenn ein Konto versehentlich zu hoch gesetzt wurde — genau dafür
  // gibt es `admin_set_tier()` neben `apply_upgrade()`; und eine
  // Oberflächenregel in einer SECURITY-DEFINER-Funktion zu verankern machte aus
  // einer Anzeigeentscheidung eine Rechtegrenze, die sich nur noch per Migration
  // ändern lässt. Daraus folgt ausdrücklich: das ist KEINE Sicherheitsgrenze.
  //
  // Die BESTEHENDE Stufe bleibt in der Liste, auch wenn sie darunter liegt. Eine
  // Auswahl, die eine gesetzte Stufe verschweigt, liesse den Admin glauben, das
  // Konto stehe auf der ersten angebotenen — und `value={tier}` fiele auf einen
  // Wert zurück, den niemand gewählt hat.
  const waehlbar = LEVEL_ORDER.filter(
    (key) => LEVELS[key].rank >= CLUB_RANK || key === member.tier,
  );
  const [grund, setGrund] = useState("");

  return (
    <div
      ref={overlay}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Mitgliedsstufe von ${name} ändern`}
    >
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={onAbbrechen} />
      <div className="relative w-full max-w-md rounded-[var(--radius-card)] bg-canvas p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-ink">Stufe setzen</h2>
        <p className="mt-2 text-sm text-muted">
          <strong>{name}</strong> steht auf {levelLabel(member.tier)}.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <Field label="Neue Stufe">
            {({ id }) => (
              <Select id={id} value={tier} onChange={(e) => setTier(e.target.value)}>
                {waehlbar.map((key) => (
                  <option key={key} value={key}>
                    {levelLabel(key)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Begründung">
            {({ id }) => (
              <Input
                id={id}
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                placeholder="Warum wird die Stufe gesetzt?"
              />
            )}
          </Field>
        </div>

        {/* Dieselbe Zusage, die die Karte in der Einzelbearbeitung trägt: die
            Fläche benennt, was ein späterer Stripe-Kauf mit dieser Stufe tut. */}
        <p className="mt-4 text-sm text-muted">
          Die Änderung landet mit alter Stufe, neuer Stufe und Begründung im Admin-Protokoll. Kauft
          das Mitglied später eine höhere Stufe, überschreibt Stripe diese Angabe; eine niedrigere
          überschreibt sie nicht.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onAbbrechen}>
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={laeuft || grund.trim() === ""}
            onClick={() => onBestaetigen(tier, grund.trim())}
          >
            Stufe setzen
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

/**
 * Das Kontrollkästchen einer Zeile (AGE-927, ADR-0007).
 *
 * Eigenes Bauteil, weil es in allen drei Sichten steht und in jeder denselben
 * zugänglichen Namen braucht: auf einer Seite mit fünfundzwanzig Zeilen sind
 * fünfundzwanzig Kästchen namens „Auswahl" für eine Vorleseausgabe nicht
 * auseinanderzuhalten — dieselbe Begründung wie am Auslöser des Zeilenmenüs.
 *
 * Während eines Laufs GESPERRT: die Liste steht dann still, und eine Auswahl,
 * die sich währenddessen ändert, passte nicht mehr zu der Menge, über die die
 * Schleife läuft.
 */
function Auswahlkasten({
  member,
  gewaehlt,
  gesperrt,
  onUmschalten,
}: {
  member: AdminMember;
  gewaehlt: boolean;
  gesperrt: boolean;
  onUmschalten: (id: string) => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={`${member.name ?? "Dieses Mitglied"} auswählen`}
      checked={gewaehlt}
      disabled={gesperrt}
      onChange={() => onUmschalten(member.id)}
      className="size-4 rounded border-line text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    />
  );
}

/**
 * Die Rückfrage vor einem Lauf (AGE-927).
 *
 * Sie nennt die ZAHL und die Unumkehrbarkeit — nicht „Sind Sie sicher?". Die
 * Zahl ist die Auskunft, und die Unumkehrbarkeit ist der Grund für die Frage.
 *
 * Sie nennt ausserdem das Übersprungene im Voraus: wer schon einen gültigen
 * Link im Postfach hat, bekommt keinen zweiten. Ohne diesen Satz läse sich der
 * Bericht danach wie ein Fehler.
 */
function Einladefrage({
  menge,
  erinnerung,
  onAbbrechen,
  onBestaetigen,
}: {
  menge: AdminMember[];
  /** In ② heisst dieselbe Handlung erinnern. Die Rückfrage sagt das auch —
   *  sonst fragt sie nach etwas anderem, als der Knopf verspricht. */
  erinnerung: boolean;
  onAbbrechen: () => void;
  onBestaetigen: () => void;
}) {
  const overlay = useOverlay(true, onAbbrechen);

  return (
    <div
      ref={overlay}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${erinnerung ? "Erinnerung" : "Einladung"} an ${menge.length} Mitglieder`}
    >
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={onAbbrechen} />
      <div className="relative w-full max-w-md rounded-[var(--radius-card)] bg-canvas p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-ink">
          An {menge.length} Mitglieder {erinnerung ? "eine Erinnerung" : "eine Einladung"}{" "}
          schicken?
        </h2>
        <p className="mt-2 text-sm text-muted">
          Verschickte Mails lassen sich nicht zurückholen.
        </p>
        <p className="mt-2 text-sm text-muted">
          Wer schon einen gültigen Link im Postfach hat, bekommt keinen zweiten — der Bericht
          sagt danach, wen es betraf.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onAbbrechen}>
            Abbrechen
          </Button>
          <Button type="button" onClick={onBestaetigen}>
            Einladen
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Bewusst GROB, und dieselbe Form wie in `admin-create-member/anlegen.ts`. Die
 * Adresse wird nicht von uns bestätigt, sondern vom Anmeldedienst übernommen —
 * eine strenge Prüfung gäbe eine Sicherheit vor, die sie nicht hat. Was sie
 * abfängt, sind Tippfehler und leere Felder.
 *
 * Sie steht hier ZUSÄTZLICH und nicht STATT der Prüfung im Endpunkt: eine
 * Prüfung, die nur die Fläche vornimmt, ist keine.
 */
const EMAIL_FORM = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Die Maske zum Anlegen eines einzelnen Mitglieds (AGE-927).
 *
 * WARUM SIE DREI VON VIER AUSGÄNGEN SELBST ZEIGT: eine vergebene Adresse
 * berichtigt der Admin hier, einen Fehler versucht er hier erneut. Nur der
 * Erfolg schliesst sie. Ein Ton statt dieser Zeilen hiesse, den Admin aus der
 * Maske zu werfen und ihn alles noch einmal tippen zu lassen.
 *
 * DER PLAN BIETET NUR DIE DREI CLUBSTUFEN. Dieselbe Zusage wie im Stufen-Dialog
 * und aus demselben Grund: ACTIVE, BOOST und CONNECT liegen ausserhalb des
 * Clubs. Die Beschränkung liegt an der Fläche, nicht in der Datenbank — das ist
 * eine Anzeigeentscheidung und ausdrücklich KEINE Rechtegrenze.
 *
 * DER HAKEN IST VORAUSGEWÄHLT: der Regelfall ist, dass das neue Mitglied auch
 * erfährt, dass es eines ist.
 */
function AnlageMaske({
  laeuft,
  ergebnis,
  onAbbrechen,
  onAnlegen,
}: {
  laeuft: boolean;
  ergebnis: AnlageAusgang | undefined;
  onAbbrechen: () => void;
  onAnlegen: (w: NeuesMitglied) => void;
}) {
  const overlay = useOverlay(true, onAbbrechen);
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<string>(CLUB_LEVEL);
  const [mailSenden, setMailSenden] = useState(true);
  const [firma, setFirma] = useState("");
  const [telefon, setTelefon] = useState("");
  /** Was die Maske selbst beanstandet. Getrennt von `ergebnis`, das vom
   *  Endpunkt kommt — sonst verdeckte das eine das andere. */
  const [fehler, setFehler] = useState<string | null>(null);

  const waehlbar = LEVEL_ORDER.filter((key) => LEVELS[key].rank >= CLUB_RANK);

  function absenden() {
    const v = vorname.trim();
    const n = nachname.trim();
    const e = email.trim();
    if (v === "" || n === "") {
      setFehler("Vorname und Nachname sind Pflicht.");
      return;
    }
    if (!EMAIL_FORM.test(e)) {
      setFehler("Die E-Mail-Adresse hat keine gültige Form.");
      return;
    }
    setFehler(null);
    onAnlegen({
      vorname: v,
      nachname: n,
      email: e,
      plan,
      mailSenden,
      firma: firma.trim(),
      telefon: telefon.trim(),
    });
  }

  return (
    <div
      ref={overlay}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Mitglied anlegen"
    >
      <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={onAbbrechen} />
      <div className="relative w-full max-w-md overflow-y-auto rounded-[var(--radius-card)] bg-canvas p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-ink">Mitglied anlegen</h2>
        <p className="mt-2 text-sm text-muted">
          Das Konto entsteht ohne Passwort und unbestätigt — genau wie ein importiertes. Das
          Mitglied bestätigt selbst über den Link.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <Field label="Vorname">
            {({ id }) => (
              <Input id={id} value={vorname} onChange={(e) => setVorname(e.target.value)} />
            )}
          </Field>
          <Field label="Nachname">
            {({ id }) => (
              <Input id={id} value={nachname} onChange={(e) => setNachname(e.target.value)} />
            )}
          </Field>
          <Field label="E-Mail">
            {({ id }) => (
              <Input
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </Field>
          <Field label="Plan">
            {({ id }) => (
              <Select id={id} value={plan} onChange={(e) => setPlan(e.target.value)}>
                {waehlbar.map((key) => (
                  <option key={key} value={key}>
                    {levelLabel(key)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {/* Freiwillig, und deshalb hinter den Pflichtfeldern. Sie stehen hier,
              weil `admin_mitglied_einrichten` sie kennt — ein Feld ohne Aufrufer
              wäre ein vergessenes. */}
          <Field label="Firma (freiwillig)">
            {({ id }) => (
              <Input id={id} value={firma} onChange={(e) => setFirma(e.target.value)} />
            )}
          </Field>
          <Field label="Telefon (freiwillig)">
            {({ id }) => (
              <Input id={id} value={telefon} onChange={(e) => setTelefon(e.target.value)} />
            )}
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={mailSenden}
              onChange={(e) => setMailSenden(e.target.checked)}
              className="size-4 rounded border-line text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
            <span>Bestätigungsmail senden</span>
          </label>
        </div>

        {fehler && <p className="mt-4 text-sm text-danger">{fehler}</p>}

        {/* Die Adresse gehört schon jemandem. NAMENTLICH und verlinkt — und mit
            der Angabe, ob das Mitglied entfernt wurde: der wiederkehrende
            Bewerber ist der erwartbare Fall, und ein Verweis auf jemanden, den
            der Admin in keiner sichtbaren Liste findet, wäre eine Sackgasse. */}
        {ergebnis?.art === "vergeben" && (
          <p className="mt-4 text-sm text-danger">
            Diese Adresse gehört bereits zu{" "}
            <Link to={`/admin/mitglied/${ergebnis.mitglied.id}`} className="underline">
              {ergebnis.mitglied.name ?? "einem Mitglied ohne Namen"}
            </Link>
            {ergebnis.mitglied.geloescht
              ? " — dieses Mitglied ist gelöscht und steht nur im Filter „Gelöscht“."
              : ergebnis.mitglied.deaktiviert
                ? " — dieses Mitglied ist deaktiviert und steht nur im Filter „Deaktiviert“."
                : "."}
          </p>
        )}
        {ergebnis?.art === "fehler" && (
          <p className="mt-4 text-sm text-danger">{ergebnis.text}</p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onAbbrechen}>
            Abbrechen
          </Button>
          <Button type="button" disabled={laeuft} onClick={absenden}>
            {laeuft ? "Legt an …" : "Anlegen"}
          </Button>
        </div>
      </div>
    </div>
  );
}
