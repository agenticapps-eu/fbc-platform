# Session Handoff — 2026-09-12 (AGE-643 M3 ist abgeschlossen)

> ## ⚠ ZUERST
>
> **1. AGE-643 (M3, Deep Links) ist fertig.** Zwei PRs gemergt: **#403**
> (`901fc67`, Gerätebeleg und drei Korrekturen aus dem Review) und **#404**
> (`3532a6d`, Übergabe plus eine Korrektur am Neuigkeiten-Entwurf). Change
> archiviert als `openspec/changes/archive/2026-09-12-deep-links`, Linear auf
> **Done**. **Hier ist nichts mehr offen.**
>
> **2. Diese Übergabe deckt NUR AGE-643.** AGE-718 lief am selben Tag in einer
> eigenen Sitzung (`fbc-platform-f1`) und hat eigene Commits auf `main`
> (#400–#402). Nicht zusammenführen, nicht nacharbeiten.
>
> **3. Der Worktree `donald-age-643-deep-links` darf weg** (`wt remove`). Der
> Branch `donald/deep-links-abnahme` ist gemergt, die Remote-Fassung gelöscht;
> lokal lebt er nur noch, weil eine Sitzung darin saß.
>
> **4. Zwei Geräte sind verändert und BEIDE abgemeldet** — siehe
> „Gerätezustand". Das ist der einzige Teil, der jemanden noch betrifft.
>
> **5. Diese Datei ist NICHT committet.** Die Fassung auf `main` (aus `3532a6d`)
> ist inhaltlich fast gleich, kennt aber den Merge von #404 und die Korrektur am
> Neuigkeiten-Entwurf noch nicht. Wer sie festhalten will, macht einen kleinen
> PR ohne Vorgangskürzel — direkt auf `main` committen ist verboten.

## Was erledigt ist

§8 (Gerätebeleg auf echten Geräten) und §9 (Sicherheits-Gate, QA-Gate,
Diff-Review, Archiv, PR, Nachtrag) sind vollständig. Die Belege stehen
klauselweise in `tasks.md` des archivierten Changes, mit den Zahlen daneben.

| Fall | Ergebnis |
| --- | --- |
| Android, vier Pfade | App, aus dem Kaltstart, ohne Auswahldialog |
| Android, drei Gegenproben | Browser (`/passwort-neu`, `/verzeichnis`, `/aktivierungsfeier`) |
| iOS mit App | App am Ziel, getippt in der **Gmail-App** |
| iOS ohne App | **Safari**, Formular rendert |
| Rückweg (Brotkrume) | führt zurück in die Absender-App |

Abnahme zuletzt: **2821 Tests grün** (247 Dateien), `typecheck` 0, `lint` 0
Fehler / 7 Warnungen (Vorzustand), `build` grün, `openspec validate --all` 33/33.

## Vier Korrekturen, die erst der Review gefunden hat

1. **`pathPrefix="/aktivierung"` traf auch `/aktivierungsfeier`** — jetzt
   `android:path`. Ein echter Verhaltensfehler: Android hätte die App geöffnet
   und der Router die Adresse verworfen. Am Gerät nachgemessen.
2. **Der native Test hielt beide Artefakte gegen ein eigenes Host-Literal**
   statt gegen `DEEP_LINK_HOST`.
3. **Die AASA-Pfadmenge war nur in eine Richtung gepinnt** — ein zusätzlicher
   Eintrag wäre nie aufgefallen.
4. **Der Neuigkeiten-Entwurf war falsch** (nach dem Archivieren gefunden, Hinweis
   der Nachbarsitzung): ohne H1 hiess er `deep-links`, ohne `Linear:`-Zeile trug
   er `linear: null`, und zwei Stichpunkte standen noch in Planungszeit — einer
   behauptete, der Zuhörer fehle. Korrigiert, der Eingriff ist im Kopf der
   archivierten `proposal.md` benannt.

Zwei weitere Befunde sind begründet **abgelehnt**; die Gründe stehen in
`tasks.md` unter 9.4.

## Gerätezustand

- **Pixel 11 Pro:** trägt den **Release**-Bau (Donalds Entscheidung), die
  Debug-Fassung vom 10.09. ist weg. Das Gerät ist **abgemeldet** — Debug- und
  Release-Signatur sind verschieden, die Neuinstallation hat die Sitzung
  gelöscht. Bildschirmsperre wieder auf 300000 ms.
- **iPhone 17 Pro:** App aus Xcode installiert, für 8.2 gelöscht und wieder
  aufgespielt. **Auch dort ist die Anmeldung weg.**

Wer an einem der beiden misst, plant die Anmeldung vorweg ein.

## Offen, aber nicht hier

- **Die Play-Fassung verifiziert ihre Links nicht** — `assetlinks.json` führt
  nur den Upload-Fingerabdruck. Steht als Abnahmepunkt in **AGE-644**, samt
  Herkunft (Play Console → Test and release → App Integrity), Begründung und
  Gegenprobe.
- **Zielerhaltung über die Anmeldung hinweg**: gebaut und durch Tests gedeckt,
  am Gerät **nicht** nachgestellt. Dafür müsste man sich auf dem Testgerät
  anmelden.
- **Ein einmaliges, nicht reproduzierbares Vorkommnis auf dem iPhone**: ein
  Warmstart landete auf der Startseite statt am Ziel. Der zweite Anlauf trug,
  die naheliegende Erklärung ist gemessen und widerlegt.

## Drei Messfehler dieser Sitzung

Alle drei stehen im Gedächtnis, alle drei kosten sonst wieder Zeit.

1. **Zwei Sonden auf DASSELBE Ziel trennen die Fälle nicht.** Ein Bildschirm,
   der sich nicht verändert hat, sieht aus wie einer, der neu aufgebaut wurde.
   Vor dem Messen fragen, wie der **Misserfolg** aussähe.
2. **`resolve-activity` und `Selection state: Disabled` sehen wie Fehlschläge
   aus und sind keine.** Der Beleg für App Links steht im Aktivitätenstapel nach
   `am start`.
3. **`openspec archive` allein macht CI rot** — `pnpm release:entries` gehört
   dazu. Und vorher einmal `proposal.md` gegen den Erzeuger lesen (H1,
   `Linear:`-Zeile, Stichpunkte im Perfekt statt im Plan).

## Next session: start here

Nichts an AGE-643. Der nächste Schritt der Reihe ist **AGE-644 (M4,
Store-Einreichung)** — Donald hat ihn noch nicht freigegeben, also **vorher
fragen**. Drei Dinge stehen dort in dieser Reihenfolge an:

1. **Google-Konto anlegen und die Testzwang-Bedingungen dort ABLESEN**
   (Mindestzahl Tester, Mindestlaufzeit). Mehrere Wochen Vorlauf, und sie
   gehören vor jede Terminzusage. Der längste Weg im M4-Zeitplan.
2. **Kontolöschung im Produkt** — Apple verlangt sie, es gibt sie heute nicht.
   Das ist Bauarbeit, keine Formalie.
3. **Play-App-Signing-Fingerabdruck** in `assetlinks.json` nachtragen, sobald
   die App in der Play Console angelegt ist.

Vor dem Anfangen `ListAgents` — am 12.09. liefen zwei Sitzungen gleichzeitig im
selben Repo, und einmal sogar im selben Worktree.
