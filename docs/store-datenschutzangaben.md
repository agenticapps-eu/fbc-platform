# Datenschutzangaben für App Store und Play Console

Ausfüllhilfe für **Apple App Privacy** (App Store Connect) und **Google Data
safety** (Play Console). Am Quelltext erhoben am **2026-09-13**, abgeglichen mit
`src/content/legal/datenschutz.ts` (Stand dort: 11.08., Diensteliste 26.08.).

> Beide Formulare sind **Selbstauskünfte unter Haftung**. Was hier steht, ist die
> gemessene Grundlage — die Eingabe bleibt Donalds Entscheidung. Wo ich eine
> Einschätzung gebe und keine Messung, steht es dabei.

## Zuerst: drei Befunde, die vor dem Ausfüllen zu klären sind

### 1. Zwei Empfänger fehlen in der Datenschutzerklärung

Die Diensteliste in §13 wurde am **26.08.** erhoben. Push kam danach. Heute
gehen Daten zusätzlich an:

| Dienst | Was er bekommt | Beleg |
| --- | --- | --- |
| **Apple APNs** | Gerätetoken + Benachrichtigungsinhalt | `supabase/functions/send-push/anbieter.ts:121` |
| **Google FCM** | Gerätetoken + Benachrichtigungsinhalt | `supabase/functions/send-push/anbieter.ts:57` |

**Das Store-Formular darf nicht mehr behaupten als die Erklärung.** Umgekehrt
darf die Erklärung nicht weniger nennen als das Formular. §13 gehört ergänzt,
bevor eingereicht wird — sonst widersprechen sich zwei Dokumente, die beide
öffentlich sind.

**Entwarnung bei capgo:** Es ist eine **Bibliothek, kein Empfänger.**
`capacitor.config.ts:97-99` setzt `updateUrl`, `channelUrl` und `statsUrl` auf
eigene Supabase-Funktionen (`ota-update`, `ota-channel`, `ota-stats`). Es fließt
nichts zu `plugin.capgo.app`. Das ist erwähnenswert, weil die Voreinstellung des
Plugins genau dorthin zeigt — die Datei warnt selbst davor.

### 2. Stripe ist verdrahtet, und das ist ein Apple-Risiko — kein Datenschutzthema

`/mitgliedschaft` ruft `create-checkout-session` (`MitgliedschaftPage.tsx:35`)
und führt zu Stripe-Checkout für Stufen-Upgrades.

> ⚠️ **Korrigiert am 13.09. nach der Sichtprobe.** Hier stand zuerst, die Route
> sei „unverlinkt". Das stimmt nur für das Hauptmenü. Auf dem Screenshot der
> Profilseite steht ein sichtbarer Knopf **„Mitgliedschaft verwalten"** —
> `MembershipSummary.tsx:30`, ein `<Link to="/mitgliedschaft">`, und er
> erscheint auch auf der höchsten Stufe. Ein Prüfer findet den Weg also auf der
> zweiten Seite, die er öffnet, nicht nur durch Raten einer Adresse. Der Befund
> wurde damit deutlich schärfer, nicht milder.

Zum Go-Live sind alle Mitglieder `impact` — zu kaufen gibt es faktisch nichts,
aber der Weg dorthin ist sichtbar und funktionsfähig.

Für das Datenschutzformular ändert das wenig. **Für die Apple-Prüfung schon:**
Richtlinie 3.1.1 verlangt In-App-Kauf für digitale Inhalte, die in der App
genutzt werden. Eine erreichbare Route zu externem Checkout ist die
Standardursache für eine Ablehnung nach 3.1.1 — und anders als 4.2 lässt sie
sich nicht wegargumentieren.

> ### ✅ ERLEDIGT am 25.09. (AGE-907) — der Kaufweg ruht
>
> Die Empfehlung hier lautete, „den Knopf und die Route abzuschalten —
> `showManageCta` auf der einen Seite, der Route-Eintrag auf der anderen, zwei
> Stellen, beide klein". **Die Zahl war falsch: es waren sieben.** Gezählt am
> 25.09. mit `grep -rn '"/mitgliedschaft"' src/` — neben dem Knopf auf der
> Profilseite ein Eintrag im Profilmenü, eine Kachel auf der Startseite, ein
> Knopf in den Einstellungen, der Knopf „Upgrade" auf jeder Stufen-Wand, der
> Sprung aus der Kopfzeilen-Suche und ein Link am Event.
>
> **Und der Befund war noch schärfer als der Nachtrag vom 13.09. sagt.** Dort
> steht, der Knopf erscheine „auch auf der höchsten Stufe" — das trifft den Knopf,
> aber nicht die Preise. `MitgliedschaftPage.tsx:31` trägt
> `zeigtPreise = tier !== "impact"`: ein `impact`-Konto sieht die Seite ohne jede
> Preiskarte, und weil der Import-Kreis **ganz** auf `impact` liegt, wirkte die
> Fläche beim Nachsehen leer. Mit `connect` gerendert — der Stufe des
> Prüferkontos nach `docs/pruefer-zugang.md` — waren es sechs Preiskarten, vier
> Upgrade-Knöpfe und die Beträge 150/300/600/1200 € pro Jahr.
>
> Umgesetzt ist nicht „abschalten", sondern **ruhend stellen**: alle sieben
> Einstiege sind fort, `/mitgliedschaft` leitet in `App.tsx` auf `/` um, und
> Seite, Preiskarten und beide Edge Functions bleiben unverändert im Code. Der
> Rückweg für AGE-908 sind zwei Zeilen. `redirect-targets.test.ts` hält es zu.

### 3. `POST_NOTIFICATIONS` — der Verdacht war falsch

> ### ✅ WIDERLEGT am 25.09. (AGE-907). `POST_NOTIFICATIONS` **steht** im
> zusammengeführten Manifest. Es ist **nichts zu ergänzen.**
>
> Beigetragen von **`com.google.firebase:firebase-messaging:25.0.1`**, laut
> `android/app/build/outputs/logs/manifest-merger-debug-report.txt`:
> `ADDED from [com.google.firebase:firebase-messaging:25.0.1] … :23:5-77`.
>
> Gemessen in **beiden** Varianten — `processDebugMainManifest` und
> `processReleaseMainManifest`, Berechtigungsmengen zeichengleich. Die
> Release-Variante zählt, denn die Beta wird als Release gebaut. Vollständig:
> `ACCESS_NETWORK_STATE`, `CAMERA`, `FOREGROUND_SERVICE`, `INTERNET`,
> `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`.
>
> **Warum der Verdacht entstand, und warum er trotzdem falsch war:** die zwei
> Messungen unten stimmen beide — die Quelldatei führt wirklich nur `INTERNET`
> und `CAMERA`, und kein `@capacitor`-Plugin deklariert die Berechtigung
> (`push-notifications@8.1.2` deklariert nur seinen `MessagingService`). Nur war
> das die falsche Frage: eine Berechtigung kann aus **jedem** AAR der
> Abhängigkeitskette kommen, und `firebase-messaging` ist die Bibliothek, die
> Push überhaupt ausliefert. Eine Verneinung über die Quelldatei und die
> Plugin-Manifeste kann über das Zusammengeführte nichts sagen.
>
> **Der Weg zum Merge-Ergebnis, weil er beim ersten Versuch scheiterte:**
> `npx cap update android` mit gesetztem `VITE_SUPABASE_URL` (der Wert ist für
> das Manifest belanglos — er baut nur die OTA-Endpunkte), davor
> `mkdir -p android/app/src/main/assets` und ein `dist/index.html`, weil `cap
> copy` sonst abbricht; dann `./gradlew :app:processDebugMainManifest` mit
> `JAVA_HOME` auf JDK 21 und `ANDROID_HOME` gesetzt. `android/app/build.gradle`
> verlangt zusätzlich `google-services.json` — für eine reine Manifest-Messung
> genügt eine Attrappe mit passendem `package_name`. **Und ohne Pipe laufen
> lassen:** `./gradlew … | tail` meldet Exit 0, während im Text `BUILD FAILED`
> steht.
>
> Der Gerätetest unten bleibt trotzdem sinnvoll — er belegt die **erteilte**
> Erlaubnis, nicht die deklarierte. Das sind zwei verschiedene Dinge.

Gemessen: `android/app/src/main/AndroidManifest.xml` führt nur `INTERNET` und
`CAMERA`. Kein Plugin-Manifest unter `node_modules/@capacitor*/` deklariert
`POST_NOTIFICATIONS`, die Firebase-Artefakte im Gradle-Cache auch nicht. Bei
`targetSdkVersion = 36` ist sie für Android 13+ **Pflicht**, sonst kann die
Laufzeitabfrage nicht gewährt werden und es erscheint nie eine Mitteilung.

⚠️ ~~**Das ist ein Verdacht, kein Beweis.**~~ Aufgelöst, siehe Kasten oben. Das
zusammengeführte Manifest ließ sich am 13.09. nicht bauen —
`./gradlew :app:processDebugMainManifest` brach an
`capacitor-cordova-android-plugins/cordova.variables.gradle` ab, das erst
`cap sync` erzeugt. Am Gerät nachmessen lohnt weiter, aber für eine andere
Frage:

```
adb shell dumpsys package com.effbeezee.app | grep -i post_notifications
```

Push ist das stärkste Argument gegen Richtlinie 4.2. Wenn es auf Android nicht
ankommt, fehlt es genau dort, wo es zählt.

---

# Apple — App Privacy

Apple fragt je Datenart: **erhoben?** → **mit der Identität verknüpft?** →
**zum Tracking verwendet?** → **Zweck**.

Für dieses Produkt gilt durchgehend:

- **Verknüpft mit der Identität: JA.** Alles hängt am Mitgliedskonto. Es gibt
  keinen anonymen Bereich.
- **Zum Tracking verwendet: NEIN**, für jede einzelne Art. Es gibt keine
  Werbe-IDs, kein Datenteilen für Werbung, keine geräteübergreifende
  Zusammenführung.
- **Zweck: App Functionality**, bei Sentry zusätzlich **Analytics** im Sinne von
  Fehlerdiagnose (Apple führt „Diagnostics" als eigene Art, nicht als Zweck).

| Apple-Datenart | erhoben | Was genau, mit Beleg |
| --- | --- | --- |
| **Contact Info → Name** | ja | `profiles.name`, `display_name` |
| **Contact Info → Email Address** | ja | `auth.users.email`, `profile_contacts.email` |
| **Contact Info → Phone Number** | ja | `profile_contacts.phone` |
| **Contact Info → Physical Address** | ja | `profile_contacts`: `street`, `postal_code`, `city`, `state`, `country` |
| **Contact Info → Other** | ja | `profiles.website`, `socials` |
| **User Content → Photos or Videos** | ja | `post_media`, `profiles.avatar_url`/`cover_url`, Kamera und Mediathek |
| **User Content → Other User Content** | ja | `posts`, `comments`, `bio`, `short_bio`, `headline`, `goals`, `offers`, `needs`, `compass_responses` |
| **User Content → Customer Support** | ja | `feedback` |
| **Identifiers → User ID** | ja | `profiles.id` (UUID), `member_number` |
| **Identifiers → Device ID** | ja | `push_tokens.token` (APNs/FCM-Gerätetoken) |
| **Purchases → Purchase History** | ja | `profile_legacy.legacy_price`, `paid_until`; Stripe-Abo bei Upgrades |
| **Diagnostics → Crash Data** | ja | Sentry |
| **Diagnostics → Performance Data** | ja | Sentry Tracing (`instrument.ts:37`) |
| **Diagnostics → Other Diagnostic Data** | ja | Sentry Session Replay **nur im Fehlerfall**, `maskAllText: true`, `blockAllMedia: true` |
| **Messages** (unter User Content) | ja | `messages`, `message_threads` — Direktnachrichten zwischen Mitgliedern |

**Ausdrücklich NEIN**, jeweils gemessen:

| Datenart | Beleg für „nein" |
| --- | --- |
| **Location** (genau oder grob) | keine `geolocation`-API, kein Standort-Plugin, keine Standortberechtigung. `profiles.region` ist ein **selbst getipptes Freitextfeld**, kein Gerätestandort |
| **Contacts** (Adressbuch) | kein Kontakte-Plugin, keine `READ_CONTACTS`-Berechtigung |
| **Browsing History** / **Search History** | kein Suchverlauf gespeichert — keine Tabelle, keine Spalte |
| **Usage Data** | keine Reichweitenmessung. Ein Test (`datenschutz.test.ts`) prüft den Quelltext gegen `gtag(`, `google-analytics`, `plausible.io`, `matomo` |
| **Health & Fitness**, **Financial Info** (Zahlungsmittel), **Sensitive Info** | nicht erhoben. Kartendaten sieht ausschließlich Stripe; die App bekommt sie nie zu Gesicht |

**Account Deletion:** ✅ vorhanden, in der App, Einstellungen → Konto löschen
(`src/lib/konto-loeschen.ts`, seit 08.09.). Apple fragt das im
Einreichungsformular separat ab.

---

# Google — Data safety

Google fragt je Art: **erhoben?** · **geteilt?** · **zwingend oder optional?** ·
**Zweck**.

> **„Geteilt" heißt bei Google: an einen Dritten übertragen, der es für eigene
> Zwecke nutzt.** Auftragsverarbeiter zählen nicht dazu. Supabase, Cloudflare,
> Resend, Sentry, APNs und FCM sind Auftragsverarbeiter — also **erhoben, nicht
> geteilt**. Stripe ist der Grenzfall: es verarbeitet Zahlungen auch nach eigenen
> regulatorischen Pflichten. **Das ist die eine Stelle, an der ich dir keine
> Antwort abnehme.**

| Google-Kategorie | erhoben | geteilt | zwingend? |
| --- | --- | --- | --- |
| Personal info → Name | ja | nein | zwingend |
| Personal info → Email address | ja | nein | zwingend |
| Personal info → User IDs | ja | nein | zwingend |
| Personal info → Address | ja | nein | **optional** (Profilangabe) |
| Personal info → Phone number | ja | nein | **optional** |
| Personal info → Other info | ja | nein | optional (Firma, Branche, Rollen, Kompetenzen, Ziele) |
| Financial info → Purchase history | ja | *(Stripe: du entscheidest)* | zwingend bei Upgrade |
| Photos and videos → Photos | ja | nein | **optional** |
| Messages → Other in-app messages | ja | nein | optional |
| App info and performance → Crash logs | ja | nein | zwingend |
| App info and performance → Diagnostics | ja | nein | zwingend |
| Device or other IDs | ja | nein | **optional** (nur mit erlaubten Mitteilungen) |

**Nicht erhoben:** Location · Contacts · Calendar · App activity (keine
Analytik) · Web browsing history · Health and fitness · Audio · Files and docs ·
Installed apps.

**Die drei Pflichtangaben darunter:**

| Frage | Antwort | Beleg |
| --- | --- | --- |
| Daten bei der Übertragung verschlüsselt? | **ja** | ausschließlich HTTPS, mit HSTS erzwungen: `Strict-Transport-Security: max-age=63072000; includeSubDomains` (`public/_headers:27`) |
| Können Nutzer Löschung verlangen? | **ja, in der App** | `src/lib/konto-loeschen.ts` |
| Unabhängige Sicherheitsprüfung? | **nein** | keine vorhanden — „nein" ist hier keine Schwäche, sondern der Normalfall |

**App access** (eigenes Feld, nicht Data safety): angeben, dass **alle**
Funktionen hinter der Anmeldung liegen, und die Prüfer-Zugangsdaten eintragen —
Text steht in `docs/pruefer-zugang.md`.

---

## Was vor dem Absenden noch zu tun ist

1. **§13 der Datenschutzerklärung um APNs und FCM ergänzen** (Befund 1). Die
   Formulare dürfen nicht mehr nennen als die Erklärung.
2. ~~**Über Stripe entscheiden** (Befund 2)~~ — **erledigt am 25.09.** (AGE-907):
   der Kaufweg ruht, `/mitgliedschaft` ist umgeleitet. Nicht „für iOS", sondern
   überall.
3. ~~**`POST_NOTIFICATIONS` am Gerät nachmessen** (Befund 3)~~ — als
   Voraussetzung **entfallen**: die Berechtigung steht im zusammengeführten
   Manifest (25.09., aus `firebase-messaging:25.0.1`). Der Gerätetest bleibt als
   Beleg der **erteilten** Erlaubnis sinnvoll und steht in AGE-907, blockiert die
   Formulare aber nicht.
4. **Die Stripe-Zeile in Googles „geteilt"-Spalte** selbst beantworten.
5. Verarbeitungsregionen für Cloudflare, Resend und Stripe nachtragen — die
   Erklärung sagt an drei Stellen selbst „noch nicht belegt".
