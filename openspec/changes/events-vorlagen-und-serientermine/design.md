## Context

`public.events` ist heute eine Menge alleinstehender Zeilen. Gemessen am 05.09.
gibt es keine Vorlagen-, Serien- oder Wiederholungsspalte und keinen Code, der
etwas dergleichen täte (Negativbefund mit Positivkontrolle, siehe proposal.md).

Dieses Dokument ist die **zweite Fassung**, überarbeitet am 06.09. nach der
Fremdreview (`REVIEWS.md`). Beide Arme gaben REQUEST-CHANGES; sechs
HOCH-Befunde, zwei davon widerlegten Entscheidungen der ersten Fassung. Die
betroffenen Abschnitte sagen, was sich geändert hat.

Fünf Dinge im Bestand geben die Form dieser Änderung vor — alle gelesen, nicht
angenommen:

| Fundstelle | Was daraus folgt |
| --- | --- |
| `events_cover_path_key unique (cover_path)`, `20260812100000:79` | Termine können sich kein Coverbild teilen. Die Eindeutigkeit ist eine Sicherheitszusage (HIGH aus dem AGE-531-Fremdreview) und fällt nicht. |
| `events_write_host`, `20260812100000:110–124` | `for all to authenticated`, gebunden an `is_activated()` und `host_id = auth.uid()`, plus Pfadbindung des Covers. **Kein** Stufengate. Ein Host darf seine Events selbst anlegen. |
| `event_cover_lesbar()`, `20260812100200:72–90` | Schlägt das Objekt **ausschließlich** über `public.events.cover_path` nach. |
| `trg_event_feed_post` + `trg_hinweis_neues_event`, beide `after insert … for each row` auf `events` | Jede eingefügte Event-Zeile erzeugt einen Feed-Beitrag **und** einen Rundruf an jedes aktivierte Mitglied, samt Push. |
| `20260904160000_…` (AGE-605) | Anmeldungen entstehen ausschließlich über `register_for_event`; `checked_in` ist für `authenticated` nicht schreibbar. |

Die letzte Zeile ist der Grund, warum „materialisieren" nicht bloß bequemer ist:
`event_registrations` ist unique je `(event_id, profile_id)` mit Fremdschlüssel
auf `events.id`, und `register_for_event` sperrt genau diese Zeile, um zu zählen.
Ein zur Laufzeit berechneter Termin hätte keine `id`, auf die eine Anmeldung
zeigen könnte.

## Goals / Non-Goals

**Goals:**
- Eine Vorlage hält die inhaltlichen Felder eines Events und erzeugt daraus
  Termine.
- Drei Wiederholungsformen, darunter „n-ter Wochentag im Monat".
- Erzeugte Termine sind gewöhnliche Events und erben Anmeldung, Kapazität,
  Warteliste, Check-in und Sichtbarkeit unverändert.
- Ortszeit übersteht **beide** Umstellungen, mit festgelegtem Verhalten für die
  Stunde, die es nicht gibt.
- Verschieben eines Termins und Ändern der Vorlage erzeugen keine Duplikate.
- Eine Erzeugung löst **einen** Rundruf aus, nicht zweiundfünfzig.

**Non-Goals:**
- Kein Anmelden „für die ganze Reihe" — Anmeldung bleibt je Termin.
- Kein `EXDATE`/Override-Modell; siehe D7.
- Kein vollständiger RFC-5545-Parser. Drei Formen, nicht `RRULE` allgemein.
- Kein „letzter Dienstag im Monat" (Position `-1`). Nicht angefragt.
- Keine Rückwirkung auf bestehende Events.

## Decisions

### D1 — Termine werden materialisiert

Echte `events`-Zeilen, im Voraus erzeugt. Begründung siehe Context.

*Alternative: zur Laufzeit berechnen.* Verworfen, weil Anmeldungen dann an
nichts hängen. Der Zwitter „materialisiere bei der ersten Anmeldung" verlegt
einen Wettlauf in den frisch gehärteten Anmeldeweg.

### D2 — `SECURITY INVOKER` — und die Policy wächst mit der neuen Spalte mit

**Geändert nach Review (HOCH, opencode).** Die Bauform bleibt `INVOKER`: der
Host darf seine Events ohnehin anlegen, es gibt kein Recht zu leihen, und eine
`DEFINER`-Funktion müsste `is_activated()`, `host_id` und die Cover-Pfadbindung
vollständig nachbauen — jedes vergessene Stück wäre eine Policy-Umgehung.

**Was die erste Fassung übersah:** `events_write_host` wurde geschrieben, als es
`vorlage_id` nicht gab, und kennt die Spalte folglich nicht. Der Fremdschlüssel
prüft nur Existenz, und **die FK-Prüfung läuft nicht unter der RLS der
Zieltabelle** — die Policy „fremde Vorlage ist unerreichbar" hindert sie also
nicht. Ein aktivierter Host könnte damit per gewöhnlichem `insert` Events mit
**fremder** `vorlage_id` und den Slot-Zeitpunkten der fremden Serie schreiben;
die echte Erzeugung des Opfers liefe danach lautlos in `on conflict do nothing`,
und die Serie entstünde nie.

Das Kernargument von D2 — „RLS lässt die Arbeit tun, die RLS schon tut" — gilt
nur für eine Policy, die den Angriffsvektor kennt. **Mit der Spalte muss die
Policy wachsen.** Gewählt wird die strengere der beiden vorgeschlagenen
Varianten:

```
komposit-FK  events (vorlage_id, host_id) → event_vorlagen (id, host_id)
             + unique index on event_vorlagen (id, host_id)
```

Damit kann die Fremdzuordnung **gar nicht existieren**, auf keinem Weg — auch
nicht über einen Pfad, den eine `with check`-Klausel künftig übersähe. Eine
Bedingung in der Policy wäre die schwächere Zusage, weil sie nur schreibende
Wege deckt, die durch diese Policy laufen.

*Trade-off, den die Review zu Recht benannt hat (NIEDRIG, gemini):* mit
`INVOKER` gibt es keinen Choke-Point für Geschäftsregeln, die über die
RLS-Policy hinausgehen — etwa „nur Hosts mit aktivem Abonnement". Solche Regeln
gibt es heute nicht; entstünde eine, wäre das der Anlass, die Bauform neu zu
bewerten, nicht heute.

### D3 — Drei benannte Formen statt eines RRULE-Ausdrucks

Die Regel liegt als getippte Spalten an der Vorlage, nicht als
`RRULE`-Zeichenkette:

| Spalte | Bedeutung |
| --- | --- |
| `wiederholung` | `woechentlich` \| `monatlich_tag` \| `monatlich_n_ter_wochentag` |
| `wochentag` | 1–7 (ISO, Montag = 1); bei `woechentlich` und `monatlich_n_ter_wochentag` |
| `tag_im_monat` | 1–31; nur bei `monatlich_tag` |
| `position` | 1–4; nur bei `monatlich_n_ter_wochentag` |

Ein `check`-Constraint erzwingt, dass genau die zur Form gehörenden Spalten
gesetzt und die übrigen `null` sind. Eine Zeichenkette wäre erst beim Auswerten
falsch; getippte Spalten sind schon beim Schreiben falsch.

*Alternative: `RRULE` speichern und parsen.* Verworfen — ein allgemeiner Parser
ist erheblich mehr Fläche, als drei Formen rechtfertigen, und `BYSETPOS`,
`COUNT`, `INTERVAL` und `WKST` wären dann implizit zugesagt.

**Eine Vorlage ohne Regel** bleibt zulässig. Ihre Erzeugungsform ist
ausdrücklich **ein einzelnes Datum** als Parameter, nicht `anzahl` — sonst wäre
undefiniert, was ohne Regel vervielfältigt würde (Review NIEDRIG b).

### D4 — Ortszeit plus Zeitzone, und beide Umstellungen sind entschieden

Die Vorlage trägt `ortszeit time` und `zeitzone text` (Vorgabe
`Europe/Berlin`). Jeder Termin entsteht als
`(datum + ortszeit) at time zone zeitzone` und landet als `timestamptz` in
`events.starts_at`. Die Operator-Richtung wurde von beiden Armen bestätigt.

**Am lokalen Stack gemessen** (nicht angenommen — geminis Belege sind hier
notorisch unzuverlässig, also nachgeprüft):

```
2026-10-20 19:00 → 17:00Z          2026-10-27 19:00 → 18:00Z
2027-03-28 02:30 → 01:30Z  → zurück: 03:30 Ortszeit   (Stunde existiert NICHT)
2026-10-25 02:30 → 01:30Z  → zurück: 02:30 Ortszeit   (Stunde existiert ZWEIMAL)
```

**Geändert nach Review (MITTEL, beide Arme).** Die erste Fassung deckte nur den
Herbst und nur 19:00 Uhr. Festgelegt wird jetzt beides, und zwar auf das
Postgres-Verhalten — aber **ausdrücklich und getestet**, statt es dem Zufall der
Implementierung zu überlassen:

- **Frühjahrslücke:** die Regel schaltet weiter (02:30 → 03:30 Ortszeit). Der
  Termin fällt **nicht** aus. Begründung: ein stillschweigend ausgelassener
  Termin einer laufenden Reihe ist der schlechtere Ausgang — er fehlt im
  Kalender, ohne dass jemand es merkt, während eine um eine Stunde verschobene
  Nachtveranstaltung sichtbar bleibt und von Hand korrigierbar ist.
- **Herbstüberlappung:** erste Lesart (Sommerzeit), das Postgres-Verhalten.

`zeitzone` bekommt einen `check` gegen `pg_timezone_names` — ohne ihn ist
`'Europe/Belin'` speicherbar und tötet die Erzeugung erst zur Laufzeit
(Review MITTEL, opencode).

`ends_at` folgt aus einer Dauer an der Vorlage, nicht aus einer zweiten
Ortszeit — sonst wäre ein über die Umstellung laufendes Event mehrdeutig.

### D5 — Cover: zweiter Lese-Zweig für den Host, Kopie durch den Client

**Vollständig ersetzt nach Review (HOCH, opencode).** Die erste Fassung war
**nicht baubar**, aus zwei unabhängigen Gründen:

1. Eine plpgsql-RPC kann die Bild**datei** nicht kopieren — die Bytes liegen im
   Storage-Dienst, ein `insert` in `storage.objects` kopiert nichts.
2. `event_cover_lesbar()` schlägt Objekte **ausschließlich** über
   `public.events.cover_path` nach. Auf den Pfad einer *Vorlage* zeigt keine
   `events`-Zeile — also dürfte selbst der Host seine eigene Vorlagen-Cover-Datei
   weder signieren noch als Kopierquelle lesen.

Damit waren „Cover an der Vorlage" und „`event_cover_lesbar()` bleibt
unverändert" **zusammen unmöglich**. Entschieden (Donald, 06.09.):

**a) `event_cover_lesbar()` bekommt einen zweiten `exists`-Zweig**, der ein
Objekt unter `event_vorlagen.cover_path` **nur** dessen `host_id` zugesteht.
Kein `anon`-Zweig, kein `members`-Zweig: eine Vorlage hat keine Sichtbarkeit,
und die Sichtbarkeitslogik der `events`-Zeile auf eine Tabelle ohne
`visibility`-Semantik zu verbiegen wäre genau der „Reparatur"-Fehler, vor dem
die Review warnt.

**b) Die Kopie macht der Client**, vor dem Aufruf der RPC: `storage.copy()` je
Termin in das eigene `{uid}/`-Präfix, danach ein Aufruf der RPC mit der Liste
der fertigen Pfade. Die RPC kopiert nichts und lädt nichts.

**c) Namensschema: UUID je Kopie.** Nicht `{uid}/vorlage-{v}-{slot}.webp`. Ein
deterministischer Name macht einen verwaisten Pfad wiederauffindbar und damit
an ein fremdes Event anhängbar — der Angriff aus dem Migrationskopf, nur
selbstverschuldet. Eine UUID neutralisiert das Szenario vollständig.

**Teilerfolg ist benannt, nicht wegdefiniert:** Dateien entstehen vor den
Zeilen. Bricht die RPC ab, liegen Kopien ohne Termine im Bucket. Das ist die
gleiche Klasse wie die schon bestehende Waisen-Datei beim Löschen eines Events
und wird gleich behandelt: hingenommen und unter Risiken geführt. Die umgekehrte
Reihenfolge — Zeilen ohne Dateien — wäre schlimmer, weil sie sichtbar kaputte
Events erzeugte.

*Non-Goal:* `event_cover_lesbar()` wird **erweitert**, nicht umgebaut. Das
`anon`- und `members`-Verhalten für Events muss danach beweisbar unverändert
sein — das ist eine Aufgabe, kein Nebensatz.

### D6 — Idempotenz über `slot_datum`, mit Ziel am `on conflict`

**Zweifach geändert nach Review** (HOCH gemini + MITTEL opencode, unabhängig
dieselbe Stelle; HOCH opencode zum Constraint).

Ein Aufruf nennt `anzahl` **oder** `bis_datum`; keines von beidem ist ein
Fehler, ebenso eine `anzahl` über 52.

**`slot_datum` statt `starts_at` als Idempotenzschlüssel.** Der eindeutige Index
liegt auf `(vorlage_id, slot_datum)`. `slot_datum` hält den von der Regel
errechneten **ursprünglichen** Slot fest und wandert beim Verschieben eines
Termins ausdrücklich **nicht** mit. Damit:

- ein verschobener Termin belegt seinen Slot weiterhin → die Regel legt ihn
  nicht erneut an;
- eine geänderte `ortszeit` erzeugt keine zweite Garnitur derselben Wochen.

Die erste Fassung hatte das als „Folgearbeit" vermerkt. Das war falsch:
`slot_datum` ist **jetzt** eine Spalte und **später** eine Migration mit
Backfill an einem eindeutigen Index.

**`on conflict (vorlage_id, slot_datum) do nothing` — mit Ziel.** Ohne
Spaltenliste schluckte das Konstrukt auch Verletzungen von
`events_cover_path_key`, und ein Cover-Konflikt sähe exakt aus wie legitime
Idempotenz: der Slot fehlte dauerhaft, und kein Test könnte es unterscheiden.
Mit Ziel knallt ein Cover-Konflikt laut.

**Zählsemantik, ausdrücklich** (Review NIEDRIG a/c): `anzahl` zählt **erzeugte
Termine**, nicht durchlaufene Monate und nicht Kandidaten vor dem Einfügen. Bei
`monatlich_tag = 31` werden übersprungene Monate also nicht mitgezählt. Die
Obergrenze 52 gilt für die Kandidatenliste **vor** dem Einfügen — sonst wäre bei
Teilexistenz undefiniert, was ein Aufruf begrenzt.

**Die Grenze ist ein Schutz gegen Versehen, keine Sicherheitsgrenze.** Sie ist
in einer `INVOKER`-Funktion durchsetzbar (`raise` vor dem `insert`) — die Spec
ist also erfüllbar; nur die Formulierung „Aussage der Datenbank" war zu groß und
ist korrigiert.

### D7 — Ausnahmen brauchen kein Modell, Serienänderung braucht eine Regel

Verschieben ist ein `update` auf der Termin-Zeile, Absagen ein `delete`. Beides
darf der Host über `events_write_host` bereits, und `slot_datum` sorgt dafür,
dass die Regel den Slot nicht neu belegt.

**Ergänzt nach Review (HOCH gemini / MITTEL opencode):** die erste Fassung
behandelte das Ändern einer *Vorlage* überhaupt nicht — der zweithäufigste reale
Serienvorgang. Festgelegt:

> Eine erneute Erzeugung aktualisiert Termine derselben Vorlage, die **in der
> Zukunft liegen und keine Anmeldungen tragen**, auf die aktuellen Werte der
> Vorlage. Termine mit Anmeldungen und alle vergangenen Termine bleiben
> unangetastet.

Das ist die Erwartung des Hosts („ab jetzt eine Stunde später") ohne den Preis,
Mitgliedern unter der Anmeldung den Termin zu verschieben.

### D8 — Eine Serie kündigt sich einmal an, nicht zweiundfünfzigmal

**Neu nach Review (HOCH, opencode).** An `events` hängen zwei
`after insert … for each row`-Trigger: `trg_event_feed_post` und
`trg_hinweis_neues_event`, letzterer ruft `hinweis_rundruf('event_created', …)`
— eine Hinweiszeile **je aktiviertem Mitglied ohne Opt-out**, synchron in der
auslösenden Transaktion, plus Push. Selbst nachgemessen und bestätigt.

Eine Erzeugung von 52 Terminen schriebe damit 52 Feed-Beiträge und 52
plattformweite Rundrufe in **einer** Transaktion. Die Spec-Zusage „verhält sich
wie ein einzeln angelegtes Event" ist hier die Falle selbst; die Obergrenze
begrenzt die Event-Zeilen, nicht die Fächerwirkung.

Entschieden (Donald, 06.09.):
- **Rundruf:** für Termine mit `vorlage_id` unterdrückt, ersetzt durch **genau
  einen** Hinweis je Erzeugung, der die Reihe ankündigt.
- **Feed-Spiegel:** bleibt je Termin — Termine sind listenrelevant. Das war
  vorher ererbt und ist jetzt eine Entscheidung.

## Risks / Trade-offs

- **Cover-Kopien ohne Termine bei Abbruch** → Dateien entstehen vor den Zeilen;
  bricht die RPC ab, bleiben Kopien liegen. Gleiche Klasse wie die bestehende
  Waise beim Löschen eines Events. Hingenommen; die umgekehrte Reihenfolge wäre
  schlimmer.
- **`event_cover_lesbar()` wird angefasst** → eine sicherheitsrelevante
  Funktion. Der zweite Zweig ist eng (nur `host_id`, keine Sichtbarkeitslogik),
  aber der Diff-Review muss belegen, dass `anon` und `members` für Events
  unverändert bleiben.
- **Die Obergrenze ist kein Sicherheitsschutz** → benannt in D2/D6.
- **`events.vorlage_id` ist für fremde Mitglieder lesbar** → Existenz und
  Grobstruktur fremder Serien (Anzahl Termine je `vorlage_id`) sind ableitbar.
  Kleine Fläche, aber eine Entscheidung: hingenommen, weil die Termine selbst
  ohnehin sichtbar sind und ihre Zusammengehörigkeit inhaltlich offensichtlich
  ist.
- **`grants_test.sql` wird rot** → bricht bei **jeder** neuen Tabelle. Erwartet.
  Bei **Funktionen** heißt Rot dagegen „der `revoke` fehlt" — die Liste dort
  blind nachzuziehen erteilte `anon` das Ausführungsrecht.
- **Zeitzonenrechnung in SQL** → der Test muss über **beide** Umstellungstage
  laufen (25.10.2026 und 28./29.03.), sonst belegt er nichts.

## Migration Plan

Forward-only, additiv, in einer Migration:

1. `event_vorlagen` anlegen — Spalten, `check`-Constraints aus D3, `check` auf
   `zeitzone` gegen `pg_timezone_names`, RLS-Policy analog `events_write_host`,
   **ausdrückliche** Grants, Kommentare mit der Begründung im Kopf.
2. Unique index auf `event_vorlagen (id, host_id)` — Voraussetzung für den
   komposit-FK.
3. `events.vorlage_id` und `events.slot_datum` ergänzen, komposit-FK
   `(vorlage_id, host_id) → event_vorlagen (id, host_id)` mit
   `on delete set null`.
4. Eindeutiger Index auf `(vorlage_id, slot_datum)`.
5. `event_cover_lesbar()` um den Host-Zweig aus D5a erweitern.
6. Rundruf-Unterdrückung für `vorlage_id`-Termine (D8).
7. Die Erzeugungsfunktion als `SECURITY INVOKER`, `on conflict` **mit Ziel**,
   Obergrenze vor dem Einfügen, `revoke`/`grant` gesetzt.
8. `grants_test.sql` nachziehen.

**Rollback:** additiv; ein Zurücknehmen verwürfe Vorlagen, `vorlage_id` und
`slot_datum`. Erzeugte Termine blieben als gewöhnliche Events bestehen und
funktionierten weiter — die angenehme Eigenschaft von D1. Der Eingriff in
`event_cover_lesbar()` ist die einzige Stelle, die eine echte Rücknahme
bräuchte.

## Open Questions

- ~~Obergrenze je Aufruf?~~ **Entschieden 06.09.: 52.**
- ~~Vorlage löschen bei hängenden Terminen?~~ **Entschieden 06.09.:
  `on delete set null`**, Termine überleben. `cascade` verworfen — es nähme
  Mitgliedern ihre Plätze.
- ~~Cover-Protokoll?~~ **Entschieden 06.09.: D5**, zweiter Lese-Zweig nur für
  den Host, Kopie durch den Client, UUID-Namen.
- ~~Rundruf bei Serien?~~ **Entschieden 06.09.: D8**, ein Rundruf je Erzeugung,
  Feed je Termin.
- ~~Serienänderung im Zuschnitt?~~ **Entschieden 06.09.: D7**, `slot_datum` plus
  Aktualisierung zukünftiger anmeldungsfreier Termine.
- **Offen:** Braucht die Vorlagenliste eine eigene Seite oder gehört sie in die
  bestehende Eventverwaltung? Reine Oberflächenfrage, blockiert das Datenmodell
  nicht.
- **Offen:** Soll das Löschen einer Vorlage im Frontend anbieten, zukünftige
  anmeldungsfreie Termine mitzunehmen? (Review NIEDRIG, gemini.) Der
  DB-Standard `set null` bleibt als Netz in jedem Fall.
