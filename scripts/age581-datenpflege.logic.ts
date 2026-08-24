/**
 * Rechenkern der Datenpflege aus AGE-581, Abschnitt 12. KEINE Datenbank, KEIN
 * Netz — damit die beiden Regeln, an denen der Durchgang hängt, in einem Test
 * rot werden können statt erst auf PROD.
 *
 * Die zwei Regeln sind:
 *   1. `paid_until` aus dem Jahrestag — gegen einen FESTEN Stichtag, nicht
 *      gegen „heute". Sonst ergibt derselbe Lauf morgen andere Daten und der
 *      Beleg im Repo stimmt nicht mehr mit der Datenbank überein.
 *   2. die Zuordnung Übersichtszeile → Konto. Sie entscheidet, WER die Werte
 *      bekommt; ein Fehler hier schreibt richtige Zahlen an die falsche Person.
 */

/** Eine Zeile aus Detlevs Übersicht. Die Quelldatei ist NICHT eingecheckt. */
export type Uebersichtszeile = {
  kategorie: string;
  vorname: string;
  nachname: string;
  jahrestag: string;
  email: string;
  /**
   * FESTE ZUORDNUNG — die heutige Anmeldeadresse des gemeinten Kontos.
   *
   * Nur gesetzt, wo Adresse UND Name die Zuordnung nicht tragen. Das kommt vor:
   * eine Übersichtszeile kann die Adresse einer ANDEREN Person tragen, und dann
   * ist der Adresstreffer nicht bloss schwach, sondern falsch — er schreibt die
   * Werte an die falsche Person und lässt das richtige Konto als „ohne Eintrag"
   * zurück, wo es deaktiviert würde.
   *
   * Die Zuordnung steht deshalb in der QUELLDATEI und nicht hier: das Repo ist
   * öffentlich, und eine Zuordnungstabelle ist eine Identitätstabelle.
   */
  kontoEmail?: string;
};

/** Ein Konto, so wie es der Trockenlauf aus PROD liest. */
export type Konto = {
  id: string;
  name: string | null;
  login_email: string | null;
  kontakt_email: string | null;
  paid_until: string | null;
  payment_type: string | null;
  activated_at: string | null;
  disabled_at: string | null;
  deleted_at: string | null;
};

/** Die acht in der Datenbank zugelassenen Zahlungsarten (CHECK auf profile_legacy). */
export const ZAHLUNGSARTEN = [
  "rechnung",
  "stripe",
  "copecart",
  "paypal",
  "digistore24",
  "ehren",
  "partner",
  "offen",
] as const;

export type PaidUntil =
  { art: "datum"; wert: string } | { art: "ohne" } | { art: "unlesbar"; roh: string };

/**
 * Der Jahrestag sagt, wann sich der Plan ERNEUERT. Bezahlt ist also bis zum Tag
 * davor — und zwar bis zum NÄCHSTEN Vorkommen von Tag und Monat nach dem
 * Stichtag. Fällt der Jahrestag auf den Stichtag selbst, zählt das nächste Jahr:
 * an diesem Tag wird bereits neu bezahlt.
 *
 * `stichtag` kommt als Parameter herein und nicht aus `Date.now()`, damit der
 * Aufrufer ihn festschreiben MUSS.
 */
export function paidUntilAus(jahrestag: string, stichtag: string): PaidUntil {
  const roh = jahrestag.trim();
  if (roh === "" || roh.toLowerCase() === "ohne") return { art: "ohne" };
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(roh);
  if (!m) return { art: "unlesbar", roh };
  const tag = Number(m[1]);
  const monat = Number(m[2]);
  const stich = new Date(`${stichtag}T00:00:00Z`);
  if (Number.isNaN(stich.getTime())) return { art: "unlesbar", roh };

  // Der 29.02. bekommt KEIN gerechnetes Ergebnis, auch nicht in einem
  // Schaltjahr. Sonst hinge die Antwort daran, in welchem Jahr der Stichtag
  // liegt — dieselbe Zeile wäre mal ein Datum und mal ein Loch. Wer einen
  // Jahrestag am 29.02. hat, bekommt eine Entscheidung, keine Rundung.
  if (tag === 29 && monat === 2) return { art: "unlesbar", roh };

  let kehr = new Date(Date.UTC(stich.getUTCFullYear(), monat - 1, tag));
  // Der 31.04. rollt still auf den 01.05. weiter. Ein stiller Übertrag ist hier
  // ein erfundenes Datum, kein Rundungsfehler.
  if (kehr.getUTCDate() !== tag || kehr.getUTCMonth() !== monat - 1)
    return { art: "unlesbar", roh };
  if (kehr.getTime() <= stich.getTime())
    kehr = new Date(Date.UTC(stich.getUTCFullYear() + 1, monat - 1, tag));

  const bis = new Date(kehr.getTime() - 86_400_000);
  return { art: "datum", wert: bis.toISOString().slice(0, 10) };
}

const norm = (s: string | null) => (s ?? "").trim().toLowerCase();
const nameNorm = (s: string | null) => norm(s).replace(/\s+/g, " ");

export type Zuordnung = {
  zeile: Uebersichtszeile;
  nummer: number;
  wie: "fest" | "email" | "name" | "name~" | "-";
  treffer: Konto[];
};

/**
 * Feste Zuordnung zuerst, dann Adresse, dann voller Name, zuletzt Nachname mit
 * passendem ersten Vornamen. Die Reihenfolge ist die Aussage: eine von Hand
 * gesetzte Zuordnung schlägt jeden Automatismus, eine übereinstimmende Adresse
 * ist der stärkere Beleg, und ein Namenstreffer bleibt als solcher
 * gekennzeichnet, damit die abweichende Adresse in 12.4 nicht untergeht.
 */
export function ordneZu(zeilen: Uebersichtszeile[], konten: Konto[]): Zuordnung[] {
  return zeilen.map((zeile, i) => {
    if (zeile.kontoEmail) {
      const fest = konten.filter((k) => norm(k.login_email) === norm(zeile.kontoEmail!));
      return { zeile, nummer: i + 1, wie: fest.length ? "fest" : "-", treffer: fest };
    }
    const perEmail = konten.filter(
      (k) =>
        norm(k.login_email) === norm(zeile.email) || norm(k.kontakt_email) === norm(zeile.email),
    );
    const voll = nameNorm(`${zeile.vorname} ${zeile.nachname}`);
    const perName = konten.filter((k) => nameNorm(k.name) === voll);
    const perNachname = konten.filter(
      (k) =>
        nameNorm(k.name).endsWith(" " + nameNorm(zeile.nachname)) &&
        nameNorm(k.name).startsWith(nameNorm(zeile.vorname).split(" ")[0]),
    );
    const treffer = perEmail.length ? perEmail : perName.length ? perName : perNachname;
    const wie = perEmail.length
      ? "email"
      : perName.length
        ? "name"
        : perNachname.length
          ? "name~"
          : "-";
    return { zeile, nummer: i + 1, wie, treffer };
  });
}

/** Gleich normalisiert wie in `ordneZu` — 12.4 fragt genau diese Gleichheit. */
export function adresseWeichtAb(listenadresse: string, loginadresse: string | null): boolean {
  return norm(listenadresse) !== norm(loginadresse);
}

/**
 * Zwei Übersichtszeilen auf DASSELBE Konto. `ordneZu` kann das nicht sehen — es
 * beantwortet je Zeile die Frage „welches Konto?" und findet für beide dieselbe
 * richtige Antwort auf eine falsche Frage.
 *
 * Der Fall ist nicht theoretisch: trägt eine Zeile die Firmenadresse einer
 * anderen Person, treffen beide Zeilen deren Konto. Ungeprüft schriebe der Lauf
 * zwei verschiedene Jahrestage nacheinander in dieselbe Zeile — die zweite
 * Schreibung gewänne, lautlos — und das richtige Konto bliebe „ohne Eintrag"
 * und würde in 12.5 deaktiviert. Ein Mitglied verlöre seinen Zugang, weil in
 * einer Tabelle eine Adresse falsch stand.
 */
export function findeDoppelbelegung(
  zuordnungen: Zuordnung[],
): { kontoId: string; nummern: number[] }[] {
  const jeKonto = new Map<string, number[]>();
  for (const z of zuordnungen.filter((z) => z.treffer.length === 1))
    jeKonto.set(z.treffer[0].id, [...(jeKonto.get(z.treffer[0].id) ?? []), z.nummer]);
  return [...jeKonto]
    .filter(([, n]) => n.length > 1)
    .map(([kontoId, nummern]) => ({ kontoId, nummern }));
}
