-- Mitglieder-Aktivierung, Teil D: die zwei Wege trennen (AGE-495).
-- Spec: openspec/changes/member-activation-flow/. Forward-only.
--
-- WARUM. Der Sicherheits-Audit vom 2026-08-06 fand an `send-activation` eine
-- Aussperrung: die Function ist unauthentifiziert, und jede Ausgabe entwertet
-- den ausstehenden Link. Wer die Login-Adresse eines Mitglieds kennt, fordert
-- in dessen Namen an, der Link im Postfach des Opfers gilt nicht mehr, und nach
-- fuenf Aufrufen ist die Tagesquote fuer den Tag verbraucht. Taeglich
-- wiederholbar, gegen alle Konten gleichzeitig.
--
-- VERWORFENE ALTERNATIVEN.
--   * „Den gueltigen Link nicht entwerten." Geht nicht: der Unique-Index
--     `activation_tokens_offen_je_profil` (Teil A) erzwingt HOECHSTENS EIN
--     ausstehendes Token je Profil, und das ist die Serialisierung gegen zwei
--     gleichzeitige Anforderungen. Zwei gueltige Links waeren ein Rueckschritt.
--     Den alten erneut zu versenden geht ebenfalls nicht — gespeichert ist nur
--     der Hash.
--   * „IP-Drossel." Entscheidet die offene Frage 12.6 zugunsten von
--     „Subjekt = IP" und sperrt hinter NAT das echte Mitglied mit aus.
--   * „Turnstile." Neue Abhaengigkeit plus Widget im Hauptweg — Reibung genau
--     in dem Moment, in dem ~70 Mitglieder gleichzeitig aktivieren sollen.
--
-- WAS STATTDESSEN. Die beiden Wege haben verschiedene Voraussetzungen, also
-- bekommen sie verschiedene Tueren:
--
--   Hauptweg (Aktivierungsbildschirm, nach der Rundmail): das Mitglied IST
--   angemeldet. Subjekt ist damit die Sitzung, nicht eine geratene Adresse —
--   fremd anfordern ist unmoeglich, ohne jede zusaetzliche Reibung. Das ist
--   `request_own_activation_token` hier unten, aufgerufen ueber die neue
--   Function `resend-activation` mit `verify_jwt = true`.
--
--   Wiederherstellungsweg (`/aktivierung`, ohne Sitzung): bleibt bei
--   `send-activation`. Er ist selten — er greift, wenn jemand mit dem
--   verteilten Passwort das Konto uebernommen hat — und wird deshalb hart
--   gedrosselt: ein noch gueltiger, ausstehender Link wird NICHT mehr
--   entwertet. Wer diesen Weg geht, hat sein Postfach; dort liegt der Link.
--
-- Die Notiz „Ein Zweig, nicht zwei" in `send-activation/index.ts` galt fuer
-- EINE Function, die beides traegt. Zwei Functions mit je einem Zweig sind
-- nicht der Fall, vor dem sie warnte.

-- ── 1. Der eigene Link, ueber die Sitzung ───────────────────────────────────
-- Nimmt KEINE Adresse entgegen. Das Subjekt ist `auth.uid()`, und damit kann
-- ein Aufrufer per Konstruktion nur sich selbst einen Link ausloesen. Genau
-- deshalb darf diese Funktion — anders als `issue_activation_token` — von
-- `authenticated` aufgerufen werden.
--
-- `security definer`, weil Teil B auch die eigene Profilzeile fuer ein nicht
-- aktiviertes Konto sperrt. Sie gibt nur zurueck, was der Aufrufer ohnehin
-- kennt: seinen Anzeigenamen und seine eigene Login-Adresse. Die Adresse
-- verlaesst den Server nicht — sie geht an Resend, nicht an den Browser.
create or replace function public.request_own_activation_token(
  p_token_hash text,
  p_ttl        interval default interval '72 hours'
) returns table (status text, display_name text, login_email text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id        uuid := (select auth.uid());
  v_name      text;
  v_activated timestamptz;
  v_email     text;
  v_letzte    timestamptz;
  v_tag_zahl  int;
begin
  if v_id is null then
    return query select 'unknown'::text, null::text, null::text;
    return;
  end if;

  select p.name, p.activated_at, u.email
    into v_name, v_activated, v_email
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = v_id;

  if not found then
    return query select 'unknown'::text, null::text, null::text;
    return;
  end if;

  if v_activated is not null then
    return query select 'already_activated'::text, v_name, v_email;
    return;
  end if;

  select max(created_at), count(*) filter (where created_at > now() - interval '24 hours')
    into v_letzte, v_tag_zahl
    from public.activation_tokens t
   where t.profile_id = v_id;

  -- Dieselben Grenzen wie im anonymen Weg. Sie schuetzen hier nicht mehr vor
  -- Aussperrung — das kann ueber die Sitzung niemand mehr ausloesen —, sondern
  -- das Resend-Kontingent.
  if v_letzte is not null and v_letzte > now() - interval '60 seconds' then
    return query select 'rate_limited'::text, v_name, v_email;
    return;
  end if;

  if v_tag_zahl >= 5 then
    return query select 'rate_limited_day'::text, v_name, v_email;
    return;
  end if;

  update public.activation_tokens
     set invalidated_at = now()
   where activation_tokens.profile_id = v_id
     and used_at is null and invalidated_at is null;

  insert into public.activation_tokens (token_hash, profile_id, expires_at)
  values (p_token_hash, v_id, now() + p_ttl);

  return query select 'issued'::text, v_name, v_email;
end;
$$;

comment on function public.request_own_activation_token(text, interval) is
  'Gibt dem AUFRUFER einen Aktivierungslink aus (AGE-495, Teil D). Subjekt ist '
  'auth.uid(), nicht eine mitgegebene Adresse — fremd anfordern ist damit '
  'unmoeglich. Der Weg des Aktivierungsbildschirms ueber die Function '
  'resend-activation (verify_jwt = true). Status: unknown | already_activated | '
  'rate_limited | rate_limited_day | issued.';

revoke execute on function public.request_own_activation_token(text, interval)
  from public, anon;
grant execute on function public.request_own_activation_token(text, interval)
  to authenticated;

-- ── 2. Der anonyme Weg entwertet keinen gueltigen Link mehr ─────────────────
-- Einzige Aenderung an `issue_activation_token`: das Schutzfenster. Signatur
-- und Grants bleiben, wie sie sind.
--
-- Warum 24 Stunden und nicht die volle Laufzeit (72 h): ein Mitglied, dessen
-- Mail wirklich nicht ankam und das den Hauptweg nicht erreicht, soll nicht
-- drei Tage warten. Ein Angreifer kann damit hoechstens einmal am Tag einen
-- Link entwerten statt fuenfmal — und ein gueltiger liegt danach sofort wieder
-- im Postfach.
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

  if v_activated is not null then
    return query select 'already_activated'::text, v_id, v_name, v_email;
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
  -- sperrt mich aus".
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

  insert into public.activation_tokens (token_hash, profile_id, expires_at)
  values (p_token_hash, v_id, now() + p_ttl);

  return query select 'issued'::text, v_id, v_name, v_email;
end;
$$;

comment on function public.issue_activation_token(text, text, interval) is
  'Gibt ein Aktivierungs-Token ueber die LOGIN-Adresse aus (AGE-495). Der '
  'ANONYME Weg — nur noch fuer /aktivierung ohne Sitzung; der '
  'Aktivierungsbildschirm nimmt seit Teil D request_own_activation_token. '
  'Entwertet einen noch gueltigen, unter 24 h alten Link NICHT mehr, sondern '
  'antwortet "pending": sonst sperrt ein Fremder, der die Adresse kennt, das '
  'Mitglied aus. Status: unknown | already_activated | rate_limited | pending | '
  'rate_limited_day | issued. Gibt die HINTERLEGTE Login-Adresse zurueck. '
  'Nur service_role.';
