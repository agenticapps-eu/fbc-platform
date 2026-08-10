-- AGE-526 — Ein Stundenkontingent fuer die Ausgabe von Aktivierungstoken.
-- Donald, 2026-08-10.
--
-- WARUM. Ab diesem Change loest jede Selbstregistrierung selbst eine
-- Aktivierungsmail aus (der Ausloeser sitzt im Frontend, siehe AuthProvider).
-- Das schliesst die Luecke, an der die Demo vom 2026-08-10 scheiterte: Es war
-- keine Mail fehlgeschlagen, es hatte nie jemand eine angefordert. Der Preis
-- ist, dass eine Registrierung allein jetzt Post erzeugt — bisher brauchte es
-- dafuer zusaetzlich einen Klick auf dem Aktivierungsbildschirm. Die
-- Selbstregistrierung ist offen (das ist gewollt, der Schutz ist die Stufe),
-- also ist die Plattform ohne eine profiluebergreifende Grenze ein
-- Weiterleiter fuer beliebig viele Mails an fremde Adressen. Die bestehenden
-- Grenzen sitzen JE PROFIL (60 s, 5/24 h) und greifen genau deshalb nicht: Wer
-- beliebig viele Profile anlegt, bekommt jedes Mal ein frisches Kontingent.
-- Herkunft des Befundes: AGE-517, Task 14.7 aus AGE-495.
--
-- DIE GRENZE. Einhundert Ausgaben in der letzten Stunde, gezaehlt ueber ALLE
-- Profile und BEIDE Ausgabewege. Der Wert traegt den Fall, mit dem sich die
-- Spec schon vorher begruendete — „siebzig Mitglieder an einem Abend" —, auch
-- dann, wenn der Abend sich in einer Stunde verdichtet. Die staerkste je
-- gemessene Stunde lag bei 14, und das war der Demo-Seed.
--
-- SIE GREIFT NUR FUER FRISCHE PROFILE (juenger als 10 Minuten).
-- Das ist der Kern und keine Bequemlichkeit:
--
--   * Eine Grenze, die fuer alle greift, macht aus dem Missbrauch eine
--     AUSSPERRUNG. Wer das Kontingent verbrennt, sperrte sonst eine Stunde lang
--     jedes echte Mitglied vom Bestaetigungslink aus. Der Angriff kostet
--     nichts: `request_own_activation_token` darf jedes `authenticated`-Konto
--     aufrufen, und schon die Token-ZEILE verbraucht das Kontingent, ohne dass
--     eine Mail rausgeht.
--   * Umgekehrt ist genau der Registrierungsschwall der einzige Fall, den der
--     automatische Versand neu erzeugt. Mehr muss diese Grenze nicht abdecken.
--
-- Was das kostet, steht in der Anforderung und nicht nur hier: Ist das
-- Kontingent erschoepft, bekommt ein frisch registriertes Konto keine
-- automatische Mail. Die Sperre loest sich VON SELBST — nach zehn Minuten ist
-- das Profil nicht mehr frisch, und der Knopf auf dem Aktivierungsbildschirm
-- traegt. Der Zugang ist verzoegert, nicht verschlossen; dauerhaft aussperren
-- kann damit niemand.
--
-- VERWORFEN: ein Feld `automatisch` im Anfragerumpf. Es haette den
-- automatischen Weg sauber vom Knopf getrennt — aber der Aufrufer setzt es
-- selbst. Ein Missbrauchender schickt `false` und die Grenze ist umgangen.
-- Serverseitig pruefbar ist das Alter des Profils, die Absicht des Aufrufers
-- nicht.
--
-- VERWORFEN: eine Budgetzeile, die `for update` genommen wird. Sie fuehrte eine
-- Tabelle ein, die es sonst nicht gibt, und muesste stuendlich zurueckgesetzt
-- werden. Das gleitende Fenster ueber activation_tokens braucht keinen eigenen
-- Zustand.
--
-- WARUM DER RIEGEL. `count(*)` vor `insert` ist genau unter Gleichzeitigkeit
-- falsch: Zehn gleichzeitige Registrierungen lesen alle denselben Stand unter
-- der Schwelle und schreiben alle. Die Sperre auf der eigenen Profilzeile
-- (AGE-507, `for update of p`) traegt das NICHT — sie serialisiert
-- Anforderungen DESSELBEN Profils, diese Grenze ist aber
-- profiluebergreifend. `pg_advisory_xact_lock` auf einer festen Kennzahl ist
-- der kleinste Riegel, der die Zusage haelt: Er serialisiert ausschliesslich
-- die Ausgabe von Aktivierungstoken und faellt mit der Transaktion.
--
-- SPERR-REIHENFOLGE, damit hier nie ein Deadlock entsteht: erst die eigene
-- Profilzeile, dann der Riegel — in dieser Reihenfolge, immer. Zwei
-- Transaktionen koennen sich nicht ueber Kreuz blockieren, weil jede zuerst
-- ihre EIGENE Profilzeile nimmt (verschiedene Zeilen, kein Konflikt) und erst
-- danach denselben Riegel anfordert. Der anonyme Weg
-- (`issue_activation_token`) nimmt den Riegel gar nicht und kann deshalb auch
-- nicht Teil eines Zyklus sein.
--
-- WAS DIESE MIGRATION NICHT TUT. Sie bremst `issue_activation_token` nicht —
-- den adressbasierten Weg, den ein Admin fuer importierte Mitglieder anstoesst.
-- Dessen Ausgaben ZAEHLEN in das Kontingent hinein, werden aber nicht von ihm
-- abgewiesen. Er ist nicht der Missbrauchsweg: Er sendet nur an bereits
-- bestehende Profile, und es steht ein Mensch davor. Die Anforderung sagt
-- deshalb ausdruecklich „auf dem sitzungsgebundenen Ausgabeweg" und nicht
-- „plattformweit" — eine Zusage ueber alle Token der Plattform verspraeche
-- eine Schranke an einer Stelle, an der hier keine steht.
--
-- AGE-517 bleibt damit OFFEN: Wer wartet, bis seine Profile zehn Minuten alt
-- sind, steht wieder beim Zwei-Anfragen-Weg von vorher. Eine Grenze je
-- Absender-IP ist dort weiterhin zu bauen.

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
  v_id         uuid := (select auth.uid());
  v_name       text;
  v_activated  timestamptz;
  v_email      text;
  v_erstellt   timestamptz;
  v_letzte     timestamptz;
  v_tag_zahl   int;
  v_stunde     int;
begin
  if v_id is null then
    return query select 'unknown'::text, null::text, null::text;
    return;
  end if;

  select p.name, p.activated_at, p.created_at, u.email
    into v_name, v_activated, v_erstellt, v_email
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

  -- AGE-526: das Stundenkontingent, ZULETZT von den drei Grenzen. Die
  -- profilbezogenen zuerst — sie sind die spezifischere Auskunft, und sie
  -- kosten keinen Riegel. Ein Aufrufer, der ohnehin an seiner eigenen
  -- Sperrfrist scheitert, soll den globalen Riegel gar nicht erst anfassen.
  if v_erstellt > now() - interval '10 minutes' then
    -- Der Riegel VOR der Zaehlung, sonst zaehlt jeder auf veraltetem Stand.
    -- Feste Kennzahl aus dem Namen, damit sie ueber alle Sitzungen dieselbe
    -- ist und mit keiner anderen advisory-Sperre kollidiert.
    perform pg_advisory_xact_lock(hashtext('activation_token_stundenkontingent'));

    select count(*) into v_stunde
      from public.activation_tokens t
     where t.created_at > now() - interval '1 hour';

    if v_stunde >= 100 then
      return query select 'rate_limited_global'::text, v_name, v_email;
      return;
    end if;
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
  'AGE-526: dazu ein Stundenkontingent von 100 Ausgaben, gezaehlt ueber alle '
  'Profile und beide Ausgabewege, das NUR fuer Profile juenger als 10 Minuten '
  'greift — sonst machte ein verbranntes Kontingent aus dem Missbrauch eine '
  'Aussperrung. Serialisiert per pg_advisory_xact_lock, weil ein count(*) vor '
  'dem insert genau im Registrierungsschwall falsch ist. '
  'Status: unknown | already_activated | rate_limited | rate_limited_day | '
  'rate_limited_global | issued.';
