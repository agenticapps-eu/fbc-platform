/**
 * Inhalte für die Import-Datenbank (AGE-566) — die 71 echten Mitglieder.
 *
 *   infisical run --env=prod -- env IMPORT_SEED_CONFIRM=fbc-import-vorschau \
 *     tsx supabase/seed/import_world_seed.ts
 *   … und zum Entfernen zusätzlich IMPORT_SEED_MODE=reset
 *
 * ══ WOFÜR ══════════════════════════════════════════════════════════════════
 * `viwntbodrtqxgmqyxluh` trägt den WordPress-Import: 71 Profile, alle `impact`,
 * alle `is_public` — aber NULL Beiträge, NULL Events, und nur zwei aktivierte
 * Konten. Die Fläche darüber sieht deshalb aus wie eine leere Plattform. Dieser
 * Seed füllt sie, damit sich beurteilen lässt, wie sie sich MIT Inhalt anfühlt.
 *
 * Donalds Ansage vom 17.08.: der Bestand hier wird **vor dem Go-Live geleert**.
 * Das Runbook (`docs/supabase-environments.md`) führt „Demo-Seed erlaubt" für
 * dieses Projekt mit „nein, nie" — diese Zeile ist damit bewusst überstimmt,
 * und genau deshalb steht unten mehr Absicherung als im Demo-Seed.
 *
 * ══ WAS ERFUNDEN WIRD, UND WAS NICHT ═══════════════════════════════════════
 * Erfunden werden GESPRÄCHSBEITRÄGE: Beiträge, Kommentare, Likes,
 * Veranstaltungen, Anmeldungen. Sie sind bewusst harmlos gehalten — keine
 * Aussage über Umsatz, Finanzierung, Gesundheit, Recht oder Politik im Namen
 * einer realen Person, und nichts, das jemanden in Verlegenheit brächte.
 *
 * NICHT erfunden werden harte Profilfakten: `company`, `roles`, `competencies`
 * bleiben leer. Ein erfundener Arbeitgeber an einem echten Namen liest sich wie
 * ein importierter Datensatz, nicht wie Geplauder — und wäre nach dem Leeren
 * nicht mehr von echten Angaben zu unterscheiden.
 *
 * KEINE Namen und keine Kennungen echter Mitglieder stehen in dieser Datei. Die
 * Autoren werden zur Laufzeit aus der Datenbank geholt, in fester Reihenfolge
 * nach `id`. So trägt das öffentliche Repository keine Personendaten.
 *
 * ══ WIE ES WIEDER WEGGEHT ══════════════════════════════════════════════════
 * Jede erzeugte Zeile trägt eine Kennung mit dem Präfix `0ade0566`. `reset`
 * löscht nach genau diesem Präfix — nicht nach „alles, was neu aussieht" — und
 * nimmt die Aktivierungen zurück, die dieser Lauf gesetzt hat. Was der Import
 * mitbrachte, bleibt unberührt.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { titelbildZuschnitt } from "./event_cover_zuschnitt";

const HERE = dirname(fileURLToPath(import.meta.url));
const BILDER = join(HERE, "..", "..", "public", "images");

/** Das Projekt, in das dieser Seed gehört — und NUR dieses. */
const ZIEL_PROJEKT = "viwntbodrtqxgmqyxluh";
/** Eigenes Wort, nicht `fbc-demo`: der Demo-Seed darf hier nichts auslösen. */
const CONFIRM = "fbc-import-vorschau";
/** Präfix aller erzeugten Kennungen. Trägt das Aufräumen. */
const PRAEFIX = "0ade0566";
/**
 * Der Zugang zum Anschauen. `.invalid` ist nach RFC 2606 nicht zustellbar —
 * die Adresse kann kein echtes Mitglied tragen. An EINER Stelle, weil sie an
 * drei Stellen gebraucht wird und drei Schreibweisen genau der Fehler wären,
 * der das Konto bei der Zuordnung mitzählt.
 */
const VORSCHAU_ADRESSE = "vorschau@fbc.invalid";
const BUCKET = "event-covers";

/**
 * WER AKTIVIERT WIRD — und warum nicht einfach alle.
 *
 * Aktiviert wird genau, wer etwas beigetragen hat: Autoren von Beiträgen,
 * Autoren von Kommentaren, Gastgeber von Terminen. Der Rest bleibt unbestätigt.
 *
 * Das ist nicht bloss hübscher, es ist die einzige Fassung, die in sich stimmt.
 * Ein Konto, das nie jemand benutzt hat, hat auch nichts geschrieben — und
 * umgekehrt kann niemand posten, dessen Zugang nie bestätigt wurde. Eine
 * Vorschau, in der alle bestätigt sind, nähme ausserdem der Admin-Mitgliederliste
 * ihren Anlassfall: sie ist genau für die Unbestätigten gebaut.
 *
 * Likes und Anmeldungen kommen deshalb ebenfalls NUR aus diesem Kreis. Ein
 * unbestätigtes Mitglied, das sich für einen Termin angemeldet hat, wäre ein
 * Zustand, den die Anwendung nicht herstellen kann.
 */

/**
 * Feste Kennung je Inhalt. Die letzte Gruppe einer UUID ist ZWÖLF Zeichen lang —
 * beim ersten Versuch waren es neun, und Postgres lehnte den Wert ab („invalid
 * input syntax for type uuid"). `art` ist ein Buchstabe aus dem Hex-Vorrat:
 * a = Beitrag, b = Kommentar, c = Termin.
 */
const kennung = (art: "a" | "b" | "c", i: number) =>
  `${PRAEFIX}-0000-4000-8000-${art}${String(i).padStart(11, "0")}`;

/**
 * Die Beiträge. `a` ist der Index des Autors in der nach `id` sortierten
 * Mitgliederliste — feste Zuordnung, damit ein zweiter Lauf dieselben Menschen
 * dieselben Sätze sagen lässt.
 *
 * Die Videos sind dieselben oEmbed-geprüften Vorträge wie im Demo-Seed; sie
 * füllen zugleich die Academy, weil `video_url` per Trigger aus dem Text
 * entsteht.
 */
const VIDEO = {
  fuehrung: "https://www.youtube.com/watch?v=qp0HIF3SfI4",
  verletzlichkeit: "https://www.youtube.com/watch?v=X4Qm9cGRub0",
  stress: "https://www.youtube.com/watch?v=RcGyVTAoXEU",
  sprechen: "https://www.youtube.com/watch?v=eIho2S0ZahI",
  aufschieben: "https://www.youtube.com/watch?v=arj7oStGLkU",
  kreativitaet: "https://www.youtube.com/watch?v=iG9CE55wbtY",
  koerpersprache: "https://www.youtube.com/watch?v=Ks-_Mh1QhMc",
} as const;

interface Beitrag {
  a: number;
  text: string;
  tags: string[];
  stunden: number;
  oeffentlich?: boolean;
}

const BEITRAEGE: Beitrag[] = [
  {
    a: 0,
    text: "Schön, dass hier jetzt alle an einem Ort zusammenkommen. Freue mich auf den Austausch. #Netzwerken",
    tags: ["netzwerken"],
    stunden: 260,
    oeffentlich: true,
  },
  {
    a: 3,
    text: "Erste Runde durchs Verzeichnis gedreht — erstaunlich, wie viele bekannte Gesichter hier schon stehen. #Netzwerken",
    tags: ["netzwerken"],
    stunden: 236,
  },
  {
    a: 7,
    text: `Wie gute Führung wirklich entsteht — ein Vortrag, den ich immer wieder empfehle. ${VIDEO.fuehrung} #Leadership`,
    tags: ["leadership"],
    stunden: 212,
  },
  {
    a: 11,
    text: "Wer aus der Runde ist regelmäßig in Stuttgart unterwegs? Würde gern mal auf einen Kaffee zusammenkommen. #Netzwerken",
    tags: ["netzwerken"],
    stunden: 196,
  },
  {
    a: 15,
    text: `Verletzlichkeit als Führungsstärke. Klingt weich, ist es nicht. ${VIDEO.verletzlichkeit} #Leadership #Persönlichkeitsentwicklung`,
    tags: ["leadership", "persönlichkeitsentwicklung"],
    stunden: 178,
  },
  {
    a: 19,
    text: "Kurze Vorstellung von mir: seit vielen Jahren selbstständig, und der Austausch mit anderen Unternehmern war dabei immer der wichtigste Teil. #Vorstellung",
    tags: ["vorstellung"],
    stunden: 160,
  },
  {
    a: 23,
    text: "Frage in die Runde: welches Format wünscht ihr euch häufiger — kurze Online-Treffen oder die längeren Abende vor Ort? #Frage",
    tags: ["frage"],
    stunden: 142,
  },
  {
    a: 27,
    text: `Wie wir Kreativität in Organisationen wieder zulassen. Passt gut zu dem, worüber wir zuletzt gesprochen haben. ${VIDEO.kreativitaet} #Persönlichkeitsentwicklung`,
    tags: ["persönlichkeitsentwicklung"],
    stunden: 124,
  },
  {
    a: 31,
    text: "Danke an alle, die letzte Woche dabei waren. Aus zwei Gesprächen ist schon ein Folgetermin geworden. #Netzwerken #Rückblick",
    tags: ["netzwerken", "rückblick"],
    stunden: 106,
  },
  {
    a: 35,
    text: `Wer gehört werden will, muss anders sprechen. Nehme daraus viel für unsere Präsentationen mit. ${VIDEO.sprechen} #Marketing`,
    tags: ["marketing"],
    stunden: 92,
  },
  {
    a: 39,
    text: "Kleiner Tipp für alle, die neu dabei sind: das Profil einmal vollständig ausfüllen lohnt sich. Man wird deutlich häufiger gefunden. #Vorstellung",
    tags: ["vorstellung"],
    stunden: 78,
    oeffentlich: true,
  },
  {
    a: 43,
    text: `Stress ist nicht der Gegner — es kommt darauf an, wie wir ihn deuten. ${VIDEO.stress} #Persönlichkeitsentwicklung`,
    tags: ["persönlichkeitsentwicklung"],
    stunden: 64,
  },
  {
    a: 47,
    text: "Freue mich auf das Frühstück. Wer kommt aus der Region und hat noch keinen Platz? #Erlebnistag",
    tags: ["erlebnistag"],
    stunden: 50,
  },
  {
    a: 51,
    text: `Warum wir Dinge aufschieben — mit Abstand die ehrlichste halbe Stunde zum Thema. ${VIDEO.aufschieben} #Persönlichkeitsentwicklung`,
    tags: ["persönlichkeitsentwicklung"],
    stunden: 38,
  },
  {
    a: 5,
    text: "Der Kalender füllt sich. Schön zu sehen, dass hier wirklich etwas entsteht. #Netzwerken",
    tags: ["netzwerken"],
    stunden: 27,
  },
  {
    a: 13,
    text: "Wer hat Erfahrung mit dem Aufbau eines regionalen Netzwerks von Grund auf? Würde mich über einen Austausch freuen. #Frage #Unternehmertum",
    tags: ["frage", "unternehmertum"],
    stunden: 19,
  },
  {
    a: 29,
    text: `Körpersprache entscheidet oft schon vor dem ersten Satz. Kurz und sofort anwendbar. ${VIDEO.koerpersprache} #Marketing`,
    tags: ["marketing"],
    stunden: 9,
    oeffentlich: true,
  },
  {
    a: 21,
    text: "Guten Morgen aus dem Büro. Heute ein Tag ohne Termine — die gibt es also doch noch. #Unternehmertum",
    tags: ["unternehmertum"],
    stunden: 3,
  },
];

interface Kommentar {
  beitrag: number;
  a: number;
  text: string;
  stunden: number;
}

/** Beitrag 6 (die Formatfrage) trägt vier Antworten — damit „N weitere
 *  Kommentare anzeigen" im Feed überhaupt vorkommt. */
const KOMMENTARE: Kommentar[] = [
  { beitrag: 0, a: 4, text: "Sehe ich genauso. Endlich alles an einer Stelle.", stunden: 250 },
  { beitrag: 1, a: 9, text: "Ging mir genauso — gleich drei Leute wiedergefunden.", stunden: 230 },
  { beitrag: 3, a: 17, text: "Bin oft in Stuttgart, sehr gerne.", stunden: 190 },
  {
    beitrag: 6,
    a: 12,
    text: "Klar für die Abende vor Ort. Online ist praktisch, aber es bleibt weniger hängen.",
    stunden: 138,
  },
  {
    beitrag: 6,
    a: 25,
    text: "Beides, ehrlich gesagt. Online für den schnellen Austausch, vor Ort für alles andere.",
    stunden: 132,
  },
  {
    beitrag: 6,
    a: 33,
    text: "Ich wäre für einen festen Rhythmus — dann kann man es einplanen.",
    stunden: 126,
  },
  {
    beitrag: 6,
    a: 41,
    text: "Guter Punkt. Ein fester Termin im Monat würde mir sehr helfen.",
    stunden: 120,
  },
  { beitrag: 8, a: 45, text: "War ein schöner Abend. Sehr gerne wieder.", stunden: 100 },
  { beitrag: 10, a: 49, text: "Danke für den Hinweis, gleich mal ergänzt.", stunden: 70 },
  { beitrag: 12, a: 53, text: "Ich bin dabei.", stunden: 44 },
  {
    beitrag: 15,
    a: 2,
    text: "Da kann ich etwas beitragen, melde mich per Nachricht.",
    stunden: 14,
  },
];

interface Termin {
  titel: string;
  art: string;
  gastgeber: number;
  tage: number;
  stunde: number;
  bis: number;
  ort: string;
  plaetze: number;
  beschreibung: string;
  bild: string;
  anmeldungen: number;
}

const TERMINE: Termin[] = [
  {
    titel: "FBC Frühstück Stuttgart",
    art: "presence",
    gastgeber: 0,
    tage: 2,
    stunde: 9,
    bis: 11,
    ort: "Stuttgart, Hotel am Schlossgarten",
    plaetze: 20,
    beschreibung:
      "Offener Auftakt in den Tag: kurze Vorstellungsrunde, zwei Impulse aus dem Kreis, danach freier Austausch.",
    bild: "hero-aktivitaet.webp",
    anmeldungen: 11,
  },
  {
    titel: "Online-Treffen: Wer ist neu dabei?",
    art: "online",
    gastgeber: 6,
    tage: 4,
    stunde: 18,
    bis: 19,
    ort: "Online (Zoom)",
    plaetze: 60,
    beschreibung:
      "Eine Stunde für alle, die frisch dazugekommen sind — kurze Vorstellungen und Antworten auf die häufigsten Fragen.",
    bild: "hero-kontakte.webp",
    anmeldungen: 17,
  },
  {
    titel: "Unternehmerabend Ludwigsburg",
    art: "presence",
    gastgeber: 14,
    tage: 9,
    stunde: 19,
    bis: 22,
    ort: "Ludwigsburg, Schloss-Remise",
    plaetze: 30,
    beschreibung:
      "Abend im offenen Format: kein Programm, dafür viel Zeit für Gespräche in kleiner Runde.",
    bild: "hero-see.webp",
    anmeldungen: 22,
  },
  {
    titel: "Werkstatt: Das eigene Profil schärfen",
    art: "workshop",
    gastgeber: 22,
    tage: 13,
    stunde: 10,
    bis: 16,
    ort: "Stuttgart, FBC Lounge",
    plaetze: 12,
    beschreibung:
      "Ein Tag an der eigenen Außendarstellung — was man anbietet, wofür man steht, und wie beides zusammenfindet.",
    bild: "hero-mitglieder.webp",
    anmeldungen: 9,
  },
  {
    titel: "Kaminabend: Erfahrungen aus der Nachfolge",
    art: "dinner",
    gastgeber: 30,
    tage: 18,
    stunde: 19,
    bis: 22,
    ort: "Esslingen, Alte Kelter",
    plaetze: 10,
    beschreibung:
      "Drei Übergaben, drei Wege, drei ehrliche Rückblicke — im kleinen Kreis und ohne Folien.",
    bild: "hero-start.webp",
    anmeldungen: 10,
  },
  {
    titel: "Online-Impuls: Sichtbar werden ohne Lärm",
    art: "online",
    gastgeber: 38,
    tage: 24,
    stunde: 17,
    bis: 18,
    ort: "Online (Zoom)",
    plaetze: 80,
    beschreibung: "Wie man wahrgenommen wird, ohne sich zu verbiegen. Mit viel Raum für Fragen.",
    bild: "hero-academy.webp",
    anmeldungen: 14,
  },
  {
    titel: "Regionaltreffen Rhein-Neckar",
    art: "presence",
    gastgeber: 46,
    tage: 31,
    stunde: 18,
    bis: 21,
    ort: "Mannheim, Alte Feuerwache",
    plaetze: 25,
    beschreibung: "Erstes Treffen für alle aus der Region — Auftakt für einen festen Rhythmus.",
    bild: "hero-mitgliedschaft.webp",
    anmeldungen: 8,
  },
  {
    titel: "Jahresauftakt-Retreat",
    art: "workshop",
    gastgeber: 54,
    tage: 45,
    stunde: 10,
    bis: 14,
    ort: "Allgäu, Berggut Sonnenhalde",
    plaetze: 24,
    beschreibung:
      "Drei Tage Abstand vom Tagesgeschäft: Jahresplanung, Partnerschaften und viel Zeit zwischen den Programmpunkten.",
    bild: "hero-compass.webp",
    anmeldungen: 6,
  },
];

// ── Ausführung ───────────────────────────────────────────────────────────────

function optIn(): "seed" | "reset" {
  if (process.env.IMPORT_SEED_CONFIRM !== CONFIRM) {
    throw new Error(
      `Dieser Seed schreibt in die Datenbank mit den ECHTEN Mitgliedern.\n` +
        `Setze IMPORT_SEED_CONFIRM=${CONFIRM}, wenn das beabsichtigt ist.`,
    );
  }
  const m = process.env.IMPORT_SEED_MODE;
  if (m === undefined || m === "" || m === "seed") return "seed";
  if (m === "reset") return "reset";
  throw new Error(`Unbekannter IMPORT_SEED_MODE "${m}" (erwartet "seed" oder "reset").`);
}

/**
 * TLS für die Verbindung.
 *
 * SICHER ALS VORGABE, mit zwei bewussten Ausnahmen — nie stillschweigend
 * abgeschaltet. Die erste Fassung setzte hart `rejectUnauthorized: false`, und
 * das war ausgerechnet hier am wenigsten vertretbar: an dieser Datenbank hängen
 * die Daten echter Menschen, und die Verbindung war zwar verschlüsselt, der
 * Server aber nicht authentifiziert. Befund aus dem Sicherheits-Review.
 *
 * Der Pooler zeigt ein Zertifikat aus Supabases eigener CA, die nicht im
 * System-Vertrauensspeicher steht — die Prüfung schlägt deshalb ohne eine der
 * beiden Angaben fehl. Das ist die beabsichtigte Reibung, nicht ein Fehler:
 *   IMPORT_SEED_CA_CERT=<pem>   → gegen Supabases CA prüfen (der richtige Weg;
 *                                 Download im Dashboard unter Database → SSL)
 *   IMPORT_SEED_TLS_INSECURE=1  → verschlüsseln, aber nicht authentifizieren
 *                                 (nur im vertrauenswürdigen Netz; warnt laut)
 */
function tls(): pg.ClientConfig["ssl"] {
  const ca = process.env.IMPORT_SEED_CA_CERT;
  if (ca) return { ca: readFileSync(ca, "utf8"), rejectUnauthorized: true };
  if (process.env.IMPORT_SEED_TLS_INSECURE === "1") {
    console.warn(
      "⚠️  TLS-Prüfung abgeschaltet (IMPORT_SEED_TLS_INSECURE=1): die Verbindung ist " +
        "verschlüsselt, der Server aber NICHT authentifiziert. An dieser Datenbank " +
        "hängen echte Personendaten — nur im vertrauenswürdigen Netz verwenden.",
    );
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

/**
 * Der Wächter am Ziel. Der Pooler-Host ist regionsweit derselbe — es ist der
 * BENUTZERNAME, der das Projekt nennt. Ein Wächter auf den Host prüfte die
 * Region und liesse einen Lauf gegen das falsche Projekt durch.
 */
function zielPruefen(url: string): void {
  const benutzer = decodeURIComponent(new URL(url).username);
  if (!benutzer.endsWith(ZIEL_PROJEKT)) {
    throw new Error(
      `Falsches Ziel: verbunden als "${benutzer}", erwartet wird Projekt ${ZIEL_PROJEKT}. Abbruch.`,
    );
  }
}

/**
 * Der Kreis derer, die dieser Seed aktiviert — aus den Inhalten berechnet.
 *
 * BEIDE Läufe rufen dieselbe Funktion. Das ist der Punkt: `reset` darf nur
 * zurücknehmen, was `seed` gesetzt hat. Die erste Fassung räumte statt dessen
 * „alles Aktivierte ohne Anmeldung" ab — und hätte damit auch eine Aktivierung
 * gelöscht, die ein Admin über die Mitgliederliste vorgenommen hat oder die aus
 * einem echten, eingelösten Zugangslink stammt. Befund aus dem Sicherheits-
 * Review über den Commit, und er sass.
 */
function aktiviertenKreis(ids: string[]): string[] {
  const idx = [
    ...BEITRAEGE.map((b) => b.a),
    ...KOMMENTARE.map((k) => k.a),
    ...TERMINE.map((t) => t.gastgeber),
  ].map((i) => i % ids.length);
  return [...new Set(idx)].sort((x, y) => x - y).map((i) => ids[i]);
}

async function mitglieder(c: pg.Client): Promise<string[]> {
  // Feste Reihenfolge nach `id`: derselbe Lauf ordnet dieselben Sätze denselben
  // Menschen zu. Nach `name` wäre die Zuordnung von der Schreibweise abhängig.
  //
  // OHNE das Vorschau-Konto, und das ist keine Kosmetik: es ist selbst ein
  // Profil, seine Kennung reiht sich irgendwo ein, und jede Zeile dahinter
  // verschöbe sich um eins. Beitrag 7 gehörte beim nächsten Lauf einem anderen
  // Menschen, und `reset` nähme die Aktivierung des Falschen zurück. Die Liste
  // muss genau die importierten Mitglieder sein — sonst hängt die Zuordnung
  // daran, ob dieser Seed vorher schon einmal lief.
  const { rows } = await c.query<{ id: string }>(
    `select p.id from public.profiles p
       join auth.users u on u.id = p.id
      where u.email <> $1
      order by p.id`,
    [VORSCHAU_ADRESSE],
  );
  return rows.map((r) => r.id);
}

async function seed(c: pg.Client): Promise<void> {
  const ids = await mitglieder(c);
  if (ids.length < 60)
    throw new Error(`Nur ${ids.length} Profile gefunden — das ist nicht der Import.`);
  const autor = (i: number) => ids[i % ids.length];

  console.log(`→ ${ids.length} Mitglieder gefunden`);

  // 1. Wer hat beigetragen? Genau die werden aktiviert — siehe die Notiz oben.
  const zuAktivieren = aktiviertenKreis(ids);
  const aktivIdx = zuAktivieren.map((id) => ids.indexOf(id));

  await c.query(
    `update public.profiles set activated_at = now() - interval '30 days'
      where id = any($1::uuid[]) and activated_at is null`,
    [zuAktivieren],
  );
  console.log(
    `→ aktiviert: ${zuAktivieren.length} (alle mit Beitrag, Kommentar oder Termin), ` +
      `unbestätigt: ${ids.length - zuAktivieren.length}`,
  );

  /** Likes und Anmeldungen ausschliesslich aus dem bestätigten Kreis. */
  const aktiv = (n: number) => ids[aktivIdx[n % aktivIdx.length]];

  // 2. Beiträge.
  for (const [i, b] of BEITRAEGE.entries()) {
    await c.query(
      `insert into public.posts (id, author_id, body, hashtags, visibility, created_at)
       values ($1, $2, $3, $4, $5, now() - make_interval(hours => $6))
       on conflict (id) do update set body = excluded.body, hashtags = excluded.hashtags,
         visibility = excluded.visibility, created_at = excluded.created_at`,
      [
        kennung("a", i),
        autor(b.a),
        b.text,
        b.tags,
        b.oeffentlich ? "public" : "members",
        b.stunden,
      ],
    );
  }
  console.log(`→ Beiträge: ${BEITRAEGE.length}`);

  // 3. Kommentare.
  for (const [i, k] of KOMMENTARE.entries()) {
    await c.query(
      `insert into public.comments (id, post_id, author_id, body, created_at)
       values ($1, $2, $3, $4, now() - make_interval(hours => $5))
       on conflict (id) do update set body = excluded.body, created_at = excluded.created_at`,
      [kennung("b", i), kennung("a", k.beitrag), autor(k.a), k.text, k.stunden],
    );
  }
  console.log(`→ Kommentare: ${KOMMENTARE.length}`);

  // 4. Likes — gestreut, damit nicht jeder Beitrag gleich beliebt wirkt.
  let likes = 0;
  for (let i = 0; i < BEITRAEGE.length; i++) {
    const anzahl = 2 + ((i * 5) % 7);
    for (let k = 0; k < anzahl; k++) {
      const r = await c.query(
        `insert into public.post_likes (post_id, profile_id) values ($1, $2)
         on conflict do nothing`,
        [kennung("a", i), aktiv(i * 3 + k * 5 + 1)],
      );
      likes += r.rowCount ?? 0;
    }
  }
  console.log(`→ Likes: ${likes}`);

  // 5. Termine. `at time zone` bindet an den Tagesbeginn in Europe/Berlin —
  //    `now() + interval '9 hours'` ergäbe ein Frühstück zur aktuellen Uhrzeit.
  for (const [i, t] of TERMINE.entries()) {
    await c.query(
      `insert into public.events (id, title, type, starts_at, ends_at, location, host_id,
                                  visibility, capacity, description)
       values ($1, $2, $3,
         ((date_trunc('day', now() at time zone 'Europe/Berlin') + make_interval(days => $4, hours => $5)) at time zone 'Europe/Berlin'),
         ((date_trunc('day', now() at time zone 'Europe/Berlin') + make_interval(days => $4, hours => $6)) at time zone 'Europe/Berlin'),
         $7, $8, 'members', $9, $10)
       on conflict (id) do update set title = excluded.title, type = excluded.type,
         starts_at = excluded.starts_at, ends_at = excluded.ends_at, location = excluded.location,
         capacity = excluded.capacity, description = excluded.description`,
      [
        kennung("c", i),
        t.titel,
        t.art,
        t.tage,
        t.stunde,
        t.bis,
        t.ort,
        autor(t.gastgeber),
        t.plaetze,
        t.beschreibung,
      ],
    );
    for (let k = 0; k < t.anmeldungen; k++) {
      await c.query(
        `insert into public.event_registrations (event_id, profile_id, status)
         values ($1, $2, $3) on conflict (event_id, profile_id) do nothing`,
        [kennung("c", i), aktiv(i * 7 + k + 1), k < t.plaetze ? "registered" : "waitlist"],
      );
    }
  }
  console.log(`→ Termine: ${TERMINE.length}`);

  // 6. Die Ankündigungen im Feed staffeln. Der Trigger schreibt sie beim
  //    Anlegen mit dem Zeitpunkt des Seedens — sonst steht ein Achterblock
  //    „vor 2 Minuten" oben im Feed und liest sich wie ein Datenimport.
  for (const [i] of TERMINE.entries()) {
    await c.query(
      `update public.posts set created_at = now() - make_interval(days => $2)
        where kind = 'event' and ref_id = $1`,
      [kennung("c", i), 14 - i],
    );
  }
}

async function reset(c: pg.Client): Promise<void> {
  const like = `${PRAEFIX}-%`;

  // Die Bilder ZUERST, solange die Events noch stehen: der Pfad hängt an der
  // `host_id` des Events, und nach dem Löschen wäre er nicht mehr zu ermitteln.
  // Ohne diesen Schritt blieben acht Objekte im Bucket liegen, auf die keine
  // Zeile mehr zeigt — der dritte Befund des Sicherheits-Reviews.
  await bilderEntfernen(c);

  const p = await c.query(`delete from public.posts where id::text like $1`, [like]);
  const e = await c.query(`delete from public.events where id::text like $1`, [like]);

  // Nur zurücknehmen, was DIESER Seed gesetzt hat — der Kreis wird aus denselben
  // Inhalten berechnet wie beim Anlegen. Wer sich angemeldet hat, bleibt in
  // jedem Fall verschont: eine echte Anmeldung ist der stärkste Beleg dafür,
  // dass die Aktivierung nicht von hier stammt.
  const ids = await mitglieder(c);
  const a = await c.query(
    `update public.profiles p set activated_at = null
      where p.id = any($1::uuid[])
        and p.activated_at is not null
        and not exists (select 1 from auth.users u where u.id = p.id and u.last_sign_in_at is not null)`,
    [aktiviertenKreis(ids)],
  );
  // Das Vorschau-Konto gehört zu diesem Lauf und geht mit ihm. Die Adresse
  // endet auf `.invalid` und kann deshalb kein echtes Mitglied treffen.
  const v = await c.query(`delete from auth.users where email = $1`, [VORSCHAU_ADRESSE]);
  console.log(
    `→ entfernt: ${p.rowCount} Beiträge, ${e.rowCount} Termine, ${v.rowCount} Vorschau-Konto; ` +
      `${a.rowCount} Aktivierungen zurückgenommen`,
  );
}

async function serviceKey(): Promise<string | null> {
  const pat = process.env.SUPABASE_ACCESS_TOKEN;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!pat) return null;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ZIEL_PROJEKT}/api-keys`, {
    headers: { Authorization: `Bearer ${pat}` },
  });
  if (!r.ok) return null;
  const keys = (await r.json()) as Array<{ name: string; api_key: string }>;
  return keys.find((k) => k.name === "service_role")?.api_key ?? null;
}

/** Titelbilder. Ohne sie ist die Terminliste eine Reihe grauer Kästen. */
async function titelbilder(c: pg.Client): Promise<void> {
  const key = await serviceKey();
  const basis = process.env.VITE_SUPABASE_URL_IMPORT ?? `https://${ZIEL_PROJEKT}.supabase.co`;
  if (!key) {
    console.log("→ Titelbilder übersprungen: kein service_role-Schlüssel erreichbar.");
    return;
  }
  for (const [i, t] of TERMINE.entries()) {
    const { rows } = await c.query<{ host_id: string }>(
      `select host_id from public.events where id = $1`,
      [kennung("c", i)],
    );
    const host = rows[0]?.host_id;
    if (!host) continue;
    // Erstes Pfadsegment MUSS die host_id sein, sonst ist das Bild nicht
    // signierbar und bleibt ein grauer Kasten ohne Fehlermeldung.
    const pfad = `${host}/vorschau-${t.bild}`;
    const r = await fetch(`${basis}/storage/v1/object/${BUCKET}/${pfad}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        "Content-Type": "image/webp",
        "x-upsert": "false",
      },
      // AGE-599: zugeschnitten statt roh. Die Datei in `public/images/` ist ein
      // Seitenkopf (1,50:1 bzw. 1,33:1); im 3:1-Feld der Event-Kachel stünde
      // sie mit rund 25 % freier Fläche je Seite — Material, das das Produkt
      // selbst nie herstellt.
      body: new Uint8Array(await titelbildZuschnitt(join(BILDER, t.bild))),
    });
    if (!r.ok && r.status !== 409) {
      const text = await r.text();
      if (!text.includes("already exists")) throw new Error(`Upload ${pfad}: ${r.status} ${text}`);
    }
    await c.query(`update public.events set cover_path = $1 where id = $2`, [
      pfad,
      kennung("c", i),
    ]);
  }
  console.log(`→ Titelbilder: ${TERMINE.length}`);
}

/**
 * Ein Zugang zum Anschauen.
 *
 * WARUM ÜBERHAUPT: auf dieses Projekt zeigt keine gebaute Fläche, und die
 * echten Mitglieder haben Passwörter, die weder bekannt sind noch angefasst
 * werden dürfen. Ohne ein eigenes Konto lässt sich der Bestand also gar nicht
 * ansehen — und ein Seed, den niemand betrachten kann, erfüllt seinen Zweck
 * nicht.
 *
 * Die Adresse endet auf `.invalid` (RFC 2606): sie ist nicht zustellbar und
 * damit unverwechselbar synthetisch. Das Konto bekommt `admin`, weil sonst die
 * Admin-Mitgliederliste — der Anlass dieses ganzen Changes — nicht zu sehen ist.
 *
 * DAS PASSWORT WIRD EINMAL AUSGEGEBEN UND NIRGENDS ABGELEGT. Es gehört nicht
 * ins Repository: dieses Projekt trägt die Daten echter Menschen, anders als
 * die Demo-Welt.
 *
 * Zwei Fallen, beide in diesem Projekt schon getreten:
 *   - Ohne `email_confirm` scheitert die Anmeldung NACH der Aktivierung.
 *   - Der Trigger legt die Profilzeile beim Anlegen an; Profilfelder müssen
 *     danach per UPDATE kommen, ein INSERT käme nie an.
 */
async function vorschauKonto(c: pg.Client): Promise<void> {
  const key = await serviceKey();
  if (!key) {
    console.log("→ Vorschau-Konto übersprungen: kein service_role-Schlüssel erreichbar.");
    return;
  }
  const basis = `https://${ZIEL_PROJEKT}.supabase.co`;
  const adresse = VORSCHAU_ADRESSE;
  const { rows } = await c.query<{ id: string }>(`select id from auth.users where email = $1`, [
    adresse,
  ]);
  if (rows.length > 0) {
    console.log(`→ Vorschau-Konto besteht bereits (${adresse}), Passwort unverändert.`);
    return;
  }
  const passwort = `Vorschau-${Math.abs(Date.parse(new Date().toISOString()) % 100000)}-${Buffer.from(
    crypto.getRandomValues(new Uint8Array(9)),
  ).toString("base64url")}`;
  const r = await fetch(`${basis}/auth/v1/admin/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email: adresse, password: passwort, email_confirm: true }),
  });
  if (!r.ok) throw new Error(`Vorschau-Konto: ${r.status} ${await r.text()}`);
  const { id } = (await r.json()) as { id: string };
  await c.query(
    `update public.profiles set name = 'Vorschau (kein echtes Mitglied)', tier = 'impact',
        activated_at = now(), is_public = false where id = $1`,
    [id],
  );
  await c.query(
    `insert into public.staff_roles (profile_id, role) values ($1, 'admin') on conflict do nothing`,
    [id],
  );
  console.log(`\n  ┌─ Vorschau-Zugang (einmalige Ausgabe, steht in keiner Datei) ─`);
  console.log(`  │  ${adresse}`);
  console.log(`  │  ${passwort}`);
  console.log(`  └─────────────────────────────────────────────────────────────\n`);
}

/**
 * Die hochgeladenen Titelbilder wieder aus dem Bucket nehmen.
 *
 * Ein Objekt im Storage hängt an keiner Fremdschlüsselbeziehung — es überlebt
 * das Löschen seines Events klaglos und wäre danach nur noch über den rohen
 * Pfad auffindbar. Deshalb hier, VOR dem Löschen der Events, und nur die Pfade
 * dieses Seeds (`vorschau-`).
 */
async function bilderEntfernen(c: pg.Client): Promise<void> {
  const key = await serviceKey();
  if (!key) {
    console.log("→ Titelbilder NICHT entfernt: kein service_role-Schlüssel erreichbar.");
    return;
  }
  const { rows } = await c.query<{ cover_path: string }>(
    `select cover_path from public.events
      where id::text like $1 and cover_path is not null`,
    [`${PRAEFIX}-%`],
  );
  if (rows.length === 0) return;
  const r = await fetch(`https://${ZIEL_PROJEKT}.supabase.co/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: rows.map((x) => x.cover_path) }),
  });
  if (!r.ok) throw new Error(`Bilder entfernen: ${r.status} ${await r.text()}`);
  console.log(`→ Titelbilder aus dem Bucket entfernt: ${rows.length}`);
}

async function bilanz(c: pg.Client): Promise<void> {
  const { rows } = await c.query(`select
      (select count(*) from public.profiles) profile,
      (select count(*) from public.profiles where activated_at is not null) aktiviert,
      (select count(*) from public.posts) beitraege,
      (select count(*) from public.posts where video_url is not null) academy,
      (select count(*) from public.comments) kommentare,
      (select count(*) from public.post_likes) likes,
      (select count(*) from public.events where starts_at > now()) kommende_termine,
      (select count(*) from public.event_registrations) anmeldungen`);
  console.table(rows[0]);
}

async function main(): Promise<void> {
  const modus = optIn();
  const url = process.env.SUPABASE_DB_URL_PROD;
  if (!url)
    throw new Error("SUPABASE_DB_URL_PROD fehlt (per `infisical run --env=prod` einspielen).");
  zielPruefen(url);

  console.log(`\nImport-Vorschau — Modus: ${modus}`);
  console.log(`Ziel: Projekt ${ZIEL_PROJEKT} (die ECHTEN Mitglieder)\n`);

  const c = new pg.Client({ connectionString: url, ssl: tls() });
  await c.connect();
  try {
    if (modus === "reset") await reset(c);
    else {
      await seed(c);
      await titelbilder(c);
      await vorschauKonto(c);
    }
    await bilanz(c);
    console.log(`\n✓ ${modus} fertig.`);
  } finally {
    await c.end();
  }
}

main().catch((err: unknown) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
