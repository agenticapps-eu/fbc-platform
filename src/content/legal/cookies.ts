/**
 * Cookie-Richtlinie.
 *
 * Quelle: `04 FBC Cookie Richtlinie.docx`, geliefert 13.08.2026, Stand Juli 2026.
 * Vollständig übernommen.
 *
 * Der wichtigste offene Punkt steht bewusst ganz oben in `offenePunkte`: die
 * Richtlinie BESCHREIBT einen Einwilligungsweg, den die Plattform nicht hat,
 * und die Video-Einbettungen laden heute ohne Einwilligung. Ein Hinweiskasten
 * heilt das nicht — er macht es nur sichtbar. Die Behebung ist ein eigener
 * Vorgang.
 *
 * ERZEUGT aus der pandoc-Fassung des .docx und danach von Hand geprüft.
 */

import type { Rechtsdokument } from "./types";

export const cookies: Rechtsdokument = {
  slug: "cookies",
  titel: "Cookie-Richtlinie",
  stand: "Juli 2026",
  quelle: "04 FBC Cookie Richtlinie.docx (Stand Juli 2026)",
  provisorisch: true,
  offenePunkte: [
    "Das hier beschriebene Einwilligungs- und Widerrufsverfahren gibt es noch nicht. Es existiert kein Cookie-Dialog, in dem sich eine Einwilligung erteilen oder zurücknehmen ließe.",
    "Auf der öffentlichen Startseite werden Videos von YouTube und Vimeo eingebettet. Diese Inhalte werden heute geladen, ohne vorher um Einwilligung zu fragen — auch für Besucherinnen und Besucher ohne Konto.",
    "Die Aufstellung der tatsächlich gesetzten Cookies und ihrer Speicherdauern stammt aus dem Quelldokument und ist nicht gegen den laufenden Betrieb abgeglichen worden.",
  ],
  abschnitte: [
    {
      titel: "1. Allgemeine Informationen",
      bloecke: [],
    },
    {
      titel: "1.1 Zweck dieser Cookie-Richtlinie",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Diese Cookie-Richtlinie informiert Sie darüber, wie der Fair Business Club Cookies sowie vergleichbare Technologien auf seiner Website und innerhalb seiner digitalen Plattform verwendet.",
          ],
        },
        { art: "absatz", inhalt: ["Sie erläutert insbesondere,"] },
        {
          art: "liste",
          punkte: [
            ["welche Technologien eingesetzt werden,"],
            ["zu welchen Zwecken diese verwendet werden,"],
            ["auf welcher Rechtsgrundlage die Verarbeitung erfolgt,"],
            ["wie lange Daten gespeichert werden,"],
            ["welche Auswahlmöglichkeiten Sie haben und"],
            ["wie Sie Ihre Einwilligungen jederzeit ändern oder widerrufen können."],
          ],
        },
        { art: "absatz", inhalt: ["Diese Cookie-Richtlinie ergänzt unsere Datenschutzerklärung."] },
      ],
    },
    {
      titel: "1.2 Verantwortlicher",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:"],
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
      ],
    },
    {
      titel: "1.3 Was sind Cookies?",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Cookies sind kleine Textdateien, die von einer Website auf Ihrem Endgerät gespeichert werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Sie ermöglichen es, Ihr Endgerät bei einem späteren Besuch wiederzuerkennen oder bestimmte Einstellungen zu speichern.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Neben klassischen Cookies können auch vergleichbare Technologien eingesetzt werden, beispielsweise",
          ],
        },
        {
          art: "liste",
          punkte: [
            ["Local Storage,"],
            ["Session Storage,"],
            ["Pixel,"],
            ["Web Beacons,"],
            ["Gerätekennungen,"],
            ["Tokens oder"],
            ["vergleichbare technische Verfahren."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            'Aus Gründen der besseren Lesbarkeit werden diese Technologien in dieser Richtlinie gemeinsam als „Cookies" bezeichnet.',
          ],
        },
      ],
    },
    {
      titel: "1.4 Warum verwenden wir Cookies?",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Cookies unterstützen die sichere und benutzerfreundliche Bereitstellung unserer Website und Plattform.",
          ],
        },
        { art: "absatz", inhalt: ["Sie können insbesondere verwendet werden für"] },
        {
          art: "liste",
          punkte: [
            ["den sicheren Betrieb der Plattform,"],
            ["die Anmeldung von Mitgliedern,"],
            ["die Speicherung von Spracheinstellungen,"],
            ["die Speicherung von Datenschutzeinstellungen,"],
            ["die Verwaltung von Sitzungen,"],
            ["die Verbesserung der Benutzerfreundlichkeit,"],
            ["statistische Auswertungen,"],
            ["Sicherheitsfunktionen,"],
            ["Betrugserkennung,"],
            ["die Bereitstellung personalisierter Inhalte,"],
            ["die Optimierung unserer Plattform sowie"],
            ["Marketing- und Analysezwecke, soweit hierfür eine Einwilligung vorliegt."],
          ],
        },
      ],
    },
    {
      titel: "1.5 Arten von Cookies",
      bloecke: [{ art: "absatz", inhalt: ["Wir unterscheiden insbesondere folgende Kategorien:"] }],
    },
    {
      titel: "Notwendige Cookies",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Diese Cookies sind für den Betrieb unserer Website und Plattform technisch erforderlich.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["Ohne diese Cookies können wesentliche Funktionen nicht bereitgestellt werden."],
        },
        { art: "absatz", inhalt: ["Hierzu gehören beispielsweise"] },
        {
          art: "liste",
          punkte: [
            ["Login,"],
            ["Sicherheit,"],
            ["Lastverteilung,"],
            ["Formularfunktionen,"],
            ["Warenkorb,"],
            ["Zahlungsabwicklung,"],
            ["Cookie-Einstellungen."],
          ],
        },
      ],
    },
    {
      titel: "Funktionale Cookies",
      bloecke: [
        { art: "absatz", inhalt: ["Diese Cookies ermöglichen zusätzliche Komfortfunktionen."] },
        { art: "absatz", inhalt: ["Hierzu gehören beispielsweise"] },
        {
          art: "liste",
          punkte: [
            ["Spracheinstellungen,"],
            ["persönliche Einstellungen,"],
            ["zuletzt besuchte Bereiche,"],
            ["Anzeigeoptionen,"],
            ["Komfortfunktionen innerhalb der Plattform."],
          ],
        },
      ],
    },
    {
      titel: "Analyse-Cookies",
      bloecke: [
        { art: "absatz", inhalt: ["Analyse-Cookies helfen uns dabei,"] },
        {
          art: "liste",
          punkte: [
            ["Besucherzahlen zu verstehen,"],
            ["Plattformbereiche zu verbessern,"],
            ["Fehler zu erkennen,"],
            ["Nutzungsverhalten anonym oder pseudonym auszuwerten sowie"],
            ["unsere Angebote kontinuierlich weiterzuentwickeln."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Diese Cookies werden ausschließlich nach entsprechender Einwilligung eingesetzt, soweit dies gesetzlich erforderlich ist.",
          ],
        },
      ],
    },
    {
      titel: "Marketing-Cookies",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Marketing-Cookies ermöglichen die Anzeige interessenbezogener Inhalte oder Werbung.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Hierzu können Daten an Werbe- oder Social-Media-Plattformen übermittelt werden.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["Marketing-Cookies werden ausschließlich nach vorheriger Einwilligung gesetzt."],
        },
      ],
    },
    {
      titel: "1.6 Rechtsgrundlagen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Technisch notwendige Cookies werden auf Grundlage unseres berechtigten Interesses gemäß Art. 6 Abs. 1 lit. f DSGVO sowie § 25 Abs. 2 TTDSG verarbeitet.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Alle übrigen Cookies werden ausschließlich nach Ihrer ausdrücklichen Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO sowie § 25 Abs. 1 TTDSG gesetzt.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Eine erteilte Einwilligung kann jederzeit mit Wirkung für die Zukunft widerrufen werden.",
          ],
        },
      ],
    },
    {
      titel: "1.7 Änderungen dieser Cookie-Richtlinie",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Wir behalten uns vor, diese Cookie-Richtlinie anzupassen, wenn"],
        },
        {
          art: "liste",
          punkte: [
            ["gesetzliche Änderungen,"],
            ["neue technische Entwicklungen,"],
            ["neue Plattformfunktionen,"],
            ["neue Dienstleister oder"],
            ["organisatorische Änderungen"],
          ],
        },
        { art: "absatz", inhalt: ["dies erforderlich machen."] },
        {
          art: "absatz",
          inhalt: ["Die jeweils aktuelle Fassung ist jederzeit auf unserer Website abrufbar."],
        },
      ],
    },
    {
      titel: "2. Eingesetzte Cookies und vergleichbare Technologien",
      bloecke: [],
    },
    {
      titel: "2.1 Technisch notwendige Cookies",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Technisch notwendige Cookies sind für den Betrieb unserer Website und Plattform unverzichtbar.",
          ],
        },
        { art: "absatz", inhalt: ["Sie gewährleisten insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["die sichere Anmeldung,"],
            ["die Verwaltung Ihrer Sitzung,"],
            ["die Speicherung Ihrer Cookie-Einstellungen,"],
            ["den Schutz vor Missbrauch,"],
            ["die Systemsicherheit,"],
            ["die Zahlungsabwicklung,"],
            ["die Navigation innerhalb der Plattform sowie"],
            ["die fehlerfreie Darstellung unserer Inhalte."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Diese Cookies können nicht deaktiviert werden, da ohne sie wesentliche Funktionen der Plattform nicht zur Verfügung stehen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO in Verbindung mit § 25 Abs. 2 TTDSG.",
          ],
        },
      ],
    },
    {
      titel: "2.2 Funktionale Cookies",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Funktionale Cookies verbessern den Nutzungskomfort unserer Plattform."],
        },
        { art: "absatz", inhalt: ["Hierzu gehören insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["Spracheinstellungen,"],
            ["Zeitzonen,"],
            ["persönliche Präferenzen,"],
            ["Anzeigeeinstellungen,"],
            ["zuletzt verwendete Ansichten,"],
            ["Einstellungen innerhalb des Mitgliederbereichs,"],
            ["Komfortfunktionen der Plattform."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Diese Cookies werden -- soweit gesetzlich erforderlich -- ausschließlich nach Ihrer Einwilligung gespeichert.",
          ],
        },
      ],
    },
    {
      titel: "2.3 Analyse-Cookies",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Analyse-Cookies helfen uns dabei, unsere Plattform kontinuierlich weiterzuentwickeln.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["Hierzu können insbesondere folgende Informationen verarbeitet werden:"],
        },
        {
          art: "liste",
          punkte: [
            ["Seitenaufrufe,"],
            ["Verweildauer,"],
            ["Klickverhalten,"],
            ["technische Fehler,"],
            ["Geräteinformationen,"],
            ["Browserinformationen,"],
            ["Bildschirmauflösungen,"],
            ["Zugriffszeiten,"],
            ["Herkunft der Besucher sowie"],
            ["allgemeine Nutzungsstatistiken."],
          ],
        },
        { art: "absatz", inhalt: ["Die Auswertung erfolgt möglichst anonym oder pseudonym."] },
        {
          art: "absatz",
          inhalt: ["Analyse-Cookies werden ausschließlich nach Ihrer Einwilligung eingesetzt."],
        },
      ],
    },
    {
      titel: "2.4 Marketing-Cookies",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Marketing-Cookies dienen der Bereitstellung interessenbezogener Inhalte sowie der Erfolgsmessung unserer Marketingmaßnahmen.",
          ],
        },
        { art: "absatz", inhalt: ["Hierzu können insbesondere verarbeitet werden:"] },
        {
          art: "liste",
          punkte: [
            ["Anzeigenkontakte,"],
            ["Kampagnenerfolge,"],
            ["Referrer,"],
            ["Wiedererkennung von Besuchern,"],
            ["Reichweitenmessungen,"],
            ["Social-Media-Interaktionen sowie"],
            ["weitere marketingbezogene Informationen."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Marketing-Cookies werden ausschließlich nach Ihrer ausdrücklichen Einwilligung eingesetzt.",
          ],
        },
      ],
    },
    {
      titel: "2.5 Drittanbieter-Cookies",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Auf unserer Website oder Plattform können Dienste externer Anbieter eingebunden werden.",
          ],
        },
        { art: "absatz", inhalt: ["Hierzu können insbesondere gehören:"] },
        {
          art: "liste",
          punkte: [
            ["Zahlungsdienstleister,"],
            ["CRM-Systeme,"],
            ["Videokonferenzsysteme,"],
            ["Karten- und Standortdienste,"],
            ["Videoplattformen,"],
            ["Social-Media-Dienste,"],
            ["Analysewerkzeuge,"],
            ["KI-Dienste,"],
            ["Chat-Systeme sowie"],
            ["weitere technische Dienste."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Soweit hierbei Cookies eingesetzt werden, erfolgt dies ausschließlich entsprechend den gesetzlichen Vorgaben.",
          ],
        },
      ],
    },
    {
      titel: "2.6 Mitgliederbereich",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Innerhalb des Mitgliederbereichs können zusätzliche Cookies oder vergleichbare Technologien eingesetzt werden.",
          ],
        },
        { art: "absatz", inhalt: ["Diese dienen insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["der sicheren Anmeldung,"],
            ["der Verwaltung der Mitgliedschaft,"],
            ["der Speicherung von Einstellungen,"],
            ["der Nutzung des Compass,"],
            ["Matching-Funktionen,"],
            ["Community-Funktionen,"],
            ["Academy,"],
            ["ActivePoints,"],
            ["Veranstaltungen sowie"],
            ["weiteren Plattformfunktionen."],
          ],
        },
      ],
    },
    {
      titel: "2.7 Speicherdauer",
      bloecke: [
        { art: "absatz", inhalt: ["Je nach Zweck unterscheiden wir insbesondere zwischen"] },
      ],
    },
    {
      titel: "Session-Cookies",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Diese werden automatisch gelöscht, sobald Sie Ihren Browser schließen."],
        },
      ],
    },
    {
      titel: "Persistente Cookies",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Diese bleiben für einen bestimmten Zeitraum auf Ihrem Endgerät gespeichert, um Einstellungen oder Präferenzen bei einem späteren Besuch wiederherzustellen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Die konkrete Speicherdauer richtet sich nach dem jeweiligen Zweck und den eingesetzten technischen Systemen.",
          ],
        },
      ],
    },
    {
      titel: "2.8 Consent-Management",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Zur Verwaltung Ihrer Cookie-Einstellungen setzen wir ein Cookie-Consent-System ein.",
          ],
        },
        { art: "absatz", inhalt: ["Hierüber können Sie"] },
        {
          art: "liste",
          punkte: [
            ["Ihre Einwilligungen erteilen,"],
            ["Einwilligungen ablehnen,"],
            ["Einwilligungen widerrufen sowie"],
            ["Ihre Einstellungen jederzeit ändern."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Die Speicherung Ihrer Auswahl erfolgt selbst wiederum mithilfe eines technisch notwendigen Cookies.",
          ],
        },
      ],
    },
    {
      titel: "2.9 Änderungen eingesetzter Cookies",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Da unsere Plattform kontinuierlich weiterentwickelt wird, können sich die eingesetzten Cookies jederzeit ändern.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["Neue Dienste oder Funktionen können zusätzliche Cookies erforderlich machen."],
        },
        {
          art: "absatz",
          inhalt: [
            "Über wesentliche Änderungen informieren wir im Rahmen dieser Cookie-Richtlinie sowie unseres Cookie-Banners.",
          ],
        },
      ],
    },
    {
      titel: "2.10 Rechtsgrundlagen",
      bloecke: [
        { art: "absatz", inhalt: ["Die Verarbeitung erfolgt insbesondere auf Grundlage von"] },
        {
          art: "liste",
          punkte: [
            ["Art. 6 Abs. 1 lit. a DSGVO (Einwilligung),"],
            ["Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse),"],
            ["§ 25 Abs. 1 TTDSG sowie"],
            ["§ 25 Abs. 2 TTDSG."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Welche Rechtsgrundlage im Einzelfall gilt, richtet sich nach dem jeweiligen Cookie und dessen Verwendungszweck.",
          ],
        },
      ],
    },
    {
      titel: "3. Verwaltung Ihrer Cookie-Einstellungen",
      bloecke: [],
    },
    {
      titel: "3.1 Einwilligung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Soweit der Einsatz von Cookies oder vergleichbaren Technologien gesetzlich eine Einwilligung erfordert, werden diese erst nach Ihrer ausdrücklichen Zustimmung aktiviert.",
          ],
        },
        { art: "absatz", inhalt: ["Ihre Einwilligung erfolgt über unser Cookie-Consent-Banner."] },
        {
          art: "absatz",
          inhalt: [
            "Vor Erteilung Ihrer Einwilligung werden ausschließlich technisch notwendige Cookies gesetzt.",
          ],
        },
      ],
    },
    {
      titel: "3.2 Auswahlmöglichkeiten",
      bloecke: [
        { art: "absatz", inhalt: ["Sie können selbst entscheiden,"] },
        {
          art: "liste",
          punkte: [
            ["welche Cookie-Kategorien Sie zulassen,"],
            ["welche Analysefunktionen aktiviert werden,"],
            ["welche Marketingdienste genutzt werden dürfen sowie"],
            ["ob Sie sämtliche optionalen Cookies ablehnen möchten."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Die Ablehnung optionaler Cookies hat grundsätzlich keinen Einfluss auf die Nutzung der wesentlichen Funktionen unserer Plattform.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["Einzelne Komfort- oder Zusatzfunktionen können jedoch eingeschränkt sein."],
        },
      ],
    },
    {
      titel: "3.3 Änderung Ihrer Einwilligung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Sie können Ihre Cookie-Einstellungen jederzeit mit Wirkung für die Zukunft ändern.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            'Hierzu steht Ihnen auf unserer Website ein entsprechender Link oder eine Schaltfläche „Cookie-Einstellungen" zur Verfügung.',
          ],
        },
        { art: "absatz", inhalt: ["Dort können Sie"] },
        {
          art: "liste",
          punkte: [
            ["Einwilligungen erteilen,"],
            ["Einwilligungen widerrufen,"],
            ["einzelne Kategorien aktivieren oder deaktivieren sowie"],
            ["Ihre bisherigen Entscheidungen jederzeit anpassen."],
          ],
        },
      ],
    },
    {
      titel: "3.4 Widerruf der Einwilligung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Eine bereits erteilte Einwilligung kann jederzeit ohne Angabe von Gründen widerrufen werden.",
          ],
        },
        { art: "absatz", inhalt: ["Der Widerruf wirkt ausschließlich für die Zukunft."] },
        {
          art: "absatz",
          inhalt: [
            "Die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt hiervon unberührt.",
          ],
        },
      ],
    },
    {
      titel: "3.5 Browser-Einstellungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Zusätzlich können Sie Cookies über die Einstellungen Ihres Internetbrowsers verwalten.",
          ],
        },
        { art: "absatz", inhalt: ["Sie können insbesondere"] },
        {
          art: "liste",
          punkte: [
            ["gespeicherte Cookies löschen,"],
            ["Cookies blockieren,"],
            ["das automatische Speichern verhindern oder"],
            ["sich vor dem Speichern informieren lassen."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Bitte beachten Sie, dass hierdurch einzelne Funktionen unserer Website oder Plattform eingeschränkt sein können.",
          ],
        },
      ],
    },
    {
      titel: "3.6 Speichern von Einwilligungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Ihre Entscheidung über die Verwendung von Cookies wird gespeichert, damit sie bei einem erneuten Besuch berücksichtigt werden kann.",
          ],
        },
        { art: "absatz", inhalt: ["Hierzu wird ein technisch notwendiges Cookie verwendet."] },
        {
          art: "absatz",
          inhalt: [
            "Dieses Cookie speichert ausschließlich Ihre Auswahl und dient nicht der Analyse oder dem Marketing.",
          ],
        },
      ],
    },
    {
      titel: "3.7 Löschung von Cookies",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Sie können bereits gespeicherte Cookies jederzeit über Ihren Browser löschen."],
        },
        {
          art: "absatz",
          inhalt: [
            "Nach der Löschung werden Sie bei Ihrem nächsten Besuch unserer Website erneut nach Ihren Cookie-Einstellungen gefragt, soweit dies gesetzlich erforderlich ist.",
          ],
        },
      ],
    },
    {
      titel: "3.8 Do-Not-Track",
      bloecke: [
        {
          art: "absatz",
          inhalt: ['Einige Internetbrowser unterstützen sogenannte „Do-Not-Track"-Signale.'],
        },
        {
          art: "absatz",
          inhalt: [
            "Da hierfür bislang kein einheitlicher technischer Standard besteht, werden solche Signale derzeit nicht automatisch ausgewertet.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Sie können Ihre Datenschutzeinstellungen jederzeit über unser Consent-Management-System verwalten.",
          ],
        },
      ],
    },
    {
      titel: "3.9 Minderjährige",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Unsere Website und Plattform richten sich grundsätzlich nicht an Personen unter 18 Jahren.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Wir setzen keine Cookies ein, um personenbezogene Daten Minderjähriger gezielt für Marketingzwecke zu verarbeiten.",
          ],
        },
      ],
    },
    {
      titel: "3.10 Kontakt",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Fragen zum Einsatz von Cookies oder zur Verarbeitung personenbezogener Daten können jederzeit an uns gerichtet werden:",
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
            "Weitere Informationen zur Verarbeitung personenbezogener Daten finden Sie in unserer Datenschutzerklärung.",
          ],
        },
      ],
    },
    {
      titel: "Ende der Cookie-Richtlinie",
      bloecke: [],
    },
  ],
};
