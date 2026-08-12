## Why

Linear: **AGE-531** (Nachzug zu C8).

C8 hat die Event-Detailseite inhaltlich vollständig gemacht — Von–Bis,
Beschreibung, Themen, Veranstalter, Teilnehmer, ähnliche Events sind alle da.
**Die Gestaltung ist dabei zurückgeblieben.** Donald beim Ansehen: „bei dem
Event fehlt mir viel von dem was ich vorgegeben habe, Zeit von bis, mehr
Details, Agenda usw."

Der Abgleich mit `docs/mockups/event-detail-2026-07-29.png` gibt ihm recht, und
zwar präzise: **die Felder sind da, die Komposition nicht.** Das Mockup ist ein
Kartenlayout — eine Hero-Karte, darunter „Details", „Themen" und „Veranstalter"
nebeneinander, dann Beschreibung neben den Teilnehmern. Gebaut wurde eine flache
Aufzählung in einer einzigen Karte: dieselben Daten, viel karger, und der
Eindruck ist „da fehlt was", obwohl nichts fehlt.

Die Ursache ist eine Lesart, die ich zu verantworten habe: „Detailseite nach
Mockup" wurde als **Feldliste** umgesetzt statt als Gestaltung. Das Spec-Delta
von C8 zählt entsprechend Elemente auf und sagt über ihre Anordnung nichts —
also war die Anforderung erfüllt und das Ergebnis trotzdem nicht das
Versprochene.

**Dieser Change fasst kein Datenmodell an.** Keine Migration, keine Policy,
keine RPC. Alles, was gezeigt wird, liegt bereits in der Datenbank.

## What Changes

- **Kartenlayout nach Mockup.** Hero-Karte mit Titelbild, Marken, Titel,
  Veranstalter und dem Anmelde-Feld rechts; darunter eine Reihe aus „Details",
  „Themen" und „Veranstalter"; darunter „Beschreibung" neben „Teilnehmer".
  Auf schmalen Fenstern stapelt alles wie bisher.
- **Der Veranstalter bekommt eine eigene Karte** mit Bild, Name, Rolle und
  Firma, Kurzbiografie und „Profil ansehen" — statt einer Zeile am Fuß.
  Die Felder kommen aus `profiles_public` (`company`, `roles`, `short_bio`),
  das `hostsFor` ohnehin schon abfragt; es werden nur drei Spalten mehr
  ausgewählt.
- **Sichtbarkeit als Satz.** Der „Details"-Block sagt „Offen für alle
  Mitglieder" bzw. „Nur für Mitglieder" statt gar nichts. Das Mockup führt
  diese Zeile, und sie beantwortet eine Frage, die sich beim Anmelden stellt.
- **„Änderungen vorbehalten."** unter den Themen und **„Alle Events anzeigen →"**
  neben „Ähnliche Events" — beides steht im Mockup und kostet nichts.
- **Brotkrume** „Events › Titel" statt „← Zu allen Events", wie im Mockup.

## Non-goals

Alles, was neue Spalten bräuchte oder in C8 bereits als nicht enthalten
festgehalten wurde. Namentlich:

- **Untertitel** („Wöchentliches Community-Meeting") und **Hinweistext**
  („Der Zoom-Link wird 1 Stunde vor Beginn bereitgestellt") — beide bräuchten
  je eine Spalte. Sie sind Donald vorgelegt und nicht bestellt; solange nicht,
  bleiben sie draußen.
- **Kalender-Export, Teilen (LinkedIn/WhatsApp/E-Mail/Link), Merken,
  Kommentare, „Nachricht senden"** — in C8 als Non-goals benannt und hier
  unverändert draußen. Sie machen im Mockup einen erheblichen Teil der rechten
  Spalte aus; dass die Seite ohne sie ruhiger wirkt, ist gewollt und kein
  Rückstand.
- **„Teilnehmerliste anzeigen"** als eigene Ansicht. Der Host hat seine Liste in
  den Host-Werkzeugen; für alle anderen gibt es die Avatarreihe. Eine dritte
  Ansicht wäre eine neue Fläche, kein Layout.
- **Die Mockup-Typen** (`ERLEBNISTAG`, `NETWORKING`, …). `events_type_check`
  bleibt unangetastet, wie in C8 entschieden.

## Impact

- **Specs:** `events` — eine MODIFIED (die Detailseiten-Anforderung wird um die
  Anordnung und die drei neuen Blöcke ergänzt; alle bestehenden Szenarien
  bleiben wortgleich erhalten).
- **Code:** `src/pages/EventDetailPage.tsx` (Umbau), `src/lib/events.ts`
  (`EventHost` um drei Felder, `hostsFor` wählt drei Spalten mehr),
  `src/pages/EventDetailPage.test.tsx`.
- **Keine** Migration, **keine** Policy, **keine** RPC, **kein** neues Recht.
- **Nicht betroffen:** Übersicht, Formular, Titelbild-Upload, die gesamte
  Event-Mechanik.
