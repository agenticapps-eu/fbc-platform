-- AGE-252: Videos auf dem Profil ("Profil > Videos"). Geordnete Liste von
-- YouTube-/Vimeo-URLs, die auf der Profilseite via <VideoEmbed> eingebettet
-- werden. Kein eigenes Hosting; nur erlaubte Anbieter (Validierung im Client
-- über parseVideoUrl, ungültige/leere Einträge werden beim Speichern verworfen).
-- Sichtbarkeit über die bestehenden profiles-RLS-Policies — kein neuer
-- Zugriffspfad. Zählt NICHT zur profile_completion (DB-Trigger bleibt unberührt).
alter table public.profiles
  add column if not exists videos text[] not null default '{}';

comment on column public.profiles.videos is
  'AGE-252: geordnete YouTube-/Vimeo-URLs für die Profil-Videos. Embed im Client (VideoEmbed); RLS via bestehende profiles-Policies.';
