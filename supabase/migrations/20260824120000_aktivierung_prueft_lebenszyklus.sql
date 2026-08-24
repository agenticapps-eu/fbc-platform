-- ════════════════════════════════════════════════════════════════════════════
-- AGE-581 — die Aktivierungswege prüfen den Lebenszyklus
-- ════════════════════════════════════════════════════════════════════════════
--
-- Befund aus dem Diff-Review zu 11.5 (codex, 24.08.).
--
-- Der Change hat `disabled_at` und `deleted_at` eingeführt und überall dort
-- geprüft, wo GELESEN wird — im Verzeichnis, im Feed, in der Zustandsauskunft.
-- Die drei Wege, über die ein Konto AKTIVIERT wird, kennen die beiden Spalten
-- dagegen nicht: sie fragen ausschliesslich `activated_at`. Ein Admin konnte
-- damit eine gelöschte, nie bestätigte Person direkt aktivieren, und
-- `issue_activation_token` stellte für sie einen Zugangslink aus. Die einzige
-- Schranke war, dass die Oberfläche den Eintrag nicht anbietet — und die
-- Oberfläche ist in diesem Projekt ausdrücklich Komfort, nicht Sicherheit.
--
-- Das ist derselbe Fehlertyp wie bei `is_admin()` in AGE-537: eine Inventur
-- findet ein FALSCHES Gate, aber kein FEHLENDES. Beide Male stand die neue
-- Spalte in jedem Lesepfad und in keinem Schreibpfad.
--
-- ══ DREI STELLEN, WEIL ES DREI EINGÄNGE GIBT ═══════════════════════════════
--
-- 1. `mark_activated` — der INNERSTE. Sie setzt `activated_at` und wird von
--    beiden anderen gerufen, vom Admin-Weg wie vom Einlöseweg
--    (`redeem-activation` mit `service_role`). Der Wächter gehört hierher,
--    weil ein Gate, das nur in den Aufrufern steht, beim nächsten Aufrufer
--    fehlt. `redeem.ts:141` fängt den Fehler ab und antwortet `retry_needed`
--    — nicht die schönste Auskunft für ein dauerhaft gesperrtes Konto, aber
--    sie scheitert GESCHLOSSEN, und das ist die Eigenschaft, auf die es hier
--    ankommt.
--
-- 2. `admin_activate_member` — liest die beiden Spalten unter DERSELBEN
--    `for update`-Sperre wie `activated_at` und bricht mit `22023` ab. Die
--    Prüfung ist damit doppelt (1 fängt sie ohnehin), aber der Admin bekommt
--    den Grund genannt statt eines Fehlers aus einer Funktion, die er nicht
--    gerufen hat. Kein zweites `select`: ein zweiter Lesevorgang entschiede
--    auf einem Stand, den das Schreiben nicht mehr vorfindet.
--
-- 3. `issue_activation_token` — gibt für ein entferntes Konto GAR KEIN Token
--    aus. Der neue Status heisst `blocked`; nach aussen ist er von `unknown`
--    ununterscheidbar (`send-activation` antwortet in beiden Fällen 202, siehe
--    `status.ts`), im Protokoll steht aber der wahre Grund. Ein eigener
--    Ausgang nach aussen wäre genau das Orakel für Mitgliedsadressen, das die
--    ganze Konstruktion verhindert.
--
--    Der Wächter steht VOR der Rate-Limit-Prüfung und vor dem Entwerten
--    offener Token: eine gesperrte Adresse soll die Zähler eines fremden
--    Kontos nicht bewegen können.
--
-- ══ WAS HIER NICHT PASSIERT ════════════════════════════════════════════════
-- Offene Token werden beim Deaktivieren NICHT nachträglich entwertet. Sie
-- laufen ins Leere, weil Stelle 1 die Einlösung verweigert; ein Aufräumen wäre
-- Hygiene, keine Schranke, und es gehörte in `admin_disable_member` statt
-- hierher.
--
-- Forward-only.

-- ── 1. mark_activated ──────────────────────────────────────────────────────

create or replace function public.mark_activated(p_profile_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_zeit timestamptz;
begin
  -- Der Wächter, und zwar VOR dem `update`: ein `where`-Zusatz am `update`
  -- liesse die Funktion still `null` zurückgeben, und `null` heisst bei ihr
  -- bisher „Profil gibt es nicht". Zwei Sachverhalte auf einen Rückgabewert zu
  -- legen ist genau die Sorte Ersparnis, die später als Fehlersuche zurückkommt.
  if exists (select 1
               from public.profiles p
              where p.id = p_profile_id
                and (p.disabled_at is not null or p.deleted_at is not null)) then
    raise exception 'Profil % ist entfernt und kann nicht aktiviert werden', p_profile_id
      using errcode = '22023';
  end if;

  update public.profiles
     set activated_at = coalesce(activated_at, now())
   where id = p_profile_id
  returning activated_at into v_zeit;
  return v_zeit;
end;
$$;

-- Der Kommentar wird FORTGESCHRIEBEN, nicht ersetzt. Die Warnung aus AGE-505
-- (Befund 8.6) steht seit 20260808180000 darin und wird von einer pgTAP-Zusage
-- an der Zeichenkette „Re-Aktivierer" festgehalten; eine Neufassung, die sie
-- weglässt, ist rot — und zwar zu Recht, denn genau diese Datei baut den
-- Lebenszyklus aus, vor dem die Warnung warnt.
comment on function public.mark_activated(uuid) is
  'Setzt profiles.activated_at (AGE-495). Idempotent: ein zweiter Aufruf '
  'ueberschreibt den Zeitpunkt nicht. Der LETZTE Schritt der Einloesung — er '
  'oeffnet das Gate, deshalb steht er hinter Passwort und Sitzungswiderruf. '
  'Nur service_role; kein Client darf sich selbst aktivieren. '
  'Verweigert seit AGE-581 die Aktivierung eines ENTFERNTEN Profils '
  '(disabled_at oder deleted_at gesetzt) mit 22023 — der Waechter steht HIER, '
  'weil beide Aufrufer, der Admin-Weg und der Einloeseweg mit service_role, '
  'durch diese Funktion gehen. '
  'WARNUNG (AGE-505, Befund 8.6): activated_at hat GENAU EINEN Schreiber, und '
  'issue_activation_token leitet den Zweck eines Tokens daraus ab — steht ein '
  'Zeitpunkt, ist das naechste Token ein Passwort-Reset, sonst eine '
  'Aktivierung. Wer eine Sperr- oder Deaktivierungsfunktion baut, die '
  'activated_at auf null zuruecksetzt, macht damit jedes ausstehende '
  'Reset-Token zum Re-Aktivierer. Dann muss der Zweck gespeichert werden, '
  'statt abgeleitet zu werden. Genau deshalb setzt AGE-581 activated_at NICHT '
  'zurueck, sondern fuehrt disabled_at und deleted_at daneben.';

-- ── 2. admin_activate_member ───────────────────────────────────────────────

create or replace function public.admin_activate_member(target uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_zeit       timestamptz;
  v_deaktiviert timestamptz;
  v_geloescht   timestamptz;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin_activate_member' using errcode = '42501';
  end if;

  -- `for update` und nicht bloss `select`: ohne die Sperre lesen zwei
  -- gleichzeitige Aufrufe beide `null` und schreiben beide eine Auditzeile.
  -- Siehe Befund 1 im Kopf von 20260817140000 — gemessen, nicht vermutet.
  -- Die beiden Lebenszyklus-Spalten kommen aus DERSELBEN Zeile und derselben
  -- Sperre; ein zweites `select` entschiede auf einem anderen Stand.
  select p.activated_at, p.disabled_at, p.deleted_at
    into v_zeit, v_deaktiviert, v_geloescht
    from public.profiles p where p.id = target
     for update;
  if not found then
    raise exception 'Profil % existiert nicht', target using errcode = 'P0002';
  end if;
  if v_geloescht is not null then
    raise exception 'Profil % ist geloescht', target using errcode = '22023';
  end if;
  if v_deaktiviert is not null then
    raise exception 'Profil % ist deaktiviert', target using errcode = '22023';
  end if;
  if v_zeit is not null then
    raise exception 'Profil % ist bereits bestaetigt', target using errcode = '22023';
  end if;

  v_zeit := public.mark_activated(target);

  insert into public.admin_audit (actor, action, target)
  values ((select auth.uid()), 'activate_member', target);

  return v_zeit;
end $$;

comment on function public.admin_activate_member(uuid) is
  'Aktiviert ein fremdes Profil und schreibt in DERSELBEN Transaktion nach '
  'admin_audit (AGE-566). Liest die Zielzeile MIT for update: ohne die Sperre '
  'kamen zwei gleichzeitige Aufrufe beide an der 22023-Pruefung vorbei und '
  'schrieben zwei Spuren fuer eine Aenderung (gemessen 17.08.). Bricht mit '
  '22023 ab, wenn das Ziel schon bestaetigt, deaktiviert oder geloescht ist — '
  'die beiden Lebenszyklus-Faelle seit AGE-581, genannt statt verschwiegen, '
  'damit der Admin den Grund erfaehrt. Steht NEBEN mark_activated, die '
  'bewusst ohne Admin-Pruefung bleibt (Einloeseweg von redeem-activation mit '
  'service_role) und denselben Waechter noch einmal traegt.';

-- ── 3. issue_activation_token ──────────────────────────────────────────────

create or replace function public.issue_activation_token(
  p_email      text,
  p_token_hash text,
  p_ttl        interval default interval '72 hours'
) returns table (status text, profile_id uuid, display_name text, login_email text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id        uuid;
  v_name      text;
  v_activated timestamptz;
  v_email     text;
  v_entfernt  boolean;
  v_letzte    timestamptz;
  v_tag_zahl  int;
  v_offen     timestamptz;
  v_constraint text;
begin
  select p.id, p.name, p.activated_at, u.email,
         (p.disabled_at is not null or p.deleted_at is not null)
    into v_id, v_name, v_activated, v_email, v_entfernt
    from public.profiles p
    join auth.users u on u.id = p.id
   where lower(u.email) = lower(trim(p_email))
   for update of p;  -- AGE-507: serialisiert nebenlaeufige Anforderungen fuer
                     -- DIESES Profil. Steht VOR jeder Pruefung, weil eine
                     -- Pruefung sonst auf einem Stand entscheidet, den das
                     -- Schreiben nicht mehr vorfindet. `of p`: die
                     -- auth.users-Zeile gehoert uns nicht. Siehe Kopf.

  if not found then
    return query select 'unknown'::text, null::uuid, null::text, null::text;
    return;
  end if;

  -- AGE-581: ein entferntes Konto bekommt keinen Zugangslink. VOR den
  -- Rate-Limits, damit eine gesperrte Adresse die Zaehler nicht bewegt.
  if v_entfernt then
    return query select 'blocked'::text, v_id, v_name, v_email;
    return;
  end if;

  select max(created_at), count(*) filter (where created_at > now() - interval '24 hours')
    into v_letzte, v_tag_zahl
    from public.activation_tokens t
   where t.profile_id = v_id;

  if v_letzte is not null and v_letzte > now() - interval '60 seconds' then
    return query select 'rate_limited'::text, v_id, v_name, v_email;
    return;
  end if;

  -- Das Schutzfenster. Liegt ein noch gueltiger, unbenutzter Link im Postfach,
  -- passiert hier NICHTS: kein Entwerten, kein neues Token, kein Versand. Das
  -- ist der ganze Unterschied zwischen „ein Fremder nervt" und „ein Fremder
  -- sperrt mich aus" — und es gilt fuer den Reset-Link genauso.
  select max(created_at)
    into v_offen
    from public.activation_tokens t
   where t.profile_id = v_id
     and t.used_at is null
     and t.invalidated_at is null
     and t.expires_at > now();

  if v_offen is not null and v_offen > now() - interval '24 hours' then
    return query select 'pending'::text, v_id, v_name, v_email;
    return;
  end if;

  if v_tag_zahl >= 5 then
    return query select 'rate_limited_day'::text, v_id, v_name, v_email;
    return;
  end if;

  update public.activation_tokens
     set invalidated_at = now()
   where activation_tokens.profile_id = v_id
     and used_at is null and invalidated_at is null;

  -- Der Waechter wird beim NAMEN genannt, nicht ueber den Fehlercode: eine
  -- Verletzung des Primaerschluessels (`token_hash` doppelt — eine kaputte
  -- Token-Erzeugung) traegt denselben SQLSTATE 23505 und muss weiter WERFEN.
  -- Siehe Kopf von 20260808200000.
  --
  -- `on conflict` waere die kuerzere Schreibweise, geht hier aber nicht: die
  -- Inferenz-Klausel darf nicht qualifiziert werden, und `profile_id` ist
  -- zugleich OUT-Parameter dieser Function — Postgres meldet die Spalte als
  -- mehrdeutig. Gemessen am 08.08. gegen die lokale Instanz.
  begin
    insert into public.activation_tokens (token_hash, profile_id, expires_at)
    values (p_token_hash, v_id, now() + p_ttl);
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint is distinct from 'activation_tokens_offen_je_profil' then
        raise;
      end if;
      -- Eine gleichzeitige Anfrage war schneller: es liegt ein committetes,
      -- offenes Token fuer dieses Profil vor. Das ist die Lage, die `pending`
      -- beschreibt — nichts versenden, nichts anlegen. NICHT gelesen werden
      -- darf es als „eine Mail ist unterwegs".
      return query select 'pending'::text, v_id, v_name, v_email;
      return;
  end;

  -- Der Zweck, erst jetzt und allein aus dem Kontostand abgeleitet. Ein
  -- aktiviertes Konto hat nichts zu aktivieren — was es anfordert, kann nur
  -- ein Passwort-Reset sein.
  if v_activated is not null then
    return query select 'issued_reset'::text, v_id, v_name, v_email;
    return;
  end if;

  return query select 'issued'::text, v_id, v_name, v_email;
end;
$$;

comment on function public.issue_activation_token(text, text, interval) is
  'Stellt ein Aktivierungs- oder Reset-Token aus. Status: unknown, blocked, '
  'rate_limited, pending, rate_limited_day, issued, issued_reset — wer hier '
  'einen ergaenzt, muss die Erlaubnisliste in send-activation/status.ts '
  'nachziehen, sonst meldet die Function ihn als unerwartet. `blocked` ist '
  'AGE-581: ein deaktiviertes oder geloeschtes Konto bekommt keinen Link, und '
  'die Pruefung steht VOR den Rate-Limits, damit eine gesperrte Adresse die '
  'Zaehler nicht bewegt. Nach aussen ist blocked von unknown nicht zu '
  'unterscheiden (beide 202) — ein eigener Ausgang waere ein Orakel fuer '
  'Mitgliedsadressen.';
