# Die Redaktion wird ein Reiter, die Spalte seitenweit, die Vorschau ein Streifen

Linear: **AGE-677**

## Why

Donald hat am 01.09. mit einem Screenshot drei Dinge an `/academy` benannt,
Stunden nachdem AGE-629 dort eine Filterspalte eingezogen hat. Zwei davon sind
dieselbe Ursache.

**Die Spalte ist nicht seitenweit.** Gemessen an `AcademyPage.tsx` (`b50b975`):
die `FilterSpalte` steckt **im Reiterinhalt von „Alle"**
(`<GeteilteVideos uid={uid} mitFilter />`, Zeile 103), nicht um die Seite. Sie
beginnt deshalb erst unter dem Redaktionsblock **und** der Reiterzeile — im
Screenshot rund 900 px weit unten, was sich als Kasten neben einer Liste liest
und nicht als Seitenspalte. Und **„Meine Academy" hat gar keine**, weil dort
`<MeineAcademy uid={uid} />` ohne `mitFilter` steht.

Die Referenz macht es anders: bei der Aktivität umspannt das Raster den
**ganzen** Inhalt und die Spalte sitzt in Zeile 1
(`CommunityFeed.tsx:313`, `lg:grid-cols-[minmax(0,1fr)_16rem]`).

**Die Redaktion gehört in die Reiterzeile.** Donalds Begründung ist
Konsistenz — auf den anderen Flächen trägt die Reiterzeile die Sichten. Heute
ist die Redaktion ein `<section>` **über** den Reitern.

Das ist zugleich die Reparatur der Spalte: wandert der Block in einen Reiter,
steht über der Reiterzeile nur noch der Hero, und das Raster kann Reiterzeile
und Inhalt gemeinsam umspannen.

**Die Vorschau ist zu hoch.** `VideoEmbed` läuft in `aspect-video` und steht
**über** Titel und Text. Im Screenshot nimmt die Vimeo-Lektion mit
Einwilligungstor über 400 px ein, bevor der Titel kommt — bei drei Lektionen
füllt der Block eine ganze Seite.

## What Changes

- **Die Redaktion wird der dritte Reiter**, hinter „Alle" und „Meine Academy".
  Startreiter bleibt „Alle" (Donald, 01.09.).
- **Die Filterspalte umspannt die Seite** statt eines Reiterinhalts: ein Raster
  um Reiterzeile und Inhalt, die Spalte in Zeile 1, mit denselben vier
  Sticky-Bedingungen wie bisher — sie stehen bereits in `FilterSpalte`.
- **Die Redaktionskachel wird ein Streifen**: Video links, Titel und
  Beschreibung rechts daneben statt darunter.
- **Die Spalte richtet ihre Felder nach dem aktiven Reiter.** Suche und
  Sortierung wirken auf `posts`; die Redaktion ist eine Konstante im Code und
  wird nicht gefiltert.

## Impact

- `src/pages/AcademyPage.tsx` — Reiterzeile, Rasterrahmen, Kachelanordnung
- `openspec/specs/academy-library/spec.md` — drei Anforderungen berührt
- Kein Schema, keine Rechte, keine Sichtbarkeit. **Reine UI** — nach Donalds
  stehender Regel ohne Fremdreviewer und ohne 2b-Plan-Review.
- `VideoEmbed` wird **nicht** angefasst: sein `max-w-2xl`-Deckel trägt einen
  eigenen, dokumentierten Grund (eine 1300 px breite Beitragskarte machte
  daraus 733 px Höhe). Der Streifen ist eine Anordnung der Academy-Kachel.
