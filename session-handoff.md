# Session Handoff — 2026-08-20 (dritte Sitzung)

**Der Spiegel DEV ← PROD ist gemessen, abgesichert und entschärft — aber noch
nicht gebaut.** Gruppen 1, 2, 2a und 2.7 sind durch, kein Auszug existiert.
Zwei Behauptungen des Entwurfs sind dabei als falsch nachgewiesen worden, und
eine echte Sicherheitslücke ist geschlossen.

## Accomplished

**Gruppe 1 — beide blockierenden Gates halten** (`36b55d0`). `pg_dump 18.4`
trägt die Pooler-Verbindung gegen PROD (Exit 0) und liest das `auth`-Schema mit
den vorhandenen Rechten. Der `pg_restore`-Weg trägt also. Drei Befunde ändern
ihn trotzdem:

- **Der geplante Mechanismus wäre gescheitert.** `ALTER TABLE … DISABLE TRIGGER`
  verlangt Eigentümerrechte — die fehlen an `auth.users` (`supabase_auth_admin`)
  und beiden `storage`-Tabellen (`supabase_storage_admin`), also an genau den
  drei Tabellen, auf die es ankommt. Was trägt: **`set
  session_replication_role = replica`**, auf beiden Projekten erlaubt; alle 18
  Trigger tragen `tgenabled='O'`, der eine Schalter legt sie sämtlich still.
  Lokal mit Gegenprobe belegt (origin: 1 Profilzeile, replica: 0).
- **Es sind 18 Trigger, nicht 13** — vier auf `storage` standen in keinem
  Review; zwei stehen dem Leeren der Buckets im Weg.
- **Der lokale Probelauf hat einen blinden Fleck**, und zwar den schlimmsten:
  lokal fehlt genau `contact_requests_email_webhook`, weil er bewusst in keiner
  Migration steht. Über „keine Post" sagt ein grüner lokaler Lauf nichts.

Ausserdem: Auth-Umfang ist `users` + `identities` und sonst nichts; beide Seiten
schemagleich (70 Migrationen zeichengleich, `db-drift-scan` beidseitig sauber);
Vorher-Manifest beider Seiten liegt in `messungen/`.

**Gruppe 2 — der Wächter** (`37d711e`, `b6930a7`). `sync-dev.logic.ts` (rein) +
`sync-dev-waechter.ts` (CLI), 22 Zusagen, **sieben Verbiegungen einzeln rot
gemessen**. Prüft die Kennung je Wert (DB-URL, API-URL, Service-Key) aus
Benutzername bzw. JWT-Nutzlast, nie am Host, und **beide** Seiten. Zwei Dinge
hat erst die Sichtprobe an echten Werten gezeigt: der Wächter fängt die
dokumentierte Spaltung des Secret-Stores, und er nahm den **anon**-Schlüssel an
(gleiche Kennung) — die Rolle wird jetzt mitgeprüft.

**Gruppe 2.7 — Zugangsdaten** (von Donald gesetzt). Alles liegt in Infisical
`prod`, ein Lauf sieht beide Seiten. Kein `SUPABASE_SERVICE_ROLE_KEY_PROD`:
bewusst abgewichen, der Wächter fällt auf den etablierten Namen zurück und
schreibt hin, welchen er gelesen hat.

**Gruppe 2a — und der eigentliche Fund** (`35d18cf`). Geplant war ein Passwort
in einem Dokument; gefunden wurden fünf Dokumente mit `Test1234!` **und ein
zweites Passwort im Quelltext**: `demo_personas.sql` legte Konten mit
`crypt('demo-not-a-real-password', …)` an — Klartext im öffentlichen Repo, der
Kommentar daneben behauptete „KEINE Logins". Nachgemessen: **24 der 41
DEV-Konten** trugen es, über alle sechs Stufen bis `impact`, und ein Login damit
las das **komplette Verzeichnis**. Heute Demo-Profile — nach dem ersten
Spiegellauf die 72 echten Mitglieder. Behoben in beide Richtungen (Seeds setzen
einen Zufallswert, die 24 lebenden Konten sind neutralisiert, Gegenprobe grün).

## Decisions

- **`session_replication_role = replica` statt `ALTER … DISABLE TRIGGER`.**
  *Warum:* die Eigentümerrechte fehlen an den drei entscheidenden Tabellen, und
  ein `ALTER` überlebt die Sitzung — ein versehentlich abgeschaltet gebliebener
  Signup-Trigger fiele erst Tage später auf. Folge: der Kunstgriff in 4.5
  entfällt, aber die internen RI-Trigger schweigen mit, also muss die
  Fremdschlüssel-Integrität jetzt **eigens gemessen** werden.
- **Kein zweiter PROD-Service-Key unter `…_PROD`.** *Warum:* zwei
  Vollzugriffs-Schlüssel, von denen eine Rotation nur einen erwischt.
- **Der DEV-Bestand schrumpft auf zwei Zeilen — Demo-Welt entfällt** (`c8179b8`).
  *Warum:* Donald und Detlev haben je ein eigenes `impact`-Konto, das PROD kennt,
  samt Admin-Zeile auf PROD. Gemessen, was das kostet: PROD trägt
  **ausschliesslich `impact`** (72), aber **35 der 72 sind nicht aktiviert** —
  das Aktivierungs-Gate überlebt also ohne Testkonto, die **Stufenvielfalt und
  `matching_manager` fallen weg**. Deshalb bleibt ein *kleiner* deklarierter
  Bestand ohne eigene Logins: `matching_manager` plus eine Handvoll
  `tier`-Zuweisungen auf übernommenen Konten.
- **Zwei Behauptungen des Entwurfs als falsch nachgewiesen und korrigiert:**
  (1) „ohne `auth.identities` kann sich niemand anmelden" — die drei
  Demo-Zugänge tragen **null** Identitätszeilen und melden sich an; die
  Entscheidung bleibt, ihr Grund ist ausgetauscht (PROD abbilden statt einer
  Teilmenge, die zufällig funktioniert). (2) Meine eigene Aussage, Detlev sei
  ausgesperrt — er hat vier eigene DEV-Konten.

## Files modified

- `scripts/mess-spiegel-gruppe1.ts` · `-manifest.ts` · `-replica.ts` — neu, rein
  lesend (die Replica-Sonde rollt zurück, Ziel fest auf localhost verdrahtet)
- `scripts/sync-dev.logic.ts` · `.test.ts` · `sync-dev-waechter.ts` — neu, der
  Wächter
- `supabase/seed/demo_personas.sql` · `demo_legacy_profile.sql` — öffentliches
  Passwort raus, `crypt(gen_random_uuid()::text, …)` rein, Begründung im Kopf
- `docs/demo-zugang.md` · `demo-script.md` · `foundation-acceptance.md` ·
  `w4-acceptance.md` · `tier-testing.md` — `Test1234!` raus, Zeiger auf Infisical
- `openspec/changes/sync-dev-from-prod/` — `design.md` (Decision 2, 2a, neu 3a),
  `tasks.md` (Gruppen 1, 2, 2a, 4.9/4.10 umgeschrieben), Spec-Delta,
  `messungen/` (Bericht + zwei Manifeste)
- **Ausserhalb des Repos:** Infisical `prod` um 4 Werte ergänzt
  (`SUPABASE_SERVICE_ROLE_KEY_DEV`, `SUPABASE_URL_PROD`, `SUPABASE_URL_DEV`,
  `SUPABASE_DB_URL_DEV`) plus `DEMO_LOGIN_PASSWORD_DEV`; 24 DEV-Konten
  neutralisiert; drei Presenter-Passwörter rotiert. Memory: neu
  `trigger-stilllegen-nur-per-replica`, korrigiert
  `infisical-prod-umgebung-ist-gespalten`, `demo-seed-fallen`,
  `go-live-zielbild-prod-dev`

## Next session: start here

Nichts ist halb fertig. Branch `donald/age-576-spiegel-dev-prod`, HEAD `c8179b8`,
Arbeitsbaum sauber, **kein PR**. Erste Aktion ist **Aufgabengruppe 3** aus
`openspec/changes/sync-dev-from-prod/tasks.md`: Ablageort ausserhalb des
Arbeitsbaums (`0700`/`0600`, über `realpath` geprüft), Auszug aus PROD getrennt
nach `public` und `auth`, Manifest, Objekte der vier Buckets rekursiv und über
alle Seiten. Der Wächter steht und ist zu **benutzen**, nicht neu zu bauen —
`infisical run --env=prod -- npx tsx scripts/sync-dev-waechter.ts` muss grün
sein, bevor irgendetwas liest. `scripts/mess-spiegel-manifest.ts` ist die
Vorlage für 3.4; die Bucket-Liste kommt dort aus `storage.buckets`, nicht aus
den Objekten.

Drei Fallen dieser Sitzung: in Skripten **ausserhalb** des Repos scheitert `tsx`
an Top-Level-`await` (CJS) und findet `pg` nicht — Sonden gehören nach
`scripts/`. `tr -dc … | head -c` erzeugt unter `set -o pipefail` SIGPIPE (Exit
141). Und `scripts/db-drift-scan.ts` reicht keine Root-CA durch, braucht lokal
`NODE_EXTRA_CA_CERTS=scripts/supabase-root-2021-ca.crt`.

## Open questions

- **Wer hält künftig `matching_manager`?** Die Rolle braucht ein übernommenes
  Konto; PROD kennt sie nicht. Entscheidung gehört in 4.9.
- **Welche Stufen sollen auf DEV besetzt sein?** PROD ist komplett `impact`.
  Ohne `tier`-Zuweisungen lässt sich Stufen-Gating nicht mehr prüfen.
- **Offene Zusage aus 1.3:** beide Server sind 17.6, der einzige Client ist
  18.4; ein Rücklauf in einen älteren Server ist von PostgreSQL nicht zugesagt.
  Fällt in 5.1.
- **`demo_personas.sql` scheitert lokal an einem Fremdschlüssel** — vorbestehend
  (mit `HEAD` identisch), nicht durch diese Sitzung verursacht. Eigenes Issue
  wert, wenn die Demo-Welt überhaupt bleiben soll.
- **Die Demo-Dokumente sind nach dem ersten Lauf überholt** —
  `docs/demo-zugang.md`, `demo-script.md` und die drei Abnahmedokumente. Und
  `pnpm demo:seed`/`demo:reset` gegen DEV zu fahren würde den Spiegel zerstören.
- Unverändert offen: Detlevs Zahlungsliste (C10-Aufgabe 3.5, AGE-534 bleibt *In
  Progress*) · Downgrade existiert nirgends (AGE-516) · `admin_list_feedback()`
  ohne Paging · AGE-497 · AGE-541 · AGE-512 · AGE-256 · AGE-513 · AGE-258 ·
  Rücknahmeliste vor Go-Live · eigenes Issue für `send-activation` (2xx trotz
  Resend-401).
