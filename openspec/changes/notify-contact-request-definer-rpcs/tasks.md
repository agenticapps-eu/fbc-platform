# Tasks — notify-contact-request über eine DEFINER-RPC (AGE-623)

## 1. Den Befund belegen, bevor etwas umgebaut wird

- [ ] Die drei direkten Lesezugriffe im Quelltext benennen
      (`index.ts:91-94` baut den Client, `101-112` liest: `profile_contacts`, `profiles`, `contact_requests`).
- [ ] **Zuschnitt messen, nicht raten:** jede Edge Function daraufhin ansehen,
      ob sie `public` mit dem Dienstschlüssel liest. `create-checkout-session`
      liest mit dem **Anon**-Schlüssel und dem `authorization`-Header des
      Mitglieds — RLS-gebunden, kein Befund.
- [ ] **Lokale Messung der Rechteherkunft:** `has_table_privilege` und `relacl`
      für die drei Tabellen erheben. Erwartung nach dem Stand vom 27.08.:
      `service_role` hält sie **rollen-eigen** (`service_role=arwdDxtm/postgres`),
      obwohl **keine wirksame `grant`-Zeile** im Migrationsbaum sie erteilt — der
      einzige Grep-Treffer ist ein Kommentar, der genau das verwirft
      (`20260811090300:347`). Damit stammen sie aus den Default Privileges der
      Instanz.
- [ ] **PROD-Sonde** (reines Lesen, mit Positivkontrolle) laufen lassen und das
      Ergebnis festhalten. Sie entscheidet die Dringlichkeit, nicht das Ziel.

## 2. RED — die Zusagen schreiben, bevor die Funktion existiert

- [ ] pgTAP: `service_role` darf `notify_contact_request_daten` ausführen,
      `anon` und `authenticated` dürfen es **nicht** (Bit aus dem Katalog, mit
      Gegenprobe — nicht die Fehlermeldung messen).
- [ ] pgTAP: die Funktion liefert für eine echte Anfrage genau eine Zeile mit
      Zustelladresse und Anzeigename.
- [ ] pgTAP: sie liefert **keine** Zeile, wenn Empfänger- oder
      Gegenüber-Kennung nicht zu den Beteiligten dieser Anfrage gehört.
- [ ] pgTAP: sie liefert keine Zeile für eine unbekannte Anfrage-Kennung.
- [ ] pgTAP: die Bindung trägt **beide** Richtungen (Empfänger `to_id` wie
      Empfänger `from_id`) — die Zusage, die ein geordnetes Prädikat bricht.
- [ ] pgTAP: fehlender `profile_contacts`-Eintrag ⇒ **eine** Zeile mit leerer
      Adresse; fehlender Anzeigename ⇒ Zeile mit leerem Namen.
- [ ] Deno-Test: die Function ruft die RPC und **nicht** `.from(...)`.
- [ ] Deno-Test: die drei Antwortcodes bleiben gepinnt — RPC-Fehler ⇒ 502,
      Zeile passt nicht zum Payload ⇒ 409, keine Adresse ⇒ 200 `skipped`.
      Bisher gab es zwei getrennte 502-Pfade (`index.ts:115-118` und `131-134`);
      nach dem Umbau ist es einer.
- [ ] Alle vier laufen und sind **rot**, aus dem richtigen Grund.

## 3. GREEN — die Migration

- [ ] Migration mit Kopfkommentar nach Hausform: Befund, Entscheidung,
      verworfene Alternative, Datum, Issue.
- [ ] `notify_contact_request_daten(p_request_id, p_recipient_id, p_other_id)`
      als `SECURITY DEFINER`, `set search_path = ''`, `stable`.
- [ ] Die Bindung steht **in der Abfrage** und gilt **ungeordnet**: die Menge
      `{p_recipient_id, p_other_id}` muss `{from_id, to_id}` genau dieser
      Anfrage sein. Ein geordnetes Prädikat verwürfe jede `accepted`/`declined`-
      Mail, weil dort `from_id` der Empfänger ist (`emails.ts:61,64`).
- [ ] Die gelieferte Adresse gehört der **als Empfänger übergebenen** Kennung —
      sonst zöge ein Vertauschen der Parameter die Adresse des anderen.
- [ ] **`left join`, kein `join`:** fehlt der `profile_contacts`-Eintrag oder der
      Anzeigename, kommt die Zeile trotzdem, nur mit leerem Feld. Ein innerer
      Verbund machte daraus eine leere Menge und der Aufrufer daraus 409 statt
      des heutigen `200 skipped: no_email`.
- [ ] `revoke execute … from public, anon, authenticated` — **jede Rolle
      namentlich**, sonst bleibt ein rollen-eigener Grant stehen (AGE-622).
- [ ] `grant execute … to service_role`.
- [ ] Zusagen aus 2 laufen grün.

## 4. GREEN — die Function

- [ ] Die drei `.from(...)`-Lesezugriffe durch den einen RPC-Aufruf ersetzen.
- [ ] `passtZurDatenbank` und alle Antwortcodes bleiben unverändert
      (502 Lesefehler, 409 Abweichung, 200 sonst).
- [ ] Die Zusagen der Function laufen grün, auch die bestehenden.

## 5. Abnahme an der Sache, nicht am Haken

- [ ] Gegen den lokalen Stack: eine Kontaktanfrage anlegen und belegen, dass die
      Auskunft über die RPC dieselben Werte liefert wie der heutige direkte Weg.
      **Der Umbau ist verhaltensgleich, nicht reparierend** — lokal gelingt auch
      der alte Weg (siehe 1.3), es gibt also kein Rot, das grün werden könnte.
- [ ] **Positivkontrolle statt Leerlauf:** die RPC einmal unter einer Rolle
      ohne `execute` rufen und den Fehler messen, einmal als `service_role` und
      die Zeile messen. Ohne den bewegten Nachbarwert belegt ein Erfolg nichts.
- [ ] `supabase test db` **mit Dateiliste** (ohne sie meldet der Befehl FAIL,
      obwohl grün — die `probe_*.sql` sind kein pgTAP).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` grün.
- [ ] `grants_test.sql`-Golden-Snapshot geprüft: eine neue **Funktion** ändert
      ihn nicht, aber die abgeschlossene `anon`-Funktionsliste ist zu prüfen.

## 6. Review und Abschluss

- [ ] Plan-Review (Schritt 2b) vor der ersten Codezeile, ≥2 Reviewer anderer
      Anbieter, `REVIEWS.md`.
- [ ] Code-Review auf den **Diff**.
- [ ] `openspec validate --all --strict` grün.
- [ ] PR, CI grün, Migration auf PROD anwenden, Linear schließen.
