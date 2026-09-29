## ADDED Requirements

### Requirement: Die Oberfläche benennt nur die Clubstufen

Das System SHALL an keiner Fläche, die ein Mitglied erreichen kann, die Namen
`ACTIVE`, `BOOST` oder `CONNECT` zeigen — weder in der Anwendung, noch in der
nativen Hülle, noch im Blog. Genannt SHALL ausschliesslich **DISCOVER, FOCUS
und IMPACT** werden (Donald, 29.09.).

**Die Stufen SHALL NOT gelöscht werden.** `membership_tiers` führt weiterhin
sechs Zeilen, `levels.ts` weiterhin sechs Einträge, und das Gating bleibt
unverändert `has_level(4)`. Die drei kommen später wieder; was hier entfällt,
ist ihre Nennung, nicht ihre Existenz.

**Die Menge der genannten Stufen SHALL eine eigene Festlegung sein und SHALL
NOT aus `CLUB_RANK` abgeleitet werden**, obwohl beide heute dieselbe Menge
ergeben. *Der Grund gehört zur Zusage:* `CLUB_RANK` ist eine Rechtegrenze —
dieselbe Zahl steht als `has_level(4)` in den Policies. Würde die Nennung
daraus abgeleitet, verschöbe ein späteres „BOOST wieder zeigen" die
Rechtegrenze und schaltete dieser Stufe das Verzeichnis, die Kontaktanfragen
und die Academy frei. Eine Anzeigeentscheidung SHALL keine Rechte bewegen.

**Eine Stufe unterhalb des Clubs SHALL NOT durch einen Ersatznamen vertreten
werden.** Wo heute der Stufenname eines Mitglieds steht, SHALL künftig eine
Aussage über den **Zugang** stehen — nicht „Mitglied", nicht „Basis", nicht der
rohe Schlüssel. Ein Ersatzname wäre ein neuer Stufenname und behauptete eine
Zugehörigkeit, die gerade nicht besteht.

**Die Plakette SHALL dort entfallen und SHALL NOT leer erscheinen.** Ein
sichtbarer Kasten ohne Inhalt liest sich als Fehler.

**Aufzählende Flächen SHALL die drei genannten Stufen zeigen.** Das betrifft
die öffentliche Startseite und die Stufenauswahl in der Admin-Einzelbearbeitung.
In der Admin-Auswahl SHALL eine am Konto bereits gesetzte niedrigere Stufe
weiterhin erscheinen — sonst setzte ein Speichern sie stillschweigend hoch;
dieselbe Zusage, die für die Mitgliederliste seit AGE-903 gilt.

**Texte, die eine SCHWELLE benennen, SHALL unverändert bleiben.** Sie nennen
sämtlich `DISCOVER` und sind von dieser Anforderung nicht berührt.

**Die Rechtstexte SHALL keine Stufe nennen, die die Oberfläche verschweigt.**
Die Aufzählung in den AGB SHALL Discover, Focus und Impact führen. Der Text
trägt das: er leitet mit „derzeit insbesondere folgende" ein und behält
ausdrücklich das Recht vor, zusätzliche Stufen einzuführen.

**Eine Zusage SHALL gegen das gebaute Bündel messen und SHALL NOT allein aus
einer Aufzählung der bekannten Fundstellen bestehen.** Eine Inventur findet
keine übersehene Stelle; ein Test gegen das Artefakt findet sie.

#### Scenario: Kein Mitglied sieht die drei Namen

- **WHEN** ein Mitglied die Anwendung, die native Hülle oder den Blog benutzt
- **THEN** kommen die Wörter Active, Boost und Connect als Stufennamen nirgends
  vor

#### Scenario: Ein Konto unterhalb des Clubs trägt keine Plakette

- **WHEN** ein Mitglied auf einer Stufe unterhalb DISCOVER angezeigt wird — im
  Profil, im Verzeichnis, im Dashboard oder in den Einstellungen
- **THEN** erscheint dort keine Stufenplakette, und an keiner dieser Stellen
  steht ein Ersatzname; wo ein Name stünde, steht eine Aussage über den Zugang

#### Scenario: Ein Konto im Club trägt seine Plakette weiter

- **WHEN** ein Mitglied auf DISCOVER, FOCUS oder IMPACT angezeigt wird
- **THEN** erscheint die Plakette mit dem Namen der Stufe — die Gegenprobe zum
  Fall darüber

#### Scenario: Die öffentliche Startseite zeigt drei Stufen

- **WHEN** jemand ohne Konto die Startseite öffnet
- **THEN** stehen dort DISCOVER, FOCUS und IMPACT, und der Text daneben spricht
  nicht mehr von sechs Stufen

#### Scenario: Die Admin-Auswahl verschweigt keine gesetzte Stufe

- **WHEN** ein Admin ein Konto bearbeitet, das auf einer Stufe unterhalb des
  Clubs steht
- **THEN** bietet die Auswahl DISCOVER, FOCUS und IMPACT **und** die am Konto
  gesetzte Stufe — ein Speichern ohne Absicht hebt sie nicht an

#### Scenario: Die Stufen bestehen weiter

- **WHEN** `membership_tiers` und `levels.ts` gelesen werden
- **THEN** führen beide weiterhin sechs Stufen, und `has_level(4)` entscheidet
  unverändert — verborgen ist die Nennung, nicht die Stufe

#### Scenario: Eine Anzeigeentscheidung bewegt keine Rechtegrenze

- **WHEN** die Menge der genannten Stufen geändert wird
- **THEN** ändert sich `CLUB_RANK` dadurch nicht, und kein Gate schaltet um

#### Scenario: Die Schwellen-Texte bleiben

- **WHEN** eine Fläche sagt, ab welcher Stufe etwas verfügbar ist
- **THEN** nennt sie weiterhin DISCOVER, unverändert

#### Scenario: Die AGB nennen dieselben drei

- **WHEN** ein Mitglied die AGB liest
- **THEN** führt die Aufzählung der Mitgliedschaftsstufen Discover, Focus und
  Impact

#### Scenario: Das gebaute Bündel wird gemessen

- **WHEN** die Anwendung gebaut ist
- **THEN** hält eine Zusage über dem Artefakt fest, dass die drei Namen darin
  als Stufenname nicht vorkommen
