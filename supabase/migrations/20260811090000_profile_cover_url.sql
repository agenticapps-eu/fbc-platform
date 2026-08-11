-- Hintergrundbild im Profil: Spalte, Client-Grant, Projektion (AGE-498, C6).
-- Donald, 2026-08-11. Spec: openspec/changes/profile-cover-and-admin-edit/.
--
-- ── Warum die Spalte ────────────────────────────────────────────────────────
-- `ProfileHero` nimmt seit AGE-237 ein `coverUrl` entgegen und trägt dazu den
-- Vermerk „Upload vorbereitet, noch kein Storage-Backend". Das Mockup vom
-- 29.07. zeigt das Bild prominent. Es fehlte bisher beides: Spalte und Bucket.
--
-- ── Warum `cover_url` ins Client-Grant darf und die legacy-Felder nicht ─────
-- Das Hintergrundbild ist eine Angabe des Mitglieds über sich selbst, wie
-- `avatar_url`. Die vier Felder der Altmitgliedschaft (paid_until, legacy_*)
-- sind Tatsachen ÜBER die Mitgliedschaft; sie liegen in einer eigenen Tabelle
-- (20260811090100_profile_legacy.sql) und nicht hier.
--
-- VERWORFEN: `grant update on public.profiles` ohne Spaltenliste. Dieselbe
-- Begründung wie in 20260721070000_grant_update_videos.sql: es öffnete tier,
-- member_number, potential_score, profile_completion und search_doc für den
-- Client — abgeleitete Felder, die Triggern und RPCs gehören (AGE-312).
--
-- ── Warum die Sicht angefasst werden MUSS ──────────────────────────────────
-- `/p/:id` liest `profiles_public`, nicht die Basistabelle
-- (src/lib/public-profile.ts:71). Eine Spalte, die nur auf `profiles` liegt,
-- ist für jeden Betrachter außer dem Eigentümer unsichtbar — das Bild wäre
-- hochladbar und nirgends zu sehen, ohne dass etwas fehlschlüge.
--
-- ── Warum ANGEHÄNGT und nicht einsortiert ──────────────────────────────────
-- `create or replace view` verlangt, dass bestehende Spalten Name, Typ UND
-- Reihenfolge behalten; neue dürfen nur ans Ende. Ein alphabetisch neben
-- `avatar_url` einsortiertes `cover_url` ließe die Anweisung scheitern. Aus dem
-- Fremd-Review zum Change (REVIEWS.md, codex).
--
-- ── Und warum das Gate hier noch einmal steht ──────────────────────────────
-- Die Sicht läuft mit `security_invoker = off`, geht also an den Policies der
-- Basistabelle vorbei. Jede Zugangsbedingung muss in ihrem eigenen Rumpf
-- stehen (AGE-495). Eine Neudeklaration, die die beiden is_activated-Zeilen
-- beim Abschreiben verliert, öffnet das Verzeichnis lautlos — und an der Sicht
-- selbst wäre das nicht abzulesen. rls_test.sql §15 hat dafür eine Gegenprobe.
--
-- Forward-only.

-- ── 1. Spalte ───────────────────────────────────────────────────────────────
alter table public.profiles add column cover_url text;

comment on column public.profiles.cover_url is
  'Hintergrundbild der Profilansicht (AGE-498). Zeigt in den Bucket `covers`. '
  'Client-schreibbar wie avatar_url. Das Entfernen leert nur diese Spalte — '
  'das Objekt im Bucket bleibt bestehen und über seine URL abrufbar, genau wie '
  'beim Avatar.';

-- ── 2. Client-Grant: genau diese eine Spalte ────────────────────────────────
grant update (cover_url) on public.profiles to authenticated;

-- ── 3. Projektion: cover_url ans ENDE, Gate unverändert ─────────────────────
-- Wortgleich aus 20260806080100_activation_gate.sql:489-495, ergänzt um die
-- letzte Spalte. Nichts anderes ist geändert.
create or replace view public.profiles_public
  with (security_invoker = off) as
  select id, name, avatar_url, region, company, short_bio, tier, roles, cover_url
  from public.profiles
  where is_public
    and public.is_activated()          -- der Aufrufer
    and activated_at is not null;      -- das Zielprofil

comment on view public.profiles_public is
  'Oeffentliche Verzeichnis-Projektion der is_public-Profile. SECURITY DEFINER '
  'by design (AGE-311): bedient das Verzeichnis fuer jedes eingeloggte Mitglied '
  'unabhaengig von der Basis-Tabellen-RLS. WEIL sie die Policies umgeht, traegt '
  'sie das Aktivierungs-Gate im eigenen Rumpf (AGE-495) — auf BEIDEN Seiten: '
  'der Aufrufer muss bestaetigt sein, und ein unbestaetigtes Profil erscheint '
  'fuer niemanden. Neue Felder treten ans ENDE der Spaltenliste (AGE-498): '
  'create or replace view kann keine Spalte in der Mitte einfuegen.';
