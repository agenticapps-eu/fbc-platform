## 1. Fundament in der Datenbank

- [x] 1.1 pgTAP-Datei anlegen und in die Dateiliste von
      `.github/workflows/ci.yml` eintragen; RED, weil `public.berechtigungen`
      noch nicht existiert. **Berichtigt:** geplant war eine eigene
      `berechtigungen_test.sql`; entstanden ist Abschnitt 1 von
      `supabase/tests/rechte_v5_test.sql`, und nur diese Datei steht in
      `ci.yml`. Eine zweite Datei für fünf Zusagen über dieselbe Tabelle hätte
      zwei Fixture-Blöcke gebraucht
- [x] 1.2 Migration `supabase/migrations/<ts>_berechtigungen.sql`: Tabelle
      `berechtigungen (schluessel pk, min_rank, beschreibung)`, Seed mit den
      zehn Zeilen aus SPEC 01, RLS an, **kein** Tabellenrecht für `anon`/
      `authenticated`, Entzug namentlich für alle vier Rollen
- [x] 1.3 In derselben Migration `darf(p_schluessel text)` — `stable`,
      `security definer`, `set search_path`, unbekannter Schlüssel `false`;
      EXECUTE namentlich entziehen und nur `authenticated` erteilen
- [x] 1.4 In derselben Migration `meine_rechte() returns text[]` — eigene
      Schlüssel sortiert, leeres Array ohne Sitzung/Aktivierung
- [x] 1.5 Check-Constraint `min_rank >= 5` auf `berechtigungen`, damit die
      Clubschwelle nicht als Recht hineinrutschen kann
- [x] 1.6 pgTAP GRÜN für 1.1. **Berichtigt:** kein `db reset` — der lokale
      Stack ist mit anderen Sitzungen geteilt, und ein Reset nimmt deren Daten
      mit. Stattdessen `supabase migration up`, plus `migration repair` für
      zwei Migrationen, deren Rümpfe eine frühere Sitzung von Hand eingespielt
      hatte (Schema voraus, Historie hinterher — dokumentierte Falle)

## 2. Schwellen in der Datenbank

- [x] 2.1 pgTAP `supabase/tests/rechte_v5_test.sql` anlegen, in die CI-Liste
      eintragen: je Recht × Rang 4/5/6, plus ein nicht aktiviertes Rang-6-Konto
      und ein Rang-3-Konto als Kontrolle — RED
- [x] 2.2 Migration `<ts>_rechte_v5_schwellen.sql`: `events_write_host` in
      INSERT (mit `darf('events.erstellen')`) und UPDATE/DELETE (nur Eigentum)
      teilen
- [x] 2.3 Dieselbe Migration: `offers_select`/`needs_select` auf
      `darf('suche_biete')`; `offers_write_own`/`needs_write_own` in INSERT (mit
      Recht) und UPDATE/DELETE (ohne) teilen
- [x] 2.4 Dieselbe Migration: `matches_select_participant` um
      `darf('vorschlaege')` erweitern
- [x] 2.5 Dieselbe Migration: `search_directory` neu — Eintrittstor
      `darf('verzeichnis.suchen')` statt `has_level(4)`, Selbst-Zweig bleibt,
      Signatur und Spalten unverändert; Grants und Entzüge wiederherstellen
- [x] 2.6 pgTAP GRÜN für 2.1; dazu ein Test, der belegt, dass die
      Rang-4-Policies **unverändert** `has_level(4)` rufen
- [x] 2.7 `supabase test db` vollständig grün gegen eine frische Abbildung

## 3. Den Restbefund festschreiben, nicht beheben

- [x] 3.1 `src/lib/database.types.ts` von Hand nachziehen: `darf`,
      `meine_rechte` (kein `gen types` darüberlaufen lassen). **Berichtigt:**
      die Aufgabe nannte `src/types/…`; die handgepflegte Datei liegt unter
      `src/lib/`
- [x] 3.2 Linear-Issue für `verzeichnis-dicht` anlegen, unter AGE-999, mit der
      gemessenen Liste der 20 Abfragestellen und den zwei Fallen (Einbettung
      `membership_tiers(level_rank)`, `update().select()`) — **AGE-1001**
- [x] 3.3 pgTAP-Test, der den **heutigen** Zustand festhält: ein Rang-4-Konto
      liest `profiles` und `profiles_public` ohne Filter und bekommt Zeilen.
      Er schlägt um, sobald `verzeichnis-dicht` landet — das ist gewollt, dort
      wird er gedreht

## 4. Rechte in der Oberfläche

- [x] 4.1 Vitest `src/hooks/useDarf.test.tsx` — RED
- [x] 4.2 `src/lib/berechtigungen.ts`: `ladeMeineRechte()` über die RPC
- [x] 4.3 `src/hooks/useDarf.ts`: `useQuery(["meine-rechte", userId])`,
      `staleTime: Infinity`, Invalidierung beim Identitätswechsel
- [x] 4.4 `nav.ts`: Feld `darf?: Berechtigung` neben `minTier`; `/mitglieder`
      auf `darf: "verzeichnis.suchen"` umstellen, `/academy` unverändert
- [x] 4.5 `MembershipGate`: Zweig für `darf`, Ladezustand wie bisher nicht als
      Ablehnung behandeln
- [x] 4.6 `HeaderSearch`: `useDarf("verzeichnis.suchen")` statt Rangvergleich;
      Hinweistext auf Support statt Aufstiegsseite
- [x] 4.7 `MemberDirectory`: erweiterte Filter an `useDarf("suche_biete")`
- [x] 4.8 `EventsList`: „Event anlegen" und das Formular an
      `useDarf("events.erstellen")`
- [x] 4.9 `PublicProfilePage`: **kein Gate, nur der Erklärsatz berichtigt.**
      Die Abschnitte „Ich biete" und „Ich suche" hängen an
      `zeigt(biete)`/`zeigt(suche)` — eine leere RLS-Antwort lässt sie ganz
      entfallen, es entsteht also keine Überschrift über nichts, und ein Gate
      wäre eine zweite Prüfung vor einer, die hält. Geändert wurde der Satz, der
      das Such-/Bieteprofil ab DISCOVER versprach; er nennt jetzt FOCUS
- [x] 4.10 Vitest je Stelle aus 4.4–4.9, jeweils mit und ohne Recht
- [x] 4.11 `pnpm lint`, `pnpm typecheck`, `pnpm test` grün

## 4b. Befunde der beiden Reviews (nachgezogen)

- [x] 4b.1 `useDarf` gibt `laedt` und `fehler` getrennt heraus; die Regel „ein
      Ladezustand ist ein Moment, ein Fehler ein Zustand" steht im Kopf des
      Hooks, und jede Fläche folgt ihr nach ihrer Art
- [x] 4b.2 `MembershipGate.rechte.test.tsx` (neu): laden zeigt nichts, Fehler
      lässt durch
- [x] 4b.3 **CRITICAL:** `saveMatchingProfile` fügt jetzt VOR dem Löschen ein
      und löscht nach Kennung. Vorher: Löschen gelingt (nur Eigentum),
      Einfügen scheitert (braucht `suche_biete`) — ein DISCOVER-Konto verlor
      seine Angebote und Gesuche endgültig
- [x] 4b.4 `AngeboteGesuchePage`: ohne `suche_biete` kein Formular, sondern der
      Bestand lesend plus der Weg über Support
- [x] 4b.5 `event_vorlagen`: Anlegen folgt dem Event (`events.erstellen`),
      Pflegen bleibt beim Eigentum; dazu `VorlagenPanel` und eine eigene
      Testdatei. Grund: `event_serie_erzeugen` ist SECURITY INVOKER
- [x] 4b.6 Kommentare auf allen neuen Policies — die abgelöste
      `events_write_host` trug einen, und derselbe Verlust ist einmal zuvor
      protokolliert
- [x] 4b.7 Der Check-Constraint wird jetzt wirklich gemessen (`throws_ok` mit
      `23514` als Eigentümer, plus Positivkontrolle). Vorher scheiterte die
      Einfügung am fehlenden Tabellenrecht, bevor der Constraint griff
- [x] 4b.8 Der Drift-Wächter vergleicht gegen die pgTAP-Erwartung statt gegen
      die erste Migration — sonst bräche die Kernzusage bei der ersten
      Verschiebung. Gegenprobe gefahren: eine verschobene Schwelle macht ihn rot
- [x] 4b.9 `cmp_ok(… '<=', 1)` ersetzt durch `is(…, 1)`, weil `als_zahl` im
      Fehlerfall `-1` liefert und eine Ausnahme sich als bestanden las
- [x] 4b.10 `EventsList.vorlagen.test.tsx` mockt das Recht ausdrücklich — es war
      grün, weil der Abruffehler offen fällt, nicht weil ein Recht da war

## 5. Dokumentation und Abschluss

- [x] 5.1 `docs/lastenheft.md` und `docs/technisches-handbuch.md` nachziehen:
      die Matrix, `berechtigungen`, `darf()`, `meine_rechte()`
- [x] 5.2 ADR in `docs/decisions/`: warum zwei Mechanismen (Tür vs. Recht) und
      warum `profiles_public` kennungsgebunden statt stufengebunden
- [x] 5.3 `openspec validate --all` grün
- [x] 5.4 Probe gegen den lokalen Stack mit je einem echten Konto auf Rang 4, 5
      und 6 — **durch PostgREST**, nicht gegen einen Mock. Sie schliesst die
      Lücke zwischen pgTAP (Datenbank) und Vitest (Oberfläche gegen einen
      geseeten Cache): dass PostgREST die Funktionen sieht und dass
      `rpc("meine_rechte")` ein ARRAY liefert und keine Zeilenmenge, belegt
      keines von beiden. Ergebnis in der PR-Beschreibung; danach 28 Profile und
      28 Konten wie vorher
- [ ] 5.5 Code-Review auf dem Diff, Befunde abarbeiten
- [ ] 5.6 Verifikation: jede Zusage aus den Deltas gegen die laufende Datenbank
      belegt, Zahlen protokolliert
