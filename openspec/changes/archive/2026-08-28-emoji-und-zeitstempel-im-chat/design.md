# Design — Emoji-Auswahl und Zeitstempel

Alle Zahlen in diesem Dokument sind am 28.08. gemessen. Wo „gemessen" steht,
steht daneben, **woran** — das ist die Lehre aus AGE-639, wo ein Kommentar
„gemessen" behauptete und dabei nur den Hook allein gemessen hatte.

## 1. Wo das Auswahlfeld sitzt — und warum nicht in der Zeile

Die Sendezeile (`Conversation.tsx:108`) ist ein `flex items-end gap-2` mit genau
zwei Kindern: `textarea` und Senden-Knopf. Der Platz ist in der Fenster-Variante
bereits zweimal knapp geworden, und beides steht als Kommentar im Code: der
Platzhalter musste gekürzt werden (`:130`), und die Eingabe brauchte ein
`min-w-0`, weil sie sonst den Knopf aus der Zeile schob (`:133`).

**Gerechnet für die Fenster-Variante** (14 rem Spalte = 224 px, `px-3` = 24 px,
`gap-2` = 8 px, Senden-Knopf `sm` ≈ 60 px): der Eingabe bleiben rund 112 px. Ein
dritter Flex-Partner von 32 px plus einem zweiten `gap-2` nähme davon **40 px**,
also mehr als ein Drittel.

**Entschieden: der Schalter liegt IM Eingabefeld, nicht neben ihm.** Die
`textarea` bekommt einen `relative` Wrapper und rechts innen einen absolut
positionierten Knopf; das Feld bekommt `pr-9`, damit der Text nicht darunter
läuft. Die Zeile behält damit **zwei** Kinder, und die Kosten sind Innenabstand
statt Zeilenbreite.

**Verworfen: ein dritter Knopf in der Zeile.** Sauberer im Markup, aber er zahlt
die 40 px genau dort, wo schon zweimal nachgegeben werden musste.

**Verworfen: im Fenster gar kein Auswahlfeld.** Das Ticket verlangt es
ausdrücklich in beiden Varianten.

## 2. Das Overlay hängt am `document.body` — das ist keine Vorsicht, sondern Erfahrung

Ein `position: fixed`-Overlay wird von jedem Vorfahren mit `transform`,
`filter` oder `backdrop-filter` eingefangen. In diesem Repository ist das
**dreimal** passiert, zuletzt in AGE-639 bei der Fensterreihe selbst.

Das Auswahl-Overlay wird daher wie `ChatFensterReihe.tsx:106` per `createPortal`
an `document.body` gehängt (dasselbe Muster liegt in `FeedbackButton`,
`ReleaseNoteModal`, `AvatarCropper`, `HeaderSearch` — fünf Vorbilder im Repo).

**Folge, die daraus fällt und die jsdom nicht sieht:** die Position muss aus
`getBoundingClientRect()` des Schalters berechnet werden, nicht aus CSS-Variablen
der Hülle. In AGE-639 las die Fensterreihe `var(--fbc-sidebar-w)`, das am
Wurzel-`div` steht, während sie selbst am `body` hing — die Variable fiel auf
`0rem` zurück und die Reihe wurde 77 rem breit statt 44. Genau diese Falle wird
hier nicht wiederholt.

**Und die Richtung ist nicht frei wählbar.** Der Plan-Reviewer (opencode,
MEDIUM) hat darauf gezeigt: das angedockte Fenster steht **am unteren Rand des
Sichtfensters**, und die Sendezeile ist seine unterste Zeile. Ein nach unten
geöffnetes Popover hat dort per Konstruktion keinen Platz. Also:

* Das Overlay öffnet **über** dem Schalter, wenn darunter weniger Raum ist als
  seine Höhe — was im Fenster immer gilt und auf der Seite meistens.
* Es wird waagerecht ans Sichtfenster **geklemmt**, damit es am rechten Rand
  nicht hinausläuft.
* Bei `scroll` und `resize` wird die Position **neu berechnet**, nicht
  eingefroren; ein Overlay, das beim Scrollen neben seinem Schalter stehen
  bleibt, ist schlimmer als eines, das schliesst.

Die Sichtprobe prüft das im **Fenster**, nicht nur auf der Seite — der günstige
Fall beweist hier nichts.

## 3. Der Datensatz — erzeugt und mitgeliefert, nicht als Abhängigkeit

Gewählt ist `emojibase-data@17.0.0`, Datei `de/compact.json` (siehe die
Messtabelle im Proposal: deutsche `label` **und** `tags`, 1949 Emoji, abgespeckt
46 kB gzip).

**Nicht als npm-Abhängigkeit.** Das Paket ist 47 MB in 324 Dateien, davon
brauchen wir zwei. Das in `node_modules` und damit in jeden CI-Lauf zu ziehen,
zahlt 47 MB für 157 kB Nutzen.

**Stattdessen ein Erzeuger-Skript plus erzeugte Datei** — das Muster gibt es im
Repo schon: `scripts/generate-release-entries.ts` →
`src/content/release-entries.generated.ts`. Hier also
`scripts/generate-emoji.ts` → `src/content/emoji.generated.ts`.

**Ein Unterschied zum Vorbild, und er ist bewusst:** `release:entries` läuft in
`prebuild`. Dieses Skript **nicht** — es holt seine Quelle aus dem Netz, und ein
Build, der ohne Netz scheitert, wäre ein Rückschritt. Es wird von Hand
angestossen, wenn eine neue Unicode-Fassung übernommen werden soll. Das steht
als Kommentar im Kopf des Skripts, nicht nur hier.

**Gruppe 2 (`component`) fliegt raus.** Das sind Hautton-Modifikatoren
(🏻🏼🏽🏾🏿) — keine wählbaren Emoji. Die übrigen neun Gruppen tragen deutsche
Namen aus `de/messages.json` („Smileys & Emotionen", „Tiere & Natur", …).

### 3a. Hauttöne: nur die Grundform, und das ist eine Entscheidung, kein Versehen

Die erste Fassung dieses Designs warf Gruppe 2 weg und schwieg danach über
Hauttöne. Der Plan-Reviewer (gemini, HIGH) hat das zu Recht als Lücke benannt:
wer die Modifikatoren aus der Liste nimmt, hat damit noch nicht gesagt, wie
jemand 👍 in seinem Ton wählt.

**Nachgemessen am 28.08.:** 330 der 1949 Einträge tragen ein `skins`-Feld, der
Basiseintrag ist jeweils die neutrale Gelbform (`👋` mit `👋🏻…👋🏿` darunter).
Die Daten sind also da, und sie mitzunehmen kostet **+8 kB gzip** (46 → 54 kB).

**Trotzdem: dieser Vorgang liefert nur die Grundform.** Nicht an den 8 kB liegt
es, sondern an der Oberfläche — ein Hautton-Wähler ist ein zweites Popover
**innerhalb** eines portalierten Popovers, plus ein gemerkter Vorzugston je
Mitglied. Das ist ein eigener Vorgang, und in einer 14-rem-Spalte kein kleiner.

Was hier gilt und im Delta steht: die Grundformen sind ein **vollständiger,
in sich geschlossener Satz**; getippte oder eingefügte getonte Emoji bleiben
davon unberührt, weil `body` weiterhin freier Text ist. Der Erzeuger nimmt das
`skins`-Feld **nicht** mit — wer den Folgevorgang baut, ändert eine Zeile im
Skript.

**Nachgeladen, nicht mitgebündelt.** Der Import erfolgt als dynamisches
`import()` beim ersten Öffnen des Auswahlfelds. Die Anmeldeseite trägt nichts
davon — und das ist die Zusage, die der Test prüfen muss, nicht die
Dateigrösse.

Die Zusage hat eine **Bedingung, die leicht unbemerkt bricht**: sie hält nur,
solange **keine** andere Stelle statisch aus `emoji.generated.ts` importiert.
Ein einziges `import { … } from "…/emoji.generated"` irgendwo zieht die 157 kB
ins Startbündel zurück. Der Bündel-Test ist genau dagegen die Wache.

**Herkunft und Lizenz.** `emojibase-data` steht unter MIT; wer erzeugte Daten
mitliefert, schuldet die Nennung. Der Kopf von `emoji.generated.ts` trägt
deshalb Quelle, Fassung (`emojibase-data@17.0.0`) und Lizenzhinweis, dazu die
Warnung, dass die Datei erzeugt ist und nicht von Hand geändert wird. Beides kam
aus der Review (gemini MEDIUM, opencode LOW).

## 3b. Wie das Auswahlfeld bedient wird — Suche, Tastatur, Schliessen

Beide Reviewer haben hier dieselbe Lücke gefunden: das Design nannte „Fokus
kehrt zurück", das Delta sagte über Bedienung **gar nichts**. Ein Delta, das so
bliebe, wäre auch von einem nur mit der Maus bedienbaren, nicht schliessbaren
Overlay erfüllt.

**Suchvergleich.** Gesucht wird über `label` **und** `tags`, und zwar
**normalisiert**: Kleinschreibung, und Umlaute gefaltet (`ä→a`, `ö→o`, `ü→u`,
`ß→ss`) auf beiden Seiten des Vergleichs. Ohne das fände „Bär" den Bären nicht,
sobald jemand „Baer" tippt, und „GRÜN" nichts. Verglichen wird als Teilzeichen­
folge — bei 1949 Einträgen ist ein linearer Durchlauf je Tastendruck
unmessbar teuer, das braucht keinen Index.

**Tastaturweg**, und das ist der, den die Sichtprobe nachweist: Der Schalter ist
mit Tabulator erreichbar und öffnet mit Enter oder Leertaste. Beim Öffnen liegt
der Fokus im **Suchfeld**. Von dort führen die Pfeiltasten ins Raster, Enter
wählt, Escape schliesst. Nach Wahl oder Schliessen liegt der Fokus wieder in der
**Eingabe** — nicht am Schalter, sonst müsste man nach jedem Emoji erneut ins
Textfeld tabben.

**Schliessen** auf drei Wegen: Escape, Klick daneben, und die Wahl selbst.

**ARIA:** das Overlay ist ein `dialog` mit zugänglichem Namen, das Raster trägt
`role="grid"`, jedes Feld einen zugänglichen Namen aus dem deutschen `label`
(sonst hiesse jede Schaltfläche nur „😀"). Der Schalter trägt `aria-expanded`.

## 4. Die Ersetzung — klein, an Wortgrenzen, vor dem Insert

Donalds Festlegung: **beim Senden**, also endgültig im `body`.

Die kanonische `emoticon`-Liste aus `emojibase-data` (49 Zuordnungen) wird
**nicht** übernommen. Zwei Gründe, beide ausgezählt:

* Sie kennt **keine Nasenvariante** — `:-)`, `;-)`, `:-D` fehlen sämtlich,
  obwohl genau die bestellt sind.
* Rund ein Dutzend ihrer Einträge geht in gewöhnlichem Text los: `:/` trifft
  jede URL, `8)` die Hausnummer, `:@` jede E-Mail-Andeutung, dazu `:B` `:E`
  `:j` `:3` `:#` `:?` `%(` `D:`.

**Die Liste, die gebaut wird** — handverlesen, mit Nase und ohne:

| Eingabe | wird |
| --- | --- |
| `:-)` `:)` | 🙂 |
| `:-(` `:(` | 🙁 |
| `;-)` `;)` | 😉 |
| `:-D` `:D` | 😄 |
| `:-P` `:P` | 😛 |
| `:-O` `:O` | 😮 |
| `<3` | ❤️ |

**Die Grenzen sind die eigentliche Arbeit — und die erste Fassung hatte sie zu
eng.** Sie verlangte links wie rechts Leerraum. Der Plan-Reviewer (opencode,
HIGH) hat daran den häufigsten echten Fall aufgespiesst: `Toll :-).` und
`Schön :)!` wären **nicht** ersetzt worden, weil `.` und `!` kein Leerraum sind.
In deutscher Chat-Prosa steht hinter dem Smiley fast immer Satzzeichen — die
Funktion hätte also genau dort ausgesetzt, wo sie am meisten benutzt wird.

Die Grenzen sind deshalb:

* **links:** Textanfang, Leerraum, oder eine öffnende Klammer bzw. ein
  Anführungszeichen (`(`, `[`, `{`, `"`, `'`)
* **rechts:** Textende, Leerraum, oder Satzzeichen (`.`, `,`, `!`, `?`, `;`,
  `:`, `)`, `]`, `}`, `"`, `'`)

Was damit **weiterhin unangetastet** bleibt, und warum: in `http://x.de/a:-)b`
und `http://x.de/a:-).` steht links ein `a`, also weder Leerraum noch öffnendes
Zeichen — die Linke Grenze allein schliesst URLs aus. `foo:)bar` ebenso. Und
`8-)` als Hausnummer trifft gar keinen Eintrag, weil die Liste `8)` und `8-)`
bewusst nicht führt.

**Gross- und Kleinschreibung:** die alphabetischen Formen werden **ohne
Rücksicht auf Schreibweise** erkannt — `:p` genauso wie `:P`, `:d` wie `:D`.
Auch das kam aus der Review (opencode, MEDIUM): eine still gross-empfindliche
Liste hiesse, dass die Hälfte der Eingaben umgewandelt wird und die andere
nicht, ohne sichtbare Regel. `<3` ist davon nicht betroffen.

**Reihenfolge:** die längeren Formen zuerst (`:-)` vor `:)`), sonst frisst die
kurze Form den Anfang der langen.

**Ort: in `useGespraech.sende()`, nicht in `Conversation.submit()`.** Die erste
Fassung sagte `submit()`; die Review hat die Annahme dahinter freigelegt („die
Konversation ist der einzige Sendeweg"), und die Prüfung hat sie zwar bestätigt,
aber die bessere Stelle gezeigt. Gemessen am 28.08.: `sendMessage` hat genau
**einen** Aufrufer im Produktivcode, `use-gespraech.ts:134`.

In `sende()` platziert, wird derselbe ersetzte String sowohl in die optimistische
Blase (`use-gespraech.ts:120–130`) als auch in den Insert gegeben. Die Gleichheit
von Blase und Zeile ist damit **strukturell** statt per Konvention — und jeder
künftige Aufrufer des Hooks (AGE-646 zum Beispiel) erbt die Ersetzung, statt sie
zu vergessen.

## 5. Der Zeitstempel — und die Uhr, die springt

Der Wert liegt bereit (`ChatMessage.createdAt`). Zwei Dinge sind trotzdem zu
entscheiden.

**Die schwebende Blase bekommt KEINE Zeit.** Gemessen: die optimistische
Nachricht setzt `createdAt: new Date().toISOString()`
(`use-gespraech.ts:125`) — die **Client**-Uhr. Die echte Zeile trägt die
**Server**-Uhr. Eine angezeigte Zeit spränge also beim Eintreffen des Echos, und
zwar um genau die Uhrendifferenz. Dieselbe Falle ist in diesem Repo für
`last_read_at` bereits ausbuchstabiert (`src/lib/chat.ts:177`: „eine zweite Uhr
im selben Vergleich"). Solange `message.pending` gilt, steht an der Blase
deshalb keine Uhrzeit; sie erscheint, wenn die Serverzeile da ist.

**Form — und hier hat die Review eine echte Lücke gefunden.** Die erste Fassung
sagte „nur `HH:MM`, kein Datum" und schob die Begründung auf die
ausgeschlossenen Datumstrenner. opencode (LOW) hat vorgerechnet, was das
bedeutet: **eine Nachricht von letztem Dienstag stünde als „14:03" da**, ohne
irgendeinen Hinweis auf den Tag. Das Datum wäre nur im `title` — also per
Mauszeiger, den es auf einem Telefon nicht gibt.

Deshalb: **`HH:MM` für heute, `TT.MM., HH:MM` für alles Ältere.** Das ist keine
Datumsgruppierung (es bleibt an der Blase, es gibt keine Trenner in der
Blasenfolge) und schliesst die Lücke, ohne den ausgeschlossenen Umfang
anzufassen.

Ausgabe über `Intl.DateTimeFormat("de-DE")`, in einem `<time dateTime={…}>` mit
dem vollen Zeitstempel als maschinenlesbarem Wert.

**Die Zusage über Hilfsmittel wird zurückgenommen.** Die erste Fassung des
Deltas behauptete, der genaue Zeitpunkt bleibe „für Hilfstechnik verfügbar".
Das stimmt so nicht: Screenreader lesen `dateTime` nicht verlässlich vor, und
`title` ist per Berührung gar nicht erreichbar. Das Delta sagt jetzt nur noch,
was wahr ist — der maschinenlesbare Wert bleibt erhalten.

**Zeitzone:** die des Betrachters, weil `Intl` ohne weitere Angabe so arbeitet.
Zwei Mitglieder in verschiedenen Zonen sehen für dieselbe Zeile verschiedene
Uhrzeiten. Das ist gewollt und steht hier, weil es vorher nur implizit galt.

**Ort und Kontrast:** in der Blase, rechts unten, kleiner und gedämpft. Die
beiden Blasen tragen verschiedene Gründe (`bg-accent text-chrome` für eigene,
`bg-canvas text-ink` für fremde), also braucht die Zeit **zwei** Farben —
`text-chrome/70` bzw. `text-muted`. Eine einzige gedämpfte Farbe wäre auf einer
der beiden unlesbar. Das ist in beiden Themes zu prüfen (hell und navy, nicht
`prefers-color-scheme`).

**Platz im Fenster:** die Blase ist auf `max-w-[75%]` begrenzt. Bei 14 rem sind
das rund 84 px; eine Uhrzeit von `12:34` braucht bei `text-[0.65rem]` rund
26 px. Sie steht deshalb **unter** dem Text in derselben Blase, nicht daneben —
daneben zwänge kurze Nachrichten in einen Umbruch.

## 6. Was RED aussieht, bevor es GRÜN wird

Vier Zusagen, vier Tests, jeder mit Gegenprobe:

1. **Ersetzung trifft** — `:-)` allein wird 🙂; und **trifft nicht**:
   `http://x.de/a:-)b`, `8-)`, `foo:)bar` bleiben Zeichen für Zeichen gleich.
2. **Die schwebende Blase trägt keine Zeit**, die bestätigte trägt eine.
3. **Das Auswahlfeld fügt an der Cursorposition ein**, nicht am Ende — und der
   Fokus kehrt in die Eingabe zurück.
4. **Der Datensatz liegt nicht im Startbündel** — geprüft am erzeugten Bündel,
   nicht am Import-Ausdruck.

**Was jsdom nicht sieht und deshalb in den Browser gehört:** dass das Overlay
nicht eingefangen wird (`getBoundingClientRect` sofort nach dem Öffnen), dass
die Sendezeile bei 14 rem nicht umbricht, und der Kontrast der Uhrzeit auf
beiden Blasen in beiden Themes. Dazu kommt die bekannte Falle, dass ein
synthetisches `KeyboardEvent` einen `<button>` nicht aktiviert — Tastaturwege
werden über echte Tastendrücke geprüft, nicht über `fireEvent`.
