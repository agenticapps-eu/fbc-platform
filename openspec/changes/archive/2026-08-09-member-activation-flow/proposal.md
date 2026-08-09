# Mitglieder-Aktivierung: das Passwort allein ist wertlos

**Revision 4 (2026-08-06)** — Donalds Sichtbarkeits-Entscheidung: **ein Profil
erscheint im Verzeichnis erst, wenn sein Inhaber bestätigt hat.** Das Gate prüft
damit beide Seiten, nicht nur den Abfragenden. Akzeptierte Folge: Am Go-Live-Abend
ist das Verzeichnis zunächst leer und füllt sich mit den Bestätigungen — wer als
Erster klickt, sieht Detlev und Donald. Die verbleibenden Befunde aus der dritten
Review-Runde stehen als Aufgaben in `tasks.md` Block 12.

**Revision 3 (2026-08-05)** — nach zwei Fremd-Review-Runden (gemini je APPROVE,
codex und opencode je REQUEST-CHANGES) und zwei Messungen gegen DEV. Was die
Reviews geändert haben, steht unter „Was die Reviews geändert haben"; die
ausgeschriebenen Inventare stehen in `INVENTORY.md`.

## Why

Detlev schickt am Go-Live eine **Rundmail an alle in BCC** mit **einem**
Default-Passwort. Die E-Mail-Adressen der Mitglieder sind im Club bekannt, und
solche Mails werden weitergeleitet. Wer die Mail hat, hat damit heute einen
Login für ~70 fremde Konten.

Die Rundmail bleibt (Entscheidung Donald). Die Absicherung liegt darin, dass das
Passwort **allein wertlos** ist: Wer sich damit anmeldet, bekommt eine Session,
die nichts sehen darf, bis der Bestätigungslink aus dem **eigenen Postfach**
geklickt wurde. Ein Angreifer bräuchte zusätzlich Zugriff auf die Mailbox des
Mitglieds.

Linear: **AGE-495**. Löst **AGE-445** ab. Setzt **C4/AGE-496** voraus — durch,
PR #118.

### Was die Bestandsaufnahme geändert hat

Vier Annahmen aus der Issue-Beschreibung halten der Messung nicht stand
(gemessen gegen DEV über `pg_policies` / `pg_proc` / `pg_class`, nicht über
`grep` — Policies werden über acht Migrationen hinweg gedroppt und neu angelegt,
der grep zählt die Historie):

| Annahme                                    | Gemessen                                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „72 RLS-Policies"                          | **52** — 49 in `public`, 3 auf `storage.objects`                                                                                                                                            |
| `is_prime_plus()` läuft noch irgendwo      | **Existiert nicht.** `20260715150000:319` droppt sie, nachdem alle sieben abhängigen Policies auf `has_level()` umgehängt wurden. Rest: eine tote Zeile in `src/lib/database.types.ts:1334` |
| `minimum_password_length` auf 10 anheben   | **Steht auf 10** (C4)                                                                                                                                                                       |
| Onboarding-Wizard aus dem Erstlogin nehmen | **Ist draußen** (AGE-494/C2). `HomeRedirect.tsx` ist ein No-Op, dessen Kopfkommentar die Naht ausdrücklich für C3 stehen lässt                                                              |

Der Befund, der den Zuschnitt umbaut: **ein Gate in den Policies allein schließt
nichts.**

- `public.profiles_public` hat `security_invoker = off` (`20260612082726:64`,
  absichtlich). Sie läuft mit den Rechten ihres Eigners — die Policies auf
  `public.profiles` greifen bei einer Abfrage über die View **nicht**. Genau
  darüber sah der C4-Audit 36 von 37 Profilen. Vier Frontend-Module lesen sie.
- **Sieben** `SECURITY DEFINER`-RPCs greifen für `authenticated` an der RLS
  vorbei auf Mitgliederdaten zu: `post_engagement_counts`,
  `event_registration_counts`, `register_for_event`, `set_event_check_in`,
  `recompute_my_matches`, `admin_list_feedback`, `list_routing_queue`.
  `20260715150000` §5 nennt die Falle beim Namen: _„Bleiben sie stehen, ist die
  Migration ein Loch statt eines Gates."_

`search_directory` ist `SECURITY INVOKER` und folgt der RLS — die
Verzeichnissuche schließt sich mit `profiles` von selbst.

### Warum das Gate keine zweite Hürde hinter sich hat

Entscheidung Donald: Selbstregistrierung bleibt offen, Selbstregistrierer landen
auf `basic` (rank 1), **importierte Mitglieder sind `impact`** (rank 6).

Damit hat ein importiertes Konto ab dem ersten Login volle Stufenrechte. Das
Stufen-Gate steht bei genau den Konten offen, um die es hier geht. Zwischen der
weitergeleiteten Rundmail und allen Mitgliederdaten steht **ausschließlich** das
Aktivierungs-Gate.

### Was die Reviews geändert haben

**1 · Das Gate umfasst auch die eigenen Daten (codex, blockierend).** Revision 1
nahm die Own-Data-Policies aus, mit dem Muster „eigene Zeile immer". Das war im
Kern falsch: Der Angreifer meldet sich **als das Mitglied** an — `auth.uid()`
liefert die ID des Opfers, „eigene Daten" sind dessen Daten. Offen geblieben
wären `profile_contacts` (E-Mail, Telefon), `profiles_update_own`, `goals_own`,
`notifications_own`, `offers_write_own`, `needs_write_own`.

**2 · Der Weg des Mitglieds führt nicht mehr über das Default-Passwort.**
Gemessen gegen DEV: ein Konto mit Session kann sein Passwort ohne Token und ohne
Reauthentifizierung ändern. Das ist **kein Weg in die App** — das Gate hält, und
aktivieren kann der Angreifer nicht, weil der Link ins Postfach des Mitglieds
geht. Es ist eine **Aussperrung**: das Mitglied käme am Login nicht vorbei und
erreichte den Aktivierungsbildschirm nie. Deshalb stößt der Import den Versand
direkt an, und „neuen Link anfordern" ist ohne Session erreichbar.

**3 · Vier weitere bestätigte Befunde:** Einlösung kann nicht atomar sein
(GoTrue ist HTTP, nicht Postgres) — die Reihenfolge sichert stattdessen · ein
Token je Profil statt beliebig vieler paralleler · Token ins URL-Fragment statt
in den Query-String · Migration A als harte Vorbedingung für C10, sonst stempelt
der Backfill genau die Konten als aktiviert, um die es geht.

**4 · Ein Befund geprüft und widerlegt:** opencode nahm an, Angreifer-Sessions
überlebten die Einlösung. Gemessen: Access- **und** Refresh-Token sterben beim
Passwortwechsel. Der explizite `signOut` bleibt trotzdem drin — der Admin-Pfad
ist ein anderer Code-Weg und ungemessen.

**5 · Ein eigener Zählfehler:** 46 gegatete Policies, nicht 29.

Die zweite Runde fand weiteres — darunter einen Fehler, der schwerer wiegt als
die aus der ersten:

**6 · Eine Anforderung behauptete, was ich selbst widerlegt gemessen hatte
(codex).** Revision 2 schrieb „Passwort setzen nur mit Token" und stellte zwei
Absätze weiter oben die Messung daneben, die das widerlegt. Jetzt steht dort,
was gilt: **die Anwendung** bietet keinen Weg am Token vorbei, der Anmeldedienst
ist eine benannte Restfläche. Eine Anforderung, die das System nicht erfüllen
kann, ist in jeder Prüfung grün und im Betrieb falsch.

**7 · Zwei echte Rennen (codex, opencode).** Die Einlösung prüfte
`used_at is null` und vermerkte erst danach — zwei gleichzeitige Einlösungen
kamen beide durch und setzten verschiedene Passwörter. Und die Ausgabe stützte
sich auf einen _nicht_ eindeutigen Index. Beides ist jetzt je eine atomare
Datenbankoperation.

**8 · Der Sitzungswiderruf stand an der falschen Stelle (codex, opencode).**
Revision 2 stempelte `activated_at` vor dem Widerruf. Schlägt der fehl, entsteht
genau der Zustand, den dieser Change verhindern soll. Der Stempel öffnet das
Gate und steht deshalb jetzt am Ende.

**9 · `send-activation` widersprach sich selbst (codex).** `verify_jwt = false`
und „vom Gateway geprüftes JWT" schließen sich aus — bei `false` prüft das
Gateway nichts, die Kennung wäre frei wählbar. Die Function liest jetzt gar kein
JWT.

**10 · Die Backfill-„Sicherung" war keine (codex, opencode).**
`created_at < <Migrationszeitpunkt>` ist im Schadensfall wahr, und ein Import
darf `created_at` zurückdatieren. Ersetzt durch einen Stolperdraht, der laut
abbricht.

**11 · Zwei falsche Zusagen im Mailtext (opencode).** „auch nicht für uns" ist
unwahr — `service_role` und der Betrieb sehen das Profil. Und „gilt 72 Stunden"
verschwieg, dass ein neuer Link den alten entwertet. Beides korrigiert.

**12 · Und der Zählfehler war größer als gedacht (opencode).** Nicht vier RPCs,
sondern sieben. Deshalb gibt es jetzt `INVENTORY.md`: die Listen ausgeschrieben,
mit der Abfrage, die sie erzeugt.

## What Changes

**Das Gate sitzt in der Datenbank, nicht im Frontend.** Wer das Default-Passwort
hat, kann sich mit einem eigenen Supabase-Client anmelden und die Tabellen
direkt abfragen. Der Aktivierungsbildschirm wird gebaut, aber er ist die
Bequemlichkeit; die Grenze ist die RLS.

**`profiles.activated_at`** (`timestamptz`, `null` = nicht aktiviert) ist die
einzige Wahrheit. Dazu `public.is_activated()` im Muster der bestehenden
Prädikate: `stable security definer`, `search_path` gepinnt, EXECUTE für `anon`
entzogen. Auf der Spalte besteht **kein** Schreibrecht für Client-Rollen.

**Das Gate kommt an drei Stellen hinein**, jede einzeln im pgTAP belegt:

1. **46 Policies** für `authenticated` — Fremddaten **und eigene**. Auf den
   sieben Verzeichnisflächen zusätzlich auf der **Zeile**: ein Profil erscheint
   erst, wenn sein Inhaber bestätigt hat.
2. **Der Rumpf von `profiles_public`** — sonst ist Punkt 1 wirkungslos.
3. **Sieben `SECURITY DEFINER`-RPCs**, die an der RLS vorbei zählen, lesen oder
   schreiben. Revision 2 zählte vier; nachgemessen sind es sieben.

Beide Listen stehen vollständig in `INVENTORY.md`, mit der Abfrage, die sie
erzeugt, und einer Begründung je Funktion. Migration Bs Lesbarkeit war der Grund
für den Zwei-Migrationen-Schnitt — sie hängt daran, dass ein Reviewer die Listen
sehen kann, statt zwei Zahlen glauben zu müssen.

Die Rechnung geht auf 52 auf: 46 gegatet, **5 anon-Policies ausdrücklich nicht**
(`posts_select_public_anon`, `events_select_public_anon`, `badges_read_all`,
`tiers_read_all`, `partner_cat_read_all` — der ausgeloggte Besucher soll das
Schaufenster weiter sehen), und **`platform_settings_select` nicht**, weil sie
einen plattformweiten Flag liest und kein Mitgliedsdatum.

**`public.my_activation_state()`** ist die einzige Ausnahme vom Gate und
zugleich seine Voraussetzung: `SECURITY DEFINER`, gibt genau ein Boolean und
einen Anzeigenamen zurück. Ohne sie kann der Aktivierungsbildschirm sich selbst
nicht rendern, weil `AuthProvider` die eigene Profilzeile nicht mehr liest.

**`public.activation_tokens`** — `token_hash` als PK (nur der Hash),
`profile_id`, `expires_at` (72 h), `used_at`, `created_at`. RLS an, **keine
Policy und kein Grant** für `anon` / `authenticated`. Höchstens **ein**
einlösbares Token je Profil: ein neuer Versand entwertet die ausstehenden.

**Edge Function `send-activation`** am Muster von `notify-contact-request`:
gleiche Resend-Anbindung, gleiche Trennung von `index.ts` (I/O) und `emails.ts`
(reine Logik, `deno test`-bar). Absender `info@fairbusinessclub.de`. Sie **liest kein
JWT** und nimmt ausschließlich eine E-Mail-Adresse entgegen — ein Weg für
angemeldete wie nicht angemeldete Aufrufer, weil das Mitglied sonst bei einem
übernommenen Passwort keinen Weg mehr hätte. Empfänger ist immer die hinterlegte
Adresse des Profils, nie eine mitgegebene. Die Antwort verrät nicht, ob es die
Adresse gibt.
Rate-Limit **pro Profil**, konkurrenzsicher über eine atomare DB-Operation.

**Edge Function `redeem-activation`** löst das Token in vier Schritten ein, und
die Reihenfolge ist die Sicherung: Token **atomar beanspruchen** (eine Anweisung,
sonst kommen zwei gleichzeitige Einlösungen beide durch) → Passwort setzen →
Sessions global widerrufen → **zuletzt** `activated_at` stempeln. Der Stempel
öffnet das Gate und steht deshalb am Ende: schlägt etwas davor fehl, bleibt es
geschlossen. Das Token trägt ≥ 256 Bit aus einem CSPRNG, steht im
**URL-Fragment** statt im Query-String, und der Endpunkt ist versuchsgedrosselt.
Weil das Token die Identität trägt und nicht die Session, funktioniert der Link
auch in einem anderen Browser.

**Nicht Supabase Auth Confirmations.** `[auth.rate_limit] email_sent = 2` pro
Stunde ist projektweit und laut Messung aus C4 nicht erhöhbar ohne eigenen SMTP
(`HTTP 401 Custom SMTP required …`) — bei 70 Mitgliedern an einem Abend tot. Und
Absender wie Text müssen uns gehören. `enable_confirmations` bleibt `false`.

**Frontend:** Aktivierungsbildschirm als Wand über allen Routen (die in
`HomeRedirect` stehengelassene Naht), Einlösung unter `/aktivierung`,
Passwortfeld mit **zehn** Zeichen Mindestlänge — dieselbe Zahl wie
`minimum_password_length` auf dem Server. _Hier stand, `LoginPage` verlange
„heute acht" und widerspreche damit dem Server. Das war bei Abfassung wahr und
ist es seit Task 6.6 nicht mehr: `LoginPage.tsx:15` verlangt `min(10)`
(opencode, Runde 4; am 2026-08-06 nachgemessen). Korrigiert._

**Alle sieben Fehlerfälle** aus AGE-495 §6, nicht nur der Happy Path.

**Der Mailtext ist Produkt, nicht Technik.** Entwurf in `design.md`, geht als
Entwurf an Detlev.

## Impact

**Specs:** `access-control` (das Gate, die Token-Tabelle, die Korrektur der
`is_prime_plus`-Drift), `member-profiles` (`activated_at`, das Gate in
`profiles_public`).

**Migrationen:** zwei. Erst Schema + Helfer, dann das Einweben — getrennt, damit
die zweite ein reiner Policy-Diff bleibt und im Review lesbar ist. **Migration A
ist eine harte Vorbedingung für C10**; ihr Backfill grenzt sich zusätzlich
zeitlich ab, weil eine Prosa-Zusage in einem anderen Issue keine Sicherung ist.

**Code:** zwei Edge Functions, `config.toml` (zwei `[functions.*]`-Blöcke),
`AuthProvider` (nutzt `my_activation_state()`), `App.tsx` / `HomeRedirect`, zwei
neue Seiten, `LoginPage`, `database.types.ts`.

**Tests:** `rls_test.sql` wächst um den Block „eingeloggt, aber nicht
aktiviert"; `grants_test.sql` bekommt eine eigene Assertion, dass
`activation_tokens` in der Grant-Matrix **fehlt** — sonst ist ihre Abwesenheit
von einem vergessenen Eintrag nicht unterscheidbar.

**Benannte Restflächen, die dieser Change nicht schließt** — ausgeschrieben,
weil eine unbenannte Restfläche wie eine Zusage aussieht: Der Anmeldedienst
nimmt eine Passwortänderung allein auf Grundlage einer Sitzung entgegen
(gemessen) — das Gate hält trotzdem, und die Aussperrung ist über den
sitzungsfreien Weg zum Link abgefangen · wer eine Adresse kennt, kann den
ausstehenden Link eines Mitglieds wiederholt entwerten, begrenzt nur durch die
Ratengrenze · Profilbilder liegen in einem `public`-Bucket und sind über ihre
URL abrufbar, aber die URLs stehen in der gegateten Spalte `avatar_url` ·
ausgeloggt sieht man mehr als eingeloggt-nicht-aktiviert, was der
Aktivierungsbildschirm benennen muss.

**Nicht in diesem Change:** der Import selbst (C10) · Detlevs Rundmail-Text ·
Passwort-vergessen für den Normalbetrieb (Backlog) · die Zustell-Abnahme über
SPF/DKIM (**AGE-256**; blockiert die Abnahme des Versands, nicht den
Sicherheitskern) · ob
`security_update_password_require_reauthentication` auf PROD auf `true` soll —
ungemessen, als Nachlauf notiert.
