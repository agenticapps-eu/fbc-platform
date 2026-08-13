-- Die Anschrift gehört in die Kontaktzeile (AGE-537, C6a).
-- Donald, 2026-08-13. Spec: openspec/changes/add-profile-address-fields/.
--
-- ══ WARUM AUF profile_contacts UND NICHT AUF profiles ══════════════════════
-- Entscheidung Donald, 13.08.: Die vollständige Anschrift der Bestandsmitglieder
-- wird aus WordPress übernommen (C10), und sie ist erst nach einer ANGENOMMENEN
-- Kontaktanfrage sichtbar — wie Telefonnummer und E-Mail.
--
-- Damit ist der Ort entschieden, nicht gewählt: `contacts_select_self_or_released`
-- (20260612082726, gehärtet in 20260806080100) gibt die Zeile nur an den
-- Eigentümer und an eine Gegenseite mit `accepted`-Anfrage frei, beide Zweige an
-- `is_activated()`. Auf `public.profiles` wäre die Anschrift dagegen für JEDES
-- eingeloggte Konto lesbar — das Verzeichnis ist ohnehin weiter offen als
-- gedacht (AGE-530).
--
-- VERWORFEN: eine eigene Tabelle `profile_addresses`. Eine dritte Zeile je
-- Profil, eine vierte Policy und ein zweiter Upsert im Admin-Weg — für Daten
-- mit exakt derselben Sichtbarkeit wie die, die schon hier liegen.
--
-- ══ WARUM KEIN GRANT DAZUKOMMT ═════════════════════════════════════════════
-- `profile_contacts` trägt einen TABELLEN-Grant (20260715140000:86), keine
-- Spaltenliste wie `profiles`. Neue Spalten sind für `authenticated` deshalb
-- ohne weiteres Zutun schreibbar, und die Policies `profile_contacts_insert_own`
-- / `_update_own` (20260806080100:382-392) decken die Zeile bereits ab.
--
-- Das ist eine ANGENOMMENE Eigenschaft, keine übersehene: jede künftige Spalte
-- hier ist ab ihrer Entstehung client-schreibbar. Tragbar, solange die Tabelle
-- bleibt, was ihr Name sagt — vom Mitglied gepflegte Kontaktdaten. Eine Spalte,
-- die das Mitglied NICHT selbst setzen darf (etwa ein Prüfvermerk zu einer
-- Adresse), gehört nicht hierher, oder sie erzwingt vorher ein `revoke` des
-- Tabellenrechts. Ein zusätzliches `grant update (…)` täte das NICHT: es
-- widerruft das Tabellenrecht nicht, sondern stellt eine engere Angabe daneben,
-- die nichts einschränkt und beim Lesen das Gegenteil suggeriert.
-- (Richtiggestellt im Fremd-Review zum Change, codex, LOW.)
--
-- ══ WARUM country KEINEN DEFAULT BEKOMMT ═══════════════════════════════════
-- „Vorgabe DE" ist eine Formularvorgabe, keine Schemaaussage. Der Editor
-- schickt beim Anlegen alle Felder mit, ein leeres also als ausdrückliches
-- NULL — und ein Spalten-Default wird davon nicht ausgelöst. Er zöge nur bei
-- Zeilen, die niemand so anlegt.
--
-- ══ WARUM region UNANGETASTET BLEIBT ═══════════════════════════════════════
-- `profiles.region` ist die REGIONALGRUPPE („FBC Standort"), nicht der Wohnort.
-- Sie steuert Filter und Zugehörigkeit im Verzeichnis. In WordPress sind das
-- zwei verschiedene Felder, und sie zusammenzuziehen hieße, den Filter mit
-- Wohnorten zu füllen.
--
-- Forward-only.

-- ── 1. Die fünf Spalten ─────────────────────────────────────────────────────
alter table public.profile_contacts
  add column street      text,
  add column postal_code text,
  add column city        text,
  add column state       text,
  add column country     text;

comment on column public.profile_contacts.street is
  'Strasse und Hausnummer, EIN Feld — in Ultimate Member ist es ebenfalls eines '
  '(AGE-537). Kein c/o und keine zweite Adresszeile: beim Import gaebe es '
  'nichts, was hineinginge.';
comment on column public.profile_contacts.postal_code is
  'Postleitzahl. In WordPress steht sie mit dem Ort in EINEM Feld („Plz & Ort"); '
  'das Auftrennen macht der Import (C10, AGE-534) und legt Ausreisser in den '
  'Bericht, statt sie zu raten.';
comment on column public.profile_contacts.city is
  'Wohn-/Geschaeftsort. NICHT mit profiles.region verwechseln — das ist die '
  'Regionalgruppe (FBC Standort) und steuert die Filter im Verzeichnis.';
comment on column public.profile_contacts.state is
  'Bundesland bzw. auslaendisches Aequivalent, aus dem UM-Feld „Bundesland".';
comment on column public.profile_contacts.country is
  'Landeskennung, in WordPress nicht erhoben. Vorgabe „DE" setzt das Formular '
  'bzw. der Import — bewusst kein Spalten-Default, siehe Kopf.';

-- ── 2. Der Tabellenkommentar stimmte nicht mehr ─────────────────────────────
-- Er versprach „owner-only" und eine erst KÜNFTIGE Freigabeaktion. Die gibt es
-- seit dem 14.06. (contact_requests → accepted), und sie umfasst ab hier die
-- Anschrift. Ein Kommentar, der die Sichtbarkeit einer Tabelle falsch angibt,
-- ist schlimmer als keiner: er wird beim Lesen für die Regel gehalten.
-- (Fremd-Review zum Change, codex, LOW.)
comment on table public.profile_contacts is
  'Kontaktdaten inklusive vollstaendiger Anschrift, getrennt von profiles, damit '
  'RLS sie schuetzt. Sichtbar fuer den Eigentuemer und — erst nach einer '
  'ANGENOMMENEN Kontaktanfrage — fuer die Gegenseite '
  '(contacts_select_self_or_released), beide Zweige am Aktivierungs-Gate. Nie '
  'implizit, nie ueber profiles_public. Traegt einen TABELLEN-Grant: jede neue '
  'Spalte hier ist ab ihrer Entstehung client-schreibbar (AGE-537).';

-- ── 3. Der Admin-Weg muss die Felder kennen ─────────────────────────────────
-- Ohne diese Erweiterung bräche der Admin-Weg genau dort ab, wo er gebraucht
-- wird: beim Nacharbeiten importierter Datensätze. Die Weißliste ist bewusst
-- fest verdrahtet — ein unbekannter Schlüssel bricht ab, statt still zu
-- verschwinden.
--
-- `admin_get_profile` bleibt unverändert: es gibt die Kontaktzeile als
-- `to_jsonb(c)` zurück und zählt keine Spalten auf.
create or replace function public.admin_update_profile(target uuid, patch jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  k text;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin_update_profile' using errcode = '42501';
  end if;

  if jsonb_typeof(patch) is distinct from 'object' then
    raise exception 'patch muss ein JSON-Objekt sein' using errcode = '22023';
  end if;
  if patch = '{}'::jsonb then
    raise exception 'patch ist leer' using errcode = '22023';
  end if;

  foreach k in array (select array(select jsonb_object_keys(patch))) loop
    if k not in (
      -- profiles (die client-schreibbare Menge + cover_url)
      'name', 'avatar_url', 'cover_url', 'region', 'company', 'short_bio',
      'branche', 'headline', 'roles', 'socials', 'website', 'competencies',
      'dev_focus', 'is_public', 'videos',
      -- profile_contacts (AGE-537: die fünf Adressfelder dazu)
      'email', 'phone',
      'street', 'postal_code', 'city', 'state', 'country',
      -- profile_legacy
      'paid_until', 'legacy_tier', 'legacy_price', 'legacy_source_id'
    ) then
      raise exception 'unbekanntes Feld im patch: %', k using errcode = '22023';
    end if;
  end loop;

  update public.profiles set
    name         = case when patch ? 'name'         then patch ->> 'name'         else name end,
    avatar_url   = case when patch ? 'avatar_url'   then patch ->> 'avatar_url'   else avatar_url end,
    cover_url    = case when patch ? 'cover_url'    then patch ->> 'cover_url'    else cover_url end,
    region       = case when patch ? 'region'       then patch ->> 'region'       else region end,
    company      = case when patch ? 'company'      then patch ->> 'company'      else company end,
    short_bio    = case when patch ? 'short_bio'    then patch ->> 'short_bio'    else short_bio end,
    branche      = case when patch ? 'branche'      then patch ->> 'branche'      else branche end,
    headline     = case when patch ? 'headline'     then patch ->> 'headline'     else headline end,
    website      = case when patch ? 'website'      then patch ->> 'website'      else website end,
    dev_focus    = case when patch ? 'dev_focus'    then patch ->> 'dev_focus'    else dev_focus end,
    goals        = case when patch ? 'goals'        then patch ->> 'goals'        else goals end,
    is_public    = case when patch ? 'is_public'    then (patch ->> 'is_public')::boolean else is_public end,
    socials      = case when patch ? 'socials'
                        then nullif(patch -> 'socials', 'null'::jsonb)
                        else socials end,
    roles        = case when patch ? 'roles'        then public.jsonb_text_array(patch -> 'roles')        else roles end,
    competencies = case when patch ? 'competencies' then public.jsonb_text_array(patch -> 'competencies') else competencies end,
    videos       = case when patch ? 'videos'       then public.jsonb_text_array(patch -> 'videos')       else videos end
  where id = target;

  if not found then
    raise exception 'Profil % existiert nicht', target using errcode = 'P0002';
  end if;

  -- Die Kontaktzeile. Sie ist NICHT die Login-Adresse (die steht in
  -- auth.users), aber sie ist die, an die notify-contact-request schickt —
  -- und seit AGE-537 trägt sie auch die Anschrift.
  if patch ?| array['email', 'phone', 'street', 'postal_code', 'city', 'state', 'country'] then
    insert into public.profile_contacts as pc
      (profile_id, email, phone, street, postal_code, city, state, country)
    values (
      target,
      patch ->> 'email',       patch ->> 'phone',
      patch ->> 'street',      patch ->> 'postal_code',
      patch ->> 'city',        patch ->> 'state',
      patch ->> 'country')
    on conflict (profile_id) do update set
      email       = case when patch ? 'email'       then excluded.email       else pc.email end,
      phone       = case when patch ? 'phone'       then excluded.phone       else pc.phone end,
      street      = case when patch ? 'street'      then excluded.street      else pc.street end,
      postal_code = case when patch ? 'postal_code' then excluded.postal_code else pc.postal_code end,
      city        = case when patch ? 'city'        then excluded.city        else pc.city end,
      state       = case when patch ? 'state'       then excluded.state       else pc.state end,
      country     = case when patch ? 'country'     then excluded.country     else pc.country end;
  end if;

  if patch ?| array['paid_until', 'legacy_tier', 'legacy_price', 'legacy_source_id'] then
    insert into public.profile_legacy as pl
      (profile_id, paid_until, legacy_tier, legacy_price, legacy_source_id)
    values (
      target,
      (patch ->> 'paid_until')::date,
      patch ->> 'legacy_tier',
      (patch ->> 'legacy_price')::numeric,
      patch ->> 'legacy_source_id')
    on conflict (profile_id) do update set
      paid_until       = case when patch ? 'paid_until'       then excluded.paid_until       else pl.paid_until end,
      legacy_tier      = case when patch ? 'legacy_tier'      then excluded.legacy_tier      else pl.legacy_tier end,
      legacy_price     = case when patch ? 'legacy_price'     then excluded.legacy_price     else pl.legacy_price end,
      legacy_source_id = case when patch ? 'legacy_source_id' then excluded.legacy_source_id else pl.legacy_source_id end;
  end if;

  insert into public.admin_audit (actor, action, target, payload)
  values ((select auth.uid()), 'update_profile', target, patch);
end $$;

comment on function public.admin_update_profile(uuid, jsonb) is
  'Aendert Stamm-, Kontakt- und Altdaten eines fremden Profils (AGE-498, '
  'Adressfelder AGE-537). SECURITY DEFINER, WEIL die spaltenweisen '
  'UPDATE-Grants auf profiles VOR der Policy greifen — eine Admin-Policy '
  'allein bliebe wirkungslos. EXECUTE liegt bei authenticated, damit die '
  'Abwehr IN der Funktion stattfindet und pruefbar ist. Weisliste ohne '
  'tier/potential_score/profile_completion/search_doc/member_number/'
  'activated_at.';
