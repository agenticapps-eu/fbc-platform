-- „Nicht relevant": eine geteilte Markierung auf einem archivierten Change
-- (AGE-636).
-- Donald, 2026-08-27. Change: openspec/changes/neuigkeiten-archiv/.
--
-- ══ BEFUND ══════════════════════════════════════════════════════════════════
-- Die Neuigkeiten-Flaeche aus AGE-631 kennt einen Eintrag nur als „noch nicht
-- angekuendigt" oder „zugestellt". Fuer „gesehen, aber nicht der Rede wert"
-- gibt es keinen Platz. Gemessen am 27.08.: von 52 archivierten Changes liegen
-- **22** ausserhalb des Vorauswahl-Fensters von sieben Tagen. Sie stehen damit
-- dauerhaft ungehakt in der Liste — „Grants ausdruecklich ausgesprochen
-- (AGE-312)" wird nie eine Mitteilung an Mitglieder, und trotzdem muss ein
-- Admin es nach jedem Neuladen erneut uebergehen.
--
-- ══ WARUM EINE EIGENE TABELLE ══════════════════════════════════════════════
-- Naheliegend waere ein dritter Zustand `'skipped'` auf `release_notes`, mit
-- den Slugs in `entry_slugs`. Verworfen, drei Gruende:
--
--   * `title`/`body` sind `not null`. Eine „Note", die keine ist, brauchte
--     Platzhalter.
--   * Die Ruecknahme waere ein `update` auf `entry_slugs` — und
--     `release_notes_admin_edit` laesst Updates NUR auf `status = 'draft'` zu.
--     Der dritte Zustand waere unveraenderlich, also genau das, was er nicht
--     sein soll.
--   * `release_notes_read_sent` gibt jedem aktivierten Mitglied die Zeilen mit
--     `status = 'sent'`. Ein weiterer Zustand in derselben Tabelle setzte jede
--     kuenftige Aenderung dieser Policy unter die Frage, ob sie ihn mitfasst.
--
-- ══ WARUM ES HIER EIN DELETE GIBT ══════════════════════════════════════════
-- `release_notes` hat bewusst keines: „eine zugestellte Mitteilung soll nicht
-- verschwinden koennen — die Hinweise stehen dann schon in siebzig
-- Postfaechern". Dieser Grund traegt hier NICHT. Eine Markierung verschickt
-- nichts und erzeugt keine Hinweiszeile; ihre Ruecknahme ist der Normalfall
-- (verklickt), nicht die Ausnahme. Weil `slug` der Primaerschluessel ist, ist
-- die Ruecknahme dieselbe Zeile, die die Markierung angelegt hat.
--
-- ══ WARUM `skipped_by` DER DATENBANK GEHOERT ═══════════════════════════════
-- Die Insert-Policy verlangt `skipped_by = auth.uid()` und nicht nur „der
-- Aufrufer ist Admin". Ohne diese Bedingung koennte ein Admin die Markierung
-- einem anderen unterschieben oder `null` schreiben — die Spalte waere eine
-- Behauptung des Clients. (Fremd-Review vor dem Code, codex, MEDIUM.)
--
-- Die Spalte bleibt trotzdem NULLABLE, und das ist kein Widerspruch:
-- `on delete set null` verlangt es. `on delete cascade` waere schaedlich — mit
-- dem Konto eines ausgeschiedenen Admins verschwaenden seine Markierungen, und
-- die abgeraeumten Eintraege stuenden wieder in der Liste.
--
-- `skipped_at` traegt `default now()`, ist aber nicht gegen einen Admin
-- gehaertet, der einen Zeitpunkt mitschickt. Bewusste Grenze: diese Tabelle ist
-- eine Arbeitsnotiz, kein Nachweis. Nachweise stehen in `admin_audit`.
--
-- ══ GRANTS ═════════════════════════════════════════════════════════════════
-- Ausdruecklich ausgesprochen (AGE-312): seit den Default Privileges erbt eine
-- neue Tabelle NICHTS. Der Golden-Snapshot in grants_test.sql ist mitgepflegt.
-- Kein UPDATE — an einer Markierung gibt es nichts zu aendern. Kein `anon`.
--
-- Forward-only.

create table public.release_entry_skips (
  -- Der Verzeichnisname aus `openspec/changes/archive/`. Derselbe Schluessel,
  -- den `release_notes.entry_slugs` benutzt, und laut AGE-631 der einzig
  -- verlaessliche Teil des Archivs. Kein Fremdschluessel moeglich: die Liste
  -- der Changes ist ein zur Bauzeit erzeugtes Modul, keine Tabelle.
  slug       text primary key,
  skipped_by uuid default auth.uid() references public.profiles (id) on delete set null,
  skipped_at timestamptz not null default now()
);
alter table public.release_entry_skips enable row level security;

comment on table public.release_entry_skips is
  'AGE-636: ein archivierter Change, den ein Admin als nicht mitteilenswert '
  'markiert hat. Geteilt zwischen allen Admins, ruecknehmbar per DELETE. '
  'Das Gegenstueck ist die Zustellung ueber release_notes — die ist endgueltig.';

-- ── Policies ────────────────────────────────────────────────────────────────
-- Lesen, Anlegen, Zuruecknehmen: nur ein aktivierter Admin. `is_admin()` wird
-- GERUFEN, nicht abgeschrieben — es prueft seit AGE-581 auch Sperre und
-- Loeschung.
create policy release_entry_skips_admin_read on public.release_entry_skips
  for select to authenticated
  using ( public.is_activated() and public.is_admin() );

create policy release_entry_skips_admin_write on public.release_entry_skips
  for insert to authenticated
  with check ( public.is_activated() and public.is_admin()
               and skipped_by = auth.uid() );

create policy release_entry_skips_admin_undo on public.release_entry_skips
  for delete to authenticated
  using ( public.is_activated() and public.is_admin() );

grant select, insert, delete on public.release_entry_skips to authenticated;
