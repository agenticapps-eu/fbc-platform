## Context

Gemessen am 20.08.2026 an beiden Datenbanken, nicht aus Dokumenten übernommen:

| Bestand | PROD `viwntbodrtqxgmqyxluh` | DEV `foelowldexkcqzewvrcf` |
|---|---|---|
| `profiles` | 72 (71 Import + `vorschau@fbc.invalid`), alle `impact` | 41 Personas über alle sechs Stufen |
| `profile_contacts` | 54, davon **38 mit Anschrift** | 26, davon **0** |
| `auth.users` | 72, davon 2 je angemeldet | 41, davon 18 |
| `posts` / `comments` / `events` | 29 / 13 / 8 | 34 / 13 / 13 |
| `feedback` | 1 | 21 |
| Storage-Objekte | **125** (57 `avatars`, 54 `covers`, 8 `event-covers`, 6 `post-media`) | 18 |
| Migrationen | 70 | 70 |

**Beide Schemata sind deckungsgleich** — 70 Migrationen auf beiden Seiten. Das
ist die Voraussetzung, unter der ein reiner Datenauszug überhaupt trägt; ohne
sie wäre der Spiegel eine Migration mit Datenanhang.

Werkzeuge auf der Maschine: `pg_dump`/`pg_restore`/`psql` 18.4, `supabase` CLI
2.111.0.

Der Auslöser für die Trigger-Frage steht in
`20260611115655_community_foundation.sql:82`: `on_auth_user_created`, AFTER
INSERT auf `auth.users`, legt über `handle_new_user()` eine Zeile in
`public.profiles` an — mit `tier = 'discover'`.

## Goals / Non-Goals

**Goals:**

- Ein wiederholbarer Befehl, der DEVs Datenbestand durch den von PROD ersetzt,
  Datenbank und Ablage gemeinsam.
- Der dabei entstehende Auszug ist die Sicherung, die Schritt 1 des
  PROD-Neuaufbaus verlangt — nicht ein zweites Werkzeug.
- Die drei Demo-Zugänge und `staff_roles` überleben jeden Lauf.
- Ein Lauf mit PROD als Ziel bricht ab, bevor er schreibt.

**Non-Goals:**

- **Kein Zeitplan.** Jeder Lauf verwirft den Arbeitsstand auf DEV.
- **Keine Anonymisierung.** Der Nachbereitungsschritt ist der Ort, an dem sie
  später ansetzt; gebaut wird sie hier nicht.
- **Kein Rückweg DEV → PROD.** Nicht „ungebaut", sondern ausgeschlossen.
- **Kein Leeren und Neu-Migrieren von PROD.** Das ist der Neuaufbau selbst.
- **Keine inkrementelle Übertragung.** Siehe Entscheidung 1.

## Decisions

### 1. Vollersatz per Auszug, nicht zeilenweiser Abgleich

Ein Vollersatz ist bauartbedingt idempotent: derselbe Lauf, derselbe
Zielzustand, unabhängig von der Vorgeschichte. Ein zeilenweiser Abgleich müsste
für **jede künftig angelegte Tabelle und Spalte** `upsert`-treu bleiben.

Der ausschlaggebende Punkt ist nicht der Aufwand, sondern die
Unbemerkbarkeit des Verfalls: eine neue Spalte, die der Abgleich nicht kennt,
wird schlicht nicht übertragen — und **kein Test kann das aufdecken**, weil
kein Test „DEV sieht aus wie PROD" prüfen kann, ohne selbst die Liste zu führen,
die veraltet ist.

*Verworfen:* ein `spiegel.ts` nach dem Muster von `wp_import.ts`. Es umginge die
Trigger-Falle bauartbedingt und wäre testbar wie der Import (343 Zusagen als
Vorbild) — aber sein Ergebnis wäre ein Vorgang, keine wiederherstellbare Datei,
und als Sicherung vor dem Leeren damit schwächer. Ein Werkzeug, das beide Rollen
trägt, schlägt zwei, von denen eines selten läuft und deshalb verrottet.

### 2. Trigger sind ein Inventar, kein Einzelfall

**Korrigiert nach dem Plan-Review, dann nachgemessen (Gruppe 1, siehe
`messungen/gruppe-1-2026-08-20.md`).** Der erste Entwurf behandelte
`on_auth_user_created` und hielt das Problem damit für gelöst. Gemessen am
2026-08-20 sind es **18 nicht-interne Trigger**: 13 auf `public`, einer auf
`auth`, **vier auf `storage`** — die vier standen in keinem der beiden Reviews
und in keiner Fassung dieses Entwurfs. Zwei davon (`protect_objects_delete`,
`protect_buckets_delete`) sind `BEFORE DELETE`-Statement-Trigger und stehen dem
Leeren der Buckets in 4.3 im Weg. Die 13 auf `public`:

| Trigger | Was er beim Restore täte |
|---|---|
| `trg_event_feed_post` | zu jedem zurückgespielten Termin ein **zusätzlicher** Beitrag |
| `trg_event_feed_sync` | Folgeänderungen an eben diesen Beiträgen |
| `contact_requests_lifecycle` | zusätzliche Benachrichtigungen, Threads, Statuswechsel |
| `contact_requests_email_webhook` | **verschickt Post** |
| `trg_posts_video_url`, `post_media_hoechstens_sechs`, `trg_profiles_completion`, fünf `*_updated_at`, `platform_settings_touch` | schreiben abgeleitete Werte, überschreiben also Zurückgespieltes |

`contact_requests_email_webhook` ist der Ernstfall und stand in keinem der
beiden Reviews: **ein Restore, der E-Mails an echte Mitglieder auslöst, ist kein
Restore.** Dass `contact_requests` heute leer ist, ist ein Zufall des Zeitpunkts
und kein Entwurf.

**Der Mechanismus ist nach der Messung ein anderer.** Geplant war, je Trigger
ein `ALTER TABLE … DISABLE TRIGGER` abzusetzen. Gemessen gehört `auth.users` der
Rolle `supabase_auth_admin` und `storage.objects`/`storage.buckets` gehören
`supabase_storage_admin` — **an genau den drei Tabellen, auf die es ankommt,
wäre der geplante Weg gescheitert.** Nur die neun `public`-Tabellen gehören
`postgres`.

Was trägt: **`set session_replication_role = replica`**, auf beiden Projekten
erlaubt. Alle 18 Trigger tragen `tgenabled = 'O'`, also legt der eine Schalter
sie sämtlich still — ohne ein `ALTER`, ohne Eigentümerrechte, und der Zustand
endet mit der Verbindung statt in der Datenbank zu bleiben.

Empirisch belegt gegen den lokalen Stack, beide Einfügungen in einer
zurückgerollten Transaktion (`scripts/mess-spiegel-replica.ts`):

```
origin : insert auth.users → 1 Zeile in public.profiles (tier=basic)   [Gegenprobe]
replica: insert auth.users → 0 Zeilen in public.profiles               [Messung]
```

Damit lautet der Ablauf:

```
0. set session_replication_role = replica     (gilt für die ganze Sitzung)
1. auth-Bestand in DEV leeren   → kaskadiert in public.profiles
2. public.* leeren, Buckets leeren
3. auth zurückspielen           → der Signup-Trigger feuert NICHT
4. public.* zurückspielen
5. Nachbereitung, Fremdschlüssel-Integrität eigens messen
```

**Der Kunstgriff des ersten Entwurfs entfällt.** Er räumte weg, was
`on_auth_user_created` erzeugt; im replica-Modus erzeugt der Trigger nichts.
Aufgabe 4.5 bleibt als *Zusage* stehen — „der Trigger hat nicht gefeuert" —
nicht als Arbeitsschritt.

Belegt ist auch, was daran hing: `public.profiles --profiles_id_fkey-->
auth.users`, `profiles` ist die referenzierende Seite, `truncate … cascade`
folgt nur Schlüsseln, die **auf** die geleerte Tabelle zeigen. `auth.users`
bleibt unberührt (Aufgabe 1.8, 31 Fremdschlüssel auf `profiles`, 9 auf
`auth.users`).

*Der Preis:* replica legt auch die internen RI-Trigger still — Fremdschlüssel
werden während des Laufs **nicht geprüft**. Für die Restore-Reihenfolge ist das
bequem, für die Abnahme heißt es, dass die Integrität danach eigens gemessen
werden muss. Sie ergibt sich nicht mehr von selbst.

*Korrektur am ersten Entwurf:* er schrieb, der Trigger setze `discover`. Er
setzt **`basic`** — die gelesene Definition stammte aus `20260611171003`, die
geltende steht in `20260715150000` und in der laufenden Datenbank. Für den
Ablauf ändert das nichts (die Zeilen fallen ohnehin), für die Verlässlichkeit
des Entwurfs schon.

*Verworfen, und jetzt nicht mehr nur vermutet:* `alter table … disable trigger`
als Weg. Es verlangt Eigentümerrechte, und die fehlen an `auth.users`,
`storage.objects` und `storage.buckets` — gemessen, nicht geschätzt. Zweiter
Grund, der bleibt: ein `ALTER` überlebt die Sitzung. Bliebe ein Trigger
versehentlich abgeschaltet, legte jede spätere Anmeldung auf DEV kein Profil
mehr an, und das fiele erst Tage später auf. `session_replication_role` kann
diesen Fehler nicht machen.

### 2a. Der Auth-Umfang wird gemessen, nicht angenommen

**Neu nach dem Plan-Review — und die Begründung ist am 2026-08-20 korrigiert
worden.** Der erste Entwurf sprach von „`auth.users` zurückspielen". Gemessen:
`auth.identities` trägt **72 Zeilen**, `auth.sessions` drei.

*Was der Entwurf behauptete:* ein Restore ohne Identitäten erzeuge 72 Konten,
an denen sich **niemand anmelden kann**. **Das stimmt nicht.** Die drei
`@fbcdemo.com`-Zugänge auf DEV tragen **null** Identitätszeilen und haben sich
am 2026-08-20 anstandslos per Passwort angemeldet — sie stammen aus einem
direkten `insert into auth.users` (`docs/tier-testing.md`), und der legt nie
eine Identität an. Von den 41 DEV-Konten haben 14 eine.

*Warum die Entscheidung trotzdem bleibt:* der Spiegel soll PROD **abbilden**,
nicht eine Teilmenge, die zufällig noch funktioniert. Die 72 PROD-Konten sind
über die GoTrue-Admin-API entstanden und **haben** Identitäten; alles, was an
ihnen hängt — Verknüpfung von Anmeldeverfahren, `identity_data`, das Verhalten
künftiger GoTrue-Fassungen — wäre in einem Spiegel ohne sie stillschweigend
anders. Ein Unterschied, den kein Test sieht, ist genau die Sorte, die dieser
Entwurf vermeiden soll.

**Gemessen am 2026-08-20 (Aufgabe 1.6): der Umfang ist `auth.users` +
`auth.identities`, sonst nichts.** Zeilen tragen auf PROD ausserdem
`refresh_tokens` (23), `sessions` (3) und `mfa_amr_claims` (3) — das sind
laufende Anmeldungen echter Personen, sie ergäben übertragen tote Token und
wären der unangenehmste Teil des Spiegels. `auth.schema_migrations` (77) ist
GoTrues **eigener** Versionsstand des DEV-Projekts und darf nicht ersetzt
werden. Die übrigen 17 `auth`-Tabellen sind leer.

Der Befund von der anderen Seite: DEV trägt heute **41 `users`, aber nur 14
`identities`** — 27 DEV-Konten sind bereits jetzt nicht anmeldefähig.

### 3a. Der DEV-Bestand schrumpft auf drei Zeilen — Entscheidung vom 2026-08-20

**Donald, nachdem gemessen war, wem welche Konten gehören:** die Demo-Zugänge
und die Testkonten dürfen **weg**. Weder er noch Detlev braucht sie — beide
haben ein eigenes Konto, das PROD kennt und der Spiegel mitbringt
(`donald@factiv.eu` und `detlev.krause@dkrealinvest.com`, beide `impact`,
beide aktiviert, beide mit Admin-Zeile **auf PROD**).

Was damit ersatzlos wegfällt, ist gemessen und nicht geraten:

| | PROD (kommt nach DEV) | DEV heute |
|---|---|---|
| Stufen | **impact = 72**, sonst nichts | sechs Stufen besetzt |
| Aktivierung | 37 ja / **35 nein** | 39 ja / 2 nein |

Das **Aktivierungs-Gate überlebt** — 35 nicht aktivierte Konten kommen mit, es
braucht dafür kein eigenes Testkonto. Zwei Dinge fallen aber weg:

1. **Jede Stufenvielfalt.** Danach ist auf DEV alles `impact`; Stufen-Gating
   lässt sich nicht mehr prüfen. Das wiegt, weil der Stufenweg ~eine Woche nach
   dem Go-Live freigeschaltet wird.
2. **`matching_manager`.** Heute hält ihn allein `prime@fbcdemo.com`; PROD
   kennt die Rolle nicht.

*Deshalb bleibt der deklarierte DEV-Bestand bestehen — nur klein.* Er besteht
nicht mehr aus einer Demo-Welt, sondern aus:

- `staff_roles`: die zwei Admin-Zeilen (kommen aus PROD) **plus**
  `matching_manager` auf einem der übernommenen Konten
- eine Handvoll `tier`-Zuweisungen auf übernommenen Konten, damit die sechs
  Stufen besetzt sind

Das braucht **keine eigenen Logins** und keinen Seed. Aufgabe 4.10 verliert
damit ihren grössten Teil: es gibt keine „Demo-Welt (Jonas, Carla, Eleonora)"
mehr herzustellen.

*Was das für 2a bedeutet:* die Arbeit war trotzdem nötig und bleibt gültig. Die
24 Konten mit dem öffentlichen Passwort waren die eigentliche Lücke, und die
ist unabhängig davon geschlossen, ob die Demo-Welt bleibt.

### 3. Der geschützte Bestand wird hergestellt, nicht ausgespart

`staff_roles` und die drei `@fbcdemo.com`-Zugänge werden vom Vollersatz
mitgenommen und danach **neu angelegt** — statt sie beim Ersetzen zu übergehen.

Was ausgespart wird, ist nicht prüfbar: eine Aussparung, die ins Leere greift,
sieht aus wie eine, die getroffen hat. Was hergestellt wird, ist prüfbar — die
Zusage lautet „danach anmeldefähig", und die lässt sich messen.

`supabase/seed/admin_roles.sql` trägt die `staff_roles` bereits; der
Nachbereitungsschritt ist damit kein neues Wissen, sondern ein Aufruf.

### 4. Der Wächter prüft beide Seiten und jedes Zugangspaar

Der Pooler-Host ist regionsweit gleich und unterscheidet die Projekte nicht —
die Kennung steht im Benutzernamen (`postgres.<ref>`). Ein Wächter, der den Host
prüft, hielte PROD und DEV für dasselbe Projekt. Der WP-Import löst das bereits
so (`wp_import.ts`, Aufgabe 1.4); der Spiegel nimmt denselben Weg.

**Zwei Erweiterungen nach dem Plan-Review**, beide von codex, beide zutreffend:

*Auch die Quelle.* Der erste Entwurf prüfte nur, dass das **Ziel** DEV ist. Eine
vertauschte oder fremde **Quelle** hätte jeden vorgesehenen Test bestanden — im
schlimmsten Fall spiegelt DEV auf sich selbst und der Bestand ist weg, ohne dass
ein Auszug entstand, der ihn trüge.

*Auch die anderen Zugangsdaten.* Datenbank-URL, Storage-URL und Service-Key sind
**getrennte** projektgebundene Werte. Eine DEV-Datenbank-URL neben einem
PROD-Service-Key leert PROD-Buckets oder legt Konten in PROD an, während die
Datenbankprüfung grün meldet. Dass diese Werte hier bereits auseinanderlaufen,
ist im Projekt dokumentiert und keine hypothetische Sorge. Geprüft wird deshalb
jedes Paar einzeln, und dass alle demselben Projekt zugeordnet sind.

### 5. Die Ablage wird gespiegelt, nicht neu erzeugt

Objekte werden aus den vier Buckets von PROD gelesen und in DEV geschrieben, mit
`upsert: false`. In privaten Buckets verlangt `ON CONFLICT` ein Leserecht, das
für ein noch unverknüpftes Objekt verweigert wird — der Fehler zeigt dann auf
die RLS, obwohl die Policy richtig ist. Da DEVs Buckets vorher geleert werden,
gibt es ohnehin nichts zu überschreiben.

### 6. Keine Anonymisierung — dafür entschärfte Zugänge und neutralisierte Hashes

**Entscheidung Donald, 2026-08-20, gegen beide Prüfer** (REVIEWS.md §8/§9). Die
Daten bleiben echt: Namen, Biografien, Firmen, Anschriften und Beiträge wandern
unverfälscht nach DEV.

Der Grund ist der Zweck des Spiegels. Anonymisierte Namen und Texte nähmen ihm
genau das, wofür er gebaut wird — die acht Befunde vom 17.08. (Markdown-Zeichen
im Verzeichnis, verlorene Absätze, überlaufende Ortsangaben) wurden alle an
echten Datensätzen gefunden, keiner an einer Persona. Eine anonymisierte Kopie
unterschiede sich kaum von der heutigen Demo-Welt, und der Auszug taugte nicht
mehr als Sicherung für den PROD-Neuaufbau.

Das Risiko ist damit nicht bestritten, sondern anders adressiert. Es liegt in
der **Kombination**, nicht in den Daten allein — und zwei der drei Faktoren
werden entfernt:

| Faktor | Antwort |
|---|---|
| Echte Daten auf DEV | bleibt, ist der Zweck |
| Zugänge mit `Test1234!` im **öffentlichen** Repository | **Passwörter ändern, aus `docs/demo-zugang.md` nehmen** |
| Produktions-Passwort-Hashes wandern mit | **neutralisieren** — auf DEV soll sich ohnehin niemand mit einem echten Mitgliedskonto anmelden |

Die Neutralisierung der Hashes kostet den Spiegel nichts und nimmt dem
schlimmsten Fall — ein Leak der DEV-Datenbank — seine schärfste Spitze. Sie
gehört in den Nachbereitungsschritt, der damit die Stelle bleibt, an der eine
spätere, weitergehende Anonymisierung ansetzt.

**Was das nicht löst:** nach dem Go-Live kopierte derselbe Lauf echte Gespräche,
Nachrichten und Kontaktanfragen. Diese Frage ist verschoben, nicht beantwortet.

## Risks / Trade-offs

**`pg_dump` über den Pooler schlägt fehl** → Der Transaktions-Modus (Port 6543)
trägt kein `pg_dump`. Gebraucht wird die direkte Verbindung oder der
Session-Modus. `SUPABASE_DB_URL_PROD` löst auf die Pooler-Form auf — **das ist
vor allem anderen zu messen**, es entscheidet, ob dieser Entwurf überhaupt
trägt. Fällt es aus, ist `supabase db dump` der Ersatz, der die Frage für uns löst.

**Versionssprung `pg_dump` 18.4 gegen einen älteren Server** → Ein neueres
`pg_dump` gegen einen älteren Server ist der unterstützte Fall, der umgekehrte
nicht. Beide Seiten sind derselbe Dienst und dieselbe Version; zu prüfen ist es
trotzdem einmal, nicht zu unterstellen.

**Der Auszug trägt Personendaten in den Arbeitsbaum** → Ablage ausserhalb des
Arbeitsbaums, Verzeichnis `0700`, Dateien `0600`, Auflösung über `realpath`
gegen den Arbeitsbaum geprüft. Das Repository ist öffentlich, und der
Arbeitsbaum trägt dauerhaft untrackte Dateien — eine falsche Ablage fiele in
keinem Diff auf. Gemessen wird die **Differenz** von `git status --porcelain
--ignored` vor und nach dem Lauf: die Ausgabe selbst ist schon heute nicht leer,
sie führt 17 Pfade, und eine Zusage auf „leer" wäre nie erfüllbar gewesen.

*Verschlüsselung des Auszugs* — nach Abwägung nicht übernommen (REVIEWS.md §12).
Ohne Schlüsselverwaltung läge der Schlüssel auf derselben Platte wie der Auszug;
das ist Aufwand ohne Schutz. Die Rechte und der geprüfte Ablageort tragen.

**Ein Abbruch mitten im Lauf lässt DEV halb ersetzt zurück** → Hingenommen. DEV
ist per Entscheidung 1 ein ersetzbares Abbild; die Antwort auf einen halben Lauf
ist ein zweiter. Deshalb ist der Auszug vollständig, **bevor** DEV angefasst
wird: der teure und unwiederholbare Teil ist das Lesen aus PROD, nicht das
Schreiben nach DEV.

**Nach dem Go-Live kopiert derselbe Lauf echte Gespräche** → Bewusst verschoben
(Decision 6). Heute sind die Inhalte erfunden, die Personen echt; nach dem
Go-Live wären beide echt. Der Nachbereitungsschritt ist die Stelle, an der eine
weitergehende Anonymisierung dann ansetzt — sie hier zu bauen, hiesse sie ohne
die Daten zu entwerfen, für die sie gedacht ist. **Beide Prüfer halten das für
zu wenig; Donald hat am 2026-08-20 anders entschieden.**

**Zwölf Trigger ausser dem einen** → Der schwerste Befund des Plan-Reviews. Er
kann diesen Entwurf zu Fall bringen, nicht nur verändern: lässt sich
`contact_requests_email_webhook` nicht zuverlässig stilllegen, verschickt ein
Restore Post an echte Mitglieder. Aufgabe 1.4/1.5 klärt das **vor** der ersten
Zeile Code, und ein negatives Ergebnis verwirft den `pg_restore`-Weg.

**Der Wächter deckt nur, was er kennt** → Datenbank, Ablage und
GoTrue-Admin-API sind drei getrennte Zugänge. Der erste Entwurf prüfte einen und
las sich, als schütze er alle drei. Ein Wächter, der teilweise deckt, ist
gefährlicher als keiner, weil er Zutrauen erzeugt.

## Migration Plan

Kein Deploy, keine Migration, kein Anwendungscode. Der erste vollständige
Probelauf findet gegen den **lokalen Stack** statt, nicht gegen DEV — dort ist
ein Fehlschlag folgenlos, und die Trigger-Frage aus Decision 2 lässt sich dort
klären, ohne die ausgelieferte Fläche anzufassen.

**Die Abnahme ist ein Manifestvergleich mit benannten Abweichungen**, nicht ein
Zahlenvergleich. Der erste Entwurf forderte „dieselben Zeilenzahlen wie PROD"
und im selben Atemzug einen Nachbereitungsschritt, der Konten hinzufügt — das
kann nicht beides gelten, und codex hat die Abnahme zu Recht als unerfüllbar
bezeichnet. Verglichen wird gegen **Auszug plus deklarierter DEV-Bestand**,
über Zeilenhashes und Objektprüfsummen. Zahlen belegen ohnehin keinen Inhalt.

Die Idempotenz wird **aus demselben gespeicherten Auszug** gemessen. Zwei Läufe
gegen die laufende Quelle können verschiedene Stände gelesen haben und belegen
nichts.

**Rückweg:** DEVs heutiger Bestand ist die Demo-Welt aus
`supabase/seed/demo_seed.ts` — reproduzierbar, braucht keine Sicherung. Das ist
der Grund, warum dieser Change ohne Netz gegen DEV laufen darf und der Neuaufbau
gegen PROD nicht. Für den Auszug selbst gilt das Umgekehrte: er heißt erst
„Sicherung", wenn er einmal gegen ein leeres Schema zurückgespielt wurde
(Aufgabe 5.6).

## Open Questions

**Zwei Fragen sind am 2026-08-20 von Donald entschieden worden** und stehen
jetzt als Entscheidung 6 beziehungsweise im deklarierten DEV-Bestand.
- **Bleibt DEV eine vorführbare Demo?** Der Nachbereitungsschritt stellt
  Zugänge her, aber drei Logins sind nicht die Demo-Welt: ihre Profilzeilen
  entstehen leer und `basic`. Entweder der benannte Bestand wird vollständig
  rekonstruiert, oder `docs/demo-zugang.md` muss sagen, dass es diese Demo nicht
  mehr gibt.
- **Trägt `pg_dump` die Pooler-Verbindung, und lassen sich die zwölf übrigen
  Trigger stilllegen?** Beides entscheidet über den Bestand des Entwurfs, nicht
  über ein Detail. Aufgaben 1.2, 1.4, 1.5 — vor der ersten Zeile Code.
