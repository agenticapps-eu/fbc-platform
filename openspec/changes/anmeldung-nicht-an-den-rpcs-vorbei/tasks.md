## 1. Vorarbeit, die schon geleistet ist

- [x] 1.1 Bestand am Katalog gemessen, rein lesend: beide RPCs sind
      `SECURITY DEFINER` mit Eigentümer `postgres`; `authenticated` hält
      **tabellenweite** INSERT/SELECT/UPDATE-Rechte auf `event_registrations`.
- [x] 1.2 Die zwei legitimen direkten Schreibzugriffe des Clients benannt
      (`status → 'cancelled'`, `rating`); kein direkter INSERT, kein direktes
      `checked_in`.
- [x] 1.3 Planungs-Review durch zwei fremde Anbieter, `REVIEWS.md` geschrieben.
      Beide REQUEST-CHANGES, drei HIGH — alle am Quelltext nachgeprüft und
      eingearbeitet. Der teuerste: `register_for_event` ist ein **Upsert**, die
      Wiederanmeldung läuft also über den UPDATE-Zweig.

## 2. Ausgangsmessung

Bewusst NICHT „RED" genannt: hier wird der Ist-Zustand festgehalten, nicht eine
Zusage rot gemacht. Die dauerhaften Zusagen entstehen in Gruppe 4 mit ihrer
End-Erwartung (Befund aus der Planungs-Review, codex LOW).

- [ ] 2.1 **Auf PROD rein lesend zählen, ob es überbuchte Events gibt:** Events,
      bei denen die Zahl der `registered`-Anmeldungen `capacity` übersteigt.
      Über `pg` + tsx. Ergebnis mit Zahl in `design.md`, auch wenn es null ist.
      **Keine Namen, keine Mailadressen ins Repo** — das Repositorium ist
      öffentlich.
- [ ] 2.2 **Selbst-Check-ins sind historisch NICHT messbar** und werden deshalb
      nicht gezählt: `checked_in = true` an der Zeile eines Nicht-Hosts ist der
      Normalzustand nach einem legitimen Host-Check-in; die Zeile speichert den
      Handelnden nicht (Befund codex, MEDIUM). Diese Grenze wird in `design.md`
      benannt statt eine Zahl zu erfinden.
- [ ] 2.3 Bestand der pgTAP-Läufe festhalten (Dateien und Zusagen), damit die
      Abnahme eine Zahl hat.

## 3. Die Exploit-Proben — belegen, dass die Lücke existiert

Getrennt von den dauerhaften Zusagen. Jede prüft genau einen Weg; eine Probe, die
aus zwei Gründen anschlägt, belegt keinen davon.

- [ ] 3.1 **Weg A — Überbuchung per INSERT.** Als aktiviertes Mitglied mit
      Stufe ≥ 4 direkt einfügen, `status = 'registered'`, Event voll.
- [ ] 3.2 **Weg B — Aufstieg von der Warteliste** per UPDATE.
- [ ] 3.3 **Weg C — Selbst-Einchecken** (`checked_in = true`).
- [ ] 3.4 **Weg D — Umhängen auf ein volles Event** (`event_id` ändern,
      `registered → registered`). Vierter Weg aus der Planungs-Review.
- [ ] 3.5 Alle vier gegen den Bestand laufen lassen; jeder muss **heute
      durchgehen**. Ergebnis je mit Zahl festhalten — das belegt die Lücke,
      statt sie zu behaupten.
- [ ] 3.6 **Die Falle aus dem Vorgang:** nicht das Vorhandensein der Policy
      messen. Eine gelöschte Policy ist keine gültige Gegenprobe — Default-Deny
      hält sie grün. Geprüft wird der Schreibvorgang.

## 4. Die dauerhaften Zusagen — mit End-Erwartung geschrieben, vor der Migration rot

- [ ] 4.1 Vier Zusagen, je eine pro Weg aus Gruppe 3, formuliert als „wird
      abgewiesen". Vor der Migration sind sie **rot** — das ist das RED.
- [ ] 4.2 Zusage: `checked_in` scheitert am **fehlenden Spaltenrecht**, nicht an
      der Policy. Die Unterscheidung gehört in die Zusage, sonst belegt sie den
      falschen Mechanismus.
- [ ] 4.3 Zusage über die effektiven Spaltenrechte per `has_column_privilege`
      für jede Spalte einzeln — nicht nur über den Golden-Snapshot (Befund
      codex, MEDIUM).

## 5. Die Migration

- [ ] 5.1 `regs_write_own` von `for all` auf `for update` verengen; `using` und
      `with check` inhaltlich unverändert. Im Kopf begründen: UPDATE bleibt
      erlaubt, INSERT und DELETE nicht (Befund gemini, LOW).
- [ ] 5.2 `revoke update on public.event_registrations from authenticated`,
      danach `grant update (status, rating) … to authenticated`. Die Reihenfolge
      ist nicht beliebig — ein `revoke update (checked_in)` allein wäre
      wirkungslos, solange das Tabellenrecht besteht.
- [ ] 5.3 `revoke insert, delete on public.event_registrations from
      authenticated` — auf Rechte-Ebene, nicht nur über die Policy.
- [ ] 5.4 Triggerfunktion, **Schicht 1**: rollenunabhängige Kapazitätsprüfung bei
      jedem Weg nach `status = 'registered'`, INSERT wie UPDATE.
- [ ] 5.5 Triggerfunktion, **Schicht 2**: direkter Statuswechsel nach
      `registered` oder `waitlist` nur für den Eigentümer. Als **Ausschluss**
      formuliert (`current_user <> <eigentuemer>` → `raise`), damit eine
      unbekannte Rolle gesperrt und nicht durchgelassen wird.
- [ ] 5.6 **`revoke execute` auf der neuen Triggerfunktion** von `public`, `anon`,
      `authenticated`, `service_role`. Neue Funktionen bekommen EXECUTE über
      `PUBLIC`; ohne den Entzug wird die geschlossene Funktionsliste in
      `grants_test.sql` rot (Befund codex, MEDIUM — und bekannte Repo-Falle).
- [ ] 5.7 `event_id`, `profile_id`, `id`, `created_at` sind nicht aktualisierbar
      — durch die Spaltenliste aus 5.2 abgedeckt, aber ausdrücklich als Zusage
      geführt, nicht als Nebenwirkung.
- [ ] 5.8 `comment on policy` und `comment on function` nachziehen — in diesem
      Repo tragen die Migrationsköpfe die Entscheidungen.

## 6. GREEN

- [ ] 6.1 Die vier Zusagen aus 4.1 werden grün; je das Ergebnis mit Zahl.
- [ ] 6.2 Die Meldungen nennen den Grund und verwechseln die Mechanismen nicht.

## 7. Positivkontrollen — der erlaubte Weg bleibt offen

Ohne diese Gruppe ist der Change ununterscheidbar von „die Tabelle ist jetzt zu".
Das ist der teuerste denkbare Fehler hier, und die Planungs-Review hat gezeigt,
dass meine erste Fassung ihn nicht gefangen hätte.

- [ ] 7.1 `register_for_event` vergibt bei freier Kapazität `registered`
      (INSERT-Zweig).
- [ ] 7.2 `register_for_event` vergibt bei voller Kapazität `waitlist`.
- [ ] 7.3 **`cancelled → registered` über den RPC** — Wiederanmeldung nach dem
      Absagen. Läuft über den **UPDATE**-Zweig des Upserts. Diese Zusage fehlte
      in der ersten Fassung, und ohne sie wäre ein gebrochener Produktivweg
      unbemerkt geblieben.
- [ ] 7.4 **`waitlist → registered` über den RPC** bei frei gewordener Kapazität
      — ebenfalls der UPDATE-Zweig.
- [ ] 7.5 `set_event_check_in` setzt als Host weiterhin `checked_in`.
- [ ] 7.6 Ein Mitglied sagt weiterhin ab (`status = 'cancelled'`).
- [ ] 7.7 Ein Mitglied bewertet weiterhin (`rating`) — auch an einer Zeile, die
      bereits `registered` ist **und** die der Host bereits eingecheckt hat.
      Genau dieser Fall bricht, wenn jemand die Regel als `with check` baut.

## 8. Der Golden-Snapshot

- [ ] 8.1 `supabase/tests/grants_test.sql` läuft rot — aus einem Tabellenrecht
      werden Spaltenrechte, und eine Funktion kommt dazu. Erwartet.
- [ ] 8.2 Beim Nachziehen die **Differenz benennen**, nicht die Liste blind
      ersetzen: rot muss dieser Change sein und kein zweiter, unbeabsichtigter
      Rechteverlust.

## 9. Abnahme

- [ ] 9.1 pgTAP vollständig grün, Zahl gegen den Bestand aus 2.3.
- [ ] 9.2 `pnpm test` grün — der Client ist nicht angefasst, die Zahl muss stehen.
- [ ] 9.3 `pnpm lint`, `pnpm typecheck`, `pnpm build` — je den **Exit-Code**.
- [ ] 9.4 `openspec validate --all` grün.
- [ ] 9.5 Fremdreview auf dem **Diff**, Ergebnis in `REVIEWS.md` ergänzen.

## 10. Abschluss

- [ ] 10.1 Change archivieren, Delta nach `openspec/specs/events/spec.md` falten.
      Beide Überschriften sind **wörtlich** die alten — sonst bleiben die alten
      Anforderungen stehen und die neuen kommen daneben.
- [ ] 10.2 Vor dem Archivieren den Neuigkeiten-Eintrag in der Vorschau ansehen
      (`pnpm tsx .gstack/probe-eintrag.mts anmeldung-nicht-an-den-rpcs-vorbei`).
- [ ] 10.3 Commit, PR, Linear AGE-605 auf Done.
- [ ] 10.4 **Migration nach PROD ist ein eigener, ausdrücklicher Schritt** und
      nicht vom Merge gedeckt. Vorher fragen.
- [ ] 10.5 Die zwei Befunde, die Donald gehören, in die Übergabe: der Host kann
      `capacity` unter die Belegung senken, und Mitglieder unter `exchange`
      können sich anmelden, aber nicht direkt absagen.
