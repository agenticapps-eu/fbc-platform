# Session Handoff — 2026-09-12 (AGE-643 M3 ist fertig und gemergt)

> ## ⚠ ZUERST
>
> **1. AGE-643 (M3, Deep Links) ist abgeschlossen.** Change `deep-links`
> archiviert als `openspec/changes/archive/2026-09-12-deep-links`, PR #403
> gemergt (`901fc67`), Linear auf Done. **Hier ist nichts mehr offen.**
>
> **2. Diese Übergabe deckt NUR AGE-643.** AGE-718 lief am selben Tag in einer
> eigenen Sitzung (`fbc-platform-f1`) und hat eigene Commits auf `main`
> (#400–#402). Nicht zusammenführen, nicht nacharbeiten.
>
> **3. Der Worktree `donald-age-643-deep-links` darf weg** (`wt remove`), der
> Branch `donald/deep-links-abnahme` ist gemergt. Er steht nur noch, weil die
> Sitzung darin lief.
>
> **4. Zwei Geräte sind verändert** — siehe „Gerätezustand" unten. Das ist der
> einzige Teil, der jemanden noch betrifft.

## Was fertig ist

§8 (Gerätebeleg) und §9 (Abnahme, Gates, Archiv, PR) sind vollständig. Die
Belege stehen klauselweise in `tasks.md` des archivierten Changes, mit den
Zahlen daneben.

| Was | Stand |
| --- | --- |
| Android, alle vier Pfade | App, aus dem Kaltstart, ohne Auswahldialog |
| Android, zwei Gegenproben | Chrome (`/passwort-neu`, `/verzeichnis`) |
| iOS mit App | App am Ziel, getippt in der **Gmail-App** |
| iOS ohne App | **Safari**, Formular rendert |
| Rückweg (Brotkrume) | führt zurück in die Absender-App |

## Drei Korrekturen aus dem Diff-Review (alle mit Gegenprobe)

1. **`pathPrefix="/aktivierung"` traf auch `/aktivierungsfeier`** — jetzt
   `android:path`. Das war ein echter Verhaltensfehler, kein Feinschliff.
2. **Der native Test hielt beide Artefakte gegen ein eigenes Host-Literal**
   statt gegen `DEEP_LINK_HOST`.
3. **Die AASA-Pfadmenge war nur in eine Richtung gepinnt** — ein zusätzlicher
   Eintrag wäre nie aufgefallen.

Zwei weitere Befunde sind begründet abgelehnt; die Gründe stehen in `tasks.md`
unter 9.4.

## Gerätezustand (das Einzige, was noch jemanden betrifft)

- **Pixel 11 Pro:** trägt jetzt den **Release**-Bau statt des Debug-Baus vom
  10.09. Donalds Entscheidung. Das Gerät ist dadurch **abgemeldet** — Debug-
  und Release-Signatur sind verschieden, die Neuinstallation hat die Sitzung
  gelöscht. Der alte Debug-APK liegt im Ablageordner der Sitzung, wird aber
  bewusst nicht zurückgespielt (das kostete die Domain-Verifizierung).
  Bildschirmsperre steht wieder auf 300000 ms.
- **iPhone 17 Pro:** App aus Xcode installiert, dann für 8.2 gelöscht und
  wieder aufgespielt. **Auch dort ist die Anmeldung weg.**

## Offen, aber nicht hier

- **Die Play-Fassung verifiziert ihre Links nicht** — `assetlinks.json` führt
  nur den Upload-Fingerabdruck. Steht als Abnahmepunkt in **AGE-644**, samt
  Herkunft, Begründung und Gegenprobe.
- **Zielerhaltung über die Anmeldung hinweg**: gebaut und durch Tests gedeckt,
  am Gerät **nicht** nachgestellt. Dafür müsste man sich auf dem Testgerät
  anmelden.
- **Ein einmaliges, nicht reproduzierbares Vorkommnis auf dem iPhone**: ein
  Warmstart landete auf der Startseite statt am Ziel. Der zweite Anlauf trug,
  die naheliegende Erklärung ist gemessen und widerlegt. Festgehalten, nicht
  verschwiegen — der Weg des Tokens hat eine stille Verlustmöglichkeit.

## Zwei Messfehler, die dieser Sitzung passiert sind

Beide stehen im Gedächtnis, beide kosten sonst wieder Zeit.

1. **Zwei Sonden auf DASSELBE Ziel trennen die Fälle nicht.** Ein Bildschirm,
   der sich nicht verändert hat, sieht aus wie einer, der neu aufgebaut wurde.
   Vor dem Messen fragen, wie der **Misserfolg** aussähe.
2. **`resolve-activity` und `Selection state: Disabled` sehen wie Fehlschläge
   aus und sind keine.** Der Beleg für App Links steht im Aktivitätenstapel
   nach `am start`, nicht in diesen beiden Sonden.

## Next session: start here

Nichts an AGE-643. Der nächste Schritt der Reihe ist **AGE-644 (M4,
Store-Einreichung)** — dort steht der längste Weg im Zeitplan, der
Google-Testzwang für persönliche Entwicklerkonten. Vorher `wt remove` für
diesen Worktree.
