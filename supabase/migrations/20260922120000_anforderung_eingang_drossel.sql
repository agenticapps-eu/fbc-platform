-- Anforderungseingang, Drossel (AGE-830). Forward-only.
-- Change: openspec/changes/anforderung-eingang/ (design.md, Entscheidung 5).
--
-- WARUM. Die Edge Function `anforderung-eingang` hat `verify_jwt = false`; ihr
-- einziger Schutz ist ein geteiltes Geheimnis im Header der ChatGPT-Action.
-- Erraten lässt es sich nicht. Die Gefahr ist ein GÜLTIGER Schlüssel in
-- falschen Händen oder ein GPT, der in eine Schleife läuft — beides legt echte
-- Linear-Issues an. Diese Drossel begrenzt das auf 20 angelegte Issues pro
-- Stunde.
--
-- DIE BAUFORM IST DIE VON `activation_attempts`, DAS SUBJEKT NICHT:
--
--   * Keine IP. Alle Aufrufe kommen aus ChatGPTs Egress und teilen sich
--     wenige Adressen mit allen anderen GPTs. Ein Eimer je IP unterschiede
--     nichts. Ohne IP entfällt auch die DSGVO-Überlegung, die
--     `activation_attempts` braucht: diese Tabelle hält nur Zeitpunkte.
--   * Gezählt wird, was ENTSTANDEN ist, nicht was versucht wurde. Ein
--     Linear-Ausfall (502), ein Probelauf oder ein gedrosselter Aufruf (429)
--     verbraucht keine Quote. Deshalb zwei Funktionen: `anforderung_frei`
--     zählt nur und wird vor dem ersten Download gerufen,
--     `anforderung_vermerken` schreibt und wird nur nach einem von Linear
--     bestätigten Issue gerufen.
--
-- HINGENOMMEN: zwei gleichzeitige Aufrufe bei Stand 19 sehen beide „frei".
-- Die Grenze begrenzt Missbrauch, sie ist kein Kontingent. Ein einziger
-- Einreicher, der jede Anforderung einzeln bestätigt, erzeugt keine
-- Parallelität. Eine harte Grenze bräuchte Reservierung, Sperre und Rücknahme
-- (Plan-Review, REVIEWS.md).

create table public.anforderung_eingaenge (
  angelegt_um timestamptz not null default now()
);

comment on table public.anforderung_eingaenge is
  'AGE-830: ein Zeitpunkt je angelegtem Linear-Issue aus der ChatGPT-Action. '
  'Kein Inhalt, keine IP. Kein Grant, keine Policy: nur service_role erreicht '
  'die Tabelle, und der ausschliesslich ueber anforderung_frei() und '
  'anforderung_vermerken().';

create index anforderung_eingaenge_zeit
  on public.anforderung_eingaenge (angelegt_um desc);

-- Deny-by-default wie `activation_attempts`: RLS an, keine Policy, kein Grant.
alter table public.anforderung_eingaenge enable row level security;

create or replace function public.anforderung_frei(
  p_fenster interval default interval '1 hour',
  p_grenze  integer  default 20
) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) < p_grenze
    from public.anforderung_eingaenge
   where angelegt_um >= now() - p_fenster;
$$;

comment on function public.anforderung_frei(interval, integer) is
  'AGE-830: true, solange im Fenster weniger als p_grenze Issues angelegt '
  'wurden. Schreibt nichts — sonst verlaengerte jeder gedrosselte Aufruf die '
  'Sperre. Aufrufer ist anforderung-eingang, vor dem ersten Download.';

create or replace function public.anforderung_vermerken(
  p_fenster interval default interval '1 hour'
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Erst räumen, dann einfügen: die Tabelle bleibt so klein wie das Fenster.
  delete from public.anforderung_eingaenge
   where angelegt_um < now() - p_fenster;

  insert into public.anforderung_eingaenge default values;
end;
$$;

comment on function public.anforderung_vermerken(interval) is
  'AGE-830: vermerkt EIN angelegtes Issue. Aufrufer ist anforderung-eingang, '
  'nur nach einem von Linear bestaetigten issueCreate.';

-- Grants ausdrücklich aussprechen (AGE-312): PUBLIC bekommt EXECUTE per
-- Default, das wird zuerst entzogen.
revoke execute on function public.anforderung_frei(interval, integer)
  from public, anon, authenticated;
grant execute on function public.anforderung_frei(interval, integer)
  to service_role;

revoke execute on function public.anforderung_vermerken(interval)
  from public, anon, authenticated;
grant execute on function public.anforderung_vermerken(interval)
  to service_role;
