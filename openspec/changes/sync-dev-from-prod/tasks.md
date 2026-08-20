## 1. Messen, bevor gebaut wird

Diese Gruppe schreibt keinen Produktionscode und ist **blockierend**: sie
entscheidet, ob der Entwurf überhaupt trägt. Beide Prüfer haben angemerkt, dass
`design.md` durchgehend so geschrieben ist, als sei das Ergebnis schon bekannt.
Fällt 1.2 oder 1.7 aus, wird der Entwurf geändert, nicht die Messung.

**Gemessen am 2026-08-20 — beide Gates halten.** Ergebnisse, Manifeste und die
drei Folgen für Gruppe 4 stehen in `messungen/gruppe-1-2026-08-20.md`.

- [x] 1.1 Auflösen, worauf `SUPABASE_DB_URL_PROD` und `SUPABASE_DB_URL_DEV`
      zeigen: Host, Port, Benutzername. Festhalten, ob Pooler-Form
      (`postgres.<ref>`, Port 6543) oder direkte Verbindung —
      **beides Pooler in Session-Form, Port 5432.** Die Hosts sind NICHT gleich
      (`aws-0` vs. `aws-1`), und jede URL liegt nur in ihrer eigenen
      Infisical-Umgebung: ein `infisical run --env=…` liefert nie beide
- [x] 1.2 `pg_dump --schema-only --table=public.profiles` gegen **PROD** — der
      billigste Vollbeweis, dass `pg_dump` diese Verbindung trägt. Rein lesend.
      Scheitert es, ist `supabase db dump` der Ersatz, und alle folgenden
      Aufgaben nennen dieses Werkzeug — **Exit 0, 405 Zeilen, leeres stderr**
- [x] 1.3 Serverversion beider Projekte lesen und gegen `pg_dump 18.4` stellen
      — **beide 17.6, Client nur 18.4.** Zurückspielen in einen älteren Server
      ist von PostgreSQL nicht zugesagt; die Zusage fällt in 5.1
- [x] 1.4 **Vollständiges Trigger-Inventar** auf `public` und `auth` — je
      Trigger entscheiden, ob er beim Restore feuern darf. Gemessen am
      2026-08-20 sind es **13 nicht-interne auf `public`**;
      `contact_requests_email_webhook` — **die Zusage muss gegen DEV fallen,
      nicht lokal** (siehe 5.1) ist der Ernstfall, weil er Post
      verschicken kann. Ergebnis ist eine Liste, keine Zahl — **es sind 18,
      nicht 13**: 13 `public`, 1 `auth`, **4 `storage`**, alle `tgenabled='O'`.
      Zwei `storage`-Trigger stehen dem Leeren der Buckets (4.3) im Weg
- [x] 1.5 Für jeden Trigger, der nicht feuern darf: prüfen, ob er mit den
      vorhandenen Rechten stillgelegt werden kann. **Geht das nicht, fällt
      Decision 2** — dann ist der `pg_restore`-Weg zu verwerfen, nicht eine
      Ausnahme zu bauen. **Ergebnis: `ALTER` scheitert an `auth.users` und
      beiden `storage`-Tabellen (fremde Eigentümer). `set
      session_replication_role = replica` ist auf beiden Projekten erlaubt und
      legt alle 18 still — mit Gegenprobe lokal belegt.** Decision 2 hält, ihr
      Mechanismus ist ein anderer
- [x] 1.6 **Auth-Umfang messen:** welche `auth`-Tabellen tragen Zeilen und
      welche braucht ein anmeldefähiges Konto. `auth.identities` trägt 72 —
      `auth.users` allein ist kein Restore. Ergebnis aufschreiben —
      **Umfang: `auth.users` + `auth.identities`, sonst nichts.**
      `sessions`/`refresh_tokens` sind laufende Anmeldungen echter Personen,
      `auth.schema_migrations` ist GoTrues eigener DEV-Versionsstand
- [x] 1.7 Prüfen, ob `pg_dump` das `auth`-Schema mit den gegebenen Rechten
      ausliest und die Rolle `truncate`/`insert` auf `auth.users` darf —
      **Exit 0, 23 `CREATE TABLE auth.*`; alle fünf Rechte auf `auth.users`
      und `auth.identities` vorhanden**
- [x] 1.8 Fremdschlüsselrichtung `profiles → auth.users` **belegen**, statt sie
      anzunehmen — `truncate public.profiles cascade` darf `auth.users` nicht
      berühren, und der ganze Ablauf hängt daran — **belegt: `profiles` ist die
      referenzierende Seite; 31 Fremdschlüssel zeigen auf `profiles`, 9 auf
      `auth.users`**
- [x] 1.9 Schemagleichheit **normalisiert** vergleichen, nicht an der
      Migrationszahl: „70 auf beiden Seiten" beweist nichts und veraltet sofort.
      Vollständige Versionslisten plus `db-drift-scan` gegen beide —
      **Listen zeichengleich (je 70); Scan beidseitig „54 Funktionen, 13
      Trigger, 34 Tabellen, 1 View, 54 Policies, keine Abweichung".** Lokal
      braucht der Scan `NODE_EXTRA_CA_CERTS`. Und:
      `contact_requests_email_webhook` — **die Zusage muss gegen DEV fallen,
      nicht lokal** (siehe 5.1) steht bewusst in keiner Migration —
      der Vollersatz muss danach prüfen, dass das Paar noch steht
- [x] 1.10 ~~Donald fragen, ob die 21 Feedback-Zeilen den Ersatz überleben~~ —
      **entschieden 2026-08-20: nein, mitersetzen.** Testeingaben, keine Arbeit;
      sie stehen NICHT im deklarierten DEV-Bestand
- [x] 1.11 ~~Donald vorlegen: Anonymisierung~~ — **entschieden 2026-08-20:
      keine Anonymisierung** (Decision 6). Stattdessen Zugänge entschärfen und
      Hashes neutralisieren, siehe Gruppe 2a
- [x] 1.12 Manifest des Vorher-Stands beider Seiten: je Tabelle Zeilenzahl und
      Zeilenhash, je Objekt Größe und Prüfsumme — **liegt als
      `messungen/manifest-{prod,dev}-2026-08-20.json`.** PROD 713 Zeilen /
      125 Objekte, DEV 821 / 18. Die Bucket-Liste kommt aus `storage.buckets`,
      nicht aus den Objekten, sonst verschwände ein leer gewordener Bucket
      still aus dem Manifest

## 2. Der Wächter, vor allem anderen

Erst die Absicherung, dann das Werkzeug. Ein Spiegel, dessen Zielprüfung
nachgereicht wird, hat ein Zeitfenster, in dem ein Tippfehler PROD leert.

- [ ] 2.1 RED: ein Lauf mit der **PROD**-Kennung im Ziel bricht ab, bevor er
      schreibt
- [ ] 2.2 RED: eine **vertauschte Quelle** — ein anderes Projekt als PROD, auch
      DEV selbst — bricht ab, bevor er liest. Der erste Entwurf prüfte nur das
      Ziel; eine falsche Quelle hätte alle Tests bestanden
- [ ] 2.3 RED: **gemischte Zugangsdaten** brechen ab — DEV-Datenbank-URL neben
      PROD-Storage-URL oder PROD-Service-Key. Der Datenbankwächter allein
      schützt weder Ablage noch GoTrue-Admin-API, und die Spaltung dieser Werte
      ist im Projekt dokumentiert
- [ ] 2.4 GREEN: Kennung je Wertepaar aus dem Benutzernamen (`postgres.<ref>`)
      gegen feste Allowlists — **nicht** gegen den Host, der ist regionsweit
      gleich
- [ ] 2.5 Test: unbekannte, gleiche oder nicht auflösbare Kennungen brechen ab
- [ ] 2.6 Test: die Richtung ist fest verdrahtet — kein Schalter macht PROD zum
      Ziel

## 2a. Die Zugänge entschärfen — Voraussetzung, nicht Nacharbeit

Aus Decision 6. Diese Gruppe SHALL abgeschlossen sein, **bevor** der erste Lauf
echte Personendaten nach DEV bringt: solange `Test1234!` im öffentlichen
Repository steht, gibt jeder Leser sich Zugriff auf das Verzeichnis.

- [ ] 2a.1 Neue Passwörter für die drei `@fbcdemo.com`-Zugänge setzen
- [ ] 2a.2 Sie aus `docs/demo-zugang.md` entfernen; das Dokument nennt künftig
      den Ablageort (Infisical), nicht den Wert
- [ ] 2a.3 Prüfen, ob die alten Werte anderswo im Repository stehen — ein
      entfernter Wert, der in einem zweiten Dokument weiterlebt, ist nicht
      entfernt
- [ ] 2a.4 Die neuen Werte gehören in den deklarierten DEV-Bestand (4.9), sonst
      nimmt sie der nächste Vollersatz mit

## 3. Auszug, Manifest und Ablage

- [ ] 3.1 Ablageort ausserhalb des Arbeitsbaums: Verzeichnis `0700`, Dateien
      `0600`, Auflösung über `realpath` gegen den Arbeitsbaum geprüft
- [ ] 3.2 RED: ein Ablageort **innerhalb** des Arbeitsbaums wird abgelehnt —
      auch wenn ein Symlink hineinzeigt
- [ ] 3.3 Auszug aus PROD: `public` und der in 1.6 bestimmte `auth`-Umfang,
      getrennt, weil Gruppe 4 sie in verschiedenen Schritten zurückspielt
- [ ] 3.4 **Manifest** erzeugen: je Tabelle Zeilenzahl und Zeilenhash, je Objekt
      Größe und Prüfsumme. Ohne Manifest gibt es keine belastbare Abnahme
- [ ] 3.5 Test: bricht das Erzeugen ab, ist gegen DEV **kein** schreibender
      Befehl abgesetzt worden
- [ ] 3.6 Objekte der vier Buckets holen — **rekursiv und über alle Seiten**.
      Die heutigen 125 Objekte dürfen nicht als Beleg dienen, dass eine
      Seitengrenze nie erreicht wird
- [ ] 3.7 Test: ein Objektname mit Pfadanteilen nach oben kann den Ablageort
      nicht verlassen
- [ ] 3.8 Auszüge tragen eindeutige Namen und überschreiben einander nicht
- [ ] 3.9 Test: die **Differenz** von `git status --porcelain --ignored` vor und
      nach dem Lauf ist leer. Nicht die Ausgabe selbst — sie führt schon vorher
      17 Pfade

## 4. Ersetzen

Reihenfolge nach `design.md` §Decisions 2. **1.4/1.5 tragen sie — aber mit
einem anderen Mechanismus**, und das ändert 4.1, 4.3 und 4.5.

- [ ] 4.1 `set session_replication_role = replica` für die Sitzung — **nicht**
      13 einzelne `ALTER TABLE … DISABLE TRIGGER`: an `auth.users` und beiden
      `storage`-Tabellen fehlen dafür die Eigentümerrechte (1.5). Test, dass
      der Schalter gesetzt war, solange geschrieben wurde
- [ ] 4.1a Test: nach dem Lauf ist `session_replication_role` wieder `origin`
      und alle 18 Trigger tragen weiter `tgenabled='O'`
- [ ] 4.1b **Fremdschlüssel-Integrität eigens messen.** Im replica-Modus
      schweigen auch die internen RI-Trigger, Fremdschlüssel werden während des
      Laufs also nicht geprüft — was sich vorher von selbst ergab, ist jetzt
      eine Zusage, die jemand aussprechen muss
- [ ] 4.2 `auth`-Bestand in DEV leeren (kaskadiert in `public.profiles`)
- [ ] 4.3 `public`-Tabellen leeren, Buckets leeren — **`protect_objects_delete`
      und `protect_buckets_delete` stehen dem im Weg** (1.4); im replica-Modus
      schweigen sie, ausserhalb nicht
- [ ] 4.4 `auth`-Umfang zurückspielen — Konten **und Identitäten**
- [ ] 4.5 **Zusage statt Arbeitsschritt.** Der Kunstgriff entfällt: im
      replica-Modus erzeugt `on_auth_user_created` nichts. Zu belegen ist
      genau das — nach 4.4 trägt `public.profiles` **keine** vom Trigger
      erzeugte Zeile (er setzte `basic`, nicht `discover`; geltende Definition
      `20260715150000`). Wird der Weg doch über `truncate … cascade` gegangen,
      zusätzlich belegen, dass `auth.users` unberührt bleibt (1.8)
- [ ] 4.6 `public` zurückspielen
- [ ] 4.7 Test: der Restore erzeugt **keine** zusätzlichen Beiträge aus
      `trg_event_feed_post`, keine Benachrichtigungen aus
      `contact_requests_lifecycle` und **keine Post** aus
      `contact_requests_email_webhook` — **die Zusage muss gegen DEV fallen,
      nicht lokal** (siehe 5.1)
- [ ] 4.8 Objekte in die vier Buckets schreiben, **`upsert: false`**
- [ ] 4.8a Test: `notify_contact_request_webhook()` und
      `contact_requests_email_webhook` stehen nach dem Lauf noch. Sie stehen in
      keiner Migration (1.9) — still verloren sähe aus wie ein sauberer Lauf
- [ ] 4.9 **Deklaration** des DEV-eigenen Bestands an einer Stelle anlegen:
      Demo-Zugänge samt ihrer Profilangaben und der neuen Passwörter,
      `staff_roles` samt `matching_manager`. **Ohne die Feedback-Zeilen** —
      entschieden am 2026-08-20, sie werden mitersetzt
- [ ] 4.10 Nachbereitung: den deklarierten Bestand **herstellen**. Drei Logins
      allein genügen nicht — ihre Profilzeilen entstehen leer und `basic`, die
      Demo-Welt (Jonas, Carla, Eleonora samt Stufen und Beziehungen) wäre weg.
      Entweder vollständig herstellen oder ausdrücklich festhalten, dass DEV
      danach nicht mehr vorführbar ist, und `docs/demo-zugang.md` ändern
- [ ] 4.11 `admin_roles.sql` prüft sich nicht selbst: es braucht externe
      Adressen, kann still no-op laufen und legt `matching_manager` nicht an.
      Der Rollensatz wird deklariert und danach verglichen
- [ ] 4.12 Test: die Demo-Zugänge sind **anmeldefähig**, nicht nur vorhanden —
      `last_sign_in_at`, nicht das Vorhandensein einer Zeile
- [ ] 4.13 **Produktions-Passwort-Hashes neutralisieren** (Decision 6). Test:
      ein übertragenes Mitgliedskonto lässt sich auf DEV **nicht** mit seinem
      PROD-Passwort anmelden. Die Zusage ist negativ formuliert, weil ein
      positiver Test hier nichts belegen könnte

## 5. Einmal echt laufen lassen

- [ ] 5.1 Vollständiger Restore-Probelauf gegen den **lokalen** Stack, bevor DEV
      berührt wird — dort ist ein Fehlschlag folgenlos. Hier fällt auch die
      offene Zusage aus 1.3: ein mit `pg_dump 18.4` erzeugter Auszug muss in
      einen 17.6-Server zurückgehen. **Blinder Fleck:** lokal fehlt genau
      `contact_requests_email_webhook` (17 statt 18 Trigger), weil er in keiner
      Migration steht — über „keine Post" sagt ein grüner lokaler Lauf nichts
- [ ] 5.2 `pnpm sync:dev` in `package.json` eintragen und einmal gegen DEV
      ausführen — **die beiden DB-URLs liegen in getrennten
      Infisical-Umgebungen** (1.1), ein einzelner `infisical run --env=…`
      liefert nie beide
- [ ] 5.3 Abnahme als **Manifestvergleich mit benannten Abweichungen**: DEV
      trägt den Bestand des Auszugs **plus** den deklarierten DEV-Bestand.
      Nicht „gleiche Zeilenzahlen wie PROD" — das ist mit 4.10 unvereinbar und
      damit unerfüllbar
- [ ] 5.4 Idempotenz **aus demselben gespeicherten Auszug** zweimal einspielen
      und Zeilenhashes plus Objektprüfsummen vergleichen. Zwei Läufe gegen die
      laufende Quelle belegen nichts — sie können verschiedene Stände gelesen
      haben
- [ ] 5.5 Sichtprobe in der laufenden lokalen Oberfläche: fünf echte Profile mit
      Bild, Anschrift und Netzwerken. Grüne Tests haben hier schon einmal ein
      sichtbar falsches Ergebnis durchgewunken
- [ ] 5.6 **Rückweg gehen:** den Auszug gegen ein leeres, frisch migriertes
      Schema einspielen und belegen, dass daraus der Bestand des Manifests
      entsteht und die Konten anmeldefähig sind. Ohne diesen Lauf darf der
      Auszug nicht „Sicherung" heißen

## 6. Abschluss

- [ ] 6.1 `pnpm test`, `pnpm typecheck`, `pnpm lint` grün
- [ ] 6.2 `docs/supabase-environments.md` um den Spiegel ergänzen; in
      `docs/prod-neuaufbau-plan.md` Schritt 1 auf das entstandene Werkzeug
      umstellen **und Schritt 0 schließen** — die Frage „welches Projekt ist
      PROD" ist am 2026-08-20 entschieden, das Dokument führt sie noch offen
- [ ] 6.3 Diff-Review durch zwei Prüfer anderer Hersteller
- [ ] 6.4 `openspec archive` — erst wenn 5.3, 5.4 und 5.6 gemessen sind, nicht
      wenn der Code existiert
- [ ] 6.5 AGE-576 in Linear auf Done — vorher `get_issue` lesen
