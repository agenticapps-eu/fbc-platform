# Anmeldungen zu Events halten sich an die Kapazität

Linear: **AGE-605**

## Why

Die Anmeldung zu Events setzt zwei Regeln durch, und beide stehen ausschliesslich
in `SECURITY DEFINER`-RPCs:

| Regel | Wo sie steht | Wie sie arbeitet |
|---|---|---|
| Keine Überbuchung | `register_for_event` (`20260806080100:607`) | sperrt die Event-Zeile `for update`, zählt, vergibt `registered` oder `waitlist` |
| Niemand checkt sich selbst ein | `set_event_check_in` (`20260806080100:624`) | schreibt `checked_in` nur, wenn der Aufrufer **Host** des Events ist |

Daneben steht die Policy `regs_write_own` (`20260806080100:288`):

```sql
create policy regs_write_own on public.event_registrations
  for all to authenticated
  using ( public.is_activated() and profile_id = (select auth.uid()) )
  with check (
    public.is_activated()
    and profile_id = (select auth.uid())
    and public.has_level(4)
    and exists (select 1 from public.events e where e.id = event_registrations.event_id)
  );
```

Sie prüft: aktiviert, eigene Zeile, Stufe ≥ 4, Event existiert. Sie prüft
**nicht** die Kapazität und **nicht**, wer `checked_in` setzen darf. `status` und
`checked_in` sind gewöhnliche Spalten der eigenen Zeile, und `for all` deckt
INSERT, UPDATE und DELETE.

**Damit umgeht ein selbstgebauter PostgREST-Request beide Regeln:**

- **Überbuchung** — ein Insert mit `status = 'registered'` läuft an
  `register_for_event` vorbei. Die Kapazitätsprüfung sitzt in der Funktion, nicht
  in einem Constraint oder Trigger auf der Tabelle. Dasselbe erreicht ein Update,
  das die eigene Zeile von `waitlist` auf `registered` hebt.
- **Selbst-Einchecken** — ein `update … set checked_in = true` auf der eigenen
  Zeile setzt den Anwesenheitsstatus, den nur der Host setzen darf.

Über die Oberfläche ist das nicht erreichbar; es braucht einen bewusst gebauten
Request. Deshalb lag es als Nachlauf und nicht als Blocker. **Mit echten Events
und begrenzten Plätzen nach dem Go-Live ändert sich das Gewicht.**

Es ist dieselbe Klasse wie AGE-542 (anon-Lesepfade) und AGE-618 (Einbettung am
Einwilligungstor vorbei): eine Zusage steht an genau einer Stelle, und daneben
liegt ein Weg, der nicht dort vorbeiführt.

### Gemessen: was die Oberfläche wirklich direkt schreibt

Der Zuschnitt hängt daran, und er ist nicht geschätzt. Im ganzen Client gibt es
genau **zwei** direkte Schreibzugriffe auf `event_registrations`:

| Stelle | Was | Bewertung |
|---|---|---|
| `src/lib/events.ts:620` | `update({ status: "cancelled" })` | **legitim** — die eigene Anmeldung zurückziehen |
| `src/lib/events.ts:639` | `update({ rating })` | **legitim** — das besuchte Event bewerten |

**Kein** direkter INSERT (Anmeldung läuft über `register_for_event`), **kein**
direktes Schreiben von `checked_in`. Ein Mitglied braucht auf dieser Tabelle also
gar kein INSERT, und von `status` nur den Weg nach `cancelled`.

## What Changes

- **Für Mitglieder ändert sich nichts Sichtbares.** Anmelden, Abmelden und
  Bewerten funktionieren unverändert.
- **Eine neue Anmeldung belegt ein Event nicht mehr über seine Kapazität
  hinaus.** Die Grenze hängt nicht länger daran, dass man den vorgesehenen Weg
  benutzt. (Bewusst auf Anmeldungen begrenzt: ein Gastgeber kann die Kapazität
  weiterhin unter die bestehende Belegung senken — siehe „Nicht in diesem
  Change".)
- **Den Anwesenheitsstatus setzt weiterhin nur der Gastgeber** — und das gilt
  jetzt auch dann, wenn jemand die Oberfläche umgeht.

## Technisch — was gebaut wird

<!-- ABSICHTLICH unter einer eigenen `##`-Ueberschrift und NICHT unter „What
     Changes": der Parser fuer den Neuigkeiten-Eintrag schneidet bei
     `/^#{1,2} /`. Diese Punkte sind Entwicklersprache und haben in einer
     Mitglieder-Nachricht nichts verloren (Lehre aus AGE-542). -->

- **`regs_write_own` verliert INSERT und DELETE.** Ein Mitglied legt keine
  Anmeldezeile mehr selbst an; das tut `register_for_event`, und nur dort steht
  die Kapazitätsprüfung. Gemessen ist das folgenlos: der Client legt heute keine
  an.
- **`checked_in` wird dem Mitglied entzogen** — über Spaltenrechte, nicht über
  eine Policy-Bedingung. Die Form ist dabei nicht beliebig: ein
  `revoke update (checked_in)` allein wäre **wirkungslos**, solange das
  tabellenweite UPDATE-Recht besteht (Befund aus der Planungs-Review, codex).
  Richtig ist, das Tabellenrecht zu entziehen und danach genau die erlaubten
  Spalten zurückzugeben. Die RPC ist nicht betroffen: sie läuft als
  `SECURITY DEFINER` mit den Rechten ihres Eigentümers.
- **INSERT und DELETE werden ebenfalls auf Rechte-Ebene entzogen**, nicht nur
  über die Policy. Sonst stünde bei `checked_in` die Begründung „ein Recht trägt
  auch dann, wenn jemand die Policy lockert" — und drei Zeilen weiter hinge
  genau das an einer Policy.
- **Der Weg `→ registered` wird geschlossen.** Eine reine `with check`-Bedingung
  reicht dafür NICHT: sie sieht nur die neue Zeile, nicht die alte, und müsste
  `registered` erlauben, sobald eine Bewertung an einer bereits angemeldeten
  Zeile geschrieben wird. Der Übergang braucht deshalb einen Trigger, der ALT und
  NEU vergleicht.
- **Der Trigger hat ZWEI Schichten, und die untere kennt keine Rollen.** Die
  Kapazitätsinvariante wird für **jeden** Weg geprüft, die RPC eingeschlossen —
  sie ist die Aussage, die zählt, und sie hängt an keiner Annahme darüber, wer
  gerade schreibt. Darüber liegt eine rollenbewusste Regel, die den direkten
  Statuswechsel sperrt; sie blockt **alles ausser dem Eigentümer** und fällt
  damit geschlossen aus. Die erste Fassung dieses Entwurfs prüfte
  `current_user = 'authenticated'` und wäre fail-OPEN gewesen — jede neue Rolle
  wäre daran vorbeigelaufen. Beide Reviewer haben das gefunden.

## Nicht in diesem Change

- **Keine Änderung an den RPCs selbst.** `register_for_event` und
  `set_event_check_in` bleiben Wort für Wort, wie sie sind. Dieser Change nimmt
  ihnen den Seitenweg, er baut sie nicht um.
- **Keine Änderung an der Oberfläche.** Die zwei legitimen Schreibzugriffe
  (`cancelled`, `rating`) bleiben erlaubt und werden nicht umgebaut.
- **Keine Warteliste-Mechanik.** Wer beim Absagen eines Angemeldeten von der
  Warteliste nachrückt, ist eine eigene Frage und hier nicht berührt.
- **Kapazitätsänderungen durch den Gastgeber.** Ein Host kann `events.capacity`
  unter die bestehende Belegung senken; `updateEvent` (`src/lib/events.ts:601`)
  schreibt das Feld regulär. Das ist ein **anderer Handelnder und ein anderer
  Vorgang** — hier geht es um Mitglieder, die an den RPCs vorbeischreiben.
  Gefunden in der Planungs-Review (codex, HIGH) und am Quelltext nachgeprüft;
  die Zusage oben ist deshalb ausdrücklich auf **neue Anmeldungen und
  Statuswechsel** begrenzt statt falsch zu bleiben.
- **Die Stufenschwelle anzugleichen.** `regs_write_own` verlangt `has_level(4)`,
  die RPC lässt öffentliche Events ab `basic` und Mitglieder-Events ab
  `has_level(3)` zu. Wer darunter liegt, kann sich anmelden, aber nicht direkt
  absagen. Bestand, nicht durch diesen Change entstanden; benannt statt
  stillschweigend mitgeschleppt.
- **Keine Rückstufung bestehender Zeilen.** Sollte heute eine überbuchte oder
  selbst eingecheckte Zeile in der Datenbank stehen, räumt dieser Change sie
  nicht auf — er verhindert neue. Ob es solche Zeilen gibt, wird gemessen und in
  `design.md` festgehalten.

## Capabilities

### Modified Capabilities

- `events`: Die Anforderung an die Anmeldung wird von „die RPCs setzen die Regeln
  durch" auf „die Regeln gelten unabhängig vom benutzten Weg" gehoben, und die
  Spalten, die ein Mitglied an seiner eigenen Zeile setzen darf, werden
  ausgeschrieben.

## Impact

- `supabase/migrations/` — eine neue Migration: Policy neu geschnitten,
  Spaltenrechte, Trigger samt Funktion.
- `supabase/tests/` — pgTAP: die Verbiegungsproben (Überbuchung, Wechsel nach
  `registered`, Selbst-Einchecken) plus die Positivkontrollen, dass Absagen,
  Bewerten und der reguläre RPC-Weg weiter funktionieren.
- `supabase/tests/grants_test.sql` — der Gesamtvergleich der Rechte zieht nach,
  sobald sich Spaltenrechte ändern (Golden-Snapshot-Falle).
- **Kein** Produktivcode in `src/`, sofern die Messung nichts Gegenteiliges
  zeigt.
