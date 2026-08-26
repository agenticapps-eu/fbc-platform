# Tasks

## 1. Tiered name resolution (AGE-291, spec-relevant)

**Auslöser, festgeschrieben 22.08.2026 — hier steht, WANN diese vier Aufgaben
fällig werden.** Sie sind es heute nicht: `profiles_public` gibt jedem
aktivierten Konto jeden öffentlichen Namen, aber alle 71 Profile der
Import-Datenbank stehen auf `impact` (an dem Tag gemessen). Es gibt keine Stufe,
gegen die abgestuft werden könnte, also ist die Preisgabe folgenlos.

Fällig werden sie mit dem **ersten Konto unterhalb von `impact`** — praktisch
mit der Freischaltung des normalen Stufenwegs ab `basic` für Neuzugänge, laut
Go-Live-Zielbild etwa eine Woche nach dem Start. Ab diesem Konto liest ein
`basic`-Zugang jeden öffentlichen Mitgliedsnamen. Prüfbar an den Daten, nicht am
Kalender: `select count(*) from profiles where tier <> 'impact'` > 0.

Der Auslöser steht ebenso in `openspec/specs/directory-search/spec.md` und als
Kommentar an AGE-291.

- [ ] 1.1 Add a shared `resolve_display_name` predicate/function keyed off the
      caller's own tier (`auth.uid()` → rank), returning the full name for self and
      activated callers, else the "Mitglied" masked label
- [ ] 1.2 Make `profiles_public.name` (and `search_directory`) return the resolved
      name so a non-activated or anonymous caller never receives another member's
      full name; ensure ordering/full-text search do not leak it
- [ ] 1.3 Route every name-bearing surface (directory, feed, events, matching,
      profile views) through the shared resolver
- [ ] 1.4 Render whichever name value the server returns; never derive the full name
      client-side

## 2. Logout cache isolation (AGE-258, spec-relevant)

- [ ] 2.1 Clear (not just invalidate) the React Query cache on logout / principal
      change so a prior session's data cannot bleed into the next

## 3. Mein-Bereich inline accordion (AGE-292, client-only)

- [ ] 3.1 Convert the "Mein Bereich" sections into an inline accordion

## 4. Menu label cleanup (AGE-293, client-only)

- [ ] 4.1 Tidy the navigation menu labels

## 5. Verification

- [ ] 5.1 Test: an activated viewer sees another member's full name; a non-activated
      viewer and `anon` see "Mitglied", enforced server-side
- [ ] 5.2 Test: a member always sees their own full name
- [ ] 5.3 Test: the full name does not leak via directory search/ordering for a
      below-threshold caller
- [ ] 5.4 Test: after logout, the previous principal's cached data is not returned to
      the next principal
