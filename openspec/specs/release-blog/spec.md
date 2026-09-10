# release-blog Specification

## Purpose

Der **öffentliche Release-Blog** auf `www.effbeezee.com` — die Fläche, auf der
ohne Anmeldung nachzulesen ist, was die Anwendung kann und was zuletzt
dazugekommen ist.

Er hat zwei Ordnungen derselben Texte, und das ist die tragende Entscheidung:

- **Der Blog** beantwortet „was ist neu" — wöchentliche Ausgaben, jüngste
  zuerst, jede ein Eintrag mit Überblick und den vollen Texten der Woche.
- **Das Tutorial** beantwortet „wie geht das" — ein Weg in Etappen, eine Seite
  je Schritt.

Er wird **aus dem Repository gebaut** und liest die Datenbank nicht. Der Grund
ist eine Sicherheitsgrenze: `release_notes` ist nur für aktivierte, angemeldete
Mitglieder lesbar, und ein öffentlicher Lesepfad dorthin wäre ein neues Tor mit
Policy, Grant und Test. Was öffentlich steht, entscheidet stattdessen ein Feld
am Text (`freigegeben`) — nicht der Commit.

Abgegrenzt: die Release-Notes **in** der Anwendung (Modal, Aktivität) sind
nicht Gegenstand dieser Capability; sie hängen an `release_notes` und am
Admin-Versand.

## Requirements
### Requirement: Der lesbare Text einer Release-Geschichte wird im Repository verfasst

Das System SHALL den für Mitglieder lesbaren Text jeder Release-Geschichte in
einer versionierten Datei im Repository führen, und diese Datei SHALL die Stelle
sein, an der dieser Text **verfasst** wird.

Die Datei SHALL von Hand gepflegt sein und SHALL NOT von einem Erzeuger
überschrieben werden. Die aus dem Archiv erzeugte Datei kann diese Rolle NOT
übernehmen: sie wird bei jedem Build neu geschrieben und kann Handarbeit deshalb
nicht aufbewahren.

Jede Geschichte SHALL über einen Slug an den Archiveintrag gebunden sein, aus dem
sie entstanden ist, und dieser Slug SHALL zeichengleich mit dem des
Archiveintrags sein.

**Der öffentliche Blog SHALL ausschliesslich aus dieser Datei entstehen.** Er
SHALL NOT Text aus der Datenbank beziehen. Damit ist für den Blog genau eine
Quelle massgeblich.

Eine **Zustellung** an Mitglieder ist demgegenüber ein eigenes Ereignis mit
eigenem Text. Ein Admin SHALL den vorgeschlagenen Text vor dem Zustellen ändern
dürfen; die geänderte Fassung SHALL nur für diese Zustellung gelten und SHALL
NOT in die Datei zurückwirken. Weicht sie ab, ist das eine bewusste Anpassung an
den Anlass und SHALL NOT als zweite Pflegestelle derselben Geschichte gelten:
der Blog liest die Abweichung nie.

#### Scenario: Der Text überlebt einen Build

- **WHEN** der Erzeuger für die Archiv-Einträge läuft
- **THEN** bleibt die kuratierte Datei unverändert

#### Scenario: Eine Geschichte findet ihren Archiveintrag

- **WHEN** zu einem Archiveintrag eine kuratierte Geschichte vorliegt
- **THEN** trägt sie denselben Slug wie der Archiveintrag

#### Scenario: Eine abweichende Zustellung ändert den Blog nicht

- **WHEN** ein Admin den vorgeschlagenen Text vor dem Zustellen ändert
- **THEN** wird die geänderte Fassung zugestellt und der Blog zeigt weiterhin
  den Text aus der Datei

#### Scenario: Eine spätere Textänderung ändert nichts Zugestelltes

- **WHEN** der Text einer Geschichte geändert wird, nachdem eine Nachricht dazu
  zugestellt wurde
- **THEN** zeigt die zugestellte Nachricht weiterhin den Text, der zum Zeitpunkt
  der Zustellung galt

### Requirement: Eine Geschichte führt in eine Funktion ein und berichtet keine Änderung

Der Text einer Geschichte SHALL beschreiben, **was ein Mitglied heute tun kann**
— den Anlass, das heutige Verhalten und die Stufe, ab der es verfügbar ist. Er
SHALL NOT einen früheren Zustand voraussetzen.

Der Grund ist die Leserschaft: die Mitglieder haben erst jetzt Zugang bekommen
und kennen keinen vorherigen Zustand. Formulierungen wie „jetzt ohne
Doppelungen“, „läuft jetzt mit“ oder „der Umbau“ setzen eine Erfahrung voraus,
die niemand gemacht hat.

Der Archiveintrag SHALL als **Anlass** dienen, aus dem eine Geschichte entsteht,
und SHALL NOT als Beleg dafür gelten, dass das beschriebene Verhalten heute noch
so besteht. Jede Geschichte SHALL vor der Veröffentlichung gegen die geltende
Anforderung und die Anwendung geprüft werden.

#### Scenario: Eine Geschichte setzt kein Vorher voraus

- **WHEN** eine Geschichte ihren Gegenstand beschreibt
- **THEN** ist sie ohne Kenntnis eines früheren Zustands verständlich

#### Scenario: Eine Funktion mit Stufengrenze nennt sie

- **WHEN** die beschriebene Funktion erst ab einer Mitgliedsstufe verfügbar ist
- **THEN** nennt die Geschichte diese Stufe

### Requirement: Eine Release-Geschichte trägt Klartext ohne Markup

Der Text einer Geschichte SHALL Klartext sein. Absätze SHALL durch eine Leerzeile
getrennt werden. Der Text SHALL NOT Markdown, HTML oder eine andere
Auszeichnungssprache enthalten.

Der Grund ist keine Stilfrage: derselbe Text wird sowohl im Modal als auch auf
der öffentlichen Seite gezeigt, und das Modal rendert ihn unverändert als
Klartext. Auszeichnungszeichen wären dort für Mitglieder sichtbar.

Eine Prüfung SHALL das halten, statt sich darauf zu verlassen, dass niemand
Auszeichnungszeichen tippt.

#### Scenario: Auszeichnungszeichen im Text fallen auf

- **WHEN** der Text einer Geschichte eine Markdown-Betonung oder ein
  HTML-Element enthält
- **THEN** schlägt die Prüfung fehl und benennt die betroffene Geschichte

#### Scenario: Absätze entstehen aus Leerzeilen

- **WHEN** ein Text zwei durch eine Leerzeile getrennte Abschnitte trägt
- **THEN** zeigt die öffentliche Seite zwei Absätze

### Requirement: Eine veröffentlichte Geschichte trägt keine personenbezogenen Daten

Eine Geschichte SHALL keine Angaben zu einer bestimmten Person enthalten —
weder Namen, Anschriften, E-Mail-Adressen und Telefonnummern noch Inhalte aus
Profilen, Beiträgen, Nachrichten oder Anmeldungen einzelner Mitglieder. Dasselbe
SHALL für Testdaten gelten, die neben den Geschichten liegen.

Diese Zusage ist **nicht** durch die Prüfung des ausgelieferten Markups gedeckt:
das Repository ist öffentlich, also ist ein solcher Text bereits mit dem Commit
offengelegt, unabhängig davon, was ausgeliefert wird. Die Prüfung SHALL deshalb
**vor dem Commit** stattfinden.

Wo eine Geschichte einen Sachverhalt aus der laufenden Anwendung beschreibt,
SHALL sie ihn allgemein beschreiben und SHALL NOT einen dort vorgefundenen
Datensatz wiedergeben. Beispiele SHALL erfunden sein.

#### Scenario: Ein Name aus der Anwendung wird nicht übernommen

- **WHEN** eine Geschichte beim Betrachten der Anwendung entsteht
- **THEN** enthält sie keine dort vorgefundenen Angaben zu einer Person

#### Scenario: Ein Beispiel ist erfunden

- **WHEN** eine Geschichte ein Beispiel braucht
- **THEN** ist es erfunden und nicht einem Mitglied entnommen

### Requirement: Der öffentliche Blog liefert nichts Ausführbares und nichts Fremdes aus

Das erzeugte Markup SHALL ausschliesslich aus einer benannten, geschlossenen
Menge von Elementen und Attributen bestehen. Alles, was nicht in dieser Menge
steht, SHALL NOT erzeugt werden.

Ausgeschlossen SHALL insbesondere sein: Skript-Elemente, Ereignis-Attribute,
Adressen mit ausführbarem Schema, eingebettete Rahmen und **jeder Verweis auf
eine fremde Herkunft** — auch Stile, Schriften und Bilder. Eine Prüfung auf
einzelne Zeichenfolgen genügt dafür NOT: sie benennt, was verboten ist, statt
festzulegen, was erlaubt ist, und übersieht jede Gestalt, an die niemand gedacht
hat.

**Jedes** Feld einer Geschichte SHALL beim Erzeugen des Markups maskiert werden
— Titel und Text ebenso wie jedes andere. Der Slug SHALL zusätzlich als sicherer
Pfadbestandteil geprüft werden und SHALL NOT als Pfad wirken können.

Diese Zusagen SHALL am **erzeugten Artefakt** geprüft werden und NOT an den
Eingaben, aus denen es entstand. Eine Prüfung der Eingaben belegt nicht, was
ausgeliefert wurde.

Das System SHALL NOT für den öffentlichen Blog einen Lesepfad für nicht
angemeldete Zugriffe auf die Tabelle der zugestellten Nachrichten anlegen.

#### Scenario: Ein unerlaubtes Element entsteht gar nicht erst

- **WHEN** die erzeugten Seiten geprüft werden
- **THEN** enthalten sie ausschliesslich Elemente und Attribute aus der
  erlaubten Menge

#### Scenario: Ein Verweis nach aussen fällt auf

- **WHEN** eine erzeugte Seite einen Verweis auf eine fremde Herkunft trüge
- **THEN** schlägt die Prüfung fehl

#### Scenario: Ein Sonderzeichen im Titel bleibt ein Zeichen

- **WHEN** der Titel einer Geschichte ein Zeichen enthält, das im Markup
  besondere Bedeutung hat
- **THEN** erscheint es auf der Seite als dieses Zeichen und verändert die
  Seitenstruktur nicht

#### Scenario: Ein Slug kann nicht aus seinem Verzeichnis ausbrechen

- **WHEN** ein Slug Zeichen enthielte, die einen Pfadwechsel bedeuten
- **THEN** schlägt die Prüfung fehl, statt eine Datei ausserhalb zu schreiben

#### Scenario: Die Seite braucht nach dem Laden nichts mehr

- **WHEN** eine Seite geladen wurde
- **THEN** stellt sie keine weitere Anfrage, und ihr Inhalt ist ohne Anmeldung
  und ohne Sitzung vollständig lesbar

### Requirement: Der öffentliche Blog wird getrennt von der Anwendung ausgeliefert

Der Blog SHALL ein eigenes Auslieferungsziel haben, getrennt von dem der
Anwendung, und SHALL unter einer eigenen Adresse erreichbar sein. Ein
Fehlschlag beim Ausliefern des einen SHALL das andere unverändert lassen.

Der Blog SHALL zwei Flächen führen — die **Ausgaben** und das **Tutorial** —
und je Geschichte eine eigene Seite.

Der Blog SHALL nur Geschichten ausliefern, die zur Veröffentlichung freigegeben
sind. Eine noch nicht freigegebene Geschichte SHALL im Repository liegen dürfen,
ohne öffentlich zu erscheinen — sonst wäre der Commit die Veröffentlichung.

Welche Archiveinträge eine Geschichte bekommen, SHALL eine redaktionelle
Entscheidung sein und SHALL NOT Gegenstand einer Zusage sein.

#### Scenario: Blog und Anwendung werden getrennt ausgeliefert

- **WHEN** der Blog ausgeliefert wird
- **THEN** verändert das die Auslieferung der Anwendung nicht

#### Scenario: Die Ausgaben stehen mit der jüngsten zuerst

- **WHEN** die Blog-Übersicht mehrere Ausgaben zeigt
- **THEN** steht die Ausgabe mit dem jüngsten Datum an erster Stelle

#### Scenario: Eine nicht freigegebene Geschichte erscheint nicht

- **WHEN** eine Geschichte im Repository liegt, aber nicht freigegeben ist
- **THEN** erscheint sie weder in der Übersicht noch als eigene Seite

### Requirement: Eine Übersicht reisst an, statt nur zu verlinken

Eine **Übersicht** — die Blog-Übersicht über die Ausgaben und die
Tutorial-Übersicht über die Kapitel — SHALL zu jedem Eintrag einen **Anriss**
führen, den ersten Absatz seines Textes, und daneben Titel, Datum und Bild.

Diese Anforderung gilt für die Übersichten und ausdrücklich NOT für die Seite
einer Ausgabe: dort steht der volle Text (siehe „Eine Ausgabe ist ein
Blogeintrag").

Der Anriss SHALL aus dem Text entstehen und SHALL NOT als eigenes Feld gepflegt
werden. Der Grund ist die Pflegestelle: ein zweites Textfeld wäre eine zweite
Stelle, an der derselbe Gedanke steht, und beide liefen auseinander, sobald
einer geändert wird.

Die Übersicht SHALL zwei Wege in dieselbe Geschichte führen — den Titel und
einen ausgeschriebenen Verweis am Ende des Anrisses — und beide SHALL auf
dieselbe Seite zeigen.

#### Scenario: Der Anriss ist der erste Absatz

- **WHEN** eine Geschichte mit mehreren Absätzen in der Übersicht steht
- **THEN** zeigt die Übersicht ihren ersten Absatz und keinen der folgenden

#### Scenario: Titel und Verweis führen an dieselbe Stelle

- **WHEN** eine Geschichte in der Übersicht steht
- **THEN** zeigen ihr Titel und ihr Weiterlesen-Verweis auf dieselbe Seite

### Requirement: Jede Geschichte trägt ein Bild aus eigener Herkunft

Jede Geschichte SHALL genau ein Bild tragen, das die beschriebene Fläche zeigt,
und dieses Bild SHALL einen Alternativtext sowie seine Breite und Höhe führen.

Breite und Höhe SHALL im Markup stehen. Ohne sie kennt der Browser das
Seitenverhältnis erst, wenn das Bild da ist, und schiebt den Text darunter genau
in dem Moment nach unten, in dem jemand ihn liest.

Die Bilddatei SHALL im Repository liegen und mit den Seiten ausgeliefert werden.
Sie SHALL NOT von einer fremden Herkunft geladen werden — die Zusage „kein
Verweis nach aussen“ gilt für Bilder wie für Stile und Schriften, und die
Prüfung des Artefakts SHALL die Bildadresse demselben Ursprungstest unterwerfen
wie einen Verweis.

Ein Bild SHALL gegen einen lokalen Stand mit erfundenen Daten entstehen. Ein
Bild aus der laufenden Anwendung trüge Mitgliederdaten in ein öffentliches
Repository, und der Commit wäre die Offenlegung — nicht erst die Auslieferung.

#### Scenario: Ein Bild ohne Datei fällt vor dem Ausliefern auf

- **WHEN** eine Geschichte auf eine Bilddatei zeigt, die es nicht gibt
- **THEN** schlägt die Prüfung fehl und benennt die betroffene Geschichte

#### Scenario: Ein Bild fremder Herkunft fällt auf

- **WHEN** eine erzeugte Seite ein Bild von einer fremden Herkunft lüde
- **THEN** schlägt die Prüfung des Artefakts fehl

#### Scenario: Das Bild liegt neben den Seiten

- **WHEN** der Blog erzeugt wird
- **THEN** liegt zu jeder ausgelieferten Geschichte ihre Bilddatei im
  Ausgabeordner

#### Scenario: Das Bild trägt Breite und Höhe

- **WHEN** eine Seite ein Bild zeigt
- **THEN** stehen dessen Breite und Höhe im Markup

### Requirement: Der Blog erscheint in wöchentlichen Ausgaben

Die Blog-Fläche SHALL nach **Ausgaben** gegliedert sein und NOT nach Themen. Eine
Ausgabe SHALL ein Datum, einen Titel, einen einleitenden Text und die
Geschichten tragen, die sie vorstellt.

Der Grund ist die Leseordnung: eine thematische Liste beantwortet die Frage
„was ist neu" nicht. Eine Ausgabe beantwortet sie für einen Zeitraum und nennt
mehrere Funktionen zusammen — so, wie sie ausgeliefert wurden.

Die Ausgaben SHALL mit der jüngsten zuerst stehen. Eine Geschichte SHALL in
höchstens **einer** Ausgabe erscheinen; zwei Ausgaben, die dieselbe Funktion
vorstellen, wären für die Leserschaft ein Widerspruch über den Zeitpunkt.

Der einleitende Text einer Ausgabe SHALL eine Meldung über einen Zeitraum sein
und ist damit ausdrücklich von der Zusage ausgenommen, kein Vorher
vorauszusetzen: die Ausgabe ist die Stelle, an der „neu" gesagt werden darf.
Der Text der Geschichte selbst SHALL zeitlos bleiben.

Eine Ausgabe SHALL nur die Geschichten zeigen, die zur Veröffentlichung
freigegeben sind, und SHALL NOT erscheinen, wenn keine ihrer Geschichten
freigegeben ist.

#### Scenario: Eine Ausgabe nennt mehrere Funktionen

- **WHEN** eine Ausgabe erscheint
- **THEN** führt sie ihren einleitenden Text und die Geschichten, die sie
  vorstellt

#### Scenario: Keine Geschichte steht in zwei Ausgaben

- **WHEN** die Ausgaben geprüft werden
- **THEN** erscheint jede Geschichte in höchstens einer von ihnen

#### Scenario: Eine Ausgabe ohne freigegebene Geschichte erscheint nicht

- **WHEN** keine Geschichte einer Ausgabe freigegeben ist
- **THEN** erscheint die Ausgabe weder in der Übersicht noch als eigene Seite

### Requirement: Eine Ausgabe ist ein Blogeintrag und trägt die vollen Texte

Die Seite einer Ausgabe SHALL den einleitenden Text und danach den
**vollständigen** Text jeder Geschichte tragen, die sie vorstellt, je als
eigener Abschnitt mit Titel und Bild.

Sie SHALL NOT auf die Seiten der einzelnen Geschichten verweisen. Der Grund ist
die Anzahl der Ebenen: von der Übersicht führt **ein** „Weiterlesen" in die
Woche, und wer dort ist, hat sich für ihre Details entschieden. Ein Verweis je
Geschichte machte daraus eine dritte Ebene und verteilte eine Woche auf fünf
Seiten — die Leserschaft klickte viermal für das, was ein Eintrag ist.

Die Kapitelseiten SHALL gleichwohl bestehen bleiben: das **Tutorial** führt
Etappe für Etappe durch sie hindurch, und dort ist eine Seite je Schritt die
richtige Form.

#### Scenario: Die Woche steht auf einer Seite

- **WHEN** eine Ausgabe mit mehreren Geschichten gezeigt wird
- **THEN** steht der volle Text jeder ihrer Geschichten auf dieser Seite

#### Scenario: Die Ausgabe verweist nicht auf einzelne Kapitelseiten

- **WHEN** eine Ausgabe gezeigt wird
- **THEN** führt kein Verweis von ihr auf die Seite einer einzelnen Geschichte

### Requirement: Eine unbekannte Adresse antwortet mit 404

Der Blog SHALL eine Seite `404.html` ausliefern, und zwar auch dann, wenn keine
einzige Geschichte freigegeben ist.

Der Grund ist gemessen und nicht theoretisch: ohne diese Datei liefert
Cloudflare Pages bei **jeder** unbekannten Adresse die Startseite mit Status
**200** (10.09., `/gibt-es-nicht.html` und
`/2026-08-26-password-reset-flow.html` gaben beide 200 und den Index).

Damit wäre eine Zusage dieses Changes unprüfbar: dass keine nicht freigegebene
Geschichte erreichbar ist, lässt sich an einer Fläche, auf der jede Adresse
antwortet, nicht mehr feststellen.

#### Scenario: Eine Adresse ohne Seite

- **WHEN** eine Adresse abgerufen wird, zu der keine Seite gehört
- **THEN** antwortet der Blog mit 404 und nicht mit der Startseite

#### Scenario: Auch eine leere Fläche hat eine 404-Seite

- **WHEN** keine Geschichte freigegeben ist
- **THEN** enthält die Auslieferung dennoch `404.html`

### Requirement: Die öffentliche Adresse einer Geschichte trägt kein Datum

Der Pfad einer Kapitelseite SHALL aus dem Slug der Geschichte OHNE dessen
Datumspräfix entstehen. Der Slug selbst SHALL unverändert bleiben — er ist der
Schlüssel zum Archiveintrag.

Der Grund ist ein Widerspruch, den die Adresse sonst behauptet: der Slug trägt
das Datum des Archiveintrags, die Geschichte steht aber in der Ausgabe einer
Woche, die davon abweicht. Das **Ausgabedatum** ist das einzige Datum, das die
Leserschaft sehen soll.

Der Erzeuger SHALL zurückweisen, wenn zwei Geschichten denselben Pfad ergeben —
die zweite Seite überschriebe die erste sonst lautlos.

#### Scenario: Die Adresse nennt das Datum nicht

- **WHEN** eine Geschichte mit datiertem Slug ausgeliefert wird
- **THEN** trägt weder ihr Dateiname noch ein Verweis auf sie dieses Datum

#### Scenario: Zwei Slugs, die sich nur im Datum unterscheiden

- **WHEN** zwei Geschichten nach Abzug des Datums denselben Pfad ergäben
- **THEN** bricht der Erzeuger ab, statt eine Seite zu überschreiben

### Requirement: Das Tutorial führt in einer festen Reihenfolge durch die Anwendung

Das System SHALL eine **Tutorial-Reihenfolge** führen: einen Weg durch die
Anwendung, der beim Ankommen beginnt und beim Einrichten endet. Die Reihenfolge
SHALL im Repository stehen und SHALL NOT aus Datum oder Thema abgeleitet werden
— beide beschreiben, wann etwas entstand, und nicht, in welcher Ordnung man es
lernt.

Der Weg SHALL in **Etappen** gegliedert sein. Jede Geschichte SHALL in genau
einer Etappe stehen, und jede Etappe SHALL ihre Kapitel in der Reihenfolge
führen, in der sie gelesen werden sollen.

Jede Kapitelseite SHALL auf das nächste Kapitel des Weges verweisen; das letzte
Kapitel SHALL keinen solchen Verweis tragen. Ein Weg ohne Fortsetzung wäre eine
Sammlung von Seiten und keine Führung.

Eine nicht freigegebene Geschichte SHALL im Weg ausgelassen werden, ohne ihn zu
unterbrechen: der Verweis SHALL dann auf das nächste **freigegebene** Kapitel
zeigen.

#### Scenario: Jede Geschichte steht genau einmal im Weg

- **WHEN** die Tutorial-Reihenfolge geprüft wird
- **THEN** kommt jede Geschichte in genau einer Etappe genau einmal vor

#### Scenario: Ein Kapitel führt zum nächsten

- **WHEN** eine Kapitelseite gezeigt wird und ein weiteres Kapitel folgt
- **THEN** trägt sie einen Verweis auf dessen Seite

#### Scenario: Das letzte Kapitel endet

- **WHEN** das letzte Kapitel des Weges gezeigt wird
- **THEN** trägt es keinen Verweis auf ein nächstes

#### Scenario: Ein Entwurf unterbricht den Weg nicht

- **WHEN** eine Geschichte im Weg nicht freigegeben ist
- **THEN** wird sie übersprungen und der Verweis zeigt auf das nächste
  freigegebene Kapitel

### Requirement: Jede Seite trägt dieselbe Navigation und einen Kopfbereich

Jede erzeugte Seite SHALL eine Navigation tragen, die beide Flächen — Tutorial
und Blog — erreichbar macht, und SHALL die gerade gezeigte Fläche darin
auszeichnen.

Jede Übersichtsseite und jede Etappe SHALL einen Kopfbereich mit einem Bild
tragen. Dieses Bild SHALL aus dem Bildbestand der Anwendung stammen und mit dem
Blog ausgeliefert werden; es SHALL NOT von einer fremden Herkunft geladen
werden.

Der Kopfbereich SHALL sein Bild als Bild-Element führen und NOT als Hintergrund
aus dem Stil. Die Prüfung des Artefakts liest Elemente und Attribute; eine
Adresse, die nur im Stil steht, entzöge sich ihr.

#### Scenario: Die Navigation zeigt, wo man ist

- **WHEN** eine Seite einer Fläche gezeigt wird
- **THEN** ist deren Eintrag in der Navigation ausgezeichnet

#### Scenario: Das Kopfbild ist prüfbar

- **WHEN** eine Seite mit Kopfbereich geprüft wird
- **THEN** steht dessen Bild als Bild-Element mit eigener Herkunft im Markup

