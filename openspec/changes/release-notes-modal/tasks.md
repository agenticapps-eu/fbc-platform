# Tasks

## 1. Das Modal

- [x] 1.1 `NeuesPage`: Karten werden Schaltflächen, die eine Note öffnen.
- [x] 1.2 Overlay über `createPortal` an `document.body` plus `useOverlay`
      (Scroll-Sperre, Fokus-Falle, AGE-529). Kein zweites Overlay-Muster.
- [x] 1.3 Schliessen über Kreuz, Escape und Klick auf den Hintergrund.
- [x] 1.4 Test: offen/geschlossen, Escape, und dass der Portal-Knoten NICHT im
      Kartencontainer hängt (dort fangen ihn `.fbc-card:hover` und der
      `backdrop-blur` des Kopfes ein).

## 2. Bilder

- [x] 2.1 `src/content/release-bilder.ts`: Zuordnung Change-Slug → Bilder,
      jeweils mit Alternativtext.
- [x] 2.2 Das Modal zeigt die Bilder der Slugs, die die Note abdeckt.
- [x] 2.3 Breite und Höhe stehen im Markup, damit nichts nachspringt.
- [x] 2.4 Test: eine Note ohne Bilder zeigt keine leere Fläche.

## 3. Der Weg aus der Glocke

- [x] 3.1 Der Release-Hinweis führt auf `/neues?note=<id>`.
- [x] 3.2 `NeuesPage` liest den Parameter und öffnet die Note.
- [x] 3.3 Test: mit Parameter offen, ohne Parameter geschlossen.

## 4. Screenshots

- [x] 4.1 Lokal aufnehmen, ausschliesslich Demo-Konten.
- [x] 4.2 Vor dem Einchecken prüfen: kein echter Name, keine echte Adresse.
