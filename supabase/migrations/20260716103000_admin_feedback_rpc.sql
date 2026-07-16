-- Admin-Sicht auf das QM-Feedback (AGE-358) — Spec:
-- docs/superpowers/specs/2026-07-16-admin-feedback-sicht-design.md. Donald, 2026-07-16.
--
-- Baut auf AGE-300 auf (feedback-Spalten, is_admin(), feedback_admin_read).
--
-- ── Warum eine RPC und kein direkter Select mit Join ─────────────────────────
-- Die Sicht zeigt den AUTOR-Namen. Der kommt aus public.profiles, und dort gilt
-- eine eigene RLS: profiles_public filtert `where is_public`, die Tabellen-Policy
-- ist profiles_select_self_or_prime. Ein direkter Join feedback→profiles(name)
-- unter der Admin-Identität zeigte bei nicht-öffentlichen oder niedrigstufigen
-- Autoren einen LEEREN Namen — „Autor anzeigen" wäre unzuverlässig.
--
-- Diese SECURITY-DEFINER-Funktion joint mit Owner-Rechten (an der profiles-RLS
-- vorbei), gibt aber NUR Zeilen zurück, wenn public.is_admin() — der Filter im
-- WHERE macht sie für jeden Nicht-Admin leer (auch für matching_manager: QM ist
-- nicht die Deal-Queue). Das feedback_admin_read der Policy bleibt die Grenze für
-- direkte Tabellen-Reads; diese Funktion ist der eine kontrollierte Weg, der
-- zusätzlich den Autor-Namen auflöst. Muster wie list_routing_queue / is_admin.

create or replace function public.admin_list_feedback()
  returns table (
    id          uuid,
    rating      int,
    likes       text,
    misses      text,
    idea        text,
    route       text,
    ref_type    text,
    created_at  timestamptz,
    author_name text
  )
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select f.id, f.rating, f.likes, f.misses, f.idea, f.route, f.ref_type,
         f.created_at, coalesce(p.name, '—') as author_name
  from public.feedback f
  left join public.profiles p on p.id = f.profile_id
  where public.is_admin()
  order by f.created_at desc;
$$;
comment on function public.admin_list_feedback() is
  'Admin-Sicht auf public.feedback samt Autor-Name (AGE-358). SECURITY DEFINER, damit '
  'der Join hinter der profiles-RLS auch nicht-öffentliche Autoren auflöst; der '
  'WHERE public.is_admin()-Filter gibt Nicht-Admins (inkl. matching_manager) leer zurück.';

-- Wie is_admin() (AGE-312): Postgres' Default-EXECUTE für PUBLIC differiert je nach
-- Anlagedatum der Instanz. Explizit entziehen, nur authenticated (der die Rolle im
-- WHERE ohnehin selbst prüft) darf die RPC aufrufen.
revoke execute on function public.admin_list_feedback() from public, anon;
grant execute on function public.admin_list_feedback() to authenticated;
