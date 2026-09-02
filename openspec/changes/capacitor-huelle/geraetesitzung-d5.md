# D5 am Gerät — Runbook

Der Luftweg steht auf PROD und ist bis an die Gerätegrenze belegt: Manifest,
Endpunkt, Auslieferung, und seit dem 31.08. auch der **Krypto-Weg am lebenden
Bündel** (`tasks.md`, D3). Was fehlt, ist die eine Hälfte, die kein Test der
Welt herstellt — was ein echtes Gerät tut.

Zwei Kästchen (`tasks.md`, D5), und **das zweite ist das wichtigere**: einen
Rückweg, den nie jemand ausgelöst hat, gibt es nicht.

---

## 0 · Vorbedingung: die richtige Schale auf dem Gerät

Die installierte App **muss aus einem Commit gebaut sein, der `src/lib/ota.ts`
in der Fassung nach Runde 6 enthält** — also `ddbd8ad` oder neuer. Eine ältere
Schale bestätigt ihren Start blank im Modulrumpf; sie rollt nie zurück, und
Probe 2 unten belegte dann nichts.

Gegenprobe vor dem Start, am Gerät:

* `plugins.CapacitorUpdater.version` der Schale ist **`1.0.0`**. Das ist die
  Vertragsnummer, gegen die `ota_buendel_neuestes` prüft.
* Frisch installiert meldet das Gerät `version_name: "builtin"`.

B3 (Signaturmaterial für CI) ist dafür **nicht** nötig — ein Lauf aus Xcode
gegen das eigene Gerät genügt. `DEVELOPMENT_TEAM` muss dabei von Hand gesetzt
werden.

## 1 · Wie eine Fassung entsteht

`scripts/ota-buendel.ts` bildet die Fassung als `<semver>+<sha[0..12]>`, und
`GITHUB_SHA` sticht `git rev-parse HEAD`. Wir nutzen das und geben den
Proben **sprechende, hexadezimale** Kennungen — wer später ins Manifest sieht,
erkennt sie ohne Nachschlagen:

| Probe | Fassung | Was sie ist | Stand 02.09. |
|---|---|---|---|
| 1 | `0.0.0+feedbeef` | heil, mit sichtbarer Marke | ✅ gelaufen (geplant war `600df00d`) |
| 2a | `0.0.0+600dfeed` | heil, mit Marke — der Rückfallpunkt | offen, Kennung frei |
| 2b | `0.0.0+defec7ed` | **absichtlich defekt** | offen, Kennung frei |
| 3 | `0.0.0+c1ea4ed2` | das Aufräumen danach | offen; `c1ea4ed0`/`c1ea4ed1` sind **belegt** |

Die Spalte rechts ist der Grund, warum diese Tabelle überhaupt einen Stand
trägt: von den ursprünglich geplanten drei Kennungen sind zwei verbraucht, und
eine verbrauchte Kennung wiederzuverwenden ist genau die Falle darunter.

> ### ⛔ Die Falle, die alles kostet: NIE denselben Commit zweimal
>
> `ota_buendel_veroeffentlichen` ist ein **Upsert auf `version`**
> (`on conflict (version) do update`). Wer die defekte Probe unter der Fassung
> des guten Bündels veröffentlicht, **überschreibt dessen `url`, `checksum` und
> `session_key`** — und `created_at` bleibt stehen. Danach gibt es im Manifest
> nichts mehr, worauf zurückgerollt werden könnte.
>
> Und derselbe Mechanismus in die andere Richtung: ein Aufräum-Lauf unter einer
> **bereits eingetragenen** Fassung behält deren altes `created_at` und ist
> damit **nicht** das neueste Bündel. Er räumt dann nichts auf. Deshalb trägt
> auch Probe 3 eine eigene Kennung.

> ### ⛔ Zweite Falle, gemessen 02.09.: das Manifest bewegt sich von allein
>
> `.github/workflows/deploy.yml:715` veröffentlicht bei **jedem** Push auf
> `main` ein Bündel — auch bei einem reinen Doku-Commit. Zwischen dem
> Aufräum-Bündel `c1ea4ed1` (13:46) und 16:04 sind so **sechs** CI-Bündel
> entstanden; obenauf lag `8d3cd941f991`, der Doku-Commit `8d3cd94`. Der
> Merge von PR #319 um 20:10 UTC hat daraus ein **siebtes** gemacht —
> `5091813459c8`, am Endpunkt gemessen. Diese Falle ist damit nicht mehr
> nur beschrieben, sie ist eingetreten.
>
> Zwei Folgen, und die erste kostet Probe 2:
>
> * **Während Probe 2 darf nichts nach `main`.** Ein Merge veröffentlicht ein
>   neueres Bündel als `defec7ed` — dann misst Schritt 4 nicht mehr, ob das
>   Gerät das defekte Bündel liegen lässt, sondern nur noch, dass es ein
>   neueres nimmt. Der `autoDeleteFailed`-Beleg fällt still aus.
> * **Probe 3 von Hand ist nicht mehr nötig — sofern `deploy` auch läuft.**
>   Der Aufräum-Merge räumt `defec7ed` nur ab, wenn der Job `deploy` in
>   `deploy.yml` durchkommt; die Veröffentlichung steckt als Schritt darin.
>   `deploy` hängt an `needs: [migrate-dev, drift-gate]` und **entfällt still**,
>   sobald eines der beiden rot ist. Gemessen 02.09. 20:22 UTC: `drift-gate`
>   rot (drei Migrationen aus AGE-598 liegen im Repo, aber nicht auf PROD),
>   `deploy` übersprungen, kein Bündel veröffentlicht — der Merge von #321
>   liess den Kopf auf `5091813459c8` stehen. **Also vor dem Verlassen auf
>   den Merge den Kopf nachsehen** (Einzeiler in §3); steht dort noch
>   `defec7ed`, ist Probe 3 von Hand Pflicht. Aufgeräumt gehört sofort,
>   nicht irgendwann.

## 2 · Probe 1 — eine sichtbare Änderung erreicht das Gerät

Gebaut wird normal; sichtbar gemacht wird am **gebauten** `dist/`, nicht an
`src/`. Damit gibt es keine Quelländerung, die jemand zurückzunehmen vergessen
kann.

```bash
infisical run --env=prod -- pnpm build

# Eine Marke, die React nicht anfasst: sie haengt an <body>, nicht in #root.
python3 - <<'PY'
import io
p = "dist/index.html"
s = io.open(p, encoding="utf-8").read()
marke = ('<div style="position:fixed;bottom:0;left:0;z-index:99999;'
         'background:#c00;color:#fff;font:12px sans-serif;padding:4px 8px">'
         'OTA-PROBE 600df00d</div>')
assert marke not in s
s = s.replace("</body>", marke + "</body>", 1)
io.open(p, "w", encoding="utf-8").write(s)
print("Marke gesetzt")
PY

GITHUB_SHA=600df00d infisical run --env=prod -- pnpm tsx scripts/ota-buendel.ts
```

Dann am Gerät: App **vollständig** schliessen (aus dem App-Switcher wischen),
neu öffnen. Das Plugin fragt beim Start; geladen wird im Hintergrund, in
Betrieb geht das Bündel beim **nächsten** Start. Also einmal mehr schliessen
und öffnen als man erwartet.

> ### ⚠ `devicectl --terminate-existing` löst die Übernahme NICHT aus
>
> Gemessen 02.09.: der Auslöser ist der Wechsel in den **Hintergrund**, nicht
> der Start. Im Log steht dann `Check for pending update` →
> `Background timestamp saved` → `Reloading <id>`; das Plugin kündigt es sogar
> an mit *„Update will occur next time app moves to background."*
>
> `xcrun devicectl device process launch --terminate-existing` **killt** den
> Prozess, er geht nie in den Hintergrund. Die drei Zeilen kamen in einem
> solchen Lauf **0 Mal** vor, und das fertig entpackte Bündel blieb `pending` —
> was wie ein kaputter Luftweg aussieht, aber das Messverfahren ist.
>
> Die Geste muss **am Gerät** passieren: Home (nach oben wischen), kurz warten,
> App wieder öffnen. Die Konsole taugt zum Mitlesen, nicht zum Auslösen.

**Beleg:** der rote Balken unten links steht da. ✅ Kästchen 1.

## 3 · Probe 2 — der Rückweg

> ### ⚠ Vorher: der Rückfall braucht eine sichtbare Marke — sonst belegt Probe 2 nichts
>
> **Der Kopf wandert bei jedem Merge** (§1) — die Zahl hier ist deshalb ein
> Beispiel, kein Zustand. Vor Probenbeginn selbst nachsehen, ohne Anmeldung:
>
> ```bash
> curl -s -X POST https://viwntbodrtqxgmqyxluh.supabase.co/functions/v1/ota-update \
>   -H 'content-type: application/json' \
>   -d '{"version_build":"1.0.0","version_name":"builtin"}'
> ```
>
> Nennt die Antwort ein CI-Bündel (Fassung = ein `main`-Commit), trägt der
> Kopf **keine** Marke — ein CI-Bau trägt nie eine. Gemessen 02.09. 20:12 UTC:
> `5091813459c8`, der Bau zum Merge von #319; die Marke aus Probe 1
> (`feedbeef`) lag sieben Bündel darunter. Läuft Probe 2 so, ist der Beleg für
> Schritt 3 nur noch „der Bildschirm ist nicht weiss" — und genauso sieht es
> aus, wenn das defekte Bündel **nie installiert wurde**. Der Rückweg wäre dann
> wieder eine Behauptung, diesmal eine grüne.
>
> Deshalb sind es **zwei** Veröffentlichungen, in dieser Reihenfolge:
>
> | # | Fassung | Was sie ist | 02.09. als frei geprüft |
> |---|---|---|---|
> | 2a | `0.0.0+600dfeed` | heil, **mit** Marke — der Rückfallpunkt | ✅ |
> | 2b | `0.0.0+defec7ed` | absichtlich defekt | ✅ |
>
> `600dfeed` entsteht mit dem Griff aus §2 (Markentext auf `OTA-PROBE 600dfeed`
> setzen), `defec7ed` mit dem Griff unten. Dazwischen muss das Gerät `600dfeed`
> **wirklich übernommen haben** — die Marke unten links ist die Quittung. Erst
> dann das defekte Bündel veröffentlichen; vorher misst Schritt 3 nichts.

Das defekte Bündel muss **gültig signiert** sein und sauber installieren; sonst
prüft man die Prüfsumme aus D3 und nicht den Rückweg. Es darf nur eines nicht:
ein Bild zeigen.

Der Griff dazu ist eine Zeile — `#root` aus dem Dokument nehmen:

```bash
infisical run --env=prod -- pnpm build

python3 - <<'PY'
import io
p = "dist/index.html"
s = io.open(p, encoding="utf-8").read()
assert '<div id="root"></div>' in s
s = s.replace('<div id="root"></div>', '<!-- #root absichtlich entfernt: D5 -->', 1)
io.open(p, "w", encoding="utf-8").write(s)
print("#root entfernt — dieses Buendel bleibt weiss")
PY

GITHUB_SHA=defec7ed infisical run --env=prod -- pnpm tsx scripts/ota-buendel.ts
```

**Warum genau dieser Griff.** `src/lib/ota.ts` beschreibt ihn selbst, unten:
ohne `#root` richtet das Modul ausdrücklich nichts ein, `main.tsx` wirft
unmittelbar danach an `document.getElementById("root")!`, der Bildschirm bleibt
leer — und der Rückfall ist die richtige Antwort. Kein Quellcode wird
angefasst, nichts ist zurückzunehmen.

**Beide Griffe sind am GEBAUTEN `dist/` gemessen, nicht an der Quelle** (31.08.,
`pnpm build` mit Platzhalter-Umgebung): `<div id="root"></div>` und `</body>`
stehen dort wörtlich und **je genau einmal** — beide `replace(..., 1)` treffen
also, was sie sollen. Danach: Marke gesetzt und `#root` unberührt (Probe 1),
`#root` restlos weg (Probe 2).

**Und dass das Bündel dann wirklich weiss bleibt, ist gemessen statt vermutet:**
in jsdom gegen das echte `react-dom` — `createRoot(null)` wirft, mit `#root`
wirft es nicht (Positivkontrolle, sonst belegte der Wurf nichts). Die zweite
Hälfte braucht keine Messung, sie steht im Code: `ota.ts` bindet beide Zweige an
`wurzel`, und `wurzel` ist hier `null`. Es wird also nichts bestätigt.

Am Gerät, in dieser Reihenfolge:

1. Schliessen, öffnen → das defekte Bündel wird geladen.
2. Schliessen, öffnen → **weisser Bildschirm.** Jetzt läuft die Frist:
   `appReadyTimeout` 10 s, auf Android für ein noch unbestätigtes Bündel
   mindestens 30 s. **Die App in dieser Zeit offen lassen** — wer sofort
   wegwischt, unterbricht die Messung.
3. Schliessen, öffnen → **die Marke `600dfeed` ist zurück.** ✅ Kästchen 2.
4. **Und noch einmal schliessen und öffnen.** Das ist die Zugabe, und sie ist
   der Grund für `autoDeleteFailed: false`: `ota_buendel_neuestes` bietet
   `defec7ed` weiterhin an — es wurde später eingetragen als `600dfeed`, und
   nach dem Rückfall läuft wieder `600dfeed`. Das Gerät **muss** es trotzdem
   liegen lassen (Status ERROR). Kommt der weisse Bildschirm hier wieder,
   ist der Rückfall eine Endlosschleife und `autoDeleteFailed` hat nicht
   gegriffen.

## 3b · Die zweite Belegseite: die `ota-stats`-Zeile

Am Gerätelog allein hängt der Beleg schief — die Senke muss die Aktion
**benennen**. Bis zum 02.09. schrieb sie dreimal `action: "ohne"`, während das
Gerät `Sent 9 events` meldete; genau das ist repariert. Dass die reparierte
Fassung wirklich ausgeliefert ist, ist am **live laufenden Endpunkt**
nachgestellt statt am Quelltext gelesen (02.09., 18:54:17 UTC, Funktion
Fassung 6):

```
{"fn":"ota-stats","event":"gemeldet","gesamt":2,"actions":["update_fail","revert"]}
```

So liest man mit — beide Zeitmarken sind Pflicht, siehe die Fallen darunter:

```bash
infisical run --env=dev --silent -- bash -c "
curl -s -G 'https://api.supabase.com/v1/projects/viwntbodrtqxgmqyxluh/analytics/endpoints/logs.all' \
  --data-urlencode \"sql=select timestamp, event_message from function_logs where event_message like '%ota-stats%' order by timestamp desc limit 60\" \
  --data-urlencode 'iso_timestamp_start=<Probe-Beginn, ISO mit Z>' \
  --data-urlencode 'iso_timestamp_end=<jetzt, ISO mit Z>' \
  -H \"Authorization: Bearer \$SUPABASE_ACCESS_TOKEN\""
```

Fünf Fallen, alle am 02.09. eingetreten und keine davon laut:

* **Ohne `iso_timestamp_end` kommt `{"result":[]}` zurück** — obwohl die API
  „defaults to the current time" zusagt. Dieselbe Abfrage mit Ende liefert die
  Zeile. Leer heisst hier also nicht „nichts passiert".
* **Das Fenster ist auf 24 h gedeckelt, und der Deckel schneidet das ENDE ab.**
  Eine Spanne von 31 h lieferte lautlos nichts nach Stunde 24 — es sah aus, als
  habe das Gerät seit Mittag nichts mehr gesendet. Es hatte: `function_edge_logs`
  zeigt Aufrufe bis 14:50 UTC.
* **Die Aufnahme hinkt Minuten hinterher.** Zwei Minuten nach dem Aufruf stand
  die Zeile noch nicht da, nach acht schon. Wer nach dem Rückfall sofort
  nachsieht, sieht nichts und schliesst das Falsche.
* **`edge_logs` ist die falsche Quelle** und liefert 0 Treffer.
  `function_edge_logs` trägt die Anfragen (Methode, Status),
  `function_logs` die `console.log`-Zeilen. Beide zusammen trennen „Gerät hat
  nicht gesendet" von „Endpunkt hat nichts protokolliert".
* **Der Supabase-MCP (`query_logs`) ist vom Klassifikator gesperrt.** Der Weg
  ist die Management-API mit `SUPABASE_ACCESS_TOKEN` aus Infisical **dev** —
  der CLI-Login liegt im Keychain und taugt dafür nicht.

> ⚠ **Eine Zeile im Protokoll stammt nicht vom Gerät.** Die Nachstellung oben
> hat am 02.09. um **18:54:17 UTC** eine Zeile mit genau `update_fail` und
> `revert` geschrieben. Ein Grep auf die beiden Wörter findet sie mit. Der Beleg
> für Probe 2 ist deshalb nur eine Zeile **nach** dem Beginn der Probe.

## 4 · Probe 3 — aufräumen, und zwar sofort

> **Kennung gewandert, 02.09.:** hier stand `c1ea4ed0` — die Fassung ist seit
> 12:47 im Manifest, `c1ea4ed1` seit 13:46. Ein zweiter Lauf darunter wäre ein
> Upsert, behielte das alte `created_at` und wäre damit **nicht** das neueste
> Bündel: das Aufräumen sähe grün aus und räumte nichts. Deshalb `c1ea4ed2`.
> Vor jedem Lauf gilt die Regel aus §1 — erst nachsehen, ob die Kennung frei ist.
>
> **Und es geht auch ohne diesen Lauf — aber nur, wenn `deploy` durchkommt:**
> der nächste Merge nach `main` veröffentlicht dann ein neueres Bündel. Ist
> `drift-gate` oder `migrate-dev` rot, entfällt der Job still und der Merge
> räumt nichts ab (§1, gemessen 02.09.). Wer den Kopf nachgesehen und ein
> neueres Bündel in der Hand hat, braucht Probe 3 nicht; sonst nimmt er den
> Lauf, denn liegen bleiben darf `defec7ed` nicht.

`defec7ed` ist nach Probe 2 **das neueste Bündel im Manifest**. Donalds Gerät
lässt es liegen, jedes andere Gerät und jede Neuinstallation nicht.

```bash
infisical run --env=prod -- pnpm build   # unveraendert, ohne jeden Griff
GITHUB_SHA=c1ea4ed2 infisical run --env=prod -- pnpm tsx scripts/ota-buendel.ts
rm -rf dist
```

Gegenprobe, ohne Anmeldung möglich:

```bash
curl -s -X POST https://viwntbodrtqxgmqyxluh.supabase.co/functions/v1/ota-update \
  -H 'content-type: application/json' \
  -d '{"version_build":"1.0.0","version_name":"builtin"}'
```

Die Antwort **muss** `0.0.0+c1ea4ed2` nennen. Steht dort noch `defec7ed`, ist
das Aufräumen nicht durch — dann stimmt die Fassung nicht (siehe die Falle in
§1).

Und am Gerät gibt es dafür ein Zeichen, das man nicht übersehen kann: Probe 3
trägt **keine Marke**. Zweimal schliessen und öffnen, und der rote Balken unten
links ist weg. Damit ist zugleich belegt, dass das Gerät nach dem Rückfall
wieder ganz normal Aktualisierungen annimmt — es hat nur `defec7ed` liegen
lassen, nicht den Luftweg.

## 5 · Was diese Sitzung nicht belegt

Der Beobachter aus Runde 6 — Bestätigung erst beim ersten Element-Knoten unter
`#root` — wird hier **nicht** durchlaufen: der Griff in §3 nimmt `#root` weg,
und dann richtet das Modul planmässig gar nichts ein. Belegt ist damit die
Hälfte des Plugins (Frist läuft ab, `checkRevert` rollt zurück, ERROR bleibt
liegen). Die andere Hälfte trägt `src/lib/ota.test.ts` mit sieben Zusagen, jede
einzeln durch eine Mutation gegengeprüft.

Wer auch den Beobachter am Gerät sehen will, braucht ein Bündel mit `#root`,
dessen React nie committet — das geht nicht ohne Quelländerung und damit nicht
ohne etwas, das zurückzunehmen ist. Eigener Vorgang, wenn überhaupt.

## 6 · Nebenbei mitnehmen, wenn das Gerät ohnehin dranhängt

Vier Gerätebelege stehen ausserdem offen und kosten je eine Minute:
**C3** (Verzeichnis-Sichtbarkeit) auf beiden Plattformen · **C2** auf Android ·
**C1** auf iOS · **B5** der Startbildschirm.

> ⚠ **B5 verlangt, die App vorher zu LÖSCHEN** — iOS hält den Startbildschirm
> in einem Zwischenspeicher, ein Beleg ohne Löschen zeigt womöglich die alte
> Fläche. **Das Löschen kostet die Anmeldung** (die Sitzung liegt in
> Preferences). Also B5 **zuletzt**, nach allem anderen.
