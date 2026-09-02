-- AGE-628 — `feedback.theme`: die Zuordnung eines Feedbacks zu einem Thema.
--
-- Aufgabe 1.6 aus openspec/changes/feedback-ausbauen/tasks.md. Die scheiternde
-- Zusage steht seit 1.5 in supabase/tests/feedback_themes_test.sql (17–19).
--
-- ══ DIE REIHENFOLGE IST DIE MIGRATION ══════════════════════════════════════
-- nullable MIT Vorgabewert → Bestand setzen → Fremdschlüssel → `set not null`.
-- Jeder andere Weg bricht:
--   * `add column … not null` ohne Vorgabewert scheitert am Bestand.
--   * Erst den Fremdschlüssel, dann den Bestand: der Fremdschlüssel weist die
--     Bestandszeilen mit `null` nicht ab (null ist in einem FK erlaubt), aber
--     `set not null` fällt danach über sie.
--
-- ══ DER VORGABEWERT BLEIBT DAUERHAFT ═══════════════════════════════════════
-- Das ist die Korrektur, die die ERSTE Entwurfsfassung nicht hatte, und sie ist
-- der Grund, warum dieser Change überhaupt in der Reihenfolge „Migration vor
-- Frontend" deploybar ist.
--
-- Zwischen dieser Migration und dem Ausliefern der neuen Oberfläche nennt
-- KEIN Schreibzugriff die Spalte — die alte Maske kennt sie nicht. Ohne
-- `default 'generell'` bräche in diesem Fenster jedes Absenden von Feedback
-- an `not null`. Der Vorgabewert wird deshalb NICHT nach dem Backfill wieder
-- entfernt; er ist Teil der Zusage, nicht ein Werkzeug der Migration.
-- (design.md, Entscheidung 2; Zusage 19 in feedback_themes_test.sql.)
--
-- ══ WARUM `update` TROTZ AUTOMATISCHEM FÜLLEN ══════════════════════════════
-- Postgres füllt bei `add column … default` den Bestand selbst. Das `update`
-- unten ist deshalb im Normalfall ein Treffer von 0 Zeilen — es steht hier für
-- den Fall, dass die Spalte in einer früheren Instanz schon ohne Vorgabewert
-- angelegt wurde, und es kostet nichts. Ein `set not null` auf eine Spalte mit
-- auch nur einer `null`-Zeile bricht die Migration, und dieser Bruch wäre auf
-- PROD teuer.

-- 1. Spalte, nullable, mit dauerhaftem Vorgabewert.
alter table public.feedback
  add column if not exists theme text default 'generell';

-- 2. Bestand setzen (siehe Kopf: normalerweise 0 Zeilen).
update public.feedback set theme = 'generell' where theme is null;

-- 3. Fremdschlüssel auf die Themenliste. Ohne `on delete cascade`: ein Thema,
--    auf das Feedback zeigt, darf nicht verschwinden und dabei die Zuordnung
--    mitnehmen — der Löschversuch soll scheitern.
alter table public.feedback
  drop constraint if exists feedback_theme_fkey;
alter table public.feedback
  add constraint feedback_theme_fkey
  foreign key (theme) references public.feedback_themes (key);

-- 4. Jetzt erst die Pflicht.
alter table public.feedback
  alter column theme set not null;

comment on column public.feedback.theme is
  'Thema des Feedbacks, Fremdschlüssel auf feedback_themes.key (AGE-628). '
  'Der Vorgabewert ''generell'' ist DAUERHAFT: bis die neue Oberfläche '
  'ausgeliefert ist, nennt kein Schreibzugriff die Spalte.';
