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

## 4. Die rechte Leiste (Shell, ≥ **xl** — nicht `lg`, siehe Band 7)

- [x] **RED**: Test, dass die Hülle zwei angedockte Leisten rendert und der
      Inhalt dazwischen liegt. → `src/components/AppShell.chatleiste.test.tsx`.
- [x] **RED**: Test, dass die rechte Leiste **ausgeloggt gar nicht** erscheint.
      Gegenprobe: `Boolean(user)` entfernt → genau dieser Test fällt.
- [x] `--fbc-chat-w` analog `--fbc-sidebar-w`; `.fbc-shell-offset` bekommt
      `padding-right` **in derselben Regel, mit Transition**.
- [x] `<aside>` rechts: `fixed inset-y-0 right-0`, `border-l`, `hidden xl:flex`.
- [x] Zuklapp-Knopf über `Icon name="chevronLeft"` (**kein** Inline-`<svg>`),
      `aria-expanded`, eigener Name je Zustand.
- [x] Eigener Speicherschlüssel `fbc.chatCollapsed`, getrennt von
      `fbc.sidebarCollapsed`; Startwert **eingeklappt**; Lesen und Schreiben in
      `try`/`catch`.
- [x] **RED→GRÜN**: beide Leisten merken sich unabhängig.
- [x] **Threads erst laden, wenn geöffnet** — und zwar über die **Montage**,
      nicht über einen Schalter am Panel. Die Bedingung steht damit an EINER
      Stelle. Gemessen sind zwei Fälle: eingeklappt, und *aufgeklappt unter
      `xl`* (CSS verbirgt, es hält keine Abfrage an).
- [x] **RED**: Test, dass das Panel auf `/chat` und `/chat/:threadId`
      **ausblendet**. Gegenprobe: Routenprüfung entfernt → genau diese zwei
      Tests fallen.
- [x] **Beim Umbau selbst gefunden:** der Startwert von `istBreit` las noch
      `lg`, während der Effect schon `xl` prüfte — der erste Anstrich montierte
      das Panel und holte eine Seite Threads, bevor der Effect es zurücknahm.
      Aufgefallen ist das nur, weil ein Test die Breite **1152 px** stellt.

## 5. Unter `xl`: Drawer von rechts

- [x] Eigener Öffner in der Topbar, `xl:hidden`, eigener zugänglicher Name
      („Nachrichten-Leiste öffnen"). Die Sprechblase bleibt ein Link auf
      `/chat` — der Grundsatz in `AppShell.tsx:68` wird **nicht** gebrochen.
- [x] **Anderes Glyph als die Sprechblase daneben** (`chevronLeft`, nicht
      `messages`): zwei gleiche Sprechblasen nebeneinander wären zwei Namen für
      dasselbe. Der Pfeil sagt, was passiert — eine Leiste kommt von rechts.
- [x] **RED**: Test, dass das Öffnen des einen Drawers den anderen schließt —
      **in beide Richtungen**. Zwei Gegenproben, zwei gefallene Tests.
- [x] **RED**: Test, dass ein Sprung über `xl` den rechten Drawer schließt,
      **und die Scroll-Sperre freigibt**. Das ist der teure Teil, nicht die
      unsichtbare Schublade.
- [x] **RED**: Test, dass die Wahl eines Threads die Sperre freigibt.
- [x] Escape, Backdrop, Dialog-Benennung — als Tests. `useOverlay` bringt Sperre
      und Tab-Falle mit, **kein** Escape; das ist ein eigener Effect daneben.

## 6. Inhalt der Leiste

- [x] Unterhaltungsliste aus `ThreadList` wiederverwendet, nicht neu gebaut.
- [x] Ungelesen-Marker je Zeile; Null wird **nicht** gerendert — mit
      Positivkontrolle am Nachbar-Thread, der gar keine Zahl trägt.
- [x] Klick öffnet `/chat/:threadId` — eine Adresse je Gespräch.
- [x] Eingeklappt: Sprechblase + Zähler im Rail, mit zugänglichem Namen (die
      Zahl steht im NAMEN, nicht nur in der Blase).
- [x] **Drei Zustände, nicht einer:** Laden · Fehler · echte Leere. Gegenprobe:
      Fehlerzweig entfernt → genau der Test „nennt es NICHT Leere" fällt.
- [x] Der leere Zustand hängt an **Threads**, nicht an akzeptierten Kontakten.
- [x] „Weitere Gespräche" auch hier — dieselbe Zusage wie auf `/chat`.

## 7. Nachweis am laufenden Bild (nicht in jsdom)

Gefahren am 27.08. gegen den lokalen Stack, mit vier angelegten Konten, drei
angenommenen Kontakten und drei Threads. **Diese Sichtprobe hat zwei
Entscheidungen umgeworfen — beide waren in jsdom unsichtbar.**

- [x] Breite über den **ganzen Bereich 1024–1440 px** gemessen, beide Leisten
      offen und eingeklappt, am Inhaltsbedarf statt an `scrollWidth`.

      **Befund 1 — der Umbruchpunkt.** Angedockt ab `lg` mit 20 rem blieben bei
      1024 px noch **433 px** Inhalt, und im Verzeichnis standen Namen auf EIN
      Zeichen gekürzt. Ursache ist nicht die Leiste allein: die Raster des
      Hauses (`MemberDirectory:554` — `sm:grid-cols-2 lg:grid-cols-3`) hängen am
      **Viewport**, nicht an der Spalte, und bleiben dreispaltig, während die
      Spalte schrumpft. Umgebaut auf **`xl` und 18 rem**. Gemessen danach:
      1024 px → 753 px Inhalt (unverändert gegenüber vorher), 1280 px → 721 px,
      1440 px → 881 px, überall **null** Überläufer.

- [x] Nicht nur das Verzeichnis: `/chat` selbst (Leiste blendet aus, volle
      Breite) und `/einstellungen` als `NARROW_ROUTE` — Lesespalte bei 760 px
      gedeckelt, rechte Kante 1077 px, Leiste beginnt bei 1137 px.

- [x] Beide Themes über `data-variant`.

      **Befund 2 — zwei Flächen statt einer.** Im navy-Theme stand ein navyer
      Kopf über einer weissen Liste. Im hellen Theme ist das unsichtbar, weil
      dort beide Flächen weiss sind. Aufgelöst: eingeklappt ist die Leiste
      **Chrome** (Rail wie links), aufgeklappt ist sie **Inhalt** — `ThreadList`
      schreibt in `text-ink` auf `hover:bg-soft` und wäre auf Chrome unlesbar.

- [x] Telefonbreite (375 px und 320 px): Drawer von rechts, gegenseitiger
      Ausschluss, Escape, Backdrop, Sperre wird freigegeben. Null Überläufer.

- [x] **Die zwei Nachrichten-Bedienelemente unter `xl` angesehen.** Sie bleiben
      beide: die Kopfzeile braucht bei 320 px **268 px** und hat 52 px Reserve,
      und die beiden tragen verschiedene Glyphen (Sprechblase = der Ort,
      Pfeil = die Leiste). Der Grundsatz „ein Link, kein Knopf" bleibt heil.

- [ ] Donald die laufende lokale Fassung zeigen. Server läuft auf
      `http://localhost:5201` (`mess-a@test.local` / `Probe-2026-lokal`).

## 8. Abschluss

- [x] Volle Suite (`vitest run` ohne Pfadfilter): **1870 Zusagen in 166 Dateien**,
      grün. Typecheck grün, Lint 0 Fehler (5 vorbestehende Warnungen).
- [x] `supabase test db` **mit Dateiliste**: 14 Dateien, **835 Zusagen**, grün —
      auch nach `supabase db reset`.
- [x] `openspec validate --all` grün (29/29).
- [ ] **Nach `db push` auf DEV und PROD:** zählen, wieviele Threads MIT
      Nachricht ein leeres `last_message_at` haben. Erwartet: null. Das ist der
      einzige echte Beleg für die Rückfüllung aus Band 1.
- [ ] ~~Diff-Review durch einen fremden Anbieter~~ — **nicht zustande gekommen.**
      Alle drei Arme haben am 27.08. versagt: `opencode` antwortet gar nichts,
      `codex` lädt die gstack-Skill-Sammlung statt zu prüfen, `cursor-agent`
      will ein Login. Ausführlich in `REVIEWS.md`, samt dem, was stattdessen an
      Belegen dasteht (zehn Gegenproben, die Sichtprobe, ein so gefundener
      Fehler). **Bleibt offen und ist nicht ersetzt.**
- [x] `REVIEWS.md` um die Auflösung der übrigen Befunde ergänzt.
