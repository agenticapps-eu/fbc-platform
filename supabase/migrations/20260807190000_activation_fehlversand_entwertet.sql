-- Der Fehlversand entwertet sein eigenes Token (AGE-495) — Befund E1 aus dem
-- unabhaengigen Code-Review 8.7 vom 2026-08-07, zusammen mit P2 (Aufgabe 11.6).
--
-- Entscheidung Donald, 2026-08-07: die Ursache wird geschlossen, und die
-- Oberflaeche sagt dazu die Wahrheit (zweiter Teil im Frontend, nicht hier).
--
-- VERWORFENE ALTERNATIVE: das Schutzfenster selbst in eine Drossel umbauen —
-- issue_activation_token entwertet und gibt neu aus, so wie
-- request_own_activation_token es tut, nur unter engeren Grenzen. Das haette
-- die beiden Knoepfe angeglichen, die heute Gegensaetzliches tun. Es haette
-- aber genau die Aussperrung wieder geoeffnet, die das Schutzfenster am
-- 2026-08-06 zumachte: wer bloss die Login-Adresse kennt, entwertet damit
-- wieder den Link des Mitglieds. Das Schutzfenster bleibt, was es ist.
--
-- ── Der Befund ─────────────────────────────────────────────────────────────
-- send-activation antwortet 202 und sendet DANACH — sonst braucht eine
-- bestehende Adresse messbar laenger als eine unbekannte, und die Function ist
-- ein Orakel fuer Mitgliedsadressen. Schlug Resend danach fehl, wurde das nur
-- protokolliert (send-activation/index.ts:158-171): das Token blieb GUELTIG
-- liegen. Jeder weitere anonyme Anlauf lief 24 h lang in den „pending"-Zweig
-- von issue_activation_token (20260806090000:186-201) — kein Versand, kein
-- neues Token, und /aktivierung meldete dabei dasselbe Gruen wie im
-- Erfolgsfall. Wer die Mail nie bekam, wartete einen Tag auf nichts.
--
-- ── Warum ein RPC und kein direkter Schreibzugriff ─────────────────────────
-- activation_tokens hat mit Absicht KEINEN Table-Grant und KEINE Policy
-- (20260806080000:53-60); jede Edge Function fasst die Tabelle ausschliesslich
-- ueber SECURITY-DEFINER-RPCs an. Ein direkter Service-Role-Schreibzugriff
-- waere der erste Bruch damit und haenge zudem an geerbten Default Privileges,
-- die in diesem Projekt schon einmal gefehlt haben (AGE-312).
--
-- ── Was ABSICHTLICH bleibt ─────────────────────────────────────────────────
-- Die 60-s-Sperre und das Tageskontingent von issue_activation_token zaehlen
-- ueber `created_at` und sehen auch entwertete Token. Nach einem Fehlversand
-- ist der naechste Anlauf also noch 60 s gesperrt und zaehlt gegen die fuenf
-- Versuche des Tages. Das ist gewollt: sonst waere eine dauerhaft kaputte
-- Resend-Konfiguration ein unbegrenzter Ausloeser fuer Versandversuche. Aus
-- 24 Stunden Schweigen wird eine Minute — mehr war der Befund nicht.

create or replace function public.invalidate_activation_token(p_token_hash text)
  returns boolean
  language plpgsql
  volatile
  security definer
  set search_path = ''
as $$
declare
  v_treffer int;
begin
  -- Nur OFFENE Token. Ein bereits eingeloestes anzufassen hiesse, eine
  -- abgeschlossene Aktivierung nachtraeglich umzuschreiben.
  update public.activation_tokens
     set invalidated_at = now()
   where activation_tokens.token_hash = p_token_hash
     and activation_tokens.used_at is null
     and activation_tokens.invalidated_at is null;

  get diagnostics v_treffer = row_count;
  return v_treffer > 0;
end;
$$;

comment on function public.invalidate_activation_token(text) is
  'Entwertet GENAU das Token mit diesem Hash (AGE-495, Befund E1). Aufrufer ist '
  'send-activation, wenn der Versand nach der 202-Antwort fehlschlaegt: sonst '
  'liegt ein gueltiges Token in der Tabelle, zu dem nie eine Mail kam, und das '
  'Schutzfenster von issue_activation_token schweigt darauf 24 Stunden. Setzt '
  'invalidated_at, NICHT used_at — der Unterschied ist die Meldung, die das '
  'Mitglied beim naechsten Anlauf liest ("ueberholt", nicht "bereits '
  'aktiviert"). Gibt true zurueck, wenn ein offenes Token getroffen wurde, '
  'sonst false; folgenlos wiederholbar. Nur service_role — waere sie fuer '
  'authenticated aufrufbar, waere das Entwerten selbst der Aussperrungs-Weg, '
  'den das Schutzfenster zumacht.';

revoke execute on function public.invalidate_activation_token(text)
  from public, anon, authenticated;
grant execute on function public.invalidate_activation_token(text) to service_role;
