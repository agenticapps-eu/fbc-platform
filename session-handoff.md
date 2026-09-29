# Session Handoff — 2026-09-29 (AGE-927 Mitglied anlegen)

> **Scope dieser Übergabe: AGE-927.** Fremde offene Punkte stehen hier bewusst
> NICHT. AGE-903 ist ebenfalls abgeschlossen und auf PROD.

> ## ✅ ABGESCHLOSSEN UND AUF PROD
>
> PR #440 gemergt (`560dcdf`), `migrate-prod` gelaufen, Deploy grün, AGE-927 in
> Linear auf **Done**. **Es ist nichts offen.**
>
> Wer hier weiterarbeitet, fängt bei einem neuen Vorgang an — und darf diesen
> Worktree mit `wt remove` abräumen, ebenso `stufen-v5` (AGE-903).

## Accomplished

**Detlev kann ein Mitglied selbst anlegen** — ohne Stripe, ohne Odoo-API — und
sieht danach, wer noch auf seine Einladung wartet.

| Ebene | Beleg |
|---|---|
| pgTAP (CI-Liste) | 41 Dateien, 1422 Zusagen |
| Vitest | 254 Dateien, 2960 Zusagen |
| Deno (CI-Zeile) | 287 Zusagen |
| `openspec validate --all` | 35/0 |
| CI auf `33454c7` | `verify`, `migrations`, `edge-functions`, `pr-title` grün |
| PROD-Deploy `36532591224` | `drift-gate`, `migrate-dev`, `deploy`, `functions` grün |

**Auf PROD nachgemessen, durch die echten Funktionen** (nicht an grünen Haken):

| | |
|---|---|
| `admin_member_counts()` | angelegt **22** + eingeladen **14** = offen **36**; aktiviert 28; alle 64; deaktiviert 14; gelöscht 0 |
| `admin_list_members(…, 'eingeladen')` | 14 Zeilen, **alle 14** mit `eingeladen_am` |
| `admin_list_members(…, 'angelegt')` | 22 Zeilen, **0** mit `eingeladen_am` |
| Rechte | `member_state_matches` niemand · `admin_list_members` nur `authenticated` · beide neuen nur `service_role` |
| Ausgeliefertes Bündel | `SENTRY_RELEASE.id` = `560dcdf…` = Kopf von `main` |
| Seiten-Chunk live | trägt „Mitglied anlegen", „Ausgewählte einladen/erinnern", „kein Versand bestätigt" |
| Beide Edge Functions | antworten unauthentifiziert **401**, nicht 404 |
| `open_contact` | **`true`**, unverändert — nur gelesen |

**Die 22 sind der Punkt:** der alte Reiter „Nicht aktiviert" zeigte 36 als einen
Klumpen. Jetzt steht da, dass 22 davon noch **nie** eine Einladung bekommen
haben.

## Decisions

**Der Einladungsstand wird ABGELEITET, nicht gespeichert** — keine Spalte, kein
Flag, kein Trigger, keine Policy auf `activation_tokens`. *Warum:* die Wahrheit
steht in der Tokentabelle; eine zweite Ablage liefe auseinander.

**Eigener Endpunkt `admin-invite-members`.** *Warum:* `send-activation`
antwortet auf **jedem** Pfad mit `202 {accepted: true}` — über sie ist kein
wahrheitsgemässer Bericht herstellbar. Die Schutzriegel bleiben unverändert in
`issue_activation_token`.

**Die Schleife liegt in der FLÄCHE, ein Aufruf je Mitglied.** *Warum:*
„Fortschritt als Zahl" und „Wegnavigieren bricht ab" sind beide unmöglich, wenn
der Server schleift.

**Kein Kopfkästchen „alle auswählen"** (ADR-0007). *Warum:* ein Klick,
deckungsgleich mit der Massenaktion, die der Record verwirft.

## Files modified

`src/pages/AdminMitgliederPage.tsx` · `…aufnahme.test.tsx` (neu, 32 Zusagen) ·
`…test.tsx` · `src/lib/admin-members.ts` · `src/lib/database.types.ts` (von
Hand) · zwei Migrationen · zwei Edge Functions · `docs/lastenheft.md` ·
`openspec/specs/admin/spec.md` + Archiv.

## Next session: start here

**Nichts aus AGE-927.** Wer hier landet, sollte den Worktree abräumen und mit
einem neuen Vorgang anfangen.

Einzige noch offene Zeile in `tasks.md` §7 ist bewusst so: der
Neuigkeiten-Eintrag dieses Change ist **für Mitglieder nicht gedacht** — er
beschreibt eine reine Adminfläche und gehört in keine Release-Note.

## Fallen, die diese Sitzung gekostet haben

* **Ein Entzug, den nur eine FRISCHE Instanz messen kann.** `revoke … from
  public, anon` ist auf einem gewachsenen Stack vollständig und auf einer neu
  angelegten Instanz nicht — die vergibt rollen-eigen. Lokal 1422 Zusagen grün,
  in der CI zwei rot. Der Befund stand seit dem 27.08. im Kopf von
  `20260827070000_entzuege_nennen_alle_rollen.sql`; ich bin in dieselbe
  beschriftete Grube gefallen. **Immer alle vier Rollen nennen**, dann genau
  eine zurückgeben.
* **`waitFor` ist zufrieden, sobald die Zahl EINMAL stimmt.** Die
  Abbruch-Zusage bestand auch ohne den Riegel. Für „es passiert NICHTS mehr"
  braucht es eine echte Pause und eine harte Zusage.
* **`findByRole` löst auf dem ERSTEN Treffer auf** — die Zusage zur vergebenen
  Adresse prüfte die Liste statt der Maske. Beide Male half nur, die Zahl der
  Treffer zu messen.
* **`openspec archive` meldet nur den ERSTEN fehlenden Szenariennamen**, und ein
  umbenanntes Szenario ist ein gelöschtes.
* **Der PR-TITEL schliesst den Linear-Vorgang**, auch wenn der Branch kein
  Kürzel trägt. Ich hatte das Gegenteil angekündigt; `get_issue` hat es
  widerlegt.
* **GoTrue-Löschen räumt `public.profiles` nicht mit ab** — acht verwaiste
  Zeilen nach der Sichtprobe.
* **`cn()` ist ein Join ohne `tailwind-merge`** — `rounded-full` über
  `rounded-md` verlor, der schwebende Knopf war eckig. Nur im Browser sichtbar.

## Zustand der Umgebung

* **Lokaler Stack:** auf dem Stand vor der Sichtprobe — 28 Profile, 0 Tokens,
  0 Adminzeilen. `.env.local` gelöscht, vite und `functions serve` beendet,
  Browser freigegeben, `localStorage` geleert, Sonden-Skript entfernt.
* `20260925120000_release_backfill.sql` (AGE-905) fehlt lokal und bricht ab —
  **fremde Migration, nicht anfassen**.
* Im **Haupt-Checkout** liegt fremde ungesicherte Arbeit (AGE-907). **Nicht
  anfassen.**
* Screenshots der Sichtprobe: `.gstack/age927/` (gitignored).

## Open questions

* **Das Rennen bei verschieden geschriebenen Adressen** bleibt offen — es zu
  schliessen hiesse, einen Unique-Index über `lower(email)` in `auth.users`
  anzulegen, also in fremdes Schema zu schreiben. Auf PROD gemessen: 0 von 78
  Adressen mit Grossbuchstaben, 0 Paare, die sich nur in der Schreibung
  unterscheiden.
* **„Ohne Passwort" ist nicht am Feld ablesbar.** GoTrue schreibt auch ohne
  übergebenes Passwort einen 60-Zeichen-bcrypt-Hash — wie bei allen
  Bestandskonten. Belegt ist die Zusage durch den Anmeldeversuch: leer,
  Leerzeichen und ein geratenes Wort geben alle `invalid_credentials`.
* **`eingeladen_am` sagt „Link erzeugt", nicht „Mail zugestellt".** Eine
  Zustellbestätigung wäre ein Resend-Webhook und ein eigener Change.
* **`service_role` hat auf PROD sein Ausführungsrecht an `admin_list_members`
  verloren** — beabsichtigt, kein Aufrufer im Repo, keine Zusage fordert es.
  Vorher gemessen `true`, nachher `false`. Benannt, falls es je jemand sucht.
