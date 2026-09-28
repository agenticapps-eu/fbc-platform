# ADR-0007: Mehrfachauswahl in der Mitgliederliste — nur für den Aktivierungslink

**Status**: Accepted  **Date**: 2026-09-28  **Linear**: AGE-927 (ändert eine Zusage aus AGE-304)

## Context

Die Anforderung „Die Admin-Fläche kennt eine Mitgliederliste, aber keinen
Massenversand" (`openspec/specs/admin/spec.md`) schliesst eine Mehrfachauswahl
in der Mitgliederliste bis heute wörtlich aus. Ihr Szenario „Die Liste ist keine
Empfängerauswahl" sagt:

> **THEN** bietet sie Filtern, Blättern und die Handlungen je **einzelnem**
> Mitglied — und keine Mehrfachauswahl, kein „an alle", keine Übernahme der
> Treffermenge in eine andere Fläche

Der Zaun stammt aus **AGE-304** („Admin-Rolle(n) + interner DKRI-Bereich":
CRM-Aktionen, Massen-Mails, Themen-Newsletter). Dieses Issue liegt im Backlog
**nach Go-Live** und verlangt ausdrücklich, vorher das RLS-/Rechtemodell zu
erweitern. Die Zusage ist damit eine **Umfangsgrenze**, kein Rechtsverbot: sie
soll verhindern, dass die Mitgliederliste durch die Hintertür zum CRM wird,
bevor jemand das Rechtemodell dafür gebaut hat.

AGE-927 bringt den Prozess ins Bild: anlegen → einladen → bestätigt. Auf PROD
am 28.09. gemessen stehen dort **35 Konten, die nie eingeladen wurden**, und
15, die auf ihre Bestätigung warten. Einzeln eingeladen sind das 35 Handgriffe
für einen Vorgang, den die Liste bereits je Zeile anbietet.

Donald hat am 28.09. entschieden: Mehrfachauswahl ja, Zaun bleibt.

## Decision

Die Mitgliederliste **darf** eine Mehrfachauswahl führen — ausschliesslich, um
für die ausgewählten Mitglieder denselben **Aktivierungslink** auszulösen, den
die Zeile heute schon einzeln auslöst (`send-activation` →
`issue_activation_token`).

Eng gezogen heisst das:

* **Kein freier Text, kein Betreff, kein Textbaustein.** Die Auswahl hat genau
  eine Wirkung, und die steht fest.
* **Keine Übernahme der Menge** in eine andere Fläche, keinen Export, keine
  Zwischenablage.
* **Kein Umgehen der Schutzriegel.** Die Massenaktion ruft dieselbe Kette wie
  der Einzelknopf und erbt alle drei Grenzen aus `issue_activation_token`: 60
  Sekunden je Profil, höchstens fünf pro Tag, und das 24-Stunden-Schutzfenster,
  in dem ein noch gültiger Link im Postfach **nicht** ersetzt wird.
* **Massenmail, CRM und Themen-Newsletter bleiben wortgleich verboten.** Der
  Rest der Anforderung wird nicht angefasst, AGE-304 bleibt offen.

## Warum nicht die Alternativen

**Den Zaun ganz stehen lassen** (Detlev klickt die 35 einzeln durch) wäre die
buchstabengetreue Lesart und war ernsthaft im Rennen. Dagegen sprach, dass die
Zusage einen *Empfängerkreis* schützt, den die Auswahl gar nicht erweitert: jedes
dieser Konten darf heute schon einzeln eingeladen werden, von derselben Person,
über denselben Weg, mit demselben Text. Was sich ändert, ist die Zahl der Klicks
— und der wiederkehrende Aufwand bei jedem weiteren Schwung neuer Mitglieder.

**Eine Massenaktion „alle in Schritt ① einladen"** ohne Auswahl war der erste
Vorschlag und wurde verworfen: sie ist genau das „an alle", das die Zusage
nennt, und sie nimmt dem Admin die Entscheidung, wer diesmal dran ist.

**Den Zaun weiträumig öffnen** („Admin darf an Ausgewählte schreiben") wäre
AGE-304 vorweggenommen, ohne das Rechtemodell, das AGE-304 dafür verlangt.

## Vorbild im eigenen Haus

Dieselbe Zusage wurde schon einmal begründet geöffnet, und der Absatz steht
heute noch in der Anforderung: die Release-Notes-Fläche darf zustellen, **weil**
sie keine Empfängerauswahl kennt — „Verboten war das Bilden und Bespielen von
Zielgruppen; eine einzelne, redigierte In-App-Mitteilung ohne Zielgruppe ist
davon nicht erfasst."

Diese Entscheidung folgt derselben Form: nicht „die Regel gilt hier nicht",
sondern „die Regel gilt, und hier ist die eng umrissene Handlung, die sie nicht
meint".

## Consequences

* Die Anforderung in `openspec/specs/admin/spec.md` wird geändert, nicht
  umgangen. Das Szenario „Die Liste ist keine Empfängerauswahl" bekommt die
  Einschränkung ausdrücklich in den Text, damit die nächste Lesart nicht wieder
  bei „Mehrfachauswahl ist erlaubt" landet.
* **Der Zaun wird damit dünner.** Wer als nächstes eine Mehrfachauswahl für
  etwas anderes will, findet einen Präzedenzfall vor. Genau deshalb steht hier,
  wie eng die Öffnung ist — und dass sie an einer Handlung hängt, die es einzeln
  schon gab.
* Die Oberfläche muss den `pending`-Ausgang **ehrlich** melden. Ein Bericht „33
  verschickt, 2 übersprungen: es liegt noch ein gültiger Link im Postfach" ist
  Teil der Entscheidung, kein Detail: ohne ihn behauptet die Massenaktion einen
  Versand, den es nicht gab.
