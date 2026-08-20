## Context

Nach AGE-534 stehen 70 importierte Mitglieder in PROD, alle mit
`activated_at = null`. Die SELECT-Policy auf `profiles` lautet

    is_activated() AND activated_at IS NOT NULL AND (id = auth.uid() OR has_level(3))

und `search_directory` ist **kein** `SECURITY DEFINER`, läuft also unter den
Rechten des Aufrufers. Damit ist ein unbestätigtes Profil über den
Verzeichnisweg für niemanden sichtbar — auch nicht für einen Admin. Was heute
existiert, ist `admin_find_profile`: `SECURITY DEFINER`, `is_admin()`-geprüft,
ohne Aktivierungsfilter, aber mit einer Mindestlänge von drei Zeichen und
entschärften Jokerzeichen, ausdrücklich damit daraus **keine** Liste wird
(`20260811090300_admin_profile_functions.sql:312`).

Dieselbe Aktivierungsbedingung steht an mehreren Stellen: in der
`profiles`-Policy, in der View `profiles_public` (`security_invoker=off`) und in
mehreren DEFINER-Funktionen. Das ist die entscheidende Randbedingung für den
Entwurf — es gibt keinen einen Ort, an dem man sie für Admins lockern könnte.

Vier Entscheidungen wurden am 17.08. mit Donald getroffen und sind Vorgabe, nicht
Gegenstand dieses Dokuments: kein admin-gesetztes Passwort; drei Sichten; keine
Kontaktdaten in der Liste; beide Aktivierungswege getrennt beschriftet.

## Goals / Non-Goals

**Goals:**

- Ein Admin sieht alle Mitglieder, blätternd und filterbar, einschliesslich der
  unbestätigten, und erkennt deren Zustand.
- Ein Admin kann einem Mitglied den Zugang eröffnen — regulär über einen
  Zugangslink, ausnahmsweise durch direktes Aktivieren.
- Die Verzeichnis-Ansicht zeigt, was Mitglieder sehen, ohne die Karte nachzubauen.
- Kein bestehender, mitgliedersichtbarer Lesepfad wird verändert.

**Non-Goals:**

- Massen-Mail, CRM, Themen-Newsletter — das bleibt AGE-304.
- Mehrfachauswahl oder Empfängerlisten.
- Kontaktdaten (`profile_contacts`) in der Liste.
- Eine Vorschau „wie sähe dieses Profil einem `basic`-Mitglied aus?". Das prüft
  die Stufenrechte und beantwortet damit eine andere Frage als die, die hier
  ansteht; verworfen als eigenständiges Werkzeug.
- Änderungen an `search_directory`, `profiles_public` oder der `profiles`-Policy.

## Decisions

### Ein eigener Lesepfad daneben, statt den bestehenden zu lockern

`admin_list_members` ist eine neue `SECURITY DEFINER`-Funktion im Muster ihrer
vier Nachbarn: `set search_path = ''`, `is_admin()` als erste Anweisung, `42501`
sonst.

*Verworfen — die Aktivierungsbedingung für Admins lockern* (`… or is_admin()`):
Das Prädikat steht an vier Stellen, von denen drei mitgliedersichtbar sind. „An
einer Stelle lockern" gibt es nicht; ein Fehler in einer davon trifft nicht die
zwei Admins, sondern alle Mitglieder. Der Preis der Ablehnung ist eine zweite
Projektion — siehe Risiken.

*Verworfen — `search_directory` in einen gemeinsamen Kern zerlegen und beide
Aufrufer darauf setzen:* sauberer gegen Divergenz, aber es ist ein Eingriff in
eine funktionierende, mitgliedersichtbare Funktion, um eine Admin-Ansicht zu
bauen. Der Aufwand trägt das Risiko nicht.

### Eine Funktion, drei Sichten

`admin_list_members` liefert die Vereinigung dessen, was alle drei Sichten
brauchen: die Verzeichnisspalten plus `login_email`, `bestaetigt`,
`member_since`. Die Sichten rendern Teilmengen derselben Zeilen.

Die **Zahl** der Verzeichnisspalten steht bewusst nirgends. Die erste Fassung
schrieb „dreizehn"; es sind vierzehn, seit `directory_search_categories` gelaufen
ist. Eine Zahl in Prosa oder Test ist beim nächsten Feld wieder falsch — der
Katalogvergleich bestimmt die Projektion, nicht eine Zusage über ihre Grösse.

*Verworfen — zwei Funktionen (eine für die Verwaltungssichten, eine für die
Verzeichnis-Ansicht):* zwei Datenwege, zwei Testflächen und die Möglichkeit,
dass dieselbe Zeile in zwei Sichten unterschiedlich aussieht.

### Der Suchbegriff ist optional — anders als bei `admin_find_profile`

Dort erzwingen drei Zeichen genau das Aufzählen, das diese Funktion tun **soll**.
Der Schutz war richtig, solange es keine Liste geben durfte; ihn hier nachzubauen
hiesse, eine Liste zu bauen, die nichts listet. Die Jokerzeichen-Entschärfung
(`%`, `_`, Escape `!`) wird dagegen **übernommen** — sie schützt vor kaputten
Mustern, nicht vor dem Aufzählen, und dieser Zweck bleibt.

### Paging von Anfang an — und die Sortierung ist entschieden, nicht vertagt

`p_limit`/`p_offset` stehen in der Signatur und werden von der Fläche benutzt.
Bei 70 Datensätzen bringt das noch nichts; die Signatur später zu ändern, wenn
sie Aufrufer hat, kostet mehr als sie jetzt richtig zu setzen.

**Alle vier Parameter tragen einen Vorgabewert.** Ohne ihn scheitert ein
argumentloser Aufruf mit „function does not exist", also mit einem anderen Fehler
als der zugesicherten `42501` — und jedes Szenario, das den Aufruf ohne
Argumente beschreibt, prüfte etwas anderes als es behauptet.

**Sortiert wird: unbestätigte zuerst, dann `name`, dann `id`.** Die erste Fassung
verlangte nur „stabil" und vertagte den Rest — das genügt nicht. Nach `name`
allein ist die Reihenfolge bei Dubletten und bei `null` unbestimmt, und eine
unbestimmte Reihenfolge lässt beim Blättern Zeilen doppelt erscheinen oder
ausfallen. Der `id`-Stichentscheid ist deshalb Teil der Zusage, nicht Beiwerk.

Die Folge davon ist zu benennen statt zu verschweigen: eine Aktivierung
verschiebt eine Zeile aus der ersten Gruppe in die zweite, sie wandert also
zwischen den Seiten. Das ist der Preis dafür, dass die Liste die Frage „wer
wartet noch?" schon durch ihre Reihenfolge beantwortet — und der Grund, warum die
Fläche nach einer Aktivierung neu lädt.

### `admin_activate_member` daneben, `mark_activated` unangetastet

`mark_activated` prüft `is_admin()` bewusst nicht: sie wird von
`redeem-activation` mit `service_role` gerufen, und `service_role` hält in diesem
Projekt auf keiner Tabelle Rechte, läuft also ohnehin nur über DEFINER-Funktionen.
Ihr eine Admin-Prüfung hinzuzufügen bräche den Einlöseweg. Die neue Hülle prüft
`is_admin()` und ruft dieselbe Logik.

### Die Spur ist keine Zutat, sondern eine bestehende Pflicht

`admin_activate_member` schreibt in derselben Transaktion nach
`public.admin_audit`. Das ist **keine** Entscheidung dieses Entwurfs, sondern die
Erfüllung von `openspec/specs/admin/spec.md:360` — „Privilegierte Änderungen
hinterlassen eine Spur" verlangt sie für jede Admin-Änderung an einem fremden
Konto, ausdrücklich „mit der Fähigkeit zusammen" und „SHALL NOT nachgereicht".

Das steht hier, weil die erste Fassung dieses Entwurfs sie übersah und dabei
zusätzlich falsch begründete, das Protokoll liege noch in `add-dsgvo-compliance`
und ein zweites sei hier zu vermeiden. `admin_audit` existiert seit
`20260811090300_admin_profile_functions.sql`. Der Plan-Review hat das gefunden,
bevor eine Zeile Code geschrieben war — genau dafür ist er da.

Eine Transaktion, nicht zwei Anweisungen: sonst kann eine Sichtbarkeitsänderung
ohne Spur bestehen, und das ist der Zustand, den die Anforderung ausschliesst.

### Die Verzeichniskarte muss geöffnet werden — die erste Fassung behauptete das Gegenteil

`MemberCard` in `src/components/community/MemberDirectory.tsx:360` ist **nicht
exportiert** und verdrahtet `` to={`/p/${member.id}`} `` fest. „Die Karte wird
wiederverwendet, nicht nachgebaut" und „kein mitgliedersichtbarer Code wird
angefasst" waren zusammen nicht haltbar; eines von beiden musste weichen.

Gewichen ist die zweite Zusage. Ein Nachbau wäre eine dritte Stelle, an der
dieselbe Darstellung gepflegt werden müsste — und die Verzeichnis-Ansicht wäre
dann gerade nicht mehr „was Mitglieder sehen", sondern etwas, das ihm ähnelt.
Die Karte bekommt also ein Ziel als Prop, und ein Regressionstest sichert zu,
dass das Verzeichnis weiter auf `/p/:id` zeigt. Der Eingriff bleibt auf diese
eine Signatur beschränkt.

### Der Zugangslink geht durch die vorhandene Kette

`send-activation` → `issue_activation_token` deckt beide Mitgliedergruppen ab:
`issued` für unbestätigte, `issued_reset` für bestätigte (seit AGE-505). Die
Fläche muss nicht unterscheiden. Neu ist allein, dass ein Admin es für ein
fremdes Konto auslöst.

Daraus folgt eine Vorgabe an die Beschriftung — und sie ist genauer zu fassen,
als die erste Fassung es tat. Dort stand, `send-activation` antworte **immer**
mit 202. Das ist falsch: der Handler liefert 405 bei falscher Methode, 400 bei
kaputtem JSON, 500 bei fehlender Konfiguration und 502, wenn die Tokenausgabe
scheitert. Richtig ist: **auf dem angenommenen Pfad** antwortet er mit 202,
gleichgültig ob es die Adresse gibt — dieser eine Statuscode belegt also keinen
Versand.

Für die Fläche heisst das zweierlei, nicht einerlei: bei 202 die angeforderte
Handlung benennen statt eines Ergebnisses, und bei jeder Nicht-2xx-Antwort einen
Fehler zeigen. Die erste Fassung prüfte nur die Wortwahl bei 202 und hätte einen
Betriebsfehler als Erfolg durchgehen lassen.

### Karten führen in den Admin-Bereich, nicht auf die öffentliche Profilseite

`/p/:id` liest `profiles_public` und verlangt ein bestätigtes **Zielprofil** —
für ein importiertes, unbestätigtes Mitglied meldet es „nicht gefunden"
(`App.tsx:150`, dort schon einmal aufgeschrieben). Die Verzeichnis-Ansicht sieht
aus wie das Verzeichnis, verhält sich aber wie ein Verwaltungswerkzeug; das ist
Absicht und muss es sein, sonst führt sie genau im Anlassfall in eine Sackgasse.

## Risks / Trade-offs

**Die Verzeichnisprojektion existiert zweimal und kann auseinanderlaufen.** Das
ist der Preis dafür, den bestehenden Weg nicht anzufassen — und dieselbe Falle,
die `profiles_public` hier schon gestellt hat, wo vier DEFINER-Funktionen ihr
Prädikat duplizieren. → Ein Test hält die Spaltenlisten von `admin_list_members`
und `search_directory` gegeneinander. Läuft eine weg, wird er rot und benennt die
abweichende Spalte, statt dass die Admin-Ansicht still ein Feld weniger zeigt.

**Direktes Aktivieren macht Daten sichtbar, bevor der Mensch etwas getan hat —
und die Anwendung kennt keinen Weg zurück.** `mark_activated` schreibt
`coalesce(activated_at, now())`, eine Rücksetz-RPC besteht nicht; ein Fehlklick
ist durch die Oberfläche nicht heilbar. → Eine Rückfrage, die das Mitglied
**namentlich** nennt und die Folge benennt, und die Handlung nur an unbestätigten
Zeilen. Die erste Fassung verliess sich auf „optisch getrennt" — das ist keine
Sicherung gegen einen Fehlklick, sondern eine Gestaltungsabsicht. Die Aufklärung
der Betroffenen bleibt eine Kommunikationsaufgabe, die dieser Change nicht löst
und nicht lösen kann.

**Die Liste hebt den Aufzählungsschutz auf, den `admin_find_profile` aufgebaut
hat.** Das ist gewollt, aber es heisst: wer Admin ist, hat die Mitgliederliste. →
`is_admin()` in der Funktion, nicht in der Oberfläche; die Fläche ist Komfort,
die Grenze steht in der Datenbank.

**Die zweite Anforderung an derselben Stelle wie `add-admin-console`.** Bliebe
dort das `REMOVED` auf „Admin member management is not implemented" stehen,
scheiterte die zweite Archivierung an einer Anforderung, die es dann nicht mehr
gibt. → `add-admin-console` gibt die Mitgliederliste in diesem Change ab; das ist
eine Aufgabe hier, kein Zufallsfund später.

## Migration Plan

Eine Migration mit zwei neuen Funktionen, kein Schema-Eingriff, keine
Policy-Änderung. Rechte werden ausgesprochen, nicht geerbt (AGE-312):
`revoke execute … from public, anon` und `grant execute … to authenticated` für
beide Funktionen.

Rücknahme in der Datenbank ist ein `drop function` für beide; dort wurde nichts
Bestehendes verändert. Im Frontend gilt das **nicht** uneingeschränkt: die
Signatur von `MemberCard` ist geöffnet worden. Sie zurückzudrehen heisst, den
Prop wieder zu entfernen — der Regressionstest auf `/p/:id` bleibt dabei die
Kontrolle, dass das Verzeichnis unverändert funktioniert. Die Admin-Fläche selbst
verschwindet mit dem Frontend.

Was **nicht** zurückgedreht werden kann, sind die Aktivierungen, die über die
Fläche vorgenommen wurden: es gibt keinen Rücksetzweg. Das ist eine Eigenschaft
des Bestands, nicht dieses Changes, aber es gehört in einen Rücknahmeplan, der
diesen Namen verdient.

## Open Questions

- **Verhalten bei sehr kurzen Suchbegriffen.** Ein Zeichen ist zulässig, aber die
  Trefferliste wird dann lang. Ob die Fläche das kommentiert oder es dem Paging
  überlässt, ist eine Frage der Oberfläche, nicht der Funktion.

Die Sortierung stand hier und ist jetzt entschieden — siehe oben. Ein
Paging-Verhalten offenzulassen und gleichzeitig Paging zuzusichern, war ein
Widerspruch; der Plan-Review hat ihn benannt.
