-- AGE-628 — Die Themenliste des Feedbacks als Tabelle.
--
-- Aufgaben 1.2 und 1.3 aus openspec/changes/feedback-ausbauen/tasks.md.
-- Die scheiternde Zusage dazu steht seit 1.1 in
-- supabase/tests/feedback_themes_test.sql (16 Zusagen, alle rot).
--
-- ══ TABELLE STATT `CHECK` ODER `enum` ══════════════════════════════════════
-- Ein `CHECK` mit Textliteralen ist für die Datenbank eine Menge, für die
-- Oberfläche aber nichts — sie kann ihn nicht lesen. Die Liste stünde ein
-- zweites Mal in TypeScript, samt Beschriftung und Reihenfolge, und nichts
-- würde die beiden Abschriften vergleichen. Ein `enum` ist noch enger: keine
-- Beschriftung, keine Reihenfolge, und ein neues Thema wäre eine Migration
-- UND ein Deploy. Als Tabelle ist ein neues Thema ein `insert`.
-- (design.md, Entscheidung 1.)
--
-- ══ RLS OHNE POLICY IST DER GEFÄHRLICHE ZUSTAND ════════════════════════════
-- `enable row level security` allein liefert der Oberfläche eine LEERE Liste,
-- und das Fehlerbild sieht aus wie „es gibt keine Themen" — nicht wie ein
-- Rechtefehler. Policy und `grant` stehen deshalb hier, in derselben
-- Migration wie das `enable`, und nicht in einer späteren.
--
-- ══ WARUM NUR `authenticated`, OHNE `anon` ═════════════════════════════════
-- Das Vorbild für eine kleine Nachschlagetabelle wäre `membership_tiers`: die
-- grantet `select` an anon UND authenticated (Policy `tiers_read_all`), weil
-- die Stufen schon vor der Anmeldung gebraucht werden.
--
-- Hier gilt das nicht. Die Themen werden ausschliesslich im Feedback-Formular
-- gebraucht, und das liegt hinter der Anmeldung. Die Schwestertabelle
-- entscheidet es genauso: `grants_test.sql` führt `feedback/authenticated=…`
-- und KEINE anon-Zeile. `anon` bekommt hier deshalb nichts — weder Policy noch
-- `grant`. Wer das später öffnet, ändert damit den Golden-Snapshot und muss es
-- begründen.
--
-- ══ NEUE TABELLEN ERBEN HIER NICHTS ════════════════════════════════════════
-- Die Default Privileges dieses Projekts decken neue Tabellen nicht ab. Ohne
-- das ausgesprochene `grant select` unten scheitert der Lesezugriff zur
-- Laufzeit, obwohl die Policy passt — ein Fehlerbild, das lange nach einem
-- Policy-Fehler aussieht.

create table if not exists public.feedback_themes (
  key   text    primary key,
  label text    not null,
  sort  integer not null
);

comment on table public.feedback_themes is
  'Themen des Mitglieder-Feedbacks (AGE-628). Daten statt CHECK/enum, damit die '
  'Oberfläche Beschriftung und Reihenfolge LESEN kann, statt sie abzuschreiben. '
  'Ein neues Thema ist ein insert, kein Deploy.';

comment on column public.feedback_themes.sort is
  'Anzeigereihenfolge im Formular. Nicht der Primärschlüssel und nicht stabil '
  'gegenüber späteren Einschüben — allein zum Sortieren da.';

alter table public.feedback_themes enable row level security;

-- Lesen darf jedes angemeldete Konto. Bewusst OHNE `is_activated()`: die
-- Themenliste ist keine Mitgliederdatenfläche, und ein noch nicht aktiviertes
-- Konto, das das Formular sieht, soll darin keine leere Auswahl vorfinden.
drop policy if exists feedback_themes_read on public.feedback_themes;
create policy feedback_themes_read on public.feedback_themes
  for select to authenticated
  using (true);

grant select on public.feedback_themes to authenticated;

-- ── Die fünf Themen (Aufgabe 1.3) ───────────────────────────────────────────
-- `on conflict do update` und nicht `do nothing`: eine bereits vorhandene, aber
-- falsch beschriftete Zeile bliebe sonst konserviert, und der Test liefe grün
-- dagegen. Wiederholbar ist die Migration in beiden Fassungen.
insert into public.feedback_themes (key, label, sort) values
  ('generell',  'Generell',                     1),
  ('fehler',    'Fehler / etwas geht nicht',    2),
  ('bedienung', 'Bedienung / Verständlichkeit', 3),
  ('inhalte',   'Inhalte / Texte',              4),
  ('idee',      'Idee / Wunsch',                5)
on conflict (key) do update
  set label = excluded.label,
      sort  = excluded.sort;
