-- Mitglieder-Aktivierung, Teil A: Schema und Helfer (AGE-495 / C3).
-- Spec: openspec/changes/member-activation-flow/. Forward-only.
--
-- Teil A legt an, Teil B (20260806080100) webt das Gate in die Policies. Der
-- Schnitt ist Absicht: B ist ein Diff ueber 46 Policies, eine View und sieben
-- Funktionen. Zusammen mit dem Schema in einer Datei waere der Sicherheitsteil
-- im Rauschen nicht mehr lesbar — und genau der braucht das Review.
--
-- ── Wozu das Ganze ──────────────────────────────────────────────────────────
-- Zum Go-Live geht eine Rundmail an alle in BCC mit EINEM Default-Passwort. Wer
-- die weitergeleitete Mail hat, hat heute einen Login fuer ~70 fremde Konten.
-- Die Absicherung ist, dass das Passwort allein wertlos bleibt: Die Session
-- darf nichts sehen, bis der Bestaetigungslink aus dem EIGENEN Postfach
-- geklickt wurde.
--
-- ── VORBEDINGUNG: diese Migration UND Teil B laufen VOR dem Import (C10) ─────
-- Der Backfill unten stempelt alle vorhandenen Profile als aktiviert, damit
-- niemand ausgesperrt wird. Liefe der Import zuerst, stempelte er genau die
-- Konten, um die es geht — und KEIN TEST WUERDE DAVON ROT. Ein Datums-Guard
-- (`created_at < now()`) hilft dagegen nicht: importierte Profile erfuellen ihn
-- ebenfalls, und ein Import darf `created_at` auf den historischen Beitritt
-- zurueckdatieren. Deshalb steht unten ein Stolperdraht statt einer Sicherung.

-- ── 1. profiles.activated_at ────────────────────────────────────────────────
alter table public.profiles add column activated_at timestamptz;

comment on column public.profiles.activated_at is
  'Zeitpunkt der Zugangsbestaetigung. NULL = nicht aktiviert; einzige Wahrheit '
  'fuer das Aktivierungs-Gate (AGE-495). Wird ausschliesslich serverseitig von '
  'der Edge Function redeem-activation gesetzt.';

-- KEIN Spalten-Grant. `20260611171003:80` zaehlt die Spalten auf, die
-- `authenticated` schreiben darf; `activated_at` gehoert bewusst NICHT dazu und
-- wird dort auch nicht ergaenzt. Wer sich selbst aktivieren koennte, braeuchte
-- den Bestaetigungslink nicht. Belegt in rls_test.sql ueber has_column_privilege.

-- ── 2. activation_tokens ────────────────────────────────────────────────────
create table public.activation_tokens (
  token_hash text        primary key,
  profile_id uuid        not null references public.profiles (id) on delete cascade,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  -- Getrennt von used_at, weil die beiden dem Mitglied VERSCHIEDENE Dinge sagen
  -- muessen: `used_at` = der Link wurde eingeloest, das Konto ist aktiviert.
  -- `invalidated_at` = ein neuerer Link wurde angefordert, dieser gilt nicht
  -- mehr. Mit nur EINER Spalte bekaeme wer zweimal anfordert und den ersten
  -- Link klickt die Meldung „dein Konto ist bereits aktiviert" — und das waere
  -- schlicht falsch.
  invalidated_at timestamptz,
  created_at     timestamptz not null default now()
);

comment on table public.activation_tokens is
  'Einmal-Token fuer die Zugangsbestaetigung (AGE-495). Enthaelt NUR den '
  'SHA-256-Hash, nie das Klartext-Token — dieses verlaesst das System '
  'ausschliesslich im Link der Aktivierungsmail. '
  'RLS ist an und es gibt ABSICHTLICH keine Policy und keinen Grant: die '
  'Tabelle ist fuer anon/authenticated unerreichbar, gelesen und geschrieben '
  'wird sie allein mit der Service-Rolle aus den Edge Functions. Wer hier eine '
  '"fehlende" Policy nachreicht, oeffnet den Kern des Changes.';

-- Hoechstens EIN ausstehendes Token je Profil — von der Datenbank erzwungen,
-- nicht von einer vorangehenden Abfrage. Ein `insert ... where not exists`
-- serialisiert zwei gleichzeitige Anforderungen nicht; dieser Index schon.
create unique index activation_tokens_offen_je_profil
  on public.activation_tokens (profile_id)
  where used_at is null and invalidated_at is null;

create index activation_tokens_profil_zeit
  on public.activation_tokens (profile_id, created_at desc);

alter table public.activation_tokens enable row level security;

-- ── 3. is_activated() ───────────────────────────────────────────────────────
-- Muster von has_level() (20260715150000): stable, definer, search_path gepinnt,
-- coalesce auf false. Das coalesce ist nicht dekorativ — ohne Session liefert
-- die Unterabfrage NULL, und NULL ist in einem `not`-Kontext nicht false.
create or replace function public.is_activated() returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(
    (select p.activated_at is not null
       from public.profiles p
      where p.id = (select auth.uid())),
    false
  );
$$;

comment on function public.is_activated() is
  'True, wenn der Aufrufer seinen Zugang bestaetigt hat (profiles.activated_at). '
  'Das Aktivierungs-Gate aus AGE-495. Gibt ohne Session false zurueck, nicht NULL.';

revoke execute on function public.is_activated() from public, anon;
grant  execute on function public.is_activated() to authenticated;

-- ── 4. my_activation_state() ────────────────────────────────────────────────
-- Die EINZIGE Flaeche, die das Gate offen laesst — und zugleich seine
-- Voraussetzung. Nach Teil B ist auch die eigene Profilzeile gesperrt (der
-- Angreifer meldet sich ALS das Mitglied an, "eigene Daten" sind dessen Daten);
-- ohne diese Funktion koennte der Aktivierungsbildschirm sich selbst nicht
-- anzeigen, weil AuthProvider die Zeile nicht mehr laedt.
--
-- Sie gibt genau zwei Felder zurueck. Jedes weitere waere ein Feld, das jemand
-- mit dem verteilten Passwort abholt. Der Anzeigename steht ohnehin in der
-- Anrede der Rundmail.
create or replace function public.my_activation_state()
  returns table (activated boolean, display_name text)
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select p.activated_at is not null, p.name
    from public.profiles p
   where p.id = (select auth.uid());
$$;

comment on function public.my_activation_state() is
  'Traegt den Aktivierungsbildschirm: gibt fuer den Aufrufer NUR zurueck, ob er '
  'aktiviert ist, und seinen Anzeigenamen fuer die Anrede. Bewusst die kleinste '
  'Flaeche, die den Bildschirm rendern laesst (AGE-495). Nichts hinzufuegen.';

revoke execute on function public.my_activation_state() from public, anon;
grant  execute on function public.my_activation_state() to authenticated;

-- ── 5. Stolperdraht: laeuft der Import schon? ───────────────────────────────
-- Gemessen am 2026-08-06:
--   PROD (viwntbodrtqxgmqyxluh):  2 Profile, davon 0 impact  (Detlev, Donald)
--   DEV  (foelowldexkcqzewvrcf): 37 Profile, davon 9 impact  (Demo-Personas)
-- Der Import legt ~70 Profile auf Stufe `impact` an. Beide Grenzen liegen also
-- ueber dem heutigen Stand beider Projekte und unter dem Stand nach einem
-- Import. Zwei Bedingungen, weil sie verschiedene Unfallformen fangen: ein
-- Import von 70 `impact`-Konten und ein Import, der sie anders einstuft.
--
-- Lieber laute Migration als stille Fehlstufe (Muster aus 20260715150000:61).
do $$
declare
  v_gesamt int;
  v_impact int;
begin
  select count(*), count(*) filter (where tier = 'impact')
    into v_gesamt, v_impact
    from public.profiles;

  if v_gesamt > 50 or v_impact > 20 then
    raise exception
      'AGE-495: Der Datenbestand deutet auf einen bereits erfolgten Import hin '
      '(% Profile, davon % auf impact; erwartet <= 50 / <= 20). Diese Migration '
      'MUSS vor dem Mitglieder-Import laufen — sonst stempelt ihr Backfill genau '
      'die Konten als aktiviert, fuer die der Bestaetigungsweg gebaut wurde. '
      'Nicht die Grenze anheben, sondern die Reihenfolge pruefen.',
      v_gesamt, v_impact
      using errcode = 'check_violation';
  end if;
end $$;

-- ── 6. Backfill ─────────────────────────────────────────────────────────────
-- Bestandsprofile gelten als aktiviert, sonst sperrt Teil B sie aus. Bewusst
-- unbedingt: eine Einschraenkung auf ein Entstehungsdatum waere im Schadensfall
-- wahr und damit keine Sicherung (s. Kopf). Der Stolperdraht oben ist die
-- Sicherung.
--
-- Auf PROD sind das die zwei Grundkonten, beide mit bestaetigter Adresse
-- (`auth.users.email_confirmed_at` gesetzt, gemessen 2026-08-06) — es werden
-- also keine unbestaetigten Altkonten durchgewunken.
update public.profiles set activated_at = now() where activated_at is null;
