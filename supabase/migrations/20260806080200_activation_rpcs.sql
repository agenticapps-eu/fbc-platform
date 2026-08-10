-- Mitglieder-Aktivierung, Teil C: die Operationen der Edge Functions (AGE-495).
-- Spec: openspec/changes/member-activation-flow/. Forward-only.
--
-- WARUM DAS IN DER DATENBANK STEHT UND NICHT IN TYPESCRIPT.
-- Zwei Befunde aus dem Fremd-Review verlangen Atomaritaet, die zwei
-- Round-Trips aus einer Edge Function nicht liefern koennen:
--
--   * Ausgabe: „erst zaehlen, dann einfuegen" laesst zwei gleichzeitige
--     Anforderungen beide passieren. Hier faellt beides in EINE Anweisung, und
--     der unique-Index aus Teil A ist die zweite Sicherung.
--   * Einloesung: „pruefen, ob used_at null ist" und danach „used_at setzen"
--     laesst zwei gleichzeitige Einloesungen desselben Tokens beide durch —
--     zwei verschiedene Passwoerter, und das Mitglied weiss nicht, welches
--     gilt. Hier beansprucht EIN `update ... where used_at is null ...
--     returning` das Token, oder es gibt nichts zurueck.
--
-- ALLE DREI FUNKTIONEN SIND NUR FUER service_role AUSFUEHRBAR. Sie umgehen das
-- Aktivierungs-Gate per Definition — das muessen sie, sie bauen es ja auf.
-- Deshalb liegt kein EXECUTE bei anon oder authenticated, und ein pgTAP-Test
-- haelt das fest.

-- ── 1. Token ausgeben ───────────────────────────────────────────────────────
-- Nimmt die E-Mail-Adresse entgegen, NICHT eine Profil-ID: `send-activation`
-- laeuft mit `verify_jwt = false` und darf keine Kennung aus einem
-- ungeprueften Token lesen (sonst waere sie ein Weg, sich den Link eines
-- fremden Kontos schicken zu lassen).
--
-- Antwortet mit einem Status statt einer Ausnahme, damit die Function in JEDEM
-- Fall gleich lange braucht und gleich antwortet — sonst verraet sie, welche
-- Adressen existieren.
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
  -- Skalare statt eines Record-Typs: plpgsql erlaubt keinen Record in einer
  -- mehrteiligen INTO-Liste (42601), und wir brauchen die Login-Adresse aus
  -- auth.users neben den Profilfeldern.
  v_id        uuid;
  v_name      text;
  v_activated timestamptz;
  v_email     text;
  v_letzte    timestamptz;
  v_tag_zahl  int;
begin
  -- Die LOGIN-Adresse, nicht profile_contacts.email: nur das Postfach, mit dem
  -- man sich anmeldet, taugt als Identitaetsnachweis.
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

  if v_tag_zahl >= 5 then
    return query select 'rate_limited_day'::text, v_id, v_name, v_email;
    return;
  end if;

  -- Den ausstehenden Link entwerten — als `invalidated_at`, NICHT als
  -- `used_at`: wer zweimal anfordert und den ersten Link klickt, soll
  -- „nicht mehr gueltig" lesen und nicht „bereits aktiviert".
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
  'Gibt ein Aktivierungs-Token aus (AGE-495). Nimmt die LOGIN-Adresse, entwertet '
  'den ausstehenden Link und legt den neuen an — alles in einer Transaktion. '
  'Antwortet mit Status (unknown | already_activated | rate_limited | '
  'rate_limited_day | issued) statt zu werfen, damit der Aufrufer nicht '
  'unterscheiden kann, welche Adressen existieren. Gibt die HINTERLEGTE '
  'Login-Adresse zurueck — der Versand geht nie an eine im Aufruf mitgegebene, '
  'sonst waere die Function ein Weg, sich fremde Links schicken zu lassen. '
  'Nur service_role.';

revoke execute on function public.issue_activation_token(text, text, interval)
  from public, anon, authenticated;
grant execute on function public.issue_activation_token(text, text, interval)
  to service_role;

-- ── 2. Token beanspruchen ───────────────────────────────────────────────────
-- Pruefen und Verbrauchen fallen in EINE Anweisung. Der Grund steht im Kopf.
create or replace function public.claim_activation_token(p_token_hash text)
returns table (status text, profile_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
  v_zeile   public.activation_tokens;
begin
  update public.activation_tokens t
     set used_at = now()
   where t.token_hash = p_token_hash
     and t.used_at is null
     and t.invalidated_at is null
     and t.expires_at > now()
  returning t.profile_id into v_profile;

  if v_profile is not null then
    return query select 'claimed'::text, v_profile;
    return;
  end if;

  -- Kein Treffer: den Grund bestimmen, damit die Oberflaeche die vier Faelle
  -- aus AGE-495 §6 auseinanderhalten kann. Die Unterscheidung erfolgt NACH dem
  -- Beanspruchungsversuch — beide Wege kosten damit denselben Lookup.
  select * into v_zeile from public.activation_tokens t where t.token_hash = p_token_hash;

  if not found then
    return query select 'not_found'::text, null::uuid;
  elsif v_zeile.used_at is not null then
    return query select 'used'::text, v_zeile.profile_id;
  elsif v_zeile.invalidated_at is not null then
    return query select 'superseded'::text, v_zeile.profile_id;
  else
    return query select 'expired'::text, v_zeile.profile_id;
  end if;
end;
$$;

comment on function public.claim_activation_token(text) is
  'Beansprucht ein Aktivierungs-Token in EINER Anweisung (AGE-495). Zwei '
  'gleichzeitige Einloesungen desselben Tokens koennen damit nicht beide '
  'durchkommen. Status: claimed | not_found | used | superseded | expired. '
  '`superseded` ist bewusst von `used` getrennt — ein durch einen neueren Link '
  'entwertetes Token bedeutet NICHT, dass das Konto aktiviert ist. '
  'Nur service_role.';

revoke execute on function public.claim_activation_token(text)
  from public, anon, authenticated;
grant execute on function public.claim_activation_token(text) to service_role;

-- ── 3. Aktivierung stempeln ─────────────────────────────────────────────────
-- Bewusst der LETZTE Schritt der Einloesung: er oeffnet das Gate. Alles, was
-- schiefgehen kann — Passwort setzen, Sitzungen beenden —, geht schief,
-- solange das Gate noch geschlossen ist.
create or replace function public.mark_activated(p_profile_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_zeit timestamptz;
begin
  update public.profiles
     set activated_at = coalesce(activated_at, now())
   where id = p_profile_id
  returning activated_at into v_zeit;
  return v_zeit;
end;
$$;

comment on function public.mark_activated(uuid) is
  'Setzt profiles.activated_at (AGE-495). Idempotent: ein zweiter Aufruf '
  'ueberschreibt den Zeitpunkt nicht. Der LETZTE Schritt der Einloesung — er '
  'oeffnet das Gate, deshalb steht er hinter Passwort und Sitzungswiderruf. '
  'Nur service_role; kein Client darf sich selbst aktivieren.';

revoke execute on function public.mark_activated(uuid) from public, anon, authenticated;
grant execute on function public.mark_activated(uuid) to service_role;

-- ── 4. Sitzungen widerrufen ─────────────────────────────────────────────────
-- WARUM NICHT ueber die Admin-API: `auth.admin.signOut` erwartet ein
-- Access-JWT, keine Nutzer-ID (Signatur geprueft am 2026-08-06:
-- `signOut(jwt: string, scope?)`). Beim Einloesen liegt uns aber keine Sitzung
-- des Mitglieds vor — wir haben nur seine ID. Ein Aufruf mit der ID haette zur
-- Laufzeit 401 geliefert und damit JEDE Aktivierung fehlschlagen lassen, ohne
-- dass ein Typecheck etwas gemerkt haette. Ein Fremd-Review hat darauf
-- hingewiesen; die Signatur ist danach am Code nachgemessen worden.
--
-- WAS DIESE FUNKTION NICHT KANN: Ein bereits ausgegebener Access-Token ist
-- zustandslos und bleibt bis zu seinem Ablauf gueltig (`jwt_expiry`, derzeit
-- 3600 s). Das Loeschen der Sitzung nimmt dem Angreifer die Erneuerung, nicht
-- das laufende Token. Die verbleibende Luecke ist damit beschraenkt und
-- benannt; sie zu schliessen hiesse, `jwt_expiry` zu senken oder in jeder
-- Policy gegen auth.sessions zu joinen (auf jeder Abfrage).
create or replace function public.revoke_sessions(p_profile_id uuid)
returns int
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_zahl int;
begin
  delete from auth.refresh_tokens where user_id = p_profile_id::text;
  delete from auth.sessions where user_id = p_profile_id;
  get diagnostics v_zahl = row_count;
  return v_zahl;
end;
$$;

comment on function public.revoke_sessions(uuid) is
  'Beendet alle Sitzungen eines Kontos (AGE-495). Ersetzt auth.admin.signOut, '
  'das ein Access-JWT erwartet und beim Einloesen deshalb nicht anwendbar ist. '
  'Nimmt dem Angreifer die Erneuerung; ein laufender Access-Token bleibt bis '
  'jwt_expiry gueltig — benannte Restflaeche. Nur service_role.';

revoke execute on function public.revoke_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_sessions(uuid) to service_role;
