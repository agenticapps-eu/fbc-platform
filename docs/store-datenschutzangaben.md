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
und führt zu Stripe-Checkout für Stufen-Upgrades. Die Route hat **keinen
Menüeintrag** (`nav.ts`, `section: "sub"`), und zum Go-Live sind alle Mitglieder
`impact` — es gibt faktisch nichts zu kaufen.

Für das Datenschutzformular ändert das wenig. **Für die Apple-Prüfung schon:**
Richtlinie 3.1.1 verlangt In-App-Kauf für digitale Inhalte, die in der App
genutzt werden. Eine erreichbare Route zu externem Checkout ist die
Standardursache für eine Ablehnung nach 3.1.1 — und anders als 4.2 lässt sie
sich nicht wegargumentieren.

**Empfehlung: die Route vor der iOS-Einreichung abschalten.** Sie ist ohnehin
unverlinkt und ohne Funktion. Das ist eine Zeile und nimmt eine ganze
Ablehnungsklasse vom Tisch. Deine Entscheidung — ich habe nichts geändert.

### 3. `POST_NOTIFICATIONS` steht in keinem Manifest

Gemessen: `android/app/src/main/AndroidManifest.xml` führt nur `INTERNET` und
`CAMERA`. Kein Plugin-Manifest unter `node_modules/@capacitor*/` deklariert
`POST_NOTIFICATIONS`, die Firebase-Artefakte im Gradle-Cache auch nicht. Bei
`targetSdkVersion = 36` ist sie für Android 13+ **Pflicht**, sonst kann die
Laufzeitabfrage nicht gewährt werden und es erscheint nie eine Mitteilung.

⚠️ **Das ist ein Verdacht, kein Beweis.** Das zusammengeführte Manifest konnte
ich nicht bauen — `./gradlew :app:processDebugMainManifest` bricht an
`capacitor-cordova-android-plugins/cordova.variables.gradle` ab, das erst
`cap sync` erzeugt, und das braucht Infisical. Entschieden wird es am Gerät:

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
2. **Über Stripe entscheiden** (Befund 2): Route für iOS abschalten, oder das
   3.1.1-Risiko bewusst tragen.
3. **`POST_NOTIFICATIONS` am Gerät nachmessen** (Befund 3).
4. **Die Stripe-Zeile in Googles „geteilt"-Spalte** selbst beantworten.
5. Verarbeitungsregionen für Cloudflare, Resend und Stripe nachtragen — die
   Erklärung sagt an drei Stellen selbst „noch nicht belegt".
