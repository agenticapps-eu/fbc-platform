# Session Handoff — 2026-08-31

> ## ⚠ ZUERST LESEN: `main` ist vollständig grün, zwei Vorgänge sind ausgerollt
>
> **AGE-666** (PR #291) und **AGE-665** (PR #292) sind gemergt, beide Läufe auf
> `main` grün — `CI` und `Deploy`. Nachzuholen ist am Code **nichts**.
>
> **⛔ AGE-599 ist ERLEDIGT — und die frühere Anweisung dazu war FALSCH.**
> Eine ältere Fassung dieses Dokuments verlangte, „die acht Objekte in
> `event-covers` auf DEV zu löschen und dann zu seeden". **Das hätte DEV
> kaputtgemacht.** Am 31.08. dort gemessen (nur lesend): die acht Objekte
> tragen Pfade `<host_id>/vorschau-<bild>.webp` und stammen aus dem **Spiegel
> DEV ← PROD (AGE-576)**, nicht aus einem Seed-Lauf. **0 von 8** Event-IDs aus
> `demo_event_covers.ts` existieren auf DEV, und `import_world_seed.ts` zielt
> auf PROD. Nach dem Löschen zeigten acht Events auf Pfade ohne Objekt —
> graue Kästen ohne Fehlermeldung —, und **keines der beiden Skripte** stellte
> sie wieder her.
>
> **Entschieden (Donald, 31.08.): DEV bleibt so — zum Testen brauchbar —,
> PROD wird NICHT angefasst.** Ein vollständiger Seed ist vielleicht später ein
> eigener Vorgang. Nachgezogen in `design-system/spec.md` samt einem SHALL NOT
> gegen das Löschen als Seed-Vorbereitung.
>
> **Der Neuigkeiten-Eintrag ist kein offener Punkt** — Donald macht das
> generell selbst.

**Sitzung:** Worktree `fbc-platform.neuigkeiten-archiv` (der Name gehört zu
einem längst archivierten Change). Gearbeitet wurde auf Branches, die direkt von
`origin/main` abzweigen — die **lokale** `main` hängt zurück (`359f349` gegen
`cfae118`) und liegt im Haupt-Worktree, `wt switch --create` hätte also von
einem veralteten Stand abgezweigt.

## Accomplished

| PR | Vorgang | Stand |
| --- | --- | --- |
| #291 | **AGE-666** — flackernder Test, hielt `verify` rot | gemergt, `main` grün |
| #292 | **AGE-665** — Spec-Drift im Titelbild-Abschnitt | gemergt, Delta gefaltet |
| #294 | **AGE-599** — Bestand auf DEV: warum ein Seed-Lauf ihn nicht heilt | gemergt, Delta gefaltet |

**AGE-666 ließ sich nicht statistisch abnehmen — und das war der Befund.** Acht
volle Suite-Läufe auf dem ungepatchten Stand: **8 von 8 grün**. Die Flakiness
reproduziert sich auf dieser Maschine nicht, also hätte die im Issue
vorgeschriebene Abnahme („Suite mehrfach laufen lassen") **jede** Korrektur
bestätigt. Belegt wurde stattdessen deterministisch, über zwei Sonden an der
Komponente (beide zurückgenommen, Prüfsumme verglichen):

- **Sonde A** — `setGekuerzt` um einen Makrotask verzögert: vorher **rot, mit
  der CI-Fehlermeldung Wort für Wort**, nachher grün.
- **Sonde B** — `setGekuerzt` stillgelegt: der Negativtest daneben war **grün**
  bei einer Komponente, die nie misst; mit der neuen Positivkontrolle rot
  (`expected 0 to be greater than 0`).

**AGE-665 war größer als das Issue.** Es nannte zwei überholte Aussagen; beim
klauselweisen Lesen für den `MODIFIED`-Block waren es **drei plus eine falsche
Begründung**:

- **Die Verzeichnis-Karte** stand in der Ausschlussliste und ist seit AGE-595
  längst konform. Zeitachse: die Fassung, die sie ausschloss, landete am 25.08.
  um **20:18**, die Karte wurde um **22:38** konform — 2 h 20 später.
- **„tragen anderes Bildmaterial"** ist für **beide** Ausschlussflächen falsch:
  die Karte zieht aus `covers` wie der Profilkopf, der Feed über
  `signEventCovers` aus `event-covers` wie Kachel und Kopf.

**AGE-599 wurde abgenommen — und die Abnahme hat den Plan widerlegt.** Die
Vorher-Messung gegen DEV (nur lesend, Ziel vorher belegt) ergab 8 Objekte,
**0 davon 3:1**. Entscheidend war aber nicht diese Zahl, sondern zwei andere:
die Pfadform `<host_id>/vorschau-<bild>.webp` gehört zu `import_world_seed.ts`
(das auf **PROD** zielt), und **0 von 8** Event-IDs aus `demo_event_covers.ts`
existieren auf DEV. Der Bestand stammt also aus dem **Spiegel AGE-576**, und
Löschen hätte acht Events auf leere Pfade zeigen lassen, ohne Weg zurück.
**Es wurde nichts gelöscht.**

## Decisions

- **Vorschauen bekommen eine eigene Klausel**, keinen fünften Aufzählungspunkt
  („Eine Vorschau SHALL dieselbe Regel tragen wie die Fläche, die sie
  vorwegnimmt"). Sagt den Grund mit und deckt künftige Vorschauen ab — sonst
  wäre die Liste im selben Zug auf sechs Einträge gewachsen.
- **Der Seed-Absatz geht in die Vergangenheitsform, nicht weg.** Er trägt eine
  gemessene Zahl (25 % freie Fläche je Seite; beim 1,33:1-Motiv 27,8 %), die als
  Beleg wertvoll bleibt.
- **Die Bucket-Zahlen wurden datiert, nicht nachgemessen.** Über den hier
  erreichbaren Supabase-Zugang ist nur `cparx` sichtbar, Infisical braucht ein
  TTY. Ein `MODIFIED`-Block bekräftigt jede Klausel unter neuem Datum — sie
  ungeprüft stehenzulassen hieße, sie neu zu behaupten.
- **Der Feed bleibt ausgeschlossen, aber mit dem richtigen Grund.** Der
  Ausschluss ruht jetzt sichtbar auf AGE-664 statt auf einer falschen
  Materialbehauptung.
- **Kein Fremdreviewer bei allen drei Vorgängen** — weder Schema noch Rechte
  noch Sicherheit (`reviewer-nur-bei-migration-und-rls`).
- **DEV bleibt, PROD wird nicht angefasst** (Donald, 31.08.). Der Bestand ist
  zum Testen brauchbar; ein vollständiger Neuaufbau ist ein eigener Vorgang.

## Files modified

- `src/pages/PublicProfilePage.test.tsx` — `findByRole` statt `getByRole`;
  `stelleLayout` zählt die `scrollHeight`-Zugriffe mit und liefert
  `{ zurueck, messungen }`; der Negativtest wartet erst auf den Messbeleg
- `openspec/specs/design-system/spec.md` — die Titelbild-Anforderung ganz neu
  ausgestellt; **vier** Bauteile, Vorschau-Klausel, Feed als einzige Ausnahme,
  alle **neun** Szenarien zeichengleich erhalten
- `openspec/changes/archive/2026-08-31-titelbild-anforderung-nachziehen/` — neu
- `openspec/changes/archive/2026-08-31-titelbild-bestand-auf-dev/` — neu; der
  Bestandsabsatz nennt jetzt die Herkunft (Spiegel) und spricht ein SHALL NOT
  gegen das Löschen als Seed-Vorbereitung aus
- `src/content/release-entries.generated.ts` — nach `pnpm release:entries`
  + einzelnem prettier

## Next session: start here

**Es liegt nichts Blockierendes an.** AGE-599 ist erledigt und entschieden
(siehe Kasten oben); es wartet keine Freigabe mehr.

Die nächsten Vorgänge, frei wählbar: **AGE-664** (der Feed, die letzte Fläche,
die noch beschneidet — kippt eine ausgesprochene Entscheidung, siehe unten),
**AGE-660** und **AGE-618**.

**Parallel läuft eine zweite Sitzung an AGE-642** (mobile Hülle), Branch
`donald/age-642-capacitor-huelle`, zum Stand dieser Übergabe noch nicht
gepusht (braucht `--force-with-lease` wegen des Squash von #277). Sie fasst
`useOverlay` (zweites Pflichtargument) und sechs Dateifelder in
`CommunityFeed`, `ProfilPage`, `WillkommenPage`, `EventCoverPicker` an.
**Berührungspunkt mit dieser Sitzung: nur `session-handoff.md`.** Wer eine
dieser Flächen anfasst, sagt dort bitte kurz Bescheid.

## Open questions

- **AGE-664 kippt eine ausgesprochene Entscheidung** (AGE-596 hat Feed,
  Vorschauen und Verzeichnis-Karte ausgeschlossen, `REVIEWS.md:82`). Von den
  drei Ausnahmen sind jetzt **alle bis auf den Feed** eingeholt — die Vorschauen
  über AGE-600, die Karte über AGE-595. Ob die letzte fällt, ist Donalds
  Entscheidung; die Spec hält sie seit AGE-665 sauber offen.
- **AGE-660** (`drop index concurrently` auf `messages_thread_id_idx`) verlangt
  laut Issue **erst eine Messung**: `pg_stat_user_indexes.idx_scan` für beide
  Indizes auf DEV **und** PROD. Steht auf dem alten Index eine Zahl, die der neue
  nicht erklärt, ist die Präfix-Argumentation unvollständig. Braucht außerdem
  einen Fremdreviewer (Schema) und für PROD eine getrennte Freigabe.
- **Ein Doku-Branch der Vorsitzung liegt ohne PR herum:**
  `donald/uebergabe-dev-migration-blockiert` (Commit `36c595e`, die Übergabe vom
  28.08.). Er ist nicht auf `main`. Entweder nachträglich einbringen oder
  löschen — hängengeblieben ist er, weil Übergaben zwar committet, aber nicht
  immer gemergt wurden.
- **Die Bucket-Zahlen in der Spec sind auf den 25.08. datiert** und nicht
  nachgemessen. Wer PROD-Zugang hat, kann sie bestätigen oder korrigieren.
- Unverändert offen: AGE-610 · AGE-512 · Aktivierungsversand 69/72 · Rotation
  des PROD-DB-Passworts · AGE-598 · AGE-256 · AGE-606 · AGE-628/629/630.

## Was diese Sitzung über das Verfahren gelernt hat

**Eine neue Memory** — `flake-ohne-reproduktion-deterministisch-sondieren`:
reproduziert ein Flake sich nicht, ist die statistische Abnahme wertlos, und der
Ausweg ist keine höhere Wiederholungszahl, sondern eine Sonde, die das Rennen
deterministisch macht.

**Drei ergänzt:** `modified-block-bekraeftigt-alles` (zweiter Fall — und diesmal
ohne Reviewer gefunden, das klauselweise Nachmessen war der einzige Schritt, der
blieb), `archivieren-zieht-neuigkeiten-nach` (ein Spec-Drift-Change erzeugt einen
Eintrag, der zum Überspringen gedacht ist) und `merge-erfolg-verifizieren` (im
Worktree `--delete-branch` von vornherein weglassen — ich bin am selben Fehler
ein zweites Mal hängengeblieben).

**Und eine Falle beim Messen:** ein Worktree mit veralteten `node_modules` lässt
die Suite mit `exit=1` und **16 nicht ladbaren Dateien** abbrechen, ohne dass ein
benannter Test fehlschlägt — das sah aus wie der gesuchte Flake und war eine
fehlende Abhängigkeit (`@capacitor/push-notifications` aus #277). Vor jeder
Baseline-Messung `pnpm install --frozen-lockfile`.
