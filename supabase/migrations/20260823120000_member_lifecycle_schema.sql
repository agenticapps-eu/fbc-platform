-- Lebenszyklus eines Mitglieds, Teil A: Spalten und Prädikate (AGE-581).
-- Donald, 2026-08-23. Change: openspec/changes/add-admin-member-lifecycle/.
--
-- ══ DER UMFANG IST GEMESSEN, NICHT GESCHÄTZT ═══════════════════════════════
-- `grep activated_at supabase/migrations/` findet 86 Vorkommen allein in
-- 20260806080100_activation_gate.sql. Das Verzeichnis ist forward-only — ein
-- grep darüber zählt auch alles, was längst ersetzt wurde.
--
-- Gegen den echten Datenbankstand gemessen (pg_policies, pg_get_functiondef,
-- pg_get_viewdef) steht das Gate an FÜNF Stellen direkt:
--
--   * `is_activated()`                     — Aufruferseite, ~40 Policies erben
--   * `is_activated_profile(uuid)`         — Zielprofilseite
--   * `profiles_select_self_or_discover`   — die EINZIGE Policy mit direktem Prädikat
--   * `profiles_public`                    — die EINZIGE View mit direktem Prädikat
--   * `admin_list_members` / `admin_find_profile` — bleiben absichtlich durchlässig
--
-- Diese Migration fasst die ersten vier an. Rund vierzig Policies erben die
-- Änderung, ohne selbst angefasst zu werden.
--
-- ══ WARUM DIE FUNKTIONEN IHREN NAMEN BEHALTEN ══════════════════════════════
-- `is_activated()` prüft künftig mehr, als sein Name sagt. Ein Rename nach
-- `has_access()` wäre ehrlicher — und berührte rund vierzig Policies, also
-- genau die Fläche, die dieser Change NICHT anfassen will, weil jede einzeln
-- angefasste Policy eine Gelegenheit ist, die Bedingung falsch zu schreiben.
--
-- Der Plan-Review (gemini) hat zu Recht eingewandt, dass ein Kommentar eine
-- schwache Sicherung gegen ein Missverständnis des Namens ist. Der Ausgleich
-- steht deshalb als WARNUNG im Funktionskommentar, nicht als Nebensatz. Der
-- Rename bleibt eine Nachfolge-Notiz: wenn die Policies aus anderem Anlass
-- ohnehin angefasst werden, ist er dort billig.
--
-- ══ WARUM `is_admin()` MITGEHT ═════════════════════════════════════════════
-- Weil es die Lücke war, die keine Inventur findet. Eine Suche nach
-- `activated_at` findet nur Stellen, die es bereits nennen — nie eine, an der
-- es FEHLT. `is_admin()` liest allein `staff_roles`; ein deaktivierter Admin
-- behielte mit gültigem Token jede Fähigkeit über `admin_get_profile`,
-- `admin_find_profile`, `admin_update_profile`, `admin_list_members` und die
-- Lesepolicy auf `admin_audit` — während die gewöhnliche RLS ihm längst alles
-- verweigert. Die Fähigkeit auszuschliessen wirkte ausgerechnet bei der am
-- höchsten privilegierten Gruppe nicht.
--
-- VORHER GEPRÜFT (23.08., scripts/probe-age581-admins.ts): PROD trägt zwei
-- Admins, DEV drei Admins und einen Matching-Manager — ALLE aktiviert. Die
-- Verschärfung sperrt also niemanden aus, der sie zurücknehmen müsste. Diese
-- Prüfung ist keine Formalie: ohne sie wäre der erste Anwendungsfall dieser
-- Migration möglicherweise gewesen, sich selbst auszusperren.
--
-- ══ WARUM ZEITPUNKTE UND KEINE WAHRHEITSWERTE ══════════════════════════════
-- `disabled_at timestamptz` statt `is_disabled boolean`. Die Fläche soll „seit
-- wann" sagen können, und ein Wahrheitswert liesse sich später nicht zu einem
-- Zeitpunkt erweitern, ohne jeden Aufrufer anzufassen. Dieselbe Wahl wie bei
-- `activated_at`.
--
-- ══ WARUM DIE SPALTEN IN `profiles` LIEGEN ═════════════════════════════════
-- Die Projektregel lautet: eigentümerprivate Spalten gehören nach
-- `member_settings`, weil jede Spalte in `profiles` einen Grant, einen
-- Golden-Snapshot-Eintrag und die Preisgabe ab `discover` kostet.
--
-- Diese beiden fallen nicht darunter. Sie sind keine eigentümerprivaten
-- Angaben, sondern Gate-Felder wie `activated_at`, und sie werden von den
-- Prädikatfunktionen und der Policy auf `profiles` im selben Zugriff gelesen.
-- Die Preisgabe ab `discover` entfällt zudem: ein Profil mit gesetztem
-- `disabled_at` wird gar nicht mehr geliefert.
--
-- `profiles` trägt `grant select … to authenticated` TABELLENWEIT
-- (20260715140000:95), eine neue Spalte kostet also keinen neuen SELECT-Grant.
-- Ein UPDATE-Grant wird ausdrücklich NICHT erteilt — sonst setzte ein Mitglied
-- seinen eigenen Zustand.
--
-- Forward-only.

-- ── 1. Die Spalten ──────────────────────────────────────────────────────────

alter table public.profiles
  add column disabled_at timestamptz,
  add column deleted_at  timestamptz;

comment on column public.profiles.disabled_at is
  'Zeitpunkt der Deaktivierung durch einen Admin (AGE-581), sonst null. '
  'Umkehrbar. Sperrt Sichtbarkeit UND Zugang; die zweite Haelfte der Sperre '
  'ist auth.users.banned_until, gesetzt von der Edge Function '
  'admin-set-member-ban. Kein UPDATE-Grant fuer Client-Rollen.';

comment on column public.profiles.deleted_at is
  'Zeitpunkt der weichen Loeschung durch einen Admin (AGE-581), sonst null. '
  'Die Zeile bleibt bestehen; ein Hard-Delete entsteht in diesem Change NICHT. '
  'Gatet selbststaendig — Sichtbarkeit und Zugang — und fasst disabled_at '
  'BEWUSST NICHT an: sonst ginge beim Wiederherstellen die Information '
  'verloren, ob das Mitglied vorher schon deaktiviert war.';

-- Teilindizes: die weit überwiegende Mehrheit der Zeilen trägt null, und
-- gefragt wird immer nach den wenigen, die es nicht tun.
create index profiles_disabled_at_idx on public.profiles (disabled_at) where disabled_at is not null;
create index profiles_deleted_at_idx  on public.profiles (deleted_at)  where deleted_at  is not null;

-- Die Zahlungsart. Die Einschränkung steht in der DATENBANK und nicht allein
-- in der Oberfläche: eine Zahlungsart, die nur ein Auswahlfeld kennt, ist beim
-- nächsten Skript ein freier Text. `null` bleibt zulässig und heisst
-- „nicht erfasst" — nicht „unbekannt geraten".
alter table public.profile_legacy
  add column payment_type text,
  add constraint profile_legacy_payment_type_check
    check (payment_type is null or payment_type in
      ('rechnung', 'stripe', 'copecart', 'paypal',
       'digistore24', 'ehren', 'partner', 'offen'));

comment on column public.profile_legacy.payment_type is
  'Wie das Mitglied bezahlt (AGE-581). Acht Werte, in der Datenbank '
  'eingeschraenkt; null heisst NICHT ERFASST. Liegt neben paid_until in '
  'profile_legacy und nicht in profiles: dort kostete jede Spalte einen Grant, '
  'den Golden-Snapshot und die Preisgabe ab Stufe discover.';

-- ── 2. Die beiden Prädikate ─────────────────────────────────────────────────

create or replace function public.is_activated() returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(
    (select p.activated_at is not null
        and p.disabled_at is null
        and p.deleted_at  is null
       from public.profiles p
      where p.id = (select auth.uid())),
    false
  );
$$;

comment on function public.is_activated() is
  'ACHTUNG, DER NAME IST UNVOLLSTAENDIG: die Funktion prueft seit AGE-581 die '
  'GESAMTE Zugangsbedingung — aktiviert UND nicht deaktiviert UND nicht '
  'geloescht —, nicht nur activated_at. Wer sie liest, um zu erfahren, ob '
  'jemand je bestaetigt hat, liest die falsche Funktion. '
  'Der Name blieb, weil rund vierzig Policies sie rufen und ein Rename jede '
  'einzelne anfassen hiesse — vierzig Gelegenheiten, die Bedingung falsch zu '
  'schreiben. Gibt ohne Session false zurueck, nicht NULL.';

create or replace function public.is_activated_profile(p_profile_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(
    (select p.activated_at is not null
        and p.disabled_at is null
        and p.deleted_at  is null
       from public.profiles p where p.id = p_profile_id),
    false
  );
$$;

comment on function public.is_activated_profile(uuid) is
  'ACHTUNG, DER NAME IST UNVOLLSTAENDIG — siehe is_activated(). Zielprofil-'
  'Seite des Zugangs-Gates: ein unbestaetigtes, deaktiviertes oder geloeschtes '
  'Profil erscheint fuer niemanden im Verzeichnis. Gibt nur ein Boolean '
  'zurueck.';

-- ── 3. Die Rollenprädikate ──────────────────────────────────────────────────
-- Eine Rolle überlebt den Entzug des Zugangs nicht.

create or replace function public.is_admin() returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
      from public.staff_roles s
      join public.profiles p on p.id = s.profile_id
     where s.profile_id = (select auth.uid())
       and s.role = 'admin'
       and p.activated_at is not null
       and p.disabled_at is null
       and p.deleted_at  is null
  );
$$;

comment on function public.is_admin() is
  'Ist der Aufrufer Admin UND zugangsberechtigt? Seit AGE-581 genuegt die Zeile '
  'in staff_roles NICHT mehr: ein deaktivierter Admin behielte sonst mit '
  'gueltigem Token jede Faehigkeit ueber die admin_*-DEFINER-Funktionen und die '
  'Lesepolicy auf admin_audit, waehrend die gewoehnliche RLS ihm laengst alles '
  'verweigert. Die Bedingung wird hier ausgeschrieben statt is_activated() zu '
  'rufen — jene Funktion ist SECURITY DEFINER und liest dieselbe Zeile, ein '
  'Aufruf waere ein zweiter Weg an dieselbe Wahrheit.';

create or replace function public.is_matching_manager() returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
      from public.staff_roles s
      join public.profiles p on p.id = s.profile_id
     where s.profile_id = (select auth.uid())
       and s.role in ('matching_manager', 'admin')
       and p.activated_at is not null
       and p.disabled_at is null
       and p.deleted_at  is null
  );
$$;

comment on function public.is_matching_manager() is
  'Ist der Aufrufer Matching-Manager (oder Admin) UND zugangsberechtigt? '
  'Dieselbe Verschaerfung wie is_admin() (AGE-581) und aus demselben Grund.';

-- ── 4. Die einzige Policy mit direktem Prädikat ─────────────────────────────

drop policy if exists profiles_select_self_or_discover on public.profiles;
create policy profiles_select_self_or_discover on public.profiles
  for select to authenticated
  using (
    public.is_activated()
    and activated_at is not null
    and disabled_at is null
    and deleted_at  is null
    and ( id = (select auth.uid()) or public.has_level(3) )
  );

-- ── 5. Die einzige View mit direktem Prädikat ───────────────────────────────
-- `security_invoker` bleibt AUS: die View umgeht die Policies der Basistabelle
-- absichtlich und fuehrt ihr Praedikat deshalb selbst. Genau darum muss die
-- Bedingung hier ein zweites Mal stehen — eine Aenderung an der Policy allein
-- liesse die View unberuehrt.

create or replace view public.profiles_public
  with (security_invoker = off) as
  select id, name, avatar_url, region, company, short_bio, tier, roles, cover_url
    from public.profiles
   where is_public
     and public.is_activated()
     and activated_at is not null
     and disabled_at is null
     and deleted_at  is null;

grant select on public.profiles_public to authenticated;

comment on view public.profiles_public is
  'Verzeichnisprojektion. security_invoker=off — laeuft mit den Rechten ihres '
  'Eigentuemers und wertet die Policy der Basistabelle NICHT aus, fuehrt ihr '
  'Praedikat also selbst. Seit AGE-581 schliesst es deaktivierte und '
  'geloeschte Profile mit aus. anon haelt hier bewusst KEIN Leserecht '
  '(AGE-239/AGE-530).';

-- ── 6. Die Zustandsauskunft ─────────────────────────────────────────────────
-- Sie bekommt ein drittes Feld. OHNE es zeigte die Oberflaeche einem
-- gesperrten Konto den Aktivierungsbildschirm und luede es ein, sich einen
-- Zugangslink schicken zu lassen — fuer einen Zugang, den es nicht mehr gibt.
--
-- `drop` + `create`, nicht `create or replace`: Postgres kann den Rueckgabetyp
-- einer bestehenden Funktion nicht aendern und bricht mit „cannot change
-- return type of existing function" ab. Gemessen, nicht vermutet — der
-- Plan-Review hat es gefunden, bevor diese Migration zum ersten Mal lief.
--
-- EIN WAHRHEITSWERT, KEIN ZUSTANDSWORT: ein Feld mit den Werten
-- `deaktiviert`/`geloescht` verriete dem Betroffenen, welche der beiden
-- Handlungen ein Admin vorgenommen hat. Das geht ihn so wenig an wie einen
-- Leser des Feeds, und die Oberflaeche braucht die Unterscheidung nicht: sie
-- zeigt in beiden Faellen denselben Hinweis und denselben Weg.
--
-- `activated` behaelt seine Bedeutung („hat je bestaetigt"). Ein gesperrtes,
-- zuvor bestaetigtes Konto traegt beide Felder wahr — einzeln wahr, zusammen
-- eindeutig.

drop function if exists public.my_activation_state();

create function public.my_activation_state()
  returns table (activated boolean, blocked boolean, display_name text)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p.activated_at is not null,
         (p.disabled_at is not null or p.deleted_at is not null),
         p.name
    from public.profiles p
   where p.id = (select auth.uid());
$$;

revoke execute on function public.my_activation_state() from public, anon;
grant  execute on function public.my_activation_state() to authenticated;

comment on function public.my_activation_state() is
  'Der Stand des AUFRUFERS gegenueber der Plattform — eine der zwei '
  'ausgenommenen Funktionen des Zugangs-Gates (AGE-495), damit der '
  'Aktivierungsweg sich ueberhaupt anzeigen kann. Traegt seit AGE-581 DREI '
  'Felder: activated (hat je bestaetigt), blocked (deaktiviert ODER geloescht) '
  'und den Anzeigenamen fuer die Anrede. blocked ist bewusst ein '
  'Wahrheitswert und kein Zustandswort — welche der beiden Handlungen ein '
  'Admin vorgenommen hat, geht den Betroffenen nichts an. Kein Profil-, '
  'Kontakt- oder Stufendatum.';
