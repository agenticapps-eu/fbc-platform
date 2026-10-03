## 1. Fundament in der Datenbank

- [ ] 1.1 pgTAP-Datei `supabase/tests/berechtigungen_test.sql` anlegen und in die
      Dateiliste von `.github/workflows/ci.yml` eintragen; RED, weil
      `public.berechtigungen` noch nicht existiert
- [ ] 1.2 Migration `supabase/migrations/<ts>_berechtigungen.sql`: Tabelle
      `berechtigungen (schluessel pk, min_rank, beschreibung)`, Seed mit den
      zehn Zeilen aus SPEC 01, RLS an, **kein** Tabellenrecht für `anon`/
      `authenticated`, Entzug namentlich für alle vier Rollen
- [ ] 1.3 In derselben Migration `darf(p_schluessel text)` — `stable`,
      `security definer`, `set search_path`, unbekannter Schlüssel `false`;
      EXECUTE namentlich entziehen und nur `authenticated` erteilen
- [ ] 1.4 In derselben Migration `meine_rechte() returns text[]` — eigene
      Schlüssel sortiert, leeres Array ohne Sitzung/Aktivierung
- [ ] 1.5 Check-Constraint `min_rank >= 5` auf `berechtigungen`, damit die
      Clubschwelle nicht als Recht hineinrutschen kann
- [ ] 1.6 `supabase db reset` lokal, pgTAP GRÜN für 1.1

## 2. Schwellen in der Datenbank

- [ ] 2.1 pgTAP `supabase/tests/rechte_v5_test.sql` anlegen, in die CI-Liste
      eintragen: je Recht × Rang 4/5/6, plus ein nicht aktiviertes Rang-6-Konto
      und ein Rang-3-Konto als Kontrolle — RED
- [ ] 2.2 Migration `<ts>_rechte_v5_schwellen.sql`: `events_write_host` in
      INSERT (mit `darf('events.erstellen')`) und UPDATE/DELETE (nur Eigentum)
      teilen
- [ ] 2.3 Dieselbe Migration: `offers_select`/`needs_select` auf
      `darf('suche_biete')`; `offers_write_own`/`needs_write_own` in INSERT (mit
      Recht) und UPDATE/DELETE (ohne) teilen
- [ ] 2.4 Dieselbe Migration: `matches_select_participant` um
      `darf('vorschlaege')` erweitern
- [ ] 2.5 Dieselbe Migration: `search_directory` neu — Eintrittstor
      `darf('verzeichnis.suchen')` statt `has_level(4)`, Selbst-Zweig bleibt,
      Signatur und Spalten unverändert; Grants und Entzüge wiederherstellen
- [ ] 2.6 pgTAP GRÜN für 2.1; dazu ein Test, der belegt, dass die
      Rang-4-Policies **unverändert** `has_level(4)` rufen
- [ ] 2.7 `supabase test db` vollständig grün gegen eine frische Abbildung

## 3. Den Restbefund festschreiben, nicht beheben

- [ ] 3.1 `src/types/database.types.ts` von Hand nachziehen: `darf`,
      `meine_rechte` (kein `gen types` darüberlaufen lassen)
- [ ] 3.2 Linear-Issue für `verzeichnis-dicht` anlegen, unter AGE-999, mit der
      gemessenen Liste der 20 Abfragestellen und den zwei Fallen (Einbettung
      `membership_tiers(level_rank)`, `update().select()`)
- [ ] 3.3 pgTAP-Test, der den **heutigen** Zustand festhält: ein Rang-4-Konto
      liest `profiles` und `profiles_public` ohne Filter und bekommt Zeilen.
      Er schlägt um, sobald `verzeichnis-dicht` landet — das ist gewollt, dort
      wird er gedreht

## 4. Rechte in der Oberfläche

- [ ] 4.1 Vitest `src/hooks/useDarf.test.tsx` — RED
- [ ] 4.2 `src/lib/berechtigungen.ts`: `ladeMeineRechte()` über die RPC
- [ ] 4.3 `src/hooks/useDarf.ts`: `useQuery(["meine-rechte", userId])`,
      `staleTime: Infinity`, Invalidierung beim Identitätswechsel
- [ ] 4.4 `nav.ts`: Feld `darf?: Berechtigung` neben `minTier`; `/mitglieder`
      auf `darf: "verzeichnis.suchen"` umstellen, `/academy` unverändert
- [ ] 4.5 `MembershipGate`: Zweig für `darf`, Ladezustand wie bisher nicht als
      Ablehnung behandeln
- [ ] 4.6 `HeaderSearch`: `useDarf("verzeichnis.suchen")` statt Rangvergleich;
      Hinweistext auf Support statt Aufstiegsseite
- [ ] 4.7 `MemberDirectory`: erweiterte Filter an `useDarf("suche_biete")`
- [ ] 4.8 `EventsList`: „Event anlegen" und das Formular an
      `useDarf("events.erstellen")`
- [ ] 4.9 `PublicProfilePage`: SUCHE/BIETE-Abschnitt an `useDarf("suche_biete")`
- [ ] 4.10 Vitest je Stelle aus 4.4–4.9, jeweils mit und ohne Recht
- [ ] 4.11 `pnpm lint`, `pnpm typecheck`, `pnpm test` grün

## 5. Dokumentation und Abschluss

- [ ] 5.1 `docs/lastenheft.md` und `docs/technisches-handbuch.md` nachziehen:
      die Matrix, `berechtigungen`, `darf()`, `meine_rechte()`
- [ ] 5.2 ADR in `docs/decisions/`: warum zwei Mechanismen (Tür vs. Recht) und
      warum `profiles_public` kennungsgebunden statt stufengebunden
- [ ] 5.3 `openspec validate --all` grün
- [ ] 5.4 Sichtprobe gegen den lokalen Stack mit je einem Konto auf Rang 4, 5, 6
- [ ] 5.5 Code-Review auf dem Diff, Befunde abarbeiten
- [ ] 5.6 Verifikation: jede Zusage aus den Deltas gegen die laufende Datenbank
      belegt, Zahlen protokolliert
