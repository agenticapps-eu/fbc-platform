# Tasks — push-token-aufraeumen (AGE-682)

Reihenfolge ist TDD, und Hälfte 1 kommt vor Hälfte 2: ohne echtes Lebenszeichen
darf der Aufräumer nicht existieren.

## 1 · Hälfte 1 — RED: das stille Erneuern

- [x] `src/lib/push.test.ts` (bzw. die bestehende Datei) um Zusagen erweitern:
      Erlaubnis `granted` → `register()` läuft und `requestPermissions()` wird
      **nicht** gerufen · Erlaubnis `prompt` → **weder** `requestPermissions()`
      **noch** `register()` · Web-Fläche → nichts von beidem.
- [x] `AppShell` — Zusage, dass der Start-Effekt `pushLebenszeichen` ruft,
      **ohne** dass die Nachrichten offen sind, und dass der bestehende
      Nachrichten-Effekt weiterhin `pushEinrichten` ruft.
- [x] Rot sehen, und die Meldung lesen.

## 2 · Hälfte 1 — GREEN

- [x] `src/lib/push.ts`: internes `registriere(darfFragen: boolean)`, dazu
      `pushEinrichten()` (wie bisher) und `pushLebenszeichen()` (ohne
      `requestPermissions`). Der Zuhörer-Riegel `zuhoererStehen` gilt für beide
      — sonst hängt der zweite Weg einen zweiten Zuhörer an.
- [x] `AppShell.tsx`: eigener Effekt beim Montieren, nach dem Vorbild des
      Mitteilungs-Zuhörers gleich darunter. **Nicht** in den
      Nachrichten-Effekt hineinschreiben.
- [x] Grün sehen.

## 3 · Hälfte 2 — RED: der pgTAP-Lauf vor der Funktion

- [x] `supabase/tests/push_token_aufraeumen_test.sql` mit **drei** Tokenzeilen:
      deutlich über der Frist (muss weg) · deutlich darunter (muss bleiben) ·
      **einen Tag** unter der Frist (muss bleiben — der Grenzfall).
- [x] Das Lebenszeichen der bleibenden Zeile über `claim_push_token` erzeugen,
      nicht über ein direktes `update`. Sonst prüft der Lauf seine eigene
      Fixture statt des Weges.
- [x] Weitere Zusagen: ein fälliger Auftrag auf ein abgestandenes Token wird von
      `push_auftraege_faellig()` **nicht** mehr vergeben · `notifications`
      bleibt unangetastet · `anon`, `authenticated` **und** `service_role`
      dürfen die Funktion nicht rufen.
- [x] Rot sehen. Die Meldung muss „function `push_tokens_aufraeumen` does not
      exist" heissen. `supabase test db` ohne Dateiliste ist kein Beleg —
      Datei ausdrücklich nennen.

## 4 · Hälfte 2 — GREEN: die Migration

- [x] `supabase/migrations/<ts>_push_token_aufraeumen.sql`.
- [x] `public.push_tokens_aufraeumen() returns int`, `language plpgsql`,
      `security definer`, `set search_path = ''`. Löscht, wo
      `letzter_kontakt < now() - interval '180 days'`. **Kein Parameter.**
- [x] `revoke execute on function public.push_tokens_aufraeumen()
      from public, anon, authenticated, service_role;`
- [x] `comment on function` mit der Begründung der 180 Tage: Firebases Beispiel
      sind 30 Tage plus monatliches Erneuern, Androids Selbstverfall 270, und
      die Kosten sind asymmetrisch. Eine Frist für beide Plattformen.
- [x] `create or replace function public.push_auftraege_faellig(...)` — Rumpf
      aus `20260828100000:134` **wörtlich übernommen**, davor als erste
      Anweisung `perform public.push_tokens_aufraeumen();`. Signatur und
      Rückgabetabelle unverändert.
- [x] **Den falschen Spaltenkommentar korrigieren:**
      `comment on column public.push_tokens.letzter_kontakt` sagt heute „bei
      jedem Start". Neu: gesetzt beim Öffnen der Nachrichten **und** bei jedem
      nativen App-Start mit erteilter Erlaubnis (AGE-682).
- [x] Grün sehen, mit Dateiliste.

## 5 · Gegenprobe — misst der Lauf die Funktion oder sich selbst?

- [x] Mutation A: Frist auf ein Jahrhundert → „alte Zeile weg" muss röten.
- [x] Mutation B: `perform` aus `push_auftraege_faellig` entfernen → die Zusage
      über den unterdrückten fälligen Auftrag muss röten. Rötet keine, prüft
      der Lauf die Verdrahtung nicht.
- [x] Mutation C: Bedingung auf `>` drehen → die Positivkontrolle muss röten.
- [x] Mutation D: `requestPermissions` im Lebenszeichen-Weg wieder einsetzen →
      die Zusage „fragt nicht" muss röten.
- [x] Jede Mutation zurücknehmen und den grünen Lauf erneut sehen.

## 6 · Dokumentation

- [x] `docs/secrets.md`: der Minutenlauf tut jetzt zwei Dinge. Ausdrücklich
      hinschreiben, dass `push_wiederholung()` **unverändert** bleibt, damit
      niemand sie beim nächsten Anfassen „nachzieht".
- [x] `openspec/changes/push-fundament/tasks.md`: „Tote Gerätetokens aufräumen"
      auf erledigt, mit Verweis auf AGE-682. Der Punkt darüber („Ungültiges
      Token wird nach Ablehnung entfernt") bleibt offen — Gerätebeleg, kein
      Code.

## 7 · Abnahme

- [x] `openspec validate --all` grün.
- [x] `supabase test db --local supabase/tests/push_token_aufraeumen_test.sql`
      grün (14/14), **und** `push_zustellung_test.sql` plus
      `push_tokens_test.sql` ebenfalls (34/34) — die Migration fasst
      `push_auftraege_faellig` an. (Die CLI kennt kein `--file`; der Pfad steht
      als Argument, die Seite als `--local`.)
- [x] `pnpm test` 2411/2411 in 217 Dateien · `pnpm typecheck` Exit 0 ·
      `pnpm lint` Exit 0. `pnpm format:check` ist Exit 1, aber mit **303**
      bestehenden Fremddateien und **keiner** aus diesem Diff — `pnpm format`
      schriebe rund 60 fremde Dateien um und bleibt deshalb aus.
- [ ] Fremdreview auf den Diff — Migration und Rechte.
- [ ] Im PR-Text: solange `push_tokens` fast leer ist, belegt der grüne Lauf die
      Funktion, nicht den Betrieb. Der Betriebsbeleg kommt mit den echten
      Geräten aus AGE-642. Und: das Löschen eines gültigen Tokens ist eine
      **zustellungsbrechende** Änderung, deren Rückweg der nächste App-Start
      ist — das ist der Grund für Hälfte 1.
