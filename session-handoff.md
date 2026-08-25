# Session Handoff — 2026-08-25 (vierundzwanzigste Sitzung: AGE-582 live, AGE-587 geplant)

**AGE-582 ist vollständig durch — gebaut, abgenommen, gemergt, auf PROD migriert
und ausgeliefert.** Vier PRs (#205, #207, #208, #209). Danach ist **AGE-587**
entstanden und bis zum Gate geplant: Change geschrieben, von zwei fremden
Vendoren gegengelesen, überarbeitet, committet. **Es existiert noch kein Code.**

## Accomplished

### AGE-582 — Abschnitt 7 und der ganze Weg nach PROD

Alle acht Abnahme-Aufgaben. `pnpm lint/typecheck/test/build` grün (**1546/1546**),
pgTAP **684/684** über neun Dateien, Integrationslauf 17/17.

**Sieben Review-Befunde von codex und gemini, alle behoben, jeder mit einer
Gegenprobe.** Der schwerste: `post_saves` war ein **Existenz-Orakel** — ein
`basic`-Mitglied konnte einen Beitrag speichern, den es nicht lesen darf, und am
Unterschied zwischen „geht durch" und `23503` ablesen, ob es ihn gibt. Die
Auskunft kam nicht aus der Policy, sondern aus dem **Fremdschlüssel**, dessen
Prüfung an der RLS vorbeiläuft. Behoben in
`20260825090000_post_saves_kein_existenz_orakel.sql`.

**Der Weg nach PROD, in dieser Reihenfolge und je einzeln belegt:**

1. Merge (#205) → `migrate-dev` grün, `drift-gate` **failure**, Deploy `skipped`.
2. Dry-Run gelesen — nicht im Workflow, sondern vorher gegen PROD: keine
   Objektkollision, die einzige datenberührende Migration unkritisch (4 Beiträge,
   0 Reaktionen), und die zwei Rechte-Entzüge gegen den Code gehalten. **Der
   Like-Pfad wurde gemessen**: `upsert(ignoreDuplicates)` gibt 201/201 mit
   entzogenem UPDATE-Recht, ist also `DO NOTHING`, nicht `DO UPDATE`.
3. `Migrate PROD` dispatcht → `plan`/`apply` grün. **Unabhängig nachgemessen:**
   Historie 86 Zeilen = 86 Dateien, jedes Recht auf PROD wie entworfen.
4. `gh run rerun --failed` → Deploy grün. Live-Bündel an vier Zeichenketten aus
   dem Diff geprüft, nicht an der Größe.

### AGE-587 — geplant, gegengelesen, überarbeitet

Drei Wünsche Donalds: QM-Feedback als eigene Admin-Seite mit Paging, Zähler an
den Reitern der Mitgliederliste, Deeplink von der Aktivitäten-Karte auf den
einzelnen Beitrag. Change `admin-und-profilflaechen`, `validate --all --strict`
32/32.

**Der Plan-Review hat dreizehn Befunde gebracht — zwölf angenommen, einer
widerlegt — und zwei davon haben die Bauart geändert:**

- **[HIGH, codex]** Die Fünf-Seiten-Grenze widersprach der eigenen Zusage: ein
  **sichtbarer** Beitrag auf Seite 6 verletzte sie durch korrekten Code. Statt die
  Zusage aufzuweichen, wird der Beitrag jetzt **direkt geholt** statt gesucht —
  jeder sichtbare erreichbar, eine Anfrage statt fünf, und die
  Ununterscheidbarkeit ist gebaut statt argumentiert (beide Fälle: null Zeilen).
- **[MEDIUM, gemini, geschärft]** Die abgeschriebene Zustandsbedingung ist
  entfallen; beide Funktionen **teilen** sie jetzt. Die Wächter schützen Signatur
  und Spaltensatz von `admin_list_members`, **nicht den Rumpf**. Dieses Repo hat
  die Regel am Vortag selbst aufgeschrieben (Sidebar-Migration, AGE-582).
- **[MEDIUM, codex]** Und ein Befund hat den Plan *verbessert*: **fünf der sieben
  alten Zusagen dürfen NICHT umgeschrieben werden.** Weil die Funktion
  Vorgabewerte bekommt, bleibt der argumentlose Aufruf gültig — die fünf sind
  damit Wächter über genau diese Vorgabewerte.

**Widerlegt:** geminis HIGH über einen Seitenkanal in der Zahl der Anfragen. Sein
eigenes Szenario zeigt, dass unsichtbar und nicht vorhanden dieselbe Zahl
erzeugen; verschieden ist nur der sichtbare Beitrag. Codex bestätigte es
unabhängig.

## Decisions

- **AGE-582:** das `exists` in der neuen Policy ist keine vierte Abschrift des
  Prädikats — ein Policy-Ausdruck läuft mit den Rechten des Aufrufers und
  **wendet** `posts_select_by_visibility` an. Die Zusage lautet „beide Wege enden
  **zeichengleich**", nicht „unsichtbar wird abgelehnt".
- **AGE-587, Donalds Entscheidungen (25.08.):** die alte Karte verschwindet ganz ·
  Umfang ist Liste mit Paging, keine Filter, kein Bearbeitungsstand · **jede Zeile
  springt zu IHREM Beitrag** (nicht die Karte in den Feed) · Ersatztext **„Beitrag
  ohne Text"** statt „Beitrag mit Bild", nachdem der Review belegt hat, dass die
  Bild-Behauptung nicht stimmen muss · Chat später per eigenem Prompt · anonymes
  Feedback ins Backlog (AGE-588).
- **`profile_id` verlässt die RPC**, obwohl sie heute keinen Aufrufer hat — die
  Funktion wird fürs Paging ohnehin abgerissen, später kostete dieselbe Zeile eine
  zweite Migration.
- **Die Zähler sind global**, auch bei aktiver Suche. Der Reiter beantwortet „wie
  viele gibt es", nicht „wie viele meiner Treffer".

## Files modified

**AGE-582** (gemergt): `20260825090000_post_saves_kein_existenz_orakel.sql` (neu) ·
`feed_sidebar_test.sql` 18 → 26 · `post_saves_test.sql` 24 → 29 ·
`CommunityFeed.tsx` · drei Testdateien · `feed.auswahl.integration.test.ts`.

**AGE-587** (Branch `donald/age-587-admin-und-profilflaechen`, `f0b59d1`,
gepusht, **noch kein PR**): `openspec/changes/admin-und-profilflaechen/` —
proposal, design, REVIEWS.md, vier Spec-Deltas, tasks.md (9 Abschnitte).

## Next session: start here

**Erste Handlung: Schritt 3 der Schleife, der Bau von AGE-587** — der Branch ist
gepusht, das Gate ist offen (`validate --all` 32/32, Change committet). Anfangen
bei **Aufgabe 1.1** und der Reihe nach.

Die wichtigste Falle steht in der Aufgabenliste, hier noch einmal: **1.3 ändert
den Rumpf von `admin_list_members`.** Signatur und Spaltensatz müssen Zeichen für
Zeichen gleich bleiben; die Abnahme dieses Schritts ist, dass
`admin_member_list_test.sql` **unverändert** grün bleibt — nicht angepasst,
unverändert.

## Open questions

- **Wie viele Feedbacks je Seite?** 25 wie die Mitgliederliste, falls Donald
  nichts anderes sagt.
- **`fbc-probe-a4664fb5.pages.dev` ist veraltet** und bleibt es. Belegt: in
  `.github/workflows/` kommt „probe" **kein einziges Mal** vor, `deploy.yml:686`
  liefert nur `--project-name=fbc-platform`. Es ist ein zweites, handgepflegtes
  Pages-Projekt — kein Preview. Nachziehen geht auf Zuruf.
- **`EnvironmentBanner.tsx:24`** trägt die einzige `dark:`-Regel im ganzen `src/`.
  Sie hängt an `prefers-color-scheme`, nicht am Theme dieser App: bei dunkler
  Systemeinstellung **1,05:1 gemessen** gegen 7,63:1 hell. Vorbestehend seit
  AGE-496, ein Zeichen Arbeit.
- **`like` in `InteraktionsLeiste`** hat dieselbe Form wie das behobene `save` —
  `onSuccess` ohne `return`. Vorbestehend.
- **Die nackte Video-URL** steht als Text in den Aktivitäten-Karten. Vermerkt,
  nicht Teil von AGE-587.
- Unverändert offen: RLS-Kosten von `posts_select_by_visibility` (Faktor 195) ·
  `post_engagement_counts` mit toten `prime`/`legacy`-Zweigen · Aktivierungsversand
  (69 von 72; Donald: „das ist okay") · `academy.ts` unformatiert · vier gepushte
  Commit-Messages mit falschem Tag · drei abweichende Anmeldeadressen · ein echter
  Mitgliedsname in der Git-Historie · Rotation des PROD-DB-Passworts · vier
  Review-Befunde aus 11.5 · kein Nachsetz-Weg für eine gelöschte Zeile ohne Ban ·
  `grund` ohne Aufrufer · `admin_audit.actor` ohne `on delete cascade` ·
  Downgrade (AGE-516) · `admin_list_feedback()` ohne Paging **(löst AGE-587)**.
