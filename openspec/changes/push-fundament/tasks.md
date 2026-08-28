# Aufgaben — Push-Fundament (AGE-641)

> ## Stand 28.08., vormittags
>
> **Phase A ist bis auf die Abnahme gebaut.** A1–A4 und A5b stehen seit dem
> 27.08.; A5 ist am 28.08. dazugekommen, samt einer Reparatur an A5b.
>
> **APNs ist seit dem 28.08. eingerichtet und gemessen.** Der Zugangsweg
> antwortet an Sandbox **und** Produktion mit `400 BadDeviceToken` — Apple
> authentifiziert uns, nur das erfundene Gerätetoken wird verworfen. Damit sind
> `apnsJwt`, die PEM-Einlesung, die Kopfzeilen und `bewerteApns` gegen den
> echten Anbieter belegt.
>
> **FCM ist seit dem 28.08. ebenfalls eingerichtet und gemessen.** Firebase-
> Projekt `effbeezee-f9b48`, Dienstkonto-JSON in Infisical `dev`. Gegen das
> echte FCM: `400 INVALID_ARGUMENT` — authentifiziert, nur das erfundene
> Gerätetoken verworfen.
>
> **Beide Anbieter sind damit belegt.** Von A5 bleibt allein die Zustellung an
> ein ECHTES Gerät offen, und die hängt an AGE-642 B1.
>
> **Korrektur an dieser Liste:** A4 nannte die RPCs `push_zustellung_daten` und
> `push_token_entfernen`. Gebaut und gemessen sind
> `push_auftraege_holen`, `push_auftraege_faellig` und
> `push_zustellung_quittieren` — die Migration ist die Wahrheit, nicht dieser
> Text.

Zwei Phasen mit einem ausdrücklichen Halt. **Phase B beginnt erst, wenn
AGE-642 gemergt ist** — vorher gibt es kein Gerätetoken zu registrieren.

Gegen welches Projekt gearbeitet wird, steht vor jedem schreibenden Befehl:
DEV ist `fbc-platform` / `foelowldexkcqzewvrcf` (linked), PROD ist
`fbc-platform-prod` / `viwntbodrtqxgmqyxluh`. Lokal zuerst, dann DEV, PROD
zuletzt und nur über `migrate-prod`.

Aufgaben mit **(R1)** / **(R2)** stammen aus der Plan-Review, nicht aus dem
Issue. Siehe `REVIEWS.md`.

---

## Phase A — Serverseite

### A1 · Umbenennung `notify_inapp_*` → `notify_app_*` ✅

- [x] **RED**: die zwei pgTAP-Dateien auf die neuen Spaltennamen gezogen —
      Fehlermeldung nannte `notify_app_post` namentlich, nicht bloß „schlug fehl".
- [x] Migration `20260827200000_notify_app_umbenennung.sql`: vier
      `rename column`, plus `notify_app_message` und `notify_app_contact`.
- [x] `hinweis_erwuenscht` auf alle acht Typen gezogen, für keine Client-Rolle
      ausführbar geblieben.
- [x] **(R1)** `handle_contact_request_change()` an den Schalter verdrahtet.
      Ohne das war `notify_app_contact` Zierrat: der Juni-Trigger schrieb
      unbedingt. Match-Status, Routing-Queue und Gesprächsfaden bleiben
      **unbedingt** — ein Opt-out auf Hinweise darf keine Daten verschlucken.
      Neu gefasst wurde die **geltende** Version (`20260614120000:133`), nicht
      die davon ersetzte, die die Review zitierte.
- [x] **(R1)** Der Freitext (`message`) verlässt die Kontaktanfrage-Nutzlast.
      Die Glocke las ihn nie (`HinweisGlocke.tsx:166-168`).
- [x] `member-settings.ts`, `database.types.ts` (von Hand), `EinstellungenPage.tsx`
      (acht Bezeichner + zwei neue Schalter).
- [x] **GREEN**: 17 pgTAP-Dateien / 877 Zusagen, 173 Testdateien / 1961 Zusagen,
      `typecheck` sauber. Gegenprobe für beide Hälften mit `cp`-Sicherung.

### A2 · `push_tokens` ✅

- [x] **RED**: `push_tokens_test.sql`. Zusagen: eigene Token lesbar · fremde
      **nicht** · fremde nicht änderbar · fremde nicht löschbar · ein Token mit
      fremder `profile_id` lässt sich nicht anlegen (`with check`) · zwei Geräte
      je Mitglied möglich · `token` bleibt eindeutig · `on delete cascade`.
      `alike()` statt `like()`; ein fremdes UPDATE ergibt **null Zeilen**, nicht
      `42501`.
- [x] Migration: Tabelle mit `plattform` (`check in ('ios','android')`) und
      `letzter_kontakt` — **(R2)** beide standen bisher nur in den Aufgaben und
      in keiner Anforderung. RLS owner-only für alle vier Verben, **Grants
      ausdrücklich ausgesprochen** (AGE-312).
- [x] **(R2)** `claim_push_token(token, plattform)` als DEFINER-RPC statt eines
      gewöhnlichen Inserts. Sonst strandet ein Token beim Kontowechsel: schlägt
      die Abmelde-Aufräumung fehl, kann Konto B die Zeile von A wegen der
      globalen Eindeutigkeit nicht anlegen und wegen owner-only nicht
      übernehmen — und A's Hinweise gingen an ein Gerät, das B benutzt.
      Zusage: nach fehlgeschlagener Aufräumung und Anmeldung als B gehört das
      Token B.
- [x] `grants_test.sql`: Golden-String **und** Spalten-Grants-Zusage nachziehen.
      Die Zeile landet alphabetisch zwischen `profiles_public` und
      `release_entry_skips` — genau dort, wo der Web-Strang gerade geschrieben
      hat. Konflikt erwarten.
- [x] `ci.yml`: die neue pgTAP-Datei in die Dateiliste. Ohne Liste **lügt**
      `supabase test db`.
- [x] Commit.

### A2b · **(R2)** Den ungenutzten Schreib-Grant entziehen ✅

- [x] **RED**: Zusage, dass `authenticated` auf `notifications` **kein**
      `insert` und **kein** `delete` mehr hält.
- [x] `revoke insert, delete on public.notifications from authenticated`.
      Gemessen: `grep 'from("notifications")' src/` findet **keinen** Insert —
      der Grant ist ungenutzt. Ohne den Entzug kann jedes aktivierte Mitglied
      sich selbst beliebig viele Zeilen schreiben und ab Phase B damit beliebig
      viel Push-Arbeit erzeugen (Kontingent bei FCM/APNs).
- [x] `grants_test.sql` nachziehen — **zweite** Berührung des Golden-Snapshots.
- [x] Commit.

### A3 · Fünfter Typ `message` ✅

- [x] **RED**: eine neue Nachricht schreibt dem **Gegenüber** eine Zeile, dem
      Absender **keine**; die Zeile trägt Absendername und Gesprächs-Kennung und
      **keinen Nachrichtentext**; abgeschaltetes `notify_app_message` schreibt
      nichts; ein nicht aktiviertes Konto bekommt nichts.
- [x] Migration: Trigger `trg_hinweis_nachricht` auf `messages` (after insert).
      Gespräche sind eins-zu-eins (`specs/messaging/spec.md:3`) — ein Gegenüber
      je Nachricht ist richtig.
- [x] `HinweisGlocke.tsx`: Renderer für `message`, **(R2)** samt Ziel auf den
      Gesprächsfaden. Ein Hinweis, der sich nicht öffnen lässt, ist eine
      Sackgasse. Kein Rohtyp in der Anzeige.
- [x] **GREEN**. Commit.

### A4 · `push_routing` und die Zustell-RPCs ✅

- [x] **RED**: keine Client-Rolle hält `execute`; keine Client-Rolle liest
      `push_routing`; ein deaktiviertes Konto liefert **null** Token, auch mit
      Token in der Tabelle; ein Typ **ohne** Zeile in `push_routing` liefert
      nichts.
- [x] `push_routing (type text primary key, push boolean not null)`. Gesetzt:
      `message` und die drei `contact_request*` auf `true`; `post_created`,
      `comment_on_post`, `like_on_post`, `event_created` und **`release_note`**
      auf `false`. `event_created` wegen der vertagten Bündelung,
      `release_note` weil der eine Typ ohne Abschalter niemandem aufs Gerät
      gehört.
- [x] `push_zustellung_daten(notification_id)` und
      `push_token_entfernen(token)`, beide SECURITY DEFINER,
      **(R2)** `set search_path = ''`, **(R1)** `revoke` von den Client-Rollen
      **und** `grant execute to service_role` — das Vorbild steht in
      `20260827100000:124-127`. Ohne den Grant scheitert die Function zur
      Laufzeit.
- [x] **(R1)** Auch das Löschen toter Token läuft über die RPC. Es stünde sonst
      auf derselben `service_role`-Tabellenrechte-Eigenschaft, die für das Lesen
      ausdrücklich verworfen wurde.
- [x] **GREEN**. Commit.

### A5 · Edge Function `send-push` ⚠️ gebaut, gegen keinen echten Anbieter gemessen

- [x] Webhook-Auth über gemeinsames Geheimnis wie `notify-contact-request`
      (`verify_jwt=false`). Kein `getUser()`/`getClaims()` — beide scheitern
      unter ES256.
      **Korrektur vom 28.08.:** dieser Haken war nur halb wahr. Der Kopf von
      `index.ts` nannte `verify_jwt=false` und verwies auf `config.toml` — dort
      stand kein Block für `send-push`, also galt die Vorgabe `true`. Das
      Gateway hätte den Webhook mit **401** abgewiesen, bevor die
      Geheimnisprüfung im Handler je läuft. Block ergänzt, plus
      `scripts/functions-config.test.ts` als Wächter: jede Function auf der
      Platte braucht einen Block, und ein auskommentierter zählt nicht.
- [x] **(R1)** Die Benachrichtigung wird aus einer **festen Feldliste** gebaut,
      nie aus durchgereichter Nutzlast. Stärker als geplant umgesetzt:
      `baueBenachrichtigung` nimmt drei Felder entgegen (`typ`, `wer`,
      `ziel_id`) und hat gar kein Feld, aus dem sich Freitext ziehen liesse.
      Die Zusage steht trotzdem als Test — auch untergeschobener Freitext
      erreicht keinen der drei Ausgänge.
- [x] FCM und APNs; dauerhaft abgelehnte Token weg, vorübergehende Fehler nicht.
      **Schärfer als geplant:** alles Unbekannte gilt als vorübergehend, und
      401/403 ausdrücklich auch — ein abgelaufener Schlüssel darf nicht in
      einem Lauf den ganzen Tokenbestand löschen.
- [x] Tests: die fünf Zusagen sind anbieterunabhängig. Drei davon (`push=false`,
      unverzeichneter Typ, abgeschalteter Schalter, deaktiviertes Konto) liegen
      in `push_zustellung_test.sql` — sie sind Eigenschaften der RPC, nicht des
      Transports. „Keine Nutzlast im Text" steht zusätzlich in
      `nachrichten.test.ts`. **32 Deno-Zusagen**, jede mit Gegenprobe belegt.
- [x] **APNs-Secrets nach Infisical `dev`.** `APNS_KEY_P8`, `APNS_KEY_ID`,
      `APNS_TEAM_ID`, `APNS_BUNDLE_ID` (`com.effbeezee.app`), `APNS_SANDBOX=1`.
      Derselbe `.p8` gehört später byte-gleich nach `prod` — Apple kennt keinen
      umgebungsspezifischen Auth-Key —, dort aber **ohne** `APNS_SANDBOX`.
- [x] **APNs gegen den echten Anbieter gemessen.** Sandbox und Produktion
      antworten `400 BadDeviceToken` auf ein erfundenes Token: authentifiziert,
      nur das Token verworfen. Belegt damit `apnsJwt`, `importierePkcs8`, die
      Kopfzeilen, den Anfragekörper und `bewerteApns` an echten Antworten.
      Falle dokumentiert: App-Store-Connect-Schlüssel heissen genauso
      (`AuthKey_<KEYID>.p8`) und liefern an jedem Topic `403`.
- [x] **FCM-Secret nach Infisical `dev` und gegen den echten Anbieter
      gemessen.** `FCM_SERVICE_ACCOUNT` (Projekt `effbeezee-f9b48`); die
      Projekt-ID liest der Code aus dem JSON. Antwort auf ein erfundenes Token:
      `400 INVALID_ARGUMENT` statt `401 UNAUTHENTICATED` — belegt damit
      `googleZugangstoken` (RS256-Signatur, PKCS#8-RSA-Einlesung, der
      OAuth2-Tausch), `fcmEndpunkt`, `fcmKoerper` und `bewerteFcm` an einer
      echten Antwort. Nebenbei belegt: die FCM-API ist im Projekt aktiviert,
      sonst käme ein 403.
      Falle dokumentiert: Google sperrt in Workspace-Organisationen das Anlegen
      von Dienstkontoschlüsseln per Vorgabe — **zwei** Richtlinien
      (`iam.disableServiceAccountKeyCreation` und die `iam.managed.`-Variante)
      müssen projektweit auf „nicht erzwungen".
- [ ] **`prod`-Umgebung befüllen** — bewusst zurückgestellt, solange es keine
      Produktions-App gibt. Steht in `docs/secrets.md`.
- [x] Commit.

### A5b · **(R2)** Dauerhafter Zustellzustand

Donald am 27.08.: **bauen**, nicht bestmüht zustellen. Ein verlorener Push wäre
zwar nicht der verlorene Hinweis — der steht weiter in der Glocke —, aber die
Doppelzustellung bei einem Betriebs-Replay ist die peinlichere Hälfte, und
beides fällt mit derselben Mechanik.

- [x] **RED**: ein Anbieter-5xx lässt die Zeile auf „offen" mit erhöhtem
      Zähler stehen · ein zweiter Lauf über dieselbe `(notification_id,
      token_id)` stellt **nicht** zweimal zu · zwei gleichzeitige Läufe greifen
      sich dieselbe Zeile nicht doppelt · ein dauerhaft abgelehntes Token
      beendet den Vorgang, statt ihn zu wiederholen.
- [x] Tabelle `push_zustellungen`, Primärschlüssel `(notification_id, token_id)`
      — der Schlüssel **ist** die Idempotenz. Zustand, Versuchszähler,
      nächster Versuch.
- [x] Anspruch atomar: `update … set zustand = 'laeuft' where zustand = 'offen'
      … returning`. Kein `select`-dann-`update`; zwei Läufe holten sonst
      dieselbe Zeile.
- [ ] **Wiederholung über `pg_cron`.** Gemessen: lokal verfügbar (1.6.4), nicht
      installiert; es gibt **keinen** zeitgesteuerten GitHub-Workflow, in den
      man das sonst legen müsste — und eine zustellkritische Schleife gehört
      ohnehin nicht in die CI. Der Drift-Scanner sieht das nicht: er prüft
      Funktionen, Trigger, Tabellen und Policies in `public`
      (`db-drift-scan.ts:73-100`), keine Extensions und nichts im
      `cron`-Schema.
- [ ] ⚠️ **Zuerst auf DEV messen, dann PROD.** `create extension pg_cron` ist
      ein Eingriff in die Instanz, und der lokale Stack ist darin nicht von
      PROD unterscheidbar — `postgres` hat hier andere Rechte. Schlägt es auf
      DEV fehl, ist das die Stelle zum Umplanen, nicht PROD.
- [x] Zurückgestellte Zeilen aufräumen: was nach N Versuchen nicht zugestellt
      ist, wird beendet und nicht ewig wiederholt. Gilt seit A5c auch für
      Aufträge, die nie quittiert wurden.
- [x] Commit.

### A5c · Der Anspruch bekommt eine Frist — Reparatur an A5b ✅

Beim Verdrahten von A5 aufgefallen, nicht von einer Review gemeldet: `holen`
setzt die Zeile auf `laeuft`, nur die Quittung holt sie da heraus, und
`faellig` suchte ausschliesslich nach `offen`. Ein Lauf, der dazwischen
abbricht — Zeitlimit, Deploy mitten im Lauf —, liess den Auftrag **für immer**
liegen. Damit war der Push endgültiger verloren als ganz ohne Zustellzustand:
dort hätte ein erneuter Webhook-Aufruf ihn wenigstens noch einmal versucht.

- [x] **RED**: ein beanspruchter, nie quittierter Auftrag mit abgelaufener
      Frist wird wieder eingesammelt. Gemessen rot (Zusage 20), mit
      Positivkontrolle daneben.
- [x] Migration `20260828100000`: `naechster_versuch` wird beim Beanspruchen
      auf `now() + 5 min` gestellt; `faellig` liest `zustand in ('offen',
      'laeuft')`; ein zurückgeholter Anspruch zählt als Versuch und fällt unter
      dieselbe Fünfergrenze; der Teilindex deckt beide Zustände.
- [x] Delta-Spec: Klausel und zwei Szenarien in „Push ist ein zweiter
      Transport".
- [x] **GREEN**. Commit.

### A6 · Abnahme Phase A

> ⚠️ **Der PROD-Webhook muss stehen, bevor `migrate-prod` läuft — nicht schon
> vor dem Merge.** Gemessen am 28.08.: der **Objekt**-Drift-Scan hängt allein in
> `migrate-prod.yml`; `deploy.yml` führt nur das **Migrations**-Drift-Gate. Der
> Merge ist also gefahrlos. Danach aber gilt: seit dem Drift-Scan-Commit
> erwartet `ERWARTET_OHNE_MIGRATION` den Namen `notifications_push_webhook`,
> und fehlt der Webhook in PROD, bricht `migrate-prod` ab. Weil `deploy.yml`
> bis dahin ohnehin am Migrations-Gate hängt, bleibt der Frontend-Deploy dann
> **stumm** aus. Die Liste wirkt in beide Richtungen: vorher war ein
> vorhandener, unbekannter Webhook rot, jetzt ein fehlender, erwarteter.

- [x] `openspec validate --all` grün — 33/33.
- [x] Volle pgTAP-Läufe mit der Dateiliste aus `ci.yml`, Ausgabe gelesen:
      **19 Dateien / 923 Zusagen, PASS**. Vorher geprüft, dass der geteilte
      lokale Stack genau diesen Branch trägt — jede Migration `local` ==
      `remote`, `20260828100000` eingeschlossen. Ohne diese Probe belegt der
      Lauf nichts: eine fremde Sitzung kann den Stack mitten in der Messung
      leeren.
- [x] `pnpm test` (**175 Dateien / 1971 Zusagen**) und `pnpm typecheck` sauber,
      dazu `deno test` (**122 Zusagen**) und `deno check` über alle Functions.
      Formatiert wurde dateiweise mit `prettier --write <pfad>` — **nie**
      `pnpm format`.
- [ ] **Webhook in der DEV-Konsole** eingetragen und ausgelöst — Beleg ist eine
      Zeile im Function-Log, nicht ein 2xx an den Aufrufer. `send-push`
      antwortet auch `200`, wenn es nichts zuzustellen gab.
      Name, Tabelle, Ereignis und Kopfzeile: `docs/secrets.md`, Abschnitt
      „Den Webhook eintragen".
- [ ] **(R2) Webhook in der PROD-Konsole** — eigener Punkt, nicht mitgemeint.
      Derselbe Name. Spätestens **vor** dem `migrate-prod`-Dispatch, sonst
      bricht dort der Objekt-Drift-Scan ab. Dazu `PUSH_WEBHOOK_SECRET` in
      `prod` — die Anbieter-Secrets dürfen leer bleiben.
- [x] **(R2) Drift-Scan nachgezogen.** Der Webhook heißt
      **`notifications_push_webhook`** — der Name ist damit festgelegt und muss
      in beiden Konsolen exakt so stehen. `ERWARTET_OHNE_MIGRATION` ist dabei
      von `db-drift-scan.ts` nach `db-drift-scan.logic.ts` gewandert: das
      Skript baut schon **beim Import** eine Datenbankverbindung auf, von dort
      war die Liste nicht prüfbar. Die zwei neuen Zusagen lesen die
      **ausgelieferte** Liste, keine Kopie — RED gemessen, dann GREEN; die
      Positivkontrolle nannte den fehlenden Namen beim Namen. Dazu die
      Wiederherstellungs-Vorlage in `docs/secrets.md`, auf die die
      Fehlermeldung des Scans verweist — für `send-push` fehlte sie ganz.
- [ ] PR gegen `main`, vier Pflichtchecks grün, `gh pr view --json state`
      nachgeschoben.
- [ ] Nach dem Merge: `migrate-prod`.

---

## ⏸ HALT — hier läuft AGE-642

Phase B beginnt erst danach.

> **(R2)** merkt an, dass ein zur Hälfte gemergter Change dem
> Ein-Change-ein-PR-Lebenszyklus widerspricht, und schlägt Phase B als
> abhängigen eigenen Change vor. Der Schnitt ist Donalds ausdrückliche
> Entscheidung vom 27.08. und wird nicht eigenmächtig gedreht — die Anmerkung
> steht hier, damit sie nicht verlorengeht.

---

## Phase B — Clientseite (nach AGE-642)

- [ ] `@capacitor/push-notifications`; Registrierung über `claim_push_token`,
      `letzter_kontakt` bei jedem Start.
- [ ] Erlaubnis-Dialog **nicht beim ersten Start**, sondern wenn er erklärbar
      ist — nach der ersten Nachricht. Wer beim Kaltstart gefragt wird, sagt
      nein, und iOS fragt kein zweites Mal.
- [ ] Abmelden entfernt das Token des Geräts. **(R2)** Und der Fall, dass genau
      das fehlschlägt, ist getestet: das nächste Konto übernimmt das Token.
- [ ] Zustellung auf **echtem** Android- und **echtem** iOS-Gerät gemessen, im
      Vordergrund, Hintergrund und bei geschlossener App.
- [ ] **Sichtprobe am Sperrbildschirm**: „… hat dir geschrieben", kein Text.
      Bildschirmfoto als Beleg — die Zusage ist sonst unbelegt.
- [ ] Opt-out je Typ am Gerät nachgewiesen.
- [ ] Ungültiges Token wird nach Ablehnung entfernt.

## Offen, gehört Donald und Detlev

- [ ] **Abschnitt 4 ist mit Detlev abzustimmen.** Bis dahin steht die Liste als
      Zeilen in `push_routing` und ist ohne Deploy änderbar.
- [ ] **Zustellzustand (R2/M5)** — siehe A5.
- [ ] Bündelung für `event_created` — eigener Vorgang.
- [ ] Der tote `member_joined`-Zweig (`HinweisGlocke.tsx:172`) — eigener Vorgang.
