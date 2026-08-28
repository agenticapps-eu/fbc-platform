import type { ReleaseBild } from "../types/release";

/**
 * Screenshots zu archivierten Changes (AGE-632).
 *
 * **Von Hand gepflegt, und das ist die Entscheidung.** Die Eintragsliste
 * daneben (`release-entries.generated.ts`) entsteht zur Bauzeit aus dem Archiv;
 * ein Bild kann kein Erzeuger erfinden. Beide teilen aber dieselbe
 * Konstruktion: was im Bündel steht, ist ausgeliefert. Ein Bild in der
 * Datenbank könnte eine Fläche zeigen, die es im ausgelieferten Stand gar nicht
 * gibt.
 *
 * Der Schlüssel ist der Verzeichnisname des Archivs — derselbe, der in
 * `entry_slugs` einer Release-Note landet. Ein Slug ohne Eintrag hier ist der
 * Normalfall und keine Lücke: die meisten Änderungen haben nichts zu zeigen.
 *
 * **Das Repo ist öffentlich.** Jeder Screenshot entsteht gegen den lokalen
 * Stack mit erfundenen Konten („Alexa Probe", „Bernd Wiegand") und erfundenen
 * Gesprächen. Kein echter Name, keine echte Adresse, keine echte Firma — auch
 * nicht am Rand, auch nicht unscharf.
 */
export const RELEASE_BILDER: Record<string, ReleaseBild[]> = {
  "2026-08-27-chat-rechte-sidebar": [
    {
      src: "/release/nachrichtenleiste.png",
      alt: "Die Nachrichtenleiste steht rechts neben dem Verzeichnis und zeigt ein Gespräch mit zwei ungelesenen Nachrichten",
      width: 1440,
      height: 820,
    },
  ],
  "2026-08-27-glocke-und-hinweistypen": [
    {
      src: "/release/glocke.png",
      alt: "Die geöffnete Glocke mit einem Hinweis „Neu in der App“ und der Schaltfläche „Alle als gelesen markieren“",
      width: 1440,
      height: 820,
    },
  ],
  "2026-08-27-release-notes-an-alle": [
    {
      src: "/release/neues-liste.png",
      alt: "Die Seite „Neu in der App“ mit einer Mitteilung als anklickbarer Karte",
      width: 1440,
      height: 820,
    },
  ],
};
