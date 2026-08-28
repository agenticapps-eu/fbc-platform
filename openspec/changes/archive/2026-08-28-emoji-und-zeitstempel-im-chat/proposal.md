# Emoji-Auswahl und Zeitstempel in der Nachricht

Linear: **AGE-645**

## Why

Drei Lücken in derselben Blase und derselben Sendezeile. Alle drei sind am
28.08. am Quelltext gemessen, nicht vermutet.

**1. Emoji funktionieren, nur der Weg dorthin fehlt.** `messages.body` ist
`text` (`supabase/migrations/20260612065636_matching.sql:78`) und
`Conversation.tsx` rendert ihn als Text. Ein getipptes 😀 kommt bereits an. Was
fehlt, ist die Auswahl: die Treffer auf `emoji|picker` im Quelltext sind
sämtlich Bild-Auswahlfelder (`EventCoverPicker`, `AvatarCropper`), keines hat
mit Emoji zu tun.

**2. Die Blase zeigt keine Uhrzeit.** `Conversation.tsx:88` rendert genau
`{message.body}` und sonst nichts. Dabei liegt der Wert bereit:
`ChatMessage.createdAt` (`src/lib/chat.ts:38`), und `fetchMessages`
(`src/lib/chat.ts:323`) liest `created_at` mit. Es fehlt **nur die Anzeige** —
kein Query, keine Spalte, keine Migration.

**3. `:-)` bleibt `:-)`.** Es gibt keinerlei Textumwandlung zwischen Eingabe und
Insert.

## Die Festlegungen, die diesen Umfang endgültig machen

Donald am 28.08., auf drei vorgelegte Fragen:

1. **`:-)` wird beim SENDEN ersetzt**, nicht nur angezeigt. Das Emoji landet
   endgültig in `messages.body`. Nicht rücknehmbar, nicht rückwirkend — beides
   war benannt und ist so gewollt.
2. **Der Picker bekommt den vollen Satz mit Suche**, nicht die kuratierte
   Kurzliste.
3. **Der Zeitstempel kommt in diesen Vorgang mit hinein**, statt einen eigenen
   zu bekommen — beides betrifft dieselbe Blase und dieselbe Sendezeile.

Der bewusst getragene Preis von (3): ein Vorgang trägt zwei unabhängige
Entscheidungen, und die Review sieht sie vermischt.

## Der volle Satz mit Suche — gemessen, nicht geschätzt

Die naheliegende Bibliothek scheidet an ihrer Grösse aus, und der naheliegende
Ersatz scheidet an der **Sprache** aus. Beides ist am 28.08. gemessen:

| Quelle | roh | gzip | Emoji | Befund |
| --- | ---: | ---: | ---: | --- |
| `@emoji-mart/data@1.2.1` | 27 MB (98 Dateien) | — | — | alle Sprachen, kommt so nicht ins Bündel |
| `unicode-emoji-json@0.9.0`, `data-by-group.json` | 422 kB | 31,5 kB | 1914 | **Namen nur englisch** |
| dieselbe Quelle, auf `[emoji, name]` abgespeckt | 52 kB | 16,7 kB | 1914 | **Namen nur englisch** |
| `emojibase-data@17.0.0`, `de/compact.json` | 605 kB | — | 1949 | deutsche `label` **und** `tags` |
| dieselbe Quelle, auf `[emoji, label, tags, group]` abgespeckt | 157 kB | **46 kB** | 1949 | **gewählt** |

Der englische Datensatz ist der kleinere und trotzdem der falsche. Die Probe,
die es entscheidet: **das einzige „Herz" im ganzen englischen Satz ist „Bosnia &
Herzegovina"** — eine Flagge. Wer in einer deutschsprachigen Anwendung „Herz"
tippt, fände ❤️ nicht. Der deutsche Satz trägt „Herz", „Herzen" und
„Herzdekoration" als `tags`.

46 kB gzip sind vertretbar, **weil sie nachgeladen werden**: der Datensatz hängt
an einem eigenen Bündel, das erst beim ersten Öffnen des Auswahlfelds geholt
wird. Die Anmeldeseite trägt nichts davon.

## Die kanonische Emoticon-Liste ist NICHT verwendbar — auch das ist gemessen

`emojibase-data` liefert ein `emoticon`-Feld, und die Versuchung wäre, es
einfach zu nehmen. Ausgezählt: **49 Zuordnungen**. Zwei Befunde daraus, die
beide gegen die Übernahme sprechen:

**Die Formen, die Donald genannt hat, stehen gar nicht drin.** Die Liste kennt
`:)`, `;)`, `:D` — aber **keine Variante mit Nase**. `:-)`, `;-)`, `:-D` fehlen
sämtlich. Wer die Liste übernimmt, baut genau das nicht, was bestellt wurde.

**Und ein gutes Dutzend der Einträge würde in gewöhnlichem Text losgehen:**
`:B` → 🤓, `:E` → 🧛, `:j` → 😏, `:3` → 😽, `8)` → 😎, `8#` → 🧟, `:@` → 🤬,
`:/` → 😕, `:?` → 😒, `:#` → 😶, `%(` → 🤢, `D:` → 😩. Ein `:/` trifft **jede
URL** (`http://…`), ein `8)` die Hausnummer aus dem Ticket, ein `:@` jede
E-Mail-Andeutung.

Daraus folgt die Fassung: eine **kleine, handverlesene Liste** mit den
Nasenvarianten, angewandt **nur an Wortgrenzen**, **vor dem Insert**.

## Was NICHT dazugehört

* **Keine Reaktionen** (Emoji *an* einer Nachricht) — AGE-647.
* **Kein Zitieren / Antworten** — AGE-646.
* **Keine Lesebestätigungen** — AGE-649. Die sind kein Nachbar dieses Vorgangs:
  `messaging/spec.md:110` sagt ausdrücklich „A read position is private to the
  member it belongs to", mit dem Szenario „A participant cannot see the
  counterpart's read position" (`:132`). Das ist eine ausgesprochene Zusage, die
  dort umgekehrt werden muss — nicht bloss eine Policy.
* **Keine Hauttöne.** Das Auswahlfeld bietet die neutrale Grundform; 👍🏽 ist
  darüber nicht wählbar. Beide Plan-Reviewer haben das unabhängig als Lücke
  benannt, und sie hatten recht — nicht weil es fehlt, sondern weil es
  *unausgesprochen* fehlte. Gemessen: 330 der 1949 Einträge tragen Töne, sie
  mitzuliefern kostete **+8 kB gzip**. Die Kosten liegen nicht in den Daten,
  sondern in der Oberfläche: ein zweites Popover innerhalb eines portalierten
  Popovers plus ein gemerkter Vorzugston. Eigener Vorgang; getippte oder
  eingefügte getonte Emoji funktionieren unverändert, weil `body` freier Text
  bleibt.
* **Kein eigener Emoji-Vorrat.** Was das Betriebssystem hat, wird angezeigt; es
  werden keine Bilder ausgeliefert.
* ~~**Keine Datumsgruppierung** („Heute", „Gestern") über der Blasenfolge.~~
  **ÜBERHOLT am 28.08.** Donald hat Tagesmarker wie in gängigen Messengern
  nachbestellt (mit Bild). Sie sind gebaut — siehe Aufgaben 2a. Die Folge für
  die Blase steht dort ebenfalls: der Tag steht seither EINMAL im Marker, und
  die Blase trägt nur noch `HH:MM` statt `TT.MM., HH:MM`.

## What Changes

Nachgetragen beim Archivieren: ohne diesen Abschnitt erzeugt
`scripts/generate-release-entries.ts` einen Neuigkeiten-Eintrag mit Titel und
leerem Rumpf. Die Stichpunkte der obersten Ebene sind genau das, was dort
landet.

* **Emoji-Auswahl in der Sendezeile.** Ein Schalter im Eingabefeld öffnet ein
  Feld mit rund 1900 Emoji, nach Gruppen sortiert und **auf Deutsch
  durchsuchbar** — „Herz", „grün", auch „gruen". Vollständig mit der Tastatur
  bedienbar. Der Datensatz wird erst beim ersten Öffnen geladen und belastet den
  Seitenaufbau nicht.
* **Jede Nachricht trägt ihre Uhrzeit**, in der Zeitzone des Betrachters. Der
  volle Zeitpunkt steht im Tooltip.
* **Tagesmarker zwischen den Tagen** — „Heute", „Gestern", sonst Wochentag oder
  Datum. Der Tag steht einmal über der Gruppe statt an jeder Blase.
* **Getippte Emoticons werden beim Senden zu Emoji**: `:-)` wird 🙂, `<3` wird
  ❤️. Bewusst nur eine kleine Liste, und mit Wortgrenzen — Adressen,
  Hausnummern und Beträge wie `<3.000 Euro` bleiben unangetastet.
* Ältere Nachrichten werden **nicht** nachträglich verändert. Die Ersetzung
  wirkt auf das, was neu geschrieben wird.
