-- Die Kontolöschung, Teil A: der Fremdschlüssel auf `auth.users` fällt
-- (AGE-708). Donald, 2026-09-08. Change: openspec/changes/kontoloeschung/.
--
-- ══ WAS HIER PASSIERT UND WARUM ES SEIN MUSS ═══════════════════════════════
-- Ein Mitglied soll sein Konto selbst löschen können (Apple verlangt es, siehe
-- AGE-644). Entschieden ist: **anonymisieren, Fremdsicht bleibt** — Profil und
-- Kontaktdaten verschwinden, aber Beiträge, Kommentare und Nachrichten bleiben
-- stehen, damit fremde Gesprächsfäden nicht zerreissen.
--
-- Dem stand `profiles.id references auth.users (id) on delete cascade` im Weg.
-- An `profiles` hängen **35 Fremdschlüssel**, davon 28 ebenfalls kaskadierend.
-- Ein `auth.admin.deleteUser()` löschte damit still die ganze Kette. Gemessen
-- im RED von `kontoloeschung_test.sql`: nach dem Auth-Abgang waren nicht nur
-- der Beitrag des Mitglieds fort, sondern auch der KOMMENTAR EINES ANDEREN
-- MITGLIEDS darunter.
--
-- ══ WARUM `DROP` UND NICHT „NEU SETZEN OHNE KASKADE" ═══════════════════════
-- Das ist der Befund, den der Plan-Review gefunden hat (codex, HIGH), und er
-- ist die eigentliche Einsicht dieser Migration:
--
--   Ein Fremdschlüssel ohne `on delete`-Klausel ist `NO ACTION`.
--
-- `NO ACTION` erlaubt die Auth-Löschung nicht — es VERHINDERT sie, solange die
-- Profilzeile zeigt. Der erste Entwurf dieses Changes wollte den Schlüssel
-- „ohne Kaskade neu setzen" und hätte damit die Löschung unmöglich gemacht
-- statt sie zu ermöglichen. Im Schema sehen beide Zustände ähnlich aus; nur
-- der Katalog unterscheidet sie. `kontoloeschung_test.sql` prüft deshalb
-- BEIDES: die Abwesenheit der Bedingung im Katalog UND eine tatsächlich
-- durchgeführte Löschung.
--
-- `on delete set null` scheidet aus: `profiles.id` ist Primärschlüssel.
--
-- ══ WAS DADURCH VERLOREN GEHT ══════════════════════════════════════════════
-- Die automatische Aufräumung. Löscht jemand einen Nutzer direkt in der
-- GoTrue-Konsole, bleibt ab jetzt eine Profilzeile ohne Anmeldeidentität
-- zurück — ein verwaistes Profil.
--
-- Das ist ein bewusster Tausch, und er ist nicht symmetrisch: ein verwaistes
-- Profil ist sichtbar und reparierbar, eine still gelöschte Beitragskette
-- nicht. Die 1:1-Beziehung zwischen `auth.users` und `profiles` besteht
-- weiter, sie wird nur nicht mehr von der Datenbank erzwungen, sondern von der
-- Löschfunktion, die beide Seiten in fester Reihenfolge behandelt.
--
-- ══ WAS HIER ABSICHTLICH NICHT PASSIERT ════════════════════════════════════
-- Die 35 Kaskaden auf `profiles` bleiben, wie sie sind. Sie sind richtig für
-- den Fall, dass eine Profilzeile doch einmal verschwindet; die Kontolöschung
-- sorgt dafür, dass sie dabei gar nicht erst auslösen, indem sie die Zeile
-- stehen lässt.
--
-- Forward-only.

alter table public.profiles
  drop constraint profiles_id_fkey;

comment on column public.profiles.id is
  'Zugleich die auth.users-ID (1:1). Traegt seit AGE-708 KEINEN Fremdschluessel '
  'mehr auf auth.users: er kaskadierte, und ein auth-Abgang haette ueber diese '
  'Zeile die 35 an ihr haengenden Tabellen mitgerissen — samt fremder Beitraege '
  'und Kommentare. Die Kopplung liegt jetzt in der Loeschfunktion, nicht in der '
  'Datenbank. Folge: ein direkt in GoTrue geloeschter Nutzer hinterlaesst eine '
  'verwaiste Profilzeile. Bewusst so — sichtbar und reparierbar ist besser als '
  'still und unwiederbringlich. Ein Neusetzen OHNE Kaskade waere `no action` '
  'und wuerde die Auth-Loeschung verhindern statt sie zu erlauben.';
