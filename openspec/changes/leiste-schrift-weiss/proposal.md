# Beide Leisten tragen dieselbe Schrift

Linear: **AGE-1018**

## Why

AGE-1003 hat die linke Navigation im dunklen Modus auf die Fläche der
Nachrichtenleiste gezogen — `#002B51` für beide. Die **Schrift** ist dabei
geblieben, wie sie war: `#9FB4D2` für inaktive Einträge, `#8FA5C4` für
Abschnittsmarken. Donald hat sie am 07.10. angesehen und für zu dunkel befunden;
sie soll denselben Weisston tragen wie die Leiste rechts.

**Hier wird kein Defekt repariert.** Das gehört an den Anfang, weil der nächste
Leser sonst einen sucht: die heutigen Werte halten die Norm, nachgerechnet und
als Test festgehalten — 6,78:1 und 5,70:1 gegen `#002B51`, beide über den 4,5:1.
`src/index.chatleiste-tokens.test.ts` prüft genau das und ist grün. Was sich
ändert, ist eine **Vorgabe**, nicht ein Zustand, der falsch wäre.

Der Grund, dass daraus ein Change wird und kein Token-Tausch, ist derselbe wie
bei AGE-1003 und wurde vor der ersten Zeile gemessen: die beiden Token, die hier
naheliegen, werden **weit ausserhalb der Leiste** gelesen — 17 Stellen in
`OnboardingPage`, 22 in `WillkommenPage` und `Button variant="secondary"`.
Umlegen hiesse, zwei Vollseiten und einen Knopf mitzufärben, über dessen
Gestaltung gerade eine offene Frage steht.

Und es gibt eine zweite Folge, die nicht nach Farbe aussieht: **eingeklappt
verliert der aktive Eintrag ein Erkennungsmerkmal.** `NavIcon` färbt nicht
selbst, es erbt `currentColor`. Heute unterscheidet sich das aktive Symbol vom
inaktiven in Farbe **und** Form. Werden inaktive Einträge weiss, bleibt die Form
allein. Das ist die eine Entscheidung, die dieser Change zu treffen hat.

## What Changes

- Die Schrift der linken Navigation ist im dunklen Modus weiss — derselbe Ton
  wie die Namen in der Nachrichtenleiste rechts.
- Die Abschnittsmarken darüber („Mein Bereich", „Club") sind hell blaugrau,
  derselbe Ton wie Vorschautext und Uhrzeit in der Leiste rechts. Die
  Rangfolge zwischen Marke und Eintrag bleibt damit sichtbar.
- Im hellen Modus ändert sich nichts — kein Pixel, kein Wert.
- Ausserhalb der Leiste ändert sich nichts: die Willkommensstrecke, der
  Kompass-Einstieg und die sekundären Knöpfe bleiben, wie sie sind.
