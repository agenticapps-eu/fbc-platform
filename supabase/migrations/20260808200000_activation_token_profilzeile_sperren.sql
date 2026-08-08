-- Die Grenzen der Token-Ausgabe halten auch unter Nebenlaeufigkeit (AGE-507) —
-- Befund 8.8 aus Review 5.4 zum AGE-505-Diff.
--
-- ── Der Befund ─────────────────────────────────────────────────────────────
-- Beide ausgebenden RPCs pruefen erst und schreiben dann. Unter `read
-- committed` nimmt JEDE Anweisung einen frischen Snapshot. Zwei gleichzeitige
-- Anforderungen passieren deshalb beide die Schutzfenster-Abfrage, solange
-- keine von beiden geschrieben hat — und die zweite entwertet danach das
-- Token, das die erste soeben angelegt hat. Zwei Mails, nur der zweite Link
-- gilt. Das ist genau das Gegenteil dessen, was das Schutzfenster verspricht.
--
-- Vorbestehend seit AGE-495; der `update`-dann-`insert`-Pfad steht seitdem
-- unveraendert. Gemessen, nicht hergeleitet, gegen den ungeaenderten Stand
-- (scripts/probe-wettlauf-token-ausgabe.ts, Szenario S1):
--
--   A (Kopie) = issued · B (Original) = issued
--   zz-probe-s1-TB: ENTWERTET (waehrend des Laufs entstanden)
--
-- ── Der Riegel ─────────────────────────────────────────────────────────────
-- `for update of p` an der ERSTEN Abfrage beider Functions. Damit steht die
-- Pruefung nicht mehr auf einem Snapshot, der zwischen Pruefung und Schreiben
-- veraltet: die zweite Anforderung wartet, BEVOR sie irgendetwas prueft, und
-- entscheidet danach auf dem committeten Stand der ersten.
--
-- WARUM AUF `profiles` UND NICHT AUF `activation_tokens`. Die Zeile, um die
-- die beiden Aufrufe streiten, ist das PROFIL — das Token, das sie sich
-- streitig machen, existiert zum Zeitpunkt der Pruefung noch gar nicht. Eine
-- Sperre auf einer Zeile, die es noch nicht gibt, gibt es nicht.
--
-- WARUM `of p` UND NICHT NACKTES `for update`. Beide Abfragen joinen
-- `public.profiles` auf `auth.users`. Ein nacktes `for update` sperrte auch
-- die Auth-Zeile, deren Schreiber (GoTrue) uns nicht gehoeren und deren
-- Sperrverhalten wir nicht kennen. Praezedenzfall im Repo:
-- 20260716120000_stripe_upgrade.sql:29 serialisiert nebenlaeufige Upgrades
-- desselben Nutzers auf genau diesem Join-Muster.
--
-- SPERR-REIHENFOLGE, und das gehoert hierher und nicht in jemandes Gedaechtnis:
-- BEIDE Wege sperren erst `profiles`, dann `activation_tokens`. Deadlockfrei
-- per Konstruktion — aber die Aussage gilt ZWISCHEN DIESEN BEIDEN RPCs. Wer
-- kuenftig einen Schreiber baut, der erst eine Token-Zeile und dann dasselbe
-- Profil sperrt, dreht die Reihenfolge um und bekommt die wechselseitige
-- Blockade zurueck. Heute gibt es keinen solchen Schreiber. Die Pflicht steht
-- deshalb auch im Spec-Delta, nicht nur hier.
--
-- BENANNTE FOLGE: eine Token-Anforderung serialisiert sich kuenftig gegen
-- andere Schreiber derselben Profilzeile. Das sind, vollstaendig aufgezaehlt:
-- `public.mark_activated` (20260806080200:184) — laeuft bei JEDER Einloesung
-- und ist zum Launch alles andere als selten; `public.apply_upgrade`
-- (20260716120000:36, Stripe, idempotent und wiederholbar); sowie jede
-- Profilbearbeitung des Mitglieds selbst ueber `profiles_update_own`.
-- (Frueher stand hier `apply_tier_upgrade` — diese Function gibt es nicht, der
-- Name war aus Proposal und Design mitgewandert und liess sich nicht greppen.)
--
-- Die Kollision mit `mark_activated` ist funktional sogar NUETZLICH: `v_activated`
-- kann jetzt nicht mehr zwischen Lesen und Zweigwahl veralten, der aus
-- `activated_at` abgeleitete Zweck aus AGE-505 wird dadurch belastbar.
--
-- SIE REICHT WEITER ALS „SCHREIBER DER PROFILZEILE", und das ist beim Bau
-- gemessen worden, nicht vorhergesagt: ein `insert` in `activation_tokens`
-- nimmt fuer den FREMDSCHLUESSEL ein `for key share` auf die Profilzeile, und
-- das kollidiert mit `for update`. Eine Token-Anforderung wartet damit auch auf
-- jede offene Transaktion, die irgendwo eine Token-Zeile fuer dieses Profil
-- eingefuegt hat — auch an den RPCs vorbei. Sichtbar an Szenario S2 der Sonde:
-- ohne die Sperre antwortete der Aufruf `pending` ueber den 23505-Zweig, mit
-- ihr `rate_limited`. Der Aufruf WARTET dabei vor seinen Pruefungen und
-- entscheidet danach auf dem committeten Stand; den Status erzeugt dann die
-- 60-Sekunden-Pruefung. Das ist die ehrlichere Antwort, aber eine ANDERE als
-- vorher. (Nach aussen folgenlos: `send-activation/status.ts` bildet `pending`
-- und `rate_limited` beide auf `kein_versand` ab.)
--
-- AUS GEMEINSAMEM WARTEN WIRD EINE SCHLANGE, und das ist die unangenehme Seite.
-- Vorher liefen N gleichzeitige Anforderungen fuer dieselbe Adresse alle auf
-- EINE Transaktion am partiellen Index und wurden gemeinsam freigegeben.
-- Jetzt serialisieren sie streng: die k-te wartet auf k-1 Vorgaenger.
-- `send-activation` WARTET auf den RPC, bevor es 202 antwortet (index.ts:119) —
-- die Wartezeit steht also in der Antwortzeit, und fuer eine unbekannte Adresse
-- entsteht sie gar nicht, weil ohne Treffer keine Sperre genommen wird. An
-- einem Endpunkt, dessen Zweck Adress-Unkenntlichkeit ist, ist das kein reines
-- Latenzthema. Schaerfer noch: reisst die Wartezeit das `statement_timeout` der
-- Rolle, wirft der RPC 57014, und `send-activation` antwortet 502 statt 202
-- (index.ts:124) — aus einem zeitlichen wuerde ein binaeres Signal.
-- NICHT GEMESSEN, und deshalb hier als offener Punkt und nicht als Entwarnung.
-- Der Aufbau, der es entscheiden wuerde: je 50 parallele Aufrufe fuer eine
-- bekannte und eine garantiert unbekannte Adresse, p95 und Maximum vergleichen,
-- danach dasselbe mit `set statement_timeout = '200ms'`.
--
-- DESHALB NACHGEPRUEFT, ob heute jemand die Reihenfolge umdreht: nein.
-- `claim_activation_token` fasst nur `activation_tokens` an, `mark_activated`
-- nur `profiles`, und beide sind eigene RPCs in eigenen Transaktionen. Ein
-- `update` auf `activation_tokens`, das `profile_id` nicht aendert, nimmt gar
-- keine Elternsperre. Wer kuenftig in EINER Transaktion erst eine Token-Zeile
-- einfuegt und dann dasselbe Profil sperrt, baut die wechselseitige Blockade.
--
-- ── Was NICHT geaendert wird ───────────────────────────────────────────────
-- DER 23505-ZWEIG AUS 8.1 BLEIBT. Die Sperre macht ihn zum Guertel neben den
-- Hosentraegern, ersetzt ihn nicht: er deckt weiterhin ab, was AN DEN RPCs
-- VORBEI einfuegt — und dass er das unter einem echten Zwei-Sitzungs-Wettlauf
-- tut, ist gemessen (Sonde, Szenario S2: `A antwortet pending`, nachdem A
-- nachweislich an der fremden uncommitteten Zeile gewartet hat). Ihn zu
-- entfernen tauschte einen bewiesenen Schutz gegen einen neuen.
--
-- `request_own_activation_token` bekommt WEITERHIN KEIN Schutzfenster. Das
-- fehlt dort mit Absicht: Subjekt ist die Sitzung, „schick mir einen neuen
-- Link" soll wirken. Die Sperre behebt dort etwas anderes — zwei gleichzeitige
-- eigene Anfragen loesten bisher eine ROHE `unique_violation` aus, weil diese
-- Function, anders als ihre Schwester, keinen Handler hat; `resend-activation`
-- reichte sie als 5xx durch. Gemessen (S3):
--
--   B = issued · A = FEHLER 23505 duplicate key value violates unique
--       constraint "activation_tokens_offen_je_profil"
--
-- Grenzwerte, Statuswerte, Reihenfolge der Zweige, Entwertung, zurueckgegebene
-- Spalten, `search_path`, Signaturen und Grants sind unveraendert uebernommen —
-- nachgemessen am kommentarfreien Rumpf-Diff gegen 20260808150000 bzw.
-- 20260806090000, nicht behauptet. Vollstaendige Neudeklaration nur, weil
-- Postgres keine partielle Aenderung kennt.
--
-- ── Verworfene Alternativen ────────────────────────────────────────────────
-- `serializable` fuer diese Transaktionen: verschiebt den Fehler nur. Der
-- Verlierer bekaeme `40001` und damit wieder einen Fehler, wo eine Grenze die
-- richtige Antwort ist — und die Wiederholung muesste in `send-activation`
-- gebaut werden, das absichtlich immer 202 antwortet.
--
-- Ein Advisory Lock als Schutzmechanismus: er haengt an einer Zahl, nicht an
-- der Zeile, um die es geht. Wer ihn spaeter woanders vergisst, merkt nichts.
-- (Als Werkzeug IM TEST ist er richtig — die Sonde benutzt genau dafuer einen.)
--
-- Das Schutzfenster im angemeldeten Weg nachziehen: waere eine
-- Verhaltensaenderung des Hauptwegs, die niemand verlangt hat.
--
-- Donald / Claude, 2026-08-08.

-- ── 1. Der anonyme Weg ─────────────────────────────────────────────────────
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
  v_letzte    timestamptz;
  v_tag_zahl  int;
  v_offen     timestamptz;
  v_constraint text;
begin
  select p.id, p.name, p.activated_at, u.email
    into v_id, v_name, v_activated, v_email
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
  -- Siehe Kopf.
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
      -- darf es als „eine Mail ist unterwegs"; siehe Kopf.
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
  'Gibt ueber die LOGIN-Adresse ein Token aus (AGE-495 / AGE-505). Der ANONYME '
  'Weg — der Aktivierungsbildschirm nimmt request_own_activation_token. '
  'Entwertet einen noch gueltigen, unter 24 h alten Link NICHT, sondern '
  'antwortet "pending": sonst sperrt ein Fremder, der die Adresse kennt, das '
  'Mitglied aus. Der ZWECK wird aus profiles.activated_at abgeleitet und erst '
  'NACH allen Grenzen bestimmt — ein aktiviertes Konto bekommt "issued_reset" '
  '(Passwort vergessen), ein unaktiviertes "issued" (Aktivierung). '
  'SPERRT die Profilzeile (for update of p), BEVOR es prueft (AGE-507): sonst '
  'entscheiden zwei gleichzeitige Anforderungen beide auf einem veralteten '
  'Stand, und die zweite entwertet den soeben ausgegebenen gueltigen Link. '
  'Sperr-Reihenfolge: erst profiles, dann activation_tokens — in BEIDEN '
  'ausgebenden RPCs, und jeder kuenftige Schreiber beider Tabellen muss sie '
  'einhalten. '
  'Verliert der Aufruf einen GLEICHZEITIGEN Wettlauf um das eine offene Token '
  'je Profil, antwortet er ebenfalls "pending" statt zu werfen — sonst waere '
  'der Fehler ein Orakel fuer Mitgliedsadressen. Eine Verletzung des '
  'PRIMAERSCHLUESSELS wirft weiterhin: sie ist kein Wettlauf, sondern eine '
  'kaputte Token-Erzeugung. '
  'Status: unknown | rate_limited | pending | rate_limited_day | issued | '
  'issued_reset. "already_activated" gibt es hier seit AGE-505 NICHT mehr; '
  'request_own_activation_token hat ihn weiterhin. Gibt die HINTERLEGTE '
  'Login-Adresse zurueck. Nur service_role.';

revoke execute on function public.issue_activation_token(text, text, interval)
  from public, anon, authenticated;
grant execute on function public.issue_activation_token(text, text, interval)
  to service_role;

-- ── 2. Der angemeldete Weg ─────────────────────────────────────────────────
create or replace function public.request_own_activation_token(
  p_token_hash text,
  p_ttl        interval default interval '72 hours'
) returns table (status text, display_name text, login_email text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id        uuid := (select auth.uid());
  v_name      text;
  v_activated timestamptz;
  v_email     text;
  v_letzte    timestamptz;
  v_tag_zahl  int;
begin
  if v_id is null then
    return query select 'unknown'::text, null::text, null::text;
    return;
  end if;

  select p.name, p.activated_at, u.email
    into v_name, v_activated, v_email
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.id = v_id
   for update of p;  -- AGE-507: dieselbe Sperre, dieselbe Reihenfolge wie im
                     -- anonymen Weg. Ohne sie loesen zwei gleichzeitige eigene
                     -- Anforderungen eine ROHE unique_violation aus, die diese
                     -- Function — anders als ihre Schwester — nicht faengt und
                     -- resend-activation als 5xx durchreicht. Siehe Kopf.

  if not found then
    return query select 'unknown'::text, null::text, null::text;
    return;
  end if;

  if v_activated is not null then
    return query select 'already_activated'::text, v_name, v_email;
    return;
  end if;

  select max(created_at), count(*) filter (where created_at > now() - interval '24 hours')
    into v_letzte, v_tag_zahl
    from public.activation_tokens t
   where t.profile_id = v_id;

  -- Dieselben Grenzen wie im anonymen Weg. Sie schuetzen hier nicht mehr vor
  -- Aussperrung — das kann ueber die Sitzung niemand mehr ausloesen —, sondern
  -- das Resend-Kontingent.
  if v_letzte is not null and v_letzte > now() - interval '60 seconds' then
    return query select 'rate_limited'::text, v_name, v_email;
    return;
  end if;

  if v_tag_zahl >= 5 then
    return query select 'rate_limited_day'::text, v_name, v_email;
    return;
  end if;

  update public.activation_tokens
     set invalidated_at = now()
   where activation_tokens.profile_id = v_id
     and used_at is null and invalidated_at is null;

  insert into public.activation_tokens (token_hash, profile_id, expires_at)
  values (p_token_hash, v_id, now() + p_ttl);

  return query select 'issued'::text, v_name, v_email;
end;
$$;

comment on function public.request_own_activation_token(text, interval) is
  'Gibt dem AUFRUFER einen Aktivierungslink aus (AGE-495, Teil D). Subjekt ist '
  'auth.uid(), nicht eine mitgegebene Adresse — fremd anfordern ist damit '
  'unmoeglich. Der Weg des Aktivierungsbildschirms ueber die Function '
  'resend-activation (verify_jwt = true). '
  'SPERRT die eigene Profilzeile (for update of p), BEVOR es prueft (AGE-507): '
  'zwei gleichzeitige eigene Anforderungen loesten sonst eine rohe '
  'unique_violation am partiellen Index aus, die diese Function nicht faengt. '
  'Sperr-Reihenfolge wie im anonymen Weg: erst profiles, dann activation_tokens. '
  'Ein Schutzfenster hat dieser Weg ABSICHTLICH nicht — Subjekt ist die '
  'Sitzung, "schick mir einen neuen Link" soll wirken. '
  'Status: unknown | already_activated | rate_limited | rate_limited_day | issued.';

revoke execute on function public.request_own_activation_token(text, interval)
  from public, anon;
grant execute on function public.request_own_activation_token(text, interval)
  to authenticated;
