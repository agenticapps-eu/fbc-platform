import { useCallback, useEffect, useState } from "react";

/**
 * Die offenen Chatfenster (AGE-639) — Zustand, Grenze und Gedächtnis.
 *
 * Er liegt in der **Hülle**, nicht in einem Context und nicht in einem Store:
 * `AppShell` wird beim Navigieren nicht abgebaut, und genau das ist die Zusage
 * „das Fenster überlebt den Seitenwechsel". Dort ist sie eine Eigenschaft der
 * Montage statt einer Verabredung zwischen zwei Komponenten.
 */

/** Wieviele Fenster nebeneinander stehen können.
 *
 *  Die Zahl ist gerechnet, nicht gewählt. Die Reihe steht zwischen beiden
 *  Leisten; bei 1280 px — der schmalsten Breite, ab der es Fenster überhaupt
 *  gibt — bleiben mit aufgeklappter Navigation (16 rem) und aufgeklappter
 *  Nachrichten-Leiste (18 rem) noch `80 − 16 − 18 − 2 = 44 rem`. Vier Fenster
 *  bräuchten dort 73,5 rem und passen nicht, **auch minimiert nicht**:
 *  Minimieren spart Höhe, nicht Breite.
 *
 *  Die erste Fassung dieser Rechnung liess die linke Leiste weg und kam auf
 *  60 rem. Beide Plan-Reviewer haben das unabhängig voneinander gefunden. */
export const MAX_FENSTER = 3;

/** Höhe der Fensterreihe, damit die Toasts ihr ausweichen können. Muss zu den
 *  Klassen in `ChatFenster` passen (`h-11` bzw. `h-[26rem]`).
 *
 *  Steht hier und nicht in der Reihe: sie ist eine Aussage über den ZUSTAND, und
 *  eine Nicht-Komponente aus einer Komponentendatei zu exportieren bricht
 *  ausserdem Fast Refresh. */
export function reihenHoehe(fenster: Pick<Chatfenster, "minimiert">[]): string {
  if (fenster.length === 0) return "0rem";
  return fenster.some((f) => !f.minimiert) ? "26rem" : "2.75rem";
}

/** Was ein Fenster von seinem Gegenüber braucht: Name und Bild für die
 *  Titelzeile. Mehr nicht — den Verlauf holt es über die Thread-Kennung. */
export interface FensterPartner {
  name: string;
  avatarUrl: string | null;
}

export interface Chatfenster extends FensterPartner {
  threadId: string;
  minimiert: boolean;
  /** Wann dieses Fenster zuletzt benutzt wurde — als monotone ZÄHLNUMMER, nicht
   *  als Zeitstempel. Es beantwortet genau eine Frage („welches ist am längsten
   *  unberührt?"), und die beantwortet eine Zählnummer ohne Uhr. */
  beruehrtAm: number;
}

export interface ChatfensterStand {
  /** In der Reihenfolge des ÖFFNENS, also links nach rechts. Sie ordnet sich
   *  beim Benutzen NICHT um: ein Fenster, das unter der Hand zur Seite springt,
   *  weil man hineingeklickt hat, verschöbe die Sendezeile unter dem Zeiger. */
  fenster: Chatfenster[];
  /** Nimmt den Thread, nicht nur seine Kennung: die Titelzeile braucht Namen und
   *  Bild, und nach einem Neuladen steht der Thread womöglich nicht in der
   *  geladenen Unterhaltungsliste — sie trägt eine Seite von zwanzig. Ein
   *  Fenster, das seinen Partner nicht benennen kann, wäre entweder namenlos
   *  oder verlangte eine zweite Abfrage für einen Datensatz, den es beim Öffnen
   *  in der Hand hatte. */
  oeffne: (thread: { id: string; partner: FensterPartner }) => void;
  minimiere: (threadId: string) => void;
  ziehAuf: (threadId: string) => void;
  schliesse: (threadId: string) => void;
  /** „Hier wird gearbeitet." Zeiger- oder Fokuskontakt im Fenster, und das
   *  Senden. Ohne das könnte ausgerechnet das Fenster geräumt werden, in dem
   *  gerade jemand schreibt — beide Plan-Reviewer haben darauf gezeigt. */
  beruehre: (threadId: string) => void;
}

/** Ein Schlüssel **je Konto**, anders als `fbc.chatCollapsed`.
 *
 *  Der Unterschied ist kein Schönheitsfehler: `chatCollapsed` trägt ein Ja/Nein
 *  über einen Arbeitsplatz, das ein zweites Konto am selben Rechner erben darf.
 *  Eine Liste von Thread-Kennungen darf das nicht — meldet sich A ab und B am
 *  selben Browser an, versuchte B, **As Gespräche** wiederherzustellen.
 *  Nachrichten sähe er keine (die RLS lässt keine Zeile durch), aber die ANZAHL
 *  von As Gesprächen und drei unerklärliche Fehlermeldungen. */
const schluessel = (uid: string) => `fbc.chatFenster.${uid}`;

/** Was im Speicher steht. Ohne `beruehrtAm`: eine Zählnummer bedeutet nur
 *  innerhalb einer Sitzung etwas, und die Reihenfolge im Feld IST die
 *  Reihenfolge der Reihe.
 *
 *  Der Name wandert mit, damit ein wiederhergestelltes Fenster seine Titelzeile
 *  füllen kann, ohne dafür die Unterhaltungsliste zu holen. Er kann veralten —
 *  benennt sich jemand um, steht der alte Name bis zum nächsten Öffnen da. Das
 *  ist der Preis, und er ist kleiner als eine Abfrage beim Start oder ein
 *  namenloses Fenster. */
type Gespeichert = { id: string; min: boolean; name?: string; avatar?: string | null };

function lies(uid: string): Chatfenster[] {
  try {
    const roh = localStorage.getItem(schluessel(uid));
    if (!roh) return [];
    const daten: unknown = JSON.parse(roh);
    if (!Array.isArray(daten)) return [];
    const eintraege = daten.filter(
      (e): e is Gespeichert =>
        typeof e === "object" && e !== null && typeof (e as Gespeichert).id === "string",
    );
    // Nach Kennung entdoppelt, der letzte Eintrag gewinnt (Diff-Review,
    // opencode, LOW). Nur dieser Hook schreibt hier — aber ein von Hand oder
    // durch einen Fehler doppelt gespeicherter Eintrag ergäbe zwei Fenster mit
    // demselben React-`key` und zwei Sendezeilen auf denselben Verlauf: genau
    // der Zustand, den `oeffne` aktiv verhindert. Ein Speicher, der ihn über
    // die Hintertür herstellt, wäre die Ausnahme von einer Regel.
    const jeId = new Map(eintraege.map((e) => [e.id, e]));
    return (
      [...jeId.values()]
        // Gekappt, auch wenn nur dieser Hook je schreibt: ein von Hand gefüllter
        // Speicher darf die Reihe nicht sprengen.
        .slice(-MAX_FENSTER)
        .map((e, i) => ({
          threadId: e.id,
          minimiert: Boolean(e.min),
          // Dasselbe Ersatzwort, das `mapThreadRow` benutzt, wenn ein Profil
          // fehlt (`chat.ts:80`). Ein Fenster ohne Beschriftung wäre schlimmer.
          name: typeof e.name === "string" ? e.name : "Mitglied",
          avatarUrl: typeof e.avatar === "string" ? e.avatar : null,
          beruehrtAm: i,
        }))
    );
  } catch {
    // Privater Modus o. Ä. — die Fenster funktionieren, sie merken sich nur nichts.
    return [];
  }
}

export function useChatfenster(uid: string | null): ChatfensterStand {
  const [fenster, setFenster] = useState<Chatfenster[]>(() => (uid ? lies(uid) : []));

  // Die nächste Zählnummer wird aus dem VORHERIGEN Zustand abgeleitet, nicht
  // aus einer Ref hochgezählt.
  //
  // Die erste Fassung schrieb `naechste.current++` im Updater von `setFenster`.
  // Das ist ein Nebeneffekt in einer Funktion, die rein sein muss: React ruft
  // Updater im StrictMode doppelt auf und darf einen Anstrich verwerfen. Hier
  // blieb die Folge zwar harmlos (übersprungene Nummern schaden nicht), aber es
  // war genau das Muster, das dieselbe Datei elf Zeilen weiter unten ablehnt.
  // Gefunden hat es die Diff-Review (opencode, MEDIUM).
  //
  // Aus dem Zustand abgeleitet ist es zugleich weniger: die Ref entfällt.
  const naechsteNummer = (vorher: Chatfenster[]) =>
    vorher.reduce((m, f) => Math.max(m, f.beruehrtAm), MAX_FENSTER - 1) + 1;

  // Der Kontowechsel innerhalb einer laufenden Sitzung — abmelden, anmelden,
  // ohne Neuladen. Ohne ihn behielte die Hülle die Fenster des vorigen Kontos,
  // und der Schlüssel im Speicher hülfe nichts.
  //
  // WÄHREND des Renderns, nicht in einem Effect. Das ist Reacts eigener Weg,
  // Zustand auf einen geänderten Wert zurückzusetzen, und er ist hier der
  // richtige: in einem Effect stünden die Fenster des vorigen Kontos für einen
  // Anstrich lang noch da. Die ESLint-Regel `set-state-in-effect` hat auf die
  // erste Fassung gezeigt.
  const [letzteUid, setLetzteUid] = useState(uid);
  if (uid !== letzteUid) {
    setLetzteUid(uid);
    setFenster(uid ? lies(uid) : []);
  }

  useEffect(() => {
    if (!uid) return;
    try {
      const daten: Gespeichert[] = fenster.map((f) => ({
        id: f.threadId,
        min: f.minimiert,
        name: f.name,
        avatar: f.avatarUrl,
      }));
      localStorage.setItem(schluessel(uid), JSON.stringify(daten));
    } catch {
      // Wie oben: es merkt sich nur nichts.
    }
  }, [fenster, uid]);

  const oeffne = useCallback((thread: { id: string; partner: FensterPartner }) => {
    const threadId = thread.id;
    setFenster((vorher) => {
      const nummer = naechsteNummer(vorher);
      const schon = vorher.find((f) => f.threadId === threadId);
      // Ein bereits offenes Gespräch bekommt kein zweites Fenster: es wird
      // aufgezogen und berührt. Zwei Fenster auf denselben Verlauf wären zwei
      // Sendezeilen ohne Anhaltspunkt, in welche man zuletzt geschrieben hat.
      //
      // Name und Bild werden dabei AUFGEFRISCHT: der gespeicherte Wert kann
      // veraltet sein, der eben angeklickte kommt aus der Liste.
      if (schon) {
        return vorher.map((f) =>
          f.threadId === threadId
            ? { ...f, ...thread.partner, minimiert: false, beruehrtAm: nummer }
            : f,
        );
      }
      const neu: Chatfenster = {
        threadId,
        ...thread.partner,
        minimiert: false,
        beruehrtAm: nummer,
      };
      if (vorher.length < MAX_FENSTER) return [...vorher, neu];
      // Geräumt wird das am längsten UNBERÜHRTE, nicht das zuerst geöffnete.
      // Das Gespräch ist damit nicht verloren: es steht unverändert in der
      // Nachrichten-Leiste daneben, mit seiner Markierung, einen Klick entfernt.
      const aeltestes = vorher.reduce((a, b) => (a.beruehrtAm <= b.beruehrtAm ? a : b));
      return [...vorher.filter((f) => f !== aeltestes), neu];
    });
  }, []);

  const setzeMinimiert = useCallback((threadId: string, minimiert: boolean) => {
    setFenster((vorher) => {
      const nummer = naechsteNummer(vorher);
      return vorher.map((f) =>
        f.threadId === threadId ? { ...f, minimiert, beruehrtAm: nummer } : f,
      );
    });
  }, []);

  const minimiere = useCallback(
    (threadId: string) => setzeMinimiert(threadId, true),
    [setzeMinimiert],
  );
  const ziehAuf = useCallback(
    (threadId: string) => setzeMinimiert(threadId, false),
    [setzeMinimiert],
  );

  const schliesse = useCallback((threadId: string) => {
    setFenster((vorher) => vorher.filter((f) => f.threadId !== threadId));
  }, []);

  const beruehre = useCallback((threadId: string) => {
    setFenster((vorher) => {
      // Nur, wenn dieses Fenster nicht ohnehin schon das zuletzt berührte ist.
      // Sonst löste jeder Klick in die Sendezeile eine Zustandsänderung und ein
      // Neuzeichnen der ganzen Reihe aus — für eine Rangfolge, die sich gar
      // nicht ändert.
      const ziel = vorher.find((f) => f.threadId === threadId);
      if (!ziel) return vorher;
      if (vorher.every((f) => f.beruehrtAm <= ziel.beruehrtAm)) return vorher;
      const nummer = naechsteNummer(vorher);
      return vorher.map((f) => (f === ziel ? { ...f, beruehrtAm: nummer } : f));
    });
  }, []);

  return { fenster, oeffne, minimiere, ziehAuf, schliesse, beruehre };
}
