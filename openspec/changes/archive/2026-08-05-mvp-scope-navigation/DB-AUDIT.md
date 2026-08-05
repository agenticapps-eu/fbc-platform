# DB-AUDIT — mvp-scope-navigation (AGE-494)

`database-sentinel`, Backend **Supabase**, 2026-08-04. Gezielt auf den Diff dieses
Changes angewandt statt als Vollsweep: geprüft wurde die ersetzte RPC
`public.search_directory` und die neuen Spalten `offers.source` / `needs.source`
samt der partiellen Unique-Indizes. Alle Befunde gegen die lokale Instanz
(`supabase db reset` auf dem vollen Migrationsstand) belegt, nicht abgeleitet.

**Leitfrage:** Verschiebt die neue Preisgabe der Kompass-Kategorien die
Sichtbarkeitsgrenze?

**Antwort: nein.** Die _Preisgabe_ wächst, die _Grenze_ bleibt, wo sie war.

## Befunde

### Bestanden

| Prüfung                                 | Ergebnis                                                                                                                                                                                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_directory` ist SECURITY INVOKER | `prosecdef = false` — die RLS des Aufrufers entscheidet, nicht die des Eigentümers                                                                                                                                                                                                             |
| `search_path` gepinnt                   | `search_path=""` — kein Suchpfad-Hijack (SB-Muster „mutable search_path")                                                                                                                                                                                                                      |
| Ausführungsrecht                        | nur `authenticated` (+ Eigentümer `postgres`). **`anon` hat keins** — die `revoke`/`grant`-Zeilen wurden auf der NEUEN 8-stelligen Signatur ausgesprochen, nichts wurde geerbt (AGE-312)                                                                                                       |
| Keine Alt-Signatur zurückgeblieben      | `pg_proc` führt genau **eine** `search_directory` — die Überladungs-Mehrdeutigkeit (42725) ist ausgeschlossen                                                                                                                                                                                  |
| RLS aktiv                               | `offers`, `needs`, `profiles` alle `relrowsecurity = true`                                                                                                                                                                                                                                     |
| Kategorien folgen der RLS               | Die Unterabfragen für `offer_categories`/`need_categories` lesen `public.offers`/`public.needs` **unter der RLS des Aufrufers** (`offers_select`: eigene Zeile ODER `has_level(3)`). Ein Aufrufer unterhalb von `discover` bekommt über die Basis-RLS ohnehin höchstens die eigene Profilzeile |
| Empirisch belegt                        | `supabase/tests/directory_search_test.sql`, 15 Assertions: `is_public = false` bleibt auch bei gesetztem Kategoriefilter unsichtbar; ein `basic`-Aufrufer bekommt bei `p_offers => {kapital}` **nichts** — weder Zeilen noch Kategorien; `anon` wird abgewiesen                                |

### Hinweis (kein Blocker)

**`source` ist clientseitig schreibbar.** Die Grants auf `offers`/`needs` stehen
auf Tabellenebene (`SELECT/INSERT/UPDATE/DELETE` für `authenticated`), es gibt
keine Spalten-Einschränkung. Ein Mitglied kann `source` auf **eigenen** Zeilen
frei setzen — `offers_write_own` erzwingt `profile_id = auth.uid()`, fremde Zeilen
sind unerreichbar.

Die Folgen sind auf das eigene Konto begrenzt und größtenteils Selbstschaden: wer
eine reiche Zeile als `'chip'` markiert, verliert sie beim Abwählen ohne Rückfrage.

Wichtiger für spätere Leser: **der partielle Unique-Index ist ein Renn-Schutz,
kein Missbrauchs-Schutz.** Er verhindert, dass zwei gleichzeitige Speicherungen
eine doppelte Chip-Zeile erzeugen und damit den Potenzial-Score still aufblähen.
Er verhindert _nicht_, dass ein entschlossener Client viele Zeilen mit
`source = 'editor'` anlegt und seinen eigenen Score hochtreibt — das war vor
diesem Change genauso möglich (`recompute_potential_score` summiert seit
`20260613230000_potential_score.sql:110` `count(*)` über `offers`/`needs`) und ist
ein **vorbestehender** Zustand, den dieser Change weder einführt noch verschlimmert.
Nicht in diesem Change zu beheben; als eigener Vorgang notieren, falls der Score
je etwas entscheidet, das mehr wiegt als eine Anzeige.

## Was dieser Audit NICHT abdeckt

Kein Vollsweep über alle 27 Supabase-Muster, keine Storage-Policies, keine
Auth-Konfiguration, keine Edge Functions — dieser Change fasst nichts davon an.
Der letzte vollständige Lauf gilt weiter.

**Kritisch: 0 · Hoch: 0.** Nichts blockiert diesen Change.
