-- OTA, Teil 2: der Schreibweg (AGE-642, Phase D1, dritter Punkt).
-- Donald, 2026-08-31. Spec: openspec/changes/capacitor-huelle/, Entwurf §8.
--
-- Teil 1 (20260831100000) legte Bucket und Manifest an und liess beides
-- ABSICHTLICH ohne Zugriffsweg: RLS an, keine Policy, kein Grant. Diese
-- Migration reicht die eine Tür nach, die der Veröffentlichungs-Schritt in
-- `deploy.yml` braucht — und nur die.
--
-- ══ WARUM EINE FUNKTION UND KEIN GRANT AUF DIE TABELLE ══════════════════════
-- Der naheliegende Weg wäre `grant insert, update on public.ota_buendel to
-- service_role`. Er ist verworfen, aus zwei Gründen:
--
-- 1. **Das Repo macht es nirgends so.** `service_role` hält in `public` auf
--    keiner Tabelle ein Recht (AGE-312); jeder serverseitige Schreibzugriff
--    läuft über eine `security definer`-Funktion, die einzeln freigegeben ist —
--    `issue_activation_token`, `claim_activation_token`, `mark_activated`,
--    `apply_upgrade`. Eine Ausnahme hier wäre die erste, und sie stünde in
--    keinem Test.
-- 2. **Die Funktion ist die engere Tür.** Ein Tabellen-Grant erlaubte auch
--    `delete` und ein `update` auf eine beliebige Spalte einer beliebigen
--    Zeile. Diese Funktion kann genau eines: eine Fassung eintragen oder
--    dieselbe Fassung ersetzen.
--
-- ══ UPSERT, NICHT INSERT ════════════════════════════════════════════════════
-- Ein erneuter Lauf desselben Jobs auf demselben Commit erzeugt dieselbe
-- Fassung (`<Semver>+<SHA>`) — ein `insert` schlüge dort fehl und machte einen
-- harmlosen Re-Run rot. Er erzeugt aber ein NEUES Chiffrat, weil der
-- AES-Schlüssel je Lauf zufällig ist; deshalb müssen `url`, `checksum` und
-- `session_key` gemeinsam mitwandern. Genau das tut das `do update`.
--
-- Die Bedingungen an den Spalten (Teil 1) gelten hier unverändert: die Funktion
-- umgeht die RLS, nicht die CHECKs. Ein Chiffrat aus einem 4096-Bit-Schlüssel
-- wird auch auf diesem Weg abgewiesen.
--
-- Forward-only.

create or replace function public.ota_buendel_veroeffentlichen(
  p_version           text,
  p_url               text,
  p_checksum          text,
  p_session_key       text,
  p_benoetigte_schale text
) returns void
  language sql
  security definer
  set search_path = ''
as $$
  insert into public.ota_buendel
    (version, url, checksum, session_key, benoetigte_schale)
  values
    (p_version, p_url, p_checksum, p_session_key, p_benoetigte_schale)
  on conflict (version) do update
    set url               = excluded.url,
        checksum          = excluded.checksum,
        session_key       = excluded.session_key,
        benoetigte_schale = excluded.benoetigte_schale;
$$;

comment on function public.ota_buendel_veroeffentlichen(text, text, text, text, text) is
  'Traegt ein veroeffentlichtes Buendel ins Manifest ein (AGE-642). Einziger '
  'Schreibweg auf public.ota_buendel; die Tabelle traegt selbst keinen Grant. '
  'Nur fuer service_role, aufgerufen aus dem Veroeffentlichungs-Schritt in '
  'deploy.yml. Ersetzt eine bestehende Fassung vollstaendig, damit ein Re-Run '
  'desselben Commits nicht fehlschlaegt — er erzeugt ein neues Chiffrat und '
  'damit auch neue checksum und session_key.';

-- Beide Zeilen nennen JEDE Rolle. Ein `revoke … from public` allein wirkt auf
-- einer frisch angelegten Instanz nicht: dort werden Rechte rollen-eigen
-- vergeben, und `anon` behielte seines. Das hat am 27.08. `main` rot gemacht
-- (AGE-622, 20260827070000). Und `alter default privileges … revoke execute`
-- waere hier ein No-op, der wie Schutz aussieht (AGE-602).
revoke execute on function
  public.ota_buendel_veroeffentlichen(text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant  execute on function
  public.ota_buendel_veroeffentlichen(text, text, text, text, text)
  to service_role;
