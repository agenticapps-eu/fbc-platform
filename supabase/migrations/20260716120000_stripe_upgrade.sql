-- Stripe Test-Mode Upgrade-Flow (AGE-259). Forward-only.
-- Spec: docs/superpowers/specs/2026-07-16-stripe-upgrade-flow-design.md §3.3/§3.4
--
-- apply_upgrade ist der EINZIGE Weg, auf dem ein Tier steigt: der stripe-webhook
-- ruft ihn per Service-Role nach `checkout.session.completed`. Die Regel (nur höher)
-- lebt hier, nicht im Webhook — so ist sie in pgTAP prüfbar und der Webhook bleibt
-- ein dünner Adapter. „Nur höher" macht den Aufruf idempotent (Stripe-Retries) UND
-- immun gegen ein verspätetes/wiederholtes tieferes Event (kein stiller Downgrade).
create or replace function public.apply_upgrade(p_user_id uuid, p_level text)
  returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_target_rank  int;
  v_current_rank int;
begin
  select level_rank into v_target_rank
    from public.membership_tiers where key = p_level;
  if v_target_rank is null then
    raise exception 'unknown level: %', p_level using errcode = '22023';
  end if;

  select mt.level_rank into v_current_rank
    from public.profiles p
    join public.membership_tiers mt on mt.key = p.tier
   where p.id = p_user_id;
  if v_current_rank is null then
    raise exception 'unknown user or tier: %', p_user_id using errcode = 'P0002';
  end if;

  if v_target_rank > v_current_rank then
    update public.profiles set tier = p_level where id = p_user_id;
    return p_level;
  end if;

  -- Gleichstand oder tiefer: nie downgraden.
  return (select tier from public.profiles where id = p_user_id);
end;
$$;

comment on function public.apply_upgrade(uuid, text) is
  'Hebt profiles.tier auf p_level, wenn dessen level_rank höher ist als der aktuelle '
  '(sonst No-op). Gibt den effektiven Tier zurück. SECURITY DEFINER, service-role-only — '
  'der einzige Schreibweg für den Tier, aufgerufen vom stripe-webhook (AGE-259).';

-- Erbt nichts (AGE-312): Grants explizit. Nur die Service-Role (Webhook) darf aufrufen.
revoke execute on function public.apply_upgrade(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_upgrade(uuid, text) to service_role;
