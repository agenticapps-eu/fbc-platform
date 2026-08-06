# Beweise — Mitglieder-Aktivierung (AGE-495)

Erzeugt mit `scripts/probe-activation-gate.ts`, gegen **DEV**
(`foelowldexkcqzewvrcf`). Das Skript legt ein Wegwerf-Konto an, gibt ihm die
Stufe `impact` und eigene Zeilen (Kontaktdaten, Ziel, Benachrichtigung,
Einstellungen), fragt mit einem **rohen Supabase-Client** an der App vorbei und
löscht das Konto wieder.

**Warum `impact`:** Importierte Mitglieder bekommen die höchste Stufe. Hinter dem
Aktivierungs-Gate liegt bei ihnen kein Stufen-Gate mehr, das einen Fehler noch
auffinge. Ein `basic`-Sondenkonto sähe vieles schon wegen der Stufe nicht und
täuschte ein Gate vor, das gar nicht greift.

**Warum eigene Zeilen:** Ohne sie wäre die 0 im Abschnitt „Eigene Daten" nach dem
Change kein Beleg fürs Gate, sondern nur ein Beleg für ein leeres Konto.

---

## Vorher — 2026-08-06, vor Migration A

`profiles.activated_at` existiert nicht; kein Gate gebaut.

```
Ziel-Projekt: https://foelowldexkcqzewvrcf.supabase.co  (DEV)
profiles.activated_at fehlt → VORHER-Lauf (roter Ausgangsbefund erwartet)
Sondenkonto: tier=impact, activated_at=(Spalte fehlt), Session steht.

── Fremddaten (muessen nach dem Change 0 sein) ──────────────────
  profiles                 38 von 38
  profiles_public          37 von 37
  posts                    12 von 12
  events                   9 von 9
  offers                   49 von 49
  needs                    48 von 48
  matches                  0 von 164
  profile_interests        29 von 29
  profile_theme_scores     148 von 148
  profile_badges           6 von 6
  comments                 6 von 6
  partners                 0 von 0   ⚠ global leer — belegt nichts

── Eigene Daten des Kontos ─────────────────────────────────────
  profile_contacts         1 von 27
  goals                    1 von 12
  notifications            1 von 5
  compass_responses        0 von 48
  member_settings          1 von 4
  feedback                 0 von 21
  message_threads          0 von 2
  messages                 0 von 4
  contact_requests         0 von 4
  staff_roles              0 von 3

── SECURITY-DEFINER-RPCs (umgehen die RLS) ─────────────────────
  post_engagement_counts     0
  event_registration_counts  0
  recompute_my_matches       0
  admin_list_feedback        0
  list_routing_queue         0
  register_for_event         Fehler P0002 event not found
  set_event_check_in         Fehler 42501 not the host of this event

── Gegenprobe: das Schaufenster bleibt offen (ausgeloggt) ───────
  anon posts (public)      5
  anon events (public)     1
```

### Was dieser Lauf belegt

**Ein frisch angemeldetes Konto sieht heute den ganzen Club.** Zehn Flächen
liefern jede Zeile, die es gibt: 38 Profile, 37 Verzeichniseinträge, 12 Beiträge,
9 Veranstaltungen, 49 Angebote, 48 Gesuche, 148 Erfolgsradar-Werte. Genau das ist
die Lage, die AGE-495 beschreibt — nur dass hier keine Rundmail nötig war,
sondern eine Selbstregistrierung von dreißig Sekunden.

**Und es sieht die eigenen Kontaktdaten**, also im Ernstfall die E-Mail-Adresse
und Telefonnummer des Mitglieds, in dessen Konto sich jemand mit dem verteilten
Passwort angemeldet hat. Das ist codex' blockierender Befund aus Runde 1, hier
gemessen statt argumentiert.

**Sieben `SECURITY DEFINER`-RPCs sind erreichbar.** `register_for_event`
antwortet `P0002 event not found` und `set_event_check_in` antwortet
`42501 not the host of this event` — beide also **nach** ihrer eigenen Prüfung,
nicht vorher. Sie sind erreichbar, ohne dass die Sonde etwas geschrieben hat.
Nach dem Change muss dort `42501 not activated` stehen.

### Was dieser Lauf NICHT belegt

Sechs Zeilen stehen schon vorher auf 0 und taugen deshalb nicht als Nachweis
fürs neue Gate — sie sind durch **bestehende** Policies begrenzt:

| Fläche                                        | Warum vorher schon 0                                |
| --------------------------------------------- | --------------------------------------------------- |
| `matches` 0 von 164                           | `matches_select_participant` — nur eigene Paarungen |
| `compass_responses` 0 von 48                  | own-profile, das Konto hat keine                    |
| `feedback` 0 von 21                           | own-profile                                         |
| `message_threads` 0 von 2, `messages` 0 von 4 | Teilnehmer-Policies                                 |
| `contact_requests` 0 von 4                    | Teilnehmer-Policies                                 |
| `staff_roles` 0 von 3                         | own-row                                             |
| `partners` 0 von 0                            | Tabelle ist global leer                             |

Für diese Flächen ist der Nachher-Lauf **kein** Beleg. Sie werden im pgTAP mit
Fixtures belegt, die Zeilen für das Sondenkonto anlegen (Block 3).

Ebenso: `admin_list_feedback` und `list_routing_queue` liefern mit einem
Nicht-Staff-Konto in beiden Zuständen leer. Belegt werden sie in Task 3.7 mit
einer Staff-Fixture.

---

## pgTAP — rot vor Migration B, grün danach

Der Gate-Block (Abschnitt 13/14 in `rls_test.sql`) wurde **vor** Migration B
geschrieben und gegen den Stand mit nur Migration A ausgeführt:

```
/…/rls_test.sql (Wstat: 0 Tests: 112 Failed: 28)
  Failed tests:  68-76, 78-82, 84-89, 93-100
```

Fünf Assertions waren im ersten Entwurf **grün, ohne etwas zu prüfen** — die
Tabellen `needs`, `profile_theme_scores`, `compass_responses` und
`routing_queue` waren in den Fixtures leer, und `set_event_check_in` lehnte
schon vorher ab, nur mit anderer Begründung („not the host"). Alle fünf sind
korrigiert: Fixtures ergänzt, und die RPC-Assertions prüfen jetzt auf die
Meldung `not activated` statt auf ein beliebiges `DENIED`. Die Istwerte wurden
vorher gemessen (`post_engagement_counts` → 2, `event_registration_counts` → 2),
statt sie zu vermuten.

Nach den Migrationen B und C:

```
rls_test.sql ............... ok   (131)
grants_test.sql ............ ok   (  5)
directory_search_test.sql .. ok   ( 15)
All tests successful.  Files=3, Tests=151   Result: PASS
```

`directory_search_test.sql` fiel nach Migration B zunächst mit 8 von 15 durch —
seine Fixtures entstehen nach dem Backfill und sind unbestätigt, und
`search_directory` ist `SECURITY INVOKER`. Das Gate arbeitete also korrekt; der
Test hat nachgezogen.

---

## Nachher

_Wird nach Migration B eingetragen (Task 8.1)._
