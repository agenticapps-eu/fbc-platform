---
reviewers: [codex]
models: [gpt-5.6-sol]
verdicts: [REQUEST-CHANGES]
stage: diff
---

# Diff review — event-detail-layout (AGE-531)

Acht Befunde. **Sechs übernommen, zwei teilweise** — und die beiden Teilweisen
sind die interessanten, weil ich sie im Browser gemessen habe statt sie
herzuleiten.

## Übernommen

**[HIGH] Leere Rasterspuren.** Bestätigt und behoben. Gemessen auf der
ausgeloggten Seite ohne Themen:

```
grid gap-4 md:grid-cols-2 lg:grid-cols-3 → 344px 344px 344px, kinderImDom: 1
grid gap-6 p-5 lg:grid-cols-[1fr_18rem]  → 711px 288px
```

React rendert für `null` kein Element, aber das RASTER rechnet weiter mit drei
Spalten: eine einzelne Karte blieb 344 px breit, während 700 px Spur daneben
leer standen. Beim vergangenen Event war es sichtbar hässlich — eine
Trennlinie und 288 px Leerraum rechts im Hero, weil `RegistrationPanel` dort
`null` liefert. Die Spaltenzahl folgt jetzt den tatsächlich vorhandenen
Blöcken, und der Hero rendert seine rechte Spalte nur, wenn sie etwas trägt
(`hatTeilnahmeBlock`). Ein Test hält beides fest.

**[MEDIUM] Die Teilnehmerzahl war verschwunden.** Bestätigt: vor dem Umbau
stand sie in der Definitionsliste, danach nur noch in der Teilnehmer-Karte —
und die gibt es ohne Session nicht. Ein ausgeloggter Besucher sah gar keine
Zahl mehr. Sie steht jetzt in der „Details"-Karte
(„6 Teilnehmer · Plätze unbegrenzt" / „0 von 12 Plätzen belegt"), unabhängig
von der Session. Test dafür.

**[MEDIUM] „Offen für alle Mitglieder" war doppelt falsch.** Ein
`public`-Event ist auch OHNE Session sichtbar, und der Satz vermischte
Sichtbarkeit mit Anmeldeberechtigung — die verlangt bei `members` zusätzlich
mindestens `discover` (`register_for_event`). Jetzt „Öffentlich sichtbar" bzw.
„Nur für Mitglieder sichtbar"; das Wort „sichtbar" hält die Zeile bei der
Frage, die sie beantwortet. Der Test prüft zusätzlich, dass die alte
Formulierung NICHT mehr auftaucht.

**[MEDIUM] Barrierefreiheit der Details-Zeilen.** Bestätigt: die Symbole sind
`aria-hidden`, die vorherige Fassung war eine `<dl>` mit sichtbaren
Beschriftungen. Ein Screenreader hörte nach dem Umbau nackte Werte. Jede Zeile
trägt jetzt eine `sr-only`-Beschriftung („Wann", „Wo", „Sichtbarkeit",
„Plätze").

**[MEDIUM] `truncate` in der Veranstalter-Karte.** Übernommen: mehrere Rollen
oder ein langer Firmenname wären in einer Drittel-Karte unlesbar
abgeschnitten. Jetzt `break-words`.

**[LOW] Brotkrume.** Übernommen: `aria-current="page"` am Titel, der Trenner
`›` mit `aria-hidden`.

## Teilweise übernommen

**[MEDIUM] Der Mock verwirft `select()`.** Der Befund stimmt genau: mein
Fixture-Update in `anon-anreicherung.test.ts` bewies gar nichts, weil der Mock
seine Felder unabhängig von der Projektion liefert. Übernommen — die Datei
zeichnete bereits Tabellennamen auf, jetzt auch Spalten, und ein Test verlangt
`company`, `roles`, `short_bio` bzw. `description`. **Mutationsprobe:** die
Spalten aus der Projektion entfernt → Test rot; zurück → grün.

**Nicht** übernommen wurde die Unterstellung, die erweiterte Projektion sei
ungeprüft. Sie ist gemessen, nur nicht dort: die Veranstalter-Karte zeigt in
der Sichtprobe die echten Werte aus der lokalen Datenbank („Vorstand · DK Real
Invest eG" samt Kurzbio). Ein Unit-Test mit Attrappe könnte eine nicht
existierende Spalte ohnehin nie finden — das kann nur eine echte Abfrage.

**[HIGH] „Die Tests prüfen nur Texte, nicht das Layout."** Der Kern stimmt und
wurde behoben: es gibt jetzt Tests für die Fälle, in denen Blöcke fehlen
(vergangenes Event ohne Teilnahme, Zahl ohne Session), und der Layout-Test
prüft die Spaltenklasse und die Kinderzahl des Hero — genau das, was vorher
niemand gesehen hätte.

**Nicht** übernommen wurde die Forderung nach browserbasierten
Screenshot-Tests. Es gibt in diesem Repo keine solche Infrastruktur, und sie
für einen Layout-Nachzug einzuführen ist ein eigener Change, kein Nebensatz.
Was stattdessen lief: die Sichtprobe im echten Browser über vier Zustände —
eingeloggt mit allem, ausgeloggt ohne Themen und ohne Host, vergangenes Event,
Telefon (390 px, kein Überlauf). Die beiden HIGH-Befunde oben stammen aus
genau dieser Probe, nicht aus einem Test. Das ist die ehrliche Lage: die
Sichtprobe ist hier die Prüfung, und sie ist nicht automatisiert.

## Danach

```
pnpm lint       0 Fehler
pnpm typecheck  sauber
pnpm test       653 Tests / 93 Dateien   grün   (vor dem Review: 650)
pnpm build      erfolgreich
```

Mutationsproben: fünf gezielte Änderungen (Sichtbarkeits-Satz, Kurzbio,
Rolle+Firma, Zeitspanne, Projektion) werden alle von je einem Test gefangen.
