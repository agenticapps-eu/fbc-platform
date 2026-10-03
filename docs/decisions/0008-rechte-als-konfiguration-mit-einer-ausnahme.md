# 0008 — Rechte sind Konfiguration, die Clubschwelle nicht

**Status:** entschieden · **Datum:** 2026-10-03 · **Vorgang:** AGE-1000 (V5F-1),
Dach AGE-999 · **Change:** `openspec/changes/rechte-v5-final/`

## Kontext

Detlevs SPEC 01 (V5 FINAL, 01.10.2026) unterscheidet DISCOVER (Rang 4), FOCUS
(5) und IMPACT (6) nach Rechten. Gemessen am Katalog von PROD am 03.10.2026
trug die Plattform **keine einzige** Schwelle oberhalb Rang 4: sieben Policies
und fünf Funktionen riefen `has_level(4)`, und `events_write_host` prüfte gar
keine Stufe — jedes aktivierte Konto konnte Events anlegen. Die Unterscheidung
war nicht falsch eingestellt, sie existierte nicht.

Dazu Detlevs Leitregel: Funktionen „über konfigurierbare Rechte/Mindest-
freischaltungen bauen … nicht unnötig hart verdrahten". Jede Schwelle stand
doppelt — als Zahl im Policy-Rumpf und als `minTier` in `nav.ts`.

## Entscheidung

**Feature-Rechte werden Konfiguration.** `public.berechtigungen (schluessel,
min_rank, beschreibung)` hält sie, `public.darf(schluessel)` liest sie,
`public.meine_rechte()` beantwortet dem Client seine eigenen. Zehn Schlüssel,
vier auf Rang 5 und sechs auf Rang 6. Ein unbekannter Schlüssel ergibt `false`.

**Die Clubschwelle Rang 4 bleibt davon ausgenommen** und steht weiter als
`has_level(4)` in ihren zwölf Aufrufern. Ein Check-Constraint verbietet jeden
Eintrag mit `min_rank <= 4`.

Damit tragen zwei Mechanismen nebeneinander, und die Zuordnung ist als
Anforderung in `access-control` festgeschrieben: `has_level(n)` entscheidet
über die Tür, `darf(schluessel)` über jedes Recht dahinter.

## Warum

Die naheliegende Alternative — **alles** über `darf()`, inklusive der
Clubschwelle — wäre ein Mechanismus statt zwei und wirkt sauberer. Sie ist
verworfen, aus zwei Gründen:

1. **AGE-903 hat die Clubschwelle gerade erst zu einer Zahl zusammengezogen.**
   Vorher standen zwei nebeneinander: Rang 2 für die Verzeichnisliste, Rang 3
   für die erweiterten Felder. Sie wieder je Tabelle konfigurierbar zu machen
   dreht genau das zurück. Und vier Rechte mit `min_rank = 4` wären eine zweite
   Kopie der Türzahl — die Drift, die `access-control` ausdrücklich verbietet.
2. **Zwölf funktionierende Aufrufer für null Verhaltensänderung umzuhängen sind
   zwölf Gelegenheiten, etwas zu brechen** — drei Wochen vor dem Go-live.

Der Preis ist benannt: wer eine Schwelle sucht, muss an zwei Stellen schauen.
Er ist deshalb nicht dem Gedächtnis überlassen, sondern steht als Anforderung
samt Szenario in der Spec, und ein pgTAP-Wächter zählt die fünf Policies, die
die Tür halten — fällt eine davon versehentlich auf `darf()`, wird sie rot.

**Zweite verworfene Alternative: die Schlüssel erst mit ihrem Modul anlegen.**
Vier der zehn (`organisation.verwalten`, `community.erstellen`,
`projekt.erstellen`, `academy.anbieten`) haben zum Go-live keinen Wirkort, weil
ihr Modul fehlt. Sie entstehen trotzdem jetzt: der Schlüsselname ist die
Schnittstelle zwischen diesem Schritt und V5F-4/V5F-6. Hier wird er einmal
verhandelt; dort würde er dreimal neu erfunden. `darf()` auf einen Schlüssel
ohne Wirkort ist harmlos — es beantwortet eine Frage, die niemand stellt.

## Folgen

- Eine Schwelle zu verschieben ist eine Migration und keine
  Frontend-Änderung. `useDarf(schluessel)` ist die einzige Quelle der Rechte im
  Client; `BERECHTIGUNG_STUFE` ist reine Textquelle für Sätze wie „ab IMPACT"
  und wird gegen den Seed der Migration geprüft.
- `nav.ts` trägt zwei Felder, `minTier` und `darf`. Genau eines je Route; ein
  Test hält fest, dass keine Route beide trägt.
- **Was dieser Schritt nicht leistet:** die Schwelle `verzeichnis.suchen` wirkt
  auf `search_directory` und auf die Oberfläche. `profiles` und
  `profiles_public` bleiben für jedes Clubmitglied als Menge lesbar, ein
  Rohzugriff liefert also weiter eine Mitgliederliste. Der Verschluss ist ein
  eigener Change (`verzeichnis-dicht`) — beide Befunde kamen aus der
  Plan-Review, bevor Code entstand, und sind in `directory-search` als
  Anforderung festgehalten, samt dem Satz, der bis dahin **nicht** geführt
  werden darf.
