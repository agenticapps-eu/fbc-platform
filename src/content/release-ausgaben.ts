import type { ReleaseAusgabe } from "../types/release";

/**
 * Die wöchentlichen Ausgaben des öffentlichen Blogs (AGE-705) — VON HAND
 * gepflegt.
 *
 * **Die Einteilung ist redaktionell, nicht technisch.** Sie entsteht nicht aus
 * den Daten der Archiveinträge: die liegen dicht beieinander und in einer
 * Reihenfolge, die niemanden interessiert, der die Anwendung benutzt. Eine
 * Ausgabe bündelt stattdessen, was zusammen gehört, und stellt es als das vor,
 * was es für die Leserschaft ist — die Neuerungen einer Woche.
 *
 * **Die Daten sind gesetzt und nicht gemessen.** Der Blog beginnt am 1. August
 * 2026 und erscheint wöchentlich. Vor dem Live-Gang gehört entschieden, ob es
 * dabei bleibt; die Funktionen selbst sind echt und in der Anwendung geprüft.
 *
 * `einleitung` darf sagen, dass etwas neu ist — sie ist eine Meldung über einen
 * Zeitraum. Der Text der Geschichte darf das nicht: er steht auch im Tutorial,
 * und dort hat niemand ein Vorher.
 *
 * **Jede Geschichte steht in genau einer Ausgabe.** Zwei Ausgaben zur selben
 * Funktion wären für die Leserschaft ein Widerspruch über den Zeitpunkt.
 */
export const RELEASE_AUSGABEN: ReleaseAusgabe[] = [
  {
    datum: "2026-08-01",
    titel: "Ankommen im Club",
    einleitung: `Die erste Woche gehört dem Anfang: hineinkommen, sich zeigen, sehen wer sonst noch da ist.

Dazu der Weg zurück, wenn das Passwort weg ist, und die Frage, ob das alles auch auf dem Telefon funktioniert.`,
    geschichten: [
      "2026-08-26-password-reset-flow",
      "2026-08-26-fix-mobile-overflow",
      "2026-08-25-profil-biete-suche-und-radar",
      "2026-08-25-verzeichnis-reiter-und-kartencover",
    ],
  },
  {
    datum: "2026-08-08",
    titel: "Menschen finden",
    einleitung: `Diese Woche geht es ums Suchen. Die Filter des Verzeichnisses bleiben beim Blättern stehen, und es steht klar dabei, ab welcher Stufe man das Verzeichnis überhaupt sieht.

Und wenn du jemanden angefragt hast: es gibt eine Stelle, an der deine Anfragen liegen.`,
    geschichten: [
      "2026-09-02-rechte-matrix-stufen",
      "2026-08-31-suchspalte-rechts",
      "2026-08-25-stille-fehlschlaege-und-anfragen-weg",
    ],
  },
  {
    datum: "2026-08-15",
    titel: "Die Woche der Nachrichten",
    einleitung: `Fünf Neuerungen für die Gespräche. Von der Sprechblase in der Kopfzeile bis zu drei Fenstern nebeneinander, die einen Seitenwechsel überstehen.

Dazu Emoji, Uhrzeiten an den Nachrichten und ein Knopf, der ältere nachholt.`,
    geschichten: [
      "2026-08-26-nachrichten-ungelesen-zaehler",
      "2026-08-27-chat-rechte-sidebar",
      "2026-08-27-chatfenster-angedockt",
      "2026-08-28-emoji-und-zeitstempel-im-chat",
      "2026-08-28-chat-verlauf-paging",
    ],
  },
  {
    datum: "2026-08-22",
    titel: "Beiträge und Filter",
    einleitung: `Der Bereich, in dem der Club spricht, hat dazugelernt.

Beiträge lassen sich nach Art filtern, für einen späteren Tag planen und wieder verwerfen, bevor sie jemand sieht.`,
    geschichten: [
      "2026-08-25-activity-concept-level",
      "2026-08-25-feed-beitragstyp-mehrfachauswahl",
      "2026-08-30-geplante-beitraege",
      "2026-08-31-composer-abbruch",
    ],
  },
  {
    datum: "2026-08-29",
    titel: "Videos und die Glocke",
    einleitung: `Zwei Dinge, die zusammengehören: ein Video lädt erst, wenn du es verlangst, und wenn du das einmal erlaubt hast, merkt die Seite es sich.

Dazu die Glocke, die zeigt, was passiert ist, während du woanders warst.`,
    geschichten: [
      "2026-08-26-add-video-consent-gate",
      "2026-08-27-video-freigabe-merken",
      "2026-08-27-glocke-und-hinweistypen",
    ],
  },
  {
    datum: "2026-09-05",
    titel: "Termine in Serie",
    einleitung: `Zum Abschluss die Events: eine Terminreihe einmal einrichten und danach nur noch Termine daraus erzeugen. Warum manchmal ein grauer Anmeldeknopf dasteht, steht jetzt daneben.

Dazu zwei Kleinigkeiten für den Alltag: mehr Platz auf dem Bildschirm und ein Weg, uns etwas auszurichten.`,
    geschichten: [
      "2026-09-07-events-vorlagen-und-serientermine",
      "2026-08-25-event-anmeldeknopf-teilnahmeschwelle",
      "2026-08-28-sidebar-pill",
      "2026-09-02-feedback-ausbauen",
    ],
  },
];
