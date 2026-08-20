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

> **Korrigiert in Nachtrag 4:** die zweite Haelfte stimmt, die erste nicht.
> Avatare und Titelbilder kamen von **PROD** — `avatar_url`/`cover_url` tragen
> absolute URLs mit der PROD-Projektkennung. Lokal kamen nur `event-covers`
> und `post-media`.

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

---

# Nachtrag 2 — 5.2 und 5.3: der zweite Lauf gegen DEV, Exit 0

**2026-08-20, 19:32.** Derselbe Auszug, dieselbe Ablage, mit der Regel aus dem
ersten Nachtrag. Durchgelaufen bis zur Abnahme.

Der Leeren-Schritt räumte diesmal **22 auth-Tabellen statt 2** und zählte jede
davon auf 0 nach. 4.1b meldete 61 Fremdschlüssel ohne eine verwaiste Zeile.

## Unabhängig nachgerechnet, nicht aus dem Eigenprotokoll

Das Skript nimmt sich selbst ab; das ist ein Zirkelschluss, solange niemand
danebenrechnet. Also ein zweiter Manifestlauf gegen DEV und ein Vergleich gegen
`manifest.json` **des Auszugs**:

| | |
|---|---|
| Zeilen | 876 vorher → **858** (857 aus dem Auszug + 1) |
| Tabellen | 36, alle mit passender Zeilenzahl |
| Objekte | 125, **alle 125 eTags gleich** |
| `auth`-Reste | nur `users` (72), `identities` (72), `schema_migrations` (77) |
| Stufen | `basic`…`focus` je 1, `impact` 67 |
| Rollen | `admin` 3, `matching_manager` 1 |

**Genau drei Abweichungen, alle vorher deklariert:** `auth.users` (Hash — 4.13
neutralisiert die Passwörter), `public.profiles` (Hash — Stufen zugewiesen) und
`public.staff_roles` (3 → 4 — die `matching_manager`-Zeile).

## 4.8a ist belegt

`notify_contact_request_webhook()` und `contact_requests_email_webhook` stehen
nach dem Lauf beide noch, und die Funktion zeigt unverändert auf
`…/functions/v1/notify-contact-request`. Lokal war das nur eine Warnung, weil
beide dort gar nicht existieren.

## 4.7 ist zu einem Drittel belegt — und das ist wichtig

Echt gemessen ist `trg_event_feed_post`: acht Events wurden eingespielt,
`public.posts` steht danach auf **29 wie im Manifest**, also null
Zusatzbeiträge.

Die beiden anderen Hälften sind **leer gelaufen, nicht bestanden**: der Auszug
trägt `contact_requests = 0` und `notifications = 0`. Es gab nichts, worauf
`contact_requests_lifecycle` und `contact_requests_email_webhook` hätten feuern
können. Wer das später als „gegen Post geprüft" liest, liest mehr als dasteht.

## Was DEV jetzt ist — und wo das eine offene Flanke hat

DEV trägt **72 Konten mit 72 echten Adressen** und einen **lebenden
E-Mail-Webhook**, der auf die DEV-Edge-Function zeigt. Nach der
Secret-Trennung (`dev-prod-secret-split-unvollstaendig`) ist der Resend-Zugang
zwischen DEV und PROD byte-identisch — eine Kontaktanfrage auf DEV schickt
damit **echte Post an echte Mitglieder**, abgeschickt aus einer Testumgebung.

Was heute davor steht: alle 72 Passwort-Hashes sind neutralisiert, es kann sich
niemand anmelden, und `contact_requests` ist leer. Die Selbstregistrierung ist
aber offen (`import-impact-selbstregistrierung-basic`).

**Kein Blocker für diese Änderung, aber ein eigener Posten** — er gehört auf die
Rücknahmeliste vor Go-Live, nicht in diesen Diff.

---

# Nachtrag 3 — 5.6: der Auszug darf „Sicherung" heissen

**2026-08-20.** Bis hierher war 5.6 halb belegt: der Bestand entstand aus einem
leeren Schema, die **Anmeldefähigkeit** nicht — 4.13 nimmt sie absichtlich.

## Der Schalter lässt zwei Dinge aus, nicht eines

`--sicherung` überspringt 4.13 **und** den deklarierten DEV-Bestand aus
4.9/4.10. Das zweite ist beim Bauen aufgefallen, nicht beim Planen: mit nur
4.13 ausgelassen meldete die Abnahme **zwei** Abweichungen statt null — fünf
umgeschriebene Stufen und die `matching_manager`-Zeile. Das ist kein
Manifest-Bestand, sondern ein **DEV-Bestand mit echten Hashes**, also die
schlechteste der drei möglichen Fassungen.

Im Sicherungslauf ist die Deklaration deshalb leer: es darf nichts abweichen,
und jede Abweichung wäre ab da ein Abbruch.

## Gegen DEV ist er abgelehnt, nicht abgeraten

```
$ … --ziel=dev --sicherung <ablage>
::error::--sicherung ist gegen dev abgelehnt. Der Schalter gehört zur
Sicherungs-Rolle (PROD-Wiederaufbau); auf DEV nähme er den Ausgleich zurück,
der die fehlende Anonymisierung trägt.
```

Der Abbruch kommt **vor jedem Verbindungsaufbau** — keine „Wächter frei"-Zeile
davor. Ein Warnhinweis hätte hier nicht gereicht: der Schalter kommt aus einer
Befehlszeile, die man kopiert, und die gefährliche Fassung unterscheidet sich
von der harmlosen um ein einziges Wort.

## Die drei Messungen

Alle gegen den lokalen Stack, aus demselben gespeicherten Auszug.

**(a) Rot — ohne Schalter.** 72 Hashes durch Zufallswerte ersetzt.
**0 von 72** stehen byteweise im Auszug. Anmeldung mit dem bekannten
Kontrollpasswort: **HTTP 400, „Invalid login credentials"**.

**(b) Grün — mit Schalter.** **72 von 72** Hashes stehen byteweise so im
Auszug. Die Abnahme meldet **0 gewollte Abweichungen** (ohne Schalter: 3).
36 Tabellen und 125 Objekte stimmen.

**(c) Die Kontrolle, ohne die (b) nichts belegte.** Dass „Hash steht wieder da"
gleich „Konto ist anmeldefähig" ist, wäre sonst eine Annahme. Also eigens
gemessen: ein per SQL gesetzter, **bekannter** bcrypt-Hash — auf demselben Weg,
den 4.13 zum Neutralisieren benutzt — ergibt **HTTP 200 mit Token**. GoTrue
prüft also gegen genau die Spalte, die der Rücklauf schreibt.

Aus (b) und (c) zusammen folgt die Anmeldefähigkeit. **Ein echtes
PROD-Passwort ist dabei nicht verwendet worden** und wird auch nicht gebraucht;
es ist hier niemandem bekannt, und es zu erfahren wäre kein zulässiger Weg zu
diesem Beleg.

## Hinterher aufgeräumt

Nach (b) trug der lokale Stack echte Produktions-Hashes. Ein Lauf ohne den
Schalter hat sie wieder neutralisiert — nachgezählt: **0/72** stehen noch im
Auszug, die Abnahme meldet wieder ihre drei deklarierten Abweichungen.

## Was der Schalter nicht ist

Er ist **kein** PROD-Wiederaufbau. `--ziel` kennt `lokal` und `dev`; ein
`--ziel=prod` gibt es nicht und ist hier auch nicht gebaut worden — für einen
Aufrufer, den es nicht gibt, wird nichts vorgehalten. Was 5.6 verlangt, ist der
Beleg, dass der Auszug diese Rolle **tragen kann**, und der steht.

---

# Nachtrag 4 — 5.5 auf der ausgelieferten Flaeche

**Datum:** 2026-08-20, abends · **Ziel:** `https://fbc-platform.pages.dev`,
also DEV. Das ist der einzige Teil des Spiegels, den bis hierher niemand
angesehen hatte: 5.5 lief gegen den **lokalen** Stack, und ein lokaler Build
sagt nichts ueber das, was ausgeliefert ist.

## Dass die Flaeche wirklich gegen DEV liest, ist gemessen

Das Bundle wurde mit `Cache-Control: no-cache` geholt (1,3 MB — kein 404, das
sich als Bundle tarnt) und enthaelt **genau eine** Supabase-Projekt-URL:
`foelowldexkcqzewvrcf`. Nicht aus der Konfiguration geschlossen, sondern im
ausgelieferten Bundle gelesen.

## Anmeldung: warum es dafuer einen Eingriff brauchte

Nach 4.13 tragen alle 72 Konten einen zufaelligen Hash — auf DEV kann sich
niemand anmelden, und ohne Anmeldung ist das Verzeichnis gesperrt. Fuer die
Probe hat **ein** Konto voruebergehend ein Wegwerf-Passwort bekommen, gesetzt
per SQL ueber denselben Weg, den 4.13 zum Neutralisieren benutzt
(`crypt(…, gen_salt('bf'))`).

Gewaehlt wurde `vorschau@fbc.invalid`: die TLD `.invalid` existiert nicht, das
Konto hat also keinen erreichbaren Posteingang — kein echtes Mitglied wurde
angefasst. Das Passwort stand nie im Repo und ist zurueckgenommen:

| Schritt | Beleg |
|---|---|
| gesetzt | `1/72` Konten tragen es |
| zurueckgenommen | `0/72` Konten tragen es |
| Gegenprobe an der Flaeche | Anmeldung antwortet **„Invalid login credentials"** |

Die dritte Zeile ist die eigentliche: die DB-Zaehlung allein wuerde nur
behaupten, dass aufgeraeumt ist.

## Was gesehen wurde

Ausgeloggt:

| Flaeche | Ergebnis |
|---|---|
| Startseite | laedt, 3 echte oeffentliche Beitraege |
| Events auf der Startseite | „keine Events geplant" — **kein Defekt**, alle 8 Events sind `visibility='members'` |
| `/mitglieder` | gesperrt („ab Discover verfuegbar"), keine Mitgliedsdaten sichtbar |
| Beitragsautoren | „Ein Mitglied" — bekannt (AGE-530), `anon` haelt kein Recht auf `profiles_public` |

Eingeloggt:

| Flaeche | Ergebnis |
|---|---|
| Verzeichnis | **36 Mitglieder**, echte Namen, Stufenabzeichen, Kopfzeilen, Orte |
| Profil (Detlev Krause) | Titelbild, Avatar, Ueber mich, Beruf, Hobbys, Ich biete, Ich suche, 3 Aktivitaeten, Eckdaten „Mitglied seit Juli 2018", Erfolgsradar, Video, Kontakt-Gate |
| Aktivitaet | Beitraege mit **echten Autorennamen** (0 × „Ein Mitglied"), Tags, Zeitangaben |
| Events | **7 kommende, 1 vergangene** — deckt sich mit der DB; Anmeldezahlen (17/22/9/10/14/8/6) und Kontingente sind mitgekommen |
| `/admin/mitglieder` | echte Namen und Anmeldeadressen, Zustand, Paging („Mitglieder 1–25") |
| Konsole | ueber **alle** Seiten leer (keine `error`, keine `warn`) |

**Nicht angefasst:** „Kontaktanfrage senden" und „Zugangslink schicken". DEV
traegt 72 echte Adressen und einen lebenden E-Mail-Webhook mit
PROD-identischem Resend-Zugang — beide Knoepfe haetten echte Post ausgeloest.

## Der Befund: `avatar_url` und `cover_url` sind absolute **PROD**-URLs

Im Verzeichnis zeigen die Bild-URLs auf `viwntbodrtqxgmqyxluh` — auf PROD, auf
einer Flaeche, die ihre Daten aus DEV liest. Das kommt nicht aus dem Bundle
(dort steht nur die DEV-URL), sondern aus den Daten:

| Spalte | gesetzt | zeigt auf PROD | zeigt auf DEV | relativ |
|---|---|---|---|---|
| `profiles.avatar_url` | 56 | **56** | 0 | 0 |
| `profiles.cover_url` | 53 | **53** | 0 | 0 |

Ein Durchlauf ueber **alle** `text`-Spalten aller `public`-Tabellen findet genau
diese zwei — sonst keine. `event-covers` und `post-media` laufen ueber Pfade und
signierte URLs und lesen daher tatsaechlich aus DEV.

Im Browser gemessen, nicht geschlossen: auf der Profilseite sind beide Bilder
**geladen** (`naturalWidth` 1500×500 und 512×512) — von PROD.

**Der Spiegel selbst ist in Ordnung.** Dasselbe Objekt, beide Seiten:

```
viwntbodrtqxgmqyxluh   HTTP 200  35364 Bytes
foelowldexkcqzewvrcf   HTTP 200  35364 Bytes
```

Byteweise dieselbe Groesse. Die 111 kopierten `avatars`/`covers`-Objekte auf DEV
sind vollstaendig — sie werden nur **nie gelesen**, weil die gespeicherte URL
woanders hinzeigt.

### Korrektur an 5.5

Der Satz weiter oben, „Alle Bilder kamen aus dem lokalen Storage", ist fuer
Avatare und Titelbilder **falsch**. Auch lokal trug die Zeile eine absolute
PROD-URL; die Bilder kamen ueber das Internet von PROD, nicht aus
`127.0.0.1:54321`. Nur `event-covers` und `post-media` kamen wirklich lokal.
Der Sichtbefund „keins blieb leer" stimmt — die Herkunft war falsch zugeordnet.

### Warum das ueber diese Aufgabe hinaus zaehlt

Die URL enthaelt die **Projektkennung**. Ein PROD-Neuaufbau unter einer neuen
Kennung laesst alle 109 Bild-URLs ins Leere zeigen, obwohl die Objekte
mitgezogen waeren. Das gehoert in `docs/prod-neuaufbau-plan.md` (6.2) — als
Schritt, nicht als Fussnote.

Zweitens: solange das so steht, laedt jede DEV-Seite Bilder von PROD. Folgenlos,
weil beide Buckets oeffentlich sind — aber es heisst, dass DEV nicht fuer sich
allein steht.

## Sieben „kaputte" Bilder, die keine waren

Die erste Messung auf `/aktivitaet` meldete 7 Bilder mit `naturalWidth = 0`.
Nach einmal Scrollen blieben 2, beide mit `loading="lazy"` und ausserhalb des
Sichtfensters; beide antworten einzeln geholt mit HTTP 200. Kein kaputtes Bild —
`complete && naturalWidth > 0` misst bei Lazy-Loading den Ladezustand, nicht die
Erreichbarkeit.
