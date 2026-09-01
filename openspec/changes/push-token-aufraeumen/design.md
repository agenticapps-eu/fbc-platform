# Design — push-token-aufraeumen (AGE-682)

Der Vorgang sah nach einem `delete` mit einer Bedingung aus. Die Plan-Review hat
gezeigt, dass die Bedingung auf einer Spalte fusst, die nicht misst, was ihr
Kommentar behauptet. Deshalb zwei Hälften — und die Reihenfolge ist keine
Geschmacksfrage.

## Die eine Entscheidung, aus der die anderen folgen

**Ohne echtes Lebenszeichen darf nicht gelöscht werden.**

`letzter_kontakt` wird von `claim_push_token` gesetzt, und das wird nur aus
`src/lib/push.ts:69` gerufen — aus `pushEinrichten()`, das in
`AppShell.tsx:619-632` an `nachrichtenOffen` hängt und dort hinter einem Riegel
steht, der **einmal je Konto** fällt. Die Spalte misst also „wann dieses
Mitglied zuletzt die Nachrichten geöffnet hat". Wer die App täglich nutzt und
nie in den Chat geht, hat einen Wert, der nie wieder steigt.

Eine Frist auf dieses Signal löscht bei **jedem** Wert früher oder später ein
lebendes Gerät — 60 Tage schneller, 270 langsamer, aber sicher. Das ist kein
Abwägen mehr, sondern ein Fehler.

Der Spaltenkommentar sagt „bei jedem Start" (`20260827210000:55-57`). Er ist
falsch, und er ist die Quelle, aus der die erste Fassung dieses Entwurfs die
Annahme übernommen hat, statt den Aufrufer zu messen. Er wird mitkorrigiert.

## Hälfte 1 — das stille Erneuern

Beim Start, auf nativer Fläche, mit angemeldetem Mitglied: ist die Erlaubnis
**bereits erteilt**, wird das Token erneut abgelegt. Sonst geschieht nichts.

Der Unterschied zum bestehenden Weg ist **eine** ausgelassene Zeile:
`requestPermissions()`. Alles andere — Zuhörer anmelden, `register()`, das
`registration`-Ereignis, `claim_push_token` — ist identisch und existiert
bereits (`push.ts:54-86`).

**Warum das die bestehende Anforderung nicht bricht.** Sie lautet: die App SHALL
die Erlaubnis erst anfordern, wenn die Nachrichten geöffnet werden, und SHALL
NOT sie beim Start anfordern (`push-fundament/specs/notifications/spec.md:330-332`,
Szenario „Der Start fragt nicht"). Ihr Grund ist, dass iOS den Systemdialog
**einmal** zeigt und eine Ablehnung endgültig ist. Wo `checkPermissions()`
bereits `granted` meldet, ist nichts mehr zu verbrauchen: kein Dialog, keine
Entscheidung, kein Risiko. Die Anforderung schützt ein Gut, das in diesem Zweig
schon gesichert ist.

**Gestalt:** ein interner `registriere(darfFragen: boolean)`, dazu zwei
benannte Ausgänge — `pushEinrichten()` wie bisher und `pushLebenszeichen()` für
den Start. Zwei Namen statt eines Wahrheitswerts an der Aufrufstelle, weil
`pushEinrichten(false)` an `AppShell.tsx` nichts erklärt.

**Der Aufruf steht in einem eigenen Effekt**, nicht im bestehenden
Nachrichten-Effekt. Der hängt an `nachrichtenOffen` und an einem Riegel je
Konto; beides ist für den Start falsch. Vorbild ist der zweite Effekt gleich
darunter, der den Mitteilungs-Zuhörer **beim Montieren** anmeldet und aus
demselben Grund getrennt steht.

## Hälfte 2 — der Aufräumer

`public.push_tokens_aufraeumen()` löscht aus `push_tokens`, wo
`letzter_kontakt < now() - interval '180 days'`, und gibt die Zahl der Zeilen
zurück.

**Kein Parameter.** Die erste Fassung führte `p_frist` mit der Begründung, der
Test müsste sonst ein halbes Jahr warten. Das war falsch: der Test altert die
**Fixtures** (`now() - interval '181 days'`), nicht die Frist. Ein frei
wählbarer Wert kauft damit nichts und trägt einen Fehlgriff in sich — ein
negatives Intervall löscht jedes Token.

**Die Frist: 180 Tage, für beide Plattformen.** Firebases Beispiel sind 30 Tage
und ein monatliches Erneuern; Androids Selbstverfall liegt bei 270. Wir nehmen
180, weil die Kosten asymmetrisch sind: zu spät gelöscht kostet ein paar
vergebliche Aufrufe, zu früh gelöscht nimmt einem lebenden Mitglied den
Zustellweg. Mit Hälfte 1 heisst „180 Tage ohne Lebenszeichen" auf beiden
Plattformen dasselbe, nämlich dass die App ein halbes Jahr nicht gelaufen ist —
und Android verliert sein Token damit 90 Tage vor FCMs eigener Grenze. Das ist
gewollt und steht so in der Spec, statt sich hinter einem Plattformfilter zu
verstecken, den die Bedingung gar nicht hat.

## Wo der Aufruf steht

**In `push_auftraege_faellig()`, als erste Anweisung.** Das ist die Funktion,
die `send-push` bei jedem `modus: "faellig"` ruft (`send-push/index.ts:149`) —
einmal pro Minute über den bestehenden cron-Lauf.

Der entscheidende Punkt ist, was sie **nicht** ist: keine handangelegte
Funktion. `push_wiederholung()` wäre die naheliegende Stelle gewesen, sie steht
aber nicht in git — sie trägt den `PUSH_WEBHOOK_SECRET` im Rumpf und wird von
Hand auf beiden Instanzen angelegt (`docs/secrets.md`). Logik dort hinein hiesse:
kein pgTAP, ein `db reset` tilgt sie mitsamt dem Aufräumer, und der
Objekt-Drift-Scan aus AGE-679 vergleicht **Namen und Zeitplanungen, keine
Funktionsrümpfe** — eine fehlende Zeile fiele niemandem auf.

`push_auftraege_faellig` liegt in einer Migration (`20260827240000:209`,
ersetzt in `20260828100000:134`), wird von CI angewandt und ist pgTAP-prüfbar.

**Kein neues Objekt heisst: keine Änderung an den Erwartungslisten.**
`inMigrationen` gilt, sobald der Name wörtlich in einer Migrationsdatei
vorkommt (`scripts/db-drift-scan.ts:161-172`) — der Scan parst kein SQL.

## Warum „erste Anweisung", und wie weit die Zusage trägt

`push_zustellungen.token_id` hängt mit `on delete cascade` an `push_tokens`
(`20260827240000:92`). Das Löschen eines Tokens räumt seine Zustellzeilen in
derselben Transaktion mit weg. Steht der Aufruf vorn, verschwinden sie, bevor
sie beansprucht werden.

**Die Zusage gilt für den Fälligkeitslauf, nicht für alles.** Der
Erstvergabeweg `push_auftraege_holen()` bleibt unverändert; er kann ein
abgestandenes Token in derselben Minute beanspruchen, in der der andere Weg es
löscht. Dann kaskadiert das Löschen eine laufende Zustellzeile weg, und die
spätere Quittung trifft null Zeilen — ohne das als Fehler zu erkennen. Die
Wirkung ist eine nicht zugestellte Benachrichtigung an ein Gerät, das seit einem
halben Jahr nicht gelaufen ist. Das ist der Fall, den dieser Vorgang bewusst
herbeiführt, nur auf einem unschönen Weg. **Benannt statt behauptet**, und die
Spec-Zusage sagt deshalb „im selben Fälligkeitslauf".

## Rechte

`security definer`, `set search_path = ''`, Ausführungsrecht **ausgesprochen**
entzogen für `public`, `anon`, `authenticated` und `service_role`. Default
Privileges wirken auf Funktionen nicht; und `service_role` wird ausdrücklich
genannt, weil dieses Projekt rollen-eigene Default-Grants führt — ein Entzug
nur von `public` liesse eine destruktive Funktion per RPC erreichbar. Der
verschachtelte Aufruf aus `push_auftraege_faellig` läuft weiterhin unter dem
Eigentümer der `security definer`-Funktion.

## Was der Aufräumer NICHT tut

- **Keine Hinweise löschen.** `notifications` bleibt unangetastet.
- **Kein Protokoll, keine Meldung.** Die Funktion gibt die Löschzahl zurück,
  `perform` verwirft sie. Ein Verweis auf den Wächter aus AGE-679 wäre falsch:
  der fragt `push_tokens` gar nicht ab, und die Kaskade vernichtet gerade die
  `push_zustellungen`-Zeilen, auf die er sieht. **Die fehlende Beobachtbarkeit
  ist damit ein benanntes Restrisiko**, kein gelöstes Problem — siehe unten.
- **Kein `letzter_kontakt`-Schreiben.** Das bleibt bei `claim_push_token`.

## Eine Zusage, die wir NICHT geben

„`letzter_kontakt` wird nicht vom Client geschrieben" stand im ersten Entwurf
und im Spaltenkommentar. Durchgesetzt ist das nicht: `authenticated` hat
`insert, update` auf `push_tokens` (`20260827210000:68`), und die owner-only
Policy erlaubt jedem, die **eigene** Zeile zu schreiben, auch mit einem
Zeitstempel in der Zukunft.

Die Wirkung ist begrenzt — wer das tut, hält allein sein eigenes Token am Leben
und erreicht damit niemanden ausser sich selbst. Die Rechte deshalb zu
beschneiden, wäre eine Änderung an der Schreibfläche der App für einen Angriff,
der dem Angreifer nichts einbringt. **Die Behauptung fällt, die Rechte
bleiben.**

## Die Abnahme muss eine Positivkontrolle tragen

Vor AGE-642 existiert kein echtes Gerätetoken. Ein Aufräumer, der nichts findet,
und einer, der alles löscht, sehen ohne Gegenprobe identisch aus.

Der pgTAP-Lauf legt deshalb **drei** Zeilen an: eine deutlich über der Frist,
die verschwinden muss; eine deutlich darunter, die bleiben muss; und eine
**einen Tag** unter der Frist, die den Grenzfall festnagelt. Das Lebenszeichen
der bleibenden Zeile entsteht über `claim_push_token`, nicht über ein direktes
`update` — sonst prüft der Test seine eigene Fixture statt des Weges.

## Verworfene Alternativen

| Verworfen | Warum |
|---|---|
| Aufräumer ohne Hälfte 1 | Löscht bei jeder Frist irgendwann ein lebendes Gerät. Das ist der Befund der Plan-Review, nicht eine Vorsichtsmassnahme. |
| Erlaubnis beim Start anfordern | Bricht die bestehende Anforderung und verbrennt den iOS-Dialog. Wir fragen nicht — wir erneuern nur, was schon erteilt ist. |
| Eigene tägliche `cron.schedule` | Fünftes handangelegtes Objekt, zwei Einträge in die Drift-Erwartungslisten, und ein weiteres Ding, das ein `db reset` still tilgt. |
| Aufruf in `push_wiederholung()` | Steht nicht in git, nicht pgTAP-prüfbar, und der Drift-Scan liest keine Funktionsrümpfe. |
| Zustellerfolg als Lebenszeichen | Zeigt im Fehlerfall Leben an — genau der Befund, der den Vorgang ausgelöst hat. |
| `p_frist` als Parameter | Kauft nichts (der Test altert die Fixtures) und trägt einen Fehlgriff: ein negatives Intervall löscht alles. |
| Plattformspezifische Fristen | Mit Hälfte 1 misst die Frist auf beiden Plattformen dasselbe. Zwei Zahlen, wo eine genügt. |
| Schreibrechte auf `push_tokens` beschneiden | Der Angriff bringt dem Angreifer nichts ein. Statt Rechte zu ändern, fällt die falsche Zusage. |

## Was offen bleibt

- **Der Wert 180 ist begründet, nicht gemessen.** Messbar erst, wenn echte
  Geräte über Monate Daten liefern (ab AGE-642). Die Begründung steht im
  Migrationskopf, wo sie beim nächsten Anfassen gelesen wird.
- **Niemand sieht, wie oft der Aufräumer zuschlägt.** Bewusst nicht in diesem
  Vorgang gelöst, und ausdrücklich **nicht** durch AGE-679 abgedeckt. Ein
  falsch eingeordnetes Token verschwände heute still.
- **Zwei Indizes, die heute keine wären.** Es gibt keinen Index auf
  `push_tokens.letzter_kontakt`, und der Primärschlüssel von
  `push_zustellungen` beginnt mit `notification_id`, sodass die Kaskade über
  `token_id` scannt. Beides von der Review benannt und sachlich richtig — bei
  **1 Zeile auf PROD und 2 auf DEV** wäre ein Index Ballast, den ein Leser für
  eine gemessene Notwendigkeit hielte. Zu messen, sobald `push_tokens` vierstellig
  wird oder `push_zustellungen` fünfstellig.
