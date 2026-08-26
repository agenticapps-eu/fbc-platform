## Why

Drei Beobachtungen Donalds aus dem laufenden Betrieb (25.08.2026, AGE-587). Sie
sind je für sich klein, teilen aber eine Ursache: **eine Fläche zeigt etwas an,
ohne dass man damit etwas tun kann.**

Das QM-Feedback hängt als letzte Karte unten an der Sammelseite `/admin` und
lädt ungebremst alles, was je eingegangen ist. Die Reiter der Mitgliederliste
benennen fünf Zustände, verraten aber nicht, wie viele Mitglieder in jedem
stehen — die Frage „wie viele sind noch nicht aktiviert?" ist genau die, für die
es den Reiter gibt. Und die Aktivitäten-Karte auf dem Profil listet Beiträge, die
niemand öffnen kann; eine davon steht sogar ganz ohne Text da.

Alle drei sind Voraussetzung für Weiteres: der Chat am Feedback (eigener Prompt,
kommt später) braucht die Seite, und ein Beitrag, den man verlinken kann, braucht
erst einmal einen Ort, an dem er einzeln erreichbar ist.

## What Changes

**QM-Feedback wird eine eigene Seite.**

- Neue Route `/admin/feedback` hinter `RequireAdmin`, neuer Eintrag im
  Administrationsmenü (heute genau zwei Einträge, hart in `AppShell.tsx`).
- **BREAKING (intern):** `admin_list_feedback()` bekommt `p_limit`/`p_offset`
  und gibt zusätzlich `profile_id` heraus. Der Rückgabetyp ändert sich, also
  `drop` + `create` — `create or replace` kann das nicht. Sieben Zusagen in
  `rls_test.sql` hängen an der alten, argumentlosen Signatur und werden
  mitgezogen.
- Die Karte auf `/admin` **entfällt ersatzlos**. Zwei Flächen auf denselben
  Daten driften, sobald eine davon Paging bekommt — und genau das passiert hier.
- `profile_id` wird herausgegeben, obwohl sie heute keinen Aufrufer hat: der
  Chat braucht sie, und die Funktion wird für das Paging ohnehin neu angelegt.
  Sie später nachzureichen kostete eine zweite Migration für dieselbe Zeile.

**Die Reiter der Mitgliederliste tragen ihre Anzahl.**

- Eine **neue, eigene** RPC liefert die Zahlen. `admin_list_members` wird
  **nicht** angefasst: fünf Zusagen casten auf ihre exakte Signatur
  (`::regprocedure`, ein Fehler statt eines Fails), und eine weitere ist
  ausdrücklich als Wächter gegen zusätzliche Spalten gebaut.
- „Alle" und „Mitgliedschaft" teilen denselben Mengenzweig und tragen deshalb
  dieselbe Zahl. Das ist richtig, nicht doppelt.

**Die Aktivitäten-Karte wird begehbar.**

- Jede Zeile springt zu **ihrem** Beitrag im Feed, nicht in die Liste. Dafür
  entsteht ein Deeplink, den es heute nicht gibt: weder Route noch Parameter noch
  Anker.
- Ein Beitrag ohne Text zeigt einen Ersatztext statt einer leeren Zeile — an
  **beiden** Karten, denn `/p/:id` und `/profil` haben denselben Fehler.

**Nicht Teil dieses Changes:** der Chat am Feedback (eigener Prompt, AGE-587
hält den Befund fest) und anonymes Feedback (AGE-588).

## Capabilities

### New Capabilities

Keine. Alle vier berührten Fähigkeiten bestehen bereits.

### Modified Capabilities

- `feedback-qm`: Die Admin-Sicht auf das Feedback wird eine eigene Fläche, sie
  blättert, und sie kennt den Verfasser als Kennung statt nur als Namen.
- `admin`: Das Administrationsmenü trägt einen dritten Eintrag, und die Reiter
  der Mitgliederliste weisen die Zahl ihrer Mitglieder aus.
- `community-feed`: Ein einzelner Beitrag ist adressierbar — der Feed nimmt eine
  Beitragskennung entgegen, sucht sie auf und hebt sie hervor.
- `member-profiles`: Die Aktivitäten eines Profils sind begehbar, und ein
  Beitrag ohne Text wird benannt statt leer gezeigt.

## Impact

**Datenbank.** Eine Migration: `admin_list_feedback` neu (Signatur und
Rückgabetyp ändern sich), plus die neue Zähl-RPC. Beide `security definer` mit
`is_admin()`-Prüfung im Rumpf — die Fläche ist Komfort, nicht die Grenze.

**Zusagen, die mitgezogen werden müssen.** `rls_test.sql` an sieben Stellen
(argumentlose Aufrufe und `has_function_privilege` auf die alte Signatur).
`feedback.test.ts` prüft den Aufruf ohne Argumente. `AdminSettingsPage.test.tsx`
und `EinstellungenPage.test.tsx` beschreiben, wo die Karte steht — die eine wird
zur Negativzusage, wie es AGE-578 mit der anderen schon gemacht hat.

**Fläche.** Neue Seite plus Route plus Menüeintrag; `PublicProfilePage`,
`profil-widgets` und `CommunityFeed` werden berührt. Die Sichtprobe im Browser
ist Pflicht — jsdom sieht weder Layout noch Scrollen, und beide Themes heißen
hier `hell` und `navy` über `data-variant`, nicht die Einstellung des
Betriebssystems.

**Sicherheit.** Der Deeplink ist die heikelste Stelle: ein Verweis auf einen
Beitrag, den der Aufrufer nicht sehen darf, darf nicht verraten, dass es ihn
gibt. Das ist dieselbe Klasse wie das Existenz-Orakel, das die zweite Meinung in
AGE-582 an `post_saves` gefunden hat — und die Lehre daraus lautet, dass die
Zusage nicht „wird abgelehnt" heißt, sondern **„beide Fälle antworten gleich"**.
