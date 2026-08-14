import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AvatarCropper } from "../components/profile/AvatarCropper";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Logo } from "../components/ui/Logo";
import { cn } from "../lib/cn";
import {
  fetchOnboardingFreetext,
  fetchOnboardingProfile,
  onboardingFreetextQueryKey,
  onboardingProfileQueryKey,
  saveOnboardingAvatarUrl,
  saveOnboardingHeadline,
  saveOnboardingRegion,
  type OnboardingFreetext,
  type OnboardingProfile,
} from "../lib/member-onboarding";
import {
  markOnboarded,
  memberOnboardingQueryKey,
  vertageOnboarding,
} from "../lib/member-settings";
import {
  categoryOptionsForSide,
  fetchCategorySelection,
  profileCategoriesQueryKey,
  saveCategorySelection,
  type CategorySelection,
} from "../lib/profile-categories";
import { profileEditorQueryKey, uploadBild } from "../lib/profile";
import { useAuth } from "../providers/auth-context";

/**
 * Willkommensstrecke (`/willkommen`, AGE-538 / C11).
 *
 * Der Empfang nach der ersten Anmeldung: drei kurze Schritte, eine
 * Nutzenerklärung vorweg und ZWEI Auswege auf jedem Schritt. Sie hängt an der
 * Startseiten-Weiche (`HomeRedirect`) und ist ausdrücklich keine Wand — jede
 * andere Route bleibt erreichbar, auch ohne gesetzten Merker.
 *
 * **Was diese Strecke nicht tut, und warum.**
 *
 * Sie ruft `saveProfile` NICHT auf. Der Weg des Profil-Editors schreibt alle
 * Profilspalten, upsertet die Kontaktzeile bedingungslos und ersetzt Interessen
 * und Ziele vollständig; aus einem Ein-Feld-Schritt heraus räumte er Daten weg,
 * nach denen niemand gefragt hat. Geschrieben wird deshalb feldbezogen über
 * `lib/member-onboarding.ts`.
 *
 * Sie legt sich NICHT als Overlay über etwas. `/willkommen` liegt außerhalb der
 * `AppShell` wie `/login`: es gibt keine Seite dahinter, die scrollen könnte,
 * und keinen Fokus, der entweichen kann. Kein `useOverlay`, kein Portal, kein
 * Scroll-Lock — der einzige Portal-Inhalt ist der Bildzuschnitt, der sein
 * Overlay selbst mitbringt.
 *
 * Sie belebt den Mini-Compass-Assistenten NICHT wieder. Der bleibt unter
 * `/onboarding`, wo C2 ihn gelassen hat.
 */

type SchrittId = "beruf" | "kategorien" | "profil";

export default function WillkommenPage() {
  const { user } = useAuth();
  // Die Route liegt hinter RequireAuth — user ist hier vorhanden.
  if (!user) return null;
  return <Laden uid={user.id} />;
}

/**
 * Lädt, was die Strecke vorbelegt, und montiert sie erst danach.
 *
 * Das ist kein Ladekomfort, sondern der Grund, warum die Vorbelegung überhaupt
 * ankommt: `useState(wert)` übernimmt einen Wert, der erst NACH dem Mount
 * eintrifft, nie. Ein Formular, das schon während des Ladens steht, bliebe
 * dauerhaft leer — und ein Test, der die Daten vorbelegt, sähe das nie.
 */
function Laden({ uid }: { uid: string }) {
  const profil = useQuery({
    queryKey: onboardingProfileQueryKey(uid),
    queryFn: () => fetchOnboardingProfile(uid),
    staleTime: Infinity,
  });
  const auswahl = useQuery({
    queryKey: profileCategoriesQueryKey(uid),
    queryFn: () => fetchCategorySelection(uid),
    staleTime: Infinity,
  });
  const freitext = useQuery({
    queryKey: onboardingFreetextQueryKey(uid),
    queryFn: () => fetchOnboardingFreetext(uid),
    staleTime: Infinity,
  });

  if (profil.isError || auswahl.isError || freitext.isError) {
    return (
      <Rahmen>
        <h1 className="font-display text-2xl font-semibold text-on-chrome">
          Das hat gerade nicht geklappt
        </h1>
        <p className="mt-3 text-sm text-on-chrome-muted">
          Deine Angaben konnten nicht geladen werden. Das liegt an der Verbindung, nicht an deinem
          Konto — du kannst alles auch jederzeit in deinem Profil ergänzen.
        </p>
        <div className="mt-8">
          <Button variant="primary" onClick={() => window.location.assign("/")}>
            Zur Startseite
          </Button>
        </div>
      </Rahmen>
    );
  }

  if (!profil.data || !auswahl.data || !freitext.data) {
    return (
      <Rahmen>
        <p className="text-sm text-on-chrome-muted">Einen Moment …</p>
      </Rahmen>
    );
  }

  return (
    <Strecke uid={uid} profil={profil.data} vorhanden={auswahl.data} freitext={freitext.data} />
  );
}

/** Die Schritte, die dieses Mitglied tatsächlich durchläuft.
 *
 *  Schritt 3 entfällt, wenn Profilbild UND Standort schon stehen — dann nennt
 *  der Fortschritt zwei Schritte und nicht drei. Die Schritte 1 und 2 bleiben
 *  auch mit vorhandenen Angaben: Schritt 1 fragt dann bestätigend statt fragend,
 *  und Schritt 2 ist additiv, es gibt dort also nie „schon fertig". */
function schritteFuer(profil: OnboardingProfile): SchrittId[] {
  const schritte: SchrittId[] = ["beruf", "kategorien"];
  if (!profil.avatar_url || profil.region.trim() === "") schritte.push("profil");
  return schritte;
}

/** Der erste Schritt, dem etwas fehlt.
 *
 *  Bewusst aus den DATEN abgeleitet und nicht aus gespeichertem Fortschritt: aus
 *  den Daten ist nicht ableitbar, ob jemand einen Schritt bewusst leer
 *  weitergeklickt oder nie gesehen hat. Wer leer weitergeht, sieht den Schritt
 *  beim nächsten Mal wieder — das ist der Preis dafür, keinen zweiten Zustand zu
 *  führen, und mit „Überspringen" daneben tragbar. */
function ersterOffenerSchritt(
  schritte: SchrittId[],
  profil: OnboardingProfile,
  vorhanden: CategorySelection,
): number {
  const offen: Record<SchrittId, boolean> = {
    beruf: profil.headline.trim() === "",
    kategorien: vorhanden.offers.length === 0 && vorhanden.needs.length === 0,
    profil: !profil.avatar_url || profil.region.trim() === "",
  };
  const index = schritte.findIndex((s) => offen[s]);
  return index === -1 ? 0 : index;
}

function fehlertext(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unbekannter Fehler.";
}

function Strecke({
  uid,
  profil,
  vorhanden,
  freitext,
}: {
  uid: string;
  profil: OnboardingProfile;
  vorhanden: CategorySelection;
  freitext: OnboardingFreetext;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const schritte = useMemo(() => schritteFuer(profil), [profil]);
  const [index, setIndex] = useState(() => ersterOffenerSchritt(schritte, profil, vorhanden));
  const [headline, setHeadline] = useState(profil.headline);
  const [region, setRegion] = useState(profil.region);
  const [neueOffers, setNeueOffers] = useState<string[]>([]);
  const [neueNeeds, setNeueNeeds] = useState<string[]>([]);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [vorschau, setVorschau] = useState<string | null>(null);
  const [zuschnitt, setZuschnitt] = useState<File | null>(null);
  const [hinweisOffen, setHinweisOffen] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const schritt = schritte[index];
  const istLetzter = index === schritte.length - 1;

  /** Schreibt AUSSCHLIESSLICH die Felder dieses Schritts. */
  async function schrittSchreiben(id: SchrittId) {
    if (id === "beruf") {
      const wert = headline.trim();
      if (wert !== profil.headline) await saveOnboardingHeadline(uid, wert);
      return;
    }
    if (id === "kategorien") {
      if (neueOffers.length === 0 && neueNeeds.length === 0) return;
      // Rein additiv: die vorhandenen Kategorien stehen mit in der Auswahl,
      // deshalb löscht der Abgleich nichts und `ConfirmationRequiredError` kann
      // hier nicht entstehen.
      await saveCategorySelection(uid, {
        offers: [...vorhanden.offers, ...neueOffers],
        needs: [...vorhanden.needs, ...neueNeeds],
      });
      return;
    }
    if (avatarBlob) {
      const url = await uploadBild("avatars", uid, avatarBlob, profil.avatar_url);
      if (url) await saveOnboardingAvatarUrl(uid, url);
    }
    const wert = region.trim();
    if (wert !== profil.region) await saveOnboardingRegion(uid, wert);
  }

  /** Setzt den Merker und geht zur Startseite.
   *
   *  `setQueryData` vor dem Navigieren, nicht `invalidateQueries`: der gelesene
   *  Zustand muss NACHGEZOGEN sein, bevor die Weiche auf `/` ihn liest. Ein
   *  Neuladen im Hintergrund käme zu spät, und die Startseite schickte das
   *  Mitglied in die Strecke zurück, die es gerade beendet hat. */
  async function beenden() {
    const wann = await markOnboarded(uid);
    queryClient.setQueryData(memberOnboardingQueryKey(uid), wann);
    zurueckZurStartseite();
  }

  function zurueckZurStartseite() {
    // Was die Strecke geschrieben hat, liegt in den Caches des Profils noch alt.
    queryClient.invalidateQueries({ queryKey: profileEditorQueryKey(uid) });
    queryClient.invalidateQueries({ queryKey: profileCategoriesQueryKey(uid) });
    navigate("/", { replace: true });
  }

  async function ausfuehren(was: () => Promise<void>) {
    setSpeichert(true);
    setFehler(null);
    try {
      await was();
    } catch (error) {
      setFehler(fehlertext(error));
    } finally {
      setSpeichert(false);
    }
  }

  const weiter = () =>
    ausfuehren(async () => {
      await schrittSchreiben(schritt);
      if (istLetzter) await beenden();
      else setIndex((i) => i + 1);
    });

  /** „Später": vertagt. Setzt den Merker NICHT — die Strecke kommt beim nächsten
   *  Start wieder. Bereits geschriebene Angaben bleiben, es wird nichts
   *  verworfen. */
  function spaeter() {
    vertageOnboarding(uid);
    zurueckZurStartseite();
  }

  /** „Überspringen": endgültig. Der Hinweis steht davor, nicht danach. */
  const ueberspringen = () => ausfuehren(beenden);

  if (hinweisOffen) {
    return (
      <Rahmen>
        <h1 className="font-display text-3xl font-semibold leading-tight text-on-chrome">
          Einen Moment noch
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-on-chrome-muted">
          Ohne Kategorien findet dich der Kompass-Filter im Verzeichnis nicht — und das ist der Weg,
          auf dem die anderen Mitglieder gezielt nach dem suchen, was du anbietest. Es dauert eine
          Minute, und du kannst es jederzeit in deinem Profil nachholen.
        </p>
        {fehler && <p className="mt-6 text-sm text-danger">{fehler}</p>}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => setHinweisOffen(false)}>
            Doch ausfüllen
          </Button>
          <button
            type="button"
            onClick={ueberspringen}
            disabled={speichert}
            className="rounded-md px-3 py-2 text-sm font-medium text-on-chrome-muted transition-colors hover:text-on-chrome disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {speichert ? "Einen Moment …" : "Trotzdem überspringen"}
          </button>
        </div>
      </Rahmen>
    );
  }

  return (
    <Rahmen>
      <div className="flex items-center justify-between text-xs text-on-chrome-muted">
        <span>
          Schritt {index + 1} von {schritte.length}
        </span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-chrome-elevated">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${((index + 1) / schritte.length) * 100}%` }}
        />
      </div>

      {/* Die Nutzenerklärung steht VOR der ersten Frage — und spricht davon, was
          das Mitglied davon hat, nicht der Club. */}
      {index === 0 && (
        <div className="mt-10">
          <h1 className="font-display text-3xl font-semibold leading-tight text-on-chrome sm:text-4xl">
            Schön, dass du da bist
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-on-chrome-muted">
            Zwei Minuten, und die anderen Mitglieder finden dich: über die Suche im Verzeichnis und
            über den Kompass-Filter, mit dem sie gezielt nach dem suchen, was du anbietest. Jeden
            Schritt kannst du überspringen und später in deinem Profil ergänzen.
          </p>
        </div>
      )}

      <div className="mt-10">
        {schritt === "beruf" && (
          <BerufSchritt wert={headline} hatte={profil.headline !== ""} onChange={setHeadline} />
        )}
        {schritt === "kategorien" && (
          <KategorienSchritt
            vorhanden={vorhanden}
            freitext={freitext}
            neueOffers={neueOffers}
            neueNeeds={neueNeeds}
            onToggle={(seite, value) => {
              const [liste, setzen] =
                seite === "offer"
                  ? ([neueOffers, setNeueOffers] as const)
                  : ([neueNeeds, setNeueNeeds] as const);
              setzen(
                liste.includes(value) ? liste.filter((v) => v !== value) : [...liste, value],
              );
            }}
          />
        )}
        {schritt === "profil" && (
          <ProfilSchritt
            profil={profil}
            region={region}
            vorschau={vorschau}
            onRegion={setRegion}
            onDatei={setZuschnitt}
          />
        )}
      </div>

      {fehler && <p className="mt-8 text-sm text-danger">{fehler}</p>}

      <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button variant="primary" onClick={weiter} disabled={speichert}>
          {speichert ? "Wird gespeichert …" : istLetzter ? "Fertig" : "Weiter"}
        </Button>
        <button
          type="button"
          onClick={spaeter}
          disabled={speichert}
          className="rounded-md px-3 py-2 text-sm font-medium text-on-chrome-muted transition-colors hover:text-on-chrome disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Später
        </button>
        <button
          type="button"
          onClick={() => setHinweisOffen(true)}
          disabled={speichert}
          className="rounded-md px-3 py-2 text-sm font-medium text-on-chrome-muted transition-colors hover:text-on-chrome disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Überspringen
        </button>
      </div>

      {zuschnitt && (
        <AvatarCropper
          file={zuschnitt}
          aspect={1}
          outWidth={512}
          label="Profilbild zuschneiden"
          onCancel={() => setZuschnitt(null)}
          onConfirm={(blob, url) => {
            setAvatarBlob(blob);
            if (vorschau) URL.revokeObjectURL(vorschau);
            setVorschau(url);
            setZuschnitt(null);
          }}
        />
      )}
    </Rahmen>
  );
}

/** Eine Seite, keine Schicht — dieselbe Vollbild-Anmutung wie `/onboarding`. */
function Rahmen({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-chrome text-on-chrome">
      <header className="flex items-center px-6 py-5 sm:px-10">
        <Logo />
      </header>
      <div className="flex flex-1 items-start px-6 py-6 sm:px-10 sm:py-10">
        <div className="mx-auto w-full max-w-2xl">{children}</div>
      </div>
    </main>
  );
}

function BerufSchritt({
  wert,
  hatte,
  onChange,
}: {
  wert: string;
  hatte: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-on-chrome">
        {hatte ? "Stimmt das noch?" : "Was machst du beruflich?"}
      </h2>
      <p className="mt-3 text-sm text-on-chrome-muted">
        Eine Zeile, die im Verzeichnis unter deinem Namen steht.
      </p>
      <label className="mt-6 block">
        <span className="text-sm font-medium text-on-chrome">Berufsbezeichnung</span>
        <Input
          className="mt-2"
          value={wert}
          onChange={(e) => onChange(e.target.value)}
          placeholder="z. B. Steuerberaterin"
        />
      </label>
    </div>
  );
}

function KategorienSchritt({
  vorhanden,
  freitext,
  neueOffers,
  neueNeeds,
  onToggle,
}: {
  vorhanden: CategorySelection;
  freitext: OnboardingFreetext;
  neueOffers: string[];
  neueNeeds: string[];
  onToggle: (seite: "offer" | "need", value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-10">
      <h2 className="font-display text-2xl font-semibold text-on-chrome">
        Was bietest du — und was suchst du?
      </h2>
      <Chipreihe
        titel="Ich biete"
        optionen={categoryOptionsForSide("offer")}
        gesetzt={vorhanden.offers}
        gewaehlt={neueOffers}
        texte={freitext.offers}
        onToggle={(v) => onToggle("offer", v)}
      />
      <Chipreihe
        titel="Ich suche"
        optionen={categoryOptionsForSide("need")}
        gesetzt={vorhanden.needs}
        gewaehlt={neueNeeds}
        texte={freitext.needs}
        onToggle={(v) => onToggle("need", v)}
      />
    </div>
  );
}

/**
 * Eine Seite der Kompass-Kategorien.
 *
 * Ein Chip für eine BEREITS GESETZTE Kategorie ist als gesetzt zu sehen und
 * nicht bedienbar. Das ist keine Zurückhaltung, sondern die Bedingung dafür,
 * dass diese Oberfläche additiv bleibt: `planReconciliation` löscht beim
 * Abwählen ALLE eigenen Zeilen dieser Kategorie — samt Beschreibung, Tags und
 * Volumenband, die im reichen Editor entstanden sind. Das Abwählen bleibt dort,
 * wo die Rückfrage dafür steht.
 */
function Chipreihe({
  titel,
  optionen,
  gesetzt,
  gewaehlt,
  texte,
  onToggle,
}: {
  titel: string;
  optionen: { value: string; label: string }[];
  gesetzt: string[];
  gewaehlt: string[];
  texte: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">{titel}</h3>
      {/* Fehlt der Freitext, erscheint nichts an seiner Stelle — kein leerer
          Platzhalter. */}
      {texte.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1">
          {texte.map((t) => (
            <li key={t} className="text-sm leading-relaxed text-on-chrome-muted">
              {t}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {optionen.map((opt) => {
          const istGesetzt = gesetzt.includes(opt.value);
          const istGewaehlt = gewaehlt.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={istGesetzt || istGewaehlt}
              aria-disabled={istGesetzt || undefined}
              title={istGesetzt ? "Steht schon in deinem Profil" : undefined}
              onClick={istGesetzt ? undefined : () => onToggle(opt.value)}
              className={cn(
                "rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                istGesetzt
                  ? "cursor-default border-accent/40 bg-accent/20 text-on-chrome"
                  : istGewaehlt
                    ? "border-accent bg-accent text-chrome"
                    : "border-chrome-border text-on-chrome hover:border-accent",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Nur das LEERE Feld erscheint. Ist eines schon gesetzt, fehlt es hier —
 *  Schritt 3 fragt nach dem, was fehlt, nicht nach dem, was steht. */
function ProfilSchritt({
  profil,
  region,
  vorschau,
  onRegion,
  onDatei,
}: {
  profil: OnboardingProfile;
  region: string;
  vorschau: string | null;
  onRegion: (v: string) => void;
  onDatei: (f: File) => void;
}) {
  return (
    <div className="flex flex-col gap-8">
      <h2 className="font-display text-2xl font-semibold text-on-chrome">Fast geschafft</h2>
      {!profil.avatar_url && (
        <div>
          <span className="text-sm font-medium text-on-chrome">Profilbild</span>
          <p className="mt-1 text-sm text-on-chrome-muted">
            Ein Gesicht bleibt eher hängen als ein Platzhalter.
          </p>
          <div className="mt-3 flex items-center gap-4">
            {vorschau && (
              <img src={vorschau} alt="" className="h-16 w-16 rounded-full object-cover" />
            )}
            <input
              type="file"
              accept="image/*"
              aria-label="Profilbild auswählen"
              onChange={(e) => {
                const datei = e.target.files?.[0];
                if (datei) onDatei(datei);
              }}
              className="text-sm text-on-chrome-muted"
            />
          </div>
        </div>
      )}
      {profil.region.trim() === "" && (
        <label className="block">
          <span className="text-sm font-medium text-on-chrome">FBC Standort</span>
          <p className="mt-1 text-sm text-on-chrome-muted">
            Deine Regionalgruppe — sie hilft den anderen, dich in der Nähe zu finden.
          </p>
          <Input
            className="mt-3"
            value={region}
            onChange={(e) => onRegion(e.target.value)}
            placeholder="z. B. München"
          />
        </label>
      )}
    </div>
  );
}
