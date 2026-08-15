/**
 * Der schreibende Teil des WordPress-Imports (AGE-534, Gruppe 7).
 *
 * Hier entstehen die Anweisungen — ausgeführt werden sie vom Aufrufer, in einer
 * Transaktion je Datensatz. Rein: kein `pg`, kein Netz.
 *
 * ── ZWEI DINGE, DIE HIER NICHT VERWECHSELT WERDEN DÜRFEN ────────────────────
 * SPALTENNAMEN gehen unparametrisiert in den Text, WERTE niemals. Die Werte
 * kommen aus einer fremden CSV — ein Name mit einem Apostroph zerlegte ein
 * zusammengesetztes Statement, und Schlimmeres ist leicht vorstellbar. Deshalb
 * sind die Spalten eine feste Liste im Code und die Werte immer `$n`.
 *
 * Eine Spalte, die nicht auf der Liste steht, ist ein Fehler im Code und keine
 * Eingabe, die man abweist: sie käme aus der Abbildung, nicht aus der Datei.
 * Darum wirft es hier, statt still auszulassen.
 */

import type { Zusammenfuehrung } from "./wp_import.lib";

/**
 * Was ein Konto bekommt, das DIESER Lauf gerade angelegt hat (Aufgabe 7.3).
 *
 * ── WARUM DAS AM AUFRUFER HÄNGT UND NICHT AN DER FORM DER ANWEISUNG ─────────
 * Eine frühere Fassung setzte diese beiden Werte als reine EINFÜGESPALTEN: sie
 * standen im `insert`, aber nicht im `do update set`, damit ein bestehendes
 * Konto nicht auf die höchste Stufe gehoben wird.
 *
 * Gemessen am 15.08. gegen den lokalen Stack: das greift nie.
 * `on_auth_user_created` (community_foundation.sql:82) legt bei JEDEM Insert in
 * `auth.users` schon eine Profilzeile an — auch auf dem Admin-Weg, mit
 * `tier = 'basic'`. Das Upsert des Imports trifft deshalb immer eine bestehende
 * Zeile, und eine reine Einfügespalte kommt nie an. Jedes importierte Konto wäre
 * `basic` geblieben, und die acht Tests davor haben es nicht gesehen, weil sie
 * den SQL-Text prüften statt der Datenbank.
 *
 * Der Riegel sitzt seither dort, wo er tragen kann (Entscheidung Donald,
 * 15.08.): geschrieben wird die Stufe, wenn und nur wenn dieser Lauf das
 * Anmeldekonto selbst angelegt hat. Bei einem bestehenden Konto taucht sie in
 * keiner Anweisung auf. Was der alte Riegel abwehren sollte — eine
 * Selbstregistrierung unter einer bekannten Mitgliedsadresse erbt `impact` —
 * fängt zusätzlich die Vorabprüfung 4.2 ab, die den ganzen Schreiblauf
 * blockiert, sobald eine Quelladresse einem Bestandskonto ohne Kennung gehört.
 *
 * `activated_at` bleibt `null`: der Zugang entsteht dadurch, dass ein Mitglied
 * seine Adresse selbst auf der Plattform eingibt. Das Aktivierungs-Gate ist bei
 * importierten Konten die einzige Hürde — der Import darf sie nicht wegnehmen.
 */
export const NEUES_KONTO = { tier: "impact", activated_at: null } as const;

/**
 * Jede Spalte, die dieser Import je schreibt. Die Liste ist die Grenze zwischen
 * „Text, den wir geschrieben haben" und „Wert, der aus der Quelle kommt".
 */
const SPALTEN = new Set([
  // Schlüssel
  "id",
  "profile_id",
  // profiles
  "name",
  "headline",
  "short_bio",
  "region",
  "website",
  "member_since",
  "socials",
  "videos",
  "avatar_url",
  "cover_url",
  "tier",
  "activated_at",
  // profile_contacts
  "email",
  "phone",
  "street",
  "postal_code",
  "city",
  "state",
  "country",
  // profile_legacy
  "legacy_source_id",
  "legacy_tier",
  // offers / needs / profile_interests
  "title",
  "description",
  "source",
  "label",
  "theme",
]);

/** Ein Bezeichner, der in den Text darf — geprüft, nicht geglaubt. */
function spalte(name: string): string {
  if (!SPALTEN.has(name)) {
    throw new Error(
      `Unbekannte Spalte "${name}" — Spaltennamen stammen aus dem Code, nie aus der Quelle.`,
    );
  }
  return `"${name}"`;
}

export type Anweisung = { sql: string; werte: unknown[] };

/**
 * Baut ein Upsert für eine Zieltabelle. `null`, wenn nichts zu schreiben ist —
 * ein leeres `set` wäre ein Syntaxfehler, und ein Statement, das nichts tut,
 * zählte im Bericht trotzdem als Schreibvorgang.
 *
 * Ein Feld, das NICHT im Auftrag steht, kommt auch nicht ins Statement. Das ist
 * die Merge-Regel aus 3.7, bis hierher durchgehalten: was sie stehen liess,
 * darf hier nicht als `null` wieder auftauchen und wegräumen, was ein Mitglied
 * gepflegt hat.
 */
export function schreibsatz(input: {
  tabelle: string;
  schluessel: { spalte: string; wert: string };
  felder: Record<string, unknown>;
}): Anweisung | null {
  const felder = Object.entries(input.felder);
  if (felder.length === 0) return null;

  const namen = [spalte(input.schluessel.spalte), ...felder.map(([n]) => spalte(n))];
  const platzhalter = namen.map((_, i) => `$${i + 1}`);
  const gesetzt = felder.map(([n]) => `${spalte(n)} = excluded.${spalte(n)}`);

  return {
    sql:
      `insert into ${input.tabelle} (${namen.join(", ")}) ` +
      `values (${platzhalter.join(", ")}) ` +
      `on conflict (${spalte(input.schluessel.spalte)}) do update set ${gesetzt.join(", ")}`,
    werte: [input.schluessel.wert, ...felder.map(([, w]) => w)],
  };
}

/**
 * Eine Zeile in einer Liste — `offers`, `needs`, `profile_interests`. Kein
 * Upsert: die drei haben keinen Schlüssel, über den sich eine Zeile wiederfinden
 * liesse, und sollen ihn auch nicht bekommen. Zweimal geschrieben werden sie
 * trotzdem nicht: die Merge-Regel aus 3.7 gibt eine Liste nur heraus, solange im
 * Ziel keine einzige Zeile steht.
 */
function einfuegesatz(input: {
  tabelle: string;
  schluessel: { spalte: string; wert: string };
  felder: Record<string, unknown>;
}): Anweisung {
  const felder = Object.entries(input.felder);
  const namen = [spalte(input.schluessel.spalte), ...felder.map(([n]) => spalte(n))];

  return {
    sql:
      `insert into ${input.tabelle} (${namen.join(", ")}) ` +
      `values (${namen.map((_, i) => `$${i + 1}`).join(", ")})`,
    werte: [input.schluessel.wert, ...felder.map(([, w]) => w)],
  };
}

/**
 * Alle Anweisungen zu EINEM Datensatz, in der Reihenfolge, in der sie laufen
 * müssen. Der Aufrufer legt eine Transaktion darum (7.1) — hier wird nichts
 * ausgeführt.
 *
 * `profiles` steht zuerst, weil alles andere über `profile_id` darauf zeigt.
 * Der Trigger hat die Zeile zwar schon angelegt, aber die Reihenfolge soll nicht
 * davon abhängen.
 */
export function schreibauftrag(input: {
  uid: string;
  /** Hat DIESER Lauf das Anmeldekonto angelegt? Entscheidet über `NEUES_KONTO`. */
  neuAngelegt: boolean;
  zusammenfuehrung: Zusammenfuehrung;
}): Anweisung[] {
  const { uid, zusammenfuehrung: auftrag } = input;
  const alsProfil = { spalte: "id", wert: uid };
  const alsFremd = { spalte: "profile_id", wert: uid };

  const anweisungen: (Anweisung | null)[] = [
    schreibsatz({
      tabelle: "public.profiles",
      schluessel: alsProfil,
      felder: { ...auftrag.profil, ...(input.neuAngelegt ? NEUES_KONTO : {}) },
    }),
    schreibsatz({
      tabelle: "public.profile_contacts",
      schluessel: alsFremd,
      felder: auftrag.kontakt,
    }),
    schreibsatz({
      tabelle: "public.profile_legacy",
      schluessel: alsFremd,
      felder: auftrag.legacy,
    }),
  ];

  // `source` steht ausdrücklich da und kommt nicht aus dem Spalten-Default: die
  // Bestandsabfrage zählt genau die Zeilen des Freitext-Editors, und daran hängt
  // die Wiederholbarkeit des Laufs.
  for (const angebot of auftrag.offers) {
    anweisungen.push(
      einfuegesatz({
        tabelle: "public.offers",
        schluessel: alsFremd,
        felder: { ...angebot, source: "editor" },
      }),
    );
  }
  for (const gesuch of auftrag.needs) {
    anweisungen.push(
      einfuegesatz({
        tabelle: "public.needs",
        schluessel: alsFremd,
        felder: { ...gesuch, source: "editor" },
      }),
    );
  }
  for (const interesse of auftrag.interessen) {
    anweisungen.push(
      einfuegesatz({
        tabelle: "public.profile_interests",
        schluessel: alsFremd,
        felder: interesse,
      }),
    );
  }

  // Eine Tabelle ohne zu schreibendes Feld fällt hier heraus — ein Statement,
  // das nichts tut, zählte im Bericht trotzdem als Schreibvorgang.
  return anweisungen.filter((a): a is Anweisung => a !== null);
}

// ── Das Anmeldekonto ────────────────────────────────────────────────────────

export type Kontoergebnis = { stand: "angelegt"; uid: string } | { stand: "fehler"; grund: string };

/**
 * Legt das Anmeldekonto über die Admin-Schnittstelle des Anmeldedienstes an —
 * NICHT durch ein `insert` in `auth.users`. Dort hängen Identity-Zeilen und
 * interne Invarianten daran, die eine GoTrue-Version ändern darf und ein
 * SQL-Insert stillschweigend verletzt.
 *
 * OHNE PASSWORT. Ein vom Import gesetztes Passwort wäre ein Zugang, den niemand
 * angefordert hat und den niemand kennt; der Weg hinein führt über den
 * Aktivierungslauf. Und KEIN Versand: dieser Endpunkt verschickt nichts (7.4) —
 * anders als `/invite`, das hier deshalb nicht steht.
 *
 * ── WARUM `email_confirm: true`, OBWOHL DAS KONTO UNAKTIVIERT BLEIBT ────────
 * Das sind zwei verschiedene Tore, und nur eines davon ist hier ein Gate.
 *
 * Das echte Gate ist `profiles.activated_at` (AGE-495) — es steht auf `null`
 * und bleibt es. Der Weg hinein führt über den Link aus dem EIGENEN Postfach:
 * `send-activation` verschickt ihn, `redeem-activation` nimmt Token UND neues
 * Passwort entgegen, setzt beides und stempelt erst dann `activated_at`. Die
 * Bestätigung per Mail und das Setzen des Passworts sind genau dieser Schritt,
 * und ihn macht das Mitglied.
 *
 * `email_confirmed_at` in `auth.users` ist dagegen GoTrues eigenes Flag und auf
 * dieser Plattform kein Gate (`config.toml`: `enable_confirmations = false`).
 * Es hier NICHT zu setzen, überspringt also nichts — es sperrt aus. Gemessen am
 * 15.08. gegen den lokalen Stack, mit genau dem Aufruf, den
 * `redeem-activation:114` macht:
 *
 *   email_confirm:false → Passwort setzen 200, Anmeldung 400 email_not_confirmed
 *   email_confirm:true  → Passwort setzen 200, Anmeldung 200
 *
 * Ohne das Flag klickt ein Mitglied seinen Aktivierungslink, setzt sein
 * Passwort — und kommt trotzdem nicht hinein. Sichtbar würde das erst nach dem
 * Go-Live, bei allen 70 zugleich.
 *
 * DIE BEGRÜNDUNG TRÄGT KEINE ADRESSE (4.7): sie landet im Terminal und im
 * Bericht, und der Antworttext des Dienstes zitiert gern die Eingabe.
 *
 * `fetch` kommt als Parameter herein — die Plattformfunktion, nicht eigener
 * Code; geprüft wird hier nichts gegen einen Nachbau.
 */
export async function legeKontoAn(
  input: { adresse: string; basis: string; schluessel: string },
  hole: typeof fetch = fetch,
): Promise<Kontoergebnis> {
  let antwort: Response;
  try {
    antwort = await hole(`${input.basis}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: input.schluessel,
        Authorization: `Bearer ${input.schluessel}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: input.adresse, email_confirm: true }),
    });
  } catch (e) {
    return { stand: "fehler", grund: `Netzfehler: ${(e as Error).message}` };
  }

  const koerper = (await antwort.json().catch(() => ({}))) as {
    id?: string;
    error_code?: string;
  };

  if (!antwort.ok) {
    const code = koerper.error_code ? ` (${koerper.error_code})` : "";
    return { stand: "fehler", grund: `Antwort ${antwort.status}${code}` };
  }
  if (!koerper.id) {
    return { stand: "fehler", grund: `Antwort ${antwort.status} ohne Kennung` };
  }

  return { stand: "angelegt", uid: koerper.id };
}
