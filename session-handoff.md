# Session Handoff — 2026-09-13 (Weg 1 entschieden, M4 vorbereitet)

> **Scope dieser Übergabe: M4 / AGE-644 — Store-Einreichung.** Prüfer-Zugang,
> Datenschutzangaben, Store-Material, dazu die vier Sicherheitsmeldungen. Fremde
> offene Punkte stehen hier bewusst NICHT; sie gehören den Sitzungen, die daran
> arbeiten. Die Fassung vom 12.09. führte den ganzen Repo-Zustand — das war
> Aufräumarbeit, die es nicht mehr gibt, und kein Grund, ihn wieder einzutragen.

> ## ⚠ ZUERST
>
> **1. Der Prüfer-Zugang ist entschieden: Weg 1.** Donald am 13.09. — normales
> Mitgliedskonto, Stufe `connect`, der Prüfer sieht die echte Gemeinschaft.
> Nicht neu aufrollen. Alles Operative steht in **`docs/pruefer-zugang.md`**,
> inklusive fertigem englischem Prüfhinweis-Text zum Einsetzen.
>
> **2. Zwei Risiken gefunden, die niemand gesucht hatte — beide OFFEN.**
> Stripe ist per sichtbarem Knopf auf der Profilseite erreichbar (Apple 3.1.1),
> und `POST_NOTIFICATIONS` steht in keinem Manifest (Android-Push käme nicht
> an). Details unten. **Ich habe nichts geändert** — beides ist Donalds Call.
>
> **3. AGE-644 stand fälschlich auf *Done*** und steht wieder auf *In Progress*.
> Geschlossen hatte es der Merge der Übergabe-PR #405, deren Branchname das
> Kürzel trug — bei acht offenen Abnahmezeilen.
>
> **4. Der lokale Supabase-Stack trägt jetzt meine Demo-Daten.** Zahlen unten.
> Wer dort fremde Datensätze findet: das sind meine.

## Was diese Sitzung getan hat

| PR | Inhalt | Zustand |
| --- | --- | --- |
| #407 | vier transitive Sicherheitsmeldungen per `pnpm.overrides` gehoben | gemerged `2f2f0f6` |
| #408 | `docs/pruefer-zugang.md` — Weg 1 belegt | gemerged `e8e9537` |
| #409 | `docs/store-datenschutzangaben.md` + `docs/store-assets/` (11 Bilder, 2 Skripte) | gemerged `9b4116f` |
| #411 | Mitteilungen auf dem Gerät in der Datenschutzerklärung | gemerged `433e644` |

Repo danach: **ein Branch, sauberer Arbeitsbaum**, `main` grün.

### Sicherheitsmeldungen (#407)

Alle vier steckten transitiv in `pnpm-lock.yaml`, nicht in `package.json` —
deshalb hatte Dependabot nichts geöffnet und `pnpm update` hätte sie nicht
erreicht. Es brauchte `pnpm.overrides`. `sharp` lag doppelt im Lock; der
Override kollabiert beide, daher **−318 Zeilen**.

Der riskante Sprung war **`uuid` 7 → 11** in `xcode`, das die Xcode-Projektdatei
schreibt. Nachgestellt statt angenommen: `generateUuid()` liefert unverändert
eine 24-stellige Kennung. Testzahl vorher wie nachher **247 / 2821**.

### Datenschutzangaben (#409)

Art für Art ausfüllfertig für Apple App Privacy und Google Data safety, jede
Zeile mit Beleg. Die gemessenen **Nein**-Zeilen kürzen das Formular am meisten:
kein Standort (keine API, kein Plugin, keine Berechtigung — `profiles.region`
ist getippter Freitext), keine Gerätekontakte, kein Suchverlauf, keine
Reichweitenmessung.

**Zwei Empfänger fehlten in der Datenschutzerklärung** — ✅ **erledigt mit
#411.** §13 war auf dem Stand vom 26.08., Push kam danach. Beim Nachziehen
zeigte sich, dass die Lücke größer war: `Push`, `Mitteilung`,
`Benachrichtigung`, `Apple` und `Google` kamen im ganzen Text **null Mal** vor,
§10 kannte nur E-Mail. Es fehlte nicht der Empfänger, sondern die Verarbeitung.
Jetzt ein eigener Abschnitt „Mitteilungen auf dem Gerät" plus beide Empfänger
in §13.

Entwarnung bei capgo: Bibliothek, kein Empfänger, weil
`capacitor.config.ts:97-99` alle drei Adressen auf eigene Supabase-Funktionen
legt.

### Store-Material (#409)

Zehn Screenshots (1290×2796 für Apple, 1080×1920 für Play) plus die
1024×500-Feature-Grafik, die Google zwingend verlangt. Gegen den lokalen Stack,
**kein Bild zeigt echte Mitglieder**: alle 27 `avatar_url` genullt (der Seed
setzt `i.pravatar.cc` — Fotos echter Menschen unter erfundenen Namen).

Beide Aufnahmeskripte liegen unter `scripts/`, das Rezept in
`docs/store-assets/README.md`.

## Die zwei offenen Risiken

**Stripe ist verlinkt, nicht nur erreichbar.** `/mitgliedschaft` →
`create-checkout-session` → Stripe. „Unverlinkt" stimmt nur fürs Hauptmenü: auf
der Profilseite steht **„Mitgliedschaft verwalten"** (`MembershipSummary.tsx:30`,
`<Link to="/mitgliedschaft">`), sichtbar auch auf `impact`. Apple-Richtlinie
**3.1.1** ist anders als 4.2 nicht wegargumentierbar. Abschalten wären zwei
kleine Stellen (`showManageCta` + Routeneintrag). ⚠️ Der Profil-Screenshot zeigt
diesen Knopf — solange offen, nicht an Apple geben.

**`POST_NOTIFICATIONS` steht in keinem Manifest.** Nur `INTERNET` und `CAMERA`;
kein Plugin-Manifest und keine Firebase-Artefakte deklarieren sie. Bei
`targetSdkVersion = 36` ist sie für Android 13+ Pflicht. **Verdacht, kein
Beweis** — das zusammengeführte Manifest liess sich nicht bauen
(`cordova.variables.gradle` entsteht erst bei `cap sync`, das Infisical
braucht). Gegenprobe:
`adb shell dumpsys package com.effbeezee.app | grep -i post_notifications`.

## Next session: start here

1. **Donald fragen, wie es mit Stripe weitergeht** (abschalten oder 3.1.1-Risiko
   tragen). Das ist die einzige Frage, die Bauarbeit auslösen kann.
2. **`POST_NOTIFICATIONS` am Gerät nachmessen.** Braucht Donalds Telefon.
3. Unverändert der längste Weg im Zeitplan: **Google-Konto anlegen und die
   Testzwang-Bedingungen dort ablesen.** Nur Donald.

~~§13 der Datenschutzerklärung um APNs und FCM ergänzen~~ — mit #411 erledigt.

Vor dem Anfangen `ListAgents` — am 13.09. liefen sechs Sitzungen, zwei in
diesem Repo.

## Lokaler Stack — meine Zahlen

27 Profile (alle aktiviert, alle `avatar_url = null`), 14 Beiträge, 8 Events,
6 Nachrichten, 44 Angebote, 47 Gesuche. Anmeldung
`hans-peter.stadler@demo.fbc.invalid` / `sichtprobe-lokal-2026`, Stufe `impact`.
`.env.local`, der vite-Server auf 5209 und `public/images/.sichtprobe/` sind
**entfernt**.

## Fünf Fallen dieser Sitzung

1. **Der Branchname ohne Kürzel verhindert das falsche *Done* — viermal
   belegt.** Meine Notiz sagte bisher „Vorbeugen geht gar nicht"; das war
   falsch. Ausgelöst wird von Branchname ODER PR-Titel — **nicht** vom
   Commit-Rumpf, nicht von Linear-Kommentaren und (bei #411 versehentlich
   getestet) **auch nicht vom Commit-Betreff auf `main`**.
2. **Die erste Screenshot-Runde schoss die ausgeloggte Sicht.** `/` trägt kein
   Anmeldeformular, es liegt auf `/login`; die Beiträge standen unter „Ein
   Mitglied". Sah brauchbar aus. Das Skript bricht jetzt ab, wenn keine Sitzung
   im Speicher liegt.
3. **Der Opt-in-Wächter des Demo-Seeds prüft den Zielhost nicht.** Er warnt
   wörtlich „This is the LIVE shared Supabase project", egal wohin er zeigt.
   Verlassen kann man sich nur auf `Target Postgres:` darüber.
4. **`cover_url` ist seit `bild_pfade_statt_urls` ein Speicherpfad.** Ein Wert
   ohne URI-Schema landet im Bucket-Pfad und bricht still als Bildplatzhalter.
5. **`deno install` vor `pnpm install`, nie danach** — die umgekehrte
   Reihenfolge zerlegt `node_modules`, und der Fehler (`Cannot find package
   '@tailwindcss/vite'`) sieht nach einem kaputten Projekt aus.
