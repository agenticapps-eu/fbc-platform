## Context

AGE-718, der Nachzügler aus AGE-705. Gemessen am 11.09. auf `bee23b2`.

**Der Zustellweg ist vollständig gebaut** und wird hier nicht angefasst:

```
release_notes ──send_release_note()──> hinweis_rundruf ──> Glocke ──> /neues ──> Modal
   (AGE-631)          (der Riegel)         (AGE-620)                  (AGE-632)
```

Was fehlt, ist ein zweiter Ausgang aus `release_notes` — in die Aktivität.

**Die Fläche, in die hineingebaut wird, ist eng beschrieben.** `posts` trägt
seit AGE-533 eine zweite Beitragsart, und die dort getroffenen Entscheidungen
sind die Vorlage für die dritte: der Event-Beitrag speichert **keinen**
Event-Inhalt (`body = ''`, Join zur Laufzeit), sein Zeitstempel stammt vom
Anlass, und er ist systemverwaltet — `posts_write_own` lässt Mitgliedern nur
`kind = 'member'`.

**Drei Randbedingungen, die den Entwurf tatsächlich einengen:**

1. `posts.ref_id` trägt einen Fremdschlüssel auf `public.events`. Eine dritte
   Art kann die Spalte nicht mitbenutzen, ohne die Integritätszusage
   aufzugeben.
2. `posts.author_id` ist `not null`; `release_notes.created_by` ist nullable
   (`on delete set null`). Ein Trigger, der blind `created_by` überträgt, könnte
   also am `not null` scheitern.
3. Der Feed paginiert per Keyset über `(veroeffentlicht_ab, id)` mit
   `FEED_SEITE = 20`. Jede Lösung, die zwei Tabellen erst im Client
   zusammenführt, muss diesen Cursor über zwei verschiedene Schlüsselräume
   führen.

## Goals / Non-Goals

**Goals:**

- Eine zugestellte Release-Note erscheint als Karte in der Aktivität,
  chronologisch zwischen den Beiträgen.
- Der Feed bleibt **eine** Abfrage, ein Cursor, eine Sortierung.
- Kein zweites Exemplar des Mitteilungstextes.
- Die Karte nennt keinen Autor.
- Bereits zugestellte Notes erscheinen rückwirkend, an ihrem eigenen Datum.

**Non-Goals:**

- **Kein Opt-out** für Release-Karten. Die bestehende Begründung trägt
  unverändert: die vier Schalter schützen vor dem Lärm anderer Mitglieder, eine
  Mitteilung über das Werkzeug selbst ist etwas anderes.
- **Keine Änderung an `/neues`, am Modal, an der Glocke** oder am öffentlichen
  Blog.
- **Keine Änderung an der Admin-Fläche.** Wer zustellt, tut es wie bisher.
- **Kein Eingriff in `notifications`-Anforderungen** — siehe Entscheidung 5.
- **Kein Befüllen.** Der Change liefert die Fläche, nicht ihren Inhalt
  (Donald, 11.09.). Siehe Entscheidung 7 — das ist der Punkt, an dem die Abnahme
  anders aussieht als sonst.

## Decisions

### 1. Eine dritte `kind` statt Mischen im Client oder Systemkonto

**Gewählt:** `kind = 'release'` auf `posts`, mit eigener Spalte.

*Verworfen — die zwei Quellen erst im Client mischen:* keine Migration, aber der
Keyset-Cursor müsste über `posts.veroeffentlicht_ab` **und**
`release_notes.sent_at` gleichzeitig laufen. Zwei Schlüsselräume in einem Cursor
überspringen Einträge, und zwar **still**: die Seite ist voll, die Liste sieht
vollständig aus, und der fehlende Beitrag fällt niemandem auf. Der Feed hat
genau dafür schon eine Warnung im Code — der Cursor trägt `likeCount` bewusst
nur in der Ordnung, in der es führt, „ein Cursor, der Felder einer FREMDEN
Ordnung trägt, sähe gültig aus".

*Verworfen — ein Systemkonto schreibt gewöhnliche Beiträge:* `profiles.id` ist
ein Fremdschlüssel auf `auth.users.id`. Ein Systemkonto wäre damit ein **echtes
Konto** und erschiene im Verzeichnis, in der Mitgliederliste, im Matching und
als möglicher Empfänger von Kontaktanfragen. Jede dieser Flächen bräuchte eine
Ausnahme, und jede vergessene Ausnahme wäre ein sichtbarer Fehler. Der Aufwand
läge weit außerhalb der Aktivität — für einen Entwurf, der im Feed exakt dasselbe
leistet.

### 2. Eine eigene Spalte `release_note_id`, nicht `ref_id`

`ref_id` trägt `posts_ref_id_fkey` auf `public.events`. Sie für ein zweites Ziel
mitzubenutzen hieße, den Fremdschlüssel zu entfernen und die Integrität in einen
CHECK oder einen Trigger zu verlagern — also eine geprüfte Zusage gegen eine
nachgebaute zu tauschen.

Der Preis ist eine Spalte, die bei zwei von drei Arten leer ist. Das ist bereits
der Zustand von `ref_id` und im Bestand ausdrücklich akzeptiert: „`ref_id` ist
außerhalb von `kind = 'event'` leer."

Der `posts_kind_ref_id_check` wird dreifach. Er ist die Stelle, an der die
Invariante vollständig ausgesprochen steht, statt sich auf die Schreibwege zu
verlassen.

### 3. Der Trigger hängt am Zustandswechsel, nicht am Insert

Der Beitrag entsteht `after update of status on release_notes`, wenn
`old.status = 'draft'` und `new.status = 'sent'`.

**Warum das der richtige Aufhänger ist:** die UPDATE-Policy auf `release_notes`
trägt `with check (… and status = 'draft')`. Ein Client kann `status` also
niemals auf `sent` setzen; das kann allein `send_release_note()`, und die
Funktion prüft `is_admin()` und führt den Wechsel **bedingt** aus
(`where id = p_id and status = 'draft'`). Der Riegel gegen die Doppelzustellung
schützt damit ohne Zutun auch den Feed-Beitrag: trifft das `update` nichts,
feuert der Trigger nicht.

Das ist der Grund, aus dem der Beitrag **nicht** im Rumpf von
`send_release_note()` eingefügt wird: als Trigger gilt die Regel für jeden Weg
zu `status = 'sent'`, auch für einen künftigen zweiten. Im Funktionsrumpf gälte
sie nur für diesen einen Aufrufer.

**`author_id` im Trigger:** `coalesce(new.created_by, auth.uid())`. Beim Versand
über die Funktion ist `auth.uid()` immer belegt und immer ein Admin — die
Funktion hat `is_admin()` bereits erzwungen. `created_by` steht zuerst, weil es
die genauere Aussage ist, solange es existiert. Sind **beide** leer, entsteht
kein Beitrag, statt die Zustellung mit einem rohen `not null`-Fehler scheitern
zu lassen; der Event-Trigger behandelt seinen fehlenden Autor genauso („Kein
Host, kein Beitrag").

### 4. `body` bleibt leer, der Text kommt aus dem Join

Übernommen vom Event-Beitrag, aus demselben Grund: „Inhalt wird gelesen und
veraltet still." Eine Kopie des Mitteilungstextes in `posts` liefe auseinander,
sobald jemand eine zugestellte Note nachbessert — und die Policy lässt das
ausdrücklich zu, solange sie Entwurf ist.

Folge für die Oberfläche: die SELECT-Listen in `feed.ts` brauchen einen zweiten
benannten Einbettungs-Join, und **jede** Ansicht, die `posts` liest, muss die
dritte Art kennen. Die bestehende Anforderung sagt das bereits generisch; die
Messung zeigt, dass `dashboard.ts` und `public-profile.ts` schon auf
`kind = 'member'` filtern und deshalb unberührt bleiben.

### 5. `notifications` wird nicht angefasst — und das ist eine Entscheidung

Die naheliegende Stelle für „eine Release-Note erscheint auch im Feed" wäre die
Capability `notifications`. Sie wird **bewusst** gemieden.

Der aktive Change `push-fundament` hält dort einen `MODIFIED`-Block auf
*„Eine Release-Note erreicht jedes aktivierte Mitglied ohne Abbestellung"*.
Änderten beide Changes dieselbe Anforderung, wäre der zweite nicht mehr
archivierbar — wer zuerst archiviert, faltet eine Fassung, die die andere nicht
kennt.

Das ist hier kein Kunstgriff, sondern trifft die Sache: die Anforderungen in
`notifications` beschreiben die **`notifications`-Zeilen** und die Fläche
`/neues`. Dieser Change erzeugt eine **`posts`-Zeile** und fügt eine **zweite**
Fläche hinzu. Beide bestehenden Anforderungen bleiben unverändert wahr.

### 6. Ein synthetischer Absender statt eines nullable `author_id`

`author_id` nullable zu machen berührte 86 Zeilen in den Migrationen und jede
Policy, die Autorschaft prüft — auf `posts` **und** auf `comments`, das dieselbe
Spalte trägt. Eine davon zu übersehen hieße, ein Gate zu öffnen.

Stattdessen bleibt die Spalte, wie sie ist, und die Verengung an der Grenze in
`feed.ts` liefert für `kind = 'release'` einen festen Absender — genau das, was
`ehemaligesMitglied()` dort seit AGE-644 für Beiträge entfernter Mitglieder tut.
Ein bestehendes Muster, kein neues.

**Der Absender heißt `eff.bee.zee`** (Donald, 11.09.). Die Anwendung spricht
unter ihrem eigenen Namen, statt eine Rubrik zu nennen — die Karte steht
zwischen Beiträgen von Menschen, und dort liest sich ein Name als Absender,
während „Neu in der App" wie eine Überschrift wirkte. Die Schreibweise mit
Punkten ist die der Marke und bleibt unverändert.

## Risks / Trade-offs

**Die stille Verengung an der Grenze** → `feed.ts` mappt heute jede unbekannte
Art auf `member`. Das ist der Fehler, der beim Ausrollen **nicht auffiele**: die
Karte erschiene als Mitgliedsbeitrag mit leerem Text und dem Namen des Admins.
Mitigation: der Test für diese Stelle wird **zuerst** geschrieben und muss rot
sein, bevor die Migration existiert.

**Der Typ-Filter „Text"** → als `kind.neq.event` definiert, fängt er einen
Release-Beitrag mit ein. Mitigation: eigener Test, und der Filter nennt künftig
die gemeinten Arten, statt eine zu verneinen.

**Der Backfill verschiebt den Feed** → jede bereits zugestellte Note erscheint
rückwirkend. Steht ihr Datum dicht beieinander, rücken mehrere Karten auf einmal
in dieselbe Feed-Seite. Mitigation: vor der Migration die Zahl der zugestellten
Notes auf PROD **messen** und als Sollwert festhalten, wie es der Event-Backfill
vorgemacht hat („9 Events, davon 0 ohne Host … der Sollwert ist also 9").

**`grants_test` bricht** → der Golden-Snapshot erfasst jede neue Spalte.
Mitigation: bekannt, wird mitgezogen; kein Überraschungsfall.

**Eine zugestellte Note bleibt änderbar** → die UPDATE-Policy erlaubt Admins das
Bearbeiten nur im Zustand `draft`, also ist der Text nach dem Versand fest. Die
Zusage „eine geänderte Mitteilung zeigt sich sofort" im Spec-Delta beschreibt
damit die Mechanik des Joins, nicht einen offenen Weg. Kein Risiko, aber der
Satz darf nicht als Erlaubnis gelesen werden.

## Migration Plan

Forward-only, eine Datei, in dieser Reihenfolge:

1. `alter table public.posts add column release_note_id uuid` + benannter FK auf
   `public.release_notes (id) on delete cascade`.
2. `kind`-CHECK auf `('member', 'event', 'release')` erweitern.
3. `posts_kind_ref_id_check` ersetzen — dreifach, beide Bezugsspalten.
4. Partieller Unique-Index auf `release_note_id where kind = 'release'`.
5. Trigger-Funktion + `after update of status on release_notes`. Die Funktion
   ist `security definer` mit `set search_path = ''`, und das Ausführungsrecht
   wird `public`, `anon` und `authenticated` entzogen — wie bei
   `event_feed_post_sync()`. **Als `invoker` scheiterte ihr Insert an
   `posts_write_own`** (`with check … kind = 'member'`), und weil ein
   Trigger-Fehler das umgebende `update` zurückrollt, erreichte die Mitteilung
   dann nie `sent`: aus einer fehlenden Feed-Karte würde eine fehlgeschlagene
   Zustellung.
6. Der Insert setzt **`created_at`, `veroeffentlicht_ab` und `visibility`
   ausdrücklich** — `sent_at`, `sent_at`, `'members'`.
7. Backfill aus `release_notes where status = 'sent'`, dieselben drei Spalten
   ausdrücklich, mit `not exists`-Wächter.
8. `grants_test`-Snapshot nachziehen.

**Zu Schritt 6 und 7, weil es der teuerste Befund der Plan-Review war
(opencode, HOCH):** der Feed ordnet und blättert über **`veroeffentlicht_ab`**,
nicht über `created_at` — und die Spalte trägt `default now()`. Der erste
Entwurf dieses Plans setzte nur `created_at`, weil er sich am Event-Backfill
orientierte. Der ist von **vor** dieser Spalte: sie kam später und wurde für die
damaligen Zeilen einmalig per `update` nachgezogen. Für neue Zeilen gibt es
diesen Nachzug nicht. Der Plan hätte also exakt den Fehler erzeugt, den sein
eigenes Spec-Delta ausschliesst — alle nachgetragenen Karten oben im Feed.

**Die Lehre dahinter ist allgemeiner als der Fall:** eine Vorlage aus dem
Bestand ist an ihrem eigenen Datum richtig, nicht am heutigen. Wer sie kopiert,
erbt ihre Annahmen über das Schema von damals.

**Rollback:** Die Migration ist additiv — keine Spalte fällt, keine Policy wird
enger. Ein Rückbau bestünde darin, den Trigger zu entfernen und die
Release-Zeilen zu löschen; die Mitteilungen selbst blieben über `/neues`
erreichbar. Weil der Weg auf PROD über `db push` läuft und die Datei in einer
Transaktion fährt, ist ein halb angewandter Zustand nicht zu erwarten.

**Reihenfolge gegenüber dem Deploy — und warum sie NICHT von allein stimmt.**

Die erste Fassung dieses Abschnitts sagte „die Migration muss vor dem Frontend
liegen" und ließ offen, wer das sicherstellt. Gemessen am 11.09. stellt es
niemand sicher, und die Voreinstellung ist die **falsche** Reihenfolge:

| Weg | Auslöser |
| --- | --- |
| `deploy.yml` (Frontend) | `on: push: branches: [main]` — **automatisch beim Merge** |
| `migrate-prod.yml` (Schema) | `on: workflow_dispatch` — **nur von Hand**, mit Freigabe |

Ein gewöhnlicher Merge rollt also das Frontend aus, während PROD die Spalte noch
nicht hat. Und die Folge ist **kein kosmetischer Fehler**: `fetchFeed` fragt
`release_note_id` samt benanntem Einbettungs-Join ab. Fehlt beides, antwortet
PostgREST mit einem Schema-Fehler auf die **ganze** Abfrage — die Aktivität lädt
dann gar nicht mehr, nicht etwa ohne Release-Karten.

**Deshalb ist die Reihenfolge ein Arbeitsschritt, kein Hinweis:** die Migration
läuft **vor dem Merge**, per `workflow_dispatch` auf den Feature-Branch. Der
Workflow ist an keinen Ref gebunden, das ist also möglich und braucht nur die
Freigabe, die er ohnehin verlangt.

Der umgekehrte Zustand — Migration da, Frontend noch alt — ist dagegen **kein
technischer Fehler, aber auch nicht ohne Bedingung** (Präzisierung nach einem
Befund der Plan-Review, opencode NIEDRIG): das alte Frontend verengt eine
unbekannte Art still auf `member` und zeigte eine leere Karte mit Name und
Avatar des Admins — dasselbe Fehlerbild, vor dem dieser Change warnt.

Dass das folgenlos bleibt, hängt an **einer Absprache, nicht an einem Riegel**:
zwischen der PROD-Migration und dem Merge darf niemand zustellen. Heute ist das
gefahrlos, weil `release_notes` leer ist und nur ein Admin von Hand zustellt —
aber es ist eine Betriebszusage, und sie steht hier, damit sie nicht für eine
technische Garantie gehalten wird.

### 9. Systeminhalte in Rangzahlen — hingenommen, nicht übersehen

Befund der Plan-Review (opencode, NIEDRIG), am Repo geprüft: das Aggregat
„Aktivste Mitglieder" zählt ausdrücklich **alle** Beitragsarten je Autor, und
der Reiter „Beiträge von mir" filtert allein über `author_id`. Beides trüge
damit die Release-Karten des zustellenden Admins bei.

**Hingenommen**, mit Begründung: es ist eine Karte je Woche, der Effekt auf eine
Rangliste ist nicht messbar, und jede Gegenmaßnahme berührte Flächen, die dieser
Change sonst nicht anfasst (`feed_sidebar_aggregate`, der Reiter, und die
Punkteberechnung). Die Regel „Touch only what you must" wiegt hier schwerer als
eine Verzerrung, die man erst konstruieren muss, um sie zu sehen.

Festgehalten, damit ein späterer Leser den Befund nicht für übersehen hält.
Zeigt sich der Effekt doch, ist die Stelle bekannt und die Änderung klein.

*Woher der Befund kam:* die Plan-Review (gemini, MITTEL) hat die Reihenfolge
angegriffen — mit einer anderen Begründung als der hier stehenden und mit dem
umgekehrten Vorschlag. Das Nachmessen an den Workflow-Dateien gab ihm im
Ergebnis recht und dem Entwurf unrecht.

### 7. Der Bestand ist leer — die Fläche wird trotzdem zuerst gebaut

**Gemessen am 11.09.**, lesend gegen beide Umgebungen, an getrennten Hosts
(`aws-0` und `aws-1`) mit erkennbar verschiedenen Datenständen:

| | `release_notes` gesamt | zugestellt | Entwürfe | `posts.kind` |
| --- | --- | --- | --- | --- |
| **PROD** | 0 | 0 | 0 | `member` 8, `event` 3 |
| **DEV** | 0 | 0 | 0 | `member` 21, `event` 8 |

Der Zustellmechanismus aus AGE-631/632 ist vollständig gebaut und **nie benutzt
worden**. Daraus folgen drei Dinge, die den Zuschnitt betreffen:

1. **Der Backfill hat nichts zu tun.** Sein Sollwert ist `0` — auf beiden
   Umgebungen. Er bleibt trotzdem in der Migration: er ist die Zusage für den
   Fall, dass zwischen Schreiben und Anwenden zugestellt wird, und ohne ihn
   entstünde genau dann eine Note ohne Karte.
2. **Die Fläche ist nach dem Ausrollen leer**, bis jemand zustellt. Das ist
   entschieden (Donald, 11.09.: „nur die Karte, Befüllen später") und kein
   Versehen.
3. **Die Abnahme kann nicht auf PROD stattfinden.** Es gibt dort nichts zu
   sehen, und ein leerer Feed belegt weder Erfolg noch Fehler. Die Sichtprobe
   läuft deshalb gegen den lokalen Stack mit einer selbst zugestellten Note —
   und nur dort ist auch der Trigger wirklich beobachtbar.

Der Reihenfolge-Einwand („erst Inhalt, dann Fläche") trägt hier nicht: ohne
`kind = 'release'` kann eine Zustellung gar keinen Feed-Beitrag erzeugen, und
eine nachträglich zugestellte Note bekäme ihre Karte nur über einen zweiten
Backfill. Die Fläche zuerst zu bauen ist die Reihenfolge, die keinen Nacharbeit
erzeugt.

### 8. Die Release-Karte behält ihren Interaktionsbereich

**Entschieden (Donald, 11.09.), gegen den Vorschlag dieses Dokuments.** Der
Entwurf sah vor, Likes und Kommentare an der Release-Karte auszublenden — mit
dem Argument, eine Mitteilung der Anwendung sei kein Gesprächsanlass und ein
Kommentar habe keinen Adressaten.

Die getroffene Entscheidung ist die andere: der Interaktionsbereich **bleibt**.
Ein Mitglied kann auf eine Neuerung reagieren und darunter fragen.

**Was daraus folgt, und zwar ohne Zutun:** die Release-Zeile ist eine echte
`posts`-Zeile, `post_likes` und `comments` hängen an `post_id` und an der
Sichtbarkeit des Beitrags, nicht an seiner Art. Es ist also **keine Zeile Code**
nötig, damit das funktioniert — es funktionierte, sobald die Karte den geteilten
Interaktionsbereich verwendet, den die Anforderung für die Event-Karte ohnehin
verlangt („geteilt und NOT kopiert").

**Was es kostet:** ein Kommentar an einer Release-Karte erwartet eine Antwort,
und es gibt keinen zuständigen Absender. Das ist eine Betriebsfrage, keine
technische — sie gehört beobachtet, nicht gelöst. Festgehalten, damit später
niemand den fehlenden Antwortweg für einen Fehler hält.

**Und es kostet mehr, als dieser Absatz zunächst behauptete** — Befund der
Plan-Review (gemini, HOCH), am Repo bestätigt:

`hinweis_auf_meinem_beitrag()` hängt an `comments` **und** an `post_likes`,
liest `posts.author_id` und kennt **keine** Beitragsart. Ohne Zutun bekäme also
der zustellende Admin je Reaktion und je Kommentar eine Benachrichtigung. Eine
Release-Note erreicht jedes aktivierte Mitglied; die Summe aller Reaktionen
träfe damit **eine einzelne Person**, die nichts geschrieben hat.

Das ist die eigentliche Lehre dieses Punktes: **Entscheidung 6 und Entscheidung
8 sind einzeln harmlos und zusammen ein Fehler.** Keine der beiden Fragen, so
wie sie gestellt wurde, hätte ihn sichtbar gemacht — er entsteht aus dem
Produkt, nicht aus den Faktoren. Der Auslöser überspringt deshalb künftig
`kind = 'release'`.

**Die Gegenprobe an der Nachbarstelle fiel anders aus, und das ist kein Zufall:**
`hinweis_neuer_beitrag()` prüft `if new.kind is distinct from 'member'` und
lässt jede andere Art aus — auch eine, die es beim Schreiben dieser Zeile nicht
gab. Dieselbe Prüfung hätte man als `kind = 'event'` schreiben können; dann
kündigte jede Zustellung heute **zweimal** an. Es ist genau der Unterschied
zwischen einer positiv und einer negativ formulierten Bedingung — und der
Filter für Textbeiträge in `feed.ts` (`kind.neq.event`) ist die negative
Variante, die deshalb bricht.

### 11. „Bild" und „Video" nennen die Art nicht — hingenommen, nicht übersehen

**Befund des Diff-Reviews (opencode, NIEDRIG), geprüft und begründet abgelehnt.**

Der Einwand ist formal richtig: `bild` (`post_media.not.is.null`) und `video`
(`video_url.not.is.null`) nennen `kind` nicht. Sie schließen Release-Karten nur
deshalb aus, weil der Auslöser beide Felder leer lässt — nicht, weil der
Ausdruck es sagt. Bei „Text" war genau das der Fehler, der behoben wurde.

**Der Unterschied ist die Richtung.** `kind.neq.event` **schloss eine
Release-Karte aktiv EIN**: sie erfüllte die Bedingung. `post_media.not.is.null`
schließt sie aus, und zwar über zwei Wege, die beide erzwungen sind:

| Feld | Was es schließt |
| --- | --- |
| `post_media` | `post_media_insert_own` verlangt `p.kind = 'member'` (AGE-533) |
| `video_url` | `posts_video_url_setzen()` rechnet den Wert bei JEDEM Schreiben aus `body`, und der ist leer |

Ein Client kann `video_url` nicht setzen — der Trigger überschreibt es
ausnahmslos. Und eine `post_media`-Zeile an einem Release-Beitrag weist die
Policy ab. Es bleibt der Eigentümer mit SQL-Zugang, und für den gilt dasselbe
wie für jede andere Invariante dieses Schemas.

**Gewählt:** die zwei Ausdrücke bleiben, wie sie sind. Sie um `kind` zu
ergänzen hieße, dieselbe Zusage an einer dritten und vierten Stelle zu
wiederholen, die jede künftige Art mitpflegen müsste — genau die Zerbrechlichkeit,
die der Kommentar über `TYP_AUSDRUCK` schon einmal benennt.

## Open Questions

Keine offenen. Die beiden Fragen dieses Dokuments — Interaktionsbereich und
Wortlaut des Absenders — sind am 11.09. entschieden worden und stehen als
Entscheidung 8 bzw. in Entscheidung 6.

### 10. Die volle Typauswahl bleibt die Abwesenheit des Filters

**Entschieden (Donald, 11.09.), nachdem das Spec-Delta beim Lesen einen
Widerspruch zeigte** — gefunden vor der ersten Codezeile, also an der billigsten
Stelle.

Der Entwurf verlangte drei Dinge zugleich:

1. Alle vier Haken tragen **denselben Cache-Schlüssel** wie kein Haken.
2. Sobald **irgendein** Typ angehakt ist, fehlen die Release-Karten.
3. Ohne Haken erscheinen sie.

Derselbe Schlüssel heißt dieselbe Abfrage und damit dieselben Zeilen. (1) und
(2) schließen einander aus, sobald (3) gilt. `normalisierteTypen` bildet die
volle Menge seit AGE-590 ausdrücklich auf die leere ab, und der Kommentar dort
nennt auch den Grund: „sonst stuenden zwei Schluessel fuer ein Ergebnis, und der
Feed laedt dieselbe Auswahl ein zweites Mal."

**Gewählt:** die Zusammenlegung bleibt. Vier Haken sind buchstäblich kein
Filter, und Release-Karten erscheinen dort wie im Zustand ohne Haken. Die Regel
„ein Haken, keine Release-Karten" trägt die volle Auswahl als **benannte**
Ausnahme.

*Verworfen — die Zusammenlegung fallen lassen:* dann erzeugten vier Haken eine
echte Typgruppe, die Release-Karten ausschlösse, und die Regel wäre
ausnahmslos. Der Preis wäre ein zweiter Cache-Schlüssel für ein Ergebnis, das
sich nur in einer Karte je Woche unterscheidet — also genau der Nachladefehler,
den AGE-590 eigens beseitigt hat, eingetauscht gegen sprachliche Sauberkeit.

**Was daran allgemein ist:** ein Delta kann schema-gültig sein und trotzdem
Unerfüllbares verlangen. `openspec validate` prüft die Form, und beide
Plan-Reviews haben den Widerspruch nicht gesehen — er entsteht erst, wenn man
die geänderte Anforderung gegen den **Bestandscode** hält, den sie nicht nennt.
