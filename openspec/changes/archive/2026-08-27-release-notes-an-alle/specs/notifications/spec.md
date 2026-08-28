## ADDED Requirements

### Requirement: Eine Release-Note wird höchstens einmal zugestellt

Das System SHALL eine `SECURITY DEFINER`-Funktion mit `set search_path = ''`
führen, die eine Release-Note zustellt, und diese SHALL die Mehrfachzustellung
**in der Datenbank** ausschliessen, nicht in der Bedienoberfläche.

Der Zustandswechsel von `draft` auf `sent` SHALL **bedingt** erfolgen und
**vor** jeder erzeugten Benachrichtigung stehen. Trifft er keine Zeile, SHALL
die Funktion abbrechen, ohne eine einzige `notifications`-Zeile zu erzeugen.

Ein Fan-out ist die einzige Schreiblast dieser Anwendung, die mit der
Mitgliederzahl multipliziert. Ein zweiter Klick ist der Normalfall, nicht die
Ausnahme, und `notifications` trägt keinen Schlüssel, an dem eine Dopplung
auffiele.

Die Funktion SHALL ausschliesslich einem Admin offenstehen und dies über
dieselbe Funktion prüfen, die die Policies rufen, statt deren Bedingung zu
wiederholen.

`authenticated` SHALL **kein** INSERT-Recht auf `notifications` für fremde
Zeilen erhalten; die Zustellung SHALL allein über die Funktion laufen.

#### Scenario: Zweimal zustellen erzeugt nichts

- **WHEN** die Zustellfunktion für eine bereits zugestellte Release-Note erneut
  aufgerufen wird
- **THEN** bricht sie ab, und die Zahl der Benachrichtigungen bleibt unverändert

#### Scenario: Ein Nicht-Admin stellt nichts zu

- **WHEN** ein Mitglied ohne Admin-Rolle die Zustellfunktion aufruft
- **THEN** bricht sie ab, und es entsteht keine Benachrichtigung

#### Scenario: Der Zustand wechselt vor dem Fan-out

- **WHEN** die Zustellung mitten im Fan-out fehlschlägt
- **THEN** ist die Release-Note nicht als `draft` zurückgeblieben, aus dem ein
  zweiter Lauf denselben Fan-out ein zweites Mal erzeugen könnte

### Requirement: Eine Release-Note erreicht jedes aktivierte Mitglied ohne Abbestellung

Das System SHALL je Mitglied mit gesetztem `activated_at` genau **eine**
`notifications`-Zeile vom Typ `release_note` erzeugen.

Der Empfängerkreis SHALL NOT wählbar sein. Es SHALL **keinen** Opt-out-Schalter
für diesen Typ geben: die Schalter für die anderen Typen schützen vor dem Lärm,
den andere Mitglieder machen, und der wächst mit deren Zahl. Eine Release-Note
ist eine Mitteilung über das Werkzeug selbst, kommt selten und betrifft jeden,
der es benutzt.

Ein Mitglied ohne gesetztes `activated_at` SHALL **keine** Zeile bekommen — es
sieht die Anwendung nicht, und eine Mitteilung über ihre Änderung ginge ins
Leere.

Die bestehenden Schalter (`notify_inapp_post`, `_event`, `_comment`, `_like`)
SHALL auf diesen Typ **keine** Wirkung haben.

#### Scenario: Jedes aktivierte Mitglied bekommt genau eine Zeile

- **WHEN** eine Release-Note zugestellt wird
- **THEN** trägt jedes aktivierte Mitglied genau eine neue Benachrichtigung vom
  Typ `release_note`

#### Scenario: Ein unbestätigtes Konto bekommt nichts

- **WHEN** eine Release-Note zugestellt wird und ein Profil hat kein
  `activated_at`
- **THEN** entsteht für dieses Profil keine Zeile

#### Scenario: Die Schalter der anderen Typen greifen nicht

- **WHEN** ein Mitglied alle vier In-App-Schalter abgeschaltet hat
- **THEN** bekommt es die Release-Note trotzdem

### Requirement: Eine zugestellte Release-Note bleibt auffindbar

Das System SHALL eine Fläche führen, die alle **zugestellten** Release-Notes in
umgekehrt chronologischer Reihenfolge zeigt, und der Hinweis in der Glocke SHALL
dorthin führen.

Ohne sie wäre ein weggeklickter Hinweis unwiederbringlich: die Glocke liest nur
ungelesene und deckelt bei 50.

Ein **Entwurf** SHALL auf dieser Fläche NICHT erscheinen. Sie zeigt, was
mitgeteilt wurde, nicht was jemand vorhat.

Die Fläche SHALL jedem angemeldeten, aktivierten Mitglied offenstehen und keine
Mitgliedsstufe verlangen — was die Anwendung kann, ist keine Frage der Stufe.

#### Scenario: Der Hinweis führt auf die Fläche

- **WHEN** ein Mitglied den Release-Hinweis in der Glocke aktiviert
- **THEN** öffnet sich die Fläche mit den zugestellten Release-Notes

#### Scenario: Auch nach dem Lesen noch da

- **WHEN** ein Mitglied den Hinweis als gelesen markiert hat
- **THEN** steht die Release-Note weiterhin auf der Fläche

#### Scenario: Ein Entwurf ist nicht sichtbar

- **WHEN** ein Admin einen Entwurf gespeichert, aber nicht zugestellt hat
- **THEN** erscheint er für kein Mitglied auf der Fläche

### Requirement: Der Release-Hinweis hat einen eigenen Renderer in der Glocke

Das System SHALL den Typ `release_note` in der Glocke mit eigenem Text
darstellen. Ein Typ ohne Renderer fällt auf einen Ersatztext zurück, und ein
Hinweis, der nicht sagt, worum es geht, ist kein Hinweis.

Der Hinweis SHALL den Titel der Release-Note nennen.

#### Scenario: Der Hinweis nennt den Titel

- **WHEN** ein Mitglied die Glocke öffnet und eine Release-Note ungelesen ist
- **THEN** nennt der Eintrag deren Titel, nicht einen Ersatztext
