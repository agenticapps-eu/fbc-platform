Linear: **AGE-505**. Jede Aufgabe ist TDD — RED vor GREEN, und der rote Lauf
wird zitiert, nicht behauptet.

Die pgTAP-Zeile, die die Wahrheit sagt (nie der nackte Befehl, s.
`ci.yml:97-101`):

```
supabase test db supabase/tests/grants_test.sql supabase/tests/rls_test.sql \
  supabase/tests/directory_search_test.sql
```

## 1. Den Widerspruch im offenen Delta auflösen

- [x] 1.1 In `openspec/changes/member-activation-flow/specs/access-control/spec.md`
      den Satz „Ein erneuter Versand an ein bereits aktiviertes Konto SHALL keine
      Mail auslösen" auf **Aktivierungsmail** verengen, mit Verweis auf AGE-505.
- [x] 1.2 Das Szenario „Anfordern für ein bereits aktiviertes Konto" entsprechend
      verengen: keine **Aktivierungs**mail.
- [x] 1.3 Die Änderung in `member-activation-flow/REVIEWS.md` vermerken — ein
      bereits reviewtes Delta wurde angefasst; wer es gelesen hat, muss das sehen.
- [x] 1.4 `openspec validate --all` grün.

## 2. Datenbank — der Zweig wandert

- [ ] 2.1 **RED:** In `rls_test.sql` einen Block ergänzen, der für ein
      **aktiviertes** Profil `issued_reset` erwartet, plus genau ein offenes
      Token. Muss fehlschlagen, solange `already_activated` zurückkommt.
      `plan(N)` mitziehen.
- [ ] 2.2 **RED:** Assertions, dass die drei Grenzen auch auf dem Reset-Weg
      greifen — 60-s-Sperre, Schutzfenster (offener Link wird nicht entwertet),
      Tageskontingent. Das ist der Kern von Entscheidung 2 im `design.md`; ohne
      diese Assertions ist die Umstellung der Reihenfolge ungeprüft.
- [ ] 2.3 **RED:** Assertion, dass `already_activated` von
      `issue_activation_token` **nicht mehr** kommt — sonst merkt niemand, wenn
      der Zweig versehentlich wieder vorne landet.
- [ ] 2.4 **GREEN:** Migration `<ts>_activation_token_reset_zweck.sql` —
      Neudeklaration von `issue_activation_token`. Kopf trägt Befund,
      Entscheidung, verworfene Alternative (Spalte `purpose`) und die Begründung
      für die neue Reihenfolge.
- [ ] 2.5 Belegen, dass `request_own_activation_token` **unverändert** ist und
      seinen `already_activated`-Zweig behält (Non-Goal aus `design.md`).
- [ ] 2.6 Grants unverändert: `issue_activation_token` bleibt `service_role`-only.
      Die vorhandenen Assertions müssen weiter halten.

## 3. Versand — zweiter Text, zweite Zieladresse

- [ ] 3.1 **RED:** In `supabase/functions/send-activation/emails.test.ts` prüfen,
      dass der Reset-Text die Gültigkeitsdauer, die **Abmeldung aller Geräte**
      und den Ignorieren-Hinweis trägt — und dass er nicht zur Aktivierung
      auffordert.
- [ ] 3.2 **RED:** Prüfen, dass die Reset-URL auf `/passwort-neu` zeigt und die
      Aktivierungs-URL unverändert auf `/aktivierung`.
- [ ] 3.3 **GREEN:** `renderPasswordReset` und die zweite URL-Form in
      `emails.ts`.
- [ ] 3.4 **GREEN:** `send-activation/index.ts` akzeptiert `issued_reset` und
      wählt daran Text und URL. Der `status !== "issued"`-Zweig muss beide
      Erfolgsfälle durchlassen — sonst schluckt er den Reset still.
- [ ] 3.5 Absender und `reply_to` unverändert (`effbeezee.com` / Club-Domain).
      Der Reset-Text sagt dieselbe Zusage zu wie der Aktivierungstext, also muss
      sie auch hier wahr sein.

## 4. Oberfläche

- [ ] 4.1 **RED:** `LoginPage.test.tsx` — die Anmeldeseite trägt einen sichtbaren
      Weg zum Zurücksetzen.
- [ ] 4.2 **RED:** Test für `/passwort-vergessen`: Adressformular, danach die
      Alle-Ausgänge-Meldung mit Rückkanal (dieselbe Regel wie 11.6).
- [ ] 4.3 **RED:** Test für `/passwort-neu`: Token aus dem Fragment, Passwort
      setzen, danach `/login` — und die Wortwahl spricht vom **Passwort**, nicht
      vom Bestätigen eines Zugangs.
- [ ] 4.4 **GREEN:** Zweck-Schalter am Einlöse-Bauteil, zwei Routen in `App.tsx`,
      Link auf `LoginPage.tsx`.
- [ ] 4.5 Die Adresszeile wird auch auf `/passwort-neu` aufgeräumt — das Token
      darf dort so wenig stehenbleiben wie auf `/aktivierung`.
- [ ] 4.6 **Lokal zeigen, bevor committet wird.** Grüne Tests haben in AGE-492
      ein visuell falsches Ergebnis durchgewunken.

## 5. Gates

- [ ] 5.1 `database-sentinel` auf den Diff — die Migration ist eine
      Neudeklaration einer SECURITY-DEFINER-Function.
- [ ] 5.2 Vollständige Verifikation: pgTAP (Dateiliste!), `pnpm test`,
      `pnpm typecheck`, `pnpm typecheck:functions`,
      `deno test --frozen --allow-env --allow-net supabase/functions/`.
- [ ] 5.3 `openspec validate --all` grün.
- [ ] 5.4 Unabhängiger Code-Review auf den **Diff** (Schritt 4 des Workflows).
      Löst Donald aus.

## 6. Ausrollen — drei Flächen, drei Befehle

- [ ] 6.1 Merge trägt nur das Frontend. Nach dem Merge prüfen, dass `migrate-dev`
      auf `main` gelaufen ist (auf dem PR ist es zu Recht übersprungen,
      `deploy.yml:36`).
- [ ] 6.2 `supabase functions deploy send-activation` auf **beiden** Refs — kein
      Workflow tut das (`grep 'functions deploy' .github/` ist leer). Genau diese
      Lücke hat AGE-495 schon einmal als „live" gemeldet, während nichts
      deployt war.
- [ ] 6.3 Am echten Konto messen, nicht am Testdoppel: aktiviertes Konto →
      `/passwort-vergessen` → Mail → `/passwort-neu` → Anmeldung mit dem neuen
      Passwort. Reihenfolge beim Messen: Mitschnitt leeren → handeln →
      **Netzwerk lesen** → Screenshot.
- [ ] 6.4 Belegen, dass `activated_at` dabei **unverändert** geblieben ist.

## 7. Nachlauf

- [ ] 7.1 AGE-505 in Linear auf Done — vorher `get_issue` lesen, die Automation
      schaltet den Status bei PR-Merge selbst.
- [ ] 7.2 11.7 in `member-activation-flow/tasks.md` als hierher verlagert
      abhaken, mit Verweis auf AGE-505.
- [ ] 7.3 `openspec archive` erst, wenn 6.3 gemessen ist — nicht, wenn der Code
      existiert.
