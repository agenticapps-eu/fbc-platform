# Dieselbe Anwendung, in einer nativen Hülle

Linear: **AGE-642**

## Why

Die Plattform läuft heute nur im Browser. Eine App im Store ist der nächste
Schritt, und Capacitor ist der Weg, der dafür **nichts neu baut**: der
Vite-Build aus `dist/` *ist* die App. Damit bleibt ein Fix im Feed mit demselben
Commit auf Web und Mobil behoben.

Drei Dinge stehen dem heute im Weg — alle drei am 27.08. in diesem Worktree auf
`origin/main` (`0dd4b8b`) nachgemessen, nicht aus dem Issue übernommen.

**1 · Die Sitzung liegt im `localStorage`.** `src/lib/supabase.ts:15` ruft
`createClient(url, key)` ohne `auth.storage`. Der Standard von `supabase-js` ist
`localStorage`. In einer iOS-WebView räumt das System diesen Speicher unter
Druck ab — dann ist ein Mitglied abgemeldet, ohne erkennbaren Anlass, und der
Fehler tritt nur manchmal und nur bei manchen auf.

**2 · Der Erststart wiegt 1,18 MB.** Gemessen mit `pnpm build` auf `0dd4b8b`:

| Datei | roh | gzip |
| --- | ---: | ---: |
| `index-*.js` (Eintrittsbündel) | **1.181,77 kB** | **347,78 kB** |
| `index-*.css` | 71,76 kB | 12,70 kB |
| `ErfolgsradarChart-*.js` | 284,98 kB | 84,96 kB |
| 4 Rechtsseiten-Chunks | 121,32 kB | 32,10 kB |

**3 · Kein Rand ist geschützt.** `grep -rn "safe-area\|viewport-fit" src index.html`
findet **nichts**, und `index.html:7` trägt `viewport` ohne `viewport-fit=cover`.
Ohne beides läuft der Inhalt in der WebView unter Notch und Home-Indikator.

### Drei Behauptungen des Issues stimmen so nicht

Sie stehen hier, weil der Plan sonst auf ihnen aufbaut.

| Issue | Gemessen |
| --- | --- |
| „Routen sind bereits lazy, der Rest ist gemeinsamer Code" | **Nein.** Im ganzen `src/` gibt es **zwei** `lazy()`-Aufrufe: `App.tsx:30` (nur `StyleguidePage`, und nur unter `import.meta.env.DEV`) und `profil-widgets.tsx:28`. Alle **43** produktiven Routen hängen statisch — 24 mit literalem Pfad in `App.tsx`, 14 aus `navItems` (`nav.ts:62`), 5 Rechtsseiten (`App.tsx:219`); davon sind 8 reine Weiterleitungen, 35 tragen eine Seite. Die Seitenkomponenten kommen eager aus `src/config/nav.ts:3-16` und `App.tsx:13-26`. Route-Splitting ist damit **die** Bündelarbeit dieses Changes, kein Nebensatz. |
| „`ErfolgsradarChart` wird in `profil-widgets.tsx:45` weiterhin gerendert … wenn er weg kann, fällt ein Viertel des Gewichts" | **Nein.** Die Zeile existiert, aber `ErfolgsradarWidget` wird von **keiner** Produktionsseite aufgerufen — nur von `ProfilAnsichtPage.test.tsx:322`. `ProfilAnsichtPage.tsx:124` dokumentiert den Ausbau (AGE-539), `PublicProfilePage.tsx:33` den zweiten (AGE-597). Der Chart liegt zudem längst in einem **eigenen** Chunk, der nie geladen wird. Am Erststart hängt er mit **0 kB**. |
| „Hauptbündel 1,06 MB" | **1.181,77 kB.** Die Abnahme „messbar kleiner als 1,06 MB" misst damit gegen eine Grundlinie, die es nie gab — 1,06 MB wäre schon ein Rückschritt um 10 %, den man versehentlich erreicht. |

### Was die 1,18 MB wirklich sind

Zugeordnet über die Source-Map des Eintrittsbündels (1.148,4 kB von 1.181,77 kB
zuordenbar):

| Anteil | | Bemerkung |
| ---: | --- | --- |
| 174,3 kB | `react-dom` | bleibt |
| 152,9 kB | `src/components/` | teils seitenspezifisch |
| 146,3 kB | `src/pages/` | **wandert mit den Routen** |
| 127,2 kB | `motion-dom` + `framer-motion` | hängt an `SidebarNav.tsx` — in der Shell |
| 93,9 kB | `@supabase/auth-js` | bleibt |
| 76,7 kB | `src/` (Rest) | |
| 62,9 kB | `zod` | über `LoginPage.tsx`, also im Erststart |
| 61,2 kB | `src/content/` | **`RELEASE_EINTRAEGE`, siehe unten** |
| 54,3 kB | `@supabase/realtime-js` + `phoenix` | nur der Chat braucht sie |
| 198,7 kB | Sonstige | `react-router` 37,1 · `@tanstack/query-core` 35,6 · `react-hook-form` 35,0 · `storage-js` 21,1 · `postgrest-js` 14,9 · `@sentry/core` 13,3 · Rest kleinteilig |

Daraus folgt der einzige ehrliche Satz über den Hebel: **Vendor-Code ist rund
62 % und wandert nicht.** Was wandert, ist `src/pages/` samt dem, was nur dort
gebraucht wird. Ein Ziel „unter 1,06 MB" ist damit erreichbar, ein Ziel „ein
Viertel weniger" wäre eine Zusage ohne Deckung.

**Ein Fund nebenbei, mit Zahl:** `RELEASE_EINTRAEGE` (61,2 kB im
Eintrittsbündel) wird von genau einer Datei importiert —
`src/pages/AdminNeuigkeitenPage.tsx:7`. Diese Admin-Seite hängt eager in
`App.tsx:174`, mit dem Kommentar „eager importiert … sie sind selten besucht,
aber **klein**". Das stimmt für die Seite und nicht für ihren Inhalt: jedes
Mitglied lädt beim Erststart 61 kB Änderungsliste mit, die nur ein Admin je
sieht. Der Kommentar ist damit widerlegt, nicht die Absicht dahinter — deshalb
steht die Umkehrung unten als eigener Punkt und nicht als stille Korrektur.

## What Changes

**1 · Die Sitzung zieht um — und zwar nur nativ.** `src/lib/supabase.ts`
bekommt eine `auth.storage`-Weiche: im Web bleibt es bei `localStorage`, exakt
mit denselben Schlüsseln, nativ übernimmt `@capacitor/preferences`
(Keychain bzw. SharedPreferences). Das ist die **einzige Änderung an
bestehendem Code, die schiefgehen kann**; sie kommt zuerst, allein, und ist im
Web prüfbar, bevor irgendeine native Schale existiert.

**2 · Die Routen werden geteilt.** Die `Component`-Felder in
`src/config/nav.ts` und die statischen Seitenimporte in `src/App.tsx` werden zu
`lazy()`-Importen hinter einem `Suspense`-Rahmen. Dabei kehrt sich die
dokumentierte Entscheidung „Admin-Seiten eager" um — mit dem Grund oben.

**3 · Das Grundgerüst kommt ins BESTEHENDE Repo.** `@capacitor/core`, `/ios`,
`/android`, `capacitor.config.ts`, die Ordner `ios/` und `android/`. Beide
Plattformen gleichzeitig, kein eigenes Repository (Entscheidung Donald; das
Issue datiert sie auf „27.09.", angelegt wurde es am 27.08. — gemeint ist
offenkundig derselbe Tag).

**4 · Das öffentliche Repo bekommt Zähne gegen native Geheimnisse.** Keystore,
`key.properties`, `google-services.json`, `GoogleService-Info.plist`, APNs-`.p8`
und alles Erzeugte werden ignoriert, und ein Wächter im CI bricht ab, wenn eines
davon doch im Baum liegt. Eine `.gitignore`-Zeile allein ist kein Schutz — sie
greift nicht für eine Datei, die einmal namentlich gestaged wurde.

**5 · Native Builds bekommen einen eigenen Workflow.** `deploy.yml` baut
weiterhin nur das Web. Ein neuer, **manuell oder per Tag** ausgelöster Workflow
baut die Schalen. Sonst wird aus jedem Feed-Fix ein zehnminütiger Xcode-Lauf.

**6 · Ränder und Zurück-Taste.** `viewport-fit=cover` plus
`env(safe-area-inset-*)` an den vier Flächen, die den Fensterrand berühren
(Kopfzeile, beide angedockten Leisten, Chatfenster). Die Android-Zurück-Taste
wird auf die Router-Historie gelegt und schließt die App nur noch auf der
Startseite.

**7 · Kamera und Fotoauswahl** über `@capacitor/camera` an den sechs Stellen mit
`type="file"` (`ProfilPage.tsx:278,317`, `CommunityFeed.tsx:943,2042`,
`EventCoverPicker.tsx:120`, `WillkommenPage.tsx:603`). Im Web bleibt das
`<input>` unverändert.

**8 · OTA von Anfang an, selbst gehostet** (Entscheidung Donald, 27.08.) über
`@capgo/capacitor-updater`: `updateUrl`, `channelUrl` und `statsUrl` zeigen auf
eigene Endpunkte. **Wo diese wohnen, ist am 31.08. korrigiert worden** — nicht
Cloudflare Pages Functions plus R2, sondern **Supabase**: Bündel im
Storage-Bucket, Manifest als Tabelle, die drei Endpunkte als Edge Functions mit
`verify_jwt = false`. Grund: die einzige Begründung für R2 lautete „steht
bereits" und war gemessen falsch. Siehe `design.md` §8.
**Mit `publicKey` und signierter Prüfsumme** — ohne beides prüft das Plugin die
Integrität des heruntergeladenen Codes überhaupt nicht, und der Aktualisierungs-
Endpunkt wäre ein Weg, beliebigen Code auf jedes Gerät zu bringen.

## Was ausdrücklich NICHT dazugehört

- **Push** (M1/AGE-641) · **Deep Links** (M3) · **Store-Einreichung** (M4).
- **Offline-Betrieb.** Bei einem Feed, der von Aktualität lebt, wertlos.
- **Den toten Erfolgsradar löschen.** Er wiegt am Erststart nichts (siehe oben),
  und `nav.ts:103-106` hält ausdrücklich fest, dass Ausgebautes im Code bleibt
  und das Zurückholen eine Zeile ist. Eigene Aufräum-Aufgabe, nicht diese.
- **`framer-motion` aus der Shell lösen** (127,2 kB). Der größte einzelne Posten
  nach `react-dom`, aber er hängt an `SidebarNav.tsx`, also am Aussehen der
  Navigation. Das ist eine Design-Entscheidung, keine Bündel-Entscheidung, und
  gehört nicht in einen Change, der eine Hülle baut. **Als Zahl notiert, damit
  sie nicht verloren geht.**
- **Eine zweite Datenschicht, ein Native-Router, ein State-Umbau.** Die
  bestehenden Komponenten bleiben, wie sie sind — gezählt: 67 unter
  `src/components/`, 32 unter `src/pages/`. (Das Issue nennt 107; die Zahl ist
  hier nicht nachgezählt worden und für den Plan ohne Folge.)

## Voraussetzungen, die dieser Change nicht selbst herstellen kann

Sie gehören hierher, weil sie den Plan sonst mitten in Phase C anhalten — so wie
die fehlenden FCM-Geheimnisse den Push-Change in Phase A angehalten haben.

- **Xcode** samt iOS-SDK und **Android Studio** samt SDK auf der Maschine, die
  baut.
- **Apple Developer Program** (99 $/Jahr) und **Google Play Console** (25 $
  einmalig) — für M4 zwingend, für M2 schon nötig, um auf einem **echten Gerät**
  zu starten (die Abnahme verlangt genau das, nicht den Simulator).
- **Ein Android-Keystore**, erzeugt und **außerhalb des Repos gesichert**.
  **Korrigiert am 04.09.:** hier stand „er ist unersetzlich: ohne ihn ist die App
  im Play Store nie wieder aktualisierbar". Das gilt seit August 2021 nicht mehr
  — Play App Signing ist für neue Apps verpflichtend, Google hält den
  App-Signaturschlüssel, und unserer ist der **Upload**-Schlüssel, der sich über
  die Play Console zurücksetzen lässt
  ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/9842756)).
  Die Sicherung bleibt gefordert, aber aus schwächerem Grund; die Begründung
  steht in `specs/native-shell/spec.md`.
- **Ein Schlüsselpaar** für die Signatur der OTA-Bündel; der private Teil nach
  Infisical. Ein **Bucket** wird hier nicht mehr von Hand gebraucht: er entsteht
  seit dem 31.08. wie die vier bestehenden per Migration (siehe `design.md` §8).
- **Bekannt vor M4, nicht in diesem Change fällig:** Apple verlangt zur
  Einreichung ein `PrivacyInfo.xcprivacy`; `@capacitor/preferences` nutzt
  UserDefaults und fällt damit unter die „Required Reason"-APIs. Steht hier,
  damit es nicht wie die FCM-Geheimnisse in M1 erst am Tag der Einreichung
  auffällt.

## Entscheidungen (Donald, 27.08., nach dem Plan-Review)

Alle vier sind gefallen; das Spec-Delta stand bereits auf diesen Antworten. Sie
stehen hier mit ihrer Begründung, damit ein späterer Leser nicht die Frage neu
aufmacht.

1. **Der Sitzungsspeicher hält den Ausweis im Klartext — ausdrücklich so
   entschieden.** `@capacitor/preferences` schreibt nach UserDefaults (iOS) bzw.
   SharedPreferences (Android), beides unverschlüsselt und im Gerätebackup. Der
   Zugewinn eines Keychain-Plugins läge **allein beim Backup**: wer ein
   entsperrtes Gerät hat, hat die laufende Sitzung ohnehin über die WebView. Ein
   Dritt-Plugin im Anmeldeweg ist dafür der höhere Preis. Fällt das später
   anders aus, tauscht sich der Adapter hinter derselben Weiche; Struktur und
   Aufgaben bleiben. Ausführlich in `design.md` §1.
2. **Das Bündel-Ziel: unter 1.024 kB** (1 MiB) statt der 1,06 MB aus dem Issue —
   die stammen aus einer Grundlinie, die es nie gab. Dazu die *strukturelle*
   Zusage, im CI per Skript gegen eine Erlaubnisliste geprüft. Eine Zahl allein
   driftet mit dem nächsten Feature; die Struktur hält.
3. **Admin-Seiten werden lazy** — die Umkehrung der dokumentierten Entscheidung
   aus `App.tsx:155-161`. Ihr Grund („selten besucht, aber klein") stimmt für die
   Seite und nicht für ihren Inhalt: 61,2 kB Änderungsliste, die jedes Mitglied
   lädt und nur ein Admin je sieht. Der Kommentar wird mitgeändert.
4. **Die Kamera kommt in diesen Change.** Sie wirkte zunächst wie das eine
   Stück, das man ohne Verlust verschieben kann — der Review hat gezeigt, dass
   das nicht stimmt: ein später nachgerüstetes Plugin ändert die native Schale,
   hebt die Vertragsnummer und erzwingt ein **eigenes Store-Release**.
   Vertagen hieße um einen Store-Zyklus vertagen, nicht um einen Nachmittag.
