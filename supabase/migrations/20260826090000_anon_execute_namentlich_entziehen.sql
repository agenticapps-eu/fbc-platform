-- AGE-602 — `revoke ... from public` entfernt den anon-Grant nicht.
--
-- BEFUND (am PROD-Katalog gemessen, 26.08.2026)
-- `search_directory` ist in PROD fuer `anon` ausfuehrbar, obwohl seine Migration
-- `revoke all ... from public` + `grant execute ... to authenticated` sagt und
-- `directory_search_test.sql` es lokal GRUEN prueft. Sein `proacl` in PROD ist
-- exakt die Default-ACL der Instanz:
--
--   {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--
-- Der `revoke ... from public` traf also nichts (`anon` haelt einen EIGENEN Grant,
-- keinen ueber die Pseudo-Rolle `public`), und der `grant ... to authenticated` war
-- ein No-op auf ein bereits vorhandenes Recht. Elf Funktionen sind in PROD fuer
-- `anon` ausfuehrbar; sechs davon mit ausdruecklicher Absicht, fuenf nicht.
--
-- KEIN DATENABFLUSS, und das ist gemessen statt gehofft: `search_directory` laeuft
-- als `security invoker` und bricht fuer `anon` mit `42501 permission denied for
-- table profiles`. `register_for_event` und `set_event_check_in` sind zwar
-- `SECURITY DEFINER` und schreibend, fuehren aber beide `is_activated()`, und das
-- liefert ohne Sitzung per `coalesce` `false`. `array_jaccard` und
-- `fbc_profile_search_doc` rechnen nur ueber ihre Argumente und lesen keine Tabelle.
-- Die Preisgabe war Tiefenstaffelung — aber unbeabsichtigt, und ein gruener lokaler
-- Test hat sie zwei Monate verdeckt.
--
-- WARUM HIER KEIN `alter default privileges` STEHT
-- Der naheliegende Schluss war, den Default zu entschaerfen, so wie AGE-312 es fuer
-- TABELLEN getan hat (20260715140000_explicit_grants.sql:131). Fuer Tabellen wirkt
-- das nachweislich. Fuer Funktionen NICHT. Drei Varianten am 26.08. lokal gemessen:
--
--   alter default privileges ... GRANT  execute on functions to anon      -> wirkt
--   alter default privileges ... REVOKE execute on functions from public  -> WIRKUNGSLOS
--   revoke execute on function <name> from public                         -> wirkt
--
-- Postgres vergibt EXECUTE auf Funktionen implizit an PUBLIC; dieser implizite
-- Grant laesst sich ueber die Default-ACL nicht wegnehmen — eine neu angelegte
-- Funktion behaelt `proacl = null`, und `anon` ist Mitglied von PUBLIC. Eine
-- Default-Zeile waere hier ein No-op, der wie Schutz AUSSIEHT, also genau die
-- Sorte stille Zusicherung, deretwegen AGE-602 entstand. Sie steht deshalb nicht da.
--
-- Was stattdessen traegt, ist die abgeschlossene Liste in `grants_test.sql`
-- (Abschnitt 6): sie faellt, sobald irgendeine Funktion fuer `anon` ausfuehrbar
-- wird, ohne dort zu stehen. Weil eine neue Funktion das Recht GESCHENKT bekommt,
-- ist das der Normalfall und nicht die Ausnahme — die Liste ist also nicht Kosmetik,
-- sondern die einzige Stelle, an der ein Vergessen auffaellt.
--
-- VERWORFEN: die Default Privileges der Instanz per Hand angleichen. Das steht in
-- keiner Datei, wirkt nicht rueckwirkend und verschoebe den Fehler von "vergessene
-- Zeile" zu "unsichtbare Voraussetzung" — dieselbe Klasse, die hier repariert wird.

-- ── 1. Die fuenf ungewollten: `anon` NAMENTLICH entziehen ───────────────────
-- `public` und `anon` beide genannt. Nur `public` liesse einen rollen-eigenen
-- Grant stehen (genau der Fehler oben), nur `anon` liesse den impliziten
-- PUBLIC-Grant stehen. Es braucht beide.

revoke execute on function
  public.search_directory(text, text, text, text, text, text, text[], text[])
  from public, anon;

revoke execute on function public.register_for_event(uuid)                from public, anon;
revoke execute on function public.set_event_check_in(uuid, boolean)       from public, anon;
revoke execute on function public.array_jaccard(text[], text[])           from public, anon;
revoke execute on function
  public.fbc_profile_search_doc(text, text, text, text, text, text[], text[], text[])
  from public, anon;

-- `authenticated` behaelt, was es braucht — ausgesprochen, nicht geerbt.
grant execute on function
  public.search_directory(text, text, text, text, text, text, text[], text[])
  to authenticated;
grant execute on function public.register_for_event(uuid)          to authenticated;
grant execute on function public.set_event_check_in(uuid, boolean) to authenticated;

-- `fbc_profile_search_doc` bekommt `authenticated` ZURUECK — und das ist der Punkt,
-- an dem eine erste Messung dieses Changes falsch war.
--
-- `profiles.search_doc` ist eine GESPEICHERTE generierte Spalte ueber dieser
-- Funktion (`attgenerated = 's'`), und Postgres prueft EXECUTE beim Auswerten des
-- Generierungsausdrucks sehr wohl — gegen den SCHREIBENDEN, nicht gegen den
-- Eigentuemer. Ohne diesen Grant faellt jedes Profil-UPDATE eines Mitglieds mit
-- `permission denied for function fbc_profile_search_doc`.
--
-- Die erste Sonde hatte das Gegenteil behauptet. Sie lief als `authenticated`
-- OHNE gesetzte JWT-Claims, ihr UPDATE traf wegen RLS null Zeilen, und die
-- generierte Spalte wurde nie berechnet — "ging durch" hiess in Wahrheit "hat
-- nichts angefasst". Aufgefallen ist es erst an `rls_test.sql` (Abschnitt 15),
-- wo der Schreibweg mit echter Identitaet laeuft. Merksatz fuer die naechste
-- Sonde: ein UPDATE, das null Zeilen trifft, ist kein bestandener Test.
--
-- `anon` bleibt aussen vor: ein ausgeloggter Aufrufer schreibt kein Profil.
grant execute on function
  public.fbc_profile_search_doc(text, text, text, text, text, text[], text[], text[])
  to authenticated;

-- `array_jaccard` bekommt BEWUSST keinen Grant zurueck: es hat genau einen
-- Aufrufer, `generate_matches_for` — und der ist `SECURITY DEFINER` und fuer
-- `authenticated` nicht einmal ausfuehrbar, der verschachtelte Aufruf laeuft also
-- als `postgres`. Am Katalog gegengeprueft: die Funktion haengt an keiner
-- generierten Spalte, keinem Index und keiner View. Ein Grant
-- "sicherheitshalber" waere eine Flaeche ohne Aufrufer.

-- ── 2. Die beiden beabsichtigten: geerbtes PUBLIC durch Ausgesprochenes ersetzen ──
-- Beide tragen `=X/postgres` (PUBLIC) NEBEN den benannten Rollen. Sie sollen fuer
-- `anon` erreichbar bleiben — aber weil es so entschieden wurde, nicht weil ein
-- Default es mitgegeben hat. `access-control` verlangt ausgesprochene Rechte;
-- solange PUBLIC danebensteht, ist die Zusage nur halb wahr.

revoke execute on function public.post_engagement_counts(uuid[])     from public;
revoke execute on function public.event_registration_counts(uuid[])  from public;
grant  execute on function public.post_engagement_counts(uuid[])     to anon, authenticated;
grant  execute on function public.event_registration_counts(uuid[])  to anon, authenticated;
