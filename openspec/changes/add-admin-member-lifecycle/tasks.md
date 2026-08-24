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
- [x] 3.4 **[PR]** Die Feed-Auskunft nimmt **Beitrags- und Kommentar-IDs**,
      nicht Profil-IDs, löst den Urheber selbst auf und wendet dabei dasselbe
      Sichtbarkeitsprädikat an. Eingabemenge begrenzt. Mit Profil-IDs wäre die
      Zusage „nur aus sichtbaren Beiträgen" eine Bitte an den Aufrufer statt
      einer Eigenschaft der Funktion.
      `former_member_entries(uuid[], uuid[])` in
      `20260823160000_former_member_entries.sql`, Rückgabe `(kind, entry_id,
      former)`, höchstens 200 IDs je Aufruf, EXECUTE nur bei `authenticated`.
      Achtzehn Zusagen in `member_lifecycle_test.sql` §7.
      **`former` ist `disabled_at is not null or deleted_at is not null` und
      NICHT `not is_activated_profile()`** — letzteres wäre auch für ein nie
      bestätigtes Konto wahr, und das wurde nicht entfernt, es ist nur nie
      angekommen. Ein Test hält genau diesen Unterschied fest.
      **Sie ist SECURITY DEFINER, also steht das Prädikat aus
      `posts_select_by_visibility` ein zweites Mal da.** SECURITY INVOKER wäre
      der Ausweg, bräuchte aber einen für `authenticated` ausführbaren Helfer
      „ist dieses Profil entfernt?" — genau der Aufzählungsweg, den der Review
      verworfen hat, eine Ebene tiefer. Die Kopie hält ein
      **Wortlaut-Wächter** über die Policy fest (§7.18); kein Verhaltenstest
      fände diese Drift, weil alle anderen Zusagen nur die Funktion rufen.
      **Der TypeScript-Typ fehlt noch** — bewusst: die Funktion hat vor
      Abschnitt 10 keinen Aufrufer, und `database.types.ts` ist handgepflegt.
      Vier Gegenproben: falsches Prädikat für `former`, aufgehobene
      Sichtbarkeit, abgeschaltete Obergrenze, ungebundene Kommentarseite —
      jede rot, jede Wiederherstellung grün. Plus eine fünfte auf den Wächter
      selbst: die Policy allein verbogen macht §7.18 rot.
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

- [x] 4.1 **RED:** die Edge Function antwortet ohne Admin-Session mit 401/403.
      Der rote Lauf war `deno test` gegen ein `ban.ts`, das es noch nicht gab;
      die Abwehr selbst ist in `scripts/probe-age581-ban-abnahme.ts` gemessen —
      ohne Kopfzeile 401, als Nicht-Admin 403, und das Ziel trägt danach kein
      `disabled_at`. Gemessen mit `--no-verify-jwt`, also **ohne** die
      Gateway-Prüfung: die Abwehr steht damit nachweislich IM Handler und nicht
      nur davor.
- [x] 4.2 Edge Function `admin-set-member-ban`. Liest `sub` aus dem
      **Gateway-geprüften JWT**, nicht über `getUser()`/`getClaims()` — beide
      scheitern unter den asymmetrischen Signierschlüsseln in PROD. `jwtSub`
      aus `checkout.ts` wiederverwendet, wie `admin-change-email` es tut.
      In `config.toml` mit `verify_jwt = true` eingetragen.
- [x] 4.3 Die Function prüft die Admin-Eigenschaft über eine DEFINER-RPC, nicht
      über einen Tabellenzugriff: `service_role` hält auf keiner
      `public`-Tabelle ein Recht, das scheitert erst zur Laufzeit.
      `is_admin_uid(actor)`, und `actor` kommt aus dem Token, nie aus dem Rumpf.
- [x] 4.4 **[PR] Reihenfolge je Richtung**, nicht pauschal:
      **Schliessen** = DB, dann Ban. **Öffnen** = Ban, dann DB. Andersherum
      wäre das Profil beim Öffnen sichtbar, während die Anmeldung noch gesperrt
      ist — und die Handlung verschwände aus der Oberfläche.
      Die Richtung steht als `istSchliessen()` in `ban.ts` samt Begründung; der
      Handler ruft „erster Schritt / zweiter Schritt" und nicht „DB / Ban".
      Daraus folgt der Zuschnitt von `fasseAusgangZusammen`: der ZWEITE Schritt
      ist in beiden Richtungen der, der einen halben Zustand hinterlassen kann.
- [ ] 4.5 **[PR]** Teilfehlschlag: Antwort **`207`** mit
      `{hidden: true, banned: false}`; die Fläche zeigt eine **Warnung**, keinen
      Erfolg; der Teilfehlschlag steht im `admin_audit`-`payload`.
      **Zwei von drei Hälften stehen und sind gemessen** (23.08., erzwungen
      durch eine unbrauchbare `ban_duration`): HTTP 207 mit
      `{hidden: true, banned: false, detail: …}`, `disabled_at` gesetzt, kein
      Bann, das Ziel meldet sich weiterhin an — und **zwei** Protokollzeilen,
      `disable_member` und `ban_failed`.
      **Abweichung von der Vorgabe, bewusst:** der Teilfehlschlag steht in einer
      EIGENEN Zeile und nicht im `payload` der ersten. Die RPC schreibt ihre
      Zeile in derselben Transaktion wie die Änderung an `disabled_at` — also
      bevor irgendwer wissen kann, ob der Bann gelingt. Sie nachträglich zu
      ändern hiesse, eine Protokollzeile zu überschreiben; ein Protokoll, das
      sich ändern lässt, ist keins. Die zweite Zeile behauptet keine zweite
      Änderung, sie hält fest, dass die erste halb blieb.
      **OFFEN ist die dritte Hälfte: die Warnung in der Oberfläche.** Sie
      gehört zum Zeilenmenü und wird in Abschnitt 7 gebaut.
- [x] 4.6 **[PR]** Der halbe Zustand ist **heilbar**: ist `disabled_at` gesetzt
      und der Ban fehlt, bricht ein erneutes Deaktivieren nicht mit `22023` ab,
      sondern setzt den Ban nach. Gilt gespiegelt fürs Öffnen.
      In der Abnahme gemessen: halber Zustand von Hand hergestellt, das Konto
      meldet sich darin wieder an, ein erneutes „deaktivieren" antwortet 200
      statt 409, der Bann steht wieder — und es bleibt bei EINER
      `disable_member`-Zeile, weil die Datenbank sich nicht geändert hat.
- [x] 4.7 Bann über `ban_duration: "876000h"`, Aufhebung über `"none"` —
      gemessen, nicht geraten (Entscheidung 9). Beides in `banDauerFuer()`, mit
      einem Test darauf: die Werte sind das Ergebnis einer Messung und dürfen
      nicht beiläufig umgeschrieben werden.
- [x] 4.8 **GREEN:** 4.1 läuft; ein Durchlauf gegen den lokalen Stack belegt,
      dass ein deaktiviertes Konto sich nicht mehr anmelden kann.
      `scripts/probe-age581-ban-abnahme.ts` — **25 von 25 Zusagen**, darunter
      die entscheidende: nach dem Deaktivieren antwortet der Anmeldedienst mit
      `400` und `user_banned`, es entsteht gar keine Sitzung. Vorher und
      nachher meldet sich dasselbe Konto an; ohne diese beiden Gegenproben
      bewiese „kommt nicht herein" nur, dass das Passwort falsch war.
      10 Deno-Tests über `ban.ts`, `deno check` über beide Dateien grün.
      Nebenbefund, in der Probe behandelt: `admin_audit.actor` verweist ohne
      `on delete cascade` auf `profiles`, ein Admin mit Protokollzeilen liess
      sich also nicht löschen — die Löschung scheiterte dabei still.

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

- [x] 7.1 **RED:** das Menü zeigt an einer deaktivierten Zeile „reaktivieren"
      und nicht „deaktivieren". Echter RED — die Schaltfläche „Handlungen"
      existierte nicht.
- [x] 7.2 Menükomponente, an `document.body` portaliert. **Drei Fallen, nicht
      zwei:** neben `.fbc-card:hover` (`transform`) und `<header>`
      (`backdrop-blur`) schnitte auch der `overflow-x-auto` der Tabelle ein
      `absolute` positioniertes Menü ab. Ein eigener Test hält die Ursache fest
      (`menue.parentElement === document.body`), weil kein Verhaltenstest sie
      fände.
- [x] 7.3 Rückfragen für Deaktivieren und Löschen, beide namentlich und mit der
      Folge („kann sich danach nicht mehr anmelden"). Die Rückfrage ist
      verallgemeinert statt verdoppelt; welche Handlungen eine brauchen, steht
      in `BRAUCHT_RUECKFRAGE` und wird vom Verteiler gelesen.
- [x] 7.4 Tastaturbedienung (Fokus ins Menü beim Öffnen, Pfeiltasten mit
      Umlauf, Escape schliesst und gibt den Fokus zurück) und Schliessen beim
      Verlassen — per Zeiger, per `focusout` und beim Scrollen.
- [x] 7.5 **[PR]** Matrix gespiegelt, kombinierte Zustände abgedeckt. Der
      Nachsetz-Weg für einen fehlenden Ban ist seit dem 24.08. erreichbar:
      `admin_list_members` liefert `gebannt` mit, und „Deaktivieren" erscheint
      an einer deaktivierten Zeile **genau dann, wenn der Ban fehlt**. Damit
      lösen sich zwei Delta-Zusagen auf, die sich vorher widersprachen (Details
      unter 7.7).
      **ABWEICHUNG, offen:** „serverseitig erzwungen" gilt für die VIER
      Lebenszyklus-RPCs, nicht für die beiden Aktivierungswege.
      `admin_activate_member` und `issue_activation_token` kennen
      `disabled_at`/`deleted_at` nicht — dort ist das Ausblenden im Menü heute
      die einzige Hürde. Das Gate hält weiter (ein gelöschtes Konto bliebe
      unsichtbar und gesperrt), der Schaden wäre ein falsches `activated_at`
      und eine irreführende Mail. Siehe „Offene Fragen" im Handoff.
      Zusätzlich nicht gespiegelt: dass ein Admin sich nicht selbst
      deaktivieren oder löschen kann — die Fläche kennt den Aufrufer hier
      nicht, die Datenbank weist es mit `22023` ab.
- [x] 7.6 **GREEN** (37 Zusagen in `AdminMitgliederPage.test.tsx`, 1385 Vitest
      gesamt), danach **Sichtprobe im Browser** gegen den lokalen Stack:
      - **Gegenprobe zuerst:** ein NICHT portaliertes `fixed; inset:0` in
        derselben Karte misst **361×154** statt **1688×1234** — die Falle
        schnappt zu, die Messung darunter misst also etwas.
      - Das portalierte Menü: **224×154**, `parentElement === BODY`, ganz im
        Ansichtsfenster, **alle** Einträge per `elementFromPoint` getroffen —
        in allen drei Sichten.
      - **Echter Durchstich** (Menü → Rückfrage → Edge Function → RPC +
        GoTrue): `disabled_at` UND `banned_until` gesetzt, **genau eine**
        `admin_audit`-Zeile (`disable_member`). Konsole ohne Fehler.
      - **Zwei Befunde, die nur die Sichtprobe fand:** der Auslöser streckte
        sich in der Kartensicht über die ganze Karte (`align-self: stretch`) —
        behoben mit `w-fit`; und die Rückfrage nannte den Namen zweimal
        („Carla Aktiv: Das Mitglied kann sich…") — er ist jetzt das
        Satzsubjekt.
      - Datengrundlage: `scripts/probe-age581-sichtprobe-daten.ts`
        (wiederholbar, nur gegen `127.0.0.1`).
      - **NACHTRAG 24.08. (Donald): „Aktionen" statt „Handlungen"** — Spaltenkopf,
        `aria-label` und die Bezeichner der Fläche. Das Delta behält sein Wort
        („Handlungen einer Zeile"): es beschreibt die Anforderung und beschriftet
        nichts, und die beiden Stellen, an denen der Code es wörtlich ZITIERT
        („keine Handlung, sondern eine Falle"), bleiben Zitat. Die Edge Function
        ist nicht mitumbenannt — andere Schicht, eigene Sprache.
      - **NACHTRAG 24.08. (Donald): drei Punkte statt eines Wortes.**
        Der Auslöser soll die Zeile nicht dominieren. Das Delta legt nur „eine
        Schaltfläche am Zeilenende" fest, nicht ihre Beschriftung — also keine
        Delta-Änderung. Der Name wandert damit vollständig ins `aria-label`:
        ohne es hiesse der Knopf für eine Vorleseausgabe „Schaltfläche", und
        das Symbol trägt `aria-hidden`. Eine eigene Zusage hält beides fest,
        gerichtet gegen den späteren Aufräum-Diff, der das Label entfernt, weil
        „das steht doch dran".
        `w-10` statt `w-9`, weil `size="sm"` `px-3` mitbringt: 40 − 24 lässt
        genau die 16 px des Symbols. Das Padding mit `px-0` zu überschreiben
        wäre der Fehler — `cn()` ist ein Join ohne `tailwind-merge`, über den
        Vorrang entschiede das Stylesheet und nicht das Attribut.
        Im Browser nachgemessen: 40×36 in allen drei Sichten, in der Kartensicht
        also weiterhin kein `align-self: stretch` (der Befund aus 7.6), Menü
        weiter am `body` und alle Einträge per `elementFromPoint` getroffen,
        Konsole ohne Fehler.

- [x] 7.7 **Diff-Prüfung (Stufe 4) und ihre Folgen.** Fünf Befunde gemeldet,
      vier davon bestätigt und behoben, einer war bereits bekannt (die Reiter
      aus Abschnitt 8). Auf die Prüfung hin gefunden und ebenfalls behoben:
      zwei Widersprüche IM DELTA und eine CI-Lücke.

  - **Der Auslöser konnte sein eigenes Menü nicht schliessen.** Im Browser
    bekommt ein `<button>` beim `mousedown` den Fokus; das `focusout` des
    Menüeintrags schloss, und der folgende `click` öffnete wieder. Mit echten
    CDP-Eingaben gemessen: `aria-expanded` blieb nach zwei Klicks `true`.
    Vierunddreissig grüne jsdom-Zusagen sahen es nicht, weil `fireEvent.click`
    den Fokus **nicht verschiebt**. Der neue Test stellt die Reihenfolge nach.
  - **Das Menü klappte nur nach unten.** 139 px Überstand an einer Zeile am
    unteren Rand, „Löschen" per `elementFromPoint` nicht getroffen — und weil
    es `fixed` liegt, nicht heranscrollbar (Scrollen schliesst es). Klappt
    jetzt nach oben; gemessen 1093–1211 bei Fensterhöhe 1234.
  - **Die Statusabbildung der Function kam nicht an.** supabase-js verpackt
    jedes Nicht-2xx in dieselbe englische Meldung. 403/404/409/502 werden jetzt
    übersetzt; 409 („ist schon so") ist der häufigste Ausgang und gar kein
    Fehler.
  - **`entbannen` hatte null Leser.** `admin_restore_member` rechnet aus, ob
    entbannt werden soll — die Function ignorierte es und entbannte
    **unbedingt zuerst**. Wer deaktiviert, dann gelöscht, dann wiederhergestellt
    wurde, war danach **deaktiviert und anmeldefähig**: genau der Zustand, den
    dieses Vorhaben verhindern soll, still und mit Erfolgston.

  - **ENTSCHEIDUNG (Donald, 24.08.): die Datenbank kommt in BEIDEN Richtungen
    zuerst.** *Warum:* die alte Regel („Öffnen: Ban zuerst") erzeugte zwei
    Zustände, die dasselbe Delta an anderer Stelle verbietet — den obigen, und
    „reaktivieren" auf ein gelöschtes Profil, das die Sperre aufhob, **bevor**
    die RPC mit `22023` ablehnte. Der Preis ist der umgekehrte halbe Zustand
    (sichtbar, aber ausgesperrt), und der ist über das Menü heilbar. Delta und
    `design.md`-Begründung sind mitgeändert; die Ordnungsregel ist damit eine
    **Änderung am Plan**, nicht eine nachträgliche Rechtfertigung des Codes.
  - **Folge: `207` heisst jetzt „verborgen und gesperrt stimmen nicht überein".**
    Beim Schliessen `{hidden: true, banned: false}`, beim Öffnen
    `{hidden: false, banned: true}` — nicht derselbe Zustand aus zwei
    Richtungen, wie die erste Fassung behauptete. Das Kriterium der Fläche ist
    entsprechend `hidden !== banned`; `hidden && !banned` hätte die zweite
    Hälfte als Erfolg durchgehen lassen.
  - **ENTSCHEIDUNG (Donald, 24.08.): `gebannt` kommt in die Liste**
    (`20260824100000_admin_member_list_ban.sql`). *Warum:* das Delta verlangte
    „fehlt der Ban, SHALL derselbe Aufruf ihn nachsetzen" UND „‚deaktivieren'
    SHALL NOT an bereits deaktivierten erscheinen". Zusammen war der
    Nachsetz-Weg über die Oberfläche unerreichbar — nach der eigenen
    Formulierung des Delta „keine Handlung, sondern eine Falle". Mit der Spalte
    gilt beides. Ein **abgelaufener** Ban zählt nicht; das hält ein eigener
    Wächter fest.
  - **CI-LÜCKE:** `member_lifecycle_test.sql` und
    `member_lifecycle_rpc_test.sql` (46k, beide vollwertiges pgTAP mit
    `plan()`) standen seit dem 23.08. im Repo und liefen **kein einziges Mal in
    CI** — sie fehlten in der Dateiliste von `ci.yml`, vor der der Kommentar
    darüber ausdrücklich warnt. Eingetragen; beide laufen grün.
  - **Belege:** 1399 Vitest (51 in `AdminMitgliederPage.test.tsx`), 601 pgTAP
    über sechs Dateien, 12 Deno. Acht weitere Mutations-Gegenproben über alle
    vier Schichten (Fläche, Modul, Function, Migration) — je rot, je
    Wiederherstellung grün. Dazu der echte Durchstich gegen den lokalen Stack:
    deaktivieren → löschen → wiederherstellen lässt `disabled_at` UND den Ban
    stehen (`bleibt_deaktiviert: true` im Protokoll), ein nur gelöschtes
    Mitglied wird entbannt, und „reaktivieren" auf ein gelöschtes antwortet
    `409`, **ohne die Sperre anzurühren**.
  - **OFFEN:** für eine GELÖSCHTE Zeile mit fehlendem Ban gibt es keinen
    Nachsetz-Weg — die Übergangstabelle bricht „löschen" dort in jedem Fall ab.
    Die Fläche erfindet keinen und verspricht in der Warnung auch keinen.

## 8. Frontend — Reiter

- [x] 8.1 **RED:** ein deaktiviertes Mitglied fehlt unter „Alle" und steht unter
      „Deaktiviert". Echter RED — `role="tab"` gab es nicht.
      Der Test filtert nicht selbst: `listeNachStatus` stellt die
      `case p_status`-Verzweigung der Migration nach. Ein Test nur auf die
      ÜBERGEBENEN Argumente sagte nichts über das, was ein Admin sieht; ein Test
      nur auf die sichtbaren Zeilen bestünde auch mit einer Fläche, die
      clientseitig filtert und die RPC unbehelligt lässt.
- [x] 8.2 Fünf Reiter, gewählter Reiter als Suchparameter in der Adresse
      (`?tab=geloescht`). **[PR]** Die Abbildung steht ausgeschrieben in
      `REITER` — „Mitgliedschaft" trägt `status: "alle"`, und dass `aktiviert`
      keinen Reiter hat, ist im Kopf der Tabelle benannt statt verschwiegen.
      Das Status-Auswahlfeld ist damit ersetzt, nicht ergänzt.
      **Der Reiter wird ABGELEITET, nicht gespiegelt:** kein `useState` daneben,
      sonst bliebe der zweite Ort beim Zurückgehen stehen. Ein unbekannter Wert
      in der Adresse fällt auf „Alle" zurück, statt `p_status` in die `22023`
      der Datenbank laufen zu lassen.
      Der Seitenrücksprung beim Reiterwechsel passiert WÄHREND des Aufbaus und
      nicht in einem Effekt — der Effekt liefe erst nach dem Zeichnen, also ginge
      dazwischen eine Abfrage mit dem alten `p_offset` hinaus, deren Ergebnis
      aufblitzt und im Zwischenspeicher landet. Ein eigener Test hält das fest.
- [x] 8.3 Die drei bestehenden Sichten bleiben innerhalb der Reiter erhalten —
      der Sichtzustand liegt ausserhalb der Reitertafel und wird beim Wechsel
      nicht angefasst. Im Browser gegengeprüft: Verzeichnis-Ansicht gewählt,
      Reiter auf „Gelöscht" gewechselt, Ansicht steht noch.
- [x] 8.4 **GREEN** (59 Zusagen in `AdminMitgliederPage.test.tsx`, 1407 Vitest
      gesamt), plus der Test, der von aussen navigiert: `createMemoryRouter`
      statt `MemoryRouter`, weil letzterer keinen Weg kennt, von aussen zu
      navigieren oder zurückzugehen. Vier Wege einzeln belegt — Klick schreibt
      in die Adresse, Aufbau liest sie, `navigate(-1)` nimmt den Reiter zurück,
      unbekannter Wert fällt auf „Alle".

- [x] 8.5 **Gegenproben und Sichtprobe.** Sechs Mutationen, je genau die
      zugehörige Zusage rot, danach wiederhergestellt grün:
      Rückfall in `leseReiter` entfernt (1 rot) · `leseReiter` liest die Adresse
      gar nicht (6 rot) · der Reiterklick schreibt nicht in die Adresse (5 rot) ·
      kein Seitenrücksprung (1 rot) · „Mitgliedschaft" auf `offen` abgebildet
      (1 rot) · der Reiterklick wirft die Sicht weg (1 rot).

  - **BEFUND DER SICHTPROBE, behoben:** `overflow-x-auto` setzt `overflow-y`
    implizit auf `auto`. Der 1px-Überstand des negativen Aussenabstands
    (`-mb-px`, aus `components/ui/Tabs.tsx` übernommen) genügte für einen
    VERTIKALEN Scrollbalken, der 15 px Breite frass — gemessen `clientWidth`
    1105 bei 1120 px Elementbreite, `scrollHeight` 34 bei `clientHeight` 33.
    Die graue Linie sitzt jetzt am Umschlag statt an der scrollbaren Leiste;
    danach `clientWidth` 1120 und `scrollHeight` gleich `clientHeight`.
    Kein Test hätte das gefunden: jsdom rechnet kein Layout.
  - **Im Browser belegt** (lokaler Stack, fünf Konten aus
    `scripts/probe-age581-sichtprobe-daten.ts`): „Alle" zeigt drei von fünf
    Konten — die deaktivierte und die gelöschte Zeile fehlen dort und stehen
    unter ihrem Reiter. Klick schreibt `?tab=deaktiviert`, ein NEULADEN behält
    ihn, die ZURÜCK-TASTE führt auf „Alle" zurück (echtes POP, nicht ein
    nachgestelltes). „Mitgliedschaft" zeigt dieselben drei wie „Alle".
    Das Zeilenmenü hängt weiterhin am `body` (224×46, ganz im Bild, Eintrag per
    `elementFromPoint` getroffen) — die neue Tafel-Hülle hat die Portal-Falle
    nicht wieder aufgemacht. Konsole ohne Fehler und Warnungen.
  - **OFFEN, nicht behoben:** in schmaler Sicht (gemessen bei 500 px — macOS
    gibt kein Fenster darunter her) läuft die Reiterleiste über und scrollt
    waagerecht; die Seite selbst läuft NICHT über, und der letzte Reiter ist
    durch Scrollen erreichbar und per `elementFromPoint` getroffen. Wer aber
    über `?tab=mitgliedschaft` direkt hereinkommt, sieht den gewählten Reiter
    nicht — die Leiste scrollt nicht von selbst dorthin. Ein `scrollIntoView`
    wäre billig, aber in jsdom nicht prüfbar; bewusst nicht gebaut.
  - **Der Inhalt von „Mitgliedschaft" folgt in Abschnitt 9.** Heute zeigt der
    Reiter dieselbe Darstellung wie „Alle" — dieselbe Menge ist zugesagt, die
    eigenen Spalten (Stufe, bezahlt-bis, Zahlungsart) sind es noch nicht.

## 9. Frontend — Reiter „Mitgliedschaft"

- [x] 9.1 **RED:** ein Mitglied ohne `paid_until` zeigt „unbekannt", kein Datum.
      Zwei Zeilen mit gegensätzlichem Befund, nicht eine — „unbekannt" allein
      wäre auch grün, wenn das Wort an JEDER Zeile stünde.
- [x] 9.2 Zeile mit Stufe, bezahlt-bis und Zahlungsart. **Stufe nur lesbar**,
      kein Eingabefeld (AGE-516). Als `TierBadge`, und die Zusage ist über die
      ZAHL der Auswahlfelder geprüft (genau eines, die Zahlungsart): ein
      Stufenfeld hätte unter jedem beliebigen Namen dieselbe Wirkung.
      **Die Felder stehen in ALLEN DREI Sichten**, nach derselben Regel wie
      `Zustand` (5.5) — im Verzeichnis NEBEN der Karte, weil die ein Link ist.
      Die Spalte kommt HINZU, sie ersetzt „Zustand" nicht.
- [~] 9.3 **Abweichung, begründet.** Der Plan sah `Controller` vor, gegen die
      Falle, dass ein `<select>` nach einem `reset()` still auf die erste Option
      zurückfällt. Gebaut ist `useState` **ohne `reset()`** — und ohne `reset()`
      gibt es die Falle nicht. Die acht Optionen sind eine Modulkonstante und
      stehen sofort da; sie können nicht nachwachsen. „Geändert" ist ein
      VERGLEICH gegen das Mitglied statt eines zweiten Zustands, also stellt das
      Nachladen die Zeile von selbst wieder sauber. `useForm` je Zeile hiesse
      25 Formularspeicher für zwei Felder. **Nicht abgenommen.**
- [x] 9.4 Speichern über `admin_update_profile`, nicht über einen direkten
      Tabellenzugriff — und **nicht** über `saveAdminProfile`, das einen Patch
      aus dreissig Feldern baut und jedes davon schreibt. Der Test prüft mit
      `toEqual` den GANZEN Patch (zwei Schlüssel), nicht `objectContaining`:
      die ganze Zusage ist, dass nichts sonst mitreist. Leer geht als `null`
      hinaus, nicht als `""` — die Funktion castet `paid_until` nach `date`.
- [x] 9.5 **GREEN** (1413 Vitest, 65 in dieser Datei), plus Sichtprobe gegen den
      lokalen Stack: bei „Carla Aktiv" 31.03.2027 + CopeCart gesetzt,
      gespeichert, in der Datenbank nachgelesen (`paid_until = 2027-03-31`,
      `payment_type = 'copecart'`), Seite neu geladen — der Wert steht noch da,
      „unbekannt" ist bei ihr weg und bei den beiden anderen noch da, und der
      Knopf ist wieder aus. Gegenprobe: der Reiter „Alle" trägt weiterhin vier
      Spalten und kein einziges Feld. Konsole stumm.
- [x] 9.6 **Sechs Mutations-Gegenproben**, je genau die zugehörige Zusage rot,
      danach wiederhergestellt grün: „unbekannt" entfernt · ein geratenes Datum
      vorbelegt · die Stufe zum Auswahlfeld gemacht · ein drittes Feld in den
      Patch · den `null`-Umweg entfernt · den Knopf immer aktiv.
      **Die vierte Gegenprobe war beim ersten Versuch falsch gezielt** — ein
      Zusatzschlüssel im ARGUMENT erreicht den Patch gar nicht, weil
      `updateMitgliedschaft` ihn selbst baut — und blieb grün. Erst die
      Verbiegung IM Patch war rot. Eine grüne Gegenprobe heisst zuerst „falsch
      gezielt", nicht „der Test prüft nichts".

- [x] 9.7 **Nachträge (Donald, 24.08.).** Drei Stück, alle mit RED zuerst:

  1. **„unbekannt" ist weg.** Neben dem „nicht erfasst" des Auswahlfeldes war
     es dieselbe Aussage ein zweites Mal — und weil es nur an den LEEREN Zeilen
     erschien, verschob es dort die folgenden Felder um seine eigene Breite.
     **Das Spec-Delta ist mitgeändert**, samt Begründung im Text: die
     ursprüngliche Fassung war für eine reine Anzeige geschrieben, im Reiter
     steht dort aber ein Eingabefeld. Die eigentliche Zusage — es wird nichts
     vorbelegt — hing nie an dem Wort und wird weiter geprüft. Der
     Szenario-TITEL bleibt unangetastet (ein umgetaufter Titel löscht beim
     Archivieren den alten).
  2. **Die Tabelle bekommt vier eigene Spalten** statt einer Sammelzelle. In
     einer Tabelle fluchten Felder, weil sie in derselben Spalte stehen — nicht,
     weil sie zufällig gleich breit sind. Karten und Verzeichnis tragen
     stattdessen ein zweispaltiges Raster Aufschrift : Feld, das in einer
     schmalen Karte nicht umbricht.
  3. **`payment_type` in der Einzelbearbeitung** (`/admin/mitglied/:id`), wo
     `paid_until` schon stand. Drei Stellen in `admin-profile.ts` (Typ,
     Lesepfad, Patch) plus das Feld. `admin_get_profile` gibt die Altdatenzeile
     als `to_jsonb(l)` zurück und zählt keine Spalten auf — die Spalte kam also
     längst an, es fehlte nur der Weg ins Formular. **Keine Migration.**

  **Ein stiller Fehlschlag dabei, benannt:** die Ersetzung der
  Spaltenüberschriften lief ohne `assert` und traf ihr Muster nicht (Prettier
  hatte die Zeile vorher zusammengezogen). Ergebnis waren VIER Überschriften
  über ACHT Zellen — jsdom grün, und im Browser stand „Aktionen" über dem
  Datumsfeld. Gefunden hat es die Sichtprobe. Der Test dagegen zählt jetzt
  Überschriften GEGEN Zellen.

  **Sechs weitere Gegenproben**, je rot: Lesepfad ohne Zahlungsart · Patch ohne
  Zahlungsart · leer als `""` statt `null` · eine fehlende Spaltenüberschrift ·
  „unbekannt" zurückgeholt · das Auswahlfeld der Einzelbearbeitung entfernt.

  **Sichtprobe, beide Richtungen:** in der Liste gesetzt → in der
  Einzelbearbeitung sichtbar; dort auf „Rechnung" geändert und gespeichert →
  in allen drei Sichten der Liste sichtbar, `paid_until` unverändert. Konsole
  stumm. (Das Speichern der Einzelbearbeitung scheiterte zunächst an ihrer
  eigenen Pflichtprüfung — „Kurzbeschreibung ist erforderlich" — - das ist
  bestehendes Verhalten der Seite, nicht Folge dieser Änderung.)

- **Offen aus Abschnitt 9:** in der Kartensicht stehen „Speichern" und das
  Zeilenmenü auf zwei Zeilen untereinander; tragbar.

## 10. Feed — „Ehemaliges Mitglied"

- [x] 10.1 **RED:** ein zurückgezogener Autor heisst „Ein Mitglied", ein
      entfernter „Ehemaliges Mitglied" — **beide im selben Test**, sonst prüft
      er die Unterscheidung nicht.
      *Vorher entschieden (Donald, 24.08.): der CODE folgt dem Delta.* Der
      Rückfall in `authorOf` hiess „Mitglied"; er heisst jetzt „Ein Mitglied",
      wie die Maskierung in `displayAuthor` (AGE-530) — es ist derselbe
      Sachverhalt. Der Rest des Hauses (Chat, Events, Verzeichnis, Matching …)
      schreibt weiterhin `?? "Mitglied"`: die Unterscheidung wird im Feed
      gebraucht, und nur dort steht ihr Gegenstück.
- [x] 10.2 Die Auskunft im Feed aufrufen, nur mit Session.
      `fetchFormerEntries` kehrt ohne `uid` sofort um; ein Test misst das am
      RPC-NAMEN, nicht am Aussehen.
- [x] 10.3 Kein Verweis auf ein Profil für entfernte Autoren.
      Über `masked` in `displayAuthor` — die Karte hängt Verweis, Bild und
      Stufenplakette schon daran auf. Der Nachweis steht als
      **Komponententest** (`CommunityFeed.test.tsx`), nicht in der
      Datenschicht: die Zusage hängt an gerendertem Markup, und ein Test auf
      einen Wahrheitswert wäre auch dann grün, wenn die Karte weiterverlinkte.
- [x] 10.4 **[PR]** Auch **Kommentarautoren** neutralisieren, nicht nur
      Beitragsautoren — ein Faden, in dem nur die Beiträge neutral sind, hält
      die Zusage nicht.
      Dabei gefunden: `fetchComments` holt ALLE Kommentare eines Beitrags,
      ungedeckelt — die Funktion nimmt höchstens 200 IDs. Deshalb fragt der
      Client in Blöcken; ein einziger Aufruf mit 201 IDs käme als `22023`
      zurück und nähme dem GANZEN Faden die Unterscheidung.
- [x] 10.5 **GREEN.** 1425 Vitest (128 Dateien), Typecheck und Lint sauber.
      Vier Gegenproben, je die zugehörige Zusage rot, danach wiederhergestellt
      grün. Sichtprobe im Browser gegen den lokalen Stack: alle vier Fälle
      nebeneinander, Konsole ohne Fehler.

## 11. Abnahme

- [x] 11.1 `supabase test db` mit ausdrücklicher Dateiliste, alle grün.
      **601 Zusagen, sechs Dateien**, `Result: PASS`. Die Liste ist keine
      Bequemlichkeit: ohne sie zieht der Befehl die elf `probe_*.sql` mit, die
      kein pgTAP sind, und meldet FAIL, obwohl alles grün ist.
- [x] 11.2 `pnpm verify` grün; **nicht** `pnpm format` — es schreibt rund
      sechzig fremde Dateien um.
      *`pnpm verify` gibt es in diesem Repo nicht* — gemeint sind die vier
      Einzelgates, und die sind grün: `lint` (0 Fehler, 4 bekannte
      `react-refresh`-Warnungen), `typecheck`, `test` (1425 Zusagen, 128
      Dateien), `build`. Prettier lief nur über die eine Datei, die es brauchte.
- [x] 11.3 `openspec validate --all` grün. **31 von 31.**
- [x] 11.4 `grants_test.sql` grün (laut 1.3 ohne Nachziehen — falls doch, hier
      vermerken warum).
      **Ohne Nachziehen grün, wie in 1.3 vorhergesagt.** Der Change hat keine
      neue Tabelle mit Table-Grant angelegt — `former_member_entries` ist eine
      Funktion, und Funktions-Grants berührt der Golden-Snapshot nicht.
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
