# Der Chat wird eine zweite angedockte Leiste an der rechten Viewport-Kante

Linear: **AGE-627**

> **Zweite Fassung.** Die erste versprach eine serverseitig sortierte, begrenzte
> Thread-Seite **und** „keine Migration, kein Server". Beide Plan-Reviewer haben
> unabhängig voneinander belegt, dass das nicht beides zu haben ist
> (`REVIEWS.md`). Die Datenfrage ist jetzt in `design.md` beantwortet, und die
> Migration steht im Zuschnitt.

## Why

Nachrichten sind heute ein Ziel, kein Begleiter. Wer sie sehen will, verlässt
die Seite, auf der er ist: die Sprechblase in der Topbar (`AppShell.tsx:85–112`,
AGE-583) führt auf `/chat`, und dort ist man weg vom Verzeichnis, vom Feed, vom
Profil, das man gerade gelesen hat.

Donald am 27.08., mit Referenzbild des LinkedIn-Panels: der Chat soll **immer
sichtbar** sein, als rechte Leiste mit der Liste der Unterhaltungen; ein Klick
auf einen Eintrag öffnet den Chat mit diesem Kontakt. Und die Präzisierung, die
den Zuschnitt entscheidet: **„Bzw so wie bei der linken Sidebar nach rechts
einklappen!"** — ausdrücklich nicht nach unten wie im Vorbild.

Die zweite Präzisierung grenzt ab, was **nicht** hierher gehört: „Die Chat
Sidebar ist komplett getrennt, die anderen Sidebars sind wie bei Aktivität unter
dem Header noch, rechte Chat Sidebar ist komplett wie die linke Sidebar." Die
Such- und Filterspalten liegen damit auf einer anderen Ebene — im
Inhaltsbereich, nicht an der Viewport-Kante — und sind nach **AGE-629**
ausgelagert. Dieser Change fasst sie nicht an.

## What Changes

**Daten (zuerst, weil die Fläche darauf steht):**

- `message_threads` bekommt `last_message_at`, `last_message_body` und
  `last_message_sender_id`, gepflegt von einem `security definer`-Trigger auf
  `messages`. Damit wird die Liste **eine** begrenzte, serverseitig sortierte
  Abfrage; `messages` wird für die Liste gar nicht mehr gelesen. Begründung,
  verworfene Alternative und der Nachweis, dass das **keine** Lesebestätigung
  ist: `design.md`.
- `fetchThreads` bekommt Seitenparameter, und `threadsQueryKey` bekommt sie
  auch — sonst teilen Panel und `/chat` einen Cache-Eintrag.
- **`/chat` lädt künftig ebenfalls eine Seite.** Es gibt eine Datenquelle mit
  einem Umfang; beide Flächen zeigen denselben. (Die erste Fassung behauptete,
  `/chat` bleibe unverändert — das war mit „dieselben Threads" und „begrenzte
  Seite" zusammen nicht erfüllbar.)

**Fläche:**

- Eine **zweite angedockte Leiste an der rechten Viewport-Kante**, gebaut nach
  denselben Regeln wie die linke: volle Höhe, bündig am Rand, Trennlinie statt
  Schatten. Sie trägt die Unterhaltungsliste.
- **Nur für angemeldete Mitglieder.** Die Hülle rendert auch ausgeloggt
  (`AppShell.tsx:578–587`); ein Rail mit Sprechblase für einen Gast wäre ein
  Versprechen ins Leere.
- **Beim ersten Besuch eingeklappt**, mit eigenem Speicherschlüssel neben dem
  der linken Leiste.
- Unterhalb `lg` ein **Off-Canvas-Drawer von rechts** mit **eigenem Öffner** in
  der Topbar, gespiegelt zum Hamburger (`AppShell.tsx:513–520`). Höchstens ein
  Drawer ist offen.
- **Auf `/chat` und `/chat/:threadId` blendet das Panel aus** — dort stünde die
  Liste sonst zweimal auf einem Schirm.
- `/chat` bleibt als Route bestehen. Unterhalb `lg` und aus einer E-Mail heraus
  ist die Vollseite weiterhin der Weg.

## Impact

- Betroffene Fähigkeiten: `design-system` (die Shell-Anforderung kennt heute nur
  *die* Sidebar) und `messaging` (Einstiegspunkte, Laden der Liste).
- **Eine Migration.** Drei Spalten, ein Trigger, ein Index. Kein neues
  Tabellenrecht: der Trigger ist `security definer`, der Client schreibt diese
  Spalten nie, und der Golden-Snapshot in `grants_test.sql` bleibt unberührt —
  er listet UPDATE-Spalten-Grants, und wir sprechen keinen aus.
- **Keine neue RLS.** Die Spalten liegen unter der bestehenden
  `threads_select`-Policy. Gemessen: `threads_select` und `messages_select`
  reichen exakt gleich weit (beide: die zwei Teilnehmer plus `is_activated()`,
  `20260806080100:214–231`). Wer die Vorschauzeile liest, konnte die Nachricht
  vorher schon lesen.
- **Kein zweites Realtime-Abo.** `useUngelesenLive` (`use-ungelesen.ts:63–92`)
  besitzt das einzige globale `messages`-Abo; es invalidiert künftig auch die
  Threads-Seite. Ein zweiter `subscribeToAllMessages`-Aufruf würde einen zweiten
  Kanal öffnen (`chat.ts:220` baut den Namen mit `randomUUID()`).
- **Keine Mitgliedsstufe** für das Panel — `/chat` trägt bewusst kein `minTier`
  (`nav.ts:152`, AGE-311). **Aber:** `fetchThreads` liest Partnernamen aus
  `profiles`, und `profiles_select_self_or_discover` gibt fremde Profilzeilen
  erst ab `discover` frei. Auf `basic` und `connect` steht deshalb der
  Rückfalltext statt eines Namens. Das ist heute schon so und wird von diesem
  Change **nicht** repariert — aber es wird benannt, statt als „keine
  Mitgliedsstufe" glattgeredet zu werden.

## Der Befund, der die Reihenfolge bestimmt

`src/lib/chat.ts:240–265` holt alle Threads des Mitglieds und dazu **alle
Nachrichten aller dieser Threads** — ohne `limit` —, um daraus im Client die
jüngste Zeile je Thread zu gewinnen.

Der Aufwand wächst mit dem, was Mitglieder **schreiben**, nicht mit ihrer
Anzahl. Er ist also am Starttag unsichtbar und wird genau dann teuer, wenn das
Feature angenommen wird.

Eine Genauigkeit, die die Review erzwungen hat: `AppShell` bleibt beim Wechsel
zwischen Kindrouten **montiert**. Die Kosten fallen also nicht bei jedem
Seitenwechsel neu an, sondern beim Start der Hülle und bei jedem Refetch. Das
macht den Befund nicht kleiner, aber die erste Fassung hat ihn falsch
begründet.

Und: der eingeklappte Rail braucht nur den Zähler, den es getrennt schon gibt.
**Threads werden erst geladen, wenn die Leiste oder der Drawer geöffnet wird.**

## Fallen, die dieser Entwurf umgeht

1. **Zwei Drawer, eine Scroll-Sperre — trägt schon.** Naheliegende Vermutung
   wäre, dass ein zweites Overlay die Sperre aus AGE-529 zerreißt. Gemessen in
   `useOverlay.ts:32–66`: sie hängt an einem **Stapel**, nur `0→1` sperrt, nur
   `1→0` gibt frei. Dieser Change muss dafür **nichts** bauen. Der gegenseitige
   Ausschluss bleibt trotzdem — zwei Schubladen über demselben Inhalt sind auf
   einem Telefon keine Bedienung.
2. **Der Drawer beim Sprung über `lg`.** `AppShell.tsx:421–432` schließt den
   linken Drawer beim Überschreiten von `lg`; ohne das bliebe die Scroll-Sperre
   stehen. Der rechte braucht dieselbe Behandlung.
3. **Ein Drawer, der beim Navigieren offen bleibt.** Links schließt
   `onNavigate` an jedem Link (`AppShell.tsx:631`). Die Threadzeilen sind
   Knöpfe mit `navigate()` — ohne Entsprechung stünde der Drawer samt Sperre
   über der neuen Seite.
4. **`fbc-shell-offset` versorgt drei Flächen** — `<header>` (`:511`),
   `<main>` (`:595`) und den Pflichtlink-Fuß (`:608`). Der Versatz nach rechts
   gehört in **dieselbe** CSS-Regel, **samt Transition**: `index.css:264–269`
   überblendet heute nur `padding-left`, sonst ruckt die rechte Seite beim
   Klappen.
5. **Ein `<svg>` von Hand bricht die CI.** `icons.test.ts` verbietet rohe
   `<svg>` außerhalb des Icon-Satzes; in AGE-625 hat genau das den Lauf rot
   gemacht.
6. **`data ?? []` macht aus einem Fehler eine Aussage.** Ein Netz- oder
   RLS-Fehler erschiene als „keine Kontakte" — eine falsche Erklärung an das
   Mitglied. Laden, Fehler und echte Leere sind drei Zustände.
7. **„Keine akzeptierten Kontakte" ist nicht „keine Threads".** Threads
   entstehen bei der Annahme und werden bei einem späteren Statuswechsel nicht
   gelöscht; `threads_select` verlangt keine aktuell akzeptierte Anfrage. Der
   leere Zustand hängt an **Threads**, nicht an Kontakten.
8. **Der engste Desktop ist 1024 px, nicht 1280.** Direkt oberhalb von `lg`
   lassen zwei offene 16-rem-Leisten 512 px vor jedem Innenabstand. Gemessen
   wird der ganze Bereich 1024–1280 px, und auch die `NARROW_ROUTES` mit ihrem
   Lesespalten-Deckel.

## Was ausdrücklich nicht dazugehört

- **Such- und Filterspalten** auf Mitglieder, Events, Academy → **AGE-629**.
- **Ein Suchfeld im Panel.** Ohne geklärte Semantik — Kontakte oder
  Nachrichtentexte? — ein eigener Vorgang.
- **Die Unterhaltung selbst im Panel.** Dieser Change zeigt die *Liste*.
- **Cursor-Paging.** Offset ist bewusst gewählt; die Begründung und der Punkt,
  an dem es umschlagen muss, stehen in `design.md`.
- **Der Profilnamen-Rückfall unterhalb `discover`.** Benannt, nicht behoben.
