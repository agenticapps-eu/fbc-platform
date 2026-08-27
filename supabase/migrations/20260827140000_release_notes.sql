-- Release-Notes: eine redigierte Mitteilung an alle aktivierten Mitglieder
-- (AGE-631).
-- Donald, 2026-08-27. Change: openspec/changes/release-notes-an-alle/.
--
-- ══ BEFUND ══════════════════════════════════════════════════════════════════
-- Mitglieder erfahren gar nicht, dass sich die Anwendung geaendert hat. Die
-- vier Hinweistypen aus AGE-620 melden ausschliesslich, was ANDERE MITGLIEDER
-- tun (Beitrag, Event, Kommentar, Reaktion). Was wir tun, meldet nichts.
--
-- ══ WARUM DER ZUSTANDSWECHSEL DER RIEGEL IST ═══════════════════════════════
-- Ein Fan-out ist die einzige Schreiblast dieser Anwendung, die mit der
-- Mitgliederzahl MULTIPLIZIERT. Ein zweiter Klick verdoppelt sie, und niemand
-- sieht es: `notifications` traegt keinen Schluessel, an dem eine Dopplung
-- auffiele, und die Oberflaeche meldet beide Male „hat geklappt".
--
-- Deshalb steht das bedingte
--   update … set status='sent' where id = p_id and status='draft'
-- VOR jeder erzeugten Zeile. Trifft es nichts, bricht die Funktion ab, bevor
-- ein einziger Hinweis entsteht. Zwei gleichzeitige Aufrufe koennen nicht beide
-- gewinnen — das `update` nimmt die Zeilensperre, der zweite sieht danach
-- `sent`.
--
-- *Verworfen — ein `unique`-Index auf `(profile_id, release_note_id)` in
-- `notifications`:* verlangte eine neue Spalte auf einer Tabelle, die acht
-- andere Typen teilen, nur fuer einen Fall, den der Zustandswechsel schon
-- ausschliesst. Und er verhinderte den doppelten Versand nicht, sondern machte
-- ihn still.
--
-- *Verworfen — die Pruefung im Knopf:* ein Knopf, der zweimal geklickt wird,
-- ist der Normalfall, nicht die Ausnahme.
--
-- ══ WARUM HIER KEIN PRAEDIKAT ABGESCHRIEBEN STEHT ══════════════════════════
-- Der Rundruf RUFT `hinweis_rundruf` (AGE-620) und damit dieselben
-- Bedingungen, die die Policies rufen: `is_activated_profile` fuer den
-- Empfaengerkreis, `hinweis_erwuenscht` fuer das Opt-out. Eine Abschrift haette
-- ein Verfallsdatum.
--
-- ══ WARUM DAS OPT-OUT AUF DIESEN TYP NICHT WIRKT ═══════════════════════════
-- `hinweis_erwuenscht` antwortet fuer einen Typ OHNE Schalter mit `true` —
-- „ein Opt-out wirkt nur, wo es ausgesprochen wurde". Fuer `release_note`
-- sprechen wir keines aus, und das ist Absicht: die vier bestehenden Schalter
-- schuetzen vor dem Laerm, den ANDERE MITGLIEDER machen, und der waechst mit
-- deren Zahl. Eine Release-Note ist eine Mitteilung ueber das Werkzeug selbst,
-- kommt selten und betrifft jeden, der es benutzt. Der Ausgleich ist nicht ein
-- Schalter, sondern die Auffindbarkeit: der Hinweis ist wegklickbar wie jeder
-- andere, und die Fläche `/neues` haelt ihn danach.
--
-- ══ WARUM KEIN DELETE ══════════════════════════════════════════════════════
-- Eine zugestellte Mitteilung soll nicht verschwinden koennen — die Hinweise
-- dazu stehen dann schon in 70 Postfaechern. Und ein Entwurf wird
-- ueberschrieben, nicht geloescht. Die Flaeche bleibt damit schmaler als ihr
-- Recht.
--
-- ══ GRANTS ═════════════════════════════════════════════════════════════════
-- Ausdruecklich ausgesprochen (AGE-312): seit den Default Privileges erbt eine
-- neue Tabelle NICHTS. Der Golden-Snapshot in grants_test.sql ist mitgepflegt.
--
-- Forward-only.

create table public.release_notes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  -- Die Verzeichnisnamen aus `openspec/changes/archive/`, die diese Note
  -- abdeckt. Sie sind der Schluessel, an dem die Admin-Flaeche erkennt, was
  -- noch nicht angekuendigt wurde.
  entry_slugs text[] not null default '{}',
  status      text not null default 'draft'
                check (status in ('draft', 'sent')),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  -- Wieviele Mitglieder die Note wirklich bekommen haben. Gezaehlt an den
  -- erzeugten Zeilen, nicht an den empfangsberechtigten Profilen: waere je
  -- eine Bedingung dazwischen, log die zweite Zahl.
  recipient_count integer
);
alter table public.release_notes enable row level security;

comment on table public.release_notes is
  'AGE-631: eine redigierte Mitteilung ueber Aenderungen an der Anwendung. '
  'Der Zustandswechsel draft→sent ist der Riegel gegen die Doppelzustellung '
  'und steht in send_release_note() VOR dem Fan-out.';

create index release_notes_sent_at_idx
  on public.release_notes (sent_at desc nulls last);

-- ── Policies ────────────────────────────────────────────────────────────────
-- Lesen: jedes aktivierte Mitglied sieht die ZUGESTELLTEN; ein Admin auch die
-- Entwuerfe. Ein Entwurf ist eine Absicht, keine Mitteilung.
create policy release_notes_read_sent on public.release_notes
  for select to authenticated
  using ( public.is_activated() and ( status = 'sent' or public.is_admin() ) );

-- Schreiben: nur Admins, und nur Entwuerfe. `status` selbst schreibt der
-- Client nie auf 'sent' — das tut allein die DEFINER-Funktion. Die
-- `with check`-Bedingung haelt das fest, statt sich auf die Oberflaeche zu
-- verlassen.
create policy release_notes_admin_draft on public.release_notes
  for insert to authenticated
  with check ( public.is_activated() and public.is_admin() and status = 'draft' );

create policy release_notes_admin_edit on public.release_notes
  for update to authenticated
  using  ( public.is_activated() and public.is_admin() and status = 'draft' )
  with check ( public.is_activated() and public.is_admin() and status = 'draft' );

grant select, insert, update on public.release_notes to authenticated;

-- ── Die Zustellung ──────────────────────────────────────────────────────────
create function public.send_release_note(p_id uuid)
  returns integer
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_title text;
  v_count integer;
begin
  -- `is_admin()` RUFEN, nicht sein Praedikat abschreiben: es prueft seit
  -- AGE-581 auch Aktivierung, Sperre und Loeschung.
  if not public.is_admin() then
    raise exception 'send_release_note: nicht berechtigt'
      using errcode = '42501';
  end if;

  -- DER RIEGEL. Bedingt, und vor jeder erzeugten Zeile.
  update public.release_notes
     set status = 'sent', sent_at = now()
   where id = p_id and status = 'draft'
  returning title into v_title;

  if not found then
    raise exception 'send_release_note: bereits zugestellt oder unbekannt (%)', p_id
      using errcode = '23505';
  end if;

  perform public.hinweis_rundruf(
    'release_note',
    null,
    jsonb_build_object('release_note_id', p_id, 'title', v_title)
  );

  -- An den ERZEUGTEN Zeilen gezaehlt, nicht an den empfangsberechtigten
  -- Profilen: die zweite Zahl waere eine Behauptung ueber den Rundruf statt
  -- einer Messung an ihm.
  select count(*)::int into v_count
    from public.notifications
   where type = 'release_note'
     and payload->>'release_note_id' = p_id::text;

  update public.release_notes set recipient_count = v_count where id = p_id;
  return v_count;
end $$;

comment on function public.send_release_note(uuid) is
  'AGE-631: stellt eine Release-Note genau EINMAL zu. Der bedingte '
  'Zustandswechsel steht vor dem Fan-out — trifft er keine Zeile, entsteht '
  'kein einziger Hinweis. Ruft hinweis_rundruf (AGE-620) und damit dieselben '
  'Empfaenger- und Opt-out-Bedingungen wie die uebrigen Typen.';

revoke execute on function public.send_release_note(uuid) from public, anon;
grant execute on function public.send_release_note(uuid) to authenticated;
