## ADDED Requirements

### Requirement: Ein Gerät setzt beim Start ein Lebenszeichen, ohne zu fragen

Startet die App auf einer nativen Fläche und ist die Push-Erlaubnis **bereits
erteilt**, SHALL das Gerätetoken erneut abgelegt werden — ohne Systemdialog,
ohne sichtbare Wirkung, ohne Zutun des Mitglieds.

Ist die Erlaubnis **nicht** erteilt — offen, abgelehnt oder zurückgenommen —,
SHALL beim Start nichts geschehen. Insbesondere SHALL keine Erlaubnis
angefordert werden. Das bleibt allein dem Weg über die Nachrichten vorbehalten,
aus dem dort genannten Grund: iOS zeigt den Dialog einmal.

Auf der Web-Fläche SHALL weiterhin nichts geschehen.

Der Zweck ist nicht die Registrierung — die steht bereits — sondern der
**Zeitstempel**. Ohne ihn misst `push_tokens.letzter_kontakt` nur, wann ein
Mitglied zuletzt die Nachrichten geöffnet hat, und ist als Lebenszeichen
unbrauchbar. Der Anbieter Firebase verlangt für dasselbe Verfahren ein
monatliches Erneuern; ein Erneuern je Start erfüllt das mit Abstand.

#### Scenario: Ein Start mit erteilter Erlaubnis erneuert den Zeitstempel

- **WHEN** die App auf einer nativen Fläche startet, ein Mitglied angemeldet ist
  und die Push-Erlaubnis bereits erteilt war
- **THEN** wird das Gerätetoken erneut abgelegt und `letzter_kontakt` trägt den
  Zeitpunkt dieses Starts

#### Scenario: Ein Start ohne Erlaubnis fragt nicht

- **WHEN** die App startet und die Push-Erlaubnis nicht erteilt ist
- **THEN** wird kein Systemdialog gezeigt und keine Erlaubnis angefordert

#### Scenario: Die Web-Fläche bleibt still

- **WHEN** die App im Browser startet
- **THEN** wird weder ein Token abgelegt noch eine Erlaubnis geprüft, die einen
  Dialog auslösen könnte

### Requirement: Ein Gerätetoken ohne Lebenszeichen wird entfernt

Ein Gerätetoken, dessen letztes Lebenszeichen länger als **180 Tage**
zurückliegt, SHALL vom System entfernt werden — auch dann, wenn der Anbieter es
nie abgelehnt hat.

Das ist der Fall der deinstallierten App. APNs meldet ein solches Token
weiterhin als zustellbar, auf einem bewusst unscharfen und undokumentierten
Zeitplan; eine Ablehnung, aus der `dauerhaft` und damit das Löschen entstünde,
kommt womöglich nie.

Als Lebenszeichen SHALL ausschliesslich `push_tokens.letzter_kontakt` gelten.
Das System SHALL kein weiteres Signal heranziehen — insbesondere nicht den
Erfolg einer Zustellung, der bei genau diesem Fehlerbild fälschlich Leben
anzeigt.

Die Frist SHALL für **beide** Plattformen gleich sein. Auf Android verfällt ein
Token nach 270 Tagen Inaktivität ohnehin von selbst; 180 Tage greifen dort also
früher. Das ist gewollt: mit dem Lebenszeichen beim Start bedeutet die Frist auf
beiden Plattformen dasselbe, nämlich dass die App ein halbes Jahr nicht gelaufen
ist.

Die Frist SHALL nicht vom Aufrufer bestimmt werden. Es gibt einen Aufrufer, und
ein frei wählbarer Wert wäre ein Weg, versehentlich alle Token zu entfernen.

Das Entfernen SHALL keine Wirkung auf die Hinweise selbst haben: die Zeilen in
`notifications` bleiben, das Mitglied sieht sie weiterhin in der Glocke. Es
entfällt nur der Weg aufs Gerät — und der stellt sich beim nächsten Start der
App von selbst wieder her.

#### Scenario: Ein Token ohne Lebenszeichen verschwindet

- **WHEN** der Fälligkeitslauf ausgeführt wird und ein Gerätetoken ein
  Lebenszeichen trägt, das älter als die Frist ist
- **THEN** ist die Zeile aus `push_tokens` entfernt

#### Scenario: Ein Token mit frischem Lebenszeichen bleibt bestehen

- **WHEN** derselbe Lauf ausgeführt wird und ein weiteres Gerätetoken ein
  Lebenszeichen innerhalb der Frist trägt
- **THEN** besteht diese Zeile unverändert fort

#### Scenario: Ein Tag vor der Frist wird nicht entfernt

- **WHEN** ein Gerätetoken ein Lebenszeichen trägt, das einen Tag jünger als die
  Frist ist
- **THEN** besteht die Zeile fort

#### Scenario: Das Aufräumen geht der Vergabe voraus

- **WHEN** im selben Fälligkeitslauf ein fälliger Auftrag für ein Token
  vorliegt, dessen Lebenszeichen älter als die Frist ist
- **THEN** wird für dieses Token keine Zustellung mehr vergeben

#### Scenario: Ein Lebenszeichen setzt die Frist zurück

- **WHEN** ein Gerät sein Token erneut ablegt und damit `letzter_kontakt` neu
  setzt
- **THEN** bleibt die Zeile beim nächsten Lauf bestehen, unabhängig davon, wie
  alt der vorherige Wert war

#### Scenario: Keine Rolle ausserhalb der Datenbank kann das Aufräumen auslösen

- **WHEN** eine der Rollen `anon`, `authenticated` oder `service_role` die
  Aufräumfunktion aufzurufen versucht
- **THEN** wird der Aufruf mangels Ausführungsrecht abgewiesen

#### Scenario: Das Aufräumen lässt die Hinweise unangetastet

- **WHEN** ein Token wegen fehlender Lebenszeichen entfernt wird
- **THEN** bleiben die Zeilen dieses Mitglieds in `notifications` bestehen
