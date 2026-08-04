## Reviewer: gemini

_generated 2026-08-04T11:38:05Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- The spec correctly notes that the server-side theme preference will overwrite the `localStorage` value on login, and calls for a "deliberate transition". This transition is undefined and could result in a jarring UX. Please specify the transition behavior (e.g., cross-fade) to prevent an experience that feels like a flash.
- The interaction between a logged-out user's `localStorage` theme and a logged-in user's server preference creates UX issues on shared devices. A second user logging in will briefly see the first user's theme before it's corrected by the server. Consider clearing the `localStorage` theme on logout to ensure a consistent, default starting point for the next session.
- The database-level rejection of unsupported theme values is a key data integrity feature. The spec should be explicit that this is implemented via a `CHECK` constraint on the `member_settings.theme` column to ensure it is not overlooked.
- The CI check for `grep -rni "gold"` is a great acceptance criterion, but it's too narrow. The check should be expanded to fail on any use of the other major tokens and mechanisms being retired (e.g., `--accent2`, `--color-fmt-*`, `data-card-style`) to prevent regressions.
- Self-hosting fonts is the correct decision for privacy, but can introduce a "flash of unstyled text" (FOUT) if not implemented with performance in mind. The spec should require that the primary font files are preloaded to mitigate this.

## Reviewer: codex

_generated 2026-08-04T11:40:10Z · timeout 180s_

VERDICT: REQUEST-CHANGES

- The first-paint requirement contradicts itself: runtime precedence includes the server, but pre-paint resolution cannot. A member with server `navy` and local `hell` necessarily sees the wrong initial theme. Define whether rendering waits for the server or explicitly permit this initial local frame.
- The signed-out switching scenario is unreachable: the only control is on the authenticated `/einstellungen` route, while `DesignSwitcher` is unmounted. Add a public control or remove/reword that scenario.
- Invalid query behavior conflicts with the stated teardown of `?variant=` support. If queries are ignored, `?variant=sommerfest` must not force `hell` over a valid stored `navy`; specify precedence for query, local, and server combinations.
- The “no `gold` anywhere under `src/`” invariant conflicts with retaining `src/vision/`, which still contains `gold` identifiers and is excluded by CI. Either remove/rename those references or scope the requirement explicitly to shipping code. CI also fails to prohibit other retired names such as `night`, `--accent2`, and `--color-fmt-*`.
- Persistence failure behavior is unspecified. “Written to both” cannot be guaranteed when the server write fails; define rollback, retry/error reporting, and which value wins later. Also specify behavior when no `member_settings` row exists.
- Calling the preference private conflicts with copying it into shared, script-readable `localStorage` and retaining it after logout. Theme choice is low sensitivity, but the requirement should qualify privacy as database owner-only or define account-scoped storage.
- “No third-party font host” is broader than the Google-only acceptance scenario. Require verification that every loaded font URL is same-origin, covering `fonts.gstatic.com` and non-Google CDNs.

## Triage (2026-08-04, implementierender Agent — von Donald noch nicht gegengelesen)

opencode lief in den 180-s-Timeout und fehlt daher als dritte Stimme. Beide
vorliegenden Voten sind REQUEST-CHANGES; jeder Punkt wurde gegen Delta **und**
Baum geprüft, nicht nur gegen den Text.

**Übernommen — Delta korrigiert:**

1. _(codex)_ First Paint widersprach sich: „dieselbe Präzedenz wie der
   Runtime-Resolver", während der Server dort mitspielt. Die Vorab-Auflösung ist
   jetzt ausdrücklich auf die synchron verfügbaren Gerätequellen beschränkt, der
   eine helle Frame bei abweichendem Serverwert ist benannt statt weggeschrieben.
2. _(codex, gemini)_ Die „deliberate transition" gab es nirgends im Code. Statt
   sie zu bauen, sagt der Delta jetzt die Wahrheit: ein einmaliges Umschalten,
   keine Animation.
3. _(codex)_ Das Szenario „ausgeloggt umschalten" war unerreichbar — der einzige
   Schalter sitzt auf `/einstellungen`, `DesignSwitcher` ist nicht gemountet.
   Szenario auf die Auflösung umgeschrieben, Anforderung sagt jetzt ausdrücklich,
   dass es ausgeloggt keinen Schalter gibt (samt Shared-Device-Folge).
4. _(codex)_ `?variant=` war zurückgebaut, das Szenario behauptete aber weiter
   eine Wirkung. Jetzt: Query wird ignoriert, auch bei gültigem Themennamen —
   mit eigenem Szenario gegen einen gespeicherten `navy`.
5. _(codex)_ „kein `gold` unter `src/`" kollidierte mit dem eingefrorenen
   `src/vision/`, das CI ausnimmt. Der Geltungsbereich steht jetzt im Delta.
6. _(codex, gemini)_ CI prüfte nur `gold`. Erweitert auf `--color-night`,
   `--accent2`, `--color-fmt-`, `data-card-style` — exakte Formen, weil `night`
   noch in genau einem erklärenden Kommentar steht. Per Sonde belegt.
7. _(codex)_ Fehlerfall des Server-Writes war unspezifiziert — und im Code mit
   einem leeren `catch` abgefangen. **Der einzige echte Code-Defekt des
   Reviews.** Delta beschreibt den Fall, `EinstellungenPage` meldet ihn jetzt,
   Test deckt ihn ab. Fehlende `member_settings`-Zeile: Upsert, jetzt benannt.
8. _(codex)_ Font-Szenario nannte nur `fonts.googleapis.com`. Jetzt
   Same-Origin-Aussage inkl. `fonts.gstatic.com` — was CI ohnehin schon prüfte.
9. _(codex)_ Privatheit: der Delta nennt jetzt ausdrücklich, dass owner-only die
   DB-Zeile meint und die localStorage-Kopie gerätelokal und skriptlesbar ist.

**Abgelehnt — mit Begründung:**

- _(gemini)_ `localStorage`-Theme beim Logout löschen. Widerspricht der
  ausdrücklichen Entscheidung „Signing out SHALL NOT reset the theme" (Delta +
  Migrationskopf). Das Shared-Device-Argument stimmt, wiegt aber leichter: beim
  Login gewinnt der Serverwert, der Fremdeindruck hält also nur bis zum
  Roundtrip — und der Preis wäre, dass jedes Mitglied nach jedem Logout wieder
  hell startet. Die Folge steht jetzt ausdrücklich im Delta.
- _(gemini)_ Der Delta soll den `CHECK`-Constraint beim Namen nennen. Eine Spec
  sagt Verhalten, nicht Mechanismus — „vom Server abgewiesen, nicht bloß vom
  Client" ist prüfbar und lässt die Umsetzung offen. Der Mechanismus steht im
  Migrationskopf.
- _(gemini)_ Fonts preloaden gegen FOUT. Implementierungsdetail, keine
  Anforderung; `font-display: swap` steht auf allen vier `@font-face`. Als
  Kandidat für C2 notiert, nicht in diesem Change.
