-- ════════════════════════════════════════════════════════════════════════════
-- AGE-623 — die Mail-Auskunft für Kontaktanfragen als DEFINER-RPC
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/notify-contact-request-definer-rpcs/.
-- Gefunden beim Planen von AGE-622, bestätigt von zwei Plan-Reviewern.
--
-- ══ DER BEFUND ═════════════════════════════════════════════════════════════
-- `notify-contact-request` baut seinen Client mit dem Dienstschlüssel
-- (`index.ts:91-94`) und liest damit DIREKT drei Tabellen in `public`:
-- `profile_contacts`, `profiles` und `contact_requests`. Das ist kein Nebenweg,
-- sondern die Sicherheitsprüfung: das gemeinsame Geheimnis belegt, dass der
-- AUFRUF vom Webhook kam, nicht dass die ZEILE existiert.
--
-- Dass dieser Zugriff gelingt, entscheidet die INSTANZ und nicht dieses
-- Repository. Gemessen am 27.08.:
--
--   * Keine wirksame `grant`-Anweisung im Migrationsbaum erteilt `service_role`
--     ein Tabellenrecht. Der einzige Grep-Treffer ist ein Kommentar, der genau
--     das verwirft (20260811090300:347).
--   * Trotzdem liest `service_role` lokal 35 von 36 Tabellen in `public`. Die
--     eine Ausnahme ist `staff_roles` — die Tabelle, für die eine Migration den
--     Entzug ausspricht. Instanzseitig erteilt heisst also: überall, ausser wo
--     jemand widerspricht.
--
-- ══ EINE MESSUNG, DIE SICH SEIT AGE-622 GEDREHT HAT ════════════════════════
-- Der Kopf von 20260827070000 (AGE-622) hält fest, lokal halte `service_role`
-- auf 0 von 36 Tabellen ein Recht, PROD dagegen sei die grosszügige Sorte.
-- Heute misst derselbe Stack 35 von 36. Beide Messungen waren zu ihrer Zeit
-- richtig — ausgetauscht wurde der DATENTRÄGER, und genau das sagt jener Kopf
-- selbst voraus („sein Datenträger stammt aus einer älteren Abbildung").
--
-- Das ist der eigentliche Grund für diese Migration: eine Eigenschaft, die
-- niemand hier entschieden hat, hat sich unbemerkt gedreht, und der Mailweg
-- stand darauf.
--
-- ══ ZWEI ENTSCHEIDUNGEN, DIE DIE PLAN-REVIEW ERZWUNGEN HAT ═════════════════
--
-- 1. DIE BINDUNG GILT UNGEORDNET. Empfänger und Gegenüber tauschen je nach
--    Ereignis die Rollen: bei einer neuen Anfrage ist `to_id` der Empfänger,
--    bei Zusage und Absage `from_id` (emails.ts:53 gegen :61,64). Ein nach
--    from/to GEORDNETES Prädikat wäre für den ersten Fall grün gewesen und
--    hätte still jede Zusage- und Absage-Mail verworfen.
--
--    VERWORFEN: `array[…] <@ array[…]` in beide Richtungen. Kürzer, aber die
--    Absicht ist aus zwei Enthaltenseins-Prüfungen nicht mehr abzulesen, und
--    der Selbstbezugsfall (Empfänger = Gegenüber) verhält sich dort nur
--    zufällig richtig. Die ausgeschriebene Oder-Verknüpfung sagt, was gemeint
--    ist.
--
-- 2. `left join`, NICHT `join`. Fehlt die Adresszeile oder der Anzeigename,
--    kommt die Zeile TROTZDEM, nur mit leerem Feld. Ein innerer Verbund machte
--    aus „keine Adresse hinterlegt" eine leere Menge — und der Aufrufer daraus
--    `409 record_mismatch` statt des heutigen `200 skipped: no_email`. Der
--    Umbau soll den Lesekanal tauschen, nicht das Verhalten.
--
-- ══ WAS HIER NICHT PASSIERT ════════════════════════════════════════════════
-- Der flächendeckende `service_role`-Entzug bleibt aussen vor. Er setzt eine
-- Inventur aller acht Edge Functions voraus; ein Entzug, der eine davon bricht,
-- wäre genau der Fehler, den AGE-622 vermieden hat, als es ihn herausnahm.
-- Ebenso bleibt der Lebenszyklus der Beteiligten (`disabled_at`/`deleted_at`)
-- ungeprüft — das ist ein bestehender Befund, den dieser Change weder einführt
-- noch behebt.
--
-- Forward-only.

create or replace function public.notify_contact_request_daten(
  p_request_id   uuid,
  p_recipient_id uuid,
  p_other_id     uuid
) returns table (
  id              uuid,
  from_id         uuid,
  to_id           uuid,
  status          text,
  message         text,
  recipient_email text,
  other_name      text
)
language sql
stable
security definer
set search_path = ''
as $$
  -- `cr.id` kommt aus der ZEILE, nicht aus dem Parameter zurueck. Der Aufrufer
  -- vergleicht sie in `passtZurDatenbank`; gaebe die Auskunft hier den
  -- Eingabewert durch, bestaetigte die Pruefung nur sich selbst.
  select cr.id,
         cr.from_id,
         cr.to_id,
         cr.status::text,
         cr.message,
         pc.email,
         po.name
    from public.contact_requests cr
    -- Die Adresse gehört der ALS EMPFÄNGER übergebenen Kennung. Sie am Verbund
    -- festzumachen statt an `cr.to_id` ist der Grund, warum ein Vertauschen der
    -- beiden Parameter nicht die Adresse des jeweils anderen zieht.
    left join public.profile_contacts pc on pc.profile_id = p_recipient_id
    left join public.profiles po on po.id = p_other_id
   where cr.id = p_request_id
     and (
       (p_recipient_id = cr.to_id   and p_other_id = cr.from_id) or
       (p_recipient_id = cr.from_id and p_other_id = cr.to_id)
     );
$$;

comment on function public.notify_contact_request_daten(uuid, uuid, uuid) is
  'Liefert einer Edge Function alles, was sie fuer eine Kontaktanfrage-Mail '
  'braucht: die Zeile, die Zustelladresse des Empfaengers und den Namen des '
  'Gegenuebers (AGE-623). Ersetzt drei direkte Tabellenzugriffe unter dem '
  'Dienstschluessel, die auf einer Instanz-Eigenschaft standen, die kein '
  'Migrationsstand ausspricht. DIE BINDUNG GILT UNGEORDNET: Empfaenger und '
  'Gegenueber tauschen je nach Ereignis die Rollen, ein geordnetes Praedikat '
  'verwuerfe jede Zusage- und Absage-Mail. LEFT JOIN ist Absicht: eine '
  'fehlende Adresse muss von einer verletzten Bindung unterscheidbar bleiben, '
  'sonst wird aus 200 skipped ein 409.';

-- Rechte. JEDE Rolle namentlich (AGE-622): `revoke … from public` allein
-- entfernt einen rollen-eigenen Grant nicht, und welche Default Privileges eine
-- Instanz mitbringt, haengt von ihrem Anlagedatum ab. Bei FUNKTIONEN erteilt
-- Postgres `execute` ausserdem von sich aus an `PUBLIC` — ohne den Entzug waere
-- diese Auskunft fuer jeden ausfuehrbar.
revoke execute on function public.notify_contact_request_daten(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.notify_contact_request_daten(uuid, uuid, uuid)
  to service_role;
