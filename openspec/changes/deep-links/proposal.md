## Why

AGE-643, M3. Ein Link aus einer Mail oder aus WhatsApp öffnet heute den Browser —
auch auf einem Gerät, auf dem die App installiert ist. Das Mitglied landet in
zwei Welten, muss sich ein zweites Mal anmelden und versteht nicht, wozu es die
App hat.

Der Blocker ist weg: AGE-256 ist durch, die App läuft seit dem 01.09. unter
`app.effbeezee.com`. Universal Links und App Links brauchen eine feste Domain
mit hinterlegter Verifizierungsdatei, und die gibt es jetzt.

**Gemessen am 11.09. auf `d9721f4`**, gegen die Live-Fläche und den Arbeitsbaum:

| Gegenstand | Stand |
| --- | --- |
| `https://app.effbeezee.com/.well-known/apple-app-site-association` | **fehlt** |
| `https://app.effbeezee.com/.well-known/assetlinks.json` | **fehlt** |
| `com.apple.developer.associated-domains` in `App.entitlements` | **fehlt** |
| App-Link-`intent-filter` in `AndroidManifest.xml` | **fehlt**, nur `LAUNCHER` |
| Sprung aus der Push-Mitteilung ins Gespräch | **vorhanden** (`pushZielZuhoerer`, M1) |

**Die Messung der beiden Adressen ist der Grund, warum sie hier als Tabelle
steht.** Beide antworten mit **HTTP 200** — und liefern die Startseite der
Anwendung, 7986 Bytes, `text/html`, zeichengleich mit `/`. Der SPA-Fallback
`/*  /index.html  200` in `public/_redirects` beantwortet jede unbekannte
Adresse. Wer „200" als „Datei vorhanden" liest, hat diesen Change für erledigt
gehalten, bevor er angefangen hat.

Der letzte Zeile der Tabelle verkleinert den Zuschnitt: das Abnahmekästchen
„Push auf eine Nachricht öffnet die richtige Unterhaltung" ist durch M1 bereits
erfüllt und hängt nicht an diesem Change.

## What Changes

- **Zwei Verifizierungsdateien** unter `public/.well-known/`, ausgeliefert an
  `app.effbeezee.com`. Gemessen: Vite kopiert das Punktverzeichnis nach `dist/`;
  eine Sonde in `public/.well-known/probe.txt` lag nach `pnpm build` in
  `dist/.well-known/`.
- **`apple-app-site-association`** trägt `WQZJ8649TN.com.effbeezee.app` und die
  vier Pfade. Die Datei hat **keine Endung** und braucht `application/json` über
  `public/_headers` — sonst weist Apple sie ab.
- **`assetlinks.json`** trägt den SHA-256-Fingerabdruck des **Upload**-Schlüssels.
- **iOS: Associated Domains**, `applinks:app.effbeezee.com`, plus die Fähigkeit
  an der App-ID im Apple-Portal.
- **Android: ein `intent-filter`** mit `android:autoVerify="true"`, `VIEW`/
  `DEFAULT`/`BROWSABLE`, `https` auf `app.effbeezee.com` — und **je einem
  `pathPrefix` für die vier Pfade**, damit Android nicht die ganze Domain
  beansprucht, während AASA auf vier Pfade einschränkt.
- **Ein Zuhörer auf `appUrlOpen`** führt die geöffnete Adresse ins
  Client-Routing, **mitsamt Fragment** — der Aktivierungs-Token steht dort, nicht
  im Query. Der Zuhörer fehlt heute ganz: `AppShell.tsx` hört `backButton`,
  sonst nichts.
- **Das Ziel überlebt die Anmeldung.** Wer nicht angemeldet ist, landet nach dem
  Login am ursprünglichen Ziel statt auf der Startseite.

**Kein BREAKING Change.** Der Browserweg bleibt unverändert; ein Gerät ohne App
sieht dieselbe Website wie heute.

## Capabilities

### New Capabilities

Keine. Deep Links sind eine Eigenschaft der bestehenden Hülle, kein neues
Vermögen.

### Modified Capabilities

- `native-shell`: neue Anforderungen für die beiden Verifizierungsdateien, die
  Anmeldung der Domain auf beiden Plattformen, die Übergabe der geöffneten
  Adresse ins Routing und die Zielerhaltung über die Anmeldung. Alle als
  **ADDED**; keine bestehende Anforderung dieser Capability wird enger oder
  falsch.

**`notifications` und `deployment-environments` werden ausdrücklich NICHT
angefasst** — und das ist kein Zufall, sondern nötig. Die aktiven Changes
`push-fundament` und `push-waechter` halten dort `MODIFIED`-Blöcke. Zwei Changes
auf derselben Anforderung machten den zweiten unarchivierbar. Der Sprung aus der
Mitteilung ist ohnehin gebaut und bleibt, wie er ist.

## Impact

**Auslieferung** — zwei neue Dateien unter `public/.well-known/` und eine Regel
in `public/_headers`. Der SPA-Fallback bleibt unberührt: statische Dateien haben
bei Cloudflare Pages Vorrang vor der Catch-all-Regel.

**iOS** — `ios/App/App/App.entitlements` bekommt einen zweiten Schlüssel. Die
Fähigkeit *Associated Domains* muss an der App-ID im Apple-Portal aktiv sein,
sonst scheitert die automatische Signierung am Profil — dieselbe Mechanik, die
`aps-environment` in M2 erzwungen hat.

**Android** — `android/app/src/main/AndroidManifest.xml` bekommt die
`intent-filter`. Der Fingerabdruck kommt aus dem Upload-Keystore in Infisical.

**Frontend** — ein Zuhörer in `AppShell.tsx`; die Zielerhaltung in
`src/components/RequireAuth.tsx`, das den Ort heute verwirft
(`<Navigate to="/login" replace />`), und in `src/pages/LoginPage.tsx`, das ihn
liest.

**Nicht betroffen:** `supabase/`, der Push-Weg, der Store-Bau. Die
Release-Workflows ändern sich nicht.

### Die Abhängigkeit, die dieser Change NICHT auflösen kann

`assetlinks.json` muss den Fingerabdruck des Schlüssels tragen, mit dem die
**installierte** App signiert ist. Unter Play App Signing — für neue Apps
verpflichtend — hält Google diesen Schlüssel; unserer ist der **Upload**-
Schlüssel. Solange es kein Play-Console-Eintrag gibt, existiert Googles
Fingerabdruck nicht.

Die Datei nimmt mehrere Fingerabdrücke auf. Dieser Change trägt den
Upload-Fingerabdruck ein, womit sich die Android-Seite an einem **direkt
installierten** Paket am Gerät belegen lässt. Googles Fingerabdruck kommt in
**AGE-644 (M4)** dazu.

**Was daraus folgt und ausgesprochen gehört:** „M3 fertig" heißt nach diesem
Change *am Gerät belegt*, nicht *über den Store funktionierend*. Der Nachtrag in
M4 ist eine Zeile, aber ohne ihn verifiziert die über Play verteilte App ihre
Links nicht — und dieser Fehler sieht aus wie „Deep Links funktionieren nicht"
und nicht wie „ein Fingerabdruck fehlt".
