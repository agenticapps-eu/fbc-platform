# Aufgaben — Push-Fundament (AGE-641)

> ## Stand 28.08., nachmittags — Phase A ist vollständig
>
> **PR #265 ist gemergt (`ebe64da`), `migrate-prod` ist durch, der Frontend-Deploy
> nachgezogen.** Der Serverweg ist auf DEV **und** PROD gemessen, nicht behauptet:
>
> | | DEV | PROD |
> | --- | --- | --- |
> | Migrationen | ✅ | ✅ 6 angewendet |
> | `send-push` ausgeliefert | ✅ | ✅ gleiche `ezbr_sha256` |
> | Webhook-Paar | ✅ | ✅ |
> | richtiger Bearer | `200 {"skipped":true}` | `200 {"skipped":true}` |
> | falscher Bearer | `401 Unauthorized` | `401 Unauthorized` |
> | `pg_cron`-Wiederholung | ✅ | ✅ |
>
> **Der letzte offene Punkt der Phase A ist erledigt: `pg_cron` steht auf beiden
> Seiten** (A5b). Extension 1.6.4 installiert, `public.push_wiederholung()`
> angelegt, Job `push-wiederholung` **jede Minute**. Belegt ist beides getrennt,
> weil `net.http_post` asynchron
> ist und ein `succeeded` im Job-Protokoll nur heisst, dass das SQL lief: der
> **Rumpf** über eine neue Zeile in `net._http_response` gegen eine vorher
> festgehaltene `max(id)`, der **Takt** über einen echten cron-Lauf (auf DEV
> 11:30:00.086Z Job-Start, 11:30:00.136Z Antwort `200 {"skipped":true}`).
>
> **Archiviert wird trotzdem nicht** — der Change trägt auch Phase B, und die
> beginnt erst mit AGE-642. Offen ist dort alles, hier nichts.
>
> **Beide Anbieter sind gegen ihre echten Endpunkte belegt.** APNs Sandbox und
> Produktion `400 BadDeviceToken`, FCM `400 INVALID_ARGUMENT` — authentifiziert,
> nur das erfundene Gerätetoken verworfen. Was fehlt, ist ein echtes
> Gerätetoken, und das setzt AGE-642 B1 voraus.
>
> **Korrektur an dieser Liste:** A4 nannte die RPCs `push_zustellung_daten` und
> `push_token_entfernen`. Gebaut und gemessen sind `push_auftraege_holen`,
> `push_auftraege_faellig` und `push_zustellung_quittieren` — die Migration ist
> die Wahrheit, nicht dieser Text.
>
> **Zweite Korrektur:** bis zum Vormittag stand hier der Webhook als
> *Konsolen*-Webhook mit **einem** Namen. Falsch — auf DEV und PROD fehlt das
> Schema `supabase_functions` ganz, Database Webhooks wurden nie aktiviert.
> Es ist ein `net.http_post`-Trigger von Hand und damit ein **Paar**:
> `notify_push_webhook` + `notifications_push_webhook`.

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
- [x] **`prod`-Umgebung: das eine Secret, das nicht warten durfte.**
      `PUSH_WEBHOOK_SECRET` ist gesetzt (byte-gleich mit Infisical `prod`,
      per Digest belegt) — ohne es antwortet die Function auf jeden Hinweis
      mit `500`. Die **Anbieter**-Secrets bleiben bewusst leer, solange es
      keine Produktions-App gibt: ohne Zeile in `push_tokens` legt
      `push_auftraege_holen` keinen Auftrag an, und `send-push` antwortet
      `{"skipped":true}`, ohne APNs oder FCM anzufassen. Steht in
      `docs/secrets.md`.
- [x] Commit.

### A5b · **(R2)** Dauerhafter Zustellzustand ✅

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
- [x] **Wiederholung über `pg_cron`.** Es gibt **keinen** zeitgesteuerten
      GitHub-Workflow, in den man das sonst legen müsste — und eine
      zustellkritische Schleife gehört ohnehin nicht in die CI. Der
      Drift-Scanner sieht davon nur die Hälfte: er prüft Funktionen, Trigger,
      Tabellen, Views und Policies in `public` (`db-drift-scan.ts:61-90`), keine
      Extensions und nichts im `cron`-Schema. `push_wiederholung` steht deshalb
      in `ERWARTET_OHNE_MIGRATION` — die **Zeitplanung bleibt unsichtbar**,
      dafür gibt es `scripts/probe-age641-pg-cron.ts <dev|prod>`.
      **Fehlende Anforderung nachgetragen:** der Delta verlangte bis hierher
      nur, dass ein beanspruchter Auftrag eine Frist trägt, und setzte „den
      Wiederholungslauf" in einem Szenario voraus — dass ihn jemand
      *wiederkehrend anstösst*, stand nirgends. Neue SHALL-Klausel plus
      Szenario „Der Wiederholungslauf braucht keinen neuen Hinweis".
      **Takt `* * * * *` — und das ist eine Korrektur aus der Code-Review.**
      Hier stand `*/5` mit der Begründung, das sei „derselbe Wert wie die
      Anspruchsfrist". Zwei verschiedene Fristen verwechselt: die
      Anspruchsfrist ist `now() + 5 min` (`20260828100000:110,179`), die
      **Rückstellung nach Fehlschlag** dagegen `now() + 1 min · 2^versuche`
      (`20260827240000:312`) — also 1, 2, 4, 8, 16. Der Takt muss sich an der
      Rückstellung orientieren; `*/5` hätte deren erste zwei Stufen
      verschluckt und aus 1, 2, 4 faktisch 5, 5, 5 gemacht. Mein Satz „ein
      engerer Takt fände nichts vor" war schlicht falsch. Preis des
      Minutentakts: ~1440 Aufrufe je Tag und Projekt, die ohne Zeile in
      `push_tokens` sofort `{"skipped":true}` antworten.
- [x] ⚠️ **Zuerst auf DEV messen, dann PROD.** `create extension pg_cron` ist
      ein Eingriff in die Instanz, und der lokale Stack ist darin nicht von
      PROD unterscheidbar — `postgres` hat hier andere Rechte.
      **Verfügbarkeit gemessen, nicht angenommen:** 1.6.4 auf DEV *und* PROD
      verfügbar, auf beiden nicht installiert; auf DEV lief `create extension`
      durch.
      **Der Beleg ist zweiteilig, weil `net.http_post` asynchron ist** — ein
      `succeeded` in `job_run_details` sagt nur, dass das SQL lief, nicht dass
      `send-push` geantwortet hat. (1) Rumpf: `push_wiederholung()` von Hand
      angestossen → neue Zeile in `net._http_response`, `200 {"skipped":true}`,
      gemessen gegen eine vorher festgehaltene `max(id)`. Ohne diese Grundlinie
      hätte die `200`-Zeile der Webhook-Probe vom selben Vormittag als Beleg
      getaugt, ohne einer zu sein. (2) Takt: ein echter cron-Lauf.
      Der Wortlaut trägt die Kette: ohne `modus` antwortet `index.ts` **400**,
      mit falschem Bearer **401**, bei fehlgeschlagener RPC **502**.
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

### A6 · Abnahme Phase A ✅

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
- [x] **DEV vorbereitet — drei Schritte, die in dieser Liste fehlten.** Ohne
      sie zeigt der Webhook ins Leere. (1) Die sechs Migrationen dieses
      Branches nach DEV (`pnpm db:push`; DEV stand auf `20260827180000`).
      (2) Die sieben Function-Secrets ans DEV-Projekt — dabei kamen
      `APNS_KEY_P8` und `FCM_SERVICE_ACCOUNT` **beschädigt** an, weil das
      damalige Rezept mehrzeilige Werte auf ihre erste Zeile schnitt; Ursache,
      Reparatur und Digest-Nachweis stehen in `docs/secrets.md`.
      (3) `supabase functions deploy send-push --project-ref …`, und zwar
      **aus dem Worktree**: der Haupt-Checkout hat weder die Function noch den
      `config.toml`-Block, und von dort ausgeliefert wäre `verify_jwt` wieder
      `true` gewesen.
      Gegen die ausgelieferte Function gemessen: richtiger Bearer →
      `200 {"skipped":true}` · falscher Bearer → `401 Unauthorized` (der
      Wortlaut stammt aus `index.ts`, es ist also der Handler und nicht das
      Gateway) · `{"modus":"faellig"}` → `200`. Damit sind `verify_jwt=false`,
      die Geheimnisprüfung und **beide** RPC-Wege belegt.
- [x] **Webhook auf DEV eingetragen und ausgelöst.** Funktion und Trigger per
      `pg` angelegt, dann zurückgelesen: beide da, Token wirklich im Rumpf
      (per Bindeparameter geprüft, nie angezeigt), weder `anon` noch
      `authenticated` mit `execute`.
      **Der Beleg ist die Log-Zeile, und sie ist über die Kennung korreliert**,
      nicht bloß „eine Zeile ist aufgetaucht": Probe-Hinweis eingefügt →
      `{"fn":"send-push","event":"nichts_zu_tun","hinweisId":"3399360f-…"}`
      eine Sekunde später. `nichts_zu_tun` ist hier das Richtige — auf DEV gibt
      es keine Zeile in `push_tokens`. Probezeile wieder entfernt.
- [x] **(R2) Webhook auf PROD.** Dieselben zwei Namen, vor dem
      `migrate-prod`-Dispatch. Drei Schritte in dieser Reihenfolge, jeder
      nachgelesen: (1) `send-push` von Hand nach PROD ausgeliefert — eine NEUE
      Function, nichts überschrieben, damit entfiel das 404-Fenster bis zum
      `functions`-Job; (2) `PUSH_WEBHOOK_SECRET` ans Projekt, **vor** dem
      Trigger, sonst antwortete die Function auf jeden Hinweis mit `500`;
      Digest gegengeprüft, byte-gleich mit Infisical `prod` (dessen Wert sich
      von `dev` unterscheidet); (3) Funktion und Trigger angelegt und
      zurückgelesen, Rechte entzogen.
      Vor dem Verdrahten gemessen: richtiger Bearer → `502 Lookup failed`
      (an der Auth vorbei, RPC fehlte noch), falscher → `401 Unauthorized` aus
      dem Handler. Nach `migrate-prod`: richtiger Bearer → `200 {"skipped":true}`.
      Die Anbieter-Secrets bleiben in `prod` bewusst leer.
- [x] **(R2) Drift-Scan nachgezogen.** Der Webhook besteht aus **zwei**
      Objekten: `notify_push_webhook` (Funktion) und
      `notifications_push_webhook` (Trigger). Beide Namen sind festgelegt und
      müssen in beiden Projekten exakt so lauten.
      **Korrektur vom 28.08.:** zuerst stand hier nur der Trigger, weil ich
      einen Konsolen-Webhook angesetzt hatte. Den gibt es nicht — auf DEV
      **und** PROD fehlt das Schema `supabase_functions` ganz, Database
      Webhooks wurden auf diesen Projekten nie aktiviert; `pg_net` ist dagegen
      installiert. Der Webhook ist darum ein `net.http_post`-Trigger von Hand
      wie der Mail-Webhook, also ein Paar und kein Einzelname.
      `ERWARTET_OHNE_MIGRATION` ist dabei von `db-drift-scan.ts` nach
      `db-drift-scan.logic.ts` gewandert: das
      Skript baut schon **beim Import** eine Datenbankverbindung auf, von dort
      war die Liste nicht prüfbar. Die drei neuen Zusagen lesen die
      **ausgelieferte** Liste, keine Kopie — zweimal RED gemessen (einmal für
      den Trigger, einmal für die Funktion), dann GREEN; die Positivkontrolle
      nannte den fehlenden Namen jeweils beim Namen. Dazu die
      Wiederherstellungs-Vorlage in `docs/secrets.md`, auf die die
      Fehlermeldung des Scans verweist — für `send-push` fehlte sie ganz.
- [x] PR **#265** gegen `main`, vier Pflichtchecks grün **auf der HEAD-SHA**
      (`8f97c3c`, per `check-runs` geprüft — eine Lauf-Liste hätte auch eine
      alte SHA grün gezeigt). Gemergt als `ebe64da`, verifiziert per
      `gh pr view --json state`; ein `gh pr merge` kann still fehlschlagen.
      Unterwegs zwei Fremdbefunde der parallelen Sitzung eingearbeitet: der
      rote `verify` (Lint-Unterdrückung für den Linter, der nicht prüft) und
      `mergeStateStatus: BEHIND`. Der erwartete `deno.lock`-Konflikt kam nicht —
      dieser Branch fasst keine Abhängigkeit an.
- [x] Nach dem Merge: `migrate-prod` — grün, `plan` und `apply`. Vorher den
      Dry-Run **gelesen** (der Workflow hält dafür nicht an): exakt die sechs
      Migrationen, keine Seeds, keine Rollen. Nachgelesen auf PROD: 6
      Migrationen, 3 Zustell-RPCs, 3 neue Tabellen, 6 `notify_app_*`-Spalten
      und **null** alte.
- [x] **Frontend-Deploy nachgezogen.** `deploy.yml` löst nur auf Push nach
      `main` aus — ein grüner `migrate-prod` holt nichts nach. Also
      `gh run rerun --failed`, und davor der Abgleich Lauf-SHA == `origin/main`
      (ein Re-Run auf älterem Commit rollt das Frontend still zurück).
      Belegt am Inhalt, nicht am grünen Job: das Live-Bündel enthält
      `notify_app_` zweimal und `notify_inapp_` **null** mal.

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

> **Stand 28.08., abends.** Die Verdrahtung steht, gebaut ist beides. Was noch
> offen ist, ist **ausnahmslos am Gerät zu messen** — und das Telefon war beim
> Bauen nicht da. Der Reihe nach, wenn es zurück ist:
>
> 1. `xcrun devicectl device install app --device <UDID> <App.app>`
> 2. Nachrichten öffnen, Erlaubnis geben (der Dialog kommt genau **hier**, nicht
>    beim Start)
> 3. `select count(*) from push_tokens` muss **1** sein. Vorher ist er 0 — das
>    ist die Positivkontrolle, ohne die der Rest nichts belegt.
> 4. Erst dann eine Nachricht einfügen und den Push abwarten.

- [x] `@capacitor/push-notifications`; Registrierung über `claim_push_token`,
      `letzter_kontakt` bei jedem Start. Der Android-Teil fehlte bis hierher
      still: die Abhängigkeit lag seit Phase A im `package.json`, aber
      `capacitor.build.gradle` und `capacitor.settings.gradle` kannten das
      Plugin nicht — ein `cap sync android` war nach dem Hinzufügen nie
      gelaufen. Auf iOS wäre es nicht aufgefallen (SPM erzeugt `Package.swift`
      bei jedem Sync neu), auf Android hätte die Registrierung zur Laufzeit
      nichts gefunden.
- [x] Erlaubnis-Dialog **nicht beim ersten Start**, sondern wenn er erklärbar
      ist — beim Öffnen der Nachrichten. Wer beim Kaltstart gefragt wird, sagt
      nein, und iOS fragt kein zweites Mal.

      **Beide** Wege hinein zählen, die Schublade und die Route `/chat`: der
      Einstieg in der Kopfzeile führt auf die Route, und nur die Schublade zu
      nehmen hiesse, wer ihn antippt, wird nie gefragt.

      **Höchstens einmal je App-Lauf UND Konto.** Der Riegel merkt sich die
      Kennung des Kontos, nicht ein Ja/Nein — ein bloßes Ja hätte genau den
      Fall verschluckt, für den `claim_push_token` gebaut wurde. Beim Schreiben
      war er zuerst ein Ja/Nein; gefunden hat es der Test, nicht das Lesen.
- [x] Abmelden entfernt das Token des Geräts. **(R2)** Und der Fall, dass genau
      das fehlschlägt, ist getestet: das nächste Konto übernimmt das Token
      (`push_tokens_test.sql:169-187`, pgTAP, seit Phase A grün).

      Das Aufräumen liegt in `AuthProvider.signOut` und nicht bei einem der
      **fünf** Aufrufer — sonst hätten die anderen vier die Lücke, still. Die
      Reihenfolge ist die eigentliche Zusage: **vor** `auth.signOut()`, weil
      danach kein Konto mehr da ist, dem die Zeile gehört, und das `delete`
      null Zeilen träfe, ohne einen Fehler zu melden.
- [x] Zustellung auf **echtem iOS-Gerät** gemessen, bei gesperrtem Telefon
      (28.08., mit Grundlinie davor): `push_tokens` 0 → 1 nach dem Dialog,
      `ios`, **64 Zeichen** = APNs-Länge · dann `notifications` +1 ·
      `net._http_response` #372 `200` · Antwort `{"zugestellt":2,…}`.

      Damit sind **beide** Hälften der App-ID-Frage beantwortet: APNs gab ein
      Token aus **und** nahm die Zustellung an — `com.effbeezee.app` stimmt.
- [ ] Dasselbe auf **echtem Android-Gerät**, und auf iOS zusätzlich im
      Vordergrund und im Hintergrund. Offen: gemessen ist der Fall, der zählt
      (gesperrt), nicht die anderen drei.
- [x] **Sichtprobe am Sperrbildschirm**: „… hat dir geschrieben", kein Text —
      von Donald am 28.08. gesehen und aufgenommen.
- [ ] Opt-out je Typ am Gerät nachgewiesen.
- [ ] Ungültiges Token wird nach Ablehnung entfernt.
- [ ] **Tote Gerätetokens aufräumen.** `zugestellt: 2` kam von einem Token der
      deinstallierten App. APNs meldet es noch eine Weile als gültig, also
      kommt kein `dauerhaft` — von selbst verschwindet es **nie**.

### B-Anzeige · Die Glocke fasst je Gespräch zusammen ✅

- [x] `fetchHinweise` dampft `message`-Zeilen je `thread_id` auf die neueste
      ein; `markiereHinweisGelesen` markiert daraufhin **alle** ungelesenen
      Zeilen des Fadens. Ohne das zweite taucht der Eintrag sofort wieder auf.
- [x] **Zwei Abfragen, nicht eine** — die Grenze greift VOR dem Eindampfen. Ein
      Faden mit fünfzig ungelesenen Nachrichten hätte sonst eine Kontaktanfrage
      von gestern aus der Liste gedrängt. Übrige Typen bis 50, Nachrichten bis
      200. `or("type.neq.message,type.is.null")`, weil die Spalte nullable ist
      und `null <> 'message'` in SQL nicht wahr ist.
- [x] Gemessen: RED 6/11, dann 11/11 in der Datenschicht, 33/33 mit der Glocke,
      2247 Tests in 202 Dateien grün. PR #286 gegen `main`.
- [ ] **Eine Anzahl am Eintrag** („3 neue Nachrichten von Anna"). Braucht ein
      Feld am Hinweis und berührt `hinweisText` — eigener Vorgang.

## Offen, gehört Donald und Detlev

- [ ] **Abschnitt 4 ist mit Detlev abzustimmen.** Bis dahin steht die Liste als
      Zeilen in `push_routing` und ist ohne Deploy änderbar.
- [ ] **Zustellzustand (R2/M5)** — siehe A5.
- [ ] Bündelung für `event_created` — eigener Vorgang.
- [ ] Der tote `member_joined`-Zweig (`HinweisGlocke.tsx:172`) — eigener Vorgang.

### Aus der Code-Review vom 28.08. — eigene Vorgänge, kein Merge-Blocker

Vier Punkte, die der Reviewer als Betriebsrisiken benannt hat. Sie stehen hier,
damit ein grüner A5b-Haken nicht als Aussage gelesen wird, die er nicht trägt.

- [ ] **Ein `supabase db reset` tilgt den Wiederholungslauf lautlos.** Funktion
      und cron-Eintrag sind keine Migrationen. Der Objekt-Drift-Scan misst nur
      PROD und läuft nur von Hand — **DEV hat gar keinen Wächter**. Nach einem
      Reset ist der Lauf dort still tot. Gleiches gilt seit jeher für das
      Webhook-Paar; neu ist nur, dass es jetzt drei Objekte sind.
- [ ] **Ein dauerhafter Zustellausfall ist unsichtbar.** `net.http_post` ist
      Fire-and-Forget: antwortet `send-push` durchgehend `401` (rotierter
      Bearer) oder `502`, bleibt der cron-Lauf `succeeded`. Nichts schlägt an.
- [ ] **`net._http_response` wächst und wird von niemandem aufgeräumt** — beim
      Minutentakt rund 1440 Zeilen je Tag und Projekt. pg_net räumt nicht
      selbst auf.
- [ ] **Das Gesundheitssignal verfällt mit Phase B.** Solange `push_tokens`
      leer ist, belegt `200 {"skipped":true}`, dass der Weg steht. Mit dem
      ersten echten Gerätetoken heisst dieselbe Antwort nur noch „nichts
      zuzustellen" — ein Nachfolge-Beleg fehlt.
