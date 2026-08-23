# AGE-581 — Mitgliederabgleich, Stand 23.08.2026

Grundlage ist Detlevs Übersicht der aktiven Mitglieder vom 23.08.2026
(zwei Bildschirmfotos, nach Zahlungskategorie gruppiert), abgeglichen gegen die
PROD-Datenbank `viwntbodrtqxgmqyxluh`.

## Dieses Dokument trägt keine Namen und keine Adressen

**Das Repository ist öffentlich.** Die erste Fassung dieses Belegs enthielt eine
zeilenweise Tabelle mit sechzig Klarnamen, E-Mail-Adressen und Geburtsdaten
realer Personen. Sie wurde vor dem ersten Commit entfernt.

Geprüft wurde bei der Gelegenheit auch der Bestand: die einzigen echten Adressen
im Repo sind bislang die des Betreibers und Platzhalter (`privat@web.de`,
`reset@gmail.com`). Fremde personenbezogene Daten stehen hier nicht — und dabei
bleibt es.

Der Beleg trägt deshalb **Zahlen, Regeln und Ausnahmen**, aber keine
Identitäten. Die zeilenweise Zuordnung entsteht zur Laufzeit aus der Datenbank
und einer nicht eingecheckten Quelldatei; wer sie braucht, erzeugt sie mit
`scripts/probe-age581-abgleich.ts` neu.

## Die Zahlen

| | |
|---|---|
| Einträge in der Übersicht | **60** |
| Konten in PROD | **71** |
| davon eindeutig zugeordnet | **59** |
| Übersichtseinträge **ohne** Konto | **1** |
| Konten **ohne** Übersichtseintrag | **12** |
| davon das eigene Admin-Konto | 1 |
| **zu deaktivieren** | **11** |

## Warum die Übersicht als vollständig gilt

Die Gruppenüberschriften der Bildschirmfotos nennen je Kategorie eine Anzahl.
Die tatsächlich gelesenen Zeilen stimmen mit allen acht überein:

| Kategorie | Überschrift | gelesen |
|---|---|---|
| Ehrenmitglied | 3 | 3 |
| Partner | 5 | 5 |
| Rechnung | 28 | 28 |
| via CopeCart | 6 | 6 |
| via Digistore24 | 1 | 1 |
| via PayPal | 1 | 1 |
| via Stripe | 15 | 15 |
| Zahlung offen | 1 | 1 |
| **Summe** | **60** | **60** |

Das ist der Beleg, dass keine Liste am unteren Bildrand abgeschnitten war — die
naheliegendste Fehlerquelle beim Ablesen eines Bildschirmfotos.

## Wie `bezahlt bis` gerechnet wird

Der Jahrestag sagt, wann sich der Plan erneuert. Bezahlt ist also bis zum Tag
**davor**, und zwar bis zum **nächsten** Vorkommen von Tag und Monat nach dem
Stichtag.

Der Stichtag ist **fest auf den 23.08.2026 gesetzt**, nicht auf „heute". Sonst
hinge das Ergebnis am Ausführungstag, und dasselbe Skript ergäbe morgen andere
Daten.

Ergebnis: **57 berechnete Daten, 3 leer, 0 unlesbar.** Die drei ohne Datum sind
Stripe-Mitglieder, deren Übersicht als Jahrestag „Ohne" führt; sie behalten
`paid_until = null`. Ein Jahr ab heute wäre erfunden und stünde danach als
Tatsache in der Datenbank.

Der früheste berechnete Wert liegt auf dem **25.08.2026** — zwei Tage nach dem
Stichtag. Diese Mitgliedschaft erneuert sich also unmittelbar.

## Die drei Einträge, die nicht glatt aufgehen

1. **Ein Name weicht ab, die Adresse enthält einen Tippfehler.** Die Übersicht
   führt einen Doppelnamen, die Datenbank nur den zweiten Teil; die
   Anmeldeadresse trägt in der Datenbank einen doppelten Buchstaben. Die
   Zuordnung ist eindeutig, aber über den Namen, nicht über die Adresse.
2. **Eine Adresse steht in der Übersicht bei zwei Personen.** Ein
   Partner-Eintrag trägt dieselbe Firmenadresse wie ein Rechnungs-Eintrag zwei
   Kategorien weiter. In der Datenbank hat die betroffene Person eine eigene,
   andere Adresse. Die Übersicht ist hier die fehlerhafte Quelle.
3. **Ein Eintrag hat kein Konto.** Der einzige der Kategorie „Zahlung offen".
   Er wird angelegt und sofort deaktiviert.

## Die zwölf Konten ohne Übersichtseintrag

Elf werden deaktiviert; das zwölfte ist das Admin-Konto des Betreibers und
bleibt.

Zwei der elf sind erkennbar **keine Personen**, sondern Dienstkonten (ein
Website-Admin und eine Hotline-Adresse auf `local.host`). Die Entscheidung vom
23.08. lautet dennoch **deaktivieren statt löschen**, einheitlich für alle elf —
in diesem Durchgang wird nichts gelöscht.

**Eine Rolle ist betroffen.** Eines der elf Konten ist auf DEV als
`matching_manager` eingetragen (auf PROD trägt es keine Rolle). Mit der
Verschärfung von `is_matching_manager()` verliert es dort seine Rolle, sobald es
deaktiviert wird. Vor dem Deaktivieren auf DEV ist zu klären, ob die
Zuteilungsliste einen anderen Bearbeiter braucht.

## Die zwölf abweichenden Anmeldeadressen

Die Anmeldeadresse ist die, an die der Zugangslink geht. Weicht sie von der
Übersicht ab, bekommt das Mitglied seinen Link an ein Postfach, das es
möglicherweise nicht mehr liest. Bei zwölf der sechzig ist das der Fall — von
einem einzelnen Bindestrich bis zu einer vollständig anderen Domain, in einem
Fall zu einer Platzhalteradresse auf `local.host`, die nie ankommen kann.

Entscheidung vom 23.08.: **auf die Fassung der Übersicht angleichen.** Zehn
werden angeglichen, **drei bleiben ausgenommen**:

| Ausnahme | Grund |
|---|---|
| Ein Eintrag ohne `@` in der Adresse | GoTrue würde sie ablehnen; im Bildschirmfoto vermutlich abgeschnitten |
| Der Eintrag mit der doppelt vergebenen Firmenadresse | Angleichen liefe in eine Kollision mit dem rechtmässigen Inhaber |
| Der zweite Admin | Admin und aktiviert — eine falsch gesetzte Adresse sperrt ihn aus genau der Fläche aus, auf der man sie korrigieren würde. Er bestätigt selbst, welche stimmt |

Zehn plus drei ergibt dreizehn, nicht zwölf: der zweite Fall steht in der Liste
der abweichenden Adressen nicht, weil er dort gar nicht als Abweichung erkannt
wurde — er wurde über den Namen zugeordnet.

## Erwartete Endzahlen

Vor dem Schreiben festzuhalten, danach zu messen. Ein Durchlauf, der seine
eigenen Ergebniszahlen erst hinterher bestimmt, kann nicht fehlschlagen.

| Kennzahl | erwartet |
|---|---|
| Profile in PROD | 72 (71 + der eine Nachzügler) |
| deaktiviert | 12 (11 + der Nachzügler) |
| mit gesetzter `payment_type` | 60 |
| mit gesetztem `paid_until` | 57 |
| gelöscht | 0 |
