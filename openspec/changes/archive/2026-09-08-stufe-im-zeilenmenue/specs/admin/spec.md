## MODIFIED Requirements

### Requirement: Die Admin-Mitgliederfläche trennt die Zustände in Reiter

Das System SHALL unter `/admin/mitglieder` fünf Reiter führen: **Alle**,
**Nicht aktiviert**, **Deaktiviert**, **Gelöscht** und **Mitgliedschaft**.

**Die Reiter sind NICHT die fünf `p_status`-Werte**, und die Abbildung SHALL
ausdrücklich festgeschrieben sein statt vermutet:

| Reiter | `p_status` | Darstellung |
|---|---|---|
| Alle | `alle` | Verwaltung |
| Nicht aktiviert | `offen` | Verwaltung |
| Deaktiviert | `deaktiviert` | Verwaltung |
| Gelöscht | `geloescht` | Verwaltung |
| Mitgliedschaft | `alle` | **Mitgliedschaft** |

„Mitgliedschaft" ist damit ein **Darstellungsmodus über derselben Menge wie
„Alle"**, kein eigener Filter. Der Wert `aktiviert` bleibt bestehen, hat aber
keinen Reiter: er ist über die Funktion erreichbar und wird von der Fläche
derzeit nicht benutzt. Das ist zu benennen und nicht zu verschweigen — ein
Parameterwert ohne Aufrufer sieht sonst wie ein vergessener aus.

**Deaktivierte und Gelöschte SHALL NOT unter „Alle" erscheinen.** „Alle" meint
die Mitgliedschaft, nicht den Datenbestand; ein entferntes Mitglied zwischen den
aktiven zu führen, macht jede Zählung auf dieser Fläche unbrauchbar. Für
„Mitgliedschaft" gilt dasselbe: wer nicht mehr dabei ist, hat keinen
Zahlungszeitraum, der noch etwas bedeutet.

Der Reiter „Mitgliedschaft" SHALL je Mitglied Stufe, `paid_until` und
`payment_type` zeigen. **Die Stufe SHALL in der Tabellenzeile nur lesbar sein**
und SHALL NOT dort als Eingabe- oder Auswahlfeld erscheinen; änderbar SHALL in
der Zeile nur `paid_until` und `payment_type` sein.

Das Verbot gilt der **beiläufigen** Änderung, nicht der Erreichbarkeit. Ein
Stufenwechsel berührt Rechte und Preise; ihn nebenbei in einer Tabellenzeile zu
erlauben, wäre die folgenreichste Änderung auf dieser Fläche und zugleich die
unauffälligste. Über das **Zeilenmenü** SHALL er dagegen erreichbar sein — dort
ist er weder beiläufig noch unauffällig: er verlangt einen eigenen Dialog, nennt
das Mitglied namentlich, verlangt eine Begründung und hinterlässt eine Spur.
Diese Anforderung SHALL NOT so gelesen werden, dass sie ihn von dieser Fläche
fernhält.

*Ergänzt für AGE-707.* Die frühere Fassung verwies für den Stufenwechsel auf
„einen eigenen Weg" und meinte damit die Einzelbearbeitung. Seit AGE-707 gibt es
zwei Wege, und die Unterscheidung, auf die es ankommt, ist nicht „welche Fläche",
sondern „beiläufig oder ausdrücklich".

Ein Mitglied ohne `paid_until` SHALL ein LEERES Feld zeigen und SHALL NOT ein
geratenes Datum tragen. Das leere Feld ist die Auskunft; ein Wort daneben SHALL
NOT dieselbe Aussage ein zweites Mal machen.

*Geändert am 24.08. auf Donalds Befund an der laufenden Fläche.* Die erste
Fassung verlangte das Wort „unbekannt" neben dem Feld. Sie war für eine reine
Anzeige geschrieben; im Reiter steht dort aber ein Eingabefeld, und daneben ein
Auswahlfeld, das mit „nicht erfasst" bereits dasselbe sagt. Schlimmer als die
Dopplung war die Wirkung: das Wort erschien nur an den leeren Zeilen und schob
in jeder von ihnen die folgenden Felder um seine eigene Breite. Die eigentliche
Zusage — **es wird nichts vorbelegt** — hing nie an dem Wort.

Die drei bestehenden Sichten (Tabelle, Karten, Verzeichnis) SHALL erhalten
bleiben und SHALL innerhalb der Reiter umschaltbar sein.

Der gewählte Reiter SHALL in der Adresse stehen, damit ein Neuladen ihn nicht
verliert.

#### Scenario: Deaktivierte stehen nicht unter „Alle"

- **WHEN** ein Admin den Reiter „Alle" über einem Bestand öffnet, der ein
  deaktiviertes Mitglied enthält
- **THEN** erscheint dieses dort nicht, sondern nur unter „Deaktiviert"

#### Scenario: Ein Mitglied ohne bezahlt-bis wird nicht geraten

- **WHEN** der Reiter „Mitgliedschaft" ein Mitglied ohne `paid_until` zeigt
- **THEN** bleibt das Feld leer und trägt kein Datum — und kein Wort daneben
  wiederholt die Auskunft

#### Scenario: Der Reiter überlebt ein Neuladen

- **WHEN** ein Admin den Reiter „Gelöscht" wählt und die Seite neu lädt
- **THEN** steht er wieder auf „Gelöscht"

#### Scenario: Die Stufe lässt sich hier nicht ändern

- **WHEN** ein Admin im Reiter „Mitgliedschaft" die Stufe eines Mitglieds
  ansieht
- **THEN** wird sie angezeigt, aber nicht als Eingabefeld angeboten

#### Scenario: Über das Zeilenmenü ist sie trotzdem erreichbar

- **WHEN** ein Admin im Reiter „Mitgliedschaft" das Menü einer Zeile öffnet
- **THEN** steht dort „Stufe setzen", und der Weg führt über den Dialog mit
  Pflichtbegründung — nicht über ein Feld in der Zeile

#### Scenario: „Mitgliedschaft" zeigt dieselbe Menge wie „Alle"

- **WHEN** ein Admin zwischen „Alle" und „Mitgliedschaft" umschaltet
- **THEN** stehen dieselben Mitglieder in beiden — deaktivierte und gelöschte in
  keinem von beiden

### Requirement: Die Admin-Mitgliederfläche führt Handlungen in einem Menü je Zeile

Das System SHALL die Handlungen einer Zeile in einem Menü führen, das über eine
Schaltfläche am Zeilenende geöffnet wird, statt sie als einzelne Knöpfe
nebeneinanderzustellen.

Das Menü SHALL nur anbieten, was auf die jeweilige Zeile anwendbar ist:
„direkt aktivieren" SHALL NOT an bestätigten Zeilen erscheinen, „reaktivieren"
SHALL nur an deaktivierten. Einen Knopf anzubieten, dessen einziger Ausgang ein
Fehler ist, ist eine Einladung zum Fehlklick.

„deaktivieren" SHALL NOT an einer bereits deaktivierten Zeile erscheinen,
**deren Ban steht** — dort wäre `22023` der einzige Ausgang. **Fehlt der Ban,
SHALL es erscheinen**, denn dann ist der Aufruf kein Fehler, sondern der
Nachsetz-Weg aus der Anforderung weiter oben. Ohne diese Unterscheidung
widersprechen sich die beiden Zusagen: der halbe Zustand sieht in der Liste aus
wie jede andere deaktivierte Zeile, und die Handlung könnte ihren eigenen
halben Ausgang nicht heilen — nach der Formulierung dieses Dokuments also
„keine Handlung, sondern eine Falle".

Damit die Fläche das unterscheiden kann, SHALL die Mitgliederliste den
Ban-Zustand je Zeile mitliefern. Ein **abgelaufener** Ban SHALL NOT als Ban
zählen.

Für eine **gelöschte** Zeile besteht kein solcher Weg: die Übergangstabelle
bricht „löschen" dort in jedem Fall ab. Das Menü SHALL ihn folglich nicht
anbieten und SHALL NOT einen erfinden.

**Deaktivieren und Löschen SHALL je eine Rückfrage verlangen**, die das Mitglied
**namentlich** nennt und die Folge benennt. Beide sind umkehrbar, aber beide
nehmen einem Menschen den Zugang; eine optische Trennung allein SHALL NOT als
Schutz gelten.

**Das Menü SHALL „Stufe setzen" führen.** Die Mitgliederliste zeigt die Stufe
je Zeile bereits an; ein angezeigter Wert, dessen Änderung nur über einen an
der Liste nicht erkennbaren Umweg erreichbar ist, ist dieselbe Sackgasse wie
eine Handlung ohne Menüeintrag.

Diese Handlung SHALL an **jeder** Zeile stehen, auch an einer deaktivierten
oder gelöschten. Sie hängt nicht daran, ob das Konto sich anmelden kann, und
`admin_set_tier` kennt keinen solchen Vorbehalt; ein engeres Menü machte ein
gesperrtes Mitglied unkorrigierbar.

Sie SHALL einen Dialog öffnen, der das Mitglied **namentlich** nennt, die
Zielstufe zur Wahl stellt und eine **Begründung verlangt**. Der Dialog SHALL
den Aufruf NOT absetzen, solange die Begründung leer ist: `admin_set_tier`
bricht dann mit `22023` ab, und ein roher Datenbankfehler nach dem Bestätigen
ist kein Ersatz für ein gesperrtes Bestätigen davor. Die Fläche SHALL NOT mehr
durchlassen als die Datenbank.

Der Dialog SHALL wie die bestehende Fläche benennen, was ein späterer
Stripe-Kauf mit der gesetzten Stufe tut.

Nach einer erfolgreichen Änderung SHALL die Zeile die **neue** Stufe zeigen,
ohne dass die Seite neu geladen wird.

Das Menü SHALL mit der Tastatur bedienbar sein und SHALL sich beim Verlassen
schliessen.

#### Scenario: Das Menü zeigt nur Anwendbares

- **WHEN** ein Admin das Menü einer bereits deaktivierten Zeile öffnet, deren
  Ban steht
- **THEN** steht dort „reaktivieren", aber nicht „deaktivieren"

#### Scenario: Der fehlende Ban macht die Handlung wieder sichtbar

- **GIVEN** eine deaktivierte Zeile, deren Ban fehlt — der halbe Zustand nach
  einem `207`
- **WHEN** ein Admin ihr Menü öffnet
- **THEN** steht dort „deaktivieren", und ein Aufruf setzt den Ban nach, statt
  mit `22023` abzubrechen

#### Scenario: Wiederherstellen weckt eine Deaktivierung nicht auf

- **GIVEN** ein Mitglied, das erst deaktiviert und danach gelöscht wurde
- **WHEN** ein Admin „wiederherstellen" auslöst
- **THEN** ist `deleted_at` geleert, `disabled_at` steht weiter, die Sperre
  bleibt bestehen — und die Oberfläche meldet „bleibt deaktiviert" statt eines
  schlichten „wiederhergestellt"

#### Scenario: Deaktivieren fragt namentlich nach

- **WHEN** ein Admin „deaktivieren" auslöst
- **THEN** erscheint eine Rückfrage, die das Mitglied beim Namen nennt und sagt,
  dass es sich danach nicht mehr anmelden kann

#### Scenario: Abbrechen ändert nichts

- **WHEN** ein Admin die Rückfrage zum Löschen abbricht
- **THEN** bleibt `deleted_at` unverändert und es entsteht keine
  `admin_audit`-Zeile

#### Scenario: Die Stufe ist aus der Liste heraus erreichbar

- **WHEN** ein Admin das Menü einer beliebigen Zeile öffnet
- **THEN** steht dort „Stufe setzen"

#### Scenario: Ohne Begründung setzt der Dialog nichts ab

- **GIVEN** ein geöffneter Dialog „Stufe setzen" mit gewählter Zielstufe und
  leerer Begründung
- **WHEN** ein Admin bestätigen will
- **THEN** ist das Bestätigen gesperrt, und es geht **kein** Aufruf an
  `admin_set_tier`

#### Scenario: Die gesetzte Stufe steht danach in der Zeile

- **WHEN** ein Admin über den Dialog eine Stufe setzt und der Aufruf gelingt
- **THEN** zeigt dieselbe Zeile die neue Stufe, ohne dass die Seite neu geladen
  wurde

#### Scenario: Auch eine gesperrte Zeile lässt sich korrigieren

- **GIVEN** ein deaktiviertes Mitglied
- **WHEN** ein Admin sein Menü öffnet
- **THEN** steht dort „Stufe setzen" — anders als „Zugangslink schicken" und
  „direkt aktivieren", die dort fehlen
