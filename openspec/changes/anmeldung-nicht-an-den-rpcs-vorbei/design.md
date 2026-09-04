## Context

Zwei Regeln der Event-Anmeldung stehen ausschliesslich in `SECURITY DEFINER`-RPCs,
und daneben liegt ein Weg, der nicht durch sie führt. Der Befund ist in
`proposal.md` ausgeschrieben; hier steht, was daran gemessen ist und wie der
Eingriff aussieht.

### Gemessener Bestand (2026-09-04, lokaler Stack, rein lesend)

| Was | Befund | Wie gemessen |
|---|---|---|
| `register_for_event` | `prosecdef = t`, Eigentümer **`postgres`** | `pg_proc` join `pg_namespace` |
| `set_event_check_in` | `prosecdef = t`, Eigentümer **`postgres`** | dieselbe Abfrage |
| Rechte von `authenticated` auf `event_registrations` | **tabellenweit** INSERT, SELECT, UPDATE — daher erscheint jede Spalte einzeln, `checked_in` eingeschlossen | `information_schema.column_privileges` |
| Direkte Schreibzugriffe im Client | genau **zwei**: `status → 'cancelled'` (`events.ts:620`) und `rating` (`events.ts:639`) | `grep from("event_registrations")` über `src/`, ohne Testdateien |
| Direkter INSERT im Client | **keiner** | dieselbe Suche |
| Direktes Schreiben von `checked_in` im Client | **keines** | dieselbe Suche |
| Constraints auf der Tabelle | nur `unique (event_id, profile_id)` und der `check` auf `status` | `20260612075901:65-75` |

**Die Kapazität ist an keiner Stelle der Tabelle festgeschrieben.** Sie existiert
als Spalte `events.capacity` und wird ausschliesslich in `register_for_event`
ausgewertet.

**`register_for_event` ist ein UPSERT, und das ist entscheidend** (Befund aus der
Planungs-Review, codex HIGH; am Rumpf nachgeprüft, `20260806080100:612-615`):

```sql
insert into public.event_registrations (event_id, profile_id, status)
values (p_event_id, v_uid, v_status)
on conflict (event_id, profile_id)
  do update set status = excluded.status;
```

Eine Wiederanmeldung nach dem Absagen — und jede Bewegung von `waitlist` nach
`registered` über den regulären Weg — läuft damit über den **UPDATE**-Zweig,
also genau dort, wo ein neuer Trigger feuert. Ein Trigger, der diesen Weg
mitsperrt, bräche die Wiederanmeldung, während eine Positivkontrolle, die nur
den INSERT-Zweig prüft, grün bliebe.

### Was daraus folgt

`regs_write_own` ist `for all to authenticated` und prüft in `with check` nur
aktiviert / eigene Zeile / Stufe ≥ 4 / Event existiert. Damit sind offen:

1. **INSERT mit `status = 'registered'`** — zählt niemand, sperrt niemand.
2. **UPDATE `waitlist → registered`** — dasselbe Ergebnis über den anderen Weg.
3. **UPDATE `checked_in = true`** — der Anwesenheitsstatus, den `set_event_check_in`
   dem Host vorbehält.
4. **UPDATE des `event_id`** — die eigene, bereits `registered` gesetzte Zeile auf
   ein anderes, volles Event umhängen. Der Status bleibt dabei `registered`, eine
   Übergangsregel sähe also nichts. Vierter Weg, gefunden in der Planungs-Review
   (codex, MEDIUM). Die Spaltenrechte schliessen ihn nebenbei mit — aber „nebenbei"
   ist keine Zusage, deshalb bekommt er eine eigene Probe.

## Goals / Non-Goals

**Goals:**

- Die beiden Regeln gelten **unabhängig vom benutzten Weg**, nicht nur auf dem
  vorgesehenen.
- Die zwei legitimen Schreibzugriffe des Clients (`cancelled`, `rating`) bleiben
  unverändert erlaubt.
- Die RPCs bleiben Wort für Wort, wie sie sind.
- Jede Zusage ist mit einer **Verbiegung** belegt, nicht mit dem Vorhandensein
  einer Policy.

**Non-Goals:**

- Kein Umbau der RPCs, keine Änderung an der Oberfläche.
- Keine Warteliste-Mechanik (Nachrücken beim Absagen).
- Keine Bereinigung bestehender Zeilen — dieser Change verhindert neue.

## Decisions

### D1 — `checked_in` wird über SPALTENRECHTE entzogen, nicht über eine Policy-Bedingung

**Gewählt:** `revoke update on public.event_registrations from authenticated;`
gefolgt von `grant update (status, rating) on public.event_registrations to
authenticated;`

Ein Spaltenrecht ist eine **Aussage über die Spalte**, keine Bedingung in einem
Ausdruck, den jemand später lockern kann. Es wirkt zusätzlich zur Policy, nicht
statt ihrer: wer `regs_write_own` eines Tages weiter fasst, öffnet `checked_in`
damit trotzdem nicht.

**Die RPC ist davon nicht betroffen, und das ist gemessen:** `set_event_check_in`
ist `SECURITY DEFINER` mit Eigentümer `postgres`, läuft also mit dessen Rechten
und nicht mit denen von `authenticated`.

**Verworfen: `checked_in` in `with check` verbieten.** `with check` sieht nur die
NEUE Zeile. Die Bedingung müsste `checked_in = false` verlangen — und bräche
damit jede Bewertung an einer Zeile, die der Host bereits eingecheckt hat.

**Preis, und er ist bekannt:** die Rechte sind heute **tabellenweit**. Sie in
Spaltenrechte zu wandeln bewegt den Gesamtvergleich in
`supabase/tests/grants_test.sql` — die Golden-Snapshot-Falle. Der Vergleich ist
Teil dieses Changes, nicht ein Nachlauf.

### D2 — Der Übergang nach `registered` braucht einen TRIGGER, keine Policy

Eine `with check`-Bedingung kann diese Regel **prinzipiell nicht** ausdrücken:
sie sieht die alte Zeile nicht. Eine Bedingung, die `status <> 'registered'`
verlangt, verbietet auch das Schreiben einer Bewertung an einer bereits
angemeldeten Zeile — der Normalfall.

Die Regel lautet „**dieser Übergang** ist verboten", nicht „dieser Wert ist
verboten". Das ist ein Vergleich zwischen ALT und NEU, und dafür gibt es in
Postgres genau ein Werkzeug: einen `before update`-Trigger.

### D3 — Zwei Schichten: die Invariante kennt keine Rollen, die Exklusivität schon

**Die erste Fassung dieser Entscheidung war falsch, und beide Reviewer haben es
gefunden.** Sie liess den Trigger greifen, wenn `current_user = 'authenticated'`,
und behauptete im selben Absatz, er falle geschlossen aus. Das Gegenteil war der
Fall: jede andere Rolle — eine neue, eine künftige, jede weitere
`postgres`-eigene Definer-Funktion — wäre daran **vorbeigelaufen**. Eine Regel,
die auf eine Rolle zeigt, ist fail-open; eine, die alle ausser einer ausschliesst,
ist fail-closed.

Der Trigger bekommt deshalb zwei Schichten mit verschiedenen Aufgaben:

**Schicht 1 — die Invariante, rollenunabhängig.** Wird eine Zeile nach
`status = 'registered'` gebracht (per INSERT oder UPDATE), prüft der Trigger die
Belegung des Events gegen `events.capacity` und weist ab, wenn die Kapazität
überschritten würde. Diese Prüfung gilt für **jeden**, die RPC eingeschlossen.
Sie ist die Aussage, die zählt, und sie hängt an keiner Annahme darüber, wer
gerade schreibt.

Die RPC besteht sie: sie zählt vor dem Upsert unter Zeilensperre und setzt
`waitlist`, sobald die Kapazität erreicht ist. Schicht 1 ist für sie ein
Netz, kein Hindernis.

**Schicht 2 — die Exklusivität, rollenbewusst und geschlossen ausfallend.** Ein
direkter Statuswechsel nach `registered` oder `waitlist` wird abgewiesen, **es
sei denn**, `current_user` ist der Eigentümer der RPCs. Formuliert als
Ausschluss, nicht als Treffer: `if current_user <> <eigentuemer> then raise`.
Damit ist eine unbekannte Rolle gesperrt, nicht durchgelassen.

Was ein Mitglied direkt setzen darf, bleibt: `status = 'cancelled'` und `rating`.

**Warum beide Schichten und nicht nur die zweite:** Schicht 2 trägt eine Annahme
über den Eigentümer. Wird eine RPC künftig auf `SECURITY INVOKER` gestellt oder
umgehängt, bricht sie — laut, aber sie bricht. Schicht 1 hält die eigentliche
Zusage auch dann.

**Verworfen: ein Sitzungsflag** (`set_config` in der RPC, das der Trigger liest).
Es wäre eine zweite, selbstgebaute Wahrheit über „ich bin der erlaubte Weg", die
jeder setzen kann, der SQL absetzen darf.

**Verworfen: `session_replication_role`** — ein Vorschlaghammer, der alle Trigger
der Sitzung stilllegt.

### D4 — Das Mitglied verliert INSERT und DELETE auf dieser Tabelle

`regs_write_own` wird von `for all` auf `for update` verengt. Die Anmeldung
entsteht ausschliesslich in `register_for_event`, und dort steht die
Kapazitätsprüfung samt Zeilensperre.

**Gemessen folgenlos:** der Client legt heute keine Anmeldezeile direkt an.

**Und zwar auf Rechte-Ebene, nicht nur über die Policy** (Befund aus der
Planungs-Review, codex MEDIUM). Sonst stünde bei `checked_in` die Begründung „ein
Recht trägt auch dann, wenn jemand die Policy lockert" — und derselbe Schutz
hinge hier an genau einer Policy. `revoke insert, delete on
public.event_registrations from authenticated`.

**DELETE gleich mit.** Eine Anmeldung wird abgesagt (`status = 'cancelled'`),
nicht gelöscht — die Zeile trägt die Geschichte. Ein Mitglied, das seine Zeile
löschen kann, umgeht ausserdem die Eindeutigkeit `(event_id, profile_id)` und
kann sich beliebig oft neu anmelden.

### D5 — Zwei Mechanismen, nicht einer, und das ist Absicht

Die Kapazität ist danach an zwei Stellen geschützt: kein INSERT für Mitglieder
(D4) **und** kein Übergang nach `registered` (D2). Das ist keine Doppelung,
sondern deckt zwei verschiedene Wege — Neuanlage und Umschreiben einer
bestehenden Wartelisten-Zeile. Jeder wird einzeln mit einer Verbiegung belegt.

## Risks / Trade-offs

**[Der Trigger könnte den RPC-Weg mitsperren.]** Dann wäre die Anmeldung
insgesamt kaputt — der teuerste denkbare Fehler dieses Changes. → Die
Positivkontrolle „der reguläre Weg über `register_for_event` funktioniert
weiterhin, inklusive der Vergabe von `waitlist` bei voller Kapazität" ist
Pflichtteil der Abnahme, nicht Kür.

**[Die Spaltenrechte bewegen `grants_test.sql`.]** Ein Golden-Snapshot wird rot,
und die bequeme Reaktion ist, die Liste nachzuziehen, bis es grün ist. → Beim
Nachziehen ist zu prüfen, dass rot *dieser* Change ist und nicht ein zweiter,
unbeabsichtigter Rechteverlust. Bei Funktionen heisst rot dort erfahrungsgemäss
„der `revoke` fehlt"; hier ist es umgekehrt.

**[`current_user` als Unterscheidung ist eine Annahme über die Ausführung.]** Sie
ist am Katalog gemessen (beide Funktionen `SECURITY DEFINER`, Eigentümer
`postgres`), aber sie bricht, wenn jemand eine dieser Funktionen künftig auf
`SECURITY INVOKER` umstellt. → Dann wird die Anmeldung sofort und laut
unmöglich, nicht still durchlässig. Der Fehlermodus ist der richtige.

**[Bestehende Zeilen könnten die neue Regel bereits verletzen.]** → Vor der
Migration rein lesend auf PROD messen, ob es überbuchte Events oder von
Nicht-Hosts gesetzte `checked_in` gibt. Das Ergebnis kommt hierher. Der Change
räumt nicht auf, aber er darf nicht behaupten, es gäbe nichts aufzuräumen, ohne
nachgesehen zu haben.

## Migration Plan

Eine Migration, rein additiv in ihrer Wirkung auf den erlaubten Weg:
Policy neu geschnitten, `revoke`/`grant` auf den Spalten, Triggerfunktion und
Trigger. Kein Datenschreiben, keine Rückstufung.

Die Rücknahme ist das Zurücknehmen der Migration: die alte Policy wieder `for
all`, die Tabellenrechte zurück, Trigger fallen lassen.

## Open Questions

- **Darf ein Mitglied `status` auf `waitlist` setzen?** Heute kann es das; die
  Oberfläche tut es nicht. Vorschlag: erlauben, weil harmlos (es nimmt sich
  selbst einen Platz), und die Regel eng auf `→ registered` fassen. Wird in der
  Umsetzung entschieden und im Trigger-Kommentar begründet.
- **Gibt es heute verletzende Zeilen auf PROD?** Wird gemessen (siehe Risiken).
