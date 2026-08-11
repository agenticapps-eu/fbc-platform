import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/ui/Logo";
import {
  leseTokenAusFragment,
  redeemActivation,
  requestActivationLink,
  type RedeemStatus,
} from "../lib/activation";
import { useAuth } from "../providers/auth-context";

/** Muss zu `minimum_password_length` (config.toml) und `MIN_PASSWORT` der Function passen. */
/** Frist bis zur Weiterleitung auf den Login. Lang genug für einen Satz, kurz
 *  genug, dass niemand auf einem Erfolgsschirm strandet (AGE-527). */
const WEITERLEITUNG_SEK = 10;

const MIN_PASSWORT = 10;

export type Zweck = "aktivierung" | "reset";

/**
 * Was beim Anfordern schiefging — die beiden Fälle schließen einander aus, und
 * genau deshalb ist es EIN Zustand und nicht zwei Wahrheitswerte: „Adresse
 * unvollständig" (der Aufruf ging nie raus) und „technisch fehlgeschlagen" (er
 * ging raus und kam nicht durch, Befund 8.2) verlangen verschiedene nächste
 * Schritte vom Mitglied.
 */
type AnfrageHinweis = "adresse" | "technisch" | null;

/**
 * Der Wortlaut je Zweck (AGE-505).
 *
 * Mechanik, Token und Einlöse-Endpunkt sind identisch — was sich unterscheidet,
 * ist die Lage des Mitglieds. Wer hier über `/passwort-neu` landet, hat seinen
 * Zugang längst bestätigt: „Zugang freischalten" wäre falsch, und „danach ist
 * dein Zugang fertig" auch. Umgekehrt hat, wer aktiviert, noch kein Passwort
 * vergessen. Zwei Texte, eine Mechanik.
 */
const TEXTE: Record<
  Zweck,
  {
    titelToken: string;
    hinweisToken: string;
    knopf: string;
    titelAnfordern: string;
    hinweisAnfordern: string;
    knopfAnfordern: string;
    used: string;
    /** Überschrift des Erfolgsschirms (AGE-527). */
    titelErfolg: string;
    /** Was danach passiert — in der Sprache der jeweiligen Lage. */
    hinweisErfolg: string;
  }
> = {
  aktivierung: {
    titelToken: "Passwort festlegen",
    hinweisToken: `Wähle ein eigenes Passwort mit mindestens ${MIN_PASSWORT} Zeichen. Danach ist dein Zugang fertig.`,
    knopf: "Zugang freischalten",
    titelAnfordern: "Bestätigungslink anfordern",
    hinweisAnfordern:
      "Gib die E-Mail-Adresse ein, unter der du im Club bekannt bist. Wir schicken dir einen neuen Link.",
    knopfAnfordern: "Neuen Link senden",
    used: "Dieses Konto ist bereits aktiviert. Du kannst dich direkt anmelden.",
    titelErfolg: "Dein Passwort ist gesetzt",
    hinweisErfolg:
      "Dein Zugang ist damit bestätigt. Melde dich jetzt einmal mit deinem neuen Passwort an — danach sind dein Profil und der Club für dich sichtbar.",
  },
  reset: {
    titelToken: "Neues Passwort setzen",
    // Die Abmeldung steht hier, BEVOR sie passiert: `revoke_sessions` läuft
    // beim Einlösen mit, und wer auf dem Telefon angemeldet war, hielte den
    // Reset sonst für kaputt.
    hinweisToken: `Wähle ein eigenes Passwort mit mindestens ${MIN_PASSWORT} Zeichen. Danach wirst du auf allen Geräten abgemeldet und meldest dich einmal neu an.`,
    knopf: "Neues Passwort setzen",
    titelAnfordern: "Passwort vergessen",
    hinweisAnfordern:
      "Gib die E-Mail-Adresse ein, unter der du im Club bekannt bist. Wir schicken dir einen Link zum Zurücksetzen.",
    knopfAnfordern: "Link senden",
    // „bereits aktiviert" wäre hier keine Auskunft, sondern eine Verwechslung:
    // das Konto IST aktiviert, darum geht es gar nicht.
    used: "Dieser Link wurde bereits verwendet. Melde dich mit deinem neuen Passwort an.",
    // Kein Wort von „aktiviert": Wer hier steht, war es längst. Er hat sein
    // Passwort zurückgesetzt, sonst nichts.
    titelErfolg: "Dein neues Passwort ist gesetzt",
    hinweisErfolg:
      "Du bist auf allen Geräten abgemeldet worden. Melde dich jetzt einmal mit dem neuen Passwort an.",
  },
};

/**
 * `/aktivierung` — Token einlösen und eigenes Passwort setzen (AGE-495 / C3).
 *
 * Läuft außerhalb der AppShell (wie `/login`) und **ohne** RequireAuth: Das
 * Token trägt die Identität, nicht die Sitzung. Genau deshalb funktioniert der
 * Link auch in einem anderen Browser — einer der sieben Fälle aus §6.
 *
 * Ohne Token im Fragment zeigt die Seite das Formular „Link anfordern". Das ist
 * der Weg für ein Mitglied, dessen verteiltes Passwort ein Dritter geändert hat:
 * Es käme sonst an der Anmeldung nicht vorbei und nie an einen neuen Link.
 */
export default function ActivationRedeemPage({ zweck = "aktivierung" }: { zweck?: Zweck } = {}) {
  const t = TEXTE[zweck];
  const navigate = useNavigate();
  const { user, isActivated, signOut } = useAuth();
  // Nur einmal lesen: `leseTokenAusFragment` räumt die Adresszeile auf, ein
  // zweiter Aufruf fände nichts mehr.
  const [token] = useState<string | null>(() => leseTokenAusFragment());

  const [passwort, setPasswort] = useState("");
  const [status, setStatus] = useState<RedeemStatus | null>(null);
  const [läuft, setLäuft] = useState(false);
  const [adresse, setAdresse] = useState("");
  const [angefordert, setAngefordert] = useState(false);
  const [hinweis, setHinweis] = useState<AnfrageHinweis>(null);
  /** Sekunden bis zur Weiterleitung auf den Login (AGE-527). */
  const [restSek, setRestSek] = useState(WEITERLEITUNG_SEK);

  // Fall 3 aus §6: Konto schon aktiviert, alter Link im Postfach. Weiterleitung
  // auf die Startseite, ausdrücklich OHNE Fehlermeldung — das Mitglied hat
  // nichts falsch gemacht.
  //
  // Nur für „aktivierung" (Befund 8.4). Beim Zurücksetzen ist aktiviert-sein die
  // VORAUSSETZUNG und nicht der Grund wegzuschicken: ein angemeldetes Mitglied
  // landete auf `/passwort-vergessen` sonst wortlos auf der Startseite. Es ist
  // dort niemand ausgesperrt — `/einstellungen` ändert das Passwort ohne
  // Re-Auth (AGE-450) —, aber eine stumme Weiterleitung ist keine Auskunft.
  //
  // Das `user &&` ist nicht dekorativ: für einen AUSGELOGGTEN Besucher ist
  // `isActivated` true (es gibt nichts zu aktivieren). Ohne die Bedingung
  // landete er auf der Startseite — und damit wäre ausgerechnet der Weg tot,
  // auf dem die ganze Konstruktion ruht: das Formular „Link anfordern" ist der
  // einzige Zugang für ein Mitglied, dessen verteiltes Passwort ein Dritter
  // geändert hat. Beim Betrachten der laufenden Oberfläche aufgefallen, nicht
  // im Test — die Fixtures hatten immer einen Nutzer.
  useEffect(() => {
    if (!token && user && isActivated === true && zweck === "aktivierung")
      navigate("/", { replace: true });
  }, [token, user, isActivated, navigate, zweck]);

  async function einlösen(e: React.FormEvent) {
    e.preventDefault();
    if (!token || läuft) return;
    if (passwort.length < MIN_PASSWORT) {
      setStatus("weak_password");
      return;
    }
    setLäuft(true);
    const ergebnis = await redeemActivation(token, passwort);
    setStatus(ergebnis);
    setLäuft(false);
    if (ergebnis === "activated") {
      // Das Passwort ist neu und alle Sitzungen sind widerrufen — auch die
      // eigene. Die Abmeldung passiert deshalb SOFORT: Bis zur Weiterleitung
      // vergehen jetzt bis zu zehn Sekunden, und eine tote Sitzung so lange
      // mitzuschleppen wäre das Gegenteil von sauber.
      //
      // Die WEITERLEITUNG wartet dagegen (AGE-527). Bis hierher sprang die
      // Seite wortlos auf den Login — und weil dabei alle Sitzungen fallen,
      // sah der Erfolg aus wie ein Rauswurf.
      await signOut();
    }
  }

  // Die Weiterleitung hängt an EINER Frist, nicht an zehn Einzelticks: Sonst
  // dauert sie so lange, wie der Zähler zum Herunterzählen braucht — plus einen
  // Render. Eine angekündigte Frist muss die angekündigte sein.
  useEffect(() => {
    if (status !== "activated") return;
    const t = setTimeout(() => navigate("/login", { replace: true }), WEITERLEITUNG_SEK * 1000);
    return () => clearTimeout(t);
  }, [status, navigate]);

  // Nur die Anzeige. Läuft sie einmal daneben, ist das eine falsche Zahl auf
  // dem Bildschirm — nicht ein Weg, der nicht stattfindet.
  useEffect(() => {
    if (status !== "activated" || restSek <= 0) return;
    const t = setTimeout(() => setRestSek((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [status, restSek]);

  async function neuenLinkAnfordern(e: React.FormEvent) {
    e.preventDefault();
    if (läuft) return;
    // Bis Review 5.4 kehrte die Prüfung hier WORTLOS um (Befund 8.7). Weil
    // `noValidate` am Formular die Browser-Prüfung abschaltet, sah ein Tippfehler
    // aus wie ein kaputter Knopf.
    if (!adresse.includes("@")) {
      setHinweis("adresse");
      return;
    }
    setLäuft(true);
    setHinweis(null);
    try {
      await requestActivationLink(adresse);
      // Erst NACH dem gelungenen Aufruf. Bis Review 5.4 stand das im `finally`
      // und lief damit auch dann, wenn die Anfrage geworfen hatte — jeder
      // technische Fehlschlag (500 bei fehlendem Secret, 502 bei DB-Fehler, 400
      // bei kaputtem Rumpf) meldete dem Mitglied Erfolg. Seit AGE-505 ist das
      // hier der einzige Rückweg eines aktivierten Kontos.
      setAngefordert(true);
    } catch {
      // Bewusst ein EIGENER Zustand und kein Text, der nach den drei fachlichen
      // Ausgängen klingt: sonst ist „hat nicht geklappt" wieder von „gibt es
      // nicht" ununterscheidbar. Der Fehler ist adressunabhängig und verrät
      // deshalb nichts über den Bestand.
      setHinweis("technisch");
    } finally {
      setLäuft(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="fbc-hero overflow-hidden rounded-[var(--radius-card)] border border-accent/25 px-6 py-8 text-center shadow-soft">
        <div className="flex justify-center">
          <Logo lockup="full" />
        </div>
      </div>

      {/* DREI Fälle, nicht zwei (AGE-527). Bis hierher wählte diese Bedingung
          nur zwischen Passwortformular und „Link anfordern" — der Erfolg fiel
          deshalb in den Anfordern-Zweig und bot dem gerade aktivierten
          Mitglied einen neuen Link an. Befund aus dem Plan-Review. */}
      {status === "activated" ? (
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
            {t.titelErfolg}
          </h1>
          <p className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
            {t.hinweisErfolg}
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => navigate("/login", { replace: true })}
          >
            Zur Anmeldung
          </Button>
          {/* Angekündigt, damit die Weiterleitung kein Sprung ist. */}
          <p className="text-sm text-muted">
            Wir bringen dich in {restSek} Sekunden von selbst dorthin.
          </p>
        </div>
      ) : token ? (
        <>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              {t.titelToken}
            </h1>
            <p className="mt-2 text-sm text-muted">{t.hinweisToken}</p>
          </div>

          <form onSubmit={einlösen} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1">
              <label htmlFor="passwort" className="text-sm font-medium text-ink">
                Neues Passwort
              </label>
              <input
                id="passwort"
                type="password"
                autoComplete="new-password"
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
                className="h-11 rounded-md border border-line bg-canvas px-3 text-sm text-ink transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              {status === "weak_password" && (
                <p className="text-sm text-danger">
                  Das Passwort braucht mindestens {MIN_PASSWORT} Zeichen.
                </p>
              )}
            </div>

            <StatusMeldung status={status} zweck={zweck} />

            <Button type="submit" variant="primary" disabled={läuft}>
              {t.knopf}
            </Button>
          </form>

          {/* Für „abgelaufen", „überholt" und „unbekannt" braucht es einen Weg
              nach vorn, nicht nur eine Meldung. */}
          {(status === "expired" ||
            status === "superseded" ||
            status === "not_found" ||
            status === "retry_needed" ||
            status === "throttled") && (
            <LinkAnfordern
              adresse={adresse}
              setAdresse={setAdresse}
              angefordert={angefordert}
              hinweis={hinweis}
              läuft={läuft}
              onSubmit={neuenLinkAnfordern}
              knopf={t.knopfAnfordern}
            />
          )}
        </>
      ) : (
        <>
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
              {t.titelAnfordern}
            </h1>
            <p className="mt-2 text-sm text-muted">{t.hinweisAnfordern}</p>
          </div>
          <LinkAnfordern
            adresse={adresse}
            setAdresse={setAdresse}
            angefordert={angefordert}
            hinweis={hinweis}
            läuft={läuft}
            onSubmit={neuenLinkAnfordern}
            knopf={t.knopfAnfordern}
          />
        </>
      )}

      {/* Auf dem Erfolgsschirm nicht: dort führt schon der Knopf dorthin, und
          zweimal dieselbe Handlung untereinander liest sich wie zwei
          verschiedene (gesehen in der Sichtprobe am 2026-08-11). */}
      {status !== "activated" && (
        <Link to="/login" className="mt-2 block text-sm text-muted hover:underline">
          ← Zur Anmeldung
        </Link>
      )}
    </main>
  );
}

/**
 * Je Fall eine eigene Meldung — AGE-495 §6 verlangt das ausdrücklich.
 *
 * Wichtig ist die Trennung von `used` und `superseded`: „schon benutzt" heißt,
 * das Konto IST aktiviert. „überholt" heißt, ein neuerer Link wurde angefordert
 * und dieser gilt nicht mehr — das Konto ist dann gerade NICHT aktiviert. Mit
 * einer gemeinsamen Meldung bekäme, wer zweimal anfordert und den ersten Link
 * klickt, eine schlicht falsche Auskunft.
 */
function StatusMeldung({ status, zweck }: { status: RedeemStatus | null; zweck: Zweck }) {
  if (!status || status === "weak_password" || status === "activated") return null;

  const texte: Record<Exclude<RedeemStatus, "weak_password" | "activated">, string> = {
    expired: "Dieser Link ist abgelaufen — er gilt 72 Stunden. Fordere unten einen neuen an.",
    used: TEXTE[zweck].used,
    superseded:
      "Dieser Link ist nicht mehr gültig, weil danach ein neuer angefordert wurde. " +
      "Nimm den neuesten Link aus deinem Postfach — oder fordere unten einen an.",
    not_found: "Dieser Link ist nicht mehr gültig. Fordere unten einen neuen an.",
    retry_needed:
      "Da ist etwas dazwischengekommen. Dein Passwort wurde möglicherweise schon gesetzt — " +
      "fordere bitte einen neuen Link an und versuch es noch einmal.",
    throttled:
      "Von deinem Anschluss kamen zu viele ungültige Versuche. Fordere unten einen neuen " +
      "Link an — ein gültiger Link greift sofort, auch jetzt.",
    error: "Das hat gerade nicht geklappt. Bitte versuche es noch einmal.",
  };

  return (
    <div className="rounded-md border border-line bg-canvas p-3 text-sm text-ink">
      <p>{texte[status]}</p>
      {status === "used" && (
        <Link to="/login" className="mt-2 inline-block text-accent-strong hover:underline">
          Jetzt anmelden
        </Link>
      )}
    </div>
  );
}

function LinkAnfordern({
  adresse,
  setAdresse,
  angefordert,
  hinweis,
  läuft,
  onSubmit,
  knopf,
}: {
  adresse: string;
  setAdresse: (v: string) => void;
  angefordert: boolean;
  hinweis: AnfrageHinweis;
  läuft: boolean;
  onSubmit: (e: React.FormEvent) => void;
  knopf: string;
}) {
  if (angefordert) {
    // Diese eine Meldung steht für DREI Ausgänge: Link ausgegeben,
    // Schutzfenster (offener Link unter 24 h — es geht nichts raus) und
    // unbekannte Adresse. Unterscheiden darf sie sie nicht, das wäre die
    // Adressaufzählung. Also muss sie alle drei abdecken.
    return (
      <p className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
        Wenn es zu dieser Adresse ein Konto gibt, ist der Link unterwegs. Er gilt 72 Stunden; schau
        bitte auch im Spam-Ordner nach — Absender ist <strong>noreply@effbeezee.com</strong>. Wurde
        in den letzten 24 Stunden schon ein Link angefordert, gilt weiter der aus jener Mail. Kommt
        gar nichts an, schreib uns an <strong>info@fairbusinessclub.de</strong>.
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      {/* Der technische Fehlschlag, ausdrücklich getrennt von den drei
          fachlichen Ausgängen oben (Befund 8.2). Er sagt nichts über den
          Adressbestand — er tritt unabhängig davon auf —, und das Formular
          bleibt stehen, damit ein zweiter Versuch möglich ist. */}
      {hinweis && (
        <p className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {hinweis === "adresse" ? (
            <>Bitte gib eine vollständige E-Mail-Adresse ein — mit @ und Domain.</>
          ) : (
            <>
              Die Anfrage konnte gerade nicht gestellt werden. Bitte versuch es in einer Minute noch
              einmal — oder schreib uns an <strong>info@fairbusinessclub.de</strong>.
            </>
          )}
        </p>
      )}
      <label htmlFor="adresse" className="text-sm font-medium text-ink">
        E-Mail-Adresse
      </label>
      <input
        id="adresse"
        type="email"
        autoComplete="email"
        value={adresse}
        onChange={(e) => setAdresse(e.target.value)}
        className="h-11 rounded-md border border-line bg-canvas px-3 text-sm text-ink transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      <Button type="submit" variant="secondary" disabled={läuft}>
        {knopf}
      </Button>
    </form>
  );
}
