## ADDED Requirements

### Requirement: Eine offene eingehende Anfrage ist ohne Vorwissen erreichbar

Das System SHALL einem Mitglied mit **mindestens einer offenen eingehenden**
Kontaktanfrage einen Weg dorthin anbieten, der **kein Vorwissen** über die
Anfrage voraussetzt — insbesondere ohne dass es die Profilseite des Absenders
aufrufen muss.

Der Weg SHALL in der **Navigation** stehen und die **Anzahl** der offenen
Anfragen nennen, damit er als Aufforderung erkennbar ist und nicht als weiterer
Menüpunkt untergeht. Die Anzahl SHALL zugänglich benannt sein — eine nackte
Ziffer neben einem Wort ist keine Aussage darüber, **was** gezählt wurde.

Der Weg SHALL NOT erscheinen, solange **keine** offene eingehende Anfrage
vorliegt. Er ist kein dauerhafter Menüpunkt, sondern die Anzeige eines offenen
Vorgangs; ohne Vorgang gibt es nichts anzuzeigen. Damit bleibt die Entscheidung
aus AGE-494 in Kraft — sie nahm den ständigen Kontakte-Eintrag heraus, weil
bestehende Kontakte über Profil und Chat erreichbar sind, und traf den Fall
einer **noch offenen** Anfrage nicht, für den beides nicht trägt.

Der Hinweis auf der Profilseite des Absenders SHALL als zusätzlicher Weg bestehen
bleiben. Er ist nützlich, wenn man ohnehin dort steht — er ist nur kein
Einstiegspunkt, weil er ihn schon voraussetzt.

#### Scenario: Eine offene Anfrage schafft einen Weg

- **WHEN** einem Mitglied eine offene eingehende Kontaktanfrage vorliegt
- **THEN** erreicht es die Anfragen über die Navigation, ohne zuvor ein fremdes
  Profil aufgerufen zu haben

#### Scenario: Der Weg nennt die Anzahl, und zwar benannt

- **WHEN** zwei offene eingehende Anfragen vorliegen
- **THEN** trägt der Weg die Zahl 2, und sein zugänglicher Name sagt, dass es
  sich um offene Anfragen handelt

#### Scenario: Ohne offene Anfragen gibt es den Weg nicht

- **WHEN** keine offene eingehende Anfrage vorliegt
- **THEN** erscheint der Navigationseintrag NICHT, und insbesondere keine Null

#### Scenario: Der Chat ist kein Ersatz

- **WHEN** eine eingehende Anfrage noch offen ist
- **THEN** besteht für sie kein Chat, und der Weg zu den Anfragen ist unabhängig
  davon erreichbar

#### Scenario: Ausgeloggt wird nicht gefragt

- **WHEN** niemand angemeldet ist
- **THEN** wird die Abfrage der eingehenden Anfragen **gar nicht** abgesetzt, und
  der Eintrag erscheint nicht

### Requirement: Ein unbekannter Stand der Anfragen sieht nicht aus wie „keine"

Weiß das System die Anzahl der offenen eingehenden Anfragen **nicht**, weil ihr
Abruf fehlschlug, SHALL es das anzeigen — und SHALL NOT denselben Eindruck
erzeugen wie „es liegt nichts an".

Der Navigationseintrag SHALL in diesem Fall **erscheinen** und statt einer Zahl
kenntlich machen, dass der Stand unbekannt ist. Sein zugänglicher Name SHALL
sagen, dass die Anfragen nicht geladen werden konnten.

Der Grund ist die Bauart dieses Wegs: Er ist das **einzige** Signal für einen
offenen Vorgang, und er wird aus einer Abfrage gespeist, die scheitern kann.
Verschwände er beim Scheitern, wäre er genau der stille Fehlschlag, gegen den er
gebaut wurde — nur an der Stelle, auf die sich alles andere verlässt.

#### Scenario: Der Abruf für den Navigationseintrag scheitert

- **WHEN** die Abfrage der offenen eingehenden Anfragen mit einem Fehler endet
- **THEN** erscheint der Navigationseintrag, ohne Zahl, und sein zugänglicher
  Name sagt, dass die Anfragen nicht geladen werden konnten

### Requirement: Ein gescheiterter Abruf der Anfragen ist nicht Stille

Die Fläche „Meine Anfragen" SHALL einen **fehlgeschlagenen** Abruf sichtbar
melden. Sie SHALL NOT im Fehlerfall dasselbe zeigen wie bei einem leeren
Posteingang.

Ein leerer Posteingang SHALL weiterhin **still** bleiben — ein Leerzustand, der
bei jedem Aufruf erscheint, ist Lärm. Der Unterschied ist der Punkt: „nichts da"
weiß die Fläche, „Abruf gescheitert" weiß sie gerade nicht.

Scheitert ein **Nachladen**, während bereits Anfragen vorliegen, SHALL die Fläche
die vorliegenden Anfragen **weiter zeigen** und beantwortbar halten. Sie SHALL
NOT durch eine Fehlermeldung ersetzt werden: Eine beantwortbare Anfrage zu
verstecken, weil ihre Aktualisierung scheiterte, richtet mehr Schaden an als der
veraltete Stand.

#### Scenario: Der Abruf scheitert, ohne dass etwas vorliegt

- **WHEN** die Abfrage der eingehenden Anfragen mit einem Fehler endet und keine
  Daten vorliegen
- **THEN** erscheint ein sichtbarer Hinweis, dass die Anfragen nicht geladen
  werden konnten

#### Scenario: Ein Nachladen scheitert über vorliegenden Anfragen

- **WHEN** bereits Anfragen geladen sind und ein erneuter Abruf fehlschlägt
- **THEN** bleiben die Anfragen sichtbar und beantwortbar

#### Scenario: Leer bleibt still

- **WHEN** die Abfrage erfolgreich ist und keine offene Anfrage liefert
- **THEN** erscheint **keine** Karte und **kein** Leerzustand
