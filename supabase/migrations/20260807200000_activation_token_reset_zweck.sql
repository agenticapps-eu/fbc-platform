-- Der Rueckweg fuer ein aktiviertes Konto (AGE-505) — Befund P3 aus Review 8.7
-- zu AGE-495, dort als Aufgabe 11.7 gefuehrt.
--
-- ── Der Befund ─────────────────────────────────────────────────────────────
-- Ein Mitglied, das sein Passwort vergisst, hatte keinen Weg zurueck.
-- `rg 'resetPasswordForEmail|forgot|reset-password' src` fand nichts. Fuer
-- NICHT aktivierte Konten war das gedeckt — /aktivierung fordert einen Link an,
-- und redeem-activation setzt dabei ein neues Passwort. Fuer AKTIVIERTE Konten
-- endete genau derselbe Aufruf hier mit `already_activated`: kein Token, keine
-- Mail — und die Oberflaeche meldete trotzdem Erfolg. Nach C10 (Import) ist
-- „aktiviert" der Normalfall, nicht die Ausnahme.
--
-- ── Warum das kein Neubau ist ──────────────────────────────────────────────
-- Das Einloesen existiert bereits vollstaendig: claim_activation_token
-- (20260806080200:128-134) fragt GAR NICHT, ob das Profil aktiviert ist, und
-- redeem-activation setzt Passwort, widerruft Sitzungen und stempelt idempotent.
-- Es war genau EIN Zweig, der den Rueckweg verschloss. Er wird geoeffnet, nicht
-- ersetzt.
--
-- ── Der eigentliche Eingriff: der Zweig wandert ans ENDE ───────────────────
-- Bisher stand `already_activated` VOR der 60-s-Sperre, dem Schutzfenster und
-- dem Tageskontingent. Bliebe er dort und gaebe nur ein Token aus, liefe der
-- Reset-Weg an allen drei Grenzen vorbei — und waere damit genau der
-- ungedrosselte Mail-Ausloeser, den der Aktivierungsweg vermeidet. Die drei
-- Grenzen gelten deshalb jetzt fuer beide Zwecke gleich, und der Zweck wird
-- erst danach bestimmt. `already_activated` entfaellt als Status dieser
-- Function; einziger Aufrufer ist send-activation.
-- request_own_activation_token (der ANGEMELDETE Weg) behaelt den Status und
-- bleibt unangetastet: wer angemeldet ist, hat kein vergessenes Passwort.
--
-- ── Warum keine Spalte `purpose` ───────────────────────────────────────────
-- VERWORFEN. Der Zweck ist aus profiles.activated_at ABLEITBAR — ist das Konto
-- aktiviert, kann es nur ein Reset sein. Eine gespeicherte Spalte waere ein
-- zweiter Ort fuer dieselbe Wahrheit und koennte von ihr abweichen. Der Status
-- traegt die Auskunft stattdessen genau so weit, wie sie gebraucht wird: bis
-- send-activation, das daran den Mailtext waehlt.
--
-- Ebenfalls verworfen: Supabases eingebauter resetPasswordForEmail
-- ([auth.email.smtp] ist nicht verdrahtet, das Stundenlimit laut AGE-496 nicht
-- erhoehbar, und es entstuende ein zweites Token-Verfahren neben dem
-- geprueften), sowie eine eigene Tabelle samt eigener Functions (dupliziert
-- Einmaligkeit unter Nebenlaeufigkeit, Hash-only-Speicherung, Drossel und
-- Aufzaehlungsschutz — und damit auch deren kuenftige Fehler).
--
-- ── Benannte Folge ────────────────────────────────────────────────────────
-- Wer eine Login-Adresse kennt, kann jetzt auch fuer aktivierte Konten Mails
-- ausloesen. Begrenzt durch 60 s + 5/Tag je Profil + Schutzfenster; Empfaenger
-- ist immer die hinterlegte Adresse. Aussperren kann er damit niemanden:
-- Passwort und Sitzungen fallen erst beim EINLOESEN, und dafuer braucht es die
-- Mail. Das Tageskontingent teilen sich Aktivierung und Reset — bewusst nicht
-- erhoeht, es schuetzt das Resend-Kontingent.
--
-- Vollstaendige Neudeklaration, weil Postgres keine partielle Aenderung kennt.
-- Gegen 20260806090000 sind AUSSCHLIESSLICH die Reihenfolge der Zweige und der
-- Rueckgabestatus geaendert; Grenzwerte, Entwertung, Einfuegung und die
-- zurueckgegebenen Spalten sind unveraendert uebernommen.

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

  -- HIER stand bis AGE-505 der `already_activated`-Zweig. Er ist ans Ende
  -- gewandert (siehe Kopf) — an dieser Stelle wuerde er die drei folgenden
  -- Grenzen ueberspringen.

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

  insert into public.activation_tokens (token_hash, profile_id, expires_at)
  values (p_token_hash, v_id, now() + p_ttl);

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
  'Status: unknown | rate_limited | pending | rate_limited_day | issued | '
  'issued_reset. "already_activated" gibt es hier seit AGE-505 NICHT mehr; '
  'request_own_activation_token hat ihn weiterhin. Gibt die HINTERLEGTE '
  'Login-Adresse zurueck. Nur service_role.';

revoke execute on function public.issue_activation_token(text, text, interval)
  from public, anon, authenticated;
grant execute on function public.issue_activation_token(text, text, interval)
  to service_role;
