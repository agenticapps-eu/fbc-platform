-- Rechte als Konfiguration: `berechtigungen`, `darf()`, `meine_rechte()`.
-- AGE-1000 (V5F-1), Change openspec/changes/rechte-v5-final/.
--
-- ══ WARUM DAS HIER ENTSTEHT ════════════════════════════════════════════════
-- Detlevs SPEC 01 (V5 FINAL, 01.10.2026) unterscheidet DISCOVER, FOCUS und
-- IMPACT nach Rechten. Gemessen am Katalog von PROD am 03.10.2026 trug die
-- Plattform KEINE EINZIGE Schwelle auf Rang 5 oder 6 — jede Clubschwelle
-- lautete `has_level(4)`. Die Unterscheidung war nicht falsch eingestellt,
-- sondern nicht vorhanden.
--
-- Dazu Detlevs Leitregel: Funktionen „ueber konfigurierbare Rechte/Mindest-
-- freischaltungen bauen … nicht unnoetig hart verdrahten". Eine Schwelle als
-- Zahl im Policy-Rumpf UND als `minTier` in `nav.ts` ist zweimal dieselbe
-- Aussage an zwei Orten, die auseinanderlaufen koennen.
--
-- ══ WAS HIER BEWUSST NICHT STEHT ═══════════════════════════════════════════
-- **Die Clubschwelle Rang 4.** Sie bleibt `has_level(4)` und kommt NICHT in
-- diese Tabelle — der Check-Constraint verbietet sie ausdruecklich. Zwei
-- Gruende:
--   1. AGE-903 hat sie gerade erst aus zwei Raengen (Verzeichnisliste Rang 2,
--      erweiterte Felder Rang 3) zu EINER Zahl fuer EINE Tuer zusammengezogen.
--      Sie je Tabelle konfigurierbar zu machen, dreht das zurueck.
--   2. Sie steht in sieben Policies und fuenf Funktionen, die alle genau das
--      Richtige tun. Zwoelf Aufrufer fuer null Verhaltensaenderung umzuhaengen
--      sind zwoelf Gelegenheiten, etwas zu brechen — drei Wochen vor dem
--      Go-live.
-- Der Preis ist benannt und steht als Anforderung in `access-control`: wer eine
-- Schwelle sucht, schaut an zwei Stellen. `has_level(n)` entscheidet ueber die
-- Tuer, `darf(schluessel)` ueber jedes Recht dahinter.
--
-- **Keine Admin-Oberflaeche.** Die Pflege laeuft vorerst ueber Migrationen.
--
-- ══ VIER SCHLUESSEL HABEN HEUTE KEINEN WIRKORT ═════════════════════════════
-- `organisation.verwalten`, `community.erstellen`, `projekt.erstellen` und
-- `academy.anbieten` zeigen auf Module, die es noch nicht gibt; `darf()` auf
-- sie beantwortet eine Frage, die niemand stellt. Sie entstehen trotzdem hier,
-- weil der Schluesselname die Schnittstelle zu V5F-4 und V5F-6 ist: hier wird
-- er einmal verhandelt, dort wuerde er dreimal neu erfunden.
-- `profil.business` hat in der Datenbank ebenfalls keinen Wirkort — Firma,
-- Rollen und Business-Tags stehen in `profiles` und sind von der Rang-4-Policy
-- gedeckt. Sie auszublenden ist Entscheidung E6 und gehoert zu V5F-3.

-- ── 1. Die Tabelle ──────────────────────────────────────────────────────────
create table public.berechtigungen (
  schluessel   text    primary key,
  min_rank     integer not null,
  beschreibung text    not null,

  -- Die Tuer ist kein Recht. Ein Eintrag mit Mindestrang 4 waere eine zweite
  -- Kopie der Zahl, die `has_level(4)` haelt — und genau die Drift, die
  -- `access-control` verbietet.
  constraint berechtigungen_oberhalb_der_tuer check (min_rank >= 5)
);

comment on table public.berechtigungen is
  'Feature-Rechte als Konfiguration: Schluessel, Mindestrang, Beschreibung. '
  'Gelesen ausschliesslich von darf() und meine_rechte(), beide SECURITY '
  'DEFINER — deshalb traegt die Tabelle kein Client-Recht und keine Policy. '
  'Nur Raenge ab 5: die Clubschwelle (Rang 4) ist has_level(4) und steht hier '
  'nicht. Pflege ueber Migrationen (AGE-1000).';

comment on column public.berechtigungen.schluessel is
  'Benennt die FUNKTION, nicht die Stufe (events.erstellen, nicht '
  'impact_darf_events) — welche Stufe ein Recht traegt, ist genau das, was '
  'sich aendern koennen soll.';

-- RLS an, aber bewusst OHNE Policy: dieselbe Bauform wie `activation_tokens`
-- (AGE-495). Deny-by-default ist hier die Aussage, nicht eine Luecke.
alter table public.berechtigungen enable row level security;

-- Eine frisch erzeugte Supabase-Instanz vergibt Tabellenrechte
-- ROLLENSPEZIFISCH statt ueber die Pseudo-Rolle `public`; ein
-- `revoke … from public, anon` entzieht dort nichts. Deshalb alle vier Rollen
-- namentlich — dokumentiert seit 27.08. in
-- 20260827070000_entzuege_nennen_alle_rollen.sql, und genau daran war die CI
-- von AGE-927 rot.
revoke all on table public.berechtigungen
  from public, anon, authenticated, service_role;

-- ── 2. Der Seed: die Matrix aus SPEC 01 ─────────────────────────────────────
insert into public.berechtigungen (schluessel, min_rank, beschreibung) values
  ('profil.business',        5, 'Business-Profil und berufliche Rollen pflegen und sehen (SPEC 03). Wirkort folgt mit V5F-3.'),
  ('organisation.verwalten', 5, 'Genau eine Organisation administrieren (SPEC 04). Wirkort folgt mit V5F-6a.'),
  ('suche_biete',            5, 'Angebote und Gesuche einstellen und fremde lesen (SPEC 07).'),
  ('vorschlaege',            5, 'Match-Vorschlaege lesen (SPEC 07).'),
  ('verzeichnis.suchen',     6, 'Mitglieder gezielt suchen: Liste und Suche des Verzeichnisses (SPEC 01).'),
  ('events.erstellen',       6, 'Eigene Events anlegen (SPEC 06).'),
  ('community.erstellen',    6, 'Eigene Communities anlegen (SPEC 05). Wirkort folgt mit V5F-6c.'),
  ('projekt.erstellen',      6, 'Projekte anlegen (SPEC 08). Wirkort folgt mit V5F-6b.'),
  ('academy.anbieten',       6, 'Academy-Angebote einstellen und einreichen (SPEC 14). Wirkort folgt mit V5F-4.'),
  ('fbc_format.initiieren',  6, 'Offizielle FBC-Formate initiieren (SPEC 06). Wirkort folgt mit V5F-5.');

-- ── 3. `darf()` ─────────────────────────────────────────────────────────────
-- `stable`, damit Postgres den Aufruf in `(select public.darf('…'))` als
-- InitPlan einmal je Abfrage auswerten darf statt einmal je Zeile. Die
-- Policies unten wickeln ihn deshalb ein — dasselbe Muster wie
-- `(select auth.uid())` im Bestand, und besser als das heutige nackte
-- `has_level(4)`.
--
-- Ein unbekannter Schluessel ergibt `false`: das Nachschlagen liefert NULL,
-- der Vergleich wird NULL, und `coalesce` macht daraus die Ablehnung. Ein
-- Tippfehler in einer Policy schliesst die Tuer also, statt sie zu oeffnen.
create function public.darf(p_schluessel text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.is_activated()
      and public.current_tier_rank() >= (
            select b.min_rank from public.berechtigungen b
             where b.schluessel = p_schluessel),
    false);
$$;

comment on function public.darf(text) is
  'Das einzige Praedikat fuer ein Feature-Recht: aktiviert UND Rang >= '
  'min_rank des Schluessels aus public.berechtigungen. Unbekannter Schluessel '
  'ergibt false (deny-by-default). Fuer die Clubschwelle NICHT zustaendig — '
  'die ist has_level(4). In Policies als (select public.darf(''…'')) '
  'aufrufen, damit sie einmal je Abfrage statt einmal je Zeile laeuft '
  '(AGE-1000).';

revoke execute on function public.darf(text)
  from public, anon, authenticated, service_role;
grant  execute on function public.darf(text) to authenticated;

-- ── 4. `meine_rechte()` ─────────────────────────────────────────────────────
-- Liefert nur die Schluessel, die der Aufrufer HAT — nicht die Liste aller
-- Rechte und nicht deren Mindestraenge. Sonst waere die Preisstruktur aus der
-- Konfiguration lesbar, bevor sie beschlossen ist.
--
-- Leeres Array statt NULL: ein DISCOVER-Konto traegt kein Recht, und `null`
-- waere im Client von „noch nicht geladen" nicht zu unterscheiden. Genau diese
-- Verwechslung hat in AGE-903 `(levelRank ?? 0)` zu einem stillen „Rang 0"
-- gemacht.
create function public.meine_rechte() returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select array_agg(b.schluessel order by b.schluessel)
       from public.berechtigungen b
      where public.is_activated()
        and public.current_tier_rank() >= b.min_rank),
    '{}'::text[]);
$$;

comment on function public.meine_rechte() is
  'Die Feature-Rechte des Aufrufers, sortiert; leeres Array ohne Sitzung, '
  'ohne Aktivierung und fuer DISCOVER. Nennt keine Mindestraenge und keine '
  'fremden Schluessel. Einzige Quelle der Rechte im Client (AGE-1000).';

revoke execute on function public.meine_rechte()
  from public, anon, authenticated, service_role;
grant  execute on function public.meine_rechte() to authenticated;
