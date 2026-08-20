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

**Gebaut am 2026-08-20:** `scripts/sync-dev.logic.ts` (rein),
`scripts/sync-dev.test.ts` (19 Zusagen), `scripts/sync-dev-waechter.ts` (CLI,
wie `assert-target.ts` über `db-push-prod.logic.ts`). Sieben Verbiegungen der
Logik wurden einzeln rot gemessen; die Tests greifen also.

- [x] 2.1 RED: ein Lauf mit der **PROD**-Kennung im Ziel bricht ab, bevor er
      schreibt
- [x] 2.2 RED: eine **vertauschte Quelle** — ein anderes Projekt als PROD, auch
      DEV selbst — bricht ab, bevor er liest. Der erste Entwurf prüfte nur das
      Ziel; eine falsche Quelle hätte alle Tests bestanden
- [x] 2.3 RED: **gemischte Zugangsdaten** brechen ab — DEV-Datenbank-URL neben
      PROD-Storage-URL oder PROD-Service-Key. Der Datenbankwächter allein
      schützt weder Ablage noch GoTrue-Admin-API, und die Spaltung dieser Werte
      ist im Projekt dokumentiert. **An den echten Werten belegt:** gegen
      Infisical `prod` meldet der Wächter „dbUrl → viwnt…, aber apiUrl →
      foelo…" — die dokumentierte Spaltung, jetzt gefangen statt notiert
- [x] 2.3a Der Schlüssel muss auch die **Rolle** `service_role` tragen. Gefunden
      bei ebendieser Sichtprobe: der anon-Schlüssel desselben Projekts trägt
      dieselbe Kennung, kam durch und wäre erst zur Laufzeit gescheitert — dort
      dann aussehend wie ein RLS-Problem
- [x] 2.4 GREEN: Kennung je Wertepaar aus dem Benutzernamen (`postgres.<ref>`)
      gegen feste Allowlists — **nicht** gegen den Host, der ist regionsweit
      gleich. (Gemessen liegen die beiden sogar auf verschiedenen Clustern,
      `aws-0` und `aws-1` — sich darauf zu stützen bliebe trotzdem falsch)
- [x] 2.5 Test: unbekannte, gleiche oder nicht auflösbare Kennungen brechen ab
- [x] 2.6 Test: die Richtung ist fest verdrahtet — kein Schalter macht PROD zum
      Ziel
- [x] 2.7 **Zugangsdaten — erledigt am 2026-08-20 (Donald).** Der Spiegel liest
      alles aus Infisical `prod`; ein Lauf sieht damit beide Seiten zugleich:
      · `SUPABASE_SERVICE_ROLE_KEY_DEV` neu angelegt (fehlte ganz) — über die
        Management-API geholt, ohne den Wert je anzuzeigen. **Lesend an der
        DEV-Ablage belegt:** listet alle vier Buckets
      · `SUPABASE_URL_PROD` / `SUPABASE_URL_DEV` neu — vorher gab es nur
        `VITE_SUPABASE_URL`, und die zeigt in **beiden** Umgebungen auf DEV
      · `SUPABASE_DB_URL_DEV` nach `prod` kopiert; jede lag zuvor allein in
        ihrer eigenen Umgebung (1.1)
      · **Kein `SUPABASE_SERVICE_ROLE_KEY_PROD`** — bewusst abgewichen. Der
        PROD-Schlüssel liegt unter dem etablierten Namen
        `SUPABASE_SERVICE_ROLE_KEY`, den auch der WordPress-Import liest; ihn zu
        verdoppeln hiesse, zwei Vollzugriffs-Schlüssel zu führen, von denen eine
        Rotation nur einen erwischt. Der Wächter fällt auf den vorhandenen
        Namen zurück und **schreibt hin, welchen er gelesen hat**
      · `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` blieben unberührt: sie
        zeigen absichtlich auf DEV, und `deploy.yml` baut mit `--env=prod`

## 2a. Die Zugänge entschärfen — Voraussetzung, nicht Nacharbeit

Aus Decision 6. Diese Gruppe SHALL abgeschlossen sein, **bevor** der erste Lauf
echte Personendaten nach DEV bringt: solange `Test1234!` im öffentlichen
Repository steht, gibt jeder Leser sich Zugriff auf das Verzeichnis.

**Erledigt am 2026-08-20 — und die Gruppe war grösser als geplant.** Sie nannte
`docs/demo-zugang.md` und ein Passwort. Gefunden wurden **fünf** Dokumente mit
`Test1234!` und, schwerer, ein **zweites** Passwort im Quelltext, das 24 der 41
DEV-Konten öffnete.

- [x] 2a.1 Neue Passwörter für die drei `@fbcdemo.com`-Zugänge setzen — ein
      Zufallswert (24 Zeichen) für alle drei, abgelegt als
      `DEMO_LOGIN_PASSWORD_DEV` in Infisical `prod`. **Reihenfolge war Absicht:**
      erst ablegen, zurücklesen, vergleichen — dann erst die Konten anfassen.
      Andersherum wäre der Wert bei einem Fehlschlag verloren, und für
      `@fbcdemo.com` gibt es keinen Reset per Mail. Beide Richtungen belegt:
      alle drei melden sich mit dem neuen Wert an, `Test1234!` wird abgewiesen
- [x] 2a.2 Sie aus `docs/demo-zugang.md` entfernen; das Dokument nennt künftig
      den Ablageort (Infisical), nicht den Wert
- [x] 2a.3 Prüfen, ob die alten Werte anderswo im Repository stehen — ein
      entfernter Wert, der in einem zweiten Dokument weiterlebt, ist nicht
      entfernt. **Fünf Dokumente**, nicht eines: `demo-zugang.md`,
      `demo-script.md`, `foundation-acceptance.md`, `w4-acceptance.md` und
      `tier-testing.md` (dort *erzeugte* das SQL Konten damit — jetzt ein
      `:passwort`-Platzhalter). Die verbliebenen zwei Nennungen sind
      Rückblicke auf einen nun abgewiesenen Wert
- [x] 2a.3a **Der eigentliche Fund, und er stand in keiner Aufgabe.**
      `demo_personas.sql` und `demo_legacy_profile.sql` legen Konten mit
      `crypt('demo-not-a-real-password', …)` an — Klartext im **öffentlichen**
      Repository. Der Kommentar daneben sagt „Verzeichnis-Inhalt, KEINE Logins";
      nachgemessen ist das eine Absicht, kein Mechanismus:
      · **24 der 41 DEV-Konten** trugen dieses Passwort, über **alle sechs
        Stufen** bis `impact`
      · ein Login damit (`hans-peter.stadler@…`) las das **komplette
        Verzeichnis** — heute 38 Demo-Profile, nach dem ersten Spiegellauf die
        72 echten Mitglieder
      Behoben in beide Richtungen: die Seed-Dateien setzen jetzt
      `crypt(gen_random_uuid()::text, …)` — die Spalte bleibt gefüllt (GoTrue
      erwartet sie), aber es gibt kein Passwort dazu. Und die 24 lebenden Konten
      auf DEV sind neutralisiert. Gegenprobe: drei Personas werden abgewiesen,
      die drei Presenter-Konten gehen weiter
- [x] 2a.4 ~~Die neuen Werte gehören in den deklarierten DEV-Bestand (4.9)~~ —
      **entfällt durch die Entscheidung vom 2026-08-20** (design.md §3a): die
      Demo-Zugänge werden nicht wiederhergestellt. `DEMO_LOGIN_PASSWORD_DEV`
      bleibt in Infisical, bis der erste Lauf sie ohnehin entfernt

## 3. Auszug, Manifest und Ablage

**Erledigt am 2026-08-20** — `scripts/sync-dev-auszug.ts` über
`sync-dev-auszug.logic.ts`, 35 Zusagen, sieben Verbiegungen einzeln rot, vier
echte Läufe gegen PROD (rein lesend). Bericht:
`messungen/gruppe-3-2026-08-20.md`. Der Auszug liegt in
`~/.fbc-spiegel/spiegel-viwntbodrtqxgmqyxluh-20260820T134854Z`.

- [x] 3.1 Ablageort ausserhalb des Arbeitsbaums: Verzeichnis `0700`, Dateien
      `0600`, Auflösung über `realpath` gegen den Arbeitsbaum geprüft — **in
      beide Richtungen**: ein Ort, der den Arbeitsbaum *enthält*, wird
      ebenfalls abgelehnt (er nähme beim Aufräumen den Quelltext mit)
- [x] 3.2 RED: ein Ablageort **innerhalb** des Arbeitsbaums wird abgelehnt —
      auch wenn ein Symlink hineinzeigt. Gemessen: der Zeichenkettenvergleich
      sieht `/var/folders/…` und liesse durch
- [x] 3.3 Auszug aus PROD: `public` und der in 1.6 bestimmte `auth`-Umfang,
      getrennt, weil Gruppe 4 sie in verschiedenen Schritten zurückspielt.
      **`--format=plain --column-inserts --data-only`, beide mit demselben
      `--snapshot`** — das Archivformat ist am 2026-08-20 verworfen worden,
      siehe die Änderung an 4.1
- [x] 3.4 **Manifest** erzeugen: je Tabelle Zeilenzahl und Zeilenhash, je Objekt
      Größe und Prüfsumme. Ohne Manifest gibt es keine belastbare Abnahme.
      Gemessen: 36 Tabellen / 857 Zeilen, 125 Objekte. Die Prüfsumme wird
      **selbst gerechnet** (sha256 über die empfangenen Bytes); `eTag` steht
      nur zum Vergleich mit PROD daneben
- [x] 3.5 Test: bricht das Erzeugen ab, ist gegen DEV **kein** schreibender
      Befehl abgesetzt worden. Nicht als Strukturargument, sondern gemessen:
      mit einem nicht auflösenden DEV-Host und einem DEV-Service-Key ohne
      gültige Signatur lief der Auszug einmal **durch** (Exit 0) und einmal in
      den **Abbruch** (Exit 1) — beide Male ohne Fehler aus Richtung DEV
- [x] 3.6 Objekte der vier Buckets holen — **rekursiv und über alle Seiten**.
      Die heutigen 125 Objekte dürfen nicht als Beleg dienen, dass eine
      Seitengrenze nie erreicht wird. **Abweichung, bewusst:** die Liste kommt
      aus `storage.objects`, nicht aus `list()` — dort steht jeder Schlüssel
      voll ausgeschrieben, es gibt keine synthetischen Präfixe abzusteigen.
      Geblättert wird **per Keyset** über `(bucket_id, name)`, nicht per
      `offset`; Seitengröße 50, also kleiner als der Bestand
- [x] 3.7 Test: ein Objektname mit Pfadanteilen nach oben kann den Ablageort
      nicht verlassen. Zweifach geprüft: an den Segmenten und am aufgelösten
      Ergebnis. Der Bucket-Name ist ebenfalls Fremddaten
- [x] 3.8 Auszüge tragen eindeutige Namen und überschreiben einander nicht.
      Erzwungen wird das vom Anlegen (`mkdir` ohne `recursive`), nicht vom
      Namen; drei Läufe standen nebeneinander
- [x] 3.9 Test: die **Differenz** von `git status --porcelain --ignored` vor und
      nach dem Lauf ist leer. Nicht die Ausgabe selbst — sie führt schon vorher
      20 Pfade. Am echten Lauf gemessen

## 4. Ersetzen

**Gebaut und lokal vollständig geprobt am 2026-08-20** —
`scripts/sync-dev-ruecklauf.ts`, 22 Zusagen als Test, sieben Läufe gegen den
lokalen Stack. **DEV ist nicht berührt worden.** Bericht:
`messungen/gruppe-4-2026-08-20.md`. Was offen bleibt, steht bei 4.7, 4.8a und
4.10 — und es ist jedes Mal dasselbe: der lokale Stack kann es nicht zeigen.

Reihenfolge nach `design.md` §Decisions 2. **1.4/1.5 tragen sie — aber mit
einem anderen Mechanismus**, und das ändert 4.1, 4.3 und 4.5.

- [x] 4.1 `set session_replication_role = replica` für die Sitzung — **nicht**
      13 einzelne `ALTER TABLE … DISABLE TRIGGER`: an `auth.users` und beiden
      `storage`-Tabellen fehlen dafür die Eigentümerrechte (1.5). Test, dass
      der Schalter gesetzt war, solange geschrieben wurde.
      **Der Mechanismus ist am 2026-08-20 ein zweites Mal ausgetauscht
      worden** (Gruppe 3, Sonden gegen DEV): `PGOPTIONS` trägt **nicht**.
      Supavisor schreibt das Startup-Paket um und verwirft jede Option
      **ohne Fehler** (`application_name` kommt als `Supavisor` zurück),
      und über die Direktverbindung antwortet der Server mit
      `permission denied to set parameter`. Nur ein `SET` **in der laufenden
      Sitzung** trägt. `pg_restore` öffnet seine Verbindung selbst und liefe
      damit mit **lebenden Triggern** — über den Pooler lautlos. Deshalb ist
      der Auszug ausführbares SQL, und Gruppe 4 spielt ihn in einer selbst
      gehaltenen Sitzung ein. `pg_restore` kommt nicht mehr vor
- [x] 4.1a Test: nach dem Lauf ist `session_replication_role` wieder `origin`
      und alle 18 Trigger tragen weiter `tgenabled='O'`
- [x] 4.1b **Fremdschlüssel-Integrität eigens messen.** Im replica-Modus
      schweigen auch die internen RI-Trigger, Fremdschlüssel werden während des
      Laufs also nicht geprüft — was sich vorher von selbst ergab, ist jetzt
      eine Zusage, die jemand aussprechen muss
- [x] 4.2 `auth`-Bestand in DEV leeren (kaskadiert in `public.profiles`)
- [x] 4.3 `public`-Tabellen leeren, Buckets leeren. **Am 2026-08-20 korrigiert,
      nachdem der Rumpf der Trigger gelesen wurde:** `protect_objects_delete`
      und `protect_buckets_delete` rufen beide `storage.protect_delete()`, und
      die Funktion trägt eine dokumentierte Hintertür —
      `set storage.allow_delete_query = 'true'`. Sie zu benutzen wäre trotzdem
      **falsch**, und im replica-Modus zu löschen ebenso: der Trigger schützt
      vor etwas Echtem, nämlich **verwaisten Objekten im S3**, die eine
      SQL-Löschung hinterlässt. Bei jedem Spiegellauf kämen 125 dazu, dauerhaft.
      · Also: `public`-Tabellen per SQL im replica-Modus leeren.
      · Die **Buckets aber über die Storage-API** (`remove()`) — sie löscht das
        Blob mit. Das geht **ausserhalb** der replica-Sitzung, und es muss
        dorthin: die Storage-API hält ihre **eigene** Datenbankverbindung, der
        Schalter unserer Sitzung erreicht sie ohnehin nicht. Symmetrisch zu
        4.8, das ebenfalls über die API schreibt (Decision 5)
- [x] 4.4 `auth`-Umfang zurückspielen — Konten **und Identitäten**
- [x] 4.5 **Zusage statt Arbeitsschritt.** Der Kunstgriff entfällt: im
      replica-Modus erzeugt `on_auth_user_created` nichts. Zu belegen ist
      genau das — nach 4.4 trägt `public.profiles` **keine** vom Trigger
      erzeugte Zeile (er setzte `basic`, nicht `discover`; geltende Definition
      `20260715150000`). Wird der Weg doch über `truncate … cascade` gegangen,
      zusätzlich belegen, dass `auth.users` unberührt bleibt (1.8)
- [x] 4.6 `public` zurückspielen
- [x] 4.7 Test: der Restore erzeugt **keine** zusätzlichen Beiträge aus
      `trg_event_feed_post`, keine Benachrichtigungen aus
      `contact_requests_lifecycle` und **keine Post** aus
      `contact_requests_email_webhook` — **die Zusage muss gegen DEV fallen,
      nicht lokal** (siehe 5.1). **Am 2026-08-20 gegen DEV gefallen — aber nur
      zu einem Drittel als Messung.** Echt belegt ist `trg_event_feed_post`:
      acht Events wurden eingespielt, `public.posts` steht danach auf 29 wie im
      Manifest, also **null** Zusatzbeiträge. Die beiden anderen Hälften sind
      **leer gelaufen, nicht bestanden**: der Auszug trägt `contact_requests=0`
      und `notifications=0` — es gab schlicht nichts, worauf die beiden Trigger
      hätten feuern können. Wer das später als „gegen Post geprüft" liest,
      liest mehr, als dasteht
- [x] 4.8 Objekte in die vier Buckets schreiben, **`upsert: false`**
- [x] 4.8a Test: `notify_contact_request_webhook()` und
      `contact_requests_email_webhook` stehen nach dem Lauf noch. **Am
      2026-08-20 gegen DEV belegt** — beide stehen, und die Funktion zeigt
      unverändert auf
      `foelowldexkcqzewvrcf.supabase.co/functions/v1/notify-contact-request`.
      Lokal war das nur eine Warnung, weil beide auf dem lokalen Stack gar
      nicht existieren. Sie stehen in
      keiner Migration (1.9) — still verloren sähe aus wie ein sauberer Lauf
- [x] 4.9 **Deklaration** des DEV-eigenen Bestands an einer Stelle anlegen.
      **Stark verkleinert am 2026-08-20** (design.md §3a): keine Demo-Zugänge,
      keine Demo-Welt, keine Testkonten. Es bleiben zwei Dinge, beide auf
      **übernommenen** Konten:
      · `staff_roles`: `matching_manager` auf **einem dritten übernommenen
        Konto** — entschieden am 2026-08-20, nachdem die erste Antwort
        („Donald und Detlev") am Schema scheiterte: `staff_roles.profile_id`
        ist **Primärschlüssel**, ein Konto hält genau EINE Rolle, die Zeile
        ersetzte also ihre Admin-Zeile. Und sie brächte nichts:
        `is_matching_manager()` akzeptiert `role in ('matching_manager',
        'admin')`, beide Admin-Konten bedienen die Matching-Fläche bereits.
        Der Zweck der Zeile ist ein anderer — sie stellt den Fall
        **`matching_manager` OHNE `admin`** her, den PROD nicht kennt und den
        sonst niemand prüfen könnte. Die zwei Admin-Zeilen kommen aus PROD mit
      · `tier`-Zuweisungen, damit die sechs Stufen besetzt sind — PROD trägt
        **ausschliesslich `impact`**, ohne das liesse sich Stufen-Gating auf
        DEV nicht mehr prüfen. **Entschieden am 2026-08-20: je ein
        übernommenes Konto auf `basic`, `connect`, `discover`, `exchange`,
        `focus`; alle übrigen bleiben `impact`.** Fünf Konten, keine neuen —
        und die Auswahl folgt einer **Regel** statt einer Namensliste
        (kleinste `auth.users.id` zuerst): deterministisch, idempotent, und
        ohne fünf echte Mitgliedsadressen ins öffentliche Repository zu
        schreiben.
        **Die beiden Admin-Konten sind ausgenommen.** `has_level` kennt keine
        Admin-Ausnahme — ein Admin auf `basic` sähe ein **leeres**
        Verzeichnis, und damit wären Donalds und Detlevs DEV-Konten unbrauchbar.
        Ebenso ausgenommen: das `matching_manager`-Konto.
        **Achtung, kein Zeilenzuschlag:** `tier` ist eine **Spalte** auf
        `public.profiles`. Die fünf Zuweisungen ändern die Zeilenzahl nicht,
        wohl aber den Zeilenhash — die Abnahme in 5.3 muss `public.profiles`
        deshalb als „Zahl gleich, Hash abweichend" führen, nicht als Fehler
      **Ohne die Feedback-Zeilen** — entschieden am 2026-08-20, sie werden
      mitersetzt. Das Aktivierungs-Gate braucht nichts: 35 der 72 übernommenen
      Konten sind nicht aktiviert
- [x] 4.10 Nachbereitung: den deklarierten Bestand **herstellen** — nach §3a nur
      noch `matching_manager` und die `tier`-Zuweisungen. **Und ausdrücklich
      festhalten, dass DEV danach nicht mehr im bisherigen Sinn vorführbar
      ist:** keine Jonas/Carla/Eleonora-Welt, keine Demo-Zugänge.
      `docs/demo-zugang.md`, `docs/demo-script.md` und die drei
      Abnahmedokumente sind danach überholt — entweder anpassen oder als
      historisch kennzeichnen. **Stand 2026-08-20: der Bestand wird hergestellt
      (gemessen: `basic`…`focus` je einmal, `impact` 67, `matching_manager` auf
      einem dritten Konto), die Dokumente sind noch NICHT nachgezogen.** `pnpm demo:seed`/`demo:reset` gegen DEV zu
      fahren würde den Spiegel zerstören.
      **Die Dokumentenhälfte am 2026-08-20 nachgezogen** — als historisch
      gekennzeichnet, nicht angepasst: eine neue Demo zu erfinden war nicht
      Aufgabe. `docs/demo-zugang.md` und `docs/demo-script.md` bekommen einen
      Kopf, der sagt, dass die drei Zugänge nicht mehr existieren (auf DEV
      nachgezählt: **0** auf `@fbcdemo.com` und **0** auf
      `@demo.fbc.invalid`, von 72), dass ohnehin alle Hashes neutralisiert sind
      und dass das Drehbuch noch vom alten Drei-Stufen-Modell spricht.
      `docs/foundation-acceptance.md` und `docs/w4-acceptance.md` bekommen
      einen Nachtrag: die Befunde bleiben gültig, der Weg sie zu wiederholen
      nicht. `w2-` und `w3-acceptance.md` nennen die Personas nicht
- [x] 4.11 `admin_roles.sql` prüft sich nicht selbst: es braucht externe
      Adressen, kann still no-op laufen und legt `matching_manager` nicht an.
      Der Rollensatz wird deklariert und danach verglichen
- [x] 4.12 **Überholt durch §3a und ersetzt.** Es gibt keine Demo-Zugänge mehr,
      an denen sich Anmeldefähigkeit prüfen liesse — und 4.13 macht die
      übernommenen Konten ausdrücklich *un*anmeldefähig. Was an ihre Stelle
      tritt: Test, dass die Admin-Konten aus PROD (gemessen: drei) **mit ihrer eigenen
      Kennung** (`auth.users.id`) durchkommen, also die Admin- und
      `matching_manager`-Zeilen aus 4.9 auf vorhandene Konten zeigen und nicht
      ins Leere. Eine Rollenzeile auf einer nicht existierenden Kennung ist die
      Art Fehler, die erst beim Anmelden auffiele — und niemand meldet sich
      hier an
- [x] 4.13 **Produktions-Passwort-Hashes neutralisieren** (Decision 6). Test:
      ein übertragenes Mitgliedskonto lässt sich auf DEV **nicht** mit seinem
      PROD-Passwort anmelden. Die Zusage ist negativ formuliert, weil ein
      positiver Test hier nichts belegen könnte

## 5. Einmal echt laufen lassen

- [x] 5.1 Vollständiger Restore-Probelauf gegen den **lokalen** Stack, bevor DEV
      berührt wird — dort ist ein Fehlschlag folgenlos. Hier fällt auch die
      offene Zusage aus 1.3: ein mit `pg_dump 18.4` erzeugter Auszug muss in
      einen 17.6-Server zurückgehen. **Am 2026-08-20 gelaufen, Exit 0** —
      36 Tabellen, 857 Zeilen, 125 Objekte aus einem leeren, frisch migrierten
      Schema. Die Versionsfrage ist damit beantwortet: 18.4-SQL geht in 17.6.
      **Entschärft**: seit dem Formatwechsel
      ist der Auszug ausführbares SQL, die Archivformat-Hälfte der Zusage
      entfällt; offen bleibt nur, ob 18.4 SQL-Syntax schreibt, die 17.6 nicht
      kennt. **Blinder Fleck:** lokal fehlt genau
      `contact_requests_email_webhook` (17 statt 18 Trigger), weil er in keiner
      Migration steht — über „keine Post" sagt ein grüner lokaler Lauf nichts
- [x] 5.2 `pnpm sync:dev` in `package.json` eintragen und einmal gegen DEV
      ausführen — **die beiden DB-URLs liegen in getrennten
      Infisical-Umgebungen** (1.1), ein einzelner `infisical run --env=…`
      liefert nie beide. **Am 2026-08-20 gelaufen, im zweiten Anlauf, Exit 0.**
      Der erste Lauf (19:20) brach bei 4.1b ab: geleert wurden nur `auth.users`
      und `auth.identities`, stehen blieben 13 `sessions`, 81 `refresh_tokens`,
      13 `mfa_amr_claims` und ein `one_time_token` der alten DEV-Demokonten.
      `ON DELETE CASCADE` trug nicht — `session_replication_role = replica`
      legt die Cascade-Trigger mit still. Behoben mit
      `authTabellenZumLeeren()`: eine Regel statt einer Namensliste, plus
      Nachzählung jeder geleerten auth-Tabelle **im Leeren-Schritt**
- [x] 5.3 **Am 2026-08-20 abgenommen, unabhängig nachgerechnet** (nicht aus
      dem Eigenprotokoll des Laufs): 36 Tabellen und 125 Objekte gegen
      `manifest.json`, alle 125 eTags gleich. Genau drei Abweichungen, alle
      deklariert — `auth.users` (Hash; 4.13 neutralisiert die Hashes),
      `public.profiles` (Hash; Stufen zugewiesen) und `public.staff_roles`
      (3 → 4; `matching_manager`). 858 Zeilen = 857 aus dem Auszug + eine.
      Ursprünglicher Wortlaut: Abnahme als **Manifestvergleich mit benannten Abweichungen**: DEV
      trägt den Bestand des Auszugs **plus** den deklarierten DEV-Bestand.
      Nicht „gleiche Zeilenzahlen wie PROD" — das ist mit 4.10 unvereinbar und
      damit unerfüllbar. **Und in Gruppe 3 gemessen, warum auch ein frischer
      PROD-Vergleich nicht taugt:** zwischen 11:18 und 15:38 wichen
      `auth.users` und `public.profiles` im Zeilenhash ab, bei unveränderter
      Zeilenzahl — drei Zeilen hatten sich bewegt. Verglichen wird gegen
      `manifest.json` **des Auszugs**, nie gegen „PROD jetzt". **Ein Posten
      steht schon fest** (5.5): `storage.objects.owner`/`owner_id` sind im
      Spiegel bei allen 125 Objekten leer, auf PROD nur bei 117 — das Manifest
      führt `owner` nicht, und der Rücklauf lädt mit dem Dienstschlüssel hoch.
      Rechtefolgen hat das keine: keine der 14 Policies auf `storage.objects`
      nennt `owner`, alle entscheiden über den Pfadanfang
- [x] 5.4 Idempotenz **aus demselben gespeicherten Auszug** zweimal einspielen
      und Zeilenhashes plus Objektprüfsummen vergleichen. Zwei Läufe gegen die
      laufende Quelle belegen nichts — sie können verschiedene Stände gelesen
      haben
- [x] 5.5 Sichtprobe in der laufenden lokalen Oberfläche: fünf echte Profile mit
      Bild, Anschrift und Netzwerken. Grüne Tests haben hier schon einmal ein
      sichtbar falsches Ergebnis durchgewunken. **Am 2026-08-20 gelaufen** —
      fünf Profile einzeln aufgerufen, alle mit Titelbild und Avatar
      (Herkunft im Nachtrag korrigiert — sie kamen von PROD, nicht aus dem
      lokalen Storage), Verzeichnis meldet 36 Mitglieder, Konsole über alle
      Seiten leer. **Anschrift und Netzwerke stehen nicht auf der öffentlichen
      Profilseite** — `profiles_public` führt `socials`/`website` gar nicht, und
      keine Komponente rendert sie öffentlich (Bestandscode, kein
      Spiegel-Defekt). Belegt wurden sie unter `/profil/bearbeiten`: Strasse,
      PLZ, Ort, Bundesland, Land und fünf Netzwerke kamen vollständig durch.
      Bericht: `messungen/gruppe-5-sichtprobe-2026-08-20.md`.
      **Nachtrag am selben Abend: auch auf der ausgelieferten Flaeche gelaufen**
      (`fbc-platform.pages.dev`, liest gegen DEV — im Bundle nachgelesen, nicht
      aus der Konfiguration geschlossen). Verzeichnis 36 Mitglieder, Profile,
      Aktivitaet mit echten Autorennamen, 7 kommende Events mit Anmeldezahlen,
      Admin-Liste mit Paging, Konsole ueber alle Seiten leer. Dafuer trug ein
      Konto (`vorschau@fbc.invalid`, TLD existiert nicht) voruebergehend ein
      Wegwerf-Passwort; zurueckgenommen und dreiteilig belegt (1/72 → 0/72 und
      „Invalid login credentials" an der Flaeche). **Ein Befund:**
      `avatar_url`/`cover_url` sind absolute **PROD**-URLs (56 bzw. 53, keine
      einzige auf DEV) — der Spiegel ist vollstaendig, wird fuer Avatare und
      Titelbilder aber nie gelesen. Gehoert in 6.2
- [x] 5.6 **Am 2026-08-20 vollständig belegt.** `--sicherung` lässt 4.13 **und**
      den DEV-Bestand aus 4.9/4.10 aus. Beides, nicht nur 4.13: ein
      Sicherungslauf, der fünf Stufen umschreibt und eine
      `matching_manager`-Zeile dazustellt, ergibt nicht den Bestand des
      Manifests, sondern einen DEV-Bestand mit echten Hashes.
      **Gegen `--ziel=dev` ist der Schalter abgelehnt** — gemessen, und der
      Abbruch kommt vor jedem Verbindungsaufbau.
      Belege, alle gegen den lokalen Stack:
      **(a)** ohne Schalter 72 Hashes ersetzt, **0/72** stehen im Auszug,
      Anmeldung HTTP 400; **(b)** mit Schalter **72/72** Hashes byteweise wie
      im Auszug und die Abnahme meldet **null** Abweichungen statt zwei;
      **(c)** dass die Anmeldung überhaupt am Hash hängt, ist eigens
      kontrolliert — ein per SQL gesetzter bekannter bcrypt-Hash (derselbe Weg,
      den 4.13 benutzt) ergibt HTTP 200 mit Token. Aus (b) und (c) zusammen
      folgt die Anmeldefähigkeit; das echte PROD-Passwort ist hier niemandem
      bekannt und wird auch nicht gebraucht.
      Ursprünglicher Wortlaut: **Rückweg gehen:** den Auszug gegen ein leeres, frisch migriertes
      Schema einspielen und belegen, dass daraus der Bestand des Manifests
      entsteht und die Konten anmeldefähig sind. Ohne diesen Lauf darf der
      Auszug nicht „Sicherung" heißen

## 6. Abschluss

- [x] 6.1 `pnpm test`, `pnpm typecheck`, `pnpm lint` grün — **am 2026-08-20
      am Stück gelaufen, Exit 0**: typecheck sauber, lint 0 Fehler (4
      Bestandswarnungen `react-refresh/only-export-components`), 1326 Tests in
      125 Dateien. **Nach den Behebungen aus 6.3 erneut gelaufen: 1333 Tests,
      typecheck sauber, lint unverändert 0 Fehler.** Prettier ist **kein** Gate: kein Workflow ruft es auf, und
      `prettier --check .` meldet auf HEAD 139 Bestandsdateien (fast alle
      `openspec/`-Markdown) — ein `--write` darüber wäre der Fehler, den
      `pnpm format` schon einmal gemacht hat
- [x] 6.2 `docs/supabase-environments.md` um den Spiegel ergänzen; in
      `docs/prod-neuaufbau-plan.md` Schritt 1 auf das entstandene Werkzeug
      umstellen **und Schritt 0 schließen** — die Frage „welches Projekt ist
      PROD" ist am 2026-08-20 entschieden, das Dokument führt sie noch offen.
      **Dazugekommen aus 5.5 (ausgelieferte Fläche):** `profiles.avatar_url`
      und `profiles.cover_url` tragen **absolute URLs mit der
      PROD-Projektkennung** (56 bzw. 53 Zeilen, keine einzige relativ). Ein
      Neuaufbau unter neuer Kennung lässt alle 109 Bild-URLs ins Leere zeigen,
      obwohl die Objekte mitgezogen wären. Gehört als eigener Schritt in den
      Plan, nicht als Fußnote.
      **Am 2026-08-20 erledigt.** `supabase-environments.md`: neuer Abschnitt
      „Der Spiegel DEV ← PROD" (zwei Werkzeuge, keine Anonymisierung samt
      Ausgleich, die drei deklarierten Abweichungen, `--sicherung`, die zwei
      Fallen, und was der Spiegel nicht mitbringt); dazu vier Aussagen im
      Bestand nachgezogen, weil sie durch den Spiegel **falsch** geworden
      waren — die Inhaltszeile der Projekttabelle, „Demo-Seed erlaubt: ja",
      „Was DEV nicht fängt" (DEV trägt jetzt echte Daten, der
      `migrate-dev`-Lauf fängt damit die Klasse Fehler, für die es ihn gibt)
      und die Nachlaufzeile „DEV regelmäßig aus PROD auffrischen".
      `prod-neuaufbau-plan.md`: **Schritt 0 geschlossen** (Weg A, mit den vier
      daran hängenden Festlegungen), Schritt 1 auf den Auszug plus
      `--sicherung` umgestellt (das Werkzeug musste nicht geschrieben werden),
      **neuer Schritt 3b** für die 109 Bild-URLs, und der Schlussabsatz „Was
      dieser Plan nicht entscheidet" aufgelöst
- [x] 6.3 Diff-Review durch zwei Prüfer anderer Hersteller — **am 2026-08-20
      gelaufen.** gemini APPROVE ohne Befunde, codex REQUEST-CHANGES mit 10.
      **Keiner übernommen, alle zehn am Code nachgeprüft:** vier tragen, vier
      sind richtig beschrieben aber heute folgenlos, zwei sind Bauform.
      Donalds Entscheidung: alle vier behoben. 4.13 steht jetzt unmittelbar
      hinter dem auth-Rücklauf (vorher lagen public.sql, zwei Prüfschritte, der
      Drift-Scan und 125 Uploads dazwischen — jedes `ende()` darin liess DEV mit
      gültigen PROD-Hashes zurück); `dateien` im Manifest mit sha256 für beide
      Dumps; `vergleicheBuckets` in beide Richtungen vor dem Löschen; und jede
      der 56 Tabellen wird einzeln nachgezählt statt nur `public.profiles`.
      7 neue Tests, alle erst rot; 1333 statt 1326.
      **Ein Rückfall, den nur der echte Lauf fand:** `pg_dump` leert den
      `search_path` der Sitzung, also lösten `crypt`/`gen_salt` am neuen Platz
      nicht mehr auf — behoben per Katalogabfrage nach dem pgcrypto-Schema.
      Vollständiger Lauf gegen den lokalen Stack Exit 0, `--sicherung` 72/72
      byteweise, hinterher 0/72. Bericht:
      `messungen/gruppe-6-review-behebung-2026-08-20.md`.
      **Folge:** der Auszug vom 20.08. ist nicht mehr einspielbar (kein
      `dateien`) — der nächste `sync:dev` braucht einen neuen Auszug
- [x] 6.4 `openspec archive` — erst wenn 5.3, 5.4 und 5.6 gemessen sind, nicht
      wenn der Code existiert. **Am 2026-08-20 gelaufen**, nachdem alle drei
      gemessen waren: 1 Anforderung in `deployment-environments` ersetzt,
      10 in `environment-sync` neu. Der Lauf meldete 3 offene Aufgaben und lief
      wegen `--yes` darüber hinweg — 4.10 war eine davon und ist danach
      geschlossen worden, nicht weggelassen
- [ ] 6.5 AGE-576 in Linear auf Done — vorher `get_issue` lesen
