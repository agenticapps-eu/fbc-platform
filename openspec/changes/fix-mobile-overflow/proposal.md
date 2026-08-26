# Kein seitliches Schieben auf schmalen Geraeten

## Why

Linear: **AGE-584** (Urgent, Go-Live August 2026). Befund Donald am 24.08. beim
Testen: bei schmalen Breiten laufen Karten ueber den Bildschirm hinaus, die
Seite laesst sich seitlich schieben.

**Die Schriftgroesse ist nicht die Ursache.** Das stand schon im Issue und die
Messung bestaetigt es: eine Spalte, die auf `10rem` festgenagelt ist, bleibt
160 px breit, egal wie klein der Text darin ist. Schriftgroessen fuer schmale
Geraete sind eine eigene, berechtigte Frage — hier nicht.

### Gemessen am 26.08. bei 320 px, eingeloggt, auf echten Daten

Gemessen wurde je Element am eigenen Rechteck (`getBoundingClientRect().right`
gegen die Viewport-Breite) und am eigenen Inhaltsbedarf
(`scrollWidth − clientWidth`) — **nicht** allein an
`documentElement.scrollWidth`. Der hat in diesem Repo schon einmal „passt"
gemeldet, wo 339 px echter Bedarf bestand.

| Route | Ueberlauf bei 320 px | gemessene Ursache |
|---|---|---|
| `/` | **114 px** | `truncate` in Karten, deren Grid-Eltern `min-width: auto` behalten |
| `/mitglieder` | **39 px** | dasselbe Muster, `h3.truncate` in den Mitgliederkarten |
| `/profil/bearbeiten` | **102 px**, nur mit Daten | feste Spalten `10rem` / `5rem` ohne Breakpoint |
| `/admin/mitglieder` | 0 im Dokument, Tabelle intern bis +282 px | das einzige `<table>` im Projekt |
| `/aktivitaet` `/events` `/events/:id` `/profil` `/chat` `/einstellungen` `/admin` `/p/:id` `/mitgliedschaft` | 0 | — |

### Zwei Mechanismen, nicht zehn Symptome

**Erstens: `truncate` kehrt sich ohne `min-w-0` in sein Gegenteil um.**
Tailwinds `truncate` ist `overflow:hidden; text-overflow:ellipsis;
white-space:nowrap`. Kuerzen kann es nur, wenn es eingeengt wird. Flex- und
Grid-Kinder stehen aber per Voreinstellung auf `min-width: auto` und schrumpfen
deshalb **nicht** unter ihren Inhalt. Statt zu kuerzen, **fordert** der
nowrap-Text seine volle Breite und drueckt die Karte auf.

Auf `/` gemessen: die Karte steht auf **418 px** in einem **288 px** breiten
Container. Belegt mit einer Probe in beide Richtungen — `min-width: 0` auf die
Grid-Kinder gesetzt: Dokumentbreite faellt von 434 auf **320**, also exakt
Viewport, und **kein** weiteres Element laeuft danach noch ueber. Wieder
zurueckgenommen: 434. Die Aenderung ist damit die Ursache, nicht ein Zufall
daneben.

**Zweitens: feste Spalten ohne Breakpoint.** In `ProfilPage.tsx:345` und `:390`
gelten `grid-cols-[10rem_1fr_auto]` bzw. `grid-cols-[10rem_1fr_5rem_auto]` auch
bei 320 px. Aufgeloest ergibt das `160px 26px 91px` bzw.
`160px 26px 80px 91px`.

**Die `1fr`-Spalte faellt auf 26 px zusammen — das ist das Eingabefeld.** Es ist
auf dem Telefon unbenutzbar, bevor ueberhaupt etwas ueberlaeuft. Der Ueberlauf
ist hier das kleinere von zwei Problemen.

### Was der Plan-Review am Plan korrigiert hat

Der erste Entwurf sah vor, `min-w-0` auf **die Karten** zu setzen. Gemini hat
angemerkt, das gehoere auf das direkte Grid-Kind, nicht auf die Karte darin. Am
Code nachgemessen — und der Einwand traegt, an einer Stelle sogar staerker als
gemeldet.

Auf `/` **ist** die Karte das Grid-Kind; dort waere der Plan aufgegangen. Auf
`/mitglieder` nicht: `Stagger` rendert das Raster, und `StaggerItem` schiebt ein
**eigenes `motion.div` dazwischen**. Die gemessene Kette:

| Glied | Breite | `min-width` |
|---|---|---|
| `h3.truncate` | 225 | `0` — schon richtig |
| `div.min-w-0.flex-1` | 225 | `0` — schon richtig |
| `div.flex.items-start.gap-3` | 293 | **`auto`** |
| `div.fbc-card` | 343 | `0` |
| `div.h-full` ← `StaggerItem`, das **Grid-Kind** | 343 | **`auto`** |
| `div.grid.sm:grid-cols-2` | 288 | — |

Jemand hat das Muster innen bereits richtig angewandt und die zwei aeusseren
Glieder uebersehen. Die Probe entscheidet, welches traegt:

| Eingriff | `documentElement.scrollWidth` |
|---|---|
| vorher | 359 |
| nur das Grid-Kind (`StaggerItem`) | **320** |
| nur das innere Flex-Div | 359 — wirkungslos |
| zurueckgenommen | 359 |

**Der erste Plan haette `/mitglieder` nicht repariert.** Gefunden vor der ersten
Codezeile, wo eine Korrektur nichts kostet — genau wofuer Schritt 2b da ist.

Daraus folgt ausserdem eine kleinere Reparatur als geplant: `StaggerItem` ist an
vier Stellen im Einsatz, **drei davon als Rasterkind**. Ein `min-w-0` im Wrapper
selbst ist eine Zeile statt drei Aufrufstellen und verhindert die Wiederkehr.
(Die vierte Nutzung steht in einem Blocklayout, wo `min-width: auto` ohnehin 0
ergibt; die dritte, `MeineChancenPage`, ist toter Code — `/meine-chancen` leitet
auf `/` um.)

### Was die Messung am Issue korrigiert

Das Issue fuehrt `ProfilPage.tsx:345/390` als offene Wunde. Beide Zeilen
rendern aber nur, wenn Interessen bzw. Ziele **vorhanden** sind. Ein Profil ohne
beides misst sich sauber. Der Fehler ist **latent**, nicht abwesend — eine
einzige Interessenzeile macht 334 px, eine Zielzeile dazu 422 px. Wer nur
durchklickt, findet ihn nicht.

Das Issue vermutet ausserdem fehlendes `min-w-0` breit gestreut („nur 19 von 81
Komponentendateien"). Die Messung zeigt: die blosse Zahl traegt nichts. Von den
dreizehn geprueften Routen laufen **drei** ueber, und beide Male ist es
dasselbe Zusammenspiel aus `truncate` und einem Grid-Kind ohne `min-w-0`. Wir
reparieren die gemessenen Stellen, nicht 62 Dateien auf Verdacht.

## What Changes

- **Eine Mindestbreite festschreiben: 320 px.** Darunter wird nicht
  unterstuetzt. Ohne diese Zahl ist „laeuft ueber" keine pruefbare Aussage.
- **Die gemessenen Stellen reparieren** — `min-w-0` auf die Grid-Kinder, die
  kuerzenden Text tragen; die zwei festen Spaltensaetze hinter einen Breakpoint,
  darunter gestapelt.
- **Die Admin-Tabelle** bekommt einen scrollbaren Rahmen, damit sie auf dem
  Telefon bedienbar bleibt, statt die Seite zu schieben.
- **Den Defekt wegkonstruieren:** `min-w-0` in die zwei geteilten Bausteine,
  durch die beide gemessenen Faelle laufen — `Card` und `StaggerItem`.
- **Ein schmaler Waechter** im Testlauf verbietet feste Rasterspalten ohne
  Breakpoint. Er laeuft in `pnpm test` und damit in CI mit.

## Was hier NICHT geprueft wird, und warum

Der urspruenglich geplante zweite Waechter ist **gestrichen**. Er sollte
kuerzenden Text mit dem naechsten Rasterkind darueber verbinden; der Plan-Review
hat gezeigt, dass er keinen der beiden gemessenen Faelle sieht, weil dazwischen
jeweils eine Komponentengrenze liegt. Siehe `REVIEWS.md`.

An seine Stelle tritt die Konstruktion: traegt der geteilte Baustein selbst
`min-width: 0`, kann das Muster an den Aufrufstellen nicht mehr entstehen.

**Was damit ungedeckt bleibt, offen gesagt:** eine Flaeche, die weder `Card`
noch `StaggerItem` benutzt. Das Repo hat nur `jsdom`, und jsdom rechnet kein
Layout — es kann Breiten gar nicht messen. Die Ergebnismessung bleibt deshalb
Handarbeit und ist in diesem Change als Browser-Beleg bei 320/375/414 px in
beiden Themes gefuehrt, nicht als wiederkehrender Lauf. Der Folge-Vorgang dafuer
ist Aufgabe 6.3.

## Impact

- Betroffene Faehigkeit: `design-system` (neue Anforderung, keine bestehende
  geaendert). Die vorhandene Anforderung *„Content uses the available width"*
  regelt ausschliesslich **breite** Fenster und Kappungen bei 1440/760 px; die
  untere Grenze kommt darin nicht vor. Die neue Anforderung ergaenzt sie und
  widerspricht ihr nicht.
- Betroffene Dateien: `HomePage.tsx`, `MemberDirectory.tsx`, `ProfilPage.tsx`,
  `AdminMitgliederPage.tsx`, plus ein neuer Test.
- Keine Migration, keine Edge Function, kein Schema.

## Nicht in diesem Change

- Schriftgroessen fuer schmale Geraete — eigene Entscheidung, siehe Issue.
- Eine Browser-gestuetzte Ueberlaufmessung in CI — als Folge-Issue notiert.
- Der `h1` auf `/mitgliedschaft`, dessen Inhalt 134 px breiter ist als seine
  Box, ohne die Seite zu schieben. Gemessen, aber ein anderer Fehler
  (Textumbruch, kein Layout-Ueberlauf) — eigener Vorgang.
