-- AGE-927 — Eine Anmeldeadresse nachschlagen, für das Anlegen von Hand.
--
-- `admin-create-member` muss vor dem Anlegen wissen, ob es zu einer Adresse
-- schon ein Konto gibt — und WELCHES, denn die Zusage lautet „benennt das
-- bestehende Mitglied und führt zu ihm". Dazu muss die Function in `auth.users`
-- und `public.profiles` sehen.
--
-- ══ WARUM EINE FUNKTION UND NICHT DIE ADMIN-API ════════════════════════════
-- `auth.admin.listUsers()` blättert und filtert nicht; die Adresse zu finden
-- hiesse, den ganzen Bestand durchzugehen. Und `service_role` hält seit AGE-312
-- auf KEINER Tabelle in `public` ein SELECT — ein direktes `.from("profiles")`
-- liefe in „permission denied", wie es bei admin-change-email schon einmal tat.
--
-- ══ WARUM NICHT `is_admin()` IM RUMPF ══════════════════════════════════════
-- Der Aufrufer ist die Edge Function mit `service_role`, nicht der Admin
-- selbst; `is_admin()` läse `auth.uid()` und wäre dort null. Die
-- Admin-Eigenschaft ist bereits geprüft, bevor dieser Aufruf überhaupt
-- zustande kommt — über `is_admin_uid(actor)` gegen `staff_roles`, mit der
-- Kennung aus dem verifizierten Token.
--
-- Die Abwehr sitzt deshalb im GRANT: ausser `service_role` darf sie niemand
-- ausführen. Das ist wichtiger als es aussieht — eine offene Funktion wäre ein
-- Orakel für Mitgliedsadressen, also genau das, was `send-activation` mit ihrem
-- „erst antworten, dann senden" teuer verhindert.
--
-- ══ SCHREIBUNG ═════════════════════════════════════════════════════════════
-- Verglichen wird `lower(email)`. Der Unique-Index auf `auth.users(email)` ist
-- partiell UND schreibungsempfindlich (`users_email_partial_key`,
-- `btree (email) where is_sso_user = false`); der einzige Index über
-- `lower(email)` ist NICHT unique. Die Datenbank fängt also nur die exakte
-- Dublette. Gemessen am 29.09.: auf PROD tragen 0 von 78 Konten Grossbuchstaben,
-- die Lücke ist heute theoretisch — diese Funktion schliesst sie trotzdem, weil
-- sie nichts kostet und der Bestand nicht so bleiben muss.
--
-- Forward-only.

create or replace function public.admin_adresse_nachschlagen(p_email text)
returns table (
  profile_id   uuid,
  anzeigename  text,
  deaktiviert  boolean,
  geloescht    boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name,
         (p.disabled_at is not null),
         (p.deleted_at  is not null)
    from auth.users u
    join public.profiles p on p.id = u.id
   where lower(u.email) = lower(btrim(p_email))
   -- `order by` und nicht nur `limit 1`: der Unique-Index auf `auth.users(email)`
   -- ist schreibungsempfindlich, zwei Schreibungen derselben Adresse koennen
   -- also nebeneinander stehen — genau der Fall, den `lower()` hier abbilden
   -- soll. Ohne Ordnung entschiede der Plan, welche der Admin zu sehen bekommt.
   -- Gemessen am 29.09. auf PROD: 0 solche Paare. Die Ordnung kostet nichts und
   -- macht aus „kommt nicht vor" ein „ist entschieden". Diff-Review.
   order by u.created_at
   limit 1;
$$;

-- Erst entziehen, dann geben: `create function` gibt PUBLIC das
-- Ausführungsrecht mit, und `default privileges` wirken auf Funktionen nicht.
-- Alle Rollen nennen, dann genau eine zurückgeben: eine frisch angelegte
-- Instanz vergibt rollen-eigen (siehe 20260827070000).
revoke execute on function public.admin_adresse_nachschlagen(text)
  from public, anon, authenticated, service_role;
grant  execute on function public.admin_adresse_nachschlagen(text) to service_role;

comment on function public.admin_adresse_nachschlagen(text) is
  'Schlaegt zu einer Anmeldeadresse das Mitglied nach (AGE-927), fuer '
  'admin-create-member. Vergleicht ueber lower(email), weil der Unique-Index '
  'auf auth.users(email) partiell und schreibungsempfindlich ist. '
  'Prueft KEINE Rechte im Rumpf: der Aufrufer ist die Edge Function mit '
  'service_role, dort waere auth.uid() null — die Admin-Eigenschaft ist vorher '
  'ueber is_admin_uid() gegen staff_roles geprueft. Die Abwehr sitzt im GRANT: '
  'NUR service_role darf ausfuehren. Offen waere sie ein Orakel fuer '
  'Mitgliedsadressen, und genau das verhindert send-activation an anderer '
  'Stelle mit erheblichem Aufwand.';

-- ── Ein frisch angelegtes Konto einrichten ─────────────────────────────────
-- Dieselbe Lage wie oben: `service_role` haelt auf keiner Tabelle in `public`
-- ein SELECT oder UPDATE, und `admin_set_tier` / `admin_update_profile`
-- pruefen `is_admin()` gegen `auth.uid()` — dort null.
--
-- ══ WARUM DER HANDELNDE ALS ARGUMENT KOMMT ═════════════════════════════════
-- Die Funktion kann ihn nicht selbst ermitteln. Sie VERTRAUT dem Aufrufer, und
-- das ist vertretbar, weil nur `service_role` sie ausfuehren darf und die Edge
-- Function die Kennung unmittelbar davor aus einem verifizierten Token gezogen
-- und gegen `staff_roles` geprueft hat. Waere die Funktion breiter gewaehrt,
-- waere dieses Argument eine Luecke — deshalb steht der Grant so eng.
--
-- ══ WARUM SIE DIE SPUR SELBST SCHREIBT ═════════════════════════════════════
-- Das Anlegen eines Kontos SAMT bezahlter Stufe ist mindestens so folgenreich
-- wie ein Stufenwechsel, und fuer den besteht die Zusage laengst. Sie hier an
-- die Edge Function zu haengen hiesse, sie von einem zweiten Ort abhaengig zu
-- machen; in EINER Transaktion mit der Aenderung kann sie nicht fehlen.
create or replace function public.admin_mitglied_einrichten(
  p_actor   uuid,
  p_target  uuid,
  p_name    text,
  p_tier    text,
  p_firma   text default null,
  p_telefon text default null
) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- Nur die drei Clubstufen — dieselbe Zusage wie fuer „Stufe setzen"
  -- (AGE-903). Die Oberflaeche bietet nichts anderes an; hier steht sie, damit
  -- sie nicht nur in der Oberflaeche steht.
  if p_tier not in ('discover', 'focus', 'impact') then
    raise exception 'unerlaubte Stufe: %', p_tier using errcode = '22023';
  end if;

  update public.profiles
     set name    = p_name,
         tier    = p_tier,
         company = coalesce(p_firma, company)
   where id = p_target;

  if not found then
    raise exception 'unbekanntes Profil: %', p_target using errcode = 'P0002';
  end if;

  -- `profile_contacts` entsteht bei Bedarf und nicht per Trigger — deshalb
  -- upsert und nicht update.
  if p_telefon is not null then
    insert into public.profile_contacts (profile_id, phone)
    values (p_target, p_telefon)
    on conflict (profile_id) do update set phone = excluded.phone;
  end if;

  insert into public.admin_audit (actor, action, target, payload)
  values (p_actor, 'create_member', p_target,
          jsonb_build_object('name', p_name, 'tier', p_tier,
                             'firma', p_firma, 'telefon_gesetzt', p_telefon is not null));
end $$;

revoke execute on function public.admin_mitglied_einrichten(uuid, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_mitglied_einrichten(uuid, uuid, text, text, text, text)
  to service_role;

comment on function public.admin_mitglied_einrichten(uuid, uuid, text, text, text, text) is
  'Richtet ein frisch angelegtes Konto ein (AGE-927): Name, Stufe, optional '
  'Firma und Telefon — und schreibt die Spur nach admin_audit in DERSELBEN '
  'Transaktion, damit sie nicht fehlen kann. Laesst nur die drei Clubstufen zu. '
  'Prueft KEINE Rechte im Rumpf und vertraut p_actor: der Aufrufer ist die Edge '
  'Function mit service_role, die die Kennung unmittelbar davor aus einem '
  'verifizierten Token gezogen und gegen staff_roles geprueft hat. Die Abwehr '
  'sitzt im GRANT — NUR service_role darf ausfuehren.';
