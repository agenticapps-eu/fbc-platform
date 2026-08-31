# Entwurf — die native Hülle

Alle Zahlen und Zeilenangaben sind am 27.08. auf `origin/main` (`0dd4b8b`)
gemessen. Was aus einer Fremdquelle stammt, nennt sie.

## 1 · Der Sitzungsspeicher

### Was heute passiert

`src/lib/supabase.ts:15` ruft `createClient(url, key)` ohne `auth`-Block.
`@supabase/auth-js@2.112.1` fällt damit auf `localStorage` zurück. In einer
iOS-WebView darf das System diesen Speicher unter Druck leeren — dann ist das
Mitglied abgemeldet, ohne Anlass, den irgendwer nachstellen könnte.

### Die Weiche ist erlaubt und asynchron

Nachgeschlagen in
`node_modules/.pnpm/@supabase+auth-js@2.112.1/…/lib/types.d.ts:1556`:

```ts
export type SupportedStorage = PromisifyMethods<
  Pick<Storage, "getItem" | "setItem" | "removeItem">
> & { isServer?: boolean };
```

`PromisifyMethods` erlaubt jedem der drei Aufrufe, ein `Promise` zu liefern. Ein
Adapter auf `@capacitor/preferences` — dessen API durchweg `async` ist — passt
also ohne Umweg. Das ist keine Annahme, das steht im Typ.

### ⚠️ Korrektur am Issue: Preferences ist NICHT der Keychain

Das Issue schreibt, `@capacitor/preferences` nutze „den Keychain bzw.
SharedPreferences". Die offizielle README des Plugins
(`ionic-team/capacitor-plugins`, Abschnitt `@capacitor/preferences`) sagt:

> This plugin utilizes native storage mechanisms: **UserDefaults on iOS** and
> **SharedPreferences on Android**.

Das ist ein Unterschied, der zählt. Beide Speicher lösen das Problem, um das es
hier geht — sie werden **nicht** unter Speicherdruck geleert, sondern erst bei
der Deinstallation. Beide sind aber **Klartext** in der App-Sandbox und liegen
im Gerätebackup. Ein Supabase-Refresh-Token ist ein langlebiger Ausweis: wer ihn
hat, ist das Mitglied, bis jemand ihn widerruft.

**Zwei Wege, und die Wahl gehört Donald:**

| | `@capacitor/preferences` | Keychain-/EncryptedSharedPreferences-Plugin |
| --- | --- | --- |
| Behebt den Abmelde-Fehler | ja | ja |
| Token im Klartext | ja (UserDefaults / SharedPreferences) | nein |
| Im unverschlüsselten Backup lesbar | ja | nein (bei `…ThisDeviceOnly`) |
| Abhängigkeit | offiziell, vom Capacitor-Team | Dritt-Plugin, eigener Wartungspfad |

**Empfehlung: `@capacitor/preferences`, und die Lücke benannt stehen lassen.**
Grund: Das Angriffsbild, das der Keychain zusätzlich abdeckt, ist ein
entsperrtes oder ausgelesenes Gerät — und wer das hat, hat die laufende Sitzung
ohnehin über die WebView. Der Gewinn liegt allein beim Backup. Ein Dritt-Plugin
im Anmeldeweg ist dafür ein hoher Preis. **Wird das anders entschieden, ändert
sich nur der Adapter hinter derselben Weiche** — die Struktur dieses Changes
bleibt.

### Was im Web gleich bleiben MUSS

Die Abnahme „eine bestehende Web-Sitzung bleibt angemeldet" ist nicht
verhandelbar. Deshalb:

- Im Web wird `auth.storage` **auf `window.localStorage` gesetzt oder gar nicht
  gesetzt** — kein Wrapper, kein eigener Schlüssel, kein Präfix. Derselbe
  `storageKey`, dieselben Werte.
- **`auth.storageKey` wird auf den heute geltenden Wert festgenagelt.** Er ist
  bisher der Default der Bibliothek, und ein Default ist eine Konvention, keine
  Zusage: ein Minor-Upgrade von `@supabase/supabase-js`, das das Format ändert,
  meldete sämtliche Web-Mitglieder ab. Ein Test, der den Schlüssel gegen sich
  selbst prüft, fängt das nicht — er prüft dann nur, dass beide Seiten
  gleichzeitig falsch geworden sind.
- Die Weiche entscheidet über `Capacitor.isNativePlatform()`, nicht über einen
  eigenen Umgebungsschalter. Ein zweiter Schalter wäre eine zweite Wahrheit.
- Keine Migration von Web nach Nativ. Es gibt sie nicht: eine Sitzung im Browser
  und eine in der App sind zwei Sitzungen, wie auf zwei Geräten.

### Was das Abmelden angeht

`access-control/spec.md:1594` verlangt, dass beim Abmelden und beim Wechsel des
Prinzipals der Client-Cache **geleert** wird. Diese Zusage muss den Umzug
überleben: `signOut()` muss den Eintrag im nativen Speicher tatsächlich
entfernen, nicht nur den React-Query-Cache. Ein Adapter, dessen `removeItem`
still nichts tut, wäre ein Konto, das sich nicht abmelden lässt — und das sähe
in jedem Web-Test grün aus.

### Was NICHT umzieht

`index.html:53-61` liest `localStorage.getItem("fbc.designVariant")` in einem
Inline-Skript vor dem ersten Paint. Das bleibt, wie es ist: Es ist eine
Vorliebe, kein Ausweis, und `Preferences` ist asynchron — ein `await` vor dem
ersten Paint gäbe es nicht ohne genau den Theme-Flash, den das Skript
verhindert. Räumt iOS den Speicher ab, startet die App einmal in „hell" und der
Server-Abgleich (`ThemeServerSync`) korrigiert es. Das ist der richtige Preis.

## 2 · Route-Splitting

### Wo die Seiten wirklich hängen

Nicht in `App.tsx`, sondern in `src/config/nav.ts:3-16`: 14 eager importierte
Seiten, die als `Component` im `navItems`-Array stehen, plus 12 direkte Importe
in `App.tsx:13-26`. `App.tsx:83` rendert daraus die Routen.

`navItems` trägt daneben `label` und `section` und ist laut `nav.ts:40` die
„einzige Quelle für Sidebar-Navigation und Routing". Die Sidebar liest nur
`label`/`section`/`path` — `Component` zu `React.lazy(...)` zu machen berührt
sie nicht.

### Der Schnitt

- **Eager bleibt**, was der erste Paint braucht: `AppShell`, die Wachen
  (`RequireAuth`, `RequireAdmin`, `RequireStaff`, `ActivationGate`,
  `MembershipGate`), `HomeRedirect` und `LoginPage`. Wer nicht angemeldet ist,
  landet auf einer dieser beiden — ein Ladezustand davor wäre ein leerer Start.
- **Lazy wird alles andere**, einschließlich der Admin-Seiten. Das kehrt den
  Kommentar in `App.tsx:155-161` um; der Grund steht im Proposal.
- **Ein `Suspense`-Rahmen** um den Routen-Block, nicht je Route. Ein Rahmen je
  Route wäre 29-mal dieselbe Zeile.
- Der Fallback trägt die **Höhe des Inhaltsbereichs** und nichts sonst. Ein
  Spinner, der bei 40 ms Chunk-Ladezeit aufblitzt, ist Unruhe ohne Information.

### Warum nicht `manualChunks`

Die Bauwarnung schlägt `build.rolldownOptions.output.codeSplitting` vor. Vendor
in einen eigenen Chunk zu schneiden **verschiebt Bytes, es entfernt keine**: der
Erststart lädt beide Dateien. Es verbessert das Zwischenspeichern über Releases
hinweg — ein anderes, kleineres Problem. Route-Splitting entfernt Bytes aus dem
Erststart, weil die Seite, die niemand öffnet, nicht geladen wird.

### Was messbar sein muss

Die Grundlinie steht im Proposal. Der Nachweis ist **dieselbe Messung nach dem
Umbau**, plus die strukturelle Zusage: keine Seitenkomponente außer den oben
genannten liegt noch im Eintrittsbündel. Eine Zahl allein driftet mit dem
nächsten Feature; die Struktur hält.

## 3 · Native Ordner, öffentliches Repo

`ios/` und `android/` gehören ins Repo — das ist Capacitor-Konvention und macht
den Bau reproduzierbar. Was nicht hineingehört, steht im Issue und wird zu
`.gitignore`-Zeilen.

**Eine `.gitignore`-Zeile ist aber kein Schutz.** Sie greift nicht für eine
Datei, die jemand namentlich staged, und genau das ist der Weg, auf dem am
23.08. schon einmal 60 Klarnamen `git add`-bereit lagen. Deshalb ein **Wächter
im CI**, der den Baum gegen eine Musterliste prüft und den Lauf bricht — nicht
den Diff, den Baum. Ein Geheimnis, das in einem früheren Commit liegt, ist nicht
weniger öffentlich, weil der aktuelle Diff es nicht anfasst.

## 4 · CI

`deploy.yml` bleibt unangetastet und baut weiter nur das Web. Der native Bau
kommt in einen **eigenen** Workflow mit `workflow_dispatch` und Tag-Auslöser.

Der Grund ist nicht nur die Laufzeit: `deploy.yml` läuft bei **jedem** Pull
Request. Ein macOS-Runner mit Xcode je PR wäre teuer und langsam, und er würde
für jeden Textfix ein Signaturzertifikat brauchen.

## 5 · Sichere Ränder

`index.html:7` trägt heute `content="width=device-width, initial-scale=1.0"`.
Ohne `viewport-fit=cover` sind sämtliche `env(safe-area-inset-*)` in iOS
**null** — die Insets zu setzen, ohne das Meta zu ändern, sieht aus wie
erledigt und wirkt nicht.

Betroffen sind die Flächen, die den Fensterrand berühren: die Kopfzeile, die
beiden angedockten Leisten und das Chatfenster. Das ist die **senkrechte**
Fortsetzung von AGE-584, dessen Ergebnis als „Keine Seite laesst sich seitlich
schieben" in `design-system/spec.md:945` steht.

**Gemessen wird auf dem Gerät.** Eine jsdom-Zusage über `env()` ist keine: die
Insets sind dort immer null, und ein Test, der das behauptet, wäre grün, egal
was die App tut.

## 6 · Android-Zurück

Ohne Zutun schließt die Zurück-Taste die App. Sie gehört auf die
Router-Historie, aber **in dieser Reihenfolge**:

1. Ist ein Overlay offen, schließt Zurück das Overlay.
2. Sonst, gibt es Historie, geht Zurück eine Seite zurück.
3. Sonst — auf der Startseite — schickt Zurück die App in den Hintergrund.

Punkt 1 ist der, den man übersieht. Mehrere Flächen führen ihren Offen-Zustand
über `location.key` (`HeaderSearch.tsx:80`, `MemberDirectory.tsx:80`,
`LegalZurueck.tsx:24`) — sie reagieren also bereits auf Navigation. Ein
Zurück-Handler, der stattdessen `navigate(-1)` erzwingt, während ein Overlay
offen ist, ließe Overlay und Historie auseinanderlaufen.

## 7 · Kamera

Sechs `type="file"`-Stellen (`ProfilPage.tsx:278,317`,
`CommunityFeed.tsx:943,2042`, `EventCoverPicker.tsx:120`,
`WillkommenPage.tsx:603`). `@capacitor/camera` liefert nativ einen sauberen
Ablauf mit Auswahl zwischen Kamera und Galerie.

Ein gemeinsamer Aufrufpunkt, **eine** Funktion, die eine Datei zurückgibt — im
Web über das bestehende `<input>`, nativ über das Plugin. Die sechs Aufrufer
wissen nichts davon. Was danach passiert (Zuschnitt, Upload), bleibt unberührt;
die gemessenen Seitenverhältnisse der beiden Bucket-Sorten gelten unverändert.

## 8 · OTA, selbst gehostet

`@capgo/capacitor-updater` erlaubt laut seiner `definitions.ts`, `updateUrl`,
`channelUrl` und `statsUrl` in `capacitor.config.ts` auf eigene Endpunkte zu
legen. Der `updateUrl` bekommt ein POST mit Geräteangaben und antwortet mit
`{ version, url, checksum, … }`; unter `url` liegt ein Zip mit `index.html` an
der Wurzel.

**Fassungsfalle:** `latest` ist `8.51.15` und passt zu Capacitor 8. Es gibt auch
`9.0.0` und `10.0.0` — die fordern aber `@capacitor/core: ^5.0.0`. Höhere Zahl,
ältere Zusage; nicht darauf greifen.

### Wo der Dienst wohnt — korrigiert am 31.08.

Bis zum 31.08. stand hier **Cloudflare Pages Functions plus R2**, begründet mit
einem einzigen Satz: „Beides steht bereits." **Der Satz war falsch.** Gemessen:
Pages steht (`wrangler pages deploy ./dist --project-name=fbc-platform` in
`deploy.yml`; `functions/` fährt automatisch mit). **R2 steht nicht** — kein
`wrangler.toml`, keine Bucket-Bindung, kein Treffer im Repo. Die „R2"-Fundstellen
sind eine Risiko-Kennung `R2` in `docs/w2-acceptance.md`, also Namensgleichheit.

Supabase Storage steht dagegen wirklich: vier Buckets, **per Migration** angelegt
mit `public`, `file_size_limit` und `allowed_mime_types`; `avatars` und `covers`
sind bereits öffentlich. Das Kriterium, mit dem der Entwurf R2 wählte, spricht
damit gegen R2.

**Entscheidung Donald, 31.08.: alles auf Supabase.** Bündel im Storage-Bucket,
Manifest als Tabelle, die drei Endpunkte als Edge Functions mit
`verify_jwt = false`. Das berührt die Entscheidung vom 27.08. nicht — „selbst
gehostet" war die Wahl **gegen** den bezahlten Ionic-Dienst, nicht für einen
Anbieter. Supabase ist genauso selbst gehostet wie Cloudflare.

Was dafür spricht, über „steht schon" hinaus:

- **Ein Schlüssel weniger.** `SUPABASE_SERVICE_ROLE_KEY` liegt in Infisical
  (`docs/secrets.md:132`), und `deploy.yml` fährt ohnehin alles über
  `infisical run`. Eine Pages Function müsste das Manifest aus Supabase lesen und
  bräuchte dafür einen Schlüssel in einer zweiten Umgebung — genau die Reibung,
  die dieser Weg vermeidet.
- **Der öffentliche Endpunkt ist hier eingespielt.** `verify_jwt = false` tragen
  `stripe-webhook`, `send-activation` und `notify-contact-request`, jeweils mit
  ausgeschriebener Begründung. Ein Gerät hat kein JWT; der Endpunkt muss ohne
  auskommen.
- **Öffentlich ist kein Zugeständnis** — und dieser Absatz hat die Begründung
  dafür am 31.08. **zweimal** gewechselt. Die erste Fassung sagte „dasselbe
  `dist/`, das Pages ohnehin ausliefert"; die zweite verwarf das und setzte auf
  die Verschlüsselung, weil im Bucket Chiffrat liegt. **Die zweite war die
  schlechtere.** Ein Fremd-Review am Diff hat sie widerlegt: der öffentliche
  Schlüssel steckt in jeder ausgelieferten App, und der `sessionKey` kommt vom
  Aktualisierungs-Endpunkt, der ohne JWT antwortet. Wer beides holt,
  entschlüsselt das Bündel. **Die Verschlüsselung trägt Echtheit, nicht
  Vertraulichkeit.**

  Es gilt also wieder die erste Fassung, und sie war nie falsch, nur unbelegt:
  im Bündel steht der Inhalt, den Pages ohnehin an jeden ausliefert. Es gibt
  hier nichts zu verbergen. Zu schützen ist allein, dass niemand ANDEREN Code
  unterschiebt — und das leistet die Signatur, nicht der Bucket.

**Die Falle dabei, und sie ist still:** fehlt der `config.toml`-Block zu einer
Function, gilt `verify_jwt = true`. Das Gateway antwortet dann mit 401, **bevor**
der Handler läuft — die Schale sähe einen Fehler, den kein Log der Function
erklärt.

**Größe, gemessen am 31.08.:** `dist/` gezippt sind **2,71 MB** ohne Sourcemaps
(4,43 MB mit; die Maps gehen zu Sentry, nicht aufs Gerät).

### Signieren ist keine Kür

Aus dem Android-Quelltext des Plugins (`CapgoUpdater.java`), nachgelesen:

- Ist **kein** `publicKey` gesetzt und **keine** `checksum` geliefert, findet
  überhaupt keine Prüfung statt.
- Ist eine `checksum` geliefert, aber kein `publicKey`, wird die SHA-256 des
  Downloads verglichen.
- Ist ein `publicKey` gesetzt, aber keine `checksum` geliefert, wird die
  Installation mit `checksum_required` **abgelehnt**.

### Was `publicKey` wirklich tut — nachgemessen am 31.08.

Der Name führt in die Irre. `publicKey` ist laut `definitions.d.ts` „**end to end
live update encryption Version 2**" (seit 6.2.0), nicht eine losgelöste Signatur.
Der Mechanismus, aus `CryptoCipher.java` und `CryptoCipher.swift`:

- Das Bündel wird beim Veröffentlichen mit einem zufälligen **AES**-Schlüssel
  verschlüsselt (`AES/CBC/PKCS5Padding`).
- Dieser Sitzungsschlüssel wird mit dem **privaten** RSA-Schlüssel verschlüsselt
  und als Feld **`sessionKey`** in der Form `iv:sessionKey` (beides Base64,
  durch Doppelpunkt getrennt) mitgeliefert.
- Auf dem Gerät entschlüsselt `decryptRSA(sessionKey, publicKey)` mit dem
  **öffentlichen** Schlüssel den AES-Schlüssel und damit die Datei. Auch die
  **Prüfsumme** wird so entschlüsselt (`decryptChecksum`).

RSA rückwärts also: was der private Schlüssel verschlossen hat, öffnet nur der
passende öffentliche. Das ergibt **Echtheit**. Vertraulichkeit ergibt es
**nicht**: der öffentliche Schlüssel ist öffentlich, und der `sessionKey` kommt
über einen Endpunkt ohne JWT — wer beides hat, liest mit. Aber es
heisst auch, dass **im Bucket kein lesbares `dist/` liegt, sondern Chiffrat.**

**Formatfalle:** beide Plattformen prüfen ausdrücklich auf
`-----BEGIN RSA PUBLIC KEY-----`, also **PKCS#1** (`CryptoCipher.java:145`,
`CryptoCipher.swift:241`). Der Normalfall von `openssl rsa -pubout` ist PKCS#8
(`-----BEGIN PUBLIC KEY-----`) und wird mit „The public key is not a valid RSA
Public key" abgewiesen.

**Längenfalle — gemessen am 31.08., nachmittags.** Die Schlüssellänge ist
nicht frei: `decryptChecksum` bricht ab, wenn das Chiffrat der Prüfsumme
**nicht genau 256 Byte** lang ist (`CryptoCipher.java:254`,
`CryptoCipher.swift:74`, beide mit derselben Meldung „Checksum is not RSA
encrypted"). 256 Byte heißt **RSA-2048**, und nichts anderes ist zulässig. Ein
4096-Bit-Schlüssel liefert 512 Byte und macht jedes Bündel unbrauchbar — still,
denn die Prüfsumme ist Pflicht, sobald ein `publicKey` gesetzt ist: das Bündel
lädt, die Prüfung scheitert, das Gerät bleibt auf der alten Fassung. Genau ein
solcher Schlüssel lag am Vormittag desselben Tages in Infisical, dreifach
belegt — die drei Belege prüften Format, Übertragung und Rundlauf, und ein
Rundlauf gelingt mit jeder Länge.

**Und die Prüfsumme meint das Klartext-Zip.** Das Plugin entschlüsselt zuerst
und rechnet dann (`CapgoUpdater.java:851-856`). Verschlüsselt und übertragen
werden die **32 rohen Digest-Bytes**; das Gerät hext sie selbst auf und
vergleicht mit `calcChecksum`, das Kleinbuchstaben-Hex liefert. Wer die SHA-256
über die hochgeladene Datei bildet, liefert die falsche Zahl.

**Der Unterschied, auf den es ankommt, ist Integrität gegen Echtheit.** Eine
blanke Prüfsumme belegt, dass das Zip unterwegs nicht beschädigt wurde. Sie
belegt nicht, dass es von uns stammt: wer den Endpunkt kontrolliert, liefert das
Zip **und** die dazu passende Prüfsumme. Erst der `publicKey` macht daraus eine
Aussage über die Herkunft.

Ohne Signatur wäre der Aktualisierungs-Endpunkt also ein Weg, beliebigen Code
auf jedes Gerät zu bringen — der Store-Prüfung entzogen, per Konstruktion. Also:
`publicKey` gesetzt, Prüfsumme signiert, privater Schlüssel nach Infisical.

### Zwei Abwägungen, die benannt gehören

**Apples Richtlinie 2.5.2** erlaubt das Nachladen interpretierten Codes, solange
sich Zweck und Funktionsumfang der App nicht ändern. Der Plan liegt darin — aber
**die Vertragsnummer erzwingt das nicht.** Technisch kann der Luftweg beliebige
Oberflächen ausliefern, auch neue Funktionen, solange sie keine neue native
Fähigkeit brauchen. Das ist eine **Richtlinie, kein Mechanismus**, und sie steht
hier, damit sie nicht später als selbstverständlich unterstellt wird.

**Ein Dritt-Plugin sitzt im Aktualisierungsweg selbst.** Für den
Sitzungsspeicher fordert dieser Entwurf oben eine ausdrückliche Entscheidung,
bevor ein Dritt-Plugin in den Anmeldeweg kommt. Dieselbe Frage stellt sich hier
schärfer: `@capgo/capacitor-updater` darf Code installieren, den es lädt. Die
Antwort fällt anders aus als beim Speicher — die einzige Alternative wäre der
bezahlte Ionic-Dienst, der dasselbe Vertrauen verlangt, nur mit Rechnung, oder
gar kein OTA, und „gar kein OTA" ist im Issue ausdrücklich verworfen. Der
Ausgleich ist die Signatur: das Plugin lädt, aber es entscheidet nicht, **was**
gültig ist.

### Die Falle, die OTA einem stellt

OTA tauscht **Web-Assets**, nicht die Schale. Ein Release, das ein neues
Capacitor-Plugin hinzufügt, liefert per OTA JavaScript aus, das eine native
Fähigkeit aufruft, die auf dem Gerät nicht existiert — und zwar erst beim
Aufruf, nicht beim Start.

Deshalb trägt das Bündel eine **Vertragsnummer der nativen Schale**, und der
Endpunkt liefert ein Bündel nur an Schalen, die sie erfüllen. Ein Release, das
die Schale ändert, hebt die Nummer und geht durch den Store. Das ist die eine
Stelle, an der OTA Buchführung verlangt, und sie fehlt in keinem gelieferten
Bündel.

Eine Nummer, die man nur benennt, ist keine. Festzulegen sind drei Dinge, und
zwar **vor** der ersten Zeile in Phase D:

Alle drei sind am 31.08. **am Quelltext des Plugins gemessen** festgelegt. Der
Rumpf, den die Schale an `updateUrl` schickt, steht in `CapgoUpdater.java`
(Z. 1994–2010); genau ein Feld darin taugt.

| | Festgelegt 31.08. |
| --- | --- |
| **Feld** | **`version_build`.** Es kommt auf **beiden** Plattformen aus `plugins.CapacitorUpdater.version` — Android `CapacitorUpdaterPlugin.java:725`, iOS `CapacitorUpdaterPlugin.swift:268` — und fällt sonst auf die Marketing-Version zurück. `custom_id` scheidet aus: es wird aus **JavaScript** gesetzt (`setCustomId`) und in Preferences gehalten, die Web-Schicht erklärte also ihren eigenen Vertrag. `version_code` ist die Store-Build-Nummer, `plugin_version` capgos eigene. |
| **Stempelstelle** | **`plugins.CapacitorUpdater.version` in `capacitor.config.ts`.** Der Beleg, auf den es ankommt: `capacitor.config.json` liegt in `android/app/src/main/assets/` und `ios/App/App/` — **neben** `public/`, nicht darin. OTA tauscht `public/`; die Nummer ist damit unabweisbar Sache der Schale und nur über den Store änderbar. Und sie ist **nicht** die App-Version: zwei Store-Builds derselben Version können verschiedene Plugin-Mengen haben, und genau dieser Fall ist der Anlass. |
| **Regel** | die Nummer steigt in **jedem** Pull Request, der ein Plugin hinzufügt, entfernt oder seine native Fassung hebt — und ein solcher Pull Request geht über den Store. |
| **Form** | **semver-förmig**, also `1.0.0` → `2.0.0`, nicht `1` → `2`. Gemessen am 31.08.: `version_build` wird zwar unvalidiert durchgereicht, aber **derselbe** Config-Wert wird eine Zeile später als Semver geparst (`CapacitorUpdaterPlugin.java:730`, `.swift:262`). Eine blanke Zahl liesse `currentVersionNative` auf iOS still auf `0.0.0` stehen, und die Verzögerungslogik rechnete mit dem falschen Wert. Der Vergleich im Endpunkt ist deshalb zahlenweise über `string_to_array(…, '.')::int[]` — ein Zeichenkettenvergleich stellte `10.0.0` vor `9.0.0`. |

**Der Preis, benannt:** belegt die Vertragsnummer `version_build`, trägt dieses
Feld nicht mehr die Marketing-Version. Sie bleibt über `version_code` sichtbar,
das die Store-Build-Nummer führt — verloren geht nichts, aber wer die Statistik
liest, muss die Umwidmung kennen.

### Und der Rückweg

Die Prüfsumme schützt gegen ein **fremdes** Bündel. Gegen ein **eigenes,
kaputtes** schützt sie nicht: ein gültig signiertes Bündel, das startet und dann
weiß bleibt, bricht jedes Gerät dauerhaft — bis eine neue Schale durch den Store
geht, also ein bis drei Tage, und das für genau die Menschen, die am wenigsten
davon verstehen.

Deshalb bestätigt die Anwendung ihren erfolgreichen Start ausdrücklich
(`notifyAppReady()`), und bleibt die Bestätigung aus, geht die vorige Fassung
wieder in Betrieb. Das ist kein Feinschliff, sondern die Bedingung, unter der
OTA überhaupt verantwortbar ist.

### Was ein Bündel überhaupt entstehen lässt

Drei Endpunkte beantworten Anfragen; sie erzeugen nichts. Der
Veröffentlichungs-Schritt gehört ausdrücklich dazu: `dist/` zu einem Zip mit
`index.html` an der Wurzel, SHA-256 bilden, mit dem privaten Schlüssel
signieren, in den Storage-Bucket laden, Manifest registrieren. Ohne ihn steht ein
Aktualisierungsdienst, den nichts je befüllt.

**Anlass, festgelegt am 31.08.:** jeder Deploy auf `main`. `deploy.yml` baut dort
ohnehin `dist/` und lädt es zu Pages; der Veröffentlichungs-Schritt hängt sich an
denselben Job. Jeder andere Anlass hieße, dass ein vergessener Auslöser Geräte
still zurücklässt — und „still" ist hier das Problem, nicht „zurück".

**Fassungsschema, festgelegt am 31.08.:** `<Semver aus package.json>+<kurzer
SHA>`, etwa `1.4.0+8fbc49b`. Jede Fassung ist damit eindeutig und auf genau einen
Commit rückführbar, und zwei Deploys derselben Semver kollidieren nicht. Das
beantwortet zugleich die offene Frage, was gilt, wenn ein Store-Bau und ein
`main`-Deploy sich überholen: sie tragen verschiedene SHAs, also verschiedene
Fassungen, und die Vertragsnummer entscheidet getrennt davon, wer welches Bündel
bekommt.

## Verworfene Alternativen

| Verworfen | Warum |
| --- | --- |
| Eigenes Repository für die Hülle | Der Web-Build müsste als Artefakt veröffentlicht und drüben eingesammelt werden. Eine Bau-Pipeline ohne Gewinn (Issue, Entscheidung Donald). |
| Capacitor Live Updates (Ionic, bezahlt) | Entscheidung Donald, 27.08.: selbst gehostet. Die Endpunkte sind drei Funktionen; sie liegen seit dem 31.08. auf Supabase (§8). |
| Cloudflare Pages Functions + R2 für OTA | Bis 31.08. der Plan. Verworfen, weil seine einzige Begründung — „beides steht bereits" — gemessen falsch war: R2 stand nicht, Supabase Storage steht. Siehe §8. |
| Vendor-Chunks statt Route-Splitting | Verschiebt Bytes, entfernt keine (siehe §2). |
| Den Erfolgsradar löschen, um das Bündel zu senken | Er wiegt am Erststart **null**. Die Behauptung des Issues ist widerlegt, nicht umgesetzt. |
| `framer-motion` aus der Shell lösen (127,2 kB) | Der zweitgrößte Posten, aber er hängt am Aussehen der Navigation. Design-Entscheidung, eigener Change. |
| Nur iOS zuerst | Das Issue verlangt beide gleichzeitig. Ein zweiter Durchgang für Android hieße, jede Entscheidung hier zweimal zu treffen. |
| Offline-Betrieb | Bei einem Feed, der von Aktualität lebt, wertlos (Issue §6). |

## Was schiefgehen kann

1. **Der Storage-Umbau meldet bestehende Web-Sitzungen ab.** Der teuerste Fehler
   dieses Changes und der Grund, warum er allein und zuerst kommt.
2. **Ein lazy geladenes Modul bricht einen Test**, der die Seite bisher synchron
   gerendert hat. 174 Testdateien; der Umbau ist mechanisch, die Zusagen bleiben.
3. **`env()`-Insets sind in jedem jsdom-Test null.** Wer den sicheren Rand dort
   prüft, prüft nichts.
4. **Der native Keystore geht verloren.** Dann ist die App im Play Store nie
   wieder aktualisierbar. Kein Codeproblem — eine Aufbewahrungsfrage, die vor
   dem ersten Store-Bau geklärt sein muss.
5. **Ein OTA-Bündel trifft eine ältere Schale.** Siehe die Vertragsnummer in §8.
