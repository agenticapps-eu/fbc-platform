## ADDED Requirements

### Requirement: Ein Recht gilt erst, wenn alle drei Wege es tragen

Zu jeder Ressource führen **drei** Wege, und ein Recht SHALL erst dann als
durchgesetzt geführt werden, wenn jeder davon es trägt:

1. **Die Oberfläche** — Navigationseinträge, Routen-Gates, Aktionsknöpfe.
2. **Die vorgesehene Funktion** — die RPC, über die die Oberfläche geht.
3. **Der Rohzugriff** — die Tabelle oder Sicht, auf der die Funktion aufsetzt,
   abgefragt ohne Filter.

Der dritte Weg SHALL ausdrücklich geprüft werden und SHALL NOT aus den ersten
beiden geschlossen werden. Eine Oberfläche ist Komfort; eine RPC mit Gate ist
eine Tür; ein Leserecht auf der Relation daneben ist eine zweite Tür ohne
Schloss.

**Der Anlass ist gemessen, nicht ausgedacht.** Mit V5F-1 wurde „Mitglieder
gezielt suchen" ein IMPACT-Recht. Oberfläche und `search_directory` trugen es
vom ersten Tag an. `public.profiles` und `public.profiles_public` trugen es
nicht: beide waren für jedes angemeldete Konto als **Menge** lesbar, die Sicht
sogar ohne jede Rangprüfung. Das Recht war also vollständig gebaut, geprüft und
ausgerollt — und am dritten Weg wirkungslos.

**Was daraus für die Formulierung von Zusagen folgt:** solange ein Weg offen
ist, SHALL die Zusage den Weg nennen, den sie meint („die Suche ist gebunden"),
und SHALL NOT die Ressource nennen („die Liste ist nicht beschaffbar"). Der
Unterschied ist nicht sprachlich. Er entscheidet, ob eine Abnahme den offenen
Weg sucht oder ihn für geschlossen hält.

**Und er gilt in beide Richtungen.** Nach dem Verschluss SHALL die Zusage
ebenso genau bleiben: „die Mitgliederliste ist nicht als Menge abholbar" ist
belegbar; „es gibt keinen Weg zu fremden Profildaten" wäre überdehnt, solange
Kennungen aus erreichbaren Flächen stammen und stapelweise eingelöst werden
können.

**Eine Obergrenze auf einer Stapelabfrage SHALL NOT als Zugriffsschutz geführt
werden.** Sie begrenzt die Grösse einer Abfrage, nicht die Menge der
erreichbaren Daten — wer 200 Kennungen auf einmal einlösen darf, darf auch
fünfzig Mal 200. Als Betriebsmittel gegen teure Abfragen SHALL sie zulässig
bleiben, benannt als das, was sie ist.

#### Scenario: Ein neues Recht wird an allen drei Wegen geprüft

- **WHEN** ein Recht nach dem Stufenmodell eingeführt oder verschoben wird
- **THEN** liegt für jeden der drei Wege ein eigener Beleg vor, und der Beleg
  für den Rohzugriff ist eine Abfrage **ohne Filter** auf die Relation

#### Scenario: Ein offener Weg wird benannt, nicht weggerundet

- **WHEN** einer der drei Wege das Recht noch nicht trägt
- **THEN** nennt die Anforderung den gebundenen Weg und nicht die Ressource,
  und der offene Weg steht als eigener Vorgang fest

#### Scenario: Eine Stapelgrenze ist kein Schutz

- **WHEN** eine Funktion Kennungen stapelweise entgegennimmt und ihre Zahl
  begrenzt
- **THEN** gilt die Grenze als Betriebsmittel, und die Zusage über den Zugriff
  stützt sich auf die Herkunft der Kennungen, nicht auf die Grenze
