# Tasks — notify-contact-request über eine DEFINER-RPC (AGE-623)

## 1. Den Befund belegen, bevor etwas umgebaut wird

- [x] Die drei direkten Lesezugriffe im Quelltext benennen
      (`index.ts:91-94` baut den Client, `101-112` liest: `profile_contacts`, `profiles`, `contact_requests`).
- [x] **Zuschnitt messen, nicht raten:** jede Edge Function daraufhin ansehen,
      ob sie `public` mit dem Dienstschlüssel liest. `create-checkout-session`
      liest mit dem **Anon**-Schlüssel und dem `authorization`-Header des
      Mitglieds — RLS-gebunden, kein Befund.
- [x] **Lokale Messung der Rechteherkunft:** `has_table_privilege` und `relacl`
      für die drei Tabellen erheben. Erwartung nach dem Stand vom 27.08.:
      `service_role` hält sie **rollen-eigen** (`service_role=arwdDxtm/postgres`),
      obwohl **keine wirksame `grant`-Zeile** im Migrationsbaum sie erteilt — der
      einzige Grep-Treffer ist ein Kommentar, der genau das verwirft
      (`20260811090300:347`). Damit stammen sie aus den Default Privileges der
      Instanz.
- [x] **PROD-Messung** (reines Lesen, mit Positivkontrolle). Sie brauchte am
      Ende kein Terminal — die Frage ließ sich lesend am PROD-Katalog
      beantworten: **35 von 36** Tabellen mit `service_role`-`SELECT`, die eine
      Ausnahme `staff_roles`, Positivkontrolle (`authenticated` auf `profiles`)
      `true`. Identisch mit dem lokalen Stand.
      **Damit ist „Vorsorge oder Fix?" beantwortet: Vorsorge.** PROD ist die
      großzügige Sorte, der Mailweg funktionierte.

## 2. RED — die Zusagen schreiben, bevor die Funktion existiert

- [x] pgTAP: `service_role` darf `notify_contact_request_daten` ausführen,
      `anon` und `authenticated` dürfen es **nicht** (Bit aus dem Katalog, mit
      Gegenprobe — nicht die Fehlermeldung messen).
- [x] pgTAP: die Funktion liefert für eine echte Anfrage genau eine Zeile mit
      Zustelladresse und Anzeigename.
- [x] pgTAP: sie liefert **keine** Zeile, wenn Empfänger- oder
      Gegenüber-Kennung nicht zu den Beteiligten dieser Anfrage gehört.
- [x] pgTAP: sie liefert keine Zeile für eine unbekannte Anfrage-Kennung.
- [x] pgTAP: die Bindung trägt **beide** Richtungen (Empfänger `to_id` wie
      Empfänger `from_id`) — die Zusage, die ein geordnetes Prädikat bricht.
- [x] pgTAP: fehlender `profile_contacts`-Eintrag ⇒ **eine** Zeile mit leerer
      Adresse; fehlender Anzeigename ⇒ Zeile mit leerem Namen.
- [x] Deno-Test: die Function ruft die RPC und **nicht** `.from(...)`.
- [x] Deno-Test: die drei Antwortcodes bleiben gepinnt — RPC-Fehler ⇒ 502,
      Zeile passt nicht zum Payload ⇒ 409, keine Adresse ⇒ 200 `skipped`.
      Bisher gab es zwei getrennte 502-Pfade (`index.ts:115-118` und `131-134`);
      nach dem Umbau ist es einer.
- [x] Alle vier laufen und sind **rot**, aus dem richtigen Grund.

## 3. GREEN — die Migration

- [x] Migration mit Kopfkommentar nach Hausform: Befund, Entscheidung,
      verworfene Alternative, Datum, Issue.
- [x] `notify_contact_request_daten(p_request_id, p_recipient_id, p_other_id)`
      als `SECURITY DEFINER`, `set search_path = ''`, `stable`.
- [x] Die Bindung steht **in der Abfrage** und gilt **ungeordnet**: die Menge
      `{p_recipient_id, p_other_id}` muss `{from_id, to_id}` genau dieser
      Anfrage sein. Ein geordnetes Prädikat verwürfe jede `accepted`/`declined`-
      Mail, weil dort `from_id` der Empfänger ist (`emails.ts:61,64`).
- [x] Die gelieferte Adresse gehört der **als Empfänger übergebenen** Kennung —
      sonst zöge ein Vertauschen der Parameter die Adresse des anderen.
- [x] **`left join`, kein `join`:** fehlt der `profile_contacts`-Eintrag oder der
      Anzeigename, kommt die Zeile trotzdem, nur mit leerem Feld. Ein innerer
      Verbund machte daraus eine leere Menge und der Aufrufer daraus 409 statt
      des heutigen `200 skipped: no_email`.
- [x] `revoke execute … from public, anon, authenticated` — **jede Rolle
      namentlich**, sonst bleibt ein rollen-eigener Grant stehen (AGE-622).
- [x] `grant execute … to service_role`.
- [x] Zusagen aus 2 laufen grün.

## 4. GREEN — die Function

- [x] Die drei `.from(...)`-Lesezugriffe durch den einen RPC-Aufruf ersetzen.
- [x] `passtZurDatenbank` und alle Antwortcodes bleiben unverändert
      (502 Lesefehler, 409 Abweichung, 200 sonst).
- [x] Die Zusagen der Function laufen grün, auch die bestehenden.

## 5. Abnahme an der Sache, nicht am Haken

- [x] Gegen den lokalen Stack: eine Kontaktanfrage anlegen und belegen, dass die
      Auskunft über die RPC dieselben Werte liefert wie der heutige direkte Weg.
      **Der Umbau ist verhaltensgleich, nicht reparierend** — lokal gelingt auch
      der alte Weg (siehe 1.3), es gibt also kein Rot, das grün werden könnte.
- [x] **Positivkontrolle statt Leerlauf:** die RPC einmal unter einer Rolle
      ohne `execute` rufen und den Fehler messen, einmal als `service_role` und
      die Zeile messen. Ohne den bewegten Nachbarwert belegt ein Erfolg nichts.
- [x] `supabase test db` **mit Dateiliste** (ohne sie meldet der Befehl FAIL,
      obwohl grün — die `probe_*.sql` sind kein pgTAP).
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` grün.
- [x] `grants_test.sql`-Golden-Snapshot geprüft: eine neue **Funktion** ändert
      ihn nicht, aber die abgeschlossene `anon`-Funktionsliste ist zu prüfen.

## 6. Review und Abschluss

- [x] Plan-Review (Schritt 2b) vor der ersten Codezeile, ≥2 Reviewer anderer
      Anbieter, `REVIEWS.md`.
- [x] Code-Review auf den **Diff** (codex, gemini). Fünf Befunde, drei
      übernommen, zwei begründet abgelehnt — siehe `REVIEWS.md`.
- [x] `openspec validate --all --strict` grün.
- [x] PR #240, CI grün **auf der HEAD-SHA gemessen** (nicht am `gh pr checks`,
      das hier eine ältere SHA meldete), gemergt.
- [x] Migration auf PROD angewandt (`migrate-prod`, plan + apply grün) und am
      Katalog verifiziert: `prosecdef = true`, `provolatile = s`,
      `proacl = {postgres=X/postgres, service_role=X/postgres}`.
- [x] Edge Function auf PROD deployt. Der Deploy zum Merge war erwartungsgemäß
      am `drift-gate` gescheitert (Migration fehlte PROD noch); nach der
      Migration per `gh run rerun --failed` nachgeholt. Verifiziert am
      **Inhalt** der laufenden Fassung, nicht am Versionszähler: sie ruft
      `notify_contact_request_daten` und trägt kein `.from(` mehr.
- [x] Linear: AGE-623 auf Done (Automation beim Merge), Messergebnis als
      Kommentar nachgetragen.
