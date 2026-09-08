-- Event-Vorlagen und Serientermine (AGE-630), Lese-Zweig für Vorlagen-Cover.
--
-- ══ WARUM DIESE SICHERHEITSFUNKTION UEBERHAUPT ANGEFASST WIRD ═══════════════
-- Die erste Fassung des Plans wollte „Cover an der Vorlage" UND
-- „`event_cover_lesbar()` bleibt unveraendert". Die Plan-Review (opencode, HOCH)
-- zeigte, dass beides zusammen NICHT BAUBAR ist:
--
-- `event_cover_lesbar()` schlaegt ein Objekt AUSSCHLIESSLICH ueber
-- `public.events.cover_path` nach. Auf den Pfad einer VORLAGE zeigt keine
-- `events`-Zeile — der Host koennte sein eigenes Vorlagenbild also weder
-- signieren noch als Kopierquelle lesen. Die Vorlage haette ein Cover gehabt,
-- das niemand je zu sehen bekommt.
--
-- ══ WAS DER ZWEITE ZWEIG ZUSAGT, UND WAS NICHT ══════════════════════════════
-- NUR der eigene Host. Kein `anon`-Zweig, kein `members`-Zweig. Eine Vorlage
-- traegt keine `visibility`; die Sichtbarkeitslogik der `events`-Zeile auf eine
-- Tabelle ohne diese Semantik zu verbiegen waere genau die „Reparatur", vor der
-- die Review gewarnt hat (D5a).
--
-- Die Pfadbindung `(storage.foldername(objektname))[1] = v.host_id::text` steht
-- im neuen Zweig GENAUSO wie im alten. Ohne sie liesse sich ein verwaister
-- fremder Pfad an eine eigene Vorlage haengen und danach signieren — derselbe
-- Angriff wie der aus dem AGE-531-Review, eine Tabelle weiter.
--
-- Die Funktion ist `SECURITY DEFINER` und umgeht damit die RLS von
-- `event_vorlagen`. Deshalb steht `v.host_id = auth.uid()` AUSGESCHRIEBEN im
-- Zweig — die Policy der Tabelle hilft hier nicht.
--
-- ══ DER ALTE ZWEIG IST ZEICHENGLEICH ════════════════════════════════════════
-- Erweitert, nicht umgebaut. Was `anon` und `members` fuer EVENT-Cover sehen,
-- muss unveraendert bleiben; die Waechter dafuer sind die Zusagen 20.5–20.7 in
-- `rls_test.sql`, die schon vor dieser Aenderung standen.
--
-- `create or replace` behaelt die bestehenden Rechte — `anon` MUSS die Funktion
-- weiter aufrufen duerfen, sonst traegt die SELECT-Policy des Buckets nicht
-- (rls_test.sql, Abschnitt 20).
--
-- Forward-only.

create or replace function public.event_cover_lesbar(objektname text)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
      from public.events e
     where e.cover_path = objektname
       -- Die Pfadbindung: das Objekt gehört dem Host des Events, sonst nicht.
       -- Ohne diese Zeile ließe sich ein verwaister fremder Pfad an ein
       -- eigenes public-Event hängen und danach von anon signieren.
       and (storage.foldername(objektname))[1] = e.host_id::text
       and case
             -- Ohne Session: nur öffentliche Events. Spiegelt
             -- events_select_public_anon (20260612082726).
             when (select auth.uid()) is null then e.visibility = 'public'
             -- Mit Session: spiegelt events_select_by_visibility
             -- (20260806080100), Aktivierungs-Gate als äußeres and inbegriffen.
             else public.is_activated()
                  and ( e.visibility in ('public', 'members')
                        or e.host_id = (select auth.uid()) )
           end
  )
  -- AGE-630: das Cover einer VORLAGE, ausschließlich für ihren eigenen Host.
  -- Beide Bedingungen stehen INNERHALB dieses exists — ein `is_activated()`
  -- neben dem or-Zweig statt darin wäre wirkungslos.
  or exists (
    select 1
      from public.event_vorlagen v
     where v.cover_path = objektname
       and (storage.foldername(objektname))[1] = v.host_id::text
       and public.is_activated()
       and v.host_id = (select auth.uid())
  );
$$;

comment on function public.event_cover_lesbar(text) is
  'Titelbild-Sichtbarkeit im Bucket event-covers. Zweig 1: ein Event-Cover ist '
  'so sichtbar wie sein Event. Zweig 2 (AGE-630): ein Vorlagen-Cover ist NUR '
  'fuer seinen eigenen Host lesbar — eine Vorlage hat keine Sichtbarkeit. '
  'Beide Zweige binden den Pfad an das {uid}/-Praefix des Eigentuemers.';
