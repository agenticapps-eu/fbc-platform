-- Ein Admin setzt die Stufe eines Mitglieds — in beide Richtungen (AGE-634).
--
-- WARUM EINE EIGENE FUNKTION UND NICHT DIE WEISSLISTE VON admin_update_profile:
-- `tier` steht dort ausdruecklich DRAUSSEN (Zeile 151 jener Migration), und das
-- war richtig. Das Setzen einer Stufe ist kein Pflegen von Stammdaten: es
-- verschiebt Rechte, es hat eine Gegenpartei (Stripe), und es verlangt eine
-- Begruendung, die kein anderes Feld jener Funktion kennt. Ein Feld mehr auf der
-- Weissliste machte den Ausnahmefall zur Regel.
--
-- WARUM SIE AUCH SENKEN KANN: `apply_upgrade()` — bis heute der einzige
-- Schreibweg auf `profiles.tier` — hebt ausschliesslich an
-- (`if v_target_rank > v_current_rank`). Jede Gleich- oder Tieferstufung ist
-- dort ein No-op. Ein Mitglied, das der WordPress-Import irrtuemlich auf
-- `impact` gelegt hat, war damit ueberhaupt nicht korrigierbar, ausser von Hand
-- in der Datenbank.
--
-- Verworfen: die Begruendung optional zu lassen. Eine Spur ohne Grund
-- beantwortet „wer" und „wann" — nicht „warum", und das ist die Frage, die drei
-- Monate spaeter gestellt wird.
--
-- Keine neue Tabelle: `admin_audit` besteht seit AGE-498. Der Golden-Snapshot
-- der Grants bleibt damit unberuehrt (AGE-455).
--
-- Donald, 27.08.2026.

create or replace function public.admin_set_tier(
  p_profile_id uuid,
  p_tier       text,
  p_grund      text
) returns text
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_alt  text;
  v_rang int;
begin
  if not public.is_admin() then
    raise exception 'nur Admins' using errcode = '42501';
  end if;

  -- Vor dem Schreiben, nicht danach: ein Aufruf, der an der Begruendung
  -- scheitert, darf die Stufe nicht schon geaendert haben.
  if p_grund is null or btrim(p_grund) = '' then
    raise exception 'Begruendung fehlt' using errcode = '22023';
  end if;

  select level_rank into v_rang from public.membership_tiers where key = p_tier;
  if v_rang is null then
    raise exception 'unbekannte Stufe: %', p_tier using errcode = '22023';
  end if;

  -- `for update`: serialisiert gegen ein gleichzeitiges `apply_upgrade` fuer
  -- dasselbe Profil. Ohne die Sperre koennte die Spur eine alte Stufe nennen,
  -- die im Moment des Schreibens nicht mehr galt.
  select tier into v_alt from public.profiles where id = p_profile_id for update;
  if v_alt is null then
    raise exception 'Profil % existiert nicht', p_profile_id using errcode = 'P0002';
  end if;

  update public.profiles set tier = p_tier where id = p_profile_id;

  -- BEIDE Stufen in die Spur. Nur die neue zu speichern machte sie unlesbar,
  -- sobald zwei Aenderungen aufeinanderfolgen: man saehe die Kette der Ziele,
  -- aber nie, wovon aus.
  insert into public.admin_audit (actor, action, target, payload)
  values (
    (select auth.uid()),
    'set_tier',
    p_profile_id,
    jsonb_build_object('von', v_alt, 'nach', p_tier, 'grund', btrim(p_grund))
  );

  return p_tier;
end $$;

comment on function public.admin_set_tier(uuid, text, text) is
  'Setzt profiles.tier eines Mitglieds in BEIDE Richtungen, mit Pflichtbegruendung '
  'und einer admin_audit-Zeile, die alte und neue Stufe traegt (AGE-634). '
  'Prueft is_admin() im Rumpf, sonst 42501. Abgrenzung zu apply_upgrade: jene hebt '
  'nur an und gehoert dem Stripe-Webhook; diese korrigiert von Hand.';

-- Erbt nichts (AGE-312): Grants ausgesprochen.
revoke execute on function public.admin_set_tier(uuid, text, text) from public, anon;
grant  execute on function public.admin_set_tier(uuid, text, text) to authenticated;

-- Nachgezogen: der Kommentar behauptete, apply_upgrade sei der EINZIGE
-- Schreibweg auf den Tier. Seit dieser Migration ist er einer von zweien, und
-- ein Kommentar, der das Gegenteil sagt, ist schlimmer als keiner.
comment on function public.apply_upgrade(uuid, text) is
  'Hebt profiles.tier auf p_level, wenn dessen level_rank hoeher ist als der aktuelle '
  '(sonst No-op). Gibt den effektiven Tier zurueck. SECURITY DEFINER, service-role-only — '
  'der Schreibweg des stripe-webhook (AGE-259). Senken kann sie nicht; dafuer gibt es '
  'admin_set_tier (AGE-634).';
