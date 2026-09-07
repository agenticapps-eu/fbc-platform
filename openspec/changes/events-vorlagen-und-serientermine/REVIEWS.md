# Plan-Review — events-vorlagen-und-serientermine (AGE-630)

Schritt 2b des Workflows: adversariale Fremdreview des **Plans**, bevor eine
Codezeile existiert. Zwei Arme, beide **andere Anbieter** als der Autor des
Plans (Claude/Anthropic).

| Arm | Aufgelöstes Modell | Verdikt | Befunde |
| --- | --- | --- | --- |
| `gemini` | `gemini-pro` | REQUEST-CHANGES | 6 (2 HOCH, 2 MITTEL, 2 NIEDRIG) |
| `opencode` | `hf:moonshotai/Kimi-K3` | REQUEST-CHANGES | 7 (4 HOCH, 2 MITTEL, 1 NIEDRIG) |

Rohausgaben: `.gstack/age630-review-gemini.txt`,
`.gstack/age630-review-opencode.txt` (gitignoriert).

**Kein Gate-Trailer.** Er wird vom Produzenten `run-plan-review.sh` geschrieben
und bindet den Review per Digest an die Artefakte. Dieser Lauf ging direkt über
`reviewer-cli.sh`, und die Artefakte werden aufgrund der Befunde ohnehin
überarbeitet — ein von Hand nachgetragener Trailer behauptete eine Bindung, die
es nie gab. Wird als `trailer-absent` gemeldet, blockt nichts.

## Ein Fehllauf, der fast als Review durchgegangen wäre

Der **erste** Aufruf beider Arme lief ins Leere: `reviewer-cli.sh` erwartet
`<vendor> <prompt-datei>`, übergeben wurde der Prompt-*Text*. Beide Arme
antworteten mit `reviewer-cli: prompt file not found`, gefolgt vom Prompt selbst
— bei gemini 656 Zeilen, die auf den ersten Blick wie ein Review aussahen.
Exit-Code 0. Gezählt hat erst der Inhalt: keine `MODEL:`-Zeile, kein `VERDICT`.

## Befunde und ihre Behandlung

### HOCH — `vorlage_id` ist ein Schreibvektor, den RLS nicht bindet (opencode)

`events_write_host` prüft `is_activated()`, `host_id` und das Cover-Präfix — die
neue Spalte kennt sie nicht. Der Fremdschlüssel prüft nur Existenz, und die
FK-Prüfung läuft nicht unter der RLS der Zieltabelle. Ein aktivierter Host kann
damit Events mit **fremder** `vorlage_id` und den Slot-Zeitpunkten der fremden
Serie schreiben; die echte Erzeugung des Opfers läuft danach lautlos in
`on conflict do nothing` und die Serie entsteht nie.

**Angenommen.** Der Befund trifft die Kernbegründung von D2 („RLS lässt die
Arbeit tun, die RLS schon tut") an der einzigen Stelle, an der sie nicht gilt:
bei einer Spalte, die es zum Zeitpunkt der Policy nicht gab. Die Policy wächst
mit der Spalte mit; der komposite Fremdschlüssel `(vorlage_id, host_id)` ist die
strengere Variante und wird bevorzugt, weil die Fremdzuordnung dann auf keinem
Weg existieren kann. Dazu ein RED-Test.

Verwandt mit der Hausnotiz „ein Fremdschlüssel ist ein Existenz-Orakel".

### HOCH — D5 ist so nicht baubar (opencode)

Zwei getrennte Defekte, beide bestätigt:

1. Eine plpgsql-RPC kann die Cover-**Datei** nicht kopieren — die Bytes liegen
   im Storage-Dienst, ein `insert` in `storage.objects` kopiert nichts.
   Task 6.4 sagt nicht, *wo* kopiert wird.
2. `event_cover_lesbar()` schlägt das Objekt **ausschließlich** über
   `public.events.cover_path` nach (gelesen, `20260812100200:72–90`). Auf den
   Pfad einer *Vorlage* zeigt keine `events`-Zeile — also darf selbst der Host
   seine eigene Vorlagen-Cover-Datei weder signieren noch als Kopierquelle
   lesen.

Damit sind Task 2.2 („`cover_path` an `event_vorlagen`") und Task 6.5
(„`event_cover_lesbar()` unverändert") **zusammen unmöglich**. Eine der beiden
muss fallen.

**Angenommen.** Das ist der teuerste Befund des Laufs: er widerlegt eine
Entscheidung, die bereits mit Donald abgestimmt war, aus einer Richtung, die in
der Abstimmung niemand geprüft hatte. Braucht eine neue Entscheidung — siehe
offene Punkte.

### HOCH — `on conflict do nothing` ohne Ziel schluckt den falschen Constraint (opencode)

`events_cover_path_key` und der neue `(vorlage_id, starts_at)` koexistieren; ein
`on conflict do nothing` **ohne** Spaltenliste schluckt beide. Ein
Cover-Pfad-Konflikt sähe dann exakt aus wie legitime Idempotenz, und der Slot
fehlte dauerhaft.

**Angenommen, vollständig.** `on conflict (vorlage_id, starts_at) do nothing`
mit Ziel; Namensschema der Kopien mit UUID je Kopie, was das geschilderte
Szenario zusätzlich neutralisiert. Das Spec-Szenario „Erneute Erzeugung schont
angemeldete Termine" bewies ohne diese Korrektur die falsche Sache.

### HOCH — Ungeplante Seiteneffekt-Flut (opencode)

**Selbst nachgemessen und bestätigt:**
`trg_event_feed_post after insert on public.events for each row`
(`20260813100000:220`) und `trg_hinweis_neues_event after insert on
public.events for each row` (`20260827080000:205`), letzterer ruft
`hinweis_rundruf('event_created', …)` — eine Hinweiszeile **je aktiviertem
Mitglied ohne Opt-out**, synchron in der auslösenden Transaktion, plus
Push-Zustellung.

Eine Erzeugung von 52 Terminen schreibt damit 52 Feed-Beiträge und 52 Rundrufe
an die gesamte Mitgliedschaft in **einer** Transaktion. Der Plan erwähnt diese
Maschinerie mit keinem Wort.

**Angenommen.** Die Spec-Zusage „verhält sich wie ein einzeln angelegtes Event"
ist hier die Falle selbst. Braucht eine Produktentscheidung — siehe offene
Punkte.

### HOCH — Verschobener Termin kehrt zurück (gemini), und MITTEL — Vorlage bearbeiten erzeugt Duplikate (opencode)

Beide Arme treffen unabhängig dieselbe Stelle, aus zwei Richtungen: der
Idempotenzschlüssel enthält `starts_at`. Wird ein Termin verschoben oder die
Uhrzeit der Vorlage geändert, kollidiert nichts mehr, und die Regel legt den
alten Slot erneut an — bei geänderter Ortszeit stehen danach 19:00- und
20:00-Termine derselben Woche nebeneinander, beide anmeldbar.

**Angenommen.** Meine Einstufung als „Folgearbeit" war falsch: `slot_datum` ist
**jetzt** eine Spalte und **später** eine Migration mit Backfill an einem
eindeutigen Index. Der Index wandert auf `(vorlage_id, slot_datum)`.

### MITTEL — Frühjahrsumstellung unentschieden (beide Arme)

Beide melden es; opencode ergänzt, dass `zeitzone text` ohne Prüfung ein
Tippfehler-Risiko ist („Europe/Belin" ist speicherbar und stirbt erst zur
Laufzeit).

**Angenommen und am lokalen Stack nachgemessen** — geminis Behauptung stimmt:

```
2027-03-28 02:30 (existiert NICHT)   → 01:30Z → zurück: 03:30 Ortszeit
2026-10-25 02:30 (existiert ZWEIMAL) → 01:30Z → zurück: 02:30 Ortszeit
```

Postgres schaltet still weiter, ohne Fehler. Die Spec deckt nur den Herbst und
nur 19:00. Zwei Szenarien kommen dazu, `zeitzone` bekommt einen `check` gegen
`pg_timezone_names`.

### MITTEL — Obergrenze: Spec verspricht mehr als D2 hält (gemini)

Ein Widerspruch **im Plan selbst**: D2 nennt die Grenze zu Recht einen Schutz
gegen Versehen, das Requirement nennt sie eine „Aussage der Datenbank".

**Angenommen**, Formulierung im Requirement wird auf die von D2 gezogen.
opencode entkräftet dabei die schärfere Lesart: die Grenze *ist* in einer
`INVOKER`-Funktion durchsetzbar (`raise` vor dem `insert`) — die Bauform
widerspricht der Spec also nicht, nur das Wort „Aussage der Datenbank" ist zu
groß.

### NIEDRIG — Sammelbefunde

- **`INVOKER` schließt spätere Geschäftslogik aus** (gemini): als Trade-off in
  D2 notiert, nicht gebaut — hypothetischer Bedarf.
- **Gelöschte Vorlage lässt Waisen** (gemini): Spec-Satz statt Frontend-Option.
- **Zählsemantik von „52"** bei `bis_datum` unbestimmt, `bis_datum`-Überschreitung
  ohne RED-Test, regellose Vorlage ohne RPC-Form, `anzahl` bei übersprungenen
  Monaten (opencode a–c): **alle angenommen**, gehen in Spec und Tasks.
- **`events.vorlage_id` ist für fremde Mitglieder lesbar** (opencode e) — die
  Grobstruktur fremder Serien leckt. Kleine Fläche, aber eine Entscheidung:
  kommt als Risks-Satz hinein.

### Was die Reviewer gegengeprüft haben und was hält

opencode hat ausdrücklich bestätigt: die `null`-Behauptung zum Index stimmt; die
Operator-Richtung in D4 stimmt; `events_write_host` trägt **kein** Stufengate,
„Rechte wie bei Events" ist also faktisch richtig abgebildet (Frage 5
entkräftet); die AGE-605-Lektionen sind richtig verankert; die
`event_registrations`-Invarianten werden nicht berührt. Beide Kalenderreihen der
Spec (Wochenserie ab 01.09.2026, erster Dienstag 01.09./06.10./03.11./01.12.2026)
hat es nachgerechnet — sie stimmen, unabhängig von meiner eigenen Messung.

## Bilanz

**Beide Arme: REQUEST-CHANGES.** 6 HOCH-Befunde insgesamt, davon 4 vom
schärferen Arm, und zwei davon (`vorlage_id`-Schreibvektor, Unbaubarkeit von D5)
hätten den Change als Migration erreicht, wenn dieser Schritt übersprungen worden
wäre. Genau dafür steht 2b vor der ersten Codezeile.

Der Plan wird überarbeitet, bevor Code entsteht. Drei Befunde brauchen eine
Entscheidung des Auftraggebers und nicht bloß eine Textänderung:
Cover-Protokoll, Rundruf-Verhalten bei Serien, Zuschnitt der Serienänderung.

---

# Diff-Review — zweite Stufe (07.09., Aufgabe 10.4)

Derselbe Weg wie Stufe 1: `reviewer-cli.sh <vendor> <prompt-datei>`,
`REVIEWER_TIMEOUT=900`, beide Arme **andere Anbieter** als der Autor. Geprüft
wurde diesmal der **gebaute Diff** (2754 Zeilen: alle sieben Migrationen,
`src/lib/event-vorlagen.ts`, `src/components/events/*`, `EventDetailPage.tsx`),
nicht der Plan.

| Arm | Aufgelöstes Modell | Verdikt | Befunde |
| --- | --- | --- | --- |
| `gemini` | `Gemini Pro` | APPROVE | 3 (1 HOCH, 1 MITTEL, 1 NIEDRIG) |
| `opencode` | `hf:moonshotai/Kimi-K3` | APPROVE | 5 (1 MITTEL, 4 NIEDRIG) |

Rohausgaben im Scratchpad; Prompt in `.gstack/age630-review-prompt.md`
(gitignoriert). Beide Läufe tragen eine `^MODEL:`-Zeile und ein `VERDICT:` —
geprüft wurde der **Inhalt**, nicht der Exit-Code.

## geminis Befunde zählen als eine Stimme, nicht als drei

Zwei seiner drei „Befunde" **sind keine**. Der als HOCH etikettierte endet
wörtlich mit „Das ist das beabsichtigte Verhalten. Es gibt hier keinen Fehler.
Die Implementierung ist korrekt und sicher."; der MITTEL ebenso („Ein Angriff
wird korrekt verhindert."). Es hat die Prüffragen des Auftrags durchbuchstabiert
und die Antworten in Befundform gegossen. Seine eine prüfbare Behauptung —
`select … into strict` unter RLS wehrt eine fremde `vorlage_id` ab — habe ich am
Repo nachgeschlagen: **sie stimmt** (`20260907110000:64`, samt Kommentar, der
genau das begründet).

Bleibt ein echter NIEDRIG: `"Europe/Berlin"` steht als Client-Fallback in
`VorlageForm.tsx` **und** als Spalten-Default in der Migration. Zwei Orte für
einen Wert. **Nicht geändert** — die Entscheidung „Zeitzone ist kein Feld"
(Gruppe 9) macht den Client-Wert zum Anzeigefall des DB-Defaults, und ein
dritter Ort (Konfiguration) wäre für einen Verein mit einer Zeitzone teurer als
die Doppelung. Als offene Frage vermerkt.

## opencodes MITTEL — der teuerste Befund des Tages, und er ist behoben

**`event_serie_slots()` hatte keine Obergrenze für `p_anzahl`.** Die 52er-Grenze
sitzt in `event_serie_erzeugen()`; die Slot-Funktion darf `authenticated` aber
**direkt** aufrufen — das ist gewollt, die Vorschau braucht sie. opencode hat es
nicht behauptet, sondern **am Stack gemessen**, und ich habe die Messung
wiederholt:

```
select count(*) from public.event_serie_slots(
  'woechentlich','19:00','Europe/Berlin','2026-09-01', 100000, 2);
-> 100000
```

Kein Datenleck — die Funktion liest keine Zeile. Es ist eine
**Verfügbarkeits**-Lücke: `return query` materialisiert in einen Tuplestore,
also fordert ein Aufruf mit 10^8 unbegrenzt Speicher und CPU je HTTP-Anfrage,
auf einer Datenbank, die sich alle Mitglieder teilen. Jedes aktivierte Konto
konnte das mit einem Aufruf.

**Behoben in `20260907120000_event_serie_slots_obergrenze.sql`.** Die Grenze ist
**53, nicht 52** — und das ist der Teil, den man falsch machen kann: der
Enddatum-Pfad der RPC sondiert absichtlich mit 53, um „mehr als 52 im Zeitraum"
zu erkennen. Eine Grenze von 52 hätte genau diese Prüfung erschlagen. Beide
Hälften stehen als Zusagen in `event_serie_regel_test.sql` (§9), die zweite
ausdrücklich als Positivkontrolle zur ersten.

**RED gemessen, nicht angenommen:** die Zusage lief gegen den Stack **vor** der
Migration rot (Test 15, Exit 1), danach grün (16/16, Exit 0).

`p_anzahl = 0` und negative Werte liefern weiterhin still die leere Menge. Das
ist bewusst: hier sind sie harmlos, und `event_serie_erzeugen()` weist sie dort
ab, wo sie eine Bedeutung haben.

## opencodes NIEDRIG-Befunde, einzeln entschieden

**a) Die Cover-Zuordnung war datenbankseitig nicht festgezurrt — behoben.**
Der Test belegte Anzahl, Verschiedenheit und Präfix, aber nie, *welcher* Pfad an
*welchem* `slot_datum` landet. Genau das ist der leise Fehler, vor dem der
Migrationskopf warnt. Neue Zusage in `event_serie_cover_test.sql` (§1b), die die
Reihenfolge ausschreibt statt sie zu zählen.

**Gegenprobe gefahren, und sie ist der Beleg:** mit `order by s.slot_datum desc`
im RPC fällt **genau diese eine** Zusage — die vier bereits vorhandenen bleiben
grün. Vor §1b hätte eine vertauschte Cover-Reihenfolge die gesamte Suite
passiert.

**b) Fehlerzustand der Vorlagen-Abfrage — behoben.** `vorlagen.data ?? []` machte
aus einer gescheiterten Abfrage eine leere Liste: der Reiter zeigte
„Vorlagen (0)" und „Du hast noch keine Vorlage", während Vorlagen existieren.
Für die Events-Abfrage daneben gibt es diesen Zweig seit jeher. `EventsBody`
bekommt `vorlagenFehler`, `VorlagenPanel` einen `fehler`-Zweig im Ton der
Nachbarmeldung. Zusage in `EventsList.vorlagen.test.tsx`; **gegengeprobt** —
mit entferntem Zweig fällt sie (1 failed | 5 passed).

**c) Der `p_bis_datum`-Pfad der RPC ist vom Client unerreichbar — nicht
geändert.** Der Client holt 52 Slots und filtert selbst; liegen mehr im Zeitraum,
kappt er still, statt die Ablehnung der RPC auszulösen. **Vorschau und Erzeugen
bleiben deckungsgleich** — das ist der Teil, der zählt, und er ist getestet. Ob
die Oberfläche „im Zeitraum liegen weitere 8 Termine" sagen soll, ist eine
Produktfrage, keine Korrektheitsfrage. Als offene Frage vermerkt.

**d) `v_anzahl = 0` im Enddatum-Pfad endet still statt mit 22023 — nicht
geändert.** Inkonsistent zum `p_anzahl`-Pfad, praktisch folgenlos (der Knopf ist
bei leerer Vorschau gesperrt). Eine Änderung hier wäre eine Verhaltensänderung
an einer RPC ohne belegten Schaden. Als offene Frage vermerkt.

## Was opencode gegengeprüft hat — und selbst nachgemessen

Der Arm hat nicht gelesen, sondern **gemessen**: eigener Stack-Lauf über acht
Testdateien (531 Zusagen, PASS), `storage.foldername` gegen vier entartete
Eingaben (`'ohne-slash'`, `''`, `'/fuehrend/x'`, `'a/b/c'`), und ein
Zeichenvergleich des alten `event_cover_lesbar`-Zweigs gegen `20260812100200`.

Zur **Kernfrage der Aufgabe** (`event_cover_lesbar()`, besonderes Augenmerk):
kein Befund. Der neue Zweig verlangt innerhalb desselben `exists` Pfadgleichheit,
Präfixbindung, `is_activated()` **und** `v.host_id = auth.uid()`; für `anon` ist
`v.host_id = null` → NULL → zu. Die NULL-Semantik der entarteten Pfade fällt
durchweg **zu**. Der alte Zweig ist zeichengleich, die Rechte überleben
`create or replace`.

Ebenfalls ohne Befund und mit Beleg: fremde `vorlage_id` (P0002 unter RLS, plus
Komposit-FK `(vorlage_id, host_id)` als zweite Sperre), die 52er-Grenze in allen
Pfaden, Cover-Anzahl/Eindeutigkeit/Präfix, der Rundruf (52 → 1, Opt-out greift,
Mehr-Vorlagen-Anweisung zählt je Reihe), beide Zeitumstellungen, und der
Doppelklick (`isPending` plus Unique-Index).

## Bilanz Stufe 2

**Beide Arme: APPROVE.** Ein MITTEL und zwei NIEDRIG sind behoben, drei
NIEDRIG bewusst offengelassen und benannt. Drei Zusagen sind dazugekommen
(Obergrenze, Cover-Reihenfolge, Fehlerzustand), **jede davon gegengeprobt** —
zwei per Mutation, eine per RED→GREEN.

Der Ertrag ist derselbe wie in Stufe 1 und liegt wieder beim schärferen Arm:
der MITTEL-Befund war in keiner Plan-Review, in keiner Sichtprobe und in keinem
der 2596 Tests sichtbar, weil er nicht am Verhalten hängt, sondern an einer
Grenze, die zwei Funktionen weiter steht.
