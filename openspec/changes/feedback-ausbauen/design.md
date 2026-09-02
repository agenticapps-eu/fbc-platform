## Context

Das QM-Feedback (AGE-300, AGE-587) steht: eine Tabelle, eine RLS-Zusage „jeder
schreibt nur sein eigenes", eine `SECURITY DEFINER`-RPC für den Admin, eine
eigene Route mit Blätterung. Was fehlt, sind die vier Mittel, mit der
gesammelten Menge zu arbeiten — Bild, Thema, Filter, Antwortweg.

> **Diese Fassung ist die zweite.** Der Plan-Review vom 2026-09-01 (`gemini`,
> `codex`, beide REQUEST-CHANGES, siehe `REVIEWS.md`) hat vier Entscheidungen
> der ersten Fassung widerlegt und zwei fehlende aufgedeckt. Die widerlegten
> stehen unten mit dem, was an ihnen falsch war — nicht stillschweigend
> ersetzt, weil ein weggeräumter Fehler denselben beim nächsten Mal wieder
> einlädt.

Vier Dinge im Bestand geben den Rahmen vor, alle gemessen und nicht angenommen:

1. **`admin_list_feedback` ist bereits einmal abgerissen worden**
   (`20260825120000`), weil `create or replace` den Rückgabetyp nicht ändern
   kann. Der Kopf jener Migration sagt selbst voraus, die nächste Änderung müsse
   sie erneut abreissen. Das ist diese.
2. **Fünf Zusagen nennen die Signatur wörtlich**, verteilt auf **zwei** Dateien:
   `rls_test.sql` (545, 549) und `admin_feedback_test.sql` (260, 262, 267 — die
   letzte per `::regprocedure`). Sie **brechen mit einem Fehler**, sobald die
   Funktion vier Argumente trägt. Meine erste Zählung fand nur die zwei aus
   `rls_test.sql`, weil ich eine Datei durchsucht hatte statt das Verzeichnis.
   Rund zwanzig weitere Aufrufe sind positionell zweiargumentig und lösen mit
   Vorgabewerten weiter auf.
3. **`messages_insert` hat keine eigenständige Kontaktanfrage-Prüfung.** Das
   einzige `exists` verbindet `message_threads` **und** `contact_requests` und
   belegt damit Teilnahme und Freigabe in einem Ausdruck.
4. **`message_threads` trägt nur `unique (a_profile_id, b_profile_id)`** und
   keine Bedingung, die die Normalisierung des Paares erzwingt.

Die Produktfragen sind beantwortet: anonymes Feedback gibt es nicht (AGE-588
abgebrochen), der Admin darf die Kontaktanfrage-Hürde überspringen **und** das
Bild löschen (Donald, 01.09.), und ein so eröffnetes Gespräch ist **für beide
Seiten** offen (Donald, 01.09., nach dem Review-Befund).

## Goals / Non-Goals

**Goals:**

- Ein Feedback trägt ein Thema aus einer Menge, die die Datenbank kennt.
- Ein Feedback kann ein Bild tragen, dessen Grenzen serverseitig hängen und
  dessen Verweis an seinen Verfasser gebunden ist.
- Der Admin filtert den **Bestand**, nicht die geladene Seite.
- Der Admin erreicht den Verfasser, und der kann **antworten**.

**Non-Goals:**

- Kein gemeinsames Bauteil für Kästchen-Facetten (fünffach dupliziert, eigener
  Vorgang).
- Kein allgemeines Schreibrecht des Admins am Feedback. `feedback_admin_read`
  bleibt `for select`; die **einzige** Mutation ist das Aufräumen des
  Bildverweises beim Löschen, begrenzt auf dieses eine Feld.
- Keine Anonymität, keine Diskretionsstufe.
- Keine Volltextsuche über die Freitexte.
- Kein Prüfpfad über Admin-Löschungen. Der Review nennt ihn als unausgesprochene
  Annahme; er ist ein eigener Vorgang, sobald jemand ihn braucht.

## Decisions

### 1. Die Themenliste ist eine kleine Tabelle, kein `CHECK` mit Textliteralen

`feedback_themes (key text primary key, label text not null, sort int not null)`,
und `feedback.theme` bekommt einen Fremdschlüssel darauf.

Ein `CHECK` ist für die Datenbank eine Menge, für die Oberfläche aber nichts —
sie kann ihn nicht lesen. Die Liste stünde ein zweites Mal in TypeScript, samt
Beschriftung und Reihenfolge, und **nichts würde die Abschriften vergleichen**.
Verworfen auch ein Postgres-`enum`: keine Beschriftung, keine Reihenfolge, und
ein neues Thema wäre eine Migration _und_ ein Deploy.

Die Tabelle trägt RLS mit einer Lese-Policy für `authenticated`, und `select`
wird ausdrücklich gegrantet. RLS ohne Policy liefert der Oberfläche eine leere
Liste — ein Fehlerbild, das aussieht wie „es gibt keine Themen".

**Der Preis:** eine neue Tabelle bricht den Golden-Snapshot in `grants_test.sql`.

### 2. `theme` bekommt einen Vorgabewert, nicht nur `not null`

**Erste Fassung war hier falsch.** Sie sagte „nullable anlegen, Bestand setzen,
`set not null`" — und übersah, dass danach **jeder** Schreibzugriff bricht, der
die Spalte nicht nennt. Genau das tun nach der Migration und vor dem
Frontend-Deploy alle: die ausgelieferte Oberfläche, zwischengespeicherte
Clients, die Seeds und die bestehenden SQL-Tests. Die Reihenfolge „Datenbank
zuerst", die dieser Entwurf selbst vorschreibt, hätte den eigenen Rollout
zerlegt.

Also in dieser Reihenfolge, in einer Migration: Spalte nullable **mit**
`default 'generell'` anlegen → Bestand setzen → Fremdschlüssel → `set not null`.
Der Vorgabewert bleibt dauerhaft stehen, nicht nur für die Migration.

### 3. Die Filterargumente sind Arrays, und `null` heisst „keine Einschränkung"

`p_themes text[] default null`, `p_ratings int[] default null`, beide als
`(p_x is null or spalte = any(p_x))`.

Ein **leeres** Array als „alles" wäre falsch: `= any('{}')` ergibt `false`, der
Normalfall lieferte also eine leere Liste. Die Oberfläche schickt deshalb `null`,
wenn keine Marke gesetzt ist, und nicht `[]`.

**Innerhalb** einer Facette wirken mehrere Marken als ODER. **Zwischen** den
Facetten gilt UND: wer „Fehler" und „1 Stern" wählt, will die Schnittmenge. Die
erste Fassung liess das offen; der Review hat es zu Recht bemängelt.

Nebenbefund, festgehalten damit ihn niemand wegkürzt: die fünf argumentlosen
Zusagen werden dadurch **Wächter über die Bedeutung von „kein Filter"**. Sie
würden rot, wenn `null` je etwas anderes als „alles" hiesse.

### 4. `drop` und neu anlegen — und fünf Zusagen ziehen mit

Rückgabetyp und Signatur ändern sich, also `drop function
public.admin_list_feedback(int, int)` und `create function` neu. Alle vier
Argumente bekommen Vorgabewerte, damit die argumentlosen Aufrufe weiter
auflösen.

Die **fünf** Zusagen, die die Signatur ausschreiben, werden auf die neue
gehoben. Das ist kein Aufweichen — dieselbe Zusage über dieselbe Funktion unter
ihrem neuen Namen. Die positionellen Zweiargument-Aufrufe bleiben unverändert
und werden dadurch zu Wächtern über die Vorgabewerte der beiden neuen Argumente.

Klemmung (1..100, `null` → Vorgabe) und die Ordnung (absteigend nach
`created_at`, dann nach `id`) bleiben wörtlich. Der Filter greift **vor**
`limit`/`offset`.

### 5. Der Bucket folgt `post-media` — mit drei ausdrücklichen Abweichungen

Gemeinsam: privat, `on conflict (id) do update` beim Anlegen (mit `do nothing`
bliebe ein falsch konfigurierter Bucket konserviert und der RLS-Test liefe grün
dagegen), Präfix je Verfasser, `upsert: false` beim Hochladen.

**Abweichung 1 — die Werte stehen hier, nicht „wie bei post-media".** Der Review
hat zu Recht bemängelt, dass „Zeile für Zeile kopieren" 1 MiB **und nur WebP**
bedeutet hätte: ein gewöhnlicher PNG-Screenshot fiele durch. Festgelegt: Bucket
`feedback-screenshots`, **5 MiB**, `image/png`, `image/jpeg`, `image/webp`.
Keine Umwandlung im Client — ein Screenshot soll ankommen, nicht verlustbehaftet
werden. Signierte URLs mit kurzer Lebensdauer (60 s), je Zeile erst beim
Anzeigen erzeugt.

**Abweichung 2 — es gibt einen Leser, der nicht der Eigentümer ist.** Also
`is_activated() and (Eigentümer or is_admin())` für `select` und `delete`. Das
`is_activated()` ist nicht dekorativ: ohne es käme ein **deaktiviertes** Konto
mit noch gesetzter Admin-Rolle weiterhin an fremde Bilder — anders als bei
`feedback_admin_read`.

**Abweichung 3 — der Verweis ist gebunden.** `screenshot_path` liegt, wenn
gesetzt, im Präfix des Verfassers, erzwungen in der Datenbank, und gehört
höchstens einer Feedback-Zeile. Ohne das könnte ein Mitglied seine Zeile auf ein
fremdes Objekt zeigen lassen; die Admin-Fläche signierte oder löschte dann das
falsche Bild. Der Review nennt das beim Namen: _confused deputy_.

### 6. Zwei Policies, und die Teilnahmeprüfung wird herausgelöst

**Erste Fassung war hier falsch, und zwar gefährlich falsch.** Sie sagte, die
Teilnehmerprüfung bleibe „unangetastet", und beschrieb die Änderung als „die
`contact_requests`-Bedingung wird `( exists (…) or public.is_admin() )`". Beides
zusammen geht nicht: die Teilnahmeprüfung steht **innerhalb** desselben
`exists`. Wer ihn als Ganzes klammert, hebt sie mit auf — und baut einen Admin,
der in jedes fremde Gespräch schreiben darf. Das genaue Gegenteil der zugesagten
engen Ausnahme.

Die Ersetzung führt beide Bedingungen deshalb **getrennt**:

```
messages_insert:
  is_activated()
  and sender_id = auth.uid()
  and exists (                         -- Teilnahme, eigenstaendig
        select 1 from message_threads t
        where t.id = messages.thread_id
          and (t.a_profile_id = auth.uid() or t.b_profile_id = auth.uid()))
  and (                                -- Freigabe, hier greift die Ausnahme
        exists (select 1 from contact_requests cr ... status = 'accepted' ...)
        or is_admin()
        or exists (select 1 from message_threads t
                    where t.id = messages.thread_id and t.admin_eroeffnet))
```

`threads_insert` genauso: Teilnahme eigenständig, Ausnahme nur an der
Freigabe-Bedingung.

**Beide Policies, nicht eine.** Ein Admin, der ein Gespräch anlegen, aber nicht
hineinschreiben kann, sieht aus wie ein funktionierender Weg und bricht erst
beim Absenden.

### 7. Fünf Themen, nach Art des Anliegens

`generell`, `fehler`, `bedienung`, `inhalte`, `idee` (Donald, 01.09.). Nach Art
und nicht nach Fläche — eine Aufteilung nach Bereichen verdoppelte die `route`,
die ohnehin an jeder Zeile steht. `fehler` und `bedienung` bleiben getrennt:
„kaputt" geht an die Technik, „umständlich" an die Gestaltung.

### 8. Der Admin darf das Bild löschen — über die Feedback-Identität

Donald am 01.09., gegen den Vorschlag des Entwurfs, es zu vertagen. Ein
Leserecht ohne Löschrecht macht den Admin zum Zeugen ohne Handhabe.

Der Review hat zwei Löcher gefunden, die die erste Fassung offenliess: es gab
**keine Bedienung** dafür, und das Löschen des Objekts hätte
`feedback.screenshot_path` ins Leere zeigen lassen — während der Admin fremde
Feedback-Zeilen absichtlich nicht ändern darf.

Also ein `SECURITY DEFINER`-Weg, der die Feedback-Kennung entgegennimmt, die
Admin-Eigenschaft prüft, das Objekt löscht **und** den Verweis an der Zeile
leert. Er nimmt **keinen Pfad** vom Aufrufer entgegen — sonst wäre er derselbe
_confused deputy_ wie in Entscheidung 5.

### 9. Das Gespräch wird über einen serverseitigen Weg geöffnet

**Fehlte in der ersten Fassung ganz.** Sie sagte nur „öffnet ein bestehendes
oder legt genau eines an" und überliess das Wie der Umsetzung. Der Review hat
zwei Wege gezeigt, wie das schiefgeht: die Tabelle erzwingt die Normalisierung
**nicht** (ein vertauschtes Paar verletzt `unique (a, b)` nicht und läge als
zweites Gespräch daneben), und zwischen Nachsehen und Anlegen liegt ein
Wettrennen — das genau dann zuschlägt, wenn zwei Admins dieselbe Zeile öffnen.

Also ein atomarer Aufruf, der das Paar normalisiert (`least`/`greatest`), per
`on conflict ... do nothing` einfügt, die Kennung des bestehenden oder neuen
Gesprächs zurückgibt, ein Selbstgespräch abweist und `admin_eroeffnet` **nur
beim Neuanlegen** setzt.

### 10. Die Freischaltung hängt am Gespräch, nicht an der Rolle

Donald am 01.09.: beide Seiten dürfen senden. Umgesetzt als Markierung
`admin_eroeffnet` an `message_threads`, nicht als Sonderregel für den Empfänger.

Am Gespräch und nicht an der Rolle, aus zwei Gründen: die Freischaltung bleibt
auf **genau diesen einen Faden** begrenzt — das Mitglied gewinnt kein Senderecht
gegenüber sonst jemandem — und sie überlebt es, wenn der Admin später seine
Rolle verliert. Eine Regel „wer eine Nachricht von einem Admin bekommen hat,
darf antworten" wäre beides nicht.

Die Markierung setzt nur der Weg aus Entscheidung 9; ein Mitglied kann sie nicht
schreiben.

## Risks / Trade-offs

**Eine neue Tabelle bricht `grants_test.sql`** → im selben Change nachziehen,
als ausdrückliche Aufgabe.

**Der Change weitet jetzt DREI Zusagen** — Chat-Hürde, Löschrecht am Bild und
die Freischaltung des Fadens → jede einzeln belegen. Ein pgTAP-Lauf, der sie
zusammen prüft, kann grün bleiben, während eine zu weit greift. Und jede in
**beide** Richtungen: wer darf, und wer weiterhin nicht.

**Ein bestehender Beleg wird still schwächer.** Wer heute aus „es gibt ein
Gespräch" auf „es gab eine angenommene Kontaktanfrage" schliesst, liegt nach
diesem Change nicht mehr immer richtig — und **nichts wird davon rot**. Vor dem
Bau ist zu prüfen, ob eine bestehende Zusage so schliesst; eine Mutation ist der
Weg, das zu belegen.

**`database.types.ts` ist handgepflegt und liegt in `src/lib/`**, nicht in
`src/types/` — die erste Fassung nannte einen Pfad, den es nicht gibt.
`gen types` darf nicht darüberlaufen.

**Kein Index für den neuen Zugriffsweg.** `feedback` hat heute nur einen auf
`profile_id`. Bei der erwarteten Menge reicht das; die Entscheidung ist, **erst
zu messen** und einen Index nur zu setzen, wenn die gefilterte, geordnete
Abfrage ihn braucht.

**Screenshots können personenbezogene Daten enthalten.** Der Bucket ist privat,
die URLs sind kurzlebig, und der Admin kann löschen. Eine Aufbewahrungs- und
Moderationsregel darüber hinaus ist **nicht** Teil dieses Changes — der Review
nennt sie zu Recht als unausgesprochene Annahme, und sie gehört Donald.

## Migration Plan

Je Einheit gilt **RED vor GREEN**: erst die scheiternde Zusage, dann die
Migration.

1. `feedback_themes` (Tabelle, RLS, Policy, Grants) + `grants_test`-Snapshot.
2. `feedback.theme`: nullable **mit Default** → Backfill → FK → `not null`.
3. `feedback.screenshot_path` + Bucket + Policies + Pfadbindung.
4. `admin_list_feedback` abreissen und neu anlegen; die fünf Signatur-Zusagen
   heben.
5. `message_threads.admin_eroeffnet`, der Öffnungs-Weg, dann die zwei Policies.
6. Der Lösch-Weg für das Bild.
7. `src/lib/database.types.ts` von Hand, dann Datenschicht, dann Oberfläche.
8. Deploy: **Migrationen vor dem Frontend** — jetzt haltbar, weil der
   Vorgabewert aus Entscheidung 2 die alte Oberfläche überleben lässt.

Rücknahme: jede Policy trägt ihre Vorgängerfassung wörtlich im Migrationskopf.

## Open Questions

Keine, die den Bau blockiert. Zwei Dinge sind bewusst offen und stehen oben
unter Non-Goals bzw. Risks: der Prüfpfad über Admin-Löschungen und die
Aufbewahrungsregel für Screenshots.

Zur Korrektur einer Behauptung der ersten Fassung: „ein Thema hinzuzufügen
kostet eine Zeile und keine Migration" war schief. Es kostet eine
**Daten**-Migration — nur eben keinen Frontend-Deploy, weil die Oberfläche die
Liste liest, statt sie zu kennen.
