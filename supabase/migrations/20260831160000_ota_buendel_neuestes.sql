-- OTA, Teil 3: der LESEWEG (AGE-642, Phase D3).
-- Donald, 2026-08-31. Spec: openspec/changes/capacitor-huelle/, Entwurf §8.
--
-- Teil 1 (20260831100000) legte Bucket und Manifest an, Teil 2 (…140000) die
-- eine Tuer zum Schreiben. Diese Migration reicht die zweite und letzte Tuer
-- nach: die Abfrage, die der `updateUrl`-Endpunkt stellt.
--
-- ══ WARUM AUCH HIER EINE FUNKTION UND KEIN `.from(...)` ═════════════════════
-- Der naheliegende Weg im Handler waere `.from("ota_buendel").select(...)` mit
-- dem Service-Schluessel. Er scheitert — und zwar erst zur LAUFZEIT, nach
-- gruenem Typecheck und gruenen Tests: `service_role` haelt in `public` auf
-- keiner Tabelle ein Recht (AGE-312), und `rolbypassrls` umgeht die RLS, nicht
-- das fehlende SELECT-Recht. Dieselbe Falle wie beim Schreibweg, nur dass sie
-- hier nicht im Deploy auffiele, sondern auf jedem Geraet, das nach einer
-- Aktualisierung fragt.
--
-- ══ DIE ORDNUNG IST DER GANZE INHALT DIESER FUNKTION ════════════════════════
-- Gemessen am 31.08. an @capgo/capacitor-updater@8.51.15: das Geraet vergleicht
-- die angebotene Fassung mit der eigenen auf UNGLEICHHEIT, nicht auf Groesse
-- (`CapacitorUpdaterPlugin.java:4909`, `.swift:4360`). Es gibt auf dem Geraet
-- keine Semver-Ordnung, kein „groesser als", keine Abwehr gegen einen
-- Rueckschritt. Liefert diese Funktion ein aelteres Buendel, installiert es das
-- Geraet kommentarlos.
--
-- Deshalb steht hier ein ausdrueckliches `order by created_at desc` und nicht
-- ein `limit 1` auf einer unsortierten Menge. „Die Zeile, die zuletzt kam" ist
-- keine Eigenschaft, die eine Tabelle von sich aus hat — ein `select … limit 1`
-- ohne `order by` waere ein Rueckschritt, der wie ein Zufall aussieht.
--
-- `version desc` als zweite Stelle: zwei Zeilen mit gleichem `created_at` sind
-- praktisch ausgeschlossen (je Deploy eine, `now()` je Transaktion), aber ohne
-- Tiebreaker waere die Antwort in diesem Fall nicht bestimmt. Ein
-- Aktualisierungsdienst, der bei gleichem Stand zwei verschiedene Antworten
-- geben kann, ist kein Dienst.
--
-- Ein Wiederholungslauf desselben Commits hebt `created_at` NICHT an: Teil 2
-- ersetzt per `on conflict do update` nur url/checksum/session_key/Schale. Eine
-- erneut veroeffentlichte alte Fassung draengelt sich also nicht nach vorn.
--
-- ══ DER VERGLEICH IST ZAHLENWEISE ═══════════════════════════════════════════
-- `benoetigte_schale <= p_schale` als Zeichenkette stellte `10.0.0` vor
-- `9.0.0` — ein Geraet mit Schale 10.0.0 bekaeme dann kein Buendel, das 9.0.0
-- verlangt. `string_to_array(…, '.')::int[]` vergleicht elementweise; beide
-- Seiten haben durch die CHECK-Bedingung bzw. den Waechter unten genau drei
-- Stellen mit hoechstens vier Ziffern.
--
-- Forward-only.

create or replace function public.ota_buendel_neuestes(p_schale text)
  returns table (version text, url text, checksum text, session_key text)
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  -- Der Waechter ist keine Vorsicht auf Vorrat, sondern die Bedingung dafuer,
  -- dass die Zeile darunter ueberhaupt sicher ist: `::int[]` auf einer
  -- missgebildeten Zeichenkette wirft `22P02`, und der Handler kann eine
  -- WHERE-Klausel nicht nachtraeglich absichern — Postgres garantiert keine
  -- Auswertungsreihenfolge zwischen zwei UND-verknuepften Bedingungen.
  --
  -- LAUT statt leer: `p_schale` kommt aus `plugins.CapacitorUpdater.version`
  -- der eigenen Schale (Entwurf §8). Ist der Wert missgebildet, ist die Schale
  -- kaputt gebaut. Eine leere Antwort hiesse „alles aktuell" und liesse jedes
  -- Geraet dieser Schale still auf seinem Stand stehen — genau die Sorte
  -- Ausfall, gegen die diese Phase geschrieben ist.
  if p_schale is null or p_schale !~
     '^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$' then
    raise exception 'ota_buendel_neuestes: % ist keine Vertragsnummer', p_schale
      using errcode = '22023';
  end if;

  return query
    select b.version, b.url, b.checksum, b.session_key
      from public.ota_buendel b
     where string_to_array(b.benoetigte_schale, '.')::int[]
        <= string_to_array(p_schale, '.')::int[]
     order by b.created_at desc, b.version desc
     limit 1;
end;
$$;

comment on function public.ota_buendel_neuestes(text) is
  'Liefert das NEUESTE Buendel, dessen benoetigte_schale die anfragende Schale '
  'erfuellt (AGE-642). Einziger Leseweg auf public.ota_buendel; die Tabelle '
  'traegt selbst keinen Grant. Nur fuer service_role, aufgerufen aus der Edge '
  'Function ota-update. Die Ordnung nach created_at ist Pflicht und keine '
  'Kosmetik: das Geraet vergleicht Fassungen auf Ungleichheit und installiert '
  'ein aelteres Buendel kommentarlos.';

-- Beide Zeilen nennen JEDE Rolle. Ein `revoke … from public` allein wirkt auf
-- einer frisch angelegten Instanz nicht: dort werden Rechte rollen-eigen
-- vergeben, und `anon` behielte seines. Das hat am 27.08. `main` rot gemacht
-- (AGE-622, 20260827070000). Und `alter default privileges … revoke execute`
-- waere hier ein No-op, der wie Schutz aussieht (AGE-602).
--
-- Dass auch `anon` und `authenticated` draussen bleiben, ist hier nicht bloss
-- Gewohnheit: die Funktion gibt `session_key` heraus. Der oeffnet zusammen mit
-- dem oeffentlichen Schluessel jedes Buendel — kein Geheimnis (die
-- Verschluesselung traegt Echtheit, nicht Vertraulichkeit, Entwurf §8), aber
-- auch nichts, das ein Browser-Client von uns bekommen muesste.
revoke execute on function public.ota_buendel_neuestes(text)
  from public, anon, authenticated, service_role;
grant  execute on function public.ota_buendel_neuestes(text)
  to service_role;
