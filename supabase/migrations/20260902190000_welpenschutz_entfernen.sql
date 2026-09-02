-- AGE-598, Teil B — der 30-Tage-Welpenschutz geht ersatzlos.
--
-- Aufgaben 6.2 und 6.3 aus openspec/changes/rechte-matrix-stufen/tasks.md.
-- Die scheiternden Zusagen stehen seit 6.1 und 6.4 in
-- supabase/tests/kontaktanfrage_staffelung_test.sql (26 und 27 rot).
--
-- ══ 1. DER WEG DAHIN IST DIE MESSUNG, NICHT DIE MEINUNG ═════════════════════
-- Ein Zwischenentwurf sah einen zweiten Schalter `welpenschutz_aktiv` mit
-- Vorgabe `false` vor. Dann wurde der Bestand auf PROD gemessen (02.09.,
-- read-only), und das Ergebnis machte die Regel unhaltbar:
--
--   **alle 74 Profile sind jünger als 30 Tage** — 2 vom 05.08., 69 vom 16.08.,
--   1 vom 24.08., 2 vom 25.08.
--
-- Ein eingeschalteter Welpenschutz hätte die Kontaktfunktion plattformweit
-- stillgelegt. Der einzige Fluchtweg wären 56 Übereinstimmungen gegen 2.701
-- mögliche Paare gewesen, rund 2 % Durchlass. Eine Schutzregel, die man wegen
-- ihrer eigenen Wirkung nie einschalten kann, ist keine Regel, sondern toter
-- Code mit einem Schalter davor.
--
-- Donalds Begründung trägt weiter als der Messwert: andere Plattformen haben
-- so etwas auch nicht. Die Regel stammt aus §2 des Stufenmodells und war nie
-- im Betrieb — seit dem 05.08. hebt `open_contact` sie auf, davor gab es kaum
-- Selbstregistrierungen.
--
-- ══ 2. WAS DEN SCHUTZ ÜBERNIMMT ════════════════════════════════════════════
-- Die Staffelung aus 20260902180000, und besser. Der Zweck des Welpenschutzes
-- war, ein frisches Konto vor Kaltansprache zu bewahren; die Staffelung
-- bindet das Senden an die Stufe des Absenders, nicht an das Alter des
-- Empfängers — an eine Eigenschaft dessen, der handelt, statt an eine dessen,
-- der es erleidet.
--
-- ══ 3. GESTRICHEN, NICHT ABGESCHALTET ══════════════════════════════════════
-- Kein zweiter Schalter, keine abgeschwächte Fassung, keine Frist. Damit
-- erledigt sich auch das Entkopplungsproblem, statt gelöst zu werden:
-- `open_contact` wirkt danach nur noch auf die Staffelung, weil es nichts
-- anderes mehr gibt, worauf es wirken könnte.
--
-- ══ 4. WARUM DIE FUNKTION MITGEHT ══════════════════════════════════════════
-- `public.is_new_member(uuid)` hatte gemessen genau EINEN lebenden Aufrufer,
-- und das war die Klausel unten. Sie stehen zu lassen hiesse, ein
-- `security definer`-Prädikat über `profiles.created_at` fremder UUIDs im
-- Katalog zu behalten, das niemand mehr ruft — und beim nächsten Lesen sähe
-- der Welpenschutz aus, als gäbe es ihn noch.
--
-- Die Zusage dazu steht in der Testdatei (`hasnt_function`). Ohne sie bliebe
-- der Drop unbelegt: die Klausel zu streichen und die Funktion stehen zu
-- lassen sähe von aussen genauso aus.

-- ── 1. Klausel 332 aus `cr_insert_self` ─────────────────────────────────────
-- Die Policy wird ganz neu gesetzt, weil Postgres sie nicht teilweise ändern
-- lässt. Bis auf die gestrichene letzte Klausel steht sie Wort für Wort wie in
-- 20260902180000_kontaktanfrage_staffelung.sql.
drop policy if exists cr_insert_self on public.contact_requests;
create policy cr_insert_self on public.contact_requests
  for insert to authenticated
  with check (
    public.is_activated()
    and from_id = (select auth.uid())
    and status = 'pending'
    and public.is_contactable(to_id)
    and ( public.is_contact_open() or public.darf_kontaktanfrage_senden(to_id) )
    and (
      match_id is null
      or exists (
        select 1 from public.matches m
        where m.id = match_id
          and (
            (m.a_profile_id = from_id and m.b_profile_id = to_id) or
            (m.a_profile_id = to_id and m.b_profile_id = from_id)
          )
      )
    )
    -- Hier stand der Welpenschutz:
    --   and ( public.is_contact_open() or match_id is not null
    --         or not public.is_new_member(to_id) )
    -- Er ist gestrichen, nicht abgeschaltet — siehe Kopf.
  );

comment on policy cr_insert_self on public.contact_requests is
  'Eigene Anfrage, pending, an einen erreichbaren Empfaenger, gestaffelt nach '
  'darf_kontaktanfrage_senden(to_id). Der 30-Tage-Welpenschutz ist seit '
  'AGE-598 ersatzlos gestrichen: alle 74 Bestandsprofile waren juenger als 30 '
  'Tage, die Regel haette die Kontaktfunktion plattformweit stillgelegt. Das '
  'match_id bleibt optional und traegt weiterhin die Paarbindung.';

-- ── 2. Das verwaiste Prädikat ───────────────────────────────────────────────
-- `drop` ohne `if exists`: gäbe es die Funktion wider Erwarten nicht, wäre das
-- ein Befund und keine Bequemlichkeit.
drop function public.is_new_member(uuid);
