# Evidence — C8 (AGE-531)

Gemessene Belege, nicht behauptete. Jeder Abschnitt nennt, **wogegen** gemessen
wurde und **was vorher anders war**.

---

## 1 · Ausgangsmessung (vor der ersten Zeile Code)

```
pnpm test                 615 Tests / 90 Dateien   grün
supabase test db --local  315 Tests (rls 310 + grants 5)   grün
```

## 2 · Vorabmessung gegen PROD — nur lesend

Befund aus dem Plan-Review (codex, MEDIUM): „`not null` ist nur aus DEV
abgeleitet." Beantwortet, bevor die Migration geschrieben wurde.

```
$ infisical run --env=prod -- tsx scripts/probe-c8-starts-at-preflight.ts
Zielprojekt: viwntbodrtqxgmqyxluh — NUR LESEND

### events: gesamt / ohne starts_at
  {"gesamt":0,"ohne_starts_at":0}
### events: bestehende Check-Constraints
  events_visibility_check  CHECK ((visibility = ANY (ARRAY['public','members'])))

ERGEBNIS: `alter column starts_at set not null` laeuft in PROD durch.
```

**PROD hat null Events.** DEV hatte 9, davon 0 ohne Termin. Und: die toten
Werte `prime`/`legacy` sind in **beiden** Projekten längst weg — die Aufgabe
aus AGE-531 entfiel, sie wurde nicht vergessen.

## 3 · RED → GREEN, Datenbank

**RED** (vor den Migrationen):

```
psql:supabase/tests/rls_test.sql:2259: ERROR:  column "cover_path" of relation "events" does not exist
Failed 31/341 subtests
```

**GREEN** (nach den drei Migrationen):

```
rls_test.sql ..... ok
grants_test.sql .. ok
All tests successful.  Files=2, Tests=347
```

315 → 347, also **32 neue Zusicherungen**. `grants_test.sql` blieb grün wie
vorhergesagt — dieser Change legt keine neue Tabelle an, und die
Spalten-Grants-Assertion führt `events` nicht.

### Ein Testwert war falsch, nicht der Code

Erster GREEN-Lauf: `Failed test 319: "… der Host dagegen alle fünf" have: 4 want: 5`.

Der Code hatte recht: das Opt-out steht **auch vor dem Host**, weil er die
Zeile ohnehin über die unveränderte `regs_select_self_or_host` sieht. Die
Erwartung wurde auf 4 korrigiert **und** um eine zweite Zusicherung ergänzt,
damit „4" nicht zufällig stimmt: der Host sieht genau die Wartelisten-Zeile,
die dem Nicht-Host fehlt.

## 4 · RED → GREEN, Datenschicht

```
RED:   TypeError: selectSimilarEvents is not a function   → 9 failed | 10 passed
GREEN: 19 passed
```

## 5 · Der Nachweis, den AGE-531 verlangt

`scripts/probe-event-cover-signatur.ts`, gegen den **lokalen** Stack, durch die
echte Storage-API — nicht durch die Datenbank:

```
### Signaturen (Bucket event-covers, Lauf 398a3edf)

  OK   1. anon · Cover eines PUBLIC-Events: Signatur=ja Abruf=200
  OK   2. anon · Cover eines MEMBERS-Events: verweigert: Object not found
  OK   3. bestätigtes Mitglied · MEMBERS-Event: Signatur erteilt
  OK   4. eingeloggt, NICHT bestätigt · PUBLIC-Event: verweigert: Object not found
  OK   5. verwaistes Objekt (keine events-Zeile): verweigert: Object not found
  OK   6. fremder Pfad an eigenem PUBLIC-Event (Diebstahl): anon=verweigert dieb=verweigert

### Bucket-Grenzen (Dienst, nicht Datenbank)

  OK   7. Upload über 2 MiB: abgelehnt: The object exceeded the maximum allowed size
  OK   8. Upload, der kein WebP ist: abgelehnt: mime type image/png is not supported

### Abbau

  OK   Objekte dieses Laufs entfernt: 4 gelöscht, 0 übrig

ALLE PRUEFUNGEN ERFUELLT
```

Fall 2 ist der Abnahmepunkt. Fall 6 ist der HIGH-Befund aus dem Plan-Review.
Fälle 7 und 8 kann pgTAP nicht messen — die Grenzen sitzen im Storage-Dienst.

## 6 · Zwei Befunde, die erst die Sichtprobe fand

Beide unsichtbar für jeden Test in dieser Suite. Genau deshalb gibt es die
Sichtprobe.

### 6.1 Der Zuschnitt-Dialog war in der Karte gefangen

Der Zuschnitt sitzt in den Host-Werkzeugen, also in einer `Card`.
`.fbc-card:hover` setzt `transform: translateY(-2px)` (`src/index.css:246`), und
ein transformierter Vorfahre wird zum Containing Block für `position: fixed`.

Gemessen im Browser:

```
vorher:  { overlay: { x: 289, y: -654, w: 1063, h: 1272 },
           transformierterVorfahre: "fbc-card …", elternIstBody: false }
nachher: { overlay: { x: 0,   y: 0,    w: 1385, h: 1000 },
           transformierterVorfahre: null,        elternIstBody: true }
```

Behoben durch ein Portal an `document.body` in `AvatarCropper`. jsdom kennt kein
Layout und hätte das nie gesehen.

### 6.2 `upsert: true` kann in diesem Bucket nie funktionieren

```
upload mit upsert:  FEHLER new row violates row-level security policy
upload ohne upsert: ok
```

`upsert` wird zu `insert … on conflict do update`, und ON CONFLICT verlangt
Leserecht auf die Zeile. Lesen entscheidet `event_cover_lesbar()`, und die
verneint für ein Objekt, auf das noch **kein** Event zeigt — beim Hochladen
immer der Fall. Der App-Code nutzt bereits `upsert: false`; die Begründung steht
jetzt dort, statt als Zufall dazustehen.

### 6.3 Der leere Platzhalter drückte den Titel unter die Falz

Ein 3:1-Platzhalter ist auf einer 1100 px breiten Seite rund 370 px leerer
Verlauf — und ohne Titelbilder ist das zum Start der Normalfall. Auf der
Detailseite jetzt ein flaches Band, in der Kachel unverändert 16:9 (dort stehen
bebilderte und unbebilderte Events nebeneinander).

## 7 · Sichtprobe am laufenden Stack

Lokaler Stack, eigene Daten, Chrome.

| Geprüft                 | Ergebnis                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Übersicht, breit        | drei Kacheln je Reihe, Datumsmarke, Von–Bis, Ort, Teilnehmerzahl                                                                                 |
| Übersicht, ausgeloggt   | nur das `public`-Event, Konsole sauber                                                                                                           |
| Detailseite             | Titelbild mit Datumsmarke, Von–Bis, Beschreibung, Themen als Häkchenliste, Veranstalter, ähnliche Events                                         |
| **Teilnehmerreihe**     | **Teilnehmer (6), aber nur 5 Gesichter + „+1"** — das fehlende ist das Opt-out-Konto, das in den Host-Werkzeugen als „Mitglied" ohne Namen steht |
| Bild hochladen          | Zuschnitt 3:1 → WebP → `{uid}/…` → signierte URL → Header. Pfad trägt die uid des Hosts                                                          |
| Bearbeiten-Formular     | alle Felder vorbelegt (die `useState(initial)`-Falle aus AGE-492 greift hier nicht)                                                              |
| Anmelden                | Teilnehmer 6 → 7, „+1" → „+2" — die Invalidierung des neuen Schlüssels greift                                                                    |
| Abmelden                | 7 → 6, „+2" → „+1", Knopf zurück auf „Anmelden"                                                                                                  |
| Ausgeloggt, Detailseite | Titel da, **keine** Teilnehmerreihe, **kein** Host-Block, keine `42501`                                                                          |
| Telefon (390 px)        | einspaltig, `scrollWidth == clientWidth`, 0 Elemente über dem Rand                                                                               |
| Variante `navy`         | trägt, nichts bricht                                                                                                                             |

## 8 · Abschlussmessung

```
pnpm lint       0 Fehler (4 Bestandswarnungen, unverändert)
pnpm typecheck  sauber
pnpm test       643 Tests / 93 Dateien   grün   (Ausgang: 615 / 90)
pnpm build      erfolgreich
supabase test db --local   347 Tests   grün   (Ausgang: 315)
```
