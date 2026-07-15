-- Verzeichnis-Sichtbarkeit: die Kopie entfernen (AGE-313).
--
-- `member_settings.visible_in_directory` war eine Kopie von `profiles.is_public`
-- ohne eigene Bedeutung. Erzwungen wurde immer nur is_public -- profiles_public
-- filtert `where is_public` --, die Kopie kannte weder Policy noch Funktion noch
-- View. Ein einziger UI-Toggle schrieb beide nacheinander und nicht atomar:
-- brach der zweite Write ab, zeigte die Einstellungsseite beim naechsten Laden
-- "ausgeblendet", waehrend das Verzeichnis die Person weiter listete.
--
-- Bewusst KEINE atomare RPC als Fix: die haette zwei Kopien synchron gehalten,
-- statt die ueberfluessige zu entfernen. `authenticated` hat ohnehin
-- `update (is_public)` auf profiles und koennte die Kopie an jeder RPC vorbei
-- veralten lassen. Eine Quelle der Wahrheit macht Divergenz unmoeglich, statt
-- sie nur unwahrscheinlich zu machen.

-- 1. Verlorene Absicht nachholen -------------------------------------------
--
-- Wo beide auseinanderlaufen, traegt die Kopie die Absicht des Mitglieds: der
-- Toggle schreibt `visible_in_directory` ZUERST, `is_public` danach -- eine
-- Divergenz heisst also, dass der zweite Write gescheitert ist und is_public der
-- veraltete Wert ist. setProfileVisibility() ist der einzige Schreiber von
-- is_public (kein Trigger, keine Funktion, keine andere UI), deshalb ist die
-- Richtung eindeutig.
--
-- Die Kopie ersatzlos zu droppen wuerde die gespeicherte Einstellung dort still
-- verwerfen, wo sie noch nicht angekommen ist. Deshalb erst anwenden, dann
-- entfernen.

do $$
declare n int;
begin
  update public.profiles p
     set is_public = ms.visible_in_directory
    from public.member_settings ms
   where ms.profile_id = p.id
     and p.is_public is distinct from ms.visible_in_directory;
  get diagnostics n = row_count;
  raise notice 'AGE-313: % Profil(e) auf die gespeicherte Verzeichnis-Einstellung korrigiert', n;
end $$;

-- 2. Kopie entfernen --------------------------------------------------------
--
-- Kein Datenverlust: is_public traegt nach Schritt 1 dieselbe Information und
-- ist die durchgesetzte Quelle. Ab hier liest und schreibt die
-- Einstellungsseite direkt profiles.is_public.

alter table public.member_settings drop column visible_in_directory;
