/**
 * Impressum — § 5 DDG.
 *
 * Quelle: `05 FBC Impressum.docx`, geliefert 13.08.2026, Stand 15.07.2026.
 * Vollständig übernommen, kein Satz erfunden oder gekürzt.
 *
 * ERZEUGT aus der pandoc-Fassung des .docx und danach von Hand geprüft.
 * Bei einer neuen Fassung des Anwalts wird dieses Modul ersetzt, nicht
 * fortgeschrieben — sonst driften Seite und freigegebener Text auseinander.
 */

import type { Rechtsdokument } from "./types";

export const impressum: Rechtsdokument = {
  slug: "impressum",
  titel: "Impressum",
  stand: "15. Juli 2026",
  quelle: "05 FBC Impressum.docx (Stand 15. Juli 2026)",
  provisorisch: true,
  offenePunkte: [
    "Als Internetadresse nennt der Text www.fairbusinessclub.de — nicht diese Plattform. Der Anbieter selbst ist unverändert.",
    "Die Angaben zu Registern, Umsatzsteuer-Identifikationsnummer und Erlaubnis nach § 34c GewO sind aus dem Quelldokument übernommen und hier nicht gegen amtliche Register geprüft worden.",
  ],
  abschnitte: [
    {
      titel: "1. Anbieterkennzeichnung gemäß § 5 DDG",
      bloecke: [
        {
          art: "zeilen",
          zeilen: [
            ["Fair Business Club"],
            ["Inhaber:"],
            ["Detlev Krause"],
            ["Stockholmer Platz 1"],
            ["70173 Stuttgart"],
            ["Deutschland"],
          ],
        },
      ],
    },
    {
      titel: "2. Kontakt",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "E-Mail: ",
            { text: "info@fairbusinessclub.de", href: "mailto:info@fairbusinessclub.de" },
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Internet: ",
            { text: "www.fairbusinessclub.de", href: "http://www.fairbusinessclub.de" },
          ],
        },
      ],
    },
    {
      titel: "3. Vertretungsberechtigte Person",
      bloecke: [{ art: "absatz", inhalt: ["Detlev Krause"] }],
    },
    {
      titel: "4. Umsatzsteuer",
      bloecke: [
        { art: "absatz", inhalt: ["Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:"] },
        { art: "absatz", inhalt: ["DE280418980"] },
      ],
    },
    {
      titel: "5. Berufsrechtliche Angaben",
      bloecke: [
        { art: "absatz", inhalt: ["Erlaubnis nach § 34c Gewerbeordnung (GewO)"] },
        { art: "absatz", inhalt: ["Erlaubnis erteilt durch:"] },
        { art: "absatz", inhalt: ["Industrie- und Handelskammer Region Stuttgart"] },
        { art: "absatz", inhalt: ["Jägerstraße 30"] },
        { art: "absatz", inhalt: ["70174 Stuttgart"] },
      ],
    },
    {
      titel: "6. Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV",
      bloecke: [
        { art: "absatz", inhalt: ["Detlev Krause"] },
        { art: "absatz", inhalt: ["Stockholmer Platz 1"] },
        { art: "absatz", inhalt: ["70173 Stuttgart"] },
        { art: "absatz", inhalt: ["Deutschland"] },
      ],
    },
    {
      titel: "7. Verbraucherstreitbeilegung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS-Plattform) bereit:",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            {
              text: "https://ec.europa.eu/consumers/odr/",
              href: "https://ec.europa.eu/consumers/odr/",
            },
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Wir sind weder verpflichtet noch bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
          ],
        },
      ],
    },
    {
      titel: "8. Urheberrecht",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Die auf dieser Website veröffentlichten Inhalte unterliegen dem deutschen Urheberrecht.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Jede Vervielfältigung, Bearbeitung, Verbreitung oder sonstige Nutzung außerhalb der gesetzlichen Schranken des Urheberrechts bedarf der vorherigen schriftlichen Zustimmung des jeweiligen Rechteinhabers.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Downloads und Kopien dieser Website sind ausschließlich für den privaten, nicht kommerziellen Gebrauch gestattet, soweit nichts anderes angegeben ist.",
          ],
        },
      ],
    },
    {
      titel: "9. Haftung für Inhalte",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Wir erstellen die Inhalte dieser Website mit größtmöglicher Sorgfalt."],
        },
        {
          art: "absatz",
          inhalt: [
            "Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte übernehmen wir jedoch keine Gewähr.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Als Diensteanbieter sind wir gemäß den gesetzlichen Vorschriften für eigene Inhalte verantwortlich.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Eine Verpflichtung zur permanenten Überwachung übermittelter oder gespeicherter fremder Informationen besteht nur im Rahmen der gesetzlichen Vorschriften.",
          ],
        },
      ],
    },
    {
      titel: "10. Haftung für Links",
      bloecke: [
        { art: "absatz", inhalt: ["Unsere Website enthält Links zu externen Webseiten Dritter."] },
        { art: "absatz", inhalt: ["Auf deren Inhalte haben wir keinen Einfluss."] },
        {
          art: "absatz",
          inhalt: [
            "Für die Inhalte verlinkter Seiten ist ausschließlich der jeweilige Betreiber verantwortlich.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar."],
        },
        {
          art: "absatz",
          inhalt: [
            "Bei Bekanntwerden entsprechender Rechtsverletzungen werden derartige Links unverzüglich entfernt.",
          ],
        },
      ],
    },
    {
      titel: "11. Änderungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Wir behalten uns vor, dieses Impressum jederzeit an gesetzliche oder organisatorische Änderungen anzupassen.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["Es gilt jeweils die auf unserer Website veröffentlichte Fassung."],
        },
      ],
    },
  ],
};
