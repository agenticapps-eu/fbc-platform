# AGE-581 — Mitgliederabgleich, Stand 24.08.2026

Grundlage ist Detlevs Übersicht der aktiven Mitglieder vom 23.08.2026
(zwei Bildschirmfotos, nach Zahlungskategorie gruppiert), abgeglichen gegen die
PROD-Datenbank `viwntbodrtqxgmqyxluh`.

**Die Datenpflege ist am 24.08. durchgeführt.** Endstand unten, unabhängig
nachgemessen mit `scripts/probe-age581-datenpflege-abnahme.ts`.

**Die Zahlen hier sind gemessen, nicht abgelesen.** Sie stammen aus
`scripts/probe-age581-datenpflege-trockenlauf.ts` — einem Lauf, der die Umgebung
prüft, `default_transaction_read_only` setzt und die Wirkung von 12.1 bis 12.6
ausgibt, bevor irgendetwas geschrieben wird. Wo die erste Fassung dieses Belegs
(23.08., in Prosa gezählt) abweicht, steht die Messung.

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
`scripts/probe-age581-datenpflege-trockenlauf.ts` neu.

Der ältere `scripts/probe-age581-abgleich.ts` kennt die feste Zuordnung aus dem
übernächsten Abschnitt **nicht** und meldet deshalb 58 statt 59 Treffer. Er
bleibt als reiner Abgleich brauchbar, taugt aber nicht mehr als Grundlage für
die Datenpflege.

## Die Zahlen

| | |
|---|---|
| Einträge in der Übersicht | **60** |
| Konten in PROD | **71** |
| davon eindeutig zugeordnet | **59** |
| davon **von Hand festgesetzt** | **2** |
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

## Zwei Zeilen trafen dasselbe Konto — gefunden erst im Trockenlauf

Die Zuordnung beantwortet je Zeile die Frage „welches Konto?". Sie kann nicht
sehen, dass sie für **zwei** Zeilen dieselbe Antwort gegeben hat.

Genau das war der Fall. Ein Partner-Eintrag trägt in der Übersicht die
Firmenadresse einer anderen Person (siehe Fall 2 unten). Beide Zeilen trafen
darüber dasselbe Konto, und zwar über die Adresse — also über den **stärksten**
der drei Wege, nicht über den schwächsten. Ungeprüft hätte der Durchgang

1. zwei verschiedene Jahrestage nacheinander in dieselbe Zeile geschrieben; die
   zweite Schreibung hätte gewonnen, ohne Fehler und ohne Meldung, und
2. das **richtige** Konto des Partners als „ohne Übersichtseintrag" übrig
   gelassen — womit es in 12.5 deaktiviert worden wäre.

Ein aktives Partner-Mitglied hätte seinen Zugang verloren, weil in einer Tabelle
eine Adresse falsch stand. Die Prosa-Fassung dieses Belegs vom 23.08. hat den
Fall beschrieben, aber die Zählung ging trotzdem von einer sauberen Zuordnung
aus: sie meldete 59 Treffer, die der Rechenweg gar nicht hergab.

Zwei Gegenmittel, beide am 24.08. eingebaut:

- **`findeDoppelbelegung()`** meldet jede Mehrfachbelegung und **beendet den
  Trockenlauf mit Fehlercode**. Eine Sperre, die nur in der Ausgabe steht, hängt
  daran, dass jemand die Ausgabe liest.
- Eine **feste Zuordnung** je Zeile — die heutige Anmeldeadresse des gemeinten
  Kontos — schlägt alle drei Automatismen. Zwei der sechzig Zeilen brauchen sie:
  der Partner-Eintrag oben und der Eintrag aus Fall 1. Zeigt sie ins Leere, gilt
  die Zeile als **nicht zugeordnet**; sie fällt NICHT still auf den Adresstreffer
  zurück, sonst wirkte die Korrektur nur, bis sie es nicht mehr tut.

Die Zuordnungstabelle steht in der **nicht eingecheckten Quelldatei** (sechste
Spalte), nicht hier: eine Zuordnungstabelle ist eine Identitätstabelle.

## Der Schlüssel der festen Zuordnung ist die Kennung, nicht die Adresse

Und das ist mit Ansage gelernt worden. Die erste Fassung hielt als Schlüssel die
damalige **Anmeldeadresse**. Beim Durchgang am 24.08. lief 12.4 — die
Angleichung der Anmeldeadressen — unmittelbar vor 12.5. Danach zeigte der
Schlüssel ins Leere:

1. die Zeile galt als „ohne Konto",
2. **12.5 deaktivierte ein Mitglied, das auf der Liste steht**, und
3. 12.6 versuchte, dasselbe Mitglied ein zweites Mal anzulegen. Dass GoTrue das
   mit „already registered" ablehnte, hat das Zweitkonto verhindert — Zufall,
   kein Entwurf.

Ein Schlüssel, den ein **späterer Schritt desselben Durchgangs** verändert, ist
keiner. Die Zuordnung hängt seither an `profiles.id`; die ändert sich nie.

Die Sperre gegen Doppelbelegung sprang dabei nicht an, und auch das ist eine
Lehre: aus der Doppelbelegung war eine **Nicht**-Belegung geworden. Der
Trockenlauf prüft den Zustand VOR 12.4 — nicht den ZWISCHEN den Schritten.

Zwei Gegenmittel, beide belegt:

- ein Test, der die Reihenfolge nachstellt (dieselbe Zeile vor und nach der
  Angleichung, beide Male dasselbe Konto). Gegen den alten Entwurf ist er rot.
- der Schritt **`heilen`**, der nicht den Einzelfall repariert, sondern die
  Invariante herstellt: *wer auf der Liste steht, ist offen.* Idempotent, meldet
  null, wenn nichts zu tun ist — und genau dann stimmt die Invariante.

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

Zwei Schreibweisen bekommen bewusst **kein** gerechnetes Ergebnis, sondern eine
Meldung: der **29.02.** und jeder andere Tag, den es im Zielmonat nicht gibt.
`Date.UTC(2026, 1, 29)` liefert klaglos den 01.03.2026 — ein erfundenes Datum,
kein Rundungsfehler. Der 29.02. gilt auch in einem Schaltjahr als unlesbar,
sonst hinge die Antwort daran, in welchem Jahr der Stichtag liegt. In den
sechzig Zeilen kommt keiner der beiden Fälle vor; die Regel steht für den
nächsten Durchgang.

## Die drei Einträge, die nicht glatt aufgehen

1. **Ein Name weicht ab, die Adresse enthält einen Tippfehler.** Die Übersicht
   führt einen Doppelnamen, die Datenbank nur den zweiten Teil; die
   Anmeldeadresse trägt in der Datenbank einen doppelten Buchstaben. Die
   Zuordnung ist eindeutig, aber über den Namen, nicht über die Adresse.
2. **Eine Adresse steht in der Übersicht bei zwei Personen.** Ein
   Partner-Eintrag trägt dieselbe Firmenadresse wie ein Rechnungs-Eintrag zwei
   Kategorien weiter. In der Datenbank hat die betroffene Person eine eigene,
   andere Adresse. Die Übersicht ist hier die fehlerhafte Quelle. Dieser Fall
   ist die Doppelbelegung aus dem Abschnitt oben — er ist nicht bloss unschön,
   er hätte ein aktives Mitglied deaktiviert.
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

## Die fünfzehn abweichenden Anmeldeadressen

Die Anmeldeadresse ist die, an die der Zugangslink geht. Weicht sie von der
Übersicht ab, bekommt das Mitglied seinen Link an ein Postfach, das es
möglicherweise nicht mehr liest. Bei **fünfzehn** der sechzig ist das der Fall —
von einem einzelnen doppelten Buchstaben bis zu einer vollständig anderen
Domain, in einem Fall zu einer Platzhalteradresse auf `local.host`, die nie
ankommen kann.

Entscheidung vom 23.08.: **auf die Fassung der Übersicht angleichen.** **Zwölf**
werden angeglichen, **drei bleiben ausgenommen**:

| Ausnahme | Grund |
|---|---|
| Ein Eintrag ohne `@` in der Adresse | GoTrue würde sie ablehnen; im Bildschirmfoto vermutlich abgeschnitten |
| Der Eintrag mit der doppelt vergebenen Firmenadresse | Angleichen liefe in eine Kollision mit dem rechtmässigen Inhaber |
| Der zweite Admin | Admin und aktiviert — eine falsch gesetzte Adresse sperrt ihn aus genau der Fläche aus, auf der man sie korrigieren würde. Er bestätigt selbst, welche stimmt |

Die Prosa-Fassung vom 23.08. zählte hier zwölf Abweichungen, zehn Angleichungen
und drei Ausnahmen — und merkte selbst an, dass zehn plus drei dreizehn ergibt
und nicht zwölf. Diese sichtbare Kante war der Rand eines Zählfehlers. Der
Trockenlauf misst **15 = 12 + 3**. Die drei Zeilen Unterschied sind die beiden
von Hand festgesetzten (deren Abweichung erst sichtbar wird, wenn sie überhaupt
zugeordnet sind) und eine beim Ablesen übersehene.

## Erwartete Endzahlen

Vor dem Schreiben festzuhalten, danach zu messen. Ein Durchlauf, der seine
eigenen Ergebniszahlen erst hinterher bestimmt, kann nicht fehlschlagen.

| Kennzahl | vorher | erwartet | **gemessen** |
|---|---|---|---|
| Profile in PROD | 71 | 72 (71 + der eine Nachzügler) | **72** ✓ |
| deaktiviert | 0 | 12 (11 + der Nachzügler) | **12** ✓ |
| mit gesetzter `payment_type` | 0 | 60 | **60** ✓ |
| mit gesetztem `paid_until` | 0 | 57 | **57** ✓ |
| gelöscht | 0 | 0 | **0** ✓ |
| angeglichene Anmeldeadressen | 0 | 12 | **12** ✓ |

Nachgemessen hat das ein **zweiter** Lauf, der die Quelldatei gar nicht kennt
(`scripts/probe-age581-datenpflege-abnahme.ts`, 22 Zusagen). Der Zähler im
Schreibskript taugt dafür nicht: er teilt Rechenkern und Quelle mit dem
Schreiber und hätte einen gemeinsamen Fehler mitgemeldet — was am 24.08. auch
genau so passiert ist.

Drei Fragen darin sind keine Zählungen, sondern Invarianten:

- **kein Datum vor dem Stichtag** und keines mehr als ein Jahr voraus — sonst
  hat die Regel „nächstes Vorkommen" nicht gegriffen;
- **die Verteilung je Kategorie** einzeln, nicht nur die Summe 60 — „sechzig
  gesetzt" stimmte auch mit den falschen sechzig;
- **die Doppelsperre in beide Richtungen**: null verborgen-ohne-Bann, null
  offen-aber-gebannt. Das ist die Zusage, gegen die dieser ganze Change gebaut
  ist, und sie lässt sich nur paarweise prüfen.

Die `admin_audit`-Spur trägt den Durchgang **einschliesslich des Fehlers**:
60 × `update_profile`, 12 × `change_login_email`, 13 × `disable_member`,
1 × `enable_member`. Dreizehn statt zwölf, und die eine Rücknahme daneben — ein
Protokoll, das nur die geglückten Schritte zeigt, ist keins.

**Die Abnahme in AGE-581 nennt 59 / 56 / 11** — Zahlungsart, `paid_until`,
deaktiviert. Das ist derselbe Zustand, nur **vor 12.6** gezählt: der Nachzügler
fehlt in jeder der drei Zeilen. Nach 12.6 lauten dieselben drei Zahlen
60 / 57 / 12. Beide Zählungen sind richtig; sie stehen an verschiedenen Punkten
des Durchgangs.
