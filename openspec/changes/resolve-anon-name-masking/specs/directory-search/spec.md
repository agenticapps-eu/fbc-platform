## REMOVED Requirements

### Requirement: Author name masking is only partially resolved

**Reason**: Die Anforderung hielt AGE-291 offen mit der Aussage, das stufenweise
Auflösen von Namen nach Mitgliedsstufe sei „pending and is not present in the
code". Beide Hälften stimmen so nicht mehr. Die anonyme Maskierung ist nicht
mehr nur ein Rückfall auf einen Namen, sondern greift eine Ebene früher: ohne
Session wird `profiles_public` gar nicht erst angefragt (AGE-530). Und das
stufenweise Auflösen ist am 2026-08-13 **verworfen** worden, nicht vertagt — die
RLS gattert die Daten bereits nach Stufe, eine Anzeige-Maskierung daneben wäre
eine zweite, schwächere Kopie derselben Grenze.

Eine Anforderung, die auf ein Vorhaben zeigt, das niemand mehr verfolgt, liest
sich beim nächsten Durchgang als vergessene Lücke und lädt zum Nachbauen ein.
Deshalb entfällt sie, statt umformuliert zu werden.

**Migration**: Kein Code ändert sich — `displayAuthor`, `fetchAuthors` und
`PublicHome` bleiben, wie sie sind. Die Anforderung wird ersetzt durch „Die
Identität von Autoren ist für Ausgeloggte verdeckt" und „Neue anon-Flächen geben
keine Mitgliedsnamen preis"; beide führen den erreichten Zustand als laufende
Wahrheit. Die verworfene Alternative steht in der ersten der beiden benannt, damit
sie nicht als offener Punkt zurückkehrt.

## ADDED Requirements

### Requirement: Die Identität von Autoren ist für Ausgeloggte verdeckt

Ein ausgeloggter Besucher SHALL an keiner Stelle den Namen oder das Avatarbild
eines Mitglieds sehen. Die Verdeckung SHALL auf **zwei** Ebenen liegen, und die
untere SHALL die tragende sein:

1. **Daten.** Ohne Session SHALL eine für `anon` gesperrte Relation gar nicht
   erst angefragt werden — `profiles_public` und `partners` tragen für `anon`
   kein Leserecht, eine Abfrage käme als `42501` zurück. Die Bedingung SHALL an
   der ohnehin durchgereichten Profil-Kennung hängen, nicht an einer zweiten
   Abfrage des Sitzungszustands.
2. **Anzeige.** `displayAuthor` SHALL ausgeloggt jeden Autor als „Ein Mitglied"
   ohne Avatarbild führen, unabhängig davon, was der Aufrufer übergibt.

Die Anzeige-Ebene SHALL NOT als Sicherheitsgrenze gelten. Die Grenze ist das
fehlende Recht in der Datenbank; die Maskierung sorgt dafür, dass der Ausfall der
Anreicherung wie eine Gestaltungsentscheidung aussieht und nicht wie ein Fehler.

**Stufenweises Auflösen von Namen nach Mitgliedsstufe SHALL NOT gebaut werden**
(Entscheidung Donald, 2026-08-13). Die Stufen entscheiden bereits über die
**Daten**: `profiles_select_self_or_discover` gibt vollständige Profilzeilen erst
ab `discover` (Rang 3) heraus, `members`-Beiträge erst ab `exchange` (Rang 4).
Eine Namensauflösung, die im Frontend noch einmal nach Stufe unterscheidet, wäre
eine zweite Regel über derselben Sache — sie könnte nur strenger aussehen, als
die Datenbank ist, oder großzügiger, als die Datenbank erlaubt, und im zweiten
Fall zeigte sie nichts, weil die Zeile ohnehin fehlt. Verworfene Alternative:
`displayAuthor` einen Stufen-Parameter geben; verworfen aus genau diesem Grund.

#### Scenario: Ausgeloggt wird die gesperrte Relation nicht angefragt

- **WHEN** ein ausgeloggter Besucher die Startseite, die Aktivitätenseite, die
  Eventliste oder ein einzelnes Event öffnet
- **THEN** wird weder `profiles_public` noch `partners` angefragt
- **AND** die Beiträge und Events erscheinen trotzdem

#### Scenario: Ausgeloggt trägt jeder Autor denselben verdeckten Namen

- **WHEN** ein ausgeloggter Besucher einen Beitrag sieht
- **THEN** heißt der Autor „Ein Mitglied" und trägt kein Avatarbild
- **AND** dieses Ergebnis stammt aus der Maskierung der Anzeige, nicht aus dem
  Fehlschlag einer Abfrage

#### Scenario: Eingeloggt bleibt die Anreicherung unverändert

- **WHEN** ein authentifiziertes, aktiviertes Mitglied dieselben Flächen öffnet
- **THEN** werden `profiles_public` und `partners` wie bisher angefragt
- **AND** Name, Avatarbild und Stufen-Badge erscheinen

#### Scenario: Keine Auflösung nach Stufe

- **WHEN** die Namensanzeige eines eingeloggten Mitglieds daraufhin untersucht
  wird, ob sie je nach eigener Mitgliedsstufe unterschiedlich viel vom Namen zeigt
- **THEN** tut sie das nicht — sichtbar ist entweder der volle Name oder gar
  keine Zeile, und welches von beidem, entscheidet allein die RLS

### Requirement: Neue anon-Flächen geben keine Mitgliedsnamen preis

Eine neue Fläche, die ausgeloggt erreichbar ist, SHALL keine Mitgliedsnamen
preisgeben. Wo eine Fläche ohne Namen sinnlos wäre, SHALL sie für Ausgeloggte
entfallen, statt in einer namenlosen Fassung zu erscheinen.

Der Weg über eine neue, für `anon` ausführbare `SECURITY DEFINER`-Funktion SHALL
als eigene Sicherheitsentscheidung behandelt werden und SHALL NOT als
Nebenwirkung eines Oberflächen-Changes entstehen. Er stellte das
Mitgliederverzeichnis ins offene Netz; wer ihn will, begründet ihn in einem
eigenen Change.

Der Nachweis SHALL an einer **Positivliste** hängen, nicht an einer Aufzählung
bekannter Verstöße: geprüft wird, dass ausgeloggt ausschließlich Relationen
angefragt werden, für die `anon` ein Leserecht hält. Eine Prüfung, die einzelne
Relationen namentlich ausschließt, ließe die nächste ungenannte durch — sie
verlangt, dass jemand den Verstoß vorher errät.

#### Scenario: Ausgeloggt wird nur angefragt, was anon lesen darf

- **WHEN** die ausgeloggten Lesepfade aufgerufen werden
- **THEN** liegt jede angefragte Relation in der Positivliste der für `anon`
  lesbaren Relationen

#### Scenario: Eine Fläche, die Namen bräuchte, entfällt ausgeloggt

- **WHEN** eine Oberfläche für ihren Zweck Mitgliedsnamen zeigen müsste und der
  Besucher nicht angemeldet ist
- **THEN** wird sie nicht gerendert
- **AND** es entsteht keine namenlose Ersatzfassung, deren Ergebnisse niemand
  öffnen kann
