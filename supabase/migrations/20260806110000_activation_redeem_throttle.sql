-- Mitglieder-Aktivierung, Teil E: Drossel auf dem Einloeseweg (AGE-495, Task 5.6).
-- Spec: openspec/changes/member-activation-flow/. Forward-only.
--
-- WARUM. `redeem-activation` hat `verify_jwt = false` und muss es haben — das
-- Token traegt die Identitaet, nicht die Sitzung. Ein 256-Bit-Token ist nicht
-- erratbar; das Risiko ist nicht der Treffer, sondern die LAST: ein
-- ungedrosselter oeffentlicher Endpunkt laesst sich beliebig oft anschlagen,
-- und jeder Anschlag kostet eine Datenbankrunde.
--
-- DIE OFFENE FRAGE 12.6 WAR: wer ist hier der Aufrufer? Ohne Sitzung gibt es
-- kein Subjekt. Entscheidung Donald 2026-08-06: die IP — aber gezaehlt werden
-- AUSSCHLIESSLICH FEHLVERSUCHE.
--
-- Das ist der Unterschied zu der IP-Drossel, die der Kopf von Teil D
-- (20260806090000) fuer den VERSANDweg ausdruecklich verwirft. Dort waere das
-- Subjekt ein legitimer Aufruf gewesen, und hinter NAT haette der Zaehler das
-- echte Mitglied mit ausgesperrt. Hier zaehlt nur, was ohnehin abgelehnt wird:
--
--   claim_activation_token() -> 'claimed'          -> NIE gezaehlt, NIE gesperrt
--   claim -> not_found / expired / used / superseded -> Fehlversuch
--
-- Daraus folgen zwei Eigenschaften, und sie sind der Grund fuer genau diese
-- Form:
--
--   1. NAT faellt weg. 200 Mitglieder hinter einer Adresse loesen 200 GUELTIGE
--      Tokens ein und erzeugen null Zaehler. Wer ein gueltiges Token hat, kommt
--      durch — auch aus einem laengst vollen Eimer.
--   2. Ein gefaelschter `x-forwarded-for` schadet niemandem. Wer fremde
--      Adressen eintraegt, fuellt einen Eimer, der keinen aussperrt. Deshalb
--      steht hier keine Header-Validierung: sie waere Aufwand ohne Wirkung.
--
-- VERWORFENE ALTERNATIVEN.
--   * „Vor dem Beanspruchen pruefen." Spart eine Datenbankrunde und nimmt
--     dafuer Eigenschaft 1 zurueck: ein Mitglied mit gueltigem Token faende
--     eine gesperrte Adresse vor. Der Aufruf steht deshalb NACH dem Claim.
--   * „Globaler Zaehler ohne IP-Bezug." Speichert keine Adresse, laesst aber
--     einen Fremden den Einloeseweg fuer alle stilllegen — ein DoS als Feature.
--   * „Gar nichts, das Token traegt." Stimmt fuer das Erraten, nicht fuer die
--     Last. Der Endpunkt setzt Passwoerter; er ist nichts, was man offen
--     anschlagen laesst.
--
-- IP UND DSGVO. Eine IP ist ein personenbezogenes Datum. Sie wird deshalb nur
-- so lange gehalten, wie die Drossel sie braucht: jeder Aufruf raeumt zuerst
-- alles ausserhalb des Fensters weg. Es entsteht kein Verlauf, nur ein
-- gleitender Eimer.

create table public.activation_attempts (
  ip           text        not null,
  attempted_at timestamptz not null default now()
);

comment on table public.activation_attempts is
  'AGE-495 Task 5.6: gleitendes Fenster fehlgeschlagener Einloeseversuche je IP. '
  'Ein ERFOLGREICHER Versuch landet hier NIE — das ist die Eigenschaft, die den '
  'NAT-Einwand aus 12.6 aufloest. Kein Grant, keine Policy: nur service_role '
  'erreicht die Tabelle, und der ausschliesslich ueber note_failed_activation().';

create index activation_attempts_ip_zeit
  on public.activation_attempts (ip, attempted_at desc);

-- Deny-by-default wie bei `activation_tokens` (Teil A): RLS an, keine Policy,
-- kein Grant. Die fehlende Policy ist hier das Feature, nicht ein Versaeumnis —
-- wer sie spaeter „nachreicht", oeffnet eine Liste von Adressen.
alter table public.activation_attempts enable row level security;

create or replace function public.note_failed_activation(
  p_ip     text,
  p_window interval default interval '1 hour',
  p_limit  integer  default 20
) returns table (attempts integer, throttled boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ip     text := coalesce(nullif(p_ip, ''), 'unbekannt');
  v_anzahl integer;
begin
  -- Erst raeumen, dann zaehlen. Das haelt die Tabelle klein UND sorgt dafuer,
  -- dass keine Adresse laenger liegt als das Fenster (siehe Kopf, DSGVO).
  delete from public.activation_attempts
   where attempted_at < now() - p_window;

  insert into public.activation_attempts (ip) values (v_ip);

  select count(*)::integer into v_anzahl
    from public.activation_attempts
   where ip = v_ip
     and attempted_at >= now() - p_window;

  -- Streng groesser: bei p_limit = 20 ist der 21. Fehlversuch der erste, der
  -- gesperrt wird.
  return query select v_anzahl, v_anzahl > p_limit;
end;
$$;

comment on function public.note_failed_activation(text, interval, integer) is
  'AGE-495 Task 5.6: vermerkt EINEN fehlgeschlagenen Einloeseversuch und sagt, '
  'ob die Adresse damit ueber dem Limit liegt. Aufrufer ist redeem-activation, '
  'NACH dem Beanspruchen des Tokens — ein gueltiges Token laeuft hier nie durch.';

-- Grants ausdruecklich aussprechen (AGE-312): PUBLIC bekommt EXECUTE per
-- Default, das wird zuerst entzogen.
revoke execute on function public.note_failed_activation(text, interval, integer)
  from public, anon, authenticated;
grant execute on function public.note_failed_activation(text, interval, integer)
  to service_role;
