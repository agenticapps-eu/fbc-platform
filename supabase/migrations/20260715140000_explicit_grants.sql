-- Grants explizit aussprechen, statt sie zu erben (AGE-312).
--
-- Ausgangslage: Fuer die meisten Tabellen sagen unsere Migrationen nie, welche
-- Rechte anon/authenticated haben sollen. Der Ist-Zustand entstand damit aus
-- Supabases eigenem `alter default privileges` -- also aus einer Voreinstellung,
-- die uns nicht gehoert, die sich zwischen Umgebungen unterscheidet und die
-- Supabase inzwischen ausserdem verschaerft hat. Was eine Instanz an Rechten
-- traegt, haengt so am Ende daran, wann sie angelegt wurde.
--
-- Zwei Folgen, beide schlecht:
--
--   * Was `supabase db reset` baut, deckt sich nicht mit einer laenger
--     bestehenden Instanz. Auf der frischen DB fehlen Rechte, die die App
--     braucht: rls_test.sql kann die Rechte-Matrix nicht verifizieren, CI
--     belegt nur, dass die Migrationen *laufen*, nicht dass sie das *Richtige*
--     erlauben.
--   * Umgekehrt kann geerbt dort stehen, was keine Policy deckt -- bis hin zu
--     TRUNCATE, REFERENCES, TRIGGER und MAINTAIN. An diesen vieren greift RLS
--     ueberhaupt nicht (RLS filtert nur SELECT, INSERT, UPDATE, DELETE), sie
--     haben in einer RLS-getragenen Anwendung also nichts zu suchen.
--
-- Diese Migration macht den Endzustand allein von dieser Datei abhaengig:
--   1. Sauberer Ausgangszustand -- alles von anon/authenticated einziehen.
--   2. Pro Tabelle x Rolle genau das granten, was die Policies brauchen.
--   3. Den Default entschaerfen, damit kuenftige Tabellen nichts mehr erben.
--
-- Ableitungsregel: Eine Policy `FOR SELECT TO authenticated` braucht genau
-- `grant select ... to authenticated` -- sonst nichts. Wo fuer eine Rolle keine
-- Policy existiert, gibt es auch kein Grant: RLS blockt dort ohnehin, das Recht
-- waere totes Gewicht. Die Migration nimmt daher nur weg und fuegt nichts hinzu,
-- was heute nicht schon wirksam ist. Wo ein Grant bewusst enger ist als seine
-- Policy (Spalten-Grants unten, member_settings ohne DELETE), gewinnt der
-- engere Grant -- policy-impliziert ist eine Obergrenze, kein Ziel.
--
-- service_role bleibt unangetastet: es umgeht RLS per Definition und traegt die
-- Edge Functions.

-- 1. Sauberer Ausgangszustand ------------------------------------------------
--
-- Bewusst ueber `all tables`: nur so ist der Endzustand unabhaengig davon, was
-- die jeweilige Instanz vorher geerbt hatte. Schliesst Views ein, deshalb kommt
-- profiles_public unten explizit zurueck.

revoke all on all tables in schema public from anon, authenticated;

-- 2. Tabellen-Grants ---------------------------------------------------------

-- Stammdaten: fuer alle lesbar, auch abgemeldet (Policies `using (true)`).
grant select on public.badges             to anon, authenticated;
grant select on public.membership_tiers   to anon, authenticated;
grant select on public.partner_categories to anon, authenticated;

-- posts/events: anon sieht ausschliesslich visibility='public' (eigene Policy),
-- authenticated schreibt eigene Beitraege (posts_write_own / events_write_host).
grant select                         on public.posts  to anon;
grant select, insert, update, delete on public.posts  to authenticated;
grant select                         on public.events to anon;
grant select, insert, update, delete on public.events to authenticated;

-- Nur lesbar fuer Mitglieder.
grant select on public.matches        to authenticated;
grant select on public.partners       to authenticated;
grant select on public.profile_badges to authenticated;
grant select on public.staff_roles    to authenticated;

-- Interaktion am fremden Objekt: anlegen und lesen, nicht aendern.
grant select, insert on public.comments        to authenticated;
grant select, insert on public.message_threads to authenticated;
grant select, insert on public.messages        to authenticated;

-- Eigene Daten: volle DML, per Policy auf profile_id = auth.uid() begrenzt.
grant select, insert, update, delete on public.compass_responses    to authenticated;
grant select, insert, update, delete on public.event_registrations  to authenticated;
grant select, insert, update, delete on public.feedback             to authenticated;
grant select, insert, update, delete on public.goals                to authenticated;
grant select, insert, update, delete on public.needs                to authenticated;
grant select, insert, update, delete on public.notifications        to authenticated;
grant select, insert, update, delete on public.offers               to authenticated;
grant select, insert, update, delete on public.post_likes           to authenticated;
grant select, insert, update, delete on public.profile_interests    to authenticated;
grant select, insert, update, delete on public.profile_theme_scores to authenticated;

-- Kein DELETE, obwohl die Policy `for all` ist: eine Einstellungszeile wird
-- geaendert, nicht geloescht (20260630130000_member_settings.sql).
grant select, insert, update on public.member_settings  to authenticated;
grant select, insert, update on public.profile_contacts to authenticated;

-- 3. Spalten-Grants ----------------------------------------------------------
--
-- Hier ist das Grant enger als die Policy: `profiles_update_own` erlaubt UPDATE
-- auf der Zeile, aber schreibbar ist nur diese Spaltenliste. Abgeleitete Felder
-- (tier, member_number, potential_score, profile_completion, search_doc, ...)
-- gehoeren Triggern und RPCs, nicht dem Client.

grant select on public.profiles to authenticated;
grant update (
  name, avatar_url, region, company, short_bio, branche, headline,
  roles, socials, website, competencies, dev_focus, goals, interests, is_public
) on public.profiles to authenticated;

-- contact_requests: anlegen ja, aber nachtraeglich nur den Status setzen
-- (20260614110000_harden_contact_request_authz.sql).
grant select, insert    on public.contact_requests to authenticated;
grant update (status)   on public.contact_requests to authenticated;

-- routing_queue: lesen ja, aendern nur diese beiden Felder
-- (20260614120000_volume_routing_queue.sql).
grant select                          on public.routing_queue to authenticated;
grant update (status, assigned_to)    on public.routing_queue to authenticated;

-- 4. View --------------------------------------------------------------------
--
-- profiles_public ist eine VIEW mit security_invoker=off: sie laeuft mit den
-- Rechten ihres Owners und ist damit selbst die Sicherheitsgrenze -- Policies
-- gibt es hier keine. Ihr SELECT ist tragend (Verzeichnis + Feed), anon bleibt
-- draussen (20260630120000_profiles_public_readonly_members.sql).

grant select on public.profiles_public to authenticated;

-- 5. Default entschaerfen ----------------------------------------------------
--
-- Ohne diesen Schritt heilt oben nur den Ist-Zustand: die naechste per Migration
-- angelegte Tabelle erbt wieder, je nach Instanz Verschiedenes, und die Drift
-- ist zurueck. Danach erbt keine neue Tabelle mehr etwas; wer Rechte will, muss
-- sie aussprechen. Das ist fail-closed: eine vergessene Tabelle faellt sofort
-- auf, statt still Rechte zu bekommen, die niemand geprueft hat.
--
-- Nur `for role postgres`: Migrationen laufen als postgres, und die Defaults von
-- supabase_admin gehoeren Supabase, nicht uns.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
