/**
 * Beitragstext zerlegen und Videos erkennen — die reinen Helfer des Feeds.
 *
 * Sie standen bis AGE-533 in `lib/feed.ts` und sind von dort unverändert
 * hierher gezogen. `feed.ts` exportiert sie weiter, alle bisherigen Importe
 * bleiben gültig.
 *
 * WARUM sie ein eigenes Modul bekommen: `feed.ts` baut beim Laden den
 * Supabase-Client (`./supabase` liest `import.meta.env`) und ist damit außerhalb
 * von Vite nicht importierbar. Seit C9 leitet die DATENBANK `posts.video_url`
 * über `public.erste_video_url()` ab, und die beiden Erkenner müssen
 * deckungsgleich sein. Diese Parität lässt sich nur messen, wenn der
 * kanonische Parser auch aus einem Node-Skript aufrufbar ist —
 * `scripts/probe-c9-parser-paritaet.ts` tut genau das.
 *
 * Ohne diesen Schnitt bliebe nur, die Erwartungen im Skript abzuschreiben. Das
 * prüfte die Abschrift, nicht den Parser.
 *
 * Dieses Modul importiert deshalb NICHTS mit Seiteneffekt. Wer hier einen
 * Import ergänzt, prüfe vorher, ob er in Node lädt.
 */

/** Ein Stück des zerlegten Beitragstextes. */
export interface PostSegment {
  type: "text" | "hashtag" | "mention" | "url";
  /** Hashtag/Mention ohne Präfix (Hashtag klein normalisiert); sonst der rohe Text. */
  value: string;
  /** Das exakt erkannte Stück (inkl. #/@), für die Anzeige. */
  raw: string;
}

// Hashtag/Erwähnung nur am Wortanfang (Start oder nach Whitespace), damit
// "C#programming" oder eine E-Mail keine Fehltreffer erzeugen. URLs überall.
const TOKEN_RE = /(?<=^|\s)[#@][\p{L}\p{N}_]+|https?:\/\/[^\s]+/gu;
// Satzzeichen am URL-Ende gehören zum Satz, nicht zum Link. Klammern/eckige
// Klammern bewusst NICHT abtrennen — sie kommen in echten URLs vor (z. B.
// Wikipedia `/wiki/Foo_(bar)`); sie hier zu strippen würde solche Links zerreißen.
const TRAILING_PUNCT = /[.,;:!?»"']+$/;

function normalizeTag(tag: string): string {
  return tag.toLowerCase();
}

/** Zerlegt den Beitragstext in geordnete Segmente (Text/Hashtag/Erwähnung/URL). */
export function tokenizePostBody(body: string): PostSegment[] {
  const segments: PostSegment[] = [];
  const re = new RegExp(TOKEN_RE);
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    let matched = m[0];
    const start = m.index;

    // URL: nachgestellte Satzzeichen abtrennen (wandern zurück in den Text).
    let trailing = "";
    if (matched.startsWith("http")) {
      const t = TRAILING_PUNCT.exec(matched);
      if (t) {
        trailing = t[0];
        matched = matched.slice(0, -trailing.length);
      }
    }

    if (start > last) {
      const text = body.slice(last, start);
      segments.push({ type: "text", value: text, raw: text });
    }
    if (matched.startsWith("#")) {
      segments.push({ type: "hashtag", value: normalizeTag(matched.slice(1)), raw: matched });
    } else if (matched.startsWith("@")) {
      segments.push({ type: "mention", value: matched.slice(1), raw: matched });
    } else {
      segments.push({ type: "url", value: matched, raw: matched });
    }
    last = start + matched.length;
    if (trailing) {
      segments.push({ type: "text", value: trailing, raw: trailing });
      last += trailing.length;
    }
  }
  if (last < body.length) {
    const text = body.slice(last);
    segments.push({ type: "text", value: text, raw: text });
  }
  return segments;
}

function youtube(id: string) {
  return { provider: "youtube" as const, embedUrl: `https://www.youtube.com/embed/${id}` };
}

/**
 * Wandelt eine YouTube-/Vimeo-URL in eine sichere Embed-URL. Lässt NUR diese beiden
 * Anbieter und valide Video-IDs zu — alles andere (fremde Hosts, javascript:, kein
 * Link) ergibt `null`, damit nie ein beliebiges iframe eingebettet wird (AGE-252-Regel).
 *
 * Diese Funktion ist die kanonische Grenze. `public.erste_video_url()` in der
 * Datenbank (20260813090000) bildet sie nach, damit `posts.video_url` gefüllt
 * werden kann, ohne dass der Client den Wert bestimmt — und die Parität misst
 * `scripts/probe-c9-parser-paritaet.ts` gegen genau diese Funktion. Wer hier
 * einen Host ergänzt, ergänzt ihn dort mit, sonst driften Academy-Filter und
 * Einbettung auseinander.
 */
export function parseVideoUrl(
  raw: string,
): { provider: "youtube" | "vimeo"; embedUrl: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      if (id && /^[\w-]+$/.test(id)) return youtube(id);
      return null;
    }
    const embed = url.pathname.match(/^\/embed\/([\w-]+)$/);
    return embed ? youtube(embed[1]) : null;
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return id && /^[\w-]+$/.test(id) ? youtube(id) : null;
  }
  if (host === "vimeo.com") {
    const m = url.pathname.match(/^\/(\d+)$/);
    return m ? { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${m[1]}` } : null;
  }
  if (host === "player.vimeo.com") {
    const m = url.pathname.match(/^\/video\/(\d+)$/);
    return m ? { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${m[1]}` } : null;
  }
  return null;
}

/**
 * Erste einbettbare Video-URL im Beitrag (für die Embed-Vorschau der Karte). Gibt
 * neben der Embed-URL auch die rohe Quell-URL zurück, damit die Karte sie im Text
 * ausblenden kann (kein doppelter Link + Embed).
 */
export function extractFirstVideo(
  body: string,
): { url: string; provider: "youtube" | "vimeo"; embedUrl: string } | null {
  for (const seg of tokenizePostBody(body)) {
    if (seg.type === "url") {
      const video = parseVideoUrl(seg.value);
      if (video) return { url: seg.raw, ...video };
    }
  }
  return null;
}

/**
 * Die Segmente ohne den ABSCHLIESSENDEN Hashtag-Block.
 *
 * Ein Beitrag endet in aller Regel so: „…die ehrlichste halbe Stunde zum Thema.
 * #Persönlichkeitsentwicklung". Dieser Teil ist Verschlagwortung, kein Satz —
 * und da die Chip-Reihe unter dem Beitrag aus genau denselben Segmenten
 * entsteht, stand das Wort zweimal auf dem Bildschirm. Die Anforderung
 * „ein Tag pro Beitrag an genau einer Stelle" (community-feed) war damit nur
 * dem Titel nach erfüllt.
 *
 * NUR AM ENDE, und das ist der ganze Witz der Funktion: mitten im Satz trägt
 * ein Hashtag Grammatik. Aus „Wir waren beim #Sommerfest und…" würde sonst
 * „Wir waren beim und…". Solche bleiben deshalb stehen — sichtbar als Text,
 * anklickbar ist weiterhin nur der Chip.
 *
 * Reiner Leerraum zwischen den Hashtags zählt zum Block; alles andere beendet
 * ihn. Besteht der Beitrag AUSSCHLIESSLICH aus Hashtags, bleibt er unverändert:
 * ein leerer Beitragstext wäre schlechter als eine Dopplung.
 */
export function ohneSchlussHashtags(segments: PostSegment[]): PostSegment[] {
  let ende = segments.length;
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg.type === "hashtag") {
      ende = i;
      continue;
    }
    if (seg.type === "text" && seg.value.trim() === "") continue;
    break;
  }
  if (ende === segments.length) return segments;
  const rest = segments.slice(0, ende);
  // Nur Hashtags im ganzen Beitrag: dann lieber doppelt als leer.
  if (rest.every((s) => s.type === "text" && s.value.trim() === "")) return segments;
  // Der Leerraum, der zum entfernten Block gehörte, geht mit — und zwar auch
  // dann, wenn er am ENDE eines sonst gefüllten Textsegments klebt („… zum
  // Thema. " vor dem Hashtag). Nur ganze Leerraum-Segmente zu entfernen liess
  // ein nachlaufendes Leerzeichen stehen.
  while (rest.length > 0) {
    const letzte = rest[rest.length - 1];
    if (letzte.type !== "text") break;
    const gekuerzt = letzte.value.replace(/\s+$/, "");
    if (gekuerzt === "") {
      rest.pop();
      continue;
    }
    rest[rest.length - 1] = { type: "text", value: gekuerzt, raw: gekuerzt };
    break;
  }
  return rest;
}
