# Tasks — Aktivierungsmail bei der Selbstregistrierung (AGE-526)

Jede Gruppe schreibt den Test **vor** dem Code. Ein Haken ohne einen gesehenen
roten Lauf ist keiner.

## 1. Plan-Review (vor der ersten Codezeile)

- [ ] 1.1 `openspec validate --all` grün — Beleg in die Zusammenfassung
- [ ] 1.2 Zwei Reviewer **anderer Hersteller** über das Delta laufen lassen,
      `REVIEWS.md` schreiben (Schritt 2b)
- [ ] 1.3 Einsprüche aus `REVIEWS.md` entweder einarbeiten oder mit Begründung
      abweisen — die Begründung gehört in diese Datei

## 2. Die plattformweite Grenze (Migration)

- [ ] 2.1 pgTAP-Test **RED**: 100 Token in der laufenden Stunde, danach fordert
      ein Profil jünger als 10 Minuten an → erwartet `rate_limited_global`,
      gemessen wird heute `issued`
- [ ] 2.2 pgTAP-Test **RED**: dieselbe Lage, aber das anfordernde Profil ist
      älter als 10 Minuten → erwartet `issued`
- [ ] 2.3 pgTAP-Test **RED**: die Zählung erfasst Ausgaben **aller** Profile der
      letzten Stunde, nicht nur die des Aufrufers — und beider Ausgabewege
- [ ] 2.4 pgTAP-Test **RED** (Grenzfälle, Befund M3): Token exakt an der
      Stundenkante und Profil exakt 10 Minuten alt — beide Richtungen benennen,
      nicht nur die bequeme
- [ ] 2.5 pgTAP-Test **RED** (Befund H1, beide Reviewer): zwei gleichzeitige
      Anforderungen frischer Profile an der Schwelle geben zusammen **nicht**
      101 Token aus. Ohne Riegel ist dieser Test grün-zufällig — er braucht zwei
      Sitzungen, nicht zwei Aufrufe hintereinander
- [ ] 2.6 pgTAP-Test **RED**: das an der Grenze abgewiesene frische Profil
      bekommt zehn Minuten später ein Token, obwohl das Kontingent noch voll ist
- [ ] 2.7 Migration schreiben: `create or replace function
      request_own_activation_token`, neuer Status `rate_limited_global`,
      `pg_advisory_xact_lock` **vor** der Zählung, Prüfung **nach** der
      Profilsperre und **nach** Sperrfrist/Tageskontingent
- [ ] 2.8 Migrationskopf: WARUM, die verworfene Flag-Variante (D4), die
      verworfene Budgetzeile (D3), der Wert 100 (D5), warum die Zusage **nicht**
      „plattformweit" heißt (D3a), Datum und Herkunft AGE-526
- [ ] 2.9 `comment on function` auf die neue Statusliste nachziehen
- [ ] 2.10 Alle Tests **GREEN**, vollständiger pgTAP-Lauf ohne Rückschritt
      (`supabase test db` **mit** Dateiliste — ohne lügt er)
- [ ] 2.11 Prüfen, ob `grants_test.sql` den Golden-Snapshot nachziehen muss
      (Funktionssignatur unverändert → erwartet nein; nachmessen, nicht annehmen)

## 3. Der Status bis zur Oberfläche (Client)

- [ ] 3.1 Vitest **RED**: `resendActivationLink()` gibt den Status der Function
      zurück statt `void`
- [ ] 3.2 Vitest **RED** (Befund M1): ein **502** mit `{"status":"send_failed"}`
      landet nicht im selben Zweig wie eine abgewiesene Anforderung — den
      Fehlerrumpf lesen wie `redeemActivation` es vormacht
- [ ] 3.3 `src/lib/activation.ts`: Rückgabetyp als Vereinigung inklusive
      `rate_limited_global`, `send_failed` und `error`; Status aus dem Rumpf
      lesen
- [ ] 3.4 Vitest **RED**: der Aktivierungsbildschirm meldet **keinen** Versand,
      wenn der Status `rate_limited` ist — heute meldet er grün
- [ ] 3.5 `ActivationScreen.tsx`: „unterwegs" nur bei `issued`; für
      `rate_limited`, `rate_limited_day`, `rate_limited_global` und
      `send_failed` je eine eigene, wahrheitsgemäße Meldung. Keine Zusage über
      Sekunden, die der Server nicht mitgeliefert hat
- [ ] 3.6 Alle Zweige **GREEN**

## 4. Der Auslöser (Registrierung)

- [ ] 4.1 Vitest **RED**: nach erfolgreichem `signUp` wird `resend-activation`
      aufgerufen — heute wird es nicht
- [ ] 4.2 Vitest **RED**: schlägt `signUp` fehl, wird **nicht** versandt
- [ ] 4.3 Vitest **RED**: wirft der Versand, bleibt die Registrierung
      erfolgreich (kein Fehler an der Oberfläche)
- [ ] 4.4 `AuthProvider.signUp` implementieren (D1), keine Attrappe auf die
      eigene Komponente — der Test greift an `supabase.functions.invoke`
- [ ] 4.5 Vitest **RED** (Befund H5): der Zustand des automatischen Versands
      erreicht `ActivationScreen` über den Auth-Kontext (D6). `ActivationGate`
      rendert den Bildschirm nach dem Routenwechsel — ohne diese Naht kann er
      nichts vom Versand wissen
- [ ] 4.6 Der Bildschirm startet nach der Registrierung im Zustand „unterwegs"
      mit laufender Sperre, ohne dass jemand drückt — und **nur** bei `issued`
- [ ] 4.7 `LoginPage`-Hinweistext **ändern** (Befund M2, kein Prüfhaken): „Falls
      E-Mail-Bestätigung aktiv ist, bitte Postfach prüfen" ist nach diesem
      Change falsch. Vitest **RED** auf dem neuen Text
- [ ] 4.8 Alle Zweige **GREEN**

## 5. Sichtprobe statt Vertrauen

- [ ] 5.1 Lokaler Stack (`supabase start`), Registrierung im Browser, Screenshot
      des Aktivierungsbildschirms im Zustand „unterwegs"
- [ ] 5.2 In der lokalen DB nachsehen: genau **eine** Zeile in
      `activation_tokens` für das neue Profil, ohne Klick
- [ ] 5.3 Netzwerkmitschnitt: genau **ein** Aufruf auf
      `/functions/v1/resend-activation`

## 6. Abnahme durch Donald

- [ ] 6.1 `migrate-dev`, danach echte Registrierung auf DEV mit einer **echten
      Fremdadresse** — Link im Postfach, nicht nur `202`
- [ ] 6.2 Link einlösen, Passwort setzen, anmelden: das Konto ist aktiviert
- [ ] 6.3 Dry-Run für PROD **lesend** prüfen (`migration-drift-gate.ts` plus die
      Migrationsdatei), dann `migrate-prod`
- [ ] 6.4 Frontend-Deploy; Live-Stand am ausgelieferten Bundle messen, nicht am
      grünen Job

## 7. Code-Review und Abschluss

- [ ] 7.1 Unabhängiger Reviewer über den **Diff** (Schritt 4)
- [ ] 7.2 `cso`-Sicherheitsgate über die Migration und den neuen Auslöser
- [ ] 7.3 `verification-before-completion`: jeder Haken oben trägt einen Beleg
- [ ] 7.4 `openspec archive`, Delta in `openspec/specs/access-control/` gefaltet
- [ ] 7.5 PR, Linear AGE-526 auf Done, AGE-517 um den Vermerk ergänzen, was
      dieser Change entschärft hat und was offen bleibt
