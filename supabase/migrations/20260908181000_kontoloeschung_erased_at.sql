-- Die Kontolöschung, Teil B: die Marke der Unwiderruflichkeit (AGE-708).
-- Donald, 2026-09-08. Change: openspec/changes/kontoloeschung/.
--
-- ══ WARUM `deleted_at` NICHT REICHT ════════════════════════════════════════
-- Das ist der Befund aus dem Plan-Review (codex, HIGH), und er ist der Grund
-- für diese ganze Datei.
--
-- Der erste Entwurf wollte die Kontolöschung allein über `deleted_at` tragen:
-- die Spalte ist bereits da, `is_activated()` liest sie, und über diese
-- Funktion blenden die Prädikate das Mitglied überall aus. Das stimmt — aber
-- `admin_restore_member` (AGE-581) setzt genau dieses Feld auf `null` zurück.
--
-- Ein Admin, der ein gelöschtes Konto „wiederherstellt", hätte damit den
-- GELEERTEN Grabstein wieder ins Verzeichnis geholt: ein Profil ohne Namen,
-- ohne Bild, ohne Kontaktdaten, aber sichtbar — und für das Mitglied, das
-- gegangen ist, wäre seine Löschung stillschweigend halb zurückgenommen.
--
-- ══ WAS `erased_at` IST UND WAS ES NICHT IST ═══════════════════════════════
-- Es ist KEIN zweites `deleted_at`. Die beiden Felder haben verschiedene
-- Urheber und verschiedene Halbwertszeiten:
--
--   `deleted_at`  — der Admin hat das Mitglied entfernt. Rücknehmbar. Das ist
--                   ein Verwaltungsvorgang, und er darf einen Irrtum haben.
--   `erased_at`   — das MITGLIED hat sein Konto gelöscht. Nie rücknehmbar.
--                   Das ist ein Betroffenenrecht, und es kennt keinen Irrtum
--                   des Vereins.
--
-- Eine Kontolöschung setzt BEIDE: `deleted_at`, damit die rund vierzig
-- vorhandenen Prädikate greifen, ohne dass eine einzige neue Regel geschrieben
-- werden muss — und `erased_at`, damit `deleted_at` nie wieder geleert werden
-- kann. Die Marke ist also nicht das Gate, sie ist der Riegel VOR dem Gate.
--
-- Daraus folgt umgekehrt: wer eine neue Sichtbarkeitsregel schreibt, prüft
-- weiterhin `deleted_at`, nicht `erased_at`. Es gibt keinen Zustand, in dem
-- `erased_at` gesetzt und `deleted_at` leer ist.
--
-- ══ WARUM DIE SCHREIBSPERRE HIER NICHT VORKOMMT ════════════════════════════
-- Ein `deleteUser()` entwertet ein bereits ausgestelltes Zugriffstoken nicht,
-- und weil die Profilzeile absichtlich stehenbleibt, liefert `auth.uid()`
-- weiter dieselbe ID. Das gelöschte Konto könnte also weiterschreiben — wenn
-- die Sperre im Client läge.
--
-- Sie liegt nicht im Client. `is_activated()` liest `deleted_at`, und gemessen
-- am 08.09. prüfen **34 von 34** schreibenden Policies im Schema `public`
-- genau diese Funktion; bei `storage.objects` ebenso jede schreibende Policy.
-- Es gibt hier also nichts zu bauen, nur etwas festzuhalten — die Zusagen 11
-- und 12 in `kontoloeschung_test.sql` tun das, damit die Null eine Null bleibt.
--
-- Forward-only.

alter table public.profiles
  add column erased_at timestamptz;

comment on column public.profiles.erased_at is
  'Gesetzt, wenn das MITGLIED SELBST sein Konto geloescht hat (AGE-708) — '
  'unwiderruflich, wird nie geleert. Nicht zu verwechseln mit `deleted_at`, '
  'der ruecknehmbaren Admin-Loeschung aus AGE-581: eine Kontoloeschung setzt '
  'BEIDE. `deleted_at` traegt dabei die Sichtbarkeit (rund vierzig Praedikate '
  'lesen es ueber is_activated()), `erased_at` traegt allein den Riegel gegen '
  'admin_restore_member. Neue Sichtbarkeitsregeln pruefen deshalb weiter '
  '`deleted_at`: einen Zustand mit erased_at und leerem deleted_at gibt es '
  'nicht.';

-- ── admin_restore_member verweigert die endgueltige Loeschung ───────────────
-- Unveraendert uebernommen aus 20260823130000_member_lifecycle_rpcs.sql, bis
-- auf den einen neuen Wall. Die Reihenfolge ist Absicht: erst der Waechter,
-- dann `erased_at`, dann `deleted_at`. Ein endgueltig geloeschtes Konto soll
-- „ist nicht wiederherstellbar" melden und nicht „ist nicht geloescht".
create or replace function public.admin_restore_member(target uuid, actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  zeile public.profiles;
begin
  zeile := public.lifecycle_guard(target, actor, 'admin_restore_member');

  if zeile.erased_at is not null then
    raise exception 'Profil % wurde vom Mitglied selbst geloescht und ist nicht wiederherstellbar', target
      using errcode = '22023';
  end if;

  if zeile.deleted_at is null then
    raise exception 'Profil % ist nicht geloescht', target using errcode = '22023';
  end if;

  update public.profiles set deleted_at = null where id = target;

  insert into public.admin_audit (actor, action, target, payload)
  values (actor, 'restore_member', target,
          jsonb_build_object('bleibt_deaktiviert', zeile.disabled_at is not null));

  -- Die Edge Function entbannt NUR, wenn das Mitglied nicht ohnehin
  -- deaktiviert ist. War es vor dem Loeschen gesperrt, ist es danach wieder
  -- gesperrt — der Vorzustand, nicht ein besserer.
  return jsonb_build_object(
    'deleted_at', null,
    'entbannen', zeile.disabled_at is null);
end $$;

comment on function public.admin_restore_member(uuid, uuid) is
  'Nimmt eine WEICHE Admin-Loeschung zurueck (AGE-581). Verweigert seit '
  'AGE-708 jedes Konto mit `erased_at` — eine Kontoloeschung durch das '
  'Mitglied selbst ist unwiderruflich, und ohne diesen Wall haette ein '
  'Restore den geleerten Grabstein wieder sichtbar gemacht.';
