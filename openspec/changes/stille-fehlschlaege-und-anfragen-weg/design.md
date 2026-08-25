# Design — Stille Fehlschläge und der Weg zu Anfragen (AGE-591/592/593)

## Context

Drei Stellen, ein Muster: die Oberfläche hat einen Zustand, für den **kein Zweig
etwas sagt**, und dieser Zustand sieht aus wie Erfolg oder wie Leere.

- `LoginPage.onSubmit` kennt zwei Ausgänge: Fehler → Meldung, Erfolg → die neue
  Sitzung löst die Seite ab. Es gibt einen dritten — **kein Fehler, keine
  Sitzung** —, und der ist stumm. Schlimmer: `AuthProvider.signUp` behandelt
  denselben dritten Ausgang als Erfolg und feuert seine Nebenwirkungen.
- `MeineAnfragenWidget` fasst `isError` mit `data.length === 0` in **eine**
  Bedingung, die `null` liefert.
- `/kontakte` trägt `section: "sub"`, und `SIDEBAR_SECTIONS` rendert nur
  `entdecken` und `mein-bereich` — die Fläche existiert, hat aber keinen Weg.

## Goals / Non-Goals

**Goals:** Jeder dieser Zustände wird sichtbar, **einschließlich des
Fehlerzustands der neuen Fläche selbst**. Der Zähler benutzt dieselbe Abfrage wie
das Widget.

**Non-Goals:**

- Keine Benachrichtigungsfläche, kein Glocken-Menü. Das wäre ein neues Konzept
  für ein Problem, das ein Menüeintrag löst.
- Kein Zähler an anderen Einträgen. Nur dort, wo etwas auf eine Entscheidung
  wartet.
- Keine Änderung an GoTrues Aufzählungsschutz. Der 200er ohne Sitzung ist
  richtig; nur die Oberfläche schweigt zu Unrecht.
- **Kein Umbau des Registrierungsverlaufs.** Siehe Risiken: die beiden Ausgänge
  bleiben von außen unterscheidbar, und das zu ändern wäre ein eigener Vorgang.
- Kein Widerruf, keine Änderung an der Freigabelogik.

## Decisions

### 1. Der Zähler liest den Cache des Widgets, mit ausgesprochener Frischezeit

`AppShell` ruft `fetchIncomingRequests` unter **demselben** `queryKey` auf wie
`MeineAnfragenWidget` (`incomingRequestsQueryKey(uid)`). React Query teilt den
Eintrag, und beide Flächen können nicht auseinanderlaufen.

**Verworfen: eine schlanke `count`-RPC.** Sie wäre die zweite Wahrheit über
denselben Bestand — genau das Muster, das in diesem Repo schon einmal dazu
führte, dass eine Zahl und eine Liste verschiedene Dinge behaupteten. Die Liste
ist kurz (offene Anfragen an EIN Mitglied); ihre Länge ist der Zähler.

**Korrektur aus dem Plan-Review: „ein Schlüssel heißt eine Anfrage" ist falsch.**
Zwei Dinge stimmten am ersten Entwurf nicht. Erstens setzt
`fetchIncomingRequests` bei vorhandenen Zeilen **zwei** Supabase-Anfragen ab
(`contact_requests`, dann `profiles_public`) — der geteilte Cache-Eintrag macht
daraus eine Ladung, nicht eine Anfrage. Zweitens ist mit den Vorgaben von React
Query v5 (`staleTime: 0`) jeder Wert sofort veraltet, und Mounten, Fensterfokus
und Reconnect holen neu; die Sidebar ist auf **jeder** Seite montiert. Deshalb:

`ANFRAGEN_STALE_TIME_MS = 30_000`, exportiert aus `lib/contact-requests.ts` und
von **beiden** Flächen benutzt. Dreißig Sekunden, weil eine eingehende
Kontaktanfrage kein Sekundengeschäft ist und ein Blick auf einen halbminütigen
Stand niemandem schadet — und weil ein geteilter Wert an einer Stelle steht, die
man ändern kann, ohne zwei Aufrufer zu suchen.

`enabled: !!uid` — ohne Kennung wird gar nicht erst gefragt.

### 2. Der Eintrag ist bedingt, nicht der Zähler

Der erste Entwurf zog `/kontakte` dauerhaft nach `mein-bereich` und ließ nur das
Abzeichen bedingt erscheinen. Der Plan-Review hat gezeigt, dass das eine
verdeckte Rücknahme von AGE-494 ist. **Entscheidung Donald (25.08.): der
Eintrag selbst ist bedingt**, und er heißt **„Meine Anfragen"**.

- offene Anfragen > 0 → Eintrag mit Zahl
- Abruf gescheitert → Eintrag **ohne** Zahl, als „unbekannt" gekennzeichnet
- keine offenen Anfragen → **kein** Eintrag
- ausgeloggt / lädt noch → **kein** Eintrag, keine Abfrage

Der Preis ist eine Navigation, die nicht in jedem Moment gleich aussieht. Das ist
hier richtig herum: Der Eintrag ist kein Ort, sondern ein **offener Vorgang**.
`/kontakte` bleibt `section: "sub"` — die Route ändert sich nicht, nur die
Sidebar bekommt für diesen Fall einen eigenen Eintrag.

**Das Label ist nicht „Meine Kontakte".** Unter der Bedingung „es liegt eine
Anfrage an" wäre das der falsche Name für den Anlass, und der Plan-Review hat
zusätzlich zu Recht bemerkt, dass eine nackte „2" neben „Meine Kontakte"
genauso „zwei Kontakte" heißen kann. Der Name sagt, was gezählt wird, und der
zugängliche Name des Eintrags sagt es noch einmal ausdrücklich („Meine Anfragen,
2 offen").

**Auch in der eingeklappten Leiste sichtbar.** Dort trägt das Icon allein; das
Abzeichen sitzt als kleine Marke darüber. Es eingeklappt wegzulassen wäre bequem
und falsch: wer die Leiste einklappt, verliert sonst genau das Signal, für das
dieser Change existiert. Achtung dabei: die eingeklappte Leiste setzt heute
`aria-label` am Link — ein `aria-label` **ersetzt** den Inhalt, das Abzeichen
verschwände sonst für Screenreader. Der Name wird deshalb zusammengesetzt.

### 3. Der Zähler darf nicht selbst stumm scheitern

Der schärfste Befund des Plan-Reviews: Ein Abzeichen, das bei einem gescheiterten
Abruf einfach nicht erscheint, ist von „keine Anfragen" nicht zu unterscheiden —
der Change risse ein **viertes** Loch in genau die Fläche, auf die er sich
verlässt. Mit dem **bedingten** Eintrag aus Entscheidung 2 wird das schlimmer,
nicht besser: dann fehlte nicht nur die Zahl, sondern der ganze Weg.

Also: **scheitert der Abruf, erscheint der Eintrag** — ohne Zahl, mit einer
Marke, die „unbekannt" bedeutet, und mit dem zugänglichen Namen „Meine Anfragen,
konnte nicht geladen werden". Fail **loud**, und in die sichere Richtung: ein
Eintrag zu viel kostet eine Zeile im Menü, ein Eintrag zu wenig kostet die
Anfrage.

### 4. `signUp` reicht die Sitzung durch — und hängt seine Nebenwirkungen daran

`AuthProvider.signUp` gibt heute nur `{ error }` zurück. Es bekommt
`{ error, hatSession: boolean }` — abgeleitet aus `data.session`.

**Kein `data.session` nach außen.** Der Aufrufer braucht die Antwort auf „gibt es
eine Sitzung?", nicht das Sitzungsobjekt; ein Sitzungsobjekt in der Seite wäre
eine zweite Quelle neben dem Auth-Zuhörer.

**Und derselbe Wert gatet die Nebenwirkungen.** `logEvent("signup")` und
`resendActivationLink()` hängen heute an `if (!error)` und laufen deshalb auch
bei einer Wiederholung. Der Versand ist sitzungsgebunden und scheitert dann mit
`42501` — das ist die Zeile in den PROD-Logs —, und die Zählung addiert
Registrierungen, die keine waren. Beide ziehen hinter `data.session`.

Bemerkenswert: Der Kommentar an dieser Stelle sagte schon immer „Die Sitzung
besteht an dieser Stelle bereits". Er beschrieb den Normalfall und wurde als
Invariante gelesen. Der bestehende Test hat die Lücke **festgeschrieben** — seine
Attrappe liefert `{ data: { user: { id } }, error: null }`, also nie eine
Sitzung, und prüfte damit den Versand ausgerechnet im Fall, in dem er nicht
laufen darf.

### 5. Gemessen: die Prämisse des Issues hat sich verschoben — der Zweig bleibt

**Beim Bauen nachgeprüft, statt geglaubt.** Der stumme 200er ohne Sitzung tritt
nur auf, solange die eingebaute E-Mail-Bestätigung **eingeschaltet** ist. Genau so
stand PROD zwischen dem 16. und dem 25.08. — daher die Beobachtung, die dieses
Issue ausgelöst hat. Seit `mailer_autoconfirm` wieder `true` ist, antwortet GoTrue
auf eine Wiederholung mit **HTTP 422 `user_already_exists`**. Am 2026-08-25 gegen
den lokalen Stack gemessen (`enable_confirmations = false`, dieselbe Einstellung
wie PROD).

Damit ist der heute live sichtbare Fehler ein **anderer**, aber kein kleinerer:
Das Formular zeigte `error.message` roh an — „User already registered". Englisch,
führt nirgendwohin, und es verrät geradeheraus, dass die Adresse vergeben ist.
Ausgerechnet die Aussage, die der Aufzählungsschutz im anderen Zweig sorgfältig
vermeidet. Für die betroffene Gruppe — importierte, nicht aktivierte Mitglieder —
ist das genauso eine Sackgasse wie die Stille, nur eine gesprächigere.

**Beide Wege enden deshalb im selben neutralen Hinweis.** Erkannt wird der Fall am
`code` und nicht am Text: Der Text kommt vom Server, ist englisch und kann sich
mit jeder Version ändern — eine Prüfung darauf wäre genau die Art Zusage, die
still ausfällt.

**Der Zweig „ohne Sitzung" bleibt trotzdem**, obwohl er auf PROD heute nicht
erreicht wird. Wird die Bestätigung wieder eingeschaltet — und das ist eine
Betriebseinstellung, keine Naturkonstante —, ist er sofort wieder der aktive.
Ihn mit „kommt ja nicht vor" wegzulassen hieße, die Stille an eine Einstellung zu
hängen, die niemand beim Umlegen mit diesem Code in Verbindung bringt.

**Was NICHT passiert: alle Fehler einsammeln.** Nur `user_already_exists` wird
umgeleitet. Ein Formular, das jeden Fehler in denselben freundlichen Hinweis
übersetzt, ist wieder genau die Fläche, die nichts sagt — dafür gibt es eine
eigene Gegenprobe.

### 6. Der Fluchtweg heißt Zugangslink, nicht Passwort zurücksetzen

Der erste Entwurf führte den Hinweis auf „Passwort zurücksetzen". Der
Plan-Review hat den Adressaten dagegengehalten: **70 von 73 Konten** sind
importiert und nicht aktiviert; sie haben kein Passwort, das sich zurücksetzen
ließe, und sie sind genau die Gruppe, die „Registrieren" statt „Aktivieren"
drückt. Der Hinweis führt deshalb auf **`/aktivierung`**, das ohne Token das
Formular „Bestätigungslink anfordern" zeigt — dorthin, wo ihr Problem gelöst
wird. Daneben steht der Weg zur Anmeldung, für den kleinen Rest, der schon ein
Passwort hat.

### 7. `isError` bekommt einen eigenen Zweig — aber nur ohne Daten

Das Widget rendert im Fehlerfall eine Karte mit Hinweis; `data.length === 0`
liefert weiter `null`.

**Verfeinert nach dem Plan-Review:** ein nackter `isError`-Zweig würde bei einem
gescheiterten **Nachladen** vorhandene, beantwortbare Anfragen durch eine
Fehlermeldung ersetzen, während das Abzeichen ihre Zahl weiter zeigt. Die
Bedingung ist deshalb `isError && !data`. Liegen Daten vor und scheitert die
Aktualisierung, bleibt die Liste stehen und bekommt eine Zeile darüber, dass der
Stand nicht aktuell ist.

## Risks / Trade-offs

- **Der Zähler lädt die Liste, auch wenn niemand `/kontakte` öffnet.** → Eine
  Ladung je halbe Minute und Sitzung, geteilt über den Cache. Der Preis sind ein
  bis zwei Anfragen; der Gegenwert ist das einzige Signal, das es gibt.
- **Die Navigation ist nicht stabil** — ein Eintrag kommt und geht. → Bewusst;
  siehe Entscheidung 2. Ein Vorgang ist kein Ort.
- **Die beiden Registrierungsausgänge bleiben unterscheidbar.** Eine unbekannte
  Adresse erzeugt eine Sitzung und löst die Seite ab, eine bekannte nicht. Wer
  Adressen aufzählen will, sieht das heute schon — der Hinweis fügt **keinen**
  neuen Beobachtungsweg hinzu, er ersetzt einen stummen Knopf durch einen, der
  redet. Das zu schließen hieße, den Verlauf umzubauen (kein Auto-Login nach der
  Registrierung, „prüfe dein Postfach" in beiden Fällen) — ein eigener Vorgang,
  der die Entscheidung aus AGE-445 berührt. **Hier ausdrücklich nicht getan**, und
  in der Spec als Nicht-Zusage benannt, statt sie als Szenario zu behaupten, das
  die Bauart gar nicht erfüllen kann.
- **Ein Eintrag bei gescheitertem Abruf kann ein Fehlalarm sein** — es lag
  vielleicht gar nichts an. → Richtige Richtung: eine Zeile im Menü gegen eine
  übersehene Anfrage.

## Migration Plan

Keine Migration, kein Deploy-Sonderweg. Rücknahme: der Commit zurück.

## Open Questions

Keine.
