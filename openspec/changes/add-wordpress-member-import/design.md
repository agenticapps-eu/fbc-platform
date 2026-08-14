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

Die Datei **ohne** Größensuffix ist das Original (1000 px); die Ableitung
`-190x190` verschenkt 96 % der Bildinformation. Die Endung steht im Datensatz —
sie zu raten war die Empfehlung des Issues und hätte bei `jpeg` 14 Bilder
gekostet.

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
| `infos_28` | 38/70 | `profile_interests` (`label`, `theme` = `null`) | HTML entfernen, **ein Wert = ein Chip** |
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

**Leerwertregel:** ein leeres oder nur aus Leerzeichen bestehendes Quellfeld
zählt als „nicht vorhanden" und schreibt `null`, nicht `''`.

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
