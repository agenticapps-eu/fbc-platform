# Inventar — was das Gate berührt (AGE-495)

Angelegt in Revision 3, weil das Review zu Recht bemängelte, dass „46 Policies"
und „vier RPCs" behauptet und nicht belegt waren. Migration Bs Lesbarkeit war
die Begründung für den Zwei-Migrationen-Schnitt; sie hängt an einer Liste, die
der Reviewer sehen kann.

**Gemessen 2026-08-05 gegen DEV (`foelowldexkcqzewvrcf`), rein lesend.**
Reproduzierbar mit:

```sql
select schemaname, tablename, policyname, array_to_string(roles,',') , cmd
  from pg_policies where schemaname in ('public','storage')
 order by 1,2,3;                                    -- erwartet: 52 Zeilen

select p.proname, pg_get_function_identity_arguments(p.oid),
       has_function_privilege('authenticated', p.oid, 'execute')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef order by 1;   -- erwartet: 22 Zeilen
```

---

## A · Policies — 52 gesamt

### A1 · Gegatet: 46

**Lesend, Fremddaten (17)**

`profiles_select_self_or_discover` · `interests_select` · `theme_scores_select` ·
`profile_badges_select` · `contacts_select_self_or_released` · `offers_select` ·
`needs_select` · `matches_select_participant` · `cr_select_participants` ·
`threads_select` · `messages_select` · `posts_select_by_visibility` ·
`comments_select_visible` · `events_select_by_visibility` ·
`regs_select_self_or_host` · `partners_read_authenticated` ·
`feedback_admin_read`

**Schreibend (12)**

`cr_insert_self` · `cr_update_recipient` · `threads_insert` · `messages_insert` ·
`posts_write_own` · `comments_insert_own` · `likes_write_own` ·
`regs_write_own` · `events_write_host` · `routing_queue_update_staff` ·
`offers_write_own` · `needs_write_own`

**Eigene Daten des angemeldeten Kontos (16)** — Revision 2, codex' Befund. Der
Angreifer meldet sich _als das Mitglied_ an; dies sind die Daten des Bestohlenen.

`profiles_update_own` · `profile_contacts_insert_own` ·
`profile_contacts_update_own` · `goals_own` · `notifications_own` ·
`feedback_own` · `member_settings_own` · `compass_responses_select_own` ·
`compass_responses_write_own` · `interests_write_own` ·
`theme_scores_write_own` · `staff_roles_select_self` ·
`platform_settings_update_admin` · `avatars_insert_own` · `avatars_update_own` ·
`avatars_delete_own`

_(`profile_contacts_select_own` ist als `contacts_select_self_or_released` oben
in der Lese-Liste geführt — dieselbe Policy, nicht doppelt gezählt.)_

**Staff (1)** — `routing_queue_select_staff`

17 + 12 + 16 + 1 = **46**

### A2 · Bewusst nicht gegatet: 6

| Policy                      | Rollen              | Grund                                         |
| --------------------------- | ------------------- | --------------------------------------------- |
| `posts_select_public_anon`  | anon                | Schaufenster für ausgeloggte Besucher         |
| `events_select_public_anon` | anon                | dito                                          |
| `badges_read_all`           | anon, authenticated | Referenzdaten ohne Personenbezug              |
| `tiers_read_all`            | anon, authenticated | Referenzdaten (Stufen, Preise)                |
| `partner_cat_read_all`      | anon, authenticated | Referenzdaten (Kategorienamen)                |
| `platform_settings_select`  | authenticated       | ein plattformweiter Flag, kein Mitgliedsdatum |

46 + 6 = **52** ✓

### A3 · Die Asymmetrie, die daraus folgt

Ein **ausgeloggter** Besucher sieht öffentliche Beiträge und Events. Ein
**eingeloggtes, nicht aktiviertes** Konto sieht sie nicht — die drei anon-Policies
gelten für die Rolle `anon`, und wer eine Session hat, fragt als
`authenticated`.

**Ausloggen gewährt damit mehr Zugriff als Eingeloggtsein.** Das ist eine
Entscheidung, kein Versehen (opencode, Revision 2): Das Schaufenster soll offen
bleiben, und der Aktivierungsbildschirm soll _keinen_ Inhalt zeigen, sonst ist
er keine Wand. Der Bildschirm nennt den Weg nach draußen ausdrücklich
(„Abmelden und weiterstöbern"), damit die Asymmetrie nicht als Fehler gelesen
wird.

---

## B · SECURITY-DEFINER-Funktionen — 22 gesamt

Revision 2 behauptete „vier RPCs". **Das war zu wenig gezählt.** Sieben
Funktionen sind für `authenticated` ausführbar _und_ berühren Mitgliederdaten
an der RLS vorbei.

### B1 · Gegatet: 7

| Funktion                            | Warum sie das Gate braucht                               |
| ----------------------------------- | -------------------------------------------------------- |
| `post_engagement_counts(uuid[])`    | spiegelt `posts_select_by_visibility` selbst             |
| `event_registration_counts(uuid[])` | spiegelt `events_select_by_visibility` selbst            |
| `register_for_event(uuid)`          | schreibt an `regs_write_own` vorbei                      |
| `set_event_check_in(uuid, boolean)` | schreibt an `regs_write_own` vorbei                      |
| `recompute_my_matches()`            | erzeugt Matches (Mitgliederdaten) für `auth.uid()`       |
| `admin_list_feedback()`             | joint `feedback`+`profiles` an der `profiles`-RLS vorbei |
| `list_routing_queue()`              | liest paarübergreifende Mitgliederdaten                  |

Die letzten drei fehlten in Revision 2. `admin_list_feedback` und
`list_routing_queue` sind zusätzlich durch `is_admin()` bzw.
`is_matching_manager()` gedeckt — das schützt gegen _fremde_ Staff-Rollen, nicht
gegen einen Angreifer im Konto eines echten Staff-Mitglieds. Genau dafür ist das
Gate da.

### B2 · Ohne Gate, mit Begründung: 15 bestehende + 2 neue

| Funktion                                                                                                                                                 | Grund                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `is_activated()`                                                                                                                                         | **ist** das Gate                                                                                                           |
| `my_activation_state()`                                                                                                                                  | trägt den Aktivierungsbildschirm; gibt nur ein Boolean + Anzeigename                                                       |
| `current_tier_rank()`, `has_level(int)`, `is_admin()`, `is_matching_manager()`                                                                           | geben nur den eigenen Stand zurück                                                                                         |
| `is_contact_open()`                                                                                                                                      | plattformweiter Flag                                                                                                       |
| `is_contactable(uuid)`, `is_new_member(uuid)`                                                                                                            | je ein Boolean über **einen** Fremdschlüssel, den der Aufrufer bereits kennen muss. Kein Gate, aber als Restfläche benannt |
| `recompute_potential_score(uuid)`                                                                                                                        | wehrt fremde IDs selbst ab (`v_caller <> p_profile_id`, `20260804200100:57`)                                               |
| `apply_upgrade(uuid, text)`, `generate_matches_for(uuid)`                                                                                                | kein EXECUTE für `authenticated` — nicht erreichbar                                                                        |
| `handle_new_user()`, `handle_contact_request_change()`, `set_contact_request_routing()`, `platform_settings_touch()`, `notify_contact_request_webhook()` | Trigger-Funktionen ohne API-Rollen-EXECUTE                                                                                 |

**Rechnung:** 22 gemessene `SECURITY DEFINER`-Funktionen − 7 gegatete (B1) = **15**
bestehende ohne Gate. Dazu die **2 neuen** dieses Changes (`is_activated()`,
`my_activation_state()`) = 17 nach der Umsetzung.

_Korrigiert in Revision 4 (codex): Die Liste nannte zuvor zusätzlich
`set_updated_at()`, `set_profile_completion()` und `fbc_profile_search_doc(...)`
und kam damit auf 20 Namen unter einer Überschrift, die 15 sagte. Die drei sind
in der Messung gar nicht als `SECURITY DEFINER` aufgetaucht — sie gehören nicht
in dieses Inventar._

`search_directory(...)` ist **SECURITY INVOKER** und folgt der RLS — sie
schließt sich mit `profiles` von selbst. Deshalb steht sie hier nicht.

---

## C · Was das Gate konstruktionsbedingt nicht erreicht

**Profilbilder.** Der `avatars`-Bucket ist **public** angelegt
(`20260613081627:18-20`) und trägt bewusst **keine** SELECT-Policy: Objekte
rendern über ihre öffentliche URL. Die drei `storage.objects`-Policies regeln
ausschließlich Schreibzugriffe und sind gegatet (A1).

Ein Bild ist damit für jeden abrufbar, der seine URL kennt — auch ausgeloggt.
Was davor steht, ist `profiles.avatar_url`, und diese Spalte **ist** gegatet:
Ein nicht aktiviertes Konto erfährt die URLs nicht. Der Pfad
(`{uid}/{zeitstempel}.webp`) ist ohne den Zeitstempel nicht zu erraten.

**Aufzählbar ist der Bucket nicht — gemessen, nicht angenommen.** opencode
wandte in Runde 3 ein, ein `public`-Bucket lasse sich über die Storage-API
auflisten, sodass die URLs gar nicht aus der gegateten Spalte kommen müssten.
Gegen DEV geprüft, mit dem Anon-Key:

```
anon list('avatars'):   0 Einträge: []
anon list rekursiv:     0 Einträge
```

Der Grund: `storage.objects` trägt RLS, und es gibt **keine** SELECT-Policy —
Auflisten läuft über die Tabelle, nicht über den öffentlichen Objektpfad, und
deny-by-default filtert alles still weg. „Public" wirkt nur auf den direkten
Objektabruf. Der Einwand trifft also nicht zu; die Restfläche bleibt der Abruf
einer **bekannten** URL.

Das ist eine vorbestehende Eigenschaft des Buckets, keine Regression dieses
Changes, und sie wird hier benannt statt in der Policy-Rechnung versteckt. Den
Bucket privat zu stellen wäre ein eigener Change mit Folgen für jede
Bild-URL im Frontend.

**Supabase Auth.** `/auth/v1/*` liegt neben der Datenbank; keine Policy
erreicht es. Was daraus folgt, steht in `design.md`, Entscheidung 7 und 12.
