# Tasks — Release-Notes an alle Mitglieder (AGE-631)

Reihenfolge ist nicht beliebig: **Erzeuger vor Datenbank vor Fläche.** Eine
Admin-Fläche auf einer Liste, die es noch nicht gibt, ist eine Attrappe.

## 1. Der Erzeuger: Archiv → ausgeliefertes Modul

- [ ] **RED**: Test gegen das **echte** Archiv — der Erzeuger liefert für jedes
      Verzeichnis genau einen Eintrag, auch für die **21 von 50** ohne
      Titelzeile und die **19** ohne `Linear:`-Zeile. Ein Test gegen erfundene
      Verzeichnisse misst den einfachen Fall.
- [ ] `scripts/generate-release-entries.ts`: liest `openspec/changes/archive/`,
      schreibt `src/content/release-entries.generated.ts` (Slug, Datum, Titel,
      optionale Linear-Kennung, „What Changes" als Kurzfassung).
- [ ] Rückfall auf den Slug, wenn keine Titelzeile da ist. **Nicht abbrechen.**
- [ ] `prebuild`-Schritt in `package.json`, damit das Modul nie von Hand
      gepflegt wird.
- [ ] **RED**: Wächter-Test, dass das eingecheckte Modul zum Archiv passt —
      sonst driftet es still, und die Fläche zeigt Altes.

## 2. Migration: `release_notes` und die Zustellung

- [ ] **RED**: pgTAP — die Tabelle existiert mit `status`-Prüfbedingung
      (`draft`/`sent`), RLS ist an, `authenticated` hält **kein** INSERT auf
      `notifications` für fremde Zeilen.
- [ ] **RED**: pgTAP — `send_release_note` zweimal aufgerufen erzeugt beim
      zweiten Mal **null** zusätzliche Zeilen. Positivkontrolle: der erste Lauf
      erzeugt sehr wohl welche.
- [ ] **RED**: pgTAP — ein Nicht-Admin ruft die Funktion auf: sie bricht ab, und
      es entsteht keine Zeile.
- [ ] **RED**: pgTAP — ein Profil **ohne** `activated_at` bekommt nichts;
      Positivkontrolle daneben, dass die aktivierten sehr wohl etwas bekommen.
- [ ] **RED**: pgTAP — alle vier Opt-out-Schalter aus AGE-620 auf `false`, und
      die Release-Note kommt trotzdem an.
- [ ] Migration mit Entscheidungskopf (signiert, datiert, verworfene
      Alternativen = `unique`-Index auf `notifications`, Prüfung im Knopf).
- [ ] Der Zustandswechsel steht **vor** dem Fan-out und ist bedingt
      (`where … and status = 'draft'`).
- [ ] `is_admin()` **rufen**, nicht sein Prädikat abschreiben.
- [ ] Grants ausdrücklich aussprechen (AGE-312) — und `grants_test.sql`
      nachziehen: Golden-String **und** die Spalten-Grants-Assertion.
- [ ] Neue Testdatei in `ci.yml` eintragen.
- [ ] **GRÜN**, auch nach `supabase db reset`.

## 3. Datenschicht im Frontend

- [ ] **RED**: Vertragstest — die Liste der noch nicht angekündigten Einträge
      zieht die Slugs aller **zugestellten** Notes ab, nicht die aller Notes.
      Ein Entwurf darf nichts verstecken.
- [ ] `src/lib/release-notes.ts`: Entwürfe lesen/schreiben, zugestellte lesen,
      Zustellung über die RPC. **Mit `limit`/`offset` in der ersten Fassung.**
- [ ] Query-Keys, Invalidierung nach dem Zustellen.

## 4. Admin-Fläche

- [ ] **RED**: Test, dass die Fläche nur für einen Admin erscheint.
- [ ] **RED**: Test, dass mehrere gewählte Einträge **einen** Entwurf ergeben.
- [ ] **RED**: Test, dass der geänderte Text zugestellt wird, nicht der
      vorgeschlagene.
- [ ] **RED**: Test, dass es **keine** Empfängerauswahl gibt — die Zusage aus
      `specs/admin`.
- [ ] **RED**: Test, dass der Zustellknopf nach dem Senden nicht erneut sendet.
- [ ] Route `/admin/neuigkeiten` hinter `RequireAdmin`, Eintrag im
      Administrationsmenü.
- [ ] Drei Zustände: Laden · Fehler · echte Leere.

## 5. Was das Mitglied sieht

- [ ] **RED**: Test, dass die Glocke den Typ `release_note` mit dem **Titel**
      rendert, nicht mit dem Ersatztext.
- [ ] **RED**: Test, dass `/neues` nur **zugestellte** Notes zeigt.
- [ ] Seite `/neues`, ohne Stufen-Gate; der Hinweis führt dorthin.
- [ ] Drei Zustände auch hier.

## 6. Abschluss

- [ ] Volle Suite (`vitest run` ohne Pfadfilter).
- [ ] `supabase test db` **mit Dateiliste**.
- [ ] `openspec validate --all` grün.
- [ ] Sichtprobe im Browser: Admin-Fläche, Glocke, `/neues` — beide Themes,
      1440 px und 375 px.
- [ ] Gegenproben: je eine Mutation an den Zusagen, die tragen (Zustandswechsel,
      Aktivierungsfilter, Admin-Prüfung, Entwurf-Sichtbarkeit).
- [ ] Diff-Review durch einen fremden Anbieter — **Stand 27.08. nicht möglich**,
      alle drei Arme versagen (siehe `chat-rechte-sidebar/REVIEWS.md`). Wenn
      wieder verfügbar, nachholen.
