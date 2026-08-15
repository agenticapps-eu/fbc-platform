## Context

Die Quelle ist ein CSV-Export aus WordPress mit dem Plugin *Ultimate Member*,
gezogen am 13.08.2026: **140 Spalten, 70 Datensätze**. Er liegt außerhalb des
Arbeitsbaums unter `~/Documents/Claude/Projects/Fair Business Club/` und trägt
Klarnamen, Anschriften, Telefonnummern und `user_pass`-Hashes. Das Repository
ist öffentlich.

Am 14.08.2026 gegen die echte Datei nachgemessen — die Zahlen im Issue stimmen
in **26 von 26** Feldzählungen. Die Abbildung ist damit belastbar. Vier
Aussagen des Issues stimmen jedoch nicht, und dieses Design ersetzt sie:

| Issue | Gemessen |
|---|---|
| Parser für Datum, Ort, PHP-Array, Telefon „liegen vor" | ~~`parser.py` enthält nur `php_array` und `ort_parsen`~~ — **diese Zeile war falsch**, siehe unten |
| „Datum: 52 von 52 über elf Schreibweisen" | 11 Rohformen, **9 normalisiert**; **16 der 52 ohne Tag**, 6 ohne Monat |
| Bildendungen „`.jpg` und `.png`, beide probieren" | **Drei**: `jpg`, `png`, `jpeg` — je 7 Datensätze hingen an der fehlenden dritten |
| Ex-Mitglieder „über UM-Status erkennbar? — prüfen" | **Nein.** 70× `approved`. Detlevs Liste ist zwingend |

**Nachtrag vom 14.08., beim Übertragen der Parser aufgefallen und hier
korrigiert:** Der Vorlauf hat `parser.py` gelesen (13.08., 15:17) und daraus
geschlossen, Datum und Telefon seien noch zu schreiben. Im selben Verzeichnis
liegt `wp_feld_parser.py` (15:51) — 34 Minuten jünger, mit **allen vier**
Parsern plus `text_saeubern` und einer `headline`-Ableitung. Die Korrektur der
Ausgangslage korrigiert nicht die Arbeit: die Übertragung war ohnehin zu leisten,
und drei Stellen tragen die Python-Semantik nicht (`\b` vor Umlauten, die
Zeitzone eines `Date`, der Rückfall vom Wohnort auf die Regionalgruppe). Die
`headline`-Ableitung aus `infos` ist bewusst **nicht** übernommen — die
Abbildungsmatrix führt `beruf` → `headline`, und eine falsche Headline steht
unter dem Namen im Verzeichnis.

Drei Fehlerfälle aus Abschnitt 4 des Issues laufen ins Leere: keine doppelte
E-Mail, keine leere, keine syntaktisch ungültige. Sie werden trotzdem geprüft —
die Quelle kann bis zum Go-Live neu gezogen werden.

Der Zielzustand ist vorbereitet: `profile_legacy` mit eindeutigem Index über
`nullif(btrim(legacy_source_id),'')`, die Adressfelder aus AGE-537, `member_since`
als `date`. Keine Migration nötig.

> Dieses Dokument ist nach dem Plan-Review vom 14.08. überarbeitet. Was sich
> geändert hat und warum, steht in `REVIEWS.md`. Eine Entscheidung wurde
> **gekippt** (der Wächter), eine Aussage war **falsch** (`legacy_tier`), und ein
> Schreibziel **fehlte** (`profile_contacts`).

## Goals / Non-Goals

**Goals**

- Ein Trockenlauf, der ohne Schreibwirkung vollständig aussagt, was passieren würde
- Wiederholbarkeit über `legacy_source_id` **und** Adresse, mit festgelegten Merge-Regeln
- Die vier Parser, ohne Datenbank testbar
- Ein Bericht, der die Datenlieferung von Detlev einfordert, statt auf sie zu warten
- Belegte Wiederholbarkeit: zweimal schreibend gegen den **lokalen** Stack

**Non-Goals**

- Der echte Lauf gegen PROD. Das ist eine Handlung am Go-Live-Tag
- **Jeder Mailversand.** Siehe die Entscheidung unten — der Import verschickt nichts
- Rundmail-Text (AGE-513), Odoo (AGE-263), Stufen unterhalb `impact`
- `WhatsApp` und Xing (`Homepage_18_21`) — am 13.08. verworfen
- Eine Oberfläche für den Import. Er läuft einmal, von der Kommandozeile

## Decisions

### Die Passwort-Hashes werden nicht angefasst

`user_pass` steht in Spalte 3 der Quelle. Der Import SHALL sie **weder lesen noch
schreiben noch protokollieren**; die Spalte steht nicht in der Feldtabelle und
wird damit vom „nur benannte Spalten"-Grundsatz mit erfasst.

Importierte Konten entstehen **ohne Passwort**. Der Zugang läuft über den
Aktivierungsweg, und das ist der Grund, warum der ursprüngliche Plan mit einem
geteilten Passwort in einer Rundmail verworfen wurde (AGE-534 §0).

*Aufgenommen nach dem Review (gemini, HIGH).* Es stand vorher nur implizit in
einer Aufgabe.

### Der Import verschickt keine Mail

Der Ablauf ist bewusst umgekehrt (AGE-534 §0): Detlevs Rundmail enthält **keinen
Link**. Das Mitglied geht auf die Seite, gibt seine Adresse ein und löst den
Versand selbst aus (`issue_activation_token`).

Ein Versand aus dem Import heraus wäre schädlich, nicht nur überflüssig: Er
verschickte 70 Links, bevor die Rundmail draußen ist, und der nächste Lauf
entwertete sie wieder — `access-control` legt fest, dass ein neuer Versand das
ausstehende Token entwertet. Ein Mitglied hielte dann eine echte Mail mit einem
toten Link in der Hand.

*Der Review (codex, HIGH) las hier eine Aussperrung. Widersprochen — der
Selbstauslöseweg ist der Zugang. Übernommen ist, dass es dastehen muss.*

### Der Wächter prüft die Projektkennung, nicht den Host

**Gekippt gegenüber der ersten Fassung.** Nachgemessen: `demo_seed.lib.ts:10`
verbindet über `aws-1-eu-central-1.pooler.supabase.com` — regionsweit, für jedes
Projekt derselbe Host. Die Projektkennung steckt im **Benutzernamen**
(`postgres.<project-ref>`, Zeile 56). Ein Host-Vergleich wäre gegen das falsche
Projekt grün gewesen.

Geprüft wird deshalb die Kennung aus dem Benutzernamen gegen eine feste
Allowlist. Der lokale Stack trägt keine Kennung und wird an seiner Adresse
erkannt; die Rolle heißt dort ebenfalls `postgres`, taugt also nicht zur
Unterscheidung.

Zusätzlich verlangt der Schreibmodus die **ausdrückliche Nennung des Ziels**.
Ein Schalter, der nur „schreiben" sagt, ist gegen das falsche Ziel genauso
willig wie gegen das richtige.

### Anmeldekonto zuerst, dann eine Transaktion

Das Konto entsteht über die **Admin-Schnittstelle** des Anmeldedienstes, nicht
durch direkten Schreibzugriff auf `auth.users`: dort hängen Identity-Zeilen und
interne Invarianten daran, die eine GoTrue-Version ändern darf und ein
SQL-Insert stillschweigend verletzt.

Danach laufen `profiles`, `profile_contacts` und `profile_legacy` in **einer**
Transaktion. Die Kennung wird dabei mit dem Profil geschrieben — der Kopf von
`20260811090100_profile_legacy.sql` verlangt genau das.

**Folge, die daraus zwingend entsteht:** Konto und Transaktion sind nicht
gemeinsam atomar. Bricht der Lauf dazwischen ab, bleibt ein Konto ohne Kennung
zurück. Die Wiedererkennung braucht deshalb **zwei** Schlüssel: `legacy_source_id`
und, wo diese fehlt, die normalisierte Adresse.

*Aufgenommen nach dem Review (codex, HIGH). Der Mechanismus war unbestimmt.*

### Der Stufen-Riegel sitzt am Aufrufer, nicht in der Form der Anweisung

**Gekippt gegenüber der ersten Fassung (Donald, 15.08.).** Sie setzte `tier` und
`activated_at` als reine **Einfügespalten**: im `insert`, nicht im
`do update set`, damit kein bestehendes Konto auf `impact` gehoben wird.

Nachgemessen gegen den lokalen Stack: das greift nie.
`on_auth_user_created` (`20260611115655_community_foundation.sql:82`) legt bei
JEDEM Insert in `auth.users` schon eine Profilzeile an — auch auf dem Admin-Weg,
mit `tier = 'basic'`. Das Upsert des Imports trifft deshalb **immer** eine
bestehende Zeile, und eine reine Einfügespalte kommt nie an. Jedes importierte
Konto wäre `basic` geblieben; acht Tests waren grün, weil sie den SQL-Text
prüften statt der Datenbank.

Geschrieben wird die Stufe seither, **wenn und nur wenn dieser Lauf das
Anmeldekonto selbst angelegt hat**. Bei einem bestehenden Konto taucht sie in
keiner Anweisung auf. Was der alte Riegel abwehren sollte — eine
Selbstregistrierung unter einer bekannten Mitgliedsadresse erbt `impact` — fängt
zusätzlich die Vorabprüfung 4.2 ab, die den ganzen Schreiblauf blockiert.

*Verworfen:* ein `case`-Ausdruck im `do update set`, der nur `basic` ohne
Freischaltung hebt. Er läge in genau dem Fall falsch, den 7.3 meint.

**Zweite Korrektur, nach dem Code-Review (15.08.).** Die Fassung oben steuerte
die Stufe über einen Merker `neuAngelegt` im Auftrag. Beide Reviewer fanden
daran unabhängig dasselbe: die Invariante hing damit an der Sorgfalt eines
Aufrufers, den es noch nicht gibt. Ein pauschales `true` in der Schleife von 7.2
hätte jedes wiedererkannte Bestandskonto auf `impact` gehoben **und eine
gesetzte Freischaltung auf `null` zurückgesetzt** — Letzteres war vorher
unmöglich.

Schwerer wog der zweite Befund: eine **abgebrochene** Transaktion hinterliess
ein Konto mit `tier = 'basic'` (dem Trigger-Wert). `baueBestandsdaten` erkennt
einen eigenen Rest aber an `impact` ohne Freischaltung — der Rest wäre also als
**Kollision** gewertet worden und hätte über `pruefeVorab` **jeden weiteren
Schreiblauf blockiert**, bis jemand das Konto von Hand löscht. Genau das, was
7.5 ausschliessen soll.

Beides fällt weg, wenn die Stufe dorthin gehört, wo das Konto entsteht: in eine
**eigene Anweisung direkt hinter dem Anlegen und vor der Transaktion**
(`stufeFuerNeuesKonto`). Dann steht die Handschrift des Imports schon da, bevor
irgendetwas scheitern kann. Der Riegel ist seither der **Typ** — das Argument
ist der `angelegt`-Zweig von `Kontoergebnis`, ein bestehendes Konto lässt sich
gar nicht einsetzen — plus `activated_at is null` in der Anweisung selbst.
`tier` und `activated_at` sind zusätzlich von der Spaltenliste genommen: ein
Auftrag, der sie trüge, wirft.

### `email_confirm: true`, obwohl das Konto unaktiviert bleibt

Zwei verschiedene Tore, und nur eines ist hier ein Gate.

Das Gate ist `profiles.activated_at` (AGE-495): es steht auf `null` und bleibt
es. Der Weg hinein führt über den Link aus dem **eigenen** Postfach —
`send-activation` verschickt ihn, `redeem-activation` nimmt Token *und* neues
Passwort entgegen und stempelt erst dann `activated_at`.

`auth.users.email_confirmed_at` ist dagegen GoTrues eigenes Flag und auf dieser
Plattform kein Gate (`config.toml`: `enable_confirmations = false`). Es nicht zu
setzen, überspringt nichts — es sperrt aus. Gemessen am 15.08., mit genau dem
Aufruf aus `redeem-activation:114`:

```
email_confirm:false → Passwort setzen 200, Anmeldung 400 email_not_confirmed
email_confirm:true  → Passwort setzen 200, Anmeldung 200
```

Ohne das Flag klickt ein Mitglied seinen Aktivierungslink, setzt sein Passwort
und kommt trotzdem nicht hinein — sichtbar erst nach dem Go-Live, bei allen 70
zugleich.

*Aufgenommen auf Donalds Nachfrage am 15.08., ob der Import nicht unaktiviert
lassen und über Bestätigung plus Passwort-Setzen laufen sollte. Genau das tut er;
die Nachfrage hat die Begründung im Code von einer Annahme zu einer Messung
gemacht.*

### Der Bericht entsteht ZWEIMAL, aus derselben reinen Funktion (15.08.)

Ein schreibender Lauf muss berichten, was wirklich geschah — ein Datensatz, den
die Datenbank zurückwies, darf nicht als „angelegt" in der Summe stehen. Die
Klassifikation entsteht aber **vor** dem Schreiben; sie ist die Grundlage dafür,
überhaupt zu wissen, was zu schreiben ist.

Gewählt: `baueLauf` bleibt **rein und synchron** und bekommt einen optionalen
Parameter `ausgaenge` — eine Abbildung Datensatznummer → Fehlergrund. Der Lauf
ruft es zweimal auf: einmal, um zu erfahren, was zu tun ist, und nach dem
schreibenden Abschnitt noch einmal mit dem, was dabei fehlschlug.

Zwei Alternativen sind gefallen:

- **`main()` setzt sich `verarbeite` und `baueBericht` selbst zusammen.** Dann
  nähme der schreibende Lauf einen anderen Weg als der Trockenlauf — genau das,
  was Aufgabe 5.2 verbietet und wogegen die Verdrahtungstests stehen.
- **Die Wirkung als Rückruf in `baueLauf` hereinreichen** (und es `async`
  machen). Verlockend, weil der Bestand schon so hereinkommt — aber es machte
  eine Funktion wirkend, deren Kopf „schreibt keine, spricht mit keiner
  Datenbank" verspricht, und hinge zehn bestehende Tests um.

Der doppelte Aufruf kostet 70 Datensätze reiner Rechnung. Dafür ist „der Bericht
beschreibt denselben Lauf" strukturell wahr statt zugesichert.

### Der Fehlergrund trägt keinen Wert aus der Quelle (15.08.)

Aufgabe 7.5 verlangt, dass ein fehlerhafter Datensatz den Lauf nicht beendet —
also landet sein Grund im Bericht. Der naheliegende Grund ist `error.message`,
und genau der ist hier eine **Preisgabe**: Postgres zitiert bei einer verletzten
Eindeutigkeit den Wert wörtlich (`Key (email)=(…) already exists`). Der Bericht
liegt zwar ausserhalb des Arbeitsbaums und mit `0600` (1.2), die Konsole aber
nicht — und 4.7 hält beide Wege frei von Personendaten.

Deshalb wird der Grund aus `code`, `constraint` und `table` gebaut, nie aus
`message` oder `detail`. Bezeichner stammen aus dem Schema, Werte aus der Quelle;
nur die erste Sorte darf in die Ausgabe. `legeKontoAn` hält es schon so.

### Basis-URL und Schlüssel hängen an der geprüften Kennung (15.08.)

Der Review zu 7.1 fand die Asymmetrie: `pruefeZiel` (1.4) hält die
**Datenbank**-Verbindung gegen das genannte Ziel, die GoTrue-Basis ging als
freier Parameter herein. `SUPABASE_DB_URL_DEV` neben einem PROD-Schlüssel hiesse
70 Konten in PROD und die Profile nach DEV — und das Anlegen ist der
unwiderrufliche Teil.

Behoben, indem die Basis nicht mehr gewählt, sondern **abgeleitet** wird:
`pruefeZiel` gibt die Kennung zurück, die es gerade geprüft hat, und die Basis
ist `https://<ref>.supabase.co` (lokal: der Stack). Ein Schlüssel des falschen
Projekts kann damit nichts mehr anrichten — er trifft die richtige Adresse und
wird dort abgewiesen, statt im falschen Projekt zu wirken.

### Vorabprüfung der ganzen Datei vor dem ersten Schreibvorgang

Der geforderte Abbruch bei einer Dublette „ohne jeden Schreibvorgang" ist mit
Transaktionen je Datensatz **nicht** zu halten — eine spät erkannte Dublette
fände frühere Datensätze bereits geschrieben.

Der Lauf zerfällt deshalb in zwei Abschnitte: erst eine Vorabprüfung über die
**ganze** Datei (Kopfzeile, Dubletten, Adressgültigkeit, Kollision mit
Bestandskonten), die nichts schreibt; erst danach der schreibende Abschnitt.
Ein Vorab-Abbruch erzeugt einen eigenen Berichtstyp, in dem keine
Datensatzklassen vorkommen — die Klassensumme gilt nur für Läufe, die den
schreibenden Abschnitt erreichen.

*Aufgenommen nach dem Review (codex, HIGH ×2, MEDIUM).*

### Die fehlenden Lieferungen blockieren nichts (entschieden 14.08., Donald)

Ein Zwischenstand dieses Designs verlangte, dass der **schreibende** Lauf ohne
Detlevs Ausgetretenen-Liste verweigert — auf einen HIGH-Befund von `codex` hin.
**Zurückgenommen.**

Begründung von Donald: die Liste kommt, und die erste Zielumgebung ist ohnehin
DEV, nicht die Live-Umgebung. Ein zu viel importiertes Ex-Mitglied lässt sich dort
folgenlos entfernen. Ein Riegel kostete mehr, als er schützt — er hielte die
Arbeit an einer Lieferung auf, die unterwegs ist.

Der Bericht bleibt die Gegenmaßnahme: er führt die betroffenen Mitglieder
einzeln, damit sie sich nach der Lieferung gezielt abarbeiten lassen.

*Der Befund war richtig für einen Lauf gegen PROD. Die Antwort darauf ist der
Go-Live-Ablauf (AGE-534 §5, Trockenlauf mit Durchsprache vor dem echten Lauf),
nicht ein Riegel im Script.*

### Kollision mit Bestandskonten blockiert, statt zu erheben

PROD trägt bereits Konten ohne `legacy_source_id`: zwei Testkonten (AGE-522),
Detlevs Zweitkonto, dazu jede Selbstregistrierung. Trifft die Vorabprüfung eine
Adresse, die dort schon existiert, SHALL sie den Schreibmodus blockieren und den
Fall auflisten.

Ein bestehendes Konto SHALL NOT automatisch auf `impact` gehoben werden. Sonst
reichte eine Selbstregistrierung unter einer bekannten Mitgliedsadresse, um die
höchste Stufe geschenkt zu bekommen — und `basic` für Selbstregistrierer ist
genau die Hürde, die das verhindern soll.

### Merge-Regel: nur leere Felder füllen (entschieden 14.08., Donald)

Ein zweiter Lauf schreibt ein Profilfeld nur, wenn das Ziel leer ist. Was ein
Mitglied selbst eingetragen **oder gelöscht** hat, bleibt.

Ausgenommen sind die Verwaltungsfelder `paid_until`, `legacy_tier`,
`legacy_price` und `member_since`: sie gehören der Verwaltung, nicht dem
Mitglied, und werden immer aktualisiert. `activated_at` und die Anmeldeadresse
werden **nie** vom Import angefasst.

*Verworfen:* „WordPress gewinnt immer" — einfach, macht aber jeden Lauf nach dem
Go-Live zu einem stillen Datenverlust. *Verworfen:* ein Schalter, der die Regel
am Go-Live-Tag umstellt — eine weitere Sache, die falsch stehen kann.

#### Nachtrag 14.08.: die zwei Sätze widersprechen sich, unterschieden wird am Profil

Beim Bauen von 3.7 fiel auf, dass die beiden Sätze oben nicht zusammen gelten
können. Ein **gelöschtes Feld ist leer** — nach „nur wenn das Ziel leer ist"
füllte der nächste Lauf es wieder, und keine Löschung hielte länger als bis zum
nächsten Import.

Ein einzelnes leeres Feld trägt kein Merkmal, das „nie befüllt" von „geleert"
trennt. Das Profil trägt eines: ob dieser Import dort schon geschrieben hat
(`profile_legacy.legacy_source_id`). Danach entschieden:

- **Profil noch nicht importiert** (neu, oder ein Bestandskonto, das über die
  Adresse zugeordnet wurde) → leere Felder werden gefüllt. Die Lücken stammen
  nicht von uns, und Ergänzen ist der Zweck des Laufs.
- **Profil bereits importiert** → die Mitgliedsfelder bleiben unangetastet. Was
  dort leer ist, war entweder in der Quelle leer — dann ist nichts zu tun — oder
  es ist geleert worden, dann ist es eine Entscheidung.

Der Preis, mit Ansage: bringt ein neu gezogener Export einen Wert für ein Feld,
das beim ersten Lauf leer war, wird er nicht mehr geschrieben. Er steht deshalb
in `uebersprungen` und damit im Bericht — von Hand nachtragbar, statt still
gegen eine Löschung entschieden.

**Zwei Verschärfungen dazu.** „Immer aktualisiert" gilt für die
Verwaltungsfelder nur, wo die **Quelle einen Wert führt**: 66 der 70 Datensätze
haben keine `Mitgliedschaft`, und ein `null` darüber räumte weg, was von Hand
nachgetragen wurde. Und `socials` wird **pro Schlüssel** zusammengeführt, nicht
als Feld — die Quelle kennt fünf Netzwerke, das Formular sechs, ein Mitglied mit
eigenem Xing-Eintrag verlöre sonst entweder das Xing oder die anderen fünf.
`videos` dagegen als Feld: Anhängen legte bei jedem Lauf dasselbe Video ein
zweites Mal ab.

*`paid_until` und `legacy_price` kommen in der Zusammenführung überhaupt nicht
vor.* Die Quelle führt sie nicht, und auf `paid_until` heißt `null`
ausdrücklich „unbekannt" — ein Lauf, der sie mitschriebe, nähme den
Bestandsschutz weg.

### `member_since`: auffüllen und ausweisen (entschieden 14.08., Donald)

Fehlender Tag → 1. des Monats, fehlender Monat → 1. Januar; jeder aufgefüllte
Datensatz erscheint mit **Rohangabe** im Bericht.

*Korrektur nach dem Review (codex, MEDIUM):* Die erste Fassung behauptete, die
Rohangabe bleibe „über `legacy_tier` nachvollziehbar". Das ist falsch —
`legacy_tier` trägt die alte Mitgliedsstufe. Der Bericht ist der einzige Ort, an
dem die Rohangabe erhalten bleibt, und deshalb aufzubewahren.

*Verworfen:* nur vollständige Daten übernehmen — verlöre ein Drittel, darunter
gerade die 19 Altmitglieder, wegen derer `infos_16` dem Registrierungsdatum
überhaupt vorgezogen wird. *Verworfen:* eine Spalte `member_since_precision` —
kostete Migration, Grant und Golden-Snapshot für eine Anzeigefeinheit.

### Personendaten: Quelle draußen, Bericht draußen, `stdout` sauber

Der Pfad zur Quelle kommt als Argument; ein Pfad **innerhalb** des Arbeitsbaums
wird abgelehnt, nicht nur ignoriert. Der Bericht wird neben der Quelle abgelegt,
mit Rechten `0600`.

`stdout` führt ausschließlich Zeilennummer und `legacy_source_id`. Namen,
Adressen und Telefonnummern erscheinen **nur** im Bericht — sonst landen sie in
Shell-History und CI-Logs.

*Verschärft nach dem Review (gemini LOW, codex MEDIUM).* Die erste Fassung
verließ sich darauf, dass der Bericht ignoriert wird; „ignoriert" ist aber nicht
„abwesend", und `git status` belegt keine Dateirechte.

### Bildstrecke: eigener Abschnitt, mit Zwischenablage

Die Bilder werden in einem **eigenen, für sich wiederholbaren** Abschnitt geholt
und in einem Verzeichnis außerhalb des Repositoriums zwischengelagert; der
Import liest bevorzugt von dort.

Zwei Gründe, beide aus dem Review: Netzwerkarbeit gegen einen fremden Server
darf einen Datenimport nicht in einen Halb-Zustand bringen (gemini). Und die
Zwischenablage ist die einzige Gegenmaßnahme, die wirkt, wenn die alte Seite
abgeschaltet wird — ein früher Trockenlauf persistiert nichts (codex).

`profile_photo` trägt den nackten Dateinamen (`profile_photo.jpeg`), der Pfad
entsteht aus `source_user_id`. Am 14.08. mit HEAD-Anfragen belegt: der
Uploads-Ordner ist offen lesbar (200, `image/jpeg`), kein Zugang nötig.

**Nachtrag 15.08.: es sind ZWEI Bilder, nicht eines.** Diese Fassung sprach nur
vom Profilbild. Die Quelle führt daneben `cover_photo` — das Headerbild der
Profilansicht —, und zwar bei **53 von 70** Mitgliedern (`profile_photo`: 57).
Beide Spalten sind gleich gebaut: drei verschiedene Werte über die ganze Datei,
Länge 15–18 Zeichen, kein Pfad und kein `http` darin. Der Wert trägt also nur die
Endung, alles andere entsteht aus `source_user_id`.

Aufgefallen ist es an Donalds Frage, was mit den Mediendateien geschieht — die
Annahme dahinter war, sie stünden gar nicht in der CSV. Sie stehen darin; was
fehlte, war das zweite Bild im Plan. **Entschieden (Donald, 15.08.): beide
werden geholt** — das Profilbild nach `avatars`/`profiles.avatar_url`, das
Headerbild nach `covers`/`profiles.cover_url`. Beide Buckets sind öffentlich;
`covers` lässt ausschliesslich `image/webp` zu, was die Wandlung aus 6.3 ohnehin
verlangt. Die Kosten sind ein zweiter Durchgang je Mitglied, das Risiko ist
dasselbe — und nach dem Abschalten der alten Seite wäre es nicht nachholbar.

**`synced_gravatar_hashed_id` (68/70) bleibt draussen.** Das ist ein
Gravatar-Hash, kein Bild auf dem alten Server. Avatare von einem Drittanbieter
nachzuladen, wäre eine Datenweitergabe, die kein Mitglied veranlasst hat.

Die Datei **ohne** Größensuffix ist das Original; die Ableitung `-190x190`
verschenkt 96 % der Bildinformation. Die Endung steht im Datensatz — sie zu raten
war die Empfehlung des Issues und hätte bei `jpeg` 14 Bilder gekostet.

**Korrektur 15.08., an den 110 geholten Dateien gemessen: „das Original" ist
NICHT 1000 px.** Diese Fassung stand hier als feste Zahl und stimmt für keine der
beiden Bildarten:

| | kleinste | häufigste | größte |
|---|---|---|---|
| Profilbild (57) | **1 px** | 1000 px (24×) | 1000 px |
| Headerbild (53) | 762 px | 1000 px (42×) | **4032 px** |

Daraus folgt für 6.3 zweierlei. **Es wird nur verkleinert, nie vergrößert** — ein
Profilbild mit 195 px auf 512 px hochzurechnen, erfände Bildinformation, die es
nicht gibt. Und die Headerbilder sind die schweren: 4032 px ist ein Handyfoto,
der `covers`-Bucket lässt 2 MB zu. Nach WebP liegt beides darunter (die größte
geholte Datei ist heute < 2 MB), aber die Verkleinerung ist deshalb nicht
optional.

**Ein Profilbild ist 1 × 1 Pixel.** Das ist kein Bild, das ist ein Rest. Es
gehört in den Bericht und nicht in den Bucket — sonst trägt ein Mitglied einen
Avatar, der wie ein Ladefehler aussieht, und niemand weiß warum.

**Zum Ablegen:** der `avatars`-Bucket ist **öffentlich**
(`20260613081627_profile_editor_storage.sql:17`), nicht privat. Meine
`upsert: false`-Begründung aus der ersten Fassung trug hier nicht. Die Semantik
ist stattdessen ausdrücklich: vorhandenes Objekt wird übersprungen, nicht ersetzt,
und der Bericht sagt welches — damit der zweite Lauf nicht an sich selbst scheitert.

### Nur benannte Spalten werden gelesen

Von 140 Spalten sind 26 lebendig. Der Rest ist Plugin-Zustand (`aioseo_*`,
`wp_*`, `session_tokens`) und Reste gelöschter Formularfelder
(`Homepage_16_19` …). Eine unbekannte Spalte wird ignoriert, eine erwartete
fehlende bricht ab. Ein Import über `Object.entries(row)` zöge tote Daten mit —
und `user_pass` gleich mit.

### Die Abbildungsmatrix

*Aufgenommen nach dem Review (codex, HIGH): sie stand nur im Linear-Issue.*
Befüllung am 14.08. gegen die echte Datei gemessen.

| Quelle | Befüllt | Ziel | Umformung |
|---|---|---|---|
| `first_name` + `last_name` | 70/70 | `profiles.name` | zusammensetzen |
| `beruf` | 17/70 | `profiles.headline` | — |
| `infos` | 45/70 | `profiles.short_bio` | HTML entfernen |
| `infos_15` | 24/70 | `profiles.short_bio` | anhängen, HTML entfernen |
| `infos_28` | 38/70 | `profile_interests` (`label`, `theme` = `null`) | HTML entfernen, **an Komma und Umbruch zerlegen** (s. Nachtrag 15.08.) |
| `biete` | 47/70 | `offers` (`description`, `title` abgeleitet) | Fließtext |
| `suche` | 46/70 | `needs` (`description`, `title` abgeleitet) | Fließtext |
| `Strasse` | 38/70 | `profile_contacts.street` | — |
| `ort` | 50/70 | `profile_contacts.postal_code` + `.city` | `ortParsen`, **ein Feld → zwei** |
| `ort_27` | 34/70 | `profile_contacts.state` | — |
| `ort_27_28` | 31/70 | `profiles.region` | Regionalgruppe, **nicht** der Wohnort |
| — | — | `profile_contacts.country` | aus `ortParsen`, Vorgabe `DE` |
| `infos_16` | 52/70 | `profiles.member_since` | `datumParsen` + Auffüllung |
| `praesi_kurz`, `praesei_lang` | je 5/70 | `profiles.videos` **oder** `.short_bio` | pro Wert: parsebare URL → Video, sonst Text |
| `linkedin`, `facebook`, `instagram`, `youtube`, `twitter` | 24/19/16/6/4 | `profiles.socials` | zusammenführen; **drei davon brauchen erst ein Formularfeld** |
| `Homepage` | 38/70 | `profiles.website` | — |
| `E-Mail` | 52/70 | `profile_contacts.email` | Kontaktadresse, **nicht** die Anmeldeadresse |
| `Telefonnummer` | 52/70 | `profile_contacts.phone` | `telefonParsen` |
| `user_email` | 70/70 | Anmeldeadresse | Schlüssel; trimmen + case-folden |
| `source_user_id` | 70/70 | `profile_legacy.legacy_source_id` | Schlüssel der Wiedererkennung |
| `Mitgliedschaft` | 4/70 | `profile_legacy.legacy_tier` | **roh**, nicht normalisiert |
| *(Detlevs Liste)* | — | `profile_legacy.paid_until` | extern |
| `WhatsApp`, `Homepage_18_21` | 49/7 | ❌ | verworfen 13.08. |
| `user_pass` | 70/70 | ❌ | **nie gelesen** |
| `Homepage_16…_26`, `aioseo_*`, `wp_*` | — | ❌ | tote Spalten |

`branche` wird aus `infos` per Stichwortzuordnung abgeleitet (AGE-537); grob
gefüllt ist besser als leer, jedes Mitglied kann es ändern.

#### Nachtrag 14.08.: sieben Ziele stimmten nicht

Die Matrix oben stand vor dem ersten Blick ins Zielschema. Gegen
`supabase/migrations/` gelesen, zeigten sieben Zeilen auf Spalten, die es an dem
Ort nicht gibt. Fünf davon sind reine Faktenkorrekturen mit genau einem
richtigen Ziel:

- **Die Anschrift liegt auf `profile_contacts`, nicht auf `profiles`.**
  `20260813140000_profile_address_fields.sql` legt `street`, `postal_code`,
  `city`, `state`, `country` dort an — und nennt im Kopf ausdrücklich diesen
  Import als den, der `ort` auftrennt. Der Ort ist dort nicht gewählt, sondern
  erzwungen: auf `profiles` wäre die Anschrift für **jedes** eingeloggte Konto
  lesbar (AGE-530), auf `profile_contacts` erst nach angenommener Kontaktanfrage.
  Die Matrix hätte die Anschrift also nicht bloß woandershin geschrieben — sie
  hätte sie veröffentlicht.
- **`profile_contacts.website` existiert seit dem 11.06. nicht mehr**
  (`foundation_conform:75`, „website moves to profiles"). Ziel ist
  `profiles.website`.

Zwei weitere hatten überhaupt kein existierendes Ziel; hier ist entschieden
worden (Donald, 14.08.):

- **`profiles.offers` / `profiles.needs` gibt es nicht.** `public.offers` und
  `public.needs` sind eigene Tabellen mit `title text not null`. `biete` und
  `suche` sind Fließtext (Median 99 / 85 Zeichen, max 1050 / 784) und tragen
  keinen Titel. **Entschieden: je eine Zeile**, `description` = Volltext,
  `title` abgeleitet. VERWORFEN: an `short_bio` anhängen — dann stünden die 47
  bzw. 46 bestbefüllten Felder des ganzen Exports im Verzeichnis als „bietet
  nichts", und das Matching startete am Go-Live-Tag leer.
- **`profiles.interests` ist nicht das, was das Profil zeigt.** Die Spalte
  (`text[]`) speist nur `search_doc`; gerendert und bearbeitet wird
  `public.profile_interests (theme, label)` (`src/lib/profile.ts:188/359`).
  **Entschieden: `profile_interests` mit `theme = null`** — die öffentliche
  Profilseite rendert themenlose Einträge bereits (`untheured`), ein Wert wird
  ein Chip, ohne Auftrennen. VERWORFEN: `profiles.interests` — das Mitglied
  fände sich damit über eine Suche wieder, ohne den Grund sehen oder löschen zu
  können.

Für den Import heißt das: er schreibt **sechs** Tabellen, nicht drei —
`profiles`, `profile_contacts`, `profile_legacy`, `offers`, `needs`,
`profile_interests`. Das Spec-Delta ist davon unberührt; es nennt keine
Zielspalten.

#### Nachtrag 14.08., zweiter Teil: zwei Felder waren gar nicht das, was sie heißen

Beim Bauen der Abbildung gegen die echten Werte gemessen — und zwei weitere
Zeilen der Matrix fielen:

**`praesi_kurz` / `praesei_lang` sind keine Videos, sondern Präsentationstexte.**
Die Matrix führte beide auf `profiles.videos`. Gemessen: je 5/70 befüllt, davon
sind **2 parsebare YouTube-Links und 3 Fließtext** — „Wir vermitte…",
„HR-Consultin…", bis zu 2320 Zeichen. Die Felder heißen „Präsentation kurz" und
„Präsentation lang"; ein Teil der Mitglieder hat dort ein Video hinterlegt, der
andere einen Text. Sauber getrennt: die 2 Menschen haben in **beiden** Feldern
Videos, die 3 in beiden Feldern Text, keine Mischung.

**Entschieden (Donald, 14.08.): pro Wert.** Was `parseVideoUrl` annimmt, wird
ein Video; alles andere wird an `short_bio` angehängt. Eine Person kommt damit
auf rund 3.900 Zeichen „Über mich" — lang, aber vom Mitglied selbst kürzbar,
und die Herkunft steht im Bericht. VERWORFEN: alles auf `videos`, wie die
Matrix sagte — `sanitizeVideos` und die Anzeige filtern über `parseVideoUrl`,
die drei Texte wären also importiert und trotzdem unsichtbar gewesen.

**`socials` kennt nur drei Schlüssel — die Quelle liefert fünf.** Das Formular
(`ProfileFieldsets.tsx:168-172`) erfasst `linkedin`, `instagram`, `xing`; die
Matrix führt `linkedin`, `facebook`, `instagram`, `youtube`, `twitter`
zusammen. `facebook`, `youtube` und `twitter` haben im Ziel kein Feld.
Gemessen: **23 Menschen** tragen mindestens eines dieser drei, **5 davon haben
sonst gar kein Netzwerk**. Und weil `saveProfile` alle Profilfelder
bedingungslos schreibt, hätte das erste Speichern durch das Mitglied die drei
unbekannten Schlüssel wieder aus der `jsonb`-Spalte geräumt — unsichtbar
importiert, unsichtbar gelöscht.

**Entschieden (Donald, 14.08.): alle fünf schreiben und das Formular jetzt um
die drei fehlenden Felder erweitern.** Das ist der einzige Weg ohne Verlust und
ohne Wette auf einen Folge-Change. Er zieht diesen Change über den Import
hinaus in die Oberfläche — bewusst, weil die Alternative heisst, 29 Werte
entweder wegzuwerfen oder auf Zeit in einer Spalte zu parken, die das nächste
Speichern leert. VERWORFEN: nur `linkedin` + `instagram` importieren und den
Rest in den Bericht legen — verlustfrei, aber es verschiebt Handarbeit für 23
Menschen auf Detlev.

Nebenbefund, für die Erwartung an das Ergebnis: **`socials` wird auf keiner
Profilseite angezeigt**, weder öffentlich noch intern — es existiert nur im
Bearbeitungsformular. Die importierten Netzwerke sind damit vorerst für
niemanden sichtbar ausser für das Mitglied selbst. Das ist kein Fehler dieses
Changes, aber es begrenzt, was der Import hier bewirken kann.

#### `offers`/`needs` sind bereits belegt — die importierte Zeile muss sich einfügen

Bei der Sichtprobe am Formular aufgefallen: unter „Ich biete & ich suche" sitzt
ein **Kategorie-Wähler**, und der schreibt in dieselben zwei Tabellen
(`profile-categories.ts`). Eine importierte Freitext-Zeile trifft also auf ein
bestehendes System, statt in eine leere Tabelle zu fallen.

Nachgelesen — es passt, aber nur unter drei Bedingungen, die beim Schreiben
(Gruppe 7) eingehalten werden müssen:

- **`category` bleibt `null`.** `planReconciliation` sagt es wörtlich: „Zeilen
  ohne Kategorie gehören keinem Chip — sie bleiben unberührt." Eine importierte
  Zeile mit gesetzter `category` würde dagegen vom Chip-Wähler als abgewählte
  Kategorie gelesen.
- **`source` bleibt auf dem Default `'editor'`.** Die Spalte kennt nur
  `'editor'` und `'chip'` (Check-Constraint), ein `'import'` gibt es nicht — und
  `'editor'` trägt genau die gewünschte Bedeutung: solche Zeilen dürfen beim
  Abwählen einer Kategorie **nicht ohne Rückfrage** gelöscht werden. Ein
  versehentliches `'chip'` machte die Zeile dagegen kommentarlos löschbar und
  liefe zusätzlich in den Unique-Index `(profile_id, category) where source =
  'chip'`.
- **`theme` bleibt `null`.** Es gehört zum Facettenfilter des Kompass-Vokabulars;
  ein geratenes Thema stellte die Zeile in eine Facette, die das Mitglied nie
  gewählt hat.

Damit greift auch das Argument, mit dem die Entscheidung oben gefällt wurde:
`has_offers`/`has_needs` im Verzeichnis prüfen nur die Existenz einer Zeile, die
47 bzw. 46 Menschen sind also ab Tag 1 auffindbar. Nebenwirkung, bewusst in Kauf
genommen: `recompute_potential_score` summiert `count(*)` über beide Tabellen —
ein importierter Eintrag hebt den Potential-Score um denselben Betrag wie ein
selbst angelegter. Das ist konsistent, aber es heisst, dass der Score nach dem
Import anders steht als davor.

**Leerwertregel:** ein leeres oder nur aus Leerzeichen bestehendes Quellfeld
zählt als „nicht vorhanden" und schreibt `null`, nicht `''`.

### Nachtrag 15.08.: „ein Wert = ein Chip" ist in der Anzeige gefallen

Die Matrix sagte bis zur Sichtprobe (7.8) „ein Wert = ein Chip". Formal richtig —
die Quelle liefert je Mitglied einen Wert — und im Browser ein Chip über die
halbe Karte: 22 der 38 Werte tragen Kommas, vier enden auf einem, der längste
hatte 162 Zeichen, einer enthielt Zeilenumbrüche.

`zerlegeInteressen` trennt jetzt an **Komma und Zeilenumbruch** und nimmt den
führenden Spiegelstrich samt dem Apostroph des Exporters weg — demselben, der
beim Telefonfeld schon auffiel (2.4). Gemessen gegen die echte Datei: **38 Werte
→ 128 Chips**, längster 100 statt 162 Zeichen, **keiner** endet mehr auf einem
Komma.

Nicht getrennt wird an `/`, `&` und am **Punkt**: „Fitness/Calisthenics" und
„Crypto & Investments" sind je ein Begriff, und fünf der Werte sind Prosa statt
Verzeichnis („Mein Hobby ist Elektronik wie Handys und Laptops. Solltest Du …").
Am Punkt zu trennen machte daraus Halbsätze; als ein Chip ist es wenigstens wahr
— diese fünf bleiben deshalb lang, gewollt.

Kommas **innerhalb von Klammern** trennen nicht. Ohne die Regel zerfiel „Musik
(Gitarre, Gesang, Produktion)" in „Musik (Gitarre" und „Produktion)" — beim
Nachrechnen der Zerlegung aufgefallen, nicht beim Entwerfen.

**Und eine Folge, die weit über diesen Chip hinausgeht:** die Merge-Regel gibt
einer Liste nichts mehr heraus, sobald `bereitsImportiert` gilt („dann ist jede
Lücke das Ergebnis einer Entscheidung"). Eine geänderte Abbildung erreicht ein
bereits importiertes Profil also **nie**. Lokal war das sichtbar: der Lauf mit
der neuen Regel schrieb null Chips, bis die 70 Konten neu aufgesetzt waren. Für
DEV/PROD heisst das — **die Abbildung muss vor dem ERSTEN echten Lauf stimmen**;
danach korrigiert sie kein zweiter Lauf mehr, nur noch Handarbeit.

### HTML wird entfernt, Entitäten aufgelöst

15 Datensätze tragen Markup aus einem früheren Editor, teils mit Fremd-CSS
(`<p><span class="color_15">`) und `&nbsp;`. Betroffen sind `infos_16` (5/52),
`infos` (5/45), `infos_15` (3/24), `infos_28` (2/38); `biete`, `suche` und
`beruf` sind sauber. Ohne Auflösung stünde am Go-Live-Tag `&nbsp;` im Profil.

### Abhängigkeiten

Nachgemessen: **weder `sharp` noch ein CSV-Parser** liegen im Projekt, und
`supabase/seed/tsconfig.json` führt eine feste `include`-Liste mit drei Dateien —
neue Importdateien liefen ohne Typprüfung. Beides wird mit dem Change erledigt.
Der CSV-Parser muss RFC 4180 beherrschen: die Freitextfelder tragen Kommas und
Zeilenumbrüche.

## Risks / Trade-offs

**Die alte Seite fällt vor dem Go-Live ab** → Die Bilder liegen nur dort.
Gegenmittel ist die Zwischenablage, nicht der Trockenlauf; sie früh zu füllen ist
billiger, als sie nachzuholen.

**Die Quelle wird vor dem Go-Live neu gezogen** → Alle Zählwerte hier stammen
vom Export des 13.08. Der Trockenlauf misst neu und meldet Abweichungen; keine
Zahl aus diesem Dokument wird im Code fest verdrahtet.

**Aufgefüllte Beitrittsdaten sehen genauer aus, als sie sind** → Bewusst
eingegangen. Der Bericht ist der einzige Ort, an dem die Rohangabe erhalten
bleibt — er ist deshalb aufzubewahren, nicht nach dem Lauf zu verwerfen.

**Der Trockenlauf weicht vom echten Lauf ab** → Der klassische Fehler: der
Trockenlauf nimmt einen anderen Weg und sagt deshalb nichts. Gegenmittel ist ein
gemeinsamer Pfad, an dem nur die Effektadapter abzweigen — und zwar **alle**:
Datenbank, Ablage, Netzwerk.

**Zwischen Trockenlauf und echtem Lauf ändert sich der Bestand** → Jemand
registriert sich unter einer Mitgliedsadresse. Die Vorabprüfung läuft deshalb im
schreibenden Lauf **erneut**, nicht nur im Trockenlauf.

**Ein Mensch kommt nicht mehr an seine Adresse** → Kein technisches Risiko,
sondern das operative Hauptrisiko des Go-Live-Tags. Der Import kann es nur
sichtbar machen; die Rückläuferliste ist Detlevs Teil.

**Rücknahme deckt nicht alles** → Ein Datenbank-Backup nimmt hochgeladene Bilder
nicht zurück (codex, MEDIUM). Für diesen Change folgenlos, weil lokal gearbeitet
wird; für den Go-Live-Tag gehört es in den Ablauf aus AGE-534 §5, nicht hierher.

## Migration Plan

1. Parser und Abbildung, ohne Datenbank, gegen die echte Datei gemessen
2. Bilder in die Zwischenablage holen — eigener Abschnitt, wiederholbar
3. Trockenlauf gegen den lokalen Stack — Bericht mit Detlev-tauglicher Liste
4. Schreibender Lauf lokal, **zweimal**; Zeilenzahl belegt die Wiederholbarkeit,
   und ein absichtlich geänderter Wert belegt die Merge-Regel
5. Trockenlauf gegen DEV als Gegenprobe, ohne Schreibwirkung
6. *(nicht in diesem Change)* Go-Live-Tag: Backup, Testkonten weg (AGE-522),
   Trockenlauf gegen PROD, Durchsprache, echter Lauf, fünf Stichproben, drei
   echte Aktivierungen, dann erst die Rundmail

Rücknahme: bis Schritt 5 lokal und folgenlos. Ab Schritt 6 gilt das Backup aus
Schritt 1 des Go-Live-Ablaufs.

## Open Questions

- **Was sollte in „Mitgliedschaft" eingetragen werden?** Die Auswertung zeigt
  eindeutig ein Beitrittsdatum (kein Zukunftswert bei 52 Angaben), aber die
  Beschriftung ist mehrdeutig. Von Detlev bestätigen lassen.
- **Auf welchem Weg bekommt Detlev den Bericht?** Er trägt Personendaten von 70
  Menschen. Nicht per unverschlüsselter Mail, und nicht ins Repository.
- **`demo_seed.lib.ts` trägt die überholte Annahme** „dev and prod are the SAME
  Supabase project (ADR-0003)". Seit AGE-496 falsch — und genau diese Annahme
  hat meinen Host-Wächter in die Irre geführt. Nicht in diesem Change angefasst;
  eigener Nachlauf.
