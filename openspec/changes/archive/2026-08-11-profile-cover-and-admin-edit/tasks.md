# Tasks — C6 (AGE-498)

Fassung 2, nach dem Fremd-Review (`REVIEWS.md`). Gegenüber Fassung 1 neu: die
Tabelle `profile_legacy` statt vier Spalten auf `profiles` (§2), der Admin-
**Lesepfad** (§4), das Audit-Log (§5), und die korrigierten Befehle.

Reihenfolge ist Absicht: Datenbank zuerst, dann die Datenschicht, dann die
Oberfläche. Jede Aufgabe nennt, **woran man sieht, dass sie erfüllt ist** — bei
den Datenbank-Aufgaben ein pgTAP-Fall, der vorher rot war.

Entwickelt und geprüft wird **lokal** (`supabase start`) und gegen **DEV**.
Nicht gegen PROD. Kein `db reset` gegen ein Remote-Projekt. Vor jedem
schreibenden Befehl das Zielprojekt nennen.

Stand nach der Umsetzung: Blöcke 0–9 sind erledigt, Block 10 ist offen (Fremd-
Review auf dem Diff, DEV/PROD, Archivierung, PR). Zwei Dinge sind gegenüber der
Planung anders gelaufen und stehen unten an ihrer Stelle:

* **§4 hat zwei Funktionen mehr bekommen** — `is_admin_uid` und
  `log_admin_action`. Grund: `service_role` hält seit AGE-312 auf keiner
  Tabelle in `public` ein Recht, und die Edge Function las `staff_roles`
  direkt. Gefunden hat das die **Sichtprobe**, nicht der Test.
* **§5.1 prüft mit Deno statt Vitest.** Edge Functions werden in diesem Repo
  mit `deno test` geprüft (CI: `.github/workflows/ci.yml:82`); die Planung hatte
  Vitest genannt.

Der Testbefehl nimmt **positionale Pfade**, kein `--file`:

```
supabase test db --local supabase/tests/rls_test.sql supabase/tests/grants_test.sql
```

Ohne die Pfadliste meldet er FAIL, obwohl grün — die elf `probe_*.sql` sind kein
pgTAP.

---

## 0 · Vorbereitung

- [x] 0.1 `openspec validate --all` grün, bevor die erste Zeile Code entsteht.
- [x] 0.2 Fremd-Review (Schritt 2b) → `REVIEWS.md`, zwei Anbieter, beide
      REQUEST-CHANGES, Befunde eingearbeitet.
- [x] 0.3 Lokalen Stack hochfahren (`supabase start`), `supabase db reset`
      **nur lokal**.

## 1 · Migration A — `cover_url`, Grant, View

Datei: `supabase/migrations/2026<TS>_profile_cover_url.sql`

- [x] 1.1 **RED**: pgTAP-Fälle in `rls_test.sql`:
      - Mitglied schreibt `cover_url` auf eigene Zeile → erlaubt
      - `cover_url` erscheint in `profiles_public` für ein fremdes,
        bestätigtes, öffentliches Profil
      - **Gegenprobe**: unbestätigter Aufrufer bekommt aus `profiles_public`
        weiter null Zeilen (der Fall existiert bereits — er muss nach der
        Neudeklaration grün **bleiben**)
      - `profile_completion` ändert sich nicht, wenn nur `cover_url` gesetzt wird
- [x] 1.2 Spalte `cover_url text` + `comment on column`.
- [x] 1.3 `grant update (cover_url) on public.profiles to authenticated;` —
      **nur diese eine**, kein pauschales Grant ohne Spaltenliste (Begründung
      wörtlich aus `20260721070000_grant_update_videos.sql`).
- [x] 1.4 `profiles_public` neu deklarieren: `cover_url` **ans Ende** der
      Spaltenliste. `create or replace view` erlaubt neue Spalten nur angehängt
      — eingefügt scheitert die Anweisung. Das Aktivierungs-Gate **beider
      Seiten** wortgleich aus `20260806080100_activation_gate.sql:489-495`
      mitführen, `comment on view` ebenso.
- [x] 1.5 **Golden-Snapshot nachziehen**: `supabase/tests/grants_test.sql:92`
      trägt die alphabetische Spaltenliste des UPDATE-Grants →
      `…,competencies,cover_url,dev_focus,…`. **Ohne diesen Schritt wird der
      CI-migrations-Job rot, ohne die neue Spalte zu nennen.**
- [x] 1.6 **GREEN**: `supabase test db --local supabase/tests/rls_test.sql supabase/tests/grants_test.sql`

## 2 · Migration B — `profile_legacy`

Datei: `supabase/migrations/2026<TS>_profile_legacy.sql`

- [x] 2.1 **RED**: pgTAP-Fälle:
      - `discover+`-Mitglied liest die `profile_legacy`-Zeile eines anderen → 0 Zeilen
      - Mitglied liest die **eigene** `profile_legacy`-Zeile → 0 Zeilen
      - `authenticated` hält **kein** Grant auf der Tabelle
      - zweite Zeile mit gleichem `legacy_source_id` → Unique-Verletzung
      - `null`, `''` und `'  '` als `legacy_source_id` koexistieren
- [x] 2.2 Tabelle anlegen: `profile_id uuid primary key references
      public.profiles(id) on delete cascade`, `paid_until date`,
      `legacy_tier text`, `legacy_price numeric(10,2)`, `legacy_source_id text`.
- [x] 2.3 `alter table … enable row level security;` — **keine** Policy für
      `authenticated`, **kein** Grant. Zugriff nur `service_role` + die
      Admin-Funktionen.
- [x] 2.4 Unique-Index über `nullif(btrim(legacy_source_id), '')`, partiell
      `where legacy_source_id is not null`.
- [x] 2.5 `comment on table` + `comment on column` mit: dem Warum von
      `paid_until` (Bestandsschutz, sonst nicht rekonstruierbar), der Semantik
      (letzter **eingeschlossener** Tag; `null` = unbekannt, nicht unbefristet),
      und dem Grund, warum die Felder **nicht** auf `profiles` liegen
      (Tabellen-SELECT + `profiles_select_self_or_discover` machten
      `legacy_price` für jedes `discover`-Mitglied lesbar).
- [x] 2.6 **GREEN**.

## 3 · Migration C — Bucket `covers` + Policies

Datei: `supabase/migrations/2026<TS>_covers_storage.sql`

- [x] 3.1 **RED**: pgTAP-Fälle für `storage.objects`, als Falltabelle gegen
      **beide** Buckets (`avatars`, `covers`):
      - bestätigt → eigener Ordner: erlaubt
      - bestätigt → fremder Ordner: abgelehnt
      - unbestätigt → eigener Ordner: abgelehnt
      Bekannte Falle: ohne SELECT-Policy trifft ein `where` auf
      `storage.objects` **null Zeilen**, auch bei `using(true)` — der Test muss
      den **Schreibversuch** prüfen, nicht das Nachlesen.
- [x] 3.2 Bucket `covers`: `public = true`, `file_size_limit = 2097152`
      (2 MiB — ein 1500×500-WebP liegt bei 80–250 kB),
      `allowed_mime_types = '{image/webp}'`. **`on conflict (id) do update`**,
      nicht `do nothing`: ein bestehender, falsch eingestellter Bucket würde
      sonst konserviert und der Test liefe grün gegen ihn.
- [x] 3.3 Policies `covers_insert_own` / `covers_update_own` /
      `covers_delete_own` — `is_activated()` **und** erster Pfadabschnitt
      `= auth.uid()`, wörtlich nach dem avatars-Muster.
- [x] 3.4 **Keine** SELECT-Policy (bewusst; im Kopf begründen).
- [x] 3.5 **GREEN** pgTAP. Zusätzlich **über die Storage-Schnittstelle** (nicht
      pgTAP, das sieht die Bucket-Grenzen nicht): ein Upload über 2 MiB und
      einer mit `image/png` werden abgewiesen.

## 4 · Migration D — Audit-Tabelle + die vier Admin-Funktionen

Datei: `supabase/migrations/2026<TS>_admin_profile_functions.sql`

- [x] 4.1 **RED**: pgTAP-Fälle:
      - Admin ändert ein fremdes, **unbestätigtes** Profil → geschrieben
      - Admin liest über `admin_get_profile` ein unbestätigtes Profil → Daten
      - Admin findet über `admin_find_profile` ein unbestätigtes Profil per
        Login-Adresse
      - normales Mitglied ruft **jede** der vier Funktionen direkt auf →
        Ausnahme, keine Wirkung
      - `patch` mit `tier` → Ausnahme, **auch die gültigen Felder desselben
        Aufrufs bleiben ungeschrieben**
      - `patch` mit `paid_until: "morgen"` → Ausnahme, keine Teilzeile
      - fehlender Schlüssel lässt unverändert, JSON-`null` leert
      - `patch`, der kein Objekt ist → Ausnahme
      - `anon` hält auf keiner der vier Funktionen EXECUTE
      - nach einer Änderung steht eine `admin_audit`-Zeile
      - ein Mitglied fügt direkt in `admin_audit` ein → abgelehnt
- [x] 4.2 Tabelle `public.admin_audit` (`id`, `actor uuid`, `action text`,
      `target uuid`, `payload jsonb`, `at timestamptz default now()`), RLS an,
      SELECT-Policy `is_admin()`, **kein** INSERT-Grant für `authenticated`.
- [x] 4.3 `admin_update_profile(target uuid, patch jsonb)`: `security definer`,
      `set search_path = ''`, voll qualifizierte Bezeichner,
      `if not public.is_admin() then raise exception … end if;` als **erste**
      Anweisung.
- [x] 4.4 Weißliste + **feldweises** Dekodieren nach der Tabelle in
      `design.md §3` (Text · `jsonb_array_elements_text` für die drei
      Text-Arrays · `->` für `socials` · `::date` · `::numeric` · `::boolean`).
      Vorher `jsonb_typeof(patch) = 'object'` prüfen. Unbekannter Schlüssel →
      `raise exception`.
- [x] 4.5 Drei Zielzeilen: `profiles` (update), `profile_contacts` (upsert),
      `profile_legacy` (upsert). **Kein `execute format(...)`** — Begründung im
      Kopf.
- [x] 4.6 `admin_get_profile(target uuid)` — die drei Zeilen als ein `jsonb`,
      dieselbe Weißliste. Im Kopf: **warum es diese Funktion gibt** (ohne sie
      ist ein unbestätigtes Profil für niemanden sichtbar, auch nicht für einen
      Admin — `activation_gate.sql:79` und `:494`).
- [x] 4.7 `admin_find_profile(needle text)` — Suche über `auth.users.email` und
      `profiles.name`, höchstens 20 Treffer.
- [x] 4.8 `admin_audit`-Zeile aus jeder schreibenden Funktion.
- [x] 4.9 Rechte: `revoke execute … from public, anon;` +
      `grant execute … to authenticated;` für alle drei RPCs.
- [x] 4.9a **NACHGETRAGEN (Sichtprobe).** `is_admin_uid(uuid)` und
      `log_admin_action(uuid,text,uuid,jsonb)`, beide nur für `service_role`:
      die Edge Function las `staff_roles` direkt und lief in „permission
      denied". `service_role` hält seit AGE-312 auf keiner Tabelle in `public`
      ein Recht — alles geht durch DEFINER-Funktionen. Sieben pgTAP-Fälle,
      darunter einer, der den Lockdown selbst festhält.
- [x] 4.10 **GREEN**.
- [x] 4.11 `supabase gen types typescript --local > src/lib/database.types.ts`

## 5 · Edge Function `admin-change-email`

- [x] 5.1 **RED**: Vitest — fehlende Kennung → 401; Aufrufer ohne Admin-Rolle →
      403 **und null Aufrufe** gegen die Auth-API; ungültige Zieladresse → 400;
      **Erfolgsfall**: `updateUserById` wird aufgerufen und **danach**
      `revoke_sessions`; schlägt `revoke_sessions` fehl, meldet die Antwort
      „Adresse geändert, Sitzungen nicht beendet" und **nicht** Gesamtfehler.
- [x] 5.2 Handler nach dem Muster von `redeem-activation`. `verify_jwt = true`.
      `sub` **aus dem Gateway-geprüften JWT** lesen — nicht `getUser()`, nicht
      `getClaims()` (ES256 in Prod).
- [x] 5.3 Admin-Prüfung mit `service_role` gegen `staff_roles`.
- [x] 5.4 `auth.admin.updateUserById(target, { email, email_confirm: true })`,
      danach `public.revoke_sessions(target)`, danach `admin_audit`.
- [x] 5.5 `config.toml`-Eintrag, damit CI die Function deployt.
      **Deploy wendet Functions nicht automatisch an** — der Nachweis ist ein
      Function-Deploy, nicht ein grüner Frontend-Build.
- [x] 5.6 **GREEN** `deno test` (76 grün). **Zusätzlich ein Lauf gegen DEV**: gültiges,
      abgelaufenes, verstümmeltes und gefälschtes Token. Ein Handler-Test kann
      nicht belegen, dass das **Gateway** prüft — und genau daran hängt die
      Grenze.

## 6 · `AvatarCropper` bekommt ein Seitenverhältnis

- [x] 6.1 **RED**: Vitest — mit `aspect={3}` exportiert er 1500×500; ohne Props
      weiterhin 512×512 (Regressionsschutz für den Avatar).
- [x] 6.2 `VIEW`/`OUT` in Breite und Höhe zerlegen, Props `aspect = 1`,
      `outWidth = 512`, `label`. `rounded-full` nur bei `aspect === 1`.
- [x] 6.3 `ProfilPage` bleibt am bestehenden Aufruf **unverändert**.
- [x] 6.4 **GREEN**.

## 7 · Hintergrundbild hochladen (Datenschicht + Editor)

- [x] 7.1 **RED**: Vitest für `saveProfile` — mit `coverBlob` Upload nach
      `covers/{uid}/<ts>.webp` und `cover_url` mitgeschrieben; ohne Blob bleibt
      `cover_url` unangetastet; Entfernen setzt `cover_url = null` und **löscht
      kein Objekt**.
- [x] 7.2 `profileFormSchema` um `cover_url`; `fetchProfileEditorData` liest mit.
- [x] 7.3 `saveProfile` lädt analog zum Avatar hoch (kein `upsert`, Zeitstempel
      im Pfad — der Upsert-Weg scheitert an der fehlenden SELECT-Policy).
- [x] 7.4 Editor-Abschnitt: auswählen, zuschneiden (3:1), ersetzen, entfernen.
      Beim Entfernen im UI sagen, dass die Verknüpfung gelöst wird.
- [x] 7.5 **GREEN** + **Sichtprobe lokal**, bevor committet wird.

## 8 · Admin-Bearbeitung im Frontend

- [x] 8.1 **RED**: Vitest —
      - Bearbeiten-Button auf `/p/:id` bei `staffRole === "admin"`, **nicht**
        bei einem normalen Mitglied
      - im Fremd-Modus liest die Datenschicht über `admin_get_profile` und
        schreibt über `admin_update_profile`, **nicht** über den direkten `update`
      - im Fremd-Modus sind Avatar- und Cover-Steuerung **nicht im Baum**
      (kein `vi.mock` auf die eigene Komponente; Assertions auf die neuen
      Bezeichner)
- [x] 8.2 Route `/admin/mitglied/:id` hinter `RequireAdmin`. **Nicht**
      `/p/:id/bearbeiten` — diese Seite existiert für unbestätigte Profile
      nicht, und eine Bearbeiten-Route unter einer 404-Seite ist eine Sackgasse.
- [x] 8.3 Suchfeld auf `/admin` über `admin_find_profile` als Einstieg.
      Zusätzlich der Bearbeiten-Button auf `/p/:id` für sichtbare Profile.
- [x] 8.4 `ProfileEditor` bekommt einen Fremd-Modus: Ziel-ID, beide Wege über
      die RPCs, ausgeblendet werden Avatar, Cover, Interessen, Ziele, Kompass.
- [x] 8.5 Zusätzliche Felder im Fremd-Modus: `paid_until`, die drei
      `legacy_*`-Felder, die **Kontaktadresse** und die **Login-Adresse** —
      nebeneinander, mit einem Satz dazu, was welche tut.
- [x] 8.6 Login-Adresse ändern ruft `admin-change-email`; die Antwort
      „Sitzungen nicht beendet" wird als Hinweis gezeigt, nicht als Fehler.
- [x] 8.7 **GREEN** + Sichtprobe lokal, mit einem **unbestätigten** Zielprofil.

## 9 · Profilansicht nach dem Mockup

- [x] 9.1 **RED**: Vitest — Reihenfolge der Abschnitte; ein Profil ohne
      `cover_url` rendert den Akzent-Verlauf und alle übrigen Abschnitte; ein
      leerer Abschnitt entfällt; „Ich biete"/„Ich suche" lesen `offers`/`needs`.
- [x] 9.2 `ProfileHero`: Profilbild überlappt das Hintergrundbild. Der heutige
      Kommentar sagt ausdrücklich „KEINE Überlappung" — er wird mit dem
      Mockup-Bezug **ersetzt**, nicht stehen gelassen.
- [x] 9.3 `public-profile.ts` liest `cover_url` aus `profiles_public` mit.
- [x] 9.4 **`dashboard.ts` ebenso** — sonst sieht ein Mitglied sein eigenes
      Hintergrundbild auf „Mein Profil" nicht, obwohl es hochgeladen hat.
      `ProfilAnsichtPage` reicht es an `ProfileHero` durch.
- [x] 9.5 Abschnitte nach der Quellen-Tabelle im Spec-Delta: Über mich ·
      Beruf · Hobbys · Ich biete · Ich suche · Aktivitäten · Eckdaten.
- [x] 9.6 **GREEN** + Sichtprobe in **beiden** Themes (hell und navy).

## 10 · Abschluss

- [x] 10.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün —
      Ausgabe gelesen, nicht behauptet.
- [x] 10.2 `supabase test db --local <alle pgTAP-Dateien>` grün.
- [x] 10.3 Code-Review auf dem **Diff** (Schritt 4): codex, REQUEST-CHANGES,
      sieben Befunde übernommen, einer begründet abgelehnt (REVIEWS.md).
- [x] 10.4a Migrationen auf **DEV** (`foelowldexkcqzewvrcf`) angewendet und
      nachgemessen: Spalte, Grant-Liste, leere profile_legacy-Grants,
      Bucket-Einstellungen, drei Policies mit Gate, sechs Funktionen, Sicht mit
      Gate auf beiden Seiten.
- [x] 10.4b Edge Function `admin-change-email` auf DEV deployt — v1, ACTIVE,
      `verify_jwt=True`.
- [ ] 10.4c **PROD steht aus.** `migrate-prod` ist ein bewusst manueller
      Schritt und lag außerhalb dieser Sitzung. Solange er nicht lief, hält das
      `drift-gate` nach dem Merge JEDEN Deploy an — Frontend wie Functions, und
      ohne Break-Glass. Das ist die Zusage, keine Panne.
- [x] 10.5 `openspec archive` gelaufen: +7 Requirements, ~3 modifiziert, 0
      gelöscht. `openspec validate --all` danach grün — die Szenario-Titel in
      den MODIFIED-Blöcken waren wortgleich, sonst hätte es abgebrochen.
- [x] 10.6 PR #157 offen und `MERGEABLE`, fünf Checks grün (verify, migrations,
      edge-functions, pr-title, deploy); die drei „skipping" sind die
      main-only-Jobs. Linear-Status hatte die Automation bereits auf
      *In Progress* gesetzt — nichts zu schreiben; stattdessen ein Kommentar,
      der die drei Abweichungen von der Issue-Beschreibung festhält.

---

## Nicht in diesem Change

Befüllung der Felder (C10) · was beim **Ablauf** von `paid_until` geschieht
(Abrechnung, C10) · vollständige Admin-Konsole mit Mitgliederliste und
Massenmail (AGE-304) · Medien in Aktivitäten (C7) · `file_size_limit` für den
bestehenden `avatars`-Bucket (Folgenotiz) · Aufräumen abgelöster Bild-Objekte
in beiden Buckets (Folgenotiz — heute schon so beim Avatar).
