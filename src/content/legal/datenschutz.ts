/**
 * Datenschutzerklärung.
 *
 * Quelle: `FBC Datenschutz 260811.docx`, der eff.bee.zee-spezifische ENTWURF
 * des Anwalts vom 11.08.2026.
 *
 * NICHT verwendet wurde `03 FBC Datenschutzerklärung.docx`, die generische
 * Kanzleifassung: sie nennt ausschließlich Kategorien („Hosting-Dienstleister,
 * CRM-Systeme, Zahlungsdienstleister") und keinen einzigen konkreten Dienst.
 * Bitte nicht „zur Vollständigkeit" nachpflegen — sie ist die schwächere
 * Grundlage.
 *
 * DIESES MODUL IST VON HAND KURATIERT, nicht blind konvertiert. Der Entwurf
 * enthält Kommentare des Anwalts an Donald („Hinweis für Donald", „Vor Livegang
 * muss Donald …", der gesamte Schlussteil mit den drei Fragen). Die stehen auf
 * keiner Seite.
 *
 * Fünf Eingriffe, jeder einzeln begründet in `kuratiere_datenschutz.py`:
 *   1. Einleitung des Anwalts entfernt
 *   2. Verantwortlicher auf „Fair Business Club" gesetzt (Donald, 26.08.) —
 *      der Entwurf nannte DK Real Invest eG; steht als offener Punkt auf der Seite
 *   3. Cookie-Platzhalter durch Verweis auf /cookies ersetzt
 *   4. Hoster-Platzhalter entfernt — die Angabe ist jetzt gemessen
 *   5. Schlussteil mit den drei Fragen entfernt; sie sind beantwortet
 *
 * Ergänzt wurden vier Abschnitte OHNE Nummer, damit sichtbar bleibt, was nicht
 * vom Anwalt stammt. Ihr Inhalt ist am 26.08.2026 am Quelltext erhoben.
 */

import type { Rechtsdokument } from "./types";

export const datenschutz: Rechtsdokument = {
  slug: "datenschutz",
  titel: "Datenschutzerklärung",
  stand: "11. August 2026",
  quelle: "FBC Datenschutz 260811.docx (Entwurf, Stand 11. August 2026)",
  provisorisch: true,
  offenePunkte: [
    "Dies ist ein Entwurf des Anwalts, ergänzt um Angaben, die wir am 26. August 2026 an der Plattform selbst erhoben haben. Die anwaltlich geprüfte Endfassung steht noch aus.",
    "Als Verantwortlicher ist hier „Fair Business Club“ genannt — so wie im Impressum, in den Geschäftsbedingungen und in der Cookie-Richtlinie. Der Entwurf des Anwalts nannte an dieser Stelle stattdessen die „DK Real Invest eG, Rotebühlplatz 23, 70178 Stuttgart“. Welche der beiden Stellen verantwortlich ist, wird derzeit geklärt.",
    "Für Cloudflare, Resend und Stripe ist die Verarbeitungsregion noch nicht belegt. Sie wird nachgetragen, nicht geschätzt.",
    "Verträge zur Auftragsverarbeitung mit den genannten Diensten sind noch nicht abgeschlossen. Ob ein Dienst als Auftragsverarbeiter oder als eigener Verantwortlicher einzuordnen ist, ist rechtlich noch nicht geprüft; die Dienste sind deshalb neutral als Empfänger mit Zweck aufgeführt.",
    "Die eingebetteten Videos von YouTube und Vimeo werden geladen, bevor eine Einwilligung eingeholt wurde.",
    "Konkrete Speicherfristen sind noch nicht festgelegt.",
  ],
  abschnitte: [
    {
      titel: "1. Allgemeine Hinweise",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Der Schutz Ihrer personenbezogenen Daten ist uns ein wichtiges Anliegen."],
        },
        {
          art: "absatz",
          inhalt: [
            "In dieser Datenschutzerklärung informieren wir Sie darüber, welche personenbezogenen Daten bei der Nutzung von eff.bee.zee verarbeitet werden, zu welchen Zwecken dies geschieht, auf welchen Rechtsgrundlagen die Verarbeitung erfolgt und welche Rechte Ihnen zustehen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "eff.bee.zee ist eine digitale Plattform, auf der Menschen miteinander in Kontakt treten, Profile und Inhalte entdecken, Veranstaltungen finden und -- soweit die jeweiligen Funktionen freigeschaltet sind -- eigene Inhalte veröffentlichen und miteinander interagieren können.",
          ],
        },
      ],
    },
    {
      titel: "2. Verantwortlicher",
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
      titel: "3. Bereitstellung der Plattform",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Beim Aufruf von eff.bee.zee werden technisch erforderliche Informationen verarbeitet, die Ihr Browser bzw. Endgerät an unseren Server übermittelt.",
          ],
        },
        { art: "absatz", inhalt: ["Hierzu können insbesondere gehören:"] },
        {
          art: "liste",
          punkte: [
            ["IP-Adresse"],
            ["Datum und Uhrzeit des Zugriffs"],
            ["aufgerufene Seite bzw. Ressource"],
            ["Browsertyp und Browserversion"],
            ["Betriebssystem"],
            ["Referrer-URL"],
            ["technische Geräteinformationen"],
            ["Fehler- und Sicherheitsprotokolle"],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Die Verarbeitung erfolgt, um die Plattform technisch bereitzustellen, ihre Stabilität und Sicherheit zu gewährleisten und Missbrauch zu verhindern.",
          ],
        },
        { art: "absatz", inhalt: ["Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO."] },
      ],
    },
    {
      titel: "4. Registrierung und Benutzerkonto",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Für die Nutzung bestimmter Funktionen von eff.bee.zee ist die Einrichtung eines Benutzerkontos erforderlich.",
          ],
        },
        { art: "absatz", inhalt: ["Dabei verarbeiten wir insbesondere:"] },
        {
          art: "liste",
          punkte: [
            ["Vor- und Nachname"],
            ["E-Mail-Adresse"],
            ["Zugangsdaten"],
            ["Zeitpunkt der Registrierung und Aktivierung"],
            ["gegebenenfalls Mitgliedschafts- und Berechtigungsinformationen"],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Die Verarbeitung erfolgt zur Einrichtung und Verwaltung Ihres Benutzerkontos sowie zur Bereitstellung der von Ihnen genutzten Plattformfunktionen.",
          ],
        },
        { art: "absatz", inhalt: ["Rechtsgrundlage ist insbesondere Art. 6 Abs. 1 lit. b DSGVO."] },
      ],
    },
    {
      titel: "5. Bestehende Mitglieder des Fair Business Club",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Bestehende Mitglieder des Fair Business Club können im Rahmen der Einführung von eff.bee.zee ein bereits vorbereitetes Benutzerprofil erhalten.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Hierfür werden die für die Einrichtung und Zuordnung des Benutzerkontos erforderlichen vorhandenen Mitgliedsdaten verwendet.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Das Benutzerkonto wird dem jeweiligen Mitglied über die hinterlegte E-Mail-Adresse zugeordnet und durch die Vergabe eines persönlichen Passworts aktiviert.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Bis zur Aktivierung werden noch nicht freigegebene Profildaten nicht für andere Nutzer der Plattform sichtbar gemacht.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Die bestehende Mitgliedschaft im Fair Business Club und deren bisherige vertragliche Regelungen bleiben hiervon zunächst unberührt.",
          ],
        },
      ],
    },
    {
      titel: "6. Profile und freiwillige Angaben",
      bloecke: [
        { art: "absatz", inhalt: ["Nutzer können ihr Profil um weitere Angaben ergänzen."] },
        { art: "absatz", inhalt: ["Hierzu können beispielsweise gehören:"] },
        {
          art: "liste",
          punkte: [
            ["Profilbild"],
            ["Wohnort oder Region"],
            ["berufliche Angaben"],
            ["Unternehmen oder Organisation"],
            ["Interessen"],
            ["persönliche Beschreibung"],
            ["angebotene oder gesuchte Leistungen und Möglichkeiten"],
            ["weitere freiwillig bereitgestellte Profilinformationen"],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Welche Angaben verpflichtend und welche freiwillig sind, wird bei der jeweiligen Eingabe kenntlich gemacht.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Nutzer sollen selbst bestimmen können, welche hierfür vorgesehenen Informationen öffentlich, nur für bestimmte Nutzergruppen oder nicht öffentlich sichtbar sind.",
          ],
        },
      ],
    },
    {
      titel: "7. Öffentliche und nicht öffentliche Inhalte",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "eff.bee.zee verfolgt für dafür vorgesehene Inhalte ein grundsätzlich offenes Plattformkonzept. Öffentliche Inhalte können daher auch von Personen eingesehen werden, die nicht bei eff.bee.zee registriert oder angemeldet sind.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Hierzu können -- abhängig von den jeweiligen Einstellungen und Funktionen -- insbesondere gehören:",
          ],
        },
        {
          art: "liste",
          punkte: [
            ["freigegebene Profilinformationen"],
            ["Veranstaltungen"],
            ["Beiträge"],
            ["Kommentare"],
            ["Bilder und Videos"],
            ["Highlights"],
            ["Informationen über Organisationen oder Communities"],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Nutzer sind dafür verantwortlich, bei der Veröffentlichung von Inhalten keine personenbezogenen Daten oder Inhalte Dritter ohne entsprechende Berechtigung zu veröffentlichen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Die aktuelle Plattformkonzeption sieht ausdrücklich vor, öffentlich freigegebene Profile, Veranstaltungen, Highlights, Beiträge, Kommentare, Fotos und Videos auch ohne Login sichtbar machen zu können.",
          ],
        },
      ],
    },
    {
      titel: "8. Veranstaltungen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Bei der Erstellung, Anmeldung oder Teilnahme an Veranstaltungen können personenbezogene Daten verarbeitet werden.",
          ],
        },
        { art: "absatz", inhalt: ["Hierzu können insbesondere gehören:"] },
        {
          art: "liste",
          punkte: [
            ["Name"],
            ["Veranstaltungsdaten"],
            ["Anmelde- und Teilnahmestatus"],
            ["Kommunikation zur Veranstaltung"],
            ["vom Nutzer veröffentlichte Inhalte"],
            ["Bilder und Videos, soweit diese rechtmäßig veröffentlicht werden dürfen"],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Die Verarbeitung erfolgt zur Organisation und Durchführung der jeweiligen Veranstaltung und zur Bereitstellung der entsprechenden Plattformfunktionen.",
          ],
        },
      ],
    },
    {
      titel: "9. Beiträge, Aktivitäten, Kommentare und Highlights",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Wenn Nutzer Inhalte veröffentlichen oder mit Inhalten anderer Nutzer interagieren, verarbeiten wir die hierfür erforderlichen Informationen.",
          ],
        },
        { art: "absatz", inhalt: ["Hierzu gehören beispielsweise:"] },
        {
          art: "liste",
          punkte: [
            ["Beiträge"],
            ["Kommentare"],
            ["Bilder und Videos"],
            ["Aktivitäten"],
            ["Reaktionen"],
            ["Highlights"],
            ["Zeitpunkt der jeweiligen Aktivität"],
            ["Zuordnung zum Benutzerkonto"],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Diese Daten werden verarbeitet, um die sozialen und kommunikativen Funktionen der Plattform bereitzustellen.",
          ],
        },
      ],
    },
    {
      titel: "10. Kommunikation und Systemnachrichten",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Wir können die bei der Registrierung hinterlegte E-Mail-Adresse verwenden, um für den Betrieb des Benutzerkontos erforderliche Nachrichten zu versenden.",
          ],
        },
        { art: "absatz", inhalt: ["Hierzu gehören beispielsweise:"] },
        {
          art: "liste",
          punkte: [
            ["Aktivierungs-E-Mails"],
            ["Passwortzurücksetzungen"],
            ["Sicherheitsinformationen"],
            ["wichtige Änderungen des Benutzerkontos oder der Plattform"],
            ["organisatorische Informationen zur Nutzung"],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Werbliche Newsletter und andere nicht erforderliche Marketingkommunikation erfolgen nur auf der hierfür jeweils erforderlichen Rechtsgrundlage.",
          ],
        },
      ],
    },
    {
      titel: "11. Kontakt und Support",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Wenn Sie mit uns Kontakt aufnehmen, verarbeiten wir die von Ihnen mitgeteilten Daten zur Bearbeitung Ihrer Anfrage.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Hierzu können insbesondere Name, E-Mail-Adresse, Inhalt der Anfrage und gegebenenfalls weitere freiwillig übermittelte Informationen gehören.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Rechtsgrundlage ist abhängig vom Anlass Art. 6 Abs. 1 lit. b oder lit. f DSGVO.",
          ],
        },
      ],
    },
    {
      titel: "12. Cookies und technisch erforderliche Speicherung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "eff.bee.zee kann technisch erforderliche Cookies oder vergleichbare Technologien einsetzen, die für Anmeldung, Sicherheit, Sitzungsverwaltung und grundlegende Plattformfunktionen notwendig sind.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Soweit darüber hinaus Analyse-, Marketing- oder andere einwilligungspflichtige Technologien eingesetzt werden, erfolgt deren Nutzung nur nach Maßgabe der gesetzlichen Anforderungen und -- soweit erforderlich -- nach vorheriger Einwilligung.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Einzelheiten zu den eingesetzten Technologien stehen in der ",
            { text: "Cookie-Richtlinie", href: "/cookies" },
            ".",
          ],
        },
      ],
    },
    {
      titel: "13. Hosting und technische Dienstleister",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Für den Betrieb von eff.bee.zee können technische Dienstleister eingesetzt werden, insbesondere für Hosting, Datenbanken, E-Mail-Versand, Sicherheit und technische Infrastruktur.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Soweit diese Dienstleister personenbezogene Daten in unserem Auftrag verarbeiten, werden sie entsprechend den gesetzlichen Anforderungen eingebunden.",
          ],
        },
      ],
    },
    {
      titel: "Eingesetzte Dienste im Einzelnen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Die folgenden Dienste erhalten personenbezogene Daten, damit die Plattform betrieben werden kann. Die Aufstellung wurde am 26. August 2026 am Quelltext der Plattform erhoben.",
          ],
        },
        {
          art: "liste",
          punkte: [
            [
              "Supabase — Datenbank, Anmeldung, Dateiablage und serverseitige Funktionen. Verarbeitung in Frankfurt am Main, Deutschland.",
            ],
            [
              "Cloudflare — Auslieferung der Website an Ihr Gerät. Verarbeitungsregion noch nicht belegt (weltweites Netz).",
            ],
            [
              "Resend — Versand der Aktivierungs- und Systemnachrichten per E-Mail. Verarbeitungsregion noch nicht belegt.",
            ],
            ["Sentry — Erfassung technischer Fehler. Verarbeitung in der Europäischen Union."],
            [
              "Stripe — Abwicklung von Zahlungen bei kostenpflichtigen Mitgliedschaften. Verarbeitungsregion noch nicht belegt.",
            ],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "„Verarbeitungsregion noch nicht belegt“ heißt: Wir haben diese Angabe nicht geprüft und geben sie deshalb nicht an. Sie wird nachgetragen, sobald sie aus den Verträgen mit dem jeweiligen Anbieter feststeht.",
          ],
        },
      ],
    },
    {
      titel: "Eingebettete Videos von YouTube und Vimeo",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "An einigen Stellen — auch auf der öffentlich zugänglichen Startseite — sind Videos von YouTube und Vimeo eingebettet.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Beim Aufruf einer Seite mit einem solchen Video wird eine Verbindung zu dem jeweiligen Anbieter hergestellt. Dabei erhält er unter anderem Ihre IP-Adresse, und zwar auch dann, wenn Sie kein Konto bei uns und keines bei ihm haben.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Diese Verbindung wird derzeit hergestellt, ohne Sie vorher um Einwilligung zu fragen. Wir halten das für einen Mangel und arbeiten daran; bis dahin nennen wir es hier ausdrücklich, statt es zu verschweigen.",
          ],
        },
      ],
    },
    {
      titel: "Fehlererfassung und Aufzeichnung im Fehlerfall",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Zur Erfassung technischer Fehler setzen wir Sentry ein. Tritt in Ihrem Browser ein Fehler auf, werden technische Angaben zum Fehler übermittelt.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Im Fehlerfall entsteht zusätzlich eine Aufzeichnung des Bedienablaufs, die zur Eingrenzung der Ursache dient. Eine anlasslose Aufzeichnung findet nicht statt — sie wird ausschließlich durch einen Fehler ausgelöst.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "In dieser Aufzeichnung werden sämtliche Texte unkenntlich gemacht und Bilder sowie Videos ausgeblendet. Außerdem wird ein Aktivierungs-Token aus der Adresszeile entfernt, bevor die Fehlererfassung überhaupt startet.",
          ],
        },
      ],
    },
    {
      titel: "Was wir nicht einsetzen",
      bloecke: [
        {
          art: "absatz",
          inhalt: ["Ebenfalls am 26. August 2026 geprüft und ausdrücklich nicht vorhanden:"],
        },
        {
          art: "liste",
          punkte: [
            ["keine Reichweiten- oder Nutzungsanalyse"],
            ["keine Werbe- oder Tracking-Dienste"],
            [
              "keine Schriften von fremden Servern — die verwendeten Schriften liegen auf unserem eigenen Server",
            ],
            ["keine Karten-Einbettung"],
            ["kein Captcha-Dienst"],
          ],
        },
      ],
    },
    {
      titel: "14. Weitergabe von Daten",
      bloecke: [
        { art: "absatz", inhalt: ["Personenbezogene Daten werden nur weitergegeben, wenn dies"] },
        {
          art: "liste",
          punkte: [
            ["für die Bereitstellung einer gewünschten Funktion erforderlich ist,"],
            ["zur Erfüllung eines Vertrages erforderlich ist,"],
            ["eine gesetzliche Verpflichtung besteht,"],
            ["eine entsprechende Einwilligung vorliegt oder"],
            ["die Weitergabe auf einer sonstigen gesetzlichen Grundlage zulässig ist."],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Eine Weitergabe personenbezogener Daten zu fremden Werbezwecken erfolgt nicht ohne entsprechende Rechtsgrundlage.",
          ],
        },
      ],
    },
    {
      titel: "15. Speicherdauer",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Wir speichern personenbezogene Daten nur so lange, wie dies für die jeweiligen Zwecke erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Wird ein Benutzerkonto gelöscht oder endet eine Vertragsbeziehung, werden personenbezogene Daten gelöscht oder gesperrt, soweit keine gesetzlichen Aufbewahrungspflichten, berechtigten Interessen oder sonstigen gesetzlichen Gründe für eine weitere Speicherung bestehen.",
          ],
        },
      ],
    },
    {
      titel: "16. Datensicherheit",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Wir treffen angemessene technische und organisatorische Maßnahmen, um personenbezogene Daten gegen Verlust, Manipulation, unbefugten Zugriff und sonstige Risiken zu schützen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Hierzu gehören insbesondere geeignete Zugriffs- und Berechtigungskonzepte sowie technische Sicherheitsmaßnahmen.",
          ],
        },
      ],
    },
    {
      titel: "17. Rechte der betroffenen Personen",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Sie haben nach Maßgabe der gesetzlichen Voraussetzungen insbesondere das Recht auf:",
          ],
        },
        {
          art: "liste",
          punkte: [
            ["Auskunft über Ihre personenbezogenen Daten"],
            ["Berichtigung unrichtiger Daten"],
            ["Löschung"],
            ["Einschränkung der Verarbeitung"],
            ["Widerspruch gegen bestimmte Verarbeitungen"],
            ["Datenübertragbarkeit"],
            ["Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft"],
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Zur Ausübung Ihrer Rechte können Sie sich an die oben genannten Kontaktdaten wenden.",
          ],
        },
      ],
    },
    {
      titel: "18. Beschwerderecht",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde über die Verarbeitung Ihrer personenbezogenen Daten zu beschweren.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["Für Unternehmen mit Sitz in Baden-Württemberg ist insbesondere zuständig:"],
        },
        {
          art: "absatz",
          inhalt: [
            "Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg.",
          ],
        },
      ],
    },
    {
      titel: "19. Änderungen dieser Datenschutzerklärung",
      bloecke: [
        {
          art: "absatz",
          inhalt: [
            "eff.bee.zee wird schrittweise weiterentwickelt. Neue Funktionen können auch neue Verarbeitungen personenbezogener Daten mit sich bringen.",
          ],
        },
        {
          art: "absatz",
          inhalt: [
            "Wir passen diese Datenschutzerklärung deshalb an, wenn sich Funktionen, technische Systeme, Dienstleister oder rechtliche Anforderungen ändern.",
          ],
        },
        {
          art: "absatz",
          inhalt: ["Es gilt die jeweils auf eff.bee.zee veröffentlichte aktuelle Fassung."],
        },
      ],
    },
  ],
};
