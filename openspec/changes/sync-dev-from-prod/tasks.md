## 1. Messen, bevor gebaut wird

Diese Gruppe schreibt keinen Produktionscode und ist **blockierend**: sie
entscheidet, ob der Entwurf überhaupt trägt. Beide Prüfer haben angemerkt, dass
`design.md` durchgehend so geschrieben ist, als sei das Ergebnis schon bekannt.
Fällt 1.2 oder 1.7 aus, wird der Entwurf geändert, nicht die Messung.

- [ ] 1.1 Auflösen, worauf `SUPABASE_DB_URL_PROD` und `SUPABASE_DB_URL_DEV`
      zeigen: Host, Port, Benutzername. Festhalten, ob Pooler-Form
      (`postgres.<ref>`, Port 6543) oder direkte Verbindung
- [ ] 1.2 `pg_dump --schema-only --table=public.profiles` gegen **PROD** — der
      billigste Vollbeweis, dass `pg_dump` diese Verbindung trägt. Rein lesend.
      Scheitert es, ist `supabase db dump` der Ersatz, und alle folgenden
      Aufgaben nennen dieses Werkzeug
- [ ] 1.3 Serverversion beider Projekte lesen und gegen `pg_dump 18.4` stellen
- [ ] 1.4 **Vollständiges Trigger-Inventar** auf `public` und `auth` — je
      Trigger entscheiden, ob er beim Restore feuern darf. Gemessen am
      2026-08-20 sind es **13 nicht-interne auf `public`**;
      `contact_requests_email_webhook` ist der Ernstfall, weil er Post
      verschicken kann. Ergebnis ist eine Liste, keine Zahl
- [ ] 1.5 Für jeden Trigger, der nicht feuern darf: prüfen, ob er mit den
      vorhandenen Rechten stillgelegt werden kann. **Geht das nicht, fällt
      Decision 2** — dann ist der `pg_restore`-Weg zu verwerfen, nicht eine
      Ausnahme zu bauen
- [ ] 1.6 **Auth-Umfang messen:** welche `auth`-Tabellen tragen Zeilen und
      welche braucht ein anmeldefähiges Konto. `auth.identities` trägt 72 —
      `auth.users` allein ist kein Restore. Ergebnis aufschreiben
- [ ] 1.7 Prüfen, ob `pg_dump` das `auth`-Schema mit den gegebenen Rechten
      ausliest und die Rolle `truncate`/`insert` auf `auth.users` darf
- [ ] 1.8 Fremdschlüsselrichtung `profiles → auth.users` **belegen**, statt sie
      anzunehmen — `truncate public.profiles cascade` darf `auth.users` nicht
      berühren, und der ganze Ablauf hängt daran
- [ ] 1.9 Schemagleichheit **normalisiert** vergleichen, nicht an der
      Migrationszahl: „70 auf beiden Seiten" beweist nichts und veraltet sofort.
      Vollständige Versionslisten plus `db-drift-scan` gegen beide
- [ ] 1.10 **Donald fragen**, ob die 21 Feedback-Zeilen auf DEV den Ersatz
      überleben sollen — sie stehen sonst nicht im deklarierten DEV-Bestand
- [ ] 1.11 **Donald vorlegen** (REVIEWS.md §8/§9): Anonymisierung im ersten Bau
      oder Zugänge entschärfen; und ob Produktions-Passwort-Hashes nach DEV
      dürfen. Bis zur Antwort wird der Nachbereitungsschritt so gebaut, dass
      eine Neutralisierung dort ansetzen kann
- [ ] 1.12 Manifest des Vorher-Stands beider Seiten: je Tabelle Zeilenzahl und
      Zeilenhash, je Objekt Größe und Prüfsumme

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

Reihenfolge nach `design.md` §Decisions 2 — **gültig nur, wenn 1.4/1.5 sie
tragen**. Schritt 4.5 ist der Kunstgriff: die vom Signup-Trigger erzeugten
Zeilen werden weggeräumt, nachdem er gefeuert hat.

- [ ] 4.1 Die in 1.5 bestimmten Trigger stilllegen; Test, dass der Zustand
      danach wiederhergestellt ist — ein versehentlich abgeschaltet gebliebener
      Signup-Trigger fällt erst Tage später auf
- [ ] 4.2 `auth`-Bestand in DEV leeren (kaskadiert in `public.profiles`)
- [ ] 4.3 `public`-Tabellen leeren, Buckets leeren
- [ ] 4.4 `auth`-Umfang zurückspielen — Konten **und Identitäten**
- [ ] 4.5 `truncate public.profiles cascade` — räumt die vom Signup-Trigger
      erzeugten Zeilen weg (sie tragen `basic`, nicht `discover`: die aktuelle
      Definition steht in `20260715150000`, nicht in der Juni-Fassung). Test,
      dass `auth.users` dabei unberührt bleibt
- [ ] 4.6 `public` zurückspielen
- [ ] 4.7 Test: der Restore erzeugt **keine** zusätzlichen Beiträge aus
      `trg_event_feed_post`, keine Benachrichtigungen aus
      `contact_requests_lifecycle` und **keine Post** aus
      `contact_requests_email_webhook`
- [ ] 4.8 Objekte in die vier Buckets schreiben, **`upsert: false`**
- [ ] 4.9 **Deklaration** des DEV-eigenen Bestands an einer Stelle anlegen:
      Demo-Zugänge samt ihrer Profilangaben, `staff_roles` samt
      `matching_manager`, und — je nach 1.10 — die Feedback-Zeilen
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

## 5. Einmal echt laufen lassen

- [ ] 5.1 Vollständiger Restore-Probelauf gegen den **lokalen** Stack, bevor DEV
      berührt wird — dort ist ein Fehlschlag folgenlos
- [ ] 5.2 `pnpm sync:dev` in `package.json` eintragen und einmal gegen DEV
      ausführen
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
