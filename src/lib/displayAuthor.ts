/**
 * Anzeige-Maskierung für Autor-Identität. NUR Anzeige — welche Beiträge sichtbar
 * sind, regelt weiterhin RLS. Anonyme (ausgeloggte) Besucher sehen „Ein Mitglied"
 * + maskierten Avatar; eingeloggte Nutzer sehen Name + Avatar.
 *
 * Folgeschritt (nicht hier): stufenweise Auflösung je Mitgliedsstufe.
 */
export interface AuthorIdentity {
  id: string;
  name: string;
  avatarUrl?: string | null;
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
  return { name: author.name, avatarUrl: author.avatarUrl ?? null, masked: false };
}
