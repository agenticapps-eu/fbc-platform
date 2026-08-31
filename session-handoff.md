# Session Handoff — 2026-08-31

> ## ⚠ ZUERST LESEN: `main` ist vollständig grün, zwei Vorgänge sind ausgerollt
>
> **AGE-666** (PR #291) und **AGE-665** (PR #292) sind gemergt, beide Läufe auf
> `main` grün — `CI` und `Deploy`. Nachzuholen ist am Code **nichts**.
>
> **Die erste Aktion der nächsten Sitzung ist eine Entscheidung, die nur Donald
> treffen kann: die Abnahme von AGE-599.** Sie steht seit dem 28.08. und hat
> zwei Schritte, nicht einen — unverändert gültig, siehe unten.
>
> **Ein Eintrag wartet in der Admin-Ansicht.** Das Archivieren von AGE-665 hat
> automatisch einen Neuigkeiten-Eintrag erzeugt („Die Titelbild-Anforderung sagt
> wieder, was gebaut ist"). Er trägt Spec-Innensicht und richtet sich nicht an
> Mitglieder — in `AdminNeuigkeitenPage` auf **übersprungen** setzen.

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
- **Kein Fremdreviewer bei beiden Vorgängen** — weder Schema noch Rechte noch
  Sicherheit (`reviewer-nur-bei-migration-und-rls`).

## Files modified

- `src/pages/PublicProfilePage.test.tsx` — `findByRole` statt `getByRole`;
  `stelleLayout` zählt die `scrollHeight`-Zugriffe mit und liefert
  `{ zurueck, messungen }`; der Negativtest wartet erst auf den Messbeleg
- `openspec/specs/design-system/spec.md` — die Titelbild-Anforderung ganz neu
  ausgestellt; **vier** Bauteile, Vorschau-Klausel, Feed als einzige Ausnahme,
  alle **neun** Szenarien zeichengleich erhalten
- `openspec/changes/archive/2026-08-31-titelbild-anforderung-nachziehen/` — neu
- `src/content/release-entries.generated.ts` — 13 Zeilen, nach `pnpm
  release:entries` + einzelnem prettier

## Next session: start here

**Erste Aktion: die Abnahme von AGE-599 — sie braucht Donalds Freigabe**, weil
sie in eine geteilte Umgebung schreibt. Zwei Schritte, nicht einer:

1. **Die acht bestehenden Objekte in `event-covers` auf DEV löschen.** Ein
   Seed-Lauf allein ersetzt sie nicht: beide Upload-Stellen schicken
   `x-upsert: false` (`demo_event_covers.ts:97`, `import_world_seed.ts:694`),
   und das ist Absicht mit gemessener Begründung — in privaten Buckets scheitert
   ein Upsert an der SELECT-Policy. Die Pfade ändert der PR nicht.
2. **Dann den Seed laufen lassen und messen** (3,00:1 ± 0,01 für alle acht,
   danach `/events` im Browser).

Danach sind die nächsten Vorgänge **AGE-664** (der Feed, die letzte Fläche, die
noch beschneidet — kippt eine ausgesprochene Entscheidung, siehe unten),
**AGE-660** und **AGE-618**.

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
