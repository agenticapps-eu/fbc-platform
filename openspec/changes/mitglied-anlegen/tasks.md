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

- [ ] `openspec validate --all` grün
- [ ] `openspec-change-review` mit **zwei** Modellen anderer Anbieter auf das
      Delta; `REVIEWS.md` mit signiertem Trailer
- [ ] Fremdreviewer ausdrücklich auf Migration und Rechte ansetzen (Regel
      26.08.: Schema, Rechte, Sicherheit) — besonders auf die Frage, ob die
      Ableitung wirklich ohne Policy auf `activation_tokens` auskommt

## 2 · Migration (eine Datei, forward-only)

- [ ] RED: pgTAP, der `p_status = 'angelegt'` und `'eingeladen'` erwartet — muss
      rot sein, bevor die Migration steht
- [ ] **Abwurfreihenfolge:** erst die beiden Aufrufer, dann
      `member_state_matches`; Neuanlage in der umgekehrten Reihenfolge. Kein
      `cascade` — es nähme Objekte mit, die diese Migration nicht kennt
- [ ] `member_state_matches` abwerfen und mit fünftem Argument neu anlegen;
      `angelegt` und `eingeladen` als Zweige, `offen` unverändert als Vereinigung
- [ ] **`revoke execute ... from public, anon` wieder aussprechen** — ein `drop`
      nimmt ihn mit, und `default privileges` wirken auf Funktionen nicht
- [ ] `admin_list_members` abwerfen und mit `eingeladen_am` neu anlegen;
      Ableitung als **ein** `left join lateral`, benutzt von Spalte und Filter
- [ ] Grants, Kommentar und **alle vier Parameter-Vorgabewerte** wiederherstellen
- [ ] `admin_member_counts` um die beiden Zustände erweitern, über dieselbe
      geteilte Bedingung — `create or replace` genügt (Rückgabeform gemessen,
      siehe §0). Ändert sich das wider Erwarten, bricht die Migration mitten im
      Lauf: dann erst den Grund messen, nicht blind `drop` nachschieben
- [ ] Katalog-Kommentare aller drei Funktionen richtigstellen — sie nennen heute
      „fuer alle|aktiviert|offen|deaktiviert|geloescht"
- [ ] Migrationskopf trägt die Entscheidungen: warum abgeleitet statt
      gespeichert, warum ein Argument statt eines `exists` im Rumpf, warum
      `offen` bleibt
- [ ] GREEN: derselbe pgTAP läuft durch

## 3 · pgTAP

- [ ] `angelegt` und `eingeladen` teilen `offen` auf, und ihre Summe **ist**
      `offen` — als Zusage geprüft, nicht als Zufall einer Vorrichtung
- [ ] Ein Token, das abgelaufen, benutzt oder entwertet ist, zählt weiter als
      Einladung — die Frage ist „wurde je eingeladen?"
- [ ] `eingeladen_am` trägt bei zwei Token den **späteren**; bei keinem `null`
- [ ] Ein unbekannter `p_status` bricht weiter mit `22023` ab
- [ ] Ein argumentloser Aufruf durch einen Nicht-Admin bricht mit `42501` ab —
      die Probe auf die wiederhergestellten Vorgabewerte
- [ ] Zähler und Liste stimmen für **jeden** der sieben Werte überein
- [ ] **`activation_tokens` bleibt für `anon` und `authenticated` unerreichbar** —
      Positivkontrolle inbegriffen: die Funktion liefert den Wert, der direkte
      Zugriff scheitert
- [ ] Die `::regprocedure`-Casts in `admin_member_list_test.sql` mitziehen und
      belegen, dass sie noch greifen — ein Cast auf eine verschwundene Signatur
      prüft nichts, statt rot zu werden
- [ ] Spaltenvergleich gegen `search_directory` weiter grün; `eingeladen_am`
      gehört NICHT zu den Verzeichnisspalten
- [ ] `grants_test.sql` messen, nicht annehmen — es entsteht keine Tabelle, der
      Snapshot sollte unberührt bleiben
- [ ] Neue Dateien in die Liste in `.github/workflows/ci.yml` eintragen;
      `scripts/pgtap-dateiliste.test.ts` prüft sie in beide Richtungen

## 4 · Edge Function `admin-create-member`

- [ ] RED: Deno-Test, der 403 für ein Konto ohne Admin-Rolle erwartet
- [ ] Function nach dem Muster `admin-change-email`; `sub` aus dem JWT lesen,
      **nicht** `getUser()` (ES256)
- [ ] Konto mit `email_confirm: true` und **ohne Passwort** anlegen; Name und
      `tier` setzen; **nicht** `admin_activate_member` aufrufen
- [ ] RED: Deno-Test je **Antwortzusage**, nicht nur für den 403 — doppelte
      Adresse benennt den Bestand; scheitert der Versand, bleibt das Konto und
      die Antwort sagt es; der `pending`-Ausgang kommt unverfälscht durch
- [ ] Doppelte Adresse: kein zweites Konto, Antwort benennt das bestehende
      Mitglied — und der Weg stimmt auch, wenn zwei Anlagen sich überholen.
      **Wahrheitsquelle ist `auth.users.email`**, nicht `profiles`
- [ ] **Messen, ob GoTrue beim Admin-Anlegen selbst kleinschreibt.** Tut es das
      nicht, ist `A@x.de` neben `a@x.de` ein zweites Konto — der partielle
      Unique-Index ist schreibungsempfindlich (§0). Das Ergebnis gehört in den
      Funktionskopf, nicht nur in einen Test
- [ ] Festlegen und testen, was gilt, wenn das Konto entsteht und das Setzen von
      Name oder `tier` danach scheitert — ein Konto ohne Stufe ist ein Zustand,
      den die Liste zeigen können muss
- [ ] Haken gesetzt → dieselbe Kette wie „Zugangslink schicken"
- [ ] Scheitert der Versand, bleibt das Konto angelegt und die Antwort sagt es
- [ ] `verify_jwt = true` in der Konfiguration — und der Wächter, der das pinnt,
      mitgezogen

## 5 · Frontend

- [ ] RED: Vitest auf die Aufnahmestrecke — drei Schritte, Reihenfolge, Zahlen
- [ ] `src/types/database.types.ts` von Hand nachziehen; **kein** `gen types`
- [ ] Aufnahmestrecke ①→②→③ über der bestehenden Reiterleiste; genau einer der
      sieben Filter gewählt, der Wert steht in der Adresse
- [ ] `?tab=offen` fällt auf ① Angelegt
- [ ] „+"-Knopf und Maske; Plan nur DISCOVER · FOCUS · IMPACT; Haken
      vorausgewählt
- [ ] Kontrollkästchen je Zeile, „Ausgewählte einladen" als **einzige** Handlung
      der Auswahl; Auswahl gilt je Seite. **Kein Kopfkästchen „alle auswählen"** —
      es wäre mit einem Klick deckungsgleich mit der Massenaktion, die ADR-0007
      verwirft (Befund aus dem Plan-Review)
- [ ] Die Aufrufe laufen nacheinander über die bestehende Einzel-Function; ein
      Fehlschlag bricht die Reihe nicht ab. Vor dem Auslösen sagen, dass sich
      Verschicktes nicht zurückdrehen lässt; danach zeigen, wie weit sie kam
- [ ] Beim Sprung von `?tab=offen` auf ① einen einmaligen Hinweis zeigen — das
      alte Lesezeichen meinte die Vereinigung (50), ① zeigt 35
- [ ] Der Bericht trennt die Ausgänge: verschickt, übersprungen (gültiger Link),
      abgewiesen (Grenze), fehlgeschlagen. Keine Sammelzahl über gemischter Menge
- [ ] Zugänglichkeit: „+" auf Desktop und Mobil mit Tastatur und Vorlesesoftware
      bedienbar, auf Mobil nicht von Feedback- oder Chat-Fläche verdeckt
- [ ] `pnpm build`, danach `git checkout -- src/content/release-entries.generated.ts`

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

## Offen, nicht in diesem Change

- [ ] Odoo-Anbindung (AGE-263)
- [ ] Massenmail, CRM, Newsletter (AGE-304) — der Zaun bleibt
- [ ] Zustellbestätigung: `eingeladen_am` sagt „Link erzeugt", nicht „Mail
      angekommen"
