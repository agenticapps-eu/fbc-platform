## ADDED Requirements

### Requirement: Die App für iOS und Android ist derselbe Build wie das Web

Das System SHALL die mobilen Anwendungen aus **demselben** Web-Build erzeugen,
der auch die Web-Fläche ausliefert. Es SHALL NOT eine zweite Anwendung, einen
zweiten Router oder eine zweite Datenschicht führen.

Die nativen Projekte für **beide** Plattformen SHALL im bestehenden Repository
liegen, nicht in einem eigenen. Läge die Hülle getrennt, müsste der Web-Build
als Artefakt veröffentlicht und dort eingesammelt werden — eine Bau-Pipeline
ohne Gewinn. So ist ein Fehler im Feed mit demselben Commit auf Web und Mobil
behoben.

Plattform-abhängiges Verhalten SHALL an **einer** Weiche je Belang hängen und
diese Weiche SHALL an der Laufzeitumgebung entscheiden, nicht an einem eigenen
Umgebungsschalter. Zwei Schalter für dieselbe Frage sind zwei Wahrheiten.

#### Scenario: Eine Änderung wird genau einmal gepflegt

- **WHEN** ein Commit auf `main` das Verhalten einer Fläche ändert
- **THEN** stammt die Änderung für Web und für beide mobilen Anwendungen aus
  **demselben** Quellbaum und demselben Commit
- **AND** es gibt kein zweites Repository und keinen zweiten Satz Komponenten,
  in dem sie nachgezogen werden müsste

**Nicht** zugesagt ist, dass alle drei Flächen zu jedem Zeitpunkt denselben
Stand *ausliefern*: der native Bau läuft absichtlich nur auf Anforderung (siehe
unten), und der Luftweg trägt Web-Änderungen mit eigener Taktung. Ein Szenario,
das Gleichstand behauptet, wäre mit derselben Anforderung nicht erfüllbar.

#### Scenario: Die Anwendung startet auf einem echten Gerät

- **WHEN** die Anwendung auf einem physischen iOS- und einem physischen
  Android-Gerät gestartet wird
- **THEN** sind Anmelden, Feed, Nachrichten, Profil bearbeiten und ein
  Bild-Upload auf beiden je einmal durchführbar
- **AND** ein Neustart der Anwendung führt nicht zur Abmeldung

### Requirement: Native Geheimnisse erreichen das öffentliche Repository nicht

Das Repository ist öffentlich. Der Signierschlüssel für Android
(`*.keystore`/`*.jks`), `key.properties` und Keystore-Passwörter, die
FCM-Konfigurationen (`google-services.json`, `GoogleService-Info.plist`) und
APNs-Schlüssel (`.p8`) SHALL NOT im Repository liegen. Sie SHALL in Infisical
verwaltet werden.

Der Android-Keystore SHALL **zusätzlich außerhalb** von Infisical und Repository
gesichert sein. Er ist unersetzlich: geht er verloren, lässt sich die Anwendung
im Play Store nie wieder aktualisieren.

Die nativen **Projektordner selbst** SHALL im Repository liegen — das macht den
Bau reproduzierbar. Erzeugtes (`ios/App/Pods/`, `android/.gradle/`, `*/build/`,
`DerivedData/`) SHALL NOT.

Die Absicherung SHALL NOT allein aus `.gitignore`-Einträgen bestehen. Ein
Wächter SHALL den **Arbeitsbaum** gegen eine Musterliste prüfen und den Lauf
brechen, wenn eine dieser Dateien vorliegt. `.gitignore` greift nicht für eine
Datei, die jemand namentlich staged, und ein Geheimnis in einem früheren Commit
ist nicht weniger öffentlich, weil der aktuelle Diff es nicht anfasst.

#### Scenario: Ein Keystore im Baum bricht den Lauf

- **WHEN** eine Datei mit der Endung `.keystore` oder `.jks` unter `android/`
  liegt
- **THEN** bricht der Wächter mit einer Meldung ab, die die Datei nennt
- **AND** der Lauf ist rot, unabhängig davon, ob die Datei im Diff steht

#### Scenario: Die Projektordner selbst sind versioniert

- **WHEN** das Repository frisch ausgecheckt wird
- **THEN** liegen `ios/` und `android/` vor
- **AND** weder `ios/App/Pods/` noch `android/.gradle/` noch ein `build/`-Ordner
  ist darin versioniert

### Requirement: Ein nativer Bau läuft nur, wenn er angefordert wird

Der Workflow, der die Web-Fläche ausliefert, SHALL NOT nativ bauen. Der native
Bau SHALL in einem **eigenen** Workflow liegen, der von Hand oder über ein Tag
ausgelöst wird, und SHALL NOT bei jedem Push oder Pull Request laufen.

Sonst wird aus jeder Textänderung ein Xcode-Lauf auf einem macOS-Runner, samt
Signaturzertifikat, für einen Bau, den niemand angefordert hat.

#### Scenario: Ein Pull Request löst keinen nativen Bau aus

- **WHEN** ein Pull Request geöffnet wird, der nur Web-Dateien ändert
- **THEN** läuft der Web-Deploy wie bisher
- **AND** kein nativer Bau startet

### Requirement: Der Erststart lädt nur, was der erste Bildschirm braucht

Die Anwendung startet auf Mobilfunk. Das Eintrittsbündel SHALL deshalb **keine
Seitenkomponente** enthalten außer denen, die der erste Bildschirm braucht: die
Anwendungshülle, die Zugangswachen, die Startseite und die Anmeldeseite. Jede
weitere Seite SHALL erst beim Betreten ihrer Route geladen werden.

Das Eintrittsbündel SHALL **1.024 kB** (roh, unkomprimiert) nicht überschreiten.
Gemessen wurde am 27.08. auf `0dd4b8b`: **1.181,77 kB** roh, 347,78 kB gzip.

Die Zusage SHALL **strukturell** geprüft werden und nicht allein an der Zahl. Eine
Zahl driftet mit dem nächsten Feature; die Struktur — welche Seite in welchem
Chunk liegt — hält.

Ein Aufteilen in Vendor-Chunks SHALL NOT als Erfüllung gelten. Es verschiebt
Bytes zwischen Dateien, die der Erststart beide lädt, und entfernt keine.

#### Scenario: Keine Admin-Seite liegt im Eintrittsbündel

- **WHEN** der Produktionsbau erzeugt wird
- **THEN** liegt keine der Admin-Seiten im Eintrittsbündel
- **AND** die aus dem Archiv erzeugte Änderungsliste, die nur die
  Neuigkeiten-Verwaltung liest, liegt ebenfalls nicht darin

#### Scenario: Das Eintrittsbündel ist gemessen kleiner als vorher

- **WHEN** die Größe des Eintrittsbündels nach dem Umbau gemessen wird
- **THEN** liegt sie unter 1.024 kB roh
- **AND** die Messung vorher und nachher ist mit demselben Befehl entstanden

### Requirement: Die Zurück-Taste auf Android navigiert, statt zu schließen

Die Systemzurück-Taste SHALL in dieser Reihenfolge wirken:

1. Ist ein Overlay offen, SHALL sie das Overlay schließen.
2. Sonst, gibt es Verlauf, SHALL sie eine Seite zurückgehen.
3. Sonst SHALL sie die Anwendung in den Hintergrund schicken.

Sie SHALL NOT die Anwendung mitten in einem Ablauf schließen.

Punkt 1 SHALL nicht übergangen werden: Mehrere Flächen führen ihren
Offen-Zustand über den Verlaufsschlüssel und reagieren damit bereits auf
Navigation. Ein Handler, der bei offenem Overlay unbedingt zurücknavigiert,
ließe Overlay-Zustand und Verlauf auseinanderlaufen.

#### Scenario: Zurück schließt zuerst das Overlay

- **WHEN** auf Android ein modales Overlay offen ist und die Zurück-Taste
  gedrückt wird
- **THEN** schließt das Overlay
- **AND** die darunterliegende Seite bleibt dieselbe

#### Scenario: Zurück auf der Startseite schließt nicht ab

- **WHEN** auf Android die Startseite ohne weiteren Verlauf angezeigt wird und
  die Zurück-Taste gedrückt wird
- **THEN** geht die Anwendung in den Hintergrund, statt beendet zu werden

### Requirement: Ein Bild kommt über einen Aufrufpunkt, der die Plattform kennt

Die Auswahl eines Bildes — Profilbild, Titelbild, Beitragsbild — SHALL über
**einen** gemeinsamen Aufrufpunkt laufen, der eine Datei zurückgibt. Nativ SHALL
er den Systemablauf für Kamera und Galerie anbieten, im Web SHALL er das
bestehende Dateifeld verwenden.

Die aufrufenden Flächen SHALL NOT wissen, auf welcher Plattform sie laufen. Was
nach der Auswahl geschieht — Zuschnitt, Upload, Seitenverhältnis — SHALL
unverändert bleiben.

#### Scenario: Dieselbe Fläche, zwei Plattformen

- **WHEN** ein Mitglied auf iOS oder Android ein Profilbild wählt
- **THEN** öffnet sich der native Ablauf mit der Wahl zwischen Kamera und
  Galerie
- **AND** dieselbe Fläche im Browser öffnet weiterhin den Dateidialog
- **AND** das hochgeladene Bild durchläuft in beiden Fällen denselben Zuschnitt

### Requirement: Web-Änderungen erreichen Geräte ohne Store-Einreichung

Das System SHALL die Web-Schicht der mobilen Anwendungen über den Luftweg
aktualisieren können. Der Aktualisierungsdienst SHALL **selbst gehostet** sein.

Ein ausgeliefertes Bündel SHALL **signiert** und seine Prüfsumme SHALL gegen
einen im Client hinterlegten öffentlichen Schlüssel geprüft werden. Ein Bündel
ohne gültige Prüfsumme SHALL NOT installiert werden. Ohne diese Prüfung wäre der
Aktualisierungs-Endpunkt ein Weg, beliebigen Code auf jedes Gerät zu bringen,
der Store-Prüfung entzogen.

Der private Signaturschlüssel SHALL in Infisical liegen und SHALL NOT im
Repository.

Jedes Bündel SHALL die **Vertragsnummer der nativen Schale** tragen, die es
voraussetzt, und der Dienst SHALL ein Bündel nur an Schalen ausliefern, die sie
erfüllen. Der Luftweg tauscht Web-Assets, nicht die Schale: ein Bündel, das eine
neue native Fähigkeit aufruft, schlüge auf einer älteren Schale erst beim Aufruf
fehl, nicht beim Start.

Eine Änderung an der nativen Schale SHALL die Vertragsnummer heben und SHALL
über den Store gehen.

Ein installiertes Bündel, das **beim Start scheitert**, SHALL auf die zuvor
laufende Fassung zurückfallen. Die Anwendung SHALL dem Aktualisierungsdienst
ihren erfolgreichen Start ausdrücklich bestätigen; bleibt die Bestätigung aus,
SHALL die vorige Fassung wieder in Betrieb gehen.

Ohne diesen Rückweg brächte ein Bündel, das **gültig signiert** ist und
trotzdem nicht startet, jedes Gerät dauerhaft zum Stillstand — bis eine neue
Schale durch den Store geht. Die Prüfsumme schützt gegen ein *fremdes* Bündel,
nicht gegen ein *eigenes, kaputtes*.

#### Scenario: Eine Web-Änderung erreicht das Gerät ohne Store

- **WHEN** eine Änderung ausgeliefert wird, die nur Web-Assets betrifft
- **THEN** erhält ein Gerät sie über den Luftweg
- **AND** es war keine Store-Einreichung nötig

#### Scenario: Ein Bündel ohne gültige Prüfsumme wird abgewiesen

- **WHEN** der Aktualisierungsdienst ein Bündel ohne Prüfsumme oder mit einer
  Prüfsumme anbietet, die nicht zum öffentlichen Schlüssel passt
- **THEN** installiert der Client es nicht
- **AND** die zuvor installierte Fassung bleibt in Betrieb

#### Scenario: Ein signiertes, aber defektes Bündel rollt zurück

- **WHEN** ein gültig signiertes Bündel installiert wird und die Anwendung damit
  nicht bis zur Startbestätigung kommt
- **THEN** läuft beim nächsten Start wieder die zuvor installierte Fassung
- **AND** das Gerät braucht dafür keine Store-Einreichung

#### Scenario: Ein Bündel für eine neuere Schale erreicht eine ältere nicht

- **WHEN** ein Bündel eine höhere Vertragsnummer der Schale voraussetzt, als das
  Gerät installiert hat
- **THEN** erhält dieses Gerät das Bündel nicht
- **AND** es bleibt auf der Fassung, die zu seiner Schale passt

### Requirement: Die installierte App trägt die Marke, nicht die des Frameworks

Das Symbol der installierten App SHALL die Marke zeigen und SHALL NOT das
Standardsymbol des Frameworks sein. Das gilt für **beide** Plattformen.

Ein Standardsymbol auf dem Startbildschirm ist kein kosmetischer Rest: es ist
die einzige Fläche, die ein Mitglied sieht, bevor es die App überhaupt öffnet.
Es sagt dort, die Anwendung sei ein Gerüst, kein Produkt.

Das Symbol SHALL aus **einer** Quelle im Repository erzeugt werden, aus der
alle Größen beider Plattformen hervorgehen. Zwei von Hand gepflegte Vorlagen
SHALL NOT nebeneinanderstehen — sie laufen auseinander, und der Unterschied
fällt erst auf einem Gerät auf.

Die Quelle SHALL dieselbe Form zeigen wie die Marke der Web-Fläche.

Der Beleg SHALL am **gebauten** Artefakt geführt werden, nicht an der Vorlage im
Arbeitsbaum: nur dort steht, was auf dem Gerät landet.

#### Scenario: Das gebaute iOS-Bündel trägt die Marke

- **WHEN** das signierte iOS-Bündel gebaut ist
- **THEN** enthält es ein Symbol in der Markenfarbe und nicht das des Frameworks

#### Scenario: Das gebaute Android-Paket trägt die Marke

- **WHEN** das Android-Paket gebaut ist
- **THEN** enthält es dasselbe Symbol, in allen Auflösungen des Startbildschirms

#### Scenario: Eine Änderung an der Quelle erreicht beide Plattformen

- **WHEN** die eine Quelle geändert und die Erzeugung erneut gefahren wird
- **THEN** ändern sich die Symbole beider Plattformen, ohne dass eine Datei von
  Hand nachgezogen wird

### Requirement: Die Startfläche trägt die Marke, nicht die leere Fläche des Frameworks

Die Fläche, die zwischen dem Antippen des Symbols und dem ersten Bild der
Anwendung steht, SHALL die Marke zeigen. Sie SHALL NOT die weiße Fläche sein,
die `npx cap add` hinterlässt.

**Es sind zwei Flächen, nicht eine.** Zuerst zeigt das Betriebssystem den
nativen Startbildschirm, danach steht der WebView, bis die Anwendung das erste
Mal zeichnet. Wann die erste der zweiten weicht, entscheidet das System und
nicht diese Anwendung — es ist ohne ein eigenes Plugin **nicht** steuerbar.
Die Zusage lautet deshalb nicht, dass der Übergang gesteuert wird, sondern dass
er nichts zu sehen gibt: beide Flächen SHALL denselben Grundton tragen, sodass
zwischen ihnen keine andersfarbige Fläche erscheint.

Die Boot-Fläche des WebViews SHALL **vor dem ersten Zeichnen** entscheiden, ob
sie erscheint. Eine Entscheidung, die erst im Anwendungscode fällt, kommt zu
spät: der Inhalt des Wurzelelements steht im ausgelieferten Dokument und wird
gezeichnet, bevor irgendein Modul geladen ist. Die Web-Fläche SHALL sich dabei
nicht ändern.

Die Startfläche SHALL aus den Quellen dieses Repositories erzeugt werden — der
Marke, dem Bild und den Schriften, die auch die Web-Fläche trägt. Eine von Hand
gepflegte zweite Fassung SHALL NOT danebenstehen.

**Die Erzeugung SHALL fail-closed sein, und zwar für alle drei Quellen.** Fehlt
eine, oder wird sie nicht so gebunden wie verlangt, SHALL der Lauf abbrechen und
nichts schreiben. Der Grund ist ein gemessener: das Rasterwerkzeug ersetzt eine
unbekannte Schrift **stillschweigend** durch eine ähnliche — eine Serifenschrift
kam als Grotesk heraus, ohne Fehlermeldung — und lädt Bilder über eine
Fremdbibliothek, die bei fehlendem Format ebenso still ausfällt. Beide Male
entstünde eine plausibel aussehende Datei, der niemand ansieht, dass sie falsch
ist.

Der Nachweis, dass die Schriften des Repositories gebunden sind, SHALL
**positiv** geführt werden: die verlangte Familie SHALL nachweislich auf die
Schriftdatei dieses Repositories auflösen. Der Nachweis, dass Systemschriften
nicht durchgreifen, ist die Gegenprobe dazu und SHALL NOT an seiner Stelle
stehen — eine gelungene stille Ersetzung als Kontrolle zu führen widerspricht
der Zusage, die diese Anforderung gibt.

Die Komposition SHALL **im Verhältnis** zur Bildschirmfläche verankert sein,
nicht in festen Punkten, und SHALL in **beiden Orientierungen** und auf **beiden
Gerätefamilien** halten — die Anwendung erlaubt Hoch- und Querformat und ist als
universelles Bündel gebaut. Bild, Verlauf und Schriftzug SHALL NOT gegeneinander
verrutschen können.

Der Verlauf, der das Bild ausblendet, SHALL in derselben Farbe enden, auf der
der Schriftzug steht, und SHALL diese Farbe an der Unterkante seiner Fläche
erreichen — **in jeder Orientierung**. Ein in das Bild eingebackener Verlauf
erfüllt das nicht: wird das Bild formatfüllend beschnitten, wird der Verlauf
mitbeschnitten und seine Unterkante ist nicht mehr die Grundfarbe.

Der Grundton SHALL ausdrücklich gesetzt sein und SHALL NOT von der Darstellung
des Systems abhängen. Diese Anwendung hat kein dunkles Inhaltsthema; eine
Fläche, die dem Systemthema folgt, wäre im Dunkelmodus schwarz und stünde damit
unter dunkler Schrift.

**Diese Anforderung weicht bewusst von Apples Empfehlung ab**, den
Startbildschirm textfrei zu halten. Der Grund für jene Empfehlung ist die
Lokalisierbarkeit; diese Anwendung ist einsprachig deutsch. Wird sie es einmal
nicht mehr, ist der eingebackene Claim die Stelle, die nachzieht — das steht
hier, damit es dann gefunden wird.

Der Beleg SHALL **auf dem Gerät** und **nach einer frischen Installation**
geführt werden. iOS hält den Startbildschirm in einem Zwischenspeicher: eine
geänderte Fläche erscheint nach einem gewöhnlichen Neustart unter Umständen
nicht, und ein Beleg ohne vorheriges Löschen der App belegt den alten Zustand.

Der Beleg am erzeugten Bild SHALL **regionsweise** geführt werden, nicht über
einen Mittelwert. Die Komposition endet absichtlich in derselben Farbe, mit der
sie vorher vollflächig gefüllt war; ein Mittelwert kann beide Zustände deshalb
nicht sicher unterscheiden.

#### Scenario: Der Kaltstart zeigt die Marke

- **WHEN** die frisch installierte App auf einem Gerät kalt gestartet wird
- **THEN** zeigt die Fläche vor dem ersten Bild der Anwendung Marke, Wortmarke
  und Claim
- **AND** sie ist nicht die leere Fläche des Frameworks

#### Scenario: Zwischen den beiden Flächen erscheint keine fremde Farbe

- **WHEN** der native Startbildschirm dem WebView weicht
- **THEN** ist dabei keine andersfarbige Fläche zu sehen

#### Scenario: Die Web-Fläche zeigt die Boot-Fläche nicht

- **WHEN** dieselbe Auslieferung im Browser geöffnet wird
- **THEN** erscheint die Boot-Fläche der App dort zu keinem Zeitpunkt

#### Scenario: Das Bild hat in beiden Orientierungen keine sichtbare Kante

- **WHEN** die Startfläche im Hoch- oder im Querformat gezeichnet wird
- **THEN** geht das Bild ohne erkennbare Grenze in die Fläche über, auf der der
  Schriftzug steht
- **AND** der Schriftzug steht innerhalb der Fläche und wird nicht abgeschnitten

#### Scenario: Eine nicht gebundene Repo-Schrift bricht die Erzeugung ab

- **WHEN** die Erzeugung feststellt, dass die verlangte Schriftfamilie nicht auf
  die Schriftdatei dieses Repositories auflöst
- **THEN** bricht sie ab und schreibt nichts

#### Scenario: Eine fehlende Quelle bricht die Erzeugung ab

- **WHEN** Marke, Bild oder Schrift nicht gelesen werden können
- **THEN** bricht die Erzeugung ab und schreibt nichts
- **AND** es entsteht keine Fläche, in der die fehlende Quelle durch etwas
  anderes ersetzt wurde

#### Scenario: Eine Änderung an der Quelle erreicht die Startfläche

- **WHEN** Marke, Bild oder Claim im Repository geändert werden und die
  Erzeugung erneut läuft
- **THEN** trägt die erzeugte Startfläche die Änderung, ohne dass eine Datei von
  Hand nachgezogen wird
