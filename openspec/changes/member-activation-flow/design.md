# Design — Mitglieder-Aktivierung (AGE-495)

**Zum Vorgehen:** Der Entwurfsraum war beim Start durch AGE-495 und zwei
Entscheidungen Donalds festgelegt. Statt einer Brainstorming-Sitzung, die
Entschiedenes wieder aufmachen würde, stehen die verworfenen Alternativen hier
direkt — mit dem Grund des Ausscheidens.

**Revision 4 (2026-08-06)** — Donalds Entscheidung zur Sichtbarkeit
(Entscheidung 16). Die verbleibenden Befunde aus Runde 3 sind als Aufgaben in
`tasks.md` festgehalten, nicht als weitere Revision.

**Revision 2**, nach der ersten Review-Runde: Entscheidungen 6 bis 11.
**Revision 3 (2026-08-05)**, nach der zweiten: gemini erneut APPROVE, codex und
opencode erneut REQUEST-CHANGES — mit acht bzw. dreizehn Punkten, von denen die
meisten trugen. Entscheidungen 12 bis 15 sind daraus entstanden; 7, 8 und 9 sind
korrigiert. Das Inventar in `INVENTORY.md` ist neu, weil zwei Zahlen behauptet
und nicht belegt waren — **und eine davon war falsch** (es sind sieben RPCs,
nicht vier). `REVIEWS.md` hält den Wortlaut beider Runden fest.

---

## Entscheidung 1 — Selbstregistrierung bleibt offen, der Schutz ist die Stufe

**Gewählt.** `enable_signup` bleibt `true`. Wer sich selbst registriert, landet
auf `basic` (rank 1). **Importierte Mitglieder sind `impact`** (rank 6).

**Präzisiert nach dem Review (opencode, codex).** Revision 1 schrieb
„E-Mail-Bestätigung für Selbstregistrierer kommt später" und ließ damit offen,
ob sie überhaupt einen Aktivierungsweg haben. Beide Reviewer lasen es als „nein"
und wiesen zu Recht auf die Folge hin: dauerhaft hinter dem Gate, und der
AGE-448-Fall (Gast registriert sich vor Ort, meldet sich zu einem öffentlichen
Event an) wäre zerstört.

**Gemeint war und gilt: Selbstregistrierer durchlaufen denselben
Aktivierungsweg.** Sie fordern den Link an, bekommen ihn an ihre eigene Adresse,
lösen ihn ein. „Später" bezog sich auf Supabase' eingebaute Signup-Bestätigung,
die aus bleibt — nicht auf unseren Weg. Damit ist der AGE-448-Pfad intakt.

**Verworfen: Aktivierungslinks nur für importierte Profile** (ein
`activation_eligible`-Flag). Hätte den C4-Verzeichnis-Befund auch für
Wegwerf-Adressen geschlossen, ist aber ein zweiter Mechanismus für eine Frage,
die die Stufenlogik schon beantwortet.

**Verworfen: `enable_signup = false`.** Bricht AGE-448.

**Die Konsequenz, die dieser Change tragen muss:** Ein importiertes Konto hat ab
dem ersten Login volle Stufenrechte (`impact`). Hinter dem Aktivierungs-Gate
liegt **kein zweites Netz**. Der Gate-Umfang ist deshalb nicht verhandelbar.

## Entscheidung 2 — Das Gate sitzt an drei Stellen, nicht an einer

**Gewählt.** `is_activated()` kommt in die Policies, in den Rumpf von
`profiles_public` und in die **sieben** `SECURITY DEFINER`-RPCs aus
`INVENTORY.md` B1 (Revision 2 zählte vier — zu wenig).

**Verworfen: nur die Policies.** `profiles_public` hat `security_invoker = off`
(gemessen; in `20260612082726:64` absichtlich gesetzt) und läuft mit den Rechten
ihres Eigners — die Policies auf `public.profiles` greifen bei einer Abfrage
über die View nicht. Vier Frontend-Module lesen sie. Das Gate wäre grün in jedem
Policy-Test und offen im Betrieb.

**Verworfen: `profiles_public` auf `security_invoker = on` umstellen.** Löst es
an der Wurzel, verschiebt aber die Stufenlogik: die View trägt bewusst die
Sichtbarkeit der Basisfelder für `basic` (AGE-311 §2). Produkt-Change, nicht
Sicherheits-Change.

## Entscheidung 3 — Eigenes Token statt Supabase Auth Confirmations

**Gewählt.** Eigene Tabelle, eigene Function, Versand über Resend.

**Verworfen: Supabase Auth Confirmations.** `[auth.rate_limit] email_sent = 2`
pro Stunde, projektweit, und laut Messung aus C4 nicht erhöhbar ohne eigenen
SMTP (`HTTP 401 Custom SMTP required …`). Bei 70 Mitgliedern an einem Abend
tot. Dazu: Absender und Text müssen uns gehören.

**Verworfen: Magic Links.** Erzeugt eine Session, und eine Session allein darf
hier nichts freischalten.

## Entscheidung 4 — Das Token trägt die Identität, nicht die Session

**Gewählt.** `redeem-activation` läuft mit `verify_jwt = false` und
`service_role`. Der Client schickt Token + neues Passwort, ohne eingeloggt zu
sein.

**Verworfen: Passwort über die Session des Clients setzen.** Bricht den Fall
„anderer Browser" (AGE-495 §6) und hängt das Passwortsetzen an einer Session
statt am Token — genau die Konstruktion, die AGE-495 ausschließt.

`verify_jwt = false` liest sich wie ein Versehen und wird deshalb an drei Stellen
begründet: im Kopf der Function, in `config.toml` und hier.

## Entscheidung 5 — Zwei Migrationen statt einer

**Gewählt.** A: Schema + Helfer + Bestandsdaten. B: das Einweben.

Migration B ist ein Diff über ~35 Objekte. Zusammen mit dem Schema wäre der
Sicherheitsteil im Rauschen nicht mehr lesbar — und genau der braucht das
Review.

## Entscheidung 6 — Das Gate umfasst auch die eigenen Daten

**Korrigiert nach dem Review (codex, blockierend).**

Revision 1 nahm die Own-Data-Policies vom Gate aus, mit dem Muster „eigene Zeile
immer, fremde nur aktiviert". Das war **falsch, und zwar im Kern des Changes.**
Der Angreifer meldet sich mit dem Default-Passwort **als das Mitglied** an. Für
die Datenbank _ist_ er das Mitglied: `auth.uid()` liefert die ID des Opfers.
„Eigene Daten" sind in diesem Bedrohungsmodell die Daten des Opfers.

Konkret hätte Revision 1 einem nicht aktivierten Angreifer offengelassen:

| Policy                                | Was er bekommen hätte                   |
| ------------------------------------- | --------------------------------------- |
| `profile_contacts_select_own`         | E-Mail und Telefonnummer des Mitglieds  |
| `profiles_update_own`                 | das Profil des Mitglieds umschreiben    |
| `goals_own`, `compass_responses_*`    | persönliche Ziele und Kompass-Antworten |
| `notifications_own`                   | wer das Mitglied kontaktiert hat        |
| `offers_write_own`, `needs_write_own` | unter echtem Namen veröffentlichen      |

**Gewählt: das Gate umfasst alle 47 Policies für `authenticated`** — Fremddaten
wie eigene. Ausgenommen bleiben nur die fünf anon-Policies und
`platform_settings_select` (ein globaler Flag, kein Mitgliedsdatum).

**Das Bootstrap-Problem, das dadurch entsteht, und seine Lösung.** Wenn auch die
eigene Profilzeile gesperrt ist, kann `AuthProvider` sie nicht mehr lesen und
läuft in seinen dreifachen Retry (`AuthProvider.tsx:89`) — der
Aktivierungsbildschirm könnte sich selbst nicht anzeigen. Deshalb:

```sql
create function public.my_activation_state()
  returns table (activated boolean, display_name text)
  language sql stable security definer set search_path = ''
```

Sie gibt **genau ein Boolean und einen Anzeigenamen** zurück, sonst nichts. Das
ist die kleinste Fläche, die den Bildschirm trägt — und selbst wenn der
Angreifer sie aufruft, erfährt er nur, dass das Konto nicht aktiviert ist, und
den Namen, der ohnehin in der Rundmail-Anrede steht.

**Verworfen: die eigene Zeile spaltenweise freigeben.** Postgres kennt keine
Spalten-RLS; ein Spalten-`grant` steuert Schreiben, nicht Lesen. Es gäbe keinen
Weg, `name` freizugeben und `interests` zu sperren.

**Verworfen: den Namen aus dem JWT lesen.** Steht dort nur, wenn er beim Signup
gesetzt wurde; bei importierten Konten also gerade nicht.

## Entscheidung 7 — Der Weg hinein führt nicht über das Default-Passwort

**Neu nach der Messung (2026-08-05, gegen DEV).** Gemessen wurde: ein Konto mit
Session kann sein Passwort ohne Token und ohne Reauthentifizierung ändern
(`security_update_password_require_reauthentication = false`). Wer die
weitergeleitete Rundmail hat, kann das Konto damit auf ein eigenes Passwort
setzen.

**Was das nicht ist:** ein Weg in die App. Das Gate hält — der Angreifer sieht
keine Mitgliederdaten, und aktivieren kann er nicht, weil der Link in das
Postfach des Mitglieds geht.

**Was es ist:** eine Aussperrung. Das Mitglied käme am Login nicht vorbei und
erreichte den Aktivierungsbildschirm nie, von dem aus es seinen Link anfordert.

**Gewählt: der Weg des Mitglieds berührt das Default-Passwort nicht.**

1. Der Import (C10) stößt den Versand **direkt** an. Die Aktivierungsmail liegt
   im Postfach, bevor sich irgendwer anmeldet.
2. „Neuen Link anfordern" ist **ohne Session** erreichbar, über die
   E-Mail-Adresse (`/aktivierung` ohne Token).
3. Der Login mit dem Default-Passwort bleibt als zweiter Weg bestehen, ist aber
   nicht mehr der einzige.

Damit heilt sich der Fall von selbst: Löst das Mitglied sein Token ein, wird das
Passwort des Angreifers überschrieben und seine Sessions sterben (gemessen —
siehe Entscheidung 9).

**Verworfen: die Rundmail ohne Passwort verschicken** (zufällige Passwörter beim
Import). Wäre die sauberste Lösung und macht den Angriff unmöglich. Ausgeschieden,
weil die selbsterklärende Rundmail Detlevs Wunsch ist und Punkt 1 oben denselben
Effekt für den Weg des Mitglieds erzielt.

**Offen, nicht in diesem Change:** ob
`security_update_password_require_reauthentication` auf PROD auf `true` soll. Die
Einstellung wirkt laut Supabase nur, wenn der Login nicht „kürzlich" war — der
Angreifer hat sich gerade angemeldet. **Ungemessen.** Der Versuch, es auf DEV zu
messen, wurde vom Berechtigungs-Classifier abgelehnt; angenommen wird hier
nichts. Als Nachlauf notiert (Task 11.1).

**Korrektur aus Revision 3 (codex).** Revision 2 schrieb als Anforderung
„Passwort setzen nur mit Token" und behauptete damit etwas, das ich zwei
Absätze weiter oben selbst widerlegt gemessen hatte. Die Anforderung ist jetzt
auf das verengt, was gilt: **die Anwendung** bietet keinen Weg am Token vorbei,
und der Anmeldedienst bleibt eine benannte Restfläche mit drei Zusagen, die
tatsächlich halten. Eine Anforderung, die das System nicht erfüllen kann, ist in
jeder Prüfung grün und im Betrieb falsch — genau der Fehler, den die durable
Spec an anderer Stelle schon einmal korrigieren musste.

## Entscheidung 8 — Ein Token je Profil, von der Datenbank erzwungen

**Neu in Revision 2 (codex, opencode), korrigiert in Revision 3.** Mehrere 72
Stunden gültige Links parallel bedeuten: ein alter, nie benutzter Link aus dem
Postfach wird Wochen später zum Passwort-Reset.

**Gewählt.** Ein neuer Versand entwertet das ausstehende Token, die erfolgreiche
Einlösung ebenso. Höchstens **ein** Token je Profil ist einlösbar.

**Korrektur (codex, Revision 3):** Revision 2 wollte das über einen partiellen
Index `(profile_id) where used_at is null` und ein
`insert … where not exists (…)` erreichen. Beides trägt nicht — der Index war
nicht `unique`, und ein `where not exists` serialisiert nichts. Zwei gleichzeitige
Anforderungen kämen beide durch. Der Index wird **`unique`**; damit erzwingt die
Datenbank die Eigenschaft, und der zweite Einfügeversuch scheitert am Konflikt
statt an einer Abfrage, die eine Mikrosekunde zu früh gelesen hat.

**Die Restfläche, die das öffnet** (opencode, Revision 3): Wer die Adresse eines
Mitglieds kennt, kann durch wiederholtes Anfordern dessen ausstehenden Link
immer wieder entwerten. Begrenzt wird das allein durch die Ratengrenze je
Profil. Ein Zugang geht dabei nicht verloren — das Mitglied fordert einen neuen
Link an — aber es ist eine Belästigungsfläche, und sie wird benannt statt
verschwiegen. Unvermeidbar, weil wir vom Token nur den Hash kennen und einen
alten Link deshalb nicht erneut versenden können.

## Entscheidung 9 — Einlösung ist nicht atomar, also ist die Reihenfolge die Sicherung

**Korrigiert nach dem Review (codex, blockierend).** Revision 1 forderte
Passwortsetzung und Stempel „in einer Transaktion". Das ist nicht
implementierbar: `auth.admin.updateUserById` läuft über GoTrue per HTTP und kann
nicht mit einem Postgres-Commit klammern.

**Gewählt, vier Schritte in dieser Reihenfolge** (in Revision 3 um Schritt 1
ergänzt und in 3/4 vertauscht):

1. **Token atomar beanspruchen** —
   `update … set used_at = now() where token_hash = $1 and used_at is null and
expires_at > now() returning profile_id`. Kein Treffer → abgelehnt.
2. Passwort setzen.
3. Alle Sitzungen des Kontos beenden.
4. **Erst danach** `activated_at` stempeln.

**Warum Schritt 1 (codex, opencode, Revision 3):** Revision 2 legte nur die
Reihenfolge von Passwort und Stempel fest, nicht die Atomarität der Prüfung.
Zwei gleichzeitige Einlösungen desselben Tokens kämen beide durch das
`used_at is null` und setzten verschiedene Passwörter — das Mitglied wüsste
nicht, welches gilt. Prüfen und Verbrauchen fallen deshalb in **eine**
Anweisung zusammen.

**Warum der Stempel zuletzt (codex, opencode, Revision 3):** Revision 2 setzte
`activated_at` vor dem Sitzungswiderruf. Schlägt der Widerruf fehl, entstünde
**genau der Zustand, den dieser Change verhindern soll**: ein aktiviertes Konto
mit einer laufenden Sitzung eines Dritten hinter dem geöffneten Gate. Der
Stempel öffnet das Gate und gehört deshalb ans Ende — alles, was schiefgehen
kann, geht schief, solange das Gate noch geschlossen ist.

Bricht es nach Schritt 2 ab, steht ein Konto mit **neuem** Passwort und ohne
Aktivierung: das Mitglied kommt herein, sieht den Aktivierungsbildschirm und
fordert einen neuen Link an. Unschön, aber sicher. Die umgekehrte Reihenfolge
erzeugt den gefährlichen Zustand — aktiviert, aber noch auf dem
Default-Passwort. Das ist eine Sicherheitsaussage und gehört in den
Code-Kommentar, nicht nur hierher.

**Zum Sitzungswiderruf (opencode, Revision 2).** Der Reviewer nahm an, dass
Sessions eines Angreifers eine Passwortänderung überleben. **Gemessen: sie tun
es nicht** — nach einem Passwortwechsel waren Access- _und_ Refresh-Token tot
(`Invalid Refresh Token: Refresh Token Not Found`). Für den Self-Service-Pfad
ist der Befund damit widerlegt. Für `auth.admin.updateUserById` ist es ein
anderer Code-Pfad und **ungemessen**, deshalb der explizite Aufruf. Begründung
ist Vorsicht, nicht Befund — und der Kommentar sagt das auch so.

## Entscheidung 12 — `send-activation` kennt keine Sitzung

**Neu in Revision 3 (codex).** Revision 2 wollte `verify_jwt = false` setzen
_und_ bei vorhandener Sitzung die `sub` „aus dem vom Gateway geprüften JWT"
lesen. Das widerspricht sich: Bei `verify_jwt = false` prüft das Gateway
**nichts**. Eine so gelesene Kennung wäre vom Aufrufer frei wählbar — ein Weg,
den Bestätigungslink eines fremden Kontos auszulösen.

**Gewählt: die Function liest nie ein JWT.** Sie nimmt ausschließlich eine
E-Mail-Adresse entgegen und bestimmt daraus das Profil. Der Weg ist für
angemeldete und nicht angemeldete Aufrufer identisch — was ihn zugleich
einfacher macht als der Entwurf mit zwei Zweigen. Der Empfänger ist immer die
**hinterlegte** Adresse des Profils, nie eine mitgegebene.

## Entscheidung 13 — Die Entropie des Tokens ist eine Anforderung, kein Detail

**Neu in Revision 3 (opencode).** `redeem-activation` ist ein öffentlich
erreichbarer Endpunkt, der ein Token in eine Passwortänderung verwandelt. Die
Unerratbarkeit des Tokens ist damit der einzige tragende Parameter — und stand
in Revision 2 nur in einer Task, nicht in der Spec. Eine Task kann man beim
Umsetzen anders lesen; eine Anforderung nicht.

**Gewählt:** mindestens 256 Bit aus einem kryptografisch sicheren Generator,
als Anforderung. Dazu eine Versuchsdrosselung auf dem Endpunkt — nicht, weil ein
256-Bit-Token erraten werden könnte, sondern weil ein ungedrosselter
öffentlicher Endpunkt eine Lastfläche ist.

## Entscheidung 14 — Der Backfill sichert nicht, er scheitert laut

**Korrigiert in Revision 3 (codex, opencode).** Revision 2 wollte den Backfill
mit `where created_at < <Zeitpunkt der Migration>` gegen eine vertauschte
Reihenfolge sichern. **Das trägt nicht** — und codex hat es sauber zerlegt:
Läuft der Import zuerst, erfüllen genau die importierten Profile diese
Bedingung. Die „zweite Sicherung" war eine Bedingung, die im Schadensfall wahr
ist. opencode ergänzte den zweiten Defekt: ein Import darf `created_at` auf das
historische Beitrittsdatum zurückdatieren, dann hilft überhaupt kein Datum.

**Gewählt: eine Tripwire statt einer Sicherung.** Die Migration zählt die
vorhandenen Profile und **bricht mit einem Fehler ab**, wenn sie mehr vorfindet
als bei ihrer Abfassung gemessen (37, aus dem C4-Audit). Der Backfill selbst
läuft dann unbedingt über alle vorhandenen Zeilen.

Das ist ehrlicher als der Entwurf: Es gibt **eine** Sicherung — die
Deploy-Reihenfolge — und einen Stolperdraht, der ihre Verletzung laut macht.
Zwei unabhängige Sicherungen zu behaupten, wo eine steht, ist genau die Sorte
Zusage, die dieser Change abschaffen soll. Muster aus
`20260715150000:61` — _„lieber laute Migration als stille Fehlstufe"_.

## Entscheidung 15 — Ausloggen zeigt mehr als Nicht-aktiviert-sein

**Benannt in Revision 3 (opencode).** Die drei öffentlichen Freigaben gelten für
die Rolle `anon`. Wer eine Sitzung hat, fragt als `authenticated` und fällt
unter das Gate. Folge: **ein ausgeloggter Besucher sieht öffentliche Beiträge
und Events, ein eingeloggtes nicht aktiviertes Konto sieht sie nicht.**

**Gewählt: so lassen und benennen.** Das Schaufenster soll offen bleiben, und der
Aktivierungsbildschirm soll _keinen_ Inhalt zeigen — sonst ist er keine Wand.
Aber es sieht wie ein Fehler aus, deshalb nennt der Bildschirm den Weg
ausdrücklich („Abmelden und weiterstöbern").

**Verworfen: auch anon gaten.** Nähme dem ausgeloggten Besucher das
Schaufenster — Detlevs ausdrücklicher Wunsch, und der Grund, warum die fünf
anon-Policies überhaupt ausgenommen sind.

## Entscheidung 10 — Das Token steht im Fragment, nicht im Query-String

**Neu nach dem Review (codex).** Revision 1 schrieb `/aktivierung?token=…` und
behauptete zugleich, der Klartext verlasse das System „ausschließlich in der
Mail". Beides zusammen ist falsch: ein Query-String landet in der
Browser-Historie, in Server- und CDN-Logs und potenziell im `Referer`.

**Gewählt:** `/aktivierung#token=…`. Ein Fragment wird nie an den Server
gesendet. Dazu `Referrer-Policy: no-referrer` auf der Route und ein
`history.replaceState`, das das Fragment nach dem Auslesen entfernt.

## Entscheidung 11 — Der vollständige Change ist eine Vorbedingung für C10

**Neu in Revision 2 (opencode), zweimal korrigiert.** Migration A stempelt alle
bestehenden Profile als aktiviert, damit niemand ausgesperrt wird. Läuft der
Import zuvor, stempelt sie **genau die Konten**, um die es geht — der
Sicherheitskern wäre bei Go-Live wirkungslos, ohne dass ein Test rot würde.

**Revision 3 verwarf den Datums-Guard** (siehe Entscheidung 14); die Umsetzung
steht dort, nicht mehr hier.

**Revision 4 verschärft die Vorbedingung (codex):** Nicht Migration A muss vor
C10 stehen, sondern **der gesamte Change einschließlich Migration B**. Migration
A allein legt nur das Feld an — ohne B ist kein Gate aktiv, und ein Import
dazwischen erzeugt genau den ungeschützten Zustand, für dessen Vermeidung dieser
Change existiert.

---

## Entwurf: die Aktivierungsmail

**Status: Entwurf.** Geht so an Detlev, nicht in den Code. Ton: ein Club
schreibt seinen Mitgliedern, kein System benachrichtigt einen Benutzer. Die zwei
Sätze zur Einordnung sind Pflicht.

**Betreff:** Dein Zugang zu eff.bee.zee — nur noch ein Klick

> Liebe/r {Vorname},
>
> schön, dass du dabei bist. Der Fair Business Club hat ein neues Zuhause:
> **eff.bee.zee** ist die Plattform, auf der wir uns ab jetzt finden, austauschen
> und verabreden — der Fair Business Club ist die Premium-Community darin, mit
> allem, was du von uns kennst.
>
> Dein Profil ist schon angelegt. Damit niemand außer dir darauf zugreifen kann,
> fehlt noch ein Schritt: Bestätige diese Adresse und vergib dein eigenes
> Passwort.
>
> **[ Zugang freischalten ]**
>
> Der Link gilt 72 Stunden und lässt sich nur einmal verwenden. Forderst du
> einen neuen an, wird der alte ungültig. Bis du ihn geklickt hast, ist dein
> Profil für kein anderes Mitglied sichtbar.
>
> Falls du diese Mail nicht erwartet hast, ignoriere sie einfach. Ohne den Klick
> passiert nichts.
>
> Herzliche Grüße
> Detlev Kraft
> Fair Business Club
>
> _Der Link funktioniert nicht? Kopiere diese Adresse in deinen Browser: {url}_
> _Fragen? Schreib uns an info@fairbusinessclub.de_

**Vier Stellen, an denen der Text eine technische Zusage macht** und die deshalb
stimmen müssen: „gilt 72 Stunden" (`expires_at`), „nur einmal verwenden"
(`used_at`), „ein neuer macht den alten ungültig" (Entscheidung 8) und „für kein
anderes Mitglied sichtbar" (das Gate). Ändert sich eines, ändert sich der Text
mit.

**Zwei Korrekturen aus dem Review (opencode, Revision 2).** Der Entwurf sagte
zuvor „für niemanden sichtbar — **auch nicht für uns**". Das ist falsch:
`service_role` und der Datenbankbetrieb sehen das Profil unabhängig vom Gate.
Eine Datenschutzzusage an Mitglieder, die nicht hält, ist schlimmer als keine —
gestrichen und auf „für kein anderes Mitglied" verengt, was stimmt.

Und: Entscheidung 8 entwertet den alten Link, sobald ein neuer angefordert wird.
Der Entwurf versprach zugleich 72 Stunden. Wer zweimal anfordert und den ersten
Link öffnet, träfe auf eine unerklärte Ablehnung. Jetzt steht es im Text.

**Bewusst nicht drin:** das Default-Passwort. Es steht in der Rundmail; es hier
zu wiederholen, verdoppelt die Angriffsfläche in genau dem Postfach, das wir
gerade zur Hürde erklären.

## Entscheidung 16 — Sichtbar wird man erst nach der Bestätigung

**Entscheidung Donald, 2026-08-06**, nach codex' Befund in Runde 3.

Bis Revision 3 prüfte das Gate nur den **Aufrufer**. Ein bereits aktiviertes
Mitglied sah damit die Profile der **noch nicht aktivierten** — also genau der
frisch importierten, denn `profiles.is_public` steht per Default auf `true`. Der
Satz im Mailentwurf, „bis du ihn geklickt hast, ist dein Profil für kein anderes
Mitglied sichtbar", war damit **falsch**. Keine Formulierungsfrage: eine Zusage
an siebzig Menschen in einer Mail, die Detlev unterschreibt.

**Gewählt: das Gate prüft beide Seiten.** Ein Profil erscheint im Verzeichnis
erst, wenn sein Inhaber bestätigt hat. Die Bedingung kommt zusätzlich auf die
**Zeile**, nicht nur auf den Aufrufer:

```sql
-- profiles_public
where is_public
  and public.is_activated()          -- der Aufrufer
  and activated_at is not null       -- das Zielprofil   ← neu
```

Betroffen sind die Verzeichnisflächen: `profiles_public`,
`profiles_select_self_or_discover`, `interests_select`, `theme_scores_select`,
`profile_badges_select`, `offers_select`, `needs_select`,
`contacts_select_self_or_released`.

**Inhalte brauchen es nicht.** `posts`, `events`, `comments` und die
Interaktionstabellen können keinen nicht aktivierten Urheber haben — die
schreibenden Policies sind gegatet (`INVENTORY.md` A1), und importierte Konten
starten leer. Die Bedingung dort zu wiederholen wäre eine Prüfung ohne
möglichen Fall.

**Die akzeptierte Folge, ausdrücklich so gewollt:** Am Go-Live-Abend ist das
Verzeichnis zunächst leer und füllt sich, während die Mitglieder aktivieren. Wer
als Erster klickt, sieht **Detlev und Donald** — die beiden Bestandskonten, die
der Backfill als aktiviert führt. Das ist kein Fehler und darf nicht als solcher
„repariert" werden.

**Verworfen: den Satz aus dem Mailtext streichen** und die Sichtbarkeit lassen,
wie sie war. Das Verzeichnis wäre ab dem ersten Tag vollständig, aber ein
importiertes Mitglied stünde darin, bevor es je etwas bestätigt hat — und die
Bestätigung ist der Punkt des ganzen Changes. Entscheidung Donald: die Zusage
gilt, die Leere am ersten Abend wird in Kauf genommen.
