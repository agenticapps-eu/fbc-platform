-- AGE-598, Teil B — Kontaktanfragen werden gestaffelt.
--
-- Aufgaben 5.2 und 5.4 aus openspec/changes/rechte-matrix-stufen/tasks.md.
-- Die scheiternden Zusagen stehen seit 5.1, 5.3 und 5.5 in
-- supabase/tests/kontaktanfrage_staffelung_test.sql (19 von 29 rot).
--
-- Die Regel stammt von Donald (25.08.) und steht in den Goals des Entwurfs:
--
--   `basic`       gar nicht
--   `connect`     nur an GENAU `connect`
--   ab `discover` an alle
--
-- ══ 1. „GENAU connect" IST DIE AUSLEGUNG, NICHT EIN VERSEHEN ════════════════
-- Nicht „`connect` und darüber". Donald hat das ausdrücklich so entschieden,
-- mitsamt der benannten Folge: bei heute 73 × `impact`, 1 × `discover` und
-- 0 × `connect` darf ein `connect`-Mitglied faktisch NIEMANDEN anschreiben.
-- Das wird hier nicht stillschweigend geglättet. Zusage 4 der Testdatei hält
-- es fest, damit die Auslegung nicht beim nächsten Lesen zur Frage wird.
--
-- ══ 2. GEGENÜBER HEUTE IST DAS FÜR RANG 3 EINE ERWEITERUNG ══════════════════
-- Klausel 320 lautet bis zu dieser Migration `is_contact_open() or
-- has_level(4)`: im geschlossenen Modus darf ein `discover`-Konto NICHT
-- senden, und `rls_test.sql:260` sagt das seit AGE-455 zu. Danach darf es an
-- jeden senden.
--
-- Der Change liest sich sonst durchweg als Einschränkung — an dieser einen
-- Stelle ist er das Gegenteil, und deshalb steht es hier und nicht in einer
-- Nebenbemerkung. Betroffen ist heute genau EIN Konto, und wirksam wird es
-- ohnehin erst, wenn `open_contact` auf `false` geht.
--
-- ══ 3. WARUM EIN EIGENES PRÄDIKAT UND KEINE BEDINGUNGSKETTE ═════════════════
-- Die Regel ist dreistufig und liest die Stufe des EMPFÄNGERS. In einer
-- `with check`-Klausel, die ohnehin schon sechs Bedingungen trägt, wäre sie
-- nicht mehr prüfbar. Ein benanntes Prädikat ist ausserdem die einzige Form,
-- die `access-control` vorsieht („Helper predicates are the single authority
-- for gating").
--
-- ══ 4. WARUM `SECURITY DEFINER` ════════════════════════════════════════════
-- Das Prädikat liest `profiles.tier` des Empfängers. Ein `connect`-Konto darf
-- fremde volle Zeilen nicht lesen (`profiles_select_self_or_discover`) — ohne
-- DEFINER fiele der `exists`-Zweig still auf „keine Zeile" und verböte damit
-- ausgerechnet die eine Anfrage, die er erlauben soll. Dasselbe Muster und
-- derselbe Grund wie bei `is_contactable` und `is_new_member`.
--
-- Es gibt nur ein Boolean heraus, keine Zeile.
--
-- ══ 5. DER `revoke` IST DER GANZE PUNKT DER GRANT-ZEILEN ════════════════════
-- Eine neue Funktion erbt EXECUTE über PUBLIC. Ohne den ausdrücklichen Entzug
-- dürfte ein AUSGELOGGTER Aufrufer über /rest/v1/rpc ein
-- `security definer`-Prädikat ausführen, das `profiles.tier` fremder UUIDs
-- liest — ein Orakel, und ein neuer Weg, kein bestehender (`anon` hält auf
-- `profiles_public` kein SELECT).
--
-- `grants_test.sql` Abschnitt 6 zählt abschliessend auf, was `anon` ausführen
-- darf. Bleibt er nach dieser Migration grün, ist der Entzug angekommen.
-- Bricht er, ist DAS der Befund — die Golden-Liste nachzuziehen wäre die
-- falsche Reparatur.

-- ── 1. Das Prädikat ─────────────────────────────────────────────────────────
create or replace function public.darf_kontaktanfrage_senden(p_to_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select case
    -- Ab `discover` (Rang 3) an jeden. Die Zahl steht hier und sonst nirgends.
    when public.has_level(3) then true
    -- `connect` (Rang 2) nur an genau `connect` — siehe Kopf, Abschnitt 1.
    when public.has_level(2) then exists (
      select 1 from public.profiles p
       where p.id = p_to_id
         and p.tier = 'connect')
    -- `basic` (Rang 1) und alles ohne Anmeldung: nein.
    else false
  end
$$;

comment on function public.darf_kontaktanfrage_senden(uuid) is
  'Darf der Aufrufer p_to_id eine Kontaktanfrage schicken? Staffelung nach '
  'AGE-598: basic nein, connect nur an genau connect, ab discover an alle. '
  'SECURITY DEFINER, weil das Praedikat die Stufe des EMPFAENGERS liest und '
  'ein connect-Konto fremde profiles-Zeilen nicht sehen darf. Wirkt nur im '
  'geschlossenen Modus — is_contact_open() steht in der Policy davor.';

revoke execute on function public.darf_kontaktanfrage_senden(uuid) from public, anon;
grant  execute on function public.darf_kontaktanfrage_senden(uuid) to authenticated;

-- ── 2. Klausel 320 in `cr_insert_self` ──────────────────────────────────────
-- Die Policy wird ganz neu gesetzt, weil Postgres sie nicht teilweise ändern
-- lässt. Bis auf die eine Klausel steht sie Wort für Wort wie in
-- 20260806080100_activation_gate.sql — insbesondere der Welpenschutz
-- (letzte Klausel), der erst in Aufgabe 6 fällt und hier ausdrücklich
-- unangetastet bleibt. Zwei Änderungen in einer Migration ergäben einen
-- Zwischenstand, den keine Zusage beschreibt.
drop policy if exists cr_insert_self on public.contact_requests;
create policy cr_insert_self on public.contact_requests
  for insert to authenticated
  with check (
    public.is_activated()
    and from_id = (select auth.uid())
    and status = 'pending'
    and public.is_contactable(to_id)
    -- HIER, und nur hier: `has_level(4)` → das Prädikat.
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
    and ( public.is_contact_open() or match_id is not null or not public.is_new_member(to_id) )
  );

comment on policy cr_insert_self on public.contact_requests is
  'Eigene Anfrage, pending, an einen erreichbaren Empfaenger. Seit AGE-598 '
  'gestaffelt statt ab rank 4: darf_kontaktanfrage_senden(to_id). Der '
  'Welpenschutz in der letzten Klausel faellt in derselben Aufgabengruppe, '
  'aber nicht in dieser Migration.';
