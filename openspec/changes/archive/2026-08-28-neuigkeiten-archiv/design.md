# Design — das Archiv der Neuigkeiten-Fläche (AGE-636)

## Die eine Rechnung, die alles trägt

```
alle 52 Einträge
  ├── angekündigt?   → entry_slugs aller Notes mit status = 'sent'
  ├── übersprungen?  → release_entry_skips.slug
  └── sonst           → offen, steht in der Liste
```

Beide Mengen sind **Fremdwissen über denselben Schlüssel**: den
Verzeichnisnamen aus `openspec/changes/archive/`. Der Schlüssel existiert
bereits und ist laut AGE-631 „der einzig verlässliche Teil" des Archivs.

## Entscheidungen

### 1. Eine eigene Tabelle, kein dritter Zustand auf `release_notes`

`release_notes` hat `status check (status in ('draft','sent'))` und
`entry_slugs`. Ein dritter Zustand `'skipped'` mit den übersprungenen Slugs in
derselben Spalte wäre ohne Migration einer neuen Tabelle zu haben.

**Verworfen.** Drei Gründe, jeder für sich ausreichend:

- `title` und `body` sind `not null`. Eine „Note", die keine ist, müsste sie mit
  Platzhaltern füllen.
- Die Rücknahme wäre ein `update` auf `entry_slugs` — und
  `release_notes_admin_edit` lässt Updates ausdrücklich nur auf Zeilen mit
  `status = 'draft'` zu. Der dritte Zustand wäre damit **unveränderlich**, also
  genau das, was er nicht sein soll.
- `release_notes_read_sent` gibt jedem aktivierten Mitglied die Zeilen mit
  `status = 'sent'`. Ein vierter Zustand in derselben Tabelle setzt jede
  künftige Änderung an dieser Policy unter die Frage, ob sie ihn miterfasst.

Die eigene Tabelle kostet eine Migration und drei Policies. Sie trägt dafür
genau eine Aussage: *dieser Slug ist erledigt, ohne dass er verschickt wurde.*

### 2. Hier gibt es ein DELETE — und bei `release_notes` bleibt es dabei, dass es keines gibt

AGE-631 begründet das fehlende DELETE auf `release_notes` mit: „Eine zugestellte
Mitteilung soll nicht verschwinden können — die Hinweise dazu stehen dann schon
in 70 Postfächern."

Dieser Grund trifft hier **nicht** zu. Eine Markierung „nicht relevant"
verschickt nichts, erzeugt keine Hinweiszeile und ist für niemanden ausser dem
Admin sichtbar. Ihre Rücknahme ist der Normalfall (verklickt), nicht die
Ausnahme. `delete` ist deshalb erlaubt — und weil `slug` der Primärschlüssel
ist, ist die Rücknahme dieselbe Zeile, die die Markierung angelegt hat.

### 3. Das Archiv wird gerechnet, nicht gespeichert

Kein `archived`-Flag auf einem Eintrag. Die Zugehörigkeit zum Archiv ergibt sich
aus zwei Abfragen und einer Mengenrechnung. Ein gespeicherter Zustand könnte von
`entry_slugs` abweichen, sobald jemand eine Note zustellt — und ein Flag, das
lügt, ist schlimmer als keines.

Folge: der **Grund** steht nicht in der Datenbank, sondern fällt aus der
Rechnung heraus. „Zugestellt" schlägt „nicht relevant", falls beides zutrifft:
ein tatsächlich verschickter Eintrag ist verschickt, egal was vorher jemand
angehakt hat.

### 4. `<details>` statt eines Zustands im React-Baum

Aufklappen ist Browserverhalten. `<details>`/`<summary>` bringt Tastaturbedienung
und die Ansage an Vorlesesoftware mit, überlebt einen Re-Render ohne
`useState`, und der Zustand hängt nicht an der Route.

Verworfen: ein Knopf mit `useState`. Er wäre mehr Code für weniger Verhalten.
Verworfen ebenso: `useOverlay` aus AGE-529 — das Archiv ist kein Overlay,
sondern Inhalt, der auf der Seite bleiben soll, während man die Liste darüber
bearbeitet.

### 5. `teileAuf()` ersetzt `nochNichtAngekuendigt()`

Dieselbe Mengenrechnung, aber sie gibt beide Hälften zurück. `teileAuf` bekommt
weiterhin die **ungefilterte** Note-Liste (Entwürfe *und* Zugestellte) und
filtert selbst auf `status = 'sent'` — die Zusage aus AGE-631, dass ein Entwurf
nichts versteckt, bleibt damit an derselben Stelle geprüft wie bisher. Die vier
Tests von `nochNichtAngekuendigt` ziehen mit um, sie prüfen weiter dieselbe
Aussage.

`nochNichtAngekuendigt` fällt weg, weil es danach keinen Aufrufer mehr hat.

**`fetchEntwuerfe()` bleibt** und wird weiter aufgerufen, obwohl `teileAuf` die
Entwürfe verwirft. Das ist der Punkt: nur solange die Fläche Entwürfe wirklich
lädt, kann der Seitentest „lässt NICHTS aus, was nur in einem Entwurf steht"
überhaupt fehlschlagen. Hörte sie auf, sie zu laden, bestünde er ab sofort im
Vakuum.

### 6. `ON CONFLICT DO NOTHING` — und der Client-Aufruf, der es wirklich erzeugt

Zwei Admins können dieselbe Zeile gleichzeitig anlegen. Ein blankes `insert`
meldete dem zweiten einen `23505`, also eine Störung, wo nichts gestört ist.

Der erste Entwurf schrieb hier „`insert … on conflict do nothing`, kein
`upsert`". **Das ist kein ausführbarer supabase-js-Aufruf** (codex, LOW):
`.insert()` kann die Klausel gar nicht ausdrücken, und der einzige Weg dorthin
ist genau die Methode, die der Satz verbot. Richtig ist:

```ts
await supabase
  .from("release_entry_skips")
  .upsert({ slug }, { onConflict: "slug", ignoreDuplicates: true });
```

`ignoreDuplicates: true` setzt `Prefer: resolution=ignore-duplicates` und wird
in PostgREST zu `on conflict do nothing`. Der Methodenname ist `upsert`, die
erzeugte SQL ist es nicht — die beiden gehören auseinandergehalten.

Ohne `.select()` verlangt der Aufruf keine Rückgabezeile. Die Falle aus
`upsert-scheitert-an-select-policy` (der `upsert` braucht Leserecht auf die
Zielzeile) greift hier ohnehin nicht: der Admin hält SELECT auf dieser Tabelle.

### 7. `skipped_by` gehört der Datenbank, nicht dem Client

`skipped_by` trägt `default auth.uid()`, und die Insert-Policy verlangt
zusätzlich `skipped_by = auth.uid()`. Ohne diese Bedingung könnte ein Admin die
Markierung einem anderen Admin unterschieben oder `null` schreiben — die Policy
prüfte nur, *dass* der Aufrufer Admin ist, nicht *wer* dort steht (codex,
MEDIUM).

Die Spalte bleibt **nullable**, obwohl nie `null` hineingeschrieben werden kann:
`on delete set null` verlangt es. Die Alternative `on delete cascade` wäre
schädlich — mit dem Konto eines ausgeschiedenen Admins verschwänden seine
Markierungen, und 22 abgeräumte Einträge stünden wieder in der Liste.

`skipped_at` trägt `default now()`. Gegen einen Admin, der einen falschen
Zeitpunkt *mitschickt*, ist es nicht gehärtet, und das ist eine bewusste Grenze:
diese Tabelle ist eine Arbeitsnotiz, kein Nachweis. Nachweise stehen in
`admin_audit`.

### 8. Bei mehrfacher Zustellung zählt die ERSTE

Ein Slug darf in mehreren zugestellten Notes stehen — die Tests von AGE-631
lassen das ausdrücklich zu. Welche Note das Archiv dann nennt, war offen, und
ein `find()` hätte die Antwort still von der Reihenfolge der Abfrage abhängig
gemacht (codex, MEDIUM).

Festgelegt: **die früheste Zustellung**, sortiert nach `sent_at`. Das ist der
Zeitpunkt, an dem die Mitglieder es erfahren haben; jede spätere Nennung ist
eine Wiederholung.

### 9. Fehlende Markierungen sperren die Fläche, sie leeren sie nicht

`release_entry_skips` ist eine dritte Quelle neben Entwürfen und Zugestelltem.
Fällt ihre Abfrage aus und behandelt die Fläche das als „nichts markiert", dann
stünden die abgeräumten Einträge wieder in der Liste — vorangehakt, wenn sie
jung sind, und damit auf dem Weg in eine Mitteilung (codex, MEDIUM).

Die Fläche behandelt den Fehler deshalb wie den bestehenden: solange eine der
drei Abfragen lädt oder gescheitert ist, gibt es keine Liste und keinen Entwurf.
Genau das tut sie heute schon für Entwürfe und Zugestelltes.

### 10. Jede Änderung entwertet den gespeicherten Entwurf

Der schärfste Befund der Runde (codex, HIGH). Der Ablauf **speichern → einen
angehakten Eintrag als „nicht relevant" markieren → zustellen** verschickt die
Zeile, die in der Datenbank steht — samt des Slugs, den der Admin gerade
aussortiert hat. `stelleZu(entwurfId)` liest die Note, nicht den Bildschirm.

Und das ist **kein neuer Fehler**: schon heute darf man speichern, ein Häkchen
entfernen und zustellen. Nur verspricht dieser Change es jetzt ausdrücklich.

Verworfen — an den vier mutierenden Stellen `setEntwurfId(null)` zu rufen: die
fünfte, die jemand später hinzufügt, vergisst es, und der Fehler kommt lautlos
zurück.

Gebaut wird stattdessen ein **Abgleich**: beim Speichern merkt sich die Fläche
`{ id, titel, text, slugs }`. Zugestellt werden kann nur, solange der Bildschirm
diesem Stand entspricht. Weicht irgendetwas ab, steht wieder „Erst speichern,
dann zustellen" da. Der Zustand kann nicht auseinanderlaufen, weil niemand ihn
von Hand nachführen muss.

### 11. Kein optimistisches Umschalten in der Fläche

Markieren und Zurückholen laufen über `useMutation` mit Invalidierung im
`onSuccess` und einem Toast im `onError`. **Kein** optimistisches Update.

Ein optimistisch entferntes Zeilchen, dessen `insert` scheitert, wäre nach dem
nächsten Laden wieder da — und der Admin hätte in der Zwischenzeit einen
Entwurf ohne diesen Eintrag zusammengestellt. Der Zustand kommt deshalb erst aus
der Antwort. Die Fläche ist eine Admin-Fläche mit einer Handvoll Klicks; die
halbe Sekunde ist billiger als ein Zustand, der lügt.

### 12. Die Seitengrenze von 20 muss hier fallen — sie ist nicht länger „vorbestehend"

`fetchZugestellte()` seitet bei 20 (`RELEASE_NOTES_SEITE`). Ab der 21. Note
fielen die ältesten aus der Abfrage, und ihre Einträge erschienen wieder als
„offen". Der erste Entwurf dieses Designs hat das als vorbestehenden Fehler nach
Linear verschoben.

**Das war falsch, und der Fremd-Reviewer hat recht behalten** (gemini,
HIGH): das Archiv sagt zu, *vollständig* zu sein — „alles Kommunizierte steht
hier". Eine geseitete Grundlage macht aus einer stillen Verkürzung der offenen
Liste eine **falsche Behauptung im Archiv**. Ein Fehler, den man vererbt, wird
durch das Erben nicht kleiner, wenn die neue Fläche ihn zur Zusage erhebt.

Deshalb: eine eigene, **ungeseitete** Abfrage `fetchAngekuendigt()` für die
Admin-Fläche. Sie liest alle Notes mit `status = 'sent'` — aber **ohne `body`**,
also nur `id, title, entry_slugs, status, sent_at, recipient_count`. Damit
speist sie beides: die Rechnung *und* die Karte „Bereits zugestellt". Die
Fläche kommt so mit **einer** Abfrage aus statt mit zweien.

Sie trägt bewusst **kein** `limit`/`offset`, entgegen der sonst geltenden
Hausregel, und der Grund gehört benannt: eine Teilantwort wäre hier von „nicht
angekündigt" nicht zu unterscheiden und holte Einträge **stillschweigend zurück
in die Liste**. Falsch wäre nicht die Menge, sondern die Aussage. Die
Zeilenzahl ist durch die Zahl der Ankündigungsrunden begrenzt (heute: **0**);
wächst sie je, ist die Antwort eine Aggregation in der Datenbank, keine Seite.

`fetchZugestellte()` bleibt unverändert — `/neues` liest damit weiter, dort ist
Seitenweise richtig, weil die Seite anzeigt statt zu rechnen.

## Sicherheit (cso)

- Lesen, Anlegen und Löschen der Markierungen sind auf `is_activated() and
  is_admin()` beschränkt. `is_admin()` wird **gerufen**, nicht abgeschrieben —
  es prüft seit AGE-581 auch Sperre und Löschung.
- Kein `anon`-Recht, kein `service_role`-Weg, keine Edge Function.
- Die Tabelle enthält kein Mitglieder-PII: einen Verzeichnisnamen, eine
  Admin-`uuid`, einen Zeitstempel.
- Grants werden **ausdrücklich ausgesprochen** (AGE-312) und der
  Golden-Snapshot in `grants_test.sql` mitgepflegt — eine neue Tabelle mit
  Table-Grant bricht ihn sonst, auch ohne dass ihr Name dort steht.
