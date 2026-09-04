/**
 * Aufzeichnende Sonde um `src/lib/supabase.ts` (AGE-542).
 *
 * Sie ersetzt den Stub, der bis hierher in `anon-anreicherung.test.ts` stand,
 * und kann zwei Dinge mehr, die den ganzen Change tragen:
 *
 *   1. **Sie hält den Namen jeder gerufenen Funktion fest.** Der alte Stub
 *      beantwortete `rpc()`, ohne den Namen anzusehen — ein Funktionsaufruf war
 *      für ihn unsichtbar.
 *   2. **Sie beantwortet `auth`.** Ohne das montiert `AuthProvider` nicht, und
 *      ohne den montierten Provider läuft die Hülle nicht unter dem Wächter.
 *
 * WARUM EIN PROXY UND KEINE AUFZÄHLUNG: der Produktivcode hängt an `from()`
 * über zwanzig verschiedene Kettenglieder (`eq`, `filter`, `order`, `overlaps`,
 * `range`, …). Eine Handliste bräche beim ersten Glied, das jemand neu benutzt —
 * und zwar mit einem Absturz, der wie ein Fund aussieht, aber ein Aufbaufehler
 * ist (design.md, Risiko „Rüstung könnte an einem fehlenden Provider
 * scheitern"). Der Proxy gibt für jedes unbekannte Glied die Kette zurück und
 * kann deshalb nicht aus diesem Grund rot werden.
 *
 * Die Sonde MISST, sie urteilt nicht. Welche Relation und welche Funktion
 * erlaubt sind, steht in den Positivlisten des Prüfstands, nicht hier.
 */

/** Was diese Sitzung angefragt hat. Vor jedem Fall über `zuruecksetzen()` leeren. */
export const rekorder = {
  /** Jede an `from(…)` übergebene Relation, in Aufrufreihenfolge, mit Wiederholungen. */
  relationen: [] as string[],
  /** Jede an `rpc(…)` übergebene Funktion, ebenso. */
  funktionen: [] as string[],
  /** Die zuletzt je Relation angefragte Projektion — sonst beantwortet die Fixture jede gleich. */
  spalten: {} as Record<string, string>,
};

export function zuruecksetzen(): void {
  rekorder.relationen = [];
  rekorder.funktionen = [];
  rekorder.spalten = {};
}

const AUTOR = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PARTNER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

/**
 * Fixture-Zeilen, aus `anon-anreicherung.test.ts` hierher gezogen (AGE-542),
 * damit beide Prüfstände dieselbe Datenlage sehen. Wer hier eine Spalte
 * entfernt, sollte in beiden rot werden — das ist der Zweck des Umzugs.
 */
export const ZEILEN: Record<string, Record<string, unknown>[]> = {
  posts: [
    {
      id: "p1",
      author_id: AUTOR,
      body: "Text",
      hashtags: [],
      visibility: "public",
      created_at: "2026-08-01T10:00:00Z",
      // Seit AGE-667 rendert die Beitragskarte die Zeit aus `veroeffentlicht_ab`,
      // nicht aus `created_at`. Ohne das Feld wirft `timeAgo` ein
      // `RangeError: Invalid time value` — was der alten Fassung dieser Fixture
      // nie auffiel, weil sie nur ABGEFRAGT und nie GERENDERT wurde. Der neue
      // Prüfstand montiert, und deshalb fällt es hier auf.
      veroeffentlicht_ab: "2026-08-01T10:00:00Z",
    },
  ],
  events: [
    {
      id: "e1",
      title: "Sommerfest",
      type: "dinner",
      starts_at: "2026-09-01T18:00:00Z",
      location: "Wien",
      visibility: "public",
      capacity: null,
      host_id: AUTOR,
      host_partner_id: null,
    },
    {
      id: "e2",
      title: "Partnerabend",
      type: "online",
      starts_at: "2026-09-02T18:00:00Z",
      location: null,
      visibility: "public",
      capacity: null,
      host_id: null,
      host_partner_id: PARTNER,
    },
  ],
  profiles_public: [
    {
      id: AUTOR,
      name: "Jonas Keller",
      avatar_url: "https://x/a.webp",
      tier: "impact",
      company: "Keller GmbH",
      roles: ["Gründer"],
      short_bio: "Baut Dinge.",
    },
  ],
  partners: [
    {
      id: PARTNER,
      name: "Musterpartner",
      logo_url: "https://x/p.png",
      description: "Ein Partner.",
    },
  ],
  post_media: [],
  event_registrations: [],
  comments: [
    {
      id: "c1",
      post_id: "p1",
      author_id: AUTOR,
      body: "Kommentar",
      created_at: "2026-08-01T11:00:00Z",
    },
  ],
};

export { AUTOR, PARTNER };

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Eine Kette, die sich für jedes Glied selbst zurückgibt und am Ende auflöst.
 * `then` macht sie zur Thenable — genau wie den echten PostgREST-Builder, den
 * der Produktivcode ohne `await`-Zwischenschritt weiterreicht.
 */
function kette(zeilen: () => Record<string, unknown>[], merkeSpalten?: (s: string) => void): any {
  const basis: Record<string | symbol, unknown> = {
    select: (spalte?: string) => {
      if (typeof spalte === "string") merkeSpalten?.(spalte);
      return stellvertreter;
    },
    maybeSingle: async () => ({ data: zeilen()[0] ?? null, error: null }),
    single: async () => ({ data: zeilen()[0] ?? null, error: null }),
    then: (auf: (r: { data: unknown; error: null }) => unknown, ab?: (e: unknown) => unknown) =>
      Promise.resolve({ data: zeilen(), error: null }).then(auf, ab),
  };

  const stellvertreter: any = new Proxy(basis, {
    get(ziel, glied) {
      if (glied in ziel) return ziel[glied];
      // Symbol-Eigenschaften (`$$typeof`, `Symbol.toPrimitive`) werden ignoriert:
      // React und vitest fragen sie ab, und gäbe der Proxy dafür eine Funktion
      // zurück, hielte React die Kette fälschlich für ein UI-Element.
      // Formulierung nach dem Diff-Review (gemini, LOW).
      if (typeof glied === "symbol") return undefined;
      return () => stellvertreter;
    },
  });
  return stellvertreter;
}

/**
 * Der Ersatz für den echten Client. Alles, was der Produktivcode ausgeloggt
 * anfasst, wird beantwortet; aufgezeichnet werden nur die zwei Dinge, über die
 * der Prüfstand eine Aussage macht.
 *
 * NICHT aufgezeichnet und bewusst so (design.md, Non-Goals):
 * `functions.invoke` — Edge Functions gehen nicht über die Grants der
 * Datenbankrolle, sie prüfen ihr Token im eigenen Rumpf. `storage` — dort
 * entstehen URLs, kein Netzwerkverkehr.
 */
export const sonde = {
  from(relation: string) {
    rekorder.relationen.push(relation);
    return kette(
      () => ZEILEN[relation] ?? [],
      (spalte) => {
        rekorder.spalten[relation] = spalte;
      },
    );
  },

  rpc(name: string) {
    rekorder.funktionen.push(name);
    return kette(() => []);
  },

  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({
      // Abbestellbar, sonst scheitert das Aufräumen von `AuthProvider` beim
      // `unmount` und der nächste Fall erbt einen toten Rückruf.
      data: { subscription: { unsubscribe: () => {} } },
    }),
  },

  storage: {
    from: () => ({
      getPublicUrl: (pfad: string) => ({ data: { publicUrl: `https://sonde.invalid/${pfad}` } }),
      remove: async () => ({ data: null, error: null }),
      upload: async () => ({ data: null, error: null }),
      createSignedUrl: async () => ({ data: null, error: null }),
    }),
  },

  functions: {
    invoke: async () => ({ data: null, error: null }),
  },

  channel: () => {
    const kanal: any = new Proxy(
      {},
      {
        get: (_z, glied) => (typeof glied === "symbol" ? undefined : () => kanal),
      },
    );
    return kanal;
  },
  removeChannel: () => {},
};
