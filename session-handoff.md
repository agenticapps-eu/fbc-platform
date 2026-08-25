# Session Handoff — 2026-08-25 (dreiundzwanzigste Sitzung, AGE-582 Abschnitt 7)

**Abschnitt 7, die Abnahme, ist vollständig — alle acht Aufgaben abgehakt, und
PR #205 ist GEMERGT** (`480f529`, per `gh pr view --json state` bestätigt).
Damit ist der ganze Change durchgearbeitet: Abschnitte 1–7.

**Der Stand nach dem Merge, gemessen an der HEAD-SHA von `main`:**

| Check | Ergebnis |
|---|---|
| `verify`, `migrations`, `edge-functions`, `build` | success |
| **`migrate-dev`** | **success — die sieben Migrationen sind jetzt auf DEV** |
| **`drift-gate`** | **failure — sie fehlen auf PROD** |
| `deploy` (Workflow „Deploy") | **skipped**, vom Gate geblockt |

Das `deploy: success` in der Liste gehört zu `pages-build-deployment`, einer
FREMDEN Workflow. Die Fläche ist also **nicht** ausgeliefert.

## Accomplished

**7.1** lint (0 Fehler, 4 vorbestehende Warnungen), typecheck, **1546/1546**,
build. **7.2** `supabase test db` mit ausdrücklicher Dateiliste: **9 Dateien,
684 Zusagen, PASS**. Ohne die Liste meldet der Befehl FAIL, obwohl grün.
Integrationslauf 17/17.

**7.7 — die Zähler verraten nichts, per pgTAP.** `feed_sidebar_test.sql` von 18
auf 26 Zusagen. Die alten maßen zwei Ränge; das Prädikat hat aber **drei**
Zweige, und der dritte ist `author_id = auth.uid()`. Zwei Betrachter DESSELBEN
Rangs bekommen für denselben Tag verschiedene Zahlen, wenn einer der Verfasser
ist. Dazu das Gegenstück zu `sbverdeckt` auf der Autorenseite und der scharfe
Gesamtabgleich: für jeden aktiven kuratierten Tag ist die Zahl der Funktion
**exakt** die Zahl der Beiträge, die derselbe Aufrufer aufzählen kann.

**7.3–7.6 im Browser**, gegen den lokalen Stack. Beide Themes maßgleich bis auf
den Pixel, bei 1440 und bei 375. Ausgeloggt: ein Reiter, kein Speichern-Knopf,
„Ein Mitglied" als Verfasser, `feed_top_authors` **gar nicht erst angefragt**.
Speichern füllt und leert „Gespeichert" in beide Richtungen ohne Neuladen. Zwei
Haken: 4 + 4 = **8**, die Vereinigung.

**7.8 — zwei fremde Vendoren, sieben Befunde, alle behoben.** codex
(`gpt-5.2-codex`, ~35 min, liest das Repo selbst) und gemini (`gemini-3-pro`,
Diff auf stdin, ~2 min). Beide REQUEST-CHANGES. **Jede Behebung trägt eine
Zusage, die unter einer absichtlichen Verbiegung rot wird.**

- **[MEDIUM] `post_saves` war ein Existenz-Orakel.** Gegen den lokalen Stack
  nachgestellt, BEVOR eine Zeile geschrieben wurde: ein `basic`-Mitglied liest
  einen `members`-Beitrag nicht (null Zeilen), kann ihn aber speichern — mit
  einer erfundenen Kennung bricht dieselbe Anweisung an `23503`. Die Auskunft kam
  nicht aus der Policy, sondern aus dem **Fremdschlüssel**, dessen Prüfung
  ausdrücklich an der RLS vorbeiläuft. Neue Migration
  `20260825090000_post_saves_kein_existenz_orakel.sql`; +5 Zusagen (24 → 29).
- **[MEDIUM] Die Sidebar-Zähler blieben nach dem Veröffentlichen stehen.**
  Live behoben und live gemessen: Marketing 4 → 5, Autor 6 → 7.
- **[MEDIUM] `onSuccess` gab das Invalidierungs-Promise nicht zurück** — der
  Speichern-Knopf wurde aktiv, bevor der neue Zustand da war.
- **[LOW ×3, codex]** Tie-Break-Test verglich zwei identische Aufrufe · die
  Ordnung von `feed_top_authors` war nirgends zugesichert · Vakuum-Test im
  Integrationslauf (Schleife über null Zeilen).
- **[LOW, gemini]** Filter-Leeren stand an zwei Stellen.

## Decisions

- **Das `exists` in der neuen Policy ist keine vierte Kopie des Prädikats.** Ein
  Policy-Ausdruck läuft mit den Rechten des Aufrufers, das `exists` **wendet**
  `posts_select_by_visibility` also an. *Warum wichtig:* dieses Projekt trägt
  schon drei Abschriften (`profiles_public` + DEFINER-RPCs), und jede weitere
  kann driften. Diese kann es nicht.
- **Die Zusage lautet nicht „unsichtbar wird abgelehnt", sondern „beide Wege
  enden ZEICHENGLEICH".** *Warum:* eine Ablehnung, die sich von der anderen
  unterscheidet, ist wieder ein Kanal. Zwei Muster-Prüfungen einzeln hätten das
  offengelassen.
- **`like` bleibt unangetastet**, obwohl es dieselbe Form hat wie das behobene
  `save`. *Warum:* vorbestehend, außerhalb dieses Diffs — Folgearbeit, kein
  „while I'm here".
- **Der `EnvironmentBanner`-Befund wurde NICHT gefixt.** Vorbestehend seit
  AGE-496, fremder Diff.
- **Die Fixture des Integrationslaufs legt jetzt einen eigenen kuratierten Tag
  an.** *Warum:* `MARKE` ist ein FREI getipptes Schlagwort und steht in `tags`
  gar nicht — die Typzusage hing am Bestand des Stacks, auf dem sie lief.

## Files modified

**Neu:** `supabase/migrations/20260825090000_post_saves_kein_existenz_orakel.sql`

- `supabase/tests/feed_sidebar_test.sql` — 18 → 26 (7.7 plus die Ordnungs-Zusage)
- `supabase/tests/post_saves_test.sql` — 24 → 29 (kein Existenz-Orakel)
- `src/components/community/CommunityFeed.tsx` — `filterLeeren` als eine
  Funktion; Invalidierung nach dem Veröffentlichen um beide Sidebar-Schlüssel
  erweitert und als `Promise.all` zurückgegeben; `save.onSuccess` gibt zurück
- `CommunityFeed.flaeche.test.tsx` — +3 (Filter entfernen ×2, Speichern-Sperre)
- `CommunityFeed.composer.test.tsx` — +1 (Sidebar-Invalidierung)
- `src/lib/feed.auswahl.integration.test.ts` — kuratierte Fixture-Marke, Zusage
  auf den Bestand vor der Form
- `openspec/changes/activity-concept-level/tasks.md` — Abschnitt 7 vollständig

Untracked und **absichtlich nicht committet**: `scripts/chat-testkonten.ts`.

## Next session: start here

**Erste Handlung ist eine ENTSCHEIDUNG von Donald, keine Arbeit:** `drift-gate`
hat den Deploy geblockt und benennt die sieben fehlenden Versionen auf PROD
(`viwntbodrtqxgmqyxluh`) namentlich:

```
20260824130000  20260824140000  20260824150000  20260824151000
20260824160000  20260824170000  20260825090000
```

Der Gate sagt selbst, was zu tun ist: „Erst `migrate-prod` freigeben, dann
deployen." **`migrate-prod` zu dispatchen HEISST anwenden** — `apply` startet
direkt hinter `plan`, ohne Reviewer-Regel. Das ist von der generellen
Merge-Freigabe ausdrücklich NICHT gedeckt und liegt bei Donald. Den Dry-Run
vorher zu lesen geht nur außerhalb des Workflows.

Ist `migrate-prod` gelaufen, geht der Deploy nur per `gh run rerun --failed` auf
Lauf `32825716380` (deploy.yml hat kein `workflow_dispatch`), und der Befehl gibt
bei Erfolg nichts aus. Danach das Live-Bündel an einer Zeichenkette aus dem Diff
prüfen, nicht an der Größe.

**Danach** `openspec archive activity-concept-level` — dabei auf die
Szenario-Titel achten (ein umgetauftes Szenario in einem MODIFIED-Block löscht
das alte; `validate` bleibt dabei grün).

**Der lokale Stack trägt weiterhin Sichtprobe-Daten** — drei Konten
(`sicht-ich@example.test`, `sicht-andere@`, `sicht-dritte@`, Kennwort
`sichtprobe-nur-lokal-8f2b`) und jetzt **25** Beiträge: einer ist bei der
Live-Messung von 7.8 dazugekommen („Ein Beitrag zur Abnahme 7.8"), Marketing
steht deshalb auf 5. Nur lokal, nichts davon berührt DEV oder PROD.

Vite hängt sich per
`VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=… npx vite
--port 5175` direkt an den lokalen Stack (Infisical entfällt). **`localhost`,
nicht `127.0.0.1`.** Theme umschalten: `localStorage['fbc.designVariant']` auf
`navy`, dann neu laden — Shift+D wirkt per `dispatchEvent` nicht.

## Open questions

- **Neu: `EnvironmentBanner.tsx:24` trägt die einzige `dark:`-Regel im ganzen
  `src/`.** Sie hängt an `prefers-color-scheme`, nicht am Theme dieser App. Auf
  einem Rechner mit dunkler Systemeinstellung wird „Testumgebung — Daten sind
  nicht echt" hellgelb auf hellgelb: **1,05:1 gemessen** gegen 7,63:1 hell.
  Vorbestehend seit AGE-496. Ein Zeichen Arbeit, fremder Diff — **Donalds
  Entscheidung**, ob als eigener Fix oder im nächsten Vorbeigehen.
- **Neu: `like` in `InteraktionsLeiste` hat dieselbe Form wie das behobene
  `save`** — `onSuccess` ohne `return`. Vorbestehend, gleiche Wirkung.
- **Kein `offset` in den zwei Sidebar-Aggregaten.** Die Begründung steht
  ausführlich im Kopf der Migration; Donalds generelle Regel steht dagegen.
  Unverändert **Donalds Entscheidung**.
- Unverändert offen: die RLS-Kosten von `posts_select_by_visibility` (Faktor
  195) · `post_engagement_counts` prüft noch tote `prime`/`legacy`-Zweige · der
  Aktivierungsversand (69 von 72 PROD-Konten; Donald am 25.08.: „das ist okay")
  · `academy.ts` unformatiert (vorbestehend, `pnpm format` bleibt verboten) ·
  vier gepushte Commit-Messages mit falschem Tag · drei abweichende
  Anmeldeadressen · ein echter Mitgliedsname in der Git-Historie · Rotation des
  PROD-DB-Passworts · vier Review-Befunde aus 11.5 · kein Nachsetz-Weg für eine
  gelöschte Zeile ohne Ban · `grund` ohne Aufrufer · `admin_audit.actor` ohne
  `on delete cascade` · Downgrade (AGE-516) · `admin_list_feedback()` ohne
  Paging.
- **Erledigt und deshalb hier gestrichen: „DEV ist nicht mitgepflegt".**
  `migrate-dev` lief beim Merge durch — DEV trägt die sieben Migrationen jetzt.
