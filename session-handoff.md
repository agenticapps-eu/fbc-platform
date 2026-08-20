# Session Handoff — 2026-08-20 (vierte Sitzung)

**Der Spiegel läuft — lokal, vollständig, aus einem echten PROD-Auszug.**
Gruppen 3 und 4 sind gebaut und gemessen, der Probelauf aus 5.1 ist grün.
**DEV ist nicht berührt worden.** Drei Behauptungen des Entwurfs sind dabei als
falsch nachgewiesen worden, zwei davon hätten in Gruppe 4 lautlos Schaden
angerichtet.

## Accomplished

**Gruppe 3 — Auszug, Manifest, Ablage** (`c9ee493`, `dec4cbb`, `40a43e6`).
35 Zusagen, sieben Verbiegungen einzeln rot gemessen, vier echte Läufe gegen
PROD (rein lesend). Der Auszug liegt in
`~/.fbc-spiegel/spiegel-viwntbodrtqxgmqyxluh-20260820T165007Z` (8 MB,
`0700`/`0600`): `auth.sql`, `public.sql`, 125 Objekte, `manifest.json`.
36 Tabellen / 857 Zeilen, alle 125 Objekte byteweise bestätigt.

Vier Zusagen sind an echten Läufen gefallen, nicht am Strukturargument: der
Ablageort wird **nach `realpath`** geprüft (ein Symlink in den Arbeitsbaum
fliegt raus, und in beide Richtungen); die Objektliste kommt aus
`storage.objects` statt aus `list()` und blättert **per Keyset**; die
`git status`-Differenz vor/nach dem Lauf ist leer; und **der Auszug kennt DEV
nicht** — mit einem nicht auflösenden DEV-Host und einem DEV-Schlüssel ohne
gültige Signatur lief er einmal durch und einmal in den Abbruch, beide Male
ohne einen Mucks aus Richtung DEV.

**Gruppe 4 — der Rücklauf** (`9f14905`, `1b753e0`). 22 Zusagen, sieben Läufe
gegen den lokalen Stack. Aus einem leeren, frisch migrierten Schema entsteht der
volle Bestand: 72 Konten, 72 Identitäten, 36 Tabellen, 125 Objekte, Exit 0.
Belegt sind unter anderem **4.5** (nach dem `auth`-Rücklauf trägt
`public.profiles` **0** Zeilen — der Trigger hat nicht gefeuert), **4.1b**
(**61** Fremdschlüssel einzeln geprüft, keine verwaiste Zeile) und **5.4**
(zweimal derselbe Auszug → **36 von 37 Tabellen bitgleich**).

Berichte: `openspec/changes/sync-dev-from-prod/messungen/gruppe-3-…md` und
`gruppe-4-…md`.

## Decisions

- **`PGOPTIONS` trägt den Replica-Schalter NICHT — der Auszug ist jetzt
  ausführbares SQL** (`--format=plain --column-inserts` statt `--format=custom`).
  *Warum:* Supavisor schreibt das Startup-Paket um und verwirft **jede** Option
  **ohne Fehler** (belegt: ein gesetzter `application_name` kommt als
  `Supavisor` zurück); über die Direktverbindung antwortet der Server mit
  `permission denied to set parameter`. Nur `SET` in der laufenden Sitzung
  trägt. `pg_restore` öffnet seine Verbindung selbst — ein Rücklauf darüber
  liefe mit **lebenden Triggern**, über den Pooler lautlos. `pg_restore` kommt
  nicht mehr vor.
- **Buckets werden über die Storage-API geleert, ausserhalb der
  replica-Sitzung.** *Warum:* `storage.protect_delete()` hat eine dokumentierte
  Hintertür (`set storage.allow_delete_query`), aber der Trigger schützt vor
  etwas Echtem — **verwaisten Blobs im S3**. Im replica-Modus schwiege er, und
  bei jedem Lauf kämen 125 Waisen dazu.
- **`matching_manager` geht auf ein DRITTES übernommenes Konto**, nicht auf
  Donald und Detlev. *Warum:* `staff_roles.profile_id` ist Primärschlüssel — die
  Zeile ersetzte ihre Admin-Zeile. Und sie brächte nichts: `is_matching_manager()`
  akzeptiert `role in ('matching_manager','admin')`. Der Zweck der Zeile ist der
  Fall **`matching_manager` ohne `admin`**, den PROD nicht kennt.
- **Stufen: je ein übernommenes Konto auf `basic`…`focus`, Rest `impact`** —
  ausgewählt per **Regel** (kleinste `auth.users.id`), nicht per Namensliste,
  damit keine fünf echten Adressen ins öffentliche Repository wandern. **Die
  Admin-Konten sind ausgenommen:** `has_level` kennt keine Admin-Ausnahme.
- **Fixture-Zeitstempel hängen am Auszug, nicht an `now()`.** *Warum:* sonst
  wanderten `staff_roles.created_at` und `profiles.updated_at` je Lauf mit, und
  5.4 liesse sich nicht mehr messen.

## Files modified

- `scripts/sync-dev-auszug.logic.ts` · `.test.ts` · `sync-dev-auszug.ts` — neu,
  der Auszug (Ablageort, Objektpfade, Plan, Keyset-Blätterung, Manifest)
- `scripts/sync-dev-ruecklauf.logic.ts` · `.test.ts` · `sync-dev-ruecklauf.ts` —
  neu, der Rücklauf (Auszugsprüfung, Leeren, Einspielen, Abnahme)
- `openspec/changes/sync-dev-from-prod/` — `design.md` (neu 2b, 5a, §3a
  konkretisiert), `tasks.md` (Gruppen 3 und 4 abgehakt, 4.1/4.3/4.9/4.12
  umgeschrieben), zwei neue Berichte in `messungen/`
- **Ausserhalb des Repos:** ein Auszug in `~/.fbc-spiegel/`; der lokale Stack
  trägt den Spiegel. Memory: neu `pgoptions-wird-vom-pooler-verschluckt` und
  `pgdump18-restrict-metabefehle`

## Next session: start here

Branch `donald/age-576-spiegel-dev-prod`, HEAD `c0ce71e`, Arbeitsbaum sauber,
**kein PR**. `pnpm test` (1318), typecheck und lint sind grün.

**Erste Aktion ist 5.5 — die Sichtprobe, und die Daten liegen schon da.** Der
lokale Stack trägt den vollen Spiegel. Es fehlt nur ein anmeldefähiges Konto
(4.13 hat alle Hashes neutralisiert): lokal per GoTrue-Admin ein Passwort auf
ein übernommenes Konto setzen, `pnpm dev` gegen den lokalen Stack, und fünf
echte Profile mit Bild, Anschrift und Netzwerken ansehen. Grüne Tests haben hier
schon einmal ein sichtbar falsches Ergebnis durchgewunken.

**Danach 5.2, und dafür braucht es Donalds Freigabe** — er hat „erst lokal
proben, dann fragen" gewählt. Der Lauf gegen DEV leert `auth`, `public` und alle
vier Buckets, und `fbc-platform.pages.dev` liest gegen DEV. Der Befehl steht:
`infisical run --env=prod -- npx tsx scripts/sync-dev-ruecklauf.ts --ziel=dev
<ablage>`. **Auflage aus 1.1:** die beiden DB-URLs liegen in getrennten
Infisical-Umgebungen — ein einzelner `--env=` liefert nie beide, für den
Rücklauf reicht `prod` (dort liegen inzwischen alle sechs Werte).

Drei Fallen dieser Sitzung: `ls` ist ein `eza`-Alias und liefert Langformat statt
Pfaden (`$(ls -d …)` zerlegt jedes Skript). Sonden mit Top-Level-`await` müssen
nach `scripts/`, sonst scheitert `tsx` an CJS. Und `prettier --check` meldet
repo-weit **138** Dateien — CI erzwingt es nicht, also ist eine Warnung an
fremdem Code kein Befund.

## Open questions

- **4.7 Post-Hälfte, 4.8a:** lokal fehlen `notify_contact_request_webhook()`
  und `contact_requests_email_webhook`. Über „keine Post" sagt der grüne
  Probelauf **nichts** — die Zusage fällt erst gegen DEV.
- **5.6 ist halb belegt.** Der Bestand entsteht aus leerem Schema; die
  **Anmeldefähigkeit** nicht, weil 4.13 sie absichtlich nimmt. Für die
  Sicherungs-Rolle (PROD-Wiederaufbau) braucht der Rücklauf einen Schalter, der
  4.13 auslässt — den gibt es noch nicht.
- **4.10 Dokumente:** `docs/demo-zugang.md`, `docs/demo-script.md` und die drei
  Abnahmedokumente sind nach dem ersten DEV-Lauf überholt und noch **nicht**
  nachgezogen. `pnpm demo:seed`/`demo:reset` gegen DEV zerstörte den Spiegel.
- **Der Pooler ist beim Rücklauf ungeprüft.** Dass `SET` über Supavisor trägt,
  ist gemessen; dass der **ganze** Rücklauf darüber trägt, nicht.
- Unverändert offen: Detlevs Zahlungsliste (AGE-534) · Downgrade (AGE-516) ·
  `admin_list_feedback()` ohne Paging · AGE-497 · AGE-541 · AGE-512 · AGE-256 ·
  AGE-513 · AGE-258 · Rücknahmeliste vor Go-Live · eigenes Issue für
  `send-activation` (2xx trotz Resend-401) · `demo_personas.sql` scheitert lokal
  an einem Fremdschlüssel (vorbestehend).
