# Session Handoff — 2026-08-23 (zehnte Sitzung)

PR #200 gemerged, acht offene Entscheidungen getroffen, und **AGE-581** von der
Idee bis zur halb gebauten Datenbankschicht durchgezogen. Branch:
`donald/age-581-admin-mitgliederverwaltung`, fünf Commits, **555 pgTAP-Tests
grün**, nichts gepusht.

## Accomplished

**PR #200 gemerged** (`4a4b890`), vier Pflichtchecks grün auf der HEAD-SHA,
Deploy und CI danach ebenfalls grün — `drift-gate` hat diesmal nicht zugeschlagen.

**Detlevs Übersicht der aktiven Mitglieder** (zwei Screenshots, 23.08.) gegen
PROD abgeglichen. 60 Einträge, alle acht Kategoriezahlen stimmen mit den
Gruppenüberschriften — die Liste ist nachweislich vollständig gelesen. **59
Treffer**, einer ohne Konto; **12 Konten ohne Listeneintrag**, davon eines das
eigene ⇒ **11 zu deaktivieren**. `paid_until` gerechnet: 57 Daten, 3 leer, 0
unlesbar. Beleg: `docs/age-581-mitgliederabgleich.md`.

**AGE-581 angelegt und als OpenSpec-Change durchgeplant** — Proposal, Design mit
9 Entscheidungen, Delta über `admin`/`access-control`/`community-feed`, 73
Aufgaben. Zwei Reviewer (gemini, codex), **beide REQUEST-CHANGES**, 15 Befunde,
alle eingearbeitet oder begründet abgelehnt (`REVIEWS.md`).

**Gebaut: Teil A und B der Datenbankschicht.** 18 von 73 Aufgaben.

- Zugangs-Gate um `disabled_at`/`deleted_at` erweitert. Der Umfang wurde
  **gemessen statt geschätzt**: `grep` über die forward-only Migrationen zählt
  86 Vorkommen allein in einer Datei, gegen den echten DB-Stand sind es **fünf**
  direkte Stellen — zwei Prädikate, eine Policy, eine View; ~40 Policies erben.
- Vier Lebenszyklus-Funktionen mit **vollständiger Übergangstabelle** und
  `FOR UPDATE`, `payment_type` mit DB-Einschränkung, `my_activation_state` um
  `blocked` erweitert.
- **Drei Mutations-Gegenproben** machen die Tests rot, die Wiederherstellung grün.

## Decisions

- **og:image**: mechanischer Zuschnitt aus `hero-start.webp`. **AGE-541**:
  Kennzahlen echt rechnen, Testimonials raus (heute hartkodiert `"120+"`/`"24"`,
  real 71/0). **PROD-Umschaltung: erst nach dem Admin-Ausbau.**
  **Reset-Test 6.3**: gegen DEV mit `+reset`-Adresse, ganz am Ende.
- **Deaktivieren = echter GoTrue-Ban + DB-Gate.** *Warum:* „kein Login zulassen"
  heißt kein Login; ein Konto, das sich anmeldet und dann auf einen Sperrhinweis
  läuft, hat sich angemeldet.
- **Gelöschte Mitglieder: Inhalte bleiben, Autor wird „Ehemaliges Mitglied".**
  *Warum:* ein Beitrag, der aus einem Faden verschwindet, in dem andere
  geantwortet haben, verändert fremde Beiträge.
- **Deaktivierte nur im eigenen Reiter**, nicht unter „Alle". *Warum:* „Alle"
  beantwortet „wer ist Mitglied?", nicht „was steht in der Tabelle?".
- **Stufe im Mitgliedschaft-Reiter nur lesbar.** *Warum:* ein Stufenwechsel
  berührt Rechte und Preise (AGE-516) — nebenbei in einer Tabellenzeile wäre er
  die folgenreichste und zugleich unauffälligste Änderung der Fläche.
- **EXECUTE der vier RPCs bei `service_role`, nicht `authenticated`.** *Warum:*
  sonst ruft ein Admin die DB-Funktion direkt und überspringt den Ban — die
  Doppelsperre wäre eine Gewohnheit statt einer Zusage. Folge: `auth.uid()` ist
  leer, die handelnde Person kommt als `actor` mit.
- **Löschen fasst `disabled_at` NICHT an.** *Warum:* sonst ist der Vorzustand
  verloren und das Wiederherstellen hat keine richtige Antwort mehr.
- **Reihenfolge je Richtung**: Schließen = DB zuerst, Öffnen = Ban zuerst.
  *Warum:* andersherum verschwindet beim Öffnen die Handlung aus der Oberfläche,
  mit der man den halben Zustand repariert.
- **`is_activated()` behält seinen Namen** trotz erweiterter Bedingung. *Warum:*
  ein Rename berührt ~40 Policies — 40 Gelegenheiten, die Bedingung falsch zu
  schreiben. Ausgleich: Warnung im Funktionskommentar (gemini LOW, so
  abgelehnt und ausgeglichen).
- **Datenpflege**: 12 Adressen weichen ab → angleichen, **3 ausgenommen** (eine
  ohne `@`, eine doppelt vergeben, und Detlev als aktiver Admin).

## Files modified

- `supabase/migrations/20260823120000_member_lifecycle_schema.sql` — **neu**:
  Spalten, `is_activated`, `is_activated_profile`, `is_admin`,
  `is_matching_manager`, Policy, `profiles_public`, `my_activation_state`
- `supabase/migrations/20260823130000_member_lifecycle_rpcs.sql` — **neu**:
  `is_admin_uid`, `lifecycle_guard`, `is_banned` und die vier Funktionen
- `supabase/tests/member_lifecycle_test.sql` — **neu**, 32 Tests (Gate, beide Seiten)
- `supabase/tests/member_lifecycle_rpc_test.sql` — **neu**, 34 Tests (Übergänge)
- `supabase/tests/rls_test.sql` — Signaturzusage auf `my_activation_state`
  nachgezogen (zwei → drei Felder); sie **musste** brechen, das ist ihre Aufgabe
- `openspec/changes/add-admin-member-lifecycle/` — **neu**, 5 Artefakte
- `docs/age-581-mitgliederabgleich.md` — **neu**, Beleg ohne PII
- `scripts/probe-age581-{gate-stellen,gotrue-ban,admins,abgleich}.ts`,
  `scripts/age581-abgleich-tabelle.mjs` — **neu**, die Messungen

## Next session: start here

**Weiter bei Aufgabe 5.1** in
`openspec/changes/add-admin-member-lifecycle/tasks.md` — `admin_list_members`
erweitern. Erst den RED-Test (fünf `p_status`-Werte, Ausschluss Deaktivierter
aus `alle`/`aktiviert`/`offen`, Mitglied ohne `profile_legacy`-Zeile fällt nicht
raus), dann die Funktion mit **`drop function` + `create`** — `create or replace`
kann den Rückgabetyp nicht ändern, das ist gemessen und hätte die Migration
zerrissen. Vorgabewerte, Grants und Kommentar nach dem Abwurf wiederherstellen,
sonst meldet ein argumentloser Aufruf „function does not exist" statt `42501`.
Danach 5.4 (`payment_type` an **allen vier** Stellen in `admin_update_profile`,
nicht nur der Weißliste), dann Abschnitt 4 (Edge Function) und 7–10 (Frontend).
Der lokale Stack läuft; die Testliste ist
`rls_test grants_test admin_member_list_test directory_search_test
member_lifecycle_test member_lifecycle_rpc_test` — **immer mit Dateiliste**.

## Open questions

- **Detlevs Anmeldeadresse**: Liste `@fairbusinessclub.de`, DB
  `@dkrealinvest.com`. Er ist Admin und aktiviert — falsch gesetzt sperrt sie
  ihn aus der Fläche aus, auf der man sie korrigiert. Bis zu seiner Bestätigung
  ausgenommen.
- **Gabriel A. Prunty** steht auf der Deaktivierungsliste und ist auf DEV
  `matching_manager` (auf PROD ohne Rolle). Mit der Verschärfung verliert er die
  Rolle. Braucht die Zuteilungsliste einen anderen Bearbeiter?
- **Was Entfernte außerhalb von Feed und Teilnahme hinterlassen** — Nachrichten,
  Kontaktanfragen, Treffer, Angebote, Gesuche — ist **ausdrücklich nicht**
  behandelt und als Nachfolge-Notiz benannt, nicht stillschweigend offen.
- **AGE-534 steht auf Done**, obwohl seine Abnahme gesetztes `paid_until`
  verlangt und 0 von 70 gesetzt sind. Wieder aufmachen? (unverändert offen)
- Unverändert: Downgrade (AGE-516) · `admin_list_feedback()` ohne Paging ·
  AGE-497 · AGE-512 · AGE-256 · AGE-513 · AGE-258 · eigenes Issue für
  `send-activation` (2xx trotz Resend-401) · `demo_personas.sql` scheitert lokal
  an einem Fremdschlüssel · `socials` auf keiner öffentlichen Fläche · WP-Quelldatei
  unauffindbar · `branche`-Ableitung aus `infos` existiert nicht (AGE-537).
