-- Altmitgliedschaft: Laufzeit, Stufe, Preis, Quell-Kennung (AGE-498, C6).
-- Donald, 2026-08-11. Spec: openspec/changes/profile-cover-and-admin-edit/.
--
-- ── Warum es diese Felder überhaupt gibt ────────────────────────────────────
-- Detlevs Zusage an die Bestandsmitglieder: alle bekommen `impact`, aber nur
-- bis zum Ablauf der bereits bezahlten Mitgliedschaft. Dieses Datum steht
-- ausschließlich im alten WordPress-System. Wird es beim Import nicht
-- mitgeschrieben, ist die Zusage danach NICHT REKONSTRUIERBAR — die Stufe
-- allein unterscheidet ein befristetes Bestandsrecht nicht von einer
-- dauerhaften Mitgliedschaft. Der Verlust fällt nicht beim Import auf, sondern
-- erst bei der ersten Verlängerung, und dann ist die Quelle abgeschaltet.
--
-- ── Warum eine eigene Tabelle und nicht vier Spalten auf `profiles` ─────────
-- AGE-498 schlägt Spalten auf `profiles` vor. Das Fremd-Review zum Change hat
-- gezeigt, warum das nicht trägt (REVIEWS.md, codex, HIGH):
--
--   * `grant select on public.profiles to authenticated` (20260715140000) gibt
--     Tabellen-SELECT, und `profiles_select_self_or_discover`
--     (20260806080100:75) gibt jedem bestätigten Mitglied ab `discover` die
--     VOLLE Zeile jedes anderen bestätigten Mitglieds.
--   * Ein Spalten-Grant regelt nur das SCHREIBEN. `legacy_price` — was jemand
--     tatsächlich gezahlt hat — stünde damit für jedes Mitglied ab der dritten
--     Stufe im Klartext.
--   * Postgres kennt kein spaltenweises Leseverbot, solange Tabellen-SELECT
--     erteilt ist. Die Trennung muss deshalb über die Tabelle laufen.
--
-- VERWORFEN: das Tabellen-SELECT auf `profiles` entziehen und durch eine
-- Spaltenliste ersetzen. Das schlösse die Lücke ohne neue Tabelle und bräche
-- jede Abfrage im Repo, die `select *` auf profiles macht — darunter
-- fetchProfileEditorData (src/lib/profile.ts:123).
--
-- ── Semantik, damit C10 nicht raten muss ───────────────────────────────────
-- `paid_until` ist der LETZTE EINGESCHLOSSENE Tag. `null` heißt UNBEKANNT,
-- nicht „unbefristet" — ein Import ohne Datum darf nicht wie eine dauerhafte
-- Zusage aussehen. `date` und nicht `timestamptz`: der Ablauf ist ein
-- Kalendertag, und eine Zeitzone verschöbe den Stichtag je nach Betrachter um
-- einen Tag.
--
-- Was beim ERREICHEN des Datums geschieht, steht hier bewusst nicht. Das ist
-- eine Abrechnungsentscheidung (C10 / billing-upgrades). Festgelegt ist nur,
-- dass die Tatsache festgehalten wird.
--
-- `legacy_tier` bleibt die ROHE Bezeichnung aus dem Altsystem. Normalisiert man
-- sie beim Import, ist die Herkunft weg und der Abgleich mit einer Rechnung
-- nicht mehr möglich.
--
-- ── Warum der Index über den getrimmten Wert läuft ─────────────────────────
-- Er macht den Import WIEDERHOLBAR. Ohne btrim kollidierten '' und '   ' nicht
-- miteinander — beide bedeuten „keine Kennung", und der zweite Import bliebe
-- an ihnen hängen statt an echten Dubletten.
--
-- WAS ER NICHT LEISTET: Atomarität. Bricht der Import zwischen dem Anlegen des
-- Anmeldekontos und dem Schreiben dieser Zeile ab, bleibt ein Konto ohne
-- Kennung zurück, das ein zweiter Lauf nicht wiedererkennt. Das Import-Script
-- muss die Kennung deshalb vor oder gemeinsam mit dem Profil schreiben. Steht
-- hier, damit C10 es nicht übersieht.
--
-- Forward-only.

create table public.profile_legacy (
  profile_id       uuid primary key references public.profiles (id) on delete cascade,
  paid_until       date,
  legacy_tier      text,
  legacy_price     numeric(10,2),
  legacy_source_id text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.profile_legacy enable row level security;

-- KEINE Policy und KEIN Grant für anon/authenticated. Das ist kein Vergessen:
-- RLS ohne Policy verweigert alles, und das fehlende Grant hält die Tabelle
-- zusätzlich von der PostgREST-Fläche fern. Gelesen und geschrieben wird von
-- `service_role` (Import) und von den SECURITY-DEFINER-Funktionen aus
-- 20260811090300_admin_profile_functions.sql.
--
-- Nach AGE-312 erbt eine neue Tabelle nichts mehr — es ist also wirklich zu.
-- grants_test.sql belegt das über den Default-Privileges-Abschnitt.

create unique index profile_legacy_source_id_key
  on public.profile_legacy (nullif(btrim(legacy_source_id), ''))
  where legacy_source_id is not null;

create trigger trg_profile_legacy_updated_at
  before update on public.profile_legacy
  for each row execute function public.set_updated_at();

comment on table public.profile_legacy is
  'Herkunft und Laufzeit der Altmitgliedschaft (AGE-498, C6). Getrennt von '
  'profiles, WEIL ein Spalten-Grant nur das Schreiben regelt: authenticated '
  'haelt Tabellen-SELECT auf profiles, und profiles_select_self_or_discover '
  'gibt ab `discover` die volle Zeile — legacy_price stuende sonst offen. '
  'Kein Client-Grant, keine Policy; nur service_role und die admin_*-RPCs.';

comment on column public.profile_legacy.paid_until is
  'Letzter EINGESCHLOSSENER Tag der bereits bezahlten Mitgliedschaft. null = '
  'unbekannt, NICHT unbefristet. Traegt Detlevs Bestandsschutz: alle '
  'Bestandsmitglieder bekommen impact, aber nur bis zu diesem Tag. Was beim '
  'Erreichen geschieht, entscheidet die Abrechnung (C10), nicht diese Spalte.';

comment on column public.profile_legacy.legacy_tier is
  'Rohe Stufenbezeichnung aus dem Altsystem, unnormalisiert — die '
  'Normalisierung naehme die Herkunft weg.';

comment on column public.profile_legacy.legacy_price is
  'Tatsaechlich gezahlter Bruttobetrag in Euro fuer die abgelaufene Periode '
  '(500 / 600 / 780 / 840 / 1080 / 1200).';

comment on column public.profile_legacy.legacy_source_id is
  'WordPress-User-ID. Unique ueber den getrimmten Wert, damit der Import '
  'wiederholbar ist und leere Kennungen einander nicht blockieren. Macht den '
  'Import wiederholbar, nicht atomar — die Kennung muss vor oder mit dem '
  'Profil geschrieben werden.';
