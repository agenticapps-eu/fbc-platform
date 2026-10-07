# 0009 — Die Urheberschaft einer Produktmitteilung bleibt in den Daten

- Status: angenommen
- Datum: 2026-10-07
- Linear: AGE-1004

## Kontext

Produktmitteilungen („Neuigkeiten") erscheinen im Feed als gewöhnliche
`posts`-Zeile mit `kind = 'release'`. In `author_id` steht das Konto, das sie
zugestellt hat — nicht ihr Verfasser; verfasst hat sie die Plattform.

Auf PROD gemessen trugen **23 von 44** Beiträgen diesen `kind`, alle unter einem
einzigen Konto. „Die aktivsten Mitglieder" zählte sie mit, und dieses Konto
stand damit zwangsläufig an der Spitze einer Liste, die nach eigenen
Wortmeldungen fragt. Donald am 03.10.: „ich stehe da als aktivstes Mitglied
wegen den Release Notes."

Die Darstellung war zu diesem Zeitpunkt bereits richtig: die Karte zeigt seit
AGE-718 „eff.bee.zee" statt eines Mitgliedsnamens. Offen war nur die Zählung.

## Entscheidung

**`posts.author_id` bleibt unverändert** — `not null`, mit Fremdschlüssel, mit
dem zustellenden Konto darin. Die Urheberschaft bleibt in den Daten; sie wird
nur nicht angezeigt und nicht gezählt.

Die Zählung bekommt stattdessen eine Positivliste: `feed_top_authors` zählt
`kind in ('member', 'event')`.

## Warum nicht ein Plattform-Konto

Der naheliegende Weg wäre eine eigene Zeile in `profiles`, der die Neuigkeiten
gehören. Er ist abgelehnt, und der Grund ist strukturell und nicht ästhetisch:

**Eine Profilzeile ist eine Mitgliedszeile.** Sie stünde sofort in
`profiles_public`, also im Mitgliederverzeichnis, in der Suche, im
Matching, in jeder Zählung über Mitglieder und in jeder Liste, die es heute gibt
oder morgen geben wird. Jede einzelne dieser Stellen müsste sie fortan
ausnehmen — und jede neue Stelle, die jemand baut, müsste daran denken. Das ist
die Sorte Ausnahme, die man nicht zu Ende pflegt: sie wird an fünf Stellen
gemacht und an der sechsten vergessen, und dann steht ein Konto im Verzeichnis,
das kein Mensch ist.

Die abgelehnte Alternative verschiebt also **eine** Änderung an einer Zählung in
**n** Ausnahmen an n Flächen.

## Die zweite abgelehnte Alternative

Eine Spalte `absender` auf `posts`. Sie wäre eine zweite Wahrheit über dieselbe
Sache — die Art des Beitrags steht schon in `kind`, und zwei Felder, die
dieselbe Frage beantworten, laufen auseinander. Welches dann gilt, entscheidet
die Stelle, die zuletzt geschrieben wurde.

## Was diese Entscheidung NICHT ändert

**Veranstaltungs-Ankündigungen zählen weiterhin mit.** Das ist eine
ausdrückliche Entscheidung vom 25.08. („ein Verein, der Veranstaltungen
ausrichtet, hält das Ausrichten für Aktivität"), und die Beschwerde, die
AGE-1004 ausgelöst hat, betraf Neuigkeiten. Der erste Entwurf hätte sie
stillschweigend umgedreht; der Befund kam aus der Plan-Review und wurde am
07.10. von Donald bestätigt.

Dass die Bedingung eine **Positivliste** ist und keine Ausschlussliste, folgt
derselben Logik wie die Entscheidung oben: eine vierte Beitragsart, die jemand
später einführt, wird still ausgelassen statt still mitgezählt. Von den beiden
stillen Richtungen bringt nur eine den Fehler zurück.

## Folgen

- Ein Konto, das nur Neuigkeiten zustellt, verschwindet aus „Aktivste
  Mitglieder". Auf PROD betrifft das genau eines; alle anderen Zahlen bleiben.
- Die Urheberschaft bleibt nachvollziehbar: wer wissen will, wer zugestellt
  hat, findet es in den Daten.
- **Offen und bewusst getrennt:** `recompute_potential_score` zählt dieselben
  Beiträge als „eigenes Engagement" mit. Gemessen verlöre ein Konto 23 von 32
  Aktivitätspunkten. Das ist derselbe Denkfehler an einer zweiten Stelle und
  steht als AGE-1035 — ein Score, den ein Mitglied auf seinem Dashboard sieht,
  ändert man nicht als Nebenwirkung eines anderen Changes.
