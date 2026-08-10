# Tasks — Aktivierungsmail bei der Selbstregistrierung (AGE-526)

Jede Gruppe schreibt den Test **vor** dem Code. Ein Haken ohne einen gesehenen
roten Lauf ist keiner.

## 1. Plan-Review (vor der ersten Codezeile)

- [x] 1.1 `openspec validate --all` grün — Beleg in die Zusammenfassung
- [x] 1.2 Zwei Reviewer **anderer Hersteller** über das Delta laufen lassen,
      `REVIEWS.md` schreiben (Schritt 2b)
- [x] 1.3 Einsprüche aus `REVIEWS.md` entweder einarbeiten oder mit Begründung
      abweisen — die Begründung gehört in diese Datei

## 2. Die plattformweite Grenze (Migration)

- [x] 2.1 pgTAP-Test **RED**: 100 Token in der laufenden Stunde, danach fordert
      ein Profil jünger als 10 Minuten an → erwartet `rate_limited_global`,
      gemessen wird heute `issued`
- [x] 2.2 pgTAP-Test **RED**: dieselbe Lage, aber das anfordernde Profil ist
      älter als 10 Minuten → erwartet `issued`
- [x] 2.3 pgTAP-Test **RED**: die Zählung erfasst Ausgaben **aller** Profile der
      letzten Stunde, nicht nur die des Aufrufers — und beider Ausgabewege
- [x] 2.4 pgTAP-Test **RED** (Grenzfälle, Befund M3): Token exakt an der
      Stundenkante und Profil exakt 10 Minuten alt — beide Richtungen benennen,
      nicht nur die bequeme
- [x] 2.5 pgTAP-Test **RED** (Befund H1, beide Reviewer): zwei gleichzeitige
      Anforderungen frischer Profile an der Schwelle geben zusammen **nicht**
      101 Token aus. Ohne Riegel ist dieser Test grün-zufällig — er braucht zwei
      Sitzungen, nicht zwei Aufrufe hintereinander
- [x] 2.6 pgTAP-Test **RED**: das an der Grenze abgewiesene frische Profil
      bekommt zehn Minuten später ein Token, obwohl das Kontingent noch voll ist
- [x] 2.7 Migration schreiben: `create or replace function
      request_own_activation_token`, neuer Status `rate_limited_global`,
      `pg_advisory_xact_lock` **vor** der Zählung, Prüfung **nach** der
      Profilsperre und **nach** Sperrfrist/Tageskontingent
- [x] 2.8 Migrationskopf: WARUM, die verworfene Flag-Variante (D4), die
      verworfene Budgetzeile (D3), der Wert 100 (D5), warum die Zusage **nicht**
      „plattformweit" heißt (D3a), Datum und Herkunft AGE-526
- [x] 2.9 `comment on function` auf die neue Statusliste nachziehen
- [x] 2.10 Alle Tests **GREEN**, vollständiger pgTAP-Lauf ohne Rückschritt
      (`supabase test db` **mit** Dateiliste — ohne lügt er)
- [x] 2.11 Prüfen, ob `grants_test.sql` den Golden-Snapshot nachziehen muss
      (Funktionssignatur unverändert → erwartet nein; nachmessen, nicht annehmen)

## 3. Der Status bis zur Oberfläche (Client)

- [x] 3.1 Vitest **RED**: `resendActivationLink()` gibt den Status der Function
      zurück statt `void`
- [x] 3.2 Vitest **RED** (Befund M1): ein **502** mit `{"status":"send_failed"}`
      landet nicht im selben Zweig wie eine abgewiesene Anforderung — den
      Fehlerrumpf lesen wie `redeemActivation` es vormacht
- [x] 3.3 `src/lib/activation.ts`: Rückgabetyp als Vereinigung inklusive
      `rate_limited_global`, `send_failed` und `error`; Status aus dem Rumpf
      lesen
- [x] 3.4 Vitest **RED**: der Aktivierungsbildschirm meldet **keinen** Versand,
      wenn der Status `rate_limited` ist — heute meldet er grün
- [x] 3.5 `ActivationScreen.tsx`: „unterwegs" nur bei `issued`; für
      `rate_limited`, `rate_limited_day`, `rate_limited_global` und
      `send_failed` je eine eigene, wahrheitsgemäße Meldung. Keine Zusage über
      Sekunden, die der Server nicht mitgeliefert hat
- [x] 3.6 Alle Zweige **GREEN**

## 4. Der Auslöser (Registrierung)

- [x] 4.1 Vitest **RED**: nach erfolgreichem `signUp` wird `resend-activation`
      aufgerufen — heute wird es nicht
- [x] 4.2 Vitest **RED**: schlägt `signUp` fehl, wird **nicht** versandt
- [x] 4.3 Vitest **RED**: wirft der Versand, bleibt die Registrierung
      erfolgreich (kein Fehler an der Oberfläche)
- [x] 4.4 `AuthProvider.signUp` implementieren (D1), keine Attrappe auf die
      eigene Komponente — der Test greift an `supabase.functions.invoke`
- [x] 4.5 Vitest **RED** (Befund H5): der Zustand des automatischen Versands
      erreicht `ActivationScreen` über den Auth-Kontext (D6). `ActivationGate`
      rendert den Bildschirm nach dem Routenwechsel — ohne diese Naht kann er
      nichts vom Versand wissen
- [x] 4.6 Der Bildschirm startet nach der Registrierung im Zustand „unterwegs"
      mit laufender Sperre, ohne dass jemand drückt — und **nur** bei `issued`
- [x] 4.7 `LoginPage`-Hinweistext — **gelöscht statt geändert.** Zuerst neu
      formuliert und mit einem roten Test belegt; der Diff-Review zeigte dann,
      dass der Hinweis überhaupt nie zu sehen ist (`signUp` meldet die Sitzung,
      bevor es auflöst, und der Navigate-Guard räumt die Seite ab). Der Test
      bestand nur, weil die Attrappe keine Sitzung herstellt. Hinweis, Test und
      die verwaiste `info`-Variable sind entfallen
- [x] 4.8 Alle Zweige **GREEN**

## 5. Sichtprobe statt Vertrauen

- [x] 5.1 Lokaler Stack (`supabase start`), Registrierung im Browser, Screenshot
      des Aktivierungsbildschirms. **Nicht** im Zustand „unterwegs": Der lokale
      Resend-Schlüssel ist absichtlich ungültig, damit die Sichtprobe keine Mail
      versendet — der Bildschirm zeigt deshalb den Fehlversand, und zwar
      wahrheitsgemäß. Der grüne Zustand hängt an einer echten Zustellung und
      gehört damit zu 6.1, nicht hierher. Was diese Sichtprobe belegt hat, ist
      wertvoller als der grüne Screenshot: Sie fand den Fehler, dass der Status
      als `useState`-Anfangswert nie ankam (siehe 4.5)
- [x] 5.2 In der lokalen DB nachsehen: genau **eine** Zeile in
      `activation_tokens` für das neue Profil, ohne Klick
- [x] 5.3 Netzwerkmitschnitt: genau **ein** Aufruf auf
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

- [x] 7.1 Unabhängiger Reviewer über den **Diff** (Schritt 4) — gemini APPROVE,
      opencode/Kimi-K3 REQUEST-CHANGES mit zwei HIGH und einem MEDIUM, alle
      behoben; Auflösung in `REVIEWS.md`
- [x] 7.2 `cso`-Sicherheitsgate über die Migration und den neuen Auslöser — als
      zweite Brille in denselben Diff-Review gegeben (Umgehung der Grenze,
      Aussperrung, Adress-Aufzählung, Mailverteiler). Ohne eigenen Befund
- [x] 7.3 `verification-before-completion`: jeder Haken oben trägt einen Beleg
- [ ] 7.4 `openspec archive`, Delta in `openspec/specs/access-control/` gefaltet
- [ ] 7.5 PR, Linear AGE-526 auf Done, AGE-517 um den Vermerk ergänzen, was
      dieser Change entschärft hat und was offen bleibt
