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
`GITHUB_SHA` sticht `git rev-parse HEAD`. Wir nutzen das und geben den drei
Proben **sprechende, hexadezimale** Kennungen — wer später ins Manifest sieht,
erkennt sie ohne Nachschlagen:

| Probe | Fassung | Was sie ist |
|---|---|---|
| 1 | `0.0.0+600df00d` | heil, mit sichtbarer Marke |
| 2 | `0.0.0+defec7ed` | **absichtlich defekt** |
| 3 | `0.0.0+c1ea4ed0` | das Aufräumen danach |

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

**Beleg:** der rote Balken unten links steht da. ✅ Kästchen 1.

## 3 · Probe 2 — der Rückweg

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
3. Schliessen, öffnen → **die Marke `600df00d` ist zurück.** ✅ Kästchen 2.
4. **Und noch einmal schliessen und öffnen.** Das ist die Zugabe, und sie ist
   der Grund für `autoDeleteFailed: false`: `ota_buendel_neuestes` bietet
   `defec7ed` weiterhin an — es wurde später eingetragen als `600df00d`, und
   nach dem Rückfall läuft wieder `600df00d`. Das Gerät **muss** es trotzdem
   liegen lassen (Status ERROR). Kommt der weisse Bildschirm hier wieder,
   ist der Rückfall eine Endlosschleife und `autoDeleteFailed` hat nicht
   gegriffen.

## 4 · Probe 3 — aufräumen, und zwar sofort

`defec7ed` ist nach Probe 2 **das neueste Bündel im Manifest**. Donalds Gerät
lässt es liegen, jedes andere Gerät und jede Neuinstallation nicht.

```bash
infisical run --env=prod -- pnpm build   # unveraendert, ohne jeden Griff
GITHUB_SHA=c1ea4ed0 infisical run --env=prod -- pnpm tsx scripts/ota-buendel.ts
rm -rf dist
```

Gegenprobe, ohne Anmeldung möglich:

```bash
curl -s -X POST https://viwntbodrtqxgmqyxluh.supabase.co/functions/v1/ota-update \
  -H 'content-type: application/json' \
  -d '{"version_build":"1.0.0","version_name":"builtin"}'
```

Die Antwort **muss** `0.0.0+c1ea4ed0` nennen. Steht dort noch `defec7ed`, ist
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
