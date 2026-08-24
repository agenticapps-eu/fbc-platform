## Why

Die Admin-Mitgliederliste (AGE-566) kennt zwei Handlungen — Zugangslink schicken
und direkt aktivieren. Beide führen in dieselbe Richtung: hinein. Es gibt keinen
Weg, ein Mitglied wieder herauszunehmen, und keinen Ort, an dem Stufe und
Zahlung eines Mitglieds nebeneinander stehen.

Das ist jetzt ein Blocker, kein Komfortmangel. Detlevs Übersicht der aktiven
Mitglieder liegt seit dem 23.08. vor: 60 Einträge, denen in PROD 71 Konten
gegenüberstehen. Der Abgleich ergibt **59 Treffer** — einer der 60 hat kein
Konto. Damit stehen **12 Konten auf keiner Liste**, und da eines davon das
eigene Admin-Konto ist, sind **11 zu deaktivieren**. Sie dürfen nach dem
Go-Live weder sichtbar sein noch sich anmelden können. Ohne dieses Werkzeug
ginge das nur von Hand in der Datenbank — und die Umschaltung des Deployments
auf PROD hängt daran.

Linear: **AGE-581**.

## What Changes

- **Ein Menü je Zeile** statt loser Knöpfe. Es trägt die bestehenden Handlungen
  und die neuen; die Zeile bleibt lesbar, wenn eine sechste dazukommt.

- **Deaktivieren** — zwei Sperren, nicht eine. `banned_until` in `auth.users`
  über eine Edge Function mit `service_role`, damit die Anmeldung schon bei
  GoTrue scheitert und gar keine Sitzung entsteht; und `disabled_at` in
  `profiles`, damit das DB-Gate greift, falls eine Sitzung noch läuft. Umkehrbar,
  beide Richtungen protokolliert.

- **Eine Rolle überlebt den Entzug des Zugangs nicht.** `is_admin()` und
  `is_matching_manager()` lesen heute nur `staff_roles` — ein deaktivierter
  Admin behielte jede Fähigkeit. Beide bekommen die Zugangsbedingung.

- **Löschen, weich** — `deleted_at` wird gesetzt, die Zeile bleibt. Gelöschte
  sind nirgends gelistet ausser im Tab „Gelöscht" und von dort wiederherstellbar.
  Ein Hard-Delete entsteht in diesem Change **nicht**.

- **Was ein entferntes Mitglied hinterlassen hat, bleibt stehen.** Beiträge und
  Kommentare bleiben lesbar; der Autor erscheint als „Ehemaliges Mitglied" ohne
  Verweis auf ein Profil, das es nicht mehr gibt. Ein Beitrag, der aus einem
  Gesprächsfaden verschwindet, in dem andere geantwortet haben, reisst ein Loch
  in fremde Beiträge.

- **Tabs statt eines Status-Auswahlfelds**: Alle · Nicht aktiviert · Deaktiviert
  · Gelöscht · Mitgliedschaft. Deaktivierte und Gelöschte erscheinen **nur**
  hinter ihrem eigenen Tab, nicht unter „Alle".

- **Der Tab „Mitgliedschaft"** zeigt je Mitglied Stufe, bezahlt-bis und
  **Zahlungsart** (neu) und lässt die letzten beiden in der Zeile ändern — die
  **Stufe bleibt hier nur lesbar**, ihr Wechsel hat einen eigenen Weg (AGE-516).
  Die Alternative wäre, Detlevs Liste sechzigmal über die Einzelansicht
  einzupflegen.

- **`payment_type` als neues Feld** in `profile_legacy`, mit den acht Werten aus
  dem Bestand: `rechnung`, `stripe`, `copecart`, `paypal`, `digistore24`,
  `ehren`, `partner`, `offen`.

## Capabilities

### New Capabilities

Keine. Der Change erweitert bestehende Fähigkeiten; eine neue Fähigkeit
aufzumachen, würde die Mitgliederverwaltung auf zwei Spec-Dateien verteilen.

### Modified Capabilities

- `admin`: Die Fläche bekommt Tabs und ein Zeilenmenü; `admin_list_members`
  bekommt zwei weitere `p_status`-Werte und die Mitgliedschaftsspalten; vier
  neue Funktionen (deaktivieren, reaktivieren, weich löschen, wiederherstellen)
  und eine Erweiterung von `admin_update_profile` um `payment_type`.
- `access-control`: Das Aktivierungs-Gate wird zum **Zugangs-Gate**. `is_activated()`
  und `is_activated_profile()` schliessen künftig auch Deaktivierte und Gelöschte
  aus; dieselbe Bedingung tritt in `profiles_select_self_or_discover` und
  `profiles_public`. Ein deaktiviertes Konto kommt zusätzlich bei GoTrue nicht
  mehr durch.
- `community-feed`: Der Autor eines entfernten Mitglieds erscheint als
  „Ehemaliges Mitglied", unterscheidbar von einem Autor, der lediglich sein
  Profil nicht öffentlich stellt.

## Impact

**Der Umfang ist gemessen, nicht geschätzt.** Eine Abfrage über den echten
Datenbankstand (nicht über das forward-only Migrationsverzeichnis, in dem
`activated_at` 86-mal vorkommt) zeigt: das Gate steht an **fünf** Stellen direkt.

| Stelle | Was geschieht |
|---|---|
| `is_activated()` | Bedingung erweitert — **~40 Policies erben sie** |
| `is_activated_profile(uuid)` | dito, Zielprofil-Seite |
| `profiles_select_self_or_discover` | einzige Policy mit direktem Prädikat |
| `profiles_public` (`security_invoker=off`) | View mit direktem Prädikat |
| `admin_list_members`, `admin_find_profile` | bleiben absichtlich durchlässig — sie sind die Fläche, auf der man Deaktivierte sieht |

Zusätzlich `event_attendees()` und `my_activation_state()`, die das Prädikat
ebenfalls direkt tragen: die erste soll entfernte Mitglieder nicht mehr
auflisten, die zweite muss den Sperrzustand melden können, damit die Oberfläche
einen Sperrhinweis statt eines Aktivierungsbildschirms zeigt.

**Neu:** `profiles.disabled_at`, `profiles.deleted_at`,
`profile_legacy.payment_type`; eine Edge Function `admin-set-member-ban`; vier
`SECURITY DEFINER`-Funktionen; Grants ausdrücklich (AGE-312), Golden-Snapshot in
`grants_test.sql` mitgeführt (AGE-455).

**Nicht in diesem Change:** Hard-Delete und DSGVO-Löschauskunft (bleibt
`add-dsgvo-compliance`), Massenauswahl und Rundmail (bleibt AGE-304), das
Downgrade zwischen Stufen (bleibt AGE-516).

**Datenpflege ist Folge, nicht Teil:** die 59 Zuordnungen aus Detlevs Liste, die
11 Deaktivierungen und die 10 Adresskorrekturen laufen nach dem Merge über die
gebaute Fläche und ein Skript, nicht über eine Migration. Die Zuordnungstabelle
liegt als Beleg im Repo (`docs/age-581-mitgliederabgleich.md`), nicht in einem
Ablageordner ausserhalb des Arbeitsbaums — ein Beleg, den der nächste Leser
nicht öffnen kann, belegt nichts.

**Ausdrücklich nicht behandelt:** was ein entferntes Mitglied ausserhalb von Feed
und Veranstaltungsteilnahme hinterlässt — Nachrichten, Kontaktanfragen, Treffer,
Angebote, Gesuche. Diese Flächen erben das Gate über `is_activated()` und zeigen
das Mitglied damit nicht mehr an; wie sie mit den **Spuren** umgehen (ein
Gesprächsfaden mit einem entfernten Gegenüber), ist eine eigene Frage und eine
Nachfolge-Notiz. Sie hier stillschweigend offen zu lassen, wäre der Unterschied
zwischen „nicht entschieden" und „nicht bemerkt".
