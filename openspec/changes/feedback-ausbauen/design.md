## Context

Das QM-Feedback (AGE-300, AGE-587) steht: eine Tabelle, eine RLS-Zusage
„jeder schreibt nur sein eigenes", eine `SECURITY DEFINER`-RPC für den Admin,
eine eigene Route mit Blätterung. Was fehlt, sind die vier Mittel, mit der
gesammelten Menge zu arbeiten — Bild, Thema, Filter, Antwortweg.

Drei Dinge im Bestand geben den Rahmen vor und sind vor dem Entwurf gemessen
worden, nicht angenommen:

1. **`admin_list_feedback` ist bereits einmal abgerissen worden.** Die aktuelle
   Fassung (`20260825120000`) hat die argumentlose Vorgängerin per `drop`
   ersetzt, weil `create or replace` den Rückgabetyp nicht ändern kann. Ihr
   eigener Kopf hält fest, dass ein `drop` „eine zweite Migration kostet, die
   dieselbe Funktion ein zweites Mal abreißt" — das ist diese Migration.
2. **Fünf Zusagen in `rls_test.sql` rufen die Funktion argumentlos auf**
   (Zeilen 479, 486, 491, 496, 769). Der Kommentar an der Migration nennt sie
   ausdrücklich Wächter über die Vorgabewerte. Jede neue Signatur muss
   `admin_list_feedback()` ohne Argumente weiter auflösen.
3. **Die Kontaktanfrage-Hürde steht in ZWEI Policies**, nicht einer:
   `threads_insert` (`20260806080100_activation_gate.sql:341`) und
   `messages_insert` (ebenda, 358). Beide tragen denselben
   `exists (… contact_requests … 'accepted' …)`-Block.

Die zwei Produktfragen, an denen der Vorgang seit dem 27.08. hing, sind
beantwortet: **anonymes Feedback gibt es nicht** (AGE-588 am 01.09. abgebrochen;
`feedback.profile_id` ist `not null` mit Fremdschlüssel), und **ein Admin darf
die Kontaktanfrage-Hürde überspringen** (Donald, 01.09.).

## Goals / Non-Goals

**Goals:**

- Ein Feedback trägt ein Thema aus einer Menge, die die Datenbank kennt.
- Ein Feedback kann ein Bild tragen, dessen Grenzen serverseitig hängen.
- Der Admin filtert den **Bestand**, nicht die geladene Seite.
- Der Admin erreicht den Verfasser, ohne die Zugangszusage zu umgehen — die
  Ausnahme wird ausgesprochen und in der Datenbank durchgesetzt.

**Non-Goals:**

- Kein gemeinsames Bauteil für Kästchen-Facetten. Das Markup steht in fünf
  Flächen dupliziert; das zusammenzuziehen ist ein eigener Vorgang.
- Kein Schreibrecht des Admins am Feedback. `feedback_admin_read` bleibt
  `for select`.
- Keine Anonymität, keine Diskretionsstufe. AGE-588 ist entschieden.
- Keine Volltextsuche über die Freitexte. Filtern heißt hier Thema und
  Bewertung.

## Decisions

### 1. Die Themenliste ist eine kleine Tabelle, kein `CHECK` mit Textliteralen

**Gewählt:** `feedback_themes (key text primary key, label text not null,
sort int not null)`, und `feedback.theme` bekommt einen Fremdschlüssel darauf.

**Warum nicht `CHECK (theme in ('generell', …))`:** Ein `CHECK` ist für die
Datenbank eine Menge, für die Oberfläche aber nichts — sie kann ihn nicht lesen.
Die Liste müsste also ein zweites Mal in TypeScript stehen, samt Beschriftungen
und Reihenfolge. Zwei Abschriften einer Menge driften, und **nichts würde es
messen**: ein Thema, das nur im Code steht, erzeugt beim Absenden einen
Constraint-Fehler; eines, das nur in der Datenbank steht, taucht in keiner
Filterliste auf. Beide Fälle sind still bis zur Laufzeit.

Dieses Repo hat die Regel am 25.08. selbst aufgeschrieben (Kopf von
`20260825120000`, Entscheidung 1): „eine Abschrift, die nur ein Test
zusammenhält, kann auf einem ausgewogenen Bestand grün bleiben, während ein
Zweig falsch ist."

**Verworfen: ein Postgres-`enum`.** Ein Thema hinzuzufügen wäre dann eine
Migration _und_ ein Deploy, und `enum`-Werte tragen keine Beschriftung und keine
Reihenfolge — beides landete doch wieder im Code.

**Der Preis, und er ist bekannt:** eine **neue Tabelle bricht den
Golden-Snapshot in `grants_test.sql`**. Das ist kein Argument dagegen, aber es
gehört in die Aufgabenliste, sonst steht CI rot und niemand weiß warum.

### 2. Der Bestand bekommt „Generell", und die Spalte wird `not null`

In zwei Schritten in **einer** Migration: Spalte nullable anlegen, Bestand
setzen, dann `set not null`. Andersherum scheitert die Migration an der
ersten vorhandenen Zeile.

`not null` und nicht „null heißt Generell": eine nullable Spalte erzeugt zwei
Schreibweisen für dieselbe Aussage, und die Filterliste müsste beide kennen. Wer
das vergisst, baut einen Filter, der „Generell" auswählt und die Altzeilen nicht
findet.

### 3. Die Filterargumente sind Arrays, und `null` heißt „keine Einschränkung"

`p_themes text[] default null`, `p_ratings int[] default null`. In der
`where`-Klausel als `(p_themes is null or f.theme = any(p_themes))`.

**Warum nicht ein leeres Array als „alles":** Weil `= any('{}')` **falsch**
ergibt, nicht wahr. Ein leeres Array als Normalfall lieferte damit eine leere
Liste — und zwar genau dann, wenn der Admin die Seite ohne Filter öffnet. Der
Unterschied zwischen „nichts ausgewählt" und „nichts gefunden" muss in der
Datenschicht gezogen werden, nicht in der Oberfläche.

Die Oberfläche schickt deshalb `null`, wenn keine Marke gesetzt ist, und **nicht**
`[]`.

### 4. `drop` und neu anlegen — mit Vorgabewerten auf jedem Argument

Rückgabetyp **und** Signatur ändern sich, also `drop function
public.admin_list_feedback(int, int)` und `create function` mit der neuen
Signatur. Grants, `revoke` und der Kommentar kommen mit, wie beim letzten Mal.

**Die Fessel:** `p_limit`, `p_offset`, `p_themes` und `p_ratings` bekommen **alle**
einen Vorgabewert, damit `admin_list_feedback()` argumentlos auflösbar bleibt.
Fünf bestehende Zusagen rufen sie so auf; ohne Vorgabewerte melden sie `42883`.

Die Klemmung von `p_limit` (1..100, `null` → Vorgabe) und der zweite
Ordnungsschlüssel `id desc` bleiben **wörtlich** erhalten. Beide tragen eine
eigene Zusage, und `id desc` ist keine Kosmetik: ohne ihn ist die Ordnung bei
gleichen Zeitstempeln nicht total und dieselbe Zeile kann auf zwei Seiten
stehen.

Der Filter greift **vor** `limit`/`offset` — das ist der ganze Punkt von
Entscheidung 3 und steht als Szenario in der Spec.

### 5. Der Screenshot-Bucket folgt `post-media` Zeile für Zeile

Privat, `file_size_limit` und `allowed_mime_types` **am Bucket**, Präfix je
Verfasser (`(storage.foldername(name))[1] = auth.uid()::text`), Schreib-Policies
mit `is_activated()`, `on conflict (id) do update` beim Anlegen.

Das `do update` ist nicht Kosmetik: mit `do nothing` bliebe ein bestehender
Bucket mit falschen Einstellungen konserviert, und der RLS-Test liefe grün gegen
eine falsche Konfiguration (Befund aus dem C6-Review, festgehalten im Kopf von
`20260812090100`).

**Der Unterschied zu `post-media`:** hier gibt es einen **Leser, der nicht der
Eigentümer ist** — der Admin. Also eine zusätzliche SELECT-Policy mit
`public.is_admin()`. Und weil der Bucket privat ist, geht der Weg zum Bild über
eine signierte URL, nicht über einen öffentlichen Pfad.

`upsert: false` beim Hochladen ist Pflicht, nicht Stil: bei `true` müsste der
Aufrufer die Zieldatei erst lesen und scheitert an der SELECT-Policy.

### 6. Die Ausnahme steht in beiden Policies, und die Teilnahme bleibt

`threads_insert` und `messages_insert` bekommen die `contact_requests`-Bedingung
als `( exists (…) or public.is_admin() )`. Alles andere bleibt unangetastet —
`is_activated()`, `sender_id = auth.uid()`, und die Prüfung, dass der Aufrufer
selbst am Gespräch beteiligt ist.

**Nur eine der beiden anzufassen wäre der schlimmere Fehler als keine:** ein
Admin, der ein Gespräch anlegen, aber nicht hineinschreiben kann, sieht aus wie
ein funktionierender Weg und bricht erst beim Absenden.

`is_admin()` und nicht ein Feld an `profiles`: die Rolle steht in `staff_roles`
und ist servergesteuert. `profiles.roles` ist vom Mitglied schreibbar.

### 7. Die Themen: fünf, nach Art des Anliegens

Von Donald am 2026-09-01 entschieden:

| `key`       | `label`                      |
| ----------- | ---------------------------- |
| `generell`  | Generell                     |
| `fehler`    | Fehler / etwas geht nicht    |
| `bedienung` | Bedienung / Verständlichkeit |
| `inhalte`   | Inhalte / Texte              |
| `idee`      | Idee / Wunsch                |

**Nach Art des Anliegens und nicht nach Fläche.** Eine Aufteilung nach Bereichen
(Profil, Matching, Events …) verdoppelte die `route`, die ohnehin schon an jeder
Zeile steht — das Feedback wüsste dann zweimal, wo es entstand, und einmal, was
es meint. Die Art ist die Information, die fehlt.

`fehler` und `bedienung` sind getrennt, weil sie verschiedene Arbeitsvorräte
sind: „etwas ist kaputt" geht an die Technik, „etwas ist umständlich" an die
Gestaltung.

### 8. Der Admin darf das Bild auch löschen

Von Donald am 2026-09-01 entschieden, gegen den Vorschlag des Entwurfs, es zu
vertagen.

Der Grund trägt: ein missbräuchlich hochgeladenes Bild bliebe sonst liegen, bis
sein Verfasser es entfernt — und genau der hätte keinen Anlass dazu. Ein
Leserecht ohne Löschrecht macht den Admin zum Zeugen ohne Handhabe.

Die Ausnahme bleibt eng: dieselbe Rolle wie beim Leserecht (`is_admin()`,
gespeist aus `staff_roles`), und nur auf diesem einen Bucket. Sie ist damit die
**zweite** Ausnahme in diesem Change und gehört mit in den `cso`-Blick.

## Risks / Trade-offs

**Eine neue Tabelle bricht `grants_test.sql`** → Der Golden-Snapshot wird im
selben Change nachgezogen, und die Aufgabe steht ausdrücklich in `tasks.md`.
Sonst steht CI rot und der nächste Leser sucht am falschen Ende.

**Die Ausnahme in Teil 6 weitet eine Zugangszusage** → pgTAP muss **beide
Richtungen** belegen: Admin darf, Nicht-Admin darf weiterhin nicht. Ein Test,
der nur die neue Richtung prüft, ließe eine Öffnung für alle unbemerkt — und
eine bestehende Inventur findet ein fehlendes Gate nicht.

**`admin_list_feedback` wird zwischen Migration und Deploy kurz eine andere
Funktion sein** → Der `drop`/`create` läuft in einer Transaktion, und die alte
Oberfläche ruft die Funktion argumentlos auf, was die neue Signatur weiter
auflöst. Der gefährliche Fall wäre eine Oberfläche, die die neuen Argumente
schickt, bevor die Migration liegt — deshalb Migration vor Frontend-Deploy.

**`database.types.ts` ist handgepflegt** → Von Hand nachziehen. `gen types` darf
nicht darüberlaufen.

**Zwei Ausnahmen in einem Change** → Die Chat-Hürde (Entscheidung 6) und das
Löschrecht am Bild (Entscheidung 8) weiten beide eine Zusage, an verschiedenen
Stellen. Sie gehören einzeln belegt: ein pgTAP-Lauf, der beide zusammen prüft,
kann grün bleiben, während eine von beiden zu weit greift.

**Die Bildanzeige kann zur Preisgabe werden** → Der Bucket ist privat, die
SELECT-Policy nennt Eigentümer **und** Admin einzeln, und ein pgTAP-Fall belegt,
dass ein drittes Mitglied nicht herankommt. `storage.objects` tarnt sich in
pgTAP gern als bestandener RLS-Test — der Fall muss wirklich Zeilen anfassen.

## Migration Plan

1. Migration: `feedback_themes` anlegen und füllen, `feedback.theme` (nullable →
   Bestand setzen → `not null`, FK), `feedback.screenshot_path`.
2. Migration: Bucket + Policies.
3. Migration: `admin_list_feedback` abreißen und neu anlegen, Grants und
   Kommentar mit.
4. Migration: die beiden RLS-Policies neu deklarieren.
5. `grants_test.sql`-Snapshot nachziehen, pgTAP für beide Richtungen der
   Ausnahme und für den fremden Bildzugriff.
6. `database.types.ts` von Hand, dann Frontend.
7. Deploy: **Migrationen vor dem Frontend.** Die alte Oberfläche läuft gegen die
   neue Funktion weiter (argumentlos auflösbar), die neue nicht gegen die alte.

Rücknahme: die Policies aus Schritt 4 tragen ihre Vorgängerfassung wörtlich im
Kopf, sodass eine Gegenmigration sie ohne Archäologie wiederherstellen kann.

## Open Questions

Beide sind am 2026-09-01 von Donald beantwortet und stehen jetzt oben als
Entscheidung 7 und 8. Es bleibt keine offene Frage, die den Bau blockiert.

Was der Plan-Review noch beantworten kann, aber nicht muss:

- Ob `bedienung` und `inhalte` sich in der Praxis trennen lassen oder ob der
  Verfasser sie durcheinanderwirft. Das lässt sich nicht am Reissbrett klären
  und kostet später eine Zeile in `feedback_themes`, keine Migration.
