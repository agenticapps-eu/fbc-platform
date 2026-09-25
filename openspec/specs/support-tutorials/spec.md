# support-tutorials Specification

## Purpose

Der **Supportbereich in der Anwendung** — der nachgeordnete Ort, an dem Hilfe
liegt: ein Abschnitt am Fuss der Seitenleiste und die Tutorial-Fläche, auf die
er führt.

Zwei Entscheidungen tragen ihn:

- **Hilfe ist nachgeordnet, nicht ein achter Menüpunkt** (V5, Bauplan §4). Die
  Hauptnavigation bleibt bei ihren sieben Einträgen; der Weg zum Tutorial ist
  der Support-Abschnitt, nicht das Menü.
- **Hilfe ist keine Frage der Mitgliedsstufe.** Kein `minTier` — gerade das
  Konto auf der untersten Stufe hat den grössten Bedarf zu erfahren, was die
  Anwendung kann.

Die **Texte** gehören nicht hierher: sie werden im Repository verfasst und
stehen in `release-blog`. Diese Capability sagt, wie sie in der Anwendung
erreichbar sind und woher ihre Bilder kommen — und das ist keine Doppelung,
sondern die Trennung, die den Tag überlebt, an dem der öffentliche Blog
abgeschaltet wird.

Abgegrenzt: das Feedback-Formular selbst ist `feedback-qm`; hier steht nur, dass
der Abschnitt es trägt, ohne es zu verändern.

## Requirements
### Requirement: Der Support-Abschnitt steht am Fuss der Seitenleiste und führt genau zwei Einträge

Die Anwendung SHALL am Fuss der Seitenleiste, über dem Einklapp-Schalter, einen
Abschnitt **„Support"** führen. Er SHALL genau zwei Einträge tragen:
**Tutorials** und **Feedback**.

Der Abschnitt SHALL NOT die Hauptnavigation verändern: die sieben Menüeinträge
und ihre Reihenfolge bleiben unberührt. Er ist der nachgeordnete Ort, an dem
Hilfe liegt — nicht ein achter Menüpunkt.

Er SHALL NOT auf Mitgliedschaft, Stufenwechsel oder einen Kaufweg verweisen.
Support ist Hilfe, kein Verkaufsweg, und `/mitgliedschaft` ist ausserdem
unerreichbar (AGE-907).

Beide Einträge SHALL in allen drei Zuständen der Leiste erreichbar sein: offen,
eingeklappt und als mobile Schublade. In der eingeklappten Leiste SHALL jeder
Eintrag einen zugänglichen Namen behalten, auch wo seine Beschriftung verborgen
ist — ein Symbol ohne Namen ist für Vorlesesoftware ein leerer Knopf.

#### Scenario: Die offene Leiste zeigt beide Einträge unter einer Überschrift

- **WHEN** die Seitenleiste offen dargestellt wird
- **THEN** steht am Fuss ein Abschnitt „Support"
- **AND** er führt „Tutorials" und „Feedback", und sonst nichts

#### Scenario: Eingeklappt bleiben beide Einträge benennbar

- **WHEN** die Seitenleiste eingeklappt dargestellt wird
- **THEN** sind beide Einträge weiterhin bedienbar
- **AND** jeder trägt einen zugänglichen Namen („Tutorials", „Feedback")

#### Scenario: In der mobilen Schublade stehen beide Einträge

- **WHEN** die Navigationsschublade unterhalb des `lg`-Breakpoints geöffnet ist
- **THEN** sind „Tutorials" und „Feedback" aus ihr heraus erreichbar

#### Scenario: Der Weg ins Tutorial schliesst die Schublade

- **WHEN** „Tutorials" aus der geöffneten Schublade heraus gewählt wird
- **THEN** führt die Anwendung auf die Tutorial-Fläche
- **AND** die Schublade ist danach geschlossen

#### Scenario: Die Hauptnavigation bleibt, wie sie war

- **WHEN** die Navigation dargestellt wird
- **THEN** führt sie unverändert sieben sichtbare Menüeinträge
- **AND** weder „Tutorials" noch „Feedback" erscheint unter ihnen

### Requirement: Die Tutorial-Fläche ist erreichbar, ohne eine Mitgliedsstufe zu verlangen

Die Tutorial-Fläche SHALL eine eigene Route **innerhalb** der Anwendung haben
und ein angemeldetes Konto voraussetzen.

Sie SHALL NOT an eine Mitgliedsstufe gebunden sein. Was die Anwendung kann, ist
keine Frage der Stufe — und gerade das Konto auf der untersten Stufe hat den
grössten Bedarf, es zu erfahren.

Sie SHALL NOT als Menüeintrag erscheinen; der Weg dorthin ist der
Support-Abschnitt.

#### Scenario: Ein Konto auf der untersten Stufe sieht das Tutorial vollständig

- **WHEN** ein angemeldetes Konto der Stufe `basic` die Tutorial-Fläche öffnet
- **THEN** zeigt sie alle freigegebenen Etappen
- **AND** es erscheint keine Wand „Mitglied werden"

#### Scenario: Die Route trägt keinen Menüeintrag

- **WHEN** die Routen der Anwendung aufgezählt werden
- **THEN** ist die Tutorial-Route enthalten
- **AND** sie ist als geroutet-ohne-Menüeintrag geführt

### Requirement: Das Tutorial steht auf einer Seite, in der Reihenfolge des Weges

Die Tutorial-Fläche SHALL **eine** Seite sein: oben Sprungmarken über die
Etappen, darunter Etappe für Etappe die Kapitel mit Bild und vollem Text.

Die Reihenfolge SHALL die der gepflegten Datei sein — die Leseordnung, nicht die
Entstehungsordnung. Sie SHALL NOT aus Datum oder Titel abgeleitet werden.

Die Fläche SHALL nur **freigegebene** Geschichten zeigen. Eine Etappe, deren
Kapitel sämtlich noch Entwürfe sind, SHALL gar nicht erst erscheinen — sonst
stünde eine Überschrift über einer leeren Strecke und verriete, dass es dort
etwas gibt.

Jede Sprungmarke SHALL zu ihrer Etappe führen.

#### Scenario: Die Etappen stehen in der Reihenfolge der Datei

- **WHEN** die Tutorial-Fläche dargestellt wird
- **THEN** stehen die Etappen in der Reihenfolge, in der sie gepflegt sind
- **AND** die erste ist „Ankommen"

#### Scenario: Ein Entwurf erscheint nicht

- **WHEN** eine Geschichte im Repository liegt, aber nicht freigegeben ist
- **THEN** erscheint sie weder als Kapitel noch als Sprungmarke

#### Scenario: Eine Etappe ohne freigegebenes Kapitel bleibt unsichtbar

- **WHEN** alle Kapitel einer Etappe Entwürfe sind
- **THEN** erscheinen weder ihre Überschrift noch ihre Sprungmarke

#### Scenario: Eine Sprungmarke führt zu ihrer Etappe

- **WHEN** eine Sprungmarke gewählt wird
- **THEN** steht die zugehörige Etappe im Bild

### Requirement: Tutorial und öffentlicher Blog lesen dieselbe Quelle

Die Tutorial-Fläche SHALL ihre Etappen und Texte aus denselben gepflegten
Dateien lesen, aus denen der öffentliche Blog gebaut wird.

Sie SHALL NOT eine Kopie dieser Texte führen und SHALL NOT sie aus der Datenbank
beziehen. Eine zweite Pflegestelle wäre die Stelle, an der beide Flächen
auseinanderlaufen, ohne dass es jemandem auffällt.

#### Scenario: Eine Textänderung erreicht beide Flächen

- **WHEN** der Text einer freigegebenen Geschichte in der gepflegten Datei
  geändert wird
- **THEN** zeigt die Tutorial-Fläche die Änderung
- **AND** es gibt keine zweite Datei, in der derselbe Text gepflegt werden müsste

### Requirement: Die Bilder des Tutorials kommen aus der Anwendung

Die Bilder der Kapitel SHALL mit der **Anwendung** ausgeliefert werden und im
Repository liegen.

Sie SHALL NOT von einer fremden Herkunft geladen werden — insbesondere NOT von
der öffentlichen Blog-Adresse. Diese Adresse wird abgeschaltet (AGE-906); ein
Verweis dorthin wäre ein Tutorial, das an dem Tag seine Bilder verliert.

Jedes Bild SHALL Breite und Höhe im Markup führen, damit die Seite den Text
nicht nachschiebt, während jemand ihn liest.

Die Fläche zeigt viele Bilder untereinander. Bilder unterhalb des ersten
Bildschirms SHALL erst geladen werden, wenn sie gebraucht werden.

#### Scenario: Kein Bild zeigt nach aussen

- **WHEN** die Tutorial-Fläche dargestellt wird
- **THEN** trägt kein Bild eine Adresse ausserhalb der Anwendung

#### Scenario: Ein Bild ohne Datei fällt vor dem Ausliefern auf

- **WHEN** eine Geschichte auf eine Bilddatei zeigt, die es nicht gibt
- **THEN** schlägt die Prüfung fehl und benennt die betroffene Geschichte

#### Scenario: Jedes Bild trägt Breite und Höhe

- **WHEN** die Tutorial-Fläche ein Bild zeigt
- **THEN** stehen dessen Breite und Höhe im Markup

### Requirement: Der Umbau lässt das Feedback-Formular unangetastet bedienbar

Das Feedback-Formular SHALL aus dem Support-Abschnitt heraus dasselbe tun wie
bisher — am Schreibtisch wie aus der Schublade.

Solange es **aus der Schublade heraus** offen steht, SHALL genau ein Knoten
`aria-modal="true"` tragen (AGE-688): das Formular hängt portalisiert ausserhalb
der Schublade, und trügen beide das Attribut, hielte Vorlesesoftware genau das
Formular für unerreichbar.

Escape SHALL das **oberste** Overlay treffen (AGE-697): steht das Formular über
der Schublade, schliesst der erste Druck das Formular, und die Schublade steht
danach noch.

#### Scenario: Aus der Schublade heraus trägt nur das Formular `aria-modal`

- **WHEN** das Feedback-Formular aus der geöffneten Schublade heraus geöffnet
  wird
- **THEN** trägt das Formular `aria-modal="true"`
- **AND** die Schublade trägt es in diesem Moment nicht

#### Scenario: Escape schliesst erst das Formular, dann die Schublade

- **WHEN** bei geöffneter Schublade und geöffnetem Formular Escape gedrückt wird
- **THEN** ist das Formular geschlossen und die Schublade steht noch
- **AND** ein zweites Escape schliesst die Schublade

