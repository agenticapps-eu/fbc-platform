import type { TutorialEtappe } from "../types/release";

/**
 * Der Weg durch die Anwendung (AGE-705) — VON HAND gepflegt.
 *
 * **Die Reihenfolge ist die Leseordnung, nicht die Entstehungsordnung.** Sie
 * steht deshalb hier und wird nicht aus `datum` abgeleitet: wann etwas gebaut
 * wurde, sagt nichts darüber, wann man es lernen will. Wer neu ist, kommt an,
 * legt sein Profil an, sucht Menschen, schreibt jemanden an — und erst danach
 * interessiert ihn, wie ein Beitrag geplant wird.
 *
 * **Jede Geschichte steht in genau einer Etappe.** Eine zweite Nennung wäre eine
 * zweite Stelle, an der sie gepflegt werden müsste, und ein Weg, der sich
 * kreuzt.
 *
 * `motiv` ist ein Dateiname aus `public/images/` — dieselben Motive, die die
 * Anwendung über ihren Seiten trägt. Sie liegen im Repository, sind
 * selbst gehostet und tragen ihren Nachweis in `public/images/CREDITS.md`.
 */
export const RELEASE_TUTORIAL: TutorialEtappe[] = [
  {
    titel: "Ankommen",
    einleitung:
      "Der Anfang: hineinkommen, auch vom Telefon aus, und wieder hineinkommen, wenn das Passwort weg ist.",
    motiv: "hero-start.webp",
    kapitel: ["2026-08-26-password-reset-flow", "2026-08-26-fix-mobile-overflow"],
  },
  {
    titel: "Dein Profil",
    einleitung:
      "Was andere von dir sehen, bestimmst du. Es steht kein Punktestand daneben, den niemand erklären kann.",
    motiv: "hero-mitgliedschaft.webp",
    kapitel: ["2026-08-25-profil-biete-suche-und-radar"],
  },
  {
    titel: "Menschen finden",
    einleitung:
      "Das Verzeichnis ist der Ort, an dem der Club sichtbar wird. Zwei Reiter, ein paar Filter, und die Frage, ab wann du es siehst.",
    motiv: "hero-mitglieder.webp",
    kapitel: [
      "2026-09-02-rechte-matrix-stufen",
      "2026-08-25-verzeichnis-reiter-und-kartencover",
      "2026-08-31-suchspalte-rechts",
    ],
  },
  {
    titel: "Kontakt aufnehmen und reden",
    einleitung:
      "Vom ersten Anschreiben bis zum laufenden Gespräch: wo eine Anfrage landet, und wie die Nachrichten funktionieren, sobald sie angenommen ist.",
    motiv: "hero-kontakte.webp",
    kapitel: [
      "2026-08-25-stille-fehlschlaege-und-anfragen-weg",
      "2026-08-26-nachrichten-ungelesen-zaehler",
      "2026-08-27-chat-rechte-sidebar",
      "2026-08-27-chatfenster-angedockt",
      "2026-08-28-emoji-und-zeitstempel-im-chat",
      "2026-08-28-chat-verlauf-paging",
    ],
  },
  {
    titel: "Mitreden",
    einleitung:
      "Die Aktivität ist die gemeinsame Fläche. Hier schreibst du, filterst mit, planst voraus und entscheidest über Videos.",
    motiv: "hero-aktivitaet.webp",
    kapitel: [
      "2026-08-25-activity-concept-level",
      "2026-08-25-feed-beitragstyp-mehrfachauswahl",
      "2026-08-30-geplante-beitraege",
      "2026-08-31-composer-abbruch",
      "2026-08-26-add-video-consent-gate",
      "2026-08-27-video-freigabe-merken",
    ],
  },
  {
    titel: "Sich treffen",
    einleitung: "Events sind der Teil, der aus dem Bildschirm herausführt.",
    motiv: "hero-events.webp",
    kapitel: [
      "2026-08-25-event-anmeldeknopf-teilnahmeschwelle",
      "2026-09-07-events-vorlagen-und-serientermine",
    ],
  },
  {
    titel: "Alles im Blick behalten",
    einleitung:
      "Zum Schluss die Werkzeuge für den Alltag: was gemeldet wird, wie du Platz schaffst, und wie du uns erreichst.",
    motiv: "hero-academy.webp",
    kapitel: [
      "2026-08-27-glocke-und-hinweistypen",
      "2026-08-28-sidebar-pill",
      "2026-09-02-feedback-ausbauen",
    ],
  },
];
