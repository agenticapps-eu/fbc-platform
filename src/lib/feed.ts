import { captureException } from "@sentry/react";

import { type Json } from "./database.types";
import { POST_MEDIA_BUCKET, uploadPostMedia, type PostMediaEingabe } from "./post-media";
import { supabase } from "./supabase";
import { tokenizePostBody } from "./video-url";

/**
 * Community-Feed (AGE-250) — Datenschicht. Spec: docs/community-events-spec.md §1.
 *
 * Der Client macht NUR, was die RLS (§7 der RLS-Policies) erlaubt:
 *  - `fetchFeed` liest `posts` (Sichtbarkeit erzwingt `posts_select_by_visibility`:
 *    anon nur 'public', 'members' ab Rang 4 `exchange`). Autoren werden über die
 *    View `profiles_public` angereichert.
 *  - Like-/Kommentarzähler kommen aus der read-only RPC `post_engagement_counts`,
 *    weil `post_likes` bewusst owner-only lesbar ist (20260612090845) — ein echter
 *    Zähler ist sonst clientseitig nicht berechenbar. Die RPC liefert nur Zahlen.
 *  - `likedByMe` aus den eigenen `post_likes`-Zeilen (alles, was die owner-only
 *    SELECT-Policy zurückgibt).
 *  - Schreiben: `toggleLike`/`addComment` über die `*_own`-Policies; ein Beitrag
 *    entsteht über die RPC `create_post_with_media`, damit er nie ohne seine
 *    Bilder im Feed steht (AGE-528). `posts_write_own` bleibt daneben bestehen.
 *
 * Reine Helfer (Hashtag-/Body-Parsing, Video-Erkennung) sind in feed.test.ts getestet.
 */

/** Spiegelt `posts_visibility_check` (20260715150000_six_level_model.sql:265). */
export type PostVisibility = "public" | "members";

/**
 * Spiegelt `posts_kind_check` (20260813100000). Bewusst eine geschlossene Menge
 * und nicht `string`, obwohl der Typgenerator für eine `text`-Spalte `string`
 * liefert: die Feed-Liste verzweigt auf diesen Wert, und eine dritte Ausprägung
 * soll beim Übersetzen auffallen statt still als Mitgliedsbeitrag zu erscheinen
 * (Befund opencode im Diff-Review, LOW). Verengt wird an der Grenze, in
 * `fetchFeed`.
 */
export type PostKind = "member" | "event";

/**
 * Die drei Reiter des Feeds (AGE-582).
 *
 * `meine` und `gespeichert` VERLANGEN eine Kennung — sie sind keine Filter, die
 * ohne Kennung eben nicht greifen. Siehe den Waechter in `fetchFeed`.
 */
export type FeedReiter = "alle" | "meine" | "gespeichert";

/**
 * Die drei Ordnungen. Jede hat ihren EIGENEN Keyset-Pfad; keine entsteht durch
 * blosses Umdrehen der Sortierrichtung einer anderen, weil der Cursor-Ausdruck
 * mitdrehen muss (`lt` gegen `gt`) und bei `beliebteste` ein Feld mehr traegt.
 */
export type FeedOrdnung = "neueste" | "aelteste" | "beliebteste";

/**
 * Beitragstyp. ABGELEITET aus dem Bestand, nicht als zusaetzliches Feld am
 * Beitrag gefuehrt: Video an `video_url`, Event an `kind`, Bild am Vorhandensein
 * einer `post_media`-Zeile, Text als Beitrag ohne all das. Ein eigenes Feld
 * waere eine zweite Wahrheit, die mit der ersten auseinanderlaufen kann.
 */
export type FeedTyp = "bild" | "video" | "event" | "text";

export interface FeedAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  tier: string | null;
  /**
   * Der Urheber ist kein Mitglied mehr — deaktiviert ODER gelöscht (AGE-581).
   *
   * OPTIONAL, und das ist Absicht: die beiden Lesepfade hier setzen das Feld
   * ausnahmslos, aber `FeedAuthor` wird auch in Test-Fixtures gebaut, und ein
   * Pflichtfeld zwänge dort zehn Dateien zu einer Antwort auf eine Frage, die
   * sie nicht stellen. Fehlt es, gilt „nicht entfernt" — die harmlose
   * Richtung: der Autor behält höchstens seinen Namen, er bekommt keinen.
   *
   * WELCHE der beiden Handlungen ein Admin vorgenommen hat, steht hier
   * bewusst NICHT. Das geht einen Leser des Feeds so wenig an wie den
   * Betroffenen selbst (`my_activation_state.blocked`, dieselbe Entscheidung).
   */
  former?: boolean;
}

/** Ein Bild des Beitrags. Die Maße stehen hier, damit die Karte ihr Layout
 *  bestimmen kann, ohne die Datei zu laden (AGE-528). Der Pfad zeigt in den
 *  PRIVATEN Bucket — sichtbar wird er erst über `signPostMedia`. */
export interface FeedMedia {
  storagePath: string;
  sort: number;
  width: number;
  height: number;
}

/**
 * Das bezogene Event eines Beitrags mit `kind = 'event'` (AGE-533).
 *
 * Diese Felder stehen NICHT am Beitrag — sie kommen bei jedem Abruf frisch aus
 * `events`. Genau darin liegt die Zusage: ein umbenanntes Event ändert die
 * Feed-Darstellung sofort, ohne dass irgendwo etwas nachgezogen wird.
 */
export interface FeedEvent {
  id: string;
  title: string;
  startsAt: string | null;
  location: string | null;
  /** Pfad im PRIVATEN Bucket `event-covers`, keine URL — siehe event-cover.ts. */
  coverPath: string | null;
}

export interface FeedPost {
  id: string;
  author: FeedAuthor;
  body: string;
  hashtags: string[];
  visibility: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  /**
   * Der Betrachter hat den Beitrag gespeichert (AGE-582).
   *
   * PFLICHTFELD, anders als `former` daneben — und aus demselben Grund, aus dem
   * `likedByMe` eines ist: es traegt einen Knopf, dessen falscher Zustand dem
   * Mitglied etwas ueber seine eigene Handlung vorluegt. Ein weggelassenes Feld
   * hiesse hier „nicht gespeichert", und das ist keine harmlose Richtung,
   * sondern die Haelfte der moeglichen Luegen.
   */
  savedByMe: boolean;
  media: FeedMedia[];
  /**
   * Erste einbettbare Video-URL des Beitrags — aus der Spalte `posts.video_url`,
   * die ein Trigger aus dem Body ableitet (AGE-533, 20260813090000).
   *
   * Die Karte bettet DIESEN Wert ein und parst den Body nicht erneut. Sonst
   * gäbe es zwei Quellen fürs Rendern, und die Academy (die über die Spalte
   * filtert) könnte Beiträge zeigen, deren Karte etwas anderes einbettet.
   */
  videoUrl: string | null;
  /** `member` (Default) oder `event` — ein vom Trigger erzeugter Event-Beitrag. */
  kind: PostKind;
  /**
   * Das bezogene Event, zur Laufzeit gejoint. `null` heißt eines von zwei
   * Dingen: gewöhnlicher Beitrag, oder das Event ist für den Betrachter nicht
   * lesbar (die RLS von `events` wertet die Einbettung selbst aus). Im zweiten
   * Fall entfällt die Karte, statt leer zu erscheinen.
   */
  event: FeedEvent | null;
}

export interface FeedComment {
  id: string;
  postId: string;
  author: FeedAuthor;
  body: string;
  createdAt: string;
}

// ── reine Helfer (getestet) ─────────────────────────────────────────────────

/**
 * Textzerlegung und Video-Erkennung liegen seit AGE-533 in `./video-url` und
 * werden hier unverändert weitergereicht — jeder bisherige Import aus
 * `lib/feed` bleibt gültig.
 *
 * Der Grund für den Schnitt steht dort: dieses Modul baut beim Laden den
 * Supabase-Client und ist außerhalb von Vite nicht importierbar. Seit C9
 * leitet die Datenbank `posts.video_url` über `public.erste_video_url()` ab,
 * und die Parität der beiden Erkenner wird von einem Node-Skript gemessen —
 * das braucht den kanonischen Parser ohne diesen Rattenschwanz.
 */
export {
  extractFirstVideo,
  ohneSchlussHashtags,
  parseVideoUrl,
  tokenizePostBody,
  type PostSegment,
} from "./video-url";

/** Hashtags eines Beitrags: klein normalisiert, dedupliziert, Reihenfolge erhalten. */
export function parseHashtags(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const seg of tokenizePostBody(body)) {
    if (seg.type === "hashtag" && !seen.has(seg.value)) {
      seen.add(seg.value);
      out.push(seg.value);
    }
  }
  return out;
}

// ── Erwähnungen auflösen ──────────────────────────────────────────────────

export type MentionResolver = (handle: string) => string | null;

/** Name/Handle → reine Kleinbuchstaben+Ziffern (für @-Matching, umlautfest). */
function mentionSlug(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Baut einen Resolver, der eine Erwähnung (@handle) auf eine Profil-ID der
 * übergebenen Autoren abbildet — über den Slug des vollen Namens UND des
 * Vornamens. Best-effort (Spec: „optional auflösen"): leerer Slug wird ignoriert,
 * bei Vornamens-Kollisionen gewinnt der erste Autor; kein Treffer → null.
 */
export function buildMentionResolver(authors: FeedAuthor[]): MentionResolver {
  const byHandle = new Map<string, string>();
  for (const author of authors) {
    if (!author.name) continue;
    const full = mentionSlug(author.name);
    if (full && !byHandle.has(full)) byHandle.set(full, author.id);
    const first = mentionSlug(author.name.trim().split(/\s+/)[0] ?? "");
    if (first && !byHandle.has(first)) byHandle.set(first, author.id);
  }
  return (handle) => {
    const key = mentionSlug(handle);
    return key ? (byHandle.get(key) ?? null) : null;
  };
}

// ── Query-Keys & Optionen ───────────────────────────────────────────────────

/**
 * Query-Keys sind nach `uid` getrennt: Sichtbarkeit hängt am Principal (tier-
 * gegated über RLS), also darf der Cache eines Mitglieds NICHT an ein anderes
 * (z. B. nach Logout/Account-Wechsel) ausgespielt werden. Der `uid`-Präfix
 * trennt die Cache-Einträge je Betrachter sauber.
 */
export const feedListKey = (uid: string | null) => ["feed", "list", uid] as const;
export const feedQueryKey = (uid: string | null, hashtag: string | null) =>
  ["feed", "list", uid, hashtag] as const;

/**
 * Der seitenweise Feed braucht einen EIGENEN Schlüssel (AGE-528).
 *
 * `feedQueryKey` liegt bei Startseite und Mitglieder-Übersicht auf einem
 * `useQuery` und trägt dort `{posts, nextCursor}`. Der Feed selbst ist eine
 * `useInfiniteQuery` und trägt `{pages, pageParams}`. Unter demselben Schlüssel
 * ist ein Eintrag für den anderen unlesbar: `data.pages` wäre `undefined`,
 * `isLoading` aber false — der Feed malte den leeren Zustand über einen vollen
 * Feed, und die Startseite verlöre umgekehrt ihre Beiträge.
 *
 * Das Anhängsel steht am ENDE, damit `feedListKey` weiter als Präfix greift:
 * eine Invalidierung nach dem Veröffentlichen erreicht beide Formen. Genau
 * daran haengt auch 5.11 — Speichern und Lösen schreiben Kartenzustand UND den
 * Reiter „Gespeichert" gemeinsam fort, weil eine Invalidierung über den Präfix
 * jede Auswahl erreicht und nicht nur die gerade sichtbare.
 *
 * Der Schlüssel trägt die GANZE Auswahl (AGE-582), nicht nur den Tag: Reiter,
 * Ordnung, normalisierte Tagmenge und Typ. Fehlte eines davon, verwendete ein
 * Wechsel die Seiten der alten Auswahl weiter — bei „Beliebteste" nach
 * „Neueste" wären das Beiträge in einer Reihenfolge, die nie angefragt wurde.
 */
export interface FeedAuswahl {
  reiter: FeedReiter;
  ordnung: FeedOrdnung;
  tags: string[];
  typ: FeedTyp | null;
}

/**
 * Kanonische Form einer Tagmenge: ohne Dubletten, sortiert.
 *
 * Der Schluessel darf nicht davon abhaengen, in welcher Reihenfolge die Haken
 * gesetzt wurden — sonst laedt ein Klick, der nur die Reihenfolge dreht, dieselbe
 * Auswahl ein zweites Mal.
 */
const normalisierteTags = (tags: string[]) => [...new Set(tags)].sort();

export const feedSeitenKey = (uid: string | null, auswahl: FeedAuswahl) =>
  [
    "feed",
    "list",
    uid,
    normalisierteTags(auswahl.tags),
    auswahl.reiter,
    auswahl.ordnung,
    auswahl.typ,
    "seiten",
  ] as const;
/**
 * Der EINE Beitrag hinter `?post=<id>` (AGE-587).
 *
 * Liegt bewusst UNTER `feedListKey` — dem Präfix, den Reaktion, Speichern und
 * Kommentar entwerten. Ein Schlüssel daneben hiesse: eine Reaktion auf den
 * vorangestellten Beitrag lässt ihn veraltet stehen, der Knopf sagt weiter
 * „Speichern", und der zweite Klick schickt dieselbe Operation noch einmal
 * (Diff-Review codex). Derselbe Fehler, den dieser Change bei den Zählern der
 * Reiter schon einmal vermieden hat.
 *
 * `feedSeitenKey` bleibt davon unberührt: der Parameter steht dort NICHT drin,
 * sonst verwürfe jeder Deeplink den geladenen Feed.
 */
export const postDeeplinkQueryKey = (uid: string | null, postId: string) =>
  [...feedListKey(uid), "einzeln", postId] as const;

export const commentsQueryKey = (uid: string | null, postId: string) =>
  ["feed", "comments", uid, postId] as const;

/**
 * Sichtbarkeitsstufen für den Composer (Default `members`).
 *
 * Gestufte Beitrags-Sichtbarkeit gibt es im MVP nicht (AGE-311): die Stufung sitzt in
 * der RLS — `members` ist ab Rang 4 (`exchange`) lesbar —, nicht im Wert. Wer hier eine
 * Option ergänzt, ändert zuerst `posts_visibility_check`, sonst scheitert das Speichern.
 */
export const VISIBILITY_OPTIONS: { value: PostVisibility; label: string }[] = [
  { value: "members", label: "Mitglieder" },
  { value: "public", label: "Öffentlich" },
];

// ── Lesen ────────────────────────────────────────────────────────────────────

/**
 * Der Autor aus der Anreicherung — oder der Rückfall, wenn er dort fehlt.
 *
 * DER RÜCKFALL HEISST „Ein Mitglied", NICHT „Mitglied" (AGE-581, entschieden
 * am 24.08.). Er trifft ein Mitglied, das da ist und sich nur zurückgezogen
 * hat: `is_public = false` oder nie bestätigt. Ausgeloggt maskiert
 * `displayAuthor` auf denselben Text (AGE-530) — beides ist derselbe
 * Sachverhalt, also trägt es denselben Namen. Ein entferntes Mitglied fällt
 * NICHT hierher: es geht über `former_member_entries` und heisst
 * „Ehemaliges Mitglied".
 *
 * Der Rest des Hauses schreibt weiterhin `?? "Mitglied"` (Chat, Events,
 * Verzeichnis, Matching …). Das ist keine Nachlässigkeit, sondern der Umfang:
 * die Unterscheidung wird im Feed gebraucht, und nur dort steht ihr
 * Gegenstück.
 */
function authorOf(byId: Map<string, FeedAuthor>, id: string): FeedAuthor {
  return byId.get(id) ?? { id, name: "Ein Mitglied", avatarUrl: null, tier: null, former: false };
}

/** Der Urheber ist entfernt: kein Name, kein Bild, keine Stufe (AGE-581). */
function ehemaligesMitglied(id: string): FeedAuthor {
  return { id, name: "Ehemaliges Mitglied", avatarUrl: null, tier: null, former: true };
}

/**
 * Höchstens so viele IDs je Aufruf — die Grenze steht in der Funktion selbst
 * (`20260823160000_former_member_entries.sql`, `errcode 22023`) und wird hier
 * eingehalten, statt sie auszulösen.
 */
const FORMER_GRENZE = 200;

/**
 * Welche dieser Einträge stammen von einem entfernten Mitglied?
 *
 * Der Feed kann das nicht selbst sehen: aus `profiles_public` ist ein
 * entferntes Profil verschwunden, aber ein fehlender Treffer heisst dort schon
 * etwas anderes („zurückgezogen"). Die Unterscheidung liegt in einer
 * `SECURITY DEFINER`-Funktion, die BEITRAGS- und KOMMENTAR-IDs nimmt und den
 * Urheber selbst auflöst — nicht Profil-IDs, sonst wäre sie ein Weg, den
 * Bestand nach Entfernten durchzufragen.
 *
 * OHNE SESSION wird nicht gefragt (10.2, dieselbe Regel wie AGE-530):
 * `execute` liegt bei `authenticated`, `anon` ist es entzogen.
 *
 * BEST EFFORT wie Zähler und Bilder: schlägt die Auskunft fehl, behält der
 * Feed seine Beiträge, und die betroffenen Autoren heissen „Ein Mitglied"
 * statt „Ehemaliges Mitglied". Das gibt KEINEN Namen preis — wer entfernt ist,
 * steht ohnehin nicht in `profiles_public`. Still ist es trotzdem nicht: der
 * Fehler geht an Sentry.
 */
async function fetchFormerEntries(
  uid: string | null,
  art: "post" | "comment",
  ids: string[],
): Promise<Set<string>> {
  const entfernt = new Set<string>();
  if (!uid || ids.length === 0) return entfernt;
  // In Blöcken, weil ein langer Kommentarfaden die Grenze reissen kann:
  // `fetchComments` holt ALLE Kommentare eines Beitrags, ungedeckelt. Ein
  // einziger Aufruf mit 201 IDs käme als `22023` zurück und nähme dem ganzen
  // Faden die Unterscheidung — auch den ersten zweihundert.
  for (let i = 0; i < ids.length; i += FORMER_GRENZE) {
    const teil = ids.slice(i, i + FORMER_GRENZE);
    const { data, error } = await supabase.rpc("former_member_entries", {
      p_post_ids: art === "post" ? teil : [],
      p_comment_ids: art === "comment" ? teil : [],
    });
    if (error) {
      captureException(error, { tags: { area: "feed.former" } });
      return entfernt;
    }
    for (const zeile of data ?? []) if (zeile.former) entfernt.add(zeile.entry_id);
  }
  return entfernt;
}

/**
 * Autoren aus `profiles_public` (nur öffentliche Spalten, für authenticated lesbar).
 * Best-effort: ist ein Autor nicht öffentlich, bleibt es beim Fallback „Mitglied" —
 * der Feed bricht dadurch nie ab.
 *
 * OHNE Session wird gar nicht erst gefragt (AGE-530): `profiles_public` trägt für
 * `anon` bewusst kein Leserecht (AGE-239), die Abfrage käme also als `42501`
 * zurück. Das ist KEINE Sicherheitsgrenze — die bleibt das fehlende Recht, und die
 * Maskierung der Anzeige bleibt `displayAuthor`. Hier wird nur nichts gefragt, was
 * gesichert abgewiesen wird.
 */
export async function fetchAuthors(
  uid: string | null,
  ids: string[],
): Promise<Map<string, FeedAuthor>> {
  const byId = new Map<string, FeedAuthor>();
  if (!uid || ids.length === 0) return byId;
  const { data, error } = await supabase
    .from("profiles_public")
    .select("id, name, avatar_url, tier")
    .in("id", ids);
  if (error) return byId;
  for (const p of data ?? []) {
    if (!p.id) continue; // profiles_public ist eine View → id ist nullable im Typ.
    byId.set(p.id, {
      id: p.id,
      name: p.name ?? "Mitglied",
      avatarUrl: p.avatar_url,
      tier: p.tier,
      // ABGELEITET, nicht geraten: die View schliesst `disabled_at` und
      // `deleted_at` seit AGE-581 selbst aus (20260823120000, Zeile 234). Wer
      // hier auftaucht, kann kein entferntes Mitglied sein.
      former: false,
    });
  }
  return byId;
}

/** Seitengröße des Feeds. Eine feste Obergrenze ohne Nachladen wäre mit Bildern
 *  eine stille Kappung — ältere Beiträge wären unauffindbar (AGE-528). */
export const FEED_SEITE = 20;

/**
 * Der Cursor läuft über **(created_at, id)**, nicht über `created_at` allein.
 * Bei gleichen Zeitstempeln — beim Import der ~70 Konten der wahrscheinliche
 * Fall — überspränge eine reine Zeitgrenze den zweiten Beitrag still: er stünde
 * weder auf der einen noch auf der nächsten Seite.
 */
export interface FeedCursor {
  createdAt: string;
  id: string;
  /**
   * Nur in der Ordnung „Beliebteste" belegt — dort führt `like_count`, und eine
   * Grenze über `created_at` allein überspränge bei gleicher Reaktionszahl
   * still Beiträge. In den beiden Zeit-Ordnungen fehlt das Feld absichtlich:
   * ein Cursor, der Felder einer FREMDEN Ordnung trägt, sähe gültig aus.
   */
  likeCount?: number;
}

export interface FeedSeite {
  posts: FeedPost[];
  /** `null` heißt: es gibt nichts mehr nachzuladen. */
  nextCursor: FeedCursor | null;
}

export interface FetchFeedArgs {
  /** Eigene Profil-ID (für `likedByMe`); null = ausgeloggt. */
  uid: string | null;
  /** Optionaler Hashtag-Filter (normalisiert, ohne #). */
  hashtag?: string | null;
  /** Weiterlesen ab hier; fehlt er, beginnt die erste Seite. */
  cursor?: FeedCursor | null;
  /**
   * Nur Beiträge mit Video — die Academy (AGE-533).
   *
   * Die Academy bekommt bewusst KEINE eigene Ladefunktion: sie stellt dieselbe
   * Abfrage wie der Feed, nur mit einem Filter mehr. Eine zweite Funktion
   * müsste Autoren-Anreicherung, Zähler und den Keyset-Cursor nachbauen — und
   * damit dreimal dieselbe Regel pflegen.
   */
  nurVideos?: boolean;
  /** Nur Beiträge dieses Autors — das Regal „selbst geteilt". */
  autorId?: string | null;
  /**
   * GENAU EIN Beitrag, über seine Kennung (AGE-587). Der Weg für den Deeplink
   * `?post=<id>`.
   *
   * Auch das bekommt keine eigene Ladefunktion, aus demselben Grund wie
   * `nurVideos`: es ist dieselbe Abfrage mit einem Filter mehr, und eine zweite
   * Funktion müsste Autoren-Anreicherung, Zähler, Medien und die entfernten
   * Mitglieder nachbauen. Die RLS entscheidet wie überall — ein unsichtbarer
   * Beitrag liefert null Zeilen, genau wie ein erfundener.
   */
  postId?: string | null;
  /**
   * Der Reiter (AGE-582). Vorgabe „alle" — der einzige, den es ohne Sitzung
   * gibt. Die beiden anderen VERLANGEN `uid`; siehe den Wächter unten.
   */
  reiter?: FeedReiter;
  /** Die Ordnung. Vorgabe „neueste" — der Bestandszustand. */
  ordnung?: FeedOrdnung;
  /**
   * Gewählte Marken, als ODER (`overlaps`). Der Ein-Tag-Filter `hashtag` läuft
   * über denselben Weg und wird hier eingemischt, statt daneben zu bestehen.
   */
  tags?: string[];
  /** Beitragstyp; `null` heißt „alle Typen". */
  typ?: FeedTyp | null;
}

/**
 * Die Spalten einer Feed-Zeile.
 *
 * `post_media(post_id)` steht mit drin, obwohl die Bilder selbst weiter über
 * eine eigene Abfrage kommen: OHNE die Einbettung im `select` kennt PostgREST
 * die Beziehung im Filter nicht, und die Typen „Bild" und „Text" hängen genau
 * daran (`post_media=not.is.null` bzw. `=is.null`).
 */
const FEED_SPALTEN =
  "id, author_id, body, hashtags, visibility, created_at, video_url, kind, ref_id, like_count, post_media(post_id), events!posts_ref_id_fkey(id, title, starts_at, location, cover_path)";

/**
 * Dasselbe mit dem Pflicht-Join auf die EIGENEN Speicherungen — der Reiter
 * „Gespeichert".
 *
 * ZWEI Literale statt eines zusammengesetzten, aus demselben Grund wie unten:
 * supabase-js leitet die Form der Antwort aus dem Literal ab.
 *
 * Und GETRENNT statt immer mitgeführt, weil `anon` auf `post_saves` kein Recht
 * hält. Gemessen am lokalen Stack: die Einbettung nimmt der GANZEN Abfrage die
 * Antwort — HTTP 401, `42501 permission denied for table post_saves` —, sie
 * bleibt nicht etwa leer. Ein Schaufenster ohne Beiträge wäre die Folge.
 *
 * `!inner` heißt: nur Beiträge mit eigener Speicherzeile. Die RLS von
 * `post_saves` gibt ohnehin nur eigene zurück — sie bleibt das Gate, der Join
 * ist der Weg dorthin und keine Nachkorrektur im Client.
 */
const FEED_SPALTEN_GESPEICHERT =
  "id, author_id, body, hashtags, visibility, created_at, video_url, kind, ref_id, like_count, post_media(post_id), post_saves!inner(profile_id), events!posts_ref_id_fkey(id, title, starts_at, location, cover_path)";

/**
 * Der Keyset-Ausdruck der jeweiligen Ordnung.
 *
 * Je Ordnung ein eigener Pfad, nicht eine gedrehte Richtung: „Älteste zuerst"
 * braucht `gt` statt `lt`, und „Beliebteste" ein Feld mehr. Bei gleichen Werten
 * im führenden Feld überspränge eine Grenze über dieses Feld allein Beiträge
 * still — sie stünden weder auf der einen noch auf der nächsten Seite.
 */
function cursorAusdruck(ordnung: FeedOrdnung, c: FeedCursor): string {
  if (ordnung === "beliebteste") {
    if (c.likeCount === undefined) {
      // Laut statt still: sonst entstünde `like_count.lt.undefined` — eine
      // Anfrage, die der Server abweist oder, schlimmer, anders auslegt.
      throw new Error("Cursor ohne likeCount in der Ordnung \u201Ebeliebteste\u201C");
    }
    return (
      `like_count.lt.${c.likeCount},` +
      `and(like_count.eq.${c.likeCount},created_at.lt.${c.createdAt}),` +
      `and(like_count.eq.${c.likeCount},created_at.eq.${c.createdAt},id.lt.${c.id})`
    );
  }
  const op = ordnung === "aelteste" ? "gt" : "lt";
  return `created_at.${op}.${c.createdAt},and(created_at.eq.${c.createdAt},id.${op}.${c.id})`;
}

/**
 * Die eingebettete Event-Zeile in unsere Form bringen.
 *
 * PostgREST liefert eine n:1-Einbettung je nach Version als Objekt ODER als
 * einelementiges Array; beides wird hier auf dieselbe Form gebracht. `null`
 * bleibt `null` — das ist der Normalfall (gewöhnlicher Beitrag) und zugleich
 * die Antwort der RLS auf ein Event, das der Betrachter nicht sehen darf.
 */
function eventVon(roh: unknown): FeedEvent | null {
  const e = Array.isArray(roh) ? roh[0] : roh;
  if (!e || typeof e !== "object") return null;
  const z = e as Record<string, unknown>;
  if (typeof z.id !== "string" || typeof z.title !== "string") return null;
  return {
    id: z.id,
    title: z.title,
    startsAt: typeof z.starts_at === "string" ? z.starts_at : null,
    location: typeof z.location === "string" ? z.location : null,
    coverPath: typeof z.cover_path === "string" ? z.cover_path : null,
  };
}

/** Lädt eine Feed-Seite (neueste zuerst). Sichtbarkeit erzwingt die RLS. */
export async function fetchFeed({
  uid,
  hashtag,
  cursor,
  nurVideos,
  autorId,
  postId = null,
  reiter = "alle",
  ordnung = "neueste",
  tags,
  typ = null,
}: FetchFeedArgs): Promise<FeedSeite> {
  // DER STILLE FALL, und der Wächter steht VOR der ersten Zeile Anfrage.
  // Ein fehlender Autorenfilter ist kein leerer Filter: `if (uid) query =
  // query.eq("author_id", uid)` liefert ohne Kennung den GANZEN Bestand — also
  // genau das, was der Reiter ausschliessen soll. Heute hat der einzige
  // Aufrufer die Kennung immer; mit einem Reiter entsteht der Weg ohne Absicht.
  if (reiter !== "alle" && !uid) {
    throw new Error(`Reiter \u201E${reiter}\u201C ohne Kennung angefordert`);
  }

  const basis = supabase.from("posts");
  // Das Event wird ÜBER DEN FREMDSCHLÜSSEL eingebettet, nicht kopiert
  // (AGE-533). Der Name `posts_ref_id_fkey` ist in der Migration
  // ausgeschrieben, genau damit das Literal ihn nennen kann. Die RLS von
  // `events` wertet die Einbettung selbst aus — zweite Verteidigungslinie
  // neben der gespiegelten Sichtbarkeit, kein Ersatz dafür.
  // EIN Zeichenketten-Literal je Fall, nicht zusammengesetzt: supabase-js
  // leitet die Form der Antwort aus dem Literal ab. Ein `+` daraus macht
  // `string`, und die eingebettete Zeile faellt auf `GenericStringError`
  // zurueck.
  let query = (
    reiter === "gespeichert" ? basis.select(FEED_SPALTEN_GESPEICHERT) : basis.select(FEED_SPALTEN)
  )
    // EINE Zeile mehr als die Seite trägt: die Spähzeile. Ohne sie ist „volle
    // Seite" das einzige Indiz dafür, dass es weitergeht — und bei genau 20
    // sichtbaren Beiträgen verspricht das eine nächste Seite, die garantiert
    // leer ist. Der Knopf holte sie, bevor er verschwände.
    .limit(FEED_SEITE + 1);

  // Die Ordnung, je einen eigenen Pfad. `like_count` führt nur in
  // „Beliebteste"; `created_at` und `id` entscheiden dort den Gleichstand und
  // sind in den beiden Zeit-Ordnungen selbst die Ordnung.
  if (ordnung === "beliebteste") query = query.order("like_count", { ascending: false });
  const aufsteigend = ordnung === "aelteste";
  query = query
    .order("created_at", { ascending: aufsteigend })
    .order("id", { ascending: aufsteigend });

  // Der Ein-Tag-Filter läuft über denselben Weg wie die Mehrfachauswahl, statt
  // daneben zu bestehen — sonst gäbe es zwei Regeln für dieselbe Frage.
  const gewaehlteTags = normalisierteTags([...(tags ?? []), ...(hashtag ? [hashtag] : [])]);
  // ODER, nicht UND: `contains` verlangt ALLE gewählten Marken am Beitrag.
  // Hinter Auswahlkästchen, die Mehrfachauswahl versprechen, wäre das eine
  // Lüge an der Oberfläche — und bei zwei Haken fast immer eine leere Liste.
  if (gewaehlteTags.length > 0) query = query.overlaps("hashtags", gewaehlteTags);
  // Der Filter sitzt in der ANFRAGE, nicht hinterher im Client: sonst trüge
  // eine Seite von 20 gelesenen Zeilen nur die paar passenden, und „Ältere
  // Beiträge" liefe durch den ganzen Bestand, um eine Seite zu füllen. Das
  // gilt für den Typ und den Reiter genauso wie für die Academy.
  if (nurVideos) query = query.not("video_url", "is", null);
  if (autorId) query = query.eq("author_id", autorId);
  if (postId) query = query.eq("id", postId);
  // `null`, sobald der Reiter ein anderer ist — und belegt, sobald er „meine"
  // ist, weil der Wächter oben nichts anderes durchlässt.
  const nurVonMir = reiter === "meine" ? uid : null;
  if (nurVonMir) query = query.eq("author_id", nurVonMir);

  // Der Typ kommt aus dem Bestand (siehe `FeedTyp`), nicht aus einem Feld am
  // Beitrag. „Text" ist deshalb drei Bedingungen und nicht eine.
  if (typ === "video") query = query.not("video_url", "is", null);
  if (typ === "event") query = query.eq("kind", "event");
  if (typ === "bild") query = query.not("post_media", "is", null);
  if (typ === "text") {
    query = query.is("video_url", null).neq("kind", "event").is("post_media", null);
  }

  if (cursor) query = query.or(cursorAusdruck(ordnung, cursor));

  const { data: posts, error } = await query;
  if (error) throw error;
  const geholt = posts ?? [];
  // Die Spähzeile wird abgeschnitten: sie ist die Antwort auf „gibt es mehr?",
  // kein Teil der Seite.
  const gibtMehr = geholt.length > FEED_SEITE;
  const rows = gibtMehr ? geholt.slice(0, FEED_SEITE) : geholt;
  if (rows.length === 0) return { posts: [], nextCursor: null };

  const postIds = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.author_id))];

  const [authors, countsRes, mediaRes, entfernteBeitraege] = await Promise.all([
    fetchAuthors(uid, authorIds),
    supabase.rpc("post_engagement_counts", { p_post_ids: postIds }),
    supabase
      .from("post_media")
      .select("post_id, storage_path, sort, width, height")
      .in("post_id", postIds),
    // BEITRAGS-IDs, nicht die Autoren-IDs von zwei Zeilen weiter oben: die
    // Funktion löst den Urheber selbst auf und wendet dabei dasselbe
    // Sichtbarkeitsprädikat an, das für den Beitrag gilt.
    fetchFormerEntries(uid, "post", postIds),
  ]);

  // Wie bei den Zählern: ein Fehler hier nimmt dem Feed die Bilder, nicht die
  // Beiträge — aber nicht still. Ein fehlender Grant soll sichtbar werden.
  if (mediaRes.error) captureException(mediaRes.error, { tags: { area: "feed.media" } });
  const media = new Map<string, FeedMedia[]>();
  for (const m of mediaRes.data ?? []) {
    const liste = media.get(m.post_id) ?? [];
    liste.push({ storagePath: m.storage_path, sort: m.sort, width: m.width, height: m.height });
    media.set(m.post_id, liste);
  }
  for (const liste of media.values()) liste.sort((a, b) => a.sort - b.sort);

  // Zähler-RPC ist nicht kritisch: schlägt sie fehl, zeigt der Feed 0/0 (statt zu
  // brechen) — aber NICHT still: an Sentry melden, damit ein kaputter Grant /
  // fehlende Migration sichtbar wird.
  if (countsRes.error) captureException(countsRes.error, { tags: { area: "feed.counts" } });
  const counts = new Map((countsRes.data ?? []).map((c) => [c.post_id, c]));

  let myLikes = new Set<string>();
  let meineSpeicherungen = new Set<string>();
  if (uid) {
    // Beide owner-only (`likes_write_own` / `saves_read_own`) → sie liefern
    // ohnehin nur eigene Zeilen. Der Filter im Client ist NICHT die Grenze;
    // die Grenze ist die Policy.
    //
    // JE EIN gebündelter Aufruf über die IDs der Seite, nicht einer je Karte —
    // und die beiden GEMEINSAM statt nacheinander: zwei unabhängige Abfragen
    // hintereinander kosten auf jeder Seite eine Rundreise mehr.
    const [likesRes, savesRes] = await Promise.all([
      supabase.from("post_likes").select("post_id").in("post_id", postIds),
      supabase.from("post_saves").select("post_id").in("post_id", postIds),
    ]);
    if (likesRes.error) throw likesRes.error;
    if (savesRes.error) throw savesRes.error;
    myLikes = new Set((likesRes.data ?? []).map((l) => l.post_id));
    meineSpeicherungen = new Set((savesRes.data ?? []).map((z) => z.post_id));
  }

  const letzte = rows[rows.length - 1];
  return {
    posts: rows.map((r) => ({
      id: r.id,
      author: entfernteBeitraege.has(r.id)
        ? ehemaligesMitglied(r.author_id)
        : authorOf(authors, r.author_id),
      body: r.body,
      hashtags: r.hashtags ?? [],
      visibility: r.visibility,
      createdAt: r.created_at,
      likeCount: counts.get(r.id)?.like_count ?? 0,
      commentCount: counts.get(r.id)?.comment_count ?? 0,
      likedByMe: myLikes.has(r.id),
      savedByMe: meineSpeicherungen.has(r.id),
      media: media.get(r.id) ?? [],
      videoUrl: r.video_url,
      // Verengung an der Grenze: die Datenbank liefert `text`, der Constraint
      // lässt aber nur zwei Werte zu. Alles Unerwartete gilt als Mitgliedsbeitrag
      // — die harmlose Richtung, denn ein Event-Beitrag ohne lesbares Event
      // entfällt ohnehin.
      kind: r.kind === "event" ? "event" : "member",
      event: eventVon(r.events),
    })),
    // Nur wenn die Spähzeile kam, gibt es wirklich mehr. Sonst brächte der
    // Cursor eine leere Anfrage — und eine Schaltfläche, die nichts tut.
    //
    // Die Reaktionszahl steht NUR in „Beliebteste" mit drin: dort führt sie,
    // und ohne sie wäre der Cursor unvollständig. In den Zeit-Ordnungen bliebe
    // sie ein Feld, das gültig aussieht und nichts bedeutet.
    nextCursor: gibtMehr
      ? ordnung === "beliebteste"
        ? { createdAt: letzte.created_at, id: letzte.id, likeCount: letzte.like_count }
        : { createdAt: letzte.created_at, id: letzte.id }
      : null,
  };
}

/**
 * EIN Beitrag über seine Kennung (AGE-587) — der Deeplink aus den
 * Aktivitäten-Karten der Profilflächen.
 *
 * `null` heisst „nicht abrufbar", und zwar UNUNTERSCHEIDBAR: die RLS liefert
 * für einen vorhandenen, aber unsichtbaren Beitrag dieselben null Zeilen wie
 * für einen erfundenen. Es gibt hier bewusst kein `if`, das die zwei Fälle
 * trennt — es gäbe nichts, woran es sie unterscheiden könnte, und der Versuch
 * wäre ein Existenz-Orakel wie das, das AGE-582 in `post_saves` geschlossen
 * hat.
 */
export async function fetchPostById(
  uid: string | null,
  postId: string,
): Promise<FeedPost | null> {
  const seite = await fetchFeed({ uid, postId });
  return seite.posts[0] ?? null;
}

/** Kommentare eines Beitrags, chronologisch (RLS: nur wenn der Post sichtbar ist).
 *
 *  Ohne Session wird gar nicht gefragt (AGE-530): `comments` trägt sein select nur
 *  für `authenticated`. Aufklappen kann ein ausgeloggter Besucher den Thread zwar
 *  nicht — der Knopf ist `disabled` —, aber er kann sich abmelden, WÄHREND er offen
 *  ist. Dann bleibt der Thread montiert, der Query-Key wechselt auf `uid = null`,
 *  und ohne diese Zeile liefe genau dort die nächste verbotene Abfrage. */
export async function fetchComments(uid: string | null, postId: string): Promise<FeedComment[]> {
  if (!uid) return [];
  const { data, error } = await supabase
    .from("comments")
    .select("id, post_id, author_id, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  // Auch Kommentarautoren werden neutralisiert, nicht nur Beitragsautoren
  // (10.4): ein Faden, in dem nur die Beiträge neutral sind, hält die Zusage
  // nicht — derselbe Mensch stünde als Kommentator weiter mit Namen da.
  const [authors, entfernteKommentare] = await Promise.all([
    fetchAuthors(uid, [...new Set(rows.map((r) => r.author_id))]),
    fetchFormerEntries(
      uid,
      "comment",
      rows.map((r) => r.id),
    ),
  ]);
  return rows.map((r) => ({
    id: r.id,
    postId: r.post_id,
    author: entfernteKommentare.has(r.id)
      ? ehemaligesMitglied(r.author_id)
      : authorOf(authors, r.author_id),
    body: r.body,
    createdAt: r.created_at,
  }));
}

// ── Schreiben ─────────────────────────────────────────────────────────────────

/**
 * Legt Beitrag UND Bildzeilen in einer Transaktion an (AGE-528).
 *
 * Der naheliegende Ablauf — Beitrag anlegen, Bilder hochladen, Zeilen anlegen —
 * hat einen sichtbaren Fehlerzustand: bricht er nach dem ersten Schritt ab,
 * steht der Beitrag sofort im Feed, und zwar **ohne seine Bilder**. Ein
 * Erlebnisbericht ohne Fotos ist kein halber Beitrag, sondern ein falscher.
 * Deshalb wird die `id` im Client erzeugt, die Bilder wandern zuerst in den
 * Bucket, und diese eine RPC klammert die beiden Inserts.
 *
 * Die Tags gehen GETRENNT hinein: getippte (aus dem Text) und geklickte. Die
 * Vereinigung steht in der RPC — sie hier zusätzlich zu bauen wäre dieselbe
 * Regel an zwei Stellen.
 */
export async function createPostWithMedia(input: {
  postId: string;
  body: string;
  visibility: PostVisibility;
  tags: string[];
  media: PostMediaEingabe[];
}): Promise<void> {
  const { error } = await supabase.rpc("create_post_with_media", {
    p_post_id: input.postId,
    p_body: input.body,
    p_visibility: input.visibility,
    p_hashtags: parseHashtags(input.body),
    p_tags: input.tags,
    // `p_media` ist in Postgres `jsonb`, und der Typgenerator schreibt dafür
    // `Json` — eine Struktur mit festen Feldern passt da nicht ohne Weiteres
    // hinein. Die Form prüft die RPC beim Auspacken (`m->>'storage_path'` …),
    // hier ist nur die Typbrücke.
    p_media: input.media as unknown as Json,
  });
  if (error) throw error;
}

/** Like setzen/entfernen (Toggle). RLS: nur das eigene Profil, nur auf sichtbare Posts. */
export async function toggleLike(input: {
  postId: string;
  profileId: string;
  liked: boolean;
}): Promise<void> {
  if (input.liked) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", input.postId)
      .eq("profile_id", input.profileId);
    if (error) throw error;
  } else {
    // Idempotent: ein Doppelklick (oder Klick vor dem Refetch) darf nicht am
    // (post_id, profile_id)-PK in einen 23505-Fehler laufen → ON CONFLICT DO NOTHING.
    const { error } = await supabase
      .from("post_likes")
      .upsert(
        { post_id: input.postId, profile_id: input.profileId },
        { onConflict: "post_id,profile_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  }
}

/**
 * Einen Beitrag speichern oder wieder lösen (AGE-582).
 *
 * Gebaut wie `toggleLike` darüber, mit EINEM Unterschied in der Begründung: eine
 * Speicherung ist privat. `post_saves` hat drei Policies und KEINE für UPDATE —
 * an einer Speicherung gibt es nichts zu ändern, es gibt sie oder nicht.
 *
 * Der `upsert` mit `ignoreDuplicates` wird deshalb zu `on conflict do nothing`
 * und braucht kein UPDATE-Recht; die Tabelle hält auch keines. Idempotent muss
 * er trotzdem sein: ein Doppelklick liefe sonst am `(profile_id, post_id)`-PK
 * in einen `23505`, den die Karte als Fehler zeigte.
 */
export async function toggleSave(input: {
  postId: string;
  profileId: string;
  saved: boolean;
}): Promise<void> {
  if (input.saved) {
    const { error } = await supabase
      .from("post_saves")
      .delete()
      .eq("post_id", input.postId)
      .eq("profile_id", input.profileId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("post_saves")
      .upsert(
        { post_id: input.postId, profile_id: input.profileId },
        { onConflict: "profile_id,post_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  }
}

/** Kommentar anlegen. RLS: nur als eigenes Profil und nur auf sichtbare Posts. */
export async function addComment(input: {
  postId: string;
  authorId: string;
  body: string;
}): Promise<void> {
  const { error } = await supabase
    .from("comments")
    .insert({ post_id: input.postId, author_id: input.authorId, body: input.body });
  if (error) throw error;
}

// ── Bearbeiten und Löschen (AGE-566) ────────────────────────────────────────

/**
 * Die Schlagworte nach einer Textänderung.
 *
 * `posts.hashtags` trägt ZWEI Quellen, die dort nicht mehr unterscheidbar sind:
 * die aus dem Text geparsten und die im Composer angeklickten kuratierten
 * (`create_post_with_media` vereinigt `p_hashtags` und `p_tags`). Ein blosses
 * `parseHashtags(neuerText)` würde die angeklickten also stillschweigend
 * wegräumen — der Beitrag verlöre beim Korrigieren eines Tippfehlers seine
 * Einordnung.
 *
 * Rekonstruiert wird deshalb über die Differenz: was im ALTEN Bestand steht,
 * aber nicht aus dem ALTEN Text kam, war angeklickt und bleibt.
 */
export function hashtagsNachBearbeitung(
  alterText: string,
  alteHashtags: string[],
  neuerText: string,
): string[] {
  const ausAltemText = new Set(parseHashtags(alterText));
  const kuratiert = alteHashtags.filter((t) => !ausAltemText.has(t));
  const ausNeuemText = parseHashtags(neuerText);
  const zusammen = [...ausNeuemText];
  for (const t of kuratiert) if (!zusammen.includes(t)) zusammen.push(t);
  return zusammen;
}

/**
 * Text und Sichtbarkeit eines eigenen Beitrags ändern.
 *
 * Direkt auf die Tabelle, nicht über eine RPC: `posts_write_own` gilt `for all`
 * und trägt die Regel bereits (eigener Beitrag, `kind = 'member'`). Eine eigene
 * Funktion hätte dieselbe Bedingung ein zweites Mal formuliert — und zwei
 * Formulierungen derselben Regel laufen auseinander.
 */
export async function updatePost(input: {
  postId: string;
  alterText: string;
  alteHashtags: string[];
  body: string;
  visibility: PostVisibility;
}): Promise<void> {
  const { error } = await supabase
    .from("posts")
    .update({
      body: input.body,
      hashtags: hashtagsNachBearbeitung(input.alterText, input.alteHashtags, input.body),
      visibility: input.visibility,
    })
    .eq("id", input.postId);
  if (error) throw error;
}

/**
 * Einen eigenen Beitrag löschen. `post_media`, Kommentare und Likes hängen mit
 * `on delete cascade` daran.
 *
 * Die OBJEKTE im Bucket hängen an keiner Fremdschlüsselbeziehung und müssen
 * getrennt weg — sonst bleibt bezahlter Speicher liegen, auf den nichts mehr
 * zeigt. Deshalb erst die Pfade lesen, dann die Zeile, dann der Bucket.
 */
export async function deletePost(postId: string): Promise<void> {
  const { data: medien } = await supabase
    .from("post_media")
    .select("storage_path")
    .eq("post_id", postId);
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
  const pfade = (medien ?? []).map((m) => m.storage_path);
  if (pfade.length > 0) await supabase.storage.from(POST_MEDIA_BUCKET).remove(pfade);
}

/**
 * Ein einzelnes Bild aus einem Beitrag nehmen — Zeile UND Objekt.
 *
 * Reihenfolge mit Absicht: erst die Zeile, dann das Objekt. Andersherum bliebe
 * bei einem Abbruch dazwischen eine Zeile stehen, die auf ein Bild zeigt, das
 * es nicht mehr gibt — und die Kachel bliebe für immer leer. So herum ist der
 * schlimmste Ausgang ein verwaistes Objekt, das niemand sieht.
 */
export async function removePostMedia(storagePath: string): Promise<void> {
  // Über den PFAD, nicht über eine Zeilen-Kennung: `post_media` trägt
  // `unique (storage_path)`, und die Feed-Antwort führt keine `id` mit. Ein
  // Feld weniger, das mitgeschleppt und falsch werden kann.
  const { error } = await supabase.from("post_media").delete().eq("storage_path", storagePath);
  if (error) throw error;
  await supabase.storage.from(POST_MEDIA_BUCKET).remove([storagePath]);
}

/**
 * Bilder zu einem bestehenden Beitrag hinzufügen.
 *
 * `sort` läuft hinter dem höchsten bestehenden Wert weiter: die Spalte trägt
 * `unique (post_id, sort)`, und bei 0 beginnend kollidierte jedes Nachtragen.
 */
export async function addPostMedia(input: {
  uid: string;
  postId: string;
  abSort: number;
  bilder: { blob: Blob; width: number; height: number }[];
}): Promise<void> {
  const zeilen = await uploadPostMedia({
    uid: input.uid,
    postId: input.postId,
    bilder: input.bilder,
  });
  const { error } = await supabase.from("post_media").insert(
    zeilen.map((z, i) => ({
      post_id: input.postId,
      storage_path: z.storage_path,
      sort: input.abSort + i,
      width: z.width,
      height: z.height,
    })),
  );
  if (error) throw error;
}
