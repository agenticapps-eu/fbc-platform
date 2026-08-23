# Tasks — add-admin-member-lifecycle (AGE-581)

Die Reihenfolge ist nicht beliebig: Abschnitt 2 ändert eine Bedingung, die rund
vierzig Policies erben. Vor ihm steht der Test, der beweist, dass sie heute
richtig ist, und nach ihm derselbe Test unverändert grün.

Die mit **[PR]** markierten Punkte stammen aus dem Plan-Review (`REVIEWS.md`)
und standen im ersten Entwurf nicht drin.

## 1. Vorarbeit: den Ausgangszustand festhalten

- [x] 1.1 Ausgangszustand festgehalten: `supabase test db` über die vier
      pgTAP-Dateien (`rls_test`, `grants_test`, `admin_member_list_test`,
      `directory_search_test`) — **489 Tests, alle grün**. Die Dateiliste ist
      Pflicht: ohne sie meldet der Befehl FAIL, obwohl grün, weil die elf
      `probe_*.sql` kein pgTAP sind.
- [x] 1.2 GoTrue-Ban belegt (`scripts/probe-age581-gotrue-ban.ts`): die
      Admin-API nimmt `ban_duration: "876000h"`, **nicht** einen Zeitpunkt; die
      Anmeldung wird danach mit HTTP 400 „User is banned" abgewiesen; `"none"`
      hebt auf. Als Entscheidung 9 in `design.md`.
- [x] 1.3 Golden-Snapshot geprüft. **Er bricht durch diesen Change NICHT:**
      `grants_test.sql:72` führt `profiles/authenticated=SELECT` tabellenweit,
      Zeile 106 listet nur die 17 UPDATE-Spalten — zu denen keine hinzukommt.
      `profile_legacy` ist eine bestehende Tabelle.
- [x] 1.4 **[PR]** Geprüft, dass die `is_admin()`-Verschärfung niemanden
      aussperrt (`scripts/probe-age581-admins.ts`): PROD zwei Admins, DEV drei
      Admins + ein Matching-Manager, **alle aktiviert**.
- [x] 1.5 **[PR]** Geprüft: **es kann keines geben.** `profiles_id_fkey` ist
      ein Fremdschlüssel von `profiles.id` auf `auth.users.id`; die Verbindung
      ist strukturell garantiert. Der `join` bleibt richtig, ein `left join`
      wäre irreführend.

## 2. Schema und Prädikate

- [x] 2.1 **RED, zwei Seiten:** pgTAP `member_lifecycle_test.sql`.
      (a) **Zielseite** — ein deaktiviertes und ein gelöschtes Profil erscheinen
      weder über die `profiles`-Policy noch in `profiles_public` noch über
      `search_directory`.
      (b) **[PR] Aufruferseite** — ein deaktivierter *Aufrufer* mit gültiger
      Sitzung bekommt aus `profiles`, `posts`, `events`, seinen **eigenen**
      Daten und den privilegierten Funktionen nichts.
      Der bestehende Aktivierungstest arbeitet mit `activated_at = null` und
      bliebe grün, während die neue Bedingung fehlt — (b) ist der einzige Beleg,
      dass sie greift.
- [x] 2.2 Migration: `profiles.disabled_at`, `profiles.deleted_at`
      (`timestamptz`, nullable, kein Default); `profile_legacy.payment_type`
      mit `check` auf die acht Werte. **Kein** UPDATE-Grant für Client-Rollen
      auf den drei Spalten.
- [x] 2.3 `is_activated()` und `is_activated_profile(uuid)` ersetzen:
      `and disabled_at is null and deleted_at is null`. Der Kommentar beginnt
      mit einer ausdrücklichen **Warnung**, dass der Name unvollständig ist
      (gemini, LOW) — der Rename bleibt Nachfolge-Notiz.
- [x] 2.4 `profiles_select_self_or_discover` und `profiles_public` ersetzen;
      `security_invoker=off` an der View **erhalten**.
- [x] 2.5 **[PR]** `is_admin()` und `is_matching_manager()` um die
      Zugangsbedingung erweitern. Ohne das behält ein deaktivierter Admin jede
      Fähigkeit über `admin_get_profile`, `admin_find_profile`,
      `admin_update_profile`, `admin_list_members` und die Lesepolicy auf
      `admin_audit`.
- [x] 2.6 **GREEN:** 2.1 läuft. Zusätzlich: die **489 bestehenden Tests bleiben
      unverändert grün** — der Beleg, dass die erbenden Policies nicht gekippt
      sind.
- [x] 2.7 Gegenprobe, dass der Test etwas prüft: `disabled_at is null` in 2.3
      versuchsweise entfernen, Test muss ROT werden. **Vorher committen** — ohne
      Commit nimmt jedes Zurücknehmen ungesicherte Korrekturen mit.

## 3. Die vier Lebenszyklus-Funktionen

- [x] 3.1 **RED:** pgTAP über die **vollständige Übergangstabelle** aus dem
      Delta — jede Handlung gegen jeden Ausgangszustand, mit dem zugesagten
      Fehlercode. Nicht nur der Fall „zweimal deaktivieren".
- [x] 3.2 `admin_disable_member(uuid, text)` / `admin_enable_member(uuid)`,
      `SECURITY DEFINER`, `set search_path = ''`, Audit-INSERT in derselben
      Transaktion **ohne** `exception`-Block.
- [x] 3.3 `admin_delete_member(uuid, text)` / `admin_restore_member(uuid)`.
      **[PR] Löschen fasst `disabled_at` NICHT an** — `deleted_at` gatet selbst.
      Wiederherstellen entbannt nur, wenn `disabled_at` null ist. Sonst ginge
      der Vorzustand verloren und das Wiederherstellen hätte keine richtige
      Antwort mehr.
- [ ] 3.4 **[PR]** Die Feed-Auskunft nimmt **Beitrags- und Kommentar-IDs**,
      nicht Profil-IDs, löst den Urheber selbst auf und wendet dabei dasselbe
      Sichtbarkeitsprädikat an. Eingabemenge begrenzt. Mit Profil-IDs wäre die
      Zusage „nur aus sichtbaren Beiträgen" eine Bitte an den Aufrufer statt
      einer Eigenschaft der Funktion.
- [x] 3.5 **[PR]** Jeder Übergang sperrt seine Zeile (`select … for update` oder
      bedingtes `update … returning`). Zwei gleichzeitige Aufrufe schreiben eine
      Protokollzeile, nicht zwei.
- [x] 3.6 **[PR]** EXECUTE der vier Funktionen liegt bei **`service_role`**,
      nicht bei `authenticated`. Die `is_admin()`-Prüfung im Rumpf bleibt als
      zweite Schranke. Kommentar an jeder Funktion begründet die Abweichung vom
      Hausmuster.
- [x] 3.7 **GREEN:** 3.1 läuft, samt eines Tests, dass ein direkter Aufruf als
      `authenticated` abgewiesen wird.

## 4. Die Anmeldung sperren

- [ ] 4.1 **RED:** die Edge Function antwortet ohne Admin-Session mit 401/403.
- [ ] 4.2 Edge Function `admin-set-member-ban`. Liest `sub` aus dem
      **Gateway-geprüften JWT**, nicht über `getUser()`/`getClaims()` — beide
      scheitern unter den asymmetrischen Signierschlüsseln in PROD.
- [ ] 4.3 Die Function prüft die Admin-Eigenschaft über eine DEFINER-RPC, nicht
      über einen Tabellenzugriff: `service_role` hält auf keiner
      `public`-Tabelle ein Recht, das scheitert erst zur Laufzeit.
- [ ] 4.4 **[PR] Reihenfolge je Richtung**, nicht pauschal:
      **Schliessen** = DB, dann Ban. **Öffnen** = Ban, dann DB. Andersherum
      wäre das Profil beim Öffnen sichtbar, während die Anmeldung noch gesperrt
      ist — und die Handlung verschwände aus der Oberfläche.
- [ ] 4.5 **[PR]** Teilfehlschlag: Antwort **`207`** mit
      `{hidden: true, banned: false}`; die Fläche zeigt eine **Warnung**, keinen
      Erfolg; der Teilfehlschlag steht im `admin_audit`-`payload`.
- [ ] 4.6 **[PR]** Der halbe Zustand ist **heilbar**: ist `disabled_at` gesetzt
      und der Ban fehlt, bricht ein erneutes Deaktivieren nicht mit `22023` ab,
      sondern setzt den Ban nach. Gilt gespiegelt fürs Öffnen.
- [ ] 4.7 Bann über `ban_duration: "876000h"`, Aufhebung über `"none"` —
      gemessen, nicht geraten (Entscheidung 9).
- [ ] 4.8 **GREEN:** 4.1 läuft; ein Durchlauf gegen den lokalen Stack belegt,
      dass ein deaktiviertes Konto sich nicht mehr anmelden kann.

## 5. `admin_list_members` erweitern

- [x] 5.1 **RED:** die fünf `p_status`-Werte; Ausschluss von Deaktivierten aus
      `alle`/`aktiviert`/`offen`; ein Mitglied ohne `profile_legacy`-Zeile fällt
      nicht aus der Liste; ein gelöschtes **und** deaktiviertes erscheint unter
      `geloescht`, nicht unter beiden. Abschnitt 12 in
      `admin_member_list_test.sql`, zwölf Zusagen über fünf Sondenkonten mit
      eigenem Suchbegriff `zyklusliste`. Der rote Lauf benannte sechs davon
      einzeln und brach dann am ersten `22023` ab; die beiden Zusagen „ist ein
      bekannter Wert" stehen deshalb **vor** den Mengenzusagen.
- [x] 5.2 **[PR] `drop function` + `create`, nicht `create or replace`.**
      Postgres kann den Rückgabetyp nicht ändern und bricht mit „cannot change
      return type of existing function" ab — gemessen. Mit dem Abwurf gehen
      Grants, Kommentar und **Parameter-Vorgabewerte** verloren; alle drei
      wiederherstellen, sonst meldet ein argumentloser Aufruf wieder
      „function does not exist" statt `42501`. Alle drei stehen in
      `20260823140000_admin_member_list_lifecycle.sql` wieder da; der
      bestehende Test auf den argumentlosen Aufruf (`42501`) bleibt grün und
      ist damit der Beleg für die Vorgabewerte.
- [x] 5.3 Neue Spalten: `deaktiviert_seit`, `geloescht_seit`, `paid_until`,
      `payment_type` — **hinter** den Verzeichnisspalten.
      **KORREKTUR zur ersten Fassung dieser Zeile:** der Paritätstest bleibt
      dadurch NICHT ohne Änderung grün. Er vergleicht Spalten*mengen*, nicht
      Positionen, und zählt die Verwaltungsspalten namentlich auf — aus drei
      werden sieben. Beide Zusagen in Abschnitt 9 sind mitgeändert, und dass sie
      brechen mussten, ist ihre Aufgabe (wie bei 6.3). Die hintere Position
      bleibt trotzdem richtig: sie hält die Verzeichnisprojektion in ihrer
      Reihenfolge zusammen.
- [x] 5.4 **[PR]** `admin_update_profile` um `payment_type` erweitern — an
      **allen vier** Stellen: Weissliste, Präsenztest (`patch ?| array[…]`),
      INSERT-Spalten und `on conflict do update`-Zuweisung. Nur die Weissliste
      zu ändern speichert nichts. Alle vier sind in der Migration einzeln
      benannt und **einzeln gegengeprobt** (siehe 5.6).
- [x] 5.5 TypeScript-Typen von Hand nachgezogen — `database.types.ts` ist in
      diesem Projekt handgepflegt (der Block sagt es selbst) und trägt
      Kommentare, die ein `supabase gen types` wegwürfe. `admin_update_profile`
      ändert seine Signatur NICHT: `patch` ist dort `Json`, die neue Weissliste
      schlägt sich im Typ nicht nieder. Der Fixture-Bauer in
      `AdminMitgliederPage.test.tsx` brauchte die vier neuen Felder, sonst
      bricht `tsc`.
- [x] 5.6 **GREEN:** 5.1 läuft, der Paritätstest ebenso, und Abschnitt 18.5c in
      `rls_test.sql` liest den gespeicherten `payment_type` über
      `admin_list_members` zurück, leert ihn per JSON-null und weist `bitcoin`
      ab. **575 pgTAP-Tests grün** (vorher 555), 1361 Vitest-Tests grün.
      **Sechs Mutations-Gegenproben** (gegen die Datenbank, nicht gegen das
      Repo): jede der vier `payment_type`-Stellen einzeln entfernt, der
      Ausschluss der Entfernten auf `true` gesetzt, der `left join` zum `join`
      verengt — jede Mutation rot, jede Wiederherstellung grün.

## 6. `event_attendees` und `my_activation_state`

- [x] 6.1 **RED:** ein entfernter Teilnehmer erscheint nicht mehr in
      `event_attendees`. Abschnitt 20.3b in `rls_test.sql`, beide Wege einzeln
      (`disabled_at` und `deleted_at`) und je eine Wächter-Zusage, dass die
      Reihe um genau ihn schrumpft statt leer zu werden. Roter Lauf: drei
      Fehlschläge, die beiden Wächter grün.
- [x] 6.2 **[PR]** `my_activation_state` bekommt ein drittes Feld
      `blocked boolean` — wahr bei deaktiviert **oder** gelöscht. Ein
      Zustandswort statt eines Wahrheitswerts verriete dem Betroffenen, welche
      der beiden Handlungen ein Admin vorgenommen hat. **Erledigt in Teil A**
      (`20260823120000`), hier nur nachgetragen; die Oberfläche liest es seit
      6.5.
- [x] 6.3 **[PR]** `rls_test.sql:705` hält die Signatur **wörtlich** fest
      („genau ZWEI Felder") und bricht dadurch. Er ist mitzuändern, und die
      `access-control`-Ausnahme im Spec ebenfalls — beides ist im Delta bereits
      geschrieben. Dass er bricht, ist seine Aufgabe. **Erledigt in Teil A**,
      hier nur nachgetragen: die Zusage steht jetzt auf drei Feldern und ist
      unverändert eine WÖRTLICHE Signaturprüfung, kein „enthält mindestens".
- [x] 6.4 `my_activation_state` wurde in Teil A mit `drop` + `create` ersetzt
      (aus zwei Feldern wurden drei). **Bei `event_attendees` trifft die
      Begründung nicht zu:** ihr Rückgabetyp bleibt `(profile_id, status)`, die
      Änderung sitzt im Prädikat. Dort genügt `create or replace`, und Grants
      und Kommentar bleiben damit erhalten. Statt `p.activated_at is not null`
      steht jetzt `is_activated_profile(p.id)` — eine sechste Kopie derselben
      Regel hiesse, dass die nächste Änderung an der Zugangsbedingung sechs
      Orte finden müsste statt fünf. Migration
      `20260823150000_event_attendees_lifecycle.sql`.
- [x] 6.5 Die Oberfläche zeigt einem gesperrten Konto einen **Sperrhinweis**,
      nicht den Aktivierungsbildschirm mit dem Angebot, einen Zugangslink
      anzufordern. `blocked` läuft von der RPC bis zum Schirm: `activation.ts`,
      `database.types.ts`, `auth-context.ts`, `AuthProvider.tsx`,
      `auth-fixtures.tsx`, `ActivationGate.tsx`. Der Zweig steht **vor** der
      Aktivierungswand und unabhängig von ihr — ein gesperrtes, zuvor
      bestätigtes Konto trägt `activated = true` und käme sonst durch.
      Sechs Zusagen in `ActivationGate.test.tsx`, darunter eine Löschprobe
      (ohne `isBlocked` bleibt alles beim Alten) und eine, die belegt, dass der
      Schirm die beiden Handlungen nicht unterscheidet.
      **Sichtprobe im Browser** gegen den lokalen Stack, nicht nur jsdom: ein
      angemeldetes Konto erst deaktiviert, dann gelöscht — beide Male derselbe
      Schirm, kein Zugangslink, keine Konsolenmeldung.
- [x] 6.6 **GREEN.** 580 pgTAP-Tests, 1367 Vitest-Tests. Gegenprobe für
      `event_attendees`: das Prädikat zurück auf `p.activated_at is not null`
      macht `rls_test` rot, die Wiederherstellung grün.

## 7. Frontend — Zeilenmenü

- [ ] 7.1 **RED:** das Menü zeigt an einer deaktivierten Zeile „reaktivieren"
      und nicht „deaktivieren".
- [ ] 7.2 Menükomponente. **Overlay an `document.body` portalieren** — ein
      `fixed`-Overlay wird hier an zwei Stellen eingefangen (`.fbc-card:hover`
      durch `transform`, `<header>` durch `backdrop-blur`).
- [ ] 7.3 Rückfragen für Deaktivieren und Löschen, beide **namentlich**.
- [ ] 7.4 Tastaturbedienung und Schliessen beim Verlassen.
- [ ] 7.5 **[PR]** Handlungsmatrix **serverseitig erzwungen**, vom Menü nur
      gespiegelt. Kombinierte Zustände abdecken: einem unaktivierten **und
      gelöschten** Mitglied darf weder „Zugangslink schicken" noch „direkt
      aktivieren" angeboten werden; „reaktivieren" darf ein gelöschtes nicht
      wiederbeleben.
- [ ] 7.6 **GREEN**, danach **Sichtprobe im Browser**: Höhe des Overlays messen
      und `elementFromPoint` prüfen — jsdom sieht das Einfangen nie.

## 8. Frontend — Reiter

- [ ] 8.1 **RED:** ein deaktiviertes Mitglied fehlt unter „Alle" und steht unter
      „Deaktiviert".
- [ ] 8.2 Fünf Reiter, gewählter Reiter als Suchparameter in der Adresse.
      **[PR]** Die Abbildung Reiter → `p_status` ist die aus dem Delta:
      „Mitgliedschaft" ist ein Darstellungsmodus über `p_status = 'alle'`, kein
      eigener Filter; `aktiviert` hat keinen Reiter.
- [ ] 8.3 Die drei bestehenden Sichten bleiben innerhalb der Reiter erhalten.
- [ ] 8.4 **GREEN**, plus ein Test, der von aussen zum Reiter navigiert und
      zurückgeht — ein Zustand, den nur `location` trägt, wird sonst nie von
      aussen geprüft.

## 9. Frontend — Reiter „Mitgliedschaft"

- [ ] 9.1 **RED:** ein Mitglied ohne `paid_until` zeigt „unbekannt", kein Datum.
- [ ] 9.2 Zeile mit Stufe, bezahlt-bis und Zahlungsart. **Stufe nur lesbar**,
      kein Eingabefeld (AGE-516).
- [ ] 9.3 Das Auswahlfeld für die Zahlungsart über `Controller`, nicht über
      `register` — wächst die passende Option erst nach einem `reset()` nach,
      fällt der Browser still auf die erste zurück und das nächste Speichern
      löscht den Wert.
- [ ] 9.4 Speichern über `admin_update_profile`, nicht über einen direkten
      Tabellenzugriff — und **nicht** über `saveProfile`, das alle Profilspalten
      schreibt und Interessen und Ziele dabei löscht.
- [ ] 9.5 **GREEN**, plus Sichtprobe: Wert setzen, Seite neu laden, Wert steht
      noch da.

## 10. Feed — „Ehemaliges Mitglied"

- [ ] 10.1 **RED:** ein zurückgezogener Autor heisst „Ein Mitglied", ein
      entfernter „Ehemaliges Mitglied" — **beide im selben Test**, sonst prüft
      er die Unterscheidung nicht.
- [ ] 10.2 Die Auskunft im Feed aufrufen, nur mit Session.
- [ ] 10.3 Kein Verweis auf ein Profil für entfernte Autoren.
- [ ] 10.4 **[PR]** Auch **Kommentarautoren** neutralisieren, nicht nur
      Beitragsautoren — ein Faden, in dem nur die Beiträge neutral sind, hält
      die Zusage nicht.
- [ ] 10.5 **GREEN.**

## 11. Abnahme

- [ ] 11.1 `supabase test db` mit ausdrücklicher Dateiliste, alle grün.
- [ ] 11.2 `pnpm verify` grün; **nicht** `pnpm format` — es schreibt rund
      sechzig fremde Dateien um.
- [ ] 11.3 `openspec validate --all` grün.
- [ ] 11.4 `grants_test.sql` grün (laut 1.3 ohne Nachziehen — falls doch, hier
      vermerken warum).
- [ ] 11.5 Code-Review auf dem **Diff**, durch einen anderen Anbieter als den,
      der ihn geschrieben hat.
- [ ] 11.6 Sichtprobe der gesamten Fläche im Browser, gegen den lokalen Stack.

## 12. Datenpflege (NACH dem Merge, nicht in der Migration)

Grundlage: Detlevs Übersicht vom 23.08., 60 Zeilen, gegen PROD abgeglichen
(59 Treffer).

- [ ] 12.0 **[PR]** Den Abgleich als **zeilenweisen Beleg ins Repo** schreiben
      (`docs/age-581-mitgliederabgleich.md`): alle 60 Listeneinträge, alle 71
      Konten, jede Ausnahme, die erwarteten Endzahlen. Ein Beleg in einem
      Ablageordner ausserhalb des Arbeitsbaums ist für den nächsten Leser keiner.
- [ ] 12.1 `paid_until` aus dem Jahrestag: **nächstes** Vorkommen von Tag/Monat
      nach dem **festen** Stichtag `2026-08-23`, minus einen Tag. Nicht „heute"
      — sonst hängt das Ergebnis am Ausführungstag. Erst als Tabelle ausgeben
      und lesen, dann schreiben.
- [ ] 12.2 `payment_type` aus der Kategorie setzen (8 Werte, 60 Zeilen).
- [ ] 12.3 Die drei Stripe-Einträge, deren Übersicht als Jahrestag „Ohne"
      führt, behalten `paid_until = null`.
- [ ] 12.4 Zehn Anmeldeadressen auf die Listenfassung angleichen, über
      `admin-change-email`. **Drei ausgenommen und zu melden** (Begründung je
      Fall in `docs/age-581-mitgliederabgleich.md`): eine Adresse ohne `@`, eine
      bereits an eine andere Person vergebene, und die des zweiten Admins — bei
      ihm sperrte eine falsch gesetzte Adresse ihn aus genau der Fläche aus, auf
      der man sie korrigieren würde.
- [ ] 12.5 Die 11 Konten ohne Listeneintrag deaktivieren — über die **Edge
      Function**, nicht mit einem `update` auf `disabled_at`, sonst entsteht
      genau der halbe Zustand, den 4.5 beschreibt.
- [ ] 12.6 Bastian Niklas anlegen und sofort deaktivieren.
- [ ] 12.7 **[PR]** Vorher ein **Trockenlauf**, der die Umgebung nennt und die
      erwarteten Zahlen ausgibt; erst nach dem Lesen schreiben. Nachher zählen
      und gegen die Abnahme in AGE-581 halten.
