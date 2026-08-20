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

---

# Nachtrag — 5.2, erster Lauf gegen DEV: Abbruch, Ursache, Behebung

**2026-08-20, 19:20.** Der Lauf gegen DEV ist abgebrochen. Das ist kein
Rückschlag, sondern der einzige Grund, warum 5.2 existiert: lokal war der Fall
nicht herstellbar.

## Wo er stehen blieb

```
── 4.1a/4.1b: Trigger und Fremdschlüssel
   ✔ 18 Trigger stehen unverändert auf 'O'
::error::4.1b verletzt — verwaiste Zeilen:
   one_time_tokens_user_id_fkey (auth.one_time_tokens → auth.users): 1;
   sessions_user_id_fkey (auth.sessions → auth.users): 13
```

Alles davor war grün: 125 Objekte byteweise bestätigt, vier Buckets geleert
(5 + 13 Objekte entfernt), `session_replication_role = replica` gesetzt **und**
nachgelesen, 72 Konten und 72 Identitäten eingespielt, 4.5 belegt.

## Ursache

Der Leeren-Schritt räumte `auth.users` und `auth.identities` — eine **Liste mit
zwei Einträgen**. Zurück blieben die Sitzungsdaten der alten DEV-Demokonten.
Gemessen nach dem Abbruch:

| Tabelle | Zeilen | davon verwaist |
|---|---|---|
| `auth.sessions` | 13 | 13 |
| `auth.refresh_tokens` | 81 | — hängt an `sessions`, nicht an `users` |
| `auth.mfa_amr_claims` | 13 | — hängt an `sessions` |
| `auth.one_time_tokens` | 1 | 1 |

**Alle betroffenen Fremdschlüssel sind `ON DELETE CASCADE`.** Getragen haben sie
trotzdem nicht: `session_replication_role = replica` legt die Cascade-Trigger
mit stiil. Im replica-Modus verschwindet **nur, was benannt wird** — genau die
Eigenschaft, wegen der Entscheidung 2b den Schalter überhaupt braucht.

Bemerkenswert: `refresh_tokens` und `mfa_amr_claims` hätte die 4.1b-Prüfung
**nie gemeldet**, weil sie auf `sessions` zeigen und nicht auf `users`. Der
gemeldete Befund war also kleiner als der tatsächliche.

## Warum der lokale Lauf davon nichts sagen konnte

Der lokale Stack trug **keine Sitzungen** — niemand hatte sich je angemeldet.
Erst die Sichtprobe aus 5.5 hat dort ein Konto anmeldefähig gemacht und damit
2 `sessions`, 2 `refresh_tokens`, 2 `mfa_amr_claims` und 3 `audit_log_entries`
erzeugt. Ab da war der lokale Stack zum ersten Mal ein Abbild des DEV-Falls.

## Behebung

`authTabellenZumLeeren()` ersetzt die Namensliste durch eine **Regel**: jede
Basistabelle im Schema `auth` ausser `schema_migrations` (GoTrues eigene
Historie, sie gehört zur laufenden Fassung des Dienstes). `users` steht
zuletzt, damit die Reihenfolge auch dann trägt, wenn der replica-Schalter
einmal nicht greift.

Eine Namensliste war hier nicht bloss unvollständig, sondern die falsche
Bauform: GoTrue stellt Tabellen dazu — `oauth_consents` und `webauthn_*` sind
neu —, und keine davon fände je den Weg in eine von Hand gepflegte Liste.

**Dazu die Zusage, die gefehlt hat.** Geprüft wurde bisher „`auth.users` ist
leer". Jetzt wird **jede** geleerte auth-Tabelle nachgezählt, direkt im
Leeren-Schritt. Am 2026-08-20 kam der Abbruch vier Schritte später aus der
Fremdschlüsselprüfung — mit einem bereits halb eingespielten Ziel.

## Beleg

Vier Tests, erst rot, dann grün. Danach ein voller Lauf gegen den lokalen Stack
**mit** Sitzungen im Bestand, Exit 0:

```
✔ 34 public-Tabellen und 22 auth-Tabellen geleert (…), alle nachgezählt auf 0
✔ 4.1b: 61 Fremdschlüssel eigens geprüft, keine verwaiste Zeile
✔ 36 Tabellen und 125 Objekte stimmen; 3 gewollte Abweichungen benannt
```

Nachgezählt im lokalen `auth` nach dem Lauf: nur noch `users` (72),
`identities` (72) und `schema_migrations` (76). Sitzungen, Refresh-Token,
MFA-Ansprüche und Audit-Zeilen sind weg, die Historie steht.

## Zustand von DEV nach dem Abbruch

DEV steht **halb eingespielt** und muss den Lauf erneut bekommen: 72 Konten,
72 Identitäten, 72 Profile, 3 Admin-Zeilen — aber **alle Buckets leer**
(0 Objekte; der Upload kommt erst nach der abgebrochenen Prüfung), alle Profile
auf `impact` (der deklarierte DEV-Bestand aus §3a fehlt), kein
`matching_manager`, und die 14 verwaisten auth-Zeilen stehen noch.

`session_replication_role` steht wieder auf `origin` — nachgelesen. Der
Wiederholungslauf räumt den Rest selbst; ein Eingriff von Hand ist nicht nötig
und wäre schädlich, weil er die Ausgangslage des nächsten Laufs verschöbe.
