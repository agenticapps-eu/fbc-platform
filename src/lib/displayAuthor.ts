/**
 * Anzeige-Maskierung für Autor-Identität. NUR Anzeige — welche Beiträge sichtbar
 * sind, regelt weiterhin RLS. Anonyme (ausgeloggte) Besucher sehen „Ein Mitglied"
 * + maskierten Avatar; eingeloggte Nutzer sehen Name + Avatar.
 *
 * Diese Funktion ist die OBERE von zwei Ebenen. Die tragende liegt darunter:
 * ohne Session wird `profiles_public` gar nicht erst angefragt (`feed.ts`
 * `fetchAuthors`, AGE-530), weil `anon` dort kein Leserecht hält. Wer hier etwas
 * ändert, ändert das Aussehen — nicht die Grenze.
 *
 * KEINE Auflösung nach Mitgliedsstufe, und das ist kein Versehen (AGE-291,
 * entschieden 2026-08-13). Der Grund, warum sie fehlt, ist NICHT „die RLS
 * erledigt das schon": `profiles_public` läuft mit `security_invoker = off` und
 * trägt `grant select … to authenticated` — jedes aktivierte Konto liest darüber
 * jeden öffentlichen Namen, ein frei registriertes `basic` eingeschlossen. Die
 * Stufe entscheidet über ZEILEN via `search_directory` (`has_level(3)`), nicht
 * über NAMEN via der View. Diese Preisgabe ist derzeit hingenommen und in
 * `openspec/specs/directory-search/spec.md` ausgeschrieben.
 *
 * Wer sie ändern will, findet den Plan dafür im Change `finish-ui-polish`:
 * ein gemeinsamer Resolver in der Datenbank, Schwelle `has_level(4)`
 * (`exchange`). Nicht hier nachbauen — eine Maskierung im Frontend über einer
 * View, die den vollen Namen ohnehin ausliefert, wäre Kulisse.
 */
export interface AuthorIdentity {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /**
   * Der Urheber ist kein Mitglied mehr (AGE-581). Gesetzt wird das Feld im
   * Lesepfad (`feed.ts`, `former_member_entries`), nicht hier — diese Ebene
   * entscheidet nur, wie es AUSSIEHT.
   */
  former?: boolean;
}

export interface DisplayedAuthor {
  name: string;
  avatarUrl: string | null;
  masked: boolean;
}

export function displayAuthor(author: AuthorIdentity, isLoggedIn: boolean): DisplayedAuthor {
  if (!isLoggedIn) {
    return { name: "Ein Mitglied", avatarUrl: null, masked: true };
  }
  // Entfernte Urheber tragen `masked`, und das ist hier kein Beiwort, sondern
  // die Zusage selbst (AGE-581, 10.3): die Karte hängt Profilverweis, Bild und
  // Stufenplakette AN DIESEM WAHRHEITSWERT auf — ein maskierter Autor bekommt
  // ein `<span>` statt eines `<Link to={`/p/${id}`}>`. Ein Verweis auf ein
  // Profil, das es nicht mehr gibt, wäre ein Link ins Leere.
  //
  // Der TEXT kommt aus `author.name` und wird hier NICHT wiederholt: der
  // Lesepfad hat ihn schon auf „Ehemaliges Mitglied" gesetzt. Zwei Stellen mit
  // derselben Zeichenkette laufen auseinander, sobald eine geändert wird.
  if (author.former) {
    return { name: author.name, avatarUrl: null, masked: true };
  }
  return { name: author.name, avatarUrl: author.avatarUrl ?? null, masked: false };
}
