-- Bild-URLs auf Pfade zurückschneiden (AGE-580, Stufe 2).
-- Donald, 2026-08-21. Change: openspec/changes/bild-urls-relative-pfade/.
--
-- ══ DER BEFUND ═════════════════════════════════════════════════════════════
-- `profiles.avatar_url` und `profiles.cover_url` tragen absolute URLs MIT DER
-- PROJEKTKENNUNG darin — gemessen am 17./20.08.: 56 bzw. 53 Zeilen, keine
-- einzige relativ. Unter einer neuen Kennung zeigen alle 109 ins Leere, obwohl
-- die Objekte mitgezogen wären. Das sieht kein Grant-Test und keine
-- Zeilenzählung; es fällt erst im Browser auf, als leeres Profilbild.
--
-- ══ ZWEI RIEGEL, UND WARUM ES ZWEI SEIN MÜSSEN ═════════════════════════════
-- Der erste Entwurf schnitt jede URL der Form
--   https://<irgendeine>.supabase.co/storage/v1/object/public/avatars/…
-- zurück, ausdrücklich OHNE die eigene Kennung hart zu schreiben — „sonst trüge
-- die Migration genau die Kopplung, die sie beseitigen soll".
--
-- Der Plan-Review hielt dagegen, das schnitte auch eine absichtlich externe URL
-- aus einer FREMDEN Supabase-Instanz um. Der zweite Entwurf antwortete mit
-- einer Existenzprüfung gegen `storage.objects` — und DIE SONDE HAT IHN
-- WIDERLEGT (`scripts/probe-age580-migration.ts`, Lauf vom 2026-08-21):
--
--   FEHLER  FREMDE Supabase-Instanz, gleicher Bucket-Name → unangetastet
--           soll: https://fremde-instanz.supabase.co/…/avatars/<uid>/a.webp
--           ist : <uid>/a.webp
--
-- Liegt unter DEMSELBEN Pfad hier zufällig ein Objekt — und bei gespiegelten
-- Daten ist das der Normalfall, nicht der Ausnahmefall —, dann greift die
-- Existenzprüfung ins Leere und die fremde URL wird doch zerschnitten.
--
-- Also beides. Der Host wird ausdrücklich genannt:
--
--   1. HOST-RIEGEL. Nur die drei Adressen, unter denen dieser Bestand je lag.
--      Eine einmalige historische Migration ist keine Laufzeitkopplung: sie
--      beschreibt, was da WAR, nicht wohin die Anwendung zeigt. Der laufende
--      Code kennt keine Kennung — er fragt den Client (`src/lib/bild-url.ts`).
--   2. EXISTENZ-RIEGEL. Zusätzlich muss das Objekt hier liegen. Er ersetzt den
--      ersten nicht, er fängt den anderen Fall: einen Wert, dessen Bild fehlt.
--      Ihn zu schneiden hiesse, einen kaputten Wert unrettbar zu machen.
--
-- Ohne den Test wäre der zweite Entwurf gemergt worden. Er sah richtig aus,
-- er war begründet, und er war falsch.
--
-- ══ WAS SIE BEWUSST NICHT ANFASST ══════════════════════════════════════════
--   · fremd gehostete Bilder — der Demo-Seed schreibt `i.pravatar.cc`; das ist
--     gar kein Supabase-Storage und bleibt ausdrücklich erlaubt,
--   · eine URL einer fremden Supabase-Instanz (Objekt liegt hier nicht),
--   · einen Wert des jeweils ANDEREN Buckets — dass er dort steht, ist ein
--     Fehler, aber ein stiller Zuschnitt machte ihn unrettbar,
--   · Werte, die schon Pfade sind. Daher ist sie WIEDERHOLBAR: ein Pfad
--     entspricht dem Muster nicht.
--
-- ══ REIHENFOLGE ════════════════════════════════════════════════════════════
-- Diese Migration darf ERST laufen, wenn die auflösende Fläche ausgeliefert
-- ist (Stufe 1, `src/lib/bild-url.ts`). Ein älteres Bundle, das einen nackten
-- Pfad bekommt, rendert `<img src="uid/123.webp">` relativ zum
-- Anwendungs-Origin — ein totes Bild auf der ganzen Fläche.
--
-- Keine neue Tabelle, keine neue Spalte, also keine Grants und kein Anfassen
-- des grants_test-Golden-Snapshots.

-- Die drei Adressen, unter denen dieser Bestand je lag: PROD, DEV und der
-- lokale Stack. Ein anderer Host fällt durch — das ist der Host-Riegel.
create or replace function pg_temp.bild_pfad(url text, bucket text)
returns text
language sql
immutable
as $$
  select substring(
           url
           from '^(?:https://viwntbodrtqxgmqyxluh\.supabase\.co'
             || '|https://foelowldexkcqzewvrcf\.supabase\.co'
             || '|http://127\.0\.0\.1:54321'
             || '|http://localhost:54321'
             || ')/storage/v1/object/public/' || bucket || '/(.+)$'
         )
$$;

update public.profiles p
   set avatar_url = pg_temp.bild_pfad(p.avatar_url, 'avatars')
 where p.avatar_url is not null
   and pg_temp.bild_pfad(p.avatar_url, 'avatars') is not null
   and exists (
         select 1
           from storage.objects o
          where o.bucket_id = 'avatars'
            and o.name = pg_temp.bild_pfad(p.avatar_url, 'avatars')
       );

update public.profiles p
   set cover_url = pg_temp.bild_pfad(p.cover_url, 'covers')
 where p.cover_url is not null
   and pg_temp.bild_pfad(p.cover_url, 'covers') is not null
   and exists (
         select 1
           from storage.objects o
          where o.bucket_id = 'covers'
            and o.name = pg_temp.bild_pfad(p.cover_url, 'covers')
       );
