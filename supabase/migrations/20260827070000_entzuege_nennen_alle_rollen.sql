-- AGE-622 — ein Entzug muss JEDE Rolle nennen, nicht die, an die man denkt.
-- Donald, 2026-08-27. Change: openspec/changes/entzuege-nennen-alle-rollen/.
--
-- ══ BEFUND ══════════════════════════════════════════════════════════════════
-- `main` wurde rot, ohne dass sich eine Zeile geaendert hatte. Belegt:
-- Commit 5d911b9 war am 26.08. um 19:47 gruen; DERSELBE Commit, am 27.08. neu
-- gestartet, laesst `migrations` fallen. Vier pgTAP-Zusagen, alle in der Form
-- `have: true, want: false` — ein Entzug, der nicht gewirkt hat:
--
--   grants_test.sql            7  „genau diese sechs Funktionen darf anon"
--   grants_test.sql            8  „Gegenprobe A: ein Entzug wird gemessen"
--   rls_test.sql             261  „service_role liest staff_roles NICHT direkt"
--   admin_member_list_test.sql 73 „member_state_matches: auch authenticated nicht"
--
-- Ausgeloest hat es die Umgebung: `.github/workflows/ci.yml` zog die
-- Supabase-CLI als `version: latest`. Eine frisch angelegte Instanz vergibt
-- Rechte ROLLEN-EIGEN statt ueber die Pseudo-Rolle `public`.
--
-- ══ DIE UMGEBUNG IST NICHT ABGEWICHEN — SIE IST PROD AEHNLICHER GEWORDEN ════
-- AGE-602 hat am 26.08. am PROD-KATALOG gemessen
-- (20260826090000_anon_execute_namentlich_entziehen.sql, Kopf):
--
--   proacl in PROD = {postgres=X/postgres,anon=X/postgres,
--                     authenticated=X/postgres,service_role=X/postgres}
--
-- PROD ist also selbst die grosszuegige Sorte. Der lokale Stack ist die
-- Ausnahme — sein Datentraeger stammt aus einer aelteren Abbildung, und dort
-- haelt `service_role` auf 0 von 36 Tabellen ein Recht. Ein gruener lokaler
-- Lauf sagt ueber PROD deshalb NICHTS. Genau das hat AGE-602 schon einmal zwei
-- Monate verdeckt.
--
-- ══ WARUM ES DREI STELLEN SIND ══════════════════════════════════════════════
-- AGE-602 hat die Regel am 26.08. um 09:00 aufgestellt und elf Funktionen
-- geradegezogen. `resolve_display_name` entstand am selben Tag um 11:00 — zwei
-- Stunden SPAETER — und wiederholt den Fehler, den die Migration davor
-- beschreibt. Die Regel stand da schon, im Kopf derselben Datei.
--
--   resolve_display_name   `from public`         -> anon, service_role bleiben
--   member_state_matches   `from public, anon`   -> authenticated, service_role
--   staff_roles            gar kein Entzug       -> service_role
--
-- ══ KEIN DATENABFLUSS, UND DAS IST GEMESSEN STATT GEHOFFT ═══════════════════
-- `resolve_display_name` ist `security invoker`, liest KEINE Tabelle und
-- bekommt den Namen als Argument. Ein `anon`-Aufruf gibt die Maske zurueck oder
-- den Namen, den der Aufrufer selbst hineingereicht hat. Dasselbe Muster wie
-- `array_jaccard` in AGE-602: preisgegeben wird nichts, verletzt ist die
-- abgeschlossene Liste.
-- `member_state_matches` rechnet ebenfalls nur ueber seine Argumente.
-- `staff_roles` liest keine Flaeche als `service_role` — beide Admin-Functions
-- halten das ausdruecklich fest (admin-change-email/index.ts:94,
-- admin-set-member-ban/index.ts:36).
--
-- ══ WAS HIER BEWUSST NICHT STEHT ════════════════════════════════════════════
-- 1. KEIN flaechendeckender `revoke ... from service_role` auf alle Tabellen.
--    Der erste Entwurf wollte das, gestuetzt auf rls_test.sql:1866
--    („alles, was service_role tut, geht durch SECURITY-DEFINER-Funktionen").
--    Der Satz ist FALSCH: notify-contact-request/index.ts:91-111 baut seinen
--    Client mit SUPABASE_SERVICE_ROLE_KEY und liest damit direkt
--    profile_contacts, profiles und contact_requests — als Sicherheitspruefung,
--    vor dem Mailversand. Da PROD `service_role` bedient, steht dieser Mailweg
--    heute genau darauf. Ein flaechendeckender Entzug haette ihn gebrochen,
--    Tage vor dem Go-Live. Beide Plan-Reviewer fanden das unabhaengig.
--    -> AGE-623.
-- 2. KEIN `alter default privileges`. Fuer FUNKTIONEN ist es nachweislich
--    wirkungslos (AGE-602 hat drei Varianten gemessen). Fuer TABELLEN wirkt es,
--    gehoert aber zur selben Frage wie Punkt 1 und damit ebenfalls nach AGE-623.
--
-- ══ VERWORFEN ═══════════════════════════════════════════════════════════════
-- Die CLI wieder auf die ALTE Sorte zu pinnen. Das haette `main` in einer
-- Minute gruen gemacht — und die Zusagen dauerhaft blind gestellt, gegen genau
-- die Instanz-Sorte, die PROD IST. Ein gruener Haken, der die Produktion nicht
-- mehr abbildet, ist schlimmer als ein roter.

-- ── 1. resolve_display_name ─────────────────────────────────────────────────
-- Bleibt fuer `authenticated` ausfuehrbar; alles andere faellt weg. Die
-- Funktion steht deshalb NICHT in der abgeschlossenen anon-Liste von
-- grants_test.sql, und genau das ist die Zusage, die heute faellt.
revoke execute on function public.resolve_display_name(uuid, text)
  from public, anon, authenticated, service_role;
grant  execute on function public.resolve_display_name(uuid, text)
  to authenticated;

-- ── 2. member_state_matches ─────────────────────────────────────────────────
-- Keine Flaeche, sondern eine Bedingung: alle drei Aufrufer
-- (admin_list_members zweimal, admin_member_counts) sind `security definer` und
-- laufen als Eigentuemer — nachgezaehlt, nicht angenommen. Kein Client-Recht
-- noetig, also auch keines zurueckgegeben.
revoke execute on function
  public.member_state_matches(text, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;

-- ── 3. staff_roles ──────────────────────────────────────────────────────────
-- `revoke all` und dann genau das eine Recht zurueck, das der Golden-Snapshot
-- fuehrt (grants_test.sql:76 `staff_roles/authenticated=SELECT`). Auf PROD ist
-- das KEIN No-op — dort haelt `service_role` heute ein Recht, das hier faellt.
revoke all on public.staff_roles
  from public, anon, authenticated, service_role;
grant select on public.staff_roles to authenticated;
