import type { ReleaseGeschichte } from "../types/release";

/**
 * Der lesbare Text des öffentlichen Blogs (AGE-705) — VON HAND gepflegt.
 *
 * Die Datei daneben, `release-entries.generated.ts`, entsteht bei jedem Build
 * neu aus dem Archiv. Sie kann Handarbeit deshalb nicht aufbewahren, und genau
 * darum steht der lesbare Text hier und nicht dort.
 *
 * **Der Archiveintrag ist der Anlass, nicht die Vorlage.** Eine Geschichte
 * beantwortet drei Fragen — wozu brauche ich das, wie geht es heute, ab welcher
 * Stufe — und setzt kein Vorher voraus: die Mitglieder haben erst jetzt Zugang
 * und kennen keinen früheren Zustand. Die Stichpunkte des Archiveintrags sind
 * Rohstoff, kein Beleg; jede Geschichte wird gegen die geltende Anforderung in
 * `openspec/specs/` und gegen die Anwendung geprüft.
 *
 * **Wo Archiv und Anwendung auseinanderlaufen, gilt die Anwendung.** Gemessen
 * am 08.09. an drei Stellen: die Glocke meldet heute acht Anlässe, nicht die
 * vier des Archiveintrags; die Nachrichten-Leiste dockt ab `xl` an, nicht ab
 * `lg`; und die Feed-Sortierung hat drei Ordnungen, nicht zwei.
 *
 * **`text` trägt kein Markup.** Kein Markdown, kein HTML. Derselbe Text kann in
 * eine Zustellung wandern, und das Modal rendert ihn unverändert als Klartext —
 * Sternchen wären dort als Sternchen zu sehen. Eine Leerzeile trennt Absätze.
 *
 * **`freigegeben` ist die redaktionelle Freigabe, nicht der Commit.** Eine
 * Geschichte darf hier liegen, ohne öffentlich zu sein.
 *
 * **Das Repository ist öffentlich.** Keine Namen, Anschriften, Adressen oder
 * Telefonnummern, keine Profil-, Beitrags- oder Nachrichteninhalte einzelner
 * Mitglieder. Beispiele sind erfunden.
 */
export const RELEASE_GESCHICHTEN: ReleaseGeschichte[] = [
  // ── Nachrichten ───────────────────────────────────────────────────────────
  {
    slug: "2026-08-26-nachrichten-ungelesen-zaehler",
    datum: "2026-08-26",
    titel: "Hat jemand geantwortet?",
    text: `Montagmorgen, Seite auf — meistens ist das die erste Frage.

Die Antwort steht oben in der Kopfzeile. Die Sprechblase trägt die Anzahl deiner ungelesenen Nachrichten, und ein Klick bringt dich direkt in die Gespräche.

Ist alles gelesen, bleibt sie trotzdem stehen. So liegt der Weg zu deinen Nachrichten immer an derselben Stelle, auch wenn du ihn zum ersten Mal suchst.

Steht statt einer Zahl ein Ausrufezeichen, ließ sich die Anzahl gerade nicht abrufen. Eine Null stünde dort nur, wenn wirklich nichts wartet.

Ein bestätigtes Konto genügt.`,
    bild: {
      src: "/bilder/sprechblase-zaehler.png",
      alt: "Die Kopfzeile mit der Sprechblase, die eine 4 für vier ungelesene Nachrichten trägt",
      width: 180,
      height: 64,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-27-chat-rechte-sidebar",
    datum: "2026-08-27",
    titel: "Ein Gespräch mitnehmen, während du woanders liest",
    text: `Du bist im Verzeichnis unterwegs und mittendrin schreibt dir jemand. Bisher hieße das: Seite verlassen, antworten, zurückfinden.

Dafür gibt es die Leiste am rechten Rand. Auf einem breiten Bildschirm bleibt sie neben jeder Seite stehen, mit deinen Gesprächen darin.

Beim ersten Besuch ist sie eingeklappt. Klapp sie auf, und die Anwendung merkt sich das für dieses Gerät. Auf einem schmaleren Fenster wird aus der Leiste eine Schublade, die du über einen eigenen Schalter in der Kopfzeile öffnest.

Auf der Nachrichtenseite selbst blendet sie sich aus — dort steht die Gesprächsliste ja schon.

Zu jedem Gespräch siehst du die letzte Nachricht. Das ist eine Vorschau, keine Lesebestätigung: dass sie dort steht, heißt nicht, dass die andere Seite sie gelesen hat.

Schreiben kannst du jemandem, sobald zwischen euch eine Kontaktanfrage angenommen ist.`,
    bild: {
      src: "/bilder/rechte-leiste.png",
      alt: "Das Verzeichnis mit der aufgeklappten Nachrichtenleiste rechts daneben, darin drei Gespräche",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-27-chatfenster-angedockt",
    datum: "2026-08-27",
    titel: "Drei Gespräche gleichzeitig",
    text: `Ein Klick in der Gesprächsliste öffnet auf einem breiten Bildschirm kein neues Seitenziel, sondern ein kleines Fenster am unteren Rand. Du liest weiter, wo du bist, und antwortest nebenbei.

Drei Fenster stehen gleichzeitig offen. Öffnest du ein viertes, schließt sich das, das am längsten unberührt war. Verloren ist nichts, es steht weiter in der Liste daneben. Wird der Platz eng, teilen sich die Fenster die Breite, statt dass eines angeschnitten wird.

Jedes lässt sich einzeln klein machen und einzeln schließen. Klein bleibt die Titelzeile stehen, mit Bild, Name und der Anzahl ungelesener Nachrichten.

Die Fenster überleben einen Seitenwechsel und auch das Neuladen. Sie liegen auf deinem Gerät, nicht auf dem Server. An einem anderen Rechner fängst du wieder mit einer leeren Reihe an.

Ein aufgezogenes Fenster setzt deinen Lesestand vor, genau wie die vollständige Ansicht. Ein kleingemachtes tut das nicht: dort ist nichts gelesen worden.

Auf schmaleren Fenstern und auf dem Telefon gibt es die Reihe nicht. Dort ist die Nachrichtenseite der Weg.`,
    bild: {
      src: "/bilder/chatfenster.png",
      alt: "Drei angedockte Chatfenster nebeneinander am unteren Rand, während im Hintergrund das Verzeichnis offen bleibt",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-28-emoji-und-zeitstempel-im-chat",
    datum: "2026-08-28",
    titel: "Emoji, Uhrzeit und der Tag darüber",
    text: `In der Zeile, in der du schreibst, sitzt ein Schalter für Emoji. Er öffnet ein Feld mit rund 1900 Zeichen in neun Gruppen, und du kannst darin auf Deutsch suchen: „Herz“, „grün“, auch „gruen“ ohne Umlaut.

Das Feld lässt sich vollständig mit der Tastatur bedienen. Die Zeichen laden erst beim ersten Öffnen und bremsen den Seitenaufbau daher nicht.

Jede Nachricht trägt ihre Uhrzeit, umgerechnet auf die Zeitzone, in der du gerade bist. Fährst du mit der Maus darüber, siehst du den vollständigen Zeitpunkt.

Zwischen den Tagen steht ein Marker: „Heute“, „Gestern“, sonst der Wochentag oder das Datum. So steht der Tag einmal über der Gruppe statt an jeder einzelnen Nachricht.

Getippte Emoticons werden beim Absenden zu Emoji: aus einem Doppelpunkt mit Bindestrich und Klammer wird ein lächelndes Gesicht. Die Liste ist bewusst kurz und greift nur an Wortgrenzen, damit Hausnummern und Beträge unangetastet bleiben. Was schon geschrieben ist, ändert sich nicht mehr.`,
    bild: {
      src: "/bilder/emoji-feld.png",
      alt: "Ein Gespräch mit geöffneter Emoji-Auswahl über dem Schreibfeld und Uhrzeiten an den Nachrichten",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-28-chat-verlauf-paging",
    datum: "2026-08-28",
    titel: "Weiter zurück im Gespräch",
    text: `Ein langes Gespräch öffnet sich sofort. Sichtbar sind die letzten 50 Nachrichten — also genau die Stelle, an der du weiterliest.

Willst du weiter zurück, steht am oberen Rand „Ältere laden“. Der Knopf holt die nächsten 50 und verschwindet, sobald der Verlauf vollständig ist.

Die Ansicht bleibt dabei stehen, wo sie war. Nachgeladene Nachrichten treten oben hinzu, ohne dass es ans Ende des Gesprächs springt. Sonst müsstest du nach jedem Klick den Faden neu suchen.

Die Tagesmarker rücken mit: lädst du ältere Nachrichten desselben Tages nach, steht der Marker danach über der ersten davon.

Das gilt in der vollständigen Ansicht und in den kleinen Fenstern gleichermaßen.`,
    bild: {
      src: "/bilder/aeltere-laden.png",
      alt: "Ein Gesprächsverlauf mit dem Knopf „Ältere laden“ über der obersten Nachricht und Tagestrennern dazwischen",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },

  // ── Aktivität ─────────────────────────────────────────────────────────────
  {
    slug: "2026-08-25-activity-concept-level",
    datum: "2026-08-25",
    titel: "Wo der Club spricht",
    text: `Die Aktivität ist der gemeinsame Strom aus Beiträgen. Oben stehen drei Reiter: „Alle Beiträge“, „Beiträge von mir“ und „Gespeichert“.

Daneben wählst du die Sortierung: „Neueste zuerst“, „Älteste zuerst“ oder „Beliebteste“. Beliebtheit zählt dabei nur, was du auch sehen darfst; eine Zahl über verborgene Beiträge würde genau diese verraten.

Rechts steht eine Spalte mit Filtern nach Themen und Beitragsarten. Eine Filterkarte, zu der es gerade keine Werte gibt, erscheint gar nicht erst. Auf einem breiten Bildschirm bleibt die Spalte beim Blättern stehen, auf einem schmalen rückt sie in den Fluss der Seite.

Darunter siehst du die aktivsten Mitglieder, gezählt nach der Anzahl ihrer Beiträge. Wer sein Profil zurückgezogen hat oder noch nicht bestätigt ist, erscheint dort nicht.

Ohne Anmeldung siehst du „Alle Beiträge“. Die beiden anderen Reiter beziehen sich auf dich und setzen ein Konto voraus.`,
    bild: {
      src: "/bilder/aktivitaet.png",
      alt: "Die Seite Aktivität mit Beitragsfeld, den drei Reitern, der Sortierung und der rechten Spalte",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-25-feed-beitragstyp-mehrfachauswahl",
    datum: "2026-08-25",
    titel: "Nur die Beitragsarten, die dich interessieren",
    text: `In der Seitenspalte stehen vier Auswahlkästchen: Bild, Video, Event und Text. Hakst du mehrere an, siehst du Beiträge, die einer der gewählten Arten entsprechen.

Kein Haken heißt „alle Arten“. Einen eigenen Eintrag „Alle Typen“ gibt es deshalb nicht: keiner angehakt und alle vier angehakt müssten dasselbe bedeuten.

Über dem Feed steht dann „Gefiltert nach“ mit den gewählten Arten. Jede lässt sich dort einzeln wieder abwählen, und daneben liegt ein Weg, alle Filter auf einmal zu entfernen. So siehst du auch bei weggeklappter Spalte, wonach gerade gefiltert wird.

Für die Themen gilt dasselbe: mehrere zusammen zeigen alles, was zu einem davon passt, nicht nur das, was zu allen passt.`,
    bild: {
      src: "/bilder/feed-filter.png",
      alt: "Der Feed mit zwei angehakten Beitragsarten und dem Merkzettel „Gefiltert nach“ über der Liste",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-30-geplante-beitraege",
    datum: "2026-08-30",
    titel: "Heute schreiben, Dienstag zeigen",
    text: `Manches schreibt man dann, wenn man Zeit hat, und zeigen möchte man es zu einem anderen Zeitpunkt. Im Eingabefeld für einen neuen Beitrag gibst du deshalb ein Datum und eine Uhrzeit an, statt sofort zu veröffentlichen.

Bis dahin sieht den Beitrag nur du selbst, gekennzeichnet mit „Geplant für“ und dem Zeitpunkt. Sonst niemand — auch keine Administration, und es gibt keine Freigabe durch andere.

Bis der Zeitpunkt erreicht ist, kannst du den Beitrag ändern, den Zeitpunkt verschieben, ihn auf „sofort“ stellen oder den Beitrag löschen.

Ist der Zeitpunkt da, erscheint der Beitrag im Feed, als wäre er in diesem Moment geschrieben worden: oben, nicht an der Stelle, an der du ihn verfasst hast.

Wer nichts plant, merkt davon nichts.`,
    bild: {
      src: "/bilder/beitrag-planen.png",
      alt: "Ein Beitrag mit dem Hinweis, für welchen Tag und welche Uhrzeit er geplant ist",
      width: 769,
      height: 250,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-31-composer-abbruch",
    datum: "2026-08-31",
    titel: "Einen angefangenen Beitrag verwerfen",
    text: `Neben „Posten“ steht „Abbrechen“. Der Weg zurück gehört zu jedem Formular, in das man etwas hineinschreiben kann.

Verworfen wird alles auf einmal: der Text, ein eingefügter Video-Link samt dem aufgeklappten Feld dafür, die gewählten Bilder, die gewählten Themen, die Sichtbarkeit zurück auf „Mitglieder“ und ein geplanter Zeitpunkt zurück auf „sofort“. Auch eine stehen gebliebene Fehlermeldung zu einem Bild verschwindet.

Klappst du das Feld danach wieder auf, beginnt es leer.`,
    bild: {
      src: "/bilder/beitrag-abbrechen.png",
      alt: "Die Knopfreihe unter dem Beitragsfeld mit Bild, Video, Abbrechen und Posten",
      width: 400,
      height: 64,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-31-suchspalte-rechts",
    datum: "2026-08-31",
    titel: "Filter, die beim Blättern nicht weglaufen",
    text: `Vier Flächen haben ihre Suche und ihre Filter an derselben Stelle, rechts neben der Liste: das Mitgliederverzeichnis, die Events, die Academy und die Aktivität. Auf einem breiten Bildschirm bleibt diese Spalte beim Blättern stehen.

Wer weit unten in einer langen Liste steht und den Filter ändern will, muss also nicht erst wieder nach oben.

Bei den Events suchst du über Titel, Beschreibung und Ort und grenzt nach Art und Thema ein. In der Academy suchst du im Text der Beiträge, grenzt über Schlagworte ein und wählst die Sortierung. Im Verzeichnis stehen Suche und Filter dauerhaft offen, statt zugeklappt.

Was du in diesen Spalten findest, hängt von deiner Stufe ab. Im Verzeichnis erscheinen die Filter für Kompetenz, Thema und Angebote erst ab Discover.

Eine Filterkarte, zu der es gerade keine Werte gibt, erscheint gar nicht. Suche und Sortierung stehen dagegen immer.

Auf einem schmalen Fenster oder auf dem Telefon rückt die Spalte in den normalen Fluss der Seite. Die Kartenraster richten sich nach dem Platz, den ihre Spalte tatsächlich hat, und brechen um, statt sich zu quetschen.`,
    bild: {
      src: "/bilder/suchspalte.png",
      alt: "Weit heruntergeblätterte Mitgliederkarten, während die Filterspalte rechts daneben stehen bleibt",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },

  // ── Events ────────────────────────────────────────────────────────────────
  {
    slug: "2026-09-07-events-vorlagen-und-serientermine",
    datum: "2026-09-07",
    titel: "Eine Terminreihe, einmal eingerichtet",
    text: `Wer regelmäßig zu etwas einlädt — ein Stammtisch, eine Sprechstunde, ein monatlicher Austausch —, füllt den Termin nicht jedes Mal neu aus. Eine Vorlage hält alles fest, was gleich bleibt: Titel, Uhrzeit, Dauer, Typ, Ort, Kapazität, Sichtbarkeit, Themen und Titelbild.

Die Vorlagen liegen unter Events im Reiter „Vorlagen“. Dort legst du eine an und gibst ihr eine Wiederholung: wöchentlich an einem Wochentag, monatlich an einem festen Tag im Monat, oder monatlich am n-ten Wochentag — etwa jeder erste Dienstag im Monat. Eine Vorlage ohne Regel ist ebenfalls möglich; aus ihr entsteht ein einzelner Termin zu einem Datum, das du angibst.

Aus der Vorlage erzeugst du dann die Termine: ein Startdatum, dazu entweder eine Anzahl oder ein Enddatum, höchstens 52 Termine je Erzeugung. Bevor du bestätigst, siehst du die Liste der Daten, die entstehen würden.

Jeder erzeugte Termin ist danach ein gewöhnliches Event. Anmeldung, Kapazität, Warteliste und Check-in gelten für jeden Termin einzeln, nicht für die Reihe. Fällt ein Termin aus oder verschiebt er sich, bearbeitest oder löschst du genau diesen einen — die übrigen bleiben unberührt.

Wer ein Event anlegen darf, darf auch eine Vorlage anlegen und daraus Termine erzeugen. Der Reiter erscheint, sobald du angemeldet bist.`,
    bild: {
      src: "/bilder/event-vorlagen.png",
      alt: "Der Reiter Vorlagen unter Events mit drei Terminreihen und dem Knopf „Termine erzeugen“",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-25-event-anmeldeknopf-teilnahmeschwelle",
    datum: "2026-08-25",
    titel: "Warum manchmal ein grauer Knopf dasteht",
    text: `Events gibt es in zwei Sichtbarkeiten. Öffentliche Events stehen jedem bestätigten Konto offen. Events für Mitglieder verlangen zum Anmelden die Stufe Discover.

Reicht deine Stufe für ein Event nicht, bleibt der Anmeldeknopf gesperrt. Daneben steht, warum: welche Stufe nötig ist und wo du zur Mitgliedschaft kommst.

Wer ein Event ausrichtet, darf sich zum eigenen Event immer anmelden, unabhängig von seiner Stufe.

Solange deine Stufe noch geladen wird, ist der Knopf nicht gesperrt.

Sehen kannst du beide Arten von Events. Die Stufe entscheidet über die Anmeldung, nicht darüber, ob ein Termin im Kalender auftaucht.`,
    bild: {
      src: "/bilder/anmeldeknopf-gesperrt.png",
      alt: "Ein Event mit grau gesperrtem Anmeldeknopf und der Begründung mit der nötigen Stufe daneben",
      width: 1034,
      height: 180,
    },
    freigegeben: false,
  },

  // ── Verzeichnis ───────────────────────────────────────────────────────────
  {
    slug: "2026-09-02-rechte-matrix-stufen",
    datum: "2026-09-02",
    titel: "Das Verzeichnis beginnt bei Connect",
    text: `Das Mitgliederverzeichnis ist ab der Stufe Connect zu sehen. Du siehst die Liste aller Mitglieder, kannst darin suchen und nach Branche und Region eingrenzen.

Die ausführlichen Angaben eines Profils beginnen eine Stufe höher, ab Discover: Kompetenzen, Interessen, Kompass-Themen und das Such- und Bieteprofil. Auf den Karten im Verzeichnis bleiben diese Felder darunter leer, und auch die Suche findet unterhalb von Discover nichts, was in ihnen steht.

Passend dazu erscheinen die Filter für Kompetenz, Thema und Angebote erst ab Discover. Unterhalb dieser Stufe stehen sie nicht da; an ihrer Stelle steht, ab wann es sie gibt.

Diese Grenzen sitzen im Server, nicht in der Oberfläche. Was du nicht sehen darfst, wird gar nicht erst ausgeliefert.`,
    bild: {
      src: "/bilder/mitgliederliste.png",
      alt: "Das Verzeichnis mit Mitgliederkarten, jede mit Titelbild, Stufe und einem Satz zur Person",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-25-verzeichnis-reiter-und-kartencover",
    datum: "2026-08-25",
    titel: "Alle Mitglieder, und deine Kontakte",
    text: `Über dem Verzeichnis stehen zwei Reiter: „Alle Mitglieder“ und „Meine Kontakte“, jeweils mit der Anzahl daneben. Beide stehen immer da, auch wenn du noch keinen Kontakt hast.

Der Reiter sitzt neben Suche und Filter, nicht darüber, und ein Wechsel zwischen den Reitern verwirft deine Suche nicht.

Auf den Karten steht das Titelbild des Profils, dazu Name und Branche. Wer kein Titelbild hinterlegt hat, bekommt eine ruhige Fläche statt eines zufälligen Ersatzbildes.

Wie ausführlich eine Karte ausfällt, hängt von deiner Stufe ab.`,
    bild: {
      src: "/bilder/verzeichnis-reiter.png",
      alt: "Die beiden Reiter „Alle Mitglieder“ und „Meine Kontakte“, jeder mit seiner Anzahl daneben",
      width: 770,
      height: 62,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-25-profil-biete-suche-und-radar",
    datum: "2026-08-25",
    titel: "Dein Profil, ohne erfundene Zahlen",
    text: `Dein Profil erreichst du über „Mein Profil“. Oben stehen Bild, Name, Branche und Region, darunter deine Mitgliedschaft und ein Weg zum Bearbeiten.

Darunter stehen deine Interessen und Kompass-Einträge als Reihe kurzer Marken, und deine Such- und Bieteangaben als lesbarer Text. Kategorisierte Einträge tragen dabei keinen technischen Schlüssel mehr und keinen Titel, der nur den Anfang der Beschreibung wiederholt.

Stammen deine Angaben aus einer Übernahme älterer Daten, werden Reste der alten Formatierung beim Anzeigen weggelassen. In deinen Daten selbst wird dafür nichts verändert — du kannst sie jederzeit so bearbeiten, wie du sie eingegeben hast.

Was frühere Entwürfe als „Erfolgsradar“ zeigten, gibt es nicht. Dasselbe gilt für Statistiken, Projekte und Investments: erfundene Zahlen über ein Mitglied sind ein schlechterer erster Eindruck als eine ehrliche Leere.

Ist dein Profil noch leer, steht das auch so da, zusammen mit dem Weg zum Ausfüllen. Wie viel andere davon sehen, hängt von deren Stufe ab.`,
    bild: {
      src: "/bilder/mein-profil.png",
      alt: "Ein Profil mit Titelbild, Rollen, Ort und den drei Zählern für Netzwerk, Events und Nachrichten",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },

  // ── Hinweise ──────────────────────────────────────────────────────────────
  {
    slug: "2026-08-27-glocke-und-hinweistypen",
    datum: "2026-08-27",
    titel: "Was die Glocke meldet",
    text: `Oben in der Kopfzeile steht eine Glocke. Sie zeigt, was seit deinem letzten Blick dazugekommen ist, und bei null zeigt sie keine Zahl.

Gemeldet werden acht Anlässe: ein neuer Beitrag, ein neues Event, ein Kommentar zu deinem Beitrag, ein Gefällt-mir zu deinem Beitrag, eine neue Nachricht, eine eingegangene Kontaktanfrage sowie die Annahme und die Ablehnung einer Anfrage. Dazu kommt ein Hinweis, wenn es Neues in der App gibt.

Einen Hinweis markierst du einzeln als gelesen, oder alle auf einmal.

Was dir davon zu viel ist, schaltest du in den Einstellungen ab — ein Schalter je Ereignis, und er gilt für die Glocke wie für eine Push-Nachricht aufs Telefon. Voreingestellt ist alles eingeschaltet. Die drei Anlässe rund um Kontaktanfragen hängen an einem gemeinsamen Schalter.

Die Glocke zeigt ausschließlich deine eigenen Hinweise.`,
    bild: {
      src: "/bilder/glocke.png",
      alt: "Die geöffnete Glocke mit fünf Hinweisen und der Zeile „Alle als gelesen markieren“ darunter",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-25-stille-fehlschlaege-und-anfragen-weg",
    datum: "2026-08-25",
    titel: "Wo eine Kontaktanfrage landet",
    text: `Schickt dir jemand eine Kontaktanfrage, findest du sie an zwei Stellen: als Hinweis in der Glocke und als Eintrag „Meine Anfragen“ im Menü unter „Mein Bereich“, mit der Anzahl daneben.

Dieser Menüeintrag steht da, solange offene Anfragen vorliegen, und verschwindet, wenn keine mehr offen sind. Anders als die Sprechblase für Nachrichten ist er ein Vorgang und kein Ort; er darf mit dem Vorgang gehen.

Lässt sich die Liste der Anfragen gerade nicht laden, steht das auch so da. Ein gescheiterter Abruf sähe sonst genauso aus wie ein leerer Posteingang. Schlägt nur ein Nachladen fehl, während bereits Anfragen angezeigt werden, bleiben diese stehen.

Versuchst du dich mit einer Adresse zu registrieren, zu der es schon ein Konto gibt, bekommst du einen neutralen Hinweis mit dem Weg zum Zugangslink. Eine Meldung, die ausspricht, dass es dieses Konto gibt, bekämst du nicht.`,
    bild: {
      src: "/bilder/meine-anfragen.png",
      alt: "Der Menüpunkt „Meine Anfragen“ mit einer Anzahl offener Anfragen daneben",
      width: 270,
      height: 205,
    },
    freigegeben: false,
  },

  // ── Bedienung ─────────────────────────────────────────────────────────────
  {
    slug: "2026-08-28-sidebar-pill",
    datum: "2026-08-28",
    titel: "Platz schaffen, wenn du ihn brauchst",
    text: `Links steht das Menü, rechts die Leiste mit den Gesprächen. Beide klappst du über dasselbe Bauteil weg: einen halben Knopf am inneren Rand der Leiste, der ein Stück über die Kante hinausragt. Links und rechts sitzt er auf derselben Höhe, nur gespiegelt.

Er ist immer sichtbar, nicht erst, wenn du mit der Maus in die Nähe kommst. Auf einem Touchgerät gäbe es ihn sonst gar nicht.

Ist die rechte Leiste eingeklappt, bleibt die Sprechblase darin anklickbar. Sie zeigt weiterhin, ob etwas Ungelesenes da ist, und führt zu den Nachrichten.

Was du einklappst, bleibt eingeklappt, auch nach einem Neuladen. Der Zustand liegt auf deinem Gerät.`,
    bild: {
      src: "/bilder/leisten-einklappen.png",
      alt: "Die eingeklappte Navigation als schmale Symbolleiste, daneben der Knopf zum Wiederaufziehen",
      width: 460,
      height: 500,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-26-fix-mobile-overflow",
    datum: "2026-08-26",
    titel: "Die App auf dem Telefon",
    text: `Die Anwendung ist bis herunter zu einer Fensterbreite von 320 Punkten ausgelegt — schmaler als die meisten Telefone im Hochformat. Bis dorthin lässt sich keine Seite seitlich verschieben: du blätterst nach unten, nicht nach rechts.

Dafür sorgen die Bausteine, aus denen die Seiten bestehen. Eine Karte und eine Listenzeile geben ihren Inhalt von sich aus nach, statt ihn über den Rand zu drücken. Damit gilt die Zusage auch für Seiten, die es heute noch nicht gibt.

Wo eine Tabelle sich beim besten Willen nicht schmaler machen lässt — etwa in der Verwaltung —, bekommt sie einen eigenen scrollbaren Rahmen. Dann schiebt sich die Tabelle, nicht die ganze Seite.

Ein Prüfschritt im Testlauf achtet darauf, dass keine feste Spaltenbreite ohne Rückfall für schmale Geräte hinzukommt. Die Zusage wird also bewacht, nicht nur einmal hergestellt.`,
    bild: {
      src: "/bilder/schmal.png",
      alt: "Dieselbe Verzeichnisseite auf einem 390 Pixel breiten Fenster, einspaltig und ohne Querlauf",
      width: 390,
      height: 900,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-26-add-video-consent-gate",
    datum: "2026-08-26",
    titel: "Warum ein Video erst auf Klick lädt",
    text: `Ein eingebettetes Video lädt nicht von selbst. An seiner Stelle steht zunächst eine Fläche mit dem Hinweis, von welchem Anbieter das Video kommt, und ein Knopf, um es zu laden.

Der Grund steht daneben: sobald das Video geladen wird, entsteht eine Verbindung zu diesem Anbieter, und dabei geht deine IP-Adresse an ihn. Diese Entscheidung soll bei dir liegen und nicht dadurch fallen, dass du eine Seite geöffnet hast, auf der zufällig ein Video steht.

Ein Verweis auf die Datenschutzerklärung steht direkt an dieser Fläche, dort, wo die Frage gestellt wird.

Bis du klickst, wird nichts vom Anbieter nachgeladen: kein Player, kein Vorschaubild von dort, keine Zählpixel.

Das gilt überall, wo Videos vorkommen, auch ohne Konto.`,
    bild: {
      src: "/bilder/video-gesperrt.png",
      alt: "Ein Beitrag mit Video-Platzhalter, dem Knopf „Video von YouTube laden“ und dem Anbieterhinweis darunter",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },
  {
    slug: "2026-08-27-video-freigabe-merken",
    datum: "2026-08-27",
    titel: "Einmal freigeben statt jedes Mal",
    text: `Gibst du ein Video frei, gilt das ab dann für den jeweiligen Anbieter, dauerhaft und auf diesem Gerät. Auf einer Seite mit fünf Videos musst du nicht fünfmal dasselbe bestätigen.

Die Freigabe gilt je Anbieter, nicht allgemein: gibst du den einen frei, hast du über den anderen nichts gesagt.

Sie greift sofort auf allen weiteren Videos derselben Seite, ohne dass du neu laden musst. Ein Video, das du gerade angeklickt hast, läuft dabei sofort los und bekommt den Tastaturfokus. Eines, das nur wegen der gemerkten Freigabe mitgeladen wurde, tut beides nicht: es fängt nicht von selbst an zu spielen, und es reißt dir den Fokus nicht weg.

Zurücknehmen kannst du die Freigabe auf der Datenschutzseite, je Anbieter einzeln. Diese Seite ist auch ohne Konto erreichbar; wer nie angemeldet war, kommt trotzdem an den Widerruf.

Die Freigabe liegt auf deinem Gerät, nicht in deinem Konto. An einem anderen Rechner wirst du wieder gefragt.`,
    bild: {
      src: "/bilder/datenschutz-widerruf.png",
      alt: "Der Abschnitt der Datenschutzseite mit dem Knopf, über den sich eine erteilte Video-Freigabe widerrufen lässt",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },

  // ── Konto ─────────────────────────────────────────────────────────────────
  {
    slug: "2026-08-26-password-reset-flow",
    datum: "2026-08-26",
    titel: "Passwort vergessen",
    text: `Auf der Anmeldeseite steht unter dem Passwortfeld „Passwort vergessen?“. Genau dort sucht man ihn: in dem Moment, in dem man an diesem Feld scheitert.

Du gibst deine Adresse an und bekommst eine Nachricht mit einem Link. Über diesen Link setzt du ein neues Passwort. Der Link gilt 72 Stunden und lässt sich nur einmal verwenden; forderst du einen neuen an, wird der alte ungültig.

Mit dem neuen Passwort wirst du auf allen Geräten abgemeldet. Das ist Absicht: wenn jemand anderes an dein Konto gekommen ist, endet sein Zugang genau hier.

Hast du den Vorgang nicht angestoßen, kannst du die Nachricht ignorieren. Ohne den Link geschieht nichts, und dein bisheriges Passwort gilt weiter.

Wie oft ein solcher Link angefordert werden kann, ist begrenzt: nicht öfter als einmal pro Minute, und innerhalb von 24 Stunden nur eine begrenzte Zahl je Adresse. Das schützt dein Postfach davor, als Werkzeug benutzt zu werden.`,
    bild: {
      src: "/bilder/passwort-vergessen.png",
      alt: "Die Seite „Passwort vergessen“ mit dem Feld für die E-Mail-Adresse und dem Knopf „Link senden“",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },
  {
    slug: "2026-09-02-feedback-ausbauen",
    datum: "2026-09-02",
    titel: "Rückmeldung geben — und was damit passiert",
    text: `Im Menü steht ein Weg, Rückmeldung zu geben. Du wählst ein Thema, gibst eine Bewertung ab und schreibst dazu, was dir aufgefallen ist.

Zur Auswahl stehen fünf Themen: Generell, Fehler oder etwas geht nicht, Bedienung und Verständlichkeit, Inhalte und Texte, sowie Idee oder Wunsch. Ohne Auswahl zählt eine Rückmeldung als Generell.

Du kannst ein Bild mitschicken. Bei einer Sache, die anders aussieht als erwartet, ist ein Bildschirmfoto oft schneller erklärt als drei Sätze.

Deine Rückmeldung geht an die Administration, die sie nach Thema und Bewertung durchsehen kann. Sie kann daraus ein Gespräch mit dir eröffnen, ohne dass vorher eine Kontaktanfrage nötig wäre. Sonst ließe sich eine Rückfrage zu einem gemeldeten Problem gar nicht stellen. In diesem Gespräch dürfen beide Seiten schreiben.

Anonym ist Feedback damit nicht: es hängt an deinem Konto, weil sonst niemand zurückfragen könnte.`,
    bild: {
      src: "/bilder/feedback.png",
      alt: "Das Feedback-Fenster mit Sternen, Themenauswahl und drei Feldern für Lob, Fehlendes und Ideen",
      width: 1440,
      height: 900,
    },
    freigegeben: false,
  },
];
