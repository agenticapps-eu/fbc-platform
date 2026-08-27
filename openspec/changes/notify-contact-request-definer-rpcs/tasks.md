# Tasks — notify-contact-request über eine DEFINER-RPC (AGE-623)

## 1. Den Befund belegen, bevor etwas umgebaut wird

- [ ] Die drei direkten Lesezugriffe im Quelltext benennen
      (`index.ts:101-112`: `profile_contacts`, `profiles`, `contact_requests`).
- [ ] **Zuschnitt messen, nicht raten:** jede Edge Function daraufhin ansehen,
      ob sie `public` mit dem Dienstschlüssel liest. `create-checkout-session`
      liest mit dem **Anon**-Schlüssel und dem `authorization`-Header des
      Mitglieds — RLS-gebunden, kein Befund.
- [ ] **Lokale Gegenprobe:** belegen, dass `service_role` im lokalen Stack auf
      den drei Tabellen kein `SELECT` hält — der Weg ist dort heute schon tot.
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
- [ ] Deno-Test: die Function ruft die RPC und **nicht** `.from(...)`.
- [ ] Alle vier laufen und sind **rot**, aus dem richtigen Grund.

## 3. GREEN — die Migration

- [ ] Migration mit Kopfkommentar nach Hausform: Befund, Entscheidung,
      verworfene Alternative, Datum, Issue.
- [ ] `notify_contact_request_daten(p_request_id, p_recipient_id, p_other_id)`
      als `SECURITY DEFINER`, `set search_path = ''`, `stable`.
- [ ] Die Bindung steht **in der Abfrage**: keine Zeile, wenn die beiden
      Kennungen nicht `from_id`/`to_id` genau dieser Anfrage sind.
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
      Auskunft jetzt **gelingt**, wo sie vorher an „permission denied" scheiterte.
      Das ist die Positivkontrolle — ohne sie ist ein Erfolg nicht vom Leerlauf
      zu trennen.
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
