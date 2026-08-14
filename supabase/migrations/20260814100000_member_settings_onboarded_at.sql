-- Der Merker für das Mini-Onboarding (AGE-538, Change C11 Teil 1).
--
-- Problem: die Willkommensstrecke soll einmal erscheinen und danach nie wieder —
-- auch nicht auf einem anderen Gerät. Ein localStorage-Eintrag bestünde genau
-- den Test nicht, um den es geht: überspringen am Laptop, anmelden am Handy.
-- Der Zustand gehört deshalb zum Konto, nicht zum Browser.
--
-- Entscheidung (design.md §3): die Spalte liegt in member_settings und NICHT in
-- profiles. Drei Gründe, und der erste ist eine Sichtbarkeitsfrage:
--
--   1. `profiles_select_self_or_discover` lautet `id = auth.uid() or
--      has_level(3)` und gibt ab der Stufe `discover` fremde VOLLZEILEN frei.
--      Ein Merker dort wäre für jedes zahlende Mitglied mitlesbar — eine
--      Preisgabe, die dieser Change nirgends beabsichtigt und die nirgends
--      stünde. member_settings trägt dagegen die Policy `member_settings_own`
--      (`for all`, `profile_id = auth.uid()`) und laut Tabellenkommentar
--      „strictly own-profile only".
--   2. `profiles` hat für `authenticated` kein Tabellen-UPDATE:
--      20260611171003_foundation_conform.sql:79 widerruft es und erteilt eine
--      SPALTENLISTE. Eine neue Spalte erbt daraus nichts (AGE-312), bräuchte
--      also einen eigenen Grant — und der bricht den Golden-Snapshot in
--      grants_test.sql samt CI-Job (AGE-455).
--   3. member_settings trägt `grant select, insert, update` auf TABELLENebene
--      (20260630130000:17). Eine zusätzliche Spalte fällt darunter.
--
-- Deshalb: KEINE neue Policy und KEIN neuer Grant — und das steht hier, statt
-- durch Schweigen offen zu bleiben. Präzedenzfall im Repo:
-- 20260804120000_member_settings_theme.sql mit derselben Begründung.
--
-- `timestamptz` statt `boolean`: kostet nichts und hält fest, wann. Eine
-- Auswertung „wer hat die Strecke gesehen" trägt der Wert allerdings NICHT — er
-- wird erst am Ausgang gesetzt, Abbrecher bleiben `null`, und Abschluss und
-- Überspringen sind daran nicht unterscheidbar. Wer das wissen will, braucht
-- ein Ereignis; dieser Change baut keins und behauptet es auch nicht.
--
-- Kein Default und kein `not null`: `null` IST die Bedeutung „noch nicht
-- gesehen", und die 70 Bestandszeilen sollen genau die tragen. Ein Backfill auf
-- now() nähme allen bestehenden Mitgliedern die Strecke weg, bevor sie
-- existiert.
--
-- Verworfene Alternative: zwei Merker, einer für „vertagt" und einer für
-- „beendet". „Später" setzt bewusst GAR nichts — die Strecke soll ja
-- wiederkommen —, und ein zweiter Zustand müsste dann tragen, was aus den Daten
-- nicht ableitbar ist: ob jemand einen Schritt bewusst leer weiterging oder ihn
-- nie sah. Die Wiederaufnahme richtet sich stattdessen nach dem ersten leeren
-- Feld (design.md §7).

alter table public.member_settings
  add column onboarded_at timestamptz;

comment on column public.member_settings.onboarded_at is
  'Zeitpunkt, zu dem das Mitglied die Willkommensstrecke beendet oder '
  'übersprungen hat (AGE-538). `null` heißt „noch nicht gesehen" und lässt die '
  'Strecke beim Aufruf der Startseite erscheinen. Trägt keine '
  'Zugriffsbedeutung und unterscheidet Abschluss nicht von Überspringen.';
