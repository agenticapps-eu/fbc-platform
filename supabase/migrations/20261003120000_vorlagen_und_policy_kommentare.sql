-- Vorlagen folgen den Events, und die neuen Policies bekommen Kommentare.
-- AGE-1000 (V5F-1), Change openspec/changes/rechte-v5-final/.
--
-- Beides sind Befunde des Diff-Reviews, und beide haben denselben Kern: eine
-- Aussage im Katalog, die nicht mehr stimmt.
--
-- ══ 1. `event_vorlagen` ════════════════════════════════════════════════════
-- Der Kommentar auf `vorlagen_write_host` sagte bis hierher:
--
--   „Spiegel von events_write_host. Gemessen (AGE-630): events_write_host
--    traegt KEIN has_level-Gate … 'Rechte wie bei Events' heisst deshalb:
--    aktiviert und eigene Zeile."
--
-- Nach 20261003100100 ist der erste Satz falsch, und damit die Schlussfolgerung.
-- Dahinter steckt mehr als ein veralteter Kommentar: `event_serie_erzeugen` ist
-- SECURITY INVOKER und legt die Termine als Aufrufer an. Ein Konto ohne
-- `events.erstellen` koennte also eine Vorlage anlegen und daraus nichts
-- erzeugen — eine Flaeche, die auf halbem Weg an der RLS endet.
--
-- Die Vorlage folgt deshalb dem Event: anlegen verlangt dasselbe Recht,
-- pflegen und loeschen bleiben beim Eigentum. Eine Vorlage ist kein eigener
-- Gegenstand, sondern ein Geraet zum Anlegen von Events.
--
-- ══ 2. Kommentare auf den neuen Policies ═══════════════════════════════════
-- Die geloeschte `events_write_host` trug einen Kommentar, der die
-- `cover_path`-Bindung aus AGE-531 erklaerte. 20260926120000 protokolliert
-- ausdruecklich, dass genau dieser Kommentar schon einmal bei einem Ersatz der
-- Policy verloren ging. Hier geht er nicht wieder verloren.

-- ── 1. Vorlagen: anlegen verlangt `events.erstellen` ────────────────────────
drop policy vorlagen_write_host on public.event_vorlagen;

create policy vorlagen_insert_host on public.event_vorlagen
  for insert to authenticated
  with check (
    public.is_activated()
    and host_id = (select auth.uid())
    and (select public.darf('events.erstellen'))
    and (cover_path is null
         or split_part(cover_path, '/', 1) = ((select auth.uid()))::text)
  );

create policy vorlagen_update_host on public.event_vorlagen
  for update to authenticated
  using (
    public.is_activated()
    and host_id = (select auth.uid())
  )
  with check (
    public.is_activated()
    and host_id = (select auth.uid())
    and (cover_path is null
         or split_part(cover_path, '/', 1) = ((select auth.uid()))::text)
  );

create policy vorlagen_delete_host on public.event_vorlagen
  for delete to authenticated
  using (
    public.is_activated()
    and host_id = (select auth.uid())
  );

create policy vorlagen_select_host on public.event_vorlagen
  for select to authenticated
  using (
    public.is_activated()
    and host_id = (select auth.uid())
  );

comment on policy vorlagen_insert_host on public.event_vorlagen is
  'Folgt den Events: anlegen verlangt darf(''events.erstellen'') (Rang 6, '
  'AGE-1000). Grund ist kein Prinzip, sondern eine Kette — '
  'event_serie_erzeugen ist SECURITY INVOKER und legt die Termine als Aufrufer '
  'an; eine Vorlage ohne dieses Recht erzeugte nichts. Die cover_path-Bindung '
  'aus AGE-630 bleibt und beweist Eigentum am Speicherpfad.';

comment on policy vorlagen_update_host on public.event_vorlagen is
  'Pflegen bleibt beim Eigentum, ohne Recht (AGE-1000): wer absteigt, muss '
  'seine Vorlage berichtigen und ihre Reihe stoppen koennen. Nur das Anlegen '
  'faellt. cover_path-Bindung wie beim Insert.';

comment on policy vorlagen_delete_host on public.event_vorlagen is
  'Loeschen bleibt beim Eigentum, ohne Recht — aus demselben Grund wie das '
  'Pflegen (AGE-1000).';

comment on policy vorlagen_select_host on public.event_vorlagen is
  'Eine Vorlage gehoert immer genau einem Host und ist nur fuer ihn lesbar. '
  'Unveraendert gegenueber der abgeloesten ALL-Policy (AGE-630).';

-- ── 2. Die Kommentare, die beim Ersatz verloren gingen ──────────────────────
comment on policy events_insert_host on public.events is
  'Anlegen verlangt darf(''events.erstellen'') (Rang 6, AGE-1000). Bis dahin '
  'durfte JEDES aktivierte Konto Events anlegen — die abgeloeste ALL-Policy '
  'prueefte nur is_activated() und den Host. '
  'Die cover_path-Bindung ist der Befund codex HIGH aus AGE-630: die '
  'Upload-Policy beweist Eigentum nur, WAEHREND das Objekt entsteht; wer '
  'danach die Spalte schreibt, prueft niemand. Ohne sie haengte ein Mitglied '
  'den verwaisten Pfad eines fremden members-Events an sein eigenes '
  'public-Event, und anon signierte ein Bild, das nie oeffentlich war.';

comment on policy events_update_host on public.events is
  'Aendern bleibt beim Eigentum, OHNE Recht (AGE-1000): ein Host, dessen Stufe '
  'sinkt, muss seinen Termin absagen, berichtigen und seine Anmeldungen '
  'betreuen koennen. Das Gegenteil waere eine Datensperre, die wie ein '
  'Rechtemodell aussieht. Die cover_path-Bindung steht hier mit demselben '
  'Grund wie im Insert — siehe dort.';

comment on policy events_delete_host on public.events is
  'Loeschen bleibt beim Eigentum, ohne Recht — aus demselben Grund wie das '
  'Aendern (AGE-1000).';

comment on policy offers_insert_own on public.offers is
  'Einstellen verlangt darf(''suche_biete'') (Rang 5, AGE-1000; SPEC 01 V5 '
  'FINAL bindet „SUCHE/BIETE einstellen und lesen" an FOCUS).';

comment on policy offers_update_own on public.offers is
  'Pflegen bleibt beim Eigentum, ohne Recht (AGE-1000). ACHTUNG fuer jeden '
  'Schreiber: ein Ersetzen der Sammlung muss EINFUEGEN, DANN LOESCHEN — '
  'umgekehrt gelingt das Loeschen und das Einfuegen scheitert, und die '
  'Eintraege sind fort. Genau das hat saveMatchingProfile getan (Befund des '
  'Diff-Reviews, CRITICAL).';

comment on policy offers_delete_own on public.offers is
  'Zuruecknehmen bleibt beim Eigentum, ohne Recht (AGE-1000) — und ist damit '
  'maechtiger als das Einfuegen. Siehe den Hinweis auf offers_update_own.';

comment on policy needs_insert_own on public.needs is
  'Einstellen verlangt darf(''suche_biete'') (Rang 5, AGE-1000). Spiegel von '
  'offers_insert_own.';

comment on policy needs_update_own on public.needs is
  'Pflegen bleibt beim Eigentum, ohne Recht (AGE-1000). Derselbe Hinweis zur '
  'Schreibreihenfolge wie auf offers_update_own.';

comment on policy needs_delete_own on public.needs is
  'Zuruecknehmen bleibt beim Eigentum, ohne Recht (AGE-1000). Spiegel von '
  'offers_delete_own.';

comment on policy offers_select on public.offers is
  'Fremde Zeilen ab darf(''suche_biete'') (Rang 5, AGE-1000; vorher '
  'has_level(4)). Eigene Zeilen immer — sonst waere ein Abstieg eine '
  'Datensperre.';

comment on policy needs_select on public.needs is
  'Fremde Zeilen ab darf(''suche_biete'') (Rang 5, AGE-1000). Spiegel von '
  'offers_select.';

comment on policy matches_select_participant on public.matches is
  'Beteiligung UND darf(''vorschlaege'') (Rang 5, AGE-1000). Die Reihenfolge '
  'ist die Aussage: das Recht oeffnet keine fremden Paare, und die Teilnahme '
  'ersetzt das Recht nicht. Zeilen unterhalb Rang 5 bleiben in der Tabelle — '
  'ein Aufstieg zeigt sie wieder, ohne dass das Matching erneut laeuft.';
