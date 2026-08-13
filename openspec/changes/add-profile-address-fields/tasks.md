## 0. Vor der ersten Codezeile

- [x] 0.1 `openspec validate --all` grün — das ist die einzige Bedingung, die
      das Gate prüft
- [x] 0.2 Plan-Review (Schritt 2b): gemini und codex über das Delta, beide
      REQUEST-CHANGES, Ergebnis und Auflösung in `REVIEWS.md`. Die
      übernommenen Befunde stehen als Aufgaben unten drin, nicht nur im Text

## 1. Schema und Admin-Weg

- [ ] 1.1 Migration `supabase/migrations/<ts>_profile_address_fields.sql`
      anlegen: `street`, `postal_code`, `city`, `state`, `country` als `text`
      auf `public.profile_contacts`, alle nullable, kein Spalten-Default
      (Entscheidung 3). Kopf trägt Begründung, verworfene Alternative und
      AGE-537
- [ ] 1.2 `comment on column` je Spalte — insbesondere die Abgrenzung zu
      `profiles.region` (Regionalgruppe, nicht Wohnort)
- [ ] 1.3 **Den Tabellenkommentar richtigstellen** (Review, LOW): er behauptet
      „owner-only" und eine erst *künftige* Freigabeaktion; die gibt es seit dem
      14.06., und sie umfasst jetzt die Anschrift
- [ ] 1.4 In derselben Migration `admin_update_profile` per `create or replace`:
      fünf Schlüssel in die Weißliste, fünf Felder in den
      `profile_contacts`-Upsert, im vorhandenen `case when patch ? '…'`-Muster
- [ ] 1.5 `pnpm db:push` gegen DEV, danach in DEV nachlesen, dass die Spalten
      stehen (nicht auf die Ausgabe von `db push` verlassen)

## 2. Der Beleg in pgTAP (RED vor GREEN)

- [ ] 2.1 `supabase/tests/rls_test.sql`: Szenario „ohne angenommene
      Kontaktanfrage liefert die Anschrift nichts" — vor der Migration rot,
      danach grün. `alike()` statt `like()`, und `try_as()` meldet jeden Fehler
      als DENIED
- [ ] 2.2 Gegenprobe: nach `accepted` trägt dieselbe Zeile die fünf Felder
- [ ] 2.3 Der Eigentümer schreibt seine Anschrift per Upsert — **zweimal im
      selben Test** (Review, MEDIUM): der erste Lauf belegt den INSERT-Zweig,
      der zweite den `ON CONFLICT DO UPDATE`-Pfad, den Entscheidung 4 behauptet.
      Danach genau eine Zeile mit dem geänderten Wert
- [ ] 2.4 Admin-RPC in pgTAP (Review, HIGH): `admin_update_profile` legt alle
      fünf Felder an und ändert sie
- [ ] 2.5 Admin-RPC: ein **fehlender** Schlüssel lässt das Feld unverändert, ein
      Schlüssel mit JSON-`null` leert es
- [ ] 2.6 Admin-RPC: ein Konto ohne `admin`-Rolle prallt auch mit Adressfeldern
      ab, und keine Zeile ändert sich
- [ ] 2.7 `admin_get_profile` liefert die fünf Felder zurück, und der Aufruf
      hinterlässt eine Zeile in `admin_audit`
- [ ] 2.8 `supabase test db` **mit Dateiliste** ausführen (ohne Liste meldet
      der Befehl FAIL wegen der `probe_*.sql`), `grants_test.sql` muss
      unverändert grün bleiben

## 3. Datenschicht

- [ ] 3.1 `src/lib/database.types.ts`: fünf Spalten in `Row`, `Insert` und
      `Update` von `profile_contacts` (handgepflegt, kein Generierungs-Script)
- [ ] 3.2 Test rot: `src/lib/profile.test.ts` erwartet Laden und Speichern der
      Kontaktzeile (Upsert auf `profile_id`, leere Felder → `null`)
- [ ] 3.3 Test rot: eine vorhandene Kontaktzeile mit leerem `country` bleibt
      nach Laden und Speichern leer; nur ein Profil **ohne** Kontaktzeile
      bekommt „DE" vorbelegt (Review, MEDIUM)
- [ ] 3.4 Test rot: eine unbrauchbare Kontakt-E-Mail wird abgewiesen und
      schreibt nichts (Review, MEDIUM)
- [ ] 3.5 `src/lib/profile.ts`: Kontaktfelder ins `profileFormSchema` (E-Mail
      mit zod-`email`), Laden in `loadProfile` samt Vorbelegungszweig, Upsert in
      `saveProfile`. `computeProfileCompletion` bleibt bei zwölf Feldern —
      nicht anfassen
- [ ] 3.6 `src/lib/contact-requests.ts`: `fetchContactRelation` wählt die fünf
      Spalten mit aus und reicht sie durch

## 4. Editor

- [ ] 4.1 Test rot: der Kontaktblock rendert Anschrift, E-Mail und Telefon, gibt
      sie beim Speichern weiter und trägt den Hinweis, dass sie nach einer
      angenommenen Kontaktanfrage sichtbar sind
- [ ] 4.2 `src/components/profile/ProfileFieldsets.tsx`: Kontaktblock im
      bestehenden Stil, kein Feld Pflicht, `type="email"` auf der Kontakt-E-Mail
- [ ] 4.3 `src/pages/ProfilPage.tsx` verdrahtet den Block; Sichtprobe im
      laufenden `pnpm dev`, nicht nur grüne Tests
- [ ] 4.4 Admin-Editor: `src/lib/admin-profile.ts` und
      `src/pages/AdminMitgliedPage.tsx` schicken die fünf Felder im Patch, mit
      `type="email"` auf der Kontaktadresse (Test rot zuerst). Das eigene
      `AdminContact` bleibt — Entscheidung 5

## 5. Profilansicht und Annahme-Dialog

- [ ] 5.1 Test rot: `PublicProfilePage` zeigt die Anschrift nur bei
      freigegebener Kontaktzeile und trägt sonst denselben Hinweis wie bei
      Telefon und E-Mail
- [ ] 5.2 Anzeige umsetzen, in beiden Themes ansehen (hell und `navy`)
- [ ] 5.3 Test rot: der Annahme-Dialog nennt Anschrift ausdrücklich (Review,
      HIGH) — `src/components/mein-bereich/kontakte-widgets.tsx` und die
      Hinweistexte in `MeineChancenPage` / `PublicProfilePage`, die heute nur
      „Kontaktdaten" sagen
- [ ] 5.4 Texte anpassen

## 6. Branche

- [ ] 6.1 `src/config/branchen.ts`: kuratierte Liste (10–15 Werte) mit
      Stichwörtern je Branche, deklarativ wie `config/compass.ts`
- [ ] 6.2 Test rot: `matchBranche(freitext)` trifft über ein Stichwort, liefert
      bei Unbekanntem `null`, ist gegen Groß-/Kleinschreibung unempfindlich —
      und liefert bei **Treffern aus zwei Branchen** ebenfalls `null` (Review,
      HIGH)
- [ ] 6.3 Funktion umsetzen — rein, ohne Datenbank und ohne Netz, importierbar
      aus einem `tsx`-Script (C10 läuft ohne Browser)
- [ ] 6.4 Editor-Feld `branche` wird eine Auswahl; ein Bestandswert außerhalb
      der Liste erscheint als zusätzliche Option und geht beim Speichern nicht
      verloren (Test rot zuerst)

## 7. Abschluss

- [ ] 7.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün, Ausgabe
      gelesen statt behauptet
- [ ] 7.2 Code-Review auf dem **Diff** (Schritt 4), Ergebnis festgehalten
- [ ] 7.3 Sichtprobe gegen DEV: eintragen, ausloggen, mit zweitem Konto ohne
      Anfrage nachsehen, dann mit angenommener Anfrage
- [ ] 7.4 Verifikation gegen Abnahmeliste in AGE-537, dann archivieren und
      ausliefern
