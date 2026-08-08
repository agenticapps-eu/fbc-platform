## 0. Ausgangslage messen, bevor irgendetwas geändert wird

Ohne roten Ausgangsbefund ist „grün" am Ende nicht von „Sonde falsch
geschrieben" zu unterscheiden. Der erste Lauf gehört gegen den **ungeänderten**
Stand. Der erste Entwurf dieser Datei hatte einen RED behauptet, der grün
gewesen wäre — siehe `REVIEWS.md`.

- [x] 0.1 Lokalen Stack hochfahren (`supabase start`) und mit `supabase db reset`
      auf den Stand von `main` bringen. Die Ausgabe von `db reset` gehört
      gelesen: eine fehlschlagende Migration ist hier der wahrscheinlichere
      Fehler als ein echter Befund.
      **Gemessen 2026-08-08:** alle Migrationen angewandt, keine fehlgeschlagen,
      `Reset local database.` — zuletzt `20260808150000` und `20260808180000`.
      Mitgeprüft, weil der Plan darauf steht: `issue_activation_token` ist
      zuletzt in `20260808150000` deklariert, `request_own_activation_token` in
      `20260806090000`; die jüngere `20260808180000` fasst nur den Kommentar von
      `mark_activated` an. Die Vorfassungen in 3.1 stimmen also.
- [x] 0.2 Prüfen, wie `auth.uid()` in einer rohen `pg`-Verbindung gesetzt wird
      (`request.jwt.claims`), am Vorbild von `supabase/tests/rls_test.sql`.
      **Nicht raten** — ohne das sind S3 und S4 nicht aufsetzbar, und ein
      `auth.uid()` von `null` liefert stillschweigend `unknown` statt eines
      Wettlaufs.
      **Gemessen 2026-08-08** gegen den lokalen Stack, mit Gegenprobe:

      ```
      auth.uid() liest: coalesce(current_setting('request.jwt.claim.sub', true),
                                 current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
      A) in Transaktion, is_local=true : {"uid":"1111…","rolle":"authenticated"}
      B) ohne Transaktion, is_local=false: {"uid":"1111…","rolle":"authenticated"}
      C) ohne Claims (Gegenprobe)       : {"uid":null}
      ```

      Für die Sonde gilt **A**: `begin` → `select set_config('request.jwt.claims',
      '{"sub":…,"role":"authenticated"}', true)` → `set local role authenticated`.
      Die Szenarien laufen ohnehin in offenen Transaktionen, und `is_local=true`
      räumt beim `rollback`/`commit` von selbst auf. Zeile C ist der Grund, das
      überhaupt zu messen: ohne gesetzte Claims ist `auth.uid()` still `null` —
      genau der Fall, der S3/S4 grün aussehen ließe, ohne etwas zu prüfen.

## 1. Die Sonde bauen (`scripts/probe-wettlauf-token-ausgabe.ts`)

Muster: `scripts/probe-activation-gate.ts` — tsx, `pg`, Kopfkommentar mit der
Frage, die sie beantwortet, roter Exit über `::error::`. **Ein Unterschied:** sie
verweigert jedes Ziel außer `127.0.0.1`. Sie schreibt, und sie legt eine
`zz_probe_…`-Function an, die in keiner gemeinsam genutzten Datenbank etwas zu
suchen hat.

- [x] 1.1 Ziel-Wächter zuerst, vor jeder anderen Zeile: ist die Verbindung nicht
      lokal, bricht die Sonde ab, **bevor** sie etwas anlegt.
- [x] 1.2 Auf- und Abbau: ein Wegwerf-Profil und die Kopier-Function je Lauf, am
      Ende gelöscht — auch wenn eine Behauptung fehlschlägt (`finally`).
- [x] 1.3 Hilfsmittel „warte, bis Sitzung X blockiert": Abfrage auf
      `pg_stat_activity` (`wait_event_type = 'Lock'`), zusätzlich
      `pg_blocking_pids`, mit Zeitgrenze. Ein `sleep` an dieser Stelle wäre genau
      das Timing, gegen das die Sonde antritt.
      Dazu `statement_timeout = '20s'` auf jeder Verbindung: der erste Aufbau
      **hing** statt zu messen, und ein Stillstand ist kein Messwert.
- [x] 1.4 **Die Kopie erzeugen** (nur für S1 nötig): `pg_get_functiondef` der
      echten Function lesen, Namen auf `zz_probe_…` umschreiben, unmittelbar
      **vor** dem `update public.activation_tokens` ein
      `perform pg_advisory_xact_lock(<schlüssel>);` einsetzen — und **prüfen,
      dass die Einfügung genau einmal gegriffen hat**. Nicht genau einmal heißt:
      die Naht hat sich verschoben, die Kopie misst etwas anderes als das
      Original, Abbruch statt Zahl.
- [x] 1.5 **S1 — der Befund 8.8**, sitzungsfreier Weg, gegen die Kopie.
      Vorbereitung: Profil P unaktiviert, Token T0 offen,
      `created_at = now() - 25 h`, `expires_at = now() + 47 h`. Ablauf: X hält
      den Advisory Lock → A ruft die Kopie auf und parkt am Riegel, **hinter**
      allen Prüfungen → B ruft die **echte** Function auf, läuft ganz durch und
      committet → X gibt frei → A läuft weiter.
      **Beim Bau geschärft:** die Reihenfolge der letzten drei Schritte richtet
      sich nach dem Messwert „blockiert B an A?". Blockiert B **nicht** (so ist
      es ohne die Sperre), muss B committen, **bevor** der Riegel fällt — sonst
      läuft A in B's unbestätigten Indexeintrag und beide warten aufeinander;
      gemessen wäre dann die Sperre am Index, nicht der Befund 8.8. Blockiert B
      **an A** (so soll es mit der Sperre sein), **kann** B nicht vorher
      committen, also fällt der Riegel zuerst. Der erste Aufbau hatte das feste
      Reihenfolge und hing.
- [x] 1.6 **S2 — der Wächter-Fall (8.9)**, gegen das Original. Eine zweite
      Verbindung fügt **an den RPCs vorbei** ein offenes Token ein und committet
      **nicht**; dann ruft A auf: die Prüfungen sehen die uncommittete Zeile
      nicht, das `insert` kollidiert am partiellen Index und **blockiert**; die
      zweite Verbindung committet. **Behauptung:** A antwortet `pending` — über
      den `23505`-Zweig, nicht über eine Grenze.
- [x] 1.7 **S3 — der angemeldete Weg**, gegen das Original. B ruft
      `request_own_activation_token` auf und committet **nicht**; A ruft auf und
      blockiert am `insert` gegen B's uncommittete Indexeintragung; B committet.
- [x] 1.8 **S4 — die gemischten Wege**, gegen die Originale, in **beiden**
      Gewinner-Reihenfolgen: anonym gewinnt gegen angemeldet und umgekehrt. Über
      `pg_blocking_pids` belegen, dass A tatsächlich **von B** blockiert wird —
      sonst belegt „A war später fertig" nur, dass A langsamer war.

Gebaut als `scripts/probe-wettlauf-token-ausgabe.ts`. Sie **behauptet keine
Rollen**, sondern berichtet, wer wen blockiert und wer was geantwortet hat, und
prüft die drei Invarianten, die die Zusage tragen: kein während des Laufs
entstandenes Token wird entwertet · genau eine der beiden Anforderungen gibt ein
Token aus · die andere fällt in eine ehrliche Grenze statt in einen DB-Fehler.
Grund: wer nach dem Fix gewinnt, hängt daran, **wo** die Sperre liegt — genau
der Punkt, an dem der erste Entwurf falsch lag.

## 2. RED messen — gegen den ungeänderten Stand

Lauf vom 2026-08-08 gegen `main` + `supabase db reset`, `9 von 14 Behauptungen
halten`, Exit 1. Ausgabe wörtlich:

```
── S1 · 8.8 · anonymer Weg, Schutzfenster unter Nebenlaeufigkeit ──
  ok   S1 · A parkt am Riegel, hinter allen Pruefungen: pg_blocking_pids(A) = [967] · active / Lock:advisory
       gemessen: pg_blocking_pids(B) = []  (B wartet NICHT auf A) · idle in transaction / Client:ClientRead
       A (Kopie) = issued · B (Original) = issued
       zz-probe-s1-T0: ENTWERTET
       zz-probe-s1-TA: offen (waehrend des Laufs entstanden)
       zz-probe-s1-TB: ENTWERTET (waehrend des Laufs entstanden)
  NICHT ok   S1 · kein waehrend des Laufs entstandenes Token wurde entwertet: 1: zz-probe-s1-TB
  NICHT ok   S1 · genau EINE der beiden Anforderungen gibt ein Token aus: 2 von 2 (A=issued, B=issued)
  NICHT ok   S1 · der Verlierer faellt in eine ehrliche Grenze, nicht in einen DB-Fehler: es gab keinen Verlierer
  ok   S1 · genau EIN offenes Token bleibt uebrig: 1 offen von 3

── S2 · 8.9 · der 23505-Waechter unter einem echten Zwei-Sitzungs-Wettlauf ──
       gemessen: pg_blocking_pids(A) = [970] · active / Lock:transactionid
  ok   S2 · A antwortet `pending` statt zu werfen: pending

── S3 · der angemeldete Weg, zwei gleichzeitige eigene Anforderungen ──
       gemessen: pg_blocking_pids(A) = [972] · active / Lock:transactionid
       B = issued · A = FEHLER 23505 duplicate key value violates unique constraint "activation_tokens_offen_je_profil"
  NICHT ok   S3 · A antwortet mit einem Status statt einen DB-Fehler durchzureichen: FEHLER 23505 …
  ok   S3 · genau EIN offenes Token: 1 offen

── S4 · gemischte Wege · anonym gewinnt gegen angemeldet ──
  ok   S4/a · A wird VON B blockiert: pg_blocking_pids(A) = [974], B = 974 · active / Lock:transactionid
       B = issued · A = FEHLER 23505 duplicate key value violates unique constraint "activation_tokens_offen_je_profil"
  NICHT ok   S4/a · A antwortet mit einem Status statt einen DB-Fehler durchzureichen: FEHLER 23505 …
  ok   S4/a · genau EINE der beiden gibt ein Token aus: 1 von 2

── S4 · gemischte Wege · angemeldet gewinnt gegen anonym ──
  ok   S4/b · A wird VON B blockiert: pg_blocking_pids(A) = [976], B = 976 · active / Lock:transactionid
       B = issued · A = pending
  ok   S4/b · A antwortet mit einem Status statt einen DB-Fehler durchzureichen: pending
  ok   S4/b · genau EINE der beiden gibt ein Token aus: 1 von 2
```

- [x] 2.1 S1 läuft und **fällt**: A antwortet `issued`, und TB trägt danach ein
      `invalidated_at`. Ausgabe wörtlich in dieser Datei festhalten — das ist der
      Befund, nicht seine Beschreibung.
      **Getroffen, wörtlich.** `A (Kopie) = issued · B (Original) = issued`, und
      `zz-probe-s1-TB: ENTWERTET (waehrend des Laufs entstanden)`. Der Befund 8.8
      ist damit gemessen, nicht hergeleitet: B's Sekunden alter, gültiger Link
      ist tot, obwohl das Schutzfenster ihn schützen sollte.
- [x] 2.2 S3 läuft und **fällt**: A wirft `unique_violation` (SQLSTATE 23505)
      bis an den Aufrufer durch, weil die Function keinen Handler hat.
      **Getroffen, wörtlich.** `FEHLER 23505 … "activation_tokens_offen_je_profil"`.
- [x] 2.3 ~~S4 läuft und **fällt**: `pg_blocking_pids` ist leer — ohne die Sperre
      warten die beiden Wege an keiner gemeinsamen Zeile aufeinander.~~
      **Die Erwartung war falsch, die Messung hat sie widerlegt.** In beiden
      Reihenfolgen ist `pg_blocking_pids(A)` **nicht** leer: A wartet auf B —
      nur eben am **partiellen Index** (`Lock:transactionid`) statt an der
      Profilzeile, also **hinter** dem eigenen Schreibversuch statt davor. Die
      Wege warten heute sehr wohl aufeinander; falsch ist nicht das *Ob*,
      sondern das *Wo* und das Ergebnis:
      `S4/a` (anonym gewinnt) → A reicht `23505` roh durch;
      `S4/b` (angemeldet gewinnt) → A antwortet `pending` über den 23505-Zweig,
      also über den Gürtel statt über eine Grenze.
      Der RED von S4 ist deshalb **das Ergebnis, nicht die Blockade**: der
      GREEN muss zeigen, dass A vor dem ersten Schreibzugriff wartet und mit
      einer Grenze antwortet. `pg_blocking_pids` bleibt der Beleg dafür, dass A
      überhaupt **von B** wartet — sonst belegte „A war später fertig" nur, dass
      A langsamer war.
- [x] 2.4 S2 läuft und ist **grün**. Das ist kein RED/GREEN-Paar, sondern der
      Nachweis, den 8.9 vermisst hat: der Wächter aus 8.1 greift unter einem
      echten Zwei-Sitzungs-Wettlauf. Wenn er hier grün ist, ist das eine
      Messung — und keine, die der Fix erzeugt hat.
      **Grün, gegen den ungeänderten Stand gemessen**: `A antwortet pending`,
      nachdem A nachweislich an der fremden, uncommitteten Zeile gewartet hat
      (`pg_blocking_pids(A) = [970]`). Befund 8.9 ist damit erledigt.

## 3. Die Migration

Gebaut als `supabase/migrations/20260808200000_activation_token_profilzeile_sperren.sql`.

- [x] 3.1 Neue Migration, die **beide** Functions vollständig neu deklariert
      (Postgres kennt keine partielle Änderung): `for update of p` an die erste
      Abfrage von `issue_activation_token` (Vorfassung `20260808150000`) und von
      `request_own_activation_token` (Vorfassung `20260806090000`).
- [x] 3.2 Kopfkommentar in der Form der Nachbarn: der Befund, warum die Sperre
      auf `profiles` und nicht auf `activation_tokens` liegt, warum `of p` und
      nicht nacktes `for update`, dass **beide** Wege `profiles` vor
      `activation_tokens` sperren und dass diese Aussage **zwischen diesen
      beiden RPCs** gilt — jeder künftige Schreiber beider Tabellen muss
      dieselbe Reihenfolge einhalten. Dass der `23505`-Zweig bleibt, gehört
      ebenfalls hinein. Verworfene Alternativen mit hinein: `serializable`,
      Advisory Lock als Schutzmechanismus, Schutzfenster für den angemeldeten
      Weg.
- [x] 3.3 **Nachmessen statt behaupten:** kommentarfreier Rumpf-Diff gegen beide
      Vorfassungen zeigt **ausschließlich** die `for update of p`-Zeile. Das
      Ergebnis kommt in den Kopf; steht dort etwas anderes als gemessen, ist der
      Kopf falsch, nicht die Messung.
      **Gemessen** (Rümpfe aus beiden Dateien geschnitten, `--`-Kommentare und
      Leerzeilen entfernt, dann `diff`):

      ```
      ### issue_activation_token  (20260808150000 → neu)
      25c25,26
      <    where lower(u.email) = lower(trim(p_email));
      ---
      >    where lower(u.email) = lower(trim(p_email))
      >    for update of p;
      ### request_own_activation_token  (20260806090000 → neu)
      26c26,27
      <    where p.id = v_id;
      ---
      >    where p.id = v_id
      >    for update of p;
      ```

      Genau eine Zeile je Function, sonst nichts.
- [x] 3.4 `comment on function` beider Functions um einen Satz zur Sperre
      ergänzen — im Stil der vorhandenen Kommentare, und er nennt das **Warum**
      (gleichzeitige Anforderungen entscheiden sonst auf veraltetem Stand) samt
      der Sperr-Reihenfolge. Die Kommentare sind hier die gelesene Schnittstelle.
- [x] 3.5 `revoke`/`grant` nach der Neudeklaration erneut aussprechen — wie in
      allen Nachbarmigrationen. **Nicht**, weil die Rechte verlorengingen:
      `create or replace function` behält das Funktionsobjekt samt Privilegien.
      Sondern weil die Rechte dann in jeder Fassung ablesbar dastehen, statt aus
      einer früheren Datei erschlossen werden zu müssen. `grants_test.sql` prüft
      das Ergebnis.

## 4. GREEN messen

- [x] 4.1 `supabase db reset`, dann die Sonde erneut.
      **Gemessen: 15 von 15 Behauptungen halten, Exit 0.** Zwei der vier
      Erwartungen waren falsch formuliert; die Messung hat beide korrigiert:

      **S1 — die Rollen waren vertauscht.** Erwartet war „A antwortet
      `rate_limited`, TB bleibt offen". Gemessen antwortet **A `issued` und B
      `rate_limited`**. Das ist die logische Folge der Naht, die Codex in
      Stufe 2b an ihren richtigen Platz gerückt hat: A parkt am Riegel
      **hinter** allen Prüfungen, hält also die Profilzeile bereits — nach dem
      Fix blockiert damit **B**, nicht A. Die alte Formulierung stammte aus dem
      verworfenen ersten Entwurf, in dem A früh parkte. **Die Zusage ist
      unberührt:** nichts entwertet, genau ein Token ausgegeben, der Verlierer
      fällt in die Sperrfrist. Nur wer verliert, dreht sich um.

      ```
        ok   S1 · A parkt am Riegel, hinter allen Pruefungen: pg_blocking_pids(A) = [368] · active / Lock:advisory
             gemessen: pg_blocking_pids(B) = [369]  (B wartet auf A) · active / Lock:transactionid
             A (Kopie) = issued · B (Original) = rate_limited
             zz-probe-s1-T0: ENTWERTET
             zz-probe-s1-TA: offen (waehrend des Laufs entstanden)
        ok   S1 · kein waehrend des Laufs entstandenes Token wurde entwertet: keines
        ok   S1 · genau EINE der beiden Anforderungen gibt ein Token aus: 1 von 2 (A=issued, B=rate_limited)
        ok   S1 · der Verlierer faellt in eine ehrliche Grenze, nicht in einen DB-Fehler: rate_limited
        ok   S1 · genau EIN offenes Token bleibt uebrig: 1 offen von 2
      ```

      **S2 — der `23505`-Zweig wird auf diesem Weg nicht mehr erreicht.**
      Erwartet war „weiterhin `pending`". Gemessen: **`rate_limited`**. Der
      Grund ist ein Mechanismus, den weder Proposal noch Design benannt hatten:
      ein `insert` in `activation_tokens` nimmt für den **Fremdschlüssel** ein
      `for key share` auf die Profilzeile, und das kollidiert mit `for update`.
      Die fremde, an den RPCs vorbei einfügende Sitzung sperrt damit die
      Profilzeile mit — A wartet jetzt **vor** seinen Prüfungen statt am Index
      und entscheidet danach auf dem committeten Stand. Das ist kein Schaden,
      sondern eine ehrlichere Antwort. Es heißt aber: **die Sperre reicht weiter
      als beschrieben** — sie serialisiert nicht nur gegen andere Schreiber der
      Profilzeile, sondern auch gegen jeden, der eine Token-Zeile für dieses
      Profil einfügt. Nachgeprüft, weil daran die Deadlock-Aussage hängt:
      `claim_activation_token` fasst nur `activation_tokens` an,
      `mark_activated` nur `profiles`, und beide laufen als eigene RPCs in
      eigenen Transaktionen — **keine** heutige Transaktion sperrt erst Token,
      dann Profil.

      **S3 und S4 wie erwartet:** `A = rate_limited` statt `FEHLER 23505` bzw.
      `pending`, in beiden Gewinner-Reihenfolgen, und `pg_blocking_pids` weist A
      jeweils als **von B** blockiert aus.
- [x] 4.2 Die Ausgaben wörtlich hier festhalten, neben den roten aus Gruppe 2.
      Paare aus zwei Messungen, nicht Häkchen.
      Weil die S2-Behauptung nach dem Befund oben umgeschrieben werden musste
      (sie prüfte den **Weg** statt das **Ergebnis**), ist Gruppe 2 mit der
      **selben** Sondenfassung noch einmal gegen den ungeänderten Stand
      gemessen worden — sonst wäre das Paar aus zwei verschiedenen Messgeräten:

      | Stand | Ergebnis |
      | --- | --- |
      | ohne die Migration | **10 von 15**, Exit 1 — S1 (3×), S3, S4/a fallen |
      | mit der Migration | **15 von 15**, Exit 0 |

      Die fünf roten Zeilen sind wörtlich dieselben wie in Gruppe 2; einzig S2
      liest jetzt `pending (…)` statt einer festen Behauptung.
- [x] 4.3 **Gegenprobe, dass die Sonde etwas misst:** `for update of p` aus
      **einer** der beiden Functions wieder entfernen und belegen, dass **genau**
      die zugehörigen Szenarien fallen und die anderen grün bleiben. Quelle
      danach unverändert (`git diff` leer).
      **Beide Richtungen gemessen**, weil erst das zeigt, welches Szenario
      welche Function bewacht:

      ```
      ── 4.3a · Sperre fehlt in request_own_activation_token   (13 von 15)
        NICHT ok  S3   · A … : FEHLER 23505 … "activation_tokens_offen_je_profil"
        NICHT ok  S4/a · A … : FEHLER 23505 … "activation_tokens_offen_je_profil"
      ── 4.3b · Sperre fehlt in issue_activation_token         (12 von 15)
        NICHT ok  S1 · kein waehrend des Laufs entstandenes Token wurde entwertet: 1: zz-probe-s1-TB
        NICHT ok  S1 · genau EINE der beiden Anforderungen gibt ein Token aus: 2 von 2 (A=issued, B=issued)
        NICHT ok  S1 · der Verlierer faellt in eine ehrliche Grenze …: es gab keinen Verlierer
      ```

      Trennscharf: 4.3a lässt **nur** die beiden Szenarien fallen, die den
      angemeldeten Weg als Verlierer haben; S4/b bleibt grün, weil dort der
      anonyme Weg (mit Sperre) der Wartende ist. 4.3b lässt **nur** S1 fallen.
      Quelle danach `diff -q`-identisch zum Original.
- [x] 4.4 **Zweite Gegenprobe, auf die Position:** die Sperre in einer Function
      **hinter** die Prüfungen verschieben (statt sie zu entfernen). S1 muss
      fallen — das ist genau der Fall, den der strukturelle Wächter allein nicht
      fangen könnte und den beide Prüfer benannt haben. Quelle danach unverändert.
      **Gemessen** (`for update of p` aus der ersten Abfrage von
      `issue_activation_token` entfernt und als eigene Anweisung unmittelbar vor
      das `update` gesetzt — die Sperre ist also **vorhanden**, nur an der
      falschen Stelle):

      ```
      ── 4.4 · Sperre steht HINTER den Pruefungen              (11 von 15)
        NICHT ok  S1 · kein waehrend des Laufs entstandenes Token wurde entwertet: 1: zz-probe-s1-TA
        NICHT ok  S1 · genau EINE der beiden Anforderungen gibt ein Token aus: 2 von 2 (A=issued, B=issued)
        NICHT ok  S1 · der Verlierer faellt in eine ehrliche Grenze …: es gab keinen Verlierer
        NICHT ok  S4/b · genau EINE der beiden gibt ein Token aus: 2 von 2
      ```

      **Schlimmer als das Entfernen**, und das ist der Punkt: die verschobene
      Sperre bricht ein Szenario **mehr** als die fehlende (S4/b gibt jetzt
      ZWEI Token aus). Beide Aufrufe prüfen auf einem veralteten Stand, warten
      dann brav aufeinander und schreiben anschließend die Ergebnisse dieser
      veralteten Prüfung fort. Eine Kontrolle, die nur das **Vorkommen** von
      `for update of p` zählt, sähe hier nichts — deshalb vergleicht die
      pgTAP-Zeile aus Gruppe 5 Positionen.

## 5. Der strukturelle Wächter

- [x] 5.1 Je Function eine Zeile in `supabase/tests/rls_test.sql`: auf einer von
      `--`-Kommentaren befreiten Fassung von `pg_get_functiondef` steht
      `for update of p` **vor** dem ersten Vorkommen von `activation_tokens`.
      `plan(182)` → `plan(184)`. Die Kommentarbefreiung ist nicht Zierrat — ohne
      sie täuscht ein Kommentar die Reihenfolge vor.
      Als Abschnitt „14a-bis", Tests **148** und **149**.
- [x] 5.2 Sonde für die Sonde: mit **entfernter** Sperre fällt die Zeile, mit
      **verschobener** Sperre ebenfalls. Beides messen — die zweite Messung ist
      der ganze Grund, warum die Zeile Positionen vergleicht statt Vorkommen zu
      zählen.
      **Gemessen:**

      ```
      ── 5.2a · Sperre ENTFERNT
        # Failed test 148: "issue_activation_token: `for update of p` steht VOR …"
        # Failed test 149: "request_own_activation_token: `for update of p` steht VOR …"
        Failed 2/184 subtests            Result: FAIL
      ── 5.2b · Sperre VORHANDEN, aber hinter den Pruefungen
        # Failed test 148: "issue_activation_token: `for update of p` steht VOR …"
        Failed 1/184 subtests            Result: FAIL
      ── zurueckgestellt: Migration identisch zum Original.   Result: PASS
      ```

      **5.2b ist der Beleg, auf den es ankommt.** Die Sperre ist dort
      *vorhanden* — nur an der falschen Stelle —, und die Zeile fällt trotzdem.
      Ein Wächter, der `for update of p` bloß zählte, wäre hier grün, während
      Task 4.4 in derselben Lage vier Behauptungen der Sonde fallen sieht.
- [x] 5.3 Im Test daneben schreiben, was die Zeile **nicht** belegt: sie liest
      Text und bemerkt keine Verhaltensregression. Das Verhalten belegt die
      Sonde aus Gruppe 1, einmal, zum Zeitpunkt des Baus. Verweis auf
      `REVIEWS.md`, wo die Entscheidung gegen den CI-Lauf steht.
      Steht als Absatz „WAS DIESE ZEILE NICHT BELEGT" über den beiden Zeilen.
- [x] 5.4 `supabase test db` **mit Dateiliste** laufen lassen (ohne Liste meldet
      der Befehl FAIL, obwohl grün — die `probe_*.sql` sind kein pgTAP), und
      `grants_test.sql` mitprüfen: der Golden-Snapshot bricht bei jeder
      Rechteänderung, auch bei einer, die niemand beabsichtigt hat.
      **Gemessen** (`rls_test.sql` · `grants_test.sql` · `directory_search_test.sql`):
      `Files=3, Tests=204 … Result: PASS`. Der Golden-Snapshot von
      `grants_test.sql` hält — die Migration spricht nur die bestehenden
      Function-Grants erneut aus und legt keine Tabelle an.

## 6. Prüfen

- [x] 6.1 `openspec validate --all` grün. **Gemessen:** `29 passed, 0 failed`.
      Das Spec-Delta brauchte **keine** Änderung: es sagt ausdrücklich, dass
      „welche Grenze den unterliegenden Aufruf fängt" nicht Teil der Zusage ist,
      und benennt keine Rollen — beide Befunde aus Gruppe 4 laufen deshalb
      gegen keinen seiner Sätze. Alle vier Szenarien sind durch die Messungen
      erfüllt (S1→1, S3→2, S4→3, S2→4).
- [x] 6.2 Plan-Review (Stufe 2b) — zwei Prüfer anderer Anbieter (`codex`,
      `gemini`), beide REQUEST-CHANGES, in `REVIEWS.md`. Zwei HIGH-Befunde von
      Codex haben den Belegaufbau und die erwarteten Statuswerte korrigiert; die
      HIGH-Befunde zum fehlenden CI-Lauf sind nach erneuter Rückfrage bewusst
      nicht übernommen.
- [x] 6.3 `database-sentinel` auf den Diff (SQL/RLS-Gate). Kritische oder hohe
      Befunde blockieren den Branch-Abschluss.
      **Keine kritischen, keine hohen Befunde.** Gegen die **Live-Definition**
      gemessen, nicht gegen die Datei:

      | Muster | Messung |
      | --- | --- |
      | `SECURITY_DEFINER_EXPOSED` | beide `security definer`, aber eng vergeben: `issue` → nur `service_role`, `request_own` → nur `authenticated` (und dessen Subjekt ist `auth.uid()`) |
      | `MUTABLE_SEARCH_PATH` | `proconfig = search_path=""` auf beiden; projektweit **0** `security definer`-Functions in `public` ohne festen `search_path` |
      | `EXPOSED_RPC_NO_AUTH` | `anon` darf **keine** von beiden ausführen |
      | RLS `activation_tokens` | unverändert: RLS an, 0 Policies — das ist der dokumentierte Entwurf (nur `service_role`), nicht eine Lücke dieses Diffs |
      | Sperrverhalten / Deadlock | nachgeprüft: keine heutige Transaktion sperrt erst Token, dann Profil (siehe 4.1) |
      | Rückstände der Sonde | `0` Kopien, `0` Konten in der DB nach dem Lauf |

      **Ein Befund, LOW, auf Code aus diesem Diff — behoben:** die Sonde nahm
      ihr Ziel aus `PROBE_DB_URL` und prüfte nur die **Zeichenkette** auf
      `127.0.0.1`. Ein Tunnel auf `127.0.0.1:54322` zeigt auf ein fremdes
      Projekt und wäre durchgekommen — bei einem Skript, das schreibt und eine
      Function anlegt, ist das die falsche Reihenfolge von Vertrauen.
      Erste Fassung des Fixes (zusätzlich `rolsuper` prüfen) war **falsch und
      wurde von der Messung sofort widerlegt**: im lokalen Stack ist `postgres`
      kein Superuser. Ein verlässliches Merkmal in der Datenbank gibt es nicht.
      Behoben wurde es deshalb, indem der Umschalter **entfällt** — die Adresse
      steht fest, es gibt nichts umzustellen. Sonde danach erneut **15/15**.
- [ ] 6.4 Code-Review auf den **Diff**, nicht auf den Plan.

## 7. Ausrollen — drei Flächen, und die Falle dazwischen

- [ ] 7.1 Merge; danach prüfen, dass `migrate-dev` auf `main` **gelaufen** ist.
- [ ] 7.2 `migrate-prod` von Hand freigeben. Solange PROD die Migration nicht
      kennt, steht `drift-gate` auf `failure` — und `deploy` und `functions`
      werden dann **stillschweigend übersprungen**, obwohl ein Check namens
      „deploy" grün aussieht (der gehört `pages-build-deployment`).
- [ ] 7.3 Den Dry-Run von `migrate-prod` **lesen**, bevor `apply` ausgelöst
      wird: der Job trägt keine Reviewer-Regel, der Dispatch ist der Punkt ohne
      Rückweg. Erwartet werden zwei `create or replace function` samt Kommentar
      und Grants — keine Tabelle, kein Index, kein Backfill.
- [ ] 7.4 Nach dem Rollout je Projekt belegen, dass die Sperre in der **Live**-
      Definition steht (`pg_get_functiondef` gegen beide Refs gelesen), nicht nur
      in der Datei.

## 8. Abschließen

- [ ] 8.1 Delta nach `openspec/specs/access-control/` folden und den Change
      archivieren.
- [ ] 8.2 8.8 und 8.9 in `openspec/changes/password-reset-flow/tasks.md`
      abhaken, mit Verweis auf AGE-507 und den Messungen aus Gruppe 4.
- [ ] 8.3 AGE-507 in Linear auf Done — erst prüfen, ob die GitHub-Automation das
      schon getan hat.
