## Context

Die Aktivität kennt seit AGE-718 eine dritte Kartenart `kind = 'release'`. Der
Weg dorthin ist genau einer: `release_notes.status` wechselt von `draft` auf
`sent`, der Auslöser `trg_release_feed_post` feuert und legt eine `posts`-Zeile
an. Geschrieben wird der Zustandswechsel heute allein von
`send_release_note()`, und die Funktion erzeugt **davor** den Fan-out in
`notifications`.

Der Bestand am 25.09., lesend gegen PROD gemessen (`--prod=viwntbodrtqxgmqyxluh`,
Sitzung auf `default_transaction_read_only`):

| Gegenstand | Messwert |
| --- | --- |
| `release_notes` | **0** Zeilen, weder `sent` noch `draft` |
| `posts` | 17 — 10 `member`, 7 `event`, **0** `release` |
| `posts`-Zeitraum | 17.08. bis 18.09. |
| `notifications` | 308 Zeilen, davon **0** vom Typ `release_note` |
| `push_zustellungen` | **0** Zeilen |
| `push_routing` für `release_note` | `push = false` |
| Aktivierte Profile | 26 |
| Admins in `staff_roles` | 2, beide mit Profil und aktiv |
| `release_entry_skips` | 44 Slugs |

Die Quelle des Nachtrags ist `src/content/release-geschichten.ts`: 23
Geschichten, **alle** mit `freigegeben: true`. Ihre Einteilung in sechs
wöchentliche Ausgaben steht in `release-ausgaben.ts`. Die Zuordnung ist
gemessen **1:1 und lückenlos** — 23 Geschichten, 23 Slugs in den Ausgaben,
keine verwaiste Geschichte und kein Slug ohne Geschichte. Die Texte sind 480
bis 1279 Zeichen lang, zusammen 18 891.

## Goals / Non-Goals

**Goals:**

- Jede freigegebene Geschichte steht als Release-Karte in der Aktivität, an
  ihrem Ausgabe-Datum und in der Leseordnung ihrer Ausgabe.
- Der Nachtrag schreibt **0** Zeilen in `notifications` und **0** in
  `push_zustellungen` — und diese Null ist gemessen, nicht behauptet.
- Ein zweiter Lauf erzeugt nichts.
- Der Weg für neue Geschichten bleibt unverändert und wird nachweislich geprüft.

**Non-Goals:**

- Kein Bild auf der Release-Karte. `release_notes` trägt `title` und `body`;
  eine Bildspalte wäre eine neue Fähigkeit.
- Kein Umbau von `send_release_note()`, `hinweis_rundruf()` oder des Auslösers.
- Keine Änderung an `release-geschichten.ts` oder `release-ausgaben.ts`.
- Kein Frontend. Die Karte kann `kind = 'release'` seit AGE-718.
- Nicht die Abschaltung des Blogs — das ist AGE-906.

## Decisions

### 1. Migration mit Datensätzen, nicht einmaliges Admin-Skript

**Entschieden von Donald am 25.09., aus zwei vorgelegten Formen.**

Der tragende Grund ist kein Geschmack, sondern ein Recht: **kein Client kann
`status = 'sent'` schreiben.** `release_notes_admin_edit` trägt
`with check (… and status = 'draft')`, und `service_role` hält auf `public`
keine Tabellenrechte (AGE-312). Ein Skript bräuchte also zuerst eine neue
`security definer`-Funktion — eine dauerhafte API-Fläche, angelegt, um genau
einmal gerufen zu werden, und danach für immer im Schema und im
`grants_test.sql`-Schnappschuss.

Damit kostet der Skript-Weg **trotzdem** eine Migration und fügt einen
Handlauf gegen PROD hinzu, der in keinem Diff steht. Die Migration dagegen
läuft über den gebauten Weg identisch auf lokal, DEV und PROD, ist versioniert,
reviewbar, und ihre Begründung steht in ihrem Kopf, wo dieses Repo
Entscheidungen führt.

*Verworfen — die 23 Texte aus `release-geschichten.ts` zur Laufzeit lesen:*
eine Migration ist SQL und sieht das TypeScript-Modul nicht.

### 2. Der Zustandswechsel, nicht ein zweiter Insert in `posts`

Die Migration legt die Notes als `draft` an und setzt sie in einer zweiten
Anweisung auf `sent`. Der bestehende Auslöser erzeugt daraus die Karten.

*Verworfen — die `posts`-Zeilen direkt einfügen* (wie es §7 der Migration
20260912100000 tut): das schriebe die Insert-Gestalt ein zweites Mal ab —
`visibility`, beide Zeitspalten, `body = ''`, die `on conflict`-Klausel. Zwei
Orte für dieselbe Aussage driften, und die Spec sagt „ausschließlich beim
Übergang" ausdrücklich zu. Der Auslöser ist die Zusage; ihn zu umgehen, um
dasselbe zu tun, wäre der teuerste Weg zum selben Ergebnis.

Der Preis ist ein kurzlebiger Entwurf, der `sent_at` bereits trägt. Das ist
kein Zwischenzustand, den jemand sehen kann: `supabase db push` fährt eine
Migrationsdatei in **einer** Transaktion (Ausnahme wäre nur
`create index concurrently`, das hier nicht vorkommt). Entweder stehen am Ende
23 zugestellte Notes mit 23 Karten, oder gar nichts.

### 3. `sent_at` trägt den Ausgabe-Zeitpunkt, und daraus folgt alles Weitere

Der Auslöser setzt `created_at` **und** `veroeffentlicht_ab` aus
`coalesce(new.sent_at, now())`. Ein zurückdatiertes `sent_at` ist damit der
einzige Hebel, den der Nachtrag braucht — und zugleich die Stelle, an der der
teuerste Befund der AGE-718-Plan-Review hängt: der Feed ordnet über
`veroeffentlicht_ab`, nicht über `created_at`. Wer nur `created_at`
zurückdatiert, bekommt 23 Karten als Block „heute" am Kopf der Aktivität.

### 4. Ausgabe-Datum, 09:00 Europe/Berlin, minutenweise gestaffelt

**Entschieden von Donald am 25.09.**

Das Ausgabe-Datum ist der Tag, an dem die Geschichte den Mitgliedern vorgestellt
wurde. Das Archiv-Datum sagt nur, wann wir etwas gebaut haben — und die beiden
widersprechen sich hier hart: die Ausgabe vom **01.08.** enthält Geschichten mit
den Archiv-Daten 25.08. bis 02.09.

Die Uhrzeit ist gesetzt und nicht gemessen — der Blog kannte nur einen Tag.
09:00 ist als „die Ausgabe erscheint morgens" gewählt und ausdrücklich mit
`+02` geschrieben (CEST gilt für alle sechs Daten), damit die Zeitzone des
Servers nichts entscheidet.

Die Staffelung ist nicht Kosmetik. Der Feed ordnet über
`(veroeffentlicht_ab desc, id desc)`; bei gleichem Zeitstempel entscheidet die
zufällige `id`, und dieselbe Ausgabe stünde auf jedem Bestand anders. Der
Index in `ausgabe.geschichten[]` ist laut Typkommentar die Leseordnung, also:

```
sent_at = <ausgabe.datum> 09:00+02 − (index in ausgabe.geschichten) Minuten
```

Index 0 bekommt damit den jüngsten Zeitstempel und steht innerhalb seiner
Ausgabe oben — wer den Feed von neu nach alt liest, liest die Ausgabe in ihrer
Reihenfolge. Die längste Ausgabe hat fünf Geschichten, die Spanne bleibt also
bei 09:00 bis 08:56 und kollidiert mit keiner Nachbarausgabe (sieben Tage
Abstand).

### 4a. Das Ausgabe-Datum ist redaktionell, und es erscheint an zwei Flächen

Befund des Fremdreviews (codex, MITTEL). `release-ausgaben.ts` sagt über seine
eigenen Daten: „Die Daten sind gesetzt und nicht gemessen. Der Blog beginnt am
1. August 2026 und erscheint wöchentlich. Vor dem Live-Gang gehört entschieden,
ob es dabei bleibt." Der Nachtrag macht aus dieser redaktionellen Einteilung
etwas, das die Anwendung als Tatsache zeigt — an **zwei** Stellen: im Feed als
Zeitpunkt der Karte, und auf `/neues` als Datum der Mitteilung
(`formatDatum(n.sent_at)`, nachgelesen).

**Donald hat das am 25.09. bestätigt:** das Ausgabe-Datum gilt als
Veröffentlichungsdatum, auch dort. Damit ist die Einteilung aus
`release-ausgaben.ts` eingelöst und nicht von einer Migration überholt. Die
Daten werden im Migrationskopf ausdrücklich *redaktionelle Ausgabedaten*
genannt — nicht „Zustellzeitpunkte", denn zugestellt wurde nie etwas.

### 5. Idempotenz an `entry_slugs`, mit dem Riegel am Auslöser dahinter

`release_notes.entry_slugs` führt laut Tabellenkommentar die Verzeichnisnamen
aus `openspec/changes/archive/`, die eine Note abdeckt — und der Slug einer
Geschichte ist laut Typkommentar zeichengleich mit genau diesem
Verzeichnisnamen. Der Nachtrag schreibt je Note **ein** Element und findet sich
daran wieder.

Die Wiederholbarkeit steht damit auf zwei Beinen, und das ist Absicht:

1. `not exists (… where rn.entry_slugs @> array[slug])` vor dem Insert.
2. Der partielle Eindeutigkeitsindex `posts_release_note_id_key`, den der
   Auslöser mit `on conflict … do nothing` bedient.

Das zweite Bein hält auch dann, wenn jemand die Migrationsdatei von Hand ein
zweites Mal fährt, nachdem er die Notes gelöscht und neu angelegt hat.

*Verworfen — ein eigenes Kennzeichen wie `herkunft = 'backfill'`:* eine neue
Spalte auf einer bestehenden Tabelle für eine Unterscheidung, die `entry_slugs`
bereits trägt.

*Verworfen — zusätzlich über `title` prüfen* (Vorschlag gemini, NIEDRIG): ein
zweiter, schwächerer Schlüssel schafft hier ein Problem, statt eines zu lösen.
Ein fremder Entwurf mit zufällig gleichem Titel liesse die Migration eine
Geschichte **stillschweigend überspringen**, und ein übersprungener Nachtrag
sieht von einem gelungenen nicht anders aus. Der Fall, den der Vorschlag meint,
wird von Entscheidung 5a ohnehin erfasst.

### 5a. Das `update` greift nur die eigenen Zeilen — nie einen fremden Entwurf

**Der schwerste Befund des Fremdreviews (codex, HOCH), und er trifft.**

Der erste Entwurf liess Schritt 3 „alle Entwürfe mit einem Slug aus der Liste
der 23" auf `sent` setzen. Zusammen mit dem `not exists`-Wächter aus Schritt 2
ergab das eine Lücke: hätte ein Admin einen eigenen Entwurf zu einer dieser
Geschichten liegen, überspränge ihn der Insert — und die nächste Anweisung
stellte **seinen unfertigen Text** als Karte zu. Auf PROD gibt es heute 0
Entwürfe; auf DEV und lokal ist das nichts, worauf sich eine Migration
verlässt. Der partielle Index auf `posts.release_note_id` hält das nicht auf:
er verhindert zwei Karten zu **einer** Note, nicht zwei Notes zu einem Slug.

Aufgelöst mit einer Unterscheidung, die beide Fälle richtig trifft:

| Lage eines der 23 Slugs | Antwort |
| --- | --- |
| gehört keiner Note | anlegen und zustellen — der Normalfall |
| gehört einer **zugestellten** Note | überspringen, schweigend — das ist die Idempotenz |
| gehört einem **Entwurf**, den diese Migration nicht angelegt hat | `raise exception` — die Lage ist mehrdeutig, und Raten wäre hier eine Veröffentlichung |

Technisch: der Insert gibt seine IDs mit `returning` zurück, und Schritt 3
aktualisiert **diese IDs**, keine Slug-Menge. Die Prüfung auf den fremden
Entwurf steht davor und bricht die Transaktion ab.

### 5b. Der Nachtrag stempelt `angekuendigt_am` auf seinen eigenen Zeilen

Befund des Fremdreviews (gemini, HOCH) — **teilweise** übernommen, und der
Unterschied ist die Stelle.

Der Befund ist richtig: `angekuendigt_am IS NULL` an einem veröffentlichten
Beitrag heisst „noch anzukündigen", und ein Test prüft Verhalten, statt
Zerbrechlichkeit zu beheben. Vorgeschlagen war, `release_feed_post_sync()` den
Stempel setzen zu lassen.

*Nicht übernommen an dieser Stelle:* der Auslöser gehört jeder künftigen echten
Zustellung, nicht nur diesem Nachtrag. Ihn hier umzubauen änderte das Verhalten
von AGE-718 und bräuchte ein Delta auf eine Anforderung, die dieser Change
sonst nicht anfasst. Ein Nachtrag, der im Vorbeigehen einen geteilten Auslöser
verschiebt, ist genau der Diff, den später niemand mehr sauber zurücknimmt.

*Übernommen, wo es hingehört:* die Migration setzt `angekuendigt_am` auf genau
den 23 Zeilen, die sie erzeugt. Unsere Daten stehen damit auf zwei
unabhängigen Beinen — dem `kind = 'member'`-Filter in `beitrag_ankuendigen()`
**und** einem nicht-NULL-Stempel —, ohne fremdes Verhalten zu verschieben.

Für künftige echte Zustellungen bleibt die Zerbrechlichkeit bestehen. Sie ist
heute folgenlos, weil der Filter greift, und steht als Folgepunkt in
`REVIEWS.md` — nicht stillschweigend übergangen.

### 5c. `/neues` lädt nach, und ein Tiefenlink findet auch die 21. Note

Befund des Fremdreviews (codex, HOCH), am Code nachgeprüft und **schlimmer als
gemeldet**. `NeuesPage` ruft `fetchZugestellte()` ohne Argumente, hat kein
Nachladen, und löst `?note=<id>` allein aus der geladenen Liste auf. Bei 23
Notes wären die drei ältesten unsichtbar **und** ihre Feed-Karte trüge einen
Knopf, der nichts öffnet.

Das ist kein Bestandsmangel, den wir vorfinden — bei 0 Notes gab es ihn nicht.
Dieser Change erzeugt ihn. **Donald hat am 25.09. entschieden, ihn hier zu
beheben:** ein Nachladen auf `/neues`, und eine Auflösung von `?note=`, die
eine nicht geladene Note einzeln holt. `fetchZugestellte` trägt `limit` und
`offset` bereits; es ruft sie nur niemand.

*Verworfen — nur den Tiefenlink reparieren:* die drei Knöpfe funktionierten
dann, aber drei zugestellte Notes stünden in keiner Liste. Eine Fläche, die
„alle Neuerungen" heisst und drei davon verschweigt, ist die schlechtere
Hälfte der Reparatur.

### 6. Der Autor wird aufgelöst, und ein fehlender Autor bricht laut ab

`posts.author_id` ist `not null`. Der Auslöser verlässt sich **ohne Insert**,
wenn `coalesce(new.created_by, auth.uid())` leer ist — in einer Migration gibt
es kein `auth.uid()`, also entscheidet allein `created_by`. Eine Migration, die
ihn nicht setzt, erzeugte 23 Notes und **null** Karten, ohne einen Fehler: der
Ausfall sähe von Erfolg nicht zu unterscheiden aus.

Deshalb wird der Autor **vor** dem Zustandswechsel aufgelöst, deterministisch
und portabel:

```sql
select s.profile_id from public.staff_roles s
 where s.role = 'admin' order by s.profile_id limit 1
```

**Korrektur beim Bauen, 25.09.:** „wirft, wenn leer" war zu grob und hätte
`main` rot gemacht. Der CI-Job `migrations` fährt `supabase db reset` gegen eine
frische Datenbank; `supabase/seed.sql` existiert nicht, und Seeds liefen ohnehin
**nach** den Migrationen. Dort gibt es 0 Profile und 0 `staff_roles` — die
Migration wäre bei **jedem** CI-Lauf gescheitert. Aufgefallen ist es, weil der
lokale Stack zufällig ebenfalls keinen Admin trug und der Wächter sofort
zuschlug.

„Kein Admin" ist deshalb keine Lage, sondern zwei, und dieselbe Antwort wäre an
der jeweils anderen Stelle falsch:

| Lage | Antwort | Warum |
| --- | --- | --- |
| **0 Profile** | überspringen, mit `notice` | Frischer Aufbau. Niemand, dem etwas zuzuschreiben wäre; niemand, der die Karten sähe. Es ist nichts zu tun — ein Abbruch liesse jeden Aufbau scheitern. |
| **Profile, aber kein Admin** | `raise exception` | Bestückte Fläche ohne Zuschreibung. Genau hier entstünden 23 Notes ohne eine einzige Karte. |
| **Admin vorhanden** | durchlaufen | Der Normalfall auf lokal, DEV und PROD. |

Beide Grenzfälle sind gefahren, nicht behauptet: mit geleerten `staff_roles` bei
27 Profilen bricht die Migration mit ihrer Meldung ab; mit zusätzlich geleerten
`profiles` läuft sie durch, meldet den Notice und legt `INSERT 0 0` an. Beide
Proben in einer Transaktion mit `rollback`.

Wer die Zeile ist, ist ohne Folge für die
Oberfläche — gemessen, nicht angenommen: `feed.ts` ersetzt den Absender einer
Release-Karte durch `absenderDerAnwendung()` mit dem festen Namen
`eff.bee.zee`, und `ReleaseCard` zeichnet bewusst keinen `Link` auf das Profil.
Der Name des gewählten Admins erscheint nirgends.

### 7. `recipient_count = 0`, nicht NULL

`send_release_note()` zählt die erzeugten Hinweiszeilen. Der Nachtrag erzeugt
keine, also ist 0 die **Messung** und nicht die fehlende Messung. `/neues` und
die Admin-Fläche lesen die Spalte; dort steht dann die Wahrheit.

### 8. Die Texte werden abgeschrieben, und das ist richtig so

Die Migration trägt Titel und Text als SQL-Literale — ein zweites Mal neben
`release-geschichten.ts`. `release-blog` sagt bereits zu: „Eine spätere
Textänderung ändert nichts Zugestelltes." Eine erschienene Karte ist ein
historischer Stand. Ein Wächter, der beide Fassungen gleich hält, würde genau
die Zusage brechen, die hier gilt — deshalb gibt es ihn nicht.

Die Literale werden **erzeugt und nicht getippt**: ein Wegwerf-Schnipsel liest
die beiden Module und schreibt den `values`-Block, damit kein Zeichen und keine
Leerzeile von Hand wandert. Der Schnipsel wird nicht eingecheckt; sein Ergebnis
ist die Migration.

## Risks / Trade-offs

**Ein einziger Filter trennt 0 von 598 Hinweisen** → Beide Wächter sind am
25.09. aus dem PROD-Katalog gelesen, nicht aus Kommentaren geschlossen.
`hinweis_neuer_beitrag()` verlässt sich bei `new.kind is distinct from
'member'` sofort — **stempelt dabei aber `angekuendigt_am` nicht**, denn das
`update` steht im Mitglieds-Zweig darunter. Die 23 Release-Zeilen bleiben also
dauerhaft `angekuendigt_am IS NULL` und sähen für einen Nachlauf ohne Art-Filter
wie 23 unangekündigte Beiträge aus. Dass daraus nichts wird, hält allein
`where p.kind = 'member'` in `beitrag_ankuendigen()`. 23 Karten × 26 aktivierte
Profile = 598 Hinweise stünden dahinter. **Mitigation:** eine pgTAP-Zusage, die
`beitrag_ankuendigen()` nach einem Nachtrag laufen lässt und 0 neue
`notifications` verlangt — der Wächter wird an seiner Wirkung festgenagelt,
nicht an seinem Wortlaut.

**Die Aktivität besteht danach zu 58 % aus Release-Karten** (23 von 40) → Das
ist eine Folge der Datenlage, keine Panne. Die sechs Ausgabe-Daten liegen
zwischen 01.08. und 05.09., der älteste Bestandsbeitrag stammt vom 17.08.: die
Karten sammeln sich unten und verdrängen oben nichts. **Mitigation:** in der
Sichtprobe wird der Feed von oben durchgeblättert und festgehalten, wie weit
man scrollt, bevor die erste Release-Karte kommt.

**Die Karte zeigt den vollen Text ohne Kürzung** (`whitespace-pre-line`, kein
„mehr anzeigen") → 23 Karten zu 480–1279 Zeichen machen die Aktivität lang.
Bewusst nicht behoben: eine Kürzungsmechanik wäre eine neue Fähigkeit für alle
Release-Karten und gehört nicht in einen Nachtrag. **Als Folgepunkt notiert,
nicht als Diff.**

**Drei nachgetragene Slugs stehen zugleich in `release_entry_skips`**
(`2026-08-25-activity-concept-level`, `…-profil-biete-suche-und-radar`,
`…-stille-fehlschlaege-und-anfragen-weg`) → `teileAuf()` prüft „zugestellt"
**vor** „nicht relevant"; sie erscheinen als zugestellt, einmal, ohne
Widerspruch. Gelesen, nicht vermutet. Kein Eingriff.

**Eine Umgebung ohne Admin bekäme 23 Notes ohne Karten** → Der laute Abbruch
aus Entscheidung 6. Eine frische lokale Datenbank ohne Seed ist genau dieser
Fall, und sie soll scheitern, nicht schweigen.

**Ein Entwurf eines Admins könnte vom `update` mitgerissen werden** → Die
zweite Anweisung greift nicht „alle Entwürfe", sondern nur Zeilen, deren
`entry_slugs` genau einen Eintrag hat und dieser in der Liste der 23 steht. Auf
PROD gibt es heute 0 Entwürfe; auf DEV und lokal ist das nicht zugesichert.

**Die Migration ist forward-only und schreibt Daten** → Ein Rückweg ist kein
`down`-Skript, sondern ein `delete` auf `release_notes` über dieselben 23
Slugs; `posts_release_note_id_fkey` trägt `on delete cascade` und nimmt die
Karten mit. Das steht als Rezept im Kopf der Migration, wird aber nicht als
Datei mitgeliefert — eine ungefahrene Rückwärts-Migration ist eine Behauptung.

## Migration Plan

1. Lokal gegen den geteilten Stack: Zählen vor dem Lauf, Migration fahren,
   Zählen danach, zweiter Lauf, wieder zählen. Zahlen sofort protokollieren
   (der Stack ist geteilt).
2. pgTAP-Suite ergänzen **und in die Dateiliste in `ci.yml` eintragen** — eine
   nicht eingetragene Suite läuft nie, und `scripts/pgtap-dateiliste.test.ts`
   ist der Wächter, der das rot macht.
3. PR gegen `main`, CI grün, Merge.
4. PROD-Migration **nach** dem Merge von `main` aus — vom Feature-Branch ist
   sie unmöglich. Das sind zwei Schritte, nicht einer.
5. Abnahme lesend gegen PROD mit demselben Messskript wie die Vormessung —
   **unmittelbar vor und unmittelbar nach** dem Deploy, und geprüft wird die
   **Differenz**, nicht der absolute Stand (Befund codex, MITTEL): absolute
   Zielzahlen setzten voraus, dass zwischen dem 25.09. und dem Deploy niemand
   einen Beitrag schreibt. Ein legitimer neuer Beitrag liesse die Abnahme
   scheitern; zwei gegenläufige Schreibvorgänge verdeckten eine Regression.
   Gefordert: `Δ notifications = 0`, `Δ push_zustellungen = 0`, und genau 23
   neue `posts` mit `kind = 'release'`, an ihren Slugs identifiziert. Die
   absoluten Zahlen bleiben als Beleg im Protokoll.

## Open Questions

Keine offenen Entscheidungen. Die beiden, die es gab — Weg und Datum —, hat
Donald am 25.09. entschieden und sie stehen als Entscheidung 1 und 4.
