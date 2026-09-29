# Aufgaben — stufen-nur-club (AGE-969)

## 0 · Vor der ersten Codezeile

- [x] Bestand auf PROD bereinigt: drei Konten auf ACTIVE über `admin_set_tier`
      mit Begründung auf DISCOVER gehoben. Nachher **5 × discover, 73 × impact**,
      Spur dreimal `active → discover` in `admin_audit`. Ohne das wäre alles
      Folgende Kaschierung
- [x] Fundstellen gezählt statt vermutet: `LEVEL_ORDER`/`levelLabel`/`LEVELS[`
      in 15 Dateien, davon 9 anzeigend
- [x] Gemessen, dass **alle** `minTier` im Baum `discover` lauten — die
      Schwellen-Texte sind nicht betroffen
- [x] Gemessen, dass `release-entries.generated.ts` **kein Mitglied** erreicht
      (nur `AdminNeuigkeitenPage` und `lib/release-notes.ts`; die beiden anderen
      Fundstellen sind Kommentare) — und dass es für den Admin-Vorrat mit
      `release_entry_skips` (AGE-636) längst eine Markierung gibt
- [x] Gemessen, dass `/mitgliedschaft` seit AGE-907 auf `/` umgeleitet ist —
      die Seite gehört zu AGE-928 und wird hier nicht angefasst
- [x] Gemessen, dass `StyleguidePage` hinter `import.meta.env.DEV` liegt
- [x] **Nachgemessen nach dem Plan-Review**, weil „jede Fläche, die ein Mitglied
      erreichen kann" mehr ist als `src/`:
      * **Mailtexte** — kein Stufenname
      * **Edge Functions** — Treffer nur in Tests, Kommentaren und dem ruhenden
        Kaufweg (`level`-Schlüssel, nicht gerendert)
      * **Native Hülle** — `capacitor.config.ts` liefert `webDir: "dist"`, also
        dasselbe Bündel; keine eigene Fläche
      * **Blog-Slug** der betroffenen Geschichte heisst
        `2026-09-02-rechte-matrix-stufen` und trägt den Namen **nicht** — die
        Sorge des Reviews um eine indexierte Adresse trifft hier nicht zu

## 1 · Plan-Review (Gate, vor jeder Codezeile)

- [x] `openspec validate --all` grün
- [x] `openspec-change-review` mit **zwei** Modellen anderer Anbieter (gemini,
      opencode) — **beide REQUEST-CHANGES**, aufgelöst in `REVIEWS.md`
- [x] Schwerpunkt Trennung `CLUB_RANK` / genannte Menge: **beide bestätigen die
      Entkopplung**, opencode ausdrücklich als „echte Entkopplung, keine
      Phantom-Abstraktion" — die Begründung war allerdings falsch und ist
      berichtigt

## 2 · Die Festlegung

- [ ] RED: Zusage, dass `levels.ts` **sechs** Einträge führt und dass die
      genannte Menge genau `discover, focus, impact` ist
- [ ] `GENANNTE_STUFEN` in `src/config/levels.ts` — eigene Liste, nicht aus
      `CLUB_RANK` abgeleitet, mit der Begründung im Kopf
- [ ] Zusage, die die heutige Deckungsgleichheit mit den Clubstufen als
      **Stand** festhält, nicht als Gesetz. Sie SOLL fallen, wenn jemand die
      Liste ändert — und ihre Fehlermeldung muss den nächsten Bearbeiter
      anleiten: was sie festhält, warum sie fällt, was zu tun ist. Ohne diese
      Meldung wäre sie ein Stolperdraht, der in sechs Monaten stillschweigend
      gelöscht wird (Befund opencode)
- [ ] Ein Helfer „wird diese Stufe genannt?" — eine Stelle, nicht sechs
      Bedingungen

## 3 · Die eigene Stufe eines Mitglieds

- [ ] RED je Aufrufstelle: unterhalb des Clubs keine Plakette, im Club eine —
      beide Hälften
- [ ] `TierBadge` liefert `null` statt einer leeren Plakette
- [ ] **Je Aufrufstelle prüfen, dass das Layout ohne Plakette trägt**
      (`ProfileHero`, `MemberDirectory`, `MemberDashboard`, Einstellungen,
      `AdminMitgliederPage`, `AdminMitgliedPage`) — nicht annehmen
- [ ] **Der Zugangssatz, ausgeschrieben** (Wortlaut in der Spec): „Dein Konto
      ist bestätigt. Der Clubzugang beginnt bei Discover. Eine Stufe lässt sich
      hier zurzeit nicht selbst buchen — schreib uns über Support › Feedback,
      dann melden wir uns." Er steht an EINER Stelle im Code, nicht an dreien
- [ ] Einstellungen: `{levelLabel(tier)}-Mitglied` → der Zugangssatz
- [ ] `ProfileHero`: `{levelLabel(tier)} Member` → nichts
- [ ] `MemberDashboard`: die Kachel „Stufe" und der Rückfall in der
      Mitgliederspalte
- [ ] `MembershipSummary`: kein Stufenname, kein „Nächster Schritt" auf eine
      verborgene Stufe

## 4 · Aufzählende Flächen

- [ ] RED: die Startseite zeigt drei Karten, und der Text nennt keine Sechs
- [ ] `HomePage`: Stufenschiene über `GENANNTE_STUFEN`, Satz „Sechs Stufen,
      aufsteigend" ersetzt. **Preise bleiben unberührt** — ob sie dort stehen
      dürfen, ist die Apple-Frage aus AGE-928
- [ ] RED: die Admin-Einzelbearbeitung bietet drei Stufen **plus** die am Konto
      gesetzte, falls sie darunter liegt
- [ ] `AdminMitgliedPage`: dieselbe Regel wie in `AdminMitgliederPage` seit
      AGE-903 — und die Regel steht dann an **einer** Stelle, nicht an zweien

## 5 · Texte

- [ ] AGB §3.2: Aufzählung auf Discover · Focus · Impact. **Keine andere Zeile
      der Datei anfassen**; der Kopf hält fest, dass der Text von einer Kanzlei
      stammt
- [ ] Im Dateikopf der AGB festhalten, was geändert wurde und auf wessen
      Entscheidung — der Kopf behauptet heute, §3.2 sei aktuell. **Beides
      nennen:** es ist eine Kürzung auf die angebotenen Stufen UND die
      Berichtigung zweier Namen, die es seit AGE-903 nicht mehr gibt. Und als
      Annahme benennen, dass eine Kürzung ohne Rückfrage bei der Kanzlei
      vertretbar ist — das ist die Einschätzung eines Nichtjuristen
- [ ] `release-geschichten.ts`: „Das Verzeichnis beginnt bei Connect" → Discover,
      in Titel und Text

## 6 · Der Wächter über den GERENDERTEN Ansichten

*Neu gefasst nach dem Plan-Review.* Die erste Fassung wollte das gebaute Bündel
durchsuchen — und wäre ab dem ersten Bau rot gewesen: `levels.ts` behält alle
sechs Labels, die Admin-Auswahl braucht sie, und die erzeugte
Neuigkeitenliste behält ihre Vorkommen absichtlich. Ein Wächter über dem
Artefakt kann diese drei nicht von einer echten Fundstelle trennen.

- [ ] RED: ein Test, der die betroffenen Flächen mit einem Konto **unterhalb**
      des Clubs rendert und keinen der drei Namen finden darf
- [ ] Die Gegenprobe im selben Test: dieselbe Fläche mit einem Konto **im**
      Club trägt ihre Plakette. Ohne sie bestünde die Zusage auch mit einer
      Plakette, die es nie gibt
- [ ] Der Zugangssatz steht da, mit Kontaktweg — nicht nur die Abwesenheit
- [ ] **Im Testkopf benennen, was diese Messung nicht sieht**: Inhalte, die ein
      Admin zur Laufzeit pflegt

## 7 · Abnahme

- [ ] Code-Review auf den **Diff** (zwei Anbieter, in `REVIEWS.md` aufgelöst)
- [ ] Sichtprobe gegen den lokalen Stack: ein Konto auf `active` und eines auf
      `discover` nebeneinander, in Profil, Verzeichnis, Dashboard und
      Einstellungen
- [ ] Sichtprobe der Startseite **ohne Konto**
- [ ] `pnpm build`, **danach** `git checkout -- src/content/release-entries.generated.ts`
      — in dieser Reihenfolge, und die Wächter laufen davor: der Bau beschreibt
      eine getrackte Datei, und ein Test nach dem Checkout misst etwas anderes
      als einer davor (Befund opencode)
- [ ] pgTAP unverändert grün — das Gating ist nicht berührt, und genau das soll
      die Zusage zeigen
- [ ] `docs/lastenheft.md` nachziehen

## 8 · Nach dem Merge

- [ ] Kein `migrate-prod` nötig — dieser Change trägt keine Migration
- [ ] Der Neuigkeiten-Eintrag dieses Change ist **für Mitglieder gedacht**: die
      Stufen heissen an der Oberfläche anders, das merkt jeder. Er gehört in den
      nächsten Beitrag (siehe die Entwürfe vom 29.09.)

## Bewusst NICHT in diesem Change

- [ ] `/mitgliedschaft` — gehört zu AGE-928, Route ist umgeleitet
- [ ] Preise, Kaufweg, Stripe — ruhend (AGE-907, AGE-908)
- [ ] Die Selbstregistrierung schliessen — eigene Produktfrage
- [ ] `profiles.tier` auf einen anderen Vorgabewert setzen — eine Migration für
      eine Anzeigefrage wäre der falsche Hebel
- [ ] `release-entries.generated.ts` umschreiben — erreicht kein Mitglied, und
      die Markierung dafür besteht bereits
