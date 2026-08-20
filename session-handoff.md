# Session Handoff — 2026-08-20 (zweite Sitzung)

**Go-Live-Vorbereitung begonnen.** Zwei PRs gemergt, ein Change geplant und
fremdgeprüft. Der Plan-Review hat vier Löcher gefunden, die echten Schaden
angerichtet hätten — sie sind eingearbeitet, bevor eine Zeile Code entstand.

## Accomplished

**AGE-534 (C10-Import) endlich auf `main`** — PR #191, `e9beb9f`. Das gesamte
WordPress-Import-Werkzeug (~11.400 Zeilen, 343 Tests) lag seit dem 17.08. allein
lokal auf einem Branch, **6 ahead / 64 behind, nie ein PR**. Es hat die 72
PROD-Profile erzeugt, war aber in keinem CI-Lauf und auf keiner Fläche. Zwei
echte Fehler kamen dabei heraus:

- Ein Quelltext-Wächter (`PublicProfilePage.bio.test.tsx`) zerbrach an einem
  **Umzug**, nicht an einem Fehler: `main` setzte `whitespace-pre-line` direkt
  an den Absatz, der Branch hatte ihn nach `Biografie` verlegt. Aufgelöst auf
  die Komponente (Obermenge), Wächter folgt dem Text, beide Zusagen mit einer
  Verbiegung rot belegt.
- **`deno.lock` kannte `csv-parse` und `sharp` nicht.** `deno test --frozen`
  brach beim allerersten CI-Lauf ab. Der Fix ist 474 Zeilen groß, weil
  `deno install` alle `^`-Bereiche neu auflöst — inert, weil `deno.lock` nur
  zwei CI-Schritte über `supabase/functions/` steuert und diese Functions kein
  npm-Paket importieren. `pnpm-lock.yaml` ist unangetastet.

**AGE-578: QM-Feedback in die Administration** — PR #193, `1491e97`. Card von
`EinstellungenPage` nach `AdminSettingsPage`, Rollenabfrage entfällt (Route
hängt hinter `RequireAdmin`), `staffRole` aus der Destrukturierung. Sichtprobe
im Browser auf beiden Seiten.

**AGE-576 + OpenSpec-Change `sync-dev-from-prod`** — geplant, fremdgeprüft,
überarbeitet. Vier Artefakte plus `REVIEWS.md`, `validate --all` grün, **kein
Code**. Liegt auf `donald/age-576-spiegel-dev-prod` (gepusht, kein PR).

**Der Plan-Review war der Ertrag der Sitzung.** gemini und codex, beide
REQUEST-CHANGES (1 bzw. 8 HIGH). Vier prüfbare Behauptungen an PROD nachgemessen,
alle bestätigt, zwei schwerer als beschrieben. Der Entwurf hätte sonst:

| Loch | Folge |
|---|---|
| `auth.identities` fehlte im Umfang | **72 Konten erzeugt, an denen sich niemand anmelden kann** |
| 13 Trigger auf `public` statt einem | zusätzliche Beiträge/Benachrichtigungen — und `contact_requests_email_webhook` hätte **Post an echte Mitglieder** verschickt |
| Wächter prüfte nur das Ziel, nur die DB | vertauschte Quelle durchgelassen; PROD-Buckets leerbar bei grüner DB-Prüfung |
| Abnahme „Zeilenzahl = PROD" + 3 Konten herstellen | **logisch unerfüllbar** |

Ausserdem: Signup-Trigger setzt **`basic`**, nicht `discover` (ich hatte eine
Juni-Migration statt der geltenden Definition gelesen), und
`git status --porcelain --ignored` führt **schon vorher 17 Pfade**.

## Decisions

- **Zielbild (Donald/Detlev, 20.08.):** PROD geht live mit **allen** Mitgliedern,
  aber **leer** — keine erfundene Aktivität. DEV behält die heutigen PROD-Daten.
  Die ausgelieferte UI bleibt auf DEV bis zur Umschaltung. Import = alle
  `impact`; der Stufenweg ab `basic` wird **~eine Woche nach dem Go-Live**
  freigeschaltet. *Warum:* schließt Schritt 0 des PROD-Neuaufbauplans, der die
  Frage ausdrücklich offengelassen hatte.
- **Keine Anonymisierung beim Spiegel** — gegen beide Prüfer. *Warum:* der
  Spiegel existiert, um Fehler zu finden, die nur an echten Daten auftreten; die
  acht Befunde vom 17.08. wurden alle an echten Datensätzen gefunden. Der
  Ausgleich: Demo-Passwörter ändern und aus dem öffentlichen Repo nehmen
  (Gruppe 2a, **Voraussetzung** des ersten Laufs), Produktions-Hashes
  neutralisieren.
- **Feedback-Zeilen auf DEV werden mitersetzt.** *Warum:* dieselbe Tabelle kann
  nicht synchron mit PROD sein und eigenen DEV-Bestand führen.
- **`merge main → Branch` statt Rebase** bei #191. *Warum:* sechs Commits über
  64 hinweg hätten dieselben Konflikte bis zu sechsmal gestellt. Es blieben zwei.
- **Vollersatz statt zeilenweisem Abgleich** beim Spiegel. *Warum:* nicht der
  Aufwand, sondern die Unbemerkbarkeit des Verfalls — eine neue Spalte würde ein
  Abgleich schlicht nicht übertragen, und **kein Test könnte das aufdecken**.
- **Drei Review-Befunde begründet zurückgewiesen** (REVIEWS.md §10–12): Weg A/B
  ist entschieden (nur das Dokument hinkt nach), Wartungsschaltung für DEV ist
  überzogen, Verschlüsselung ohne Schlüsselverwaltung wäre Theater.

## Files modified

- `src/pages/PublicProfilePage.tsx` · `.bio.test.tsx` — Konflikt auf `Biografie`
  aufgelöst, Wächter folgt dem Text in die Komponente
- `deno.lock` — `csv-parse` und `sharp` aufgenommen
- `src/pages/EinstellungenPage.tsx` · `.test.tsx` — Card, Import und `staffRole`
  raus; drei Gating-Zusagen durch die eine ersetzt, die den Umzug belegt
- `src/pages/AdminSettingsPage.tsx` · `.test.tsx` — Card rein, zwei Zusagen
- `openspec/changes/sync-dev-from-prod/**` — proposal, design, tasks, zwei
  Spec-Deltas, REVIEWS.md
- **Ausserhalb des Repos:** Linear AGE-576 und AGE-578 angelegt; Memory
  `go-live-zielbild-prod-dev`, `paid-until-steht-in-profile-legacy`,
  `spiegel-keine-anonymisierung` (+ `MEMORY.md`)

## Next session: start here

Nichts ist halb fertig. `main` steht auf `1491e97`, Arbeitsbaum sauber, 70
Migrationen in Dateien/DEV/PROD. Der Spiegel-Change ist geplant und geprüft, aber
**kein Code geschrieben** — die erste Aktion ist **Aufgabengruppe 1 aus
`openspec/changes/sync-dev-from-prod/tasks.md`**, und sie ist bewusst codefrei
und rein lesend: trägt `pg_dump` die Pooler-Verbindung (1.2), und lassen sich die
zwölf übrigen Trigger stilllegen (1.4/1.5)? **Fällt eines der beiden aus, wird
der Entwurf verworfen statt gerettet** — dann ist der `pg_restore`-Weg falsch und
es wird der zeilenweise Spiegel gebaut. Checkout auf
`donald/age-576-spiegel-dev-prod`, dort liegt alles.

Zwei Fallen aus dieser Sitzung: **`ls` ist ein eza-Alias** — `ls … | wc -l`
zählte 71 Migrationen, es sind 70 (Kopfzeile). Und **`deno install` überschreibt
pnpms `node_modules`**; danach ist `pnpm install --frozen-lockfile` nötig, sonst
scheitert vitest am Laden von `vite.config.ts`.

## Open questions

- **Was tut der Spiegel nach dem Go-Live?** Dann kopiert derselbe Lauf echte
  Gespräche und Nachrichten. Bewusst verschoben; der Nachbereitungsschritt ist
  als Ort dafür gebaut.
- **`admin_list_feedback()` kennt kein Paging** — lieferte in der Sichtprobe alle
  21 Zeilen am Stück und ist jetzt das längste Element der Administrationsseite.
  Nach Donalds genereller Ansage nachzuziehen; braucht ein eigenes Issue.
- **Detlevs Zahlungsliste fehlt weiterhin.** Sie ist die einzige offene Zutat für
  C10-Aufgabe 3.5 (`paid_until` nach `profile_legacy` — das Feld existiert, siehe
  Memory). AGE-534 bleibt deshalb *In Progress*.
- **Ein Downgrade existiert nirgends** — `apply_upgrade` geht nur hoch,
  `admin_update_profile` hat `tier` nicht auf der Weißliste. Für „bezahlt bis"
  mit Rückstufung nötig (AGE-516).
- **Abo-Liste in der Administration:** `admin_list_members` liefert `paid_until`
  nicht; die Einzelbearbeitung gibt es schon.
- **Der C10-Branch `donald/age-534-…` liegt noch lokal** — Inhalt ist über #191
  auf `main`, der Branch kann weg.
- Unverändert offen: AGE-497 (Rechtsseiten) · AGE-541 (erfundene Kennzahlen) ·
  AGE-512 (Secrets trennen) · AGE-256 (Domain + SPF/DKIM) · AGE-513 (Mailtext) ·
  AGE-258 · Rücknahmeliste vor Go-Live · eigenes Issue für `send-activation`
  (2xx trotz Resend-401).
