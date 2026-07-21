-- Verhaltenssonde für das Profil-Speichern (AGE-436). Führt als Mitglied genau
-- den UPDATE aus, den der Client in src/lib/profile.ts:205-223 absetzt — mit
-- allen Spalten, einschließlich `videos`.
--
-- Warum diese Sonde zusätzlich zu grants_test.sql: Der Grant-Test vergleicht die
-- Spaltenliste gegen eine im Test hinterlegte Erwartung. Beide gemeinsam zu
-- pflegen ist genau das, was bei AGE-436 nicht passiert ist — `videos` kam am
-- 15.06. dazu (AGE-252), das Grant wurde am 15.07. ohne diese Spalte
-- ausgesprochen (AGE-312), und der Grant-Test war grün, weil er die kaputte
-- Liste gegen sich selbst prüfte. Diese Sonde prüft stattdessen die WIRKUNG:
-- kann ein Mitglied sein Profil speichern? Sie fällt auch dann, wenn die nächste
-- Spalte vergessen wird, ohne dass jemand an sie denkt.
--
-- Läuft in einer Transaktion und rollt zurück; hinterlässt keine Daten.
--
-- Rollen-Impersonation wie in probe_member_settings_rls.sql. Der Helfer gibt
-- allerdings die ECHTE Fehlermeldung zurück statt nur 'DENIED': ein fehlendes
-- Grant („permission denied for table profiles") und eine greifende Policy
-- („new row violates row-level security policy") sind verschiedene Defekte, und
-- die Sonde soll sagen, welcher von beiden vorliegt (Lehre aus rls_test.sql).

begin;

insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000436aa', 'authenticated', 'authenticated', 't436a@probe.fbc.invalid');

-- ── Impersonation: liefert 'OK' oder die originale Fehlermeldung ─────────────
create function pg_temp.run_as(uid uuid, q text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'OK';
end $$;

do $$
declare
  v_a uuid := '00000000-0000-0000-0000-0000000436aa';
  v text;
  n int;
begin
  -- Der vollständige Client-Write. Spaltenliste und Reihenfolge bewusst 1:1 wie
  -- in profile.ts — wer dort eine Spalte ergänzt, muss sie hier ergänzen und
  -- merkt dabei, dass sie auch ein Grant braucht.
  v := pg_temp.run_as(v_a, $q$
    update public.profiles set
      name         = 'Sonde 436',
      region       = 'Stuttgart',
      company      = 'Sonde GmbH',
      short_bio    = 'Kurzbeschreibung',
      branche      = 'Technologie',
      headline     = 'Unternehmer',
      roles        = array['Gründer'],
      competencies = array['Vertrieb'],
      website      = 'https://example.org',
      dev_focus    = 'tun',
      socials      = '{"linkedin": "https://linkedin.com/in/sonde"}'::jsonb,
      videos       = array['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
      avatar_url   = 'https://example.org/a.webp'
    where id = '00000000-0000-0000-0000-0000000436aa'
  $q$);
  if v <> 'OK' then
    raise exception 'Profil-Speichern als eigenes Mitglied muss gelingen, war: %', v;
  end if;

  -- Und es ist auch wirklich angekommen (nicht nur fehlerfrei durchgelaufen:
  -- ein UPDATE, das die RLS-Zeile nicht trifft, meldet ebenfalls keinen Fehler).
  select count(*)::int into n
  from public.profiles
  where id = v_a and name = 'Sonde 436'
    and videos = array['https://www.youtube.com/watch?v=dQw4w9WgXcQ'];
  if n <> 1 then
    raise exception 'UPDATE lief fehlerfrei, aber die Zeile trägt die Werte nicht (n=%)', n;
  end if;

  -- Gegenprobe: ein FREMDES Profil bleibt unschreibbar. Sonst hätte ein zu weit
  -- gefasstes Grant dieselbe Sonde grün gemacht wie der korrekte Fix.
  v := pg_temp.run_as(v_a, $q$
    update public.profiles set name = 'übernommen'
    where id <> '00000000-0000-0000-0000-0000000436aa'
  $q$);
  select count(*)::int into n from public.profiles where name = 'übernommen';
  if n <> 0 then
    raise exception 'fremdes Profil war schreibbar (% Zeile(n) geändert)', n;
  end if;

  raise notice 'AGE-436: Profil-Speichern inkl. videos OK, fremde Profile unverändert';
end $$;

rollback;
