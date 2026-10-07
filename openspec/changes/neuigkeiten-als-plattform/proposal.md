# Neuigkeiten kommen von der Plattform, nicht von einem Mitglied

Linear: **AGE-1004**

## Why

Donald am 03.10.: „ich stehe da als aktivstes Mitglied wegen den Release Notes,
das soll nicht unter meinem Namen released werden, sondern von der Plattform
selber, also eff.bee.zee."

Auf PROD gemessen, heute:

| `kind`    | Beiträge | Konten |
| --------- | -------- | ------ |
| `release` | **23**   | **1**  |
| `member`  | 14       | 3      |
| `event`   | 7        | 1      |

Dreiundzwanzig von vierundvierzig Beiträgen sind Neuigkeiten unter **einem**
Konto. „Die aktivsten Mitglieder" zählt alle Beiträge ohne Rücksicht auf ihre
Art — dieses Konto steht damit zwangsläufig an der Spitze, und zwar für Arbeit,
die niemand als Wortmeldung gemeint hat.

Die Wirkung, vorher und nachher gegen PROD gerechnet:

| Konto | heute  | nachher | Folge                    |
| ----- | ------ | ------- | ------------------------ |
| A     | **23** | **0**   | fällt aus der Liste      |
| B     | 18     | 11      | verliert 7 Ankündigungen |
| C     | 2      | 2       | unverändert              |
| D     | 1      | 1       | unverändert              |

Konto A schreibt ausschliesslich Neuigkeiten. Konto B hat neben elf eigenen
Beiträgen sieben erzeugte Veranstaltungs-Ankündigungen — auch das sind keine
Wortmeldungen. Nach der Änderung steht in der Liste, was Mitglieder wirklich
geschrieben haben: 11, 2, 1.

## Der Umfang ist viel kleiner, als er aussah — zweimal gemessen

Die erste Lesart dieses Vorgangs war, dass auch die **Karte** im Feed den
Mitgliedsnamen zeigt. Das war falsch, und es ist zweimal nachgemessen worden:

1. Die Spec sagt es längst — „Die Release-Karte nennt keinen Autor" verlangt
   wörtlich weder Name noch Avatar und `eff.bee.zee` als Absender.
2. Der Code tut es längst. `feed.ts` ersetzt bei `kind = 'release'` den Autor
   durch den Absender der Anwendung: Name `eff.bee.zee`, kein Bild. Gebaut mit
   AGE-718 am 11.09.

Es gibt also **keinen Delta auf die Darstellung** und keine Oberflächenarbeit.
Wer hier eine sucht, hat dieselbe Abzweigung genommen.

Dieselbe Messung für die übrigen Flächen, nachdem am 07.10. entschieden wurde,
die Absenderzeile solle **überall** `eff.bee.zee` sein:

| Fläche                           | zeigt einen Mitgliedsnamen?                        |
| -------------------------------- | -------------------------------------------------- |
| Neuigkeiten-Karte im Feed        | nein — schon seit AGE-718                           |
| `/neues`, Glocke, Hinweis-Dialog | nein                                                |
| Blog                             | nein — trägt überhaupt keine Autorenzeile           |
| Zustell-Mails für Neuigkeiten    | **existieren nicht** — alle sechs Mail-Funktionen sind transaktional, ihr Absender ist eine konfigurierte Adresse |
| **„Die aktivsten Mitglieder"**   | **ja — über die Zählung. Das ist der ganze Vorgang.** |

Die Entscheidung vom 07.10. ist damit für jede Fläche ausser der Zählung bereits
erfüllt. Sie steht trotzdem im Vorgang, damit sie für einen künftigen
Neuigkeiten-Versand von Anfang an gilt.

## What Changes

- „Die aktivsten Mitglieder" zählt nur noch, was Mitglieder selbst geschrieben
  haben. Neuigkeiten und erzeugte Veranstaltungs-Ankündigungen zählen nicht
  mehr mit.
- Wer bisher nur wegen der Neuigkeiten in dieser Liste stand, steht nicht mehr
  darin — und wer dort steht, steht für eigene Beiträge.
- An den Neuigkeiten selbst ändert sich nichts: sie erscheinen wie bisher unter
  eff.bee.zee, und Likes und Kommentare bleiben, wie sie sind.
