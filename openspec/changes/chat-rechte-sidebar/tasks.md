# Tasks — Chat als zweite angedockte Leiste rechts (AGE-627)

Reihenfolge ist nicht beliebig: **Daten vor Fläche.** Ein Panel auf der heutigen
Abfrage wäre eine Fläche, die man zurückbauen muss.

> Zweite Fassung nach der Plan-Review. Der frühere „RED-Test", der belegen
> sollte, dass die heutige Abfrage kein Limit hat, ist gestrichen: er wäre vor
> der Änderung **grün** gewesen und damit kein RED-Test. Ein Test, der den
> Ist-Zustand bestätigt, misst nichts.

## 1. Migration: Aktivitätsspalten auf `message_threads`

- [x] **RED**: pgTAP — `message_threads` hat `last_message_at`,
      `last_message_body`, `last_message_sender_id`; ein Insert in `messages`
      setzt alle drei; ein zweiter Insert überschreibt sie.
      → `supabase/tests/thread_aktivitaet_test.sql`, 15/15 rot vor der
      Migration („column last_message_body does not exist").
- [x] Migration mit Entscheidungskopf (signiert, datiert, verworfene
      Alternative = DEFINER-RPC): drei Spalten, `security definer`-Trigger auf
      `messages` (after insert), Index auf `(last_message_at desc)`.
      → `20260827120000_thread_aktivitaetsspalten.sql`.
- [x] **RED**: pgTAP — `authenticated` hat **kein** UPDATE-Recht auf
      `message_threads`, auch kein spaltenweises. Positivkontrolle: der Trigger
      schreibt trotzdem — gemessen unter der Identität des Absenders.
- [x] **RED**: pgTAP — ein Dritter sieht die neuen Spalten **nicht**
      (`threads_select` unverändert wirksam), mit Positivkontrolle am
      Teilnehmer und der Gegenprobe auf `messages`.
- [x] Rückfüllung für bestehende Threads im selben Migrationsschritt.
      **Nicht in `db reset` messbar** — sie läuft vor jedem Fixture, und es gibt
      keine `seed.sql`. Ein Test dafür müsste die UPDATE-Anweisung abschreiben
      und prüfte seine eigene Kopie. Der Beleg gehört an den Rollout: siehe
      Band 8.
- [x] `grants_test.sql` gegenprüfen: Golden-Snapshot muss **unverändert**
      bleiben. Ändert er sich, ist versehentlich ein Recht entstanden.
      → unverändert, `grants_test.sql` grün ohne eine einzige Änderung.
- [x] **GRÜN**, auch nach `supabase db reset`. 820 + 15 pgTAP-Zusagen grün.

**Zwei Dinge kamen beim Bauen dazu, beide begründet in der Migration:**

- [x] **Zweiter Trigger, `before insert on message_threads`.** Das INSERT-Recht
      auf der Tabelle **besteht** (`20260715140000:68`, tabellenweit) — ohne
      Vorkehrung könnte ein Mitglied beim Anlegen des Threads eine **erfundene
      Vorschauzeile** setzen, die sein Gegenüber zu sehen bekäme. Der Plan sah
      nur die UPDATE-Tür. Gegenprobe: Trigger entfernt → genau Test 10 fällt.
- [x] **Der Sortierschlüssel geht nur vorwärts.** `messages.created_at` ist vom
      Client setzbar; eine rückdatierte Nachricht dürfte den Thread nicht nach
      unten ziehen. Gegenprobe: Bedingung entfernt → genau Test 8 fällt.
- [x] `src/lib/database.types.ts` von Hand nachgezogen — die drei Spalten
      stehen **nur in `Row`**. `supabase gen types` NICHT darüberlaufen lassen.
- [x] `ci.yml` trägt die neue Testdatei ein.

## 2. `fetchThreads` liest die neue Form

- [x] **RED**: Vertragstest — die Abfrage geht gegen `message_threads`, trägt
      `order(last_message_at desc)` und ein `range`, und liest **`messages`
      gar nicht mehr**. An den Argumenten der Attrappe messen, nicht am
      Ergebnis. → `src/lib/chat.threads-seite.test.ts`, 10/10 rot vorher.
- [x] `fetchThreads(uid, { limit, offset })` gibt `{ threads, nextOffset }`.
- [x] **`nullsFirst: false` beim `order`.** `desc` ist in Postgres
      `nulls first` — ein Thread ohne einzige Nachricht stünde sonst GANZ OBEN,
      und der Index (`… desc nulls last`) käme nicht zum Zug.
- [x] **Abweichung vom Plan: `useInfiniteQuery` unter EINEM Schlüssel, statt
      Seitenparameter im Schlüssel.** Der Plan wollte die Parameter in den
      Schlüssel legen, damit Seite und Leiste sich nicht denselben
      Cache-Eintrag mit unterschiedlich vollständigen Ergebnissen
      überschreiben. `useInfiniteQuery` löst genau das an der Wurzel: beide
      Flächen teilen sich ausdrücklich `{pages, pageParams}`. „Eine
      Datenquelle, ein Umfang" wird damit eine Eigenschaft des Caches statt
      einer Verabredung zwischen zwei Flächen — und es ist das Muster, das
      `CommunityFeed` und `AcademyPage` in diesem Repo schon tragen.
- [x] Alle Invalidierungen nachziehen — **entfällt durch die Abweichung**:
      `ChatPage.tsx:88,123` invalidieren weiterhin unter `threadsQueryKey(uid)`,
      und das ist jetzt der Schlüssel der Infinite-Query. Geprüft, nicht
      angenommen.
- [ ] `ChatPage` lädt dieselbe Seite wie das Panel. Eine Datenquelle, ein
      Umfang. → Der Mechanismus steht (ein Schlüssel); **belegen lässt es sich
      erst mit dem Panel** — Band 6.
- [x] **Nachladen sichtbar machen** auf `/chat`: „Weitere Gespräche", nur wenn
      ein Versatz folgt. Gegenprobe: Bedingung durch `true` ersetzt → genau der
      Test „bietet sie NICHT an" fällt. → `src/pages/ChatPage.seite.test.tsx`.
- [ ] Dasselbe auf der Leiste — Band 6.

## 3. Realtime — ein Abo bleibt ein Abo

- [x] **RED**: Test, dass ein eingehendes `messages`-INSERT **auch** die
      Threads-Seite invalidiert, nicht nur den Zähler.
      → `src/components/chat/use-ungelesen.live.test.tsx`.
- [x] `useUngelesenLive` (`use-ungelesen.ts:63–92`) erweitert — **eine Zeile**
      im schon vorhandenen, entprellten Zeitgeber. **Kein** zweiter
      `subscribeToAllMessages`-Aufruf.
- [x] **RED→GRÜN**: genau **eine** Subscription über die Lebensdauer der Hülle,
      gemessen über einen Pfadwechsel hinweg (mit demselben `QueryClient` —
      ein neuer stünde in der Abhängigkeitsliste und löste ein Neu-Abonnieren
      aus, das mit dem Pfad nichts zu tun hat).
- [x] Die Ausnahme bleibt: fällt die Nachricht in den **offenen** Pfad
      (`/chat/:threadId`), invalidiert der Hook **gar nichts** — `ChatPage`
      fragt ohnehin neu ab, und zwar NACH seinem Schreibvorgang. Als eigener
      Test festgehalten, sonst wäre „invalidiert" von „invalidiert immer" nicht
      zu trennen.

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
- [ ] **Nach `db push` auf DEV und PROD:** zählen, wieviele Threads MIT
      Nachricht ein leeres `last_message_at` haben. Erwartet: null. Das ist der
      einzige echte Beleg für die Rückfüllung aus Band 1.
- [ ] Diff-Review durch einen fremden Anbieter.
- [ ] `REVIEWS.md` um die Auflösung der übrigen Befunde ergänzen.
