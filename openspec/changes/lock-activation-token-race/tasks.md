## 0. Ausgangslage messen, bevor irgendetwas geändert wird

Ohne roten Ausgangsbefund ist „grün" am Ende nicht von „Sonde falsch
geschrieben" zu unterscheiden. Der erste Lauf gehört gegen den **ungeänderten**
Stand. Der erste Entwurf dieser Datei hatte einen RED behauptet, der grün
gewesen wäre — siehe `REVIEWS.md`.

- [ ] 0.1 Lokalen Stack hochfahren (`supabase start`) und mit `supabase db reset`
      auf den Stand von `main` bringen. Die Ausgabe von `db reset` gehört
      gelesen: eine fehlschlagende Migration ist hier der wahrscheinlichere
      Fehler als ein echter Befund.
- [ ] 0.2 Prüfen, wie `auth.uid()` in einer rohen `pg`-Verbindung gesetzt wird
      (`request.jwt.claims`), am Vorbild von `supabase/tests/rls_test.sql`.
      **Nicht raten** — ohne das sind S3 und S4 nicht aufsetzbar, und ein
      `auth.uid()` von `null` liefert stillschweigend `unknown` statt eines
      Wettlaufs.

## 1. Die Sonde bauen (`scripts/probe-wettlauf-token-ausgabe.ts`)

Muster: `scripts/probe-activation-gate.ts` — tsx, `pg`, Kopfkommentar mit der
Frage, die sie beantwortet, roter Exit über `::error::`. **Ein Unterschied:** sie
verweigert jedes Ziel außer `127.0.0.1`. Sie schreibt, und sie legt eine
`zz_probe_…`-Function an, die in keiner gemeinsam genutzten Datenbank etwas zu
suchen hat.

- [ ] 1.1 Ziel-Wächter zuerst, vor jeder anderen Zeile: ist die Verbindung nicht
      lokal, bricht die Sonde ab, **bevor** sie etwas anlegt.
- [ ] 1.2 Auf- und Abbau: ein Wegwerf-Profil und die Kopier-Function je Lauf, am
      Ende gelöscht — auch wenn eine Behauptung fehlschlägt (`finally`).
- [ ] 1.3 Hilfsmittel „warte, bis Sitzung X blockiert": Abfrage auf
      `pg_stat_activity` (`wait_event_type = 'Lock'`), zusätzlich
      `pg_blocking_pids`, mit Zeitgrenze. Ein `sleep` an dieser Stelle wäre genau
      das Timing, gegen das die Sonde antritt.
- [ ] 1.4 **Die Kopie erzeugen** (nur für S1 nötig): `pg_get_functiondef` der
      echten Function lesen, Namen auf `zz_probe_…` umschreiben, unmittelbar
      **vor** dem `update public.activation_tokens` ein
      `perform pg_advisory_xact_lock(<schlüssel>);` einsetzen — und **prüfen,
      dass die Einfügung genau einmal gegriffen hat**. Nicht genau einmal heißt:
      die Naht hat sich verschoben, die Kopie misst etwas anderes als das
      Original, Abbruch statt Zahl.
- [ ] 1.5 **S1 — der Befund 8.8**, sitzungsfreier Weg, gegen die Kopie.
      Vorbereitung: Profil P unaktiviert, Token T0 offen,
      `created_at = now() - 25 h`, `expires_at = now() + 47 h`. Ablauf: X hält
      den Advisory Lock → A ruft die Kopie auf und parkt am Riegel, **hinter**
      allen Prüfungen → B ruft die **echte** Function auf, läuft ganz durch und
      committet → X gibt frei → A läuft weiter.
- [ ] 1.6 **S2 — der Wächter-Fall (8.9)**, gegen das Original. Eine zweite
      Verbindung fügt **an den RPCs vorbei** ein offenes Token ein und committet
      **nicht**; dann ruft A auf: die Prüfungen sehen die uncommittete Zeile
      nicht, das `insert` kollidiert am partiellen Index und **blockiert**; die
      zweite Verbindung committet. **Behauptung:** A antwortet `pending` — über
      den `23505`-Zweig, nicht über eine Grenze.
- [ ] 1.7 **S3 — der angemeldete Weg**, gegen das Original. B ruft
      `request_own_activation_token` auf und committet **nicht**; A ruft auf und
      blockiert am `insert` gegen B's uncommittete Indexeintragung; B committet.
- [ ] 1.8 **S4 — die gemischten Wege**, gegen die Originale, in **beiden**
      Gewinner-Reihenfolgen: anonym gewinnt gegen angemeldet und umgekehrt. Über
      `pg_blocking_pids` belegen, dass A tatsächlich **von B** blockiert wird —
      sonst belegt „A war später fertig" nur, dass A langsamer war.

## 2. RED messen — gegen den ungeänderten Stand

- [ ] 2.1 S1 läuft und **fällt**: A antwortet `issued`, und TB trägt danach ein
      `invalidated_at`. Ausgabe wörtlich in dieser Datei festhalten — das ist der
      Befund, nicht seine Beschreibung.
- [ ] 2.2 S3 läuft und **fällt**: A wirft `unique_violation` (SQLSTATE 23505)
      bis an den Aufrufer durch, weil die Function keinen Handler hat.
- [ ] 2.3 S4 läuft und **fällt**: `pg_blocking_pids` ist leer — ohne die Sperre
      warten die beiden Wege an keiner gemeinsamen Zeile aufeinander.
- [ ] 2.4 S2 läuft und ist **grün**. Das ist kein RED/GREEN-Paar, sondern der
      Nachweis, den 8.9 vermisst hat: der Wächter aus 8.1 greift unter einem
      echten Zwei-Sitzungs-Wettlauf. Wenn er hier grün ist, ist das eine
      Messung — und keine, die der Fix erzeugt hat.

## 3. Die Migration

- [ ] 3.1 Neue Migration, die **beide** Functions vollständig neu deklariert
      (Postgres kennt keine partielle Änderung): `for update of p` an die erste
      Abfrage von `issue_activation_token` (Vorfassung `20260808150000`) und von
      `request_own_activation_token` (Vorfassung `20260806090000`).
- [ ] 3.2 Kopfkommentar in der Form der Nachbarn: der Befund, warum die Sperre
      auf `profiles` und nicht auf `activation_tokens` liegt, warum `of p` und
      nicht nacktes `for update`, dass **beide** Wege `profiles` vor
      `activation_tokens` sperren und dass diese Aussage **zwischen diesen
      beiden RPCs** gilt — jeder künftige Schreiber beider Tabellen muss
      dieselbe Reihenfolge einhalten. Dass der `23505`-Zweig bleibt, gehört
      ebenfalls hinein. Verworfene Alternativen mit hinein: `serializable`,
      Advisory Lock als Schutzmechanismus, Schutzfenster für den angemeldeten
      Weg.
- [ ] 3.3 **Nachmessen statt behaupten:** kommentarfreier Rumpf-Diff gegen beide
      Vorfassungen zeigt **ausschließlich** die `for update of p`-Zeile. Das
      Ergebnis kommt in den Kopf; steht dort etwas anderes als gemessen, ist der
      Kopf falsch, nicht die Messung.
- [ ] 3.4 `comment on function` beider Functions um einen Satz zur Sperre
      ergänzen — im Stil der vorhandenen Kommentare, und er nennt das **Warum**
      (gleichzeitige Anforderungen entscheiden sonst auf veraltetem Stand) samt
      der Sperr-Reihenfolge. Die Kommentare sind hier die gelesene Schnittstelle.
- [ ] 3.5 `revoke`/`grant` nach der Neudeklaration erneut aussprechen — wie in
      allen Nachbarmigrationen. **Nicht**, weil die Rechte verlorengingen:
      `create or replace function` behält das Funktionsobjekt samt Privilegien.
      Sondern weil die Rechte dann in jeder Fassung ablesbar dastehen, statt aus
      einer früheren Datei erschlossen werden zu müssen. `grants_test.sql` prüft
      das Ergebnis.

## 4. GREEN messen

- [ ] 4.1 `supabase db reset`, dann die Sonde erneut. Erwartet:
      **S1** — A antwortet `rate_limited` (nicht `pending`: TB ist Sekunden alt,
      die Sperrfrist greift vor dem Schutzfenster), TB bleibt **offen und
      unverändert**;
      **S3** — A antwortet `rate_limited`, **ohne** Datenbankfehler;
      **S4** — `pg_blocking_pids` weist A als von B blockiert aus, in beiden
      Reihenfolgen, und genau einer der beiden gibt ein Token aus;
      **S2** — weiterhin `pending` über den `23505`-Zweig.
- [ ] 4.2 Die Ausgaben wörtlich hier festhalten, neben den roten aus Gruppe 2.
      Paare aus zwei Messungen, nicht Häkchen.
- [ ] 4.3 **Gegenprobe, dass die Sonde etwas misst:** `for update of p` aus
      **einer** der beiden Functions wieder entfernen und belegen, dass **genau**
      die zugehörigen Szenarien fallen und die anderen grün bleiben. Quelle
      danach unverändert (`git diff` leer).
- [ ] 4.4 **Zweite Gegenprobe, auf die Position:** die Sperre in einer Function
      **hinter** die Prüfungen verschieben (statt sie zu entfernen). S1 muss
      fallen — das ist genau der Fall, den der strukturelle Wächter allein nicht
      fangen könnte und den beide Prüfer benannt haben. Quelle danach unverändert.

## 5. Der strukturelle Wächter

- [ ] 5.1 Je Function eine Zeile in `supabase/tests/rls_test.sql`: auf einer von
      `--`-Kommentaren befreiten Fassung von `pg_get_functiondef` steht
      `for update of p` **vor** dem ersten Vorkommen von `activation_tokens`.
      `plan(182)` → `plan(184)`. Die Kommentarbefreiung ist nicht Zierrat — ohne
      sie täuscht ein Kommentar die Reihenfolge vor.
- [ ] 5.2 Sonde für die Sonde: mit **entfernter** Sperre fällt die Zeile, mit
      **verschobener** Sperre ebenfalls. Beides messen — die zweite Messung ist
      der ganze Grund, warum die Zeile Positionen vergleicht statt Vorkommen zu
      zählen.
- [ ] 5.3 Im Test daneben schreiben, was die Zeile **nicht** belegt: sie liest
      Text und bemerkt keine Verhaltensregression. Das Verhalten belegt die
      Sonde aus Gruppe 1, einmal, zum Zeitpunkt des Baus. Verweis auf
      `REVIEWS.md`, wo die Entscheidung gegen den CI-Lauf steht.
- [ ] 5.4 `supabase test db` **mit Dateiliste** laufen lassen (ohne Liste meldet
      der Befehl FAIL, obwohl grün — die `probe_*.sql` sind kein pgTAP), und
      `grants_test.sql` mitprüfen: der Golden-Snapshot bricht bei jeder
      Rechteänderung, auch bei einer, die niemand beabsichtigt hat.

## 6. Prüfen

- [ ] 6.1 `openspec validate --all` grün.
- [x] 6.2 Plan-Review (Stufe 2b) — zwei Prüfer anderer Anbieter (`codex`,
      `gemini`), beide REQUEST-CHANGES, in `REVIEWS.md`. Zwei HIGH-Befunde von
      Codex haben den Belegaufbau und die erwarteten Statuswerte korrigiert; die
      HIGH-Befunde zum fehlenden CI-Lauf sind nach erneuter Rückfrage bewusst
      nicht übernommen.
- [ ] 6.3 `database-sentinel` auf den Diff (SQL/RLS-Gate). Kritische oder hohe
      Befunde blockieren den Branch-Abschluss.
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
