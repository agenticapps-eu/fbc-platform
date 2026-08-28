# Neuigkeiten-Fläche: ein Archiv für Zugestelltes und für „nicht relevant"

Linear: **AGE-636**

## Why

Die Fläche `/admin/neuigkeiten` (AGE-631) kennt einen Eintrag nur in zwei
Zuständen: **noch nicht angekündigt** oder **zugestellt**. Daraus folgen zwei
Fehler, und der zweite wächst mit jedem Merge.

**Zugestelltes verschwindet spurlos.** `nochNichtAngekuendigt()` zieht die
abgedeckten Slugs ab; nachlesbar ist danach nur noch der *Titel* der Mitteilung
in der Karte „Bereits zugestellt". Welche Änderungen sie abdeckte, steht in
`entry_slugs` und wird von keiner Fläche mehr gezeigt.

**Für „gesehen, aber nicht der Rede wert" gibt es keinen Platz.** Gemessen im
Worktree am 27.08. gegen `openspec/changes/archive/`:

| Größe | Wert |
| --- | --- |
| Archivierte Changes = Einträge in `release-entries.generated.ts` | **52** |
| davon im Vorauswahl-Fenster der letzten 7 Tage (`>= 2026-08-20`) | **30** |
| davon **älter**, also ungehakt in der Liste | **22** |
| Einträge ohne „What Changes"-Stichpunkte | 9 |
| Bisher zugestellte Release-Notes | **0** |

Die 22 älteren sind der Kern des Problems. Die Vorauswahl aus AGE-631 hakt sie
bewusst **nicht** an — und die Liste zeigt sie bewusst trotzdem, weil eine
gekürzte Liste aussieht wie eine vollständige. Damit bleiben sie dort stehen,
bis jemand sie in eine Mitteilung zieht. Für „Grants ausdrücklich ausgesprochen
(AGE-312)" oder „pgTAP: `alike()` statt `like()`" wird das nie passieren: das
sind wahre Sätze, die einem Mitglied nichts sagen. Sie zu übergehen ist eine
Handlung, die die Fläche nach jedem Neuladen erneut verlangt.

Donald am 27.08.:

> „In den Release-Notes für Admin würde ich gerne das so machen, dass alles was
> kommuniziert wurde oder als nicht relevant (eigenes Kästchen) markiert wurde,
> in einem Archiv verschwindet, was man aufmachen könnte."

## What Changes

- **Ein Eintrag steht in genau einem von zwei Zuständen: offen oder
  archiviert.** Archiviert wird er auf zwei Wegen — durch **Zustellung**
  (endgültig) oder durch die Markierung **„nicht relevant"** (rücknehmbar).
- **Ein zweites Kästchen je Zeile: „nicht relevant".** Es nimmt den Eintrag aus
  der Liste *und* aus der laufenden Auswahl — ein Eintrag, den man gerade als
  belanglos markiert, darf nicht angehakt im Entwurf landen.
- **Eine neue Tabelle `release_entry_skips`** hält die markierten Slugs. Ein
  Slug, ein Admin, ein Zeitpunkt — mehr nicht.
- **Ein aufklappbares Archiv** unter der Liste, zugeklappt beginnend, mit der
  Zahl im Kopf. Es nennt zu jedem Eintrag den Grund und trägt bei „nicht
  relevant" den Weg zurück.
- **`teileAuf()` ersetzt `nochNichtAngekuendigt()`**: dieselbe Rechnung, aber
  sie gibt **beide** Hälften zurück statt nur der einen. Die Zusage „ein Entwurf
  darf nichts verstecken" bleibt wörtlich erhalten und wird weiter geprüft.

## Was ausdrücklich NICHT dazugehört

- **Kein Zurückholen von Zugestelltem.** Die Hinweise stehen dann schon in den
  Postfächern; ein Eintrag, der wieder als „offen" gälte, würde ein zweites Mal
  angekündigt.
- **Keine private Markierung.** „Nicht relevant" gilt für alle Admins. Zwei
  Admins mit verschiedenen Listen hätten keine gemeinsame Grundlage dafür, was
  noch anzukündigen ist — und `localStorage` überlebt keinen Browserwechsel.
- **Kein Grund-Text zur Markierung.** Ein Pflichtfeld dafür wäre eine Hürde vor
  einer Handlung, die 22-mal hintereinander getan wird.
- **Keine Empfängerauswahl** (verboten seit AGE-304) und **kein Löschen
  zugestellter Notes** (AGE-631, ausdrücklich).
