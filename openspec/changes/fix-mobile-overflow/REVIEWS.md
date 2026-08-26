# Plan-Review — fix-mobile-overflow (AGE-584)

Datum: 2026-08-26. Gegenstand: der **Plan**, vor der ersten Codezeile.
Zwei Reviewer, beide von anderen Anbietern als der Autor des Deltas.

| Reviewer | Anbieter | Verdikt |
|---|---|---|
| gemini 0.28.2 | Google | APPROVE, 4 Befunde |
| opencode 1.18.7 | (fremd) | **REJECT**, 8 Befunde |
| codex-cli 0.145.0 | OpenAI | lief zum Zeitpunkt des Schreibens noch — Ergebnis unten nachgetragen, wenn es eintrifft |

Ein drittes Werkzeug (`cursor-agent`) war nicht nutzbar: es verlangt ein
interaktives Login, das aus dieser Umgebung heraus nicht geht.

## Was der Review am Plan geaendert hat

**Der Plan war in vier Punkten falsch. Alle vier wurden am Code nachgeprueft,
nicht geglaubt.**

### 1. Falsche Datei (gemini indirekt, opencode direkt) — BESTAETIGT

`tasks.md` 3.1 nannte `HomePage.tsx`. `HomePage()` gibt aber eingeloggt
`<MemberDashboard>` zurueck (`HomePage.tsx:33-34`); die gemessene Karte ist
`DashTile` in `MemberDashboard.tsx:393/408`. Die Reparatur waere in einer Datei
gelandet, die ein eingeloggtes Mitglied nie sieht, und der Beleg haette sofort
wieder 114 px gemessen.

Erschwerend: ich hatte das waehrend der Messung selbst gesehen und **nicht** in
den Plan nachgezogen.

### 2. `min-w-0` an der falschen Stelle (gemini) — BESTAETIGT und vermessen

Siehe `proposal.md`. Auf `/mitglieder` ist das Grid-Kind der
`StaggerItem`-Wrapper, nicht die Karte. Gemessen: Karte 359 → 359 (wirkungslos),
Wrapper 359 → 320.

### 3. Der Waechter kann seine eigenen Faelle nicht sehen (opencode) — BESTAETIGT

Regel 2 sollte von einem kuerzenden Element die JSX-Vorfahren hinaufgehen. Beide
gemessenen Verstoesse liegen jenseits dieser Reichweite:

- `MemberDashboard.tsx` — `truncate` steht in `DashTile`, das Raster in einer
  **anderen Komponentenfunktion** derselben Datei. Die JSX-Kette bricht an der
  Komponentengrenze ab.
- `MemberDirectory.tsx` — das fehlende `min-w-0` sitzt in `Motion.tsx`, also in
  einer **anderen Datei**.

Der Waechter waere bei **beiden** gemessenen Verstoessen gruen gewesen.
`tasks.md` 2.2 verlangte, dass er zuerst ROT ist — mit dem entworfenen
Mechanismus unerfuellbar. Das ist kein Detail: ein Waechter, der genau die
Muster nicht sieht, derentwegen er gebaut wird, ist ein Vakuumtest.

### 4. `line-clamp-*` gehoert nicht in die Regel (opencode) — BESTAETIGT

`line-clamp` bricht um; es setzt kein `white-space: nowrap` und kann waagerecht
gar nicht druecken. Es als „kuerzenden Text" zu fuehren, ist breiter als die
gemessene Ursache und erzeugt Fehlalarme (`AcademyPage.tsx:303`,
`MemberDirectory.tsx:746`).

### 5. Die Admin-Tabelle hat den Rahmen schon (opencode) — BESTAETIGT

`AdminMitgliederPage.tsx:488` umschliesst die Tabelle bereits mit
`<div className="overflow-x-auto">`. Die gemessenen +282 px sind **im Rahmen**,
das Dokument bleibt bei 320. Aufgabe 3.4 beschrieb damit Arbeit, die existiert,
ohne zu sagen, was anders werden soll — nicht verifizierbar.

### 6. Eine Route fehlte in der Messung (opencode) — BESTAETIGT

`/intern/routing` (`App.tsx:134`) war in den dreizehn gemessenen Routen nicht
dabei, traegt aber selbst `truncate`. Die Anforderung sagt „auf keiner Route" zu
und misst weniger, als sie verspricht.

## Was NICHT uebernommen wurde

**gemini, Befund 1 in seiner woertlichen Form** („`min-w-0` gehoert auf das
`<li>`"). Auf der eingeloggten Startseite gibt es kein `<li>`; dort ist die Karte
selbst das Rasterkind (gemessen). Der Einwand war in der *Sache* richtig und in
der *Stelle* falsch — uebernommen wurde die Sache.

**opencode, Befund 2** in seiner Begruendung. Es liest `HomePage.tsx:92-98`
(`ul.grid > li > Link > Card`) — das ist die **ausgeloggte** Seite. Die Messung
lief eingeloggt. Der Befund trifft trotzdem, aber als Folge von Befund 1: der
Plan nannte die falsche Datei, und in jener Datei stimmt die Aussage nicht.

## Folge

Der Plan wird ueberarbeitet, bevor Code entsteht. Insbesondere ist der Waechter
in seiner entworfenen Form gestrichen — was an seine Stelle tritt, ist eine
Entscheidung fuer Donald, weil sich die Grundlage seiner Wahl vom 26.08.
geaendert hat: der Waechter kann weniger, als bei der Wahl dargestellt.
