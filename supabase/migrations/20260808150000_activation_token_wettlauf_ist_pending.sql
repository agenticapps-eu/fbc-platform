-- Der Verlierer eines gleichzeitigen Wettlaufs ist „pending", kein Fehler
-- (AGE-505) — Befund 8.1 aus Review 5.4, gefunden vom Reviewer eines anderen
-- Anbieters.
--
-- ── Der Befund ─────────────────────────────────────────────────────────────
-- send-activation antwortet absichtlich IMMER 202: der Aufrufer soll nie
-- erfahren, ob es die Adresse gibt. Ein Fehler des RPC wurde dort aber in 502
-- uebersetzt — und genau dieser Fehler war erreichbar.
--
-- Zwei GLEICHZEITIGE Anfragen fuer dieselbe bekannte Adresse passieren beide
-- die Zaehl- und Pending-Abfragen (sie lesen, bevor eine von beiden schreibt).
-- Beim Einfuegen laesst der partielle Unique-Index nur eine durch; die andere
-- bekommt eine Unique-Violation und damit 502. Fuer eine UNBEKANNTE Adresse
-- antworten dieselben zwei Anfragen zweimal mit 202. Ein einziges Anfragenpaar
-- unterschied damit Mitglied von Nicht-Mitglied.
--
-- ── Warum das hier steht und nicht in der Edge Function ────────────────────
-- Der erste Anlauf fing den SQLSTATE 23505 in der Function ab. Das war falsch,
-- und der Review hat es als Blocker gemeldet: `activation_tokens` traegt ZWEI
-- Unique-Constraints — den partiellen Index (hoechstens ein offenes Token je
-- Profil, der Waechter hier) und den PRIMAERSCHLUESSEL auf `token_hash`. Beide
-- werfen 23505. Wer pauschal ueber den SQLSTATE abfaengt, verschluckt eine
-- kaputte Token-Erzeugung mit — und liefert „angenommen" fuer ein Konto, das
-- nie eine Mail bekommt. Das ist genau die Fehlerklasse, gegen die der Fix
-- antritt.
--
-- Welcher Constraint gegriffen hat, ist nur HIER strukturell bekannt:
-- `get stacked diagnostics … = constraint_name` nennt ihn beim Namen, statt
-- einen Fehlercode zu deuten. Dass Postgres den Namen auch fuer einen partiellen
-- INDEX (keinen Table-Constraint) liefert, ist am 08.08. gegen die lokale
-- Instanz gemessen: `probe_offen_je_profil` gegen `probe_tokens_pkey`, beide
-- mit SQLSTATE 23505.
--
-- Nachweisbar in `rls_test.sql` — der Test erzwingt eine PK-Kollision
-- deterministisch (derselbe Hash zweimal) und verlangt, dass sie WIRFT.
--
-- ── Warum „pending" der richtige Status ist ────────────────────────────────
-- Nicht als Notluege, sondern weil es die Lage beschreibt: der Gewinner hat
-- soeben ein gueltiges Token angelegt und verschickt es an dieselbe hinterlegte
-- Adresse. Der Verlierer findet also genau das vor, was `pending` meint — ein
-- gueltiger Link ist unterwegs. Er versendet nichts und legt nichts an.
--
-- Der Wettlauf selbst ist in pgTAP NICHT nachstellbar: er braucht zwei
-- Sitzungen, und weder `dblink` noch `pg_background` sind installiert. Was
-- geprueft ist, ist die Unterscheidung — dass der PK-Fall NICHT als Wettlauf
-- gilt. Das ist der Teil, an dem der erste Anlauf gescheitert ist.
--
-- Vollstaendige Neudeklaration, weil Postgres keine partielle Aenderung kennt.
-- Gegen 20260807200000 sind AUSSCHLIESSLICH zwei Dinge geaendert: das `insert`
-- ist in einen Block mit `exception when unique_violation` gefasst, und dafuer
-- kommt die Deklaration `v_constraint text` dazu. Grenzwerte, Reihenfolge der
-- Zweige, Entwertung, zurueckgegebene Spalten, `search_path` und Grants sind
-- unveraendert uebernommen — nachgemessen am kommentarfreien Rumpf-Diff, nicht
-- behauptet.

create or replace function public.issue_activation_token(
  p_email      text,
  p_token_hash text,
  p_ttl        interval default interval '72 hours'
) returns table (status text, profile_id uuid, display_name text, login_email text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id        uuid;
  v_name      text;
  v_activated timestamptz;
  v_email     text;
  v_letzte    timestamptz;
  v_tag_zahl  int;
  v_offen     timestamptz;
  v_constraint text;
begin
  select p.id, p.name, p.activated_at, u.email
    into v_id, v_name, v_activated, v_email
    from public.profiles p
    join auth.users u on u.id = p.id
   where lower(u.email) = lower(trim(p_email));

  if not found then
    return query select 'unknown'::text, null::uuid, null::text, null::text;
    return;
  end if;

  select max(created_at), count(*) filter (where created_at > now() - interval '24 hours')
    into v_letzte, v_tag_zahl
    from public.activation_tokens t
   where t.profile_id = v_id;

  if v_letzte is not null and v_letzte > now() - interval '60 seconds' then
    return query select 'rate_limited'::text, v_id, v_name, v_email;
    return;
  end if;

  -- Das Schutzfenster. Liegt ein noch gueltiger, unbenutzter Link im Postfach,
  -- passiert hier NICHTS: kein Entwerten, kein neues Token, kein Versand. Das
  -- ist der ganze Unterschied zwischen „ein Fremder nervt" und „ein Fremder
  -- sperrt mich aus" — und es gilt fuer den Reset-Link genauso.
  select max(created_at)
    into v_offen
    from public.activation_tokens t
   where t.profile_id = v_id
     and t.used_at is null
     and t.invalidated_at is null
     and t.expires_at > now();

  if v_offen is not null and v_offen > now() - interval '24 hours' then
    return query select 'pending'::text, v_id, v_name, v_email;
    return;
  end if;

  if v_tag_zahl >= 5 then
    return query select 'rate_limited_day'::text, v_id, v_name, v_email;
    return;
  end if;

  update public.activation_tokens
     set invalidated_at = now()
   where activation_tokens.profile_id = v_id
     and used_at is null and invalidated_at is null;

  -- Der Waechter wird beim NAMEN genannt, nicht ueber den Fehlercode: eine
  -- Verletzung des Primaerschluessels (`token_hash` doppelt — eine kaputte
  -- Token-Erzeugung) traegt denselben SQLSTATE 23505 und muss weiter WERFEN.
  -- Siehe Kopf.
  --
  -- `on conflict` waere die kuerzere Schreibweise, geht hier aber nicht: die
  -- Inferenz-Klausel darf nicht qualifiziert werden, und `profile_id` ist
  -- zugleich OUT-Parameter dieser Function — Postgres meldet die Spalte als
  -- mehrdeutig. Gemessen am 08.08. gegen die lokale Instanz.
  begin
    insert into public.activation_tokens (token_hash, profile_id, expires_at)
    values (p_token_hash, v_id, now() + p_ttl);
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint is distinct from 'activation_tokens_offen_je_profil' then
        raise;
      end if;
      -- Eine gleichzeitige Anfrage war schneller und hat soeben ein gueltiges
      -- Token fuer dieselbe Adresse angelegt. Das ist genau die Lage, die
      -- `pending` beschreibt — nichts versenden, nichts anlegen.
      return query select 'pending'::text, v_id, v_name, v_email;
      return;
  end;

  -- Der Zweck, erst jetzt und allein aus dem Kontostand abgeleitet. Ein
  -- aktiviertes Konto hat nichts zu aktivieren — was es anfordert, kann nur
  -- ein Passwort-Reset sein.
  if v_activated is not null then
    return query select 'issued_reset'::text, v_id, v_name, v_email;
    return;
  end if;

  return query select 'issued'::text, v_id, v_name, v_email;
end;
$$;

comment on function public.issue_activation_token(text, text, interval) is
  'Gibt ueber die LOGIN-Adresse ein Token aus (AGE-495 / AGE-505). Der ANONYME '
  'Weg — der Aktivierungsbildschirm nimmt request_own_activation_token. '
  'Entwertet einen noch gueltigen, unter 24 h alten Link NICHT, sondern '
  'antwortet "pending": sonst sperrt ein Fremder, der die Adresse kennt, das '
  'Mitglied aus. Der ZWECK wird aus profiles.activated_at abgeleitet und erst '
  'NACH allen Grenzen bestimmt — ein aktiviertes Konto bekommt "issued_reset" '
  '(Passwort vergessen), ein unaktiviertes "issued" (Aktivierung). '
  'Verliert der Aufruf einen GLEICHZEITIGEN Wettlauf um das eine offene Token '
  'je Profil, antwortet er ebenfalls "pending" statt zu werfen — sonst waere '
  'der Fehler ein Orakel fuer Mitgliedsadressen. Eine Verletzung des '
  'PRIMAERSCHLUESSELS wirft weiterhin: sie ist kein Wettlauf, sondern eine '
  'kaputte Token-Erzeugung. '
  'Status: unknown | rate_limited | pending | rate_limited_day | issued | '
  'issued_reset. "already_activated" gibt es hier seit AGE-505 NICHT mehr; '
  'request_own_activation_token hat ihn weiterhin. Gibt die HINTERLEGTE '
  'Login-Adresse zurueck. Nur service_role.';

revoke execute on function public.issue_activation_token(text, text, interval)
  from public, anon, authenticated;
grant execute on function public.issue_activation_token(text, text, interval)
  to service_role;
