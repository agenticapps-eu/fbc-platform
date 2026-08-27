# Tasks — Release-Notes an alle Mitglieder (AGE-631)

Reihenfolge ist nicht beliebig: **Erzeuger vor Datenbank vor Fläche.** Eine
Admin-Fläche auf einer Liste, die es noch nicht gibt, ist eine Attrappe.

## 1. Der Erzeuger: Archiv → ausgeliefertes Modul

- [x] **RED**: Test gegen das **echte** Archiv — der Erzeuger liefert für jedes
      Verzeichnis genau einen Eintrag, auch für die **21 von 50** ohne
      Titelzeile und die **19** ohne `Linear:`-Zeile. Ein Test gegen erfundene
      Verzeichnisse misst den einfachen Fall.
- [x] `scripts/generate-release-entries.ts`: liest `openspec/changes/archive/`,
      schreibt `src/content/release-entries.generated.ts` (Slug, Datum, Titel,
      optionale Linear-Kennung, „What Changes" als Kurzfassung).
- [x] Rückfall auf den Slug, wenn keine Titelzeile da ist. **Nicht abbrechen.**
- [x] `prebuild`-Schritt in `package.json`, damit das Modul nie von Hand
      gepflegt wird.
- [x] **RED**: Wächter-Test, dass das eingecheckte Modul zum Archiv passt —
      sonst driftet es still, und die Fläche zeigt Altes.

## 2. Migration: `release_notes` und die Zustellung

- [x] **RED**: pgTAP — die Tabelle existiert mit `status`-Prüfbedingung
      (`draft`/`sent`), RLS ist an, `authenticated` hält **kein** INSERT auf
      `notifications` für fremde Zeilen.
- [x] **RED**: pgTAP — `send_release_note` zweimal aufgerufen erzeugt beim
      zweiten Mal **null** zusätzliche Zeilen. Positivkontrolle: der erste Lauf
      erzeugt sehr wohl welche.
- [x] **RED**: pgTAP — ein Nicht-Admin ruft die Funktion auf: sie bricht ab, und
      es entsteht keine Zeile.
- [x] **RED**: pgTAP — ein Profil **ohne** `activated_at` bekommt nichts;
      Positivkontrolle daneben, dass die aktivierten sehr wohl etwas bekommen.
- [x] **RED**: pgTAP — alle vier Opt-out-Schalter aus AGE-620 auf `false`, und
      die Release-Note kommt trotzdem an.
- [x] Migration mit Entscheidungskopf (signiert, datiert, verworfene
      Alternativen = `unique`-Index auf `notifications`, Prüfung im Knopf).
- [x] Der Zustandswechsel steht **vor** dem Fan-out und ist bedingt
      (`where … and status = 'draft'`).
- [x] `is_admin()` **rufen**, nicht sein Prädikat abschreiben.
- [x] Grants ausdrücklich aussprechen (AGE-312) — und `grants_test.sql`
      nachziehen: Golden-String **und** die Spalten-Grants-Assertion.
- [x] Neue Testdatei in `ci.yml` eintragen.
- [x] **GRÜN**, auch nach `supabase db reset` — 840 Zusagen.

## 3. Datenschicht im Frontend

- [x] **RED**: Vertragstest — die Liste der noch nicht angekündigten Einträge
      zieht die Slugs aller **zugestellten** Notes ab, nicht die aller Notes.
      Ein Entwurf darf nichts verstecken.
- [x] `src/lib/release-notes.ts`: Entwürfe lesen/schreiben, zugestellte lesen,
      Zustellung über die RPC. **Mit `limit`/`offset` in der ersten Fassung.**
- [x] Query-Keys, Invalidierung nach dem Zustellen.

## 4. Admin-Fläche

- [x] Die Fläche hängt hinter `RequireAdmin`; der bestehende Wächter
      `AppShell.admin.test.tsx` prüft, dass ein gewöhnliches Mitglied den
      Administrationsabschnitt gar nicht sieht.
- [x] **RED**: Test, dass mehrere gewählte Einträge **einen** Entwurf ergeben.
- [x] **RED**: Test, dass der geänderte Text zugestellt wird, nicht der
      vorgeschlagene.
- [x] **RED**: Test, dass es **keine** Empfängerauswahl gibt — die Zusage aus
      `specs/admin`.
- [x] **RED**: Test, dass der Zustellknopf erst nach dem Speichern sendet;
      die Doppelzustellung selbst hält die Datenbank. Gemessen am laufenden
      System: der zweite Aufruf wirft, der Bestand bleibt bei 2. Statt nicht erneut sendet.
- [x] Route `/admin/neuigkeiten` hinter `RequireAdmin`, Eintrag im
      Administrationsmenü.
- [x] Drei Zustände: Laden · Fehler · echte Leere.

## 5. Was das Mitglied sieht

- [x] **RED**: Test, dass die Glocke den Typ `release_note` mit dem **Titel**
      rendert, nicht mit dem Ersatztext.
- [x] **RED**: Test, dass `/neues` nur **zugestellte** Notes zeigt.
- [x] Seite `/neues`, ohne Stufen-Gate; der Hinweis führt dorthin.
- [x] Drei Zustände auch hier.

## 6. Abschluss

- [x] Volle Suite: **1906 Zusagen in 173 Dateien**, grün. Typecheck grün,
      Lint 0 Fehler (5 vorbestehende Warnungen).
- [x] `supabase test db` **mit Dateiliste**: 15 Dateien, 840 Zusagen, grün.
- [x] `openspec validate --all` grün.
- [x] **Sichtprobe im Browser, gegen den laufenden lokalen Stack** — und zwar
      der ganze Weg, nicht Ausschnitte:
      50 Änderungen in der Liste (darunter die Slug-Rückfälle `password-reset-flow`,
      `anon-grants-und-feed-sichtbarkeit`, `activity-concept-level` — genau die
      Proposals ohne Titelzeile) → zwei ausgewählt → Entwurf erzeugt → Titel und
      Text **von Hand überschrieben** → gespeichert → zugestellt.
      Danach gemessen: `status = sent`, `recipient_count = 2`, **2** Zeilen in
      `notifications`, **2** aktivierte Profile; die Liste steht auf **48**, die
      zwei angekündigten sind heraus; die Glocke zeigt „Neu in der App: Videos
      und Nachrichten" als **Link auf `/neues`**; `/neues` zeigt den redigierten
      Text mit Datum. 1440 px und 375 px, hell und navy, **null** Überläufer.
- [x] **Live-Gegenprobe zur Doppelzustellung:** derselbe Aufruf ein zweites Mal
      unter derselben Identität → wirft, und der Bestand bleibt bei 2.
- [x] Gegenproben, sechs an der Zahl, jedes Mal genau die gemeinten Tests:
      Riegel-Bedingung entfernt · Admin-Prüfung entfernt · `with check
      status='draft'` entfernt · Glocken-Renderer entfernt · Ziel entfernt ·
      Entwürfe verstecken Einträge.
- [ ] Diff-Review durch einen fremden Anbieter — **Stand 27.08. nicht möglich**,
      alle drei Arme versagen (siehe `chat-rechte-sidebar/REVIEWS.md`). Wenn
      wieder verfügbar, nachholen.
