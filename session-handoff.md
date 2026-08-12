# Session Handoff — 2026-08-12 (AGE-530 + AGE-529)

## Accomplished

**Beide Folge-Issues aus C7 sind erledigt, ausgerollt und archiviert.**
PR #163 (AGE-530) und PR #164 (AGE-529) sind gemerged, beide Deploys grün,
beide Changes in `openspec/specs/` gefaltet (+2 bzw. +4 Requirements).

- **AGE-530 — ohne Session wird nicht gefragt, was nicht lesbar ist.** Drei
  Lesepfade (`fetchAuthors`, `hostsFor`, `fetchComments`) bekommen den `uid`,
  den ihre Aufrufer längst halten. Keine Migration, kein Grant.
- **AGE-529 — ein `useOverlay()` für alle vier gemounteten Overlays.** Sperre
  (iOS-fest, exakte Rückgabe, Stapel statt Schalter) plus Fokus-Falle. Dazu der
  `lg`-Wächter in `AppShell`, ohne den der Change die Seite dauerhaft gesperrt
  hätte.
- **607 Tests grün**, Lint 0 Fehler, Typecheck sauber, Build ok.
- **Im echten Browser gemessen** (Chrome/DevTools-MCP gegen den lokalen Vite auf
  DEV): Sperre, exakte Rückgabe auf `scrollY = 600`, der `lg`-Wechsel — und
  nebenbei der AGE-530-401 live im Netzwerkverkehr, auf `/aktivitaet` **und**
  `/events`.

## Decisions

- **Umfang von AGE-530 erweitert** (Donald, im Gespräch): nicht nur der Feed,
  auch `events.ts`. Grund: `/events` ist ebenso ausgeloggt erreichbar und
  feuerte denselben 401 — am Netzwerkverkehr belegt.
- **Der DesignSwitcher bleibt aus AGE-529 draußen**, weil er seit AGE-492 gar
  nicht gemountet ist (`App.tsx:44`). Dafür kam die **Off-Canvas-Navigation**
  dazu, die im Issue-Tisch fehlte.
- **Kein `<Dialog>`-Primitiv**, nur ein Hook. Die vier Markups sind zu
  verschieden; ein Primitiv wäre entweder eine Sammlung von Sonderfällen oder
  ein Umbau aller vier. Begründung in `design.md`.
- **Drei Annahmen des Issues AGE-530 widerlegt** und im Vorschlag korrigiert:
  `partners` ist ebenfalls `authenticated`-only (also **zwei** 401 auf
  `/events`), `displayAuthor` maskiert längst (die Sicherheitsbegründung des
  Issues trägt nicht), und die Sentry-Behauptung stimmt nicht — beide Lesepfade
  schlucken ihren Fehler.
- **Ein Review-Befund begründet abgelehnt** (AGE-529): den Auslöser durch alle
  vier Anschlüsse zu reichen, nur weil Safari beim Zeigerklick nicht
  fokussiert. Der Rückfall entspricht dem heutigen Zustand; die Grenze steht als
  Kommentar im Code.
- **Kein Gate-Trailer in den `REVIEWS.md`.** Er bindet den Review per Digest an
  die Artefakte, die der Reviewer sah — und die wurden danach überarbeitet, weil
  er Befunde hatte. Ein handgesetzter Trailer behauptete eine Bindung, die es
  nie gab. Nicht blockierend, gilt für alle Changes im Repo.

## Files modified

- `src/lib/feed.ts`, `src/lib/events.ts` — `uid` in `fetchAuthors`, `hostsFor`,
  `fetchComments`; ohne ihn wird nicht abgefragt (AGE-530).
- `src/lib/anon-anreicherung.test.ts` — neu; prüft die **Regel** (anon-Positiv-
  liste aus `explicit_grants.sql`), nicht nur die drei Einzelfälle.
- `src/components/ui/useOverlay.ts` + `.test.tsx` — neu; Sperre und Falle.
- `AppShell.tsx` (Anschluss + `lg`-Wächter), `CommunityFeed.tsx` (Lightbox),
  `AvatarCropper.tsx`, `FeedbackButton.tsx` (Anschluss + `sm:fixed`).
- `AppShell.overlay.test.tsx` neu; Anschluss-Tests in `CommunityFeed.media`,
  `FeedbackButton`, `AvatarCropper`.
- `src/test/setup.ts` — `window.scrollTo`-Stub (jsdom kennt es nicht, sonst
  verrauscht jeder Lauf).
- `openspec/changes/anon-skips-author-enrichment/` und
  `openspec/changes/overlay-scroll-lock-and-focus-trap/` — je Vorschlag, Design,
  Deltas, Aufgaben, REVIEWS, DIFF-REVIEWS; bei AGE-529 zusätzlich EVIDENCE.

## Next session: start here

**Es ist nichts blockiert.** Was offen ist, sind drei Abnahmezeilen, die diese
Sitzung nicht leisten konnte — sie stehen in den `tasks.md` der beiden Archive
unter `openspec/changes/archive/2026-08-12-*`:

1. **AGE-529, 4.5 — die iPhone-Sichtprobe.** Der wichtigste offene Punkt. Ein
   Overlay öffnen, scrollen, schließen: die Seite darf sich dahinter nicht
   bewegen und beim Schließen nicht springen. Chrome ist nicht Safari, und
   genau dort ist `position: fixed` die Zusage, die nur am Gerät hält oder
   nicht.
2. **AGE-529, 4.3** — auf 375 px, **eingeloggt**, `elementFromPoint` in der Mitte
   jeder kuratierten Kachel im Composer. Braucht ein Konto: der Feedback-Knopf
   rendert für Nicht-Mitglieder gar nicht, ausgeloggt kann die Kollision also
   nicht entstehen.
3. **AGE-530, 3.4** — die eingeloggte Gegenprobe: Autorennamen, Avatare,
   Stufen-Badges und beide Host-Arten unverändert. Ebenfalls ein Konto.

Die **ausgeloggte** Hälfte von AGE-530 (3.3) ist erledigt und in der
Aufgabenliste mit den gemessenen Werten belegt: auf `/`, `/aktivitaet` und
`/events` feuert die Live-Seite kein `profiles_public`, kein `partners` und kein
`comments` mehr, Konsole fehlerfrei.

Inhaltlich ist damit **C8 an der Reihe** — der Zuschnitt liegt in Linear.

## Open questions

- **Nebenbefund, eigenes Issue wert:** der Kommentar an `bottom-20` im
  `FeedbackButton` begründet den Abstand mit dem DesignSwitcher — der ist seit
  AGE-492 nicht mehr gemountet. Der Knopf weicht also einem Knopf aus, den es
  nicht gibt. Bewusst nicht mitgenommen (Beifang).
- **Von mir versehentlich beendet:** `pkill -f vite` hat auch die zwei fremden
  Vite-Server auf Port 5173 gestoppt, die vor der Sitzung liefen. Neustart holt
  sie zurück.
- Aus früheren Sitzungen weiter offen: dunkles Theme färbt die Schale, nicht die
  Karten · `file_size_limit` für den `avatars`-Bucket fehlt · zwei
  Gestaltungsfragen aus 9.6 (3+1-Raster, Chip-Schreibweise) liegen bei Donald.
