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

Damit ergibt sich: **Cloudflare Pages Functions** für die drei Endpunkte,
**R2** für die Bündel-Zips. Beides steht bereits.

### Signieren ist keine Kür

Aus dem Android-Quelltext des Plugins (`CapgoUpdater.java`), nachgelesen:

- Ist **kein** `publicKey` gesetzt und **keine** `checksum` geliefert, findet
  überhaupt keine Prüfung statt.
- Ist eine `checksum` geliefert, aber kein `publicKey`, wird die SHA-256 des
  Downloads verglichen.
- Ist ein `publicKey` gesetzt, aber keine `checksum` geliefert, wird die
  Installation mit `checksum_required` **abgelehnt**.

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

| | |
| --- | --- |
| **Feld** | worin die Schale ihre Nummer an `updateUrl` meldet. Das Plugin sendet Geräte- und Fassungsangaben mit; welches Feld diese Nummer trägt, ist eine Festlegung, keine Vorgabe des Plugins. |
| **Stempelstelle** | wo die Schale die Nummer trägt. **Nicht** die App-Version: zwei Store-Builds derselben Version können verschiedene Plugin-Mengen haben, und genau dieser Fall ist der Anlass. |
| **Regel** | die Nummer steigt in **jedem** Pull Request, der ein Plugin hinzufügt, entfernt oder seine native Fassung hebt — und ein solcher Pull Request geht über den Store. |

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
signieren, nach R2 laden, Manifest registrieren. Ohne ihn steht ein
Aktualisierungsdienst, den nichts je befüllt.

## Verworfene Alternativen

| Verworfen | Warum |
| --- | --- |
| Eigenes Repository für die Hülle | Der Web-Build müsste als Artefakt veröffentlicht und drüben eingesammelt werden. Eine Bau-Pipeline ohne Gewinn (Issue, Entscheidung Donald). |
| Capacitor Live Updates (Ionic, bezahlt) | Entscheidung Donald, 27.08.: selbst gehostet auf Cloudflare. Die Endpunkte sind drei Funktionen; die Infrastruktur steht schon. |
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
