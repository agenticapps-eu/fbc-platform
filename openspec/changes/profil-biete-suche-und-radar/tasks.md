# Tasks — Profilseite (AGE-597)

> Fassung nach dem Plan-Review. Die erste unterschied die Sorten an `category`
> statt an `source` und wollte Bestandstexte als Fixtures nehmen. Siehe
> `REVIEWS.md`.

## 1. Prüfmaterial — ohne PII

> Erledigt vor dem ersten Test: `scripts/probe-age597-kompass-bestand.ts`
> misst den Bestand und gibt **nur Zahlen** aus. Es hat drei Annahmen des
> Proposals widerlegt (Kürzung mit Auslassungszeichen statt mitten im Wort,
> elf statt sechs Marken, null statt vier eigenständige Titel) und die
> unscharfe Wortgrenzen-Regel als zu gierig entlarvt (81 statt 61 Treffer).

- [x] 1.1 Fixtures **selbst schreiben**, nicht aus dem Bestand kopieren. Das
      Repo ist öffentlich; wörtliche Mitgliedertexte tragen Firmen, Orte, URLs
      und identifizierende Formulierungen, auch ohne Klarnamen. Nachgebildet
      werden die **Formen**, nicht die Inhalte: `chip`-Zeile · `chip`-Zeile mit
      Beschreibung · `chip` mit unbekannter Kategorie · `editor` mit
      Präfix-Titel · `editor` mit eigenständigem Titel · `editor` mit
      `'-`-Artefakt · `editor` mit 1048 Zeichen · Titel mit Auslassungszeichen
      gekürzt · ein Abschnitt mit sieben Marken (gemessener Höchstwert je Reihe: sechs).
- [x] 1.2 Die Bestandsprüfung aus 4.1 erzeugt **keine** Screenshots im Repo und
      keine Notizen mit Klartext. Befunde werden als Zahl und Regel notiert.

## 2. Tests (RED vor GREEN)

- [x] 2.1 `source = 'chip'`: Marke mit Klartext, **kein** roher Schlüssel,
      **kein** zusätzlicher Titel.
- [x] 2.2 `source = 'chip'` **mit** Beschreibung: Marke **und** Text erscheinen.
      Deckt den Fall ab, den der Editor erzeugen kann und den `category` als
      Unterscheider verdeckt hätte.
- [x] 2.3 Unbekannte Kategorie: **keine** Marke, kein `Future_key`.
- [x] 2.4 Sieben Marken (über dem gemessenen Höchstwert sechs) stehen in einer Reihe und laufen bei schmalem Fenster um,
      statt die Karte zu sprengen (gemini HIGH).
- [x] 2.5 `source = 'editor'`: Beschreibung mit Zeilenumbrüchen.
- [x] 2.6 Präfix-Titel entfällt — auch der mit Auslassungszeichen gekürzte, der
      kein zeichengleiches Präfix ist. Eigenständiger Titel bleibt.
- [x] 2.7 `'-` verschwindet aus der Anzeige, in Titel **und** Beschreibung.
- [x] 2.8 1048-Zeichen-Fall bleibt im Abschnitt.
- [x] 2.9 Fremde Profilansicht zeigt keinen Erfolgsradar, **auch** mit gesetzten
      Themen-Scores.
- [x] 2.10 Videos erscheinen weiterhin nach den Eckdaten.
- [x] 2.11 Die zwei bestehenden Tests, die den Radar als Beleg für die
      Discover-Sichtbarkeit benutzen, werden auf ein anderes erweitertes Feld
      **umgestellt**, nicht gelöscht. Sonst fällt mit der Anzeige die
      Zugriffszusage weg.

## 3. Umsetzung

- [x] 3.1 `MatchingList` teilt nach `source` und rendert zwei Formen.
- [x] 3.2 Klartext über den vorhandenen `categoryLabel`-Helfer; für unbekannte
      Schlüssel die Marke unterdrücken statt den Fallback zu zeigen. Keine
      zweite Kategorienliste (bestehende Anforderung).
- [x] 3.3 Artefakt-Abschnitt beim Darstellen, ohne Schreibzugriff.
- [x] 3.4 Radar-Block **samt seiner Abfrage** aus `PublicProfilePage` entfernen.
      Tabelle und Berechnung bleiben.
- [x] 3.5 Den Hinweistext für die eingeschränkte Ansicht ändern — er verspricht
      heute den Erfolgsradar „ab der Discover-Stufe".

## 4. Abnahme über den ganzen Bestand

- [x] 4.1 **Nicht an einem Profil**: alle Profile mit Kompass-Einträgen im
      Browser durchsehen und auf Ausreißer prüfen — überlaufende Marken,
      abgeschnittene Texte, leere Abschnitte. Donalds ausdrückliche Vorgabe.
- [x] 4.2 Vorher/nachher am gemeldeten Profil, mit Zahlen (Höhe des Abschnitts,
      Zahl der Kästen).
- [x] 4.3 `pnpm test` grün, `tsc` sauber, `eslint` ohne Fehler.
- [x] 4.4 Mindestens eine Mutation je neuem Test.

## Belege

Alle Zahlen in `MESSUNG.md`. Kurz:

- 4.1 rechnerisch über **alle 97** gefüllten Abschnitte (0 würden leer) plus
  Browser-Sichtprobe an den Extremwerten bei 1370 und 375 px.
- 4.2 vorher/nachher bei gleichen Daten: 677→298 px und 468→233 px, 12→0 Kästen,
  Radar 210→0 px **trotz gesetzter Scores**, Seite 2994→2146 px.
- 4.3 `vitest run` 1661 grün, `tsc --noEmit` sauber, `eslint` ohne Fehler.
- 4.4 zwölf Mutationen, jede färbt mindestens einen Test rot.

## Zweite Runde — nach der Code-Review auf den Diff

- [x] 5.1 Marke hängt an der **Kategorie**, nicht an `source` — der Editor
      verlangt für jede Zeile eine, und `source` überlebt das Speichern.
- [x] 5.2 Titel entfällt, wenn er den **Klartext der Kategorie** wiederholt,
      nicht schon deshalb, weil die Zeile `chip` ist.
- [x] 5.3 Karte hängt daran, ob **etwas erscheint** — keine Überschrift über
      nichts mehr; der Test, der den Gegenzustand festhielt, ist umgedreht.
- [x] 5.4 `.test()` auf einem `/g`-Regex im Prüfskript beseitigt.
- [x] 5.5 Prüfskript ruft `kompassAnzeige`, statt die Blöcke nachzubauen.
- [x] 5.6 Falsche Zeile zu `AngeboteGesuchePage` in `REVIEWS.md` richtiggestellt.
- [x] 5.7 Mutationen erneut: **zwölf**, jede rot, davon drei auf die neuen
      Zusagen (Marke ohne `source`, Titel erhalten, Karte entfällt).
- [x] 5.8 Sichtprobe wiederholt: chip mit eigenem Titel zeigt Marke **und**
      Satz, editor mit Kategorie zeigt Marke **und** Text, `zeitreisen` nirgends,
      kein Überlauf, keine waagerechte Scrollleiste.
