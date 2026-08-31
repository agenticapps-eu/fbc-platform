# Der Bestand auf DEV: warum ein Seed-Lauf ihn nicht heilt

Linear: **AGE-599** (Nachtrag zur Abnahme)

## Why

Die Anforderung „Ein Titelbild-Feld trägt das Verhältnis, auf das zugeschnitten
wird" endet seit AGE-665 mit einem Absatz über den **Bestand**. Sein letzter
Satz lautet:

> Solange die alten Objekte nicht gelöscht und neu erzeugt sind, trägt der
> Bestand weiter Material, das der Seed heute so nicht mehr herstellt.

Das liest sich als Handlungsanweisung — löschen, dann seeden. **Diese
Anweisung führt auf DEV zu Datenverlust**, und das ist gemessen, nicht
vermutet.

Am 31.08. gegen DEV (`foelowldexkcqzewvrcf`, Ziel vorher belegt) gemessen:

| Was | Ergebnis |
| --- | --- |
| Objekte in `event-covers` | **8** |
| davon 3,00:1 ± 0,01 | **0** (1600 × 1067 bis 1600 × 1200) |
| Pfadform | `<host_id>/vorschau-<bild>.webp` |
| Event-IDs aus `demo_event_covers.ts`, die auf DEV existieren | **0 von 8** |

Die Pfadform gehört zu `import_world_seed.ts` — und das zielt auf **PROD**
(`ZIEL_PROJEKT`, erzwungen von `zielPruefen()`). Die Objekte stammen also aus
dem **Spiegel DEV ← PROD** (AGE-576), der absichtlich 1:1 kopiert und nicht
zuschneidet.

Damit gilt: löschte man die acht Objekte, zeigten acht Events auf Pfade ohne
Objekt — graue Kästen ohne Fehlermeldung, genau der Fall, vor dem die
Pfadregel im Seed-Kopf warnt —, und **keines der beiden Skripte** stellte sie
wieder her. `demo_event_covers.ts` fände null passende Events;
`import_world_seed.ts` liefe gar nicht erst gegen DEV.

Die alte Formulierung war nicht falsch, aber unvollständig auf eine Weise, die
den nächsten Leser in genau diesen Griff führt. Sie nannte als Hindernis nur
`x-upsert: false` — richtig, aber nicht der Grund, aus dem ein Lauf hier nichts
bewirkt.

## What Changes

Ein `MODIFIED`-Block auf dieselbe Anforderung. **Kein Code.**

- Der Bestandsabsatz nennt die **gemessenen Zahlen vom 31.08.** statt einer
  allgemeinen Aussage.
- Er nennt die **Herkunft**: Spiegel (AGE-576), nicht Seed-Lauf.
- Er sagt für beide Skripte einzeln, **warum sie nicht greifen**.
- Er spricht ein **SHALL NOT** gegen das Löschen als Seed-Vorbereitung aus —
  die Stelle, an der diese Änderung tatsächlich schützt.
- Er hält die **Entscheidung vom 31.08.** fest: DEV bleibt, PROD wird nicht
  angefasst, ein vollständiger Neuaufbau ist ein eigener Vorgang.
- Nebenbei: `traegt` → `trägt` (in AGE-665 durchgerutscht).

## Entscheidungen

- **Der Absatz bleibt in dieser Anforderung**, statt in ein Betriebsdokument zu
  wandern. Er ist der Grund, aus dem der Bestand kein Gegenbeispiel gegen die
  3:1-Zusage ist — er gehört zu der Zusage, nicht neben sie.
- **Die Zahlen werden datiert** (31.08.), aus demselben Grund wie die
  Bucket-Zahlen in AGE-665: ein Bestand wandert.
- **PROD wird nicht gemessen und nicht angefasst** (Donald, 31.08.). Der
  Lesezugriff darauf wurde in dieser Sitzung ohnehin geblockt; die Anforderung
  behauptet über PROD deshalb nichts Neues.

## Capabilities

### New Capabilities

_Keine._ Der Change bleibt im Slot `design-system`.

### Modified Capabilities

- `design-system`: dieselbe Anforderung wie in AGE-665, erneut ganz
  ausgestellt. Alle **neun** Szenarien bleiben zeichengleich und unverändert.

## Reviewer

**Keiner.** Reine Textarbeit an einer Anforderung — kein Schema, keine Rechte,
keine Sicherheit (`reviewer-nur-bei-migration-und-rls`).

Die Klauselprüfung des `MODIFIED`-Blocks ist am 31.08. für dieselbe Anforderung
vollständig gefahren worden (AGE-665, PR #292); seitdem ist kein Code auf
`main` gelandet, der eine der Klauseln berührt. Neu gemessen wurde, was dieser
Change behauptet: die acht Objekte, ihre Verhältnisse, ihre Pfadform und die
null von acht Event-IDs.
