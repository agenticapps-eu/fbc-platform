# Session Handoff — 2026-09-09 (AGE-708 Kontolöschung: fertig und archiviert)

> ## ⚠ ZUERST — Scope dieser Übergabe
>
> **1. Sie beschreibt AGE-708** (Worktree
> `fbc-platform/donald-age-708-kontoloeschung`) und **ersetzt** die Fassung vom
> selben Tag (`1516e81`), die noch zwei offene Augenscheins-Punkte auswies.
> Die Datei ist für alle parallelen Sitzungen dieselbe und kollidiert bei jedem
> Rebase — **nicht zusammenführen**, überschreiben.
>
> **2. AGE-708 ist zu.** Wer hier weitermacht, arbeitet an etwas anderem. Die
> Details des Changes liegen jetzt unter
> `openspec/changes/archive/2026-09-09-kontoloeschung/`, die dauerhafte Wahrheit
> in `openspec/specs/privacy/spec.md`.

## Accomplished

**Die Kontolöschung ist fertig — 42 von 42 Aufgaben, archiviert.** Diese Sitzung
hat die zwei letzten Augenscheins-Punkte erledigt und den Change geschlossen.

| | |
|---|---|
| **4.5 Sichtprobe** | gegen den lokalen Stack, hell und navy, PR **#377** |
| **6.4 Gerätetest** | Android per `adb`, iOS von Donald am Gerät, PR **#378** |
| **Archiviert** | `2026-09-09-kontoloeschung`, neue Spec `privacy` |

**4.5** — Karte, zweistufige Rückfrage mit beiden Absätzen und *Abbrechen*
zurück in den Ausgangszustand, je in `hell` und `navy`. Der Inhalt sieht in
beiden gleich aus, und das ist richtig: `navy` färbt nur den Rahmen
(`src/index.css:208`). Sichtbar unterscheiden sich allein die
`secondary`-Knöpfe, die auf den Chrome-Tokens sitzen.

**6.4** — auf **beiden** Geräten dasselbe Bild. Der Nebenbefund zählt für
AGE-644: **die Karte war ohne Neuinstallation da**, das ausgelieferte
capgo-Bündel trägt sie bereits. Die endgültige Löschung wurde auf keinem Gerät
ausgelöst; beide Konten sind echt.

## Decisions

- **Sichtprobe gegen den lokalen Stack, nicht gegen Live** — die Löschung ist
  unwiderruflich, und ein Wegwerf-Konto gibt es nur lokal. Konto, `.env.local`
  und der vite-Prozess sind wieder weg.
- **Den Weg am Gerät über die Systemgeste verlassen, nicht über *Abbrechen***
  (Donald hat das Fahren der Geräte freigegeben, ausdrücklich ohne Löschung).
  Der Abbrechen-Knopf steht direkt neben *Konto endgültig löschen*.
- **Der Neuigkeiten-Eintrag wurde vor dem Archivieren umgeschrieben.** Er hatte
  keine H1 (Titel wäre der Slug gewesen), keine eigene `Linear:`-Zeile
  (`linear: null`) und neun Punkte in Repo-Sprache. Jetzt fünf Punkte in
  Mitglieder-Sprache, der technische Text unverändert unter „Im Einzelnen:".
- **Branchnamen:** #377 ohne Kürzel (AGE-708 sollte nicht verfrüht kippen),
  #378 **mit** Kürzel, weil dieser Merge den Vorgang wirklich abschliesst.

## Files modified

- `openspec/changes/kontoloeschung/` → `openspec/changes/archive/2026-09-09-kontoloeschung/`
  (`proposal.md` mit neuem Kopf und umgebautem `## What Changes`, `tasks.md` mit
  4.5 und 6.4 abgehakt)
- `openspec/specs/privacy/spec.md` *(neu)* — das vom Archivieren gesetzte
  `Purpose: TBD` ist durch einen echten Zweck ersetzt
- `src/content/release-entries.generated.ts` — 77 Einträge, 13 Zeilen Diff

## Next session: start here

**Für AGE-708 gibt es nichts mehr zu tun.** Der nächste Auftrag kommt aus
Linear; das naheliegende Anschlussstück ist **AGE-644** (Store-Einreichung), für
die dieser Change die harte Abnahmezeile „Kontolöschung im Produkt vorhanden und
getestet" erfüllt — der Beleg dafür steht in
`openspec/changes/archive/2026-09-09-kontoloeschung/tasks.md`, Aufgabe 6.4.

Erster Schritt dort wie immer: `wt list` ansehen und nach einem bestehenden
Branch suchen, bevor etwas Neues entsteht.

## Open questions

Unverändert aus der Vorgängerfassung, keine davon blockt:

- **`event-covers` bleibt bei der Löschung stehen** (Titelbild gehört zur
  Veranstaltung). Vorschlag in `datenmatrix.md` §5, von Donald nicht
  ausdrücklich bestätigt.
- **Laufende Stripe-Abos** beendet die Kontolöschung nicht. Ausserhalb dieses
  Changes, aber real.
- **AGE-260** bleibt offen und ist jetzt kleiner: dessen Aufgaben 2.1, 2.3, 3.1
  und 5.4 sowie das Requirement *„Erasure respects retention duties…"* sind hier
  abgedeckt und dürfen dort nicht ein zweites Mal eingeführt werden.
- **Der Archiv-Eintrag geht in die Neuigkeiten** und damit einmal an alle
  aktivierten Mitglieder. Er ist bewusst in Mitglieder-Sprache geschrieben und
  zum Versenden gedacht, nicht zum Überspringen — aber jemand sollte ihn in
  `AdminNeuigkeitenPage` freigeben, nicht durchrutschen lassen.

## Zwei Lehren dieser Sitzung

Beide stehen im Gedächtnis:

1. **`archivieren-zieht-neuigkeiten-nach`** hat sich umgedreht. Die Notiz sagte
   „prettier ist Pflicht, sonst 889 Zeilen". Heute steht die eingecheckte
   `release-entries.generated.ts` im **Rohstil des Erzeugers**, also gibt *kein*
   prettier 13 Zeilen und prettier 626/612. Neue Regel ohne Richtungsangabe:
   nach `pnpm release:entries` den Diff messen, die kleinere Zahl gewinnt.
2. **`geraetetest-iphone-fallen`**: `devicectl` kann auf iOS starten und die
   Konsole mitlesen, aber **weder Screenshot noch Tap**. Der iOS-Teil jeder
   „am Gerät zeigen"-Aufgabe ist Handarbeit — einplanen, nicht erst beim Anlauf
   merken. Android geht per `adb` vollständig.
