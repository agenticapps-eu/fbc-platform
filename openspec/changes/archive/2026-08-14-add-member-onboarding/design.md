# Design — Mini-Onboarding nach der Aktivierung (AGE-538, Teil 1)

Acht Entscheidungen. Die erste, dritte und vierte sind die, an denen dieser
Change scheitern kann.

## 1. Der Einstieg hängt am Aufruf von `/`, und das steht auch so da

**Das Problem.** Das Issue sagt „direkt nach dem Passwortsetzen". Das geht nicht:
`redeem-activation/index.ts:81` ruft `revoke_sessions`,
`ActivationRedeemPage.tsx:167` meldet sofort ab, Zeile 176 leitet nach zehn
Sekunden auf `/login`. Nach dem Passwortsetzen existiert keine Sitzung, in der
sich etwas zeigen ließe. `access-control` hält das ausdrücklich fest: „alle
Sitzungen widerrufen … das ist richtig und bleibt so."

**Die Wahl.**

| Ort | Warum nicht / doch |
|---|---|
| Ein Gate um die `AppShell`, wie `ActivationGate` | **Nein.** Eine Sperre über *jeder* Route. Das Issue verbietet genau das, und die Strecke hat zwei Auswege. |
| `AuthProvider`, beim `SIGNED_IN`-Ereignis | **Nein.** Navigation aus einem Kontext ohne Routenwissen; und das Ereignis feuert auch beim Tab-Wechsel und beim Token-Refresh. |
| `HomeRedirect` (`/`) | **Ja.** `LoginPage.tsx:67` schickt nach der Anmeldung auf `/`. |

**Der Auslöser heißt deshalb „Aufruf der Startseite", nicht „Sitzungsaufbau".**
Ein früherer Stand dieses Designs schrieb Letzteres und verlangte im selben
Atemzug, dass andere Routen unberührt bleiben — das widerspricht sich. Eine
wiederhergestellte Sitzung auf `/mitglieder` löst nichts aus, und das ist
gewollt. Die Anforderung sagt jetzt, was der Code tut.

**`HomeRedirect` ist die historisch dafür vorgesehene Naht.** Sie fing bis C2
genau diesen Fall ab; C2 hat den Fragebogen entfernt und den Kommentar
„entscheidet endgültig nichts mehr" hinterlassen. Der Platz ist frei.

## 2. Die Weiche hat drei Zustände, nicht zwei

Der Merker kommt aus der Datenbank, also ist er beim ersten Rendern **unbekannt**.
Wer nur `merker === null` prüft, hat einen dritten Fall stillschweigend dem
„umleiten"-Zweig zugeschlagen und bekommt ein Flackern: erst Dashboard, dann
Sprung — oder umgekehrt.

| Zustand | Verhalten |
|---|---|
| **lädt** | Weder umleiten noch das Dashboard zeigen. Ein Ladezustand, wie ihn `ActivationGate` für dieselbe Frage schon hat. |
| **Fehler** | **Nicht** umleiten. Die Startseite zeigen. Ein Netzfehler darf niemanden in eine Strecke werfen, und er darf erst recht nicht so aussehen, als sei der Merker gesetzt. |
| **fertig** | `user && isActivated === true && onboarded_at === null` → `/willkommen`. |

`isActivated === true` ausdrücklich, nicht `!== false`: für einen ausgeloggten
Besucher meldet das System „aktiviert", weil es nichts zu aktivieren gibt —
dieselbe Falle, die in `ActivationRedeemPage.tsx:129-135` schon einmal zuschlug
und dort beim Betrachten der laufenden Oberfläche auffiel, nicht im Test.

**Nach dem Setzen des Merkers muss der gelesene Zustand nachziehen, bevor
navigiert wird.** Sonst schickt `/` das Mitglied zurück in die Strecke, die es
gerade beendet hat.

## 3. Der Merker liegt in `member_settings`, nicht in `profiles`

Zwei Gründe, und der erste ist eine Sichtbarkeitsfrage:

**`profiles` ist ab `discover` fremdlesbar.** Die Policy
`profiles_select_self_or_discover` lautet `id = auth.uid() or has_level(3)`. Ein
Merker dort wäre für jedes zahlende Mitglied sichtbar — eine Preisgabe, die
dieser Change nirgends beabsichtigt und ein früherer Stand des Proposals
ausdrücklich bestritt. `member_settings` ist laut eigenem Tabellenkommentar
„strictly own-profile only", Policy `member_settings_own`, `for all`,
`profile_id = auth.uid()`.

**`profiles` hat für `authenticated` kein Tabellen-UPDATE.**
`20260611171003_foundation_conform.sql:79` widerruft es und erteilt eine
**Spaltenliste**; eine neue Spalte erbt daraus nichts (AGE-312), bräuchte also
einen eigenen Grant — und der bricht den Golden-Snapshot in `grants_test.sql`
samt CI-Job (AGE-455). `member_settings` trägt dagegen `grant select, insert,
update` auf Tabellenebene. Präzedenzfall im Repo:
`20260804120000_member_settings_theme.sql`, dessen Kopf ausdrücklich festhält
„KEINE neue Policy und KEIN neuer Grant".

Eine Migration ohne Grant, ohne Policy und ohne Snapshot-Bruch statt einer mit
allen dreien. Der Befund kam aus dem Plan-Review und hat den Change verkleinert.

**`timestamptz`, nicht `boolean`.** Kostet nichts. Eine Auswertung „wer hat die
Strecke gesehen" trägt der Wert allerdings **nicht** — er wird erst am Ausgang
gesetzt, Abbrecher bleiben `NULL`, und Abschluss und Überspringen sind nicht
unterscheidbar. Wer das wissen will, braucht ein Ereignis; dieser Change baut
keins und behauptet auch nicht, die Frage zu beantworten.

**`upsert`, nicht `update`.** Die Zeile in `member_settings` entsteht bei der
Registrierung nicht. Ein `update` auf eine nicht existierende Zeile meldet
keinen Fehler — es ändert null Zeilen, und der Merker wäre stumm nicht gesetzt.

## 4. Geschrieben wird feldbezogen — `saveProfile` ist hier eine Falle

`saveProfile` (`profile.ts:303`) sieht nach dem richtigen Weg aus und ist es
nicht. Ein Aufruf schreibt **alle** vierzehn Profilspalten, upsertet
**bedingungslos** `profile_contacts` und **löscht und ersetzt** die
Kindtabellen für Interessen und Ziele.

Aus Schritt 1 heraus aufgerufen — mit einem Formular, das nur `headline` kennt —
räumte er die Kontaktzeile und sämtliche Interessen weg. Bei einem gerade
importierten Mitglied wäre das exakt der Datenbestand, für den der Import
gebaut wurde.

Die Strecke schreibt deshalb **nur die Spalte ihres Schritts**, auf die eigene
Zeile. Aus `profile.ts` wird ausschließlich der Bild-Upload wiederverwendet. Der
Test dafür prüft nicht, dass das Feld geschrieben wurde — das ist die leichte
Hälfte —, sondern dass **Interessen und Kontaktzeile unverändert** sind.

## 5. Schritt 2 ist additiv, und zwar als Regel, nicht als Gewohnheit

`offers`/`needs` haben drei Schreiboberflächen: den reichen Suche-&-Biete-Editor
(ersetzt die Sammlung), den geführten Kompass (rein additiv) und die Chips im
Profil-Editor (gleichen **je Kategorie** ab). Der Kopf von
`profile-categories.ts` benennt die Falle: eine vierte Oberfläche mit
Ersetzen-Muster vernichtete die Beschreibungen, Tags und Volumenbänder der
anderen.

Ein früherer Stand dieses Designs sagte „die Strecke wählt nur an" — eine Aussage
über die Bedienung, die eine vorbelegte Chip-Reihe sofort widerlegt: was gesetzt
angezeigt wird, kann angeklickt und damit **abgewählt** werden, und
`planReconciliation` löscht dann *alle* eigenen Zeilen dieser Kategorie.

**Die Regel ist deshalb baulich, nicht rhetorisch:** ein Chip für eine bereits
gesetzte Kategorie ist als gesetzt zu sehen und **nicht bedienbar**. Damit kann
`ConfirmationRequiredError` hier nicht entstehen — nicht weil man es nicht tut,
sondern weil es die Oberfläche nicht anbietet. Das Abwählen bleibt im
Profil-Editor, der den Bestätigungsdialog dafür hat.

## 6. Zwei Auswege, und der Unterschied ist der Merker

Entscheidung Donald, 2026-08-14.

| | setzt den Merker | kommt wieder |
|---|---|---|
| **„Später"** | nein | ja, beim nächsten Aufruf von `/` |
| **„Überspringen"** | ja | nie |

„Überspringen" **warnt vorher**, und zwar positiv: nicht „du verlierst", sondern
was man gewinnt — ohne Kategorien findet einen der Kompass-Filter nicht, und das
ist der Weg, auf dem die anderen Mitglieder einen finden. Die Warnung ist der
Grund, warum es „Später" überhaupt gibt: ohne die Alternative wäre sie ein
Druckmittel.

Vorweg steht die **Nutzenerklärung** — kurz, und aus der Sicht des Mitglieds. Sie
ist der eigentliche Unterschied zwischen einer Formularwand und einem Empfang.

## 7. Wiederaufnahme heißt: erstes leeres Feld

„An der Stelle fortsetzen, an der noch etwas fehlt" klingt nach gespeichertem
Fortschritt, und den gibt es nicht. Aus den Daten ist **nicht** ableitbar, ob
jemand einen Schritt bewusst leer weitergeklickt oder nie gesehen hat.

Statt dafür einen Zustand zu erfinden, wird die Regel schmaler und ehrlich:
**die Strecke beginnt beim ersten Schritt, dessen Feld leer ist.** Wer einen
Schritt leer weitergeht, sieht ihn beim nächsten Mal wieder — das ist der Preis
dafür, keinen zweiten Zustand zu führen, und für einen Weg mit „Später" und
„Überspringen" tragbar. Wer die Strecke nicht mehr sehen will, hat dafür einen
Knopf.

`region` ist dabei **Pflichtfeld** im Profil-Schema
(`profile.ts:38`, `min(1)`), aber in der Strecke nicht: hier wird ergänzt, nicht
validiert.

## 8. Eine Seite, kein Overlay, kein `NARROW_ROUTES`

`/willkommen` liegt außerhalb der `AppShell` wie `/login` und `/onboarding` und
braucht **kein** `useOverlay`: es gibt keine Seite dahinter, die scrollen könnte,
und keinen Fokus, der entweichen kann.

**`NARROW_ROUTES` bekommt keinen Eintrag.** Die Liste (`AppShell.tsx:21`) wird in
Zeile 268 gelesen — *innerhalb* der Shell. Für eine Route außerhalb ist sie ohne
Wirkung. Dass `/login` und `/onboarding` heute schon wirkungslos darin stehen,
ist ein Nachlauf und gehört nicht in diesen Diff.

`region` ist ein **Freitextfeld**, kein Auswahlfeld: `ProfileFieldsets.tsx:46` ist
ein `<Input {...register("region")}>`. Eine verbindliche Liste der FBC-Standorte
gibt es nicht. Die Strecke übernimmt das Freitextfeld unverändert — eine Liste zu
erfinden hieße, 31 vorhandene Werte gegen eine Auswahl zu prüfen, die niemand
abgenommen hat.

## Was dieser Change bewusst nicht anfasst

**`set_profile_completion`.** Der Trigger zählt zwölf Profilspalten;
`offers`/`needs` sind keine davon. Schritt 2 — der wichtigste — hebt die Zahl um
nichts. Den Trigger zu erweitern hieße, die angezeigte Vollständigkeit **jedes**
bestehenden Mitglieds zu verschieben, und zwar nach unten, weil ein dreizehntes
Feld bei allen fehlt, die keine Kategorien haben — heute 70 von 70. Eigene
Entscheidung, eigene Abwägung, nicht die Nebenwirkung eines Oberflächen-Changes.

Die Wirkung von Schritt 2 wird deshalb dort gemessen, wo sie hingehört: **das
Mitglied taucht im Kategorienfilter des Verzeichnisses auf.**

**`OnboardingPage.tsx` und `/onboarding`.** Bleiben, wie sie sind. C2 hat den
Mini-Compass bewusst im Code gelassen und nur den Zwang entfernt. Zwei Routen mit
verwandtem Zweck nebeneinander ist der Preis; ihn hier zu bezahlen ist billiger
als einen unbeteiligten Umbau in diesen Diff zu ziehen. Notiert als Nachlauf.
