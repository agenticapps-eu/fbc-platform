## ADDED Requirements

### Requirement: Eine offene eingehende Anfrage ist ohne Vorwissen erreichbar

Das System SHALL einem Mitglied mit **mindestens einer offenen eingehenden**
Kontaktanfrage einen Weg dorthin anbieten, der **kein Vorwissen** über die
Anfrage voraussetzt — insbesondere ohne dass es die Profilseite des Absenders
aufrufen muss.

Der Weg SHALL die **Anzahl** der offenen Anfragen nennen, damit er als Aufforderung
erkennbar ist und nicht als weiterer Menüpunkt untergeht.

Der Hinweis auf der Profilseite des Absenders SHALL als zusätzlicher Weg bestehen
bleiben. Er ist nützlich, wenn man ohnehin dort steht — er ist nur kein
Einstiegspunkt, weil er ihn schon voraussetzt.

Ohne offene eingehende Anfragen SHALL **keine Zahl** erscheinen. Eine Null ist
keine Aufforderung, und ein Zähler, der dauernd Null zeigt, wird nicht mehr
gelesen.

#### Scenario: Eine offene Anfrage schafft einen Weg

- **WHEN** einem Mitglied eine offene eingehende Kontaktanfrage vorliegt
- **THEN** erreicht es „Meine Anfragen" über die Navigation, ohne zuvor ein
  fremdes Profil aufgerufen zu haben

#### Scenario: Der Weg nennt die Anzahl

- **WHEN** zwei offene eingehende Anfragen vorliegen
- **THEN** trägt der Weg die Zahl 2

#### Scenario: Ohne offene Anfragen erscheint keine Zahl

- **WHEN** keine offene eingehende Anfrage vorliegt
- **THEN** erscheint an dem Weg **keine** Zahl, auch keine Null

#### Scenario: Der Chat ist kein Ersatz

- **WHEN** eine eingehende Anfrage noch offen ist
- **THEN** besteht für sie kein Chat, und der Weg zu „Meine Anfragen" ist
  unabhängig davon erreichbar

### Requirement: Ein gescheiterter Abruf der Anfragen ist nicht Stille

Die Fläche „Meine Anfragen" SHALL einen **fehlgeschlagenen** Abruf sichtbar
melden. Sie SHALL NOT im Fehlerfall dasselbe zeigen wie bei einem leeren
Posteingang.

Ein leerer Posteingang SHALL weiterhin **still** bleiben — ein Leerzustand, der
bei jedem Aufruf erscheint, ist Lärm. Der Unterschied ist der Punkt: „nichts da"
weiß die Fläche, „Abruf gescheitert" weiß sie gerade nicht.

#### Scenario: Der Abruf scheitert

- **WHEN** die Abfrage der eingehenden Anfragen mit einem Fehler endet
- **THEN** erscheint ein sichtbarer Hinweis, dass die Anfragen nicht geladen
  werden konnten

#### Scenario: Leer bleibt still

- **WHEN** die Abfrage erfolgreich ist und keine offene Anfrage liefert
- **THEN** erscheint **keine** Karte und **kein** Leerzustand
