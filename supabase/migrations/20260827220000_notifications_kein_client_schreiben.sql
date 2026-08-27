-- ════════════════════════════════════════════════════════════════════════════
-- AGE-641 — Hinweise schreibt der Server, nicht der Client
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/push-fundament/. Phase A, Schritt 2b.
--
-- ══ DER BEFUND ═════════════════════════════════════════════════════════════
-- GEFUNDEN VON DER PLAN-REVIEW, nicht beim Bauen. `20260715140000:77` erteilt
--
--   grant select, insert, update, delete on public.notifications to authenticated;
--
-- und `notifications_own` (20260806080100:399) laesst jede Zeile durch, deren
-- `profile_id` der Aufrufer selbst ist. Jedes aktivierte Mitglied kann sich
-- also beliebig viele Hinweiszeilen schreiben — mit beliebigem `type` und
-- beliebiger Nutzlast.
--
-- ══ WARUM DAS ERST JETZT EIN PROBLEM IST ═══════════════════════════════════
-- Bisher war es folgenlos: man haette die eigene Glocke vollgemuellt und sonst
-- nichts. Niemand sonst sieht diese Zeilen, es ist kein Leck.
--
-- Mit Push aendert sich die Rechnung. Jede `notifications`-Zeile wird dann ein
-- Auftrag an FCM und APNs — Arbeit, Kontingent und Kosten, ausgeloest von
-- jedem, der ein Konto hat. Und sie umgeht dabei ALLES: den Trigger, die
-- Sichtbarkeitspruefung, das Opt-out. Nicht weil die Pruefungen schwach
-- waeren, sondern weil eine direkt geschriebene Zeile gar nicht erst durch sie
-- hindurch muss.
--
-- ══ WARUM DER ENTZUG GEFAHRLOS IST ═════════════════════════════════════════
-- Gemessen, nicht vermutet. `grep 'from("notifications")' src/` findet genau
-- drei Stellen, alle in `hinweise.ts`:
--
--   :42  select id, type, payload, created_at   → SELECT
--   :68  update { read_at }  where id = …       → UPDATE
--   :79  update { read_at }  where read_at null → UPDATE
--
-- Kein Insert. Kein Delete. Die beiden entzogenen Rechte hat nie jemand
-- benutzt — sie standen da, weil `explicit_grants` sie fuer alle Tabellen in
-- einem Zug ausgesprochen hat.
--
-- ══ WARUM AUCH DELETE ══════════════════════════════════════════════════════
-- Aus demselben Grund, aus dem eine zugestellte Release-Note nicht loeschbar
-- ist: ein Hinweis ist eine Spur davon, dass jemand etwas erfahren HAT. Wer
-- ihn wegraeumen will, setzt `read_at` — dafuer bleibt UPDATE.
--
-- ══ VERWORFEN ══════════════════════════════════════════════════════════════
-- Eine Policy, die nur `insert` einschraenkt. Ein Grant, den niemand braucht,
-- gehoert entzogen und nicht mit einer zweiten Regel eingehegt: die Policy
-- waere eine weitere Stelle, die beim naechsten Umbau stimmen muss.
--
-- Donald, 27.08.2026.
-- ════════════════════════════════════════════════════════════════════════════

revoke insert, delete on public.notifications from authenticated;

comment on table public.notifications is
  'AGE-641: Hinweiszeilen. `authenticated` haelt hier SELECT und UPDATE — '
  'lesen und auf gelesen setzen. INSERT und DELETE wurden entzogen: Hinweise '
  'schreiben ausschliesslich die Trigger und die DEFINER-RPCs, sonst koennte '
  'jedes Mitglied an allen Pruefungen vorbei Push-Zustellungen ausloesen.';
