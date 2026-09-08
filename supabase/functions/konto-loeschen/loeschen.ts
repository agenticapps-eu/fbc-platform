// Die reine Logik der Kontolöschung (AGE-708).
// Change: openspec/changes/kontoloeschung/.
//
// Alles hier ist ohne Netz und ohne Secrets prüfbar. Die Verdrahtung — der
// Supabase-Client, die Reihenfolge der Aufrufe, das Löschen von `auth.users` —
// steht in `index.ts`; sie ist es, die `deno test` NICHT sieht, weshalb die
// Grenze zwischen beiden Dateien bewusst dort liegt, wo die Entscheidungen
// aufhören und das Verdrahten anfängt.

/**
 * Die Buckets, aus denen eine Kontolöschung räumt.
 *
 * `event-covers` fehlt hier mit Absicht: ein Veranstaltungs-Titelbild gehört
 * zur VERANSTALTUNG, nicht zur Person, und die Veranstaltung bleibt bestehen
 * (design.md D10 — künftige Termine eines gegangenen Gastgebers werden nicht
 * automatisch abgesagt, das träfe alle Angemeldeten). Es zu löschen risse ein
 * Loch in eine Seite, die weiterlebt.
 */
export const BUCKETS = [
  "avatars",
  "covers",
  "post-media",
  "feedback-screenshots",
] as const;

export type Bucket = (typeof BUCKETS)[number];

/**
 * Ein Eintrag, wie ihn `storage.list()` liefert. Ordner haben dort `id: null`
 * — daran, und nur daran, lassen sie sich von Dateien unterscheiden.
 */
export type Eintrag = { name: string; id: string | null };

/**
 * Baut aus einem `list()`-Ergebnis die vollen Objektpfade unterhalb von
 * `praefix`, Ordner ausgenommen.
 *
 * Warum überhaupt gelistet und nicht `profiles.avatar_url` gelesen wird: die
 * Spalte kennt nur das AKTUELLE Bild. Wer sein Profilbild dreimal gewechselt
 * hat, hat drei Dateien im Bucket und einen Pfad in der Spalte — die beiden
 * älteren stehen nirgends mehr und blieben liegen. Alle vier Buckets legen
 * unter `<uid>/…` ab (so steht es in ihren INSERT-Policies), also findet eine
 * Auflistung dieses Ordners auch die Waisen.
 */
export function objektPfade(praefix: string, eintraege: Eintrag[]): string[] {
  return eintraege
    .filter((e) => e.id !== null)
    .map((e) => `${praefix}/${e.name}`);
}

/**
 * Die Ordner, die unterhalb von `praefix` noch abzusteigen sind.
 *
 * `post-media` legt je Beitrag einen Unterordner an. Ohne den Abstieg bliebe
 * dort jede Datei liegen — und zwar unbemerkt, weil das Löschen der Ebene
 * darüber erfolgreich meldet, es habe nichts zu tun gefunden.
 */
export function unterordner(praefix: string, eintraege: Eintrag[]): string[] {
  return eintraege
    .filter((e) => e.id === null)
    .map((e) => `${praefix}/${e.name}`);
}

export type Pruefung = { ok: true } | { ok: false; status: number; grund: string };

/**
 * Prüft, ob dieser Aufruf gelöscht werden darf.
 *
 * Zwei Regeln, und die zweite ist die, die der Plan-Review verlangt hat
 * (codex, MEDIUM): eine mitgeschickte Ziel-Kennung wird **abgelehnt**, nicht
 * stillschweigend ignoriert. Der Unterschied zählt — wer eine fremde ID
 * schickt und `200` zurückbekommt, glaubt, sie sei gelöscht worden.
 *
 * `sub` stammt aus dem Token, das **das Gateway** verifiziert hat
 * (`verify_jwt = true`). Das ist der Verifikationsort dieses Projekts, und er
 * ist bewusst nicht der Handler: unter den asymmetrischen Signaturschlüsseln
 * der Produktion liefert `getUser()` null und `getClaims()` scheitert am
 * JWKS-Abruf (gemessen in AGE-259).
 */
export function pruefeAuftrag(sub: string | undefined, rumpf: unknown): Pruefung {
  if (!sub) {
    return { ok: false, status: 401, grund: "keine gueltige Sitzung" };
  }
  const ziel = (rumpf as { profile_id?: unknown } | null)?.profile_id;
  if (ziel !== undefined && ziel !== sub) {
    return { ok: false, status: 403, grund: "fremdes Konto" };
  }
  return { ok: true };
}

export type Schritt = "dateien" | "anonymisieren" | "auth";

/**
 * Übersetzt den Ausgang der drei Schritte in Status und Rumpf.
 *
 * Die Regel dahinter ist eine Zusage aus dem Spec: **ein Teilerfolg meldet
 * niemals Erfolg.** Der Aufrufer erfährt, welcher Schritt fehlt, damit ein
 * erneuter Aufruf ihn nachholen kann — jeder Schritt ist wiederholbar.
 *
 * `207` statt `500` für den Teilerfolg, wie bei `admin-set-member-ban` und aus
 * demselben Grund: `500` behauptet, es sei nichts passiert, und das wäre
 * falsch. Der zurückbleibende Zustand hat immer ZU WENIG gelöscht, nie zu
 * viel — deshalb ist er heilbar und nicht gefährlich.
 */
export function antwortFuer(erledigt: Record<Schritt, boolean>): {
  status: number;
  rumpf: Record<string, unknown>;
} {
  const offen = (["dateien", "anonymisieren", "auth"] as Schritt[]).filter(
    (s) => !erledigt[s],
  );
  if (offen.length === 0) {
    return { status: 200, rumpf: { geloescht: true } };
  }
  return {
    status: 207,
    rumpf: { geloescht: false, offen, hinweis: "erneut aufrufen; jeder Schritt ist wiederholbar" },
  };
}
