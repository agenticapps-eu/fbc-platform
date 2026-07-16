-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  Admin-/Staff-Provisionierung (AGE-358) — OUT OF BAND, manuell auszuführen  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
--
-- staff_roles ist die server-kontrollierte Autorisierungsquelle (ADR-0002), NICHT
-- das member-schreibbare profiles.roles. Sie wird bewusst nicht automatisch geseedet
-- (kein config.toml, kein demo_seed.ts): wer die Plattform administriert, ist
-- Betriebskonfiguration, keine Demo-Daten. Diese Datei fährt ein Mensch bewusst.
--
-- WICHTIG — diese Datei
--   • weist nur ROLLEN zu, sie legt KEINE Accounts an. Detlev/Donald registrieren
--     sich normal über die App; ihr Passwort setzen sie selbst und es liegt NIE im
--     Repo (das Repo ist öffentlich). Diese Datei hebt einen bestehenden Account
--     zu admin.
--   • wirkt erst, WENN der Account existiert. Läuft sie vorher, findet der Lookup
--     niemanden und tut nichts (No-op) — kein Fehler. Nach der Registrierung erneut
--     ausführen.
--   • ist idempotent (on conflict → set role).
--
-- AUSFÜHREN — die echten E-Mails NICHT hier eintragen (öffentliches Repo), sondern
-- beim Lauf übergeben:
--
--   psql "$DB_URL" \
--     -v admin_1="detlev@example.com" \
--     -v admin_2="donald.vlahovic@neuro-flash.com" \
--     -f supabase/seed/admin_roles.sql
--
-- Im Supabase-SQL-Editor stattdessen die zwei \set-Zeilen unten kurz mit den echten
-- Adressen füllen, ausführen, und die Änderung NICHT committen.
--
-- ACHTUNG: dev und prod teilen dasselbe Supabase-Projekt (ADR-0003). Gegen diese DB
-- ausgeführt, vergibt die Datei ECHTE Admin-Rechte. Das ist gewollt — aber bewusst tun.

\if :{?admin_1}
\else
  \set admin_1 'REPLACE_WITH_ADMIN_EMAIL_1'
\endif
\if :{?admin_2}
\else
  \set admin_2 'REPLACE_WITH_ADMIN_EMAIL_2'
\endif

insert into public.staff_roles (profile_id, role)
select u.id, 'admin'
  from auth.users u
 where u.email in (:'admin_1', :'admin_2')
on conflict (profile_id) do update set role = excluded.role;

-- Optionaler Deal-Manager (matching_manager, ADR-0002) — auskommentiert, weil bislang
-- niemand ihn braucht. Bei Bedarf E-Mail übergeben und die drei Zeilen aktivieren:
-- insert into public.staff_roles (profile_id, role)
-- select u.id, 'matching_manager' from auth.users u where u.email in (:'manager_1')
-- on conflict (profile_id) do update set role = excluded.role;

-- Kontrolle: wer trägt jetzt welche Staff-Rolle?
select u.email, s.role, s.created_at
  from public.staff_roles s
  join auth.users u on u.id = s.profile_id
 order by s.role, u.email;
