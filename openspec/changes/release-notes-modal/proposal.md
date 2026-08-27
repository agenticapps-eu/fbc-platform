# Release-Notes im zentrierten Modal lesen, mit Screenshots

Linear: **AGE-632**

## Why

Eine zugestellte Release-Note steht heute auf `/neues` als Karte in einer Liste:
Titel, Datum, Fliesstext, alles gleichzeitig offen. Wer aus der Glocke kommt,
landet auf der Seite und muss die Note, um die es ging, unter den anderen
suchen — die Glocke verlinkt die Fläche, nicht den Eintrag.

Und der Text steht allein. Eine Ankündigung über eine Fläche, die man ansehen
kann, ohne ein Bild davon zu zeigen, verlangt vom Leser, sich die Änderung
vorzustellen.

Donald am 27.08.:

> „Wenn die Leute auf die Release Notes drücken, soll das als Modal angezeigt
> werden, das mittig angezeigt wird, gerne auch Bilder dabei … also mache da wo
> Sinn macht Screenshots aber ohne konkrete Namen zu zeigen"

## What Changes

- Eine Release-Note auf `/neues` ist anklickbar und öffnet sich **mittig als
  Modal**, mit Scroll-Sperre und Fokus-Falle.
- Eine Release-Note kann **Bilder** tragen. Sie hängen am archivierten Change,
  entstehen zur Bauzeit wie die Eintragsliste selbst und werden mit dem Bündel
  ausgeliefert — kein Upload-Weg, keine Migration, kein Bucket.
- Der Hinweis in der Glocke führt weiterhin auf `/neues`, aber mit **geöffneter**
  Note statt auf die blosse Liste.
- Die Liste bleibt, was sie ist: alle zugestellten Notes, das Jüngste zuerst.

## Impact

- `openspec/specs/notifications/spec.md` — eine neue Anforderung, keine geänderte.
- Betroffen: `src/pages/NeuesPage.tsx`, `src/components/hinweise/HinweisGlocke.tsx`,
  neu `src/content/release-bilder.ts` und `public/release/`.
- **Das Repo ist öffentlich.** Jeder Screenshot zeigt ausschliesslich
  Demo-Inhalte — keine echten Namen, Adressen oder Firmen.
