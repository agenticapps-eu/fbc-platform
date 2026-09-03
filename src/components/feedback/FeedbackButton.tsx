import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

import {
  FEEDBACK_SCREENSHOT_MAX_BYTES,
  FEEDBACK_SCREENSHOT_TYPEN,
  feedbackThemenQueryKey,
  fetchFeedbackThemen,
  submitPlatformFeedback,
  uploadFeedbackScreenshot,
} from "../../lib/feedback";
import { useAuth } from "../../providers/auth-context";
import { Button, Select, Textarea, useToast } from "../ui";
import { useBildauswahl } from "../ui/useBildauswahl";
import { useOverlay } from "../ui/useOverlay";
import { Icon } from "../ui/icons";

/**
 * QM-Feedback (AGE-300) — Spec §3.5. Eintrag am FUSS DER SEITENLEISTE, über
 * dem Einklapp-Schalter.
 *
 * SEIT AGE-566 nicht mehr schwebend: der Knopf hing über dem Inhalt und deckte
 * auf der Startseite den Aufruf „Mitglieder entdecken" halb zu. Das war kein
 * Zufall, sondern die zweite Kollision derselben Art — die erste (AGE-529, über
 * der Kachel „Frage" auf 375 px) wurde durch Verschieben gelöst, und genau das
 * hat sich jetzt gerächt. In der Leiste konkurriert er mit nichts.
 *
 * Kein Nav-Eintrag: `src/config/nav.test.ts` nagelt die Navigation exakt an Spec §2
 * fest (6+5+1). Ein Eintrag hier bräche beides. Der Route-Kontext tritt an die Stelle
 * der Aktion — deshalb muss das Modul überall erreichbar sein, nicht an einer Stelle.
 *
 * Kein Dialog-Primitive im Repo → Overlay-Muster aus AppShell.tsx (Off-Canvas-Sidebar).
 */
const STARS = [1, 2, 3, 4, 5] as const;

/**
 * Fanfare, keine Sprechblase — dieselbe Strichstärke wie die Icons der
 * Navigation.
 *
 * Die erste Fassung war eine Sprechblase und damit ZEICHENGLEICH mit dem
 * Eintrag „Aktivität" zwei Zeilen darüber (`NavIcon.tsx`). Zwei Einträge
 * derselben Leiste mit demselben Symbol heben sich gegenseitig auf: das Symbol
 * unterscheidet dann nicht mehr, es dekoriert nur noch. Und inhaltlich stimmt
 * die Fanfare besser — Feedback ist ein Zuruf an uns, kein Gespräch unter
 * Mitgliedern.
 */
function FeedbackIcon() {
  return <Icon name="feedback" className="h-5 w-5 shrink-0" />;
}

export function FeedbackButton({
  collapsed = false,
  onOffenChange,
}: {
  collapsed?: boolean;
  /**
   * Meldet der aufrufenden Fläche, ob das Formular offen ist (AGE-688).
   *
   * Die Off-Canvas-Navigation braucht das: sie trägt selbst `aria-modal`, und
   * dieses Formular hängt per Portal an `body`, also AUSSERHALB von ihr. Trügen
   * beide das Attribut, hielte Vorlesesoftware genau das Formular für inert.
   */
  onOffenChange?: (offen: boolean) => void;
}) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [likes, setLikes] = useState("");
  const [misses, setMisses] = useState("");
  const [idea, setIdea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Der Schlüssel des gewählten Themas, "" heisst „noch nichts gewählt".
  const [thema, setThema] = useState("");
  const [bild, setBild] = useState<File | null>(null);
  /**
   * Der Pfad des BEREITS hochgeladenen Bildes. Er überlebt einen
   * fehlgeschlagenen Versuch, damit der zweite Druck auf „Absenden" nicht
   * ein zweites Objekt anlegt: `uploadFeedbackScreenshot` baut den Pfad aus
   * `Date.now()`, ein erneuter Aufruf träfe also nie dieselbe Stelle und
   * liesse pro Versuch eine Waise im Bucket zurück, die niemand mehr sieht.
   */
  const [hochgeladenerPfad, setHochgeladenerPfad] = useState<string | null>(null);
  const dateiRef = useRef<HTMLInputElement>(null);
  const bildWahl = useBildauswahl(([datei]) => uebernehmeBild(datei));

  /**
   * Die Themen kommen aus der DATENBANK (AGE-628, design.md Entscheidung 1).
   * Weder Schlüssel noch Beschriftung stehen hier — stünden sie, gäbe es die
   * Liste zweimal, und nichts verglichen die beiden Abschriften.
   *
   * Deshalb auch die Vorbelegung über `themen[0]` und nicht über ein Literal
   * `"generell"`: die Reihenfolge steht in `feedback_themes.sort`, und die
   * erste Zeile IST „Generell".
   */
  const { data: themen = [] } = useQuery({
    queryKey: feedbackThemenQueryKey,
    queryFn: fetchFeedbackThemen,
  });
  const gewaehltesThema = thema || themen[0]?.key || "";
  // VOR dem frühen `return null` unten (AGE-529): stünde der Hook dahinter,
  // verletzte jeder Wechsel des Anmeldezustands die Hook-Regeln. `Boolean(user)`
  // in der Bedingung sorgt außerdem dafür, dass ein Sitzungsverlust bei offenem
  // Panel keine Sperre ohne sichtbares Overlay zurücklässt.
  const overlay = useOverlay(Boolean(user) && open, () => setOpen(false));

  // Als Effekt auf `open` und NICHT an den einzelnen `setOpen(false)`-Stellen:
  // die liegen in `close()`, im Erfolgszweig von `submit()` und im Rückweg von
  // `useOverlay` — eine davon zu übersehen liesse die Schublade ohne
  // `aria-modal` zurück, und das sähe niemand, weil sichtbar alles stimmt.
  //
  // Das Aufräumen spart genau EINEN Renderdurchgang, und das ist ehrlich so
  // gemessen: hängt der Auslöser samt Schublade ab (Sprung über `lg`) und geht
  // sie später wieder auf, meldet die neu gemountete Instanz beim Aufsetzen
  // ohnehin `false`. Ohne das Aufräumen träfe das aber erst NACH dem ersten
  // Render — die frisch geöffnete Schublade käme für einen Durchgang ohne
  // `aria-modal` hoch. Kein Test unterscheidet die beiden Fassungen; die
  // Zeile steht für den einen Durchgang, nicht für einen Fehlerfall.
  // `Boolean(user) && open` und nicht bloss `open` — dieselbe Bedingung wie am
  // Hook darüber und aus demselben Grund: geht die Sitzung bei offenem Panel
  // verloren, rendert diese Komponente gar nichts mehr, und eine Meldung
  // „offen" liesse die Schublade ohne `aria-modal` zurück, ohne dass etwas
  // über ihr läge.
  const panelOffen = Boolean(user) && open;
  useEffect(() => {
    if (!onOffenChange) return;
    onOffenChange(panelOffen);
    return () => onOffenChange(false);
  }, [panelOffen, onOffenChange]);

  // Ohne Konto ist Feedback nicht speicherbar: feedback.profile_id ist `not null`
  // und feedback_own verlangt profile_id = auth.uid(). Einen Button zu zeigen, der
  // nur scheitern kann, wäre ein Versprechen ins Leere.
  if (!user) return null;
  // tsc verengt `user` nicht in die weiter unten definierte `submit`-Closure hinein
  // (Kontrollfluss-Analyse endet an der Funktionsgrenze). Deshalb hier binden statt
  // dort `user!` zu casten.
  const profileId = user.id;

  function close() {
    setOpen(false);
    setError(null);
    // Das Bild MUSS mit weg. Sonst hängt beim nächsten Öffnen wortlos die
    // Datei aus dem abgebrochenen Versuch wieder dran — gemessen im Browser
    // am 02.09.: nach „Abbrechen" und erneutem Öffnen stand der Dateiname
    // samt „Entfernen" unverändert da. Der Text bleibt bewusst stehen (ein
    // versehentliches Schliessen soll den Entwurf nicht kosten); ein
    // stillschweigend wieder angehängter Screenshot ist etwas anderes, weil
    // ihn niemand im Formular sucht.
    setBild(null);
    setHochgeladenerPfad(null);
  }

  /**
   * Dieselben Grenzen wie am Bucket, und zwar HIER schon — aber die Grenze IST
   * der Bucket (`feedback-screenshots`: privat, 5 MiB, png/jpeg/webp). Was hier
   * passiert, ist Komfort: ein verständlicher Satz statt einer
   * Storage-Fehlermeldung, und zwar bevor jemand fünf Minuten auf einen Upload
   * wartet, der ohnehin abgewiesen wird.
   */
  function uebernehmeBild(datei: File | undefined) {
    if (!datei) return;
    if (!(FEEDBACK_SCREENSHOT_TYPEN as readonly string[]).includes(datei.type)) {
      setError("Bitte ein Bild als PNG, JPEG oder WebP auswählen.");
      return;
    }
    if (datei.size > FEEDBACK_SCREENSHOT_MAX_BYTES) {
      setError("Das Bild ist grösser als 5 MB.");
      return;
    }
    setError(null);
    setBild(datei);
    // Ein neues Bild macht den gemerkten Pfad ungültig: sonst hinge nach einem
    // gescheiterten Versuch das ALTE Objekt an der Zeile, obwohl auf dem
    // Bildschirm der neue Dateiname steht.
    setHochgeladenerPfad(null);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      // ERST das Bild, dann die Zeile. Andersherum stünde bei einem Abbruch
      // dazwischen eine Feedback-Zeile ohne ihr Bild — und niemand wüsste,
      // dass eines gemeint war. So herum ist der schlimmste Ausgang ein
      // verwaistes Objekt, das niemand sieht.
      //
      // Und HÖCHSTENS EINMAL hochladen: scheitert das Einfügen der Zeile,
      // liegt das Objekt schon oben. Ein zweiter Druck auf „Absenden" ohne
      // diesen Merker lüde es unter einem neuen `Date.now()`-Pfad erneut hoch
      // und liesse das erste als Waise zurück — in einem privaten Bucket, den
      // nichts aufräumt.
      let screenshotPath: string | null = null;
      if (bild) {
        screenshotPath = hochgeladenerPfad ?? (await uploadFeedbackScreenshot(profileId, bild));
        setHochgeladenerPfad(screenshotPath);
      }
      await submitPlatformFeedback({
        profileId,
        rating,
        likes,
        misses,
        idea,
        route: pathname,
        // Leer heisst „nicht nennen": dann trägt die Spalte ihren dauerhaften
        // Vorgabewert. Solange die Themenliste nicht geladen ist, ist das der
        // richtige Weg — und nicht ein hier hingeschriebenes „generell".
        theme: gewaehltesThema || undefined,
        screenshotPath,
      });
      toast({ title: "Danke für dein Feedback!" });
      setRating(0);
      setLikes("");
      setMisses("");
      setIdea("");
      setThema("");
      setBild(null);
      setHochgeladenerPfad(null);
      setOpen(false);
    } catch {
      setError("Dein Feedback konnte nicht gespeichert werden. Bitte versuche es noch einmal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Unter `sm` schwebt er NICHT (AGE-529): gemessen auf 375×812 lag er über der
          kuratierten Kachel „Frage", `elementFromPoint` in deren Mitte lieferte
          „Feedback". Er wird ohnehin nach <main> gerendert — ohne `fixed` fällt er
          von selbst ans Seitenende. Nicht bloß verschoben: die nächste Kollision
          wäre dieselbe, und dann misst niemand mehr nach.

          bottom-20 (nicht bottom-5): weicht dem Design-Variant-Switcher aus, der bei
          bottom-4 rechts unten sitzt (DesignSwitcher.tsx, AGE-237). Sobald der Switcher
          nach der Design-Entscheidung entfernt ist, kann das wieder bottom-5 werden. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={collapsed ? "Feedback" : undefined}
        aria-label={collapsed ? "Feedback" : undefined}
        className={
          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-on-chrome transition-colors hover:bg-chrome-elevated hover:text-on-chrome-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" +
          (collapsed ? " justify-center px-2" : "")
        }
      >
        <FeedbackIcon />
        {!collapsed && <span>Feedback</span>}
      </button>

      {/* PORTAL an document.body, seit der Auslöser in der Seitenleiste sitzt:
          ein Vorfahre mit `transform`, `filter` oder `backdrop-filter` wird zum
          Containing Block für `position: fixed`, und das Overlay schrumpfte
          dann auf die Leiste. In diesem Projekt schon zweimal passiert
          (AGE-529). Die Leiste trägt heute keines davon — aber sie muss es
          auch nie wieder dürfen. */}
      {open &&
        createPortal(
          <div
            ref={overlay}
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-label="Feedback geben"
          >
            <div className="absolute inset-0 bg-scrim backdrop-blur-sm" onClick={close} />
            <div className="absolute bottom-0 right-0 max-h-[90vh] w-full overflow-y-auto rounded-t-[var(--radius-card)] bg-canvas p-6 shadow-soft sm:bottom-5 sm:right-5 sm:w-[26rem] sm:rounded-[var(--radius-card)]">
              <h2 className="text-lg font-semibold text-ink">Wie gefällt dir die Plattform?</h2>

              <div className="mt-4" role="radiogroup" aria-label="Sternebewertung">
                {STARS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} von 5 Sternen`}
                    onClick={() => setRating(n)}
                    className="px-1 text-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
                  >
                    <span aria-hidden="true">{n <= rating ? "★" : "☆"}</span>
                  </button>
                ))}
              </div>

              {/* Die Auswahl erscheint erst, wenn die Themen da sind. Eine
                  Liste mit einem hier hingeschriebenen „Generell" wäre die
                  zweite Abschrift, gegen die design.md antritt — und ein
                  leeres Auswahlfeld sähe aus wie ein Fehler. Ohne die Liste
                  trägt die Zeile den Vorgabewert der Spalte, das Absenden
                  bleibt also möglich. */}
              {themen.length > 0 && (
                <>
                  <label className="mt-4 block text-sm font-medium text-ink" htmlFor="fb-thema">
                    Worum geht es?
                  </label>
                  <Select
                    id="fb-thema"
                    className="mt-1"
                    value={gewaehltesThema}
                    onChange={(e) => setThema(e.target.value)}
                  >
                    {themen.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </>
              )}

              <label className="mt-4 block text-sm font-medium text-ink" htmlFor="fb-likes">
                Was gefällt dir?
              </label>
              <Textarea
                id="fb-likes"
                rows={2}
                value={likes}
                onChange={(e) => setLikes(e.target.value)}
              />

              <label className="mt-3 block text-sm font-medium text-ink" htmlFor="fb-misses">
                Was fehlt dir?
              </label>
              <Textarea
                id="fb-misses"
                rows={2}
                value={misses}
                onChange={(e) => setMisses(e.target.value)}
              />

              <label className="mt-3 block text-sm font-medium text-ink" htmlFor="fb-idea">
                Welche Idee hast du?
              </label>
              <Textarea
                id="fb-idea"
                rows={2}
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
              />

              {/* Optional, und das steht auch dran. Der Screenshot ist der
                  Unterschied zwischen „irgendwas ist komisch" und einer
                  Meldung, mit der jemand etwas anfangen kann.

                  Das Dateifeld ist versteckt und wird vom Knopf ausgelöst —
                  dasselbe Muster wie `EventCoverPicker`. Nativ übernimmt
                  `useBildauswahl` die Rückfrage „Kamera oder Galerie"; im Web
                  klickt sie schlicht dieses Feld an. */}
              <p className="mt-4 text-sm font-medium text-ink">Screenshot (optional)</p>
              <input
                ref={dateiRef}
                type="file"
                accept={FEEDBACK_SCREENSHOT_TYPEN.join(",")}
                className="hidden"
                aria-label="Screenshot auswählen"
                onChange={(e) => {
                  uebernehmeBild(e.target.files?.[0]);
                  // Zurücksetzen, damit dieselbe Datei ein zweites Mal
                  // ausgewählt werden kann — sonst feuert `change` nicht.
                  e.target.value = "";
                }}
              />
              <div className="mt-1 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => bildWahl.oeffnen(dateiRef.current)}
                >
                  {bild ? "Anderes Bild" : "Bild wählen"}
                </Button>
                {bild && (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm text-muted">{bild.name}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setBild(null);
                        // Mit dem Bild geht auch der gemerkte Pfad: sonst
                        // trüge die Zeile ein Objekt, das der Verfasser
                        // gerade weggenommen hat.
                        setHochgeladenerPfad(null);
                      }}
                      aria-label="Bild entfernen"
                    >
                      Entfernen
                    </Button>
                  </>
                )}
              </div>

              {error && <p className="mt-3 text-sm text-danger">{error}</p>}

              <div className="mt-5 flex justify-end gap-2">
                <Button variant="ghost" onClick={close}>
                  Abbrechen
                </Button>
                <Button onClick={submit} disabled={rating === 0 || saving}>
                  Absenden
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {/* Muss gerendert werden — im Web immer `null`, nativ die Rückfrage
          „Kamera oder Galerie". Ausserhalb des Panels, damit sie nicht
          verschwindet, während der native Dialog offen ist. */}
      {bildWahl.rueckfrage}
    </>
  );
}
