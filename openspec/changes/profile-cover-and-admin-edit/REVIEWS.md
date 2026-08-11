---
reviewers: [gemini, codex]
models: [gemini-cli-default, gpt-5.6-sol]
verdicts: [REQUEST-CHANGES, REQUEST-CHANGES]
reviewed_artifacts_sha: a9fbafd35b221dd739637afc4203a09cbdd044c3d0cb096236a649533cbde946
---

# Change review — profile-cover-and-admin-edit

Zwei Reviewer, zwei Anbieter, keiner davon der Anbieter, der das Delta
geschrieben hat. Beide Verdikte: **REQUEST-CHANGES**.

Einschränkung zu Regel 4: Der gemini-Arm des Wrappers pinnt kein Modell und
gibt das aufgelöste Modell nicht aus, deshalb steht oben der CLI-Standard statt
einer Modellkennung. Der codex-Arm meldet `gpt-5.6-sol` im Banner.

## Reviewer: gemini

Modell: CLI-Standard (der gemini-Arm pinnt keines und gibt keines aus).

VERDICT: REQUEST-CHANGES

- **[HIGH]** Edge Function `admin-change-email` — kein Audit-Log für eine
  identitätsändernde Operation — jede Ausführung muss Akteur, Ziel, Zeit und
  Vorher/Nachher festhalten.
- **[MEDIUM]** `legacy_*` / `paid_until` — der Lebenszyklus nach Ablauf ist
  undefiniert (genullt? archiviert? ignoriert?).
- **[LOW]** `admin_update_profile` — die Weißliste prüft Schlüssel, nicht Werte;
  `paid_until: "morgen"` bricht unsauber ab.

Ungesagte Annahmen laut gemini: dass der Profilzeilen-Umfang für alle
Nach-Import-Korrekturen reicht · dass `tier` nie von Hand geändert werden muss ·
dass `profiles.email` gefahrlos ignoriert werden kann.

## Reviewer: codex

Modell: gpt-5.6-sol (aus dem Banner der CLI).

VERDICT: REQUEST-CHANGES

7 HIGH, 8 MEDIUM, 2 LOW. Die tragenden:

- **[HIGH] Lesen ist ungeschützt.** `paid_until`, `legacy_price`, `legacy_tier`
  auf `public.profiles` sind für **jedes** `discover+`-Mitglied lesbar —
  `authenticated` hält Tabellen-SELECT, und `profiles_select_self_or_discover`
  gibt die **volle Zeile** zurück. Der Change schützt nur das Schreiben.
- **[HIGH] Der Admin-Weg ist für seinen eigenen Anlassfall unerreichbar.**
  `fetchProfileEditorData` liest unter RLS; `/p/:id` liest `profiles_public`.
  **Beide** verlangen `activated_at is not null` **am Zielprofil**. Ein
  importiertes, unbestätigtes Mitglied — genau der Ausgesperrte — ist für
  niemanden sichtbar. Der Bearbeiten-Button erscheint nie.
- **[HIGH] `public.profiles.email` existiert nicht.** Die zitierte Zeile gehört
  zu `public.profile_contacts`, und die ist **nicht tot**:
  `notify-contact-request/index.ts:103` und `src/lib/contact-requests.ts:176`
  lesen sie.
- **[HIGH] `revoke_sessions` leistet weniger als behauptet.** Der Kopf der
  Funktion sagt es selbst: ein ausgegebener Access-Token bleibt bis
  `jwt_expiry` (3600 s) gültig.
- **[HIGH] Medien-Upload im Admin-Modus scheitert.** Der Client lädt nach
  `{targetUid}/…`, die Policies verlangen `auth.uid()` des Aufrufers.
- **[HIGH] `paid_until` hat keinen Verbraucher**, also ist „danach fehlt nur
  noch ein Import-Script" zu stark formuliert.
- **[HIGH]** Die Function-Tests decken den erfolgreichen Ablauf nicht ab.
- **[MEDIUM] `case when patch ? 'x' then patch ->> 'x'`** trägt nicht
  einheitlich: `roles`/`competencies`/`videos` sind Arrays, `socials` ist jsonb,
  `paid_until`/`legacy_price` brauchen geprüfte Casts.
- **[MEDIUM] `create or replace view`** kann keine Spalte in der Mitte
  einfügen — nur anhängen.
- **[MEDIUM]** `legacy_source_id`: leere und Leerzeichen-Kennungen sind nicht
  NULL und kollidieren.
- **[MEDIUM]** Bucket: `file_size_limit` ohne Wert; `on conflict do nothing`
  konserviert einen falsch konfigurierten Bestands-Bucket.
- **[MEDIUM]** Entfernen des Covers ist Entkoppeln, nicht Löschen — Objekte
  bleiben öffentlich abrufbar.
- **[MEDIUM]** Für „Über mich / Beruf / Hobbys / Aktivitäten" ist keine Quelle
  benannt; das **eigene** Profil (`ProfilAnsichtPage` / `dashboard.ts`) fehlt in
  den Aufgaben — ein Mitglied lädt ein Cover hoch und sieht es dort nicht.
- **[LOW]** `supabase test db` nimmt **positionale Pfade**, kein `--file`.
- **[LOW]** „Byte für Byte unverändert" widerspricht der Aufnahme von
  `cover_url`.

## Nachgemessen, nicht geglaubt

Jede tragende Behauptung ist gegen das Repo geprüft worden:

| Behauptung | Ergebnis |
|---|---|
| `profiles.email` existiert nicht | **bestätigt** — `20260611115655:38` liegt im `create table public.profile_contacts`, nicht in `profiles`. Der Fehler war meiner: der Grep sah die Zeile ohne Tabellenkontext. |
| Volle Zeile für `discover+` lesbar | **bestätigt** — `20260806080100_activation_gate.sql:75-81` |
| `revoke_sessions` lässt laufende Tokens gelten | **bestätigt** — der Kommentar der Funktion sagt es wörtlich (`20260806080200:210-215`) |
| `profile_contacts.email` ist in Gebrauch | **bestätigt** — `notify-contact-request/index.ts:103`, `contact-requests.ts:176` |
| `supabase test db` hat kein `--file` | **bestätigt** — `USAGE: supabase test db [flags] <path...>` |
| Zielprofil muss aktiviert sein, um sichtbar zu sein | **bestätigt** — Policy `:79` und View `:489-495` |

## Resolution

**Übernommen, mit Änderung am Delta:**

1. **HIGH (Leserechte).** `paid_until`, `legacy_tier`, `legacy_price`,
   `legacy_source_id` wandern aus `public.profiles` in eine private 1:1-Tabelle
   `public.profile_legacy` — RLS an, **kein** Client-Grant, Zugriff nur über
   `service_role` und die Admin-RPCs. Das weicht von der Feldliste in AGE-498
   ab; der Grund ist, dass ein Spalten-Grant nur das Schreiben regelt und
   `legacy_price` sonst für jedes `discover`-Mitglied im Klartext steht. Nur
   `cover_url` bleibt auf `profiles` — es ist ohnehin öffentlich.
2. **HIGH (kein Lesepfad).** Neu: `admin_get_profile(target uuid)` und
   `admin_find_profile(needle text)` als `SECURITY DEFINER`-Lesefunktionen. Ohne
   sie ist der Anlassfall unerreichbar. Dazu ein Einstieg über eine Kennung
   statt über `/p/:id`, weil die Seite für unbestätigte Profile nicht existiert.
3. **HIGH (`profiles.email`).** Falschbehauptung gestrichen. Neue Festlegung:
   Login-Adresse (`auth.users`) und Kontaktadresse (`profile_contacts.email`)
   sind **getrennte** Begriffe, und `admin_update_profile` schreibt die
   Kontaktzeile **mit** — sonst gingen die Benachrichtigungen weiter an das
   Postfach, an das das Mitglied nicht herankommt.
4. **HIGH (`revoke_sessions`).** Die Restfläche wird benannt statt überschrieben,
   im Wortlaut der bestehenden Funktion (bis zu 3600 s).
5. **HIGH (Medien im Admin-Modus).** Avatar- und Cover-Steuerung sind im
   Fremd-Modus ausgeblendet; als Requirement ausgeschrieben, nicht nur als
   Aufgabe.
6. **HIGH (Audit).** Beide Reviewer unabhängig — deshalb jetzt, nicht später:
   `public.admin_audit` wird von beiden Schreibwegen befüllt.
7. **HIGH (Function-Tests).** Erfolgsfall, Reihenfolge (`updateUserById` vor
   `revoke_sessions`) und ein DEV-Integrationslauf gegen echtes GoTrue kommen
   in die Aufgaben.
8. **MEDIUM** übernommen: feldweises Dekodieren + `jsonb_typeof`, Anhängen der
   View-Spalte am Ende, `nullif(btrim(…),'')` im Unique-Index, konkreter
   Größenwert + `do update` beim Bucket, Entkoppeln statt Löschen benannt,
   Quellen je Mockup-Abschnitt benannt, eigenes Profil (`dashboard.ts`) ergänzt,
   ES256-Integrationstest.
9. **LOW** übernommen: positionale Pfade bei `supabase test db`,
   `gen types … --local >`, Wortlaut „unverändert bis auf `cover_url`".

**Nicht übernommen, mit Begründung:**

- **`paid_until`-Lebenszyklus implementieren** (gemini MEDIUM, codex HIGH-Teil).
  Was beim Ablauf geschieht, ist eine Abrechnungsentscheidung und gehört zu
  C10/`billing-upgrades`. Übernommen wird nur die **Semantik** (einschließlich
  des genannten Tages; NULL = unbekannt) und die Korrektur der zu starken
  Aussage: nach C6 fehlt **keine Schema-Änderung** mehr — das ist etwas anderes
  als „nur noch ein Import-Script".
- **Werte-Validierung bis ins Format** (gemini LOW) nur insoweit, als der Cast
  scheitern darf: ein `paid_until: "morgen"` bricht die Funktion ab, und das ist
  das gewünschte Verhalten. Eine eigene Fehlermeldung je Feld ist Aufwand ohne
  Empfänger.
- **`tier` in die Weißliste** (gemini-Annahme). Bleibt draußen. Stufenwechsel
  gehen über Abrechnung und Import; ein Admin-Patch wäre der stille
  Nebeneingang, den dieser Change gerade vermeiden will.

<!-- openspec-review-trailer v1
implementing-host: claude
digest: sha256:009d15da151ddc4b110b6aef7f4fc58f70d8999e08cfe2ab11cc28f19584609c
producer-version: 1.2.0
tasks-digest: sha256:c4f4f7895b03605880ab2e419a73effda4bc2f2a31341bb5990344ac7171c90d
-->

## Review auf dem Diff (Schritt 4)

Ein Reviewer, anderer Anbieter: **codex (gpt-5.6-sol)**, auf `git diff main...HEAD`.
VERDICT: **REQUEST-CHANGES**, 6 HIGH und 3 MEDIUM. Sechs sind übernommen, zwei
richtiggestellt, einer abgelehnt.

| Befund | Nachgemessen | Erledigt |
|---|---|---|
| **[HIGH]** `videos` steht im Admin-Formular, fehlt aber im Patch — Speichern meldet Erfolg und verwirft die Änderung | bestätigt | `sanitizeVideos(form.videos)` im Patch + Test |
| **[HIGH]** `Number("zwölfhundert")` → NaN → JSON `null`: ein Tippfehler löscht `legacy_price` still | bestätigt | Prüfung vor dem Aufruf, Fehler statt Löschung + Test |
| **[HIGH]** Weißliste nimmt `goals`/`interests` — Namen kollidieren mit den Kind-Tabellen | bestätigt | beide raus; zwei pgTAP-Fälle halten das fest |
| **[HIGH]** Adressänderung meldet 200, auch wenn der Audit-Eintrag scheitert | bestätigt | dritter Ausgang `not_audited`, geht dem Sitzungs-Hinweis vor; die Oberfläche zeigt ihn als Fehler, ohne zum Wiederholen einzuladen |
| **[HIGH]** `profile_legacy` verspricht Import über `service_role` — das hat keine Tabellenrechte | **bestätigt, und mein Fehler**: der Import läuft über eine direkte DB-Verbindung (`pg`, wie `demo_seed.ts`). Kommentar und Spec sagten das Falsche | Kopf und `comment on table` richtiggestellt |
| **[MEDIUM]** `jsonb_array_elements_text('null')` wirft — „JSON-null leert" galt nur für Textfelder | bestätigt (`cannot extract elements from a scalar`) | Helfer `jsonb_text_array`, zwei pgTAP-Fälle |
| **[MEDIUM]** `%` und `_` bleiben ILIKE-Joker: `'%%%'` kommt durch die Drei-Zeichen-Schwelle | bestätigt — lieferte **20 Treffer**, also die Mitgliederliste durch die Hintertür | Escaping mit `!`, pgTAP-Fall |

**Nicht übernommen:**

- **[HIGH] „Jedes Speichern schickt einen veralteten Formular-Schnappschuss"**
  (optimistisches Sperren gegen gleichzeitige Änderungen). Der Befund stimmt,
  aber er beschreibt **jedes** Formular in diesem Repo — der eigene Profil-Editor
  verhält sich seit AGE-238 genauso. Ihn nur für den Admin-Weg zu lösen hieße,
  zwei Speicher-Semantiken nebeneinander zu haben; ihn überall zu lösen ist ein
  eigener Change. Notiert, nicht gebaut.

**Und einer, den kein Reviewer gefunden hat:** `admin-change-email` las
`staff_roles` direkt mit `service_role` und lief in „permission denied". Gefunden
hat das die **Sichtprobe im Browser** — nicht pgTAP, nicht Vitest, nicht der
Fremd-Review. Behoben mit `is_admin_uid` und `log_admin_action`.
