-- Die Kontolöschung, Teil C: die Anonymisierung (AGE-708).
-- Donald, 2026-09-08. Change: openspec/changes/kontoloeschung/.
--
-- ══ WAS SIE TUT UND WORAN SIE SICH HÄLT ════════════════════════════════════
-- Sie führt `openspec/changes/kontoloeschung/datenmatrix.md` aus. Diese Matrix
-- ist am lokalen Schema gemessen, nicht aus den Migrationen zusammengesucht,
-- und sie ist zugleich das Abnahmedokument: die Zusagen in
-- `kontoloeschung_test.sql` sind gegen sie geschrieben, nicht gegen diesen
-- Rumpf. Wer hier eine Zeile ergänzt, ergänzt sie DORT zuerst.
--
-- Vier Klassen, und die Grenze zwischen ihnen ist die eigentliche Entscheidung
-- (Donald, 08.09.):
--
--   GELEERT      die Personenbezug tragenden Spalten von `profiles`
--   GELÖSCHT     die Zeilen, die nur Eigenes tragen (Kontaktdaten, Angebote,
--                Ziele, Einstellungen, Geräte-Token, Rollen …)
--   FREIGEGEBEN  was andere an das Konto bindet: künftige Anmeldungen,
--                geplante Beiträge, offene Kontaktanfragen
--   STEHEN       Beiträge, Kommentare, Nachrichten, angenommene Anfragen und
--                vergangene Teilnahmen — fremde Gesprächsfäden
--
-- ══ WARUM `search_doc` HIER NICHT VORKOMMT ═════════════════════════════════
-- Weil sie es nicht kann. `profiles.search_doc` ist
-- `generated always as … stored` über `name, company, branche, short_bio,
-- headline, roles, competencies, interests`. Postgres pflegt sie selbst.
--
-- Die Pflicht liegt deshalb nicht bei der Spalte, sondern bei ihren ACHT
-- Quellspalten: bleibt eine davon gefüllt, ist das gelöschte Mitglied über die
-- Volltextsuche weiter auffindbar, obwohl jede andere Spalte leer ist. Der
-- erste Entwurf dieses Changes führte nur vier davon als PII —
-- `branche`, `short_bio`, `roles`, `competencies` und `interests` fehlten.
-- Zusage 16 im Test sucht deshalb nach dem alten Namen und erwartet nichts.
--
-- ══ WARUM DIE OFFENE ANFRAGE GELÖSCHT UND NICHT ABGELEHNT WIRD ═════════════
-- `contact_requests.status` kennt `pending|accepted|declined`. Eine offene
-- Anfrage auf `declined` zu setzen wäre bequem und wäre eine falsche Aussage:
-- der Empfänger hat nicht abgelehnt. Eine `pending`-Anfrage ist noch niemandes
-- Verlauf, also geht sie ganz — in beide Richtungen, denn eine Anfrage AN das
-- gegangene Konto kann ebenso wenig noch beantwortet werden.
--
-- ══ WARUM DIE KÜNFTIGE ANMELDUNG STORNIERT WIRD ════════════════════════════
-- Aus dem Plan-Review (gemini, HIGH). `event_registrations` führt eine
-- `waitlist`. Eine anonyme, aber weiter `registered` stehende Anmeldung hätte
-- den Platz blockiert, ohne dass jemand nachrückt — der Schaden träfe den
-- Gastgeber und die Wartenden, nicht das gegangene Mitglied.
--
-- ══ WAS SIE ABSICHTLICH NICHT TUT ══════════════════════════════════════════
--   * `auth.users` löschen. Das kann die Datenbank nicht — `auth.users` gehört
--     GoTrue. Die Edge Function tut es, NACH dieser Funktion.
--   * Dateien löschen. Ebenfalls die Edge Function, und zwar DAVOR.
--   * Freitext umschreiben. Eine Nachricht, in der jemand seine Nummer nennt,
--     und eine @-Erwähnung im Beitrag eines anderen bleiben stehen. Sie sind
--     die Aussage eines anderen Menschen; siehe design.md D9.
--
-- ══ WARUM `service_role` UND SONST NIEMAND ═════════════════════════════════
-- Dieselbe Begründung wie bei den vier Lebenszyklus-Funktionen aus AGE-581:
-- die Wirkung reicht ÜBER die Datenbank hinaus. Läge EXECUTE bei
-- `authenticated`, könnte ein Mitglied die Funktion unmittelbar über die
-- Datenbank-API rufen und einen Halbzustand erzeugen — Profil geleert, Dateien
-- noch da, `auth.users` noch da. Die Edge Function ist der einzige Eingang.
--
-- `revoke ... from public` steht ausdrücklich da und ist kein Zierrat: bei
-- FUNKTIONEN vergibt PostgreSQL `EXECUTE` von sich aus an `public`. Wer sich
-- hier auf geerbte oder voreingestellte Rechte verlässt, hat die Funktion
-- soeben jedem geöffnet.
--
-- Forward-only.

create or replace function public.konto_anonymisieren(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- ── Der Schemawaechter ────────────────────────────────────────────────────
  -- Aus dem Plan-Review (codex, HIGH #11). Diese Funktion bereitet eine
  -- Loeschung vor, die als NAECHSTES `auth.users` entfernt. Traegt `profiles`
  -- dabei noch den kaskadierenden Fremdschluessel, reisst dieser Schritt die
  -- Profilzeile und ueber sie 35 Tabellen mit — Beitraege, Kommentare,
  -- Nachrichten und Kontaktanfragen inbegriffen.
  --
  -- Sich darauf zu verlassen, dass die Migrationen „ja in der richtigen
  -- Reihenfolge laufen", ist keine Absicherung, sondern eine Hoffnung: sie
  -- gilt nur, solange niemand eine Umgebung von Hand nachzieht. Der Waechter
  -- steht deshalb HIER und nicht in der Edge Function — an der Stelle, die
  -- das Schema selbst lesen kann, und so, dass jeder Aufrufer ihn erbt.
  --
  -- Fail closed: lieber keine Loeschung als eine, die fremde Faeden zerreisst.
  if exists (
    select 1
      from pg_constraint con
      join pg_class c     on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'profiles'
       and con.contype = 'f'
       and con.confrelid = 'auth.users'::regclass
  ) then
    raise exception
      'Schema nicht vorbereitet: profiles zeigt noch per Fremdschluessel auf auth.users — die Loeschung wuerde die Inhaltstabellen mitreissen'
      using errcode = '55000';
  end if;

  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'Profil % existiert nicht', p_profile_id using errcode = 'P0002';
  end if;

  -- ── FREIGEGEBEN ───────────────────────────────────────────────────────────
  -- Zuerst, solange die Zuordnung noch lesbar ist.
  update public.event_registrations r
     set status = 'cancelled'
    from public.events e
   where r.event_id = e.id
     and r.profile_id = p_profile_id
     and e.starts_at > now()
     and r.status <> 'cancelled';

  delete from public.posts
   where author_id = p_profile_id
     and veroeffentlicht_ab > now();

  delete from public.contact_requests
   where status = 'pending'
     and (from_id = p_profile_id or to_id = p_profile_id);

  -- ── GELÖSCHT ──────────────────────────────────────────────────────────────
  -- Zeilen, die ausschliesslich Eigenes tragen. Reihenfolge ohne Bedeutung:
  -- keine von ihnen zeigt auf eine andere aus dieser Liste.
  delete from public.profile_contacts     where profile_id = p_profile_id;
  delete from public.profile_interests    where profile_id = p_profile_id;
  delete from public.profile_badges       where profile_id = p_profile_id;
  delete from public.profile_theme_scores where profile_id = p_profile_id;
  delete from public.compass_responses    where profile_id = p_profile_id;
  delete from public.goals                where profile_id = p_profile_id;
  delete from public.offers               where profile_id = p_profile_id;
  delete from public.needs                where profile_id = p_profile_id;
  delete from public.member_settings      where profile_id = p_profile_id;
  delete from public.profile_legacy       where profile_id = p_profile_id;
  delete from public.push_tokens          where profile_id = p_profile_id;
  delete from public.activation_tokens    where profile_id = p_profile_id;
  delete from public.notifications        where profile_id = p_profile_id;
  delete from public.thread_read_positions where profile_id = p_profile_id;
  delete from public.post_likes           where profile_id = p_profile_id;
  delete from public.post_saves           where profile_id = p_profile_id;
  delete from public.event_vorlagen       where host_id = p_profile_id;
  delete from public.matches
   where a_profile_id = p_profile_id or b_profile_id = p_profile_id;

  -- Eine Rolle ohne Menschen dahinter ist eine offene Tuer. Loescht ein Admin
  -- sein eigenes Konto, geht die Rolle mit.
  delete from public.staff_roles          where profile_id = p_profile_id;

  -- ── GELEERT ───────────────────────────────────────────────────────────────
  -- Die acht Quellspalten von `search_doc` stehen zuerst, damit beim Lesen
  -- sofort sichtbar ist, dass keine davon fehlt.
  update public.profiles
     set name          = null,
         company       = null,
         branche       = null,
         short_bio     = null,
         headline      = null,
         roles         = null,
         competencies  = null,
         interests     = null,
         -- alles Weitere aus der Datenmatrix
         region        = null,
         goals         = null,
         next_steps    = null,
         website       = null,
         socials       = null,
         member_number = null,
         member_since  = null,
         dev_focus     = null,
         dev_progress  = null,
         avatar_url    = null,
         cover_url     = null,
         -- `videos` ist `not null` mit Vorgabe `'{}'` — hier also die leere
         -- Menge und nicht `null`.
         videos        = '{}',
         is_public     = false,
         -- `coalesce`, damit ein zweiter Aufruf den Zeitpunkt nicht verschiebt:
         -- die Funktion soll wiederholbar sein, ohne die Historie zu faelschen.
         deleted_at    = coalesce(deleted_at, now()),
         erased_at     = coalesce(erased_at,  now())
   where id = p_profile_id;
end $$;

comment on function public.konto_anonymisieren(uuid) is
  'Loescht die personenbezogenen Daten EINES Mitglieds und laesst fremde '
  'Gespraechsfaeden stehen (AGE-708). Fuehrt datenmatrix.md aus: leert die '
  'PII-Spalten von profiles, loescht die Zeilen mit ausschliesslich eigenen '
  'Daten, gibt kuenftige Anmeldungen, geplante Beitraege und offene '
  'Kontaktanfragen frei — und setzt deleted_at (traegt die Sichtbarkeit) sowie '
  'erased_at (traegt den Riegel gegen admin_restore_member). Fasst '
  'search_doc NICHT an: die Spalte ist `generated always` ueber acht '
  'Quellspalten, und die werden hier alle geleert. Loescht WEDER auth.users '
  'NOCH Dateien — beides kann die Datenbank nicht, das tut die Edge Function '
  'drumherum, die Dateien davor und auth.users danach. Idempotent. '
  'EXECUTE liegt allein bei service_role, damit niemand einen Halbzustand '
  'erzeugen kann.';

revoke execute on function public.konto_anonymisieren(uuid) from public, anon, authenticated;
grant  execute on function public.konto_anonymisieren(uuid) to service_role;
