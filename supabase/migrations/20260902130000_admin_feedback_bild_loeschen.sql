-- AGE-628 — Der Admin nimmt einen Screenshot vom Feedback.
--
-- Aufgabe 5.2 aus openspec/changes/feedback-ausbauen/tasks.md. Die
-- scheiternden Zusagen stehen seit 5.1 in
-- supabase/tests/feedback_screenshots_test.sql, Abschnitt 7 (5 von 37 rot).
--
-- Donald am 01.09., gegen den Vorschlag des Entwurfs, es zu vertagen: ein
-- Leserecht ohne Loeschrecht macht den Admin zum Zeugen ohne Handhabe.
--
-- ══ KEIN PFAD VOM AUFRUFER ═════════════════════════════════════════════════
-- Die Funktion nimmt die FEEDBACK-KENNUNG entgegen und liest den Pfad aus der
-- Zeile. Ein Pfad vom Aufrufer waere derselbe _confused deputy_, gegen den der
-- CHECK aus Aufgabe 2.5 steht: der Admin duerfte damit jedes Objekt im Bucket
-- nennen, auch eines, das an einer ganz anderen Zeile haengt.
--
-- ══ SIE LEERT DEN VERWEIS UND GIBT DEN PFAD ZURUECK ════════════════════════
-- Das OBJEKT entfernt der Aufrufer danach ueber die Storage-API. Genau dafuer
-- traegt er die DELETE-Policy aus 2.4 — ohne diesen Weg waere sie sinnlos.
--
-- ══ WARUM HIER KEIN `delete from storage.objects` STEHT ════════════════════
-- Das waere die scheinbar kuerzere Fassung und die falsche. `storage.objects`
-- ist die METAZEILE; die Bytes liegen im Speicher-Backend. Die Zeile
-- wegzuloeschen liesse die Datei fuer immer liegen — deshalb steht davor der
-- Trigger `storage.protect_delete()` mit dem Hinweis „This prevents accidental
-- data loss from orphaned objects". Ihn aus einer DEFINER-Funktion heraus zu
-- uebergehen hiesse, seine Begruendung zu ignorieren.
--
-- Die Reihenfolge — erst die Zeile, dann das Objekt — ist dieselbe, die
-- `removePostMedia` in src/lib/feed.ts seit AGE-582 ausgeschrieben traegt:
-- andersherum bliebe bei einem Abbruch dazwischen ein Verweis auf ein Bild
-- stehen, das es nicht mehr gibt. So herum ist der schlimmste Ausgang ein
-- verwaistes Objekt, das niemand sieht.
--
-- ══ FEHLER STATT STILLEM NICHTS ════════════════════════════════════════════
-- Ein Nicht-Admin und eine unbekannte Kennung brechen ab. Beide saehen als
-- stilles `null` fuer die Oberflaeche aus wie „war schon geloescht" — die
-- eine Antwort, die auf keinen Fall gegeben werden darf, wenn nichts
-- geschehen ist. Ein zweiter Aufruf auf einer bereits geleerten Zeile ist
-- dagegen KEIN Fehler: derselbe Knopf darf zweimal getroffen werden.

create or replace function public.admin_feedback_bild_loeschen(p_feedback_id uuid)
  returns text
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  v_pfad text;
  v_da   boolean;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin_feedback_bild_loeschen' using errcode = '42501';
  end if;

  -- `for update` haelt die Zeile bis zum Ende der Transaktion. Ohne die Sperre
  -- koennten zwei Admins denselben Pfad zurueckbekommen und beide versuchen,
  -- dasselbe Objekt zu entfernen; der zweite bekaeme dann einen Fehler aus der
  -- Storage-API fuer etwas, das laengst erledigt ist.
  select true, f.screenshot_path
    into v_da, v_pfad
    from public.feedback f
   where f.id = p_feedback_id
     for update;

  if not coalesce(v_da, false) then
    raise exception 'admin_feedback_bild_loeschen: unbekannte Feedback-Kennung %',
      p_feedback_id using errcode = '22023';
  end if;

  if v_pfad is null then
    return null;
  end if;

  update public.feedback set screenshot_path = null where id = p_feedback_id;

  return v_pfad;
end $$;

revoke execute on function public.admin_feedback_bild_loeschen(uuid) from public, anon;
grant  execute on function public.admin_feedback_bild_loeschen(uuid) to authenticated;

comment on function public.admin_feedback_bild_loeschen(uuid) is
  'Nimmt den Screenshot von einer Feedback-Zeile (AGE-628): prueft die '
  'Admin-Eigenschaft, leert screenshot_path und gibt den Pfad zurueck, damit '
  'der Aufrufer das OBJEKT ueber die Storage-API entfernt — dafuer traegt er '
  'die DELETE-Policy feedback_screenshots_delete. Nimmt bewusst KEINEN Pfad '
  'entgegen, sondern die Feedback-Kennung: ein Pfad vom Aufrufer waere ein '
  'confused deputy ueber den ganzen Bucket. Loescht die storage.objects-Zeile '
  'ausdruecklich NICHT selbst — das liesse die Bytes im Backend liegen, und '
  'genau davor steht storage.protect_delete(). Bricht fuer Nicht-Admins mit '
  '42501 ab und fuer eine unbekannte Kennung mit 22023; ein zweiter Aufruf '
  'auf einer bereits geleerten Zeile liefert null und ist kein Fehler.';
