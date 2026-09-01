# Session Handoff — 2026-09-01 (AGE-641: Push lebt auf PROD, Betriebsrisiken sind dran)

> ## ⚠ ZUERST: Scope dieser Datei ist AGE-641 (Push)
>
> **AGE-642 (Capacitor-Hülle) hat einen EIGENEN Handoff** im Worktree
> `fbc-platform.donald-age-642-capacitor-huelle`, Stand 31.08. — dort steht das
> vorbereitete D5-Runbook. **Nicht zusammenführen**: das Vermischen der beiden
> hat in zwei Tagen drei Rebase-Konflikte auf dieser Datei gekostet.
>
> Dieser Worktree (`donald-age-641-apns-host-erkennung`) ist **gemergt und
> fertig**. Die nächste Aufgabe braucht einen eigenen.

**PR #301 gemerged** (`b50b975`, 01.09. 06:19), CI grün, `send-push` auf PROD
ausgeliefert. Linear AGE-641 steht auf *Done* — die Automation hat es beim
Merge dorthin gekippt, wo Donald es am 28.08. selbst hatte. **14 Aufgaben in
`push-fundament` sind trotzdem offen.**

## Accomplished

### 1 · Push war auf PROD nie scharf — jetzt ist er es

Donald und Detlev haben am 31.08. am iPhone getestet: keine Push-Nachricht, die
Nachricht in der App aber da. Ursache gemessen, nicht vermutet: drei Zeilen in
`push_zustellungen` mit `letzter_fehler = apns_nicht_konfiguriert`, je fünf
Versuche, `aufgegeben`. **Weder Infisical `prod` noch der Function-Secret-Store
von PROD trugen ein einziges `APNS_*`.** Alles andere war in Ordnung — Hinweis
angelegt, Zustellzeile angelegt, `PUSH_WEBHOOK_SECRET` deployed, Staffelung
1-2-4-8-16 min sauber gelaufen.

Alle sechs Werte gesetzt, per SHA-256 gegen DEV geprüft: byte-gleich, auch die
mehrzeiligen (`.p8` 257 Zeichen, FCM-JSON 2385). Kein Redeploy nötig. Beleg:
zwei zurückgesetzte Zustellungen gingen `zugestellt` durch, **0 Versuche**.
Donald hat `infisical secrets set --env=prod` selbst nachgezogen (der
Auto-Mode-Klassifikator blockt den Weg).

### 2 · Der APNs-Host wird am Anbieter erkannt (PR #301)

Donalds Vorgabe: *„das muss das System, basierend auf dem Input."* Richtig —
ein Schalter hat einen Wert, und sobald Dev- und Store-Builds nebeneinander
laufen, gibt es zwei Wahrheiten. Der Preis eines Irrtums ist kein Ausfall,
sondern ein **gelöschtes Gerätetoken**: `BadDeviceToken` gilt als dauerhaft.

`apnsMitHostErkennung` weicht bei `BadDeviceToken` auf den anderen Host aus;
dessen Ergebnis gilt. Lehnen beide ab, bleibt `dauerhaft`. `APNS_SANDBOX`
bleibt, ist aber nur noch die Vermutung, welcher Host ZUERST gefragt wird.

**7 Zusagen, jede einzeln durch eine Mutation belegt** — und zwei davon waren
zuerst falsch, was erst die Gegenprobe zeigte:

- Die Verdrahtungsprüfung suchte den blossen Namen `apnsMitHostErkennung` und
  blieb **grün**, als die Mutation den Aufruf entfernte — der Name stand noch
  im Import. Prüft jetzt den Aufruf **und** `apnsEndpunkt(host,`.
- Die Erfolgs-Zusage wurde von keiner der sechs Mutationen gerötet, belegte
  also nichts. Eine siebte („weicht immer aus") rötet sie.

### 3 · Ein CI-Wächter, den lokal niemand fährt

Erster CI-Lauf rot: die Verdrahtungs-Zusage liest `index.ts` und braucht
`--allow-read`. Lokal lief das Flag mit, `ci.yml` hatte nur
`--allow-env --allow-net`. Behoben mit `--allow-read=supabase/functions` (eng
begrenzt), und die Gegenprobe fährt jetzt den CI-Befehl **wörtlich**.

## Decisions

- **`APNS_SANDBOX=1` steht auch auf PROD** und weicht damit bewusst von
  `docs/secrets.md` ab (dort korrigiert). Es ist der Grund, warum ein
  Xcode-Build funktioniert. Ohne die Host-Erkennung wäre es eine Zeitbombe;
  mit ihr ist es nur noch eine Vermutung.
- **Kein Skript ins Repo für die PROD-Sondierung** — die Abfragen liefen als
  `.mts` aus dem Scratchpad über `pg` + das Wurzelzertifikat aus `scripts/`.
- **Der Supabase-MCP taugt hier nicht mehr:** er sieht nur noch die
  Organisation `cparx`, nicht die fbc-Projekte. Der `pg`-Weg gilt.

## Files modified

`supabase/functions/send-push/anbieter.ts` (+`apnsMitHostErkennung`) ·
`anbieter.test.ts` (+7 Zusagen) · `send-push/index.ts` (`ueberApns` ist
dünner Aufrufer) · `.github/workflows/ci.yml` (`--allow-read=supabase/functions`) ·
`openspec/changes/push-fundament/{tasks.md,specs/notifications/spec.md}` ·
`docs/secrets.md`.

## Next session: start here — die Betriebsrisiken

Eigenen Worktree aufmachen (`/wt-switch-create donald/age-XXX-...`); dieser hier
ist gemergt. Die vier Punkte stehen in `push-fundament/tasks.md:537-551`.

### Die Sentry-Frage ist schon beantwortet, und die Antwort ist NEIN

**Sentry hätte diesen Ausfall nicht gefangen.** Gemessen am Code
(`send-push/index.ts:202-209`): der Fehler wird **gefangen**, als
`zustellung_warf` protokolliert, als `vorlaeufig` verbucht — die Funktion gibt
**200** zurück. Es fliegt nichts. Dazu kommt: Sentry ist hier heute
**browser-only** (`@sentry/react`, `src/instrument.ts`); in
`supabase/functions/` gibt es **keine einzige** Sentry-Zeile.

Sentry in die Function zu holen hülfe also nur mit einem ausdrücklichen
`captureMessage` — dann ist es kein Fehler-Melder mehr, sondern ein Wächter,
und den kann man billiger haben.

**Die Daten waren die ganze Zeit da.** Drei Tage lang standen die
`aufgegeben`-Zeilen in `push_zustellungen`, mit dem richtigen Grund. Es hat nur
niemand hingesehen. Der naheliegende Zuschnitt ist deshalb ein **Wächter auf
der Tabelle** (pg_cron zählt `aufgegeben` seit X und meldet), nicht ein
Fehler-Melder — er fängt zusätzlich den Fall, dass gar nichts mehr ankommt.

**Axiom ist raus** (Donald, 01.09.; ADR-0037 vom 10.08.). Nicht als Ziel
vorschlagen.

## Open questions

- **`AXIOM_TOKEN` und `AXIOM_DATASET` liegen noch in Infisical `prod`.**
  `docs/observability.md` nennt das Entfernen ausdrücklich als offene
  Operator-Aufgabe („Deleting the code does not invalidate the token") — es ist
  seit dem 10.08. nicht geschehen. Ein gültiges Ingest-Token für einen Dienst,
  den niemand mehr nutzt.
- **`ADR-0037` wird zitiert, existiert aber nicht** — `docs/decisions/` hat
  keine solche Datei. Betrifft auch andere Stellen im Repo.
- **AGE-641 steht auf *Done*, trägt aber 14 offene Aufgaben.** Donald hatte es
  am 28.08. selbst so gesetzt; der Merge hat es dorthin zurückgedreht. Nicht
  eigenmächtig ändern.
- **`APNS_SANDBOX` aus `prod` nehmen, sobald ein Store-Build läuft.** Bricht bis
  dahin nichts.
- **Vier Gerätebelege stehen aus** (Android, iOS im Vorder-/Hintergrund,
  Opt-out je Typ, Token-Entfernung nach Ablehnung). Bündeln, wenn das iPhone
  ohnehin für AGE-642/D5 dranhängt.
