# Gruppe 5, Aufgabe 5.5 — Sichtprobe in der laufenden Oberfläche

**Datum:** 2026-08-20 · **Ziel:** lokaler Stack (`127.0.0.1:54321`),
bespielt aus `~/.fbc-spiegel/spiegel-viwntbodrtqxgmqyxluh-20260820T165007Z`.
**DEV und PROD sind nicht geschrieben worden** — PROD wurde einmal gelesen
(`default_transaction_read_only = on`), sonst nichts.

## Warum diese Aufgabe überhaupt existiert

Gruppe 4 hat den Rücklauf gegen Zeilenzahlen, Zeilenhashes, 61 Fremdschlüssel
und 125 Objektprüfsummen belegt. Keine dieser Zusagen sagt, ob aus den Zeilen
wieder **ein Profil** wird. Genau an dieser Stelle hat in AGE-492 schon einmal
eine grüne Testsuite ein sichtbar falsches Ergebnis durchgewunken.

## Aufbau

Der lokale Stack trug den Spiegel noch aus 5.1: 72 Konten, 72 Profile,
36 Tabellen, 125 Objekte (57 `avatars`, 54 `covers`, 8 `event-covers`,
6 `post-media`), 3 Admin- und 1 `matching_manager`-Zeile, Stufen
`basic`…`focus` je einmal und 67 × `impact`.

4.13 hatte alle Passwort-Hashes neutralisiert, also war kein Konto
anmeldefähig. Für die Probe hat **ein** übernommenes Konto lokal per
GoTrue-Admin ein Passwort bekommen (`impact`, aktiviert, keine Stabsrolle).
Die Anmeldung gegen `token?grant_type=password` antwortete 200 mit Token.

Die Oberfläche lief als `vite` mit `VITE_SUPABASE_URL=http://127.0.0.1:54321` —
**nicht** über `pnpm dev`, denn das startet `infisical run --env=dev` und
redete damit gegen DEV.

## Was gesehen wurde

Fünf echte Profile, jedes einzeln aufgerufen:

| Profil | Titelbild | Avatar | Anschrift | Inhalt |
|---|---|---|---|---|
| Detlev Krause | DK Real Invest | ja | Stuttgart | Über mich, Beruf, Hobbys, Ich biete, Ich suche, 3 Aktivitäten, Erfolgsradar |
| Adrian Mühleisen | AB Webstudios | ja | — | Über mich, Hobbys, 1 Beitrag |
| Leonard Lenz | Netzwerk-Motiv | ja | Frankfurt am Main | Über mich, Hobbys |
| Thorsten Kicherer | Genesis FX Trading | ja | Stuttgart | Über mich, Beruf, Hobbys, Ich biete, Ich suche |
| Carsten Dohmann (eigenes) | evigo.energy | ja | Münster | Interessen, eigener Beitrag, Events 3 |

Das Verzeichnis meldete **36 Mitglieder** — 37 aktivierte Profile minus das
eigene. Stufenabzeichen standen richtig (`IMPACT`, bei einem Konto `CONNECT`).
Alle Bilder kamen aus dem lokalen Storage, keins blieb leer.

**Die Konsole war über alle Seiten hinweg leer** (keine `error`, keine `warn`).

## Anschrift und Netzwerke — die Zusage trägt, aber nicht dort, wo 5.5 sie sucht

Auf der **öffentlichen** Profilseite stehen weder Netzwerke noch Anschrift. Das
ist kein Spiegel-Defekt, sondern Bestandscode: `profiles_public` führt neun
Spalten (`id, name, avatar_url, region, company, short_bio, tier, roles,
cover_url`) — `socials` und `website` sind nicht dabei, und keine Komponente
rendert sie öffentlich. `socials` erscheint im Quelltext ausschliesslich im
**Bearbeitungsformular** und in der Adminmaske.

Belegt wurde die Zusage deshalb dort, wo die Felder tatsächlich erscheinen —
im eigenen Profil unter `/profil/bearbeiten`. Aus dem Spiegel kamen an:

- **Anschrift** vollständig: Strasse, PLZ, Ort, Bundesland, Land
- **fünf Netzwerke**: LinkedIn, Instagram, Facebook, YouTube, Twitter
- dazu Website, Telefon, E-Mail, Interessen und zwei YouTube-Verweise

Damit ist „Bild, Anschrift und Netzwerke" belegt. **Als Beobachtung
festgehalten, nicht behoben** (ausserhalb dieser Änderung): 34 Profile tragen
Netzwerke, die auf keiner öffentlichen Fläche je zu sehen sind.

## Eine benannte Abweichung für 5.3

`storage.objects.owner` und `owner_id` stehen im Spiegel bei **allen 125**
Objekten auf `null`. Auf PROD gilt das für **117** — acht Objekte tragen dort
einen Eigentümer (1 `avatars`, 1 `covers`, 6 `post-media`).

Ursache: das Manifest führt `owner` nicht, und der Rücklauf lädt die Objekte
über die Storage-API mit dem Dienstschlüssel hoch — dabei bleibt `owner` leer.

**Folgenlos für Rechte**, und das ist gemessen, nicht vermutet: keine der
14 Policies auf `storage.objects` nennt `owner`. Alle entscheiden über den
Pfadanfang (`<uid>/…`). Die Abweichung gehört in den Manifestvergleich aus 5.3
als benannter Posten, nicht in eine Korrektur.
