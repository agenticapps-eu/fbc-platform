# Aufgaben — Rechte-Matrix: Verzeichnis ab connect, Kontaktanfragen nach Stufe

Linear: AGE-598 · [proposal.md](./proposal.md) · [design.md](./design.md)

**TDD gilt durchgehend: RED vor GREEN.** Bei den RLS-Aufgaben heißt RED ein
pgTAP-Test, der gegen das *heutige* Schema fehlschlägt — nicht einer, der ohne
Sonde durchläuft.

## 1. Fremdreview vor der ersten Codezeile

- [ ] 1.1 `openspec validate --all` grün (erledigt beim Anlegen: 32/32) — vor
      dem Review erneut fahren, falls der Delta sich noch ändert
- [ ] 1.2 `openspec-change-review` mit **≥2 Reviewern anderer Anbieter** über
      den Delta laufen lassen, `REVIEWS.md` schreiben (Trailer nicht vergessen —
      von Hand gezählte Reviews zählen nicht)
- [ ] 1.3 Einwände abarbeiten oder begründet zurückweisen; bei Änderungen am
      Delta 1.1 wiederholen
- [ ] 1.4 `cso` über den Delta: beide Änderungen sind Rechte-Änderungen

## 2. Positivkontrollen sichern, bevor irgendetwas wackelt

Diese Gruppe schreibt **keine** neue Funktionalität. Sie stellt sicher, dass ein
Rückschritt auffällt — ohne sie sieht ein Schaden an der Rang-3-Grenze wie ein
Erfolg aus.

- [ ] 2.1 Bestehende `rls_test.sql`-Zusagen zur Rang-3-Grenze auf dem lokalen
      Stack fahren und die Zahl der bestandenen Zusagen **notieren**; sie ist
      die Grundlinie
- [ ] 2.2 **RED**: pgTAP-Zusage, dass ein `discover`-Konto `competencies`
      **gefüllt** aus `search_directory` bekommt — muss heute schon grün sein
      und ist die Gegenprobe, nicht der Fortschritt
- [ ] 2.3 **RED**: pgTAP-Zusage, dass ein `connect`-Konto heute nur die
      **eigene** Zeile aus `search_directory` bekommt — dokumentiert den
      Ist-Zustand, den 3.x umdreht

## 3. Verzeichnisliste ab `connect` (Teil A)

- [ ] 3.1 **RED**: pgTAP — `connect`-Konto erhält die Basisfelder **aller**
      öffentlichen Profile aktivierter Eigentümer aus `search_directory`
- [ ] 3.2 **RED**: pgTAP — dasselbe `connect`-Konto erhält für **fremde** Zeilen
      `competencies`, `offer_categories`, `need_categories` als leere Arrays und
      `has_offers`/`has_needs` false; für die **eigene** Zeile gefüllt
- [ ] 3.3 **RED**: pgTAP — ein `basic`-Konto erhält weiterhin höchstens die
      eigene Zeile
- [ ] 3.4 **GREEN**: Migration — `search_directory` neu: Eintrittstor bei Rang 2,
      Basisfelder aus `profiles_public`, erweiterte Spalten weiterhin aus
      `public.profiles` unter der unveränderten Rang-3-Policy. Die Zahl `3`
      SHALL im neuen Rumpf **nicht** vorkommen
- [ ] 3.5 Prüfen, dass die Migration `profiles_select_self_or_discover`
      **nicht** anfasst — `grep` über den Migrationsrumpf, nicht aus dem
      Gedächtnis
- [ ] 3.6 2.2 erneut fahren: muss **weiterhin grün** sein
- [ ] 3.7 `src/config/nav.ts:95` — `minTier` von `discover` auf `connect`, mit
      Begründung im Kommentar daneben
- [ ] 3.8 Test für 3.7: `/mitglieder` trägt `minTier: "connect"`

## 3b. Das Volltext-Orakel schliessen (Befund opencode HIGH-1)

Ohne diese Gruppe macht 3.x aus der Maskierung eine Kulisse: die Spalte wäre
verborgen und über das Suchfeld erfragbar.

- [ ] 3b.1 **RED**: pgTAP — ein `connect`-Konto sucht einen Begriff, der **nur**
      in `competencies` oder `interests` eines fremden Profils vorkommt, und
      findet die Zeile **nicht**
- [ ] 3b.2 **RED**: pgTAP — dasselbe Konto findet dieselbe Zeile über
      Firmenname, Region oder Branche sehr wohl
- [ ] 3b.3 **RED**: pgTAP — ein `discover`-Konto findet den Kompetenz-Begriff
      weiterhin. Positivkontrolle: die Bindung darf die Suche für Berechtigte
      nicht verengen
- [ ] 3b.4 **GREEN**: zweiter tsvector über `name`, `company`, `region`,
      `short_bio`, `branche`; Bindung in `search_directory` nach der Form aus
      AGE-291 (Entscheidung 3, Volltext ans Recht binden)
- [ ] 3b.5 Prüfen, dass `search_doc` selbst **unverändert** bleibt — es bedient
      weiterhin Rang 3 und die Kopfzeilen-Suche

## 3c. `branche` wird Basisfeld (Befund opencode HIGH-2)

- [ ] 3c.1 **RED**: pgTAP — ein `connect`-Konto bekommt `branche` **gefüllt**
      aus `search_directory`, und `p_branche` filtert für es korrekt
- [ ] 3c.2 **GREEN**: `branche` in `profiles_public` aufnehmen; Grants nach dem
      `create or replace view` erneut aussprechen
- [ ] 3c.3 Gegenprobe: die View gibt weiterhin **keine** erweiterten Felder her
- [ ] 3c.4 Die Spalten-Aufzählung im Delta gegen den tatsächlichen
      Rückgabetyp von `search_directory` abgleichen — **jede** Spalte ist
      entweder Basis oder erweitert, keine ohne Zuordnung

## 4. Filter, die ein `connect`-Konto nicht bedienen kann

Entschieden in D5: sie werden **ausgeblendet**, nicht leer laufen gelassen.

- [ ] 4.1 **RED**: Frontend-Test — ein `connect`-Konto sieht die Filter für
      Kompetenz, Biete-/Suche-Kategorien, Thema und Angebotsart **gar nicht**
- [ ] 4.2 **RED**: Frontend-Test — an ihrer Stelle steht ein Hinweis, ab welcher
      Stufe es sie gibt; das Ausblenden allein wäre ein zweites Verschweigen
- [ ] 4.3 **RED**: Frontend-Test — der Branchenfilter bleibt für `connect`
      sichtbar und funktionsfähig (er filtert nach 3c auf einem Basisfeld)
- [ ] 4.4 **GREEN**: umsetzen. Die drei Leerzustände aus `directory-search`
      („Fehler" · „Stufe zu niedrig" · „echter Nulltreffer") bleiben
      unterscheidbar und unberührt

## 5. Gestaffelte Kontaktanfragen (Teil B)

- [ ] 5.1 **RED**: pgTAP für das Prädikat `darf_kontaktanfrage_senden(uuid)` —
      über **alle sechs** Absenderstufen gegen mindestens `connect` und
      `impact` als Ziel. Ein Test gegen nur `basic` und `discover` sieht die
      `connect`→`connect`-Regel nicht
- [ ] 5.2 **GREEN**: Migration — Prädikat anlegen (`stable`,
      `security definer`, `set search_path = ''`), `revoke` von `public`/`anon`,
      `grant execute` an `authenticated` **ausdrücklich** (neue Funktionen
      erben nichts)
- [ ] 5.3 **RED**: pgTAP — `cr_insert_self` lehnt bei `open_contact = false` die
      Anfrage eines `basic`-Kontos ab und lässt `connect`→`connect` durch
- [ ] 5.4 **GREEN**: `cr_insert_self` neu setzen — Klausel 320 wird
      `( is_contact_open() or darf_kontaktanfrage_senden(to_id) )`
- [ ] 5.5 **RED**: pgTAP — die vier unverändert geltenden Zusagen
      (Selbst-`from_id`, `pending`, `match_id`-Paarbindung, `is_contactable`)
      halten in **beiden** Schalterstellungen
- [ ] 5.6 `grants_test.sql` nachziehen: das neue Prädikat bricht sonst den
      Golden-Snapshot in CI

## 6. Welpenschutz bekommt einen eigenen Schalter

- [ ] 6.1 **RED**: pgTAP — **nach** der Migration und ohne dass jemand eine
      Einstellung ändert, geht eine Kaltanfrage an ein Konto jünger als 30 Tage
      weiterhin durch. Das ist die Zusage „das Ausrollen legt nichts um", und
      sie ist die wichtigste dieser Gruppe
- [ ] 6.2 **RED**: pgTAP — mit `welpenschutz_aktiv = true` wird dieselbe Anfrage
      abgelehnt, **auch wenn** `open_contact` auf `true` steht
- [ ] 6.3 **RED**: pgTAP — dieselbe Anfrage **mit** paar-eigenem `match_id` geht
      durch
- [ ] 6.4 **RED**: pgTAP — ein Nicht-Admin darf `welpenschutz_aktiv` nicht
      schreiben
- [ ] 6.5 **GREEN**: Spalte `welpenschutz_aktiv boolean not null default false`
      in `platform_settings`, Spalten-`grant update` wie bei `open_contact`,
      Prädikat `ist_welpenschutz_aktiv()`; Klausel 332 zu
      `( not ist_welpenschutz_aktiv() or match_id is not null
        or not is_new_member(to_id) )`
- [ ] 6.6 Gegenprobe, dass 5.x weiterhin grün ist: `open_contact` muss die
      Staffelung noch aufheben können und den Welpenschutz **nicht** mehr

## 6b. Das Alter des Bestands messen (Befund opencode HIGH-4)

Blockiert **nicht** das Ausrollen — die Vorgabe `false` schützt davor. Es
blockiert das Umlegen des Schalters.

- [ ] 6b.1 Auf PROD lesen, wie `profiles.created_at` verteilt ist: wie viele der
      Bestandsprofile liegen innerhalb der 30-Tage-Frist? Lesend, per `pg` +
      tsx — Schreibwege sind hier ohnehin gesperrt
- [ ] 6b.2 Das Ergebnis **als Zahl** in den Entwurf schreiben, nicht als
      Einschätzung. Das Repository ist öffentlich: Zahlen, keine Namen
- [ ] 6b.3 Liegt der Import innerhalb der Frist, Donald vorlegen: dann ist die
      Frage nicht „schalten oder nicht", sondern ob `is_new_member` das richtige
      Datum liest — für importierte Mitglieder ist `created_at` das Datum des
      Imports, nicht ihres Beitritts. Eigener Vorgang, nicht dieser Change

## 7. Oberfläche der Kontaktanfrage

- [ ] 7.1 **RED**: Test — ein Konto, das nach der Staffelung nicht senden darf,
      bekommt eine benannte Begründung statt eines rohen `42501`
- [ ] 7.2 **GREEN**: umsetzen in `src/lib/contact-requests.ts` und der Fläche,
      die den Knopf zeigt
- [ ] 7.3 **RED/GREEN**: derselbe Weg für die Welpenschutz-Ablehnung — sie hat
      einen **anderen** Grund und darf nicht dieselbe Meldung tragen

## 8. Abnahme

- [ ] 8.1 `pnpm lint` — Exit-Code prüfen, nicht die Ausgabe
- [ ] 8.2 `pnpm typecheck`
- [ ] 8.3 `pnpm test`
- [ ] 8.4 `pnpm build`
- [ ] 8.5 `supabase test db` **mit ausdrücklicher Dateiliste** — ohne sie lügt
      der Lauf
- [ ] 8.6 `openspec validate --all` grün
- [ ] 8.7 `requesting-code-review` auf den **Diff**, nicht auf den Plan
- [ ] 8.8 `qa` auf der Verzeichnis-Fläche mit einem `connect`-Konto
- [ ] 8.9 `verification-before-completion`

## 9. Ausrollen — getrennt und ausdrücklich

- [ ] 9.1 PR, CI grün abwarten, mergen
- [ ] 9.2 `migrate-dev` grün auf demselben SHA
- [ ] 9.3 `migrate-prod` **ausdrücklich erfragen** — Schreibzugriff auf PROD
- [ ] 9.4 Frontend-Deploy; auf `drift-gate` achten, der ihn stumm anhält
- [ ] 9.5 Live nachmessen: ein `connect`-Konto sieht das Verzeichnis, seine
      erweiterten Spalten sind leer
- [ ] 9.6 **Kein Flag umlegen.** Weder `open_contact` noch
      `welpenschutz_aktiv`. Beides sind Donalds Schritte und gehören nicht in
      diesen Change
- [ ] 9.7 Live gegenprüfen, dass eine Kaltanfrage an ein junges Konto **weiter
      durchgeht** — die Zusage aus 6.1 am laufenden System, nicht nur in pgTAP

## 10. Nachlauf

- [ ] 10.1 `openspec archive rechte-matrix-stufen` — beide Delta-Specs falten
- [ ] 10.2 `pnpm release:entries`, danach den **Diff** von
      `release-entries.generated.ts` lesen: beschreiben die `aenderungen`, was
      gebaut wurde? Die Ausschlüsse dürfen nicht als das Ausgelieferte dastehen
- [ ] 10.3 Im Neuigkeiten-Eintrag steht die **Verzeichnisschwelle** — sie ist
      das einzige sofort Spürbare, und sie gibt Rechte. Der Welpenschutz gehört
      **nicht** hinein: er wartet auf seinen Schalter und ändert am Tag des
      Ausrollens nichts
- [ ] 10.4 AGE-598 in Linear nachsehen; der Merge setzt den Status selbst
- [ ] 10.5 AGE-610 Abnahmepunkt „AGE-598 entschieden" abhaken
