# Aufgaben — mitglied-anlegen (AGE-927)

Reihenfolge ist nicht frei: `member_state_matches` ist Argument der beiden
anderen Funktionen, also steht sie zuerst — und weil ihre Signatur sich ändert,
müssen beide Aufrufer in **derselben** Migration neu deklariert werden.

## 0 · Vor der ersten Codezeile

- [x] Verteilung auf PROD gemessen, nur lesend, ohne Namen: 78 Profile, 28
      bestätigt, 50 offen — davon 15 eingeladen und **35 nie**
- [x] `activation_tokens` gelesen: `created_at` / `used_at` / `invalidated_at`,
      RLS an, **keine** Policy und **kein** Grant — absichtlich (AGE-495)
- [x] Die drei Schutzriegel in `issue_activation_token` gelesen: 60 s je Profil,
      5 pro Tag, und das Schutzfenster, in dem ein gültiger unbenutzter Link
      **nicht** ersetzt wird (`pending`)
- [x] `member_state_matches` als geteilte Bedingung erkannt — `immutable`, liest
      nichts, bewusst von Liste UND Zählern benutzt
- [x] Festgestellt, dass `p_status = 'aktiviert'` bereits besteht und nur keinen
      Reiter hat: Schritt ③ kostet keine Datenbankarbeit
- [x] Widerspruch zur geltenden Spec aufgedeckt („keine Mehrfachauswahl",
      AGE-304), Donald vorgelegt, entschieden, in **ADR-0007** festgehalten
- [x] Nach einem bestehenden Branch gesehen — keiner, weder lokal noch gepusht
- [x] **Vorflug am Katalog, weil der Plan-Review drei Annahmen benannt hat:**
      `member_state_matches` ist `sql`, die beiden Aufrufer sind `plpgsql`;
      `pg_depend` führt für alle drei **null** Referenten — der Abwurf gelingt
      und bricht die Aufrufer nur still bis zur Neuanlage in derselben
      Transaktion
- [x] `admin_member_counts` liefert `TABLE(status text, anzahl bigint)` — Zeilen
      je Zustand, **keine** Spalte je Zustand. Ihr Rückgabetyp ändert sich also
      nicht, `create or replace` genügt
- [x] `activation_tokens` trägt `activation_tokens_profil_zeit` auf
      `(profile_id, created_at desc)` — genau der Index, den die Ableitung will.
      Behauptet war er, jetzt ist er gemessen
- [x] **Eindeutigkeit der Anmeldeadresse gemessen, und die Annahme war falsch:**
      es gibt keinen Unique-Constraint auf `auth.users(email)`, sondern den
      partiellen Unique-Index `users_email_partial_key` —
      `btree (email) where (is_sso_user = false)`, also
      **schreibungsempfindlich**. Der einzige Index über `lower(email)` ist
      nicht unique. Die Normalisierung ist damit tragend, nicht bequem
- [x] „Fünf pro Tag" gilt **je Profil**, nicht je Absender (`count(*) … where
      t.profile_id = v_id`). Eine Auswahl aus 35 verschiedenen Mitgliedern läuft
      nicht beim sechsten tot; das globale Stundenkontingent von 100 sitzt im
      **Selbst**-Anforderungsweg und nicht hier
- [x] `::regprocedure`-Casts nachgesehen: sie nennen
      `admin_list_members(text,text,int,int)`, und die Parameterliste bleibt
      gleich — sie lösen sich unverändert auf. Die frühere Behauptung im
      Entwurf, ein Cast auf eine verschwundene Signatur „prüfe dann nichts",
      war falsch: er wirft `42883`

## 1 · Plan-Review (Gate, vor jeder Codezeile)

- [x] `openspec validate --all` grün
- [x] `openspec-change-review` mit **zwei** Modellen anderer Anbieter auf das
      Delta; `REVIEWS.md` mit signiertem Trailer
- [x] Fremdreviewer ausdrücklich auf Migration und Rechte ansetzen (Regel
      26.08.: Schema, Rechte, Sicherheit) — besonders auf die Frage, ob die
      Ableitung wirklich ohne Policy auf `activation_tokens` auskommt

## 2 · Migration (eine Datei, forward-only)

- [x] RED: pgTAP, der `p_status = 'angelegt'` und `'eingeladen'` erwartet — war
      rot mit `22023: unbekannter Status: angelegt`, also aus dem richtigen
      Grund (`supabase/tests/admin_einladungsstand_test.sql`, 19 Zusagen)
- [x] **Abwurfreihenfolge:** erst `admin_list_members`, dann
      `member_state_matches`. Kein `cascade`. `admin_member_counts` wird gar
      nicht abgeworfen — ihr Rückgabetyp bleibt gleich
- [x] `member_state_matches` abwerfen und mit fünftem Argument neu anlegen;
      `angelegt` und `eingeladen` als Zweige, `offen` unverändert als Vereinigung
- [x] **`revoke execute ... from public, anon` wieder aussprechen** — ein `drop`
      nimmt ihn mit, und `default privileges` wirken auf Funktionen nicht.
      **Beim ersten Anlauf für `admin_list_members` vergessen**, obwohl der
      Migrationskopf davor warnt: zwei Zusagen des Bestandstests fielen sofort
      (`anon darf nicht ausführen`, `PUBLIC hält kein EXECUTE`). Der Wächter
      hat getan, wozu er da ist
- [x] `admin_list_members` abwerfen und mit `eingeladen_am` neu anlegen;
      Ableitung als **ein** `left join lateral`, benutzt von Spalte und Filter
- [x] Grants, Kommentar und **alle vier Parameter-Vorgabewerte** wiederherstellen
- [x] `admin_member_counts` um die beiden Zustände erweitern, über dieselbe
      geteilte Bedingung — `create or replace` genügt (Rückgabeform gemessen,
      siehe §0). Ändert sich das wider Erwarten, bricht die Migration mitten im
      Lauf: dann erst den Grund messen, nicht blind `drop` nachschieben
- [x] Katalog-Kommentare aller drei Funktionen richtigstellen — sie nannten
      „fuer alle|aktiviert|offen|deaktiviert|geloescht"
- [x] Migrationskopf trägt die Entscheidungen: warum abgeleitet statt
      gespeichert, warum ein Argument statt eines `exists` im Rumpf, warum
      `offen` bleibt — und was `eingeladen_am` NICHT sagt
- [x] GREEN: derselbe pgTAP läuft durch — 19/19

## 3 · pgTAP — erledigt

Gesamtlauf gegen die CI-Liste: **41 Dateien, 1411 Zusagen, alle grün.**


- [x] `angelegt` und `eingeladen` teilen `offen` auf, und ihre Summe **ist**
      `offen` — als Zusage geprüft, nicht als Zufall einer Vorrichtung
- [x] Ein Token, das abgelaufen, benutzt oder entwertet ist, zählt weiter als
      Einladung — die Frage ist „wurde je eingeladen?"
- [x] `eingeladen_am` trägt bei zwei Token den **späteren**; bei keinem `null`
- [x] Ein unbekannter `p_status` bricht weiter mit `22023` ab
- [x] Ein argumentloser Aufruf durch einen Nicht-Admin bricht mit `42501` ab —
      die Probe auf die wiederhergestellten Vorgabewerte
- [x] Zähler und Liste stimmen für **jeden** der sieben Werte überein
- [x] **`activation_tokens` bleibt für `anon` und `authenticated` unerreichbar** —
      Positivkontrolle inbegriffen: die Funktion liefert den Wert, der direkte
      Zugriff scheitert
- [x] **Drei Zusagen am Ende von `admin_member_list_test.sql` auf fünf Argumente
      ziehen** — sie nennen `member_state_matches(text,timestamptz,timestamptz,
      timestamptz)` zweimal als Zeichenkette in `has_function_privilege` und
      einmal als `::regprocedure`. Ungezogen wirft die Datei `42883`, bevor sie
      etwas prüft. Die Casts auf `admin_list_members` bleiben unberührt, dort
      ändert sich die Parameterliste nicht
- [x] Spaltenvergleich gegen `search_directory` weiter grün; `eingeladen_am`
      gehört NICHT zu den Verzeichnisspalten
- [x] `grants_test.sql` messen, nicht annehmen — es entsteht keine Tabelle, der
      Snapshot sollte unberührt bleiben
- [x] Neue Dateien in die Liste in `.github/workflows/ci.yml` eintragen;
      `scripts/pgtap-dateiliste.test.ts` prüft sie in beide Richtungen

## 4 · Edge Functions — erledigt

Deno: **288 Zusagen grün**, `deno check` über alle Functions sauber. Beide
Endpunkte folgen dem Muster `admin-change-email` (Kennung aus dem verifizierten
Token, Admin-Prüfung über `is_admin_uid` gegen `staff_roles`).

**Zwei Datenbankfunktionen kamen dazu** (`20260929090000_adresse_nachschlagen.sql`),
weil `service_role` seit AGE-312 auf **keiner** Tabelle in `public` ein SELECT
oder UPDATE hält — ein direktes `.from("profiles")` liefe in „permission
denied". Beide sind **nur an `service_role` gewährt**; die Abwehr sitzt im
Grant, nicht im Rumpf, weil dort `auth.uid()` null wäre.


- [x] RED: Deno-Test, der 403 für ein Konto ohne Admin-Rolle erwartet
- [x] Function nach dem Muster `admin-change-email`; `sub` aus dem JWT lesen,
      **nicht** `getUser()` (ES256)
- [x] Konto mit `email_confirm: true` und **ohne Passwort** anlegen; Name und
      `tier` setzen; **nicht** `admin_activate_member` aufrufen
- [x] RED: Deno-Test je **Antwortzusage**, nicht nur für den 403 — doppelte
      Adresse benennt den Bestand; scheitert der Versand, bleibt das Konto und
      die Antwort sagt es; der `pending`-Ausgang kommt unverfälscht durch
- [x] Doppelte Adresse: kein zweites Konto, Antwort benennt das bestehende
      Mitglied — und der Weg stimmt auch, wenn zwei Anlagen sich überholen.
      **Wahrheitsquelle ist `auth.users.email`**, nicht `profiles`
- [x] **Messen, ob GoTrue beim Admin-Anlegen selbst kleinschreibt.** Gemessen am
      29.09. auf PROD: von 78 Konten tragen **0** Grossbuchstaben, und es gibt
      **0** Adressen, die sich nur in der Schreibung unterscheiden. Die Lücke
      ist damit heute theoretisch. Sie wird trotzdem geschlossen, weil sie
      nichts kostet und der Bestand nicht so bleiben muss: die Function schreibt
      selbst klein, und `admin_adresse_nachschlagen` vergleicht über
      `lower(email)`
- [x] Festlegen und testen, was gilt, wenn das Konto entsteht und das Setzen von
      Name oder `tier` danach scheitert — ein Konto ohne Stufe ist ein Zustand,
      den die Liste zeigen können muss
- [x] Haken gesetzt → dieselbe Kette wie „Zugangslink schicken"
- [x] Scheitert der Versand, bleibt das Konto angelegt und die Antwort sagt es
- [x] `verify_jwt = true` in der Konfiguration — und der Wächter, der das pinnt,
      mitgezogen
- [x] **Adressprüfung ohne Rücksicht auf Gross-/Kleinschreibung** —
      `lower(email)` gegen `lower(:adresse)`. Der Index ist partiell UND
      schreibungsempfindlich; ein Vergleich Zeichenkette gegen Zeichenkette
      legte `A@x.de` neben `a@x.de` an
- [x] Gehört die Adresse zu einem gelöschten oder deaktivierten Mitglied, sagt
      die Antwort genau das — sonst verweist sie auf jemanden, den der Admin in
      keiner sichtbaren Liste findet
- [x] Das Anlegen hinterlässt dieselbe Spur wie andere privilegierte Änderungen
- [x] Adressform prüfen, bevor ein Konto entsteht

### `admin-invite-members` (neu, aus dem Plan-Review)

Die bestehende `send-activation` antwortet auf **jedem** Pfad mit
`202 {accepted: true}` — absichtlich, damit die Antwortzeit nicht verrät, ob
eine Adresse besteht. Über sie ist der zugesagte Bericht nicht herstellbar.

- [x] RED: Deno-Test, der für eine Auswahl aus drei Mitgliedern drei
      **unterschiedliche** Ausgänge erwartet — verschickt, übersprungen
      (`pending`), abgewiesen (Grenze)
- [x] `admin-invite-members` mit `verify_jwt = true` und Admin-Prüfung über
      `staff_roles`; ruft dasselbe `issue_activation_token`, wartet den Versand
      ab und meldet je Mitglied den Ausgang
- [x] Mailtext aus einem **gemeinsamen Modul**. Es musste keines entstehen:
      `../send-activation/emails.ts` ist bereits rein und wird von
      `resend-activation` schon so benutzt — Cross-Import zwischen Functions ist
      hier das etablierte Muster (viermal im Bestand). `send-activation` wurde
      **nicht angefasst** und behält ihr „erst antworten, dann senden"; der
      Aufzählungsschutz gilt dort weiter
- [x] Belegen, dass `send-activation` sich nicht verändert hat: ihre
      Bestandstests bleiben **unverändert** grün, nicht angepasst
- [x] Ein Fehlschlag bricht die Reihe nicht ab

## 5 · Frontend — erledigt

Vitest: **28 neue Zusagen** in `AdminMitgliederPage.aufnahme.test.tsx`, die
Gesamtmenge 254 Dateien / 2955 Zusagen grün, `tsc --noEmit` und `eslint` sauber.
Drei Bestandszusagen wurden **benannt** nachgezogen, weil „Nicht aktiviert" in
① und ② geteilt ist — nicht abgeschaltet.

**Die Schleife läuft in der FLÄCHE, ein Aufruf je Mitglied** — und nicht als
eine Sammelanfrage an `admin-invite-members`, obwohl der Endpunkt eine Liste
nimmt. Zwei Zusagen verlangen es: „Fortschritt als Zahl" gibt es nur, wenn
Antworten einzeln eintreffen, und „Wegnavigieren bricht ab, es gehen keine
weiteren Einladungen hinaus" ist unmöglich, wenn die Schleife im Server läuft.
Die Mengengrenze im Endpunkt bleibt trotzdem richtig — sie schützt vor einem
Aufruf, der gar nicht von der Fläche kommt.


- [x] RED: Vitest auf die Aufnahmestrecke — drei Schritte, Reihenfolge, Zahlen
- [x] `src/lib/database.types.ts` von Hand nachziehen; **kein** `gen types`
- [x] Aufnahmestrecke ①→②→③ über der bestehenden Reiterleiste; genau einer der
      sieben Filter gewählt, der Wert steht in der Adresse
- [x] `?tab=offen` fällt auf ① Angelegt
- [x] „+"-Knopf und Maske; Plan nur DISCOVER · FOCUS · IMPACT; Haken
      vorausgewählt
- [x] Kontrollkästchen je Zeile, „Ausgewählte einladen" als **einzige** Handlung
      der Auswahl; Auswahl gilt je Seite. **Kein Kopfkästchen „alle auswählen"** —
      es wäre mit einem Klick deckungsgleich mit der Massenaktion, die ADR-0007
      verwirft (Befund aus dem Plan-Review)
- [x] Die Aufrufe laufen nacheinander, **über `admin-invite-members` und nicht
      über die bestehende Einzel-Function**: `send-activation` antwortet auf
      jedem Pfad mit `202 {accepted: true}`, über sie ist kein
      wahrheitsgemässer Bericht herstellbar (Plan-Review Runde 2, Donald
      28.09.). Die Schleife liegt in der Fläche, ein Aufruf je Mitglied; ein
      Fehlschlag bricht die Reihe nicht ab — `ladeEin` wirft nicht, sondern
      meldet `fehlgeschlagen` als Ergebnis. Vor dem Auslösen steht die
      Unumkehrbarkeit, danach der Bericht
- [x] Beim Sprung von `?tab=offen` auf ① einen einmaligen Hinweis zeigen — das
      alte Lesezeichen meinte die Vereinigung (50), ① zeigt 35
- [x] Der Bericht trennt die Ausgänge: verschickt, übersprungen (gültiger Link),
      abgewiesen (Grenze), fehlgeschlagen. Keine Sammelzahl über gemischter Menge.
      Er entsteht aus den **Antworten**, nicht aus einem Vorher-Nachher-Vergleich
- [x] Übersprungene und abgewiesene Mitglieder namentlich, nicht nur gezählt;
      der Bericht bleibt stehen, bis der Admin ihn schliesst
- [x] Vorher eine Rückfrage, die die **Zahl** nennt und die Unumkehrbarkeit;
      währenddessen Fortschritt als Zahl, kein Modal
- [x] Die Liste bewegt sich während des Laufs nicht und lädt erst danach einmal
      neu — **mit** Filter, Suchbegriff und Seite
- [x] Wegnavigieren bricht ab, ohne Browser-Rückfrage: es gibt keinen
      Zwischenzustand zwischen zwei Mitgliedern
- [x] „Ausgewählte einladen" nur in den Schritten ① und ②
- [x] Zugänglichkeit: „+" auf Desktop und Mobil mit Tastatur und Vorlesesoftware
      bedienbar, auf Mobil nicht von Feedback- oder Chat-Fläche verdeckt
- [x] `pnpm build`, danach `git checkout -- src/content/release-entries.generated.ts`

## 6 · Abnahme

- [ ] Code-Review auf den **Diff** (zwei Anbieter, in `REVIEWS.md` aufgelöst)
- [ ] Sichtprobe gegen den lokalen Stack: Mitglied anlegen mit und ohne Haken,
      beide landen im richtigen Schritt
- [ ] Sichtprobe für den `pending`-Fall: zweimal hintereinander einladen, und der
      Bericht sagt beim zweiten Mal die Wahrheit
- [ ] Die drei Schritte summieren sich auf einem PROD-ähnlichen Bestand zu dem,
      was heute „Nicht aktiviert" ist
- [ ] `docs/lastenheft.md` nachziehen

## 7 · Nach dem Merge

- [ ] `migrate-prod` und den blockierten Deploy — **ausdrückliche Freigabe
      nötig**, die stehende Merge-Freigabe deckt sie nicht
- [ ] Der Neuigkeiten-Eintrag dieses Change ist für Mitglieder **nicht** gedacht
      (reine Admin-Fläche) — im PR dazuschreiben, dass er zum Überspringen ist

## Bewusst NICHT geändert, obwohl im Review benannt

- **`src/lib/database.types.ts` bleibt handgepflegt.** gemini hält das für
  fragil, und das stimmt. `supabase gen types` darüberlaufen zu lassen ist hier
  trotzdem verboten: die Datei trägt von Hand gepflegte Verengungen, die der
  Erzeuger plattmacht. Das zu ändern ist eine eigene Entscheidung mit eigenem
  Vorgang, nicht ein Nebenschauplatz dieses Change.

## Offen, nicht in diesem Change

- [ ] Odoo-Anbindung (AGE-263)
- [ ] Massenmail, CRM, Newsletter (AGE-304) — der Zaun bleibt
- [ ] Zustellbestätigung: `eingeladen_am` sagt „Link erzeugt", nicht „Mail
      angekommen"
- [ ] Ein Unique-Index über `lower(email)` in `auth.users` — er schlösse das
      Rennen bei verschieden geschriebenen Adressen, schreibt aber in fremdes
      Schema. Eigene Entscheidung
