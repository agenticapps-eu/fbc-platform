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

import { type Bildart, URLSPALTE } from "./wp_bilder";
import type { Zusammenfuehrung } from "./wp_import.lib";

/**
 * Die Zieltabellen, ausgeschrieben. Der Name geht — wie die Spalten —
 * unparametrisiert in den Text; ein Union-Typ ist die kleinste Fassung, die
 * verhindert, dass ihn je ein Aufrufer aus einer Abbildung reicht.
 * (Aus dem Sicherheits-Review: Spalte geprüft, Tabelle nicht, war eine
 * Asymmetrie, die genau dann auffällt, wenn sie schon benutzt wird.)
 */
type Zieltabelle =
  | "public.profiles"
  | "public.profile_contacts"
  | "public.profile_legacy"
  | "public.offers"
  | "public.needs"
  | "public.profile_interests";

/**
 * Jede Spalte, die dieser Import je in einem DATENSATZ schreibt. Die Liste ist
 * die Grenze zwischen „Text, den wir geschrieben haben" und „Wert, der aus der
 * Quelle kommt".
 *
 * `tier` und `activated_at` stehen bewusst NICHT darauf. Sie sind kein Feld des
 * Datensatzes, sondern gehören zum Anlegen des Kontos — siehe
 * `stufeFuerNeuesKonto`. Dadurch WIRFT jeder Versuch, sie über einen Auftrag zu
 * schreiben, statt still durchzugehen.
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
  tabelle: Zieltabelle;
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
 *
 * KEIN Leer-Wächter wie in `schreibsatz`, und das ist Absicht: ein leeres
 * `felder` ergäbe hier gültiges SQL (`insert into t ("profile_id") values ($1)`)
 * statt eines Syntaxfehlers — und erreichbar ist der Fall ohnehin nicht, weil
 * jede Liste feste Felder mitbringt.
 */
function einfuegesatz(input: {
  tabelle: Zieltabelle;
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
/**
 * Setzt die öffentliche URL eines hochgeladenen Bildes — mit dem Riegel gegen
 * das Überschreiben eines fremden Bildes IN SQL (Aufgabe 6.3).
 *
 * `and "avatar_url" is null` ist der einzige Schutz an dieser Stelle, und er
 * gehört genau hierher: ein Vergleich in TypeScript läse einen Stand, der
 * zwischen Lesen und Schreiben veraltet. Hat ein Mitglied sein Bild selbst
 * gewählt, trifft dieses UPDATE null Zeilen und der Lauf geht weiter.
 *
 * Es ist bewusst KEIN Teil des `profiles`-Upserts: dort stünde die Spalte im
 * `do update set` und überschriebe bedingungslos.
 */
function bildsatz(input: { uid: string; art: Bildart; url: string }): Anweisung {
  const name = spalte(URLSPALTE[input.art]);
  return {
    sql: `update public.profiles set ${name} = $1 where "id" = $2 and ${name} is null`,
    werte: [input.url, input.uid],
  };
}

export function schreibauftrag(input: {
  uid: string;
  zusammenfuehrung: Zusammenfuehrung;
  /** Was der Bildabschnitt gerade hochgeladen hat — leer, wo nichts entstand. */
  bilder?: ReadonlyArray<{ art: Bildart; url: string }>;
}): Anweisung[] {
  const { uid, zusammenfuehrung: auftrag } = input;
  const alsProfil = { spalte: "id", wert: uid };
  const alsFremd = { spalte: "profile_id", wert: uid };

  const anweisungen: (Anweisung | null)[] = [
    schreibsatz({
      tabelle: "public.profiles",
      schluessel: alsProfil,
      felder: { ...auftrag.profil },
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

  // Die Bild-URLs zuletzt: sie ergänzen die Profilzeile, die oben steht.
  for (const bild of input.bilder ?? []) {
    anweisungen.push(bildsatz({ uid, art: bild.art, url: bild.url }));
  }

  // Eine Tabelle ohne zu schreibendes Feld fällt hier heraus — ein Statement,
  // das nichts tut, zählte im Bericht trotzdem als Schreibvorgang.
  return anweisungen.filter((a): a is Anweisung => a !== null);
}

// ── Das Anmeldekonto ────────────────────────────────────────────────────────

export type Kontoergebnis = { stand: "angelegt"; uid: string } | { stand: "fehler"; grund: string };

/**
 * Die Stufe für ein Konto, das DIESER Lauf gerade angelegt hat (Aufgabe 7.3).
 *
 * ── WARUM DAS EINE EIGENE ANWEISUNG IST UND NICHT IM AUFTRAG STEHT ──────────
 * Zwei Fassungen davor sind gefallen, beide gemessen:
 *
 * 1. Als reine EINFÜGESPALTE (`insert`, nicht `do update set`) kam sie nie an:
 *    `on_auth_user_created` (community_foundation.sql:82) legt bei JEDEM Insert
 *    in `auth.users` schon eine Profilzeile an — auch auf dem Admin-Weg, mit
 *    `tier = 'basic'`. Jedes importierte Konto wäre `basic` geblieben, bei acht
 *    grünen Tests, die den SQL-Text prüften statt der Datenbank.
 *
 * 2. Im `do update set` der Datensatz-Transaktion, gesteuert von einem Merker
 *    `neuAngelegt`, hing die Invariante aus 4.2/7.3 an der Sorgfalt des
 *    Aufrufers. Das Review fand daran zweierlei: ein pauschales `true` in der
 *    Schleife hätte jedes wiedererkannte Bestandskonto auf `impact` gehoben UND
 *    eine gesetzte Freischaltung auf `null` zurückgesetzt — und schwerer: eine
 *    ABGEBROCHENE Transaktion hinterliess ein Konto mit `basic`, das
 *    `baueBestandsdaten` nicht mehr als eigenen Rest erkennt (dort heisst die
 *    Handschrift `impact` ohne Freischaltung). Es wäre als Kollision gewertet
 *    worden und hätte JEDEN weiteren Schreiblauf blockiert.
 *
 * Beides fällt weg, wenn die Stufe dorthin gehört, wo das Konto entsteht: in
 * eine eigene Anweisung, direkt hinter das Anlegen und VOR die Transaktion.
 * Dann steht die Handschrift schon da, bevor irgendetwas scheitern kann.
 *
 * Der Riegel ist jetzt der TYP: das Argument ist der `angelegt`-Zweig von
 * `Kontoergebnis`. Ein bestehendes Konto lässt sich hier gar nicht einsetzen,
 * ohne sich die Herkunft auszudenken. `activated_at is null` ist der zweite
 * Riegel — ein freigeschaltetes Konto benutzt jemand.
 *
 * `activated_at` selbst wird NICHT geschrieben. Der Trigger lässt es auf `null`
 * (six_level_model.sql:87 setzt nur `id`, `name`, `tier`), und es zu setzen wäre
 * der einzige Weg, auf dem dieser Import je eine Freischaltung wegnehmen könnte.
 */
export function stufeFuerNeuesKonto(konto: { stand: "angelegt"; uid: string }): Anweisung {
  return {
    sql: `update public.profiles set "tier" = 'impact' where "id" = $1 and "activated_at" is null`,
    werte: [konto.uid],
  };
}

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
 *
 * ── PFLICHT DES AUFRUFERS: `basis` GEHÖRT ZUM GEPRÜFTEN ZIEL ────────────────
 * `pruefeZiel` (1.4) hält die DATENBANK-Verbindung gegen das genannte Ziel.
 * Diese beiden Parameter prüft es nicht. Stünden `SUPABASE_DB_URL_DEV` und ein
 * PROD-Service-Key nebeneinander, legte ein Lauf 70 Konten in PROD an und
 * schriebe die Profile nach DEV — und das Anlegen ist der unwiderrufliche Teil,
 * ausserhalb jeder Transaktion. Auf dieser Plattform ist genau diese
 * Verwechslung dokumentiert. Wer den Lauf verdrahtet (7.8), leitet `basis` aus
 * derselben Zielauflösung ab wie die DB-URL und prüft die Kennung, bevor der
 * erste Aufruf hier stattfindet. Aufgenommen aus dem Review.
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
      // Ohne Zeitgrenze hält ein hängender Aufruf einen Lauf über 70 Datensätze
      // unbegrenzt an, ohne eine Zeile Ausgabe. Der Abbruch landet im `catch`
      // darunter und wird als Netzfehler gemeldet.
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    // NICHT einfach melden. Der POST kann serverseitig gelungen sein, während
    // wir die Antwort nicht mehr gesehen haben — die Zeitgrenze oben ist genau
    // dafür da, und beim Bilder-Schritt hingen am 15.08. vier von 110 Anfragen
    // reproduzierbar je 60 s in „upstream server is timing out". Ein so
    // entstandenes Konto trägt keine Stufe und keine Kennung, ist also `basic`
    // und damit KEIN erkennbarer eigener Rest; beim nächsten Lauf ist es eine
    // Bestandskollision, und die blockiert nicht diesen Datensatz, sondern
    // jeden weiteren Lauf. Deshalb nachsehen. (Befund HIGH-1, codex, 16.08.)
    return await sucheKonto(input, hole, `Netzfehler: ${(e as Error).message}`);
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

/**
 * Nachschau nach einem Konto, dessen Anlage wir angestossen haben, deren
 * Ausgang wir aber nicht kennen. Findet sie eines, gilt es als von diesem Lauf
 * angelegt — was es auch ist: der POST war unserer.
 *
 * NUR AUS DEM `catch`, nicht bei einer abweisenden Antwort. Ein `email_exists`
 * ist zweideutig: dahinter kann ebensogut eine Selbstregistrierung stehen, die
 * der Bestandsabzug noch nicht kannte. Sie zu übernehmen hiesse, ihr `impact`
 * zu geben und fremde Daten darüberzuschreiben — der Fall, den 7.3 ausdrücklich
 * ausschliesst. Eine unklare Antwort bleibt deshalb ein Fehler und geht an einen
 * Menschen.
 *
 * DIE ADRESSE WIRD NACHGEPRÜFT. GoTrues `filter` ist eine Teilzeichenkette:
 * „a1@example.org" träfe auch „a1@example.org.uk". Ein Treffer ohne
 * Gleichheitsprüfung schriebe die Daten des einen Mitglieds auf das Konto eines
 * anderen — der teuerste Fehler, den dieses Werkzeug machen könnte.
 */
async function sucheKonto(
  input: { adresse: string; basis: string; schluessel: string },
  hole: typeof fetch,
  grundOhneTreffer: string,
): Promise<Kontoergebnis> {
  let antwort: Response;
  try {
    antwort = await hole(
      `${input.basis}/auth/v1/admin/users?filter=${encodeURIComponent(input.adresse)}`,
      {
        method: "GET",
        headers: { apikey: input.schluessel, Authorization: `Bearer ${input.schluessel}` },
        signal: AbortSignal.timeout(30_000),
      },
    );
  } catch {
    return { stand: "fehler", grund: grundOhneTreffer };
  }
  if (!antwort.ok) return { stand: "fehler", grund: grundOhneTreffer };

  const koerper = (await antwort.json().catch(() => ({}))) as {
    users?: { id?: string; email?: string }[];
  };
  const gesucht = input.adresse.trim().toLowerCase();
  const treffer = (koerper.users ?? []).find(
    (u) => u.id && (u.email ?? "").trim().toLowerCase() === gesucht,
  );

  return treffer?.id
    ? { stand: "angelegt", uid: treffer.id }
    : { stand: "fehler", grund: grundOhneTreffer };
}
