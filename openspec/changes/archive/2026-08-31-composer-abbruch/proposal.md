# Ein begonnener Beitrag lässt sich wieder verwerfen

Linear: **AGE-670**

## Why

Der Composer in der Aktivität hat **genau einen Ausgang, und er führt durch das
Veröffentlichen.** Wer ihn aufklappt und es sich anders überlegt, kommt nicht
wieder heraus: der Entwurf bleibt für die Lebensdauer der Seite stehen, und der
einzige Weg zurück ist Posten oder Weg-Navigieren.

Donalds Befund am Bildschirm (31.08.), am Code nachgemessen gegen `eab8368`:

|                   | Zeile   |                                                            |
| ----------------- | ------- | ---------------------------------------------------------- |
| `setOffen(true)`  | 825     | der einzige Eingang                                        |
| `setOffen(false)` | 779     | die einzige Stelle überhaupt — im `onSuccess` der Mutation |
| Zurücksetz-Block  | 769–779 | vollständig, samt `URL.revokeObjectURL`                    |
| Aktionszeile      | 1040    | der `Button` „Posten"                                      |

`grep -n "setOffen" src/components/community/CommunityFeed.tsx` liefert für den
Composer genau diese zwei Zeilen; die übrigen Treffer (553/558, 1553/1580/1626/ 1627) gehören zum Tag-Filter und zur Lightbox.

**Die Zurücksetz-Logik existiert also bereits vollständig.** Sie ist nicht zu
schreiben, sie ist zu befreien: sie steckt im `onSuccess` fest und ist damit
nur über einen erfolgreichen Schreibvorgang erreichbar.

Einzelne Teile lassen sich schon heute zurücknehmen — ein Bild über sein „×",
`Sichtbar ab` über seinen „sofort"-Rückweg aus AGE-667. Was fehlt, ist der
Sammel-Verwerfer für Text, Themen-Chips, Bilder, Video-Link und Zeitpunkt in
einem Zug.

## What Changes

- **Der Composer bekommt einen Weg zurück.** Neben „Posten" steht künftig
  „Abbrechen": der Entwurf wird verworfen und der Composer klappt zu.
- **Verworfen wird alles auf einmal** — Text, Video-Link samt aufgeklapptem
  Feld, Sichtbarkeit zurück auf „Mitglieder", der Veröffentlichungszeitpunkt
  zurück auf „sofort", die gewählten Bilder, eine stehende Bildfehlermeldung
  und die gewählten Themen.
- **Ein erneutes Aufklappen beginnt leer**, nicht beim alten Entwurf.

Keine Rückfrage vor dem Verwerfen. Der Knopf steht unmittelbar neben „Posten",
trägt kein zerstörerisches Gewicht und ist mit einem Klick wiederholbar — eine
Bestätigung wäre Reibung für den häufigen Fall, um einen seltenen zu decken.
Falls sich das als falsch erweist, ist die Rückfrage ein eigener, kleiner
Nachtrag.

## Was NICHT dazugehört

- **Kein Entwurfs-Speicher.** Der Entwurf überlebt weiterhin kein Navigieren
  und kein Neuladen; das war vorher so und ändert sich nicht. Ein „Entwurf
  behalten" wäre ein eigener Vorgang mit eigener Ablage.
- **Das Bearbeiten-Formular bleibt unberührt.** Es hat seinen eigenen
  Abbrechen-Weg und ist eine andere Fläche.
- **`useBildauswahl` bekommt keinen Aufruf.** Gemessen: sein `offen` setzt sich
  bei Wahl (`waehlen` schliesst zuerst) wie bei Abbruch selbst auf `null`, und
  `useOverlay` gibt die Scroll-Sperre im Effekt-Cleanup frei
  (`if (stapel.length === 0) freigeben()`). Ein Verwerfen bei offener
  Quellen-Rückfrage kann die Seite deshalb nicht gesperrt zurücklassen.
  Erreichbar ist der Fall ohnehin nicht: die Rückfrage liegt als
  `fixed inset-0 z-50`-Overlay über der Aktionszeile.

## Verfahren

**Kein Fremdreviewer** (Schritt 2b entfällt). Reines UI: kein Schema, keine
Rechte, keine Sicherheitsgrenze — Donalds stehende Regel vom 26.08. Der Change
wird gebaut, nicht plan-reviewt; `REVIEWS.md` entsteht deshalb nicht.

## Die eine Falle beim Bauen

`URL.revokeObjectURL` steht in dieser Datei an **zwei** Stellen: 775 im
Zurücksetz-Block und **860** am „×" der einzelnen Bildkachel. Nur die erste
gehört in die herausgezogene Funktion. Die zweite ist nicht neu aus AGE-642 C3,
sie lag vorher schon dort — und sie mitzunehmen bräche das Entfernen eines
einzelnen Bildes.
