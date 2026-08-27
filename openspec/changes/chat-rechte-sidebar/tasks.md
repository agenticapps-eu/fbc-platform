# Tasks — Chat als zweite angedockte Leiste rechts (AGE-627)

Reihenfolge ist nicht beliebig: **Daten vor Fläche.** Ein Panel auf der heutigen
Abfrage wäre eine Fläche, die man zurückbauen muss.

> Zweite Fassung nach der Plan-Review. Der frühere „RED-Test", der belegen
> sollte, dass die heutige Abfrage kein Limit hat, ist gestrichen: er wäre vor
> der Änderung **grün** gewesen und damit kein RED-Test. Ein Test, der den
> Ist-Zustand bestätigt, misst nichts.

## 1. Migration: Aktivitätsspalten auf `message_threads`

- [ ] **RED**: pgTAP — `message_threads` hat `last_message_at`,
      `last_message_body`, `last_message_sender_id`; ein Insert in `messages`
      setzt alle drei; ein zweiter Insert überschreibt sie.
- [ ] Migration mit Entscheidungskopf (signiert, datiert, verworfene
      Alternative = DEFINER-RPC): drei Spalten, `security definer`-Trigger auf
      `messages` (after insert), Index auf `(last_message_at desc)`.
- [ ] **RED**: pgTAP — `authenticated` hat **kein** UPDATE-Recht auf
      `message_threads`, auch kein spaltenweises. Positivkontrolle: der Trigger
      schreibt trotzdem.
- [ ] **RED**: pgTAP — ein Dritter sieht die neuen Spalten **nicht**
      (`threads_select` unverändert wirksam).
- [ ] Rückfüllung für bestehende Threads im selben Migrationsschritt.
- [ ] `grants_test.sql` gegenprüfen: Golden-Snapshot muss **unverändert**
      bleiben. Ändert er sich, ist versehentlich ein Recht entstanden.
- [ ] **GRÜN**, auch nach `supabase db reset`.

## 2. `fetchThreads` liest die neue Form

- [ ] **RED**: Vertragstest — die Abfrage geht gegen `message_threads`, trägt
      `order(last_message_at desc)` und ein `range`, und liest **`messages`
      gar nicht mehr**. An den Argumenten der Attrappe messen, nicht am
      Ergebnis.
- [ ] `fetchThreads(uid, { limit, offset })`; `threadsQueryKey` bekommt die
      Seitenparameter.
- [ ] Alle Invalidierungen nachziehen — `ChatPage.tsx:88,123` invalidiert heute
      unter dem alten Schlüssel.
- [ ] `ChatPage` lädt dieselbe Seite wie das Panel. Eine Datenquelle, ein
      Umfang.
- [ ] **Nachladen sichtbar machen:** „Mehr laden" auf beiden Flächen. Ohne das
      ist der Rest jenseits der ersten Seite dauerhaft unerreichbar — und ein
      Szenario der eigenen Spec unerfüllt.

## 3. Realtime — ein Abo bleibt ein Abo

- [ ] **RED**: Test, dass ein eingehendes `messages`-INSERT **auch** die
      Threads-Seite invalidiert, nicht nur den Zähler.
- [ ] `useUngelesenLive` (`use-ungelesen.ts:63–92`) erweitern. **Kein** zweiter
      `subscribeToAllMessages`-Aufruf — der Kanalname trägt `randomUUID()`,
      ein zweiter Aufruf macht einen zweiten Kanal auf.
- [ ] **RED→GRÜN**: genau **eine** Subscription über die Lebensdauer der Hülle.

## 4. Die rechte Leiste (Shell, ≥ lg)

- [ ] **RED**: Test, dass die Hülle bei `lg` zwei angedockte Leisten rendert
      und der Inhalt dazwischen liegt.
- [ ] **RED**: Test, dass die rechte Leiste **ausgeloggt gar nicht** erscheint.
- [ ] `--fbc-chat-w` analog `--fbc-sidebar-w`; `.fbc-shell-offset` bekommt
      `padding-right` **in derselben Regel, mit Transition** — `index.css:264–269`
      überblendet heute nur `padding-left`.
- [ ] `<aside>` rechts: `fixed inset-y-0 right-0`, `border-l`, `hidden lg:flex`,
      Fläche über `SIDEBAR_SURFACE` — gespiegelt zu `AppShell.tsx:455`.
- [ ] Zuklapp-Knopf über `Icon name="chevronLeft"` (**kein** Inline-`<svg>`),
      `aria-expanded`, eigener Name je Zustand.
- [ ] Eigener Speicherschlüssel, getrennt von `fbc.sidebarCollapsed`; Startwert
      **eingeklappt**; Lesen und Schreiben in `try`/`catch`.
- [ ] **RED→GRÜN**: beide Leisten merken sich unabhängig.
- [ ] **Threads erst laden, wenn geöffnet.** Der Rail braucht nur den Zähler,
      den es getrennt schon gibt. Ladebedingung testen.
- [ ] **RED**: Test, dass das Panel auf `/chat` und `/chat/:threadId`
      **ausblendet**.

## 5. Unter `lg`: Drawer von rechts

- [ ] Eigener Öffner in der Topbar, gespiegelt zum Hamburger
      (`AppShell.tsx:513–520`): `lg:hidden`, eigener zugänglicher Name.
      Die Sprechblase bleibt ein Link auf `/chat` — der Grundsatz in
      `AppShell.tsx:68` wird **nicht** gebrochen.
- [ ] **RED**: Test, dass das Öffnen des einen Drawers den anderen schließt.
- [ ] **RED**: Test, dass ein Sprung über `lg` den rechten Drawer schließt —
      dieselbe Behandlung wie `AppShell.tsx:421–432`.
- [ ] **RED**: Test, dass die Wahl eines Threads den Drawer schließt. Sonst
      steht er samt Scroll-Sperre über der neuen Seite (links tut das
      `onNavigate`, `AppShell.tsx:631`).
- [ ] Escape, Backdrop, Fokus-Rückgabe, Dialog-Benennung — als Tests, nicht nur
      in der Sichtprobe. `useOverlay` bringt Sperre und Tab-Falle mit, **kein**
      Escape; das ist links ein eigener Effect (`AppShell.tsx:408–415`).

## 6. Inhalt der Leiste

- [ ] Unterhaltungsliste aus `ThreadList` wiederverwenden, nicht neu bauen.
- [ ] Ungelesen-Marker je Zeile; Null wird **nicht** gerendert (Spec).
- [ ] Klick öffnet `/chat/:threadId` — eine Adresse je Gespräch.
- [ ] Eingeklappt: Sprechblase + Zähler im Rail, mit zugänglichem Namen.
- [ ] **Drei Zustände, nicht einer:** Laden · Fehler · echte Leere. `data ?? []`
      zeigt einen RLS-Fehler als „keine Kontakte".
- [ ] Der leere Zustand hängt an **Threads**, nicht an akzeptierten Kontakten —
      Threads überleben einen späteren Statuswechsel.

## 7. Nachweis am laufenden Bild (nicht in jsdom)

- [ ] Breite über den **ganzen Bereich 1024–1280 px** messen, beide Leisten
      offen und eingeklappt. Am Inhaltsbedarf messen, **nicht** an `scrollWidth`
      (AGE-502).
- [ ] Nicht nur das Mitgliederverzeichnis: auch `/chat` selbst und die
      `NARROW_ROUTES` mit ihrem Lesespalten-Deckel.
- [ ] Beide Themes (hell und navy über `data-variant`).
- [ ] Telefonbreite: beide Drawer, gegenseitiger Ausschluss, Fokus, Escape.
- [ ] **Die zwei Nachrichten-Bedienelemente unter `lg` ansehen** — Sprechblase
      und neuer Öffner nebeneinander. Wenn es zu eng wirkt, ist das der Moment,
      eins davon zu streichen.
- [ ] Donald die laufende lokale Fassung zeigen, **bevor** committet wird.

## 8. Abschluss

- [ ] Volle Suite (`vitest run` ohne Pfadfilter) — ein Teillauf hat in AGE-625
      einen Wächter in `src/components/ui` verfehlt, während die CI rot war.
- [ ] `supabase test db` **mit Dateiliste** — ohne sie meldet der Befehl FAIL
      trotz grün.
- [ ] `openspec validate --all` grün.
- [ ] Diff-Review durch einen fremden Anbieter.
- [ ] `REVIEWS.md` um die Auflösung der übrigen Befunde ergänzen.
