# Datenmatrix — was die Kontolöschung mit welcher Zeile tut

Aufgabe 1.1. Gemessen am **lokalen** Stack (`127.0.0.1:54322`) am 2026-09-08,
nicht aus den Migrationen zusammengesucht. Sie ist das Abnahmedokument für
Test 5.1: was hier als *geleert* steht, muss der Test leer vorfinden.

Keine Mitgliederdaten in dieser Datei — nur Schema. Das Repository ist öffentlich.

## 0. Die zwei Messungen, die den Plan geändert haben

**`search_doc` ist eine `generated always as … stored`-Spalte.** Sie berechnet
sich aus `name, company, branche, short_bio, headline, roles, competencies,
interests` selbst. Die Anonymisierung muss sie **nicht** neu setzen — sie kann es
nicht einmal. Was sie muss: **jede dieser acht Quellspalten leeren**, sonst bleibt
der Rest im Index durchsuchbar. Die Sorge aus design.md D3 war berechtigt, die
Abhilfe ist eine andere als vermutet. Test 5.2 bleibt, jetzt als Absicherung der
Quellspalten-Vollständigkeit.

**`storage.objects` hat KEINEN Fremdschlüssel auf `auth.users`.** Die Spalten
`owner` und `owner_id` existieren, tragen aber keine Fremdschlüssel-Bedingung —
nur `bucket_id → storage.buckets`. Der Befund von codex (HIGH #3), die
Eigentümerschaft könne die Nutzerlöschung verhindern, **misst sich auf diesem
Schema nicht**. Die Reihenfolge „Dateien zuerst" bleibt trotzdem, aus dem zweiten
Grund: nach dem `auth.users`-Abgang ist bei einem Abbruch niemand mehr da, der
die Pfade nachschlagen könnte.

## 1. Geleert — die Personenbezug tragenden Spalten

### `profiles` (die Zeile BLEIBT, als namenloser Anker)

| Spalte | Hinweis |
|---|---|
| `name` | Quellspalte von `search_doc` |
| `company` | Quellspalte von `search_doc` |
| `branche` | Quellspalte von `search_doc` |
| `short_bio` | Quellspalte von `search_doc` |
| `headline` | Quellspalte von `search_doc` |
| `roles` | Quellspalte von `search_doc` |
| `competencies` | Quellspalte von `search_doc` |
| `interests` | Quellspalte von `search_doc` |
| `avatar_url`, `cover_url` | zeigen auf Objekte, die mitgelöscht werden |
| `region` | Wohnort-Näherung |
| `goals`, `next_steps` | Freitext des Mitglieds über sich |
| `website`, `socials` | `socials` ist `jsonb` — ganz leeren, nicht Schlüssel einzeln |
| `member_number`, `member_since` | identifizierend |
| `dev_focus`, `dev_progress` | `dev_focus` trägt einen CHECK auf feste Werte; `null` erfüllt ihn |
| `videos` | `not null`, Vorgabe `'{}'` → auf `'{}'` setzen, nicht `null` |

**Bleiben stehen:** `id` (der Anker), `created_at`, `updated_at`, `tier`
(Fremdschlüssel auf `membership_tiers`, `not null`), `potential_score`,
`profile_completion` (Trigger rechnet sie ohnehin neu), `is_public`,
`activated_at`, `disabled_at` — plus der neue Löschzustand.

> Zwei Trigger laufen beim `update` mit: `profiles_set_updated_at` und
> `trg_profiles_completion`. Beide sind harmlos; `profile_completion` fällt
> erwartungsgemäss auf einen niedrigen Wert.

### Ganz gelöschte Zeilen — eigene Daten des Mitglieds

`profile_contacts` (E-Mail, Telefon, Strasse, PLZ, Ort, Bundesland, Land) ·
`profile_interests` · `profile_badges` · `profile_theme_scores` ·
`compass_responses` · `goals` · `offers` · `needs` · `member_settings` ·
`profile_legacy` · `push_tokens` · `activation_tokens` · `notifications` ·
`thread_read_positions` · `post_likes` · `post_saves` · `matches` ·
`staff_roles` · `event_vorlagen`

Alle hängen mit `on delete cascade` an `profiles` und tragen nur Eigenes. Zwei
verdienen eine Bemerkung:

- **`staff_roles`** — löscht ein Admin sein eigenes Konto, muss die Rolle mit.
- **`matches`** — betrifft zwei Profile (`a_profile_id`, `b_profile_id`); die
  Zeile geht, weil eine Paarung mit einem gegangenen Mitglied keinen Wert hat.

## 2. Anonym stehengelassen — fremde Gesprächsfäden

| Tabelle | Spalte | Warum |
|---|---|---|
| `posts` | `author_id` | Beitrag trägt fremde Kommentare |
| `comments` | `author_id` | Faden verlöre seine Mitte |
| `messages` | `sender_id` | Gegenüber verlöre den Verlauf |
| `message_threads` | `a_profile_id` / `b_profile_id` | strikt zweiseitig (`unique (a,b)`) — Gruppenchats gibt es nicht |
| `contact_requests` | `from_id` / `to_id` | **nur angenommene** |
| `event_registrations` | `profile_id` | **nur vergangene** Veranstaltungen |

Angezeigt werden sie über die bestehende Mechanik als „Ehemaliges Mitglied"
(`former_member_entries`, AGE-581).

## 3. Freigegeben — Bindungen an andere lösen (D10)

| Was | Aktion |
|---|---|
| `event_registrations` zu **künftigen** Veranstaltungen | auf `cancelled` — `status` kennt den Wert bereits, und es gibt eine `waitlist`, die sonst nicht nachrückt |
| geplante, unveröffentlichte `posts` | löschen — noch niemandes Gesprächsfaden |
| **offene** `contact_requests` des Kontos | zurückziehen |

## 4. Sonderfälle, die keine Aktion brauchen

| Tabelle | Spalte | Regel | Warum nichts zu tun ist |
|---|---|---|---|
| `events` | `host_id` | `SET NULL`, nullable | Künftige Veranstaltungen bleiben mit anonymem Gastgeber stehen — automatisch absagen träfe alle Angemeldeten. Admin-Aufgabe |
| `admin_audit` | `actor` | `NO ACTION`, `not null` | Die Profilzeile bleibt, also greift `NO ACTION` nicht. Audit-Einträge sind Nachweis und bleiben |
| `platform_settings` | `updated_by` | `NO ACTION`, nullable | wie oben |
| `release_notes` | `created_by` | `SET NULL`, nullable | bleibt |
| `release_entry_skips` | `skipped_by` | `SET NULL`, nullable | bleibt |
| `routing_queue` | `assigned_to` | `SET NULL`, nullable | bleibt |

## 5. Objektspeicher

| Bucket | Aktion |
|---|---|
| `avatars` | löschen — **auch ersetzte Vorgänger**, die in keiner Spalte mehr stehen |
| `covers` | löschen, ebenso |
| `post-media` | löschen; die Beiträge bleiben, ihre Bilder gehen |
| `feedback-screenshots` | löschen |
| `event-covers` | **bleiben** — sie gehören zur Veranstaltung, nicht zur Person, und die Veranstaltung bleibt bestehen |

Ein fehlendes Objekt ist kein Fehler. Fremde Dateien dürfen nicht mitgehen; das
ist eigens zu prüfen (Test 5.11).

## 6. Aufbewahrt

Keine Tabelle. `add-easybill-invoicing` ist nicht umgesetzt, es existiert heute
**keine** Rechnungstabelle. Zu belegen ist allein, dass die Anonymisierung nur die
oben aufgezählten Tabellen anfasst — eine spätere Rechnungstabelle wird von ihr
nicht berührt.

## 7. Was diese Matrix NICHT erreicht

Freitext, den andere geschrieben haben: `messages.body`, `posts.body`,
`comments.body` und die @-Erwähnungen darin, die dieses Projekt über den *Namen*
auflöst. Siehe design.md D9 — bewusste Grenze, keine Auslassung.
