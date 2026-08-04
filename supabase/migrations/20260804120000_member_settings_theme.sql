-- Theme als Mitglieder-Einstellung (AGE-492, Change C1 des eff.bee.zee-Go-Live).
--
-- Problem: das Theme (hell | navy) lag bis hierhin nur im localStorage. Damit ist es
-- an ein Gerät gebunden: wer die Plattform am Laptop auf navy stellt, sitzt am Handy
-- wieder im hellen Theme. Mit zwei gleichberechtigten Themes — und nicht mehr einem
-- Review-Switcher für Detlev — ist das eine echte Einstellung und gehört zum Konto.
--
-- Entscheidung (AGE-492 §4): der Serverwert gewinnt beim Login und überschreibt
-- localStorage. localStorage bleibt trotzdem, und zwar nicht als Cache, sondern weil
-- der Serverwert prinzipbedingt ZU SPÄT kommt: er braucht einen Roundtrip, das erste
-- Paint ist da längst passiert. Ohne den lokalen Wert lädt die App für jeden
-- navy-Nutzer sichtbar hell und springt dann um. Ausgeloggt gilt nur localStorage,
-- Default 'hell'.
--
-- Verworfene Alternative: das Theme aus einer Systemeinstellung ableiten
-- (prefers-color-scheme). Dann wäre 'navy' kein gewähltes Design mehr, sondern ein
-- Dark-Mode — und die Vorlage (docs/design-system.html) entwirft navy als
-- gleichwertige Marken-Variante mit eigener Sidebar-Anmutung, nicht als Nachtmodus.
--
-- Rechte: KEINE neue Policy und KEIN neuer Grant. member_settings trägt seit
-- 20260630130000 die Policy member_settings_own (`for all`, profile_id = auth.uid())
-- und die Table-Grants select/insert/update an authenticated. Eine zusätzliche
-- SPALTE fällt unter beide — anders als eine neue Tabelle, die nach AGE-312 nichts
-- erbt. Das Theme trägt zudem keinerlei Zugriffsbedeutung: es wählt eine
-- Darstellung und gated nichts.

alter table public.member_settings
  add column theme text not null default 'hell'
    check (theme in ('hell', 'navy'));

comment on column public.member_settings.theme is
  'Gewähltes Design-Theme (hell | navy, AGE-492). Reine Darstellung, keine '
  'Zugriffsbedeutung. Gewinnt beim Login über den localStorage-Wert des Geräts.';
