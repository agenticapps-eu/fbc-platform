# Session Handoff — 2026-08-29 (früh, die neue Marke ist vermessen und freigegeben)

**Worktree:** `fbc-platform.donald-age-642-capacitor-huelle`, Branch
`donald/age-642-capacitor-huelle`. **Nachtrag 29.08.:** die Marke ist
eingesetzt, alles committet, und der Branch ist auf `origin/main` rebased —
**0 dahinter, 20 davor**. Der Arbeitsbaum ist sauber; die unten unter *Files
modified* genannten drei Dateien sind drin.

Das Rebase hat **zwei** Commits als bereits auf `main` fallen lassen (Glocke
und pgTAP-Wächter, beide über PR #286 gequetscht) und den Merge-Commit
eingeebnet. Damit liegt die lokale Historie **anders als die von PR #277** —
der Branch braucht einen `--force-with-lease`-Push, und der ist noch nicht
gemacht.

Die Sitzung davor lief im Worktree `age-641` und konnte von dort keine
git-Operationen auf diesen Baum ausführen; deshalb nur Dateien, kein Commit.

## Accomplished

### Die neue Marke ist vermessen, entworfen und von Donald freigegeben

Der fertige SVG-Pfad, alle Messwerte, die Deckungstabelle und die verbleibenden
Schritte stehen in **`docs/marke-neu/entwurf-messung.md`**. Bildbeleg daneben:
`docs/marke-neu/entwurf-gegen-vorlage.jpeg` (Vorlage · Entwurf · Entwurf als
roter Umriss über der Vorlage).

**Zwei Zahlen der Nacht-Übergabe waren falsch, beide aus derselben Ursache:**
die Mitte des Vorlagenbildes war mit (626, 626) *angenommen* statt gemessen —
der Schwerpunkt der hellen Bildpunkte liegt bei (626,4 / 625,7). Vier
Bildpunkte reichen, damit eine Sonde entlang der 45°-Achse den schlanken
Nebenstrahl **seitlich** verlässt; die Zahl, die dabei herauskommt, sieht aus
wie sein Ende.

| | Übergabe nachts | nachgemessen |
| --- | --- | --- |
| Nebenstrahl, äussere Spitze | 0,568 R | **0,680 R** |
| Nabe des Hauptsterns | 0,159 R → „ändert sich praktisch nicht" | **0,140 R**, also 3,4 → **3,15** |

„Gerade Flanken" hält. Der Nebenstrahl ist eine **beidseitig spitze Raute**:
innere Spitze 0,250 R, breiteste Stelle 0,313 R mit halber Breite 0,0497 R,
äussere Spitze 0,680 R.

**Gefangen hat es das Bild, nicht die Zahl.** Der erste Entwurf nach den alten
Zahlen sah in der Tabelle plausibel aus und fiel erst im Umriss über der
Vorlage durch. Genau dafür steht Schritt „rendern und zeigen" vor allem
anderen.

**Deckungsprobe** (Schnittmenge durch Vereinigung der Schwellenmasken, 600²):

| | Deckung |
| --- | --- |
| heute im Repo (Ring + Stern) — Positivkontrolle | 41,9 % |
| Nabe 3,4 (Hauptstern unverändert) | 85,8 % |
| **Nabe 3,15 — von Donald gewählt** | **87,1 %** |

Das Optimum ist flach (3,1 bis 3,2 innerhalb von 0,2 Punkten), 3,4 fällt
heraus. Weiter zu optimieren hiesse JPEG-Unschärfe nachbauen.

### Der Worktree `age-641` ist abräumbar

Nachgemessen: Arbeitsbaum sauber auch mit `--untracked-files=all`, **0 Commits
ahead**, `git branch --contains HEAD -r` nennt `origin/main`. Ignoriert liegen
dort nur `node_modules/`, `.opencode/` und `ci-watch.local` — ein totes
19-Zeilen-Pollskript auf einen längst durchgelaufenen CI-Lauf.

## Decisions

- **Nabe 3,15 statt 3,4** (Donald, 29.08.), gegen die Alternative „Hauptstern
  Zeichen für Zeichen unverändert lassen". Grund: die Vorlage ist am Ansatz
  rund 8 % schlanker, und die Deckungsprobe zeigt es ausgeglichen statt zu fett.
  Das widerspricht der Nacht-Notiz „die Hauptstrahlen ändern sich praktisch
  nicht" — die stützte sich auf die fehlerhafte Mitte.
- **Ein `<path>` mit fünf Teilzügen**, kein `<circle>` mehr. Dann bleibt
  `pfade.length === 1`, und an `leseMarke()` fällt nur die Ring-Erwartung.
- **Die falschen Zahlen wurden als Korrektur sichtbar gemacht**, nicht still
  ersetzt — in diesem Handoff und im vorigen. Wer die alte Tabelle wiederfindet,
  soll sehen, dass sie widerrufen ist.
- **Der 642-Worktree wurde NICHT hierher geholt.** `wt remove --no-delete-branch`
  hätte `.env` und den gesamten nativen Bauzustand (`ios/`, `android/`, Pods,
  Assets) mitgenommen. Stattdessen: neue Sitzung in diesem Worktree.

## Files modified

Alle drei **uncommitted**:

- `docs/marke-neu/entwurf-messung.md` — **neu**. Die fertige SVG-Datei zum
  Übernehmen, die Messwerte samt Methode, die Deckungstabelle, die
  verbleibenden vier Schritte.
- `docs/marke-neu/entwurf-gegen-vorlage.jpeg` — **neu**, 81 kB. Vorlage,
  Entwurf, Umriss über der Vorlage.
- `session-handoff.md` — diese Datei; die Vorgängerfassung trug die zwei
  falschen Zahlen.

## Next session: start here

1. `git fetch && git rebase origin/main` — 5 Commits hinter `main`. Erst danach
   messen, sonst misst man gegen einen alten Stand.
2. **`docs/marke-neu/entwurf-messung.md` lesen.** Nicht neu messen, nicht neu
   entwerfen — der Pfad ist freigegeben.
3. Den Pfad an **drei** Stellen einsetzen: `public/brand/compass-favicon.svg`,
   `src/components/ui/CompassMark.tsx`, `docs/design-system.html`. Keine vierte
   Kopie. Geändert wird ausschliesslich die **Form**, nicht die Farbe.
4. `leseMarke()` in `scripts/app-icons.logic.ts:72` samt Tests: die
   `<circle>`-Erwartung fällt, das Zeichnen des Rings auch. **Ohne diesen
   Schritt scheitert `pnpm app:icons`** an einer Vorlage ohne Kreis.
5. `pnpm app:icons` **und** `pnpm splash`. Beleg ans **gebaute** Artefakt
   (mittlere Farbe, `Assets.car`), nicht an die Datei im Arbeitsbaum.
6. **Erst danach** der Startbildschirm-Fehler — die Fläche wird ohnehin neu
   erzeugt, sonst wird zweimal dasselbe gesucht.

Wenn der Worktree `age-641` nicht mehr gebraucht wird: dort `wt remove` (der
Branch ist gemergt, `wt` nimmt ihn mit — hier richtig). Nicht von hier aus, und
nicht solange dort eine Sitzung läuft.

## Open questions

- **Der lokale Stack ist verstellt.** `hinweis_neue_nachricht()` trägt dort die
  neue Fassung, `schema_migrations` steht aber auf `20260828180000` — per psql
  eingespielt, nicht per `db push`. Ein `db reset` bringt es gerade.
- **CI ist flaky.** `PublicProfilePage.test.tsx` und `use-gespraech.test.tsx`,
  beide im Nachlauf grün. Signatur von `lokal-gruen-ci-rot-zwei-ursachen`,
  Ursache 1. Noch kein eigener Vorgang.
- **Zwei Changes auf einem Branch** (#277) — unverändert offen, jetzt kleiner:
  Migration, pgTAP und Glocke sind heraus und auf `main`.
- **Startbildschirm erscheint nicht** — Verdacht eins bleiben die von Hand
  geschriebenen Constraints, Zwischenspeicher des Launch Screens die zweite
  Spur. Erst die Marke.
- **Tote Gerätetokens** (`zugestellt: 2` aus der deinstallierten App) —
  verschwinden nie von selbst.
- **Die App-ID `com.effbeezee.app` ist unbestätigt**; APNs prüft das Gerätetoken
  vor dem Topic, zeigt sich erst am echten Gerät.
- **Aus der Übergabe vom 28.08. spätabends zurückgeholt** (sie stand auf `main`
  und wurde beim Rebase von dieser Fassung überschrieben — die drei Punkte
  waren hier nie eingearbeitet und wären sonst still verschwunden):
  - **Die Event-Vorschau aus AGE-600 ist nicht im Browser nachgemessen.** Sie
    braucht ein Event mit Titelbild und eine Rolle, die es bearbeiten darf.
  - **AGE-664 kippt eine ausgesprochene Entscheidung** — AGE-596 hat Feed,
    Vorschauen und Verzeichnis-Karte ausgeschlossen (`REVIEWS.md:82`). Zwei der
    drei Ausnahmen sind eingeholt; ob die dritte fällt, ist eine Entscheidung
    und keine Aufgabe.
  - **AGE-658 ist erledigt, nicht offen** — gebaut in PR #277 („nur nativ
    zähmen, Web unverändert"). Steht hier, weil beim Sichten das Gegenteil
    angenommen wurde.
  - Ebenfalls von dort: Aktivierungsversand 69/72 · Rotation des
    PROD-DB-Passworts.
- Unverändert: B3 (Signaturmaterial), C2, C3, Phase D, E · Bearer im
  Funktionsrumpf per `pg_get_functiondef()` lesbar · Abschnitt 4 mit Detlev ·
  AGE-655 · AGE-653 · AGE-610 · AGE-512 · AGE-598 · AGE-256 · AGE-606 ·
  AGE-628/629/630.
