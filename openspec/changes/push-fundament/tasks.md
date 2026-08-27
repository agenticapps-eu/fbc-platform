# Aufgaben — Push-Fundament (AGE-641)

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

### A2 · `push_tokens`

- [ ] **RED**: `push_tokens_test.sql`. Zusagen: eigene Token lesbar · fremde
      **nicht** · fremde nicht änderbar · fremde nicht löschbar · ein Token mit
      fremder `profile_id` lässt sich nicht anlegen (`with check`) · zwei Geräte
      je Mitglied möglich · `token` bleibt eindeutig · `on delete cascade`.
      `alike()` statt `like()`; ein fremdes UPDATE ergibt **null Zeilen**, nicht
      `42501`.
- [ ] Migration: Tabelle mit `plattform` (`check in ('ios','android')`) und
      `letzter_kontakt` — **(R2)** beide standen bisher nur in den Aufgaben und
      in keiner Anforderung. RLS owner-only für alle vier Verben, **Grants
      ausdrücklich ausgesprochen** (AGE-312).
- [ ] **(R2)** `claim_push_token(token, plattform)` als DEFINER-RPC statt eines
      gewöhnlichen Inserts. Sonst strandet ein Token beim Kontowechsel: schlägt
      die Abmelde-Aufräumung fehl, kann Konto B die Zeile von A wegen der
      globalen Eindeutigkeit nicht anlegen und wegen owner-only nicht
      übernehmen — und A's Hinweise gingen an ein Gerät, das B benutzt.
      Zusage: nach fehlgeschlagener Aufräumung und Anmeldung als B gehört das
      Token B.
- [ ] `grants_test.sql`: Golden-String **und** Spalten-Grants-Zusage nachziehen.
      Die Zeile landet alphabetisch zwischen `profiles_public` und
      `release_entry_skips` — genau dort, wo der Web-Strang gerade geschrieben
      hat. Konflikt erwarten.
- [ ] `ci.yml`: die neue pgTAP-Datei in die Dateiliste. Ohne Liste **lügt**
      `supabase test db`.
- [ ] Commit.

### A2b · **(R2)** Den ungenutzten Schreib-Grant entziehen

- [ ] **RED**: Zusage, dass `authenticated` auf `notifications` **kein**
      `insert` und **kein** `delete` mehr hält.
- [ ] `revoke insert, delete on public.notifications from authenticated`.
      Gemessen: `grep 'from("notifications")' src/` findet **keinen** Insert —
      der Grant ist ungenutzt. Ohne den Entzug kann jedes aktivierte Mitglied
      sich selbst beliebig viele Zeilen schreiben und ab Phase B damit beliebig
      viel Push-Arbeit erzeugen (Kontingent bei FCM/APNs).
- [ ] `grants_test.sql` nachziehen — **zweite** Berührung des Golden-Snapshots.
- [ ] Commit.

### A3 · Fünfter Typ `message`

- [ ] **RED**: eine neue Nachricht schreibt dem **Gegenüber** eine Zeile, dem
      Absender **keine**; die Zeile trägt Absendername und Gesprächs-Kennung und
      **keinen Nachrichtentext**; abgeschaltetes `notify_app_message` schreibt
      nichts; ein nicht aktiviertes Konto bekommt nichts.
- [ ] Migration: Trigger `trg_hinweis_nachricht` auf `messages` (after insert).
      Gespräche sind eins-zu-eins (`specs/messaging/spec.md:3`) — ein Gegenüber
      je Nachricht ist richtig.
- [ ] `HinweisGlocke.tsx`: Renderer für `message`, **(R2)** samt Ziel auf den
      Gesprächsfaden. Ein Hinweis, der sich nicht öffnen lässt, ist eine
      Sackgasse. Kein Rohtyp in der Anzeige.
- [ ] **GREEN**. Commit.

### A4 · `push_routing` und die Zustell-RPCs

- [ ] **RED**: keine Client-Rolle hält `execute`; keine Client-Rolle liest
      `push_routing`; ein deaktiviertes Konto liefert **null** Token, auch mit
      Token in der Tabelle; ein Typ **ohne** Zeile in `push_routing` liefert
      nichts.
- [ ] `push_routing (type text primary key, push boolean not null)`. Gesetzt:
      `message` und die drei `contact_request*` auf `true`; `post_created`,
      `comment_on_post`, `like_on_post`, `event_created` und **`release_note`**
      auf `false`. `event_created` wegen der vertagten Bündelung,
      `release_note` weil der eine Typ ohne Abschalter niemandem aufs Gerät
      gehört.
- [ ] `push_zustellung_daten(notification_id)` und
      `push_token_entfernen(token)`, beide SECURITY DEFINER,
      **(R2)** `set search_path = ''`, **(R1)** `revoke` von den Client-Rollen
      **und** `grant execute to service_role` — das Vorbild steht in
      `20260827100000:124-127`. Ohne den Grant scheitert die Function zur
      Laufzeit.
- [ ] **(R1)** Auch das Löschen toter Token läuft über die RPC. Es stünde sonst
      auf derselben `service_role`-Tabellenrechte-Eigenschaft, die für das Lesen
      ausdrücklich verworfen wurde.
- [ ] **GREEN**. Commit.

### A5 · Edge Function `send-push`

- [ ] Webhook-Auth über gemeinsames Geheimnis wie `notify-contact-request`
      (`verify_jwt=false`). Kein `getUser()`/`getClaims()` — beide scheitern
      unter ES256.
- [ ] **(R1)** Die Benachrichtigung wird aus einer **festen Feldliste** gebaut,
      nie aus durchgereichter Nutzlast. Die seit Juni bestehenden Zeilen tragen
      den Freitext weiter; nur dieser Filter schützt sie. Zusage dazu: eine alte
      Zeile mit `message` in der Nutzlast liefert ihn nicht aus.
- [ ] FCM und APNs; dauerhaft abgelehnte Token weg, vorübergehende Fehler nicht.
- [ ] Tests: `push = false` schickt nichts · unverzeichneter Typ schickt nichts ·
      abgeschalteter Schalter schickt nichts · deaktiviertes Konto bekommt
      nichts · keine Nutzlast im Text.
- [ ] Secrets nach Infisical, **getrennt für DEV und PROD**.
- [ ] ⏳ **Offen (R2, M5): Zustellzustand.** Ob je `(notification_id, token_id)`
      ein dauerhafter Zustand mit Wiederholung und Idempotenz gebaut wird, oder
      ob bestmühte Zustellung mit dokumentiertem Verlust bei 5xx genügt —
      **Donalds Entscheidung**, siehe `REVIEWS.md`. Nicht ohne sie beginnen.
- [ ] Commit.

### A6 · Abnahme Phase A

- [ ] `openspec validate --all` grün.
- [ ] Volle pgTAP-Läufe mit expliziter Dateiliste, Ausgabe gelesen.
- [ ] `pnpm test`, `pnpm typecheck` (**nie** `pnpm format`).
- [ ] **Webhook in der DEV-Konsole** eingetragen und ausgelöst — Beleg ist eine
      Zeile im Function-Log, nicht ein 2xx an den Aufrufer.
- [ ] **(R2) Webhook in der PROD-Konsole** — eigener Punkt, nicht mitgemeint.
- [ ] **(R2) `scripts/db-drift-scan.ts` nachziehen.** `ERWARTET_OHNE_MIGRATION`
      (`:27`) führt heute genau zwei Webhook-Namen. Ein per Konsole angelegter
      `send-push`-Webhook, der dort fehlt, macht den Objekt-Drift-Scan rot — und
      der läuft bei **jeder** PROD-Migration (`migrate-prod.yml:132`) und blockt
      den Frontend-Deploy stumm. Der zugehörige Logiktest wird mitgezogen.
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
