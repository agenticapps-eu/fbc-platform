## 0. Vor der ersten Codezeile

- [x] 0.1 `openspec validate --all` grün — das ist die einzige Bedingung, die
      das Gate prüft
- [x] 0.2 Plan-Review (Schritt 2b): gemini und codex über das Delta, beide
      REQUEST-CHANGES, Ergebnis und Auflösung in `REVIEWS.md`. Die
      übernommenen Befunde stehen als Aufgaben unten drin, nicht nur im Text

## 1. Schema und Admin-Weg

- [x] 1.1 Migration `supabase/migrations/<ts>_profile_address_fields.sql`
      anlegen: `street`, `postal_code`, `city`, `state`, `country` als `text`
      auf `public.profile_contacts`, alle nullable, kein Spalten-Default
      (Entscheidung 3). Kopf trägt Begründung, verworfene Alternative und
      AGE-537
- [x] 1.2 `comment on column` je Spalte — insbesondere die Abgrenzung zu
      `profiles.region` (Regionalgruppe, nicht Wohnort)
- [x] 1.3 **Den Tabellenkommentar richtigstellen** (Review, LOW): er behauptet
      „owner-only" und eine erst *künftige* Freigabeaktion; die gibt es seit dem
      14.06., und sie umfasst jetzt die Anschrift
- [x] 1.4 In derselben Migration `admin_update_profile` per `create or replace`:
      fünf Schlüssel in die Weißliste, fünf Felder in den
      `profile_contacts`-Upsert, im vorhandenen `case when patch ? '…'`-Muster
- [x] 1.5 Migration auf den **lokalen** Stack angewendet und dort nachgelesen.
      Bewusst nicht auf DEV: DEV ist die Datenbank, die die Live-Seite liest
      (`fbc-platform.pages.dev` zeigt auf `foelowldexkcqzewvrcf`), und ein
      `db:push` dorthin wäre eine Änderung an der laufenden Plattform vor dem
      Merge. Der Weg auf DEV/PROD ist die Pipeline, nicht diese Sitzung
- [ ] 1.6 **Offen:** `migrate-dev` läuft beim Merge, `migrate-prod` danach per
      Dispatch — Dry-Run vorher lesen

## 2. Der Beleg in pgTAP (RED vor GREEN)

- [x] 2.1 `supabase/tests/rls_test.sql`: Szenario „ohne angenommene
      Kontaktanfrage liefert die Anschrift nichts" — vor der Migration rot,
      danach grün. `alike()` statt `like()`, und `try_as()` meldet jeden Fehler
      als DENIED
- [x] 2.2 Gegenprobe: nach `accepted` trägt dieselbe Zeile die fünf Felder
- [x] 2.3 Der Eigentümer schreibt seine Anschrift per Upsert — **zweimal im
      selben Test** (Review, MEDIUM): der erste Lauf belegt den INSERT-Zweig,
      der zweite den `ON CONFLICT DO UPDATE`-Pfad, den Entscheidung 4 behauptet.
      Danach genau eine Zeile mit dem geänderten Wert
- [x] 2.4 Admin-RPC in pgTAP (Review, HIGH): `admin_update_profile` legt alle
      fünf Felder an und ändert sie
- [x] 2.5 Admin-RPC: ein **fehlender** Schlüssel lässt das Feld unverändert, ein
      Schlüssel mit JSON-`null` leert es
- [x] 2.6 Admin-RPC: ein Konto ohne `admin`-Rolle prallt auch mit Adressfeldern
      ab, und keine Zeile ändert sich
- [x] 2.7 `admin_get_profile` liefert die fünf Felder zurück, und der Aufruf
      hinterlässt eine Zeile in `admin_audit`
- [x] 2.8 `supabase test db` **mit Dateiliste** ausführen (ohne Liste meldet
      der Befehl FAIL wegen der `probe_*.sql`), `grants_test.sql` muss
      unverändert grün bleiben

## 3. Datenschicht

- [x] 3.1 `src/lib/database.types.ts`: fünf Spalten in `Row`, `Insert` und
      `Update` von `profile_contacts` (handgepflegt, kein Generierungs-Script)
- [x] 3.2 Test rot: `src/lib/profile.test.ts` erwartet Laden und Speichern der
      Kontaktzeile (Upsert auf `profile_id`, leere Felder → `null`)
- [x] 3.3 Test rot: das Formular belegt `country` **gar nicht** vor (Review,
      MEDIUM). Die erste Antwort auf den Befund war eine Bedingung („nur wenn
      keine Zeile existiert"); beim Bauen war die Fassung ohne Vorbelegung
      kürzer und lässt den Fehler nicht zu — „DE" ist nur Platzhalter, gesetzt
      wird es vom Import
- [x] 3.4 Test rot: eine unbrauchbare Kontakt-E-Mail wird abgewiesen und
      schreibt nichts (Review, MEDIUM)
- [x] 3.5 `src/lib/profile.ts`: Kontaktfelder ins `profileFormSchema` (E-Mail
      mit zod-`email`), Laden in `loadProfile` samt Vorbelegungszweig, Upsert in
      `saveProfile`. `computeProfileCompletion` bleibt bei zwölf Feldern —
      nicht anfassen
- [x] 3.6 `src/lib/contact-requests.ts`: `fetchContactRelation` wählt die fünf
      Spalten mit aus und reicht sie durch

## 4. Editor

- [x] 4.1 Test rot: der Kontaktblock rendert Anschrift, E-Mail und Telefon, gibt
      sie beim Speichern weiter und trägt den Hinweis, dass sie nach einer
      angenommenen Kontaktanfrage sichtbar sind
- [x] 4.2 `src/components/profile/ProfileFieldsets.tsx`: Kontaktblock im
      bestehenden Stil, kein Feld Pflicht, `type="email"` auf der Kontakt-E-Mail
- [x] 4.3 `src/pages/ProfilPage.tsx` verdrahtet den Block; Sichtprobe im
      laufenden `pnpm dev`, nicht nur grüne Tests
- [x] 4.4 Admin-Editor: `src/lib/admin-profile.ts` und
      `src/pages/AdminMitgliedPage.tsx` schicken die fünf Felder im Patch, mit
      `type="email"` auf der Kontaktadresse (Test rot zuerst). Entscheidung 5
      **umgedreht**: `AdminContact` ist jetzt dieselbe Struktur wie im eigenen
      Editor, und beide Seiten benutzen `ProfileContactFieldset`. Der Reviewer
      hatte recht — mit getrennter Struktur wäre im Admin-Formular ein totes
      Feld stehen geblieben, das `profileFormSchema` trotzdem verlangt

## 5. Profilansicht und Annahme-Dialog

- [x] 5.1 Test rot: `PublicProfilePage` zeigt die Anschrift nur bei
      freigegebener Kontaktzeile und trägt sonst denselben Hinweis wie bei
      Telefon und E-Mail
- [x] 5.2 Anzeige umsetzen, in beiden Themes ansehen (hell und `navy`)
- [x] 5.3 Test rot: der Annahme-Dialog nennt Anschrift ausdrücklich (Review,
      HIGH) — `src/components/mein-bereich/kontakte-widgets.tsx` und die
      Hinweistexte in `MeineChancenPage` / `PublicProfilePage`, die heute nur
      „Kontaktdaten" sagen
- [x] 5.4 Texte anpassen

## 6. Branche

- [x] 6.1 `src/config/branchen.ts`: kuratierte Liste (10–15 Werte) mit
      Stichwörtern je Branche, deklarativ wie `config/compass.ts`
- [x] 6.2 Test rot: `matchBranche(freitext)` trifft über ein Stichwort, liefert
      bei Unbekanntem `null`, ist gegen Groß-/Kleinschreibung unempfindlich —
      und liefert bei **Treffern aus zwei Branchen** ebenfalls `null` (Review,
      HIGH)
- [x] 6.3 Funktion umsetzen — rein, ohne Datenbank und ohne Netz, importierbar
      aus einem `tsx`-Script (C10 läuft ohne Browser)
- [x] 6.4 Editor-Feld `branche` wird eine Auswahl; ein Bestandswert außerhalb
      der Liste erscheint als zusätzliche Option und geht beim Speichern nicht
      verloren (Test rot zuerst)

## 7. Abschluss

- [x] 7.1 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` grün, Ausgabe
      gelesen statt behauptet
- [ ] 7.2 Code-Review auf dem **Diff** (Schritt 4), Ergebnis festgehalten
- [x] 7.3 Sichtprobe gegen den **lokalen** Stack, mit zwei echten Konten und
      einer angenommenen Anfrage. Sie hat einen Fehler gefunden, den alle drei
      grünen Tests durchgelassen hatten: das Branchenfeld fiel nach `reset()`
      auf „Keine Angabe" zurück, weil die Zusatzoption erst danach entstand —
      das nächste Speichern hätte die Branche gelöscht. Behoben mit einem
      `Controller`; jsdom bildet das nicht ab, der Test blieb auch vorher grün
- [ ] 7.4 Verifikation gegen Abnahmeliste in AGE-537, dann archivieren und
      ausliefern
