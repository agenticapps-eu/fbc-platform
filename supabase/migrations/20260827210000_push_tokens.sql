-- ════════════════════════════════════════════════════════════════════════════
-- AGE-641 — `push_tokens`: ein Zustellweg gehoert genau einer Person
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/push-fundament/. Phase A, Schritt 2.
--
-- ══ WARUM DIE GRENZE HIER SCHAERFER IST ════════════════════════════════════
-- Bei den meisten Tabellen entscheidet RLS, wer etwas LIEST. Hier ist die
-- Zeile selbst der Zustellweg: wer ein fremdes Token liest, kann einem fremden
-- Menschen etwas aufs Telefon schicken. Die Sichtbarkeitsgrenze IST die
-- Zustellgrenze — deshalb owner-only fuer alle vier Verben, und deshalb ein
-- `with check`, das nicht nur das Lesen, sondern das UNTERSCHIEBEN verhindert:
-- ohne es koennte jemand einem anderen ein Geraet zuschreiben und dessen
-- Hinweise auf das eigene Telefon holen.
--
-- ══ KEIN `unique (profile_id)` ═════════════════════════════════════════════
-- Mehrere Geraete je Mitglied sind der Normalfall (Telefon und Tablet), nicht
-- die Ausnahme. Eindeutig ist das TOKEN, global: ein Geraet gehoert nicht zwei
-- Konten gleichzeitig.
--
-- ══ `is_activated()` UND NICHT `activated_at is not null` ══════════════════
-- Gemessen statt abgeschrieben: die Funktion wurde am 23.08.
-- (20260823120000:116) neu gefasst und deckt seither `activated_at`,
-- `disabled_at` UND `deleted_at` ab. Die Bedingung selbst hinzuschreiben haette
-- ein gesperrtes Konto durchgelassen — genau die Fehlerklasse, an der schon
-- `is_admin()` haengengeblieben ist.
--
-- ══ GRANTS AUSDRUECKLICH ═══════════════════════════════════════════════════
-- Seit AGE-312 erbt eine neue Tabelle NICHTS. Was hier nicht steht, gilt
-- nicht. `anon` bekommt kein einziges Recht: ein ausgeloggter Besucher hat mit
-- Zustellwegen nichts zu tun.
--
-- Donald, 27.08.2026.
-- ════════════════════════════════════════════════════════════════════════════

create table public.push_tokens (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  token           text not null unique,
  plattform       text not null check (plattform in ('ios', 'android')),
  letzter_kontakt timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

alter table public.push_tokens enable row level security;

-- FK-Spalte indiziert, wie im ganzen Baum ueblich: die Zustellung liest je
-- Empfaenger, nicht je Token.
create index push_tokens_profile_id_idx on public.push_tokens (profile_id);

comment on table public.push_tokens is
  'AGE-641: Geraetetoken fuer Push. Owner-only fuer alle vier Verben — eine '
  'Zeile hier IST ein Zustellweg zu einem Menschen. Mehrere Geraete je '
  'Mitglied sind der Normalfall; eindeutig ist das Token, nicht das Profil.';
comment on column public.push_tokens.letzter_kontakt is
  'AGE-641: wann sich das Geraet zuletzt gemeldet hat. Gepflegt von '
  'claim_push_token() bei jedem Start, nicht vom Client geschrieben.';

-- ── RLS: owner-only, alle vier Verben ───────────────────────────────────────
-- Eine `for all`-Policy wie `notifications_own`, damit `using` und
-- `with check` nicht auseinanderlaufen koennen.
create policy push_tokens_own on public.push_tokens
  for all to authenticated
  using      ( public.is_activated() and profile_id = (select auth.uid()) )
  with check ( public.is_activated() and profile_id = (select auth.uid()) );

-- ── Grants: ausgesprochen, nicht geerbt (AGE-312) ───────────────────────────
grant select, insert, update, delete on public.push_tokens to authenticated;
-- `anon` bewusst nicht genannt. Kein Recht heisst kein Recht.

-- ── claim_push_token: der Kontowechsel auf demselben Geraet ─────────────────
-- GEFUNDEN VON DER PLAN-REVIEW. Ein gewoehnlicher Insert aus der App genuegt
-- NICHT, und das faellt erst im Betrieb auf:
--
-- Token sind global eindeutig, und owner-only heisst, dass B die Zeile von A
-- weder sieht noch aendert. Schlaegt beim Abmelden das Aufraeumen fehl — kein
-- Netz, App abgestuerzt, Konto direkt gewechselt — und dasselbe Geraet meldet
-- sich als B an, dann prallt B's Insert an der Eindeutigkeit ab, und die Zeile
-- bleibt bei A. A's naechste Nachricht ginge dann auf ein Geraet, das B in der
-- Hand haelt.
--
-- Das ist kein Randfall. Ein Geraet und zwei Konten ist der Normalfall bei
-- Ehepaaren, bei Nachfolgern in einer Firma und bei Diensttelefonen.
--
-- ══ WARUM DAS SICHER IST ═══════════════════════════════════════════════════
-- Die Funktion schreibt das Token IMMER auf den Aufrufer (`auth.uid()`) und
-- niemals auf einen Dritten. Ein Aufrufer kann sich also nur SELBST ein Geraet
-- zuschreiben — und dafuer muss er dessen Token kennen, was Zugriff auf das
-- Geraet voraussetzt. Wer das Telefon in der Hand hat, bekommt dessen
-- Benachrichtigungen ohnehin.
--
-- Verworfen: `on conflict do nothing` und den Fall ignorieren. Das ist genau
-- der stille Zustand, in dem die Zustellung an die falsche Person geht.
create function public.claim_push_token(p_token text, p_plattform text)
  returns setof public.push_tokens
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not public.is_activated() then
    raise exception 'claim_push_token: nicht berechtigt' using errcode = '42501';
  end if;

  return query
    insert into public.push_tokens as pt (profile_id, token, plattform, letzter_kontakt)
    values (v_uid, p_token, p_plattform, now())
    on conflict (token) do update
      set profile_id      = v_uid,
          plattform       = excluded.plattform,
          letzter_kontakt = now()
    returning pt.*;
end $$;

comment on function public.claim_push_token(text, text) is
  'AGE-641: meldet das Geraet des Aufrufers an und uebernimmt ein Token, das '
  'noch bei einem anderen Konto haengt (fehlgeschlagenes Abmelden, geteiltes '
  'Geraet). Schreibt IMMER auf auth.uid() und nie auf einen Dritten. '
  'SECURITY DEFINER, weil owner-only RLS die fremde Zeile sonst unsichtbar '
  'macht und der Insert an der Eindeutigkeit des Tokens abprallte.';

revoke execute on function public.claim_push_token(text, text)
  from public, anon, service_role;
-- Die App ruft sie — im Gegensatz zu den Zustell-Innereien ist das hier
-- ausdruecklich eine Client-API.
grant execute on function public.claim_push_token(text, text) to authenticated;
