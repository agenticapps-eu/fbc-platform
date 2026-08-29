# Session Handoff — 2026-08-29 (AGE-667, geplante Beiträge)

> ## ⚠ ZUERST LESEN
>
> **PR #289 ist offen**, CI lief beim Schreiben dieser Zeilen noch. Branch
> `donald/age-667-geplante-beitraege`, Worktree
> `../fbc-platform.donald-age-667-geplante-beitraege`, HEAD `9173960`.
>
> **Nach dem Merge sind es ZWEI Schritte, nicht einer** — und der zweite ist der
> gefährliche:
>
> 1. `migrate-prod` von Hand, mit Donalds Freigabe.
> 2. **Danach** die pg_cron-Zeitplanung setzen, erst DEV, dann PROD
>    (`docs/secrets.md`, Abschnitt „Den Ankündigungslauf … eintragen").
>    **Nicht vorher.** Die Migration markiert den Bestand als angekündigt; läuft
>    der Job vor ihr, kündigt er JEDEN vorhandenen Beitrag an JEDES Mitglied an,
>    per Glocke und Push.
> 3. Den Rückfüllschritt auf DEV/PROD nachlesen — lokal ist er grundsätzlich
>    nicht messbar (Migrationen laufen vor dem Seed):
>    `count(*) where veroeffentlicht_ab <> created_at` = 0 und
>    `count(*) where angekuendigt_am is null` = 0.
>
> **Der lokale Stack wurde zweimal zurückgesetzt** (`supabase db reset`). Er
> trägt jetzt alle Migrationen dieses Branches inklusive `20260828200000`, das
> vorher nur von Hand eingespielt war — die Warnung aus der letzten Übergabe ist
> damit erledigt.

**Sitzung:** `fbc-platform-f4`. Parallel lief `fbc-platform-donald-age-642-…`
an AGE-642 (mobil) — keine Berührung.

## Accomplished

**AGE-667 vollständig gebaut**, von Schritt 3 bis Schritt 7 der Schleife. Der
Change war beim Einstieg schon vorgeschlagen, validiert und plan-reviewed
(Commit `5f6ba4b`); begonnen habe ich beim Bauen.

Ein Mitglied kann einen Beitrag jetzt schreiben und zu einem gewählten Zeitpunkt
sichtbar machen. Sichtbarkeit wird **gerechnet** (`veroeffentlicht_ab <= now()
or author_id = auth.uid()`), nicht geschaltet.

| Abschnitt | Stand |
| --- | --- |
| A · Spalte, Rückfüllung, Spalten-Grant | fertig |
| B · die sechs lesenden Tore | fertig, jedes mit eigener Zusage |
| B′ · das schreibende Tor + Ankündigungslauf | fertig |
| C · Schreibweg, Cursor, Typen, alle Aufrufer | fertig |
| D · Composer, Markierung, Rückweg, 2 weitere Flächen | fertig |
| E · pgTAP (31 Zusagen), CI-Dateiliste | fertig |
| F1 · zwei fremde Diff-Reviewer | fertig, Befunde eingearbeitet |
| F3 · `migrate-prod` | **offen, Donalds Freigabe** |

**Belege:** 969 pgTAP-Zusagen über 21 Dateien grün · 2203 Unit-Tests grün · 24
Integrationstests gegen den laufenden Stack grün · `tsc`, `lint`, `build` grün.

## Decisions

- **Acht Tore, nicht sechs.** Der Entwurf zählte fünf lesende. Die Plan-Review
  fand das **schreibende** (`trg_hinweis_neuer_beitrag` hätte im Moment des
  PLANENS jedes Telefon erreicht), die Diff-Review das **achte**
  (`recompute_potential_score` zählte geplante Beiträge in einen Score, der
  Fremden als Impact-Marke auf der Profilseite steht — die Zahl wäre gesprungen,
  bevor es den Beitrag gibt). Der Entwurf führte letzteres als „bekannten Rest"
  und wollte es verschieben; das trägt nicht, es ist dieselbe Fehlerklasse wie
  Tor 4.
- **Die Ankündigung bekommt einen Lauf, die Sichtbarkeit nicht.** Fällt der Lauf
  aus, erscheint der Beitrag trotzdem, nur unangekündigt — er verbirgt keinen
  Inhalt. Genau deshalb ist er hier vertretbar.
- **B′5 gemessen und anders entschieden als angeboten.** `pg_cron` fehlt im
  lokalen Stack. Gewählt ist ein dritter Weg: die **Funktion** in der Migration
  (kein Geheimnis, in pgTAP direkt messbar), nur die **Zeitplanung** von Hand.
  Sie gehört deshalb NICHT in `ERWARTET_OHNE_MIGRATION`.
- **Der Stichentscheid in „Beliebteste" wandert mit** (C7). Sonst hätte der Feed
  zwei Begriffe von „neuer".
- **Drei Indizes über `created_at` sind gefallen**, drei neue entstanden —
  gemessen an 20 000 Beiträgen unter voller RLS: Seq Scan + Sort (20 692 Puffer,
  58,5 ms) → Index Scan **ohne Sort** (43 Puffer, 0,17 ms).
  `posts_visibility_created_at_idx` bleibt: nicht gemessen, also nicht angefasst.
- **De-Publizieren ist zugelassen** und jetzt auch zugesagt (Entscheidung 7
  verlangte das, die Zusagen fehlten).

## Files modified

39 Dateien in `244cfe2`, zwei in `9173960`. Die tragenden:

- `supabase/migrations/20260829090000_geplante_beitraege.sql` (**neu**, 741
  Zeilen) — Spalte, Rückfüllung, Grant, acht Tore, Trigger, Lauf, neue
  RPC-Signatur, Indizes. Jede Entscheidung im Kopf, mit Messung.
- `supabase/tests/geplante_beitraege_test.sql` (**neu**) — 31 Zusagen, jede
  Verneinung mit Positivkontrolle.
- `src/components/community/CommunityFeed.geplant.test.tsx` (**neu**) — 9 Zusagen.
- `src/lib/feed.ts` · `academy.ts` (eigener Cursor-Typ) · `dashboard.ts` ·
  `public-profile.ts` · `database.types.ts` (von Hand)
- `CommunityFeed.tsx` · `profil-widgets.tsx` · `PublicProfilePage.tsx` ·
  `AcademyPage.tsx`
- `rls_test.sql` · `member_lifecycle_test.sql` · `feed_popularity_test.sql` —
  drei bestehende Wächter, die zu Recht angeschlagen haben
- `docs/secrets.md` · `.github/workflows/ci.yml` · die drei `scripts/probe-*.ts`

## Next session: start here

**Zuerst `gh pr checks 289` lesen** — beim Schreiben lief CI noch. Ist sie grün,
mergen; dann die beiden Schritte aus dem Kasten oben, in dieser Reihenfolge.

Danach sind die nächsten kleinen Vorgänge **AGE-666** (flackernder Test in
`PublicProfilePage.test.tsx`, hält `verify` auf `main` rot — eine Zeile
`await screen.findByRole`, aber die Abnahme braucht die GANZE Suite mehrfach),
**AGE-664**, **AGE-660**, **AGE-618**.

## Open questions

- **Re-Publizieren nach De-Publizieren kündigt NICHT erneut an** — der Stempel
  bleibt. Konsistent, steht aber weder in der Spec noch in der Oberfläche.
  Randnotiz von opencode, kein Befund.
- **Das Bearbeiten-Formular überläuft auf 375 px um 18 px.** Gemessen, dass es
  NICHT von hier kommt (das Entfernen des Planungsfeldes ändert nichts);
  Treiber ist der native `<input type="file">` mit 301 px. Bestand aus AGE-566,
  bewusst nicht mitrepariert.
- **`updatePost` schreibt für „sofort" die Uhrzeit des Clients**, die RPC beim
  Anlegen die des Servers. Vertretbar, weil derselbe Client jeden geplanten
  Zeitpunkt aus seiner eigenen Wanduhr errechnet — aber benannt, nicht
  übersehen.
- Unverändert offen: AGE-599-Abnahme (zwei Schritte, siehe Übergabe vom 28.08.),
  AGE-665 (Spec-Drift), AGE-610 · AGE-512 · Aktivierungsversand 69/72 ·
  Rotation des PROD-DB-Passworts · AGE-598 · AGE-256 · AGE-606 · AGE-628/629/630.

## Was diese Sitzung über das Verfahren gelernt hat

**Zwei neue Memories** — `sonden-client-ohne-database-generic` (ein grüner
`typecheck` belegt NICHT, dass die Sonden in `scripts/` noch passen: sie bauen
`createClient()` ohne `Database`-Generic) und
`pgtap-zusage-ueber-die-ganze-tabelle` (in CI vakuum-grün, lokal flackernd).
Dazu ein Abschnitt in `reviewer-cli-timeouts`: gemini konnte den Diff aus
`.gstack/` gar nicht lesen und hat trotzdem ein vollständiges Verdikt geliefert.

**Und zweimal habe ich eine Ursache aufgeschrieben, die ich nicht gemessen
hatte.** Erst „`tsc` prüft `scripts/` nicht mit" (falsch — `scripts` steht in
`tsconfig.json`), dann eine Score-Zusage, die `recompute_potential_score` mit
einer Spalte verglich, die genau diese Funktion selbst schreibt. Beide korrigiert
— die erste in einem eigenen Commit, weil sie schon gepusht war. Dieselbe Sorte
wie die falschen Zahlen der Vorsitzung: was zwei Absätze weiter nachprüfbar ist,
schreibe ich trotzdem aus dem Gedächtnis.

**Die Browser-Sichtprobe hat einen Fehler gefunden, den 2203 Tests nicht sahen**
— 35 px waagerechter Überlauf, sobald ein Zeitpunkt gewählt war. Und die
Messung dazu hatte selbst einen Fehler: `top` unterscheidet sich bei
`items-center` zwischen verschieden hohen Kindern auf DERSELBEN Zeile. Gemessen
werden müssen die Mitten.
