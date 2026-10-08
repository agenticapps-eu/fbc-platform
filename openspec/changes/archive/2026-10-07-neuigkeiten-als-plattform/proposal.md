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

| Konto | heute  | nachher | Folge                |
| ----- | ------ | ------- | -------------------- |
| A     | **23** | **0**   | fällt aus der Liste  |
| B     | 18     | 18      | unverändert          |
| C     | 2      | 2       | unverändert          |
| D     | 1      | 1       | unverändert          |

Konto A stellt ausschliesslich Neuigkeiten zu und verschwindet damit aus der
Liste. Alle anderen bleiben, wie sie sind.

**Veranstaltungs-Ankündigungen zählen weiter mit, und das ist eine Entscheidung
und kein Versehen.** Der erste Entwurf dieses Changes hätte sie
mit ausgeschlossen. Der Kopf der ursprünglichen Migration hält aber fest:
„ENTSCHIEDEN am 25.08. (Donald): gezählt werden ALLE sichtbaren Beiträge, also
auch die `kind = 'event'`-Beiträge … ein Verein, der Veranstaltungen ausrichtet,
hält das Ausrichten für Aktivität." Diese Entscheidung bleibt stehen — sie
stillschweigend umzudrehen wäre an einer Beschwerde über Neuigkeiten vorbei
(Befund der Plan-Review, codex; bestätigt von Donald am 07.10.).

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

- „Die aktivsten Mitglieder" zählt Neuigkeiten der Plattform nicht mehr mit.
  Wer bisher nur wegen ihnen in dieser Liste stand, steht nicht mehr darin.
- Veranstaltungen zählen unverändert weiter: wer eine ausrichtet, ist aktiv.
- An den Neuigkeiten selbst ändert sich nichts: sie erscheinen wie bisher unter
  eff.bee.zee, und Likes und Kommentare bleiben, wie sie sind.
