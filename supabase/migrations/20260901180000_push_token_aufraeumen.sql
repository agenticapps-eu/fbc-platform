-- ════════════════════════════════════════════════════════════════════════════
-- AGE-682 — tote Geraetetokens entfernen, und das Lebenszeichen richtigstellen
-- ════════════════════════════════════════════════════════════════════════════
--
-- Change: openspec/changes/push-token-aufraeumen/.
--
-- ══ DER ANLASS ═════════════════════════════════════════════════════════════
-- Beim iOS-Geraetetest am 28.08. meldete die Zustellung `{"zugestellt": 2}`,
-- obwohl nur EIN Geraet in der Hand war. Die zweite ging an das Token einer
-- deinstallierten App. APNs hat es angenommen, nicht abgelehnt.
--
-- Der bestehende Loeschpfad haengt an einer Ablehnung: `dauerhaft` ->
-- `push_zustellung_quittieren` -> `delete from push_tokens`
-- (`20260827240000:292-294`). Apple gibt `410 Unregistered` aber auf einem
-- undokumentierten, bewusst unscharfen Zeitplan aus — damit sich aus
-- Push-Antworten keine Deinstallationen ablesen lassen — und behaelt sich vor,
-- ihn jederzeit zu aendern. Bleibt die Ablehnung aus, bleibt die Zeile.
--
-- ══ WARUM 180 TAGE, UND WARUM FUER BEIDE PLATTFORMEN ═══════════════════════
-- Firebase empfiehlt fuer genau dieses Verfahren einen Zeitstempel, ein
-- Staleness-Fenster und ein MONATLICHES Erneuern; das Beispiel auf ihrer Seite
-- steht auf 30 Tagen. Androids eigener Verfall liegt bei 270 Tagen Inaktivitaet
-- (danach meldet FCM `NOT_FOUND`, und der bestehende Pfad raeumt selbst auf).
-- APNs kennt keine solche Grenze.
--
-- Wir nehmen 180, weil die Kosten ASYMMETRISCH sind. Zu spaet geloescht kostet
-- ein paar vergebliche HTTP-Aufrufe an einen Anbieter, der sie ohnehin
-- verwirft. Zu frueh geloescht nimmt einem LEBENDEN Mitglied den Zustellweg —
-- unbemerkt, weil danach nichts mehr fehlschlaegt. Push ist das Mittel, mit dem
-- man jemanden zurueckholt, der die App laenger nicht geoeffnet hat; ihm genau
-- dann den Weg zu nehmen, hebt den Zweck auf.
--
-- EINE Frist fuer beide Plattformen, ausdruecklich: Android verliert sein Token
-- damit 90 Tage vor FCMs eigener Grenze. Das ist gewollt. Mit dem Lebenszeichen
-- aus derselben Aenderung heisst „180 Tage" auf beiden Seiten dasselbe, naemlich
-- dass die App ein halbes Jahr nicht gelaufen ist.
--
-- ══ KEIN PARAMETER ═════════════════════════════════════════════════════════
-- Der erste Entwurf fuehrte `p_frist interval` mit der Begruendung, der Test
-- muesste sonst ein halbes Jahr warten. Das war falsch: der Test altert die
-- FIXTURES (`now() - interval '181 days'`), nicht die Frist. Ein frei
-- waehlbarer Wert kauft damit nichts und traegt einen Fehlgriff in sich — ein
-- negatives Intervall loescht jedes Token. Gefunden von der Plan-Review.
-- ════════════════════════════════════════════════════════════════════════════

create function public.push_tokens_aufraeumen()
  returns int
  language plpgsql
  security definer
  set search_path = ''
as $$
declare n int;
begin
  delete from public.push_tokens
   where letzter_kontakt < now() - interval '180 days';
  get diagnostics n = row_count;
  return n;
end $$;

-- Rechte AUSGESPROCHEN entzogen, nicht geerbt (AGE-312). Default Privileges
-- wirken auf Funktionen nicht — ein `revoke` an der Rolle waere hier ein No-op.
--
-- `service_role` steht ausdruecklich dabei, obwohl `public` die Allgemeinheit
-- deckt: dieses Projekt fuehrt rollen-eigene Default-Grants, und eine
-- LOESCHENDE `security definer`-Funktion, die per RPC erreichbar bleibt, ist
-- kein Restrisiko, sondern ein Loch. Der verschachtelte Aufruf aus
-- `push_auftraege_faellig` laeuft weiterhin unter dem Eigentuemer.
revoke execute on function public.push_tokens_aufraeumen()
  from public, anon, authenticated, service_role;

comment on function public.push_tokens_aufraeumen() is
  'AGE-682: entfernt Geraetetokens ohne Lebenszeichen seit 180 Tagen. Netz '
  'unter dem Anbieter-Pfad, nicht sein Ersatz: APNs lehnt ein Token einer '
  'deinstallierten App auf einem bewusst unscharfen Zeitplan ab, womoeglich '
  'nie. Gerufen ausschliesslich aus push_auftraege_faellig().';

-- ── Der falsche Spaltenkommentar ────────────────────────────────────────────
-- Er behauptete seit dem 27.08. „Gepflegt von claim_push_token() bei jedem
-- Start" — und war die Quelle, aus der der erste Entwurf dieses Vorgangs seine
-- tragende Annahme uebernahm, statt den Aufrufer zu messen. `claim_push_token`
-- haengt allein an `pushEinrichten`, und das lief nur beim Oeffnen der
-- Nachrichten, dort einmal je Konto. Seit AGE-682 gibt es zusaetzlich das
-- stille Erneuern beim Start (`pushLebenszeichen`), und damit stimmt der
-- Kommentar wieder — aber erst jetzt, und nur mit beiden Wegen.
comment on column public.push_tokens.letzter_kontakt is
  'AGE-641/682: wann sich das Geraet zuletzt gemeldet hat. Gesetzt von '
  'claim_push_token() auf ZWEI Wegen: beim Oeffnen der Nachrichten (dort mit '
  'Erlaubnisfrage) und bei jedem nativen App-Start mit bereits erteilter '
  'Erlaubnis, ohne Dialog. Der zweite Weg ist das eigentliche Lebenszeichen; '
  'ohne ihn misst die Spalte nur, wann zuletzt der Chat offen war.';

-- ── Der Aufraeumer laeuft auf dem bestehenden Minutenpfad ───────────────────
-- Rumpf woertlich aus `20260828100000:134-200` uebernommen; hinzugekommen ist
-- ausschliesslich die erste Anweisung.
--
-- WARUM HIER UND NICHT IN `push_wiederholung()`. Jene Funktion ist die, die der
-- cron-Eintrag ruft — sie steht aber NICHT in git: sie traegt den
-- `PUSH_WEBHOOK_SECRET` im Rumpf und wird von Hand auf beiden Instanzen
-- angelegt (`docs/secrets.md`). Logik dort hinein hiesse: kein pgTAP, ein
-- `supabase db reset` tilgt sie mitsamt dem Aufraeumer, und der
-- Objekt-Drift-Scan vergleicht NAMEN und ZEITPLANUNGEN, keine Funktionsruempfe
-- — eine fehlende Zeile fiele niemandem auf, und der Lauf liefe still nie.
--
-- WARUM ALS ERSTE ANWEISUNG. `push_zustellungen.token_id` haengt mit
-- `on delete cascade` an `push_tokens` (`20260827240000:92`). Vorn geloescht,
-- verschwinden die Zustellzeilen, BEVOR sie beansprucht werden. Der
-- abschliessende Join haette sie zwar ohnehin fallen lassen — aber still, und
-- darauf verlaesst man sich nicht.
--
-- DIE ZUSAGE GILT FUER DIESEN LAUF, NICHT FUER ALLES. `push_auftraege_holen()`
-- bleibt unveraendert und kann ein abgestandenes Token in derselben Minute
-- beanspruchen, in der dieser Weg es loescht. Dann kaskadiert das Loeschen eine
-- laufende Zustellzeile weg, und die spaetere Quittung trifft null Zeilen, ohne
-- das zu bemerken. Wirkung: eine nicht zugestellte Benachrichtigung an ein
-- Geraet, das ein halbes Jahr nicht gelaufen ist — der Fall, den diese
-- Aenderung bewusst herbeifuehrt, nur auf einem unschoenen Weg. Benannt statt
-- behauptet.
create or replace function public.push_auftraege_faellig(p_max int default 100)
  returns table (
    notification_id uuid,
    token_id        uuid,
    token           text,
    plattform       text,
    typ             text,
    wer             text,
    ziel_id         text
  )
  language plpgsql
  security definer
  set search_path = ''
as $$
#variable_conflict use_column
begin
  -- AGE-682: die einzige hinzugekommene Anweisung. Sie steht VORN, damit ein
  -- abgestandenes Token in derselben Minute keine Zustellung mehr bekommt —
  -- die Kaskade nimmt seine Zustellzeilen mit, bevor sie beansprucht werden.
  perform public.push_tokens_aufraeumen();

  -- Danach aufgeben, was seine Versuche verbraucht hat. Sonst bliebe ein
  -- Auftrag, der die Function zuverlaessig umbringt, unbegrenzt in der
  -- Auswahl — nur eben ohne je zugestellt zu werden.
  update public.push_zustellungen
     set zustand        = 'aufgegeben',
         letzter_fehler = coalesce(letzter_fehler, 'Frist mehrfach verstrichen')
   where zustand = 'laeuft'
     and naechster_versuch <= now()
     and versuche >= 5;

  return query
  with faellig as (
    select z.notification_id, z.token_id, z.zustand
      from public.push_zustellungen z
     -- `laeuft` gehoert dazu: ein Anspruch, dessen Frist verstrichen ist,
     -- wurde nie quittiert. Das ist der reparierte Fall.
     where z.zustand in ('offen', 'laeuft')
       and z.naechster_versuch <= now()
     order by z.naechster_versuch
     limit p_max
     for update skip locked
  ),
  beansprucht as (
    update public.push_zustellungen z
       set zustand = 'laeuft',
           -- Ein ZURUECKGEHOLTER Anspruch zaehlt als Versuch; ein bisher
           -- unversuchter (`offen`) nicht — dessen Zaehler fuehrt die
           -- Quittung.
           versuche = case when f.zustand = 'laeuft' then z.versuche + 1 else z.versuche end,
           naechster_versuch = now() + interval '5 minutes'
      from faellig f
     where z.notification_id = f.notification_id
       and z.token_id = f.token_id
    returning z.notification_id, z.token_id
  )
  select b.notification_id,
         b.token_id,
         t.token,
         t.plattform,
         n.type,
         coalesce(n.payload->>'sender_name',
                  n.payload->>'from_name',
                  n.payload->>'to_name',
                  n.payload->>'autor_name',
                  'Ein Mitglied'),
         coalesce(n.payload->>'thread_id',
                  n.payload->>'request_id')
    from beansprucht b
    join public.push_tokens t   on t.id = b.token_id
    join public.notifications n on n.id = b.notification_id;
end $$;
