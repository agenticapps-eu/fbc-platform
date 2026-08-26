/**
 * Allgemeine Geschäftsbedingungen.
 *
 * Quelle: `01 FBC AGB.docx`, geliefert 13.08.2026, Stand 15.07.2026.
 * 178 Abschnitte samt vier Anlagen (Widerrufsbelehrung,
 * Muster-Widerrufsformular). Vollständig übernommen.
 *
 * WAS DER TEXT RICHTIG HAT, und das ist erwähnenswert: § 3.2 nennt exakt die
 * sechs Stufen Basic · Connect · Discover · Exchange · Focus · Impact —
 * identisch mit `src/config/levels.ts` (AGE-311). Auf diesem Punkt ist das
 * Anwaltsdokument aktueller als die Legacy-Dokumentation.
 *
 * WAS ER NICHT HAT: „ActivePoints“ kommt 26-mal vor. Im Code existiert das nur
 * in `src/vision/` — totem Code. Nicht stillschweigend entfernt: der Text ist
 * anwaltlich gesetzt, die Korrektur ist eine Sachentscheidung. Er steht als
 * offener Punkt auf der Seite.
 *
 * ERZEUGT aus der pandoc-Fassung des .docx und danach von Hand geprüft.
 */

import type { Rechtsdokument } from "./types";

export const agb: Rechtsdokument = {
  slug: "agb",
  titel: "Allgemeine Geschäftsbedingungen",
  stand: "15. Juli 2026",
  quelle: "01 FBC AGB.docx (Stand 15. Juli 2026)",
  provisorisch: true,
  offenePunkte: [
    "Diese Fassung ist auf „Fair Business Club“ geschrieben. Der Name dieser Plattform kommt darin kein einziges Mal vor.",
    "Der Text nennt an 26 Stellen „ActivePoints“. Diese Funktion gibt es auf der Plattform nicht. Sie ist weder freigeschaltet noch in Vorbereitung.",
    "Die Bedingungen sind hier nur zur Information veröffentlicht. Sie sind in keinen Registrierungs- oder Vertragsweg eingebunden; es gibt keine Zustimmung, die auf sie verweist.",
    "Preise, Laufzeiten und Kündigungsfristen sind aus dem Quelldokument übernommen und nicht gegen die tatsächlich angebotenen Mitgliedschaften abgeglichen.",
  ],
  abschnitte: [
    {
      titel: "1. Anbieter, Geltungsbereich und Begriffsdefinitionen",
      bloecke: [],
    },
    {
      titel: "1.1 Anbieter",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Anbieter der auf der Website sowie auf der Plattform angebotenen Mitgliedschaften, digitalen Leistungen und Veranstaltungen ist:",
          ],
        },
        {
          art: "zeilen",
          zeilen: [
            ["Fair Business Club"],
            ["Inhaber: Detlev Krause"],
            ["Stockholmer Platz 1"],
            ["70173 Stuttgart"],
            ["Deutschland"],
            [
              "E-Mail: ",
              { text: "info@fairbusinessclub.de", href: "mailto:info@fairbusinessclub.de" },
            ],
            [
              "Website: ",
              { text: "www.fairbusinessclub.de", href: "http://www.fairbusinessclub.de" },
            ],
          ],
        },
        { art: "absatz", inhalt: ['Nachfolgend „Anbieter" genannt.'] },
      ],
    },
    {
      titel: "1.2 Geltungsbereich",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für sämtliche Verträge zwischen dem Anbieter und den Nutzern der Plattform über kostenlose oder kostenpflichtige Mitgliedschaften sowie über sämtliche angebotenen Leistungen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Die AGB gelten unabhängig davon, ob der Nutzer als Verbraucher (§ 13 BGB), Unternehmer (§ 14 BGB), Freiberufler, Verein, Verband, Stiftung, Kommune oder sonstige Organisation handelt.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Entgegenstehende oder abweichende Allgemeine Geschäftsbedingungen des Nutzers finden keine Anwendung, sofern ihrer Geltung nicht ausdrücklich schriftlich zugestimmt wurde.",
          ],
        },
      ],
    },
    {
      titel: "1.3 Zweck der Plattform",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Fair Business Club ist eine Plattform zur intelligenten Vernetzung von Menschen, Organisationen, Kompetenzen und Chancen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Ziel der Plattform ist es, persönliche und unternehmerische Entwicklung zu fördern, den Austausch von Wissen und Erfahrungen zu ermöglichen sowie nachhaltige Beziehungen, Kooperationen und Projekte zu unterstützen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Hierzu stellt der Anbieter insbesondere digitale Werkzeuge, Community-Funktionen, Veranstaltungen, Lernangebote, Empfehlungs- und Matching-Systeme sowie weitere Plattformdienste zur Verfügung.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(4) Ein Anspruch auf bestimmte wirtschaftliche, berufliche oder persönliche Erfolge besteht nicht.",
          ],
        },
      ],
    },
    {
      titel: "1.4 Zielgruppen",
      bloecke: [
        { art: "absatz", inhalt: ["Die Plattform richtet sich insbesondere an:"] },
        {
          art: "liste",
          punkte: [
            ["Verbraucher,"],
            ["Unternehmer,"],
            ["Selbstständige,"],
            ["Freiberufler,"],
            ["Investoren,"],
            ["Experten,"],
            ["Vereine,"],
            ["Verbände,"],
            ["Stiftungen,"],
            ["Unternehmen,"],
            ["Kommunen,"],
            ["öffentliche Einrichtungen sowie"],
            ["sonstige Organisationen."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Art und Umfang einzelner Leistungen können sich je nach Mitgliedschaft, Rolle oder Organisation unterscheiden.",
          ],
        },
      ],
    },
    {
      titel: "1.5 Begriffsdefinitionen",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Im Sinne dieser Allgemeinen Geschäftsbedingungen gelten folgende Begriffe:"],
        },
        {
          art: "zeilen",
          zeilen: [
            ["Nutzer"],
            ["Jede registrierte natürliche Person mit einem Benutzerkonto auf der Plattform."],
            ["Mitglied"],
            ["Ein Nutzer mit einer aktiven Mitgliedschaft."],
            ["Organisation"],
            [
              "Jede rechtliche oder organisatorische Einheit, insbesondere Unternehmen, Einzelunternehmen, Freiberufler, Vereine, Verbände, Stiftungen, Kommunen oder öffentliche Einrichtungen.",
            ],
            ["Plattform"],
            [
              "Die gesamte digitale Infrastruktur des Fair Business Club einschließlich Website, Mitgliederbereich, Community, Academy, Compass, Matching-System, Veranstaltungen sowie weiterer digitaler Funktionen.",
            ],
            ["Leistungen"],
            [
              "Alle kostenlosen und kostenpflichtigen Angebote des Anbieters, unabhängig davon, ob diese digital, persönlich oder hybrid erbracht werden.",
            ],
          ],
        },
      ],
    },
    {
      titel: "1.6 Ehrenkodex",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Ehrenkodex des Fair Business Club ist Bestandteil dieser Allgemeinen Geschäftsbedingungen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Mit der Registrierung erkennt jeder Nutzer den Ehrenkodex als gemeinsame Grundlage für das Verhalten innerhalb der Plattform an.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Verstöße gegen den Ehrenkodex können -- abhängig von Art und Schwere des Verstoßes -- zu Einschränkungen einzelner Funktionen, zum Ausschluss von Veranstaltungen oder zur Beendigung der Mitgliedschaft führen.",
          ],
        },
      ],
    },
    {
      titel: "1.7 Weiterentwicklung der Plattform",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter entwickelt die Plattform und ihre Leistungen kontinuierlich weiter.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Der Anbieter ist berechtigt, Funktionen, Inhalte und Angebote zu ergänzen, anzupassen oder weiterzuentwickeln, sofern dadurch der wesentliche Vertragszweck der jeweiligen Mitgliedschaft nicht beeinträchtigt wird.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Ein Anspruch auf die dauerhafte Bereitstellung bestimmter Funktionen, Inhalte oder technischer Ausgestaltungen besteht nicht, soweit deren Änderung oder Einstellung für den Nutzer zumutbar ist.",
          ],
        },
      ],
    },
    {
      titel: "2. Registrierung und Nutzerkonto",
      bloecke: [],
    },
    {
      titel: "2.1 Registrierung",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Die Nutzung der Plattform setzt grundsätzlich eine Registrierung voraus."],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Mit der Registrierung gibt der Nutzer ein verbindliches Angebot zum Abschluss eines Nutzungsvertrages auf Grundlage dieser Allgemeinen Geschäftsbedingungen ab.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Nutzungsvertrag kommt mit der Freischaltung des Benutzerkontos oder der Bestätigung der Registrierung durch den Anbieter zustande.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(4) Ein Anspruch auf Registrierung oder Aufnahme in die Plattform besteht nicht.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(5) Der Anbieter ist berechtigt, Registrierungen ohne Angabe von Gründen abzulehnen, sofern dem keine gesetzlichen Vorschriften entgegenstehen.",
          ],
        },
      ],
    },
    {
      titel: "2.2 Teilnahmeberechtigung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Die Plattform richtet sich an Verbraucher, Unternehmer sowie Organisationen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Verbraucher müssen bei der Registrierung mindestens 18 Jahre alt und unbeschränkt geschäftsfähig sein.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Unternehmer handeln bei der Registrierung im Rahmen ihrer gewerblichen oder selbständigen beruflichen Tätigkeit.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(4) Organisationen werden durch eine vertretungsberechtigte natürliche Person registriert.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(5) Der Anbieter ist berechtigt, geeignete Nachweise über Identität oder Vertretungsberechtigung anzufordern.",
          ],
        },
      ],
    },
    {
      titel: "2.3 Benutzerkonto",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Für jede natürliche Person darf grundsätzlich nur ein persönliches Benutzerkonto angelegt werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Das Benutzerkonto ist personenbezogen und darf ohne Zustimmung des Anbieters weder übertragen noch Dritten zur Nutzung überlassen werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Ein Nutzer kann mehreren Organisationen zugeordnet sein, sofern er hierzu berechtigt ist.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(4) Der Anbieter kann zusätzliche Benutzerrollen oder Organisationskonten für Unternehmen, Vereine, Kommunen oder sonstige Organisationen bereitstellen.",
          ],
        },
      ],
    },
    {
      titel: "2.4 Registrierungsdaten",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Nutzer verpflichtet sich, sämtliche Angaben vollständig, wahrheitsgemäß und aktuell zu halten.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Änderungen wesentlicher Angaben sind unverzüglich im Benutzerkonto zu aktualisieren.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Unrichtige oder unvollständige Angaben können zur Einschränkung einzelner Funktionen oder zur Sperrung des Benutzerkontos führen.",
          ],
        },
      ],
    },
    {
      titel: "2.5 Zugangsdaten",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Nutzer ist verpflichtet, seine Zugangsdaten sorgfältig aufzubewahren und vor dem Zugriff unbefugter Dritter zu schützen.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(2) Die Weitergabe der Zugangsdaten an Dritte ist unzulässig."],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Besteht der Verdacht eines Missbrauchs, ist der Nutzer verpflichtet, sein Passwort unverzüglich zu ändern und den Anbieter hierüber zu informieren.",
          ],
        },
      ],
    },
    {
      titel: "2.6 Verifizierung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter ist berechtigt, Nutzer, Organisationen sowie einzelne Angaben zu verifizieren.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Hierzu können insbesondere E-Mail-Adressen, Telefonnummern, Unternehmensdaten oder sonstige geeignete Nachweise verwendet werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Eine erfolgreiche Verifizierung stellt keine Aussage über Identität, Bonität, Seriosität, Qualifikation oder wirtschaftliche Leistungsfähigkeit eines Nutzers oder einer Organisation dar.",
          ],
        },
      ],
    },
    {
      titel: "2.7 Nutzerprofile",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Jeder Nutzer entscheidet im Rahmen der Plattformfunktionen selbst, welche Informationen veröffentlicht oder anderen Nutzern zugänglich gemacht werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Art und Umfang der Sichtbarkeit richten sich nach den jeweiligen Datenschutzeinstellungen, der Mitgliedschaft sowie den verfügbaren Plattformfunktionen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter ist berechtigt, Profile zu strukturieren, Kategorien zuzuordnen und Funktionen zur besseren Auffindbarkeit bereitzustellen.",
          ],
        },
      ],
    },
    {
      titel: "2.8 Organisationsprofile",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Berechtigte Nutzer können Organisationsprofile anlegen und verwalten."],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Mit dem Anlegen eines Organisationsprofils versichert der Nutzer, hierzu berechtigt zu sein.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter übernimmt keine Gewähr für die Richtigkeit der veröffentlichten Organisationsdaten.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(4) Ein Organisationsprofil kann künftig mehreren berechtigten Administratoren zugeordnet werden.",
          ],
        },
      ],
    },
    {
      titel: "2.9 Sperrung und Löschung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter ist berechtigt, Benutzerkonten vorübergehend oder dauerhaft einzuschränken oder zu sperren, wenn",
          ],
        },
        {
          art: "liste",
          punkte: [
            ["gegen diese Allgemeinen Geschäftsbedingungen verstoßen wird,"],
            ["der Ehrenkodex erheblich verletzt wird,"],
            ["unrichtige Angaben gemacht werden,"],
            ["rechtswidrige Inhalte veröffentlicht werden,"],
            ["Plattformfunktionen missbräuchlich genutzt werden oder"],
            ["berechtigte Interessen des Anbieters oder der Gemeinschaft dies erfordern."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Soweit möglich, erhält der Nutzer vor einer dauerhaften Sperrung Gelegenheit zur Stellungnahme.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(3) Gesetzliche Ansprüche der Vertragsparteien bleiben hiervon unberührt."],
        },
      ],
    },
    {
      titel: "2.10 Weiterentwicklung",
      bloecke: [
        { art: "absatz", inhalt: ["(1) Die Plattform wird kontinuierlich weiterentwickelt."] },
        {
          art: "absatz",
          inhalt: [
            "(2) Der Anbieter ist berechtigt, neue Benutzerrollen, Organisationsformen, Berechtigungskonzepte oder technische Funktionen einzuführen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Nutzer erklärt sich damit einverstanden, dass sein Benutzerkonto im Rahmen der technischen Weiterentwicklung an neue Plattformstrukturen angepasst werden kann, sofern dadurch keine wesentlichen Nachteile entstehen.",
          ],
        },
      ],
    },
    {
      titel: "3. Mitgliedschaften und Leistungen",
      bloecke: [],
    },
    {
      titel: "3.1 Mitgliedschaftsmodell",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Fair Business Club bietet kostenlose und kostenpflichtige Mitgliedschaften mit unterschiedlichen Leistungsumfängen an.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Der jeweilige Leistungsumfang richtet sich ausschließlich nach der zum Zeitpunkt des Vertragsschlusses veröffentlichten Leistungsbeschreibung.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter ist berechtigt, weitere Mitgliedschaftsmodelle, Zusatzleistungen oder individuelle Unternehmenslösungen einzuführen.",
          ],
        },
      ],
    },
    {
      titel: "3.2 Mitgliedschaftsstufen",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Der Anbieter bietet derzeit insbesondere folgende Mitgliedschaftsstufen an:"],
        },
        {
          art: "liste",
          punkte: [["Basic"], ["Connect"], ["Discover"], ["Exchange"], ["Focus"], ["Impact"]],
        },
        {
          art: "absatz",
          inhalt: [
            "Der Anbieter ist berechtigt, bestehende Mitgliedschaftsstufen weiterzuentwickeln oder zusätzliche Stufen einzuführen, sofern bestehende Vertragsverhältnisse hierdurch nicht unzumutbar beeinträchtigt werden.",
          ],
        },
      ],
    },
    {
      titel: "3.3 Leistungsumfang",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Die Mitgliedschaft berechtigt zur Nutzung der jeweils freigeschalteten Leistungen innerhalb der Plattform.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Hierzu können insbesondere gehören:"] },
        {
          art: "liste",
          punkte: [
            ["Nutzung der Plattform"],
            ["persönlicher Compass"],
            ["Empfehlungen"],
            ["Matching-Funktionen"],
            ["Academy"],
            ["Community"],
            ["Aktivitäten"],
            ["Veranstaltungen"],
            ["Mitgliederverzeichnis"],
            ["Organisationsprofile"],
            ["Anbieterprofile"],
            ["Nachrichtenfunktionen"],
            ["ActivePoints"],
            ["digitale Werkzeuge"],
            ["Partnerangebote"],
            ["Rabattprogramme"],
            ["weitere Plattformleistungen"],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der konkrete Leistungsumfang richtet sich ausschließlich nach der jeweiligen Mitgliedschaft.",
          ],
        },
      ],
    },
    {
      titel: "3.4 Freischaltung von Funktionen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Zugriff auf einzelne Funktionen richtet sich nach der gebuchten Mitgliedschaft.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Darüber hinaus kann die Nutzung einzelner Funktionen insbesondere abhängig sein von",
          ],
        },
        {
          art: "liste",
          punkte: [
            ["der Profilvollständigkeit,"],
            ["einer erfolgreichen Verifizierung,"],
            ["der Zustimmung zum Ehrenkodex,"],
            ["gesetzlichen Vorgaben,"],
            ["technischen Voraussetzungen,"],
            ["der jeweiligen Nutzerrolle oder"],
            ["dem Entwicklungsstand der Plattform."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter ist berechtigt, Funktionen schrittweise bereitzustellen oder zunächst als Testversion anzubieten.",
          ],
        },
      ],
    },
    {
      titel: "3.5 Digitale Leistungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Die Leistungen werden ganz oder teilweise digital erbracht."],
        },
        { art: "absatz", inhalt: ["(2) Hierzu gehören insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["die Online-Plattform,"],
            ["Mitgliederbereiche,"],
            ["Community-Funktionen,"],
            ["Academy,"],
            ["Veranstaltungen,"],
            ["Kommunikationsfunktionen,"],
            ["Compass,"],
            ["Matching,"],
            ["Empfehlungen sowie weitere digitale Dienste."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter ist berechtigt, technische Änderungen vorzunehmen, soweit hierdurch der vertragsgemäße Nutzen nicht wesentlich beeinträchtigt wird.",
          ],
        },
      ],
    },
    {
      titel: "3.6 Veranstaltungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Mitgliedschaften können die Teilnahme an Online- oder Präsenzveranstaltungen umfassen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Art, Umfang und Teilnahmebedingungen ergeben sich aus der jeweiligen Veranstaltung sowie der gebuchten Mitgliedschaft.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Reise-, Übernachtungs-, Verpflegungs-, Eintritts- und sonstige Nebenkosten sind grundsätzlich nicht Bestandteil der Mitgliedschaft, sofern nicht ausdrücklich etwas anderes vereinbart wurde.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(4) Der Anbieter ist berechtigt, Veranstaltungsorte, Termine, Referenten oder Programminhalte aus sachlichem Grund zu ändern, sofern dies für die Teilnehmer zumutbar ist.",
          ],
        },
      ],
    },
    {
      titel: "3.7 Community und Plattform",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Die Plattform dient der Vernetzung von Menschen und Organisationen."],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Der Anbieter stellt hierfür technische Möglichkeiten zur Kommunikation, Zusammenarbeit und Vernetzung bereit.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Ein Anspruch auf bestimmte Kontakte, Kooperationen oder Geschäftsbeziehungen besteht nicht.",
          ],
        },
      ],
    },
    {
      titel: "3.8 Empfehlungen und Matching",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Die Plattform kann auf Grundlage der vom Nutzer bereitgestellten Informationen Empfehlungen oder Matching-Vorschläge erzeugen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Diese Empfehlungen erfolgen automatisiert oder redaktionell und dienen ausschließlich der Unterstützung des Nutzers.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter übernimmt keine Gewähr für die Richtigkeit, Vollständigkeit, Aktualität oder Eignung der vorgeschlagenen Kontakte, Organisationen oder Empfehlungen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(4) Empfehlungen stellen weder eine Beratung noch eine Qualitäts-, Bonitäts- oder Erfolgszusage dar.",
          ],
        },
      ],
    },
    {
      titel: "3.9 Plattformentwicklung",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Der Anbieter entwickelt die Plattform kontinuierlich weiter."],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Funktionen, Inhalte, Mitgliedschaften oder Plattformbestandteile können ergänzt, geändert, zusammengeführt oder eingestellt werden, sofern dadurch der wesentliche Vertragszweck der jeweiligen Mitgliedschaft erhalten bleibt.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Neue Funktionen können zunächst einzelnen Nutzergruppen oder Mitgliedschaftsstufen zur Verfügung gestellt werden.",
          ],
        },
      ],
    },
    {
      titel: "3.10 Verfügbarkeit",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter bemüht sich um eine möglichst hohe Verfügbarkeit der Plattform.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Ein Anspruch auf eine jederzeit unterbrechungsfreie Nutzung besteht nicht.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Wartungsarbeiten, Sicherheitsmaßnahmen, technische Weiterentwicklungen oder Störungen außerhalb des Einflussbereichs des Anbieters können die Erreichbarkeit der Plattform vorübergehend einschränken.",
          ],
        },
      ],
    },
    {
      titel: "3.11 Kein Erfolgsversprechen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Fair Business Club stellt Werkzeuge, Informationen, Veranstaltungen sowie Möglichkeiten zur Vernetzung und Zusammenarbeit bereit.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Der Anbieter schuldet insbesondere keinen bestimmten"] },
        {
          art: "liste",
          punkte: [
            ["wirtschaftlichen Erfolg,"],
            ["Umsatz,"],
            ["Gewinn,"],
            ["Auftrag,"],
            ["Kunden,"],
            ["Investment,"],
            ["Geschäftsabschluss,"],
            ["Kooperationspartner oder"],
            ["sonstigen persönlichen oder beruflichen Erfolg."],
          ],
        },
        { art: "absatz", inhalt: ["(3) Die Nutzung der Plattform erfolgt eigenverantwortlich."] },
      ],
    },
    {
      titel: "4. Preise, Zahlung und ActivePoints",
      bloecke: [],
    },
    {
      titel: "4.1 Preise",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Für kostenpflichtige Mitgliedschaften gelten die zum Zeitpunkt des Vertragsschlusses veröffentlichten Preise.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Sämtliche Preise verstehen sich einschließlich der gesetzlichen Umsatzsteuer, soweit diese gesetzlich anfällt und nicht ausdrücklich anders ausgewiesen ist.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Maßgeblich sind die auf der Plattform oder im Bestellprozess veröffentlichten Preise.",
          ],
        },
      ],
    },
    {
      titel: "4.2 Zahlungsarten",
      bloecke: [
        { art: "absatz", inhalt: ["(1) Die Zahlung kann insbesondere erfolgen über"] },
        {
          art: "liste",
          punkte: [
            ["Stripe,"],
            ["SEPA-Lastschrift,"],
            ["Kreditkarte,"],
            ["PayPal,"],
            ["Überweisung,"],
            ["Rechnung oder"],
            ["weitere vom Anbieter angebotene Zahlungsarten."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Der Anbieter ist berechtigt, einzelne Zahlungsarten jederzeit zu ergänzen, einzuschränken oder einzustellen.",
          ],
        },
      ],
    },
    {
      titel: "4.3 Fälligkeit",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Mitgliedsbeiträge sind mit Beginn der jeweiligen Vertragslaufzeit fällig, sofern nichts anderes vereinbart wurde.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Wiederkehrende Beiträge werden entsprechend der gewählten Zahlungsperiode automatisch eingezogen oder in Rechnung gestellt.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Leistungsanspruch beginnt grundsätzlich mit erfolgreichem Zahlungseingang oder erfolgreicher Autorisierung der gewählten Zahlungsart.",
          ],
        },
      ],
    },
    {
      titel: "4.4 Rechnungsstellung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Rechnungen werden grundsätzlich in elektronischer Form erstellt und dem Mitglied über die Plattform oder per E-Mail zur Verfügung gestellt.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Das Mitglied erklärt sich mit der elektronischen Rechnungsstellung einverstanden.",
          ],
        },
      ],
    },
    {
      titel: "4.5 Zahlungsverzug",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Gerät ein Mitglied mit einer Zahlung in Verzug, ist der Anbieter berechtigt,",
          ],
        },
        {
          art: "liste",
          punkte: [
            ["den Zugang zur Plattform ganz oder teilweise einzuschränken,"],
            ["einzelne Leistungen vorübergehend auszusetzen,"],
            ["die Teilnahme an Veranstaltungen auszuschließen sowie"],
            ["gesetzliche Verzugsansprüche geltend zu machen."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Die Verpflichtung zur Zahlung der vereinbarten Beiträge bleibt hiervon unberührt.",
          ],
        },
      ],
    },
    {
      titel: "4.6 Rücklastschriften",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Kosten, die durch unberechtigte Rücklastschriften oder Rückbuchungen entstehen, trägt das Mitglied, soweit es diese zu vertreten hat.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Bis zum vollständigen Ausgleich offener Forderungen kann der Anbieter einzelne Leistungen aussetzen.",
          ],
        },
      ],
    },
    {
      titel: "4.7 Preisänderungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter ist berechtigt, Mitgliedsbeiträge für zukünftige Vertragszeiträume anzupassen, sofern hierfür ein sachlicher Grund besteht.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Preisänderungen werden den Mitgliedern mindestens sechs Wochen vor ihrem Inkrafttreten in Textform mitgeteilt.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Verbraucher haben bei einer erheblichen Preisänderung das gesetzlich vorgesehene Sonderkündigungsrecht.",
          ],
        },
      ],
    },
    {
      titel: "4.8 Gutscheine und Aktionsangebote",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Gutscheine, Rabattaktionen oder Sonderangebote gelten ausschließlich zu den jeweils veröffentlichten Bedingungen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Eine Barauszahlung oder nachträgliche Verrechnung ist ausgeschlossen, sofern nicht ausdrücklich etwas anderes vereinbart wurde.",
          ],
        },
      ],
    },
    {
      titel: "4.9 ActivePoints",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter kann innerhalb der Plattform ein Belohnungssystem unter der Bezeichnung ActivePoints bereitstellen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) ActivePoints dienen ausschließlich der Förderung von Engagement und Aktivität innerhalb der Plattform.",
          ],
        },
        { art: "absatz", inhalt: ["(3) ActivePoints können insbesondere vergeben werden für"] },
        {
          art: "liste",
          punkte: [
            ["die Vervollständigung des Compass,"],
            ["Beiträge,"],
            ["Kommentare,"],
            ["Bewertungen,"],
            ["Empfehlungen,"],
            ["Veranstaltungen,"],
            ["Academy-Aktivitäten,"],
            ["Community-Beiträge,"],
            ["erfolgreiche Einladungen,"],
            ["Profilpflege sowie"],
            ["weitere vom Anbieter definierte Aktivitäten."],
          ],
        },
      ],
    },
    {
      titel: "4.10 Rechtsnatur der ActivePoints",
      bloecke: [
        { art: "absatz", inhalt: ["(1) ActivePoints besitzen keinen Geldwert."] },
        {
          art: "absatz",
          inhalt: [
            "(2) ActivePoints sind kein Zahlungsmittel und begründen weder Eigentums- noch Vermögensrechte.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) ActivePoints können weder verkauft, übertragen, verschenkt, vererbt noch gegen Geld ausgezahlt werden.",
          ],
        },
      ],
    },
    {
      titel: "4.11 Nutzung der ActivePoints",
      bloecke: [
        { art: "absatz", inhalt: ["(1) ActivePoints können insbesondere verwendet werden für"] },
        {
          art: "liste",
          punkte: [
            ["Badges,"],
            ["Ranglisten,"],
            ["Auszeichnungen,"],
            ["Sichtbarkeit,"],
            ["besondere Funktionen,"],
            ["exklusive Inhalte,"],
            ["Gewinnspiele,"],
            ["Aktionen oder"],
            ["weitere Plattformvorteile."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Art und Umfang der jeweiligen Vorteile bestimmt ausschließlich der Anbieter.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(3) Ein Anspruch auf bestimmte Prämien oder Vorteile besteht nicht."],
        },
      ],
    },
    {
      titel: "4.12 Änderungen des ActivePoints-Systems",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter ist berechtigt, das ActivePoints-System jederzeit weiterzuentwickeln, anzupassen oder einzustellen.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Dies umfasst insbesondere Änderungen"] },
        {
          art: "liste",
          punkte: [
            ["der Vergaberegeln,"],
            ["der Bewertungslogik,"],
            ["der Ranglisten,"],
            ["der Einlösemöglichkeiten,"],
            ["der Badges sowie"],
            ["sämtlicher weiterer Bestandteile des Systems."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Bereits gesammelte ActivePoints können im Rahmen einer Systemumstellung angepasst oder in ein neues Bewertungssystem überführt werden.",
          ],
        },
      ],
    },
    {
      titel: "4.13 Missbrauch",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) ActivePoints können ganz oder teilweise gelöscht werden, wenn sie durch"],
        },
        {
          art: "liste",
          punkte: [
            ["Mehrfachkonten,"],
            ["Manipulation,"],
            ["automatisierte Aktivitäten,"],
            ["Spam,"],
            ["missbräuchliches Verhalten,"],
            ["Verstöße gegen den Ehrenkodex oder"],
            ["sonstige unzulässige Maßnahmen"],
          ],
        },
        { art: "absatz", inhalt: ["erlangt wurden."] },
        {
          art: "absatz",
          inhalt: ["(2) Weitergehende Rechte des Anbieters bleiben hiervon unberührt."],
        },
      ],
    },
    {
      titel: "4.14 Freiwillige Zusatzleistung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Das ActivePoints-System stellt eine freiwillige Zusatzleistung des Anbieters dar.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Es besteht kein Anspruch auf die dauerhafte Bereitstellung oder unveränderte Fortführung dieses Systems.",
          ],
        },
      ],
    },
    {
      titel: "5. Compass, Matching und Empfehlungen",
      bloecke: [],
    },
    {
      titel: "5.1 Grundgedanke",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Fair Business Club unterstützt seine Nutzer dabei, persönliche und unternehmerische Potenziale zu erkennen sowie passende Menschen, Organisationen, Inhalte und Chancen miteinander zu verbinden.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Hierzu stellt der Anbieter insbesondere den Compass, intelligente Empfehlungsfunktionen sowie Matching-Systeme zur Verfügung.",
          ],
        },
      ],
    },
    {
      titel: "5.2 Compass",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Compass dient der Erfassung persönlicher Interessen, Kompetenzen, Ziele, Erfahrungen, Bedürfnisse sowie weiterer freiwilliger Angaben.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Die Nutzung des Compass erfolgt freiwillig."] },
        {
          art: "absatz",
          inhalt: [
            "(3) Je vollständiger die Angaben des Nutzers sind, desto zielgerichteter können Empfehlungen und Matching-Vorschläge erfolgen.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(4) Der Nutzer ist für die Richtigkeit seiner Angaben selbst verantwortlich."],
        },
      ],
    },
    {
      titel: "5.3 Matching",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Auf Grundlage der vom Nutzer bereitgestellten Informationen kann die Plattform passende Personen, Organisationen, Veranstaltungen, Communities, Inhalte oder sonstige Chancen empfehlen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Das Matching kann automatisiert, algorithmisch, KI-gestützt oder redaktionell erfolgen.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(3) Ein Anspruch auf bestimmte Matching-Ergebnisse besteht nicht."],
        },
      ],
    },
    {
      titel: "5.4 Empfehlungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Empfehlungen dienen ausschließlich der Orientierung und Unterstützung des Nutzers.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Empfehlungen stellen weder eine Beratung noch eine verbindliche Handlungsempfehlung dar.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Nutzer entscheidet eigenverantwortlich, ob und in welchem Umfang er Empfehlungen nutzt.",
          ],
        },
      ],
    },
    {
      titel: "5.5 Sichtbarkeit",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Die Sichtbarkeit eines Profils richtet sich insbesondere nach"],
        },
        {
          art: "liste",
          punkte: [
            ["der jeweiligen Mitgliedschaft,"],
            ["den Datenschutzeinstellungen,"],
            ["der Profilvollständigkeit,"],
            ["der Aktivität innerhalb der Plattform,"],
            ["den ActivePoints,"],
            ["den jeweiligen Plattformfunktionen."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Der Anbieter kann die Darstellung von Profilen nach objektiven Kriterien strukturieren oder priorisieren.",
          ],
        },
      ],
    },
    {
      titel: "5.6 Kontaktvorschläge",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Die Plattform kann dem Nutzer passende Kontakte vorschlagen."],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Ein Kontaktvorschlag begründet keinerlei Verpflichtung zur Kontaktaufnahme.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(3) Nutzer entscheiden selbst, ob sie Kontaktanfragen annehmen oder ablehnen."],
        },
      ],
    },
    {
      titel: "5.7 Organisationsempfehlungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Neben Personen können auch Organisationen empfohlen werden."],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Hierzu zählen insbesondere Unternehmen, Vereine, Verbände, Kommunen, Stiftungen oder sonstige Organisationen.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(3) Auch hierbei besteht kein Anspruch auf Vollständigkeit oder Aktualität."],
        },
      ],
    },
    {
      titel: "5.8 Veranstaltungen und Communities",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Die Plattform kann dem Nutzer passende Veranstaltungen, Communities oder sonstige Aktivitäten empfehlen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Empfehlungen erfolgen auf Grundlage der jeweiligen Plattformdaten sowie der freiwilligen Angaben des Nutzers.",
          ],
        },
      ],
    },
    {
      titel: "5.9 KI-gestützte Empfehlungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter ist berechtigt, künstliche Intelligenz zur Verbesserung der Plattform sowie der Empfehlungs- und Matching-Funktionen einzusetzen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Hierbei können insbesondere Interessen, Aktivitäten, Mitgliedschaften oder freiwillig bereitgestellte Informationen berücksichtigt werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(3) Automatisierte Empfehlungen ersetzen keine persönliche Beratung."],
        },
      ],
    },
    {
      titel: "5.10 Keine Garantie",
      bloecke: [
        { art: "absatz", inhalt: ["(1) Der Anbieter übernimmt keine Gewähr für"] },
        {
          art: "liste",
          punkte: [
            ["die Richtigkeit,"],
            ["die Vollständigkeit,"],
            ["die Aktualität,"],
            ["die Qualität,"],
            ["die Bonität,"],
            ["die Seriosität,"],
            ["die Verfügbarkeit oder"],
            ["den Erfolg"],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "von vorgeschlagenen Personen, Organisationen, Veranstaltungen oder sonstigen Empfehlungen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Sämtliche Kontakte und Kooperationen erfolgen ausschließlich auf eigenes Risiko der beteiligten Nutzer.",
          ],
        },
      ],
    },
    {
      titel: "5.11 Eigenverantwortung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Jeder Nutzer entscheidet eigenverantwortlich über die Nutzung der Plattform sowie über sämtliche Kontakte, Empfehlungen und Kooperationen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Der Anbieter wird weder Vertragspartei noch Vermittler einzelner Geschäfte zwischen den Nutzern, sofern ausdrücklich nichts anderes vereinbart wurde.",
          ],
        },
      ],
    },
    {
      titel: "5.12 Weiterentwicklung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter entwickelt Compass, Matching sowie sämtliche Empfehlungsfunktionen kontinuierlich weiter.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Hierzu können insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["neue Algorithmen,"],
            ["KI-Modelle,"],
            ["Bewertungsverfahren,"],
            ["Filter,"],
            ["Suchfunktionen,"],
            ["Scoring-Modelle,"],
            ["Empfehlungssysteme oder"],
            ["weitere Technologien"],
          ],
        },
        { art: "absatz", inhalt: ["eingeführt, verändert oder ersetzt werden."] },
        {
          art: "absatz",
          inhalt: [
            "(3) Ein Anspruch auf die dauerhafte Nutzung bestimmter Matching-Methoden oder Algorithmen besteht nicht.",
          ],
        },
      ],
    },
    {
      titel: "6. Community, Inhalte und Verhaltensregeln",
      bloecke: [],
    },
    {
      titel: "6.1 Grundsatz",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Fair Business Club versteht sich als vertrauensvolle Gemeinschaft zur persönlichen und unternehmerischen Entwicklung.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Grundlage der Zusammenarbeit sind gegenseitiger Respekt, Fairness, Integrität und der Ehrenkodex des Fair Business Club.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Jeder Nutzer trägt durch sein Verhalten zur Qualität und Attraktivität der Plattform bei.",
          ],
        },
      ],
    },
    {
      titel: "6.2 Ehrenkodex",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Der Ehrenkodex ist Bestandteil dieser Allgemeinen Geschäftsbedingungen."],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Mit der Registrierung verpflichtet sich jeder Nutzer, die dort beschriebenen Grundsätze einzuhalten.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Ehrenkodex gilt für sämtliche Aktivitäten innerhalb der Plattform sowie für Veranstaltungen und sonstige Leistungen des Anbieters.",
          ],
        },
      ],
    },
    {
      titel: "6.3 Eigene Inhalte",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Nutzer können im Rahmen der Plattform eigene Inhalte veröffentlichen."],
        },
        { art: "absatz", inhalt: ["Hierzu gehören insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["Beiträge,"],
            ["Kommentare,"],
            ["Bilder,"],
            ["Videos,"],
            ["Dokumente,"],
            ["Bewertungen,"],
            ["Veranstaltungen,"],
            ["Angebote,"],
            ["Gesuche,"],
            ["Nachrichten sowie"],
            ["sonstige Inhalte."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Der Nutzer ist ausschließlich für die von ihm veröffentlichten Inhalte verantwortlich.",
          ],
        },
      ],
    },
    {
      titel: "6.4 Zulässige Inhalte",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Der Nutzer verpflichtet sich, ausschließlich Inhalte zu veröffentlichen,"],
        },
        {
          art: "liste",
          punkte: [
            ["die rechtmäßig sind,"],
            ["keine Rechte Dritter verletzen,"],
            ["keine irreführenden Angaben enthalten,"],
            ["nicht diskriminierend,"],
            ["nicht beleidigend,"],
            ["nicht volksverhetzend,"],
            ["nicht pornografisch,"],
            ["nicht gewaltverherrlichend oder"],
            ["sonst rechtswidrig sind."],
          ],
        },
      ],
    },
    {
      titel: "6.5 Unzulässiges Verhalten",
      bloecke: [
        { art: "absatz", inhalt: ["Insbesondere untersagt sind"] },
        {
          art: "liste",
          punkte: [
            ["Spam,"],
            ["Massenanschreiben,"],
            ["aggressive Akquise,"],
            ["Kettennachrichten,"],
            ["Fake-Profile,"],
            ["Identitätsmissbrauch,"],
            ["automatisierte Datensammlung,"],
            ["Manipulation von Bewertungen,"],
            ["Manipulation von ActivePoints,"],
            ["Umgehung technischer Schutzmaßnahmen,"],
            ["Verbreitung von Schadsoftware,"],
            ["Belästigung anderer Nutzer,"],
            ["Veröffentlichung vertraulicher Informationen,"],
            ["gezielte Schädigung anderer Nutzer oder der Plattform."],
          ],
        },
      ],
    },
    {
      titel: "6.6 Werbung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Werbung ist ausschließlich im Rahmen der jeweiligen Mitgliedschaft sowie der hierfür vorgesehenen Plattformfunktionen zulässig.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Unaufgeforderte Werbenachrichten oder massenhafte Kontaktaufnahmen sind unzulässig.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter ist berechtigt, werbliche Inhalte zu entfernen, wenn diese gegen diese AGB oder den Ehrenkodex verstoßen.",
          ],
        },
      ],
    },
    {
      titel: "6.7 Bewertungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Nutzer können Personen, Organisationen oder Leistungen bewerten, soweit entsprechende Funktionen angeboten werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(2) Bewertungen müssen sachlich, wahrheitsgemäß und nachvollziehbar sein."],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Beleidigende, diffamierende oder bewusst falsche Bewertungen sind unzulässig.",
          ],
        },
      ],
    },
    {
      titel: "6.8 Meldung von Inhalten",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Nutzer können Inhalte melden, die gegen diese Allgemeinen Geschäftsbedingungen oder geltendes Recht verstoßen.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(2) Der Anbieter prüft gemeldete Inhalte nach pflichtgemäßem Ermessen."],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Ein Anspruch auf Entfernung bestimmter Inhalte besteht nicht, soweit keine gesetzlichen Verpflichtungen entgegenstehen.",
          ],
        },
      ],
    },
    {
      titel: "6.9 Moderation",
      bloecke: [
        { art: "absatz", inhalt: ["(1) Der Anbieter ist berechtigt,"] },
        {
          art: "liste",
          punkte: [
            ["Inhalte auszublenden,"],
            ["Inhalte zu bearbeiten,"],
            ["Inhalte zu löschen,"],
            ["Kommentare zu schließen,"],
            ["Funktionen einzuschränken,"],
            ["Nutzer zeitweise oder dauerhaft zu sperren,"],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "wenn dies zur Einhaltung dieser AGB, des Ehrenkodex oder gesetzlicher Vorschriften erforderlich ist.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Soweit möglich, wird der betroffene Nutzer vor einer endgültigen Maßnahme angehört.",
          ],
        },
      ],
    },
    {
      titel: "6.10 Nutzungsrechte",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Nutzer bleibt Inhaber sämtlicher Rechte an seinen eingestellten Inhalten.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Mit der Veröffentlichung räumt der Nutzer dem Anbieter das nicht ausschließliche, räumlich und zeitlich auf die Dauer der Veröffentlichung beschränkte Recht ein, diese Inhalte zum Betrieb, zur Darstellung, Speicherung, Vervielfältigung und technischen Verarbeitung innerhalb der Plattform zu nutzen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Dieses Nutzungsrecht endet grundsätzlich mit der Löschung des jeweiligen Inhalts, soweit keine gesetzlichen Aufbewahrungspflichten bestehen.",
          ],
        },
      ],
    },
    {
      titel: "6.11 Schutz der Community",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Die missbräuchliche Nutzung von Kontakten, Community-Strukturen oder Plattforminformationen zum Aufbau konkurrierender Netzwerke oder zur gezielten Abwerbung von Mitgliedern ist unzulässig.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Zulässige geschäftliche Kontakte innerhalb der Plattform bleiben hiervon unberührt.",
          ],
        },
      ],
    },
    {
      titel: "6.12 Konsequenzen bei Verstößen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Bei Verstößen gegen diese Allgemeinen Geschäftsbedingungen oder den Ehrenkodex ist der Anbieter berechtigt,",
          ],
        },
        {
          art: "liste",
          punkte: [
            ["Inhalte zu entfernen,"],
            ["Funktionen einzuschränken,"],
            ["ActivePoints anzupassen oder zu löschen,"],
            ["Nutzer zeitweise oder dauerhaft zu sperren,"],
            ["Mitgliedschaften außerordentlich zu kündigen sowie"],
            ["weitere gesetzliche Ansprüche geltend zu machen."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Die Wahl der Maßnahme richtet sich nach Art, Schwere und Häufigkeit des jeweiligen Verstoßes.",
          ],
        },
      ],
    },
    {
      titel: "7. Academy, digitale Inhalte und Urheberrechte",
      bloecke: [],
    },
    {
      titel: "7.1 Leistungsumfang",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter stellt im Rahmen der jeweiligen Mitgliedschaft digitale Inhalte und Lernangebote zur Verfügung.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Hierzu können insbesondere gehören:"] },
        {
          art: "liste",
          punkte: [
            ["Videos,"],
            ["Online-Kurse,"],
            ["Dokumente,"],
            ["Checklisten,"],
            ["Vorlagen,"],
            ["Podcasts,"],
            ["Webinare,"],
            ["Live-Trainings,"],
            ["Aufzeichnungen,"],
            ["KI-gestützte Lernangebote sowie"],
            ["weitere digitale Inhalte."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Art und Umfang der verfügbaren Inhalte richten sich nach der jeweiligen Mitgliedschaft.",
          ],
        },
      ],
    },
    {
      titel: "7.2 Nutzungsrecht",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter räumt dem Mitglied für die Dauer der jeweiligen Mitgliedschaft ein einfaches, nicht übertragbares und widerrufliches Nutzungsrecht an den bereitgestellten Inhalten ein.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Die Nutzung erfolgt ausschließlich für eigene private oder berufliche Zwecke des Mitglieds.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Eine weitergehende Nutzung bedarf der vorherigen schriftlichen Zustimmung des Anbieters.",
          ],
        },
      ],
    },
    {
      titel: "7.3 Urheberrechte",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Sämtliche Inhalte der Plattform unterliegen dem Urheberrecht oder anderen Schutzrechten.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Dies gilt insbesondere für"] },
        {
          art: "liste",
          punkte: [
            ["Texte,"],
            ["Videos,"],
            ["Bilder,"],
            ["Grafiken,"],
            ["Logos,"],
            ["Marken,"],
            ["Dokumente,"],
            ["Präsentationen,"],
            ["Vorlagen,"],
            ["Software,"],
            ["Datenbanken sowie"],
            ["sämtliche sonstigen Inhalte."],
          ],
        },
        {
          art: "absatz",
          inhalt: ["(3) Sämtliche Rechte verbleiben beim jeweiligen Rechteinhaber."],
        },
      ],
    },
    {
      titel: "7.4 Unzulässige Nutzung",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Ohne ausdrückliche Zustimmung des Anbieters ist insbesondere untersagt,"],
        },
        {
          art: "liste",
          punkte: [
            ["Inhalte zu kopieren,"],
            ["Inhalte herunterzuladen, soweit keine Downloadfunktion vorgesehen ist,"],
            ["Inhalte zu vervielfältigen,"],
            ["Inhalte weiterzugeben,"],
            ["Inhalte öffentlich zugänglich zu machen,"],
            ["Inhalte zu verkaufen,"],
            ["Inhalte zu lizenzieren,"],
            ["Inhalte für konkurrierende Plattformen zu verwenden oder"],
            ["Inhalte in sonstiger Weise wirtschaftlich zu verwerten."],
          ],
        },
      ],
    },
    {
      titel: "7.5 Downloads",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Soweit der Anbieter Downloads zur Verfügung stellt, dürfen diese ausschließlich im Rahmen der eingeräumten Nutzungsrechte verwendet werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Die Weitergabe an Dritte ist unzulässig, sofern der Anbieter dies nicht ausdrücklich gestattet.",
          ],
        },
      ],
    },
    {
      titel: "7.6 Aufzeichnungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Online-Veranstaltungen oder Live-Trainings können aufgezeichnet werden."],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Der Anbieter entscheidet, ob und in welchem Umfang Aufzeichnungen den Mitgliedern zur Verfügung gestellt werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(3) Ein Anspruch auf Bereitstellung einer Aufzeichnung besteht nicht."],
        },
      ],
    },
    {
      titel: "7.7 Eigene Inhalte der Mitglieder",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Mitglieder können im Rahmen der Academy eigene Inhalte einstellen, sofern entsprechende Funktionen angeboten werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Das Mitglied versichert, dass es über sämtliche hierfür erforderlichen Rechte verfügt.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Das Mitglied stellt den Anbieter von sämtlichen Ansprüchen Dritter frei, die aufgrund einer Verletzung von Schutzrechten entstehen.",
          ],
        },
      ],
    },
    {
      titel: "7.8 KI-gestützte Inhalte",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter ist berechtigt, künstliche Intelligenz zur Erstellung, Zusammenfassung, Übersetzung oder Individualisierung von Lerninhalten einzusetzen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) KI-generierte Inhalte dienen ausschließlich der Information und ersetzen keine individuelle Beratung.",
          ],
        },
      ],
    },
    {
      titel: "7.9 Änderungen des Lernangebots",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Der Anbieter entwickelt die Academy kontinuierlich weiter."],
        },
        {
          art: "absatz",
          inhalt: ["(2) Inhalte können ergänzt, aktualisiert, ersetzt oder entfernt werden."],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Ein Anspruch auf die dauerhafte Verfügbarkeit einzelner Kurse oder Inhalte besteht nicht.",
          ],
        },
      ],
    },
    {
      titel: "7.10 Zertifikate und Teilnahmebestätigungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter kann Teilnahmebestätigungen, Zertifikate oder sonstige Nachweise ausstellen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Ein Anspruch hierauf besteht nur, sofern dies ausdrücklich Bestandteil der jeweiligen Leistung ist.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Zertifikate bestätigen ausschließlich die Teilnahme oder den erfolgreichen Abschluss einer angebotenen Maßnahme. Sie stellen keinen staatlich anerkannten Ausbildungs- oder Berufsabschluss dar.",
          ],
        },
      ],
    },
    {
      titel: "7.11 Geistiges Eigentum",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Sämtliche Marken, Logos, Bezeichnungen, Konzepte, Methoden, Plattformfunktionen und sonstigen Kennzeichen des Anbieters bleiben dessen geistiges Eigentum.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Die Nutzung dieser Kennzeichen außerhalb der Plattform bedarf der vorherigen schriftlichen Zustimmung des Anbieters.",
          ],
        },
      ],
    },
    {
      titel: "7.12 Vertragsverletzungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Verstöße gegen die Bestimmungen dieses Kapitels können insbesondere zum Entzug von Nutzungsrechten, zur Sperrung des Benutzerkontos, zur außerordentlichen Kündigung der Mitgliedschaft sowie zur Geltendmachung zivil- und strafrechtlicher Ansprüche führen.",
          ],
        },
      ],
    },
    {
      titel: "8. Veranstaltungen, Communities und Organisationen",
      bloecke: [],
    },
    {
      titel: "8.1 Veranstaltungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter veranstaltet oder vermittelt Online-, Hybrid- und Präsenzveranstaltungen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Art, Umfang, Teilnahmevoraussetzungen und Teilnehmerzahl ergeben sich aus der jeweiligen Veranstaltungsbeschreibung.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter ist berechtigt, Veranstaltungen gemeinsam mit Partnern oder Dritten durchzuführen.",
          ],
        },
      ],
    },
    {
      titel: "8.2 Anmeldung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Die Anmeldung zu Veranstaltungen erfolgt über die Plattform oder über die jeweils angebotenen Anmeldeverfahren.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Ein Anspruch auf Teilnahme besteht nur nach erfolgreicher Anmeldung und -- soweit erforderlich -- vollständiger Bezahlung der Teilnahmegebühr.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Bei begrenzter Teilnehmerzahl entscheidet grundsätzlich die Reihenfolge der Anmeldungen, sofern nichts anderes angegeben ist.",
          ],
        },
      ],
    },
    {
      titel: "8.3 Änderungen und Absagen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter ist berechtigt, Veranstaltungen aus sachlichem Grund zu verschieben, abzusagen oder in ein Online-Format umzuwandeln.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Sachliche Gründe sind insbesondere:"] },
        {
          art: "liste",
          punkte: [
            ["Krankheit von Referenten,"],
            ["höhere Gewalt,"],
            ["behördliche Anordnungen,"],
            ["technische Ausfälle,"],
            ["Sicherheitsgründe,"],
            ["eine zu geringe Teilnehmerzahl oder"],
            ["sonstige Umstände außerhalb des Einflussbereichs des Anbieters."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Weitergehende Ansprüche bestehen nur im Rahmen der gesetzlichen Vorschriften.",
          ],
        },
      ],
    },
    {
      titel: "8.4 Teilnahme",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Teilnehmer verpflichten sich zu einem respektvollen und kooperativen Verhalten.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(2) Der Ehrenkodex gilt uneingeschränkt auch für sämtliche Veranstaltungen."],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter ist berechtigt, Teilnehmer bei erheblichen Verstößen von einer Veranstaltung auszuschließen.",
          ],
        },
      ],
    },
    {
      titel: "8.5 Foto-, Video- und Tonaufnahmen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Bei Veranstaltungen können Foto-, Video- oder Tonaufnahmen angefertigt werden.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Diese können insbesondere für"] },
        {
          art: "liste",
          punkte: [
            ["Dokumentation,"],
            ["Berichterstattung,"],
            ["Marketing,"],
            ["Social Media,"],
            ["Website,"],
            ["Academy oder"],
            ["zukünftige Veranstaltungen"],
          ],
        },
        { art: "absatz", inhalt: ["verwendet werden."] },
        {
          art: "absatz",
          inhalt: [
            "(3) Soweit gesetzlich erforderlich, erfolgt die Verarbeitung personenbezogener Daten auf Grundlage einer gesonderten Einwilligung oder einer gesetzlichen Erlaubnis.",
          ],
        },
      ],
    },
    {
      titel: "8.6 Communities",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Die Plattform ermöglicht die Bildung und Nutzung von Communities."],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Communities können insbesondere thematisch, regional oder projektbezogen organisiert werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter kann Communities selbst betreiben oder deren Verwaltung geeigneten Moderatoren oder Community-Hosts übertragen.",
          ],
        },
      ],
    },
    {
      titel: "8.7 Community-Hosts",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Community-Hosts unterstützen die Organisation und Moderation einzelner Communities.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Community-Hosts handeln ausschließlich im Rahmen der ihnen eingeräumten Rechte.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Sie sind nicht berechtigt, den Anbieter rechtsgeschäftlich zu vertreten, sofern hierzu keine ausdrückliche Bevollmächtigung besteht.",
          ],
        },
      ],
    },
    {
      titel: "8.8 Organisationen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Die Plattform ermöglicht die Darstellung und Verwaltung von Organisationsprofilen.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Organisationen können insbesondere sein:"] },
        {
          art: "liste",
          punkte: [
            ["Unternehmen,"],
            ["Einzelunternehmen,"],
            ["Freiberufler,"],
            ["Vereine,"],
            ["Verbände,"],
            ["Stiftungen,"],
            ["Kommunen,"],
            ["öffentliche Einrichtungen sowie"],
            ["sonstige Organisationen."],
          ],
        },
      ],
    },
    {
      titel: "8.9 Organisationsadministratoren",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Organisationen können einen oder mehrere Administratoren benennen."],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Der Administrator versichert, zur Verwaltung der jeweiligen Organisation berechtigt zu sein.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter ist berechtigt, geeignete Nachweise über diese Berechtigung zu verlangen.",
          ],
        },
      ],
    },
    {
      titel: "8.10 Anbieterprofile",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Je nach Mitgliedschaft können Nutzer oder Organisationen Anbieterprofile veröffentlichen.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(2) Anbieterprofile dienen ausschließlich der Information anderer Nutzer."],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter übernimmt keine Gewähr für die Richtigkeit, Vollständigkeit oder Aktualität der dort veröffentlichten Angaben.",
          ],
        },
      ],
    },
    {
      titel: "8.11 Geschäfte zwischen Nutzern",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Sämtliche Verträge, Kooperationen, Empfehlungen oder Geschäftsabschlüsse zwischen Nutzern oder Organisationen erfolgen ausschließlich im eigenen Namen und auf eigene Verantwortung der Beteiligten.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(2) Der Anbieter wird hierbei grundsätzlich nicht Vertragspartei."],
        },
        { art: "absatz", inhalt: ["(3) Der Anbieter übernimmt insbesondere keine Haftung für"] },
        {
          art: "liste",
          punkte: [
            ["Vertragsabschlüsse,"],
            ["Zahlungsfähigkeit,"],
            ["Leistungsqualität,"],
            ["wirtschaftlichen Erfolg,"],
            ["Bonität,"],
            ["Seriosität oder"],
            ["die Erfüllung von Vereinbarungen zwischen den Beteiligten."],
          ],
        },
      ],
    },
    {
      titel: "8.12 Weiterentwicklung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter ist berechtigt, neue Veranstaltungsformate, Community-Modelle, Organisationsformen oder Rollen einzuführen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Ein Anspruch auf die dauerhafte Bereitstellung einzelner Veranstaltungs-, Community- oder Organisationsfunktionen besteht nicht.",
          ],
        },
      ],
    },
    {
      titel: "9. Vertragslaufzeit, Kündigung und Widerrufsrecht",
      bloecke: [],
    },
    {
      titel: "9.1 Vertragsbeginn",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Vertrag beginnt mit dem erfolgreichen Abschluss der Registrierung oder -- bei kostenpflichtigen Mitgliedschaften -- mit dem Abschluss des jeweiligen Mitgliedschaftsvertrages.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Kostenpflichtige Leistungen können erst nach erfolgreicher Zahlung oder erfolgreicher Autorisierung der gewählten Zahlungsart genutzt werden.",
          ],
        },
      ],
    },
    {
      titel: "9.2 Laufzeit",
      bloecke: [
        { art: "absatz", inhalt: ["(1) Kostenlose Mitgliedschaften laufen auf unbestimmte Zeit."] },
        {
          art: "absatz",
          inhalt: [
            "(2) Kostenpflichtige Mitgliedschaften werden für die jeweils vereinbarte Vertragslaufzeit abgeschlossen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Soweit nichts anderes vereinbart wurde, beträgt die Erstlaufzeit zwölf Monate.",
          ],
        },
      ],
    },
    {
      titel: "9.3 Vertragsverlängerung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Für Verbraucher verlängert sich der Vertrag nach Ablauf der vereinbarten Erstlaufzeit auf unbestimmte Zeit, sofern keine Kündigung erfolgt.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Nach Ablauf der Erstlaufzeit können Verbraucher ihre Mitgliedschaft jederzeit mit einer Frist von einem Monat kündigen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Für Unternehmer verlängert sich die Mitgliedschaft nach Ablauf der vereinbarten Vertragslaufzeit jeweils um ein weiteres Jahr, sofern sie nicht mit einer Frist von vier Wochen zum Ende der jeweiligen Vertragslaufzeit gekündigt wird.",
          ],
        },
      ],
    },
    {
      titel: "9.4 Kündigung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Die Kündigung kann in Textform erfolgen, insbesondere per E-Mail oder über eine hierfür vorgesehene Funktion innerhalb der Plattform.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(2) Maßgeblich ist der rechtzeitige Zugang der Kündigung beim Anbieter."],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Bereits entstandene Zahlungsansprüche bleiben von einer Kündigung unberührt.",
          ],
        },
      ],
    },
    {
      titel: "9.5 Außerordentliche Kündigung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt für beide Vertragsparteien unberührt.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Ein wichtiger Grund liegt insbesondere vor, wenn"] },
        {
          art: "liste",
          punkte: [
            ["gegen diese Allgemeinen Geschäftsbedingungen verstoßen wird,"],
            ["der Ehrenkodex erheblich verletzt wird,"],
            ["gesetzliche Vorschriften verletzt werden,"],
            ["die Plattform missbräuchlich genutzt wird,"],
            ["vorsätzlich falsche Angaben gemacht werden,"],
            ["andere Nutzer erheblich geschädigt werden oder"],
            ["das Vertrauensverhältnis nachhaltig zerstört wird."],
          ],
        },
      ],
    },
    {
      titel: "9.6 Folgen der Kündigung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Mit Beendigung der Mitgliedschaft endet der Anspruch auf die Nutzung kostenpflichtiger Leistungen.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Gesetzliche Aufbewahrungspflichten bleiben unberührt."] },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter ist berechtigt, Benutzerkonten nach Ablauf gesetzlicher Aufbewahrungsfristen zu löschen oder zu anonymisieren.",
          ],
        },
      ],
    },
    {
      titel: "9.7 Widerrufsrecht für Verbraucher",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Verbrauchern steht bei Fernabsatzverträgen das gesetzliche Widerrufsrecht zu.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Die Einzelheiten ergeben sich aus der gesonderten Widerrufsbelehrung, die Bestandteil des jeweiligen Bestellprozesses ist.",
          ],
        },
      ],
    },
    {
      titel: "9.8 Vorzeitiger Leistungsbeginn",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Verlangt der Verbraucher ausdrücklich, dass der Anbieter bereits vor Ablauf der Widerrufsfrist mit der Leistungserbringung beginnt, erklärt er sich damit einverstanden.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Der Anbieter informiert den Verbraucher darüber, dass bei vollständiger Vertragserfüllung das gesetzliche Widerrufsrecht gemäß § 356 Abs. 4 BGB erlischt.",
          ],
        },
      ],
    },
    {
      titel: "9.9 Wertersatz",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Widerruft der Verbraucher den Vertrag, nachdem er ausdrücklich den Beginn der Leistungserbringung verlangt hat, ist Wertersatz nach den gesetzlichen Vorschriften zu leisten.",
          ],
        },
      ],
    },
    {
      titel: "9.10 Ruhezeiten und Unterbrechungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter kann Mitgliedschaften auf Antrag des Mitglieds vorübergehend ruhen lassen, sofern hierfür ein entsprechendes Angebot besteht.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Ein Anspruch auf eine Ruhezeit besteht nicht."] },
      ],
    },
    {
      titel: "9.11 Übertragung der Mitgliedschaft",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Die Mitgliedschaft ist grundsätzlich personenbezogen und nicht übertragbar.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(2) Ausnahmen bedürfen der vorherigen Zustimmung des Anbieters."],
        },
      ],
    },
    {
      titel: "9.12 Fortentwicklung des Vertragsmodells",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Der Anbieter ist berechtigt, zukünftige Vertragsmodelle, Laufzeiten oder Kündigungsregelungen einzuführen, soweit hierdurch bestehende gesetzliche oder vertragliche Rechte der Mitglieder nicht beeinträchtigt werden.",
          ],
        },
      ],
    },
    {
      titel: "10. Haftung, Datenschutz und Schlussbestimmungen",
      bloecke: [],
    },
    {
      titel: "10.1 Haftung des Anbieters",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter haftet unbeschränkt für Schäden, die vorsätzlich oder grob fahrlässig verursacht wurden.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Bei einfacher Fahrlässigkeit haftet der Anbieter nur bei der Verletzung wesentlicher Vertragspflichten (Kardinalpflichten). In diesem Fall ist die Haftung auf den vertragstypischen und vorhersehbaren Schaden begrenzt.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Die Haftungsbeschränkungen gelten nicht bei Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie in den Fällen zwingender gesetzlicher Haftung.",
          ],
        },
      ],
    },
    {
      titel: "10.2 Haftung für Plattforminhalte",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter erstellt oder veröffentlicht nicht sämtliche Inhalte der Plattform selbst.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Für Inhalte, die von Nutzern oder Organisationen eingestellt werden, sind ausschließlich die jeweiligen Verfasser verantwortlich.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter ist nicht verpflichtet, sämtliche Inhalte vor ihrer Veröffentlichung zu überprüfen.",
          ],
        },
      ],
    },
    {
      titel: "10.3 Haftung für Kontakte und Kooperationen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter stellt technische Möglichkeiten zur Vernetzung sowie Empfehlungen und Matching-Funktionen bereit.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Verträge, Kooperationen, Geschäftsabschlüsse oder sonstige Vereinbarungen kommen ausschließlich zwischen den jeweiligen Nutzern oder Organisationen zustande.",
          ],
        },
        { art: "absatz", inhalt: ["(3) Der Anbieter übernimmt insbesondere keine Haftung für"] },
        {
          art: "liste",
          punkte: [
            ["wirtschaftliche Entscheidungen,"],
            ["Investitionen,"],
            ["Geschäftsabschlüsse,"],
            ["Beratungsleistungen Dritter,"],
            ["Leistungsqualität,"],
            ["Bonität,"],
            ["Zahlungsfähigkeit,"],
            ["Vertragserfüllung oder"],
            ["sonstige Handlungen anderer Nutzer."],
          ],
        },
      ],
    },
    {
      titel: "10.4 Externe Links",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Die Plattform kann Links zu externen Webseiten oder Angeboten Dritter enthalten.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(2) Für deren Inhalte übernimmt der Anbieter keine Verantwortung."],
        },
        {
          art: "absatz",
          inhalt: ["(3) Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar."],
        },
      ],
    },
    {
      titel: "10.5 Höhere Gewalt",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter haftet nicht für Leistungsstörungen, die durch Ereignisse höherer Gewalt verursacht werden.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Hierzu gehören insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["Naturkatastrophen,"],
            ["Pandemien,"],
            ["behördliche Maßnahmen,"],
            ["Streiks,"],
            ["Energieausfälle,"],
            ["Cyberangriffe,"],
            ["Internetausfälle oder"],
            ["vergleichbare unvorhersehbare Ereignisse."],
          ],
        },
      ],
    },
    {
      titel: "10.6 Datenschutz",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter verarbeitet personenbezogene Daten ausschließlich im Rahmen der geltenden Datenschutzgesetze, insbesondere der Datenschutz-Grundverordnung (DSGVO).",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(2) Einzelheiten ergeben sich aus der jeweils gültigen Datenschutzerklärung."],
        },
        {
          art: "absatz",
          inhalt: ["(3) Diese ist jederzeit auf der Website des Anbieters abrufbar."],
        },
      ],
    },
    {
      titel: "10.7 Elektronische Kommunikation",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Nutzer erklärt sich damit einverstanden, dass vertragsrelevante Informationen grundsätzlich elektronisch übermittelt werden können.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Hierzu zählen insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["Vertragsunterlagen,"],
            ["Rechnungen,"],
            ["Informationen zur Mitgliedschaft,"],
            ["Plattformhinweise,"],
            ["Änderungen der Leistungen,"],
            ["Änderungen dieser AGB sowie"],
            ["sonstige rechtlich relevante Mitteilungen."],
          ],
        },
      ],
    },
    {
      titel: "10.8 Änderungen dieser AGB",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter ist berechtigt, diese Allgemeinen Geschäftsbedingungen mit Wirkung für die Zukunft anzupassen, soweit",
          ],
        },
        {
          art: "liste",
          punkte: [
            ["gesetzliche Änderungen,"],
            ["neue technische Entwicklungen,"],
            ["neue Plattformfunktionen,"],
            ["organisatorische Änderungen oder"],
            ["wirtschaftliche Gründe"],
          ],
        },
        { art: "absatz", inhalt: ["dies erforderlich machen."] },
        {
          art: "absatz",
          inhalt: ["(2) Über wesentliche Änderungen werden die Nutzer rechtzeitig informiert."],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Soweit gesetzlich erforderlich, werden Änderungen nur mit Zustimmung des Nutzers wirksam.",
          ],
        },
      ],
    },
    {
      titel: "10.9 Streitbeilegung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter ist weder verpflichtet noch bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Unabhängig hiervon ist der Anbieter stets bemüht, Streitigkeiten einvernehmlich zu lösen.",
          ],
        },
      ],
    },
    {
      titel: "10.10 Gerichtsstand",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Für Unternehmer, juristische Personen des öffentlichen Rechts oder öffentlich-rechtliche Sondervermögen ist Gerichtsstand Stuttgart.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(2) Für Verbraucher gelten die gesetzlichen Gerichtsstandsregelungen."],
        },
      ],
    },
    {
      titel: "10.11 Anwendbares Recht",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts, soweit gesetzlich zulässig.",
          ],
        },
      ],
    },
    {
      titel: "10.12 Salvatorische Klausel",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Sollten einzelne Bestimmungen dieser Allgemeinen Geschäftsbedingungen ganz oder teilweise unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "An die Stelle der unwirksamen Bestimmung tritt die gesetzliche Regelung. Gleiches gilt für etwaige Regelungslücken.",
          ],
        },
      ],
    },
    {
      titel: "10.13 Schlussbestimmungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Diese Allgemeinen Geschäftsbedingungen bilden die Grundlage sämtlicher Verträge zwischen dem Anbieter und den Nutzern der Plattform.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Der Ehrenkodex, die Datenschutzerklärung sowie die jeweils veröffentlichten Leistungsbeschreibungen sind Bestandteil des Vertragsverhältnisses.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Maßgeblich ist jeweils die zum Zeitpunkt des Vertragsschlusses gültige Fassung dieser Allgemeinen Geschäftsbedingungen.",
          ],
        },
      ],
    },
    {
      titel: "ANLAGE 1 ZU DEN ALLGEMEINEN GESCHÄFTSBEDINGUNGEN (AGB)",
      bloecke: [],
    },
    {
      titel: "Widerrufsbelehrung für Verbraucher",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Diese Widerrufsbelehrung gilt ausschließlich für Verbraucher im Sinne des § 13 BGB.",
          ],
        },
      ],
    },
    {
      titel: "11.1 Widerrufsrecht",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses. Um Ihr Widerrufsrecht auszuüben, müssen Sie uns",
          ],
        },
        {
          art: "zeilen",
          zeilen: [
            ["Fair Business Club"],
            ["Inhaber: Detlev Krause"],
            ["Stockholmer Platz 1"],
            ["70173 Stuttgart"],
            ["Deutschland"],
          ],
        },
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
            "mittels einer eindeutigen Erklärung (z. B. per Brief oder E-Mail) über Ihren Entschluss informieren, diesen Vertrag zu widerrufen. Zur Wahrung der Widerrufsfrist genügt die rechtzeitige Absendung der Mitteilung.",
          ],
        },
      ],
    },
    {
      titel: "11.2 Folgen des Widerrufs",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Wenn Sie diesen Vertrag widerrufen, erstatten wir Ihnen sämtliche Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens innerhalb von vierzehn Tagen ab Eingang Ihres Widerrufs.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Für die Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Zahlung eingesetzt haben, sofern nicht ausdrücklich etwas anderes vereinbart wurde.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["Für die Rückzahlung entstehen Ihnen keine zusätzlichen Kosten."],
        },
      ],
    },
    {
      titel: "11.3 Vorzeitiger Beginn der Leistung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Verlangen Sie ausdrücklich, dass wir bereits während der Widerrufsfrist mit der Ausführung der vertraglich vereinbarten Leistungen beginnen, so haben Sie im Falle eines Widerrufs einen angemessenen Wertersatz zu leisten.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Der Wertersatz richtet sich nach dem Anteil der bis zum Widerruf bereits erbrachten Leistungen im Verhältnis zum Gesamtumfang der vertraglich vereinbarten Leistungen.",
          ],
        },
      ],
    },
    {
      titel: "11.4 Erlöschen des Widerrufsrechts",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Bei vollständig erbrachten Dienstleistungen erlischt das Widerrufsrecht, wenn"],
        },
        {
          art: "liste",
          punkte: [
            [
              "Sie ausdrücklich zugestimmt haben, dass wir bereits vor Ablauf der Widerrufsfrist mit der Ausführung beginnen,",
            ],
            [
              "Sie bestätigt haben, dass Ihnen bekannt ist, dass Ihr Widerrufsrecht mit vollständiger Vertragserfüllung erlischt, und",
            ],
            ["die Dienstleistung vollständig erbracht wurde."],
          ],
        },
      ],
    },
    {
      titel: "Muster-Widerrufsformular",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Wenn Sie den Vertrag widerrufen möchten, können Sie dieses Formular verwenden.",
          ],
        },
        { art: "absatz", inhalt: ["An"] },
        {
          art: "zeilen",
          zeilen: [
            ["Fair Business Club"],
            ["Inhaber: Detlev Krause"],
            ["Stockholmer Platz 1"],
            ["70173 Stuttgart"],
          ],
        },
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
            "Hiermit widerrufe(n) ich / wir den von mir / uns abgeschlossenen Vertrag über die Erbringung der folgenden Leistung:",
          ],
        },
        { art: "absatz", inhalt: ["Bestellt am:"] },
        { art: "absatz", inhalt: ["Name des Verbrauchers:"] },
        { art: "absatz", inhalt: ["Anschrift:"] },
        { art: "absatz", inhalt: ["Datum:"] },
        { art: "absatz", inhalt: ["Unterschrift (nur bei Mitteilung auf Papier):"] },
      ],
    },
    {
      titel: "ANLAGE 2 ZU DEN ALLGEMEINEN GESCHÄFTSBEDINGUNGEN (AGB)",
      bloecke: [],
    },
    {
      titel: "Datenschutzhinweise zur Plattformnutzung und Einwilligungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Diese Datenschutzhinweise ergänzen die Datenschutzerklärung des Fair Business Club. Maßgeblich für die Verarbeitung personenbezogener Daten ist die jeweils gültige Datenschutzerklärung.",
          ],
        },
      ],
    },
    {
      titel: "12.1 Grundsatz",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Schutz personenbezogener Daten besitzt für den Anbieter einen hohen Stellenwert.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Personenbezogene Daten werden ausschließlich im Rahmen der geltenden Datenschutzgesetze, insbesondere der Datenschutz-Grundverordnung (DSGVO), verarbeitet.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Die vollständige Datenschutzerklärung ist jederzeit auf der Website des Anbieters abrufbar.",
          ],
        },
      ],
    },
    {
      titel: "12.2 Zweck der Datenverarbeitung",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Die Verarbeitung personenbezogener Daten erfolgt insbesondere zur"],
        },
        {
          art: "liste",
          punkte: [
            ["Bereitstellung der Plattform,"],
            ["Verwaltung der Mitgliedschaften,"],
            ["Durchführung von Veranstaltungen,"],
            ["Kommunikation mit den Nutzern,"],
            ["Verbesserung der Plattform,"],
            ["Bereitstellung des Compass,"],
            ["Durchführung von Empfehlungen und Matching,"],
            ["Vergabe von ActivePoints,"],
            ["Verwaltung von Organisationen,"],
            ["Nutzung der Academy,"],
            ["Bereitstellung von Community-Funktionen,"],
            ["Erfüllung gesetzlicher Verpflichtungen sowie"],
            ["Gewährleistung der Sicherheit der Plattform."],
          ],
        },
      ],
    },
    {
      titel: "12.3 Compass",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Die vom Nutzer im Compass freiwillig bereitgestellten Informationen dienen dazu, individuelle Empfehlungen sowie Matching-Vorschläge zu ermöglichen.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Die Nutzung des Compass erfolgt freiwillig."] },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Nutzer entscheidet selbst, welche Angaben er macht und welche Informationen im Rahmen der Plattform sichtbar sein sollen.",
          ],
        },
      ],
    },
    {
      titel: "12.4 Matching und Empfehlungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Die Plattform verarbeitet freiwillig bereitgestellte Informationen, um passende Personen, Organisationen, Veranstaltungen, Communities oder Inhalte vorzuschlagen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Hierbei können automatisierte Verfahren sowie künstliche Intelligenz eingesetzt werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Es erfolgt keine automatisierte Entscheidungsfindung mit rechtlicher Wirkung im Sinne des Artikels 22 DSGVO.",
          ],
        },
      ],
    },
    {
      titel: "12.5 ActivePoints",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["(1) Zur Vergabe von ActivePoints werden Plattformaktivitäten verarbeitet."],
        },
        { art: "absatz", inhalt: ["Hierzu können insbesondere gehören:"] },
        {
          art: "liste",
          punkte: [
            ["Profilpflege,"],
            ["Compass-Aktivitäten,"],
            ["Beiträge,"],
            ["Kommentare,"],
            ["Bewertungen,"],
            ["Veranstaltungsbesuche,"],
            ["Academy-Nutzung,"],
            ["Community-Aktivitäten,"],
            ["Empfehlungen sowie"],
            ["weitere Plattformaktivitäten."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Die ActivePoints dienen ausschließlich der internen Bewertung von Aktivitäten innerhalb der Plattform.",
          ],
        },
      ],
    },
    {
      titel: "12.6 Community",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Beiträge, Kommentare, Bilder, Videos oder sonstige Inhalte können entsprechend den jeweiligen Sichtbarkeitseinstellungen anderen Nutzern angezeigt werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(2) Der Nutzer entscheidet selbst, welche Inhalte veröffentlicht werden."],
        },
      ],
    },
    {
      titel: "12.7 Veranstaltungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Im Rahmen von Veranstaltungen können personenbezogene Daten verarbeitet werden, insbesondere",
          ],
        },
        {
          art: "liste",
          punkte: [
            ["Teilnehmerdaten,"],
            ["Anmeldedaten,"],
            ["Foto- und Videoaufnahmen sowie"],
            ["organisatorische Informationen."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Die Verarbeitung erfolgt ausschließlich zur Durchführung der jeweiligen Veranstaltung sowie im Rahmen der gesetzlichen Bestimmungen.",
          ],
        },
      ],
    },
    {
      titel: "12.8 Organisationsprofile",
      bloecke: [
        { art: "absatz", inhalt: ["(1) Nutzer können Organisationen verwalten oder vertreten."] },
        {
          art: "absatz",
          inhalt: [
            "(2) Hierbei werden ausschließlich diejenigen Daten verarbeitet, die für die Darstellung und Verwaltung der jeweiligen Organisation erforderlich sind.",
          ],
        },
      ],
    },
    {
      titel: "12.9 Kommunikation",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Der Anbieter verarbeitet personenbezogene Daten zur Kommunikation mit den Nutzern, insbesondere für",
          ],
        },
        {
          art: "liste",
          punkte: [
            ["Vertragsinformationen,"],
            ["Rechnungen,"],
            ["Veranstaltungsinformationen,"],
            ["Plattforminformationen,"],
            ["Support,"],
            ["Newsletter,"],
            ["Benachrichtigungen sowie"],
            ["sicherheitsrelevante Hinweise."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Soweit gesetzlich erforderlich, erfolgt dies ausschließlich auf Grundlage einer entsprechenden Einwilligung oder gesetzlichen Erlaubnis.",
          ],
        },
      ],
    },
    {
      titel: "12.10 Einsatz künstlicher Intelligenz",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Zur Verbesserung der Plattform können KI-gestützte Systeme eingesetzt werden.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Diese können insbesondere verwendet werden für"] },
        {
          art: "liste",
          punkte: [
            ["Empfehlungen,"],
            ["Matching,"],
            ["Suchfunktionen,"],
            ["Zusammenfassungen,"],
            ["Übersetzungen,"],
            ["Lernunterstützung,"],
            ["Personalisierung sowie"],
            ["weitere Plattformfunktionen."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Die Verantwortung für persönliche Entscheidungen verbleibt stets beim Nutzer.",
          ],
        },
      ],
    },
    {
      titel: "12.11 Dienstleister",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter ist berechtigt, externe Dienstleister zur technischen oder organisatorischen Unterstützung einzusetzen.",
          ],
        },
        { art: "absatz", inhalt: ["Hierzu können insbesondere gehören:"] },
        {
          art: "liste",
          punkte: [
            ["Hosting-Anbieter,"],
            ["Cloud-Dienste,"],
            ["Zahlungsdienstleister,"],
            ["Newsletter-Dienste,"],
            ["Videoplattformen,"],
            ["KI-Dienste,"],
            ["CRM-Systeme,"],
            ["Support-Systeme,"],
            ["Analysewerkzeuge sowie"],
            ["weitere technische Dienstleister."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Soweit personenbezogene Daten verarbeitet werden, erfolgt dies ausschließlich auf Grundlage der gesetzlichen Bestimmungen sowie entsprechender Auftragsverarbeitungsverträge.",
          ],
        },
      ],
    },
    {
      titel: "12.12 Verbundene Unternehmen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter ist berechtigt, personenbezogene Daten innerhalb gesetzlich zulässiger Grenzen auch durch mit ihm verbundene Unternehmen oder künftig gegründete Gesellschaften verarbeiten zu lassen, sofern dies zur Erbringung, Weiterentwicklung oder Organisation der Plattform erforderlich ist.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Voraussetzung hierfür ist stets die Einhaltung der geltenden Datenschutzgesetze sowie der Abschluss der erforderlichen datenschutzrechtlichen Vereinbarungen.",
          ],
        },
      ],
    },
    {
      titel: "12.13 Datensicherheit",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Der Anbieter setzt angemessene technische und organisatorische Maßnahmen ein, um personenbezogene Daten vor Verlust, Missbrauch, unbefugtem Zugriff oder sonstigen rechtswidrigen Verarbeitungen zu schützen.",
          ],
        },
      ],
    },
    {
      titel: "12.14 Betroffenenrechte",
      bloecke: [
        { art: "absatz", inhalt: ["Nutzer haben insbesondere das Recht auf"] },
        {
          art: "liste",
          punkte: [
            ["Auskunft,"],
            ["Berichtigung,"],
            ["Löschung,"],
            ["Einschränkung der Verarbeitung,"],
            ["Datenübertragbarkeit,"],
            ["Widerspruch sowie"],
            ["Widerruf erteilter Einwilligungen,"],
          ],
        },
        { art: "absatz", inhalt: ["soweit die gesetzlichen Voraussetzungen hierfür vorliegen."] },
      ],
    },
    {
      titel: "12.15 Änderungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Diese Datenschutzhinweise können angepasst werden, sofern dies aufgrund gesetzlicher, technischer oder organisatorischer Änderungen erforderlich wird.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Die jeweils aktuelle Fassung ist Bestandteil der Allgemeinen Geschäftsbedingungen und wird auf der Plattform veröffentlicht.",
          ],
        },
      ],
    },
    {
      titel: "ANLAGE 3 ZU DEN ALLGEMEINEN GESCHÄFTSBEDINGUNGEN (AGB)",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Besondere Bedingungen für Anbieter, Organisationen und Unternehmer"],
        },
        {
          art: "absatz",
          inhalt: [
            "Diese Anlage gilt ergänzend zu den Allgemeinen Geschäftsbedingungen für alle Nutzer, die Leistungen, Produkte, Veranstaltungen oder sonstige Angebote über die Plattform veröffentlichen oder anbieten.",
          ],
        },
      ],
    },
    {
      titel: "13.1 Anbieterstatus",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Nutzer können -- abhängig von ihrer Mitgliedschaft -- als Anbieter auf der Plattform auftreten.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Anbieter können insbesondere sein:"] },
        {
          art: "liste",
          punkte: [
            ["Unternehmer,"],
            ["Freiberufler,"],
            ["Selbstständige,"],
            ["Unternehmen,"],
            ["Vereine,"],
            ["Verbände,"],
            ["Stiftungen,"],
            ["Kommunen,"],
            ["öffentliche Einrichtungen sowie"],
            ["sonstige Organisationen."],
          ],
        },
      ],
    },
    {
      titel: "13.2 Anbieterprofil",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Anbieter können innerhalb der Plattform ein öffentliches Anbieterprofil führen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Das Anbieterprofil dient ausschließlich der Darstellung eigener Leistungen, Kompetenzen und Angebote.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Der Anbieter ist für sämtliche veröffentlichten Inhalte selbst verantwortlich.",
          ],
        },
      ],
    },
    {
      titel: "13.3 Richtigkeit der Angaben",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Der Anbieter verpflichtet sich, sämtliche Angaben vollständig, wahrheitsgemäß und aktuell zu halten.",
          ],
        },
        { art: "absatz", inhalt: ["Dies gilt insbesondere für"] },
        {
          art: "liste",
          punkte: [
            ["Unternehmensdaten,"],
            ["Ansprechpartner,"],
            ["Qualifikationen,"],
            ["Zulassungen,"],
            ["Zertifizierungen,"],
            ["Referenzen,"],
            ["Preise sowie"],
            ["angebotene Leistungen."],
          ],
        },
      ],
    },
    {
      titel: "13.4 Gesetzliche Informationspflichten",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Der Anbieter ist verpflichtet, sämtliche gesetzlichen Informationspflichten einzuhalten.",
          ],
        },
        { art: "absatz", inhalt: ["Hierzu gehören insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["Impressumspflichten,"],
            ["Preisangaben,"],
            ["Informationspflichten gegenüber Verbrauchern,"],
            ["steuerrechtliche Vorschriften,"],
            ["gewerberechtliche Vorschriften sowie"],
            ["sonstige gesetzliche Verpflichtungen."],
          ],
        },
      ],
    },
    {
      titel: "13.5 Eigene Verantwortung",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Der Anbieter handelt ausschließlich im eigenen Namen und auf eigene Rechnung."],
        },
        {
          art: "absatz",
          inhalt: [
            "Der Fair Business Club wird weder Vertragspartner noch Vermittler der zwischen den Nutzern geschlossenen Verträge, sofern ausdrücklich nichts anderes vereinbart wurde.",
          ],
        },
      ],
    },
    {
      titel: "13.6 Vertragsabschlüsse",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Verträge über Produkte oder Dienstleistungen kommen ausschließlich zwischen den jeweiligen Vertragsparteien zustande.",
          ],
        },
        { art: "absatz", inhalt: ["Der Anbieter übernimmt hierfür keinerlei Gewähr."] },
      ],
    },
    {
      titel: "13.7 Bewertungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Anbieter erklären sich damit einverstanden, dass Nutzer im Rahmen der Plattform Bewertungen abgeben können, soweit entsprechende Funktionen angeboten werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Bewertungen müssen den gesetzlichen Vorschriften sowie den Allgemeinen Geschäftsbedingungen entsprechen.",
          ],
        },
      ],
    },
    {
      titel: "13.8 Werbung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Werbliche Inhalte dürfen ausschließlich innerhalb der hierfür vorgesehenen Plattformfunktionen veröffentlicht werden.",
          ],
        },
        { art: "absatz", inhalt: ["Unzulässig sind insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["irreführende Werbung,"],
            ["unlautere Werbung,"],
            ["aggressive Werbung,"],
            ["Spam,"],
            ["Massenanschreiben sowie"],
            ["sonstige unzulässige Werbemaßnahmen."],
          ],
        },
      ],
    },
    {
      titel: "13.9 Gewerbliche Schutzrechte",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Der Anbieter versichert, dass sämtliche von ihm veröffentlichten Inhalte frei von Rechten Dritter sind oder die erforderlichen Nutzungsrechte vorliegen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Der Anbieter stellt den Fair Business Club von sämtlichen Ansprüchen Dritter frei, die aufgrund einer Verletzung dieser Verpflichtung entstehen.",
          ],
        },
      ],
    },
    {
      titel: "13.10 Zusammenarbeit mit anderen Nutzern",
      bloecke: [
        { art: "absatz", inhalt: ["Die Plattform dient der Vernetzung und Zusammenarbeit."] },
        { art: "absatz", inhalt: ["Jeder Anbieter entscheidet eigenverantwortlich über"] },
        {
          art: "liste",
          punkte: [
            ["Angebote,"],
            ["Kooperationen,"],
            ["Verträge,"],
            ["Preise,"],
            ["Provisionen sowie"],
            ["sonstige Vereinbarungen."],
          ],
        },
        { art: "absatz", inhalt: ["Der Fair Business Club übernimmt hierfür keine Haftung."] },
      ],
    },
    {
      titel: "13.11 Provisionen und Vergütungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Soweit der Anbieter Vermittlungs-, Empfehlungs- oder Provisionsmodelle anbietet, ist ausschließlich der jeweilige Anbieter für deren rechtliche, steuerliche und wirtschaftliche Ausgestaltung verantwortlich.",
          ],
        },
      ],
    },
    {
      titel: "13.12 Einhaltung gesetzlicher Vorschriften",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Jeder Anbieter verpflichtet sich, sämtliche für seine Tätigkeit geltenden gesetzlichen Vorschriften einzuhalten.",
          ],
        },
        { art: "absatz", inhalt: ["Hierzu gehören insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["Gewerberecht,"],
            ["Steuerrecht,"],
            ["Datenschutzrecht,"],
            ["Wettbewerbsrecht,"],
            ["Verbraucherschutzrecht,"],
            ["Berufsrecht sowie"],
            ["sonstige einschlägige Rechtsvorschriften."],
          ],
        },
      ],
    },
    {
      titel: "13.13 Ausschluss von Anbietern",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Der Fair Business Club ist berechtigt, Anbieterprofile oder Organisationsprofile einzuschränken, zu sperren oder zu löschen, wenn",
          ],
        },
        {
          art: "liste",
          punkte: [
            ["gegen gesetzliche Vorschriften,"],
            ["gegen diese Allgemeinen Geschäftsbedingungen,"],
            ["gegen den Ehrenkodex oder"],
            ["gegen berechtigte Interessen der Plattform"],
          ],
        },
        { art: "absatz", inhalt: ["verstoßen wird."] },
      ],
    },
    {
      titel: "13.14 Weiterentwicklung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Der Fair Business Club ist berechtigt, Anbieterfunktionen, Organisationsprofile, Sichtbarkeitsmodelle, Suchalgorithmen sowie weitere Funktionen jederzeit weiterzuentwickeln oder anzupassen, sofern hierdurch keine wesentlichen vertraglichen Rechte beeinträchtigt werden.",
          ],
        },
      ],
    },
    {
      titel: "ANLAGE 4 ZU DEN ALLGEMEINEN GESCHÄFTSBEDINGUNGEN (AGB)",
      bloecke: [],
    },
    {
      titel: "Schlussbestimmungen für digitale Plattformleistungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Diese Anlage regelt die besonderen Bedingungen für den Betrieb und die Weiterentwicklung der digitalen Plattform.",
          ],
        },
      ],
    },
    {
      titel: "14.1 Charakter der Plattform",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Fair Business Club betreibt eine digitale Plattform zur Vernetzung von Menschen, Organisationen, Kompetenzen und Chancen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Die Plattform wird kontinuierlich weiterentwickelt und an technische, rechtliche sowie wirtschaftliche Anforderungen angepasst.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Die Plattform stellt digitale Werkzeuge bereit. Entscheidungen und Handlungen der Nutzer erfolgen ausschließlich in deren eigener Verantwortung.",
          ],
        },
      ],
    },
    {
      titel: "14.2 Plattformbetrieb",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter bemüht sich um einen sicheren, stabilen und möglichst unterbrechungsfreien Betrieb der Plattform.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Vorübergehende Einschränkungen aufgrund von"] },
        {
          art: "liste",
          punkte: [
            ["Wartungsarbeiten,"],
            ["Sicherheitsmaßnahmen,"],
            ["Software-Updates,"],
            ["technischen Weiterentwicklungen,"],
            ["höherer Gewalt oder"],
            ["Umständen außerhalb des Einflussbereichs des Anbieters"],
          ],
        },
        { art: "absatz", inhalt: ["lassen die Wirksamkeit des Vertrags unberührt."] },
      ],
    },
    {
      titel: "14.3 Beta-Funktionen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter kann neue Funktionen zunächst als Beta-Version oder Testfunktion bereitstellen.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["(2) Beta-Funktionen dienen der Erprobung neuer Entwicklungen."],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) Für Beta-Funktionen besteht kein Anspruch auf dauerhafte Verfügbarkeit oder unveränderte Fortführung.",
          ],
        },
      ],
    },
    {
      titel: "14.4 Künstliche Intelligenz",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Der Anbieter ist berechtigt, künstliche Intelligenz zur Verbesserung der Plattform einzusetzen.",
          ],
        },
        { art: "absatz", inhalt: ["(2) Dies umfasst insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["Empfehlungen,"],
            ["Matching,"],
            ["Suchfunktionen,"],
            ["Auswertungen,"],
            ["Zusammenfassungen,"],
            ["Personalisierungen,"],
            ["Übersetzungen,"],
            ["Lernunterstützung sowie"],
            ["weitere digitale Funktionen."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(3) KI-gestützte Ergebnisse dienen ausschließlich der Unterstützung und ersetzen keine fachliche, rechtliche, steuerliche oder sonstige individuelle Beratung.",
          ],
        },
      ],
    },
    {
      titel: "14.5 Änderungen des Leistungsumfangs",
      bloecke: [
        { art: "absatz", inhalt: ["(1) Der Anbieter ist berechtigt,"] },
        {
          art: "liste",
          punkte: [
            ["Funktionen,"],
            ["Menüs,"],
            ["Designs,"],
            ["Plattformbereiche,"],
            ["Community-Strukturen,"],
            ["Rollen,"],
            ["Mitgliedschaften,"],
            ["ActivePoints,"],
            ["Compass,"],
            ["Matching,"],
            ["Academy,"],
            ["Veranstaltungen sowie"],
            ["weitere Leistungen"],
          ],
        },
        { art: "absatz", inhalt: ["anzupassen oder weiterzuentwickeln."] },
        {
          art: "absatz",
          inhalt: [
            "(2) Hierdurch dürfen wesentliche Rechte bestehender Mitglieder nicht unangemessen beeinträchtigt werden.",
          ],
        },
      ],
    },
    {
      titel: "14.6 Drittanbieter",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "(1) Zur Bereitstellung der Plattform können Dienste Dritter eingesetzt werden.",
          ],
        },
        { art: "absatz", inhalt: ["Hierzu gehören insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["Zahlungsdienstleister,"],
            ["Cloud-Dienste,"],
            ["Hosting-Anbieter,"],
            ["E-Mail-Dienste,"],
            ["Messenger,"],
            ["Videokonferenzsysteme,"],
            ["Karten- und Standortdienste,"],
            ["KI-Dienste,"],
            ["Analysewerkzeuge sowie"],
            ["weitere technische Dienstleister."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "(2) Die Nutzung solcher Dienste erfolgt ausschließlich im Rahmen der gesetzlichen Vorschriften.",
          ],
        },
      ],
    },
    {
      titel: "14.7 Datensicherung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Der Nutzer ist für die Sicherung eigener Daten, Dokumente und Inhalte selbst verantwortlich, soweit diese auf der Plattform gespeichert oder verarbeitet werden.",
          ],
        },
      ],
    },
    {
      titel: "14.8 Systemmissbrauch",
      bloecke: [
        { art: "absatz", inhalt: ["Untersagt sind insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["Angriffe auf die Plattform,"],
            ["automatisierte Massenzugriffe,"],
            ["Scraping,"],
            ["Reverse Engineering,"],
            ["Umgehung technischer Schutzmaßnahmen,"],
            ["Manipulation von Algorithmen,"],
            ["automatisierte Profilerstellung,"],
            ["Nutzung von Bots ohne Zustimmung des Anbieters sowie"],
            ["sonstige Handlungen, die den ordnungsgemäßen Betrieb beeinträchtigen können."],
          ],
        },
      ],
    },
    {
      titel: "14.9 Verfügbarkeit einzelner Funktionen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Nicht jede Funktion steht jedem Nutzer dauerhaft oder in jeder Mitgliedschaft zur Verfügung.",
          ],
        },
        { art: "absatz", inhalt: ["Der Anbieter ist berechtigt, Funktionen abhängig von"] },
        {
          art: "liste",
          punkte: [
            ["Mitgliedschaft,"],
            ["Nutzerrolle,"],
            ["Verifizierung,"],
            ["ActivePoints,"],
            ["Organisation,"],
            ["technischen Voraussetzungen oder"],
            ["gesetzlichen Anforderungen"],
          ],
        },
        { art: "absatz", inhalt: ["freizuschalten oder einzuschränken."] },
      ],
    },
    {
      titel: "14.10 Zukunftssicherheit",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Der Nutzer erkennt an, dass sich digitale Plattformen kontinuierlich weiterentwickeln.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Neue Technologien, gesetzliche Anforderungen oder Marktbedingungen können Anpassungen der Plattform erforderlich machen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Hieraus entstehen grundsätzlich keine Ansprüche auf unveränderte Funktionen oder Oberflächen.",
          ],
        },
      ],
    },
    {
      titel: "14.11 Salvatorische Klausel",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Sollten einzelne Bestimmungen dieser Anlage ganz oder teilweise unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["An die Stelle der unwirksamen Bestimmung tritt die gesetzliche Regelung."],
        },
      ],
    },
    {
      titel: "14.12 Schlussregelung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Diese Anlage ist Bestandteil der Allgemeinen Geschäftsbedingungen des Fair Business Club.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Soweit diese Anlage keine besonderen Regelungen enthält, gelten die Allgemeinen Geschäftsbedingungen in ihrer jeweils gültigen Fassung.",
          ],
        },
      ],
    },
  ],
};
