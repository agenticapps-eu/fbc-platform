# Session Handoff — 2026-08-06 (11. Session)

## Stand in einem Satz

**C3 (AGE-495) ist gebaut und belegt.** Freigabe erteilt, vier Commits auf
`donald/age-495-c3-mitglieder-aktivierung-e-mail-bestatigung-als`, Migrationen
auf DEV, Beweis-Sonde grün. Offen sind Abnahme-Schritte (Audit, CSO, Review),
der Mailtext an Detlev und der PROD-Deploy.

## Der Beweis (Task 8.1)

`scripts/probe-activation-gate.ts`, roher Supabase-Client, Konto auf `impact`
mit `activated_at = null`, gegen DEV mit echten Demo-Daten:

| Fläche                            |                  Vorher |                   Nachher |
| --------------------------------- | ----------------------: | ------------------------: |
| `profiles`                        |                      38 |                     **0** |
| `profiles_public`                 |                      37 |                     **0** |
| `posts` / `events`                |                  12 / 9 |                 **0 / 0** |
| `offers` / `needs`                |                 49 / 48 |                 **0 / 0** |
| `profile_theme_scores`            |                     148 |                     **0** |
| `profile_contacts` (eigene!)      |                       1 |                     **0** |
| `register_for_event`              | `P0002 event not found` | **`42501 not activated`** |
| anon: öffentliche Beiträge/Events |                   5 / 1 |                 **5 / 1** |

Vollständig in `openspec/changes/member-activation-flow/EVIDENCE.md`.

## Accomplished

**Bestandsaufnahme gemessen statt gegrept.** Gegen DEV über `pg_policies` /
`pg_proc` / `pg_class`. Vier Annahmen aus AGE-495 fielen: es sind **52** Policies,
nicht 72 · `is_prime_plus()` **existiert nicht mehr** (gedroppt in
`20260715150000:319`) · `minimum_password_length = 10` steht schon (C4) · der
Onboarding-Wizard ist schon aus dem Erstlogin (AGE-494).

**Drei Review-Runden** (gemini/codex/opencode, `claude` als implementierender
Host ausgeschlossen). gemini je APPROVE, die beiden anderen je REQUEST-CHANGES —
27 Befunde, die meisten trugen. Wortlaut in `REVIEWS.md`.

**Drei Reviewer-Befunde durch Messung widerlegt** statt eingearbeitet:
Angreifer-Sessions überleben den Passwortwechsel **nicht** (Access- und
Refresh-Token sterben) · ein `public`-Bucket ist **nicht** aufzählbar (`anon
list('avatars')` → 0 Einträge, `storage.objects` hat RLS ohne SELECT-Policy) ·
opencodes Zeilenverweis auf `posts_insert_own` traf die falsche Policy.

**Eine Messung, die den Change umbaute:** Ein Konto mit Session kann sein
Passwort **ohne Token und ohne Reauth** ändern (`updateUser({password})`, gegen
DEV nachgestellt). Kein Weg in die App — das Gate hält — aber eine **Aussperrung**
des echten Mitglieds. Deshalb: Versand beim Import anstoßen, „neuen Link
anfordern" ohne Session.

## Decisions

- **Selbstregistrierung bleibt offen** (Donald). Selbstregistrierer sind `basic`,
  **importierte `impact`**. Folge: hinter dem Aktivierungs-Gate liegt bei
  importierten Konten **kein Stufen-Gate mehr** — es muss lückenlos sein.
- **Sichtbarkeit erst nach Bestätigung** (Donald, 06.08.). Das Gate prüft **beide
  Seiten**. Akzeptierte Folge: Verzeichnis am Go-Live-Abend zunächst leer, der
  Erste sieht Detlev und Donald. **Kein Fehler — nicht „reparieren".**
- **Gate an drei Stellen**: 46 Policies + Rumpf von `profiles_public`
  (`security_invoker = off`!) + **sieben** DEFINER-RPCs (nicht vier).
- **Own-Data ist mitgegatet** — der Angreifer meldet sich _als das Mitglied_ an;
  `profile_contacts` trägt dessen E-Mail und Telefon.
- **Reihenfolge statt Atomarität** bei der Einlösung: Token atomar beanspruchen →
  Passwort → Sessions → **zuletzt** `activated_at`. Der Stempel öffnet das Gate.

## Files modified

- `openspec/changes/member-activation-flow/` — neu: `proposal.md` (245 Z.),
  `design.md` (16 Entscheidungen), `tasks.md` (12 Blöcke), `INVENTORY.md`
  (alle 52 Policies + 22 DEFINER-Funktionen, mit Erzeugungsabfrage),
  `REVIEWS.md`, zwei Spec-Deltas (`access-control`, `member-profiles`).
- `session-handoff.md` — diese Datei.
- Kein Produktivcode angefasst.

## Was gebaut wurde

**Drei Migrationen.** A: `profiles.activated_at`, `activation_tokens`,
`is_activated()`, `my_activation_state()`, Stolperdraht + Backfill. B: das Gate
in 46 Policies, in den Rumpf von `profiles_public` und in **sieben**
DEFINER-RPCs. C: `issue_activation_token`, `claim_activation_token`,
`mark_activated`, `revoke_sessions` — nur `service_role`.

**Zwei Edge Functions.** `send-activation` (liest kein JWT, antwortet immer 202,
sendet nach der Antwort) und `redeem-activation` (vier Schritte, Stempel
zuletzt).

**Frontend.** `ActivationGate` um die ganze AppShell, Aktivierungsbildschirm,
`/aktivierung` mit Token im Fragment, alle sieben Fehlerfälle.

**Tests.** pgTAP 153 (rls 133, grants 5, directory 15) · vitest 413/413 ·
deno 12/12 · lint 0 Fehler · build grün.

## Next session: start here

**Task 6.9 — die laufende Oberfläche zeigen.** Ich konnte `pnpm dev` nicht
starten: Infisical braucht ein echtes Terminal. Donald startet es (`! pnpm dev`),
dann Aktivierungsbildschirm und `/aktivierung` ansehen, bevor der PR aufgeht.

Danach die Abnahme: `database-sentinel:audit` (8.5), `/cso` (8.6), unabhängiges
Code-Review (8.7), `run-plan-review.sh` gegen den fertigen Stand (8.8).

## Beim Bauen gemessen (nicht angenommen)

- **PROD hat 2 Profile, 0 auf `impact`; DEV 37 / 9.** Die „37" aus dem C4-Audit
  wäre als Stolperdraht-Grenzwert für PROD sinnlos gewesen. Grenzen jetzt:
  `> 50` gesamt **oder** `> 20 impact` → laute Migration. (12.1 erledigt)
- **PRODs zwei Konten sind beide bestätigt** (`email_confirmed_at` gesetzt) —
  der Backfill winkt dort keine unbestätigten Altkonten durch. (12.2 erledigt)
- **`auth.admin.signOut(jwt, scope)` erwartet ein JWT, keine User-ID.** Signatur
  am Code nachgemessen. Mein erster Aufruf hätte 401 geliefert und **jede**
  Aktivierung scheitern lassen — kein Typecheck hätte das gefunden. Ersetzt
  durch `revoke_sessions(uuid)`. (12.3 erledigt)
- **`anon` kann den `avatars`-Bucket NICHT auflisten** (0 Einträge) —
  `storage.objects` trägt RLS ohne SELECT-Policy. Der Reviewer-Einwand trifft
  nicht zu; die Restfläche bleibt der Abruf einer bekannten URL.

## Open questions

- **`profiles_public` ist jetzt auch aus `service_role` leer** — die View trägt
  `is_activated()` im Rumpf, und ohne Session ist das false. Keine bestehende
  Function nutzt sie serverseitig; wer es künftig tut, liest `profiles`.
  In EVIDENCE.md festgehalten.
- **11.1** `security_update_password_require_reauthentication` auf PROD:
  **ungemessen**. Der Messversuch gegen DEV wurde vom Berechtigungs-Classifier
  abgelehnt — nicht umgangen. Braucht Donalds Freigabe oder einen Handgriff im
  Dashboard.
- **12.6** „Versuchsgedrosselt" auf `redeem-activation` hat noch kein Subjekt
  (IP? Fingerprint?) und keinen instanzübergreifenden Speicher. Der Endpunkt ist
  öffentlich; das Token hat 256 Bit, die Drosselung ist Lastschutz.
- **12.7** Bestehende Requirements in `member-profiles` sichern Eigentümern
  Zugriff **ohne** Aktivierungsvorbedingung zu — als MODIFIED nachziehen, sonst
  ist die durable Spec nach dem Archivieren widersprüchlich.
- **12.8** „Genau eine privilegierte Funktion ohne Gate" im access-control-Delta
  widerspricht `INVENTORY.md` B2 (15 bestehende ungegatet). Auf die Datenklasse
  eingrenzen.
- **12.10** AGE-448: Gäste brauchen künftig erst ihr Postfach, auch für die
  Anmeldung zu öffentlichen Events. Vor dem Sommerfest mit Detlev klären.
- Mailtext (`design.md`, Ende) geht als **Entwurf** an Detlev.
- Zustell-Abnahme hängt an **AGE-256** (SPF/DKIM) — blockiert nur den Versand,
  nicht den Sicherheitskern.

## Fallen, die weiter gelten

- **`git add -A` ist verboten** — dauerhaft untracked Dateien mit 0600, Repo ist
  öffentlich.
- **`ls` ist ein Alias auf `eza -lao`**, **`cd` ist zoxide** — in Skripten
  absolute Pfade statt `cd`.
- **`supabase test db` ohne Dateiliste meldet FAIL, obwohl grün.**
- **Policies zählt man in `pg_policies`, nicht per grep** — über acht Migrationen
  hinweg wird gedroppt und neu angelegt; der grep zählt die Historie.
- **Kein Service-Role-Key in Infisical `dev`** — der liegt nur im
  Functions-Secret-Store. Für DB-Schreibzugriff `SUPABASE_DB_URL_DEV` + `pg`.
- **Merge immer gegenprüfen** (`state=MERGED`).
